/**
 * The sea. A single large plane with analytic directional waves:
 * the vertex stage displaces gently so the surface has real parallax near the
 * camera, and the fragment stage rebuilds the wave gradient exactly so the
 * lighting stays crisp no matter how coarse the tessellation is.
 *
 * The land mask drives bathymetry — a turquoise shelf hugging every coastline,
 * fading to abyssal blue offshore — plus a foam line where the shelf meets land.
 */

import * as THREE from 'three';

const VERT = /* glsl */`
uniform float uTime;
varying vec3 vWorld;

// Four crossing swells. Keep in sync with waveField() in the fragment stage.
float swell(vec2 p, vec2 dir, float freq, float speed, float t){
  return sin(dot(p, dir) * freq + t * speed);
}

float heightAt(vec2 p, float t){
  float h  = swell(p, vec2( 0.94,  0.34), 0.085, 0.85, t) * 0.55;
  h += swell(p, vec2(-0.42,  0.91), 0.147, 1.15, t) * 0.32;
  h += swell(p, vec2( 0.71, -0.70), 0.268, 1.55, t) * 0.16;
  h += swell(p, vec2(-0.98, -0.21), 0.455, 2.25, t) * 0.08;
  return h;
}

void main(){
  vec4 world = modelMatrix * vec4(position, 1.0);
  world.y += heightAt(world.xz, uTime) * 0.42;
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const FRAG = /* glsl */`
precision highp float;

uniform float uTime;
uniform sampler2D uMask;
uniform vec2  uMaskMin;
uniform vec2  uMaskSize;
uniform vec3  uSunDir;
uniform vec3  uCamPos;
uniform vec3  uDeep;
uniform vec3  uMid;
uniform vec3  uShelf;
uniform vec3  uHorizon;
uniform float uGraticule;
uniform float uQuality;
uniform float uFogDensity;

varying vec3 vWorld;

float swell(vec2 p, vec2 dir, float freq, float speed, float t){
  return sin(dot(p, dir) * freq + t * speed);
}

// Height plus its analytic gradient, so normals stay exact at any tessellation.
// The last two octaves are skipped when the renderer is under pressure.
vec3 waveField(vec2 p, float t){
  vec2  d0 = vec2( 0.94,  0.34); float f0 = 0.085, s0 = 0.85, a0 = 0.55;
  vec2  d1 = vec2(-0.42,  0.91); float f1 = 0.147, s1 = 1.15, a1 = 0.32;
  vec2  d2 = vec2( 0.71, -0.70); float f2 = 0.268, s2 = 1.55, a2 = 0.16;

  float h = a0*sin(dot(p,d0)*f0 + t*s0) + a1*sin(dot(p,d1)*f1 + t*s1)
          + a2*sin(dot(p,d2)*f2 + t*s2);
  vec2  g = a0*f0*cos(dot(p,d0)*f0 + t*s0)*d0 + a1*f1*cos(dot(p,d1)*f1 + t*s1)*d1
          + a2*f2*cos(dot(p,d2)*f2 + t*s2)*d2;

  if (uQuality > 0.25) {
    vec2 d3 = vec2(-0.98, -0.21); float f3 = 0.455, s3 = 2.25, a3 = 0.08;
    vec2 d4 = vec2( 0.31,  0.95); float f4 = 0.930, s4 = 3.10, a4 = 0.035;
    h += a3*sin(dot(p,d3)*f3 + t*s3) + a4*sin(dot(p,d4)*f4 + t*s4);
    g += a3*f3*cos(dot(p,d3)*f3 + t*s3)*d3 + a4*f4*cos(dot(p,d4)*f4 + t*s4)*d4;
  }

  return vec3(h, g);
}

void main(){
  vec2 uv = (vWorld.xz - uMaskMin) / uMaskSize;
  vec3 mask = vec3(0.0);
  if (uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0) mask = texture2D(uMask, uv).rgb;

  float dist = length(vWorld - uCamPos);

  // Waves flatten with distance so the horizon does not shimmer into noise.
  float detail = 1.0 - smoothstep(40.0, 320.0, dist);
  vec3 field = waveField(vWorld.xz, uTime);
  vec3 normal = normalize(vec3(-field.y * detail * 2.6, 1.0, -field.z * detail * 2.6));

  vec3 viewDir = normalize(uCamPos - vWorld);
  vec3 sun = normalize(uSunDir);

  // Bathymetry: abyss -> mid ocean -> turquoise shelf near the coast.
  float shelf = smoothstep(0.12, 0.95, mask.g);
  float haze  = smoothstep(0.04, 0.62, mask.b);
  vec3 water = mix(uDeep, uMid, haze * 0.62);
  water = mix(water, uShelf, shelf * 0.72);

  // Subsurface glow — light scattering up through wave crests.
  float crest = smoothstep(-0.15, 0.75, field.x);
  water += uShelf * crest * (0.05 + shelf * 0.18);

  // Sun specular + broad sky sheen.
  vec3 half3 = normalize(sun + viewDir);
  float spec = pow(max(dot(normal, half3), 0.0), 340.0) * 2.4;
  float sheen = pow(max(dot(normal, half3), 0.0), 22.0) * 0.10;
  float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 4.5);

  vec3 color = water;
  color += vec3(1.0, 0.86, 0.66) * spec * detail;
  color += vec3(0.55, 0.78, 1.0) * sheen;
  color = mix(color, uHorizon * 1.35, fresnel * 0.55);

  // Foam where the shelf runs up against land.
  float foamBand = smoothstep(0.62, 0.97, mask.g) * (1.0 - smoothstep(0.15, 0.7, mask.r));
  float foamWave = smoothstep(0.15, 0.7, field.x + 0.35 * sin(uTime * 1.6 + vWorld.x * 0.5 + vWorld.z * 0.4));
  color = mix(color, vec3(0.80, 0.92, 1.0), foamBand * foamWave * 0.40 * detail);

  // Faint 5-degree graticule, purely cartographic garnish.
  if (uGraticule > 0.001) {
    vec2 grid = abs(fract(vWorld.xz / 10.9125 + 0.5) - 0.5) / fwidth(vWorld.xz / 10.9125);
    float line = 1.0 - min(min(grid.x, grid.y), 1.0);
    color += vec3(0.20, 0.46, 0.62) * line * uGraticule * (1.0 - smoothstep(45.0, 190.0, dist));
  }

  // Distance fade into the sky. Matches THREE.FogExp2 on the land, a touch
  // stronger so the sea reaches the horizon colour slightly sooner.
  float fogAmount = 1.0 - exp(-pow(dist * uFogDensity * 1.15, 2.0));
  color = mix(color, uHorizon, clamp(fogAmount, 0.0, 1.0));

  gl_FragColor = vec4(color, 1.0);
}
`;

export function createOcean({ maskTexture, bounds, worldW, worldH, horizon }) {
  const geometry = new THREE.PlaneGeometry(900, 900, 150, 150);
  geometry.rotateX(-Math.PI / 2);

  const material = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uTime: { value: 0 },
      uMask: { value: maskTexture },
      uMaskMin: { value: new THREE.Vector2(bounds.minX, bounds.minZ) },
      uMaskSize: { value: new THREE.Vector2(worldW, worldH) },
      uSunDir: { value: new THREE.Vector3(-58, 62, 44).normalize() },
      uCamPos: { value: new THREE.Vector3() },
      uDeep: { value: new THREE.Color('#020813') },
      uMid: { value: new THREE.Color('#07253f') },
      uShelf: { value: new THREE.Color('#14606e') },
      uHorizon: { value: horizon.clone() },
      uGraticule: { value: 0.09 },
      uQuality: { value: 1 },
      uFogDensity: { value: 0.0044 },
    },
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = -0.02;
  mesh.renderOrder = -1;
  mesh.frustumCulled = false;

  return {
    mesh,
    setFogDensity(value) {
      material.uniforms.uFogDensity.value = value;
    },
    setQuality(quality) {
      material.uniforms.uQuality.value = quality.index >= 2 ? 1 : quality.index >= 1 ? 0.5 : 0;
      material.uniforms.uGraticule.value = quality.index >= 1 ? 0.09 : 0;
    },
    update(dt, elapsed, camera) {
      material.uniforms.uTime.value = elapsed;
      material.uniforms.uCamPos.value.copy(camera.position);
    },
  };
}
