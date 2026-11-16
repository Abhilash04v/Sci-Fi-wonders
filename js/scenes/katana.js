// The Katana Fleet: two hundred warships slaved together so one crew could fly them all.
// Wake them, then steer the flagship. Every other ship follows your exact path a beat later.
import * as THREE from 'three';
import { makeSky, makeStars } from '../core/sky.js';

export const meta = {
  id: 'katana',
  name: 'The Katana Fleet',
  tag: 'Two hundred ships that move as one',
  blurb: 'Two hundred warships, wired together so that a single crew could fly them all. One day every ship jumped to lightspeed at the same instant, and the whole fleet vanished.',
  since: 1992,
  accent: '#8fb4ff',
  isNew: true,
  hint: 'Wake the fleet, then drag to steer. Every ship copies yours, one beat behind.',
  bloom: { strength: 0.8, radius: 0.6, threshold: 0.6 },
  drone: 46.2,
};

const N = 200, CRUISE = 26;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

const SKIES = [
  { name: 'Where they were lost', a: '#10245a', b: '#1a1238', c: '#3d6a9a', density: 0.4, dust: 0.6, gain: 0.6, seed: 5.5, key: '#cfe0ff', keyDir: [0.5, 0.6, 0.6] },
  { name: 'Beside a dying red star', a: '#5a1418', b: '#24103a', c: '#c8502a', density: 0.5, dust: 0.6, gain: 0.7, seed: 19.3, key: '#ffb08a', keyDir: [-0.7, 0.3, 0.6] },
  { name: 'Under a green aurora', a: '#0c4a3a', b: '#102a5a', c: '#7ae8a8', density: 0.52, dust: 0.55, gain: 0.7, seed: 27.9, key: '#c8ffe0', keyDir: [0.2, 0.8, -0.5] },
];

// ---- one warship, built from a few simple solids and merged into a single mesh
function shipGeometry() {
  const parts = [
    new THREE.CylinderGeometry(0.34, 0.6, 5.2, 8).rotateX(-Math.PI / 2),
    new THREE.ConeGeometry(0.34, 0.9, 8).rotateX(-Math.PI / 2).translate(0, 0, -3.05),
    new THREE.SphereGeometry(0.78, 8, 6).scale(1, 0.8, 1.6).translate(0, 0, 0.5),
    new THREE.BoxGeometry(0.3, 0.42, 0.9).translate(0, 0.74, 1.0),
    new THREE.BoxGeometry(0.06, 0.5, 2.2).translate(0, 0.6, -0.7),
    new THREE.BoxGeometry(2.0, 0.07, 0.8).translate(0, -0.05, 1.2),
    new THREE.CylinderGeometry(0.5, 0.66, 0.7, 8).rotateX(-Math.PI / 2).translate(0, 0, 2.8),
    new THREE.CylinderGeometry(0.2, 0.16, 0.4, 6).rotateX(-Math.PI / 2).translate(0, 0.26, 3.25),
    new THREE.CylinderGeometry(0.2, 0.16, 0.4, 6).rotateX(-Math.PI / 2).translate(0.28, -0.16, 3.25),
    new THREE.CylinderGeometry(0.2, 0.16, 0.4, 6).rotateX(-Math.PI / 2).translate(-0.28, -0.16, 3.25),
  ].map((g) => g.toNonIndexed());
  const count = parts.reduce((s, g) => s + g.attributes.position.count, 0);
  const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3);
  let o = 0;
  for (const g of parts) {
    pos.set(g.attributes.position.array, o); nor.set(g.attributes.normal.array, o);
    o += g.attributes.position.array.length;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return geo;
}

const SHIP_VERT = /* glsl */ `
attribute float aPower;
attribute float aWarp;
attribute float aSeed;
varying vec3 vN;
varying vec3 vWP;
varying vec3 vL;
varying float vPower;
varying float vWarp;
varying float vSeed;
void main(){
  vec3 p = position;
  vL = p;
  p.z *= 1.0 + aWarp * 16.0;                       // the jump pulls each ship out into a streak
  p.xy *= 1.0 - aWarp * 0.7;
  mat4 m = modelMatrix * instanceMatrix;
  vec4 wp = m * vec4(p, 1.0);
  vWP = wp.xyz;
  vN = normalize(mat3(m) * normal);
  vPower = aPower; vWarp = aWarp; vSeed = aSeed;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;
const SHIP_FRAG = /* glsl */ `
varying vec3 vN;
varying vec3 vWP;
varying vec3 vL;
varying float vPower;
varying float vWarp;
varying float vSeed;
uniform vec3 uKeyDir, uKeyColor, uFill, uAccent;
uniform float uCharge;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main(){
  vec3 N = normalize(vN);
  vec3 V = normalize(cameraPosition - vWP);
  float diff = max(dot(N, uKeyDir), 0.0);
  float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  float plate = 0.82 + 0.18 * hash(floor(vec2(vL.z * 2.2 + vSeed * 9.0, atan(vL.y, vL.x) * 2.0)));
  vec3 col = vec3(0.3, 0.32, 0.37) * plate * (0.05 + diff * 0.95) * uKeyColor;
  col += uFill * (0.12 * (0.5 + 0.5 * N.y) + fres * 0.45);
  // rows of lit ports along the hull, once the ship has power
  vec2 g = vec2(atan(vL.y, vL.x) * 4.0, vL.z * 5.0);
  vec2 f = fract(g);
  float port = step(0.7, hash(floor(g) + vSeed * 31.0)) * step(abs(f.x - 0.5), 0.2) * step(abs(f.y - 0.5), 0.16);
  col += vec3(1.0, 0.86, 0.62) * port * vPower * 1.5;
  // engines
  float stern = smoothstep(2.7, 3.3, vL.z);
  col += uAccent * stern * vPower * (2.5 + uCharge * 5.0);
  col += uAccent * vWarp * 2.5;
  gl_FragColor = vec4(col, 1.0);
}
`;

const GLOW_VERT = /* glsl */ `
attribute float aPower;
uniform float uPx, uCharge;
varying float vP;
void main(){
  vP = aPower * (1.0 + uCharge * 1.5);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(uPx * 210.0 * (0.6 + uCharge * 0.8) / -mv.z, 1.5, 40.0);
}
`;
const GLOW_FRAG = /* glsl */ `
uniform vec3 uColor;
varying float vP;
void main(){
  float d = length(gl_PointCoord - 0.5);
  float a = 1.0 - smoothstep(0.0, 0.5, d);
  gl_FragColor = vec4(uColor * a * a * vP, 1.0);
}
`;
const DUST_VERT = /* glsl */ `
uniform vec3 uCam;
uniform float uPx;
void main(){
  // the same cloud of motes, wrapped around wherever the camera is
  vec3 p = mod(position - uCam + 160.0, 320.0) - 160.0 + uCam;
  vec4 mv = viewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uPx * 1.6;
}
`;

// ---- formations: where each follower sits. x, y are sideways; z is how far back along the flagship's path.
const FORMATIONS = [
  ['Parade ground', (i) => [((i % 20) - 9.5) * 8, 0, 14 + Math.floor(i / 20) * 12]],
  ['Arrowhead', (i) => { const r = Math.floor(Math.sqrt(i + 1)), c = i + 1 - r * r; return [(c - r) * 7.5, ((r % 3) - 1) * 5, r * 9.5]; }],
  ['The tunnel', (i) => { const j = Math.floor(i / 20), a = ((i % 20) / 20) * 6.283 + j * 0.16; return [Math.cos(a) * 30, Math.sin(a) * 30, 18 + j * 13]; }],
  ['Double helix', (i) => { const t = Math.floor(i / 2), a = t * 0.3 + (i % 2) * Math.PI; return [Math.cos(a) * 21, Math.sin(a) * 21, 12 + t * 2.3]; }],
  ['The sphere', (i) => { const y = 1 - (i / 198) * 2, r = Math.sqrt(1 - y * y), a = i * 2.39996; return [Math.cos(a) * r * 44, y * 44, 62 + Math.sin(a) * r * 44]; }],
];

export function create(app) {
  const scene = new THREE.Scene();
  let skyIndex = 0;
  const sky = makeSky(app.renderer, SKIES[0]);
  const stars = makeStars(4500);
  scene.add(sky.mesh, stars.points);

  const shipMat = new THREE.ShaderMaterial({
    vertexShader: SHIP_VERT, fragmentShader: SHIP_FRAG,
    uniforms: {
      uKeyDir: { value: new THREE.Vector3(...SKIES[0].keyDir).normalize() }, uKeyColor: { value: new THREE.Color(SKIES[0].key) },
      uFill: { value: new THREE.Color('#2a3c6a') }, uAccent: { value: new THREE.Color(meta.accent) }, uCharge: { value: 0 },
    },
  });
  const geo = shipGeometry();
  const aPower = new Float32Array(N), aWarp = new Float32Array(N), aSeed = Float32Array.from({ length: N }, () => Math.random());
  geo.setAttribute('aPower', new THREE.InstancedBufferAttribute(aPower, 1));
  geo.setAttribute('aWarp', new THREE.InstancedBufferAttribute(aWarp, 1));
  geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(aSeed, 1));
  const fleet = new THREE.InstancedMesh(geo, shipMat, N);
  fleet.frustumCulled = false;
  scene.add(fleet);

  const glowPos = new Float32Array(N * 3);
  const glowGeo = new THREE.BufferGeometry();
  glowGeo.setAttribute('position', new THREE.BufferAttribute(glowPos, 3));
  glowGeo.setAttribute('aPower', new THREE.BufferAttribute(aPower, 1));
  const glows = new THREE.Points(glowGeo, new THREE.ShaderMaterial({
    vertexShader: GLOW_VERT, fragmentShader: GLOW_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uPx: { value: app.px }, uCharge: { value: 0 }, uColor: { value: new THREE.Color(meta.accent).multiplyScalar(0.95) } },
  }));
  glows.frustumCulled = false;
  scene.add(glows);

  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(Float32Array.from({ length: 1100 * 3 }, () => Math.random() * 320), 3));
  const dust = new THREE.Points(dustGeo, new THREE.ShaderMaterial({
    vertexShader: DUST_VERT, fragmentShader: 'void main(){ gl_FragColor = vec4(vec3(0.5, 0.6, 0.8) * 0.5, 1.0); }',
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uCam: { value: new THREE.Vector3() }, uPx: { value: app.px } },
  }));
  dust.frustumCulled = false;
  scene.add(dust);

  // ---- the flagship's path, remembered every half unit travelled, so followers can retrace it
  const DS = 0.5, LEN = 760;
  const hp = new Float32Array(LEN * 3), hq = new Float32Array(LEN * 4);
  let head = 0, since = 0;
  const F = { pos: new THREE.Vector3(), yaw: 0.4, pitch: 0, roll: 0, yawRate: 0, pitchRate: 0, speed: 1.5, q: new THREE.Quaternion() };
  const e = new THREE.Euler(0, 0, 0, 'YXZ'), fwd = new THREE.Vector3();
  e.set(0, F.yaw, 0); F.q.setFromEuler(e); fwd.set(0, 0, -1).applyQuaternion(F.q);
  for (let i = 0; i < LEN; i++) {
    // before anything has moved, the "path" is a straight line trailing behind
    const k = (head - i + LEN) % LEN;
    hp.set([F.pos.x - fwd.x * DS * i, F.pos.y - fwd.y * DS * i, F.pos.z - fwd.z * DS * i], k * 3);
    hq.set([F.q.x, F.q.y, F.q.z, F.q.w], k * 4);
  }
  const push = () => {
    head = (head + 1) % LEN;
    hp.set([F.pos.x, F.pos.y, F.pos.z], head * 3);
    hq.set([F.q.x, F.q.y, F.q.z, F.q.w], head * 4);
  };
  const qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
  function sample(back, outPos, outQ) {
    const f = Math.max(0, (back - since) / DS), i0 = Math.min(LEN - 2, Math.floor(f)), t = Math.min(1, f - i0);
    const a = (head - i0 + LEN * 2) % LEN, b = (head - i0 - 1 + LEN * 2) % LEN;
    if (back <= since) { outPos.copy(F.pos).addScaledVector(fwd, -back); outQ.copy(F.q); return; }
    outPos.set(hp[a * 3] + (hp[b * 3] - hp[a * 3]) * t, hp[a * 3 + 1] + (hp[b * 3 + 1] - hp[a * 3 + 1]) * t, hp[a * 3 + 2] + (hp[b * 3 + 2] - hp[a * 3 + 2]) * t);
    qa.fromArray(hq, a * 4); qb.fromArray(hq, b * 4);
    outQ.copy(qa).slerp(qb, t);
  }

  // ---- every ship: where it sits in the formation now, and where it is heading
  let formation = 0;
  const slots = Array.from({ length: N }, (_, i) => {
    const o = i === 0 ? [0, 0, 0] : FORMATIONS[0][1](i - 1);
    return { cur: new THREE.Vector3(...o), goal: new THREE.Vector3(...o), rate: 0.7 + Math.random() * 0.9, scale: i === 0 ? 1.6 : 0.85 + Math.random() * 0.3, powerAt: Infinity, warpAt: Infinity, backAt: Infinity };
  });
  function setFormation(k) {
    formation = k;
    slots.forEach((s, i) => { if (i) s.goal.set(...FORMATIONS[k][1](i - 1)); });
  }

  // ---- state
  let awake = false, state = 'idle', charge = 0, holding = false, jumps = 0, lastInput = -10, depth = 60, here = false;
  const steerP = new THREE.Vector2(), steer = new THREE.Vector2();
  const m4 = new THREE.Matrix4(), p3 = new THREE.Vector3(), q4 = new THREE.Quaternion(), s3 = new THREE.Vector3(), off = new THREE.Vector3(), look = new THREE.Vector3(), lookQ = new THREE.Quaternion();

  const showReadout = () => app.readout(
    !awake ? 'Two hundred ships, dark and drifting'
      : `${FORMATIONS[formation][0]} · ${jumps ? `Jumps together ${String(jumps).padStart(2, '0')}` : 'All 200 answering'}`,
  );

  function wake() {
    awake = true;
    const now = app.time;
    slots.forEach((s, i) => { s.powerAt = now + s.cur.z * 0.011 + Math.hypot(s.cur.x, s.cur.y) * 0.006; });
    [0, 2, 4, 7, 9, 12, 14].forEach((n, i) => app.sound.chime(n, 110, 0.14, i * 0.3));
    app.sound.tone({ freq: 40, to: 92, dur: 3.2, gain: 0.22, type: 'sawtooth', attack: 1.5 });
    app.action('form', { verb: 'New formation', how: 'Tap' });
    app.action('jump', { disabled: false });
    app.toast('One switch. Two hundred ships answer.', 3.4);
    showReadout();
  }

  async function jump() {
    state = 'jumping';
    app.action('jump', { disabled: true }); app.action('form', { disabled: true });
    const now = app.time;
    slots.forEach((s) => { s.warpAt = now + s.cur.z * 0.0055; });
    app.sound.tone({ freq: 160, to: 1200, dur: 1.6, gain: 0.1, type: 'triangle' });
    await app.wait(1.25);
    if (!here) {
      // the visitor left mid-jump: put the fleet back and stop here
      slots.forEach((sl) => { sl.warpAt = Infinity; sl.backAt = 0; });
      charge = 0; state = 'idle';
      return;
    }
    const next = (skyIndex + 1) % SKIES.length;
    await app.travel(async (step) => {
      if (step !== 'arrive') return;
      skyIndex = next;
      const s = SKIES[next];
      sky.paint(s);
      shipMat.uniforms.uKeyDir.value.set(...s.keyDir).normalize();
      shipMat.uniforms.uKeyColor.value.set(s.key);
      const t = app.time;
      slots.forEach((sl) => { sl.warpAt = Infinity; sl.backAt = t + 0.2 + sl.cur.z * 0.004; });
    }, { hold: 0.9, color: '#cfe0ff' });
    jumps++; charge = 0; state = 'idle';
    app.action('jump', { disabled: false }); app.action('form', { disabled: false });
    app.toast(SKIES[skyIndex].name, 3);
    showReadout();
  }

  const actions = [
    {
      id: 'form', verb: 'Wake the fleet', how: 'Tap', kind: 'tap', key: 'n',
      down() {
        if (!awake) { wake(); return; }
        setFormation((formation + 1) % FORMATIONS.length);
        app.sound.blip();
        app.toast(FORMATIONS[formation][0], 2);
        showReadout();
      },
    },
    {
      id: 'jump', verb: 'Jump together', how: 'Hold, then let go', kind: 'hold', key: ' ',
      down() { if (awake && state === 'idle') { holding = true; app.sound.startCharge(50); } },
      up() {
        if (!holding) return;
        holding = false;
        app.sound.stopCharge();
        if (charge >= 0.5) jump();
      },
    },
  ];

  return {
    scene, actions,
    usesArrows: true,
    enter() {
      here = true;
      app.rig.set({
        target: F.pos.clone(), theta: F.yaw + 0.62, phi: 1.12, radius: 150, snap: true,
        auto: 0, minPhi: 0.3, maxPhi: Math.PI - 0.3, minRadius: 40, maxRadius: 330, damping: 3,
      });
      app.rig.fit = app.camera.aspect < 0.8 ? 1.35 : 1;
      app.action('form', awake ? { verb: 'New formation', how: 'Tap' } : { verb: 'Wake the fleet', how: 'Tap' });
      app.action('jump', { disabled: !awake || state !== 'idle' });
      showReadout();
    },
    leave() { here = false; app.sound.stopCharge(); holding = false; app.bloomKick = 0; },
    resize() { app.rig.fit = app.camera.aspect < 0.8 ? 1.35 : 1; },
    onPointerDown() { if (!awake) return false; steerP.set(0, 0); lastInput = app.time; return true; },
    onPointerMove(ev, ndc, d) { steerP.set(clamp(d.ox / 100, -1, 1), clamp(d.oy / 100, -1, 1)); lastInput = app.time; },
    onPointerUp() { steerP.set(0, 0); },
    update(dt, t) {
      // ---- steer the flagship
      const K = app.keys;
      const kx = (K.has('d') || K.has('ArrowRight') ? 1 : 0) - (K.has('a') || K.has('ArrowLeft') ? 1 : 0);
      const ky = (K.has('s') || K.has('ArrowDown') ? 1 : 0) - (K.has('w') || K.has('ArrowUp') ? 1 : 0);
      if (kx || ky) lastInput = t;
      steer.set(clamp(steerP.x + kx, -1, 1), clamp(steerP.y + ky, -1, 1));
      if (awake && t - lastInput > 5) steer.set(Math.sin(t * 0.19) * 0.55, Math.sin(t * 0.13 + 1) * 0.3 - F.pitch * 0.8);
      if (!awake) steer.set(0, 0);
      const k = 1 - Math.exp(-dt * 2.2);
      F.yawRate += (-steer.x * 0.6 - F.yawRate) * k;
      F.pitchRate += (-steer.y * 0.42 - F.pitchRate) * k;
      const dYaw = F.yawRate * dt;
      F.yaw += dYaw;
      F.pitch = clamp(F.pitch + F.pitchRate * dt, -0.9, 0.9);
      F.roll += (F.yawRate * 0.9 - F.roll) * (1 - Math.exp(-dt * 3));
      F.speed += ((awake ? CRUISE : 1.5) - F.speed) * (1 - Math.exp(-dt * 0.9));
      e.set(F.pitch, F.yaw, 0); fwd.set(0, 0, -1).applyEuler(e);
      e.set(F.pitch, F.yaw, F.roll); F.q.setFromEuler(e);
      const move = F.speed * dt;
      F.pos.addScaledVector(fwd, move);
      since += move;
      while (since >= DS) { since -= DS; push(); }

      // ---- charge for the jump
      if (state === 'idle') charge = holding ? Math.min(1, charge + dt / 2.0) : Math.max(0, charge - dt * 1.2);
      if (holding) app.sound.setCharge(charge);
      app.meter('jump', charge, charge >= 0.5);
      shipMat.uniforms.uCharge.value = charge;
      glows.material.uniforms.uCharge.value = charge;
      app.bloomKick = charge * 0.35;

      // ---- place every ship on the flagship's path
      let zSum = 0;
      for (let i = 0; i < N; i++) {
        const s = slots[i];
        s.cur.lerp(s.goal, 1 - Math.exp(-dt * s.rate));
        zSum += s.cur.z;
        sample(s.cur.z, p3, q4);
        off.set(s.cur.x, s.cur.y, 0).applyQuaternion(q4);
        p3.add(off);
        if (t >= s.powerAt) aPower[i] = Math.min(1, aPower[i] + dt * 1.6);
        // the jump: stretch, then gone; the return: snap back from a streak
        if (t >= s.warpAt) aWarp[i] = Math.min(1, aWarp[i] + dt / 0.32);
        if (t >= s.backAt) { aWarp[i] = Math.max(0, aWarp[i] - dt / 0.3); if (aWarp[i] === 0) s.backAt = Infinity; }
        const gone = s.warpAt !== Infinity && aWarp[i] >= 1;
        const sc = gone ? 0.0001 : s.scale;
        fleet.setMatrixAt(i, m4.compose(p3, q4, s3.set(sc, sc, sc)));
        off.set(0, 0, 3.3 * s.scale).applyQuaternion(q4);
        glowPos[i * 3] = p3.x + off.x; glowPos[i * 3 + 1] = p3.y + off.y; glowPos[i * 3 + 2] = p3.z + off.z;
        if (gone) glowPos[i * 3 + 1] += 1e5;
      }
      fleet.instanceMatrix.needsUpdate = true;
      geo.attributes.aPower.needsUpdate = true;
      geo.attributes.aWarp.needsUpdate = true;
      glowGeo.attributes.position.needsUpdate = true;
      glowGeo.attributes.aPower.needsUpdate = true;

      // ---- camera rides with the middle of the fleet, and turns as the flagship turns
      depth += (zSum / N * 0.75 - depth) * (1 - Math.exp(-dt * 1.2));
      sample(depth, look, lookQ);
      app.rig.goalTarget.copy(look);
      app.rig.goalTheta += dYaw; app.rig.theta += dYaw;

      dust.material.uniforms.uCam.value.copy(app.camera.position);
      sky.follow(app.camera);
      stars.update(app.camera, t, app.px);
    },
  };
}
