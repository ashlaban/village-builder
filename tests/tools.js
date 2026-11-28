// @suite integration
// @suite extended --extended
// tools/sim.js: the yearly table prints, and --json --report households parses with one entry per household; its reports and tools/balance.js.
// On the probe map, the 36 by 26 island of tests/lib/probe.js (VB-856; the tiny map, 120 by 85, before). Verify runs the tool three times:
// a year of founders with the idle report as text, saved; the households report from that save; populous's worn-in paths. --extended, at
// night: the reports that take a run of their own each (idle as JSON, hunger, perf and a run without it, counts) and tools/balance.js.
const cp = require('child_process'), path = require('path'), os = require('os'), fs = require('fs');
const tool = path.join(__dirname, '..', 'tools', 'sim.js'), VB = require('../src/load.js'), EXT = process.argv.includes('--extended');
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('TOOLS FAIL:', m); } };
const run = (...a) => cp.execFileSync('node', [tool, '--scenario', 'founders', '--seed', '7', '--map', 'probe', ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const save = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'vb-tools-')), 'founders-y1.json');
const table = run('--years', '1', '--report', 'idle', '--save', save);
check(/^\s+1\s+\d+/m.test(table), 'no line for year 1');
// the idle report as text: each role's share of work hours in each season sums to 100
const shares = [...table.matchAll(/^ {2}(\S+)\s+(\S+)\s+([\d.]+) \/ ([\d.]+) \/ ([\d.]+) \/ ([\d.]+)$/gm)];
check(shares.length > 0 && /share of work hours/.test(table), 'idle report: no shares of work hours');
for (const m of shares) { const sum = +m[3] + +m[4] + +m[5] + +m[6]; check(Math.abs(sum - 100) < 0.5, `idle shares of ${m[1]} in ${m[2]} sum to ${sum}`); }
const rows = JSON.parse(run('--load', save, '--years', '0', '--json', '--report', 'households'));
fs.rmSync(path.dirname(save), { recursive: true, force: true });
check(Array.isArray(rows) && rows.length >= require('./lib/probe.js').scenario('founders', 7).households.length, `households report has ${rows.length} entries`);
check(rows.every((h) => typeof h.grain === 'number'), 'household entries lack grain');
const paths = JSON.parse(cp.execFileSync('node', [tool, '--scenario', 'populous', '--seed', '7', '--map', 'probe', '--years', '0', '--report', 'paths', '--json'], { encoding: 'utf8' }));
check(paths[0].village === 'all' && paths[0].trodden + paths[0].path > 0 && paths.length > 1, 'paths report: no worn-in paths on a populous map');
if (!EXT) {
  if (failed) process.exit(1);
  console.log(`tools ok: ${rows.length} households, ${shares.length} shares of work hours, ${paths.length - 1} villages' paths`);
  process.exit(0);
}
const idle = JSON.parse(cp.execFileSync('node', [tool, '--scenario', 'founders', '--seed', '7', '--map', 'probe', '--years', '1', '--report', 'idle', '--json'], { encoding: 'utf8' }));
for (const [role, bs] of Object.entries(idle.hoursShare)) for (const [season, v] of Object.entries(bs)) {
  const sum = v.working + v.walking + v.carrying + v.idle;
  check(Math.abs(sum - 100) < 0.5, `idle shares of ${role} in ${season} sum to ${sum}`);
}
check(Object.keys(idle.hoursShare).length > 0, 'idle report has no roles');
// VB-122: waits are measured per free spell and never negative; switches are counted per pawn per year
const waitRows = Object.values(idle.waitHours);
check(waitRows.length > 0 && waitRows.every((x) => x.n > 0 && x.median >= 0 && x.p90 >= x.median), 'idle report: waits missing, negative or out of order');
check(typeof idle.switchesPerPawnYear.other === 'number' && idle.switchesPerPawnYear.other >= 0 && idle.switchesPerPawnYear.cookCall >= 0, 'idle report: no switches counted');
// VB-128: the hunger report prints its summary, with grain quartiles in order
const hun = JSON.parse(cp.execFileSync('node', [tool, '--scenario', 'populous', '--seed', '7', '--map', 'probe', '--years', '2', '--report', 'hunger', '--json'], { encoding: 'utf8' }));
const gq = hun.summary.grainQuartiles;
check(Array.isArray(hun.households) && hun.summary.households > 0 && hun.summary.year === 2, 'hunger report: no summary');
check(gq.min <= gq.q1 && gq.q1 <= gq.median && gq.median <= gq.q3 && gq.q3 <= gq.max, 'hunger report: grain quartiles out of order');
check(hun.households.every((x) => x.hungryDays > 30 && x.spring + x.summer + x.autumn + x.winter === x.hungryDays), 'hunger report: season days do not add up');
const hunText = cp.execFileSync('node', [tool, '--scenario', 'populous', '--seed', '7', '--map', 'probe', '--years', '1', '--report', 'hunger'], { encoding: 'utf8' });
check(/summary:/.test(hunText) && /grainQuartiles/.test(hunText), 'hunger report: text output has no summary');
// VB-143: the perf report lists the systems with shares adding up to 100, and does not change the run (the yearly lines match, apart from ms/day)
const pa = ['--scenario', 'populous', '--seed', '7', '--map', 'probe', '--years', '1'];
const perf = JSON.parse(cp.execFileSync('node', [tool, ...pa, '--report', 'perf', '--json'], { encoding: 'utf8' }));
check(perf.systems.length >= 10 && Math.abs(perf.systems.reduce((a, x) => a + x.share, 0) - 100) < 1, 'perf report: shares do not add up');
check(perf.systems.some((x) => x.system.startsWith('agents') && x.ms > 0), 'perf report: no row for agents and walking');
const yearly = (...a) => cp.execFileSync('node', [tool, ...pa, ...a], { encoding: 'utf8' }).split('\n').filter((l) => /^\s+1\s+\d+/.test(l)).map((l) => l.replace(/\s+[\d.]+$/, ''));
const plainYear = yearly();
check(yearly('--report', 'perf').join() === plainYear.join() && plainYear.length === 1, 'perf report: the run differs from one without it');
// tools/balance.js (VB-048): food made by source against need, per household-year; made is the sum of the sources
const bal = JSON.parse(cp.execFileSync('node', [path.join(__dirname, '..', 'tools', 'balance.js'), '--scenario', 'populous', '--seeds', '7', '--map', 'probe',
  '--years', '2', '--from', '1', '--json'], { encoding: 'utf8' }));
check(bal.rows.length > 0 && bal.bySize.length > 0 && bal.byWeather.length > 0, 'balance report is empty');
check(bal.rows.every((x) => Math.abs(x.grain + x.milk + x.butter + x.meat - x.total) < 0.2 && x.need > 0), 'balance rows: sources do not add up');
check(bal.rows.some((x) => x.milk > 0) && bal.rows.some((x) => x.grain > 0), 'balance rows: no grain or no milk in two years');
// VB-172/174/175: the writes map's owners are asserted in tests/dependencies.js, on its build (VB-856)
// unresolved writes: a baseline checked by tests/ownership.js (VB-243)
const counts = JSON.parse(run('--years', '1', '--report', 'counts', '--json'));
check(counts.length === Object.keys(VB.COUNTERS).length && counts.every((r) =>
  r.total >= 0 && Number.isFinite(r.perDay) && Number.isFinite(r.perLivingPawnDay)), 'counts report invalid');
check(counts.find((r) => r.counter === 'walkStep').perDay > 0, 'counts report has no work');

if (failed) process.exit(1);
console.log(`tools ok: ${rows.length} households; balance: ${bal.rows.length} household-years`);
