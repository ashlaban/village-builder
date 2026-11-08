// Lifecycle tests publish to a directory that stands in for the release (VB-223); they never contact GitHub or publish real saves.
const assert = require('assert'), fs = require('fs'), path = require('path'), zlib = require('zlib');
const F = require('./lib/fixtures.js'), { publish, advanceYears } = require('../tools/fixtures.js');
fs.mkdirSync(path.join(F.root, 'work'), { recursive: true });
const scratch = fs.mkdtempSync(path.join(F.root, 'work/fixture-tools-'));
const dir = path.join(scratch, 'saves'), releaseDir = path.join(scratch, 'release'), release = F.directoryRelease(releaseDir);
const notice = () => {};
// VB-202: a fixture by population stops at the first year's end with enough living, or at its last year.
function years(def, livingByYear) {
  const st = { year: 0, pawns: [] }, Sim = { YEAR: 1, advance(s) {
    s.year++; s.pawns = Array.from({ length: livingByYear(s.year) }, () => ({ alive: true })).concat([{ alive: false }]);
  } };
  return advanceYears(Sim, st, def);
}
assert.strictEqual(years({ year: 5 }, () => 9999), 5, 'a fixed fixture runs its years whatever the living');
assert.strictEqual(years({ living: 1000, maxYear: 60 }, (y) => 900 + 10 * y), 10, 'stops at the first year with 1,000 living');
assert.strictEqual(years({ living: 1000, maxYear: 60 }, () => 5000), 1, 'at least one year');
assert.strictEqual(years({ living: 1000, maxYear: 60 }, () => 999), 60, 'never reached: stops at the last year');
assert.strictEqual(F.spec('medium-ref').living, 1000);
assert(!Object.hasOwn(F.FIXTURES, 'medium-y60'), 'medium-y60 was dropped (Kim, 8 November)');
const head = F.git(['rev-parse', 'HEAD']).toString().trim();
const stampFor = (name, compressed) => {
  const def = F.spec(name), byLiving = def.living !== undefined;
  return { name, commit: head, format: F.format(), goldenHash: F.goldenHash(), year: byLiving ? 14 : def.year,
    ...(byLiving ? { target: def.living, reached: true } : {}), living: byLiving ? def.living : 1, pawnRecords: 1, events: 0, minutes: 0,
    jsonBytes: 1, gzipBytes: compressed.length, saveHash: F.hash(compressed) };
};
const fetchInto = (to, from = release) => {
  const notices = [], ok = F.fetchFixtures({ dir: to, release: from, notice: (m) => notices.push(m) });
  return { ok, said: notices.join('\n') };
};
const manifestOf = () => JSON.parse(fs.readFileSync(path.join(releaseDir, F.MANIFEST), 'utf8'));
const writeManifest = (m) => fs.writeFileSync(path.join(releaseDir, F.MANIFEST), JSON.stringify(m));
try {
  assert.throws(() => F.status('../golden'), /unknown fixture/);
  assert.strictEqual(F.status('small-y5', { dir }).status, 'missing');
  assert.strictEqual(F.loadFixture('small-y5', { dir, fetch: false, notice }), null);
  for (const [name, def] of Object.entries(F.FIXTURES)) {
    // Tiny transport payloads: full save/load and invariants are exercised separately by tests/fixtures.js.
    const compressed = zlib.gzipSync(JSON.stringify({ format: F.format(), seed: 7, scenario: 'populous', cols: def.cols, rows: def.rows }));
    F.writeFixture(name, compressed, stampFor(name, compressed), { dir });
  }
  // A population fixture's stamp names its year within the limit, its target, and whether it reached it.
  const ref = F.files('medium-ref', dir), refStamp = JSON.parse(fs.readFileSync(ref.stamp));
  assert.strictEqual(F.status('medium-ref', { dir }).status, 'fresh');
  for (const bad of [{ year: 61 }, { year: 0 }, { target: 900 }, { reached: false }, { living: 999 }, { reached: undefined }]) {
    fs.writeFileSync(ref.stamp, JSON.stringify({ ...refStamp, ...bad }));
    assert.throws(() => F.status('medium-ref', { dir }), /invalid fixture stamp/, JSON.stringify(bad));
  }
  fs.writeFileSync(ref.stamp, JSON.stringify({ ...refStamp, year: 60, living: 999, reached: false }));
  assert.strictEqual(F.status('medium-ref', { dir }).status, 'fresh', 'a target never reached is a valid stamp');
  fs.writeFileSync(ref.stamp, JSON.stringify(refStamp) + '\n');
  // Stale, wrong-format, damaged and mislabelled saves are refused, before anything is published.
  const f = F.files('small-y5', dir), stamp = JSON.parse(fs.readFileSync(f.stamp));
  assert.strictEqual(F.status('small-y5', { dir }).status, 'fresh');
  fs.writeFileSync(f.stamp, JSON.stringify({ ...stamp, goldenHash: 'old' }));
  assert.strictEqual(F.status('small-y5', { dir }).status, 'stale');
  assert.throws(() => publish({ dir, release, notice }), /stale/);
  fs.writeFileSync(f.stamp, JSON.stringify({ ...stamp, format: F.format() + 1 }));
  assert.throws(() => F.loadFixture('small-y5', { dir, fetch: false, notice }), /remake the fixtures/);
  fs.writeFileSync(f.stamp, JSON.stringify(stamp));
  const original = fs.readFileSync(f.save);
  fs.writeFileSync(f.save, 'damaged');
  assert.throws(() => F.loadFixture('small-y5', { dir, fetch: false, notice }), /checksum/);
  assert.throws(() => publish({ dir, release, notice }), /damaged/);
  fs.writeFileSync(f.save, original);
  // A matching stamp cannot disguise a save header from a different format or scenario.
  for (const override of [{ format: F.format() + 1 }, { scenario: 'founders' }]) {
    const header = JSON.parse(zlib.gunzipSync(original));
    const wrong = zlib.gzipSync(JSON.stringify({ ...header, ...override }));
    fs.writeFileSync(f.save, wrong);
    fs.writeFileSync(f.stamp, JSON.stringify({ ...stamp, saveHash: F.hash(wrong) }));
    assert.throws(() => F.loadFixture('small-y5', { dir, fetch: false, notice }), /remake the fixtures/);
  }
  fs.writeFileSync(f.save, original); fs.writeFileSync(f.stamp, JSON.stringify(stamp));
  assert(!fs.existsSync(releaseDir), 'a refused publish uploads nothing');
  // Nothing published yet: fetch keeps the local saves, as when offline.
  const fetched = path.join(scratch, 'fetched');
  let got = fetchInto(fetched);
  assert(!got.ok && /not yet published/.test(got.said));
  // A publish: every save and stamp, then the manifest naming their hashes; a fetch takes the whole set.
  const first = publish({ dir, release, notice });
  assert.deepStrictEqual(fs.readdirSync(releaseDir).sort(), [F.MANIFEST, ...Object.keys(F.FIXTURES).flatMap((n) => [n + '.gz', n + '.json'])].sort());
  assert.strictEqual(first.commit, head);
  assert.deepStrictEqual(manifestOf(), first);
  got = fetchInto(fetched);
  assert(got.ok, got.said);
  assert.deepStrictEqual(fs.readFileSync(F.files('small-y5', fetched).save), original);
  for (const name of Object.keys(F.FIXTURES)) assert.strictEqual(F.status(name, { dir: fetched }).status, 'fresh');
  // Replaced in place: a second publish keeps one asset a name, the new stamp beside the new manifest.
  fs.writeFileSync(f.stamp, JSON.stringify({ ...stamp, minutes: 1 }));
  const second = publish({ dir, release, notice });
  assert.notStrictEqual(second.fixtures['small-y5'].json, first.fixtures['small-y5'].json);
  assert.strictEqual(fs.readdirSync(releaseDir).length, 2 * Object.keys(F.FIXTURES).length + 1);
  assert(fetchInto(fetched).ok);
  assert.strictEqual(JSON.parse(fs.readFileSync(F.files('small-y5', fetched).stamp)).minutes, 1);
  // Offline: the local saves stay.
  const offline = { where: 'offline', read() { throw new Error('offline'); }, write() { throw new Error('offline'); } };
  got = fetchInto(fetched, offline);
  assert(!got.ok && /offline/.test(got.said));
  assert.strictEqual(F.status('medium-ref', { dir: fetched }).status, 'fresh', 'offline fetch preserves saves');
  // A set made for another fixture list replaces nothing.
  const complete = manifestOf();
  const { ['medium-ref']: dropped, ...older } = complete.fixtures;
  writeManifest({ ...complete, fixtures: { ...older, 'medium-y60': dropped } });
  got = fetchInto(fetched);
  assert(!got.ok && /lacks medium-ref/.test(got.said), got.said);
  // An asset that no longer matches the manifest (a publish under way) replaces nothing.
  writeManifest(complete);
  const mediumSave = path.join(releaseDir, 'medium-y5.gz'), mediumBytes = fs.readFileSync(mediumSave);
  fs.writeFileSync(mediumSave, zlib.gzipSync('a newer save'));
  got = fetchInto(fetched);
  assert(!got.ok && /medium-y5 differs from the manifest/.test(got.said), got.said);
  fs.writeFileSync(mediumSave, mediumBytes);
  // A set whose manifest matches but whose stamp does not name its save is damaged: refused, and nothing replaced.
  const damaged = zlib.gzipSync('damaged');
  fs.writeFileSync(path.join(releaseDir, 'small-y40.gz'), damaged);
  writeManifest({ ...complete, fixtures: { ...complete.fixtures, 'small-y40': { ...complete.fixtures['small-y40'], gz: F.hash(damaged) } } });
  assert.throws(() => F.fetchFixtures({ dir: fetched, release, notice }), /damaged remote fixture/);
  assert.deepStrictEqual(fs.readFileSync(F.files('small-y5', fetched).save), original);
  // Two publishers: one finishing while the other uploads leaves its manifest, and the mixed assets are refused, never fetched.
  publish({ dir, release, notice });
  const rival = { ...release, write(paths) {
    release.write(paths);
    if (paths.length > 1) writeManifest({ ...manifestOf(), commit: 'rival' });
  } };
  assert.throws(() => publish({ dir, release: rival, notice }), /another publisher/);
  assert.strictEqual(manifestOf().commit, 'rival');
  writeManifest({ ...manifestOf(), fixtures: { ...manifestOf().fixtures, 'small-y5': { gz: 'rival', json: 'rival' } } });
  got = fetchInto(fetched);
  assert(!got.ok && /small-y5 differs from the manifest/.test(got.said), got.said);
  // GitHub's release reads with curl, which takes the stand-in's directory as a file:// URL.
  publish({ dir, release, notice });
  const viaCurl = path.join(scratch, 'via-curl');
  got = fetchInto(viaCurl, F.githubRelease({ url: 'file://' + releaseDir }));
  assert(got.ok, got.said);
  assert.deepStrictEqual(fs.readFileSync(F.files('small-y5', viaCurl).save), original);
  // GitHub's release needs a token to publish, and says so before uploading anything.
  const token = process.env.GH_TOKEN;
  delete process.env.GH_TOKEN;
  try { assert.throws(() => F.githubRelease({ url: 'http://127.0.0.1:9' }).write([]), /GH_TOKEN/); }
  finally { if (token !== undefined) process.env.GH_TOKEN = token; }
  console.log('fixture tools: status, stale/format/checksum rejection, release publish and fetch, in-place replacement, offline, older and'
    + ' mixed sets, damaged remote, rival publisher, curl and token checks pass');
} finally { fs.rmSync(scratch, { recursive: true, force: true }); }
