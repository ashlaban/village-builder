// What a pawn may do here (VB-209, sim/opportunities): on a tiny map over a game day the list and the planner agree (every open job a pawn
// would bid for is listed as work it may take, and nothing else is), every job a pawn takes was on its list, and asking changes nothing
// and draws nothing. Its own acts, a cause and the moving round's acts each come with the rule that bars them.
const assert = require('assert');
const VB = require('../src/load.js'), Sim = VB.sim, O = VB['sim/opportunities'], J = VB['sim/jobs'], H = VB['sim/heirs'];
const { MATCH, SERVICE } = VB['sim/rules'], { isOpen } = VB['sim/kinds'], { issue } = VB['sim/commands'];
const { tinyWorld, tinyState } = require('./lib/tiny.js'), { canon, sha } = require('./lib/canon.js');
const rows = Array.from({ length: 12 }, (_, i) => (i < 2 ? 'F'.repeat(18) : i === 11 ? '~'.repeat(18) : '.'.repeat(18)));
const hash = (st) => { const { w, ...rest } = st; return sha(canon(rest)); };
const housed = (st) => st.living.filter((id) => st.pawns[id].household !== null);
const ask = (st, id, near) => O.forPawn(st, O.actorView(st, id), id, near);

// ---- the list and the planner agree, over a game day ----
{
  const st = tinyState(tinyWorld(rows), [{ at: [8, 6], farms: 4 }], { seed: 7, herds: true });
  let asked = 0, may = 0, barred = 0, taken = 0, most = 0;
  const reasons = new Set();
  while (st.t < 6 + Sim.DAY) {
    const c = Sim.cal(st.t), before = new Map(), at = st.t;
    for (const id of housed(st)) {
      const p = st.pawns[id], a = st.agents[id], list = ask(st, id), works = list.filter((o) => o.verb === 'work');
      before.set(id, new Set(works.map((o) => o.target)));
      asked++; most = Math.max(most, list.length);
      // a job the planner's matching would let this pawn bid for: open, its household's or its village's, with a score that noise can lift above 0
      const bids = new Set();
      for (const j of J.jobsFor(st, p)) {
        const s = J.score(st, p, j, c);
        if (isOpen(j) && VB['sim/eligibility'].eligible(st, j, p) && s !== null && s + MATCH.noise > 0 && a.job !== j) bids.add(j.key);
      }
      const offered = new Set(works.filter((o) => o.why === null).map((o) => o.target));
      for (const k of bids) assert.ok(offered.has(k), `${c.hour.toFixed(1)}: pawn ${id} would bid for ${k}, which is not offered`);
      for (const k of offered) assert.ok(bids.has(k), `${c.hour.toFixed(1)}: pawn ${id} is offered ${k}, which it would not bid for`);
      for (const o of works) {
        assert.ok(['member', 'servant', 'villager'].includes(o.basis) && o.holder && o.kind && o.when === 'now', JSON.stringify(o));
        assert.strictEqual(o.basis === 'villager', o.holder.type === 'village');
        if (o.why === null) { may++; assert.ok(o.fit > -MATCH.noise, `fit ${o.fit}`); } else { barred++; reasons.add(o.why.replace(/\d\d:\d\d/, 'HH:MM')); }
      }
      const fits = works.filter((o) => o.why === null).map((o) => o.fit);
      assert.deepStrictEqual(fits, [...fits].sort((x, y) => y - x), 'work it may take comes best fit first');
    }
    Sim.advance(st, 0.1);
    // every job a pawn set out for in the step was on its list, unless it was first given out within the step
    for (const id of housed(st)) {
      const j = st.agents[id].job;
      if (!j || !before.has(id) || j.posted >= at) continue;
      if (st.agents[id].phase === 'go') { taken++; assert.ok(before.get(id).has(j.key), `pawn ${id} took ${j.key}, which was not on its list`); }
    }
  }
  assert.ok(may > 100 && barred > 100 && taken > 20, `too little was tested: ${may} offered, ${barred} barred, ${taken} taken`);
  for (const r of ['taken', 'not their work', 'doing it now']) assert.ok(reasons.has(r), `no work was barred as "${r}" (${[...reasons].join('; ')})`);
  console.log(`  a day of 4 farms: asked ${asked} times, at most ${most} items; work offered ${may} times, barred ${barred} (${[...reasons].join('; ')}); `
    + `${taken} jobs taken, each from the list`);
}

// ---- asking changes nothing and draws nothing; the acts of its own, a cause, and the round's ----
{
  // four farms: household 2 has grown children; household 3's holder is left alone; household 1 dies out and its farm stands empty
  const st = tinyState(tinyWorld(rows), [{ at: [8, 6], farms: 4, sizes: [9, 9, 9, 9] }], { seed: 4 });
  const empty = st.farmsteads[st.households[1].farmstead], lone = st.households[3];
  H.extinct(st, st.households[1]);
  for (const id of [...lone.members]) if (id !== lone.holder) Sim.killPawn(st, id, 'illness');
  H.countDemand(st); Sim.refreshRoles(st);
  assert.ok(lone.members.length === 1 && empty.household === null && st.demand.length > 1, 'the scene: a lone holder, an empty farm, adults who want out');
  Sim.advance(st, 4.5);
  const h0 = hash(st), rng = canon(st.rng), sea = 11 * st.w.COLS + 3, green = st.villages[0].center;
  const all = new Map(housed(st).map((id) => [id, ask(st, id, green)]));
  assert.strictEqual(hash(st), h0, 'asking leaves the state as it was'); assert.strictEqual(canon(st.rng), rng, 'and draws no random number');
  assert.deepStrictEqual(ask(st, 9999), [], 'nothing for a pawn that does not exist');
  const of = (id, verb) => all.get(id).filter((o) => o.verb === verb);
  // its own acts
  const anyone = housed(st)[0];
  assert.strictEqual(of(anyone, 'walkTo')[0].why, null, 'a walk to the green is open');
  assert.ok(/no one can walk there/.test(ask(st, anyone, sea).find((o) => o.verb === 'walkTo').why), 'not into the sea');
  assert.ok(!ask(st, anyone).some((o) => o.verb === 'walkTo'), 'no walk without a tile asked about');
  assert.ok(of(anyone, 'goHome').length === 1 && of(anyone, 'idle')[0].why === null && of(anyone, 'idle')[0].args.until > st.t);
  const indoors = housed(st).find((id) => st.agents[id].inside && !st.agents[id].job);
  if (indoors !== undefined) assert.ok(/at home already/.test(of(indoors, 'goHome')[0].why));
  // a cause: every option but the village's practice; one argued for already is barred, and may be dropped
  const C = VB.culture, s = st.cenv.settlements[0], options = C.NOPT.reduce((n, k) => n + k, 0) - C.DIMS.length;
  assert.strictEqual(of(anyone, 'argue').length, options, 'each option of each custom but the practice');
  assert.ok(of(anyone, 'argue').every((o) => s.practice[o.args.dim] !== o.args.option && o.why === null && o.basis === 'self'));
  const cause = of(anyone, 'argue')[0].args;
  assert.strictEqual(issue(st, { actor: anyone, verb: 'argue', args: cause, source: 'player' }), true, 'an offered cause is accepted');
  const again = ask(st, anyone);
  assert.ok(/already/.test(again.find((o) => o.verb === 'argue' && o.args.dim === cause.dim && o.args.option === cause.option).why));
  assert.ok(again.some((o) => o.verb === 'dropCause' && o.args.dim === cause.dim) && !of(anyone, 'dropCause').length, 'and may be dropped');
  // the round's acts, each marked, with the rule that bars it
  for (const [id, list] of all) {
    const acts = list.filter((o) => o.when === 'round');
    assert.deepStrictEqual([...new Set(acts.map((o) => o.verb))].sort(), ['claim', 'leave', 'serve'], `pawn ${id}`);
    assert.ok(list.every((o) => (o.when === 'round') === ['claim', 'leave', 'serve'].includes(o.verb)) && !list.some((o) => o.verb === 'marry'));
    const p = st.pawns[id], wants = st.demand.includes(id);
    assert.strictEqual(of(id, 'leave')[0].why === null, wants, `pawn ${id}: moving out is open to those the round counts as wanting out`);
    const claim = of(id, 'claim'); assert.ok(claim.length === 1 && claim[0].target === empty.id, 'the empty farm of its village');
    assert.strictEqual(claim[0].why === null, VB['sim/farmclaims'].claimants(st, empty, wants ? [id] : []).length > 0,
      `pawn ${id}: claiming, as the round's rule has it`);
    const serve = of(id, 'serve');
    if (p.household !== lone.id) assert.ok(serve.length === 1 && serve[0].target === lone.id && serve[0].holder.id === lone.id,
      'service with the holder who lives alone');
    const fitToServe = wants && VB['sim/service'].unfit(st, p) === null && VB['sim/service'].handsLeft(st, p) >= SERVICE.keepHands;
    assert.strictEqual(serve[0].why === null, fitToServe && p.household !== lone.id, `pawn ${id}: service (${serve[0].why})`);
  }
  const whys = (verb) => [...new Set([...all.values()].flatMap((l) => l.filter((o) => o.verb === verb && o.why).map((o) => o.why)))];
  const open = (verb) => [...all.values()].filter((l) => l.some((o) => o.verb === verb && o.why === null)).length;
  assert.ok(open('leave') && open('claim') && open('serve'), `someone may move out, claim and serve (${open('leave')}, ${open('claim')}, ${open('serve')})`);
  assert.ok(whys('leave').includes('under 18') && whys('leave').some((r) => /holds a farm/.test(r)), whys('leave').join('; '));
  // a ruin cannot be claimed, nor a farm being restored
  empty.state = 'ruin'; assert.ok(/ruin/.test(ask(st, anyone).find((o) => o.verb === 'claim').why)); empty.state = 'derelict';
  const claimant = [...all].find(([, l]) => l.some((o) => o.verb === 'claim' && o.why === null))[0];
  assert.strictEqual(issue(st, { actor: claimant, verb: 'claim', target: empty.id, source: 'round' }), true, 'an offered claim is accepted');
  assert.ok(/is restoring it/.test(ask(st, anyone).find((o) => o.verb === 'claim').why));
  assert.ok(/restoring a farm it claimed/.test(ask(st, claimant).find((o) => o.verb === 'leave').why));
  console.log(`  the round's acts among ${all.size}: ${open('leave')} may move out, ${open('claim')} claim the empty farm, ${open('serve')} serve; `
    + `barred: ${whys('leave').join('; ')}; ${whys('serve').join('; ')}`);
}
console.log('opportunities ok: the list and the planner agree over a day; asking changes nothing; own acts, causes and the round\'s acts, each with its bar');
