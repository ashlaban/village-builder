// VB-254, VB-519 (design.md, People, Traits, talk and stories): the twelve traits, passed on at birth and set at 15, read through
// Traits.of and named by Traits.labelsOf, and a culture's values; a head's skill (wits and husbandry, and years as head); its horizon (it reacts, projects to the season's end, or a
// season further) and its bias on each target, drawn once when it becomes head, never at a review. On a tiny village.
const assert = require('assert');
const VB = require('../src/load.js'), Sim = VB.sim;
const T = VB['sim/traits'], P = VB['sim/plans'], { dailyBirths } = VB['sim/births'], { killPawn } = VB['sim/lifecycle'];
const { YEAR, DAY, SEASON_DAYS, HERD, cal } = VB['sim/rules'];
const { tinyWorld, tinyState } = require('./lib/tiny.js'), { checkState } = require('./lib/invariants.js'), { templateHeads } = require('./lib/heads.js');
const rows = Array.from({ length: 12 }, (_, i) => (i < 2 ? 'FFFFFFFFFFFFFFFF' : '................'));
const make = () => tinyState(tinyWorld(rows), [{ at: [8, 7], farms: 2, sizes: [5, 4] }], { seed: 4, herds: true });
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;
const mean = (xs) => xs.reduce((a, x) => a + x, 0) / xs.length, sd = (xs) => Math.sqrt(mean(xs.map((x) => (x - mean(xs)) ** 2)));
const { TRAITS } = VB['sim/rules'], { leaveHousehold, joinHousehold, spouseOf } = VB['sim/records'];
const setSkill = (st, id, x) => { const t = st.pawns[id].traits; t[T.IDX.wits] = t[T.IDX.husbandry] = x; };

// the traits (VB-519): every pawn, living or dead, has the twelve, within the bounds; a placed pawn draws each from its culture's
// distribution, so neutral on average with the reference's spread; one draw of the stream `traits` a trait, and `fix` 0.5 is no chance
{
  const st = make();
  for (const p of st.pawns) assert.strictEqual(p.traits.length, 12, `pawn ${p.id} has the twelve traits`);
  assert.deepStrictEqual(TRAITS.names, ['generosity', 'piety', 'ambition', 'honour', 'sociability', 'temper', 'diligence', 'openness', 'body', 'hands', 'husbandry', 'wits']);
  assert.deepStrictEqual(Object.keys(TRAITS.culture.oldNordic), TRAITS.names.slice(0, 4), 'a culture holds the four values, in order');
  assert.deepStrictEqual(checkState(st), [], 'invariants at the start');
  const id = st.living[0];
  TRAITS.names.forEach((k, i) => assert.strictEqual(T.of(st, id, k), st.pawns[id].traits[i], `read through Traits.of: ${k}`));
  const s0 = { ...st.rng.traits };
  T.pass(st, 0.5, 0);
  assert.notDeepStrictEqual(st.rng.traits, s0, 'drawn from the stream traits');
  const xs = Array.from({ length: 4000 }, () => T.pass(st, 0.5, 0));
  assert.ok(Math.abs(mean(xs) - 0.5) < 0.01 && Math.abs(sd(xs) - 0.15) < 0.01, `neutral on average, spread 0.15: ${mean(xs).toFixed(3)}, ${sd(xs).toFixed(3)}`);
  st.rng.traits.fix = 0.5;
  assert.ok(near(T.pass(st, 0.5, 0.5, 0.9, 0.7), 0.65, 1e-9), 'mean + b × (the parents\' mean − mean), with no chance');
  assert.ok(near(T.pass(st, 0.6, 0.6, null, null), 0.6, 1e-9), 'a parent not on record counts as the mean');
  st.rng.traits.fix = 0.999999999;
  assert.strictEqual(T.pass(st, 0.9, 0), 0.98, 'kept within the bounds');
  delete st.rng.traits.fix;
}

// the spread of 2,000 children of random pairs is the reference's, 0.15, for each group (the chance's spread is sd × √(1 − b²/2))
{
  const st = make();
  for (const [g, b] of Object.entries(TRAITS.b)) {
    const m = g === 'values' ? 0.6 : 0.5, kids = [];
    for (let k = 0; k < 2000; k++) kids.push(T.pass(st, m, b, T.pass(st, m, 0), T.pass(st, m, 0)));
    assert.ok(sd(kids) >= 0.14 && sd(kids) <= 0.16 && Math.abs(mean(kids) - m) < 0.015, `${g}: spread ${sd(kids).toFixed(3)}, mean ${mean(kids).toFixed(3)}`);
  }
  // however many parents are known (VB-519's review): a birth with one parent on record; values set at 15 by two raisers, by one alone,
  // by none; over generations, the spread stays the reference's
  const m = 0.6, b = TRAITS.b.values, x = () => T.pass(st, m, 0);
  const cases = { 'a birth, one parent known': () => T.pass(st, m, b, x(), null, 2), 'two raisers': () => T.pass(st, m, b, x(), x(), 2),
    'one raiser': () => T.pass(st, m, b, x(), null, 1), 'no raiser': () => T.pass(st, m, b, null, null, 0) };
  for (const [what, child] of Object.entries(cases)) {
    const kids = Array.from({ length: 4000 }, child);
    assert.ok(Math.abs(sd(kids) - 0.15) < 0.0075 && Math.abs(mean(kids) - m) < 0.01, `${what}: spread ${sd(kids).toFixed(4)}, mean ${mean(kids).toFixed(3)}`);
  }
  let gen = Array.from({ length: 2000 }, x);
  for (let g = 0; g < 8; g++) gen = gen.map((_, k) => T.pass(st, m, b, gen[(k * 7919 + g) % gen.length], null, 1));
  assert.ok(Math.abs(sd(gen) - 0.15) < 0.01, `eight generations raised by one: spread ${sd(gen).toFixed(4)}`);
}

// a birth: the child's twelve from its father and mother by birth (temperament and aptitudes around 0.5, values around its culture's
// means); a child of two high parents lies between them and the mean; it counts hungry days until 15
const born = (st, hh) => {
  const m = hh.members.map((id) => st.pawns[id]).find((p) => p.sex === 'f' && p.age >= 18 && p.alive);
  m.pregnantUntil = st.t;
  m.pregnantBy = hh.members.find((id) => st.pawns[id].sex === 'm' && st.pawns[id].age >= 18 && st.pawns[id].alive);
  st.rng.births.fix = 0.99; // a boy or a girl, and the mother lives
  const n = st.pawns.length;
  dailyBirths(st);
  delete st.rng.births.fix;
  assert.strictEqual(st.pawns.length, n + 1, 'a child is born');
  return { kid: n, mother: m.id, father: st.pawns[n].father };
};
{
  const st = make(), hh = st.households[0];
  const m = hh.members.map((id) => st.pawns[id]).find((p) => p.sex === 'f' && p.age >= 18), f = st.pawns[hh.members.find((id) => st.pawns[id].sex === 'm' && st.pawns[id].age >= 18)];
  m.traits.fill(0.9);
  f.traits.fill(0.8);
  st.rng.traits.fix = 0.5;
  const { kid } = born(st, hh), t = st.pawns[kid].traits, cv = st.cenv.cultures[0].values;
  delete st.rng.traits.fix;
  TRAITS.names.forEach((k, i) => {
    const mu = i < 4 ? cv[k] : 0.5, b = TRAITS.b[i < 4 ? 'values' : i < 8 ? 'temperament' : 'aptitudes'];
    assert.ok(t[i] > mu && t[i] < 0.8, `${k}: between the parents and the mean (${t[i]})`);
    assert.ok(near(t[i], Math.round((mu + b * (0.85 - mu)) * 1000) / 1000), `${k}: by the equation`);
  });
  assert.strictEqual(st.pawns[kid].leanDays, 0, 'a child counts its hungry days');
  assert.deepStrictEqual(checkState(st), [], 'invariants after the birth');
}

// at 15, once: a child raised in another house takes its values from that house (its holder and mistress) and keeps the temperament and
// aptitudes of its birth; a hungry childhood takes from body and wits and nothing else; the hungry days counted at hunger 0.5 and over
{
  const st = make(), [h0, h1] = st.households;
  st.rng.traits.fix = 0.5;
  const { kid } = born(st, h0), p = st.pawns[kid];
  leaveHousehold(st, kid);
  joinHousehold(st, h1, kid);
  const H = h1.holder, M = spouseOf(st, H);
  assert.ok(H !== null && M !== null, 'the other house has a holder and a mistress');
  st.pawns[H].traits.fill(0.9, 0, 4);
  st.pawns[M].traits.fill(0.7, 0, 4);
  const before = [...p.traits], cv = st.cenv.cultures[0].values;
  p.hunger = 0.4;
  T.hungryDay(p);
  assert.strictEqual(p.leanDays, 0, 'a fed day is not counted');
  p.hunger = 0.5;
  for (let d = 0; d < 48; d++) T.hungryDay(p);
  assert.strictEqual(p.leanDays, 48, 'a hungry day is');
  p.born = st.t - 15 * YEAR;
  const fed = { ...p, traits: [...before], leanDays: 0 }; // the same child, fed: set by the same draws (the stream fixed)
  st.pawns[kid] = fed;
  T.setAtAge(st, kid);
  st.pawns[kid] = p;
  VB['sim/lifecycle'].dailyLife(st);
  const t = p.traits, tf = fed.traits;
  assert.ok(p.leanDays === null && fed.leanDays === null, 'set once, and the hungry days dropped');
  TRAITS.names.slice(0, 4).forEach((k, i) => assert.ok(near(t[i], Math.round((cv[k] + 0.6 * (0.8 - cv[k])) * 1000) / 1000), `${k}: from the house that raised it (${t[i]})`));
  for (let i = 4; i < 12; i++) if (i !== T.IDX.body && i !== T.IDX.wits) assert.strictEqual(t[i], before[i], `${TRAITS.names[i]}: of its birth`);
  assert.ok(near(t[T.IDX.body], Math.max(0.02, before[T.IDX.body] - 0.1), 1e-9) && near(t[T.IDX.wits], Math.max(0.02, before[T.IDX.wits] - 0.05), 1e-9), 'half of 96 days hungry: 0.1 off body, 0.05 off wits');
  TRAITS.names.forEach((k, i) => { if (i !== T.IDX.body && i !== T.IDX.wits) assert.strictEqual(t[i], tf[i], `${k}: as the fed child's`); });
  assert.ok(tf[T.IDX.body] === before[T.IDX.body] && tf[T.IDX.wits] === before[T.IDX.wits], 'a fed childhood takes nothing');
  delete st.rng.traits.fix;
  const s1 = JSON.stringify(st.rng.traits);
  VB['sim/lifecycle'].dailyLife(st);
  assert.strictEqual(JSON.stringify(st.rng.traits), s1, 'only once');
  VB['sim/heirs'].refreshRoles(st); // she was moved and aged by hand
  assert.deepStrictEqual(checkState(st), [], 'invariants at 15');
}

// a culture's values: at its yearly reckoning, the mean of its living adults'; a culture that splits takes its own adults' at once
{
  const st = tinyState(tinyWorld(rows), [{ at: [4, 7], farms: 2 }, { at: [12, 7], farms: 2 }], { seed: 5 });
  const env = st.cenv, hk = VB['sim/society'].hooks(st), C = VB['culture'];
  assert.deepStrictEqual(env.cultures[0].values, TRAITS.culture.oldNordic, 'Old Nordic: 0.5, and 0.6 for honour');
  const adults = (v) => VB['sim/records'].membersOf(st, v).filter((p) => p.age >= 15);
  const avg = (ps, i) => Math.round((ps.reduce((a, p) => a + p.traits[i], 0) / ps.length) * 1000) / 1000;
  for (const p of adults(1)) p.traits.fill(0.8, 0, 4);
  C.cultureYear(env, hk, env.cultures[0]);
  const all = [...adults(0), ...adults(1)];
  TRAITS.names.slice(0, 4).forEach((k, i) => assert.ok(near(env.cultures[0].values[k], avg(all, i)), `${k}: the mean of its adults`));
  const nc = C.split(env, hk, [1], 'test');
  TRAITS.names.slice(0, 4).forEach((k) => assert.strictEqual(nc.values[k], 0.8, `${k}: the split culture's, its own adults'`));
  assert.notStrictEqual(nc.values, env.cultures[0].values, 'its own record');
  // a child born there draws its values around its own culture's means
  const hh = st.households.find((h) => st.farmsteads[h.farmstead].village === 1 && !h.dissolved);
  for (const id of hh.members) st.pawns[id].traits.fill(0.8, 0, 4);
  st.rng.traits.fix = 0.5;
  const { kid } = born(st, hh);
  delete st.rng.traits.fix;
  assert.ok(st.pawns[kid].traits.slice(0, 4).every((x) => near(x, 0.8)), 'around its culture\'s mean, from parents at it');
  assert.deepStrictEqual(checkState(st), [], 'invariants after the split');
}

// the labels: the words beyond the 15th and 85th percentiles, none between; a save made before the twelve keeps what it has
{
  const st = make(), id = st.living.find((i) => st.pawns[i].sex === 'f'), t = st.pawns[id].traits;
  t.fill(0.5);
  assert.deepStrictEqual(T.labelsOf(st, id), [], 'none in the middle');
  t[T.IDX.generosity] = 0.344; t[T.IDX.honour] = 0.656; t[T.IDX.openness] = 0.2; t[T.IDX.wits] = 0.345;
  assert.deepStrictEqual(T.labelsOf(st, id), ['tight-fisted', 'a woman of her word', 'set in her ways'], 'the words of the tails');
  assert.deepStrictEqual(Sim.traitLabels(st, id), T.labelsOf(st, id), 'through the Sim API');
  // an old save: VB-254's five, in its order, no hungry days and no culture's values
  const old = st.living.slice(0, 3);
  for (const i of old) { st.pawns[i].traits = [0.1, 0.2, 0.3, 0.4, 0.5]; delete st.pawns[i].leanDays; }
  delete st.cenv.cultures[0].values;
  const data = JSON.parse(JSON.stringify(Sim.save(st))), back = Sim.load(st.w, data);
  for (const i of old) {
    const b = back.pawns[i];
    assert.deepStrictEqual([b.traits[T.IDX.wits], b.traits[T.IDX.husbandry], b.traits[T.IDX.diligence], b.traits[T.IDX.ambition], b.traits[T.IDX.generosity]], [0.1, 0.2, 0.3, 0.4, 0.5], 'the five kept');
    assert.ok(b.leanDays === (b.age < 15 ? 0 : null), 'its hungry days begun if a child');
  }
  assert.deepStrictEqual(back.cenv.cultures[0].values, TRAITS.culture.oldNordic, 'the culture starts at its archetype\'s');
  assert.deepStrictEqual(checkState(back), [], 'invariants after the load');
}

// skill as head: the mean of wits and husbandry, 0.02 a year as head up to 0.2, capped at 1; the horizon by its thirds
{
  const st = make(), id = st.households[0].holder;
  const set = (w, h) => { st.pawns[id].traits[T.IDX.wits] = w; st.pawns[id].traits[T.IDX.husbandry] = h; };
  set(0.4, 0.6);
  st.t += 30 * YEAR;
  assert.ok(near(T.skill(st, id, st.t), 0.5), 'the mean of wits and husbandry');
  assert.ok(near(T.skill(st, id, st.t - 3 * YEAR), 0.56), '0.02 a year as head');
  assert.ok(near(T.skill(st, id, st.t - 20 * YEAR), 0.7), 'up to 0.2');
  set(0.95, 0.95);
  assert.strictEqual(T.skill(st, id, st.t - 20 * YEAR), 1, 'capped at 1');
  assert.deepStrictEqual([0.1, 0.32, 0.33, 0.66, 0.67, 1].map(P.horizonOf), [0, 0, 1, 1, 2, 2], 'reacts, to the season\'s end, a season further');
}

// the bias: within 30% × (1 - skill) of 1, drawn once when the pawn becomes head; a succession draws the new head's
{
  const st = make();
  st.rng.traits.fix = 0.999999;
  assert.ok(near(T.biasOf(st, 0), 1.3, 1e-5) && near(T.biasOf(st, 0.5), 1.15, 1e-5), 'at most 30% × (1 - skill) over');
  st.rng.traits.fix = 0;
  assert.ok(near(T.biasOf(st, 0), 0.7) && near(T.biasOf(st, 1), 1), 'at most 30% × (1 - skill) under; none for a head of skill 1');
  delete st.rng.traits.fix;
  const hh = st.households[0], plan = P.planOf(st, 'household', hh.id), old = plan.head;
  assert.strictEqual(old.pawn, hh.holder);
  st.naturalDeaths = false;
  Sim.advance(st, DAY);
  killPawn(st, hh.holder, 'killed');
  assert.ok(plan.head !== old && plan.head.pawn === hh.holder && plan.head.since === st.t, 'the new head is drawn at the succession');
  assert.deepStrictEqual(checkState(st).filter((x) => x.startsWith('plans')), [], 'plan invariants after the succession');
}

// the horizon at a review: a head that reacts keeps the template's goal; one that projects adds the wood burnt to the season's end, and a
// far-seeing one a season more and the stall days within it; the template's own targets are untouched; a review draws nothing
{
  const st = templateHeads(VB, make()), hh = st.households[0], plan = P.planOf(st, 'household', hh.id), Tg = plan.targets, E = st.ECON;
  assert.deepStrictEqual(plan.head.bias, { wood: 1, hay: 1, seed: 1, fields: 1 }, 'no bias');
  const goal = (c) => (c.season === 1 || c.season === 2 ? E.woodWinter : E.woodTarget);
  const at = (wits, c) => {
    setSkill(st, hh.holder, wits);
    plan.head.since = st.t;
    const s0 = JSON.stringify(st.rng);
    P.reviewed(st, plan, c, 'store');
    assert.strictEqual(JSON.stringify(st.rng), s0, 'a review draws nothing');
    return [Tg.wood[c.season], Tg.hayWinters];
  };
  const c = cal(st.t);
  assert.deepStrictEqual(at(0.1, c), [goal(c), 2], 'a head that reacts plans by the template');
  const left = SEASON_DAYS - c.sday;
  const [w1] = at(0.5, c);
  assert.ok(near(w1, goal(c) + E.woodUse[c.season] * left), `to the season's end: ${w1}`);
  const [w2] = at(0.9, c);
  assert.ok(near(w2, goal(c) + E.woodUse[c.season] * left + E.woodUse[(c.season + 1) % 4] * SEASON_DAYS), `a season further: ${w2}`);
  const back = at(0.1, c);
  assert.ok(near(back[0], goal(c)) && near(back[1], 2), 'and back: the projection is taken off at the next review');
  // in autumn, a far-seeing head looks into the winter's stall days
  st.t = (2 * SEASON_DAYS + 1) * DAY + 8;
  const au = cal(st.t);
  P.reviewed(st, plan, au, 'store');
  const [, hay] = at(0.9, au);
  let stall = 0;
  for (let d = 0; d < 2 * SEASON_DAYS - au.sday; d++) { const doy = (au.doy + d) % 48; if (doy >= HERD.stall[0] || doy < HERD.stall[1]) stall++; }
  assert.ok(stall > 0 && near(hay, 2 + stall / HERD.stallDays), `the hay for the stall days ahead: ${hay}`);
  // the bias multiplies the plan's targets, not the template's, from the next season's plan
  plan.head.bias = { wood: 0.8, hay: 1.2, seed: 0.9, fields: 1 };
  setSkill(st, hh.holder, 0.1);
  st.t = (3 * SEASON_DAYS + 1) * DAY + 8;
  const wi = cal(st.t);
  P.reviewed(st, plan, wi, 'store');
  assert.ok(near(Tg.wood[wi.season], 0.8 * goal(wi)) && near(Tg.hayWinters, 2.4) && near(Tg.seed, 0.9 * VB['sim/rules'].CROPS.barley.seed), 'the head\'s targets');
  const other = P.planOf(st, 'household', st.households[1].id);
  P.reviewed(st, other, wi, 'store');
  const V = Sim.headView(st, hh.id);
  assert.ok(near(V.targets.wood.custom, goal(wi)) && V.targets.hay.custom === 2, 'the custom\'s targets beside the head\'s');
  assert.ok(V.head.horizon === 0 && V.head.keepsOrder, 'the head\'s horizon in the view');
}
// the horizon on a season's first day, worked by hand (VB-254, as Decided: a poor head reacts, a good one projects ahead; VB-485's
// replacement withdrawn): ECON.woodUse is 0.35, 0.3, 0.5 and 1.6 loads a day by season, 12 days a season; the stall is from day 32 to day
// 5 of the year, 21 days a winter. Spring's first day (day 0): a head that reacts wants the template's 30 loads and 2 winters; one to the
// season's end 30 + 0.35 × 12 = 34.2 and 2 + 5/21 (days 0 to 4 stalled); one a season further 34.2 + 0.3 × 12 = 37.8 and the same hay
// (summer has no stall). Autumn's first day (day 24): 40; 40 + 0.5 × 12 = 46 and 2 + 4/21 (days 32 to 35); 46 + 1.6 × 12 = 65.2 and
// 2 + 16/21 (days 32 to 47).
{
  const st = templateHeads(VB, make()), hh = st.households[0], plan = P.planOf(st, 'household', hh.id), Tg = plan.targets;
  const at = (wits) => {
    setSkill(st, hh.holder, wits);
    plan.head.since = st.t;
    P.reviewed(st, plan, cal(st.t), 'store');
    return [Tg.wood[cal(st.t).season], Tg.hayWinters];
  };
  const same = (a, b, m) => assert.ok(near(a[0], b[0], 1e-6) && near(a[1], b[1], 1e-6), `${m}: ${a} against ${b}`);
  st.t = YEAR + 8;
  assert.strictEqual(cal(st.t).doy, 0);
  same(at(0.1), [30, 2], 'spring: a head that reacts wants the template');
  same(at(0.5), [34.2, 2 + 5 / 21], "spring: to the season's end");
  same(at(0.9), [37.8, 2 + 5 / 21], 'spring: a season further');
  st.t = YEAR + 24 * DAY + 8;
  assert.strictEqual(cal(st.t).doy, 24);
  same(at(0.1), [40, 2], 'autumn: a head that reacts wants the template');
  same(at(0.5), [46, 2 + 4 / 21], "autumn: to the season's end");
  same(at(0.9), [65.2, 2 + 16 / 21], 'autumn: a season further, into the winter');
  same(at(0.1), [40, 2], 'and back: the projection is taken off at the next review');
}

// a new head's bias reaches its targets at once, at the succession, not at the next seasonal plan (VB-485)
{
  const st = make(), hh = st.households[0], plan = P.planOf(st, 'household', hh.id), Tg = plan.targets;
  st.naturalDeaths = false;
  Sim.advance(st, DAY);
  const sp0 = st.plans.seasons.get(hh.id), turned = [...sp0.steps].reverse(), made = sp0.made;
  P.setOrder(st, hh.id, turned); // an order the old head set
  st.rng.traits.fix = 0; // the new head's biases all at their least
  killPawn(st, hh.holder, 'killed');
  delete st.rng.traits.fix;
  const sp1 = st.plans.seasons.get(hh.id);
  assert.ok(sp1.by === 'head' && sp1.made === made && JSON.stringify(sp1.steps) === JSON.stringify(turned), "the season's plan and its order outlast the succession");
  const b = plan.head.bias, M = Sim.headView(st, hh.id).targets;
  assert.ok(b.wood < 1 && b.hay < 1 && b.seed < 1, 'the new head is biased under the custom');
  assert.ok(near(Tg.seed, VB['sim/rules'].CROPS.barley.seed * b.seed), `its seed at once: ${Tg.seed}`);
  assert.ok(near(Tg.hayWinters - Tg.ahead.hay, M.hay.custom * b.hay), `its hay at once: ${Tg.hayWinters}`);
}

// the fields' bias before the cap at what the hands can till (VB-485): over biases drawn symmetrically (fix on the stream), the mean of the
// fields a hands-limited household's head wants is the unbiased one's within 2%; the cap no longer takes the high draws and leaves the low
{
  const st = make(), F = VB['sim/fields'];
  const hh = st.households.find((h) => h.farmstead !== null), plan = P.planOf(st, 'household', hh.id), Tg = plan.targets;
  const c = cal(st.t);
  P.reviewed(st, plan, c, 'store');
  Tg.perHand = 1; // few hands: the food asks more than they can till
  const workable = F.fieldsWorkable(st, hh, Tg.perHand), want = F.fieldsWanted(st, hh, Infinity);
  assert.ok(want > workable && workable >= 1, `hands-limited: wants ${want}, can till ${workable}`);
  const fieldsAt = (b) => { plan.head.bias.fields = b; P.reviewed(st, plan, c, 'store'); return Tg.fields; };
  const unbiased = fieldsAt(1);
  assert.strictEqual(unbiased, workable, 'unbiased, it wants what its hands can till');
  for (const skill of [0, 0.5]) {
    let sum = 0;
    const n = 101;
    for (let k = 0; k < n; k++) {
      st.rng.traits.fix = k / (n - 1) - (k === n - 1 ? 1e-9 : 0);
      sum += fieldsAt(T.biasOf(st, skill));
    }
    delete st.rng.traits.fix;
    assert.ok(Math.abs(sum / n - unbiased) <= 0.02 * unbiased, `skill ${skill}: mean ${(sum / n).toFixed(3)} against ${unbiased}`);
  }
}
console.log('traits ok: twelve traits passed on at birth and set at 15, a hungry childhood, a culture\'s values reckoned and split, labels, an old save; skill as head; horizon and bias at the review, which draws nothing, worked by hand on two seasons\' first days; a new head\'s targets at once; the fields\' bias before the cap');
