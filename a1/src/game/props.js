import * as THREE from 'three';

// Every prop is built from boxes, cylinders and spheres in code, so there are no asset files to license (all assets are my own).
// Each builder returns a THREE.Group whose origin is on the floor (or on the wall) at the object's place.
// Textures are drawn on small canvases; texScale 0.5 halves them (a platform adaptation for phones, see adapt.js).
let texScale = 1;
export const setTextureScale = (s) => { texScale = s; };

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = Math.round(w * texScale); c.height = Math.round(h * texScale);
  const g = c.getContext('2d');
  g.scale(texScale, texScale);
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...extra });
const mesh = (geo, material, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z); m.castShadow = m.receiveShadow = true;
  return m;
};


const ARTS = {
  mountains: (g, w, h) => {
    g.fillStyle = '#8ec9f2'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffd54f'; g.beginPath(); g.arc(w * 0.78, h * 0.25, 22, 0, 7); g.fill();
    g.fillStyle = '#5d7a5d'; g.beginPath(); g.moveTo(0, h); g.lineTo(w * 0.3, h * 0.35); g.lineTo(w * 0.6, h); g.fill();
    g.fillStyle = '#44604a'; g.beginPath(); g.moveTo(w * 0.35, h); g.lineTo(w * 0.7, h * 0.5); g.lineTo(w, h); g.fill();
  },
  // the same picture with the sun on the other side: a fair, small difference
  mountains2: (g, w, h) => {
    g.fillStyle = '#8ec9f2'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffd54f'; g.beginPath(); g.arc(w * 0.22, h * 0.25, 22, 0, 7); g.fill();
    g.fillStyle = '#5d7a5d'; g.beginPath(); g.moveTo(0, h); g.lineTo(w * 0.3, h * 0.35); g.lineTo(w * 0.6, h); g.fill();
    g.fillStyle = '#44604a'; g.beginPath(); g.moveTo(w * 0.35, h); g.lineTo(w * 0.7, h * 0.5); g.lineTo(w, h); g.fill();
  },
};

const BUILD = {
  lamp(o) {
    const g = new THREE.Group();
    { const base = mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.04, 24), mat(0x3b3b3b), 0, 0.02, 0); base.receiveShadow = false; g.add(base); }   // thin: it would shadow itself and shimmer
    g.add(mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.2, 12), mat(0x3b3b3b), 0, 0.64, 0));
    const shade = mesh(new THREE.CylinderGeometry(0.2, 0.27, 0.34, 28, 1, true), mat(new THREE.Color(o.shade || '#f3e6c4').getHex(), { side: THREE.DoubleSide, emissive: 0x4a3a20 }), 0, 1.42, 0);
    g.add(shade);
    return g;
  },
  plant() {
    const g = new THREE.Group();
    g.add(mesh(new THREE.CylinderGeometry(0.2, 0.15, 0.3, 20), mat(0xb5651d), 0, 0.15, 0));
    const leaf = mat(0x3f9142);
    [[0, 0.5, 0, 0.26], [0.12, 0.7, 0.05, 0.2], [-0.1, 0.66, -0.06, 0.2], [0, 0.85, 0, 0.14]].forEach(([x, y, z, r]) => g.add(mesh(new THREE.SphereGeometry(r, 16, 12), leaf, x, y, z)));
    return g;
  },
  vase() {
    const g = new THREE.Group();
    const m = mat(0x1fa39a, { roughness: 0.35 });
    g.add(mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.34, 20), m, 0, 0.17, 0));
    g.add(mesh(new THREE.SphereGeometry(0.16, 20, 14), m, 0, 0.3, 0));
    g.add(mesh(new THREE.CylinderGeometry(0.06, 0.09, 0.22, 20), m, 0, 0.5, 0));
    return g;
  },
  chair() {
    const g = new THREE.Group();
    const wood = mat(0x8d6e4b), seat = mat(0x3949ab);
    g.add(mesh(new THREE.BoxGeometry(0.46, 0.06, 0.46), seat, 0, 0.45, 0));
    g.add(mesh(new THREE.BoxGeometry(0.46, 0.5, 0.05), wood, 0, 0.73, -0.205));   // the back rest is on the -z side
    [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]].forEach(([x, z]) => g.add(mesh(new THREE.BoxGeometry(0.05, 0.43, 0.05), wood, x, 0.215, z)));
    return g;
  },
  mug(o) {
    const g = new THREE.Group();
    const m = mat(o.color || '#b71c1c', { roughness: 0.4 });
    g.add(mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.1, 20), m, 0, 0.05, 0));
    g.add(mesh(new THREE.TorusGeometry(0.03, 0.009, 8, 14), m, 0.065, 0.05, 0));
    return g;
  },
  lantern(o) {
    const g = new THREE.Group();
    g.add(mesh(new THREE.BoxGeometry(0.16, 0.03, 0.16), mat(0x333333), 0, 0.015, 0));
    g.add(mesh(new THREE.BoxGeometry(0.12, 0.16, 0.12), mat(o.lit ? 0xffd27a : 0x6b6a60, { emissive: o.lit ? 0xffb74d : 0x000000, emissiveIntensity: o.lit ? 1.6 : 0 }), 0, 0.11, 0));
    g.add(mesh(new THREE.BoxGeometry(0.16, 0.03, 0.16), mat(0x333333), 0, 0.205, 0));
    return g;
  },
  picture(o) {
    const g = new THREE.Group();
    g.add(mesh(new THREE.BoxGeometry(0.8, 0.55, 0.04), mat(0x5b4636), 0, 0, 0));
    const art = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.45),
      new THREE.MeshBasicMaterial({ map: canvasTex(256, 164, ARTS[o.art || 'mountains']) }));
    art.position.z = 0.022; g.add(art);
    return g;
  },
  clock() {
    const g = new THREE.Group();
    const face = mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.04, 32), mat(0xf5f5f0), 0, 0, 0);
    face.rotation.x = Math.PI / 2; g.add(face);
    const hand = mat(0x111111);
    const h1 = mesh(new THREE.BoxGeometry(0.012, 0.11, 0.01), hand, 0, 0.05, 0.03);
    const h2 = mesh(new THREE.BoxGeometry(0.012, 0.075, 0.01), hand, 0.03, 0, 0.03); h2.rotation.z = -1.2;
    g.add(h1, h2);
    return g;
  },
  books() {
    const g = new THREE.Group();
    [[0xc62828, 0.34, 0.07, 0], [0x2e7d32, 0.3, 0.06, 0.07], [0x1565c0, 0.32, 0.07, 0.13]].forEach(([c, w, h, y], i) => {
      const b = mesh(new THREE.BoxGeometry(w, h, 0.24), mat(c), 0, y + h / 2, 0); b.rotation.y = (i - 1) * 0.12; g.add(b);
    });
    return g;
  },
  crate() {
    const g = new THREE.Group();
    g.add(mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), mat(0xa9824f), 0, 0.2, 0));
    g.add(mesh(new THREE.BoxGeometry(0.42, 0.04, 0.42), mat(0x7b5a33), 0, 0.2, 0));
    return g;
  },
  table() {
    const g = new THREE.Group();
    const wood = mat(0x7b5a33);
    g.add(mesh(new THREE.BoxGeometry(0.9, 0.05, 0.6), wood, 0, 0.725, 0));
    [[-0.4, -0.25], [0.4, -0.25], [-0.4, 0.25], [0.4, 0.25]].forEach(([x, z]) => g.add(mesh(new THREE.BoxGeometry(0.05, 0.7, 0.05), wood, x, 0.35, z)));
    return g;
  },
};

// One object from its spec (see rooms.js). scale and rotY change the whole group; the proxy (gaze target) is added by world.js.
export function buildProp(spec) {
  const g = BUILD[spec.kind](spec);
  g.position.set(spec.x, spec.y || 0, spec.z);
  g.rotation.y = spec.rotY || 0;
  g.scale.setScalar(spec.scale || 1);
  return g;
}
