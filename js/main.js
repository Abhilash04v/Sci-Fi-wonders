// Wonders Unseen: app shell. Owns the renderer, the camera, the HUD and the
// hyperspace hop between scenes. Each scene lives in js/scenes/.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { OrbitRig } from './core/rig.js';
import { Sound } from './core/audio.js';
import { makeWarp } from './core/warp.js';
import * as galaxy from './scenes/galaxy.js';
import * as zonama from './scenes/zonama.js';
import * as centerpoint from './scenes/centerpoint.js';
import * as thonboka from './scenes/thonboka.js';
import * as suncrusher from './scenes/suncrusher.js';

const WONDERS = [zonama, centerpoint, thonboka, suncrusher];
const SCENES = { map: galaxy };
for (const w of WONDERS) SCENES[w.meta.id] = w;

const $ = (id) => document.getElementById(id);
const root = $('app'), canvas = $('stage'), hud = $('hud'), flashEl = $('flash'), toastEl = $('toast');
const easeIn = (k) => k * k * k;
const easeOut = (k) => 1 - Math.pow(1 - k, 3);

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
} catch (err) {
  hud.hidden = true; $('beacons').hidden = true; $('fail').hidden = false;
  throw err;
}

const coarse = window.matchMedia('(pointer: coarse)').matches;
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const px = Math.min(window.devicePixelRatio || 1, coarse ? 1.75 : 2);
renderer.setPixelRatio(px);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.setClearColor(0x000000, 1);

const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 3000);
const rig = new OrbitRig(camera);
const warp = makeWarp();
const sound = new Sound();

const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(new THREE.Scene(), camera);
const warpPass = new RenderPass(warp.scene, camera);
warpPass.clear = false;
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.8, 0.6, 0.7);
composer.addPass(renderPass);
composer.addPass(warpPass);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ---------------------------------------------------------------- tweens
const tweens = new Set();
function tween(dur, fn) {
  return new Promise((resolve) => {
    const tw = { t: 0, dur: Math.max(0.0001, dur), fn, resolve };
    fn(0);
    tweens.add(tw);
  });
}
const wait = (sec) => tween(sec, () => {});
function runTweens(dt) {
  for (const tw of tweens) {
    tw.t += dt;
    const k = Math.min(1, tw.t / tw.dur);
    tw.fn(k);
    if (k >= 1) { tweens.delete(tw); tw.resolve(); }
  }
}

// ---------------------------------------------------------------- app API
const raycaster = new THREE.Raycaster();
const app = {
  renderer, camera, rig, warp, sound, bloom, px, coarse, reduced,
  time: 0,
  baseFov: 50,
  fovKick: 0,
  bloomBase: 0.8,
  bloomKick: 0,
  tween, wait, easeIn, easeOut,
  wonders: WONDERS.map((w) => w.meta),
  dom: { beacons: $('beacons') },

  go,
  travel,

  /** White-out. `amount` 0..1, then fades over `fade` seconds. */
  flash(amount = 1, fade = 0.8, color = '#ffffff') {
    const a = reduced ? Math.min(amount, 0.35) : amount;
    flashEl.style.transition = 'none';
    flashEl.style.background = color;
    flashEl.style.opacity = a;
    void flashEl.offsetWidth;
    flashEl.style.transition = `opacity ${fade}s ease-out`;
    flashEl.style.opacity = 0;
  },

  toast(text, sec = 3.2) {
    toastEl.textContent = text;
    toastEl.classList.add('show');
    clearTimeout(app._toastTimer);
    app._toastTimer = setTimeout(() => toastEl.classList.remove('show'), sec * 1000);
  },

  readout(text) { $('readout').textContent = text; },
  hint(text) { $('hint').textContent = text; },

  /** Fill level (0..1) of a hold button, and whether it is primed. */
  meter(id, value, ready = false) {
    const b = actionButtons.get(id); if (!b) return;
    b.style.setProperty('--p', Math.max(0, Math.min(1, value)).toFixed(3));
    b.classList.toggle('ready', ready);
  },

  /** Relabel or disable an action button on the fly. */
  action(id, { verb, how, disabled } = {}) {
    const b = actionButtons.get(id); if (!b) return;
    if (verb !== undefined) b.querySelector('.verb').textContent = verb;
    if (how !== undefined) b.querySelector('.how').textContent = how;
    if (disabled !== undefined) b.disabled = disabled;
  },

  pick(ndc, objects) {
    raycaster.setFromCamera(ndc, camera);
    return raycaster.intersectObjects(objects, false);
  },
  ray(ndc) { raycaster.setFromCamera(ndc, camera); return raycaster.ray; },
  shake(amount) { if (!reduced) rig.shake = Math.max(rig.shake, amount); },
};

// ---------------------------------------------------------------- scenes
const instances = {};
let current = null, currentId = null, busy = false;
const actionButtons = new Map();

function setAccent(c) { root.style.setProperty('--accent', c); }

function buildActions(inst) {
  const box = $('actions');
  box.textContent = '';
  actionButtons.clear();
  for (const a of inst.actions ?? []) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'action'; b.id = `action-${a.id}`;
    const verb = document.createElement('span'); verb.className = 'verb'; verb.textContent = a.verb;
    const how = document.createElement('span'); how.className = 'how'; how.textContent = a.how ?? (a.kind === 'hold' ? 'Hold' : 'Tap');
    b.append(verb, how);
    if (a.kind === 'hold') {
      const release = () => { if (b.classList.contains('held')) { b.classList.remove('held'); a.up?.(); } };
      b.addEventListener('pointerdown', (e) => {
        if (b.disabled || busy) return;
        e.preventDefault(); sound.wake();
        try { b.setPointerCapture(e.pointerId); } catch {}
        b.classList.add('held'); a.down?.();
      });
      b.addEventListener('pointerup', release);
      b.addEventListener('pointercancel', release);
      b.addEventListener('lostpointercapture', release);
      b.addEventListener('contextmenu', (e) => e.preventDefault());
      // keyboard: Enter held on the focused button
      b.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.repeat && !busy) { b.classList.add('held'); a.down?.(); } });
      b.addEventListener('keyup', (e) => { if (e.key === 'Enter') release(); });
    } else {
      b.addEventListener('click', () => { if (!busy) { sound.wake(); a.down?.(); } });
    }
    box.append(b);
    actionButtons.set(a.id, b);
  }
}

function showCard(meta) {
  const isMap = meta.id === 'map';
  root.dataset.view = isMap ? 'map' : 'wonder';
  $('intro').hidden = !isMap;
  $('card').hidden = isMap;
  $('btn-map').hidden = isMap;
  $('btn-prev').hidden = $('btn-next').hidden = isMap;
  $('wordmark').textContent = isMap ? 'Phase 1 · Four wonders' : 'Wonders Unseen';
  if (!isMap) {
    const i = WONDERS.findIndex((w) => w.meta.id === meta.id);
    $('card-kicker').textContent = `Wonder ${i + 1} of ${WONDERS.length}`;
    $('card-name').textContent = meta.name;
    $('card-tag').textContent = meta.tag;
    $('card-blurb').textContent = meta.blurb;
    $('card-since').textContent = `In print since ${meta.since} · On screen: never`;
  }
  app.hint(meta.hint ?? '');
  app.readout('');
  setAccent(meta.accent);
}

function activate(id) {
  const mod = SCENES[id];
  const inst = instances[id] ??= mod.create(app);
  current = inst; currentId = id;
  renderPass.scene = inst.scene;
  app.baseFov = mod.meta.fov ?? 50;
  app.bloomBase = mod.meta.bloom?.strength ?? 0.8;
  bloom.radius = mod.meta.bloom?.radius ?? 0.6;
  bloom.threshold = mod.meta.bloom?.threshold ?? 0.7;
  rig.enabled = inst.usesRig !== false;
  rig.shake = 0;
  rig.roll = 0;
  resize();
  warp.setColor('#bfdcff');
  showCard(mod.meta);
  buildActions(inst);
  inst.enter?.();
  sound.ambient(mod.meta.drone);
  try { history.replaceState(null, '', id === 'map' ? '#map' : `#${id}`); } catch {}
}

/** Hyperspace hop to another scene. */
async function go(id) {
  if (busy || id === currentId || !SCENES[id]) return;
  busy = true;
  sound.wake();
  if (!current) {
    activate(id);
    busy = false;
    return;
  }
  hud.classList.add('away');
  app.dom.beacons.classList.add('away');
  toastEl.classList.remove('show');
  sound.whoosh(1.0, true);
  await tween(0.95, (k) => { warp.amount = easeIn(k); app.fovKick = 26 * easeIn(k); });
  flashEl.style.transition = 'none'; flashEl.style.background = '#eaf3ff'; flashEl.style.opacity = reduced ? 0.4 : 1;
  current.leave?.();
  activate(id);
  await wait(0.12);                       // a few frames under the flash for shaders to warm up
  sound.whoosh(0.9, false);
  flashEl.style.transition = 'opacity 0.9s ease-out'; flashEl.style.opacity = 0;
  await tween(0.9, (k) => { warp.amount = 1 - easeOut(k); app.fovKick = 26 * (1 - easeOut(k)); });
  warp.amount = 0; app.fovKick = 0;
  hud.classList.remove('away');
  if (id === 'map') app.dom.beacons.classList.remove('away');
  busy = false;
}

/** The same hop, but staying in the current scene: `swap` runs under the flash. */
async function travel(swap, { hold = 0.5, color = '#bfdcff' } = {}) {
  if (busy) return;
  busy = true;
  warp.setColor(color);
  sound.whoosh(1.1, true);
  await tween(1.0, (k) => { warp.amount = easeIn(k); app.fovKick = 26 * easeIn(k); });
  app.flash(1, 0.5, '#eaf3ff');
  await swap?.('depart');
  await wait(hold);
  app.flash(1, 0.9, '#eaf3ff');
  await swap?.('arrive');
  sound.whoosh(0.9, false);
  await tween(0.9, (k) => { warp.amount = 1 - easeOut(k); app.fovKick = 26 * (1 - easeOut(k)); });
  warp.amount = 0; app.fovKick = 0;
  busy = false;
}

function step(delta) {
  const i = WONDERS.findIndex((w) => w.meta.id === currentId);
  if (i < 0) return;
  go(WONDERS[(i + delta + WONDERS.length) % WONDERS.length].meta.id);
}

// ---------------------------------------------------------------- input
$('btn-map').addEventListener('click', () => go('map'));
$('btn-prev').addEventListener('click', () => step(-1));
$('btn-next').addEventListener('click', () => step(1));
$('btn-sound').addEventListener('click', (e) => {
  const on = !sound.enabled;
  sound.setEnabled(on);
  e.currentTarget.setAttribute('aria-pressed', String(on));
  e.currentTarget.textContent = on ? 'Sound on' : 'Sound off';
});

const pointers = new Map();
let captured = false, pinch = 0;
const ndcOf = (e) => {
  const r = canvas.getBoundingClientRect();
  return new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
};

canvas.addEventListener('pointerdown', (e) => {
  sound.wake();
  try { canvas.setPointerCapture(e.pointerId); } catch {}
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now() });
  if (pointers.size === 1 && current && !busy) captured = !!current.onPointerDown?.(e, ndcOf(e));
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    pinch = Math.hypot(a.x - b.x, a.y - b.y);
  }
});
canvas.addEventListener('pointermove', (e) => {
  const p = pointers.get(e.pointerId);
  if (!p) return;
  const dx = e.clientX - p.x, dy = e.clientY - p.y;
  p.x = e.clientX; p.y = e.clientY;
  if (!current) return;
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    if (pinch > 0 && rig.enabled) rig.zoom(pinch / d);
    pinch = d;
  } else if (captured) {
    current.onPointerMove?.(e, ndcOf(e), { dx, dy, ox: e.clientX - p.sx, oy: e.clientY - p.sy });
  } else if (rig.enabled) {
    rig.rotate(dx, dy);
  }
});
const endPointer = (e) => {
  const p = pointers.get(e.pointerId);
  if (!p) return;
  pointers.delete(e.pointerId);
  if (!current) return;
  const moved = Math.hypot(e.clientX - p.sx, e.clientY - p.sy);
  if (captured) current.onPointerUp?.(e, ndcOf(e));
  else if (!busy && e.type === 'pointerup' && moved < 8 && performance.now() - p.t < 400) current.onTap?.(ndcOf(e));
  if (pointers.size === 0) captured = false;
};
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  if (rig.enabled) rig.zoom(Math.exp(e.deltaY * 0.0012));
}, { passive: false });

const keysDown = new Set();
app.keys = keysDown;
window.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (k === ' ') e.preventDefault();
  if (e.repeat) return;
  sound.wake();
  keysDown.add(k);
  if (busy || !current) return;
  if (k === 'Escape' || k === 'm') { go('map'); return; }
  const onButton = document.activeElement?.classList?.contains('action');
  for (const a of current.actions ?? []) {
    if (a.key === k && !(onButton && k === 'Enter')) {
      const b = actionButtons.get(a.id);
      if (b?.disabled) continue;
      if (a.kind === 'hold') b?.classList.add('held');
      a.down?.();
    }
  }
  if (!current.usesArrows) {
    if (k === 'ArrowRight') step(1);
    if (k === 'ArrowLeft') step(-1);
  }
});
window.addEventListener('keyup', (e) => {
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (k === ' ') e.preventDefault();
  keysDown.delete(k);
  if (!current) return;
  for (const a of current.actions ?? []) {
    if (a.key === k && a.kind === 'hold') {
      const b = actionButtons.get(a.id);
      if (b?.classList.contains('held')) { b.classList.remove('held'); a.up?.(); }
    }
  }
});
window.addEventListener('blur', () => {
  keysDown.clear();
  for (const a of current?.actions ?? []) {
    const b = actionButtons.get(a.id);
    if (a.kind === 'hold' && b?.classList.contains('held')) { b.classList.remove('held'); a.up?.(); }
  }
});

// ---------------------------------------------------------------- frame loop
function resize() {
  const w = root.clientWidth || window.innerWidth, h = root.clientHeight || window.innerHeight;
  renderer.setSize(w, h, false);
  composer.setPixelRatio(px);
  composer.setSize(w, h);
  camera.aspect = w / h;
  rig.fit = camera.aspect < 1 ? Math.min(2.1, Math.pow(1 / camera.aspect, 0.85)) : 1;
  camera.updateProjectionMatrix();
  app.width = w; app.height = h;
  current?.resize?.(w, h);
}
window.addEventListener('resize', resize);
new ResizeObserver(resize).observe(root);

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, Math.max(0.0001, (now - last) / 1000));
  last = now;
  app.time += dt;
  runTweens(dt);
  if (current) {
    rig.update(dt);
    current.update(dt, app.time);
  }
  warp.update(camera, dt);
  const fov = app.baseFov + app.fovKick;
  if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
  bloom.strength = app.bloomBase + app.bloomKick;
  composer.render();
  requestAnimationFrame(frame);
}

resize();
const start = (location.hash || '').replace('#', '');
go(SCENES[start] ? start : 'map');
window.addEventListener('hashchange', () => {
  const id = (location.hash || '').replace('#', '');
  if (SCENES[id]) go(id);
});
requestAnimationFrame(frame);

window.wonders = app;   // handy in the console
