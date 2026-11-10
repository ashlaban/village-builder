// Node-only late saves (VB-193), a local cache made on demand (VB-272). The simulation never imports this module.
// A fixture is a build product of the simulation's sources: it lies under tests/fixtures/<key>/, where the key hashes every module of
// src/manifest.json and the fixture list. A key that matches is the fixture; one that does not is made (minutes). Nothing is stale,
// and nothing is published or fetched.
const fs = require('fs'), path = require('path'), zlib = require('zlib'), crypto = require('crypto');
const { execFileSync, spawnSync } = require('child_process');
const root = path.join(__dirname, '../..'), DIR = path.join(root, 'tests/fixtures');
// A fixture is saved after `year` whole years, or (VB-202) at the first year's end with at least `living` alive, by year `maxYear` at
// the latest. The fixtures of one map are saves of one run, populous at seed 7, each saved as the run passes it.
const SEED = 7, SCENARIO = 'populous';
const FIXTURES = {
  'small-y5': { map: 'small', cols: 180, rows: 130, year: 5 }, 'small-y40': { map: 'small', cols: 180, rows: 130, year: 40 },
  'medium-y5': { map: 'medium', cols: 280, rows: 200, year: 5 },
  'medium-ref': { map: 'medium', cols: 280, rows: 200, living: 1000, maxYear: 60 },
};
const hash = (data) => crypto.createHash('sha256').update(data).digest('hex');
// Read from the working tree at each call: a make checks that it has not moved meanwhile.
function key() {
  const h = crypto.createHash('sha256'), src = path.join(root, 'src'), manifest = fs.readFileSync(path.join(src, 'manifest.json'));
  h.update(JSON.stringify([SEED, SCENARIO, FIXTURES])).update(manifest);
  for (const f of JSON.parse(manifest)) h.update('\0' + f + '\0').update(fs.readFileSync(path.join(src, f)));
  return h.digest('hex').slice(0, 16);
}
const keyDir = (dir = DIR) => path.join(dir, key());
const format = () => require('../../src/load.js')['sim/saves'].FORMAT;
function spec(name) { if (!Object.hasOwn(FIXTURES, name)) throw new Error(`unknown fixture ${name}`); return FIXTURES[name]; }
function files(name, dir = DIR) { spec(name); const d = keyDir(dir); return { save: path.join(d, name + '.gz'), stamp: path.join(d, name + '.json') }; }
function validateStamp(name, stamp) {
  const def = spec(name), byLiving = def.living !== undefined;
  const yearOk = byLiving ? Number.isInteger(stamp?.year) && stamp.year >= 1 && stamp.year <= def.maxYear
    && stamp.target === def.living && stamp.reached === (stamp.living >= def.living) : stamp?.year === def.year;
  if (!stamp || stamp.name !== name || !yearOk || !/^[a-f0-9]{16}$/.test(stamp.key) || typeof stamp.commit !== 'string'
      || !Number.isInteger(stamp.format) || !/^[a-f0-9]{64}$/.test(stamp.saveHash)
      || !['living', 'pawnRecords', 'events', 'jsonBytes', 'gzipBytes'].every((k) => Number.isInteger(stamp[k]) && stamp[k] >= 0)
      || !Number.isFinite(stamp.minutes) || stamp.minutes < 0) throw new Error(`${name}: invalid fixture stamp; remake the fixtures`);
}
function status(name, { dir = DIR } = {}) {
  const f = files(name, dir);
  if (!fs.existsSync(f.save) || !fs.existsSync(f.stamp)) return { name, status: 'missing' };
  const stamp = JSON.parse(fs.readFileSync(f.stamp, 'utf8'));
  validateStamp(name, stamp);
  if (stamp.key !== path.basename(path.dirname(f.stamp))) throw new Error(`${name}: stamp of another key; remake the fixtures`);
  return { name, status: 'made', stamp };
}
// The stamp last: a partial write is never mistaken for a save, and two makes of one key write the same bytes.
function writeFixture(name, compressed, stamp, { dir = DIR } = {}) {
  const f = { save: path.join(dir, stamp.key, name + '.gz'), stamp: path.join(dir, stamp.key, name + '.json') };
  fs.mkdirSync(path.dirname(f.save), { recursive: true });
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
// Makes those of `names` that are missing, here and now (minutes; its progress goes to stderr). True when all are there afterwards.
function ensure(names, { notice = console.log } = {}) {
  const missing = names.filter((name) => status(name).status === 'missing');
  if (!missing.length) return true;
  notice(`fixtures: making ${missing.join(', ')} for key ${key()} (minutes)`);
  const made = spawnSync(process.execPath, [path.join(root, 'tools/fixtures.js'), 'make', ...missing], { stdio: ['ignore', 2, 2] });
  return made.status === 0 && names.every((name) => status(name).status === 'made');
}
// {st, stamp}, or null with a notice. A missing fixture is made first unless `make` is false (a worker whose parent has seen to it).
function loadFixture(name, { dir = DIR, make = dir === DIR, notice = console.log } = {}) {
  if (make) ensure([name], { notice });
  const info = status(name, { dir });
  if (info.status === 'missing') { notice(`${name}: missing; skipped (run node tools/fixtures.js make ${name})`); return null; }
  const compressed = fs.readFileSync(files(name, dir).save);
  if (hash(compressed) !== info.stamp.saveHash) throw new Error(`${name}: save checksum differs; remake the fixtures`);
  const data = JSON.parse(zlib.gunzipSync(compressed).toString('utf8')), def = spec(name);
  if (data.format !== info.stamp.format || data.format !== format()) throw new Error(`${name}: incompatible save format; remake the fixtures`);
  if (data.seed !== SEED || data.scenario !== SCENARIO || data.cols !== def.cols || data.rows !== def.rows) {
    throw new Error(`${name}: wrong scenario, seed or map; remake the fixtures`);
  }
  const VB = require('../../src/load.js'), it = VB.gen.generate(data.seed, { cols: data.cols, rows: data.rows });
  let r; while (!(r = it.next()).done);
  const st = VB.sim.load(r.value, data), stamp = info.stamp;
  // Scenarios start at 06:00; fixtures are made after N complete years, with floating-point step error allowed.
  if (Math.abs(st.t - (stamp.year * VB.sim.YEAR + 6)) > 1e-4 || st.pawns.length !== stamp.pawnRecords || st.record.length !== stamp.events
      || st.pawns.filter((p) => p.alive).length !== stamp.living) throw new Error(`${name}: stamp does not match state; remake the fixtures`);
  return { st, stamp };
}
module.exports = { root, DIR, FIXTURES, SEED, SCENARIO, hash, key, keyDir, format, spec, files, status, writeFixture, ensure, loadFixture, git };
