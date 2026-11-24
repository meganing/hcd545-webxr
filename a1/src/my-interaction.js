import * as THREE from 'three';
import { settings, onChange } from './settings.js';
import { Button3D } from './menu.js';
import { Hud, Board } from './game/hud.js';
import { buildWorld } from './game/world.js';
import { DIFFS, REAL, TOTAL, ROOM_CENTERS, roomAt, clockText } from './game/rooms.js';

// A1: "Spot the difference" in 3D. Two rooms look the same but differ in TOTAL things. The visitor teleports into each room and looks
// at an object until the dwell ring fills to flag it. Real differences get a green circle in both rooms; decoys (turned, moved, lit
// differently) get a caption that says why they do not count. Everything is done by gaze: no controller, touch or key after Start.
//
// The state machine from the starter template is kept:   start  ->  play  ->  end  ->  (reset)  ->  start
//   start : a board with the rules and a Begin button (gaze target) in the lobby
//   play  : the timer runs, objects of the room you stand in are gaze targets, a hint comes when you are stuck
//   end   : the board shows time and wrong flags; Play again is a gaze target; Restart and Exit (safe.js) call reset()
// Why targets are switched per room: a target must cover 3 degrees of view from where the visitor uses it, so only the objects of the
// room you stand in can be targets (hcd.angularSizes() then lists only targets that pass).
const HINT_AFTER = 25;   // seconds without a find before the hint (the 3-minute goal needs it)
// Game feel (why: a short clock, a cost for guessing and a streak turn "find five things" into "do it faster and cleaner").
const TIME_LIMIT = 120;      // seconds; a first-time player still finishes under 3 minutes
const WRONG_COST = 8;        // seconds lost for a wrong flag: guessing is not free
const FIND_POINTS = 100;     // x1, x2, x3 for a streak of finds with no wrong flag in between
const TIME_BONUS = 2;        // points per second left when all are found
const BEST_KEY = 'hcd545-webxr-a1-best';
const loadBest = () => { try { return Number(localStorage.getItem(BEST_KEY)) || 0; } catch { return 0; } };
const saveBest = (v) => { try { localStorage.setItem(BEST_KEY, String(v)); } catch { /* private mode: the best score is just not kept */ } };
const rankFor = (pts, won) => (!won ? 'Keep looking' : pts >= 650 ? 'Eagle eyes' : pts >= 450 ? 'Sharp' : 'Got there');

export function addMyTargets({ scene, camera, gaze, captions, audio, pads, texScale = 1 }) {
  const world = buildWorld({ texScale });
  scene.add(world.root);
  const hud = new Hud(camera);
  const board = new Board();
  board.mesh.position.set(0, 1.75, -2.2);
  world.root.add(board.mesh);

  // ---- state ---------------------------------------------------------------------------------------------------------------
  let state = 'start', active = true, room = 'lobby';
  let wrong = 0, elapsed = 0, sinceFind = 0, endTimer = 0, streak = 0, score = 0, won = false, best = loadBest(), newBest = false;
  const found = new Set(), ruledOut = new Set(), missed = new Set();   // missed: shown at the end when time runs out   // ids; a difference counts in both rooms

  // ---- rings: a circle that always faces the viewer. White while you look at an object, green once it is a found difference ----
  const entries = [...world.rooms.A.objects.values(), ...world.rooms.B.objects.values()];
  const RING_FIT = 0.75;   // ring radius as a share of the proxy radius: it circles the object, not the whole corner
  const ringGeo = new THREE.RingGeometry(0.86, 1, 48);
  const rings = new Map();   // "id:room" -> mesh
  for (const id of new Set(entries.map((e) => e.id))) {
    for (const r of ['A', 'B']) {
      // A missing object has no entry in room B: circle the empty spot (the same place as in room A).
      const e = world.rooms[r].objects.get(id) || world.rooms[r === 'A' ? 'B' : 'A'].objects.get(id);
      const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthTest: true, depthWrite: false, side: THREE.DoubleSide }));
      ring.renderOrder = 990; ring.visible = false; ring.frustumCulled = false;
      ring.position.set(ROOM_CENTERS[r].x + e.center.x, e.center.y, ROOM_CENTERS[r].z + e.center.z);
      ring.scale.setScalar(Math.max(e.radius * RING_FIT, 0.2));
      ring.userData = { id, room: r, hover: false, base: ring.position.clone() };
      world.root.add(ring); rings.set(`${id}:${r}`, ring);
    }
  }
  function paintRing(ring) {
    const isFound = found.has(ring.userData.id), isMissed = missed.has(ring.userData.id);
    ring.visible = (isFound || isMissed || ring.userData.hover) && world.rooms[ring.userData.room].contents.visible;   // no ring around something you cannot see
    ring.material.color.setHex(isMissed ? 0xffa000 : isFound ? (settings.contrast ? 0xffeb3b : 0x00e676) : 0xffffff);
    ring.material.opacity = isFound || isMissed ? 1 : 0.55;
  }
  const paintAll = () => rings.forEach(paintRing);

  // ---- gaze targets: the proxies ---------------------------------------------------------------------------------------------
  const inGaze = new Set();
  function setTarget(e, on) {
    if (on && !inGaze.has(e)) { gaze.add(e.proxy); inGaze.add(e); }
    if (!on && inGaze.has(e)) { gaze.remove(e.proxy); inGaze.delete(e); }
  }
  for (const e of entries) {
    e.proxy.userData.target = {
      label: e.label,
      onActivate: () => flag(e),
      setHover: (on) => { const r = rings.get(`${e.id}:${e.room}`); r.userData.hover = on; paintRing(r); },
    };
  }

  function flag(e) {
    if (state !== 'play') return;
    const d = DIFFS.find((x) => x.id === e.id);
    if (d?.counts) {
      found.add(e.id); sinceFind = 0; streak++;
      const mult = Math.min(streak, 3); score += FIND_POINTS * mult;
      captions.say(`[rising chime] Found: ${d.say} (${found.size} of ${TOTAL})${mult > 1 ? `  combo x${mult}` : ''}`, 4);
      setTimeout(() => audio.sfx('found', 1 + 0.12 * (mult - 1)), 150);   // after the activation ping from main.js; higher with the combo
      paintAll();
      if (found.size === TOTAL) finish(true);
    } else {
      wrong++; ruledOut.add(e.id); streak = 0; elapsed += WRONG_COST;
      setTimeout(() => audio.sfx('wrong'), 150);
      captions.say(`[low buzz] ${d ? `Not a difference: ${d.say}` : `${e.label}: the same in both rooms`}  (-${WRONG_COST} s)`, 4);
    }
    refresh();
  }

  // Which proxies may be looked at right now: play state, game view, only the room the visitor is in, not already settled.
  function refresh() {
    for (const e of entries) {
      setTarget(e, active && state === 'play' && e.room === room && !found.has(e.id) && !ruledOut.has(e.id));
    }
    // The 3D buttons: Begin in the lobby at the start, Play again in the lobby at the end.
    const here = active && room === 'lobby';
    setButton(begin, here && state === 'start');
    setButton(again, here && state === 'end');
    board.mesh.visible = active && state !== 'play';
    // One room at a time: while playing you only see the things in the room you stand in, so you compare from memory.
    // At the start and the end both rooms are open (a preview, then the reveal).
    for (const name of ['A', 'B']) {
      const open = active && (state !== 'play' || room === name);
      world.rooms[name].contents.visible = open;
      world.rooms[name].closed.visible = active && !open;   // a closed room says so and says what to do
    }
    if (state === 'start') board.show({ title: `Find ${TOTAL} differences`, lines: [
      `${TIME_LIMIT / 60} minutes, one room at a time.`, 'Look at a gold pad to step into a room.', 'Look at a thing until the ring fills.',
      'Counts: size, colour, picture, missing.', 'Does not: a thing turned, moved or lit.', `A wrong flag costs ${WRONG_COST} seconds.`] });
    if (state === 'end') board.show({ title: won ? `All ${TOTAL} found!` : `Time's up: ${found.size} of ${TOTAL}`, lines: [
      `Score ${score}${newBest ? '  (new best!)' : `   Best ${best}`}`, `${rankFor(score, won)}.  Wrong flags: ${wrong}`,
      won ? `Time left ${clockText(Math.max(0, TIME_LIMIT - elapsed))}` : 'Orange rings: what you missed.', 'Look at Play again, or Restart below.'] });
    paintAll();
  }

  // ---- 3D buttons -------------------------------------------------------------------------------------------------------------
  const ui = new THREE.Group();
  ui.position.set(0, 1.0, -2.2);
  world.root.add(ui);
  const makeButton = (label, onActivate) => {
    const b = new Button3D({ label, w: 0.9, h: 0.36, onActivate, colors: { base: 0x2e7d32, hover: 0x43a047 } });
    ui.add(b.group); b.group.visible = false;
    return b;
  };
  const begin = makeButton('Begin', () => start());
  const again = makeButton('Play again', () => start());
  function setButton(b, on) {
    b.group.visible = on;
    if (on) gaze.add(b.group); else gaze.remove(b.group);
  }

  // ---- the state machine --------------------------------------------------------------------------------------------------------
  function start() {
    found.clear(); ruledOut.clear(); missed.clear(); wrong = 0; elapsed = 0; sinceFind = 0; endTimer = 0; streak = 0; score = 0; won = false; newBest = false;
    state = 'play';
    api.onStart?.();   // main.js stops the starter's gaze trial, so its pink ball cannot appear in the game
    captions.say(`Find ${TOTAL} differences. Look at a gold pad, then at things in the room.`, 5);
    refresh();
  }
  function finish(didWin) {
    won = didWin;
    if (won) score += Math.max(0, Math.round(TIME_LIMIT - elapsed)) * TIME_BONUS;
    else for (const d of REAL) if (!found.has(d.id)) missed.add(d.id);
    if (score > best) { best = score; newBest = score > 0; saveBest(best); }
    state = 'end'; endTimer = 2.5;
    setTimeout(() => audio.sfx(won ? 'win' : 'lose'), won ? 450 : 0);   // the win waits for the last find's sound
    captions.say(won ? `[fanfare] All ${TOTAL} found. Score ${score}. Back to the lobby...` : `[falling tone] Time's up: ${found.size} of ${TOTAL}. Back to the lobby...`, 3);
  }
  // The reset path: put the experience back to its first state (called by safe.js through main.js; also in the console: hcd.mine.reset()).
  function reset() {
    state = 'start'; found.clear(); ruledOut.clear(); missed.clear(); wrong = 0; elapsed = 0; sinceFind = 0; endTimer = 0; streak = 0; score = 0; won = false; newBest = false;
    refresh();
  }

  // ---- hint: a positional ping from the nearest unfound difference, plus a caption (works with sound off) -------------------
  const _a = new THREE.Vector3(), _b = new THREE.Vector3();
  function hint() {
    camera.getWorldPosition(_a);
    let best = null, bestScore = Infinity;
    for (const d of REAL) {
      if (found.has(d.id)) continue;
      for (const r of ['A', 'B']) {
        const e = world.rooms[r].objects.get(d.id);
        if (!e) continue;
        e.group.getWorldPosition(_b);
        const score = _a.distanceTo(_b) + (r === room ? 0 : 100);   // prefer the room you are in
        if (score < bestScore) { bestScore = score; best = e; }
      }
    }
    if (!best) return;
    if (best.room !== room) captions.say(`Hint: look for something in room ${best.room}`, 5);
    else captions.say(`Hint ${audio.hintAt(best.group)}`, 5);
  }

  // ---- size: Target size scales the hit proxies and the buttons, not the rooms ------------------------------------------------
  const applyScale = () => { entries.forEach((e) => e.proxy.scale.setScalar(settings.targetScale)); ui.scale.setScalar(settings.targetScale); };
  applyScale();
  onChange((k) => { if (k === 'targetScale') applyScale(); if (k === 'contrast') { paintAll(); board.show({ title: '', lines: [] }); refresh(); } });

  const api = {
    root: world.root, hud, board, reset, start, hint,   // hud and board: main.js fits them to a narrow screen
    get state() { return state; }, get room() { return room; }, get found() { return [...found]; }, get wrong() { return wrong; }, get score() { return score; }, get timeLeft() { return TIME_LIMIT - elapsed; },
    onRoom: null,        // main.js sets this: it shows the starter's menu and speaker only in the lobby
    flagId: (id, r) => flag(world.rooms[r || 'B'].objects.get(id) || world.rooms.A.objects.get(id)),   // console / test helper
    // Game view on or off (the Cues button: the first view is the game, the others are the starter's scale-cue scene).
    setActive(on) { active = on; world.root.visible = on; refresh(); if (!on) hud.set(''); },
    update(dt, t) {
      camera.getWorldPosition(_a);
      const now = roomAt(_a.x, _a.z);
      if (now !== room) {
        room = now; refresh(); api.onRoom?.(room);
        if (active && state === 'play' && room !== 'lobby') captions.say(`[chime] Room ${room}. To leave: turn around and look at the gold pad`, 4);
      }
      if (active && state === 'play' && !gaze.paused) {
        elapsed += dt; sinceFind += dt;
        if (sinceFind >= HINT_AFTER) { sinceFind = 0; hint(); }
        if (elapsed >= TIME_LIMIT) finish(false);
      }
      if (endTimer > 0) { endTimer -= dt; if (endTimer <= 0) { pads.home(); } }
      if (active) {
        hud.set(state !== 'play' ? '' : `Found ${found.size}/${TOTAL} · ${clockText(Math.max(0, TIME_LIMIT - elapsed))} · ${score} pts${streak > 1 ? ` x${Math.min(streak, 3)}` : ''}`);
        // face the viewer; found rings pulse unless reduced motion is on
        const pulse = settings.reducedMotion ? 1 : 1 + 0.06 * Math.sin(t * 4);
        camera.getWorldQuaternion(_q);
        rings.forEach((r) => {
          if (!r.visible) return;
          r.quaternion.copy(_q);
          const rad = Math.max(entryRadius(r) * RING_FIT, 0.2) * settings.targetScale;
          r.scale.setScalar(rad * (found.has(r.userData.id) ? pulse : 1));
          // Depth-tested, so walls and the board hide it. Moved toward the viewer by its radius so the object itself does not cut it.
          _d.subVectors(_a, r.userData.base).normalize();
          r.position.copy(r.userData.base).addScaledVector(_d, rad + 0.05);
        });
      }
    },
  };
  const _q = new THREE.Quaternion(), _d = new THREE.Vector3();
  const entryRadius = (r) => { const e = world.rooms[r.userData.room].objects.get(r.userData.id) || world.rooms[r.userData.room === 'A' ? 'B' : 'A'].objects.get(r.userData.id); return e.radius; };

  reset();
  return api;
}
