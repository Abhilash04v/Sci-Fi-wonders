// The galaxy map: a spiral of stars with one beacon per wonder.
import * as THREE from 'three';
import { makeSky, makeStars, makeGlow, softTexture } from '../core/sky.js';

export const meta = {
  id: 'map',
  name: 'Galaxy map',
  accent: '#f2b84b',
  hint: 'Pick a wonder to visit. Drag to turn the galaxy.',
  bloom: { strength: 0.85, radius: 0.75, threshold: 0.5 },
  drone: 55,
};

const VERT = /* glsl */ `
attribute float aSize;
attribute float aPhase;
attribute vec3 aColor;
uniform float uTime, uPx, uScale;
varying vec3 vColor;
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = max(1.0, aSize * uPx * uScale / -mv.z);
  vColor = aColor * (0.8 + 0.2 * sin(uTime * (0.5 + aPhase) + aPhase * 30.0));
}
`;
const FRAG = /* glsl */ `
varying vec3 vColor;
void main(){
  float d = length(gl_PointCoord - 0.5);
  float a = 1.0 - smoothstep(0.0, 0.5, d);
  gl_FragColor = vec4(vColor * a * a, 1.0);
}
`;

const gauss = () => {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

function buildGalaxy() {
  const R = 50, pts = [];
  const push = (x, y, z, r, g, b, size) => pts.push(x, y, z, r, g, b, size, Math.random());
  // spiral arms: two bold, two faint
  for (let i = 0; i < 44000; i++) {
    const pickArm = Math.random();
    const arm = pickArm < 0.36 ? 0 : pickArm < 0.72 ? 2 : pickArm < 0.86 ? 1 : 3;
    const r = 4 + Math.pow(Math.random(), 0.8) * (R - 4);
    const theta = arm * Math.PI / 2 + 3.5 * Math.log(1 + r / 5) + gauss() * 0.17 * (1.15 - (0.6 * r) / R);
    const rr = r + gauss() * 1.1;
    const y = gauss() * (0.25 + 1.3 * Math.exp(-r / 8));
    const k = Math.random();
    let c;
    if (k < 0.045) c = [1.0, 0.32, 0.55];                 // glowing gas
    else if (k < 0.5) c = [0.55, 0.72, 1.0];              // young blue stars
    else c = [0.95, 0.93, 1.0];
    const warm = Math.exp(-r / 14);
    const b = (0.18 + Math.pow(Math.random(), 2.5) * 0.6) * (0.6 + 0.6 * warm);
    push(Math.cos(theta) * rr, y, Math.sin(theta) * rr,
      (c[0] + warm * 0.4) * b, (c[1] + warm * 0.1) * b, c[2] * b * (1 - warm * 0.3),
      k < 0.045 ? 2.8 : 0.9 + Math.random() * 1.4);
  }
  // central bulge
  for (let i = 0; i < 7000; i++) {
    const r = Math.abs(gauss()) * 4.2, t = Math.random() * Math.PI * 2, u = Math.random() * 2 - 1, s = Math.sqrt(1 - u * u);
    const b = 0.1 + Math.random() * 0.22;
    push(Math.cos(t) * s * r, u * r * 0.55, Math.sin(t) * s * r, 1.0 * b, 0.8 * b, 0.5 * b, 0.9 + Math.random() * 1.3);
  }
  // faint disc haze between the arms
  for (let i = 0; i < 9000; i++) {
    const r = -Math.log(1 - Math.random() * 0.97) * 14, t = Math.random() * Math.PI * 2;
    if (r > R * 1.1) continue;
    const b = 0.05 + Math.random() * 0.08;
    push(Math.cos(t) * r, gauss() * 0.5, Math.sin(t) * r, 0.8 * b, 0.82 * b, 1.0 * b, 0.7 + Math.random());
  }
  const n = pts.length / 8;
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), size = new Float32Array(n), phase = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    pos.set(pts.slice(i * 8, i * 8 + 3), i * 3);
    col.set(pts.slice(i * 8 + 3, i * 8 + 6), i * 3);
    size[i] = pts[i * 8 + 6]; phase[i] = pts[i * 8 + 7];
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, depthTest: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uPx: { value: 1 }, uScale: { value: 150 } },
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  return points;
}

// Where each wonder sits on the map (radius, angle in degrees). Rough, for looks.
const SPOTS = {
  zonama: [36, 205], centerpoint: [17, 35], thonboka: [33, 300], suncrusher: [27, 118],
  cathedral: [43, 72], maw: [38, 345], alderaan: [9, 160], katana: [24, 252],
  deathstar: [21, 186], coruscant: [5, 320], cloudcity: [46, 158], holdo: [44, 272],
};

export function create(app) {
  const scene = new THREE.Scene();
  const sky = makeSky(app.renderer, { a: '#0b1338', b: '#220c33', c: '#0a2c3c', base: '#010207', density: 0.34, dust: 0.5, gain: 0.45, seed: 4.2 });
  const stars = makeStars(3200);
  const galaxy = buildGalaxy();
  galaxy.rotation.z = 0.06;
  const core = makeGlow('#ffd9a0', 26, 0.8);
  core.material.depthTest = false;
  // a soft sheet of light under the stars, so the disc has some body
  const haze = new THREE.Mesh(
    new THREE.CircleGeometry(58, 64),
    new THREE.MeshBasicMaterial({ map: softTexture(), color: '#5a78d8', transparent: true, opacity: 0.5, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
  );
  haze.rotation.x = -Math.PI / 2;
  scene.add(sky.mesh, stars.points, haze, galaxy, core);

  // beacons and their labels
  const beacons = app.wonders.map((w) => {
    const [r, deg] = SPOTS[w.id] ?? [20, 0];
    const a = (deg * Math.PI) / 180;
    const pos = new THREE.Vector3(Math.cos(a) * r, 3.2, Math.sin(a) * r);
    const glow = makeGlow(w.accent, 9, 0.9);
    glow.material.depthTest = false;
    glow.position.copy(pos);
    const stem = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([pos, new THREE.Vector3(pos.x, 0, pos.z)]),
      new THREE.LineBasicMaterial({ color: w.accent, transparent: true, opacity: 0.5, depthTest: false, blending: THREE.AdditiveBlending }),
    );
    scene.add(glow, stem);

    const el = document.createElement('button');
    el.type = 'button'; el.className = 'beacon';
    el.style.setProperty('--c', w.accent);
    const name = document.createElement('span'); name.className = 'b-name'; name.textContent = w.name;
    if (w.isNew) { const pill = document.createElement('span'); pill.className = 'b-new'; pill.textContent = 'New'; name.append(pill); }
    const tag = document.createElement('span'); tag.className = 'b-tag'; tag.textContent = (w.legend ? 'Legend \u00b7 ' : 'Unseen \u00b7 ') + w.tag;
    el.append(name, tag);
    el.addEventListener('click', () => app.go(w.id));
    app.dom.beacons.append(el);
    return { id: w.id, pos, glow, el, x: 0, y: 0, w: 0, h: 0 };
  });

  // on a tall screen, stand the galaxy on its end so it fills the height
  function frameShot(snap) {
    const portrait = app.camera.aspect < 0.8;
    app.rig.roll = portrait ? Math.PI / 2 : 0;
    app.rig.fit = portrait ? 1.2 : Math.max(1, 1.45 / app.camera.aspect);
    if (snap) app.rig.set({ phi: portrait ? 1.15 : 0.98, snap: true });
    for (const b of beacons) b.w = 0;
  }

  const v = new THREE.Vector3(), intro = document.getElementById('intro');
  let frames = 0;
  function placeLabels() {
    frames++;
    const W = app.width, H = app.height, pad = 16;
    const centre = (v.set(0, 0, 0).project(app.camera).x * 0.5 + 0.5) * W;
    for (const b of beacons) {
      v.copy(b.pos).project(app.camera);
      b.sx = (v.x * 0.5 + 0.5) * W; b.sy = (-v.y * 0.5 + 0.5) * H;
      if (!b.w || frames % 90 === 0 || (frames < 300 && frames % 15 === 0)) { b.w = b.el.offsetWidth; b.h = b.el.offsetHeight; }
      // on a wide screen labels fan outward from the galaxy; on a narrow one they keep to whichever side has room
      const left = W > 700 ? b.sx < centre : b.sx > W * 0.6;
      b.x = left ? b.sx - b.w - 16 : b.sx + 16;
      b.y = b.sy - b.h / 2;
      b.x = Math.min(W - b.w - pad, Math.max(pad, b.x));
    }
    // keep labels off the title block
    const ir = intro.getBoundingClientRect(), rr = app.renderer.domElement.getBoundingClientRect();
    let ceiling = pad;
    if (ir.width) {
      const right = ir.right - rr.left + 10, bottom = ir.bottom - rr.top + 10;
      for (const b of beacons) if (b.x < right && b.y < bottom) b.y = bottom;
      if (ir.right - rr.left > W * 0.7) ceiling = bottom;   // the title spans the screen on a phone
    }
    // nudge apart any labels that would sit on top of each other
    const order = [...beacons].sort((p, q) => p.y - q.y);
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 1; i < order.length; i++) {
        for (let j = 0; j < i; j++) {
          const p = order[j], q = order[i];
          const overlapX = p.x < q.x + q.w + 8 && q.x < p.x + p.w + 8;
          if (overlapX && q.y < p.y + p.h + 6) q.y = p.y + p.h + 6;
        }
      }
    }
    // if the stack runs off the bottom, slide the whole column up rather than piling labels on top of each other
    const lowest = Math.max(...beacons.map((b) => b.y + b.h)), limit = H - 64;
    const room = Math.min(...beacons.map((b) => b.y)) - ceiling;
    if (lowest > limit) { const lift = Math.min(lowest - limit, Math.max(0, room)); for (const b of beacons) b.y -= lift; }
    for (const b of beacons) b.el.style.transform = `translate(${b.x.toFixed(1)}px, ${b.y.toFixed(1)}px)`;
  }

  return {
    scene,
    actions: [],
    enter() {
      app.rig.set({
        target: new THREE.Vector3(0, 0, 0), theta: 0.5, phi: 0.98, radius: 92, snap: true,
        auto: app.reduced ? 0 : 0.022, minPhi: 0.35, maxPhi: 1.4, minRadius: 60, maxRadius: 170, damping: 4,
      });
      frameShot(true);
      app.dom.beacons.classList.remove('away');
    },
    leave() { app.dom.beacons.classList.add('away'); },
    resize() { frameShot(false); },
    onTap(ndc) {
      // tapping a beacon's light works as well as tapping its label
      const W = app.width, H = app.height;
      const x = (ndc.x * 0.5 + 0.5) * W, y = (-ndc.y * 0.5 + 0.5) * H;
      let best = null, bestD = 44;
      for (const b of beacons) { const d = Math.hypot(b.sx - x, b.sy - y); if (d < bestD) { best = b; bestD = d; } }
      if (best) app.go(best.id);
    },
    update(dt, t) {
      galaxy.rotation.y -= dt * 0.012;
      galaxy.material.uniforms.uTime.value = t;
      galaxy.material.uniforms.uPx.value = app.px;
      sky.follow(app.camera);
      stars.update(app.camera, t, app.px);
      for (let i = 0; i < beacons.length; i++) {
        const s = 8 + Math.sin(t * 2 + i * 1.7) * 1.6;
        beacons[i].glow.scale.setScalar(s);
      }
      placeLabels();
    },
  };
}
