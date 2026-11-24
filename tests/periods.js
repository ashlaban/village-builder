// tools/lib/periods.js (VB-1615) on constructed data: the log's rows cut periods; a task falls in the period its first run started in;
// strata by run kind, size and model; a stratum under FEW tasks is marked and not compared; the change against the period before;
// done from the runs' outcome, else the backlog; the reopened proxy; and orchestrators apart.
const assert = require('assert');
const P = require('../tools/lib/periods.js');

const md = `| When (UTC) | Change | Files |\n|---|---|---|\n| 2026-11-10T12:00Z | Second | x |\n| 2026-11-01 | First | y |\nnot a row\n| when | header |`;
const changes = P.parseChanges(md);
assert.deepStrictEqual(changes.map((c) => c.change), ['First', 'Second'], 'rows with a date, in time order');
assert.strictEqual(changes[0].at, Date.parse('2026-11-01T00:00Z'), 'a date alone is the start of its day, UTC');
assert.deepStrictEqual(P.periodsOf(changes).map((p) => p.when), ['start', '2026-11-01', '2026-11-10T12:00Z'], 'a period before the first row, then one a row');

assert.deepStrictEqual(P.fileInfo('# VB-1: x\nStatus: done (2026-11-02)\nAcceptance criteria:\n- [x] a\n- [ ] b\n  - [X] c\nNotes:\n- [ ] not a criterion'),
  { status: 'done', ticked: 2, criteria: 3 }, 'status, and criteria ticked of all, before the notes');

const task = (id, start, w, extra) => ({ id, src: 'sub-agent', size: 'S', model: 'Sonnet', start, end: start, date: start.slice(0, 10), w, calls: 10, runs: 1,
  cr: 0, peak: 100, boot: 50, statuses: ['done'], repeats: 1, testsFailed: 0, streak: 0, continued: 0, ...extra });
const before = [1, 2, 3, 4, 5].map((i) => task('VB-10' + i, `2026-11-0${i + 1}T10:00:00Z`, 100 * i));
const after = [1, 2, 3, 4, 5, 6].map((i) =>
  task('VB-20' + i, `2026-11-1${i}T13:00:00Z`, 50 * i, i === 6 ? { statuses: [], runs: 2, continued: 1, handoverBytes: 900, reconstruct: 4000 } : {}));
const few = [task('VB-301', '2026-11-12T13:00:00Z', 7, { src: 'session', size: 'M', model: 'Opus', statuses: [] })];
const files = { 'VB-206': { status: 'needs-review', ticked: 1, criteria: 2 }, 'VB-301': { status: 'done', ticked: 2, criteria: 2 } };
const data = { tasks: [...before, ...after, ...few, task('VB-001', '2026-10-01T00:00:00Z', 1)], sessions: [
  { id: 'o1', kind: 'orchestrator', start: '2026-11-12T00:00:00Z', model: 'Opus', w: 1000, calls: 50, peak: 9 },
  { id: 'x1', kind: 'outside', start: '2026-11-12T00:00:00Z', model: 'Opus', w: 1, calls: 1, peak: 1 }] };
const fixList = [{ id: 'VB-900', at: Date.parse('2026-11-14T00:00:00Z'), text: '# VB-900: Fix: red after VB-203' },
  { id: 'VB-901', at: Date.parse('2026-11-30T00:00:00Z'), text: '# VB-901: Fix: red after VB-204' }];
const c = P.compare({ data, changes, info: (id) => files[id] || null, fixList });
assert.deepStrictEqual(c.periods.map((p) => [p.when, p.tasks]), [['start', 1], ['2026-11-01', 5], ['2026-11-10T12:00Z', 7]],
  'each task in the period its first run started in');
const [, p1, p2] = c.periods, s1 = p1.strata[0], s2 = p2.strata.find((s) => s.key === 'sub-agent S Sonnet');
assert.ok(s1.n === 5 && !s1.few && s1.measures.weighted.median === 300 && s1.measures.weighted.q1 === 200, 'medians and quartiles of a stratum');
assert.ok(s2.n === 6 && s2.shares.done.share === 5 / 6 && s2.measures.weighted.median === 150,
  'done from the runs, else the backlog; cost over done tasks only');
assert.ok(Math.abs(s2.change.weighted - (150 / 300 - 1)) < 1e-9 && s2.change.against === '2026-11-01', 'the change against the period before');
assert.ok(s2.shares.continued.share === 1 / 6 && s2.measures.handoverBytes.median === 900 && s2.measures.reconstruct.n === 1,
  'continuations, their handover and reconstruction');
assert.ok(s2.shares.reopened.share === 1 / 6, 'reopened: a Fix task within 7 days that names it; a later one does not count');
const sess = p2.strata.find((s) => s.kind === 'session');
assert.ok(sess.few && sess.change === null && sess.shares.done.share === 1 && sess.measures.ticked.median === 1, 'a stratum under FEW is marked, not compared');
const orch = p2.strata.find((s) => s.kind === 'orchestrator');
assert.ok(orch && orch.n === 1 && orch.measures.weighted.median === 1000 && !p2.strata.some((s) => s.key.includes('outside')),
  'orchestrators apart; outside sessions left out');
const ranged = P.compare({ data, changes, info: () => null, from: Date.parse('2026-11-10T12:00Z') });
assert.deepStrictEqual(ranged.periods.map((p) => p.when), ['2026-11-10T12:00Z'], '--from keeps the tasks that started after it');
const text = P.report(c);
assert.ok(/sub-agent S Sonnet +6 +83% +150 \[100, 200\] +-50%/.test(text) && /session M Opus \(few\)/.test(text) && /a proxy/.test(text),
  'the report:\n' + text);
console.log('periods: changes cut periods; strata, few, change, quality proxies and orchestrators');
