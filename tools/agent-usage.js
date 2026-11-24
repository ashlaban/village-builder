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
const fs = require('fs'), path = require('path'), transcript = require('./lib/transcript.js');
const USAGE = `usage: node tools/agent-usage.js [FILE.jsonl] [--json] [--turns] [--since T] [--until T] [--label NAME] [--task VB-NNN] [--out DIR] [--results FILE]
       node tools/agent-usage.js --history DIR [--periods FILE [--from DATE] [--to DATE] [--json]]
  FILE        a transcript; default the newest under ~/.claude/projects (this session's, when run from a session)
  --turns     a line per user prompt; --since/--until T limit to entries from/before an ISO time
  --label     the run's role (worker, reviewer, project-manager); --out DIR also writes DIR/<date>-<label>-<session>.json
  --task      the one task this session worked on, when it ran no sub-agents: kept in the run's file as "task" (tools/usage-page.js reads it);
              leave it out for a session that worked on several tasks or on none
  --results   the tasks' outcomes, from  node tools/inbox.js results --json : joins size and status to the sub-agents by task
  --history   medians and quartiles by label over the files in DIR
  --periods   with --history: compare the periods that the rows of FILE (docs/agents/changes.md) start, by run kind, size and model:
              a task's cost summed over its runs, calls, runs, context, repeats, test failures, continuations and the quality proxies
              (tools/lib/periods.js); --from/--to DATE keep the tasks that started in that range`;

const args = process.argv.slice(2);
const option = (k) => { const i = args.indexOf(k); if (i < 0) return null; const v = args[i + 1]; args.splice(i, 2); return v; };
const flag = (k) => { const i = args.indexOf(k); if (i < 0) return false; args.splice(i, 1); return true; };
if (flag('--help') || flag('-h')) { console.log(USAGE); process.exit(0); }
const asJson = flag('--json'), turns = flag('--turns'), since = option('--since'), until = option('--until');
const label = option('--label') || '-', out = option('--out'), historyDir = option('--history'), periodsFile = option('--periods'),
  fromDate = option('--from'), toDate = option('--to'), resultsFile = option('--results'), task = option('--task');
const fail = (msg) => { console.error('agent-usage: ' + msg); process.exit(1); };
const k = (n) => (n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'k' : String(n));
const kb = (n) => (n >= 1000 ? (n / 1000).toFixed(1) + ' KB' : n + ' B');

const newest = () => transcript.newest() || fail(`no transcript under ${transcript.projects()}; give a FILE`);

// Heuristics on tool inputs and results (VB-1615): what a call read, whether it ran a test, and whether that failed. A read is a file,
// a range of one or a document section; read again with no edit to it between, it is a repeat. A command run again, identical, with no
// edit at all between, is a repeat. A Bash command that may change files (sed -i, a redirect, git merge, checkout, reset...) is an edit.
const READS = /^(cat|head|tail|sed -n|grep|rg|wc)\b|^node tools\/doc\.js\b/,
  MUTATES = /\bsed -i\b|>\s*[^&\s|]|\btee\b|\bgit (merge|checkout|reset|pull|rebase|stash|switch|cherry-pick)\b|\bnpm run format\b/;
const TEST = /\b(npm test|npm run verify)\b|\bnode (tests\/[\w.-]+\.js)/, FAILED = /\b[1-9]\d* failed\b|\bFAIL\b|^\s*AssertionError/m;
// The keys a call reads (file path, offset and limit; or a reading Bash segment, a pipe's first part), and the files an edit names.
function reads(use) {
  const i = use.input || {};
  if (use.name === 'Read' && i.file_path) return [`${path.resolve(i.file_path)}:${i.offset || 0}:${i.limit || ''}`];
  if (use.name !== 'Bash' || typeof i.command !== 'string' || MUTATES.test(i.command)) return [];
  return i.command.split(/&&|\|\||;|\n/).map((x) => x.split('|')[0].trim().replace(/\s+/g, ' ')).filter((x) => READS.test(x) && /\s\S*[/.]\S*/.test(x));
}
function testOf(use) {
  const c = use.name === 'Bash' && typeof (use.input || {}).command === 'string' && use.input.command.match(TEST);
  return c ? c[2] || c[1] : null;
}
const text = (c) => (typeof c === 'string' ? c : Array.isArray(c) ? c.map((x) => (x.type === 'text' ? x.text : '')).join('\n') : '');

// The measures of one transcript.
const { weighted, contextOf } = transcript;
const EDITS = ['Edit', 'Write', 'NotebookEdit'];
function measure(file, sub = false) {
  const entries = transcript.entries(file).filter((e) => e.timestamp && (!since || e.timestamp >= since) && (!until || e.timestamp < until));
  const m = { session: (entries.find((e) => e.sessionId) || {}).sessionId || path.basename(file, '.jsonl'), label, models: [],
    start: entries.length ? entries[0].timestamp : null, end: entries.length ? entries[entries.length - 1].timestamp : null,
    wallMin: 0, activeMin: 0, prompts: 0, calls: 0, subagentCalls: 0,
    tokens: { input: 0, cacheWrite: 0, cacheRead: 0, output: 0 }, context: { first: 0, peak: 0, firstEdit: 0, series: [] }, tools: {}, largest: [], turns: [],
    repeats: { reads: 0, readBytes: 0, commands: 0, commandBytes: 0 }, tests: { runs: 0, failed: 0, streak: 0 }, compactions: 0,
    continuation: { continues: false, handoverBytes: 0, callsToEdit: null, contextToEdit: null } };
  const seen = new Set(), uses = new Map(), models = new Set();
  const read = new Set(), ran = new Set(), streaks = {};
  let turn = null, last = null, lastCtx = 0, firstPrompt = true;
  const result = (c) => (typeof c === 'string' ? c.length : Array.isArray(c) ? c.reduce((s, x) => s + (x.type === 'text' ? x.text.length
    : JSON.stringify(x).length), 0) : JSON.stringify(c || '').length);
  for (const e of entries) {
    const t = Date.parse(e.timestamp);
    if (last != null) m.activeMin += Math.min(t - last, 5 * 60e3) / 60e3;
    last = t;
    const content = e.message && e.message.content;
    if ((e.type === 'system' && e.subtype === 'compact_boundary') || e.isCompactSummary) { m.compactions++; continue; }
    if (e.type === 'user' && !e.isMeta && (typeof content === 'string' || (Array.isArray(content) && content.some((c) => c.type === 'text')))
      && !(Array.isArray(content) && content.some((c) => c.type === 'tool_result'))) {
      m.prompts++;
      if (firstPrompt) { // a continuing run is told so, with the handover, in its prompt (.claude/agents/vb-task.md, step 8)
        firstPrompt = false;
        const p = typeof content === 'string' ? content : text(content);
        if (/continued from/i.test(p)) m.continuation = { ...m.continuation, continues: true, handoverBytes: Buffer.byteLength(p) };
      }
      turn = { at: e.timestamp, calls: 0, cacheRead: 0, output: 0, peak: 0 };
      m.turns.push(turn);
    }
    if (e.type === 'assistant' && e.message && e.message.usage && !seen.has(e.message.id)) {
      seen.add(e.message.id);
      const u = e.message.usage, ctx = contextOf(u);
      if (e.isSidechain && !sub) m.subagentCalls++; else m.calls++;
      if (e.message.model) models.add(e.message.model);
      m.tokens.input += u.input_tokens || 0; m.tokens.cacheWrite += u.cache_creation_input_tokens || 0;
      m.tokens.cacheRead += u.cache_read_input_tokens || 0; m.tokens.output += u.output_tokens || 0;
      if (!m.context.first && ctx) m.context.first = ctx;
      m.context.peak = Math.max(m.context.peak, ctx);
      if (m.calls % 5 === 0 && ctx) m.context.series.push([m.calls, ctx]);
      if (ctx) lastCtx = ctx;
      if (turn) { turn.calls++; turn.cacheRead += u.cache_read_input_tokens || 0; turn.output += u.output_tokens || 0; turn.peak = Math.max(turn.peak, ctx); }
    }
    if (e.type === 'assistant' && Array.isArray(content)) {
      for (const c of content.filter((c) => c.type === 'tool_use')) {
        const use = { name: c.name, input: c.input || {}, at: t }, cmd = use.name === 'Bash' &&
          typeof use.input.command === 'string' ? use.input.command.trim() : null;
        if (EDITS.includes(c.name) || (cmd && MUTATES.test(cmd))) { // an edit: what was read of its file, or of anything for a Bash edit, may be read again
          const f = use.input.file_path && path.resolve(use.input.file_path);
          for (const key of [...read]) if (!f || key.startsWith(f + ':') || !key.startsWith('/')) read.delete(key);
          ran.clear();
        }
        if (cmd && ran.has(cmd)) use.repeat = 'command';
        else {
          const keys = reads(use);
          if (keys.length && keys.every((x) => read.has(x))) use.repeat = 'read';
          keys.forEach((x) => read.add(x));
        }
        if (cmd) ran.add(cmd);
        use.test = testOf(use);
        uses.set(c.id, use);
      }
      const u = e.message.usage;
      if (!m.context.firstEdit && u && content.some((c) => c.type === 'tool_use' && EDITS.includes(c.name))) {
        m.context.firstEdit = contextOf(u);
        m.continuation.callsToEdit = m.calls;
        m.continuation.contextToEdit = m.context.firstEdit - m.context.first;
      }
    }
    if (e.type === 'user' && Array.isArray(content)) {
      for (const c of content.filter((c) => c.type === 'tool_result')) {
        const use = uses.get(c.tool_use_id) || { name: '?', input: {}, at: t }, bytes = result(c.content);
        const tool = (m.tools[use.name] = m.tools[use.name] || { calls: 0, bytes: 0, seconds: 0 });
        tool.calls++; tool.bytes += bytes; tool.seconds += Math.max(0, (t - use.at) / 1000);
        if (use.repeat === 'read') { m.repeats.reads++; m.repeats.readBytes += bytes; }
        if (use.repeat === 'command') { m.repeats.commands++; m.repeats.commandBytes += bytes; }
        if (use.test) {
          const failed = c.is_error === true || FAILED.test(text(c.content));
          m.tests.runs++; if (failed) m.tests.failed++;
          streaks[use.test] = failed ? (streaks[use.test] || 0) + 1 : 0;
          m.tests.streak = Math.max(m.tests.streak, streaks[use.test]);
        }
        m.largest.push({ tool: use.name, what: what(use), bytes });
      }
    }
  }
  if (lastCtx && (!m.context.series.length || m.context.series[m.context.series.length - 1][0] !== m.calls)) m.context.series.push([m.calls, lastCtx]);
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
  }
  return m;
}
// The sub-agents of a session, each a line: its task, model, calls, weighted cost, boot and peak; with the results, its size and status.
function subagents(file, results) {
  const dir = path.join(file.replace(/\.jsonl$/, ''), 'subagents');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => /^agent-.*\.jsonl$/.test(f)).map((f) => {
    const s = measure(path.join(dir, f), true), r = results.find((x) => x.task && x.task === s.task) || {};
    return { agent: f.slice(6, -6).slice(0, 8), task: s.task, size: r.size || null, status: r.status || null, model: s.models[0] || null, calls: s.calls,
      tokens: s.tokens, weighted: s.weighted, first: s.context.first, boot: s.context.firstEdit, peak: s.context.peak, activeMin: s.activeMin, start: s.start,
        end: s.end,
      // a proxy: the orchestrator undid its merge for a red check or a conflict, and said so in the result (docs/agents/worker.md, 1.3)
      mergeUndone: r.status ? r.status === 'needs-review' && /\b(merge|conflict|red|npm test)\b/i.test(r.summary || '') : null,
      series: s.context.series, repeats: s.repeats, tests: s.tests, continuation: s.continuation, compactions: s.compactions };
  }).filter((s) => s.calls).sort((a, b) => String(a.start).localeCompare(String(b.start)));
}
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b), i = (s.length - 1) / 2; return s.length ? Math.round((s[Math.floor(i)] + s[Math.ceil(i)]) / 2) : null; };
// The run's three measures (null where there is nothing to measure).
function summary(m) {
  const subs = m.subagents, tasks = subs.filter((s) => s.task), total = m.weighted + subs.reduce((a, s) => a + s.weighted, 0);
  const done = tasks.filter((s) => s.status === 'done'), ended = tasks.filter((s) => s.status && s.status !== 'running');
  const bySize = {};
  for (const size of ['S', 'M', 'L']) {
    const xs = done.filter((s) => s.size === size).map((s) => s.weighted); if (xs.length) bySize[size] = { n: xs.length, median: median(xs) }; }
  return { weightedTotal: total, orchestratorShare: total ? +(m.weighted / total).toFixed(3) : null,
    bootMedian: median(subs.map((s) => s.boot).filter(Boolean)),
    readMedian: median(subs.filter((s) => s.boot).map((s) => s.boot - s.first)),
    weightedPerDoneTask: done.length ? Math.round(total / done.length) : null, perSize: bySize,
    firstPass: ended.length ? +(done.length / ended.length).toFixed(2) : null, tasks: ended.length };
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
  lines.push(`weighted cost ${k(s.weightedTotal)}: the orchestrator ${k(m.weighted)} (${s.orchestratorShare == null ? '-' :
    Math.round(s.orchestratorShare * 100) + '%'}), `
    + `${m.subagents.length} sub-agents ${k(s.weightedTotal - m.weighted)}; median boot ${s.bootMedian == null ? '-' :
      `${k(s.bootMedian)}, of which read before the first edit ${k(s.readMedian)}`}`);
  if (s.tasks) lines.push(
    `tasks: ${s.tasks} ended, ${Math.round(s.firstPass * 100)}% done; weighted cost a done task ${s.weightedPerDoneTask == null ? '-' :
    k(s.weightedPerDoneTask)}`
    + Object.entries(s.perSize).map(([size, x]) => `; ${size} median ${k(x.median)} (${x.n})`).join(''));
  lines.push(...m.subagents.map((x) =>
    `  ${x.task || x.agent} ${x.size || '-'} ${x.status || '-'} ${x.model || '-'}: ${x.calls} calls, weighted ${k(x.weighted)}, `
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
    ['donePct', (r) => r.summary && r.summary.firstPass * 100], ['activeMin', (r) => r.activeMin],
      ['toolKB', (r) => Object.values(r.tools).reduce((s, x) => s + x.bytes, 0) / 1000]];
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

// The periods of the log compared (VB-1615), from the runs in DIR as the usage page sums them into tasks.
function periods(dir, file) {
  const P = require('./lib/periods.js'), page = require('./usage-page.js'), root = path.join(__dirname, '..');
  if (!fs.existsSync(file)) fail(`no file ${file}`);
  const runs = page.readRuns(dir), first = runs.map((r) => r.start).sort()[0];
  const data = page.model({
    runs, commits: page.gitCommits(root, first && new Date(Date.parse(first) - 864e5).toISOString()), taskInfo: page.taskInfoOf(root) });
  const ms = (d) => (d ? Date.parse(d) : null), { compared } = page.comparePeriods(root, data, file, ms(fromDate), ms(toDate));
  return asJson ? JSON.stringify(compared, null, 1) : P.report(compared);
}

if (historyDir) { console.log(periodsFile ? periods(historyDir, periodsFile) : history(historyDir)); process.exit(0); }
const file = args[0] || newest();
if (!fs.existsSync(file)) fail(`no file ${file}`);
const m = measure(file);
if (task && !/^VB-\d{3,}$/.test(task)) fail(`--task takes a task ID (VB-NNN), not ${task}`);
if (task) m.task = task;
const results = resultsFile ? JSON.parse(fs.readFileSync(resultsFile, 'utf8')) : [];
m.subagents = subagents(file, results);
m.summary = summary(m);
if (out) {
  fs.mkdirSync(out, { recursive: true });
  const name = path.join(out, `${(m.start || '').slice(0, 10)}-${m.label}-${m.session.slice(0, 8)}.json`);
  fs.writeFileSync(name, JSON.stringify({ ...m, turns: undefined }, null, 1) + '\n');
  console.error('agent-usage: wrote ' + name);
}
console.log(asJson ? JSON.stringify(m, null, 1) : report(m));
