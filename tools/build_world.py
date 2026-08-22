#!/usr/bin/env python3
"""
Build src/data/world.json — the country outlines and label anchors used to
paint the atlas globe.

Source
------
Natural Earth 1:50m Admin 0 countries.

    curl -o ne_50m_admin_0_countries.geojson \
      https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson

Output
------
Rings stay in lon/lat degrees; the globe rasterises them into an equirectangular
canvas at runtime, so the only precision that matters is the texture's pixel
pitch (4096 px / 360 deg = 11.4 px per degree). Coordinates are simplified to
0.06 deg (~0.7 px) and rounded to two decimals.

Every ring of a country is emitted flat, without marking holes: the rasteriser
fills each country with the even-odd rule, which resolves enclaves such as
Lesotho correctly and costs nothing to store.

Usage
-----
    python3 tools/build_world.py ne_50m_admin_0_countries.geojson src/data/world.json
"""

import json
import math
import sys

# A handful of Indonesian country names are formal-long ("Republik Rakyat
# Tiongkok"). On a globe label they crowd out everything nearby, so the common
# short form is used instead.
SHORT_ID = {
    "CHN": "Tiongkok",
    "COD": "Kongo (Kinshasa)",
    "COG": "Kongo",
    "IRL": "Irlandia",
    "CAF": "Afrika Tengah",
    "SGS": "Georgia Selatan",
    "SPM": "St. Pierre & Miquelon",
    "PYF": "Polinesia Prancis",
    "GBR": "Inggris Raya",
    "ARE": "Uni Emirat Arab",
}

TOLERANCE = 0.06      # degrees, Douglas-Peucker
MIN_AREA = 0.010      # deg^2, drops islets below roughly a texture pixel
MIN_RING = 4


def perpendicular_distance(pt, a, b):
    (x, y), (x1, y1), (x2, y2) = pt, a, b
    dx, dy = x2 - x1, y2 - y1
    if dx == 0 and dy == 0:
        return math.hypot(x - x1, y - y1)
    t = ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)
    t = max(0.0, min(1.0, t))
    return math.hypot(x - (x1 + t * dx), y - (y1 + t * dy))


def simplify(points, tolerance):
    """Iterative Douglas-Peucker — recursion blows the stack on long coastlines."""
    if len(points) < 3:
        return points
    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        start, end = stack.pop()
        worst, index = 0.0, -1
        for i in range(start + 1, end):
            d = perpendicular_distance(points[i], points[start], points[end])
            if d > worst:
                worst, index = d, i
        if worst > tolerance and index != -1:
            keep[index] = True
            stack.append((start, index))
            stack.append((index, end))
    return [p for p, k in zip(points, keep) if k]


def ring_area(ring):
    a = 0.0
    n = len(ring)
    for i in range(n):
        x1, y1 = ring[i]
        x2, y2 = ring[(i + 1) % n]
        a += x1 * y2 - x2 * y1
    return abs(a) / 2.0


def dedupe(ring):
    out = []
    for p in ring:
        if not out or abs(p[0] - out[-1][0]) > 1e-9 or abs(p[1] - out[-1][1]) > 1e-9:
            out.append(p)
    while len(out) > 1 and abs(out[0][0] - out[-1][0]) < 1e-9 and abs(out[0][1] - out[-1][1]) < 1e-9:
        out.pop()
    return out


def build(src, dst):
    raw = json.load(open(src))
    countries = []
    total_points = 0

    for feature in raw["features"]:
        props = feature["properties"]
        a3 = props.get("ADM0_A3") or props.get("SOV_A3") or props.get("NAME")
        name = props.get("NAME_LONG") or props.get("NAME")
        if not name:
            continue

        geom = feature["geometry"]
        if not geom:
            continue
        polygons = geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]

        rings = []
        for polygon in polygons:
            for raw_ring in polygon:
                ring = dedupe([(round(x, 4), round(y, 4)) for x, y in raw_ring])
                if len(ring) < MIN_RING or ring_area(ring) < MIN_AREA:
                    continue
                ring = simplify(ring, TOLERANCE)
                if len(ring) < MIN_RING:
                    continue
                flat = []
                for x, y in ring:
                    flat.append(round(x, 2))
                    flat.append(round(y, 2))
                rings.append(flat)
                total_points += len(ring)

        if not rings:
            continue

        label_x = props.get("LABEL_X")
        label_y = props.get("LABEL_Y")
        if label_x is None or label_y is None:
            xs = [r[i] for r in rings for i in range(0, len(r), 2)]
            ys = [r[i] for r in rings for i in range(1, len(r), 2)]
            label_x, label_y = sum(xs) / len(xs), sum(ys) / len(ys)

        countries.append({
            "a3": a3,
            "name": name,
            # Natural Earth ships an Indonesian name field, which is exactly
            # what the ID side of the language toggle needs.
            "nameId": SHORT_ID.get(a3) or props.get("NAME_ID") or name,
            "label": [round(label_x, 3), round(label_y, 3)],
            # LABELRANK is 1 for the most prominent countries; the globe uses
            # it to decide which labels survive at a given zoom.
            "rank": int(props.get("LABELRANK") or 6),
            "rings": rings,
        })

    countries.sort(key=lambda c: (c["rank"], c["name"]))
    with open(dst, "w") as fh:
        json.dump({"countries": countries}, fh, separators=(",", ":"))

    print(f"{len(countries)} countries  "
          f"{sum(len(c['rings']) for c in countries)} rings  "
          f"{total_points} points -> {dst}")


if __name__ == "__main__":
    build(sys.argv[1], sys.argv[2])
