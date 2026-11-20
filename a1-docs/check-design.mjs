// Design check for the A1 game, run in Node (no browser): node a1-docs/check-design.mjs
// It builds the proxies and pads as plain three.js meshes from src/game/rooms.js and measures them with src/measure.js,
// the same function the browser console uses (hcd.angularSizes()).
import * as THREE from '../a1/node_modules/three/build/three.module.js';
import { angularSize } from '../a1/src/measure.js';
import * as R from '../a1/src/game/rooms.js';

let fails = 0;
const ok = (cond, msg) => { if (!cond) { fails++; console.log('FAIL', msg); } };
const cam = new THREE.PerspectiveCamera();
const standCam = (x, z) => { cam.position.set(x, R.EYE, z); cam.updateMatrixWorld(true); return cam; };

// proxies in world space, per room
const world = { A: [], B: [] };
for (const room of ['A', 'B']) {
  for (const spec of R.buildRoom(room)) {
    const [w, h, d] = spec.proxy.map((v) => Math.max(v, R.MIN_PROXY));
    const g = new THREE.Group();
    g.position.set(R.ROOM_CENTERS[room].x + spec.x, spec.y || 0, R.ROOM_CENTERS[room].z + spec.z);
    g.rotation.y = spec.rotY || 0; g.scale.setScalar(spec.scale || 1);
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d)); m.position.y = spec.cy; g.add(m);
    g.updateMatrixWorld(true);
    world[room].push({ spec, g, m });
  }
}
const padMesh = (i, scale = 1) => {
  const [x, z] = R.PAD_SPOTS[i];
  const m = new THREE.Mesh(new THREE.CylinderGeometry(R.PAD_RADIUS * scale, R.PAD_RADIUS * scale, 0.06, 24));
  m.position.set(x, 0.03, z); m.updateMatrixWorld(true); return m;
};

console.log('--- 1. rules for the differences');
ok(R.TOTAL === 5, `expected 5 real differences, have ${R.TOTAL}`);
ok(R.DIFFS.filter((d) => !d.counts).length >= 2, 'need at least 2 decoys');
for (const d of R.DIFFS.filter((x) => x.type === 'resize')) {
  const f = d.set.scale; ok(f >= 1.35 || f <= 0.74, `${d.id}: a resize of ${f} is too small to count (need at least 35 %)`);
}
const ids = R.OBJECTS.map((o) => o.id); ok(new Set(ids).size === ids.length, 'object ids must be unique');
for (const d of R.DIFFS) ok(ids.includes(d.id), `${d.id}: unknown object`);
console.log(`real: ${R.REAL.map((d) => d.id + '(' + d.type + ')').join(', ')}`);
console.log(`decoys: ${R.DIFFS.filter((d) => !d.counts).map((d) => d.id + '(' + d.type + ')').join(', ')}`);

console.log('--- 2. every target covers 3 degrees from each pad of its own room (Target size 1.0; 0.8 is the smallest setting)');
let worst = 99;
for (const room of ['A', 'B']) {
  for (let i = 0; i < R.PAD_SPOTS.length; i++) {
    if (R.PAD_ROOM[i] !== room) continue;
    const [sx, sz] = R.PAD_SPOTS[i];
    for (const o of world[room]) {
      const a = angularSize(o.g, standCam(sx, sz));
      const a8 = (() => { const s = o.g.scale.x; o.m.scale.setScalar(0.8); o.g.updateMatrixWorld(true); const r = angularSize(o.g, standCam(sx, sz)); o.m.scale.setScalar(1); o.g.updateMatrixWorld(true); return r; })();
      worst = Math.min(worst, a.min);
      ok(a.min >= 3, `${room}.${o.spec.id} from ${R.PAD_NAMES[i]}: ${a.min} deg at ${a.distance} m`);
      if (a8.min < 3) console.log(`  note: ${room}.${o.spec.id} from ${R.PAD_NAMES[i]}: ${a8.min} deg at Target size 0.8 (${a.distance} m)`);
    }
  }
}
console.log('smallest object target at size 1.0:', worst, 'deg');

console.log('--- 3. every real difference can be seen and flagged from at least one pad');
for (const d of R.REAL) {
  const room = d.type === 'missing' ? 'A' : 'B';   // the room where the object exists (missing: room A)
  const o = world[room].find((x) => x.spec.id === d.id);
  let seenFrom = [];
  for (let i = 0; i < R.PAD_SPOTS.length; i++) {
    if (R.PAD_ROOM[i] !== room) continue;
    const [sx, sz] = R.PAD_SPOTS[i];
    const a = angularSize(o.g, standCam(sx, sz));
    let facing = true;
    if (d.viewFrom) { const dx = sx - o.g.position.x, dz = sz - o.g.position.z, len = Math.hypot(dx, dz); facing = (dx * d.viewFrom[0] + dz * d.viewFrom[1]) / len >= 0.7; }
    if (a.min >= 3 && a.distance <= 4.6 && facing) seenFrom.push(R.PAD_NAMES[i]);
  }
  ok(seenFrom.length > 0, `${d.id}: no pad sees it`);
  console.log(`${d.id.padEnd(8)} ${d.type.padEnd(8)} seen from: ${seenFrom.join(' | ')}`);
}

console.log('--- 4. pads that can be seen from each pad cover 3 degrees');
for (let i = 0; i < R.PAD_SPOTS.length; i++) {
  const [sx, sz] = R.PAD_SPOTS[i];
  for (const j of R.PAD_LINKS[i]) {
    const a = angularSize(padMesh(j), standCam(sx, sz));
    ok(a.min >= 3, `pad ${R.PAD_NAMES[j]} seen from ${R.PAD_NAMES[i]}: ${a.min} deg at ${a.distance} m`);
    if (a.min < 3.5) console.log(`  close: ${R.PAD_NAMES[i]} -> ${R.PAD_NAMES[j]} ${a.min} deg`);
  }
}
// (links need not be two-way: the front pads link to Home, the back pads do not, and Home only offers the two room entrances)
// reachability from Home
const HOME = R.PAD_SPOTS.length - 1; const seen = new Set([HOME]); const q = [HOME]; while (q.length) for (const j of R.PAD_LINKS[q.shift()]) if (!seen.has(j)) { seen.add(j); q.push(j); }
ok(seen.size === R.PAD_SPOTS.length, 'some pad cannot be reached from Home');

console.log('--- 5. lobby targets (Begin, Play again, menu buttons) from Home');
const box = (w, h, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.04)); m.position.set(x, y, z); m.updateMatrixWorld(true); return m; };
const lobby = standCam(0, 0);
const begin = angularSize(box(0.9, 0.36, 0, 1.0, -2.2), lobby); ok(begin.min >= 3, 'Begin button'); console.log('Begin button', begin.width, 'x', begin.height, 'deg');
// the menu: 3 columns x 6 rows of 0.56 x 0.3 buttons, centred on (3.4, 1.5, 1.2), turned toward the viewer
const menuC = new THREE.Vector3(3.4, 1.5, 1.2); let menuMin = 99;
for (let c = 0; c < 3; c++) for (let r = 0; r < 6; r++) {
  const b = box(0.56, 0.3, 0, 0, 0); b.position.set((c - 1) * 0.62, -(r - 2.5) * 0.36, 0);
  const grp = new THREE.Group(); grp.position.copy(menuC); grp.rotation.y = Math.atan2(0 - menuC.x, 0 - menuC.z); grp.add(b); grp.updateMatrixWorld(true);
  menuMin = Math.min(menuMin, angularSize(b, lobby).min);
}
ok(menuMin >= 3, 'menu buttons'); console.log('smallest menu button from the lobby:', menuMin, 'deg at', menuC.length().toFixed(1), 'm');

console.log('--- 6. nothing overlaps (object centres 0.45 m apart; objects outside the pad discs)');
for (const room of ['A', 'B']) {
  const list = R.buildRoom(room).filter((o) => !o.y || o.y < 0.1);   // floor objects only for the pad test
  for (let i = 0; i < R.PAD_SPOTS.length; i++) {
    if (R.PAD_ROOM[i] !== room) continue;
    const [px, pz] = [R.PAD_SPOTS[i][0] - R.ROOM_CENTERS[room].x, R.PAD_SPOTS[i][1] - R.ROOM_CENTERS[room].z];
    for (const o of list) ok(Math.hypot(o.x - px, o.z - pz) >= R.PAD_RADIUS + 0.2, `${room}.${o.id} stands on pad ${R.PAD_NAMES[i]}`);
  }
  const all = R.buildRoom(room);
  for (let a = 0; a < all.length; a++) for (let b = a + 1; b < all.length; b++) {
    const A = all[a], B = all[b];
    if (Math.abs((A.y || 0) - (B.y || 0)) > 0.5 && Math.hypot(A.x - B.x, A.z - B.z) < 0.2) continue;   // one above the other (picture over the table)
    if ((A.y || 0) > 1 && (B.y || 0) > 1) { ok(Math.hypot(A.x - B.x, A.y - B.y) >= 0.45, `${room}: ${A.id} and ${B.id} are too close on the wall`); continue; }
    if (Math.abs((A.y || 0) - (B.y || 0)) > 0.5) continue;
    ok(Math.hypot(A.x - B.x, A.z - B.z) >= 0.45, `${room}: ${A.id} and ${B.id} are too close (${Math.hypot(A.x - B.x, A.z - B.z).toFixed(2)} m)`);
  }
}
console.log(fails ? `\n${fails} problem(s)` : '\nALL CHECKS PASSED');
process.exit(fails ? 1 : 0);
