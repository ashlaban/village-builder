// Digging (VB-359, sim/dig): clay and bog iron, a load a trip of 3 hours, carried home into the household's store through the ledger
// (sim/stores dug, reason 'dig'); only up to 4 loads of each; the nearest tile within 12 walking steps of the household's own land, its
// village's outland or wilderness, searched when the want opens and kept; an endless tile stays endless; bog iron regains a load a year up
// to its first amount, clay nothing; a save keeps the tiles and the stores, and one without them loads with none dug.
// Populous at seed 8 on the small island of tests/lib/probe.js (VB-855), half a year: households dig and the state keeps its invariants.
const VB = require('../src/load.js'), Sim = VB.sim, { island } = require('./lib/probe.js'), D = VB['sim/dig'], Stores = VB['sim/stores'];
const trip = require('./lib/trip.js');
const { KINDS, ASK } = VB['sim/kinds'], { DAY, YEAR } = VB['sim/rules'], { MATCH } = VB['sim/roles'];
const { checkState } = require('./lib/invariants.js');
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('DIG FAIL:', m); } };
const world = (seed) => island(seed), SEED = 8; // at 42 the small island has no bog iron (VB-855)
const { DIG } = D, { DEPOSIT, ENDLESS } = VB['world/geology'];

// --- the kind
const K = KINDS.dig;
check(K === D.KIND && K.type === 'upkeep' && K.hands === 1 && K.hours === 3 && K.carry && K.to, 'dig: upkeep, 1 hand, 3 hours, carried home');
check(K.urgency(null, { good: 'clay' }, null, MATCH.urgency) === MATCH.urgency.repair, 'dig weighs as the house\'s upkeep: done in the slack');
check(ASK.farmAfterPlans.some((e) => e[0] === 'dig'), 'dig is asked at the farm');
check(DIG.reach === 12 && DIG.stock === 4 && DIG.regrow === 1, 'reach 12, stock 4, regrowth 1 a year');

const w = world(SEED), st = Sim.seed(w, SEED, 'populous');
const live = st.liveHouseholds.map((id) => st.households[id]);
check(live.every((hh) => hh.clay === 0 && hh.bogOre === 0), 'a new household holds no clay and no bog iron ore');
// a household with clay in reach, and one with bog iron
const posts = (hh) => { const f = st.farmsteads[hh.farmstead], out = []; K.available(st, hh, f, null, (key, site, extra) => out.push({ key, site, ...extra })); return out; };
const withGood = (good) => live.find((hh) => { hh.digAt = undefined; const p = posts(hh); return p.length && p[0].good === good; });
const hc = withGood('clay');
check(!!hc, `a household at seed ${SEED} has clay in reach`);
if (hc) {
  const f = st.farmsteads[hc.farmstead], [p] = posts(hc), t = p.site, before = w.depositLeft[t];
  check(w.deposit[t] === DEPOSIT.CLAY && D.mayDig(st, hc, f, t), 'the job is on a clay tile the household may dig');
  check(p.key === `dig:h${hc.id}:${t}` && p.farm === f, 'the key names the household and the tile');
  // the nearest: no clay tile it may dig is fewer steps from the house
  const { dist } = VB['sim/hex'].bfs(w, f.house, DIG.reach, (j) => VB['sim/walking'].passable(w, j));
  check(dist.has(t) && [...dist].every(([i, d]) => d >= dist.get(t) || w.deposit[i] !== DEPOSIT.CLAY || !D.mayDig(st, hc, f, i) || !D.left(st, i)),
    'the tile is the nearest clay the household may dig');
  // the search is kept: asked again, it does not search
  VB.count.digGround = 0; posts(hc); posts(hc);
  check(VB.count.digGround === 0, `asked again, the household searched ${VB.count.digGround} tiles`);
  // a load dug and carried home
  const j = { kind: 'dig', site: t, good: 'clay', farm: f, owner: { type: 'household', id: hc.id } };
  st.t += DAY; trip(K, st, j, hc, f);
  check(w.depositLeft[t] === before - 1 && hc.clay === 1, `a load: the tile ${before} -> ${w.depositLeft[t]}, the store ${hc.clay}`);
  const e = hc.ledger[hc.ledger.length - 1];
  check(e.kind === 'dig' && e.good === 'clay' && e.n === 1, `through the ledger: ${JSON.stringify(e)}`);
  check(w.depositFull[t] === before && w.dugDay[t] === Math.floor(st.t / DAY) + 1, 'its first amount and the day are kept');
  // clay does not grow back
  st.t += 3 * YEAR;
  check(D.left(st, t) === before - 1, 'clay grows nothing back');
  // the stock: at 4 loads of each, nothing is posted, and a load carried home then is not taken
  const was = [hc.clay, hc.bogOre];
  hc.clay = DIG.stock; hc.bogOre = DIG.stock;
  check(posts(hc).length === 0, 'a household with 4 loads of each posts no digging');
  const left = w.depositLeft[t]; trip(K, st, j, hc, f);
  check(hc.clay === DIG.stock && w.depositLeft[t] === left, 'a load at the stock is not dug');
  hc.clay = was[0]; hc.bogOre = was[1];
  // a spent tile keeps its kind, and the ground moves on
  w.depositLeft[t] = 1; trip(K, st, j, hc, f);
  check(w.depositLeft[t] === 0 && w.deposit[t] === DEPOSIT.CLAY, 'a spent tile keeps its deposit');
  const next = posts(hc);
  check(!next.some((q) => q.site === t), 'a spent tile is not dug again');
  const got = hc.clay; trip(K, st, j, hc, f);
  check(hc.clay === got, 'a load from a spent tile is none');
  // an endless tile stays endless
  w.depositLeft[t] = ENDLESS; trip(K, st, j, hc, f);
  check(w.depositLeft[t] === ENDLESS && D.left(st, t) === ENDLESS && hc.clay === got + 1, 'an endless tile gives a load and stays endless');
  w.depositLeft[t] = 0; // back as it was (no dug tile is made endless)
}
// bog iron grows back a load a year up to its first amount
const bog = w.deposit.findIndex((k, i) => k === DEPOSIT.BOG_IRON && w.depositLeft[i] < ENDLESS);
check(bog >= 0, `seed ${SEED} has bog iron`);
if (bog >= 0) {
  const n0 = w.depositLeft[bog];
  for (let k = 0; k < 3; k++) D.digLoad(st, bog);
  check(D.left(st, bog) === n0 - 3, 'three loads dug');
  st.t += YEAR; check(D.left(st, bog) === n0 - 2, `a year on: ${D.left(st, bog)}, not ${n0 - 2}`);
  st.t += YEAR / 2; check(D.left(st, bog) === n0 - 2, 'no part of a load before the year is out');
  st.t += 5 * YEAR; check(D.left(st, bog) === n0, `years on: back to its first amount ${n0}, not ${D.left(st, bog)}`);
  D.digLoad(st, bog);
  check(D.left(st, bog) === n0 - 1 && w.depositFull[bog] === n0, 'dug again from what grew back; its first amount kept');
}
// a household with no deposit in reach posts nothing, and does not search again that year
{
  const hh = live[0], deposit = w.deposit;
  w.deposit = new Uint8Array(w.N); hh.digAt = undefined;
  check(posts(hh).length === 0 && hh.digAt.clay === -1 && hh.digAt.bogOre === -1, 'no deposit in reach: no job');
  VB.count.digGround = 0; posts(hh);
  check(VB.count.digGround === 0, 'nothing in reach is not searched again within the year');
  w.deposit = deposit; hh.digAt = undefined;
}
// the stores and the tiles keep their invariants (the clock was moved by hand, so the rest of the state is not asked)
{ const bad = checkState(st).filter((m) => /clay|bogOre|digAt|deposit|ledger/.test(m)); check(bad.length === 0, 'invariants: ' + bad.slice(0, 3).join('; ')); }

// --- a save keeps the tiles and the stores; one without them loads with none dug
if (hc && bog >= 0) {
  const data = JSON.parse(JSON.stringify(Sim.save(st)));
  const st2 = Sim.load(world(SEED), data), w2 = st2.w;
  check(['depositLeft', 'depositFull', 'dugDay'].every((k) => w2[k] && w2[k].every((x, i) => x === w[k][i])), 'a save keeps the dug tiles');
  check(st2.households[hc.id].clay === hc.clay && D.left(st2, bog) === D.left(st, bog), 'and the stores and the bog iron grown back');
  const old = JSON.parse(JSON.stringify(data));
  for (const k of ['depositLeft', 'depositFull', 'dugDay']) delete old.world[k];
  const fresh = world(SEED), st3 = Sim.load(world(SEED), old);
  check(!st3.w.dugDay && st3.w.depositLeft.every((x, i) => x === fresh.depositLeft[i]), 'an older save: no tile dug');
}

// --- a year of populous: households dig, nothing beyond the stock, the state keeps its invariants
{
  const s = Sim.seed(world(SEED), SEED, 'populous');
  Sim.advance(s, YEAR / 2);
  const hhs = s.liveHouseholds.map((id) => s.households[id]), diggers = hhs.filter((hh) => hh.clay + hh.bogOre > 0);
  check(diggers.length > 0, 'in half a year some household digs');
  check(hhs.every((hh) => hh.clay <= DIG.stock && hh.bogOre <= DIG.stock), 'no household holds more than the stock');
  const bad = checkState(s);
  check(bad.length === 0, 'invariants after half a year: ' + bad.slice(0, 3).join('; '));
  console.log(`dig ok: ${diggers.length} of ${hhs.length} households dug in half a year, ${hhs.reduce((n, hh) => n + hh.clay, 0)} loads of clay, `
    + `${hhs.reduce((n, hh) => n + hh.bogOre, 0)} of bog iron ore`);
}
if (failed) { console.error(`dig: ${failed} failed`); process.exit(1); }
