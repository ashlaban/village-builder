// @suite fast
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
r = run(file, '--json', '--task', 'VB-123');
expect('--task names the session\'s one task', r.ok && JSON.parse(r.out).task === 'VB-123' && !('task' in m), r.out);
r = run(file, '--json', '--task', 'the-next');
expect('--task takes a task ID only', !r.ok && /VB-NNN/.test(r.out), r.out);
r = run('--history', path.join(dir, 'usage'));
expect('history by label', r.ok && /^worker: 1 runs/m.test(r.out) && /calls +3 \[3, 3\]/.test(r.out), r.out);
// two sub-agents with transcripts of their own: the task from the prompt, the boot at the first edit, size and status from the results
fs.mkdirSync(path.join(dir, 's', 'subagents'), { recursive: true });
const sub = (task, read, edit) => [
  { type: 'user', isSidechain: true, timestamp: at(10), message: { role: 'user', content: `Task ${task} on branch x. SECRET-PROMPT` } },
  { type: 'assistant', isSidechain: true, timestamp: at(11), message: { id: 'a1', model: 'y-model', usage: usage(read, 0, 10),
    content: [{ type: 'tool_use', id: 'u1', name: 'Read', input: { file_path: 'AGENTS.md' } }] } },
  ...(edit ? [{ type: 'assistant', isSidechain: true, timestamp: at(12), message: { id: 'a2', model: 'y-model', usage: usage(read + 500, 0, 20),
    content: [{ type: 'tool_use', id: 'u2', name: 'Edit', input: { file_path: 'src/x.js' } }] } }] : []),
].map((l) => JSON.stringify(l)).join('\n');
fs.writeFileSync(path.join(dir, 's', 'subagents', 'agent-aaaa1111.jsonl'), sub('VB-123', 1000, true));
fs.writeFileSync(path.join(dir, 's', 'subagents', 'agent-bbbb2222.jsonl'), sub('VB-124', 3000, false));
fs.writeFileSync(path.join(dir, 'results.json'),
  JSON.stringify([{ task: 'VB-123', status: 'done', size: 'S' }, { task: 'VB-124', status: 'failed', size: 'M' }]));
r = run(file, '--json', '--results', path.join(dir, 'results.json'));
const w = r.ok ? JSON.parse(r.out) : { subagents: [], summary: {} }, [s1, s2] = w.subagents;
// weighted: input + 1.25 cache writes + 0.1 cache reads + 5 output; s1 is 4 + 0.1 * 2500 + 5 * 30 = 404
expect('sub-agents: task, size, status, weighted cost and boot', s1 && s1.task === 'VB-123' && s1.size === 'S' && s1.status === 'done' && s1.weighted === 404
  && s1.boot === 1502 && s1.first === 1002 && w.summary.readMedian === 500 && s1.calls === 2 && s2.task === 'VB-124' && s2.boot === 0, r.out);
expect('the summary: share, boot, cost a done task, first pass', w.summary.weightedTotal === w.weighted + s1.weighted + s2.weighted
  && w.summary.orchestratorShare > 0 && w.summary.bootMedian === 1502 && w.summary.perSize.S.median === 404 && w.summary.firstPass === 0.5
  && w.summary.weightedPerDoneTask === w.summary.weightedTotal, r.out);
expect('merge undone: a proxy from the result, false when the result says nothing of it', s1 && s1.mergeUndone === false && s2.mergeUndone === false, r.out);
fs.writeFileSync(path.join(dir, 'changes.md'), '| 2026-01-01T00:00Z | A change | x |\n');
run(file, '--label', 'worker', '--out', path.join(dir, 'one'), '--results', path.join(dir, 'results.json')); // an orchestrator and its two sub-agents
r = run('--history', path.join(dir, 'one'), '--periods', path.join(dir, 'changes.md'));
expect('--periods compares the periods of the log', r.ok && /^2026-01-01T00:00Z to now: A change \(2 tasks\)/m.test(r.out) &&
  /sub-agent \S+ y-model \(few\) +1/.test(r.out)
  && /orchestrator - x-model \(few\)/.test(r.out) && /a proxy/.test(r.out), r.out);
r = run(file, '--results', path.join(dir, 'results.json'));
expect('the report lists the sub-agents, no content', r.ok && /VB-123 S done y-model: 2 calls/.test(r.out) && /50% done/.test(r.out) && !/SECRET/.test(r.out),
  r.out);
// VB-1615: the context's curve, repeated reads and commands, test runs and their failures, a continuation and a compaction
const c2 = path.join(dir, 'c.jsonl');
let n = 0;
const call = (ctx, uses) => ({ type: 'assistant', timestamp: at(20), message: { id: 'c' + ++n, model: 'x-model', usage: usage(ctx, 0, 1),
  content: uses.map(([id, name, input]) => ({ type: 'tool_use', id, name, input })) } });
const res = (id, content, isError) =>
  ({ type: 'user', timestamp: at(21), message: { content: [{ type: 'tool_result', tool_use_id: id, content, ...(isError ? { is_error: true } : {}) }] } });
const bash = (command) => ({ command });
fs.writeFileSync(c2, [
  { type: 'user', timestamp: at(20), message: { role: 'user', content: 'Task VB-9, continued from `x` at abc; the handover: SECRET-HANDOVER' } },
  call(1000, [['r1', 'Read', { file_path: '/w/a.js' }]]), res('r1', 'aaaa'),
  call(1100, [['r2', 'Read', { file_path: '/w/a.js' }]]), res('r2', 'aaaa'), // a repeat
  call(1200, [['r3', 'Bash', bash('cd /w && sed -n 1,20p tools/b.js')]]), res('r3', 'bb'),
  call(1300, [['r4', 'Bash', bash('sed -n 1,20p tools/b.js | head -5')]]), res('r4', 'bb'), // a repeat of the same range
  call(1400, [['r5', 'Bash', bash('npm test')]]), res('r5', 'test: 9/10 passed, 1 failed', true),
  call(1500, [['r6', 'Bash', bash('npm test')]]), res('r6', 'test: 9/10 passed, 1 failed'), // an identical command, no edit between: a repeat
  { type: 'system', subtype: 'compact_boundary', timestamp: at(22) },
  call(1600, [['r7', 'Edit', { file_path: '/w/a.js' }]]), res('r7', 'ok'),
  call(1700, [['r8', 'Read', { file_path: '/w/a.js' }]]), res('r8', 'aaaa'), // read again after its edit: not a repeat
  call(1800, [['r9', 'Bash', bash('npm test; node tools/inbox.js calls')]]), res('r9', 'test: 10/10 passed, 0 failed'),
  call(1900, [['r10', 'Bash', bash('node tests/x.js')]]), res('r10', 'x ok'),
  call(2000, []),
].map((l) => JSON.stringify(l)).join('\n'));
r = run(c2, '--json');
const v = r.ok ? JSON.parse(r.out) : { context: {} };
expect('the context at every 5th call and the last', JSON.stringify(v.context.series) === '[[5,1402],[10,1902],[11,2002]]', r.out);
expect('repeated reads, by file and range, not after an edit', v.repeats && v.repeats.reads === 2 && v.repeats.readBytes === 6, r.out);
expect('a command run again with no edit between', v.repeats && v.repeats.commands === 1 && v.repeats.commandBytes === 27, r.out);
expect('test runs, failures, the longest streak and the current one', v.tests && v.tests.runs === 4 && v.tests.failed === 2 && v.tests.streak === 2
  && v.tests.current === 0, r.out);
expect('repeats in the last 20 calls', v.repeats && v.repeats.recent === 3, r.out);
expect('a continuation: the handover\'s bytes and the reconstruction', v.continuation && v.continuation.continues && v.continuation.handoverBytes === 67
  && v.continuation.callsToEdit === 7 && v.continuation.contextToEdit === 600, r.out);
expect('a compaction is counted', v.compactions === 1 && v.prompts === 1, r.out);
expect('a fresh run is no continuation', m.continuation && !m.continuation.continues && m.continuation.handoverBytes === 0, JSON.stringify(m.continuation));
// VB-1616: the reason a run handed over with, the handover it read, and an orchestrator's continuations with the calls each took
const c3 = path.join(dir, 'h.jsonl');
n = 0;
fs.writeFileSync(c3, [
  { type: 'user', timestamp: at(30), message: {
    role: 'user', content: 'Task VB-9, continued from `b` at abc1234; the handover: node tools/inbox.js handover VB-9' } },
  call(1000, [['h1', 'Bash', bash('node tools/inbox.js handover VB-9')]]), res('h1', 'Verified: x'),
  call(1100, [['h2', 'Bash', bash('node tools/inbox.js result VB-9 status=continue reason=stuck commit=abc summary=x')]]), res('h2', 'VB-9: continue (stuck)'),
].map((l) => JSON.stringify(l)).join('\n'));
r = run(c3, '--json');
const h = r.ok ? JSON.parse(r.out).continuation : {};
expect('the reason a run handed over with, and the handover it read', h.reason === 'stuck' && h.continues &&
  h.handoverBytes === Buffer.byteLength('Task VB-9, continued from `b` at abc1234; the handover: node tools/inbox.js handover VB-9') + 11, r.out);
const o = path.join(dir, 'o.jsonl');
fs.writeFileSync(o, [
  { type: 'user', timestamp: at(40), message: { role: 'user', content: 'Run the night.' } },
  call(1000, []),
  { type: 'user', timestamp: at(41), message: { role: 'user', content: 'VB-9 A thing: continue abc1234 on br\nthe handover...' } },
  call(1100, []), call(1200, [['o1', 'Agent', { prompt: 'Task VB-9, continued from `br` at abc1234; ...' }]]), res('o1', 'started'),
  call(1300, [['o2', 'Agent', { prompt: 'Task VB-10; the run\'s branch is x' }]]), res('o2', 'started'),
].map((l) => JSON.stringify(l)).join('\n'));
r = run(o, '--json');
const oc = r.ok ? JSON.parse(r.out).continuations : {};
expect('an orchestrator\'s continuations, and the calls from the news to the launch', oc.launched === 1 && oc.calls === 2, r.out);

// a review (VB-1619): a reviewer known by its meta file, the implementer resumed after it (its revision), kept apart from the task's measures
const subDir = path.join(dir, 's', 'subagents'), L = (o) => JSON.stringify({ isSidechain: true, ...o });
fs.writeFileSync(path.join(subDir, 'agent-cccc3333.jsonl'), [
  L({ type: 'user', timestamp: at(13), message: { role: 'user', content: 'Review VB-123; base a; head b' } }),
  L({ type: 'assistant', timestamp: at(14), message: { id: 'r1', model: 'z-model', usage: usage(2000, 0, 100), content: [] } })].join('\n'));
fs.writeFileSync(path.join(subDir, 'agent-cccc3333.meta.json'), JSON.stringify({ agentType: 'vb-review' }));
fs.appendFileSync(path.join(subDir, 'agent-aaaa1111.jsonl'), '\n' + L({ type: 'assistant', timestamp: at(15), message: { id: 'a3', model: 'y-model',
  usage: usage(3000, 0, 40), content: [{ type: 'tool_use', id: 'u3', name: 'Edit', input: { file_path: 'src/x.js' } }] } }));
fs.writeFileSync(path.join(dir, 'results.json'), JSON.stringify([{ task: 'VB-123', status: 'done', size: 'S', review: { arm: 'review', verdict: 'revise', blocking: 1 } },
  { task: 'VB-124', status: 'failed', size: 'M' }]));
r = run(file, '--json', '--results', path.join(dir, 'results.json'));
const rvw = r.ok ? JSON.parse(r.out) : { subagents: [], summary: {} }, rv = rvw.subagents.find((x) => x.role === 'review'), im = rvw.subagents.find((x) => x.task === 'VB-123' && x.role === 'implement');
// the revision: 2 + 0.1 * 3000 + 5 * 40 = 502; the implementation is the rest
expect('a reviewer by its meta file, its cost apart, no status', rv && rv.task === 'VB-123' && rv.status === null && rv.weighted === 2 + 200 + 500, r.out);
expect('the implementer\'s revision, after the reviewer returned', im && im.revision && im.revision.weighted === 502 && im.review.verdict === 'revise'
  && rvw.summary.perSize.S.median === im.weighted - 502, r.out);
expect('reviews are not tasks: first pass and counts as before', rvw.summary.firstPass === 0.5 && rvw.summary.tasks === 2
  && rvw.summary.review.reviews === 1 && rvw.summary.review.revisions === 1 && rvw.summary.review.revisionWeighted === 502, r.out);
fs.mkdirSync(path.join(dir, 'work'), { recursive: true });
fs.writeFileSync(path.join(dir, 'work', 'VB-123.json'), JSON.stringify({ task: 'VB-123', confirm: { reviewed: 'b' }, findings: [
  { id: 'F1', grade: 'blocking', category: 'principle', verified: 'mended' }, { id: 'F2', grade: 'advisory', category: 'test', verified: 'declined' }] }));
r = run(file, '--json', '--review', path.join(dir, 'work', 'VB-123.json'));
const sr = r.ok ? JSON.parse(r.out).review : {};
expect('--review: the arm, the verdict, the outcomes, the reviewer\'s cost', sr.arm === 'review' && sr.verdict === 'revise' && sr.blocking === 1 && sr.advisory === 1
  && sr.confirmed && sr.findings[0].verified === 'mended' && sr.reviewer && sr.reviewer.weighted === 702, r.out);
r = run(file, '--json', '--task', 'VB-124', '--arm', 'control');
expect('--arm: a session not reviewed states its arm', r.ok && JSON.parse(r.out).review.arm === 'control' && JSON.parse(r.out).review.task === 'VB-124', r.out);
expect('--arm takes control or ineligible', !run(file, '--arm', 'review').ok);
const f2 = path.join(dir, 'or.jsonl');
fs.writeFileSync(f2, [{ type: 'user', timestamp: at(0), message: { role: 'user', content: 'Run the night.' } },
  { type: 'assistant', timestamp: at(1), message: { id: 'o1', usage: usage(10, 0, 1), content: [{ type: 'tool_use', id: 'x1', name: 'Agent', input: { subagent_type: 'vb-review', prompt: 'Review VB-1; base a; head b' } },
    { type: 'tool_use', id: 'x2', name: 'Bash', input: { command: 'node tools/review.js eligible VB-1 --inbox' } }, { type: 'tool_use', id: 'x3', name: 'Bash', input: { command: 'git status' } }] } }]
  .map((l) => JSON.stringify(l)).join('\n'));
r = run(f2, '--json');
expect('the session\'s own calls on review', r.ok && JSON.parse(r.out).reviewCalls === 2, r.out);
fs.rmSync(dir, { recursive: true, force: true });

if (errors.length) { console.error('AGENT USAGE FAIL:\n  ' + errors.join('\n  ')); process.exit(1); }
console.log('agent usage: calls by message id, tokens, context, tools, turns and history from a transcript, no content printed; reviewers and revisions apart');
