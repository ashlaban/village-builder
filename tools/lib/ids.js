// The highest task ID in sight (VB-1621): the task files of this checkout, and those of every branch fetched from origin and pushed in
// the last DAYS days, read with `git ls-tree` (no fetch: the caller fetches when it wants the latest). A new ID is taken above it, so
// two sessions working side by side do not take the same one once either has pushed. Outside a git checkout, the files alone.
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
const DAYS = 14;
const idsIn = (names) => names.map((f) => +((/(?:^|\/)VB-(\d+)\.md$/.exec(f) || [])[1] || 0));
function highestId(root, { exclude = [], days = DAYS } = {}) {
  const dir = path.join(root, 'backlog');
  let max = Math.max(0, ...idsIn(fs.existsSync(dir) ? fs.readdirSync(dir) : [])), where = 'this checkout';
  const git = (...a) => spawnSync('git', ['-C', root, ...a], { encoding: 'utf8', maxBuffer: 1 << 26 });
  const refs = git('for-each-ref', '--format=%(refname:short) %(committerdate:unix)', 'refs/remotes/origin');
  if (refs.status) return { max, where };
  const since = Date.now() / 1000 - days * 86400;
  for (const line of refs.stdout.trim().split('\n').filter(Boolean)) {
    const [ref, t] = line.split(' ');
    if (+t < since || ref === 'origin/HEAD' || ref === 'origin' || exclude.includes(ref)) continue;
    const ls = git('ls-tree', '--name-only', ref, 'backlog/');
    if (ls.status) continue;
    const m = Math.max(0, ...idsIn(ls.stdout.split('\n')));
    if (m > max) { max = m; where = ref; }
  }
  return { max, where };
}
module.exports = { highestId, DAYS };
