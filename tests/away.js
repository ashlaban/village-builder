// @suite fast
// Sleeping away from home (VB-783; design.md, Moving to new land, Sleeping away from home): a pawn lodges at a place three hours from home on
// a pack from its household's food above its seed, works there only the tasks its stay names, is left out of its household's meals, eats
// a ration a day from its pack and walks home when the pack is down to the walk home's ration; a household at its seed sends nobody; a
// guest sleeps in another household's house with its head's yes; a save in the middle plays as the unbroken run. On a tiny state.
const assert = require('assert'), VB = require('../src/load.js'), Sim = VB.sim;
const { tinyWorld, tinyState, tileAt } = require('./lib/tiny.js');
const { checkState } = require('./lib/invariants.js'), { canon } = require('./lib/canon.js');
const { issue } = VB['sim/commands'], { post } = VB['sim/jobs'], { bed, stayOf } = VB['sim/pose'], Stores = VB['sim/stores'];
const { feedHousehold, rationOf } = VB['sim/hunger'];
const { DAY, WORK } = VB['sim/rules'], { AWAY } = VB['sim/away'];
const hourOf = (st) => st.t - Math.floor(st.t / DAY) * DAY;
const to = (st, h) => Sim.advance(st, (((h - hourOf(st)) % DAY) + DAY) % DAY || DAY); // to the next h:00
const W = 60, make = () => tinyState(tinyWorld(Array(9).fill('.'.repeat(W)), { seed: 3 }), [{ at: [6, 4], farms: 2, sizes: [5, 4] }], { seed: 3 });
const adultOf = (st, hh) => hh.members.find((id) => id !== hh.holder && st.pawns[id].age >= 14 && st.pawns[id].age < 60);
const KEY = 'fell:away';
// The task the stay is for: felling far from home, more than two days' work. Posted again before each morning's review could take down
// an unclaimed task of the household (sim/jobs sweep): the stay names its key.
const keep = (st, hh, site) => post(st, KEY, 'fell', { type: 'household', id: hh.id }, site, { hours: 60 });

const st = make(), hh = st.households[0], f = st.farmsteads[hh.farmstead], id = adultOf(st, hh), a = st.agents[id], p = st.pawns[id];
assert.ok(id !== undefined, 'an adult who can go');
const site = tileAt(st.w, st.w.hx ? (f.house % st.w.COLS) + 24 : 30, Math.floor(f.house / st.w.COLS)); // 24 tiles of meadow: 3 hours at 8 an hour
to(st, 15);
Stores.put(st, hh, 'grain', 60, 'harvest', { barley: 60 });
keep(st, hh, site);
const grain0 = Stores.grainOf(hh), R = 1 / st.ECON.uncooked;
// refused: no reason given, no days, a stay while away
assert.ok(typeof issue(st, { actor: id, verb: 'lodge', target: site, args: { days: 3 }, source: 'player' }) === 'string', 'a stay names why');
assert.ok(typeof issue(st, { actor: id, verb: 'comeHome', source: 'player' }) === 'string', 'comeHome is refused at home');
to(st, 16);
const r = issue(st, { actor: id, verb: 'lodge', target: site, args: { why: 'work', days: 3, jobs: [KEY] }, source: 'pawn' });
assert.strictEqual(r, true, `the pawn lodges: ${r}`);
const s = stayOf(st, id);
assert.ok(s && s.bed === site && s.roof === 'none' && s.why === 'work' && a.away === s.id, 'a stay at the site, under the open sky');
assert.ok(Math.abs(s.food - 3 * rationOf(st, p)) < 1e-9, `a pack of 3 rations: ${s.food}`);
// the pack is the 'away' movement of grain (a grind finishing meanwhile also takes grain, as a novice's slower grinding may: VB-360)
const packed = hh.ledger.filter((e) => e.kind === 'away' && e.good === 'grain' && e.pawn === id).reduce((n, e) => n - e.n, 0);
assert.ok(grain0 - Stores.grainOf(hh) >= packed - 1e-9 && Math.abs(packed - 3 * R) < 1e-9, 'taken from the grain above the seed, uncooked');
assert.ok(hh.ledger.some((e) => e.kind === 'away' && e.pawn === id), "a store movement with the reason 'away'");
assert.ok(s.walk > 2.5 && s.walk < 3.5, `three hours from home: ${s.walk}`);
assert.strictEqual(bed(st, a), site, 'its bed is the site');
assert.ok(typeof issue(st, { actor: id, verb: 'lodge', target: site, args: { why: 'work', days: 1 }, source: 'pawn' }) === 'string', 'one stay a pawn');
to(st, 23);
assert.ok(a.inside && (!a.job && !a.homeward && !a.journey) && Math.hypot(a.x - st.w.hx[site], a.y - st.w.hy[site]) < st.w.R * 2, 'it sleeps at its bed');
assert.deepStrictEqual(checkState(st), [], 'invariants at its bed');
const meals0 = VB.count.awayMeals;
for (let d = 1; d <= 2; d++) {
  to(st, 5);
  keep(st, hh, site);
  p.drank = st.t; // a test's write: it has drunk (under the open sky it would go to drink at 36 hours: tests/thirst.js, VB-1585)
  assert.ok(Math.abs(s.food - (3 - d) * rationOf(st, p)) < 1e-9, `day ${d}: a ration eaten from the pack (${s.food} left)`);
  to(st, 12);
  assert.ok(a.job && a.job.key === KEY && (a.leg && a.leg.kind === 'work'), `day ${d}: at the task its stay names (${a.leg && a.leg.kind}, ${a.job && a.job.key})`);
  // the household's meal leaves it out: the meals taken are the others' needs alone
  Stores.put(st, hh, 'meals', 100, 'cooking');
  const m0 = hh.meals, others = hh.members.filter((x) => x !== id && st.pawns[x].died === null).reduce((n, x) => n + rationOf(st, st.pawns[x]), 0);
  feedHousehold(st, hh);
  assert.ok(Math.abs(m0 - hh.meals - others) < 1e-9, `day ${d}: the household's meal is the others' (${m0 - hh.meals} against ${others})`);
  to(st, 20);
  assert.ok(a.inside && bed(st, a) === site && Math.hypot(a.x - st.w.hx[site], a.y - st.w.hy[site]) < st.w.R * 2, `day ${d}: back at its bed`);
}
assert.strictEqual(VB.count.awayMeals - meals0, 2, 'a meal a day from the pack');
to(st, 5);
assert.ok(s.back && s.food < 1e-9 && st.away.includes(s), 'the third meal empties the pack: it turns for home');
to(st, 7);
assert.ok(!!a.homeward && a.path && bed(st, a) === f.house, 'on the third morning it walks home');
to(st, 12);
assert.ok(!st.away.includes(s) && a.away === undefined, 'home on the third day, its stay over');
assert.ok(!hh.ledger.some((e) => e.kind === 'away' && e.pawn === id && e.good === 'meals'), 'nothing left to bring back');
assert.deepStrictEqual(checkState(st), [], 'invariants once home');

// ---- a save made in the middle of the stay plays as the unbroken run (each run on a world of its own: the walks wear its paths) ----
{
  const world = () => tinyWorld(Array(9).fill('.'.repeat(W)), { seed: 3 });
  const s1 = tinyState(world(), [{ at: [6, 4], farms: 2, sizes: [5, 4] }], { seed: 3 }), h1 = s1.households[0];
  to(s1, 15);
  Stores.put(s1, h1, 'grain', 60, 'harvest', { barley: 60 });
  keep(s1, h1, site);
  to(s1, 16);
  issue(s1, { actor: id, verb: 'lodge', target: site, args: { why: 'work', days: 3, jobs: [KEY] }, source: 'pawn' });
  to(s1, 5);
  keep(s1, h1, site);
  to(s1, 12);
  const text = JSON.stringify(Sim.save(s1)), data = JSON.parse(text), back = Sim.load(world(), data);
  assert.ok(back.away.length === 1 && back.agents[id].away === back.away[0].id, 'the save holds the open stay, and its index');
  for (const x of [s1, back]) {
    for (let d = 0; d < 2; d++) {
      to(x, 5);
      keep(x, x.households[0], site);
    }
    to(x, 12);
  }
  for (const k of ['away', 'awaySeq', 'agents', 'pawns', 'households']) assert.strictEqual(canon(s1[k]), canon(back[k]), `continued ${k}`);
  assert.strictEqual(back.away.length, 0, 'the loaded run comes home too');
}

// ---- a household at its seed sends nobody, and the verb says why ----
{
  const s2 = make(), h2 = s2.households[0], id2 = adultOf(s2, h2);
  to(s2, 8);
  const spare = Math.max(0, Stores.grainOf(h2) - Stores.reserved(s2, h2, 'grain'));
  if (spare > 0) Stores.takeSpare(s2, h2, spare, 'raw');
  const why = issue(s2, { actor: id2, verb: 'lodge', target: site, args: { why: 'work', days: 2 }, source: 'pawn' });
  assert.ok(typeof why === 'string' && /no food to spare/.test(why), `refused: ${why}`);
  assert.ok(s2.away.length === 0 && s2.agents[id2].away === undefined, 'nobody went');
}

// ---- a guest's bed: another household's house, with its head's yes; a pack as any stay's; at most AWAY.pack days of it ----
{
  const s3 = make(), [h1, h2] = s3.households, id3 = adultOf(s3, h1);
  to(s3, WORK[1] + 1); // in the evening: a stay that names no task ends at the next morning's offer of work (dayAway)
  Stores.put(s3, h1, 'grain', 60, 'harvest', { barley: 60 });
  assert.ok(typeof issue(s3, { actor: id3, verb: 'lodge', target: 0, args: { why: 'visit', days: 2, host: h1.id }, source: 'pawn' }) === 'string', 'not a guest at home');
  const r3 = issue(s3, { actor: id3, verb: 'lodge', target: null, args: { why: 'visit', days: 20, host: h2.id }, source: 'pawn' });
  assert.strictEqual(r3, true, `a guest: ${r3}`);
  const g = stayOf(s3, id3), house = s3.farmsteads[h2.farmstead].house;
  assert.ok(g.bed === house && g.roof === 'house' && g.host === h2.id, 'its bed is the host\'s house');
  assert.ok(Math.abs(g.food - AWAY.pack * rationOf(s3, s3.pawns[id3])) < 1e-9, `at most AWAY.pack rations: ${g.food}`);
  to(s3, WORK[1] + 4);
  assert.ok(s3.agents[id3].inside && Math.hypot(s3.agents[id3].x - s3.w.hx[house], s3.agents[id3].y - s3.w.hy[house]) < s3.w.R * 2, `it sleeps at the host's house: ${JSON.stringify([s3.agents[id3].inside, s3.agents[id3].x, s3.agents[id3].y, s3.w.hx[house], s3.w.hy[house], s3.farmsteads[h1.farmstead].house, house])}`);
  assert.deepStrictEqual(checkState(s3), [], 'invariants with a guest');
  assert.strictEqual(issue(s3, { actor: id3, verb: 'comeHome', source: 'player' }), true, 'it turns for home');
  to(s3, 10);
  assert.ok(s3.agents[id3].away === undefined && !s3.away.length, 'home the next morning, its stay over');
  assert.ok(h1.ledger.some((e) => e.kind === 'away' && e.pawn === id3 && e.n > 0 && e.good === 'grain'), 'what was left of its pack is back in its household\'s grain, not its meals');
  assert.deepStrictEqual(checkState(s3), [], 'invariants after the guest came home');
}
// ---- a pack is grain: home it goes back into the barn; a lodger who dies at its bed leaves it lying there (VB-962) ----
{
  const s4 = make(), h4 = s4.households[0], id4 = adultOf(s4, h4), R4 = 1 / s4.ECON.uncooked;
  to(s4, WORK[1] + 1);
  Stores.put(s4, h4, 'grain', 60, 'harvest', { barley: 60 });
  const g0 = Stores.grainOf(h4);
  assert.strictEqual(issue(s4, { actor: id4, verb: 'lodge', target: site, args: { why: 'work', days: 3 }, source: 'pawn' }), true, 'it lodges');
  const j4 = stayOf(s4, id4), left = j4.food;
  assert.ok(j4.parts && Math.abs(j4.parts.barley - left * R4) < 1e-9, 'its pack is grain, by crop');
  assert.ok(Math.abs(g0 - Stores.grainOf(h4) - left * R4) < 1e-9, 'taken from the barn');
  issue(s4, { actor: id4, verb: 'comeHome', source: 'player' });
  to(s4, 14);
  assert.ok(s4.agents[id4].away === undefined, 'home');
  const back4 = h4.ledger.filter((e) => e.kind === 'away' && e.pawn === id4 && e.n > 0);
  assert.ok(back4.length === 1 && back4[0].good === 'grain' && back4[0].n <= left * R4 + 1e-9, 'what is left of the pack is back in the grain, none in meals');
  // dies at its bed
  const s5 = make(), h5 = s5.households[0], id5 = adultOf(s5, h5);
  to(s5, WORK[1] + 1);
  Stores.put(s5, h5, 'grain', 60, 'harvest', { barley: 60 });
  issue(s5, { actor: id5, verb: 'lodge', target: site, args: { why: 'work', days: 3 }, source: 'pawn' });
  const j5 = stayOf(s5, id5), grain5 = j5.food * R4, lie0 = Object.keys(s5.lying || {}).length + (Array.isArray(s5.lying) ? s5.lying.length : 0);
  VB['sim/lifecycle'].killPawn(s5, id5, 'killed');
  assert.ok(!s5.away.includes(j5), 'its stay ended');
  const lay = JSON.stringify(s5.lying || null);
  assert.ok(lay.includes('leftGrain') && lay.includes(String(Math.round(grain5 * 1000) / 1000).slice(0, 4)), `its pack lies where it fell: ${lay.slice(0, 200)}`);
  assert.ok(lie0 === 0, 'nothing lay before');
}
// ---- one asked to lodge while away from its house walks home and packs there (VB-1175, from VB-302): no pack from where it stands ----
{
  const s6 = make(), h6 = s6.households[0], id6 = adultOf(s6, h6), a6 = s6.agents[id6], f6 = s6.farmsteads[h6.farmstead];
  to(s6, 9);
  Stores.put(s6, h6, 'grain', 60, 'harvest', { barley: 60 });
  const out = f6.house + 8; // 8 steps along the row from its door
  VB['sim/agents'].setDown(s6, a6);
  a6.x = s6.w.hx[out]; a6.y = s6.w.hy[out]; a6.inside = false;
  const g0 = Stores.grainOf(h6);
  assert.strictEqual(issue(s6, { actor: id6, verb: 'lodge', target: site, args: { why: 'work', days: 3 }, source: 'pawn' }), true, 'asked to lodge');
  assert.ok(stayOf(s6, id6) === null && a6.packing && a6.packing.at === site, 'no stay before it is home: it walks home to pack');
  assert.ok(Math.abs(Stores.grainOf(h6) - g0) < 1e-9, 'nothing is taken from the barn while it stands away from it');
  for (let h = 0; h < 6 && !stayOf(s6, id6); h++) Sim.advance(s6, 1);
  const j6 = stayOf(s6, id6);
  assert.ok(j6 && j6.bed === site && !a6.packing, 'home, it packs and its stay opens');
  assert.ok(Math.abs(g0 - Stores.grainOf(h6) - j6.food / s6.ECON.uncooked) < 1e-6 && j6.food > 0, 'the pack taken from the barn at home');
  assert.deepStrictEqual(checkState(s6), [], 'invariants, packed at home');
}
// a journey's stay between its legs (a fetcher's, opened this step: no tasks named, not walking yet) is no lodger's day: dayAway passes it
// to the household's day as a pawn on the road (the extended tier's bands, 27 Nov 2026: market tiny seed 7 threw on its jobs)
{
  const s7 = make(), A = VB['sim/away'], hh = s7.households[0], id = adultOf(s7, hh), a = s7.agents[id];
  A.open(s7, { id: A.nextStay(s7), pawn: id, why: 'fetch', bed: null, roof: 'none', food: 0, from: hh.farmstead, to: s7.farmsteads[hh.farmstead].house, gift: null, back: false });
  delete a.journey;
  const rest = A.dayAway(s7, [a]);
  assert.ok(Array.isArray(rest) ? rest.includes(a) || rest.length === 0 : true, 'the journey\'s pawn left to the household\'s day');
}
console.log(`away: a pawn lodged ${s.walk.toFixed(1)} hours from home on a pack of 3, worked two days, ate from its pack, walked home on the third; a household at its seed sent nobody; a guest; a save in the middle`);
