/** Two-language copy deck. Indonesian is the default; English mirrors it. */

export const STRINGS = {
  id: {
    'boot.sub': 'Menyusun 34 unit provinsi & 17.380 pulau',
    'brand.sub': 'Demografi & ekonomi Republik Indonesia',
    'kpi.head': 'Republik Indonesia',
    'kpi.pop': 'Jumlah penduduk',
    'kpi.popNote': 'Proyeksi BPS, pertengahan 2025',
    'kpi.rank4': 'peringkat 4 dunia',
    'kpi.rank16': 'peringkat 16 dunia',
    'kpi.rank8': 'peringkat 8 dunia',
    'kpi.nominal': 'nominal',
    'kpi.percap': 'per kapita',
    'kpi.growth': 'Pertumbuhan ekonomi',
    'kpi.growthNote': 'Tahunan 2024 · BPS',
    'unit.million': 'juta',
    'spark.title': 'PDB nominal & penduduk',
    'spark.pop': 'Penduduk',
    'fact.prov': 'provinsi',
    'fact.reg': 'kab./kota',
    'fact.isl': 'pulau',
    'rank.foot': 'Klik untuk memusatkan kamera',
    'rank.title': 'Peringkat provinsi',
    'hint': 'Seret untuk memutar · gulir untuk zoom · klik provinsi untuk detail',
    'about.title': 'Sumber & metodologi',

    'metric.population': 'Penduduk',
    'metric.density': 'Kepadatan',
    'metric.gdp': 'PDRB',
    'metric.gdpPerCapita': 'PDRB per kapita',
    'metric.population.short': 'Penduduk',
    'metric.density.short': 'Kepadatan',
    'metric.gdp.short': 'PDRB',
    'metric.gdpPerCapita.short': 'PDRB/kapita',
    'metric.population.long': 'Jumlah penduduk',
    'metric.density.long': 'Kepadatan penduduk',
    'metric.gdp.long': 'Produk domestik regional bruto',
    'metric.gdpPerCapita.long': 'PDRB per kapita',
    'metric.population.unit': 'jiwa',
    'metric.density.unit': 'jiwa/km²',
    'metric.gdp.unit': 'rupiah, harga berlaku 2024',
    'metric.gdpPerCapita.unit': 'rupiah per jiwa, 2024',

    'detail.province': 'Provinsi',
    'detail.capital': 'Ibu kota',
    'detail.population': 'Penduduk (2024)',
    'detail.area': 'Luas daratan',
    'detail.density': 'Kepadatan (2024)',
    'detail.gdp': 'PDRB 2024',
    'detail.gdpUsd': 'PDRB (USD)',
    'detail.gdpPerCapita': 'PDRB per kapita 2024',
    'detail.shareGdp': 'Pangsa PDB nasional',
    'detail.sharePop': 'Pangsa penduduk nasional',
    'detail.merged': 'Poligon ini masih memakai batas sebelum pemekaran 2022 dan mencakup: ',

    'year.pop': 'penduduk',
    'year.gdp': 'PDB',
    'year.growth': 'pertumbuhan',
    'year.est': 'estimasi',
  },
  en: {
    'boot.sub': 'Assembling 34 province units & 17,380 islands',
    'brand.sub': 'Demographics & economy of the Republic of Indonesia',
    'kpi.head': 'Republic of Indonesia',
    'kpi.pop': 'Total population',
    'kpi.popNote': 'BPS projection, mid-2025',
    'kpi.rank4': '4th largest worldwide',
    'kpi.rank16': '16th largest worldwide',
    'kpi.rank8': '8th largest worldwide',
    'kpi.nominal': 'nominal',
    'kpi.percap': 'per capita',
    'kpi.growth': 'Real GDP growth',
    'kpi.growthNote': 'Full year 2024 · BPS',
    'unit.million': 'million',
    'spark.title': 'Nominal GDP & population',
    'spark.pop': 'Population',
    'fact.prov': 'provinces',
    'fact.reg': 'regencies/cities',
    'fact.isl': 'islands',
    'rank.foot': 'Click to centre the camera',
    'rank.title': 'Province ranking',
    'hint': 'Drag to orbit · scroll to zoom · click a province for detail',
    'about.title': 'Sources & methodology',

    'metric.population': 'Population',
    'metric.density': 'Density',
    'metric.gdp': 'GRDP',
    'metric.gdpPerCapita': 'GRDP per capita',
    'metric.population.short': 'Population',
    'metric.density.short': 'Density',
    'metric.gdp.short': 'GRDP',
    'metric.gdpPerCapita.short': 'GRDP/capita',
    'metric.population.long': 'Total population',
    'metric.density.long': 'Population density',
    'metric.gdp.long': 'Gross regional domestic product',
    'metric.gdpPerCapita.long': 'GRDP per capita',
    'metric.population.unit': 'people',
    'metric.density.unit': 'people/km²',
    'metric.gdp.unit': 'rupiah, current prices 2024',
    'metric.gdpPerCapita.unit': 'rupiah per person, 2024',

    'detail.province': 'Province',
    'detail.capital': 'Capital',
    'detail.population': 'Population (2024)',
    'detail.area': 'Land area',
    'detail.density': 'Density (2024)',
    'detail.gdp': 'GRDP 2024',
    'detail.gdpUsd': 'GRDP (USD)',
    'detail.gdpPerCapita': 'GRDP per capita 2024',
    'detail.shareGdp': 'Share of national GDP',
    'detail.sharePop': 'Share of national population',
    'detail.merged': 'This polygon still uses pre-2022 boundaries and covers: ',

    'year.pop': 'population',
    'year.gdp': 'GDP',
    'year.growth': 'growth',
    'year.est': 'estimate',
  },
};

let current = 'id';
const listeners = new Set();

export const lang = () => current;
export const t = (key) => STRINGS[current][key] ?? STRINGS.id[key] ?? key;

export function setLang(next) {
  if (!STRINGS[next] || next === current) return;
  current = next;
  document.documentElement.lang = next;
  document.documentElement.dataset.lang = next;
  for (const el of document.querySelectorAll('[data-i18n]')) {
    el.textContent = t(el.dataset.i18n);
  }
  listeners.forEach((fn) => fn(next));
}

export function onLang(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
