// tests/lib/targets.js and tools/targets.js: residual signs for max, min and range, status in/out/noise, no throw for a value out,
// --record appends commit/dirty/date/machine, the runner's parser reads the printed lines, and the reader prints the latest value and
// the last five and writes the table, all on a temporary copy.
const fs = require('fs'), os = require('os'), path = require('path'), { spawnSync } = require('child_process');
const root = path.join(__dirname, '..'), errors = [];
const expect = (what, cond, out) => { if (!cond) errors.push(what + (out ? '\n    ' + String(out).trim().split('\n').join('\n    ') : '')); };
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vb-targets-')), jsonl = path.join(dir, 'targets.jsonl'), md = path.join(dir, 'targets.md');
const T = require('./lib/targets.js');
process.env.VB_TARGETS_FILE = jsonl;
const log = console.log, lines = [];
console.log = (s) => lines.push(s);
const a = T.target('t/max', { dir: 'max', target: 10, measured: 12.5, unit: ' ms' });
const b = T.target('t/min', { dir: 'min', target: 5, measured: 7 });
const c = T.target('t/range', { dir: 'range', target: [1, 3], measured: 0.5, noise: { kind: 'seeds', spread: 0.6, n: 4 } });
const d = T.target('t/nan', { dir: 'max', target: 1, measured: NaN });
console.log = log;
expect('max: residual positive when over, out', a.residual === 2.5 && a.status === 'out', JSON.stringify(a));
expect('min: in, residual 0', b.residual === 0 && b.status === 'in', JSON.stringify(b));
expect('range: within noise', c.residual === 0.5 && c.status === 'noise', JSON.stringify(c));
expect('NaN is out and does not throw', d.status === 'out', JSON.stringify(d));
expect('no file without --record', !fs.existsSync(jsonl));
expect('printed line', lines[0] === 'TARGET t/max 12.5 ms 10 ms +2.5 out', lines[0]);
const parsed = T.parse(lines.join('\n'));
expect('parse reads the lines', parsed.length === 4 && parsed[0].name === 't/max' && parsed[0].residual === 2.5 && parsed[2].status === 'noise', JSON.stringify(parsed));

const script = `const T = require(${JSON.stringify(path.join(__dirname, 'lib/targets.js'))});
  for (const m of [4, 5, 6, 7, 8, 9, 12]) T.target('r/x', { where: 'small seeds 3,7', dir: 'max', target: 10, measured: m });`;
const rec = spawnSync(process.execPath, ['-e', script, '--', '--record'], { encoding: 'utf8', env: { ...process.env, VB_TARGETS_FILE: jsonl } });
const rows = fs.existsSync(jsonl) ? fs.readFileSync(jsonl, 'utf8').trim().split('\n').map((l) => JSON.parse(l)) : [];
expect('--record appends one line per call', rec.status === 0 && rows.length === 7, rec.stderr);
expect('record carries commit, dirty, date, machine', rows[0] && rows[0].commit && typeof rows[0].dirty === 'boolean' && rows[0].date && rows[0].machine, JSON.stringify(rows[0]));

const tool = path.join(root, 'tools/targets.js');
const rd = spawnSync(process.execPath, [tool, '--file', jsonl, '--md', md, '--name', 'r/'], { encoding: 'utf8' });
expect('reader shows the latest value, residual and last five', rd.status === 0 && /\| r\/x \|.*\| 12 \| 10 \| \+2 \| out \|/.test(rd.stdout), rd.stdout + rd.stderr);
expect('reader shows exactly the last five', /\| 6, 7, 8, 9, 12 \|/.test(rd.stdout), rd.stdout);
expect('reader writes the table', fs.existsSync(md) && /1 targets: 0 in, 1 out/.test(fs.readFileSync(md, 'utf8')));
const none = spawnSync(process.execPath, [tool, '--file', jsonl, '--no-md', '--since', '2999-01-01'], { encoding: 'utf8' });
expect('--since filters', none.status === 0 && /0 targets/.test(none.stdout), none.stdout);
const h = spawnSync(process.execPath, [tool, '--help'], { encoding: 'utf8' });
expect('--help prints usage', h.status === 0 && /Usage: node tools\/targets.js/.test(h.stdout), h.stdout);
fs.rmSync(dir, { recursive: true, force: true });
if (errors.length) { console.log('FAIL targets-tool:\n  ' + errors.join('\n  ')); process.exit(1); }
console.log('targets-tool: ok');
