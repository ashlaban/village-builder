// Merge drivers (VB-1679): git calls these for the files `.gitattributes` names, so that a conflict that is only mechanical resolves
// without a person or an agent. A conflict that is not mechanical stays a conflict, with the usual markers, and the driver exits 1.
// usage: node tools/merge.js --install     set the drivers in this clone's git config (npm install runs it; worktrees share it)
//        node tools/merge.js MODE BASE OURS THEIRS PATH
//                                          what git runs: merges BASE, OURS and THEIRS into OURS; exit 0 clean, 1 conflicts left
// modes:
//   backlog   BACKLOG.md and BACKLOG_ARCHIVE.md: every task row is merged by its ID, field by field (name, arch, priority, size,
//             waits, summary, and the table it sits in); the text around the rows is merged as text. The rows of Ready, Waiting
//             for Kim and Blocked come out in the order "How this backlog works" sets (tools/backlog.js); Done tasks keeps our
//             order and appends theirs. A row changed differently on both sides, a row removed on one side and changed on the
//             other, and one ID added differently on both sides (two branches took the same new ID) stay conflicts.
//   json      the JSON lists and tables (src/owners.json, src/page.json, src/manifest.json, src/layers.json, tests/counters.json):
//             objects merge key by key, arrays of names element by element (an element added on one side goes after the element
//             it followed there; ours before theirs at the same place), and the result is printed in the file's own layout (the
//             printer that reproduces ours: two-space JSON, or Prettier with the repository's settings). A value changed two ways
//             is a conflict, but in tests/counters.json, a recorded measurement, where the incoming side's value is kept (Kim,
//             24 November 2026). A reordered array, or one with repeated elements, is a conflict.
//   js        a JavaScript file: git's text merge first; when it conflicts, and every conflict lies in a module's import block
//             (the `const { ... } = VB['key']` lines at its top), its export list (the closing `return { ... }`) or a table
//             marked `// @merge union` on the line before it, those parts merge by name (imports by module and name, exports by
//             name, a table's entries by key, an entry on its own lines), the rest as text, and a file under src/ is formatted by
//             Prettier. A table is marked only where the order of its entries does not matter. An entry changed two ways, a key
//             added on both sides with different values, or a conflict anywhere else leaves the whole file to git's text merge.
//             Each resolution is printed and appended to <git common dir>/vb-merge.log, for the merge's report.
// Without --install, git merges these files as text, as before: a clone without the drivers is no worse off.
require('./help.js')(__filename);
const fs = require('fs'), { spawnSync } = require('child_process');

const DRIVERS = { backlog: 'task rows merged by ID (tools/merge.js)', json: 'JSON merged by key and element (tools/merge.js)',
  js: 'imports, exports and marked tables merged by name (tools/merge.js)' };

// ---- shared: a three-way choice, and the text merge git itself does
const same = (x, y) => JSON.stringify(x) === JSON.stringify(y);
const CONFLICT = Symbol('conflict');
// base, ours, theirs -> the merged value, or CONFLICT; undefined stands for absent
function pick(o, a, b) {
  if (same(a, b)) return a;
  if (same(o, a)) return b;
  if (same(o, b)) return a;
  return CONFLICT;
}
function textMerge(o, a, b) { // git merge-file on strings: { text, clean }
  const tmp = fs.mkdtempSync(require('path').join(require('os').tmpdir(), 'vb-merge-'));
  const f = (n, s) => { const p = `${tmp}/${n}`; fs.writeFileSync(p, s); return p; };
  const r = spawnSync('git', ['merge-file', '-p', '-L', 'ours', '-L', 'base', '-L', 'theirs', f('a', a), f('o', o), f('b', b)], { encoding: 'utf8' });
  fs.rmSync(tmp, { recursive: true, force: true });
  if (r.status < 0 || r.status === null || r.error) throw new Error('git merge-file failed: ' + (r.error || r.stderr));
  return { text: r.stdout, clean: r.status === 0 };
}
function spawnDiff3(o, a, b) { // the conflicts with their base, for reading
  const tmp = fs.mkdtempSync(require('path').join(require('os').tmpdir(), 'vb-merge-'));
  const f = (n, s) => { const p = `${tmp}/${n}`; fs.writeFileSync(p, s); return p; };
  const r = spawnSync('git', ['merge-file', '-p', '--diff3', f('a', a), f('o', o), f('b', b)], { encoding: 'utf8' });
  fs.rmSync(tmp, { recursive: true, force: true });
  return r.stdout;
}
const markers = (a, o, b) => ['<<<<<<< ours', ...a, '||||||| base', ...o, '=======', ...b, '>>>>>>> theirs'];

// ---- backlog: task rows by ID
const ROW = /^\| \[(VB-\d{3,})\]\(backlog\/VB-\d{3,}\.md\)(<a id="VB-\d{3,}"><\/a>)? \| /;
const cellsOf = (line) => line.replace(/^\| /, '').replace(/ \|\s*$/, '').split(' | ');
const WAITS = /^(-|(\[?(VB-\d{3,}|Kim)(\]\(#VB-\d{3,}\))?)(, (\[?(VB-\d{3,}|Kim)(\]\(#VB-\d{3,}\))?))*)$/;
// a version's rows, by ID: { section, anchor, name, arch, priority, size, waits (null outside a blocked layout), summary, line }
function rowsOf(text) {
  const rows = new Map(), order = [], skeleton = []; let section = '';
  for (const line of text.split('\n')) {
    const h = /^## (.+)$/.exec(line); if (h) section = h[1];
    const m = ROW.exec(line);
    if (!m) { skeleton.push(line); continue; }
    const c = cellsOf(line), waits = c.length > 6 && WAITS.test(c[5]) ? c[5] : null;
    rows.set(m[1], { section, anchor: !!m[2], name: c[1], arch: c[2], priority: c[3], size: c[4], waits, summary: c.slice(waits === null ? 5 : 6).join(' | '), line });
    order.push(m[1]);
  }
  return { rows, order, skeleton: skeleton.join('\n') };
}
const FIELDS = ['section', 'anchor', 'name', 'arch', 'priority', 'size', 'waits', 'summary'];
const lineOf = (id, r) => `| [${id}](backlog/${id}.md)${r.anchor ? `<a id="${id}"></a>` : ''} | ${[r.name, r.arch, r.priority, r.size,
  ...(r.waits === null ? [] : [r.waits]), r.summary].join(' | ')} |`;
const strip = (r) => r && Object.fromEntries(FIELDS.map((f) => [f, r[f]]));
// one ID: the merged row, undefined if removed, or CONFLICT
function mergeRow(o, a, b) {
  const whole = pick(strip(o), strip(a), strip(b));
  if (whole !== CONFLICT) return whole === undefined ? undefined : (same(whole, strip(a)) ? a : same(whole, strip(b)) ? b : whole);
  if (!o || !a || !b) return CONFLICT; // removed on one side and changed on the other, or added differently on both
  const r = {};
  for (const f of FIELDS) { const v = pick(o[f], a[f], b[f]); if (v === CONFLICT) return CONFLICT; r[f] = v; }
  return r;
}
const num = (id) => +id.slice(3);
function backlog(o, a, b) {
  const [O, A, B] = [o, a, b].map(rowsOf), frame = textMerge(O.skeleton, A.skeleton, B.skeleton);
  if (!frame.clean) return textMerge(o, a, b); // the text around the rows conflicts: leave the whole file to git's own merge
  const ids = [...new Set([...A.order, ...B.order, ...O.order])], placed = new Map(), conflicts = [];
  for (const id of ids) {
    const r = mergeRow(O.rows.get(id), A.rows.get(id), B.rows.get(id));
    if (r === undefined) continue;
    const section = r === CONFLICT ? (A.rows.get(id) || B.rows.get(id)).section : r.section;
    const lines = r === CONFLICT ? markers(...[A, O, B].map((v) => (v.rows.has(id) ? [v.rows.get(id).line] : []))) : [r.line || lineOf(id, r)];
    if (r === CONFLICT) conflicts.push(id);
    if (!placed.has(section)) placed.set(section, []);
    placed.get(section).push({ id, r: r === CONFLICT ? A.rows.get(id) || B.rows.get(id) : r, lines });
  }
  const out = frame.text.split('\n');
  const archs = tableUnder(out, 'Archs').map((l) => cellsOf(l)[0]);
  const rank = (arch) => (archs.includes(arch) ? archs.indexOf(arch) : archs.length);
  const KEY = { Ready: (r) => [+r.priority], 'Waiting for Kim': (r) => [+r.priority], Blocked: (r) => [rank(r.arch), +r.priority] };
  const seen = (id) => { const i = A.order.indexOf(id); return i < 0 ? A.order.length + B.order.indexOf(id) : i; };
  for (const [section, list] of placed) {
    const key = KEY[section];
    list.sort(key ? (x, y) => { const p = [...key(x.r), num(x.id)], q = [...key(y.r), num(y.id)]; for (let k = 0; k < p.length; k++) if (p[k] !== q[k]) return p[k] - q[k]; return 0; }
      : (x, y) => seen(x.id) - seen(y.id));
    const at = separatorUnder(out, section);
    if (at < 0) return textMerge(o, a, b); // a row's table is gone from the merged text: leave it to git
    out.splice(at + 1, 0, ...list.flatMap((x) => x.lines));
  }
  return { text: out.join('\n'), clean: !conflicts.length, note: conflicts.length ? `rows changed on both sides: ${conflicts.join(', ')}` : '' };
}
function separatorUnder(lines, heading) {
  const h = lines.indexOf('## ' + heading); if (h < 0) return -1;
  for (let i = h + 1; i < lines.length && !/^## /.test(lines[i]); i++) if (/^\|[-|: ]+\|$/.test(lines[i])) return i;
  return -1;
}
const tableUnder = (lines, heading) => { const s = separatorUnder(lines, heading), rows = []; if (s < 0) return rows;
  for (let i = s + 1; i < lines.length && lines[i].startsWith('|'); i++) rows.push(lines[i]); return rows; };

// ---- json: by key and by element, printed in the file's own layout
const INCOMING = new Set(['tests/counters.json']); // a scalar changed two ways keeps theirs, the incoming side's
const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
// a merged order: ours, less what theirs removed, plus what theirs added, each after the item it followed in theirs
function mergeOrder(o, a, b) {
  const inO = new Set(o), inB = new Set(b), addedA = new Set(a.filter((x) => !inO.has(x)));
  const out = a.filter((x) => inB.has(x) || !inO.has(x)), inOut = new Set(out);
  for (let i = 0; i < b.length; i++) {
    const x = b[i]; if (inOut.has(x)) continue;
    if (inO.has(x)) continue; // removed by ours
    let at = 0;
    for (let j = i - 1; j >= 0; j--) if (inOut.has(b[j])) { at = out.indexOf(b[j]) + 1; break; }
    while (at < out.length && addedA.has(out[at])) at++; // ours' additions at the same place come first
    out.splice(at, 0, x); inOut.add(x);
  }
  return out;
}
// the common items keep one relative order on all three sides; else the merge would have to choose one
const sameOrder = (o, a, b) => { const all = [o, a, b].map((v) => new Set(v)), common = o.filter((x) => all[1].has(x) && all[2].has(x));
  const seq = (v) => v.filter((x) => common.includes(x)).join('\u0000'); return seq(a) === seq(o) && seq(b) === seq(o); };
function mergeValue(o, a, b, incoming) {
  const p = pick(o, a, b); if (p !== CONFLICT) return p;
  if (a === undefined || b === undefined) return CONFLICT; // removed on one side, changed on the other
  if (Array.isArray(a) && Array.isArray(b) && (o === undefined || Array.isArray(o))) {
    const O = o || [], prim = (v) => v.every((x) => typeof x === 'string' || typeof x === 'number') && new Set(v).size === v.length;
    if (![O, a, b].every(prim) || !sameOrder(O, a, b)) return CONFLICT;
    return mergeOrder(O, a, b);
  }
  if (isObj(a) && isObj(b) && (o === undefined || isObj(o))) {
    const O = o || {}, values = new Map(), out = {};
    for (const k of new Set([...Object.keys(O), ...Object.keys(a), ...Object.keys(b)])) { // every key, so a removal meets a change
      const v = mergeValue(O[k], a[k], b[k], incoming); if (v === CONFLICT) return CONFLICT;
      values.set(k, v);
    }
    for (const k of mergeOrder(Object.keys(O), Object.keys(a), Object.keys(b))) if (values.get(k) !== undefined) out[k] = values.get(k);
    return out;
  }
  return incoming && typeof b !== 'object' ? b : CONFLICT;
}
async function printers() {
  const list = [['two-space JSON', (v) => JSON.stringify(v, null, 2) + '\n']];
  let prettier; try { prettier = require('prettier'); } catch { return list; }
  const cfg = (await prettier.resolveConfig(__filename)) || {};
  list.push(['Prettier', (v) => prettier.format(JSON.stringify(v), { ...cfg, parser: 'json' })]);
  list.push(['Prettier, no bracket spacing', (v) => prettier.format(JSON.stringify(v), { ...cfg, parser: 'json', bracketSpacing: false })]);
  return list;
}
async function json(o, a, b, name) {
  let O, A, B; try { [O, A, B] = [o, a, b].map((t) => (t.trim() ? JSON.parse(t) : undefined)); } catch { return textMerge(o, a, b); }
  const merged = mergeValue(O, A, B, INCOMING.has(name));
  if (merged === CONFLICT || merged === undefined) return { ...textMerge(o, a, b), note: merged === CONFLICT ? 'a value changed two ways' : '' };
  if (same(merged, A)) return { text: a, clean: true }; // one side's value: its text as it stands
  if (same(merged, B)) return { text: b, clean: true };
  // the layout: the printer that reproduces ours exactly, else the one that keeps most of its lines
  let best = null, score = -1;
  for (const [label, print] of await printers()) {
    const t = await print(A), lines = new Set(a.split('\n')), s = t === a ? Infinity : t.split('\n').filter((l) => lines.has(l)).length;
    if (s > score) { best = [label, print]; score = s; }
  }
  const text = await best[1](merged);
  if (!same(JSON.parse(text), merged)) return textMerge(o, a, b);
  return { text, clean: true, note: score === Infinity ? '' : `printed as ${best[0]}, the nearest to ours` };
}

// ---- js: the import block, the export list and the marked tables merge by name; the rest as text
const MARK = /^\s*\/\/ @merge union\b/;
const lineStart = (t, i) => t.lastIndexOf('\n', i - 1) + 1;
const lineEnd = (t, i) => { const j = t.indexOf('\n', i); return j < 0 ? t.length : j; };
// the regions of one version: { name: { start, end, value } }, value what is merged by name; null when the file cannot be read so
function regionsOf(text, file) {
  const acorn = require('acorn'), comments = [];
  const ast = acorn.parse(text, { ecmaVersion: 'latest', sourceType: 'script', allowHashBang: true, allowReturnOutsideFunction: true, onComment: comments });
  const out = {}, src = (n) => text.slice(n.start, n.end);
  const isVB = (n) => n && n.type === 'MemberExpression' && n.computed && n.object.type === 'Identifier' && n.object.name === 'VB'
    && n.property.type === 'Literal' && typeof n.property.value === 'string';
  // a module: VB['key'] = (() => { ...imports...; ...; return { ...exports }; })();
  const mod = /^src\//.test(file) && ast.body.find((st) => st.type === 'ExpressionStatement' && st.expression.type === 'AssignmentExpression'
    && isVB(st.expression.left) && st.expression.right.type === 'CallExpression' && st.expression.right.callee.type === 'ArrowFunctionExpression'
    && st.expression.right.callee.body.type === 'BlockStatement');
  if (mod) {
    const body = mod.expression.right.callee.body.body, decls = [], stmts = [];
    for (const st of body) { // every module-level statement that only reads VB, wherever it stands
      // `const { a, b } = VB['key']`, and `const Name = VB['key']` (the whole module, kept as the name '=Name')
      const ok = (d) => isVB(d.init) && (d.id.type === 'Identifier' || (d.id.type === 'ObjectPattern' && d.id.properties.every((p) => p.type === 'Property')));
      if (st.type !== 'VariableDeclaration' || !st.declarations.every(ok)) continue;
      stmts.push(st); decls.push(st.declarations.map((d) => ({ key: d.init.property.value, names: d.id.type === 'Identifier' ? ['=' + d.id.name] : d.id.properties.map(src) })));
    }
    if (decls.length) { // the merged imports stand where the first stood; the later statements' lines go
      const spans = stmts.map((st, i) => (i ? [lineStart(text, st.start), lineEnd(text, st.end) + 1] : [st.start, st.end]));
      if (stmts.slice(1).some((st, i) => text.slice(spans[i + 1][0], st.start).trim() || text.slice(st.end, spans[i + 1][1]).trim())) throw new Error('an import shares a line');
      out.imports = { start: stmts[0].start, end: stmts[0].end, spans, value: decls };
    }
    const ret = body[body.length - 1];
    if (ret && ret.type === 'ReturnStatement' && ret.argument && ret.argument.type === 'ObjectExpression') {
      out.exports = { start: ret.start, end: ret.end, value: ret.argument.properties.map(src) };
    }
  }
  // the marked tables, at any depth of statements: an entry is the whole lines it stands on, with the comment lines before it
  const statements = [];
  (function walk(list) { for (const st of list) { statements.push(st); if (st.type === 'ExpressionStatement' && st.expression.type === 'AssignmentExpression'
    && st.expression.right.type === 'CallExpression' && st.expression.right.callee.body && st.expression.right.callee.body.body) walk(st.expression.right.callee.body.body); } })(ast.body);
  for (const c of comments) {
    if (c.type !== 'Line' || !MARK.test('//' + c.value)) continue;
    const st = statements.find((x) => x.start > c.end && !text.slice(c.end, x.start).trim());
    if (!st || st.type !== 'VariableDeclaration' || st.declarations.length !== 1) throw new Error('@merge union marks no table');
    const d = st.declarations[0], lit = d.init;
    if (!lit || (lit.type !== 'ObjectExpression' && lit.type !== 'ArrayExpression')) throw new Error(`@merge union: ${src(d.id)} is not a table`);
    const items = lit.type === 'ObjectExpression' ? lit.properties : lit.elements;
    const open = lineEnd(text, lit.start) + 1, close = lineStart(text, lit.end);
    const entries = []; let from = open;
    for (const it of items) {
      if (!it || it.type === 'SpreadElement' || (it.type === 'Property' && it.computed)) throw new Error(`@merge union: ${src(d.id)} has an entry without a plain key`);
      if (it.start < from || lineStart(text, it.start) < from) throw new Error(`@merge union: ${src(d.id)} has two entries on one line`);
      const after = text.slice(it.end).match(/^\s*,?/)[0], end = lineEnd(text, it.end + after.length);
      let chunk = text.slice(from, end + 1);
      if (!after.includes(',')) chunk = text.slice(from, it.end) + ',' + text.slice(it.end, end + 1);
      const key = lit.type === 'ObjectExpression' ? (it.key.type === 'Identifier' ? it.key.name : String(it.key.value)) : src(it);
      entries.push([key, chunk]); from = end + 1;
    }
    if (from > close || text.slice(from, close).trim()) throw new Error(`@merge union: ${src(d.id)} ends on the line of an entry`);
    if (new Set(entries.map((e) => e[0])).size !== entries.length) throw new Error(`@merge union: ${src(d.id)} has a key twice`);
    if (open > close) continue;
    out['table:' + src(d.id)] = { start: open, end: close, value: entries };
  }
  return out;
}
const placeholder = (name) => `/*@@vb-merge ${name}@@*/`;
function withPlaceholders(text, regions) {
  let t = text;
  const cuts = Object.entries(regions).flatMap(([name, r]) => (r.spans || [[r.start, r.end]]).map(([a, b], i) => [a, b, i ? '' : placeholder(name) + (name.startsWith('table:') ? '\n' : '')]));
  for (const [a, b, put] of cuts.sort((x, y) => y[0] - x[0])) t = t.slice(0, a) + put + t.slice(b);
  return t;
}
const mergeList = (o, a, b) => { const p = pick(o, a, b); if (p !== CONFLICT) return p; return [o, a, b].every((v) => new Set(v).size === v.length) && sameOrder(o, a, b) ? mergeOrder(o, a, b) : CONFLICT; };
function mergeImports(o, a, b) {
  const map = (v) => { const m = new Map(); for (const st of v || []) for (const d of st) m.set(d.key, (m.get(d.key) || []).concat(d.names)); return m; };
  const [O, A, B] = [o, a, b].map(map), merged = new Map();
  for (const key of mergeOrder([...O.keys()], [...A.keys()], [...B.keys()]).concat([...O.keys()])) {
    if (merged.has(key)) continue;
    const names = mergeList(O.get(key) || [], A.get(key) || [], B.get(key) || []); if (names === CONFLICT) return CONFLICT;
    merged.set(key, names);
  }
  // ours' statements and grouping, then the modules only theirs reads, a statement each
  const used = new Set(), stmts = [];
  for (const st of a || []) {
    const ds = st.filter((d) => !used.has(d.key) && (merged.get(d.key) || []).length).map((d) => { used.add(d.key); return d.key; });
    if (ds.length) stmts.push(ds);
  }
  for (const [key, names] of merged) if (!used.has(key) && names.length) stmts.push([key]);
  const declarators = (k) => { const ns = merged.get(k), parts = ns.filter((n) => n[0] === '=').map((n) => `${n.slice(1)} = VB['${k}']`);
    const pattern = ns.filter((n) => n[0] !== '='); if (pattern.length) parts.unshift(`{ ${pattern.join(', ')} } = VB['${k}']`); return parts; };
  return stmts.map((ks) => 'const ' + ks.flatMap(declarators).join(',\n    ') + ';').join('\n  ');
}
function mergeTable(o, a, b) {
  const [O, A, B] = [o, a, b].map((v) => new Map(v || [])), out = [];
  for (const k of new Set([...O.keys(), ...A.keys(), ...B.keys()])) if (pick(O.get(k), A.get(k), B.get(k)) === CONFLICT) return CONFLICT;
  for (const k of mergeOrder([...O.keys()], [...A.keys()], [...B.keys()])) { const v = pick(O.get(k), A.get(k), B.get(k)); if (v !== undefined) out.push(v); }
  return out.join('');
}
function mergeLog(line) {
  const r = spawnSync('git', ['rev-parse', '--git-common-dir'], { encoding: 'utf8' });
  if (!r.status) try { fs.appendFileSync(require('path').join(r.stdout.trim(), 'vb-merge.log'), line + '\n'); } catch { /* no log, no harm */ }
}
async function js(o, a, b, name = '') {
  const plain = textMerge(o, a, b);
  if (plain.clean) return plain;
  let R; try { R = [o, a, b].map((t) => (t ? regionsOf(t, name) : {})); } catch (e) { return { ...plain, note: e.message }; }
  const names = Object.keys(R[1]);
  if (!same(names.sort(), Object.keys(R[2]).sort())) return plain; // a region on one side only: nothing to merge it with
  // every line of every conflict, on each of the three sides, lies in these parts; a line of code beside them (a function added
  // next to the export list) leaves the file to a person, who may see that it reads a name the other side removed
  const regionLines = [o, a, b].map((t, i) => new Set(Object.values(R[i]).flatMap((r) => (r.spans || [[r.start, r.end]])
    .flatMap(([x, y]) => t.slice(lineStart(t, x), lineEnd(t, y)).split('\n').map((l) => l.trim())))));
  const diff3 = spawnDiff3(o, a, b);
  for (const h of diff3.matchAll(/^<{7}.*\n([\s\S]*?)^\|{7}.*\n([\s\S]*?)^={7}\n([\s\S]*?)^>{7}/gm)) {
    const sides = [h[2], h[1], h[3]]; // base, ours, theirs
    if (sides.some((t, i) => t.split('\n').map((l) => l.trim()).some((l) => l && !regionLines[i].has(l)))) return { ...plain, note: 'a conflict reaches past the imports, exports and marked tables' };
  }
  const frame = textMerge(...[0, 1, 2].map((i) => withPlaceholders([o, a, b][i], Object.fromEntries(names.filter((n) => R[i][n]).map((n) => [n, R[i][n]])))));
  if (!frame.clean) return plain; // a conflict outside these parts
  let text = frame.text; const resolved = [];
  for (const n of names) {
    const v = R.map((r) => r[n] && r[n].value);
    const merged = n === 'imports' ? mergeImports(...v) : n === 'exports' ? mergeList(v[0] || [], v[1], v[2]) : mergeTable(...v);
    if (merged === CONFLICT) return { ...plain, note: `${n} changed two ways` };
    const body = n === 'exports' ? `return { ${merged.join(', ')} };` : merged;
    if (!same(v[1], v[2])) resolved.push(n);
    text = text.replace(placeholder(n) + (n.startsWith('table:') ? '\n' : ''), () => body);
  }
  if (/^src\/.*\.js$/.test(name)) {
    const prettier = require('prettier');
    text = await prettier.format(text, { ...((await prettier.resolveConfig(require('path').join(__dirname, '..', name))) || {}), filepath: name });
  }
  try { require('acorn').parse(text, { ecmaVersion: 'latest', sourceType: 'script', allowHashBang: true, allowReturnOutsideFunction: true }); }
  catch (e) { return { ...plain, note: 'the merged text does not parse: ' + e.message }; }
  const note = `merged by name: ${resolved.join(', ')}`;
  mergeLog(`${name}: ${note}`);
  return { text, clean: true, note };
}

const MODES = { backlog, json, js };

// ---- command line (the functions are exported for tests and research scripts)
module.exports = { MODES, regionsOf, withPlaceholders, textMerge, mergeValue, CONFLICT };
if (require.main === module) cli();
function cli() {
  const args = process.argv.slice(2);
  if (args[0] === '--install') {
    const inRepo = spawnSync('git', ['rev-parse', '--git-dir'], { encoding: 'utf8' });
    if (inRepo.status) { console.log('merge: not in a git repository; no drivers set'); process.exit(0); }
    for (const [mode, name] of Object.entries(DRIVERS)) {
      // run from the top of the worktree; a branch from before this tool falls back to git's own text merge
      const driver = `if test -f tools/merge.js; then node tools/merge.js ${mode} %O %A %B %P; else git merge-file -L ours -L base -L theirs %A %O %B; fi`;
      spawnSync('git', ['config', `merge.vb-${mode}.name`, name]);
      spawnSync('git', ['config', `merge.vb-${mode}.driver`, driver]);
    }
    console.log(`merge: drivers set: ${Object.keys(DRIVERS).map((m) => 'vb-' + m).join(', ')} (.gitattributes says which files use them)`);
    process.exit(0);
  }
  const [mode, base, ours, theirs, name] = args;
  if (!MODES[mode] || !theirs) { console.error('merge: MODE BASE OURS THEIRS [PATH], or --install (--help)'); process.exit(2); }
  const read = (f) => fs.readFileSync(f, 'utf8');
  (async () => {
    let result;
    try { result = await MODES[mode](read(base), read(ours), read(theirs), name); }
    catch (e) { console.error(`merge: ${name || ours}: ${e.message}; left to git's text merge`); result = textMerge(read(base), read(ours), read(theirs)); }
    fs.writeFileSync(ours, result.text);
    if (result.note) console.error(`merge: ${name || ours}: ${result.note}`);
    process.exit(result.clean ? 0 : 1);
  })();
}
