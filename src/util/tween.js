/** Easing curves and a minimal frame-driven tween registry. */

export const easeOutCubic   = (t) => 1 - Math.pow(1 - t, 3);
export const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Exponential smoothing that behaves sanely at any frame rate. */
export const lerpDamp = (current, target, lambda, dt) =>
  current + (target - current) * (1 - Math.exp(-lambda * dt));

/**
 * Critically-damped spring step — the workhorse behind the settling motion of
 * the province columns. `smoothTime` is roughly the time to close most of the
 * remaining distance; `vel` is a single-element scratch array.
 */
export function damp(current, target, smoothTime, dt, vel, i = 0) {
  const omega = 2 / Math.max(1e-4, smoothTime);
  const x = omega * dt;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = current - target;
  const temp = (vel[i] + omega * change) * dt;
  vel[i] = (vel[i] - omega * temp) * exp;
  return target + (change + temp) * exp;
}

const active = new Set();

export function tween({ duration = 0.8, ease = easeOutCubic, onUpdate, onComplete }) {
  const entry = { t: 0, duration, ease, onUpdate, onComplete };
  active.add(entry);
  return () => active.delete(entry);
}

export function stepTweens(dt) {
  for (const e of [...active]) {
    e.t += dt;
    const raw = Math.min(1, e.t / e.duration);
    e.onUpdate?.(e.ease(raw), raw);
    if (raw >= 1) {
      active.delete(e);
      e.onComplete?.();
    }
  }
}
