// Structure lint: @sys header on line 1, no line over 160 characters; no clock or unseeded random in the modules
// (`// lint-allow: clock <reason>` exempts a line); the page script only writes the allowed fields of st. The page script's files
// (src/page/*.js, listed in src/page.json; VB-053) get the structure checks and the page rule, not the clock rule: the page may read the clock.
// Existing long lines are kept in tests/lint-baseline.json and may only go down; `--update` lowers the baseline.
// Length is no cap (VB-410, VB-411): a module over 400 lines needs an open task that splits it ("Refactor: ..." naming its key in the title);
// with one it may grow. A module kept over the line without a task is in the baseline at its length, which only falls (`src/gen.js`).
// Width the same way (VB-412): a module over 15 exports, counted on its loaded namespace, may add one only with such a task open;
// tests/width-baseline.json holds the modules over 15 at their counts, which only fall. `sim`, the facade that gathers the others, is not counted.
const fs = require('fs'), path = require('path'), { clockUse, pageWrites, counterUses, splitTask } = require('./lint-rules.js');
const root = path.join(__dirname, '..'), BASE = path.join(__dirname, 'lint-baseline.json');
const SPLIT_LINES = 400, MAX_COLS = 160, MAX_EXPORTS = 15, WIDTH = path.join(__dirname, 'width-baseline.json'), FACADES = new Set(['sim']);
const files = JSON.parse(fs.readFileSync(path.join(root, 'src/manifest.json'), 'utf8')).map((f) => 'src/' + f).concat('src/load.js');
const pageFiles = JSON.parse(fs.readFileSync(path.join(root, 'src/page.json'), 'utf8')).map((f) => 'src/' + f);
const key = (f) => (f === 'src/load.js' ? 'load' : f.slice(4, -3));
const base = fs.existsSync(BASE) ? JSON.parse(fs.readFileSync(BASE, 'utf8')) : {};
const cur = {}, errors = [], notes = [];
let tasks = null; // the backlog's tasks, read only when a module is over the line
const openTasks = () => tasks || (tasks = fs.readdirSync(path.join(root, 'backlog')).filter((n) => /^VB-\d+\.md$/.test(n)).map((n) => {
  const text = fs.readFileSync(path.join(root, 'backlog', n), 'utf8'), m = /^# (VB-\d+): (.*)$/m.exec(text), s = /^Status: (.*)$/m.exec(text);
  return { id: m ? m[1] : n.slice(0, -3), title: m ? m[2] : '', status: s ? s[1] : '' };
}));
for (const f of files.concat(pageFiles)) {
  const lines = fs.readFileSync(path.join(root, f), 'utf8').split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  const head = new RegExp(`^// @sys ${key(f).replace('/', '\\/')}: \\S.*$`);
  const long = lines.map((l, i) => (l.length > MAX_COLS ? i + 1 : 0)).filter(Boolean);
  const headOk = head.test(lines[0] || '');
  if (!headOk) errors.push(`${f}:1 line 1 must be "// @sys ${key(f)}: <purpose>"`);
  cur[f] = { lines: lines.length, longLines: long.length };
  const b = { lines: 0, longLines: 0, ...base[f] };
  if (lines.length > SPLIT_LINES && lines.length > b.lines) {
    const id = splitTask(key(f), openTasks());
    if (id) notes.push(`${f}: ${lines.length} lines, over ${SPLIT_LINES}; ${id} splits it`);
    else errors.push(`${f}:${lines.length} ${lines.length} lines, over ${b.lines > SPLIT_LINES ? `its baseline of ${b.lines}` : SPLIT_LINES}, and no open task splits it. Do not pack lines or move code to make room: `
      + `open the task (node tools/backlog.js new name="Refactor: split ${key(f)} by concern" ...), name it in the PR, and go on`);
  }
  if (lines.length < b.lines) notes.push(`${f}: improved (lines ${b.lines} -> ${lines.length}); run lint.js --update`);
  if (long.length > b.longLines) errors.push(...long.map((n) => `${f}:${n} line over ${MAX_COLS} characters (${long.length} long lines, baseline ${b.longLines})`));
  if (long.length < b.longLines) notes.push(`${f}: improved (long lines ${b.longLines} -> ${long.length}); run lint.js --update`);
}
// determinism: the modules read no clock and draw no unseeded random numbers
for (const f of files) fs.readFileSync(path.join(root, f), 'utf8').split('\n').forEach((l, i) => {
  const hit = clockUse(l); if (hit) errors.push(`${f}:${i + 1} ${hit} in a module (use the seeded random source, or add "// lint-allow: clock <reason>")`);
});
// a rule contribution's `source` is the module whose file registers it (VB-232)
for (const f of files) fs.readFileSync(path.join(root, f), 'utf8').split('\n').forEach((l, i) => {
  const m = /\.contribute\(\{[^\n]*?\bsource: '([^']*)'/.exec(l);
  if (m && m[1] !== key(f)) errors.push(`${f}:${i + 1} a contribution's source is '${m[1]}', but this file is ${key(f)}: register it in the module it names`);
});
// the page only reads st: it may set visualDirty, naturalDeaths and driftMul, and clear rigDirty, treeDirty, biomeDirty, pathDirty and landDirty
for (const f of ['src/body.html', ...pageFiles]) fs.readFileSync(path.join(root, f), 'utf8').split('\n').forEach((l, i) => {
  for (const wr of pageWrites(l)) errors.push(`${f}:${i + 1} the page writes to the simulation state: ${wr}`);
});
// every top-level key of w and st must have an @state tag: `// @state st.a,b: ...` or `// @state st.a: ...`
const tagged = { w: new Set(), st: new Set() };
for (const f of files) for (const line of fs.readFileSync(path.join(root, f), 'utf8').split('\n').filter((l) => l.includes('@state '))) for (const m of line.matchAll(/\b(w|st)\.([\w,]+)/g)) m[2].split(',').forEach((k) => tagged[m[1]].add(k));
const VB = require('../src/load.js');
for (const f of files.filter((f) => f !== 'src/vb.js')) {
  fs.readFileSync(path.join(root, f), 'utf8').split('\n').forEach((line, i) => {
    for (const hit of counterUses(line, new Set(Object.keys(VB.COUNTERS)))) errors.push(`${f}:${i + 1} forbidden counter use: ${hit} (only standalone increments; use braces for conditional increments)`);
  });
}
const worldOf = (seed) => { const it = VB.gen.generate(seed); let r; while (!(r = it.next()).done); return r.value; };
const w = worldOf(7), states = [VB.sim.seed(worldOf(7), 7, 'founders'), VB.sim.seed(worldOf(7), 7, 'heirs')];
for (const k of Object.keys(w)) if (!tagged.w.has(k)) errors.push(`src/gen.js: top-level key w.${k} has no @state tag`);
for (const k of new Set(states.flatMap((s) => Object.keys(s)))) if (k !== 'w' && !tagged.st.has(k)) errors.push(`src/sim.js: top-level key st.${k} has no @state tag`);
const width = fs.existsSync(WIDTH) ? JSON.parse(fs.readFileSync(WIDTH, 'utf8')) : {}, wide = {};
for (const f of files) {
  const k = key(f), ns = VB[k];
  if (FACADES.has(k) || !ns || typeof ns !== 'object') continue;
  const n = Object.keys(ns).length, was = width[k] || 0;
  if (n > MAX_EXPORTS) wide[k] = was ? Math.min(was, n) : n;
  if (n <= MAX_EXPORTS || n <= was) { if (n < was) notes.push(`${f}: improved (exports ${was} -> ${n}); run lint.js --update`); continue; }
  const id = splitTask(k, openTasks());
  if (id) notes.push(`${f}: ${n} exports, over ${was || MAX_EXPORTS}; ${id} splits it`);
  else errors.push(`${f}: ${n} exports, over ${was ? `its baseline of ${was}` : MAX_EXPORTS}, and no open task splits it. Do not fold several things into one export or export from `
    + `another module to make room: open the task (node tools/backlog.js new name="Refactor: split ${k} by concern" ...), name it in the PR, and go on`);
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
