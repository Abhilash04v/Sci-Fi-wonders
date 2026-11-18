// Cloud City: a mining town floating in the sky of a gas giant, held up on one long stalk.
// Hold to turn the sun through sunset and night. Ride a cloud car around the city.
import * as THREE from 'three';
import { makeGlow } from '../core/sky.js';
import { NOISE } from '../core/glsl.js';

export const meta = {
  id: 'cloudcity',
  name: 'Cloud City',
  tag: 'A city floating in a gas giant’s sky',
  blurb: 'A mining town that floats high in the clouds of a giant gas planet, held up on a single stalk. Below it the clouds go down for thousands of kilometres, and at sunset the whole sky turns pink.',
  legend: true,
  screen: 1980,
  isNew: true,
  accent: '#ff9f8a',
  hint: 'Hold to turn the sun. Ride a cloud car and drag to steer it around the city.',
  bloom: { strength: 0.55, radius: 0.6, threshold: 0.78 },
  scrim: 0.7,
  drone: 69.3,
};

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const rnd = (a, b) => a + Math.random() * (b - a);
const SUN_AZ = new THREE.Vector3(-0.55, 0, -0.83).normalize();
const DECK = -62, SPACING = 30;

// light and colour through one day, keyed by the sun's height in degrees
const KEYS = [
  { e: -30, zen: '#03050d', hor: '#10162c', sun: '#8a9cc8', lit: '#384260', shade: '#121828', amb: '#1a2238' },
  { e: -8, zen: '#141a40', hor: '#5a3458', sun: '#ff6a4a', lit: '#7a5272', shade: '#2e2440', amb: '#3a2c50' },
  { e: 2, zen: '#353a80', hor: '#ff8a6e', sun: '#ff8a5a', lit: '#ffa48e', shade: '#6e4a78', amb: '#8a5a80' },
  { e: 12, zen: '#4672c0', hor: '#ffd2a0', sun: '#ffd08a', lit: '#ffe4c2', shade: '#8a7f98', amb: '#a8a0b8' },
  { e: 45, zen: '#3b7dd6', hor: '#c2dcf4', sun: '#fff6ea', lit: '#ffffff', shade: '#93a6c0', amb: '#a9c2e0' },
].map((k) => ({ e: k.e, c: Object.fromEntries(Object.entries(k).filter(([n]) => n !== 'e').map(([n, v]) => [n, new THREE.Color(v)])) }));

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const SKY_FRAG = /* glsl */ `
varying vec3 vDir;
uniform vec3 uZenith, uHorizon, uSunDir, uSunCol, uMoonA, uMoonB;
uniform float uNight, uSunVis;
float hash3(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
void main(){
  vec3 d = normalize(vDir);
  float y = d.y;
  vec3 col = mix(uHorizon, uZenith, pow(clamp(y, 0.0, 1.0), 0.45));
  if (y < 0.0) col = uHorizon;
  float sd = max(dot(d, uSunDir), 0.0);
  col += uSunCol * (pow(sd, 1200.0) * 30.0 * uSunVis + pow(sd, 14.0) * 0.5 + pow(sd, 3.0) * 0.16);
  vec3 sp = d * 170.0, cell = floor(sp);
  float st = step(0.986, hash3(cell)) * (1.0 - smoothstep(0.0, 0.45, length(fract(sp) - 0.5)));
  col += vec3(0.9, 0.95, 1.0) * st * uNight * smoothstep(0.02, 0.3, y) * (0.6 + 1.2 * hash3(cell + 3.0));
  float ma = dot(d, normalize(uMoonA)), mb = dot(d, normalize(uMoonB));
  col += vec3(0.95, 0.9, 0.82) * (smoothstep(0.99955, 0.9997, ma) + pow(max(ma, 0.0), 300.0) * 0.25) * uNight;
  col += vec3(0.8, 0.88, 1.0) * (smoothstep(0.99985, 0.9999, mb) + pow(max(mb, 0.0), 500.0) * 0.2) * uNight;
  gl_FragColor = vec4(col, 1.0);
}
`;

const DECK_VERT = /* glsl */ `
uniform float uTime;
varying vec3 vWP;
varying vec3 vNrm;
varying float vH;
${NOISE}
float cloudH(vec2 p){
  float h = fbm(vec3(p * 0.0062 + vec2(uTime * 0.006, 0.0), uTime * 0.008)) * 0.5 + 0.5;
  float big = fbm3(vec3(p * 0.0017 + vec2(uTime * 0.002, 0.0), 3.0));
  return h * h * 28.0 + max(big, 0.0) * 34.0;
}
void main(){
  vec3 wp = (modelMatrix * vec4(position, 1.0)).xyz;
  float h = cloudH(wp.xz);
  float e = 7.0;
  vNrm = normalize(vec3(-(cloudH(wp.xz + vec2(e, 0.0)) - h), e, -(cloudH(wp.xz + vec2(0.0, e)) - h)));
  wp.y += h;
  vH = h;
  vWP = wp;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}
`;
const DECK_FRAG = /* glsl */ `
varying vec3 vWP;
varying vec3 vNrm;
varying float vH;
uniform vec3 uLightDir, uLit, uShade, uHorizon, uSunCol;
uniform float uTime, uFogK;
${NOISE}
void main(){
  vec3 N = normalize(vNrm);
  float fine = snoise(vec3(vWP.xz * 0.045, uTime * 0.04)) * 0.5 + 0.5;
  float lam = clamp(dot(N, uLightDir) * 0.6 + 0.45, 0.0, 1.0);
  float hgt = clamp(vH / 60.0, 0.0, 1.0);
  vec3 col = mix(uShade, uLit, lam * (0.5 + 0.5 * hgt)) * (0.86 + 0.14 * fine);
  vec3 V = normalize(cameraPosition - vWP);
  col += uSunCol * pow(max(dot(-V, uLightDir), 0.0), 8.0) * (1.0 - lam * 0.6) * 0.5;
  float dist = length(vWP.xz - cameraPosition.xz);
  col = mix(col, uHorizon, clamp(1.0 - exp(-dist * uFogK), 0.0, 1.0));
  gl_FragColor = vec4(col, 1.0);
}
`;

const PUFF_VERT = /* glsl */ `
attribute float aSeed;
varying vec3 vN;
varying vec3 vWP;
${NOISE}
void main(){
  vec3 n = normalize(position);
  float d = snoise(n * 1.5 + aSeed * 10.0) * 0.12 + snoise(n * 3.0 + aSeed * 3.0) * 0.035;
  vec4 wp = modelMatrix * instanceMatrix * vec4(position + n * d, 1.0);
  vWP = wp.xyz;
  vN = normalize(mat3(modelMatrix * instanceMatrix) * n);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;
const PUFF_FRAG = /* glsl */ `
varying vec3 vN;
varying vec3 vWP;
uniform vec3 uLightDir, uLit, uShade, uHorizon, uSunCol;
uniform float uFogK;
void main(){
  vec3 N = normalize(vN);
  float lam = clamp(dot(N, uLightDir) * 0.55 + 0.5, 0.0, 1.0);
  float base = smoothstep(${DECK.toFixed(1)}, ${(DECK + 160).toFixed(1)}, vWP.y);
  vec3 col = mix(uShade * 0.85, uLit, lam * (0.45 + 0.55 * base));
  vec3 V = normalize(cameraPosition - vWP);
  float rim = pow(1.0 - max(dot(N, V), 0.0), 2.0);
  col += uSunCol * rim * pow(max(dot(-V, uLightDir), 0.0), 2.0) * 0.8;
  col = mix(col, uLit * 0.9 + uHorizon * 0.25, rim * 0.35);
  float dist = length(vWP - cameraPosition);
  col = mix(col, uHorizon, clamp(1.0 - exp(-dist * uFogK), 0.0, 1.0));
  gl_FragColor = vec4(col, 1.0);
}
`;

const CITY_VERT = /* glsl */ `
varying vec3 vWP;
varying vec3 vN;
void main(){
  mat4 m = modelMatrix;
  #ifdef USE_INSTANCING
    m = modelMatrix * instanceMatrix;
  #endif
  vec4 wp = m * vec4(position, 1.0);
  vWP = wp.xyz;
  vN = normalize(mat3(m) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;
const CITY_FRAG = /* glsl */ `
varying vec3 vWP;
varying vec3 vN;
uniform vec3 uLightDir, uSunCol, uAmb, uHorizon, uBase;
uniform float uLights, uBands, uFogK;
void main(){
  vec3 N = normalize(vN);
  float diff = max(dot(N, uLightDir), 0.0);
  vec3 col = uBase * (uSunCol * diff * 1.05 + uAmb * (0.42 + 0.3 * N.y));
  float wall = 1.0 - smoothstep(0.55, 0.8, abs(N.y));
  float row = step(0.8, fract(vWP.y * 0.75)) * wall * uBands;
  float pane = step(0.35, fract((vWP.x + vWP.z) * 1.6));
  col = mix(col, col * 0.55 + vec3(0.02, 0.03, 0.05), row * 0.45);
  col += vec3(1.0, 0.74, 0.44) * row * pane * uLights * 1.2;
  float dist = length(vWP - cameraPosition);
  col = mix(col, uHorizon, clamp(1.0 - exp(-dist * uFogK), 0.0, 1.0));
  gl_FragColor = vec4(col, 1.0);
}
`;

export function create(app) {
  const scene = new THREE.Scene();

  // ---- sky
  const skyU = {
    uZenith: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() }, uSunDir: { value: new THREE.Vector3() }, uSunCol: { value: new THREE.Color() },
    uMoonA: { value: new THREE.Vector3(0.6, 0.42, 0.5) }, uMoonB: { value: new THREE.Vector3(-0.3, 0.6, 0.62) }, uNight: { value: 0 }, uSunVis: { value: 1 },
  };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 24), new THREE.ShaderMaterial({ vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, uniforms: skyU, side: THREE.BackSide, depthTest: false, depthWrite: false }));
  sky.renderOrder = -100;
  sky.frustumCulled = false;
  scene.add(sky);

  // shared light uniforms, changed together as the sun moves
  const L = {
    uLightDir: { value: new THREE.Vector3(0, 1, 0) }, uLit: { value: new THREE.Color() }, uShade: { value: new THREE.Color() },
    uHorizon: skyU.uHorizon, uSunCol: { value: new THREE.Color() }, uAmb: { value: new THREE.Color() }, uLights: { value: 0 },
  };

  // ---- the sea of clouds, following the camera on a fixed grid so it never swims
  const deckU = { ...L, uTime: { value: 0 }, uFogK: { value: 0.00052 } };
  const deck = new THREE.Mesh(new THREE.PlaneGeometry(6600, 6600, 220, 220).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({ vertexShader: DECK_VERT, fragmentShader: DECK_FRAG, uniforms: deckU }));
  deck.position.y = DECK;
  deck.frustumCulled = false;
  scene.add(deck);

  // ---- towering clouds in the distance
  const clusters = [];
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2 + rnd(-0.1, 0.1), r = rnd(260, 1500);
    clusters.push([Math.cos(a) * r, Math.sin(a) * r, rnd(0.7, 1.5)]);
  }
  const PUFFS = clusters.length * 20;
  const puffGeo = new THREE.IcosahedronGeometry(1, 3);
  const pSeeds = new Float32Array(PUFFS);
  puffGeo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(pSeeds, 1));
  const puffs = new THREE.InstancedMesh(puffGeo, new THREE.ShaderMaterial({ vertexShader: PUFF_VERT, fragmentShader: PUFF_FRAG, uniforms: { ...L, uFogK: { value: 0.0006 } } }), PUFFS);
  {
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
    let n = 0;
    for (const [cx, cz, k] of clusters) {
      for (let j = 0; j < 20; j++) {
        const up = j / 20, size = (52 - up * 30) * k * rnd(0.75, 1.2);
        p.set(cx + rnd(-55, 55) * k * (1 - up * 0.65), DECK + 8 + up * 180 * k + rnd(-8, 8), cz + rnd(-55, 55) * k * (1 - up * 0.65));
        puffs.setMatrixAt(n, m4.compose(p, q, s.set(size * 1.15, size * 0.85, size)));
        pSeeds[n++] = Math.random();
      }
    }
  }
  puffs.frustumCulled = false;
  scene.add(puffs);

  // ---- the city
  const cityU = (base, bands) => ({ ...L, uBase: { value: new THREE.Color(base) }, uBands: { value: bands }, uFogK: { value: 0.0009 } });
  const cityMat = new THREE.ShaderMaterial({ vertexShader: CITY_VERT, fragmentShader: CITY_FRAG, uniforms: cityU('#e6e1d8', 1) });
  const city = new THREE.Group();
  const profile = [[0, 12.4], [15, 12.4], [24, 11.2], [27.5, 10], [28, 8.6], [26.5, 6.6], [19, 2.6], [11, -1.5], [5, -5], [2.8, -8]].map(([r, y]) => new THREE.Vector2(r, y));
  city.add(new THREE.Mesh(new THREE.LatheGeometry(profile, 72), cityMat));
  const stalk = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 1.5, 150, 16, 1, true), cityMat);
  stalk.position.y = -83;
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(7, 24, 16), cityMat);
  bulb.position.y = -160;
  city.add(stalk, bulb);
  // towers on the top deck, tallest in the middle
  const tw = [];
  tw.push([0, 0, 4.2, 26]);
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; tw.push([Math.cos(a) * 6.5, Math.sin(a) * 6.5, rnd(1.6, 2.4), rnd(12, 19)]); }
  for (let ring = 0; ring < 4; ring++) {
    const r = 10 + ring * 4.2, count = 14 + ring * 6;
    for (let i = 0; i < count; i++) {
      if (Math.random() < 0.18) continue;
      const a = (i / count) * Math.PI * 2 + ring * 0.3 + rnd(-0.06, 0.06);
      tw.push([Math.cos(a) * r, Math.sin(a) * r, rnd(0.9, 1.9), Math.max(1.5, (11 - ring * 2.4) * rnd(0.6, 1.2))]);
    }
  }
  const towerGeo = new THREE.CylinderGeometry(1, 1.08, 1, 12).translate(0, 0.5, 0);
  const towers = new THREE.InstancedMesh(towerGeo, cityMat, tw.length);
  const domes = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), cityMat, tw.length);
  {
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
    tw.forEach(([x, z, r, h], i) => {
      const y0 = 12.4 - Math.hypot(x, z) * 0.02;
      towers.setMatrixAt(i, m4.compose(p.set(x, y0, z), q, s.set(r, h, r)));
      domes.setMatrixAt(i, m4.compose(p.set(x, y0 + h, z), q, s.set(r * 1.04, r * 0.7, r * 1.04)));
    });
  }
  city.add(towers, domes);
  const rimLights = [];
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2;
    const g = makeGlow('#ffcf8a', 2.4, 0);
    g.position.set(Math.cos(a) * 28.3, 8.6, Math.sin(a) * 28.3);
    city.add(g);
    rimLights.push(g);
  }
  const beacon = makeGlow('#ff4a3a', 3, 0);
  beacon.position.y = 12.4 + 26 + 3.4;
  city.add(beacon);
  scene.add(city);

  // ---- cloud cars: two pods joined by a short wing
  const carMat = new THREE.ShaderMaterial({ vertexShader: CITY_VERT, fragmentShader: CITY_FRAG, uniforms: cityU('#d4442e', 0) });
  const podGeo = new THREE.CapsuleGeometry(0.55, 2.4, 4, 10).rotateX(Math.PI / 2);
  const cars = Array.from({ length: 7 }, (_, i) => {
    const g = new THREE.Group();
    for (const s of [-1, 1]) {
      const pod = new THREE.Mesh(podGeo, carMat);
      pod.position.x = s * 0.95;
      g.add(pod);
      const glow = makeGlow('#ffb08a', 1.6, 0.8);
      glow.position.set(s * 0.95, 0, 1.9);
      g.add(glow);
    }
    const wing = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.16, 1.2), carMat);
    g.add(wing);
    g.scale.setScalar(1.3);
    scene.add(g);
    return { g, R: rnd(38, 80), y: rnd(-6, 22), w: rnd(0.12, 0.24) * (i % 2 ? 1 : -1), a: Math.random() * 6.28, pos: new THREE.Vector3(), free: false };
  });

  // ---- state
  let tod = 0.255, holding = false, riding = false, lastInput = -10, said = false;
  const R = { pos: new THREE.Vector3(), yaw: 0, pitch: 0, yawRate: 0, pitchRate: 0, roll: 0 };
  const steerP = new THREE.Vector2(), steer = new THREE.Vector2();
  const sunDir = new THREE.Vector3(), lightDir = new THREE.Vector3(), tmp = new THREE.Color(), fwd = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const e3 = new THREE.Euler(0, 0, 0, 'YXZ'), camGoal = new THREE.Vector3(), look = new THREE.Vector3();
  let elev = 0;

  const elevation = (t) => 50 * Math.cos(Math.PI * 2 * t) + 6;
  function moment() {
    const evening = tod < 0.5;
    if (elev > 25) return 'Midday';
    if (elev > 8) return 'Golden hour';
    if (elev > -2) return evening ? 'Sunset' : 'Sunrise';
    if (elev > -12) return evening ? 'Dusk' : 'Dawn';
    return 'Night';
  }
  const readout = () => app.readout(`${moment()} over Bespin${riding ? ' · Riding a cloud car' : ''}`);

  function applyTime() {
    elev = elevation(tod);
    const e = THREE.MathUtils.degToRad(elev);
    sunDir.copy(SUN_AZ).multiplyScalar(Math.cos(e)).addScaledVector(up, Math.sin(e)).normalize();
    // below the horizon the clouds take their light from the moons instead
    const le = THREE.MathUtils.degToRad(Math.max(elev, 4));
    lightDir.copy(elev > -6 ? SUN_AZ : new THREE.Vector3(0.6, 0, 0.5).normalize()).multiplyScalar(Math.cos(le)).addScaledVector(up, Math.sin(le)).normalize();
    let i = 0;
    while (i < KEYS.length - 2 && elev > KEYS[i + 1].e) i++;
    const a = KEYS[i], b = KEYS[i + 1], k = clamp((elev - a.e) / (b.e - a.e), 0, 1);
    const mix = (n, target) => target.copy(a.c[n]).lerp(b.c[n], k);
    mix('zen', skyU.uZenith.value); mix('hor', skyU.uHorizon.value); mix('sun', skyU.uSunCol.value);
    mix('lit', L.uLit.value); mix('shade', L.uShade.value); mix('amb', L.uAmb.value);
    L.uSunCol.value.copy(skyU.uSunCol.value).multiplyScalar(clamp((elev + 6) / 10, 0.08, 1));
    skyU.uSunDir.value.copy(sunDir);
    skyU.uNight.value = clamp((-elev - 4) / 12, 0, 1);
    skyU.uSunVis.value = clamp((elev + 2) / 3, 0, 1);
    L.uLightDir.value.copy(lightDir);
    L.uLights.value = clamp((6 - elev) / 14, 0, 1);
  }
  applyTime();

  const actions = [
    {
      id: 'sun', verb: 'Turn the sun', how: 'Hold', kind: 'hold', key: ' ',
      down() { holding = true; if (!said) { said = true; app.toast('Watch the clouds change colour.', 2.6); } },
      up() { holding = false; },
    },
    { id: 'ride', verb: 'Ride a cloud car', how: 'Tap', kind: 'tap', key: 'r', down() { setRide(!riding); } },
  ];

  function setRide(on) {
    riding = on;
    const car = cars[0];
    if (on) {
      car.free = true;
      R.pos.copy(car.pos);
      const dir = Math.sign(car.w);
      R.yaw = Math.atan2(dir * Math.sin(car.a), -dir * Math.cos(car.a));
      R.pitch = 0;
      app.rig.enabled = false;
      app.fold();
      app.sound.whoosh(0.9, true);
      app.hint('Drag to steer the cloud car. Tap again to step off.');
    } else {
      car.free = false;
      app.rig.enabled = true;
      app.rig.set({ target: new THREE.Vector3(0, 6, 0), radius: 110, snap: false });
      app.unfold();
      app.hint(meta.hint);
    }
    app.action('ride', { verb: on ? 'Step off' : 'Ride a cloud car' });
    readout();
  }

  return {
    scene, actions,
    usesArrows: true,
    enter() {
      app.rig.set({
        target: new THREE.Vector3(0, 6, 0), theta: 0.38, phi: 1.43, radius: 112, snap: true,
        auto: app.reduced ? 0 : 0.03, minPhi: 0.35, maxPhi: 1.62, minRadius: 45, maxRadius: 260, damping: 3, minY: -2,
      });
      app.rig.fit = app.camera.aspect < 0.8 ? 1.5 : 1;
      if (riding) setRide(false);
      readout();
    },
    leave() { holding = false; app.sound.stopWind(); if (riding) { riding = false; cars[0].free = false; } app.rig.enabled = true; },
    resize() { app.rig.fit = app.camera.aspect < 0.8 ? 1.5 : 1; },
    onPointerDown() {
      if (!riding) return false;
      steerP.set(0, 0); lastInput = app.time;
      return true;
    },
    onPointerMove(e, ndc, d) { steerP.set(clamp(d.ox / 90, -1, 1), clamp(d.oy / 90, -1, 1)); lastInput = app.time; },
    onPointerUp() { steerP.set(0, 0); },
    async demo(cue) {
      cue.say('Sunset over Bespin.', 3);
      if (!(await cue.wait(3))) return;
      await cue.hold('sun', 5);
      if (!(await cue.wait(2))) return;
      cue.press('ride');
      if (!(await cue.wait(8))) return;
      cue.press('ride');
      await cue.wait(2);
    },

    update(dt, t) {
      const before = moment();
      tod = (tod + dt * (holding ? 0.07 : 0.0025) * (elev < -10 ? 2.4 : 1)) % 1;
      applyTime();
      if (moment() !== before) readout();
      app.meter('sun', holding ? 1 : 0, holding);
      if (!app.sound.windNodes) app.sound.startWind();
      app.sound.setWind(riding ? 0.35 : 0.14);

      deckU.uTime.value = t;
      deck.position.x = Math.round(app.camera.position.x / SPACING) * SPACING;
      deck.position.z = Math.round(app.camera.position.z / SPACING) * SPACING;

      // city lights come on as the sun goes down
      rimLights.forEach((g, i) => { g.material.opacity = L.uLights.value * (0.7 + 0.3 * Math.sin(t * 2 + i)); });
      beacon.material.opacity = (0.3 + 0.7 * L.uLights.value) * (Math.sin(t * 3) > 0.6 ? 1 : 0.15);
      city.rotation.y += dt * 0.004;
      city.position.y = Math.sin(t * 0.3) * 0.6;

      // cloud cars
      for (const c of cars) {
        if (c.free) continue;
        c.a += c.w * dt;
        const target = new THREE.Vector3(Math.cos(c.a) * c.R, c.y + Math.sin(t * 0.5 + c.R) * 2, Math.sin(c.a) * c.R);
        c.pos.lerp(target, c === cars[0] ? 1 - Math.exp(-dt * 1.5) : 1);
        c.g.position.copy(c.pos);
        const dir = Math.sign(c.w);
        c.g.lookAt(c.pos.x - Math.sin(c.a) * dir * 10, c.pos.y, c.pos.z + Math.cos(c.a) * dir * 10);
        c.g.rotateZ(-dir * 0.35);
        c.g.rotateY(Math.PI);
      }

      if (riding) {
        const K = app.keys;
        const kx = (K.has('d') || K.has('ArrowRight') ? 1 : 0) - (K.has('a') || K.has('ArrowLeft') ? 1 : 0);
        const ky = (K.has('s') || K.has('ArrowDown') ? 1 : 0) - (K.has('w') || K.has('ArrowUp') ? 1 : 0);
        if (kx || ky) lastInput = t;
        steer.set(clamp(steerP.x + kx, -1, 1), clamp(steerP.y + ky, -1, 1));
        if (t - lastInput > 4) steer.set(0.35 + Math.sin(t * 0.2) * 0.25, Math.sin(t * 0.27) * 0.3 + (R.pos.y - 8) / 50);
        const k = 1 - Math.exp(-dt * 3);
        R.yawRate += (-steer.x * 0.9 - R.yawRate) * k;
        R.pitchRate += (-steer.y * 0.6 - R.pitchRate) * k;
        R.yaw += R.yawRate * dt;
        R.pitch = clamp(R.pitch + R.pitchRate * dt, -0.5, 0.5);
        if (R.pos.y < -12) R.pitch += dt * 0.8;
        if (R.pos.y > 70) R.pitch -= dt * 0.8;
        const far = Math.hypot(R.pos.x, R.pos.z);
        if (far > 240) {
          let dy = Math.atan2(-R.pos.x, -R.pos.z) - R.yaw;
          dy = Math.atan2(Math.sin(dy), Math.cos(dy));
          R.yaw += dy * dt * 0.9;
        }
        R.roll += (R.yawRate * 0.7 - R.roll) * (1 - Math.exp(-dt * 4));
        e3.set(R.pitch, R.yaw, 0);
        fwd.set(0, 0, -1).applyEuler(e3);
        R.pos.addScaledVector(fwd, 24 * dt);
        if (Math.hypot(R.pos.x, R.pos.z) < 32 && R.pos.y > -10 && R.pos.y < 40) R.pos.y += dt * 18;   // hop over the city, never through it
        const car = cars[0];
        car.pos.copy(R.pos);
        car.g.position.copy(R.pos);
        e3.set(R.pitch, R.yaw, R.roll);
        car.g.quaternion.setFromEuler(e3);
        camGoal.copy(R.pos).addScaledVector(fwd, -11).addScaledVector(up, 3.2);
        app.camera.position.lerp(camGoal, 1 - Math.exp(-dt * 4));
        look.copy(R.pos).addScaledVector(fwd, 12);
        app.camera.lookAt(look);
      }

      sky.position.copy(app.camera.position);
    },
  };
}
