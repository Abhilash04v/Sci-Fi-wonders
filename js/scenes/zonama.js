// Zonama Sekot: a planet that is alive, and can leave.
// Hold to wake the world-engines, let go to jump to another sky. Tap the planet and it answers.
import * as THREE from 'three';
import { makeSky, makeStars, makeSun } from '../core/sky.js';
import { makePlanet } from '../core/bodies.js';

export const meta = {
  id: 'zonama',
  name: 'Zonama Sekot',
  tag: 'The living planet',
  blurb: 'A whole world that is awake. It thinks, it listens, and when trouble comes it fires up engines the size of mountains and leaves for another star.',
  since: 2000,
  accent: '#5ff0c8',
  hint: 'Hold to wake the world-engines, then let go to jump. Tap the planet and it answers.',
  bloom: { strength: 0.7, radius: 0.65, threshold: 0.6 },
  drone: 65.4,
};

const SKIES = [
  { name: 'A quiet green dawn', a: '#0a3a35', b: '#12305a', c: '#b98a3a', density: 0.42, dust: 0.55, gain: 0.6, seed: 2.1, sun: '#fff0d8', sunDir: [0.9, 0.25, 0.5], sunSize: 230 },
  { name: 'The Amber Twins', a: '#5a2a08', b: '#3a0f1e', c: '#c7862a', density: 0.5, dust: 0.6, gain: 0.7, seed: 7.7, sun: '#ffc27a', sunDir: [-0.8, 0.2, 0.55], sunSize: 200, twin: '#ff7a4a' },
  { name: 'Under a blue giant', a: '#0a2a6a', b: '#103a7a', c: '#7ac0ff', density: 0.45, dust: 0.5, gain: 0.75, seed: 11.3, sun: '#bcd8ff', sunDir: [0.5, 0.5, -0.7], sunSize: 430 },
  { name: 'The Rose Nursery', a: '#6a1040', b: '#2a1260', c: '#ff8ab0', density: 0.62, dust: 0.65, gain: 0.85, seed: 15.9, sun: '#ffe6f0', sunDir: [-0.6, 0.35, -0.7], sunSize: 200 },
  { name: 'A ringside seat', a: '#10203a', b: '#1a1a40', c: '#5a80a0', density: 0.3, dust: 0.4, gain: 0.5, seed: 21.4, sun: '#fff4e0', sunDir: [0.85, 0.2, 0.5], sunSize: 220, giant: true },
  { name: 'The edge of the galaxy', a: '#0a0a24', b: '#141038', c: '#b8a8ff', density: 0.22, dust: 0.3, gain: 0.5, seed: 30.2, band: 1.0, focus: [0.35, 1, 0.25], sun: '#ffffff', sunDir: [-0.7, -0.1, 0.7], sunSize: 150 },
];

const SPORE_VERT = /* glsl */ `
attribute vec4 aOrbit;     // radius, tilt, node, phase
attribute float aSpeed;
attribute float aSize;
uniform float uTime, uPx, uScatter, uCharge;
varying float vGlow;
void main(){
  float ang = aOrbit.w + uTime * aSpeed * (1.0 + uCharge * 3.0);
  vec3 p = vec3(cos(ang), 0.0, sin(ang)) * aOrbit.x;
  float ci = cos(aOrbit.y), si = sin(aOrbit.y);
  p = vec3(p.x, p.y * ci - p.z * si, p.y * si + p.z * ci);
  float cn = cos(aOrbit.z), sn = sin(aOrbit.z);
  p = vec3(p.x * cn + p.z * sn, p.y, -p.x * sn + p.z * cn);
  p *= 1.0 + uScatter * (0.25 + 0.75 * fract(aOrbit.w * 7.31));
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize * uPx * 14.0 / -mv.z;
  vGlow = 0.55 + 0.45 * sin(uTime * 2.0 + aOrbit.w * 20.0) + uCharge;
}
`;
const SPORE_FRAG = /* glsl */ `
uniform vec3 uColor;
varying float vGlow;
void main(){
  float d = length(gl_PointCoord - 0.5);
  float a = 1.0 - smoothstep(0.0, 0.5, d);
  gl_FragColor = vec4(uColor * a * a * vGlow, 1.0);
}
`;

const RING_VERT = /* glsl */ `
varying float vR;
varying vec3 vWP;
void main(){
  vR = length(position.xy);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWP = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;
const RING_FRAG = /* glsl */ `
varying float vR;
varying vec3 vWP;
uniform vec3 uColor;
void main(){
  float n = 0.5 + 0.25 * sin(vR * 37.0) + 0.15 * sin(vR * 91.0 + 1.3) + 0.1 * sin(vR * 173.0 + 4.0);
  float a = smoothstep(1.35, 1.42, vR) * (1.0 - smoothstep(2.2, 2.3, vR));
  float gap = smoothstep(0.0, 0.03, abs(vR - 1.86));
  gl_FragColor = vec4(uColor * (0.35 + 0.65 * n), a * gap * (0.25 + 0.6 * n));
}
`;

export function create(app) {
  const scene = new THREE.Scene();
  const sky = makeSky(app.renderer, SKIES[0]);
  const stars = makeStars(4200);
  const sun = makeSun(SKIES[0].sun, SKIES[0].sunSize);
  const twin = makeSun('#ff7a4a', 120);
  const twinOffset = new THREE.Vector3(0.16, 0.07, 0.05);
  scene.add(sky.mesh, stars.points, sun.group, twin.group);

  // the planet
  const zs = makePlanet({
    ocean: '#04263a', shallow: '#0e6a6a', landA: '#1c5a2c', landB: '#a8452a', landC: '#d9b04a',
    cloud: '#fff4e0', atmo: '#6ff0d0', veinColor: '#7affd8',
    seed: 3.3, sea: -0.08, cloudAmt: 0.72, veins: 1.0, scale: 1.45, haloGain: 0.95,
  }, 128);
  const tilt = new THREE.Group();
  tilt.rotation.z = 0.32;
  tilt.add(zs.group);
  scene.add(tilt);

  // the world-engine field: three bright hoops that spin up as the planet charges
  const hoopMat = () => new THREE.MeshBasicMaterial({
    color: new THREE.Color('#7affd8').multiplyScalar(2.2), transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const hoops = [0, 1, 2].map((i) => {
    const pivot = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.TorusGeometry(1.5 + i * 0.16, 0.007, 6, 180), hoopMat());
    pivot.add(mesh);
    pivot.userData.rest = new THREE.Euler(0.5 + i * 0.9, i * 1.3, i * 0.7);
    pivot.rotation.copy(pivot.userData.rest);
    scene.add(pivot);
    return { pivot, mesh };
  });

  // spores: the planet's swarm of living lights
  const N = 320;
  const orbit = new Float32Array(N * 4), speed = new Float32Array(N), size = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    orbit.set([1.12 + Math.pow(Math.random(), 2) * 0.55, (Math.random() - 0.5) * 1.6, Math.random() * 6.283, Math.random() * 6.283], i * 4);
    speed[i] = (0.08 + Math.random() * 0.22) * (Math.random() < 0.5 ? 1 : -1);
    size[i] = 0.6 + Math.random() * 1.6;
  }
  const sporeGeo = new THREE.BufferGeometry();
  sporeGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  sporeGeo.setAttribute('aOrbit', new THREE.BufferAttribute(orbit, 4));
  sporeGeo.setAttribute('aSpeed', new THREE.BufferAttribute(speed, 1));
  sporeGeo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  const sporeMat = new THREE.ShaderMaterial({
    vertexShader: SPORE_VERT, fragmentShader: SPORE_FRAG, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uPx: { value: app.px }, uScatter: { value: 0 }, uCharge: { value: 0 }, uColor: { value: new THREE.Color('#b8ffe6') } },
  });
  const spores = new THREE.Points(sporeGeo, sporeMat);
  spores.frustumCulled = false;
  tilt.add(spores);

  // a ringed neighbour that shows up in one of the skies
  const giant = makePlanet({
    landA: '#c9a26a', landB: '#8a5a3a', landC: '#f0e0c0', sea: -5, cloudAmt: 0, bands: 1, atmo: '#ffd9a0', seed: 8.8, scale: 1.2, haloGain: 0.5,
  }, 64);
  const giantRing = new THREE.Mesh(
    new THREE.RingGeometry(1.35, 2.3, 128, 1),
    new THREE.ShaderMaterial({
      vertexShader: RING_VERT, fragmentShader: RING_FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { uColor: { value: new THREE.Color('#e6d2aa') } },
    }),
  );
  giantRing.rotation.x = -Math.PI / 2;
  const giantGroup = new THREE.Group();
  giantGroup.add(giant.group, giantRing);
  giantGroup.position.set(-70, 14, -105);
  giantGroup.scale.setScalar(27);
  giantGroup.rotation.set(0.35, 0, 0.3);
  giantGroup.visible = false;
  scene.add(giantGroup);

  // ---- state
  let state = 'idle', charge = 0, shown = 0, visits = 1, skyIndex = 0, pulseSlot = 0, scatter = 0, inTunnel = false;
  const lightDir = new THREE.Vector3(), sunTint = new THREE.Color(), white = new THREE.Color(1, 1, 1);

  function applySky(s) {
    sky.paint(s);
    sun.dir.set(...s.sunDir).normalize();
    sun.setColor(s.sun);
    sun.core.scale.setScalar(s.sunSize); sun.halo.scale.setScalar(s.sunSize * 3.2);
    twin.group.visible = !!s.twin;
    if (s.twin) { twin.setColor(s.twin); twin.dir.copy(sun.dir).add(twinOffset).normalize(); }
    giantGroup.visible = !!s.giant;
    lightDir.copy(sun.dir);
    sunTint.set(s.sun).lerp(white, 0.45);
    zs.setLight(lightDir, sunTint);
    giant.setLight(lightDir, sunTint);
  }
  applySky(SKIES[0]);

  const pad = (n) => String(n).padStart(2, '0');
  const showReadout = () => app.readout(`Skies visited ${pad(visits)} · ${SKIES[skyIndex].name}`);

  async function jump() {
    state = 'jumping';
    app.action('jump', { disabled: true });
    const next = (skyIndex + 1) % SKIES.length;
    await app.travel(async (phase) => {
      if (phase === 'depart') {
        inTunnel = true;
        sky.mesh.visible = stars.points.visible = sun.group.visible = false;
        twin.group.visible = giantGroup.visible = false;
        app.sound.tone({ freq: 220, to: 660, dur: 1.4, gain: 0.08, type: 'triangle' });
      } else {
        inTunnel = false;
        skyIndex = next;
        sky.mesh.visible = stars.points.visible = sun.group.visible = true;
        applySky(SKIES[skyIndex]);
      }
    }, { hold: 1.3, color: '#bff5e6' });
    visits++;
    state = 'idle';
    app.action('jump', { disabled: false });
    showReadout();
    app.toast(SKIES[skyIndex].name);
    app.sound.chime(2, 196, 0.14); app.sound.chime(4, 196, 0.1, 0.18); app.sound.chime(7, 196, 0.08, 0.36);
  }

  const actions = [{
    id: 'jump', verb: 'Wake the engines', how: 'Hold, then let go', kind: 'hold', key: ' ',
    down() {
      if (state !== 'idle') return;
      state = 'charging';
      app.sound.startCharge(55);
    },
    up() {
      if (state !== 'charging') return;
      app.sound.stopCharge();
      if (charge >= 0.45) jump();
      else { state = 'idle'; app.toast('Hold a little longer. A planet takes a moment to wake.', 2.6); }
    },
  }];

  const tmp = new THREE.Vector3();
  return {
    scene, actions,
    enter() {
      app.rig.set({
        target: new THREE.Vector3(0, 0, 0), theta: -0.25, phi: 1.3, radius: 4.3, snap: true,
        auto: app.reduced ? 0 : 0.05, minPhi: 0.3, maxPhi: Math.PI - 0.3, minRadius: 2.3, maxRadius: 9, damping: 5,
      });
      showReadout();
    },
    leave() {
      app.sound.stopCharge();
      if (state === 'charging') state = 'idle';
      app.bloomKick = 0;
    },
    onTap(ndc) {
      const hit = app.pick(ndc, [zs.body])[0];
      if (!hit) return;
      tmp.copy(hit.point);
      zs.body.worldToLocal(tmp).normalize();
      const u = zs.material.uniforms;
      u.uPulse.value[pulseSlot].set(tmp.x, tmp.y, tmp.z, u.uTime.value);
      pulseSlot = (pulseSlot + 1) % 4;
      scatter = Math.min(1, scatter + 0.6);
      const n = Math.round((tmp.y * 0.5 + 0.5) * 8);
      app.sound.chime(n, 196, 0.16);
      app.sound.chime(n + 2, 196, 0.07, 0.22);
    },
    async demo(cue) {
      cue.say('A planet that is alive. Watch it answer.', 3.2);
      if (!(await cue.wait(1.5))) return;
      this.onTap(new THREE.Vector2(0.02, 0.05));
      if (!(await cue.wait(1.4))) return;
      this.onTap(new THREE.Vector2(-0.1, 0.14));
      if (!(await cue.wait(1.6))) return;
      await cue.hold('jump', 3.2, () => charge >= 1);
      await cue.until(() => state === 'idle', 14);
      await cue.wait(3);
    },

    update(dt, t) {
      if (state === 'charging') {
        charge = Math.min(1, charge + dt / 2.3);
        app.sound.setCharge(charge);
        app.meter('jump', charge, charge >= 0.45);
        app.shake(charge * 0.12);
      } else if (state === 'idle') {
        charge = Math.max(0, charge - dt * 0.9);
        app.meter('jump', charge, false);
      }
      shown += (charge - shown) * (1 - Math.exp(-dt * 6));
      scatter *= Math.exp(-dt * 1.4);

      zs.body.rotation.y += dt * 0.035;
      zs.tick(t);
      zs.material.uniforms.uCharge.value = shown;
      zs.halo.material.uniforms.uGain.value = 0.95 + shown * 0.9;
      sporeMat.uniforms.uTime.value = t;
      sporeMat.uniforms.uScatter.value = scatter * 0.5 + shown * 0.25;
      sporeMat.uniforms.uCharge.value = shown;
      app.bloomKick = shown * 0.3;

      const glow = Math.min(1, shown * 1.6);
      hoops.forEach(({ pivot, mesh }, i) => {
        mesh.material.opacity = glow * (0.55 + 0.45 * Math.sin(t * 9 + i * 2));
        const spin = dt * (0.2 + shown * shown * 7) * (i % 2 ? -1 : 1);
        if (state === 'jumping') {
          // the hoops snap into one plane just before the jump
          pivot.rotation.x += (Math.PI / 2 - pivot.rotation.x) * (1 - Math.exp(-dt * 5));
          pivot.rotation.y += (0 - pivot.rotation.y) * (1 - Math.exp(-dt * 5));
          mesh.rotation.z += spin;
        } else {
          pivot.rotation.x += spin * 0.6; pivot.rotation.y += spin * 0.45;
        }
      });

      if (inTunnel) {
        // inside hyperspace the only light is the tunnel itself
        lightDir.copy(app.camera.position).normalize();
        zs.setLight(lightDir, '#a8d8ff');
      }
      giant.body.rotation.y += dt * 0.01;
      giant.tick(t);

      sky.follow(app.camera);
      stars.update(app.camera, t, app.px);
      sun.follow(app.camera);
      twin.follow(app.camera);
    },
  };
}
