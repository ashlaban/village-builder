// readSource (VB-373): .ts text is read as JavaScript with every token where it was; the tools read src/ only through it.
const assert = require('assert'), fs = require('fs'), os = require('os'), path = require('path'), { parse } = require('acorn');
const { readSource, stripTypes } = require('../tools/lib/source.js');

const ts = [
  "import type { Foo } from './foo';",
  'interface Box<T> { v: T; }',
  'type Id = number;',
  'const first = <T,>(xs: T[], i?: number): T => (xs as any)[i || 0];',
  'function put<K extends string>(b: Box<K>, k: K): Box<K> { return b; }',
  'const n: Id = first<number>([1, 2], 0) as Id;',
  '',
].join('\n');
const out = stripTypes(ts);
assert.strictEqual(out.length, ts.length, 'the text keeps its length');
const origLines = ts.split('\n'), outLines = out.split('\n');
assert.strictEqual(outLines.length, origLines.length, 'the text keeps its lines');
outLines.forEach((l, i) => assert.strictEqual(l.length, origLines[i].length, `line ${i + 1} keeps its columns`));
const tokens = [];
parse(out, { ecmaVersion: 'latest', sourceType: 'module', onToken: tokens });
assert(tokens.some((t) => out.slice(t.start, t.end) === 'first'), 'the result parses');
for (const t of tokens) assert.strictEqual(ts.slice(t.start, t.end), out.slice(t.start, t.end), `token at ${t.start} is where it was`);

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'source-'));
fs.writeFileSync(path.join(dir, 'a.ts'), 'const a: number = 1;\n');
fs.writeFileSync(path.join(dir, 'b.js'), 'const b = 1;\n');
assert.strictEqual(readSource(path.join(dir, 'b.js')), 'const b = 1;\n', '.js is read as it is');
assert.strictEqual(readSource(path.join(dir, 'a.ts')).includes(': number'), false, '.ts is stripped');
fs.rmSync(dir, { recursive: true });

// the files that scan src/ read it only through readSource
const root = path.join(__dirname, '..');
for (const f of ['tools/writes.js', 'tests/dependencies.js', 'tools/stocks.js', 'tools/write-scopes.js', 'tests/lint.js', 'tests/lintrules.js',
  'tests/ownershiprules.js', 'tests/record.js', 'tests/commands.js', 'tests/registry.js', 'tools/wrap.js']) {
  fs.readFileSync(path.join(root, f), 'utf8').split('\n').forEach((l, i) => {
    if (/readFileSync/.test(l) && /src\/|'src'|\bfile\b|\bf\b/.test(l) && !/\.json|\.html|backlog|script>/.test(l)) assert.fail(`${f}:${i + 1} reads a file directly: ${l.trim()}`);
  });
}
console.log('source ok');
