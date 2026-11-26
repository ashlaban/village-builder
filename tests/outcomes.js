// Commands' outcomes and the queue (VB-1405): the dispatcher gives the queue done, refused(why) or pending(ref), and `issue` keeps its
// true-or-reason contract, both through one execution; the queue asks the verb whether its reference is still active: for work, the
// pawn's particular assignment in the slot of its attention, so a release ends it whoever works on, a reposted key or a fresh taking
// does not revive it, and side work lasts while held. A refusal changes nothing; a save keeps the reference, and a command begun in a
// save made before VB-1405, with none, resumes by the pawn as it stands. Test-only kinds, as tests/attention.js has them.
const assert = require('assert');
const VB = require('../src/load.js'), Sim = VB.sim, { issue, perform, active, VERBS } = VB['sim/commands'];
const { KINDS } = VB['sim/kinds'], { post } = VB['sim/jobs'], { bid, appraise, workCommand } = VB['sim/fit'], A = VB['sim/agents'], At = VB['sim/attention'];
const { playerStep } = VB['sim/player'], O = VB['sim/opportunities'];
const { tinyWorld, tinyState } = require('./lib/tiny.js'), { canon, sha, kept } = require('./lib/canon.js'), { checkState } = require('./lib/invariants.js');
const rows = Array.from({ length: 12 }, (_, i) => (i < 2 ? 'FFFFFFFFFFFFFFFF' : '................'));
const hash = (st) => sha(canon(kept(st)));
const sound = (st, what) => assert.deepStrictEqual(checkState(st), [], `invariants, ${what}`);
const FARMER = 0, WIFE = 1;
const base = { ...KINDS.plow, done: undefined, available: undefined, stages: undefined, urgency: undefined, again: undefined };
Object.assign(KINDS, {
  oTwo: { ...base, hands: 2 }, oOne: { ...base, hands: 1 }, oPart: { ...base, mind: true, yields: true, reach: 99, rate: 0, hands: 2 },
});
for (const R of Object.values(VB['sim/roles'].ROLES)) if (R.prio) R.prio.oOne = R.prio.plow || 1; // so the list and the matcher weigh it
// A spring morning on the tiny island; the farmer is played with its automatic behaviour off, free of its task, and three test jobs
// are posted by its house.
function make() {
  const st = tinyState(tinyWorld(rows), [{ at: [8, 7], farms: 3 }], { seed: 4 });
  Sim.advance(st, 4.5);
  for (const id of [FARMER, WIFE]) A.release(st, st.agents[id]);
  Sim.inhabit(st, FARMER); Sim.setAuto(st, st.player.pawn, false);
  const owner = { type: 'household', id: st.pawns[FARMER].household }, site = st.farmsteads[st.households[owner.id].farmstead].house;
  const mk = (key, kind) => post(st, key, kind, owner, site, { hours: 10 });
  return { st, two: mk('o:two', 'oTwo'), one: mk('o:one', 'oOne'), part: mk('o:part', 'oPart') };
}
const q = (st) => Sim.controlOf(st, st.player.pawn).queue;
const queueWork = (st, j) => assert.strictEqual(Sim.queue(st, st.player.pawn, { actor: FARMER, verb: 'work', target: j.key }), true);

// 1. The dispatcher: three outcomes, and issue's contract kept; both reach the verb's run once; a refusal changes nothing.
{
  const { st, two } = make(), runs = { n: 0 }, run = VERBS.work.run;
  VERBS.work.run = (s, c) => { runs.n++; return run(s, c); };
  try {
    const before = hash(st);
    const no = perform(st, { actor: FARMER, verb: 'work', target: 'no-such-job', source: 'player' });
    assert.deepStrictEqual(no, { status: 'refused', why: 'there is no job no-such-job' });
    assert.strictEqual(issue(st, { actor: FARMER, verb: 'work', target: 'no-such-job', source: 'player' }), 'there is no job no-such-job');
    assert.strictEqual(typeof issue(st, { actor: FARMER, verb: 'fly', source: 'player' }), 'string');
    assert.strictEqual(hash(st), before, 'a refusal changes nothing');
    assert.strictEqual(runs.n, 0);
    const out = perform(st, workCommand(FARMER, two.key, 'player'));
    assert.strictEqual(runs.n, 1, 'perform runs the verb once');
    assert.deepStrictEqual(out, { status: 'pending', ref: { slot: 'full', key: two.key, n: st.agents[FARMER].assigned.full } });
    assert.strictEqual(active(st, { verb: 'work', actor: FARMER, target: two.key }, out.ref), true);
    A.release(st, st.agents[FARMER]);
    assert.strictEqual(issue(st, workCommand(FARMER, two.key, 'planner')), true, 'issue answers true, strictly');
    assert.strictEqual(runs.n, 2, 'and runs the verb once');
    const talk = perform(st, { actor: WIFE, verb: 'haltForTalk', args: { until: st.t + 1 }, source: 'talk' });
    assert.strictEqual(talk.status, 'done', 'a verb with no lasting act is done at once');
    assert.strictEqual(active(st, { verb: 'haltForTalk', actor: WIFE }, null), false);
    sound(st, 'the dispatcher');
  } finally { VERBS.work.run = run; }
}

// 2. Two pawns on one job: the played pawn let go of it ends its command, though the other works on.
{
  const { st, two } = make();
  queueWork(st, two); playerStep(st);
  assert.ok(q(st)[0].begun !== null && q(st)[0].ref.key === two.key && st.agents[FARMER].job === two);
  assert.strictEqual(issue(st, workCommand(WIFE, two.key, 'planner')), true);
  playerStep(st); assert.strictEqual(q(st).length, 1, 'lasts while the pawn holds it');
  A.release(st, st.agents[FARMER]); playerStep(st);
  assert.ok(!q(st).length && st.agents[WIFE].job === two, 'released, the command ends while the other works on');
  sound(st, 'two on one job');
}

// 3. Release and reacquisition: a fresh taking of the same job, and the same key posted again, are other assignments.
{
  const { st, two } = make(), a = st.agents[FARMER];
  queueWork(st, two); Sim.queue(st, st.player.pawn, { actor: FARMER, verb: 'idle', args: { until: st.t + 2 } }); playerStep(st);
  const n = q(st)[0].ref.n;
  A.release(st, a); assert.strictEqual(issue(st, workCommand(FARMER, two.key, 'planner')), true);
  assert.ok(a.job === two && a.assigned.full > n, 'on the same job again, a new assignment');
  playerStep(st); assert.deepStrictEqual(q(st).map((c) => c.verb), ['idle'], 'the queue goes on: its assignment ended');
  // the same key posted again: the pawn's work there is not the command's
  const r = make(), b = r.st.agents[FARMER];
  queueWork(r.st, r.one); playerStep(r.st);
  A.release(r.st, b); A.dropJob(r.st, r.one);
  const again = post(r.st, 'o:one', 'oOne', r.one.owner, r.one.site, { hours: 10 });
  assert.strictEqual(issue(r.st, workCommand(FARMER, again.key, 'planner')), true);
  playerStep(r.st); assert.ok(!q(r.st).length && b.job === again, 'a reposted key does not revive the command');
  sound(st, 'reacquired'); sound(r.st, 'reposted');
}

// 4. A charge (VB-1750: mind) is pending while held, in its own slot, beside a task in hand; let go, the queue goes on.
{
  const { st, two, part } = make(), a = st.agents[FARMER];
  assert.strictEqual(issue(st, workCommand(FARMER, two.key, 'planner')), true);
  queueWork(st, part); playerStep(st);
  assert.deepStrictEqual(q(st)[0].ref, { slot: 'mind', key: part.key, n: a.assigned.mind[part.key] });
  assert.ok(a.mind.includes(part) && a.job === two, 'minded beside the task in hand');
  for (let i = 0; i < 3; i++) { playerStep(st); assert.strictEqual(q(st).length, 1, 'pending while held'); }
  A.release(st, a); playerStep(st); assert.strictEqual(q(st).length, 1, 'the full task let go is not the side task\'s end');
  At.unhold(st, a, part); playerStep(st); assert.strictEqual(q(st).length, 0, 'let go, it ends');
  sound(st, 'side work');
}

// 5. A competing claimant between the preview and the execution: the list offers the job, another takes the last place, the queue
// refuses the command with its reason, changing nothing, and the next command is issued.
{
  const { st, one } = make();
  const row = O.forPawn(st, O.actorView(st, FARMER), FARMER).find((o) => o.verb === 'work' && o.target === one.key);
  assert.ok(row && row.why === null, `offered: ${row && row.why}`);
  assert.strictEqual(row.fit, bid(st, st.agents[FARMER], one, Sim.cal(st.t)), 'the list\'s fit is the matcher\'s bid');
  queueWork(st, one); Sim.queue(st, st.player.pawn, { actor: FARMER, verb: 'idle', args: { until: st.t + 1 } });
  assert.strictEqual(issue(st, workCommand(WIFE, one.key, 'planner')), true);
  const claims = [...one.claims];
  playerStep(st);
  assert.ok(/has no room/.test(Sim.controlOf(st, st.player.pawn).refused.why) && Sim.controlOf(st, st.player.pawn).refused.verb === 'work');
  assert.deepStrictEqual(one.claims, claims, 'the refusal took no place');
  assert.ok(q(st).length === 1 && q(st)[0].verb === 'idle' && q(st)[0].begun !== null, 'and the next command is under way');
  assert.deepStrictEqual(q(st)[0].ref, { until: q(st)[0].args.until });
  // appraisal draws nothing and writes nothing
  const before = hash(st);
  for (const j of st.jobs.values()) appraise(st, st.agents[WIFE], j, Sim.cal(st.t));
  assert.strictEqual(hash(st), before, 'appraising every job changes nothing');
  sound(st, 'a competing claimant');
}

// 6. Saved mid-assignment: the reference comes back, the command is not issued again, and both runs agree. A save made before
// VB-1405 (no reference) resumes by the pawn as it stands: on the job, it waits; its assignment over, the queue goes on.
{
  const { st, two } = make();
  queueWork(st, two); Sim.queue(st, st.player.pawn, { actor: FARMER, verb: 'idle', args: { until: st.t + 2 } }); playerStep(st);
  const data = JSON.parse(JSON.stringify(Sim.save(st))), back = Sim.load(tinyWorld(rows), data);
  assert.deepStrictEqual(Sim.controlOf(back, back.player.pawn).queue[0].ref, q(st)[0].ref);
  const n = back.agents[FARMER].assigned.assignments;
  playerStep(back);
  assert.ok(Sim.controlOf(back, back.player.pawn).queue.length === 2 && back.agents[FARMER].assigned.assignments === n, 'resumed, not issued again');
  for (const s of [st, back]) Sim.advance(s, 2);
  assert.strictEqual(hash(back), hash(st), 'the loaded run and the saved one agree');
  sound(back, 'loaded mid-assignment');
  // an older save: the head begun with no reference
  const r = make(); queueWork(r.st, r.two); Sim.queue(r.st, r.st.player.pawn, { actor: FARMER, verb: 'idle', args: { until: r.st.t + 2 } }); playerStep(r.st);
  const saved = JSON.parse(JSON.stringify(Sim.save(r.st)));
  delete saved.state.pawns[FARMER].control.queue[0].ref;
  const legacy = Sim.load(tinyWorld(rows), saved);
  assert.strictEqual(Sim.controlOf(legacy, legacy.player.pawn).queue[0].ref, undefined);
  sound(legacy, 'an older save');
  playerStep(legacy); assert.strictEqual(Sim.controlOf(legacy, legacy.player.pawn).queue.length, 2, 'on the job, the old command waits');
  A.release(legacy, legacy.agents[FARMER]); playerStep(legacy);
  assert.deepStrictEqual(Sim.controlOf(legacy, legacy.player.pawn).queue.map((c) => c.verb), ['idle'], 'its assignment over, the queue goes on');
}
console.log('outcomes ok: done, refused and pending from one execution, issue unchanged; a release ends work though another works on; '
  + 'a fresh taking or a reposted key is another assignment; side work lasts while held; a competing claimant refused, the next issued; '
  + 'saved mid-assignment and from before VB-1405');
