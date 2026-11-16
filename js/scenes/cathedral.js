// The Cathedral of Winds: a crystal organ the size of a mountain, played by the storm.
// The wind sweeps down the nave like the playhead of a music box. Every open spire it
// passes sings. Tap spires to open or close them; hold to call the storm.
import * as THREE from 'three';
import { makeSky, makeSun, makeGlow } from '../core/sky.js';
import { NOISE } from '../core/glsl.js';

export const meta = {
  id: 'cathedral',
  name: 'The Cathedral of Winds',
  tag: 'A crystal organ played by the storm',
  blurb: 'On a world of endless storms, a winged people raised a cathedral of crystal pipes as tall as a mountain. When the wind blows through it, it sings. They have never let anyone record the song.',
  since: 1994,
  accent: '#9fe4ff',
  isNew: true,
  hint: 'Tap a spire to open it. The wind plays every open spire it sweeps past. Hold to call the storm.',
  bloom: { strength: 0.6, radius: 0.65, threshold: 0.7 },
  drone: 0,
};

const BAYS = 12, STEPS = 16, SPACING = 2.7;
const bayX = (i) => (i - (BAYS - 1) / 2) * SPACING;

// Three rows, stepped like a choir: deep voices at the back, bright ones in front.
// `notes` are steps on a five-note scale, so any mix of open spires sounds good together.
const ROWS = [
  { z: -3.6, radius: 0.95, top: 22.0, drop: 1.15, base: 0, gain: 0.15, tint: '#7f90ff', notes: [4, 2, 5, 3, 1, 4, 0, 3, 1, 5, 2, 4] },
  { z: 0.1, radius: 0.68, top: 14.0, drop: 0.7, base: 7, gain: 0.1, tint: '#7fe0ff', notes: [2, 4, 1, 3, 5, 2, 6, 4, 7, 3, 5, 1] },
  { z: 3.6, radius: 0.5, top: 8.6, drop: 0.55, base: 13, gain: 0.065, tint: '#ffe6b0', notes: [2, 0, 3, 1, 4, 2, 5, 3, 1, 4, 2, 6] },
];
const SCALE = [0, 2, 4, 7, 9];
const pitch = (n) => 73.42 * Math.pow(2, Math.floor(n / 5) + SCALE[n % 5] / 12);
const OPENING = [[0, 6, 9], [2, 4, 7, 10], [3, 5, 8, 11]];

const CRYSTAL_VERT = /* glsl */ `
attribute float aOpen;
attribute float aRing;
attribute vec3 aTint;
varying vec3 vWP;
varying float vH;
varying float vOpen;
varying float vRing;
varying vec3 vTint;
void main(){
  vH = position.y; vOpen = aOpen; vRing = aRing; vTint = aTint;
  vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vWP = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;
const CRYSTAL_FRAG = /* glsl */ `
varying vec3 vWP;
varying float vH;
varying float vOpen;
varying float vRing;
varying vec3 vTint;
uniform vec3 uSunDir, uSunColor, uSkyHigh, uHorizon, uLand;
uniform float uFlash;
${NOISE}
// the storm sky as a crystal would mirror it: dark plain, glowing horizon, indigo overhead
vec3 skyEnv(vec3 d){
  vec3 c = mix(uLand, uHorizon, smoothstep(-0.3, 0.0, d.y));
  c = mix(c, uSkyHigh, smoothstep(0.0, 0.55, d.y));
  return c + uSunColor * pow(max(dot(d, uSunDir), 0.0), 5.0) * 0.9;
}
void main(){
  vec3 N = normalize(cross(dFdx(vWP), dFdy(vWP)));
  vec3 V = normalize(cameraPosition - vWP);
  if (dot(N, V) < 0.0) N = -N;
  float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  vec3 R = reflect(-V, N);
  vec3 refl = skyEnv(R);
  float diff = max(dot(N, uSunDir), 0.0);
  if (vOpen < -0.5) {
    // the plinth: plain dark rock
    vec3 rock = vec3(0.045, 0.05, 0.075) * (0.5 + 1.3 * diff) + refl * fres * 0.3;
    gl_FragColor = vec4(rock * (1.0 + uFlash), 1.0);
    return;
  }
  vec3 thru = skyEnv(refract(-V, N, 0.72));                       // what shows through the crystal
  float flaw = snoise(vec3(vWP.x * 1.4, vH * 5.0 + vWP.z, vWP.z * 1.4));
  vec3 glass = thru * vTint * (0.56 + 0.16 * flaw) + refl * (0.14 + 0.86 * fres);
  glass *= 0.45 + 0.7 * vH;                                       // light gathers toward the tip
  glass += uSunColor * pow(max(dot(R, uSunDir), 0.0), 40.0) * 1.8;
  // light held inside an open spire, and the pulse that climbs it when it sings
  float core = vOpen * (0.3 + 0.6 * vH) * (1.0 - fres * 0.5) * (0.8 + 0.2 * flaw);
  float climb = vRing * exp(-pow((vH - (1.05 - vRing)) / 0.22, 2.0)) * 3.2;
  vec3 glow = mix(vTint, vec3(1.0), 0.3) * (core + climb + vRing * 0.55);
  gl_FragColor = vec4(glass + glow + refl * uFlash * 0.9, 1.0);
}
`;

const GROUND_VERT = /* glsl */ `
varying vec3 vWP;
void main(){
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWP = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;
const GROUND_FRAG = /* glsl */ `
varying vec3 vWP;
uniform float uTime, uWind, uFront, uFlash;
uniform vec3 uFog, uSunColor;
${NOISE}
void main(){
  vec2 p = vWP.xz;
  float gust = snoise(vec3(p.x * 0.045 - uTime * (0.5 + uWind * 1.6), p.y * 0.07, uTime * 0.08));
  float ripple = snoise(vec3(p.x * 0.3 - uTime * (2.0 + uWind * 5.0), p.y * 0.42, 2.0));
  float tuft = snoise(vec3(p * 1.3, 5.0));
  vec3 col = mix(vec3(0.012, 0.05, 0.055), vec3(0.045, 0.15, 0.12), 0.5 + 0.3 * tuft + 0.25 * gust);
  // silver crests where the grass bends
  col += vec3(0.1, 0.16, 0.15) * pow(max(gust * 0.6 + ripple * 0.4, 0.0), 2.0) * (0.5 + uWind);
  // the gust front that plays the cathedral
  float lane = 1.0 - smoothstep(8.0, 15.0, abs(p.y));
  float front = exp(-pow((p.x - uFront) / 1.3, 2.0)) * lane;
  col += vec3(0.3, 0.55, 0.65) * front * 0.55;
  // bare rock under the spires
  float rise = length(p * vec2(0.052, 0.14));
  col = mix(vec3(0.025, 0.03, 0.045), col, smoothstep(0.8, 1.2, rise));
  col *= mix(vec3(1.0), uSunColor * 1.6, 0.3);
  col += uFlash * vec3(0.1, 0.12, 0.18);
  float dist = length(vWP - cameraPosition);
  col = mix(col, uFog, 1.0 - exp(-dist * 0.0085));
  gl_FragColor = vec4(col, 1.0);
}
`;

const STREAK_VERT = /* glsl */ `
attribute float aEnd;
attribute float aSpeed;
uniform float uTravel, uLen;
varying float vA;
void main(){
  vec3 p = position;
  float x = mod(p.x + uTravel * aSpeed, 140.0) - 70.0;
  float edge = smoothstep(-70.0, -52.0, x) * (1.0 - smoothstep(52.0, 70.0, x));
  x -= aEnd * uLen * aSpeed;
  vA = (1.0 - aEnd) * edge;
  gl_Position = projectionMatrix * viewMatrix * vec4(x, p.y, p.z, 1.0);
}
`;
const STREAK_FRAG = /* glsl */ `
uniform float uOpacity;
varying float vA;
void main(){ gl_FragColor = vec4(vec3(0.75, 0.9, 1.0) * vA * uOpacity, 1.0); }
`;

const WING_VERT = /* glsl */ `
uniform float uTime, uPhase;
void main(){
  vec3 p = position;
  p.y += abs(p.x) * sin(uTime * 2.6 + uPhase) * 0.38;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`;

export function create(app) {
  const scene = new THREE.Scene();
  const sky = makeSky(app.renderer, {
    a: '#1a2a66', b: '#472a70', c: '#ff9a62', base: '#070a1a', density: 0.82, dust: 0.55, gain: 0.85, seed: 9.3, scale: 1.15,
    band: 0.9, focus: [0, 1, 0],
  });
  const sun = makeSun('#ffb37a', 250);
  sun.dir.set(-0.55, 0.09, -0.8).normalize();
  sun.core.material.depthTest = sun.halo.material.depthTest = true;
  scene.add(sky.mesh, sun.group);

  const shared = {
    uSunDir: { value: sun.dir.clone() }, uSunColor: { value: new THREE.Color('#ffb37a') },
    uSkyHigh: { value: new THREE.Color('#2c3a7a') }, uHorizon: { value: new THREE.Color('#d08f86') }, uLand: { value: new THREE.Color('#0b2626') },
    uFlash: { value: 0 },
  };
  const crystalMat = () => new THREE.ShaderMaterial({ vertexShader: CRYSTAL_VERT, fragmentShader: CRYSTAL_FRAG, uniforms: shared, side: THREE.DoubleSide });

  // ---- the spires: the first 36 are playable, the rest are a scatter of shards around the base
  const spireGeo = new THREE.LatheGeometry([[0.92, 0], [1, 0.03], [0.8, 0.88], [0, 1]].map(([r, y]) => new THREE.Vector2(r, y)), 6);
  const spires = [];
  for (let r = 0; r < ROWS.length; r++) {
    const row = ROWS[r];
    for (let i = 0; i < BAYS; i++) {
      const n = row.base + row.notes[i];
      spires.push({
        row: r, bay: i, freq: pitch(n), gain: row.gain,
        height: row.top - row.notes[i] * row.drop, radius: row.radius,
        x: bayX(i), z: row.z + Math.sin(i * 2.3 + r) * 0.35,
        open: OPENING[r].includes(i), openShown: 0, ring: 0, tint: new THREE.Color(row.tint),
      });
    }
  }
  const PLAYABLE = spires.length, SHARDS = 76, TOTAL = PLAYABLE + SHARDS;
  const mesh = new THREE.InstancedMesh(spireGeo, crystalMat(), TOTAL);
  const aOpen = new Float32Array(TOTAL), aRing = new Float32Array(TOTAL), aTint = new Float32Array(TOTAL * 3);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), pos = new THREE.Vector3(), scl = new THREE.Vector3();
  spires.forEach((s, i) => {
    e.set((Math.random() - 0.5) * 0.06, Math.random() * 6.28, (Math.random() - 0.5) * 0.06);
    mesh.setMatrixAt(i, m4.compose(pos.set(s.x, 0.6, s.z), q.setFromEuler(e), scl.set(s.radius, s.height, s.radius)));
    aTint.set([s.tint.r, s.tint.g, s.tint.b], i * 3);
  });
  const shardTint = new THREE.Color('#5d6fa8');
  for (let i = PLAYABLE; i < TOTAL; i++) {
    // shards crowd the foot of the cathedral and thin out across the plain
    const a = Math.random() * 6.28, d = 0.88 + Math.pow(Math.random(), 2.2) * 1.1;
    const x = Math.cos(a) * 19 * d, z = Math.sin(a) * 7 * d;
    const h = 0.8 + Math.pow(Math.random(), 2) * 4.5;
    e.set((Math.random() - 0.5) * 0.7, Math.random() * 6.28, (Math.random() - 0.5) * 0.7);
    mesh.setMatrixAt(i, m4.compose(pos.set(x, -0.1, z), q.setFromEuler(e), scl.set(0.18 + h * 0.07, h, 0.18 + h * 0.07)));
    aTint.set([shardTint.r, shardTint.g, shardTint.b], i * 3);
  }
  spireGeo.setAttribute('aOpen', new THREE.InstancedBufferAttribute(aOpen, 1));
  spireGeo.setAttribute('aRing', new THREE.InstancedBufferAttribute(aRing, 1));
  spireGeo.setAttribute('aTint', new THREE.InstancedBufferAttribute(aTint, 3));
  mesh.frustumCulled = false;
  scene.add(mesh);

  // stepped plinth
  const slabGeo = new THREE.CylinderGeometry(1, 1.06, 1, 6);
  slabGeo.setAttribute('aOpen', new THREE.InstancedBufferAttribute(new Float32Array([-1, -1, -1]), 1));
  slabGeo.setAttribute('aRing', new THREE.InstancedBufferAttribute(new Float32Array(3), 1));
  slabGeo.setAttribute('aTint', new THREE.InstancedBufferAttribute(new Float32Array([0.16, 0.19, 0.3, 0.16, 0.19, 0.3, 0.16, 0.19, 0.3]), 3));
  const slabs = new THREE.InstancedMesh(slabGeo, crystalMat(), 3);
  [[19.5, 0.3, 7.6, 0.05], [18.2, 0.3, 6.4, 0.32], [17.2, 0.25, 5.4, 0.58]].forEach(([sx, sy, sz, y], i) => {
    slabs.setMatrixAt(i, m4.compose(pos.set(0, y, 0), q.identity(), scl.set(sx, sy, sz)));
  });
  slabs.frustumCulled = false;
  scene.add(slabs);

  // a spark at the tip of every playable spire
  const tips = spires.map((s) => {
    const g = makeGlow(s.tint, 2.2, 0);
    g.position.set(s.x, 0.6 + s.height, s.z);
    scene.add(g);
    return g;
  });

  // ---- the plain
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(520, 72).rotateX(-Math.PI / 2),
    new THREE.ShaderMaterial({
      vertexShader: GROUND_VERT, fragmentShader: GROUND_FRAG,
      uniforms: {
        uTime: { value: 0 }, uWind: { value: 0 }, uFront: { value: -100 }, uFlash: shared.uFlash,
        uFog: { value: new THREE.Color('#5d4668') }, uSunColor: shared.uSunColor,
      },
    }),
  );
  scene.add(ground);

  // ---- wind you can see
  const NS = 520;
  const sp = new Float32Array(NS * 6), se = new Float32Array(NS * 2), ss = new Float32Array(NS * 2);
  for (let i = 0; i < NS; i++) {
    const x = Math.random() * 140, y = 0.4 + Math.pow(Math.random(), 1.5) * 26, z = (Math.random() - 0.5) * 70;
    sp.set([x, y, z, x, y, z], i * 6); se.set([0, 1], i * 2);
    const v = 0.6 + Math.random() * 0.8; ss.set([v, v], i * 2);
  }
  const streakGeo = new THREE.BufferGeometry();
  streakGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  streakGeo.setAttribute('aEnd', new THREE.BufferAttribute(se, 1));
  streakGeo.setAttribute('aSpeed', new THREE.BufferAttribute(ss, 1));
  const streaks = new THREE.LineSegments(streakGeo, new THREE.ShaderMaterial({
    vertexShader: STREAK_VERT, fragmentShader: STREAK_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTravel: { value: 0 }, uLen: { value: 2 }, uOpacity: { value: 0.15 } },
  }));
  streaks.frustumCulled = false;
  scene.add(streaks);

  // ---- the winged people who built it, wheeling overhead
  const wingGeo = new THREE.BufferGeometry();
  wingGeo.setAttribute('position', new THREE.Float32BufferAttribute([
    -1, 0, 0.12, 0, 0, -0.22, 0, 0, 0.3,
    1, 0, 0.12, 0, 0, 0.3, 0, 0, -0.22,
  ], 3));
  const flyers = Array.from({ length: 10 }, (_, i) => {
    const mat = new THREE.ShaderMaterial({
      vertexShader: WING_VERT, fragmentShader: 'void main(){ gl_FragColor = vec4(0.62, 0.75, 0.9, 1.0); }',
      side: THREE.DoubleSide, uniforms: { uTime: { value: 0 }, uPhase: { value: i * 1.7 } },
    });
    const m = new THREE.Mesh(wingGeo, mat);
    m.scale.setScalar(0.7 + Math.random() * 0.5);
    m.frustumCulled = false;
    scene.add(m);
    return { m, R: 9 + Math.random() * 26, y: 9 + Math.random() * 18, a: Math.random() * 6.28, w: (0.1 + Math.random() * 0.14) * (i % 2 ? 1 : -1) };
  });

  // ---- state
  let step = 0, storm = 0, calling = false, flash = 0, nextBolt = 3, concert = false, said = false;
  const v = new THREE.Vector3();
  const moods = ['A light breeze', 'The wind is rising', 'A full gale', 'The storm concert'];
  const showReadout = () => {
    const open = spires.filter((s) => s.open).length;
    const mood = storm > 0.85 ? 3 : storm > 0.5 ? 2 : storm > 0.15 ? 1 : 0;
    app.readout(`${String(open).padStart(2, '0')} of ${PLAYABLE} spires open · ${moods[mood]}`);
  };

  function sing(s, level = 1, delay = 0) {
    s.ring = Math.max(s.ring, level);
    app.sound.pipe(s.freq, { gain: s.gain * level, delay, dur: 2.2 + (2 - s.row) * 0.5 });
  }

  const actions = [
    {
      id: 'storm', verb: 'Call the storm', how: 'Hold', kind: 'hold', key: ' ',
      down() { calling = true; },
      up() { calling = false; },
    },
    {
      id: 'melody', verb: 'New melody', how: 'Tap', kind: 'tap', key: 'n',
      down() {
        const odds = [0.22, 0.36, 0.36];
        spires.forEach((s) => { s.open = Math.random() < odds[s.row]; });
        spires[0].open = true;
        app.sound.blip();
        showReadout();
      },
    },
    {
      id: 'hush', verb: 'Hush', how: 'Close them all', kind: 'tap', key: 'h',
      down() { spires.forEach((s) => { s.open = false; }); showReadout(); },
    },
  ];

  function spireAt(ndc) {
    const hit = app.pick(ndc, [mesh])[0];
    if (hit && hit.instanceId < PLAYABLE) return spires[hit.instanceId];
    // a near miss still counts: thin spires are hard to hit on a phone
    const W = app.width, H = app.height, x = (ndc.x * 0.5 + 0.5) * W, y = (-ndc.y * 0.5 + 0.5) * H;
    let best = null, bestD = 30;
    for (const s of spires) {
      for (const f of [0.35, 0.7]) {
        v.set(s.x, 0.6 + s.height * f, s.z).project(app.camera);
        const d = Math.hypot((v.x * 0.5 + 0.5) * W - x, (-v.y * 0.5 + 0.5) * H - y);
        if (d < bestD) { best = s; bestD = d; }
      }
    }
    return best;
  }

  function frameShot() {
    const portrait = app.camera.aspect < 0.8;
    app.rig.fit = portrait ? 1.45 : Math.max(1, 1.5 / app.camera.aspect);
  }

  return {
    scene, actions,
    enter() {
      const portrait = app.camera.aspect < 0.8;
      app.rig.set({
        target: new THREE.Vector3(0, 8.5, 0), theta: portrait ? 0.95 : 0.42, phi: 1.66, radius: 36, snap: true,
        auto: app.reduced ? 0 : 0.018, minPhi: 0.45, maxPhi: 1.78, minRadius: 15, maxRadius: 90, damping: 4, minY: 1.4,
      });
      frameShot();
      showReadout();
    },
    leave() { app.sound.stopWind(); calling = false; app.bloomKick = 0; },
    resize: frameShot,
    onTap(ndc) {
      const s = spireAt(ndc);
      if (!s) return;
      s.open = !s.open;
      if (s.open) sing(s, 1); else app.sound.tone({ freq: s.freq * 2, dur: 0.12, gain: 0.03, type: 'triangle' });
      showReadout();
    },
    update(dt, t) {
      // ---- weather
      const was = storm;
      storm = calling ? Math.min(1, storm + dt / 3.2) : Math.max(0, storm - dt / 5);
      app.meter('storm', storm, storm > 0.85);
      if ((was > 0.85) !== (storm > 0.85) || (was > 0.5) !== (storm > 0.5) || (was > 0.15) !== (storm > 0.15)) showReadout();
      if (storm > 0.85 && !concert) {
        concert = true;
        if (!said) { said = true; app.toast('Every spire answers. This is the concert nobody may record.', 4.5); }
      } else if (storm < 0.8) concert = false;
      if (!app.sound.windNodes) app.sound.startWind();
      app.sound.setWind(0.12 + storm * 0.88);

      // lightning, once the storm has built
      nextBolt -= dt * (storm > 0.55 ? 1 : 0);
      if (nextBolt <= 0) {
        nextBolt = 1.2 + Math.random() * 3.5;
        flash = 1;
        app.flash(0.1, 0.4, '#dfe8ff');
        app.sound.noise({ dur: 2.6, gain: 0.3, from: 900, to: 50, type: 'lowpass', q: 0.3, delay: 0.45, attack: 0.02 });
        app.sound.tone({ freq: 70, to: 28, dur: 2.2, gain: 0.3, delay: 0.45 });
      }
      flash = Math.max(0, flash - dt * 4);
      shared.uFlash.value = flash;
      sky.material.uniforms.uFade.value = 1 + flash * 2.4 + storm * 0.15;

      // ---- the wind is the playhead
      const before = Math.floor(step);
      step += dt / (0.46 - storm * 0.25);
      const now = Math.floor(step);
      for (let k = before + 1; k <= now; k++) {
        const bay = k % STEPS;
        if (bay >= BAYS) continue;
        for (const s of spires) {
          if (s.bay !== bay) continue;
          if (s.open) sing(s, 1);
          else if (concert) sing(s, 0.42);
        }
      }
      const front = bayX(0) + (step % STEPS) * SPACING;

      // ---- crystals
      for (let i = 0; i < PLAYABLE; i++) {
        const s = spires[i];
        s.openShown += ((s.open ? 1 : 0) - s.openShown) * (1 - Math.exp(-dt * 6));
        s.ring *= Math.exp(-dt * 1.5);
        aOpen[i] = s.openShown; aRing[i] = s.ring;
        tips[i].material.opacity = Math.min(1, s.ring * 1.2) * 0.9 + s.openShown * 0.12;
        tips[i].scale.setScalar(1.6 + s.ring * 3.2);
      }
      spireGeo.attributes.aOpen.needsUpdate = true;
      spireGeo.attributes.aRing.needsUpdate = true;

      // ---- plain, wind, flyers
      const gu = ground.material.uniforms;
      gu.uTime.value = t; gu.uWind.value = storm; gu.uFront.value = front;
      const su = streaks.material.uniforms;
      su.uTravel.value += dt * (7 + storm * 46);
      su.uLen.value = 1.4 + storm * 7.5;
      su.uOpacity.value = 0.13 + storm * 0.4;
      for (const f of flyers) {
        f.a += f.w * dt * (1 + storm);
        f.m.position.set(Math.cos(f.a) * f.R, f.y + Math.sin(t * 0.5 + f.R) * 1.5, Math.sin(f.a) * f.R * 0.6);
        v.set(-Math.sin(f.a) * f.R, 0, Math.cos(f.a) * f.R * 0.6).multiplyScalar(Math.sign(f.w)).add(f.m.position);
        f.m.lookAt(2 * f.m.position.x - v.x, f.m.position.y, 2 * f.m.position.z - v.z);
        f.m.material.uniforms.uTime.value = t;
      }

      app.bloomKick = storm * 0.25 + flash * 0.4;
      sky.follow(app.camera);
      sun.follow(app.camera);
    },
  };
}
