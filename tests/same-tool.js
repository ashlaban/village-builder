// tools/same.js: the comparison of two trees' leaves on deliberate files, and a refused option. The runs themselves are tools/sim.js's.
const assert = require('assert'), fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
const { compare } = require('../tools/same.js');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vb-same-test-'));
const put = (side, file, text) => {
  const f = path.join(dir, side, file); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text);
};
try {
  for (const side of ['base', 'work']) put(side, 'heirs-7-tiny-seed/pawns.txt', 'pawns[0].age = 30\npawns[1].age = 4\n');
  assert.deepStrictEqual(compare(path.join(dir, 'base'), path.join(dir, 'work')), [], 'equal leaves are the same');
  put('work', 'heirs-7-tiny-seed/pawns.txt', 'pawns[0].age = 31\npawns[2].age = 1\n');
  put('work', 'heirs-7-tiny-year1/plans.txt', 'plans = []\n');
  const diffs = compare(path.join(dir, 'base'), path.join(dir, 'work'));
  assert.deepStrictEqual(diffs.map((d) => [d.file, d.count]), [['heirs-7-tiny-seed/pawns.txt', 3], ['heirs-7-tiny-year1/plans.txt', 1]]);
  assert.deepStrictEqual(diffs[0].first, ['pawns[0].age: 30 → 31', 'pawns[2].age: (absent) → 1', 'pawns[1].age: 4 → (absent)']);
  assert.deepStrictEqual(diffs[1].first, ['plans: (absent) → []'], 'a key only one tree has differs');
  assert.strictEqual(compare(path.join(dir, 'base'), path.join(dir, 'work'), 1)[0].first.length, 1, 'the leaves shown are capped');
  const bad = cp.spawnSync(process.execPath, [path.join(__dirname, '../tools/same.js'), '--update'], { encoding: 'utf8' });
  assert(bad.status === 2 && /unknown option --update/.test(bad.stderr), 'nothing is recorded: there is no --update');
} finally { fs.rmSync(dir, { recursive: true, force: true }); }
console.log('same tool: equal trees, changed, added and removed leaves, a key on one side, the cap, and no --update');
