// Late-game fixtures (VB-193), made here and kept under tests/fixtures/<key>/ (VB-272): one run a map, each fixture saved as it passes.
const fs = require('fs'), path = require('path'), zlib = require('zlib'), os = require('os');
const { spawn } = require('child_process');
const F = require('../tests/lib/fixtures.js');
const KEEP = 3; // keys kept by a make, the newest first; about 15 MB each with all four saves
const livingOf = (st) => st.pawns.filter((p) => p.alive).length;
// One run from seeding, a year at a time, until each of `defs` ({name: def}) has fallen due: after `def.year` whole years, or (VB-202)
// at the first year's end with at least `def.living` alive, by `def.maxYear` at the latest. `due(name, year)` is called as each does.
function runYears(Sim, st, defs, due = () => {}, report = () => {}) {
  const pending = new Set(Object.keys(defs));
  let year = 0;
  while (pending.size) {
    Sim.advance(st, Sim.YEAR); year++; report(year);
    for (const name of [...pending]) {
      const def = defs[name];
      if (def.living !== undefined ? livingOf(st) >= def.living || year >= def.maxYear : year >= def.year) { pending.delete(name); due(name, year); }
    }
  }
  return year;
}
// The map's run, as far as the last of `names`; the map's other fixtures are saved too where the run passes them.
function makeMap(map, names) {
  const VB = require('../src/load.js'), Sim = VB.sim, key = F.key(), started = Date.now();
  const wanted = Object.fromEntries(names.map((name) => [name, F.spec(name)])), { cols, rows } = Object.values(wanted)[0];
  const others = Object.entries(F.FIXTURES).filter(([name, def]) => def.map === map && !wanted[name]);
  let commit = 'unknown';
  try {
    commit = F.git(['rev-parse', 'HEAD']).toString().trim();
    if (F.git(['status', '--porcelain', '--', 'src']).toString().trim()) commit += '-dirty';
  } catch { /* the key names the sources; the commit is only for the reader */ }
  const it = VB.gen.generate(F.SEED, { cols, rows }); let r; while (!(r = it.next()).done);
  const st = Sim.seed(r.value, F.SEED, F.SCENARIO), minutes = () => (Date.now() - started) / 60000;
  const save = (name, year) => {
    const def = F.spec(name), data = Sim.save(st), json = Buffer.from(JSON.stringify(data)), compressed = zlib.gzipSync(json);
    if (key !== F.key()) throw new Error('the sources changed during the make; make the fixtures again');
    const stamp = { name, key, commit, format: data.format, year,
      ...(def.living !== undefined ? { target: def.living, reached: livingOf(st) >= def.living } : {}),
      living: livingOf(st), pawnRecords: st.pawns.length, events: st.record.length,
      minutes: minutes(), jsonBytes: json.length, gzipBytes: compressed.length, saveHash: F.hash(compressed) };
    F.writeFixture(name, compressed, stamp);
    if (stamp.reached === false) console.log(`${name}: NOT REACHED: ${stamp.living} living after year ${year}, short of ${def.living}`);
    console.log(`${name}: made in ${stamp.minutes.toFixed(2)} min at year ${year}; ${(json.length / 1e6).toFixed(2)} MB JSON,`
      + ` ${(compressed.length / 1e6).toFixed(2)} MB gzip`);
  };
  // A fixture not asked for falls due as the others do, and is saved only if the run is still going: it never lengthens the run.
  const passing = new Map(others);
  runYears(Sim, st, wanted, save, (year) => {
    for (const [name, def] of passing) {
      if (def.living !== undefined ? livingOf(st) >= def.living || year >= def.maxYear : year >= def.year) { passing.delete(name); save(name, year); }
    }
    console.log(`${map}: year ${year}, ${livingOf(st)} living, ${minutes().toFixed(2)} min`);
  });
}
// Old keys go, the newest KEEP stay, and whatever else lies in the directory (the saves of before VB-272, at its top).
function clean({ dir = F.DIR, keep = KEEP, notice = console.log } = {}) {
  if (!fs.existsSync(dir)) return [];
  const now = F.key(), entries = fs.readdirSync(dir, { withFileTypes: true });
  const keys = entries.filter((e) => e.isDirectory() && /^[a-f0-9]{16}$/.test(e.name))
    .map((e) => ({ name: e.name, at: e.name === now ? Infinity : fs.statSync(path.join(dir, e.name)).mtimeMs })).sort((a, b) => b.at - a.at);
  const gone = [...keys.slice(Math.max(keep, 0)).map((k) => k.name), ...entries.map((e) => e.name).filter((n) => !keys.some((k) => k.name === n))];
  for (const name of gone) fs.rmSync(path.join(dir, name), { recursive: true, force: true });
  if (gone.length) notice(`fixtures: removed ${gone.join(', ')}`);
  return gone;
}
async function make(names = Object.keys(F.FIXTURES)) {
  names.forEach(F.spec);
  const maps = new Map(), failed = [];
  for (const name of new Set(names)) maps.set(F.spec(name).map, [...(maps.get(F.spec(name).map) || []), name]);
  const queue = [...maps], lanes = Math.min(os.availableParallelism(), queue.length);
  await Promise.all(Array.from({ length: lanes }, async () => {
    while (queue.length) {
      const [map, list] = queue.shift();
      await new Promise((resolve) => {
        const child = spawn(process.execPath, [__filename, '--make-map', map, ...list], { stdio: 'inherit' });
        child.on('error', (e) => { failed.push(`${map}: ${e.message}`); resolve(); });
        child.on('exit', (code, signal) => { if (code !== 0) failed.push(`${map}: ${signal || code}`); resolve(); });
      });
    }
  }));
  if (failed.length) throw new Error('fixture make failed: ' + failed.join(', '));
  clean();
}
const USAGE = `usage: node tools/fixtures.js <command>
  status         the key of the sources as they are, and each fixture under it: made (year, living, minutes to make, size) or missing
  make [name...] make the named fixtures, or all (${Object.keys(F.FIXTURES).join(', ')}), into tests/fixtures/<key>/: one run a map
                 (small about 2 minutes, medium about 1.5, side by side), saving each fixture as the run passes it; keeps the
                 newest ${KEEP} keys
  make-missing name...  make those of the named fixtures that the current key lacks (verify's first step)
  clean          remove every key but the current one
  The key hashes the modules of src/manifest.json: a fixture is made for the sources as they are and is never stale. Nothing is
  fetched or published. In a test or a tool, require('./lib/fixtures.js').loadFixture(name) gives {st, stamp}, making a missing one
  first; npm run verify makes the small pair beside its other scripts.`;
async function main(args) {
  const [command, ...names] = args;
  if (command === 'make') return make(names.length ? names : undefined);
  if (command === 'make-missing' && names.length) {
    const missing = names.filter((name) => F.status(name).status === 'missing');
    if (missing.length) await make(missing);
    return console.log(`fixtures: key ${F.key()}; ${missing.length ? 'made ' + missing.join(', ') : 'nothing to make'}`);
  }
  if (command === '--make-map' && names.length > 1) return makeMap(names[0], names.slice(1));
  if (command === 'status' && !names.length) {
    console.log(`key ${F.key()}`);
    for (const name of Object.keys(F.FIXTURES)) {
      const info = F.status(name), s = info.stamp;
      console.log(`${name}: ${info.status}${s ? ` (year ${s.year}, ${s.living} living${s.reached === false ? ', target NOT REACHED' : ''},`
        + ` ${s.minutes.toFixed(2)} min, ${(s.gzipBytes / 1e6).toFixed(2)} MB gzip)` : ''}`);
    }
    return;
  }
  if (command === 'clean' && !names.length) return clean({ keep: 1 });
  if (command === '--help' || command === '-h' || command === 'help') return console.log(USAGE);
  throw new Error(USAGE);
}
if (require.main === module) main(process.argv.slice(2)).catch((e) => { console.error(e.message); process.exitCode = 1; });
module.exports = { make, makeMap, clean, runYears };
