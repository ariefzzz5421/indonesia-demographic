/**
 * The extruded province map.
 *
 * Each of the 34 map units becomes one `ExtrudeGeometry` built from all of its
 * polygons (Kepulauan Riau alone contributes 147 islets). Geometry is extruded
 * to a depth of exactly 1 and then driven purely through `scale.z`, so changing
 * metric or year is a cheap transform animation rather than a rebuild.
 *
 * Motion is a critically damped spring per province with a west-to-east
 * stagger, which makes a metric change read as a wave rolling across the
 * archipelago instead of everything snapping at once.
 *
 * The shader patch below deliberately introduces no custom uniforms: highlight
 * state rides on the stock `emissive` / `emissiveIntensity` uniforms so all 34
 * materials can safely share a single compiled program.
 */

import * as THREE from 'three';
import { ramp, lift } from '../util/color.js';
import { damp, lerpDamp } from '../util/tween.js';

export const BASE_HEIGHT = 0.5;    // always-visible land slab
export const COLUMN_RANGE = 11.5;  // extra height at the top of the scale

const COLUMN_FRAG_PATCH = /* glsl */`
  #include <emissivemap_fragment>

  float hN = clamp(vHeight, 0.0, 1.0);
  bool onTop = hN > 0.995;

  // Sea level is deep and desaturated; the crown carries the full metric colour.
  diffuseColor.rgb *= mix(0.32, 1.0, pow(hN, 0.6));

  // Six contour bands make column height readable without reading the axis.
  if (!onTop) {
    float band = abs(fract(hN * 6.0 - 0.02) - 0.5) * 2.0;
    diffuseColor.rgb *= 1.0 - (1.0 - smoothstep(0.0, 0.26, band)) * 0.17;
  }

  // Glowing rim along the crown — this is what the bloom pass picks up.
  totalEmissiveRadiance += diffuseColor.rgb * smoothstep(0.87, 1.0, hN) * 0.95;
`;

function patchColumnShader(shader) {
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying float vHeight;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvHeight = position.z;');
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\nvarying float vHeight;')
    .replace('#include <emissivemap_fragment>', COLUMN_FRAG_PATCH);
}

export function createProvinces(geo) {
  const group = new THREE.Group();
  const units = [];
  const byId = new Map();

  // Sort west-to-east so the stagger sweeps with the sunrise.
  const ordered = [...geo.provinces].sort((a, b) => a.centroid[0] - b.centroid[0]);
  const spanX = geo.bbox[2] - geo.bbox[0];

  for (const record of ordered) {
    const shapes = [];

    for (const poly of record.polys) {
      const shape = new THREE.Shape();
      const outer = poly.o;
      // Shape space is XY; the mesh is rotated -90deg about X afterwards, so
      // shape.y must carry -z for world Z to come out the right way round.
      shape.moveTo(outer[0], -outer[1]);
      for (let i = 2; i < outer.length; i += 2) shape.lineTo(outer[i], -outer[i + 1]);
      shape.closePath();

      if (poly.h) {
        for (const ring of poly.h) {
          const hole = new THREE.Path();
          hole.moveTo(ring[0], -ring[1]);
          for (let i = 2; i < ring.length; i += 2) hole.lineTo(ring[i], -ring[i + 1]);
          hole.closePath();
          shape.holes.push(hole);
        }
      }
      shapes.push(shape);
    }

    const geometry = new THREE.ExtrudeGeometry(shapes, {
      depth: 1,
      bevelEnabled: false,
      curveSegments: 1,
      steps: 1,
    });

    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#263f60'),
      roughness: 0.52,
      metalness: 0.06,
      emissive: new THREE.Color('#000000'),
      emissiveIntensity: 0,
    });
    material.onBeforeCompile = patchColumnShader;
    material.customProgramCacheKey = () => 'nusantara-column';

    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.scale.z = BASE_HEIGHT;

    // Glowing outline sitting on the crown of the column.
    const linePoints = [];
    for (const poly of record.polys) {
      for (const ring of [poly.o, ...(poly.h || [])]) {
        const n = ring.length / 2;
        if (n < 3) continue;
        for (let i = 0; i < n; i++) {
          const j = (i + 1) % n;
          linePoints.push(ring[i * 2], -ring[i * 2 + 1], 1.0);
          linePoints.push(ring[j * 2], -ring[j * 2 + 1], 1.0);
        }
      }
    }
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePoints, 3));
    const lineMat = new THREE.LineBasicMaterial({
      color: new THREE.Color('#7fd8ff'),
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const outline = new THREE.LineSegments(lineGeo, lineMat);
    outline.raycast = () => {};   // lines must never block province picking
    mesh.add(outline);

    const unit = {
      id: record.id,
      name: record.name,
      island: record.island,
      centroid: new THREE.Vector3(record.centroid[0], 0, record.centroid[1]),
      bbox: record.bbox,
      mesh,
      material,
      lineMat,
      height: BASE_HEIGHT,
      targetHeight: BASE_HEIGHT,
      vel: [0],
      delay: 0,
      sinceApply: 99,
      norm: 0,
      color: new THREE.Color('#263f60'),
      targetColor: new THREE.Color('#263f60'),
      rim: 0,
      targetRim: 0,
      // 0 at the far west (Aceh) through 1 at the far east (Papua)
      sweep: (record.centroid[0] - geo.bbox[0]) / spanX,
    };

    mesh.userData.unit = unit;
    units.push(unit);
    byId.set(record.id, unit);
    group.add(mesh);
  }

  const pickables = units.map((u) => u.mesh);
  let hoveredId = null;
  let selectedId = null;

  /**
   * Point the whole map at a new slice.
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
      unit.targetHeight = BASE_HEIGHT + t * COLUMN_RANGE;
      // Keep the darkest end of the ramp off the map: the smallest province
      // still has to read as land, not as a hole in the sea.
      unit.targetColor.setRGB(...ramp(rampName, 0.17 + t * 0.83), THREE.SRGBColorSpace);
      unit.delay = unit.sweep * 0.38;
      unit.sinceApply = 0;
    }
  }

  function refreshEmphasis() {
    for (const unit of units) {
      unit.targetRim = unit.id === selectedId ? 0.9 : unit.id === hoveredId ? 0.5 : 0;
    }
  }

  const setHover = (id) => { hoveredId = id; refreshEmphasis(); };
  const setSelected = (id) => { selectedId = id; refreshEmphasis(); };

  function update(dt, elapsed) {
    for (const unit of units) {
      unit.sinceApply += dt;
      if (unit.sinceApply >= unit.delay) {
        unit.height = damp(unit.height, unit.targetHeight, 0.55, dt, unit.vel);
        unit.mesh.scale.z = unit.height;
      }

      unit.color.lerp(unit.targetColor, 1 - Math.exp(-5.5 * dt));
      unit.material.color.copy(unit.color);

      // Selection breathes; hover holds steady.
      const pulse = unit.id === selectedId ? 0.16 * (0.5 + 0.5 * Math.sin(elapsed * 3.4)) : 0;
      unit.rim = lerpDamp(unit.rim, unit.targetRim + pulse, 9, dt);
      unit.material.emissive.copy(unit.color);
      unit.material.emissiveIntensity = unit.rim * 0.55;

      const [lr, lg, lb] = lift([unit.color.r, unit.color.g, unit.color.b], 0.42);
      unit.lineMat.color.setRGB(lr, lg, lb);
      unit.lineMat.opacity = 0.16 + unit.rim * 0.6 + unit.norm * 0.3;
    }
  }

  return {
    group, units, byId, pickables,
    apply, setHover, setSelected, update,
    colorOf: (id) => byId.get(id)?.color,
    heightOf: (id) => byId.get(id)?.height ?? BASE_HEIGHT,
  };
}
