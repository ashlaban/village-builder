// Section reader for the long Markdown documents (design.md, target-v2, the roadmap, REVIEW.md): a table of contents with each section's
// size, or one section, so a task reads the section its Design ref names instead of the whole file. Headings in code blocks are ignored.
const fs = require('fs'), path = require('path');
const USAGE = `usage: node tools/doc.js [FILE.md] [QUERY] [--toc] [--line N] [--shallow]
  FILE.md      default design.md
  --toc        headings, indented by level, with line numbers and section sizes (under QUERY's section if one is given)
  QUERY        print one section, with its subsections: a heading, or the start or part of one; numbers ("3.") and notes in
               brackets are ignored. A Design ref's "Section (Subsection: ...)" finds the subsection inside the section,
               or the table row or bold bullet that starts with it (with the table's header)
  --line N     the section whose heading is on line N (from --toc)
  --shallow    stop at the first subheading and list the subsections instead`;

const args = process.argv.slice(2);
const option = (k) => { const i = args.indexOf(k); if (i < 0) return null; const v = args[i + 1]; args.splice(i, 2); return v; };
const flag = (k) => { const i = args.indexOf(k); if (i < 0) return false; args.splice(i, 1); return true; };
if (flag('--help') || flag('-h')) { console.log(USAGE); process.exit(0); }
const line = option('--line'), toc = flag('--toc'), shallow = flag('--shallow');
const file = args[0] && /\.md$/.test(args[0]) ? args.shift() : 'design.md', query = args.join(' ').trim();
const full = path.resolve(file);
if (!fs.existsSync(full)) { console.error(`doc: no file ${file}`); process.exit(1); }
const lines = fs.readFileSync(full, 'utf8').split('\n');

// Sections: a heading and every line up to the next heading of the same or a higher level.
const heads = [];
let fence = false;
lines.forEach((l, i) => {
  if (/^\s*(```|~~~)/.test(l)) fence = !fence;
  const m = !fence && l.match(/^(#{1,6}) (.+?)\s*#*\s*$/);
  if (m) heads.push({ level: m[1].length, title: m[2], line: i + 1 });
});
heads.forEach((h, k) => {
  const next = heads.slice(k + 1).find((n) => n.level <= h.level), sub = heads[k + 1];
  h.end = next ? next.line - 1 : lines.length;
  h.bodyEnd = sub && sub.line <= h.end ? sub.line - 1 : h.end;
  h.bytes = lines.slice(h.line - 1, h.end).join('\n').length + 1;
});
const norm = (t) => t.toLowerCase().replace(/[`*_]/g, '').replace(/^\d+(\.\d+)*\.?\s+/, '').replace(/\s*\([^)]*\)\s*$/, '').trim();
function find(q, within) {
  const pool = within ? heads.filter((h) => h.line > within.line && h.line <= within.end) : heads, n = norm(q);
  if (!n) return [];
  for (const test of [(t) => t === n, (t) => t.startsWith(n), (t) => t.includes(n)]) {
    const hits = pool.filter((h) => test(norm(h.title)));
    if (hits.length) return hits;
  }
  return [];
}
// Topics kept as table rows ("| Help in hunger | ... |") or bold bullets ("- **Help in hunger:** ...") inside a section.
function items(q, within) {
  const n = norm(q), out = [];
  for (let i = within.line; i < within.end; i++) {
    const lead = (lines[i].match(/^\|\s*([^|]+?)\s*\|/) || lines[i].match(/^\s*[-*]\s+\*\*(.+?)\*\*/) || [])[1];
    if (n && lead && !/^[-: ]+$/.test(lead) && norm(lead).startsWith(n)) out.push(i);
  }
  return out;
}
function showItem(i) {
  const head = heads.filter((h) => h.line <= i).pop(), out = head ? [`${'#'.repeat(head.level)} ${head.title}  (line ${head.line}; one item)`] : [];
  let s = i;
  while (s > 0 && lines[s - 1].startsWith('|')) s--;
  if (lines[i].startsWith('|') && s < i - 1) out.push(lines[s], lines[s + 1]);
  return out.concat(lines[i]).join('\n');
}
function resolve(q) {
  const m = q.match(/^(.*?)\s*\((.+)\)\s*$/);
  if (m) {
    const parents = find(m[1]);
    if (parents.length === 1) {
      const child = m[2].split(/[:;]/)[0].trim(), kids = find(child, parents[0]);
      if (kids.length) return { hits: kids };
      const rows = items(child, parents[0]);
      if (rows.length) return { hits: [], rows };
      return { hits: parents, note: `no heading or item "${child}" under "${parents[0].title}": printing the whole section` };
    }
  }
  const hits = find(q);
  return hits.length ? { hits } : { hits, rows: items(q, { line: 0, end: lines.length }) };
}
const kb = (b) => (b >= 1000 ? (b / 1000).toFixed(1) + ' KB' : b + ' B');
const tocOf = (list) => list.map((h) => `${String(h.line).padStart(5)}  ${'  '.repeat(h.level - 1)}${h.title}  (${kb(h.bytes)})`).join('\n');

let target = null;
if (line) target = heads.find((h) => h.line === +line) || (console.error(`doc: no heading on line ${line} of ${file}`), process.exit(1));
else if (query) {
  const { hits, rows = [], note } = resolve(query);
  if (!hits.length && rows.length) { console.log(rows.map(showItem).join('\n\n')); process.exit(0); }
  if (!hits.length) { console.error(`doc: no heading in ${file} matches "${query}"; see  node tools/doc.js ${file} --toc`); process.exit(1); }
  if (hits.length > 1) {
    console.error(`doc: ${hits.length} headings in ${file} match "${query}"; pick one with --line N:\n` + tocOf(hits));
    process.exit(1);
  }
  if (note) console.error('doc: ' + note);
  target = hits[0];
}
if (toc || !target) {
  const list = target ? heads.filter((h) => h.line >= target.line && h.line <= target.end) : heads;
  console.log(`${file}: ${kb(lines.join('\n').length)}, ${heads.length} headings\n` + tocOf(list));
} else {
  const end = shallow ? target.bodyEnd : target.end;
  console.log(lines.slice(target.line - 1, end).join('\n').trimEnd());
  if (shallow && end < target.end) {
    console.log('\n(subsections, by --line N)\n' + tocOf(heads.filter((h) => h.line > end && h.line <= target.end)));
  }
}
