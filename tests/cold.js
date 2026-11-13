// The cold house (VB-327; design.md, Fuel): the day's fire burns the season's use or what the pile holds; a household whose pile does not
// cover it is cold that day by the wood it lacked over winter's use, hh.cold the mean of the last 12 days. A cold day drains health
// (HEALTH.cold, more for the frail) and a full meal restores nothing; an empty pile posts no cook job, so the grain is eaten uncooked
// (a ration of it feeds ECON.uncooked); the firewood job of a cold household is the most urgent; a death in a cold house is told so. With wood, nothing changes.
// On a tiny village under a forest.
const VB = require('../src/load.js'), Sim = VB.sim;
const { feedHousehold, dailyNeed } = VB['sim/hunger'], { cookWanted, KINDS } = VB['sim/kinds'], { killPawn } = VB['sim/lifecycle'];
const { HEALTH, HUNGER, MATCH, YEAR, DAY, YEAR_DAYS } = VB['sim/rules'];
const { tinyWorld, tinyState } = require('./lib/tiny.js'), { checkState } = require('./lib/invariants.js');
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('COLD FAIL:', m); } };
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;
const rows = Array.from({ length: 12 }, (_, i) => (i < 2 ? 'FFFFFFFFFFFFFFFF' : '................'));
const make = () => tinyState(tinyWorld(rows), [{ at: [8, 7], farms: 2, sizes: [5, 4] }], { seed: 4 });
const E = make().ECON, U = E.woodUse, WINTER = 3, SUMMER = 1;
// a household fed in full from grain, its members at health 80 and no hunger; one member made an adult of 30, one a child of 2, one of 70
function setup(st) {
  const hh = st.households[0];
  hh.grain = { barley: 1e4 }; hh.meals = 0; hh.larder = []; hh.fresh = [];
  const [a, b, c] = hh.members.map((id) => st.pawns[id]);
  a.born = st.t - 30 * YEAR; b.born = st.t - 2 * YEAR; c.born = st.t - 70 * YEAR;
  for (const id of hh.members) { const p = st.pawns[id]; p.health = 80; p.hunger = 0; p.hungerLog = []; }
  return { hh, a, b, c };
}

// --- the numbers
check(HEALTH.cold === 2 && HEALTH.frail === 1.5 && HEALTH.recover === 3, 'HEALTH.cold 2, frail 1.5, recover 3');
check(MATCH.urgency.woodColdUrgency === 3 && MATCH.urgency.woodLowUrgency === 2.2 && MATCH.urgency.cookEvening < 3, 'urgencies');
check([0, 1, 2].every((s) => near(U[s] / U[WINTER], [0.22, 0.19, 0.31][s], 0.01)), `woodUse over winter's: ${U.map((x) => (x / U[3]).toFixed(2))}`);

// --- a winter day with an empty pile: cold 1 that day, hh.cold 1/12; the adult loses 2, the child and the old 3, a full meal restores nothing
{
  const st = make(), { hh, a, b, c } = setup(st);
  check(hh.cold === 0 && Array.isArray(hh.coldLog) && hh.coldLog.length === 0, 'a household starts warm');
  hh.wood = 0;
  feedHousehold(st, hh, WINTER);
  check(near(hh.coldLog[0], 1) && near(hh.cold, 1 / HUNGER.days), `winter, no wood: cold ${hh.cold}, log ${hh.coldLog}`);
  check(near(a.health, 78) && near(b.health, 77) && near(c.health, 77), `health ${a.health}, ${b.health}, ${c.health}: 2 an adult, 3 the frail`);
  check(a.hungerLog[0] === 0, 'the household ate: the cold is not hunger');
  check(checkState(st).length === 0, `invariants: ${checkState(st).slice(0, 3)}`);
  // a winter wholly without wood: 24 of 100 for a fed adult (12 days of 2), 36 for the frail
  for (let d = 1; d < 12; d++) feedHousehold(st, hh, WINTER);
  check(near(a.health, 80 - 24) && near(b.health, 80 - 36) && near(hh.cold, 1), `a winter cold: ${a.health}, ${b.health}, cold ${hh.cold}`);
  // a death in that house is told so, with no cause of its own
  st.naturalDeaths = false;
  const at = st.record.length; killPawn(st, c.id, 'oldAge');
  const ev = st.record.slice(at).find((e) => typeof e === 'object' && e.kind === 'died');
  check(ev && ev.cold === true && ev.text === 'oldAge', `the death is recorded cold: ${JSON.stringify(ev)}`);
  check(ev && Sim.villageLog && /died of old age in a cold house/.test(VB['sim/notable'].eventLine(st, ev)), `told: ${ev && VB['sim/notable'].eventLine(st, ev)}`);
}
// --- a summer day without wood barely counts; part of a winter day's wood leaves the house cold by the rest
{
  const st = make(), { hh, a } = setup(st);
  hh.wood = 0; feedHousehold(st, hh, SUMMER);
  check(near(hh.coldLog[0], U[SUMMER] / U[WINTER]) && near(a.health, 80 - 2 * U[SUMMER] / U[WINTER]), `summer: cold ${hh.coldLog[0]}, health ${a.health}`);
  hh.wood = U[WINTER] / 2; feedHousehold(st, hh, WINTER);
  check(near(hh.coldLog[1], 0.5) && hh.wood === 0, `half a winter day's wood: cold ${hh.coldLog[1]}, pile ${hh.wood}`);
  // warm days: the log keeps the cold 12 days, then empties
  hh.wood = 1e3;
  for (let d = 0; d < HUNGER.days - 1; d++) feedHousehold(st, hh, WINTER);
  check(hh.cold > 0 && hh.coldLog.length === HUNGER.days, `11 warm days: still cold ${hh.cold}`);
  const h0 = a.health; feedHousehold(st, hh, WINTER);
  check(hh.cold === 0 && hh.coldLog.length === 0, `12 warm days: warm, log ${hh.coldLog}`);
  check(near(a.health, Math.min(100, h0 + 3)), 'a warm day: a full meal restores 3');
  check(checkState(st).length === 0, `invariants: ${checkState(st).slice(0, 3)}`);
}
// --- with wood the day is as before: the fire burns the season's use, the house stays warm, the log empty
{
  const st = make(), { hh, a } = setup(st);
  hh.wood = 10; feedHousehold(st, hh, WINTER);
  check(near(hh.wood, 10 - U[WINTER]) && hh.cold === 0 && hh.coldLog.length === 0 && a.health === 83, `with wood: pile ${hh.wood}, health ${a.health}`);
  // a meal alone (no season given) burns nothing
  feedHousehold(st, hh); check(near(hh.wood, 10 - U[WINTER]), 'a meal alone burns nothing');
}
// --- no cooking without wood: no cook job, and the grain is eaten uncooked, at ECON.uncooked a ration
{
  const st = make(), { hh } = setup(st), c = { day: 99 }, need = dailyNeed(st, hh);
  hh.wood = 5; check(cookWanted(st, hh, c), 'with wood and grain the cook is wanted');
  hh.wood = 0; check(!cookWanted(st, hh, c), 'an empty pile: no cook job');
  const g0 = Sim.grainOf(hh); feedHousehold(st, hh, WINTER);
  check(near(g0 - Sim.grainOf(hh), need / E.uncooked), `uncooked: ${g0 - Sim.grainOf(hh)} grain for ${need} of need`);
}
// --- the work answers it: a cold household's firewood job is the most urgent, above cooking
{
  const st = make(), { hh } = setup(st), f = st.farmsteads[hh.farmstead], j = { farm: f }, c = { season: 3, day: 0 };
  hh.wood = 2; check(KINDS.wood.urgency(st, j, c, MATCH.urgency) === MATCH.urgency.woodLowUrgency, 'a low pile: 2.2');
  hh.wood = 0; feedHousehold(st, hh, WINTER);
  check(KINDS.wood.urgency(st, j, c, MATCH.urgency) === MATCH.urgency.woodColdUrgency, 'a cold house: 3');
}
// --- a save without the cold loads warm
{
  const st = make(); setup(st);
  const data = JSON.parse(JSON.stringify(Sim.save(st)));
  for (const h of data.households || []) { delete h.cold; delete h.coldLog; }
  const back = Sim.load(tinyWorld(rows), data);
  check(back.households.every((h) => h.cold === 0 && Array.isArray(h.coldLog) && !h.coldLog.length), 'an older save loads with 0');
}
// --- a run with wood in reach: no household is ever cold
{
  const st = make();
  for (let d = 0; d < 40; d++) {
    Sim.advance(st, DAY);
    check(st.households.every((h) => h.cold === 0), `day ${d}: a household with its wood in reach is cold`);
    if (failed) break;
  }
  check(checkState(st).length === 0, `invariants after 40 days: ${checkState(st).slice(0, 3)}`);
}
void YEAR_DAYS;
if (failed) { console.error(`cold: ${failed} failed`); process.exit(1); }
console.log('cold: ok');
