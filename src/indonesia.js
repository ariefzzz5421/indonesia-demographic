/**
 * The Indonesia page: the long historical chart, the milestone timeline, and
 * the current-situation panels.
 *
 * The chart and the timeline are two views of the same data — clicking a year
 * selects the nearest milestone, and clicking a milestone moves the chart's
 * cursor onto its year.
 */

import { HISTORY } from './data/history.js';
import { DATA } from './data/stats.js';
import { BUILD } from './version.js';
import { timeChart, barList, splitDonut } from './ui/charts.js';
import { compact, compactTight, idr, num, pct, usd } from './util/format.js';
import { lang, onLang, setLang, t } from './util/i18n.js';

const $ = (sel) => document.querySelector(sel);
const L = () => lang();
const isId = () => lang() === 'id';

const eraColor = (id) => HISTORY.eras.find((e) => e.id === id)?.color ?? '#8b7bff';
const pick = (record, key) => (isId() ? record[key] : record[`${key}En`] ?? record[key]);

let mainChart = null;
let ratioChart = null;
let sidChart = null;
let selectedYear = null;
let eraFilter = 'all';

// ── Hero ────────────────────────────────────────────────────────────────
function renderHero() {
  const first = HISTORY.population[0];
  const last = HISTORY.population.at(-1);
  const gdpLast = HISTORY.gdpUsd.at(-1);
  const stats = [
    { value: `${num(last.year - first.year, L())}`, label: isId() ? 'tahun merdeka' : 'years independent' },
    { value: `${(last.value / first.value).toFixed(1)}×`, label: isId() ? 'pertumbuhan penduduk' : 'population growth' },
    { value: usd(gdpLast.value, L(), 2), label: isId() ? 'PDB nominal 2025' : 'nominal GDP 2025' },
    { value: `${num(HISTORY.milestones.length, L())}`, label: isId() ? 'momen penting' : 'key moments' },
  ];
  $('#heroStats').innerHTML = stats
    .map((s) => `<div class="herostat"><b>${s.value}</b><span>${s.label}</span></div>`)
    .join('');
}

// ── The long chart ──────────────────────────────────────────────────────
function renderMainChart() {
  mainChart?.destroy();
  mainChart = timeChart($('#mainChart'), {
    series: [
      {
        id: 'pop',
        label: isId() ? 'Penduduk' : 'Population',
        color: '#46e3d0', axis: 'left', kind: 'area',
        points: HISTORY.population.map((d) => ({
          year: d.year, value: d.value, anchor: d.anchor, basis: d.basis,
        })),
      },
      {
        id: 'gdp',
        label: isId() ? 'PDB nominal' : 'Nominal GDP',
        color: '#f5c451', axis: 'right', kind: 'line',
        points: HISTORY.gdpUsd.map((d) => ({ year: d.year, value: d.value, estimated: d.estimated })),
      },
    ],
    bands: HISTORY.eras.map((e) => ({
      from: e.from, to: e.to, name: pick(e, 'name'), color: e.color,
    })),
    markers: HISTORY.milestones.map((m) => ({
      year: m.year, label: pick(m, 'title'), color: eraColor(m.era),
    })),
    format: (value, id) => (id === 'gdp' ? usd(value, L(), 2) : `${compact(value, L(), 2)} ${t('unit.person')}`),
    formatAxis: (value, axis) => (axis === 'right' ? `US$${compactTight(value, L(), 1)}` : compactTight(value, L(), 0)),
    onPick: (year) => selectNearestMilestone(year),
  });

  $('#mainLegend').innerHTML = `
    <span><i style="background:#46e3d0"></i>${isId() ? 'Penduduk' : 'Population'}</span>
    <span><i style="background:#f5c451"></i>${isId() ? 'PDB nominal (USD)' : 'Nominal GDP (USD)'}</span>
    <span><i class="dot" style="background:#0b1322;box-shadow:0 0 0 1.6px #46e3d0"></i>${isId() ? 'sensus resmi' : 'official census'}</span>`;
}

function selectNearestMilestone(year) {
  const nearest = HISTORY.milestones.reduce((best, m) =>
    Math.abs(m.year - year) < Math.abs(best.year - year) ? m : best);
  selectMilestone(nearest.year, { scroll: true });
}

function selectMilestone(year, { scroll = false } = {}) {
  selectedYear = year;
  for (const node of document.querySelectorAll('.tl')) {
    node.classList.toggle('is-on', Number(node.dataset.year) === year);
  }
  mainChart?.focus(year);
  if (scroll) {
    const node = document.querySelector(`.tl[data-year="${year}"]`);
    node?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
}

// ── Timeline ────────────────────────────────────────────────────────────
function renderTimeline() {
  const eras = [{ id: 'all', name: t('page.moments.all'), color: '#8ea6c4' }, ...HISTORY.eras];
  $('#eraFilter').innerHTML = eras
    .map((e) => `<button type="button" class="erabtn${e.id === eraFilter ? ' is-on' : ''}"
      style="--era:${e.color}" data-era="${e.id}">${e.id === 'all' ? e.name : pick(e, 'name')}</button>`)
    .join('');
  for (const btn of $('#eraFilter').querySelectorAll('.erabtn')) {
    btn.addEventListener('click', () => {
      eraFilter = btn.dataset.era;
      renderTimeline();
    });
  }

  $('#timeline').innerHTML = HISTORY.milestones
    .map((m) => {
      const hidden = eraFilter !== 'all' && m.era !== eraFilter;
      return `
      <li class="tl${hidden ? ' is-hidden' : ''}${m.year === selectedYear ? ' is-on' : ''}"
          style="--era:${eraColor(m.era)}" data-year="${m.year}" tabindex="0" role="button">
        <div>
          <div class="tl__year">${m.year}</div>
          <div class="tl__date">${pick(m, 'date')}</div>
          <div class="tl__tag">${pick(m, 'tag')}</div>
        </div>
        <div>
          <div class="tl__title">${pick(m, 'title')}</div>
          <p class="tl__body">${pick(m, 'body')}</p>
          ${m.stat ? `<div class="tl__stat">${pick(m, 'stat')}</div>` : ''}
        </div>
      </li>`;
    })
    .join('');

  for (const node of $('#timeline').querySelectorAll('.tl')) {
    const activate = () => selectMilestone(Number(node.dataset.year));
    node.addEventListener('click', activate);
    node.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); }
    });
  }
}

// ── Latest situation ────────────────────────────────────────────────────
function renderLatest() {
  $('#latestStats').innerHTML = HISTORY.latest
    .map((s) => {
      const big = s.value >= 1e6;
      const value = big ? compact(s.value, L(), 2) : num(s.value, L(), s.value % 1 === 0 ? 0 : s.key === 'gini' ? 3 : 2);
      const unit = isId() ? s.unit : s.unitEn;
      return `
      <article class="statcard">
        <div class="statcard__label">${pick(s, 'label')}</div>
        <div class="statcard__value">${value}${unit ? `<span class="u">${unit}</span>` : ''}</div>
        <div class="statcard__note">${pick(s, 'note')}</div>
      </article>`;
    })
    .join('');
}

// ── Wages ───────────────────────────────────────────────────────────────
function renderWages() {
  const items = HISTORY.wages.map((w, i) => ({ ...w, id: w.name, index: i }));
  const lowest = items.at(-1);

  const detail = (item) => {
    const gap = ((item.value / lowest.value - 1) * 100);
    $('#wageDetail').innerHTML = `
      <div class="sidefig">
        <div class="sidefig__label">${item.kind} 2025</div>
        <div class="sidefig__value">${idr(item.value, L(), 2)}</div>
        <div class="sidefig__note">${item.name} · ${item.province}</div>
      </div>
      <div class="sidefig">
        <div class="sidefig__label">${t('page.wage.perYear')}</div>
        <div class="sidefig__value">${idr(item.value * 12, L(), 1)}</div>
        <div class="sidefig__note">${num(item.value * 12 / 15850, L(), 0)} US$</div>
      </div>
      <div class="sidefig">
        <div class="sidefig__label">${t('page.wage.vsLowest')}</div>
        <div class="sidefig__value">${gap > 0 ? '+' : ''}${num(gap, L(), 1)}%</div>
        <div class="sidefig__note">${lowest.name}: ${idr(lowest.value, L(), 2)}</div>
      </div>`;
  };

  barList($('#wageList'), {
    items,
    format: (v) => `Rp ${num(v, L())}`,
    color: (i) => `hsl(${172 - i * 12} 72% ${64 - i * 1.4}%)`,
    subtitleOf: (item) => `${item.province} · ${item.kind}`,
    onPick: (item) => {
      for (const row of $('#wageList').querySelectorAll('.barrow')) {
        row.classList.toggle('is-on', row.dataset.id === item.id);
      }
      detail(item);
    },
  });
  $('#wageList').querySelector('.barrow')?.classList.add('is-on');
  detail(items[0]);
}

// ── Sex composition ─────────────────────────────────────────────────────
function renderSex() {
  const census = HISTORY.sexSplit.census2020;
  const male = { value: census.male, label: t('page.sex.male'), color: '#5b9cf5' };
  const female = { value: census.female, label: t('page.sex.female'), color: '#ff6f9c' };

  const donut = splitDonut($('#sexDonut'), { a: male, b: female, format: (v) => num(v, L()) });

  $('#sexLegend').innerHTML = [male, female]
    .map((side, i) => `
      <button type="button" class="dleg" data-side="${i}">
        <i style="background:${side.color}"></i>
        <span>${side.label}</span>
        <b>${compact(side.value, L(), 2)} · ${pct(side.value / census.total * 100, L(), 2)}</b>
      </button>`)
    .join('');
  for (const btn of $('#sexLegend').querySelectorAll('.dleg')) {
    const side = btn.dataset.side === '0' ? male : female;
    btn.addEventListener('pointerenter', () => donut.highlight(side));
    btn.addEventListener('pointerleave', () => donut.reset());
    btn.addEventListener('focus', () => donut.highlight(side));
    btn.addEventListener('blur', () => donut.reset());
  }

  $('#sexNote').textContent =
    `${t('page.sex.note')} ${isId() ? 'Sensus Penduduk' : 'Census'} ${census.year} · BPS.`;

  ratioChart?.destroy();
  ratioChart = timeChart($('#ratioChart'), {
    series: [{
      id: 'ratio',
      label: t('page.sex.ratioSub'),
      color: '#8b7bff', axis: 'left', kind: 'area',
      points: HISTORY.sexRatio.map((d) => ({ year: d.year, value: d.value, anchor: true })),
    }],
    format: (value) => num(value, L(), 1),
    formatAxis: (value) => num(value, L(), 0),
  });
}

// ── Investors ───────────────────────────────────────────────────────────
function renderInvestors() {
  const investors = HISTORY.investors;
  const latest = investors.find((d) => !d.estimated && d.year === 2024) ?? investors.at(-1);
  const first = investors[0];

  sidChart?.destroy();
  sidChart = timeChart($('#sidChart'), {
    series: [
      {
        id: 'total', label: t('page.sid.total'), color: '#46e3d0', axis: 'left', kind: 'area',
        points: investors.map((d) => ({ year: d.year, value: d.total, estimated: d.estimated, anchor: !d.estimated })),
      },
      {
        id: 'stocks', label: t('page.sid.stocks'), color: '#f5c451', axis: 'left', kind: 'line',
        points: investors.filter((d) => d.stocks).map((d) => ({ year: d.year, value: d.stocks, estimated: d.estimated })),
      },
    ],
    format: (value) => compact(value, L(), 2),
    formatAxis: (value) => compactTight(value, L(), 0),
  });

  $('#sidLegend').innerHTML = `
    <span><i style="background:#46e3d0"></i>${t('page.sid.total')}</span>
    <span><i style="background:#f5c451"></i>${t('page.sid.stocks')}</span>`;

  const perInvestor = Math.round(DATA.national.provincePopulationSum / latest.total);
  $('#sidStats').innerHTML = `
    <div class="sidefig">
      <div class="sidefig__label">${t('page.sid.penetration')}</div>
      <div class="sidefig__value">${pct(latest.penetration, L(), 2)}</div>
      <div class="sidefig__note">${compact(latest.total, L(), 2)} SID · ${latest.year} · KSEI</div>
    </div>
    <div class="sidefig">
      <div class="sidefig__label">${t('page.sid.oneIn')}</div>
      <div class="sidefig__value">${num(perInvestor, L())} <span class="u">${t('page.sid.people')}</span></div>
      <div class="sidefig__note">${isId() ? 'Dibanding penduduk' : 'Against a population of'} ${compact(DATA.national.provincePopulationSum, L(), 2)}</div>
    </div>
    <div class="sidefig">
      <div class="sidefig__label">${t('page.sid.growth')}</div>
      <div class="sidefig__value">${num(latest.total / first.total, L(), 1)}× <span class="u">${t('page.sid.fold')}</span></div>
      <div class="sidefig__note">${first.year}: ${compact(first.total, L(), 2)} → ${latest.year}: ${compact(latest.total, L(), 2)}</div>
    </div>`;
}

// ── Sources & build ─────────────────────────────────────────────────────
function renderSources() {
  const groups = isId()
    ? [
        { h: 'Penduduk & sosial', items: ['Sensus Penduduk BPS 1961–2020', 'Proyeksi penduduk BPS 2024–2025', 'Sakernas & Susenas BPS (kerja, kemiskinan, Gini, IPM)'] },
        { h: 'Ekonomi', items: ['PDB nominal USD — Bank Dunia & IMF World Economic Outlook', 'Pertumbuhan PDB riil & inflasi — BPS', 'PDRB provinsi 2024 — BPS, dikalibrasi ke pangsa pulau'] },
        { h: 'Pasar modal & upah', items: ['KSEI — Single Investor Identification, akhir tahun', 'Keputusan gubernur UMK/UMP 2025'] },
      ]
    : [
        { h: 'Population & social', items: ['BPS population censuses 1961–2020', 'BPS population projections 2024–2025', 'BPS labour and welfare surveys (employment, poverty, Gini, HDI)'] },
        { h: 'Economy', items: ['Nominal GDP in USD — World Bank & IMF World Economic Outlook', 'Real GDP growth and inflation — BPS', 'Provincial GRDP 2024 — BPS, calibrated to island-group shares'] },
        { h: 'Capital markets & wages', items: ['KSEI — Single Investor Identification, year end', '2025 provincial governor minimum wage decrees'] },
      ];

  $('#sources').innerHTML = groups
    .map((g) => `<div class="srcgroup"><h3>${g.h}</h3><ul>${g.items.map((i) => `<li>${i}</li>`).join('')}</ul></div>`)
    .join('');

  $('#buildStamp').textContent = `${t('page.build')} ${BUILD.version} · ${BUILD.date} · ${BUILD.name}`;
}

// ── Boot ────────────────────────────────────────────────────────────────
function renderAll() {
  renderHero();
  renderMainChart();
  renderTimeline();
  renderLatest();
  renderWages();
  renderSex();
  renderInvestors();
  renderSources();
  if (selectedYear !== null) selectMilestone(selectedYear);
}

for (const btn of document.querySelectorAll('[data-lang-set]')) {
  btn.addEventListener('click', () => {
    setLang(btn.dataset.langSet);
    for (const other of document.querySelectorAll('[data-lang-set]')) {
      other.classList.toggle('is-on', other === btn);
    }
  });
}
onLang(renderAll);

for (const btn of document.querySelectorAll('[data-scale]')) {
  btn.addEventListener('click', () => {
    for (const other of document.querySelectorAll('[data-scale]')) {
      other.classList.toggle('is-on', other === btn);
    }
    mainChart?.setScale(btn.dataset.scale);
  });
}

renderAll();

// A #1998 deep link opens straight on that moment — or on the nearest one, so
// #1965 lands on the 1966 entry rather than silently doing nothing.
const requested = Number(location.hash.replace('#', ''));
if (Number.isFinite(requested) && requested > 1900) {
  const nearest = HISTORY.milestones.reduce((best, m) =>
    Math.abs(m.year - requested) < Math.abs(best.year - requested) ? m : best);
  selectMilestone(nearest.year, { scroll: true });
}
