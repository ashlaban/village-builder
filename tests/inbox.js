// tools/inbox.js on a copy of the backlog: IDs are reserved in blocks that never overlap, a claim names who else edits a file, a note
// is checked against its kind and a task note against the IDs reserved for its task, apply writes each result and note once (the
// backlog through tools/backlog.js, the questions, the tuning row) and leaves tests/backlog.js passing, and report prints the PR's section.
const fs = require('fs'), os = require('os'), path = require('path'), { spawnSync } = require('child_process');
const root = path.join(__dirname, '..'), tool = path.join(root, 'tools', 'inbox.js'), errors = [];
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vb-inbox-'));
for (const f of ['BACKLOG.md', 'BACKLOG_ARCHIVE.md', 'QUESTIONS.md']) fs.copyFileSync(path.join(root, f), path.join(dir, f));
fs.mkdirSync(path.join(dir, 'backlog')); fs.mkdirSync(path.join(dir, 'docs'));
for (const f of fs.readdirSync(path.join(root, 'backlog'))) fs.copyFileSync(path.join(root, 'backlog', f), path.join(dir, 'backlog', f));
fs.copyFileSync(path.join(root, 'docs', 'tuning.md'), path.join(dir, 'docs', 'tuning.md'));
const run = (input, ...args) => {
  const r = spawnSync(process.execPath, [tool, '--root', dir, '--db', path.join(dir, 'inbox.db'), '--date', '2026-01-02', ...args], {
    encoding: 'utf8', input: input || '' });
  return { ok: r.status === 0, out: r.stdout + r.stderr };
};
const expect = (what, cond, out) => { if (!cond) errors.push(what + (out ? '\n    ' + out.trim().split('\n').join('\n    ') : '')); };
const file = (f) => fs.readFileSync(path.join(dir, f), 'utf8');
const pad = (n) => 'VB-' + String(n).padStart(3, '0');
const last = Math.max(...fs.readdirSync(path.join(dir, 'backlog')).map((f) => +f.slice(3).replace('.md', '')));
const ready = (file('BACKLOG.md').split('\n## Ready\n')[1].match(/\[(VB-\d+)\]/g) || []).map((s) => s.slice(1, -1));
const [A, B] = ready, N = pad(last + 1);

let r = run('', 'status');
expect('a command before init says who runs init', !r.ok && /init/.test(r.out), r.out);
r = run('', 'init');
expect('init reads the next free ID from backlog/', r.ok && r.out.includes(N), r.out);
r = run('', 'start', A);
expect('start reserves two IDs', r.ok && r.out.includes([0, 1].map((i) => pad(last + 1 + i)).join(' ')), r.out);
r = run('', 'start', B, '2');
expect('a second block follows the first', r.ok && r.out.includes(`${pad(last + 3)} ${pad(last + 4)}`), r.out);
r = run('', 'claim', A, 'src/sim/herds.js');
expect('a first claim is free', r.ok, r.out);
r = run('', 'claim', B, 'src/sim/herds.js', 'src/sim/stores.js');
expect('a second claim names the holder and exits 1', !r.ok && r.out.includes(`also being edited by ${A}`), r.out);

r = run('- [ ] The herd is led.', 'note', A, 'task', `id=${N}`, 'name=Herds are led | to a new farm', 'priority=2', 'size=M', 'summary=Herds walk.', '--body',
  '-');
expect('a task note with a reserved ID', r.ok, r.out);
r = run('', 'note', B, 'task', `id=${N}`, 'name=x', 'priority=1', 'size=S', 'summary=s');
expect("another task's reserved ID is refused", !r.ok && /not reserved/.test(r.out), r.out);
r = run('', 'note', A, 'task', `id=${N}`, 'name=x', 'priority=1', 'size=S', 'summary=s');
expect('an ID is used once', !r.ok && /already has a note/.test(r.out), r.out);
r = run('', 'note', A, 'task', `id=${pad(last + 2)}`, 'name=x', 'priority=1', 'size=S', 'summary=s', 'status=ready');
expect('a noted task is ready only with its goal and criteria', !r.ok && /goal/.test(r.out), r.out);
r = run('', 'note', A, 'tuning', 'parameter=X.y');
expect('a note lacking keys says which', !r.ok && /means, measured, proposed/.test(r.out), r.out);
r = run('', 'note', A, 'question', 'priority=2', 'title=a test');
expect('a question needs its text', !r.ok && /--body/.test(r.out), r.out);
r = run('1. Is it so? **P:** yes.', 'note', A, 'question', 'priority=2', 'title=the inbox test', `about=${N}`, '--body', '-');
expect('a question note', r.ok, r.out);
for (const a of [['tuning', 'parameter=`X.y` 3', 'means=a | thing', 'measured=low', 'proposed=more'], ['candidate', 'rule=Animals are led, never carried'],
  ['teleport', 'where=src/sim/herds.js:420', 'what=hay jumps'], ['teleport', 'where=src/sim/herds.js:99', 'what=wool jumps'],
  ['act', 'where=src/sim/clock.js:7', 'what=the calendar culls'], ['decision', 'what=a', 'why=b']]) {
  r = run('', 'note', A, ...a);
  expect(`a ${a[0]} note`, r.ok, r.out);
}
r = run('', 'list', 'candidate', '--json');
expect('list by kind, as JSON', r.ok && JSON.parse(r.out).length === 1 && JSON.parse(r.out)[0].fields.rule.startsWith('Animals'), r.out);

r = run('', 'result', A, 'status=done', 'commit=abc1234', 'size=M', 'model=opus');
expect('a result', r.ok, r.out);
r = run('', 'status');
expect('status: the done task, the running one with its claims, the open notes', r.ok && r.out.includes(`${A} done abc1234`)
  && r.out.includes(`${B} running; editing src/sim/herds.js, src/sim/stores.js`) && /1 task, 1 question, 1 tuning, 1 candidate/.test(r.out), r.out);
r = run('', 'results', '--json');
expect('results as JSON', r.ok && JSON.parse(r.out).find((x) => x.task === A).size === 'M', r.out);
r = run('- [ ] The check passes.', 'note', A, 'task', `id=${pad(last + 2)}`, 'name=Mend a red check', 'priority=1', 'size=S', 'summary=Red.', 'status=ready',
  'goal=the check passes', 'ref=tests/x.js', '--body', '-');
expect('a ready task note, with its goal and criteria', r.ok, r.out);
const before = file('BACKLOG.md');
r = run('', 'apply', '--dry');
expect('apply --dry writes nothing', r.ok && file('BACKLOG.md') === before && !fs.existsSync(path.join(dir, 'backlog', N + '.md')), r.out);
r = run('', 'apply');
expect('apply: the result, the task, the question, the tuning row and the three findings', r.ok && /applied 8/.test(r.out), r.out);
const collected = (name) =>
  fs.readdirSync(path.join(dir, 'backlog')).map((f) => file('backlog/' + f)).filter((t) => t.includes(`: ${name}`) && !/^Status: done/m.test(t));
expect('the teleports are lines of one open collecting task', collected('Teleports found, collected').length === 1
  && collected('Teleports found, collected')[0].includes(`- [ ] From ${A}: src/sim/herds.js:420: hay jumps\n- [ ] From ${A}: src/sim/herds.js:99: wool jumps`));
expect('the act is a line of its own collecting task, ready', collected('Acts with no pawn, collected').length === 1
  && /^Status: ready$/m.test(collected('Acts with no pawn, collected')[0]) && collected('Acts with no pawn, collected')[0].includes('the calendar culls'));
expect('the done task left the Ready table', !file('BACKLOG.md').split('\n## Ready\n')[1].split('\n## ')[0].includes(`[${A}]`));
expect('the noted task has its file, criteria and origin', /^Status: needs-review$/m.test(file(`backlog/${N}.md`))
  && file(`backlog/${N}.md`).includes('- [ ] The herd is led.') && file(`backlog/${N}.md`).includes(`Noted by ${A}, 2 January 2026.`));
expect('the ready note is a ready task, first in line', /^Status: ready$/m.test(file(`backlog/${pad(last + 2)}.md`))
  && file(`backlog/${pad(last + 2)}.md`).includes('- [ ] The check passes.')
  && file('BACKLOG.md').split('\n## Ready\n')[1].split('\n## ')[0].includes(`[${pad(last + 2)}]`));
expect('the question is filed under its task, in its priority', file('QUESTIONS.md').split('\n## Priority 2\n')[1].split('\n## ')[0]
  .includes(`### ${N}: the inbox test (raised 2 January 2026)\n1. Is it so? **P:** yes.`));
expect('the tuning row, bars replaced', file('docs/tuning.md').includes(`| \`X.y\` 3 | a / thing | low | more | ${A} |`));
r = run('', 'apply');
expect('apply applies once', r.ok && /applied 0/.test(r.out), r.out);
const check = spawnSync(process.execPath, [path.join(root, 'tests', 'backlog.js'), dir], { encoding: 'utf8' });
expect('tests/backlog.js passes on the result', check.status === 0, check.stdout + check.stderr);
r = run('', 'result', B, 'status=needs-review', 'commit=def5678', 'summary=cost not measured');
r = run('', 'apply');
expect('a task with a criterion unmet goes to Waiting for Kim', r.ok &&
  file('BACKLOG.md').split('\n## Waiting for Kim\n')[1].split('\n## ')[0].includes(`[${B}]`), r.out);
r = run('', 'report');
expect('and heads the report with its reason', r.out.includes(`- ${B} def5678: cost not measured`), r.out);
r = run('', 'report');
expect('report: the PR section', r.ok && r.out.startsWith('## For Kim') && r.out.includes('- Animals are led, never carried')
  && r.out.includes('hay jumps') && r.out.includes(`- ${N} Herds are led`), r.out);

// the ceiling: calls are counted from the sub-agent's transcript, a model call a message id; a task is continued at most twice
const sub = path.join(dir, 'config', 'projects', 'p', 's', 'subagents'); fs.mkdirSync(sub, { recursive: true });
const entry = (i) => JSON.stringify({
  type: 'assistant', message: { id: 'msg_' + i, usage: { input_tokens: 2, cache_read_input_tokens: 1000 * (i + 1), output_tokens: 10 } } });
const calls = (n) => {
  fs.writeFileSync(path.join(sub, 'agent-abc123.jsonl'), [...Array(n).keys()].flatMap((i) => [entry(i), entry(i), '{"type":"user"}']).join('\n'));
  const c = spawnSync(process.execPath, [tool, '--root', dir, '--db', path.join(dir, 'inbox.db'), 'calls', 'abc123'], {
    encoding: 'utf8', env: { ...process.env, CLAUDE_CONFIG_DIR: path.join(dir, 'config') } });
  return c.stdout + c.stderr; };
// 40 calls: the last read 40,002 tokens; weighted 40 × (2 + 50) + 0.1 × 1000 × (1 + ... + 40) = 2,080 + 82,000
expect('calls: counted by message id, with the context and the weighted cost', calls(40).trim() === '40 of 120 calls; context 40k; weighted 84k', calls(40));
expect('calls: a warning near the ceiling', /^110 of 120 calls; context 110k; weighted [\d.]+k: 10 left/.test(calls(110)), calls(110));
expect('calls: at the ceiling, hand over', /^125 of 120 calls; .*: the ceiling is reached. Hand over now/.test(calls(125)), calls(125));
// a session of its own (VB-1615): its newest transcript, its sub-agents' calls apart, and no ceiling
const sess = path.join(dir, 'config', 'projects', 'p', 'sess.jsonl');
fs.writeFileSync(sess,
  [entry(1), entry(1), JSON.stringify({ type: 'assistant', isSidechain: true, message: { id: 'side', usage: { input_tokens: 5 } } }), entry(2)].join('\n'));
const c = spawnSync(process.execPath, [tool, '--root', dir, '--db', path.join(dir, 'none.db'), 'calls'], {
  encoding: 'utf8', env: { ...process.env, CLAUDE_CONFIG_DIR: path.join(dir, 'config') } });
expect('calls: in a session, its own transcript, no inbox needed and no ceiling',
  c.stdout.trim() === "2 calls (a session: the ceiling of 120 is a sub-agent's); context 3k; weighted 604", c.stdout + c.stderr);
r = run('', 'result', B, 'status=continue');
expect('a continuation needs its commit', !r.ok && /commit=SHA/.test(r.out), r.out);
r = run('', 'result', B, 'status=continue', 'commit=aaa1111', 'summary=half built');
expect('a continuation, the first of two', r.ok && r.out.includes('continue (1 of 2)'), r.out);
r = run('', 'apply');
expect('a continued task is not applied', r.ok && /applied 0/.test(r.out), r.out);
run('', 'result', B, 'status=continue', 'commit=aaa2222');
r = run('', 'result', B, 'status=continue', 'commit=aaa3333');
expect('no third continuation', !r.ok && /needs-review/.test(r.out), r.out);

fs.rmSync(dir, { recursive: true, force: true });
if (errors.length) { console.error('INBOX FAIL\n  ' + errors.join('\n  ')); process.exit(1); }
console.log('inbox: reserved IDs, claims, notes by kind, apply once and the report on a copy of the backlog');
