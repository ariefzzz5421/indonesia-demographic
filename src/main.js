/**
 * Nusantara 3D — entry point.
 *
 * Loads the geometry and statistics, assembles the scene, and keeps the HUD and
 * the 3D map pointing at the same slice of data.
 */

import * as THREE from 'three';
import { DATA } from './data/stats.js';
import { METRICS } from './metrics.js';
import { createWorld, HORIZON } from './scene/world.js';
import { buildLandMask } from './scene/landmask.js';
import { createOcean } from './scene/ocean.js';
import { createSky } from './scene/sky.js';
import { createProvinces } from './scene/provinces.js';
import { createMotes } from './scene/motes.js';
import { createFlag } from './scene/flag.js';
import { createHud } from './ui/hud.js';
import { createLabels } from './ui/labels.js';
import { easeInOutCubic, tween } from './util/tween.js';
import { rampCss } from './util/color.js';

const SUN_DIR = new THREE.Vector3(-58, 62, 44);

// Jakarta, projected with the same constants as tools/build_geo.py.
const PROJ = { lon0: 118.1035, lat0: -2.5210, scale: 2.1825 };
const project = (lon, lat) => new THREE.Vector3(
  (lon - PROJ.lon0) * PROJ.scale, 0, -(lat - PROJ.lat0) * PROJ.scale
);
const JAKARTA = project(106.8456, -6.2088);

// Half-extent of the archipelago in world units, plus a little breathing room.
const MAP_HALF_X = 51.5;
const MAP_HALF_Z = 20;

/**
 * Frame the whole country for the current viewport. On a wide screen the map
 * is squeezed into the gap between the two glass rails; on a phone it uses the
 * full width and a wider lens, because a 3:1 archipelago on a 1:2 screen needs
 * all the field of view it can get.
 */
function computeOverview(camera) {
  const portrait = innerWidth < 900;
  camera.fov = portrait ? 55 : 40;
  camera.updateProjectionMatrix();

  const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
  const tanH = tanV * camera.aspect;

  // Measured when the HUD is up; the clamp mirrors --rail-w for the first
  // frame, when the rails are still hidden behind the loader.
  const measured = document.getElementById('railLeft')?.offsetWidth ?? 0;
  const railWidth = measured || Math.min(318, Math.max(248, innerWidth * 0.2));
  const railW = portrait ? 12 : railWidth + 24;
  // A sliver of the extreme tips may sit under the translucent rails.
  const usable = Math.max(0.34, (innerWidth - 2 * railW + 30) / innerWidth);

  const forWidth = MAP_HALF_X / (tanH * usable);
  const forDepth = MAP_HALF_Z / (tanV * 0.62);
  const distance = THREE.MathUtils.clamp(Math.max(forWidth, forDepth), 60, 380);

  const tilt = THREE.MathUtils.degToRad(portrait ? 48 : 52);
  const target = new THREE.Vector3(0, 4, 2);
  const position = target.clone()
    .add(new THREE.Vector3(0, Math.sin(tilt), Math.cos(tilt)).multiplyScalar(distance));
  return { position, target };
}

const boot = document.getElementById('boot');
const bootFill = document.getElementById('bootFill');
const bootPct = document.getElementById('bootPct');

function progress(value) {
  const pct = Math.round(value * 100);
  bootFill.style.width = `${pct}%`;
  bootPct.textContent = `${pct}%`;
}

async function start() {
  progress(0.08);

  const geo = await fetch(new URL('./data/geo.json', import.meta.url)).then((r) => {
    if (!r.ok) throw new Error(`geo.json: ${r.status}`);
    return r.json();
  });
  progress(0.3);

  const canvas = document.getElementById('stage');
  const world = createWorld(canvas);
  const { scene, camera, controls, renderer, onFrame } = world;

  // ── Scenery ───────────────────────────────────────────────────────
  const sky = createSky({ sunDir: SUN_DIR, horizon: HORIZON });
  scene.add(sky.group);
  progress(0.4);

  const mask = buildLandMask(geo, 2048);
  progress(0.55);

  const ocean = createOcean({
    maskTexture: mask.texture,
    bounds: mask.bounds,
    worldW: mask.worldW,
    worldH: mask.worldH,
    horizon: HORIZON,
  });
  scene.add(ocean.mesh);
  progress(0.64);

  const provinces = createProvinces(geo);
  scene.add(provinces.group);
  progress(0.82);

  const provinceById = new Map(DATA.provinces.map((p) => [p.id, p]));
  const motes = createMotes(geo, provinces.units, provinceById);
  scene.add(motes.points);
  progress(0.9);

  const flag = createFlag({
    position: JAKARTA,
    poleHeight: 27,
    width: 9,
    sunDir: SUN_DIR,
    sunColor: '#ffd7a8',
    skyColor: '#4f86c6',
  });
  scene.add(flag.group);

  // ── HUD ───────────────────────────────────────────────────────────
  const labels = createLabels(document.getElementById('hud'));

  const hud = createHud({
    data: DATA,
    onMetric: (s) => { applySlice(s); syncHash(); },
    onYear: (s) => { applySlice(s); syncHash(); },
    onHover: (id) => setHover(id),
    onSelect: (id) => setSelected(id, true),
    onReset: () => {
      setSelected(null);
      const view = computeOverview(camera);
      flyTo(view.position, view.target, 1.1);
    },
  });

  // Quality steps down on weak hardware; the ocean and the mote field are the
  // two things worth sacrificing first.
  world.onQuality((quality) => {
    ocean.setQuality(quality);
    motes.points.visible = quality.index >= 1;
  });

  function applySlice(s) {
    provinces.apply(s.metric.ramp, s.values, s.norm);
    refreshLabelSet();
  }

  function refreshLabelSet() {
    const metric = METRICS[hud.metricId];
    const { values, norm } = hud.slice();
    labels.set(
      hud.leaders(6).map((entry) => {
        const unit = provinces.byId.get(entry.id);
        const tNorm = Math.min(1, Math.max(0, norm(values.get(entry.id))));
        return { unit, text: entry.text, color: rampCss(metric.ramp, tNorm) };
      }).filter((e) => e.unit)
    );
  }

  applySlice(hud.slice());

  // ── Deep links ────────────────────────────────────────────────────
  // #/<metric>/<year>/<provinceId> keeps the current view shareable and
  // survives reload / back-forward.
  let writingHash = false;

  function syncHash() {
    writingHash = true;
    const parts = ['', hud.metricId, hud.year];
    if (selectedId) parts.push(selectedId);
    history.replaceState(null, '', `#${parts.join('/')}`);
    queueMicrotask(() => { writingHash = false; });
  }

  function readHash(fly) {
    const [, metricId, year, provinceId] = location.hash.replace(/^#/, '').split('/');
    if (metricId && METRICS[metricId]) hud.setMetric(metricId);
    if (year && Number.isFinite(Number(year))) hud.setYear(Number(year));
    applySlice(hud.slice());
    if (provinceId && provinces.byId.has(provinceId)) setSelected(provinceId, fly);
    return Boolean(metricId || year || provinceId);
  }

  addEventListener('hashchange', () => { if (!writingHash) readHash(true); });

  // ── Picking ───────────────────────────────────────────────────────
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2(-2, -2);
  const screen = { x: 0, y: 0 };
  let hoveredId = null;
  let selectedId = null;
  let pointerInside = false;
  let flying = false;

  function setHover(id) {
    if (id === hoveredId) return;
    hoveredId = id;
    provinces.setHover(id);
    hud.setHovered(id);
    if (id) hud.showTip(id, screen.x, screen.y);
    else hud.hideTip();
    canvas.style.cursor = id ? 'pointer' : '';
  }

  function setSelected(id, fly = false) {
    selectedId = id;
    provinces.setSelected(id);
    hud.setSelected(id);
    if (fly && id) frameProvince(id);
    syncHash();
  }

  canvas.addEventListener('pointermove', (e) => {
    pointerInside = true;
    screen.x = e.clientX;
    screen.y = e.clientY;
    pointer.x = (e.clientX / innerWidth) * 2 - 1;
    pointer.y = -(e.clientY / innerHeight) * 2 + 1;
    if (hoveredId) hud.showTip(hoveredId, screen.x, screen.y);
  });
  canvas.addEventListener('pointerleave', () => { pointerInside = false; setHover(null); });

  let downAt = null;
  canvas.addEventListener('pointerdown', (e) => { downAt = { x: e.clientX, y: e.clientY, t: performance.now() }; });
  canvas.addEventListener('pointerup', (e) => {
    if (!downAt) return;
    const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
    const quick = performance.now() - downAt.t < 500;
    downAt = null;
    if (moved > 6 || !quick) return;   // that was an orbit, not a click

    pointer.x = (e.clientX / innerWidth) * 2 - 1;
    pointer.y = -(e.clientY / innerHeight) * 2 + 1;
    const hit = pick();
    setSelected(hit, Boolean(hit));
    hideHint();
  });

  function pick() {
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(provinces.pickables, false);
    return hits.length ? hits[0].object.userData.unit.id : null;
  }

  // ── Camera moves ──────────────────────────────────────────────────
  const fromPos = new THREE.Vector3();
  const fromTarget = new THREE.Vector3();
  const toPos = new THREE.Vector3();
  const toTarget = new THREE.Vector3();

  function flyTo(position, target, duration = 1.2, ease = easeInOutCubic) {
    fromPos.copy(camera.position);
    fromTarget.copy(controls.target);
    toPos.copy(position);
    toTarget.copy(target);
    flying = true;
    controls.enabled = false;
    tween({
      duration,
      ease,
      onUpdate: (k) => {
        camera.position.lerpVectors(fromPos, toPos, k);
        controls.target.lerpVectors(fromTarget, toTarget, k);
      },
      onComplete: () => { flying = false; controls.enabled = true; },
    });
  }

  const FRAME_DIR = new THREE.Vector3(0.22, 0.78, 0.58).normalize();
  function frameProvince(id) {
    const unit = provinces.byId.get(id);
    if (!unit) return;
    const [minX, minZ, maxX, maxZ] = unit.bbox;
    const centre = new THREE.Vector3((minX + maxX) / 2, 0, (minZ + maxZ) / 2);
    const spread = Math.max(maxX - minX, maxZ - minZ, 6);
    const distance = THREE.MathUtils.clamp(spread * 1.75 + 14, 22, 130);
    const target = centre.clone().setY(Math.max(2, unit.targetHeight * 0.5));
    flyTo(target.clone().addScaledVector(FRAME_DIR, distance), target, 1.25);
  }

  // ── Hint ──────────────────────────────────────────────────────────
  const hint = document.getElementById('hint');
  let hintHidden = false;
  function hideHint() {
    if (hintHidden) return;
    hintHidden = true;
    hint.classList.add('is-gone');
  }
  controls.addEventListener('start', hideHint);
  setTimeout(hideHint, 12000);

  // Keep the camera framing sane when the window changes shape. Until the
  // visitor has taken control of the camera themselves, re-fit automatically.
  let userMoved = false;
  controls.addEventListener('start', () => { userMoved = true; });
  addEventListener('resize', () => {
    const view = computeOverview(camera);
    if (userMoved || flying) return;
    camera.position.copy(view.position);
    controls.target.copy(view.target);
  });

  // ── Frame loop ────────────────────────────────────────────────────
  let frame = 0;
  onFrame((dt, elapsed, wallDt) => {
    // Atmospheric depth is scaled to how far the camera is standing back, so
    // the haze reads the same whether you are looking at Java or at all of it.
    const camDistance = camera.position.distanceTo(controls.target);
    const density = 0.0044 * Math.min(1, 118 / Math.max(70, camDistance));
    scene.fog.density = density;
    ocean.setFogDensity(density);

    ocean.update(dt, elapsed, camera);
    sky.update(dt, elapsed);
    provinces.update(dt, elapsed);
    motes.update(dt, elapsed, renderer.domElement.height);
    flag.update(dt, elapsed);
    labels.update(camera);
    hud.tickPlayback(wallDt);

    // Picking every third frame is imperceptible and keeps the raycast cheap.
    if (pointerInside && !flying && ++frame % 3 === 0) setHover(pick());
  });

  world.start();
  progress(1);

  // ── Intro ─────────────────────────────────────────────────────────
  // Open tight on the flag flying over Jakarta, then pull back to reveal the
  // whole archipelago. Skipped for deep links, for ?intro=0, and whenever the
  // visitor has asked for reduced motion.
  const hadDeepLink = readHash(false);
  const wantsIntro =
    !hadDeepLink &&
    new URLSearchParams(location.search).get('intro') !== '0' &&
    !world.quality.reduceMotion;

  if (wantsIntro) {
    camera.position.copy(JAKARTA).add(new THREE.Vector3(10.5, 23.5, 14));
    controls.target.copy(JAKARTA).add(new THREE.Vector3(3.5, 22.5, 0));
    controls.enabled = false;
  }

  await new Promise((r) => setTimeout(r, 220));
  boot.classList.add('is-gone');
  hud.reveal();
  refreshLabelSet();

  // The rails have to be on screen before they can be measured.
  const overview = computeOverview(camera);
  if (!wantsIntro) {
    camera.position.copy(overview.position);
    controls.target.copy(overview.target);
  }

  if (wantsIntro) {
    setTimeout(() => {
      const view = computeOverview(camera);
      flyTo(view.position, view.target, 3.4, easeInOutCubic);
    }, 520);
  }

  setTimeout(() => boot.remove(), 1400);
}

start().catch((err) => {
  console.error(err);
  boot.innerHTML = `<div class="boot__inner">
    <div class="boot__title">NUSANTARA<span>3D</span></div>
    <p style="color:#a6b6cd;font-size:13px;line-height:1.6;margin-top:14px">
      Gagal memuat visualisasi.<br><span style="color:#6d7f98;font-size:11.5px">${String(err.message || err)}</span>
    </p></div>`;
});
