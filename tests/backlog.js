// Backlog check: every backlog/VB-NNN.md has one row in the BACKLOG.md table and vice versa,
// and each row's name, status (its first word), priority, size and link match the task file.
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), dir = path.join(root, 'backlog');
const errors = [];
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort();
const tasks = {};
for (const f of files) {
  const text = fs.readFileSync(path.join(dir, f), 'utf8'), head = text.match(/^# (VB-\d{3}): (.+)$/m);
  const field = (k) => ((text.match(new RegExp(`^${k}: (.*)$`, 'm')) || [])[1] || '').trim();
  if (!head || !text.startsWith(head[0])) { errors.push(`backlog/${f}:1 line 1 must be "# VB-NNN: <name>"`); continue; }
  if (f !== head[1] + '.md') errors.push(`backlog/${f}:1 file name must be ${head[1]}.md`);
  for (const k of ['Status', 'Priority', 'Size']) if (!field(k)) errors.push(`backlog/${f}: no "${k}:" line`);
  tasks[head[1]] = { name: head[2], status: field('Status').split(' ')[0], priority: field('Priority'), size: field('Size'),
    file: `[backlog/${f}](backlog/${f})` };
}
const rows = {};
for (const line of fs.readFileSync(path.join(root, 'BACKLOG.md'), 'utf8').split('\n').filter((l) => /^\| VB-\d{3} \|/.test(l))) {
  const cells = line.replace(/^\| | \|\s*$/g, '').split(' | '), file = cells.pop(); // file is last: a summary may hold " | "
  const [id, name, status, priority, size] = cells;
  if (rows[id]) errors.push(`BACKLOG.md: ${id} has more than one row`);
  rows[id] = { name, status, priority, size, file };
}
for (const id of Object.keys(tasks)) if (!rows[id]) errors.push(`BACKLOG.md: no row for ${id} (backlog/${id}.md)`);
for (const [id, row] of Object.entries(rows)) {
  const t = tasks[id];
  if (!t) { errors.push(`BACKLOG.md: row ${id} has no file backlog/${id}.md`); continue; }
  for (const k of ['name', 'status', 'priority', 'size', 'file']) {
    const want = k === 'name' ? t.name.replace(/\|/g, '/') : t[k];
    if (row[k] !== want) errors.push(`BACKLOG.md: ${id} ${k} is "${row[k]}", backlog/${id}.md says "${want}"`);
  }
}
if (errors.length) { console.error('BACKLOG FAIL:\n  ' + errors.join('\n  ')); process.exit(1); }
console.log(`backlog: ${files.length} task files match the BACKLOG.md table`);
