/**
 * The starfield the globe hangs in. Stars are distributed over the whole
 * celestial sphere (the camera orbits freely now, so there is no "up") and
 * scintillate on individual phases.
 */

import * as THREE from 'three';

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

export function createSky({ count = 3200, radius = 1400 } = {}) {
  const group = new THREE.Group();

  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const phases = new Float32Array(count);
  const tints = new Float32Array(count * 3);
  const warm = new THREE.Color('#ffd9b0');
  const cool = new THREE.Color('#bcd8ff');
  const scratch = new THREE.Color();

  for (let i = 0; i < count; i++) {
    // Uniform over the whole sphere — the camera orbits the globe freely, so
    // there is no horizon to hide the far half behind.
    const u = Math.random() * 2 - 1;
    const theta = Math.random() * Math.PI * 2;
    const r = Math.sqrt(1 - u * u);
    const distance = radius * (0.9 + Math.random() * 0.2);
    positions[i * 3] = Math.cos(theta) * r * distance;
    positions[i * 3 + 1] = u * distance;
    positions[i * 3 + 2] = Math.sin(theta) * r * distance;

    const bright = Math.pow(Math.random(), 3.2);
    sizes[i] = 1.0 + bright * 4.0;
    phases[i] = Math.random() * Math.PI * 2;

    scratch.copy(cool).lerp(warm, Math.random());
    tints[i * 3] = scratch.r;
    tints[i * 3 + 1] = scratch.g;
    tints[i * 3 + 2] = scratch.b;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
  geometry.setAttribute('aTint', new THREE.BufferAttribute(tints, 3));

  const material = new THREE.ShaderMaterial({
    vertexShader: STAR_VERT,
    fragmentShader: STAR_FRAG,
    uniforms: { uTime: { value: 0 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const stars = new THREE.Points(geometry, material);
  stars.renderOrder = -2;
  stars.frustumCulled = false;
  group.add(stars);

  return {
    group,
    update(dt, elapsed) {
      material.uniforms.uTime.value = elapsed;
      stars.rotation.y = elapsed * 0.003;
    },
  };
}
