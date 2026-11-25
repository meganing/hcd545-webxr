import * as THREE from 'three';
import { settings } from './settings.js';

// Spatial audio with no audio files: the hum and the ping are generated in code as AudioBuffers.
// AudioListener on the camera + PositionalAudio on a mesh = Web Audio PannerNode (HRTF: direction cues for headphones) driven by the scene graph.

function makeHum(ctx) {
  const sr = ctx.sampleRate, T = 3.2, len = Math.floor(sr * T);
  const buf = ctx.createBuffer(1, len, sr), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const t = i / sr, tone = (f) => Math.sin(2 * Math.PI * f * t);
    // a soft chord that swells slowly; every tone and the swell complete whole cycles over the loop, so there is no click where it repeats
    const swell = 0.65 - 0.35 * Math.cos(2 * Math.PI * t / T);
    d[i] = 0.2 * swell * (tone(220) + 0.6 * tone(330) + 0.35 * tone(440) + 0.12 * tone(880)) / 2;
  }
  return buf;
}

// One bell note. A real bell is a low tone plus higher partials, and the high ones fade first; a plain sine sounds like a test beep.
const PARTIALS = [[1, 1, 5], [2, 0.4, 8], [3, 0.15, 12], [4.2, 0.06, 20]];   // [frequency ratio, loudness, fade speed]
function bell(t, f, mellow) {
  const attack = Math.min(1, t / 0.006);   // 6 ms from silence, so the start does not click
  let v = 0;
  for (const [ratio, loud, fade] of mellow ? PARTIALS.slice(0, 2) : PARTIALS) v += loud * Math.exp(-t * fade * (mellow ? 1.8 : 1)) * Math.sin(2 * Math.PI * f * ratio * t);
  return attack * v;
}

// A run of bell notes with a quiet echo. gap: seconds between notes (0 = a chord). vol: the loudest sample, so it can never clip.
function makeSeq(ctx, notes, { gap = 0.1, ring = 0.7, vol = 0.4, mellow = false } = {}) {
  const sr = ctx.sampleRate, len = Math.floor(sr * (gap * (notes.length - 1) + ring));
  const buf = ctx.createBuffer(1, len, sr), d = buf.getChannelData(0);
  notes.forEach((f, n) => {
    for (const [delay, level] of [[0, 1], [0.11, 0.22], [0.23, 0.1]]) {   // the note, then two echoes
      const start = Math.floor(sr * (gap * n + delay));
      for (let i = start; i < len; i++) d[i] += level * bell((i - start) / sr, f, mellow);
    }
  });
  let peak = 0;
  for (const v of d) peak = Math.max(peak, Math.abs(v));
  for (let i = 0; i < len; i++) d[i] *= vol / peak * Math.min(1, (len - i) / (0.06 * sr));   // set the loudness; the last 60 ms fade to zero
  return buf;
}
const makePing = (ctx, freq = 659) => makeSeq(ctx, [freq], { ring: 0.5, vol: 0.28 });

// Notes are from one C major chord, so sounds that overlap still fit together. Nothing is below 260 Hz: phone speakers cannot play it.
const SFX = {
  found: () => [[523, 784], { gap: 0.09 }],                                        // a rising two-note chime: correct
  wrong: () => [[330, 262], { gap: 0.13, ring: 0.4, vol: 0.38, mellow: true }],    // two soft falling notes: wrong
  win:   () => [[523, 659, 784, 1047, 1319], { gap: 0.11, ring: 1.4, vol: 0.45 }], // a rising run: all found
  lose:  () => [[523, 440, 349, 262], { gap: 0.2, ring: 0.9, mellow: true }],      // a slow falling run: time is up
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
      const [notes, opt] = make();
      const s = new THREE.Audio(this.listener); s.setBuffer(makeSeq(this.ctx, notes, opt)); this.sfxSounds[name] = s;
    }
  }

  // Call from a click/tap handler: browsers keep the AudioContext suspended until a user gesture.
  start() {
    this.ctx.resume();
    this.started = true;
    this.sync();
  }

  resume() { this.ctx.resume(); }

  // Apply on/off + volume from settings. Sound is for everything; the hum also needs its own switch and a visible speaker (A1: only in the lobby).
  sync() {
    this.listener.setMasterVolume(settings.volume);
    if (!this.source || !this.started) return;
    if (settings.audio) this.ctx.resume();   // a phone can suspend sound when you switch apps
    const hum = settings.audio && settings.hum && this.mesh.visible;
    if (hum !== this.source.isPlaying) { if (hum) this.source.play(); else this.source.pause(); }
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

  // A1 hint: one lower bell (523 Hz, the activation bell is 659 Hz) that comes from an object in the scene. PositionalAudio is an
  // Object3D, so adding it to another object moves the source there. The ping needs Sound on; the returned caption does not.
  hintAt(obj) {
    if (!this.hintSound) {
      const a = new THREE.PositionalAudio(this.listener);
      a.setBuffer(makePing(this.ctx, 523)); a.setRefDistance(1.5); a.setRolloffFactor(1.2); a.setDistanceModel('inverse');
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
