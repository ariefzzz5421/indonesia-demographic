/**
 * Hardens Kota Bogor emblem rendering across the wage ranking, detail card,
 * and comparison UI. The cache-busting query avoids browsers retaining the
 * previously broken static response while keeping the repository asset source.
 */
const bogorLogo = `${new URL('../assets/region-logos/kota-bogor.png', import.meta.url).href}?v=20260823`;

function makeImage() {
  const img = document.createElement('img');
  img.src = bogorLogo;
  img.alt = 'Lambang Kota Bogor';
  img.loading = 'lazy';
  img.decoding = 'async';
  return img;
}

function fixBogor() {
  const wageList = document.getElementById('wageList');
  if (wageList) {
    const row = [...wageList.querySelectorAll('.barrow')].find(
      (node) => node.querySelector('.barrow__name')?.textContent?.trim() === 'Kota Bogor'
    );
    if (row) {
      let logo = row.querySelector('.barrow__region-logo');
      if (!logo) {
        const body = row.querySelector('.barrow__body');
        logo = document.createElement('span');
        logo.className = 'barrow__region-logo';
        row.classList.add('barrow--with-logo');
        if (body) row.insertBefore(logo, body);
      }
      const img = logo?.querySelector('img');
      if (logo && (!img || !img.src.includes('v=20260823'))) logo.replaceChildren(makeImage());
    }
  }

  for (const img of document.querySelectorAll('img[alt*="Kota Bogor"]')) {
    if (!img.src.includes('v=20260823')) img.src = bogorLogo;
  }
}

function boot() {
  fixBogor();
  const wageSection = document.getElementById('sect-wages');
  if (!wageSection) return;
  const observer = new MutationObserver(() => requestAnimationFrame(fixBogor));
  observer.observe(wageSection, { childList: true, subtree: true });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();
