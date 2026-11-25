// VB-048 (its review, F1): a wrap-up is blocked until the arch's implement tasks are done (BACKLOG.md, How this backlog works, Archs and
// phases). A wrap-up still open with every criterion ticked reads as done; this fails while an implement task of its arch is open.
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '..', 'backlog');
const field = (s, k) => { const m = s.match(new RegExp(`^${k}: (.*)$`, 'm')); return m ? m[1].trim() : ''; };
const tasks = fs.readdirSync(dir).filter((f) => /^VB-\d+\.md$/.test(f)).map((f) => {
  const s = fs.readFileSync(path.join(dir, f), 'utf8');
  return { id: f.slice(0, -3), arch: field(s, 'Arch'), phase: field(s, 'Phase'), status: field(s, 'Status').split(' ')[0],
    open: (s.match(/^- \[ \]/gm) || []).length, ticked: (s.match(/^- \[x\]/gm) || []).length };
});
const OPEN = new Set(['ready', 'blocked', 'needs-review']);
const bad = [];
for (const w of tasks) {
  if (w.phase !== 'wrap-up' || !w.arch || !OPEN.has(w.status) || w.open || !w.ticked) continue;
  const left = tasks.filter((t) => t.arch === w.arch && t.phase === 'implement' && OPEN.has(t.status)).map((t) => t.id);
  if (left.length) bad.push(`${w.id} (${w.arch}) has every criterion ticked while its arch's implement tasks are open: ${left.join(', ')}`);
}
if (bad.length) { console.error(bad.join('\n')); process.exit(1); }
console.log(`wrapups: ok (${tasks.filter((t) => t.phase === 'wrap-up').length} wrap-ups)`);
