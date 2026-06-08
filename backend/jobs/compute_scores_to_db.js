require('dotenv').config();
const db = require('../db');

// CHANGED: Thresholds recalibrated for the new weighted asymmetric gap formula.
//
// Formula: gap = (0.7 * demand + 0.3 * (100 - supply)) * (demand / 100)
//
// The demand/100 multiplier compresses scores for low-demand countries, so the
// distribution shifts left compared to the old formula. Typical ranges:
//   Sub-Saharan (D~75, S~20): gap ~55-65  → Severe
//   South Asia  (D~60, S~35): gap ~38-45  → Constrained
//   Lat. America(D~45, S~45): gap ~20-28  → Low Need
//   Canada/UK   (D~25, S~40): gap ~7-11   → Low Need / Benchmark edge
//   Nordic      (D~10, S~70): gap ~1-3    → Benchmark
//
// This means Benchmark is reserved for countries with genuinely low unmet demand
// (strong infrastructure, mature economies, low climate stress, high supply).
const TIERS = [
  { thresh: 45, label: 'Severe' },
  { thresh: 25, label: 'Constrained' },
  { thresh: 12, label: 'Low Need' },
  { thresh: -Infinity, label: 'Benchmark' },
];

function getTier(score) {
  if (score === null || score === undefined) return { label: 'No data', tier: 'No data' };
  for (const t of TIERS) {
    if (score >= t.thresh) return { label: t.label, tier: t.label };
  }
  return { label: 'Benchmark', tier: 'Benchmark' };
}

function norm(v, mn, mx) {
  if (mx === mn) return 50.0;
  return ((v - mn) / (mx - mn)) * 100.0;
}

// Confidence penalty for sparse indicator coverage.
//
// When a top-level indicator is computed from fewer second-level indicators than
// expected, we pull the score toward the neutral midpoint (50).
//
//   adjustedScore = rawScore * coverage + 50 * (1 - coverage)
//
//   coverage=1.0  → score unchanged
//   coverage=0.5  → score halfway between rawScore and 50
//   coverage=0.0  → score = 50 (neutral, treated as unknown)
//
// This prevents a country with missing supply data from receiving a falsely low
// supply score that would inflate the gap.
function applyConfidencePenalty(rawScore, usedCount, expectedCount) {
  if (expectedCount === 0) return rawScore;
  const coverage = usedCount / expectedCount;
  return Math.round((rawScore * coverage + 50.0 * (1 - coverage)) * 100) / 100;
}

async function main() {
  // 1) Read indicators meta
  const { rows: inds } = await db.query(
    `SELECT second_id, top_id, pillar, weight, direction
     FROM indicators
     WHERE top_id IS NOT NULL`
  );

  const indBySecond = new Map();
  for (const r of inds) {
    indBySecond.set(r.second_id, {
      second_id: r.second_id,
      top_id: r.top_id,
      pillar: r.pillar,
      weight: Number(r.weight),
      direction: r.direction,
    });
  }

  // Pre-compute expected indicator counts per top_id for confidence penalty.
  const expectedCountByTop = new Map();
  for (const meta of indBySecond.values()) {
    const key = String(meta.top_id);
    expectedCountByTop.set(key, (expectedCountByTop.get(key) || 0) + 1);
  }

  // 2) Read numeric facts
  const { rows: facts } = await db.query(
    `SELECT country_id, second_id, value_numeric
     FROM facts
     WHERE value_numeric IS NOT NULL`
  );

  const raw = new Map();
  const minmax = new Map();

  for (const f of facts) {
    const sid = f.second_id;
    const meta = indBySecond.get(sid);
    if (!meta) continue;
    const cid = f.country_id;
    const v = Number(f.value_numeric);

    if (!raw.has(cid)) raw.set(cid, new Map());
    raw.get(cid).set(sid, v);

    const mm = minmax.get(sid);
    if (!mm) {
      minmax.set(sid, { mn: v, mx: v });
    } else {
      mm.mn = Math.min(mm.mn, v);
      mm.mx = Math.max(mm.mx, v);
    }
  }

  // 3) Normalize per country per second
  const normed = new Map();
  for (const [cid, cdata] of raw.entries()) {
    const nm = new Map();
    for (const [sid, v] of cdata.entries()) {
      const meta = indBySecond.get(sid);
      const mm = minmax.get(sid);
      if (!meta || !mm) continue;
      let n = norm(v, mm.mn, mm.mx);
      if (meta.direction === 'neg') n = 100.0 - n;
      nm.set(sid, Math.round(n * 100) / 100);
    }
    normed.set(cid, nm);
  }

  // 4) Compute top scores with confidence penalty
  const { rows: topRows } = await db.query(
    `SELECT DISTINCT top_id, pillar
     FROM indicators
     WHERE top_id IS NOT NULL
     ORDER BY top_id`
  );
  const tops = topRows.map((r) => ({ top_id: r.top_id, pillar: r.pillar }));

  const secondsByTop = new Map();
  const seconds = Array.from(indBySecond.values());
  for (const meta of seconds) {
    if (!secondsByTop.has(meta.top_id)) secondsByTop.set(meta.top_id, []);
    secondsByTop.get(meta.top_id).push(meta);
  }

  const topScores = new Map();
  const topN = new Map();

  for (const [cid, cdata] of normed.entries()) {
    const tc = new Map();
    const tn = new Map();

    for (const t of tops) {
      const topIdKey = String(t.top_id).replace(/^0+/, '');
      const sidMetas = secondsByTop.get(t.top_id) || secondsByTop.get(topIdKey) || [];

      let weightedSum = 0.0;
      let weightSum = 0.0;
      let used = 0;

      for (const meta of sidMetas) {
        if (!cdata.has(meta.second_id)) continue;
        const v = cdata.get(meta.second_id);
        weightedSum += v * meta.weight;
        weightSum += meta.weight;
        used += 1;
      }

      if (weightSum > 0) {
        const rawScore = Math.round((weightedSum / weightSum) * 10) / 10;
        const expectedCount = expectedCountByTop.get(String(t.top_id)) || sidMetas.length;
        const penalisedScore = applyConfidencePenalty(rawScore, used, expectedCount);

        tc.set(String(t.top_id), penalisedScore);
        tn.set(t.top_id, used);
      }
    }

    topScores.set(cid, tc);
    topN.set(cid, tn);
  }

  // 5) Pillar scores + gap
  const topWeights = {
    T03: 0.20, T04: 0.20, T05: 0.20, T06: 0.15,
    T07: 0.15, T08: 0.10,
    T10: 0.20, T11: 0.10, T12: 0.15, T13: 0.15,
    T14: 0.10, T15: 0.10, T16: 0.20,
  };

  const supplyTops = tops.filter((t) => t.pillar === 'Supply').map((t) => String(t.top_id));
  const demandTops = tops.filter((t) => t.pillar === 'Demand').map((t) => String(t.top_id));

  const pillarScores = new Map();

  for (const [cid, tc] of topScores.entries()) {
    const sd = supplyTops
      .map((tid) => ({ tid, v: tc.get(tid), w: topWeights[tid] }))
      .filter((x) => x.v !== undefined && x.w !== undefined);

    const dd = demandTops
      .map((tid) => ({ tid, v: tc.get(tid), w: topWeights[tid] }))
      .filter((x) => x.v !== undefined && x.w !== undefined);

    if (sd.length < 2 && dd.length < 2) continue;

    const supply = sd.length
      ? Math.round((sd.reduce((a, x) => a + x.v * x.w, 0) / sd.reduce((a, x) => a + x.w, 0)) * 10) / 10
      : null;

    const demand = dd.length
      ? Math.round((dd.reduce((a, x) => a + x.v * x.w, 0) / dd.reduce((a, x) => a + x.w, 0)) * 10) / 10
      : null;

    if (supply === null || demand === null) continue;

    // CHANGED: Weighted asymmetric gap formula.
    //
    // gap = (0.7 * demand + 0.3 * (100 - supply)) * (demand / 100)
    //
    // Why this works:
    //   - Demand is the primary driver (70% weight). High demand = high gap.
    //   - Supply acts as a partial suppressor (30% weight via its complement).
    //     Low supply adds to the gap, but only contributes a third of the signal.
    //   - The (demand / 100) multiplier is the key fix for developed nations.
    //     It scales the whole gap down proportionally to how much demand exists.
    //     A country with D=25 can never score above 25 on this formula, so even
    //     if its supply is low it stays in Low Need or Benchmark range.
    //
    // Compared to previous approaches:
    //   Old (demand + (100-supply))/2  → penalised high-supply countries regardless of demand
    //   max(0, demand - supply)         → too binary, flooded Benchmark with any supply >= demand
    //   This formula → smooth gradient, only genuinely low-demand + well-supplied → Benchmark
    const baseGap = 0.7 * demand + 0.3 * (100 - supply);
    const rawGap = baseGap * (demand / 100);
    const gap = Math.round(Math.max(0, rawGap) * 10) / 10;
    const tier = getTier(gap).tier;

    pillarScores.set(cid, {
      supply_score: supply,
      demand_score: demand,
      gap_score: gap,
      gap_tier: tier,
      n_supply_tops: sd.length,
      n_demand_tops: dd.length,
    });
  }

  // 6) Write top_scores
  const topIds = ['T01','T02','T03','T04','T05','T06','T07','T08','T09','T10','T11','T12','T13','T14','T15','T16'];
  const topCols = topIds.map((tid) => `t${tid.replace(/^T/, '')}_score`);
  const nCols   = topIds.map((tid) => `t${tid.replace(/^T/, '')}_n_inds`);

  console.log('[compute_scores_to_db] topScores countries:', topScores.size);

  for (const [cid, tc] of topScores.entries()) {
    const scoreVals = [];
    const nVals = [];
    for (const tid of topIds) {
      scoreVals.push(tc.get(tid) ?? null);
      nVals.push(topN.get(cid)?.get(tid) ?? 0);
    }

    const placeholders = scoreVals
      .concat(nVals)
      .map((_, i) => `$${i + 2}`)
      .join(', ');

    const sql = `
      INSERT INTO top_scores (country_id, ${topCols.join(', ')}, ${nCols.join(', ')})
      VALUES ($1, ${placeholders})
      ON CONFLICT (country_id) DO UPDATE SET
        ${topCols.map((c) => `${c} = EXCLUDED.${c}`).join(', ')},
        ${nCols.map((c) => `${c} = EXCLUDED.${c}`).join(', ')}
    `;

    await db.query(sql, [cid, ...scoreVals, ...nVals]);
  }

  // 7) Write pillar_scores
  for (const [cid, ps] of pillarScores.entries()) {
    await db.query(
      `INSERT INTO pillar_scores (country_id, supply_score, demand_score, gap_score, gap_tier, n_supply_tops, n_demand_tops)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (country_id) DO UPDATE SET
         supply_score    = EXCLUDED.supply_score,
         demand_score    = EXCLUDED.demand_score,
         gap_score       = EXCLUDED.gap_score,
         gap_tier        = EXCLUDED.gap_tier,
         n_supply_tops   = EXCLUDED.n_supply_tops,
         n_demand_tops   = EXCLUDED.n_demand_tops`,
      [cid, ps.supply_score, ps.demand_score, ps.gap_score, ps.gap_tier, ps.n_supply_tops, ps.n_demand_tops]
    );
  }

  // 8) Diagnostic logging — check this after each run to sense-check the distribution.
  // If Benchmark is still too crowded, lower the 10 threshold toward 6-7.
  // If Severe is too sparse, lower that threshold from 50 toward 45.
  const gaps = [...pillarScores.values()].map((p) => p.gap_score).sort((a, b) => a - b);
  const pct = (p) => gaps[Math.floor((p / 100) * gaps.length)] ?? null;
  console.log('[compute_scores_to_db] gap distribution:',
    { min: gaps[0], p10: pct(10), p25: pct(25), p50: pct(50), p75: pct(75), p90: pct(90), max: gaps[gaps.length - 1] });
  const tierCounts = {};
  for (const ps of pillarScores.values()) {
    tierCounts[ps.gap_tier] = (tierCounts[ps.gap_tier] || 0) + 1;
  }
  console.log('[compute_scores_to_db] tier distribution:', tierCounts);
  console.log('[compute_scores_to_db] tier % of total:',
    Object.fromEntries(
      Object.entries(tierCounts).map(([k, v]) => [k, ((v / gaps.length) * 100).toFixed(1) + '%'])
    )
  );
}

module.exports = { main };
if (require.main === module) {
  main().then(() => {
    console.log('compute_scores_to_db done');
    process.exit(0);
  }).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}