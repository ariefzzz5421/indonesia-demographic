/**
 * Crisp generation avatars for the six BPS cohorts on /indonesia.
 * Pre-Boomer uses the exact portrait supplied in chat, embedded as a retina
 * JPEG so stale CDN/browser assets can no longer replace it with a fallback.
 */
const asset = (file) => new URL(`../assets/generation-icons/${file}`, import.meta.url).href;
const PRE_BOOMER = 'data:image/jpeg;base64,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';
const GENERATION_ICONS = {
  postz: [asset('post-gen-z.webp'), asset('post-gen-z-v2.png')],
  z: [asset('gen-z.webp'), asset('gen-z-v2.png')],
  milenial: [asset('millennial.webp'), asset('millennial-v2.png')],
  x: [asset('gen-x.webp'), asset('gen-x-v2.png')],
  boomer: [asset('baby-boomer.webp'), asset('baby-boomer-v2.png')],
  preboom: [PRE_BOOMER, asset('pre-boomer.webp'), asset('pre-boomer-v2.png')],
};
const OBJECT_POSITION = { postz:'50% 42%', z:'50% 42%', milenial:'50% 40%', x:'50% 40%', boomer:'50% 42%', preboom:'50% 38%' };
const FALLBACK_LABEL = { postz:'PZ', z:'Z', milenial:'M', x:'X', boomer:'B', preboom:'PB' };
const CACHE_VERSION = '20260823-hd-v6';

const style = document.createElement('style');
style.textContent = `
  #genList .genrow.genrow--with-avatar{
    grid-template-columns:10px 60px minmax(0,1fr) auto auto;
    grid-template-rows:auto auto;column-gap:12px;row-gap:3px;align-items:center;padding:11px 12px;
  }
  #genList .genrow--with-avatar .genrow__dot{grid-column:1;grid-row:1 / 3;align-self:center}
  #genList .genrow__avatar{
    grid-column:2;grid-row:1 / 3;width:56px;height:56px;border-radius:15px;
    display:grid;place-items:center;overflow:hidden;align-self:center;
    background:color-mix(in srgb,var(--seg) 13%,rgba(255,255,255,.025));
    border:1px solid color-mix(in srgb,var(--seg) 30%,rgba(255,255,255,.08));
    box-shadow:inset 0 1px 0 rgba(255,255,255,.06),0 8px 22px rgba(0,0,0,.18);
    transition:transform .2s var(--ease),border-color .2s var(--ease),box-shadow .2s var(--ease);
  }
  #genList .genrow__avatar img{
    display:block;width:100%;height:100%;object-fit:cover;object-position:var(--avatar-pos,center);
    image-rendering:auto;filter:saturate(1.025) contrast(1.015);
  }
  #genList .genrow__avatar.is-fallback{font:700 11px var(--mono);color:var(--seg);letter-spacing:.04em}
  #genList .genrow--with-avatar .genrow__name{grid-column:3;grid-row:1;font-size:13px}
  #genList .genrow--with-avatar .genrow__meta{grid-column:3;grid-row:2}
  #genList .genrow--with-avatar .genrow__count{grid-column:4;grid-row:1;align-self:center}
  #genList .genrow--with-avatar .genrow__share{grid-column:5;grid-row:1;align-self:center}
  #genList .genrow--with-avatar.is-on .genrow__avatar{
    border-color:color-mix(in srgb,var(--seg) 62%,white 8%);
    box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 10px 25px color-mix(in srgb,var(--seg) 18%,transparent);
    transform:translateY(-1px);
  }
  @media(max-width:680px){
    #genList .genrow.genrow--with-avatar{grid-template-columns:8px 54px minmax(0,1fr) auto;padding:10px;column-gap:9px}
    #genList .genrow__avatar{width:50px;height:50px;border-radius:14px}
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
    if (index >= sources.length) { showFallback(row, avatar); return; }
    const src = sources[index++];
    const img = document.createElement('img');
    img.alt = `Ilustrasi ${row.querySelector('.genrow__name')?.textContent?.trim() || 'Generasi'}`;
    img.decoding = 'async'; img.loading = 'eager';
    img.style.setProperty('--avatar-pos', OBJECT_POSITION[id] ?? 'center');
    img.addEventListener('error', tryNext, { once:true });
    img.addEventListener('load', () => {
      if (!img.naturalWidth || !img.naturalHeight) { tryNext(); return; }
      avatar.classList.remove('is-fallback'); avatar.replaceChildren(img);
    }, { once:true });
    img.src = src.startsWith('data:') ? src : `${src}?v=${CACHE_VERSION}`;
  };
  tryNext();
}

function decorateRow(row) {
  const id = row.dataset.id;
  if (!GENERATION_ICONS[id] || row.querySelector('.genrow__avatar')) return;
  const avatar = document.createElement('span'); avatar.className = 'genrow__avatar';
  row.classList.add('genrow--with-avatar');
  const nameNode = row.querySelector('.genrow__name'); row.insertBefore(avatar, nameNode ?? row.children[1] ?? null);
  loadAvatar(row, avatar);
}
function decorate() { const list=document.getElementById('genList'); if(!list)return; for(const row of list.querySelectorAll('.genrow[data-id]')) decorateRow(row); }
function boot() {
  const list=document.getElementById('genList'); if(!list)return; decorate();
  let queued=false; new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;decorate();});}).observe(list,{childList:true,subtree:false});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();