/**
 * The 34 Indonesian province chips, extruded radially off the globe.
 *
 * Geometry is built once in a form that never has to be rebuilt: every vertex
 * stores its unit direction from the globe's centre and a level of 0 (sitting
 * on the base) or 1 (on the crown). The vertex shader then places it at
 * `dir * (base + level * height)`, so a metric or year change is one uniform
 * write per province.
 *
 * `position` deliberately stays at the un-extruded footprint on the sphere.
 * The raycaster reads that attribute, which means clicking picks the province's
 * actual territory rather than wherever its column happens to lean — and
 * because these are the only meshes in the pick list, Indonesia is the only
 * thing on the globe that responds to a click.
 */

import * as THREE from 'three';
import { CHIP_BASE, lonLatToDir } from '../util/geo.js';
import { ramp, lift } from '../util/color.js';
import { damp, lerpDamp } from '../util/tween.js';

export const BASE_LIFT = 0.35;    // always-visible thickness above the sphere
export const COLUMN_RANGE = 13.0; // extra height at the top of the scale

const CHIP_VERT = /* glsl */`
attribute vec3 aDir;
attribute float aLevel;

uniform float uBase;
uniform float uHeight;

varying float vLevel;
varying vec3 vNormalW;
varying vec3 vWorld;

void main(){
  vLevel = aLevel;
  vec3 pos = aDir * (uBase + aLevel * uHeight);
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vec4 world = modelMatrix * vec4(pos, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const CHIP_FRAG = /* glsl */`
precision highp float;

uniform vec3 uColor;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uSkyColor;
uniform float uRim;

varying float vLevel;
varying vec3 vNormalW;
varying vec3 vWorld;

void main(){
  float hN = clamp(vLevel, 0.0, 1.0);
  bool onTop = hN > 0.995;

  // Sea level is deep and desaturated; the crown carries the full metric colour.
  vec3 base = uColor * mix(0.30, 1.0, pow(hN, 0.6));

  // Six contour bands make column height readable without reading the legend.
  if (!onTop) {
    float band = abs(fract(hN * 6.0 - 0.02) - 0.5) * 2.0;
    base *= 1.0 - (1.0 - smoothstep(0.0, 0.26, band)) * 0.20;
  }

  vec3 n = normalize(vNormalW);
  if (!gl_FrontFacing) n = -n;

  vec3 sun = normalize(uSunDir);
  vec3 viewDir = normalize(cameraPosition - vWorld);

  float lambert = clamp((dot(n, sun) + 0.5) / 1.5, 0.0, 1.0);
  vec3 color = base * (uSunColor * (0.40 + 0.72 * lambert) + uSkyColor * 0.20);

  // Glowing crown — this is what the bloom pass picks up.
  color += base * smoothstep(0.86, 1.0, hN) * 0.85;
  // Hover and selection lift the whole chip.
  color += base * uRim * 0.75;

  float fresnel = pow(1.0 - max(dot(n, viewDir), 0.0), 3.0);
  color += uSkyColor * fresnel * 0.12;

  gl_FragColor = vec4(color, 1.0);
}
`;

const OUTLINE_VERT = /* glsl */`
attribute vec3 aDir;
uniform float uBase;
uniform float uHeight;
void main(){
  vec3 pos = aDir * (uBase + uHeight);
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(pos, 1.0);
}
`;

const OUTLINE_FRAG = /* glsl */`
precision mediump float;
uniform vec3 uColor;
uniform float uOpacity;
void main(){ gl_FragColor = vec4(uColor, uOpacity); }
`;

/** Turn one province's lon/lat rings into a radially extrudable chip. */
function buildChipGeometry(record) {
  const positions = [];
  const dirs = [];
  const levels = [];
  const normals = [];
  const indices = [];

  const dir = new THREE.Vector3();
  const dirB = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  const wallNormal = new THREE.Vector3();

  const pushVertex = (d, level, normal) => {
    positions.push(d.x * CHIP_BASE, d.y * CHIP_BASE, d.z * CHIP_BASE);
    dirs.push(d.x, d.y, d.z);
    levels.push(level);
    normals.push(normal.x, normal.y, normal.z);
    return positions.length / 3 - 1;
  };

  for (const poly of record.polys) {
    // ── Crown ──────────────────────────────────────────────────────
    // Triangulated in lon/lat. Viewed from outside the globe, east runs right
    // and north runs up, so counter-clockwise there is counter-clockwise here
    // and the winding comes out facing the camera.
    const contour = [];
    for (let i = 0; i < poly.o.length; i += 2) {
      contour.push(new THREE.Vector2(poly.o[i], poly.o[i + 1]));
    }
    const holes = (poly.h || []).map((ring) => {
      const pts = [];
      for (let i = 0; i < ring.length; i += 2) pts.push(new THREE.Vector2(ring[i], ring[i + 1]));
      return pts;
    });

    let faces = [];
    try {
      faces = THREE.ShapeUtils.triangulateShape(contour, holes);
    } catch {
      faces = [];
    }

    const flatVerts = contour.concat(...holes);
    const offset = positions.length / 3;
    for (const v of flatVerts) {
      lonLatToDir(v.x, v.y, dir);
      pushVertex(dir, 1, dir);   // crown normal is simply the radial direction
    }
    for (const [a, b, c] of faces) {
      indices.push(offset + a, offset + b, offset + c);
    }

    // ── Walls ──────────────────────────────────────────────────────
    for (const ring of [poly.o, ...(poly.h || [])]) {
      const n = ring.length / 2;
      if (n < 3) continue;
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        lonLatToDir(ring[i * 2], ring[i * 2 + 1], dir);
        lonLatToDir(ring[j * 2], ring[j * 2 + 1], dirB);

        // Outward is perpendicular to both the edge and the local up. For a
        // hole the ring runs the other way, which flips this automatically.
        tangent.copy(dirB).sub(dir);
        if (tangent.lengthSq() < 1e-12) continue;   // coincident ring points
        wallNormal.copy(tangent).cross(dir);
        if (wallNormal.lengthSq() < 1e-14) continue;
        wallNormal.normalize();

        const a0 = pushVertex(dir, 0, wallNormal);
        const b0 = pushVertex(dirB, 0, wallNormal);
        const b1 = pushVertex(dirB, 1, wallNormal);
        const a1 = pushVertex(dir, 1, wallNormal);
        indices.push(a0, b0, b1, a0, b1, a1);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('aDir', new THREE.Float32BufferAttribute(dirs, 3));
  geometry.setAttribute('aLevel', new THREE.Float32BufferAttribute(levels, 1));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setIndex(indices);

  // Positions describe the footprint; pad the bounds so a fully grown column
  // is never culled or missed by a ray.
  geometry.computeBoundingSphere();
  geometry.boundingSphere.radius += COLUMN_RANGE + 2;

  return geometry;
}

/** Outline running around the crown of every ring. */
function buildOutlineGeometry(record) {
  const positions = [];
  const dirs = [];
  const dir = new THREE.Vector3();

  for (const poly of record.polys) {
    for (const ring of [poly.o, ...(poly.h || [])]) {
      const n = ring.length / 2;
      if (n < 3) continue;
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        for (const k of [i, j]) {
          lonLatToDir(ring[k * 2], ring[k * 2 + 1], dir);
          positions.push(dir.x * CHIP_BASE, dir.y * CHIP_BASE, dir.z * CHIP_BASE);
          dirs.push(dir.x, dir.y, dir.z);
        }
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('aDir', new THREE.Float32BufferAttribute(dirs, 3));
  geometry.computeBoundingSphere();
  geometry.boundingSphere.radius += COLUMN_RANGE + 2;
  return geometry;
}

export function createProvinces(geo, { sunDir }) {
  const group = new THREE.Group();
  const units = [];
  const byId = new Map();

  // West to east, so a metric change sweeps across the archipelago.
  const ordered = [...geo.provinces].sort((a, b) => a.centroid[0] - b.centroid[0]);
  const spanLon = geo.bbox[2] - geo.bbox[0];

  for (const record of ordered) {
    const uHeight = { value: BASE_LIFT };
    const uBase = { value: CHIP_BASE };

    const material = new THREE.ShaderMaterial({
      vertexShader: CHIP_VERT,
      fragmentShader: CHIP_FRAG,
      side: THREE.DoubleSide,
      uniforms: {
        uBase,
        uHeight,
        uColor: { value: new THREE.Color('#26405f') },
        uRim: { value: 0 },
        uSunDir: { value: sunDir.clone().normalize() },
        uSunColor: { value: new THREE.Color('#ffe3c2') },
        uSkyColor: { value: new THREE.Color('#5f9ada') },
      },
    });

    const mesh = new THREE.Mesh(buildChipGeometry(record), material);
    mesh.renderOrder = 1;

    const outlineMat = new THREE.ShaderMaterial({
      vertexShader: OUTLINE_VERT,
      fragmentShader: OUTLINE_FRAG,
      uniforms: {
        uBase,
        uHeight,                                   // shared with the chip
        uColor: { value: new THREE.Color('#9fe8ff') },
        uOpacity: { value: 0.4 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const outline = new THREE.LineSegments(buildOutlineGeometry(record), outlineMat);
    outline.raycast = () => {};     // lines must never block province picking
    outline.renderOrder = 2;

    const unit = {
      id: record.id,
      name: record.name,
      island: record.island,
      lon: record.centroid[0],
      lat: record.centroid[1],
      dir: lonLatToDir(record.centroid[0], record.centroid[1], new THREE.Vector3()),
      bbox: record.bbox,
      mesh,
      outline,
      material,
      outlineMat,
      uHeight,
      height: BASE_LIFT,
      targetHeight: BASE_LIFT,
      vel: [0],
      delay: 0,
      sinceApply: 99,
      norm: 0,
      color: new THREE.Color('#26405f'),
      targetColor: new THREE.Color('#26405f'),
      rim: 0,
      targetRim: 0,
      sweep: (record.centroid[0] - geo.bbox[0]) / spanLon,
    };

    mesh.userData.unit = unit;
    units.push(unit);
    byId.set(record.id, unit);
    group.add(mesh, outline);
  }

  const pickables = units.map((u) => u.mesh);
  let hoveredId = null;
  let selectedId = null;

  /**
   * @param {string} rampName colour ramp for the active metric
   * @param {Map<string,number>} values province id -> raw value
   * @param {(v:number)=>number} norm raw value -> 0..1
   */
  function apply(rampName, values, norm) {
    for (const unit of units) {
      const value = values.get(unit.id);
      if (value === undefined) continue;
      const t = Math.min(1, Math.max(0, norm(value)));
      unit.norm = t;
      unit.targetHeight = BASE_LIFT + t * COLUMN_RANGE;
      // Keep the darkest end of the ramp off the globe: the smallest province
      // still has to read as land, not as a hole in the sea.
      unit.targetColor.setRGB(...ramp(rampName, 0.17 + t * 0.83), THREE.SRGBColorSpace);
      unit.delay = unit.sweep * 0.38;
      unit.sinceApply = 0;
    }
  }

  function refreshEmphasis() {
    for (const unit of units) {
      unit.targetRim = unit.id === selectedId ? 0.85 : unit.id === hoveredId ? 0.45 : 0;
    }
  }

  const setHover = (id) => { hoveredId = id; refreshEmphasis(); };
  const setSelected = (id) => { selectedId = id; refreshEmphasis(); };

  function update(dt, elapsed) {
    for (const unit of units) {
      unit.sinceApply += dt;
      if (unit.sinceApply >= unit.delay) {
        unit.height = damp(unit.height, unit.targetHeight, 0.55, dt, unit.vel);
        unit.uHeight.value = unit.height;
      }

      unit.color.lerp(unit.targetColor, 1 - Math.exp(-5.5 * dt));
      unit.material.uniforms.uColor.value.copy(unit.color);

      const pulse = unit.id === selectedId ? 0.16 * (0.5 + 0.5 * Math.sin(elapsed * 3.4)) : 0;
      unit.rim = lerpDamp(unit.rim, unit.targetRim + pulse, 9, dt);
      unit.material.uniforms.uRim.value = unit.rim;

      const [lr, lg, lb] = lift([unit.color.r, unit.color.g, unit.color.b], 0.45);
      unit.outlineMat.uniforms.uColor.value.setRGB(lr, lg, lb);
      unit.outlineMat.uniforms.uOpacity.value = 0.22 + unit.rim * 0.5 + unit.norm * 0.3;
    }
  }

  return {
    group, units, byId, pickables,
    apply, setHover, setSelected, update,
    colorOf: (id) => byId.get(id)?.color,
    heightOf: (id) => byId.get(id)?.height ?? BASE_LIFT,
  };
}
