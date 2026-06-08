import React from 'react';

export default function Header({ countries }) {
  const scored      = countries.filter(c => c.gap_score != null);
  const severeCount = scored.filter(c => c.gap_tier === 'Severe').length;
  const constrained = scored.filter(c => c.gap_tier === 'Constrained').length;

  return (
    <header style={styles.header}>
      <div style={styles.logo}>
        <div style={styles.logoMark}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="5.5" stroke="white" strokeWidth="1.4"/>
            <path d="M4.5 7h5M7 4.5v5" stroke="white" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
        </div>
        <div>
          <div style={styles.title}>CEC Engineering Capacity</div>
          <div style={styles.sub}>Commonwealth Engineers' Council · Aston University · LRF · 2025</div>
        </div>
      </div>
      <div style={styles.pills}>
        <Pill><b style={{color:'var(--sv)'}}>{severeCount}</b> severe</Pill>
        <Pill><b style={{color:'var(--co)'}}>{constrained}</b> constrained</Pill>
        <Pill><b>{countries.length}</b> countries</Pill>
        <Pill><b>56</b> indicators</Pill>
      </div>
    </header>
  );
}

function Pill({ children }) {
  return <div style={styles.pill}>{children}</div>;
}

const styles = {
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 20px', height: 50, flexShrink: 0,
    background: 'var(--sf)', borderBottom: '1px solid var(--bd)', zIndex: 100,
  },
  logo: { display: 'flex', alignItems: 'center', gap: 10 },
  logoMark: {
    width: 26, height: 26, background: 'var(--ac)', borderRadius: 5,
    display: 'grid', placeItems: 'center', flexShrink: 0,
  },
  title: { fontFamily: "'Fraunces', serif", fontSize: 14, fontWeight: 600, color: 'var(--tx)' },
  sub:   { fontSize: 9, color: 'var(--tx3)', letterSpacing: '.08em', textTransform: 'uppercase', marginTop: 1 },
  pills: { display: 'flex', gap: 6 },
  pill:  {
    background: 'var(--sf2)', border: '1px solid var(--bd)', borderRadius: 20,
    padding: '3px 10px', fontSize: 10, color: 'var(--tx2)', whiteSpace: 'nowrap',
  },
};