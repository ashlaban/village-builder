// @suite fast
// VB-1587: a new site's well is dug by its settlers with the booth and the clearing. On drawn maps (tests/lib/tiny.js): a party that
// settles a site with no water in reach, chosen for the well in its ground, has the farm marked (farmstead.wellMeant); from its booth
// it gathers the lining's stone and digs beside its first field's breaking, whatever the season; until water is struck no source is
// in reach and none is drawn at (nothing is drawn at the booth from nowhere), and from then on the fetch is the drawing alone, 0.1
// hours a trip; a site beside a brook is not marked, and its booth household has no building step and digs nothing.
const VB = require('../src/load.js'),
  Sim = VB.sim,
  Water = VB['sim/water'],
  Projects = VB['sim/projects'];
const { tinyWorld, tinyState, tileAt } = require('./lib/tiny.js');
const { checkState } = require('./lib/invariants.js');
const { FRESH, wellHours } = VB['world/water'];
const { DAY } = VB['sim/rules'];
const { issue } = VB['sim/commands'];
const { WATER } = Water;
let failed = 0;
const check = (ok, m) => {
  if (!ok) {
    failed++;
    console.error('SITEWELL FAIL:', m);
  }
};
const near = (x, y, e = 0.01) => Math.abs(x - y) <= e;
// A village of two farms in the west of a meadow; a party of the grown ones (two at most) of its first household settles on `at`, with a brook
// `brook` tiles east of the site's house (0: none on the map), in ground `depth` metres to the water.
function settle(at, brook, depth) {
  const w = tinyWorld(
      Array.from({ length: 15 }, () => '.'.repeat(44)),
      { stones: 200 },
    ),
    house = tileAt(w, at[0], at[1]),
    field = tileAt(w, at[0] + 2, at[1] + 2);
  w.waterDepth[house] = depth;
  if (brook) {
    w.river[house + brook] = 1;
    w.fresh[house + brook] = FRESH.BROOK;
  }
  const st = tinyState(w, [{ at: [7, 7], farms: 2, sizes: [6, 4] }], { seed: 7 });
  Water.layWalk(w);
  const home = st.households[0],
    grown = home.members.filter((id) => st.pawns[id].age >= 18 && id !== home.holder).slice(0, 2);
  home.grain.barley += 3000; // a family that can spare the provisions
  const n = st.farmsteads.length,
    res = require('./lib/settled.js')(VB, st, grown[0], { from: 0, party: { all: grown, followers: [] }, house, field });
  const f = st.farmsteads[n] || null;
  return { st, w, res, grown, f, hh: f ? st.households[f.household] : null, house };
}
const wellPlan = (st, hh) => Projects.projectsOf(st, 'household', hh.id).find((p) => p.what === 'well') || null;
// ---- 1. an inland site, no water within reach: the well is the site's water, and the party digs it from its booth ----
{
  const { st, w, res, grown, f, hh, house } = settle([30, 7], 0, 6);
  check(res === true && grown.length >= 1 && f && !f.booth, `a party settles in its finished cottage (${res}, ${grown})`);
  const est = Water.siteWater(st, house, 2);
  check(est.by === 'well' && f.wellMeant === true, `the site's water is the well it means to dig (${est.by}, ${f.wellMeant})`);
  check(f.fields.length === 1, 'its first field, broken at the site, is its own (VB-787)');
  let begun = null,
    days = 0,
    drawn = 0;
  for (; days < 90 && w.fresh[house] !== FRESH.WELL; days++) {
    Sim.advance(st, DAY);
    if (w.fresh[house] !== FRESH.WELL && f.water && f.water.tile >= 0) drawn++;
    const p = wellPlan(st, hh);
    if (p && !begun) {
      begun = { day: days, hours: p.steps[0].hours, stone: p.reserved.stone, booth: f.booth, field: !!Projects.ownOf(st, hh.id) };
      const bad = checkState(st);
      check(!bad.length, `invariants while digging: ${bad.slice(0, 3).join('; ')}`);
    }
  }
  check(
    begun && begun.hours === wellHours(6) && begun.stone === 6,
    `from its booth, 6 loads gathered and a well of ${wellHours(6)} hours begun (${JSON.stringify(begun)})`,
  );
  check(w.fresh[house] === FRESH.WELL && f.wellMeant === undefined, `water is struck within 90 days (${days}), and the mark goes`);
  check(drawn === 0, `until then no source lay in reach, and none was drawn at (${drawn} days with one)`);
  check(
    f.water && f.water.tile === house && f.water.walk === 0 && near(Sim.waterOf(st, f).hours, WATER.draw),
    `the fetch is the drawing alone (${JSON.stringify(f.water)})`,
  );
  Sim.advance(st, 2 * DAY);
  const bad = checkState(st);
  check(!bad.length, `invariants after: ${bad.slice(0, 3).join('; ')}`);
  console.log(`  inland: begun on day ${begun && begun.day}, struck on day ${days}; in its booth still: ${f.booth === true}`);
}
// ---- 2. a site a step from a brook: the brook is its water; no mark, no stone gathered, no well from the booth ----
{
  const { st, w, res, f, hh, house } = settle([30, 7], 1, 6);
  const by = Water.siteWater(st, house, 2).by;
  check(res === true && by === 'source' && f.wellMeant === undefined, `beside a brook the site is not chosen for a well (${by})`);
  for (let d = 0; d < 30; d++) Sim.advance(st, DAY);
  check(
    f.water && f.water.cls === FRESH.BROOK && w.fresh[house] !== FRESH.WELL && !wellPlan(st, hh),
    `it draws at the brook and digs nothing (${JSON.stringify(f.water)})`,
  );
  check(!st.plans.households.get(hh.id).build, 'and its booth has no building step: what stone it has, its field\'s clearing gave');
}
if (failed) process.exit(1);
console.log('sitewell ok: a site chosen for its well is dug from the booth, beside the field; the fetch then the drawing alone');
