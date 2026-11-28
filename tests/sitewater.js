// @suite fast
// VB-1583: a site's water is weighed by the site search and carried by the sites a leader chooses among. On drawn maps (tests/lib/tiny.js):
// the leader's estimate (sim/water siteWater) is the least of the walk to fresh water, the well of the village the site would join and a
// well of its own at the middle of its band, spread over WELL.payYears; a candidate's score loses SETTLE.perFetch a daily hour, so of two
// sites alike but for their water the nearer ranks first; and no site is refused: where there is no source and no well, one is still offered.
// VB-1596: a plot's site in a village (sim/expansion findSite) loses the same a daily hour, its water reckoned with the village's well.
const VB = require('../src/load.js'),
  Settle = VB['sim/settle'],
  Water = VB['sim/water'];
const { tinyWorld, tinyState, tileAt } = require('./lib/tiny.js');
const { FRESH, WELL, NO_WELL, bandHours, bandMid } = VB['world/water'];
const { SETTLE, YEAR_DAYS, WORK } = VB['sim/rules'];
const { RIVER } = VB['sim/crops'];
const { WATER, siteFetch, siteWater } = Water;
const tripHours = (walk) => Water.dayFetch(walk, 1).hours; // one trip by hand
let failed = 0;
const check = (ok, m) => {
  if (!ok) {
    failed++;
    console.error('SITEWATER FAIL:', m);
  }
};
const near = (x, y, e = 0.01) => Math.abs(x - y) <= e;
// a wide meadow between two woods, a village in its middle: land alike all along it
const COLS = 72,
  ROWS = 24,
  rows = Array.from({ length: ROWS }, (_, r) => (r < 4 || r >= ROWS - 4 ? 'F' : '.').repeat(COLS));
const brook = (w, i) => {
  w.river[i] = 1;
  w.fresh[i] = FRESH.BROOK;
};
// the land's water laid by hand: the depth of every tile's water, and the walk to fresh water searched again from the natural sources
// (as it is laid before the starting wells: wells are not in it)
const lay = (w, depth) => {
  const wells = [];
  for (let i = 0; i < w.N; i++) if (w.fresh[i] === FRESH.WELL) wells.push(i);
  for (const i of wells) w.fresh[i] = FRESH.NONE;
  w.waterDepth.fill(depth);
  delete w.freshWalk;
  Water.layWalk(w);
  for (const i of wells) w.fresh[i] = FRESH.WELL;
};
const world = () => {
  const w = tinyWorld(rows),
    st = tinyState(w, [{ at: [36, 12], farms: 2, sizes: [3, 3] }], { seed: 7 });
  return { w, st, v: st.villages[0], at: (c, r) => tileAt(w, c, r) };
};
const cands = (st, v) => Settle.candidates(st, v, Settle.landInUse(st), Settle.reachOf(st, v), 3);

// ---- 1. the leader's estimate ----
{
  const { w, st, v, at } = world();
  brook(w, at(60, 12));
  lay(w, NO_WELL);
  const by = siteWater(st, at(59, 12), 3, null);
  check(
    by.by === 'source' && by.source.name === 'a brook' && near(by.source.walk, 0.125) && near(by.hours, 0.36) && by.well === null,
    `beside a brook: the brook, a step off, 0.36 hours a day, no well (${JSON.stringify(by)})`,
  );
  check(near(by.share, by.hours / (WORK[1] - WORK[0]), 1e-9), `its share is of one hand's day (${by.share})`);
  // for whom it is reckoned, and by hand alone (VB-1604): one trip for each six of the party; the tile card asks for one trip's people
  const eight = siteWater(st, at(59, 12), 8, null),
    card = siteWater(st, at(59, 12));
  check(by.people === 3 && by.trips === 1, `reckoned for the party's three, in one trip (${by.people}, ${by.trips})`);
  check(eight.people === 8 && eight.trips === 2 && near(eight.hours, 2 * by.hours, 1e-9), `eight make two trips by hand, twice the hours (${eight.hours})`);
  check(near(eight.hours, Water.dayFetch(by.source.walk, 8).hours, 1e-9), 'the one reckoning, with no cart');
  check(card.people === WATER.hand && card.trips === 1 && near(card.hours, by.hours, 1e-9), `the tile card's: for six, one trip (${card.people})`);
  const off = siteWater(st, at(53, 12), 3, null);
  check(off.by === 'source' && near(off.source.walk, 0.875) && near(off.hours, 1.95), `7 steps of meadow off: 1.95 hours (${JSON.stringify(off)})`);
  check(near(siteFetch(w, at(53, 12), 3), off.hours, 1e-6), 'the search weighs the same hours as the estimate shows');
  // a well of its own, where the ground has one: the drawing, and the digging at the band's middle over WELL.payYears
  w.waterDepth[at(53, 12)] = 3;
  const own = siteWater(st, at(53, 12), 3, null),
    hours = WATER.draw + bandMid(0) / (WELL.payYears * YEAR_DAYS);
  check(
    own.by === 'well' && near(own.hours, hours, 1e-9) && own.well.band === 'shallow' && own.well.range.join() === bandHours(0).join(),
    `shallow ground far from the brook: a well of its own, ${hours.toFixed(2)} hours a day, its band and range (${JSON.stringify(own)})`,
  );
  check(near(bandMid(0), 26) && near(bandMid(1), 44) && near(bandMid(2), 76), 'the bands\' middles: 26, 44 and 76 hours');
  check(siteWater(st, at(59, 12), 3, null).by === 'source', 'beside the brook the brook is the less, well or no well');
  // the village a site would join: its well on the green, by the walk as it is now
  check(v.well && w.fresh[v.center] === FRESH.WELL, 'the village starts with its well');
  const t = at(41, 12),
    joined = siteWater(st, t, 3);
  check(
    joined.by === 'village' && joined.village.name === v.name && near(joined.hours, tripHours(joined.village.walk), 1e-9) && joined.village.walk <= 1,
    `a site ${SETTLE.centreApart - 1} steps or fewer from a green with a well: the village's well (${JSON.stringify(joined)})`,
  );
  check(siteWater(st, at(53, 12), 3).village === null, 'a site far from every green joins none');
  const none = siteWater(st, at(10, 12), 3, null);
  w.freshWalk[at(10, 12)] = Infinity;
  const dry = siteWater(st, at(10, 12), 3, null);
  check(none.by === 'source' && none.hours < tripHours(WATER.search), 'a long walk is a source still');
  check(
    dry.by === 'none' && dry.source === null && dry.well === null && near(dry.hours, tripHours(WATER.search), 1e-9),
    `no source and no well: none, at the farthest fetch a farm makes (${JSON.stringify(dry)})`,
  );
}
// ---- 2. of two sites alike but for their water, the search ranks the nearer first ----
{
  const keep = RIVER.site.slice(),
    perFetch = SETTLE.perFetch;
  RIVER.site.fill(0); // the brook as water only: not the score a river's nearness adds to a site (sim/layout siteScore)
  const { w, st, v, at } = world();
  brook(w, at(62, 12));
  lay(w, NO_WELL);
  SETTLE.perFetch = 0;
  const plain = new Map(cands(st, v).map(([t, , s]) => [t, s]));
  SETTLE.perFetch = perFetch;
  const weighed = cands(st, v),
    rank = new Map(weighed.map(([t], k) => [t, k]));
  check(weighed.length > 20, `the meadow has candidates (${weighed.length})`);
  check(
    weighed.every(([t, , s]) => near(plain.get(t) - s, SETTLE.perFetch * siteFetch(w, t, 3), 1e-9)),
    `every candidate loses SETTLE.perFetch (${SETTLE.perFetch}) a daily hour of its fetch, and none is dropped (${plain.size}, ${weighed.length})`,
  );
  // pairs alike in land and nearness (their scores without the water within 0.05) whose walks to water differ by half an hour or more
  let pairs = 0,
    wrong = 0;
  const list = [...plain].sort((a, b) => a[1] - b[1]);
  for (let k = 1; k < list.length; k++) {
    const [a, sa] = list[k - 1],
      [b, sb] = list[k];
    if (sb - sa > 0.05 || Math.abs(w.freshWalk[a] - w.freshWalk[b]) < 0.5) continue;
    pairs++;
    const nearer = w.freshWalk[a] < w.freshWalk[b] ? a : b,
      further = nearer === a ? b : a;
    if (rank.get(nearer) > rank.get(further)) wrong++;
  }
  check(pairs > 0 && wrong === 0, `of two sites alike but for their water the nearer ranks first (${pairs} pairs, ${wrong} the other way)`);
  // the sites a leader chooses among: at most SETTLE.shown, best first, the first the one a leader not played takes, each with its water
  const use = Settle.landInUse(st),
    shown = Settle.sites(st, v, use, weighed, 3),
    first = Settle.newSite(st, v, use, weighed);
  check(shown.length > 1 && shown.length <= SETTLE.shown, `the leader is shown the best sites, at most ${SETTLE.shown} (${shown.length})`);
  check(first && shown[0].house === first.house && shown[0].field === first.field, 'the first shown is the one a leader not played takes');
  check(
    shown.every((s, k) => !k || shown[k - 1].score >= s.score),
    `best first (${shown.map((s) => s.score.toFixed(2))})`,
  );
  check(
    shown.every((s) => s.water && s.water.by === 'source' && s.water.source.name === 'a brook' && near(s.water.hours, siteFetch(w, s.house, 3), 1e-6)),
    `each carries its water as the leader's estimate (${JSON.stringify(shown[0].water)})`,
  );
  RIVER.site.splice(0, keep.length, ...keep);
}
// ---- 3. no site is refused for its water: with no source and no well anywhere, one is still offered ----
{
  const { w, st, v } = world();
  lay(w, NO_WELL);
  check(w.freshWalk.every((x) => x === Infinity), 'the drawn land has no fresh water');
  const use = Settle.landInUse(st),
    list = cands(st, v),
    site = Settle.newSite(st, v, use, list),
    shown = Settle.sites(st, v, use, list, 3);
  check(list.length > 0 && list.every(([, , s]) => Number.isFinite(s)), 'every candidate keeps a score');
  check(!!site, 'a site with no source and no well is still offered');
  check(shown.length > 0 && shown[0].water.by === 'none' && shown[0].house === site.house, `and shown as it is (${JSON.stringify(shown[0] && shown[0].water)})`);
}
// ---- 4. a plot's site in a village (sim/expansion findSite, VB-1596): of two sites alike but for the walk to the village's well, the nearer ----
{
  const X = VB['sim/expansion'],
    { hexSteps } = VB['sim/hex'];
  const { w, st, v } = world();
  lay(w, NO_WELL); // no fresh water and no well of a site's own: the village's well is all the water there is
  w.worn.fill(0);
  const perFetch = SETTLE.perFetch,
    unweighed = () => {
      SETTLE.perFetch = 0;
      const s = X.findSite(st, v);
      SETTLE.perFetch = perFetch;
      return s;
    },
    walk = (t) => siteWater(st, t, 2, v).village.walk;
  const plain = unweighed(),
    even = X.findSite(st, v);
  check(plain && even && even.house === plain.house, 'on even ground the water moves no plot: every site as near the green walks as far');
  // a worn way from the green to another site as far from it, which the plot's own score does not read
  const d = hexSteps(w, v.center, plain.house);
  let other = -1,
    by = -1;
  for (let k = 0; k < 6 && other < 0; k++) {
    const a = w.nb[v.center * 6 + k];
    if (a < 0 || st.used.has(a) || hexSteps(w, a, plain.house) < 2) continue;
    for (let m = 0; m < 6; m++) {
      const b = w.nb[a * 6 + m];
      if (b < 0 || st.used.has(b) || b === plain.house || hexSteps(w, v.center, b) !== d || hexSteps(w, b, plain.house) < 3) continue;
      w.worn[a] = w.worn[b] = 3;
      const s = unweighed(),
        t = X.findSite(st, v);
      if (s && s.house === plain.house && t && t.house === b) {
        other = b;
        by = a;
        break;
      }
      w.worn[a] = w.worn[b] = 0;
    }
  }
  check(d === 2 && other >= 0, `a site as far from the green as the first (${d} steps), alike in the plot's score, a worn way to it`);
  if (other >= 0) {
    check(unweighed().house === plain.house, 'the plot score alone does not tell them apart: unweighed, the first is chosen still');
    check(
      walk(other) < walk(plain.house) && X.findSite(st, v).house === other,
      `of two plot sites alike but for the walk to the village's well the nearer is chosen (${walk(other)} against ${walk(plain.house)} hours, by ${by})`,
    );
  }
  // no site is refused for its water: with no well on the green either, the plot is the one the land alone gives
  w.worn.fill(0);
  v.well = false;
  w.fresh[v.center] = FRESH.NONE;
  const dry = X.findSite(st, v);
  check(siteWater(st, plain.house, 2, v).by === 'none', 'a village with no water at all');
  check(dry && dry.house === plain.house && dry.field === plain.field, 'a plot is still found where no site has water, the same as unweighed');
}
if (failed) process.exit(1);
console.log("sitewater ok: the leader's estimate (source, village well, own well), the search weighs the fetch, no site refused for its water; a plot's site by the walk to the village's well");
