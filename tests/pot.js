// The pot and fresh food (VB-119; design.md, Meals and Mixed meals): fish and gathered food are fresh, held in batches by day and lost past
// their 3 days, read when the store is next touched; the cook makes the next day's meals from fresh food, oldest first, then grain; a pot
// of 2 sources (each at least a fifth) goes 10% further, of 3 or more 20%; with no meals a household eats gathered food as it is and then
// grain uncooked, 1.25 rations of grain for a ration of need; a cook at work at the end of work finishes the pot.
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim, Pot = VB['sim/pot'];
const { FOODS, ECON, DAY, WORK } = VB['sim/rules'], { dailyNeed, feedHousehold } = VB['sim/hunger'], { KINDS } = VB['sim/kinds'];
const { moveClock } = require('./lib/clock.js'), { checkState } = require('./lib/invariants.js');
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('POT FAIL:', m); } };
const near = (a, b, e = 1e-6) => Math.abs(a - b) < e;
const it = G.generate(7); let r; while (!(r = it.next()).done);
// a household with no larder, fields growing (no seed held back), no project plan, and a known store
function home(grain = 1000) {
  const st = Sim.seed(r.value, 7, 'founders'), hh = st.households[0], f = st.farmsteads[hh.farmstead];
  for (const fd of f.fields) fd.stage = 'growing';
  VB['sim/plans'].dropAll(st, 'household', hh.id);
  hh.larder = []; hh.meals = 0; hh.grain = { barley: grain }; hh.hungryDays = 0;
  return { st, hh };
}
const grain = (hh) => Sim.grainOf(hh);
const spoiled = (hh, food) => hh.totals.filter((x) => x.kind === 'spoilage' && x.good === food).reduce((s, x) => s - x.n, 0);

// --- the table
check(FOODS.fish.keeps === 3 && FOODS.fish.source === 'fish' && FOODS.fish.held === 'fresh' && !FOODS.fish.raw, 'fish: fresh, 3 days, cooked');
check(FOODS.gathered.keeps === 3 && FOODS.gathered.source === 'gathered' && FOODS.gathered.held === 'fresh' && FOODS.gathered.raw,
  'gathered food: fresh, 3 days, may be eaten as it is');
check(FOODS.grain.source === 'grain' && FOODS.meat.held === 'larder' && FOODS.milk.held === 'larder' && FOODS['dried fish'].source === 'fish',
  'grain one source; milk and meat in the larder; dried fish the source fish');
check(ECON.pot[2] === 0.9 && ECON.pot[3] === 0.8 && ECON.potShare === 0.2, 'pots of 2 and 3 sources: 0.9 and 0.8 of the food; a source at a fifth');

// --- grain only, and grain with fish at a quarter of the pot, 12 days: the second uses 10% less food
function run(fishShare) {
  const { st, hh } = home(), need = dailyNeed(st, hh), g0 = grain(hh);
  let fish = 0, sources = 0;
  for (let d = 0; d < 12; d++) {
    if (fishShare) { const n = fishShare * 0.9 * need; Pot.putFresh(st, hh, 'fish', n, 'catch'); fish += n; }
    sources = Pot.pot(st, hh, need - hh.meals); feedHousehold(st, hh); moveClock(st, DAY);
  }
  check(hh.hungryDays === 0 && near(hh.meals, 0, 1e-6), `${fishShare}: fed every day from meals`);
  return { food: g0 - grain(hh) + fish - Pot.freshHeld(st, hh), need, sources };
}
const plain = run(0), mixed = run(0.25);
check(plain.sources === 1 && near(plain.food, 12 * plain.need), `grain only: 12 days of need (${plain.food} for ${12 * plain.need})`);
check(mixed.sources === 2 && near(mixed.food, 0.9 * plain.food), `grain and fish: 10% less food (${mixed.food} against ${plain.food})`);

// --- three sources go 20% further; a food under a fifth of the pot is not a source
{
  const { st, hh } = home(), need = dailyNeed(st, hh);
  Pot.putFresh(st, hh, 'fish', 0.3 * 0.8 * need, 'catch'); Pot.putFresh(st, hh, 'gathered', 0.3 * 0.8 * need, 'gathering');
  const g0 = grain(hh), k = Pot.pot(st, hh, need);
  check(k === 3 && near(hh.meals, need) && near(g0 - grain(hh), 0.4 * 0.8 * need) && near(Pot.freshHeld(st, hh), 0), `3 sources: ${k}, a fifth less food`);
}
{
  const { st, hh } = home(), need = dailyNeed(st, hh);
  Pot.putFresh(st, hh, 'fish', 0.1 * need, 'catch');
  const g0 = grain(hh), k = Pot.pot(st, hh, need);
  check(k === 1 && near(hh.meals, need) && near(g0 - grain(hh), 0.9 * need), `fish at a tenth is not a source (${k})`);
}

// --- the oldest batch goes in first; past its 3 days a batch is lost when the store is next touched, and the loss is in the ledger
{
  const { st, hh } = home();
  Pot.putFresh(st, hh, 'fish', 1, 'catch'); moveClock(st, DAY); Pot.putFresh(st, hh, 'fish', 2, 'catch');
  Pot.putFresh(st, hh, 'fish', 1, 'catch');
  check(hh.fresh.length === 2 && hh.fresh[1].qty === 3, 'a day\'s catches are one batch');
  Pot.pot(st, hh, 0); // nothing wanted: nothing cooked
  check(near(Pot.freshHeld(st, hh), 4) && hh.meals === 0, 'a pot of nothing takes nothing');
  Pot.takeFresh(st, hh, 1.5, 'cooking');
  check(hh.fresh.length === 1 && near(hh.fresh[0].qty, 2.5), 'the oldest batch first');
  moveClock(st, 3 * DAY);
  check(near(Pot.freshHeld(st, hh), 2.5) && spoiled(hh, 'fish') === 0, 'good on its third day');
  moveClock(st, DAY);
  check(near(Pot.freshHeld(st, hh), 0) && hh.fresh.length === 1, 'read as lost on its fourth day, before anything touches it');
  feedHousehold(st, hh);
  check(hh.fresh.length === 0 && near(spoiled(hh, 'fish'), 2.5), `lost and noted when the meal touches the store (${spoiled(hh, 'fish')})`);
}
{ // at most FRESH_CAP batches of a food: with a longer shelf life, the oldest is lost
  const { st, hh } = home(), keeps = FOODS.fish.keeps;
  try {
    FOODS.fish.keeps = 20;
    for (let d = 0; d < Pot.FRESH_CAP + 2; d++) { Pot.putFresh(st, hh, 'fish', 1, 'catch'); moveClock(st, DAY); }
  } finally { FOODS.fish.keeps = keeps; }
  check(hh.fresh.length === Pot.FRESH_CAP && near(spoiled(hh, 'fish'), 2), `${hh.fresh.length} batches, 2 lost`);
}

// --- no meals: gathered food is eaten as it is, then grain uncooked at ECON.rawGrain; a household that misses its cooking for 3 days uses
// 25% more grain on those days
check(ECON.rawGrain === 1.25, 'raw grain: 1.25 rations for a ration of need');
{
  const { st, hh } = home(), need = dailyNeed(st, hh), g0 = grain(hh);
  for (let d = 0; d < 3; d++) { feedHousehold(st, hh); moveClock(st, DAY); }
  check(hh.hungryDays === 0 && near(g0 - grain(hh), 3 * 1.25 * need), `3 days uncooked: ${g0 - grain(hh)} grain for ${3 * need} of need`);
  const raw = hh.totals.find((x) => x.kind === 'raw' && x.good === 'grain');
  check(raw && raw.count === 3, 'each day eaten raw is counted');
  const g1 = grain(hh);
  for (let d = 0; d < 3; d++) { Pot.pot(st, hh, need - hh.meals); feedHousehold(st, hh); moveClock(st, DAY); }
  check(near(g1 - grain(hh), 3 * need), 'cooked again: a ration of grain a ration of need');
}
{
  const { st, hh } = home(), need = dailyNeed(st, hh), g0 = grain(hh);
  Pot.putFresh(st, hh, 'gathered', need / 2, 'gathering'); Pot.putFresh(st, hh, 'fish', need, 'catch');
  feedHousehold(st, hh);
  check(near(Pot.freshHeld(st, hh, 'gathered'), 0) && near(Pot.freshHeld(st, hh, 'fish'), need) && near(g0 - grain(hh), 1.25 * need / 2),
    'gathered food eaten as it is, at no penalty, before raw grain; fish is not eaten uncooked');
}
{ // short of everything: the meal takes what there is, grain at its raw rate, and the day is hungry
  const { st, hh } = home(0), need = dailyNeed(st, hh);
  hh.grain = { barley: need / 2 }; Pot.putFresh(st, hh, 'gathered', need / 4, 'gathering');
  feedHousehold(st, hh);
  check(hh.hungryDays === 1 && grain(hh) === 0 && near(Pot.freshHeld(st, hh), 0), 'short: all eaten, a hungry day');
}

// --- a run: fish and gathered food go into pots, a cook at work at the end of work finishes, the state keeps its invariants
check(KINDS.cook.late === true, 'the cook\'s job is finished after the end of work');
{
  const st = Sim.seed(r.value, 7, 'founders');
  const pots = [0, 0, 0, 0], pot = Pot.pot;
  let late = 0, finished = 0;
  Pot.pot = (...a) => { const k = pot(...a); pots[Math.min(k, 3)]++; return k; };
  try {
    for (let d = 0; d < 36; d++) {
      Sim.advance(st, d * DAY + WORK[1] - 0.1 - st.t);
      const busy = [];
      for (const id of st.living) {
        const a = st.agents[id];
        if (a.job && a.job.kind === 'cook' && a.phase === 'work') busy.push({ a, hh: st.households[st.pawns[id].household] });
      }
      Sim.advance(st, 0.2);
      for (const b of busy) if (b.a.job && b.a.job.kind === 'cook') late++;
      Sim.advance(st, 2.5);
      for (const b of busy) if (b.hh.cookDay === d) finished++;
    }
  } finally { Pot.pot = pot; }
  const bad = checkState(st);
  check(!bad.length, 'invariants: ' + bad.slice(0, 3).join('; '));
  check(pots[2] + pots[3] > 0, `mixed pots by the autumn: ${pots.join(', ')}`);
  check(late > 0 && finished >= late, `cooks at work at the end of work go on (${late}) and finish (${finished})`);
}
if (failed) { console.error(`pot: ${failed} failed`); process.exit(1); }
console.log('pot ok');
