// The Sun Crusher: a ship the size of a fighter that can make a star explode.
// Hold to arm the torpedo. It fires itself when the charge is full.
import * as THREE from 'three';
import { makeSky, makeStars, makeGlow, softTexture } from '../core/sky.js';
import { makeStar } from '../core/bodies.js';
import { NOISE } from '../core/glsl.js';

export const meta = {
  id: 'suncrusher',
  name: 'The Sun Crusher',
  tag: 'A small ship that ends stars',
  blurb: 'No bigger than a fighter, and wrapped in armor nothing can scratch. It carries one terrible trick: a torpedo that makes a star blow itself apart.',
  since: 1994,
  accent: '#ff8a4a',
  hint: 'Hold to arm the torpedo, then watch from a safe distance. There is no safe distance.',
  bloom: { strength: 0.55, radius: 0.6, threshold: 0.78 },
  drone: 41.2,
};

const SUNS = [
  { name: 'A steady yellow sun', hot: '#ffe6a0', cool: '#ff7a1a', glow: '#ffb060', radius: 105, ejectA: '#ff5a2a', ejectB: '#7ab8ff',
    sky: { a: '#141040', b: '#3a1608', c: '#8a4a1a', density: 0.34, dust: 0.6, gain: 0.5, seed: 3.9 } },
  { name: 'A swollen red giant', hot: '#ffb070', cool: '#c8281a', glow: '#ff5a3a', radius: 150, ejectA: '#ff3a4a', ejectB: '#ffc070',
    sky: { a: '#3a0a12', b: '#1a0a30', c: '#a03a2a', density: 0.4, dust: 0.6, gain: 0.55, seed: 8.2 } },
  { name: 'A fierce blue giant', hot: '#f0f8ff', cool: '#4a8aff', glow: '#8ac0ff', radius: 88, ejectA: '#6aa0ff', ejectB: '#ff7ad0',
    sky: { a: '#0a1a50', b: '#101040', c: '#3a7ab0', density: 0.36, dust: 0.55, gain: 0.55, seed: 14.5 } },
];

const STAR_POS = new THREE.Vector3(-190, -30, -250);
const STAR_DIST = STAR_POS.length();
const STAR_DIR = STAR_POS.clone().normalize();
const DISH_Y = -1.72;

// ---------------------------------------------------------------- the ship
const ARMOR_VERT = /* glsl */ `
varying vec3 vWP;
void main(){
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWP = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;
// Mirror-dark armour with an oil-slick sheen. Facets come from screen-space derivatives.
const ARMOR_FRAG = /* glsl */ `
varying vec3 vWP;
uniform vec3 uStarDir, uStarColor;
uniform float uHit, uLight;
void main(){
  vec3 N = normalize(cross(dFdx(vWP), dFdy(vWP)));
  vec3 V = normalize(cameraPosition - vWP);
  if (dot(N, V) < 0.0) N = -N;
  vec3 R = reflect(-V, N);
  float sd = max(dot(N, uStarDir), 0.0);
  float sr = pow(max(dot(R, uStarDir), 0.0), 9.0);
  float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  vec3 irid = 0.5 + 0.5 * cos(6.2831 * (fres * 0.9 + dot(N, vec3(0.31, 0.47, 0.23)) * 0.8 + vec3(0.0, 0.33, 0.67)));
  vec3 fill = vec3(0.018, 0.03, 0.07) * (0.55 + 0.45 * N.y);
  vec3 col = vec3(0.012, 0.014, 0.022) + fill
    + uStarColor * (sd * 0.5 + sr * 2.2) * uLight
    + irid * (fres * 0.55 + 0.05)
    + vec3(1.0, 0.92, 0.8) * uHit * (0.5 + fres * 2.5);
  gl_FragColor = vec4(col, 1.0);
}
`;

function buildShip(accent) {
  const ship = new THREE.Group();
  const armor = new THREE.ShaderMaterial({
    vertexShader: ARMOR_VERT, fragmentShader: ARMOR_FRAG, side: THREE.DoubleSide,
    uniforms: {
      uStarDir: { value: STAR_DIR.clone() }, uStarColor: { value: new THREE.Color('#ffb060') },
      uHit: { value: 0 }, uLight: { value: 1 },
    },
  });

  // the hull: a tall four-sided shard, squeezed into a blade
  const profile = [[0, 2.95], [0.1, 2.2], [0.23, 1.1], [0.35, 0.1], [0.41, -0.6], [0.3, -1.1], [0.14, -1.45], [0, -1.5]]
    .map(([r, y]) => new THREE.Vector2(r, y));
  const hull = new THREE.Mesh(new THREE.LatheGeometry(profile, 4), armor);
  hull.scale.set(1, 1, 0.56);
  ship.add(hull);

  // swept fins
  const finShape = new THREE.Shape();
  finShape.moveTo(0.28, -0.05); finShape.lineTo(1.02, -1.5); finShape.lineTo(0.34, -0.98); finShape.closePath();
  const finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 0.06, bevelEnabled: false }).translate(0, 0, -0.03);
  for (const sx of [1, -1]) {
    const fin = new THREE.Mesh(finGeo, armor);
    fin.scale.x = sx;
    ship.add(fin);
  }

  // the resonance dish under the hull
  const hot = new THREE.MeshBasicMaterial({ color: new THREE.Color(accent).multiplyScalar(1.4) });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.37, 0.03, 8, 48), hot);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = DISH_Y;
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.34, 0.24, 24, 1, true), armor);
  bowl.position.y = DISH_Y + 0.13;
  const emitter = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12), hot);
  emitter.position.y = DISH_Y;
  ship.add(ring, bowl, emitter);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.42, 6), armor);
    strut.position.set(Math.cos(a) * 0.24, DISH_Y + 0.16, Math.sin(a) * 0.24);
    strut.rotation.set(Math.sin(a) * 0.55, 0, -Math.cos(a) * 0.55);
    ship.add(strut);
  }

  // a sliver of cockpit light
  const cockpit = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.42, 0.02), new THREE.MeshBasicMaterial({ color: new THREE.Color('#9fd8ff').multiplyScalar(1.6) }));
  cockpit.position.set(0, 1.35, 0.115);
  cockpit.rotation.x = -0.1;
  ship.add(cockpit);

  const dishGlow = makeGlow(accent, 1.6, 0.5);
  dishGlow.position.y = DISH_Y - 0.05;
  ship.add(dishGlow);

  return { ship, armor, hot, dishGlow };
}

// ---------------------------------------------------------------- the blast
const SHOCK_VERT = /* glsl */ `
varying vec3 vObj;
varying vec3 vN;
varying vec3 vV;
void main(){
  vObj = normalize(position);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}
`;
const SHOCK_FRAG = /* glsl */ `
varying vec3 vObj;
varying vec3 vN;
varying vec3 vV;
uniform vec3 uColA, uColB;
uniform float uFade, uT;
${NOISE}
void main(){
  float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
  float rim = f * f * f;
  float n = fbm3(vObj * 4.0 + uT * 0.15) * 0.5 + 0.5;
  vec3 col = mix(uColA, uColB, n) * (rim * 2.6 + 0.04) * (0.5 + n) * uFade;
  gl_FragColor = vec4(col, 1.0);
}
`;
const EJECTA_VERT = /* glsl */ `
attribute vec3 aDir;
attribute float aSpeed;
attribute float aSeed;
uniform float uT, uR, uPx;
uniform vec3 uColA, uColB;
varying vec3 vColor;
void main(){
  float k = 1.0 - exp(-uT * 0.42 * (0.55 + aSpeed));
  vec3 p = aDir * uR * aSpeed * k;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp((1.0 + aSeed * 2.5) * uPx * 420.0 / -mv.z, 1.0, 26.0);
  float life = smoothstep(0.0, 0.5, uT) * mix(1.0, 0.5, smoothstep(2.0, 12.0, uT));
  vColor = mix(uColA, uColB, smoothstep(0.3, 1.0, aSpeed)) * (0.2 + aSeed * 0.5) * life;
}
`;
const EJECTA_FRAG = /* glsl */ `
varying vec3 vColor;
void main(){
  float d = length(gl_PointCoord - 0.5);
  float a = 1.0 - smoothstep(0.0, 0.5, d);
  gl_FragColor = vec4(vColor * a * a, 1.0);
}
`;

function buildEjecta(count) {
  const dir = new Float32Array(count * 3), speed = new Float32Array(count), seed = new Float32Array(count);
  const knots = Array.from({ length: 260 }, () => ({ d: new THREE.Vector3().randomDirection(), s: 0.3 + Math.pow(Math.random(), 0.6) * 0.7 }));
  const v = new THREE.Vector3(), j = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    const k = knots[i % knots.length];
    v.copy(k.d).addScaledVector(j.randomDirection(), Math.random() * 0.2).normalize();
    dir.set([v.x, v.y, v.z], i * 3);
    speed[i] = Math.min(1, k.s * (0.82 + Math.random() * 0.36));
    seed[i] = Math.random();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  geo.setAttribute('aDir', new THREE.BufferAttribute(dir, 3));
  geo.setAttribute('aSpeed', new THREE.BufferAttribute(speed, 1));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const mat = new THREE.ShaderMaterial({
    vertexShader: EJECTA_VERT, fragmentShader: EJECTA_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uT: { value: 0 }, uR: { value: 290 }, uPx: { value: 1 }, uColA: { value: new THREE.Color() }, uColB: { value: new THREE.Color() } },
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  return points;
}

// ---------------------------------------------------------------- scene
export function create(app) {
  const scene = new THREE.Scene();
  let sunIndex = 0;
  const sky = makeSky(app.renderer, SUNS[0].sky);
  const stars = makeStars(4200);
  scene.add(sky.mesh, stars.points);

  const star = makeStar({ radius: SUNS[0].radius, boost: 1.0, corona: 1.4, flare: 0, haloGain: 0.9 });
  star.group.position.copy(STAR_POS);
  scene.add(star.group);

  const { ship, armor, hot, dishGlow } = buildShip(meta.accent);
  scene.add(ship);
  const accent = new THREE.Color(meta.accent);

  const torpedo = makeGlow('#fff0d8', 1.4, 0);
  const tracer = new THREE.Mesh(
    new THREE.CylinderGeometry(1, 1, 1, 8, 1, true).rotateX(Math.PI / 2).translate(0, 0, 0.5),
    new THREE.MeshBasicMaterial({ color: accent.clone().multiplyScalar(1.5), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  tracer.frustumCulled = false;
  scene.add(torpedo, tracer);

  const shock = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 40), new THREE.ShaderMaterial({
    vertexShader: SHOCK_VERT, fragmentShader: SHOCK_FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: { uColA: { value: new THREE.Color() }, uColB: { value: new THREE.Color('#ffffff') }, uFade: { value: 0 }, uT: { value: 0 } },
  }));
  shock.position.copy(STAR_POS);
  shock.visible = false;
  shock.frustumCulled = false;
  scene.add(shock);

  const ejecta = buildEjecta(app.coarse ? 5000 : 10000);
  ejecta.position.copy(STAR_POS);
  ejecta.visible = false;
  scene.add(ejecta);

  // what is left afterwards: a tiny fierce core inside a glowing cloud
  const core = new THREE.Group();
  const coreGlow = makeGlow('#dff0ff', 34, 0.9);
  const haze = new THREE.Sprite(new THREE.SpriteMaterial({
    map: softTexture(), color: '#ff5a2a', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  haze.scale.setScalar(620);
  core.add(haze, coreGlow);
  core.position.copy(STAR_POS);
  core.visible = false;
  scene.add(core);

  // ---- state
  let phase = 'idle', pt = 0, charge = 0, holding = false, crushed = 0, hit = 0, shocked = false, novaT = 0;
  const dishWorld = new THREE.Vector3(), v = new THREE.Vector3();
  const pad = (n) => String(n).padStart(2, '0');
  const showReadout = () => app.readout(`Stars crushed ${pad(crushed)} · ${phase === 'after' ? 'Nothing left but a spark' : SUNS[sunIndex].name}`);

  function applySun(i) {
    const s = SUNS[i];
    sky.paint(s.sky);
    star.setColors(s.hot, s.cool, s.glow);
    star.group.scale.setScalar(s.radius);
    star.group.visible = true;
    star.material.uniforms.uUnrest.value = 0;
    star.halo.material.uniforms.uGain.value = 0.9;
    armor.uniforms.uStarColor.value.set(s.glow);
    armor.uniforms.uLight.value = 1;
    shock.material.uniforms.uColA.value.set(s.ejectA);
    ejecta.material.uniforms.uColA.value.set(s.ejectA);
    ejecta.material.uniforms.uColB.value.set(s.ejectB);
    haze.material.color.set(s.ejectA);
    shock.visible = ejecta.visible = core.visible = false;
  }
  applySun(0);

  // swing the camera so the star sits behind the ship
  function aimRig(snap) {
    const portrait = app.camera.aspect < 0.8;
    const side = portrait ? 0.05 : 0.44, lift = portrait ? 0.27 : 0.06;
    let theta = Math.atan2(-STAR_DIR.x, -STAR_DIR.z) + side;
    const phi = THREE.MathUtils.clamp(Math.acos(-STAR_DIR.y) + lift, 0.4, Math.PI - 0.4);
    if (!snap) {
      const turns = Math.round((app.rig.goalTheta - theta) / (Math.PI * 2));
      theta += turns * Math.PI * 2;
    }
    app.rig.set({ theta, phi, snap });
    if (!snap) app.rig.idle = -6;      // hold this view for a while before drifting again
  }

  function fire() {
    phase = 'torpedo'; pt = 0; holding = false;
    app.sound.stopCharge();
    app.action('fire', { disabled: true, verb: 'Torpedo away', how: 'Watch the star' });
    app.sound.tone({ freq: 520, to: 90, dur: 1.2, gain: 0.2, type: 'sawtooth' });
    app.sound.noise({ dur: 0.5, gain: 0.3, from: 3000, to: 400 });
    app.shake(0.6);
    aimRig(false);
  }

  function nova() {
    phase = 'nova'; pt = 0; novaT = 0; shocked = false;
    crushed++;
    app.flash(1, 2.0, '#fff4e2');
    app.sound.boom(1);
    app.shake(1.6);
    star.group.visible = false;
    shock.visible = ejecta.visible = core.visible = true;
    armor.uniforms.uLight.value = 0.25;
    showReadout();
  }

  const actions = [{
    id: 'fire', verb: 'Arm the torpedo', how: 'Hold until it fires', kind: 'hold', key: ' ',
    down() {
      if (phase === 'after') {
        const next = (sunIndex + 1) % SUNS.length;
        app.travel(async (step) => {
          if (step === 'arrive') {
            sunIndex = next; applySun(next);
            phase = 'idle'; charge = 0;
            aimRig(true);
            app.action('fire', { verb: 'Arm the torpedo', how: 'Hold until it fires' });
            showReadout();
            app.toast(SUNS[next].name, 2.6);
          }
        }, { hold: 0.35, color: '#ffd9b8' });
        return;
      }
      if (phase !== 'idle') return;
      holding = true;
      app.sound.startCharge(48);
    },
    up() {
      if (!holding) return;
      holding = false;
      app.sound.stopCharge();
      if (phase === 'idle' && charge > 0.08) app.toast('Keep holding. The torpedo fires when the charge is full.', 2.4);
    },
  }];

  return {
    scene, actions,
    enter() {
      app.rig.set({
        target: new THREE.Vector3(0, 0.45, 0), radius: 9.5, snap: true,
        auto: app.reduced ? 0 : 0.035, minPhi: 0.3, maxPhi: Math.PI - 0.3, minRadius: 4.5, maxRadius: 24, damping: 3.5,
      });
      aimRig(true);
      showReadout();
      if (phase === 'after') app.action('fire', { verb: 'Find another star', how: 'Tap to jump' });
    },
    leave() { app.sound.stopCharge(); holding = false; app.bloomKick = 0; },
    update(dt, t) {
      pt += dt;
      const su = star.material.uniforms;

      // ---- ship: a slow turn so the facets catch the light
      ship.rotation.y = t * 0.12;
      ship.position.y = Math.sin(t * 0.6) * 0.08;
      ship.rotation.z = Math.sin(t * 0.4) * 0.03;
      hit = Math.max(0, hit - dt * 0.7);
      armor.uniforms.uHit.value = hit;

      // ---- arming
      if (phase === 'idle') {
        charge = holding ? Math.min(1, charge + dt / 1.9) : Math.max(0, charge - dt * 1.2);
        if (holding) { app.sound.setCharge(charge); app.shake(charge * 0.1); }
        app.meter('fire', charge, charge > 0.85);
        if (charge >= 1) fire();
      }
      hot.color.copy(accent).multiplyScalar(1.2 + charge * 4 + 0.25 * Math.sin(t * 5));
      dishGlow.material.opacity = 0.35 + charge * 0.65;
      dishGlow.scale.setScalar(1.4 + charge * 2.4);

      // ---- the torpedo's flight
      if (phase === 'torpedo') {
        const k = Math.min(1, pt / 2.7);
        dishWorld.set(0, DISH_Y, 0).applyMatrix4(ship.matrixWorld);
        torpedo.position.lerpVectors(dishWorld, STAR_POS, app.easeIn(k) * 0.97);
        torpedo.material.opacity = 1;
        torpedo.scale.setScalar(1.4 + k * 14);
        const d = dishWorld.distanceTo(torpedo.position);
        tracer.position.copy(dishWorld);
        tracer.lookAt(torpedo.position);
        tracer.scale.set(0.05 + k * 0.5, 0.05 + k * 0.5, Math.max(0.01, d));
        tracer.material.opacity = 0.5 * (1 - k);
        charge = Math.max(0, charge - dt * 0.8);
        app.meter('fire', 0);
        if (k >= 1) {
          phase = 'shudder'; pt = 0;
          torpedo.material.opacity = 0; tracer.material.opacity = 0;
          app.flash(0.25, 0.6, '#fff0d0');
          app.sound.noise({ dur: 2.6, gain: 0.3, from: 60, to: 420, type: 'lowpass', q: 0.4, attack: 1.6 });
          app.sound.tone({ freq: 36, to: 110, dur: 2.6, gain: 0.3, attack: 1.4 });
        }
      } else if (phase === 'shudder') {
        // the star knows something is wrong
        const k = Math.min(1, pt / 2.0);
        su.uUnrest.value = k * 0.7;
        const s = SUNS[sunIndex].radius * (1 + 0.04 * Math.sin(pt * (8 + k * 30)) * k + 0.05 * k);
        star.group.scale.setScalar(s);
        star.halo.material.uniforms.uGain.value = 0.9 + k * 2.2;
        app.bloomKick = k * 0.5;
        app.shake(k * 0.35);
        if (k >= 1) { phase = 'collapse'; pt = 0; }
      } else if (phase === 'collapse') {
        const k = Math.min(1, pt / 0.75);
        su.uUnrest.value = 0.7 + 0.3 * k;
        star.group.scale.setScalar(SUNS[sunIndex].radius * (1.05 - 0.8 * app.easeIn(k)));
        app.bloomKick = 0.5 + k * 0.6;
        if (k >= 1) nova();
      }

      // ---- the blast and what it leaves
      if (phase === 'nova' || phase === 'after') {
        novaT += dt;
        const R = 30 + 760 * (1 - Math.exp(-novaT / 3.3));
        shock.scale.setScalar(R);
        const fade = Math.exp(-novaT / 3.2);
        shock.material.uniforms.uFade.value = fade * 1.6;
        shock.material.uniforms.uT.value = novaT;
        shock.visible = fade > 0.01;
        ejecta.material.uniforms.uT.value = novaT;
        ejecta.material.uniforms.uPx.value = app.px;
        app.bloomKick = 1.1 * Math.exp(-novaT / 1.4);
        coreGlow.material.opacity = 0.75 + 0.25 * Math.sin(t * 14);
        coreGlow.scale.setScalar(26 + 8 * Math.sin(t * 14) + 60 * Math.exp(-novaT / 0.8));
        haze.material.opacity = 0.3 * Math.min(1, novaT / 5);
        if (!shocked && R > STAR_DIST) {
          // the shock front reaches the ship
          shocked = true; hit = 1;
          app.flash(0.75, 1.4, '#fff0dc');
          app.shake(2.6);
          app.sound.boom(0.7);
          app.toast('The blast rolls over the ship. Not a scratch.', 4);
        }
        if (phase === 'nova' && novaT > 5.5) {
          phase = 'after';
          app.action('fire', { disabled: false, verb: 'Find another star', how: 'Tap to jump' });
          showReadout();
        }
      } else {
        star.tick(t);
      }

      sky.follow(app.camera);
      stars.update(app.camera, t, app.px);
    },
  };
}
