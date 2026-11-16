// Centerpoint Station: an ancient machine that tows planets.
// Hold to pull a wandering world inward; let go while a ring is lit to set it in orbit.
import * as THREE from 'three';
import { makeSky, makeStars, makeGlow } from '../core/sky.js';
import { makePlanet, makeStar } from '../core/bodies.js';

export const meta = {
  id: 'centerpoint',
  name: 'Centerpoint Station',
  tag: 'The planet mover',
  blurb: 'A machine older than memory, built to tow planets across space. Long ago it gathered five wandering worlds around a single sun.',
  since: 1995,
  accent: '#ffb347',
  hint: 'Press and hold to pull a world in. Let go while a ring is lit to set it in orbit.',
  bloom: { strength: 0.7, radius: 0.6, threshold: 0.66 },
  fov: 34,
  drone: 49,
};

const ORBITS = [5, 7.5, 10, 12.5, 15];
const ZONE = 0.9;        // how close to a ring counts as "on it"
const TOO_CLOSE = 3.3;    // nearer the sun than this and the beam loses its grip

const WORLDS = [
  { radius: 1.0, look: { seed: 1.7, sea: 0.02, cloudAmt: 0.8, atmo: '#7fc4ff' } },
  { radius: 0.9, look: { seed: 5.1, ocean: '#6a3a1a', shallow: '#a8642a', landA: '#c98a4a', landB: '#8a4a2a', landC: '#f0d0a0', sea: -0.35, cloudAmt: 0.25, atmo: '#ffc890' } },
  { radius: 0.8, look: { seed: 9.4, ocean: '#2a5a8a', shallow: '#8ac8ee', landA: '#dfeef8', landB: '#b8d0e8', landC: '#ffffff', sea: -0.1, cloudAmt: 0.5, atmo: '#bfe6ff', ice: 0.5 } },
  { radius: 1.1, look: { seed: 13.8, ocean: '#0a2a3a', shallow: '#1a5a5a', landA: '#1f5a2a', landB: '#4a8a2a', landC: '#b8c87a', sea: -0.22, cloudAmt: 0.7, atmo: '#8fffc0' } },
  { radius: 0.72, look: { seed: 17.2, landA: '#2a2020', landB: '#4a3028', landC: '#806050', sea: -5, cloudAmt: 0.15, veins: 1, veinColor: '#ff6a2a', atmo: '#ff9a6a' } },
];

// ---------------------------------------------------------------- station
function hullTextures() {
  const W = 1024, H = 512;
  const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
  const a = mk(), e = mk();
  const g = a.getContext('2d'), ge = e.getContext('2d');
  g.fillStyle = '#7b8089'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 1100; i++) {
    const w = 8 + Math.random() * 90, h = 6 + Math.random() * 46, x = Math.random() * W, y = Math.random() * H;
    const l = 34 + Math.random() * 30;
    g.fillStyle = `hsl(${210 + Math.random() * 30}, ${4 + Math.random() * 8}%, ${l}%)`;
    g.fillRect(x, y, w, h);
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1; g.strokeRect(x + 0.5, y + 0.5, w, h);
  }
  // a few rust-coloured hatches, so it reads as old
  for (let i = 0; i < 40; i++) {
    g.fillStyle = `rgba(150, ${70 + Math.random() * 40}, 40, 0.5)`;
    g.fillRect(Math.random() * W, Math.random() * H, 6 + Math.random() * 30, 4 + Math.random() * 10);
  }
  ge.fillStyle = '#000'; ge.fillRect(0, 0, W, H);
  for (let i = 0; i < 520; i++) {
    const x = Math.random() * W, y = Math.random() * H, n = 2 + Math.floor(Math.random() * 12);
    ge.fillStyle = Math.random() < 0.7 ? '#ffd9a0' : '#a8d8ff';
    for (let k = 0; k < n; k++) if (Math.random() < 0.8) ge.fillRect(x + k * 5, y, 2, 2);
  }
  const map = new THREE.CanvasTexture(a), emissive = new THREE.CanvasTexture(e);
  for (const t of [map, emissive]) { t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; }
  return { map, emissive };
}

const TIP_Z = 5.0;

function buildStation(accent) {
  const station = new THREE.Group();
  const tex = hullTextures();
  const hull = new THREE.MeshStandardMaterial({
    map: tex.map, emissiveMap: tex.emissive, emissive: 0xffffff, emissiveIntensity: 2.4, metalness: 0.55, roughness: 0.58,
  });
  const dark = new THREE.MeshStandardMaterial({ color: 0x3a3e46, metalness: 0.7, roughness: 0.45 });

  // the great sphere in the middle
  const core = new THREE.Mesh(new THREE.SphereGeometry(1.3, 48, 32), hull);
  station.add(core);
  const belt = new THREE.Mesh(new THREE.TorusGeometry(1.32, 0.07, 8, 64), dark);
  station.add(belt);

  // two long tapering arms along the Z axis
  for (const dir of [1, -1]) {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.66, 3.7, 32, 1), hull);
    arm.rotation.x = dir * Math.PI / 2;           // narrow end points outward
    arm.position.z = dir * 2.95;
    station.add(arm);
    for (const [z, r] of [[1.25, 0.72], [2.4, 0.6], [3.6, 0.5], [4.7, 0.42]]) {
      const collar = new THREE.Mesh(new THREE.TorusGeometry(r, 0.06, 8, 40), dark);
      collar.position.z = dir * z;
      station.add(collar);
    }
    const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.3, 0.4, 28, 1, true), dark);
    dish.material.side = THREE.DoubleSide;
    dish.rotation.x = dir * Math.PI / 2;
    dish.position.z = dir * (TIP_Z - 0.05);
    station.add(dish);
  }

  // bolted-on clutter over the sphere
  const boxes = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), dark, 150);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), up = new THREE.Vector3(0, 0, 1);
  for (let i = 0; i < 150; i++) {
    const u = Math.random() * 2 - 1, t = Math.random() * Math.PI * 2, k = Math.sqrt(1 - u * u);
    p.set(k * Math.cos(t), k * Math.sin(t), u);
    q.setFromUnitVectors(up, p);
    s.set(0.05 + Math.random() * 0.22, 0.05 + Math.random() * 0.22, 0.04 + Math.random() * 0.1);
    p.multiplyScalar(1.3 + s.z * 0.4);
    boxes.setMatrixAt(i, m.compose(p, q, s));
  }
  station.add(boxes);

  // the emitter: a bright disc at the +Z tip, and a matching dim one at the far end
  const lens = new THREE.Mesh(
    new THREE.CircleGeometry(0.5, 32),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(accent).multiplyScalar(1.5) }),
  );
  lens.position.z = TIP_Z + 0.02;
  const glow = makeGlow(accent, 3.2, 0.5);
  glow.position.z = TIP_Z + 0.1;
  const backGlow = makeGlow('#9fc8ff', 2.2, 0.35);
  backGlow.position.z = -TIP_Z - 0.1;
  station.add(lens, glow, backGlow);

  return { station, lens, glow };
}

const BEAM_VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vN;
varying vec3 vV;
void main(){
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}
`;
const BEAM_FRAG = /* glsl */ `
varying vec2 vUv;
varying vec3 vN;
varying vec3 vV;
uniform float uTime, uOn;
uniform vec3 uColor;
void main(){
  float flow = 0.5 + 0.5 * sin(vUv.y * 46.0 + uTime * 14.0);
  float rings = flow * flow * flow;
  float edge = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 1.6);
  float twist = 0.5 + 0.5 * sin(vUv.x * 18.85 + vUv.y * 20.0 - uTime * 6.0);
  float a = uOn * (0.08 + 0.3 * rings + 0.5 * edge + 0.14 * twist);
  gl_FragColor = vec4(uColor * a, 1.0);
}
`;

function reticleTexture() {
  const s = 128, c = document.createElement('canvas'); c.width = c.height = s;
  const g = c.getContext('2d');
  g.strokeStyle = '#fff'; g.lineWidth = 3;
  for (let i = 0; i < 4; i++) {
    g.beginPath(); g.arc(s / 2, s / 2, 52, i * Math.PI / 2 + 0.25, (i + 1) * Math.PI / 2 - 0.25); g.stroke();
  }
  return new THREE.CanvasTexture(c);
}

// ---------------------------------------------------------------- scene
export function create(app) {
  const scene = new THREE.Scene();
  const accent = new THREE.Color(meta.accent);
  const sky = makeSky(app.renderer, { a: '#0b1a40', b: '#1a1030', c: '#6a4a20', base: '#010309', density: 0.36, dust: 0.6, gain: 0.5, seed: 12.6 });
  const stars = makeStars(4200);
  scene.add(sky.mesh, stars.points);

  const sunLight = new THREE.PointLight('#ffe2b8', 4.5, 0, 0);
  scene.add(sunLight, new THREE.HemisphereLight('#8098d0', '#141420', 0.9));
  const rim = new THREE.DirectionalLight('#b8d0ff', 1.1);
  scene.add(rim);

  const star = makeStar({ radius: 1.6, hot: '#fff0c0', cool: '#ff9a3a', glow: '#ffbf70', boost: 1.7, corona: 1.7, flare: 5, flareOpacity: 0.3, haloGain: 1.2 });
  scene.add(star.group);

  const { station, lens, glow: tipGlow } = buildStation(meta.accent);
  station.position.set(0, 8, 0);
  station.scale.setScalar(1.25);
  scene.add(station);

  // orbit rings: a thin line, plus a wide soft band that shows where a world can be dropped
  const rings = ORBITS.map((R) => {
    const flat = (geo, opacity) => {
      const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
        color: accent.clone(), transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      }));
      mesh.rotation.x = -Math.PI / 2;
      scene.add(mesh);
      return mesh;
    };
    return {
      R, filled: false, heat: 0,
      line: flat(new THREE.RingGeometry(R - 0.04, R + 0.04, 160), 0.2),
      band: flat(new THREE.RingGeometry(R - ZONE, R + ZONE, 160), 0),
    };
  });

  // the worlds
  const planets = WORLDS.map((w, i) => {
    const p = makePlanet({ ambient: 0.1, ...w.look }, 48);
    p.group.scale.setScalar(w.radius);
    scene.add(p.group);
    return {
      ...p, radius: w.radius, i,
      home: 19 + (i % 2) * 1.6, r: 19 + (i % 2) * 1.6,
      ang: (i / WORLDS.length) * Math.PI * 2 + 0.5, drift: (i % 2 ? -1 : 1) * (0.018 + i * 0.004),
      state: 'rogue', ring: -1, pos: new THREE.Vector3(), lift: 0,
    };
  });

  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(1, 0.2, 1, 28, 12, true).rotateX(Math.PI / 2).translate(0, 0, 0.5),
    new THREE.ShaderMaterial({
      vertexShader: BEAM_VERT, fragmentShader: BEAM_FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uOn: { value: 0 }, uColor: { value: accent.clone().multiplyScalar(1.6) } },
    }),
  );
  beam.frustumCulled = false;
  scene.add(beam);
  const grip = makeGlow(meta.accent, 5, 0);
  scene.add(grip);
  const reticle = new THREE.Sprite(new THREE.SpriteMaterial({
    map: reticleTexture(), color: meta.accent, transparent: true, opacity: 0.9, depthTest: false, depthWrite: false,
  }));
  scene.add(reticle);

  // ---- state
  let target = 0, pulling = false, pull = 0, beamOn = 0, placed = 0, done = false, zone = -1;
  const tip = new THREE.Vector3(), aim = new THREE.Object3D(), v = new THREE.Vector3(), toSun = new THREE.Vector3();

  const showReadout = () => app.readout(`Worlds in orbit ${placed} of ${planets.length}`);
  const nextTarget = () => {
    const free = planets.filter((p) => p.state === 'rogue' || p.state === 'held');
    target = free.length ? free[0].i : -1;
  };

  function startPull() {
    if (done) { scatter(); return; }
    if (pulling || target < 0) return;
    const p = planets[target];
    if (p.state !== 'rogue') return;
    pulling = true; pull = 1.5; p.state = 'held';
    app.sound.startCharge(42);
  }

  function stopPull() {
    if (!pulling) return;
    pulling = false;
    app.sound.stopCharge();
    const p = planets[target];
    if (p.state !== 'held') return;
    if (zone >= 0) {
      const ring = rings[zone];
      ring.filled = true; ring.heat = 1;
      p.state = 'orbit'; p.ring = zone;
      const from = p.r;
      app.tween(0.5, (k) => { p.r = from + (ring.R - from) * app.easeOut(k); });
      placed++;
      app.sound.chime(zone * 2, 196, 0.2);
      app.sound.tone({ freq: 98, dur: 0.8, gain: 0.2 });
      showReadout();
      nextTarget();
      if (placed === planets.length) finish();
      else if (placed === 1) app.toast('Locked in. Four more worlds to go.', 2.6);
    } else {
      p.state = 'rogue';        // it drifts back out; grab it again any time
    }
  }

  function finish() {
    done = true;
    rings.forEach((r) => { r.heat = 1.5; });
    app.toast('Five worlds, one sun. A solar system built by hand.', 5);
    [0, 2, 4, 7, 9].forEach((n, i) => app.sound.chime(n, 196, 0.16, i * 0.16));
    app.action('pull', { verb: 'Scatter the worlds', how: 'Tap to play again' });
    app.hint('Drag to admire your work. Scatter the worlds to play again.');
  }

  function scatter() {
    done = false; placed = 0;
    app.sound.whoosh(1.2, false);
    rings.forEach((r) => { r.filled = false; });
    planets.forEach((p) => {
      p.state = 'fling'; p.ring = -1;
      const from = p.r;
      app.tween(1.6, (k) => { p.r = from + (p.home - from) * app.easeOut(k); }).then(() => { p.state = 'rogue'; });
    });
    target = 0;
    app.action('pull', { verb: 'Tractor beam', how: 'Hold to pull, let go to drop' });
    app.hint(meta.hint);
    showReadout();
  }

  function slip(p) {
    pulling = false;
    app.sound.stopCharge();
    app.sound.whoosh(0.9, false);
    app.shake(0.5);
    p.state = 'fling';
    const from = p.r;
    app.tween(1.8, (k) => { p.r = from + (p.home - from) * app.easeOut(k); }).then(() => { p.state = 'rogue'; });
    app.toast('Too close to the sun. It slipped away.', 2.6);
  }

  // which world is under the pointer, if any
  function worldAt(ndc) {
    const W = app.width, H = app.height, x = (ndc.x * 0.5 + 0.5) * W, y = (-ndc.y * 0.5 + 0.5) * H;
    let best = -1, bestD = Math.max(46, Math.min(W, H) * 0.07);
    for (const p of planets) {
      if (p.state !== 'rogue') continue;
      v.copy(p.pos).project(app.camera);
      const d = Math.hypot((v.x * 0.5 + 0.5) * W - x, (-v.y * 0.5 + 0.5) * H - y);
      if (d < bestD) { best = p.i; bestD = d; }
    }
    return best;
  }

  const actions = [{
    id: 'pull', verb: 'Tractor beam', how: 'Hold to pull, let go to drop', kind: 'hold', key: ' ',
    down: startPull, up: stopPull,
  }];

  function frameShot() {
    const portrait = app.camera.aspect < 0.8;
    app.rig.roll = portrait ? Math.PI / 2 : 0;
    app.rig.fit = portrait ? Math.min(2.0, 0.72 / app.camera.aspect) : Math.max(1, 1.6 / app.camera.aspect);
  }

  return {
    scene, actions,
    enter() {
      app.rig.set({
        target: new THREE.Vector3(0, 1, 0), theta: 0.5, phi: 1.13, radius: 50, snap: true,
        auto: app.reduced ? 0 : 0.03, minPhi: 0.3, maxPhi: 1.45, minRadius: 18, maxRadius: 95, damping: 4,
      });
      frameShot();
      showReadout();
      if (done) { app.action('pull', { verb: 'Scatter the worlds', how: 'Tap to play again' }); }
    },
    leave() { if (pulling) stopPull(); app.sound.stopCharge(); },
    resize: frameShot,
    onPointerDown(e, ndc) {
      if (done) return false;
      const i = worldAt(ndc);
      if (i < 0) return false;
      if (!pulling) { target = i; startPull(); }
      return true;
    },
    onPointerUp() { stopPull(); },
    update(dt, t) {
      star.tick(t);
      star.group.rotation.y += dt * 0.02;
      beam.material.uniforms.uTime.value = t;

      // worlds
      zone = -1;
      for (const p of planets) {
        if (p.state === 'held') {
          pull = Math.min(7.5, pull + dt * 4.5);
          p.r -= pull * dt;
          app.sound.setCharge(Math.min(1, pull / 7.5));
          for (let k = 0; k < rings.length; k++) if (!rings[k].filled && Math.abs(p.r - rings[k].R) < ZONE) zone = k;
          if (p.r < TOO_CLOSE) slip(p);
        } else if (p.state === 'rogue') {
          if (p.r < p.home) p.r = Math.min(p.home, p.r + dt * 2.2);
          p.ang += p.drift * dt;
        } else if (p.state === 'orbit') {
          p.ang += dt * 5.5 / Math.pow(rings[p.ring].R, 1.5);
        }
        // worlds bob above and below the plane while they wander, and settle flat as they come in
        const wander = THREE.MathUtils.smoothstep(p.r, ORBITS[4] + 1, p.home);
        p.lift += ((p.state === 'orbit' ? 0 : wander) - p.lift) * (1 - Math.exp(-dt * 3));
        p.pos.set(Math.cos(p.ang) * p.r, Math.sin(t * 0.35 + p.i * 1.9) * 1.6 * p.lift, Math.sin(p.ang) * p.r);
        p.group.position.copy(p.pos);
        p.body.rotation.y += dt * 0.12;
        toSun.copy(p.pos).multiplyScalar(-1).normalize();
        p.setLight(toSun);
        p.tick(t);
      }

      // rings
      for (let k = 0; k < rings.length; k++) {
        const r = rings[k], lit = k === zone;
        r.heat = Math.max(0, r.heat - dt * 0.8);
        const pulse = 0.75 + 0.25 * Math.sin(t * 10);
        r.line.material.opacity = (r.filled ? 0.42 : lit ? 1.0 * pulse : 0.16) + r.heat * 0.8;
        const want = r.filled ? 0 : lit ? 0.16 * pulse : pulling ? 0.014 : 0;
        r.band.material.opacity += (want - r.band.material.opacity) * (1 - Math.exp(-dt * 10));
      }
      app.meter('pull', pulling && target >= 0 ? 1 - (planets[target].r - TOO_CLOSE) / (planets[target].home - TOO_CLOSE) : 0, zone >= 0);

      // the station swings its emitter toward the world it is watching
      const tp = target >= 0 ? planets[target] : null;
      aim.position.copy(station.position);
      if (tp) aim.lookAt(tp.pos);
      else { v.set(Math.cos(t * 0.1) * 30, 0, Math.sin(t * 0.1) * 30); aim.lookAt(v); }
      station.quaternion.slerp(aim.quaternion, 1 - Math.exp(-dt * 2.5));
      station.updateMatrixWorld();
      tip.set(0, 0, TIP_Z).applyMatrix4(station.matrixWorld);

      // beam
      beamOn += ((pulling ? 1 : 0) - beamOn) * (1 - Math.exp(-dt * 8));
      beam.visible = beamOn > 0.01 && !!tp;
      grip.material.opacity = 0;
      if (beam.visible) {
        beam.position.copy(tip);
        beam.lookAt(tp.pos);
        const d = tip.distanceTo(tp.pos), w = tp.radius * 1.35;
        beam.scale.set(w, w, d);
        beam.material.uniforms.uOn.value = beamOn;
        grip.position.copy(tp.pos);
        grip.material.opacity = beamOn * 0.5;
        grip.scale.setScalar(tp.radius * 6);
      }
      lens.material.color.copy(accent).multiplyScalar(1.2 + beamOn * 3 + 0.3 * Math.sin(t * 3));
      tipGlow.material.opacity = 0.4 + beamOn * 0.6;
      tipGlow.scale.setScalar(3 + beamOn * 3);

      // target marker
      reticle.visible = !!tp && !done && tp.state !== 'orbit';
      if (reticle.visible) {
        reticle.position.copy(tp.pos);
        reticle.scale.setScalar(tp.radius * (3.6 + 0.25 * Math.sin(t * 4)));
        reticle.material.rotation = t * 0.6;
        reticle.material.opacity = pulling ? 0.35 : 0.9;
      }

      rim.position.copy(app.camera.position);
      sky.follow(app.camera);
      stars.update(app.camera, t, app.px);
    },
  };
}
