// The Grass Paintings of Alderaan: whole plains planted as pictures, meant to be seen from the air.
// Pick a colour and drag across the plain to plant it. Then fly over what you made.
import * as THREE from 'three';
import { makeSky, makeSun } from '../core/sky.js';
import { NOISE } from '../core/glsl.js';

export const meta = {
  id: 'alderaan',
  name: 'The Grass Paintings',
  tag: 'Alderaan’s pictures the size of cities',
  blurb: 'On a world that no longer exists, artists planted whole plains with coloured grasses and flowers. The pictures were so large that you could only take them in from the air.',
  since: 1995,
  accent: '#f6d76a',
  isNew: true,
  hint: 'Pick a colour and drag across the plain to plant it. Then fly over what you made.',
  bloom: { strength: 0.28, radius: 0.5, threshold: 0.92 },
  scrim: 0.45,
  drone: 0,
};

const FIELD = 120;          // the plantable square, in world units
const COLOURS = [
  { id: 'gold', label: 'Sunpetal', color: '#ffd23f' },
  { id: 'rose', label: 'Aldera rose', color: '#ff5d8f' },
  { id: 'sky', label: 'Skybloom', color: '#5db7ff' },
  { id: 'snow', label: 'Snowgrass', color: '#fff6e6' },
  { id: 'ember', label: 'Ember lily', color: '#ff7b2e' },
  { id: 'grass', label: 'Plain grass (clears flowers)', color: '#3f7a2c' },
];

const GROUND_VERT = /* glsl */ `
varying vec3 vWP;
varying vec3 vN;
${NOISE}
// flat where you paint, rolling into hills further out
float height(vec2 p){
  float r = length(p);
  float m = smoothstep(72.0, 210.0, r);
  return (snoise(vec3(p * 0.008, 1.0)) * 9.0 + snoise(vec3(p * 0.021, 2.0)) * 3.0 + 6.0 * smoothstep(200.0, 340.0, r)) * m;
}
void main(){
  vec3 p = position;
  p.y = height(p.xz);
  float e = 1.5;
  float hx = height(p.xz + vec2(e, 0.0)) - p.y, hz = height(p.xz + vec2(0.0, e)) - p.y;
  vN = normalize(vec3(-hx, e, -hz));
  vec4 wp = modelMatrix * vec4(p, 1.0);
  vWP = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;
const GROUND_FRAG = /* glsl */ `
varying vec3 vWP;
varying vec3 vN;
uniform sampler2D uPaint;
uniform float uTime, uWind, uField;
uniform vec3 uSunDir, uSunColor, uFog;
uniform vec2 uWindDir;
${NOISE}
void main(){
  vec2 p = vWP.xz;
  // wind: slow rolling gusts and a quick fine ripple, both travelling downwind
  vec2 drift = uWindDir * uTime;
  float gust = snoise(vec3(p * 0.03 - drift * (0.5 + uWind * 1.2), uTime * 0.06));
  float ripple = snoise(vec3(p * 0.2 - drift * (2.0 + uWind * 4.0), 3.0));
  float sway = gust * 0.65 + ripple * 0.3;

  float tuft = snoise(vec3(p * 1.6, 1.0));
  float fine = snoise(vec3(p * 8.0, 4.0));
  float dry = smoothstep(0.2, 0.9, snoise(vec3(p * 0.018, 9.0)));
  vec3 col = mix(vec3(0.07, 0.24, 0.05), vec3(0.22, 0.42, 0.09), 0.5 + 0.5 * tuft);
  col = mix(col, vec3(0.42, 0.42, 0.14), dry * 0.4);
  col *= 0.86 + 0.14 * fine;

  // flowers: each one opens when enough has been planted around it, so edges stay ragged and alive
  vec2 uv = p / uField + 0.5;
  if (uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0) {
    vec4 paint = texture2D(uPaint, uv);
    float seed = snoise(vec3(p * 4.5, 7.0)) * 0.5 + 0.5;
    float bloom = smoothstep(seed * 0.7, seed * 0.7 + 0.16, paint.a);
    float petal = 0.78 + 0.4 * snoise(vec3(p * 11.0, 2.0));
    col = mix(col, paint.rgb * paint.rgb * petal, bloom * 0.93);
  }

  col *= 1.0 + 0.24 * sway * (0.6 + uWind);
  col += vec3(0.3, 0.3, 0.2) * pow(max(sway, 0.0), 3.0) * (0.25 + 0.5 * uWind);

  // drifting cloud shadows
  float shade = smoothstep(-0.15, 0.45, fbm3(vec3(p * 0.011 + vec2(uTime * 0.012, 0.0), 5.0)));
  col *= mix(0.5, 1.0, shade);
  col *= uSunColor * (0.5 + 0.75 * max(dot(normalize(vN), uSunDir), 0.0));

  // haze thickens toward the horizon, not straight down, so the view from above stays crisp
  float d = length(vWP.xz - cameraPosition.xz) * 0.0027;
  col = mix(col, uFog, 1.0 - exp(-d * d));
  gl_FragColor = vec4(col, 1.0);
}
`;

const PETAL_VERT = /* glsl */ `
attribute float aPhase;
attribute float aSpeed;
attribute vec3 aColor;
uniform float uTime, uWind, uPx;
uniform vec2 uWindDir;
varying vec3 vColor;
void main(){
  float life = fract(aPhase + uTime * aSpeed);
  vec3 p = position;
  p.xz += uWindDir * life * (18.0 + 46.0 * uWind);
  p.y = 0.3 + sin(life * 3.14159) * (2.0 + 9.0 * aPhase) * (0.3 + uWind);
  p.x += sin(uTime * 2.0 + aPhase * 40.0) * 0.8;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(uPx * 120.0 / -mv.z, 1.5, 7.0);
  vColor = aColor * sin(life * 3.14159) * smoothstep(0.08, 0.5, uWind);
}
`;
const PETAL_FRAG = /* glsl */ `
varying vec3 vColor;
void main(){
  float d = length(gl_PointCoord - 0.5);
  gl_FragColor = vec4(vColor, (1.0 - smoothstep(0.25, 0.5, d)) * step(0.02, dot(vColor, vec3(1.0))));
}
`;

function mountainRing(radius, low, high, seed, rock, snow, sunAz) {
  const N = 480, pos = [], col = [], idx = [];
  const cRock = new THREE.Color(rock), cSnow = new THREE.Color(snow), c = new THREE.Color();
  // sharp ridges: each term peaks to a point, the way real summits do
  const ridge = (x) => 1 - Math.abs(Math.sin(x));
  const n1 = (a) => ridge(a * 4 + seed) * 0.5 + ridge(a * 11 + seed * 2) * 0.3 + ridge(a * 29 + seed * 3) * 0.14 + ridge(a * 67 + seed) * 0.06;
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2;
    const peak = low + (high - low) * Math.pow(n1(a), 1.5);
    const lit = 0.72 + 0.28 * Math.cos(a - sunAz);        // the sunward side of the range is brighter
    const x = Math.cos(a) * radius, z = Math.sin(a) * radius;
    for (const [f, mix] of [[0, 0], [0.7, 0.0], [1, 1]]) {
      pos.push(x, -6 + (peak + 6) * f, z);
      c.copy(cRock).lerp(cSnow, mix).multiplyScalar(lit);
      col.push(c.r, c.g, c.b);
    }
    if (i < N) {
      const b = i * 3;
      idx.push(b, b + 3, b + 1, b + 1, b + 3, b + 4, b + 1, b + 4, b + 2, b + 2, b + 4, b + 5);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: false }));
}

// The picture already growing when you arrive, so the plain shows what it is for.
function plantMandala(g, W) {
  const R = W / 2, TAU = Math.PI * 2;
  g.save();
  g.translate(R, R);
  g.shadowBlur = W * 0.012;
  const petals = (n, r0, r1, half, colour, turn = 0) => {
    g.fillStyle = g.shadowColor = colour;
    for (let k = 0; k < n; k++) {
      g.save(); g.rotate(turn + (k / n) * TAU);
      g.beginPath(); g.ellipse(((r0 + r1) / 2) * R, 0, ((r1 - r0) / 2) * R, half * R, 0, 0, TAU); g.fill();
      g.restore();
    }
  };
  g.strokeStyle = g.shadowColor = '#ff7b2e'; g.lineWidth = 0.022 * R;
  g.beginPath(); g.arc(0, 0, 0.88 * R, 0, TAU); g.stroke();
  petals(24, 0.745, 0.815, 0.035, '#ffd23f');
  petals(12, 0.38, 0.7, 0.07, '#ff5d8f');
  petals(12, 0.22, 0.52, 0.05, '#5db7ff', TAU / 24);
  petals(6, 0.08, 0.3, 0.06, '#ffd23f');
  g.fillStyle = g.shadowColor = '#fff6e6';
  g.beginPath(); g.arc(0, 0, 0.085 * R, 0, TAU); g.fill();
  g.restore();
}

export function create(app) {
  const scene = new THREE.Scene();
  const fog = new THREE.Color('#b9cfe6');
  scene.fog = new THREE.FogExp2(fog, 0.0021);
  const sky = makeSky(app.renderer, {
    base: '#2a66cc', horizon: '#d5e4f4', horizonHeight: 0.24, a: '#ffffff', b: '#fff1e2', c: '#ffd9bf', density: 0.3, dust: 0, gain: 0.32, seed: 23.1, scale: 1.5,
  });
  const sun = makeSun('#fff2d8', 230);
  sun.dir.set(0.52, 0.27, -0.81).normalize();
  sun.core.material.depthTest = sun.halo.material.depthTest = true;
  scene.add(sky.mesh, sun.group);
  scene.add(new THREE.HemisphereLight('#cfe0ff', '#5a6a3a', 1.1));
  const light = new THREE.DirectionalLight('#fff0d0', 2.2);
  light.position.copy(sun.dir);
  scene.add(light);

  // ---- the painting itself: an ordinary canvas the ground reads as "what is planted here"
  const W = app.coarse ? 768 : 1024;
  const cv = document.createElement('canvas');
  cv.width = cv.height = W;
  const g = cv.getContext('2d');
  plantMandala(g, W);
  const paintTex = new THREE.CanvasTexture(cv);
  paintTex.flipY = false;
  paintTex.colorSpace = THREE.NoColorSpace;
  paintTex.minFilter = THREE.LinearFilter;
  paintTex.generateMipmaps = false;

  const windDir = new THREE.Vector2(0.86, 0.5);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(760, 760, 150, 150).rotateX(-Math.PI / 2),
    new THREE.ShaderMaterial({
      vertexShader: GROUND_VERT, fragmentShader: GROUND_FRAG,
      uniforms: {
        uPaint: { value: paintTex }, uTime: { value: 0 }, uWind: { value: 0 }, uField: { value: FIELD },
        uSunDir: { value: sun.dir.clone() }, uSunColor: { value: new THREE.Color('#fff4e2') }, uFog: { value: fog },
        uWindDir: { value: windDir },
      },
    }),
  );
  ground.frustumCulled = false;
  scene.add(ground);

  // ---- snow peaks on every horizon
  const sunAz = Math.atan2(sun.dir.z, sun.dir.x);
  scene.add(mountainRing(350, 34, 120, 1.3, '#4a629a', '#ffffff', sunAz), mountainRing(450, 60, 190, 4.1, '#6f8cc0', '#ffffff', sunAz));

  // ---- dark groves around the meadow, for a sense of size
  const trees = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 4.2, 6), new THREE.MeshLambertMaterial({ color: '#2c6a2e', fog: false }), 520);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), scl = new THREE.Vector3();
  for (let i = 0; i < 520; i++) {
    // clumps, not a scatter
    const ca = Math.floor(Math.random() * 26) * 0.2417 * 6.28, cr = 78 + (Math.floor(Math.random() * 26) % 4) * 6;
    const x = Math.cos(ca) * cr + (Math.random() - 0.5) * 16, z = Math.sin(ca) * cr + (Math.random() - 0.5) * 16;
    const s = 0.7 + Math.random() * 0.9;
    trees.setMatrixAt(i, m4.compose(pos.set(x, 1.7 * s, z), q.identity(), scl.set(s, s, s)));
  }
  scene.add(trees);

  // ---- petals that lift when the wind is called
  const NP = 1500;
  const pp = new Float32Array(NP * 3), pph = new Float32Array(NP), psp = new Float32Array(NP), pc = new Float32Array(NP * 3);
  const tmpC = new THREE.Color();
  for (let i = 0; i < NP; i++) {
    const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * 70;
    pp.set([Math.cos(a) * r - 20, 0, Math.sin(a) * r - 12], i * 3);
    pph[i] = Math.random(); psp[i] = 0.12 + Math.random() * 0.14;
    tmpC.set(COLOURS[i % 5].color);
    pc.set([tmpC.r, tmpC.g, tmpC.b], i * 3);
  }
  const petalGeo = new THREE.BufferGeometry();
  petalGeo.setAttribute('position', new THREE.BufferAttribute(pp, 3));
  petalGeo.setAttribute('aPhase', new THREE.BufferAttribute(pph, 1));
  petalGeo.setAttribute('aSpeed', new THREE.BufferAttribute(psp, 1));
  petalGeo.setAttribute('aColor', new THREE.BufferAttribute(pc, 3));
  const petals = new THREE.Points(petalGeo, new THREE.ShaderMaterial({
    vertexShader: PETAL_VERT, fragmentShader: PETAL_FRAG, transparent: true, depthWrite: false,
    uniforms: { uTime: { value: 0 }, uWind: { value: 0 }, uPx: { value: app.px }, uWindDir: { value: windDir } },
  }));
  petals.frustumCulled = false;
  scene.add(petals);

  // ---- state
  let colour = COLOURS[0], mirror = true, flying = false, blowing = false, wind = 0, painting = false, dirty = false, lastNote = 0, saidWind = false;
  const last = new THREE.Vector2(), cur = new THREE.Vector2(), hit = new THREE.Vector3();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const showReadout = () => app.readout(flying ? 'Seen as a traveller would see it' : `Planting ${colour.label.split(' (')[0]}${mirror ? ' · Mirrored six ways' : ''}`);

  function stamp(px, py) {
    const erase = colour.id === 'grass', r = W * (erase ? 0.034 : 0.024);
    const turns = mirror ? 6 : 1, c = W / 2;
    g.globalCompositeOperation = erase ? 'destination-out' : 'source-over';
    for (let k = 0; k < turns; k++) {
      const a = (k / turns) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      for (const flip of mirror ? [1, -1] : [1]) {
        const dx = px - c, dy = (py - c) * flip;
        const x = c + dx * ca - dy * sa, y = c + dx * sa + dy * ca;
        const grad = g.createRadialGradient(x, y, 0, x, y, r);
        grad.addColorStop(0, erase ? 'rgba(0,0,0,0.7)' : colour.color);
        grad.addColorStop(0.45, erase ? 'rgba(0,0,0,0.5)' : colour.color);
        grad.addColorStop(1, erase ? 'rgba(0,0,0,0)' : colour.color + '00');
        g.fillStyle = grad;
        g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      }
    }
    g.globalCompositeOperation = 'source-over';
    dirty = true;
  }

  function paintAt(ndc, first) {
    if (!app.ray(ndc).intersectPlane(plane, hit)) return;
    cur.set((hit.x / FIELD + 0.5) * W, (hit.z / FIELD + 0.5) * W);
    if (cur.x < 0 || cur.y < 0 || cur.x > W || cur.y > W) { painting = 'off'; return; }
    if (first || painting === 'off') { last.copy(cur); painting = true; }
    // fill in between pointer samples so a fast drag still leaves an unbroken line
    const dist = last.distanceTo(cur), steps = Math.max(1, Math.ceil(dist / (W * 0.008)));
    for (let i = 1; i <= steps; i++) stamp(last.x + (cur.x - last.x) * (i / steps), last.y + (cur.y - last.y) * (i / steps));
    last.copy(cur);
    if (app.time - lastNote > 0.16) {
      lastNote = app.time;
      const ring = Math.min(9, Math.floor(Math.hypot(hit.x, hit.z) / 7));
      app.sound.tone({ freq: 196 * Math.pow(2, [0, 2, 4, 7, 9, 12, 14, 16, 19, 21][ring] / 12), dur: 0.7, gain: 0.05, type: 'triangle', wet: 0.6 });
    }
  }

  function setView(fly, snap) {
    flying = fly;
    const aspect = app.camera.aspect;
    if (fly) app.rig.set({ target: new THREE.Vector3(0, 2, 0), phi: 1.33, radius: 62, auto: app.reduced ? 0 : 0.07, snap });
    else app.rig.set({ target: new THREE.Vector3(0, 0, 0), theta: Math.round(app.rig.goalTheta / (Math.PI * 2)) * Math.PI * 2, phi: 0.52, radius: 122, auto: 0, snap });
    app.rig.fit = fly ? 1 : Math.max(1, 1.13 / aspect);
    app.action('view', fly ? { verb: 'Back to planting', how: 'Tap' } : { verb: 'Fly over it', how: 'Tap' });
    app.hint(fly ? 'Drag to look around. This is how a traveller passing overhead would have seen it.' : meta.hint);
    showReadout();
  }

  const actions = [
    {
      id: 'colour', verb: 'Flower colour', kind: 'choice', value: 'gold', options: COLOURS,
      pick(id) { colour = COLOURS.find((c) => c.id === id); if (flying) setView(false); showReadout(); },
    },
    {
      id: 'mirror', verb: 'Mirror: on', how: 'Six-fold symmetry', kind: 'tap', key: 'x',
      down() { mirror = !mirror; app.action('mirror', { verb: mirror ? 'Mirror: on' : 'Mirror: off', how: mirror ? 'Six-fold symmetry' : 'Freehand' }); showReadout(); },
    },
    {
      id: 'wind', verb: 'Call the wind', how: 'Hold', kind: 'hold', key: ' ',
      down() { blowing = true; if (!saidWind) { saidWind = true; app.toast('The whole plain leans with the wind.', 3); } },
      up() { blowing = false; },
    },
    { id: 'view', verb: 'Fly over it', how: 'Tap', kind: 'tap', key: 'f', down() { setView(!flying); } },
  ];

  return {
    scene, actions,
    enter() {
      app.rig.set({ minPhi: 0.2, maxPhi: 1.5, minRadius: 26, maxRadius: 330, damping: 2.6, minY: 3, theta: 0 });
      setView(flying, true);
      app.action('mirror', { verb: mirror ? 'Mirror: on' : 'Mirror: off', how: mirror ? 'Six-fold symmetry' : 'Freehand' });
    },
    leave() { app.sound.stopWind(); blowing = false; painting = false; },
    resize() { app.rig.fit = flying ? 1 : Math.max(1, 1.13 / app.camera.aspect); },
    onPointerDown(e, ndc) {
      if (flying) return false;
      paintAt(ndc, true);
      return true;
    },
    onPointerMove(e, ndc) { if (painting) paintAt(ndc, false); },
    onPointerUp() { painting = false; },
    update(dt, t) {
      wind += ((blowing ? 1 : 0) - wind) * (1 - Math.exp(-dt * (blowing ? 1.6 : 0.8)));
      app.meter('wind', wind, wind > 0.8);
      if (!app.sound.windNodes) app.sound.startWind();
      app.sound.setWind(0.05 + wind * 0.8);
      // now and then, a bird
      if (Math.random() < dt * 0.25 && wind < 0.3) {
        const f = 2200 + Math.random() * 1400;
        app.sound.tone({ freq: f, to: f * 1.25, dur: 0.09, gain: 0.02, wet: 0.5 });
        app.sound.tone({ freq: f * 1.2, to: f * 0.95, dur: 0.11, gain: 0.02, delay: 0.13, wet: 0.5 });
      }
      if (dirty) { paintTex.needsUpdate = true; dirty = false; }
      const gu = ground.material.uniforms;
      gu.uTime.value = t; gu.uWind.value = wind;
      const pu = petals.material.uniforms;
      pu.uTime.value = t; pu.uWind.value = wind;
      sky.follow(app.camera);
      sun.follow(app.camera);
    },
  };
}
