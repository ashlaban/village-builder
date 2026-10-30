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
if (failed) process.exit(1);
console.log(`tools ok: ${rows.length} households`);
