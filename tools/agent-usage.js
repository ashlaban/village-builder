// Agent usage: what a Claude Code session cost, from its transcript (~/.claude/projects/<dir>/<session>.jsonl): model calls, tokens
// (fresh input, cache writes, cache reads, output), context at the first call and at its peak, tool calls with their result sizes and
// times, and the largest results. A response is written as several transcript lines (one per content block) that repeat its usage, so
// calls are counted by message id. Only aggregates are printed: no prompt, result or file content. See docs/review-agent-workflow.md.
// Sub-agents have transcripts of their own (<session>/subagents/agent-*.jsonl): each is measured the same way and listed with the task
// its prompt names (VB-NNN), its model and its boot, the context at its first edit; the boot less the context at its first call (the
// harness, the tools and AGENTS.md, which no task can avoid) is what it read before it changed anything.
// Cost is one weighted number, in fresh-input tokens: input + 1.25 × cache writes + 0.1 × cache reads + 5 × output (about the prices'
// ratios). The summary gives the run's three measures: weighted cost a finished task by size, the overhead (the orchestrator's share
// of the cost, and the median boot), and with --results the share of tasks done at the first attempt.
const fs = require('fs'), os = require('os'), path = require('path');
const USAGE = `usage: node tools/agent-usage.js [FILE.jsonl] [--json] [--turns] [--since T] [--until T] [--label NAME] [--task VB-NNN] [--out DIR] [--results FILE]
       node tools/agent-usage.js --history DIR
  FILE        a transcript; default the newest under ~/.claude/projects (this session's, when run from a session)
  --turns     a line per user prompt; --since/--until T limit to entries from/before an ISO time
  --label     the run's role (worker, reviewer, project-manager); --out DIR also writes DIR/<date>-<label>-<session>.json
  --task      the one task this session worked on, when it ran no sub-agents: kept in the run's file as "task" (tools/usage-page.js reads it);
              leave it out for a session that worked on several tasks or on none
  --results   the tasks' outcomes, from  node tools/inbox.js results --json : joins size and status to the sub-agents by task
  --review    a session that ran an independent review (VB-1619): its findings file, work/review/VB-NNN.json; kept as "review" in the run's
              file, with the reviewer's cost and the revision's (the session's after the reviewer returned)
  --arm       control | ineligible: a session whose task was not reviewed (tools/review.js eligible), kept as "review" with its arm
              A sub-agent is a reviewer by its meta file (agentType vb-review) or its prompt ("Review VB-NNN"): its cost is apart from the
              task's implementation, and it is left out of the first-pass share and the cost a done task
  --history   medians and quartiles by label over the files in DIR`;

const args = process.argv.slice(2);
const option = (k) => { const i = args.indexOf(k); if (i < 0) return null; const v = args[i + 1]; args.splice(i, 2); return v; };
const flag = (k) => { const i = args.indexOf(k); if (i < 0) return false; args.splice(i, 1); return true; };
if (flag('--help') || flag('-h')) { console.log(USAGE); process.exit(0); }
const asJson = flag('--json'), turns = flag('--turns'), since = option('--since'), until = option('--until');
const reviewFile = option('--review'), arm = option('--arm');
const label = option('--label') || '-', out = option('--out'), historyDir = option('--history'), resultsFile = option('--results'), task = option('--task');
const fail = (msg) => { console.error('agent-usage: ' + msg); process.exit(1); };
const k = (n) => (n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'k' : String(n));
const kb = (n) => (n >= 1000 ? (n / 1000).toFixed(1) + ' KB' : n + ' B');

function newest() {
  const base = path.join(process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude'), 'projects');
  const files = fs.existsSync(base) ? fs.readdirSync(base).flatMap((d) => {
    const dir = path.join(base, d);
    return fs.statSync(dir).isDirectory() ? fs.readdirSync(dir).filter((f) => f.endsWith('.jsonl')).map((f) => path.join(dir, f)) : [];
  }) : [];
  if (!files.length) fail(`no transcript under ${base}; give a FILE`);
  return files.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
}

// The measures of one transcript.
const weighted = (t) => Math.round(t.input + 1.25 * t.cacheWrite + 0.1 * t.cacheRead + 5 * t.output);
const EDITS = ['Edit', 'Write', 'NotebookEdit'];
// A review's own calls: the reviewer started, review.js run, a revision asked (VB-1619); the orchestrator's share of reviewing.
const REVIEWING = (use) => (use.name === 'Agent' && use.input.subagent_type === 'vb-review') || (use.name === 'Bash' && /tools\/review\.js/.test(use.input.command || ''))
  || (use.name === 'SendMessage' && /Revise VB-\d/.test(JSON.stringify(use.input)));
function measure(file, sub = false, from = null) {
  const entries = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } })
    .filter((e) => e && e.timestamp && (!since || e.timestamp >= since) && (!until || e.timestamp < until) && (!from || e.timestamp >= from));
  const m = { session: (entries.find((e) => e.sessionId) || {}).sessionId || path.basename(file, '.jsonl'), label, models: [],
    start: entries.length ? entries[0].timestamp : null, end: entries.length ? entries[entries.length - 1].timestamp : null,
    wallMin: 0, activeMin: 0, prompts: 0, calls: 0, subagentCalls: 0, reviewCalls: 0,
    tokens: { input: 0, cacheWrite: 0, cacheRead: 0, output: 0 }, context: { first: 0, peak: 0, firstEdit: 0 }, tools: {}, largest: [], turns: [] };
  const seen = new Set(), uses = new Map(), models = new Set();
  let turn = null, last = null;
  const result = (c) => (typeof c === 'string' ? c.length : Array.isArray(c) ? c.reduce((s, x) => s + (x.type === 'text' ? x.text.length
    : JSON.stringify(x).length), 0) : JSON.stringify(c || '').length);
  for (const e of entries) {
    const t = Date.parse(e.timestamp);
    if (last != null) m.activeMin += Math.min(t - last, 5 * 60e3) / 60e3;
    last = t;
    const content = e.message && e.message.content;
    if (e.type === 'user' && !e.isMeta && (typeof content === 'string' || (Array.isArray(content) && content.some((c) => c.type === 'text')))
      && !(Array.isArray(content) && content.some((c) => c.type === 'tool_result'))) {
      m.prompts++;
      turn = { at: e.timestamp, calls: 0, cacheRead: 0, output: 0, peak: 0 };
      m.turns.push(turn);
    }
    if (e.type === 'assistant' && e.message && e.message.usage && !seen.has(e.message.id)) {
      seen.add(e.message.id);
      const u = e.message.usage, ctx = (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0);
      if (e.isSidechain && !sub) m.subagentCalls++; else m.calls++;
      if (e.message.model) models.add(e.message.model);
      m.tokens.input += u.input_tokens || 0; m.tokens.cacheWrite += u.cache_creation_input_tokens || 0;
      m.tokens.cacheRead += u.cache_read_input_tokens || 0; m.tokens.output += u.output_tokens || 0;
      if (!m.context.first && ctx) m.context.first = ctx;
      m.context.peak = Math.max(m.context.peak, ctx);
      if (turn) { turn.calls++; turn.cacheRead += u.cache_read_input_tokens || 0; turn.output += u.output_tokens || 0; turn.peak = Math.max(turn.peak, ctx); }
    }
    if (e.type === 'assistant' && Array.isArray(content)) {
      for (const c of content) if (c.type === 'tool_use') {
        uses.set(c.id, { name: c.name, input: c.input || {}, at: t });
        if (REVIEWING(uses.get(c.id))) m.reviewCalls++;
      }
      const u = e.message.usage;
      if (!m.context.firstEdit && u && content.some((c) => c.type === 'tool_use' && EDITS.includes(c.name))) {
        m.context.firstEdit = (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0);
      }
    }
    if (e.type === 'user' && Array.isArray(content)) {
      for (const c of content.filter((c) => c.type === 'tool_result')) {
        const use = uses.get(c.tool_use_id) || { name: '?', input: {}, at: t }, bytes = result(c.content);
        const tool = (m.tools[use.name] = m.tools[use.name] || { calls: 0, bytes: 0, seconds: 0 });
        tool.calls++; tool.bytes += bytes; tool.seconds += Math.max(0, (t - use.at) / 1000);
        m.largest.push({ tool: use.name, what: what(use), bytes });
      }
    }
  }
  if (m.start) m.wallMin = (Date.parse(m.end) - Date.parse(m.start)) / 60e3;
  m.activeMin = +m.activeMin.toFixed(1); m.wallMin = +m.wallMin.toFixed(1); m.models = [...models];
  for (const tool of Object.values(m.tools)) tool.seconds = +tool.seconds.toFixed(1);
  // the largest results, grouped by what was read or run
  const groups = new Map();
  for (const r of m.largest) {
    const key = r.tool + ' ' + r.what, g = groups.get(key) || { tool: r.tool, what: r.what, calls: 0, bytes: 0 };
    g.calls++; g.bytes += r.bytes; groups.set(key, g);
  }
  m.largest = [...groups.values()].sort((a, b) => b.bytes - a.bytes).slice(0, 12);
  m.weighted = weighted(m.tokens);
  if (sub) {
    const first = entries.find((e) => e.type === 'user' && e.message), c = first && first.message.content;
    const prompt = typeof c === 'string' ? c : Array.isArray(c) ? c.map((x) => x.text || '').join(' ') : '';
    m.task = (prompt.match(/VB-\d{3,}/) || [null])[0];
    m.reviewPrompt = /^\s*Review VB-\d{3,}/.test(prompt);
  }
  return m;
}
// The sub-agents of a session, each a line: its task, model, calls, weighted cost, boot and peak; with the results, its size and status.
function subagents(file, results) {
  const dir = path.join(file.replace(/\.jsonl$/, ''), 'subagents');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => /^agent-.*\.jsonl$/.test(f)).map((f) => {
    const s = measure(path.join(dir, f), true), r = results.find((x) => x.task && x.task === s.task) || {};
    let meta = {};
    try { meta = JSON.parse(fs.readFileSync(path.join(dir, f.replace(/\.jsonl$/, '.meta.json')), 'utf8')); } catch { /* an older harness wrote none */ }
    const role = meta.agentType === 'vb-review' || s.reviewPrompt ? 'review' : 'implement';
    return { agent: f.slice(6, -6).slice(0, 8), file: path.join(dir, f), role, task: s.task, size: r.size || null, status: role === 'review' ? null : r.status || null,
      review: role === 'review' ? null : r.review || null, model: s.models[0] || null, calls: s.calls,
      tokens: s.tokens, weighted: s.weighted, first: s.context.first, boot: s.context.firstEdit, peak: s.context.peak, activeMin: s.activeMin, start: s.start, end: s.end };
  }).filter((s) => s.calls).sort((a, b) => String(a.start).localeCompare(String(b.start)));
}
// A revision is what an implementer spent after its task's reviewer returned (the same transcript, resumed, or the session's own).
function revisions(subs) {
  for (const s of subs.filter((x) => x.role === 'implement')) {
    const rv = subs.find((x) => x.role === 'review' && x.task === s.task);
    if (rv && rv.end && s.end > rv.end) { const after = measure(s.file, true, rv.end); s.revision = { weighted: after.weighted, calls: after.calls, activeMin: after.activeMin }; }
  }
  for (const s of subs) delete s.file;
  return subs;
}
// The review of a session that worked on one task alone: its findings file, its reviewer sub-agent, and the session's cost after it.
function sessionReview(file, m) {
  if (arm) return { task: m.task || null, arm };
  if (!reviewFile) return null;
  const r = JSON.parse(fs.readFileSync(reviewFile, 'utf8')), fs_ = r.findings || [], g = (x) => fs_.filter((f) => f.grade === x).length;
  const rv = m.subagents.filter((s) => s.role === 'review').pop(), after = rv && rv.end ? measure(file, false, rv.end) : null;
  return { task: r.task || m.task || null, arm: 'review', verdict: g('blocking') ? 'revise' : 'pass', blocking: g('blocking'), advisory: g('advisory'),
    preference: g('preference'), findings: fs_.map((f) => ({ id: f.id, grade: f.grade, category: f.category, verified: f.verified || null })),
    confirmed: !!r.confirm, reviewer: rv ? { calls: rv.calls, weighted: rv.weighted, activeMin: rv.activeMin, model: rv.model } : null,
    revision: after && g('blocking') ? { weighted: after.weighted, calls: after.calls, activeMin: after.activeMin } : null };
}
const median = (xs) => { const s = [...xs].sort((a, b) => a - b), i = (s.length - 1) / 2; return s.length ? Math.round((s[Math.floor(i)] + s[Math.ceil(i)]) / 2) : null; };
// The run's three measures (null where there is nothing to measure).
function summary(m) {
  const subs = m.subagents, tasks = subs.filter((s) => s.task && s.role !== 'review'), total = m.weighted + subs.reduce((a, s) => a + s.weighted, 0);
  const done = tasks.filter((s) => s.status === 'done'), ended = tasks.filter((s) => s.status && s.status !== 'running');
  const bySize = {}, impl = (s) => s.weighted - (s.revision ? s.revision.weighted : 0);
  for (const size of ['S', 'M', 'L']) { const xs = done.filter((s) => s.size === size).map(impl); if (xs.length) bySize[size] = { n: xs.length, median: median(xs) }; }
  const rvs = subs.filter((s) => s.role === 'review'), revised = tasks.filter((s) => s.revision);
  const review = rvs.length || m.reviewCalls ? { reviews: rvs.length, weighted: rvs.reduce((a, s) => a + s.weighted, 0), median: median(rvs.map((s) => s.weighted)),
    revisions: revised.length, revisionWeighted: revised.reduce((a, s) => a + s.revision.weighted, 0), orchestratorCalls: m.reviewCalls } : null;
  return { weightedTotal: total, orchestratorShare: total ? +(m.weighted / total).toFixed(3) : null, bootMedian: median(subs.map((s) => s.boot).filter(Boolean)),
    readMedian: median(subs.filter((s) => s.boot).map((s) => s.boot - s.first)),
    weightedPerDoneTask: done.length ? Math.round(total / done.length) : null, perSize: bySize,
    firstPass: ended.length ? +(done.length / ended.length).toFixed(2) : null, tasks: ended.length, review };
}
// What a tool call read or ran, without its arguments' content: a file for Read, the program and its first argument for Bash.
function what(use) {
  const i = use.input;
  if (i.file_path) return path.relative(process.cwd(), i.file_path) || i.file_path;
  if (typeof i.command === 'string') {
    const cmd = i.command.split(/&&|;|\|/).map((s) => s.trim()).find((s) => s && !/^(cd|export|[A-Z_]+=\S*$)/.test(s)) || '';
    return cmd.replace(/^([A-Z_]+=\S+\s+)+/, '').split(/\s+/).slice(0, 2).join(' ').slice(0, 60);
  }
  return i.pattern || i.query || i.skill || i.action || '';
}

function report(m) {
  const t = m.tokens, lines = [
    `session ${m.session.slice(0, 8)} (${m.label}): ${m.start} to ${m.end}, ${m.activeMin} min active of ${m.wallMin}; ${m.prompts} prompts`,
    `model calls ${m.calls}${m.subagentCalls ? ` (+${m.subagentCalls} in subagents)` : ''}; context at the first call ${k(m.context.first)}, `
      + `at its peak ${k(m.context.peak)} tokens`,
    `tokens: fresh input ${k(t.input)}, cache writes ${k(t.cacheWrite)}, cache reads ${k(t.cacheRead)}, output ${k(t.output)}`,
    'tools: ' + Object.entries(m.tools).sort((a, b) => b[1].bytes - a[1].bytes)
      .map(([n, x]) => `${n} ${x.calls}× ${kb(x.bytes)} ${x.seconds} s`).join('; '),
    'largest results: ' + m.largest.slice(0, 8).map((g) => `${g.tool} ${g.what} ${kb(g.bytes)}${g.calls > 1 ? ` (${g.calls}×)` : ''}`).join('; '),
  ];
  const s = m.summary;
  lines.push(`weighted cost ${k(s.weightedTotal)}: the orchestrator ${k(m.weighted)} (${s.orchestratorShare == null ? '-' : Math.round(s.orchestratorShare * 100) + '%'}), `
    + `${m.subagents.length} sub-agents ${k(s.weightedTotal - m.weighted)}; median boot ${s.bootMedian == null ? '-' : `${k(s.bootMedian)}, of which read before the first edit ${k(s.readMedian)}`}`);
  if (s.tasks) lines.push(`tasks: ${s.tasks} ended, ${Math.round(s.firstPass * 100)}% done; weighted cost a done task ${s.weightedPerDoneTask == null ? '-' : k(s.weightedPerDoneTask)}`
    + Object.entries(s.perSize).map(([size, x]) => `; ${size} median ${k(x.median)} (${x.n})`).join(''));
  if (s.review) lines.push(`reviews (VB-1619): ${s.review.reviews}, weighted ${k(s.review.weighted)} (median ${s.review.median == null ? '-' : k(s.review.median)}); `
    + `revisions ${s.review.revisions}, weighted ${k(s.review.revisionWeighted)}; the session's calls on review ${s.review.orchestratorCalls}`);
  if (m.review) lines.push(`review of ${m.review.task}: ${m.review.arm}` + (m.review.arm !== 'review' ? '' : `, ${m.review.verdict}, ${m.review.blocking} blocking, `
    + `${m.review.advisory} advisory, ${m.review.preference} preference${m.review.reviewer ? `; reviewer ${k(m.review.reviewer.weighted)}` : ''}`
    + `${m.review.revision ? `, revision ${k(m.review.revision.weighted)}` : ''}`));
  lines.push(...m.subagents.map((x) => `  ${x.role === 'review' ? 'review of ' : ''}${x.task || x.agent} ${x.size || '-'} ${x.status || '-'} ${x.model || '-'}: ${x.calls} calls, weighted ${k(x.weighted)}, `
    + `first call ${k(x.first)}, boot ${x.boot ? k(x.boot) : '-'}, peak ${k(x.peak)}, ${x.activeMin} min`));
  if (turns) lines.push(...m.turns.map((x) => `  turn ${x.at}: ${x.calls} calls, cache reads ${k(x.cacheRead)}, output ${k(x.output)}, peak ${k(x.peak)}`));
  return lines.join('\n');
}

function history(dir) {
  const runs = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
  const q = (xs, p) => {
    const s = [...xs].sort((a, b) => a - b), i = (s.length - 1) * p, lo = Math.floor(i);
    return s[lo] + (s[Math.ceil(i)] - s[lo]) * (i - lo);
  };
  const cols = [['calls', (r) => r.calls], ['peak', (r) => r.context.peak], ['cacheRead', (r) => r.tokens.cacheRead],
    ['output', (r) => r.tokens.output],
    ['weighted', (r) => r.summary && r.summary.weightedTotal], ['perTask', (r) => r.summary && r.summary.weightedPerDoneTask],
    ['orchPct', (r) => r.summary && r.summary.orchestratorShare * 100], ['boot', (r) => r.summary && r.summary.bootMedian],
    ['donePct', (r) => r.summary && r.summary.firstPass * 100], ['activeMin', (r) => r.activeMin], ['toolKB', (r) => Object.values(r.tools).reduce((s, x) => s + x.bytes, 0) / 1000]];
  const byLabel = new Map();
  for (const r of runs) byLabel.set(r.label, [...(byLabel.get(r.label) || []), r]);
  if (!byLabel.size) return `no runs in ${dir}`;
  return [...byLabel].map(([name, rs]) => `${name}: ${rs.length} runs, ${rs.map((r) => r.start.slice(0, 10)).sort()[0]} to `
    + `${rs.map((r) => r.start.slice(0, 10)).sort().pop()}; median [quartiles]\n` + cols.map(([c, f]) => {
    const xs = rs.map(f).filter((x) => Number.isFinite(x)); // a run from before a measure existed lacks it
    if (!xs.length) return null;
    return `  ${c.padEnd(10)} ${k(Math.round(q(xs, 0.5)))} [${k(Math.round(q(xs, 0.25)))}, ${k(Math.round(q(xs, 0.75)))}]`;
  }).filter(Boolean).join('\n')).join('\n');
}

if (historyDir) { console.log(history(historyDir)); process.exit(0); }
const file = args[0] || newest();
if (!fs.existsSync(file)) fail(`no file ${file}`);
const m = measure(file);
if (task && !/^VB-\d{3,}$/.test(task)) fail(`--task takes a task ID (VB-NNN), not ${task}`);
if (task) m.task = task;
const results = resultsFile ? JSON.parse(fs.readFileSync(resultsFile, 'utf8')) : [];
if (arm && !['control', 'ineligible'].includes(arm)) fail('--arm is control or ineligible (a reviewed session gives --review FILE)');
m.subagents = revisions(subagents(file, results));
m.review = sessionReview(file, m);
m.summary = summary(m);
if (out) {
  fs.mkdirSync(out, { recursive: true });
  const name = path.join(out, `${(m.start || '').slice(0, 10)}-${m.label}-${m.session.slice(0, 8)}.json`);
  fs.writeFileSync(name, JSON.stringify({ ...m, turns: undefined }, null, 1) + '\n');
  console.error('agent-usage: wrote ' + name);
}
console.log(asJson ? JSON.stringify(m, null, 1) : report(m));
