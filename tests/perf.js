// Speed of a populous medium map (seed 7) after 2 years: ms per game day, the moving round and the meetings. Not part of either suite.
const VB = require('../src/load.js');
const G = VB.gen, Sim = VB.sim;
const it = G.generate(7, { cols: 280, rows: 200 }); let r; while (!(r = it.next()).done);
const st = Sim.seed(r.value, 7, 'populous'), ms = (f) => { const t = Date.now(); f(); return Date.now() - t; };
if (process.argv.includes('--counter-cost')) {
  Sim.advance(st, Sim.YEAR);
  VB.resetCounts();
  Sim.advance(st, Sim.YEAR);
  const perDay = Object.fromEntries(Object.entries(VB.count).map(([k, n]) => [k, n / Sim.YEAR_DAYS]));
  // These are exactly the counters fed by per-iteration local tallies. walkDaily includes bulk pawn walks too,
  // so treating all its work as local increments is conservative.
  const localNames = ['routeExpand', 'talkWeighed', 'contactPairs', 'walkDaily', 'walkTies', 'roundPairs'];
  const localIncrementsPerDayBound = localNames.reduce((n, k) => n + perDay[k], 0);
  // Direct increments + one routeExpand publication per search; hourly contacts/talk, 240 six-minute steps,
  // at most eight daily publications and two round publications (overestimated as daily).
  const publicationsPerDayBound = perDay.routeSearch * 2 + perDay.routeHit + perDay.heirRank + perDay.ruleValue + 24 * 2 + 240 + 8 + 2;
  const additionsPerDayBound = localIncrementsPerDayBound + publicationsPerDayBound;
  const assumedNsPerAddition = 5, referenceMsPerDay = 120;
  const estimatedMsPerDayBound = additionsPerDayBound * assumedNsPerAddition / 1e6;
  console.log(JSON.stringify({ perDay, localIncrementsPerDayBound, publicationsPerDayBound, additionsPerDayBound,
    assumedNsPerAddition, referenceMsPerDay, estimatedMsPerDayBound,
    estimatedPercentBound: 100 * estimatedMsPerDayBound / referenceMsPerDay,
    note: 'Operation counts are deterministic; time bound assumes 5 ns per addition, not a measured timing guarantee.' }));
  return;
}
const adv = ms(() => Sim.advance(st, 2 * Sim.YEAR));
const round = ms(() => Sim.movingRound(st)), meet = ms(() => Sim.holdMeetings(st));
console.log(`populous medium seed 7, ${st.pawns.filter((p) => p.alive).length} alive of ${st.pawns.length}: ${(adv / (2 * Sim.YEAR_DAYS)).toFixed(1)} ms/day, ` +
  `moving round ${round} ms, meetings ${meet} ms`);
// The animals' share (VB-134): the same year with and without herds, meadows and hay, from the same seed; the difference is what the herds,
// haymaking, the byre and their jobs cost (their indirect effects included). Budget: 10 ms a game day.
function yearCost(animals) {
  const it2 = G.generate(7, { cols: 280, rows: 200 }); let r2; while (!(r2 = it2.next()).done);
  const s2 = Sim.seed(r2.value, 7, 'populous');
  if (!animals) { for (const h of s2.households) { h.herds = []; h.hay = 0; } s2.herds = []; for (const f of s2.farmsteads) f.meadows = []; }
  Sim.advance(s2, Sim.YEAR); // warm
  return ms(() => Sim.advance(s2, Sim.YEAR)) / Sim.YEAR_DAYS;
}
const withA = yearCost(true), without = yearCost(false);
console.log(`animals: ${withA.toFixed(1)} ms/day with them, ${without.toFixed(1)} without, ${(withA - without).toFixed(1)} ms/day for the animals (budget 10)`);
