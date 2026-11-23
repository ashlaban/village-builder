// Forest spread (VB-091, sim/spread): open land beside forest, or beside scrub at half cover or more, gains trees as regrowth does (a
// quarter of full cover, scrub, in about 8 years; full cover in 30, when it is forest, pine where most of its forest neighbours are), unless a
// field in use, a house, a green, a meadow mown within the year, work within the year or grazing at GRAZE.keepsOpen keeps it open; grazing at
// GRAZE.thins takes trees off at a fifth of the rate. Only the front (st.front) is visited. Scrub adds to clearing, and thick scrub is
// felled and grubbed and cut for firewood. On a tiny village under a forest: the rules on constructed states, the invariants and a save.
const VB = require('../src/load.js'), Sim = VB.sim, { B, treeStage } = VB.gen;
const S = VB['sim/spread'], Z = VB['sim/grazing'], Fd = VB['sim/fields'], FieldPlans = VB['sim/fieldplans'], Fo = VB['sim/forest'], T = VB['sim/territory'];
const { YEAR_DAYS, DAY } = VB['sim/rules'], { GRAZE } = VB['sim/spread'], { KINDS } = VB['sim/kinds'];
const { tinyWorld, tinyState, tileAt } = require('./lib/tiny.js'), { checkState } = require('./lib/invariants.js');
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('SPREAD FAIL:', m); } };
const rows = Array.from({ length: 14 }, (_, i) => (i < 2 ? 'FFFFFFFFFPPPPPPPPP' : '..................'));
const st = tinyState(tinyWorld(rows), [{ at: [9, 10], farms: 2, sizes: [5, 4] }], { seed: 3 }), w = st.w;
const days = (n) => { for (let k = 0; k < n; k++) S.spreadForest(st); }; // the clock stands: work on a tile is dated back below
const RATE = 1 / (S.SPREAD.years * YEAR_DAYS);

// --- the front: the open tiles beside the forest, none farther out
const edge = tileAt(w, 3, 2), far = tileAt(w, 3, 6), pineEdge = tileAt(w, 14, 2);
check(st.front.has(edge) && st.front.has(pineEdge) && !st.front.has(far), 'the front is the open land beside the forest');
check([...st.front].every((t) => w.biome[t] === B.MEADOW && !w.dev[t] || w.dev[t] === 1), 'the front is open land, no house or green');
check(checkState(st).length === 0, `invariants at the start: ${checkState(st).join('; ')}`);

// --- a day: the front tile gains a 30-year share of full cover, drawn as for forest; the far tile none
days(1);
check(w.treesMax[edge] >= 48 && w.treesMax[edge] <= 72 && Math.abs(w.trees[edge] - w.treesMax[edge] * RATE) < 1e-4, `a day's growth: ${w.trees[edge]} of ${w.treesMax[edge]}`);
check(w.treesMax[pineEdge] >= 64 && w.treesMax[pineEdge] <= 96, `beside pine, pine's cover: ${w.treesMax[pineEdge]}`);
check(w.trees[far] === 0, 'no growth away from the forest');
check(VB.count.frontTile >= st.front.size, 'the front is counted');

// --- scrub in about 8 years, thick scrub at half seeds its neighbours, forest at 30 years
days(Math.ceil(0.25 * S.SPREAD.years * YEAR_DAYS) - 1);
check(treeStage(w, edge) === 1 && w.trees[edge] >= 0.25 * w.treesMax[edge] - 1e-3, `a quarter of full cover in ${0.25 * S.SPREAD.years} years`);
check(w.biome[edge] === B.MEADOW, 'scrub is still meadow');
const next = tileAt(w, 3, 3);
check(!st.front.has(next) || w.trees[next] === 0, 'the second row waits for thick scrub');
days(Math.ceil(0.25 * S.SPREAD.years * YEAR_DAYS) + 1);
check(S.thick(w, edge) && st.front.has(next), 'scrub at half cover opens the front to its neighbours');
days(Math.ceil(0.5 * S.SPREAD.years * YEAR_DAYS) + 1);
check(w.biome[edge] === B.FOREST && w.trees[edge] === w.treesMax[edge] && !st.front.has(edge), `full cover in ${S.SPREAD.years} years: forest`);
check(w.biome[pineEdge] === B.PINE, 'beside pine, pine forest');
check(st.treeDirty.has(edge) && st.biomeDirty.has(edge), 'the page is told');
check(checkState(st).length === 0, `invariants after 30 years: ${checkState(st).join('; ')}`);

// --- kept open: grazing at keepsOpen; thinned at thins, at a fifth of the rate
const g1 = tileAt(w, 3, 3), was1 = w.trees[g1];
Z.graze(st, g1, GRAZE.keepsOpen + 1);
days(5);
check(w.trees[g1] === was1, 'grazing at keepsOpen keeps the land open');
Z.graze(st, g1, GRAZE.thins);
days(1);
check(Math.abs(w.trees[g1] - (was1 - w.treesMax[g1] * RATE * S.SPREAD.thin)) < 1e-4, `grazing at thins takes trees off: ${was1} to ${w.trees[g1]}`);
// work within the year keeps a tile open; after it, the forest goes on
const t2 = tileAt(w, 5, 3), was2 = w.trees[t2];
S.tended(st, t2);
days(3);
check(w.trees[t2] === was2, 'work within the year keeps it open');
w.tended[t2] -= YEAR_DAYS; // lint-allow: owner the work dated a year back
days(1);
check(w.trees[t2] > was2, 'a year after the work, the forest goes on');
// a field in use is kept open; a field of an empty farm grows trees; a restoration keeps it open
const f = st.farmsteads[0], fd = f.fields[0], ft = fd.tile;
st.front.add(ft); w.biome[tileAt(w, (ft % w.COLS), Math.floor(ft / w.COLS) - 1)] = B.FOREST;
days(3);
check(w.trees[ft] === 0, 'a field in use stays open');
const hh = st.households[f.household];
VB['sim/ownership'].farmToVillage(st, f); f.household = null;
days(3);
check(w.trees[ft] > 0, "an empty farm's field gains trees");
const wasF = w.trees[ft];
VB['sim/projectplans'].makeProject(st, 'pawn', hh.holder, { what: 'restore', farm: f.id, since: st.t, steps: [{ kind: 'restore', place: f.house, hours: 10, done: 0, stake: 'farm' }] });
days(3);
check(w.trees[ft] === wasF, 'a farm under restoration is kept open');
VB['sim/projectplans'].dropAll(st, 'pawn', hh.holder);
// a house is never taken
st.front.add(f.house);
days(1);
check(!st.front.has(f.house) && w.trees[f.house] === 0, 'a house leaves the front');

// --- clearing: light scrub adds SPREAD.scrubHours, thick scrub a felling and a grubbing; clearing takes it, and tends the tile
const c = tileAt(w, 8, 4);
w.treesMax[c] = 60; w.trees[c] = 10;
const base = 10 + (20 * w.stones[c]) / 255;
check(Math.abs(FieldPlans.clearHours(st, c) - base - S.SPREAD.scrubHours) < 1e-9, 'scrub below half cover adds its hours to a clearing');
w.trees[c] = 30;
check(Math.abs(FieldPlans.clearHours(st, c) - base - Fo.FELL_HOURS - Fo.GRUB_HOURS) < 1e-9, 'thick scrub is felled and grubbed');
S.clearScrub(st, c);
check(w.trees[c] === 0 && w.treesMax[c] === 0 && w.tended[c] === Math.floor(st.t / DAY) + 1, 'cleared: no trees, and tended today');
// a reclaimed field of thick scrub costs the felling and grubbing besides
f.household = hh.id; for (const t of [f.house, ...f.fields.map((x) => x.tile)]) VB['sim/ownership'].setOwner(st, t, { type: 'household', id: hh.id });
fd.stage = 'scrub'; w.trees[ft] = 0.6 * (w.treesMax[ft] || 60); w.treesMax[ft] = w.treesMax[ft] || 60;
let posted = null;
KINDS.reclaim.available(st, hh, fd, null, (k, site, o) => { posted = o; }, f);
check(posted && posted.hours === 20 + Fo.FELL_HOURS + Fo.GRUB_HOURS, `a thick-scrub field's reclaim: ${posted && posted.hours} h`);
Fd.reclaimed(st, fd);
check(w.trees[ft] === 0 && fd.stage === 'stubble', 'reclaimed: its scrub is gone');

// --- a forest tile cut bare joins the front; thick scrub is cut for firewood
const cut = tileAt(w, 6, 1);
while (w.trees[cut] > 0) Fo.fellTree(st, cut);
check(w.biome[cut] === B.MEADOW && st.front.has(cut), 'a forest tile cut bare joins the front');
const v = st.villages[0], { bfs } = VB['sim/hex'];
const scrubTile = [...bfs(w, v.center, 3, () => true).dist.keys()].find((t) => t !== v.center && w.biome[t] === B.MEADOW && !st.used.has(t) && !w.dev[t]);
w.treesMax[scrubTile] = 60; w.trees[scrubTile] = 40;
check(T.reckonWood(st, v).includes(scrubTile), 'thick scrub near the green is cut for firewood first');
w.trees[scrubTile] = 10;
check(!T.reckonWood(st, v).includes(scrubTile), 'young scrub is not');

// --- a field let go lapses (VB-1527): developed ground LAPSE.years untended, then wild ground of its terrain; taken in again, it stays
{
  const f2 = st.farmsteads[1], at = (fd) => fd.tile, clock = { year: 0 };
  const hill = f2.fields[f2.fields.length - 1], again = f2.fields[f2.fields.length - 2], ht = at(hill), at2 = at(again);
  w.biome[ht] = B.HILLS; // the field lies on hills: the ground under a field is its biome still
  hill.stage = again.stage = 'stubble'; hill.held = again.held = 0;
  Fd.letGo(st, f2, hill, clock); Fd.letGo(st, f2, again, { year: 1 });
  check(st.lapsed.has(ht) && st.lapsed.has(at2) && w.dev[ht] === 1 && !st.used.has(ht), 'a field let go is lapsed ground, developed still');
  check(checkState(st).length === 0, `invariants with lapsed ground: ${checkState(st).join('; ')}`);
  const n0 = VB.count.lapsedTile, day0 = Math.floor(st.t / DAY), L = S.LAPSE.years * YEAR_DAYS;
  w.tended[ht] = w.tended[at2] = day0 + 1 - (L - 1); // let go LAPSE.years less a day ago
  days(1);
  check(w.dev[ht] === 1 && st.lapsed.has(ht) && VB.count.lapsedTile === n0 + 2, 'a day short of its years it is developed ground, and counted');
  st.used.add(at2); // taken into use again
  w.tended[ht] = w.tended[at2] = day0 + 1 - L;
  st.biomeDirty.clear();
  days(1);
  check(w.dev[ht] === 0 && !st.lapsed.has(ht) && w.biome[ht] === B.HILLS && st.biomeDirty.has(ht), `${S.LAPSE.years} years untended: hills again`);
  check(w.dev[at2] === 1 && !st.lapsed.has(at2), 'ground taken into use again does not revert');
  st.used.delete(at2);
  w.tended[at2] = 0; // no work on it is dated
  delete st.lapsed; // an older save: the developed ground in nobody's use is found, and lapses from today
  days(1);
  check(st.lapsed.has(at2) && w.tended[at2] === day0 + 1 && w.dev[at2] === 1, "an older save's let-go field lapses from the load");
}
// --- a field unused goes back to the land, on a held farm or an empty one alike (VB-1527; Kim, 23 Nov): on the year's last day
{
  const f1 = st.farmsteads[0], f2 = st.farmsteads[1], day = Math.floor(st.t / DAY), L = S.LAPSE.years * YEAR_DAYS, end = { year: Math.floor(st.t / VB['sim/rules'].YEAR), season: 3, sday: VB['sim/rules'].SEASON_DAYS - 1, day };
  for (const f of [f1, f2]) for (const fd of f.fields) { fd.stage = 'stubble'; fd.sown = null; fd.held = 0; fd.used = day; }
  const old1 = f1.fields[f1.fields.length - 1], old2 = f2.fields[f2.fields.length - 1], n1 = f1.fields.length, n2 = f2.fields.length;
  old1.used = old2.used = day - L; // unused LAPSE.years
  const growing = f1.fields[0]; growing.used = day - L; growing.stage = 'growing'; growing.sown = day; // a crop stands: not unused
  const was = f2.household; f2.household = null; f2.emptySince = st.t; // an empty farm's field lapses as a held farm's does
  const c0 = VB.count.fieldLapse;
  Fd.lapseFields(st, end);
  check(f1.fields.length === n1 - 1 && !f1.fields.includes(old1) && f1.fields.includes(growing), "a held farm's field unused its years is gone; one with a crop stays");
  check(f2.fields.length === n2 - 1 && !f2.fields.includes(old2), "an empty farm's too");
  check(w.dev[old1.tile] === 0 && !st.used.has(old1.tile) && w.dev[old2.tile] === 0, 'and is wild ground at once');
  check(VB.count.fieldLapse === c0 + n1 + n2, 'the fields weighed are counted');
  growing.stage = 'stubble'; growing.sown = null; growing.used = day; f2.household = was; f2.emptySince = null;
}
// --- a save keeps the front and the work on tiles
check(checkState(st).length === 0, `invariants at the end: ${checkState(st).join('; ')}`);
const back = Sim.load(w, JSON.parse(JSON.stringify(Sim.save(st))));
check(back.front.size === st.front.size && [...st.front].every((t) => back.front.has(t)), 'a save keeps the front');
check(back.w.tended[c] === w.tended[c], 'and the work on tiles');
check(back.lapsed.size === st.lapsed.size && [...st.lapsed].every((t) => back.lapsed.has(t)), 'and the lapsed ground');

if (failed) { console.error(`forest spread: ${failed} failed`); process.exit(1); }
console.log('forest spread ok: the front, its rates, kept open, thinned, cleared, cut bare, firewood, lapsed ground and a save');
