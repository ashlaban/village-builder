// tools/agent-usage.js on a small transcript: a response written as several lines counts once, tokens and context from the usage,
// tool calls with result sizes and times, prompts and turns, subagent calls apart, nothing of the content printed; --out and --history.
const fs = require('fs'), os = require('os'), path = require('path'), { spawnSync } = require('child_process');
const tool = path.join(__dirname, '..', 'tools', 'agent-usage.js'), errors = [];
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vb-usage-')), file = path.join(dir, 's.jsonl');
const at = (s) => `2026-01-02T03:00:${String(s).padStart(2, '0')}.000Z`;
const usage = (read, write, out) => ({ input_tokens: 2, cache_creation_input_tokens: write, cache_read_input_tokens: read, output_tokens: out });
const lines = [
  { type: 'user', timestamp: at(0), sessionId: 'abcdef1234', message: { role: 'user', content: 'Take the next task. SECRET-PROMPT' } },
  // one response in two lines (thinking, then a tool call), repeating its usage
  { type: 'assistant', timestamp: at(1), message: { id: 'm1', model: 'x-model', usage: usage(1000, 500, 40),
    content: [{ type: 'thinking', thinking: 'hm' }] } },
  { type: 'assistant', timestamp: at(1), message: { id: 'm1', model: 'x-model', usage: usage(1000, 500, 40),
    content: [{ type: 'tool_use', id: 't1', name: 'Bash', input: { command: 'cd /x && node tools/backlog.js next' } }] } },
  { type: 'user', timestamp: at(4), message: { content: [{ type: 'tool_result', tool_use_id: 't1', content: 'SECRET-RESULT 0123456789' }] } },
  { type: 'assistant', timestamp: at(5), message: { id: 'm2', model: 'x-model', usage: usage(1600, 100, 60),
    content: [{ type: 'tool_use', id: 't2', name: 'Read', input: { file_path: path.join(process.cwd(), 'AGENTS.md') } }] } },
  { type: 'user', timestamp: at(6), message: { content: [{ type: 'tool_result', tool_use_id: 't2', content: [{ type: 'text', text: 'x'.repeat(50) }] }] } },
  { type: 'assistant', timestamp: at(7), isSidechain: true, message: { id: 'm3', usage: usage(10, 10, 10), content: [] } },
  { type: 'user', timestamp: at(8), message: { role: 'user', content: [{ type: 'text', text: 'Now the second.' }] } },
  { type: 'assistant', timestamp: at(9), message: { id: 'm4', model: 'x-model', usage: usage(1800, 0, 5), content: [{ type: 'text', text: 'Done.' }] } },
];
fs.writeFileSync(file, lines.map((l) => JSON.stringify(l)).join('\n') + '\n{not json\n');
const run = (...a) => { const r = spawnSync(process.execPath, [tool, ...a], { encoding: 'utf8' }); return { ok: r.status === 0, out: r.stdout + r.stderr }; };
const expect = (what, cond, out) => { if (!cond) errors.push(what + '\n    ' + String(out).trim().split('\n').join('\n    ')); };

let r = run(file, '--json');
const m = r.ok ? JSON.parse(r.out) : {};
expect('calls counted by message id, subagents apart', m.calls === 3 && m.subagentCalls === 1, r.out);
expect('tokens summed once per response', m.tokens && m.tokens.cacheRead === 4410 && m.tokens.cacheWrite === 610 && m.tokens.output === 115
  && m.tokens.input === 8, r.out);
expect('context at the first call and at the peak', m.context && m.context.first === 1502 && m.context.peak === 1802, r.out);
expect('tools with result bytes and times', m.tools && m.tools.Bash.calls === 1 && m.tools.Bash.bytes === 24 && m.tools.Bash.seconds === 3
  && m.tools.Read.bytes === 50, r.out);
expect('what was run or read, without arguments', m.largest && m.largest.some((g) => g.what === 'node tools/backlog.js')
  && m.largest.some((g) => g.what === 'AGENTS.md'), r.out);
expect('prompts and turns', m.prompts === 2 && m.turns.length === 2 && m.turns[1].calls === 1, r.out);
r = run(file, '--turns', '--label', 'worker', '--out', path.join(dir, 'usage'));
expect('the report prints no content', r.ok && !/SECRET/.test(r.out) && /model calls 3 \(\+1 in subagents\)/.test(r.out), r.out);
r = run(file, '--until', at(8), '--json');
expect('--until limits the entries', r.ok && JSON.parse(r.out).calls === 2, r.out);
r = run('--history', path.join(dir, 'usage'));
expect('history by label', r.ok && /^worker: 1 runs/m.test(r.out) && /calls +3 \[3, 3\]/.test(r.out), r.out);
fs.rmSync(dir, { recursive: true, force: true });

if (errors.length) { console.error('AGENT USAGE FAIL:\n  ' + errors.join('\n  ')); process.exit(1); }
console.log('agent usage: calls by message id, tokens, context, tools, turns and history from a transcript, no content printed');
