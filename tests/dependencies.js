// VB-176: enforce module order, including deferred lookups; command dispatch is the only upward door.
const assert = require('assert'), { parse } = require('acorn');
const { build } = require('../tools/writes.js'), { dependencies, violations } = require('../tools/dependencies.js');
const r = build();
assert.deepStrictEqual(violations(r.deps), []);
assert(!r.deps.find((d) => d.mod === 'sim/expansion').lookups.some((l) => l.key === 'sim/farmclaims'));
assert(r.loops.every((l) => l.via.includes('sim/commands')), 'every cycle goes through command dispatch');

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
assert.deepStrictEqual(errors(wrap("const later = (key) => VB[key]; const run = () => later('late').act();"), 'sim/commands'), []);
assert(errors(wrap('const bad = (key) => VB[key];'), 'sim/commands').length === 1, 'no blanket commands exemption');
console.log(`dependencies: module order enforced; ${r.loops.length} cycle witnesses all through commands`);
