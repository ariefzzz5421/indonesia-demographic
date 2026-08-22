/**
 * Interactive UMK/UMP comparison card for the Indonesia page.
 * Uses only the wage dataset already shown on the page and has dependency-free
 * PNG + PDF export so the feature still works on a static Vercel deployment.
 */
import { HISTORY } from './data/history.js';
import { lang, onLang } from './util/i18n.js';

const wageSection = document.getElementById('sect-wages');
const wageList = document.getElementById('wageList');

if (wageSection && wageList) {
  const asset = (file) => new URL(`../assets/region-logos/${file}`, import.meta.url).href;
  const LOGOS = {
    'Kota Bekasi': asset('kota-bekasi.png'),
    'Kabupaten Karawang': asset('kabupaten-karawang.png'),
    'Kabupaten Bekasi': asset('kabupaten-bekasi.png'),
    'DKI Jakarta': asset('dki-jakarta.png'),
    'Kota Depok': asset('kota-depok.png'),
    'Kota Cilegon': asset('kota-cilegon.png'),
    'Kota Bogor': asset('kota-bogor.png'),
    'Kota Tangerang Selatan': asset('kota-tangerang-selatan.png'),
    'Kota Surabaya': asset('kota-surabaya.png'),
    'Kabupaten Tangerang': asset('kabupaten-tangerang.png'),
  };

  const WAGES = HISTORY.wages.map((item, index) => ({
    ...item,
    rank: index + 1,
    annual: item.value * 12,
  }));
  const byName = new Map(WAGES.map((item) => [item.name, item]));

  const COPY = {
    id: {
      eyebrow: 'Bandingkan UMK / UMP',
      title: 'Bandingkan upah minimum antar daerah',
      lead: 'Pilih dua daerah dari Top 10 UMK/UMP 2025. Lihat selisih nominal, rasio, persentase, nilai tahunan, lalu unduh detailnya.',
      areaA: 'Daerah A', areaB: 'Daerah B', annual: 'Setahun', rank: 'Peringkat',
      gap: 'Selisih nominal', ratio: 'Rasio A : B', percent: 'Selisih % vs B', summary: 'Kesimpulan',
      higher: 'lebih tinggi dari', lower: 'lebih rendah dari', equal: 'sama dengan',
      png: 'Download PNG', pdf: 'Download PDF', exporting: 'Membuat file…',
      note: 'Perbandingan memakai dataset Top 10 UMK/UMP 2025 yang tersedia di halaman ini.',
      crest: 'Lambang',
    },
    en: {
      eyebrow: 'Compare UMK / UMP',
      title: 'Compare regional minimum wages',
      lead: 'Choose two regions from the Top 10 2025 wage list. Compare the nominal gap, ratio, percentage difference and annualized value, then download the details.',
      areaA: 'Region A', areaB: 'Region B', annual: 'Annualized', rank: 'Rank',
      gap: 'Nominal gap', ratio: 'A : B ratio', percent: '% difference vs B', summary: 'Summary',
      higher: 'higher than', lower: 'lower than', equal: 'equal to',
      png: 'Download PNG', pdf: 'Download PDF', exporting: 'Preparing file…',
      note: 'Comparison uses the Top 10 2025 UMK/UMP dataset available on this page.',
      crest: 'Emblem',
    },
  };

  const L = () => lang();
  const copy = () => COPY[L()] ?? COPY.id;
  const rupiah = (value) => new Intl.NumberFormat(L() === 'id' ? 'id-ID' : 'en-US', {
    style: 'currency', currency: 'IDR', maximumFractionDigits: 0,
  }).format(value).replace(/\u00a0/g, ' ');
  const decimal = (value, digits = 2) => new Intl.NumberFormat(L() === 'id' ? 'id-ID' : 'en-US', {
    minimumFractionDigits: digits, maximumFractionDigits: digits,
  }).format(value);

  const style = document.createElement('style');
  style.textContent = `
    #wageCompare{margin-top:14px;padding:20px}
    #wageCompare .wc-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;flex-wrap:wrap}
    #wageCompare .wc-head>div:first-child{max-width:700px}
    #wageCompare .wc-title{margin:0;font-size:21px;line-height:1.18;font-weight:650;letter-spacing:-.022em;color:var(--fg)}
    #wageCompare .wc-lead{margin:9px 0 0;font-size:12px;line-height:1.65;color:var(--fg-3)}
    #wageCompare .wc-actions{display:flex;gap:8px;flex-wrap:wrap}
    #wageCompare .wc-export,#wageCompare .wc-swap{border:1px solid var(--line);background:rgba(255,255,255,.045);color:var(--fg-2);border-radius:10px;font:600 11px var(--font);transition:.2s var(--ease);cursor:pointer}
    #wageCompare .wc-export{padding:9px 12px;min-width:112px}
    #wageCompare .wc-export:hover,#wageCompare .wc-swap:hover{color:var(--fg);border-color:var(--line-2);background:rgba(255,255,255,.08);transform:translateY(-1px)}
    #wageCompare .wc-export:disabled{opacity:.55;cursor:wait;transform:none}
    #wageCompare .wc-controls{display:grid;grid-template-columns:minmax(0,1fr) 42px minmax(0,1fr);gap:10px;align-items:end;margin-top:18px}
    #wageCompare .wc-field{display:grid;gap:6px}
    #wageCompare .wc-field>span{font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--fg-3)}
    #wageCompare select{appearance:none;width:100%;padding:11px 36px 11px 12px;border-radius:11px;border:1px solid var(--line);color:var(--fg);font:600 12px var(--font);background-color:rgba(4,12,22,.78);background-image:linear-gradient(45deg,transparent 50%,#8ea6c4 50%),linear-gradient(135deg,#8ea6c4 50%,transparent 50%);background-position:calc(100% - 16px) 50%,calc(100% - 11px) 50%;background-size:5px 5px,5px 5px;background-repeat:no-repeat;outline:none}
    #wageCompare select:focus{border-color:rgba(70,227,208,.48);box-shadow:0 0 0 3px rgba(70,227,208,.08)}
    #wageCompare .wc-swap{width:42px;height:42px;font-size:18px}
    #wageCompare .wc-result{margin-top:14px}
    #wageCompare .wc-cities{display:grid;grid-template-columns:minmax(0,1fr) 48px minmax(0,1fr);gap:10px;align-items:stretch}
    #wageCompare .wc-city{padding:15px;border:1px solid rgba(255,255,255,.065);border-radius:15px;background:linear-gradient(145deg,rgba(255,255,255,.04),rgba(255,255,255,.018))}
    #wageCompare .wc-citytop{display:flex;align-items:center;gap:11px}
    #wageCompare .wc-logo{display:grid;place-items:center;width:54px;height:54px;flex:none;overflow:hidden;border-radius:13px;border:1px solid rgba(255,255,255,.09);background:linear-gradient(145deg,rgba(255,255,255,.075),rgba(255,255,255,.025))}
    #wageCompare .wc-logo img{display:block;width:calc(100% - 6px);height:calc(100% - 6px);object-fit:contain;filter:drop-shadow(0 2px 4px rgba(0,0,0,.24))}
    #wageCompare .wc-side{font-size:8.5px;letter-spacing:.13em;text-transform:uppercase;color:var(--cyan);margin-bottom:2px}
    #wageCompare .wc-name{font-size:14px;font-weight:650;line-height:1.25;color:var(--fg)}
    #wageCompare .wc-meta{margin-top:3px;font-size:9.5px;line-height:1.4;color:var(--fg-3)}
    #wageCompare .wc-amount{margin-top:14px;font-size:22px;font-weight:700;letter-spacing:-.025em;color:var(--fg);font-variant-numeric:tabular-nums}
    #wageCompare .wc-annual{margin-top:4px;font-size:10.5px;color:var(--fg-3)}
    #wageCompare .wc-annual b{font-weight:600;color:var(--fg-2)}
    #wageCompare .wc-vs{display:grid;place-items:center;border:1px solid rgba(255,255,255,.06);border-radius:13px;color:var(--cyan);font:700 11px var(--mono);letter-spacing:.12em;background:rgba(255,255,255,.025)}
    #wageCompare .wc-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:10px}
    #wageCompare .wc-metric{min-width:0;padding:12px 13px;border-radius:13px;border:1px solid rgba(255,255,255,.06);background:rgba(255,255,255,.025)}
    #wageCompare .wc-metric span{display:block;font-size:8.8px;letter-spacing:.11em;text-transform:uppercase;color:var(--fg-3)}
    #wageCompare .wc-metric b{display:block;margin-top:6px;font-size:16px;line-height:1.35;font-weight:650;color:var(--fg);font-variant-numeric:tabular-nums}
    #wageCompare .wc-summary{grid-column:1/-1;border-color:rgba(70,227,208,.14);background:rgba(70,227,208,.035)}
    #wageCompare .wc-summary b{font-size:12.5px;line-height:1.55;color:var(--fg-2)}
    #wageCompare .wc-note{margin:12px 0 0;font-size:10px;line-height:1.5;color:var(--fg-3)}
    @media(max-width:760px){#wageCompare .wc-cities{grid-template-columns:1fr}#wageCompare .wc-vs{min-height:34px}#wageCompare .wc-metrics{grid-template-columns:1fr 1fr}#wageCompare .wc-summary{grid-column:1/-1}}
    @media(max-width:560px){#wageCompare{padding:15px}#wageCompare .wc-actions{width:100%}#wageCompare .wc-export{flex:1}#wageCompare .wc-controls{grid-template-columns:1fr 38px 1fr;gap:7px}#wageCompare .wc-swap{width:38px;height:40px}#wageCompare .wc-metrics{grid-template-columns:1fr}#wageCompare .wc-summary{grid-column:auto}#wageCompare .wc-amount{font-size:19px}}
  `;
  document.head.append(style);

  const card = document.createElement('section');
  card.id = 'wageCompare';
  card.className = 'card';
  card.innerHTML = `
    <div class="wc-head">
      <div><div class="sect__eyebrow wc-eyebrow"></div><h3 class="wc-title"></h3><p class="wc-lead"></p></div>
      <div class="wc-actions"><button type="button" class="wc-export" data-export="png"></button><button type="button" class="wc-export" data-export="pdf"></button></div>
    </div>
    <div class="wc-controls">
      <label class="wc-field"><span data-label="a"></span><select id="wageCompareA"></select></label>
      <button type="button" class="wc-swap" aria-label="Swap regions" title="Swap regions">⇄</button>
      <label class="wc-field"><span data-label="b"></span><select id="wageCompareB"></select></label>
    </div>
    <div class="wc-result"></div><p class="wc-note"></p>`;

  const split = wageSection.querySelector('.split');
  const note = wageSection.querySelector('.sect__note');
  split?.insertAdjacentElement('afterend', card);
  if (note) card.insertAdjacentElement('afterend', note);

  const selectA = card.querySelector('#wageCompareA');
  const selectB = card.querySelector('#wageCompareB');
  const result = card.querySelector('.wc-result');
  const pngButton = card.querySelector('[data-export="png"]');
  const pdfButton = card.querySelector('[data-export="pdf"]');

  const optionNodes = (selected) => WAGES.map((item) => {
    const option = document.createElement('option');
    option.value = item.name;
    option.textContent = `${item.rank}. ${item.name}`;
    option.selected = item.name === selected;
    return option;
  });
  selectA.replaceChildren(...optionNodes(WAGES[0].name));
  selectB.replaceChildren(...optionNodes(byName.has('Kota Bogor') ? 'Kota Bogor' : WAGES[1].name));

  const metrics = (a, b) => {
    const delta = a.value - b.value;
    return { delta, absDelta: Math.abs(delta), ratio: b.value ? a.value / b.value : 0, percent: b.value ? delta / b.value * 100 : 0 };
  };
  const summary = (a, b) => {
    const m = metrics(a, b);
    if (Math.abs(m.delta) < 1) return `${a.name} ${copy().equal} ${b.name} · ${decimal(m.ratio, 3)}×.`;
    return `${a.name} ${m.delta > 0 ? copy().higher : copy().lower} ${b.name}: ${rupiah(m.absDelta)} (${decimal(Math.abs(m.percent), 2)}%) · ${decimal(m.ratio, 3)}×.`;
  };

  function cityMarkup(item, side) {
    return `<article class="wc-city"><div class="wc-citytop"><span class="wc-logo"><img src="${LOGOS[item.name] ?? ''}" alt="${copy().crest} ${item.name}"></span><div><div class="wc-side">${side}</div><div class="wc-name">${item.name}</div><div class="wc-meta">${item.province} · ${item.kind} · ${copy().rank} #${item.rank}</div></div></div><div class="wc-amount">${rupiah(item.value)}</div><div class="wc-annual">${copy().annual}: <b>${rupiah(item.annual)}</b></div></article>`;
  }

  function render() {
    const a = byName.get(selectA.value) ?? WAGES[0];
    const b = byName.get(selectB.value) ?? WAGES[1];
    const m = metrics(a, b);
    card.querySelector('.wc-eyebrow').textContent = copy().eyebrow;
    card.querySelector('.wc-title').textContent = copy().title;
    card.querySelector('.wc-lead').textContent = copy().lead;
    card.querySelector('[data-label="a"]').textContent = copy().areaA;
    card.querySelector('[data-label="b"]').textContent = copy().areaB;
    card.querySelector('.wc-note').textContent = copy().note;
    pngButton.textContent = copy().png;
    pdfButton.textContent = copy().pdf;
    result.innerHTML = `<div class="wc-cities">${cityMarkup(a, copy().areaA)}<div class="wc-vs">VS</div>${cityMarkup(b, copy().areaB)}</div><div class="wc-metrics"><div class="wc-metric"><span>${copy().gap}</span><b>${rupiah(m.absDelta)}</b></div><div class="wc-metric"><span>${copy().ratio}</span><b>${decimal(m.ratio, 3)}×</b></div><div class="wc-metric"><span>${copy().percent}</span><b>${m.percent > 0 ? '+' : ''}${decimal(m.percent, 2)}%</b></div><div class="wc-metric wc-summary"><span>${copy().summary}</span><b>${summary(a, b)}</b></div></div>`;
  }

  selectA.addEventListener('change', render);
  selectB.addEventListener('change', render);
  card.querySelector('.wc-swap').addEventListener('click', () => { const a = selectA.value; selectA.value = selectB.value; selectB.value = a; render(); });
  wageList.addEventListener('click', () => requestAnimationFrame(() => {
    const name = wageList.querySelector('.barrow.is-on .barrow__name')?.textContent?.trim();
    if (name && byName.has(name)) { selectA.value = name; render(); }
  }));

  const loadImage = (src) => new Promise((resolve, reject) => { const img = new Image(); img.decoding = 'async'; img.onload = () => resolve(img); img.onerror = reject; img.src = src; });
  const roundRect = (ctx, x, y, w, h, r, fill, stroke) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); } };
  function wrap(ctx, text, x, y, maxWidth, lineHeight, maxLines = 2) {
    const words = String(text).split(/\s+/); const lines = []; let line = '';
    for (const word of words) { const test = line ? `${line} ${word}` : word; if (!line || ctx.measureText(test).width <= maxWidth) line = test; else { lines.push(line); line = word; } }
    if (line) lines.push(line); lines.slice(0, maxLines).forEach((value, i) => ctx.fillText(value, x, y + i * lineHeight));
  }

  async function comparisonCanvas() {
    const a = byName.get(selectA.value) ?? WAGES[0]; const b = byName.get(selectB.value) ?? WAGES[1]; const m = metrics(a, b);
    const canvas = document.createElement('canvas'); canvas.width = 1400; canvas.height = 900; const ctx = canvas.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 1400, 900); grad.addColorStop(0, '#08111f'); grad.addColorStop(.55, '#0d1c30'); grad.addColorStop(1, '#102944'); ctx.fillStyle = grad; ctx.fillRect(0, 0, 1400, 900);
    ctx.fillStyle = '#46e3d0'; ctx.font = '700 24px Arial'; ctx.fillText(copy().eyebrow.toUpperCase(), 76, 86);
    ctx.fillStyle = '#f8fbff'; ctx.font = '700 48px Arial'; ctx.fillText(copy().title, 76, 146);
    ctx.fillStyle = '#91a5bd'; ctx.font = '22px Arial'; wrap(ctx, copy().lead, 76, 190, 1240, 30);
    const [logoA, logoB] = await Promise.all([loadImage(LOGOS[a.name]).catch(() => null), loadImage(LOGOS[b.name]).catch(() => null)]);
    function drawCity(item, logo, x) {
      roundRect(ctx, x, 250, 590, 260, 26, 'rgba(255,255,255,.045)', 'rgba(255,255,255,.13)'); roundRect(ctx, x + 28, 280, 92, 92, 20, 'rgba(255,255,255,.06)', 'rgba(255,255,255,.12)');
      if (logo) { const s = Math.min(78 / logo.width, 78 / logo.height); const w = logo.width * s; const h = logo.height * s; ctx.drawImage(logo, x + 74 - w / 2, 326 - h / 2, w, h); }
      ctx.fillStyle = '#8da2bc'; ctx.font = '700 17px Arial'; ctx.fillText(`${item.kind} 2025 · ${copy().rank} #${item.rank}`, x + 145, 300);
      ctx.fillStyle = '#f8fbff'; ctx.font = '700 30px Arial'; wrap(ctx, item.name, x + 145, 342, 410, 36);
      ctx.fillStyle = '#8da2bc'; ctx.font = '18px Arial'; ctx.fillText(item.province, x + 145, 395);
      ctx.fillStyle = '#fff'; ctx.font = '700 36px Arial'; ctx.fillText(rupiah(item.value), x + 28, 458);
      ctx.fillStyle = '#9cb0c8'; ctx.font = '18px Arial'; ctx.fillText(`${copy().annual}: ${rupiah(item.annual)}`, x + 28, 490);
    }
    drawCity(a, logoA, 76); drawCity(b, logoB, 734);
    roundRect(ctx, 76, 548, 1248, 242, 26, 'rgba(255,255,255,.045)', 'rgba(255,255,255,.13)');
    const labels = [copy().gap, copy().ratio, copy().percent]; const values = [rupiah(m.absDelta), `${decimal(m.ratio, 3)}×`, `${m.percent > 0 ? '+' : ''}${decimal(m.percent, 2)}%`]; const xs = [110, 445, 770];
    for (let i = 0; i < 3; i++) { ctx.fillStyle = '#8da2bc'; ctx.font = '700 16px Arial'; ctx.fillText(labels[i].toUpperCase(), xs[i], 592); ctx.fillStyle = '#fff'; ctx.font = '700 30px Arial'; ctx.fillText(values[i], xs[i], 633); }
    ctx.fillStyle = '#46e3d0'; ctx.font = '700 16px Arial'; ctx.fillText(copy().summary.toUpperCase(), 110, 690); ctx.fillStyle = '#dce7f4'; ctx.font = '22px Arial'; wrap(ctx, summary(a, b), 110, 728, 1160, 31);
    ctx.fillStyle = '#71869f'; ctx.font = '16px Arial'; ctx.fillText(copy().note, 76, 844); ctx.textAlign = 'right'; ctx.fillText('Nusantara3D · Indonesia Demographic', 1324, 844); ctx.textAlign = 'left';
    return { canvas, a, b };
  }

  const slug = (text) => text.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  function download(blob, filename) { const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000); }

  pngButton.addEventListener('click', async () => {
    const old = pngButton.textContent; pngButton.disabled = true; pngButton.textContent = copy().exporting;
    try { const { canvas, a, b } = await comparisonCanvas(); const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png', 1)); if (blob) download(blob, `umk-compare-${slug(a.name)}-vs-${slug(b.name)}.png`); }
    finally { pngButton.disabled = false; pngButton.textContent = old; }
  });

  const pdfSafe = (text) => String(text).normalize('NFKD').replace(/[^\x20-\x7E]/g, '').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  function textPdf(lines) {
    const stream = ['BT','/F1 18 Tf','50 792 Td',`(${pdfSafe(lines[0])}) Tj`,'0 -34 Td','/F1 11 Tf',...lines.slice(1).flatMap((line) => [`(${pdfSafe(line)}) Tj`,'0 -22 Td']),'ET'].join('\n');
    const objects = ['1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n','2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n','3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n','4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',`5 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`];
    let pdf = '%PDF-1.4\n'; const offsets = [0]; for (const object of objects) { offsets.push(pdf.length); pdf += object; } const xref = pdf.length; pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`; for (let i = 1; i <= objects.length; i++) pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`; pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`; return new Blob([pdf], { type: 'application/pdf' });
  }

  pdfButton.addEventListener('click', () => {
    const a = byName.get(selectA.value) ?? WAGES[0]; const b = byName.get(selectB.value) ?? WAGES[1]; const m = metrics(a, b);
    const lines = ['Nusantara3D - UMK / UMP Comparison 2025','',`Region A: ${a.name} | ${a.province} | ${a.kind} | Rank #${a.rank}`,`Monthly A: ${rupiah(a.value)} | Annualized A: ${rupiah(a.annual)}`,'',`Region B: ${b.name} | ${b.province} | ${b.kind} | Rank #${b.rank}`,`Monthly B: ${rupiah(b.value)} | Annualized B: ${rupiah(b.annual)}`,'',`Nominal gap: ${rupiah(m.absDelta)}`,`Ratio A/B: ${decimal(m.ratio, 3)}x`,`Difference vs B: ${m.percent > 0 ? '+' : ''}${decimal(m.percent, 2)}%`,'',`Summary: ${summary(a, b)}`,'','Dataset: Top 10 regional minimum wages shown on the Indonesia page.','Year: 2025'];
    download(textPdf(lines), `umk-compare-${slug(a.name)}-vs-${slug(b.name)}.pdf`);
  });

  onLang(() => requestAnimationFrame(render));
  render();
}
