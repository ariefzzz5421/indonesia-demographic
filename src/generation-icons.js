/**
 * Stable generation portraits for the six BPS cohorts on /indonesia.
 * PNG is preferred for the cohorts that previously rendered blank/ghosted on
 * mobile Chromium; WebP remains a fallback. Pre-Boomer uses the supplied HD
 * portrait as a local asset so the UI never falls back to initials.
 */
const asset = (file) => new URL(`../assets/generation-icons/${file}`, import.meta.url).href;

const GENERATION_ICONS = {
  postz: [asset('post-gen-z.webp'), asset('post-gen-z-v2.png')],
  z: [asset('gen-z-v2.png'), asset('gen-z.webp')],
  milenial: [asset('millennial-v2.png'), asset('millennial.webp')],
  x: [asset('gen-x-v2.png'), asset('gen-x.webp')],
  boomer: [asset('baby-boomer.webp'), asset('baby-boomer-v2.png')],
  preboom: [asset('pre-boomer-hd.jpg'), asset('pre-boomer-v2.png'), asset('pre-boomer.webp')],
};

const OBJECT_POSITION = {
  postz: '50% 42%', z: '50% 42%', milenial: '50% 40%',
  x: '50% 40%', boomer: '50% 42%', preboom: '50% 38%',
};
const FALLBACK_LABEL = { postz:'PZ', z:'Z', milenial:'M', x:'X', boomer:'B', preboom:'PB' };
const CACHE_VERSION = '20260824-gen-v7';

const style = document.createElement('style');
style.textContent = `
  #genList .genrow.genrow--with-avatar{
    grid-template-columns:10px 54px minmax(0,1fr) auto auto;
    grid-template-rows:auto auto;
    column-gap:12px;row-gap:3px;align-items:center;padding:11px 12px;
  }
  #genList .genrow--with-avatar .genrow__dot{grid-column:1;grid-row:1 / 3;align-self:center}
  #genList .genrow__avatar{
    grid-column:2;grid-row:1 / 3;width:50px;height:50px;border-radius:14px;
    display:grid;place-items:center;overflow:hidden;align-self:center;
    background:color-mix(in srgb,var(--seg) 12%,rgba(255,255,255,.025));
    border:1px solid color-mix(in srgb,var(--seg) 30%,rgba(255,255,255,.08));
    box-shadow:inset 0 1px 0 rgba(255,255,255,.05),0 8px 20px rgba(0,0,0,.16);
    transition:transform .2s var(--ease),border-color .2s var(--ease),box-shadow .2s var(--ease);
  }
  #genList .genrow__avatar img{
    display:block;width:100%;height:100%;object-fit:cover;
    object-position:var(--avatar-pos,center);image-rendering:auto;
  }
  #genList .genrow__avatar.is-fallback{font:700 11px var(--mono);color:var(--seg);letter-spacing:.04em}
  #genList .genrow--with-avatar .genrow__name{grid-column:3;grid-row:1;font-size:13px}
  #genList .genrow--with-avatar .genrow__meta{grid-column:3;grid-row:2}
  #genList .genrow--with-avatar .genrow__count{grid-column:4;grid-row:1;align-self:center}
  #genList .genrow--with-avatar .genrow__share{grid-column:5;grid-row:1;align-self:center}
  #genList .genrow--with-avatar.is-on .genrow__avatar{
    border-color:color-mix(in srgb,var(--seg) 60%,white 8%);
    transform:translateY(-1px);
  }
  @media(max-width:680px){
    #genList .genrow.genrow--with-avatar{grid-template-columns:8px 50px minmax(0,1fr) auto;padding:10px;column-gap:9px}
    #genList .genrow__avatar{width:46px;height:46px;border-radius:13px}
    #genList .genrow--with-avatar .genrow__count{grid-column:4;grid-row:1}
    #genList .genrow--with-avatar .genrow__share{grid-column:4;grid-row:2}
  }
`;
document.head.append(style);

function showFallback(row, avatar) {
  avatar.classList.add('is-fallback');
  avatar.replaceChildren(document.createTextNode(FALLBACK_LABEL[row.dataset.id] ?? 'G'));
}

function loadAvatar(row, avatar) {
  const id = row.dataset.id;
  const sources = GENERATION_ICONS[id] ?? [];
  let index = 0;
  const tryNext = () => {
    if (index >= sources.length) return showFallback(row, avatar);
    const img = document.createElement('img');
    const src = sources[index++];
    img.alt = `Ilustrasi ${row.querySelector('.genrow__name')?.textContent?.trim() || 'Generasi'}`;
    img.decoding = 'async';
    img.loading = 'eager';
    img.style.setProperty('--avatar-pos', OBJECT_POSITION[id] ?? 'center');
    img.addEventListener('error', tryNext, { once:true });
    img.addEventListener('load', () => {
      if (!img.naturalWidth || !img.naturalHeight) return tryNext();
      avatar.classList.remove('is-fallback');
      avatar.replaceChildren(img);
    }, { once:true });
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
  const name = row.querySelector('.genrow__name');
  row.insertBefore(avatar, name ?? row.children[1] ?? null);
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
  new MutationObserver(() => requestAnimationFrame(decorate))
    .observe(list, { childList:true, subtree:false });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
else boot();