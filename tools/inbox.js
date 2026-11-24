// Inbox: what an orchestrator and its sub-agents share during one run, in a local SQLite file that is never committed
// (<git common dir>/vb-inbox.db, so every worktree of the checkout sees the same file). Sub-agents work side by side, each in its own
// worktree, and never edit BACKLOG.md, QUESTIONS.md or docs/tuning.md: they leave notes here, and the orchestrator writes those files
// once, after merging (apply). Nothing durable lives here: apply and report carry it into the repository and the PR.
// usage: node tools/inbox.js <command> [--db FILE] [--root DIR]
//   init [--fresh]             make the file; the next free task ID is above backlog/ and the branches fetched from origin and pushed in the
//                              last 14 days (tools/lib/ids.js; fetch first for the latest); --fresh empties an earlier run's file
//   start TASK [N]             a sub-agent starts on TASK: reserves N (default 2) new task IDs for it and prints them
//   claim TASK FILE...         TASK will edit these files; prints who else holds one (exit 1) and claims them all the same
//   note TASK KIND key=value... [--body FILE|-]
//                              leave a note (kinds below); the body is Markdown, from a file or standard input
//   result TASK status=done|needs-review|failed|continue [reason=ceiling|boundary|stuck] [commit=SHA] [size=S|M|L] [model=NAME] [summary=TEXT]
//                              TASK's outcome; frees its claims
//                              continue: a fresh context goes on from commit=: at the ceiling on calls (reason=ceiling, the default; at most
//                              twice a task), or by choice past the context threshold (boundary, stuck; once a task, from the run's 30th call,
//                              with commit= made in this run; tools/lib/ceiling.js, VB-1616)
//   renumber OLD=NEW...        tools/renumber.js moved this branch's new tasks: reserved IDs, notes, claims and results follow
//   handover TASK              the latest handover note of TASK, for the context that continues it (docs/agents/handover.md)
//   calls [AGENT] [--ceiling N]  a sub-agent's model calls so far against the ceiling of 120, from its own transcript (found by its worktree, agent-<id>),
//                              with its context and weighted cost; outside a sub-agent's worktree, the session's own, without the ceiling;
//                              --ceiling N: another ceiling (a reviewer's, 40; VB-1619)
//   ids TASK                   the IDs reserved for TASK's new tasks and not yet used
//   list [KIND] [--task TASK] [--json]
//                              the notes, a line each
//   status                     the tasks started, their claims and results, and the notes not yet applied
//   apply [--dry] [--task TASK]
//                              the orchestrator, after merging: marks the results in the backlog (done, needs-review), creates the noted
//                              tasks (tools/backlog.js new id=...), appends the questions to QUESTIONS.md and the tuning rows to
//                              docs/tuning.md; each note and result is applied once; --task only TASK's (a PR a task, /night)
//   report [--task TASK]       the PR's "For Kim" section, in Markdown: principle candidates, teleports found, close calls, questions, new tasks;
//                              --task only TASK's
//   results [--json]           the results, for  node tools/agent-usage.js --results FILE
// kinds, with their keys:
//   task       id= (one reserved by start) name= priority= size= summary= [status=ready|blocked|needs-review arch= waits= cause= touches= ref= goal=]; body: its criteria
//              (how to write each, touches= the functions it will edit: docs/agents/tasks.md)
//              (cause=VB-NNN: the task whose change introduced the defect it mends, VB-1619)
//              (ready: goal=, ref=, touches= and the body given, and no question for Kim; priority=1 if it mends a red check)
//   question   priority= title= [about=VB-NNN, the task it is filed under: default TASK]; body: the numbered questions, each with its proposed answer (**P:**), as in QUESTIONS.md
//   tuning     parameter= means= measured= proposed=   a row of docs/tuning.md, Parameters waiting
//   candidate  rule=   a principle candidate (AGENTS.md, Surfacing); body: the decisions behind it
//   teleport   where= what=   a teleport found (AGENTS.md, the hard rule): apply adds it to the open collecting task, a line
//   act        where= what=   an act with no pawn, or a choice only the player has (AGENTS.md, 16): collected likewise
//   decision   what= why=   a close call, decided by Deciding without Kim, that Kim should see
//   review     arm=review|control|ineligible round=arm|review|confirm [verdict= blocking= advisory= preference= reviewed=SHA mended=
//              rebutted= unresolved= followups=]   VB-1619, written by tools/review.js (eligible, check, confirm --inbox): a task's arm,
//              its review's verdict, and what the one revision left; the body the findings file. Never applied: report and results read it
//   handover   (no keys)    body: the handover of a task to a fresh context, at most 60 lines and 4 KB (docs/agents/handover.md); not applied
require('./help.js')(__filename);
const fs = require('fs'), path = require('path'), transcript = require('./lib/transcript.js'), { execFileSync, spawnSync } = require('child_process');
const emitWarning = process.emitWarning;
process.emitWarning = (w, ...a) => (/SQLite/.test(String(w)) ? undefined : emitWarning.call(process, w, ...a)); // node:sqlite is marked experimental
const { DatabaseSync } = require('node:sqlite');

const args = process.argv.slice(2);
const option = (k) => { const i = args.indexOf(k); if (i < 0) return null; const v = args[i + 1]; args.splice(i, 2); return v; };
const flag = (k) => { const i = args.indexOf(k); if (i < 0) return false; args.splice(i, 1); return true; };
const fail = (msg) => { console.error('inbox: ' + msg); process.exit(1); };
const root = path.resolve(option('--root') || path.join(__dirname, '..'));
const ceilingArg = option('--ceiling'), asJson = flag('--json'), dry = flag('--dry'), fresh = flag('--fresh'), bodyFrom = option('--body'), onlyTask = option('--task');
const today = option('--date') || new Date().toISOString().slice(0, 10);

const KINDS = { task: ['id', 'name', 'priority', 'size', 'summary'], question: ['priority', 'title'], tuning: ['parameter', 'means', 'measured', 'proposed'],
  candidate: ['rule'], teleport: ['where', 'what'], act: ['where', 'what'], decision: ['what', 'why'], handover: [], review: ['arm', 'round'] };
// Findings are collected, not given a task each (Kim, 18 November): one open task a kind holds them, a criterion a finding, and a
// slice's wrap-up sweeps it. apply finds that task by its name, or makes the next one.
const COLLECT = {
  teleport: { name: "Teleports found, collected: swept at a slice's wrap-up", arch: 'physical',
    goal: 'Each teleport listed is mended or shown to be none: goods arrive by being carried',
    summary: 'The teleports tasks found in the code, a line each; swept together when a slice wraps up' },
  act: { name: "Acts with no pawn, collected: swept at a slice's wrap-up", arch: 'acts', goal: 'Each act listed is a pawn\'s, through a verb any pawn may use',
    summary: 'The acts with no pawn, and the choices only the player has, that tasks found; a line each, swept when a slice wraps up' },
};
const OPTIONAL = { task: ['status', 'arch', 'waits', 'cause', 'touches', 'ref', 'goal'], question: ['about'], teleport: ['task'],
  review: ['verdict', 'blocking', 'advisory', 'preference', 'reviewed', 'mended', 'rebutted', 'unresolved', 'followups'] };
const NEEDS_BODY = ['question', 'handover'];
const HANDOVER_LINES = 60, HANDOVER_BYTES = 4096; // docs/agents/handover.md
// The ceiling on a run's calls and the voluntary reset (tools/lib/ceiling.js).
const { CEILING, WARN, CONTINUATIONS, RESET_AT, VOLUNTARY_FROM, VOLUNTARY, STUCK } = require('./lib/ceiling.js');
// A task's review, by its notes (VB-1619): the arm, the reviewer's verdict, and the confirmation after the one revision.
const reviewOf = (task) => {
  const rs = notes('WHERE kind = ? AND task = ?', 'review', task).map((n) => n.fields), last = (round) => rs.filter((f) => f.round === round).pop();
  const arm = last('arm'), rev = last('review'), conf = last('confirm');
  return rs.length ? { arm: (rev || arm || conf).arm, verdict: rev ? rev.verdict : null, blocking: rev ? +rev.blocking || 0 : null,
    confirmed: !!conf, mended: conf ? +conf.mended || 0 : null, rebutted: conf ? +conf.rebutted || 0 : null, unresolved: conf ? +conf.unresolved || 0 : null,
    followups: conf && conf.followups ? conf.followups : null } : null;
};
const reviewLine = (r) => !r ? '' : r.arm !== 'review' ? `review: ${r.arm}` : !r.verdict ? 'review: in review'
  : `review: ${r.verdict}${r.blocking ? ` ${r.blocking} blocking` : ''}${r.confirmed ? `, confirmed${r.unresolved ? `, ${r.unresolved} unresolved (${r.followups})` : ''}` : r.verdict === 'revise' ? ', in revision' : ''}`;

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
if (!cmd) fail('a command: init, start, claim, note, result, renumber, list, status, apply, report, results (--help)');
if (cmd !== 'init' && cmd !== 'calls' && !fs.existsSync(file)) fail(`no inbox at ${file}: the orchestrator runs  node tools/inbox.js init  first`);
if (cmd === 'init' && fresh && fs.existsSync(file)) fs.rmSync(file);
const db = cmd === 'calls' ? null : new DatabaseSync(file); // calls reads a transcript only: a session of its own has no inbox
if (db) db.exec('PRAGMA busy_timeout = 5000');
const all = (sql, ...p) => db.prepare(sql).all(...p), get = (sql, ...p) => db.prepare(sql).get(...p), run = (sql, ...p) => db.prepare(sql).run(...p);
// One writer at a time: a command's reads and writes are one transaction, so two sub-agents never take the same ID.
const atomic = (f) => { db.exec('BEGIN IMMEDIATE'); try { const v = f(); db.exec('COMMIT'); return v; } catch (e) { db.exec('ROLLBACK'); throw e; } };

// This run's transcript: a sub-agent's by its worktree (agent-<id>), else the session's, the newest under the projects directory.
const ownAgent = () => (path.basename(root).match(/^agent-(\w+)$/) || [])[1];
const own = () => (ownAgent() ? transcript.subagent(ownAgent()) : transcript.newest());
const commitTime = (sha) => {
  const r = spawnSync('git', ['log', '-1', '--format=%cI', sha], { cwd: root, encoding: 'utf8' });
  return r.status === 0 && r.stdout.trim() ? Date.parse(r.stdout.trim()) : null;
};
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
    teleport: `${f.where}: ${f.what}${f.task ? ` (${f.task})` : ''}`, act: `${f.where}: ${f.what}`, decision: `${f.what}: ${f.why}`,
    handover: `${(n.body || '').split('\n').length} lines, ${Buffer.byteLength(n.body || '')} bytes`,
    review: `${f.round} ${f.arm}${f.verdict ? ' ' + f.verdict : ''}${f.blocking ? ` ${f.blocking} blocking` : ''}` }[n.kind]);
};

if (cmd === 'init') {
  db.exec(`CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
    CREATE TABLE IF NOT EXISTS ids (id TEXT PRIMARY KEY, task TEXT, used INTEGER DEFAULT 0);
    CREATE TABLE IF NOT EXISTS claims (file TEXT, task TEXT, PRIMARY KEY (file, task));
    CREATE TABLE IF NOT EXISTS notes (n INTEGER PRIMARY KEY AUTOINCREMENT, task TEXT, kind TEXT, fields TEXT, body TEXT, applied INTEGER DEFAULT 0);
    CREATE TABLE IF NOT EXISTS results (task TEXT PRIMARY KEY, status TEXT, commit_ TEXT, size TEXT, model TEXT, summary TEXT, started TEXT,
      ended TEXT, applied INTEGER DEFAULT 0);`);
  const seen = require('./lib/ids.js').highestId(root), last = seen.max; // above the branches in flight too (VB-1674)
  atomic(() => {
    const have = get("SELECT value FROM meta WHERE key = 'next'");
    if (!have) run("INSERT INTO meta VALUES ('next', ?)", String(last + 1));
    else if (+have.value <= last) run("UPDATE meta SET value = ? WHERE key = 'next'", String(last + 1));
  });
  console.log(`inbox at ${file}; the next free task ID is ${pad(+get("SELECT value FROM meta WHERE key = 'next'").value)}`
    + (seen.where !== 'this checkout' ? ` (above ${seen.where}, which holds task files up to ${pad(seen.max)})` : ''));
} else if (cmd === 'start') {
  const task = taskId(rest[0]), n = Math.max(0, Math.min(20, rest[1] == null ? 2 : +rest[1] || 0));
  const seen = require('./lib/ids.js').highestId(root); // a branch pushed since init (VB-1674)
  const ids = atomic(() => {
    run('INSERT OR IGNORE INTO results (task, started) VALUES (?, ?)', task, new Date().toISOString());
    const next = Math.max(+get("SELECT value FROM meta WHERE key = 'next'").value, seen.max + 1), got = [];
    for (let i = 0; i < n; i++) { got.push(pad(next + i)); run('INSERT INTO ids (id, task) VALUES (?, ?)', pad(next + i), task); }
    run("UPDATE meta SET value = ? WHERE key = 'next'", String(next + n));
    return got;
  });
  console.log(`${task} started; reserved for its new tasks: ${ids.join(' ') || 'none'}`);
} else if (cmd === 'renumber') {
  // tools/renumber.js moved this branch's new tasks to other IDs: the inbox follows, so the run goes on (VB-1674)
  const map = new Map(rest.map((p) => p.split('=')).filter((x) => x.length === 2 && /^VB-\d+$/.test(x[0]) && /^VB-\d+$/.test(x[1])));
  if (!map.size || map.size !== rest.length) fail('renumber OLD=NEW... (VB-NNN=VB-NNN)');
  const swap = (s) => (s == null ? s : String(s).replace(/VB-(\d{3,})(?!\d)/g, (m) => map.get(m) || m));
  const TEXT = { ids: ['id', 'task'], claims: ['task'], notes: ['task', 'fields', 'body'], results: ['task', 'summary'] };
  const changed = atomic(() => {
    let n = 0;
    for (const [table, cols] of Object.entries(TEXT)) {
      for (const row of all(`SELECT rowid AS r, ${cols.join(', ')} FROM ${table}`)) {
        const next = cols.map((c) => swap(row[c]));
        if (next.some((v, i) => v !== row[cols[i]])) { run(`UPDATE ${table} SET ${cols.map((c) => c + ' = ?').join(', ')} WHERE rowid = ?`, ...next, row.r); n++; }
      }
    }
    const top = Math.max(...[...map.values()].map((v) => +v.slice(3)));
    if (+get("SELECT value FROM meta WHERE key = 'next'").value <= top) run("UPDATE meta SET value = ? WHERE key = 'next'", String(top + 1));
    return n;
  });
  console.log(`inbox: ${changed} rows renumbered (${[...map].map(([a, b]) => a + '=' + b).join(' ')})`);
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
  if (kind === 'handover' && (body.split('\n').length > HANDOVER_LINES || Buffer.byteLength(body) > HANDOVER_BYTES)) {
    fail(`a handover is at most ${HANDOVER_LINES} lines and ${HANDOVER_BYTES} bytes (this one: ${body.split('\n').length} lines, ${Buffer.byteLength(
      body)} bytes): `
      + 'keep what the next context cannot find quickly (docs/agents/handover.md)');
  }
  if (kind === 'task') {
    if (!/^(S|M|L)$/.test(f.size)) fail('size is S, M or L');
    if (f.status && !['blocked', 'needs-review', 'ready'].includes(f.status)) fail('a noted task is ready, blocked or needs-review (the default)');
    if (f.status === 'ready' &&
      !(f.goal && f.ref && f.touches && body)) fail(
      'a noted task is ready only with its goal (goal=), its design ref (ref=), its footprint (touches=, docs/agents/tasks.md) and its criteria (--body), and no question for Kim; else needs-review (the default)');
    if (f.touches) try { require('./lib/touches.js').parseTouches(f.touches); } catch (e) { fail(`touches=: ${e.message} (docs/agents/tasks.md)`); }
  }
  if (kind === 'review') {
    if (!['review', 'control', 'ineligible'].includes(f.arm)) fail('arm is review, control or ineligible');
    if (!['arm', 'review', 'confirm'].includes(f.round)) fail('round is arm, review or confirm');
    if (f.verdict && !['pass', 'revise'].includes(f.verdict)) fail('verdict is pass or revise');
  }
  const n = atomic(() => {
    if (kind === 'task') {
      const own = get('SELECT * FROM ids WHERE id = ?', f.id);
      if (!own || own.task !== task) fail(`${f.id} is not reserved for ${task}: its IDs are ${all('SELECT id FROM ids WHERE task = ? AND used = 0',
        task).map((r) => r.id).join(' ') || 'used up (start TASK N reserves more)'}`);
      if (own.used) fail(`${f.id} already has a note`);
      run('UPDATE ids SET used = 1 WHERE id = ?', f.id);
    }
    return run('INSERT INTO notes (task, kind, fields, body) VALUES (?, ?, ?, ?)', task, kind, JSON.stringify(f), body).lastInsertRowid;
  });
  console.log(`note ${n} (${kind}) from ${task}`);
} else if (cmd === 'result') {
  const task = taskId(rest[0]), f = pairs(rest.slice(1));
  if (!['done', 'needs-review', 'failed', 'continue'].includes(f.status)) fail('status=done, needs-review, failed or continue');
  let nth = 0, reason = null;
  if (f.reason && f.status !== 'continue') fail('reason= goes with status=continue');
  if (f.status === 'continue') {
    if (!f.commit) fail('continue needs commit=SHA: commit what you have first');
    reason = f.reason || 'ceiling';
    if (!['ceiling', 'boundary', 'stuck'].includes(reason)) fail('reason=ceiling, boundary or stuck');
    const meta = (key) => +(get('SELECT value FROM meta WHERE key = ?', key + task) || { value: 0 }).value;
    if (reason === 'ceiling') {
      nth = meta('continued:') + 1;
      if (nth > CONTINUATIONS) fail(`${task} has been continued ${CONTINUATIONS} times: end with status=needs-review, the unmet criteria in summary=`);
      run('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', 'continued:' + task, String(nth));
    } else { // a voluntary reset (VB-1616): past the threshold, late enough in the run, with something new committed, once a task
      const was = meta('voluntary:');
      if (was >= VOLUNTARY) {
        fail(reason === 'stuck' ||
          meta('stuck:') ? `${task} has had its voluntary reset and is stuck again: end with status=needs-review, what was tried and ruled out in summary=`
          : `${task} has had its voluntary reset (${VOLUNTARY} a task): go on, and hand over at the ceiling if it comes`);
      }
      const t = own();
      if (!t) fail('a voluntary reset reads this run\'s transcript, and there is none: go on, or hand over at the ceiling (reason=ceiling)');
      const { calls, context, start } = transcript.tally(t);
      if (context < RESET_AT) fail(
        `the context is ${Math.round(context / 1e3)}k, under the threshold of ${RESET_AT / 1e3}k: a reset would cost more than it saves; go on`);
      if (calls < VOLUNTARY_FROM) fail(`${calls} calls into this run, under ${VOLUNTARY_FROM}: go on`);
      const at = commitTime(f.commit);
      if (at == null) fail(`no commit ${f.commit} in ${root}`);
      if (start && at < Date.parse(start)) fail(`${f.commit} was made before this run started: commit what this run built first`);
      run('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', 'voluntary:' + task, String(was + 1));
      if (reason === 'stuck') run('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', 'stuck:' + task, '1');
    }
  }
  if (f.size && !/^(S|M|L)$/.test(f.size)) fail('size is S, M or L');
  atomic(() => {
    run('INSERT OR IGNORE INTO results (task, started) VALUES (?, ?)', task, new Date().toISOString());
    run('UPDATE results SET status = ?, commit_ = COALESCE(?, commit_), size = COALESCE(?, size), model = COALESCE(?, model), summary = COALESCE(?, summary), ended = ?, applied = 0 WHERE task = ?',
      f.status, f.commit || null, f.size || null, f.model || null, f.summary ? one(f.summary) : null, new Date().toISOString(), task);
    run('DELETE FROM claims WHERE task = ?', task);
  });
  console.log(`${task}: ${f.status}${reason ? ` (${reason}${nth ? `, ${nth} of ${CONTINUATIONS}` : ''})` : ''}`
    + (reason ? `; the handover: ${get("SELECT n FROM notes WHERE task = ? AND kind = 'handover'", task) ? `node tools/inbox.js handover ${task}`
      : `none yet: node tools/inbox.js note ${task} handover --body - (docs/agents/handover.md)`}` : ''));
} else if (cmd === 'handover') {
  const task = taskId(rest[0]), h = get("SELECT body FROM notes WHERE task = ? AND kind = 'handover' ORDER BY n DESC LIMIT 1", task);
  if (!h) fail(`no handover for ${task}`);
  console.log(h.body);
} else if (cmd === 'calls') {
  // A sub-agent's own transcript, by its worktree (agent-<id>) or the id given; outside one, a session's: the newest under the projects
  // directory, as tools/agent-usage.js finds it (VB-1615). Beside the count, the context of the last call and the weighted cost so far.
  // The ceiling is a sub-agent's (.claude/agents/vb-task.md, step 8); past the context threshold, a session as well is told to hand over.
  const agent = rest[0] || ownAgent(), found = agent ? transcript.subagent(agent) : transcript.newest();
  if (!found) fail(agent ? `calls: no transcript agent-${agent}.jsonl under ${transcript.projects()}` : `calls: no transcript under ${transcript.projects()}`);
  const { calls: n, context, weighted } = transcript.tally(found), ceiling = +(ceilingArg || CEILING), left = ceiling - n;
  const k = (x) => (x >= 1e6 ? (x / 1e6).toFixed(1) + 'M' : x >= 1e3 ? Math.round(x / 1e3) + 'k' : String(x)),
    size = `; context ${k(context)}; weighted ${k(weighted)}`;
  // Past the threshold (VB-1616): a hint to hand over at the next boundary, and whether the run looks stuck, from its transcript's measures
  let hint = '';
  if (context >= RESET_AT && n >= VOLUNTARY_FROM) {
    hint = agent ? `. Past ${k(RESET_AT)}: hand over at the next boundary, reason=boundary (docs/agents/handover.md)`
      : `. Past ${k(RESET_AT)}: at the next boundary, hand the rest to a fresh vb-task sub-agent, reason=boundary (docs/agents/handover.md)`;
    const u = spawnSync(process.execPath, [path.join(__dirname, 'agent-usage.js'), found, '--json'], { encoding: 'utf8', maxBuffer: 1 << 26 });
    let m = null;
    try { m = JSON.parse(u.stdout); } catch (e) { /* no measures: no stuck hint */ }
    const why = !m ? null : m.tests.current >= STUCK ? `the same test failed ${m.tests.current} times running`
      : m.repeats.recent >= STUCK ? `${m.repeats.recent} reads or commands again in the last 20 calls` : null;
    if (why) hint += `. Stuck? ${why}: if your next idea is no better than the last, hand over now, reason=stuck, the rejected hypotheses listed`;
  }
  if (ceilingArg) console.log(`${n} of ${ceiling} calls${size}` + (left > Math.min(WARN, Math.round(ceiling / 8)) ? '' : (left > 0 ? `: ${left} left` : ': the ceiling is reached') + '. Write what you have now.'));
  else if (!agent) console.log(`${n} calls (a session: the ceiling of ${CEILING} is a sub-agent's)${size}${hint}`);
  else console.log(`${n} of ${CEILING} calls${size}` +
    (left > WARN ? hint : left > 0 ? `: ${left} left. Finish within them, or hand over now (.claude/agents/vb-task.md, The ceiling)`
    : ': the ceiling is reached. Hand over now: commit, then  node tools/inbox.js result ID status=continue commit=SHA summary=...'));
} else if (cmd === 'ids') {
  const task = taskId(rest[0]);
  console.log(all('SELECT id FROM ids WHERE task = ? AND used = 0 ORDER BY id', task).map((r) => r.id).join(' ') || 'none');
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
    const rv = reviewLine(reviewOf(r.task));
    console.log(`${r.task} ${r.status || 'running'}${r.commit_ ? ' ' + r.commit_ : ''}${claims.length ? '; editing ' + claims.join(', ') : ''}${rv ? '; ' + rv : ''}`);
  }
  const open = notes('WHERE applied = 0'), byKind = Object.keys(KINDS).map((k) => [k, open.filter((n) => n.kind === k).length]).filter(([, c]) => c);
  console.log(`${rs.length} tasks started, ${rs.filter((r) => !r.status).length} running; notes not applied: ${byKind.map(([k, c]) => `${c} ${k}`).join(', ') ||
    'none'}`);
} else if (cmd === 'results') {
  const rs = all('SELECT * FROM results ORDER BY started').map((r) => ({ task: r.task, status: r.status || 'running', commit: r.commit_, size: r.size,
    model: r.model, summary: r.summary, started: r.started, ended: r.ended, review: reviewOf(r.task) }));
  if (asJson) console.log(JSON.stringify(rs, null, 1));
  else console.log(rs.map((r) => `${r.task} ${r.size || '-'} ${r.status}${r.commit ? ' ' + r.commit : ''}${r.summary ? ': ' + r.summary : ''}`).join('\n') ||
    'no results');
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
  const mine = (x) => !onlyTask || x.task === onlyTask;
  for (const r of all("SELECT * FROM results WHERE applied = 0 AND status IN ('done', 'needs-review')").filter(mine)) {
    if (!fs.existsSync(path.join(root, 'backlog', r.task + '.md'))) {
      console.log(`${r.task}: no task file in this checkout (merge its branch first); left`); continue; }
    if (r.status === 'done') backlog('done', r.task); else backlog('set', r.task, 'status=needs-review');
    mark('results', 'task', r.task); count++;
  }
  for (const n of notes('WHERE applied = 0').filter(mine)) {
    const f = n.fields;
    if (n.kind === 'task') {
      // a ready note gives its footprint (checked when noted); one that is not ready keeps the line to fill (VB-1671)
      const keys = ['name', 'priority', 'size', 'summary', 'arch', 'waits', 'cause', 'touches', 'ref', 'goal'].filter((k) => f[k]).map((k) => `${k}=${f[k]}`);
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
        const first = text.slice(0, at + 1).split('\n').length,
          lastRow = lines.findIndex((l, i) => i > first && l.startsWith('|') && !(lines[i + 1] || '').startsWith('|'));
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
        const id = atomic(() => {
          const next = +get("SELECT value FROM meta WHERE key = 'next'").value; run("UPDATE meta SET value = ? WHERE key = 'next'", String(next + 1));
          return pad(next); });
        backlog('new', `id=${id}`, 'status=needs-review', `name=${c.name}`, 'priority=3', 'size=M', `summary=${c.summary}`, `arch=${c.arch}`,
          'touches=unknown (a collecting task: each line names its own place)',
          'ref=AGENTS.md, Surfacing', `goal=${c.goal}`);
        const p = path.join(dirOf, id + '.md');
        fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace('- [ ] (to write)\n', line + '\n'));
        backlog('set', id, 'status=ready');
      }
    } else continue; // candidates and decisions go to the PR (report), not to a file
    mark('notes', 'n', n.n); count++;
  }
  console.log(`${dry ? 'would apply' : 'applied'} ${count}; the PR's section:  node tools/inbox.js report`);
} else if (cmd === 'report') {
  const mine = (x) => !onlyTask || x.task === onlyTask, by = (kind) => notes('WHERE kind = ?', kind).filter(mine), out = ['## For Kim'];
  const section = (title, rows) => { if (rows.length) out.push('', `**${title}**`, ...rows); };
  section('Principle candidates',
    by('candidate').map((n) => `- ${one(n.fields.rule)} (${n.task})${n.body ? '\n' + n.body.split('\n').map((l) => '  ' + l).join('\n') : ''}`));
  section('Teleports found', by('teleport').map((n) => `- ${headline(n)}, found by ${n.task}`));
  section('Acts with no pawn found', by('act').map((n) => `- ${headline(n)}, found by ${n.task}`));
  section('Tasks merged with a criterion unmet',
    all("SELECT * FROM results WHERE status = 'needs-review'").filter(mine).map((r) =>
    `- ${r.task}${r.commit_ ? ' ' + r.commit_ : ''}: ${r.summary || 'see its task file'}`));
  section('Reviews (VB-1619)', all('SELECT task FROM results ORDER BY started').filter(mine).map((r) => [r.task, reviewOf(r.task)])
    .filter(([, v]) => v && v.arm === 'review').map(([t, v]) => `- ${t}: ${reviewLine(v).replace(/^review: /, '')}`));
  section('Close calls', by('decision').map((n) => `- ${n.task}: ${headline(n)}`));
  section('Questions (in `QUESTIONS.md`)', by('question').map((n) => `- ${n.task}: ${headline(n)} (priority ${n.fields.priority})`));
  section('New tasks',
    by('task').map((n) =>
    `- ${n.fields.id} ${one(n.fields.name)} (${n.fields.size}, ${n.fields.status || 'needs-review'}; from ${n.task}): ${one(n.fields.summary)}`));
  section('Tuning rows (in `docs/tuning.md`)', by('tuning').map((n) => `- ${headline(n)} (${n.task})`));
  if (out.length === 1) out.push('', `Nothing to decide: no candidates, teleports, close calls or questions ${onlyTask ? 'from ' + onlyTask : 'tonight'}.`);
  console.log(out.join('\n'));
} else fail(`unknown command "${cmd}" (--help)`);
