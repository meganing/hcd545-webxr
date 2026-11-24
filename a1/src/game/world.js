import * as THREE from 'three';
import { ROOM_W, ROOM_D, WALL_H, ROOM_CENTERS, MIN_PROXY, buildRoom, SCENERY } from './rooms.js';
import { buildProp, setTextureScale } from './props.js';

// Builds the two rooms. Each flaggable object gets an invisible box (the proxy) that is the gaze target:
// small objects get a bigger proxy so every target covers 3 degrees of view; Target size scales the proxy, not the room.

function signTexture(text) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#263238'; g.fillRect(0, 0, 512, 128);
  g.fillStyle = '#ffffff'; g.font = 'bold 84px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 256, 68);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// The note on a closed room (the empty-state rule: when something is empty on purpose, say why and what to do next).
function closedTexture(name) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 300;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(20,24,34,0.88)'; g.fillRect(0, 0, 1024, 300);
  g.strokeStyle = '#f2c879'; g.lineWidth = 8; g.strokeRect(6, 6, 1012, 288);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = '#f2c879'; g.font = 'bold 84px sans-serif'; g.fillText(`Room ${name}: closed`, 512, 95);
  g.fillStyle = '#ffffff'; g.font = '58px sans-serif'; g.fillText('Look at the gold pad to step in', 512, 200);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const FLOOR_TOP = 0.04;   // the floor box is 0.04 m thick and stands on y = 0
const wallMat = new THREE.MeshStandardMaterial({ color: 0x9db8a8, roughness: 1 });       // soft sage, like the cosy diorama references
const trimMat = new THREE.MeshStandardMaterial({ color: 0x5b3f2a, roughness: 0.8 });     // dark wood: skirting, window frame, shelf
const floorMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });    // colour comes from the plank texture
const rugMat = new THREE.MeshStandardMaterial({ color: 0x9c4a3a, roughness: 1 });
const leafMat = new THREE.MeshStandardMaterial({ color: 0x3f9142, roughness: 0.9 });
const glowMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });                        // window light and bulbs: unlit, so they glow

function plankTexture(scale) {
  const w = Math.round(512 * scale), h = Math.round(512 * scale);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); const n = 8, ph = h / n;
  for (let i = 0; i < n; i++) {
    const l = 42 + ((i * 37) % 11); g.fillStyle = `hsl(28, 38%, ${l}%)`; g.fillRect(0, i * ph, w, ph);
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, i * ph, w, Math.max(1, h / 170));            // the gap between planks
    const cut = ((i * 211) % 7 + 1) / 8 * w; g.fillRect(cut, i * ph, Math.max(1, w / 170), ph);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// Decoration only: the same in both rooms, never a gaze target, never a difference.
function decorate(group, plank) {
  const add = (geo, mat, x, y, z, ry = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = m.receiveShadow = true; group.add(m); return m; };
  const noShadow = (m) => { m.castShadow = false; return m; };   // small decoration: skipped in the shadow pass (about 100 fewer draws, and stereo draws twice)
  floorMat.map = plank; floorMat.needsUpdate = true;
  add(new THREE.BoxGeometry(2.0, 0.012, 0.6), rugMat, 0, 0.046, -0.8);                              // a runner at the back, clear of the teleport pad
  // skirting boards
  add(new THREE.BoxGeometry(ROOM_W, 0.12, 0.04), trimMat, 0, 0.06, -ROOM_D / 2 + 0.02);
  add(new THREE.BoxGeometry(0.04, 0.12, ROOM_D), trimMat, -ROOM_W / 2 + 0.02, 0.06, 0);
  add(new THREE.BoxGeometry(0.04, 0.12, ROOM_D), trimMat, ROOM_W / 2 - 0.02, 0.06, 0);
  // a window on the left wall: glowing panes in a dark frame
  const wx = -ROOM_W / 2 + 0.02;
  add(new THREE.BoxGeometry(0.03, 0.95, 0.75), glowMat, wx, 1.45, 0.3);
  for (const [h, w, y, z] of [[0.06, 0.85, 1.95, 0.3], [0.06, 0.85, 0.95, 0.3], [0.95, 0.06, 1.45, -0.1], [0.95, 0.06, 1.45, 0.7], [0.95, 0.05, 1.45, 0.3]]) add(new THREE.BoxGeometry(0.06, h, w), trimMat, wx + 0.01, y, z);
  add(new THREE.BoxGeometry(0.05, 0.05, 0.85), trimMat, wx + 0.01, 1.45, 0.3);
  // two wall shelves on the back wall with books and a small plant
  const bz = -ROOM_D / 2 + 0.12;
  add(new THREE.BoxGeometry(0.8, 0.04, 0.22), trimMat, 1.15, 1.75, bz);
  add(new THREE.BoxGeometry(0.8, 0.04, 0.22), trimMat, 1.15, 2.1, bz);
  [[0xb23a48, 0.9], [0x2f6f9f, 0.97], [0xd9a441, 1.03], [0x3f9142, 1.1]].forEach(([c, x], i) => add(new THREE.BoxGeometry(0.05, 0.2 - i * 0.015, 0.14), new THREE.MeshStandardMaterial({ color: c }), x + 0.02, 1.87 - i * 0.008, bz));
  add(new THREE.CylinderGeometry(0.07, 0.055, 0.1, 12), new THREE.MeshStandardMaterial({ color: 0xb5651d }), 1.35, 2.17, bz);
  add(new THREE.SphereGeometry(0.1, 12, 10), leafMat, 1.35, 2.3, bz);
  // vines hanging from the top of the side walls, and a string of lights along the back wall
  // vines: strands of small flat leaves that hang down the side walls from the top edge (leaves lie against the wall, not floating)
  const strands = [[-1.2, 5], [-0.55, 3], [0.3, 6], [1.0, 4], [1.45, 3]];
  for (const side of [-1, 1]) strands.forEach(([z, n], si) => {
    for (let k = 0; k < n; k++) {
      const m = add(new THREE.SphereGeometry(0.075, 8, 6), leafMat, side * (ROOM_W / 2 - 0.045), WALL_H - 0.08 - k * 0.14, z + ((k + si) % 2 ? 0.03 : -0.03));
      m.scale.set(0.3, 1.3, 1);   // flattened against the wall
      noShadow(m);
    }
  });
  for (let i = 0; i < 9; i++) noShadow(add(new THREE.SphereGeometry(0.035, 8, 6), glowMat, -1.8 + i * 0.45, WALL_H - 0.12 - (i % 2) * 0.06, -ROOM_D / 2 + 0.06));
  // one warm light per room (no shadows: cheap on phones), so the room feels lit from a lamp and the window
  const warm = new THREE.PointLight(0xffc27a, 7, 6.5, 2); warm.position.set(0, 2.1, 0.2); group.parent.add(warm);   // on the room, not in `contents`: hiding a room's things must not change the light count (that would recompile shaders)
  // corner plants (front corners, away from the objects)
  for (const x of [-1.8, 1.8]) { add(new THREE.CylinderGeometry(0.13, 0.1, 0.2, 14), new THREE.MeshStandardMaterial({ color: 0xb5651d }), x, 0.14, 1.6); add(new THREE.SphereGeometry(0.2, 14, 10), leafMat, x, 0.42, 1.6); }
}

export function buildWorld({ texScale = 1 } = {}) {
  setTextureScale(texScale);
  const plank = plankTexture(texScale);
  const root = new THREE.Group();
  const rooms = {};   // rooms.A.objects: Map id -> { id, label, room, spec, group, proxy, center, radius }

  for (const name of ['A', 'B']) {
    const c = ROOM_CENTERS[name];
    const group = new THREE.Group();
    group.position.set(c.x, 0, c.z);
    root.add(group);

    const floor = new THREE.Mesh(new THREE.BoxGeometry(ROOM_W, 0.04, ROOM_D), floorMat);
    floor.position.y = 0.02; floor.receiveShadow = true; group.add(floor);
    const wall = (w, h, d, x, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
      m.position.set(x, h / 2, z); m.castShadow = m.receiveShadow = true; group.add(m);
    };
    wall(ROOM_W, WALL_H, 0.1, 0, -ROOM_D / 2 - 0.05);          // back
    wall(0.1, WALL_H, ROOM_D, -ROOM_W / 2 - 0.05, 0);          // left
    wall(0.1, WALL_H, ROOM_D, ROOM_W / 2 + 0.05, 0);           // right
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.35), new THREE.MeshBasicMaterial({ map: signTexture(`ROOM ${name}`) }));
    sign.position.set(0, WALL_H + 0.3, ROOM_D / 2); group.add(sign);   // above the open front, readable from the lobby
    const closed = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.7), new THREE.MeshBasicMaterial({ map: closedTexture(name), transparent: true }));
    closed.position.set(0, 1.0, -0.6); closed.visible = false; group.add(closed);   // shown while the room is closed (my-interaction.js refresh)
    const contents = new THREE.Group(); group.add(contents);   // everything you can look at: hidden in the rooms you are not standing in (my-interaction.js)
    decorate(contents, plank);

    for (const s of SCENERY) { const t = buildProp({ ...s, y: 0 }); contents.add(t); }

    const objects = new Map();
    for (const spec of buildRoom(name)) {
      const obj = buildProp(spec);
      if (!spec.y) obj.position.y = FLOOR_TOP;   // stand on the floor boards, not 4 cm inside them (the lamp base was level with the floor and flickered)
      contents.add(obj);
      const [w, h, d] = spec.proxy.map((v) => Math.max(v, MIN_PROXY));
      const proxy = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ visible: false }));
      proxy.position.y = spec.cy;           // proxy is a child of the object: it follows resize, turn and move
      obj.add(proxy);
      const center = new THREE.Vector3(spec.x, (spec.y || FLOOR_TOP) + spec.cy * (spec.scale || 1), spec.z);
      const radius = Math.max(w, h, d) * (spec.scale || 1) * 0.62;
      objects.set(spec.id, { id: spec.id, label: spec.label, room: name, spec, group: obj, proxy, center, radius });
    }
    rooms[name] = { name, group, contents, closed, objects };
  }
  return { root, rooms };
}
