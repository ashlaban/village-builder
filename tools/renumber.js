// Renumber this branch's new tasks before a merge brings in a branch that took the same IDs (VB-1674). Run it before `git merge REF`:
// the tasks this branch added (task files added since the merge base) whose IDs REF holds too move, in order, to the IDs above REF's
// highest task file, the branch's own and the other branches in flight (tools/lib/ids.js), as "How this backlog works" asks; the
// branch's other new tasks keep their IDs, so the fewest files change. The IDs are rewritten in every file the branch changed, and a file the branch changed whose path
// names a moved ID (its task file, docs/plans/VB-N-*) is renamed: an ID the branch added cannot appear in a line from before it. The tables are rebuilt (tools/backlog.js sync), an inbox in progress follows
// (tools/inbox.js renumber), and the change is committed.
// usage: node tools/renumber.js --onto REF [--dry] [--no-commit]
//   --onto REF     the branch about to be merged in, usually origin/main (fetch it first)
//   --dry          print the map and change nothing
//   --no-commit    leave the change staged
//   --no-flight    above REF's highest only, not the other branches in flight (to replay the renumberings of the past)
// Exit 0 with "nothing to renumber" when no ID meets one of REF's.
require('./help.js')(__filename);
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
const root = path.join(__dirname, '..');
const args = process.argv.slice(2), opt = (k) => { const i = args.indexOf(k); return i < 0 ? null : args[i + 1]; };
const onto = opt('--onto'), dry = args.includes('--dry'), commit = !args.includes('--no-commit'), flight = !args.includes('--no-flight');
const fail = (m) => { console.error('renumber: ' + m); process.exit(1); };
const git = (...a) => { const r = spawnSync('git', ['-C', root, ...a], { encoding: 'utf8', maxBuffer: 1 << 28 }); if (r.status) fail(`git ${a.join(' ')}: ${r.stderr.trim()}`); return r.stdout; };
const num = (id) => +id.slice(3), pad = (n) => 'VB-' + String(n).padStart(3, '0');
const idOf = (f) => (/^backlog\/(VB-\d{3,})\.md$/.exec(f) || [])[1];

// the map, for HEAD (or any commit) about to merge ONTO: { base, map, title }, map empty when nothing meets
function plan(head, onto, { flight = true } = {}) {
  const base = git('merge-base', head, onto).trim();
  const added = git('diff', '--name-only', '--diff-filter=A', '--no-renames', base, head, '--', 'backlog/').split('\n').map(idOf).filter(Boolean);
  const theirs = new Set(git('ls-tree', '--name-only', onto, 'backlog/').split('\n').map(idOf).filter(Boolean));
  const met = added.filter((id) => theirs.has(id)).sort((a, b) => num(a) - num(b));
  if (!met.length) return { base, map: new Map(), title: `nothing to renumber: none of the ${added.length} tasks this branch added is on ${onto}` };
  // the new IDs: above REF's highest, and above every branch in flight but this one's own
  const branch = git('rev-parse', '--abbrev-ref', 'HEAD').trim();
  const inFlight = flight ? require('./lib/ids.js').highestId(root, { exclude: [`origin/${branch}`] }) : { where: 'this checkout' };
  // only the IDs that meet move, so the fewest files change; above REF's, the branch's own that stay, and the branches in flight
  const kept = added.filter((id) => !theirs.has(id)).map(num);
  const top = Math.max(...[...theirs].map(num), ...kept, inFlight.where === 'this checkout' ? 0 : inFlight.max);
  const moving = met;
  const map = new Map(moving.map((id, i) => [id, pad(top + 1 + i)]));
  const span = (ids) => `${ids[0]} to ${ids[ids.length - 1]}`;
  const taken = [...theirs].filter((id) => num(id) >= num(met[0])).sort((a, b) => num(a) - num(b));
  return { base, map, title: `Backlog: this branch's tasks renumbered, ${span([...map.values()])} (${onto.replace(/^origin\//, '')} took ${span(taken)})` };
}
module.exports = { plan };
if (require.main === module) main();
function main() {
  if (!onto) fail('--onto REF (--help)');
  const { base, map, title } = plan('HEAD', onto, { flight });
  if (!map.size) { console.log('renumber: ' + title); process.exit(0); }
  console.log(title);
  for (const [a, b] of map) console.log(`  ${a} -> ${b}`);
  if (dry) process.exit(0);

  // rewrite the IDs in every file the branch changed, in one pass, so that a chain (1600 -> 1606, 1606 -> 1612) cannot cascade
  const swap = (s) => s.replace(/VB-(\d{3,})(?!\d)/g, (m) => map.get(m) || m);
  const changed = git('diff', '--name-only', '--diff-filter=AMR', base, 'HEAD').split('\n').filter(Boolean);
  const status = git('status', '--porcelain').trim();
  if (status) fail('the working tree has changes: commit or stash them first');
  const files = new Map(); // new path -> text
  for (const f of changed) {
    const p = path.join(root, f);
    if (!fs.existsSync(p)) continue;
    const buf = fs.readFileSync(p);
    if (buf.includes(0)) continue; // binary
    const text = buf.toString('utf8'), to = swap(f); // a path named after a task moves with it (backlog/VB-N.md, docs/plans/VB-N-*.md)
    if (to !== f || swap(text) !== text) files.set(f, [to, swap(text)]);
  }
  for (const [f, [to]] of files) if (to !== f) git('rm', '-q', f);
  for (const [, [to, text]] of files) { fs.mkdirSync(path.dirname(path.join(root, to)), { recursive: true }); fs.writeFileSync(path.join(root, to), text); }
  git('add', '--', ...[...files.values()].map(([to]) => to));
  const sync = spawnSync(process.execPath, [path.join(__dirname, 'backlog.js'), 'sync'], { cwd: root, encoding: 'utf8' });
  if (sync.status) fail('tools/backlog.js sync failed after renumbering:\n' + sync.stdout + sync.stderr);
  git('add', '--', 'BACKLOG.md', 'BACKLOG_ARCHIVE.md');
  console.log(`renumber: ${files.size} files changed`);
  const common = git('rev-parse', '--git-common-dir').trim();
  if (fs.existsSync(path.resolve(root, common, 'vb-inbox.db'))) {
    const r = spawnSync(process.execPath, [path.join(__dirname, 'inbox.js'), 'renumber', ...[...map].map(([a, b]) => `${a}=${b}`)], { cwd: root, encoding: 'utf8' });
    process.stdout.write(r.stdout + r.stderr);
  }
  if (commit) {
    git('commit', '-q', '-m', `${title}\n\n${[...map].map(([a, b]) => `${a} -> ${b}`).join('\n')}`);
    console.log(`renumber: committed; now  git merge ${onto}`);
  }
}
