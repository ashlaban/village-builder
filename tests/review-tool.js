// @suite fast
// tools/review.js (VB-1619) on a constructed repository of two commits: the arm and its rule, one review a task, the packet (the vision
// and principles first, the task as it stood, a changed test that passes on the base flagged, the task's own file left out of the diff),
// the claims refused before the draft, the findings' grades checked, and what a source file declares.
const assert = require('assert'), fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
const { facts, checkFindings, fnv1a, openFollowup, evaluation, rateRatio, cpBounds } = require('../tools/review.js');
const tool = path.join(__dirname, '../tools/review.js');

// ---- what a source file declares
const f = facts(`VB['sim/a'] = (() => {
  // @state st.digs: holes dug, by tile
  const { register } = VB['sim/commands'];
  const KINDS = { dig: { rank: 1 } };
  VB.counter('digWalk', 'tiles read');
  register('dig', { check: () => null, run: () => {} });
  const later = () => VB['sim/b'].x;
  return { KINDS };
})();`, 'src/sim/a.js');
assert(f.edges.has('sim/b') && f.edges.has('sim/commands') && !f.edges.has('sim/a'), 'reads of other modules, at load and later; not its own');
assert.deepStrictEqual([[...f.state], [...f.verbs], [...f.kinds], [...f.counters]], [['st.digs'], ['dig'], ['dig'], ['digWalk']]);

// ---- the grades
const blocking = { id: 'F1', grade: 'blocking', category: 'principle', authority: 'design.md, Principles for decisions: "Nothing teleports" (Decided)',
  place: 'src/sim/a.js:3', scenario: 'a pawn dies holding grain: the grain is gone', check: 'a test that kills the holder' };
assert.deepStrictEqual(checkFindings({ findings: [blocking] }), { errors: [], blocking: 1, verdict: 'revise' });
const weak = checkFindings({ findings: [{ ...blocking, authority: 'design.md, Settling in steps (Proposed)' }, { ...blocking, id: 'F2', scenario: '' },
  { id: 'F3', grade: 'nit', category: 'style' }, ...[4, 5, 6, 7].map((i) => ({ id: 'P' + i, grade: 'preference', category: 'coupling' }))] });
assert(weak.errors.some((e) => /F1: rests on a Proposed/.test(e)), 'a Proposed point is advisory at most');
assert(weak.errors.some((e) => /F2: .*failing scenario/.test(e)), 'a blocking finding states its scenario');
assert(weak.errors.some((e) => /F3: grade/.test(e)) && weak.errors.some((e) => /F3: category/.test(e)), 'grades and categories are closed lists');
assert(weak.errors.some((e) => /4 preferences/.test(e)), 'at most three preferences');
assert.strictEqual(checkFindings({ findings: [{ ...blocking, grade: 'advisory', authority: 'taste' }] }).verdict, 'pass');

// ---- a repository of two commits
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vb-review-test-'));
const put = (file, text) => { fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true }); fs.writeFileSync(path.join(dir, file), text); };
const git = (...a) => cp.execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const run = (...a) => cp.spawnSync(process.execPath, [tool, ...a, '--root', dir], { encoding: 'utf8' });
const id = 'VB-900';
try {
  git('init', '-q', '-b', 'main');
  put('design.md', '# Design\n\n## 1. Vision\n\n### The game, in Kim\'s terms (3 November)\n\nAn island of villages.\n\n### Principles for decisions\n\n- **Nothing teleports.**\n\n## 2. Digging\n\nHoles are dug by hand (Decided).\n');
  put('src/manifest.json', '["sim/commands.js", "sim/a.js"]\n');
  put('src/sim/a.js', "VB['sim/a'] = (() => {\n  return {};\n})();\n");
  put('tests/old.js', "require('assert')(true);\n");
  put(`backlog/${id}.md`, `# ${id}: Dig a hole\nStatus: ready\nPriority: 2\nSize: S\nDesign ref: design.md, Digging\nGoal: a pawn digs.\nAcceptance criteria:\n- [ ] a verb dig\n`);
  git('add', '.'); git('commit', '-q', '-m', 'base');
  const base = git('rev-parse', '--short', 'HEAD');
  assert.match(run('eligible', id, '--base', base).stdout, /ineligible: no rule holds/, 'no change, no rule');
  put('src/sim/a.js', "VB['sim/a'] = (() => {\n  // @state st.digs: holes, by tile\n  VB['sim/commands'].register('dig', {});\n  return {};\n})();\n");
  put('tests/old.js', "require('assert')(true); // touched\n");
  put('tests/dig.js', "require('assert')(require('fs').readFileSync(__dirname + '/../src/sim/a.js', 'utf8').includes('dig'));\n");
  put(`backlog/${id}.md`, `# ${id}: Dig a hole\nStatus: ready\nPriority: 2\nSize: S\nDesign ref: design.md, Digging\nGoal: a pawn digs.\nAcceptance criteria:\n- [x] a verb dig\nNotes:\n- Flag: I chose a shovel, since it is faster.\n`);
  git('add', '.'); git('commit', '-q', '-m', 'head');

  // the arm
  const arm = fnv1a(id) % 3 === 0 ? 'control' : 'review', e = run('eligible', id, '--base', base).stdout;
  assert(e.startsWith(`${id}: ${arm}: `) && /new structure \(state 1, verbs 1, reads 1\)/.test(e) && /a Flag: line/.test(e), e);
  const held = Array.from({ length: 900 }, (_, i) => `VB-${100 + i}`).filter((x) => fnv1a(x) % 3 === 0).length / 900;
  assert(held > 0.28 && held < 0.39, `the holdout takes about a third of IDs (${held.toFixed(2)})`);

  // the packet
  const p = run('packet', id, '--base', base);
  assert.strictEqual(p.status, 0, p.stderr);
  const out = p.stdout, at = (s) => out.indexOf(s);
  assert(at('## The vision and the design principles') > 0 && at('Nothing teleports') < at('## The task as it stood'), 'the vision and the principles come first');
  assert(/- \[ \] a verb dig/.test(out) && !/\[x\]/.test(out) && !/shovel/.test(out), 'the task as it stood: no tick, no note of the implementer');
  assert(/Holes are dug by hand \(Decided\)/.test(out), 'the design section its ref names, with its status');
  assert(/tests\/dig\.js: fails on base: detects the change/.test(out), 'a new test that needs the change');
  assert(/tests\/old\.js: passes on base: does not detect the change/.test(out), 'a changed test that would pass without it');
  assert(/@state fields added: st\.digs/.test(out) && /verbs registered: dig/.test(out) && /sim\/a → sim\/commands/.test(out), 'structure added');
  assert(!out.includes(`b/backlog/${id}.md`) && out.includes('b/src/sim/a.js'), "the task's own file is left out of the diff");
  assert.strictEqual(git('worktree', 'list').split('\n').length, 1, 'the base worktree is removed');

  // claims, only after the draft; then one review a task
  const c0 = run('claims', id, '--base', base);
  assert(c0.status === 2 && /no draft findings/.test(c0.stderr), 'claims are refused before the draft');
  put(`work/review/${id}.json`, JSON.stringify({ task: id, findings: [blocking] }));
  const c1 = run('claims', id, '--base', base).stdout;
  assert(/1 of 1 criteria ticked/.test(c1) && /shovel/.test(c1), 'after the draft: the ticks and the notes');
  assert.strictEqual(run('check', id).stdout.trim(), `${id} review: revise 1 blocking; 0 advisory or preference`);
  assert.match(run('eligible', id, '--base', base).stdout, /reviewed: a review is recorded: work\/review\/VB-900\.json/);
  fs.rmSync(path.join(dir, 'work'), { recursive: true });
  put('docs/agents/usage/run.json', JSON.stringify({ review: { task: id, arm: 'review' } }));
  assert.match(run('eligible', id, '--base', base).stdout, /reviewed: .*docs\/agents\/usage\/run\.json/, 'a committed run file records it too');
  put('docs/agents/usage/run.json', JSON.stringify({ subagents: [{ role: 'review', task: id }] }));
  assert.match(run('eligible', id, '--base', base).stdout, /reviewed: .*run\.json/, 'and an orchestrated night\'s reviewer');

  // confirm, after one revision: a test that fails at the reviewed commit and passes at the head shows a mend; no second review
  fs.rmSync(path.join(dir, 'docs'), { recursive: true });
  // a checker under tests/ (as tests/backlog.js): lenient at the reviewed commit; the revision makes it strict (VB-1676)
  put('tests/checker.js', "process.exit(0);\n");
  git('add', 'tests'); git('commit', '-q', '-m', 'a checker');
  const reviewed = git('rev-parse', '--short', 'HEAD');
  put('src/sim/a.js', "VB['sim/a'] = (() => {\n  // @state st.digs: holes, by tile (mended)\n  VB['sim/commands'].register('dig', {});\n  return {};\n})();\n");
  put('tests/fix.js', "require('assert')(require('fs').readFileSync(__dirname + '/../src/sim/a.js', 'utf8').includes('mended'));\n");
  put('tests/checker.js', "process.exit(process.argv[2] === 'bad' ? 1 : 0);\n");
  put('tests/strict.js', "require('assert')(require('child_process').spawnSync(process.execPath, [__dirname + '/checker.js', 'bad']).status === 1);\n");
  git('add', 'src', 'tests'); git('commit', '-q', '-m', 'revision');
  const B = (id, more) => ({ ...blocking, id, ...more });
  put(`work/review/${id}.json`, JSON.stringify({ task: id, findings: [
    B('F1', { outcome: 'mended', test: 'tests/fix.js' }),
    B('F2', { outcome: 'rebutted', rebuttal: 'design.md, Digging (Decided): "Holes are dug by hand", which the change keeps' }),
    B('F3', { outcome: 'mended', test: 'tests/dig.js' }),
    B('F4', { followup: 'VB-777' }),
    B('F5', { outcome: 'mended', test: 'tests/strict.js' }),
    { ...blocking, id: 'A1', grade: 'advisory', outcome: 'declined', note: 'the walk is the head\'s choice' },
    { ...blocking, id: 'A2', grade: 'advisory' }] }));
  const k = run('confirm', id, '--reviewed', reviewed, '--dry');
  assert.strictEqual(k.status, 0, k.stderr);
  assert(k.stdout.startsWith(`${id} confirm: blocking 2 mended, 1 rebutted, 2 unresolved; advisory 0 mended, 1 declined, 1 unanswered`), k.stdout);
  assert(/F3 blocking: unresolved: tests\/dig\.js passes at \w+, so it does not show the mend/.test(k.stdout), 'a test that passed before shows no mend');
  assert(/F5 blocking: mended/.test(k.stdout), 'a mend made in a checker under tests/ shows: the reviewed commit runs its own checker (VB-1676)');
  assert(/F4: its follow-up is VB-777/.test(k.stdout) && !/F4: would open/.test(k.stdout), 'a follow-up is opened once');
  assert(/F3: would open a priority 1 task, Cause: VB-900/.test(k.stdout), '--dry opens nothing');
  assert(!JSON.parse(fs.readFileSync(path.join(dir, 'work/review', id + '.json'), 'utf8')).confirm, '--dry writes nothing');
  assert.strictEqual(git('worktree', 'list').split('\n').length, 1, 'the reviewed commit\'s worktree is removed');

  // an orchestrated run: the same through the inbox (VB_INBOX), and the orchestrator reads one line a task
  const env = { ...process.env, VB_INBOX: path.join(dir, 'inbox.db') };
  const inb = (...a) => cp.spawnSync(process.execPath, [path.join(__dirname, '../tools/inbox.js'), ...a, '--root', dir], { encoding: 'utf8', env });
  const rin = (...a) => cp.spawnSync(process.execPath, [tool, ...a, '--root', dir], { encoding: 'utf8', env });
  assert.strictEqual(inb('init').status, 0); inb('start', id, '1');
  fs.renameSync(path.join(dir, 'work'), path.join(dir, 'work-kept'));
  assert.match(rin('eligible', id, '--base', base, '--inbox').stdout, new RegExp(`${id}: (review|control): `), 'the arm, noted');
  fs.renameSync(path.join(dir, 'work-kept'), path.join(dir, 'work'));
  assert.match(rin('check', id, '--inbox').stdout, /review: revise 5 blocking/, 'the verdict, noted');
  const conf = rin('confirm', id, '--reviewed', reviewed, '--inbox');
  assert(conf.status === 0 && /F3: noted VB-\d+ \(priority 1, Cause: VB-900\)/.test(conf.stdout), conf.stdout + conf.stderr);
  const followup = conf.stdout.match(/F3: noted (VB-\d+)/)[1];
  assert(inb('list', 'task', '--json').stdout.includes(`"cause": "${id}"`), 'the follow-up is a task note naming its cause, for apply');
  fs.renameSync(path.join(dir, 'work'), path.join(dir, 'work-kept'));
  assert.match(rin('eligible', id, '--base', base).stdout, /reviewed: a review is recorded: the inbox/, 'one review a task, by the inbox');
  assert(inb('status').stdout.includes(`${id} running; review: revise 5 blocking, confirmed, 2 unresolved (${followup},VB-777)`), inb('status').stdout);
  const res = JSON.parse(inb('results', '--json').stdout).find((x) => x.task === id);
  assert(res.review && res.review.verdict === 'revise' && res.review.blocking === 5 && res.review.mended === 2 && res.review.unresolved === 2, JSON.stringify(res));
  assert(/\*\*Reviews \(VB-1619\)\*\*\n- VB-900: revise 5 blocking, confirmed, 2 unresolved/.test(inb('report').stdout), inb('report').stdout);
  const ceil = inb('calls', 'nobody', '--ceiling', '40');
  assert(ceil.status !== 0 && /no transcript agent-nobody/.test(ceil.stderr), 'calls takes a ceiling (a reviewer\'s 40)');
} finally { fs.rmSync(dir, { recursive: true, force: true }); }

// a follow-up task, on a copy of the backlog: ready, priority 1, its cause named
const copy = fs.mkdtempSync(path.join(os.tmpdir(), 'vb-review-backlog-')), real = path.join(__dirname, '..');
try {
  for (const f of ['BACKLOG.md', 'BACKLOG_ARCHIVE.md']) fs.copyFileSync(path.join(real, f), path.join(copy, f));
  fs.cpSync(path.join(real, 'backlog'), path.join(copy, 'backlog'), { recursive: true });
  // tasks set aside as ideas keep their IDs (docs/ideas): the backlog's check reads them too
  fs.cpSync(path.join(real, 'docs', 'ideas'), path.join(copy, 'docs', 'ideas'), { recursive: true });
  const nid = openFollowup(copy, 'VB-911', { ...blocking, check: 'a test that a marriage\'s new household is not shod from nothing' });
  const text = fs.readFileSync(path.join(copy, 'backlog', nid + '.md'), 'utf8');
  assert(/^Status: ready\nCause: VB-911\nPriority: 1$/m.test(text) && /^- \[ \] a test that a marriage's new household/m.test(text) && !text.includes('(to write)'), text);
} finally { fs.rmSync(copy, { recursive: true, force: true }); }
// ---- the evaluation: the exact interval, and the arms on a constructed backlog and its runs
const [lo, hi] = cpBounds(0, 10, 0.1);
assert(lo === 0 && Math.abs(hi - (1 - Math.pow(0.05, 1 / 10))) < 1e-6, 'Clopper-Pearson, none in ten: 1 - 0.05^(1/10)');
const [l2, h2] = cpBounds(5, 10, 0.1);
assert(Math.abs(l2 - 0.2224) < 1e-3 && Math.abs(h2 - 0.7776) < 1e-3, 'five in ten: 0.222 to 0.778');
const rr = rateRatio(2, 40, 6, 40);
assert(Math.abs(rr.ratio - 1 / 3) < 1e-9 && rr.low < rr.ratio && rr.high > rr.ratio, 'the rate ratio sits inside its interval');
const ev = fs.mkdtempSync(path.join(os.tmpdir(), 'vb-review-eval-'));
try {
  const g = (date, ...a) => cp.execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { cwd: ev, env: { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date }, stdio: 'ignore' });
  const task = (id, head, notes = '') => { fs.mkdirSync(path.join(ev, 'backlog'), { recursive: true }); fs.writeFileSync(path.join(ev, 'backlog', id + '.md'), `# ${id}: T\n${head}\nPriority: 2\nSize: M\nGoal: g\n${notes}`); };
  g('2025-12-01T00:00:00Z', 'init', '-q', '-b', 'main');
  task('VB-100', 'Status: done (2025-12-01)'); task('VB-101', 'Status: done (2025-12-01)');
  g('2025-12-01T00:00:00Z', 'add', '.'); g('2025-12-01T00:00:00Z', 'commit', '-q', '-m', 'tasks');
  task('VB-102', 'Status: done (2025-12-09)\nCause: VB-101'); task('VB-103', 'Status: ready\nCause: VB-100', 'Opened by tools/review.js confirm from the review of VB-100\n');
  task('VB-104', 'Status: ready\nCause: VB-101'); // made long after VB-101's follow-up: not an escape
  g('2025-12-05T00:00:00Z', 'add', 'backlog/VB-102.md', 'backlog/VB-103.md'); g('2025-12-05T00:00:00Z', 'commit', '-q', '-m', 'repairs');
  g('2026-02-01T00:00:00Z', 'add', 'backlog/VB-104.md'); g('2026-02-01T00:00:00Z', 'commit', '-q', '-m', 'late');
  const tk = (n) => ({ input: n, cacheWrite: 0, cacheRead: 0, output: 0 });
  const r = (session, t, extra) => ({ session, label: 'worker', models: ['m'], start: '2025-11-30T10:00:00Z', end: '2025-11-30T11:00:00Z', activeMin: 30, calls: 9, tokens: tk(t), task: extra.task, subagents: extra.subagents || [], review: extra.review });
  const usage = path.join(ev, 'usage'); fs.mkdirSync(usage);
  fs.writeFileSync(path.join(usage, 'a.json'), JSON.stringify(r('s1', 1000, { task: 'VB-100', review: { task: 'VB-100', arm: 'review', blocking: 1, advisory: 1, preference: 0,
    revision: { weighted: 50 }, findings: [{ id: 'F1', grade: 'blocking', verified: 'mended' }, { id: 'A1', grade: 'advisory', verified: 'declined' }] },
    subagents: [{ agent: 'x', role: 'review', task: 'VB-100', calls: 3, tokens: tk(150), activeMin: 2, peak: 1, start: '2025-11-30T10:30:00Z' }] })));
  fs.writeFileSync(path.join(usage, 'b.json'), JSON.stringify(r('s2', 800, { task: 'VB-101', review: { task: 'VB-101', arm: 'control' } })));
  fs.writeFileSync(path.join(usage, 'c.json'), JSON.stringify(r('s3', 400, { task: 'VB-102', review: { task: 'VB-102', arm: 'ineligible' } })));
  const e = evaluation(ev, usage, 14);
  assert.deepStrictEqual(e.stat, { review: { done: 1, observed: 1, escapes: 0 }, control: { done: 1, observed: 1, escapes: 1 }, ineligible: { done: 1, observed: 1, escapes: 0 } },
    'an escape is a Cause: task made within the follow-up, not one the review opened, not one made months later');
  assert(e.catches === 1 && e.reviewCost === 200 && e.repairCost === 400 && /break-even: 1 catches × the median repair = 400 against 200: review pays/.test(e.text), e.text);
} finally { fs.rmSync(ev, { recursive: true, force: true }); }
console.log('review tool: declarations, grades, the arm, the packet (vision first, task as it stood, tests against the base, structure), claims after the draft, one review a task, confirm after the revision, a follow-up task, the same through the inbox, the evaluation');
