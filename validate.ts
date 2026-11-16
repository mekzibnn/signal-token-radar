// Validate generated research data before it becomes the submitted artifact.
export function validateBoard(rows:any[], snapshot:any) {
  if (!Array.isArray(rows)) throw new Error('Board is not an array');
  if (rows.length < 100 || rows.length > 4000) {
    throw new Error('Board must hold 100 to 4000 protocols');
  }
  const known = new Set(snapshot.protocols.map((p:any) => p.slug));
  const seen = new Set<string>();
  const ranks = new Set<number>();
  let lastValue = Infinity;
  for (const row of rows) {
    if (!known.has(row.slug)) {
      throw new Error('Unknown protocol: ' + row.slug);
    }
    if (seen.has(row.slug)) {
      throw new Error('Duplicate protocol: ' + row.slug);
    }
    seen.add(row.slug);
    if (typeof row.name !== 'string' || !row.name.trim()) {
      throw new Error('Missing protocol name: ' + row.slug);
    }
    if (!Number.isInteger(row.rank) || row.rank < 1 || row.rank > rows.length) {
      throw new Error('Invalid rank: ' + row.slug);
    }
    if (ranks.has(row.rank)) {
      throw new Error('Duplicate rank: ' + row.rank);
    }
    ranks.add(row.rank);
    const value = row.implied_value_usd;
    if (!Number.isSafeInteger(value) || value <= 0 || value > 100_000_000_000_000) {
      throw new Error('Invalid implied value: ' + row.slug);
    }
    if (value > lastValue) {
      throw new Error('Values do not descend by rank');
    }
    lastValue = value;
    if (!Array.isArray(row.farm_steps)) {
      throw new Error('Missing farm plan: ' + row.slug);
    }
    if (row.farm_steps.length < 3 || row.farm_steps.length > 12) {
      throw new Error('Farm plan step count: ' + row.slug);
    }
    for (const step of row.farm_steps) {
      if (typeof step !== 'string' || step.trim().length < 20 || step.trim().length > 600) {
        throw new Error('Farm plan step length: ' + row.slug);
      }
    }
    for (const key of ['multiple']) {
      if (!Number.isFinite(row[key]) || row[key] <= 0) {
        throw new Error('Invalid model factor: ' + row.slug + '/' + key);
      }
    }
    if (!Number.isFinite(row.low_usd) || !Number.isFinite(row.high_usd) || row.low_usd <= 0 || row.high_usd < row.low_usd || row.implied_value_usd < row.low_usd || row.implied_value_usd > row.high_usd) {
      throw new Error('Invalid bootstrap band: ' + row.slug);
    }
    if (!Number.isFinite(row.net_usd) || !Number.isFinite(row.gas_total_usd) || !Number.isFinite(row.reward_scenario_usd)) {
      throw new Error('Invalid farm economics: ' + row.slug);
    }
    if (!Number.isFinite(row.net_per_hour_usd) || !Number.isFinite(row.break_even_farmers) || row.break_even_farmers < 0 || !Number.isFinite(row.break_even_odds) || row.break_even_odds < 0 || row.break_even_odds > 1) {
      throw new Error('Invalid farm robustness: ' + row.slug);
    }
    if (!['farm', 'thin', 'skip'].includes(row.verdict)) {
      throw new Error('Invalid farm verdict: ' + row.slug);
    }
  }
  for (const slug of snapshot.watchlist) {
    if (!seen.has(slug)) throw new Error('Watchlist omitted: ' + slug);
  }
  if (rows[0].implied_value_usd === rows.at(-1).implied_value_usd) {
    throw new Error('All valuations are identical');
  }
}
