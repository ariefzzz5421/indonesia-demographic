/**
 * Perceptual sequential colour ramps (matplotlib control points, public domain)
 * plus tiny sRGB helpers. Everything works in 0..1 float RGB triplets so the
 * same ramp can feed both a THREE.Color and a CSS gradient.
 */

const RAMPS = {
  magma:  ['#000004','#180f3d','#440f76','#721f81','#9e2f7f','#cd4071','#f1605d','#fd9668','#feca8d','#fcfdbf'],
  inferno:['#000004','#1b0c41','#4a0c6b','#781c6d','#a52c60','#cf4446','#ed6925','#fb9b06','#f7d13d','#fcffa4'],
  viridis:['#440154','#482878','#3e4989','#31688e','#26828e','#1f9e89','#35b779','#6ece58','#b5de2b','#fde725'],
  cividis:['#00204d','#00336f','#39486b','#575d6d','#707173','#8a8678','#a59c74','#c3b369','#e1cc55','#fee838'],
};

const hexToRgb = (hex) => [
  parseInt(hex.slice(1, 3), 16) / 255,
  parseInt(hex.slice(3, 5), 16) / 255,
  parseInt(hex.slice(5, 7), 16) / 255,
];

const STOPS = Object.fromEntries(
  Object.entries(RAMPS).map(([name, hexes]) => [name, hexes.map(hexToRgb)])
);

export const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);

/** Sample a ramp at t in [0,1]; returns [r,g,b] in 0..1. */
export function ramp(name, t) {
  const stops = STOPS[name] || STOPS.viridis;
  const x = clamp01(t) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(x));
  const f = x - i;
  const a = stops[i];
  const b = stops[i + 1];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

export function rampCss(name, t) {
  const [r, g, b] = ramp(name, t);
  return `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})`;
}

/** `linear-gradient(...)` string covering the whole ramp. */
export function rampGradient(name, steps = 12) {
  const parts = [];
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    parts.push(`${rampCss(name, t)} ${(t * 100).toFixed(1)}%`);
  }
  return `linear-gradient(90deg,${parts.join(',')})`;
}

/** Lighten toward white — used for hover/selection emphasis. */
export function lift([r, g, b], amount) {
  return [r + (1 - r) * amount, g + (1 - g) * amount, b + (1 - b) * amount];
}
