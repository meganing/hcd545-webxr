import * as THREE from 'three';
import { settings } from './settings.js';

// Spatial audio with no audio files: the hum and the ping are generated in code as AudioBuffers.
// AudioListener on the camera + PositionalAudio on a mesh = Web Audio PannerNode (HRTF: direction cues for headphones) driven by the scene graph.

function makeHum(ctx) {
  const sr = ctx.sampleRate, len = Math.floor(sr * 1.6);
  const buf = ctx.createBuffer(1, len, sr), d = buf.getChannelData(0);
  const T = len / sr;
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    // pulse at 1.25 Hz; the 220 Hz and 330 Hz tones complete whole cycles over the loop, so there is no click where it repeats
    const env = 0.5 - 0.5 * Math.cos(2 * Math.PI * (2 / T) * t);
    d[i] = 0.4 * env * (Math.sin(2 * Math.PI * 220 * t) + 0.5 * Math.sin(2 * Math.PI * 330 * t)) / 1.5;
  }
  return buf;
}

function makePing(ctx, freq = 880) {
  const sr = ctx.sampleRate, len = Math.floor(sr * 0.35);
  const buf = ctx.createBuffer(1, len, sr), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) { const t = i / sr; d[i] = 0.5 * Math.exp(-t * 12) * Math.sin(2 * Math.PI * freq * t); }
  return buf;
}

// A1 game sounds, made in code like the ping: a short run of notes. wave: 'sine' | 'square' (the buzz).
function makeSeq(ctx, notes, { wave = 'sine', gap = 0.11, decay = 9, vol = 0.45 } = {}) {
  const sr = ctx.sampleRate, noteLen = 0.3, len = Math.floor(sr * (gap * (notes.length - 1) + noteLen));
  const buf = ctx.createBuffer(1, len, sr), d = buf.getChannelData(0);
  notes.forEach((f, n) => {
    const start = Math.floor(sr * gap * n);
    for (let i = 0; start + i < len && i < sr * noteLen; i++) {
      const t = i / sr, ph = 2 * Math.PI * f * t;
      d[start + i] += vol * Math.exp(-t * decay) * (wave === 'square' ? Math.sign(Math.sin(ph)) * 0.5 : Math.sin(ph));
    }
  });
  return buf;
}
const SFX = {
  found: () => ['sine', [660, 990], {}],                          // a rising two-note chime: correct
  wrong: () => ['square', [150, 120], { gap: 0.09, decay: 7, vol: 0.5 }],   // a low double buzz: wrong
  win:   () => ['sine', [523, 659, 784, 1047], { gap: 0.13, decay: 5 }],    // a rising arpeggio: all found
  lose:  () => ['sine', [440, 349, 262], { gap: 0.16, decay: 6 }],          // a falling run: time is up
};

const BEARINGS = [
  [30, 'ahead'], [75, 'ahead and to the %'], [120, 'to the %'], [165, 'behind and to the %'], [181, 'behind you'],
];

export class SpatialAudio {
  constructor(camera, captions) {
    this.camera = camera; this.captions = captions;
    this.listener = new THREE.AudioListener();
    camera.add(this.listener);
    this.ctx = this.listener.context;
    this.source = null; this.mesh = null; this.pingSound = null;
    this._v = new THREE.Vector3(); this._lastCaption = ''; this._acc = 0;
    this.started = false;
  }

  attach(mesh) {
    const a = new THREE.PositionalAudio(this.listener);
    a.setBuffer(makeHum(this.ctx));
    a.setLoop(true);
    a.setRefDistance(1.5);
    a.setRolloffFactor(1.2);
    a.setDistanceModel('inverse');
    a.panner.panningModel = 'HRTF';
    mesh.add(a);
    this.source = a; this.mesh = mesh;
    this.pingSound = new THREE.Audio(this.listener);
    this.pingSound.setBuffer(makePing(this.ctx));
    this.sfxSounds = {};
    for (const [name, make] of Object.entries(SFX)) {
      const [wave, notes, opt] = make();
      const s = new THREE.Audio(this.listener); s.setBuffer(makeSeq(this.ctx, notes, { wave, ...opt })); this.sfxSounds[name] = s;
    }
  }

  // Call from a click/tap handler: browsers keep the AudioContext suspended until a user gesture.
  start() {
    this.ctx.resume();
    this.started = true;
    this.sync();
  }

  resume() { this.ctx.resume(); }

  // Apply on/off + volume from settings.
  sync() {
    this.listener.setMasterVolume(settings.volume);
    if (!this.source || !this.started) return;
    if (settings.audio && !this.source.isPlaying) this.source.play();
    if (!settings.audio && this.source.isPlaying) this.source.pause();
  }

  ping() {
    if (!this.pingSound || !settings.audio || !this.started) return;
    if (this.pingSound.isPlaying) this.pingSound.stop();
    this.pingSound.play();
  }

  // A1: a game sound ('found' | 'wrong' | 'win' | 'lose'); rate raises the pitch (the combo). Needs Sound on, like ping(); every one has a caption.
  sfx(name, rate = 1) {
    const s = this.sfxSounds?.[name];
    if (!s || !settings.audio || !this.started) return;
    if (s.isPlaying) s.stop();
    s.setPlaybackRate(rate); s.play();
  }

  // Describe where the source is, relative to where the user faces: the caption for people who cannot hear direction.
  describe(mesh = this.mesh, name = 'humming') {
    if (!mesh) return '';
    this.camera.updateWorldMatrix(true, false);
    mesh.getWorldPosition(this._v);
    const local = this.camera.worldToLocal(this._v);
    const dist = local.length();
    const ang = Math.abs(Math.atan2(local.x, -local.z)) * 180 / Math.PI;
    const side = local.x < 0 ? 'left' : 'right';
    const [, text] = BEARINGS.find(([max]) => ang <= max);
    return `[${name}, ${text.replace('%', side)}, ${Math.round(dist)} m]`;
  }

  // A1 hint: one lower ping (520 Hz, the activation ping is 880 Hz) that comes from an object in the scene. PositionalAudio is an
  // Object3D, so adding it to another object moves the source there. The ping needs Sound on; the returned caption does not.
  hintAt(obj) {
    if (!this.hintSound) {
      const a = new THREE.PositionalAudio(this.listener);
      a.setBuffer(makePing(this.ctx, 520)); a.setRefDistance(1.5); a.setRolloffFactor(1.2); a.setDistanceModel('inverse');
      a.panner.panningModel = 'HRTF';
      this.hintSound = a;
    }
    obj.add(this.hintSound);
    if (this.hintSound.isPlaying) this.hintSound.stop();
    if (settings.audio && this.started) this.hintSound.play();
    return this.describe(obj, 'hint ping');
  }

  update(dt) {
    this._acc += dt;
    if (this._acc < 0.25) return;
    this._acc = 0;
    const playing = this.started && settings.audio && this.source?.isPlaying;
    const text = playing ? this.describe() : '';
    if (text !== this._lastCaption) { this._lastCaption = text; this.captions?.setAmbient(text); }
  }
}
