// @suite fast
// The cards' rows (VB-1948, page/cardrows): a card reads its rows in the order of their declared places, whatever the order the page's
// files added them in (src/page.json), and a place taken twice, or a card that does not exist, fails at load. Then the page's own rows:
// every cardRow call in src/page names a card and a number, and no two rows of one card share a place.
const assert = require('assert'),
  fs = require('fs'),
  path = require('path'),
  vm = require('vm');
const { readSource } = require('../tools/lib/source');

const ctx = {};
vm.createContext(ctx);
vm.runInContext(readSource('src/page/cardrows.js'), ctx);
const run = (code) => vm.runInContext(code, ctx);
run(
  "cardRow('person', 30, () => 'third'); cardRow('person', 10, () => ['first', '']); cardRow('person', 20, (id) => `second ${id}`);",
);
assert.deepStrictEqual(
  JSON.parse(run("JSON.stringify(cardRows('person', 7))")),
  ['first', '', 'second 7', 'third'],
  'the rows in the order of their places',
);
assert.throws(() => run("cardRow('person', 20, () => 'again')"), /place 20 is taken/, 'a place taken twice fails');
assert.throws(() => run("cardRow('person', '15', () => 'x')"), /not a number/, 'a place is a number');
assert.throws(() => run("cardRow('barn', 10, () => 'x')"), /no card barn/, 'a card that does not exist fails');

const CALL = /\bcardRow\(\s*'([a-z]+)',\s*(\d+)\s*,/g;
const seen = new Map();
let rows = 0;
for (const f of fs
  .readdirSync(path.join(__dirname, '../src/page'))
  .filter((f) => f.endsWith('.js') && f !== 'cardrows.js')) {
  const src = readSource(`src/page/${f}`);
  const calls = (src.match(/\bcardRow\(/g) || []).length,
    found = [...src.matchAll(CALL)];
  assert.strictEqual(found.length, calls, `src/page/${f}: a cardRow call whose card or place is not written out`);
  for (const [, kind, place] of found) {
    const key = `${kind} ${place}`;
    assert(!seen.has(key), `the ${kind} card's place ${place} is taken by src/page/${seen.get(key)} and src/page/${f}`);
    seen.set(key, f);
    rows++;
  }
}
for (const kind of ['person', 'farm', 'tile', 'house'])
  assert(
    [...seen.keys()].some((k) => k.startsWith(kind + ' ')),
    `the ${kind} card has no rows`,
  );
console.log(`card rows ok: ${rows} rows declared over 4 cards`);
