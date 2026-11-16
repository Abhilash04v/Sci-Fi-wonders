// Celestial bodies: a procedural planet, a boiling star, and the soft halo both wear.
import * as THREE from 'three';
import { NOISE } from './glsl.js';
import { makeGlow } from './sky.js';

const PLANET_VERT = /* glsl */ `
varying vec3 vObj;
varying vec3 vWN;
varying vec3 vWP;
void main(){
  vObj = normalize(position);
  vWN = normalize(mat3(modelMatrix) * normal);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWP = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const PLANET_FRAG = /* glsl */ `
varying vec3 vObj;
varying vec3 vWN;
varying vec3 vWP;
uniform float uTime, uSeed, uSea, uCloudAmt, uVeins, uCharge, uBands, uIce, uScale, uAmbient;
uniform vec3 uLight, uSunColor;
uniform vec3 uOcean, uShallow, uLandA, uLandB, uLandC, uCloud, uAtmo, uVeinColor;
uniform vec4 uPulse[4];
${NOISE}
void main(){
  vec3 N = normalize(vWN);
  vec3 V = normalize(cameraPosition - vWP);
  vec3 L = normalize(uLight);
  vec3 p = vObj * uScale + uSeed;
  vec3 warp = vec3(snoise(p * 0.7 + 11.0), snoise(p * 0.7 + 23.0), snoise(p * 0.7 + 37.0));
  float h = fbm(p + warp * 0.35);
  if (uBands > 0.0) {
    float band = sin(vObj.y * 11.0 + fbm3(p * vec3(0.5, 2.2, 0.5)) * 2.4);
    h = mix(h, band * 0.6, uBands);
  }
  float land = smoothstep(uSea, uSea + 0.035, h);
  float elev = clamp((h - uSea) / max(0.05, 0.85 - uSea), 0.0, 1.0);
  float patches = fbm3(p * 2.3 + 50.0);
  vec3 landCol = mix(uLandA, uLandB, smoothstep(-0.25, 0.3, patches));
  landCol = mix(landCol, uLandC, smoothstep(0.45, 0.9, elev));
  vec3 seaCol = mix(uShallow, uOcean, smoothstep(0.0, 0.3, uSea - h));
  vec3 albedo = mix(seaCol, landCol, land);
  float ice = smoothstep(uIce, uIce + 0.07, abs(vObj.y) + h * 0.07);
  albedo = mix(albedo, vec3(0.9, 0.95, 1.0), ice);

  vec3 cp = vObj * 2.1 + vec3(uTime * 0.011, 0.0, uTime * 0.007) + uSeed * 1.7;
  float cloud = smoothstep(0.1, 0.6, fbm(cp + warp * 0.5)) * uCloudAmt;

  float ndl = dot(N, L);
  float day = smoothstep(-0.15, 0.35, ndl);
  vec3 lit = albedo * (max(ndl, 0.0) * 1.2 + uAmbient) * uSunColor;
  vec3 H = normalize(L + V);
  float spec = pow(max(dot(N, H), 0.0), 180.0) * (1.0 - land) * (1.0 - cloud);
  lit += uSunColor * spec * 0.5 * day;
  vec3 cloudLit = uCloud * (max(ndl, 0.0) * 1.15 + uAmbient + 0.005) * uSunColor;
  lit = mix(lit, cloudLit, cloud);

  vec3 glow = vec3(0.0);
  if (uVeins > 0.0) {
    float r1 = 1.0 - abs(snoise(vObj * 3.1 + uSeed + warp * 0.45));
    float r2 = 1.0 - abs(snoise(vObj * 7.3 + uSeed * 2.0 + warp * 0.2));
    float vein = pow(r1, 16.0) + 0.55 * pow(r2, 24.0);
    float flow = 0.55 + 0.45 * sin(uTime * 1.4 + h * 16.0 + vObj.y * 5.0);
    float show = uVeins * ((1.0 - day) + 0.1 + uCharge * 1.0);
    glow += uVeinColor * vein * flow * show * (1.0 - cloud * 0.55);
    float pulse = 0.0;
    for (int i = 0; i < 4; i++){
      vec4 pu = uPulse[i];
      float age = uTime - pu.w;
      if (pu.w >= 0.0 && age < 4.5){
        float ang = acos(clamp(dot(vObj, pu.xyz), -1.0, 1.0));
        float ring = 1.0 - smoothstep(0.0, 0.16, abs(ang - age * 0.85));
        pulse += ring * (1.0 - age / 4.5);
      }
    }
    glow += uVeinColor * pulse * (0.5 + vein * 3.5);
    glow += uVeinColor * uCharge * 0.03;
  }

  float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  vec3 rim = uAtmo * fres * (day * 0.9 + 0.05 + uCharge * 0.6);
  gl_FragColor = vec4(lit + glow + rim, 1.0);
}
`;

const DEFAULT_LOOK = {
  ocean: '#062a4a', shallow: '#1b7a8c', landA: '#2f6b2f', landB: '#8a7a3a', landC: '#d8d2c4',
  cloud: '#ffffff', atmo: '#6fb6ff', veinColor: '#6ff2d0',
  seed: 1, sea: 0.0, cloudAmt: 0.8, veins: 0, bands: 0, ice: 2, scale: 1.5, ambient: 0.015,
};

export function makePlanetMaterial(look = {}) {
  const o = { ...DEFAULT_LOOK, ...look };
  const C = (v) => ({ value: new THREE.Color(v) });
  return new THREE.ShaderMaterial({
    vertexShader: PLANET_VERT, fragmentShader: PLANET_FRAG,
    uniforms: {
      uTime: { value: 0 }, uSeed: { value: o.seed }, uSea: { value: o.sea }, uCloudAmt: { value: o.cloudAmt },
      uVeins: { value: o.veins }, uCharge: { value: 0 }, uBands: { value: o.bands }, uIce: { value: o.ice },
      uScale: { value: o.scale }, uAmbient: { value: o.ambient },
      uLight: { value: new THREE.Vector3(1, 0.3, 0.6).normalize() }, uSunColor: { value: new THREE.Color(1, 0.96, 0.9) },
      uOcean: C(o.ocean), uShallow: C(o.shallow), uLandA: C(o.landA), uLandB: C(o.landB), uLandC: C(o.landC),
      uCloud: C(o.cloud), uAtmo: C(o.atmo), uVeinColor: C(o.veinColor),
      uPulse: { value: [0, 1, 2, 3].map(() => new THREE.Vector4(0, 1, 0, -1)) },
    },
  });
}

// A glow that hugs a sphere's silhouette. Works for atmospheres and coronas:
// brightness depends on how close the view ray passes to the body's surface.
const HALO_VERT = /* glsl */ `
uniform float uShell;
varying vec3 vWP;
varying vec3 vC;
varying float vR;
void main(){
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWP = wp.xyz;
  vC = modelMatrix[3].xyz;
  vR = length(modelMatrix[0].xyz);   // the body's radius; the halo mesh itself is uShell times larger
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;
const HALO_FRAG = /* glsl */ `
varying vec3 vWP;
varying vec3 vC;
varying float vR;
uniform vec3 uColor, uLight;
uniform float uShell, uPower, uGain, uLit, uFlame, uTime;
${NOISE}
void main(){
  vec3 ro = cameraPosition;
  vec3 rd = normalize(vWP - ro);
  float tca = dot(vC - ro, rd);
  vec3 closest = ro + rd * tca;
  vec3 off = closest - vC;
  float b = length(off) / vR;                    // 1 at the limb, uShell at the halo's edge
  float g = pow(clamp((uShell - b) / (uShell - 1.0), 0.0, 1.0), uPower);
  g *= smoothstep(0.9, 1.0, b);
  vec3 dir = normalize(off);
  float lit = mix(1.0, smoothstep(-0.45, 0.55, dot(dir, normalize(uLight))), uLit);
  float flame = 1.0;
  if (uFlame > 0.0) {
    float n = fbm3(dir * 3.0 + vec3(0.0, uTime * 0.12, 0.0)) * 0.5 + 0.5;
    float streak = pow(1.0 - abs(snoise(dir * 5.0 - uTime * 0.05)), 3.0);
    flame = mix(1.0, n * 1.3 + streak * 0.6, uFlame);
  }
  gl_FragColor = vec4(uColor * g * lit * flame * uGain, 1.0);
}
`;

export function makeHalo({ color = '#6fb6ff', shell = 1.18, power = 2.4, gain = 1, lit = 1, flame = 0 } = {}) {
  const mat = new THREE.ShaderMaterial({
    vertexShader: HALO_VERT, fragmentShader: HALO_FRAG,
    side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: {
      uColor: { value: new THREE.Color(color) }, uLight: { value: new THREE.Vector3(1, 0, 0) },
      uShell: { value: shell }, uPower: { value: power }, uGain: { value: gain }, uLit: { value: lit },
      uFlame: { value: flame }, uTime: { value: 0 },
    },
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(shell, 48, 32), mat);
  return mesh;
}

/** A planet with its atmosphere. `planet.setLight(dir)` keeps both in step. */
export function makePlanet(look = {}, detail = 64) {
  const group = new THREE.Group();
  const material = makePlanetMaterial(look);
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, detail, Math.round(detail * 0.75)), material);
  const halo = makeHalo({ color: look.atmo ?? DEFAULT_LOOK.atmo, shell: 1.2, power: 2.6, gain: look.haloGain ?? 0.9 });
  group.add(body, halo);
  return {
    group, body, halo, material,
    setLight(dir, color) {
      material.uniforms.uLight.value.copy(dir);
      halo.material.uniforms.uLight.value.copy(dir);
      if (color) material.uniforms.uSunColor.value.set(color);
    },
    tick(t) { material.uniforms.uTime.value = t; },
  };
}

const STAR_FRAG = /* glsl */ `
varying vec3 vObj;
varying vec3 vWN;
varying vec3 vWP;
uniform float uTime, uBoost, uUnrest;
uniform vec3 uHot, uCool;
${NOISE}
void main(){
  vec3 p = vObj * 3.0;
  float t = uTime * (0.07 + uUnrest * 0.5);
  float n1 = fbm(p + vec3(t, t * 0.7, -t));
  float n2 = snoise(p * 4.5 + n1 * 1.5 - t * 2.0);
  float n = n1 * 0.7 + n2 * 0.22;
  float spots = smoothstep(0.3, 0.62, fbm3(p * 0.7 - t * 0.4 + 9.0));
  vec3 col = mix(uCool, uHot, smoothstep(-0.3, 0.7, n));
  col *= 1.0 - 0.7 * spots * (1.0 - uUnrest);
  float mu = max(dot(normalize(vWN), normalize(cameraPosition - vWP)), 0.0);
  col *= 0.5 + 0.8 * sqrt(mu);
  col += uHot * pow(1.0 - mu, 3.0) * 0.7;
  col = mix(col, vec3(1.4, 1.5, 1.7) * (0.8 + 0.4 * n), uUnrest);
  gl_FragColor = vec4(col * uBoost, 1.0);
}
`;

/** A star you can get close to: boiling surface, flame corona, lens glow. */
export function makeStar({ radius = 1, hot = '#ffd27a', cool = '#ff6a1a', glow = '#ffb060', boost = 2.2, corona = 1.7, flare = 7, flareOpacity = 0.55, haloGain = 1.5 } = {}) {
  const group = new THREE.Group();
  const material = new THREE.ShaderMaterial({
    vertexShader: PLANET_VERT, fragmentShader: STAR_FRAG,
    uniforms: {
      uTime: { value: 0 }, uBoost: { value: boost }, uUnrest: { value: 0 },
      uHot: { value: new THREE.Color(hot) }, uCool: { value: new THREE.Color(cool) },
    },
  });
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 48), material);
  const halo = makeHalo({ color: glow, shell: corona, power: 2.2, gain: haloGain, lit: 0, flame: 1 });
  const flareSprite = makeGlow(glow, Math.max(flare, 0.001), flareOpacity);
  flareSprite.visible = flare > 0;
  group.add(body, halo, flareSprite);
  group.scale.setScalar(radius);
  return {
    group, body, halo, flare: flareSprite, material,
    setColors(h, c, g) {
      material.uniforms.uHot.value.set(h); material.uniforms.uCool.value.set(c);
      halo.material.uniforms.uColor.value.set(g); flareSprite.material.color.set(g);
    },
    tick(t) { material.uniforms.uTime.value = t; halo.material.uniforms.uTime.value = t; },
  };
}
