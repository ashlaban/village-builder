// Marriage (VB-153, stability review): two holders may marry: the couple lives on one farm and the other passes on (to an heir who can keep
// it, a landless adult of its village, or it stands empty); a holder marries a spouse who is only first heir elsewhere, who leaves that line;
// and a couple marries only when the farm it will live on holds food above its seed for MARRIAGE.means years of its people and one more.
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim, R = VB['sim/records'], H = VB['sim/heirs'], { movingRound, killPawn } = VB['sim/lifecycle'];
const { checkState } = require('./lib/invariants.js');
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('MARRIAGE FAIL:', m); } };
const world = (seed) => { const it = G.generate(seed, { cols: 120, rows: 85 }); let r; while (!(r = it.next()).done); return r.value; };
const roll = (st, f) => { const r = st.rand; st.rand = () => 0; try { f(); } finally { st.rand = r; } }; // every chance comes up
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
  for (const hh of [a, b]) { hh.grain = grain; hh.unthreshed = []; hh.larder = []; hh.rations = 0; }
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
  const hh = st.households[man.household]; hh.grain = grain; hh.unthreshed = []; hh.larder = []; hh.rations = 0;
  roll(st, () => movingRound(st));
  if (grain) check(R.spouseOf(st, man.id) === woman.id, 'with food in store the heir marries');
  else {
    check(R.spouseOf(st, man.id) === null, 'with an empty store the heir does not marry');
    check(st.events.some((e) => /put off marrying/.test(e.text)), 'the log says they put it off');
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
  b.grain = 1000;
  roll(st, () => movingRound(st));
  check(R.spouseOf(st, man.id) === woman.id && man.household === b.id && b.holder === woman.id, `they live on her farm (${st.farmsteads[b.farmstead].name})`);
  check(H.heirRanking(st, c)[0] !== man.id, 'he is no longer first heir of his own family\'s farm');
}
if (failed) process.exit(1);
console.log('marriage ok');
