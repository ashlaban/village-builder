// tools/merge.js, the merge drivers (VB-1620), on constructed three-way cases: the backlog's task rows merge by ID and field and come out
// in the backlog's order; what is not mechanical (a row changed both ways, an ID taken twice, a row removed on one side and changed on
// the other, prose changed both ways) stays a conflict with markers; and, end to end, `git merge` in a scratch repository runs the
// driver that `--install` and `.gitattributes` set.
const fs = require('fs'), os = require('os'), path = require('path'), { spawnSync } = require('child_process');
const root = path.join(__dirname, '..'), tool = path.join(root, 'tools', 'merge.js'), errors = [];
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vb-merge-test-'));
const expect = (what, cond, out) => { if (!cond) errors.push(what + (out ? '\n    ' + String(out).trim().split('\n').join('\n    ') : '')); };
function drive(mode, o, a, b) {
  const f = (n, s) => { const p = path.join(tmp, n); fs.writeFileSync(p, s); return p; };
  const [po, pa, pb] = [f('o', o), f('a', a), f('b', b)];
  const r = spawnSync(process.execPath, [tool, mode, po, pa, pb, 'X.md'], { encoding: 'utf8' });
  return { clean: r.status === 0, status: r.status, text: fs.readFileSync(pa, 'utf8'), err: r.stderr };
}

// ---- a small BACKLOG.md
const row = (id, name, arch, p, waits, summary = 'about ' + id) =>
  `| [${id}](backlog/${id}.md)<a id="${id}"></a> | ${name} | ${arch} | ${p} | S | ${waits === undefined ? '' : waits + ' | '}${summary} |`;
const backlog = ({ ready = [], kim = [], blocked = [], archs = ['alpha', 'beta'], prose = 'Prose.' }) => [
  '# Backlog', '', prose, '', '## Ready', '', '| Task | Name | Arch | Priority | Size | Summary |', '|---|---|---|---|---|---|', ...ready, '',
  '## Waiting for Kim', '', '| Task | Name | Arch | Priority | Size | Summary |', '|---|---|---|---|---|---|', ...kim, '',
  '## Blocked', '', '| Task | Name | Arch | Priority | Size | Waits for | Summary |', '|---|---|---|---|---|---|---|', ...blocked, '',
  '## Archs', '', '| Key | Arch | Goal | Design ref |', '|---|---|---|---|', ...archs.map((k) => `| ${k} | ${k} | g | r |`), '',
  '## How this backlog works', '', 'Rules.', ''].join('\n');
const rows = (text, heading) => (text.split('\n## ' + heading + '\n')[1] || '').split('\n## ')[0].split('\n').filter((l) => l.startsWith('| [VB-'))
  .map((l) => /VB-\d+/.exec(l)[0]);

const r1 = row('VB-101', 'one', '-', 2), r2 = row('VB-102', 'two', '-', 2), b5 = row('VB-105', 'five', 'beta', 2, '[VB-101](#VB-101)');
const base = backlog({ ready: [r1, r2], blocked: [b5] });

// both sides add ready rows at the end of the table: both kept, by priority then ID
let m = drive('backlog', base, backlog({ ready: [r1, r2, row('VB-110', 'ten', '-', 2)], blocked: [b5] }),
  backlog({ ready: [r1, r2, row('VB-111', 'eleven', '-', 1)], blocked: [b5] }));
expect('rows added on both sides merge clean', m.clean, m.text);
expect('...in the order priority then ID', rows(m.text, 'Ready').join() === 'VB-111,VB-101,VB-102,VB-110', rows(m.text, 'Ready').join());

// one side frees VB-105 (Blocked to Ready, the waits column gone), the other edits VB-102's summary: both kept
m = drive('backlog', base, backlog({ ready: [r1, r2, row('VB-105', 'five', 'beta', 2)] }), backlog({ ready: [r1, row('VB-102', 'two', '-', 2, undefined, 'new words')], blocked: [b5] }));
expect('a row moved on one side and another edited on the other merge clean', m.clean, m.text);
expect('...the moved row sits in its new table', rows(m.text, 'Ready').join() === 'VB-101,VB-102,VB-105' && !rows(m.text, 'Blocked').length, m.text);
expect('...and the edit is kept', m.text.includes('new words'), m.text);

// the same row: priority changed on one side, summary on the other: merged field by field, and re-sorted
m = drive('backlog', base, backlog({ ready: [row('VB-102', 'two', '-', 1), r1], blocked: [b5] }), backlog({ ready: [r1, row('VB-102', 'two', '-', 2, undefined, 'said better')], blocked: [b5] }));
expect('two fields of one row changed on two sides merge clean', m.clean, m.text);
expect('...into one row with both changes, sorted', m.text.includes(row('VB-102', 'two', '-', 1, undefined, 'said better')) && rows(m.text, 'Ready').join() === 'VB-102,VB-101', m.text);

// blocked rows sort by the arch's place in the Archs table, tasks outside every arch last
m = drive('backlog', base, backlog({ ready: [r1, r2], blocked: [b5, row('VB-120', 'x', '-', 1, 'Kim')] }), backlog({ ready: [r1, r2], blocked: [b5, row('VB-121', 'y', 'alpha', 3, 'Kim')] }));
expect('blocked rows come out by arch, priority, ID', m.clean && rows(m.text, 'Blocked').join() === 'VB-121,VB-105,VB-120', m.text);

// what is not mechanical stays a conflict
m = drive('backlog', base, backlog({ ready: [r1, r2, row('VB-130', 'ours', '-', 2)], blocked: [b5] }), backlog({ ready: [r1, r2, row('VB-130', 'theirs', '-', 2)], blocked: [b5] }));
expect('one new ID added differently on both sides is a conflict', !m.clean && m.status === 1 && /^<<<<<<< ours$/m.test(m.text) && m.text.includes('| ours |') && m.text.includes('| theirs |'), m.text);
m = drive('backlog', base, backlog({ ready: [r1, row('VB-102', 'two', '-', 3)], blocked: [b5] }), backlog({ ready: [r1, row('VB-102', 'two', '-', 1)], blocked: [b5] }));
expect('one field changed two ways is a conflict', !m.clean && /^>>>>>>> theirs$/m.test(m.text), m.text);
m = drive('backlog', base, backlog({ ready: [r1], blocked: [b5] }), backlog({ ready: [r1, row('VB-102', 'two', '-', 1)], blocked: [b5] }));
expect('a row removed on one side and changed on the other is a conflict', !m.clean, m.text);
m = drive('backlog', base, backlog({ ready: [r1, r2], blocked: [b5], prose: 'Ours.' }), backlog({ ready: [r1, r2], blocked: [b5], prose: 'Theirs.' }));
expect('prose changed two ways is left to git\'s text merge, a conflict', !m.clean && m.text.includes('Ours.') && m.text.includes('Theirs.'), m.text);

// the archive keeps our order and appends theirs
const archive = (ids) => ['# Backlog archive', '', '## Done tasks', '', '| Task | Name | Arch | Priority | Size | Summary |', '|---|---|---|---|---|---|',
  ...ids.map((id) => `| [${id}](backlog/${id}.md) | n | - | 2 | S | s |`), ''].join('\n');
m = drive('backlog', archive(['VB-109', 'VB-150']), archive(['VB-109', 'VB-150', 'VB-170', 'VB-120']), archive(['VB-109', 'VB-150', 'VB-160']));
expect('rows appended to the archive on both sides: ours in order, then theirs', m.clean && rows(m.text, 'Done tasks').join() === 'VB-109,VB-150,VB-170,VB-120,VB-160', m.text);

// this checkout's own files merged with themselves come out unchanged
for (const f of ['BACKLOG.md', 'BACKLOG_ARCHIVE.md']) {
  const t = fs.readFileSync(path.join(root, f), 'utf8');
  m = drive('backlog', t, t, t);
  expect(`${f} merged with itself is unchanged`, m.clean && m.text === t);
}

// end to end: --install and .gitattributes make `git merge` run the driver
const repo = path.join(tmp, 'repo'), git = (...a) => spawnSync('git', ['-C', repo, ...a], { encoding: 'utf8' });
fs.mkdirSync(path.join(repo, 'tools'), { recursive: true });
for (const f of ['merge.js', 'help.js']) fs.copyFileSync(path.join(root, 'tools', f), path.join(repo, 'tools', f));
fs.copyFileSync(path.join(root, '.gitattributes'), path.join(repo, '.gitattributes'));
fs.writeFileSync(path.join(repo, 'BACKLOG.md'), base);
git('init', '-q', '-b', 'main'); git('config', 'user.email', 't@example.com'); git('config', 'user.name', 't'); git('config', 'commit.gpgsign', 'false');
const inst = spawnSync(process.execPath, ['tools/merge.js', '--install'], { cwd: repo, encoding: 'utf8' });
expect('--install sets the drivers', inst.status === 0 && /merge\.js backlog/.test(git('config', 'merge.vb-backlog.driver').stdout), inst.stdout + inst.stderr);
git('add', '.'); git('commit', '-qm', 'base');
git('checkout', '-qb', 'side');
fs.writeFileSync(path.join(repo, 'BACKLOG.md'), backlog({ ready: [r1, r2, row('VB-111', 'eleven', '-', 2)], blocked: [b5] })); git('commit', '-qam', 'side');
git('checkout', '-q', 'main');
fs.writeFileSync(path.join(repo, 'BACKLOG.md'), backlog({ ready: [r1, r2, row('VB-110', 'ten', '-', 2)], blocked: [b5] })); git('commit', '-qam', 'main');
const merged = git('merge', '-q', '--no-edit', 'side');
expect('git merge runs the driver: rows added on both sides merge clean', merged.status === 0
  && rows(fs.readFileSync(path.join(repo, 'BACKLOG.md'), 'utf8'), 'Ready').join() === 'VB-101,VB-102,VB-110,VB-111', merged.stdout + merged.stderr);

fs.rmSync(tmp, { recursive: true, force: true });
if (errors.length) { console.log('MERGE FAIL:\n  ' + errors.join('\n  ')); process.exit(1); }
console.log('merge: the backlog driver merges rows by ID and field, keeps the non-mechanical conflicts, and runs under git merge');
