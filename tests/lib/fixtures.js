// Node-only late saves (VB-193). The simulation never imports this module.
const fs = require('fs'), path = require('path'), zlib = require('zlib'), crypto = require('crypto');
const { execFileSync } = require('child_process');
const root = path.join(__dirname, '../..'), DIR = path.join(root, 'tests/fixtures');
// A fixture is saved after `year` whole years, or (VB-202) at the first year's end with at least `living` alive, by year `maxYear` at the latest.
const FIXTURES = {
  'small-y5': { cols: 180, rows: 130, year: 5 }, 'small-y40': { cols: 180, rows: 130, year: 40 },
  'medium-y5': { cols: 280, rows: 200, year: 5 }, 'medium-ref': { cols: 280, rows: 200, living: 1000, maxYear: 60 },
};
const hash = (data) => crypto.createHash('sha256').update(data).digest('hex');
const goldenHash = () => hash(fs.readFileSync(path.join(root, 'tests/golden.json')));
const format = () => require('../../src/load.js')['sim/saves'].FORMAT;
function spec(name) { if (!Object.hasOwn(FIXTURES, name)) throw new Error(`unknown fixture ${name}`); return FIXTURES[name]; }
function files(name, dir = DIR) { spec(name); return { save: path.join(dir, name + '.gz'), stamp: path.join(dir, name + '.json') }; }
function validateStamp(name, stamp) {
  const def = spec(name), byLiving = def.living !== undefined;
  const yearOk = byLiving ? Number.isInteger(stamp?.year) && stamp.year >= 1 && stamp.year <= def.maxYear
    && stamp.target === def.living && stamp.reached === (stamp.living >= def.living) : stamp?.year === def.year;
  if (!stamp || stamp.name !== name || !yearOk || typeof stamp.goldenHash !== 'string'
      || !Number.isInteger(stamp.format) || !/^[a-f0-9]{40}$/.test(stamp.commit) || !/^[a-f0-9]{64}$/.test(stamp.saveHash)
      || !['living', 'pawnRecords', 'events', 'jsonBytes', 'gzipBytes'].every((k) => Number.isInteger(stamp[k]) && stamp[k] >= 0)
      || !Number.isFinite(stamp.minutes) || stamp.minutes < 0) throw new Error(`${name}: invalid fixture stamp; remake the fixtures`);
}
function status(name, { dir = DIR } = {}) {
  const f = files(name, dir);
  if (!fs.existsSync(f.save) || !fs.existsSync(f.stamp)) return { name, status: 'missing' };
  const stamp = JSON.parse(fs.readFileSync(f.stamp, 'utf8'));
  validateStamp(name, stamp);
  return { name, status: stamp.goldenHash === goldenHash() && stamp.format === format() ? 'fresh' : 'stale', stamp };
}
// Publish the stamp last: a partial write is never mistaken for a matching save.
function writeFixture(name, compressed, stamp, { dir = DIR } = {}) {
  const f = files(name, dir); fs.mkdirSync(dir, { recursive: true });
  const suffix = `.tmp-${process.pid}`;
  try {
    fs.writeFileSync(f.save + suffix, compressed);
    fs.writeFileSync(f.stamp + suffix, JSON.stringify(stamp, null, 2) + '\n');
    fs.renameSync(f.save + suffix, f.save); fs.renameSync(f.stamp + suffix, f.stamp);
  } finally {
    for (const p of [f.save, f.stamp]) fs.rmSync(p + suffix, { force: true });
  }
}
const git = (args, opts = {}) => execFileSync('git', args, { cwd: root, timeout: 30000, maxBuffer: 128 * 1024 * 1024, ...opts });
function fetchFixtures({ dir = DIR, repo = root, remote = 'origin', notice = console.log } = {}) {
  const run = (args) => git(args, { cwd: repo, stdio: ['ignore', 'pipe', 'pipe'] });
  try { run(['fetch', remote, 'fixtures']); }
  catch (e) { notice('fixtures: fetch unavailable (offline or no fixtures branch); keeping local saves'); return false; }
  const commit = run(['rev-parse', 'FETCH_HEAD']).toString().trim(), pairs = [];
  // A remote set made for another fixture list (VB-202 added medium-ref and dropped medium-y60) replaces nothing, as offline.
  const present = new Set(run(['ls-tree', '-r', '--name-only', commit]).toString().split('\n'));
  const lacking = Object.keys(FIXTURES).filter((name) => ['gz', 'json'].some((ext) => !present.has(`tests/fixtures/${name}.${ext}`)));
  if (lacking.length) {
    notice(`fixtures: ${remote}/fixtures (${commit.slice(0, 7)}) lacks ${lacking.join(', ')}; keeping local saves`
      + ' (run node tools/fixtures.js make)');
    return false;
  }
  // Read and check the whole branch before replacing any local fixture.
  for (const name of Object.keys(FIXTURES)) {
    const compressed = run(['show', `${commit}:tests/fixtures/${name}.gz`]);
    const stamp = JSON.parse(run(['show', `${commit}:tests/fixtures/${name}.json`]).toString());
    validateStamp(name, stamp);
    if (hash(compressed) !== stamp.saveHash) throw new Error(`${name}: damaged remote fixture`);
    pairs.push([name, compressed, stamp]);
  }
  for (const [name, compressed, stamp] of pairs) writeFixture(name, compressed, stamp, { dir });
  notice(`fixtures: fetched ${pairs.length} saves from ${remote}/fixtures (${commit.slice(0, 7)})`);
  return true;
}
let fetched = false;
function loadFixture(name, { dir = DIR, fetch = true, notice = console.log } = {}) {
  let info = status(name, { dir });
  if (info.status === 'missing' && fetch && !fetched) { fetched = true; fetchFixtures({ dir, notice }); info = status(name, { dir }); }
  if (info.status === 'missing') { notice(`${name}: missing; skipped (run node tools/fixtures.js make ${name})`); return null; }
  if (info.stamp.format !== format()) throw new Error(`${name}: save format ${info.stamp.format}, expected ${format()}; remake the fixtures`);
  const compressed = fs.readFileSync(files(name, dir).save);
  if (hash(compressed) !== info.stamp.saveHash) throw new Error(`${name}: save checksum differs; remake the fixtures`);
  const data = JSON.parse(zlib.gunzipSync(compressed).toString('utf8')), def = spec(name);
  if (data.format !== format()) throw new Error(`${name}: incompatible save format; remake the fixtures`);
  if (data.seed !== 7 || data.scenario !== 'populous' || data.cols !== def.cols || data.rows !== def.rows) {
    throw new Error(`${name}: wrong scenario, seed or map; remake the fixtures`);
  }
  const VB = require('../../src/load.js'), it = VB.gen.generate(data.seed, { cols: data.cols, rows: data.rows });
  let r; while (!(r = it.next()).done);
  const st = VB.sim.load(r.value, data), stamp = info.stamp;
  // Scenarios start at 06:00; fixtures are made after N complete years, with floating-point step error allowed.
  if (Math.abs(st.t - (stamp.year * VB.sim.YEAR + 6)) > 1e-4 || st.pawns.length !== stamp.pawnRecords || st.record.length !== stamp.events
      || st.pawns.filter((p) => p.alive).length !== stamp.living) throw new Error(`${name}: stamp does not match state; remake the fixtures`);
  const stale = info.status === 'stale';
  if (stale) notice(`${name}: stale golden hash; using the saved state`);
  return { st, stamp, stale };
}
module.exports = { root, DIR, FIXTURES, hash, goldenHash, format, spec, files, status, writeFixture, fetchFixtures, loadFixture, git };
