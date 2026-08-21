/**
 * Everything written on top of the globe: province pills that ride the crown of
 * their column, and country names lying on the sphere.
 *
 * Both kinds are culled the same way — a label is only drawn if its own
 * outward normal still points at the camera, which is exactly the horizon test.
 * Provinces are placed first and countries fill in around them, so an
 * Indonesian label never loses a fight with "Malaysia".
 */

import * as THREE from 'three';
import { CHIP_BASE, GLOBE_RADIUS } from '../util/geo.js';

const MAX_PROVINCES = 5;
const MAX_COUNTRIES = 22;

// Indonesia's neighbours stay on the map at any zoom even when their Natural
// Earth label rank would drop them — they are the context that makes the
// archipelago's position legible.
const NEIGHBOURS = new Set([
  'MYS', 'SGP', 'BRN', 'PHL', 'TLS', 'PNG', 'AUS', 'THA', 'VNM', 'KHM', 'IND',
]);
const AVOID = ['#railLeft', '#railRight', '.dock', '#detail', '.brand', '.topright'];

/** Country label ranks worth showing, by how far the camera is standing back. */
function rankCeiling(distance) {
  const zoom = distance / GLOBE_RADIUS;
  if (zoom > 3.0) return 2;
  if (zoom > 2.2) return 3;
  return 4;
}

export function createLabels(container, { focusA3 = null } = {}) {
  const layer = document.createElement('div');
  layer.className = 'labels';
  layer.setAttribute('aria-hidden', 'true');
  container.append(layer);

  const provincePool = [];
  const countryPool = [];
  let provinces = [];
  let countries = [];

  const world = new THREE.Vector3();
  const toCamera = new THREE.Vector3();
  const projected = new THREE.Vector3();

  let avoidRects = [];
  let boundsAt = 0;
  // Measured on a clock rather than a frame count: on a slow device a
  // frame-counted refresh would leave the panels unguarded for many seconds,
  // and a panel that has not been laid out yet measures as a zero rect.
  function refreshBounds() {
    boundsAt = performance.now();
    avoidRects = AVOID
      .map((sel) => document.querySelector(sel))
      .filter((el) => el && !el.hidden)
      .map((el) => el.getBoundingClientRect())
      .filter((r) => r.width > 1 && r.height > 1);
  }
  addEventListener('resize', () => { boundsAt = 0; });

  function grow(pool, className, html, limit) {
    while (pool.length < limit) {
      const node = document.createElement('div');
      node.className = className;
      node.innerHTML = html;
      node.style.opacity = '0';
      layer.append(node);
      pool.push(node);
    }
  }
  grow(provincePool, 'label', '<span class="label__dot"></span><span class="label__txt"></span>', MAX_PROVINCES);
  grow(countryPool, 'label label--country', '<span class="label__txt"></span>', MAX_COUNTRIES);

  /** @param {{unit:object, text:string, color:string}[]} entries */
  function setProvinces(entries) {
    provinces = entries.slice(0, MAX_PROVINCES);
    provincePool.forEach((node, i) => {
      const entry = provinces[i];
      if (!entry) { node.style.display = 'none'; return; }
      node.style.display = '';
      node.querySelector('.label__txt').textContent = entry.text;
      node.querySelector('.label__dot').style.background = entry.color;
    });
  }

  /** @param {{dir:THREE.Vector3, name:string, rank:number}[]} entries */
  function setCountries(entries) {
    countries = entries;
  }

  const overlapsPanel = (box) =>
    avoidRects.some((r) =>
      box.right > r.left - 8 && box.left < r.right + 8 &&
      box.bottom > r.top - 8 && box.top < r.bottom + 8);

  const overlapsPlaced = (box, placed) =>
    placed.some((p) =>
      box.right > p.left - 4 && box.left < p.right + 4 &&
      box.bottom > p.top - 2 && box.top < p.bottom + 2);

  function place(node, dir, radius, cameraPos, camera, fadeStart) {
    world.copy(dir).multiplyScalar(radius);
    toCamera.copy(cameraPos).sub(world).normalize();
    // The label's own surface normal has to still face the camera; below the
    // horizon it does not, and the label belongs on the far side of the globe.
    const facing = dir.dot(toCamera);
    if (facing <= fadeStart) return null;

    projected.copy(world).project(camera);
    if (projected.z > 1) return null;

    const px = (projected.x * 0.5 + 0.5) * innerWidth;
    const py = (-projected.y * 0.5 + 0.5) * innerHeight;
    const w = node.offsetWidth || 80;
    const h = node.offsetHeight || 18;
    return {
      px, py, facing,
      box: { left: px - w / 2, right: px + w / 2, top: py - h, bottom: py },
    };
  }

  function update(camera) {
    if (performance.now() - boundsAt > 250) refreshBounds();

    const cameraPos = camera.position;
    const placed = [];

    // ── Provinces ─────────────────────────────────────────────────
    const slots = [];
    const provinceBudget = innerWidth < 560 ? 3 : innerWidth < 900 ? 4 : MAX_PROVINCES;
    for (let i = 0; i < Math.min(provinces.length, provinceBudget); i++) {
      const node = provincePool[i];
      const { unit } = provinces[i];
      const spot = place(node, unit.dir, CHIP_BASE + unit.height + 1.2, cameraPos, camera, 0.02);
      const offscreen = spot && (
        spot.box.left < 6 || spot.box.right > innerWidth - 6 ||
        spot.py < 26 || spot.py > innerHeight - 20
      );
      if (!spot || offscreen || overlapsPanel(spot.box)) { node.style.opacity = '0'; continue; }
      slots.push({ node, ...spot });
    }

    // Nudge a dense cluster like Java apart instead of dropping half of it.
    slots.sort((a, b) => a.py - b.py);
    for (let i = slots.length - 1; i > 0; i--) {
      const gap = slots[i].py - slots[i - 1].py;
      if (gap < 26) {
        const shift = 26 - gap;
        slots[i - 1].py -= shift;
        slots[i - 1].box.top -= shift;
        slots[i - 1].box.bottom -= shift;
      }
    }
    for (const slot of slots) {
      if (slot.py < 26 || overlapsPanel(slot.box)) { slot.node.style.opacity = '0'; continue; }
      slot.node.style.opacity = String(Math.min(1, slot.facing * 5));
      slot.node.style.transform =
        `translate3d(${slot.px.toFixed(1)}px,${slot.py.toFixed(1)}px,0) translate(-50%,-100%)`;
      placed.push(slot.box);
    }

    // ── Countries ─────────────────────────────────────────────────
    const zoom = cameraPos.length() / GLOBE_RADIUS;
    const ceiling = rankCeiling(cameraPos.length());
    // A phone has room for a handful of names, not two dozen.
    const budget = innerWidth < 560 ? 9 : innerWidth < 900 ? 14 : MAX_COUNTRIES;
    let used = 0;
    for (const node of countryPool) node.style.opacity = '0';

    for (const country of countries) {
      if (used >= budget) break;
      if (country.rank > ceiling && !NEIGHBOURS.has(country.a3)) continue;
      // Close in, the province pills say "Indonesia" far better than one label
      // floating over the middle of the archipelago.
      if (country.a3 === focusA3 && zoom < 2.5) continue;

      const node = countryPool[used];
      node.querySelector('.label__txt').textContent = country.name;
      const spot = place(node, country.dir, GLOBE_RADIUS + 0.8, cameraPos, camera, 0.10);
      if (!spot) continue;

      // Re-measure once the text is in, then fight for the space.
      const w = node.offsetWidth || 80;
      const h = node.offsetHeight || 14;
      const box = { left: spot.px - w / 2, right: spot.px + w / 2, top: spot.py - h / 2, bottom: spot.py + h / 2 };
      if (box.left < 6 || box.right > innerWidth - 6 || box.top < 6 || box.bottom > innerHeight - 6) continue;
      if (overlapsPanel(box) || overlapsPlaced(box, placed)) continue;

      node.style.opacity = String(Math.min(0.92, (spot.facing - 0.1) * 3.4));
      node.style.transform =
        `translate3d(${spot.px.toFixed(1)}px,${spot.py.toFixed(1)}px,0) translate(-50%,-50%)`;
      placed.push(box);
      used += 1;
    }
  }

  return { setProvinces, setCountries, update, layer };
}
