/**
 * Floating labels for the leading provinces under the current metric.
 * Positions are projected from the crown of each column every frame, so labels
 * ride the columns as they grow and the camera moves.
 */

import * as THREE from 'three';
import { BASE_HEIGHT } from '../scene/provinces.js';

const SHOWN = 5;
const MIN_GAP = 26;                 // px of vertical breathing room between labels
const AVOID = ['#railLeft', '#railRight', '.dock', '#detail'];

export function createLabels(container) {
  const layer = document.createElement('div');
  layer.className = 'labels';
  layer.setAttribute('aria-hidden', 'true');
  container.append(layer);

  const pool = [];
  let assigned = [];
  const world = new THREE.Vector3();
  const placed = [];

  // Labels must not sit under the glass panels. Rects are cheap to read but
  // force layout, so refresh them a few times a second rather than per frame.
  let avoidRects = [];
  let sinceBounds = 99;
  function refreshBounds() {
    avoidRects = AVOID
      .map((sel) => document.querySelector(sel))
      .filter((el) => el && !el.hidden && getComputedStyle(el).display !== 'none')
      .map((el) => el.getBoundingClientRect());
  }
  addEventListener('resize', () => { sinceBounds = 99; });

  function ensure(n) {
    while (pool.length < n) {
      const node = document.createElement('div');
      node.className = 'label';
      node.innerHTML = '<span class="label__dot"></span><span class="label__txt"></span>';
      layer.append(node);
      pool.push(node);
    }
  }

  /** @param {{unit:object, text:string, color:string}[]} entries */
  function set(entries) {
    assigned = entries.slice(0, SHOWN);
    ensure(assigned.length);
    pool.forEach((node, i) => {
      const entry = assigned[i];
      if (!entry) { node.style.display = 'none'; return; }
      node.style.display = '';
      node.querySelector('.label__txt').textContent = entry.text;
      node.querySelector('.label__dot').style.background = entry.color;
    });
  }

  // The anchor is the label's bottom-centre, so collision has to account for
  // its measured width or labels clip into the glass panels.
  const overlaps = (x, y, halfWidth, r) =>
    x + halfWidth > r.left - 10 && x - halfWidth < r.right + 10 &&
    y > r.top - 24 && y - 22 < r.bottom + 6;

  function update(camera) {
    if (!assigned.length) return;
    if (++sinceBounds > 20) { sinceBounds = 0; refreshBounds(); }

    const w = innerWidth;
    const h = innerHeight;
    placed.length = 0;

    for (let i = 0; i < assigned.length; i++) {
      const { unit } = assigned[i];
      world.set(unit.centroid.x, Math.max(unit.height, BASE_HEIGHT) + 0.7, unit.centroid.z);
      world.project(camera);

      const px = (world.x * 0.5 + 0.5) * w;
      const py = (-world.y * 0.5 + 0.5) * h;
      const halfWidth = (pool[i].offsetWidth || 90) / 2;
      const visible =
        world.z <= 1 &&
        px - halfWidth > 12 && px + halfWidth < w - 12 && py > 26 && py < h - 24 &&
        !avoidRects.some((r) => overlaps(px, py, halfWidth, r));

      placed.push({ node: pool[i], px, py, halfWidth, visible });
    }

    // Nudge overlapping labels upward so a dense cluster like Java stays legible.
    placed.sort((a, b) => a.py - b.py);
    for (let i = placed.length - 1; i > 0; i--) {
      const gap = placed[i].py - placed[i - 1].py;
      if (gap < MIN_GAP) placed[i - 1].py -= MIN_GAP - gap;
    }

    for (const item of placed) {
      const stillClear = item.visible && item.py > 26 &&
        !avoidRects.some((r) => overlaps(item.px, item.py, item.halfWidth, r));
      item.node.style.opacity = stillClear ? '1' : '0';
      if (!stillClear) continue;
      item.node.style.transform =
        `translate3d(${item.px.toFixed(1)}px,${item.py.toFixed(1)}px,0) translate(-50%,-100%)`;
    }
  }

  return { set, update, layer };
}
