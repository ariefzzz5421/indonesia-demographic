#!/usr/bin/env python3
"""
Build the projected, simplified province geometry consumed by the 3D map.

Source
------
Provincial boundaries (34 provinces, includes Kalimantan Utara) from
`ans-4175/peta-indonesia-geojson` (indonesia-prov.geojson), itself derived
from the BAKOSURTANAL / BIG 1:250.000 base map.

    curl -o prov.geojson \
      https://raw.githubusercontent.com/ans-4175/peta-indonesia-geojson/master/indonesia-prov.geojson

Usage
-----
    python3 tools/build_geo.py prov.geojson src/data/geo.json
"""

import json
import math
import sys

# lon/lat -> local plane. Indonesia straddles the equator, so a plain
# equirectangular projection already has a near-correct aspect ratio.
LON0, LAT0 = 118.1035, -2.5210
SCALE = 2.1825          # ~100 world units across the archipelago
MIN_RING_AREA = 4.5e-4  # deg^2, drops sub-pixel islets (~5 km across)
CHAIKIN_MIN_PTS = 10    # smooth only rings with enough structure to keep

NAMES = {
    "DI. ACEH":                   ("aceh",       "Aceh",                        "sumatera"),
    "SUMATERA UTARA":             ("sumut",      "Sumatera Utara",              "sumatera"),
    "SUMATERA BARAT":             ("sumbar",     "Sumatera Barat",              "sumatera"),
    "RIAU":                       ("riau",       "Riau",                        "sumatera"),
    "JAMBI":                      ("jambi",      "Jambi",                       "sumatera"),
    "SUMATERA SELATAN":           ("sumsel",     "Sumatera Selatan",            "sumatera"),
    "BENGKULU":                   ("bengkulu",   "Bengkulu",                    "sumatera"),
    "LAMPUNG":                    ("lampung",    "Lampung",                     "sumatera"),
    "BANGKA BELITUNG":            ("babel",      "Kep. Bangka Belitung",        "sumatera"),
    "KEPULAUAN RIAU":             ("kepri",      "Kepulauan Riau",              "sumatera"),
    "DKI JAKARTA":                ("jakarta",    "DKI Jakarta",                 "jawa"),
    "JAWA BARAT":                 ("jabar",      "Jawa Barat",                  "jawa"),
    "JAWA TENGAH":                ("jateng",     "Jawa Tengah",                 "jawa"),
    "DAERAH ISTIMEWA YOGYAKARTA": ("diy",        "DI Yogyakarta",               "jawa"),
    "JAWA TIMUR":                 ("jatim",      "Jawa Timur",                  "jawa"),
    "BANTEN":                     ("banten",     "Banten",                      "jawa"),
    "BALI":                       ("bali",       "Bali",                        "balinusra"),
    "NUSATENGGARA BARAT":         ("ntb",        "Nusa Tenggara Barat",         "balinusra"),
    "NUSA TENGGARA TIMUR":        ("ntt",        "Nusa Tenggara Timur",         "balinusra"),
    "KALIMANTAN BARAT":           ("kalbar",     "Kalimantan Barat",            "kalimantan"),
    "KALIMANTAN TENGAH":          ("kalteng",    "Kalimantan Tengah",           "kalimantan"),
    "KALIMANTAN SELATAN":         ("kalsel",     "Kalimantan Selatan",          "kalimantan"),
    "KALIMANTAN TIMUR":           ("kaltim",     "Kalimantan Timur",            "kalimantan"),
    "KALIMANTAN UTARA":           ("kaltara",    "Kalimantan Utara",            "kalimantan"),
    "SULAWESI UTARA":             ("sulut",      "Sulawesi Utara",              "sulawesi"),
    "SULAWESI TENGAH":            ("sulteng",    "Sulawesi Tengah",             "sulawesi"),
    "SULAWESI SELATAN":           ("sulsel",     "Sulawesi Selatan",            "sulawesi"),
    "SULAWESI TENGGARA":          ("sultra",     "Sulawesi Tenggara",           "sulawesi"),
    "GORONTALO":                  ("gorontalo",  "Gorontalo",                   "sulawesi"),
    "SULAWESI BARAT":             ("sulbar",     "Sulawesi Barat",              "sulawesi"),
    "MALUKU":                     ("maluku",     "Maluku",                      "malukupapua"),
    "MALUKU UTARA":               ("malut",      "Maluku Utara",                "malukupapua"),
    "PAPUA BARAT":                ("papuabarat", "Papua Barat (+ Barat Daya)",  "malukupapua"),
    "PAPUA":                      ("papua",      "Papua (+ Tengah, Pegunungan, Selatan)", "malukupapua"),
}


def ring_area(ring):
    """Signed shoelace area. Positive == counter-clockwise."""
    a = 0.0
    n = len(ring)
    for i in range(n):
        x1, y1 = ring[i]
        x2, y2 = ring[(i + 1) % n]
        a += x1 * y2 - x2 * y1
    return a / 2.0


def chaikin(ring, iterations=1):
    """Corner-cutting on a closed ring. Shared vertex runs between two
    provinces smooth identically, so boundaries stay coincident."""
    for _ in range(iterations):
        out = []
        n = len(ring)
        for i in range(n):
            x1, y1 = ring[i]
            x2, y2 = ring[(i + 1) % n]
            out.append((0.75 * x1 + 0.25 * x2, 0.75 * y1 + 0.25 * y2))
            out.append((0.25 * x1 + 0.75 * x2, 0.25 * y1 + 0.75 * y2))
        ring = out
    return ring


def dedupe(ring):
    out = []
    for p in ring:
        if not out or abs(p[0] - out[-1][0]) > 1e-9 or abs(p[1] - out[-1][1]) > 1e-9:
            out.append(p)
    # GeoJSON repeats the first point at the end; Shape closes rings itself.
    while len(out) > 1 and abs(out[0][0] - out[-1][0]) < 1e-9 and abs(out[0][1] - out[-1][1]) < 1e-9:
        out.pop()
    return out


def project(ring):
    return [((lon - LON0) * SCALE, -(lat - LAT0) * SCALE) for lon, lat in ring]


def flat(ring):
    out = []
    for x, z in ring:
        out.append(round(x, 3))
        out.append(round(z, 3))
    return out


def centroid_of(ring):
    """Area-weighted centroid of a projected ring."""
    cx = cz = a = 0.0
    n = len(ring)
    for i in range(n):
        x1, z1 = ring[i]
        x2, z2 = ring[(i + 1) % n]
        cross = x1 * z2 - x2 * z1
        a += cross
        cx += (x1 + x2) * cross
        cz += (z1 + z2) * cross
    a *= 0.5
    if abs(a) < 1e-12:
        return ring[0]
    return (cx / (6 * a), cz / (6 * a))


def build(src, dst):
    raw = json.load(open(src))
    provinces = []
    world = [1e9, 1e9, -1e9, -1e9]

    for feature in raw["features"]:
        label = feature["properties"]["Propinsi"].strip()
        if label not in NAMES:
            raise SystemExit(f"unmapped province in source data: {label!r}")
        pid, name, island = NAMES[label]

        geom = feature["geometry"]
        polygons = geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]

        out_polys = []
        biggest = (0.0, None)
        bbox = [1e9, 1e9, -1e9, -1e9]

        for rings in polygons:
            outer = dedupe([tuple(p) for p in rings[0]])
            if len(outer) < 4:
                continue
            area = abs(ring_area(outer))
            if area < MIN_RING_AREA:
                continue
            if len(outer) >= CHAIKIN_MIN_PTS:
                outer = chaikin(outer)
            if ring_area(outer) < 0:            # normalise outer to CCW
                outer.reverse()
            outer = project(outer)

            holes = []
            for hole_ring in rings[1:]:
                hole = dedupe([tuple(p) for p in hole_ring])
                if len(hole) < 4 or abs(ring_area(hole)) < MIN_RING_AREA:
                    continue
                if len(hole) >= CHAIKIN_MIN_PTS:
                    hole = chaikin(hole)
                if ring_area(hole) > 0:         # normalise holes to CW
                    hole.reverse()
                holes.append(flat(project(hole)))

            for x, z in outer:
                bbox[0] = min(bbox[0], x); bbox[1] = min(bbox[1], z)
                bbox[2] = max(bbox[2], x); bbox[3] = max(bbox[3], z)

            if area > biggest[0]:
                biggest = (area, outer)

            poly = {"o": flat(outer)}
            if holes:
                poly["h"] = holes
            out_polys.append(poly)

        cx, cz = centroid_of(biggest[1])
        world[0] = min(world[0], bbox[0]); world[1] = min(world[1], bbox[1])
        world[2] = max(world[2], bbox[2]); world[3] = max(world[3], bbox[3])

        provinces.append({
            "id": pid,
            "name": name,
            "island": island,
            "centroid": [round(cx, 3), round(cz, 3)],
            "bbox": [round(v, 3) for v in bbox],
            "polys": out_polys,
        })

    provinces.sort(key=lambda p: p["id"])
    doc = {
        "projection": {"lon0": LON0, "lat0": LAT0, "scale": SCALE},
        "bbox": [round(v, 3) for v in world],
        "provinces": provinces,
    }
    with open(dst, "w") as fh:
        json.dump(doc, fh, separators=(",", ":"))

    rings = sum(1 + len(p.get("h", [])) for pr in provinces for p in pr["polys"])
    points = sum(len(p["o"]) // 2 + sum(len(h) // 2 for h in p.get("h", []))
                 for pr in provinces for p in pr["polys"])
    print(f"{len(provinces)} provinces  {rings} rings  {points} points -> {dst}")


if __name__ == "__main__":
    build(sys.argv[1], sys.argv[2])
