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

export function addMyTargets({ scene, camera, gaze, captions, audio, pads, texScale = 1 }) {
  const world = buildWorld({ texScale });
  scene.add(world.root);
  const hud = new Hud(camera);
  const board = new Board();
  board.mesh.position.set(0, 1.75, -2.2);
  world.root.add(board.mesh);

  // ---- state ---------------------------------------------------------------------------------------------------------------
  let state = 'start', active = true, room = 'lobby';
  let wrong = 0, elapsed = 0, sinceFind = 0, endTimer = 0;
  const found = new Set(), ruledOut = new Set();   // ids; a difference counts in both rooms

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
    const isFound = found.has(ring.userData.id);
    ring.visible = isFound || ring.userData.hover;
    ring.material.color.setHex(isFound ? (settings.contrast ? 0xffeb3b : 0x00e676) : 0xffffff);
    ring.material.opacity = isFound ? 1 : 0.55;
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
      found.add(e.id); sinceFind = 0;
      captions.say(`[chime] Found: ${d.say} (${found.size} of ${TOTAL})`, 4);
      setTimeout(() => audio.ping(), 200);   // a second chime: the first one comes from main.js for every activation
      paintAll();
      if (found.size === TOTAL) finish();
    } else {
      wrong++; ruledOut.add(e.id);
      captions.say(d ? `[chime] Not a difference: ${d.say}` : `[chime] ${e.label}: the same in both rooms`, 4);
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
    if (state === 'start') board.show({ title: `Find ${TOTAL} differences`, lines: [
      `Rooms A and B differ in ${TOTAL} things.`, 'Look at a gold pad to go there.', 'Look at a thing to flag it.',
      'Bigger, smaller or missing counts. Flag a missing thing where it still stands.', 'Only turned, moved or lit: not a difference.'] });
    if (state === 'end') board.show({ title: `All ${TOTAL} found!`, lines: [`Time ${clockText(elapsed)}`, `Wrong flags: ${wrong}`, 'Look at Play again, or Restart below.'] });
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
    found.clear(); ruledOut.clear(); wrong = 0; elapsed = 0; sinceFind = 0; endTimer = 0;
    state = 'play';
    api.onStart?.();   // main.js stops the starter's gaze trial, so its pink ball cannot appear in the game
    captions.say(`Find ${TOTAL} differences. Look at a gold pad, then at things in the room.`, 5);
    refresh();
  }
  function finish() {
    state = 'end'; endTimer = 2.5;
    captions.say(`All ${TOTAL} found in ${clockText(elapsed)}. Back to the lobby...`, 3);
  }
  // The reset path: put the experience back to its first state (called by safe.js through main.js; also in the console: hcd.mine.reset()).
  function reset() {
    state = 'start'; found.clear(); ruledOut.clear(); wrong = 0; elapsed = 0; sinceFind = 0; endTimer = 0;
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
    root: world.root, reset, start, hint,
    get state() { return state; }, get room() { return room; }, get found() { return [...found]; }, get wrong() { return wrong; },
    onRoom: null,        // main.js sets this: it shows the starter's menu and speaker only in the lobby
    flagId: (id, r) => flag(world.rooms[r || 'B'].objects.get(id) || world.rooms.A.objects.get(id)),   // console / test helper
    // Game view on or off (the Cues button: the first view is the game, the others are the starter's scale-cue scene).
    setActive(on) { active = on; world.root.visible = on; refresh(); if (!on) hud.set(''); },
    update(dt, t) {
      camera.getWorldPosition(_a);
      const now = roomAt(_a.x, _a.z);
      if (now !== room) { room = now; refresh(); api.onRoom?.(room); }
      if (active && state === 'play' && !gaze.paused) {
        elapsed += dt; sinceFind += dt;
        if (sinceFind >= HINT_AFTER) { sinceFind = 0; hint(); }
      }
      if (endTimer > 0) { endTimer -= dt; if (endTimer <= 0) { pads.home(); } }
      if (active) {
        hud.set(state !== 'play' ? '' : `Found ${found.size}/${TOTAL}  ·  Wrong ${wrong}  ·  ${clockText(elapsed)}`);
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
