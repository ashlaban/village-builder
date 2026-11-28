// @suite fast
// Structure lint: every source module is listed once and has an @sys header on line 1; no line over 160 characters, clock or unseeded random
// (`// lint-allow: clock <reason>` exempts a line); the page script only writes the allowed fields of st. The page script's files
// (src/page/*.js, listed in src/page.json; VB-053) get the structure checks and the page rule, not the clock rule: the page may read the clock.
// Existing long lines are kept in tests/lint-baseline.json and may only go down; `--update` lowers the baseline.
// The sources are formatted by Prettier (`npm run format`; tests/format.js checks it), so a line counted here is a formatted line.
// Length is no cap (VB-413, VB-414): a module over 700 formatted lines (the 400 of the packed sources, rescaled) needs an open
// line naming its key in the split collector (`node tools/backlog.js collect split`);
// with one it may grow. A module kept over the line without a task is in the baseline at its length, which only falls.
// Width the same way (VB-415): a module over 15 exports, counted on its loaded namespace, may add one only with such a task open;
// tests/width-baseline.json holds the modules over 15 at their counts, which only fall. `sim`, the facade that gathers the others, is not counted.
const { readSource } = require('../tools/lib/source.js');
const fs = require('fs'), path = require('path'), { clockUse, pageWrites, counterUses, splitTask, exportReaders, leftOut } = require('./lint-rules.js');
const root = path.join(__dirname, '..'), BASE = path.join(__dirname, 'lint-baseline.json');
const SPLIT_LINES = 700, MAX_COLS = 160, MAX_EXPORTS = 15, WIDTH = path.join(__dirname, 'width-baseline.json'), FACADES = new Set(['sim']);
// The registries (VB-454): modules that know every domain by design and call back what the others export for them. An export read by
// registries alone is no interface another domain can lean on, so the width lint leaves it out. A module joins only here, with its reason.
const REGISTRIES = {
  'sim/kinds': 'job kinds: each kind\'s done, plan and cost callbacks are exported by the domain that owns the kind',
  'sim/clock': 'the calendar: each entry\'s run is exported by the domain that owns it',
};
const files = JSON.parse(fs.readFileSync(path.join(root, 'src/manifest.json'), 'utf8')).map((f) => 'src/' + f).concat('src/load.js');
const pageFiles = JSON.parse(fs.readFileSync(path.join(root, 'src/page.json'), 'utf8')).map((f) => 'src/' + f);
const key = (f) => f.slice(4, -path.extname(f).length);
const base = fs.existsSync(BASE) ? JSON.parse(fs.readFileSync(BASE, 'utf8')) : {};
const cur = {}, errors = [], notes = [];
const listed = new Set();
for (const f of files.concat(pageFiles)) {
  if (listed.has(f)) errors.push(`${f}: listed more than once in the source module lists`);
  listed.add(f);
}
for (const entry of fs.readdirSync(path.join(root, 'src'), { recursive: true, withFileTypes: true })) {
  if (!entry.isFile() || !/\.[cm]?[jt]s$/.test(entry.name)) continue;
  const f = path.relative(root, path.join(entry.parentPath, entry.name)).split(path.sep).join('/');
  if (!listed.has(f)) errors.push(`${f}: source module missing from src/manifest.json or src/page.json`);
}
let tasks = null; // the backlog's tasks, read only when a module is over the line
const openTasks = () => tasks || (tasks = fs.readdirSync(path.join(root, 'backlog')).filter((n) => /^VB-\d+\.md$/.test(n)).map((n) => {
  const text = fs.readFileSync(path.join(root, 'backlog', n), 'utf8'), m = /^# (VB-\d+): (.*)$/m.exec(text), s = /^Status: (.*)$/m.exec(text);
  return { id: m ? m[1] : n.slice(0, -3), title: m ? m[2] : '', status: s ? s[1] : '', text };
}));
for (const f of files.concat(pageFiles)) {
  const lines = readSource(f).split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  const prefix = `// @sys ${key(f)}: `;
  const long = lines.map((l, i) => (l.length > MAX_COLS ? i + 1 : 0)).filter(Boolean);
  const head = lines[0] || '';
  const headOk = head.startsWith(prefix) && /^\S/.test(head.slice(prefix.length));
  if (!headOk) errors.push(`${f}:1 line 1 must be "// @sys ${key(f)}: <purpose>"`);
  cur[f] = { lines: lines.length, longLines: long.length };
  const b = { lines: 0, longLines: 0, ...base[f] };
  if (lines.length > SPLIT_LINES && lines.length > b.lines) {
    const id = splitTask(key(f), openTasks());
    if (id) notes.push(`${f}: ${lines.length} lines, over ${SPLIT_LINES}; ${id} splits it`);
    else errors.push(`${f}:${lines.length} ${lines.length} lines, over ${b.lines > SPLIT_LINES ? `its baseline of ${b.lines}` : SPLIT_LINES}, and no open task splits it. Do not pack lines or move code to make room: `
      + `collect it (node tools/backlog.js collect split where=${key(f)} what="${lines.length} lines, over ${SPLIT_LINES}" from=VB-YOURS), name it in the PR, and go on`);
  }
  if (lines.length < b.lines) notes.push(`${f}: improved (lines ${b.lines} -> ${lines.length}); run lint.js --update`);
  if (long.length > b.longLines) errors.push(...long.map((n) => `${f}:${n} line over ${MAX_COLS} characters (${long.length} long lines, baseline ${b.longLines})`));
  if (long.length < b.longLines) notes.push(`${f}: improved (long lines ${b.longLines} -> ${long.length}); run lint.js --update`);
}
// determinism: the modules read no clock and draw no unseeded random numbers
for (const f of files) readSource(f).split('\n').forEach((l, i) => {
  const hit = clockUse(l); if (hit) errors.push(`${f}:${i + 1} ${hit} in a module (use the seeded random source, or add "// lint-allow: clock <reason>")`);
});
// a rule contribution's `source` is the module whose file registers it (VB-232)
for (const f of files) readSource(f).split('\n').forEach((l, i) => {
  const m = /\.contribute\(\{[^\n]*?\bsource: '([^']*)'/.exec(l);
  if (m && m[1] !== key(f)) errors.push(`${f}:${i + 1} a contribution's source is '${m[1]}', but this file is ${key(f)}: register it in the module it names`);
});
// the customs in force are read through one door (VB-231): outside culture and sim/customs no module under src/sim indexes a settlement's
// practice or a culture's customs; it asks inForce, inForceAt or customOf of sim/customs
for (const f of files.filter((f) => f.startsWith('src/sim/') && f !== 'src/sim/customs.js')) readSource(f).split('\n').forEach((l, i) => {
  if (/\.(practice|customs)\[/.test(l)) errors.push(`${f}:${i + 1} indexes a practice array: read the custom in force through sim/customs (inForce, inForceAt, customOf)`);
});
// the page only reads st: it may set visualDirty, naturalDeaths and driftMul, and clear rigDirty, farmDirty, villageDirty, treeDirty, biomeDirty, pathDirty and landDirty
for (const f of ['src/body.html', ...pageFiles]) readSource(f).split('\n').forEach((l, i) => {
  for (const wr of pageWrites(l)) errors.push(`${f}:${i + 1} the page writes to the simulation state: ${wr}`);
});
// every top-level key of w and st must have an @state tag: `// @state st.a,b: ...` or `// @state st.a: ...`
// Tunables (VB-419): a table that left sim/rules keeps a `// @tunable NAME: meaning` line in the comment just above it, so that
// `grep -rn "@tunable" src` finds it wherever it lives (the tables still in sim/rules are found there); each such line names the table
// defined just below it. A table that leaves sim/rules joins LEFT_RULES.
const LEFT_RULES = ['AWAY', 'BIRTH', 'CALL', 'CHILD', 'COMMONS', 'COURT', 'CROPS', 'CROWD', 'DIRNAME', 'FEAST', 'FORAGE',
  'FOUNDERS', 'GIFT', 'GRAZE', 'GROUND', 'HOUSE', 'IDLE', 'MATCH', 'MOOD', 'OUTER', 'PATHS', 'PLOT_PRIO', 'RIVER', 'ROLES', 'ROTATIONS', 'ROUTE', 'SEASONS', 'SERVICE',
  'SLOPE', 'SOCIAL', 'SOIL', 'TERRAIN', 'TIE', 'TILTH', 'WISH', 'WORKDAY'];
const tunables = new Set();
for (const f of files) {
  const lines = readSource(f).split('\n');
  lines.forEach((l, i) => {
    const m = /^\s*\/\/ @tunable (\w+): \S/.exec(l);
    if (!m) return;
    let j = i + 1;
    while (j < lines.length && /^\s*\/\//.test(lines[j])) j++;
    if (!new RegExp(`^\\s*const ${m[1]} =`).test(lines[j] || '')) errors.push(`${f}:${i + 1} @tunable ${m[1]}: the comment is not followed by the table's definition`);
    tunables.add(m[1]);
  });
}
for (const n of LEFT_RULES) if (!tunables.has(n)) errors.push(`${n} left sim/rules: its table needs a "// @tunable ${n}: <meaning>" line above it (VB-419)`);
const tagged = { w: new Set(), st: new Set() };
for (const f of files) for (const line of readSource(f).split('\n').filter((l) => l.includes('@state '))) for (const m of line.matchAll(/\b(w|st)\.([\w,]+)/g)) m[2].split(',').forEach((k) => tagged[m[1]].add(k));
const VB = require('../src/load.js');
for (const f of files.filter((f) => f !== 'src/vb.js')) {
  readSource(f).split('\n').forEach((line, i) => {
    for (const hit of counterUses(line, new Set(Object.keys(VB.COUNTERS)))) errors.push(`${f}:${i + 1} forbidden counter use: ${hit} (only standalone increments; use braces for conditional increments)`);
  });
}
// the keys of a world and of the states seeded on it, on the small islands of tests/lib/probe.js (VB-856: three default islands took 5 of the
// lint's 6 to 7 seconds; the generator gives every size the same keys)
const { generate, scenario } = require('./lib/probe.js');
const w = generate(7), states = [scenario('founders', 7), scenario('heirs', 7)];
for (const k of Object.keys(w)) if (!tagged.w.has(k)) errors.push(`src/gen.js: top-level key w.${k} has no @state tag`);
for (const k of new Set(states.flatMap((s) => Object.keys(s)))) if (k !== 'w' && !tagged.st.has(k)) errors.push(`src/sim.js: top-level key st.${k} has no @state tag`);
const readers = exportReaders(Object.fromEntries(files.filter((f) => f !== 'src/load.js').map((f) => [key(f), readSource(f)])), FACADES);
const width = fs.existsSync(WIDTH) ? JSON.parse(fs.readFileSync(WIDTH, 'utf8')) : {}, wide = {};
for (const f of files) {
  const k = key(f), ns = VB[k];
  if (FACADES.has(k) || !ns || typeof ns !== 'object') continue;
  const names = Object.keys(ns), out = leftOut(names, readers[k], REGISTRIES), n = names.length - Object.keys(out).length, was = width[k] || 0;
  if (names.length > MAX_EXPORTS) {
    const by = {};
    for (const r of Object.values(out)) by[r.join('+')] = (by[r.join('+')] || 0) + 1;
    const list = Object.entries(by).map(([r, c]) => `${r} ${c}`).join(', ') || 'none';
    console.log(`${f}: ${names.length} exports, ${names.length - n} left out (read by registries alone: ${list}), ${n} counted`);
  }
  if (n > MAX_EXPORTS) wide[k] = was ? Math.min(was, n) : n;
  if (n <= MAX_EXPORTS || n <= was) { if (n < was) notes.push(`${f}: improved (exports ${was} -> ${n}); run lint.js --update`); continue; }
  const id = splitTask(k, openTasks());
  if (id) notes.push(`${f}: ${n} exports, over ${was || MAX_EXPORTS}; ${id} splits it`);
  else errors.push(`${f}: ${n} exports, over ${was ? `its baseline of ${was}` : MAX_EXPORTS}, and no open task splits it. Do not fold several things into one export or export from `
    + `another module to make room: collect it (node tools/backlog.js collect split where=${k} what="${n} exports, over ${MAX_EXPORTS}" from=VB-YOURS), `
    + 'name it in the PR, and go on');
}
if (process.argv.includes('--update')) {
  fs.writeFileSync(WIDTH, JSON.stringify(wide, null, 1) + '\n');
  const next = {};
  for (const f of files.concat(pageFiles)) {
    const c = cur[f], b = base[f];
    const n = Math.min(b && b.longLines || 0, c.longLines), kept = Math.min(b && b.lines || 0, c.lines);
    if (n || kept > SPLIT_LINES) next[f] = { ...(kept > SPLIT_LINES ? { lines: kept } : {}), ...(n ? { longLines: n } : {}) };
  }
  fs.writeFileSync(BASE, JSON.stringify(next, null, 1) + '\n'); console.log('lint-baseline.json and width-baseline.json updated'); process.exit(0);
}
notes.forEach((n) => console.log(n));
if (errors.length) { console.error('LINT FAIL:\n  ' + errors.join('\n  ')); process.exit(1); }
console.log('lint ok');
