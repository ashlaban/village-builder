// tools/sim.js: the yearly table prints, and --json --report households parses with one entry per household.
const cp = require('child_process'), path = require('path');
const tool = path.join(__dirname, '..', 'tools', 'sim.js'), VB = require('../src/load.js');
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('TOOLS FAIL:', m); } };
const run = (...a) => cp.execFileSync('node', [tool, '--scenario', 'founders', '--seed', '7', '--map', 'tiny', ...a], { encoding: 'utf8' });
const table = run('--years', '1');
check(/^\s+1\s+\d+/m.test(table), 'no line for year 1');
const rows = JSON.parse(run('--years', '1', '--json', '--report', 'households'));
const it = VB.gen.generate(7, { cols: 120, rows: 85 }); let r; while (!(r = it.next()).done);
check(Array.isArray(rows) && rows.length === VB.sim.seed(r.value, 7, 'founders').households.length, `households report has ${rows.length} entries`);
check(rows.every((h) => typeof h.grain === 'number'), 'household entries lack grain');
const idle = JSON.parse(cp.execFileSync('node', [tool, '--scenario', 'founders', '--seed', '7', '--map', 'tiny', '--years', '1', '--report', 'idle', '--json'], { encoding: 'utf8' }));
for (const [role, bs] of Object.entries(idle.hoursShare)) for (const [season, v] of Object.entries(bs)) {
  const sum = v.working + v.walking + v.carrying + v.idle;
  check(Math.abs(sum - 100) < 0.5, `idle shares of ${role} in ${season} sum to ${sum}`);
}
check(Object.keys(idle.hoursShare).length > 0, 'idle report has no roles');
const paths = JSON.parse(cp.execFileSync('node', [tool, '--scenario', 'populous', '--seed', '7', '--map', 'tiny', '--years', '0', '--report', 'paths', '--json'], { encoding: 'utf8' }));
check(paths[0].village === 'all' && paths[0].trodden + paths[0].path > 0 && paths.length > 1, 'paths report: no worn-in paths on a populous map');
// tools/balance.js (VB-048): food made by source against need, per household-year; made is the sum of the sources
const bal = JSON.parse(cp.execFileSync('node', [path.join(__dirname, '..', 'tools', 'balance.js'), '--scenario', 'populous', '--seeds', '7', '--map', 'tiny',
  '--years', '2', '--from', '1', '--json'], { encoding: 'utf8' }));
check(bal.rows.length > 0 && bal.bySize.length > 0 && bal.byWeather.length > 0, 'balance report is empty');
check(bal.rows.every((x) => Math.abs(x.grain + x.milk + x.butter + x.meat - x.total) < 0.2 && x.need > 0), 'balance rows: sources do not add up');
check(bal.rows.some((x) => x.milk > 0) && bal.rows.some((x) => x.grain > 0), 'balance rows: no grain or no milk in two years');
if (failed) process.exit(1);
console.log(`tools ok: ${rows.length} households; balance: ${bal.rows.length} household-years`);
