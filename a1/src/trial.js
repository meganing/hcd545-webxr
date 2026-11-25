import * as THREE from 'three';
import { settings } from './settings.js';

// Fitts-style gaze trial: ten spheres appear one at a time 3 m away; look at each until it fills.
// Time per target = travel (Fitts: distance and size) + dwell. Change Dwell time and Target size between runs and compare the means.
const DIST = 3;

export class Trial {
  constructor({ scene, camera, renderer, gaze, onDone, onSay }) {
    Object.assign(this, { scene, camera, renderer, gaze, onDone, onSay });
    this.mesh = null; this.times = []; this.total = 0; this.t0 = 0;
    this._ray = new THREE.Raycaster();
    this._o = new THREE.Vector3(); this._d = new THREE.Vector3();
  }

  get running() { return this.total > 0; }

  start(n = 10) {
    this.stop();
    this.total = n; this.times = [];
    this._spawn();
  }

  stop() {
    if (this.mesh) { this.scene.remove(this.mesh); this.gaze.remove(this.mesh); this.mesh.geometry.dispose(); this.mesh.material.dispose(); this.mesh = null; }
    this.total = 0; this.gaze.only = null;
  }

  // Every solid mesh you can see: not the head-locked things (reticle, captions) and not see-through ones.
  _solids() {
    const list = [];
    const walk = (o) => {
      if (!o.visible || o === this.camera) return;
      if (o.isMesh && o !== this.mesh && o.material.depthWrite !== false) list.push(o);
      o.children.forEach(walk);
    };
    this.scene.updateMatrixWorld(true);
    walk(this.scene);
    return list;
  }

  // Is the straight line to the ball free, at its center and around its edge?
  _clear(solids, dir, dist, radius) {
    const side = new THREE.Vector3().crossVectors(dir, THREE.Object3D.DEFAULT_UP).normalize();
    const up = new THREE.Vector3().crossVectors(side, dir);
    const ball = this._o.clone().addScaledVector(dir, dist);
    for (const [x, y] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const aim = ball.clone().addScaledVector(side, x * radius * 1.4).addScaledVector(up, y * radius * 1.4);
      this._ray.set(this._o, aim.sub(this._o).normalize());
      this._ray.far = dist + radius;
      if (this._ray.intersectObjects(solids, false).length) return false;
    }
    return true;
  }

  _spawn() {
    const cam = this.camera;   // follows the head pose in XR and includes the rig (see gaze.js)
    cam.getWorldPosition(this._o); cam.getWorldDirection(this._d);
    // A1: the ball must be in plain sight. It was placed only by checking gaze targets, so it could be behind the board or a wall, or under the floor.
    // Pitch is now measured from the horizon (it used to add up from ball to ball) and yaw stays inside one stereo eye's view.
    const facing = Math.atan2(-this._d.x, -this._d.z);
    const tan = Math.tan(THREE.MathUtils.degToRad(2 * settings.targetScale));   // ball radius per metre: 4 degrees across at scale 1
    const solids = this._solids();
    let dir, dist, yaw;
    for (let i = 0; i < 120; i++) {
      dist = i < 60 ? DIST : i < 90 ? 2 : 1.2;       // no clear spot: come closer, with the same angular size
      yaw = (Math.random() * 2 - 1) * (i < 30 ? 28 : i < 60 ? 80 : 28);
      const pitch = THREE.MathUtils.degToRad((Math.random() * 2 - 1) * 15);
      dir = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(pitch, facing + THREE.MathUtils.degToRad(yaw), 0, 'YXZ'));
      if (this._clear(solids, dir, dist, dist * tan)) break;
    }
    const where = Math.abs(yaw) < 8 ? 'ahead' : yaw > 0 ? 'to the left' : 'to the right';
    this.onSay?.(`Trial target ${this.times.length + 1} of ${this.total}: ${where}`, 3);
    const radius = dist * tan;
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 24, 16), new THREE.MeshStandardMaterial({ color: 0xff4081, emissive: 0x551133 }));
    mesh.position.copy(this._o).addScaledVector(dir, dist);
    mesh.userData.target = {
      label: 'Trial target',
      onActivate: () => this._hit(),
      setHover: (on) => mesh.material.emissive.setHex(on ? 0xff80ab : 0x551133),
    };
    this.mesh = mesh;
    this.scene.add(mesh); this.gaze.add(mesh); this.gaze.only = mesh;   // a pad or Begin cannot be picked by accident while you search
    this.t0 = performance.now();
  }

  _hit() {
    this.times.push((performance.now() - this.t0) / 1000);
    this.scene.remove(this.mesh); this.gaze.remove(this.mesh);
    this.mesh.geometry.dispose(); this.mesh.material.dispose(); this.mesh = null;
    if (this.times.length >= this.total) {
      const mean = this.times.reduce((a, b) => a + b, 0) / this.times.length;
      const text = `mean ${mean.toFixed(2)} s over ${this.times.length} | dwell ${settings.dwell.toFixed(1)} s | target ${(4 * settings.targetScale).toFixed(1)} deg`;
      this.total = 0; this.gaze.only = null;
      this.onSay?.(`Trial done: mean ${mean.toFixed(2)} s`, 6);
      this.onDone?.(text, mean);
    } else this._spawn();
  }
}
