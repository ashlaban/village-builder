// Golden-state test: hashes the generated world, the simulation state and calibration output.
// `node tests/golden.js` checks against tests/golden.json; `--update` rewrites it.
// `--dump DIR` writes the canonical text of every hashed value, one file per entry and key (DIR/founders-7-year2/pawns.txt), one line per leaf;
// `--only a,b` limits a run to the named entries. On a mismatch the check dumps both sides to tests/out/ (the baseline is a `git worktree` of HEAD)
// and prints the first differing lines per key.
const crypto = require('crypto'), fs = require('fs'), path = require('path'), cp = require('child_process');
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim;
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
// one line per leaf: `pawns[41].household = 7`; shared objects print as back-references, as in canon
function leaves(v, where, seen, lines) {
  if (v === null || v === undefined || typeof v !== 'object') { lines.push(`${where} = ${canon(v)}`); return lines; }
  if (seen.has(v)) { lines.push(`${where} = &${seen.get(v)}`); return lines; }
  seen.set(v, where);
  if (Array.isArray(v) || ArrayBuffer.isView(v)) { if (!v.length) lines.push(`${where} = []`); v.forEach((x, i) => leaves(x, `${where}[${i}]`, seen, lines)); }
  else if (v instanceof Map) { if (!v.size) lines.push(`${where} = Map{}`); let i = 0; for (const [k, x] of v) { leaves(x, `${where}<${canon(k)}>`, seen, lines); i++; } }
  else if (v instanceof Set) { if (!v.size) lines.push(`${where} = Set{}`); let i = 0; for (const x of v) leaves(x, `${where}{${i++}}`, seen, lines); }
  else for (const k of Object.keys(v).sort()) if (typeof v[k] !== 'function') leaves(v[k], `${where}.${k}`, seen, lines);
  return lines;
}
const arg = (name) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : null; };
const DUMP = arg('--dump'), ONLY = arg('--only') ? new Set(arg('--only').split(',')) : null;
const wanted = (entry) => !ONLY || ONLY.has(entry);
const hashKeys = (o, skip = [], entry = '') => {
  if (!wanted(entry)) return {};
  const res = {};
  for (const k of Object.keys(o).sort()) {
    if (skip.includes(k) || typeof o[k] === 'function') continue;
    res[k] = sha(canon(o[k]));
    if (DUMP) {
      const dir = path.join(DUMP, entry.replace(/\//g, '-'));
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, k + '.txt'), leaves(o[k], k, new Map(), []).join('\n') + '\n');
    }
  }
  return res;
};

const world = (seed) => { const it = G.generate(seed); let r; while (!(r = it.next()).done); return r.value; };
const out = {};
// state fields that only index other fields (VB-071) stay out of the fingerprint
const DERIVED = ['w', 'jobsBy'];
for (const seed of [7, 42]) {
  out[`world/${seed}`] = hashKeys(world(seed), [], `world/${seed}`);
  for (const scenario of ['founders', 'heirs']) {
    const w = world(seed), st = Sim.seed(w, seed, scenario);
    out[`${scenario}/${seed}/seed`] = hashKeys(st, DERIVED, `${scenario}/${seed}/seed`);
    for (let y = 1; y <= 3; y++) { Sim.advance(st, Sim.YEAR); out[`${scenario}/${seed}/year${y}`] = hashKeys(st, DERIVED, `${scenario}/${seed}/year${y}`); }
  }
}
if (DUMP) { console.log('dumped to ' + DUMP); process.exit(0); }
out.calibrate = sha(cp.execFileSync('node', [path.join(__dirname, 'calibrate.js'), 'natural', '2', '50'], { encoding: 'utf8' }).replace(/\(\d+\.\d s\)/g, '(timing)'));
out.apiKeys = { Sim: sha(Object.keys(Sim).sort().join()), ArchGen: sha(Object.keys(G).sort().join()), Culture: sha(Object.keys(VB.culture).sort().join()) };

if (process.argv.includes('--update')) { fs.writeFileSync(FILE, JSON.stringify(out, null, 1) + '\n'); console.log('golden.json updated'); process.exit(0); }
// Dumps the mismatching entries of the working tree and of HEAD (checked out as a git worktree at tests/out/base) and prints the first
// 10 differing lines per key.
function explain(rows) {
  const root = path.join(__dirname, 'out'), base = path.join(root, 'base'), entries = rows.map(([e]) => e).join(',');
  fs.rmSync(root, { recursive: true, force: true }); fs.mkdirSync(root, { recursive: true });
  const here = path.join(root, 'new'), there = path.join(root, 'head'), me = path.join(__dirname, 'golden.js');
  cp.execFileSync('node', [me, '--dump', here, '--only', entries], { stdio: 'ignore' });
  cp.execFileSync('git', ['worktree', 'add', '--detach', base, 'HEAD'], { stdio: 'ignore', cwd: path.join(__dirname, '..') });
  try { cp.execFileSync('node', [path.join(base, 'tests', 'golden.js'), '--dump', there, '--only', entries], { stdio: 'ignore' }); }
  finally { cp.execFileSync('git', ['worktree', 'remove', '--force', base], { stdio: 'ignore', cwd: path.join(__dirname, '..') }); }
  for (const [entry, keyList] of rows) for (const k of keyList.split(', ')) {
    const f = path.join(entry.replace(/\//g, '-'), k + '.txt'), rd = (d) => { try { return fs.readFileSync(path.join(d, f), 'utf8').split('\n'); } catch (e) { return []; } };
    const a = rd(there), b = rd(here), diffs = [], seenKeys = new Map(a.map((l) => l.split(' = ')).map(([x, y]) => [x, y]));
    for (const l of b) { const [x, y] = l.split(' = '); if (seenKeys.has(x)) { if (seenKeys.get(x) !== y) diffs.push(`${x}: ${seenKeys.get(x)} → ${y}`); seenKeys.delete(x); } else if (l) diffs.push(`${x}: (absent) → ${y}`); }
    for (const [x, y] of seenKeys) if (x) diffs.push(`${x}: ${y} → (absent)`);
    console.error(`\n${entry} / ${k}: ${diffs.length} differing lines; first ${Math.min(10, diffs.length)}:\n  ` + diffs.slice(0, 10).join('\n  '));
  }
  console.error(`\nfull dumps: ${path.relative(process.cwd(), here)} (working tree) and ${path.relative(process.cwd(), there)} (HEAD)`);
}
const want = JSON.parse(fs.readFileSync(FILE, 'utf8')), bad = [];
for (const k of new Set([...Object.keys(want), ...Object.keys(out)])) {
  const a = want[k], b = out[k];
  if (typeof a === 'string' || typeof b === 'string') { if (a !== b) bad.push(k); continue; }
  const keys = [...new Set([...Object.keys(a || {}), ...Object.keys(b || {})])].filter((x) => (a || {})[x] !== (b || {})[x]);
  if (keys.length) bad.push(`${k}: ${keys.join(', ')}`);
}
if (bad.length) {
  console.error('GOLDEN MISMATCH (run with --update only if the change is intended):\n  ' + bad.join('\n  '));
  try { explain(bad.filter((b) => b.includes(': ')).map((b) => b.split(': '))); } catch (e) { console.error('(could not show the differences: ' + e.message + ')'); }
  process.exit(1);
}
console.log('golden state matches');
