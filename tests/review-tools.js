// The review tools (VB-337): tools/stocks.js has a line for every stored quantity of the @state lines and marks what nothing reads;
// the hours report (tools/hours.js) only reads the run: a seed is the same run with or without it.
const assert = require('assert');
const VB = require('../src/load.js'), Sim = VB.sim, G = VB.gen, { sha, canon } = require('./lib/canon.js');
const Stocks = require('../tools/stocks.js');

// 1. Every field of the @state lines of households, farms, villages and tiles is a quantity with its line, or listed as none; a new one fails
const fields = Stocks.stateFields(), { missing, stale } = Stocks.unlisted(fields);
assert.deepStrictEqual(missing, [], 'a stored quantity needs its line in tools/stocks.js (QUANTITIES, with `none`), or a place in NOT_STOCKS');
assert.deepStrictEqual(stale, [], 'tools/stocks.js lists fields no @state line names');
const more = new Map([...fields, ['household.lime', 'a test']]);
assert.deepStrictEqual(Stocks.unlisted(more).missing, ['household.lime (a test)'], 'a quantity without a line is found');
for (const q of Stocks.QUANTITIES) assert(q.none && q.none.length > 10 && q.fields.length && q.name, `${q.id}: a line says what happens at none`);
// what the reviews of 10 and 11 November found: nothing reads the day's water (until VB-331 lands; then change this line); the woodpile is
// read since VB-327 (the cold house, the cook), the stone heap since VB-332 (the foundation)
const rows = new Map(Stocks.build().map((r) => [r.id, r]));
assert.strictEqual(rows.get('wood').mark, 'used', 'the woodpile is used by the hearth and the cook (VB-327)');
assert.strictEqual(rows.get('water').mark, 'read by nothing', 'the day\'s water is read by nothing (VB-331)');
assert.strictEqual(rows.get('stone').mark, 'used', 'the stone heap is used by the foundation (VB-332)');
for (const id of ['grain', 'meals', 'hay', 'villageGrain']) assert.strictEqual(rows.get(id).mark, 'used', `${id} is used`);
assert(rows.get('wood').reads.some((r) => r.fn === 'cookWanted') && rows.get('wood').adds.some((a) => a.fn === 'wood.deliver'),
  'the woodpile: the cook reads it (VB-327), and its own kind fills it');

// 2. The hours report reads the run and writes nothing: the same seed gives the same state with or without it
const world = () => { const it = G.generate(7, { cols: 120, rows: 85 }); let r; while (!(r = it.next()).done); return r.value; }; // a run changes its world
const hash = (st) => sha(Object.keys(st).sort().map((k) => `${k}:${canon(st[k])}`).join('\n'));
const plain = Sim.seed(world(), 7, 'founders'); Sim.advance(plain, Sim.YEAR);
const st = Sim.seed(world(), 7, 'founders'), hours = require('../tools/hours.js')(VB, st, {});
hours.advanceYear();
assert.strictEqual(hash(st), hash(plain), 'the hours report changes the run');
const out = hours.result();
assert(out.groups.length && out.groups.every((g) => g.households > 0 && g.handsHours > 0), 'the hours report has groups of households');
const all = out.groups.flatMap((g) => g.hours);
assert(['plow', 'sow', 'reap', 'water', 'cook'].every((k) => all.some((h) => h.kind === k && h.total > 0)), 'field work, water and cooking are counted');
const farming = out.groups.find((g) => g.farming.sown.fields > 0);
assert(farming && farming.farming.reaped.fields > 0 && farming.farming.threshed.fields > 0, 'the farming year: fields sown, reaped and threshed');
const one = require('../tools/hours.js')(VB, Sim.seed(world(), 7, 'founders'), { household: 0 });
one.advanceYear();
assert(one.result().years.length === 1, 'one household\'s table');
console.log(`review tools ok: ${fields.size} @state fields, ${Stocks.QUANTITIES.length} quantities; read by nothing: ${[...rows.values()]
  .filter((x) => x.mark === 'read by nothing').map((x) => x.id).join(', ')}; the hours report leaves the run as it was`);
