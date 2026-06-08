require('dotenv').config();
const db = require('../db');
const fs = require('fs');
const path = require('path');

function loadUpdates() {
  const p = path.join(__dirname, 'indicator_updates.json');
  const raw = fs.readFileSync(p, 'utf8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error('indicator_updates.json must be an array');
  return parsed;
}

function normalizeDir(v) {
  const s = String(v || '').toLowerCase();
  if (s === 'neg' || s === 'negative') return 'neg';
  return 'pos';
}

async function main() {
  const updates = loadUpdates();

  const { rows: existing } = await db.query(
    `SELECT second_id,
            second_name, top_id, top_name, pillar, strength, weight, direction, unit,
            source_name, source_url, data_availability, wb_api_code, notes
     FROM indicators`
  );

  const existingBySecond = new Map();
  for (const r of existing) existingBySecond.set(r.second_id, r);

  let inserted = 0;
  let skippedExisting = 0;
  let invalid = 0;

  // Insert-only sync (user requested insert-only to avoid accidental changes)
  for (const u of updates) {
    const second_id = String(u.second_id || '').trim();
    if (!second_id) { invalid += 1; continue; }

    if (existingBySecond.has(second_id)) {
      skippedExisting += 1;
      continue;
    }

    // Build columns; keep naming consistent with DB schema used in fetch/compute jobs.
    const top_id = u.top_id ?? null;
    const pillar = u.pillar ?? null;

    // Ensure numeric weight when provided
    const weight = u.weight !== undefined && u.weight !== null ? Number(u.weight) : null;

    const direction = normalizeDir(u.direction);

    await db.query(
      `INSERT INTO indicators (
          second_id, second_name, top_id, top_name,
          pillar, strength, weight, direction, unit,
          source_name, source_url, data_availability,
          wb_api_code, notes
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [
        second_id,
        u.second_name ?? null,
        top_id,
        u.top_name ?? null,
        pillar,
        u.strength ?? null,
        weight,
        direction,
        u.unit ?? null,
        u.source_name ?? null,
        u.source_url ?? null,
        u.data_availability ?? null,
        u.wb_api_code ?? null,
        u.notes ?? null,
      ]
    );

    inserted += 1;
  }

  console.log('[sync_indicators_to_db] updates loaded:', updates.length);
  console.log('[sync_indicators_to_db] inserted:', inserted);
  console.log('[sync_indicators_to_db] skippedExisting:', skippedExisting);
  console.log('[sync_indicators_to_db] invalid:', invalid);

  await db.end();
}

module.exports = { main };

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

