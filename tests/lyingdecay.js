// @suite integration
// What lies out degrades (VB-1910; design.md, Goods and the farming year, Risk): a lying load loses LYING.frostLoss of its amount each
// game day once the year's frost has come, booked to its owner as spoilage is ('lying'), and is gone under LYING.quantum, told as the
// frost's; a cart left standing goes at the frost as before. The head's estimate (sim/outlook, parts.lying) is the same reckoning. A tiny
// world: one village of two farms. Stooks in the field and hay mown on the meadow wear by the same reckoning (VB-2001).
const assert = require('assert');
const VB = require('../src/load.js'), Sim = VB.sim, L = VB['sim/lying'], S = VB['sim/stores'];
const { LYING, TRAVEL, DAY, SEASON_DAYS, cal } = VB['sim/rules'], W = VB['sim/weather'];
const { tinyWorld, tinyState } = require('./lib/tiny.js');
const { checkState } = require('./lib/invariants.js');
const near = (a, b) => Math.abs(a - b) < 1e-6;
const scene = () => {
  const w = tinyWorld(Array.from({ length: 10 }, () => '.'.repeat(20)));
  const st = tinyState(w, [{ at: [8, 5], farms: 2, sizes: [6, 6] }], { seed: 3 });
  const hh = st.households.find((h) => !h.dissolved && h.farmstead !== null), f = st.farmsteads[hh.farmstead];
  return { w, st, hh, f, owner: { type: 'household', id: hh.id } };
};
const booked = (hh, good) => (hh.totals || []).filter((x) => x.kind === 'lying' && x.good === good).reduce((s, x) => s + x.n, 0);
const out = [];

// 1. the shares: a day's loss is frostLoss of the amount, booked as the owner's; the estimate of a day is the day's loss
{
  const { st, hh, f, owner } = scene();
  const sheaves = L.leave(st, 'haul', 100, f.house, owner), hay = L.leave(st, 'hay', 60, f.house, owner);
  L.leave(st, 'leftCart', 1, f.house, owner, { of: { cart: { kind: 'hand' } } });
  const est = L.lyingOut(st, owner, 'grain', 1), estHay = L.lyingOut(st, owner, 'hay', 1);
  assert(near(est.n, 100) && near(est.lost, 100 * LYING.frostLoss), `the estimate of a day: ${JSON.stringify(est)}`);
  L.frost(st);
  assert(!st.lying.some((l) => l.kind === 'leftCart'), 'the frost takes the cart left standing');
  assert(near(sheaves.n, 100) && near(hay.n, 60), 'and nothing else at once');
  L.decay(st);
  assert(near(sheaves.n, 100 * (1 - LYING.frostLoss)) && near(hay.n, 60 * (1 - LYING.frostLoss)), `a day's share: ${sheaves.n}, ${hay.n}`);
  assert(near(100 - sheaves.n, est.lost) && near((60 - hay.n) * TRAVEL.hay, estHay.lost), 'the loss is the estimate, one reckoning');
  assert(near(booked(hh, 'grain'), -est.lost) && near(booked(hh, 'hay'), -estHay.lost), 'booked as the household\'s, its reason lying');
  assert.deepStrictEqual(checkState(st), [], 'invariants');
  out.push(`a day: ${100 - sheaves.n} of 100 sheaves, ${(60 - hay.n).toFixed(1)} of 60 hay`);
}

// 2. a load under its quantum is dropped, its whole amount lost, and the frost is told
{
  const { st, hh, f, owner } = scene();
  const n = LYING.quantum / (1 - LYING.frostLoss) - 1; // under the quantum after a day
  L.leave(st, 'haul', n, f.house, owner);
  const big = L.leave(st, 'haul', 1000, f.house + 1, owner);
  const r0 = st.record.length;
  assert(near(L.lyingOut(st, owner, 'grain', 1).lost, n + 1000 * LYING.frostLoss), 'the estimate drops the small one whole');
  L.decay(st);
  assert(st.lying.length === 1 && st.lying[0] === big, 'the small load is gone, the large one lies');
  assert(near(booked(hh, 'grain'), -(n + 1000 * LYING.frostLoss)), 'all of the small one booked lost');
  assert(st.record.slice(r0).some((e) => e && e.kind === 'frost' && /sheaves/.test(e.text)), 'the frost on it is told');
  L.decay(st, 48);
  assert(!st.lying, 'a year of the frost wears the large one away');
  out.push(`under ${LYING.quantum}: dropped`);
}

// 3. the clock: nothing is worn before the year's frost, a share a day from its day
{
  const { st, f, owner } = scene();
  const frostT = (2 * SEASON_DAYS + W.frostDay(st)) * DAY + (st.t - (st.t % (4 * SEASON_DAYS * DAY)));
  assert(frostT > st.t, 'the scene starts before the frost');
  Sim.advance(st, frostT - DAY - st.t);
  const l = L.leave(st, 'stone', 30, f.house, owner); // a pile no goal of this household's posts in these days
  Sim.advance(st, DAY - 1);
  assert(near(l.n, 30), `nothing worn the day before the frost (${l.n})`);
  Sim.advance(st, 1);
  assert.strictEqual(cal(st.t).sday, W.frostDay(st), 'the frost\'s day');
  assert(near(l.n, 30 * (1 - LYING.frostLoss)), `a share on the frost's day (${l.n})`);
  Sim.advance(st, DAY);
  assert(near(l.n, 30 * (1 - LYING.frostLoss) ** 2), `and the next (${l.n})`);
  assert.deepStrictEqual(checkState(st), [], 'invariants');
}

// 4. a save from before: a lying load carries nothing but its amount, so a save made before VB-1910 loads and is worn as any
{
  const { w, st, f, owner } = scene();
  L.leave(st, 'haul', 80, f.house, owner);
  const save = JSON.parse(JSON.stringify(Sim.save(st)));
  assert.deepStrictEqual(Object.keys(save.state.lying[0]).sort(), ['id', 'kind', 'n', 'of', 'owner', 't', 'tile', 'x', 'y'], 'the fields of a load before');
  const st2 = Sim.load(w, save);
  L.decay(st2);
  assert(near(st2.lying[0].n, 80 * (1 - LYING.frostLoss)), 'the loaded load is worn');
  assert.deepStrictEqual(checkState(st2), [], 'invariants');
}

// 5. the outlook shows the head's estimate: what lies out, and what of it the season's remaining frost days take, by the same reckoning
{
  const { st, hh, f, owner } = scene();
  const c = { ...cal(st.t), season: 2, sday: 0 },
    plan = st.plans && st.plans.households.get(hh.id);
  L.leave(st, 'haul', 50, f.house, owner);
  const O = VB['sim/outlook'].reckon(st, hh, plan || { tasks: [], targets: [] }, c),
    days = SEASON_DAYS - W.frostExpected(st);
  assert(O.food.parts.lying && near(O.food.parts.lying.n, 50), `the outlook shows the sheaves lying: ${JSON.stringify(O.food.parts.lying)}`);
  assert(near(O.food.parts.lying.lost, Math.round(10 * L.lyingOut(st, owner, 'grain', days).lost) / 10), 'lost as the decay reckons it');
  assert(near(O.hay.parts.lying.n, 0), 'no hay lies');
  out.push(`the outlook: ${O.food.parts.lying.lost} of 50 by autumn's end`);
}
// 6. stooks in the field and hay mown on the meadow wear as a load lying does (VB-2001): not at the frost, a share a day from it, booked
// to the household, gone under the quantum; the outlook counts them less what the season's frost days take, by the same reckoning
{
  const w = tinyWorld(Array.from({ length: 10 }, () => '.'.repeat(20)));
  const st = tinyState(w, [{ at: [8, 5], farms: 2, sizes: [6, 6] }], { seed: 3, herds: true });
  const f = st.farmsteads.find((x) => x.household !== null && x.meadows.length && st.households[x.household].herds.length),
    hh = st.households[f.household];
  const F = VB['sim/fields'], M = VB['sim/meadows'];
  const fd = f.fields[0], m = f.meadows[0];
  for (const x of f.fields) if (x !== fd) Object.assign(x, { stage: 'stubble', sown: null, held: 0 });
  for (const x of f.meadows) if (x !== m) Object.assign(x, { stage: 'aftermath', held: 0 });
  [...st.jobs].forEach((j) => { if (j.field || j.meadow) VB['sim/agents'].dropJob(st, j); });
  Object.assign(fd, { crop: 'barley', stage: 'stooks', sown: 0, held: 80, reaped: 0 });
  Object.assign(m, { stage: 'mown', held: 30, mown: 0 });
  const c = { ...cal(st.t), season: 2, sday: 0 },
    plan = st.plans && st.plans.households.get(hh.id),
    days = SEASON_DAYS - W.frostExpected(st);
  const O = VB['sim/outlook'].reckon(st, hh, plan || { tasks: [], targets: [] }, c);
  const row = (S, what) => (S.parts.intakes || []).filter((x) => x.what === what && x.season === 0).reduce((s, x) => s + x.n, 0);
  const keptSheaves = 80 - L.lossOver(80, days), keptHay = 30 - L.lossOver(30 / TRAVEL.hay, days) * TRAVEL.hay,
    seed = VB['sim/hunger'].seedPer(st, hh);
  assert(keptSheaves < 80 && keptHay < 30, 'the frost days ahead wear them in the reckoning');
  assert(near(row(O.food, 'barley'), Math.round(10 * Math.max(0, keptSheaves - seed)) / 10), `the outlook's stooks: ${JSON.stringify(O.food.parts.intakes)}`);
  assert(near(row(O.hay, 'mown'), Math.round(10 * keptHay) / 10), `the outlook's mown hay: ${JSON.stringify(O.hay.parts.intakes)}`);
  F.fieldsFrost(st);
  assert(fd.stage === 'stooks' && fd.held === 80, 'the frost leaves the stooks standing');
  F.stooksDecay(st);
  M.hayDecay(st);
  assert(near(fd.held, 80 * (1 - LYING.frostLoss)), `a day's share of the stooks: ${fd.held}`);
  assert(near(m.held, 30 * (1 - LYING.frostLoss)), `a day's share of the hay: ${m.held}`);
  assert(near(booked(hh, 'grain'), -80 * LYING.frostLoss) && near(booked(hh, 'hay'), -30 * LYING.frostLoss), "booked as the household's, its reason lying");
  assert.deepStrictEqual(checkState(st), [], 'invariants');
  const r0 = st.record.length;
  F.stooksDecay(st, 48);
  M.hayDecay(st, 48);
  assert(fd.stage === 'stubble' && fd.held === 0 && m.stage === 'aftermath' && m.held === 0, 'worn under the quantum, they are gone');
  assert(st.record.slice(r0).some((e) => e && e.kind === 'frost' && /stooks/.test(e.text)), 'the frost on the stooks is told');
  assert(near(booked(hh, 'grain'), -80) && near(booked(hh, 'hay'), -30), 'all of it booked lost');
  assert.deepStrictEqual(checkState(st), [], 'invariants');
  out.push(`stooks and hay: ${80 * LYING.frostLoss} of 80 sheaves and ${30 * LYING.frostLoss} of 30 hay a day; the outlook keeps ${keptSheaves.toFixed(1)} and ${keptHay.toFixed(1)}`);
}
console.log(`lyingdecay ok: ${out.join('; ')}`);
