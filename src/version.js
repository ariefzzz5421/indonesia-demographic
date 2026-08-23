/**
 * Bumped whenever something user-visible ships. Shown in the sources modal and
 * footer so the current build is easy to verify after a Vercel deployment.
 */
import('./layout-polish.js');

if (document.getElementById('sect-wages')) {
  import('./wage-data-corrections.js')
    .then(() => import('./wage-expand.js'))
    .then(() => import('./lowest-wage-logos.js'));
  import('./bogor-logo-fix.js');
}
if (document.getElementById('sect-gen')) import('./generation-icons.js');

const moments = document.getElementById('sect-moments');
if (moments) {
  let presidents = document.getElementById('sect-presidents');
  if (!presidents) {
    presidents = document.createElement('section');
    presidents.className = 'sect';
    presidents.id = 'sect-presidents';
    presidents.innerHTML = `
      <div class="sect__head">
        <div>
          <div class="sect__eyebrow" id="presidentEyebrow">Kepemimpinan nasional</div>
          <h2 id="presidentHeading">Presiden Republik Indonesia sejak merdeka</h2>
        </div>
      </div>
      <p class="sect__note" id="presidentLead">Memuat daftar Presiden RI, masa jabatan, durasi, dan potret resmi.</p>
      <div class="president-grid" id="presidentGrid"></div>
      <p class="sect__note president-source" id="presidentSource"></p>`;
    moments.insertAdjacentElement('afterend', presidents);
  }
  import('./presidents.js');
}

export const BUILD = {
  version: '3.5.1',
  date: '2026-08-24',
  name: 'layout polish + official Bogor crest + stable generation portraits',
};