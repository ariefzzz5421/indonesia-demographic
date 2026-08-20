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

export const HORIZON = new THREE.Color('#0a1626');
export const DEEP    = new THREE.Color('#03070f');

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
  scene.fog = new THREE.FogExp2(HORIZON.clone(), 0.0042);

  const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.5, 3000);
  camera.position.set(0, 96, 118);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.055;
  controls.rotateSpeed = 0.62;
  controls.zoomSpeed = 0.85;
  controls.panSpeed = 0.6;
  controls.screenSpacePanning = false;
  controls.minDistance = 9;
  controls.maxDistance = 260;
  controls.minPolarAngle = THREE.MathUtils.degToRad(6);
  controls.maxPolarAngle = THREE.MathUtils.degToRad(82);
  controls.target.set(0, 0, 0);

  // Keep the camera from drifting off the archipelago while panning.
  const PAN_LIMIT = new THREE.Vector3(78, 26, 52);
  controls.addEventListener('change', () => {
    const tgt = controls.target;
    tgt.x = THREE.MathUtils.clamp(tgt.x, -PAN_LIMIT.x, PAN_LIMIT.x);
    tgt.y = THREE.MathUtils.clamp(tgt.y, -2, PAN_LIMIT.y);
    tgt.z = THREE.MathUtils.clamp(tgt.z, -PAN_LIMIT.z, PAN_LIMIT.z);
  });

  // ── Lighting ──────────────────────────────────────────────────────
  // Low warm key from the west (evening light over the Indian Ocean),
  // cool bounce from the sky, and a tight rim to separate columns from the sea.
  const key = new THREE.DirectionalLight('#ffd7a8', 2.15);
  key.position.set(-58, 62, 44);
  scene.add(key);

  const rim = new THREE.DirectionalLight('#5fd8ff', 0.85);
  rim.position.set(52, 28, -66);
  scene.add(rim);

  const hemi = new THREE.HemisphereLight('#2f5c94', '#050c16', 0.85);
  scene.add(hemi);

  scene.add(new THREE.AmbientLight('#9fc4ff', 0.18));

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
    lights: { key, rim, hemi },
  };
}
