/**
 * Rasterise every province polygon into a single RGB texture that the ocean
 * shader reads:
 *
 *   R — hard land mask (1 inside a province)
 *   G — 6px blur   → the shallow shelf that rings each island
 *   B — 26px blur  → a wide, soft ambient occlusion / haze around landmasses
 *
 * Drawing all rings into one Path2D and filling it three times (rather than
 * blurring each polygon separately) keeps the blurred channels from stacking
 * along shared province borders.
 */

import * as THREE from 'three';

export const MASK_PADDING = 26; // world units of ocean kept around the bbox

export function buildLandMask(geo, size = 2048) {
  const [minX, minZ, maxX, maxZ] = geo.bbox;
  const bounds = {
    minX: minX - MASK_PADDING,
    minZ: minZ - MASK_PADDING,
    maxX: maxX + MASK_PADDING,
    maxZ: maxZ + MASK_PADDING,
  };
  const worldW = bounds.maxX - bounds.minX;
  const worldH = bounds.maxZ - bounds.minZ;

  const width = size;
  const height = Math.max(2, Math.round(size * (worldH / worldW)));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: false });

  const sx = width / worldW;
  const sz = height / worldH;

  const path = new Path2D();
  const addRing = (flat) => {
    path.moveTo((flat[0] - bounds.minX) * sx, (flat[1] - bounds.minZ) * sz);
    for (let i = 2; i < flat.length; i += 2) {
      path.lineTo((flat[i] - bounds.minX) * sx, (flat[i + 1] - bounds.minZ) * sz);
    }
    path.closePath();
  };

  for (const province of geo.provinces) {
    for (const poly of province.polys) {
      addRing(poly.o);
      if (poly.h) poly.h.forEach(addRing);
    }
  }

  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);
  ctx.globalCompositeOperation = 'lighter';

  const blurScale = width / 2048;
  const passes = [
    { blur: 0,  color: '#ff0000' },
    { blur: 4.5 * blurScale, color: '#00ff00' },
    { blur: 17 * blurScale,  color: '#0000ff' },
  ];

  for (const pass of passes) {
    ctx.filter = pass.blur ? `blur(${pass.blur.toFixed(2)}px)` : 'none';
    ctx.fillStyle = pass.color;
    ctx.fill(path, 'evenodd');
  }
  ctx.filter = 'none';
  ctx.globalCompositeOperation = 'source-over';

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.NoColorSpace;
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 4;
  texture.needsUpdate = true;

  return { texture, bounds, worldW, worldH };
}
