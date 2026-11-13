// Neighbours help (VB-106): two households of one village; one has three idle adults and nothing of its own to do, the other a field in
// stubble whose hoeing has waited 3 hours. A helper takes the job on the `helper` basis (sim/eligibility), hoes it, and the tie and the
// opinion between the helper and the adults helped rise ("Worked together", both ways); the helper's life names the farm; nothing moves
// between the two stores. A job waited less than 2 hours, a cook, or a household of another village is not offered.
const assert = require('assert');
const VB = require('../src/load.js'), Sim = VB.sim, { tinyWorld, tinyState } = require('./lib/tiny.js');
const { eligible } = VB['sim/eligibility'], Jobs = VB['sim/jobs'], { tieOf, opinionOf } = VB['sim/relations'];
const { age } = VB['sim/records'], { MATCH } = VB['sim/rules'];
const st = tinyState(tinyWorld(Array(20).fill('.'.repeat(36))),
  [{ at: [8, 10], farms: 2, sizes: [7, 4] }, { at: [28, 10], farms: 1, sizes: [4] }], { seed: 4 });
Sim.advance(st, 3); // 9:00 on the first day of spring
const [A, B] = [st.households[0], st.households[1]], fB = st.farmsteads[B.farmstead];
assert.strictEqual(st.farmsteads[A.farmstead].village, fB.village, 'the two households share a village');
const other = st.households.find((h) => st.farmsteads[h.farmstead].village !== fB.village);
const adults = (hh) => hh.members.filter((id) => st.pawns[id].alive && age(st, st.pawns[id]) >= MATCH.help.minAge);
const helpers = adults(A).slice(0, 3);
assert(helpers.length === 3, `household A has ${helpers.length} adults, wanted 3`);
// Nothing of their own to do: A's and the village's jobs are taken down.
const dropAll = (key) => { for (const j of [...(st.jobsBy.get(key) || [])]) { st.jobs.delete(j.key); st.jobsBy.get(key).delete(j); } };
dropAll(`household:${A.id}`); dropAll(`village:${fB.village}`); dropAll(`household:${B.id}`);
const fd = fB.fields[0];
fd.stage = 'stubble';
const key = `plow:f${fB.id}.${fd.id}`, j = Jobs.post(st, key, 'plow', { type: 'household', id: B.id }, fd.tile, { field: fd, farm: fB });
const pawn = st.pawns[helpers[0]];
j.posted = st.t - 1;
assert.strictEqual(eligible(st, j, pawn), null, 'a job waited 1 hour is not offered to a helper');
j.posted = st.t - 3;
assert.strictEqual(eligible(st, j, pawn), 'helper', 'a job waited 3 hours is offered to an adult of the village');
assert.strictEqual(eligible(st, { ...j, kind: 'cook' }, pawn), null, 'cooking is not help');
assert.strictEqual(eligible(st, j, st.pawns[adults(other)[0]]), null, 'a household of another village does not help');
const holder = B.holder, before = helpers.map((h) => [tieOf(st, h, holder), opinionOf(st, h, holder), opinionOf(st, holder, h)]);
const grainA = Sim.grainOf(A), grainB = Sim.grainOf(B);
// One round of matching, at 9:00 on a working day, the helpers idle; B's own adults are left out of it.
const c = Sim.cal(st.t), idle = helpers.map((id) => st.agents[id]);
Jobs.planRound(st, idle, c);
const working = helpers.filter((id) => st.agents[id].job === j);
assert(working.length > 0, 'no helper took the waiting hoeing');
assert(working.every((id) => st.agents[id].basis === 'helper'), 'the hoeing is taken on the helper basis');
// Work it to its end, the helpers' own jobs still taken down so nothing calls them home.
const t0 = st.t;
while (fd.stage === 'stubble' && st.t < t0 + 2 * Sim.DAY) {
  Sim.advance(st, 0.1);
  dropAll(`household:${A.id}`);
}
assert.notStrictEqual(fd.stage, 'stubble', 'the helped field was not hoed');
const after = helpers.map((h) => [tieOf(st, h, holder), opinionOf(st, h, holder), opinionOf(st, holder, h)]);
const helped = working.filter((h) => st.pawns[h].events.some((i) => st.record[i].kind === 'helped'));
assert(helped.length > 0, 'no helper has a life event of the help');
for (const h of helped) {
  const k = helpers.indexOf(h);
  assert(after[k][0] > before[k][0] + MATCH.help.tie * 0.9, `the tie of helper ${h} to the holder rose ${before[k][0]} -> ${after[k][0]}`);
  assert(after[k][1] > before[k][1], `the helper's opinion of the holder did not rise (${before[k][1]} -> ${after[k][1]})`);
  assert(after[k][2] > before[k][2], `the holder's opinion of the helper did not rise (${before[k][2]} -> ${after[k][2]})`);
  const r = st.pawns[holder].rel.get(h);
  assert(r && r.mem.worked, 'the holder remembers working together');
  const e = st.record[st.pawns[h].events.find((i) => st.record[i].kind === 'helped')];
  assert(e.farm === fB.id && e.text.includes(fB.name), `the life event names the farm: ${e.text}`);
}
assert(!Sim.villageLog(st, 1000).some((r) => r.ev.kind === 'helped'), 'help writes no line of the village log');
// Help is a gift: nothing moved between the two stores but what the households ate.
assert(Sim.grainOf(A) <= grainA && Sim.grainOf(B) <= grainB, 'grain moved with the help');
console.log(`helpers ok: ${working.length} helpers hoed ${fB.name}'s field in ${(st.t - t0).toFixed(1)} h; tie ${before[helpers.indexOf(helped[0])][0].toFixed(2)} -> ${after[helpers.indexOf(helped[0])][0].toFixed(2)}`);
