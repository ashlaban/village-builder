// The head's day (VB-466; design.md section 7, The day's work): each morning, at its review and when its tasks change, a household's head
// allots its members' day: for each living member an ordered list of task keys, best fit first, a further hand on a task counting for
// less, without a random draw; a pawn takes the first task of its list it can; the day is saved with the plan. On a small constructed
// state: three farms on open ground, spring day 0, at 10:30.
const assert = require('assert');
const VB = require('../src/load.js'), Sim = VB.sim, Jobs = VB['sim/jobs'], { KINDS } = VB['sim/kinds'], { CHILD, WORK } = VB['sim/rules'];
const { age } = VB['sim/records'];
const { tinyWorld, tinyState } = require('./lib/tiny.js'), { canon, sha, kept } = require('./lib/canon.js'), { checkState } = require('./lib/invariants.js');
const rows = Array.from({ length: 12 }, (_, i) => (i < 2 ? 'FFFFFFFFFFFFFFFF' : '................'));
const make = (hours) => { const st = tinyState(tinyWorld(rows), [{ at: [8, 7], farms: 3 }], { seed: 4 }); st.makeFields = false; Sim.advance(st, hours); return st; };
const hash = (st) => sha(canon(kept(st)));
const dayOf = (st, id) => st.plans.households.get(id).day;
const kindOf = (st, key) => st.jobs.get(key) && st.jobs.get(key).kind;

// 1. Every household has its day by the morning: a list for each living member, empty for a child under 7; each key once.
const st = make(4.5), hh = st.households[0], c = Sim.cal(st.t);
for (const id of st.liveHouseholds) {
  const day = dayOf(st, id), h = st.households[id];
  assert.ok(day && Number.isInteger(day.made) && day.made >= WORK[0] - 1, `household ${id} has its day`);
  assert.deepStrictEqual(Object.keys(day.lists).map(Number).sort((a, b) => a - b), h.members.filter((m) => st.pawns[m].alive).sort((a, b) => a - b),
    `household ${id}: a list for each living member`);
  for (const m of h.members) {
    const list = day.lists[m];
    assert.strictEqual(new Set(list).size, list.length, `pawn ${m}: each task once`);
    if (age(st, st.pawns[m]) < CHILD.from) assert.strictEqual(list.length, 0, `pawn ${m}, under ${CHILD.from}: no tasks`);
  }
}

// 2. Allotting draws no random number and is the same twice.
{
  const rng = canon(st.rng);
  Jobs.allot(st, hh, c);
  const before = canon(dayOf(st, 0).lists);
  Jobs.allot(st, hh, c);
  assert.strictEqual(canon(st.rng), rng, 'no random draw');
  assert.strictEqual(canon(dayOf(st, 0).lists), before, 'the same day twice');
}

// 3. Best fit first, and the hands spread: the farmer's first task is a field's, the best fit of all is first in its member's list; the hoeing is
// given to more than one field; no one's list leaves out a task it may take (work beats idling).
{
  const lists = dayOf(st, 0).lists, role = (r) => hh.members.find((m) => st.pawns[m].role === r);
  const farmer = role('farmer');
  assert.strictEqual(kindOf(st, lists[farmer][0]), 'plow', 'the farmer hoes first');
  // the best fit of all, member and task, is that member's first task
  let best = null;
  for (const m of hh.members) for (const j of Jobs.jobsFor(st, st.pawns[m])) {
    if (age(st, st.pawns[m]) < CHILD.from || !VB['sim/eligibility'].eligible(st, j, st.pawns[m]) || j.done >= (j.hours ?? KINDS[j.kind].hours)) continue;
    const s = Jobs.score(st, st.pawns[m], j, c);
    if (s !== null && (!best || s > best[0])) best = [s, m, j.key];
  }
  assert.ok(best && lists[best[1]][0] === best[2], `the best fit comes first: pawn ${best && best[1]} on ${best && best[2]}`);
  const firstFields = new Set(hh.members.map((m) => lists[m][0]).filter((k) => kindOf(st, k) === 'plow'));
  assert.ok(firstFields.size >= 2, `the hands are spread over the fields to hoe (${[...firstFields]})`);
  const mine = [...st.jobs.values()].filter((j) => j.owner.type === 'household' && j.owner.id === 0);
  for (const j of mine) {
    const s = Jobs.score(st, st.pawns[farmer], j, c);
    if (s !== null && s > 0 && j.done < (j.hours ?? KINDS[j.kind].hours)) assert.ok(lists[farmer].includes(j.key), `the farmer's list holds ${j.key}`);
  }
}

// 4. A pawn takes the first task of its list that it can: an idle member, its first task full, takes the next.
{
  const s2 = make(4.5), a = s2.agents.find((x) => s2.pawns[x.id].household === 0 && x.job && x.phase === 'work');
  const list = dayOf(s2, 0).lists[a.id], had = a.job.key;
  VB['sim/agents'].release(s2, a);
  assert.strictEqual(a.job, null, 'its task let go');
  const got = Jobs.takeDay(s2, [a], Sim.cal(s2.t));
  assert.ok(got.has(a) && a.job && list.includes(a.job.key), `it takes a task of its list (${a.job && a.job.key}; it had ${had})`);
  const open = list.find((k) => s2.jobs.get(k) && (VB['sim/kinds'].isOpen(s2, s2.jobs.get(k)) || s2.jobs.get(k) === a.job));
  assert.strictEqual(a.job.key, open, 'the first that has room');
}

// 5. The day is saved: a loaded run goes on as the saved one, and the state keeps its invariants.
{
  const data = JSON.parse(JSON.stringify(Sim.save(st))), back = Sim.load(tinyWorld(rows), data);
  assert.strictEqual(canon(dayOf(back, 0)), canon(dayOf(st, 0)), 'the day comes back as saved');
  Sim.advance(st, Sim.DAY); Sim.advance(back, Sim.DAY);
  assert.strictEqual(hash(back), hash(st), 'the loaded run and the saved one agree a day later');
  assert.deepStrictEqual(checkState(st), [], 'invariants');
}
console.log('day ok: a day for every household, a list for each member; no random draw; best fit first and the hands spread; the first task with room is taken; saved and loaded');
