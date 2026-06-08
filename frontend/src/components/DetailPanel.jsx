import { useState, useEffect } from "react";
import { fetchCountry } from "../useApi";

const fmt1 = (v) => (v != null ? (+v).toFixed(1) : "—");
const fmtV = (v) => {
  if (v == null) return "—";
  const n = +v;
  return Number.isInteger(n) ? n.toLocaleString() : n.toFixed(2);
};

const CEC_SLUG = {
  Australia:"australia",Bangladesh:"bangladesh",Belize:"belize",Botswana:"botswana",
  Canada:"canada",Cyprus:"cyprus",Fiji:"fiji",Ghana:"ghana",Guyana:"guyana",
  India:"india",Jamaica:"jamaica",Kenya:"kenya",Malaysia:"malaysia",Malta:"malta",
  Mauritius:"mauritius",Mozambique:"mozambique",Namibia:"namibia","New Zealand":"new-zealand",
  Nigeria:"nigeria",Pakistan:"pakistan","Papua New Guinea":"papua-new-guinea",Rwanda:"rwanda",
  "Sierra Leone":"sierra-leone",Singapore:"singapore","Solomon Islands":"solomon-islands",
  "South Africa":"south-africa","Sri Lanka":"sri-lanka",Tanzania:"tanzania",Togo:"togo",
  "Trinidad & Tobago":"trinidad-tobago",Uganda:"uganda","United Kingdom":"united-kingdom",
  Vanuatu:"vanuatu",Zambia:"zambia",
};

function govChip(val, label) {
  if (!val || val === "—") return <span className="gov-chip gov-unknown">{label}: Unknown</span>;
  const v = String(val).toLowerCase();
  if (["yes","true","member","mandatory","signatory"].includes(v))
    return <span className="gov-chip gov-yes">{label}: {val}</span>;
  if (["no","false","non-signatory","none"].includes(v))
    return <span className="gov-chip gov-no">{label}: {val}</span>;
  return <span className="gov-chip gov-partial">{label}: {val}</span>;
}

// ── Overview tab ─────────────────────────────────────────────────────────────
function OverviewPane({ country, tops, facts, onRawTab }) {
  const topScores = (tops || [])
    .map((t) => {
      const key = (typeof t.top_id === "string" && t.top_id.startsWith("T"))
        ? t.top_id
        : `T${String(+t.top_id).padStart(2, "0")}`;
      return { ...t, score: country.tops?.[key] ?? null };
    })
    .filter((t) => t.score != null)
    .sort((a, b) => b.score - a.score);


  return (
    <div className="dy">
      {["Supply", "Demand"].map((pillar) => {
        const pts = topScores.filter((t) => t.pillar === pillar);
        if (!pts.length) return null;
        const pc = pillar === "Supply" ? "var(--sup)" : "var(--dem)";
        return (
          <div key={pillar}>
            <div className="sc" style={{ color: pc }}>{pillar} indicators</div>
            {pts.map((t) => (
              <div key={t.top_id} className="ir">
                <div className="iln" title={t.top_name}>{t.top_id} · {t.top_name}</div>
                <div className="ibw">
                  <div className="ib" style={{ width: Math.min(100, t.score) + "%", background: pc }} />
                </div>
                <div className="iv">{fmt1(t.score)}</div>
              </div>
            ))}
          </div>
        );
      })}

      {!topScores.length && (
        <div style={{ color: "var(--tx3)", fontSize: 11 }}>No indicator scores available yet.</div>
      )}

      {/* Key data points */}
      {(facts || []).length > 0 && ["Supply", "Demand"].map((pillar) => {
        const pf = (facts || []).filter((f) => f.pillar === pillar).slice(0, 6);
        if (!pf.length) return null;
        const pc = pillar === "Supply" ? "var(--sup)" : "var(--dem)";
        return (
          <div key={pillar + "_facts"}>
            <div className="sc" style={{ color: pc, marginTop: 14 }}>Key {pillar.toLowerCase()} data</div>
            {pf.map((f, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "4px 0", borderBottom: "1px solid rgba(48,54,61,.4)" }}>
                <div style={{ fontSize: 10, color: "var(--tx2)", flex: 1, paddingRight: 8, lineHeight: 1.4 }}>{f.sname}</div>
                <div style={{ fontSize: 10, color: "var(--tx)", flexShrink: 0, textAlign: "right" }}>
                  {f.vn != null ? fmtV(f.vn) : (f.vt || "—")}
                  <div style={{ fontSize: 8, color: "var(--tx3)" }}>{(f.unit || "").slice(0, 20)}</div>
                </div>
              </div>
            ))}
            {(facts || []).filter((f) => f.pillar === pillar).length > 6 && (
              <div style={{ fontSize: 10, color: "var(--ac)", cursor: "pointer", marginTop: 6 }} onClick={onRawTab}>
                View all data →
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Profile tab ───────────────────────────────────────────────────────────────
function ProfilePane({ country, facts }) {
  // Build profile from qualitative facts
  const getFact = (sid) => (facts || []).find((f) => f.sid === sid);
  const getText = (sid) => getFact(sid)?.vt || null;

  const takeaway = getText("NARR1");
  const sectors  = getText("NARR2");
  const climate  = getText("DEM_CLI");
  const wa       = getText("GOV_WA");
  const cpd      = getText("GOV_CPD");
  const legal    = getText("GOV_LAW");
  const slug     = CEC_SLUG[country.country_name];

  return (
    <div className="dy">
      <div className="narr-card">
        <div className="narr-label">Key assessment</div>
        <div className={"narr-text" + (!takeaway ? " empty" : "")}>
          {takeaway || "No narrative data available yet for this country."}
        </div>
      </div>

      {sectors && (
        <div className="narr-card">
          <div className="narr-label">Priority infrastructure sectors</div>
          <div className="narr-text">{sectors}</div>
        </div>
      )}

      {climate && (
        <div className="narr-card">
          <div className="narr-label">Climate & environmental priorities</div>
          <div className="narr-text">{climate}</div>
        </div>
      )}

      {(wa || cpd || legal) && (
        <div className="narr-card">
          <div className="narr-label">Professional governance</div>
          <div style={{ marginBottom: 7 }}>
            {govChip(wa, "Washington Accord")}
            {govChip(cpd, "CPD")}
          </div>
          {legal && (
            <>
              <div className="narr-label" style={{ marginTop: 6 }}>Legal basis</div>
              <div className="narr-text">{legal}</div>
            </>
          )}
        </div>
      )}

      <div style={{ fontSize: 9, color: "var(--tx3)", lineHeight: 1.6, padding: "4px 0 8px" }}>
        ℹ Text indicators shown here are for contextual reference only and are not included in gap scoring or country comparisons.
      </div>

      <div className="cec-links">
        <div className="narr-label" style={{ marginBottom: 7 }}>CEC resources</div>
        {slug && (
          <a className="cec-link" href="https://www.commonwealthengineers.org/country-profiles.html" target="_blank" rel="noreferrer">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M6 1a5 5 0 100 10A5 5 0 006 1zM1.5 6h9M6 1c-1.2 1.4-2 3.1-2 5s.8 3.6 2 5M6 1c1.2 1.4 2 3.1 2 5s-.8 3.6-2 5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
            </svg>
            Country profile: {country.country_name}
          </a>
        )}
        <a className="cec-link" href="https://www.commonwealthengineers.org/membership-and-licensure-bodies.html" target="_blank" rel="noreferrer">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M6 1a5 5 0 100 10A5 5 0 006 1zM1.5 6h9M6 1c-1.2 1.4-2 3.1-2 5s.8 3.6-2 5M6 1c1.2 1.4 2 3.1 2 5s-.8 3.6-2 5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
          </svg>
          Membership &amp; licensure bodies
        </a>
      </div>

      <div className="weighting-box">
        <b>On weighting</b> — Current approach assigns each indicator equal weight within its topic area.
        Exploring a <b>Weak / Medium / Strong</b> scoring scheme (0 / 0.5 / 1) that sums and normalises within each category.
        This will be discussed at the steering group.
      </div>
    </div>
  );
}

// ── Raw data tab ──────────────────────────────────────────────────────────────
function RawPane({ tops, facts }) {
  const [selTop, setSelTop]   = useState("All");
  const [search, setSearch]   = useState("");
  const [showFull, setShowFull] = useState(null); // { label, value }


  let rows = facts || [];
  if (selTop !== "All") {
    const selTopStr = String(selTop);
    rows = rows.filter((f) => String(f.tid) === selTopStr);
  }

  if (search.trim()) {
    const q = search.toLowerCase();
    rows = rows.filter((f) => {
      const sname = (f.sname ?? "").toString().toLowerCase();
      const tname = (f.tname ?? "").toString().toLowerCase();
      return sname.includes(q) || tname.includes(q);
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      {showFull && (
        <div className="raw-modal-overlay" onClick={() => setShowFull(null)}>
          <div
            className="raw-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="raw-modal-head">
              <div className="raw-modal-title">{showFull.label}</div>
              <button className="raw-modal-close" type="button" onClick={() => setShowFull(null)}>
                ×
              </button>
            </div>
            <div className="raw-modal-body">{showFull.value || "—"}</div>
          </div>
        </div>
      )}

      <div className="raw-filters">
        <input
          className="raw-search" placeholder="Search indicators…"
          value={search} onChange={(e) => setSearch(e.target.value)}
        />
        <div className="raw-btns">
          <button className={"rbtn" + (selTop === "All" ? " on" : "")} onClick={() => setSelTop("All")}>All</button>
          {(tops || []).map((t) => (
            <button key={t.top_id} className={"rbtn" + (selTop === t.top_id ? " on" : "")}
              title={t.top_name} onClick={() => setSelTop(t.top_id)}>
              {t.top_id}
            </button>
          ))}
        </div>
      </div>
      <div className="raw-tbl-wrap">
        <table className="dtbl">
          <thead>
            <tr>
              <th>Indicator</th><th>Value</th><th>Year</th><th>Conf</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={4} style={{ color: "var(--tx3)", textAlign: "center", padding: 20 }}>No data</td></tr>
            ) : rows.map((f, i) => (
              <tr
                key={i}
                className="raw-row"
                onClick={() => setShowFull({ label: "Raw data", value: `${f.sname}\n${f.tid} · ${f.pillar}\n${f.unit || ""}\nValue: ${f.vn != null ? fmtV(f.vn) : (f.vt || "—") }\nYear: ${f.year || "—"}\nConf: ${f.conf || "—"}` })}
                title="Click to view full record"
              >
                <td>
                  <div style={{ color: "var(--tx)", marginBottom: 1 }}>{f.sname}</div>
                  <div style={{ fontSize: 9, color: "var(--tx3)" }}>{f.tid} · {f.pillar}</div>
                  <div style={{ fontSize: 9, color: "var(--tx3)" }}>{(f.unit || "").slice(0, 28)}</div>
                </td>
                <td style={{ color: "var(--tx)", whiteSpace: "nowrap" }}>
                  {f.vn != null ? fmtV(f.vn) : (f.vt || "—")}
                </td>
                <td style={{ color: "var(--tx3)" }}>{f.year || "—"}</td>
                <td>
                  <span className={"conf conf-" + ((f.conf || "?")[0])}>{(f.conf || "?")[0]}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="raw-count">{rows.length} data point{rows.length !== 1 ? "s" : ""} shown</div>
    </div>
  );
}

// ── Main detail panel ─────────────────────────────────────────────────────────
export default function DetailPanel({ country, tops, onClose }) {
  const [tab, setTab]     = useState("ov");
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!country?.iso3) return;
    setLoading(true);
    fetchCountry(country.iso3)
      .then((d) => {
        // Merge tops from map data into the fetched detail
        setDetail({ ...d.country, tops: country.tops, facts: d.facts });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [country?.iso3]);

  if (!country) return null;

  const TC = { Severe: "#e8453c", Constrained: "#e8a020", "Low Need": "#3fb950", Benchmark: "#388bfd" };
  const TDim = {
    Severe: "rgba(232,69,60,.13)", Constrained: "rgba(232,160,32,.13)",
    "Low Need": "rgba(63,185,80,.13)", Benchmark: "rgba(56,139,253,.13)",
  };
  const col = TC[country.tier] || "#484f58";

  return (
    <div className="det open">
      <div className="dh">
        <button className="dc" onClick={onClose}>×</button>
        <div className="dn">{country.name}</div>
        <div className="dr">{country.region || ""}</div>
        <div className="db" style={{
          background: TDim[country.tier] || "rgba(72,79,88,.15)",
          color: col, border: `1px solid ${col}44`,
        }}>
          {country.tier || "No data"}
        </div>
      </div>

      <div className="strio">
        {[
          { label: "Gap",    val: country.gap,    color: "var(--ac)" },
          { label: "Demand", val: country.demand,  color: "var(--dem)" },
          { label: "Supply", val: country.supply,  color: "var(--sup)" },
        ].map((s) => (
          <div key={s.label} className="stc">
            <div className="stv" style={{ color: s.color }}>{fmt1(s.val)}</div>
            <div className="stl">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="tabs">
        {[["ov","Overview"],["pro","Profile"],["raw","Raw data"]].map(([id, label]) => (
          <button key={id} className={"tab" + (tab === id ? " on" : "")}
            onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: 20, color: "var(--tx3)", fontSize: 11 }}>Loading…</div>
      ) : (
        <>
          {tab === "ov"  && <OverviewPane country={detail || country} tops={tops} facts={detail?.facts} onRawTab={() => setTab("raw")} />}
          {tab === "pro" && <ProfilePane  country={detail || country} facts={detail?.facts} />}
          {tab === "raw" && <RawPane tops={tops} facts={detail?.facts} />}
        </>
      )}
    </div>
  );
}