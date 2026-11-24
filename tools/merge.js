// Merge drivers (VB-1620): git calls these for the files `.gitattributes` names, so that a conflict that is only mechanical resolves
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
// Without --install, git merges these files as text, as before: a clone without the drivers is no worse off.
require('./help.js')(__filename);
const fs = require('fs'), { spawnSync } = require('child_process');

const DRIVERS = { backlog: 'task rows merged by ID (tools/merge.js)' };

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

const MODES = { backlog };

// ---- command line
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
let result;
try { result = MODES[mode](read(base), read(ours), read(theirs)); }
catch (e) { console.error(`merge: ${name || ours}: ${e.message}; left to git's text merge`); result = textMerge(read(base), read(ours), read(theirs)); }
fs.writeFileSync(ours, result.text);
if (result.note) console.error(`merge: ${name || ours}: ${result.note}`);
process.exit(result.clean ? 0 : 1);
