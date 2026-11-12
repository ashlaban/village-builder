// Marriage (VB-153, stability review): two holders may marry: the couple lives on one farm and the other passes on (to an heir who can keep
// it, a landless adult of its village, or it stands empty); a holder marries a spouse who is only first heir elsewhere, who leaves that line;
// and a couple marries only when the farm it will live on holds food above its seed for MARRIAGE.means years of its people and one more.
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim, R = VB['sim/records'], H = VB['sim/heirs'], { movingRound, killPawn } = VB['sim/lifecycle'];
const { checkState } = require('./lib/invariants.js');
const assert = require('assert');
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('MARRIAGE FAIL:', m); } };
const world = (seed) => { const it = G.generate(seed, { cols: 120, rows: 85 }); let r; while (!(r = it.next()).done); return r.value; };
const roll = (st, f) => { const rs = new Set(Object.values(st.rng)); rs.forEach((r) => { r.fix = 0; }); try { f(); } finally { rs.forEach((r) => { delete r.fix; }); } }; // every chance comes up
// Populous tiny at seed 7, natural deaths off: the holders of the first two households of the first village with an unmarried pair of
// holders' sexes, each left alone (housemates die) and widowed; every other single adult is kept from marrying (hungry).
function setUp(grain) {
  const st = Sim.seed(world(7), 7, 'populous'); st.naturalDeaths = false;
  const hhs = st.households.filter((h) => !h.dissolved);
  const a = hhs.find((h) => st.pawns[h.holder].sex === 'm'), b = hhs.find((h) => st.pawns[h.holder].sex === 'f' || R.spouseOf(st, h.holder) !== null && h !== a);
  const woman = st.pawns[b.holder].sex === 'f' ? b.holder : R.spouseOf(st, b.holder);
  if (st.pawns[b.holder].sex !== 'f') { killPawn(st, b.holder, 'illness'); } // the wife keeps the farm
  for (const hh of [a, b]) for (const id of [...hh.members]) if (id !== hh.holder) killPawn(st, id, 'illness');
  for (const p of st.pawns) if (p.alive && p.id !== a.holder && p.id !== b.holder) p.hunger = 0.9;
  for (const hh of [a, b]) { hh.grain = { barley: grain }; hh.unthreshed = []; hh.larder = []; hh.meals = 0; }
  return { st, a, b, man: st.pawns[a.holder], woman: st.pawns[woman] };
}
// 1. Two holders, each alone, with food: they marry, live on one of the farms, and the other passes on; nobody holds two farms.
{
  const { st, a, b, man, woman } = setUp(1000);
  check(a.members.length === 1 && b.members.length === 1 && b.holder === woman.id, 'setup: two lone holders');
  roll(st, () => movingRound(st));
  const home = man.household;
  check(R.spouseOf(st, man.id) === woman.id && woman.household === home && [a.id, b.id].includes(home), 'the two holders marry and live together');
  const other = home === a.id ? b : a;
  check(other.dissolved || (other.holder !== man.id && other.holder !== woman.id), `the other farm passes on (holder ${other.holder}, dissolved ${other.dissolved})`);
  check(st.households.filter((h) => !h.dissolved && (h.holder === man.id || h.holder === woman.id)).length === 1, 'they hold one farm');
  const bad = checkState(st); check(!bad.length, `invariants: ${bad.slice(0, 3).join('; ')}`);
}
// 2a. Two lone holders with no food in store still marry: a home with fewer than two adults needs the spouse's hands, not the means.
{
  const { st, man } = setUp(0);
  roll(st, () => movingRound(st));
  check(R.spouseOf(st, man.id) !== null, 'lone holders marry with an empty store');
}
// 2b. A first heir who lives with grown kin and an unmarried woman of his village: with no food in store they put it off, and the log says so;
// with food, they marry.
for (const grain of [0, 5000]) {
  const st = Sim.seed(world(7), 7, 'populous'); st.naturalDeaths = false;
  let man = null, woman = null;
  for (const h of st.households) {
    const r = H.heirRanking(st, h)[0], p = r !== undefined ? st.pawns[r] : null;
    if (!p || p.sex !== 'm' || p.age < 20 || p.household !== h.id || R.spouseOf(st, p.id) !== null) continue;
    if (h.members.filter((id) => st.pawns[id].age >= 18).length < 2) continue;
    const cu = R.practice(st, R.settlementIdOf(st, p));
    woman = st.pawns.find((q) => q.alive && q.sex === 'f' && q.age >= 18 && R.spouseOf(st, q.id) === null && !R.isHolder(st, q.id)
      && H.placeIfMarried(st, q.id) === null && R.settlementIdOf(st, q) === R.settlementIdOf(st, p) && VB['sim/lifecycle'].kinOk(st, p.id, q.id, cu));
    if (woman) { man = p; break; }
  }
  if (!man) { console.error('MARRIAGE FAIL: no first heir living with grown kin'); process.exit(1); }
  for (const p of st.pawns) if (p.alive && p.id !== man.id && p.id !== woman.id) p.hunger = 0.9;
  const hh = st.households[man.household]; hh.grain = { barley: grain }; hh.unthreshed = []; hh.larder = []; hh.meals = 0;
  roll(st, () => movingRound(st));
  if (grain) check(R.spouseOf(st, man.id) === woman.id, 'with food in store the heir marries');
  else {
    check(R.spouseOf(st, man.id) === null, 'with an empty store the heir does not marry');
    check(Sim.villageLog(st, Infinity).some((e) => /put off marrying/.test(e.text)), 'the log says they put it off');
  }
}
// 3. A lone holder and the first heir of another farm of her village: they live on her farm, and he leaves the line of his own.
{
  const st = Sim.seed(world(7), 7, 'populous'); st.naturalDeaths = false;
  const vOf = (p) => R.settlementIdOf(st, p);
  let b = null, man = null, c = null;
  for (const h of st.households) {
    const w = st.pawns[h.holder].sex === 'f' ? st.pawns[h.holder] : R.spouseOf(st, h.holder) !== null ? st.pawns[R.spouseOf(st, h.holder)] : null;
    if (!w) continue;
    const cu = R.practice(st, vOf(w));
    c = st.households.find((o) => {
      const r = H.heirRanking(st, o)[0], p = r !== undefined ? st.pawns[r] : null;
      return o !== h && p && p.sex === 'm' && p.age >= 20 && p.household === o.id && R.spouseOf(st, p.id) === null
        && VB['sim/lifecycle'].kinOk(st, p.id, w.id, cu) && vOf(p) === vOf(w); // the same village, so the match scores above MARRIAGE.minScore
    });
    if (c) { b = h; man = st.pawns[H.heirRanking(st, c)[0]]; break; }
  }
  if (!c) { console.error('MARRIAGE FAIL: no unmarried first heir in a village with a married woman'); process.exit(1); }
  if (st.pawns[b.holder].sex !== 'f') killPawn(st, b.holder, 'illness'); // the wife keeps the farm
  for (const id of [...b.members]) if (id !== b.holder) killPawn(st, id, 'illness');
  const woman = st.pawns[b.holder];
  for (const p of st.pawns) if (p.alive && p.id !== man.id && p.id !== woman.id) p.hunger = 0.9;
  b.grain = { barley: 1000 };
  roll(st, () => movingRound(st));
  check(R.spouseOf(st, man.id) === woman.id && man.household === b.id && b.holder === woman.id, `they live on her farm (${st.farmsteads[b.farmstead].name})`);
  check(H.heirRanking(st, c)[0] !== man.id, 'he is no longer first heir of his own family\'s farm');
}
// Compare the round's dependency cache with independent, uncached rankings across real commands.
// Chosen birth order reads residence, and 'keeps' reads competing farms' holders and first heirs.
for (const order of ['eldest', 'youngest', 'chosen']) for (const ownHeir of ['behind', 'keeps']) {
  const st = require('./scaling.js').villageWorld(4), C = VB.culture;
  for (const [key, value] of [['birthOrder', order], ['ownHeir', ownHeir]]) {
    const dim = C.IDX[key], option = C.DIMS[dim].opts.findIndex((o) => o[0] === value);
    assert(option >= 0, `${key}.${value} must exist`);
    for (const v of st.villages) if (st.cenv.settlements[v.id].practice[dim] !== option) {
      assert.strictEqual(Sim.command(st, { actor: { settlement: v.id }, verb: 'decide', args: { dim, option }, source: 'round' }), true);
    }
  }
  const view = H.roundHeirs(st);
  const compare = () => {
    for (const h of st.liveHouseholds) assert.deepStrictEqual(view.rank(h), H.heirRanking(st, st.households[h]),
      `cached heirs differ at household ${h}, ${order}/${ownHeir}`);
  };
  compare();
  const change = (cmd) => {
    const before = st.pawns.map((p) => [p.household, R.spouseOf(st, p.id), R.holdingOf(st, p.id)?.id]);
    const houses = st.households.map((h) => [h.members, h.holder, h.dissolved]);
    assert.strictEqual(Sim.command(st, cmd), true);
    const people = new Set(st.pawns.filter((p) => {
      const now = [p.household, R.spouseOf(st, p.id), R.holdingOf(st, p.id)?.id];
      return now.some((v, i) => v !== before[p.id][i]);
    }).map((p) => p.id));
    const dirty = new Set(st.households.filter((h) => {
      const old = houses[h.id]; return h.members !== old[0] || h.holder !== old[1] || h.dissolved !== old[2];
    }).map((h) => h.id));
    view.invalidate(people, dirty); compare();
  };
  const m = st.households[0].members[2], f = st.households[1].members[3];
  change({ actor: m, verb: 'marry', target: f, args: { home: 1 }, source: 'round' });
  change({ actor: st.households[1].holder, verb: 'handOn', target: f,
    args: { household: 1, reason: 'marriage' }, source: 'round' });
  const cached = view.rank(10), rankBefore = VB.count.heirRank;
  assert.strictEqual(view.rank(10), cached);
  assert.strictEqual(VB.count.heirRank, rankBefore, 'an unchanged household must reuse its ranking');
}
// An empty family ranking needs no global direct-claim scan.
{
  const st = require('./scaling.js').villageWorld(2), hh = st.households[0];
  const cu = R.farmPractice(st, st.farmsteads[hh.farmstead]);
  // Leave the household's lineage with no eligible heirs without changing global kin indexes.
  for (const p of st.pawns) if (p.id !== hh.holder) { p.died = st.t; p.alive = false; }
  VB.resetCounts();
  assert.deepStrictEqual(H.heirRanking(st, hh, cu), []);
  assert.strictEqual(VB.count.heirRank, 1, 'empty ranks must not rank other households');
}
if (failed) process.exit(1);
console.log('marriage ok');
