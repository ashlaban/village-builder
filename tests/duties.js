// @suite integration
// Duties of the days ahead (VB-1771; design.md section 7, Plans at four scales: The days ahead; Standing duties): a duty is a step of the
// household's days ahead, {what: {duty: type}, who: [one member]}, for a type of recurring work without a window only (the wood, the
// water and the meal, the beasts), given by the head's default author at its review to the member the day put first for it, or through
// the verb assign with a duty; the allotment gives its holder the first place for that type's recurring kinds and changes nothing else; a
// duty lapses with its holder's absence and is given again at the next review. On a small constructed state: three farms on open
// ground, the first days of spring.
const assert = require('assert');
const VB = require('../src/load.js'), Sim = VB.sim, D = VB['sim/day'], Steps = VB['sim/steps'], { KINDS } = VB['sim/kinds'], { CHILD } = VB['sim/roles'];
const { issue } = VB['sim/commands'], { emit } = VB['sim/events'], { age } = VB['sim/records'];
const { tinyWorld, tinyState } = require('./lib/tiny.js'), { canon, sha, kept } = require('./lib/canon.js'), { checkState } = require('./lib/invariants.js');
const rows = Array.from({ length: 12 }, (_, i) => (i < 2 ? 'FFFFFFFFFFFFFFFF' : '................'));
const st = tinyState(tinyWorld(rows), [{ at: [8, 7], farms: 3 }], { seed: 12 });
st.makeFields = false;
D.SWITCH.duties = true; // the default author gives duties (off until Kim's answer, VB-1771)
Sim.advance(st, 30.5); // the second day, 10:30: the household's reviews are behind it
const hh = st.households[0], plan = st.plans.households.get(0), c = Sim.cal(st.t);
const duties = () => plan.ahead.filter((s) => s.what.duty !== undefined);
const holder = (type) => { const s = Steps.dutyOf(plan, type); return s ? s.who[0] : null; };
const review = () => emit(st, 'planReviewed', { plan, c, why: 'day' });

// 0. Only types of recurring work without a window: each has a kind due each day or lived by; no type of the field's windowed work.
{
  const T = D.dutyTypes();
  for (const [type, kinds] of T) for (const k of kinds) assert.ok(KINDS[k].type === type && (KINDS[k].daily || KINDS[k].vital), `${k} is recurring work of ${type}`);
  for (const k of ['plow', 'sow', 'reap', 'haul', 'mow', 'hay', 'thresh']) assert.ok(!(T.get(KINDS[k].type) || new Set()).has(k), `${k} is never a duty's`);
  assert.ok(T.has(KINDS.wood.type) && T.has(KINDS.water.type), 'the wood and the water are');
}

// 1. The review gave the duties: steps of the days ahead, by the default author, one member each, the one the day put first for them.
{
  const S = duties();
  assert.ok(S.length > 0, 'duties given at the review');
  for (const s of S) {
    assert.ok(s.author === 'custom' && s.state === 'open' && s.who.length === 1 && hh.members.includes(s.who[0]), `the duty ${s.what.duty}: ${JSON.stringify(s)}`);
    assert.deepStrictEqual(s.why, { custom: 'duty' });
  }
  assert.deepStrictEqual(D.dutiesToGive(st, hh, plan), [], 'nothing left to give while every type is held');
  const n = S.length;
  review();
  assert.strictEqual(duties().length, n, 'a review gives no type twice');
  assert.deepStrictEqual(checkState(st), [], 'invariants');
}

// 2. The holder has the first place for its type: given the wood to a member the day did not put first for its trip, the next allotment
// gives that member the trip, the others coming to it after; with the duty back where the rule gave it, nothing moves.
{
  const T = KINDS.wood.type, j = [...st.jobs.values()].find((x) => x.kind === 'wood' && x.owner && x.owner.type === 'household' && x.owner.id === 0);
  assert.ok(j, 'a trip to the woods stands');
  const given = (id) => { const day = plan.day, i = day.lists[id].indexOf(j.key); return i >= 0 && (day.fits[id][i] === null || day.fits[id][i] > 0) ? i : -1; };
  D.allot(st, hh, c);
  const rule = holder(T), before = canon(plan.day.lists);
  const other = hh.members.find((m) => m !== rule && age(st, st.pawns[m]) >= CHILD.from && VB['sim/eligibility'].eligible(st, j, st.pawns[m]) && given(m) < 0);
  assert.ok(other !== undefined, 'a member the day did not give the trip');
  const head = hh.holder, assign = (actor, args) => issue(st, { actor, verb: 'assign', target: 0, args, source: 'player' });
  assert.match(assign(hh.members.find((m) => m !== hh.holder), { duty: T, to: other }), /head/, "only the head gives a duty");
  assert.match(assign(head, { duty: KINDS.reap.type, to: other }), /not a type of recurring work/, 'windowed work is never a duty');
  assert.match(assign(head, { duty: 'sorcery', to: other }), /not a type of recurring work/);
  assert.match(assign(head, { duty: T, to: st.households[1].members[0] }), /not a living member/);
  const n = VB.count.dutyFirst;
  assert.strictEqual(assign(head, { duty: T, to: other }), true, 'the head gives the wood');
  assert.ok(holder(T) === other && Steps.dutyOf(plan, T).author === 'pawn' && Steps.dutyOf(plan, T).why === null, 'authored, in place of the rule\'s');
  D.allot(st, hh, c);
  assert.ok(given(other) >= 0, 'its holder is given the trip');
  assert.ok(VB.count.dutyFirst > n, 'put first, counted');
  review();
  assert.strictEqual(holder(T), other, 'the review leaves what was authored');
  // given back to the rule's choice, the allotment is as it was
  assert.strictEqual(assign(head, { duty: T, to: rule }), true);
  D.allot(st, hh, c);
  assert.strictEqual(canon(plan.day.lists), before, 'with the duty where the rule gave it, the day as before');
  // with no duties the allotment weighs as with every duty held by the one the rule puts first
  const kept0 = plan.ahead.slice();
  plan.ahead = plan.ahead.filter((x) => x.what.duty === undefined);
  D.allot(st, hh, c);
  plan.ahead = kept0;
  assert.strictEqual(canon(plan.day.lists), before, 'and as with no duties');
  assert.deepStrictEqual(checkState(st), [], 'invariants');
}

// 3. A duty lapses with its holder's absence (ill), and the next review gives it again, to a member at work.
{
  const T = KINDS.wood.type, id = holder(T), p = st.pawns[id];
  p.ill = { since: st.t, until: st.t + 72 }; // lint-allow: test an illness laid on by hand
  emit(st, 'fellIll', { pawn: id });
  assert.strictEqual(holder(T), null, 'the duty lapses with its holder');
  D.allot(st, hh, c);
  review();
  assert.ok(holder(T) !== null && holder(T) !== id, `given again, to another (${holder(T)})`);
  delete p.ill;
  assert.deepStrictEqual(checkState(st), [], 'invariants');
}

// 4. The decision point of the days-ahead review: the duties to give, while a type is not held.
{
  const T = KINDS.wood.type, s = Steps.dutyOf(plan, T);
  Steps.dropDuty(plan, s);
  const pt = Sim.decisions(st, hh.holder).find((x) => x.point === 'duty' && x.body.id === 0);
  assert.ok(pt && pt.give.some(([t]) => t === T) && pt.deadline === plan.nextReview, `the point duty: ${JSON.stringify(pt)}`);
  review();
  assert.ok(holder(T) !== null && !Sim.decisions(st, hh.holder).some((x) => x.point === 'duty' && x.body.id === 0), 'given: no point');
}

// 5. Saved and loaded with the plan; no random draw.
{
  const back = Sim.load(tinyWorld(rows), JSON.parse(JSON.stringify(Sim.save(st))));
  assert.strictEqual(canon(back.plans.households.get(0).ahead), canon(plan.ahead), 'the duties come back as saved');
  assert.strictEqual(sha(canon(kept(back))), sha(canon(kept(st))), 'the loaded state is the saved one');
}
console.log(`duties ok (VB-1771): ${duties().map((s) => `${s.what.duty} to ${s.who[0]}`).join(', ')}; the holder first for its type, lapsed when ill and given again`);
