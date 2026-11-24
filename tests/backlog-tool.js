// tools/backlog.js: sync leaves this checkout's backlog unchanged (the tables are already what the task files make), and new, set, done
// and close-arch on a copy keep tests/backlog.js passing: rows move between sections and to the archive, a done task leaves the
// "Waits for:" lines of the tasks that waited for it, and a task left waiting for nothing is set ready.
const fs = require('fs'), os = require('os'), path = require('path'), { spawnSync } = require('child_process');
const root = path.join(__dirname, '..'), tool = path.join(root, 'tools', 'backlog.js'), errors = [];
const run = (dir, ...args) => {
  const r = spawnSync(process.execPath, [tool, ...(dir ? ['--root', dir] : []), '--date', '2026-01-02', ...args], { encoding: 'utf8' });
  return { ok: r.status === 0, out: r.stdout + r.stderr };
};
const expect = (what, cond, out) => { if (!cond) errors.push(what + (out ? '\n    ' + out.trim().split('\n').join('\n    ') : '')); };

let r = run(null, 'sync', '--dry');
expect('sync --dry on this checkout writes nothing', r.ok && /would write nothing/.test(r.out), r.out);
r = run(null, 'next', '1');
expect('next prints the first ready task and the counts', r.ok && /^VB-\d{3,} P\d [SML] /.test(r.out) && /\d+ ready/.test(r.out), r.out);
r = run(null, 'next', '50', '--size', 'm', '--unattended');
const nextIds = r.out.match(/^VB-\d{3,}/gm) || [], flagged = nextIds.filter((id) => /^- Flag: Kim takes part/m.test(fs.readFileSync(path.join(root, 'backlog', id + '.md'), 'utf8')));
expect('next --size m --unattended lists only M tasks, none flagged for Kim', r.ok && /^VB-\d{3,} P\d M /m.test(r.out)
  && !/^VB-\d{3,} P\d [SL] /m.test(r.out) && !flagged.length, r.out);

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vb-backlog-'));
for (const f of ['BACKLOG.md', 'BACKLOG_ARCHIVE.md']) fs.copyFileSync(path.join(root, f), path.join(dir, f));
fs.mkdirSync(path.join(dir, 'backlog'));
for (const f of fs.readdirSync(path.join(root, 'backlog'))) fs.copyFileSync(path.join(root, 'backlog', f), path.join(dir, 'backlog', f));
const file = (f) => fs.readFileSync(path.join(dir, f), 'utf8');
const section = (f, heading) => (file(f).split('\n## ' + heading + '\n')[1] || '').split('\n## ')[0];
// after a merge that kept both sides' rows: a blocked row under Ready and a ready row twice and under Blocked; sync restores the tables
const original = file('BACKLOG.md'), rowsOf = (h) => section('BACKLOG.md', h).split('\n').filter((l) => l.startsWith('| [VB-'));
const [readyRow] = rowsOf('Ready'), [blockedRow] = rowsOf('Blocked');
fs.writeFileSync(path.join(dir, 'BACKLOG.md'), original.replace(blockedRow, `${readyRow}\n${blockedRow}`)
  .replace(readyRow, `${readyRow}\n${blockedRow}\n${readyRow}`));
r = run(dir, 'sync');
expect('sync restores tables merged with duplicate and misplaced rows', r.ok && file('BACKLOG.md') === original, r.out);
// a test arch, last in the Archs table
const archs = file('BACKLOG.md').split('\n'), last = archs.findLastIndex((l) => /^\| [a-z-]+ \| /.test(l) && !/^\| Key /.test(l));
archs.splice(last + 1, 0, '| zz-test | Test arch | A test goal. | none |');
fs.writeFileSync(path.join(dir, 'BACKLOG.md'), archs.join('\n'));

const next = Math.max(...fs.readdirSync(path.join(dir, 'backlog')).map((f) => +f.slice(3).replace('.md', ''))) + 1;
const A = 'VB-' + String(next).padStart(3, '0'), B = 'VB-' + String(next + 1).padStart(3, '0');
r = run(dir, 'new', 'name=Unclosed `code', 'status=needs-review', 'priority=1', 'size=S', 'summary=Test.');
expect('new rejects an unmatched title delimiter before creating the file', !r.ok && r.out.includes(A + ' name:')
  && !fs.existsSync(path.join(dir, 'backlog', A + '.md')), r.out);
r = run(dir, 'new', 'name=Plan: test one', 'status=needs-review', 'priority=1', 'size=S', 'arch=zz-test', 'summary=One.');
expect(`new ${A} in Waiting for Kim`, r.ok && section('BACKLOG.md', 'Waiting for Kim').includes(`[${A}]`)
  && /^Phase: plan$/m.test(file(`backlog/${A}.md`)), r.out);
const beforeInvalid = file('BACKLOG.md'), beforeTask = file('backlog/' + A + '.md');
for (const summary of ['Truncated `code', 'two\nlines', 'mismatched `code``']) {
  r = run(dir, 'set', A, 'priority=3', 'summary=' + summary);
  expect('set rejects malformed cells before writing any changes', !r.ok && r.out.includes(A + ' summary:')
    && file('BACKLOG.md') === beforeInvalid && file('backlog/' + A + '.md') === beforeTask, r.out);
}
fs.writeFileSync(path.join(dir, 'BACKLOG.md'), beforeInvalid.replace('| One. |', '| Truncated `code |'));
r = run(dir, 'sync', '--dry');
expect('sync checks summaries read from disk', !r.ok && r.out.includes(A + ' summary:'), r.out);
r = run(dir, 'set', A, 'summary=Use ``a`b`` or a literal \\`.');
expect('set can repair a malformed row with valid Markdown', r.ok, r.out);
r = run(dir, 'new', 'name=Test two', 'status=ready', 'priority=1', 'size=S', 'summary=Two.');
expect('new refuses a ready task', !r.ok, r.out);
r = run(dir, 'new', 'name=Test two', 'status=blocked', `waits=${A}, Kim`, 'priority=1', 'size=S', 'arch=zz-test', 'summary=Two.');
expect(`new ${B} writes "Touches: (to write)" after Design ref`, /^Design ref: .*\nTouches: \(to write\)\nGoal: /m.test(file(`backlog/${B}.md`)));
expect(`new ${B} blocked, waiting for ${A} and Kim`, r.ok && section('BACKLOG.md', 'Blocked').includes(`| [${A}](#${A}), Kim | Two. |`), r.out);
fs.writeFileSync(path.join(dir, `backlog/${B}.md`), file(`backlog/${B}.md`).replace(/\(to write\)/g, 'Stated.'));

r = run(dir, 'done', A);
expect(`done ${A}: archived last, ${B} still waits for Kim`, r.ok && /^Status: done \(2026-01-02\)$/m.test(file(`backlog/${A}.md`))
  && section('BACKLOG_ARCHIVE.md', 'Done tasks').trim().split('\n').pop().startsWith(`| [${A}]`)
  && /^Waits for: Kim$/m.test(file(`backlog/${B}.md`)), r.out);
r = run(dir, 'set', B, 'waits=');
expect('set refuses a blocked task that waits for nothing', !r.ok, r.out);
r = run(dir, 'close-arch', 'zz-test');
expect('close-arch refuses an arch with open tasks', !r.ok, r.out);
r = run(dir, 'set', B, 'status=ready', 'priority=2');
expect(`set ${B} ready: no "Waits for:", row in Ready`, r.ok && !/^Waits for:/m.test(file(`backlog/${B}.md`))
  && section('BACKLOG.md', 'Ready').includes(`[${B}](backlog/${B}.md)<a id="${B}"></a> | Test two | zz-test | 2 | S | Two. |`), r.out);
fs.appendFileSync(path.join(dir, `backlog/${B}.md`), 'Notes:\nCause: a note that begins with the word, not the header.\n');
r = run(dir, 'set', B, `cause=${A}`);
expect(`set ${B} cause=${A}: the line after Status`, r.ok && new RegExp(`^Status: ready\nCause: ${A}\nPriority: 2$`, 'm').test(file(`backlog/${B}.md`))
  && file(`backlog/${B}.md`).includes('Cause: a note that begins with the word'), r.out);
r = run(dir, 'set', B, 'cause=VB-99999');
expect('set refuses a cause with no task file', !r.ok, r.out);
r = run(dir, 'set', B, `cause=${B}`);
expect('set refuses a task as its own cause', !r.ok, r.out);
// Touches (VB-1671, docs/agents/tasks.md): new writes the line to fill, set writes it after Design ref, a malformed one is refused
r = run(dir, 'set', B, 'touches=sim/jobs (allot, lookForWork); page/words (showPawn); new sim/wells');
expect(`set ${B} touches=: the line after Design ref`, r.ok && /^Design ref: .*\nTouches: sim\/jobs \(allot, lookForWork\); page\/words \(showPawn\); new sim\/wells\nGoal: /m.test(file(`backlog/${B}.md`)), r.out);
const C = 'VB-' + (Math.max(...fs.readdirSync(path.join(dir, 'backlog')).map((f) => +f.slice(3, -3) || 0)) + 1);
r = run(dir, 'new', 'name=Test three', 'status=needs-review', 'priority=2', 'size=S', 'summary=Three.', 'ref=r', 'goal=g');
fs.writeFileSync(path.join(dir, `backlog/${C}.md`), file(`backlog/${C}.md`).replace('- [ ] (to write)', '- [ ] Done.').replace(/^Touches: .*\n/m, ''));
r = run(dir, 'set', C, 'status=ready');
expect(`a ready task without a Touches line fails the check (${C}, VB-1671)`, !r.ok && /without a "Touches:" line/.test(r.out), r.out);
r = run(dir, 'set', C, 'touches=tests/x.js', 'status=ready');
expect('...and passes once it has one', r.ok, r.out);
r = run(dir, 'set', B, 'touches=sim/jobs (allot');
expect('set refuses a malformed Touches line', !r.ok && /touches=/.test(r.out), r.out);
const { parseTouches } = require(path.join(root, 'tools', 'lib', 'touches.js'));
const parses = (t) => { try { return parseTouches(t); } catch { return null; } };
expect('touches: unknown with a reason', parses('unknown (a plan task)') && parses('unknown (a plan task)').unknown === 'a plan task');
expect('touches: items with names, a path, new', JSON.stringify(parses('sim/jobs (allot, KINDS); tests/jobs.js; new sim/wells').items)
  === JSON.stringify([{ target: 'sim/jobs', names: ['allot', 'KINDS'], created: false }, { target: 'tests/jobs.js', names: [], created: false },
    { target: 'sim/wells', names: [], created: true }]));
for (const bad of ['', '(to write)', 'sim/jobs (allot lookForWork)', 'sim jobs', 'sim/jobs (a-b)', 'unknown'])
  expect(`touches: "${bad}" is refused`, parses(bad) === null);
r = run(dir, 'done', B);
expect('the emptied arch is reported', r.ok && /arch zz-test has no open tasks left/.test(r.out), r.out);
r = run(dir, 'close-arch', 'zz-test');
expect('close-arch moves the arch to the archive', r.ok && !file('BACKLOG.md').includes('zz-test |')
  && section('BACKLOG_ARCHIVE.md', 'Closed archs').includes('| zz-test | Test arch | Closed 2 January 2026: A test goal. | none |'), r.out);
r = run(dir, 'list', A, B, '--status', 'done');
expect('list by ID', r.ok && r.out.trim().split('\n').length === 2, r.out);
fs.rmSync(dir, { recursive: true, force: true });

if (errors.length) { console.error('BACKLOG TOOL FAIL:\n  ' + errors.join('\n  ')); process.exit(1); }
console.log('backlog tool: sync is a no-op here; new, set, done and close-arch on a copy keep the backlog check passing');
