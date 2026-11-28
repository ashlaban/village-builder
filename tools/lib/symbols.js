// What a change edits, by enclosing symbol (VB-1678): each changed line of a diff is credited to the module-level declaration it
// stands in (a `function name`, a `const name` at indent 0 or 2, the indent of a module's body inside `VB['key'] = (() => {`), or to the
// module's import block, its export list or its head. The heuristic of docs/plans/VB-1677-replay.js: a line appended after a table is
// credited to the table before it. What merges by itself is left out (MECHANICAL, the tables marked `// @merge union`, IGNORED).
const { spawnSync } = require('child_process');

// The list and bookkeeping files every task appends to: not a footprint while they are lists. When a step of VB-1406 turns one into
// declarations beside their owners, it takes that file off this list.
const IGNORED = new Set(['src/manifest.json', 'src/layers.json', 'src/owners.json', 'src/page.json', 'src/sim.js',
  'tests/counters.json', 'BACKLOG.md', 'BACKLOG_ARCHIVE.md', 'QUESTIONS.md', 'QUESTION_ARCHIVE.md', 'docs/tuning.md',
  'docs/agents/changes.md', 'docs/design-changelog.md']);
const ignored = (f) => IGNORED.has(f) || /^backlog\//.test(f) || /^docs\/agents\/usage\//.test(f) || /^docs\/bench\//.test(f);
// a module's parts that merge by themselves (tools/merge.js): never a footprint
const MECHANICAL = new Set(['(imports)', '(exports)', '(head)']);
const DECL = /^(?:export )?(?:async )?(?:function\*? (\w+)|(?:const|let|var) (\w+)|class (\w+))/;
const WRAPPER = /^VB\[['"][^'"]+['"]\] = \(\(\) => \{\s*$/; // a module's body, at indent 2: its declarations are module-level
const MARK = /^\s*\/\/ @merge union\b/;

// a file's text -> { at: [null, symbol of line 1, ...], marked: Set of the tables marked @merge union }
function symbolMap(text) {
  let sym = '(head)', mark = false, inModule = false; const at = [null], marked = new Set();
  for (const l of String(text).split('\n')) {
    if (WRAPPER.test(l)) inModule = true;
    if (MARK.test(l)) mark = true;
    else if (/^(?: {2})?(?:const|let|var) \{/.test(l) && /VB\[/.test(l)) sym = '(imports)';
    else if (/^ {2}return \{/.test(l)) sym = '(exports)';
    else { const d = DECL.exec(inModule && l.startsWith('  ') && !l.startsWith('   ') ? l.slice(2) : l); if (d) { sym = d[1] || d[2] || d[3]; if (mark) marked.add(sym); } if (l.trim() && !/^\s*\/\//.test(l)) mark = false; }
    at.push(sym);
  }
  return { at, marked };
}
const footprintOf = (file, syms, marked) => [...syms].filter((s) => !MECHANICAL.has(s) && !marked.has(s));

// the edits between two commits, in ROOT: Map(file -> Set(symbols)); a file the change creates or deletes is ['*'] (the whole of it);
// files outside a few text kinds, and the ignored ones, are left out
function editsBetween(root, base, tip) {
  const git = (...a) => spawnSync('git', ['-C', root, ...a], { encoding: 'utf8', maxBuffer: 1 << 28 });
  const show = (rev, f) => { const r = git('show', `${rev}:${f}`); return r.status ? null : r.stdout; };
  const out = new Map();
  const diff = git('diff', '-U0', '--no-renames', base, tip);
  if (diff.status) throw new Error(`git diff ${base} ${tip}: ${diff.stderr.trim()}`);
  let file = null, map = null, created = false;
  for (const l of diff.stdout.split('\n')) {
    if (l.startsWith('diff --git ')) {
      const m = / b\/(.+)$/.exec(l); file = m && !ignored(m[1]) ? m[1] : null; map = null; created = false;
      continue;
    }
    if (!file) continue;
    if (l === '--- /dev/null' || l === '+++ /dev/null') { created = true; out.set(file, new Set(['*'])); continue; }
    const h = /^@@ -(\d+)(?:,(\d+))? /.exec(l);
    if (!h || created) continue;
    if (!map) { const t = show(base, file); map = t == null ? null : symbolMap(t); if (!map) { out.set(file, new Set(['*'])); created = true; continue; } }
    const start = +h[1], n = h[2] === undefined ? 1 : +h[2], syms = out.get(file) || new Set();
    for (let i = Math.max(1, start); i <= Math.max(start, start + n - 1); i++) syms.add(map.at[Math.min(i, map.at.length - 1)] || '(head)');
    out.set(file, new Set(footprintOf(file, syms, map.marked)));
  }
  for (const [f, s] of out) if (!s.size) out.delete(f); // only mechanical parts changed
  return out;
}

// do two footprints (Map file -> Set symbols, '*' the whole file) share a unit? -> the shared units, as "file (a, b)" strings
function overlap(a, b) {
  const shared = [];
  for (const [f, sa] of a) {
    const sb = b.get(f);
    if (!sb) continue;
    if (sa.has('*') || sb.has('*')) { shared.push(f); continue; }
    const both = [...sa].filter((s) => sb.has(s));
    if (both.length) shared.push(`${f} (${both.join(', ')})`);
  }
  return shared;
}
module.exports = { IGNORED, ignored, MECHANICAL, symbolMap, editsBetween, overlap };
