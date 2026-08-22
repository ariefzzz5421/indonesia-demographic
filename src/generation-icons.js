/**
 * Visual avatars for the six BPS generation cohorts on the Indonesia page.
 * These are conceptual illustrations (not demographic source material) and are
 * intentionally kept separate from the census values and labels.
 */
const icon = (file) => new URL(`../assets/generation-icons/${file}`, import.meta.url).href;
const GENERATION_ICONS = {
  postz: icon('post-gen-z.webp'),
  z: icon('gen-z.webp'),
  milenial: icon('millennial.webp'),
  x: icon('gen-x.webp'),
  boomer: icon('baby-boomer.webp'),
  preboom: icon('pre-boomer.webp'),
};

const style = document.createElement('style');
style.textContent = `
  #genList .genrow.genrow--with-avatar{
    grid-template-columns:10px 52px minmax(0,1fr) auto auto;
    grid-template-rows:auto auto;
    column-gap:11px;row-gap:3px;align-items:center;padding:10px 12px;
  }
  #genList .genrow--with-avatar .genrow__dot{grid-column:1;grid-row:1 / 3;align-self:center}
  #genList .genrow__avatar{
    grid-column:2;grid-row:1 / 3;width:48px;height:48px;border-radius:13px;
    display:grid;place-items:center;overflow:hidden;align-self:center;
    background:color-mix(in srgb,var(--seg) 12%,rgba(255,255,255,.025));
    border:1px solid color-mix(in srgb,var(--seg) 25%,rgba(255,255,255,.07));
    box-shadow:inset 0 1px 0 rgba(255,255,255,.05),0 8px 20px rgba(0,0,0,.15);
  }
  #genList .genrow__avatar img{width:100%;height:100%;object-fit:contain;display:block}
  #genList .genrow--with-avatar .genrow__name{grid-column:3;grid-row:1;font-size:13px}
  #genList .genrow--with-avatar .genrow__meta{grid-column:3;grid-row:2}
  #genList .genrow--with-avatar .genrow__count{grid-column:4;grid-row:1;align-self:center}
  #genList .genrow--with-avatar .genrow__share{grid-column:5;grid-row:1;align-self:center}
  #genList .genrow--with-avatar.is-on .genrow__avatar{border-color:color-mix(in srgb,var(--seg) 55%,white 8%);transform:translateY(-1px)}
  #genList .genrow__avatar{transition:transform .2s var(--ease),border-color .2s var(--ease)}
  @media(max-width:680px){
    #genList .genrow.genrow--with-avatar{grid-template-columns:8px 44px minmax(0,1fr) auto;padding:9px 10px;column-gap:9px}
    #genList .genrow__avatar{width:42px;height:42px;border-radius:11px}
    #genList .genrow--with-avatar .genrow__count{grid-column:4;grid-row:1}
    #genList .genrow--with-avatar .genrow__share{grid-column:4;grid-row:2}
  }
`;
document.head.append(style);

function decorateRow(row) {
  const src = GENERATION_ICONS[row.dataset.id];
  if (!src || row.querySelector('.genrow__avatar')) return;
  const name = row.querySelector('.genrow__name')?.textContent?.trim() || 'Generasi';
  const avatar = document.createElement('span');
  avatar.className = 'genrow__avatar';
  const img = document.createElement('img');
  img.src = src;
  img.alt = `Ilustrasi ${name}`;
  img.decoding = 'async';
  img.loading = 'lazy';
  avatar.append(img);
  row.classList.add('genrow--with-avatar');
  const nameNode = row.querySelector('.genrow__name');
  row.insertBefore(avatar, nameNode ?? row.children[1] ?? null);
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
  const observer = new MutationObserver(() => requestAnimationFrame(decorate));
  observer.observe(list, { childList: true, subtree: false });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();