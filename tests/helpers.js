// Help asked for (VB-470; VB-106): two households of one village; B has a field in stubble to hoe, A three idle adults and nothing of
// its own to do. B's head asks A's head for hands (an offer on the basis `help`, sim/hands): A's head, unplayed, answers by kinship,
// opinion and its own day, and lends the adults its day gave no task, for the hours asked or fewer. A hand lent takes B's field work on
// the `helper` basis (sim/eligibility) and no other task, hoes, and goes home when its hours are given; its tie with the adults helped
// rises by the hours given ("Worked together", both ways); its life names the farm; nothing moves between the two stores. A head with no
// one to spare says no and nobody remembers it; one who dislikes the asker says no and both remember it; the played head asked answers
// by the verb. The shortfall a head reads from its estimate is the work its windows leave undone at the pace of its hands.
const assert = require('assert');
const VB = require('../src/load.js'), Sim = VB.sim, { tinyWorld, tinyState } = require('./lib/tiny.js');
const { eligible } = VB['sim/eligibility'], Jobs = VB['sim/jobs'], { opinionOf, remember, balance } = VB['sim/relations'], { GOODWILL } = VB['sim/rules'], { tieOf } = VB['sim/ties'];
const { age } = VB['sim/records'], { MATCH } = VB['sim/roles'], Hands = VB['sim/hands'], { issue } = VB['sim/commands'];
const make = () => {
  const st = tinyState(tinyWorld(Array(20).fill('.'.repeat(36))),
    [{ at: [8, 10], farms: 2, sizes: [7, 4] }, { at: [28, 10], farms: 1, sizes: [4] }], { seed: 4 });
  Sim.advance(st, 3); // 9:00 on the first day of spring
  const [A, B] = [st.households[0], st.households[1]], fB = st.farmsteads[B.farmstead];
  const { freeHands, dropJob } = VB['sim/agents'];
  const dropAll = (key) => { for (const j of [...(st.jobsBy.get(key) || [])]) { if (j.claims.length) freeHands(st, j, -1); dropJob(st, j); } };
  dropAll(`household:${A.id}`); dropAll(`village:${fB.village}`); dropAll(`household:${B.id}`);
  const fd = fB.fields[0];
  fd.stage = 'stubble';
  const j = Jobs.post(st, `plow:f${fB.id}.${fd.id}`, 'plow', { type: 'household', id: B.id }, fd.tile, { field: fd, farm: fB });
  VB['sim/day'].allot(st, A, Sim.cal(st.t)); // A's day, with nothing to do: every member free
  return { st, A, B, fB, fd, j, dropAll };
};
const ask = (st, from, to, wants, source = 'planner') =>
  issue(st, { actor: from, verb: 'offer', target: to, args: { basis: 'help', wants }, source });
const adults = (st, hh) => hh.members.filter((id) => st.pawns[id].alive && age(st, st.pawns[id]) >= MATCH.help.minAge);

// ---- the ask, the answer, the hands' work ----
{
  const { st, A, B, fB, fd, j, dropAll } = make();
  assert.strictEqual(st.farmsteads[A.farmstead].village, fB.village, 'the two households share a village');
  const other = st.households.find((h) => st.farmsteads[h.farmstead].village !== fB.village);
  assert.ok(adults(st, A).length >= 3, 'household A has three adults');
  assert.match(String(issue(st, { actor: B.holder, verb: 'offer', target: other.holder, args: { basis: 'help', wants: { hands: 1, hours: 4 } }, source: 'planner' })),
    /within the village/, 'hands are not asked of another village');
  assert.match(String(ask(st, B.holder, A.holder, { hands: 9, hours: 4 })), /1 to 3 hands/, 'at most three hands');
  const pawn0 = st.pawns[adults(st, A)[0]];
  assert.strictEqual(eligible(st, j, pawn0), null, 'before the ask, a neighbour does not take the hoeing');
  const holder = B.holder, grainA = Sim.grainOf(A), grainB = Sim.grainOf(B);
  assert.strictEqual(ask(st, B.holder, A.holder, { hands: 2, hours: 4 }), true, 'the ask is made');
  const lent = Object.entries(st.handsToday.by).map(([id, e]) => [+id, e]);
  assert.strictEqual(lent.length, 2, `two hands lent (${JSON.stringify(st.handsToday)})`);
  for (const [id, e] of lent) {
    assert.ok(st.pawns[id].household === A.id && e[0] === B.id && e[1] > 0 && e[1] <= 4, `lent ${id}: ${JSON.stringify(e)}`);
    assert.strictEqual(eligible(st, j, st.pawns[id]), 'helper', 'a hand lent takes the hoeing as a helper');
    assert.strictEqual(eligible(st, { ...j, kind: 'cook' }, st.pawns[id]), null, 'but no cooking');
    assert.strictEqual(eligible(st, { ...j, owner: { type: 'household', id: A.id } }, st.pawns[id]), null, 'nor its own household\'s work, while lent');
  }
  const helpers = lent.map(([id]) => id), before = helpers.map((h) => [tieOf(st, h, holder), opinionOf(st, h, holder), opinionOf(st, holder, h)]);
  const t0 = st.t;
  while (helpers.some((id) => Hands.on(st, id) !== null) && st.t < t0 + 12) {
    Sim.advance(st, 0.1);
    dropAll(`household:${A.id}`);
    A.waterDay = B.waterDay = Sim.cal(st.t).day; // the jobs taken down include the water (VB-331): the households are not left dry
  }
  const worked = lent.map(([, e]) => e[2]);
  assert.ok(worked.every((h, i) => h > 0 && h <= lent[i][1][1] + 0.11), `each hand worked its hours and no more (${worked}, of ${lent.map(([, e]) => e[1])})`);
  assert.ok(lent.every(([id]) => !(st.agents[id].job && st.agents[id].job.owner.id === B.id) && !j.claims.includes(id)), 'and let the hoeing go when they were given (VB-1565)');
  assert.ok(fd.stage !== 'stubble' || j.done > 0, 'the hoeing went on');
  const after = helpers.map((h) => [tieOf(st, h, holder), opinionOf(st, h, holder), opinionOf(st, holder, h)]);
  helpers.forEach((h, k) => {
    const gain = (MATCH.help.tie * worked[k]) / MATCH.help.tieHours;
    assert.ok(after[k][0] > before[k][0] + gain * 0.8, `the tie of helper ${h} to the holder rose by the hours: ${before[k][0]} -> ${after[k][0]}, ${gain} expected`);
    assert.ok(after[k][1] > before[k][1] - 0.1 && after[k][2] > before[k][2] - 0.1, 'opinion did not fall');
    const r = st.pawns[holder].rel.get(h);
    assert.ok(r && r.mem.worked, 'the holder remembers working together');
    const e = st.record[st.pawns[h].events.find((i) => st.record[i].kind === 'helped')];
    assert.ok(e && e.farm === fB.id && e.text.includes(fB.name), 'the life event names the farm');
    // VB-704: credit follows the pawn who acted: the hours' worth is the helper's, owed by the head helped, not A's head's
    const owed = balance(st, h, holder), want = worked[k] * GOODWILL.hour;
    assert.ok(Math.abs(owed - want) < 0.05 || (want < GOODWILL.forget && owed === 0), `helper ${h} is owed ${want} rations by the head, ${owed} booked`);
    if (!helpers.includes(A.holder)) assert.strictEqual(balance(st, A.holder, holder), 0, 'the helper\'s own head is owed nothing for its hours');
  });
  // the credit stays its own: a helper that leaves its household keeps its balance
  const h0 = helpers.find((h) => h !== A.holder), kept = balance(st, h0, holder);
  st.pawns[h0].household = null; // as if it had left; goodwill is the pawn's, not the household's
  assert.strictEqual(balance(st, h0, holder), kept, 'a member\'s goodwill stays its own when it leaves the household');
  st.pawns[h0].household = A.id;
  assert.ok(!Sim.villageLog(st, 1000).some((r) => r.ev.kind === 'helped'), 'help writes no line of the village log');
  assert.ok(Sim.grainOf(A) <= grainA && Sim.grainOf(B) <= grainB, 'nothing moved between the stores with the help');
  console.log(`  ${helpers.length} hands lent to ${fB.name}, worked ${worked.map((h) => h.toFixed(1)).join(' and ')} h; tie ${before[0][0].toFixed(2)} -> ${after[0][0].toFixed(2)}`);
}

// ---- the day's end (VB-1565): a hand lent for more hours than the day has left is let go of the task when work ends, and walks home
// holding no claim on it, so no work is credited to a hand not there ----
{
  const { st, A, B, j, dropAll } = make();
  const { WORK, DAY } = VB['sim/rules'], { checkState } = require('./lib/invariants.js');
  Sim.advance(st, WORK[1] - 2 - (st.t % DAY)); // two hours of work left
  assert.strictEqual(ask(st, B.holder, A.holder, { hands: 1, hours: 4 }), true, 'the ask is made');
  const [id] = Object.keys(st.handsToday.by).map(Number);
  let seen = false;
  while (st.t % DAY < WORK[1] + 1) {
    Sim.advance(st, 0.1);
    dropAll(`household:${A.id}`);
    A.waterDay = B.waterDay = Sim.cal(st.t).day;
    seen = seen || (st.agents[id].job === j && st.agents[id].phase === 'work');
    const a = st.agents[id];
    assert.ok(!a.job || ['go', 'work', 'back'].includes(a.phase), `the helper holds job ${a.job && a.job.key} in phase ${a.phase}`);
  }
  assert.ok(seen, 'the helper worked the hoeing before the day ended');
  assert.ok(st.agents[id].job !== j && !j.claims.includes(id), `the helper let the hoeing go at the day's end (phase ${st.agents[id].phase})`);
  const bad = checkState(st).filter((m) => /holds job/.test(m));
  assert.deepStrictEqual(bad, [], 'no agent holds a task while going home');
  console.log(`  a helper lent at ${WORK[1] - 2}:00 for 4 hours let the hoeing go at the day's end`);
}

// ---- the answers: no one to spare, a head who dislikes the asker, the played head ----
{
  const { st, A, B } = make();
  const plan = st.plans.households.get(A.id);
  for (const id of Object.keys(plan.day.free)) plan.day.free[id] = 0; // A's day is full
  ask(st, B.holder, A.holder, { hands: 1, hours: 4 });
  assert.ok(!st.handsToday || !Object.keys(st.handsToday.by).length, 'no hand is lent by a household with none to spare');
  assert.ok(!st.pawns[B.holder].rel.get(A.holder)?.mem?.refusedUs, 'and a no for want of hands is not remembered');
}
{
  const { st, A, B } = make();
  for (const k of ['quarrel', 'marriedAgainst', 'claim', 'refusedMatch', 'hardBargain']) for (let i = 0; i < 4; i++) remember(st, A.holder, B.holder, k);
  assert.ok(opinionOf(st, A.holder, B.holder) < -MATCH.help.factor, `A's head dislikes B's (${opinionOf(st, A.holder, B.holder)})`);
  ask(st, B.holder, A.holder, { hands: 1, hours: 4 });
  assert.ok(!st.handsToday || !Object.keys(st.handsToday.by).length, 'a head who dislikes the asker lends no one');
  assert.ok(st.pawns[B.holder].rel.get(A.holder).mem.refusedUs, 'and the refusal is remembered');
}
{
  const { st, A, B } = make();
  Sim.inhabit(st, A.holder);
  assert.strictEqual(ask(st, B.holder, A.holder, { hands: 1, hours: 4 }), true);
  const o = st.offers.find((x) => x.basis === 'help');
  assert.ok(o && o.answers[0].by === A.holder && !st.handsToday?.by?.[adults(st, A)[0]], 'the played head is asked, and nothing is lent before it answers');
  assert.strictEqual(issue(st, { actor: A.holder, verb: 'answer', target: o.id, args: { yes: true }, source: 'player' }), true);
  assert.strictEqual(Object.keys(st.handsToday.by).length, 1, 'its yes lends a hand');
}

// ---- the shortfall the head reads from its estimate ----
{
  const { st, j } = make();
  const c = Sim.cal(st.t), end = Hands.windowEnd(st, j, c);
  assert.ok(end !== null, 'the hoeing has a window: its crop\'s sowing');
  assert.strictEqual(Hands.shortOf(st, [[j, 10, 10]], c), 0, 'hands that keep pace finish in the window');
  const short = Hands.shortOf(st, [[j, 10000, 1]], c);
  assert.ok(short > 9000 && short < 10000, `a task too big for its hands falls short by what its window leaves undone (${short})`);
  assert.strictEqual(Hands.shortOf(st, [[{ ...j, kind: 'cook' }, 10000, 0]], c), 0, 'work help does not take is not counted');
}
// ---- reaping's window ends at the frost the head expects, not this year's drawn day (VB-1175) ----
{
  const { st, j } = make();
  const W = VB['sim/weather'], y = st.weather[st.weather.length - 1], c = { season: 1, sday: 0 }, reap = { ...j, kind: 'reap' };
  const ends = [7, 11].map((d) => ((y.frost = d), Hands.windowEnd(st, reap, c)));
  assert.strictEqual(ends[0], ends[1], 'the drawn frost does not move the window the head reckons to');
  assert.strictEqual(ends[0], 2 * Sim.SEASON_DAYS + W.frostExpected(st), 'the window ends at the expected frost');
}
console.log('helpers ok: hands asked, answered by kin, opinion and the day, lent for hours as helpers; the tie by the hours; the shortfall; the expected frost');
