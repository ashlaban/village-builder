// Is the simulation as it was? Runs the same scenarios from the working tree and from a base commit (a temporary git worktree of it)
// and compares the generated world and the state at seeding and after each year, leaf by leaf. Nothing is recorded: this is the
// evidence of one behaviour-preserving change, not a baseline to keep (docs/testing.md; the golden file is retired, VB-408).
// usage: node tools/same.js [--base REF] [--scenario founders,heirs] [--seeds 7,42] [--map tiny|small|medium|large] [--years N]
//   defaults: base HEAD (so: the uncommitted work against the last commit), founders and heirs, seeds 7 and 42, tiny, 2 years
//   --base REF   the commit the work started from (`git merge-base HEAD origin/main`), a branch or a tag
//   --keep DIR   keep both trees' leaves under DIR (DIR/base, DIR/work: one file an entry and key, one line a leaf)
//   prints `same: ...` and exits 0, or each differing entry and key with its first differing leaves (`pawns[41].household: 7 → 9`)
//   and exits 1. A run takes about as long as `tools/sim.js` at the same scenario, map and years, the runs side by side.
require('./help.js')(__filename);
const fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
const { leaves } = require('../tests/lib/canon.js');
const SIZES = { tiny: [120, 85], small: [180, 130], medium: [280, 200], large: [380, 270] }; // as tools/sim.js
const root = path.join(__dirname, '..');

// One run of one tree, in a process of its own: the leaves of the world and of the state, a file an entry and key.
function dump(tree, out, scenario, seed, map, years) {
  const VB = require(path.join(tree, 'src', 'load.js')), Sim = VB.sim, [cols, rows] = SIZES[map];
  const it = VB.gen.generate(seed, { cols, rows }); let r; while (!(r = it.next()).done);
  const w = r.value, name = `${scenario}-${seed}-${map}`;
  const write = (entry, value) => {
    const dir = path.join(out, `${name}-${entry}`); fs.mkdirSync(dir, { recursive: true });
    for (const k of Object.keys(value).sort()) {
      if (typeof value[k] !== 'function') fs.writeFileSync(path.join(dir, k + '.txt'), leaves(value[k], k, new Map(), []).join('\n') + '\n');
    }
  };
  write('world', w);
  const st = Sim.seed(w, seed, scenario), state = () => ({ ...st, w: undefined });
  write('seed', state());
  for (let y = 1; y <= years; y++) { Sim.advance(st, Sim.YEAR); write(`year${y}`, state()); write(`year${y}-world`, st.w); }
}

// The differing leaves of two dumps: [{ file, count, first }], a file being `entry/key.txt`.
function compare(a, b, show = 5) {
  const files = (d) => (fs.existsSync(d) ? fs.readdirSync(d).flatMap((e) => fs.readdirSync(path.join(d, e)).map((f) => path.join(e, f))) : []);
  const read = (d, f) => { try { return fs.readFileSync(path.join(d, f), 'utf8'); } catch (e) { return ''; } };
  const out = [];
  for (const file of [...new Set([...files(a), ...files(b)])].sort()) {
    const ta = read(a, file), tb = read(b, file);
    if (ta === tb) continue;
    const was = new Map(ta.split('\n').filter(Boolean).map((l) => l.split(' = '))), diffs = [];
    for (const l of tb.split('\n').filter(Boolean)) {
      const [k, v] = l.split(' = ');
      if (!was.has(k)) diffs.push(`${k}: (absent) → ${v}`); else if (was.get(k) !== v) diffs.push(`${k}: ${was.get(k)} → ${v}`);
      was.delete(k);
    }
    for (const [k, v] of was) diffs.push(`${k}: ${v} → (absent)`);
    out.push({ file, count: diffs.length, first: diffs.slice(0, show) });
  }
  return out;
}

const run = (args) => new Promise((resolve, reject) => {
  const p = cp.spawn(process.execPath, [__filename, '--dump', ...args], { stdio: ['ignore', 'inherit', 'pipe'] }); let err = '';
  p.stderr.on('data', (d) => { err += d; });
  p.on('close', (code) => (code ? reject(new Error(`run of ${args[0]} failed:\n${err.trim()}`)) : resolve()));
});

async function main(argv) {
  const arg = (name, fallback) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : fallback; };
  const known = ['--base', '--scenario', '--seeds', '--map', '--years', '--keep'];
  const stray = argv.filter((a, i) => a.startsWith('--') ? !known.includes(a) : !known.includes(argv[i - 1]));
  if (stray.length) throw new Error(`unknown option ${stray[0]} (--help lists them)`);
  const base = arg('--base', 'HEAD'), map = arg('--map', 'tiny'), years = Number(arg('--years', 2));
  const scenarios = arg('--scenario', 'founders,heirs').split(','), seeds = arg('--seeds', '7,42').split(',').map(Number);
  if (!SIZES[map] || !Number.isInteger(years) || years < 0 || seeds.some((s) => !Number.isInteger(s))) throw new Error('bad --map, --years or --seeds');
  const keep = arg('--keep'), tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vb-same-'));
  const out = keep ? path.resolve(keep) : path.join(tmp, 'out'), tree = path.join(tmp, 'base');
  const git = (...a) => cp.execFileSync('git', a, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const commit = git('rev-parse', '--short', `${base}^{commit}`);
  fs.rmSync(path.join(out, 'base'), { recursive: true, force: true }); fs.rmSync(path.join(out, 'work'), { recursive: true, force: true });
  git('worktree', 'add', '--detach', tree, commit);
  let diffs;
  try {
    const jobs = [];
    for (const scenario of scenarios) for (const seed of seeds) for (const [t, d] of [[tree, 'base'], [root, 'work']])
      jobs.push([t, path.join(out, d), scenario, String(seed), map, String(years)]);
    const width = Math.max(1, os.availableParallelism?.() || os.cpus().length);
    await Promise.all(Array.from({ length: width }, async () => { while (jobs.length) await run(jobs.shift()); }));
    diffs = compare(path.join(out, 'base'), path.join(out, 'work'));
  } finally {
    git('worktree', 'remove', '--force', tree);
    if (!keep) fs.rmSync(tmp, { recursive: true, force: true });
  }
  const what = `${scenarios.join(', ')} at seeds ${seeds.join(', ')}, ${map}, ${years} years, against ${base} (${commit})`;
  if (!diffs.length) { console.log(`same: the world and the state at seeding and each year's end, ${what}`); return; }
  for (const d of diffs) console.log(`${d.file.replace(/\.txt$/, '')}: ${d.count} differing leaves\n  ${d.first.join('\n  ')}`);
  console.log(`differs: ${diffs.length} keys, ${what}${keep ? `; leaves in ${keep}` : ' (--keep DIR keeps the leaves)'}`);
  process.exitCode = 1;
}

module.exports = { dump, compare };
if (require.main === module) {
  const a = process.argv.slice(2);
  if (a[0] === '--dump') dump(a[1], a[2], a[3], Number(a[4]), a[5], Number(a[6]));
  else main(a).catch((e) => { console.error('same: ' + e.message); process.exitCode = 2; });
}
