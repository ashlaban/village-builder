// Exercise the real writes scanner and ownership audit without changing repository files.
const assert = require('assert'), fs = require('fs'), path = require('path');
const { scan, build, OWNERS, markdown, fieldOf, ownerOf } = require('../tools/writes.js');
const { collect, audit } = require('./ownership.js');
const file = 'src/sim/deaths.js', mod = 'sim/deaths';
const writes = (src, m = mod) => scan('src/' + m + '.js', m, {}, src).writes.filter((w) => w.path).map((w) => ({ ...w, mod: m, file }));
for (const src of [
  'st.owner[0] = 1;', 'st.owner[0] += 1;', 'st.owner[0]++;', '--st.owner[0];', 'delete st.owner[0];',
  'st.owner.fill(0);', 'const { owner } = st; owner[0] = 1;', "st['owner'][0] = 1;",
  "st.pawns['0']['household'] = 1;", 'function next(st) { return ++st.owner[0]; }',
  'const a = st.agents[0]; a.path = null;', 'for (const p of st.pawns) p.household = 1;',
  'const hh = st.households[0]; hh.members.push(1);', "const fd = st.farmsteads[0].fields[0]; fd.stage = 'sown';",
  'st.claims.set(1, []);', 'st.claims.delete(1);', 'st.claims.clear();',
  'let store; store = st.owner; store[0] = 1;',
  'const hh = st.households[0]; { const hh = {}; } hh.grain -= 1;',
  'const hh = st.households[0]; function local() { const hh = {}; } hh.grain -= 1;',
  "st.claims['set'](1, []);", "st.claims['delete'](1);", "st.owner['fill'](0);",
  'Object.assign(st.pawns[0], {household: 1});', 'const {owner} = st; Object.assign(owner, {0: 1});',
  'Object.defineProperty(st.pawns[0], "household", {value: 1});', 'Reflect.set(st.pawns[0], "household", 1);',
  '({household: st.pawns[0].household} = {household: 1});',
  'let store; ({owner: store} = st); store[0] = 1;',
  'let hh = st.households[0]; if (flag) hh = {}; hh.grain -= 1;',
  'let hh = st.households[0]; function later() { hh = {}; } hh.grain -= 1;',
]) {
  const bad = audit(writes(src), {});
  assert.strictEqual(bad.length, 1, `must reject ${src}: ${bad}`);
  assert(bad[0].includes(file + ':1') && bad[0].includes('outside owner'), 'diagnostic includes file, line and owner');
}
for (const src of [
  'const grain = st.households[0].grain;', 'st.visualDirty = true; st.rigDirty.add(1);',
  'st.owner[0] = 1; // lint-allow: owner a deliberate test exception',
  'const hh = {}; hh.grain = 5; st.households.push(hh);',
  'const hh = {members: []}; hh.members.push(1); st.households.push(hh);',
  'const copy = st.households[0].members.slice(); copy.sort();',
  '// st.owner[0] = 1;\nconst s = "st.owner[0] = 1";',
  'const hh = st.households[0]; { const hh = {}; hh.grain = 1; }',
  'const hh = {}; function change(hh) { const copy = {}; copy.grain = 1; } hh.grain = 1;',
  'let store; store = {}; store.grain = 1;',
  'let hh = {}; hh = st.households[0]; hh = {}; hh.grain = 1;',
  'const hh = {}; Object.assign(hh, {grain: 1}); st.households.push(hh);',
  'const hh = {}; ({grain: hh.grain} = {grain: 1}); st.households.push(hh);',
]) assert.deepStrictEqual(audit(writes(src), {}), [], `must allow ${src}`);
for (const src of ['st.owner[0] = 1; // lint-allow: owner',
  '// lint-allow: owner different line\nst.owner[0] = 1;',
  'const hh = {}; st.households.push(hh); hh.grain = 5;']) {
  assert.strictEqual(audit(writes(src), {}).length, 1, `must reject ${src}`);
}
assert.deepStrictEqual(audit(writes('st.owner[0] = 1;', 'sim/ownership'), {}), []);
for (const m of [...OWNERS.creators, ...OWNERS.exempt]) assert.deepStrictEqual(audit(writes('st.owner[0] = 1;', m), {}), []);
// The cache category has the same enforcement as fields, including the currently baselined role writer.
for (const f of ['st.owner', 'pawn.household', 'household.members', 'pawn.role']) assert.strictEqual(OWNERS.fields[f].category, 'cache');
assert.strictEqual(audit(writes('p.role = "farmer";'), {}).length, 1);
// Baselines survive line moves and whitespace, but cannot acquire new sites or duplicate a permitted site.
const old = writes('hh.grain -= 1;'), baseline = collect(old);
assert.deepStrictEqual(audit(writes('\n hh . grain -= 2;'), baseline), []);
assert.strictEqual(audit(writes('hh.grain -= 1; hh.grain -= 1;'), baseline).length, 1);
assert(audit(writes('hh.grain += 1;'), baseline).some((e) => e.includes('outside owner')));
assert(audit([], baseline).some((e) => e.includes('stale baseline')));
assert.deepStrictEqual(audit([], baseline, { update: true }), []);
assert(audit(writes('hh.grain += 1;'), baseline, { update: true }).some((e) => e.includes('outside owner')));
assert.deepStrictEqual(collect([]), {});
// Plant a real out-of-owner write in an in-memory copy of a manifest module: the full scan and baseline must reject it.
const src = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const report = build({ [file]: src + '\nst.owner[0] = 1;\n' }, { stateOnly: true });
const base = JSON.parse(fs.readFileSync(path.join(__dirname, 'ownership-baseline.json'), 'utf8'));
const errors = audit(report.fields.flatMap((f) => f.writes), base);
assert.strictEqual(errors.length, 1, errors.join('\n'));
assert(errors[0].includes(file + ':') && errors[0].includes('st.owner') && errors[0].includes('sim/ownership'));
const owner = report.fields.find((f) => f.field === 'st.owner');
assert(owner.writes.some((w) => w.mod === mod && w.outsideOwner));
assert(markdown(report).includes('ownership (cache)') && markdown(report).includes('! past owner'));
// An additional declared field needs no scanner/check changes.
OWNERS.fields['household.wood'] = 'sim/stores';
assert.strictEqual(audit(writes('hh.wood += 1;'), {}).length, 1);
delete OWNERS.fields['household.wood'];
assert.strictEqual(ownerOf(fieldOf('farmstead.fields[].stage')), 'sim/fields');
for (const src of ['Object.assign(st.pawns[0], incoming);', 'st.pawns[0][key] = 1;']) {
  assert(audit(writes(src), {}).length > 0, 'dynamic record writes must check all possibly affected owners');
}
for (const src of ['let store = st.owner; if (flag) store = st.claims; store.clear();',
  'let record = st.pawns[0]; if (flag) record = st.households[0]; Object.assign(record, incoming);',
  'let record = st.pawns[0]; if (flag) record = st.households[0]; record[key] = 1;']) {
  const errors = audit(writes(src), {});
  assert(errors.length >= 2, 'conditional aliases must check every possible owned target');
}
// A malformed declaration must never turn an owned field into a freely writable field.
const { validateOwners } = require('../tools/owner-policy.js');
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/manifest.json'), 'utf8'));
const context = { modules: new Set(manifest.map((f) => f.replace(/\.js$/, ''))),
  entities: new Set(Object.keys(OWNERS.fields).map((f) => f.split('.')[0])) };
assert.deepStrictEqual(validateOwners(OWNERS, context), []);
for (const spec of [null, '', 4, [], {}, {ownerModule: 'sim/records'},
  {owner: 'sim/records', category: 'cahce'}, {owner: 'sim/recrods', category: 'cache'}, 'sim/stroes']) {
  const policy = structuredClone(OWNERS); policy.fields['pawn.household'] = spec;
  assert(validateOwners(policy, context).length > 0, `must reject invalid owner: ${JSON.stringify(spec)}`);
}
for (const change of [
  (p) => { p.creators = 'sim/scenarios'; }, (p) => p.creators.push('sim/missing'),
  (p) => p.exempt.push(p.exempt[0]), (p) => p.plannedOwners.push('sim/records'),
  (p) => { p.fields['househld.grain'] = 'sim/stores'; }, (p) => { p.extra = true; },
]) {
  const policy = structuredClone(OWNERS); change(policy);
  assert(validateOwners(policy, context).length > 0, 'must reject malformed policy metadata');
}
console.log('ownership rules ok: writes rejected, creation/signals/exemptions allowed, baseline only decreases');
// VB-243: a write through a parameter named `home` (the case found on 10 November) fails as an unplaced write, not unseen.
{
  const { auditUnresolved } = require('./ownership.js');
  const src = require('fs').readFileSync('src/sim/herds.js', 'utf8') + '\nfunction f(st, home) { home.grain = 0; }';
  const b = build({ 'src/sim/herds.js': src }, { stateOnly: true });
  assert(b.unresolved.some((u) => u.mod === 'sim/herds' && /home\.grain/.test(u.text)), 'home.grain reaches the unresolved list');
  assert(auditUnresolved(b.unresolved, {}).some((e) => /home\.grain/.test(e) && /herds\.js:\d+/.test(e)), 'and fails the unresolved check');
  assert.deepStrictEqual(auditUnresolved([], {}), []);
}
