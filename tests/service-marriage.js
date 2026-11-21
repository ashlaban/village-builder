// VB-634: service is by the year. The master's house is no home for a couple under any residence custom (homeFor gives none, matchBar
// says why); a servant marries at the round by leaving service; an offer out of the round refuses a servant; servedSince is kept with
// the servant flag.
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim, R = VB['sim/records'], H = VB['sim/heirs'];
const { matchRules, matchBar, kinOk } = VB['sim/matching'], { movingRound } = VB['sim/round'], { checkState } = require('./lib/invariants.js');
const assert = require('assert');
const world = (seed) => { const it = G.generate(seed, { cols: 120, rows: 85 }); let r; while (!(r = it.next()).done); return r.value; };
const roll = (st, f) => { const rs = new Set(Object.values(st.rng)); rs.forEach((r) => { r.fix = 0; }); try { f(); } finally { rs.forEach((r) => { delete r.fix; }); } };
const fresh = () => { const st = Sim.seed(world(7), 7, 'populous'); st.naturalDeaths = false; return st; };
const out = [];
// A first heir (a man living with grown kin) and an unmarried woman of his village, in another household.
function pair(st) {
  for (const h of st.households) {
    if (h.dissolved) continue;
    const r = VB['sim/heirranking'].heirRanking(st, h)[0], m = r !== undefined ? st.pawns[r] : null;
    if (!m || m.sex !== 'm' || m.age < 20 || m.household !== h.id || R.spouseOf(st, m.id) !== null || h.members.filter((id) => st.pawns[id].age >= 18).length < 2) continue;
    const v = R.settlementIdOf(st, m), cu = R.practice(st, v);
    const f = st.pawns.find((q) => q.alive && q.sex === 'f' && q.age >= 18 && q.household !== null && q.household !== h.id && R.spouseOf(st, q.id) === null && !R.isHolder(st, q.id)
      && H.placeIfMarried(st, q.id) === null && R.settlementIdOf(st, q) === v && kinOk(st, m.id, q.id, cu));
    if (f) return { m, f, h, v };
  }
  throw new Error('no pair');
}
// 1. Under each residence custom, two servants of two masters cannot marry into either master's house.
for (const residence of ['husband', 'wife', 'land']) {
  const st = fresh(), { m, f, v } = pair(st), cu = R.practice(st, v);
  cu.residence = residence;
  R.setServant(st, m.id, true); R.setServant(st, f.id, true);
  const rules = matchRules(st);
  assert.strictEqual(rules.homeFor(m, f, cu), null, `${residence}: no home for two servants`);
  const bar = matchBar(st, m.id, f.id, rules);
  assert(/in service: .* master's house is no home for a couple/.test(bar.why || ''), `${residence}: ${bar.why}`);
  out.push(`${residence}: ${bar.why}`);
}
// 2. A maid and a first heir marry at the round, and she leaves service.
for (const residence of ['husband', 'land']) {
  const st = fresh(), { m, f, v } = pair(st);
  R.practice(st, v).residence = residence;
  R.setServant(st, f.id, true);
  assert(typeof f.servedSince === 'number');
  for (const p of st.pawns) if (p.alive && p.id !== m.id && p.id !== f.id) p.hunger = 0.9;
  const hh = st.households[m.household]; hh.grain = { barley: 5000 }; hh.unthreshed = []; hh.larder = []; hh.meals = 0;
  roll(st, () => movingRound(st));
  assert.strictEqual(R.spouseOf(st, m.id), f.id, `${residence}: the maid and the heir marry`);
  assert(!f.servant && f.servedSince === null, `${residence}: she leaves service`);
  assert.strictEqual(f.household, m.household, `${residence}: she lives at his place`);
  const bad = checkState(st); assert(!bad.length, bad.slice(0, 3).join('; '));
  out.push(`${residence}: the maid marries the heir and leaves service`);
}
// 3. Out of the round, a servant is refused until the moving round; the round's own bar is unchanged.
{
  const st = fresh(), { m, f } = pair(st);
  R.setServant(st, f.id, true);
  const rules = matchRules(st);
  assert(/in service until the moving round/.test(matchBar(st, m.id, f.id, rules, 'offer').why || ''));
  assert(!/until the moving round/.test(matchBar(st, m.id, f.id, rules).why || ''));
  out.push('out-of-round bar: in service until the moving round');
}
// 4. servedSince is set on entering service, cleared on leaving.
{
  const st = fresh(), p = st.pawns.find((q) => q.alive && !q.servant);
  st.t = 12345; R.setServant(st, p.id, true); assert.strictEqual(p.servedSince, 12345);
  st.t = 20000; R.setServant(st, p.id, true); assert.strictEqual(p.servedSince, 12345);
  R.setServant(st, p.id, false); assert.strictEqual(p.servedSince, null);
  out.push('servedSince kept with servant');
}
console.log(out.join('\n'));
