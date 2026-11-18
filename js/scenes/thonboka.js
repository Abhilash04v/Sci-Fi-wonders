// The Starcave of ThonBoka: a nebula full of Oswaft, vast gentle creatures that swim in open space.
// You steer one of them. Sing to call the pod and draw starlight in, leap to dash ahead.
import * as THREE from 'three';
import { makeSky, makeStars, makeGlow, softTexture } from '../core/sky.js';
import { NOISE } from '../core/glsl.js';

export const meta = {
  id: 'thonboka',
  name: 'The Starcave of ThonBoka',
  tag: 'Home of the Oswaft',
  blurb: 'Deep inside a nebula shaped like a cave live the Oswaft. They are gentle giants that swim through open space, feed on starlight and talk to each other in light.',
  since: 1983,
  accent: '#c9a0ff',
  hint: 'Drag to steer. Sing to call the pod and draw starlight in. Leap to dash ahead.',
  bloom: { strength: 0.85, radius: 0.7, threshold: 0.55 },
  drone: 73.4,
};

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const rnd = (a, b) => a + Math.random() * (b - a);

// ---------------------------------------------------------------- the creature
function oswaftGeometry() {
  const NS = 44, NC = 12;
  const pos = [], uv = [], part = [], idx = [];
  for (let j = 0; j <= NC; j++) {
    for (let i = 0; i <= NS; i++) {
      const s = (i / NS) * 2 - 1, a = Math.abs(s), c = j / NC;
      const lead = -0.55 + 0.8 * Math.pow(a, 1.35);
      const chord = 1.02 * Math.pow(1 - a, 0.7) + 0.015;
      const y = 0.17 * Math.exp(-Math.pow(a / 0.24, 2)) * Math.pow(Math.sin(Math.PI * c), 0.8) - 0.04 * a * a;
      pos.push(s, y, lead + c * chord); uv.push(i / NS, c); part.push(0);
    }
  }
  for (let j = 0; j < NC; j++) {
    for (let i = 0; i < NS; i++) {
      const a = j * (NS + 1) + i, b = a + 1, c = a + NS + 1, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  // two long trailing ribbons
  const SEG = 28;
  for (const side of [-1, 1]) {
    const base = pos.length / 3;
    for (let k = 0; k <= SEG; k++) {
      const t = k / SEG, w = 0.032 * (1 - t) + 0.004, x = side * 0.09 * (1 + t * 0.8), z = 0.42 + t * 2.3;
      pos.push(x - w, 0, z, x + w, 0, z);
      uv.push(side < 0 ? 0.3 : 0.7, t, side < 0 ? 0.3 : 0.7, t);
      part.push(1, 1);
    }
    for (let k = 0; k < SEG; k++) {
      const a = base + k * 2;
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('aPart', new THREE.Float32BufferAttribute(part, 1));
  geo.setIndex(idx);
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0.8), 3.2);
  return geo;
}

const OSWAFT_VERT = /* glsl */ `
attribute float aPart;
uniform float uTime, uPhase, uFlap, uAmp, uLeap;
varying vec2 vUv;
varying float vPart;
varying vec3 vVP;
void main(){
  vec3 p = position;
  float s = uv.x * 2.0 - 1.0, a = abs(s);
  float tt = uTime * uFlap + uPhase;
  if (aPart < 0.5) {
    float w = pow(a, 1.5);
    float beat = sin(tt - a * 2.4);
    p.y += beat * uAmp * w;
    p.y += sin(tt * 0.5 + uv.y * 3.0) * 0.02;
    p.x *= 1.0 - 0.14 * w * (0.5 + 0.5 * sin(tt - a * 2.4 + 1.57));
  } else {
    float t = uv.y;
    p.y += sin(tt * 1.3 - t * 7.0) * 0.11 * t;
    p.x += sin(tt * 0.9 - t * 5.0 + s * 2.0) * 0.07 * t;
    p.z += uLeap * t * 2.0;
  }
  vUv = uv; vPart = aPart;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vVP = mv.xyz;
  gl_Position = projectionMatrix * mv;
}
`;
const OSWAFT_FRAG = /* glsl */ `
varying vec2 vUv;
varying float vPart;
varying vec3 vVP;
uniform float uTime, uPhase, uGlow, uDim;
uniform vec3 uColA, uColB;
${NOISE}
void main(){
  float s = vUv.x * 2.0 - 1.0, a = abs(s), c = vUv.y;
  vec3 col; float alpha;
  if (vPart < 0.5) {
    vec3 N = normalize(cross(dFdx(vVP), dFdy(vVP)));
    float sheen = pow(1.0 - abs(dot(N, normalize(-vVP))), 2.0);
    float edge = max(smoothstep(0.72, 1.0, a), max(1.0 - smoothstep(0.0, 0.1, c), smoothstep(0.86, 1.0, c)));
    float ribs = pow(abs(sin((a * 8.0 + c * 1.1) * 3.14159)), 26.0) * (1.0 - a * 0.5);
    float spine = exp(-pow(a / 0.045, 2.0));
    float heart = exp(-(pow(a / 0.17, 2.0) + pow((c - 0.4) / 0.24, 2.0))) * (0.65 + 0.35 * sin(uTime * 2.0 + uPhase));
    float spots = smoothstep(0.5, 0.8, snoise(vec3(vUv * vec2(15.0, 9.0), uPhase))) * (0.5 + 0.5 * sin(uTime * 1.6 + uPhase + a * 9.0));
    float i = 0.07 + 0.08 * (1.0 - a) + edge * 0.7 + ribs * 0.5 + spine * 0.45 + heart * 0.6 + spots * 0.4 + sheen * 0.35;
    col = mix(uColA, uColB, clamp(a * 1.05 + heart * 0.6, 0.0, 1.0)) * i * (1.0 + uGlow * 3.0) * uDim;
    alpha = 0.34 * uDim;
  } else {
    float t = vUv.y;
    col = uColB * (1.0 - t) * 0.8 * (1.0 + uGlow * 3.0) * uDim;
    alpha = 0.0;
  }
  gl_FragColor = vec4(col, alpha);
}
`;

const LOOKS = [
  ['#7fe9ff', '#b48cff'], ['#8fb6ff', '#ff8fd0'], ['#7affc8', '#7fa8ff'], ['#ffd28a', '#ff8fb0'],
  ['#c9a0ff', '#7fe9ff'], ['#9affea', '#c9a0ff'], ['#ffa8e0', '#8fb6ff'],
];

function makeOswaft(geo, look, scale, dim = 1) {
  const mat = new THREE.ShaderMaterial({
    vertexShader: OSWAFT_VERT, fragmentShader: OSWAFT_FRAG, side: THREE.DoubleSide, transparent: true, depthWrite: false,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    uniforms: {
      uTime: { value: 0 }, uPhase: { value: Math.random() * 20 }, uFlap: { value: rnd(1.5, 2.1) / Math.sqrt(scale / 2) },
      uAmp: { value: rnd(0.3, 0.4) }, uLeap: { value: 0 }, uGlow: { value: 0 }, uDim: { value: dim },
      uColA: { value: new THREE.Color(look[0]) }, uColB: { value: new THREE.Color(look[1]) },
    },
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.scale.setScalar(scale);
  return mesh;
}

// ---------------------------------------------------------------- starlight motes
const MOTE_VERT = /* glsl */ `
attribute float aSize;
attribute float aPhase;
uniform float uTime, uPx, uBurst, uFade;
varying float vA;
void main(){
  vec3 p = position * (1.0 + uBurst * 6.0);
  p += 0.3 * vec3(sin(uTime * 0.9 + aPhase * 20.0), cos(uTime * 0.7 + aPhase * 33.0), sin(uTime * 1.1 + aPhase * 47.0));
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = min(48.0, aSize * uPx * 70.0 / -mv.z);
  vA = uFade * (1.0 - uBurst) * (0.6 + 0.4 * sin(uTime * 3.0 + aPhase * 50.0));
}
`;
const MOTE_FRAG = /* glsl */ `
uniform vec3 uColor;
varying float vA;
void main(){
  float d = length(gl_PointCoord - 0.5);
  float a = 1.0 - smoothstep(0.0, 0.5, d);
  gl_FragColor = vec4(uColor * a * a * vA, 1.0);
}
`;

// ---------------------------------------------------------------- scene
export function create(app) {
  const scene = new THREE.Scene();
  const sky = makeSky(app.renderer, {
    a: '#3a0f72', b: '#0f3a86', c: '#ff5fa8', base: '#04020c', density: 0.72, dust: 0.72, gain: 1.0, seed: 6.4, scale: 1.25,
    hole: 0.88, focus: [0.25, 0.1, -1],
  });
  const stars = makeStars(3800);
  scene.add(sky.mesh, stars.points);

  // drifting fog banks, for depth as you swim through
  const fogColors = ['#5a2aa8', '#2a4ab8', '#b83a8a', '#2a8aa8'];
  const fog = [];
  for (let i = 0; i < 64; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: softTexture(), color: fogColors[i % fogColors.length], transparent: true, opacity: 0, depthWrite: false,
      blending: THREE.AdditiveBlending, rotation: Math.random() * 6.28,
    }));
    const d = new THREE.Vector3().randomDirection().multiplyScalar(rnd(40, 190));
    d.y *= 0.55;
    sp.position.copy(d);
    sp.scale.setScalar(rnd(70, 150));
    sp.userData.o = rnd(0.05, 0.12);
    scene.add(sp); fog.push(sp);
  }

  const geo = oswaftGeometry();

  // you
  const hero = makeOswaft(geo, ['#b8f6ff', '#d9b8ff'], 2.6);
  hero.material.uniforms.uAmp.value = 0.36;
  hero.renderOrder = 5;
  const heroGlow = makeGlow('#c9a0ff', 9, 0.16);
  scene.add(hero, heroGlow);
  const H = { pos: new THREE.Vector3(0, 0, 0), yaw: 0.6, pitch: 0, yawRate: 0, pitchRate: 0, roll: 0, boost: 0, fed: 0 };

  // the pod
  const MAX_POD = 14;
  const pod = [];
  for (let i = 0; i < MAX_POD; i++) {
    const scale = rnd(1.3, 2.3);
    const mesh = makeOswaft(geo, LOOKS[i % LOOKS.length], scale);
    mesh.visible = false;
    scene.add(mesh);
    const side = i % 2 ? 1 : -1, row = Math.floor(i / 2) + 1;
    pod.push({
      mesh, active: false, glow: 0, glowAt: -1,
      slot: new THREE.Vector3(side * (3 + row * 2.1) + rnd(-1, 1), rnd(-3, 2), -13 + row * 2.6 + rnd(-1.5, 1.5)),
      lag: rnd(1.0, 2.0), wob: Math.random() * 10,
      pos: new THREE.Vector3(), prev: new THREE.Vector3(), q: new THREE.Quaternion(),
    });
  }
  let podSize = 0;
  function joinPod(silent) {
    if (podSize >= MAX_POD) return;
    const m = pod[podSize++];
    m.active = true; m.mesh.visible = true;
    m.pos.copy(H.pos).add(new THREE.Vector3().randomDirection().multiplyScalar(silent ? rnd(8, 20) : 55));
    m.prev.copy(m.pos);
    m.glow = silent ? 0 : 1;
  }

  // far-off giants, for scale
  const giants = [];
  for (let i = 0; i < 5; i++) {
    const mesh = makeOswaft(geo, LOOKS[(i + 3) % LOOKS.length], rnd(10, 17), 0.55);
    mesh.material.uniforms.uAmp.value = 0.26;
    scene.add(mesh);
    giants.push({ mesh, R: rnd(150, 240), a: Math.random() * 6.28, y: rnd(-50, 50), w: rnd(0.012, 0.022) * (i % 2 ? 1 : -1), glow: 0 });
  }

  // motes of starlight to graze on
  const MOTES = 34, PER = 26;
  const mp = new Float32Array(PER * 3), ms = new Float32Array(PER), mph = new Float32Array(PER);
  for (let i = 0; i < PER; i++) {
    const d = new THREE.Vector3().randomDirection().multiplyScalar(Math.pow(Math.random(), 0.6) * 2.4);
    mp.set([d.x, d.y, d.z], i * 3); ms[i] = rnd(0.5, 1.6); mph[i] = Math.random();
  }
  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute('position', new THREE.BufferAttribute(mp, 3));
  moteGeo.setAttribute('aSize', new THREE.BufferAttribute(ms, 1));
  moteGeo.setAttribute('aPhase', new THREE.BufferAttribute(mph, 1));
  moteGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 20);
  const moteMat = new THREE.ShaderMaterial({
    vertexShader: MOTE_VERT, fragmentShader: MOTE_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uPx: { value: app.px }, uBurst: { value: 0 }, uFade: { value: 1 }, uColor: { value: new THREE.Color('#ffe2a0').multiplyScalar(1.5) } },
  });
  const placeMote = (m, near) => {
    const d = new THREE.Vector3().randomDirection();
    d.y *= 0.5;
    if (near) m.center.copy(H.pos).addScaledVector(d.normalize(), rnd(30, 80));
    else m.center.copy(d).multiplyScalar(rnd(15, 95));
    if (m.center.length() > 98) m.center.setLength(rnd(40, 95));
    m.burst = -1; m.fade = 0; m.pull = 0;
  };
  const motes = [];
  for (let i = 0; i < MOTES; i++) {
    const points = new THREE.Points(moteGeo, moteMat.clone());
    const glow = makeGlow('#ffd890', 5, 0.5);
    scene.add(points, glow);
    const m = { points, glow, center: new THREE.Vector3(), burst: -1, fade: 0, pull: 0 };
    placeMote(m, false);
    m.fade = 1;
    motes.push(m);
  }

  // song rings
  const songRings = [0, 1, 2].map(() => {
    const mesh = new THREE.Mesh(
      new THREE.RingGeometry(0.965, 1, 96),
      new THREE.MeshBasicMaterial({ color: new THREE.Color('#d9b8ff').multiplyScalar(1.6), transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    mesh.visible = false;
    scene.add(mesh);
    return { mesh, t: -10 };
  });

  // ---- state
  let starlight = 0, lastInput = -10, singCool = 0, leapCool = 0, saidJoin = false, started = false, leaping = false;
  const steerP = new THREE.Vector2(), steer = new THREE.Vector2();
  const fwd = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), camGoal = new THREE.Vector3(), look = new THREE.Vector3();
  const e = new THREE.Euler(0, 0, 0, 'YXZ'), q = new THREE.Quaternion(), v = new THREE.Vector3(), m4 = new THREE.Matrix4(), target = new THREE.Vector3();

  const showReadout = () => app.readout(`Starlight ${String(starlight).padStart(2, '0')} · Pod of ${podSize + 1}`);

  function sing() {
    if (singCool > 0) return;
    singCool = 1.4;
    songRings.forEach((r, i) => { r.t = -i * 0.16; r.mesh.position.copy(H.pos); });
    H.fed = Math.min(1.5, H.fed + 0.5);
    app.sound.chime(4, 220, 0.2);
    app.sound.chime(7, 220, 0.12, 0.12);
    const t = app.time;
    pod.forEach((p, i) => {
      if (!p.active) return;
      const d = p.pos.distanceTo(H.pos);
      p.glowAt = t + 0.25 + d * 0.035;
      app.sound.chime([0, 2, 4, 5, 7, 9][i % 6] + (i % 3) * 2, 220, 0.07, 0.3 + d * 0.035);
    });
    giants.forEach((g, i) => { g.glowAt = t + 1.2 + i * 0.3; app.sound.tone({ freq: 110 * [1, 1.125, 1.25, 1.5, 1.667][i], dur: 2.2, gain: 0.07, delay: 1.2 + i * 0.3 }); });
    for (const m of motes) if (m.burst < 0 && m.center.distanceTo(H.pos) < 48) m.pull = 3.2;
  }

  function leap() {
    if (leapCool > 0) return;
    leapCool = 2.2;
    H.boost = 78;
    app.sound.whoosh(0.7, true);
    app.sound.tone({ freq: 330, to: 990, dur: 0.5, gain: 0.08, type: 'triangle' });
    pod.forEach((p, i) => { if (p.active) p.glowAt = app.time + 0.15 + i * 0.06; });
  }

  const actions = [
    { id: 'sing', verb: 'Sing', how: 'Tap · Space', kind: 'tap', key: ' ', down: sing },
    { id: 'leap', verb: 'Leap', how: 'Tap · Shift', kind: 'tap', key: 'Shift', down: leap },
  ];

  function placeCamera(snap, dt) {
    const portrait = app.camera.aspect < 0.8;
    const dist = portrait ? 16 : 10.5, lift = portrait ? 6 : 4.6;
    camGoal.copy(H.pos).addScaledVector(fwd, -dist).addScaledVector(up, lift);
    v.copy(H.pos).addScaledVector(fwd, 4);
    if (snap) { app.camera.position.copy(camGoal); look.copy(v); }
    else {
      app.camera.position.lerp(camGoal, 1 - Math.exp(-dt * 2.6));
      look.lerp(v, 1 - Math.exp(-dt * 4.5));
    }
    app.camera.lookAt(look);
  }

  return {
    scene, actions,
    usesRig: false,
    usesArrows: true,
    enter() {
      if (!started) { started = true; for (let i = 0; i < 5; i++) joinPod(true); }
      e.set(H.pitch, H.yaw, 0);
      fwd.set(0, 0, -1).applyEuler(e);
      placeCamera(true, 0);
      showReadout();
    },
    leave() { H.boost = 0; leaping = false; },
    onPointerDown() { steerP.set(0, 0); lastInput = app.time; return true; },
    onPointerMove(ev, ndc, d) {
      steerP.set(clamp(d.ox / 90, -1, 1), clamp(d.oy / 90, -1, 1));
      lastInput = app.time;
    },
    onPointerUp() { steerP.set(0, 0); },
    async demo(cue) {
      cue.say('Sing, and the whole pod sings back.', 3.2);
      if (!(await cue.wait(1.2))) return;
      cue.press('sing');
      if (!(await cue.wait(3.5))) return;
      cue.press('leap');
      if (!(await cue.wait(3))) return;
      cue.press('sing');
      await cue.wait(4);
    },

    update(dt, t) {
      // ---- steering
      const K = app.keys;
      const kx = (K.has('d') || K.has('ArrowRight') ? 1 : 0) - (K.has('a') || K.has('ArrowLeft') ? 1 : 0);
      const ky = (K.has('s') || K.has('ArrowDown') ? 1 : 0) - (K.has('w') || K.has('ArrowUp') ? 1 : 0);
      if (kx || ky) lastInput = t;
      steer.set(clamp(steerP.x + kx, -1, 1), clamp(steerP.y + ky, -1, 1));
      if (t - lastInput > 4) {
        // nobody is steering: wander on your own
        steer.set(Math.sin(t * 0.23) * 0.45 + Math.sin(t * 0.11 + 1) * 0.3, Math.sin(t * 0.17) * 0.32 - H.pitch * 0.6);
      }
      const k = 1 - Math.exp(-dt * 4);
      H.yawRate += (-steer.x * 1.25 - H.yawRate) * k;
      H.pitchRate += (-steer.y * 0.9 - H.pitchRate) * k;
      H.yaw += H.yawRate * dt;
      H.pitch = clamp(H.pitch + H.pitchRate * dt, -1.05, 1.05);
      // stay inside the cave: curve gently back toward the middle near its walls
      const far = H.pos.length();
      if (far > 82) {
        const pull = clamp((far - 82) / 25, 0, 1);
        let dy = Math.atan2(H.pos.x, H.pos.z) - H.yaw;
        dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        H.yaw += dy * dt * 1.4 * pull;
        H.pitch += (-Math.asin(clamp(H.pos.y / far, -1, 1)) * 0.6 - H.pitch) * dt * 1.2 * pull;
      }
      H.roll += (H.yawRate * 0.5 - H.roll) * (1 - Math.exp(-dt * 5));
      H.boost *= Math.exp(-dt * 3.4);
      e.set(H.pitch, H.yaw, 0);
      fwd.set(0, 0, -1).applyEuler(e);
      H.pos.addScaledVector(fwd, (13 + H.boost) * dt);
      e.set(H.pitch, H.yaw, H.roll);
      hero.quaternion.setFromEuler(e);
      hero.position.copy(H.pos);
      const hu = hero.material.uniforms;
      H.fed = Math.max(0, H.fed - dt * 0.35);
      hu.uTime.value = t;
      hu.uLeap.value = H.boost / 78;
      hu.uGlow.value = H.fed * 0.5 + H.boost / 160;
      heroGlow.position.copy(H.pos);
      heroGlow.material.opacity = 0.14 + H.fed * 0.2;

      // ---- the leap borrows the hyperspace streaks for a moment
      const kick = H.boost / 78;
      if (kick > 0.01) { leaping = true; app.fovKick = kick * 17; app.warp.amount = kick * 0.42; }
      else if (leaping) { leaping = false; app.fovKick = 0; app.warp.amount = 0; }
      singCool = Math.max(0, singCool - dt);
      leapCool = Math.max(0, leapCool - dt);
      app.meter('leap', leapCool > 0 ? 1 - leapCool / 2.2 : 0);
      app.meter('sing', singCool > 0 ? 1 - singCool / 1.4 : 0);

      // ---- pod
      q.setFromEuler(e.set(H.pitch, H.yaw, 0));
      for (const p of pod) {
        if (!p.active) continue;
        target.copy(p.slot);
        target.x += Math.sin(t * 0.4 + p.wob) * 1.4; target.y += Math.cos(t * 0.33 + p.wob * 2) * 1.2;
        target.applyQuaternion(q).add(H.pos);
        p.prev.copy(p.pos);
        p.pos.lerp(target, 1 - Math.exp(-dt * p.lag * (1 + kick * 2)));
        v.copy(p.pos).sub(p.prev);
        if (v.lengthSq() > 1e-6) {
          m4.lookAt(p.prev, p.pos, up);
          p.q.setFromRotationMatrix(m4);
          p.mesh.quaternion.slerp(p.q, 1 - Math.exp(-dt * 4));
        }
        p.mesh.position.copy(p.pos);
        if (p.glowAt > 0 && t >= p.glowAt) { p.glow = 1; p.glowAt = -1; }
        p.glow = Math.max(0, p.glow - dt * 0.9);
        const u = p.mesh.material.uniforms;
        u.uTime.value = t; u.uGlow.value = p.glow;
      }

      // ---- giants
      for (const g of giants) {
        g.a += g.w * dt;
        g.mesh.position.set(Math.cos(g.a) * g.R, g.y + Math.sin(t * 0.08 + g.R) * 12, Math.sin(g.a) * g.R);
        v.set(-Math.sin(g.a), 0, Math.cos(g.a)).multiplyScalar(Math.sign(g.w)).add(g.mesh.position);
        m4.lookAt(g.mesh.position, v, up);
        g.mesh.quaternion.setFromRotationMatrix(m4);
        if (g.glowAt > 0 && t >= g.glowAt) { g.glow = 1; g.glowAt = -1; }
        g.glow = Math.max(0, g.glow - dt * 0.5);
        g.mesh.material.uniforms.uTime.value = t;
        g.mesh.material.uniforms.uGlow.value = g.glow;
      }

      // ---- motes
      for (const m of motes) {
        const u = m.points.material.uniforms;
        if (m.burst >= 0) {
          m.burst += dt / 0.9;
          if (m.burst >= 1) placeMote(m, true);
        } else {
          m.fade = Math.min(1, m.fade + dt * 0.6);
          if (m.pull > 0) {
            m.pull -= dt;
            v.copy(H.pos).sub(m.center);
            const d = v.length();
            if (d > 0.5) m.center.addScaledVector(v, Math.min(1, (26 * dt) / d));
          }
          if (m.center.distanceToSquared(H.pos) < 30) {
            m.burst = 0;
            starlight++;
            H.fed = Math.min(1.5, H.fed + 0.7);
            app.sound.chime(starlight % 9, 330, 0.12);
            if (starlight % 4 === 0 && podSize < MAX_POD) {
              joinPod(false);
              if (!saidJoin) { saidJoin = true; app.toast('Another Oswaft has joined your pod.', 3); }
            }
            showReadout();
          }
        }
        m.points.position.copy(m.center);
        m.glow.position.copy(m.center);
        u.uTime.value = t; u.uBurst.value = Math.max(0, m.burst); u.uFade.value = m.fade;
        m.glow.material.opacity = (m.burst >= 0 ? 1 - m.burst : m.fade) * 0.45;
        m.glow.scale.setScalar(m.burst >= 0 ? 5 + m.burst * 26 : 5 + Math.sin(t * 2 + m.center.x) * 0.8);
      }

      // ---- song rings
      for (const r of songRings) {
        if (r.t < -5) continue;
        r.t += dt;
        const kk = r.t / 2.0;
        if (kk < 0) continue;
        if (kk >= 1) { r.mesh.visible = false; r.t = -10; continue; }
        r.mesh.visible = true;
        r.mesh.quaternion.copy(app.camera.quaternion);
        r.mesh.scale.setScalar(2 + 52 * app.easeOut(kk));
        r.mesh.material.opacity = (1 - kk) * 0.85;
      }

      // ---- camera, fog, sky
      placeCamera(false, dt);
      for (const f of fog) {
        const d = f.position.distanceTo(app.camera.position);
        f.material.opacity = f.userData.o * THREE.MathUtils.smoothstep(d, 20, 70);
      }
      sky.follow(app.camera);
      stars.update(app.camera, t, app.px);
    },
  };
}
