import { lang, onLang } from './util/i18n.js';

const commons = (file) => `https://commons.wikimedia.org/wiki/Special:Redirect/file/${encodeURIComponent(file)}?width=720`;
const PRESIDENTS = [
  {
    no: 1, name: 'Soekarno', start: '1945-08-18', end: '1967-03-12',
    photo: commons('Presiden Sukarno (retouched).jpg'), initials: 'SK',
    noteId: 'Presiden pertama Republik Indonesia dan Proklamator Kemerdekaan.',
    noteEn: 'First President of the Republic of Indonesia and Proclaimer of Independence.',
  },
  {
    no: 2, name: 'Soeharto', start: '1967-03-12', end: '1998-05-21',
    photo: commons('Suharto 1978.jpg'), initials: 'SH',
    noteId: 'Menjadi Pejabat Presiden pada 12 Maret 1967; dilantik sebagai Presiden pada 27 Maret 1968.',
    noteEn: 'Became Acting President on 12 March 1967; formally inaugurated as President on 27 March 1968.',
  },
  {
    no: 3, name: 'B. J. Habibie', start: '1998-05-21', end: '1999-10-20',
    photo: commons('B. J. Habibie, President of Indonesia portrait.jpg'), initials: 'BJH',
    noteId: 'Memimpin masa awal Reformasi setelah pengunduran diri Soeharto.',
    noteEn: 'Led the opening phase of Reformasi after Soeharto resigned.',
  },
  {
    no: 4, name: 'Abdurrahman Wahid', start: '1999-10-20', end: '2001-07-23',
    photo: commons('Gusdur.jpg'), initials: 'AW',
    noteId: 'Presiden keempat, dikenal luas sebagai Gus Dur.',
    noteEn: 'Fourth president, widely known as Gus Dur.',
  },
  {
    no: 5, name: 'Megawati Soekarnoputri', start: '2001-07-23', end: '2004-10-20',
    photo: commons('Megawati Soekarnoputri, Official President portrait (2001).jpg'), initials: 'MS',
    noteId: 'Presiden perempuan pertama Republik Indonesia.',
    noteEn: 'The first woman to serve as President of Indonesia.',
  },
  {
    no: 6, name: 'Susilo Bambang Yudhoyono', start: '2004-10-20', end: '2014-10-20',
    photo: commons('Susilo Bambang Yudhoyono, official presidential portrait (2009).jpg'), initials: 'SBY',
    noteId: 'Presiden pertama yang dipilih langsung oleh rakyat; menjabat dua periode.',
    noteEn: 'The first directly elected president; served two terms.',
  },
  {
    no: 7, name: 'Joko Widodo', start: '2014-10-20', end: '2024-10-20',
    photo: commons('Joko Widodo 2019 official portrait (cropped).jpg'), initials: 'JWK',
    noteId: 'Menjabat dua periode, 2014–2019 dan 2019–2024.',
    noteEn: 'Served two terms, 2014–2019 and 2019–2024.',
  },
  {
    no: 8, name: 'Prabowo Subianto', start: '2024-10-20', end: null,
    photo: commons('Prabowo Subianto 2024 official portrait (3x4 cropped).jpg'), initials: 'PS',
    noteId: 'Presiden saat ini; masa jabatan 2024–2029.',
    noteEn: 'Current president; 2024–2029 term.',
  },
];

const style = document.createElement('style');
style.textContent = `
  #sect-presidents .president-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
  #sect-presidents .president-card{
    position:relative;display:grid;grid-template-columns:116px minmax(0,1fr);gap:16px;min-height:154px;
    padding:14px;border:1px solid var(--line);border-radius:var(--r-lg);background:var(--panel);
    box-shadow:var(--shadow);overflow:hidden;transition:transform .22s var(--ease),border-color .22s var(--ease);
  }
  #sect-presidents .president-card:hover{transform:translateY(-2px);border-color:var(--line-2)}
  #sect-presidents .president-card::after{content:'';position:absolute;inset:auto -45px -60px auto;width:150px;height:150px;border-radius:50%;background:radial-gradient(circle,rgba(206,17,38,.09),transparent 68%);pointer-events:none}
  #sect-presidents .president-photo{position:relative;width:116px;height:142px;border-radius:16px;overflow:hidden;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.08)}
  #sect-presidents .president-photo img{display:block;width:100%;height:100%;object-fit:cover;object-position:center top}
  #sect-presidents .president-photo__fallback{display:none;width:100%;height:100%;place-items:center;font:700 24px var(--mono);color:var(--fg-2);background:linear-gradient(145deg,rgba(206,17,38,.18),rgba(255,255,255,.025))}
  #sect-presidents .president-photo.is-fallback img{display:none} #sect-presidents .president-photo.is-fallback .president-photo__fallback{display:grid}
  #sect-presidents .president-no{position:absolute;left:8px;top:8px;z-index:2;min-width:27px;height:27px;padding:0 7px;border-radius:999px;display:grid;place-items:center;background:rgba(7,14,26,.88);border:1px solid rgba(255,255,255,.14);font:700 10px var(--mono);color:#fff}
  #sect-presidents .president-body{min-width:0;display:flex;flex-direction:column;padding:3px 0 2px}
  #sect-presidents .president-kicker{font:650 9.5px var(--font);letter-spacing:.14em;text-transform:uppercase;color:var(--cyan)}
  #sect-presidents .president-name{margin-top:5px;font-size:18px;font-weight:650;line-height:1.15;letter-spacing:-.02em}
  #sect-presidents .president-period{margin-top:8px;font:600 11px var(--mono);color:var(--fg-2);font-variant-numeric:tabular-nums}
  #sect-presidents .president-tenure{margin-top:8px;font-size:16px;font-weight:650;color:#fff}
  #sect-presidents .president-note{margin-top:6px;font-size:10.5px;line-height:1.5;color:var(--fg-3)}
  #sect-presidents .president-current{display:inline-flex;align-items:center;gap:6px;margin-top:auto;padding-top:9px;font-size:10px;font-weight:650;color:#65ead8}
  #sect-presidents .president-current i{width:7px;height:7px;border-radius:50%;background:#46e3d0;box-shadow:0 0 0 4px rgba(70,227,208,.12)}
  #sect-presidents .president-source{margin-top:14px}
  #sect-presidents .president-source a{color:var(--cyan);text-decoration:none} #sect-presidents .president-source a:hover{text-decoration:underline}
  @media(max-width:860px){#sect-presidents .president-grid{grid-template-columns:1fr}}
  @media(max-width:560px){
    #sect-presidents .president-card{grid-template-columns:92px minmax(0,1fr);gap:12px;min-height:132px;padding:11px}
    #sect-presidents .president-photo{width:92px;height:116px;border-radius:14px}
    #sect-presidents .president-name{font-size:16px} #sect-presidents .president-tenure{font-size:14px}
  }
`;
document.head.append(style);

const parseDate = (iso) => {
  const [y,m,d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y,m-1,d,12));
};
const today = () => new Date();

function durationParts(startIso, endIso) {
  const start = parseDate(startIso);
  const end = endIso ? parseDate(endIso) : today();
  let years = end.getUTCFullYear() - start.getUTCFullYear();
  let months = end.getUTCMonth() - start.getUTCMonth();
  let days = end.getUTCDate() - start.getUTCDate();
  if (days < 0) {
    months -= 1;
    const prevMonth = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 0, 12));
    days += prevMonth.getUTCDate();
  }
  if (months < 0) { years -= 1; months += 12; }
  return { years, months, days };
}

function durationText(p) {
  const id = lang() === 'id';
  const parts = [];
  if (p.years) parts.push(`${p.years} ${id ? 'tahun' : p.years === 1 ? 'year' : 'years'}`);
  if (p.months) parts.push(`${p.months} ${id ? 'bulan' : p.months === 1 ? 'month' : 'months'}`);
  if (!parts.length && p.days) parts.push(`${p.days} ${id ? 'hari' : p.days === 1 ? 'day' : 'days'}`);
  return parts.join(' ');
}

function dateText(iso) {
  const locale = lang() === 'id' ? 'id-ID' : 'en-GB';
  return new Intl.DateTimeFormat(locale, { day:'numeric', month:'short', year:'numeric', timeZone:'UTC' }).format(parseDate(iso));
}

function wireImages(root) {
  for (const img of root.querySelectorAll('.president-photo img')) {
    img.addEventListener('error', () => img.parentElement?.classList.add('is-fallback'), { once:true });
  }
}

function render() {
  const id = lang() === 'id';
  const eyebrow = document.getElementById('presidentEyebrow');
  const heading = document.getElementById('presidentHeading');
  const lead = document.getElementById('presidentLead');
  const grid = document.getElementById('presidentGrid');
  const source = document.getElementById('presidentSource');
  if (!grid) return;

  eyebrow.textContent = id ? 'Kepemimpinan nasional' : 'National leadership';
  heading.textContent = id ? 'Presiden Republik Indonesia sejak merdeka' : 'Presidents of Indonesia since independence';
  lead.textContent = id
    ? 'Delapan presiden dalam penomoran resmi Republik Indonesia, dari Soekarno hingga Prabowo Subianto. Durasi dihitung dari tanggal mulai menjabat; presiden yang masih menjabat dihitung sampai hari ini.'
    : 'The eight officially numbered presidents of Indonesia, from Soekarno to Prabowo Subianto. Tenure is calculated from the date each took office; the current president is counted through today.';

  grid.innerHTML = PRESIDENTS.map((p) => {
    const current = !p.end;
    const period = current ? `${dateText(p.start)} — ${id ? 'sekarang' : 'present'}` : `${dateText(p.start)} — ${dateText(p.end)}`;
    return `<article class="president-card">
      <div class="president-photo">
        <span class="president-no">#${p.no}</span>
        <img src="${p.photo}" alt="${id ? 'Potret resmi' : 'Official portrait of'} ${p.name}" loading="lazy" decoding="async">
        <span class="president-photo__fallback">${p.initials}</span>
      </div>
      <div class="president-body">
        <div class="president-kicker">${id ? `Presiden RI ke-${p.no}` : `${ordinal(p.no)} President`}</div>
        <div class="president-name">${p.name}</div>
        <div class="president-period">${period}</div>
        <div class="president-tenure">${durationText(durationParts(p.start,p.end))}</div>
        <div class="president-note">${id ? p.noteId : p.noteEn}</div>
        ${current ? `<div class="president-current"><i></i>${id ? 'Masih menjabat' : 'Currently in office'}</div>` : ''}
      </div>
    </article>`;
  }).join('');
  wireImages(grid);

  source.innerHTML = id
    ? 'Sumber tanggal & status jabatan: <a href="https://www.setneg.go.id/" target="_blank" rel="noreferrer">Sekretariat Negara</a>. Potret merupakan potret resmi pemerintah yang tersedia melalui Wikimedia Commons. Catatan: awal masa Soeharto dihitung sejak menjadi Pejabat Presiden pada 12 Maret 1967.'
    : 'Tenure dates & current status: <a href="https://www.setneg.go.id/" target="_blank" rel="noreferrer">Ministry of State Secretariat</a>. Portraits are official government images available through Wikimedia Commons. Note: Soeharto is counted from becoming Acting President on 12 March 1967.';
}
function ordinal(n){ if(lang()==='id') return n; const s=['th','st','nd','rd'],v=n%100; return `${n}${s[(v-20)%10]||s[v]||s[0]}`; }

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render, { once:true });
else render();
onLang(render);