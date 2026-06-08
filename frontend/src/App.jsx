import { useState } from "react";
import { useBootstrap } from "./useApi";
import Map         from "./components/Map";
import Sidebar     from "./components/Sidebar";
import DetailPanel from "./components/DetailPanel";

export default function App() {
  const { data, loading, error } = useBootstrap();
  const [filt,    setFilt]    = useState("All");
  const [selTop,  setSelTop]  = useState(null);
  const [selName, setSelName] = useState(null);

  const countries = data?.countries || [];
  const tops      = data?.tops      || [];
  const stats     = data?.stats     || {};

  const selCountry = countries.find((c) => c.name === selName) || null;

  function handlePick(name) {
    setSelName((prev) => (prev === name ? null : name));
  }
  function handleClose() { setSelName(null); }

  if (loading) return (
    <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--tx3)", fontFamily: "DM Mono, monospace", fontSize: 12 }}>
      Loading CEC data…
    </div>
  );

  if (error) return (
    <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--sv)", fontFamily: "DM Mono, monospace", fontSize: 12, padding: 40, textAlign: "center" }}>
      Could not connect to API.<br />
      Make sure the backend is running on port 3001.<br /><br />
      <code style={{ color: "var(--tx3)" }}>{error.message}</code>
    </div>
  );

  const scored = countries.filter((c) => c.gap != null);

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <header>
        <div className="logo">
          <div className="lm">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="5.5" stroke="white" strokeWidth="1.4"/>
              <path d="M4.5 7h5M7 4.5v5" stroke="white" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <div className="lt">CEC Engineering Capacity</div>
            <div className="ls">Commonwealth Engineers' Council · Aston University · LRF · 2025</div>
          </div>
        </div>
        <div className="hp">
          <div className="pill">
            <b style={{ color: "var(--sv)" }}>{stats.severe || 0}</b> severe
          </div>
          <div className="pill">
            <b style={{ color: "var(--co)" }}>{stats.constrained || 0}</b> constrained
          </div>
          <div className="pill">
            <b>{stats.total_countries || countries.length}</b> countries
          </div>
          <div className="pill">
            <b>{stats.total_indicators || 0}</b> indicators
          </div>
        </div>
      </header>

      {/* App body */}
      <div className="app" style={{ flex: 1, minHeight: 0 }}>
        <Sidebar
          countries={countries}
          tops={tops}
          filt={filt}   setFilt={setFilt}
          selTop={selTop} setSelTop={setSelTop}
          selName={selName} onPick={handlePick}
        />

        {/* Map */}
        <div className="mw" id="mw">
          <Map
            countries={countries}
            selTop={selTop}
            filt={filt}
            selName={selName}
            onPick={handlePick}
          />

          {/* Tooltip */}
          <div id="tt">
            <div className="tn" id="tt-n" />
            <div className="tt2" id="tt-t" />
            <div className="tr"><span>Gap score</span><span className="tv" id="tt-g"/></div>
            <div className="tr"><span>Supply</span><span className="tv" id="tt-s"/></div>
            <div className="tr"><span>Demand</span><span className="tv" id="tt-d"/></div>
          </div>

          {/* Legend */}
          <div className="leg">
            <div className="lgt">Engineering gap tier</div>
            {[
              ["#e8453c", "Severe (≥45)"],
              ["#e8a020", "Constrained (25–44)"],
              ["#3fb950", "Low need (12–24)"],
              ["#388bfd", "Benchmark (<12)"],
              ["#151a22", "No data", "1px solid #30363d"],
            ].map(([bg, label, border]) => (
              <div key={label} className="lgr">
                <div className="lgd" style={{ background: bg, border: border || "none" }} />
                {label}
              </div>
            ))}
          </div>
        </div>

        {/* Detail panel */}
        {selCountry && (
          <DetailPanel country={selCountry} tops={tops} onClose={handleClose} />
        )}
      </div>
    </div>
  );
}