// tools/usage-page.js on constructed runs: a sub-agent's cost goes to the task its prompt named; a session of its own to the task its
// file names, or the one that heads two thirds of its commits; an orchestrator and a session with no one task are listed apart; a
// task measured twice is the sum; and the page is written with its data.
const assert = require('assert'), fs = require('fs'), os = require('os'), path = require('path'), { execFileSync } = require('child_process');
const { model, weighted, periodTable } = require('../tools/usage-page.js');

const tok = (n) => ({ input: n, cacheWrite: 0, cacheRead: 0, output: 0 });
const run = (session, start, end, extra) =>
  ({ session, label: 'worker', models: ['claude-opus-5-5'], start, end, activeMin: 10, calls: 5, tokens: tok(100), context: { peak: 9 }, subagents: [],
  ...extra });
const at = (s) => Date.parse(s);
const runs = [
  run('orch0000', '2026-11-01T10:00:00Z', '2026-11-01T12:00:00Z', { subagents: [
    { agent: 'a1', task: 'VB-001', model: 'claude-sonnet-5-5', calls: 3, tokens: tok(10), activeMin: 2, peak: 5, start: '2026-11-01T10:05:00Z' },
    { agent: 'a2', task: 'VB-001', model: 'claude-opus-5-5', calls: 4, tokens: tok(20), activeMin: 3, peak: 7, start: '2026-11-02T00:05:00Z' },
    { agent: 'a3', task: null, model: 'claude-sonnet-5-5', calls: 1, tokens: tok(7), activeMin: 1, peak: 2, start: '2026-11-01T10:06:00Z' }] }),
  run('solo0000', '2026-11-03T10:00:00Z', '2026-11-03T10:30:00Z'),
  run('named000', '2026-11-03T10:00:00Z', '2026-11-03T10:30:00Z', { task: 'VB-003', tokens: tok(40) }),
  run('mixed000', '2026-11-04T10:00:00Z', '2026-11-04T10:30:00Z'),
  run('quiet000', '2026-11-05T10:00:00Z', '2026-11-05T10:30:00Z', { label: 'reviewer' }),
];
const commits = [
  { t: at('2026-11-03T10:10:00Z'), subject: 'VB-002: a thing' }, { t: at('2026-11-03T10:33:00Z'), subject: 'VB-002: done' }, {
    t: at('2026-11-03T10:20:00Z'), subject: 'VB-009: beside it' },
  { t: at('2026-11-03T10:40:00Z'), subject: 'VB-009: too late to count' }, { t: at('2026-11-03T10:15:00Z'), subject: 'Merge main' },
  { t: at('2026-11-04T10:10:00Z'), subject: 'VB-004: one' }, { t: at('2026-11-04T10:20:00Z'), subject: 'VB-005: other' },
];
const info = { 'VB-001': { name: 'First', size: 'S', arch: 'year' }, 'VB-002': { name: 'Second', size: 'M', arch: '' } };
const d = model({ runs, commits, taskInfo: (id) => info[id] || null });

const task = (id) => d.tasks.find((t) => t.id === id);
assert.deepStrictEqual(d.tasks.map((t) => t.id).sort(), ['VB-001', 'VB-002', 'VB-003'], 'three tasks measured');
const t1 = task('VB-001');
assert.ok(t1.runs === 2 && t1.i === 30 && t1.w === 30 && t1.calls === 7 && t1.peak === 7, 'a task run twice is the sum of its runs, its peak the higher');
assert.ok(t1.model === 'Sonnet+Opus' && t1.src === 'sub-agent' && t1.date === '2026-11-02' && t1.size === 'S' && t1.name === 'First',
  'its models, its last day, and its size from the backlog');
assert.ok(task('VB-002').src === 'session' && task('VB-002').w === 100,
  'a session goes to the task heading two thirds of its commits, a commit five minutes after its end counted');
assert.ok(task('VB-003').w === 40 && task('VB-003').size === '?', 'a task its file names needs no commit; a task with no file has no size');
const apart = Object.fromEntries(d.sessions.map((s) => [s.id, s]));
assert.ok(apart.orch0000.kind === 'orchestrator' && apart.orch0000.tasks === 2 && apart.orch0000.w === 100, 'an orchestrator is apart, with its own cost only');
assert.ok(apart.a3.kind === 'outside' && apart.mixed000.kind === 'outside' && apart.quiet000.kind === 'outside',
  'a sub-agent with no task, a session split between two tasks and one with no commit are outside a task');
assert.strictEqual(d.tasks.reduce((a, t) => a + t.w, 0) + d.sessions.reduce((a, s) => a + s.w, 0), 100 * 5 + 40 - 100 + 37,
  'every measured token is counted once');
assert.strictEqual(weighted({ input: 1, cacheWrite: 4, cacheRead: 10, output: 2 }), 17, 'the weights of tools/agent-usage.js');
assert.ok(model({ runs: [], commits: [], taskInfo: () => null }).tasks.length === 0, 'no runs, no tasks');

// VB-1616: a session that names its task and handed the rest to a sub-agent on it: its own cost is the task's, and the task a session's
const handed = model({
  runs: [run('sess0001', '2026-11-06T10:00:00Z', '2026-11-06T11:00:00Z', { task: 'VB-007', continuations: { launched: 1, calls: 3 }, subagents: [
  { agent: 'h1', task: 'VB-007', model: 'claude-opus-5-5', calls: 4, tokens: tok(20), activeMin: 3, peak: 7, start: '2026-11-06T10:30:00Z',
    continuation: { continues: true, handoverBytes: 400, contextToEdit: 900, reason: null } }] })], commits: [], taskInfo: () => null });
const h7 = handed.tasks[0];
assert.ok(handed.tasks.length === 1 && h7.w === 120 && h7.src === 'session' && h7.runs === 2 && handed.sessions.length === 0,
  'the session and its continuation are one task');
assert.ok(h7.launched === 1 && h7.launchCalls === 3 && h7.continued === 1 && h7.handoverBytes === 400,
  'its continuation, the handover and the calls to start it');

// VB-1615: the table of periods, a row a stratum a period, its change shown once a period
const P = require('../tools/lib/periods.js');
const pt = periodTable(P.compare({
  data: d, changes: P.parseChanges('| 2026-11-02T12:00Z | A change | x |'), info: () => ({ status: 'done', ticked: 1, criteria: 2 }) }));
assert.deepStrictEqual(pt.map((r) => [r.when, r.stratum, r.n, r.first]),
  [['start', 'sub-agent S Sonnet+Opus', 1, true], ['start', 'orchestrator - Opus', 1, false],
  ['2026-11-02T12:00Z', 'session ? Opus', 1, true], ['2026-11-02T12:00Z', 'session M Opus', 1, false]],
    'the table: a row a stratum, orchestrators last, the period named on its first row');
assert.ok(pt[0].few && pt[0].w === 30 && pt[0].done === 1 && pt[0].delta === null, 'a stratum of few tasks: its median, done share, and no change');

// the tool: --help, and the page written from a directory of runs
const tool = path.join(__dirname, '..', 'tools', 'usage-page.js'), tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'usage-'));
runs.forEach((r, i) => fs.writeFileSync(path.join(tmp, `r${i}.json`), JSON.stringify(r)));
assert.ok(/--dir DIR/.test(execFileSync(process.execPath, [tool, '--help'], { encoding: 'utf8' })), 'tools/usage-page.js answers --help');
const out = path.join(tmp, 'usage.html');
fs.writeFileSync(path.join(tmp, 'changes.md'), '| 2026-11-02T12:00Z | A change | x |\n');
execFileSync(process.execPath, [tool, '--dir', tmp, '--out', out, '--changes', path.join(tmp, 'changes.md')], { encoding: 'utf8' });
const page = fs.readFileSync(out, 'utf8');
assert.ok(!page.includes('/*DATA*/') && page.includes('"VB-001"') && page.includes('orch0000'), 'the page carries its data');
assert.ok(page.includes('"change":"A change"') && page.includes('"periods":[') && page.includes('id="per"'), 'the page carries the changes and the periods');
const script = page.slice(page.indexOf('<script>') + 8, page.lastIndexOf('</script>'));
assert.doesNotThrow(() => new Function(script), 'the page script parses');
fs.rmSync(tmp, { recursive: true });
console.log('usage page ok');
