// Structure lint: @sys header on line 1, at most 400 lines, no line over 160 characters.
// Existing violations are kept in tests/lint-baseline.json and may only go down; `--update` lowers the baseline.
const fs = require('fs'), path = require('path');
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
