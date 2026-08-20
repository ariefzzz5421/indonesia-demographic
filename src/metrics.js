/**
 * The four things the map can encode. Each metric owns its accessor, its
 * colour ramp, the scale used to map raw values onto column height/colour, and
 * how it should be written out.
 *
 * Indonesian provincial data is extremely skewed — Jawa Barat holds 68x the
 * population of Kalimantan Utara — so a linear scale would flatten everything
 * except Java. `sqrt` and `log` keep the small provinces legible while still
 * letting Java tower over the archipelago.
 */

import { compact, idr, num } from './util/format.js';
import { t } from './util/i18n.js';

export const METRICS = {
  population: {
    id: 'population',
    accessor: (p) => p.population,
    ramp: 'magma',
    scale: 'sqrt',
    accent: '#fd9668',
    format: (v, lang) => compact(v, lang, 2),
    formatLong: (v, lang) => num(v, lang, 0),
  },
  density: {
    id: 'density',
    accessor: (p) => p.density,
    ramp: 'inferno',
    scale: 'log',
    accent: '#ed6925',
    format: (v, lang) => num(v, lang, v < 100 ? 1 : 0),
    formatLong: (v, lang) => num(v, lang, 1),
  },
  gdp: {
    id: 'gdp',
    accessor: (p) => p.gdpIdr,
    ramp: 'viridis',
    scale: 'sqrt',
    accent: '#6ece58',
    format: (v, lang) => idr(v, lang, 2),
    formatLong: (v, lang) => idr(v, lang, 2),
  },
  gdpPerCapita: {
    id: 'gdpPerCapita',
    accessor: (p) => p.gdpPerCapitaIdr,
    ramp: 'cividis',
    scale: 'linear',
    accent: '#e1cc55',
    format: (v, lang) => idr(v, lang, 1),
    formatLong: (v, lang) => idr(v, lang, 2),
  },
};

export const METRIC_ORDER = ['population', 'density', 'gdp', 'gdpPerCapita'];

export const metricLabel = (id) => t(`metric.${id}`);
export const metricShort = (id) => t(`metric.${id}.short`);
export const metricLong  = (id) => t(`metric.${id}.long`);
export const metricUnit  = (id) => t(`metric.${id}.unit`);

const transform = (kind, v) => {
  if (kind === 'log') return Math.log10(Math.max(1, v));
  if (kind === 'sqrt') return Math.sqrt(Math.max(0, v));
  return v;
};

/**
 * Build a 0..1 normaliser for one metric across the province set.
 * Returns { norm(province), min, max } where `norm` is monotonic in the raw
 * value and spans the full [0,1] range.
 */
export function normaliser(metric, provinces) {
  const values = provinces.map(metric.accessor);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const lo = transform(metric.scale, min);
  const hi = transform(metric.scale, max);
  const span = hi - lo || 1;
  return {
    min,
    max,
    norm: (province) => (transform(metric.scale, metric.accessor(province)) - lo) / span,
    normValue: (value) => (transform(metric.scale, value) - lo) / span,
  };
}
