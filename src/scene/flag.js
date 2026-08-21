/**
 * Sang Saka Merah Putih, generated entirely in a shader — no texture asset.
 *
 * The cloth is a pinned membrane: displacement ramps from zero at the hoist to
 * full amplitude at the fly, three travelling waves of decreasing wavelength
 * cross it, and a slow two-frequency gust envelope swells and slackens the
 * whole sheet. Normals come from finite differences of the same displacement
 * function, so the folds light correctly instead of looking like a flat decal.
 *
 * Proportions follow the official 2:3 ratio; the red is #CE1126. The whole
 * assembly is planted at a lon/lat on the globe and rotated so its pole runs
 * along the local vertical.
 */

import * as THREE from 'three';
import { CHIP_BASE, lonLatToDir } from '../util/geo.js';

const CLOTH_COMMON = /* glsl */`
uniform float uTime;

// Displacement of the cloth at parametric (u,v), u = 0 at the hoist.
vec3 clothOffset(vec2 uv, float t){
  float pinned = smoothstep(0.0, 0.30, uv.x);
  float reach  = uv.x;

  // Two slow, out-of-phase oscillators read as wind gusting rather than looping.
  float gust = 0.62 + 0.38 * sin(t * 0.37) * sin(t * 0.231 + 1.7);

  float w  = sin(uv.x * 15.0 - t * 4.6 + uv.y * 2.6) * 0.150;
        w += sin(uv.x * 24.0 - t * 6.6 - uv.y * 4.1) * 0.062;
        w += sin(uv.x * 39.0 - t * 9.1 + uv.y * 6.8) * 0.026;
        w += sin(uv.y *  9.0 + t * 2.1)              * 0.030 * reach;

  float z = w * pinned * gust;

  // Cloth cannot stretch: waving pulls the fly end back toward the pole,
  // and gravity lets the free corner fall away.
  float shorten = -0.16 * reach * reach * gust;
  float droop   = -0.10 * reach * reach * (1.25 - gust * 0.5);

  return vec3(shorten, droop, z);
}
`;

const VERT = /* glsl */`
varying vec2 vUv;
varying vec3 vNormalW;
varying vec3 vWorld;
varying float vFold;

${CLOTH_COMMON}

void main(){
  vUv = uv;
  vec3 pos = position;

  vec3 off = clothOffset(uv, uTime);
  pos += vec3(off.x * 2.4, off.y * 2.4, off.z * 2.4);

  // Finite-difference normal from the same field.
  float e = 0.012;
  vec3 du = vec3(2.4 * 0.9, 0.0, 0.0) + (clothOffset(uv + vec2(e, 0.0), uTime) - off) * 2.4 / e * 0.9;
  vec3 dv = vec3(0.0, 2.4 * 0.6, 0.0) + (clothOffset(uv + vec2(0.0, e), uTime) - off) * 2.4 / e * 0.6;
  vec3 n = normalize(cross(du, dv));

  vNormalW = normalize(mat3(modelMatrix) * n);
  vFold = off.z;

  vec4 world = modelMatrix * vec4(pos, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const FRAG = /* glsl */`
precision highp float;

uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uSkyColor;
uniform vec3 uRed;
uniform float uTime;

varying vec2 vUv;
varying vec3 vNormalW;
varying vec3 vWorld;
varying float vFold;

void main(){
  // Merah di atas, putih di bawah — the whole flag, from two constants.
  float split = smoothstep(0.497, 0.503, vUv.y);
  vec3 base = mix(vec3(0.965, 0.968, 0.975), uRed, split);

  // Woven texture: fine warp/weft plus a little large-scale slub.
  float weave = sin(vUv.x * 1100.0) * sin(vUv.y * 720.0) * 0.016
              + sin(vUv.x * 61.0 + vUv.y * 44.0) * 0.008;
  base *= 1.0 + weave;

  // Cloth sags into shadow at the hoist where it is bunched against the pole.
  base *= mix(0.80, 1.0, smoothstep(0.0, 0.09, vUv.x));

  vec3 n = normalize(vNormalW);
  if (!gl_FrontFacing) n = -n;

  vec3 sun = normalize(uSunDir);
  float wrap = clamp((dot(n, sun) + 0.35) / 1.35, 0.0, 1.0);   // wrapped diffuse
  float sky  = clamp(n.y * 0.5 + 0.5, 0.0, 1.0);

  vec3 color = base * (uSunColor * wrap * 1.05 + uSkyColor * sky * 0.42 + 0.16);

  // Folds catch a little extra light on their crests.
  color += base * uSunColor * smoothstep(0.02, 0.16, vFold) * 0.22;

  // Thin sheen so the white half never blows out to flat paper.
  vec3 viewDir = normalize(cameraPosition - vWorld);
  float sheen = pow(max(dot(normalize(sun + viewDir), n), 0.0), 26.0);
  color += vec3(1.0, 0.94, 0.86) * sheen * 0.16;

  gl_FragColor = vec4(color, 1.0);
}
`;

export function createFlag({ lon, lat, poleHeight = 20, width = 7.5, sunDir, sunColor, skyColor }) {
  const group = new THREE.Group();

  const up = lonLatToDir(lon, lat, new THREE.Vector3());
  group.position.copy(up).multiplyScalar(CHIP_BASE);
  // The flag is modelled with its pole along +Y; stand it on the local vertical.
  group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);

  const height = width * (2 / 3);   // official 2:3

  // ── Pole ──────────────────────────────────────────────────────────
  const poleMat = new THREE.MeshStandardMaterial({
    color: '#8d9aad', roughness: 0.34, metalness: 0.85,
  });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.15, poleHeight, 16), poleMat);
  pole.position.y = poleHeight / 2;
  group.add(pole);

  const finial = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 20, 14),
    new THREE.MeshStandardMaterial({
      color: '#f5c451', roughness: 0.22, metalness: 1.0,
      emissive: '#3a2a06', emissiveIntensity: 1,
    })
  );
  finial.position.y = poleHeight + 0.24;
  group.add(finial);

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.7, 0.95, 0.42, 20),
    new THREE.MeshStandardMaterial({ color: '#1d2c44', roughness: 0.7, metalness: 0.3 })
  );
  base.position.y = 0.21;
  group.add(base);

  // ── Cloth ─────────────────────────────────────────────────────────
  const clothGeo = new THREE.PlaneGeometry(width, height, 72, 48);
  clothGeo.translate(width / 2, 0, 0);   // pin the hoist at local x = 0

  const clothMat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uSunDir: { value: sunDir.clone().normalize() },
      uSunColor: { value: new THREE.Color(sunColor) },
      uSkyColor: { value: new THREE.Color(skyColor) },
      uRed: { value: new THREE.Color('#ce1126') },
    },
  });

  const cloth = new THREE.Mesh(clothGeo, clothMat);
  cloth.position.set(0.12, poleHeight - height / 2 - 0.6, 0);
  cloth.frustumCulled = false;
  group.add(cloth);

  return {
    group,
    cloth,
    height: poleHeight,
    update(dt, elapsed) {
      clothMat.uniforms.uTime.value = elapsed;
    },
  };
}
