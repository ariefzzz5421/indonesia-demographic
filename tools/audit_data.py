#!/usr/bin/env python3
"""
Consistency audit for the generated datasets.

This does not verify the numbers against their sources — nothing here can do
that — but it does catch the class of error that silently corrupts a
visualisation: shares that do not add up, head counts that disagree with the
totals they were derived from, ratios that contradict their own inputs, and
series with gaps or duplicate years.

    python3 tools/audit_data.py
"""

import json
import re
import sys


def load(path, const):
    """Read the JSON payload out of a generated ES module."""
    text = open(path).read()
    body = text.split(f"export const {const} = ", 1)[1]
    body = body.rsplit(";", 2)[0]
    return json.loads(body)


def main():
    failures = []
    notes = []

    def check(label, ok, detail=""):
        (notes if ok else failures).append(f"{'ok  ' if ok else 'FAIL'}  {label}{(' — ' + detail) if detail else ''}")

    history = load("src/data/history.js", "HISTORY")
    stats = load("src/data/stats.js", "DATA")

    # ── Generations ───────────────────────────────────────────────────
    gen = history["generations"]
    share_sum = round(sum(g["share"] for g in gen["groups"]), 6)
    check("generation shares sum to 100", share_sum == 100.0, f"{share_sum}")
    count_sum = sum(g["count"] for g in gen["groups"])
    check("generation counts sum to the census total",
          count_sum == gen["total"], f"{count_sum:,} vs {gen['total']:,}")
    for g in gen["groups"]:
        implied = g["count"] / gen["total"] * 100
        check(f"  {g['name']} count matches its share",
              abs(implied - g["share"]) < 0.01, f"{implied:.3f}% vs {g['share']}%")
    bands = [(g["bornFrom"], g["bornTo"]) for g in gen["groups"]]
    ordered = sorted((b for b in bands if b[0]), key=lambda b: b[0])
    gaps = [(a, b) for a, b in zip(ordered, ordered[1:]) if a[1] is not None and b[0] != a[1] + 1]
    check("generation birth-year bands are contiguous", not gaps, str(gaps))

    # ── Sex split ─────────────────────────────────────────────────────
    census_pop = next(p["value"] for p in history["population"] if p["year"] == 2020)
    split = history["sexSplit"]["census2020"]
    check("2020 sex split totals the census population",
          split["total"] == census_pop, f"{split['total']:,} vs {census_pop:,}")
    check("2020 sex shares sum to 100",
          abs(split["maleShare"] + split["femaleShare"] - 100) < 0.02,
          f"{split['maleShare']} + {split['femaleShare']}")
    ratio = split["male"] / split["female"] * 100
    check("2020 sex ratio matches its counts",
          abs(ratio - split["ratio"]) < 0.02, f"{ratio:.2f} vs {split['ratio']}")
    published = next(r["value"] for r in history["sexRatio"] if r["year"] == 2020)
    check("2020 sex ratio agrees with the census series",
          abs(ratio - published) < 0.5, f"derived {ratio:.2f} vs series {published}")

    # ── Population series ─────────────────────────────────────────────
    years = [p["year"] for p in history["population"]]
    check("population series has no duplicate years", len(years) == len(set(years)))
    check("population series has no gaps",
          years == list(range(years[0], years[-1] + 1)), f"{years[0]}–{years[-1]}")
    check("population is monotonically increasing",
          all(b["value"] > a["value"] for a, b in zip(history["population"], history["population"][1:])))

    # ── Investors ─────────────────────────────────────────────────────
    pop_by_year = {p["year"]: p["value"] for p in history["population"]}
    for row in history["investors"]:
        implied = row["total"] / pop_by_year[row["year"]] * 100
        check(f"  SID {row['year']} penetration matches population",
              abs(implied - row["penetration"]) < 0.01, f"{implied:.3f}% vs {row['penetration']}%")
        if row.get("stocks"):
            check(f"  SID {row['year']} equity subset <= total", row["stocks"] <= row["total"])

    # ── Provincial statistics ─────────────────────────────────────────
    provinces = stats["provinces"]
    share_total = round(sum(p["gdpShare"] for p in provinces), 2)
    check("provincial GDP shares sum to 100", abs(share_total - 100) < 0.05, f"{share_total}")
    for p in provinces:
        density = p["population"] / p["areaKm2"]
        check(f"  {p['name']} density matches population/area",
              abs(density - p["density"]) < 0.15, f"{density:.1f} vs {p['density']}")
        per_capita = p["gdpIdr"] / p["population"]
        check(f"  {p['name']} GRDP per capita matches",
              abs(per_capita - p["gdpPerCapitaIdr"]) < 1, f"{per_capita:.0f}")
    pop_sum = sum(p["population"] for p in provinces)
    check("province population sum matches the recorded total",
          pop_sum == stats["national"]["provincePopulationSum"], f"{pop_sum:,}")

    # ── National series ───────────────────────────────────────────────
    for row in stats["series"]:
        implied = row["gdpUsd"] / row["population"]
        check(f"  {row['year']} GDP per capita matches GDP/population",
              abs(implied - row["gdpPerCapitaUsd"]) < 1, f"{implied:.1f}")

    for line in notes:
        print(line)
    print()
    if failures:
        for line in failures:
            print(line)
        print(f"\n{len(failures)} check(s) failed")
        return 1
    print(f"all {len(notes)} consistency checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
