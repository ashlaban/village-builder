// Claude Code transcripts (~/.claude/projects/<dir>/<session>.jsonl, a sub-agent's in <session>/subagents/agent-<id>.jsonl), read the
// same way by tools/agent-usage.js and tools/inbox.js (calls): where they are, their entries, and a model call's context and cost.
// A response is written as several lines that repeat its usage, so a call is counted once, by its message id.
const fs = require('fs'), os = require('os'), path = require('path');

const projects = () => path.join(process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude'), 'projects');
// Cost in fresh-input tokens: input + 1.25 × cache writes + 0.1 × cache reads + 5 × output (about the prices' ratios).
const weighted = (t) => Math.round(t.input + 1.25 * t.cacheWrite + 0.1 * t.cacheRead + 5 * t.output);
// A call's context: what it read, fresh, written to the cache or read from it.
const contextOf = (u) => (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0);

// The newest session transcript under the projects directory (this session's, when run from a session), or null.
function newest() {
  const base = projects();
  const files = fs.existsSync(base) ? fs.readdirSync(base).flatMap((d) => {
    const dir = path.join(base, d);
    return fs.statSync(dir).isDirectory() ? fs.readdirSync(dir).filter((f) => f.endsWith('.jsonl')).map((f) => path.join(dir, f)) : [];
  }) : [];
  return files.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0] || null;
}
// A sub-agent's transcript by its id (agent-<id>), or null.
function subagent(id) {
  const base = projects(), name = `agent-${id}.jsonl`;
  return (fs.existsSync(base) ? fs.readdirSync(base) : []).flatMap((p) => {
    const dir = path.join(base, p);
    return fs.statSync(dir).isDirectory() ? fs.readdirSync(dir).map((s) => path.join(dir, s, 'subagents', name)) : [];
  }).find((f) => fs.existsSync(f)) || null;
}
// The entries of a transcript; a line still being written, or not JSON, is skipped.
const entries = (file) => fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch (e) { return null; } })
  .filter(Boolean);
// The calls so far, the context of the last, the weighted cost and when the run started: what  inbox.js calls  prints. Sub-agents' calls (isSidechain) apart.
function tally(file) {
  const seen = new Set(), t = { input: 0, cacheWrite: 0, cacheRead: 0, output: 0 };
  let context = 0, start = null;
  for (const e of entries(file)) {
    if (!start && e.timestamp) start = e.timestamp;
    if (e.type !== 'assistant' || !e.message || !e.message.id || seen.has(e.message.id) || e.isSidechain && !/agent-/.test(path.basename(file))) continue;
    seen.add(e.message.id);
    const u = e.message.usage || {};
    t.input += u.input_tokens || 0; t.cacheWrite += u.cache_creation_input_tokens || 0;
    t.cacheRead += u.cache_read_input_tokens || 0; t.output += u.output_tokens || 0;
    if (contextOf(u)) context = contextOf(u);
  }
  return { calls: seen.size, context, weighted: weighted(t), start };
}
module.exports = { projects, weighted, contextOf, newest, subagent, entries, tally };
