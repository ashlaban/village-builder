// The cull is the head's (VB-679): the verb `cull` chooses which animals go this autumn. With no list the count's rule chooses, as every
// head does on the count day (sim/clock's autumn counts issue it); a played head may choose otherwise, its list replacing the count's.
// Only the head, in autumn from the count day, and only its own animals. On the small island of tests/lib/probe.js.
const assert = require('assert');
const VB = require('../src/load.js'), Sim = VB.sim, { scenario } = require('./lib/probe.js'), H = VB['sim/herds'];
const { issue } = VB['sim/commands'];
const { checkState } = require('./lib/invariants.js');
const { DAY, YEAR_DAYS, HERD } = VB['sim/rules'];
const st = scenario('founders', 7);
const hh = st.households.find((h) => h.holder !== null && H.herdOf(st, h, 'cattle') && H.herdOf(st, h, 'sheep')),
  head = hh.holder,
  other = st.households.find((h) => h !== hh && h.herds.length);
const cattle = H.herdOf(st, hh, 'cattle'), sheep = H.herdOf(st, hh, 'sheep');
const cull = (actor, args, target = hh.id, source = 'player') => issue(st, { actor, verb: 'cull', target, args, source });
const marked = () => H.herdsOf(st, hh).reduce((s, hd) => s + hd.cull.length, 0);
// out of season: refused
assert.ok(/autumn/.test(cull(head)), 'refused before the count day');
// to the count day (the clock's counts run at its start): every head's count is the verb's, by the rule
Sim.advance(st, HERD.countDay * DAY + 1 - st.t);
const ruled = marked();
assert.ok(ruled > 0, 'the count culled by its rule');
// refused: not the head; another household's animal; more ewes than the flock holds
const member = hh.members.find((m) => m !== head && st.pawns[m].alive);
assert.ok(/not the head/.test(cull(member, { animals: [] })), 'only the head chooses');
assert.ok(/is not household/.test(cull(head, { animals: [{ herd: other.herds[0], sheep: 'ewe' }] })), 'not another household\'s herd');
assert.ok(/no more/.test(cull(head, { animals: Array(sheep.ewes + 1).fill({ herd: sheep.id, sheep: 'ewe' }) })), 'no more ewes than the flock');
// the played head chooses otherwise: one cow and one ewe, nothing else
const cow = cattle.head.find((h) => h.kind === 'cow');
assert.strictEqual(cull(head, { animals: [{ herd: cattle.id, head: cow.id }, { herd: sheep.id, sheep: 'ewe' }] }), true, 'the head chooses');
assert.deepStrictEqual(cattle.cull.map((e) => e.head), [cow.id], 'its cow, and only it, goes');
assert.deepStrictEqual(sheep.cull.map((e) => e.sheep), ['ewe'], 'one ewe goes');
assert.deepStrictEqual(checkState(st), [], 'invariants, chosen');
// keep them all
assert.strictEqual(cull(head, { animals: [] }), true);
assert.strictEqual(marked(), 0, 'every animal kept');
// and back to the rule: the same count as the clock's
assert.strictEqual(cull(head), true);
assert.ok(marked() > 0, 'the rule counts again');
// the slaughter follows the list: run to the year's end, no cow but the chosen goes
assert.strictEqual(cull(head, { animals: [{ herd: cattle.id, head: cow.id }] }), true);
const before = cattle.head.length;
Sim.advance(st, (YEAR_DAYS - HERD.countDay - 2) * DAY);
assert.ok(!cattle.head.some((h) => h.id === cow.id), 'the chosen cow was slaughtered');
assert.ok(cattle.head.length >= before - 1, `only it of the cattle: ${before} to ${cattle.head.length}`);
assert.deepStrictEqual(checkState(st), [], 'invariants, slaughtered');
console.log(`cull ok: the rule marked ${ruled}, the head chose a cow and a ewe`);
