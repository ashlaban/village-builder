// VB-1616: the agenda, the played pawn's queue and open work against their deadlines, a view the page reads. On a small constructed state:
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
const hh = st.households.find((h) => !h.dissolved && h.farmstead !== null && VB['sim/projects'].ownOf(st, h.id)),
  id = hh.members.find((m) => Sim.age(st, st.pawns[m]) >= 16);
// the view, checked to change nothing in st; a village's memo of whether it fishes (sim/drying villageFishes), which the asking of the
// kinds fills when first read (Sim.opportunities as well), is filled first
function view() {
  Sim.opportunities(st, id);
  const before = structuredClone(st),
    r = Sim.agenda(st);
  assert(isDeepStrictEqual(before, st), 'the agenda wrote to st');
  return r;
}
assert.strictEqual(view(), null, 'no agenda with no played pawn');
const work = Sim.opportunities(st, id).filter((o) => o.verb === 'work' && st.jobs.has(o.target) && st.agents[id].job !== st.jobs.get(o.target));
const hoes = work.filter((o) => o.kind === 'plow');
assert(hoes.length >= 2, `two fields to hoe, not ${hoes.length}`);
Sim.inhabit(st, id);
for (const o of hoes.slice(0, 2)) assert.strictEqual(Sim.queue(st, { actor: id, verb: 'work', target: o.target }), true);
assert.strictEqual(Sim.queue(st, { actor: id, verb: 'goHome' }), true);

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
assert.strictEqual(Sim.unqueue(st, 1), true); // the second hoeing taken off the queue is open work again
const other = view().open.find((e) => e.key === b.key);
assert(other && other.deadline && other.deadline.t === a.deadline.t && other.verdict === 'in time', 'an open hoeing and its window');
assert.deepStrictEqual(other.hours, b.hours, 'begun now, its hours as queued');
assert.strictEqual(Sim.queue(st, { actor: id, verb: 'work', target: b.key }), true);
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
const keep = { t: st.t, queue: st.player.queue, had: st.jobs.get(key) };
const sow = keep.had || { key, kind: 'sow', site: fd.tile, field: fd, farm: f, owner: { type: 'household', id: hh.id }, claims: [], done: 0 };
st.jobs.set(key, sow);
st.player.queue = [];
Sim.queue(st, { actor: id, verb: 'work', target: key });
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
st.player.queue = keep.queue;
if (keep.had) st.jobs.set(key, keep.had); else st.jobs.delete(key);

// no simulation module names the view: only the Sim facade reads it
const r = build();
const readers = r.deps.filter((d) => d.imports.includes('sim/agenda') || d.lookups.some((l) => l.key === 'sim/agenda')).map((d) => d.mod);
assert.deepStrictEqual(readers, ['sim'], `only sim reads sim/agenda, not ${readers.join(', ')}`);
console.log(`agenda ok: ${ag.queue.length} queued, ${ag.open.length} open, a project step leads to ${kinds.join(', ')}`);
