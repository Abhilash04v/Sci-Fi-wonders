// A small orbit camera: drag to look around, wheel or pinch to zoom,
// and a slow drift when nobody is touching it.
import * as THREE from 'three';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export class OrbitRig {
  constructor(camera) {
    this.camera = camera;
    this.target = new THREE.Vector3();
    this.goalTarget = new THREE.Vector3();
    this.theta = 0; this.phi = 1.2; this.radius = 10;
    this.goalTheta = 0; this.goalPhi = 1.2; this.goalRadius = 10;
    this.minPhi = 0.25; this.maxPhi = Math.PI - 0.25;
    this.minRadius = 2; this.maxRadius = 100;
    this.auto = 0.03;        // idle drift, radians per second
    this.idle = 10;
    this.enabled = true;
    this.shake = 0;
    this.fit = 1;            // extra distance for portrait screens
    this.roll = 0;           // quarter-turn the view (used to stand a wide scene upright on phones)
    this.minY = -Infinity;   // keep the camera above the ground in scenes that have one
    this.damping = 5;
    this._v = new THREE.Vector3();
  }

  /** Point the rig somewhere. Pass snap:true to cut instead of gliding. */
  set(o) {
    if (o.target) this.goalTarget.copy(o.target);
    if (o.theta !== undefined) this.goalTheta = o.theta;
    if (o.phi !== undefined) this.goalPhi = o.phi;
    if (o.radius !== undefined) this.goalRadius = o.radius;
    for (const k of ['minPhi', 'maxPhi', 'minRadius', 'maxRadius', 'auto', 'damping', 'minY']) if (o[k] !== undefined) this[k] = o[k];
    if (o.snap) {
      this.target.copy(this.goalTarget);
      this.theta = this.goalTheta; this.phi = this.goalPhi; this.radius = this.goalRadius;
      this.idle = 10;
    }
  }

  rotate(dx, dy) {
    if (this.roll) { const s = Math.sign(this.roll); [dx, dy] = [dy * s, -dx * s]; }
    this.goalTheta -= dx * 0.0055;
    this.goalPhi = clamp(this.goalPhi - dy * 0.0055, this.minPhi, this.maxPhi);
    this.idle = 0;
  }

  zoom(factor) {
    this.goalRadius = clamp(this.goalRadius * factor, this.minRadius, this.maxRadius);
    this.idle = 0;
  }

  update(dt) {
    if (!this.enabled) return;
    this.idle += dt;
    if (this.idle > 2.5 && this.auto) this.goalTheta += this.auto * dt;
    const k = 1 - Math.exp(-dt * this.damping);
    this.theta += (this.goalTheta - this.theta) * k;
    this.phi += (this.goalPhi - this.phi) * k;
    this.radius += (this.goalRadius - this.radius) * k;
    this.target.lerp(this.goalTarget, k);
    const r = this.radius * this.fit, sp = Math.sin(this.phi);
    this.camera.position.set(
      this.target.x + r * sp * Math.sin(this.theta),
      this.target.y + r * Math.cos(this.phi),
      this.target.z + r * sp * Math.cos(this.theta),
    );
    if (this.camera.position.y < this.minY) this.camera.position.y = this.minY;
    this.camera.lookAt(this.target);
    if (this.roll) this.camera.rotateZ(this.roll);
    if (this.shake > 0.0005) {
      const s = this.shake * r * 0.02;
      this.camera.position.add(this._v.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(s));
      this.shake *= Math.exp(-dt * 3.2);
    }
  }
}
