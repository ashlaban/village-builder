// Tar (VB-301; design.md, Goods of place and side crafts): a village with pine in its wood has a tar pit dug by its household with the most
// working hands; the pit's household burns a barrel (TAR.barrelHours, one pine tree felled) in early summer while it holds fewer than it
// keeps; a barrel laid on the house tars it for HOUSE.tarYears (its wear so far read first), and one on the boat keeps it whole: untarred
// BOAT.tarYears it fishes at half, BOAT.lostYears it is lost at the yearly round. Tar's need term: its worth for a house or boat due.
// On tiny villages: one by a pine wood, one by broadleaf only.
const VB = require('../src/load.js');
const T = VB['sim/tar'], Drying = VB['sim/drying'], { KINDS } = VB['sim/kinds'], Projects = VB['sim/projects'];
const { YEAR, DAY, SEASON_DAYS, HOUSE, houseCondition, houseTarred } = VB['sim/rules'];
const { tinyWorld, tinyState } = require('./lib/tiny.js'), { checkState } = require('./lib/invariants.js');
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('TAR FAIL:', m); } };
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;
const make = (wood) => {
  const rows = Array.from({ length: 12 }, (_, i) => (i < 2 ? wood.repeat(16) : '................'));
  return tinyState(tinyWorld(rows), [{ at: [8, 7], farms: 2, sizes: [5, 4] }], { seed: 4 });
};
const posts = (st, kind, hh) => {
  const f = st.farmsteads[hh.farmstead], out = [];
  KINDS[kind].available(st, hh, f, VB['sim/rules'].cal(st.t), (key, site, extra) => out.push({ key, site, ...extra }));
  return out;
};
const summer = (st, day) => { st.t = (Math.floor(st.t / YEAR) * YEAR) + (SEASON_DAYS + day) * DAY + 10; };

// the reach test and the pit
{
  const st = make('P'), v = st.villages[0];
  check(v.wood.length > 0 && T.villageTar(st, v), 'pine in the wood: a tar village');
  const broad = make('F');
  check(broad.villages[0].wood.length > 0 && !T.villageTar(broad, broad.villages[0]), 'broadleaf only: no tar');
  T.tarYear(broad);
  check(broad.households.every((h) => !Projects.projectOf(broad, 'household', h.id)), 'no pit without pine');
  T.tarYear(st);
  const diggers = st.households.filter((h) => Projects.projectOf(st, 'household', h.id));
  check(diggers.length === 1 && Projects.projectOf(st, 'household', diggers[0].id).what === 'tarpit', 'one pit begun for the village');
  const hh = diggers[0], plan = Projects.projectOf(st, 'household', hh.id), s = Projects.openStep(plan);
  check(st.w.biome[s.place] === VB.gen.B.PINE && v.wood.includes(s.place), 'on a pine tile of the wood');
  T.tarYear(st);
  check(st.households.filter((h) => Projects.projectOf(st, 'household', h.id)).length === 1, 'a pit begun is not begun twice');
  KINDS.tarpit.done(st, { kind: 'tarpit', site: s.place }, hh);
  check(hh.tarPit && hh.tarPit.tile === s.place && !Projects.projectOf(st, 'household', hh.id), 'the pit dug is the household\'s');
  check(st.record.some((e) => e.kind === 'tarPit'), 'and told');
  T.tarYear(st);
  check(st.households.every((h) => !Projects.projectOf(st, 'household', h.id)), 'a village with a pit digs no second');

  // burning: early summer only, while fewer barrels than kept; a tree of pine felled, a barrel through the store
  hh.tar = 0;
  summer(st, 0);
  const p = posts(st, 'burntar', hh);
  check(p.length === 1 && p[0].site === hh.tarPit.tile, 'early summer: the pit burns');
  summer(st, T.TAR.burnDays);
  check(posts(st, 'burntar', hh).length === 0, 'none past early summer');
  summer(st, 0);
  const other = st.households.find((h) => h !== hh);
  check(posts(st, 'burntar', other).length === 0, 'a household without a pit burns none');
  const t = T.pineTile(st, v), trees = st.w.trees[t];
  check(T.burnt(st, hh) && hh.tar === 1 && st.w.trees[t] === trees - 1, `a barrel, a pine tree: tar ${hh.tar}, trees ${trees} -> ${st.w.trees[t]}`);
  const e = hh.ledger[hh.ledger.length - 1];
  check(e.kind === 'tarburn' && e.good === 'tar' && e.n === 1, 'through the ledger: ' + JSON.stringify(e));
  check(posts(st, 'burntar', hh).length === 0, 'one barrel kept for the house, with no boat');

  // the house: a barrel tars it for HOUSE.tarYears; wear before is read at the old rate, after at the tarred
  const f = st.farmsteads[hh.farmstead];
  st.t += 2 * YEAR; // the closed form reads the time since condAt; keep it after the clock's start
  f.condition = 1; f.condAt = st.t - YEAR; f.tarredUntil = 0;
  check(posts(st, 'tarhouse', hh).length === 1, 'a barrel and an untarred house: tarring posted');
  const c0 = houseCondition(st, f);
  check(near(c0, 1 - (f.grade === 'stone' ? HOUSE.wearStone : HOUSE.wear)), `a year untarred: ${c0}, grade ${f.grade}`);
  check(T.tarHouse(st, hh) && hh.tar === 0 && houseTarred(st, f) && near(f.tarredUntil, st.t + HOUSE.tarYears * YEAR), 'tarred for six years');
  check(near(houseCondition(st, f), c0), 'the wear so far stands');
  st.t += YEAR;
  check(near(houseCondition(st, f), c0 - HOUSE.wearTarred), `a tarred year wears ${HOUSE.wearTarred}: ${houseCondition(st, f)}`);
  check(posts(st, 'tarhouse', hh).length === 0 && !T.tarHouse(st, hh), 'a tarred house takes no barrel');
  { const bad = checkState(st).filter((m) => !/not tick/.test(m)); check(bad.length === 0, 'invariants: ' + bad.slice(0, 3)); }

  // the boat: tarred as it is built; leaky after BOAT.tarYears, lost after BOAT.lostYears; a barrel renews it
  const { BOAT } = Drying;
  hh.boat = { tile: f.house, water: f.house, house: f.house, built: st.t, tarred: st.t };
  check(T.dueCount(st, hh) === 0, 'a new boat and a tarred house: nothing due');
  check(Drying.fishingPlace(st, hh, f).boat && !Drying.fishingPlace(st, hh, f).leaky, 'a new boat is tight');
  st.t += (BOAT.tarYears - T.TAR.lead) * YEAR;
  check(T.dueCount(st, hh) === 1 && Drying.boatDue(st, hh, f, T.TAR.lead), 'due half a year before it leaks');
  st.t += T.TAR.lead * YEAR;
  const g = Drying.fishingPlace(st, hh, f);
  check(g.boat && g.leaky, 'untarred two years: it leaks');
  check(near(Drying.catchOf(st, { water: g.water, boat: true, leaky: true }) * 2, Drying.catchOf(st, { water: g.water, boat: true, leaky: false })),
    'a leaky boat fishes at half');
  hh.tar = 1;
  check(posts(st, 'tarboat', hh).length === 1 && T.tarBoat(st, hh) && hh.tar === 0 && hh.boat.tarred === st.t, 'a barrel tars the boat');
  check(!Drying.fishingPlace(st, hh, f).leaky, 'tight again');
  st.t += BOAT.lostYears * YEAR;
  check(!(Drying.fishingPlace(st, hh, f) || {}).boat, 'untarred four years: nobody fishes from it');
  Drying.boatYear(st);
  check(hh.boat === null && st.record.some((e) => e.kind === 'boatLost'), 'and the yearly round takes it away, told');
}
if (failed) { console.error(`tar: ${failed} failed`); process.exit(1); }
console.log('tar ok');
