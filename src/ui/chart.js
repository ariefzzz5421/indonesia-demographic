/**
 * The dual-series sparkline in the left rail: nominal GDP (area + line) against
 * population (line), 2015-2025, each normalised to its own extent so the two
 * curves are comparable in shape rather than magnitude.
 */

const NS = 'http://www.w3.org/2000/svg';
const W = 260;
const H = 76;
const PAD_TOP = 6;
const PAD_BOTTOM = 8;

const el = (name, attrs) => {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
};

export function createSparkline(svg, series) {
  const years = series.map((d) => d.year);
  const x = (year) => ((year - years[0]) / (years.at(-1) - years[0])) * W;

  const scaleY = (values) => {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    return (v) => H - PAD_BOTTOM - ((v - min) / span) * (H - PAD_TOP - PAD_BOTTOM);
  };

  const gdpY = scaleY(series.map((d) => d.gdpUsd));
  const popY = scaleY(series.map((d) => d.population));

  const path = (yOf, key) =>
    series.map((d, i) => `${i ? 'L' : 'M'}${x(d.year).toFixed(1)},${yOf(d[key]).toFixed(1)}`).join('');

  svg.replaceChildren();

  const defs = el('defs', {});
  const grad = el('linearGradient', { id: 'gdpFill', x1: '0', y1: '0', x2: '0', y2: '1' });
  grad.append(
    el('stop', { offset: '0%', 'stop-color': '#f5c451', 'stop-opacity': '.34' }),
    el('stop', { offset: '100%', 'stop-color': '#f5c451', 'stop-opacity': '0' })
  );
  defs.append(grad);
  svg.append(defs);

  // Faint baseline grid.
  for (let i = 0; i <= 2; i++) {
    const y = PAD_TOP + ((H - PAD_TOP - PAD_BOTTOM) / 2) * i;
    svg.append(el('line', {
      x1: 0, x2: W, y1: y, y2: y,
      stroke: 'rgba(255,255,255,.06)', 'stroke-width': 1,
    }));
  }

  const gdpPath = path(gdpY, 'gdpUsd');
  svg.append(el('path', {
    d: `${gdpPath}L${W},${H - PAD_BOTTOM}L0,${H - PAD_BOTTOM}Z`,
    fill: 'url(#gdpFill)', stroke: 'none',
  }));
  svg.append(el('path', {
    d: gdpPath, fill: 'none', stroke: '#f5c451',
    'stroke-width': 1.7, 'stroke-linejoin': 'round', 'stroke-linecap': 'round',
  }));
  svg.append(el('path', {
    d: path(popY, 'population'), fill: 'none', stroke: '#46e3d0',
    'stroke-width': 1.4, 'stroke-dasharray': '3 2.6',
    'stroke-linejoin': 'round', 'stroke-linecap': 'round',
  }));

  const marker = el('line', {
    x1: 0, x2: 0, y1: 0, y2: H,
    stroke: 'rgba(255,255,255,.42)', 'stroke-width': 1,
  });
  const dotGdp = el('circle', { r: 2.9, fill: '#f5c451', stroke: '#0b1322', 'stroke-width': 1.4 });
  const dotPop = el('circle', { r: 2.6, fill: '#46e3d0', stroke: '#0b1322', 'stroke-width': 1.4 });
  svg.append(marker, dotGdp, dotPop);

  return function highlight(year) {
    const record = series.find((d) => d.year === year) ?? series.at(-1);
    const px = x(record.year);
    marker.setAttribute('x1', px);
    marker.setAttribute('x2', px);
    dotGdp.setAttribute('cx', px);
    dotGdp.setAttribute('cy', gdpY(record.gdpUsd));
    dotPop.setAttribute('cx', px);
    dotPop.setAttribute('cy', popY(record.population));
  };
}
