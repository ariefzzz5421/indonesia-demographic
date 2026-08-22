/**
 * Everything on the glass: KPI counters, the ranking rail, metric tabs, the
 * year scrubber, the province detail card, the hover tooltip and the sources
 * modal. The HUD owns no 3D state — main.js feeds it slices and forwards its
 * callbacks to the map.
 */

import {
  METRICS, METRIC_ORDER, metricLabel, metricShort, metricLong, metricUnit, normaliser,
} from '../metrics.js';
import { rampCss, rampGradient } from '../util/color.js';
import { animateCounter, compact, compactTight, idr, num, pct, usd } from '../util/format.js';
import { lang, onLang, setLang, t } from '../util/i18n.js';
import { HISTORY } from '../data/history.js';
import { BUILD } from '../version.js';
import { timeChart } from './charts.js';

const $ = (sel) => document.querySelector(sel);

export function createHud({ data, onMetric, onYear, onHover, onSelect, onReset }) {
  const { national, series, provinces } = data;
  const byId = new Map(provinces.map((p) => [p.id, p]));
  const REF_YEAR = 2024;
  const refSlice = series.find((s) => s.year === REF_YEAR);
  const maxSlice = series.at(-1);

  let metricId = 'population';
  let year = maxSlice.year;
  let selectedId = null;
  let playing = false;
  let playAccum = 0;

  // ── Year scaling ─────────────────────────────────────────────────
  // Provincial data is a 2024 cross-section. The scrubber moves the *national*
  // aggregate and rescales every province by the same national index, holding
  // the 2024 inter-provincial structure fixed. Stated plainly in the modal.
  function factor(id, y) {
    const slice = series.find((s) => s.year === y) ?? refSlice;
    if (id === 'gdp') return slice.gdpUsd / refSlice.gdpUsd;
    if (id === 'gdpPerCapita') return slice.gdpPerCapitaUsd / refSlice.gdpPerCapitaUsd;
    return slice.population / refSlice.population;   // population & density
  }

  /** Province values for the active metric at a given year. */
  function valuesFor(id, y) {
    const metric = METRICS[id];
    const k = factor(id, y);
    return new Map(provinces.map((p) => [p.id, metric.accessor(p) * k]));
  }

  // Normalisation extent is pinned to the largest year so earlier years
  // genuinely read as a shorter, dimmer archipelago.
  const extents = Object.fromEntries(
    METRIC_ORDER.map((id) => {
      const k = factor(id, maxSlice.year);
      const scaled = provinces.map((p) => ({ v: METRICS[id].accessor(p) * k }));
      const n = normaliser({ ...METRICS[id], accessor: (d) => d.v }, scaled);
      return [id, n];
    })
  );

  const slice = () => {
    const values = valuesFor(metricId, year);
    const n = extents[metricId];
    return { values, norm: (v) => n.normValue(v), metric: METRICS[metricId] };
  };

  // ── Static chrome ────────────────────────────────────────────────
  const hud = $('#hud');
  const tip = $('#tip');
  const detail = $('#detail');
  const rankList = $('#rankList');
  const legendBar = $('#legendBar');
  // The rail chart covers the whole national story, 1945 to now — far wider
  // than the map's own 2015-2025 scrubber. Clicking a year inside the
  // scrubber's range moves the map with it; clicking outside just reads out.
  const railChart = timeChart($('#railChart'), {
    compact: true,
    series: [
      {
        id: 'pop', label: t('spark.pop'), color: '#46e3d0', axis: 'left', kind: 'line', dash: true,
        points: HISTORY.population.map((d) => ({ year: d.year, value: d.value, anchor: d.anchor, basis: d.basis })),
      },
      {
        id: 'gdp', label: 'PDB', color: '#f5c451', axis: 'right', kind: 'area',
        points: HISTORY.gdpUsd.map((d) => ({ year: d.year, value: d.value, estimated: d.estimated })),
      },
    ],
    markers: HISTORY.milestones.map((m) => ({
      year: m.year,
      label: lang() === 'id' ? m.title : m.titleEn,
      color: HISTORY.eras.find((e) => e.id === m.era)?.color ?? '#8b7bff',
    })),
    format: (value, id) => (id === 'gdp' ? usd(value, lang(), 2) : compact(value, lang(), 2)),
    formatAxis: (value, axis) => (axis === 'right' ? `US$${compactTight(value, lang(), 0)}` : compactTight(value, lang(), 0)),
    onPick: (year) => {
      if (year >= series[0].year && year <= maxSlice.year) setYear(year);
    },
  });
  const sparkHighlight = (year) => railChart.focus(year);

  $('#yearTicks').replaceChildren(
    ...[series[0].year, 2018, 2020, 2022, maxSlice.year].map((y) => {
      const s = document.createElement('span');
      s.textContent = String(y);
      return s;
    })
  );

  const yearRange = $('#yearRange');
  yearRange.min = String(series[0].year);
  yearRange.max = String(maxSlice.year);
  yearRange.value = String(year);

  // ── Metric tabs ──────────────────────────────────────────────────
  const tabs = $('#metricTabs');
  const narrow = matchMedia('(max-width: 760px)');
  function renderTabs() {
    tabs.replaceChildren(
      ...METRIC_ORDER.map((id) => {
        const b = document.createElement('button');
        b.className = 'tab' + (id === metricId ? ' is-on' : '');
        b.type = 'button';
        b.setAttribute('role', 'tab');
        b.setAttribute('aria-selected', String(id === metricId));
        const label = narrow.matches ? metricShort(id) : metricLabel(id);
        b.innerHTML = `<i style="background:${METRICS[id].accent}"></i>${label}`;
        b.addEventListener('click', () => setMetric(id));
        return b;
      })
    );
  }

  // ── Ranking ──────────────────────────────────────────────────────
  let rankNodes = new Map();
  function renderRank() {
    const { values, norm, metric } = slice();
    const sorted = [...provinces].sort((a, b) => values.get(b.id) - values.get(a.id));

    rankNodes = new Map();
    rankList.replaceChildren(
      ...sorted.map((p, i) => {
        const value = values.get(p.id);
        const tNorm = Math.min(1, Math.max(0, norm(value)));
        const li = document.createElement('li');
        li.className = 'rank__item' + (p.id === selectedId ? ' is-sel' : '');
        li.dataset.id = p.id;
        li.innerHTML = `
          <span class="rank__n">${i + 1}</span>
          <span class="rank__body">
            <span class="rank__name">${p.name}</span>
            <span class="rank__meter"><i style="width:${(tNorm * 100).toFixed(1)}%;background:${rampCss(metric.ramp, tNorm)}"></i></span>
          </span>
          <span class="rank__val">${metric.format(value, lang())}</span>`;
        li.addEventListener('pointerenter', () => onHover?.(p.id, 'list'));
        li.addEventListener('pointerleave', () => onHover?.(null, 'list'));
        li.addEventListener('click', () => onSelect?.(p.id, 'list'));
        rankNodes.set(p.id, li);
        return li;
      })
    );
    $('#rankTitle').textContent = `${t('rank.title')} · ${metricLabel(metricId)}`;
  }

  function renderLegend() {
    const metric = METRICS[metricId];
    const { values } = slice();
    const all = [...values.values()];
    legendBar.style.background = rampGradient(metric.ramp);
    $('.legend__lo').textContent = metric.format(Math.min(...all), lang());
    $('.legend__hi').textContent = metric.format(Math.max(...all), lang());
  }

  // ── Year readout ─────────────────────────────────────────────────
  function renderYear() {
    const s = series.find((d) => d.year === year) ?? maxSlice;
    $('#yearLabel').textContent = String(year);
    const growth = `${s.growth > 0 ? '+' : ''}${num(s.growth, lang(), 2)}%`;
    const est = year === maxSlice.year ? ` · ${t('year.est')}` : '';
    $('#yearMeta').innerHTML =
      `${compact(s.population, lang(), 1)} ${t('year.pop')}<br>${usd(s.gdpUsd, lang(), 2)} · ${growth}${est}`;
    sparkHighlight(year);
  }

  // ── KPI counters ─────────────────────────────────────────────────
  function renderKpis(animate) {
    const map = [
      ['population', national.populationLatest, (v) => compact(v, lang(), 2)],
      ['gdp', national.gdpNominalUsd, (v) => compactTight(v, lang(), 2)],
      ['gdppc', national.gdpPerCapitaUsd, (v) => num(v, lang(), 0)],
    ];
    for (const [key, value, fmt] of map) {
      const el = document.querySelector(`[data-count="${key}"]`);
      if (!el) continue;
      if (animate) animateCounter(el, value * 0.72, value, 1500, fmt);
      else el.textContent = fmt(value);
    }
  }

  // ── Detail card ──────────────────────────────────────────────────
  function renderDetail(id) {
    const p = id ? byId.get(id) : null;
    hud.classList.toggle('has-detail', Boolean(p));
    if (!p) { detail.hidden = true; return; }
    const L = lang();

    $('#dEyebrow').textContent = t('detail.province');
    $('#dName').textContent = p.name;
    $('#dCap').textContent = `${t('detail.capital')}: ${p.capital}`;

    const rows = [
      [t('detail.population'), num(p.population, L)],
      [t('detail.area'), `${num(p.areaKm2, L)} km²`],
      [t('detail.density'), `${num(p.density, L, 1)} /km²`],
      [t('detail.gdp'), idr(p.gdpIdr, L, 2)],
      [t('detail.gdpPerCapita'), idr(p.gdpPerCapitaIdr, L, 1)],
      [t('detail.gdpUsd'), usd(p.gdpUsd, L, 2)],
    ];
    $('#dRows').innerHTML = rows
      .map(([k, v]) => `<div class="drow"><span class="drow__k">${k}</span><span class="drow__v">${v}</span></div>`)
      .join('');

    const popShare = (p.population / national.provincePopulationSum) * 100;
    const bars = [
      [t('detail.sharePop'), popShare, '#46e3d0'],
      [t('detail.shareGdp'), p.gdpShare, '#f5c451'],
    ];
    $('#dBars').innerHTML = bars
      .map(([k, v, c]) => `
        <div class="dbar">
          <div class="dbar__top"><span>${k}</span><span>${pct(v, L, 2)}</span></div>
          <div class="dbar__track"><i style="width:${Math.min(100, v * 3.4).toFixed(1)}%;background:${c}"></i></div>
        </div>`)
      .join('');

    const note = $('#dNote');
    if (p.merged) {
      note.hidden = false;
      note.textContent = t('detail.merged') + p.merged.join(', ') + '.';
    } else {
      note.hidden = true;
    }
    detail.hidden = false;
  }

  // ── Tooltip ──────────────────────────────────────────────────────
  function showTip(id, x, y) {
    const p = byId.get(id);
    if (!p) return hideTip();
    const { values, metric } = slice();
    $('#tipName').textContent = p.name;
    $('#tipVal').textContent = metric.format(values.get(id), lang());
    $('#tipSub').textContent = `${metricLong(metricId)} · ${metricUnit(metricId)}`;
    tip.hidden = false;
    tip.style.left = `${x}px`;
    tip.style.top = `${y}px`;
  }
  const hideTip = () => { tip.hidden = true; };

  // ── Public setters ───────────────────────────────────────────────
  function setMetric(id, silent) {
    if (!METRICS[id]) return;
    metricId = id;
    renderTabs();
    renderRank();
    renderLegend();
    if (!silent) onMetric?.(slice());
  }

  function setYear(next, silent) {
    const clamped = Math.min(maxSlice.year, Math.max(series[0].year, Math.round(next)));
    if (clamped === year) return;
    year = clamped;
    yearRange.value = String(year);
    renderYear();
    renderRank();
    renderLegend();
    if (!silent) onYear?.(slice());
  }

  function setSelected(id) {
    selectedId = id;
    for (const [pid, node] of rankNodes) node.classList.toggle('is-sel', pid === id);
    rankNodes.get(id)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    renderDetail(id);
  }

  function setHovered(id) {
    for (const [pid, node] of rankNodes) node.classList.toggle('is-hot', pid === id);
  }

  /** Top entries for the floating 3D labels. */
  function leaders(n = 6) {
    const { values, metric } = slice();
    return [...provinces]
      .sort((a, b) => values.get(b.id) - values.get(a.id))
      .slice(0, n)
      .map((p) => ({ id: p.id, text: `${p.name} · ${metric.format(values.get(p.id), lang())}` }));
  }

  // ── Playback ─────────────────────────────────────────────────────
  const playBtn = $('#btnPlay');
  function setPlaying(next) {
    playing = next;
    playBtn.querySelector('.ico-play').hidden = playing;
    playBtn.querySelector('.ico-pause').hidden = !playing;
  }
  playBtn.addEventListener('click', () => {
    if (!playing && year === maxSlice.year) setYear(series[0].year);
    setPlaying(!playing);
  });
  function tickPlayback(dt) {
    if (!playing) return;
    playAccum += dt;
    if (playAccum < 0.62) return;
    playAccum = 0;
    if (year >= maxSlice.year) { setPlaying(false); return; }
    setYear(year + 1);
  }

  yearRange.addEventListener('input', () => {
    setPlaying(false);
    setYear(Number(yearRange.value));
  });

  // ── Modal ────────────────────────────────────────────────────────
  const about = $('#about');
  const ABOUT = {
    id: `
      <h4>Data</h4>
      <ul>
        <li><b>Penduduk, luas wilayah, PDB &amp; PDRB</b> — Badan Pusat Statistik (BPS). Angka nasional 284.438.782 jiwa adalah proyeksi BPS pertengahan 2025; data provinsi adalah potret 2024.</li>
        <li><b>PDB nominal &amp; PDB per kapita dalam USD</b> — IMF World Economic Outlook dan Bank Dunia. Kurs rata-rata 2024: Rp 15.850/US$.</li>
        <li><b>Pangsa PDB menurut kelompok pulau</b> — BPS, struktur ekonomi spasial 2024.</li>
      </ul>
      <h4>Kalibrasi PDRB</h4>
      <p>PDRB tiap provinsi merupakan estimasi terbaik yang kemudian dikalibrasi: seluruh provinsi dalam satu kelompok pulau dikalikan satu faktor agar totalnya persis sama dengan pangsa resmi BPS 2024. Faktor koreksi berkisar 0,96–1,00. Dengan cara ini total PDRB seluruh provinsi tepat sama dengan PDB nasional Rp 22.138,9 triliun.</p>
      <h4>Geometri peta</h4>
      <p>Peta memakai 34 poligon provinsi dari peta dasar BAKOSURTANAL/BIG skala 1:250.000. Indonesia kini memiliki 38 provinsi setelah pemekaran Papua 2022, sehingga empat provinsi baru digabung ke poligon induknya: <code>Papua</code> mencakup Papua Tengah, Papua Pegunungan, dan Papua Selatan; <code>Papua Barat</code> mencakup Papua Barat Daya.</p>
      <h4>Penggeser tahun</h4>
      <p>Data provinsi hanya tersedia untuk 2024. Penggeser tahun menggerakkan agregat nasional (2015–2025) dan menskalakan seluruh provinsi dengan indeks nasional yang sama — struktur antarprovinsi tetap pada pola 2024. Jadi tinggi kolom pada tahun 2015 menunjukkan skala nasional saat itu, bukan sebaran provinsi yang sesungguhnya pada tahun tersebut.</p>
      <h4>Catatan</h4>
      <p>Jumlah penduduk 34 unit provinsi (2024) sedikit berbeda dari total nasional BPS karena pembulatan pada estimasi provinsi.</p>`,
    en: `
      <h4>Data</h4>
      <ul>
        <li><b>Population, land area, GDP &amp; GRDP</b> — Statistics Indonesia (BPS). The national figure of 284,438,782 is the BPS mid-2025 projection; provincial figures are a 2024 cross-section.</li>
        <li><b>Nominal and per-capita GDP in USD</b> — IMF World Economic Outlook and the World Bank. 2024 average rate: Rp 15,850/US$.</li>
        <li><b>Share of GDP by island group</b> — BPS spatial economic structure, 2024.</li>
      </ul>
      <h4>GRDP calibration</h4>
      <p>Provincial GRDP starts from best-available published estimates and is then calibrated: every province within an island group is scaled by a single factor so the group sums exactly to the official BPS 2024 share. Correction factors range from 0.96 to 1.00. Provincial GRDP therefore reconciles exactly to national GDP of Rp 22,138.9 trillion.</p>
      <h4>Map geometry</h4>
      <p>The map uses 34 province polygons from the BAKOSURTANAL/BIG 1:250,000 base map. Indonesia has had 38 provinces since the 2022 Papua split, so the four new provinces are folded into their parents: <code>Papua</code> covers Papua Tengah, Papua Pegunungan and Papua Selatan; <code>Papua Barat</code> covers Papua Barat Daya.</p>
      <h4>The year scrubber</h4>
      <p>Provincial data exists only for 2024. The scrubber moves the national aggregate (2015–2025) and rescales every province by that same national index, holding the 2024 inter-provincial structure fixed. Column heights in 2015 therefore show the national scale of that year, not the true provincial distribution at the time.</p>
      <h4>Note</h4>
      <p>The 34 map units sum to slightly less than the BPS national total for 2024 because of rounding in the provincial estimates.</p>`,
  };

  // The build stamp is here so "am I looking at the latest version?" has an
  // answer on screen rather than a guess about the cache.
  const aboutHtml = () => `${ABOUT[lang()]}
    <h4>${t('page.build')}</h4>
    <p><code>${BUILD.version}</code> · ${BUILD.date} · ${BUILD.name}</p>`;
  const openAbout = () => { $('#aboutBody').innerHTML = aboutHtml(); about.hidden = false; };
  const closeAbout = () => { about.hidden = true; };
  $('#btnAbout').addEventListener('click', openAbout);
  $('#aboutClose').addEventListener('click', closeAbout);
  about.addEventListener('click', (e) => { if (e.target === about) closeAbout(); });

  $('#detailClose').addEventListener('click', () => onSelect?.(null, 'ui'));
  $('#btnReset').addEventListener('click', () => onReset?.());

  for (const btn of document.querySelectorAll('[data-lang-set]')) {
    btn.addEventListener('click', () => {
      setLang(btn.dataset.langSet);
      for (const other of document.querySelectorAll('[data-lang-set]')) {
        other.classList.toggle('is-on', other === btn);
      }
    });
  }

  onLang(() => {
    renderTabs();
    renderRank();
    renderLegend();
    renderYear();
    renderKpis(false);
    renderDetail(selectedId);
    if (!about.hidden) $('#aboutBody').innerHTML = aboutHtml();
  });

  narrow.addEventListener('change', renderTabs);

  addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeAbout(); onSelect?.(null, 'ui'); }
    if (e.key === 'ArrowLeft') setYear(year - 1);
    if (e.key === 'ArrowRight') setYear(year + 1);
    if (e.key === ' ' && e.target === document.body) { e.preventDefault(); playBtn.click(); }
  });

  function reveal() {
    hud.hidden = false;
    renderKpis(true);
  }

  renderTabs();
  renderRank();
  renderLegend();
  renderYear();
  renderKpis(false);

  return {
    reveal, slice, setMetric, setYear, setSelected, setHovered,
    showTip, hideTip, leaders, tickPlayback,
    get metricId() { return metricId; },
    get year() { return year; },
  };
}
