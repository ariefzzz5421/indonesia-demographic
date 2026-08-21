/**
 * Nusantara 3D — entry point.
 *
 * An atlas globe you can spin, with the whole world named and only Indonesia
 * interactive: the 34 province chips are the only meshes in the pick list, so a
 * click anywhere else on the planet simply clears the selection.
 */

import * as THREE from 'three';
import { DATA } from './data/stats.js';
import { METRICS } from './metrics.js';
import { createWorld, SUN_DIR } from './scene/world.js';
import { createGlobe } from './scene/globe.js';
import { createSky } from './scene/sky.js';
import { createProvinces } from './scene/provinces.js';
import { createMotes } from './scene/motes.js';
import { createFlag } from './scene/flag.js';
import { createHud } from './ui/hud.js';
import { createLabels } from './ui/labels.js';
import { GLOBE_RADIUS, lonLatToDir } from './util/geo.js';
import { easeInOutCubic, tween } from './util/tween.js';
import { rampCss } from './util/color.js';
import { lang, onLang } from './util/i18n.js';

const FOCUS_A3 = 'IDN';
// Centre of the archipelago. Natural Earth's own label anchor for Indonesia
// sits over Sumatra, which is not where you want the camera to land.
const FOCUS_LON = 118.1;
const FOCUS_LAT = -2.5;
const FOCUS_SPAN = 45.8;      // degrees of longitude, Sabang to Merauke
const JAKARTA = { lon: 106.85, lat: -6.21 };

const boot = document.getElementById('boot');
const bootFill = document.getElementById('bootFill');
const bootPct = document.getElementById('bootPct');

function progress(value) {
  const pct = Math.round(value * 100);
  bootFill.style.width = `${pct}%`;
  bootPct.textContent = `${pct}%`;
}

/** Spherical interpolation between two unit vectors. */
function slerpDir(from, to, k, target) {
  const dot = THREE.MathUtils.clamp(from.dot(to), -1, 1);
  const omega = Math.acos(dot);
  if (omega < 1e-4) return target.copy(to);
  const sin = Math.sin(omega);
  return target
    .copy(from).multiplyScalar(Math.sin((1 - k) * omega) / sin)
    .addScaledVector(to, Math.sin(k * omega) / sin)
    .normalize();
}

async function start() {
  progress(0.06);

  const [geo, world] = await Promise.all([
    fetch(new URL('./data/geo.json', import.meta.url)).then((r) => {
      if (!r.ok) throw new Error(`geo.json: ${r.status}`);
      return r.json();
    }),
    fetch(new URL('./data/world.json', import.meta.url)).then((r) => {
      if (!r.ok) throw new Error(`world.json: ${r.status}`);
      return r.json();
    }),
  ]);
  progress(0.28);

  const canvas = document.getElementById('stage');
  const stage = createWorld(canvas);
  const { scene, camera, controls, renderer, onFrame } = stage;

  const sky = createSky();
  scene.add(sky.group);
  progress(0.36);

  // A phone does not need a 4K atlas, and painting one costs real time.
  const globe = createGlobe(world, {
    sunDir: SUN_DIR,
    highlightA3: FOCUS_A3,
    textureSize: innerWidth < 900 ? 2048 : 4096,
  });
  scene.add(globe.group);
  progress(0.6);

  const provinces = createProvinces(geo, { sunDir: SUN_DIR });
  scene.add(provinces.group);
  progress(0.82);

  const provinceById = new Map(DATA.provinces.map((p) => [p.id, p]));
  const motes = createMotes(geo, provinces.units, provinceById);
  scene.add(motes.points);
  progress(0.9);

  const flag = createFlag({
    lon: JAKARTA.lon,
    lat: JAKARTA.lat,
    poleHeight: 26,
    width: 9,
    sunDir: SUN_DIR,
    sunColor: '#ffd7a8',
    skyColor: '#4f86c6',
  });
  scene.add(flag.group);

  const FOCUS_DIR = lonLatToDir(FOCUS_LON, FOCUS_LAT, new THREE.Vector3());

  // ── Camera framing ────────────────────────────────────────────────
  /**
   * Distance from the globe's centre that fits a lon/lat span on screen.
   *
   * Both axes are checked independently, because Indonesia is 46 degrees wide
   * and 17 tall: fitting it by width alone would work, but fitting a compact
   * province by width alone would put the camera inside its own columns. The
   * horizontal budget is the gap between the glass rails; the vertical budget
   * is what is left between the header and the dock.
   *
   * The floor of 44 units above the surface is what keeps a 13-unit column
   * reading as a data column rather than a skyscraper.
   */
  function distanceFor(spanLon, spanLat, latMid = FOCUS_LAT) {
    const portrait = innerWidth < 900;
    camera.fov = portrait ? 55 : 40;
    camera.updateProjectionMatrix();

    const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    const tanH = tanV * camera.aspect;

    const measured = document.getElementById('railLeft')?.offsetWidth ?? 0;
    const railWidth = measured || Math.min(318, Math.max(248, innerWidth * 0.2));
    const railW = portrait ? 12 : railWidth + 24;
    // Capped below 1 so the archipelago always keeps a margin — without it
    // a portrait phone frames Papua exactly on the screen edge.
    const usableH = THREE.MathUtils.clamp((innerWidth - 2 * railW + 30) / innerWidth, 0.34, 0.94);
    const usableV = portrait ? 0.62 : 0.74;

    const rad = THREE.MathUtils.degToRad;
    const cosLat = Math.cos(rad(latMid));
    const chordX = 2 * GLOBE_RADIUS * Math.sin(rad(spanLon * cosLat) / 2);
    const chordY = 2 * GLOBE_RADIUS * Math.sin(rad(spanLat) / 2);

    const surfaceDistance = Math.max(
      chordX / 2 / usableH / tanH,
      chordY / 2 / usableV / tanV
    );
    return THREE.MathUtils.clamp(
      GLOBE_RADIUS + surfaceDistance,
      GLOBE_RADIUS + 44,
      GLOBE_RADIUS * 4.1
    );
  }

  const overviewDistance = () => distanceFor(FOCUS_SPAN, 16.8, FOCUS_LAT);

  // ── HUD ───────────────────────────────────────────────────────────
  const labels = createLabels(document.getElementById('hud'), { focusA3: FOCUS_A3 });

  const countryDirs = world.countries.map((c) => {
    const isFocus = c.a3 === FOCUS_A3;
    const lon = isFocus ? FOCUS_LON : c.label[0];
    const lat = isFocus ? FOCUS_LAT : c.label[1];
    return {
      a3: c.a3,
      name: c.name,
      nameId: c.nameId,
      rank: isFocus ? 1 : c.rank,
      dir: lonLatToDir(lon, lat, new THREE.Vector3()),
    };
  });

  function refreshCountryLabels() {
    const id = lang() === 'id';
    labels.setCountries(
      countryDirs.map((c) => ({ ...c, name: id ? c.nameId : c.name }))
    );
  }

  const hud = createHud({
    data: DATA,
    onMetric: (s) => { applySlice(s); syncHash(); },
    onYear: (s) => { applySlice(s); syncHash(); },
    onHover: (id) => setHover(id),
    onSelect: (id) => setSelected(id, true),
    onReset: () => { setSelected(null); flyToDir(FOCUS_DIR, overviewDistance(), 1.3); },
  });

  stage.onQuality((quality) => {
    motes.points.visible = quality.index >= 1;
  });

  function applySlice(s) {
    provinces.apply(s.metric.ramp, s.values, s.norm);
    refreshProvinceLabels();
  }

  function refreshProvinceLabels() {
    const metric = METRICS[hud.metricId];
    const { values, norm } = hud.slice();
    labels.setProvinces(
      hud.leaders(5).map((entry) => {
        const unit = provinces.byId.get(entry.id);
        const t = Math.min(1, Math.max(0, norm(values.get(entry.id))));
        return { unit, text: entry.text, color: rampCss(metric.ramp, t) };
      }).filter((e) => e.unit)
    );
  }

  onLang(() => { refreshCountryLabels(); refreshProvinceLabels(); });
  refreshCountryLabels();
  applySlice(hud.slice());

  // ── Deep links ────────────────────────────────────────────────────
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
  // provinces.pickables is the entire pick list, so Indonesia is the only
  // thing on the globe a click can land on.
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

  /** Put the camera straight onto a province, without the flight. */
  function snapToProvince(id) {
    const unit = provinces.byId.get(id);
    if (!unit) return;
    camera.position.copy(unit.dir).multiplyScalar(frameDistance(unit));
    camera.lookAt(controls.target);
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
  canvas.addEventListener('pointerdown', (e) => {
    downAt = { x: e.clientX, y: e.clientY, t: performance.now() };
  });
  canvas.addEventListener('pointerup', (e) => {
    if (!downAt) return;
    const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
    const quick = performance.now() - downAt.t < 500;
    downAt = null;
    if (moved > 6 || !quick) return;   // that was a spin, not a click

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
  const fromDir = new THREE.Vector3();
  const toDir = new THREE.Vector3();
  const scratchDir = new THREE.Vector3();

  /** Arc the camera around the globe to sit over `dir`, ending `distance` out. */
  function flyToDir(dir, distance, duration = 1.3, ease = easeInOutCubic) {
    fromDir.copy(camera.position).normalize();
    toDir.copy(dir).normalize();
    const fromDistance = camera.position.length();
    flying = true;
    controls.enabled = false;
    tween({
      duration,
      ease,
      onUpdate: (k) => {
        slerpDir(fromDir, toDir, k, scratchDir);
        camera.position.copy(scratchDir).multiplyScalar(
          fromDistance + (distance - fromDistance) * k
        );
      },
      onComplete: () => { flying = false; controls.enabled = true; },
    });
  }

  /** How far back to sit for one province to fill the frame comfortably. */
  function frameDistance(unit) {
    const [minLon, minLat, maxLon, maxLat] = unit.bbox;
    const latMid = (minLat + maxLat) / 2;
    // 1.6x so the province arrives with its neighbours around it, and a floor
    // so DKI Jakarta does not pull the camera onto its own rooftops.
    const spanLon = Math.min(Math.max(maxLon - minLon, 3.0) * 1.6, FOCUS_SPAN);
    const spanLat = Math.min(Math.max(maxLat - minLat, 3.0) * 1.6, 24);
    return distanceFor(spanLon, spanLat, latMid);
  }

  function frameProvince(id) {
    const unit = provinces.byId.get(id);
    if (unit) flyToDir(unit.dir, frameDistance(unit), 1.35);
  }

  // ── Hint ──────────────────────────────────────────────────────────
  const hint = document.getElementById('hint');
  let hintHidden = false;
  function hideHint() {
    if (hintHidden) return;
    hintHidden = true;
    hint.classList.add('is-gone');
  }
  setTimeout(hideHint, 14000);

  // ── Idle spin ─────────────────────────────────────────────────────
  // The globe drifts until the visitor touches it, which is what tells them it
  // can be spun at all.
  let userMoved = false;
  controls.addEventListener('start', () => { userMoved = true; hideHint(); });

  addEventListener('resize', () => {
    const distance = overviewDistance();
    if (userMoved || flying) return;
    camera.position.setLength(distance);
  });

  // ── Frame loop ────────────────────────────────────────────────────
  let frame = 0;
  onFrame((dt, elapsed, wallDt) => {
    globe.update(dt, elapsed);
    sky.update(dt, elapsed);
    provinces.update(dt, elapsed);
    motes.update(dt, elapsed, renderer.domElement.height);
    flag.update(dt, elapsed);
    labels.update(camera);
    hud.tickPlayback(wallDt);

    if (!userMoved && !flying) {
      // A slow drift about the globe's own axis.
      camera.position.applyAxisAngle(THREE.Object3D.DEFAULT_UP, -dt * 0.035);
      camera.lookAt(controls.target);
    }

    if (pointerInside && !flying && ++frame % 3 === 0) setHover(pick());
  });

  stage.start();
  progress(1);

  // ── Intro ─────────────────────────────────────────────────────────
  const hadDeepLink = readHash(false);
  const wantsIntro =
    !hadDeepLink &&
    new URLSearchParams(location.search).get('intro') !== '0' &&
    !stage.quality.reduceMotion;

  // Open on the whole planet, turned away from Indonesia, then arc around to it.
  const openingDir = lonLatToDir(FOCUS_LON - 115, 16, new THREE.Vector3());
  if (wantsIntro) {
    camera.position.copy(openingDir).multiplyScalar(GLOBE_RADIUS * 3.6);
    controls.enabled = false;
  } else if (selectedId) {
    snapToProvince(selectedId);
  } else {
    camera.position.copy(FOCUS_DIR).multiplyScalar(overviewDistance());
  }
  camera.lookAt(controls.target);

  await new Promise((r) => setTimeout(r, 220));
  boot.classList.add('is-gone');
  hud.reveal();
  refreshProvinceLabels();

  if (wantsIntro) {
    setTimeout(() => flyToDir(FOCUS_DIR, overviewDistance(), 3.6, easeInOutCubic), 620);
  } else if (selectedId) {
    snapToProvince(selectedId);
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
