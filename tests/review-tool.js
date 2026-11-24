// tools/review.js (VB-1615) on a constructed repository of two commits: the arm and its rule, one review a task, the packet (the vision
// and principles first, the task as it stood, a changed test that passes on the base flagged, the task's own file left out of the diff),
// the claims refused before the draft, the findings' grades checked, and what a source file declares.
const assert = require('assert'), fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
const { facts, checkFindings, fnv1a } = require('../tools/review.js');
const tool = path.join(__dirname, '../tools/review.js');

// ---- what a source file declares
const f = facts(`VB['sim/a'] = (() => {
  // @state st.digs: holes dug, by tile
  const { register } = VB['sim/commands'];
  const KINDS = { dig: { rank: 1 } };
  VB.COUNTERS.digWalk = 'tiles read';
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
} finally { fs.rmSync(dir, { recursive: true, force: true }); }
console.log('review tool: declarations, grades, the arm, the packet (vision first, task as it stood, tests against the base, structure), claims after the draft, one review a task');
