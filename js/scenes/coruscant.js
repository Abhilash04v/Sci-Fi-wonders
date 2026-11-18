// Coruscant: one city covering a whole planet.
// From orbit the night side is a web of light. Dive in and ride the stacked skylanes at dusk.
import * as THREE from 'three';
import { makeSky, makeStars, makeSun, makeGlow } from '../core/sky.js';
import { makeHalo } from '../core/bodies.js';
import { NOISE } from '../core/glsl.js';

export const meta = {
  id: 'coruscant',
  name: 'Coruscant',
  tag: 'A city that covers a whole world',
  blurb: 'One city, wall to wall across an entire planet, home to a trillion people. The sky is so busy that traffic runs in stacked lanes, and the lights never go out.',
  legend: true,
  screen: 1997,
  isNew: true,
  accent: '#ffc46b',
  hint: 'Dive into the city, then drag to weave through the skylanes. Hold to speed up.',
  bloom: { strength: 0.5, radius: 0.55, threshold: 0.84 },
  drone: 61.7,
};

const PR = 40;                       // planet radius, in the orbit view
const LZ = 1600, CELL = 46, AVE = 72; // the city repeats every LZ along the avenue
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const rnd = (a, b) => a + Math.random() * (b - a);
const HASH = /* glsl */ `float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }`;
const WRAP = /* glsl */ `float wrapZ(float z0, float camZ){ return camZ + 150.0 - mod(150.0 - (z0 - camZ), ${LZ.toFixed(1)}); }`;

// ---- the planet from orbit
const CP_VERT = /* glsl */ `
varying vec3 vObj;
varying vec3 vWN;
varying vec3 vWP;
void main(){
  vObj = position;
  vWN = normalize(mat3(modelMatrix) * normal);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWP = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;
const CP_FRAG = /* glsl */ `
varying vec3 vObj;
varying vec3 vWN;
varying vec3 vWP;
uniform vec3 uSun;
uniform float uTime;
${NOISE}
${HASH}
void main(){
  vec3 p = normalize(vObj);
  vec3 N = normalize(vWN);
  vec3 V = normalize(cameraPosition - vWP);
  float ndl = dot(N, normalize(uSun));
  float day = smoothstep(-0.12, 0.25, ndl);
  float dens = smoothstep(-0.5, 0.6, fbm3(p * 4.0 + 3.0)) * 0.8 + 0.2;
  // highways: thin bright ridges in two sizes
  float hw1 = pow(1.0 - abs(snoise(p * 5.0 + 1.3)), 48.0);
  float hw2 = pow(1.0 - abs(snoise(p * 11.0 + 4.1)), 56.0);
  // streets: a fine grid that settles into an even glow when it gets too small to see
  float lat = asin(clamp(p.y, -1.0, 1.0)), lon = atan(p.z, p.x);
  vec2 g = vec2(lon * cos(lat), lat) * 120.0;
  vec2 gf = abs(fract(g) - 0.5);
  float line = smoothstep(0.38, 0.5, max(gf.x, gf.y));
  float aa = clamp(max(fwidth(g.x), fwidth(g.y)), 0.0, 1.0);
  float streets = mix(line, 0.2, smoothstep(0.25, 0.8, aa));
  float speck = step(0.9, h21(floor(g * 2.0))) * (1.0 - smoothstep(0.25, 0.8, aa));
  float lights = (hw1 * 0.85 + hw2 * 0.5 + streets * 0.75 + speck * 1.3) * dens * dens;
  vec3 lightCol = mix(vec3(1.0, 0.6, 0.26), vec3(1.0, 0.86, 0.6), hw1 + hw2 * 0.5);
  vec3 surf = mix(vec3(0.34, 0.32, 0.3), vec3(0.19, 0.2, 0.23), smoothstep(-0.3, 0.5, fbm3(p * 9.0)));
  surf *= 0.82 + 0.36 * streets;
  float cl = smoothstep(0.2, 0.75, fbm(p * 2.4 + vec3(uTime * 0.008, 0.0, 0.0)));
  vec3 col = surf * max(ndl, 0.0) * 1.25;
  col = mix(col, vec3(0.95) * max(ndl, 0.0) * 1.1, cl * 0.7);
  col += lightCol * lights * (1.0 - day) * (1.0 - cl * 0.55) * 1.6;
  float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  col += vec3(0.35, 0.55, 1.0) * fres * (day * 0.8 + 0.06);
  gl_FragColor = vec4(col, 1.0);
}
`;

const ORBIT_VERT = /* glsl */ `
attribute vec4 aOrbit;
attribute float aSpeed;
uniform float uTime, uPx;
varying float vA;
void main(){
  float ang = aOrbit.w + uTime * aSpeed;
  vec3 p = vec3(cos(ang), 0.0, sin(ang)) * aOrbit.x;
  float ci = cos(aOrbit.y), si = sin(aOrbit.y);
  p = vec3(p.x, p.y * ci - p.z * si, p.y * si + p.z * ci);
  float cn = cos(aOrbit.z), sn = sin(aOrbit.z);
  p = vec3(p.x * cn + p.z * sn, p.y, -p.x * sn + p.z * cn);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(uPx * 90.0 / -mv.z, 1.0, 4.0);
  vA = 0.6 + 0.4 * sin(uTime * 3.0 + aOrbit.w * 30.0);
}
`;
const DOT_FRAG = /* glsl */ `
uniform vec3 uColor;
varying float vA;
void main(){
  float d = length(gl_PointCoord - 0.5);
  gl_FragColor = vec4(uColor * (1.0 - smoothstep(0.1, 0.5, d)) * vA, 1.0);
}
`;

// ---- the city: towers with a window on every floor, wrapped so the avenue never ends
const TW_VERT = /* glsl */ `
attribute float aSeed;
uniform float uCamZ, uWrap;
varying vec3 vWP;
varying vec3 vLocal;
varying vec3 vN;
varying float vSeed;
${WRAP}
void main(){
  vec3 sc = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
  vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
  if (uWrap > 0.5) {
    float z0 = instanceMatrix[3].z;
    wp.z += wrapZ(z0, uCamZ) - z0;
  }
  vWP = wp.xyz;
  vLocal = position * sc;
  vN = normal;
  vSeed = aSeed;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;
const TW_FRAG = /* glsl */ `
varying vec3 vWP;
varying vec3 vLocal;
varying vec3 vN;
varying float vSeed;
uniform vec3 uSun, uSunColor, uHaze, uDeep;
uniform float uNight, uTime, uHazeK;
${HASH}
void main(){
  vec3 N = normalize(vN);
  vec2 uv = abs(N.x) > 0.5 ? vec2(vLocal.z, vLocal.y) : vec2(vLocal.x, vLocal.y);
  vec2 q = uv / vec2(1.3, 2.1);
  vec2 cell = floor(q), f = fract(q);
  float frame = step(0.16, f.x) * step(f.x, 0.84) * step(0.22, f.y) * step(f.y, 0.82);
  float floorBand = h21(vec2(cell.y, vSeed * 13.0 + N.x * 3.0 + N.z * 7.0));
  float on = step(0.74 - 0.26 * uNight, h21(cell + vSeed * 91.0 + N.x * 17.0 + N.z * 31.0)) * step(0.18, floorBand);
  float aa = clamp(max(fwidth(q.x), fwidth(q.y)), 0.0, 1.0);
  float win = mix(frame * on, 0.12 + 0.1 * uNight, smoothstep(0.35, 1.0, aa));
  vec3 warm = mix(vec3(1.0, 0.78, 0.48), vec3(0.62, 0.82, 1.0), step(0.78, vSeed));
  float wall = 0.05 + 0.04 * vSeed;
  float ribs = 0.85 + 0.15 * step(0.5, fract(uv.x / 4.8));
  vec3 col = vec3(wall * ribs) * vec3(0.8, 0.85, 1.0);
  float sunlit = max(dot(N, normalize(uSun)), 0.0) * (1.0 - uNight);
  col += uSunColor * sunlit * (0.22 + 0.1 * vSeed);
  if (N.y > 0.5) {
    col = vec3(0.05, 0.05, 0.07) + uSunColor * 0.06 * (1.0 - uNight);
    float blink = step(0.5, fract(uTime * 0.7 + vSeed * 5.0));
    col += vec3(1.0, 0.15, 0.1) * step(0.72, vSeed) * blink * (1.0 - smoothstep(0.6, 1.6, length(vLocal.xz)));
  } else {
    col += warm * win * (0.55 + 0.35 * uNight);
  }
  // haze: thick with distance, and thicker still the further down you look
  float dist = length(vWP - cameraPosition);
  float hz = 1.0 - exp(-dist * uHazeK);
  float low = smoothstep(-10.0, -240.0, vWP.y);
  vec3 haze = mix(uHaze, uDeep, low);
  col = mix(col, haze, clamp(max(hz, low * 0.92), 0.0, 1.0));
  gl_FragColor = vec4(col, 1.0);
}
`;

const CAR_VERT = /* glsl */ `
attribute vec4 aLane;   // x (or z for cross lanes), y, direction, speed
attribute vec2 aMeta;   // axis (0 = along the avenue, 1 = across it), phase
uniform float uTime, uCamZ, uPx, uNight;
varying vec3 vCol;
${WRAP}
void main(){
  float s = aMeta.y * ${LZ.toFixed(1)} + uTime * aLane.w * aLane.z;
  vec3 p;
  if (aMeta.x < 0.5) {
    p = vec3(aLane.x, aLane.y, wrapZ(-mod(s, ${LZ.toFixed(1)}), uCamZ));
  } else {
    p = vec3(mod(s, 2400.0) - 1200.0, aLane.y, wrapZ(aLane.x, uCamZ));
  }
  vec4 mv = viewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(uPx * 420.0 / -mv.z, 2.0, 12.0);
  vec3 tail = vec3(1.0, 0.24, 0.14), head = vec3(1.0, 0.92, 0.8), across = vec3(1.0, 0.68, 0.3);
  vec3 c = aMeta.x > 0.5 ? across : aLane.z > 0.0 ? tail : head;
  vCol = c * (1.8 + 0.8 * uNight) * exp(-length(mv.xyz) * 0.0006);
}
`;
const CAR_FRAG = /* glsl */ `
varying vec3 vCol;
void main(){
  float d = length(gl_PointCoord - 0.5);
  float a = 1.0 - smoothstep(0.0, 0.5, d);
  gl_FragColor = vec4(vCol * a * a, 1.0);
}
`;

const DUSK = { base: '#15123a', horizon: '#ff9c5c', horizonHeight: 0.32, a: '#ff8a5a', b: '#6a3a7a', c: '#ffd0a0', density: 0.36, dust: 0.25, gain: 0.55, seed: 41.3, scale: 1.4 };
const NIGHT = { base: '#03040c', horizon: '#3a2448', horizonHeight: 0.22, a: '#2a1a40', b: '#101a3a', c: '#5a3a5a', density: 0.3, dust: 0.3, gain: 0.35, seed: 41.3, scale: 1.4, stars: 0.6 };
const SPACE = { a: '#0d1838', b: '#1d1030', c: '#2a4a6a', base: '#010206', density: 0.3, dust: 0.6, gain: 0.45, seed: 52.9 };

function buildSpeeder() {
  const g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color: '#f2c230', roughness: 0.35, metalness: 0.3, flatShading: true });
  const dark = new THREE.MeshStandardMaterial({ color: '#2a2c33', roughness: 0.5, metalness: 0.6, flatShading: true });
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.9, 5.2, 4).rotateX(-Math.PI / 2).rotateZ(Math.PI / 4), paint);
  body.scale.set(1, 0.42, 1);
  const glass = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 8), new THREE.MeshStandardMaterial({ color: '#16202a', roughness: 0.1, metalness: 0.9 }));
  glass.scale.set(1, 0.6, 1.4); glass.position.set(0, 0.32, 0.6);
  g.add(body, glass);
  const glows = [];
  for (const s of [-1, 1]) {
    const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.3, 2.6, 10).rotateX(Math.PI / 2), dark);
    pod.position.set(s * 1.05, 0, 1.4);
    const glow = makeGlow('#9fd8ff', 2.2, 0.9);
    glow.position.set(s * 1.05, 0, 2.8);
    g.add(pod, glow);
    glows.push(glow);
  }
  return { group: g, glows };
}

export function create(app) {
  const scene = new THREE.Scene();
  const sky = makeSky(app.renderer, SPACE);
  const stars = makeStars(4200);
  const sun = makeSun('#fff0dc', 200);
  scene.add(sky.mesh, stars.points, sun.group);

  // ================================================================ orbit
  const orbit = new THREE.Group();
  scene.add(orbit);
  const orbitSun = new THREE.Vector3(1, 0.22, 0.25).normalize();
  const planetMat = new THREE.ShaderMaterial({ vertexShader: CP_VERT, fragmentShader: CP_FRAG, uniforms: { uSun: { value: orbitSun }, uTime: { value: 0 } } });
  const planet = new THREE.Mesh(new THREE.SphereGeometry(PR, 128, 96), planetMat);
  planet.rotation.z = 0.25;
  const halo = makeHalo({ color: '#8fb8ff', shell: 1.12, power: 2.6, gain: 1.0 });
  halo.scale.setScalar(PR);
  halo.material.uniforms.uLight.value.copy(orbitSun);
  orbit.add(planet, halo);
  {
    const N = 1800, orb = new Float32Array(N * 4), spd = new Float32Array(N);
    const lanes = Array.from({ length: 9 }, () => [rnd(PR + 3, PR + 16), rnd(-0.9, 0.9), rnd(0, 6.28)]);
    for (let i = 0; i < N; i++) {
      const l = lanes[i % lanes.length];
      orb.set([l[0] + rnd(-0.3, 0.3), l[1], l[2], Math.random() * 6.28], i * 4);
      spd[i] = (0.05 + Math.random() * 0.04) * ((i % lanes.length) % 2 ? 1 : -1);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    geo.setAttribute('aOrbit', new THREE.BufferAttribute(orb, 4));
    geo.setAttribute('aSpeed', new THREE.BufferAttribute(spd, 1));
    const pts = new THREE.Points(geo, new THREE.ShaderMaterial({
      vertexShader: ORBIT_VERT, fragmentShader: DOT_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uPx: { value: app.px }, uColor: { value: new THREE.Color('#ffe2b0') } },
    }));
    pts.frustumCulled = false;
    orbit.add(pts);
    orbit.userData.traffic = pts;
  }

  // ================================================================ the city
  const city = new THREE.Group();
  city.visible = false;
  scene.add(city);
  const citySun = new THREE.Vector3(-0.5, 0.07, -0.86).normalize();
  const towerUniforms = (wrap) => ({
    uCamZ: { value: 0 }, uWrap: { value: wrap }, uSun: { value: citySun }, uSunColor: { value: new THREE.Color('#ff9a5a') },
    uHaze: { value: new THREE.Color('#c87a62') }, uDeep: { value: new THREE.Color('#ff8a3a') },
    uNight: { value: 0 }, uTime: { value: 0 }, uHazeK: { value: wrap ? 0.0007 : 0.00036 },
  });
  const boxGeo = () => new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);

  const spots = [];
  for (let gx = -17; gx <= 17; gx++) {
    for (let gz = 0; gz < LZ / CELL; gz++) {
      const x = gx * CELL + rnd(-5, 5), z = -gz * CELL + rnd(-5, 5);
      if (Math.abs(x) < AVE + 12 || Math.random() < 0.05) continue;
      const near = Math.abs(x) < 200;
      const h = near ? rnd(90, 290) + (Math.random() < 0.09 ? 360 : 0) : 70 + Math.pow(Math.random(), 2.2) * 400 + (Math.random() < 0.04 ? 480 : 0);
      const w = rnd(18, 40), d = rnd(18, 40);
      spots.push([x, z, w, h, d]);
      if (Math.random() < 0.32) spots.push([x, z, w * rnd(0.4, 0.7), h + rnd(30, 140), d * rnd(0.4, 0.7)]);
    }
  }
  const towerGeo = boxGeo();
  const tSeeds = new Float32Array(spots.length);
  towerGeo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(tSeeds, 1));
  const towerMat = new THREE.ShaderMaterial({ vertexShader: TW_VERT, fragmentShader: TW_FRAG, uniforms: towerUniforms(1) });
  const towers = new THREE.InstancedMesh(towerGeo, towerMat, spots.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), scl = new THREE.Vector3();
  spots.forEach(([x, z, w, h, d], i) => {
    towers.setMatrixAt(i, m4.compose(pos.set(x, -260, z), q, scl.set(w, h + 260, d)));
    tSeeds[i] = Math.random();
  });
  towers.frustumCulled = false;
  city.add(towers);

  // the far skyline and one great temple, always on the horizon
  const skyline = new THREE.Group();
  city.add(skyline);
  const far = [];
  for (let i = 0; i < 300; i++) {
    const a = Math.random() * Math.PI * 2, r = rnd(1350, 2300);
    if (Math.sin(a) < 0 && Math.abs(Math.cos(a)) < 0.3) continue;   // keep the view down the avenue open
    far.push([Math.cos(a) * r, Math.sin(a) * r, rnd(60, 170), rnd(250, 1250), rnd(60, 170)]);
  }
  const tx = 760, tz = -1750;
  [[300, 70], [240, 70], [180, 70], [120, 70]].forEach(([w, h], k) => far.push([tx, tz, w, h, w, k * 70]));
  far.push([tx, tz, 26, 520, 26, 280]);
  for (const [ox, oz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) far.push([tx + ox * 46, tz + oz * 46, 16, 300, 16, 280]);
  const farGeo = boxGeo();
  const fSeeds = new Float32Array(far.length);
  farGeo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(fSeeds, 1));
  const farMat = new THREE.ShaderMaterial({ vertexShader: TW_VERT, fragmentShader: TW_FRAG, uniforms: towerUniforms(0) });
  const farMesh = new THREE.InstancedMesh(farGeo, farMat, far.length);
  far.forEach(([x, z, w, h, d, y0 = 0], i) => {
    farMesh.setMatrixAt(i, m4.compose(pos.set(x, y0 - 300, z), q, scl.set(w, h + 300, d)));
    fSeeds[i] = Math.random();
  });
  farMesh.frustumCulled = false;
  skyline.add(farMesh);

  // glowing smog far below
  const smog = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ff8a3a', fog: false }));
  smog.position.y = -200;
  city.add(smog);

  // traffic
  const lanes = [];
  for (const y of [150, 205, 262, 318, 372]) for (const x of [-34, -14, 14, 34]) lanes.push([x, y, x < 0 ? -1 : 1, rnd(45, 90), 0]);
  for (let k = 1; k <= 6; k++) for (const s of [-1, 1]) for (const y of [rnd(300, 380), rnd(400, 520)]) lanes.push([s * (k * 2 * CELL - CELL / 2), y, Math.random() < 0.5 ? 1 : -1, rnd(50, 110), 0]);
  for (let k = 0; k < 8; k++) for (const y of [rnd(260, 340), rnd(380, 480)]) lanes.push([-k * 200 - 60, y, Math.random() < 0.5 ? 1 : -1, rnd(60, 120), 1]);
  const PER = 52, NC = lanes.length * PER;
  const laneA = new Float32Array(NC * 4), metaA = new Float32Array(NC * 2);
  lanes.forEach((l, i) => {
    for (let j = 0; j < PER; j++) {
      const k = i * PER + j;
      laneA.set([l[0] + rnd(-1.2, 1.2), l[1] + rnd(-1.5, 1.5), l[2], l[3] * rnd(0.9, 1.1)], k * 4);
      metaA.set([l[4], Math.random()], k * 2);
    }
  });
  const carGeo = new THREE.BufferGeometry();
  carGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NC * 3), 3));
  carGeo.setAttribute('aLane', new THREE.BufferAttribute(laneA, 4));
  carGeo.setAttribute('aMeta', new THREE.BufferAttribute(metaA, 2));
  const carMat = new THREE.ShaderMaterial({
    vertexShader: CAR_VERT, fragmentShader: CAR_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uCamZ: { value: 0 }, uPx: { value: app.px }, uNight: { value: 0 } },
  });
  const cars = new THREE.Points(carGeo, carMat);
  cars.frustumCulled = false;
  city.add(cars);

  city.add(new THREE.HemisphereLight('#ffb08a', '#3a2a4a', 1.4));
  const cityKey = new THREE.DirectionalLight('#ffb070', 1.6);
  cityKey.position.copy(citySun);
  city.add(cityKey);
  const speeder = buildSpeeder();
  city.add(speeder.group);

  // ================================================================ state
  let mode = 'orbit', switching = false, night = 0, nightGoal = 0, boosting = false, lastInput = -10;
  let camZ = 0, cx = 0, cy = 300, cvx = 0, cvy = 0, speed = 60, bank = 0;
  const steerP = new THREE.Vector2(), steer = new THREE.Vector2(), look = new THREE.Vector3(), camGoal = new THREE.Vector3();

  const readout = () => app.readout(mode === 'orbit'
    ? 'The night side, lit by a trillion windows'
    : `Altitude ${Math.round(cy * 6)} m · ${nightGoal ? 'Night' : 'Dusk'}${speed > 120 ? ' · Full speed' : ''}`);

  const orbitActions = [{ id: 'dive', verb: 'Dive into the city', how: 'Tap', kind: 'tap', key: ' ', down() { dive(); } }];
  const cityActions = [
    { id: 'boost', verb: 'Speed up', how: 'Hold · Space', kind: 'hold', key: ' ', down() { boosting = true; }, up() { boosting = false; } },
    { id: 'time', verb: 'Let night fall', how: 'Tap', kind: 'tap', key: 'n', down() { toggleNight(); } },
    { id: 'orbit', verb: 'Back to orbit', how: 'Tap', kind: 'tap', key: 'o', down() { climb(); } },
  ];

  function orbitCamera(snap, radius = 125) {
    app.rig.enabled = true;
    const portrait = app.camera.aspect < 0.8;
    app.rig.set({
      target: new THREE.Vector3(0, 0, 0), theta: -0.62, phi: 1.32, radius, snap,
      auto: app.reduced ? 0 : 0.03, minPhi: 0.3, maxPhi: Math.PI - 0.3, minRadius: 58, maxRadius: 260, damping: 3,
    });
    app.rig.fit = portrait ? 1.5 : 1;
  }

  async function dive() {
    if (switching || mode !== 'orbit') return;
    switching = true;
    app.sound.whoosh(1.6, true);
    app.rig.auto = 0;
    const r0 = app.rig.goalRadius;
    await app.tween(1.6, (k) => {
      const e = k * k * k;
      app.rig.goalRadius = r0 + (PR + 6 - r0) * e;
      app.rig.radius = app.rig.goalRadius;
      app.warp.amount = e * 0.4;
      app.fovKick = e * 18;
    });
    app.flash(1, 1.3, '#ffd2a0');
    mode = 'city';
    orbit.visible = false; city.visible = true; stars.points.visible = false;
    sky.paint(nightGoal ? NIGHT : DUSK);
    sun.group.visible = !nightGoal;
    sun.dir.copy(citySun);
    app.rig.enabled = false;
    cx = 0; cy = 300; cvx = cvy = 0; speed = 90;
    placeCamera(true, 0);
    app.setActions(cityActions);
    app.action('time', { verb: nightGoal ? 'Back to dusk' : 'Let night fall' });
    app.fold();
    await app.tween(0.8, (k) => { app.warp.amount = 0.4 * (1 - k); app.fovKick = 18 * (1 - k); });
    app.warp.amount = 0; app.fovKick = 0;
    switching = false;
    readout();
  }

  async function climb() {
    if (switching || mode !== 'city') return;
    switching = true;
    app.flash(1, 1.2, '#ffd2a0');
    app.sound.whoosh(1.2, false);
    toOrbit();
    app.rig.radius = PR + 8;
    await app.tween(1.4, (k) => { app.rig.goalRadius = PR + 8 + (125 - PR - 8) * (1 - Math.pow(1 - k, 3)); });
    switching = false;
  }

  function toOrbit() {
    mode = 'orbit'; boosting = false;
    orbit.visible = true; city.visible = false; stars.points.visible = true; sun.group.visible = true;
    sky.paint(SPACE);
    sun.dir.copy(orbitSun);
    orbitCamera(true);
    app.setActions(orbitActions);
    app.unfold();
    readout();
  }

  function toggleNight() {
    nightGoal = nightGoal ? 0 : 1;
    sky.paint(nightGoal ? NIGHT : DUSK);
    sun.group.visible = !nightGoal;
    app.action('time', { verb: nightGoal ? 'Back to dusk' : 'Let night fall' });
    app.sound.chime(nightGoal ? 0 : 4, 196, 0.12);
    readout();
  }

  function placeCamera(snap, dt) {
    camGoal.set(cx * 0.85, cy + 2.8, camZ + 10);
    if (snap) app.camera.position.copy(camGoal);
    else app.camera.position.lerp(camGoal, 1 - Math.exp(-dt * 8));
    look.set(cx, cy + 1.2 + cvy * 0.12, camZ - 40);
    app.camera.lookAt(look);
    app.camera.rotateZ(bank * 0.35);
  }

  return {
    scene,
    actions: orbitActions,
    usesArrows: true,
    enter() {
      this.actions = orbitActions;
      toOrbit();
    },
    leave() { boosting = false; switching = false; app.warp.amount = 0; app.fovKick = 0; app.rig.enabled = true; },
    resize() { if (mode === 'orbit') app.rig.fit = app.camera.aspect < 0.8 ? 1.5 : 1; },
    onPointerDown() {
      if (mode !== 'city') return false;
      steerP.set(0, 0); lastInput = app.time;
      return true;
    },
    onPointerMove(e, ndc, d) { steerP.set(clamp(d.ox / 90, -1, 1), clamp(d.oy / 90, -1, 1)); lastInput = app.time; },
    onPointerUp() { steerP.set(0, 0); },
    async demo(cue) {
      cue.say('A city the size of a planet.', 3);
      if (!(await cue.wait(3))) return;
      cue.press('dive');
      if (!(await cue.wait(4))) return;
      await cue.hold('boost', 3.5);
      if (!(await cue.wait(2.5))) return;
      cue.press('time');
      await cue.wait(6);
    },

    update(dt, t) {
      planet.rotation.y += dt * 0.012;
      planetMat.uniforms.uTime.value = t;
      orbit.userData.traffic.material.uniforms.uTime.value = t;

      if (mode === 'city') {
        // steering, with a lazy weave of its own when nobody is flying
        const K = app.keys;
        const kx = (K.has('d') || K.has('ArrowRight') ? 1 : 0) - (K.has('a') || K.has('ArrowLeft') ? 1 : 0);
        const ky = (K.has('s') || K.has('ArrowDown') ? 1 : 0) - (K.has('w') || K.has('ArrowUp') ? 1 : 0);
        if (kx || ky) lastInput = t;
        steer.set(clamp(steerP.x + kx, -1, 1), clamp(steerP.y + ky, -1, 1));
        if (t - lastInput > 4) steer.set(Math.sin(t * 0.31) * 0.5 - cx / 90, Math.sin(t * 0.17) * 0.4 + (cy - 260) / 260);
        const k = 1 - Math.exp(-dt * 3);
        cvx += (steer.x * 26 - cvx) * k;
        cvy += (-steer.y * 30 - cvy) * k;
        cx = clamp(cx + cvx * dt, -48, 48);
        cy = clamp(cy + cvy * dt, 45, 470);
        if (Math.abs(cx) >= 48) cvx = 0;
        speed += ((boosting ? 240 : 62) - speed) * (1 - Math.exp(-dt * 1.4));
        camZ -= speed * dt;
        if (camZ < -LZ * 3) camZ += LZ * 3;
        bank += (-cvx * 0.03 - bank) * (1 - Math.exp(-dt * 6));
        const boost = clamp((speed - 62) / 178, 0, 1);
        app.fovKick = boost * 16;
        app.warp.amount = switching ? app.warp.amount : Math.max(0, boost - 0.3) * 0.32;
        app.meter('boost', boost, boost > 0.8);
        if (Math.floor(t * 2) !== Math.floor((t - dt) * 2)) readout();

        speeder.group.position.set(cx, cy, camZ);
        speeder.group.rotation.set(cvy * 0.012, 0, bank * 0.9);
        speeder.glows.forEach((g) => { g.material.opacity = 0.7 + 0.3 * boost + 0.1 * Math.sin(t * 40); g.scale.setScalar(2 + boost * 2.5); });
        placeCamera(false, dt);

        night += (nightGoal - night) * (1 - Math.exp(-dt * 1.5));
        for (const u of [towerMat.uniforms, farMat.uniforms]) {
          u.uCamZ.value = camZ; u.uNight.value = night; u.uTime.value = t;
          u.uHaze.value.setRGB(0.3 - 0.24 * night, 0.17 - 0.12 * night, 0.2 - 0.1 * night);
          u.uDeep.value.setRGB(0.92 - 0.3 * night, 0.42 - 0.16 * night, 0.16 - 0.04 * night);
          u.uSunColor.value.setRGB(1.0, 0.6, 0.35);
        }
        carMat.uniforms.uCamZ.value = camZ; carMat.uniforms.uTime.value = t; carMat.uniforms.uNight.value = night;
        skyline.position.set(0, 0, camZ);
        smog.position.z = camZ;
        smog.material.color.setRGB(0.82 - 0.4 * night, 0.36 - 0.18 * night, 0.14 - 0.06 * night);
      }

      sky.follow(app.camera);
      stars.update(app.camera, t, app.px);
      sun.follow(app.camera);
    },
  };
}
