// Inbox: what an orchestrator and its sub-agents share during one run, in a local SQLite file that is never committed
// (<git common dir>/vb-inbox.db, so every worktree of the checkout sees the same file). Sub-agents work side by side, each in its own
// worktree, and never edit BACKLOG.md, QUESTIONS.md or docs/tuning.md: they leave notes here, and the orchestrator writes those files
// once, after merging (apply). Nothing durable lives here: apply and report carry it into the repository and the PR.
// usage: node tools/inbox.js <command> [--db FILE] [--root DIR]
//   init [--fresh]             make the file; the next free task ID is read from backlog/ (--fresh empties an earlier run's file)
//   start TASK [N]             a sub-agent starts on TASK: reserves N (default 5) new task IDs for it and prints them
//   claim TASK FILE...         TASK will edit these files; prints who else holds one (exit 1) and claims them all the same
//   note TASK KIND key=value... [--body FILE|-]
//                              leave a note (kinds below); the body is Markdown, from a file or standard input
//   result TASK status=done|needs-review|failed|continue [commit=SHA] [size=S|M|L] [model=NAME] [summary=TEXT]
//                              TASK's outcome; frees its claims
//                              continue: the ceiling on calls was reached and a fresh sub-agent goes on from commit= (at most twice a task)
//   calls [AGENT]              a sub-agent's model calls so far against the ceiling of 120, from its own transcript (found by its worktree, agent-<id>)
//   list [KIND] [--task TASK] [--json]
//                              the notes, a line each
//   status                     the tasks started, their claims and results, and the notes not yet applied
//   apply [--dry]              the orchestrator, after merging: marks the results in the backlog (done, needs-review), creates the noted
//                              tasks (tools/backlog.js new id=...), appends the questions to QUESTIONS.md and the tuning rows to
//                              docs/tuning.md; each note and result is applied once
//   report                     the PR's "For Kim" section, in Markdown: principle candidates, teleports found, close calls, questions, new tasks
//   results [--json]           the results, for  node tools/agent-usage.js --results FILE
// kinds, with their keys:
//   task       id= (one reserved by start) name= priority= size= summary= [status=ready|blocked|needs-review arch= waits= ref= goal=]; body: its criteria
//              (ready: goal=, ref= and the body given, and no question for Kim; priority=1 if it mends a red check)
//   question   priority= title= [about=VB-NNN, the task it is filed under: default TASK]; body: the numbered questions, each with its proposed answer (**P:**), as in QUESTIONS.md
//   tuning     parameter= means= measured= proposed=   a row of docs/tuning.md, Parameters waiting
//   candidate  rule=   a principle candidate (AGENTS.md, Surfacing); body: the decisions behind it
//   teleport   where= what=   a teleport found (AGENTS.md, the hard rule): apply adds it to the open collecting task, a line
//   act        where= what=   an act with no pawn, or a choice only the player has (AGENTS.md, 16): collected likewise
//   decision   what= why=   a close call, decided by Deciding without Kim, that Kim should see
require('./help.js')(__filename);
const os = require('os'), fs = require('fs'), path = require('path'), { execFileSync, spawnSync } = require('child_process');
const emitWarning = process.emitWarning;
process.emitWarning = (w, ...a) => (/SQLite/.test(String(w)) ? undefined : emitWarning.call(process, w, ...a)); // node:sqlite is marked experimental
const { DatabaseSync } = require('node:sqlite');

const args = process.argv.slice(2);
const option = (k) => { const i = args.indexOf(k); if (i < 0) return null; const v = args[i + 1]; args.splice(i, 2); return v; };
const flag = (k) => { const i = args.indexOf(k); if (i < 0) return false; args.splice(i, 1); return true; };
const fail = (msg) => { console.error('inbox: ' + msg); process.exit(1); };
const root = path.resolve(option('--root') || path.join(__dirname, '..'));
const asJson = flag('--json'), dry = flag('--dry'), fresh = flag('--fresh'), bodyFrom = option('--body'), onlyTask = option('--task');
const today = option('--date') || new Date().toISOString().slice(0, 10);

const KINDS = { task: ['id', 'name', 'priority', 'size', 'summary'], question: ['priority', 'title'], tuning: ['parameter', 'means', 'measured', 'proposed'],
  candidate: ['rule'], teleport: ['where', 'what'], act: ['where', 'what'], decision: ['what', 'why'] };
// Findings are collected, not given a task each (Kim, 18 November): one open task a kind holds them, a criterion a finding, and a
// slice's wrap-up sweeps it. apply finds that task by its name, or makes the next one.
const COLLECT = {
  teleport: { name: "Teleports found, collected: swept at a slice's wrap-up", arch: 'physical', goal: 'Each teleport listed is mended or shown to be none: goods arrive by being carried',
    summary: 'The teleports tasks found in the code, a line each; swept together when a slice wraps up' },
  act: { name: "Acts with no pawn, collected: swept at a slice's wrap-up", arch: 'acts', goal: 'Each act listed is a pawn\'s, through a verb any pawn may use',
    summary: 'The acts with no pawn, and the choices only the player has, that tasks found; a line each, swept when a slice wraps up' },
};
const OPTIONAL = { task: ['status', 'arch', 'waits', 'ref', 'goal'], question: ['about'], teleport: ['task'] };
const NEEDS_BODY = ['question'];
// The ceiling on a sub-agent's model calls (Kim, 18 November): every call re-reads the whole context, so a long task is handed to a
// fresh sub-agent instead. On 15 November 10 tasks of 45 went past 120 calls and took 71% of the night's cost.
const CEILING = 120, WARN = 15, CONTINUATIONS = 2;

function dbFile() {
  const given = option('--db') || process.env.VB_INBOX;
  if (given) return path.resolve(given);
  try {
    const common = execFileSync('git', ['rev-parse', '--git-common-dir'], { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    return path.join(path.resolve(root, common), 'vb-inbox.db');
  } catch (e) { return fail('not a git checkout: give --db FILE'); }
}
const file = dbFile();
const [cmd, ...rest] = args;
if (!cmd) fail('a command: init, start, claim, note, result, list, status, apply, report, results (--help)');
if (cmd !== 'init' && !fs.existsSync(file)) fail(`no inbox at ${file}: the orchestrator runs  node tools/inbox.js init  first`);
if (cmd === 'init' && fresh && fs.existsSync(file)) fs.rmSync(file);
const db = new DatabaseSync(file);
db.exec('PRAGMA busy_timeout = 5000');
const all = (sql, ...p) => db.prepare(sql).all(...p), get = (sql, ...p) => db.prepare(sql).get(...p), run = (sql, ...p) => db.prepare(sql).run(...p);
// One writer at a time: a command's reads and writes are one transaction, so two sub-agents never take the same ID.
const atomic = (f) => { db.exec('BEGIN IMMEDIATE'); try { const v = f(); db.exec('COMMIT'); return v; } catch (e) { db.exec('ROLLBACK'); throw e; } };

const taskId = (s) => (/^VB-\d{3,}$/.test(s || '') ? s : fail(`"${s || ''}" is not a task ID (VB-NNN)`));
const pad = (n) => 'VB-' + String(n).padStart(3, '0');
const pairs = (list) => Object.fromEntries(list.map((a) => {
  const i = a.indexOf('=');
  if (i < 1) fail(`"${a}" is not key=value`);
  return [a.slice(0, i), a.slice(i + 1)];
}));
const one = (s) => String(s).replace(/\s+/g, ' ').trim();
const cell = (s) => one(s).replace(/\|/g, '/');
const noteOf = (r) => ({ ...r, fields: JSON.parse(r.fields) });
const notes = (where = '', ...p) => all(`SELECT * FROM notes ${where} ORDER BY n`, ...p).map(noteOf);
const headline = (n) => {
  const f = n.fields;
  return one({ task: `${f.id} ${f.name}`, question: f.title, tuning: `${f.parameter}: ${f.measured}`, candidate: f.rule,
    teleport: `${f.where}: ${f.what}${f.task ? ` (${f.task})` : ''}`, act: `${f.where}: ${f.what}`, decision: `${f.what}: ${f.why}` }[n.kind]);
};

if (cmd === 'init') {
  db.exec(`CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
    CREATE TABLE IF NOT EXISTS ids (id TEXT PRIMARY KEY, task TEXT, used INTEGER DEFAULT 0);
    CREATE TABLE IF NOT EXISTS claims (file TEXT, task TEXT, PRIMARY KEY (file, task));
    CREATE TABLE IF NOT EXISTS notes (n INTEGER PRIMARY KEY AUTOINCREMENT, task TEXT, kind TEXT, fields TEXT, body TEXT, applied INTEGER DEFAULT 0);
    CREATE TABLE IF NOT EXISTS results (task TEXT PRIMARY KEY, status TEXT, commit_ TEXT, size TEXT, model TEXT, summary TEXT, started TEXT,
      ended TEXT, applied INTEGER DEFAULT 0);`);
  const dir = path.join(root, 'backlog');
  const last = Math.max(0, ...(fs.existsSync(dir) ? fs.readdirSync(dir) : []).map((f) => +(f.match(/^VB-(\d+)\.md$/) || [])[1] || 0));
  atomic(() => {
    const have = get("SELECT value FROM meta WHERE key = 'next'");
    if (!have) run("INSERT INTO meta VALUES ('next', ?)", String(last + 1));
    else if (+have.value <= last) run("UPDATE meta SET value = ? WHERE key = 'next'", String(last + 1));
  });
  console.log(`inbox at ${file}; the next free task ID is ${pad(+get("SELECT value FROM meta WHERE key = 'next'").value)}`);
} else if (cmd === 'start') {
  const task = taskId(rest[0]), n = Math.max(0, Math.min(20, rest[1] == null ? 5 : +rest[1] || 0));
  const ids = atomic(() => {
    run('INSERT OR IGNORE INTO results (task, started) VALUES (?, ?)', task, new Date().toISOString());
    const next = +get("SELECT value FROM meta WHERE key = 'next'").value, got = [];
    for (let i = 0; i < n; i++) { got.push(pad(next + i)); run('INSERT INTO ids (id, task) VALUES (?, ?)', pad(next + i), task); }
    run("UPDATE meta SET value = ? WHERE key = 'next'", String(next + n));
    return got;
  });
  console.log(`${task} started; reserved for its new tasks: ${ids.join(' ') || 'none'}`);
} else if (cmd === 'claim') {
  const task = taskId(rest[0]), files = rest.slice(1).map((f) => path.relative(root, path.resolve(root, f)));
  if (!files.length) fail('claim TASK FILE...');
  const held = atomic(() => {
    const others = files.flatMap((f) => all('SELECT file, task FROM claims WHERE file = ? AND task != ?', f, task));
    for (const f of files) run('INSERT OR IGNORE INTO claims VALUES (?, ?)', f, task);
    return others;
  });
  if (held.length) {
    console.log(held.map((h) => `${h.file} is also being edited by ${h.task}`).join('\n')
      + '\nclaimed all the same: keep your change to these files small, and merge the run\'s branch before you finish');
    process.exit(1);
  }
  console.log(`${task} claims ${files.join(', ')}`);
} else if (cmd === 'note') {
  const task = taskId(rest[0]), kind = rest[1], f = pairs(rest.slice(2));
  if (!KINDS[kind]) fail(`kind "${kind || ''}": one of ${Object.keys(KINDS).join(', ')}`);
  const lack = KINDS[kind].filter((k) => !f[k]), unknown = Object.keys(f).filter((k) => ![...KINDS[kind], ...(OPTIONAL[kind] || [])].includes(k));
  if (lack.length) fail(`a ${kind} note needs ${lack.join(', ')} (key=value)`);
  if (unknown.length) fail(`a ${kind} note has no key ${unknown.join(', ')}`);
  const body = bodyFrom ? fs.readFileSync(bodyFrom === '-' ? 0 : bodyFrom, 'utf8').trim() : '';
  if (NEEDS_BODY.includes(kind) && !body) fail(`a ${kind} note needs its text: --body FILE, or --body - for standard input`);
  if (f.priority && !/^[1-3]$/.test(f.priority)) fail('priority is 1, 2 or 3');
  if (kind === 'task') {
    if (!/^(S|M|L)$/.test(f.size)) fail('size is S, M or L');
    if (f.status && !['blocked', 'needs-review', 'ready'].includes(f.status)) fail('a noted task is ready, blocked or needs-review (the default)');
    if (f.status === 'ready' && !(f.goal && f.ref && body)) fail('a noted task is ready only with its goal (goal=), its design ref (ref=) and its criteria (--body), and no question for Kim; else needs-review (the default)');
  }
  const n = atomic(() => {
    if (kind === 'task') {
      const own = get('SELECT * FROM ids WHERE id = ?', f.id);
      if (!own || own.task !== task) fail(`${f.id} is not reserved for ${task}: its IDs are ${all('SELECT id FROM ids WHERE task = ? AND used = 0', task).map((r) => r.id).join(' ') || 'used up (start TASK N reserves more)'}`);
      if (own.used) fail(`${f.id} already has a note`);
      run('UPDATE ids SET used = 1 WHERE id = ?', f.id);
    }
    return run('INSERT INTO notes (task, kind, fields, body) VALUES (?, ?, ?, ?)', task, kind, JSON.stringify(f), body).lastInsertRowid;
  });
  console.log(`note ${n} (${kind}) from ${task}`);
} else if (cmd === 'result') {
  const task = taskId(rest[0]), f = pairs(rest.slice(1));
  if (!['done', 'needs-review', 'failed', 'continue'].includes(f.status)) fail('status=done, needs-review, failed or continue');
  let nth = 0;
  if (f.status === 'continue') {
    if (!f.commit) fail('continue needs commit=SHA: commit what you have first');
    nth = +(get('SELECT value FROM meta WHERE key = ?', 'continued:' + task) || { value: 0 }).value + 1;
    if (nth > CONTINUATIONS) fail(`${task} has been continued ${CONTINUATIONS} times: end with status=needs-review, the unmet criteria in summary=`);
    run('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', 'continued:' + task, String(nth));
  }
  if (f.size && !/^(S|M|L)$/.test(f.size)) fail('size is S, M or L');
  atomic(() => {
    run('INSERT OR IGNORE INTO results (task, started) VALUES (?, ?)', task, new Date().toISOString());
    run('UPDATE results SET status = ?, commit_ = COALESCE(?, commit_), size = COALESCE(?, size), model = COALESCE(?, model), summary = COALESCE(?, summary), ended = ?, applied = 0 WHERE task = ?',
      f.status, f.commit || null, f.size || null, f.model || null, f.summary ? one(f.summary) : null, new Date().toISOString(), task);
    run('DELETE FROM claims WHERE task = ?', task);
  });
  console.log(`${task}: ${f.status}${nth ? ` (${nth} of ${CONTINUATIONS})` : ''}`);
} else if (cmd === 'calls') {
  const agent = rest[0] || (path.basename(root).match(/^agent-(\w+)$/) || [])[1];
  if (!agent) fail('calls: not in a sub-agent\'s worktree (agent-<id>); give the agent id');
  const base = path.join(process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude'), 'projects'), name = `agent-${agent}.jsonl`;
  const found = (fs.existsSync(base) ? fs.readdirSync(base) : []).flatMap((p) => fs.readdirSync(path.join(base, p)).map((s) => path.join(base, p, s, 'subagents', name))).find((p) => fs.existsSync(p));
  if (!found) fail(`calls: no transcript ${name} under ${base}`);
  const ids = new Set();
  for (const line of fs.readFileSync(found, 'utf8').split('\n')) {
    if (!line.includes('"assistant"')) continue;
    try { const e = JSON.parse(line); if (e.type === 'assistant' && e.message && e.message.id) ids.add(e.message.id); } catch (e) { /* a line still being written */ }
  }
  const n = ids.size, left = CEILING - n;
  console.log(`${n} of ${CEILING} calls` + (left > WARN ? '' : left > 0 ? `: ${left} left. Finish within them, or hand over now (.claude/agents/vb-task.md, The ceiling)`
    : ': the ceiling is reached. Hand over now: commit, then  node tools/inbox.js result ID status=continue commit=SHA summary=...'));
} else if (cmd === 'list') {
  const kind = rest[0];
  if (kind && !KINDS[kind]) fail(`kind "${kind}": one of ${Object.keys(KINDS).join(', ')}`);
  const rows = notes().filter((n) => (!kind || n.kind === kind) && (!onlyTask || n.task === onlyTask));
  if (asJson) console.log(JSON.stringify(rows, null, 1));
  else console.log(rows.map((n) => `${n.n} ${n.kind} from ${n.task}${n.applied ? ' (applied)' : ''}: ${headline(n)}`).join('\n') || 'no notes');
} else if (cmd === 'status') {
  const rs = all('SELECT * FROM results ORDER BY started');
  for (const r of rs) {
    const claims = all('SELECT file FROM claims WHERE task = ?', r.task).map((c) => c.file);
    console.log(`${r.task} ${r.status || 'running'}${r.commit_ ? ' ' + r.commit_ : ''}${claims.length ? '; editing ' + claims.join(', ') : ''}`);
  }
  const open = notes('WHERE applied = 0'), byKind = Object.keys(KINDS).map((k) => [k, open.filter((n) => n.kind === k).length]).filter(([, c]) => c);
  console.log(`${rs.length} tasks started, ${rs.filter((r) => !r.status).length} running; notes not applied: ${byKind.map(([k, c]) => `${c} ${k}`).join(', ') || 'none'}`);
} else if (cmd === 'results') {
  const rs = all('SELECT * FROM results ORDER BY started').map((r) => ({ task: r.task, status: r.status || 'running', commit: r.commit_, size: r.size,
    model: r.model, summary: r.summary, started: r.started, ended: r.ended }));
  if (asJson) console.log(JSON.stringify(rs, null, 1));
  else console.log(rs.map((r) => `${r.task} ${r.size || '-'} ${r.status}${r.commit ? ' ' + r.commit : ''}${r.summary ? ': ' + r.summary : ''}`).join('\n') || 'no results');
} else if (cmd === 'apply') {
  const backlog = (...a) => {
    if (dry) return console.log('would run: backlog.js ' + a.join(' '));
    const r = spawnSync(process.execPath, [path.join(__dirname, 'backlog.js'), '--root', root, '--date', today, ...a], { encoding: 'utf8' });
    if (r.status !== 0) fail(`backlog.js ${a.join(' ')}\n${r.stdout}${r.stderr}`);
  };
  const edit = (name, f) => {
    const p = path.join(root, name), text = fs.readFileSync(p, 'utf8'), next = f(text);
    if (next == null) fail(`${name}: no place found for the note`);
    if (dry) console.log(`would write ${name}`); else fs.writeFileSync(p, next);
  };
  const [y, m, d] = today.split('-'), date = `${+d} ${['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October',
    'November', 'December'][+m - 1]} ${y}`;
  const mark = (table, key, value) => { if (!dry) run(`UPDATE ${table} SET applied = 1 WHERE ${key} = ?`, value); };
  let count = 0;
  for (const r of all("SELECT * FROM results WHERE applied = 0 AND status IN ('done', 'needs-review')")) {
    if (!fs.existsSync(path.join(root, 'backlog', r.task + '.md'))) { console.log(`${r.task}: no task file in this checkout (merge its branch first); left`); continue; }
    if (r.status === 'done') backlog('done', r.task); else backlog('set', r.task, 'status=needs-review');
    mark('results', 'task', r.task); count++;
  }
  for (const n of notes('WHERE applied = 0')) {
    const f = n.fields;
    if (n.kind === 'task') {
      const keys = ['name', 'priority', 'size', 'summary', 'arch', 'waits', 'ref', 'goal'].filter((k) => f[k]).map((k) => `${k}=${f[k]}`);
      // a file is never made ready with "(to write)" in it (tools/backlog.js new): a ready note's task is made, filled, then set ready
      backlog('new', `id=${f.id}`, `status=${f.status === 'ready' ? 'needs-review' : f.status || 'needs-review'}`, ...keys);
      if (n.body && !dry) {
        const p = path.join(root, 'backlog', f.id + '.md');
        fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace('- [ ] (to write)\n', n.body + '\n') + `\nNoted by ${n.task}, ${date}.\n`);
      }
      if (f.status === 'ready') backlog('set', f.id, 'status=ready');
    } else if (n.kind === 'question') {
      edit('QUESTIONS.md', (text) => {
        const head = `\n## Priority ${f.priority}\n`, at = text.indexOf(head);
        if (at < 0) return null;
        const end = text.indexOf('\n## ', at + head.length), stop = end < 0 ? text.length : end;
        const block = `### ${f.about || n.task}: ${one(f.title)} (raised ${date})\n${n.body}\n`;
        return text.slice(0, stop).replace(/\n*$/, '\n\n') + block + text.slice(stop);
      });
    } else if (n.kind === 'tuning') {
      edit('docs/tuning.md', (text) => {
        const at = text.indexOf('\n## Parameters waiting\n'), lines = text.split('\n');
        if (at < 0) return null;
        const first = text.slice(0, at + 1).split('\n').length, lastRow = lines.findIndex((l, i) => i > first && l.startsWith('|') && !(lines[i + 1] || '').startsWith('|'));
        if (lastRow < 0) return null;
        lines.splice(lastRow + 1, 0, `| ${cell(f.parameter)} | ${cell(f.means)} | ${cell(f.measured)} | ${cell(f.proposed)} | ${n.task} |`);
        return lines.join('\n');
      });
    } else if (COLLECT[n.kind]) {
      const c = COLLECT[n.kind], line = `- [ ] From ${n.task}: ${one(f.where)}: ${one(f.what)}`;
      const dirOf = path.join(root, 'backlog'), open = fs.readdirSync(dirOf).find((name) => {
        const t = fs.readFileSync(path.join(dirOf, name), 'utf8');
        return t.startsWith(`# ${name.replace('.md', '')}: ${c.name}\n`) && !/^Status: done/m.test(t);
      });
      if (open) {
        edit('backlog/' + open, (text) => {
          const lines = text.split('\n');
          let at = lines.findLastIndex((l) => /^- \[[ x]\]/.test(l));
          if (at < 0) return null;
          while (/^ {2}\S/.test(lines[at + 1] || '')) at++;
          lines.splice(at + 1, 0, line);
          return lines.join('\n');
        });
      } else if (dry) console.log(`would open the collecting task "${c.name}"`);
      else {
        const id = atomic(() => { const next = +get("SELECT value FROM meta WHERE key = 'next'").value; run("UPDATE meta SET value = ? WHERE key = 'next'", String(next + 1)); return pad(next); });
        backlog('new', `id=${id}`, 'status=needs-review', `name=${c.name}`, 'priority=3', 'size=M', `summary=${c.summary}`, `arch=${c.arch}`, 'ref=AGENTS.md, Surfacing', `goal=${c.goal}`);
        const p = path.join(dirOf, id + '.md');
        fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace('- [ ] (to write)\n', line + '\n'));
        backlog('set', id, 'status=ready');
      }
    } else continue; // candidates and decisions go to the PR (report), not to a file
    mark('notes', 'n', n.n); count++;
  }
  console.log(`${dry ? 'would apply' : 'applied'} ${count}; the PR's section:  node tools/inbox.js report`);
} else if (cmd === 'report') {
  const by = (kind) => notes('WHERE kind = ?', kind), out = ['## For Kim'];
  const section = (title, rows) => { if (rows.length) out.push('', `**${title}**`, ...rows); };
  section('Principle candidates', by('candidate').map((n) => `- ${one(n.fields.rule)} (${n.task})${n.body ? '\n' + n.body.split('\n').map((l) => '  ' + l).join('\n') : ''}`));
  section('Teleports found', by('teleport').map((n) => `- ${headline(n)}, found by ${n.task}`));
  section('Acts with no pawn found', by('act').map((n) => `- ${headline(n)}, found by ${n.task}`));
  section('Tasks merged with a criterion unmet', all("SELECT * FROM results WHERE status = 'needs-review'").map((r) => `- ${r.task}${r.commit_ ? ' ' + r.commit_ : ''}: ${r.summary || 'see its task file'}`));
  section('Close calls', by('decision').map((n) => `- ${n.task}: ${headline(n)}`));
  section('Questions (in `QUESTIONS.md`)', by('question').map((n) => `- ${n.task}: ${headline(n)} (priority ${n.fields.priority})`));
  section('New tasks', by('task').map((n) => `- ${n.fields.id} ${one(n.fields.name)} (${n.fields.size}, ${n.fields.status || 'needs-review'}; from ${n.task}): ${one(n.fields.summary)}`));
  section('Tuning rows (in `docs/tuning.md`)', by('tuning').map((n) => `- ${headline(n)} (${n.task})`));
  if (out.length === 1) out.push('', 'Nothing to decide: no candidates, teleports, close calls or questions tonight.');
  console.log(out.join('\n'));
} else fail(`unknown command "${cmd}" (--help)`);
