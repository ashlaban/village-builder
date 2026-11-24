// Backlog tool: read and change the backlog without reading BACKLOG.md or BACKLOG_ARCHIVE.md. The task files (backlog/VB-NNN.md) are the
// source of truth; the task tables are rewritten from them (each row keeps its summary), in the order "How this backlog works" sets, and
// tests/backlog.js checks the result after every change. Prose outside the task tables is never touched.
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
const USAGE = `usage: node tools/backlog.js <command> [--root DIR]
  next [N] [--size S|M|L] [--unattended]
                            the first N ready tasks (default 3), in the order they are taken, with summaries; --size keeps one size;
                            --unattended leaves out the tasks flagged "Flag: Kim takes part" (taken only in a session with Kim)
  list [IDs] [--status S] [--arch KEY] [--waits-for ID] [-s]
                            one line per task (default: open tasks, in table order); S may be open, done or a status list a,b; -s adds summaries
  show ID... [--brief]      a task's file; --brief stops before its notes and reports
  done ID... [--date D]     mark done (Status: done (D)): rows to the archive, ID dropped from "Waits for:" lines, freed tasks set ready
  set ID key=value...       status, priority, size, arch, phase, waits, cause, touches, name, summary (status=done is the same as done)
                            touches=...: the footprint, the functions the task edits (docs/agents/tasks.md)
                            cause=VB-NNN: the task whose change introduced the defect this one mends (cause= removes it)
  new key=value...          the next free ID (above this checkout's task files and those of the branches fetched from origin and pushed in
                            the last 14 days: tools/lib/ids.js): name, status, priority, size, summary required; arch, phase, waits, cause,
                            touches, ref, goal optional (how to write each: docs/agents/tasks.md);
                            id=VB-NNN takes a reserved ID instead (tools/inbox.js start)
  close-arch KEY            an arch with no open tasks: its row moves to the archive's closed archs
  sync [--dry]              rewrite the tables from the task files, e.g. after editing a header by hand; --dry only reports`;

const args = process.argv.slice(2);
const option = (k) => { const i = args.indexOf(k); if (i < 0) return null; const v = args[i + 1]; args.splice(i, 2); return v; };
const flag = (k) => { const i = args.indexOf(k); if (i < 0) return false; args.splice(i, 1); return true; };
const root = path.resolve(option('--root') || path.join(__dirname, '..'));
const today = option('--date') || new Date().toISOString().slice(0, 10);
const dry = flag('--dry'), brief = flag('--brief'), withSummary = flag('-s'), unattended = flag('--unattended'), size = option('--size');
const filters = { status: option('--status'), arch: option('--arch'), waitsFor: option('--waits-for') };
const fail = (msg) => { console.error('backlog: ' + msg); process.exit(1); };

const STATUSES = ['ready', 'needs-review', 'blocked', 'done'];
const TABLES = { ready: ['BACKLOG.md', 'Ready'], 'needs-review': ['BACKLOG.md', 'Waiting for Kim'], blocked: ['BACKLOG.md', 'Blocked'],
  done: ['BACKLOG_ARCHIVE.md', 'Done tasks'] };
const HEADER = ['Status', 'Waits for', 'Cause', 'Priority', 'Size', 'Arch', 'Phase'];
const phaseOf = (name) => (/^Plan:/.test(name) ? 'plan' : /^Wrap-up:/.test(name) ? 'wrap-up' : 'implement');
const num = (id) => +id.slice(3);
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

// ---- task files
const dir = path.join(root, 'backlog');
const tasks = new Map();
for (const f of fs.readdirSync(dir).filter((f) => /^VB-\d{3,}\.md$/.test(f)).sort((a, b) => num(a.slice(0, -3)) - num(b.slice(0, -3)))) {
  const text = fs.readFileSync(path.join(dir, f), 'utf8'), head = text.match(/^# (VB-\d{3,}): (.+)$/m);
  if (!head) fail(`backlog/${f}: line 1 must be "# VB-NNN: <name>"`);
  const field = (k) => ((text.match(new RegExp(`^${k}: (.*)$`, 'm')) || [])[1] || '').trim();
  const waits = field('Waits for');
  tasks.set(head[1], { id: head[1], name: head[2], text, dirty: false, status: field('Status').split(' ')[0], priority: field('Priority'),
    size: field('Size'), arch: field('Arch') || '-', phase: field('Phase') || '-', waits: waits ? waits.split(/,\s*/) : [] });
}
const task = (id) => tasks.get(id) || fail(`no task ${id} (backlog/${id}.md)`);

// A header line is replaced in place, removed (value null), or inserted after the header line that comes before it. Only the header
// block (the title and the HEADER lines under it) is touched: a note further down may begin with the same word ("Cause: ...").
function put(t, key, value) {
  const lines = t.text.split('\n'), isHead = (l) => HEADER.some((k) => l.startsWith(k + ': '));
  let end = 1; while (end < lines.length && isHead(lines[end])) end++;
  let head = lines.slice(0, end).join('\n') + '\n';
  const re = new RegExp(`^${key}: .*\\n?`, 'm');
  if (re.test(head)) head = head.replace(re, value == null ? '' : `${key}: ${value}\n`);
  else if (value != null) {
    const prev = HEADER.slice(0, HEADER.indexOf(key)).reverse().find((k) => new RegExp(`^${k}: `, 'm').test(head));
    head = head.replace(prev ? new RegExp(`^${prev}: .*$`, 'm') : /^# .*$/m, (line) => `${line}\n${key}: ${value}`);
  }
  t.text = head + lines.slice(end).join('\n');
  t.dirty = true;
}
function setStatus(t, status) {
  t.status = status;
  put(t, 'Status', status === 'done' ? `done (${today})` : status);
  if (status !== 'blocked') { t.waits = []; put(t, 'Waits for', null); }
}
function setWaits(t, list) { t.waits = list; put(t, 'Waits for', list.length ? list.join(', ') : null); }
function setArch(t, arch, phase) {
  t.arch = arch || '-'; t.phase = t.arch === '-' ? '-' : phase || phaseOf(t.name);
  put(t, 'Arch', t.arch === '-' ? null : t.arch); put(t, 'Phase', t.arch === '-' ? null : t.phase);
}

// ---- tables
const files = { 'BACKLOG.md': read('BACKLOG.md'), 'BACKLOG_ARCHIVE.md': read('BACKLOG_ARCHIVE.md') }, original = { ...files };
const cellsOf = (line) => line.replace(/^\| /, '').replace(/ \|\s*$/, '').split(' | ');
function sectionLines(file, heading) {
  const lines = files[file].split('\n'), h = lines.indexOf('## ' + heading);
  if (h < 0) fail(`${file}: no "## ${heading}"`);
  let sep = h + 1;
  while (sep < lines.length && !/^\|[-|]+\|$/.test(lines[sep])) { if (/^## /.test(lines[sep])) fail(`${file}: no table under "## ${heading}"`); sep++; }
  const width = heading === 'Blocked' ? 7 : heading === 'Archs' || heading === 'Closed archs' ? 4 : 6;
  const header = lines[sep - 1], separator = lines[sep];
  if (!header.startsWith('| ') || !header.endsWith(' |') || cellsOf(header).length !== width
    || !new RegExp('^(?:\\|-{3,}){' + width + '}\\|$').test(separator)) {
    fail(`${file}: expected a ${width}-column table header and separator under "## ${heading}"`);
  }
  let end = sep + 1;
  while (end < lines.length && lines[end].startsWith('|')) end++;
  return { lines, from: sep + 1, to: end };
}
const tableRows = (file, heading) => { const s = sectionLines(file, heading); return s.lines.slice(s.from, s.to); };
function replaceRows(file, heading, rows) {
  const s = sectionLines(file, heading);
  s.lines.splice(s.from, s.to - s.from, ...rows);
  files[file] = s.lines.join('\n');
}
const summaries = new Map(), placed = new Map();
for (const [status, [file, heading]] of Object.entries(TABLES)) {
  for (const line of tableRows(file, heading)) {
    const cells = cellsOf(line), id = (cells[0].match(/^\[(VB-\d{3,})\]/) || [])[1];
    if (!id) fail(`${file}: "${line.slice(0, 40)}..." under "## ${heading}" is not a task row`);
    // a row's own layout, not its table's: after a merge a blocked row may sit in another table, or another row under Blocked
    const plainWaits = (cells[5] || '').replace(/\[(VB-\d{3,})\]\(#VB-\d{3,}\)/g, '$1');
    const waits = cells.length > 6 && (cells[5] === '-' || /^(VB-\d{3,}|Kim)(, (VB-\d{3,}|Kim))*$/.test(plainWaits)), summary = cells.slice(waits ? 6 : 5).join(' | ');
    if (summary || !summaries.get(id)) summaries.set(id, summary);
    placed.set(id, status);
  }
}
const archKeys = (file, heading) => tableRows(file, heading).map((l) => cellsOf(l)[0]);
let openArchs = archKeys('BACKLOG.md', 'Archs');
const doneOrder = tableRows('BACKLOG_ARCHIVE.md', 'Done tasks').map((l) => (cellsOf(l)[0].match(/VB-\d+/) || [''])[0]);
function rowOf(t) {
  const cells = { name: t.name.replace(/\|/g, '/'), arch: t.arch, priority: t.priority, size: t.size };
  if (t.status === 'blocked') cells.waits = t.waits.map((id) => {
    if (id === 'Kim') return id;
    if (!tasks.has(id) || id === t.id) fail(`${t.id}: invalid dependency ${id}`);
    return `[${id}](#${id})`;
  }).join(', ');
  cells.summary = summaries.get(t.id);
  for (const [field, value] of Object.entries(cells)) {
    if (/[\r\n|]/.test(value)) fail(`${t.id} ${field}: a table cell must be one line without pipe separators`);
    // A code span closes with a run of the same length, even if it contains shorter runs.
    let delimiter = 0;
    for (const match of value.matchAll(/(\\*)(`+)/g)) {
      const ticks = match[2].length;
      if (delimiter) {
        if (ticks === delimiter) delimiter = 0;
      } else {
        delimiter = ticks - (match[1].length % 2);
      }
    }
    if (delimiter) fail(`${t.id} ${field}: close the Markdown code span or escape the literal backtick`);
  }
  const anchor = t.status === 'done' ? '' : `<a id="${t.id}"></a>`;
  return `| [${t.id}](backlog/${t.id}.md)${anchor} | ${Object.values(cells).join(' | ')} |`;
}
const archRank = (a) => (openArchs.includes(a) ? openArchs.indexOf(a) : openArchs.length);
const SORT = { ready: (t) => [+t.priority], 'needs-review': (t) => [+t.priority], blocked: (t) => [archRank(t.arch), +t.priority] };
const compare = (key) => (a, b) => {
  const x = [...key(a), num(a.id)], y = [...key(b), num(b.id)];
  for (let k = 0; k < x.length; k++) if (x[k] !== y[k]) return x[k] - y[k];
  return 0;
};
function ordered(status) {
  const list = [...tasks.values()].filter((t) => t.status === status);
  if (status !== 'done') return list.sort(compare(SORT[status]));
  const rank = (t) => { const k = doneOrder.indexOf(t.id); return k < 0 ? doneOrder.length + (appended.indexOf(t.id) + 1 || appended.length + 1) : k; };
  return list.sort((a, b) => rank(a) - rank(b) || num(a.id) - num(b.id));
}
const appended = [];

// ---- sync: done tasks leave "Waits for:" lines, a task left waiting for nothing is ready, then every task table is rewritten
function sync(report) {
  for (const t of tasks.values()) {
    if (t.status !== 'blocked') continue;
    const dropped = t.waits.filter((w) => tasks.has(w) && tasks.get(w).status === 'done');
    if (!dropped.length) continue;
    setWaits(t, t.waits.filter((w) => !dropped.includes(w)));
    if (t.waits.length) report.push(`${t.id} no longer waits for ${dropped.join(', ')}; still waits for ${t.waits.join(', ')}`);
    else { setStatus(t, 'ready'); report.push(`${t.id} is ready: it waited only for ${dropped.join(', ')} (${t.name})`); }
  }
  const missing = [...tasks.values()].filter((t) => !summaries.has(t.id)).map((t) => t.id);
  if (missing.length) fail(`no row, so no summary, for ${missing.join(', ')}: give one with  set ${missing[0]} summary="..."`);
  for (const [status, [file, heading]] of Object.entries(TABLES)) replaceRows(file, heading, ordered(status).map(rowOf));
  for (const t of tasks.values()) {
    const [file, heading] = TABLES[t.status] || fail(`backlog/${t.id}.md: unknown status "${t.status}"`);
    if (placed.get(t.id) !== t.status) report.push(`${t.id} row ${placed.has(t.id) ? 'moved' : 'added'} to ${file}, "## ${heading}"`);
  }
  for (const key of openArchs) {
    if (![...tasks.values()].some((t) => t.arch === key && t.status !== 'done')) {
      report.push(`arch ${key} has no open tasks left: node tools/backlog.js close-arch ${key}`);
    }
  }
  const changed = [...tasks.values()].filter((t) => t.dirty).map((t) => `backlog/${t.id}.md`)
    .concat(Object.keys(files).filter((f) => files[f] !== original[f]));
  for (const line of report) console.log(line);
  if (dry) { console.log(`dry run: would write ${changed.join(', ') || 'nothing'}`); return; }
  for (const t of tasks.values()) if (t.dirty) fs.writeFileSync(path.join(dir, t.id + '.md'), t.text);
  for (const f of Object.keys(files)) fs.writeFileSync(path.join(root, f), files[f]);
  const check = spawnSync(process.execPath, [path.join(__dirname, '..', 'tests', 'backlog.js'), root], { encoding: 'utf8' });
  process.stdout.write(`wrote ${changed.join(', ') || 'nothing'}\n` + check.stdout + check.stderr);
  if (check.status) process.exit(1);
}

// ---- commands
const listLine = (t) => `${t.id} ${t.status.padEnd(12)} P${t.priority} ${t.size} ${t.arch.padEnd(9)} ${t.name}`
  + (t.status === 'blocked' ? `  [waits: ${t.waits.join(', ')}]` : '') + (withSummary ? `\n    ${summaries.get(t.id) || ''}` : '');
const inOrder = () => STATUSES.flatMap(ordered);
function parsePairs(list) {
  const pairs = {};
  for (const a of list) {
    const m = a.match(/^([a-z]+)=(.*)$/s);
    if (!m) fail(`"${a}" is not key=value`);
    pairs[m[1]] = m[2].trim();
  }
  return pairs;
}
function apply(t, p) {
  const known = ['status', 'priority', 'size', 'arch', 'phase', 'waits', 'cause', 'touches', 'name', 'summary'];
  for (const k of Object.keys(p)) if (!known.includes(k)) fail(`unknown key "${k}" (one of ${known.join(', ')})`);
  if (p.name) { t.name = p.name; t.text = t.text.replace(/^# .*$/m, () => `# ${t.id}: ${p.name}`); t.dirty = true; }
  if (p.priority) { if (!/^[1-3]$/.test(p.priority)) fail('priority is 1, 2 or 3'); t.priority = p.priority; put(t, 'Priority', p.priority); }
  if (p.size) { if (!/^(S|M|L)$/.test(p.size)) fail('size is S, M or L'); t.size = p.size; put(t, 'Size', p.size); }
  if (p.arch || p.phase || (p.name && t.arch !== '-')) setArch(t, p.arch || t.arch, p.phase || (p.name ? null : t.phase));
  if (p.summary) summaries.set(t.id, p.summary.replace(/\|/g, '/'));
  if (p.status) {
    if (!STATUSES.includes(p.status)) fail(`status is one of ${STATUSES.join(', ')}`);
    if (p.status === 'done' && t.status === 'done') report.push(`${t.id} was already done`);
    else {
      if (p.status === 'done') appended.push(t.id);
      setStatus(t, p.status);
    }
  }
  if (p.waits !== undefined) {
    const list = p.waits ? p.waits.split(/,\s*/) : [];
    for (const w of list) if (w !== 'Kim' && !tasks.has(w)) fail(`waits for ${w}, which has no file`);
    setWaits(t, list);
  }
  if (p.cause !== undefined) {
    if (p.cause && (!tasks.has(p.cause) || p.cause === t.id)) fail(`cause=${p.cause}: ${p.cause === t.id ? 'a task is not its own cause' : 'no such task file'}`);
    put(t, 'Cause', p.cause || null); t.dirty = true;
  }
  if (p.touches !== undefined) { // the footprint (VB-1677, docs/agents/tasks.md): after "Design ref:", or after the header block
    try { require('./lib/touches.js').parseTouches(p.touches); } catch (e) { fail(`touches=: ${e.message}`); }
    const line = `Touches: ${p.touches}`;
    if (/^Touches: .*$/m.test(t.text)) t.text = t.text.replace(/^Touches: .*$/m, () => line);
    else if (/^Design ref: .*$/m.test(t.text)) t.text = t.text.replace(/^Design ref: .*$/m, (l) => `${l}\n${line}`);
    else t.text = t.text.replace(/^(Goal|Acceptance criteria)\b/m, (l) => `${line}\n${l}`);
    t.dirty = true;
  }
  if (t.status === 'blocked' && !t.waits.length) fail(`${t.id} is blocked: give waits=VB-NNN[, ...] or waits=Kim`);
  if (t.status !== 'blocked' && t.waits.length) fail(`${t.id} is ${t.status}: only blocked tasks wait (drop waits=)`);
}
const [cmd, ...rest] = args;
const report = [];
if (cmd === 'next') {
  const all = ordered('ready'), n = +(rest[0] || 3), kimTakesPart = (t) => /^- Flag: Kim takes part/m.test(t.text);
  const ready = all.filter((t) => (!size || t.size === size.toUpperCase()) && !(unattended && kimTakesPart(t)));
  for (const t of ready.slice(0, n)) {
    const freed = [...tasks.values()].filter((u) => u.waits.includes(t.id)).map((u) => u.id + (u.waits.length === 1 ? '*' : ''));
    console.log(`${t.id} P${t.priority} ${t.size} ${t.arch}: ${t.name}\n    ${summaries.get(t.id)}`
      + (freed.length ? `\n    waited for by ${freed.join(', ')} (* only this)` : ''));
  }
  const count = (s) => ordered(s).length;
  const left = all.length - ready.length;
  console.log(`${ready.length} ready${left ? ` of ${all.length} (${left} left out by --size or --unattended)` : ''}`
    + ` (${Math.max(0, ready.length - n)} more), ${count('needs-review')} waiting for Kim, ${count('blocked')} blocked;`
    + ' read one with  node tools/backlog.js show ID');
} else if (cmd === 'list') {
  const statuses = !filters.status || filters.status === 'open' ? STATUSES.slice(0, 3) : filters.status.split(',');
  const ids = rest.length ? new Set(rest.map((id) => task(id).id)) : null;
  for (const t of inOrder()) {
    if (ids ? !ids.has(t.id) : !statuses.includes(t.status)) continue;
    if ((filters.arch && t.arch !== filters.arch) || (filters.waitsFor && !t.waits.includes(filters.waitsFor))) continue;
    console.log(listLine(t));
  }
} else if (cmd === 'show') {
  if (!rest.length) fail('show ID...');
  for (const id of rest) {
    const text = task(id).text, cut = brief ? text.search(/^(Notes|Implementation|Validation)\b.*:/m) : -1;
    console.log((cut < 0 ? text : text.slice(0, cut) + '(notes and reports left out: drop --brief)\n').trimEnd() + '\n');
  }
} else if (cmd === 'done' || cmd === 'set') {
  const ids = cmd === 'done' ? rest : rest.slice(0, 1), pairs = cmd === 'done' ? { status: 'done' } : parsePairs(rest.slice(1));
  if (!ids.length || !Object.keys(pairs).length) fail(cmd === 'done' ? 'done ID...' : 'set ID key=value...');
  for (const id of ids) apply(task(id), pairs);
  sync(report);
  if (cmd === 'done' || pairs.status === 'done') {
    console.log(`next: tick ${ids.join(', ')}'s criteria and add the notes in the file; answered questions move to QUESTION_ARCHIVE.md`);
  }
} else if (cmd === 'new') {
  const p = parsePairs(rest), lack = ['name', 'status', 'priority', 'size', 'summary'].filter((k) => !p[k]);
  if (lack.length) fail(`new needs ${lack.join(', ')} (key=value)`);
  if (p.status === 'ready') fail('a new task starts blocked or needs-review: fill in its file, then  set ID status=ready');
  if (p.id && (!/^VB-\d{3,}$/.test(p.id) || tasks.has(p.id))) fail(`id=${p.id}: ${tasks.has(p.id) ? 'taken' : 'not VB-NNN'}`);
  // above every task file in sight: this checkout's and the branches pushed to origin lately (VB-1680), so sessions side by side differ
  const seen = require('./lib/ids.js').highestId(root), local = Math.max(0, ...[...tasks.keys()].map(num));
  const id = p.id || 'VB-' + String(Math.max(local, seen.max) + 1).padStart(3, '0');
  if (!p.id && seen.max > local) console.log(`${id}: above ${seen.where}, which holds task files up to VB-${seen.max}`);
  delete p.id;
  const t = { id, name: p.name, status: '', priority: '', size: '', arch: '-', phase: '-', waits: [], dirty: true,
    text: `# ${id}: ${p.name}\nStatus: ${p.status}\nPriority: ${p.priority}\nSize: ${p.size}\n`
      + `Design ref: ${p.ref || '(to write)'}\nTouches: (to write)\nGoal: ${p.goal || '(to write)'}\nAcceptance criteria:\n- [ ] (to write)\n` };
  tasks.set(id, t);
  delete p.ref; delete p.goal;
  apply(t, p);
  sync(report);
  console.log(`${id} created: backlog/${id}.md; fill in what says "(to write)"`);
} else if (cmd === 'close-arch') {
  const key = rest[0], open = [...tasks.values()].filter((t) => t.arch === key && t.status !== 'done');
  if (!openArchs.includes(key)) fail(`no open arch "${key}" in BACKLOG.md, "## Archs"`);
  if (open.length) fail(`arch ${key} still has open tasks: ${open.map((t) => t.id).join(', ')}`);
  const archs = tableRows('BACKLOG.md', 'Archs'), line = archs.find((l) => cellsOf(l)[0] === key), cells = cellsOf(line);
  const [y, m, d] = today.split('-'), month = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September',
    'October', 'November', 'December'][+m - 1];
  cells[2] = `Closed ${+d} ${month} ${y}: ${cells[2]}`;
  replaceRows('BACKLOG.md', 'Archs', archs.filter((l) => l !== line));
  replaceRows('BACKLOG_ARCHIVE.md', 'Closed archs', [...tableRows('BACKLOG_ARCHIVE.md', 'Closed archs'), `| ${cells.join(' | ')} |`]);
  openArchs = openArchs.filter((k) => k !== key);
  sync(report);
  console.log(`arch ${key} closed; check the prose above BACKLOG.md's Archs table if it counts or names archs`);
} else if (cmd === 'sync') sync(report);
else { const help = !cmd || ['help', '--help', '-h'].includes(cmd); (help ? console.log : console.error)(USAGE); process.exit(help ? 0 : 1); }
