/**
 * High-quality generation avatars for the six BPS cohorts on /indonesia.
 * Prefer the larger local WebP portraits and automatically fall back to the
 * small PNG set if a browser cannot decode a WebP asset. This keeps the mobile
 * UI sharp without ever showing the browser's broken-image placeholder.
 */
const asset = (file) => new URL(`../assets/generation-icons/${file}`, import.meta.url).href;
const GENERATION_ICONS = {
  postz: [asset('post-gen-z.webp'), asset('post-gen-z-v2.png')],
  z: [asset('gen-z.webp'), asset('gen-z-v2.png')],
  milenial: [asset('millennial.webp'), asset('millennial-v2.png')],
  x: [asset('gen-x.webp'), asset('gen-x-v2.png')],
  boomer: [asset('baby-boomer.webp'), asset('baby-boomer-v2.png')],
  preboom: [asset('pre-boomer.webp'), asset('pre-boomer-v2.png')],
};

const FALLBACK_LABEL = {
  postz: 'PZ', z: 'Z', milenial: 'M', x: 'X', boomer: 'B', preboom: 'PB',
};

const CACHE_VERSION = '20260823-hd-v5';

const style = document.createElement('style');
style.textContent = `
  #genList .genrow.genrow--with-avatar{
    grid-template-columns:10px 62px minmax(0,1fr) auto auto;
    grid-template-rows:auto auto;
    column-gap:12px;row-gap:3px;align-items:center;padding:10px 12px;
  }
  #genList .genrow--with-avatar .genrow__dot{grid-column:1;grid-row:1 / 3;align-self:center}
  #genList .genrow__avatar{
    grid-column:2;grid-row:1 / 3;width:58px;height:58px;border-radius:16px;
    display:grid;place-items:center;overflow:hidden;align-self:center;
    background:color-mix(in srgb,var(--seg) 13%,rgba(255,255,255,.025));
    border:1px solid color-mix(in srgb,var(--seg) 28%,rgba(255,255,255,.08));
    box-shadow:inset 0 1px 0 rgba(255,255,255,.055),0 9px 22px rgba(0,0,0,.16);
    transition:transform .2s var(--ease),border-color .2s var(--ease),box-shadow .2s var(--ease);
  }
  #genList .genrow__avatar img{
    display:block;width:100%;height:100%;object-fit:cover;object-position:center;
    image-rendering:auto;backface-visibility:hidden;transform:translateZ(0);
  }
  #genList .genrow__avatar.is-fallback{
    font:700 11px var(--mono);color:var(--seg);letter-spacing:.04em;
  }
  #genList .genrow--with-avatar .genrow__name{grid-column:3;grid-row:1;font-size:13px}
  #genList .genrow--with-avatar .genrow__meta{grid-column:3;grid-row:2}
  #genList .genrow--with-avatar .genrow__count{grid-column:4;grid-row:1;align-self:center}
  #genList .genrow--with-avatar .genrow__share{grid-column:5;grid-row:1;align-self:center}
  #genList .genrow--with-avatar.is-on .genrow__avatar{
    border-color:color-mix(in srgb,var(--seg) 60%,white 8%);
    box-shadow:inset 0 1px 0 rgba(255,255,255,.06),0 10px 24px color-mix(in srgb,var(--seg) 14%,transparent);
    transform:translateY(-1px);
  }
  @media(max-width:680px){
    #genList .genrow.genrow--with-avatar{grid-template-columns:8px 54px minmax(0,1fr) auto;padding:9px 10px;column-gap:9px}
    #genList .genrow__avatar{width:50px;height:50px;border-radius:14px}
    #genList .genrow--with-avatar .genrow__count{grid-column:4;grid-row:1}
    #genList .genrow--with-avatar .genrow__share{grid-column:4;grid-row:2}
  }
`;
document.head.append(style);

function hasVisiblePixels(img) {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 12;
    canvas.height = 12;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return true;
    ctx.drawImage(img, 0, 0, 12, 12);
    const pixels = ctx.getImageData(0, 0, 12, 12).data;
    let visible = 0;
    for (let i = 3; i < pixels.length; i += 4) {
      if (pixels[i] > 18) visible += 1;
    }
    return visible > 18;
  } catch {
    return true;
  }
}

function showFallback(row, avatar) {
  avatar.classList.add('is-fallback');
  avatar.replaceChildren(document.createTextNode(FALLBACK_LABEL[row.dataset.id] ?? 'G'));
}

function loadAvatar(row, avatar) {
  const id = row.dataset.id;
  const sources = GENERATION_ICONS[id] ?? [];
  let index = 0;

  const tryNext = () => {
    if (index >= sources.length) {
      showFallback(row, avatar);
      return;
    }

    const sourceIndex = index;
    const src = sources[index++];
    const img = document.createElement('img');
    img.alt = `Ilustrasi 3D ${row.querySelector('.genrow__name')?.textContent?.trim() || 'Generasi'}`;
    img.decoding = 'async';
    img.loading = 'eager';

    img.addEventListener('error', tryNext, { once: true });
    img.addEventListener('load', async () => {
      try {
        if (img.decode) await img.decode();
      } catch {
        tryNext();
        return;
      }

      // The primary assets should be materially larger than the old 64px set.
      // Reject a stale/tiny primary asset, but still allow the PNG fallback.
      if ((sourceIndex === 0 && (img.naturalWidth < 96 || img.naturalHeight < 96)) || !hasVisiblePixels(img)) {
        tryNext();
        return;
      }

      avatar.classList.remove('is-fallback');
      avatar.replaceChildren(img);
    }, { once: true });

    img.src = `${src}?v=${CACHE_VERSION}`;
  };

  tryNext();
}

function decorateRow(row) {
  const id = row.dataset.id;
  if (!GENERATION_ICONS[id] || row.querySelector('.genrow__avatar')) return;

  const avatar = document.createElement('span');
  avatar.className = 'genrow__avatar';
  row.classList.add('genrow--with-avatar');
  const nameNode = row.querySelector('.genrow__name');
  row.insertBefore(avatar, nameNode ?? row.children[1] ?? null);
  loadAvatar(row, avatar);
}

function decorate() {
  const list = document.getElementById('genList');
  if (!list) return;
  for (const row of list.querySelectorAll('.genrow[data-id]')) decorateRow(row);
}

function boot() {
  const list = document.getElementById('genList');
  if (!list) return;
  decorate();
  let queued = false;
  const observer = new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      decorate();
    });
  });
  observer.observe(list, { childList: true, subtree: false });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();