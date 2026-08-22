/**
 * Full 2025 city wage comparison + national lowest-UMK leaderboard.
 * Loaded only on /indonesia after the base wage UI has initialized.
 */
import { lang, onLang } from './util/i18n.js';
import { CITY_WAGES_2025, COMPARE_WAGES_2025, LOWEST_WAGES_2025, WAGE_DATA_META_2025 } from './data/wages-2025.js';

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
};
const byName = new Map(COMPARE_WAGES_2025.map((item) => [item.name, item]));
const cityNames = new Set(CITY_WAGES_2025.map((item) => item.name));

const COPY = {
  id: {
    eyebrow:'Bandingkan UMK / UMP 2025', title:'Bandingkan upah minimum seluruh kota Indonesia',
    lead:'Pilih dari seluruh 98 wilayah kota Indonesia. Jika suatu kota tidak memiliki UMK tersendiri, UMP yang berlaku ditampilkan sebagai acuan. Beberapa kabupaten juga tersedia agar daerah ekstrem bisa langsung dibandingkan.',
    a:'Daerah A', b:'Daerah B', annual:'Setahun', cityRank:'Peringkat kota', gap:'Selisih nominal', ratio:'Rasio A : B', pct:'Selisih % vs B', summary:'Kesimpulan',
    higher:'lebih tinggi dari', lower:'lebih rendah dari', equal:'sama dengan', png:'Download PNG', pdf:'Download PDF', exporting:'Membuat file…',
    cities:'98 kota Indonesia', extras:'Kabupaten / wilayah tambahan', fallback:'UMP acuan', crest:'Lambang',
    note:`Cakupan: ${WAGE_DATA_META_2025.cityCount} kota — ${WAGE_DATA_META_2025.autonomousCityCount} kota otonom + ${WAGE_DATA_META_2025.jakartaAdministrativeCityCount} kota administrasi Jakarta. ${WAGE_DATA_META_2025.methodologyId}`,
    lowEyebrow:'Leaderboard nasional', lowTitle:'10 UMK terendah di Indonesia — 2025',
    lowLead:'Urutan berdasarkan UMK resmi 2025 kabupaten/kota. Angka Jawa Tengah dicek ke Keputusan Gubernur Jawa Tengah No. 561/45 Tahun 2024; nilai Jawa Barat dan urutan nasional dicocokkan dengan publikasi pemerintah/Kemnaker.',
    lowHint:'Klik satu daerah untuk menjadikannya Daerah A pada pembanding di atas.',
    source:'Sumber riset: Kemnaker RI, keputusan gubernur, dan rilis resmi pemerintah daerah. Angka tampilan dibulatkan ke rupiah terdekat.',
  },
  en: {
    eyebrow:'Compare 2025 UMK / UMP', title:'Compare minimum wages across every Indonesian city',
    lead:'Choose from all 98 Indonesian city jurisdictions. Where a city-specific UMK was not set, the applicable provincial UMP is shown as the fallback. Selected regencies are also included for direct comparison with national extremes.',
    a:'Region A', b:'Region B', annual:'Annualized', cityRank:'City rank', gap:'Nominal gap', ratio:'A : B ratio', pct:'% difference vs B', summary:'Summary',
    higher:'higher than', lower:'lower than', equal:'equal to', png:'Download PNG', pdf:'Download PDF', exporting:'Preparing file…',
    cities:'98 Indonesian cities', extras:'Additional regencies / regions', fallback:'UMP fallback', crest:'Emblem',
    note:`Coverage: ${WAGE_DATA_META_2025.cityCount} cities — ${WAGE_DATA_META_2025.autonomousCityCount} autonomous + ${WAGE_DATA_META_2025.jakartaAdministrativeCityCount} Jakarta administrative cities. ${WAGE_DATA_META_2025.methodologyEn}`,
    lowEyebrow:'National leaderboard', lowTitle:'10 lowest UMK regions in Indonesia — 2025',
    lowLead:'Ranked by official 2025 city/regency UMK. Central Java values were checked against Governor Decree No. 561/45 of 2024; West Java values and national ordering were cross-checked against government/Kemnaker publications.',
    lowHint:'Click a row to use that region as Region A in the comparison above.',
    source:'Research sources: Indonesia Ministry of Manpower, governor decrees, and official local-government releases. Display values are rounded to the nearest rupiah.',
  },
};
const c = () => COPY[lang()] ?? COPY.id;
const locale = () => lang() === 'en' ? 'en-US' : 'id-ID';
const rupiah = (value) => new Intl.NumberFormat(locale(), { style:'currency', currency:'IDR', maximumFractionDigits:0 }).format(value).replace(/\u00a0/g,' ');
const decimal = (value,d=2) => new Intl.NumberFormat(locale(), { minimumFractionDigits:d, maximumFractionDigits:d }).format(value);

function init(attempt=0) {
  const oldCard = document.getElementById('wageCompare');
  const wageList = document.getElementById('wageList');
  if (!oldCard || !wageList) {
    if (attempt < 20) setTimeout(() => init(attempt+1), 20);
    return;
  }

  const card = document.createElement('section');
  card.id = 'wageCompare';
  card.className = 'card';
  card.innerHTML = `
    <div class="wc-head"><div><div class="sect__eyebrow wc-eyebrow"></div><h3 class="wc-title"></h3><p class="wc-lead"></p></div>
      <div class="wc-actions"><button type="button" class="wc-export" data-export="png"></button><button type="button" class="wc-export" data-export="pdf"></button></div></div>
    <div class="wc-controls"><label class="wc-field"><span data-label="a"></span><select id="wageCompareA"></select></label>
      <button type="button" class="wc-swap" aria-label="Swap regions" title="Swap regions">⇄</button>
      <label class="wc-field"><span data-label="b"></span><select id="wageCompareB"></select></label></div>
    <div class="wc-result"></div><p class="wc-note"></p>`;
  oldCard.replaceWith(card);

  const style = document.createElement('style');
  style.textContent = `
    #wageCompare optgroup{color:#93a7c0;background:#08111f;font-weight:700}#wageCompare option{color:#e8eff8;background:#08111f}
    #wageCompare .wc-logo{position:relative}#wageCompare .wc-logo svg{width:25px;height:25px;opacity:.46;fill:none;stroke:#8ea6c4;stroke-width:1.7}
    #wageCompare .wc-logo img{position:absolute;inset:3px;width:calc(100% - 6px);height:calc(100% - 6px);object-fit:contain}
    #wageCompare .wc-basis{display:inline-flex;margin-top:5px;padding:2px 6px;border-radius:999px;font:700 8px var(--font);letter-spacing:.07em;text-transform:uppercase;color:var(--cyan);background:rgba(70,227,208,.08);border:1px solid rgba(70,227,208,.15)}
    #wageCompare .wc-basis.is-fallback{color:#f5c451;background:rgba(245,196,81,.07);border-color:rgba(245,196,81,.16)}
    #lowestWages{margin-top:14px;padding:20px}#lowestWages .lw-title{margin:0;font-size:21px;line-height:1.18;font-weight:650;letter-spacing:-.022em;color:var(--fg)}
    #lowestWages .lw-lead{margin:9px 0 0;font-size:12px;line-height:1.65;color:var(--fg-3);max-width:78ch}#lowestWages .lw-list{display:grid;gap:6px;margin-top:16px}
    #lowestWages .lw-row{display:grid;grid-template-columns:38px minmax(0,1fr) auto;gap:12px;align-items:center;width:100%;padding:11px 12px;border-radius:12px;border:1px solid rgba(255,255,255,.055);background:rgba(255,255,255,.022);color:inherit;text-align:left;transition:.2s var(--ease);cursor:pointer}
    #lowestWages .lw-row:hover{transform:translateX(2px);background:rgba(255,255,255,.05);border-color:rgba(255,255,255,.11)}#lowestWages .lw-rank{display:grid;place-items:center;width:32px;height:32px;border-radius:9px;background:rgba(245,196,81,.08);border:1px solid rgba(245,196,81,.14);font:700 11px var(--mono);color:#f5c451}
    #lowestWages .lw-name{display:block;font-size:12.5px;font-weight:650;color:var(--fg)}#lowestWages .lw-province{display:block;margin-top:3px;font-size:9.8px;color:var(--fg-3)}#lowestWages .lw-value{font:700 12px var(--mono);color:var(--fg);white-space:nowrap}
    #lowestWages .lw-hint{margin-top:11px;font-size:10px;color:var(--cyan)}#lowestWages .lw-note{margin:7px 0 0;font-size:10px;line-height:1.55;color:var(--fg-3)}
    @media(max-width:560px){#lowestWages{padding:15px}#lowestWages .lw-row{grid-template-columns:34px minmax(0,1fr);gap:9px}#lowestWages .lw-value{grid-column:2}}
  `;
  document.head.append(style);

  const selectA=card.querySelector('#wageCompareA'), selectB=card.querySelector('#wageCompareB'), result=card.querySelector('.wc-result');
  const pngBtn=card.querySelector('[data-export="png"]'), pdfBtn=card.querySelector('[data-export="pdf"]');
  const building=`<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M5 27V12h22v15M9 12V7h14v5M10 17h3m3 0h3m3 0h2M10 22h3m3 0h3m3 0h2M4 27h24"/></svg>`;

  function fill(select, selected) {
    const cityGroup=document.createElement('optgroup'); cityGroup.label=c().cities;
    [...CITY_WAGES_2025].sort((a,b)=>a.province.localeCompare(b.province,'id')||a.name.localeCompare(b.name,'id')).forEach((item)=>{
      const o=document.createElement('option'); o.value=item.name; o.textContent=`${item.province} — ${item.name} · ${item.basis}`; cityGroup.append(o);
    });
    const extraGroup=document.createElement('optgroup'); extraGroup.label=c().extras;
    COMPARE_WAGES_2025.filter((d)=>!cityNames.has(d.name)).sort((a,b)=>b.value-a.value).forEach((item)=>{
      const o=document.createElement('option'); o.value=item.name; o.textContent=`${item.province} — ${item.name} · ${item.basis}`; extraGroup.append(o);
    });
    select.replaceChildren(cityGroup,extraGroup); if(byName.has(selected)) select.value=selected;
  }

  const metrics=(a,b)=>{const delta=a.value-b.value;return{delta,abs:Math.abs(delta),ratio:b.value?a.value/b.value:0,pct:b.value?delta/b.value*100:0};};
  const summary=(a,b)=>{const m=metrics(a,b);if(Math.abs(m.delta)<.5)return`${a.name} ${c().equal} ${b.name} · ${decimal(m.ratio,3)}×.`;return`${a.name} ${m.delta>0?c().higher:c().lower} ${b.name}: ${rupiah(m.abs)} (${decimal(Math.abs(m.pct),2)}%) · ${decimal(m.ratio,3)}×.`;};
  const logo=(item)=>`<span class="wc-logo">${building}${LOGOS[item.name]?`<img data-logo src="${LOGOS[item.name]}" alt="${c().crest} ${item.name}">`:''}</span>`;
  const meta=(item)=>`${item.province}${item.scope==='city'&&item.rank?` · ${c().cityRank} #${item.rank}`:''}<br><span class="wc-basis${item.basis==='UMP'?' is-fallback':''}">${item.basis==='UMP'?c().fallback:'UMK'}</span>`;
  const city=(item,side)=>`<article class="wc-city"><div class="wc-citytop">${logo(item)}<div><div class="wc-side">${side}</div><div class="wc-name">${item.name}</div><div class="wc-meta">${meta(item)}</div></div></div><div class="wc-amount">${rupiah(item.value)}</div><div class="wc-annual">${c().annual}: <b>${rupiah(item.annual??item.value*12)}</b></div></article>`;

  function render(){
    const a=byName.get(selectA.value)??CITY_WAGES_2025[0], b=byName.get(selectB.value)??CITY_WAGES_2025[1], m=metrics(a,b);
    card.querySelector('.wc-eyebrow').textContent=c().eyebrow; card.querySelector('.wc-title').textContent=c().title; card.querySelector('.wc-lead').textContent=c().lead;
    card.querySelector('[data-label="a"]').textContent=c().a; card.querySelector('[data-label="b"]').textContent=c().b; card.querySelector('.wc-note').textContent=`${c().note} ${c().source}`;
    pngBtn.textContent=c().png; pdfBtn.textContent=c().pdf;
    result.innerHTML=`<div class="wc-cities">${city(a,c().a)}<div class="wc-vs">VS</div>${city(b,c().b)}</div><div class="wc-metrics"><div class="wc-metric"><span>${c().gap}</span><b>${rupiah(m.abs)}</b></div><div class="wc-metric"><span>${c().ratio}</span><b>${decimal(m.ratio,3)}×</b></div><div class="wc-metric"><span>${c().pct}</span><b>${m.pct>0?'+':''}${decimal(m.pct,2)}%</b></div><div class="wc-metric wc-summary"><span>${c().summary}</span><b>${summary(a,b)}</b></div></div>`;
    result.querySelectorAll('img[data-logo]').forEach((img)=>img.addEventListener('error',()=>img.remove(),{once:true}));
  }

  fill(selectA,'Kota Bekasi'); fill(selectB,'Kota Bogor'); render();
  selectA.addEventListener('change',render); selectB.addEventListener('change',render);
  card.querySelector('.wc-swap').addEventListener('click',()=>{const x=selectA.value;selectA.value=selectB.value;selectB.value=x;render();});
  wageList.addEventListener('click',()=>requestAnimationFrame(()=>{const name=wageList.querySelector('.barrow.is-on .barrow__name')?.textContent?.trim();if(byName.has(name)){selectA.value=name;render();}}));

  const lowCard=document.createElement('section'); lowCard.id='lowestWages'; lowCard.className='card';
  lowCard.innerHTML='<div class="sect__eyebrow lw-eyebrow"></div><h3 class="lw-title"></h3><p class="lw-lead"></p><div class="lw-list"></div><div class="lw-hint"></div><p class="lw-note"></p>'; card.insertAdjacentElement('afterend',lowCard);
  function renderLow(){lowCard.querySelector('.lw-eyebrow').textContent=c().lowEyebrow;lowCard.querySelector('.lw-title').textContent=c().lowTitle;lowCard.querySelector('.lw-lead').textContent=c().lowLead;lowCard.querySelector('.lw-hint').textContent=c().lowHint;lowCard.querySelector('.lw-note').textContent=c().source;lowCard.querySelector('.lw-list').innerHTML=LOWEST_WAGES_2025.map((item,i)=>`<button type="button" class="lw-row" data-name="${item.name}"><span class="lw-rank">#${i+1}</span><span><span class="lw-name">${item.name}</span><span class="lw-province">${item.province} · UMK 2025</span></span><span class="lw-value">${rupiah(item.value)}</span></button>`).join('');}
  renderLow(); lowCard.addEventListener('click',(e)=>{const row=e.target.closest('.lw-row');if(!row||!byName.has(row.dataset.name))return;selectA.value=row.dataset.name;render();card.scrollIntoView({behavior:'smooth',block:'start'});});

  const slug=(s)=>s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
  const download=(blob,name)=>{const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),4000);};
  const wrap=(ctx,text,x,y,max,line=28)=>{let out='',yy=y;for(const word of String(text).split(/\s+/)){const t=out?`${out} ${word}`:word;if(!out||ctx.measureText(t).width<=max)out=t;else{ctx.fillText(out,x,yy);yy+=line;out=word;}}if(out)ctx.fillText(out,x,yy);};
  async function canvasExport(){const a=byName.get(selectA.value),b=byName.get(selectB.value),m=metrics(a,b),cv=document.createElement('canvas');cv.width=1200;cv.height=720;const x=cv.getContext('2d'),g=x.createLinearGradient(0,0,1200,720);g.addColorStop(0,'#08111f');g.addColorStop(1,'#123052');x.fillStyle=g;x.fillRect(0,0,1200,720);x.fillStyle='#46e3d0';x.font='700 20px Arial';x.fillText(c().eyebrow.toUpperCase(),60,70);x.fillStyle='#fff';x.font='700 38px Arial';x.fillText(c().title,60,118);x.fillStyle='#91a5bd';x.font='18px Arial';wrap(x,c().lead,60,155,1080,24);const draw=(item,left)=>{x.fillStyle='rgba(255,255,255,.055)';x.fillRect(left,220,500,210);x.fillStyle='#8ea6c4';x.font='700 16px Arial';x.fillText(`${item.basis} · ${item.province}`,left+24,258);x.fillStyle='#fff';x.font='700 28px Arial';wrap(x,item.name,left+24,300,450,32);x.font='700 32px Arial';x.fillText(rupiah(item.value),left+24,382);x.fillStyle='#9cb0c8';x.font='16px Arial';x.fillText(`${c().annual}: ${rupiah(item.value*12)}`,left+24,412);};draw(a,60);draw(b,640);x.fillStyle='#8ea6c4';x.font='700 15px Arial';x.fillText(c().gap.toUpperCase(),60,500);x.fillText(c().ratio.toUpperCase(),390,500);x.fillText(c().pct.toUpperCase(),660,500);x.fillStyle='#fff';x.font='700 26px Arial';x.fillText(rupiah(m.abs),60,537);x.fillText(`${decimal(m.ratio,3)}×`,390,537);x.fillText(`${m.pct>0?'+':''}${decimal(m.pct,2)}%`,660,537);x.fillStyle='#46e3d0';x.font='700 15px Arial';x.fillText(c().summary.toUpperCase(),60,590);x.fillStyle='#dce7f4';x.font='19px Arial';wrap(x,summary(a,b),60,623,1080,25);x.fillStyle='#71869f';x.font='13px Arial';x.fillText(`2025 · ${WAGE_DATA_META_2025.cityCount} cities · ${WAGE_DATA_META_2025.sourceLabel}`,60,688);return{cv,a,b};}
  pngBtn.addEventListener('click',async()=>{const old=pngBtn.textContent;pngBtn.disabled=true;pngBtn.textContent=c().exporting;try{const{cv,a,b}=await canvasExport();const blob=await new Promise(r=>cv.toBlob(r,'image/png',1));if(blob)download(blob,`umk-compare-${slug(a.name)}-vs-${slug(b.name)}.png`);}finally{pngBtn.disabled=false;pngBtn.textContent=old;}});
  const pdfSafe=(s)=>String(s).normalize('NFKD').replace(/[^\x20-\x7E]/g,'').replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');
  const makePdf=(lines)=>{const stream=['BT','/F1 17 Tf','45 792 Td',`(${pdfSafe(lines[0])}) Tj`,'0 -32 Td','/F1 10 Tf',...lines.slice(1).flatMap(l=>[`(${pdfSafe(l)}) Tj`,'0 -20 Td']),'ET'].join('\n'),objs=['1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n','2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n','3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n','4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',`5 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`];let pdf='%PDF-1.4\n',offs=[0];for(const o of objs){offs.push(pdf.length);pdf+=o;}const xr=pdf.length;pdf+=`xref\n0 ${objs.length+1}\n0000000000 65535 f \n`;for(let i=1;i<=objs.length;i++)pdf+=`${String(offs[i]).padStart(10,'0')} 00000 n \n`;pdf+=`trailer\n<< /Size ${objs.length+1} /Root 1 0 R >>\nstartxref\n${xr}\n%%EOF`;return new Blob([pdf],{type:'application/pdf'});};
  pdfBtn.addEventListener('click',()=>{const a=byName.get(selectA.value),b=byName.get(selectB.value),m=metrics(a,b);download(makePdf(['Nusantara3D - Indonesia Minimum Wage Comparison 2025','',`A: ${a.name} | ${a.province} | ${a.basis} | ${rupiah(a.value)}`,`B: ${b.name} | ${b.province} | ${b.basis} | ${rupiah(b.value)}`,'',`Gap: ${rupiah(m.abs)}`,`Ratio A/B: ${decimal(m.ratio,3)}x`,`Difference: ${decimal(m.pct,2)}%`,'',summary(a,b),'',`Coverage: ${WAGE_DATA_META_2025.cityCount} Indonesian city jurisdictions`,`Sources: ${WAGE_DATA_META_2025.sourceLabel}`]),`umk-compare-${slug(a.name)}-vs-${slug(b.name)}.pdf`);});

  onLang(()=>requestAnimationFrame(()=>{const a=selectA.value,b=selectB.value;fill(selectA,a);fill(selectB,b);render();renderLow();}));
}

requestAnimationFrame(()=>init());
