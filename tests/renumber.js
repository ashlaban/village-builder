// @suite integration
// tools/renumber.js and the ID helper (VB-1680), in a scratch repository with this checkout's backlog: main and a side branch both take
// the next free ID; renumbered onto main, the side branch's task, its plan file named after it and its references move to the next ID
// above main's, a reference from before the branch stays, and `git merge main` then merges with no conflict and a backlog that checks.
const fs = require('fs'), os = require('os'), path = require('path'), { spawnSync } = require('child_process');
const root = path.join(__dirname, '..'), errors = [];
const expect = (what, cond, out) => { if (!cond) errors.push(what + (out ? '\n    ' + String(out).trim().split('\n').join('\n    ') : '')); };
const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'vb-renumber-'));
const git = (...a) => spawnSync('git', ['-C', repo, ...a], { encoding: 'utf8' });
const node = (...a) => spawnSync(process.execPath, a, { cwd: repo, encoding: 'utf8' });
const write = (f, s) => { fs.mkdirSync(path.dirname(path.join(repo, f)), { recursive: true }); fs.writeFileSync(path.join(repo, f), s); };
const read = (f) => (fs.existsSync(path.join(repo, f)) ? fs.readFileSync(path.join(repo, f), 'utf8') : '(missing ' + f + ')');

for (const f of ['tools/renumber.js', 'tools/backlog.js', 'tools/help.js', 'tools/merge.js', 'tools/lib/ids.js', 'tools/lib/touches.js', 'tests/backlog.js', '.gitattributes',
  'BACKLOG.md', 'BACKLOG_ARCHIVE.md']) write(f, fs.readFileSync(path.join(root, f), 'utf8'));
fs.cpSync(path.join(root, 'backlog'), path.join(repo, 'backlog'), { recursive: true });
// the tasks set aside as ideas keep their IDs (tools/lib/ids.js): the scratch repository holds them too, or its next ID would be one of theirs
if (fs.existsSync(path.join(root, 'docs/ideas'))) fs.cpSync(path.join(root, 'docs/ideas'), path.join(repo, 'docs/ideas'), { recursive: true });
const top = require(path.join(root, 'tools/lib/ids.js')).highestId(repo).max; // the backlog's files and the ideas', before git exists
const id = (n) => 'VB-' + n;
write('notes.md', `An old line names ${id(top)}.\n`);
git('init', '-q', '-b', 'main'); git('config', 'user.email', 't@example.com'); git('config', 'user.name', 't'); git('config', 'commit.gpgsign', 'false');
node('tools/merge.js', '--install');
git('add', '.'); git('commit', '-qm', 'base');

const add = (name) => node('tools/backlog.js', 'new', `name=${name}`, 'status=blocked', 'waits=Kim', 'priority=3', 'size=S', `summary=${name}`);
git('checkout', '-qb', 'side');
let r = add('Side task'); expect('backlog.js new on the side branch', r.status === 0, r.stdout + r.stderr);
const sideId = id(top + 1);
write(`docs/plans/${sideId}-note.md`, `The plan of ${sideId}; see backlog/${sideId}.md.\n`);
fs.appendFileSync(path.join(repo, 'notes.md'), `A new line names ${sideId}.\n`);
git('add', '.'); git('commit', '-qm', 'side');
git('checkout', '-q', 'main');
r = add('Main task'); expect('backlog.js new on main', r.status === 0, r.stdout + r.stderr);
git('add', '.'); git('commit', '-qm', 'main');
expect('both branches took the same ID', fs.existsSync(path.join(repo, 'backlog', sideId + '.md')));

git('checkout', '-q', 'side');
r = node('tools/renumber.js', '--onto', 'main', '--dry');
expect('--dry prints the map', r.status === 0 && r.stdout.includes(`${sideId} -> ${id(top + 2)}`), r.stdout + r.stderr);
expect('--dry changes nothing', !git('status', '--porcelain').stdout.trim() && fs.existsSync(path.join(repo, `docs/plans/${sideId}-note.md`)));
r = node('tools/renumber.js', '--onto', 'main');
const moved = id(top + 2);
expect('renumber runs and commits', r.status === 0 && /committed/.test(r.stdout) && !git('status', '--porcelain').stdout.trim(), r.stdout + r.stderr);
expect('the task file moved, its heading with it', fs.existsSync(path.join(repo, 'backlog', moved + '.md')) && read(`backlog/${moved}.md`).startsWith(`# ${moved}: Side task`)
  && !fs.existsSync(path.join(repo, 'backlog', sideId + '.md')));
expect('a file named after the task moved, its text rewritten', fs.existsSync(path.join(repo, `docs/plans/${moved}-note.md`))
  && read(`docs/plans/${moved}-note.md`) === `The plan of ${moved}; see backlog/${moved}.md.\n`);
expect('the branch\'s new line is rewritten, a line from before the branch is not', read('notes.md') === `An old line names ${id(top)}.\nA new line names ${moved}.\n`, read('notes.md'));
r = node('tools/renumber.js', '--onto', 'main');
expect('a second run has nothing to renumber', r.status === 0 && /nothing to renumber/.test(r.stdout), r.stdout + r.stderr);
r = git('merge', '-q', '--no-edit', 'main');
expect('git merge main is clean after renumbering', r.status === 0, r.stdout + r.stderr);
r = node('tests/backlog.js', repo);
expect('the merged backlog checks', r.status === 0 && read(`backlog/${sideId}.md`).startsWith(`# ${sideId}: Main task`), r.stdout + r.stderr);

fs.rmSync(repo, { recursive: true, force: true });
if (errors.length) { console.log('RENUMBER FAIL:\n  ' + errors.join('\n  ')); process.exit(1); }
console.log('renumber: a branch\'s new tasks, their files and references move above main\'s IDs, and the merge is clean');
