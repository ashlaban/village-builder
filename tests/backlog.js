// Backlog check: every backlog/VB-NNN.md has one row, in BACKLOG.md under its status's section (Ready, Waiting for Kim, Blocked) or, when done,
// in BACKLOG_ARCHIVE.md under "## Done tasks", and vice versa. Each row's link, name, arch, priority and size match the task file; the phase has no
// column but must agree with the name ("Plan: ..." is a plan, "Wrap-up: ..." a wrap-up, any other an implement task). The open sections are sorted
// as "How this backlog works" says. A task's arch is listed under "## Archs" in BACKLOG.md (open) or "## Closed archs" in BACKLOG_ARCHIVE.md;
// an open task's arch must be open. A ready task states its goal and acceptance criteria, with nothing left "(to write)".
// `node tests/backlog.js DIR` checks the backlog of another checkout (tools/backlog.js checks the copy it changed).
const fs = require('fs'), path = require('path');
const root = process.argv[2] ? path.resolve(process.argv[2]) : path.join(__dirname, '..'), dir = path.join(root, 'backlog');
const errors = [], PHASES = ['plan', 'implement', 'wrap-up'];
const SECTIONS = { 'BACKLOG.md': { 'Ready': 'ready', 'Waiting for Kim': 'needs-review', 'Blocked': 'blocked' },
  'BACKLOG_ARCHIVE.md': { 'Done tasks': 'done' } };
const texts = { 'BACKLOG.md': fs.readFileSync(path.join(root, 'BACKLOG.md'), 'utf8'),
  'BACKLOG_ARCHIVE.md': fs.readFileSync(path.join(root, 'BACKLOG_ARCHIVE.md'), 'utf8') };
const archKeys = (text, heading) => {
  const section = (text.split('\n## ' + heading + '\n')[1] || '').split('\n## ')[0];
  return section.split('\n').map((l) => (l.match(/^\| ([a-z][a-z-]*) \|/) || [])[1]).filter(Boolean);
};
const openArchs = archKeys(texts['BACKLOG.md'], 'Archs'), closedArchs = new Set(archKeys(texts['BACKLOG_ARCHIVE.md'], 'Closed archs'));
const archs = new Set([...openArchs, ...closedArchs]);
if (!openArchs.length) errors.push('BACKLOG.md: no arch rows under "## Archs"');
for (const k of openArchs) if (closedArchs.has(k)) errors.push(`arch "${k}" is listed as open in BACKLOG.md and as closed in BACKLOG_ARCHIVE.md`);
const phaseOf = (name) => (/^Plan:/.test(name) ? 'plan' : /^Wrap-up:/.test(name) ? 'wrap-up' : 'implement');

const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort();
const tasks = {};
for (const f of files) {
  const text = fs.readFileSync(path.join(dir, f), 'utf8'), head = text.match(/^# (VB-\d{3}): (.+)$/m);
  const field = (k) => ((text.match(new RegExp(`^${k}: (.*)$`, 'm')) || [])[1] || '').trim();
  if (!head || !text.startsWith(head[0])) { errors.push(`backlog/${f}:1 line 1 must be "# VB-NNN: <name>"`); continue; }
  if (f !== head[1] + '.md') errors.push(`backlog/${f}:1 file name must be ${head[1]}.md`);
  for (const k of ['Status', 'Priority', 'Size']) if (!field(k)) errors.push(`backlog/${f}: no "${k}:" line`);
  const arch = field('Arch') || '-', phase = field('Phase') || '-', status = field('Status').split(' ')[0];
  if (arch !== '-' && !archs.has(arch)) errors.push(`backlog/${f}: arch "${arch}" is not listed in BACKLOG.md or BACKLOG_ARCHIVE.md`);
  if (closedArchs.has(arch) && status !== 'done') errors.push(`backlog/${f}: open task in closed arch "${arch}"`);
  if (arch !== '-' && !PHASES.includes(phase)) errors.push(`backlog/${f}: phase "${phase}" must be one of ${PHASES.join(', ')}`);
  if (arch !== '-' && PHASES.includes(phase) && phase !== phaseOf(head[2]))
    errors.push(`backlog/${f}: phase "${phase}", but its name makes it ${phaseOf(head[2])} (plans are named "Plan: ...", wrap-ups "Wrap-up: ...")`);
  if (arch === '-' && phase !== '-') errors.push(`backlog/${f}: a phase without an arch`);
  if (status === 'ready' && (!/^Goal: /m.test(text) || !/^Acceptance criteria\b/m.test(text) || text.includes('(to write)')))
    errors.push(`backlog/${f} is ready: it needs a "Goal:" line and "Acceptance criteria", and nothing left "(to write)"`);
  tasks[head[1]] = { name: head[2], arch, status, priority: field('Priority'), size: field('Size'), waits: field('Waits for') };
}

// "Waits for:" names what a blocked task waits for: open tasks and/or Kim. Only blocked tasks have it, and it never names a done task, so a
// task whose blockers are all done fails here until it is set ready (or names what it still waits for).
for (const [id, t] of Object.entries(tasks)) {
  if (t.status !== 'blocked') { if (t.waits) errors.push(`backlog/${id}.md is ${t.status}: remove its "Waits for:" line`); continue; }
  if (!t.waits) { errors.push(`backlog/${id}.md is blocked: add a "Waits for:" line naming the open tasks (VB-NNN) or Kim it waits for`); continue; }
  for (const item of t.waits.split(', ')) {
    if (item === 'Kim') continue;
    if (!/^VB-\d{3}$/.test(item)) errors.push(`backlog/${id}.md: "Waits for:" item "${item}" must be VB-NNN or Kim, separated by ", "`);
    else if (item === id || !tasks[item]) errors.push(`backlog/${id}.md: waits for ${item}, ${item === id ? 'itself' : 'which has no file'}`);
    else if (tasks[item].status === 'done') errors.push(`backlog/${id}.md waits for ${item}, which is done: drop it, and set the task ready if nothing is left`);
  }
}

// Rows: "| [VB-NNN](backlog/VB-NNN.md) | name | arch | priority | size | summary |", under a section heading that names their status;
// under "## Blocked" a "waits for" cell comes before the summary.
const rows = {}, sections = [];
for (const [file, text] of Object.entries(texts)) {
  let heading = null, list = null;
  for (const line of text.split('\n')) {
    const h = line.match(/^## (.+)$/);
    if (h) { heading = h[1]; list = { file, heading, rows: [] }; sections.push(list); continue; }
    if (!/^\| \[?VB-\d{3}/.test(line)) continue;
    const cells = line.replace(/^\| | \|\s*$/g, '').split(' | ');
    const m = cells[0].match(/^\[(VB-\d{3})\]\(backlog\/(VB-\d{3})\.md\)$/), blocked = heading === 'Blocked';
    if (!m || m[1] !== m[2] || cells.length < (blocked ? 7 : 6)) {
      errors.push(`${file}: "${line.slice(0, 40)}..." must be | [VB-NNN](backlog/VB-NNN.md) | name | arch | priority | size |${blocked ? ' waits for |' : ''} summary |`);
      continue;
    }
    const [, name, arch, priority, size] = cells, id = m[1], status = (SECTIONS[file] || {})[heading];
    if (!status) { errors.push(`${file}: ${id} is under "## ${heading}", which holds no tasks`); continue; }
    if (rows[id]) errors.push(`${file}: ${id} has more than one row`);
    rows[id] = { file, heading, name, arch, status, priority, size, waits: blocked ? cells[5] : '' };
    list.rows.push(id);
  }
}
const where = (status) => (status === 'done' ? 'BACKLOG_ARCHIVE.md, "## Done tasks"'
  : `BACKLOG.md, "## ${Object.keys(SECTIONS['BACKLOG.md']).find((k) => SECTIONS['BACKLOG.md'][k] === status)}"`);
for (const id of Object.keys(tasks)) if (!rows[id]) errors.push(`no row for ${id} (backlog/${id}.md); it belongs in ${where(tasks[id].status)}`);
for (const [id, row] of Object.entries(rows)) {
  const t = tasks[id];
  if (!t) { errors.push(`${row.file}: row ${id} has no file backlog/${id}.md`); continue; }
  if (!Object.values(SECTIONS).some((s) => Object.values(s).includes(t.status))) { errors.push(`backlog/${id}.md: unknown status "${t.status}"`); continue; }
  if (row.status !== t.status) errors.push(`${id} is ${t.status}: its row is under "## ${row.heading}" and belongs in ${where(t.status)}`);
  for (const k of row.status === 'blocked' && t.status === 'blocked' ? ['name', 'arch', 'priority', 'size', 'waits'] : ['name', 'arch', 'priority', 'size']) {
    const want = k === 'name' ? t.name.replace(/\|/g, '/') : t[k];
    if (row[k] !== want) errors.push(`${row.file}: ${id} ${k === 'waits' ? 'waits for' : k} is "${row[k]}", backlog/${id}.md says "${want}"`);
  }
}

// Order: Ready and Waiting for Kim by priority, then ID; Blocked by arch (the Archs table's order, no arch last), then priority, then ID.
const archRank = (a) => (openArchs.includes(a) ? openArchs.indexOf(a) : openArchs.length);
const SORTS = { 'Ready': ['priority, then ID', (r) => [+r.priority]], 'Waiting for Kim': ['priority, then ID', (r) => [+r.priority]],
  'Blocked': ['arch, then priority, then ID', (r) => [archRank(r.arch), +r.priority]] };
const before = (a, b) => { for (let k = 0; k < a.length; k++) if (a[k] !== b[k]) return a[k] < b[k]; return false; };
for (const s of sections.filter((s) => s.file === 'BACKLOG.md' && SORTS[s.heading])) {
  const [rule, key] = SORTS[s.heading], keyOf = (id) => [...key(rows[id]), +id.slice(3)];
  for (let k = 1; k < s.rows.length; k++) {
    if (before(keyOf(s.rows[k]), keyOf(s.rows[k - 1]))) errors.push(`BACKLOG.md: under "## ${s.heading}" (by ${rule}), ${s.rows[k]} belongs before ${s.rows[k - 1]}`);
  }
}

if (errors.length) {
  console.error('BACKLOG FAIL:\n  ' + errors.join('\n  ') + '\n(rows, order and freed tasks follow from the task files: node tools/backlog.js sync)');
  process.exit(1);
}
const count = (st) => Object.values(tasks).filter((t) => t.status === st).length;
console.log(`backlog: ${files.length} task files match BACKLOG.md and BACKLOG_ARCHIVE.md: ${count('ready')} ready, ${count('needs-review')} waiting`
  + ` for Kim, ${count('blocked')} blocked, ${count('done')} done; ${openArchs.length} open archs, ${closedArchs.size} closed`);
