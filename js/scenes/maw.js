// The Maw Installation: a secret laboratory hidden in the one calm pocket inside a knot of black holes.
// Drag from the ship to aim, let go to launch, and let gravity bend the path home.
import * as THREE from 'three';
import { makeSky, makeGlow } from '../core/sky.js';
import { NOISE } from '../core/glsl.js';

export const meta = {
  id: 'maw',
  name: 'The Maw Installation',
  tag: 'A hideout inside a knot of black holes',
  blurb: 'A tangle of black holes that swallows any ship foolish enough to enter. In the one calm pocket at its heart sits the most secret laboratory in the galaxy.',
  since: 1994,
  accent: '#ff6f91',
  hint: 'Drag from the ship to aim, then let go. Gravity bends your path, so aim wide and let it pull you in.',
  bloom: { strength: 0.7, radius: 0.65, threshold: 0.68 },
  drone: 36.7,
};

// ---- the rules of this little universe (also used by the offline level search)
const SOFT = 1.3, MASS = 170, TARGET_R = 2.6, LOST = 54, MAXH = 4;
const SHEET_SOFT = 2.2, SHEET_SCALE = 0.07;
const MIN_SPEED = 7, MAX_SPEED = 17;

// Each hole is [x, z, size]. A size of 0 parks an unused hole out of the way.
const PATHS = [
  { name: 'The front door', start: [-38, 0], holes: [[-15, 8, 0.9], [-9, -9, 0.8], [34, 30, 0], [34, -30, 0]] },
  { name: 'The long way round', start: [-38, 2], holes: [[-17, 0, 1.0], [7, 13, 0.8], [6, -12, 0.7], [34, -30, 0]] },
  { name: 'The needle', start: [-36, -14], holes: [[-10, -3, 0.9], [-2, 11, 0.85], [9, -7, 0.9], [14, 8, 0.7]] },
];

const LENS_VERT = /* glsl */ `
varying vec3 vWP;
void main(){
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWP = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;
// Bends the view ray toward the hole and looks up the sky in the bent direction:
// starlight curls into arcs, and nothing comes back from inside the shadow.
const LENS_FRAG = /* glsl */ `
varying vec3 vWP;
uniform sampler2D uSky;
uniform vec3 uCenter, uHot;
uniform float uRs, uR, uTime;
void main(){
  vec3 ro = cameraPosition;
  vec3 rd = normalize(vWP - ro);
  vec3 oc = uCenter - ro;
  vec3 perp = oc - rd * dot(oc, rd);
  float b = length(perp);
  vec3 n = perp / max(b, 1e-4);
  float x = uRs / max(b, 1e-3);
  float fall = 1.0 - smoothstep(0.5 * uR, uR, b);
  float bend = (2.0 * x + 7.0 * x * x * x) * fall;
  vec3 dir = normalize(rd * cos(bend) + n * sin(bend));
  vec2 uv = vec2(atan(dir.z, -dir.x) / 6.28318530718, asin(clamp(dir.y, -1.0, 1.0)) / 3.14159265359 + 0.5);
  vec3 c = texture2D(uSky, uv).rgb;
  c *= c;
  float q = b / uRs;
  c *= smoothstep(2.5, 2.72, q);
  // the thin ring of light that skims the edge, and the far side of the disc lifted into view
  c += vec3(1.0, 0.88, 0.7) * exp(-pow((q - 2.76) / 0.09, 2.0)) * 1.8;
  float halo = exp(-pow((q - 3.25) / 0.42, 2.0));
  float ang = atan(n.y, dot(n, normalize(cross(rd, vec3(0.0, 1.0, 0.0)))));
  c += uHot * halo * (0.34 + 0.16 * sin(ang * 5.0 + uTime * 1.6));
  gl_FragColor = vec4(c, 1.0);
}
`;

const DISC_VERT = /* glsl */ `
varying vec2 vP;
varying vec3 vWP;
void main(){
  vP = position.xy;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWP = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;
const DISC_FRAG = /* glsl */ `
varying vec2 vP;
varying vec3 vWP;
uniform float uTime, uRs, uFade;
uniform vec3 uHot, uWarm, uCenter, uNormal;
${NOISE}
float swirl(float r, float ang, float shift){
  float a = ang + shift * 2.2 / pow(r / 3.0, 1.5);
  return fbm3(vec3(cos(a) * r * 0.85, sin(a) * r * 0.85, r * 0.35)) + 0.35 * sin(a * 3.0 + r * 3.5);
}
void main(){
  float r = length(vP);
  float ang = atan(vP.y, vP.x);
  // two copies of the flow, cross-faded, so the spiral never winds itself into mush
  float T = 14.0;
  float t1 = fract(uTime / T), t2 = fract(uTime / T + 0.5);
  float n = mix(swirl(r, ang, (t1 - 0.5) * T), swirl(r, ang, (t2 - 0.5) * T), abs(t1 * 2.0 - 1.0));
  float edge = smoothstep(2.85, 3.5, r) * (1.0 - smoothstep(5.8, 8.4, r));
  float heat = pow(3.0 / r, 2.0);
  vec3 col = mix(uWarm, uHot, clamp(heat, 0.0, 1.0)) * (0.3 + 1.1 * heat) * (0.55 + 0.55 * n) * edge;
  // the side spinning toward you burns brighter
  vec3 radial = normalize(vWP - uCenter);
  vec3 V = normalize(cameraPosition - vWP);
  col *= 1.0 + 0.6 * dot(cross(uNormal, radial), V);
  gl_FragColor = vec4(max(col, 0.0) * uFade, 1.0);
}
`;

const SHEET_VERT = /* glsl */ `
uniform vec4 uHoles[${MAXH}];
varying float vDepth;
varying float vFar;
void main(){
  vec3 p = position;
  float y = 0.0;
  for (int i = 0; i < ${MAXH}; i++){
    vec2 d = p.xz - uHoles[i].xy;
    y -= ${SHEET_SCALE} * uHoles[i].z / sqrt(dot(d, d) + ${(SHEET_SOFT * SHEET_SOFT).toFixed(2)});
  }
  p.y = y;
  vDepth = clamp(-y / 4.5, 0.0, 1.0);
  vFar = 1.0 - smoothstep(38.0, 56.0, length(position.xz));
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`;
const SHEET_FRAG = /* glsl */ `
uniform vec3 uCool, uWarm;
varying float vDepth;
varying float vFar;
void main(){
  vec3 col = mix(uCool, uWarm, vDepth) * (0.14 + 0.75 * vDepth);
  gl_FragColor = vec4(col * vFar, 1.0);
}
`;

const TRAIL_VERT = /* glsl */ `
attribute float aT;
uniform float uPx;
varying float vT;
void main(){
  vT = aT;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = uPx * (1.5 + 3.0 * aT);
}
`;
const TRAIL_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying float vT;
void main(){
  float d = length(gl_PointCoord - 0.5);
  gl_FragColor = vec4(uColor * (1.0 - smoothstep(0.15, 0.5, d)) * (0.25 + 0.75 * vT * vT) * uOpacity, 1.0);
}
`;

const DOT_VERT = /* glsl */ `
attribute float aT;
uniform float uPx;
varying float vT;
void main(){
  vT = aT;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uPx * (2.0 + 2.5 * (1.0 - aT));
}
`;
const DOT_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying float vT;
void main(){
  float d = length(gl_PointCoord - 0.5);
  gl_FragColor = vec4(uColor * (1.0 - smoothstep(0.2, 0.5, d)) * (1.0 - vT * 0.85) * uOpacity, 1.0);
}
`;

export function create(app) {
  const scene = new THREE.Scene();
  const sky = makeSky(app.renderer, {
    a: '#6a1430', b: '#152a78', c: '#e89a4a', base: '#020207', density: 0.54, dust: 0.72, gain: 0.78, seed: 17.7, scale: 1.4, stars: 1,
  }, app.coarse ? 2048 : 4096);
  scene.add(sky.mesh);
  scene.add(new THREE.AmbientLight('#8090c0', 0.9));
  const key = new THREE.DirectionalLight('#ffe0c0', 2.2);
  key.position.set(-0.4, 1, 0.6);
  scene.add(key);

  const accent = new THREE.Color(meta.accent);

  // ---- holes: live values that glide between layouts
  const holes = PATHS[0].holes.map(([x, z, s]) => ({ x, z, s, y: 0 }));
  const start = new THREE.Vector2(...PATHS[0].start);
  const sheetHoles = holes.map(() => new THREE.Vector4());

  const sheetY = (x, z) => {
    let y = 0;
    for (const h of holes) y -= SHEET_SCALE * MASS * h.s / Math.sqrt((x - h.x) ** 2 + (z - h.z) ** 2 + SHEET_SOFT * SHEET_SOFT);
    return y;
  };

  const lensGeo = new THREE.SphereGeometry(1, 48, 32);
  const discGeo = new THREE.RingGeometry(2.85, 8.4, 96, 10);
  const parts = holes.map((h, i) => {
    const group = new THREE.Group();
    const shadow = new THREE.Mesh(new THREE.SphereGeometry(2.5, 32, 24), new THREE.MeshBasicMaterial({ color: 0x000000 }));
    const lens = new THREE.Mesh(lensGeo, new THREE.ShaderMaterial({
      vertexShader: LENS_VERT, fragmentShader: LENS_FRAG, transparent: true, depthWrite: false,
      uniforms: {
        uSky: { value: sky.texture }, uCenter: { value: new THREE.Vector3() }, uHot: { value: new THREE.Color('#ff9a4a') },
        uRs: { value: 1 }, uR: { value: 13 }, uTime: { value: 0 },
      },
    }));
    lens.scale.setScalar(13);
    lens.renderOrder = 1;
    const disc = new THREE.Mesh(discGeo, new THREE.ShaderMaterial({
      vertexShader: DISC_VERT, fragmentShader: DISC_FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: i * 7.3 }, uRs: { value: 1 }, uFade: { value: 1 },
        uHot: { value: new THREE.Color('#fff2dc') }, uWarm: { value: new THREE.Color(['#ff6a1e', '#ff4a3a', '#ff8a2a', '#ff5a6a'][i]) },
        uCenter: { value: new THREE.Vector3() }, uNormal: { value: new THREE.Vector3() },
      },
    }));
    disc.rotation.set(-Math.PI / 2 + [0.22, -0.3, 0.16, -0.2][i], 0, [0.2, -0.25, 0.4, -0.1][i]);
    disc.renderOrder = 2;
    group.add(shadow, lens, disc);
    scene.add(group);
    return { group, lens, disc };
  });

  // ---- the rubber sheet: space itself, sagging into every hole
  const sheetPts = [];
  for (let k = -20; k <= 20; k++) {
    const c = k * 2.8;
    for (let j = 0; j < 112; j++) {
      const a = -56 + j, b = a + 1;
      sheetPts.push(a, 0, c, b, 0, c, c, 0, a, c, 0, b);
    }
  }
  const sheet = new THREE.LineSegments(
    new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(sheetPts, 3)),
    new THREE.ShaderMaterial({
      vertexShader: SHEET_VERT, fragmentShader: SHEET_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uHoles: { value: sheetHoles }, uCool: { value: new THREE.Color('#3d4cff') }, uWarm: { value: accent.clone().multiplyScalar(1.3) } },
    }),
  );
  sheet.frustumCulled = false;
  sheet.renderOrder = 3;
  scene.add(sheet);

  // ---- the Installation: a few rocks lashed together, with its lights on
  const lab = new THREE.Group();
  const rockMat = new THREE.MeshStandardMaterial({ color: '#6b6470', roughness: 0.95, flatShading: true });
  [[0, 0, 0, 1.0], [1.1, 0.25, 0.3, 0.7], [-0.9, -0.1, 0.55, 0.62], [0.2, 0.5, -1.0, 0.55], [-0.55, 0.45, -0.75, 0.42], [0.75, -0.35, -0.5, 0.4]].forEach(([x, y, z, r], i) => {
    const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), rockMat);
    rock.position.set(x, y, z);
    rock.rotation.set(i, i * 2.1, i * 0.7);
    lab.add(rock);
  });
  const lampMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#9fe0ff').multiplyScalar(2) });
  for (let i = 0; i < 14; i++) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.07), lampMat);
    lamp.position.randomDirection().multiplyScalar(0.75 + Math.random() * 0.5);
    lab.add(lamp);
  }
  const beacon = makeGlow('#9fe0ff', 5, 0.6);
  lab.add(beacon);
  scene.add(lab);
  const dock = new THREE.Mesh(
    new THREE.RingGeometry(TARGET_R - 0.07, TARGET_R + 0.07, 72).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: new THREE.Color('#9fe0ff'), transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
  );
  dock.renderOrder = 4;
  scene.add(dock);

  // ---- the ship, its wake, and the dotted line that shows where an aim would go
  const ship = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.5, 6).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#d8dce6', roughness: 0.4, metalness: 0.5, flatShading: true }));
  const shipGlow = makeGlow('#ffd0e0', 3.4, 0.85);
  shipGlow.material.depthTest = false;
  ship.add(hull, shipGlow);
  hull.scale.setScalar(1.7);
  scene.add(ship);
  // where the ship waits: drag from here
  const pad = new THREE.Mesh(
    new THREE.RingGeometry(1.9, 2.05, 48).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd0e0'), transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, side: THREE.DoubleSide }),
  );
  pad.renderOrder = 4;
  scene.add(pad);

  const TRAIL = 280;
  const mkLine = (n, opacity) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    geo.setAttribute('aT', new THREE.BufferAttribute(Float32Array.from({ length: n }, (_, i) => i / (n - 1)), 1));
    const line = new THREE.Points(geo, new THREE.ShaderMaterial({
      vertexShader: TRAIL_VERT, fragmentShader: TRAIL_FRAG, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
      uniforms: { uColor: { value: new THREE.Color('#ffe0ea').multiplyScalar(1.6) }, uOpacity: { value: opacity }, uPx: { value: app.px } },
    }));
    line.frustumCulled = false; line.renderOrder = 5;
    scene.add(line);
    return line;
  };
  const trail = mkLine(TRAIL, 1);
  const ghosts = [mkLine(TRAIL, 0), mkLine(TRAIL, 0), mkLine(TRAIL, 0)];
  let ghostAt = 0;
  const trailBuf = [];

  const DOTS = 80;
  const dotGeo = new THREE.BufferGeometry();
  dotGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(DOTS * 3), 3));
  dotGeo.setAttribute('aT', new THREE.BufferAttribute(Float32Array.from({ length: DOTS }, (_, i) => i / (DOTS - 1)), 1));
  const dots = new THREE.Points(dotGeo, new THREE.ShaderMaterial({
    vertexShader: DOT_VERT, fragmentShader: DOT_FRAG, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
    uniforms: { uColor: { value: new THREE.Color('#ffffff') }, uOpacity: { value: 1 }, uPx: { value: app.px } },
  }));
  dots.frustumCulled = false; dots.renderOrder = 6;
  scene.add(dots);

  // ---- state
  let path = 0, state = 'aim', tries = 0, fails = 0, threaded = 0, morphing = false, aiming = false, stateT = 0, flightT = 0;
  let aimAngle = 0, aimSpeed = 12, dirty = true, eaten = null;
  const P = new THREE.Vector2(), Vel = new THREE.Vector2();
  const v3 = new THREE.Vector3(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hitPt = new THREE.Vector3();

  const showReadout = () => app.readout(`Path ${path + 1} of ${PATHS.length} · ${PATHS[path].name}${tries ? ` · Tries ${tries}` : ''}`);

  function accel(x, z, out) {
    let ax = 0, az = 0, hit = null;
    for (const h of holes) {
      if (h.s <= 0.01) continue;
      const dx = h.x - x, dz = h.z - z, d2 = dx * dx + dz * dz;
      if (d2 < (2.6 * h.s) ** 2) hit = h;
      const k = MASS * h.s / Math.pow(d2 + SOFT * SOFT, 1.5);
      ax += dx * k; az += dz * k;
    }
    out.set(ax, az);
    return hit;
  }

  const acc = new THREE.Vector2();
  function plotPreview() {
    // the line reaches further each time a try fails, so nobody stays stuck
    const reach = Math.min(10, 2.3 + fails * 0.75);
    const pos = dotGeo.attributes.position;
    let x = start.x, z = start.y, vx = Math.cos(aimAngle) * aimSpeed, vz = Math.sin(aimAngle) * aimSpeed, done = false;
    const h = 1 / 120, per = Math.max(1, Math.round((reach / DOTS) / h));
    for (let i = 0; i < DOTS; i++) {
      for (let s = 0; s < per && !done; s++) {
        if (accel(x, z, acc)) done = true;
        vx += acc.x * h; vz += acc.y * h; x += vx * h; z += vz * h;
        if (x * x + z * z < TARGET_R * TARGET_R || x * x + z * z > LOST * LOST) done = true;
      }
      pos.setXYZ(i, x, sheetY(x, z) + 0.45, z);
    }
    pos.needsUpdate = true;
    dirty = false;
  }

  function resetShip() {
    state = 'aim'; stateT = 0; eaten = null;
    P.copy(start);
    trailBuf.length = 0;
    ship.scale.setScalar(1);
    dirty = true;
    app.action('launch', { verb: 'Launch', how: 'Tap · Space', disabled: false });
  }

  function keepGhost() {
    const g = ghosts[ghostAt++ % ghosts.length];
    g.geometry.attributes.position.array.set(trail.geometry.attributes.position.array);
    g.geometry.attributes.position.needsUpdate = true;
    g.material.uniforms.uOpacity.value = 0.38;
  }

  function launch() {
    if (state !== 'aim' || morphing) return;
    state = 'fly'; stateT = 0; flightT = 0; tries++;
    Vel.set(Math.cos(aimAngle) * aimSpeed, Math.sin(aimAngle) * aimSpeed);
    app.sound.whoosh(0.6, true);
    app.sound.startCharge(34);
    app.action('launch', { verb: 'Call it back', how: 'Tap to try again' });
    showReadout();
  }

  function endFlight(kind, hole) {
    app.sound.stopCharge();
    keepGhost();
    if (kind === 'home') {
      state = 'docked'; stateT = 0; threaded++;
      [0, 2, 4, 7].forEach((n, i) => app.sound.chime(n, 220, 0.16, i * 0.13));
      app.flash(0.18, 0.8, '#bfe8ff');
      const last = path === PATHS.length - 1;
      app.toast(last ? 'All three paths. You know the Maw better than any smuggler.' : 'Threaded. The laboratory turns its lights on for you.', 4);
      app.action('launch', { verb: last ? 'Start over' : 'Next path', how: 'Tap' });
      return;
    }
    fails++;
    if (kind === 'swallowed') {
      state = 'swallowed'; stateT = 0; eaten = hole;
      app.sound.tone({ freq: 300, to: 22, dur: 1.1, gain: 0.3, type: 'sawtooth' });
      app.shake(0.8);
      app.toast(['Swallowed whole.', 'The Maw keeps that one.', 'Too close. Much too close.'][fails % 3], 2.2);
    } else {
      state = 'lost'; stateT = 0;
      app.sound.whoosh(0.8, false);
      app.toast(kind === 'orbit' ? 'Still circling. Calling it back.' : 'Flung out into the dark.', 2.2);
    }
    app.action('launch', { disabled: true });
  }

  async function nextPath() {
    if (morphing) return;
    morphing = true;
    const to = PATHS[(path + 1) % PATHS.length];
    const from = holes.map((h) => ({ ...h })), s0 = start.clone();
    app.action('launch', { disabled: true });
    ghosts.forEach((g) => { g.material.uniforms.uOpacity.value = 0; });
    app.sound.tone({ freq: 60, to: 140, dur: 1.6, gain: 0.18, type: 'triangle', wet: 0.5 });
    P.copy(start); trailBuf.length = 0; state = 'aim';
    await app.tween(1.7, (k) => {
      const e = k * k * (3 - 2 * k);
      holes.forEach((h, i) => {
        h.x = from[i].x + (to.holes[i][0] - from[i].x) * e;
        h.z = from[i].z + (to.holes[i][1] - from[i].z) * e;
        h.s = from[i].s + (to.holes[i][2] - from[i].s) * e;
      });
      start.set(s0.x + (to.start[0] - s0.x) * e, s0.y + (to.start[1] - s0.y) * e);
      P.copy(start);
    });
    path = (path + 1) % PATHS.length;
    if (path === 0) threaded = 0;
    tries = 0; fails = 0;
    aimAngle = Math.atan2(-start.y, -start.x); aimSpeed = 12;
    morphing = false;
    resetShip();
    showReadout();
    app.toast(PATHS[path].name, 2.4);
  }

  const actions = [{
    id: 'launch', verb: 'Launch', how: 'Tap · Space', kind: 'tap', key: ' ',
    down() {
      if (state === 'aim') launch();
      else if (state === 'fly') { endFlight('recall'); }
      else if (state === 'docked') nextPath();
    },
  }];

  const shipScreen = new THREE.Vector2();
  function aimFrom(ndc) {
    const ray = app.ray(ndc);
    plane.constant = -(sheetY(start.x, start.y) + 0.45);
    if (!ray.intersectPlane(plane, hitPt)) return 0;
    const dx = hitPt.x - start.x, dz = hitPt.z - start.y, len = Math.hypot(dx, dz);
    if (len > 1.5) {
      aimAngle = Math.atan2(dz, dx);
      aimSpeed = THREE.MathUtils.clamp(len * 0.6, MIN_SPEED, MAX_SPEED);
      dirty = true;
    }
    return len;
  }

  function frameShot() {
    const portrait = app.camera.aspect < 0.8;
    app.rig.roll = portrait ? -Math.PI / 2 : 0;
    app.rig.fit = portrait ? Math.min(1.7, 0.72 / app.camera.aspect) : Math.max(1, 1.55 / app.camera.aspect);
  }

  aimAngle = Math.atan2(-start.y, -start.x);

  return {
    scene, actions,
    usesArrows: true,
    enter() {
      const portrait = app.camera.aspect < 0.8;
      app.rig.set({
        target: new THREE.Vector3(portrait ? -13 : -11, -1.5, 0), theta: portrait ? 0 : -0.6, phi: portrait ? 0.8 : 0.98, radius: 60, snap: true,
        auto: 0, minPhi: 0.25, maxPhi: 1.4, minRadius: 30, maxRadius: 130, damping: 4,
      });
      frameShot();
      showReadout();
      if (state === 'docked') app.action('launch', { verb: path === PATHS.length - 1 ? 'Start over' : 'Next path', how: 'Tap' });
      else if (state === 'fly') app.action('launch', { verb: 'Call it back', how: 'Tap to try again' });
    },
    leave() { app.sound.stopCharge(); aiming = false; },
    resize: frameShot,
    onPointerDown(e, ndc) {
      if (state !== 'aim' || morphing) return false;
      v3.set(P.x, sheetY(P.x, P.y) + 0.45, P.y).project(app.camera);
      shipScreen.set((v3.x * 0.5 + 0.5) * app.width, (-v3.y * 0.5 + 0.5) * app.height);
      const x = (ndc.x * 0.5 + 0.5) * app.width, y = (-ndc.y * 0.5 + 0.5) * app.height;
      if (Math.hypot(x - shipScreen.x, y - shipScreen.y) > Math.max(70, Math.min(app.width, app.height) * 0.12)) return false;
      aiming = true;
      return true;
    },
    onPointerMove(e, ndc) { if (aiming) aimFrom(ndc); },
    onPointerUp(e, ndc) {
      if (!aiming) return;
      aiming = false;
      if (aimFrom(ndc) > 3) launch();
    },
    async demo(cue) {
      cue.say('Thread a ship through a knot of black holes.', 3.2);
      if (state === 'docked') { nextPath(); if (!(await cue.wait(2.4))) return; }
      if (!(await cue.until(() => state === 'aim' && !morphing, 6))) return;
      const OFF = [0, 10.9, -7.1];   // known good aims, found by flying each path offline
      aimAngle = Math.atan2(-start.y, -start.x) + (OFF[path] * Math.PI) / 180;
      aimSpeed = 12; dirty = true;
      if (!(await cue.wait(1.8))) return;
      cue.press('launch');
      await cue.until(() => state === 'docked' || state === 'aim', 18);
      await cue.wait(3);
    },

    update(dt, t) {
      stateT += dt;
      // ---- aim with the keys too
      if (state === 'aim' && !morphing) {
        const K = app.keys;
        const turn = (K.has('ArrowRight') || K.has('d') ? 1 : 0) - (K.has('ArrowLeft') || K.has('a') ? 1 : 0);
        const push = (K.has('ArrowUp') || K.has('w') ? 1 : 0) - (K.has('ArrowDown') || K.has('s') ? 1 : 0);
        if (turn || push) {
          aimAngle += turn * dt * 0.5;
          aimSpeed = THREE.MathUtils.clamp(aimSpeed + push * dt * 5, MIN_SPEED, MAX_SPEED);
          dirty = true;
        }
      }

      // ---- flight
      if (state === 'fly') {
        flightT += dt;
        const n = Math.max(1, Math.ceil(dt * 120)), h = dt / n;
        let near = 0;
        for (let i = 0; i < n && state === 'fly'; i++) {
          const hit = accel(P.x, P.y, acc);
          if (hit) { endFlight('swallowed', hit); break; }
          Vel.addScaledVector(acc, h);
          P.addScaledVector(Vel, h);
          if (P.lengthSq() < TARGET_R * TARGET_R) endFlight('home');
          else if (P.lengthSq() > LOST * LOST) endFlight('lost');
        }
        if (state === 'fly' && flightT > 32) endFlight('orbit');
        for (const hh of holes) if (hh.s > 0.01) near = Math.max(near, 1 - (Math.hypot(hh.x - P.x, hh.z - P.y) - 2.6 * hh.s) / 13);
        app.sound.setCharge(THREE.MathUtils.clamp(near, 0, 1));
      } else if (state === 'swallowed') {
        // drawn out thin, then gone
        const k = Math.min(1, stateT / 0.7);
        if (eaten) { P.x += (eaten.x - P.x) * dt * 6; P.y += (eaten.z - P.y) * dt * 6; }
        ship.scale.set(1 - k, 1 - k, 1 + k * 5);
        if (stateT > 1.25) resetShip();
      } else if (state === 'lost') {
        if (stateT > 1.0) resetShip();
      } else if (state === 'docked') {
        P.multiplyScalar(Math.exp(-dt * 2.5));
      }

      // ---- holes follow their live positions
      holes.forEach((h, i) => {
        h.y = sheetY(h.x, h.z);
        const part = parts[i], s = Math.max(h.s, 0.001);
        part.group.visible = h.s > 0.02;
        part.group.position.set(h.x, h.y, h.z);
        part.group.scale.setScalar(s);
        const lu = part.lens.material.uniforms, du = part.disc.material.uniforms;
        lu.uCenter.value.copy(part.group.position); lu.uRs.value = s; lu.uR.value = 13 * s; lu.uTime.value = t;
        du.uTime.value += dt; du.uCenter.value.copy(part.group.position);
        du.uNormal.value.set(0, 0, 1).applyQuaternion(part.disc.quaternion);
        sheetHoles[i].set(h.x, h.z, MASS * h.s, 0);
      });

      // ---- ship and wake
      const sy = sheetY(P.x, P.y) + 0.45;
      ship.position.set(P.x, sy, P.y);
      const heading = state === 'aim' ? aimAngle : Math.atan2(Vel.y, Vel.x);
      ship.rotation.set(0, -heading + Math.PI / 2, 0);
      ship.visible = !(state === 'swallowed' && stateT > 0.7);
      shipGlow.material.opacity = state === 'aim' ? 0.6 + 0.3 * Math.sin(t * 4) : 0.9;
      if (state === 'fly') { trailBuf.push(P.x, sy, P.y); if (trailBuf.length > TRAIL * 3) trailBuf.splice(0, 3); }
      const tp = trail.geometry.attributes.position, n = trailBuf.length / 3;
      for (let i = 0; i < TRAIL; i++) {
        const j = Math.max(0, n - TRAIL + i);
        if (n === 0) tp.setXYZ(i, P.x, sy, P.y); else tp.setXYZ(i, trailBuf[j * 3], trailBuf[j * 3 + 1], trailBuf[j * 3 + 2]);
      }
      tp.needsUpdate = true;
      trail.material.uniforms.uOpacity.value = state === 'aim' ? 0 : 1;

      if (dirty && state === 'aim') plotPreview();
      dots.visible = state === 'aim' && !morphing;
      pad.position.set(start.x, sheetY(start.x, start.y) + 0.2, start.y);
      pad.scale.setScalar(1 + 0.12 * Math.sin(t * 3));
      pad.material.opacity = state === 'aim' ? 0.65 : 0.2;
      dots.material.uniforms.uOpacity.value = 0.75 + 0.25 * Math.sin(t * 5);

      // ---- the Installation
      const ly = sheetY(0, 0);
      lab.position.set(0, ly + 1.2, 0);
      lab.rotation.y = t * 0.15;
      dock.position.set(0, ly + 0.1, 0);
      const lit = state === 'docked' ? 1 : 0;
      beacon.material.opacity = 0.45 + 0.2 * Math.sin(t * 3) + lit * 0.5;
      beacon.scale.setScalar(5 + lit * 6 + Math.sin(t * 3) * 0.5);
      dock.material.opacity = 0.4 + 0.25 * Math.sin(t * 3) + lit * 0.4;

      sky.follow(app.camera);
    },
  };
}
