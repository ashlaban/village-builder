// Inspect the load-time registry, or explain death.hazard for a pawn in a run or save.
// node tools/rules.js [--explain ID --scenario populous --seed 7 --map tiny --years 0] [--load FILE[.gz]] [--json]
require('./help.js')(__filename);
const VB = require('../src/load.js'), Rules = VB['sim/registry'], Sim = VB.sim;
const fs = require('fs'), zlib = require('zlib'), args = process.argv.slice(2);
function opt(key, fallback) {
  const i = args.indexOf('--' + key);
  if (i < 0) return fallback;
  if (!args[i + 1] || args[i + 1].startsWith('--')) throw new Error('Missing value for --' + key);
  return args[i + 1];
}
function run() {
  const id = opt('explain', null), json = args.includes('--json');
  if (id === null) {
    if (json) console.log(JSON.stringify(Rules.list(), null, 2));
    else for (const rule of Rules.list()) {
      console.log(`${rule.rule} — owner ${rule.owner}, ${rule.combine}`);
      if (rule.clamp) console.log(`  clamp [${rule.clamp}]`);
      for (const c of rule.contributions) console.log(`  ${c.key}: ${c.source}, range [${c.range}], tunables ${c.tunables.join(', ')}`);
    }
    return;
  }
  const sizes = { tiny: [120, 85], small: [180, 130], medium: [280, 200], large: [380, 270] };
  const file = opt('load', null);
  const data = file ? JSON.parse((file.endsWith('.gz') ? zlib.gunzipSync(fs.readFileSync(file)) : fs.readFileSync(file)).toString()) : null;
  const size = sizes[opt('map', 'tiny')], seed = data ? data.seed : Number(opt('seed', 7));
  const years = Number(opt('years', 0)), scenario = data ? data.scenario : opt('scenario', 'populous'), pawn = Number(id);
  if (!size || !Number.isFinite(seed) || !Number.isFinite(years) || years < 0 || !Number.isInteger(pawn) || pawn < 0
    || !['founders', 'heirs', 'populous'].includes(scenario)) throw new Error('Invalid pawn, seed, map, scenario or years');
  const it = VB.gen.generate(seed, { cols: data ? data.cols : size[0], rows: data ? data.rows : size[1] });
  let r; while (!(r = it.next()).done);
  const st = data ? Sim.load(r.value, data) : Sim.seed(r.value, seed, scenario);
  if (years) Sim.advance(st, years * Sim.YEAR);
  const p = st.pawns[pawn];
  if (!p) throw new Error('Unknown pawn: ' + id);
  if (!p.alive) throw new Error('Pawn ' + id + ' is dead; there is no death roll today');
  const explanation = Rules.explain(st, 'death.hazard', p);
  const result = { rule: 'death.hazard', pawn, name: Sim.fullName(p), t: st.t, ...explanation, starvation: p.health <= 0 };
  if (json) console.log(JSON.stringify(result, null, 2));
  else {
    console.log(`death.hazard for ${result.name} (#${pawn}) at hour ${st.t}: ${explanation.value} per day`);
    console.log(`  base: ${explanation.base}, combine: ${explanation.combine}`);
    const operator = explanation.combine === 'product' ? '×' : '+';
    for (const c of explanation.parts) console.log(`  ${operator} ${c.factor} ${c.label} (${c.source}; cause ${c.cause})`);
    if (explanation.clamp) console.log(`  clamp [${explanation.clamp}]: ${explanation.unclamped} → ${explanation.value}`);
    if (result.starvation) console.log('  Health is zero: starvation bypasses the hazard roll.');
  }
}
try { run(); } catch (e) { console.error('rules: ' + e.message); process.exitCode = 1; }
