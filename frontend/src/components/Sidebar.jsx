import { useState } from "react";

const TIER_DOT = {
  All: "var(--ac)", Severe: "var(--sv)", Constrained: "var(--co)",
  "Low Need": "var(--ln)", Benchmark: "var(--bm)",
};
const TIERS = ["All", "Severe", "Constrained", "Low Need", "Benchmark"];

const fmt1 = (v) => (v != null ? (+v).toFixed(1) : "—");

export default function Sidebar({ countries, tops, filt, setFilt, selTop, setSelTop, selName, onPick }) {
  const [search, setSearch] = useState("");

  const normSelTop = (v) => {
    if (v == null || v === "") return null;
    // dropdown uses numeric top_id (1..16); country.tops uses T01..T16
    if (typeof v === "string" && v.startsWith("T")) return v;
    const n = +v;
    if (!Number.isFinite(n) || n < 1 || n > 16) return null;
    return `T${String(n).padStart(2, "0")}`;
  };

  const topKey = normSelTop(selTop);

  const getScore = (c) => topKey ? (c.tops?.[topKey] ?? null) : c.gap;


  const tierCount = (t) =>
    t === "All" ? countries.length : countries.filter((c) => c.tier === t).length;

  let list = filt === "All" ? countries : countries.filter((c) => c.tier === filt);
  if (topKey) list = list.filter((c) => c.tops?.[topKey] != null);
  if (search) list = list.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));
  list = [...list].sort((a, b) => (getScore(b) ?? -1) - (getScore(a) ?? -1));

  const indCount = topKey ? countries.filter((c) => c.tops?.[topKey] != null).length : null;


  return (
    <aside>
      {/* Tier filter */}
      <div className="st">
        <div className="fl">Gap tier</div>
        <div className="fbs">
          {TIERS.map((t) => (
            <button
              key={t} className={"fb" + (filt === t ? " on" : "")}
              data-t={t} onClick={() => setFilt(t)}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: TIER_DOT[t], flexShrink: 0 }} />
                {t}
              </span>
              <span className="fc">{tierCount(t)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Indicator select */}
      <div className="ind-wrap">
        <div className="fl">View by indicator</div>
        <select
          className="ind-sel" value={selTop || ""}
          onChange={(e) => setSelTop(e.target.value || null)}
        >
          <option value="">Overall gap score</option>
          {["Supply", "Demand"].map((pillar) => (
            <optgroup key={pillar} label={`── ${pillar} ──`}>
              {(tops || []).filter((t) => t.pillar === pillar).map((t) => (
                <option key={t.top_id} value={t.top_id}>{t.top_id} · {t.top_name}</option>
              ))}
            </optgroup>
          ))}
        </select>
        {selTop && (
          <div id="ind-count" style={{ marginTop: 6, fontSize: 9, color: "var(--tx3)" }}>
            {indCount} countr{indCount !== 1 ? "ies" : "y"} have data for this indicator
          </div>
        )}
      </div>

      {/* Country list */}
      <div className="cl">
        {list.map((c) => {
          const score = getScore(c);
          const col   = { Severe: "var(--sv)", Constrained: "var(--co)", "Low Need": "var(--ln)", Benchmark: "var(--bm)" }[c.tier] || "var(--tx3)";
          const pct   = score != null ? Math.min(100, +score) + "%" : "0%";
          return (
            <div
              key={c.cid}
              className={"ci" + (c.name === selName ? " sel" : "")}
              onClick={() => onPick(c.name)}
            >
              <div className="ct">
                <div className="cn">{c.name}</div>
                <div className="cs" style={{ color: col }}>{score != null ? fmt1(score) : "—"}</div>
              </div>
              {score != null && (
                <div className="cbw">
                  <div className="cb" style={{ width: pct, background: col }} />
                </div>
              )}
              <div className="cr">{c.region || ""}</div>
            </div>
          );
        })}
        {list.length === 0 && (
          <div style={{ padding: 16, color: "var(--tx3)", fontSize: 11, textAlign: "center" }}>
            No countries match this filter
          </div>
        )}
      </div>
    </aside>
  );
}