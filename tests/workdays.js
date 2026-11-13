// VB-120: village work days. A village with a fence may choose work days at its meeting (never its founders: the meeting sets them for
// the coming year); chosen, on spring's first day from 6:00 its fence stretches below 0.9 are village jobs with unlimited hands, all
// together, at priority 8 for every adult whatever the role, and on summer's second a clearing at the commons wood's edge. At the day's end
// each adult who worked 2 hours gains 0.05 prestige for the year; a household with no adult at it loses 0.1 of its holder's, and each other
// holder of the village tied to that holder remembers "Stayed away from the work day". The village log notes the day and who stayed away.
const assert = require('assert');
const VB = require('../src/load.js'), Sim = VB.sim;
const { tinyWorld, tinyState } = require('./lib/tiny.js');
const { checkState } = require('./lib/invariants.js');
const Plans = VB['sim/plans'], W = VB['sim/workdays'], { tieOf, age, fullName } = VB['sim/records'], { addTie } = VB['sim/relations'];
const { setClock } = require('./lib/clock.js');
const { ROLES, WORKDAY, DAY, WORK, YEAR_DAYS, SEASON_DAYS, SOCIAL, cal } = VB['sim/rules'];
const rows = Array.from({ length: 12 }, (_, i) => (i < 2 ? 'FFFFFFFFFFFFFFFF' : '................'));
const st = tinyState(tinyWorld(rows), [{ at: [8, 7], farms: 4, sizes: [6, 6, 6, 6] }], { seed: 4 });
const v = st.villages[0], plan = Plans.planOf(st, 'village', v.id);
const days = () => st.record.filter((e) => typeof e === 'object' && e.kind === 'workday' && e.village === v.id && e.t >= YEAR_DAYS * DAY);
const adultsOf = (hh) => hh.members.filter((m) => st.pawns[m].alive && age(st, st.pawns[m]) >= WORKDAY.minAge);

// every adult at 8 whatever the role, children not at all
for (const [r, R] of Object.entries(ROLES)) {
  assert.strictEqual(R.prio.workfence, r === 'child' ? 0 : WORKDAY.prio, `${r}: the work day's priority`);
  assert.strictEqual(R.prio.workclear, R.prio.workfence);
}
assert.ok(v.fence.length > 0 && v.wood.length > 0, 'the scene: a village with a fence and a wood');
assert.ok(!plan.routines.includes('workdays'), 'the founders call no work days');
assert.ok(Plans.chooseRoutines(st, v).includes('workdays'), 'a meeting may choose them');
// the meeting chose them; the first year's routines stand otherwise
Plans.setRoutines(st, v.id, ['fence', 'workdays'], 'meeting');

// to the eve of year 2's spring day 1 (the clock moved by hand: nothing of year 1 is run), the fence worn over the winter
const to = (t) => Sim.advance(st, t - st.t), Y2 = YEAR_DAYS * DAY;
setClock(st, Y2 - 2);
for (const s of v.fence) s.cond = 0.8;
const worn = v.fence.length;
// the scene for staying away: household 3's holder alone, played with the automatic behaviour off, so he takes no work
const lone = st.households[3];
for (const id of [...lone.members]) if (id !== lone.holder) Sim.killPawn(st, id, 'illness');
Sim.refreshRoles(st);
Sim.inhabit(st, lone.holder);
Sim.setAuto(st, false);
// the other holders: holder 0 is tied to the lone holder, holder 1 is not
const [h0, h1] = [st.households[0].holder, st.households[1].holder];
addTie(st, h0, lone.holder, 0.5);
st.pawns[h1].ties.delete(lone.holder);
assert.ok(tieOf(st, h0, lone.holder) > 0 && !(tieOf(st, h1, lone.holder) > 0), 'one holder tied to the lone one, one not');

to(Y2 + WORK[0] + 0.1); // 6:06 of the work day
const c = cal(st.t);
assert.ok(c.year === 2 && c.season === 0 && c.sday === 0 && W.dayOf(c) === 'fence');
const jobs = [...st.jobs.values()].filter((j) => j.kind === 'workfence');
assert.strictEqual(jobs.length, worn, 'each worn stretch a job of the village');
assert.ok(jobs.every((j) => j.owner.type === 'village' && j.owner.id === v.id));
const K = VB['sim/kinds'].KINDS;
assert.ok(jobs.every((j) => K[j.kind].hands === Infinity && K[j.kind].together), 'unlimited hands, all together');
to(Y2 + WORK[0] + 1);
assert.ok(jobs.some((j) => j.claims.length), 'the work is taken up');
// to the day's end
to(Y2 + WORK[1] + 0.1);
assert.ok(v.fence.every((s) => s.cond === 1), 'the fence closed');
assert.ok(![...st.jobs.values()].some((j) => W.isWorkdayJob(j)), "the day's jobs are taken down at its end");
const d = days();
assert.strictEqual(d.length, 1, 'the village log notes the day');
assert.ok(d[0].text.includes('fence') && d[0].text.includes(`the households of `) && d[0].text.includes(fullName(st.pawns[lone.holder])),
  'and names the households that stayed away');
const rec = v.workday, hrs = (id) => rec.hoursOf[id] || 0;
const adults = st.households.slice(0, 4).flatMap(adultsOf), total = adults.reduce((n, id) => n + hrs(id), 0);
const share = Math.min(WORKDAY.hours, total / adults.length);
assert.strictEqual(d[0].n, adults.filter((id) => hrs(id) > 0).length, 'the adults who turned out');
for (const id of adults) {
  const p = st.pawns[id], wd = p.workdays || { came: 0, missed: 0 };
  assert.strictEqual(wd.came, hrs(id) >= WORKDAY.hours ? 1 : 0, `pawn ${id}: two hours or more turned out`);
  const part = VB['sim/society'].prestigeParts(st, p).find((x) => x[0] === 'Turned out for the work days');
  assert.strictEqual(part ? part[1] : 0, wd.came * WORKDAY.came);
}
for (const hh of st.households.slice(0, 4)) {
  const away = !adultsOf(hh).some((id) => hrs(id) > 0 && hrs(id) >= share), wd = st.pawns[hh.holder].workdays || { missed: 0 };
  assert.strictEqual(wd.missed, away ? 1 : 0, `household ${hh.id}: away ${away}`);
  assert.strictEqual(d[0].text.includes(fullName(st.pawns[hh.holder])), away, `household ${hh.id} named as away: ${away}`);
}
const lp = st.pawns[lone.holder];
assert.deepStrictEqual(lp.workdays, { year: 2, came: 0, missed: 1 }, 'the lone household stayed away');
assert.ok(VB['sim/society'].prestigeParts(st, lp).some((x) => x[0] === 'Stayed away from the work day' && x[1] === WORKDAY.missed),
  'its holder loses standing for the year');
const mem = st.pawns[h0].rel.get(lone.holder);
assert.ok(mem && mem.mem.stayedAway && mem.mem.stayedAway.v === SOCIAL.memories.stayedAway.v, 'the tied holder remembers');
assert.ok(!(st.pawns[h1].rel.get(lone.holder) || { mem: {} }).mem.stayedAway, 'an untied holder does not');
assert.ok(!(tieOf(st, h1, lone.holder) > 0), 'and no tie is made for it');
assert.deepStrictEqual(checkState(st), [], 'invariants');
// the year after, the standing is gone
assert.ok(!VB['sim/society'].prestigeParts({ ...st, t: st.t + YEAR_DAYS * DAY }, lp).some((x) => x[0] === 'Stayed away from the work day'));

// summer's second day: the commons cleared at the wood's edge, the work WORKDAY.clearHours an adult of the village
const S2 = Y2 + (SEASON_DAYS + 1) * DAY;
to(S2 + WORK[0] + 0.1);
assert.strictEqual(W.dayOf(cal(st.t)), 'commons');
const clear = [...st.jobs.values()].find((j) => j.kind === 'workclear');
assert.ok(clear && v.wood.includes(clear.site) && clear.site === W.edgeOf(st, v), 'a clearing at the edge of the village wood');
assert.strictEqual(clear.hours, st.households.slice(0, 4).flatMap(adultsOf).length * WORKDAY.clearHours);
to(S2 + WORK[1] + 0.1);
assert.strictEqual(days().length, 2, 'the second day noted');
assert.ok(days()[1].text.includes('commons'));
assert.strictEqual(lp.workdays.missed, 2, 'away again');
assert.ok(st.pawns[h0].rel.get(lone.holder).mem.stayedAway.v >= SOCIAL.memories.stayedAway.cap - 1e-9, 'within the cap');
// a save keeps it
const back = Sim.load(st.w, JSON.parse(JSON.stringify(Sim.save(st))));
assert.deepStrictEqual(back.villages[v.id].workday, v.workday);
assert.deepStrictEqual(checkState(st), [], 'invariants');
console.log(`workdays ok: spring's day closed ${worn} stretches with ${d[0].n} of ${adults.length} adults; the lone ` +
  `household stayed away both days and its tied neighbour remembers (${st.pawns[h0].rel.get(lone.holder).mem.stayedAway.v.toFixed(2)})`);
