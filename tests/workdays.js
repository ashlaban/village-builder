// VB-120, VB-1768: village work days. A village with a fence may choose work days at its meeting (never its founders: the meeting sets them
// for the coming year); chosen, its alderman calls each at least OUTER.notice days ahead (callWorkday: the custom's day, spring's first for
// the fence and summer's second for the commons), its levy laid in lots on the village's households for that one date (terms `together`:
// a lot of n days is n adults that day). On it from 6:00 its fence stretches below 0.9 are village jobs with unlimited hands, all together,
// at priority 8 for every adult whatever the role. At the day's end each adult who worked 2 hours gains 0.05 standing for the year; a
// household levied with no adult at it, the work not done, breaches its lot (goodwill its head owes the alderman, told in the record), and
// each other holder of the village tied to that holder remembers "Stayed away from the work day"; the lots of the others are released.
const assert = require('assert');
const VB = require('../src/load.js'), Sim = VB.sim;
const { tinyWorld, tinyState } = require('./lib/tiny.js');
const { checkState } = require('./lib/invariants.js');
const { balance } = VB['sim/relations'], { OUTER } = VB['sim/days'], Steps = VB['sim/steps'];
const Plans = VB['sim/plans'], W = VB['sim/workdays'], { age, fullName } = VB['sim/records'], { tieOf, addTie } = VB['sim/ties'];
const { setClock } = require('./lib/clock.js');
const { DAY, WORK, YEAR_DAYS, SEASON_DAYS, cal } = VB['sim/rules'], { ROLES } = VB['sim/roles'], { SOCIAL } = VB['sim/ties'], { WORKDAY } = VB['sim/workdays'];
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
assert.ok(VB['sim/routines'].chooseRoutines(st, v).includes('workdays'), 'a meeting may choose them');
// the meeting chose them; the first year's routines stand otherwise
VB['sim/routines'].setRoutines(st, v.id, ['fence', 'workdays'], 'meeting');
// its alderman calls the day (VB-673): holder 0
VB['sim/membership'].setAlderman(st, v, st.households[0].holder);

// to five days before year 2's spring day 1 (the clock moved by hand: nothing of year 1 is run), the fence worn over the winter
const to = (t) => Sim.advance(st, t - st.t), Y2 = YEAR_DAYS * DAY, D2 = YEAR_DAYS;
setClock(st, Y2 - 5 * DAY);
for (const s of v.fence) s.cond = 0.8;
const worn = v.fence.length;
// the scene for staying away: household 3's holder alone, played with the automatic behaviour off, so he takes no work
const lone = st.households[3];
for (const id of [...lone.members]) if (id !== lone.holder) Sim.killPawn(st, id, 'illness');
Sim.refreshRoles(st);
Sim.inhabit(st, lone.holder);
Sim.setAuto(st, st.player.pawn, false);
// the other holders: holder 0 is tied to the lone holder, holder 1 is not
const [h0, h1] = [st.households[0].holder, st.households[1].holder];
addTie(st, h0, lone.holder, 0.5);
st.pawns[h1].ties.delete(lone.holder);
assert.ok(tieOf(st, h0, lone.holder) > 0 && !(tieOf(st, h1, lone.holder) > 0), 'one holder tied to the lone one, one not');
// the decision point: a work day to call, the alderman's, OUTER.notice days before the custom's day
const point = Sim.decisions(st, h0).find((x) => x.point === 'workday');
assert.ok(point && point.day === D2 && point.what === 'fence' && point.deadline === (D2 - OUTER.notice) * DAY, JSON.stringify(point));

// the call: made at the alderman's review, OUTER.notice days ahead, for the custom's day
to(Y2 - 2 * DAY);
const call = st.record.find((e) => typeof e === 'object' && e.kind === 'workday' && /called/.test(e.text));
assert.ok(call && call.pawn === h0 && Math.floor(call.t / DAY) <= D2 - OUTER.notice, 'called at least three days ahead');
assert.deepStrictEqual([v.workday.day, v.workday.of, v.workday.what], [D2, D2, 'fence']);
const C = VB['sim/commands'];
const refused = (args) => C.issue(st, { actor: h0, verb: 'callWorkday', target: v.id, args, source: 'debug' });
assert.ok(/at least 3 days ahead/.test(refused({ day: D2, of: D2 })), 'no call with less notice');
assert.ok(/is called/.test(refused({ day: D2 + 5, of: D2 })), 'once');
assert.ok(/no work day of the custom/.test(refused({ day: D2 + 9 })), 'a day the custom does not hold');
// its lots: the day's work over OUTER.hours, rounded up, split by fields, each a levy of the village on a household for that one date
const lots = st.obligations.filter((o) => o.source === 'routine');
assert.strictEqual(lots.reduce((n, o) => n + o.owes.days, 0), Math.ceil(W.workOf(st, v, 'fence') / OUTER.hours), "the day's work in adult-days");
const yearStep = VB['sim/routines'].stepOf(plan, 'workdays');
for (const o of lots) {
  assert.deepStrictEqual([o.kind, o.debtor.kind, o.creditor, o.enforcer, o.window, o.terms.names, o.terms.commute], ['days', 'household',
    { kind: 'village', id: v.id }, { kind: 'village', id: v.id }, [D2, D2], 'together', null], JSON.stringify(o));
  assert.ok(o.owes.days <= OUTER.lotMax);
  assert.strictEqual(o.named.length, o.owes.days, 'a lot of n days is n adults');
  assert.ok(o.named.every((e) => e.day === D2), 'on the one date');
  assert.deepStrictEqual(o.why, { step: yearStep.id, of: `village:${v.id}` }, "its why: the routine's step");
}
assert.ok(lots.some((o) => o.debtor.id === lone.id), 'the lone household holds a lot');
// the routine a step of the village's year, the meeting's decision its why: Sim.why reaches it
assert.deepStrictEqual([yearStep.author, yearStep.why], ['custom', { custom: 'meeting' }]);
assert.deepStrictEqual(Steps.find(st, plan, lots[0].why.step).why, { custom: 'meeting' });
const g0 = balance(st, h0, lone.holder);

to(Y2 + WORK[0] + 0.1); // 6:06 of the work day
const c = cal(st.t);
assert.ok(c.year === 2 && c.season === 0 && c.sday === 0 && W.dayOf(c) === 'fence');
const jobs = [...st.jobs.values()].filter((j) => j.kind === 'workfence');
assert.strictEqual(jobs.length, worn, 'each worn stretch a job of the village');
assert.ok(jobs.every((j) => j.owner.type === 'village' && j.owner.id === v.id));
const chain = Sim.why(st, jobs[0]);
assert.ok(chain.length && chain[chain.length - 1].why && chain[chain.length - 1].why.custom === 'meeting', JSON.stringify(chain));
const K = VB['sim/kinds'].KINDS;
assert.ok(jobs.every((j) => K[j.kind].hands === Infinity && K[j.kind].together), 'unlimited hands, all together');
to(Y2 + WORK[0] + 1);
assert.ok(jobs.some((j) => j.claims.length), 'the work is taken up');
// late in the day, a stretch is struck again so that the work is not done at its end: the lone household's stay-away breaches
to(Y2 + WORK[1] - 0.3);
v.fence[0].cond = 0.5; // lint-allow: owner a test's scene: the work left undone at the day's end
const breached0 = VB.count.dayBreached;
to(Y2 + WORK[1] + 0.1);
assert.ok(![...st.jobs.values()].some((j) => W.isWorkdayJob(j)), "the day's jobs are taken down at its end");
const held = () => days().filter((e) => /held/.test(e.text));
const d = held();
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
  const part = VB['sim/society'].standingParts(st, p).find((x) => x[0] === 'Turned out for the work days');
  assert.strictEqual(part ? part[1] : 0, wd.came * WORKDAY.came);
}
for (const hh of st.households.slice(0, 4)) {
  const o = lots.find((x) => x.debtor.id === hh.id);
  const away = !!o && !adultsOf(hh).some((id) => hrs(id) > 0 && hrs(id) >= share), wd = st.pawns[hh.holder].workdays || { missed: 0 };
  assert.strictEqual(wd.missed, away ? 1 : 0, `household ${hh.id}: away ${away}`);
  assert.strictEqual(d[0].text.includes(fullName(st.pawns[hh.holder])), away, `household ${hh.id} named as away: ${away}`);
  if (o) assert.ok(!VB['sim/obligations'].isLive(o), `household ${hh.id}'s lot settled: ${o.status}`);
}
const lp = st.pawns[lone.holder], mine = lots.find((o) => o.debtor.id === lone.id);
assert.deepStrictEqual(lp.workdays, { year: 2, came: 0, missed: 1 }, 'the lone household stayed away');
assert.strictEqual(VB.count.dayBreached - breached0, 1, 'its lot breached');
assert.ok(Math.abs(balance(st, h0, lone.holder) - g0 - OUTER.worth * mine.owes.days) < 1e-3, "the day's worth as goodwill its head owes the alderman");
const told = st.record.find((e) => typeof e === 'object' && e.kind === 'levyBreached' && e.pawn === lone.holder && e.t >= Y2);
assert.ok(told && /stayed away from the work day/.test(told.text), 'told in the record with its reason');
assert.ok(!VB['sim/society'].standingParts(st, lp).some((x) => /Stayed away/.test(x[0])), 'no standing lost: the breach in its place');
const mem = st.pawns[h0].rel.get(lone.holder);
const felt = VB['sim/traits'].act(st, h0, 'honour', 'breach'); // a breach felt by honour, 0.5 to 1.5 times (VB-520)
assert.ok(mem && mem.mem.stayedAway && Math.abs(mem.mem.stayedAway.v - SOCIAL.memories.stayedAway.v * felt) < 1e-9, 'the tied holder remembers');
assert.ok(!(st.pawns[h1].rel.get(lone.holder) || { mem: {} }).mem.stayedAway, 'an untied holder does not');
assert.ok(!(tieOf(st, h1, lone.holder) > 0), 'and no tie is made for it');
assert.deepStrictEqual(checkState(st), [], 'invariants');

// summer's second day: the commons cleared at the wood's edge, the work WORKDAY.clearHours an adult of the village; called ahead too
const S2 = Y2 + (SEASON_DAYS + 1) * DAY;
to(S2 + WORK[0] + 0.1);
assert.strictEqual(W.dayOf(cal(st.t)), 'commons');
assert.strictEqual(v.workday.of, D2 + SEASON_DAYS + 1);
const clear = [...st.jobs.values()].find((j) => j.kind === 'workclear');
assert.ok(clear && v.wood.includes(clear.site) && clear.site === W.edgeOf(st, v), 'a clearing at the edge of the village wood');
assert.strictEqual(clear.hours, st.households.slice(0, 4).flatMap(adultsOf).length * WORKDAY.clearHours);
to(S2 + WORK[1] + 0.1);
assert.strictEqual(held().length, 2, 'the second day noted');
assert.ok(held()[1].text.includes('commons'));
// a save keeps it
const back = Sim.load(st.w, JSON.parse(JSON.stringify(Sim.save(st))));
assert.deepStrictEqual(back.villages[v.id].workday, v.workday);
assert.deepStrictEqual(checkState(st), [], 'invariants');
console.log(`workdays ok: called ${D2 - Math.floor(call.t / DAY)} days ahead in ${lots.length} lots; spring's day worked by ${d[0].n} of ` +
  `${adults.length} adults; the lone household stayed away, breached its lot and its tied neighbour remembers`);
