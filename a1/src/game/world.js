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

const wallMat = new THREE.MeshStandardMaterial({ color: 0xd9d4c7, roughness: 1 });
const floorMat = new THREE.MeshStandardMaterial({ color: 0x9b7b57, roughness: 0.9 });

export function buildWorld({ texScale = 1 } = {}) {
  setTextureScale(texScale);
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

    for (const s of SCENERY) { const t = buildProp({ ...s, y: 0 }); group.add(t); }

    const objects = new Map();
    for (const spec of buildRoom(name)) {
      const obj = buildProp(spec);
      group.add(obj);
      const [w, h, d] = spec.proxy.map((v) => Math.max(v, MIN_PROXY));
      const proxy = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ visible: false }));
      proxy.position.y = spec.cy;           // proxy is a child of the object: it follows resize, turn and move
      obj.add(proxy);
      const center = new THREE.Vector3(spec.x, (spec.y || 0) + spec.cy * (spec.scale || 1), spec.z);
      const radius = Math.max(w, h, d) * (spec.scale || 1) * 0.62;
      objects.set(spec.id, { id: spec.id, label: spec.label, room: name, spec, group: obj, proxy, center, radius });
    }
    rooms[name] = { name, group, objects };
  }
  return { root, rooms };
}
