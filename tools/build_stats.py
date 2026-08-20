#!/usr/bin/env python3
"""
Generate src/data/stats.js — the demographic and economic dataset behind the
visualisation.

Sources
-------
* Population, land area, GDP (PDB) and GDP per capita  : Badan Pusat Statistik (BPS)
* USD-denominated GDP series and 2025 estimate         : IMF World Economic Outlook / World Bank
* Share of national GDP by island group ("struktur       BPS, annual 2024
  ekonomi spasial")

Provincial GDP (PDRB, current prices)
-------------------------------------
BPS publishes PDRB per province, but the headline release that is easiest to
verify is the island-group share of national GDP. So provincial values here are
best-available published estimates that are then *calibrated*: every province in
an island group is scaled by a single factor so that the group sums exactly to
the BPS 2024 share. National PDRB therefore reconciles to BPS PDB by
construction, and the calibration factors are printed on every build so the size
of the adjustment stays visible (all are within ~4.5%).

Geometry note
-------------
The map carries 34 province polygons. Indonesia has had 38 provinces since the
2022 Papua split, so the four new Papua provinces are folded back into their
parent polygons: `papua` = Papua + Papua Tengah + Papua Pegunungan + Papua
Selatan, `papuabarat` = Papua Barat + Papua Barat Daya.

Usage
-----
    python3 tools/build_stats.py src/data/stats.js
"""

import json
import sys

# --- National ---------------------------------------------------------------

PDB_2024_IDR_T = 22138.9      # Rp trillion, current prices, BPS
USDIDR_2024 = 15850.0         # period average

NATIONAL = {
    "populationLatest": 284438782,      # BPS, mid-2025 projection
    "populationLatestYear": 2025,
    "gdpNominalUsd": 1.4020e12,         # 2024, IMF WEO
    "gdpPppUsd": 4.6600e12,             # 2024, IMF WEO
    "gdpIdr": PDB_2024_IDR_T * 1e12,
    "gdpPerCapitaUsd": 4960.3,          # BPS 2024 (Rp 78,62 juta)
    "gdpPerCapitaIdr": 78.62e6,
    "gdpYear": 2024,
    "growth2024": 5.03,                 # % y/y, BPS
    "inflation2024": 1.57,              # % Dec y/y, BPS
    "unemployment2024": 4.91,           # % open unemployment, Aug 2024, BPS
    "laborForce2024": 152110000,        # Aug 2024, BPS
    "lifeExpectancy2024": 74.15,        # years, BPS
    "medianAge": 30.2,
    "urbanShare": 58.6,                 # % of population, 2024
    "provinceCount": 38,
    "mapUnitCount": 34,
    "regencyCount": 514,
    "islandCount": 17380,               # named + registered islands, KKP 2022
    "landAreaKm2": 1916907,
    "seaAreaKm2": 6400000,
    "worldRankPopulation": 4,
    "worldRankGdpNominal": 16,
    "worldRankGdpPpp": 8,
}

# year, population, nominal GDP (USD bn), real GDP growth (%)
SERIES = [
    (2015, 258_383_000,   860.9, 4.88),
    (2016, 261_556_000,   931.9, 5.03),
    (2017, 264_646_000, 1_015.6, 5.07),
    (2018, 267_663_000, 1_042.3, 5.17),
    (2019, 270_626_000, 1_119.1, 5.02),
    (2020, 270_203_917, 1_059.1, -2.07),
    (2021, 273_879_000, 1_186.5, 3.70),
    (2022, 275_773_800, 1_319.1, 5.31),
    (2023, 278_696_200, 1_371.2, 5.05),
    (2024, 281_603_800, 1_402.0, 5.03),
    (2025, 284_438_782, 1_486.0, 4.90),   # 2025 = IMF estimate
]

# BPS 2024 spatial structure of the economy: share of national GDP, %
ISLAND_SHARE = {
    "jawa": 57.15,
    "sumatera": 21.83,
    "kalimantan": 8.11,
    "sulawesi": 7.25,
    "balinusra": 2.79,
    "malukupapua": 2.87,
}

ISLAND_LABEL = {
    "jawa": ("Jawa", "Java"),
    "sumatera": ("Sumatera", "Sumatra"),
    "kalimantan": ("Kalimantan", "Kalimantan (Borneo)"),
    "sulawesi": ("Sulawesi", "Sulawesi (Celebes)"),
    "balinusra": ("Bali & Nusa Tenggara", "Bali & Nusa Tenggara"),
    "malukupapua": ("Maluku & Papua", "Maluku & Papua"),
}

# id: (name, capital, island, population 2024 (thousands), land area km2,
#      PDRB 2024 estimate before calibration (Rp trillion))
PROVINCES = [
    ("aceh",       "Aceh",                  "Banda Aceh",     "sumatera",  5554,  56835,  250),
    ("sumut",      "Sumatera Utara",        "Medan",          "sumatera", 15588,  72981, 1150),
    ("sumbar",     "Sumatera Barat",        "Padang",         "sumatera",  5836,  42013,  340),
    ("riau",       "Riau",                  "Pekanbaru",      "sumatera",  6728,  87024, 1030),
    ("jambi",      "Jambi",                 "Jambi",          "sumatera",  3712,  50058,  300),
    ("sumsel",     "Sumatera Selatan",      "Palembang",      "sumatera",  8837,  91592,  720),
    ("bengkulu",   "Bengkulu",              "Bengkulu",       "sumatera",  2097,  19919,  105),
    ("lampung",    "Lampung",               "Bandar Lampung", "sumatera",  9415,  34624,  480),
    ("babel",      "Kep. Bangka Belitung",  "Pangkalpinang",  "sumatera",  1529,  16424,  105),
    ("kepri",      "Kepulauan Riau",        "Tanjungpinang",  "sumatera",  2232,   8202,  380),
    ("jakarta",    "DKI Jakarta",           "Jakarta",        "jawa",     10672,    664, 3600),
    ("jabar",      "Jawa Barat",            "Bandung",        "jawa",     50345,  35378, 2830),
    ("jateng",     "Jawa Tengah",           "Semarang",       "jawa",     37540,  32801, 1890),
    ("diy",        "DI Yogyakarta",         "Yogyakarta",     "jawa",      3747,   3133,  190),
    ("jatim",      "Jawa Timur",            "Surabaya",       "jawa",     41814,  47800, 3300),
    ("banten",     "Banten",                "Serang",         "jawa",     12363,   9663,  900),
    ("bali",       "Bali",                  "Denpasar",       "balinusra", 4375,   5780,  300),
    ("ntb",        "Nusa Tenggara Barat",   "Mataram",        "balinusra", 5646,  18572,  170),
    ("ntt",        "Nusa Tenggara Timur",   "Kupang",         "balinusra", 5617,  48718,  145),
    ("kalbar",     "Kalimantan Barat",      "Pontianak",      "kalimantan", 5673, 147307,  280),
    ("kalteng",    "Kalimantan Tengah",     "Palangka Raya",  "kalimantan", 2809, 153564,  230),
    ("kalsel",     "Kalimantan Selatan",    "Banjarbaru",     "kalimantan", 4270,  38744,  285),
    ("kaltim",     "Kalimantan Timur",      "Samarinda",      "kalimantan", 4030, 129067,  880),
    ("kaltara",    "Kalimantan Utara",      "Tanjung Selor",  "kalimantan",  730,  75468,  135),
    ("sulut",      "Sulawesi Utara",        "Manado",         "sulawesi",   2668,  13852,  190),
    ("sulteng",    "Sulawesi Tengah",       "Palu",           "sulawesi",   3110,  61841,  320),
    ("sulsel",     "Sulawesi Selatan",      "Makassar",       "sulawesi",   9424,  46717,  790),
    ("sultra",     "Sulawesi Tenggara",     "Kendari",        "sulawesi",   2760,  38068,  190),
    ("gorontalo",  "Gorontalo",             "Gorontalo",      "sulawesi",   1231,  11257,   60),
    ("sulbar",     "Sulawesi Barat",        "Mamuju",         "sulawesi",   1489,  16787,   60),
    ("maluku",     "Maluku",                "Ambon",          "malukupapua",1921,  46914,   65),
    ("malut",      "Maluku Utara",          "Sofifi",         "malukupapua",1362,  31982,   90),
    ("papuabarat", "Papua Barat",           "Manokwari",      "malukupapua",1320, 102955,  170),
    ("papua",      "Papua",                 "Jayapura",       "malukupapua",4520, 319036,  340),
]

# Provinces whose polygon still carries pre-2022 territory.
MERGED = {
    "papua": ["Papua", "Papua Tengah", "Papua Pegunungan", "Papua Selatan"],
    "papuabarat": ["Papua Barat", "Papua Barat Daya"],
}


def build(dst):
    # Calibrate provincial PDRB so each island group matches its BPS share.
    raw_by_island = {}
    for _, _, _, island, _, _, pdrb in PROVINCES:
        raw_by_island[island] = raw_by_island.get(island, 0.0) + pdrb

    factors = {}
    for island, share in ISLAND_SHARE.items():
        target = share / 100.0 * PDB_2024_IDR_T
        factors[island] = target / raw_by_island[island]
        print(f"  calibration {island:<12} x{factors[island]:.4f} "
              f"(raw {raw_by_island[island]:.0f}T -> {target:.0f}T)")

    provinces = []
    for pid, name, capital, island, pop_k, area, pdrb in PROVINCES:
        population = pop_k * 1000
        gdp_idr = pdrb * factors[island] * 1e12
        entry = {
            "id": pid,
            "name": name,
            "capital": capital,
            "island": island,
            "population": population,
            "areaKm2": area,
            "density": round(population / area, 1),
            "gdpIdr": round(gdp_idr),
            "gdpUsd": round(gdp_idr / USDIDR_2024),
            "gdpPerCapitaIdr": round(gdp_idr / population),
            "gdpPerCapitaUsd": round(gdp_idr / population / USDIDR_2024),
            "gdpShare": round(gdp_idr / (PDB_2024_IDR_T * 1e12) * 100, 3),
        }
        if pid in MERGED:
            entry["merged"] = MERGED[pid]
        provinces.append(entry)

    islands = []
    for island, share in ISLAND_SHARE.items():
        members = [p for p in provinces if p["island"] == island]
        pop = sum(p["population"] for p in members)
        islands.append({
            "id": island,
            "name": ISLAND_LABEL[island][0],
            "nameEn": ISLAND_LABEL[island][1],
            "gdpShare": share,
            "population": pop,
            "provinces": len(members),
            "areaKm2": sum(p["areaKm2"] for p in members),
        })

    total_pop = sum(p["population"] for p in provinces)
    print(f"  provincial population sum: {total_pop:,} "
          f"(BPS mid-2024 national: {SERIES[-2][1]:,})")

    doc = {
        "national": dict(NATIONAL, provincePopulationSum=total_pop, provincePopulationYear=2024),
        "series": [{"year": y, "population": p, "gdpUsd": g * 1e9, "growth": r,
                    "gdpPerCapitaUsd": round(g * 1e9 / p, 1)} for y, p, g, r in SERIES],
        "islands": islands,
        "provinces": provinces,
    }

    body = json.dumps(doc, indent=1)
    with open(dst, "w") as fh:
        fh.write("// Generated by tools/build_stats.py — do not edit by hand.\n")
        fh.write("// Sources: BPS (population, area, PDB/PDRB), IMF WEO & World Bank (USD series).\n")
        fh.write("export const DATA = ")
        fh.write(body)
        fh.write(";\n\nexport default DATA;\n")
    print(f"  wrote {dst}")


if __name__ == "__main__":
    build(sys.argv[1])
