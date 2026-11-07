// Agent usage: what a Claude Code session cost, from its transcript (~/.claude/projects/<dir>/<session>.jsonl): model calls, tokens
// (fresh input, cache writes, cache reads, output), context at the first call and at its peak, tool calls with their result sizes and
// times, and the largest results. A response is written as several transcript lines (one per content block) that repeat its usage, so
// calls are counted by message id. Only aggregates are printed: no prompt, result or file content. See docs/review-agent-workflow.md.
const fs = require('fs'), os = require('os'), path = require('path');
const USAGE = `usage: node tools/agent-usage.js [FILE.jsonl] [--json] [--turns] [--since T] [--until T] [--label NAME] [--out DIR]
       node tools/agent-usage.js --history DIR
  FILE        a transcript; default the newest under ~/.claude/projects (this session's, when run from a session)
  --turns     a line per user prompt; --since/--until T limit to entries from/before an ISO time
  --label     the run's role (worker, reviewer, project-manager); --out DIR also writes DIR/<date>-<label>-<session>.json
  --history   medians and quartiles by label over the files in DIR`;

const args = process.argv.slice(2);
const option = (k) => { const i = args.indexOf(k); if (i < 0) return null; const v = args[i + 1]; args.splice(i, 2); return v; };
const flag = (k) => { const i = args.indexOf(k); if (i < 0) return false; args.splice(i, 1); return true; };
if (flag('--help') || flag('-h')) { console.log(USAGE); process.exit(0); }
const asJson = flag('--json'), turns = flag('--turns'), since = option('--since'), until = option('--until');
const label = option('--label') || '-', out = option('--out'), historyDir = option('--history');
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
function measure(file) {
  const entries = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } })
    .filter((e) => e && e.timestamp && (!since || e.timestamp >= since) && (!until || e.timestamp < until));
  const m = { session: (entries.find((e) => e.sessionId) || {}).sessionId || path.basename(file, '.jsonl'), label, models: [],
    start: entries.length ? entries[0].timestamp : null, end: entries.length ? entries[entries.length - 1].timestamp : null,
    wallMin: 0, activeMin: 0, prompts: 0, calls: 0, subagentCalls: 0,
    tokens: { input: 0, cacheWrite: 0, cacheRead: 0, output: 0 }, context: { first: 0, peak: 0 }, tools: {}, largest: [], turns: [] };
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
      if (e.isSidechain) m.subagentCalls++; else m.calls++;
      if (e.message.model) models.add(e.message.model);
      m.tokens.input += u.input_tokens || 0; m.tokens.cacheWrite += u.cache_creation_input_tokens || 0;
      m.tokens.cacheRead += u.cache_read_input_tokens || 0; m.tokens.output += u.output_tokens || 0;
      if (!m.context.first && ctx) m.context.first = ctx;
      m.context.peak = Math.max(m.context.peak, ctx);
      if (turn) { turn.calls++; turn.cacheRead += u.cache_read_input_tokens || 0; turn.output += u.output_tokens || 0; turn.peak = Math.max(turn.peak, ctx); }
    }
    if (e.type === 'assistant' && Array.isArray(content)) {
      for (const c of content) if (c.type === 'tool_use') uses.set(c.id, { name: c.name, input: c.input || {}, at: t });
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
  return m;
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
    ['output', (r) => r.tokens.output], ['activeMin', (r) => r.activeMin], ['toolKB', (r) => Object.values(r.tools).reduce((s, x) => s + x.bytes, 0) / 1000]];
  const byLabel = new Map();
  for (const r of runs) byLabel.set(r.label, [...(byLabel.get(r.label) || []), r]);
  if (!byLabel.size) return `no runs in ${dir}`;
  return [...byLabel].map(([name, rs]) => `${name}: ${rs.length} runs, ${rs.map((r) => r.start.slice(0, 10)).sort()[0]} to `
    + `${rs.map((r) => r.start.slice(0, 10)).sort().pop()}; median [quartiles]\n` + cols.map(([c, f]) => {
    const xs = rs.map(f);
    return `  ${c.padEnd(10)} ${k(Math.round(q(xs, 0.5)))} [${k(Math.round(q(xs, 0.25)))}, ${k(Math.round(q(xs, 0.75)))}]`;
  }).join('\n')).join('\n');
}

if (historyDir) { console.log(history(historyDir)); process.exit(0); }
const file = args[0] || newest();
if (!fs.existsSync(file)) fail(`no file ${file}`);
const m = measure(file);
if (out) {
  fs.mkdirSync(out, { recursive: true });
  const name = path.join(out, `${(m.start || '').slice(0, 10)}-${m.label}-${m.session.slice(0, 8)}.json`);
  fs.writeFileSync(name, JSON.stringify({ ...m, turns: undefined }, null, 1) + '\n');
  console.error('agent-usage: wrote ' + name);
}
console.log(asJson ? JSON.stringify(m, null, 1) : report(m));
