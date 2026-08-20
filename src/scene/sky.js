/**
 * Sky dome and starfield. The dome is a large back-faced sphere with a vertical
 * gradient plus a warm bloom around the key light, so the horizon the ocean
 * fades into and the sky behind it are literally the same colour.
 */

import * as THREE from 'three';

const VERT = /* glsl */`
varying vec3 vDir;
void main(){
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAG = /* glsl */`
precision highp float;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uGlow;
uniform vec3 uSunDir;
varying vec3 vDir;

void main(){
  vec3 dir = normalize(vDir);
  float h = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);

  vec3 color = mix(uHorizon, uZenith, pow(smoothstep(0.42, 1.0, h), 0.85));
  // Ground half stays dark so the sea reads as the brightest surface.
  color = mix(color * 0.55, color, smoothstep(0.36, 0.52, h));

  float sun = max(dot(dir, normalize(uSunDir)), 0.0);
  color += uGlow * pow(sun, 5.0) * 0.55;
  color += uGlow * pow(sun, 48.0) * 1.1;

  gl_FragColor = vec4(color, 1.0);
}
`;

const STAR_VERT = /* glsl */`
attribute float aSize;
attribute float aPhase;
attribute vec3 aTint;
uniform float uTime;
varying float vAlpha;
varying vec3 vTint;
void main(){
  vTint = aTint;
  // Slow scintillation, each star on its own phase.
  vAlpha = 0.45 + 0.55 * pow(0.5 + 0.5 * sin(uTime * 0.9 + aPhase), 2.0);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize;
  gl_Position = projectionMatrix * mv;
}
`;

const STAR_FRAG = /* glsl */`
precision mediump float;
varying float vAlpha;
varying vec3 vTint;
void main(){
  float d = length(gl_PointCoord - 0.5);
  float core = smoothstep(0.5, 0.0, d);
  gl_FragColor = vec4(vTint, core * core * vAlpha);
}
`;

export function createSky({ sunDir, horizon }) {
  const group = new THREE.Group();

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(1400, 48, 32),
    new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uZenith: { value: new THREE.Color('#050a18') },
        uHorizon: { value: horizon.clone().multiplyScalar(1.25) },
        uGlow: { value: new THREE.Color('#ff9a52') },
        uSunDir: { value: sunDir.clone().normalize() },
      },
    })
  );
  dome.renderOrder = -2;
  group.add(dome);

  // ── Stars ─────────────────────────────────────────────────────────
  const COUNT = 2600;
  const positions = new Float32Array(COUNT * 3);
  const sizes = new Float32Array(COUNT);
  const phases = new Float32Array(COUNT);
  const tints = new Float32Array(COUNT * 3);
  const warm = new THREE.Color('#ffd9b0');
  const cool = new THREE.Color('#bcd8ff');
  const scratch = new THREE.Color();

  for (let i = 0; i < COUNT; i++) {
    // Bias toward the upper hemisphere — no stars under the sea.
    const u = Math.random();
    const y = Math.pow(u, 0.55);
    const r = Math.sqrt(1 - y * y);
    const theta = Math.random() * Math.PI * 2;
    const radius = 1180 + Math.random() * 120;
    positions[i * 3]     = Math.cos(theta) * r * radius;
    positions[i * 3 + 1] = y * radius;
    positions[i * 3 + 2] = Math.sin(theta) * r * radius;

    const bright = Math.pow(Math.random(), 3.2);
    sizes[i] = 1.0 + bright * 4.2;
    phases[i] = Math.random() * Math.PI * 2;

    scratch.copy(cool).lerp(warm, Math.random());
    tints[i * 3] = scratch.r;
    tints[i * 3 + 1] = scratch.g;
    tints[i * 3 + 2] = scratch.b;
  }

  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  starGeo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  starGeo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
  starGeo.setAttribute('aTint', new THREE.BufferAttribute(tints, 3));

  const starMat = new THREE.ShaderMaterial({
    vertexShader: STAR_VERT,
    fragmentShader: STAR_FRAG,
    uniforms: { uTime: { value: 0 } },
    transparent: true,
    depthWrite: false,
    fog: false,
    blending: THREE.AdditiveBlending,
  });

  const stars = new THREE.Points(starGeo, starMat);
  stars.renderOrder = -2;
  group.add(stars);

  group.frustumCulled = false;

  return {
    group,
    update(dt, elapsed) {
      starMat.uniforms.uTime.value = elapsed;
      stars.rotation.y = elapsed * 0.004;
    },
  };
}
