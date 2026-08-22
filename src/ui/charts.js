/**
 * A small SVG chart engine: time series, ranked bars and a split donut.
 *
 * Everything here is pointer-driven and keyboard-reachable. Charts re-render at
 * their measured pixel size (rather than stretching a viewBox) so labels never
 * distort, and a ResizeObserver keeps them honest when the layout changes.
 */

const NS = 'http://www.w3.org/2000/svg';

const el = (name, attrs = {}) => {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) {
    if (v !== null && v !== undefined) node.setAttribute(k, String(v));
  }
  return node;
};

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/** Nice round tick values covering [min,max]. */
function ticks(min, max, count = 4) {
  if (!(max > min)) return [min];
  const raw = (max - min) / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? mag * 10;
  const out = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(v);
  return out;
}

function logTicks(min, max) {
  // 1-2-5 per decade: a pure decade ladder leaves a series spanning less than
  // two decades (population, say) with a single gridline.
  const out = [];
  for (let e = Math.floor(Math.log10(min)); e <= Math.ceil(Math.log10(max)); e++) {
    for (const m of [1, 2, 5]) {
      const v = m * Math.pow(10, e);
      if (v >= min * 0.92 && v <= max * 1.08) out.push(v);
    }
  }
  return out.length > 1 ? out : [min, max];
}

/**
 * Interactive multi-series time chart.
 *
 * @param {HTMLElement} host
 * @param {object} config
 * @param {{id,label,color,points:{year,value,estimated?,anchor?}[],axis?:'left'|'right',
 *          kind?:'area'|'line',dash?:boolean}[]} config.series
 * @param {{year,label,color}[]} [config.markers] milestone pins on the axis
 * @param {{from,to,name,color}[]} [config.bands] era shading
 * @param {(year:number)=>void} [config.onPick]
 * @param {(value:number, seriesId:string)=>string} config.format
 */
export function timeChart(host, config) {
  const state = {
    scale: config.scale ?? 'linear',
    cursor: null,
    ...config,
  };

  const svg = el('svg', { class: 'chart__svg', role: 'img' });
  svg.setAttribute('tabindex', '0');
  host.replaceChildren(svg);

  const tip = document.createElement('div');
  tip.className = 'chart__tip';
  tip.hidden = true;
  host.append(tip);

  const compact = config.compact ?? false;
  const hasRight = state.series.some((s) => s.axis === 'right');
  const pad = compact
    ? { top: 8, right: 6, bottom: 16, left: 6 }
    : { top: 16, right: hasRight ? 62 : 14, bottom: 30, left: 56 };

  let width = 0;
  let height = 0;
  let xOf = () => 0;
  const yScales = new Map();
  let years = [];

  const allYears = [...new Set(state.series.flatMap((s) => s.points.map((p) => p.year)))]
    .sort((a, b) => a - b);
  const minYear = allYears[0];
  const maxYear = allYears.at(-1);

  function buildScales() {
    const innerW = Math.max(10, width - pad.left - pad.right);
    const innerH = Math.max(10, height - pad.top - pad.bottom);
    xOf = (year) => pad.left + ((year - minYear) / (maxYear - minYear || 1)) * innerW;

    yScales.clear();
    for (const axis of ['left', 'right']) {
      const members = state.series.filter((s) => (s.axis ?? 'left') === axis);
      if (!members.length) continue;
      const values = members.flatMap((s) => s.points.map((p) => p.value)).filter((v) => v > 0 || state.scale === 'linear');
      if (!values.length) continue;
      let lo = Math.min(...values);
      let hi = Math.max(...values);
      if (state.scale === 'log') {
        lo = Math.max(lo, 1e-9);
        yScales.set(axis, {
          lo, hi,
          to: (v) => pad.top + innerH - (Math.log10(Math.max(v, lo)) - Math.log10(lo)) /
            (Math.log10(hi) - Math.log10(lo) || 1) * innerH,
          ticks: logTicks(lo, hi),
        });
      } else {
        const span = hi - lo;
        lo = Math.min(lo, lo - span * 0.06);
        if (Math.min(...values) >= 0 && lo < 0) lo = 0;
        hi += span * 0.08;
        yScales.set(axis, {
          lo, hi,
          to: (v) => pad.top + innerH - ((v - lo) / (hi - lo || 1)) * innerH,
          ticks: ticks(lo, hi, compact ? 2 : 4),
        });
      }
    }
    years = allYears;
  }

  function pathFor(series) {
    const y = yScales.get(series.axis ?? 'left');
    if (!y) return '';
    return series.points
      .map((p, i) => `${i ? 'L' : 'M'}${xOf(p.year).toFixed(1)},${y.to(p.value).toFixed(1)}`)
      .join('');
  }

  function render() {
    const rect = host.getBoundingClientRect();
    width = Math.max(120, Math.round(rect.width));
    height = Math.max(60, Math.round(rect.height));
    svg.setAttribute('width', width);
    svg.setAttribute('height', height);
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    buildScales();

    const innerH = height - pad.top - pad.bottom;
    const frag = document.createDocumentFragment();

    // Gradients, one per area series.
    const defs = el('defs');
    for (const series of state.series) {
      if (series.kind !== 'area') continue;
      const grad = el('linearGradient', { id: `g-${series.id}`, x1: 0, y1: 0, x2: 0, y2: 1 });
      grad.append(
        el('stop', { offset: '0%', 'stop-color': series.color, 'stop-opacity': 0.34 }),
        el('stop', { offset: '100%', 'stop-color': series.color, 'stop-opacity': 0 })
      );
      defs.append(grad);
    }
    frag.append(defs);

    // Era bands.
    if (state.bands && !compact) {
      for (const band of state.bands) {
        const x1 = xOf(clamp(band.from, minYear, maxYear));
        const x2 = xOf(clamp(band.to, minYear, maxYear));
        if (x2 - x1 < 1) continue;
        frag.append(el('rect', {
          x: x1, y: pad.top, width: x2 - x1, height: innerH,
          fill: band.color, opacity: 0.055,
        }));
        // A cramped band would just stack its name on its neighbour's.
        if (x2 - x1 < band.name.length * 5.4 + 12) continue;
        const label = el('text', {
          x: x1 + 5, y: pad.top + 11, class: 'chart__band',
          fill: band.color, opacity: 0.75,
        });
        label.textContent = band.name;
        frag.append(label);
      }
    }

    // Horizontal grid + left/right axis labels.
    const left = yScales.get('left');
    if (left) {
      for (const value of left.ticks) {
        const y = left.to(value);
        if (y < pad.top - 1 || y > height - pad.bottom + 1) continue;
        frag.append(el('line', {
          x1: pad.left, x2: width - pad.right, y1: y, y2: y,
          stroke: 'rgba(255,255,255,.06)', 'stroke-width': 1,
        }));
        if (!compact) {
          const t = el('text', { x: pad.left - 7, y: y + 3.5, class: 'chart__axis', 'text-anchor': 'end' });
          t.textContent = state.formatAxis(value, 'left');
          frag.append(t);
        }
      }
    }
    const right = yScales.get('right');
    if (right && !compact) {
      for (const value of right.ticks) {
        const y = right.to(value);
        if (y < pad.top - 1 || y > height - pad.bottom + 1) continue;
        const t = el('text', { x: width - pad.right + 7, y: y + 3.5, class: 'chart__axis chart__axis--right' });
        t.textContent = state.formatAxis(value, 'right');
        frag.append(t);
      }
    }

    // Series.
    for (const series of state.series) {
      const y = yScales.get(series.axis ?? 'left');
      if (!y) continue;
      const d = pathFor(series);
      if (series.kind === 'area') {
        frag.append(el('path', {
          d: `${d}L${xOf(series.points.at(-1).year)},${height - pad.bottom}L${xOf(series.points[0].year)},${height - pad.bottom}Z`,
          fill: `url(#g-${series.id})`, stroke: 'none',
        }));
      }
      frag.append(el('path', {
        d, fill: 'none', stroke: series.color,
        'stroke-width': compact ? 1.6 : 2,
        'stroke-linejoin': 'round', 'stroke-linecap': 'round',
        'stroke-dasharray': series.dash ? '3 2.6' : null,
      }));

      // Dots on measured points, so interpolation is visibly distinct.
      if (!compact) {
        for (const p of series.points) {
          if (!p.anchor) continue;
          frag.append(el('circle', {
            cx: xOf(p.year), cy: y.to(p.value), r: 2.6,
            fill: '#0b1322', stroke: series.color, 'stroke-width': 1.6,
          }));
        }
      }
    }

    // Milestone pins.
    if (state.markers && !compact) {
      for (const marker of state.markers) {
        if (marker.year < minYear || marker.year > maxYear) continue;
        const x = xOf(marker.year);
        frag.append(el('line', {
          x1: x, x2: x, y1: height - pad.bottom, y2: height - pad.bottom + 5,
          stroke: marker.color, 'stroke-width': 1.5, opacity: 0.75,
        }));
      }
    }

    // Year axis.
    const span = maxYear - minYear;
    const step = compact ? 20 : span > 60 ? 10 : span > 30 ? 5 : span > 12 ? 2 : 1;
    for (let year = Math.ceil(minYear / step) * step; year <= maxYear; year += step) {
      const t = el('text', {
        x: xOf(year), y: height - pad.bottom + (compact ? 12 : 17),
        class: 'chart__axis', 'text-anchor': 'middle',
      });
      t.textContent = String(year);
      frag.append(t);
    }

    // Cursor layer, drawn last so it sits on top.
    const cursorGroup = el('g', { class: 'chart__cursor' });
    cursorGroup.setAttribute('visibility', 'hidden');
    cursorGroup.append(el('line', {
      x1: 0, x2: 0, y1: pad.top, y2: height - pad.bottom,
      stroke: 'rgba(255,255,255,.45)', 'stroke-width': 1,
    }));
    for (const series of state.series) {
      cursorGroup.append(el('circle', {
        r: 3.6, fill: series.color, stroke: '#0b1322', 'stroke-width': 1.6,
        'data-series': series.id,
      }));
    }
    frag.append(cursorGroup);

    svg.replaceChildren(frag);
    if (state.cursor !== null) moveCursor(state.cursor, false);
  }

  function nearestYear(clientX) {
    const rect = svg.getBoundingClientRect();
    const x = clientX - rect.left;
    const t = (x - pad.left) / Math.max(1, width - pad.left - pad.right);
    const raw = minYear + t * (maxYear - minYear);
    return years.reduce((best, y) => (Math.abs(y - raw) < Math.abs(best - raw) ? y : best), years[0]);
  }

  function valueAt(series, year) {
    let best = null;
    for (const p of series.points) {
      if (p.year === year) return p;
      if (p.year < year && (!best || p.year > best.year)) best = p;
    }
    return best;
  }

  function moveCursor(year, showTip = true) {
    state.cursor = year;
    const group = svg.querySelector('.chart__cursor');
    if (!group) return;
    const x = xOf(year);
    group.setAttribute('visibility', 'visible');
    group.querySelector('line').setAttribute('x1', x);
    group.querySelector('line').setAttribute('x2', x);

    const rows = [];
    for (const series of state.series) {
      const point = valueAt(series, year);
      const dot = group.querySelector(`circle[data-series="${series.id}"]`);
      const y = yScales.get(series.axis ?? 'left');
      if (!point || !y) { dot?.setAttribute('visibility', 'hidden'); continue; }
      dot?.setAttribute('visibility', 'visible');
      dot?.setAttribute('cx', x);
      dot?.setAttribute('cy', y.to(point.value));
      rows.push({ series, point });
    }

    const marker = state.markers?.find((m) => m.year === year);
    tip.innerHTML = `
      <div class="chart__tipYear">${year}${marker ? `<i style="background:${marker.color}"></i>` : ''}</div>
      ${rows.map(({ series, point }) => `
        <div class="chart__tipRow">
          <i style="background:${series.color}"></i>
          <span>${series.label}</span>
          <b>${state.format(point.value, series.id)}</b>
          ${point.basis === 'interpolated' || point.estimated ? '<em>~</em>' : ''}
        </div>`).join('')}
      ${marker ? `<div class="chart__tipNote">${marker.label}</div>` : ''}`;

    // A programmatic focus moves the marks only. Pinning the tooltip open
    // would cover a compact chart permanently.
    tip.hidden = !showTip;
    if (!showTip) return;
    const hostRect = host.getBoundingClientRect();
    tip.style.left = `${clamp(x, 70, hostRect.width - 70)}px`;
  }

  function hideCursor() {
    state.cursor = null;
    svg.querySelector('.chart__cursor')?.setAttribute('visibility', 'hidden');
    tip.hidden = true;
  }

  svg.addEventListener('pointermove', (e) => moveCursor(nearestYear(e.clientX)));
  svg.addEventListener('pointerleave', hideCursor);
  svg.addEventListener('pointerdown', (e) => {
    const year = nearestYear(e.clientX);
    moveCursor(year);
    state.onPick?.(year);
  });
  svg.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Enter') return;
    e.preventDefault();
    const index = Math.max(0, years.indexOf(state.cursor ?? years.at(-1)));
    if (e.key === 'Enter') return state.onPick?.(years[index]);
    moveCursor(years[clamp(index + (e.key === 'ArrowRight' ? 1 : -1), 0, years.length - 1)]);
  });
  svg.addEventListener('blur', hideCursor);

  const observer = new ResizeObserver(render);
  observer.observe(host);
  render();

  return {
    render,
    setScale(scale) { state.scale = scale; render(); },
    focus(year, { showTip = false } = {}) { moveCursor(year, showTip); },
    destroy() { observer.disconnect(); },
  };
}

/**
 * Ranked horizontal bars. Rows are real buttons so the whole thing is
 * keyboard-navigable and each row can report a selection.
 */
export function barList(host, { items, format, color, onPick, subtitleOf }) {
  const max = Math.max(...items.map((d) => d.value));
  host.replaceChildren(...items.map((item, i) => {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'barrow';
    row.dataset.id = item.id ?? String(i);
    row.innerHTML = `
      <span class="barrow__n">${i + 1}</span>
      <span class="barrow__body">
        <span class="barrow__top">
          <span class="barrow__name">${item.name}</span>
          <b class="barrow__val">${format(item.value)}</b>
        </span>
        <span class="barrow__track"><i style="width:0%;background:${color(i, item)}"></i></span>
        ${subtitleOf ? `<span class="barrow__sub">${subtitleOf(item)}</span>` : ''}
      </span>`;
    row.addEventListener('click', () => onPick?.(item, i));
    requestAnimationFrame(() => {
      row.querySelector('.barrow__track i').style.width = `${(item.value / max) * 100}%`;
    });
    return row;
  }));
}

/** Two-segment donut with a centre readout — used for the sex split. */
export function splitDonut(host, { a, b, format }) {
  const size = 168;
  const r = 62;
  const stroke = 20;
  const circumference = 2 * Math.PI * r;
  const shareA = a.value / (a.value + b.value);

  const svg = el('svg', { width: '100%', height: '100%', viewBox: `0 0 ${size} ${size}`, class: 'donut' });
  const g = el('g', { transform: `translate(${size / 2},${size / 2}) rotate(-90)` });

  g.append(el('circle', {
    r, fill: 'none', stroke: b.color, 'stroke-width': stroke,
  }));
  const arc = el('circle', {
    r, fill: 'none', stroke: a.color, 'stroke-width': stroke,
    'stroke-dasharray': `0 ${circumference}`, 'stroke-linecap': 'butt',
  });
  g.append(arc);
  svg.append(g);

  const centre = el('text', { x: size / 2, y: size / 2 - 2, class: 'donut__value', 'text-anchor': 'middle' });
  centre.textContent = `${(shareA * 100).toFixed(2)}%`;
  const sub = el('text', { x: size / 2, y: size / 2 + 16, class: 'donut__label', 'text-anchor': 'middle' });
  sub.textContent = a.label;
  svg.append(centre, sub);
  host.replaceChildren(svg);

  requestAnimationFrame(() => {
    arc.style.transition = 'stroke-dasharray 1.1s cubic-bezier(.22,.61,.36,1)';
    arc.setAttribute('stroke-dasharray', `${shareA * circumference} ${circumference}`);
  });

  const show = (side) => {
    centre.textContent = `${((side.value / (a.value + b.value)) * 100).toFixed(2)}%`;
    sub.textContent = side.label;
    centre.setAttribute('fill', side.color);
  };
  return {
    highlight: show,
    reset: () => { show(a); centre.removeAttribute('fill'); },
    format,
  };
}
