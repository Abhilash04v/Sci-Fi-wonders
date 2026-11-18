// The Death Star: a battle station the size of a small moon.
// Charge the superlaser at a lifeless moon, or dive into the trench and fly the run to the exhaust port.
import * as THREE from 'three';
import { makeSky, makeStars, makeSun, makeGlow } from '../core/sky.js';
import { makePlanet } from '../core/bodies.js';

export const meta = {
  id: 'deathstar',
  name: 'The Death Star',
  tag: 'A moon that is a weapon',
  blurb: 'A battle station the size of a small moon, built to destroy whole planets. For all its power it had one weak spot: a small exhaust port at the end of a long trench.',
  legend: true,
  screen: 1977,
  isNew: true,
  accent: '#ff5a4f',
  hint: 'Hold to charge the superlaser, or dive into the trench and fly the run.',
  bloom: { strength: 0.8, radius: 0.6, threshold: 0.62 },
  drone: 38.9,
};

// ---- the station
const R = 60;
const UP = new THREE.Vector3(0, 1, 0);
const DISH = new THREE.Vector3(0.42, 0.52, 0.74).normalize();
const DISH_A = 0.27;
const DISH_U = new THREE.Vector3().crossVectors(UP, DISH).normalize();
const DISH_V = new THREE.Vector3().crossVectors(DISH, DISH_U).normalize();
const FOCUS = DISH.clone().multiplyScalar(R + 15);
const MOON_AT = DISH.clone().multiplyScalar(210);

// ---- the trench (units are metres, near enough)
const HW = 9, TH = 22, SPEED = 74, RUN = 2300, LREP = 640;
const FX = 6.2, FY0 = 2.8, FY1 = 18.6;
const WIN_NEAR = 16, WIN_FAR = 125;

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const rnd = (a, b) => a + Math.random() * (b - a);

const HASH = /* glsl */ `float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }`;

const ST_VERT = /* glsl */ `
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
const ST_FRAG = /* glsl */ `
varying vec3 vObj;
varying vec3 vWN;
varying vec3 vWP;
uniform vec3 uSun, uSunColor, uDish, uDishU, uDishV;
uniform float uCharge, uFlash;
${HASH}
void main(){
  vec3 p = normalize(vObj);
  vec3 N = normalize(vWN);
  vec3 L = normalize(uSun);
  float lat = asin(clamp(p.y, -1.0, 1.0));
  float lon = atan(p.z, p.x);
  // panels in latitude rows, so they stay about the same size from equator to pole
  float rows = 64.0;
  float ry = (lat + 1.5707963) / 3.1415926 * rows;
  float r = floor(ry);
  float rowLat = (r + 0.5) / rows * 3.1415926 - 1.5707963;
  float cols = max(4.0, floor(rows * 2.0 * cos(rowLat)));
  float cx = (lon + 3.1415926) / 6.2831853 * cols;
  vec2 cell = vec2(r, floor(cx));
  vec2 f = vec2(fract(cx), fract(ry));
  float detail = 1.0 - smoothstep(0.08, 0.35, fwidth(ry));
  vec2 sub = floor(f * vec2(4.0, 3.0));
  vec2 fs = fract(f * vec2(4.0, 3.0));
  float tone = (0.36 + 0.07 * h21(cell)) * (0.95 + 0.1 * h21(cell * 3.7 + sub) * detail);
  float e1 = min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y));
  float e2 = min(min(fs.x, 1.0 - fs.x), min(fs.y, 1.0 - fs.y));
  tone *= mix(1.0, mix(0.72, 1.0, smoothstep(0.0, 0.05, e1)) * mix(0.9, 1.0, smoothstep(0.0, 0.08, e2)), detail);
  float lamp = step(0.84, h21(cell * 5.3 + sub * 1.7)) * (1.0 - smoothstep(0.1, 0.3, length(fs - 0.5))) * detail;

  // the superlaser dish: a bowl, so its light falls the opposite way to the rest of the sphere
  float dd = acos(clamp(dot(p, uDish), -1.0, 1.0));
  float inDish = 1.0 - smoothstep(${(DISH_A - 0.004).toFixed(4)}, ${DISH_A.toFixed(4)}, dd);
  vec3 bowl = normalize(uDish * 1.7 - p);
  N = normalize(mix(N, bowl, inDish));
  float ring = fract(dd / ${DISH_A.toFixed(4)} * 7.0);
  float ang = atan(dot(p, uDishV), dot(p, uDishU));
  float spoke = fract(ang / 6.2831853 * 24.0);
  float dishTone = 0.27 * mix(0.7, 1.0, smoothstep(0.0, 0.08, min(ring, 1.0 - ring))) * mix(0.86, 1.0, smoothstep(0.0, 0.06, min(spoke, 1.0 - spoke)));
  tone = mix(tone, dishTone, inDish);

  float diff = max(dot(N, L), 0.0);
  vec3 col = vec3(tone) * (pow(diff, 0.8) * 1.3 + 0.02) * uSunColor;
  col += vec3(0.04, 0.06, 0.1) * tone * (0.5 + 0.5 * N.y);
  vec3 V = normalize(cameraPosition - vWP);
  col += vec3(0.16, 0.2, 0.3) * pow(1.0 - max(dot(normalize(vWN), V), 0.0), 4.0) * 0.5;
  // the rim of the dish catches the light
  col += vec3(0.6) * (1.0 - smoothstep(0.0, 0.006, abs(dd - ${DISH_A.toFixed(4)}))) * max(dot(normalize(vWN), L), 0.0);
  float night = 1.0 - smoothstep(-0.15, 0.2, dot(normalize(vWN), L));
  col += vec3(1.0, 0.86, 0.62) * lamp * (0.2 + 1.3 * night) * (1.0 - inDish);

  // the equatorial trench
  float trench = 1.0 - smoothstep(0.013, 0.017, abs(lat));
  float tl = step(0.72, h21(vec2(floor(lon * 300.0), 1.0)));
  col = mix(col, vec3(0.012, 0.014, 0.02) + vec3(1.0, 0.8, 0.5) * tl * (0.15 + 0.6 * night), trench);
  col += vec3(0.5, 0.48, 0.45) * (1.0 - smoothstep(0.0, 0.002, abs(abs(lat) - 0.0165))) * diff;

  // the focus lens and its eight tributary emitters
  vec3 green = vec3(0.35, 1.0, 0.45);
  col += green * (1.0 - smoothstep(0.0, ${(DISH_A * 0.14).toFixed(4)}, dd)) * (0.12 + uCharge * 3.0);
  for (int k = 0; k < 8; k++){
    float a = float(k) * 0.7853982;
    vec3 e = normalize(uDish * ${Math.cos(DISH_A * 0.55).toFixed(5)} + (uDishU * cos(a) + uDishV * sin(a)) * ${Math.sin(DISH_A * 0.55).toFixed(5)});
    float de = acos(clamp(dot(p, e), -1.0, 1.0));
    col += green * (1.0 - smoothstep(0.0, 0.012, de)) * (0.25 + uCharge * 4.0);
  }
  col += vec3(1.0, 0.85, 0.65) * uFlash;
  gl_FragColor = vec4(col, 1.0);
}
`;

// ---- trench surfaces: the panel pattern is pinned to the trench, so it streams past as you fly
const TR_VERT = /* glsl */ `
varying vec3 vWP;
varying vec3 vN;
void main(){
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWP = wp.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;
const TR_FRAG = /* glsl */ `
varying vec3 vWP;
varying vec3 vN;
uniform float uS;
uniform vec3 uSun, uFog;
${HASH}
void main(){
  vec3 N = normalize(vN);
  vec2 uv = abs(N.x) > 0.5 ? vec2(vWP.z - uS, vWP.y) : abs(N.z) > 0.5 ? vec2(vWP.x, vWP.y) : vec2(vWP.x, vWP.z - uS);
  vec2 big = uv / vec2(12.0, 7.0);
  vec2 cb = floor(big), fb = fract(big);
  float hb = h21(cb);
  vec2 sm = uv / vec2(3.0, 1.75);
  vec2 cs = floor(sm), fs = fract(sm);
  float hs = h21(cs + 31.0);
  float tone = 0.25 + 0.16 * hb + 0.08 * hs;
  float eb = min(min(fb.x, 1.0 - fb.x), min(fb.y, 1.0 - fb.y));
  float es = min(min(fs.x, 1.0 - fs.x), min(fs.y, 1.0 - fs.y));
  tone *= mix(0.45, 1.0, smoothstep(0.0, 0.03, eb)) * mix(0.75, 1.0, smoothstep(0.0, 0.06, es));
  if (hb > 0.72) tone *= 0.55 + 0.45 * step(0.5, fract(fb.y * 6.0));
  float lamp = step(0.935, hs) * (1.0 - smoothstep(0.08, 0.22, length((fs - 0.5) * vec2(1.0, 1.8))));
  float diff = max(dot(N, normalize(uSun)), 0.0);
  float depth = N.y > 0.5 && vWP.y < 1.0 ? 0.55 : mix(0.4, 1.0, clamp(vWP.y / ${TH.toFixed(1)}, 0.0, 1.0));
  vec3 col = vec3(tone) * (0.08 + diff * 0.95) * depth * vec3(1.0, 0.98, 0.95);
  col += vec3(1.0, 0.75, 0.45) * lamp * 1.5;
  float dist = length(vWP - cameraPosition);
  col = mix(col, uFog, 1.0 - exp(-dist * 0.0042));
  gl_FragColor = vec4(col, 1.0);
}
`;

const GR_VERT = /* glsl */ `
attribute float aSeed;
uniform float uS;
varying vec3 vWP;
varying float vSeed;
void main(){
  vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
  float z0 = instanceMatrix[3].z;
  float zz = mod(z0 + uS, ${LREP.toFixed(1)}) - ${(LREP - 40).toFixed(1)};
  wp.z += zz - z0;
  vWP = wp.xyz;
  vSeed = aSeed;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;
const GR_FRAG = /* glsl */ `
varying vec3 vWP;
varying float vSeed;
uniform vec3 uSun, uFog;
void main(){
  vec3 N = normalize(cross(dFdx(vWP), dFdy(vWP)));
  float diff = max(dot(N, normalize(uSun)), 0.0);
  float tone = 0.2 + 0.28 * vSeed;
  float depth = mix(0.45, 1.0, clamp(vWP.y / ${TH.toFixed(1)}, 0.0, 1.0));
  vec3 col = vec3(tone) * (0.09 + diff) * depth;
  if (vSeed > 0.93) col += vec3(1.0, 0.6, 0.35) * 0.9;
  float dist = length(vWP - cameraPosition);
  col = mix(col, uFog, 1.0 - exp(-dist * 0.0042));
  gl_FragColor = vec4(col, 1.0);
}
`;

// ---- explosions
const BURST_VERT = /* glsl */ `
attribute vec3 aDir;
attribute float aSpeed;
attribute float aSeed;
uniform float uT, uR, uPx;
uniform vec3 uColA, uColB;
varying vec3 vColor;
void main(){
  float k = 1.0 - exp(-uT * (0.5 + aSpeed * 1.3));
  vec3 p = aDir * uR * aSpeed * k;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp((1.0 + aSeed * 2.2) * uPx * 320.0 / -mv.z, 1.0, 20.0);
  float life = smoothstep(0.0, 0.12, uT) * exp(-uT * 0.22);
  vColor = mix(uColA, uColB, aSeed) * life * (0.35 + 0.65 * aSpeed);
}
`;
const BURST_FRAG = /* glsl */ `
varying vec3 vColor;
void main(){
  float d = length(gl_PointCoord - 0.5);
  float a = 1.0 - smoothstep(0.0, 0.5, d);
  gl_FragColor = vec4(vColor * a * a, 1.0);
}
`;
const FB_VERT = /* glsl */ `
varying vec3 vN;
varying vec3 vV;
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}
`;
const FB_FRAG = /* glsl */ `
varying vec3 vN;
varying vec3 vV;
uniform vec3 uCol;
uniform float uFade;
void main(){
  float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
  gl_FragColor = vec4(uCol * (0.12 + 1.7 * f * f * f) * uFade, 1.0);
}
`;
const RING_VERT = /* glsl */ `
varying float vR;
void main(){ vR = length(position.xy); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const RING_FRAG = /* glsl */ `
varying float vR;
uniform vec3 uCol;
uniform float uFade;
void main(){
  float a = smoothstep(0.55, 0.97, vR) * (1.0 - smoothstep(0.97, 1.0, vR));
  gl_FragColor = vec4(uCol * a * a * uFade, 1.0);
}
`;

function makeBurst(n) {
  const dir = new Float32Array(n * 3), speed = new Float32Array(n), seed = new Float32Array(n);
  const v = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    v.randomDirection();
    dir.set([v.x, v.y, v.z], i * 3);
    speed[i] = Math.pow(Math.random(), 0.5);
    seed[i] = Math.random();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  geo.setAttribute('aDir', new THREE.BufferAttribute(dir, 3));
  geo.setAttribute('aSpeed', new THREE.BufferAttribute(speed, 1));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const mat = new THREE.ShaderMaterial({
    vertexShader: BURST_VERT, fragmentShader: BURST_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uT: { value: 0 }, uR: { value: 100 }, uPx: { value: 1 }, uColA: { value: new THREE.Color() }, uColB: { value: new THREE.Color() } },
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.visible = false;
  return {
    points,
    fire(pos, radius, a, b, px) {
      points.position.copy(pos);
      mat.uniforms.uR.value = radius; mat.uniforms.uT.value = 0; mat.uniforms.uPx.value = px;
      mat.uniforms.uColA.value.set(a); mat.uniforms.uColB.value.set(b);
      points.visible = true;
    },
    update(dt) { if (points.visible && (mat.uniforms.uT.value += dt) > 30) points.visible = false; },
    hide() { points.visible = false; },
  };
}

function makeShell(color) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), new THREE.ShaderMaterial({
    vertexShader: FB_VERT, fragmentShader: FB_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uCol: { value: new THREE.Color(color) }, uFade: { value: 0 } },
  }));
  mesh.visible = false;
  return mesh;
}
function makeRing(color) {
  const mesh = new THREE.Mesh(new THREE.RingGeometry(0.55, 1, 160, 1), new THREE.ShaderMaterial({
    vertexShader: RING_VERT, fragmentShader: RING_FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, uniforms: { uCol: { value: new THREE.Color(color) }, uFade: { value: 0 } },
  }));
  mesh.visible = false;
  return mesh;
}

// ---- a rebel fighter with four wings set in an X
function buildFighter() {
  const g = new THREE.Group();
  const hull = new THREE.MeshStandardMaterial({ color: '#dedad2', roughness: 0.55, metalness: 0.2, flatShading: true });
  const dark = new THREE.MeshStandardMaterial({ color: '#45464d', roughness: 0.6, metalness: 0.4, flatShading: true });
  const red = new THREE.MeshBasicMaterial({ color: new THREE.Color('#d8382c') });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.8, 3.2), hull);
  body.position.z = 0.5;
  const nose = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.6, 3.0, 4).rotateY(Math.PI / 4).rotateX(-Math.PI / 2), hull);
  nose.position.z = -2.5;
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.36, 1.1), new THREE.MeshStandardMaterial({ color: '#1a2129', roughness: 0.2, metalness: 0.8 }));
  canopy.position.set(0, 0.5, -0.3);
  const droid = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), new THREE.MeshStandardMaterial({ color: '#e8e8f0', roughness: 0.4 }));
  droid.position.set(0, 0.5, 0.65);
  g.add(body, nose, canopy, droid);
  const glows = [];
  for (const sx of [1, -1]) {
    for (const sy of [1, -1]) {
      const wing = new THREE.Group();
      const plate = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.08, 1.5), hull);
      plate.position.set(1.7, 0, 0.9);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.1, 0.55), red);
      stripe.position.set(1.5, 0, 0.55);
      const engine = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 2.0, 10).rotateX(Math.PI / 2), dark);
      engine.position.set(0.62, 0.3 * sy, 0.75);
      const gun = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.2, 6).rotateX(Math.PI / 2), dark);
      gun.position.set(3.15, 0, -0.35);
      const glow = makeGlow('#ff8a6a', 1.6, 0.9);
      glow.position.set(0.62, 0.3 * sy, 1.85);
      glows.push(glow);
      wing.add(plate, stripe, engine, gun, glow);
      wing.rotation.z = sy * 0.24;
      wing.scale.x = sx;
      g.add(wing);
    }
  }
  g.scale.setScalar(0.72);
  return { group: g, glows };
}

const MOONS = [
  { name: 'A lifeless grey moon', look: { ocean: '#3a3836', shallow: '#4a4744', landA: '#77716a', landB: '#5b564f', landC: '#a8a196', sea: -5, cloudAmt: 0, atmo: '#9a9a9a', haloGain: 0.12, seed: 4.4, scale: 2.2 } },
  { name: 'A frozen moon', look: { ocean: '#5a7a9a', shallow: '#9ac0dc', landA: '#d8e6f2', landB: '#aac4dc', landC: '#ffffff', sea: -0.15, cloudAmt: 0.1, atmo: '#bfe0ff', haloGain: 0.3, seed: 8.1, ice: 0.3 } },
  { name: 'A rust-red moon', look: { ocean: '#4a1c10', shallow: '#6a2c18', landA: '#9a4a2a', landB: '#6a3420', landC: '#d8945a', sea: -5, cloudAmt: 0.05, atmo: '#ff9a6a', haloGain: 0.2, seed: 13.3, scale: 1.8 } },
];

export function create(app) {
  const scene = new THREE.Scene();
  const sky = makeSky(app.renderer, { a: '#0d1530', b: '#1a0f2a', c: '#2a3c5a', base: '#010205', density: 0.3, dust: 0.6, gain: 0.45, seed: 31.7 });
  const stars = makeStars(5200);
  const sun = makeSun('#fff1dd', 170);
  const side = new THREE.Vector3().crossVectors(DISH, UP).normalize();
  const camDir = side.clone().multiplyScalar(0.85).addScaledVector(DISH, 0.4).addScaledVector(UP, 0.2).normalize();
  sun.dir.copy(DISH).multiplyScalar(0.6).addScaledVector(side, -0.6).addScaledVector(UP, 0.5).normalize();
  scene.add(sky.mesh, stars.points, sun.group);

  // ================================================================ the station
  const station = new THREE.Group();
  const stationMat = new THREE.ShaderMaterial({
    vertexShader: ST_VERT, fragmentShader: ST_FRAG,
    uniforms: {
      uSun: { value: sun.dir.clone() }, uSunColor: { value: new THREE.Color('#fff4e6') },
      uDish: { value: DISH }, uDishU: { value: DISH_U }, uDishV: { value: DISH_V },
      uCharge: { value: 0 }, uFlash: { value: 0 },
    },
  });
  station.add(new THREE.Mesh(new THREE.SphereGeometry(R, 160, 120), stationMat));
  scene.add(station);

  const green = new THREE.Color('#5dff7a');
  const beamGeo = new THREE.CylinderGeometry(1, 1, 1, 12, 1, true).translate(0, 0.5, 0);
  const tribMat = new THREE.MeshBasicMaterial({ color: green.clone().multiplyScalar(2.2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4, s = Math.sin(DISH_A * 0.55);
    const e = DISH.clone().multiplyScalar(Math.cos(DISH_A * 0.55)).addScaledVector(DISH_U, Math.cos(a) * s).addScaledVector(DISH_V, Math.sin(a) * s).normalize().multiplyScalar(R + 0.3);
    const d = FOCUS.clone().sub(e), len = d.length();
    const m = new THREE.Mesh(beamGeo, tribMat);
    m.position.copy(e); m.quaternion.setFromUnitVectors(UP, d.normalize()); m.scale.set(0.42, len, 0.42);
    station.add(m);
  }
  const focusGlow = makeGlow('#7dff9a', 30, 0);
  focusGlow.position.copy(FOCUS);
  station.add(focusGlow);
  const mainDir = MOON_AT.clone().sub(FOCUS), mainLen = mainDir.length();
  mainDir.normalize();
  const beamCore = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color('#e0ffe6').multiplyScalar(2.6), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  const beamHalo = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: green.clone().multiplyScalar(1.5), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  for (const b of [beamCore, beamHalo]) { b.position.copy(FOCUS); b.quaternion.setFromUnitVectors(UP, mainDir); b.visible = false; station.add(b); }

  let moonIndex = 0, moon = null;
  function placeMoon(i) {
    if (moon) { scene.remove(moon.group); moon.group.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); }); }
    moon = makePlanet(MOONS[i].look, 64);
    moon.group.position.copy(MOON_AT);
    moon.group.scale.setScalar(13);
    moon.setLight(sun.dir);
    scene.add(moon.group);
  }
  placeMoon(0);

  const moonBurst = makeBurst(app.coarse ? 2500 : 4500);
  const moonRing = makeRing('#ffd0a0');
  const moonFlash = makeGlow('#fff0d0', 90, 0);
  moonFlash.position.copy(MOON_AT);
  moonRing.position.copy(MOON_AT);
  moonRing.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), mainDir);
  scene.add(moonBurst.points, moonRing, moonFlash);

  const boomBurst = makeBurst(app.coarse ? 5000 : 9000);
  const boomShell = makeShell('#ff8a3a');
  const boomRing = makeRing('#ffe2b0');
  boomRing.rotation.set(-Math.PI / 2 + 0.35, 0.2, 0);
  const boomFlash = makeGlow('#fff4e0', 260, 0);
  const sparks = Array.from({ length: 7 }, () => { const s = makeGlow('#ffb070', 30, 0); scene.add(s); return s; });
  scene.add(boomBurst.points, boomShell, boomRing, boomFlash);

  // ================================================================ the trench
  const trench = new THREE.Group();
  trench.visible = false;
  scene.add(trench);
  const trenchSun = new THREE.Vector3(0.45, 0.85, -0.25).normalize();
  const fog = new THREE.Color('#05070c');
  const panelMat = new THREE.ShaderMaterial({
    vertexShader: TR_VERT, fragmentShader: TR_FRAG,
    uniforms: { uS: { value: 0 }, uSun: { value: trenchSun }, uFog: { value: fog } },
  });
  const LEN = 1100;
  const wallGeo = new THREE.PlaneGeometry(LEN, TH);
  const leftWall = new THREE.Mesh(wallGeo, panelMat);
  leftWall.rotation.y = Math.PI / 2; leftWall.position.set(-HW, TH / 2, -LEN / 2 + 60);
  const rightWall = new THREE.Mesh(wallGeo, panelMat);
  rightWall.rotation.y = -Math.PI / 2; rightWall.position.set(HW, TH / 2, -LEN / 2 + 60);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(HW * 2, LEN), panelMat);
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, -LEN / 2 + 60);
  trench.add(leftWall, rightWall, floor);
  for (const s of [1, -1]) {
    const top = new THREE.Mesh(new THREE.PlaneGeometry(700, LEN), panelMat);
    top.rotation.x = -Math.PI / 2; top.position.set(s * (HW + 350), TH, -LEN / 2 + 60);
    trench.add(top);
  }
  trench.add(new THREE.HemisphereLight('#8090b0', '#1a1a22', 1.2));
  const key = new THREE.DirectionalLight('#fff2e0', 2.4);
  key.position.copy(trenchSun);
  trench.add(key);

  // greebles: pipes, vents and boxes on every surface, wrapped so the trench never ends
  const GN = 900, seeds = new Float32Array(GN);
  const greebleGeo = new THREE.BoxGeometry(1, 1, 1);
  greebleGeo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
  const greebles = new THREE.InstancedMesh(greebleGeo, new THREE.ShaderMaterial({
    vertexShader: GR_VERT, fragmentShader: GR_FRAG, uniforms: { uS: panelMat.uniforms.uS, uSun: { value: trenchSun }, uFog: { value: fog } },
  }), GN);
  {
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3();
    for (let i = 0; i < GN; i++) {
      const r = Math.random(), z0 = Math.random() * LREP;
      if (r < 0.66) {
        const s = r < 0.33 ? -1 : 1, dx = rnd(0.25, 0.9);
        sc.set(dx, rnd(0.5, 3.6), rnd(1, 8));
        p.set(s * (HW - dx / 2), rnd(1, TH - 1), z0);
      } else if (r < 0.8) {
        const dy = rnd(0.2, 1.1);
        sc.set(rnd(1, 5), dy, rnd(1, 6));
        p.set(rnd(-HW + 1.5, HW - 1.5), dy / 2, z0);
      } else {
        const s = Math.random() < 0.5 ? -1 : 1, dy = rnd(0.5, 3.8);
        sc.set(rnd(1, 6), dy, rnd(1, 7));
        p.set(s * (HW + rnd(1, 16)), TH + dy / 2, z0);
      }
      greebles.setMatrixAt(i, m4.compose(p, q, sc));
      seeds[i] = Math.random();
    }
  }
  greebles.frustumCulled = false;
  trench.add(greebles);

  // obstacles: bulkheads and beams across the trench
  const obstacleMeshes = Array.from({ length: 6 }, () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), panelMat);
    const lamp = makeGlow('#ff3a2a', 3, 0.9);
    mesh.visible = lamp.visible = false;
    trench.add(mesh, lamp);
    return { mesh, lamp };
  });

  // turrets on the rim and walls
  const turretMat = new THREE.MeshStandardMaterial({ color: '#7d7f86', roughness: 0.7, metalness: 0.3, flatShading: true });
  const turretMeshes = Array.from({ length: 10 }, () => {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.4, 2.2), turretMat);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.95, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), turretMat);
    dome.position.y = 0.7;
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 2.4, 6).rotateX(Math.PI / 2), turretMat);
    barrel.position.set(0, 1.1, 1.2);
    const lamp = makeGlow('#ff4a3a', 1.6, 0.8);
    lamp.position.y = 1.7;
    g.add(base, dome, barrel, lamp);
    g.visible = false;
    trench.add(g);
    return g;
  });

  // shots
  const boltGeo = new THREE.CylinderGeometry(0.17, 0.17, 4.5, 6).rotateX(Math.PI / 2);
  const mkShot = (color) => {
    const m = new THREE.Mesh(boltGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(2.4), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.visible = false;
    trench.add(m);
    return { m, p: new THREE.Vector3(), v: new THREE.Vector3(), prev: new THREE.Vector3(), life: 0, on: false };
  };
  const bolts = Array.from({ length: 40 }, () => mkShot('#6dff86'));
  const lasers = Array.from({ length: 24 }, () => mkShot('#ff4a3a'));
  const pops = Array.from({ length: 8 }, () => { const s = makeGlow('#ffb070', 8, 0); trench.add(s); return { s, t: 9, p: new THREE.Vector3() }; });
  const torps = Array.from({ length: 2 }, () => { const s = makeGlow('#bfe0ff', 3.4, 0); trench.add(s); return { s, on: false, t: 0, from: new THREE.Vector3(), hit: false, p: new THREE.Vector3() }; });

  // the exhaust port
  const port = new THREE.Group();
  const hole = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#000000' }));
  hole.position.y = 0.04;
  port.add(hole);
  for (let i = 0; i < 8; i++) {
    const l = makeGlow('#ffb347', 1.4, 0.9);
    const a = (i / 8) * Math.PI * 2;
    l.position.set(Math.cos(a) * 2.6, 0.3, Math.sin(a) * 2.6);
    port.add(l);
  }
  port.visible = false;
  trench.add(port);

  const fighter = buildFighter();
  trench.add(fighter.group);

  // the targeting computer
  const tc = document.createElement('canvas');
  tc.className = 'tcomp'; tc.width = 420; tc.height = 312; tc.hidden = true;
  tc.setAttribute('aria-hidden', 'true');
  document.getElementById('app').append(tc);
  const tg = tc.getContext('2d');

  // ================================================================ state
  let mode = 'station';
  let laser = 'idle', charge = 0, holding = false, lt = 0;
  let S = 0, fx = 0, fy = 10, fvx = 0, fvy = 0, bank = 0, shields = 4, volleys = 2, kills = 0, phase = 'fly', pt = 0, hurt = 0, shake = 0;
  let obstacles = [], turrets = [], auto = false, bt = 0, nextShot = 0, switching = false;
  const steerP = new THREE.Vector2(), steer = new THREE.Vector2();
  const look = new THREE.Vector3(), camPos = new THREE.Vector3(), v = new THREE.Vector3(), w = new THREE.Vector3();
  const fmt = (n) => Math.max(0, Math.round(n)).toLocaleString('en-US');

  function readout() {
    if (mode === 'station') {
      app.readout(laser === 'gone' ? 'Target destroyed' : laser === 'charging' ? `Superlaser charging ${Math.round(charge * 100)}%` : `Target · ${MOONS[moonIndex].name}`);
    } else if (mode === 'run') {
      app.readout(`Shields ${shields} of 4 · Exhaust port ${fmt(RUN - S)} m${kills ? ` · Turrets ${kills}` : ''}`);
    }
  }

  // ---------------------------------------------------------------- station mode
  function stationCamera(snap) {
    const portrait = app.camera.aspect < 0.8;
    app.rig.enabled = true;
    app.rig.set({
      target: DISH.clone().multiplyScalar(portrait ? 98 : 90), theta: Math.atan2(camDir.x, camDir.z), phi: Math.acos(camDir.y),
      radius: 270, snap, auto: app.reduced ? 0 : 0.012, minPhi: 0.3, maxPhi: Math.PI - 0.3, minRadius: 120, maxRadius: 600, damping: 3,
    });
    app.rig.roll = portrait ? -Math.PI / 2 : 0;
    app.rig.fit = portrait ? 1.6 : Math.max(1, 1.45 / app.camera.aspect);
  }

  const stationActions = [
    {
      id: 'laser', verb: 'Charge the superlaser', how: 'Hold', kind: 'hold', key: ' ',
      down() {
        if (laser === 'gone') { nextMoon(); return; }
        if (laser !== 'idle') return;
        holding = true; laser = 'charging';
        app.sound.startCharge(30);
      },
      up() {
        holding = false;
        if (laser === 'charging') { laser = 'idle'; app.sound.stopCharge(); }
      },
    },
    { id: 'run', verb: 'Fly the trench run', how: 'Tap', kind: 'tap', key: 'r', down() { startRun(); } },
  ];
  const runActions = [
    { id: 'fire', verb: 'Fire', how: 'Tap · Space', kind: 'tap', key: ' ', down() { fire(); } },
    { id: 'leave', verb: 'Pull out', how: 'Tap', kind: 'tap', key: 'q', down() { toStation(); } },
  ];
  const afterActions = [
    { id: 'again', verb: 'Fly it again', how: 'Tap', kind: 'tap', key: ' ', down() { startRun(); } },
    { id: 'back', verb: 'Back to the station', how: 'Tap', kind: 'tap', key: 'q', down() { toStation(); } },
  ];

  function fireSuperlaser() {
    laser = 'firing'; lt = 0; holding = false;
    app.sound.stopCharge();
    app.sound.tone({ freq: 180, to: 40, dur: 2.4, gain: 0.32, type: 'sawtooth' });
    app.sound.noise({ dur: 2.2, gain: 0.3, from: 3000, to: 200 });
    beamCore.visible = beamHalo.visible = true;
    app.shake(0.6);
  }
  function moonHit() {
    moon.group.visible = false;
    moonBurst.fire(MOON_AT, 140, '#ffb070', '#8a8278', app.px);
    moonRing.visible = true; moonRing.scale.setScalar(1);
    moonRing.quaternion.copy(app.camera.quaternion);
    moonFlash.material.opacity = 1;
    app.flash(0.35, 1.2, '#eaffe8');
    app.sound.boom(1.2);
    app.shake(1);
  }
  function nextMoon() {
    moonIndex = (moonIndex + 1) % MOONS.length;
    placeMoon(moonIndex);
    moon.group.scale.setScalar(0.01);
    laser = 'arriving'; lt = 0;
    moonBurst.hide(); moonRing.visible = false;
    app.action('laser', { verb: 'Charge the superlaser', how: 'Hold' });
    readout();
  }

  // ---------------------------------------------------------------- the run
  function startRun() {
    if (switching) return;
    mode = 'run'; phase = 'fly'; pt = 0;
    S = 0; fx = 0; fy = 10; fvx = fvy = 0; bank = 0; shields = 4; volleys = 2; kills = 0; hurt = 0; shake = 0; nextShot = 0;
    obstacles = [];
    for (let d = 330; d < RUN - 240; d += rnd(170, 250)) obstacles.push({ d, type: ['low', 'high', 'left', 'right'][(Math.random() * 4) | 0], done: false });
    turrets = [];
    for (let d = 200; d < RUN - 120; d += rnd(130, 200)) {
      const s = Math.random() < 0.5 ? -1 : 1, rim = Math.random() < 0.6;
      turrets.push({ d, x: rim ? s * (HW + 2.4) : s * (HW - 0.9), y: rim ? TH + 0.7 : 13.5, alive: true, next: rnd(0, 0.8) });
    }
    for (const s of [...bolts, ...lasers]) { s.on = false; s.m.visible = false; }
    for (const t of torps) { t.on = false; t.s.material.opacity = 0; }
    station.visible = false; moon.group.visible = false; trench.visible = true;
    boomBurst.hide(); boomShell.visible = boomRing.visible = false; boomFlash.material.opacity = 0;
    app.rig.enabled = false;
    app.baseFov = 64;
    app.flash(1, 0.9, '#000000');
    app.sound.whoosh(1.0, true);
    app.setActions(runActions);
    app.fold();
    app.hint('Drag or use the arrow keys to dodge. Fire at turrets. Fire torpedoes when the computer turns red.');
    tc.hidden = true;
    readout();
  }

  function toStation() {
    mode = 'station'; phase = 'fly';
    trench.visible = false; station.visible = true; tc.hidden = true;
    moon.group.visible = laser !== 'gone';
    boomBurst.hide(); boomShell.visible = boomRing.visible = false; boomFlash.material.opacity = 0;
    for (const s of sparks) s.material.opacity = 0;
    stationMat.uniforms.uFlash.value = 0;
    app.baseFov = 50; app.fovKick = 0;
    stationCamera(true);
    app.flash(1, 0.9, '#000000');
    app.setActions(stationActions);
    if (laser === 'gone') app.action('laser', { verb: 'Bring the next moon', how: 'Tap' });
    app.hint(meta.hint);
    app.unfold();
    readout();
  }

  function fire() {
    if (mode !== 'run' || phase !== 'fly') return;
    const dp = RUN - S;
    if (dp < 600 && volleys > 0) { launchTorpedoes(dp); return; }
    for (const sx of [-1, 1]) {
      const l = lasers.find((s) => !s.on);
      if (!l) break;
      l.on = true; l.life = 0;
      l.p.set(fx + sx * 2.3, fy - 0.1, -S - 1);
      l.prev.copy(l.p);
      l.v.set(fvx * 0.3, fvy * 0.3, -SPEED - 430);
      l.m.visible = true;
    }
    app.sound.tone({ freq: 1500, to: 320, dur: 0.16, gain: 0.05, type: 'square' });
  }

  function launchTorpedoes(dp) {
    volleys--;
    const good = dp >= WIN_NEAR && dp <= WIN_FAR;
    torps.forEach((t, i) => {
      t.on = true; t.t = -i * 0.08; t.hit = good;
      t.from.set(fx + (i ? 0.6 : -0.6), fy - 0.6, -S - 2);
    });
    app.sound.tone({ freq: 420, to: 120, dur: 0.5, gain: 0.14, type: 'triangle' });
    if (good) { phase = 'torpedo'; pt = 0; }
    else if (dp > WIN_FAR) app.toast(volleys ? 'Too early. The torpedoes hit the surface. One more try.' : 'Too early. The torpedoes hit the surface.', 2.6);
    else app.toast('Too late. You are right on top of it.', 2.4);
  }

  function fail(text) {
    if (phase !== 'fly') return;
    phase = 'failed'; pt = 0;
    app.toast(text, 3);
    app.sound.tone({ freq: 200, to: 60, dur: 1.2, gain: 0.16, type: 'sawtooth' });
  }

  function hit() {
    if (hurt > 0) return;
    hurt = 0.7; shields--; shake = 1;
    app.flash(0.3, 0.5, '#ff3a26');
    app.sound.noise({ dur: 0.5, gain: 0.35, from: 2400, to: 200 });
    app.sound.tone({ freq: 90, to: 40, dur: 0.5, gain: 0.25 });
    readout();
    if (shields <= 0) fail('Your shields are gone. Pull out and try again.');
  }

  // how close the segment a-b passes to the point p
  const sa = new THREE.Vector3(), sb = new THREE.Vector3(), tpos = new THREE.Vector3();
  const segDist = (a, b, p) => {
    sa.subVectors(b, a);
    const l2 = sa.lengthSq();
    const k = l2 > 0 ? clamp(sb.subVectors(p, a).dot(sa) / l2, 0, 1) : 0;
    return sb.copy(a).addScaledVector(sa, k).distanceTo(p);
  };

  function shootAt(t) {
    const b = bolts.find((s) => !s.on);
    if (!b) return;
    const P = new THREE.Vector3(t.x, t.y + 1.1, -t.d), F = new THREE.Vector3(fx, fy, -S), V = new THREE.Vector3(fvx, fvy, -SPEED);
    const u = 150, D = F.clone().sub(P);
    const a = V.lengthSq() - u * u, bb = 2 * D.dot(V), c = D.lengthSq();
    const disc = Math.sqrt(Math.max(0, bb * bb - 4 * a * c));
    const t1 = (-bb + disc) / (2 * a), t2 = (-bb - disc) / (2 * a);
    const ti = Math.max(t1, t2) > 0 ? (t1 > 0 && t2 > 0 ? Math.min(t1, t2) : Math.max(t1, t2)) : 1;
    const aim = F.addScaledVector(V, ti);
    aim.x += rnd(-2.2, 2.2); aim.y += rnd(-2.2, 2.2);
    b.on = true; b.life = 0;
    b.p.copy(P); b.prev.copy(P);
    b.v.copy(aim.sub(P).divideScalar(ti));
    b.m.visible = true;
  }

  function drawComputer(dp, live, t) {
    const W = tc.width, H = tc.height, cx = W / 2, cy = H * 0.44;
    tg.clearRect(0, 0, W, H);
    tg.fillStyle = 'rgba(10, 6, 2, 0.8)';
    tg.fillRect(0, 0, W, H);
    const col = live ? '#ff5a4f' : '#ffb347';
    tg.strokeStyle = col; tg.fillStyle = col; tg.lineWidth = 2;
    const box = (q) => { const bw = W * 0.46 * q, bh = H * 0.36 * q; return [cx - bw, cy - bh, bw * 2, bh * 2]; };
    const near = box(1), far = box(0.05);
    tg.globalAlpha = 0.8;
    tg.beginPath();
    for (const [ax, ay] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      tg.moveTo(near[0] + near[2] * ax, near[1] + near[3] * ay);
      tg.lineTo(far[0] + far[2] * ax, far[1] + far[3] * ay);
    }
    tg.stroke();
    const ph = (S % 40) / 40;
    for (let i = 0; i < 10; i++) {
      const q = 16 / (16 + (i + 1 - ph) * 40);
      tg.globalAlpha = 0.2 + 0.7 * q;
      const [x, y, bw, bh] = box(q);
      tg.strokeRect(x, y, bw, bh);
    }
    if (dp < 700) {
      const q = 16 / (16 + Math.max(0, dp)), [, y, , bh] = box(q);
      tg.globalAlpha = 1;
      tg.fillRect(cx - 40 * q, y + bh - 14 * q, 80 * q, 10 * q);
    }
    tg.globalAlpha = 1;
    const r = 30 + (live ? 6 * Math.sin(t * 22) : 0);
    tg.beginPath(); tg.arc(cx, cy + H * 0.12, r, 0, Math.PI * 2); tg.stroke();
    tg.beginPath(); tg.moveTo(cx - r - 14, cy + H * 0.12); tg.lineTo(cx + r + 14, cy + H * 0.12); tg.stroke();
    tg.textAlign = 'center';
    tg.font = '600 38px Michroma, monospace';
    tg.fillText(String(Math.max(0, Math.round(dp))).padStart(4, '0'), cx, H - 20);
    tg.font = '600 15px Michroma, monospace';
    tg.fillText(live ? 'FIRE NOW' : volleys ? 'RANGE' : 'NO TORPEDOES', cx, 28);
  }

  // ---------------------------------------------------------------- the station blows
  function startBoom() {
    mode = 'boom'; bt = 0;
    trench.visible = false; tc.hidden = true; station.visible = true;
    moon.group.visible = laser !== 'gone';
    app.baseFov = 50; app.fovKick = 0;
    app.rig.enabled = true;
    app.rig.set({ target: new THREE.Vector3(0, 0, 0), theta: Math.atan2(camDir.x, camDir.z) + 0.5, phi: 1.25, radius: 420, snap: true, auto: 0.02, minRadius: 200, maxRadius: 900 });
    app.rig.roll = 0;
    app.rig.fit = Math.max(1, 1.3 / app.camera.aspect);
    sparks.forEach((s) => { s.position.copy(v.randomDirection().multiplyScalar(R + 1)); s.material.opacity = 0; });
    app.flash(1, 1.4, '#ffffff');
    app.setActions([]);
    app.readout('');
  }

  // ================================================================ the scene object
  return {
    scene,
    actions: stationActions,
    usesArrows: true,
    enter() {
      mode = 'station'; laser = laser === 'charging' ? 'idle' : laser;
      trench.visible = false; station.visible = true; tc.hidden = true;
      moon.group.visible = laser !== 'gone';
      app.baseFov = 50;
      stationCamera(true);
      this.actions = stationActions;
      app.setActions(stationActions);
      if (laser === 'gone') app.action('laser', { verb: 'Bring the next moon', how: 'Tap' });
      readout();
    },
    leave() {
      app.sound.stopCharge();
      holding = false; auto = false;
      if (laser === 'charging') laser = 'idle';
      tc.hidden = true;
      app.baseFov = 50; app.bloomKick = 0;
      app.rig.enabled = true;
    },
    resize() { if (mode === 'station') { const p = app.camera.aspect < 0.8; app.rig.roll = p ? -Math.PI / 2 : 0; app.rig.fit = p ? 1.6 : Math.max(1, 1.45 / app.camera.aspect); } },
    dispose() { tc.remove(); },
    onPointerDown() {
      if (mode !== 'run') return false;
      steerP.set(0, 0); auto = false;
      return true;
    },
    onPointerMove(e, ndc, d) { if (mode === 'run') steerP.set(clamp(d.ox / 80, -1, 1), clamp(d.oy / 80, -1, 1)); },
    onPointerUp() { steerP.set(0, 0); },
    async demo(cue) {
      cue.say('The superlaser: eight beams become one.', 3.5);
      await cue.wait(1.5);
      await cue.hold('laser', 6, () => laser === 'firing');
      if (!(await cue.wait(5))) return;
      cue.press('laser');
      if (!(await cue.wait(2))) return;
      cue.press('run');
      auto = true;
      cue.say('Now the trench run.', 3);
      for (let i = 0; i < 26 && cue.live() && mode === 'run'; i++) {
        if (i % 2 === 0 && RUN - S > 600) cue.press('fire');
        await cue.wait(0.6);
      }
      auto = false;
      if (cue.live() && mode === 'run') cue.press('leave');
    },

    update(dt, t) {
      // ---------------------------------------------------------------- station and superlaser
      if (mode !== 'run') {
        lt += dt;
        if (laser === 'charging') {
          charge = Math.min(1, charge + dt / 2.6);
          app.sound.setCharge(charge);
          app.shake(charge * 0.12);
          if (charge >= 1) fireSuperlaser();
        } else if (laser !== 'firing') charge = Math.max(0, charge - dt * 1.5);
        app.meter('laser', laser === 'firing' ? 1 : charge, charge > 0.9);
        if (laser === 'firing') {
          const k = clamp(lt / 0.42, 0, 1);
          beamCore.scale.set(1.1, Math.max(0.01, mainLen * k), 1.1);
          beamHalo.scale.set(3.4, Math.max(0.01, mainLen * k), 3.4);
          const fade = lt < 1.3 ? 1 : clamp(1 - (lt - 1.3) / 0.7, 0, 1);
          beamCore.material.opacity = fade; beamHalo.material.opacity = 0.35 * fade;
          if (lt >= 0.42 && moon.group.visible) moonHit();
          if (lt > 2.0) {
            laser = 'gone'; charge = 0;
            beamCore.visible = beamHalo.visible = false;
            app.action('laser', { verb: 'Bring the next moon', how: 'Tap' });
            readout();
          }
        } else if (laser === 'arriving') {
          const k = clamp(lt / 1.6, 0, 1);
          moon.group.scale.setScalar(13 * (1 - Math.pow(1 - k, 3)));
          if (k >= 1) { laser = 'idle'; readout(); }
        }
        if (laser === 'charging') readout();
        tribMat.opacity = laser === 'firing' ? clamp(1 - (lt - 0.6) / 0.6, 0, 1) : charge;
        focusGlow.material.opacity = laser === 'firing' ? clamp(1.2 - lt, 0, 1) : charge * 0.9;
        focusGlow.scale.setScalar(12 + charge * 26);
        stationMat.uniforms.uCharge.value = laser === 'firing' ? clamp(1 - lt, 0, 1) : charge;
        app.bloomKick = charge * 0.3 + (laser === 'firing' ? clamp(0.8 - lt * 0.4, 0, 0.8) : 0);
        moonBurst.update(dt);
        if (moonRing.visible) {
          const age = moonBurst.points.material.uniforms.uT.value;
          moonRing.scale.setScalar(12 + age * 46);
          moonRing.material.uniforms.uFade.value = Math.max(0, 0.7 - age / 2.2);
          if (age > 1.6) moonRing.visible = false;
        }
        moonFlash.material.opacity = Math.max(0, moonFlash.material.opacity - dt * 0.8);
        if (moon.group.visible) { moon.body.rotation.y += dt * 0.02; moon.tick(t); }
      }

      // ---------------------------------------------------------------- the station explodes
      if (mode === 'boom') {
        bt += dt;
        if (bt < 1.7) {
          sparks.forEach((s, i) => {
            const on = bt > 0.3 + i * 0.17;
            s.material.opacity = on ? 0.6 + 0.4 * Math.sin(t * 30 + i) : 0;
            s.scale.setScalar(on ? 18 + (bt - 0.3 - i * 0.17) * 40 : 1);
          });
          stationMat.uniforms.uFlash.value = Math.max(0, bt - 1.0) * 0.6;
          if (bt > 0.3 && bt - dt <= 0.3) app.sound.boom(0.4);
        } else if (station.visible) {
          station.visible = false;
          sparks.forEach((s) => { s.material.opacity = 0; });
          boomBurst.fire(new THREE.Vector3(), 480, '#ffb070', '#ffe6c0', app.px);
          boomShell.visible = boomRing.visible = true;
          boomFlash.material.opacity = 1;
          app.flash(1, 2.4, '#fff8ee');
          app.sound.boom(1.8);
          app.shake(2.2);
        }
        if (!station.visible) {
          const age = bt - 1.7;
          boomShell.scale.setScalar(R + age * 70);
          boomShell.material.uniforms.uFade.value = Math.max(0, 1.4 - age * 0.3);
          boomRing.scale.setScalar(20 + age * 260);
          boomRing.material.uniforms.uFade.value = Math.max(0, 1.4 - age * 0.35);
          boomFlash.material.opacity = Math.max(0, 1 - age * 0.5);
          boomFlash.scale.setScalar(260 + age * 120);
          app.bloomKick = Math.max(0, 0.9 - age * 0.25);
          boomBurst.update(dt);
          if (age > 5 && age - dt <= 5) {
            app.toast('The station is gone. That run will be remembered.', 4);
            app.setActions(afterActions);
            app.action('back', { verb: 'Rebuild the station' });
          }
        }
      }

      // ---------------------------------------------------------------- the trench run
      if (mode === 'run') {
        pt += dt;
        // steering
        const K = app.keys;
        const kx = (K.has('d') || K.has('ArrowRight') ? 1 : 0) - (K.has('a') || K.has('ArrowLeft') ? 1 : 0);
        const ky = (K.has('s') || K.has('ArrowDown') ? 1 : 0) - (K.has('w') || K.has('ArrowUp') ? 1 : 0);
        steer.set(clamp(steerP.x + kx, -1, 1), clamp(steerP.y + ky, -1, 1));
        if (auto) {
          // the tour's pilot: read the next obstacle and move to the open side
          const next = obstacles.find((o) => o.d > S - 2 && o.d - S < 240);
          let tx = 0, ty = 10;
          if (next) {
            if (next.type === 'low') ty = 15.5; else if (next.type === 'high') ty = 6;
            else if (next.type === 'left') tx = 3.8; else tx = -3.8;
          }
          steer.set(clamp((tx - fx) / 3, -1, 1), clamp(-(ty - fy) / 3, -1, 1));
        }
        const k = 1 - Math.exp(-dt * 6);
        fvx += (steer.x * 17 - fvx) * k;
        fvy += (-steer.y * 14 - fvy) * k;
        if (phase === 'escape') fvy += (60 - fvy) * (1 - Math.exp(-dt * 2));
        fx = clamp(fx + fvx * dt, -FX, FX);
        fy = phase === 'escape' ? fy + fvy * dt : clamp(fy + fvy * dt, FY0, FY1);
        if (Math.abs(fx) >= FX) fvx = 0;
        bank += (-fvx * 0.05 - bank) * (1 - Math.exp(-dt * 8));
        const before = S;
        S += SPEED * dt;
        panelMat.uniforms.uS.value = S;
        const dp = RUN - S;

        // obstacles
        let oi = 0;
        for (const o of obstacles) {
          const z = S - o.d;
          if (!o.done && before < o.d && S >= o.d) {
            o.done = true;
            const m = 1.0;
            const blocked = o.type === 'low' ? fy < 11 + m : o.type === 'high' ? fy > 11 - m : o.type === 'left' ? fx < 0.5 + m : fx > -0.5 - m;
            if (blocked && phase === 'fly') hit();
          }
          if (z < -560 || z > 30 || oi >= obstacleMeshes.length) continue;
          const { mesh, lamp } = obstacleMeshes[oi++];
          mesh.visible = lamp.visible = true;
          if (o.type === 'low') { mesh.position.set(0, 5.5, z); mesh.scale.set(HW * 2, 11, 2.4); lamp.position.set(0, 11.3, z + 1.3); }
          else if (o.type === 'high') { mesh.position.set(0, 16.5, z); mesh.scale.set(HW * 2, 11, 2.4); lamp.position.set(0, 10.7, z + 1.3); }
          else if (o.type === 'left') { mesh.position.set((-HW + 0.5) / 2, TH / 2, z); mesh.scale.set(HW + 0.5, TH, 2.4); lamp.position.set(0.8, TH / 2, z + 1.3); }
          else { mesh.position.set((HW - 0.5) / 2, TH / 2, z); mesh.scale.set(HW + 0.5, TH, 2.4); lamp.position.set(-0.8, TH / 2, z + 1.3); }
          lamp.material.opacity = 0.55 + 0.45 * Math.sin(t * 9);
        }
        for (; oi < obstacleMeshes.length; oi++) obstacleMeshes[oi].mesh.visible = obstacleMeshes[oi].lamp.visible = false;

        // turrets
        let ti = 0;
        for (const tu of turrets) {
          const ahead = tu.d - S;
          if (tu.alive && phase === 'fly' && ahead > 55 && ahead < 330 && (tu.next -= dt) <= 0) { shootAt(tu); tu.next = rnd(1.0, 1.7); }
          if (!tu.alive || ahead < -30 || ahead > 560 || ti >= turretMeshes.length) continue;
          const g = turretMeshes[ti++];
          g.visible = true;
          g.position.set(tu.x, tu.y, -ahead);
          g.lookAt(fx, fy, 0);
          g.rotation.x = 0; g.rotation.z = 0;
        }
        for (; ti < turretMeshes.length; ti++) turretMeshes[ti].visible = false;

        // enemy bolts
        const F = new THREE.Vector3(fx, fy, -S);
        for (const b of bolts) {
          if (!b.on) continue;
          b.prev.copy(b.p);
          b.p.addScaledVector(b.v, dt);
          b.life += dt;
          if (phase === 'fly' && segDist(b.prev, b.p, F) < 1.5) { hit(); b.on = false; }
          if (b.p.z > -S + 30 || b.life > 4) b.on = false;
          b.m.visible = b.on;
          if (b.on) { b.m.position.set(b.p.x, b.p.y, b.p.z + S); b.m.lookAt(b.p.x + b.v.x, b.p.y + b.v.y, b.p.z + S + b.v.z); }
        }
        // our lasers
        for (const l of lasers) {
          if (!l.on) continue;
          l.prev.copy(l.p);
          l.p.addScaledVector(l.v, dt);
          l.life += dt;
          for (const tu of turrets) {
            if (!tu.alive || Math.abs(tu.d + l.p.z) > 40) continue;
            tpos.set(tu.x, tu.y + 1, -tu.d);
            if (segDist(l.prev, l.p, tpos) < 3.2) {
              tu.alive = false; l.on = false; kills++;
              const pop = pops.find((p) => p.t > 1) ?? pops[0];
              pop.t = 0; pop.p.set(tu.x, tu.y + 1, -tu.d);
              app.sound.noise({ dur: 0.6, gain: 0.25, from: 1800, to: 120 });
              readout();
              break;
            }
          }
          if (l.life > 1.1) l.on = false;
          l.m.visible = l.on;
          if (l.on) { l.m.position.set(l.p.x, l.p.y, l.p.z + S); l.m.rotation.set(0, 0, 0); }
        }
        for (const p of pops) {
          p.t += dt;
          p.s.material.opacity = Math.max(0, 1 - p.t * 1.6);
          p.s.scale.setScalar(4 + p.t * 22);
          p.s.position.set(p.p.x, p.p.y, p.p.z + S);
        }

        // torpedoes
        for (const tp of torps) {
          if (!tp.on) continue;
          tp.t += dt;
          if (tp.t < 0) continue;
          if (tp.hit) {
            const k = clamp(tp.t / 0.85, 0, 1);
            tp.p.set(tp.from.x * (1 - k), tp.from.y * (1 - k * k), tp.from.z + (-RUN - tp.from.z) * k);
            if (k >= 1) {
              tp.on = false;
              if (phase === 'torpedo') {
                phase = 'escape'; pt = 0;
                app.flash(0.5, 0.6, '#bfe0ff');
                app.sound.boom(0.5);
                app.toast('Straight in. Pull up, now!', 2.4);
              }
            }
          } else {
            const k = clamp(tp.t / 0.75, 0, 1);
            tp.p.set(tp.from.x, tp.from.y * (1 - k * k), tp.from.z - k * 170);
            if (k >= 1) {
              tp.on = false;
              const pop = pops.find((p) => p.t > 1) ?? pops[0];
              pop.t = 0; pop.p.copy(tp.p);
              app.sound.noise({ dur: 0.8, gain: 0.3, from: 1400, to: 90 });
            }
          }
          tp.s.material.opacity = tp.on ? 1 : 0;
          tp.s.position.set(tp.p.x, tp.p.y, tp.p.z + S);
        }

        // the port and the computer
        port.visible = dp < 600 && dp > -40;
        port.position.set(0, 0, -dp);
        const live = dp >= WIN_NEAR && dp <= WIN_FAR && volleys > 0 && phase === 'fly';
        tc.hidden = !(dp < 650 && phase === 'fly');
        if (!tc.hidden) drawComputer(dp, live, t);
        if (dp < 600 && phase === 'fly') app.action('fire', { verb: volleys ? 'Fire torpedoes' : 'Fire', how: volleys ? `${volleys} volley${volleys > 1 ? 's' : ''} left` : 'Tap · Space' });
        if (phase === 'fly' && dp < -25) fail('You flew past the port.');
        if (Math.floor(S / 25) !== Math.floor(before / 25)) readout();

        // after the run
        if (phase === 'escape' && pt > 1.9) startBoom();
        if (phase === 'failed' && pt > 1.6 && pt - dt <= 1.6) {
          app.setActions(afterActions);
          tc.hidden = true;
        }

        // the fighter and the camera that chases it
        hurt = Math.max(0, hurt - dt);
        fighter.group.position.set(fx, fy, 0);
        fighter.group.rotation.set(phase === 'escape' ? 0.6 : fvy * 0.025, 0, bank * 0.8);
        fighter.group.visible = !(hurt > 0 && Math.floor(t * 20) % 2 === 0);
        fighter.glows.forEach((gw) => { gw.material.opacity = 0.75 + 0.25 * Math.sin(t * 40); });
        shake *= Math.exp(-dt * 4);
        camPos.set(fx * 0.75, fy + 3.4, 10.5);
        if (phase === 'escape') camPos.y = fy + 3.4 - Math.min(pt, 1.2) * 2;
        camPos.x += (Math.random() - 0.5) * shake * 0.6; camPos.y += (Math.random() - 0.5) * shake * 0.6;
        app.camera.position.lerp(camPos, 1 - Math.exp(-dt * 10));
        look.set(fx * 0.85, fy + 0.4 + (phase === 'escape' ? 6 : 0), -30);
        app.camera.lookAt(look);
        app.camera.rotateZ(bank * 0.2);
        app.fovKick = phase === 'escape' ? Math.min(pt, 1) * 8 : 0;
      }

      sky.follow(app.camera);
      stars.update(app.camera, t, app.px);
      sun.follow(app.camera);
    },
  };
}
