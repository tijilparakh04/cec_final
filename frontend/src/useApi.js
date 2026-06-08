import { useState, useEffect } from "react";

const API = "/api";

export function useBootstrap() {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/map`).then((r) => r.json()),
      fetch(`${API}/tops`).then((r) => r.json()),
      fetch(`${API}/indicators`).then((r) => r.json()),
      fetch(`${API}/stats`).then((r) => r.json()),
    ])
      .then(([mapData, topsData, indsData, stats]) => {
        setData({
          countries:  mapData.countries,
          tops:       topsData.tops,
          indicators: indsData.indicators,
          stats,
        });
      })
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  return { data, loading, error };
}

export async function fetchCountry(iso3) {
  const r = await fetch(`${API}/country/${iso3}`);
  if (!r.ok) throw new Error(`Country not found: ${iso3}`);
  return r.json();
}