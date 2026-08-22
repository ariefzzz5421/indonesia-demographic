/**
 * The atlas globe: a sphere wearing a canvas-painted world map, plus the
 * atmospheric shell around it.
 *
 * Country outlines are rasterised into an equirectangular canvas rather than
 * built as geometry. At 4096 px across, one degree of longitude is 11 px — far
 * more resolution than 1:50m Natural Earth carries — and it keeps the whole
 * world to two textures and one draw call, leaving the geometry budget for the
 * Indonesian provinces that actually need to be interactive.
 *
 * A second, lower-resolution canvas holds a land/sea mask so the shader can
 * give the oceans a specular sheen the land does not get.
 */

import * as THREE from 'three';
import { GLOBE_RADIUS } from '../util/geo.js';

const VERT = /* glsl */`
varying vec2 vUv;
varying vec3 vNormalW;
varying vec3 vWorld;
void main(){
  vUv = uv;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const FRAG = /* glsl */`
precision highp float;

uniform sampler2D uMap;
uniform sampler2D uMask;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uSkyColor;
uniform vec3 uRim;
uniform float uTime;

varying vec2 vUv;
varying vec3 vNormalW;
varying vec3 vWorld;

void main(){
  vec3 atlas = texture2D(uMap, vUv).rgb;
  float land = texture2D(uMask, vUv).r;

  vec3 n = normalize(vNormalW);
  vec3 sun = normalize(uSunDir);
  vec3 viewDir = normalize(cameraPosition - vWorld);

  // Wrapped diffuse: the far side stays legible, because this is an atlas
  // before it is a planet.
  float lambert = clamp((dot(n, sun) + 0.55) / 1.55, 0.0, 1.0);
  float light = 0.42 + 0.58 * lambert;

  vec3 color = atlas * (uSunColor * light);
  color += atlas * uSkyColor * 0.16;

  // Oceans catch the sun; land does not. The exponent has to be brutal — a
  // globe this size on screen turns anything softer into a blown-out disc.
  vec3 half3 = normalize(sun + viewDir);
  float ocean = 1.0 - land;
  float spec = pow(max(dot(n, half3), 0.0), 900.0);
  float sheen = pow(max(dot(n, half3), 0.0), 26.0);
  color += uSunColor * ocean * (spec * 0.42 + sheen * 0.05) * lambert;

  // Atmospheric limb.
  float fresnel = pow(1.0 - max(dot(n, viewDir), 0.0), 3.2);
  color += uRim * fresnel * 0.55;

  gl_FragColor = vec4(color, 1.0);
}
`;

const ATMO_VERT = /* glsl */`
varying vec3 vNormalW;
varying vec3 vWorld;
void main(){
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const ATMO_FRAG = /* glsl */`
precision highp float;
uniform vec3 uRim;
uniform vec3 uSunDir;
varying vec3 vNormalW;
varying vec3 vWorld;
void main(){
  vec3 n = normalize(vNormalW);
  vec3 viewDir = normalize(cameraPosition - vWorld);
  // Back faces, so the normal points inward: flip it to measure the limb.
  float rim = pow(max(dot(-n, viewDir), 0.0), 2.4);
  float sunward = clamp(dot(-n, normalize(uSunDir)) * 0.5 + 0.65, 0.0, 1.0);
  gl_FragColor = vec4(uRim * rim * sunward, rim * 0.85);
}
`;

/** The land/sea mask only gates a specular term, so it can be far coarser than
 *  the atlas. A quarter on each axis is a sixteenth of the fill cost. */
const MASK_SCALE = 0.25;

/**
 * Paint the world into two canvases: an RGB atlas and a land/sea mask.
 *
 * Each country's outline is turned into a Path2D exactly once, in atlas pixel
 * space, and the mask reuses it under a uniform transform — building the paths
 * twice was the single most expensive thing in the boot path.
 *
 * @returns {{map: THREE.CanvasTexture, mask: THREE.CanvasTexture}}
 */
function paintAtlas(world, size, highlightA3) {
  const width = size;
  const height = size / 2;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false });

  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = Math.round(width * MASK_SCALE);
  maskCanvas.height = Math.round(height * MASK_SCALE);
  const maskCtx = maskCanvas.getContext('2d', { alpha: false });

  // ── Sea ────────────────────────────────────────────────────────────
  const sea = ctx.createLinearGradient(0, 0, 0, height);
  sea.addColorStop(0.00, '#04101d');
  sea.addColorStop(0.28, '#081e31');
  sea.addColorStop(0.50, '#0a2740');
  sea.addColorStop(0.72, '#081e31');
  sea.addColorStop(1.00, '#04101d');
  ctx.fillStyle = sea;
  ctx.fillRect(0, 0, width, height);

  maskCtx.fillStyle = '#000';
  maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
  maskCtx.save();

  // ── Graticule ─────────────────────────────────────────────────────
  ctx.lineWidth = Math.max(1, width / 2600);
  ctx.strokeStyle = 'rgba(126,186,232,.085)';
  ctx.beginPath();
  for (let lon = -180; lon <= 180; lon += 15) {
    const x = ((lon + 180) / 360) * width;
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
  }
  for (let lat = -75; lat <= 75; lat += 15) {
    const y = ((90 - lat) / 180) * height;
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
  }
  ctx.stroke();

  ctx.strokeStyle = 'rgba(126,186,232,.19)';
  ctx.beginPath();
  ctx.moveTo(0, height / 2);
  ctx.lineTo(width, height / 2);
  ctx.stroke();

  // ── Countries ─────────────────────────────────────────────────────
  const pathFor = (country) => {
    const path = new Path2D();
    for (const ring of country.rings) {
      path.moveTo(((ring[0] + 180) / 360) * width, ((90 - ring[1]) / 180) * height);
      for (let i = 2; i < ring.length; i += 2) {
        path.lineTo(((ring[i] + 180) / 360) * width, ((90 - ring[i + 1]) / 180) * height);
      }
      path.closePath();
    }
    return path;
  };

  // Both canvases are 2:1, so one uniform scale maps atlas space onto the mask.
  maskCtx.scale(MASK_SCALE, MASK_SCALE);
  maskCtx.fillStyle = '#fff';

  const stroke = Math.max(1, width / 2200);
  for (const country of world.countries) {
    const path = pathFor(country);
    const focus = country.a3 === highlightA3;

    ctx.fillStyle = focus ? '#3f7a72' : '#36567a';
    ctx.fill(path, 'evenodd');

    ctx.lineWidth = focus ? stroke * 1.5 : stroke * 1.15;
    ctx.strokeStyle = focus ? 'rgba(126,236,216,.7)' : 'rgba(163,205,242,.72)';
    ctx.stroke(path);

    maskCtx.fill(path, 'evenodd');
  }

  maskCtx.restore();

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  map.wrapS = THREE.RepeatWrapping;

  const mask = new THREE.CanvasTexture(maskCanvas);
  mask.colorSpace = THREE.NoColorSpace;
  mask.wrapS = THREE.RepeatWrapping;

  return { map, mask };
}

export function createGlobe(world, { sunDir, highlightA3 = 'IDN', textureSize = 4096 }) {
  const group = new THREE.Group();
  const { map, mask } = paintAtlas(world, textureSize, highlightA3);

  const material = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uMap: { value: map },
      uMask: { value: mask },
      uSunDir: { value: sunDir.clone().normalize() },
      uSunColor: { value: new THREE.Color('#ffe8cd') },
      uSkyColor: { value: new THREE.Color('#5b93d6') },
      uRim: { value: new THREE.Color('#3fa9d8') },
      uTime: { value: 0 },
    },
  });

  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(GLOBE_RADIUS, 160, 96),
    material
  );
  group.add(sphere);

  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(GLOBE_RADIUS * 1.035, 96, 64),
    new THREE.ShaderMaterial({
      vertexShader: ATMO_VERT,
      fragmentShader: ATMO_FRAG,
      uniforms: {
        uRim: { value: new THREE.Color('#4bc3ee') },
        uSunDir: { value: sunDir.clone().normalize() },
      },
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  group.add(atmosphere);

  return {
    group,
    sphere,
    material,
    update(dt, elapsed) {
      material.uniforms.uTime.value = elapsed;
    },
  };
}
