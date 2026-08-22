/**
 * Spherical geography shared by every module that puts something on the globe.
 *
 * The convention matches THREE.SphereGeometry's own UV layout, so an
 * equirectangular canvas painted with image-x = (lon+180)/360 and
 * image-y = (90-lat)/180 lands exactly where these vectors point.
 */

import * as THREE from 'three';

export const GLOBE_RADIUS = 100;

/** Province chips float just clear of the sphere so long triangulation edges
 *  cannot dip below the surface and let the atlas texture poke through. */
export const CHIP_BASE = GLOBE_RADIUS + 1.0;

const DEG = Math.PI / 180;

/** Unit direction for a lon/lat pair. */
export function lonLatToDir(lon, lat, target = new THREE.Vector3()) {
  const theta = (lon + 180) * DEG;
  const phi = (90 - lat) * DEG;
  const sinPhi = Math.sin(phi);
  return target.set(
    -Math.cos(theta) * sinPhi,
    Math.cos(phi),
    Math.sin(theta) * sinPhi
  );
}

/** Position on a sphere of the given radius. */
export function lonLatToVec3(lon, lat, radius = GLOBE_RADIUS, target = new THREE.Vector3()) {
  return lonLatToDir(lon, lat, target).multiplyScalar(radius);
}

/** Inverse of `lonLatToDir`, for turning a raycast hit back into geography. */
export function dirToLonLat(dir) {
  const v = dir.clone().normalize();
  const lat = 90 - Math.acos(THREE.MathUtils.clamp(v.y, -1, 1)) / DEG;
  let lon = Math.atan2(v.z, -v.x) / DEG - 180;
  while (lon < -180) lon += 360;
  while (lon > 180) lon -= 360;
  return { lon, lat };
}

/** Great-circle midpoint of two lon/lat pairs, in degrees. */
export function midpoint(a, b) {
  const da = lonLatToDir(a[0], a[1]);
  const db = lonLatToDir(b[0], b[1]);
  return dirToLonLat(da.add(db));
}

/** Texture-space coordinates (0..1) for a lon/lat pair. */
export const lonLatToUv = (lon, lat) => [(lon + 180) / 360, (90 - lat) / 180];
