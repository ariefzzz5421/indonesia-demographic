#!/usr/bin/env python3
"""
Generate src/data/history.js — everything the Indonesia page and the long
historical chart need.

Sources
-------
* Population        : BPS decennial censuses (1961-2020) plus official mid-year
                      projections for 2024/2025. The 1945 figure is the usual
                      proclamation-era estimate, not a census.
* Nominal GDP (USD) : World Bank / IMF World Economic Outlook. The series only
                      begins in 1960; before that no comparable estimate exists.
* Real GDP growth   : BPS, plus published figures for the crisis years.
* Sex ratio         : BPS censuses.
* Investor accounts : KSEI Single Investor Identification (SID), year-end.
* Minimum wages     : provincial governor decrees for 2025 (UMK), with DKI
                      Jakarta shown as a province-wide UMP.

Interpolation
-------------
Population is only measured at censuses. Intermediate years are filled by
geometric interpolation between anchors and flagged `estimated: true`, so the
chart can draw a continuous line while still marking which points are real
measurements.

Usage
-----
    python3 tools/build_history.py src/data/history.js
"""

import json
import sys

# ── Population: BPS censuses and official projections ───────────────────────
POPULATION_ANCHORS = [
    (1945,  70_000_000, "estimate"),   # proclamation-era estimate
    (1961,  97_018_829, "census"),
    (1971, 119_208_229, "census"),
    (1980, 147_490_298, "census"),
    (1990, 179_378_946, "census"),
    (2000, 206_264_595, "census"),
    (2010, 237_641_326, "census"),
    (2020, 270_203_917, "census"),
    (2024, 281_603_800, "projection"),
    (2025, 284_438_782, "projection"),
]

# ── Nominal GDP in current USD (World Bank / IMF) ───────────────────────────
# Five-year anchors before 1990, annual afterwards.
GDP_USD = {
    1960: 5.98e9,   1965: 3.83e9,   1970: 9.15e9,   1975: 32.5e9,
    1980: 99.0e9,   1985: 87.3e9,   1990: 114.4e9,  1995: 202.1e9,
    1996: 227.4e9,  1997: 215.7e9,  1998: 95.4e9,   1999: 140.0e9,
    2000: 165.0e9,  2001: 160.4e9,  2002: 195.7e9,  2003: 234.8e9,
    2004: 256.8e9,  2005: 285.9e9,  2006: 364.6e9,  2007: 432.2e9,
    2008: 510.2e9,  2009: 539.6e9,  2010: 755.1e9,  2011: 892.6e9,
    2012: 917.9e9,  2013: 912.5e9,  2014: 890.8e9,  2015: 860.9e9,
    2016: 931.9e9,  2017: 1015.6e9, 2018: 1042.3e9, 2019: 1119.1e9,
    2020: 1059.1e9, 2021: 1186.5e9, 2022: 1319.1e9, 2023: 1371.2e9,
    2024: 1402.0e9, 2025: 1486.0e9,
}
GDP_ESTIMATED = {2025}

# ── Real GDP growth, % (only years with a published figure) ─────────────────
GROWTH = {
    1966: 2.79, 1970: 7.55, 1975: 4.98, 1980: 7.93, 1985: 2.46, 1990: 9.00,
    1995: 8.22, 1996: 7.82, 1997: 4.70, 1998: -13.13, 1999: 0.79, 2000: 4.92,
    2005: 5.69, 2008: 6.01, 2009: 4.63, 2010: 6.22, 2015: 4.88, 2016: 5.03,
    2017: 5.07, 2018: 5.17, 2019: 5.02, 2020: -2.07, 2021: 3.70, 2022: 5.31,
    2023: 5.05, 2024: 5.03, 2025: 4.90,
}

# ── Sex ratio: males per 100 females, BPS censuses ──────────────────────────
SEX_RATIO = [
    (1971, 97.2), (1980, 98.8), (1990, 99.4),
    (2000, 101.0), (2010, 101.4), (2020, 102.0),
]

SEX_SPLIT_2020 = {"male": 136_661_899, "female": 133_542_018, "year": 2020, "basis": "census"}
SEX_SPLIT_2024 = {"male": 142_170_000, "female": 139_434_000, "year": 2024, "basis": "projection"}

# ── KSEI Single Investor Identification, year-end ───────────────────────────
SID = [
    (2017,  1_122_668, None),
    (2018,  1_619_372, None),
    (2019,  2_484_354, None),
    (2020,  3_880_753, 1_695_268),
    (2021,  7_489_337, 3_451_513),
    (2022, 10_311_152, 4_440_479),
    (2023, 12_168_061, 5_258_832),
    (2024, 14_809_000, 6_380_000),
]
SID_ESTIMATE_2025 = (2025, 17_200_000, 7_300_000)

# ── Minimum wage 2025, rupiah per month ─────────────────────────────────────
# UMK unless noted; DKI Jakarta sets a single province-wide UMP.
WAGES = [
    ("Kota Bekasi",            "Jawa Barat",  5_690_752, "UMK"),
    ("Kabupaten Karawang",     "Jawa Barat",  5_599_593, "UMK"),
    ("Kabupaten Bekasi",       "Jawa Barat",  5_558_515, "UMK"),
    ("DKI Jakarta",            "DKI Jakarta", 5_396_761, "UMP"),
    ("Kota Depok",             "Jawa Barat",  5_195_721, "UMK"),
    ("Kota Cilegon",           "Banten",      5_128_084, "UMK"),
    ("Kota Bogor",             "Jawa Barat",  5_126_897, "UMK"),
    ("Kota Tangerang Selatan", "Banten",      4_974_393, "UMK"),
    ("Kota Surabaya",          "Jawa Timur",  4_961_753, "UMK"),
    ("Kabupaten Tangerang",    "Banten",      4_901_117, "UMK"),
]

# ── Milestones ──────────────────────────────────────────────────────────────
# `era` drives the colour band on the timeline.
MILESTONES = [
    {
        "year": 1945, "date": "17 Agustus 1945", "dateEn": "17 August 1945",
        "era": "revolusi", "tag": "Proklamasi", "tagEn": "Proclamation",
        "title": "Proklamasi Kemerdekaan",
        "titleEn": "Proclamation of Independence",
        "body": "Soekarno dan Hatta memproklamasikan kemerdekaan Indonesia di Jalan Pegangsaan Timur 56, Jakarta, dua hari setelah Jepang menyerah. Penduduk Indonesia saat itu diperkirakan sekitar 70 juta jiwa — seperempat dari jumlah hari ini.",
        "bodyEn": "Soekarno and Hatta proclaimed Indonesian independence at Jalan Pegangsaan Timur 56 in Jakarta, two days after Japan's surrender. The population then was roughly 70 million — a quarter of today's.",
        "stat": "±70 juta jiwa", "statEn": "±70 million people",
    },
    {
        "year": 1949, "date": "27 Desember 1949", "dateEn": "27 December 1949",
        "era": "revolusi", "tag": "Kedaulatan", "tagEn": "Sovereignty",
        "title": "Pengakuan Kedaulatan",
        "titleEn": "Recognition of Sovereignty",
        "body": "Setelah empat tahun Revolusi Nasional dan dua Agresi Militer Belanda, Konferensi Meja Bundar di Den Haag mengakhiri perang. Belanda mengakui kedaulatan Republik Indonesia Serikat — kecuali Irian Barat, yang baru bergabung pada 1963.",
        "bodyEn": "After four years of national revolution and two Dutch military offensives, the Round Table Conference in The Hague ended the war. The Netherlands recognised Indonesian sovereignty — excluding West Irian, which joined only in 1963.",
    },
    {
        "year": 1955, "date": "29 September 1955", "dateEn": "29 September 1955",
        "era": "orlama", "tag": "Demokrasi", "tagEn": "Democracy",
        "title": "Pemilihan Umum Pertama",
        "titleEn": "The First General Election",
        "body": "Pemilu pertama Indonesia diikuti lebih dari 30 partai dan sering disebut salah satu pemilu paling bebas dalam sejarah Indonesia. Tidak ada partai yang menang mayoritas; empat besar hanya menguasai sekitar tiga perempat kursi.",
        "bodyEn": "Indonesia's first general election drew more than 30 parties and is still cited as one of the freest in the country's history. No party won a majority; the top four together held only about three quarters of the seats.",
    },
    {
        "year": 1966, "date": "1966", "dateEn": "1966",
        "era": "orlama", "tag": "Hiperinflasi", "tagEn": "Hyperinflation",
        "title": "Ekonomi di Titik Nadir",
        "titleEn": "The Economy Bottoms Out",
        "body": "Setelah Konfrontasi dan keluarnya Indonesia dari PBB dan IMF, inflasi menembus 600 persen dan pertumbuhan nyaris berhenti. Peralihan kekuasaan ke Soeharto dimulai lewat Supersemar pada Maret 1966.",
        "bodyEn": "After Konfrontasi and Indonesia's withdrawal from the UN and the IMF, inflation broke 600 per cent and growth all but stopped. The transfer of power to Soeharto began with the Supersemar order in March 1966.",
        "stat": "Inflasi ±635%", "statEn": "Inflation ±635%",
    },
    {
        "year": 1973, "date": "1973–1981", "dateEn": "1973–1981",
        "era": "orba", "tag": "Boom minyak", "tagEn": "Oil boom",
        "title": "Rezeki Minyak dan Pembangunan",
        "titleEn": "Oil Windfall and Development",
        "body": "Dua guncangan harga minyak dunia mengubah APBN. Pendapatan negara melonjak, Repelita mendanai sekolah, jalan, dan swasembada beras yang tercapai pada 1984. PDB nominal naik dari sekitar US$9 miliar pada 1970 menjadi US$99 miliar pada 1980.",
        "bodyEn": "Two world oil shocks transformed the state budget. Revenue surged, and the five-year plans funded schools, roads and the rice self-sufficiency reached in 1984. Nominal GDP rose from about US$9 billion in 1970 to US$99 billion in 1980.",
        "stat": "PDB ×11 dalam satu dekade", "statEn": "GDP ×11 in one decade",
    },
    {
        "year": 1997, "date": "Juli 1997", "dateEn": "July 1997",
        "era": "krisis", "tag": "Krisis", "tagEn": "Crisis",
        "title": "Krisis Moneter Asia Menyentuh Rupiah",
        "titleEn": "The Asian Crisis Reaches the Rupiah",
        "body": "Setelah baht Thailand dilepas pada 2 Juli 1997, tekanan menjalar ke Jakarta. Bank Indonesia melepas rentang intervensi pada 14 Agustus. Rupiah meluncur dari sekitar Rp 2.400 per dolar menjadi hampir Rp 16.800 pada Januari 1998.",
        "bodyEn": "After Thailand floated the baht on 2 July 1997, the pressure spread to Jakarta. Bank Indonesia abandoned its intervention band on 14 August. The rupiah slid from about Rp 2,400 per dollar to nearly Rp 16,800 by January 1998.",
        "stat": "Rp 2.400 → Rp 16.800", "statEn": "Rp 2,400 → Rp 16,800",
    },
    {
        "year": 1998, "date": "21 Mei 1998", "dateEn": "21 May 1998",
        "era": "krisis", "tag": "Reformasi", "tagEn": "Reformasi",
        "title": "Krisis 1998 dan Jatuhnya Orde Baru",
        "titleEn": "The 1998 Crisis and the Fall of the New Order",
        "body": "Tahun terberat dalam sejarah ekonomi Indonesia modern: PDB riil menyusut 13,1 persen, inflasi mencapai 77,6 persen, dan sebagian besar sistem perbankan harus direkapitalisasi. Diukur dalam dolar, ekonomi menyusut dari US$216 miliar menjadi US$95 miliar dalam satu tahun. Soeharto mengundurkan diri pada 21 Mei setelah 32 tahun berkuasa, membuka era Reformasi.",
        "bodyEn": "The worst year in modern Indonesian economic history: real GDP shrank 13.1 per cent, inflation hit 77.6 per cent, and most of the banking system had to be recapitalised. Measured in dollars the economy fell from US$216 billion to US$95 billion in a single year. Soeharto resigned on 21 May after 32 years in power, opening the Reformasi era.",
        "stat": "PDB riil −13,1%", "statEn": "Real GDP −13.1%",
    },
    {
        "year": 2001, "date": "1 Januari 2001", "dateEn": "1 January 2001",
        "era": "reformasi", "tag": "Otonomi", "tagEn": "Devolution",
        "title": "Otonomi Daerah",
        "titleEn": "Regional Autonomy",
        "body": "Kewenangan dan anggaran berpindah dari Jakarta ke kabupaten dan kota — salah satu desentralisasi terbesar yang pernah dilakukan negara mana pun dalam waktu sesingkat itu. Jumlah daerah otonom terus bertambah hingga 514 kabupaten/kota hari ini.",
        "bodyEn": "Authority and budgets moved from Jakarta to the regencies and cities — one of the largest devolutions any country has attempted in so short a time. The number of autonomous regions kept growing, to today's 514.",
    },
    {
        "year": 2004, "date": "26 Desember 2004", "dateEn": "26 December 2004",
        "era": "reformasi", "tag": "Bencana", "tagEn": "Disaster",
        "title": "Gempa dan Tsunami Aceh",
        "titleEn": "The Aceh Earthquake and Tsunami",
        "body": "Gempa berkekuatan 9,1 di lepas pantai barat Aceh memicu tsunami samudra Hindia. Sekitar 167 ribu jiwa meninggal atau hilang di Indonesia. Rekonstruksi yang menyusul turut membuka jalan bagi perdamaian Aceh lewat MoU Helsinki pada Agustus 2005.",
        "bodyEn": "A magnitude 9.1 earthquake off western Aceh triggered the Indian Ocean tsunami. Around 167,000 people in Indonesia died or went missing. The reconstruction that followed helped open the way to the Aceh peace deal signed in Helsinki in August 2005.",
    },
    {
        "year": 2009, "date": "2008–2009", "dateEn": "2008–2009",
        "era": "reformasi", "tag": "Ketahanan", "tagEn": "Resilience",
        "title": "Melewati Krisis Keuangan Global",
        "titleEn": "Riding Out the Global Financial Crisis",
        "body": "Sementara sebagian besar dunia mengalami resesi, Indonesia tetap tumbuh 4,6 persen pada 2009 — salah satu dari sedikit ekonomi G20 yang tidak menyusut. Konsumsi domestik yang besar dan perbankan yang sudah dibersihkan sejak 1998 menjadi penopangnya.",
        "bodyEn": "While most of the world contracted, Indonesia still grew 4.6 per cent in 2009 — one of the few G20 economies that did not shrink. A large domestic consumer base and a banking system cleaned up after 1998 carried it through.",
        "stat": "Tumbuh 4,6% saat dunia resesi", "statEn": "Grew 4.6% through a global recession",
    },
    {
        "year": 2011, "date": "Desember 2011", "dateEn": "December 2011",
        "era": "reformasi", "tag": "Peringkat", "tagEn": "Rating",
        "title": "Kembali ke Investment Grade",
        "titleEn": "Back to Investment Grade",
        "body": "Fitch menaikkan peringkat utang Indonesia ke investment grade untuk pertama kalinya sejak 1997, disusul lembaga pemeringkat lain. Biaya utang turun dan arus modal masuk menguat.",
        "bodyEn": "Fitch restored Indonesia's investment-grade rating for the first time since 1997, with the other agencies following. Borrowing costs fell and capital inflows strengthened.",
    },
    {
        "year": 2020, "date": "Maret 2020", "dateEn": "March 2020",
        "era": "kini", "tag": "Pandemi", "tagEn": "Pandemic",
        "title": "COVID-19 dan Resesi Pertama Sejak 1998",
        "titleEn": "COVID-19 and the First Recession Since 1998",
        "body": "PDB menyusut 2,07 persen sepanjang 2020, resesi pertama dalam 22 tahun. Sensus Penduduk 2020 tetap berjalan dan mencatat 270,2 juta jiwa. Ekonomi kembali tumbuh 3,7 persen pada 2021.",
        "bodyEn": "GDP shrank 2.07 per cent across 2020, the first recession in 22 years. The 2020 census still went ahead and counted 270.2 million people. Growth returned at 3.7 per cent in 2021.",
        "stat": "PDB −2,07%", "statEn": "GDP −2.07%",
    },
    {
        "year": 2022, "date": "2022", "dateEn": "2022",
        "era": "kini", "tag": "Pemekaran", "tagEn": "New provinces",
        "title": "Presidensi G20 dan Pemekaran Papua",
        "titleEn": "G20 Presidency and the Papua Split",
        "body": "Indonesia memimpin G20 dan menjadi tuan rumah KTT Bali. Pada tahun yang sama empat provinsi baru dibentuk di Papua — Papua Tengah, Papua Pegunungan, Papua Selatan, dan Papua Barat Daya — menjadikan jumlah provinsi 38. Ledakan harga komoditas mendorong pertumbuhan ke 5,31 persen.",
        "bodyEn": "Indonesia held the G20 presidency and hosted the Bali summit. The same year four new provinces were carved out of Papua — Papua Tengah, Papua Pegunungan, Papua Selatan and Papua Barat Daya — bringing the total to 38. A commodity price boom pushed growth to 5.31 per cent.",
        "stat": "34 → 38 provinsi", "statEn": "34 → 38 provinces",
    },
    {
        "year": 2024, "date": "20 Oktober 2024", "dateEn": "20 October 2024",
        "era": "kini", "tag": "Politik", "tagEn": "Politics",
        "title": "Pemilu Serentak dan Pergantian Pemerintahan",
        "titleEn": "Simultaneous Elections and a Change of Government",
        "body": "Lebih dari 200 juta pemilih terdaftar dalam salah satu pemungutan suara satu hari terbesar di dunia. Prabowo Subianto dilantik sebagai presiden pada 20 Oktober 2024. Ekonomi tumbuh 5,03 persen sepanjang tahun dengan inflasi 1,57 persen.",
        "bodyEn": "More than 200 million registered voters took part in one of the world's largest single-day ballots. Prabowo Subianto was inaugurated as president on 20 October 2024. The economy grew 5.03 per cent over the year with inflation at 1.57 per cent.",
        "stat": "PDB per kapita US$4.960", "statEn": "GDP per capita US$4,960",
    },
    {
        "year": 2025, "date": "2025", "dateEn": "2025",
        "era": "kini", "tag": "Sekarang", "tagEn": "Now",
        "title": "284 Juta Jiwa dan Ekonomi US$1,5 Triliun",
        "titleEn": "284 Million People and a US$1.5 Trillion Economy",
        "body": "Proyeksi BPS menempatkan penduduk Indonesia pada 284,4 juta jiwa pada pertengahan 2025 — terbesar keempat di dunia. Ekonominya terbesar ke-16 secara nominal dan ke-8 berdasarkan paritas daya beli, dengan jumlah investor pasar modal yang naik lebih dari sepuluh kali lipat sejak 2017.",
        "bodyEn": "BPS projections put Indonesia at 284.4 million people by mid-2025 — the fourth largest population on earth. Its economy ranks 16th nominally and 8th by purchasing power parity, with capital-market investor accounts up more than tenfold since 2017.",
        "stat": "284.438.782 jiwa", "statEn": "284,438,782 people",
    },
]

ERAS = [
    {"id": "revolusi",  "from": 1945, "to": 1949, "name": "Revolusi Nasional",  "nameEn": "National Revolution", "color": "#ff6b6b"},
    {"id": "orlama",    "from": 1950, "to": 1966, "name": "Orde Lama",          "nameEn": "Old Order",           "color": "#f5a25d"},
    {"id": "orba",      "from": 1967, "to": 1997, "name": "Orde Baru",          "nameEn": "New Order",           "color": "#f5c451"},
    {"id": "krisis",    "from": 1997, "to": 1999, "name": "Krisis & Reformasi", "nameEn": "Crisis & Reformasi",  "color": "#ff4257"},
    {"id": "reformasi", "from": 1999, "to": 2014, "name": "Reformasi",          "nameEn": "Reformasi",           "color": "#46e3d0"},
    {"id": "kini",      "from": 2014, "to": 2025, "name": "Masa Kini",          "nameEn": "Present Day",         "color": "#8b7bff"},
]

# ── Latest situation ────────────────────────────────────────────────────────
LATEST = [
    {"key": "population",   "value": 284_438_782, "unit": "jiwa", "unitEn": "people",
     "label": "Penduduk", "labelEn": "Population", "note": "Proyeksi BPS, pertengahan 2025", "noteEn": "BPS projection, mid-2025"},
    {"key": "growth",       "value": 5.03, "unit": "%", "unitEn": "%",
     "label": "Pertumbuhan ekonomi", "labelEn": "GDP growth", "note": "Tahunan 2024, BPS", "noteEn": "Full year 2024, BPS"},
    {"key": "inflation",    "value": 1.57, "unit": "%", "unitEn": "%",
     "label": "Inflasi", "labelEn": "Inflation", "note": "Desember 2024 (y/y), BPS", "noteEn": "December 2024 (y/y), BPS"},
    {"key": "unemployment", "value": 4.91, "unit": "%", "unitEn": "%",
     "label": "Pengangguran terbuka", "labelEn": "Open unemployment", "note": "Agustus 2024, BPS", "noteEn": "August 2024, BPS"},
    {"key": "poverty",      "value": 9.03, "unit": "%", "unitEn": "%",
     "label": "Tingkat kemiskinan", "labelEn": "Poverty rate", "note": "Maret 2024, BPS", "noteEn": "March 2024, BPS"},
    {"key": "gini",         "value": 0.379, "unit": "", "unitEn": "",
     "label": "Rasio Gini", "labelEn": "Gini ratio", "note": "Maret 2024, BPS", "noteEn": "March 2024, BPS"},
    {"key": "hdi",          "value": 75.02, "unit": "", "unitEn": "",
     "label": "Indeks Pembangunan Manusia", "labelEn": "Human Development Index", "note": "2024, BPS", "noteEn": "2024, BPS"},
    {"key": "laborForce",   "value": 152_110_000, "unit": "orang", "unitEn": "people",
     "label": "Angkatan kerja", "labelEn": "Labour force", "note": "Agustus 2024, BPS", "noteEn": "August 2024, BPS"},
]


def interpolate_population():
    """Fill every year between census anchors, flagged as estimated."""
    out = []
    for i, (year, value, basis) in enumerate(POPULATION_ANCHORS):
        out.append({"year": year, "value": value, "basis": basis, "anchor": True})
        if i + 1 >= len(POPULATION_ANCHORS):
            continue
        next_year, next_value, _ = POPULATION_ANCHORS[i + 1]
        gap = next_year - year
        if gap <= 1:
            continue
        # Constant growth rate between measurements.
        rate = (next_value / value) ** (1 / gap)
        for step in range(1, gap):
            out.append({
                "year": year + step,
                "value": round(value * rate ** step),
                "basis": "interpolated",
                "anchor": False,
            })
    out.sort(key=lambda d: d["year"])
    return out


def build(dst):
    population = interpolate_population()

    gdp = [
        {"year": year, "value": value, "estimated": year in GDP_ESTIMATED}
        for year, value in sorted(GDP_USD.items())
    ]

    growth = [{"year": y, "value": v} for y, v in sorted(GROWTH.items())]

    pop_by_year = {d["year"]: d["value"] for d in population}
    sid = [
        {"year": y, "total": total, "stocks": stocks, "estimated": False,
         "penetration": round(total / pop_by_year[y] * 100, 3)}
        for y, total, stocks in SID
    ]
    y, total, stocks = SID_ESTIMATE_2025
    sid.append({"year": y, "total": total, "stocks": stocks, "estimated": True,
                "penetration": round(total / pop_by_year[y] * 100, 3)})

    def split(record):
        total = record["male"] + record["female"]
        return dict(record,
                    total=total,
                    maleShare=round(record["male"] / total * 100, 2),
                    femaleShare=round(record["female"] / total * 100, 2),
                    ratio=round(record["male"] / record["female"] * 100, 2))

    doc = {
        "population": population,
        "gdpUsd": gdp,
        "growth": growth,
        "eras": ERAS,
        "milestones": MILESTONES,
        "sexRatio": [{"year": y, "value": v} for y, v in SEX_RATIO],
        "sexSplit": {"census2020": split(SEX_SPLIT_2020), "latest": split(SEX_SPLIT_2024)},
        "investors": sid,
        "wages": [
            {"name": n, "province": p, "value": v, "kind": k}
            for n, p, v, k in WAGES
        ],
        "latest": LATEST,
    }

    with open(dst, "w") as fh:
        fh.write("// Generated by tools/build_history.py — do not edit by hand.\n")
        fh.write("// Sources: BPS (population, sex ratio, labour, poverty), World Bank & IMF\n")
        fh.write("// (nominal GDP in USD), KSEI (investor accounts), provincial decrees (2025 wages).\n")
        fh.write("export const HISTORY = ")
        json.dump(doc, fh, indent=1)
        fh.write(";\n\nexport default HISTORY;\n")

    print(f"  population {population[0]['year']}–{population[-1]['year']} "
          f"({len(population)} points, {sum(1 for p in population if p['anchor'])} measured)")
    print(f"  gdp {gdp[0]['year']}–{gdp[-1]['year']} ({len(gdp)} points)")
    print(f"  investors {sid[0]['year']}–{sid[-1]['year']}, "
          f"penetration {sid[-2]['penetration']}% in {sid[-2]['year']}")
    print(f"  milestones {len(MILESTONES)}  wages {len(WAGES)}")
    print(f"  wrote {dst}")


if __name__ == "__main__":
    build(sys.argv[1])
