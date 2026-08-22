# Nusantara

An atlas globe you can spin, with the whole world named and only Indonesia
interactive. The 34 Indonesian provinces stand up off the sphere as data columns
you can orbit, zoom and interrogate; a procedurally generated Merah Putih flies
over Jakarta. Every other country is drawn and labelled, but nothing outside
Indonesia responds to a click.

Everything runs from a static file server. No build step, no CDN, no API keys.

```bash
npm run dev     # → http://localhost:5173
```

Two pages:

| Route | What it is |
| --- | --- |
| `/` | the interactive globe |
| `/indonesia` | the written history, 1945–2025, with the long charts and the current numbers |

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

**The globe** — 217 countries painted into an equirectangular atlas texture with
borders, a 15-degree graticule and an atmospheric limb. Country names are shown
in Indonesian or English, culled at the horizon, thinned by Natural Earth's own
label rank as you zoom out, and never allowed to overlap a province label or a
glass panel. Indonesia's neighbours stay named at every zoom level.

**Interaction** — spin the globe and zoom, hover any Indonesian province for a
tooltip, click to open its detail card and arc the camera around to frame it,
scrub the year, play the 2015–2025 animation, switch between Indonesian and
English. Only the province chips are in the pick list, so a click anywhere else
on the planet simply clears the selection.

**Deep links** — the URL hash carries the full view state:
`#/gdpPerCapita/2024/papua`. Reload and back/forward both work. On the Indonesia
page, `#1998` opens straight on that moment.

**The Indonesia page** — an article-length walk from the Proclamation to now:
fifteen milestones with the numbers attached (the 1998 crisis alone: real GDP
−13.1%, inflation 77.6%, US$216bn to US$95bn in a single year), a full
1945–2025 chart of population against nominal GDP with era shading and a
linear/log toggle, the current BPS headline figures, the ten highest 2025
district minimum wages, the sex split from the 2020 census, and the growth of
capital-market investor accounts against the population.

Every chart is hoverable, clickable and keyboard-reachable. Clicking a year on
the long chart selects the nearest milestone; clicking a milestone moves the
chart's cursor to it.

---

## Data and sources

| What | Source |
| --- | --- |
| Population, land area, PDB/PDRB | Badan Pusat Statistik (BPS) |
| USD GDP series, 2025 estimate | IMF World Economic Outlook, World Bank |
| GDP share by island group | BPS, spatial economic structure 2024 |
| Province boundaries | BAKOSURTANAL / BIG 1:250,000 base map, via [`ans-4175/peta-indonesia-geojson`](https://github.com/ans-4175/peta-indonesia-geojson) |
| World country outlines and label anchors | Natural Earth 1:50m Admin 0 |
| Population 1961–2020, sex ratio, generational shares | BPS decennial censuses |
| Investor accounts (SID) | KSEI, year-end |
| Minimum wages 2025 | provincial governor decrees |

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

### The long chart interpolates between censuses

Population is only *measured* at a census. Every year between two censuses is
filled by geometric interpolation and flagged `interpolated`, which is why the
chart draws round dots on census years only and the tooltip marks interpolated
readings with `~`. The 1945 figure is the usual proclamation-era estimate, not a
measurement. Nominal GDP in USD has no comparable series before 1960, so the
line simply starts there.

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
index.html            the globe: importmap → vendor/three, HUD markup
indonesia.html        the history page
styles/main.css       design tokens, glass panels, responsive layout
styles/page.css       document-page layer for /indonesia
src/
  main.js             bootstrap, picking, camera flights, deep links
  metrics.js          the four metrics: accessors, ramps, scales
  data/stats.js       generated dataset            ← tools/build_stats.py
  data/geo.json       province polygons, lon/lat   ← tools/build_geo.py
  data/world.json     country outlines + labels    ← tools/build_world.py
  data/history.js     1945-2025 series, milestones ← tools/build_history.py
  indonesia.js        the Indonesia page controller
  version.js          build stamp shown in the UI
  scene/
    world.js          renderer, camera, controls, bloom, adaptive quality
    globe.js          the atlas sphere: canvas-painted map, mask, atmosphere
    sky.js            twinkling starfield
    provinces.js      radially extruded chips, spring animation, highlighting
    motes.js          population motes sampled inside the real polygons
    flag.js           the Merah Putih, cloth and all, in a shader
  ui/                 HUD controller, chart engine, globe labels
  util/               spherical geo, colour ramps, easing, formatting, i18n
tools/                data pipeline, vendoring, static server
vendor/three/         pinned Three.js modules (see `npm run vendor`)
```

### A few things worth knowing

**The world is a texture; Indonesia is geometry.** Country outlines are
rasterised into a 4096x2048 canvas rather than built as meshes. At that size one
degree of longitude is 11 pixels — more resolution than 1:50m Natural Earth
carries — so the entire planet costs two textures and one draw call, leaving the
geometry budget for the provinces that actually have to be interactive. A
second, half-resolution canvas holds a land/sea mask so the shader can give the
oceans a specular sheen the land does not get.

**Province chips never rebuild their geometry.** Every vertex stores its unit
direction from the globe's centre and a level of 0 or 1, and the vertex shader
places it at `dir * (base + level * height)`. Changing metric or year is one
uniform write per province. `position` deliberately stays at the un-extruded
footprint, which is what the raycaster reads — so clicking picks a province's
real territory rather than wherever its column happens to lean.

**The flag is generated, not textured.** The cloth is a pinned membrane: three
travelling waves of decreasing wavelength cross it, a two-frequency envelope
gusts the whole sheet, and it shortens toward the pole because cloth cannot
stretch. Normals come from finite differences of that same displacement field,
so the folds light correctly. Red and white come from one `smoothstep` on the
2:3 plane.

**Population motes are area-weighted samples of the triangulated polygons**, not
rejection samples in a bounding box. That matters here: Kepulauan Riau is 147
islets scattered across an ocean-sized bounding box and would otherwise be
starved of motes. Their heights and colours ride 34-element uniform arrays, so
the whole field animates with 34 uniform writes per frame.

**Columns animate on a critically damped spring** with a west-to-east stagger,
so switching metric reads as a wave rolling across the archipelago. Camera moves
slerp around the sphere rather than cutting through it, and framing is solved on
both axes at once — Indonesia is 46 degrees wide and 17 tall, so fitting it by
width alone would work while fitting a compact province by width alone would put
the camera inside its own columns.

**Generations come from the census, and add up.** The six cohorts on the
Indonesia page are the shares BPS published with the 2020 census — they sum to
exactly 100.00, so the shares are treated as the source of truth and head counts
are derived from share × census total, with the rounding remainder pushed into
the largest cohort. `npm run data:audit` re-checks that and 111 other invariants:
every derived density, every GRDP-per-capita, every SID penetration figure, the
sex ratio against its own counts, and that the birth-year bands are contiguous
with no gaps.

**Orbit sensitivity is tied to altitude.** A fixed rotate speed is what makes an
orbit control feel wrong — the same wrist movement that gently turns the planet
from far away throws it across the screen once you are down among the provinces,
because the arc under the cursor shrinks with altitude while the speed does not.
Both rotate and zoom speed ramp with the square root of altitude, so the surface
moves at roughly the same rate under the pointer at every zoom level.

**Which build am I looking at?** The version stamp in `src/version.js` is
rendered in the globe's sources panel and in the Indonesia page footer, so a
stale cache is visible rather than guessed at.

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
npm run data          # everything below, in order
npm run data:fetch    # pull the Natural Earth source (3 MB, not vendored)
npm run data:geo      # src/data/geo.json   — from data/indonesia-prov.geojson
npm run data:world    # src/data/world.json — from Natural Earth 1:50m
npm run data:history  # src/data/history.js — 1945-2025 series and milestones
npm run data:audit    # consistency checks across every generated dataset
npm run data:stats    # src/data/stats.js   — edit tools/build_stats.py first
npm run vendor        # refresh vendor/three after bumping the dependency
```

Both generators are plain Python 3 with no third-party dependencies, and both
print what they did so a change in the numbers is visible in the diff.
