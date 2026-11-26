// VB-1644: the agenda, the played pawn's queue and open work against their deadlines, a view the page reads. On a small constructed state:
// two queued jobs lie end to end at the pawn's own estimate; a sowing that cannot end within its window is late; open work not queued is
// listed with its deadline; a field project's step carries the steps after it to the sowing; the view writes nothing and no simulation
// module names it.
const assert = require('assert'), { isDeepStrictEqual } = require('util');
const VB = require('../src/load.js'), Sim = VB.sim;
const { state } = require('./lib/probe.js');
const { DAY, WORK } = VB['sim/rules'];
const { estimate } = VB['sim/estimate'];
const { after } = VB['sim/agenda'];
const { build } = require('../tools/writes.js');

// working hours laid end to end: the closed form against the hour-by-hour walk
for (const [t, h] of [[32, 5], [32, 10], [32, 11], [40, 30], [3, 2], [20, 12], [17.5, 2.3], [6, 0]]) {
  let at = t, left = h;
  while (left > 1e-9) {
    const hr = at % DAY;
    if (hr < WORK[0]) at += WORK[0] - hr;
    else if (hr >= WORK[1]) at += DAY - hr + WORK[0];
    else { const d = Math.min(left, WORK[1] - hr); at += d; left -= d; }
  }
  if (h === 0 && (at % DAY < WORK[0] || at % DAY >= WORK[1])) at = Math.floor(at / DAY + (at % DAY >= WORK[1] ? 1 : 0)) * DAY + WORK[0];
  assert(Math.abs(after(t, h) - at) < 1e-9, `after(${t}, ${h}) = ${after(t, h)}, not ${at}`);
}

const st = state();
Sim.advance(st, DAY + (WORK[0] + 2 - (st.t % DAY))); // the second spring morning: the barley's sowing window, the jobs posted
// a member of a household with a field project under way and fields to hoe
// (the first such household with two fields to hoe for its member: VB-312's new custom moved the seeded run)
const plows = (m) => Sim.opportunities(st, m).filter((o) => o.verb === 'work' && o.kind === 'plow' && st.jobs.has(o.target) && st.agents[m].job !== st.jobs.get(o.target));
let hh = null, id;
for (const h of st.households) {
  if (h.dissolved || h.farmstead === null || !VB['sim/projects'].ownOf(st, h.id)) continue;
  const m = h.members.find((k) => Sim.age(st, st.pawns[k]) >= 16);
  if (m !== undefined && plows(m).length >= 2) { hh = h; id = m; break; }
}
// the view, checked to change nothing in st; a village's memo of whether it fishes (sim/drying villageFishes), which the asking of the
// kinds fills when first read (Sim.opportunities as well), is filled first
function view(who = st.player ? st.player.pawn : -1) {
  Sim.opportunities(st, id);
  const before = structuredClone(st),
    r = Sim.agenda(st, who);
  assert(isDeepStrictEqual(before, st), 'the agenda wrote to st');
  return r;
}
assert.strictEqual(view(), null, 'no agenda with no played pawn');
const work = Sim.opportunities(st, id).filter((o) => o.verb === 'work' && st.jobs.has(o.target) && st.agents[id].job !== st.jobs.get(o.target));
const hoes = work.filter((o) => o.kind === 'plow');
assert(hoes.length >= 2, `two fields to hoe, not ${hoes.length}`);
Sim.inhabit(st, id);
for (const o of hoes.slice(0, 2)) assert.strictEqual(Sim.queue(st, st.player.pawn, { actor: id, verb: 'work', target: o.target }), true);
assert.strictEqual(Sim.queue(st, st.player.pawn, { actor: id, verb: 'goHome' }), true);

const ag = view(), [a, b, home] = ag.queue;
// two queued jobs end to end, each at the pawn's own estimate with its own hands
for (const e of [a, b]) {
  const est = estimate(st, id, st.jobs.get(e.key), [id]);
  assert.deepStrictEqual(e.hours, { lo: est.lo, mid: est.mid, hi: est.hi }, `${e.key}: the pawn's own estimate`);
  assert.strictEqual(e.verb, 'work');
  assert(e.site >= 0 && e.walk >= 0);
}
assert.strictEqual(a.starts, st.t, 'the first begins now');
assert.strictEqual(a.ends, after(a.starts, a.walk + a.hours.mid));
assert.strictEqual(b.starts, a.ends, 'the second begins where the first ends');
assert.strictEqual(home.starts, b.ends);
assert(home.hours === null && home.ends === after(home.starts, home.walk), 'going home by its walk alone');
assert(a.deadline && /barley sowing/.test(a.deadline.what) && a.verdict === 'in time', `${a.verdict}: ${JSON.stringify(a.deadline)}`);
assert.strictEqual(ag.day.left, WORK[1] - (st.t % DAY));
assert(Math.abs(ag.day.queued - (a.hours.mid + a.walk + b.hours.mid + b.walk + home.walk)) < 1e-9, 'the hours queued');

// open work not queued, with its deadline: the other fields to hoe, by the barley's window; and its cause
const queued = new Set([a.key, b.key]);
assert(ag.open.every((e) => !queued.has(e.key)), 'nothing queued is open');
assert.strictEqual(Sim.unqueue(st, st.player.pawn, 1), true); // the second hoeing taken off the queue is open work again
const other = view().open.find((e) => e.key === b.key);
assert(other && other.deadline && other.deadline.t === a.deadline.t && other.verdict === 'in time', 'an open hoeing and its window');
assert.deepStrictEqual(other.hours, b.hours, 'begun now, its hours as queued');
assert.strictEqual(Sim.queue(st, st.player.pawn, { actor: id, verb: 'work', target: b.key }), true);
assert(ag.open.every((e) => 'why' in e && 'barred' in e && e.starts === st.t));

// a field project's step: the steps after it to the sowing, the later ones at the crop's hours (rough), and the verdict of the chain
const step = ag.open.find((e) => e.kind === 'clear' || e.kind === 'break' || e.kind === 'fell' || e.kind === 'grub');
assert(step && step.then, 'a field project step carries then');
const T = step.then, kinds = T.steps.map((s) => s.kind);
assert.deepStrictEqual(kinds.slice(-2), ['plow', 'sow'], `the chain ends in hoeing and sowing: ${kinds}`);
assert(T.steps.slice(-2).every((s) => s.rough) && T.steps.slice(0, -2).every((s) => !s.rough));
assert(T.deadline && T.verdict === 'in time' && T.ends > step.ends && T.ends <= T.deadline.t, JSON.stringify(T));

// a sowing that cannot end within its window: the field's sowing queued an hour before the end of its window's last day
const f = st.farmsteads[hh.farmstead], fd = f.fields[0], key = `sow:f${f.id}.${fd.id}`;
const keep = { t: st.t, queue: Sim.controlOf(st, st.player.pawn).queue, had: st.jobs.get(key) };
const sow = keep.had || { key, kind: 'sow', site: fd.tile, field: fd, farm: f, owner: { type: 'household', id: hh.id }, claims: [], done: 0 };
st.jobs.set(key, sow);
Sim.controlOf(st, st.player.pawn).queue = [];
Sim.queue(st, st.player.pawn, { actor: id, verb: 'work', target: key });
st.t = a.deadline.t - 1;
const late = view().queue[0];
assert(late.deadline.t === a.deadline.t && late.ends > late.deadline.t && late.verdict === 'late', JSON.stringify(late));
// a tight one: its middle within the hour left, the top of its range past it
const per = late.hours.mid / (sow.hours ?? VB['sim/kinds'].KINDS.sow.hours), was = sow.hours;
sow.hours = (0.95 * (1 - late.walk)) / per;
const tight = view().queue[0];
assert(tight.ends <= tight.deadline.t && tight.verdict === 'tight', JSON.stringify(tight));
if (was === undefined) delete sow.hours; else sow.hours = was;
Object.assign(st, { t: keep.t });
Sim.controlOf(st, st.player.pawn).queue = keep.queue;
if (keep.had) st.jobs.set(key, keep.had); else st.jobs.delete(key);

// no simulation module names the view: only the Sim facade reads it
const r = build();
const readers = r.deps.filter((d) => d.imports.includes('sim/agenda') || d.lookups.some((l) => l.key === 'sim/agenda')).map((d) => d.mod);
assert.deepStrictEqual(readers, ['sim'], `only sim reads sim/agenda, not ${readers.join(', ')}`);

// VB-1647: the plan laid into days. On the tiny village of tests/plan.js with the played farmer alone (the others' hands would end its
// tasks sooner than its own estimate says, which the view does not reckon): a routine, sleeping hours and two tasks.
const { tinyWorld, tinyState } = require('./lib/tiny.js');
const { AWAKE } = VB['sim/sleep'];
const rows = Array.from({ length: 12 }, (_, i) => (i < 2 ? 'FFFFFFFFFFFFFFFF' : '................'));
const alone = () => {
  const s = tinyState(tinyWorld(rows), [{ at: [8, 7], farms: 3 }], { seed: 4 });
  s.naturalDeaths = false;
  Sim.advance(s, 3);
  for (const p of s.pawns) if (p.id !== 0 && p.alive) VB['sim/lifecycle'].killPawn(s, p.id);
  Sim.advance(s, 0.1);
  Sim.inhabit(s, 0);
  Sim.setAuto(s, s.player.pawn, false);
  s.jobs.get('clear:f0').hours = 8;
  return s;
};
const laid = (s) => {
  const before = structuredClone(s), r = Sim.agenda(s, s.player.pawn);
  assert(isDeepStrictEqual(before, s), 'the agenda wrote to st');
  return r;
};
const segAt = (r, t) => r.days.flat().find((g) => t >= g.from && t < g.to);
const P = alone();
assert.strictEqual(Sim.plan(P, P.player.pawn, 'routine', { kinds: ['water', 'wood'] }), true);
assert.strictEqual(Sim.plan(P, P.player.pawn, 'sleep', { from: 22, until: 6 }), true);
for (const key of ['clear:f0', 'plow:f0.1']) assert.strictEqual(Sim.plan(P, P.player.pawn, 'add', { key }), true);
const L = laid(P), d0 = Math.floor(P.t / DAY);
// three days, each its segments in order and end to end, from now to the third midnight
assert.strictEqual(L.days.length, 3);
L.days.forEach((list, d) => {
  assert.strictEqual(list[0].from, d ? (d0 + d) * DAY : P.t, `day ${d} begins at its start`);
  assert(Math.abs(list[list.length - 1].to - (d0 + d + 1) * DAY) < 1e-9, `day ${d} ends at midnight`);
  list.forEach((g, i) => {
    assert(g.to > g.from && ['sleep', 'routine', 'task', 'queue', 'free'].includes(g.what), JSON.stringify(g));
    assert(['from', 'to', 'what', 'kind', 'key', 'site'].every((k) => k in g), JSON.stringify(g));
    if (i) assert(Math.abs(list[i - 1].to - g.from) < 1e-9, `day ${d}: end to end`);
  });
});
// the sleeping hours slept, the routine once a day in order, then the tasks in order
for (let d = 1; d < 3; d++) {
  const list = L.days[d];
  assert.deepStrictEqual([list[0].what, list[0].to - list[0].from], ['sleep', 6], `day ${d}: asleep until 6`);
  assert.deepStrictEqual(list.filter((g) => g.what === 'routine').map((g) => g.kind), ['water', 'wood'], `day ${d}: the routine`);
  assert.strictEqual(list[list.length - 1].what, 'sleep');
}
const tasks = L.days.flat().filter((g) => g.what === 'task').map((g) => g.key);
assert.deepStrictEqual([...new Set(tasks)], ['clear:f0', 'plow:f0.1'], 'the tasks in order');
// each task where the layout puts it: the first begins after the day's routine, broken off at 22 and taken up the next day
const [T1, T2] = L.plan;
assert(T1.starts > P.t && T1.ends > (d0 + 1) * DAY && T2.starts === T1.ends && T2.ends > T2.starts, JSON.stringify(L.plan));
assert(T1.hours.mid > 0 && T2.deadline && T2.verdict === 'in time', JSON.stringify(T2));
const work1 = L.days.flat().filter((g) => g.key === 'clear:f0');
assert(work1.length >= 2 && Math.abs(work1[0].to % DAY - 22) < 1e-9, 'the clearing broken off at bedtime');
// the routine's hours a day, each kind from home; the hours owed at each day's end, by VB-1643's rule
assert.deepStrictEqual(L.routine.map((r) => r.kind), ['water', 'wood']);
assert(L.routine.every((r) => r.hours > 0) && L.routine[1].hours > L.routine[0].hours, JSON.stringify(L.routine));
assert.strictEqual(L.owed.length, 3);
const awake0 = L.days[0].filter((g) => g.what !== 'sleep').reduce((n, g) => n + g.to - g.from, 0),
  slept0 = L.days[0].filter((g) => g.what === 'sleep').reduce((n, g) => n + g.to - g.from, 0);
assert(Math.abs(L.owed[0] - Math.max(0, P.pawns[P.player.pawn].sleep.owed + awake0 * AWAKE - slept0)) < 1e-6, `owed on day 0: ${L.owed}`);

// with no sleeping hours the work is laid through the night, and the hours owed mount
const N = alone();
Sim.plan(N, N.player.pawn, 'add', { key: 'clear:f0' });
N.jobs.get('clear:f0').hours = 40;
const LN = laid(N);
assert(LN.days[1].length === 1 && LN.days[1][0].what === 'task', 'a night worked: the next day a task from midnight to midnight');
assert(LN.owed[1] > LN.owed[0] && LN.owed[1] > 12, `the hours owed mount: ${LN.owed}`);
// a command queued by hand goes first; with automatic behaviour on, the plan is not followed
assert.strictEqual(Sim.queue(N, N.player.pawn, { actor: 0, verb: 'walkTo', target: N.villages[0].center }), true);
assert.strictEqual(laid(N).days[0][0].what, 'queue');
Sim.setAuto(N, N.player.pawn, true);
assert(laid(N).days.flat().every((g) => g.what === 'queue' || g.what === 'free'), 'not followed: queue and free');

// VB-1649: a plant task laid step by step: on the project's tile its clearing (posted), then its breaking, hoeing and sowing (not posted:
// rough, at the step's and the crop's hours), the hoeing and the sowing not before the window opens; its entry the hours of all steps
// left, ending at the sowing's end, the barley window its deadline and the chain's verdict; on a broken field the hoeing and the sowing
const G = alone(), gsite = G.jobs.get('clear:f0').site, gfield = G.farmsteads[0].fields[0];
assert.strictEqual(Sim.plan(G, G.player.pawn, 'add', { plant: gsite }), true);
assert.strictEqual(Sim.plan(G, G.player.pawn, 'add', { plant: gfield.tile }), true);
const LG = laid(G), [PA, PB] = LG.plan, CB = VB['sim/crops'].CROPS.barley.sow;
assert.deepStrictEqual(PA.steps.map((x) => [x.kind, x.rough]), [['clear', false], ['break', true], ['plow', true], ['sow', true]]);
assert.deepStrictEqual([PA.kind, PA.plant, PA.step, PA.stands, PA.rough, PA.key], ['plant', gsite, 'clear', true, true, 'clear:f0']);
assert(Math.abs(PA.hours.mid - PA.steps.reduce((n, x) => n + x.hours.mid, 0)) < 1e-9, 'the hours of all steps left');
assert.strictEqual(PA.deadline.t, (CB[0] * VB['sim/rules'].SEASON_DAYS + CB[2]) * DAY + WORK[1], 'the barley window its deadline');
assert(/barley sowing/.test(PA.deadline.what) && PA.verdict === 'in time' && PA.starts === G.t && PA.ends > PA.starts + PA.hours.mid, JSON.stringify(PA));
assert.deepStrictEqual(PB.steps.map((x) => [x.kind, x.rough]), [['plow', false], ['sow', true]], 'a broken field: its hoeing and sowing');
assert(Math.abs(PB.starts - PA.ends) < 1e-9 && PB.ends > PB.starts && PB.deadline.t === PA.deadline.t, JSON.stringify(PB));
const gseq = LG.days.flat().filter((g) => g.what === 'task').map((g) => `${g.site}:${g.kind}`);
assert.deepStrictEqual([...new Set(gseq)], [`${gsite}:clear`, `${gsite}:break`, `${gsite}:plow`, `${gsite}:sow`, `${gfield.tile}:plow`, `${gfield.tile}:sow`].slice(0, new Set(gseq).size), `step by step: ${[...new Set(gseq)]}`);
assert(LG.days.flat().some((g) => g.kind === 'break' && g.key === null), 'a step not posted is laid with no key');
// a plain task by key that is a step of the project is as it was: its own job, and `then` to the sowing
const H = alone();
Sim.plan(H, H.player.pawn, 'add', { key: 'clear:f0' });
const PH = laid(H).plan[0];
assert(PH.key === 'clear:f0' && PH.kind === 'clear' && !('steps' in PH) && PH.then && PH.then.steps.map((x) => x.kind).join() === 'break,plow,sow', JSON.stringify(PH));

// VB-1650: a hay task and a harvest task laid as the plant task is: in spring, the hay's mowing and carrying not posted (rough), laid
// no earlier than the haymaking opens, its deadline the haymaking's end; a field near ripe (a constructed state) its reaping from the
// day it is expected ripe and its carrying after, its deadline the frost the head expects. Sim.planGaps lists the harvest that presses
// with no task, and not once planned; it writes nothing.
{
  const K = tinyState(tinyWorld(rows), [{ at: [8, 7], farms: 3 }], { seed: 4, herds: true });
  K.naturalDeaths = false;
  Sim.advance(K, 3);
  for (const p of K.pawns) if (p.id !== 0 && p.alive) VB['sim/lifecycle'].killPawn(K, p.id);
  Sim.advance(K, 0.1);
  Sim.inhabit(K, 0);
  Sim.setAuto(K, K.player.pawn, false);
  const { SEASON_DAYS } = VB['sim/rules'], { MOW_LAST } = VB['sim/meadows'], m = K.farmsteads[0].meadows[0], fd = K.farmsteads[0].fields[1];
  const today = Math.floor(K.t / DAY);
  fd.stage = 'growing';
  fd.sown = today - VB['sim/crops'].CROPS[fd.crop].ripe + 2; // ripe in two days
  const gaps = () => {
    const before = structuredClone(K), r = Sim.planGaps(K, K.player.pawn);
    assert(isDeepStrictEqual(before, K), 'planGaps wrote to st');
    return r;
  };
  const g = gaps().find((x) => x.tile === fd.tile);
  assert(g && g.chain === 'harvest' && g.deadline.what === 'the frost' && g.days > 2, JSON.stringify(g));
  assert.strictEqual(Sim.plan(K, K.player.pawn, 'add', { hay: m.tile }), true);
  assert.strictEqual(Sim.plan(K, K.player.pawn, 'add', { harvest: fd.tile }), true);
  assert(!gaps().some((x) => x.tile === fd.tile), 'gone once planned');
  const LK = laid(K), [HA, HR] = LK.plan, open = (SEASON_DAYS * DAY) + WORK[0];
  assert.deepStrictEqual(HA.steps.map((x) => [x.kind, x.rough]), [['mow', true], ['hay', true]], JSON.stringify(HA.steps));
  assert.deepStrictEqual([HA.kind, HA.hay, HA.step, HA.stands, HA.rough], ['hay', m.tile, 'mow', false, true]);
  assert(HA.deadline.t === (2 * SEASON_DAYS + MOW_LAST) * DAY + WORK[1] && HA.deadline.what === 'the end of haymaking', JSON.stringify(HA.deadline));
  assert(HA.starts >= open && HA.ends > HA.starts && HA.verdict === 'in time', JSON.stringify(HA));
  assert(Math.abs(HA.hours.mid - HA.steps.reduce((n, x) => n + x.hours.mid, 0)) < 1e-9, 'the hours of all steps left');
  assert.deepStrictEqual(HR.steps.map((x) => [x.kind, x.rough]), [['reap', true], ['haul', true]]);
  assert(HR.step === 'reap' && !HR.stands && HR.deadline.what === 'the frost' && HR.deadline.t === g.deadline.t, JSON.stringify(HR));
  assert(HR.starts >= (fd.sown + VB['sim/crops'].CROPS[fd.crop].ripe) * DAY + WORK[0] && HR.ends > HR.starts && HR.verdict, JSON.stringify(HR));
  const seq = LK.days.flat().filter((x) => x.what === 'task').map((x) => x.kind);
  assert(seq.length && seq.every((k) => k === 'reap' || k === 'haul') && seq[0] === 'reap', `the reaping laid first in the three days, the mowing not before summer: ${seq}`);
}

// VB-1746: an unplayed pawn's agenda, gaps and build menu, through the keyed calls, as the played pawn's: twin states, the farmer played
// in one and not in the other (no st.player there), the same plan; then a command queued for it by hand goes first in both.
{
  const twin = (play) => {
    const s = tinyState(tinyWorld(rows), [{ at: [8, 7], farms: 3 }], { seed: 4 });
    s.naturalDeaths = false;
    Sim.advance(s, 3);
    for (const p of s.pawns) if (p.id !== 0 && p.alive) VB['sim/lifecycle'].killPawn(s, p.id);
    Sim.advance(s, 0.1);
    if (play) Sim.inhabit(s, 0);
    assert.strictEqual(Sim.setAuto(s, 0, false), true);
    assert.strictEqual(Sim.plan(s, 0, 'routine', { kinds: ['water', 'wood'] }), true);
    assert.strictEqual(Sim.plan(s, 0, 'sleep', { from: 22, until: 6 }), true);
    for (const key of ['clear:f0', 'plow:f0.1']) assert.strictEqual(Sim.plan(s, 0, 'add', { key }), true);
    return s;
  };
  const U = twin(false), Y = twin(true), keyed = (s) => {
    const before = structuredClone(s), r = { agenda: Sim.agenda(s, 0), gaps: Sim.planGaps(s, 0), menu: Sim.buildMenu(s, 0) };
    assert(isDeepStrictEqual(before, s), 'the keyed views wrote to st');
    return r;
  };
  assert(!U.player && VB['sim/steps'].pawnPlan(U, 0).tasks.length === 2, 'the unplayed pawn holds its plan, with no player');
  const u = keyed(U), y = keyed(Y);
  assert(u.agenda && u.agenda.days.length === 3 && u.agenda.plan.length === 2, 'its plan laid into days');
  assert.deepStrictEqual(u, y, "the same agenda, gaps and menu as the played pawn's");
  for (const s of [U, Y]) assert.strictEqual(Sim.queue(s, 0, { actor: 0, verb: 'walkTo', target: s.villages[0].center }), true);
  assert.strictEqual(Sim.agenda(U, 0).days[0][0].what, 'queue', 'its hand command first');
  assert.deepStrictEqual(Sim.agenda(U, 0), Sim.agenda(Y, 0), "and the same as the played pawn's");
}

// the layout and the feeder agree: what the pawn did, hour by hour over the three days (sampled each tenth), against what `days` said
// at the start: the same act (sleep, routine of a kind, a task by its key, free), but within the estimate's error of a join
const TOL = 3, joins = L.days.flat().slice(1).map((g) => g.from);
let n = 0, same = 0, worst = 0;
while (P.t < (d0 + 3) * DAY - 0.05) {
  Sim.advance(P, 0.1);
  const q = Sim.controlOf(P, P.player.pawn).queue[0], mark = q && q.plan,
    did = mark ? `${mark.from}:${mark.from === 'task' ? mark.key : (mark.kind ?? '')}` : q ? 'queue:' : 'free:',
    g = segAt(L, P.t - 0.05),
    said = `${g.what}:${g.what === 'task' ? g.key : (g.kind ?? '')}`;
  n++;
  if (did === said) { same++; continue; }
  const off = Math.min(...joins.map((j) => Math.abs(j - P.t)));
  worst = Math.max(worst, off);
  assert(off <= TOL, `at ${P.t.toFixed(1)} the pawn was on ${did}, the agenda said ${said}, ${off.toFixed(1)} h from a join`);
}
assert(same / n > 0.85, `the layout and the feeder agree on ${((100 * same) / n).toFixed(0)}% of the hours`);
console.log(`agenda ok: ${ag.queue.length} queued, ${ag.open.length} open, a project step leads to ${kinds.join(', ')}; `
  + `the plan laid into days agrees with the feeder on ${((100 * same) / n).toFixed(0)}% of the hours, ${worst.toFixed(1)} h at most from a join`);
