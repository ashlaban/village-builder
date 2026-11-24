// scratch (VB-1677): file against function overlap as predictors of a code conflict, from each merge's two sides since their base.
// node docs/plans/VB-1677-granularity.js OUT.json   (the replay's output; about 45 s). Research code, not game code.
// For each non-PR merge since 15 Nov: what each side changed since the merge base, at file and at symbol level (code files only,
// bookkeeping and list files left out), against whether the replay found a conflict in a code file. Is symbol overlap a better predictor?
const { execSync } = require('child_process'); const fs = require('fs');
const sh = (c) => execSync(c, { encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] });
const out = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')).filter((m) => m.date >= '2026-11-15' && m.kind !== 'pr');
const BOOK = /^(BACKLOG|BACKLOG_ARCHIVE|QUESTIONS|QUESTION_ARCHIVE|REVIEW)\.md$|^docs\/|^tests\/(counters|golden)\.json|baseline|^backlog\/|^index\.html$/;
const LIST = /^src\/(manifest|layers|owners|page)\.json$|^src\/(vb|sim)\.js$|^tests\/(suites|run)\.js$|^src\/head\.html$/;
const code = (f) => /^(src|tests|tools)\/.*\.(js|ts|html)$/.test(f) && !BOOK.test(f) && !LIST.test(f);
const MECH = new Set(['(imports)', '(head)', '(exports)']);
const DECL = /^(?: {2})?(?:export )?(?:async )?(?:function\*? (\w+)|(?:const|let|var) (\w+)|class (\w+))/;
function symbolMap(text) { // line number (1-based) -> enclosing symbol
  let sym = '(head)'; const map = [null];
  for (const l of text.split('\n')) {
    if (/^(?: {2})?(?:const|let|var) \{/.test(l) && /VB\[/.test(l)) sym = '(imports)';
    else if (/^ {2}return \{/.test(l)) sym = '(exports)';
    else { const d = DECL.exec(l); if (d) sym = d[1] || d[2] || d[3]; }
    map.push(sym);
  }
  return map;
}
const fileCache = new Map();
const show = (rev, f) => { const k = rev + ':' + f; if (!fileCache.has(k)) { let t = ''; try { t = sh(`git show ${k}`); } catch {} fileCache.set(k, t); } return fileCache.get(k); };
function changes(base, tip) { // {file: Set(symbols touched, by the base's lines)}
  const res = {};
  const diff = sh(`git diff -U0 --no-renames ${base} ${tip} -- src tests tools`);
  let f = null, map = null;
  for (const l of diff.split('\n')) {
    const fm = /^\+\+\+ b\/(.+)|^--- a\/(.+)/.exec(l);
    if (l.startsWith('diff --git')) { const m = / b\/(.+)$/.exec(l); f = m && code(m[1]) ? m[1] : null; map = f ? symbolMap(show(base, f)) : null; if (f) res[f] ||= new Set(); continue; }
    if (!f || fm) continue;
    const h = /^@@ -(\d+)(?:,(\d+))?/.exec(l); if (!h) continue;
    const start = +h[1], n = h[2] === undefined ? 1 : +h[2];
    for (let i = Math.max(1, start); i <= Math.max(start, start + n - 1); i++) res[f].add(map[Math.min(i, map.length - 1)] || '(head)');
  }
  return res;
}
const rows = [];
for (const m of out) {
  let base; try { base = sh(`git merge-base ${m.p1} ${m.p2}`).trim(); } catch { continue; }
  const a = changes(base, m.p1), b = changes(base, m.p2);
  const files = Object.keys(a).filter((f) => b[f]);
  const syms = files.flatMap((f) => [...a[f]].filter((s) => b[f].has(s) && !MECH.has(s)).map((s) => f + ':' + s));
  const mech = files.flatMap((f) => [...a[f]].filter((s) => b[f].has(s) && MECH.has(s)).map((s) => f + ':' + s));
  const confCode = m.conflicts.filter((c) => code(c.f));
  const confBody = confCode.some((c) => c.syms.some((s) => !MECH.has(s)));
  const confMech = confCode.some((c) => c.syms.some((s) => MECH.has(s)));
  rows.push({ c: m.c.slice(0, 8), file: files.length > 0, sym: syms.length > 0, mech: mech.length > 0, confBody, confMech, confAny: confCode.length > 0 });
}
const tab = (pred, truth) => { const t = { tp: 0, fp: 0, fn: 0, tn: 0 };
  for (const r of rows) t[r[pred] ? (r[truth] ? 'tp' : 'fp') : (r[truth] ? 'fn' : 'tn')]++;
  return `${pred.padEnd(5)} vs ${truth}: flagged ${t.tp + t.fp}/${rows.length}, recall ${(t.tp / (t.tp + t.fn)).toFixed(2)}, precision ${(t.tp / (t.tp + t.fp)).toFixed(2)}  ${JSON.stringify(t)}`; };
console.log(`merges ${rows.length}; with a code conflict ${rows.filter((r) => r.confAny).length} (in a body ${rows.filter((r) => r.confBody).length}, in imports/head/exports ${rows.filter((r) => r.confMech).length})`);
console.log(tab('file', 'confAny')); console.log(tab('file', 'confBody')); console.log(tab('sym', 'confBody')); console.log(tab('mech', 'confMech'));
