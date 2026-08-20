# Nusantara 3D

An interactive WebGL visualisation of Indonesia's demographics and economy — the
archipelago rendered as an extruded 3D map you can orbit, zoom and interrogate,
with a procedurally generated Merah Putih flying over Jakarta.

Everything runs from a static file server. No build step, no CDN, no API keys.

```bash
npm run dev     # → http://localhost:5173
```

---

## What it shows

**National figures** — population, nominal GDP, GDP per capita, real growth,
PPP GDP, plus an 11-year series (2015–2025) for population and GDP.

**Four provincial metrics**, each with its own colour ramp and scale:

| Metric | Scale | Why |
| --- | --- | --- |
| Penduduk / Population | √ | Jawa Barat holds 68× the population of Kalimantan Utara |
| Kepadatan / Density | log | Jakarta is ~1,100× denser than Papua |
| PDRB / GRDP | √ | Same skew as population, plus Jakarta's outsized share |
| PDRB per kapita | linear | The one metric with a naturally comparable spread |

Column **height** and **colour** both encode the active metric. Six contour
bands run up each column so relative height is readable without consulting the
legend.

**Interaction** — orbit and zoom, hover any province for a tooltip, click to
open its detail card and fly the camera to frame it, scrub the year, play the
2015–2025 animation, switch between Indonesian and English.

**Deep links** — the URL hash carries the full view state:
`#/gdpPerCapita/2024/papua`. Reload and back/forward both work.

---

## Data and sources

| What | Source |
| --- | --- |
| Population, land area, PDB/PDRB | Badan Pusat Statistik (BPS) |
| USD GDP series, 2025 estimate | IMF World Economic Outlook, World Bank |
| GDP share by island group | BPS, spatial economic structure 2024 |
| Province boundaries | BAKOSURTANAL / BIG 1:250,000 base map, via [`ans-4175/peta-indonesia-geojson`](https://github.com/ans-4175/peta-indonesia-geojson) |

Headline figures: **284,438,782** people (BPS mid-2025 projection), nominal GDP
of **US$1.40 trillion** and GDP per capita of **US$4,960** for 2024, real growth
of **5.03%**. National PDB for 2024 is Rp 22,138.9 trillion; the USD conversion
uses the 2024 period average of Rp 15,850/US$.

### Provincial GRDP is calibrated, and says so

BPS publishes provincial PDRB, but the figure that is easiest to verify from a
headline release is the share of national GDP by island group. So provincial
values here start from best-available published estimates and are then
**calibrated**: every province within an island group is multiplied by a single
factor so the group sums exactly to the official BPS 2024 share. Provincial GRDP
therefore reconciles to national GDP by construction.

`tools/build_stats.py` prints every calibration factor on each run — all six
land between **0.96 and 1.00**, so no province is being bent very far.

### 34 polygons, 38 provinces

Indonesia has had 38 provinces since the 2022 Papua split. The base map predates
it, so the four new provinces are folded into their parents and the app labels
this everywhere it matters:

- `papua` = Papua + Papua Tengah + Papua Pegunungan + Papua Selatan
- `papuabarat` = Papua Barat + Papua Barat Daya

### The year scrubber is a national index

Provincial data is a 2024 cross-section. The scrubber moves the **national**
aggregate across 2015–2025 and rescales every province by that same national
index, holding the 2024 inter-provincial structure fixed. Column heights in 2015
show the national scale of that year, not the true provincial distribution at
the time. The in-app sources panel (ⓘ) says the same thing.

The 34 map units sum to about 281.0 million for 2024 against the BPS national
total of 281.6 million; the gap is rounding in the provincial estimates.

---

## How it is built

```
index.html            importmap → vendor/three, HUD markup
styles/main.css       design tokens, glass panels, responsive layout
src/
  main.js             bootstrap, picking, camera moves, deep links
  metrics.js          the four metrics: accessors, ramps, scales
  data/stats.js       generated dataset          ← tools/build_stats.py
  data/geo.json       projected province polygons ← tools/build_geo.py
  scene/
    world.js          renderer, camera, controls, bloom, adaptive quality
    landmask.js       provinces rasterised to an RGB bathymetry texture
    ocean.js          analytic wave shader, shelf, foam, graticule
    sky.js            gradient dome + twinkling starfield
    provinces.js      extruded columns, spring animation, highlighting
    motes.js          population motes sampled inside the real polygons
    flag.js           the Merah Putih, cloth and all, in a shader
  ui/                 HUD controller, sparkline, floating map labels
  util/               colour ramps, easing, formatting, i18n
tools/                data pipeline, vendoring, static server
vendor/three/         pinned Three.js modules (see `npm run vendor`)
```

### A few things worth knowing

**The flag is generated, not textured.** The cloth is a pinned membrane: three
travelling waves of decreasing wavelength cross it, a two-frequency envelope
gusts the whole sheet, and it shortens toward the pole because cloth cannot
stretch. Normals come from finite differences of that same displacement field,
so the folds light correctly. Red and white come from one `smoothstep` on the
2:3 plane.

**The ocean rebuilds its wave gradient analytically in the fragment stage**, so
lighting stays crisp regardless of tessellation. Bathymetry comes from
`landmask.js`, which rasterises all 491 rings into one `Path2D` and fills it
three times at different blur radii — hard mask, shelf, wide haze — into the R,
G and B channels of a single texture.

**Population motes are area-weighted samples of the triangulated polygons**, not
rejection samples in a bounding box. That matters here: Kepulauan Riau is 147
islets scattered across an ocean-sized bounding box and would otherwise be
starved of motes. Their heights and colours ride 34-element uniform arrays, so
the whole field animates with 34 uniform writes per frame.

**Columns animate on a critically damped spring** with a west-to-east stagger,
so switching metric reads as a wave rolling across the archipelago. Geometry is
extruded to a depth of exactly 1 and driven through `scale.z` — no rebuilds.

**Quality adapts.** The renderer watches its real frame rate against the wall
clock and steps down — device pixel ratio, then bloom, then wave octaves and the
mote field — until the page is smooth. Camera flights and year playback are
driven by wall-clock time rather than the clamped frame delta, so a 3-second
flight takes three seconds even at 5 fps. Force a level with `?quality=low`,
`medium` or `high`; skip the opening flight with `?intro=0`.
`prefers-reduced-motion` skips it automatically.

---

## Regenerating the data

```bash
npm run build:stats   # src/data/stats.js  — edit tools/build_stats.py first
npm run build:geo     # src/data/geo.json  — from data/indonesia-prov.geojson
npm run vendor        # refresh vendor/three after bumping the dependency
```

Both generators are plain Python 3 with no third-party dependencies, and both
print what they did so a change in the numbers is visible in the diff.
