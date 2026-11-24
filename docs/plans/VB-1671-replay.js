// scratch (VB-1671): replays every merge with git merge-tree and writes the conflicts, by file and enclosing symbol, as JSON.
// node docs/plans/VB-1671-replay.js OUT.json   (about 20 s on the full history; needs it: git fetch --unshallow). Research code, not game code.
// Replay every two-parent merge with git merge-tree; record conflicted files, and for text conflicts the enclosing symbol:
// a top-level or module-level (indent 2) declaration, the module's import block, its export list, a Markdown heading or a table row.
const { execSync, spawnSync } = require('child_process'); const fs = require('fs');
const sh = (c) => execSync(c, { encoding: 'utf8', maxBuffer: 1 << 28 });
const merges = sh('git log --merges --format="%H %P|%cd|%s" --date=short').trim().split('\n').map((l) => {
  const i = l.indexOf('|'); const [c, p1, p2, p3] = l.slice(0, i).trim().split(' ');
  const [date, ...s] = l.slice(i + 1).split('|'); return { c, p1, p2, p3, date, subj: s.join('|') }; }).filter((m) => !m.p3);
const kind = (s) => /^Merge pull request/.test(s) ? 'pr' : /origin\/main|branch 'main'|main into/.test(s) ? 'main-into-branch'
  : /worktree-agent|agent-|run's branch/i.test(s) ? 'subagent' : 'other';
const DECL = /^(?: {2})?(?:export )?(?:async )?(?:function\*? (\w+)|(?:const|let|var) (\w+)|class (\w+))/;
function symbolsAtMarkers(text) {
  let sym = '(head)'; const syms = new Set();
  for (const l of text.split('\n')) {
    if (l.startsWith('<<<<<<<')) { syms.add(sym); continue; }
    if (/^(?: {2})?(?:const|let|var) \{/.test(l) || /^ {4}\{ [\w, ]+ \} = VB\[/.test(l)) { sym = '(imports)'; continue; }
    if (/^ {2}return \{/.test(l)) { sym = '(exports)'; continue; }
    const d = DECL.exec(l); if (d) { sym = d[1] || d[2] || d[3]; continue; }
    const h = /^#{1,4} (.+)/.exec(l); if (h) { sym = '# ' + h[1].slice(0, 40); continue; }
    const r = /^\| \[?(VB-\d+)/.exec(l); if (r) sym = 'row';
  }
  return [...syms];
}
const out = [];
for (const m of merges) {
  const r = spawnSync('git', ['merge-tree', '--write-tree', '--name-only', '--no-messages', m.p1, m.p2], { encoding: 'utf8' });
  const rec = { ...m, kind: kind(m.subj), conflicts: [] }; out.push(rec);
  if (r.status === 0) continue;
  const [tree, ...files] = r.stdout.trim().split('\n');
  for (const f of [...new Set(files)]) {
    let text; try { text = sh(`git cat-file -p ${tree}:"${f}"`); } catch { rec.conflicts.push({ f, syms: ['(deleted/binary)'] }); continue; }
    rec.conflicts.push({ f, syms: symbolsAtMarkers(text) });
  }
}
fs.writeFileSync(process.argv[2], JSON.stringify(out));
