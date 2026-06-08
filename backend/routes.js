const express = require("express");
const router  = express.Router();
const db      = require("./db");

// ── /api/map ─────────────────────────────────────────────────────────────────
// Everything the map needs on load: countries + scores + top-level scores.
// Returns one row per country.
router.get("/map", async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT
        c.country_id    AS cid,
        c.country_name  AS name,
        c.iso3,
        c.region,
        c.subregion     AS sub,
        c.latitude      AS lat,
        c.longitude     AS lon,
        c.population    AS pop,
        c.gdp_per_capita_usd AS gdp,
        c.world_bank_income_class AS income,

        ps.supply_score  AS supply,
        ps.demand_score  AS demand,
        ps.gap_score     AS gap,
        ps.gap_tier      AS tier,

        ts.t01_score     AS t01_score,
        ts.t02_score     AS t02_score,
        ts.t03_score     AS t03_score,
        ts.t04_score     AS t04_score,
        ts.t05_score     AS t05_score,
        ts.t06_score     AS t06_score,
        ts.t07_score     AS t07_score,
        ts.t08_score     AS t08_score,
        ts.t09_score     AS t09_score,
        ts.t10_score     AS t10_score,
        ts.t11_score     AS t11_score,
        ts.t12_score     AS t12_score,
        ts.t13_score     AS t13_score,
        ts.t14_score     AS t14_score,
        ts.t15_score     AS t15_score,
        ts.t16_score     AS t16_score

      FROM countries c
      LEFT JOIN pillar_scores ps ON c.country_id = ps.country_id
      LEFT JOIN top_scores ts    ON c.country_id = ts.country_id
      ORDER BY ps.gap_score DESC NULLS LAST
    `);

    // Reshape top scores into { T01: val, T02: val, ... }
    const countries = rows.map((r) => {
      const tops = {};
      for (let i = 1; i <= 16; i++) {
        const key = `t${String(i).padStart(2, "0")}_score`;
        const val = r[key];
        if (val !== null && val !== undefined) {
          tops[`T${String(i).padStart(2, "0")}`] = +val;
        }
        delete r[key];
      }
      return { ...r, tops };
    });

    res.json({ countries });
  } catch (err) {
    console.error("/api/map", err);
    res.status(500).json({ error: err.message });
  }
});

// ── /api/tops ────────────────────────────────────────────────────────────────
// All 16 top-level indicator definitions.
router.get("/tops", async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT
         (t.ti) AS top_id,
         t.top_name,
         t.pillar,
         t.n_seconds
       FROM (
         VALUES
           (1, 'Engineering workforce size', 'Supply', '---'),
           (2, 'Engineering education output', 'Supply', '---'),
           (3, 'Engineering output quality and safety outcomes', 'Supply', '---'),
           (4, 'Education quality, diversity and industry alignment', 'Supply', '---'),
           (5, 'Innovation, R&D and technology adoption', 'Supply', '---'),
           (6, 'Tertiary graduates in engineering (% of all graduates)', 'Supply', '---'),
           (7, 'Female share of engineering graduates', 'Supply', '---'),
           (8, 'Adequate national building and electrical codes', 'Supply', '---'),
           (9, 'Economic and investment capacity', 'Demand', '---'),
           (10, 'Urbanisation and population pressure', 'Demand', '---'),
           (11, 'Infrastructure access and service gaps', 'Demand', '---'),
           (12, 'Climate vulnerability and environmental stress', 'Demand', '---'),
           (13, 'Public investment (% GDP)', 'Demand', '---'),
           (14, 'GDP per capita (current US$)', 'Demand', '---'),
           (15, 'Access to electricity gap (% without access)', 'Demand', '---'),
           (16, 'Safely managed drinking water gap (%)', 'Demand', '---')
       ) AS t(ti, top_name, pillar, n_seconds)
       ORDER BY top_id`
    );

    res.json({ tops: rows });

  } catch (err) {
    console.error("/api/tops", err);
    res.status(500).json({ error: err.message });
  }
});

// ── /api/indicators ──────────────────────────────────────────────────────────
// All 83 second-level indicator definitions.
router.get("/indicators", async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT second_id, second_name, top_id, top_name,
              pillar, strength, weight, direction, unit,
              source_name, source_url, data_availability
       FROM indicators ORDER BY top_id, second_id`
    );
    res.json({ indicators: rows });
  } catch (err) {
    console.error("/api/indicators", err);
    res.status(500).json({ error: err.message });
  }
});

// ── /api/country/:iso3 ───────────────────────────────────────────────────────
// Full detail for one country: scores + all facts.
router.get("/country/:iso3", async (req, res) => {
  const { iso3 } = req.params;
  try {
    // Country + scores
    const { rows: cRows } = await db.query(
      `SELECT
         c.country_id, c.country_name, c.iso3, c.region, c.subregion,
         c.latitude, c.longitude, c.population, c.gdp_per_capita_usd,
         c.world_bank_income_class,

         ps.supply_score, ps.demand_score, ps.gap_score, ps.gap_tier,

         ts.t01_score AS t01_score,
         ts.t02_score AS t02_score,
         ts.t03_score AS t03_score,
         ts.t04_score AS t04_score,
         ts.t05_score AS t05_score,
         ts.t06_score AS t06_score,
         ts.t07_score AS t07_score,
         ts.t08_score AS t08_score,
         ts.t09_score AS t09_score,
         ts.t10_score AS t10_score,
         ts.t11_score AS t11_score,
         ts.t12_score AS t12_score,
         ts.t13_score AS t13_score,
         ts.t14_score AS t14_score,
         ts.t15_score AS t15_score,
         ts.t16_score AS t16_score

       FROM countries c
       LEFT JOIN pillar_scores ps ON c.country_id = ps.country_id
       LEFT JOIN top_scores ts    ON c.country_id = ts.country_id
       WHERE UPPER(c.iso3) = UPPER($1)`,
      [iso3]
    );
    if (!cRows.length) return res.status(404).json({ error: "Country not found" });

    const country = cRows[0];
    const tops = {};
    for (let i = 1; i <= 16; i++) {
      const key = `t${String(i).padStart(2, "0")}_score`;
      if (country[key] !== null && country[key] !== undefined) {
        tops[`T${String(i).padStart(2, "0")}`] = +country[key];
      }
      delete country[key];
    }

    // All facts
    const { rows: facts } = await db.query(
      `SELECT
         f.second_id   AS sid,
         f.second_name AS sname,
         f.top_id      AS tid,
         f.top_name    AS tname,
         f.pillar,
         f.value_numeric AS vn,
         f.value_text    AS vt,
         f.unit,
         f.direction     AS dir,
         f.reference_year AS year,
         f.source_name    AS src,
         f.confidence     AS conf
       FROM facts f
       JOIN countries c ON c.country_id = f.country_id
       WHERE UPPER(c.iso3) = UPPER($1)
       ORDER BY f.pillar, f.top_id, f.second_id`,
      [iso3]
    );



    res.json({ country: { ...country, tops }, facts });
  } catch (err) {
    console.error("/api/country/:iso3", err);
    res.status(500).json({ error: err.message });
  }
});

// ── /api/facts ───────────────────────────────────────────────────────────────
// Facts filtered by iso3 and/or top_id and/or pillar.
router.get("/facts", async (req, res) => {
  const { iso3, top, pillar } = req.query;
  const conditions = [];
  const params = [];

  if (iso3) { conditions.push(`UPPER(c.iso3) = UPPER($${params.length + 1})`); params.push(iso3); }

  if (top)  { conditions.push(`f.top_id = $${params.length + 1}`); params.push(top); }
  if (pillar){ conditions.push(`f.pillar = $${params.length + 1}`); params.push(pillar); }

  const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";

  try {
    const { rows } = await db.query(
      `SELECT
         f.second_id AS sid, f.second_name AS sname,
         f.top_id AS tid, f.top_name AS tname,
         f.pillar,
         c.country_name, c.iso3,
         f.value_numeric AS vn, f.value_text AS vt,
         f.unit, f.direction AS dir,
         f.reference_year AS year, f.source_name AS src,
         f.confidence AS conf
       FROM facts f
       JOIN countries c ON c.country_id = f.country_id
       ${where}
       ORDER BY f.pillar, f.top_id, f.second_id, c.country_name`,
      params
    );

    res.json({ facts: rows, count: rows.length });
  } catch (err) {
    console.error("/api/facts", err);
    res.status(500).json({ error: err.message });
  }
});

// ── /api/stats ───────────────────────────────────────────────────────────────
// Header summary stats.
router.get("/stats", async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT
        (SELECT COUNT(*) FROM countries)                               AS total_countries,
        (SELECT COUNT(*) FROM pillar_scores WHERE gap_score IS NOT NULL) AS scored_countries,
        (SELECT COUNT(*) FROM pillar_scores WHERE gap_tier = 'Severe')   AS severe,
        (SELECT COUNT(*) FROM pillar_scores WHERE gap_tier = 'Constrained') AS constrained,
        (SELECT COUNT(*) FROM indicators)                              AS total_indicators,
        (SELECT COUNT(*) FROM facts)                                   AS total_facts,
        (SELECT COUNT(*) FROM facts WHERE value_numeric IS NOT NULL)   AS numeric_facts,
        (SELECT COUNT(*) FROM facts WHERE value_text IS NOT NULL AND value_numeric IS NULL) AS text_facts
    `);
    res.json(rows[0]);
  } catch (err) {
    console.error("/api/stats", err);
    res.status(500).json({ error: err.message });
  }
});

// Admin dashboard routes (JWT + scoped edits)
const adminRoutes = require('./adminRoutes');
router.use('/admin', adminRoutes);

module.exports = router;
