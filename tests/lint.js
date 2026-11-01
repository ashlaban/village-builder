// Structure lint: @sys header on line 1, at most 400 lines, no line over 160 characters; no clock or unseeded random in the modules
// (`// lint-allow: clock <reason>` exempts a line); the page script only writes the allowed fields of st.
// Existing violations are kept in tests/lint-baseline.json and may only go down; `--update` lowers the baseline.
const fs = require('fs'), path = require('path'), { clockUse, pageWrites } = require('./lint-rules.js');
const root = path.join(__dirname, '..'), BASE = path.join(__dirname, 'lint-baseline.json');
const MAX_LINES = 400, MAX_COLS = 160;
const files = JSON.parse(fs.readFileSync(path.join(root, 'src/manifest.json'), 'utf8')).map((f) => 'src/' + f).concat('src/load.js');
const key = (f) => (f === 'src/load.js' ? 'load' : f.slice(4, -3));
const base = fs.existsSync(BASE) ? JSON.parse(fs.readFileSync(BASE, 'utf8')) : {};
const cur = {}, errors = [], notes = [];
for (const f of files) {
  const lines = fs.readFileSync(path.join(root, f), 'utf8').split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  const head = new RegExp(`^// @sys ${key(f).replace('/', '\\/')}: \\S.*$`);
  const long = lines.map((l, i) => (l.length > MAX_COLS ? i + 1 : 0)).filter(Boolean);
  const headOk = head.test(lines[0] || '');
  if (!headOk) errors.push(`${f}:1 line 1 must be "// @sys ${key(f)}: <purpose>"`);
  cur[f] = { lines: lines.length, longLines: long.length };
  const b = base[f] || { lines: Math.min(lines.length, MAX_LINES), longLines: 0 };
  if (lines.length > MAX_LINES && lines.length > b.lines) errors.push(`${f}:${lines.length} file has ${lines.length} lines, limit ${Math.max(MAX_LINES, b.lines)}`);
  if (long.length > b.longLines) errors.push(...long.map((n) => `${f}:${n} line over ${MAX_COLS} characters (${long.length} long lines, baseline ${b.longLines})`));
  if (lines.length < b.lines && b.lines > MAX_LINES || long.length < b.longLines) notes.push(`${f}: improved (lines ${b.lines} -> ${lines.length}, long lines ${b.longLines} -> ${long.length}); run lint.js --update`);
}
// determinism: the modules read no clock and draw no unseeded random numbers
for (const f of files) fs.readFileSync(path.join(root, f), 'utf8').split('\n').forEach((l, i) => {
  const hit = clockUse(l); if (hit) errors.push(`${f}:${i + 1} ${hit} in a module (use the seeded random source, or add "// lint-allow: clock <reason>")`);
});
// the page only reads st: it may set visualDirty, naturalDeaths and driftMul, and clear rigDirty, treeDirty, biomeDirty, pathDirty and landDirty
for (const f of ['src/body.html']) fs.readFileSync(path.join(root, f), 'utf8').split('\n').forEach((l, i) => {
  for (const wr of pageWrites(l)) errors.push(`${f}:${i + 1} the page writes to the simulation state: ${wr}`);
});
// every top-level key of w and st must have an @state tag: `// @state st.a,b: ...` or `// @state st.a: ...`
const tagged = { w: new Set(), st: new Set() };
for (const f of files) for (const line of fs.readFileSync(path.join(root, f), 'utf8').split('\n').filter((l) => l.includes('@state '))) for (const m of line.matchAll(/\b(w|st)\.([\w,]+)/g)) m[2].split(',').forEach((k) => tagged[m[1]].add(k));
const VB = require('../src/load.js');
const worldOf = (seed) => { const it = VB.gen.generate(seed); let r; while (!(r = it.next()).done); return r.value; };
const w = worldOf(7), states = [VB.sim.seed(worldOf(7), 7, 'founders'), VB.sim.seed(worldOf(7), 7, 'heirs')];
for (const k of Object.keys(w)) if (!tagged.w.has(k)) errors.push(`src/gen.js: top-level key w.${k} has no @state tag`);
for (const k of new Set(states.flatMap((s) => Object.keys(s)))) if (k !== 'w' && !tagged.st.has(k)) errors.push(`src/sim.js: top-level key st.${k} has no @state tag`);
if (process.argv.includes('--update')) {
  const next = {};
  for (const f of files) {
    const c = cur[f], b = base[f];
    next[f] = b ? { lines: Math.min(b.lines, c.lines), longLines: Math.min(b.longLines, c.longLines) } : c;
  }
  fs.writeFileSync(BASE, JSON.stringify(next, null, 1) + '\n'); console.log('lint-baseline.json updated'); process.exit(0);
}
notes.forEach((n) => console.log(n));
if (errors.length) { console.error('LINT FAIL:\n  ' + errors.join('\n  ')); process.exit(1); }
console.log('lint ok');
