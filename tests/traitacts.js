// VB-520 (design.md, People, The twelve traits and the rules each changes; Chemistry): what each trait does, linear in the trait and
// neutral at 0.5 (a pawn at 0.5 acts as every pawn did before traits), chemistry's four terms and Like seeks like, and the quarrel. On a
// constructed state, traits set by hand and chances forced with `fix`.
const assert = require('assert');
const VB = require('../src/load.js');
const T = VB['sim/traits'], R = VB['sim/relations'], C = VB.culture, Rules = VB['sim/registry'];
const { TRAITS, SOCIAL, HEALTH, HELP, SETTLE } = VB['sim/rules'];
const { updateHealth, dailyNeed } = VB['sim/hunger'], { leaveChance } = VB['sim/settle'];
const { tinyWorld, tinyState } = require('./lib/tiny.js'), { checkState } = require('./lib/invariants.js');
const rows = Array.from({ length: 12 }, (_, i) => (i < 2 ? 'FFFFFFFFFFFFFFFF' : '................'));
const make = () => tinyState(tinyWorld(rows), [{ at: [8, 7], farms: 2, sizes: [5, 4] }], { seed: 4, herds: true });
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;
const set = (st, id, name, x) => (st.pawns[id].traits[T.IDX[name]] = x);
const AT = [0, 0.5, 1];

// every act: its value at 0 and at 1, linear between, its midpoint at 0.5 (1 for a factor; the old mean for the reserve)
{
  const st = make(), id = st.living[0];
  for (const [trait, rules] of Object.entries(TRAITS.acts))
    for (const [rule, [a, b]] of Object.entries(rules)) {
      const got = AT.map((x) => (set(st, id, trait, x), T.act(st, id, trait, rule)));
      assert.ok(near(got[0], a) && near(got[2], b) && near(got[1], (a + b) / 2), `${trait}.${rule}: ${got}`);
      if (rule !== 'reserve') assert.ok(near(got[1], 1), `${trait}.${rule} is 1 at 0.5`);
    }
  set(st, id, 'generosity', 0.5);
  assert.strictEqual(T.bufferOf(st, id), 40, 'at 0.5 the holder keeps 40 days, the mean of the old draw (20 to 60)');
  assert.strictEqual(T.bufferOf(st, null), HELP.floorDays + 40, 'a household without a holder keeps the most');
}

// generosity: the allowance's own reserve, 40 to 0 days of need beyond the floor; its explanation names the label
{
  const st = make(), hh = st.households[0], other = st.households[1], giver = hh.holder;
  const ctx = { giver, receiver: other.holder, from: hh, to: other };
  const reserve = () => Rules.explain(st, 'allowance', ctx).parts.find((q) => q.key === 'reserve').factor;
  const days = AT.map((x) => (set(st, giver, 'generosity', x), -reserve() / dailyNeed(st, hh)));
  assert.ok(near(days[0], 40, 1e-6) && near(days[1], 20, 1e-6) && near(days[2], 0, 1e-6), `reserve 40, 20, 0 days: ${days}`);
  set(st, giver, 'generosity', 0.9);
  const ex = VB['sim/exchange'].explainAllowance(st, giver, other.holder);
  assert.ok(ex.parts.find((q) => q.key === 'reserve').label.endsWith(': open-handed'), 'the allowance names the trait');
  assert.strictEqual(st.pawns[giver].buffer, undefined, 'no drawn buffer');
  assert.deepStrictEqual(checkState(st), []);
}

// body: health regained on a fed, warm day, 2.5 to 3.5
{
  const st = make(), p = st.pawns[st.living[0]];
  const got = AT.map((x) => {
    set(st, p.id, 'body', x);
    p.health = 50;
    p.hunger = 0;
    updateHealth(st, p, true, 0, 0);
    return p.health - 50;
  });
  assert.ok(near(got[0], 2.5) && near(got[1], HEALTH.recover) && near(got[2], 3.5), `health regained ${got}`);
}

// honour: a breach is felt 0.5 to 1.5 times, its value and its cap; a memory that is no breach is not
{
  const st = make(), [a, b] = st.living;
  for (const [x, k] of [[0, 0.5], [0.5, 1], [1, 1.5]]) {
    set(st, a, 'honour', x);
    st.pawns[a].rel.clear();
    R.remember(st, a, b, 'claim');
    assert.ok(near(st.pawns[a].rel.get(b).mem.claim.v, SOCIAL.memories.claim.v * k), `claim at honour ${x}`);
    for (let i = 0; i < 6; i++) R.remember(st, a, b, 'claim');
    assert.ok(near(st.pawns[a].rel.get(b).mem.claim.v, SOCIAL.memories.claim.cap * k), `its cap at honour ${x}`);
    R.remember(st, a, b, 'worked');
    assert.ok(near(st.pawns[a].rel.get(b).mem.worked.v, SOCIAL.memories.worked.v), 'worked together is no breach');
  }
}

// ambition: the pressure needed to leave at the moving round, 1.5 to 0.5 times; at 0.5 the chance by rounds waited, as before
{
  const st = make(), id = st.living[0];
  set(st, id, 'ambition', 0.5);
  for (let w = 1; w <= 5; w++)
    assert.strictEqual(leaveChance(w / T.act(st, id, 'ambition', 'settle')), SETTLE.chance[Math.min(w, SETTLE.chance.length) - 1], `${w} rounds`);
  set(st, id, 'ambition', 1);
  assert.ok(near(leaveChance(1 / T.act(st, id, 'ambition', 'settle')), SETTLE.chance[1]), 'the ambitious feel one round as two');
  set(st, id, 'ambition', 0);
  assert.ok(near(leaveChance(1 / T.act(st, id, 'ambition', 'settle')), SETTLE.chance[0] / 1.5), 'the content feel it as two thirds');
}

// sociability: an idle pawn seeks company at SOCIAL.seek × 0.5 to 1.5; a draw of 0.6 seeks at 1, not at 0.5
{
  const st = make(), ids = st.living.filter((i) => st.pawns[i].age >= 16);
  for (const i of st.living) Object.assign(st.agents[i], { inside: false, job: null, phase: null });
  const a = st.agents[ids.find((i) => st.living.indexOf(i) !== Math.floor(0.6 * st.living.length))];
  st.rng.talk.fix = 0.6;
  set(st, a.id, 'sociability', 0.5);
  st.idlers = undefined;
  assert.strictEqual(R.companyFor(st, a), null, 'at 0.5 (0.5) a draw of 0.6 seeks no one');
  set(st, a.id, 'sociability', 1);
  st.idlers = undefined;
  assert.notStrictEqual(R.companyFor(st, a), null, 'at 1 (0.75) it seeks someone');
  assert.ok(near(Math.min(1, SOCIAL.talk.chance * T.act(st, a.id, 'sociability', 'talk')), 1), 'starts a talk at its turn at 1');
  set(st, a.id, 'sociability', 0);
  assert.ok(near(SOCIAL.talk.chance * T.act(st, a.id, 'sociability', 'talk'), 0.5), 'and at 0.5 at 0');
  delete st.rng.talk.fix;
}

// openness and piety in the daily drift: a person's malleability 0.5 to 1.5 times, the pull of what it learned young 0.5 to 1.5 times;
// the chance to take up a cause 0 to 2 times
{
  const st = make(), [i, j] = st.living.filter((x) => st.pawns[x].age >= 20);
  const p = st.pawns[i], q = st.pawns[j];
  const hooks = (o) => ({ byId: (id) => st.pawns[id], settlementOf: () => null, act: (x, t, r) => T.act(st, x.id, t, r), living: [i], ...o });
  p.interest = null;
  p.advocate = null;
  for (let d = 0; d < C.DIMS.length; d++) for (let k = 0; k < C.NOPT[d]; k++) q.att[C.OFF[d] + k] = p.anc[C.OFF[d] + k] = 1 / C.NOPT[d];
  const step = (open, pious, o = {}) => {
    const att = Float32Array.from(p.att), anc = Float32Array.from(p.anc), ties = p.ties;
    set(st, i, 'openness', open);
    set(st, i, 'piety', pious);
    p.ties = new Map([[j, 1]]);
    C.dailyStep({ people: st.pawns, settlements: [], cultures: [], driftMul: 1 }, hooks(o), 1 / 120, () => 0.5);
    const moved = p.att.reduce((s, x, k) => s + Math.abs(x - att[k]), 0);
    p.att.set(att); p.anc.set(anc); p.ties = ties;
    return moved;
  };
  // the person's anchor and company both sit at the uniform: the drift toward it grows with openness (social) and with piety (anchor)
  const [o0, o5, o1] = AT.map((x) => step(x, 0.5)), [p0, p5, p1] = AT.map((x) => step(0.5, x));
  assert.ok(o5 > 0 && o0 < o5 && o5 < o1, `openness moves it faster: ${o0}, ${o5}, ${o1}`);
  assert.ok(p0 < p5 && p5 < p1, `piety pulls it home harder: ${p0}, ${p5}, ${p1}`);
  assert.ok(near(o5, p5), 'both at 0.5 are the same step');
  assert.ok(near(step(0.5, 0.5, { act: undefined }), o5), 'neutral at 0.5: as a drift without traits');
  // a cause: a draw just under the chance at 0.5 takes one up, and at openness 0 never
  const chance = C.P.entrepreneur * C.DIMS[0].m * C.DIMS[0].m;
  const env = { people: st.pawns, settlements: [], cultures: [], t: 100 };
  for (const [x, takes] of [[0, false], [0.5, true], [1, true]]) {
    p.advocate = null; p.causeSince = null; set(st, i, 'openness', x);
    const out = C.entrepreneurs(env, hooks(), () => chance * 0.99);
    assert.strictEqual(out.includes(p), takes, `a cause at openness ${x}`);
  }
  p.advocate = null; p.causeSince = null;
  set(st, i, 'openness', 0.4);
  assert.strictEqual(C.entrepreneurs(env, hooks(), () => chance * 0.79).includes(p), true, 'at 0.4, 0.8 times the chance');
  p.advocate = null; p.causeSince = null;
  assert.strictEqual(C.entrepreneurs(env, hooks(), () => chance * 0.81).includes(p), false, 'and not above it');
  p.advocate = null; p.causeSince = null;
}

// the leanings: a byte a custom, the option the attitude favours most, compiled wherever culture writes the attitude
{
  const st = make();
  for (const p of st.pawns) {
    assert.ok(p.leans instanceof Uint8Array && p.leans.length === C.DIMS.length, `pawn ${p.id} has its leanings`);
    C.DIMS.forEach((_, d) => {
      let top = 0;
      for (let j = 1; j < C.NOPT[d]; j++) if (p.att[C.OFF[d] + j] > p.att[C.OFF[d] + top]) top = j;
      assert.strictEqual(p.leans[d], top, `pawn ${p.id}, custom ${d}`);
    });
  }
  const p = st.pawns[st.living[0]], d = 3, opt = (p.leans[d] + 1) % C.NOPT[d];
  for (let k = 0; k < 8; k++) C.advocate(p, d, opt, 10, 0);
  assert.strictEqual(p.leans[d], opt, 'a cause taken up moves the leaning with the attitude');
}

// chemistry: personal × the seeded term + likeness × likeness − friction × (tempers − 1) − customs × the customs between them
{
  const st = make(), [a, b] = st.living.filter((x) => st.pawns[x].age >= 20), CH = SOCIAL.chemistry, saved = { ...CH };
  const pa = st.pawns[a], pb = st.pawns[b];
  const only = (k) => { for (const x of Object.keys(saved)) if (x !== 'span') CH[x] = x === k ? 1 : 0; const c = R.compat(st, a, b); Object.assign(CH, saved); return c; };
  pb.born = pa.born; // no age gap
  const alike = ['generosity', 'piety', 'ambition', 'honour', 'sociability'];
  for (const k of alike) { set(st, a, k, 0.5); set(st, b, k, 0.5); }
  set(st, a, 'temper', 0.5); set(st, b, 'temper', 0.5);
  pb.leans.set(pa.leans);
  const personal = only('personal');
  assert.ok(personal > -1 && personal < 1, 'the seeded term');
  assert.strictEqual(only('likeness'), 1, 'two alike in all five: likeness 1');
  for (const k of alike) set(st, b, k, 0.5 + CH.span);
  assert.ok(near(only('likeness'), 0), 'apart by span in each: 0');
  for (const k of alike) set(st, b, k, 0.5 + 2 * CH.span);
  assert.ok(near(only('likeness'), -1), 'twice that: -1');
  for (const k of alike) set(st, b, k, 0.5);
  assert.ok(near(only('friction'), 0), 'two tempers of 0.5: no friction');
  set(st, a, 'temper', 0.9); set(st, b, 'temper', 0.8);
  assert.ok(near(only('friction'), -0.7), 'two hot tempers: −(0.9 + 0.8 − 1)');
  set(st, a, 'temper', 0.5); set(st, b, 'temper', 0.5);
  assert.strictEqual(only('customs'), 0, 'agreeing on every custom: none between them');
  const all = R.compat(st, a, b);
  assert.ok(near(all, Math.max(-1, Math.min(1, CH.personal * personal + CH.likeness))), `the sum: ${all}`);
  // Like seeks like: alike but for their customs, they think less of each other; agreeing gains nothing over a world without the term
  const w = C.DIMS.map((x) => 1 - x.m), sum = w.reduce((x, y) => x + y, 0), d = C.DIMS.findIndex((x) => x.m < 1);
  pb.leans[d] = (pa.leans[d] + 1) % C.NOPT[d];
  assert.ok(near(R.compat(st, a, b), Math.max(-1, Math.min(1, all - CH.customs * (w[d] / sum)))), 'one custom apart costs its weight');
  assert.ok(R.compat(st, a, b) < all, 'differing customs: less compatible');
  pb.leans.set(pa.leans);
  CH.customs = 0;
  assert.strictEqual(R.compat(st, a, b), all, 'agreeing: the same as without the customs term');
  Object.assign(CH, saved);
  // the age gap as before
  pb.born = pa.born - 15 * VB['sim/rules'].YEAR;
  assert.ok(near(R.compat(st, a, b), Math.max(-1, Math.min(1, all - 0.2))), 'ten years beyond five: 0.2 less');
}

// the quarrel: cross words become one at T.quarrel × the two tempers' sum (a draw of the talk stream); both remember it, and it is an
// event of the record with its kind, both pawns and the place
{
  const st = make(), [a, b] = st.living.filter((x) => st.pawns[x].age >= 16);
  set(st, a, 'temper', 0.5); set(st, b, 'temper', 0.5);
  const n0 = st.record.length;
  st.rng.talk.fix = 0.0501;
  R.quarrelMaybe(st, a, b);
  assert.strictEqual(st.record.length, n0, 'over 0.05 × 1: no quarrel');
  st.rng.talk.fix = 0.0499;
  R.quarrelMaybe(st, a, b);
  const e = st.record[st.record.length - 1];
  assert.deepStrictEqual([e.kind, e.pawn, e.other, e.village], ['quarrel', a, b, VB['sim/records'].settlementIdOf(st, st.pawns[a])]);
  assert.ok(near(st.pawns[a].rel.get(b).mem.quarrel.v, -0.1) && near(st.pawns[b].rel.get(a).mem.quarrel.v, -0.1), 'both remember it');
  set(st, a, 'temper', 0.9); set(st, b, 'temper', 0.9);
  st.rng.talk.fix = 0.089;
  R.quarrelMaybe(st, a, b);
  assert.strictEqual(st.record.length, n0 + 2, 'two hot tempers: 0.05 × 1.8');
  for (let i = 0; i < 4; i++) R.quarrelMaybe(st, a, b);
  assert.ok(near(st.pawns[a].rel.get(b).mem.quarrel.v, -0.3), 'to -0.3');
  delete st.rng.talk.fix;
  assert.deepStrictEqual(checkState(st), []);
}
// VB-1106: a father and his son of 5 have cross words. Below the age of account (SOCIAL.account) it is no quarrel, at any draw: no
// event, no memory; and the father's opinion of the boy, and the boy's of him, hold no chemistry but liking: the standing alone, where
// the two do not get on. At 12 the same pair is two people who do not get on, and their cross words may be a quarrel.
{
  const st = make(), YEAR = VB.sim.YEAR, AF = SOCIAL.affinity;
  const son = st.living.find((x) => st.pawns[x].sex === 'm' && st.pawns[x].father !== null && st.pawns[x].age < 12), p = st.pawns[son], father = p.father;
  const aged = (y) => { p.age = y; p.born = st.t - y * YEAR; };
  aged(5);
  set(st, father, 'temper', 1); set(st, son, 'temper', 1);
  R.addTie(st, father, son, 2 * AF.known); R.addTie(st, son, father, 2 * AF.known);
  const c = R.compat(st, father, son), n0 = st.record.length;
  assert.ok(c < -0.5, `a father and son who do not get on: ${c}`);
  st.rng.talk.fix = 0;
  R.quarrelMaybe(st, father, son); R.quarrelMaybe(st, son, father);
  assert.strictEqual(st.record.length, n0, 'cross words with a boy of 5: no quarrel event');
  assert.ok(!st.pawns[father].rel.has(son) && !p.rel.has(father), 'and neither remembers one');
  assert.ok(near(R.opinionOf(st, father, son), SOCIAL.situational.child) && near(R.opinionOf(st, son, father), SOCIAL.situational.parent), `opinions ${R.opinionOf(st, father, son)}, ${R.opinionOf(st, son, father)}`);
  assert.ok(!st.pawns[father].bands.has(son) && !p.bands.has(father), 'no enemy of a small child');
  aged(SOCIAL.account);
  const c12 = R.compat(st, father, son);
  assert.ok(near(R.opinionOf(st, father, son), SOCIAL.situational.child + AF.weight * c12), `at ${SOCIAL.account} chemistry counts: ${R.opinionOf(st, father, son)}`);
  R.quarrelMaybe(st, father, son);
  assert.strictEqual(st.record[st.record.length - 1].kind, 'quarrel', 'and cross words may be a quarrel');
  assert.ok(near(R.opinionOf(st, father, son), SOCIAL.situational.child + AF.weight * c12 + SOCIAL.memories.quarrel.v), 'remembered');
  // liking counts from the start: a child and one it gets on with
  const liked = st.living.find((x) => x !== son && R.compat(st, x, son) > 0.05 && R.standing(st, x, son) === null);
  if (liked !== undefined) {
    aged(5);
    const cl = R.compat(st, liked, son);
    R.addTie(st, liked, son, 2 * AF.known);
    if (cl > 0) assert.ok(near(R.opinionOf(st, liked, son), AF.weight * cl), `liking a child of 5: ${R.opinionOf(st, liked, son)}`);
  }
  delete st.rng.talk.fix;
}
// VB-1106: a close friendship is left at the friend line (closeFriend − back), so one that dips and comes back is not told again
{
  assert.ok(near(SOCIAL.closeFriend - SOCIAL.back, SOCIAL.friend), 'left at the friend line');
  assert.deepStrictEqual([R.bandOf(1, SOCIAL.friend + 0.01), R.bandOf(1, SOCIAL.friend - 0.01), R.bandOf(0, SOCIAL.closeFriend - 0.01)], [1, 0, 0]);
  assert.deepStrictEqual([R.bandOf(-1, SOCIAL.enemy + SOCIAL.back - 0.01), R.bandOf(-1, SOCIAL.enemy + SOCIAL.back + 0.01)], [-1, 0]);
}
console.log('traitacts: each trait\'s acts at 0, 0.5 and 1; chemistry\'s four terms and Like seeks like; the quarrel; the age of account');
