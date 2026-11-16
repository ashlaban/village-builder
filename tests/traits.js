// VB-254 (design.md section 7, foresight; Traits before slice 7): the stand-in traits, drawn at birth and for the living at the start, read
// through Traits.of; a head's skill (wits and husbandry, and years as head); its horizon (it reacts, projects to the season's end, or a
// season further) and its bias on each target, drawn once when it becomes head, never at a review. On a tiny village.
const assert = require('assert');
const VB = require('../src/load.js'), Sim = VB.sim;
const T = VB['sim/traits'], P = VB['sim/plans'], { dailyBirths } = VB['sim/births'], { killPawn } = VB['sim/lifecycle'];
const { YEAR, DAY, SEASON_DAYS, HERD, cal } = VB['sim/rules'];
const { tinyWorld, tinyState } = require('./lib/tiny.js'), { checkState } = require('./lib/invariants.js'), { templateHeads } = require('./lib/heads.js');
const rows = Array.from({ length: 12 }, (_, i) => (i < 2 ? 'FFFFFFFFFFFFFFFF' : '................'));
const make = () => tinyState(tinyWorld(rows), [{ at: [8, 7], farms: 2, sizes: [5, 4] }], { seed: 4, herds: true });
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;

// the traits: every living pawn has the five, in [0, 1), from the stream `traits`; their mean near the middle (neutral on average)
{
  const st = make();
  for (const id of st.living) assert.strictEqual(st.pawns[id].traits.length, T.NAMES.length, `pawn ${id} has the five traits`);
  assert.deepStrictEqual(checkState(st), [], 'invariants at the start');
  const s0 = { ...st.rng.traits };
  const t = T.draw(st, st.living[0]);
  assert.notDeepStrictEqual(st.rng.traits, s0, 'drawn from the stream traits');
  T.NAMES.forEach((k, i) => assert.strictEqual(T.of(st, st.living[0], k), t[i], `read through Traits.of: ${k}`));
  let sum = 0, n = 0;
  for (let i = 0; i < 2000; i++) for (const x of T.draw(st, st.living[0])) { sum += x; n++; }
  assert.ok(Math.abs(sum / n - 0.5) < 0.02, `uniform, so neutral on average: mean ${(sum / n).toFixed(3)}`);
  st.rng.traits.fix = 0.25;
  assert.ok(T.draw(st, st.living[0]).every((x) => x === 0.25), 'forced with fix');
}

// a birth draws the child's traits
{
  const st = make(), hh = st.households[0], m = hh.members.map((id) => st.pawns[id]).find((p) => p.sex === 'f' && p.age >= 18);
  m.pregnantUntil = st.t;
  m.pregnantBy = hh.members.find((id) => st.pawns[id].sex === 'm' && st.pawns[id].age >= 18);
  st.rng.births.fix = 0.99; // a boy or a girl, and the mother lives
  const n = st.pawns.length;
  dailyBirths(st);
  assert.strictEqual(st.pawns.length, n + 1, 'a child is born');
  assert.strictEqual(st.pawns[n].traits.length, T.NAMES.length, 'with its traits');
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

// the horizon at a review, in place of the template's look-ahead (VB-485): on each season's first day a head of skill 0.5 and no bias wants
// the template's wood and hay; a far-seeing one wants more only where its horizon's burn is more than the template's target; one that
// reacts wants less by what the rest of the season burns and feeds; the template's own targets are untouched; a review draws nothing
{
  const st = templateHeads(VB, make()), hh = st.households[0], plan = P.planOf(st, 'household', hh.id), Tg = plan.targets, E = st.ECON;
  assert.deepStrictEqual(plan.head.bias, { wood: 1, hay: 1, seed: 1, fields: 1 }, 'no bias');
  const goal = (c) => (c.season === 1 || c.season === 2 ? st.ECON.woodWinter : st.ECON.woodTarget);
  const at = (wits, c) => {
    st.pawns[hh.holder].traits.fill(wits, 0, 2);
    plan.head.since = st.t;
    const s0 = JSON.stringify(st.rng);
    P.reviewed(st, plan, c, 'store');
    assert.strictEqual(JSON.stringify(st.rng), s0, 'a review draws nothing');
    return [Tg.wood[c.season], Tg.hayWinters];
  };
  const stallIn = (c, days) => {
    let n = 0;
    for (let d = 0; d < days; d++) { const doy = (c.doy + d) % 48; if (doy >= HERD.stall[0] || doy < HERD.stall[1]) n++; }
    return n / HERD.stallDays;
  };
  const first = (y, s) => { st.t = y * YEAR + s * SEASON_DAYS * DAY + 8; return cal(st.t); };
  for (let s = 0; s < 4; s++) {
    const c = first(1, s);
    assert.strictEqual(c.sday, 0, 'the season\'s first day');
    assert.deepStrictEqual(at(0.5, c), [goal(c), 2], `season ${s}: a head of skill 0.5 wants the template's wood and hay`);
    const burn = E.woodUse[s] * SEASON_DAYS, burn2 = burn + E.woodUse[(s + 1) % 4] * SEASON_DAYS;
    assert.deepStrictEqual(at(0.9, c), [Math.max(goal(c), burn2), Math.max(2, stallIn(c, 2 * SEASON_DAYS))], `season ${s}: a far-seeing head, no more where the template looks as far`);
    const [w0, h0] = at(0.1, c);
    assert.ok(near(w0, goal(c) - burn) && near(h0, 2 - stallIn(c, SEASON_DAYS)) && w0 < goal(c), `season ${s}: a head that reacts wants less: ${w0}, ${h0}`);
    assert.deepStrictEqual(at(0.5, c), [goal(c), 2], `season ${s}: and back: the difference is taken off at the next review`);
  }
  // where the template's own look-ahead is shorter (a woodpile goal of 10 in winter, under the 23.4 burnt to spring's end), the far-seeing
  // head wants its projection, the middling one the template's, and the one that reacts none under nothing
  st.ECON = { ...E, woodTarget: 10 };
  const w3 = first(2, 3), burn2 = E.woodUse[3] * SEASON_DAYS + E.woodUse[0] * SEASON_DAYS;
  assert.ok(near(at(0.9, w3)[0], burn2) && burn2 > 10, 'a longer horizon wants more where the template looks less far');
  assert.strictEqual(at(0.5, w3)[0], 10, 'the middling head the template\'s');
  assert.strictEqual(at(0.1, w3)[0], 0, 'the one that reacts less, not under nothing');
  st.ECON = E;
  // the bias multiplies the plan's targets, not the template's, from the next season's plan
  plan.head.bias = { wood: 0.8, hay: 1.2, seed: 0.9, fields: 1 };
  st.pawns[hh.holder].traits.fill(0.4, 0, 2);
  st.t = 3 * YEAR + (3 * SEASON_DAYS + 1) * DAY + 8;
  const wi = cal(st.t);
  P.reviewed(st, plan, wi, 'store');
  assert.ok(near(Tg.wood[wi.season], 0.8 * goal(wi)) && near(Tg.hayWinters, 2.4) && near(Tg.seed, 0.9 * VB['sim/rules'].CROPS.barley.seed), 'the head\'s targets');
  const other = P.planOf(st, 'household', st.households[1].id);
  P.reviewed(st, other, wi, 'store');
  const V = Sim.headView(st, hh.id);
  assert.ok(near(V.targets.wood.custom, goal(wi)) && V.targets.hay.custom === 2, 'the custom\'s targets beside the head\'s');
  assert.ok(V.head.horizon === 1 && V.head.keepsOrder, 'the head\'s horizon in the view');
}
// a new head's bias reaches its targets at once, at the succession, not at the next seasonal plan (VB-485)
{
  const st = make(), hh = st.households[0], plan = P.planOf(st, 'household', hh.id), Tg = plan.targets;
  st.naturalDeaths = false;
  Sim.advance(st, DAY);
  st.rng.traits.fix = 0; // the new head's biases all at their least
  killPawn(st, hh.holder, 'killed');
  delete st.rng.traits.fix;
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
console.log('traits ok: five stand-in traits drawn at birth and at the start, neutral on average; skill as head; horizon in place of the template\'s look-ahead, and bias, at the review, which draws nothing; a new head\'s targets at once; the fields\' bias before the cap');
