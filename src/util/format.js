/**
 * Locale-aware number formatting. Indonesian uses `.` for thousands and `,` for
 * decimals, so everything routes through Intl rather than hand-rolled string
 * surgery.
 */

const LOCALE = { id: 'id-ID', en: 'en-US' };

const SCALE_ID = [
  [1e12, ' triliun'], [1e9, ' miliar'], [1e6, ' juta'], [1e3, ' ribu'],
];
const SCALE_EN = [
  [1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K'],
];

export function num(value, lang = 'id', digits = 0) {
  return new Intl.NumberFormat(LOCALE[lang] || LOCALE.id, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

/** 284438782 -> "284,44 juta" / "284.44M" */
export function compact(value, lang = 'id', digits = 2) {
  const table = lang === 'en' ? SCALE_EN : SCALE_ID;
  const abs = Math.abs(value);
  for (const [step, suffix] of table) {
    if (abs >= step) {
      const scaled = value / step;
      const d = scaled >= 100 ? Math.max(0, digits - 2) : scaled >= 10 ? Math.max(0, digits - 1) : digits;
      return num(scaled, lang, d) + suffix;
    }
  }
  return num(value, lang, 0);
}

const TIGHT_ID = [[1e12, ' T'], [1e9, ' M'], [1e6, ' jt'], [1e3, ' rb']];
const TIGHT_EN = [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']];

/** Same as `compact`, with the short suffixes used on the KPI cards. */
export function compactTight(value, lang = 'id', digits = 2) {
  const table = lang === 'en' ? TIGHT_EN : TIGHT_ID;
  const abs = Math.abs(value);
  for (const [step, suffix] of table) {
    if (abs >= step) {
      const scaled = value / step;
      const d = scaled >= 100 ? 0 : scaled >= 10 ? Math.max(0, digits - 1) : digits;
      return num(scaled, lang, d) + suffix;
    }
  }
  return num(value, lang, 0);
}

/** Money in USD, compacted. */
export function usd(value, lang = 'id', digits = 2) {
  return 'US$' + compact(value, lang, digits);
}

/** Money in rupiah, compacted. */
export function idr(value, lang = 'id', digits = 2) {
  return 'Rp ' + compact(value, lang, digits);
}

export function pct(value, lang = 'id', digits = 1) {
  return num(value, lang, digits) + '%';
}

/**
 * Interpolate between two numbers for animated counters, preserving the
 * formatter so digits do not jitter in width.
 */
export function animateCounter(el, from, to, duration, formatter) {
  const start = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 4);
    el.textContent = formatter(from + (to - from) * eased);
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
