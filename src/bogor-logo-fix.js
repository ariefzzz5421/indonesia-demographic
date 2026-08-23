/**
 * Kota Bogor crest hardening.
 * Use the full-resolution crest asset and force contain sizing everywhere so
 * the emblem never gets cropped inside the compact wage UI.
 */
const CACHE_VERSION = '20260823-crest-v5';
const bogorLogo = new URL('../assets/region-logos/kota-bogor.png', import.meta.url).href;

const style = document.createElement('style');
style.textContent = `
  #wageList .barrow__region-logo,
  #wageDetail .wage-detail__crest,
  #wageCompare .wc-logo{
    display:grid!important;
    place-items:center!important;
    overflow:hidden!important;
  }
  #wageList .barrow__region-logo img[data-bogor-logo],
  #wageDetail .wage-detail__crest img[data-bogor-logo],
  #wageCompare .wc-logo img[data-bogor-logo]{
    display:block!important;
    width:calc(100% - 8px)!important;
    height:calc(100% - 8px)!important;
    max-width:100%!important;
    max-height:100%!important;
    object-fit:contain!important;
    object-position:center center!important;
    margin:auto!important;
    padding:0!important;
    transform:none!important;
    clip-path:none!important;
  }
`;
document.head.append(style);

function makeImage() {
  const img = document.createElement('img');
  img.src = `${bogorLogo}?v=${CACHE_VERSION}`;
  img.alt = 'Lambang Kota Bogor';
  img.loading = 'eager';
  img.decoding = 'async';
  img.dataset.bogorLogo = CACHE_VERSION;
  return img;
}

function ensureImage(slot) {
  if (!slot) return;
  const current = slot.querySelector('img');
  if (current?.dataset.bogorLogo === CACHE_VERSION) return;
  slot.replaceChildren(makeImage());
}

function fixRanking() {
  const wageList = document.getElementById('wageList');
  if (!wageList) return;
  const row = [...wageList.querySelectorAll('.barrow')].find(
    (node) => node.querySelector('.barrow__name')?.textContent?.trim() === 'Kota Bogor'
  );
  if (!row) return;

  let slot = row.querySelector('.barrow__region-logo');
  if (!slot) {
    const body = row.querySelector('.barrow__body');
    if (!body) return;
    slot = document.createElement('span');
    slot.className = 'barrow__region-logo';
    row.classList.add('barrow--with-logo');
    row.insertBefore(slot, body);
  }
  row.classList.add('barrow--with-logo');
  ensureImage(slot);
}

function fixDetail() {
  const wageList = document.getElementById('wageList');
  const wageDetail = document.getElementById('wageDetail');
  if (!wageList || !wageDetail) return;
  const activeName = wageList.querySelector('.barrow.is-on .barrow__name')?.textContent?.trim();
  if (activeName !== 'Kota Bogor') return;

  let head = wageDetail.querySelector('.wage-detail__head');
  if (!head || head.dataset.name !== 'Kota Bogor') {
    head?.remove();
    head = document.createElement('div');
    head.className = 'wage-detail__head';
    head.dataset.name = 'Kota Bogor';
    const crest = document.createElement('span');
    crest.className = 'wage-detail__crest';
    const copy = document.createElement('div');
    copy.className = 'wage-detail__copy';
    copy.innerHTML = '<span class="wage-detail__eyebrow">Lambang daerah</span><strong class="wage-detail__name">Kota Bogor</strong>';
    head.append(crest, copy);
    wageDetail.prepend(head);
  }
  ensureImage(head.querySelector('.wage-detail__crest'));
}

function fixComparison() {
  const compare = document.getElementById('wageCompare');
  if (!compare) return;
  for (const card of compare.querySelectorAll('.wc-city')) {
    if (card.querySelector('.wc-name')?.textContent?.trim() !== 'Kota Bogor') continue;
    ensureImage(card.querySelector('.wc-logo'));
  }
}

function fixLooseImages() {
  for (const img of document.querySelectorAll('img[alt*="Kota Bogor"]')) {
    if (img.dataset.bogorLogo === CACHE_VERSION) continue;
    const parent = img.parentElement;
    if (parent) ensureImage(parent);
    else {
      img.src = `${bogorLogo}?v=${CACHE_VERSION}`;
      img.dataset.bogorLogo = CACHE_VERSION;
      img.style.objectFit = 'contain';
      img.style.objectPosition = 'center';
    }
  }
}

function fixBogor() {
  fixRanking();
  fixDetail();
  fixComparison();
  fixLooseImages();
}

function boot() {
  fixBogor();
  const wageSection = document.getElementById('sect-wages');
  if (!wageSection) return;

  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      fixBogor();
    });
  };

  const observer = new MutationObserver(schedule);
  observer.observe(wageSection, { childList: true, subtree: true });
  wageSection.addEventListener('click', schedule);
  wageSection.addEventListener('change', schedule);
  [50, 150, 400, 900].forEach((ms) => setTimeout(fixBogor, ms));
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();