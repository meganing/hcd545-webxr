// The game's data: where the two rooms are, what stands in them, and which differences are real.
// No three.js in this file, so the design rules can be checked in Node (see a1-docs/check-design.mjs).
// 1 unit = 1 metre. Room-local coordinates: x to the right, z toward the lobby (the open front), origin at the middle of the floor.

export const EYE = 1.6;                 // standing eye height (look.js and main.js use the same value)
export const ROOM_W = 4.0;              // x size
export const ROOM_D = 3.6;              // z size
export const WALL_H = 2.5;
export const ROOM_CENTERS = { A: { x: -2.6, z: -6.4 }, B: { x: 2.6, z: -6.4 } };   // the lobby is the origin: (0, 0)
export const PAD_RADIUS = 0.7;

// Room A is the original. Room B is room A with the DIFFS below applied (buildRoom).
// proxy = the invisible gaze target: size [w, h, d] in metres and centre height cy above the object's base.
// A proxy is never smaller than MIN_PROXY, because a target must cover at least 3 degrees from 4.5 m (0.24 m; 0.32 m leaves room for Target size 0.8).
export const MIN_PROXY = 0.32;
export const OBJECTS = [
  { id: 'lamp',    label: 'Lamp',    kind: 'lamp',    x: 1.6,   z: -1.4,  y: 0,    shade: '#f3e6c4', proxy: [0.5, 1.55, 0.5], cy: 0.78 },
  { id: 'plant',   label: 'Plant',   kind: 'plant',   x: -1.6,  z: -1.4,  y: 0,    scale: 1, proxy: [0.6, 0.85, 0.6], cy: 0.43 },
  { id: 'vase',    label: 'Vase',    kind: 'vase',    x: -1.55, z: 1.1,   y: 0,    proxy: [0.34, 0.6, 0.34], cy: 0.3 },
  { id: 'chair',   label: 'Chair',   kind: 'chair',   x: 1.5,   z: 1.1,   y: 0,    rotY: 0.25, proxy: [0.55, 0.95, 0.55], cy: 0.47 },
  { id: 'mug',     label: 'Mug',     kind: 'mug',     x: 0.3,   z: -1.35, y: 0.75, color: '#c62828', proxy: [0.32, 0.32, 0.32], cy: 0.08 },
  { id: 'lantern', label: 'Lantern', kind: 'lantern', x: -0.3,  z: -1.35, y: 0.75, lit: false, proxy: [0.32, 0.34, 0.32], cy: 0.1 },
  { id: 'picture', label: 'Picture', kind: 'picture', x: 0.0,   z: -1.76, y: 1.5,  art: 'mountains', proxy: [0.85, 0.6, 0.14], cy: 0 },
  { id: 'clock',   label: 'Clock',   kind: 'clock',   x: -1.2,  z: -1.76, y: 1.85, proxy: [0.36, 0.36, 0.14], cy: 0 },
  { id: 'books',   label: 'Books',   kind: 'books',   x: 0.95,  z: 1.5,   y: 0,    proxy: [0.4, 0.25, 0.34], cy: 0.12 },
  { id: 'crate',   label: 'Crate',   kind: 'crate',   x: 1.75,  z: 0.35,  y: 0,    proxy: [0.42, 0.4, 0.42], cy: 0.2 },
];

// Furniture that is only scenery (not a gaze target).
export const SCENERY = [{ kind: 'table', x: 0, z: -1.35 }];

// The answer key. counts: true = a real difference; false = a decoy that looks different but is the same thing.
//   recolor / replace / resize : the same object, changed (set: the properties that change in room B)
//   missing                               : the object is not in room B (flag it in room A)
//   added                                 : the object exists only in room B (add: a full object entry)
//   rotate / move / light                 : decoys (turned, moved, lit differently)
// To change the game, edit this list: nothing else needs to change.
export const DIFFS = [
  { id: 'mug',     type: 'recolor', counts: true,  set: { color: '#ef6c00' }, say: 'The mug is a different colour (red or orange)' },
  { id: 'plant',   type: 'resize',  counts: true,  set: { scale: 1.45 },      say: 'The plant is bigger in room B' },
  { id: 'picture', type: 'replace', counts: true,  set: { art: 'mountains2' }, say: 'The sun in the picture is on the other side' },
  { id: 'clock',   type: 'missing', counts: true,  remove: true,              say: 'The clock is missing in room B' },
  { id: 'lamp',    type: 'recolor', counts: true,  set: { shade: '#ecd0c4' },  say: 'The lamp shade is a shade pinker in room B' },
  { id: 'chair',   type: 'rotate',  counts: false, set: { rotY: 0.95 },       say: 'Same chair, just turned' },
  { id: 'vase',    type: 'move',    counts: false, set: { x: -1.75, z: 0.45 }, say: 'Same vase, just moved' },
  { id: 'lantern', type: 'light',   counts: false, set: { lit: true },        say: 'Same lantern, lit differently' },
];
export const REAL = DIFFS.filter((d) => d.counts);
export const TOTAL = REAL.length;

// Room contents after the changes. Plain copies, so editing room B never changes room A.
export function buildRoom(room) {
  const list = OBJECTS.map((o) => ({ ...o, proxy: [...o.proxy] }));
  if (room === 'A') return list;
  const out = [];
  for (const o of list) {
    const d = DIFFS.find((x) => x.id === o.id);
    if (d?.remove) continue;
    if (d?.set) Object.assign(o, d.set);
    out.push(o);
  }
  for (const d of DIFFS) if (d.add) out.push({ ...d.add });
  return out;
}

// Teleport pads, in order. The last one is Home (the lobby): menu.js treats the last spot as Home.
const local = (room, x, z) => [ROOM_CENTERS[room].x + x, ROOM_CENTERS[room].z + z];
export const PAD_SPOTS = [local('A', 0, 0.35), local('B', 0, 0.35), [0, 0]];   // one pad per room, and Home
export const PAD_NAMES = ['Room A', 'Room B', 'Lobby'];
export const PAD_ROOM = ['A', 'B', 'lobby'];
// Which pads you can see (and teleport to) from each pad. The two rooms are 5.2 m apart: a pad that far away is still bigger than 3 degrees (check-design.mjs).
export const PAD_LINKS = [
  [1, 2], [0, 2],
  [0, 1],
];

// Which room is a point in? (The head position: it also works when a headset user physically walks.)
export function roomAt(x, z) {
  for (const k of ['A', 'B']) {
    const c = ROOM_CENTERS[k];
    if (Math.abs(x - c.x) <= ROOM_W / 2 && z >= c.z - ROOM_D / 2 && z <= c.z + ROOM_D / 2 + 0.3) return k;
  }
  return 'lobby';
}

export const worldXZ = (room, x, z) => [ROOM_CENTERS[room].x + x, ROOM_CENTERS[room].z + z];

export const clockText = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
