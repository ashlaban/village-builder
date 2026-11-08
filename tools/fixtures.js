// Late-game fixture lifecycle (VB-193): made here, published as the assets of one release (VB-223); no checkout or index changes.
const fs = require('fs'), path = require('path'), zlib = require('zlib'), os = require('os');
const { spawn } = require('child_process');
const F = require('../tests/lib/fixtures.js');
// Whole years from seeding: `def.year` of them, or (VB-202) until the first year's end with at least `def.living` alive, by
// `def.maxYear` at the latest. Returns the number of years advanced.
function advanceYears(Sim, st, def, report = () => {}) {
  const last = def.year ?? def.maxYear, enough = () => def.living !== undefined && st.pawns.filter((p) => p.alive).length >= def.living;
  let year = 0;
  while (year < last && !(year > 0 && enough())) { Sim.advance(st, Sim.YEAR); year++; report(year, last); }
  return year;
}
function makeOne(name) {
  const def = F.spec(name), VB = require('../src/load.js'), Sim = VB.sim;
  // The stamp names a commit, so uncommitted simulation changes cannot be its provenance.
  F.git(['diff', '--exit-code', 'HEAD', '--', 'src', 'tests/golden.json'], { stdio: 'ignore' });
  const started = Date.now(), golden = F.goldenHash(), commit = F.git(['rev-parse', 'HEAD']).toString().trim();
  const it = VB.gen.generate(7, { cols: def.cols, rows: def.rows }); let r; while (!(r = it.next()).done);
  const st = Sim.seed(r.value, 7, 'populous'), living = () => st.pawns.filter((p) => p.alive).length;
  const year = advanceYears(Sim, st, def, (y, last) => console.log(`${name}: year ${y}/${last}, ${living()} living,`
    + ` ${((Date.now() - started) / 60000).toFixed(2)} min`));
  const data = Sim.save(st), json = Buffer.from(JSON.stringify(data)), compressed = zlib.gzipSync(json);
  F.git(['diff', '--exit-code', 'HEAD', '--', 'src', 'tests/golden.json'], { stdio: 'ignore' });
  if (golden !== F.goldenHash() || commit !== F.git(['rev-parse', 'HEAD']).toString().trim()) throw new Error('source changed during make; remake the fixtures');
  const stamp = { name, commit, format: data.format, goldenHash: golden, year,
    ...(def.living !== undefined ? { target: def.living, reached: living() >= def.living } : {}),
    living: living(), pawnRecords: st.pawns.length, events: st.record.length,
    minutes: (Date.now() - started) / 60000, jsonBytes: json.length, gzipBytes: compressed.length, saveHash: F.hash(compressed) };
  F.writeFixture(name, compressed, stamp);
  if (stamp.reached === false) console.log(`${name}: NOT REACHED: ${stamp.living} living after year ${year}, short of ${def.living}`);
  console.log(`${name}: made in ${stamp.minutes.toFixed(2)} min at year ${year}; ${(json.length / 1e6).toFixed(2)} MB JSON,`
    + ` ${(compressed.length / 1e6).toFixed(2)} MB gzip`);
  return stamp;
}
async function make(names = Object.keys(F.FIXTURES)) {
  names.forEach(F.spec);
  const queue = [...new Set(names)], failed = [];
  const lanes = Math.min(os.availableParallelism(), queue.length);
  await Promise.all(Array.from({ length: lanes }, async () => {
    while (queue.length) {
      const name = queue.shift();
      await new Promise((resolve) => {
        const child = spawn(process.execPath, [__filename, '--make-one', name], { stdio: 'inherit' });
        child.on('error', (e) => { failed.push(`${name}: ${e.message}`); resolve(); });
        child.on('exit', (code, signal) => { if (code !== 0) failed.push(`${name}: ${signal || code}`); resolve(); });
      });
    }
  }));
  if (failed.length) throw new Error('fixture make failed: ' + failed.join(', '));
}
// The saves and stamps first, then the manifest naming their hashes, which fetch reads first (VB-223); every fixture must be fresh.
function publish({ dir = F.DIR, release = F.githubRelease(), notice = console.log } = {}) {
  const paths = [], manifest = { commit: F.git(['rev-parse', 'HEAD']).toString().trim(), fixtures: {} };
  for (const name of Object.keys(F.FIXTURES)) {
    const info = F.status(name, { dir });
    if (info.status !== 'fresh') throw new Error(`${name} is ${info.status}; make all fixtures before publishing`);
    const f = F.files(name, dir), compressed = fs.readFileSync(f.save);
    if (F.hash(compressed) !== info.stamp.saveHash) throw new Error(`${name}: damaged fixture; remake the fixtures`);
    manifest.fixtures[name] = { gz: F.hash(compressed), json: F.hash(fs.readFileSync(f.stamp)), commit: info.stamp.commit };
    paths.push(f.save, f.stamp);
  }
  const current = () => { try { return release.read(F.MANIFEST).toString('utf8'); } catch { return null; } };
  const before = current();
  release.write(paths);
  // Another publisher finished meanwhile, and its saves may be mixed with these: leave its manifest, which fetch then refuses as mixed.
  if (current() !== before) throw new Error('another publisher replaced the set during this publish; publish again');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vb-fixtures-')), file = path.join(tmp, F.MANIFEST);
  try {
    fs.writeFileSync(file, JSON.stringify(manifest, null, 2) + '\n');
    release.write([file]);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  notice(`fixtures: published ${paths.length / 2} saves and ${F.MANIFEST} to ${release.where}`);
  return manifest;
}
// The nightly remake (VB-223): fetch the published set, remake what is stale or missing, and publish only if something was remade.
async function refresh({ publishing = true, notice = console.log } = {}) {
  try { F.fetchFixtures({ notice }); } catch (e) { notice(`fixtures: ${e.message}; remaking`); } // a damaged set is remade, not kept
  const remake = Object.keys(F.FIXTURES).filter((name) => F.status(name).status !== 'fresh');
  if (!remake.length) { notice('fixtures: all fresh; nothing to remake or publish'); return remake; }
  notice(`fixtures: remaking ${remake.join(', ')}`);
  await make(remake);
  if (publishing) publish({ notice });
  else notice('fixtures: remade here and not published (no GH_TOKEN); the nightly workflow publishes them');
  return remake;
}
async function main(args) {
  const [command, ...names] = args;
  if (command === 'make') return make(names.length ? names : undefined);
  if (command === '--make-one' && names.length === 1) return makeOne(names[0]);
  if (command === 'status' && !names.length) {
    for (const name of Object.keys(F.FIXTURES)) {
      const info = F.status(name), s = info.stamp;
      console.log(`${name}: ${info.status}${s ? ` (year ${s.year}, ${s.living} living${s.reached === false ? ', target NOT REACHED' : ''},`
        + ` ${s.minutes.toFixed(2)} min, ${(s.gzipBytes / 1e6).toFixed(2)} MB gzip)` : ''}`);
    }
    return;
  }
  if (command === 'fetch' && !names.length) return F.fetchFixtures();
  if (command === 'publish' && !names.length) return publish();
  if (command === 'refresh' && !names.length) return refresh();
  throw new Error('usage: node tools/fixtures.js make [name...] | status | fetch | publish | refresh');
}
if (require.main === module) main(process.argv.slice(2)).catch((e) => { console.error(e.message); process.exitCode = 1; });
module.exports = { make, makeOne, publish, refresh, advanceYears };
