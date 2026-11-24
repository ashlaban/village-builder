// scratch (VB-1620): the conflict hunks (diff3 style) in bookkeeping and list files of the merges since 15 Nov, by kind.
// node docs/plans/VB-1620-hunks.js REPLAY.json [ex]   (REPLAY.json from VB-1618-replay.js; ex prints an example of each kind). Research code.
// For conflicted merges since 15 Nov: every conflict hunk (diff3 style) in a bookkeeping or list file, classified.
const { execSync, spawnSync } = require('child_process'); const fs = require('fs');
const sh = (c) => execSync(c, { encoding: 'utf8', maxBuffer: 1 << 28 });
const out = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')).filter((m) => m.date >= '2026-11-15' && m.kind !== 'pr' && m.conflicts.length);
const WANT = /^(BACKLOG|BACKLOG_ARCHIVE|QUESTIONS|QUESTION_ARCHIVE)\.md$|^docs\/(tuning|design-changelog)\.md|^tests\/counters\.json$|^src\/(manifest|layers|owners|page)\.json$|^tests\/(suites|run)\.js$|^src\/(vb|sim)\.js$/;
const kinds = {}; const ex = {};
for (const m of out) {
  const r = spawnSync('git', ['-c', 'merge.conflictStyle=diff3', 'merge-tree', '--write-tree', '--name-only', '--no-messages', m.p1, m.p2], { encoding: 'utf8' });
  const [tree, ...files] = r.stdout.trim().split('\n');
  for (const f of new Set(files)) { if (!WANT.test(f)) continue; let t; try { t = sh(`git cat-file -p ${tree}:"${f}"`); } catch { continue; }
    const re = /^<{7}.*\n([\s\S]*?)^\|{7}.*\n([\s\S]*?)^={7}\n([\s\S]*?)^>{7}.*$/gm; let h;
    while ((h = re.exec(t))) { const [ours, base, theirs] = [h[1], h[2], h[3]].map((s) => s.split('\n').filter(Boolean));
      const has = (a, l) => a.includes(l);
      const oursAdds = ours.filter((l) => !has(base, l)), theirsAdds = theirs.filter((l) => !has(base, l));
      const oursDrops = base.filter((l) => !has(ours, l)), theirsDrops = base.filter((l) => !has(theirs, l));
      const ids = (a) => a.map((l) => (/VB-\d+/.exec(l) || [])[0]).filter(Boolean);
      let k;
      if (!oursDrops.length && !theirsDrops.length) k = 'both add';
      else if (ids(oursDrops).some((i) => ids(theirsAdds).includes(i) || ids(theirsDrops).includes(i)) && ids(theirsDrops).some((i) => ids(oursAdds).includes(i) || ids(oursDrops).includes(i))) k = 'same row changed both sides';
      else if (oursDrops.some((l) => theirsDrops.includes(l))) k = 'same line changed both sides';
      else k = 'adjacent edits (different lines)';
      const key = f.replace(/^(src|tests|docs)\//, '') + ': ' + k; kinds[key] = (kinds[key] || 0) + 1;
      if (!ex[key]) ex[key] = `${m.c.slice(0, 8)}\n  base ${base.slice(0, 2).map((l) => l.slice(0, 90)).join(' / ')}\n  ours ${ours.slice(0, 2).map((l) => l.slice(0, 90)).join(' / ')}\n  thrs ${theirs.slice(0, 2).map((l) => l.slice(0, 90)).join(' / ')}`; } }
}
for (const [k, n] of Object.entries(kinds).sort((a, b) => a[0].localeCompare(b[0]))) console.log(String(n).padStart(4), k);
if (process.argv[3]) for (const [k, e] of Object.entries(ex)) console.log('\n#', k, e);
