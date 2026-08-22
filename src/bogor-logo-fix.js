/**
 * Hardens Kota Bogor emblem rendering across the wage ranking, detail card,
 * and comparison UI. The query string is intentionally versioned because an
 * earlier deployment served an invalid image at the same static path.
 */
const CACHE_VERSION = '20260823-2';
const bogorLogo = `${new URL('../assets/region-logos/kota-bogor.png', import.meta.url).href}?v=${CACHE_VERSION}`;

function makeImage() {
  const img = document.createElement('img');
  img.src = bogorLogo;
  img.alt = 'Lambang Kota Bogor';
  img.loading = 'eager';
  img.decoding = 'async';
  img.dataset.bogorLogo = CACHE_VERSION;
  return img;
}

function ensureImage(slot) {
  if (!slot) return;
  const current = slot.querySelector('img');
  if (current?.dataset.bogorLogo === CACHE_VERSION || current?.src === bogorLogo) return;
  current?.remove();
  slot.append(makeImage());
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
    const name = card.querySelector('.wc-name')?.textContent?.trim();
    if (name !== 'Kota Bogor') continue;
    ensureImage(card.querySelector('.wc-logo'));
  }
}

function fixLooseImages() {
  for (const img of document.querySelectorAll('img[alt*="Kota Bogor"]')) {
    if (img.dataset.bogorLogo === CACHE_VERSION) continue;
    img.src = bogorLogo;
    img.dataset.bogorLogo = CACHE_VERSION;
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
  const observer = new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      fixBogor();
    });
  });
  observer.observe(wageSection, { childList: true, subtree: true });
  wageSection.addEventListener('click', () => requestAnimationFrame(fixBogor));
  wageSection.addEventListener('change', () => requestAnimationFrame(fixBogor));
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();