// The Holdo Maneuver: one cruiser jumps to lightspeed straight through a fleet.
// Drag to aim, hold to spool the hyperdrive, let go. Everything in the line is cut in two, in silence.
import * as THREE from 'three';
import { makeSky, makeStars, makeSun, makeGlow } from '../core/sky.js';
import { makePlanet } from '../core/bodies.js';

export const meta = {
  id: 'holdo',
  name: 'The Holdo Maneuver',
  tag: 'One ship, one jump, total silence',
  blurb: 'A cruiser with nothing left to give turned around and jumped to lightspeed straight through the fleet hunting it. For one silent moment, the sky was cut in two.',
  legend: true,
  screen: 2017,
  isNew: true,
  accent: '#cfe3ff',
  hint: 'Drag to aim the cruiser. Hold to spool the hyperdrive, then let go.',
  bloom: { strength: 0.7, radius: 0.6, threshold: 0.66 },
  drone: 32.7,
};

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const rnd = (a, b) => a + Math.random() * (b - a);
const C0 = new THREE.Vector3(0, 0, 165);     // where the cruiser waits
const CUT_SPEED = 700;                       // how fast the cut runs through the fleet, in scene units per second
const REACH = 1400;
const UP = new THREE.Vector3(0, 1, 0);

// ---- every ship is drawn twice, once per side of the cut; until the jump the two halves line up exactly
const SHIP_VERT = /* glsl */ `
attribute float aHit;
attribute float aDelay;
attribute float aTarget;
uniform vec3 uN, uDir;
uniform float uC, uSide, uT;
varying vec3 vWP;
varying vec3 vN;
varying float vSd;
varying float vHit;
varying float vHeat;
varying float vTarget;
void main(){
  mat4 m = modelMatrix * instanceMatrix;
  vec4 p0 = m * vec4(position, 1.0);
  vSd = dot(uN, p0.xyz) + uC;
  float age = max(uT - aDelay, 0.0) * aHit;
  vec3 c = (m * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  float sep = age * 4.0 + age * age * 0.6;
  float ang = age * 0.05 * uSide;
  vec3 q = p0.xyz - c;
  q = q * cos(ang) + cross(uDir, q) * sin(ang) + uDir * dot(uDir, q) * (1.0 - cos(ang));
  vec3 wp = c + q + uN * uSide * sep;
  vWP = wp;
  vN = normalize(mat3(m) * normal);
  vHit = aHit;
  vHeat = aHit * step(aDelay, uT) * exp(-age * 0.12);
  vTarget = aTarget;
  if (uSide < 0.0 && aHit < 0.5) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); return; }
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}
`;
const SHIP_FRAG = /* glsl */ `
varying vec3 vWP;
varying vec3 vN;
varying float vSd;
varying float vHit;
varying float vHeat;
varying float vTarget;
uniform float uSide, uTime;
uniform vec3 uKey, uKeyCol, uFill, uBase;
float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main(){
  if (vHit > 0.5 && uSide * vSd < 0.0) discard;
  if (!gl_FrontFacing) {
    // looking into the cut: the inside of the hull, glowing hot
    float n = 0.6 + 0.4 * h21(floor(vWP.xz * 1.3 + vWP.y));
    gl_FragColor = vec4(vec3(1.0, 0.42, 0.1) * (0.35 + 2.2 * vHeat) * n, 1.0);
    return;
  }
  vec3 N = normalize(vN);
  vec3 V = normalize(cameraPosition - vWP);
  float diff = max(dot(N, uKey), 0.0);
  vec2 g = vWP.xz * 0.7 + vWP.y * 0.4;
  float plate = 0.82 + 0.18 * h21(floor(g));
  vec3 col = uBase * plate * (0.05 + diff * 0.95) * uKeyCol + uFill * (0.06 + 0.08 * N.y);
  float lamp = step(0.986, h21(floor(vWP.xz * 2.6) + floor(vWP.y * 2.6) * 7.0));
  col += vec3(1.0, 0.86, 0.66) * lamp;
  col += vec3(0.45, 0.55, 0.75) * pow(1.0 - max(dot(N, V), 0.0), 4.0) * 0.3;
  col += vec3(1.0, 0.55, 0.2) * vHit * (1.0 - smoothstep(0.0, 1.2, abs(vSd))) * vHeat * 3.0;
  col += vec3(1.0, 0.5, 0.25) * vTarget * pow(1.0 - max(dot(N, V), 0.0), 2.0) * (0.35 + 0.25 * sin(uTime * 6.0));
  gl_FragColor = vec4(col, 1.0);
}
`;

const DEBRIS_VERT = /* glsl */ `
attribute float aS;
attribute vec3 aDir;
attribute float aSpeed;
uniform vec3 uFrom, uLine;
uniform float uT, uPx, uOn;
varying vec3 vCol;
void main(){
  float age = max(uT - aS / ${CUT_SPEED.toFixed(1)}, 0.0);
  vec3 p = uFrom + uLine * aS + aDir * aSpeed * age * 9.0;
  vec4 mv = viewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(uPx * 260.0 / -mv.z, 1.0, 9.0) * uOn * step(0.0001, age);
  vCol = mix(vec3(1.0, 0.95, 0.9), vec3(1.0, 0.45, 0.15), clamp(age * 0.6, 0.0, 1.0)) * exp(-age * 0.35) * 1.6;
}
`;
const DOT_FRAG = /* glsl */ `
varying vec3 vCol;
void main(){
  float d = length(gl_PointCoord - 0.5);
  float a = 1.0 - smoothstep(0.0, 0.5, d);
  gl_FragColor = vec4(vCol * a * a, 1.0);
}
`;
const AIM_VERT = /* glsl */ `
attribute float aS;
uniform vec3 uFrom, uLine;
uniform float uTime, uPx;
varying vec3 vCol;
void main(){
  vec3 p = uFrom + uLine * aS;
  vec4 mv = viewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(uPx * 160.0 / -mv.z, 1.2, 4.0);
  float dash = step(0.45, fract(aS * 0.025 - uTime * 0.9));
  vCol = vec3(0.8, 0.9, 1.0) * dash * (1.0 - aS / ${REACH.toFixed(1)}) * 1.2;
}
`;

function merge(parts) {
  const geos = parts.map((g) => (g.index ? g.toNonIndexed() : g));
  const n = geos.reduce((s, g) => s + g.attributes.position.count, 0);
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
  let o = 0;
  for (const g of geos) { pos.set(g.attributes.position.array, o); nor.set(g.attributes.normal.array, o); o += g.attributes.position.array.length; }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return out;
}
const flat = (pts, depth, bevel) => {
  const sh = new THREE.Shape();
  sh.moveTo(pts[0][0], pts[0][1]);
  for (const p of pts.slice(1)) sh.lineTo(p[0], p[1]);
  sh.closePath();
  return new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1 }).rotateX(-Math.PI / 2).translate(0, -depth / 2, 0);
};

// the flagship: a wing many kilometres wide. Its outline doubles as the hit test.
const WING = [[0, -44], [78, 16], [73, 26], [9, 7], [0, 13], [-9, 7], [-73, 26], [-78, 16]];
function flagshipGeometry() {
  return merge([
    flat(WING, 3.4, 1.4),
    flat([[0, -30], [12, 10], [-12, 10]], 3, 0.8).translate(0, 2.6, 0),
    new THREE.BoxGeometry(6, 5, 30).translate(0, 4, 5),
    new THREE.BoxGeometry(10, 7, 7).translate(0, 6, -9),
    new THREE.BoxGeometry(150, 1.4, 3).translate(0, -2.4, -16),
  ]);
}
function destroyerGeometry() {
  return merge([
    flat([[0, -9], [5.4, 7], [-5.4, 7]], 1.4, 0.45),
    flat([[0, -5], [3.1, 6.2], [-3.1, 6.2]], 1.2, 0.3).translate(0, 1.1, -0.4),
    new THREE.BoxGeometry(2.8, 2.2, 1.4).translate(0, 2.6, -5.6),
    new THREE.SphereGeometry(0.45, 8, 6).translate(0.9, 3.9, -5.6),
    new THREE.SphereGeometry(0.45, 8, 6).translate(-0.9, 3.9, -5.6),
  ]);
}

function insideWing(x, z) {
  // the outline above is in (x, y) and is laid flat with y becoming -z
  let inside = false;
  for (let i = 0, j = WING.length - 1; i < WING.length; j = i++) {
    const xi = WING[i][0], zi = -WING[i][1], xj = WING[j][0], zj = -WING[j][1];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

function buildCruiser() {
  const g = new THREE.Group();
  const prof = [[0, -13], [1.6, -12.2], [3.2, -9.5], [3.9, -5], [3.7, 3], [3.1, 8.5], [2.6, 11], [2.2, 12.4], [0, 12.6]].map(([r, y]) => new THREE.Vector2(r, y));
  const hullMat = new THREE.MeshStandardMaterial({ color: '#8fa3c0', roughness: 0.45, metalness: 0.35 });
  const hull = new THREE.Mesh(new THREE.LatheGeometry(prof, 20).rotateX(-Math.PI / 2), hullMat);
  hull.scale.set(1, 0.7, 1);
  const finMat = new THREE.MeshStandardMaterial({ color: '#6f84a6', roughness: 0.5, metalness: 0.4, flatShading: true });
  for (const s of [-1, 1]) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(6, 0.4, 7), finMat);
    fin.position.set(s * 5, -0.2, 4);
    fin.rotation.z = s * 0.15;
    g.add(fin);
  }
  const dorsal = new THREE.Mesh(new THREE.BoxGeometry(0.4, 3.4, 8), finMat);
  dorsal.position.set(0, 3, 3);
  g.add(hull, dorsal);
  const engines = [];
  for (const [x, y] of [[-1.6, 0], [1.6, 0], [0, 1.2], [0, -1.2]]) {
    const e = makeGlow('#8fc8ff', 3.4, 0.9);
    e.position.set(x, y, 12.9);
    g.add(e);
    engines.push(e);
  }
  return { group: g, engines };
}

export function create(app) {
  const scene = new THREE.Scene();
  const sky = makeSky(app.renderer, { a: '#2a1020', b: '#10183a', c: '#6a2a2a', base: '#020205', density: 0.42, dust: 0.65, gain: 0.55, seed: 64.2 });
  const stars = makeStars(4600);
  const sun = makeSun('#fff0e0', 150);
  sun.dir.set(0.55, 0.35, -0.75).normalize();
  scene.add(sky.mesh, stars.points, sun.group);

  // a white salt planet with red ground beneath, far behind the fleet
  const planet = makePlanet({
    ocean: '#6a1410', shallow: '#a8342a', landA: '#e9e5de', landB: '#cfc6ba', landC: '#ffffff',
    sea: -0.16, cloudAmt: 0.12, atmo: '#ffd6c8', seed: 2.2, scale: 1.3, haloGain: 0.6,
  }, 96);
  planet.group.position.set(-560, -230, -1100);
  planet.group.scale.setScalar(420);
  planet.setLight(sun.dir);
  scene.add(planet.group);

  scene.add(new THREE.HemisphereLight('#a8b8d8', '#2a1a1a', 1.0));
  const key = new THREE.DirectionalLight('#fff0e0', 2.2);
  key.position.copy(sun.dir);
  scene.add(key);

  // ---- the cut, shared by every ship
  const U = {
    uN: { value: new THREE.Vector3(1, 0, 0) }, uDir: { value: new THREE.Vector3(0, 0, -1) }, uC: { value: 0 }, uT: { value: -1 }, uTime: { value: 0 },
    uKey: { value: sun.dir.clone() }, uKeyCol: { value: new THREE.Color('#fff0e0') }, uFill: { value: new THREE.Color('#3a4560') },
  };
  function twin(geo, count, base) {
    const hit = new Float32Array(count), delay = new Float32Array(count), target = new Float32Array(count);
    geo.setAttribute('aHit', new THREE.InstancedBufferAttribute(hit, 1));
    geo.setAttribute('aDelay', new THREE.InstancedBufferAttribute(delay, 1));
    geo.setAttribute('aTarget', new THREE.InstancedBufferAttribute(target, 1));
    const mk = (side) => {
      const mesh = new THREE.InstancedMesh(geo, new THREE.ShaderMaterial({
        vertexShader: SHIP_VERT, fragmentShader: SHIP_FRAG, side: THREE.DoubleSide,
        uniforms: { ...U, uSide: { value: side }, uBase: { value: new THREE.Color(base) } },
      }), count);
      mesh.frustumCulled = false;
      scene.add(mesh);
      return mesh;
    };
    return { a: mk(1), b: mk(-1), hit, delay, target, geo };
  }

  const flagship = twin(flagshipGeometry(), 1, '#5c616c');
  const flagPos = new THREE.Vector3(0, -2, -30);
  {
    const m = new THREE.Matrix4().compose(flagPos, new THREE.Quaternion().setFromEuler(new THREE.Euler(0.04, 0, 0)), new THREE.Vector3(1, 1, 1));
    flagship.a.setMatrixAt(0, m); flagship.b.setMatrixAt(0, m);
  }
  const FLEET = [
    [0, 9, -120, 2.0], [-46, -7, -165, 1.8], [50, 6, -185, 1.9], [4, -12, -240, 2.1],
    [-100, 6, 40, 1.8], [104, -8, 30, 1.8], [-138, -4, -30, 2.0], [142, 10, -40, 1.9],
    [-170, 12, -100, 1.7], [176, -6, -110, 1.8], [-205, -10, -170, 1.9], [210, 4, -180, 1.7],
    [-86, 14, -210, 1.8], [92, -14, -230, 1.8], [-60, -16, 90, 1.6], [64, 16, 100, 1.6],
  ];
  const destroyers = twin(destroyerGeometry(), FLEET.length, '#7c818c');
  {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    FLEET.forEach(([x, y, z, k], i) => {
      q.setFromEuler(new THREE.Euler(rnd(-0.03, 0.03), rnd(-0.08, 0.08), rnd(-0.05, 0.05)));
      m.compose(new THREE.Vector3(x, y, z), q, s.setScalar(k));
      destroyers.a.setMatrixAt(i, m); destroyers.b.setMatrixAt(i, m);
    });
  }

  const cruiser = buildCruiser();
  cruiser.group.position.copy(C0);
  scene.add(cruiser.group);

  // escape pods and shuttles heading for the planet
  const shuttles = Array.from({ length: 14 }, () => {
    const s = makeGlow('#ffd9b0', 1.8, 0.8);
    scene.add(s);
    return { s, p: C0.clone().add(new THREE.Vector3(rnd(-20, 20), rnd(-8, 8), rnd(-10, 30))), v: new THREE.Vector3(rnd(-0.6, -0.3), rnd(-0.25, -0.1), rnd(-0.8, -0.5)).normalize().multiplyScalar(rnd(6, 10)) };
  });

  // aim line
  const lineDir = new THREE.Vector3(0, 0, -1);
  const AIMN = 180;
  const aimGeo = new THREE.BufferGeometry();
  aimGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(AIMN * 3), 3));
  aimGeo.setAttribute('aS', new THREE.BufferAttribute(Float32Array.from({ length: AIMN }, (_, i) => 18 + (i / AIMN) * REACH), 1));
  const aimMat = new THREE.ShaderMaterial({
    vertexShader: AIM_VERT, fragmentShader: DOT_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uFrom: { value: C0 }, uLine: { value: lineDir }, uTime: { value: 0 }, uPx: { value: app.px } },
  });
  const aim = new THREE.Points(aimGeo, aimMat);
  aim.frustumCulled = false;
  scene.add(aim);

  // the slash of light the jump leaves behind
  const beamGeo = new THREE.CylinderGeometry(1, 1, 1, 14, 1, true).translate(0, 0.5, 0);
  const slashCore = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffffff').multiplyScalar(3), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  const slashHalo = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color('#cfe3ff').multiplyScalar(1.5), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  for (const m of [slashCore, slashHalo]) { m.visible = false; m.frustumCulled = false; scene.add(m); }

  // debris thrown out along the line
  const ND = app.coarse ? 2200 : 4200;
  const dS = new Float32Array(ND), dDir = new Float32Array(ND * 3), dSp = new Float32Array(ND);
  const tv = new THREE.Vector3();
  for (let i = 0; i < ND; i++) {
    dS[i] = Math.pow(Math.random(), 1.4) * 900 + 10;
    tv.randomDirection();
    dDir.set([tv.x, tv.y * 0.6, tv.z], i * 3);
    dSp[i] = Math.pow(Math.random(), 2) * 1.6 + 0.1;
  }
  const debrisGeo = new THREE.BufferGeometry();
  debrisGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ND * 3), 3));
  debrisGeo.setAttribute('aS', new THREE.BufferAttribute(dS, 1));
  debrisGeo.setAttribute('aDir', new THREE.BufferAttribute(dDir, 3));
  debrisGeo.setAttribute('aSpeed', new THREE.BufferAttribute(dSp, 1));
  const debrisMat = new THREE.ShaderMaterial({
    vertexShader: DEBRIS_VERT, fragmentShader: DOT_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uFrom: { value: new THREE.Vector3() }, uLine: { value: new THREE.Vector3() }, uT: { value: 0 }, uPx: { value: app.px }, uOn: { value: 0 } },
  });
  const debris = new THREE.Points(debrisGeo, debrisMat);
  debris.frustumCulled = false;
  scene.add(debris);

  const blasts = Array.from({ length: 20 }, () => { const s = makeGlow('#ffb070', 10, 0); scene.add(s); return { s, at: 0, on: false, size: 10 }; });

  // ---- state
  let heading = 0, spool = 0, holding = false, state = 'aim', sT = 0, rt = 0, scale = 1, cutText = '', said = false;
  const showAim = () => {
    const { ships, flag } = scan();
    app.readout(flag || ships ? `In the line: ${[flag ? 'the flagship' : '', ships ? `${ships} destroyer${ships > 1 ? 's' : ''}` : ''].filter(Boolean).join(' and ')}` : 'Nothing in the line yet. Drag to aim.');
  };

  function setLine() {
    lineDir.set(-Math.sin(heading), 0, -Math.cos(heading));
    cruiser.group.rotation.y = heading;
  }

  // which ships the jump would pass through
  function scan(commit = false) {
    let ships = 0, flag = false;
    const rel = new THREE.Vector3(), p = new THREE.Vector3();
    FLEET.forEach(([x, y, z, k], i) => {
      rel.set(x, y, z).sub(C0);
      const along = rel.dot(lineDir);
      const off = rel.addScaledVector(lineDir, -along).length();
      const hit = along > 0 && off < 8.5 * k ? 1 : 0;
      ships += hit;
      destroyers.target[i] = hit;
      if (commit) { destroyers.hit[i] = hit; destroyers.delay[i] = along / CUT_SPEED; }
    });
    let firstAlong = 0;
    for (let s = 0; s < REACH; s += 2) {
      p.copy(C0).addScaledVector(lineDir, s).sub(flagPos);
      if (Math.abs(p.y) < 5 && insideWing(p.x, p.z)) { flag = true; firstAlong = s; break; }
    }
    flagship.target[0] = flag ? 1 : 0;
    if (commit) { flagship.hit[0] = flag ? 1 : 0; flagship.delay[0] = firstAlong / CUT_SPEED; }
    for (const t of [flagship, destroyers]) {
      t.geo.attributes.aTarget.needsUpdate = true;
      if (commit) { t.geo.attributes.aHit.needsUpdate = true; t.geo.attributes.aDelay.needsUpdate = true; }
    }
    return { ships, flag };
  }

  function jump() {
    state = 'cut'; sT = 0; rt = 0; scale = 0.1;
    app.sound.stopCharge();
    const { ships, flag } = scan(true);
    cutText = flag || ships ? `Cut in two: ${[flag ? 'the flagship' : '', ships ? `${ships} destroyer${ships > 1 ? 's' : ''}` : ''].filter(Boolean).join(' and ')}` : 'The jump hit nothing but empty space';
    // the plane of the cut stands upright along the jump
    U.uN.value.crossVectors(lineDir, UP).normalize();
    U.uC.value = -U.uN.value.dot(C0);
    U.uDir.value.copy(lineDir);
    U.uT.value = 0;
    for (const t of [flagship, destroyers]) { t.target.fill(0); t.geo.attributes.aTarget.needsUpdate = true; }
    debrisMat.uniforms.uFrom.value.copy(C0); debrisMat.uniforms.uLine.value.copy(lineDir); debrisMat.uniforms.uOn.value = 1;
    const q = new THREE.Quaternion().setFromUnitVectors(UP, lineDir);
    for (const [m, r] of [[slashCore, 0.5], [slashHalo, 2.6]]) {
      m.visible = true; m.position.copy(C0); m.quaternion.copy(q); m.scale.set(r, REACH, r);
    }
    slashCore.material.opacity = 1; slashHalo.material.opacity = 0.35;
    aim.visible = false;
    cruiser.group.visible = false;
    // blooms of fire where the ships were hit
    let bi = 0;
    const center = new THREE.Vector3();
    const addBlast = (pos, at, size) => { if (bi >= blasts.length) return; const b = blasts[bi++]; b.s.position.copy(pos); b.at = at; b.on = true; b.size = size; };
    if (flag) for (let k = 0; k < 4; k++) addBlast(C0.clone().addScaledVector(lineDir, flagship.delay[0] * CUT_SPEED + k * 14), flagship.delay[0] + k * 0.03, 40 - k * 6);
    FLEET.forEach(([x, y, z, k], i) => { if (destroyers.hit[i]) addBlast(center.set(x, y, z), destroyers.delay[i], 18 * k); });
    // the moment itself: a white-out, then silence and slow time
    app.flash(1, 1.8, '#ffffff');
    app.grade('grayscale(1) contrast(1.45) brightness(1.08)', 3.2, 2.4);
    app.sound.silence(3.4, 3.5);
    app.shake(0.4);
    app.action('jump', { disabled: true, verb: 'Hyperdrive', how: 'Spent' });
    app.readout('');
  }

  function rewind() {
    state = 'aim'; sT = 0; scale = 1; spool = 0;
    for (const t of [flagship, destroyers]) { t.hit.fill(0); t.delay.fill(0); t.geo.attributes.aHit.needsUpdate = true; }
    U.uT.value = -1;
    debrisMat.uniforms.uOn.value = 0;
    slashCore.visible = slashHalo.visible = false;
    blasts.forEach((b) => { b.on = false; b.s.material.opacity = 0; });
    cruiser.group.visible = true; aim.visible = true;
    shuttles.forEach((s) => { s.p.copy(C0).add(new THREE.Vector3(rnd(-20, 20), rnd(-8, 8), rnd(-10, 30))); });
    app.ungrade();
    app.flash(1, 1.2, '#000000');
    app.setActions(actions);
    showAim();
  }

  const actions = [{
    id: 'jump', verb: 'Spool the hyperdrive', how: 'Hold, then let go', kind: 'hold', key: ' ',
    down() { if (state !== 'aim') return; holding = true; app.sound.startCharge(70); },
    up() {
      if (!holding) return;
      holding = false;
      if (state !== 'aim') return;
      if (spool >= 0.85) jump();
      else { app.sound.stopCharge(); app.toast('Hold until the drive is fully spooled.', 2.4); }
    },
  }];
  const afterActions = [{ id: 'rewind', verb: 'Rewind time', how: 'Tap', kind: 'tap', key: ' ', down() { rewind(); } }];

  setLine();

  return {
    scene, actions,
    usesArrows: true,
    enter() {
      const portrait = app.camera.aspect < 0.8;
      app.rig.set({
        target: portrait ? new THREE.Vector3(0, 0, 70) : new THREE.Vector3(0, 6, 40), theta: portrait ? 0.14 : 0.72, phi: portrait ? 0.92 : 1.12, radius: portrait ? 250 : 250, snap: true,
        auto: 0, minPhi: 0.3, maxPhi: 1.75, minRadius: 90, maxRadius: 520, damping: 3,
      });
      app.rig.fit = portrait ? 1.35 : Math.max(1, 1.5 / app.camera.aspect);
      if (state !== 'aim') rewind(); else { app.setActions(actions); showAim(); }
    },
    leave() { holding = false; app.sound.stopCharge(); app.ungrade(); },
    resize() { app.rig.fit = app.camera.aspect < 0.8 ? 1.35 : Math.max(1, 1.5 / app.camera.aspect); },
    onPointerDown() { return state === 'aim'; },
    onPointerMove(e, ndc, d) {
      if (state !== 'aim') return;
      heading = clamp(heading - d.dx * 0.0032, -0.62, 0.62);
      setLine();
      showAim();
    },
    async demo(cue) {
      cue.say('One cruiser. One jump.', 3);
      // swing the aim across the fleet until the flagship is in the line
      for (let i = 0; i < 30 && cue.live(); i++) {
        heading = 0.28 * Math.sin(i / 30 * Math.PI * 1.5);
        setLine(); showAim();
        await cue.wait(0.08);
      }
      heading = 0.06; setLine(); showAim();
      if (!(await cue.wait(1))) return;
      await cue.hold('jump', 3, () => spool >= 1);
      if (!(await cue.wait(10))) return;
      cue.press('rewind');
      await cue.wait(1.5);
    },

    update(dt, t) {
      // ---- aiming with the keys
      if (state === 'aim') {
        const K = app.keys;
        const turn = (K.has('ArrowRight') || K.has('d') ? 1 : 0) - (K.has('ArrowLeft') || K.has('a') ? 1 : 0);
        if (turn) { heading = clamp(heading - turn * dt * 0.5, -0.62, 0.62); setLine(); showAim(); }
        spool = holding ? Math.min(1, spool + dt / 2) : Math.max(0, spool - dt * 1.5);
        if (holding) app.sound.setCharge(spool);
        app.meter('jump', spool, spool >= 0.85);
        cruiser.engines.forEach((e) => { e.material.opacity = 0.6 + 0.4 * spool; e.scale.setScalar(3.4 + spool * 6); });
        cruiser.group.position.copy(C0).addScaledVector(lineDir, spool * spool * 3);
        cruiser.group.position.y += Math.sin(t * 0.6) * 0.3;
        if (spool > 0.9 && !said) { said = true; app.toast('Let go to jump.', 1.6); }
      }

      // ---- after the jump: slow time, then let it run again
      if (state === 'cut') {
        rt += dt;
        if (rt > 3.2) scale = Math.min(0.55, scale + dt * 0.25);
        sT += dt * scale;
        U.uT.value = sT;
        debrisMat.uniforms.uT.value = sT;
        const fade = Math.max(0, 1 - sT / 3.5);
        slashCore.material.opacity = fade;
        slashHalo.material.opacity = 0.3 * fade * fade;
        slashHalo.scale.x = slashHalo.scale.z = 2.6 + sT * 0.8;
        for (const b of blasts) {
          if (!b.on) continue;
          const age = sT - b.at;
          b.s.material.opacity = age > 0 ? Math.max(0, 1 - age / 5) : 0;
          b.s.scale.setScalar(age > 0 ? b.size * (0.4 + Math.min(age, 3) * 0.7) : 0.01);
        }
        if (rt > 3.4 && rt - dt <= 3.4) { app.sound.boom(1.6); app.readout(cutText); }
        if (rt > 6.5 && rt - dt <= 6.5) { app.setActions(afterActions); app.readout(cutText); }
      }

      U.uTime.value = t;
      aimMat.uniforms.uTime.value = t;
      for (const s of shuttles) { s.p.addScaledVector(s.v, dt * (state === 'cut' ? scale : 1)); s.s.position.copy(s.p); }
      planet.body.rotation.y += dt * 0.004;
      planet.tick(t);
      sky.follow(app.camera);
      stars.update(app.camera, t, app.px);
      sun.follow(app.camera);
    },
  };
}
