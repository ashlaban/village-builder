// VB-1601: water at a site (design.md, Water by the site, The thirsty pawn: a pawn working away drinks and fetches at the site's source in
// the same way). On drawn maps (tests/lib/tiny.js): a booth's water is a job of the booth's own, posted each day at the booth's source
// (found once) and walked by one who sleeps there, before its tasks; the day it is not in, those who sleep there end their day by their
// own thirst; one of the booth that drinks at the source by the verb takes the booth's fetch from there; a lodger under the open sky goes
// to drink each morning, and where no source is in reach goes on with its tasks; the pawn's opportunities offer Drink, with the verb's
// reason where it is refused.
const VB = require('../src/load.js'),
  Sim = VB.sim,
  Thirst = VB['sim/thirst'];
const { tinyWorld, tinyState, tileAt } = require('./lib/tiny.js');
const { checkState } = require('./lib/invariants.js');
const { FRESH } = VB['world/water'];
const { DAY, YEAR, cal } = VB['sim/rules'];
const { KINDS } = VB['sim/kinds'];
const { issue } = VB['sim/commands'],
  { post } = VB['sim/jobs'],
  { stayOf } = VB['sim/pose'],
  Stores = VB['sim/stores'];
let failed = 0;
const check = (ok, m) => {
  if (!ok) {
    failed++;
    console.error('BOOTHWATER FAIL:', m);
  }
};
const hourOf = (st) => st.t - Math.floor(st.t / DAY) * DAY;
const to = (st, h) => Sim.advance(st, (((h - hourOf(st)) % DAY) + DAY) % DAY || DAY); // to the next h:00
const W = 60,
  KEY = 'fell:away';
// A village of two farms; a site 24 tiles of meadow east of the first farm's house (3 hours), with a brook 3 tiles beyond it unless
// `dry`; the grown of the first household may lodge there (its children are aged, a test's write: one of 7 or over stays, VB-1602).
function scene(dry = false) {
  const lay = (w) => tinyState(w, [{ at: [6, 4], farms: 2, sizes: [5, 4] }], { seed: 3 });
  const house = lay(tinyWorld(Array(9).fill('.'.repeat(W)), { seed: 3 })).farmsteads[0].house;
  const w = tinyWorld(Array(9).fill('.'.repeat(W)), { seed: 3 }),
    site = tileAt(w, (house % w.COLS) + 24, Math.floor(house / w.COLS)),
    brook = site + 3;
  if (!dry) {
    w.river[brook] = 1;
    w.fresh[brook] = FRESH.BROOK;
  }
  const st = lay(w),
    hh = st.households[0];
  if (dry) {
    // a test's write: no well on the green nor at a house, so no source within the search
    for (let i = 0; i < w.N; i++) if (w.fresh[i] === FRESH.WELL) w.fresh[i] = FRESH.NONE;
    st.villages[0].well = null;
  }
  for (const id of hh.members) if (st.pawns[id].age < 7) st.pawns[id].born -= 7 * YEAR;
  const grown = hh.members.filter((id) => st.pawns[id].age >= 14 && st.pawns[id].age < 60);
  Stores.put(st, hh, 'grain', 400, 'harvest', { barley: 400 });
  return { st, hh, site, brook, grown };
}
// The task the stays are for, posted again before each morning's review could take it down (as tests/away.js).
const keep = (st, hh, site) => post(st, KEY, 'fell', { type: 'household', id: hh.id }, site, { hours: 200, hands: 4 });
const lodge = (st, id, site, days = 4) =>
  issue(st, { actor: id, verb: 'lodge', target: site, args: { why: 'work', days, jobs: [KEY] }, source: 'pawn' });
// a booth stands at the site (a test's write, as tests/night.js: its staking and raising are tests/booth.js')
const raise = (st, hh, site, maker) =>
  st.booths.push({ id: st.boothSeq++, tile: site, by: hh.id, maker, guests: [], built: st.t, wood: 20, cond: 1, condAt: st.t });

// ---- 1. the booth's fetch: posted at its source, walked by one who sleeps there before its tasks; the day it is not in ----
{
  const { st, hh, site, brook, grown } = scene();
  const [x, y] = grown;
  check(KINDS.boothwater && KINDS.boothwater.vital && KINDS.boothwater.to === 'site', 'the kind boothwater, lived by, carried to its site');
  to(st, 5);
  raise(st, hh, site, x);
  const b = st.booths[0];
  keep(st, hh, site);
  to(st, 6);
  const lodged = [lodge(st, x, site), lodge(st, y, site)];
  check(lodged.every((r) => r === true), `two of the household lodge at the booth (${lodged})`);
  check(stayOf(st, x).roof === 'booth' && stayOf(st, y).roof === 'booth', 'under its roof');
  const day = cal(st.t).day;
  let fetcher = null,
    sawJob = null;
  for (let h = 0; h < 8 && b.waterDay !== day; h += 0.1) {
    Sim.advance(st, 0.1);
    const j = st.jobs.get(`boothwater:o${b.id}`);
    if (j) sawJob = { owner: j.owner.type, site: j.site, dest: j.dest };
    for (const id of [x, y]) if (st.agents[id].job && st.agents[id].job.kind === 'boothwater') fetcher = id;
  }
  check(b.waterDay === day, `the booth's water is in on the day they came (${b.waterDay} against ${day})`);
  check(b.water && b.water.tile === brook && b.water.cls === FRESH.BROOK, `its source found once, the brook (${JSON.stringify(b.water)})`);
  check(sawJob && sawJob.owner === 'booth' && sawJob.site === brook && sawJob.dest === site, `a job of the booth's, at the source, to its tile (${JSON.stringify(sawJob)})`);
  check(fetcher !== null && st.pawns[fetcher].drank >= day * DAY, 'one who sleeps there walked it, and drank at the source');
  check(!st.jobs.has(`boothwater:o${b.id}`), 'the fetch is taken down once the water is in');
  to(st, 12);
  const other = fetcher === x ? y : x;
  check(st.agents[other].job && st.agents[other].job.key === KEY, 'the other is at the task its stay names');
  check(st.agents[fetcher].job && st.agents[fetcher].job.key === KEY, 'and the fetcher after its fetch');
  check(checkState(st).length === 0, `invariants, the water in: ${checkState(st)}`);
  to(st, 1);
  check(!Thirst.thirsty(st, st.pawns[x]) && !Thirst.thirsty(st, st.pawns[y]), 'neither ends the day thirsty: the booth had its water');
  check(st.pawns[other].drank === day * DAY + Thirst.THIRST.meal, 'who did not draw drank at the day\'s meal');
  // the second day its water is fetched again
  to(st, 5);
  keep(st, hh, site);
  to(st, 12);
  check(b.waterDay === day + 1, 'fetched again the next morning');
  // the third day no water comes (a test's write: its source is out of reach): they end the day by their own thirst
  to(st, 1);
  b.water = { tile: -1, cls: FRESH.NONE, walk: 0 };
  const due0 = (st.thirstDue || []).length;
  to(st, 5);
  keep(st, hh, site);
  to(st, 23);
  check(b.waterDay === day + 1 && !st.jobs.has(`boothwater:o${b.id}`), 'no fetch is posted with no source in reach');
  const h0 = [x, y].map((id) => st.pawns[id].health);
  to(st, 1);
  check(Thirst.thirsty(st, st.pawns[x]) && Thirst.thirsty(st, st.pawns[y]), 'the day its water is not in, they end the day thirsty: not watered by the roof');
  check((st.thirstDue || []).length === due0 + 2, 'and each is held due to go for its own drink');
  check([x, y].every((id, i) => st.pawns[id].health < h0[i]), 'the dry day costs each its health');
  check(checkState(st).length === 0, `invariants, a dry booth: ${checkState(st)}`);
}

// ---- 2. one of the booth that drinks at its source by the verb takes the booth's fetch from there ----
{
  const { st, hh, site, brook, grown } = scene();
  const x = grown[0],
    a = st.agents[x];
  to(st, 5);
  raise(st, hh, site, x);
  const b = st.booths[0];
  to(st, 15);
  Sim.advance(st, 0.5);
  check(lodge(st, x, site) === true, 'one lodges in the afternoon');
  // it comes to its bed after the end of work, when no day is given out: the pawn is sent to drink, as the played pawn may be
  Sim.advance(st, 3.2);
  check(a.away !== undefined && !a.job && b.waterDay === undefined, `at its bed after work, the booth's water not in (${a.leg && a.leg.kind})`);
  const day = cal(st.t).day;
  check(issue(st, { actor: x, verb: 'drink', source: 'player' }) === true, 'the verb drink is accepted');
  check(a.job && a.job.kind === 'drink' && a.job.site === brook, 'it goes to the booth\'s source, with no search of its own');
  let took = false;
  for (let h = 0; h < 3 && b.waterDay !== day; h += 0.1) {
    Sim.advance(st, 0.1);
    if (a.job && a.job.kind === 'boothwater') took = true;
  }
  check(st.pawns[x].drank >= day * DAY + 18.7, 'it drank at the source');
  check(took, 'and took the booth\'s fetch from there');
  check(b.waterDay === day, 'the booth has its water too');
  check(checkState(st).length === 0, `invariants, the fetch taken at the source: ${checkState(st)}`);
}

// ---- 3. a lodger under the open sky drinks at the site's source each morning, before its tasks ----
{
  const { st, hh, site, brook, grown } = scene();
  const x = grown[0],
    p = st.pawns[x],
    a = st.agents[x];
  to(st, 5);
  keep(st, hh, site);
  to(st, 6);
  check(lodge(st, x, site, 2) === true && stayOf(st, x).roof === 'none', 'a stay of two days under the open sky');
  const day = cal(st.t).day;
  let drinks = 0,
    thirstyEnds = 0;
  for (let d = 0; d < 2; d++) {
    let went = false;
    for (let h = 0; h < 6; h += 0.1) {
      Sim.advance(st, 0.1);
      if (a.job && a.job.kind === 'drink' && a.job.site === brook) went = true;
    }
    if (went) drinks++;
    check(p.drank >= (day + d) * DAY, `day ${d + 1}: it has drunk by noon`);
    check(a.job && a.job.key === KEY, `day ${d + 1}: then at the task its stay names (${a.job && a.job.key})`);
    to(st, 1);
    if (Thirst.thirsty(st, p)) thirstyEnds++;
    to(st, 5);
    keep(st, hh, site);
    to(st, 6);
  }
  check(drinks === 2 && thirstyEnds === 0, `a drink each morning, no day ended thirsty (${drinks}, ${thirstyEnds})`);
  check(checkState(st).length === 0, `invariants, the open sky: ${checkState(st)}`);
}

// ---- 4. with no source in reach it is refused once that day, and goes on with its tasks ----
{
  const { st, hh, site, grown } = scene(true);
  const x = grown[0],
    a = st.agents[x];
  to(st, 5);
  keep(st, hh, site);
  to(st, 6);
  check(lodge(st, x, site, 2) === true, 'a stay where no water is');
  to(st, 12);
  const s = stayOf(st, x);
  check(s && s.noWater === cal(st.t).day, `it found no source that day (${s && s.noWater})`);
  check(a.job && a.job.key === KEY, 'and is at its task');
  const drink = Sim.opportunities(st, x).find((o) => o.verb === 'drink');
  check(drink && /no source of fresh water/.test(drink.why), `Drink is refused with the verb's reason (${drink && drink.why})`);
  check(checkState(st).length === 0, `invariants, no water: ${checkState(st)}`);
}

// ---- 5. the pawn's opportunities offer Drink ----
{
  const { st, grown } = scene();
  const x = grown[0];
  to(st, 8);
  const of = () => Sim.opportunities(st, x).filter((o) => o.verb === 'drink');
  check(of().length === 1 && of()[0].why === null && of()[0].holder === null && of()[0].basis === 'self', `Drink, an act of its own (${JSON.stringify(of())})`);
  const a = st.agents[x],
    was = a.journey;
  a.journey = 'rest'; // a test's write: on the road
  check(/on the road/.test(of()[0].why), `refused on the road, with the verb's reason (${of()[0].why})`);
  a.journey = was;
}

if (failed) process.exit(1);
console.log("boothwater ok: a booth's water is walked for by who sleeps there; a dry booth's day is its sleepers' own thirst; the drink takes the fetch; the open sky drinks each morning; Drink is offered");
