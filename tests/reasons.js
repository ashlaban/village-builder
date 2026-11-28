// @suite fast
// VB-1551: Reasons shown (design.md section 7): who chose a pawn's present act, and why, a view the card reads. Every `by` but `duty`
// (VB-1553's) on a small constructed state; the causes the view names (a deadline today, a window each day, a field window closing on the
// head's expected frost, a store under the head's target); it writes nothing, draws nothing, and no simulation module names it.
const assert = require('assert'), { isDeepStrictEqual } = require('util');
const VB = require('../src/load.js'), Sim = VB.sim;
const { state } = require('./lib/probe.js');
const { DAY, YEAR, SEASON_DAYS, WORK } = VB['sim/rules'];
const { frostExpected } = VB['sim/weather'];
const { build } = require('../tools/writes.js');

const st = state();
Sim.advance(st, DAY + (WORK[0] + 2 - (st.t % DAY))); // the second day's morning: the days are allotted
const hh = st.households.find((h) => !h.dissolved && h.farmstead !== null && h.members.length >= 3),
  plan = st.plans.households.get(hh.id),
  head = plan.head.pawn,
  [id, other] = hh.members.filter((m) => m !== head && st.pawns[m].died === null && Sim.age(st, st.pawns[m]) >= 16),
  a = st.agents[id];
assert(id !== undefined && plan.day, 'a member with a day');
const neighbour = st.households.find((h) => h !== hh && !h.dissolved && h.farmstead !== null);
// a task of kind k, as sim/jobs posts it: the view reads its key, kind, owner and field
const job = (kind, owner = { type: 'household', id: hh.id }, extra = {}) => ({ key: `${kind}:test:${owner.id}`, kind, owner, claims: [], ...extra });
// the view on pawn id, checked to change nothing in st
function view(pid = id) {
  const before = structuredClone(st),
    r = Sim.reasonOf(st, pid),
    line = Sim.reasonLine(st, pid);
  assert(isDeepStrictEqual(before, st), `the view on pawn ${pid} wrote to st (${r && r.by})`);
  assert(typeof line === 'string' && line.length > 0, `a line for pawn ${pid}`);
  return { ...r, line };
}
const keep = { job: a.job, mind: a.mind, path: a.path, occasion: a.occasion, lists: plan.day.lists, t: st.t };
const reset = () => {
  Object.assign(a, { job: null, mind: undefined, path: null, occasion: null });
  plan.day.lists = { ...keep.lists, [id]: [] };
  st.player = null;
  delete st.pawns[id].control; // its controller (VB-1745)
  st.daysToday = null;
  st.handsToday = null;
};
const seen = new Set();
function expect(by, setup, test = () => {}) {
  reset();
  setup();
  const r = view();
  assert.strictEqual(r.by, by, `expected ${by}, got ${r.by}: ${r.line}`);
  seen.add(by);
  test(r);
  return r;
}

// the head's day: the task's place in the member's list; with nothing pressing, who chose and the place are the line
const plough = job('break');
expect('day', () => {
  a.job = plough;
  plan.day.lists[id] = [job('wood').key, plough.key, job('water').key];
}, (r) => {
  assert.strictEqual(r.head, head);
  assert.deepStrictEqual(r.place, { at: 1, of: 3 });
  // the plan's step behind it: the season's routine, or (where the household is making a field, as the probe's is since VB-1951) its project
  const step = r.line.slice(`${Sim.fullName(st.pawns[head])}'s day, second of three: `.length);
  assert.ok(r.line.startsWith(`${Sim.fullName(st.pawns[head])}'s day, second of three: `) && ["in the season's plan", 'a step of the new field'].includes(step), r.line);
});
// a kind with a window: due every day
const water = job('water');
expect('day', () => { a.job = water; plan.day.lists[id] = [water.key]; }, (r) => assert.strictEqual(r.why, 'due every day', r.line));
// the head's call: a task with a deadline today first in the list (sim/jobs allot puts it there and calls its hand)
const cook = job('cook');
expect('call', () => { a.job = cook; plan.day.lists[id] = [cook.key, plough.key]; },
  (r) => assert(/before the day is out/.test(r.why) && r.head === head, r.line));
// a store under the head's target: the ale
const brew = job('brew');
expect('day', () => { a.job = brew; plan.day.lists[id] = [brew.key]; }, (r) => {
  const want = VB['sim/targets'].target(st, hh, 'ale');
  if (VB['sim/stores'].aleOf(st, hh) < want) assert(/of ale held, the head wants/.test(r.why), r.line);
});
// the woodpile under the head's goal for the season
const wood = job('wood');
expect('day', () => { a.job = wood; plan.day.lists[id] = [wood.key]; hh.wood = 0; },
  (r) => assert(/the woodpile holds 0 of the \d+ the head wants/.test(r.why), r.line));
// field work whose window is closing: the reaping, two days before the frost the head expects (never this year's drawn one)
const crop = Object.keys(VB['sim/crops'].CROPS).find((k) => VB['sim/crops'].CROPS[k].sow),
  reap = job('reap', undefined, { field: { crop } });
expect('day', () => {
  a.job = reap;
  plan.day.lists[id] = [reap.key];
  st.t = Math.floor(keep.t / YEAR) * YEAR + (2 * SEASON_DAYS + frostExpected(st) - 2) * DAY + WORK[0] + 2;
}, (r) => assert.strictEqual(r.why, `the ${crop} is to be reaped within two days, before the frost`, r.line));
st.t = keep.t;
// the village's work, in the head's list
const common = job('clear', { type: 'village', id: st.farmsteads[hh.farmstead].village });
expect('village', () => { a.job = common; plan.day.lists[id] = [common.key]; }, (r) => assert(r.place && r.head === head, r.line));
// its own choosing: a task of its household's taken without the plan
expect('self', () => { a.job = plough; });
// the player's order
expect('player', () => { a.job = plough; st.player = { pawn: id }; st.pawns[id].control = { auto: true, queue: [{ verb: 'work', target: plough.key }], refused: null }; });
// VB-1745: an unplayed pawn's own switch and its own order are its own, not the player's
const ownVerb = (verb, args) => VB['sim/commands'].issue(st, { actor: id, verb, target: null, args, source: 'pawn' });
expect('self', () => { assert.strictEqual(ownVerb('auto', { on: false }), true); }, (r) => assert.ok(!/^Your/.test(r.line), r.line));
expect('self', () => { a.job = plough; assert.strictEqual(ownVerb('auto', { on: false }), true); });
expect('self', () => { assert.strictEqual(ownVerb('queue', { cmd: { verb: 'goHome' } }), true); }, (r) => assert.strictEqual(r.why, 'an order of its own'));
// a day lent to the neighbour, at its task
const theirs = job('break', { type: 'household', id: neighbour.id });
expect('lent', () => { a.job = theirs; st.handsToday = { day: Math.floor(st.t / DAY), asked: [], by: { [id]: [neighbour.id, 4, 0, 0] } }; });
// a day owed to the neighbour: on duty, nothing to take there yet
const hadObligations = !!st.obligations;
if (!hadObligations) st.obligations = [];
const obl = st.obligations.length;
st.obligations.push({ creditor: { type: 'household', id: neighbour.id } });
expect('owed', () => { st.daysToday = { day: Math.floor(st.t / DAY), by: { [id]: [obl, 0, 0] } }; }, (r) => assert(/nothing to take at/.test(r.why), r.line));
st.obligations.pop();
if (!hadObligations) delete st.obligations;
// no work: the idle line is the line
expect('none', () => {}, (r) => assert(!/^No work: /.test(r.line) && r.line === r.line[0].toUpperCase() + r.line.slice(1), r.line));
reset();
Object.assign(a, { job: keep.job, mind: keep.mind, path: keep.path, occasion: keep.occasion });
plan.day.lists = keep.lists;

const all = VB['sim/reasons'].BY.filter((b) => b !== 'duty');
assert.deepStrictEqual(all.filter((b) => !seen.has(b)), [], 'every by but duty is reached');
// every living pawn of a running village has a reason, and a dead one none
for (const p of st.pawns) if (p.died === null) assert(Sim.reasonLine(st, p.id), `pawn ${p.id} has a line`);
// no simulation module names the view: only the Sim facade reads it
const r = build();
const readers = r.deps.filter((d) => d.imports.includes('sim/reasons') || d.lookups.some((l) => l.key === 'sim/reasons')).map((d) => d.mod);
// sim/agenda (VB-1644), itself a view read by no simulation module, words its causes by this one's
assert.deepStrictEqual(readers, ['sim/agenda', 'sim'], `only sim and the agenda read sim/reasons, not ${readers.join(', ')}`);
console.log(`reasons ok: ${seen.size} of ${VB['sim/reasons'].BY.length} kinds of chooser reached (duty is VB-1553's)`);
