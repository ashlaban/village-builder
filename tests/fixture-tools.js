// Lifecycle tests use a local bare remote; they never contact origin or publish real saves.
const assert = require('assert'), fs = require('fs'), path = require('path'), zlib = require('zlib');
const F = require('./lib/fixtures.js'), { publish, advanceYears } = require('../tools/fixtures.js');
fs.mkdirSync(path.join(F.root, 'work'), { recursive: true });
const scratch = fs.mkdtempSync(path.join(F.root, 'work/fixture-tools-'));
const dir = path.join(scratch, 'saves'), repo = path.join(scratch, 'repo'), remote = path.join(scratch, 'remote.git');
const notice = () => {}, run = (args) => F.git(args, { cwd: repo, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
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
// Pushes a directory's saves as the orphan branch without publish()'s checks, to stand in for a damaged remote.
function publishRaw(from) {
  const entries = Object.keys(F.FIXTURES).flatMap((name) => Object.entries(F.files(name, from)).map(([kind, file]) => {
    const blob = F.git(['hash-object', '-w', '--stdin'], { cwd: repo, input: fs.readFileSync(file) }).toString().trim();
    return `100644 blob ${blob}\t${name}.${kind === 'save' ? 'gz' : 'json'}\n`;
  }));
  let tree = F.git(['mktree'], { cwd: repo, input: entries.sort().join('') }).toString().trim();
  for (const name of ['fixtures', 'tests']) tree = F.git(['mktree'], { cwd: repo, input: `040000 tree ${tree}\t${name}\n` }).toString().trim();
  const commit = F.git(['commit-tree', tree], { cwd: repo, input: 'raw\n' }).toString().trim();
  F.git(['push', '--force', remote, `${commit}:refs/heads/fixtures`], { cwd: repo, stdio: 'ignore' });
}
const stampFor = (name, head, compressed) => {
  const def = F.spec(name), byLiving = def.living !== undefined;
  return { name, commit: head, format: F.format(), goldenHash: F.goldenHash(), year: byLiving ? 14 : def.year,
    ...(byLiving ? { target: def.living, reached: true } : {}), living: byLiving ? def.living : 1, pawnRecords: 1, events: 0, minutes: 0,
    jsonBytes: 1, gzipBytes: compressed.length, saveHash: F.hash(compressed) };
};
try {
  assert.throws(() => F.status('../golden'), /unknown fixture/);
  assert.strictEqual(F.status('small-y5', { dir }).status, 'missing');
  assert.strictEqual(F.loadFixture('small-y5', { dir, fetch: false, notice }), null);
  fs.mkdirSync(repo); F.git(['init', '--bare', remote], { stdio: 'ignore' });
  F.git(['init', repo], { stdio: 'ignore' });
  run(['config', 'user.name', 'Fixture test']); run(['config', 'user.email', 'fixture-test@example.invalid']);
  fs.writeFileSync(path.join(repo, 'keep.txt'), 'preserve worktree and index\n');
  run(['add', 'keep.txt']); run(['commit', '-m', 'original']);
  const head = run(['rev-parse', 'HEAD']), index = run(['ls-files', '--stage']);
  fs.appendFileSync(path.join(repo, 'keep.txt'), 'uncommitted change\n');
  for (const [name, def] of Object.entries(F.FIXTURES)) {
    // Tiny transport payloads: full save/load and invariants are exercised separately by tests/fixtures.js.
    const compressed = zlib.gzipSync(JSON.stringify({ format: F.format(), seed: 7, scenario: 'populous', cols: def.cols, rows: def.rows }));
    F.writeFixture(name, compressed, stampFor(name, head, compressed), { dir });
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
  const f = F.files('small-y5', dir), stamp = JSON.parse(fs.readFileSync(f.stamp));
  assert.strictEqual(F.status('small-y5', { dir }).status, 'fresh');
  fs.writeFileSync(f.stamp, JSON.stringify({ ...stamp, goldenHash: 'old' }));
  assert.strictEqual(F.status('small-y5', { dir }).status, 'stale');
  assert.throws(() => publish({ dir, repo, remote, notice }), /stale/);
  fs.writeFileSync(f.stamp, JSON.stringify({ ...stamp, format: F.format() + 1 }));
  assert.throws(() => F.loadFixture('small-y5', { dir, fetch: false, notice }), /remake the fixtures/);
  fs.writeFileSync(f.stamp, JSON.stringify(stamp));
  const original = fs.readFileSync(f.save);
  fs.writeFileSync(f.save, 'damaged');
  assert.throws(() => F.loadFixture('small-y5', { dir, fetch: false, notice }), /checksum/);
  assert.throws(() => publish({ dir, repo, remote, notice }), /damaged/);
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
  const first = publish({ dir, repo, remote, notice });
  assert.strictEqual(run(['rev-list', '--count', first]), '1');
  assert.strictEqual(run(['ls-tree', '-r', '--name-only', first]).split('\n').length, 2 * Object.keys(F.FIXTURES).length);
  assert.strictEqual(run(['rev-parse', 'HEAD']), head);
  assert.strictEqual(run(['ls-files', '--stage']), index);
  assert.match(fs.readFileSync(path.join(repo, 'keep.txt'), 'utf8'), /uncommitted change/);
  // Change a stamp so the second tree differs even when both commits share a second.
  fs.writeFileSync(f.stamp, JSON.stringify({ ...stamp, minutes: 1 }));
  const second = publish({ dir, repo, remote, notice });
  assert.notStrictEqual(second, first);
  assert.strictEqual(run(['rev-list', '--count', second]), '1', 'replacement must have no parent');
  // A competing publisher wins after ls-remote: our explicit lease must refuse to overwrite it.
  const originalGit = F.git;
  const competing = F.git(['commit-tree', run(['rev-parse', `${second}^{tree}`])], { cwd: repo, input: 'competing publisher\n' }).toString().trim();
  F.git = (args, opts) => {
    if (args[0] === 'push') originalGit(['push', '--force', remote, `${competing}:refs/heads/fixtures`], { cwd: repo, stdio: 'ignore' });
    return originalGit(args, opts);
  };
  try { assert.throws(() => publish({ dir, repo, remote, notice }), /git push/); }
  finally { F.git = originalGit; }
  assert.strictEqual(run(['ls-remote', '--heads', remote, 'fixtures']).split(/\s+/)[0], competing);
  const fetched = path.join(scratch, 'fetched');
  assert(F.fetchFixtures({ dir: fetched, repo, remote, notice }));
  assert.deepStrictEqual(fs.readFileSync(F.files('small-y5', fetched).save), original);
  assert.strictEqual(F.status('medium-ref', { dir: fetched }).status, 'fresh');
  assert.strictEqual(F.fetchFixtures({ dir: fetched, repo, remote: path.join(scratch, 'absent.git'), notice }), false);
  assert.strictEqual(F.status('medium-ref', { dir: fetched }).status, 'fresh', 'offline fetch preserves saves');
  // A partially populated remote must not replace any local save.
  const tree = run(['mktree']), partial = F.git(['commit-tree', tree], { cwd: repo, input: 'incomplete\n' }).toString().trim();
  run(['push', '--force', remote, `${partial}:refs/heads/fixtures`]);
  const notices = [];
  assert.strictEqual(F.fetchFixtures({ dir: fetched, repo, remote, notice: (m) => notices.push(m) }), false);
  assert.match(notices.join('\n'), /lacks small-y5, small-y40, medium-y5, medium-ref; keeping local saves/);
  assert.strictEqual(F.status('medium-ref', { dir: fetched }).status, 'fresh');
  // A complete set with one damaged save replaces nothing either.
  const damaged = path.join(scratch, 'damaged');
  fs.cpSync(dir, damaged, { recursive: true });
  fs.writeFileSync(F.files('medium-y5', damaged).save, 'damaged');
  publishRaw(damaged);
  assert.throws(() => F.fetchFixtures({ dir: fetched, repo, remote, notice }), /damaged remote fixture/);
  assert.deepStrictEqual(fs.readFileSync(F.files('small-y5', fetched).save), original);
  console.log('fixture tools: status, stale/format/checksum rejection, offline fetch, orphan replacement, lease race and worktree/index preservation pass');
} finally { fs.rmSync(scratch, { recursive: true, force: true }); }
