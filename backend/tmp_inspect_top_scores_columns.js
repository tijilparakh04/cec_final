const db = require('./db');

(async () => {
  const q = `
    select column_name
    from information_schema.columns
    where table_name = $1
      and table_schema = $2
      and (column_name like '%_score' or column_name like '%_n_inds')
    order by ordinal_position
  `;

  const { rows } = await db.query(q, ['top_scores', 'public']);
  console.log(rows.map(r => r.column_name));

  await db.end();
})().catch(async (e) => {
  console.error(e);
  try { await db.end(); } catch {}
  process.exit(1);
});

