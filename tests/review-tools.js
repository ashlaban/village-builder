// The review tools (VB-337): tools/stocks.js has a line for every stored quantity of the @state lines and marks what nothing reads;
// the hours report (tools/hours.js) only reads the run: a seed is the same run with or without it.
const assert = require('assert');
const Stocks = require('../tools/stocks.js');

// 1. Every field of the @state lines of households, farms, villages and tiles is a quantity with its line, or listed as none; a new one fails
const fields = Stocks.stateFields(), { missing, stale } = Stocks.unlisted(fields);
assert.deepStrictEqual(missing, [], 'a stored quantity needs its line in tools/stocks.js (QUANTITIES, with `none`), or a place in NOT_STOCKS');
assert.deepStrictEqual(stale, [], 'tools/stocks.js lists fields no @state line names');
const more = new Map([...fields, ['household.lime', 'a test']]);
assert.deepStrictEqual(Stocks.unlisted(more).missing, ['household.lime (a test)'], 'a quantity without a line is found');
for (const q of Stocks.QUANTITIES) assert(q.none && q.none.length > 10 && q.fields.length && q.name, `${q.id}: a line says what happens at none`);
// what the reviews of 10 and 11 November found is mended: the day's water is read since VB-331 (the cook, the dry day), the woodpile
// since VB-327 (the cold house, the cook), the stone heap since VB-332 (the foundation)
const rows = new Map(Stocks.build().map((r) => [r.id, r]));
assert.strictEqual(rows.get('wood').mark, 'used', 'the woodpile is used by the hearth and the cook (VB-327)');
assert.strictEqual(rows.get('water').mark, 'used', 'the day\'s water is used by the cook and the dry day (VB-331)');
assert.strictEqual(rows.get('stone').mark, 'used', 'the stone heap is used by the foundation (VB-332)');
for (const id of ['grain', 'meals', 'hay', 'villageGrain']) assert.strictEqual(rows.get(id).mark, 'used', `${id} is used`);
assert(rows.get('wood').reads.some((r) => r.fn === 'cookWanted') && rows.get('wood').adds.some((a) => a.fn === 'wood.deliver'),
  'the woodpile: the cook reads it (VB-327), and its own kind fills it');

// 2. The hours report reads the run and writes nothing: tests/review-hours.js (VB-856: apart, since the scan above takes 4 seconds)

// 3. Who waits to marry (VB-633, tools/waiting.js; its cases are tests/waiting.js): its --help, and tools/sim.js knows the report
{
  const cp = require('child_process'), help = (f) =>
    cp.execFileSync('node', [require('path').join(__dirname, '..', 'tools', f), '--help'], { encoding: 'utf8' });
  assert.ok(/--report waiting/.test(help('waiting.js')) && /hungry/.test(help('waiting.js')), 'tools/waiting.js answers --help');
  assert.ok(/--report waiting/.test(help('sim.js')) && /\|waiting/.test(help('sim.js')), 'tools/sim.js lists the waiting report');
}
console.log(`review tools ok: ${fields.size} @state fields, ${Stocks.QUANTITIES.length} quantities; read by nothing: ${[...rows.values()]
  .filter((x) => x.mark === 'read by nothing').map((x) => x.id).join(', ')}`);
