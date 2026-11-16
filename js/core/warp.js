// Hyperspace streaks: a tunnel of line segments that lives in camera space.
import * as THREE from 'three';

const VERT = /* glsl */ `
attribute float aEnd;
attribute float aSpeed;
uniform float uTravel, uStretch;
varying float vAlpha;
void main(){
  vec3 p = position;
  float z = mod(p.z + uTravel * aSpeed, 460.0) - 420.0;
  z -= aEnd * uStretch * aSpeed;
  vec4 mv = viewMatrix * modelMatrix * vec4(p.xy, z, 1.0);
  float near = 1.0 - smoothstep(-10.0, 40.0, z);
  vAlpha = (1.0 - aEnd * 0.85) * near * smoothstep(-420.0, -300.0, z);
  gl_Position = projectionMatrix * mv;
}
`;
const FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying float vAlpha;
void main(){ gl_FragColor = vec4(uColor * vAlpha * uOpacity, 1.0); }
`;

export function makeWarp(count = 1400) {
  const pos = new Float32Array(count * 6);
  const end = new Float32Array(count * 2);
  const speed = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 3 + Math.pow(Math.random(), 0.7) * 70;
    const x = Math.cos(a) * r, y = Math.sin(a) * r, z = -Math.random() * 460;
    pos.set([x, y, z, x, y, z], i * 6);
    end.set([0, 1], i * 2);
    const s = 0.5 + Math.random();
    speed.set([s, s], i * 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
  geo.setAttribute('aSpeed', new THREE.BufferAttribute(speed, 1));
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthTest: false, depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTravel: { value: 0 }, uStretch: { value: 0 }, uOpacity: { value: 0 },
      uColor: { value: new THREE.Color(0.75, 0.86, 1.0) },
    },
  });
  const lines = new THREE.LineSegments(geo, mat);
  lines.frustumCulled = false;
  lines.renderOrder = 50;
  const scene = new THREE.Scene();
  scene.add(lines);

  const warp = {
    scene, lines,
    amount: 0,           // 0 = off, 1 = full hyperspace
    setColor(c) { mat.uniforms.uColor.value.set(c); },
    update(camera, dt) {
      const a = warp.amount;
      lines.visible = a > 0.002;
      if (!lines.visible) return;
      lines.position.copy(camera.position);
      lines.quaternion.copy(camera.quaternion);
      mat.uniforms.uTravel.value += dt * (30 + a * a * 900);
      mat.uniforms.uStretch.value = 0.5 + a * a * 150;
      mat.uniforms.uOpacity.value = Math.min(1, a * 2.2) * 1.4;
    },
  };
  return warp;
}
