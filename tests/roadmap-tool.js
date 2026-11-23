// tools/roadmap.js on a small constructed backlog: the slices in the Archs table's order with a closed slice put back by its number,
// a side arch merged before the first slice that began after it and one not begun before the last slice, the pace from full days,
// growth from the slices planned five days before, an arch whose plan is open counted as unplanned, finishes in order and the
// whole backlog's end the last of them; and --help without running.
const assert = require('assert'), path = require('path'), { execFileSync } = require('child_process');
const { model, sizeMix } = require('../tools/roadmap.js');

const tasks = [];
let n = 0;
const add = (arch, name, created, doneDate) => tasks.push({ id: 'VB-' + ++n, arch, name, created, done: !!doneDate, doneDate: doneDate || null });
// 14 days, 1 to 14 November; days 1..10 full (12 done), 11..14 slow (1 done)
for (let d = 1; d <= 14; d++) for (let i = 0; i < (d <= 10 ? 12 : 1); i++) add('-', 'filler', '2026-11-01', `2026-11-${String(d).padStart(2, '0')}`);
// slice 0 (open), planned day 2 with 4 tasks, 8 now, 6 done
add('zero', 'Plan: zero', '2026-11-01', '2026-11-02');
for (let i = 0; i < 3; i++) add('zero', 'zero work', '2026-11-02', '2026-11-03');
for (let i = 0; i < 2; i++) add('zero', 'zero work', '2026-11-05', '2026-11-06');
for (let i = 0; i < 2; i++) add('zero', 'zero more', '2026-11-08');
// slice 1 (closed), done
add('one', 'Plan: one', '2026-11-02', '2026-11-03'); add('one', 'one work', '2026-11-03', '2026-11-04');
// slice 2 (open), planned day 4 with 5 tasks, 10 now, 2 done
add('two', 'Plan: two', '2026-11-03', '2026-11-04');
for (let i = 0; i < 4; i++) add('two', 'two work', '2026-11-04', i ? null : '2026-11-05');
for (let i = 0; i < 5; i++) add('two', 'two more', '2026-11-09');
// slice 3 (open), its plan still open: unplanned
add('three', 'Plan: three', '2026-11-05'); add('three', 'three early', '2026-11-05', '2026-11-07');
// side arch begun day 6 (before slice 3 began on day 7), and one not begun
add('side', 'side work', '2026-11-06', '2026-11-06'); add('side', 'side work', '2026-11-06');
add('later', 'later work', '2026-11-12');
add('-', 'an open refactor', '2026-11-13');
const open = [{ key: 'zero', name: 'Slice 0: the zero' }, { key: 'two', name: 'Slice 2: the two' }, { key: 'three', name: 'Slice 3: the three' },
  { key: 'side', name: 'The side' }, { key: 'later', name: 'The later' }];
const closed = [{ key: 'old', name: 'An old arch' }, { key: 'one', name: 'Slice 1: the one' }];
const m = model({ tasks, open, closed, today: '2026-11-14', kim: [] });

assert.deepStrictEqual(m.slices, ['zero', 'one', 'two', 'three'], 'slices: the table order, the closed slice back in by its number');
assert.strictEqual(m.names.zero, '0 · The zero', 'a slice is named by its number');
assert.deepStrictEqual(m.order, ['zero', 'one', 'two', 'side', 'later', 'three'], 'order: side before the first slice begun after it; not begun before the last');
const perDay = {};
for (const t of tasks) if (t.doneDate) perDay[t.doneDate] = (perDay[t.doneDate] || 0) + 1;
const fullDays = Object.values(perDay).filter((v) => v >= 10);
assert.ok(fullDays.length === 10 && Math.abs(m.paceFull - fullDays.reduce((a, b) => a + b, 0) / 10) < 1e-9, 'pace: the mean of the full days, ' + m.paceFull);
assert.ok(Math.abs(m.share14 - 10 / 14) < 1e-9, 'share of full days over the last 14');
assert.ok(m.rate[0] <= m.rate[1] && m.rate[1] <= m.paceFull, 'rate: a range below the full-day pace');
assert.strictEqual(m.info.zero.atPlan, 4, 'size at the plan: the tasks there on the plan day');
assert.strictEqual(m.info.three.atPlan, null, 'an arch whose plan is open is unplanned');
assert.deepStrictEqual(m.rem.one, [0, 0], 'a finished arch has nothing left');
assert.ok(m.rem.three[0] >= m.sizeLo - 1e-9, 'an unplanned arch counts at least a planned slice\'s size');
assert.ok(!m.est.one && m.est.zero && m.est.three, 'only open archs are estimated');
const ends = m.order.filter((k) => m.est[k]).map((k) => m.est[k]);
for (let i = 1; i < ends.length; i++) assert.ok(ends[i][0] >= ends[i - 1][0] && ends[i][1] >= ends[i - 1][1], 'estimates follow the order');
assert.deepStrictEqual(m.finish, ends.at(-1), 'the whole backlog ends with the last arch');
assert.ok(m.est['-'] && m.est['-'][1] === m.finish[1], 'tasks with no arch end with the rest');
assert.ok(m.scope[0] >= tasks.length && m.scope[0] <= m.scope[1], 'final size: at least the tasks there are');
assert.strictEqual(m.per.first, undefined, 'no row for the first archs when none has tasks');
const mix = sizeMix([{ done: false, status: 'ready', priority: '1', size: 'M' }, { done: false, status: 'blocked', priority: '3', size: 'S' },
  { done: false, status: 'ready', priority: '3', size: 'S' }, { done: true, status: 'done', priority: '1', size: 'L' }, { done: false, status: 'odd', size: '' }]);
assert.deepStrictEqual(mix.sizes, ['S', 'M', '?'], 'size mix: the sizes present in order, a missing size as ?');
assert.deepStrictEqual(mix.total, { S: 2, M: 1, '?': 1 }, 'size mix: only open tasks count');
assert.deepStrictEqual(Object.keys(mix.status), ['ready', 'blocked', 'odd'], 'size mix: known statuses first, then any other');
assert.deepStrictEqual(mix.status.ready, { S: 1, M: 1, '?': 0 }, 'size mix: by status');
assert.deepStrictEqual(mix.priority, { P1: { S: 0, M: 1, '?': 0 }, P3: { S: 2, M: 0, '?': 0 }, '?': { S: 0, M: 0, '?': 1 } }, 'size mix: by priority');
const help = execFileSync(process.execPath, [path.join(__dirname, '..', 'tools', 'roadmap.js'), '--help'], { encoding: 'utf8' });
assert.ok(/--out FILE/.test(help) && /--json/.test(help), 'tools/roadmap.js answers --help');
console.log('roadmap tool ok');
