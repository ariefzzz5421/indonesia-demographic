/**
 * Renderer, camera, controls, post-processing and the frame loop.
 * Everything else in src/scene attaches to the scene this module owns.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { stepTweens } from '../util/tween.js';
import { GLOBE_RADIUS } from '../util/geo.js';

export const DEEP = new THREE.Color('#02040a');
/** Shared key-light direction. Nothing in the scene uses THREE lights — every
 *  material shades itself — so this is passed to each shader instead. */
export const SUN_DIR = new THREE.Vector3(-0.55, 0.42, 0.72).normalize();

export function createWorld(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
    stencil: false,
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;

  const scene = new THREE.Scene();
  scene.background = DEEP.clone();

  const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 1, 6000);
  camera.position.set(0, 60, 320);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.055;
  controls.rotateSpeed = 0.62;
  controls.zoomSpeed = 0.85;
  // The globe always stays centred: panning is disabled so the camera can only
  // spin around it and dolly in or out.
  controls.enablePan = false;
  controls.minDistance = GLOBE_RADIUS * 1.28;
  controls.maxDistance = GLOBE_RADIUS * 4.2;
  controls.minPolarAngle = THREE.MathUtils.degToRad(4);
  controls.maxPolarAngle = THREE.MathUtils.degToRad(176);
  controls.target.set(0, 0, 0);

  // ── Post ──────────────────────────────────────────────────────────
  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(Math.min(devicePixelRatio, 2));
  composer.addPass(new RenderPass(scene, camera));

  const bloom = new UnrealBloomPass(
    new THREE.Vector2(innerWidth, innerHeight),
    0.48,   // strength
    0.68,   // radius
    0.78    // threshold — only the glowing rims and the flag bloom
  );
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // ── Adaptive quality ──────────────────────────────────────────────
  // Software renderers, integrated GPUs and phones all end up here. Rather
  // than shipping a fixed budget, watch the real frame rate and step the
  // expensive things down until the page is smooth. Stepping only ever goes
  // one way, so the quality level cannot oscillate.
  const LEVELS = ['low', 'medium', 'high'];
  const forced = new URLSearchParams(location.search).get('quality');
  const quality = {
    level: 'high',
    index: LEVELS.indexOf(forced) >= 0 ? LEVELS.indexOf(forced) : 2,
    locked: LEVELS.indexOf(forced) >= 0,
    reduceMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
  };
  const qualityListeners = new Set();
  const onQuality = (fn) => { qualityListeners.add(fn); fn(quality); return () => qualityListeners.delete(fn); };

  function applyQuality() {
    quality.level = LEVELS[quality.index];
    const ratio = quality.index === 2 ? Math.min(devicePixelRatio, 2) : 1;
    renderer.setPixelRatio(ratio);
    composer.setPixelRatio(ratio);
    composer.setSize(innerWidth, innerHeight);
    bloom.enabled = quality.index >= 1;
    qualityListeners.forEach((fn) => fn(quality));
  }

  function downgrade() {
    if (quality.index === 0) return false;
    quality.index -= 1;
    applyQuality();
    return true;
  }

  let sampleFrames = 0;
  let sampleStart = 0;
  let settled = false;
  // Measured against the wall clock, not the clamped frame delta — on a
  // genuinely slow device the clamped delta would take minutes to add up.
  function watchPerformance() {
    if (settled || quality.locked) return;
    const now = performance.now();
    if (sampleStart === 0) { sampleStart = now; return; }
    sampleFrames += 1;
    const seconds = (now - sampleStart) / 1000;
    if (seconds < 1.6) return;
    const fps = sampleFrames / seconds;
    sampleFrames = 0;
    sampleStart = now;
    if (fps < 26) {
      if (!downgrade()) settled = true;
    } else if (fps > 45) {
      settled = true;   // comfortable at this level, stop measuring
    }
  }

  const clock = new THREE.Clock();
  const updaters = [];
  const onFrame = (fn) => updaters.push(fn);

  function resize() {
    const w = innerWidth;
    const h = innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const ratio = quality.index === 2 ? Math.min(devicePixelRatio, 2) : 1;
    renderer.setPixelRatio(ratio);
    composer.setPixelRatio(ratio);
    renderer.setSize(w, h);
    composer.setSize(w, h);
    bloom.setSize(w, h);
  }
  addEventListener('resize', resize);

  let running = true;
  function loop() {
    requestAnimationFrame(loop);
    if (!running) return;
    // `dt` is clamped for the simulation so a stall cannot launch a spring
    // across the map. Camera moves and playback follow the wall clock instead,
    // so a scripted 3-second flight takes three seconds even at 5 fps.
    const raw = clock.getDelta();
    const dt = Math.min(raw, 0.05);
    const wallDt = Math.min(raw, 0.25);
    const elapsed = clock.elapsedTime;
    watchPerformance();
    stepTweens(wallDt);
    controls.update();
    for (const fn of updaters) fn(dt, elapsed, wallDt);
    composer.render();
  }

  // Pause when the tab is hidden so a backgrounded page costs nothing.
  document.addEventListener('visibilitychange', () => {
    running = !document.hidden;
    if (running) clock.getDelta();
  });

  return {
    renderer, scene, camera, controls, composer, bloom,
    onFrame, onQuality, quality, resize, start: loop,
  };
}
