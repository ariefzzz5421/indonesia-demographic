/**
 * Regional emblems for the 2025 wage ranking.
 *
 * The source artwork is normalized into small transparent PNGs so the emblems
 * remain crisp in the compact list without carrying the original white canvas.
 */
const wageList = document.getElementById('wageList');
const wageDetail = document.getElementById('wageDetail');

if (wageList && wageDetail) {
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
    'Kabupaten Tangerang': asset('kabupaten-tangerang.png'),
  };

  // Emblems that turn out not to be decodable. Recorded so the decorators skip
  // them for good: the observers below re-run on every mutation, and simply
  // removing a failed node is itself a mutation — that loops forever.
  const broken = new Set();

  const style = document.createElement('style');
  style.textContent = `
    #wageList .barrow--with-logo{
      grid-template-columns:20px 44px minmax(0,1fr);
      gap:10px;
      align-items:center;
    }
    #wageList .barrow__region-logo,
    #wageDetail .wage-detail__crest{
      display:grid;
      place-items:center;
      flex:none;
      overflow:hidden;
      border:1px solid rgba(255,255,255,.09);
      background:linear-gradient(145deg,rgba(255,255,255,.075),rgba(255,255,255,.025));
      box-shadow:inset 0 1px 0 rgba(255,255,255,.04),0 7px 18px rgba(0,0,0,.12);
    }
    #wageList .barrow__region-logo img,
    #wageDetail .wage-detail__crest img{
      display:block;
      width:calc(100% - 6px);
      height:calc(100% - 6px);
      object-fit:contain;
      filter:drop-shadow(0 2px 4px rgba(0,0,0,.24));
    }
    #wageList .barrow__region-logo{
      width:44px;
      height:44px;
      border-radius:11px;
    }
    #wageList .barrow--with-logo .barrow__n{align-self:center}
    #wageDetail .wage-detail__head{
      display:flex;
      align-items:center;
      gap:12px;
      padding:0 0 14px;
      margin-bottom:2px;
      border-bottom:1px solid rgba(255,255,255,.06);
    }
    #wageDetail .wage-detail__crest{
      width:58px;
      height:58px;
      border-radius:14px;
    }
    #wageDetail .wage-detail__copy{
      min-width:0;
      display:flex;
      flex-direction:column;
      gap:3px;
    }
    #wageDetail .wage-detail__eyebrow{
      font-size:9.5px;
      letter-spacing:.12em;
      text-transform:uppercase;
      color:var(--fg-3);
    }
    #wageDetail .wage-detail__name{
      font-size:14px;
      line-height:1.25;
      font-weight:650;
      letter-spacing:-.01em;
      color:var(--fg);
    }
    @media (max-width:560px){
      #wageList .barrow--with-logo{
        grid-template-columns:18px 38px minmax(0,1fr);
        gap:8px;
        padding-left:7px;
        padding-right:7px;
      }
      #wageList .barrow__region-logo{
        width:38px;
        height:38px;
        border-radius:10px;
      }
    }
  `;
  document.head.append(style);

  function makeLogo(name, className) {
    const src = LOGOS[name];
    if (!src || broken.has(name)) return null;
    const node = document.createElement('span');
    node.className = className;
    const img = document.createElement('img');
    img.alt = `Lambang ${name}`;
    // Not lazy: these are ten ~1 KB emblems in one list, so deferring them buys
    // nothing and leaves the slot empty until the loader gets round to it.
    img.decoding = 'async';

    // An emblem that cannot be decoded would otherwise leave an empty framed
    // box in the row. Drop the whole slot so the row falls back to its plain
    // layout. Both paths are covered: `error` catches a failed request, and
    // decode() rejects on a file that downloads fine but is not valid image
    // data. The listener goes on before `src` so an immediate failure is seen.
    const drop = () => {
      broken.add(name);
      node.closest('.barrow')?.classList.remove('barrow--with-logo');
      node.remove();
    };
    img.addEventListener('error', drop);
    img.src = src;
    img.decode?.().catch(drop);
    node.append(img);
    return node;
  }

  function decorateRows() {
    for (const row of wageList.querySelectorAll('.barrow')) {
      const name = row.querySelector('.barrow__name')?.textContent?.trim();
      if (!name || !LOGOS[name] || broken.has(name)) continue;
      if (row.querySelector('.barrow__region-logo')) continue;
      const body = row.querySelector('.barrow__body');
      const logo = makeLogo(name, 'barrow__region-logo');
      if (!body || !logo) continue;
      row.classList.add('barrow--with-logo');
      row.insertBefore(logo, body);
    }
  }

  function decorateDetail() {
    const activeName =
      wageList.querySelector('.barrow.is-on .barrow__name')?.textContent?.trim() ||
      wageList.querySelector('.barrow .barrow__name')?.textContent?.trim();
    if (!activeName || !LOGOS[activeName] || broken.has(activeName)) return;

    let head = wageDetail.querySelector('.wage-detail__head');
    if (head?.dataset.name === activeName) return;
    head?.remove();

    head = document.createElement('div');
    head.className = 'wage-detail__head';
    head.dataset.name = activeName;

    const crest = makeLogo(activeName, 'wage-detail__crest');
    const copy = document.createElement('div');
    copy.className = 'wage-detail__copy';

    const eyebrow = document.createElement('span');
    eyebrow.className = 'wage-detail__eyebrow';
    eyebrow.textContent = 'Lambang daerah';

    const name = document.createElement('strong');
    name.className = 'wage-detail__name';
    name.textContent = activeName;

    copy.append(eyebrow, name);
    head.append(crest, copy);
    wageDetail.prepend(head);
  }

  function sync() {
    decorateRows();
    decorateDetail();
  }

  new MutationObserver(sync).observe(wageList, { childList: true, subtree: true });
  new MutationObserver(() => requestAnimationFrame(decorateDetail))
    .observe(wageDetail, { childList: true });

  wageList.addEventListener('click', () => requestAnimationFrame(decorateDetail));
  requestAnimationFrame(sync);
}
