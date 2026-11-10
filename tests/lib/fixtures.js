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
// A save of an older format the build still reads (VB-226) is used, as stale, until the nightly workflow remakes it.
const readable = (f) => require('../../src/load.js')['sim/saves'].READS.includes(f);
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
// VB-223: the saves are the assets of one GitHub release, tagged `fixtures` and replaced in place (Kim, 8 November); a manifest,
// fixtures.json, published last, names the hash of every asset, so a set is fetched whole or not at all. A release is {where, read(name)
// -> Buffer, write(paths)}: githubRelease reads over HTTPS without a token (curl, which follows the session's proxy) and writes with gh and
// GH_TOKEN; directoryRelease stands in for it in tests.
const MANIFEST = 'fixtures.json', TAG = 'fixtures';
const RELEASE_URL = process.env.VB_FIXTURES_URL || `https://github.com/ashlaban/village-builder/releases/download/${TAG}`;
function githubRelease({ url = RELEASE_URL, tag = TAG } = {}) {
  const gh = (args, opts = {}) => execFileSync('gh', args, { cwd: root, timeout: 600000, ...opts });
  return {
    where: url,
    read: (name) => execFileSync('curl', ['-fsSL', '--retry', '2', `${url}/${name}`],
      { maxBuffer: 256 * 1024 * 1024, timeout: 300000, stdio: ['ignore', 'pipe', 'pipe'] }),
    write(paths) {
      if (!process.env.GH_TOKEN) throw new Error('publishing needs GH_TOKEN (the nightly workflow has one); nothing published');
      try { gh(['release', 'view', tag], { stdio: 'ignore' }); }
      catch { gh(['release', 'create', tag, '--prerelease', '--title', 'Late-game fixtures', '--notes', 'Made by node tools/fixtures.js;'
        + ' replaced in place each night by .github/workflows/fixtures.yml (VB-223). Read fixtures.json first.'], { stdio: 'inherit' }); }
      gh(['release', 'upload', tag, ...paths, '--clobber'], { stdio: 'inherit' });
    },
  };
}
function directoryRelease(dir) {
  return {
    where: dir,
    read: (name) => fs.readFileSync(path.join(dir, name)),
    write(paths) { fs.mkdirSync(dir, { recursive: true }); for (const p of paths) fs.copyFileSync(p, path.join(dir, path.basename(p))); },
  };
}
function fetchFixtures({ dir = DIR, release = githubRelease(), notice = console.log } = {}) {
  const keep = (why) => { notice(`fixtures: ${why}; keeping local saves`); return false; };
  let manifest;
  try { manifest = JSON.parse(release.read(MANIFEST).toString('utf8')); }
  catch { return keep(`no fixtures at ${release.where} (offline, or not yet published)`); }
  // A set made for another fixture list (VB-202 added medium-ref and dropped medium-y60) replaces nothing, as offline.
  const lacking = Object.keys(FIXTURES).filter((name) => !manifest.fixtures?.[name]);
  if (lacking.length) return keep(`the set at ${release.where} lacks ${lacking.join(', ')} (run node tools/fixtures.js make)`);
  // Read and check the whole set before replacing any local fixture.
  const pairs = [];
  for (const name of Object.keys(FIXTURES)) {
    let compressed, stampBytes;
    try { compressed = release.read(`${name}.gz`); stampBytes = release.read(`${name}.json`); }
    catch { return keep(`${name} could not be read from ${release.where}`); }
    const want = manifest.fixtures[name];
    // A publish under way, or a race between two: the assets no longer match the manifest.
    if (hash(compressed) !== want.gz || hash(stampBytes) !== want.json) return keep(`${name} differs from the manifest at ${release.where}`);
    const stamp = JSON.parse(stampBytes.toString('utf8'));
    validateStamp(name, stamp);
    if (hash(compressed) !== stamp.saveHash) throw new Error(`${name}: damaged remote fixture`);
    pairs.push([name, compressed, stamp]);
  }
  for (const [name, compressed, stamp] of pairs) writeFixture(name, compressed, stamp, { dir });
  notice(`fixtures: fetched ${pairs.length} saves from ${release.where} (made at ${(manifest.commit || 'unknown').slice(0, 7)})`);
  return true;
}
let fetched = false;
function loadFixture(name, { dir = DIR, fetch = true, notice = console.log } = {}) {
  let info = status(name, { dir });
  if (info.status === 'missing' && fetch && !fetched) { fetched = true; fetchFixtures({ dir, notice }); info = status(name, { dir }); }
  if (info.status === 'missing') { notice(`${name}: missing; skipped (run node tools/fixtures.js make ${name})`); return null; }
  if (!readable(info.stamp.format)) throw new Error(`${name}: save format ${info.stamp.format}, expected ${format()}; remake the fixtures`);
  const compressed = fs.readFileSync(files(name, dir).save);
  if (hash(compressed) !== info.stamp.saveHash) throw new Error(`${name}: save checksum differs; remake the fixtures`);
  const data = JSON.parse(zlib.gunzipSync(compressed).toString('utf8')), def = spec(name);
  if (data.format !== info.stamp.format) throw new Error(`${name}: incompatible save format; remake the fixtures`);
  if (data.seed !== 7 || data.scenario !== 'populous' || data.cols !== def.cols || data.rows !== def.rows) {
    throw new Error(`${name}: wrong scenario, seed or map; remake the fixtures`);
  }
  const VB = require('../../src/load.js'), it = VB.gen.generate(data.seed, { cols: data.cols, rows: data.rows });
  let r; while (!(r = it.next()).done);
  const st = VB.sim.load(r.value, data), stamp = info.stamp;
  // Scenarios start at 06:00; fixtures are made after N complete years, with floating-point step error allowed. A save from before
  // VB-199 gains, as it loads, the events its pawns told beside another (sim/records, indexEvents), at the record's end.
  if (Math.abs(st.t - (stamp.year * VB.sim.YEAR + 6)) > 1e-4 || st.pawns.length !== stamp.pawnRecords || st.record.length < stamp.events
      || st.pawns.filter((p) => p.alive).length !== stamp.living) throw new Error(`${name}: stamp does not match state; remake the fixtures`);
  const stale = info.status === 'stale';
  if (stale) notice(`${name}: stale (golden hash${info.stamp.format !== format() ? `, format ${info.stamp.format}` : ''}); using the saved state`);
  return { st, stamp, stale };
}
module.exports = { root, DIR, FIXTURES, MANIFEST, hash, goldenHash, format, spec, files, status, writeFixture, fetchFixtures, loadFixture, git,
  githubRelease, directoryRelease };
