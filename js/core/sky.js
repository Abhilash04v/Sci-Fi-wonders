// Skies: a baked nebula backdrop, a twinkling star shell, glow sprites.
import * as THREE from 'three';
import { NOISE } from './glsl.js';

const BAKE_VERT = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

// Paints an equirectangular nebula. Directions match THREE.SphereGeometry's
// uv layout, so "focus" directions land where the scene expects them.
const BAKE_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform vec3 uA, uB, uC, uBase;
uniform float uSeed, uDensity, uDust, uGain, uScale;
uniform vec3 uFocus;      // direction of an optional bright band or dark opening
uniform float uBand;      // > 0 : a milky band around the plane normal to uFocus
uniform float uHole;      // > 0 : a darker opening around uFocus
uniform float uGrad;      // > 0 : a planet's sky, fading from uHorizon up to uBase
uniform vec3 uHorizon;
uniform float uStars;     // > 0 : stars painted into the backdrop itself (so lenses can bend them)
uniform float uStarScale;
${NOISE}
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float hash3(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
void main(){
  float phi = vUv.x * 6.28318530718;
  float lat = (vUv.y - 0.5) * 3.14159265359;
  vec3 d = vec3(-cos(phi) * cos(lat), sin(lat), sin(phi) * cos(lat));
  vec3 p = d * uScale + uSeed;
  vec3 w = vec3(fbm3(p + 3.1), fbm3(p + vec3(5.2, 1.3, 8.1)), fbm3(p + 9.7));
  float n = fbm(p * 1.3 + w * 1.5);
  float cloud = smoothstep(0.55 - uDensity, 0.95 - uDensity * 0.5, n * 0.5 + 0.5);
  float n2 = fbm(p * 2.4 - w * 0.9 + 20.0);
  vec3 col = mix(uA, uB, smoothstep(-0.35, 0.45, n2));
  col = mix(col, uC, smoothstep(0.15, 0.8, fbm3(p * 0.9 + w + 40.0)) * 0.85);
  float wisp = pow(1.0 - abs(snoise(p * 3.0 + w * 2.0)), 6.0);
  col *= cloud * (0.75 + 0.9 * wisp);
  float dust = smoothstep(0.05, 0.55, fbm(p * 3.2 + w * 2.2 + 70.0));
  col *= 1.0 - uDust * dust;
  if (uBand > 0.0) {
    float b = exp(-pow(dot(d, normalize(uFocus)) / 0.16, 2.0));
    float grain = 0.6 + 0.4 * fbm(d * 9.0 + uSeed);
    col += (uC * 0.5 + vec3(0.25)) * b * grain * uBand * (1.0 - 0.8 * dust);
  }
  if (uHole > 0.0) {
    float h = smoothstep(0.55, 0.95, dot(d, normalize(uFocus)) + 0.08 * w.x);
    col *= 1.0 - uHole * h;
  }
  if (uGrad > 0.0) col = mix(uHorizon, uBase, smoothstep(-0.03, uGrad, d.y)) + col * uGain;
  else col = uBase + col * uGain;
  if (uStars > 0.0) {
    vec3 sp = d * uStarScale;
    vec3 cell = floor(sp);
    if (hash3(cell) > 1.0 - 0.07 * uStars) {
      vec3 at = cell + 0.3 + 0.4 * vec3(hash3(cell + 1.7), hash3(cell + 5.3), hash3(cell + 9.1));
      float s = 1.0 - smoothstep(0.0, 0.55, length(sp - at));
      float br = pow(hash3(cell + 3.3), 4.0) * 3.0 + 0.3;
      vec3 tint = mix(vec3(1.0, 0.85, 0.7), vec3(0.75, 0.85, 1.0), hash3(cell + 7.7));
      col += tint * s * s * br * (1.0 - 0.7 * dust);
    }
  }
  col += (hash(vUv * 2048.0) - 0.5) / 255.0;
  // stored gamma-2 to keep the dark end smooth in 8 bits
  gl_FragColor = vec4(sqrt(max(col, 0.0)), 1.0);
}
`;

const SKY_VERT = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const SKY_FRAG = /* glsl */ `
varying vec2 vUv;
uniform sampler2D uMap;
uniform float uFade;
void main(){
  vec3 c = texture2D(uMap, vUv).rgb;
  gl_FragColor = vec4(c * c * uFade, 1.0);
}
`;

let bakeScene, bakeCam, bakeMat;

/**
 * A nebula sky dome. Call `.paint(options)` to (re)bake it.
 * options: { a, b, c, base, seed, density, dust, gain, scale, focus, band, hole, horizon, stars }
 */
export function makeSky(renderer, options, width) {
  const small = Math.min(window.innerWidth, window.innerHeight) < 600;
  const W = width ?? (small ? 1536 : 2048);
  const target = new THREE.WebGLRenderTarget(W, W / 2, {
    minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false,
  });
  target.texture.wrapS = THREE.RepeatWrapping;

  if (!bakeScene) {
    bakeScene = new THREE.Scene();
    bakeCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    bakeMat = new THREE.ShaderMaterial({
      vertexShader: BAKE_VERT, fragmentShader: BAKE_FRAG, depthTest: false, depthWrite: false,
      uniforms: {
        uA: { value: new THREE.Color() }, uB: { value: new THREE.Color() }, uC: { value: new THREE.Color() },
        uBase: { value: new THREE.Color() }, uSeed: { value: 0 }, uDensity: { value: 0.5 }, uDust: { value: 0.6 },
        uGain: { value: 1 }, uScale: { value: 1.6 }, uFocus: { value: new THREE.Vector3(0, 1, 0) },
        uBand: { value: 0 }, uHole: { value: 0 },
        uGrad: { value: 0 }, uHorizon: { value: new THREE.Color() }, uStars: { value: 0 }, uStarScale: { value: 110 },
      },
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bakeMat);
    quad.frustumCulled = false;
    bakeScene.add(quad);
  }

  const mat = new THREE.ShaderMaterial({
    vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthTest: false, depthWrite: false,
    uniforms: { uMap: { value: target.texture }, uFade: { value: 1 } },
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 24), mat);
  mesh.renderOrder = -100;
  mesh.frustumCulled = false;

  function paint(o) {
    const u = bakeMat.uniforms;
    u.uA.value.set(o.a); u.uB.value.set(o.b); u.uC.value.set(o.c);
    u.uBase.value.set(o.base ?? '#020308');
    u.uSeed.value = o.seed ?? 1;
    u.uDensity.value = o.density ?? 0.5;
    u.uDust.value = o.dust ?? 0.6;
    u.uGain.value = o.gain ?? 1;
    u.uScale.value = o.scale ?? 1.6;
    u.uFocus.value.set(...(o.focus ?? [0, 1, 0]));
    u.uBand.value = o.band ?? 0;
    u.uHole.value = o.hole ?? 0;
    u.uGrad.value = o.horizon ? (o.horizonHeight ?? 0.42) : 0;   // how far up the horizon colour reaches
    if (o.horizon) u.uHorizon.value.set(o.horizon);
    u.uStars.value = o.stars ?? 0;
    u.uStarScale.value = W / 18.6;
    const prev = renderer.getRenderTarget();
    renderer.setRenderTarget(target);
    renderer.render(bakeScene, bakeCam);
    renderer.setRenderTarget(prev);
  }
  paint(options);

  return { mesh, material: mat, texture: target.texture, paint, follow(camera) { mesh.position.copy(camera.position); } };
}

const STAR_VERT = /* glsl */ `
attribute float aSize;
attribute float aPhase;
attribute vec3 aColor;
uniform float uTime, uPx, uFade;
varying vec3 vColor;
void main(){
  float tw = 0.75 + 0.25 * sin(uTime * (0.6 + aPhase * 1.7) + aPhase * 40.0);
  vColor = aColor * tw * uFade;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize * uPx;
}
`;
const STAR_FRAG = /* glsl */ `
varying vec3 vColor;
void main(){
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  float a = 1.0 - smoothstep(0.0, 0.5, d);
  gl_FragColor = vec4(vColor * a * a, 1.0);
}
`;

/** A shell of twinkling stars that follows the camera. */
export function makeStars(count = 4500, tint = [1, 1, 1], rand = Math.random) {
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const size = new Float32Array(count);
  const phase = new Float32Array(count);
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const u = rand() * 2 - 1, t = rand() * Math.PI * 2, s = Math.sqrt(1 - u * u);
    pos.set([s * Math.cos(t) * 800, u * 800, s * Math.sin(t) * 800], i * 3);
    const k = rand();
    // mostly white, some blue, some amber
    if (k < 0.6) c.setRGB(1, 1, 1); else if (k < 0.82) c.setRGB(0.65, 0.78, 1); else c.setRGB(1, 0.8, 0.58);
    const b = 0.35 + Math.pow(rand(), 3) * 1.6;
    col.set([c.r * b * tint[0], c.g * b * tint[1], c.b * b * tint[2]], i * 3);
    size[i] = 1.2 + Math.pow(rand(), 6) * 3.2;
    phase[i] = rand();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  const mat = new THREE.ShaderMaterial({
    vertexShader: STAR_VERT, fragmentShader: STAR_FRAG, transparent: true, depthTest: false, depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uPx: { value: 1 }, uFade: { value: 1 } },
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = -90;
  return {
    points, material: mat,
    update(camera, t, px) { points.position.copy(camera.position); mat.uniforms.uTime.value = t; mat.uniforms.uPx.value = px; },
  };
}

let glowTex, softTex;

/** Soft radial falloff, good for suns, beacons and lens glow. */
export function glowTexture() {
  if (glowTex) return glowTex;
  const s = 256, cv = document.createElement('canvas');
  cv.width = cv.height = s;
  const g = cv.getContext('2d');
  const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.08, 'rgba(255,255,255,0.85)');
  grad.addColorStop(0.22, 'rgba(255,255,255,0.32)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.08)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, s, s);
  glowTex = new THREE.CanvasTexture(cv);
  return glowTex;
}

/** A wide, even puff for fog banks. */
export function softTexture() {
  if (softTex) return softTex;
  const s = 256, cv = document.createElement('canvas');
  cv.width = cv.height = s;
  const g = cv.getContext('2d');
  const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grad.addColorStop(0, 'rgba(255,255,255,0.55)');
  grad.addColorStop(0.45, 'rgba(255,255,255,0.22)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, s, s);
  softTex = new THREE.CanvasTexture(cv);
  return softTex;
}

export function makeGlow(color, size, opacity = 1) {
  const mat = new THREE.SpriteMaterial({
    map: glowTexture(), color, transparent: true, opacity, depthWrite: false, depthTest: true,
    blending: THREE.AdditiveBlending,
  });
  const sp = new THREE.Sprite(mat);
  sp.scale.setScalar(size);
  return sp;
}

/** A distant sun: a sprite pinned to a direction, far behind everything. */
export function makeSun(color, size = 260) {
  const group = new THREE.Group();
  const core = makeGlow(color, size, 1);
  const halo = makeGlow(color, size * 3.2, 0.35);
  core.material.depthTest = halo.material.depthTest = false;
  core.renderOrder = halo.renderOrder = -80;
  group.add(halo, core);
  const dir = new THREE.Vector3(1, 0.2, 0.5).normalize();
  return {
    group, dir, core, halo,
    setColor(c) { core.material.color.set(c); halo.material.color.set(c); },
    follow(camera) { group.position.copy(camera.position).addScaledVector(dir, 700); },
  };
}
