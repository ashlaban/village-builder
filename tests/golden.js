// Golden-state test: hashes the generated world, the simulation state and calibration output.
// `node tests/golden.js` checks against tests/golden.json; `--update` rewrites it.
const crypto = require('crypto'), fs = require('fs'), path = require('path'), cp = require('child_process');
const G = require('../src/gen.js'); global.ArchGen = G; global.Culture = require('../src/culture.js');
const Sim = require('../src/sim.js');
const FILE = path.join(__dirname, 'golden.json');
const sha = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 16);

// canonical text of a value: sorted keys, Maps/Sets in insertion order, typed arrays as arrays, back-references for shared objects
function canon(v, seen = new Map(), where = '$') {
  if (v === null || v === undefined) return String(v);
  if (typeof v === 'function') return 'fn';
  if (typeof v === 'number') return Number.isFinite(v) ? Number(v).toPrecision(12) : String(v);
  if (typeof v !== 'object') return JSON.stringify(v);
  if (seen.has(v)) return `&${seen.get(v)}`;
  seen.set(v, where);
  if (ArrayBuffer.isView(v)) return `[${Array.from(v, (x) => canon(x)).join(',')}]`;
  if (Array.isArray(v)) return `[${v.map((x, i) => canon(x, seen, `${where}[${i}]`)).join(',')}]`;
  if (v instanceof Map) return `Map{${[...v].map(([k, x], i) => `${canon(k, seen, `${where}.k${i}`)}=>${canon(x, seen, `${where}.v${i}`)}`).join(',')}}`;
  if (v instanceof Set) return `Set{${[...v].map((x, i) => canon(x, seen, `${where}.s${i}`)).join(',')}}`;
  return `{${Object.keys(v).sort().filter((k) => typeof v[k] !== 'function').map((k) => `${k}:${canon(v[k], seen, `${where}.${k}`)}`).join(',')}}`;
}
const hashKeys = (o, skip = []) => Object.fromEntries(Object.keys(o).sort().filter((k) => !skip.includes(k) && typeof o[k] !== 'function').map((k) => [k, sha(canon(o[k]))]));

const world = (seed) => { const it = G.generate(seed); let r; while (!(r = it.next()).done); return r.value; };
const out = {};
for (const seed of [7, 42]) {
  out[`world/${seed}`] = hashKeys(world(seed));
  for (const scenario of ['founders', 'heirs']) {
    const w = world(seed), st = Sim.seed(w, seed, scenario);
    out[`${scenario}/${seed}/seed`] = hashKeys(st, ['w']);
    for (let y = 1; y <= 3; y++) { Sim.advance(st, Sim.YEAR); out[`${scenario}/${seed}/year${y}`] = hashKeys(st, ['w']); }
  }
}
out.calibrate = sha(cp.execFileSync('node', [path.join(__dirname, 'calibrate.js'), 'natural', '2', '50'], { encoding: 'utf8' }).replace(/\(\d+\.\d s\)/g, '(timing)'));
out.apiKeys = { Sim: sha(Object.keys(Sim).sort().join()), ArchGen: sha(Object.keys(G).sort().join()), Culture: sha(Object.keys(global.Culture).sort().join()) };

if (process.argv.includes('--update')) { fs.writeFileSync(FILE, JSON.stringify(out, null, 1) + '\n'); console.log('golden.json updated'); process.exit(0); }
const want = JSON.parse(fs.readFileSync(FILE, 'utf8')), bad = [];
for (const k of new Set([...Object.keys(want), ...Object.keys(out)])) {
  const a = want[k], b = out[k];
  if (typeof a === 'string' || typeof b === 'string') { if (a !== b) bad.push(k); continue; }
  const keys = [...new Set([...Object.keys(a || {}), ...Object.keys(b || {})])].filter((x) => (a || {})[x] !== (b || {})[x]);
  if (keys.length) bad.push(`${k}: ${keys.join(', ')}`);
}
if (bad.length) { console.error('GOLDEN MISMATCH (run with --update only if the change is intended):\n  ' + bad.join('\n  ')); process.exit(1); }
console.log('golden state matches');
