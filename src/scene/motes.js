/**
 * Population motes — one drifting speck of light per ~45,000 people, scattered
 * uniformly inside the actual province polygons and suspended through the
 * volume of that province's column.
 *
 * Sampling is area-weighted over the triangulated polygons (not rejection
 * sampling in a bounding box), which matters for a country like this: Kepulauan
 * Riau is 147 islets in an ocean-sized bbox and would otherwise be starved.
 *
 * Column heights and colours live in small uniform arrays indexed per-particle,
 * so the whole field animates with 34 uniform writes per frame instead of a
 * buffer upload.
 */

import * as THREE from 'three';

const PEOPLE_PER_MOTE = 45000;
const MAX_PER_PROVINCE = 1400;
const MAX_UNITS = 40;

const VERT = /* glsl */`
attribute float aProv;
attribute float aLevel;    // 0..1 position through the column
attribute float aPhase;
attribute float aSize;

uniform float uTime;
uniform float uHeights[${MAX_UNITS}];
uniform vec3  uColors[${MAX_UNITS}];
uniform float uViewHeight;   // drawing-buffer height, in device pixels

varying vec3 vTint;
varying float vAlpha;

void main(){
  int idx = int(aProv);
  float top = uHeights[idx];
  vTint = uColors[idx];

  vec3 pos = position;
  pos.y = top * (0.06 + aLevel * 0.97) + sin(uTime * 0.55 + aPhase) * 0.16;

  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  float dist = -mv.z;

  // Twinkle, plus a fade so distant motes never turn the horizon into mush.
  vAlpha = (0.35 + 0.65 * pow(0.5 + 0.5 * sin(uTime * 1.7 + aPhase * 2.3), 2.0))
         * (1.0 - smoothstep(90.0, 320.0, dist));

  // Perspective-correct size: a mote is a fixed object of ~0.3 world units,
  // so it has to be sized against the projection, not a magic constant.
  float worldSize = aSize * 0.34;
  gl_PointSize = clamp(
    worldSize * uViewHeight * projectionMatrix[1][1] * 0.5 / max(dist, 1.0),
    1.0, 16.0
  );
  gl_Position = projectionMatrix * mv;
}
`;

const FRAG = /* glsl */`
precision mediump float;
varying vec3 vTint;
varying float vAlpha;
void main(){
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  float core = smoothstep(0.5, 0.02, d);
  gl_FragColor = vec4(vTint, core * core * vAlpha * 0.85);
}
`;

/** Uniform area-weighted sample points inside one province's polygons. */
function samplePoints(record, count) {
  const triangles = [];
  let totalArea = 0;

  for (const poly of record.polys) {
    const contour = [];
    for (let i = 0; i < poly.o.length; i += 2) {
      contour.push(new THREE.Vector2(poly.o[i], poly.o[i + 1]));
    }
    const holes = (poly.h || []).map((ring) => {
      const pts = [];
      for (let i = 0; i < ring.length; i += 2) pts.push(new THREE.Vector2(ring[i], ring[i + 1]));
      return pts;
    });

    let faces;
    try {
      faces = THREE.ShapeUtils.triangulateShape(contour, holes);
    } catch {
      continue;
    }
    const verts = contour.concat(...holes);
    for (const [a, b, c] of faces) {
      const A = verts[a], B = verts[b], C = verts[c];
      if (!A || !B || !C) continue;
      const area = Math.abs((B.x - A.x) * (C.y - A.y) - (C.x - A.x) * (B.y - A.y)) * 0.5;
      if (area <= 0) continue;
      totalArea += area;
      triangles.push({ A, B, C, cum: totalArea });
    }
  }

  const out = [];
  if (!triangles.length || totalArea <= 0) {
    for (let i = 0; i < count; i++) out.push([record.centroid[0], record.centroid[1]]);
    return out;
  }

  for (let i = 0; i < count; i++) {
    const target = Math.random() * totalArea;
    // Binary search the cumulative-area table.
    let lo = 0, hi = triangles.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (triangles[mid].cum < target) lo = mid + 1; else hi = mid;
    }
    const { A, B, C } = triangles[lo];
    let u = Math.random(), v = Math.random();
    if (u + v > 1) { u = 1 - u; v = 1 - v; }
    out.push([
      A.x + (B.x - A.x) * u + (C.x - A.x) * v,
      A.y + (B.y - A.y) * u + (C.y - A.y) * v,
    ]);
  }
  return out;
}

export function createMotes(geo, units, provinceData) {
  const indexOf = new Map(units.map((u, i) => [u.id, i]));
  const geoById = new Map(geo.provinces.map((p) => [p.id, p]));

  const positions = [];
  const provIdx = [];
  const levels = [];
  const phases = [];
  const sizes = [];

  for (const unit of units) {
    const record = geoById.get(unit.id);
    const stats = provinceData.get(unit.id);
    if (!record || !stats) continue;

    const count = Math.min(
      MAX_PER_PROVINCE,
      Math.max(6, Math.round(stats.population / PEOPLE_PER_MOTE))
    );
    const pts = samplePoints(record, count);
    const idx = indexOf.get(unit.id);

    for (const [x, z] of pts) {
      positions.push(x, 0, z);
      provIdx.push(idx);
      // Bias motes toward the lower half so columns read as filled, not hollow.
      levels.push(Math.pow(Math.random(), 1.35));
      phases.push(Math.random() * Math.PI * 2);
      sizes.push(0.55 + Math.random() * 0.9);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('aProv', new THREE.Float32BufferAttribute(provIdx, 1));
  geometry.setAttribute('aLevel', new THREE.Float32BufferAttribute(levels, 1));
  geometry.setAttribute('aPhase', new THREE.Float32BufferAttribute(phases, 1));
  geometry.setAttribute('aSize', new THREE.Float32BufferAttribute(sizes, 1));

  const heights = new Float32Array(MAX_UNITS);
  const colors = Array.from({ length: MAX_UNITS }, () => new THREE.Vector3(1, 1, 1));

  const material = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uTime: { value: 0 },
      uHeights: { value: heights },
      uColors: { value: colors },
      uViewHeight: { value: innerHeight * Math.min(devicePixelRatio, 2) },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;

  return {
    points,
    count: provIdx.length,
    update(dt, elapsed, drawingBufferHeight) {
      material.uniforms.uTime.value = elapsed;
      if (drawingBufferHeight) material.uniforms.uViewHeight.value = drawingBufferHeight;
      for (let i = 0; i < units.length; i++) {
        heights[i] = units[i].height;
        const c = units[i].color;
        // Push toward white a touch — motes should glow, not just tint.
        colors[i].set(c.r * 0.55 + 0.45, c.g * 0.55 + 0.45, c.b * 0.55 + 0.45);
      }
    },
  };
}
