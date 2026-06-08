import React from 'react';
import { Link } from 'react-router-dom';
import { useAdminApi } from '../state/adminApi.js';

export default function CountriesPage() {
  const api = useAdminApi();

  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState(null);
  const [countries, setCountries] = React.useState([]);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await api.get('/api/admin/countries');
        if (!mounted) return;
        setCountries(res.countries || []);
      } catch (e2) {
        if (!mounted) return;
        setErr(e2.message || 'Failed');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [api]);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontFamily: 'Fraunces, serif', fontSize: 16, fontWeight: 700 }}>Countries</div>
        <div style={{ fontSize: 10, color: 'var(--tx3)', letterSpacing: '.12em', textTransform: 'uppercase' }}>Editable scope</div>
      </div>

      {loading ? <div style={{ color: 'var(--tx2)' }}>Loading…</div> : null}
      {err ? <div style={{ color: '#e8453c' }}>{err}</div> : null}

      {!loading && !err ? (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: 'var(--sf2)', color: 'var(--tx3)' }}>
              <th style={{ textAlign: 'left', padding: '10px 10px', borderBottom: '1px solid var(--bd)' }}>ISO3</th>
              <th style={{ textAlign: 'left', padding: '10px 10px', borderBottom: '1px solid var(--bd)' }}>Country</th>
              <th style={{ textAlign: 'left', padding: '10px 10px', borderBottom: '1px solid var(--bd)' }}>Region</th>
              <th style={{ textAlign: 'left', padding: '10px 10px', borderBottom: '1px solid var(--bd)' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {countries.map((c) => (
              <tr key={c.iso3}>
                <td style={{ padding: '10px 10px', borderBottom: '1px solid rgba(48,54,61,.4)' }}>{c.iso3}</td>
                <td style={{ padding: '10px 10px', borderBottom: '1px solid rgba(48,54,61,.4)', color: 'var(--tx)' }}>{c.country_name}</td>
                <td style={{ padding: '10px 10px', borderBottom: '1px solid rgba(48,54,61,.4)', color: 'var(--tx2)' }}>{c.region}</td>
                <td style={{ padding: '10px 10px', borderBottom: '1px solid rgba(48,54,61,.4)' }}>
                  <Link
                    to={`/countries/${encodeURIComponent(c.iso3)}/edit`}
                    style={{ color: 'var(--ac)', textDecoration: 'none', fontWeight: 700 }}
                  >
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}

