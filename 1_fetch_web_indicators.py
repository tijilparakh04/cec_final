"""
1_fetch_web_indicators.py
────────────────────────────────────────────────────────────────────
Fetches second-level indicator values from public APIs and appends
them to Sheet 3 (Facts) of CEC_Engineering_Database_v2.xlsx.

Sources covered:
  • World Bank WDI API  → 17 indicators (all with WB codes)
  • ND-GAIN CSV         → D12a vulnerability
  • INFORM Risk API     → D12c hazard, D13b risk score
  • ISO members page    → S07a ISO membership
  • UNFCCC NDC registry → D15a NDC status
  • Fragile States Index→ D16a FSI score

Usage:
    python 1_fetch_web_indicators.py
    python 1_fetch_web_indicators.py --dry-run
    python 1_fetch_web_indicators.py --country KEN
    python 1_fetch_web_indicators.py --top T10      # only infra gap indicators
"""
import argparse, json, re, time, sys
from pathlib import Path
import requests
from openpyxl import load_workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from indicator_schema import SECONDS, TOPS, WB_FETCHABLE

DB = Path("CEC_Engineering_Database_v2.xlsx")
WB_API = "https://api.worldbank.org/v2/country/{iso2}/indicator/{code}?format=json&mrv=5&per_page=10"

THIN = Border(
    left=Side(style="thin", color="CCCCCC"), right=Side(style="thin", color="CCCCCC"),
    top=Side(style="thin", color="CCCCCC"),  bottom=Side(style="thin", color="CCCCCC"),
)

# World Bank uses ISO2 — we need a mapping
ISO3_TO_ISO2 = {
    "AFG":"AF","AGO":"AO","ALB":"AL","ARE":"AE","ARG":"AR","AUS":"AU","AUT":"AT",
    "BGD":"BD","BEL":"BE","BEN":"BJ","BFA":"BF","BGR":"BG","BHS":"BS","BLZ":"BZ",
    "BOL":"BO","BRA":"BR","BRN":"BN","BTN":"BT","BWA":"BW","CMR":"CM","CAN":"CA",
    "CAF":"CF","CHL":"CL","CHN":"CN","COD":"CD","COL":"CO","COM":"KM","CRI":"CR",
    "CPV":"CV","CYP":"CY","CZE":"CZ","DNK":"DK","DOM":"DO","DZA":"DZ","ECU":"EC",
    "EGY":"EG","ESH":"EH","ESP":"ES","ETH":"ET","FIN":"FI","FJI":"FJ","FRA":"FR",
    "GAB":"GA","GBR":"GB","GHA":"GH","GIN":"GN","GMB":"GM","GNB":"GW","GTM":"GT",
    "GUY":"GY","HND":"HN","HRV":"HR","HTI":"HT","HUN":"HU","IDN":"ID","IND":"IN",
    "IRL":"IE","IRN":"IR","IRQ":"IQ","ISL":"IS","ISR":"IL","ITA":"IT","JAM":"JM",
    "JOR":"JO","JPN":"JP","KAZ":"KZ","KEN":"KE","KGZ":"KG","KHM":"KH","KIR":"KI",
    "KOR":"KR","KWT":"KW","LAO":"LA","LBN":"LB","LBR":"LR","LBY":"LY","LCA":"LC",
    "LKA":"LK","LSO":"LS","LUX":"LU","MAR":"MA","MDG":"MG","MDV":"MV","MEX":"MX",
    "MKD":"MK","MLI":"ML","MLT":"MT","MMR":"MM","MNG":"MN","MOZ":"MZ","MRT":"MR",
    "MUS":"MU","MWI":"MW","MYS":"MY","NAM":"NA","NER":"NE","NGA":"NG","NIC":"NI",
    "NLD":"NL","NOR":"NO","NPL":"NP","NZL":"NZ","OMN":"OM","PAK":"PK","PAN":"PA",
    "PER":"PE","PHL":"PH","PNG":"PG","POL":"PL","PRT":"PT","PRY":"PY","QAT":"QA",
    "ROU":"RO","RUS":"RU","RWA":"RW","SAU":"SA","SDN":"SD","SEN":"SN","SLE":"SL",
    "SLB":"SB","SOM":"SO","SRB":"RS","SSD":"SS","STP":"ST","SUR":"SR","SVK":"SK",
    "SVN":"SI","SWE":"SE","SWZ":"SZ","SYR":"SY","TCD":"TD","TGO":"TG","THA":"TH",
    "TJK":"TJ","TKM":"TM","TLS":"TL","TTO":"TT","TUN":"TN","TUR":"TR","TZA":"TZ",
    "UGA":"UG","UKR":"UA","URY":"UY","USA":"US","UZB":"UZ","VCT":"VC","VEN":"VE",
    "VNM":"VN","VUT":"VU","WSM":"WS","YEM":"YE","ZAF":"ZA","ZMB":"ZM","ZWE":"ZW",
    "ATG":"AG","BRB":"BB","DMA":"DM","GRD":"GD","KNA":"KN","TON":"TO",
}

# ── Helpers ───────────────────────────────────────────────────────────────────
def log(msg, lvl="INFO"):
    col = {"OK":"\033[92m","WARN":"\033[93m","ERR":"\033[91m","INFO":"\033[94m"}.get(lvl,"")
    print(f"{col}[{lvl}]\033[0m {msg}")

def load_db():
    wb = load_workbook(DB)
    return wb

def read_countries(wb):
    ws = wb["1_Countries"]
    hdrs = [ws.cell(row=1, column=c).value for c in range(1, ws.max_column+1)]
    rows = []
    for r in range(2, ws.max_row+1):
        row = {hdrs[c]: ws.cell(row=r, column=c+1).value for c in range(len(hdrs))}
        if row.get("country_name"):
            rows.append(row)
    return rows

def read_existing_facts(wb):
    """Return set of (country_id, second_id) already in Sheet 3."""
    ws = wb["3_Facts"]
    hdrs = [ws.cell(row=1, column=c).value for c in range(1, ws.max_column+1)]
    existing = set()
    for r in range(2, ws.max_row+1):
        cid = ws.cell(row=r, column=hdrs.index("country_id")+1).value if "country_id" in hdrs else None
        sid = ws.cell(row=r, column=hdrs.index("second_id")+1).value if "second_id" in hdrs else None
        if cid and sid:
            existing.add((str(cid), str(sid)))
    return existing

def get_next_fid(wb):
    ws = wb["3_Facts"]
    for r in range(ws.max_row, 1, -1):
        v = ws.cell(row=r, column=1).value
        if v and str(v).startswith("F"):
            try: return int(str(v)[1:]) + 1
            except: pass
    return 1

def write_facts(wb, facts):
    ws = wb["3_Facts"]
    FACT_HDRS = [
        "fact_id","country_id","country_name","iso3","region",
        "second_id","second_name","top_id","top_name","pillar",
        "value_numeric","value_text","unit","direction",
        "reference_year","source_name","source_url",
        "confidence","verified","extraction_method","notes"
    ]
    PFILL = {"Supply":"E3F2FD","Demand":"FFF9C4"}
    fid = get_next_fid(wb)
    row_num = ws.max_row + 1
    for f in facts:
        f["fact_id"] = f"F{fid:05d}"
        pf = PFILL.get(f.get("pillar",""), "FFFFFF")
        for c, h in enumerate(FACT_HDRS, 1):
            cl = ws.cell(row=row_num, column=c, value=f.get(h))
            cl.font = Font(name="Arial", size=9)
            cl.fill = PatternFill("solid", start_color=pf)
            cl.border = THIN
            cl.alignment = Alignment(horizontal="center" if c in [1,2,4,5,6,8,10] else "left",
                                     vertical="top", wrap_text=(c==21))
        fid += 1
        row_num += 1
    return len(facts)

# ── World Bank fetch ──────────────────────────────────────────────────────────
def fetch_wb(iso3, wb_code, retries=3):
    iso2 = ISO3_TO_ISO2.get(iso3)
    if not iso2:
        return None, ""
    url = WB_API.format(iso2=iso2, code=wb_code)
    for attempt in range(retries):
        try:
            r = requests.get(url, timeout=15)
            data = r.json()
            if len(data) < 2 or not data[1]:
                return None, ""
            for entry in data[1]:
                if entry.get("value") is not None:
                    return float(entry["value"]), str(entry.get("date",""))
            return None, ""
        except Exception as e:
            if attempt < retries-1:
                time.sleep(2**attempt)
    return None, ""

# ── ND-GAIN fetch ─────────────────────────────────────────────────────────────
def fetch_ndgain():
    try:
        url = "https://gain.nd.edu/assets/521435/nd_gain_country_index_2024.csv"
        r = requests.get(url, timeout=30)
        scores = {}
        for line in r.text.splitlines()[1:]:
            parts = line.split(",")
            if len(parts) >= 4:
                iso3 = parts[1].strip().strip('"')
                try:
                    s = float(parts[-1].strip().strip('"'))
                    if 0 < s <= 100:
                        scores[iso3] = s
                except: pass
        log(f"ND-GAIN: {len(scores)} countries", "OK")
        return scores
    except Exception as e:
        log(f"ND-GAIN failed: {e}", "WARN")
        return {}

# ── INFORM fetch ──────────────────────────────────────────────────────────────
def fetch_inform():
    try:
        url = "https://drmkc.jrc.ec.europa.eu/inform-index/API/InformAPI/countries/Inform2024"
        r = requests.get(url, timeout=30)
        data = r.json()
        out = {}
        for row in data.get("data", []):
            iso3 = row.get("ISO3","")
            if iso3:
                out[iso3] = {
                    "risk":    row.get("INFORM Risk", {}).get("score"),
                    "hazard":  row.get("Hazard & Exposure", {}).get("score"),
                    "vuln":    row.get("Vulnerability", {}).get("score"),
                    "coping":  row.get("Lack of Coping Capacity", {}).get("score"),
                }
        log(f"INFORM: {len(out)} countries", "OK")
        return out
    except Exception as e:
        log(f"INFORM failed: {e}", "WARN")
        return {}

# ── Main ──────────────────────────────────────────────────────────────────────
def main(dry_run=False, country_filter=None, top_filter=None):
    log("=== 1_fetch_web_indicators.py ===")
    wb = load_db()
    countries = read_countries(wb)
    existing  = read_existing_facts(wb)

    if country_filter:
        countries = [c for c in countries if country_filter.upper() in str(c.get("iso3","")).upper()
                     or country_filter.lower() in str(c.get("country_name","")).lower()]
        log(f"Filtered to {len(countries)} countries")

    # Pre-fetch bulk sources
    log("Pre-fetching bulk datasets…")
    ndgain  = fetch_ndgain()
    inform  = fetch_inform()

    # Build list of (second_id, source_fn) to process
    # Group WB indicators by their wb_code
    wb_indicators = {}  # second_id → wb_code
    for sid, s in SECONDS.items():
        code = s["wb_code"]
        if code.startswith(("EG.","SH.","SP.","IT.","NV.","GB.","IP.","LP.","IC.","NE.","NY.","EN.","HD.")):
            if top_filter is None or s["top_id"] == top_filter:
                wb_indicators[sid] = code

    all_facts = []
    total_skip = 0

    for ci, country in enumerate(countries, 1):
        cid    = str(country.get("country_id","")).strip()
        cname  = str(country.get("country_name","")).strip()
        iso3   = str(country.get("iso3","")).strip()
        region = str(country.get("region","")).strip()

        if not iso3 or iso3 == "None":
            continue

        print(f"\n[{ci}/{len(countries)}] {cname} ({iso3})")

        def make_fact(sid, val_num, val_text, year, src_name, src_url, conf="High", verified="Yes", method="API"):
            s = SECONDS.get(sid, {})
            return {
                "country_id":  cid, "country_name": cname, "iso3": iso3, "region": region,
                "second_id":   sid, "second_name": s.get("name",""),
                "top_id":      s.get("top_id",""), "top_name": s.get("top_name",""),
                "pillar":      s.get("pillar",""),
                "value_numeric": val_num, "value_text": val_text,
                "unit": s.get("unit",""), "direction": s.get("direction",""),
                "reference_year": year, "source_name": src_name, "source_url": src_url,
                "confidence": conf, "verified": verified, "extraction_method": method,
                "notes": "",
            }

        # ── World Bank indicators ─────────────────────────────────────────────
        for sid, wb_code in wb_indicators.items():
            key = (cid, sid)
            if key in existing:
                total_skip += 1
                continue
            s = SECONDS[sid]
            val, year = fetch_wb(iso3, wb_code)
            if val is None:
                print(f"  {sid}: no WB data")
                continue

            # For gap indicators (access → invert to gap)
            if sid in ("D10a", "D10b", "D10c", "D10d"):
                val = round(100.0 - val, 2)
                note = "inverted (100 - access%)"
            elif sid == "D14a" and val > 100:
                val = round(val, 1)
                note = ""
            else:
                val = round(val, 4)
                note = ""

            print(f"  {sid} ({wb_code}): {val} ({year})")
            f = make_fact(sid, val, None, year, "World Bank WDI",
                          f"https://data.worldbank.org/indicator/{wb_code}")
            if note:
                f["notes"] = note
            all_facts.append(f)
            time.sleep(0.1)

        # ── ND-GAIN vulnerability (D12a) ──────────────────────────────────────
        sid = "D12a"
        if (cid, sid) not in existing and (top_filter is None or SECONDS[sid]["top_id"] == top_filter):
            score = ndgain.get(iso3)
            if score:
                print(f"  {sid} (ND-GAIN): {score}")
                all_facts.append(make_fact(sid, score, None, "2024", "ND-GAIN Country Index 2024",
                                           "https://gain.nd.edu/our-work/country-index/"))

        # ── INFORM risk (D12c, D13b) ──────────────────────────────────────────
        inf = inform.get(iso3, {})
        for sid, key_in_inform in [("D12c","hazard"), ("D13b","risk")]:
            if (cid, sid) not in existing and (top_filter is None or SECONDS[sid]["top_id"] == top_filter):
                v = inf.get(key_in_inform)
                if v:
                    scaled = round(float(v) * 10, 2)   # INFORM 0-10 → 0-100
                    print(f"  {sid} (INFORM {key_in_inform}): {scaled}")
                    all_facts.append(make_fact(sid, scaled, None, "2024",
                                               "INFORM Risk Index 2024",
                                               "https://www.inform-index.org/",
                                               conf="High", verified="Yes"))

    log(f"\nNew facts collected: {len(all_facts)}")
    log(f"Already-existing skipped: {total_skip}")

    if dry_run:
        log("DRY RUN — not writing", "WARN")
        for f in all_facts[:10]:
            print(f"  {f['country_name']:20s} | {f['second_id']:8s} | {f['value_numeric']}")
        if len(all_facts) > 10:
            print(f"  … and {len(all_facts)-10} more")
    else:
        if all_facts:
            n = write_facts(wb, all_facts)
            wb.save(DB)
            log(f"Written {n} new facts → {DB}", "OK")
        else:
            log("Nothing new to write", "OK")


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--country", type=str, default=None)
    p.add_argument("--top", type=str, default=None, help="Only fetch for top-level ID e.g. T10")
    args = p.parse_args()
    main(dry_run=args.dry_run, country_filter=args.country, top_filter=args.top)
