// tools/sim.js: the yearly table prints, and --json --report households parses with one entry per household.
const cp = require('child_process'), path = require('path');
const tool = path.join(__dirname, '..', 'tools', 'sim.js'), VB = require('../src/load.js');
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('TOOLS FAIL:', m); } };
const run = (...a) => cp.execFileSync('node', [tool, '--scenario', 'founders', '--seed', '7', '--map', 'tiny', ...a], { encoding: 'utf8' });
const table = run('--years', '1');
check(/^\s+1\s+\d+/m.test(table), 'no line for year 1');
const rows = JSON.parse(run('--years', '1', '--json', '--report', 'households'));
const it = VB.gen.generate(7, { cols: 120, rows: 85 }); let r; while (!(r = it.next()).done);
check(Array.isArray(rows) && rows.length >= VB.sim.seed(r.value, 7, 'founders').households.length, `households report has ${rows.length} entries`);
check(rows.every((h) => typeof h.grain === 'number'), 'household entries lack grain');
const idle = JSON.parse(cp.execFileSync('node', [tool, '--scenario', 'founders', '--seed', '7', '--map', 'tiny', '--years', '1', '--report', 'idle', '--json'], { encoding: 'utf8' }));
for (const [role, bs] of Object.entries(idle.hoursShare)) for (const [season, v] of Object.entries(bs)) {
  const sum = v.working + v.walking + v.carrying + v.idle;
  check(Math.abs(sum - 100) < 0.5, `idle shares of ${role} in ${season} sum to ${sum}`);
}
check(Object.keys(idle.hoursShare).length > 0, 'idle report has no roles');
// VB-122: waits are measured per free spell and never negative; switches are counted per pawn per year
const waitRows = Object.values(idle.waitHours);
check(waitRows.length > 0 && waitRows.every((x) => x.n > 0 && x.median >= 0 && x.p90 >= x.median), 'idle report: waits missing, negative or out of order');
check(typeof idle.switchesPerPawnYear.other === 'number' && idle.switchesPerPawnYear.other >= 0 && idle.switchesPerPawnYear.cookCall >= 0, 'idle report: no switches counted');
const paths = JSON.parse(cp.execFileSync('node', [tool, '--scenario', 'populous', '--seed', '7', '--map', 'tiny', '--years', '0', '--report', 'paths', '--json'], { encoding: 'utf8' }));
check(paths[0].village === 'all' && paths[0].trodden + paths[0].path > 0 && paths.length > 1, 'paths report: no worn-in paths on a populous map');
// VB-128: the hunger report prints its summary, with grain quartiles in order
const hun = JSON.parse(cp.execFileSync('node', [tool, '--scenario', 'populous', '--seed', '7', '--map', 'tiny', '--years', '2', '--report', 'hunger', '--json'], { encoding: 'utf8' }));
const gq = hun.summary.grainQuartiles;
check(Array.isArray(hun.households) && hun.summary.households > 0 && hun.summary.year === 2, 'hunger report: no summary');
check(gq.min <= gq.q1 && gq.q1 <= gq.median && gq.median <= gq.q3 && gq.q3 <= gq.max, 'hunger report: grain quartiles out of order');
check(hun.households.every((x) => x.hungryDays > 30 && x.spring + x.summer + x.autumn + x.winter === x.hungryDays), 'hunger report: season days do not add up');
const hunText = cp.execFileSync('node', [tool, '--scenario', 'populous', '--seed', '7', '--map', 'tiny', '--years', '1', '--report', 'hunger'], { encoding: 'utf8' });
check(/summary:/.test(hunText) && /grainQuartiles/.test(hunText), 'hunger report: text output has no summary');
// VB-143: the perf report lists the systems with shares adding up to 100, and does not change the run (the yearly lines match, apart from ms/day)
const pa = ['--scenario', 'populous', '--seed', '7', '--map', 'tiny', '--years', '1'];
const perf = JSON.parse(cp.execFileSync('node', [tool, ...pa, '--report', 'perf', '--json'], { encoding: 'utf8' }));
check(perf.systems.length >= 10 && Math.abs(perf.systems.reduce((a, x) => a + x.share, 0) - 100) < 1, 'perf report: shares do not add up');
check(perf.systems.some((x) => x.system.startsWith('agents') && x.ms > 0), 'perf report: no row for agents and walking');
const yearly = (...a) => cp.execFileSync('node', [tool, ...pa, ...a], { encoding: 'utf8' }).split('\n').filter((l) => /^\s+1\s+\d+/.test(l)).map((l) => l.replace(/\s+[\d.]+$/, ''));
check(yearly('--report', 'perf').join() === yearly().join() && yearly().length === 1, 'perf report: the run differs from one without it');
// tools/balance.js (VB-048): food made by source against need, per household-year; made is the sum of the sources
const bal = JSON.parse(cp.execFileSync('node', [path.join(__dirname, '..', 'tools', 'balance.js'), '--scenario', 'populous', '--seeds', '7', '--map', 'tiny',
  '--years', '2', '--from', '1', '--json'], { encoding: 'utf8' }));
check(bal.rows.length > 0 && bal.bySize.length > 0 && bal.byWeather.length > 0, 'balance report is empty');
check(bal.rows.every((x) => Math.abs(x.grain + x.milk + x.butter + x.meat - x.total) < 0.2 && x.need > 0), 'balance rows: sources do not add up');
check(bal.rows.some((x) => x.milk > 0) && bal.rows.some((x) => x.grain > 0), 'balance rows: no grain or no milk in two years');
// VB-172: the writes map finds the one writer of the tile owners, the many of household grain, and the cycle through farmclaims and heirs
const wr = require('../tools/writes.js').build(), fieldW = (k) => (wr.fields.find((f) => f.field === k) || { writers: [] }).writers;
check(fieldW('st.owner').join() === 'sim/ownership', `writes map: st.owner written by ${fieldW('st.owner').join(', ')}`);
check(fieldW('household.grain').length > 1 && fieldW('household.members').includes('sim/heirs'), 'writes map: household grain or members not found');
check(wr.loops.some((l) => l.from === 'sim/farmclaims' && l.via.includes('sim/heirs')), 'writes map: the farmclaims and heirs cycle not found');
check(wr.unresolved.length < 20, `writes map: ${wr.unresolved.length} unresolved writes; the scan has lost track of names`);
if (failed) process.exit(1);
console.log(`tools ok: ${rows.length} households; balance: ${bal.rows.length} household-years`);
