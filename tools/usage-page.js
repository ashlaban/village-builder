// Token use: writes docs/usage.html, the page of what each backlog task cost in tokens, from the runs measured in docs/agents/usage.
// The Pages workflow runs it before its Jekyll step; the page is derived and never committed (as index.html and the roadmap are not).
// Usage: node tools/usage-page.js [--dir DIR] [--out FILE] [--json]
//   --dir DIR   the measured runs, one JSON file each as tools/agent-usage.js --out writes them (default docs/agents/usage)
//   --out FILE  the page to write (default docs/usage.html)
//   --json      print the data the page is drawn from, and write nothing
// Reads: the run files; the task files in backlog/ (name, size, arch); and `git log` (the commits made during a session).
// Cost is the one weighted number of tools/agent-usage.js, in fresh-input tokens: input + 1.25 × cache writes + 0.1 × cache reads + 5 × output.
// Which task a measurement belongs to:
//   a sub-agent   the task its prompt named (its `task`);
//   a session     with sub-agents, an orchestrator: its own cost belongs to no one task, and is listed apart;
//                 with a `task` of its own in its file, that task;
//                 otherwise the task its commits name: the VB-NNN that heads at least two thirds of the commits made between its start
//                 and five minutes after its end; a session with no such task is listed apart, as outside a task.
// A task measured more than once (a retry, a second session) is the sum of its runs.
// A task's independent review (VB-1619) is part of its cost and shown apart too: the reviewer's (rw), the revision after it (vw), and the
// task's arm (review, control, ineligible). A session whose only sub-agents are reviewers worked on one task, not as an orchestrator.
require('./help.js')(__filename);
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');

const SHARE = 2 / 3, AFTER = 5 * 60000;
const weighted = (t) => Math.round(t.input + 1.25 * t.cacheWrite + 0.1 * t.cacheRead + 5 * t.output);
const family = (m) => (/sonnet/.test(m) ? 'Sonnet' : /opus/.test(m) ? 'Opus' : /fable/.test(m) ? 'Fable' : /haiku/.test(m) ? 'Haiku' : m);
const families = (ms) => [...new Set(ms.filter((m) => m && m !== '<synthetic>').map(family))].join('+') || '-';

// The task a session's commits name, or null: commits is [{ t: ms, subject }].
function taskOfCommits(run, commits) {
  const a = Date.parse(run.start), b = Date.parse(run.end) + AFTER, n = {};
  let all = 0;
  for (const c of commits) {
    const m = c.t >= a && c.t <= b && c.subject.match(/^VB-\d+/);
    if (m) { n[m[0]] = (n[m[0]] || 0) + 1; all++; }
  }
  const top = Object.entries(n).sort((x, y) => y[1] - x[1])[0];
  return top && top[1] >= SHARE * all ? top[0] : null;
}

// runs: the parsed run files; commits: [{ t, subject }]; taskInfo(id): { name, size, arch } or null.
function model({ runs, commits, taskInfo }) {
  const byTask = new Map(), sessions = [];
  const add = (id, r) => {
    const t = byTask.get(id) || { id, runs: 0, calls: 0, min: 0, peak: 0, i: 0, cw: 0, cr: 0, o: 0, rw: 0, vw: 0, arm: null, models: [], src: r.src || 'sub-agent', date: r.date };
    t.rw += r.rw || 0; t.vw += r.vw || 0; if (r.arm) t.arm = r.arm;
    t.runs++; t.calls += r.calls; t.min += r.min || 0; t.peak = Math.max(t.peak, r.peak || 0);
    t.i += r.tokens.input; t.cw += r.tokens.cacheWrite; t.cr += r.tokens.cacheRead; t.o += r.tokens.output;
    t.models.push(...r.models); if (r.date > t.date) t.date = r.date;
    byTask.set(id, t);
  };
  const apart = (kind, r, tasks) => sessions.push({ id: r.id, kind, label: r.label, date: r.date, model: families(r.models), tasks, calls: r.calls, min: +(r.min || 0).toFixed(1),
    peak: r.peak || 0, i: r.tokens.input, cw: r.tokens.cacheWrite, cr: r.tokens.cacheRead, o: r.tokens.output, w: weighted(r.tokens) });
  for (const run of runs) {
    const subs = run.subagents || [], date = (run.start || '').slice(0, 10);
    const self = { id: (run.session || '').slice(0, 8), label: run.label || '-', date, models: run.models || [], calls: run.calls, tokens: run.tokens,
      min: run.activeMin, peak: run.context && run.context.peak, src: 'session' };
    for (const s of subs) {
      const r = { id: s.agent, label: 'sub-agent', date: (s.start || run.start || '').slice(0, 10), models: [s.model], calls: s.calls, tokens: s.tokens, min: s.activeMin, peak: s.peak,
        src: s.role === 'review' ? undefined : 'sub-agent', rw: s.role === 'review' ? weighted(s.tokens) : 0, vw: s.revision ? s.revision.weighted : 0, arm: s.review ? s.review.arm : null };
      if (s.task) add(s.task, r); else apart('outside', r, 0);
    }
    const implementers = subs.filter((s) => s.role !== 'review'), task = implementers.length ? null : run.task || (run.review && run.review.task) || taskOfCommits(run, commits);
    if (run.review) Object.assign(self, { arm: run.review.arm, vw: run.review.revision ? run.review.revision.weighted : 0 });
    if (task) add(task, self); else apart(implementers.length ? 'orchestrator' : 'outside', self, implementers.filter((s) => s.task).length);
  }
  const tasks = [...byTask.values()].map((t) => {
    const info = taskInfo(t.id) || {}, { models, ...rest } = t;
    return { ...rest, min: +t.min.toFixed(1), name: info.name || '', size: info.size || '?', arch: info.arch || '', model: families(models),
      w: weighted({ input: t.i, cacheWrite: t.cw, cacheRead: t.cr, output: t.o }) };
  }).sort((a, b) => b.w - a.w);
  sessions.sort((a, b) => b.w - a.w);
  return { runs: runs.length, tasks, sessions };
}

function readRuns(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort().map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))).filter((r) => r.tokens && r.start && r.end);
}
function gitCommits(root, since) {
  try {
    return execFileSync('git', ['log', '--format=%aI%x09%s', ...(since ? ['--since=' + since] : [])], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] })
      .split('\n').filter(Boolean).map((l) => { const at = l.indexOf('\t'); return { t: Date.parse(l.slice(0, at)), subject: l.slice(at + 1) }; });
  } catch (e) { return []; }
}
const taskInfoOf = (root) => (id) => {
  let head;
  try { head = fs.readFileSync(path.join(root, 'backlog', id + '.md'), 'utf8').slice(0, 2000); } catch (e) { return null; }
  const g = (re) => (head.match(re) || [null, ''])[1].trim();
  return { name: g(/^# VB-\d+: (.*)/), size: g(/^Size: (\w+)/m), arch: g(/^Arch: (.*)/m) };
};

if (require.main === module) {
  const root = path.join(__dirname, '..'), args = process.argv.slice(2);
  const opt = (k, d) => { const i = args.indexOf(k); return i < 0 ? d : args[i + 1]; };
  const runs = readRuns(path.resolve(root, opt('--dir', 'docs/agents/usage')));
  const first = runs.map((r) => r.start).sort()[0];
  const data = model({ runs, commits: gitCommits(root, first && new Date(Date.parse(first) - 864e5).toISOString()), taskInfo: taskInfoOf(root) });
  if (args.includes('--json')) { console.log(JSON.stringify(data)); process.exit(0); }
  const page = fs.readFileSync(path.join(__dirname, 'lib', 'usage-page.html'), 'utf8').replace('/*DATA*/', () => JSON.stringify(data).replace(/</g, '\\u003c'));
  const out = path.resolve(root, opt('--out', 'docs/usage.html'));
  fs.writeFileSync(out, page);
  const k = (n) => (n / 1e6).toFixed(1) + 'M', sum = (xs) => xs.reduce((a, x) => a + x.w, 0);
  console.log(`usage: ${path.relative(root, out)}: ${data.tasks.length} tasks from ${data.runs} runs, weighted ${k(sum(data.tasks))}; apart, ${data.sessions.length} sessions, ${k(sum(data.sessions))}`);
}
module.exports = { model, taskOfCommits, weighted, readRuns };
