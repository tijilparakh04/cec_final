import React from 'react';
import { useParams } from 'react-router-dom';
import { useAdminApi } from '../state/adminApi.js';

const COUNTRY_FIELDS = [
  'country_name',
  'region',
  'subregion',
  'latitude',
  'longitude',
  'population',
  'gdp_per_capita_usd',
  'world_bank_income_class',
  'hdi_score',
  'data_status',
  'notes',
];

export default function CountryEditPage() {
  const api = useAdminApi();
  const { iso3 } = useParams();

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState(null);
  const [country, setCountry] = React.useState(null);
  const [facts, setFacts] = React.useState([]);
  const [msg, setMsg] = React.useState(null);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setErr(null);
      setMsg(null);
      try {
        const res = await api.get(`/api/admin/country/${encodeURIComponent(iso3)}/edit`);
        if (!mounted) return;
        setCountry(res.country);
        setFacts(res.facts || []);
      } catch (e2) {
        if (!mounted) return;
        setErr(e2.message || 'Failed to load');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [api, iso3]);

  function updateCountryField(k, v) {
    setCountry((prev) => ({ ...prev, [k]: v }));
  }

  function updateFact(idx, patch) {
    setFacts((prev) => prev.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  }

  async function saveCountry() {
    if (!country) return;
    setSaving(true);
    setErr(null);
    setMsg(null);
    try {
      const payload = {};
      for (const f of COUNTRY_FIELDS) payload[f] = country[f];
      await api.put(`/api/admin/country/${encodeURIComponent(iso3)}`, { country: payload });
      setMsg('Country updated');
    } catch (e2) {
      setErr(e2.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function saveFacts() {
    setSaving(true);
    setErr(null);
    setMsg(null);
    try {
      await api.put(`/api/admin/facts`, { iso3: iso3, facts });
      setMsg('Facts updated');
    } catch (e2) {
      setErr(e2.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div style={{ color: 'var(--tx2)' }}>Loading…</div>;
  if (err) return <div style={{ color: '#e8453c' }}>{err}</div>;
  if (!country) return <div style={{ color: 'var(--tx3)' }}>No data</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <div style={{ fontFamily: 'Fraunces, serif', fontSize: 16, fontWeight: 700 }}>
          Edit {country.country_name} ({country.iso3})
        </div>
        {msg ? <div style={{ fontSize: 12, color: 'var(--ln)' }}>{msg}</div> : null}
      </div>

      <div style={{ background: 'var(--sf)', border: '1px solid var(--bd)', borderRadius: 10, padding: 12 }}>
        <div style={{ fontSize: 10, color: 'var(--tx3)', letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 10 }}>
          Country fields
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {COUNTRY_FIELDS.map((f) => (
            <label key={f} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 10, color: 'var(--tx2)' }}>{f}</span>
              <input
                value={country[f] ?? ''}
                onChange={(e) => updateCountryField(f, e.target.value)}
                style={{ background: 'var(--sf2)', border: '1px solid var(--bd)', borderRadius: 6, padding: '10px 10px', color: 'var(--tx)' }}
              />
            </label>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
          <button
            onClick={saveCountry}
            disabled={saving}
            style={{
              border: '1px solid var(--ac)',
              background: 'rgba(210,166,121,.12)',
              color: 'var(--ac)',
              padding: '10px 12px',
              borderRadius: 6,
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontWeight: 800,
            }}
          >
            {saving ? 'Saving…' : 'Save country'}
          </button>
        </div>
      </div>

      <div style={{ background: 'var(--sf)', border: '1px solid var(--bd)', borderRadius: 10, padding: 12, overflow: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: 'var(--tx3)', letterSpacing: '.12em', textTransform: 'uppercase' }}>Facts</div>
          <button
            onClick={saveFacts}
            disabled={saving}
            style={{
              border: '1px solid var(--ac)',
              background: 'rgba(210,166,121,.12)',
              color: 'var(--ac)',
              padding: '8px 10px',
              borderRadius: 6,
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontWeight: 800,
              fontSize: 12,
            }}
          >
            {saving ? 'Saving…' : 'Save facts'}
          </button>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: 'var(--sf2)', color: 'var(--tx3)' }}>
              <th style={{ textAlign: 'left', padding: '10px 10px', borderBottom: '1px solid var(--bd)' }}>pillar</th>
              <th style={{ textAlign: 'left', padding: '10px 10px', borderBottom: '1px solid var(--bd)' }}>top/second</th>
              <th style={{ textAlign: 'left', padding: '10px 10px', borderBottom: '1px solid var(--bd)' }}>value_numeric</th>
              <th style={{ textAlign: 'left', padding: '10px 10px', borderBottom: '1px solid var(--bd)' }}>value_text</th>
              <th style={{ textAlign: 'left', padding: '10px 10px', borderBottom: '1px solid var(--bd)' }}>confidence</th>
              <th style={{ textAlign: 'left', padding: '10px 10px', borderBottom: '1px solid var(--bd)' }}>notes</th>
            </tr>
          </thead>
          <tbody>
            {facts.map((f, idx) => (
              <tr key={f.fact_key || `${f.sid}-${f.tid}-${f.sname}`}> 
                <td style={{ padding: '8px 10px', borderBottom: '1px solid rgba(48,54,61,.4)', color: 'var(--tx2)' }}>{f.pillar}</td>
                <td style={{ padding: '8px 10px', borderBottom: '1px solid rgba(48,54,61,.4)', color: 'var(--tx)' }}>
                  {f.tname} / {f.sname}
                </td>
                <td style={{ padding: '8px 10px', borderBottom: '1px solid rgba(48,54,61,.4)' }}>
                  <input
                    value={f.vn ?? ''}
                    onChange={(e) => updateFact(idx, { vn: e.target.value })}
                    style={{ width: '140px', background: 'var(--sf2)', border: '1px solid var(--bd)', borderRadius: 6, padding: '8px 8px', color: 'var(--tx)' }}
                  />
                </td>
                <td style={{ padding: '8px 10px', borderBottom: '1px solid rgba(48,54,61,.4)' }}>
                  <input
                    value={f.vt ?? ''}
                    onChange={(e) => updateFact(idx, { vt: e.target.value })}
                    style={{ width: '160px', background: 'var(--sf2)', border: '1px solid var(--bd)', borderRadius: 6, padding: '8px 8px', color: 'var(--tx)' }}
                  />
                </td>
                <td style={{ padding: '8px 10px', borderBottom: '1px solid rgba(48,54,61,.4)' }}>
                  <input
                    value={f.conf ?? ''}
                    onChange={(e) => updateFact(idx, { conf: e.target.value })}
                    style={{ width: '110px', background: 'var(--sf2)', border: '1px solid var(--bd)', borderRadius: 6, padding: '8px 8px', color: 'var(--tx)' }}
                  />
                </td>
                <td style={{ padding: '8px 10px', borderBottom: '1px solid rgba(48,54,61,.4)' }}>
                  <input
                    value={f.notes ?? ''}
                    onChange={(e) => updateFact(idx, { notes: e.target.value })}
                    style={{ width: '220px', background: 'var(--sf2)', border: '1px solid var(--bd)', borderRadius: 6, padding: '8px 8px', color: 'var(--tx)' }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

