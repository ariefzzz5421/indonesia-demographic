/**
 * Bumped whenever something user-visible ships. Shown in the sources modal and
 * in the page footer so "am I looking at the latest build?" has an answer you
 * can read off the screen instead of guessing at a cache.
 */
if (document.getElementById('sect-wages')) {
  import('./wage-data-corrections.js')
    .then(() => import('./wage-expand.js'))
    .then(() => import('./lowest-wage-logos.js'));
  import('./bogor-logo-fix.js');
}
if (document.getElementById('sect-gen')) import('./generation-icons.js');

export const BUILD = {
  version: '3.4.0',
  date: '2026-08-23',
  name: 'lambang UMK + ikon generasi',
};