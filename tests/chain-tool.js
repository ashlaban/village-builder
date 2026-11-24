// tools/chain.js: on a scratch state file, a chain starts the first ready task of its size with the model of its size, waits while a
// leaf runs, skips the tasks an open PR names and those it took, and stops at N, at two unfinished in a row, and at a leaf's stop.
const fs = require('fs'), os = require('os'), path = require('path'), { spawnSync } = require('child_process');
const root = path.join(__dirname, '..'), tool = path.join(root, 'tools', 'chain.js'), errors = [];
const state = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'vb-chain-')), 'chain.json');
const run = (...args) => {
  const r = spawnSync(process.execPath, [tool, '--state', state, ...args], { encoding: 'utf8' });
  return { ok: r.status === 0, out: r.stdout + r.stderr };
};
const expect = (what, cond, out) => { if (!cond) errors.push(what + (out ? '\n    ' + out.trim().split('\n').join('\n    ') : '')); };
const ready = spawnSync(process.execPath, [path.join(root, 'tools', 'backlog.js'), 'next', '30', '--size', 'S', '--unattended'], { encoding: 'utf8' })
  .stdout.match(/^VB-\d{3,}/gm) || [];

let r = run('init', '--size', 's', '--n', '3', '--tag', 't1', '--coordinator', 'session_x');
expect('init', r.ok, r.out);
r = run('init', '--size', 'S', '--n', '3', '--tag', 't2', '--coordinator', 'session_x');
expect('a running chain is not replaced without --fresh', !r.ok, r.out);
if (ready.length < 3) console.log(`chain tool: only ${ready.length} ready S tasks, the walk is cut short`);
else {
  r = run('next', '--skip', ready[0]);
  const id = (r.out.match(/^start (VB-\d+)/) || [])[1];
  expect('next starts the first ready S task not skipped, on sonnet, with its title, branch and prompt', r.ok && id === ready[1]
    && /^model: (sonnet|claude-fable-5-2)$/m.test(r.out) && r.out.includes(`title: ${id}: `) && r.out.includes(' · t1 1/3')
    && r.out.includes('branch: claude/chain-t1-1') && r.out.includes(`prompt: /task ${id} --report-to session_x --chain t1 --link 1`), r.out);
  run('started', id, 'session=s1');
  r = run('next');
  expect('next waits while a leaf runs', r.ok && r.out.trim() === `wait ${id}`, r.out);
  r = run('result', id, 'status=needs-review', 'pr=7');
  expect('a result', r.ok && /1\/3 S tasks, 0 done, 1 needs-review/.test(r.out), r.out);
  r = run('next', '--skip', ready[0]);
  const id2 = (r.out.match(/^start (VB-\d+)/) || [])[1];
  expect('a task taken is not taken again', r.ok && id2 && id2 !== id && id2 !== ready[0], r.out);
  run('started', id2, 'session=s2');
  r = run('result', id2, 'status=failed', 'reason=leaf died');
  expect('two unfinished in a row end the chain', r.ok && /the chain ends: two tasks in a row unfinished/.test(r.out), r.out);
  r = run('next');
  expect('and next says stop', r.ok && /^stop two tasks in a row unfinished/.test(r.out), r.out);

  run('init', '--size', 'S', '--n', '1', '--tag', 't3', '--coordinator', 'c', '--fresh');
  r = run('next'); const id3 = (r.out.match(/^start (VB-\d+)/) || [])[1];
  run('started', id3, 'session=s3'); run('result', id3, 'status=done', 'pr=9');
  r = run('next');
  expect('N reached ends the chain', r.ok && /^stop 1 tasks taken/.test(r.out) && /1\/1 S tasks, 1 done/.test(r.out), r.out);

  run('init', '--size', 'S', '--n', '5', '--tag', 't4', '--coordinator', 'c', '--fresh');
  r = run('next'); const id4 = (r.out.match(/^start (VB-\d+)/) || [])[1];
  run('started', id4); run('result', id4, 'status=stopped', 'reason=main is red: tests/x.js');
  r = run('next');
  expect("a leaf's stop ends the chain with its reason", r.ok && /^stop main is red: tests\/x.js/.test(r.out), r.out);
}
r = run('init', '--size', 'M', '--n', '2', '--tag', 't5', '--coordinator', 'c', '--fresh');
r = run('next', '--skip', (spawnSync(process.execPath, [path.join(root, 'tools', 'backlog.js'), 'next', '30', '--size', 'M', '--unattended'], { encoding: 'utf8' })
  .stdout.match(/^VB-\d{3,}/gm) || []).join(','));
expect('no task left: stop, with the reason', r.ok && /^stop no ready M task/.test(r.out), r.out);

if (errors.length) { console.error('chain tool:\n- ' + errors.join('\n- ')); process.exit(1); }
console.log('chain tool: next, started, result and the stops on a scratch chain');
