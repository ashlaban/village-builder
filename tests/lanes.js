// @suite integration
// tools/lanes.js (VB-1678) in a scratch repository with an origin: tasks that edit different functions of one module run side by side,
// one that edits a function already taken is held back, as is one that meets a branch pushed and not merged, or a claim in the inbox;
// a task with no footprint falls back to the rule of archs, a plan runs alone, a table marked `// @merge union` is no footprint;
// --check names what a task meets; --measure compares a footprint with the edits; inbox.js claim clashes at function level.
const fs = require('fs'), os = require('os'), path = require('path'), { spawnSync } = require('child_process');
const root = path.join(__dirname, '..'), errors = [];
const expect = (what, cond, out) => { if (!cond) errors.push(what + (out ? '\n    ' + String(out).trim().split('\n').join('\n    ') : '')); };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vb-lanes-')), repo = path.join(tmp, 'repo'), origin = path.join(tmp, 'origin.git');
const git = (...a) => spawnSync('git', ['-C', repo, ...a], { encoding: 'utf8' });
const node = (...a) => spawnSync(process.execPath, a, { cwd: repo, encoding: 'utf8' });
const write = (f, s) => { fs.mkdirSync(path.dirname(path.join(repo, f)), { recursive: true }); fs.writeFileSync(path.join(repo, f), s); };
const out = (r) => r.stdout + r.stderr;

fs.cpSync(path.join(root, 'tools'), path.join(repo, 'tools'), { recursive: true });
const mod = (key, body) => `// @sys ${key}: a test module\nVB['${key}'] = (() => {\n  const { DAY } = VB['sim/rules'];\n${body}  return {};\n})();\n`;
write('src/sim/a.js', mod('sim/a', '  function f1() {\n    return 1;\n  }\n  function f2() {\n    return 2;\n  }\n'));
write('src/sim/b.js', mod('sim/b', '  // @merge union: test\n  const T = {\n    x: 1,\n  };\n  function g1() {\n    return 1;\n  }\n'));
const task = (id, name, touches, more = '') => write(`backlog/${id}.md`,
  `# ${id}: ${name}\nStatus: ready\nPriority: ${more.includes('P2') ? 2 : 1}\nSize: S\n${more.includes('arch') ? 'Arch: x\nPhase: implement\n' : ''}`
  + `Design ref: none\n${touches ? `Touches: ${touches}\n` : ''}Goal: g\nAcceptance criteria:\n- [ ] c\n`);
task('VB-101', 'One', 'sim/a (f1)');
task('VB-102', 'Two', 'sim/a (f2)');
task('VB-103', 'Three', 'sim/a (f1); sim/b (g1)');
task('VB-104', 'Four', 'unknown (an investigation)', 'arch');
task('VB-105', 'Plan: five', 'unknown (a plan)');
task('VB-106', 'Six', 'sim/b (g1)', 'P2');
task('VB-107', 'Seven', 'sim/b (T); tests/counters.json', 'P2');
task('VB-108', 'Eight', 'unknown (an investigation)', 'P2 arch');
// the tables tools/backlog.js reads (lanes takes its candidates from `backlog.js next`)
const ids = [['VB-101', 'One', 1], ['VB-102', 'Two', 1], ['VB-103', 'Three', 1], ['VB-104', 'Four', 1], ['VB-105', 'Plan: five', 1], ['VB-106', 'Six', 2], ['VB-107', 'Seven', 2], ['VB-108', 'Eight', 2]];
const table = (h, n) => `| ${h.join(' | ')} |\n|${'---|'.repeat(n)}`;
write('BACKLOG.md', ['# Backlog', '', '## Ready', '', table(['Task', 'Name', 'Arch', 'Priority', 'Size', 'Summary'], 6),
  ...ids.map(([id, name, p]) => `| [${id}](backlog/${id}.md)<a id="${id}"></a> | ${name} | ${['VB-104', 'VB-108'].includes(id) ? 'x' : '-'} | ${p} | S | s |`), '',
  '## Waiting for Kim', '', table(['Task', 'Name', 'Arch', 'Priority', 'Size', 'Summary'], 6), '',
  '## Blocked', '', table(['Task', 'Name', 'Arch', 'Priority', 'Size', 'Waits for', 'Summary'], 7), '',
  '## Archs', '', table(['Key', 'Arch', 'Goal', 'Design ref'], 4), '| x | X | g | r |', '', '## How this backlog works', '', 'Rules.', ''].join('\n'));
write('BACKLOG_ARCHIVE.md', ['# Backlog archive', '', '## Closed archs', '', table(['Key', 'Arch', 'Goal', 'Design ref'], 4), '',
  '## Done tasks', '', table(['Task', 'Name', 'Arch', 'Priority', 'Size', 'Summary'], 6), ''].join('\n'));
spawnSync('git', ['init', '-q', '--bare', origin]);
git('init', '-q', '-b', 'main'); git('config', 'user.email', 't@example.com'); git('config', 'user.name', 't'); git('config', 'commit.gpgsign', 'false');
git('add', '.'); git('commit', '-qm', 'base'); git('remote', 'add', 'origin', origin); git('push', '-q', 'origin', 'main');
// a branch in flight: it edits sim/b's g1 and its marked table T, and is pushed, not merged
git('checkout', '-qb', 'claude/flight');
write('src/sim/b.js', fs.readFileSync(path.join(repo, 'src/sim/b.js'), 'utf8').replace('    x: 1,\n', '    x: 1,\n    y: 2,\n').replace('return 1;', 'return 11;'));
git('commit', '-qam', 'flight'); git('push', '-q', 'origin', 'claude/flight'); git('checkout', '-q', 'main');
// a branch that is not an agent's: not in flight (F5 of the review)
git('checkout', '-qb', 'other/x');
write('src/sim/b.js', fs.readFileSync(path.join(repo, 'src/sim/b.js'), 'utf8').replace('return 1;', 'return 12;'));
git('commit', '-qam', 'other'); git('push', '-q', 'origin', 'other/x'); git('checkout', '-q', 'main'); git('fetch', '-q', 'origin');

let r = node('tools/lanes.js', '4');
const lines = out(r);
expect('two tasks on different functions of one module are taken side by side', /take VB-101/.test(lines) && /take VB-102/.test(lines), lines);
expect('a task on a function already taken is held, naming it', /hold VB-103: meets VB-101 at src\/sim\/a\.js \(f1\)/.test(lines), lines);
expect('a task with no footprint runs beside a task of another arch', /take VB-104/.test(lines), lines);
expect('only the agents\' branches are in flight', !/other\/x/.test(lines), lines);
expect('a plan runs alone', /hold VB-105: a plan or a wrap-up runs alone/.test(lines), lines);
expect('a task that meets a branch in flight is held', /hold VB-106: meets origin\/claude\/flight at src\/sim\/b\.js \(g1\)/.test(lines), lines);
expect('a marked table and a list file are no footprint', /take VB-107/.test(lines), lines);
r = node('tools/lanes.js', '--check', 'VB-106');
expect('--check names the branch a task meets, exit 1', r.status === 1 && /meets origin\/claude\/flight: src\/sim\/b\.js \(g1\)/.test(out(r)), out(r));
r = node('tools/lanes.js', '--check', 'VB-102');
expect('--check: nothing in flight meets a free task, exit 0', r.status === 0 && /nothing in flight meets it/.test(out(r)), out(r));

// the inbox: claims at function level, and lanes reads them
node('tools/inbox.js', 'init');
r = node('tools/inbox.js', 'claim', 'VB-200', 'sim/a:f2');
expect('a function is claimed', r.status === 0 && /src\/sim\/a\.js:f2/.test(out(r)), out(r));
r = node('tools/inbox.js', 'claim', 'VB-201', 'sim/a:f1');
expect('another function of the same file does not clash', r.status === 0, out(r));
r = node('tools/inbox.js', 'claim', 'VB-202', 'src/sim/a.js');
expect('the whole file clashes with a function of it', r.status === 1 && /src\/sim\/a\.js:f2 is also being edited by VB-200/.test(out(r)), out(r));
r = node('tools/lanes.js', '4', '--no-flight');
expect('a task that meets an inbox claim is held', /hold VB-102: meets VB-200 \(running, in the inbox\) at src\/sim\/a\.js \(f2\)/.test(out(r)), out(r));
node('tools/inbox.js', 'start', 'VB-101', '0');
r = node('tools/lanes.js', '4', '--no-flight');
expect('a task the inbox started is in flight by its Touches line, and not offered again', !/take VB-101/.test(out(r))
  && /hold VB-103: meets VB-101 \(running, in the inbox\) at src\/sim\/a\.js \(f1\)/.test(out(r)), out(r));
expect('a plan is held while tasks run', /hold VB-105: a plan or a wrap-up runs alone \(\d+ running/.test(out(r)), out(r));
node('tools/inbox.js', 'start', 'VB-108', '0');
r = node('tools/lanes.js', '4', '--no-flight');
expect('a task with no footprint is held beside a running task of its arch', /hold VB-104: meets VB-108 \(running, in the inbox\), of its arch/.test(out(r)), out(r));
node('tools/inbox.js', 'start', 'VB-105', '0');
r = node('tools/lanes.js', '4', '--no-flight');
expect('while a plan runs, nothing is taken', /VB-105 is running, a plan or a wrap-up/.test(out(r)) && !/^take /m.test(out(r)), out(r));

// measure: the declared footprint against the edits
const base = git('rev-parse', 'HEAD').stdout.trim();
write('src/sim/a.js', fs.readFileSync(path.join(repo, 'src/sim/a.js'), 'utf8').replace('return 1;', 'return 10;').replace('return 2;', 'return 20;'));
git('commit', '-qam', 'VB-101');
r = node('tools/lanes.js', '--measure', 'VB-101', `${base}..HEAD`, '--inbox');
expect('--measure: recall and precision, and what was edited but not declared', r.status === 0 && /declared 1, edited 2; recall 0\.5, precision 1/.test(out(r))
  && /edited, not declared: src\/sim\/a\.js \(f2\)/.test(out(r)), out(r));
// two branches from one base, merged in turn without update: the second's merge is measured on its own edits (F4 of the review)
const b0 = git('rev-parse', 'HEAD').stdout.trim(), edit = (from, to) => write('src/sim/a.js', fs.readFileSync(path.join(repo, 'src/sim/a.js'), 'utf8').replace(from, to));
git('checkout', '-qb', 't1'); edit('return 20;', 'return 21;'); git('commit', '-qam', 't1');
git('checkout', '-q', b0); git('checkout', '-qb', 't2'); edit('return 10;', 'return 11;'); git('commit', '-qam', 't2');
git('checkout', '-q', 'main'); git('merge', '-q', '--no-ff', '--no-edit', 't1'); git('merge', '-q', '--no-ff', '--no-edit', 't2');
r = node('tools/lanes.js', '--measure', 'VB-101', 'HEAD^1..HEAD^2');
expect('a merge is measured on its own edits, not those merged before it', /declared 1, edited 1; recall 1, precision 1/.test(out(r)), out(r));
r = node('tools/inbox.js', 'report');
expect('the night\'s report totals the footprints', /Footprints, declared against edited/.test(out(r)) && /VB-101: recall 0\.5, precision 1/.test(out(r)), out(r));

fs.rmSync(tmp, { recursive: true, force: true });
if (errors.length) { console.log('LANES FAIL:\n  ' + errors.join('\n  ')); process.exit(1); }
console.log('lanes: side by side by function, held by a task taken, a branch in flight or a claim; plans alone; check, measure and claims');
