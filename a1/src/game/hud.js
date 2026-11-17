import * as THREE from 'three';
import { settings } from '../settings.js';

// Two small text surfaces drawn on canvases (the same technique as captions.js):
//   Hud   : head-locked score line (found, wrong flags, time). A 3D mesh on the camera, so it shows in mono, in each eye of stereo and in a headset.
//   Board : a panel in the lobby with the rules at the start and the result at the end.

function wrap(g, text, maxWidth) {
  const lines = []; let line = '';
  for (const word of text.split(' ')) {
    const test = line ? `${line} ${word}` : word;
    if (g.measureText(test).width > maxWidth && line) { lines.push(line); line = word; } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

export class Hud {
  constructor(camera) {
    this.canvas = document.createElement('canvas'); this.canvas.width = 640; this.canvas.height = 96;
    this.ctx = this.canvas.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.canvas); this.tex.colorSpace = THREE.SRGBColorSpace;
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.108),
      new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, depthTest: false, depthWrite: false }));
    this.mesh.position.set(0, 0.3, -1.3);   // about 13 degrees above the middle of the view: readable, never in the way of the gaze ray
    this.mesh.renderOrder = 997; this.mesh.frustumCulled = false; this.mesh.visible = false;
    camera.add(this.mesh);
    this.drawn = null; this.drawnContrast = false;
  }
  set(text) {
    this.mesh.visible = !!text;
    if (text === this.drawn && settings.contrast === this.drawnContrast) return;
    this.drawn = text; this.drawnContrast = settings.contrast;
    const g = this.ctx;
    g.clearRect(0, 0, 640, 96);
    g.fillStyle = settings.contrast ? '#000000' : 'rgba(0,0,0,0.75)';
    g.beginPath(); g.roundRect(0, 0, 640, 96, 20); g.fill();
    g.fillStyle = settings.contrast ? '#ffeb3b' : '#ffffff'; g.font = 'bold 50px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, 320, 50, 610);
    this.tex.needsUpdate = true;
  }
}

export class Board {
  constructor() {
    this.canvas = document.createElement('canvas'); this.canvas.width = 1024; this.canvas.height = 640;
    this.ctx = this.canvas.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.canvas); this.tex.colorSpace = THREE.SRGBColorSpace; this.tex.anisotropy = 4;
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.0), new THREE.MeshBasicMaterial({ map: this.tex }));
    this.drawn = ''; this.drawnContrast = false;
  }
  // title: one big line; lines: body text (wrapped); the key is only used to skip redrawing the same content.
  show({ title, lines }) {
    const key = title + '|' + lines.join('|');
    if (key === this.drawn && settings.contrast === this.drawnContrast) return;
    this.drawn = key; this.drawnContrast = settings.contrast;
    const g = this.ctx, hi = settings.contrast;
    g.fillStyle = hi ? '#000000' : '#1b2a38'; g.fillRect(0, 0, 1024, 640);
    g.strokeStyle = hi ? '#ffffff' : '#ff9800'; g.lineWidth = 10; g.strokeRect(5, 5, 1014, 630);
    g.fillStyle = hi ? '#ffeb3b' : '#ffcc80'; g.font = 'bold 76px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'top';
    g.fillText(title, 512, 40, 960);
    g.fillStyle = '#ffffff'; g.font = '46px sans-serif'; g.textAlign = 'left';
    let y = 150;
    for (const text of lines) for (const l of wrap(g, text, 930)) { g.fillText(l, 48, y); y += 56; }
    this.tex.needsUpdate = true;
  }
}
