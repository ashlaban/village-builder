// A night without a roof is cold and wet (VB-785; design.md, Sleeping away from home): at a stay's night the cold and the wet reach its
// pawn's health by the house's rule (sim/hunger nightCost) read for its roof: two nights in the open in winter cost what two nights in a
// cold house cost, in summer a fraction of it, in a booth with wood nothing. On a tiny state.
const assert = require('assert'), VB = require('../src/load.js');
const { tinyWorld, tinyState, tileAt } = require('./lib/tiny.js');
const { DAY, SEASON_DAYS, HEALTH } = VB['sim/rules'], { feedAway } = VB['sim/away'], { issue } = VB['sim/commands'], Stores = VB['sim/stores'];
const { stayOf } = VB['sim/agents'];
const W = 60, make = () => tinyState(tinyWorld(Array(9).fill('.'.repeat(W)), { seed: 3 }), [{ at: [6, 4], farms: 2, sizes: [5, 4] }], { seed: 3 });
const adultOf = (st, hh) => hh.members.find((id) => id !== hh.holder && st.pawns[id].age >= 14 && st.pawns[id].age < 60);
// the health an adult loses over `nights` nights of its stay in `season`, with its roof arranged by `setup`
function lose(season, nights, setup) {
  const st = make(), hh = st.households[0], f = st.farmsteads[hh.farmstead], id = adultOf(st, hh);
  Stores.put(st, hh, 'grain', 200, 'harvest', { barley: 200 });
  const site = tileAt(st.w, (f.house % st.w.COLS) + 24, Math.floor(f.house / st.w.COLS));
  st.t = (season * SEASON_DAYS + 3) * DAY + 6; // some days into the season, early on
  assert.strictEqual(issue(st, { actor: id, verb: 'lodge', target: site, args: { why: 'work', days: 6 }, source: 'pawn' }), true);
  const s = stayOf(st, id);
  if (setup) setup(st, s, site);
  const p = st.pawns[id];
  p.health = 80;
  for (let n = 0; n < nights; n++) {
    st.t = (season * SEASON_DAYS + 4 + n) * DAY;
    s.food = 6;
    feedAway(st);
  }
  return 80 - p.health;
}
const WINTER = 3, SUMMER = 1;
const night = (cold, dry) => HEALTH.cold * cold + HEALTH.dry * dry; // a night's cost for an adult
const use = make().ECON.woodUse, day = (s) => use[s] / use[3];
const booth = (wood) => (st, s, site) => {
  st.booths.push({ id: 0, tile: site, by: st.pawns[s.pawn].household, maker: s.pawn, guests: [], built: 0, wood, cond: 1, condAt: st.t });
  s.roof = 'booth';
};
const w2 = lose(WINTER, 2), s2 = lose(SUMMER, 2);
assert.ok(Math.abs(w2 - 2 * night(day(WINTER), 1)) < 1e-6, `two winter nights in the open cost a cold house's: ${w2}`);
assert.ok(Math.abs(s2 - 2 * night(day(SUMMER), 1)) < 1e-6 && s2 < w2 / 2, `in summer, less than half: ${s2} against ${w2}`);
const warm = lose(WINTER, 2, booth(10));
assert.ok(warm <= 0, `in a booth with wood, nothing lost (it recovers): ${warm}`);
const cold = lose(WINTER, 2, booth(0));
assert.ok(Math.abs(cold - 2 * night(1, 0)) < 1e-6, `a booth without wood is an unheated house, under its roof: ${cold}`);
console.log(`night: two winter nights in the open cost ${w2.toFixed(2)} health, summer ${s2.toFixed(2)}, a booth with wood none lost`);
