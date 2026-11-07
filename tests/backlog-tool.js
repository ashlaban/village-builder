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
expect('next prints the first ready task and the counts', r.ok && /^VB-\d{3} P\d [SML] /.test(r.out) && /\d+ ready/.test(r.out), r.out);

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

const next = Math.max(...fs.readdirSync(path.join(dir, 'backlog')).map((f) => +f.slice(3, 6))) + 1;
const A = 'VB-' + String(next).padStart(3, '0'), B = 'VB-' + String(next + 1).padStart(3, '0');
r = run(dir, 'new', 'name=Plan: test one', 'status=needs-review', 'priority=1', 'size=S', 'arch=zz-test', 'summary=One.');
expect(`new ${A} in Waiting for Kim`, r.ok && section('BACKLOG.md', 'Waiting for Kim').includes(`[${A}]`)
  && /^Phase: plan$/m.test(file(`backlog/${A}.md`)), r.out);
r = run(dir, 'new', 'name=Test two', 'status=ready', 'priority=1', 'size=S', 'summary=Two.');
expect('new refuses a ready task', !r.ok, r.out);
r = run(dir, 'new', 'name=Test two', 'status=blocked', `waits=${A}, Kim`, 'priority=1', 'size=S', 'arch=zz-test', 'summary=Two.');
expect(`new ${B} blocked, waiting for ${A} and Kim`, r.ok && section('BACKLOG.md', 'Blocked').includes(`| ${A}, Kim | Two. |`), r.out);
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
  && section('BACKLOG.md', 'Ready').includes(`[${B}](backlog/${B}.md) | Test two | zz-test | 2 | S | Two. |`), r.out);
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
