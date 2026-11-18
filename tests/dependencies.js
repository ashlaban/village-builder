// VB-176: enforce module order, including deferred lookups. VB-228: the verbs are registered by their modules, so the dispatcher has no
// door upward and the modules form no cycle; `issue` may still be looked up from any module.
const assert = require('assert'), { parse } = require('acorn');
const { build } = require('../tools/writes.js'), { dependencies, violations } = require('../tools/dependencies.js');
const fs = require('fs'), path = require('path');
const { loadLayers, missingLayers, upward } = require('../tools/dependencies.js');
const r = build();
assert.deepStrictEqual(violations(r.deps), []);
assert(!r.deps.find((d) => d.mod === 'sim/expansion').lookups.some((l) => l.key === 'sim/farmclaims'));
assert.deepStrictEqual(r.loops, [], 'the modules form no cycle');
assert.deepStrictEqual(r.deps.find((d) => d.mod === 'sim/commands').imports, ['sim/registry'], 'sim/commands imports no domain');
assert.deepStrictEqual(r.deps.find((d) => d.mod === 'sim/commands').lookups, [], 'and looks none up');
// VB-172/174/175: the writes map's owners, and no direct founding lookup (in tests/tools.js until VB-856, on this same build)
const fieldW = (k) => (r.fields.find((f) => f.field === k) || { writers: [] }).writers;
assert.strictEqual(fieldW('st.owner').join(), 'sim/ownership', 'writes map: st.owner has one writer');
for (const k of ['household.members', 'pawn.household', 'pawn.servant']) assert.strictEqual(fieldW(k).join(), 'sim/records', `writes map: ${k}`);
assert(fieldW('household.grain').includes('sim/stores'), 'writes map: household grain owner not found');
for (const [from, target] of [['sim/farmclaims', 'sim/heirs'], ['sim/expansion', 'sim/cottage']]) {
  const dep = r.deps.find((d) => d.mod === from);
  assert(dep && !dep.lookups.some((l) => l.key === target), `writes map: direct founding lookup ${from} → ${target}`);
  assert(dep && dep.imports.includes('sim/commands'), `writes map: ${from} founds through a command`);
}

function errors(src, mod = 'early') {
  const edges = dependencies(parse(src, { ecmaVersion: 'latest' }), src, mod);
  return violations([{ mod, imports: edges.filter((d) => d.atLoad).map((d) => d.key),
    importSites: edges.filter((d) => d.atLoad),
    lookups: edges.filter((d) => !d.atLoad).map((d) => ({ ...d, later: d.key !== 'earlier' })) },
  { mod: 'late', imports: [], lookups: [] }]);
}
const wrap = (s) => `VB.early = (() => {\n${s}\n})();`;
for (const code of ["function bad() { return VB['late']; }", 'const bad = () => VB.late;',
  "const bad = () => VB['late'].issue;", "const bad = () => VB['sim/commands'].other();",
  'const bad = (key) => VB[key];',
  "const issue = () => VB['sim/commands'].issue(); const bad = () => VB['sim/commands'].other();"]) {
  const e = errors(wrap(code));
  assert(e.length === 1 && e[0].includes('src/early.js:2'), `missing file/line diagnostic for ${code}`);
}
assert(errors(wrap("const bad = VB['late'];")).length === 1, 'reject later imports too');
assert(errors(wrap('const bad = VB[key];')).length === 1, 'reject dynamic imports too');
assert.deepStrictEqual(errors(wrap("const ok = () => VB['earlier'];")), []);
assert.deepStrictEqual(errors(wrap("const issue = (st, cmd) => VB['sim/commands'].issue(st, cmd);")), []);
assert.deepStrictEqual(errors(wrap("const issue = (st, cmd) => VB['sim/commands']['issue'](st, cmd);")), []);
assert.deepStrictEqual(errors(wrap("// VB.late\nconst text = 'VB.late';")), []);
assert(errors(wrap("const later = (key) => VB[key]; const run = () => later('late').act();"), 'sim/commands').length === 1, 'the dispatcher has no exemption (VB-228)');

// VB-230: every module has a layer; upward calls (by pair of modules) are held to a baseline that only falls.
const L = loadLayers(), BASE = path.join(__dirname, 'layers-baseline.json');
assert.deepStrictEqual(missingLayers(r.deps.map((d) => d.mod), L), []);
const found = {};
for (const u of upward(r.deps, L)) found[`${u.from} -> ${u.to}`] = (found[`${u.from} -> ${u.to}`] || 0) + 1;
const total = Object.values(found).reduce((a, b) => a + b, 0);
const base = fs.existsSync(BASE) ? JSON.parse(fs.readFileSync(BASE, 'utf8')) : { total: Infinity, pairs: {} };
if (process.argv.includes('--update')) {
  assert(total <= base.total, `--update only lowers the baseline (${total} > ${base.total})`);
  if (fs.existsSync(BASE)) for (const k in found) assert((base.pairs[k] || 0) >= found[k], `new upward call ${k}`);
  fs.writeFileSync(BASE, JSON.stringify({ total, pairs: found }, null, 2) + '\n');
} else {
  const bad = Object.keys(found).filter((k) => found[k] > (base.pairs[k] || 0));
  assert.deepStrictEqual(bad, [], `new upward calls against the layers (baseline ${base.total}, found ${total}); see node tools/dependencies.js`);
  if (total < base.total) console.log(`dependencies: ${total} upward calls, baseline ${base.total}: run --update to lower it`);
}
console.log(`dependencies: layers ${total} upward calls (baseline ${Math.min(base.total, total)});`);
console.log('dependencies: module order enforced; no cycle');
