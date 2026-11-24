import * as THREE from 'three';
import { settings } from './settings.js';
import { wrap } from './game/hud.js';

// Head-locked caption strip for sound (W3C XR Accessibility User Requirements, XAUR: captions and descriptions of non-speech audio).
// Drawn as a 3D mesh on the camera, so it shows in mono, in each eye of stereo, and inside immersive-vr.
export class Captions {
  constructor(camera) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 1024; this.canvas.height = 208;   // room for two lines
    this.ctx = this.canvas.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1.0, 0.203),
      new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, depthTest: false, depthWrite: false }));
    this.mesh.position.set(0, -0.4, -1.3);
    this.mesh.renderOrder = 998;
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    camera.add(this.mesh);
    this.ambient = ''; this.timed = ''; this.timer = 0; this.drawn = null; this.drawnContrast = false;
  }

  setAmbient(text) { this.ambient = text; }
  say(text, seconds = 2.5) { this.timed = text; this.timer = seconds; }

  update(dt) {
    if (this.timer > 0) { this.timer -= dt; if (this.timer <= 0) this.timed = ''; }
    const text = settings.captions ? (this.timed || this.ambient) : '';
    if (text !== this.drawn || settings.contrast !== this.drawnContrast) {
      this.drawn = text; this.drawnContrast = settings.contrast;
      const g = this.ctx;
      g.clearRect(0, 0, 1024, 208);
      if (text) {
        g.fillStyle = settings.contrast ? '#000000' : 'rgba(0,0,0,0.8)';   // contrast mode: opaque black, yellow text
        g.font = 'bold 52px sans-serif';
        const lines = wrap(g, text, 960).slice(0, 2);       // A1: long captions wrap to a second line instead of being squeezed
        const h = lines.length > 1 ? 208 : 128, y0 = (208 - h) / 2;
        g.beginPath(); g.roundRect(0, y0, 1024, h, 24); g.fill();
        g.fillStyle = settings.contrast ? '#ffeb3b' : '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle';
        lines.forEach((l, i) => g.fillText(l, 512, 106 + (i - (lines.length - 1) / 2) * 68, 980));
      }
      this.tex.needsUpdate = true;
    }
    this.mesh.visible = !!text;
  }
}
