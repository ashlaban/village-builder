// Peat (VB-367; design.md, Fuel): a trip of dig cuts ECON.woodPerTrip units of peat in summer into hh.peat; a unit burns as PEAT.worth (0.5) of
// wood, after the wood, from the season after it was cut (it dries); a household cuts when the village's wood lies over PEAT.far steps off,
// or from day PEAT.late of summer, while its fuel pile (wood and peat) is under the winter's goal, up to the shortfall; peat does not grow back.
// On a tiny village, with a peat tile placed by hand.
const VB = require('../src/load.js');
const { feedHousehold } = VB['sim/hunger'], { KINDS } = VB['sim/kinds'], D = VB['sim/dig'], Stores = VB['sim/stores'];
const { PEAT, YEAR, DAY, SEASON_DAYS, ECON } = VB['sim/rules'], { DEPOSIT } = VB['gen/geology'];
const { tinyWorld, tinyState } = require('./lib/tiny.js'), { checkState } = require('./lib/invariants.js');
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('PEAT FAIL:', m); } };
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;
const rows = Array.from({ length: 12 }, (_, i) => (i < 2 ? 'FFFFFFFFFFFFFFFF' : '................'));
const make = () => tinyState(tinyWorld(rows), [{ at: [8, 7], farms: 2, sizes: [5, 4] }], { seed: 4 });
const SUMMER = 1, WINTER = 3, K = KINDS.dig;
check(PEAT.worth === 0.5 && PEAT.far === 8, 'PEAT.worth 0.5, PEAT.far 8');

// the day's fire: wood first, then dry peat, 2 units for 1 of wood; peat cut this season is still wet
{
  const st = make(), hh = st.households[0], U = st.ECON.woodUse;
  hh.grain = { barley: 1e4 }; hh.meals = 0; hh.larder = []; hh.fresh = [];
  hh.wood = U[WINTER] / 2; hh.peat = 10;
  feedHousehold(st, hh, WINTER);
  check(hh.wood === 0 && near(hh.peat, 10 - U[WINTER] / 2 / PEAT.worth) && hh.cold === 0, `wood then peat: wood ${hh.wood}, peat ${hh.peat}, cold ${hh.cold}`);
  hh.wood = 0; hh.peat = 0.5; feedHousehold(st, hh, WINTER);
  check(hh.peat === 0 && hh.cold > 0, `peat short of the fire leaves the house cold by the rest: cold ${hh.cold}`);
  hh.peat = 0; hh.peatCut = undefined; hh.wood = 0;
  Stores.dug(st, hh, 'peat', 3);
  check(hh.peat === 3 && Stores.peatDry(st, hh) === 0, 'a load cut today is wet');
  feedHousehold(st, hh, SUMMER);
  check(hh.peat === 3, 'wet peat is not burnt');
  st.t += SEASON_DAYS * DAY;
  check(Stores.peatDry(st, hh) === 3, 'it burns from the next season');
  feedHousehold(st, hh, 2);
  check(near(hh.peat, 3 - st.ECON.woodUse[2] / PEAT.worth), `burnt: ${hh.peat}`);
  { const bad = checkState(st).filter((m) => !/not tick/.test(m)); check(bad.length === 0, 'invariants: ' + bad.slice(0, 3)); } // the clock was moved by hand
}

// the want: summer, short of fuel, wood far or summer's end near
{
  const st = make(), hh = st.households[0], f = st.farmsteads[hh.farmstead], w = st.w;
  w.deposit = new Uint8Array(w.N); w.depositLeft = new Uint16Array(w.N);
  const { dist } = VB['sim/hex'].bfs(w, f.house, 4, (j) => VB['sim/routes'].passable(w, j));
  const t = [...dist].find(([i, d]) => d === 3 && st.owner[i] === 0 && !w.water[i]);
  check(!!t, 'a free tile three steps off');
  if (t) {
    w.deposit[t[0]] = DEPOSIT.PEAT; w.depositLeft[t[0]] = 100;
    const posts = () => { const out = []; K.available(st, hh, f, null, (key, site, extra) => out.push({ key, site, ...extra })); return out; };
    const goal = () => st.plans.households.get(hh.id).targets.wood[1];
    hh.digAt = undefined; hh.clay = hh.bogOre = D.DIG.stock;
    const at = (day) => { st.t = (SUMMER * SEASON_DAYS + day) * DAY; };
    at(0); hh.wood = 0; hh.peat = 0; hh.peatCut = undefined;
    st.villages[f.village].wood = [f.house]; // wood at the door
    check(posts().length === 0, 'early summer, wood near: no peat');
    at(PEAT.late); hh.digAt = undefined;
    const p = posts();
    check(p.length === 1 && p[0].good === 'peat' && p[0].site === t[0], 'late summer and short: peat is cut');
    hh.wood = goal();
    check(posts().length === 0, 'a full pile cuts none');
    hh.wood = 0; hh.peat = goal() / PEAT.worth;
    check(posts().length === 0, 'a pile full of peat cuts no more');
    at(0); hh.peat = 0; hh.digAt = undefined; st.villages[f.village].wood = [];
    check(posts().length === 1, 'no wood in reach: peat from the first day of summer');
    st.t = (2 * SEASON_DAYS + PEAT.late) * DAY; hh.digAt = undefined;
    check(posts().length === 0, 'none in autumn');
    // a trip: the tile falls by one, the store rises by ECON.woodPerTrip, through the ledger; and it never grows back
    at(0); hh.digAt = undefined; hh.peatCut = undefined;
    const j = { kind: 'dig', site: t[0], good: 'peat', farm: f, owner: { type: 'household', id: hh.id } };
    K.deliver(st, j, hh, f);
    check(w.depositLeft[t[0]] === 99 && hh.peat === ECON.woodPerTrip, `a trip: tile ${w.depositLeft[t[0]]}, peat ${hh.peat}`);
    const e = hh.ledger[hh.ledger.length - 1];
    check(e.kind === 'dig' && e.good === 'peat' && e.n === ECON.woodPerTrip, `through the ledger: ${JSON.stringify(e)}`);
    st.t += 30 * YEAR;
    check(D.left(st, t[0]) === 99, 'peat does not grow back');
    check(K.urgency(st, j) >= D.DIG.urgency, 'peat is at least upkeep in urgency');
  }
}
if (failed) { console.error(`peat: ${failed} failed`); process.exit(1); }
console.log('peat ok');
