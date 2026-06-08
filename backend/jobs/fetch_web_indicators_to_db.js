require('dotenv').config();
const db = require('../db');
// Node 18+ has global fetch; no need for node-fetch.


// This job ports 1_fetch_web_indicators.py logic, but writes directly to DB.
// It upserts facts on (country_id, second_id).

const WB_API = 'https://api.worldbank.org/v2/country/{iso2}/indicator/{code}?format=json&mrv=5&per_page=10';

// ISO3 -> ISO2 mapping (copied from Python)
const ISO3_TO_ISO2 = {
  AFG: 'AF', AGO: 'AO', ALB: 'AL', ARE: 'AE', ARG: 'AR', AUS: 'AU', AUT: 'AT',
  BGD: 'BD', BEL: 'BE', BEN: 'BJ', BFA: 'BF', BGR: 'BG', BHS: 'BS', BLZ: 'BZ',
  BOL: 'BO', BRA: 'BR', BRN: 'BN', BTN: 'BT', BWA: 'BW', CMR: 'CM', CAN: 'CA',
  CAF: 'CF', CHL: 'CL', CHN: 'CN', COD: 'CD', COL: 'CO', COM: 'KM', CRI: 'CR',
  CPV: 'CV', CYP: 'CY', CZE: 'CZ', DNK: 'DK', DOM: 'DO', DZA: 'DZ', ECU: 'EC',
  EGY: 'EG', ESH: 'EH', ESP: 'ES', ETH: 'ET', FIN: 'FI', FJI: 'FJ', FRA: 'FR',
  GAB: 'GA', GBR: 'GB', GHA: 'GH', GIN: 'GN', GMB: 'GM', GNB: 'GW', GTM: 'GT',
  GUY: 'GY', HND: 'HN', HRV: 'HR', HTI: 'HT', HUN: 'HU', IDN: 'ID', IND: 'IN',
  IRL: 'IE', IRN: 'IR', IRQ: 'IQ', ISL: 'IS', ISR: 'IL', ITA: 'IT', JAM: 'JM',
  JOR: 'JO', JPN: 'JP', KAZ: 'KZ', KEN: 'KE', KGZ: 'KG', KHM: 'KH', KIR: 'KI',
  KOR: 'KR', KWT: 'KW', LAO: 'LA', LBN: 'LB', LBR: 'LR', LBY: 'LY', LCA: 'LC',
  LKA: 'LK', LSO: 'LS', LUX: 'LU', MAR: 'MA', MDG: 'MG', MDV: 'MV', MEX: 'MX',
  MKD: 'MK', MLI: 'ML', MLT: 'MT', MMR: 'MM', MNG: 'MN', MOZ: 'MZ', MRT: 'MR',
  MUS: 'MU', MWI: 'MW', MYS: 'MY', NAM: 'NA', NER: 'NE', NGA: 'NG', NIC: 'NI',
  NLD: 'NL', NOR: 'NO', NPL: 'NP', NZL: 'NZ', OMN: 'OM', PAK: 'PK', PAN: 'PA',
  PER: 'PE', PHL: 'PH', PNG: 'PG', POL: 'PL', PRT: 'PT', PRY: 'PY', QAT: 'QA',
  ROU: 'RO', RUS: 'RU', RWA: 'RW', SAU: 'SA', SDN: 'SD', SEN: 'SN', SLE: 'SL',
  SLB: 'SB', SOM: 'SO', SRB: 'RS', SSD: 'SS', STP: 'ST', SUR: 'SR', SVK: 'SK',
  SVN: 'SI', SWE: 'SE', SWZ: 'SZ', SYR: 'SY', TCD: 'TD', TGO: 'TG', THA: 'TH',
  TJK: 'TJ', TKM: 'TM', TLS: 'TL', TTO: 'TT', TUN: 'TN', TUR: 'TR', TZA: 'TZ',
  UGA: 'UG', UKR: 'UA', URY: 'UY', USA: 'US', UZB: 'UZ', VCT: 'VC', VEN: 'VE',
  VNM: 'VN', VUT: 'VU', WSM: 'WS', YEM: 'YE', ZAF: 'ZA', ZMB: 'ZM', ZWE: 'ZW',
};

async function fetchJson(url) {
  const r = await fetch(url, { timeout: 30000 });
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
  return r.json();
}

async function fetchText(url) {
  const r = await fetch(url, { timeout: 30000 });
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
  return r.text();
}

async function fetchWB(iso3, wbCode) {
  const iso2 = ISO3_TO_ISO2[iso3];
  if (!iso2) return null;
  const url = WB_API.replace('{iso2}', iso2).replace('{code}', wbCode);
  const data = await fetchJson(url);
  if (!Array.isArray(data) || !data[1] || !data[1].length) return null;
  for (const entry of data[1]) {
    if (entry.value !== null && entry.value !== undefined) {
      return { value: Number(entry.value), year: entry.date ? String(entry.date) : null };
    }
  }
  return null;
}

async function fetchNDGAIN() {
  const url = 'https://gain.nd.edu/assets/521435/nd_gain_country_index_2024.csv';
  const text = await fetchText(url);
  const lines = text.split(/\r?\n/).slice(1);
  const out = {};
  for (const line of lines) {
    const parts = line.split(',');
    if (parts.length >= 4) {
      const iso3 = parts[1].trim().replace(/"/g, '');
      const s = Number(parts[parts.length - 1].trim().replace(/"/g, ''));
      if (Number.isFinite(s) && s > 0 && s <= 100) out[iso3] = s;
    }
  }
  return out;
}

async function fetchINFORM() {
  const url = 'https://drmkc.jrc.ec.europa.eu/inform-index/API/InformAPI/countries/Inform2024';
  const data = await fetchJson(url);
  const out = {};
  for (const row of data?.data || []) {
    const iso3 = row?.ISO3;
    if (!iso3) continue;
    out[iso3] = {
      hazard: row?.['Hazard & Exposure']?.score,
      risk: row?.['INFORM Risk']?.score,
      // vulnerability not used here in Python via this endpoint
    };
  }
  return out;
}

async function main({ iso3 } = {}) {
  // Ensure fact_id is populated (facts.fact_id is NOT NULL in your schema)
  // We use deterministic IDs matching the Excel convention: F{5-digit}
  // based on existing max fact_id.
  const { rows: maxRows } = await db.query(
    "SELECT MAX(fact_id) AS max_fact_id FROM facts"
  );
  const maxFactId = maxRows?.[0]?.max_fact_id;
  let fidCounter = 1;
  if (maxFactId) {
    const m = String(maxFactId).match(/^[Ff](\d+)/);
    if (m) fidCounter = Number(m[1]) + 1;
  }

  const params = [];
  let where = '';

  if (iso3) {
    where = 'WHERE UPPER(iso3) = UPPER($1)';
    params.push(iso3);
  }

  // Load countries
  const countriesRes = await db.query(
    `SELECT country_id, iso3, region, country_name FROM countries ${where}`,
    params
  );
  const countries = countriesRes.rows;

  // Load indicators with wb_api_code
  const { rows: indicators } = await db.query(
    `SELECT second_id, second_name, top_id, top_name, pillar, direction, unit, strength, weight, wb_api_code, source_name, source_url
     FROM indicators`
  );

  const wbBySecond = new Map();
  for (const ind of indicators) {
    if (ind.wb_api_code) wbBySecond.set(ind.second_id, ind);
  }

  // Pre-fetch bulk sources used by qualitative python version
  const [ndgain, inform] = await Promise.all([fetchNDGAIN().catch(() => ({})), fetchINFORM().catch(() => ({}))]);

  // Facts to upsert: we only handle the same seconds Python does with web sources.
  // We'll upsert for all seconds that have wb_api_code AND also D12a/D12c/D13b via the specific sources.

  for (const c of countries) {
    const cid = c.country_id;
    const ciso3 = c.iso3;

    const tx = await db.query('BEGIN');
    try {
      // WB
      for (const [sid, ind] of wbBySecond.entries()) {
        const wbCode = ind.wb_api_code;
        const fetched = await fetchWB(ciso3, wbCode).catch(() => null);
        if (!fetched) continue;
        let val = fetched.value;
        if (['D10a', 'D10b', 'D10c', 'D10d'].includes(sid)) {
          val = Math.round((100.0 - val) * 100) / 100;
        } else if (sid === 'D14a' && val > 100) {
          val = Math.round(val * 10) / 10;
        } else {
          val = Math.round(val * 10000) / 10000;
        }

        const fact_id = `F${String(fidCounter).padStart(5, '0')}`;
        fidCounter += 1;


        await db.query(
          `INSERT INTO facts (fact_id, country_id, second_id, second_name, top_id, top_name, pillar,
                                value_numeric, value_text, unit, direction,
                                reference_year, source_name, source_url,
                                confidence, verified, extraction_method, notes)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NULL,$9,$10,$11,$12,$13,'High','Yes','API','')
           ON CONFLICT (country_id, second_id) DO UPDATE SET


             value_numeric = EXCLUDED.value_numeric,
             value_text = EXCLUDED.value_text,
             unit = EXCLUDED.unit,
             direction = EXCLUDED.direction,
             reference_year = EXCLUDED.reference_year,
             source_name = EXCLUDED.source_name,
             source_url = EXCLUDED.source_url,
             confidence = EXCLUDED.confidence,
             verified = EXCLUDED.verified,
             extraction_method = EXCLUDED.extraction_method,
             notes = EXCLUDED.notes,
             second_name = EXCLUDED.second_name,
             top_id = EXCLUDED.top_id,
             top_name = EXCLUDED.top_name,
             pillar = EXCLUDED.pillar`,
          [fact_id, cid, sid, ind.second_name, ind.top_id, ind.top_name, ind.pillar,
           val, ind.unit || null, ind.direction || null, fetched.year || null,
           'World Bank WDI', `https://data.worldbank.org/indicator/${wbCode}`]
        );
      }

      // D12a ND-GAIN vulnerability
      const d12a = ndgain[ciso3];
      if (d12a != null) {
        const ind = indicators.find((x) => x.second_id === 'D12a');
        if (ind) {
          await db.query(
            `INSERT INTO facts (country_id, second_id, second_name, top_id, top_name, pillar,
                                  value_numeric, value_text, unit, direction,
                                  reference_year, source_name, source_url,
                                  confidence, verified, extraction_method, notes)
             VALUES ($1,$2,$3,$4,$5,$6,$7,NULL,$8,$9,$10,$11,$12,'High','Yes','API','')
             ON CONFLICT (country_id, second_id) DO UPDATE SET value_numeric=EXCLUDED.value_numeric,
               value_text=EXCLUDED.value_text, unit=EXCLUDED.unit, direction=EXCLUDED.direction,
               reference_year=EXCLUDED.reference_year, source_name=EXCLUDED.source_name, source_url=EXCLUDED.source_url,
               confidence=EXCLUDED.confidence, verified=EXCLUDED.verified, extraction_method=EXCLUDED.extraction_method, notes=EXCLUDED.notes`,
            [cid, 'D12a', ind.second_name, ind.top_id, ind.top_name, ind.pillar,
             d12a, ind.unit || '', ind.direction || 'pos', '2024',
             'ND-GAIN Country Index 2024', 'https://gain.nd.edu/our-work/country-index/']
          );
        }
      }

      // D12c hazard + D13b risk
      const h = inform[ciso3]?.hazard;
      if (h != null) {
        const ind = indicators.find((x) => x.second_id === 'D12c');
        if (ind) {
          const scaled = Math.round(Number(h) * 10 * 100) / 100;
          await db.query(
            `INSERT INTO facts (country_id, second_id, second_name, top_id, top_name, pillar,
                                  value_numeric, value_text, unit, direction,
                                  reference_year, source_name, source_url,
                                  confidence, verified, extraction_method, notes)
             VALUES ($1,$2,$3,$4,$5,$6,$7,NULL,$8,$9,$10,$11,$12,'High','Yes','API','')
             ON CONFLICT (country_id, second_id) DO UPDATE SET value_numeric=EXCLUDED.value_numeric,
               value_text=EXCLUDED.value_text, unit=EXCLUDED.unit, direction=EXCLUDED.direction,
               reference_year=EXCLUDED.reference_year, source_name=EXCLUDED.source_name, source_url=EXCLUDED.source_url,
               confidence=EXCLUDED.confidence, verified=EXCLUDED.verified, extraction_method=EXCLUDED.extraction_method, notes=EXCLUDED.notes`,
            [cid, 'D12c', ind.second_name, ind.top_id, ind.top_name, ind.pillar,
             scaled, ind.unit || '', ind.direction || 'pos', '2024',
             'INFORM Risk Index 2024', 'https://www.inform-index.org/']
          );
        }
      }

      const r = inform[ciso3]?.risk;
      if (r != null) {
        const ind = indicators.find((x) => x.second_id === 'D13b');
        if (ind) {
          const scaled = Math.round(Number(r) * 10 * 100) / 100;
          await db.query(
            `INSERT INTO facts (country_id, second_id, second_name, top_id, top_name, pillar,
                                  value_numeric, value_text, unit, direction,
                                  reference_year, source_name, source_url,
                                  confidence, verified, extraction_method, notes)
             VALUES ($1,$2,$3,$4,$5,$6,$7,NULL,$8,$9,$10,$11,$12,'High','Yes','API','')
             ON CONFLICT (country_id, second_id) DO UPDATE SET value_numeric=EXCLUDED.value_numeric,
               value_text=EXCLUDED.value_text, unit=EXCLUDED.unit, direction=EXCLUDED.direction,
               reference_year=EXCLUDED.reference_year, source_name=EXCLUDED.source_name, source_url=EXCLUDED.source_url,
               confidence=EXCLUDED.confidence, verified=EXCLUDED.verified, extraction_method=EXCLUDED.extraction_method, notes=EXCLUDED.notes`,
            [cid, 'D13b', ind.second_name, ind.top_id, ind.top_name, ind.pillar,
             scaled, ind.unit || '', ind.direction || 'pos', '2024',
             'INFORM Risk Index 2024', 'https://www.inform-index.org/']
          );
        }
      }

      await db.query('COMMIT');
    } catch (e) {
      await db.query('ROLLBACK');
      throw e;
    }
  }
}

module.exports = { main };
if (require.main === module) {
  const iso3 = process.argv.includes('--country') ? process.argv[process.argv.indexOf('--country') + 1] : null;
  main({ iso3 }).then(() => {
    console.log('fetch_web_indicators_to_db done');
    process.exit(0);
  }).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

