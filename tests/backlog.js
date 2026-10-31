// Backlog check: every backlog/VB-NNN.md has one row, in the BACKLOG.md table (open tasks) or in BACKLOG_ARCHIVE.md (done tasks), and vice versa, and each row's name, arch, phase,
// status (its first word), priority, size and link match the task file. A task's arch must be listed under "## Archs".
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), dir = path.join(root, 'backlog');
const errors = [], PHASES = ['plan', 'implement', 'wrap-up'];
const backlog = fs.readFileSync(path.join(root, 'BACKLOG.md'), 'utf8');
const archSection = (backlog.split('## Archs')[1] || '').split('\n## ')[0];
const archs = new Set(archSection.split('\n').map((l) => (l.match(/^\| ([a-z][a-z-]*) \|/) || [])[1]).filter(Boolean));
if (!archs.size) errors.push('BACKLOG.md: no arch rows under "## Archs"');
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort();
const tasks = {};
for (const f of files) {
  const text = fs.readFileSync(path.join(dir, f), 'utf8'), head = text.match(/^# (VB-\d{3}): (.+)$/m);
  const field = (k) => ((text.match(new RegExp(`^${k}: (.*)$`, 'm')) || [])[1] || '').trim();
  if (!head || !text.startsWith(head[0])) { errors.push(`backlog/${f}:1 line 1 must be "# VB-NNN: <name>"`); continue; }
  if (f !== head[1] + '.md') errors.push(`backlog/${f}:1 file name must be ${head[1]}.md`);
  for (const k of ['Status', 'Priority', 'Size']) if (!field(k)) errors.push(`backlog/${f}: no "${k}:" line`);
  const arch = field('Arch') || '-', phase = field('Phase') || '-';
  if (arch !== '-' && !archs.has(arch)) errors.push(`backlog/${f}: arch "${arch}" is not listed under "## Archs" in BACKLOG.md`);
  if (arch !== '-' && !PHASES.includes(phase)) errors.push(`backlog/${f}: phase "${phase}" must be one of ${PHASES.join(', ')}`);
  if (arch === '-' && phase !== '-') errors.push(`backlog/${f}: a phase without an arch`);
  tasks[head[1]] = { name: head[2], arch, phase, status: field('Status').split(' ')[0], priority: field('Priority'), size: field('Size'),
    file: `[backlog/${f}](backlog/${f})` };
}
const rows = {}, archived = new Set();
const archive = fs.readFileSync(path.join(root, 'BACKLOG_ARCHIVE.md'), 'utf8');
const rowLines = [...backlog.split('\n').map((l) => [l, false]), ...archive.split('\n').map((l) => [l, true])];
for (const [line, inArchive] of rowLines.filter(([l]) => /^\| VB-\d{3} \|/.test(l))) {
  const cells = line.replace(/^\| | \|\s*$/g, '').split(' | '), file = cells.pop(); // file is last: a summary may hold " | "
  const [id, name, arch, phase, status, priority, size] = cells;
  if (rows[id]) errors.push(`BACKLOG.md: ${id} has more than one row`);
  if (inArchive) archived.add(id);
  rows[id] = { name, arch, phase, status, priority, size, file };
}
for (const id of Object.keys(tasks)) if (!rows[id]) errors.push(`BACKLOG.md: no row for ${id} (backlog/${id}.md) in BACKLOG.md or BACKLOG_ARCHIVE.md`);
for (const [id, row] of Object.entries(rows)) {
  const t = tasks[id];
  if (t && (t.status === 'done') !== archived.has(id)) errors.push(`${id} is ${t.status}: its row belongs in ${t.status === 'done' ? 'BACKLOG_ARCHIVE.md' : 'BACKLOG.md'}`);
  if (!t) { errors.push(`BACKLOG.md: row ${id} has no file backlog/${id}.md`); continue; }
  for (const k of ['name', 'arch', 'phase', 'status', 'priority', 'size', 'file']) {
    const want = k === 'name' ? t.name.replace(/\|/g, '/') : t[k];
    if (row[k] !== want) errors.push(`BACKLOG.md: ${id} ${k} is "${row[k]}", backlog/${id}.md says "${want}"`);
  }
}
if (errors.length) { console.error('BACKLOG FAIL:\n  ' + errors.join('\n  ')); process.exit(1); }
const inArch = Object.values(tasks).filter((t) => t.arch !== '-').length;
console.log(`backlog: ${files.length} task files match the BACKLOG.md table and BACKLOG_ARCHIVE.md; ${inArch} in ${archs.size} archs`);
