// Game logic smoke test in Node (no GPU): builds the world with a stub canvas and plays the game through the same functions gaze uses.
//   node a1-docs/smoke-test.mjs
import * as THREE from '../a1/node_modules/three/build/three.module.js';
const noop = new Proxy(function () {}, { get: (_, k) => (k === 'measureText' ? () => ({ width: 10 }) : noop), apply: () => noop, set: () => true });
globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => noop, style: {} }) };
globalThis.window = { matchMedia: () => ({ matches: false }), devicePixelRatio: 1, location: { search: '' } };
globalThis.localStorage = { getItem: () => null, setItem() {} };
const { addMyTargets } = await import('../a1/src/my-interaction.js');
const R = await import('../a1/src/game/rooms.js');
const { GazeSystem } = await import('../a1/src/gaze.js');
const { settings } = await import('../a1/src/settings.js');

let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, 1.6, 0.05, 200); const rig = new THREE.Group(); rig.add(camera); scene.add(rig); camera.position.set(0, 1.6, 0);
const said = []; const captions = { say: (t) => said.push(t) };
let pings = 0; const hints = []; const audio = { ping: () => pings++, hintAt: (o) => { hints.push(o); return '[hint ping, ahead, 3 m]'; } };
const gaze = new GazeSystem({ renderer: {}, camera });
let homed = 0; const pads = { home: () => { homed++; camera.position.set(0, 1.6, 0); rig.position.set(0, 0, 0); } };
const game = addMyTargets({ scene, camera, gaze, captions, audio, pads });
const go = (x, z) => { camera.position.set(0, 1.6, 0); rig.position.set(x, 0, z); game.update(0.016, 0); };
const labels = () => gaze.targets.map((t) => t.userData.target.label);

ok(game.state === 'start', 'starts in the start state');
ok(labels().join() === 'Begin', `lobby at start: only Begin is a target (${labels()})`);
go(R.ROOM_CENTERS.B.x, R.ROOM_CENTERS.B.z + 1);
ok(gaze.targets.length === 0, 'no object targets before Begin');
go(0, 0); gaze.targets[0].userData.target.onActivate();
ok(game.state === 'play', 'Begin starts the game');
ok(gaze.targets.length === 0, 'lobby while playing: no targets at all (view-only)');
go(R.ROOM_CENTERS.B.x, R.ROOM_CENTERS.B.z + 1);
ok(game.room === 'B' && gaze.targets.length === 9, `in room B: 9 objects are targets (${gaze.targets.length}; the clock is missing there)`);
ok(!labels().includes('Clock'), 'room B has no clock target');
// gaze-pick: aim the camera at the mug from the front pad of room B
const aimAt = (id) => { const e = gaze.targets.find((t) => t.userData.target.label.toLowerCase() === id); const p = new THREE.Vector3(); e.getWorldPosition(p); camera.lookAt(p); camera.updateMatrixWorld(true); gaze.pickFromCamera(); return gaze.pickFromCamera()?.root.userData.target.label; };
camera.position.set(R.ROOM_CENTERS.B.x, 1.6, R.ROOM_CENTERS.B.z + 1);   // standing in the middle of the room, as a head would
camera.getWorldPosition(new THREE.Vector3());
rig.position.set(0, 0, 0); camera.position.set(R.ROOM_CENTERS.B.x, 1.6, R.ROOM_CENTERS.B.z + 1); game.update(0.016, 0);
ok(aimAt('mug') === 'Mug', 'looking at the mug picks the Mug target (the ray hits the invisible proxy)');
game.flagId('chair'); ok(game.wrong === 1 && said.at(-1).includes('turned'), `decoy: ${said.at(-1)}`);
ok(!labels().includes('Chair'), 'a settled decoy is no longer a target');
game.flagId('books'); ok(game.wrong === 2 && said.at(-1).includes('same in both'), `identical object: ${said.at(-1)}`);
for (const id of ['mug', 'plant', 'picture', 'lamp']) game.flagId(id, 'B');
ok(game.found.length === 4 && game.state === 'play', `4 found, still playing (${game.found})`);
// hint
for (let i = 0; i < 26; i++) game.update(1, 0);
ok(said.at(-1).startsWith('Hint') && hints.length === 0 || hints.length === 1, `hint after 25 s: "${said.at(-1)}"`);
ok(R.REAL.length === 5 && !game.found.includes('clock'), 'the last one is the clock (missing in room B)');
go(R.ROOM_CENTERS.A.x, R.ROOM_CENTERS.A.z + 1);
ok(labels().includes('Clock'), 'room A has the clock target');
game.flagId('clock', 'A'); ok(game.state === 'end', 'all 5 found: end state');
for (let i = 0; i < 4; i++) game.update(1, 0);
ok(homed === 1, 'after 2.5 s the visitor is sent Home');
go(0, 0); ok(labels().join() === 'Play again', `lobby at the end shows Play again (${labels()})`);
game.reset(); ok(game.state === 'start' && game.found.length === 0 && game.wrong === 0, 'reset puts the task back to the start');
ok(labels().join() === 'Begin', 'Begin is back after reset');
settings.targetScale = 1.6; game.setActive(false); ok(gaze.targets.length === 0, 'game view off: no game targets');
console.log(fails ? `\n${fails} FAILED` : '\nSMOKE TEST PASSED'); process.exit(fails ? 1 : 0);
