const express = require('express');
const router = express.Router();

const db = require('./db');
const {
  signToken,
  verifyPassword,
  getAdminByUsername,
  getAdminById,
  adminAuthMiddleware,
  scopeFilterForAdmin,
  getEditableCountries,
} = require('./adminAuth');

const bcrypt = require('bcrypt');


// Allow-lists for safe updates
const COUNTRY_UPDATE_FIELDS = [
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

const FACTS_ALLOWED_FIELDS = [
  'value_numeric',
  'value_text',
  'unit',
  'direction',
  'reference_year',
  'source_name',
  'source_url',
  'confidence',
  'verified',
  'extraction_method',
  'notes',
];

function pickAllowed(obj, allowed) {
  const out = {};
  for (const k of allowed) {
    if (Object.prototype.hasOwnProperty.call(obj, k)) out[k] = obj[k];
  }
  return out;
}

function normalizeIso3(s) {
  return String(s || '').toUpperCase();
}

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'username and password required' });

    const admin = await getAdminByUsername(username);
    if (!admin) return res.status(401).json({ error: 'Invalid credentials' });

    const ok = await verifyPassword(password, admin.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    const token = signToken({
      id: admin.id,
      username: admin.username,
      role: admin.role,
      country_iso3: admin.country_iso3,
    });

    return res.json({ token });
  } catch (e) {
    console.error('admin/login', e);
    res.status(500).json({ error: e.message });
  }
});

router.get('/me', adminAuthMiddleware, async (req, res) => {
  try {
    const admin = await getAdminById(req.admin.id);
    if (!admin) return res.status(401).json({ error: 'Invalid token' });

    res.json({
      me: {
        id: admin.id,
        username: admin.username,
        role: admin.role,
        country_iso3: admin.country_iso3,
      },
    });
  } catch (e) {
    console.error('admin/me', e);
    res.status(500).json({ error: e.message });
  }
});

// Admin list of countries they can edit
router.get('/countries', adminAuthMiddleware, async (req, res) => {
  try {
    const countries = await getEditableCountries(req.admin);
    res.json({ countries });
  } catch (e) {
    console.error('admin/countries', e);
    res.status(500).json({ error: e.message });
  }
});

router.get('/country/:iso3/edit', adminAuthMiddleware, async (req, res) => {
  try {
    const iso3 = normalizeIso3(req.params.iso3);
    const scope = scopeFilterForAdmin(req.admin);

    if (scope.editableIso3 && scope.editableIso3 !== iso3) {
      return res.status(403).json({ error: 'Forbidden: out of scope' });
    }

    const { rows: cRows } = await db.query(
      `SELECT
         country_id,
         country_name,
         iso3,
         region,
         subregion,
         latitude,
         longitude,
         population,
         gdp_per_capita_usd,
         world_bank_income_class,
         hdi_score,
         data_status,
         notes
       FROM countries
       WHERE UPPER(iso3) = UPPER($1)`,
      [iso3]
    );

    if (!cRows.length) return res.status(404).json({ error: 'Country not found' });

    const country = cRows[0];

    const { rows: facts } = await db.query(
      `SELECT
         f.fact_id,
         f.second_id   AS sid,
         f.second_name AS sname,
         f.top_id      AS tid,
         f.top_name    AS tname,
         f.pillar,
         f.value_numeric,
         f.value_text,
         f.unit,
         f.direction,
         f.reference_year,
         f.source_name,
         f.source_url,
         f.confidence,
         f.verified,
         f.extraction_method,
         f.notes
       FROM facts f
       JOIN countries c ON c.country_id = f.country_id
       WHERE UPPER(c.iso3) = UPPER($1)
       ORDER BY f.pillar, f.top_id, f.second_id`,
      [iso3]
    );

    // Frontend expects vn/vt/conf/notes keys (see CountryEditPage.jsx)
    const mappedFacts = facts.map((f) => ({
      fact_key: f.fact_id,
      ...f,
      vn: f.value_numeric,
      vt: f.value_text,
      conf: f.confidence,
    }));

    res.json({
      country,
      facts: mappedFacts,
    });
  } catch (e) {
    console.error('admin/country edit', e);
    res.status(500).json({ error: e.message });
  }
});

router.put('/country/:iso3', adminAuthMiddleware, async (req, res) => {
  try {
    const iso3 = normalizeIso3(req.params.iso3);
    const scope = scopeFilterForAdmin(req.admin);
    if (scope.editableIso3 && scope.editableIso3 !== iso3) return res.status(403).json({ error: 'Forbidden' });

    const payload = (req.body && req.body.country) || {};
    const updates = pickAllowed(payload, COUNTRY_UPDATE_FIELDS);

    const { rows: cRows } = await db.query(
      `SELECT country_id FROM countries WHERE UPPER(iso3)=UPPER($1)`,
      [iso3]
    );
    if (!cRows.length) return res.status(404).json({ error: 'Country not found' });

    if (!Object.keys(updates).length) return res.status(400).json({ error: 'No valid fields' });

    // Build dynamic update
    const keys = Object.keys(updates);
    const setSql = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
    const values = keys.map((k) => updates[k]);
    values.push(cRows[0].country_id);

    await db.query(
      `UPDATE countries SET ${setSql} WHERE country_id = $${keys.length + 1}`,
      values
    );

    res.json({ ok: true });
  } catch (e) {
    console.error('admin/country PUT', e);
    res.status(500).json({ error: e.message });
  }
});

router.put('/facts', adminAuthMiddleware, async (req, res) => {
  // Trigger recompute after facts are updated

  try {
    const iso3 = normalizeIso3(req.body && req.body.iso3);
    const facts = (req.body && req.body.facts) || [];
    if (!iso3) return res.status(400).json({ error: 'iso3 required' });

    // After facts update, recompute scores globally (min/max normalization is global)
    // NOTE: recompute is executed after applying the fact updates.
    const { main: recompute } = require('./jobs/compute_scores_to_db');



    const scope = scopeFilterForAdmin(req.admin);
    if (scope.editableIso3 && scope.editableIso3 !== iso3) return res.status(403).json({ error: 'Forbidden' });

    // Update only fact primary keys that exist in this country
    // We'll update value_numeric/value_text/confidence/notes/unit/direction/year/source_* if present.
    // Frontend currently edits vn/vt/conf/notes.

    const allowedPatchKeys = ['vn', 'vt', 'conf', 'notes'];

    // Pre-fetch allowed fact rows for this country
    const factIds = facts
      .map((f) => f.fact_key || f.fact_id)
      .filter(Boolean);

    if (!factIds.length) return res.status(400).json({ error: 'No facts provided' });

    // Verify fact_id belongs to iso3
    const { rows: existing } = await db.query(
      `SELECT fact_id
       FROM facts f
       JOIN countries c ON c.country_id = f.country_id
       WHERE UPPER(c.iso3)=UPPER($1) AND f.fact_id = ANY($2::text[])`,
      [iso3, factIds]
    );

    const existingSet = new Set(existing.map((r) => r.fact_id));

    // Apply updates one-by-one (safe and simple)
    for (const f of facts) {
      const factId = f.fact_key || f.fact_id;
      if (!factId || !existingSet.has(factId)) continue;

      const patch = {};
      if (Object.prototype.hasOwnProperty.call(f, 'vn')) patch.value_numeric = f.vn === '' ? null : f.vn;
      if (Object.prototype.hasOwnProperty.call(f, 'vt')) patch.value_text = f.vt === '' ? null : f.vt;
      if (Object.prototype.hasOwnProperty.call(f, 'conf')) patch.confidence = f.conf === '' ? null : f.conf;
      if (Object.prototype.hasOwnProperty.call(f, 'notes')) patch.notes = f.notes;

      // Only include allowed patch keys (column allow-list already)
      const columnUpdates = pickAllowed(patch, ['value_numeric', 'value_text', 'confidence', 'notes']);
      const cols = Object.keys(columnUpdates);
      if (!cols.length) continue;

      const setSql = cols.map((k, i) => `${k} = $${i + 1}`).join(', ');
      const vals = cols.map((k) => columnUpdates[k]);
      vals.push(factId);

      await db.query(
        `UPDATE facts SET ${setSql} WHERE fact_id = $${cols.length + 1}`,
        vals
      );
    }

    res.json({ ok: true });
  } catch (e) {
    console.error('admin/facts PUT', e);
    res.status(500).json({ error: e.message });
  }
});

// Admins can update their username/password
router.put('/me', adminAuthMiddleware, async (req, res) => {
  try {
    const adminId = req.admin.id;
    const { username, password } = req.body || {};

    const patches = {};
    if (username !== undefined) patches.username = String(username).trim();

    if (password !== undefined) {
      if (!String(password).length) return res.status(400).json({ error: 'password cannot be empty' });
      const saltRounds = 10;
      patches.password_hash = await bcrypt.hash(String(password), saltRounds);
    }

    const cols = Object.keys(patches);
    if (!cols.length) return res.status(400).json({ error: 'No fields to update' });

    // Prevent updating to empty username
    if (patches.username !== undefined && !patches.username) return res.status(400).json({ error: 'username cannot be empty' });

    const setSql = cols.map((k, i) => `${k} = $${i + 1}`).join(', ');
    const vals = cols.map((k) => patches[k]);
    vals.push(adminId);

    await db.query(`UPDATE admin_users SET ${setSql} WHERE id = $${cols.length + 1}`, vals);

    res.json({ ok: true });
  } catch (e) {
    console.error('admin/me PUT', e);
    // likely unique constraint
    res.status(500).json({ error: e.message });
  }
});

// Overall admin can create new admins (delegation)
router.post('/admins', adminAuthMiddleware, async (req, res) => {
  try {
    if (req.admin.role !== 'overall') return res.status(403).json({ error: 'Only overall admins can create other admins' });


    const { username, password, role, country_iso3 } = req.body || {};
    if (!username || !password || !role) return res.status(400).json({ error: 'username, password, role required' });

    const normalizedRole = role === 'country' ? 'country' : 'overall';
    const iso3 = normalizedRole === 'country' ? normalizeIso3(country_iso3) : null;
    if (normalizedRole === 'country' && !iso3) return res.status(400).json({ error: 'country_iso3 required for country admins' });

    const saltRounds = 10;
    const passwordHash = await require('bcrypt').hash(String(password), saltRounds);

    await db.query(
      `INSERT INTO admin_users (username, password_hash, role, country_iso3, active)
       VALUES ($1, $2, $3, $4, true)`,
      [String(username).trim(), passwordHash, normalizedRole, iso3]
    );

    res.json({ ok: true });
  } catch (e) {
    console.error('admin/admins POST', e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

