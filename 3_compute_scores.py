"""
3_compute_scores.py
────────────────────────────────────────────────────────────────────
Reads Sheet 3 (Facts) and computes:

  1. Normalise each second-level indicator 0-100 across all countries
  2. Top-level score = weighted average of available seconds
     (weight: Strong=3, Intermediate=2, Weak=1)
  3. Supply score = simple average of T01-T09 top scores
  4. Demand score = simple average of T10-T16 top scores
  5. Gap score = (demand_score + (100-supply_score)) / 2
     → 0 = perfect supply, zero demand  (benchmark)
     → 100 = zero supply, max demand    (severe)

Writes:
  Sheet 4: Top_Scores    — one row per country, one col per top indicator
  Sheet 5: Pillar_Scores — one row per country: supply, demand, gap, tier

Tier thresholds (same as v1):
  ≥ 65 → Severe
  40-64 → Constrained
  20-39 → Low Need
  <  20 → Benchmark

Usage:
    python 3_compute_scores.py
    python 3_compute_scores.py --show-working
"""
import argparse
from pathlib import Path
from collections import defaultdict
from openpyxl import load_workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from indicator_schema import SECONDS, TOPS, WEIGHT

DB = Path("CEC_Engineering_Database_v2_unchanges.xlsx")

THIN = Border(left=Side(style="thin",color="CCCCCC"),right=Side(style="thin",color="CCCCCC"),
              top=Side(style="thin",color="CCCCCC"),bottom=Side(style="thin",color="CCCCCC"))

TIERS = [(65,"Severe","F8D7DA"),(40,"Constrained","FFF3CD"),(20,"Low Need","D1ECF1"),(0,"Benchmark","D4EDDA")]

def get_tier(score):
    for thresh, label, color in TIERS:
        if score >= thresh:
            return label, color
    return "Benchmark", "D4EDDA"

def norm(v, mn, mx):
    if mx == mn: return 50.0
    return (v - mn) / (mx - mn) * 100.0

def hdr(ws, row, col, text, fill="1D3557", fc="FFFFFF"):
    c = ws.cell(row=row, column=col, value=text)
    c.font = Font(name="Arial", bold=True, size=9, color=fc)
    c.fill = PatternFill("solid", start_color=fill)
    c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    c.border = THIN

def cell(ws, row, col, val, fill=None, fmt=None):
    c = ws.cell(row=row, column=col, value=val)
    c.font = Font(name="Arial", size=9)
    c.alignment = Alignment(horizontal="center" if isinstance(val,(int,float)) else "left",
                            vertical="top")
    if fill: c.fill = PatternFill("solid", start_color=fill)
    if fmt:  c.number_format = fmt
    c.border = THIN
    return c

def main(show_working=False):
    print("=== 3_compute_scores.py ===")
    wb = load_workbook(DB)

    # ── Read facts ─────────────────────────────────────────────────────────────
    ws3 = wb["3_Facts"]
    hdrs = [ws3.cell(row=1,column=c).value for c in range(1,ws3.max_column+1)]

    # raw_values[country_id][second_id] = float
    raw = defaultdict(dict)
    country_meta = {}

    for r in range(2, ws3.max_row+1):
        row = {hdrs[c]: ws3.cell(row=r,column=c+1).value for c in range(len(hdrs))}
        cid   = str(row.get("country_id","") or "")
        sid   = str(row.get("second_id","") or "")
        vn    = row.get("value_numeric")
        cname = str(row.get("country_name","") or "")
        iso3  = str(row.get("iso3","") or "")
        reg   = str(row.get("region","") or "")
        if not cid or not sid or vn is None: continue
        try:
            raw[cid][sid] = float(str(vn).replace("−","-"))
        except: pass
        if cid not in country_meta:
            country_meta[cid] = {"name":cname,"iso3":iso3,"region":reg}

    print(f"Countries with data: {len(raw)}")
    print(f"Total (country,indicator) data points: {sum(len(v) for v in raw.values())}")

    # ── Read countries sheet for complete list ─────────────────────────────────
    ws1 = wb["1_Countries"]
    h1 = [ws1.cell(row=1,column=c).value for c in range(1,ws1.max_column+1)]
    for r in range(2, ws1.max_row+1):
        row = {h1[c]: ws1.cell(row=r,column=c+1).value for c in range(len(h1))}
        cid = str(row.get("country_id","") or "")
        if cid and cid not in country_meta:
            country_meta[cid] = {
                "name": str(row.get("country_name","") or ""),
                "iso3": str(row.get("iso3","") or ""),
                "region": str(row.get("region","") or ""),
            }

    # ── Step 1: min/max per second-level indicator ────────────────────────────
    minmax = {}
    for sid in SECONDS:
        vals = [raw[cid][sid] for cid in raw if sid in raw[cid]]
        if len(vals) >= 2:
            minmax[sid] = (min(vals), max(vals))

    # ── Step 2: normalise, respecting direction ───────────────────────────────
    normed = defaultdict(dict)   # [cid][sid] = 0-100 (higher = worse gap / more need)
    for cid, cdata in raw.items():
        for sid, v in cdata.items():
            if sid not in minmax:
                continue
            mn, mx = minmax[sid]
            s = SECONDS.get(sid, {})
            n = norm(v, mn, mx)
            # "neg" = higher raw is better (more supply / less demand)
            # invert so higher normalised = more gap
            if s.get("direction") == "neg":
                n = 100.0 - n
            normed[cid][sid] = round(n, 2)

    # ── Step 3: top-level scores ──────────────────────────────────────────────
    top_scores = defaultdict(dict)   # [cid][top_id] = 0-100
    top_n      = defaultdict(dict)   # [cid][top_id] = n indicators used

    for cid in normed:
        for top_id, top in TOPS.items():
            weighted_sum = 0.0
            weight_sum   = 0.0
            n_used = 0
            for sid in top["seconds"]:
                if sid not in normed[cid]:
                    continue
                w = SECONDS[sid]["weight"]
                weighted_sum += normed[cid][sid] * w
                weight_sum   += w
                n_used += 1
            if weight_sum > 0:
                top_scores[cid][top_id] = round(weighted_sum / weight_sum, 1)
                top_n[cid][top_id]      = n_used

    # ── Step 4: pillar scores ─────────────────────────────────────────────────
    SUPPLY_TOPS  = [t for t in TOPS if TOPS[t]["pillar"] == "Supply"]
    DEMAND_TOPS  = [t for t in TOPS if TOPS[t]["pillar"] == "Demand"]

    pillar_scores = {}
    for cid in top_scores:
        sd = [top_scores[cid][t] for t in SUPPLY_TOPS if t in top_scores[cid]]
        dd = [top_scores[cid][t] for t in DEMAND_TOPS if t in top_scores[cid]]
        if len(sd) < 2 and len(dd) < 2:
            continue
        supply = round(sum(sd)/len(sd), 1) if sd else None
        demand = round(sum(dd)/len(dd), 1) if dd else None
        if supply is not None and demand is not None:
            # Gap: high demand + low supply = high gap
            gap = round((demand + (100.0 - supply)) / 2.0, 1)
        elif demand is not None:
            gap = demand
        elif supply is not None:
            gap = 100.0 - supply
        else:
            gap = None
        pillar_scores[cid] = {
            "supply": supply, "demand": demand, "gap": gap,
            "n_supply": len(sd), "n_demand": len(dd),
        }

    print(f"Countries with pillar scores: {len(pillar_scores)}")

    # ── Step 5: write Sheet 4 (Top_Scores) ────────────────────────────────────
    if "4_Top_Scores" in wb.sheetnames:
        del wb["4_Top_Scores"]
    ws4 = wb.create_sheet("4_Top_Scores")

    top_ids_sorted = sorted(TOPS.keys())
    T4_HDRS = (["country_id","country_name","iso3","region"] +
               [f"{t}_score" for t in top_ids_sorted] +
               [f"{t}_n_inds" for t in top_ids_sorted])
    for c, h in enumerate(T4_HDRS, 1):
        fill = "B5451B"
        if "_score" in h:
            tid = h.replace("_score","")
            fill = "D1ECF1" if TOPS[tid]["pillar"] == "Supply" else "FFF3CD"
        hdr(ws4, 1, c, h, fill=fill)

    # Sort by gap score descending
    sorted_cids = sorted(pillar_scores, key=lambda c: -(pillar_scores[c]["gap"] or 0))
    all_cids_with_data = sorted(top_scores.keys(), key=lambda c: -(pillar_scores.get(c,{}).get("gap") or 0))

    for r_idx, cid in enumerate(all_cids_with_data, 2):
        meta = country_meta.get(cid, {})
        row_vals = [cid, meta.get("name",""), meta.get("iso3",""), meta.get("region","")]
        row_vals += [top_scores[cid].get(t) for t in top_ids_sorted]
        row_vals += [top_n[cid].get(t,0)    for t in top_ids_sorted]
        psc = pillar_scores.get(cid, {})
        tier_color = get_tier(psc.get("gap") or 0)[1]
        for c, v in enumerate(row_vals, 1):
            cell(ws4, r_idx, c, v, fill=tier_color)

    ws4.freeze_panes = "E2"
    ws4.column_dimensions["A"].width = 8
    ws4.column_dimensions["B"].width = 22
    ws4.column_dimensions["C"].width = 6
    ws4.column_dimensions["D"].width = 14
    for i in range(5, len(T4_HDRS)+1):
        ws4.column_dimensions[get_column_letter(i)].width = 9

    # ── Step 6: write Sheet 5 (Pillar_Scores) ─────────────────────────────────
    if "5_Pillar_Scores" in wb.sheetnames:
        del wb["5_Pillar_Scores"]
    ws5 = wb.create_sheet("5_Pillar_Scores")

    P5_HDRS = (["country_id","country_name","iso3","region",
                "supply_score","demand_score","gap_score","gap_tier",
                "n_supply_tops","n_demand_tops"] +
               [f"{t}_score" for t in top_ids_sorted])
    for c, h in enumerate(P5_HDRS, 1):
        fill = "1D3557"
        if "supply" in h: fill = "2D6A4F"
        if "demand" in h: fill = "B5451B"
        if "gap" in h:    fill = "7B2D8B"
        if h.startswith("T"):
            tid = h.replace("_score","")
            fill = "D1ECF1" if TOPS.get(tid,{}).get("pillar") == "Supply" else "FFF3CD"
        hdr(ws5, 1, c, h, fill=fill)

    for r_idx, cid in enumerate(sorted(country_meta.keys(),
                                       key=lambda c: -(pillar_scores.get(c,{}).get("gap") or -1)), 2):
        meta = country_meta.get(cid, {})
        psc  = pillar_scores.get(cid, {})
        gap  = psc.get("gap")
        tier_label, tier_color = get_tier(gap or 0) if gap is not None else ("No data", "EEEEEE")
        row_vals = [
            cid, meta.get("name",""), meta.get("iso3",""), meta.get("region",""),
            psc.get("supply"), psc.get("demand"), gap, tier_label if gap else "No data",
            psc.get("n_supply",0), psc.get("n_demand",0),
        ] + [top_scores.get(cid,{}).get(t) for t in top_ids_sorted]

        for c, v in enumerate(row_vals, 1):
            cell(ws5, r_idx, c, v, fill=tier_color if gap else "EEEEEE")

    ws5.freeze_panes = "E2"
    for i, w in enumerate([8,22,6,14,12,12,12,14,10,10]+[9]*len(top_ids_sorted), 1):
        ws5.column_dimensions[get_column_letter(i)].width = w

    wb.save(DB)
    print(f"Saved → {DB}")

    # ── Summary ────────────────────────────────────────────────────────────────
    tier_counts = {}
    for cid, ps in pillar_scores.items():
        t = get_tier(ps["gap"] or 0)[0]
        tier_counts[t] = tier_counts.get(t,0) + 1

    print("\n=== PILLAR SCORE SUMMARY ===")
    for tier, _, _ in TIERS:
        label = get_tier(tier)[0]
        n = tier_counts.get(label, 0)
        print(f"  {label:14s}: {n:3d} {'█'*n}")

    if show_working:
        print("\n=== TOP 10 GAP SCORES ===")
        print(f"{'Country':22s} {'Supply':8s} {'Demand':8s} {'Gap':8s} {'Tier'}")
        print("-"*60)
        for cid in sorted(pillar_scores, key=lambda c: -(pillar_scores[c]["gap"] or 0))[:10]:
            ps = pillar_scores[cid]
            name = country_meta.get(cid,{}).get("name",cid)
            print(f"{name:22s} {ps['supply'] or 0:8.1f} {ps['demand'] or 0:8.1f} {ps['gap'] or 0:8.1f} {get_tier(ps['gap'] or 0)[0]}")

        print("\n=== TOP-LEVEL SCORE COVERAGE ===")
        for top_id, top in sorted(TOPS.items()):
            covered = sum(1 for cid in top_scores if top_id in top_scores[cid])
            print(f"  {top_id} {top['name'][:35]:35s}: {covered:3d} countries")


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--show-working", action="store_true")
    args = p.parse_args()
    main(show_working=args.show_working)
