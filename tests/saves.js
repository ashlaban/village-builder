// Saves (VB-074): a run saved, written as JSON text, parsed and loaded into a fresh world goes on exactly as the run that was never saved:
// every key of the state (the world aside) has the same canonical text, and the tiles the simulation changes are the same. On small
// islands since VB-853: each scenario on a generated island loaded into one generated again from the save's seed and size, and the probe
// village saved mid-hour and mid-day; the long runs on the default and tiny maps it replaced were deleted (length is not a rule).
const VB = require('../src/load.js'), Sim = VB.sim;
const { canon } = require('./lib/canon.js');
const probe = require('./lib/probe.js');
const TILES = ['trees', 'treesMax', 'stones', 'biome', 'dev', 'wear', 'worn', 'tr', 'tg', 'tb'];
const { YEAR: Y, DAY } = Sim;
let failed = 0; const out = [];
const regenerate = (data) => probe.island(data.seed, data);
// [label, the state, its world again from the save, hours before the save, hours after]. The founders are saved in early autumn and run on
// across the autumn meetings and the moving round; heirs and populous a few days in, their seeded history and herds already in play; the
// probe's two (which spread.js also saves between the phases of the meetings and the round) are saved mid-hour, when
// the idle pawns of the hour were drawn earlier in it (st.idlers), the second mid-day, between talk turns (VB-521). Both runs make the
// same advance calls after the save: steps of 6 minutes add up differently in other chunks.
for (const [label, make, restore, before, after] of [
  ['founders 42', () => probe.scenario('founders', 42), regenerate, 0.6 * Y, 0.25 * Y],
  ['heirs 7', () => probe.scenario('heirs', 7), regenerate, 5 * DAY + 14.3, 5 * DAY],
  ['populous 7', () => probe.scenario('populous', 7), regenerate, 10 * DAY + 7.2, 5 * DAY],
  ['the probe at night', probe.state, probe.world, 10 * DAY + 0.7, 3 * DAY],
  ['the probe mid-day', probe.state, probe.world, 10 * DAY + 10.5, 3 * DAY],
]) {
  const st = make();
  Sim.advance(st, before);
  const text = JSON.stringify(Sim.save(st));
  Sim.advance(st, after); // the run that was never saved
  const data = JSON.parse(text), back = Sim.load(restore(data), data);
  Sim.advance(back, after);
  const bad = [];
  for (const k of new Set([...Object.keys(st), ...Object.keys(back)])) if (k !== 'w' && canon(st[k]) !== canon(back[k])) bad.push(k);
  for (const k of TILES) if (canon(st.w[k]) !== canon(back.w[k])) bad.push('w.' + k);
  if (bad.length) { failed++; console.error(`SAVES FAIL: ${label}, saved after ${before} h, ${after} h more: ${bad.join(', ')} differ`); }
  out.push(`${label} ${(text.length / 1024).toFixed(0)} KB`);
}
{ // VB-259: a save from before the cooked store was named meals (format 2, hh.rations) is refused, as any other build's
  const st = probe.state(), data = JSON.parse(JSON.stringify(Sim.save(st)));
  // and one from before the climate and the basins' rivers changed every seed's island (format 3, VB-342)
  for (const old of [2, 3]) {
    data.format = old;
    let why = null; try { Sim.load(probe.world(), data); } catch (e) { why = e.message; }
    if (!new RegExp(`format ${old}, this build reads 4`).test(why || '')) { failed++; console.error(`SAVES FAIL: a format-${old} save was not refused (${why})`); }
  }
}
{ // VB-783: a save made before the stays, with an open journey (st.journeys, st.journeySeq; its provisions' kind 'journey'), loads it as a
  // stay away whose bed is where its leg ends, indexed by its pawn's agent.away, and plays on as the save made today
  const { tinyWorld, tinyState } = require('./lib/tiny.js');
  const world = () => tinyWorld(Array(9).fill('.'.repeat(180)), { seed: 7 });
  const st = tinyState(world(), [{ at: [6, 4], farms: 1, sizes: [5] }, { at: [172, 4], farms: 1, sizes: [5] }], { seed: 7 });
  Sim.advance(st, 15 - (st.t % DAY) + DAY);
  const left = st.households[1], bride = left.members.find((id) => id !== left.holder && st.pawns[id].age >= 14);
  VB['sim/stores'].put(st, left, 'grain', 50, 'harvest', { barley: 50 });
  VB['sim/commands'].issue(st, { actor: bride, verb: 'move', target: st.households[0].id, args: { reason: 'home' }, source: 'debug' });
  Sim.advance(st, 2);
  const now = JSON.parse(JSON.stringify(Sim.save(st))), s = Sim.load(world(), JSON.parse(JSON.stringify(now)));
  s.journeys = s.away.map(({ bed, roof, ...j }) => j); // the state as it was saved before VB-783
  s.journeySeq = s.awaySeq;
  delete s.away;
  delete s.awaySeq;
  for (const x of s.agents) delete x.away;
  for (const hh of s.households) for (const e of hh.ledger || []) if (e.kind === 'away') e.kind = 'journey';
  const old = JSON.parse(JSON.stringify(Sim.save(s)));
  const a = Sim.load(world(), now), b = Sim.load(world(), old);
  const ok = b.away.length === 1 && b.away[0].bed === null && b.away[0].roof === 'none' && b.agents[bride].away === b.away[0].id &&
    !('journeys' in b) && b.awaySeq === a.awaySeq && b.households[1].ledger.some((e) => e.kind === 'away');
  for (const x of [a, b]) Sim.advance(x, 2 * DAY);
  const bad = ['away', 'awaySeq', 'agents', 'pawns', 'households'].filter((k) => canon(a[k]) !== canon(b[k]));
  if (!ok || bad.length) { failed++; console.error(`SAVES FAIL: a save's journey loads as a stay (${ok}), and plays on alike (${bad.join(', ')} differ)`); }
  out.push('an old save\'s journey as a stay');
}
if (failed) process.exit(1);
console.log(`saves ok: saved, loaded into a new world and advanced, each run matches the unbroken one (${out.join(', ')})`);
