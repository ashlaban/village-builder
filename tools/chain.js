// Chain: the deterministic half of a /chain coordinator (.claude/skills/chain/SKILL.md). The coordinator starts one-task sessions
// (/task, .claude/skills/task/SKILL.md) one after another and merges their PRs; this tool decides what it does next, so that a small
// model can run the chain: which task, on which model, with which title, branch and prompt, or why the chain stops. It reads the
// backlog through tools/backlog.js and keeps the chain in a local file, never committed (<git common dir>/vb-chain.json).
// usage: node tools/chain.js <command> [--root DIR] [--state FILE]
//   init --size S|M|L --n N --tag T --coordinator SESSION [--fresh]
//                    a new chain: N tasks of one size; refuses to replace a chain not ended unless --fresh
//   next [--skip VB-1,VB-2]
//                    what to do now, its first word the verb: `start VB-NNN`, then the lines `model:`, `title:`, `branch:`, `prompt:`,
//                    `source_url:` for create_session (a prompt may not open with "/"; outcome_branch needs the source); `wait VB-NNN` while a leaf runs; or `stop <reason>`. --skip: tasks an open PR names
//                    (another session has them). Models: sonnet for S, opus for M and L, the strongest offered for a "Plan:" task
//   started VB-NNN session=ID
//                    the leaf was started (after create_session); a `next` that is not followed by `started` started nothing
//   result VB-NNN status=done|needs-review|failed|stopped [pr=N] [reason=TEXT]
//                    a leaf's outcome; `stopped` (the leaf found main red) ends the chain with its reason; two tasks in a row
//                    needs-review or failed end it too
//   status [--json]  the chain so far in a line, for the session's title and the last message
require('./help.js')(__filename);
const fs = require('fs'), path = require('path'), { execFileSync, spawnSync } = require('child_process');

const MODELS = { S: 'sonnet', M: 'opus', L: 'opus', plan: 'claude-fable-5-2' }; // the plan's: the strongest offered (docs/agents/worker.md)
const STATUSES = ['done', 'needs-review', 'failed', 'stopped'];
const args = process.argv.slice(2);
const option = (k) => { const i = args.indexOf(k); if (i < 0) return null; const v = args[i + 1]; args.splice(i, 2); return v; };
const flag = (k) => { const i = args.indexOf(k); if (i < 0) return false; args.splice(i, 1); return true; };
const fail = (msg) => { console.error('chain: ' + msg); process.exit(1); };
const root = path.resolve(option('--root') || path.join(__dirname, '..'));
const stateFile = option('--state') || (() => {
  const common = execFileSync('git', ['rev-parse', '--git-common-dir'], { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  return path.join(path.resolve(root, common), 'vb-chain.json');
})();
// key=value pairs; a word with no '=' belongs to the value before it, so that an unquoted reason=a few words is read whole
const pairs = (list) => {
  const out = {}; let last = null;
  for (const a of list) {
    const i = a.indexOf('=');
    if (i > 0) { last = a.slice(0, i); out[last] = a.slice(i + 1); } else if (last) out[last] += ' ' + a; else fail(`"${a}": key=value`);
  }
  return out;
};
const load = () => (fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, 'utf8')) : fail('no chain: run  node tools/chain.js init ...'));
const save = (c) => fs.writeFileSync(stateFile, JSON.stringify(c, null, 1) + '\n');

// Why the chain stops now, or null: the leaf's own stop, two unfinished in a row, N reached.
function ended(c) {
  const last = c.leaves[c.leaves.length - 1];
  if (last && last.status === 'stopped') return last.reason || 'a leaf stopped';
  const tail = c.leaves.slice(-2);
  if (tail.length === 2 && tail.every((l) => l.status === 'needs-review' || l.status === 'failed')) return 'two tasks in a row unfinished';
  if (c.leaves.filter((l) => l.status !== 'stopped').length >= c.n) return `${c.n} tasks taken`;
  return null;
}
const summary = (c) => {
  const by = (s) => c.leaves.filter((l) => l.status === s).length, taken = c.leaves.filter((l) => l.status !== 'stopped').length;
  return `${c.tag}: ${taken}/${c.n} ${c.size} tasks, ${by('done')} done, ${by('needs-review')} needs-review, ${by('failed')} failed`
    + (c.end ? `; ended: ${c.end}` : '');
};

const [cmd, ...rest] = args;
if (cmd === 'init') {
  const size = (option('--size') || '').toUpperCase(), n = +option('--n'), tag = option('--tag'), coordinator = option('--coordinator');
  if (!MODELS[size] || size === 'plan') fail('--size S, M or L');
  if (!(n >= 1)) fail('--n: the number of tasks, at least 1');
  if (!tag || !coordinator) fail('--tag and --coordinator are required');
  if (fs.existsSync(stateFile) && !flag('--fresh') && !load().end) fail(`a chain is running here (${summary(load())}): --fresh replaces it`);
  save({ tag, size, n, coordinator, leaves: [], end: null });
  console.log(`chain ${tag}: ${n} ${size} tasks; next:  node tools/chain.js next`);
} else if (cmd === 'next') {
  const c = load(), skip = new Set((option('--skip') || '').split(/[,\s]+/).filter(Boolean));
  const running = c.leaves.find((l) => !l.status);
  if (running) { console.log(`wait ${running.task}`); process.exit(0); }
  let why = c.end || ended(c);
  let pick = null;
  if (!why) {
    const r = spawnSync(process.execPath, [path.join(__dirname, 'backlog.js'), '--root', root, 'next', '30', '--size', c.size, '--unattended'], { encoding: 'utf8' });
    if (r.status !== 0) fail('backlog.js next: ' + r.stdout + r.stderr);
    const seen = new Set(c.leaves.map((l) => l.task));
    pick = r.stdout.split('\n').map((l) => l.match(/^(VB-\d{3,}) P\d ([SML]) \S+: (.+)$/)).filter(Boolean)
      .map(([, id, size, name]) => ({ id, size, name })).find((t) => !skip.has(t.id) && !seen.has(t.id));
    if (!pick) why = `no ready ${c.size} task`;
  }
  if (why) {
    if (!c.end) { c.end = why; save(c); }
    console.log(`stop ${why}\n${summary(c)}`);
    process.exit(0);
  }
  const link = c.leaves.length + 1, model = /^Plan:/.test(pick.name) ? MODELS.plan : MODELS[pick.size];
  const name = pick.name.length > 60 ? pick.name.slice(0, 59) + '…' : pick.name;
  console.log([`start ${pick.id}`, `model: ${model}`, `title: ${pick.id}: ${name} · ${c.tag} ${link}/${c.n}`,
    `branch: claude/chain-${c.tag}-${link}`, `prompt: Run the task skill: /task ${pick.id} --report-to ${c.coordinator} --chain ${c.tag} --link ${link}`,
    'source_url: https://github.com/ashlaban/village-builder',
    `then:  node tools/chain.js started ${pick.id} session=<its id>`].join('\n'));
} else if (cmd === 'started') {
  const c = load(), [task, ...kv] = rest, p = pairs(kv);
  if (!/^VB-\d{3,}$/.test(task || '')) fail('started VB-NNN session=ID');
  if (c.leaves.find((l) => !l.status)) fail(`${c.leaves.find((l) => !l.status).task} is still running: one leaf at a time`);
  if (c.end) fail(`the chain has ended: ${c.end}`);
  c.leaves.push({ task, session: p.session || null, link: c.leaves.length + 1, status: null });
  save(c);
  console.log(`${task} started; wait for its message (and schedule a check-in)`);
} else if (cmd === 'result') {
  const c = load(), [task, ...kv] = rest, p = pairs(kv), leaf = c.leaves.find((l) => l.task === task && !l.status);
  if (!leaf) fail(`${task} is not a running leaf of this chain`);
  if (!STATUSES.includes(p.status)) fail(`status=${STATUSES.join('|')}`);
  Object.assign(leaf, { status: p.status, pr: p.pr || null, reason: p.reason || null });
  save(c);
  const why = ended(c);
  console.log(`${task} ${p.status}; ${summary(c)}${why ? `; the chain ends: ${why}` : '; next:  node tools/chain.js next'}`);
} else if (cmd === 'status') {
  const c = load();
  console.log(flag('--json') ? JSON.stringify(c, null, 1) : summary(c));
} else fail(`unknown command "${cmd}" (--help)`);
