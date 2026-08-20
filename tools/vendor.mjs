#!/usr/bin/env node
/**
 * Copy the exact Three.js modules the page imports out of node_modules and
 * into vendor/, so the site runs from a plain static server with no build step
 * and no CDN. Run after bumping the `three` dependency.
 */
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

const SRC = 'node_modules/three';
const DST = 'vendor/three';

const FILES = [
  'build/three.module.min.js',
  'build/three.core.min.js',
  'examples/jsm/controls/OrbitControls.js',
  'examples/jsm/postprocessing/EffectComposer.js',
  'examples/jsm/postprocessing/Pass.js',
  'examples/jsm/postprocessing/RenderPass.js',
  'examples/jsm/postprocessing/ShaderPass.js',
  'examples/jsm/postprocessing/MaskPass.js',
  'examples/jsm/postprocessing/UnrealBloomPass.js',
  'examples/jsm/postprocessing/OutputPass.js',
  'examples/jsm/shaders/CopyShader.js',
  'examples/jsm/shaders/LuminosityHighPassShader.js',
  'examples/jsm/shaders/OutputShader.js',
];

for (const file of FILES) {
  const to = join(DST, file);
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(join(SRC, file), to);
  console.log('vendored', file);
}
