// tools/merge.js, the merge drivers (VB-1620), on constructed three-way cases: the backlog's task rows merge by ID and field and come out
// in the backlog's order; JSON merges by key and element and keeps the file's layout; a JavaScript file's imports, exports and marked
// tables merge by name when every conflict lies in them; what is not mechanical (a row changed both ways, an ID taken twice, a row removed on one side and changed on
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

// ---- json: objects by key, arrays by element, the file's own layout, a recorded measurement keeps the incoming side's value
const J = (v) => JSON.stringify(v, null, 2) + '\n';
const driveJ = (o, a, b, name = 'src/x.json') => {
  const f = (n, s) => { const p = path.join(tmp, n); fs.writeFileSync(p, s); return p; };
  const [po, pa, pb] = [f('o', o), f('a', a), f('b', b)];
  const r = spawnSync(process.execPath, [tool, 'json', po, pa, pb, name], { encoding: 'utf8' });
  return { clean: r.status === 0, text: fs.readFileSync(pa, 'utf8'), err: r.stderr };
};
m = driveJ(J(['a', 'b', 'c']), J(['a', 'b', 'x', 'c']), J(['a', 'b', 'y', 'c']));
expect('json: elements added at one place on both sides: ours, then theirs', m.clean && m.text === J(['a', 'b', 'x', 'y', 'c']), m.text + m.err);
m = driveJ(J(['a', 'b', 'c']), J(['a', 'c']), J(['a', 'b', 'c', 'z']));
expect('json: an element removed on one side, one added on the other', m.clean && m.text === J(['a', 'c', 'z']), m.text + m.err);
m = driveJ(J(['a', 'b', 'c']), J(['b', 'a', 'c']), J(['a', 'b', 'c', 'z']));
expect('json: a reordered array is a conflict', !m.clean && /^<<<<<<< /m.test(m.text), m.text);
m = driveJ(J({ k: 1, l: 2 }), J({ k: 1, l: 2, m: 3 }), J({ k: 1, l: 2, n: 4 }));
expect('json: keys added on both sides', m.clean && m.text === J({ k: 1, l: 2, m: 3, n: 4 }), m.text + m.err);
m = driveJ(J({ k: 1, l: 2 }), J({ k: 5, l: 2 }), J({ k: 6, l: 2 }));
expect('json: a value changed two ways is a conflict', !m.clean, m.text);
m = driveJ(J({ k: 1, l: 2 }), J({ k: 5, l: 2 }), J({ l: 2 }));
expect('json: a key removed on one side and changed on the other is a conflict', !m.clean, m.text);
m = driveJ(J({ k: 1, l: 2 }), J({ k: 5, l: 2, m: 0 }), J({ k: 6, l: 3 }), 'tests/counters.json');
expect('json: counters.json keeps the incoming value of a counter re-recorded on both sides', m.clean && m.text === J({ k: 6, l: 3, m: 0 }), m.text + m.err);
const owners = (extra) => `{\n  "fields": {\n    "st.a": {"owner": "sim/a", "category": "cache"},\n${extra}    "st.b": "signal"\n  }\n}\n`;
m = driveJ(owners(''), owners('    "st.c": {"owner": "sim/c", "category": "cache"},\n'), owners('    "st.d": "signal",\n'), 'src/owners.json');
expect('json: the file\'s own layout is kept (owners.json, inline objects without bracket spacing)',
  m.clean && m.text === owners('    "st.c": {"owner": "sim/c", "category": "cache"},\n    "st.d": "signal",\n'), m.text + m.err);
for (const f of ['src/owners.json', 'src/layers.json', 'src/page.json', 'src/manifest.json', 'tests/counters.json']) {
  const t = fs.readFileSync(path.join(root, f), 'utf8');
  m = driveJ(t, t, t, f);
  expect(`json: ${f} merged with itself is unchanged`, m.clean && m.text === t, m.err);
}

// ---- js: imports, exports and marked tables merge by name; anything else stays a conflict
const mod = ({ rec = 'age', crops = null, exp = 'a, b', body = '  const a = 1;\n  const b = 2;\n' }) => [
  "// @sys sim/x: a module", "VB['sim/x'] = (() => {", `  const { living, ${rec} } = VB['sim/records'];`, "  const { WORK } = VB['sim/rules'];",
  ...(crops ? [`  const { ${crops} } = VB['sim/crops'];`] : []), '', body.replace(/\n$/, ''), `  return { ${exp} };`, '})();', ''].join('\n');
const driveS = (o, a, b, name = 'src/sim/x.js') => {
  const f = (n, s) => { const p = path.join(tmp, n); fs.writeFileSync(p, s); return p; };
  const [po, pa, pb] = [f('o', o), f('a', a), f('b', b)];
  const r = spawnSync(process.execPath, [tool, 'js', po, pa, pb, name], { encoding: 'utf8', cwd: tmp });
  return { clean: r.status === 0, text: fs.readFileSync(pa, 'utf8'), err: r.stderr };
};
const body3 = '  const a = 1;\n  const b = 2;\n  const c = 3;\n';
m = driveS(mod({}), mod({ rec: 'age, spouseOf', exp: 'a, b, c', body: body3 }), mod({ rec: 'age, home', exp: 'a, b, d', body: '  const a = 1;\n  const b = 2;\n  const d = 4;\n' }));
expect('js: a body line added at one place on both sides stays a conflict', !m.clean, m.text);
m = driveS(mod({ body: body3 }), mod({ rec: 'age, spouseOf', crops: 'farmable', body: body3 }), mod({ rec: 'age, home', crops: 'fertility', body: body3 }));
expect('js: names added to one import on both sides merge', m.clean && m.text.includes('const { living, age, spouseOf, home } = VB[\'sim/records\'];')
  && m.text.includes("const { farmable, fertility } = VB['sim/crops'];"), m.text + m.err);
m = driveS(mod({ body: body3, exp: 'a, b' }), mod({ body: body3, exp: 'a, b, c' }), mod({ body: body3, exp: 'b, c' }));
expect('js: export lists changed on both sides merge', m.clean && m.text.includes('return { b, c };'), m.text + m.err);
m = driveS(mod({}), mod({ rec: 'age, spouseOf' }), mod({ rec: 'home' }));
expect('js: a name removed on one side and others added on the other', m.clean && m.text.includes("const { living, spouseOf, home } = VB['sim/records'];"), m.text + m.err);
const table = (rows, before = '') => `const A = 1;\n${before}// @merge union: test\nconst T = {\n${rows.map(([k, v]) => `  ${k}: ${v},\n`).join('')}};\nconst Z = 2;\n`;
m = driveS(table([['x', 1], ['y', 2]]), table([['x', 1], ['y', 2], ['p', 3]]), table([['x', 1], ['y', 2], ['q', 4]]), 'tools/t.js');
expect('js: a marked table: entries added on both sides merge, ours first', m.clean && m.text === table([['x', 1], ['y', 2], ['p', 3], ['q', 4]]), m.text + m.err);
m = driveS(table([['x', 1], ['y', 2]]), table([['x', 1], ['y', 2], ['p', 3]]), table([['x', 1], ['y', 2], ['p', 4]]), 'tools/t.js');
expect('js: one key added to a marked table with two values is a conflict', !m.clean, m.text);
m = driveS(table([['x', 1], ['y', 2]]), table([['x', 1], ['y', 2], ['p', 3]]), table([['x', 1], ['y', 2], ['q', 4]]).replace('// @merge union: test\n', ''), 'tools/t.js');
expect('js: a table marked on one side only is left to the text merge', !m.clean, m.text);
m = driveS(table([['x', 1], ['y', 2]]).replace('// @merge', '// a word\n// @merge'), table([['x', 1], ['y', 2], ['p', 3]]).replace('// @merge', '// ours\n// @merge'),
  table([['x', 1], ['y', 2], ['q', 4]]).replace('// @merge', '// theirs\n// @merge'), 'tools/t.js');
expect('js: a conflict outside the table leaves the whole file to the text merge', !m.clean && m.text.includes('// ours') && m.text.includes('// theirs'), m.text);
for (const f of ['src/page/icons.js', 'tests/suites.js', 'tools/sim.js', 'tools/perf.js', 'src/sim/jobs.js', 'src/sim/clock.js']) {
  const t = fs.readFileSync(path.join(root, f), 'utf8');
  m = driveS(t, t, t, f);
  expect(`js: ${f} merged with itself is unchanged`, m.clean && m.text === t, m.err);
}

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
console.log('merge: backlog rows by ID and field, JSON by key and element, JavaScript imports, exports and marked tables by name; the rest kept; runs under git merge');
