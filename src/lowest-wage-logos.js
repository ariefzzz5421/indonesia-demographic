/**
 * Adds official regional emblems to the national lowest-UMK leaderboard.
 * The emblem artwork is hosted by Wikimedia Commons and traces back to the
 * relevant local-government emblem / regulation sources. Using the vector
 * originals keeps the compact 44px icons crisp on high-DPI displays.
 */
const LOWEST_LOGOS = {
  'Kabupaten Banjarnegara': 'https://upload.wikimedia.org/wikipedia/commons/3/35/Seal_of_Banjarnegara_Regency_%282022%29.svg',
  'Kabupaten Wonogiri': 'https://upload.wikimedia.org/wikipedia/commons/6/63/Seal_of_Wonogiri_Regency.svg',
  'Kabupaten Sragen': 'https://upload.wikimedia.org/wikipedia/commons/d/d3/Seal_of_Sragen_Regency.svg',
  'Kota Banjar': 'https://upload.wikimedia.org/wikipedia/commons/8/8e/Seal_of_the_City_of_Banjar.svg',
  'Kabupaten Kuningan': 'https://upload.wikimedia.org/wikipedia/commons/0/04/Seal_of_Kuningan_Regency.svg',
  'Kabupaten Pangandaran': 'https://upload.wikimedia.org/wikipedia/commons/9/9e/Logo_Kabupaten_Pangandaran.svg',
  'Kabupaten Ciamis': 'https://upload.wikimedia.org/wikipedia/commons/8/86/LAMBANG_KABUPATEN_CIAMIS.svg',
  'Kabupaten Rembang': 'https://upload.wikimedia.org/wikipedia/commons/d/df/Seal_of_Rembang_Regency.svg',
  'Kabupaten Blora': 'https://upload.wikimedia.org/wikipedia/commons/f/f2/Seal_of_Blora_Regency.svg',
  'Kabupaten Brebes': 'https://upload.wikimedia.org/wikipedia/commons/0/05/Seal_of_Brebes_Regency.svg',
};

const style = document.createElement('style');
style.textContent = `
  #lowestWages .lw-row.lw-row--with-logo{
    grid-template-columns:38px 44px minmax(0,1fr) auto;
    gap:10px;
  }
  #lowestWages .lw-logo{
    width:44px;height:44px;border-radius:11px;display:grid;place-items:center;
    overflow:hidden;flex:none;border:1px solid rgba(255,255,255,.09);
    background:linear-gradient(145deg,rgba(255,255,255,.075),rgba(255,255,255,.025));
    box-shadow:inset 0 1px 0 rgba(255,255,255,.04),0 7px 18px rgba(0,0,0,.12);
  }
  #lowestWages .lw-logo img{
    display:block;width:calc(100% - 6px);height:calc(100% - 6px);object-fit:contain;
    filter:drop-shadow(0 2px 4px rgba(0,0,0,.24));
  }
  #lowestWages .lw-logo-source{display:block;margin-top:8px;font-size:9px;line-height:1.5;color:var(--fg-3)}
  @media(max-width:560px){
    #lowestWages .lw-row.lw-row--with-logo{grid-template-columns:34px 38px minmax(0,1fr);gap:8px}
    #lowestWages .lw-logo{width:38px;height:38px;border-radius:10px}
    #lowestWages .lw-row.lw-row--with-logo .lw-value{grid-column:3}
  }
`;
document.head.append(style);

function decorateRow(row) {
  const name = row.querySelector('.lw-name')?.textContent?.trim();
  const src = LOWEST_LOGOS[name];
  if (!name || !src) return;

  row.classList.add('lw-row--with-logo');
  let slot = row.querySelector('.lw-logo');
  if (slot) return;

  slot = document.createElement('span');
  slot.className = 'lw-logo';
  const img = document.createElement('img');
  img.src = src;
  img.alt = `Lambang ${name}`;
  img.loading = 'lazy';
  img.decoding = 'async';
  img.referrerPolicy = 'no-referrer';
  img.addEventListener('error', () => {
    row.classList.remove('lw-row--with-logo');
    slot.remove();
  }, { once: true });
  slot.append(img);

  const rank = row.querySelector('.lw-rank');
  if (rank?.nextSibling) row.insertBefore(slot, rank.nextSibling);
  else row.prepend(slot);
}

function decorate() {
  const card = document.getElementById('lowestWages');
  if (!card) return false;
  for (const row of card.querySelectorAll('.lw-row')) decorateRow(row);

  const note = card.querySelector('.lw-note');
  if (note && !card.querySelector('.lw-logo-source')) {
    const source = document.createElement('span');
    source.className = 'lw-logo-source';
    source.textContent = 'Lambang daerah: aset resmi pemerintah daerah yang dimirror di Wikimedia Commons.';
    note.insertAdjacentElement('afterend', source);
  }
  return true;
}

function boot(attempt = 0) {
  const wageSection = document.getElementById('sect-wages');
  if (!wageSection) return;
  if (!decorate() && attempt < 40) {
    setTimeout(() => boot(attempt + 1), 50);
    return;
  }
  const observer = new MutationObserver(() => requestAnimationFrame(decorate));
  observer.observe(wageSection, { childList: true, subtree: true });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => boot(), { once: true });
else boot();