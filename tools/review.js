// Review: the deterministic half of an independent review of a task's change (VB-1615). A `vb-review` sub-agent with a fresh context
// reads the packet, writes its findings, and only then reads the implementer's claims; this tool computes what a reviewer must not
// spend calls on, and checks the findings file. The review's first question is whether the change keeps the game's vision and its
// design principles (design.md, The game, in Kim's terms; Principles for decisions): every packet carries both whole.
// usage: node tools/review.js <command> VB-NNN [--base REF] [--head REF] [--root DIR]
//   eligible   the arm, and the rule that decided it: review, control (held out by a hash of the ID), ineligible, or reviewed (a
//              record of an earlier review exists: one review a task)
//   packet     what the reviewer reads first: the vision and the principles; the task as it stood at the base (tools/brief.js on
//              the base's tree, without the implementer's ticks or notes); the evidence computed here (npm test at the head; each
//              test the diff adds or changes, run at the head and against the base's sources; `same` for a refactor; baselines and
//              structure changed); and the diff, without derived files and the task's own file, cut at 60 KB
//   claims     the implementer's ticks and notes since the base; refused until work/review/VB-NNN.json holds the draft findings
//   check      checks work/review/VB-NNN.json (grades, categories, fields) and prints the verdict line
//   --base REF   default: git merge-base HEAD origin/main.   --head REF   default: HEAD (the packet's runs use the working tree)
// The findings file, work/review/VB-NNN.json (never committed):
//   { "task": "VB-NNN", "base": SHA, "head": SHA, "findings": [ { "id": "F1", "grade": "blocking|advisory|preference",
//     "category": one of CATEGORIES, "authority": "the quoted rule and its place", "place": "file:line",
//     "scenario": "the constructed state or input, and the wrong outcome", "probe": "work/review/... and what it printed",
//     "check": "the test that would catch it" } ] }
// A blocking finding quotes its authority (a criterion of the task; a Decided or Agreed point of design.md, the principles included; a
// rule of AGENTS.md, BACKLOG.md or target-v2 section 2) and states its failing scenario; one resting on a Proposed or Under revision
// point is advisory at most. At most 10 findings, of which 3 preferences.
require('./help.js')(__filename);
const fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');

const CATEGORIES = ['principle', 'criterion', 'design', 'unintended', 'counterexample', 'test', 'coupling'];
const GRADES = ['blocking', 'advisory', 'preference'];
// The holdout (VB-1615, the evaluation): a third of eligible tasks get no review, until the evaluation task records Kim's decision.
const HOLDOUT = true;
// Left out of the diff: built, measured or derived files, and the backlog's tables (the task files are in the diff).
const EXCLUDE = ['index.html', 'package-lock.json', 'BACKLOG.md', 'BACKLOG_ARCHIVE.md', 'QUESTION_ARCHIVE.md', 'docs/img', 'docs/agents/usage', 'docs/bench'];
const BASELINES = /^tests\/(.*baseline.*\.json|counters\.json)$/;
const CAP = 60000;
const RUNNERS = ['tests/suites.js', 'tests/run.js']; // lists and runners of tests, not tests

// ---- small helpers
const fnv1a = (s) => { let h = 0x811c9dc5; for (const c of Buffer.from(s)) h = Math.imul(h ^ c, 0x01000193) >>> 0; return h; };
const kb = (n) => (n >= 1000 ? (n / 1000).toFixed(1) + ' KB' : n + ' B');
function git(root, ...a) { return cp.execFileSync('git', a, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 28 }).trimEnd(); }
function show(root, ref, file) { try { return git(root, 'show', `${ref}:${file}`); } catch { return null; } }
const field = (text, k) => (((text || '').match(new RegExp(`^${k}: (.*)$`, 'm')) || [])[1] || '').trim();
const criteria = (text) => (text || '').split('\n').filter((l) => /^- \[[ x]\]/.test(l));

// ---- what a source file declares: reads of other modules, verbs, job kinds, counters, @state fields (acorn, as tests/dependencies.js)
function facts(text, file) {
  const out = { edges: new Set(), verbs: new Set(), kinds: new Set(), counters: new Set(), state: new Set() };
  if (text == null) return out;
  const { parse } = require('acorn'), { dependencies } = require('./dependencies.js');
  const src = /\.[cm]?ts$/.test(file) ? require('./lib/source.js').stripTypes(text) : text, comments = [];
  let tree;
  try { tree = parse(src, { ecmaVersion: 'latest', onComment: comments }); } catch { out.unparsed = true; return out; }
  const own = (src.match(/^VB\['([^']+)'\]\s*=/m) || [])[1];
  for (const d of dependencies(tree, src, own)) if (!d.dynamic && d.key !== own) out.edges.add(d.key);
  for (const c of comments) for (const m of c.value.matchAll(/@state\s+([\w.[\]]+)/g)) out.state.add(m[1]);
  const keys = (o) => o.properties.filter((p) => p.key).map((p) => p.key.name || p.key.value);
  (function walk(n) {
    if (!n || typeof n.type !== 'string') return;
    if (n.type === 'CallExpression' && (n.callee.name === 'register' || n.callee.property?.name === 'register') && n.arguments[0]?.type === 'Literal')
      out.verbs.add(n.arguments[0].value);
    if (n.type === 'VariableDeclarator' && n.id.name === 'KINDS' && n.init?.type === 'ObjectExpression') keys(n.init).forEach((k) => out.kinds.add(k));
    if (n.type === 'AssignmentExpression' && n.left.type === 'MemberExpression') {
      const l = n.left, name = l.property?.name;
      if (name === 'COUNTERS' && l.object.name === 'VB' && n.right.type === 'ObjectExpression') keys(n.right).forEach((k) => out.counters.add(k));
      if (l.object.type === 'MemberExpression' && l.object.property?.name === 'COUNTERS' && l.object.object.name === 'VB') out.counters.add(name);
    }
    for (const v of Object.values(n)) (Array.isArray(v) ? v : [v]).forEach((c) => c && typeof c.type === 'string' && walk(c));
  })(tree);
  return out;
}

// ---- the change: files, task file at both ends, structure added
function change(root, id, base, head) {
  const names = git(root, 'diff', '--name-status', '--no-renames', base, head).split('\n').filter(Boolean).map((l) => { const [s, f] = l.split('\t'); return { s, f }; });
  const taskFile = `backlog/${id}.md`, before = show(root, base, taskFile), after = show(root, head, taskFile);
  const src = names.filter((n) => /^src\/.*\.[cm]?[jt]s$/.test(n.f));
  const added = { modules: [], state: [], owners: [], verbs: [], kinds: [], counters: [], reads: [] };
  const manifest = (ref) => { try { return JSON.parse(show(root, ref, 'src/manifest.json') || '[]'); } catch { return []; } };
  const mb = new Set(manifest(base)), mh = manifest(head); added.modules = mh.filter((m) => !mb.has(m));
  const known = new Set(mh.map((m) => m.replace(/\.[cm]?[jt]s$/, ''))); // VB['sim/x'] names a module; VB.COUNTERS, VB.count do not
  const owners = (ref) => { try { return (JSON.parse(show(root, ref, 'src/owners.json') || '{}').fields) || {}; } catch { return {}; } };
  const ob = owners(base), oh = owners(head);
  added.owners = Object.keys(oh).filter((k) => JSON.stringify(oh[k]) !== JSON.stringify(ob[k])).map((k) => `${k} → ${typeof oh[k] === 'string' ? oh[k] : oh[k].owner || JSON.stringify(oh[k])}`);
  const unparsed = [];
  for (const { f } of src) {
    const a = facts(show(root, base, f), f), b = facts(show(root, head, f), f);
    if (b.unparsed) unparsed.push(f);
    const mod = f.replace(/^src\//, '').replace(/\.[cm]?[jt]s$/, '');
    for (const k of ['state', 'verbs', 'kinds', 'counters']) for (const x of b[k]) if (!a[k].has(x)) added[k].push(x);
    for (const x of b.edges) if (!a.edges.has(x) && known.has(x)) added.reads.push(`${mod} → ${x}`);
  }
  const flag = before == null ? /^\s*(- )?Flag:/m.test(after || '') :
    git(root, 'diff', base, head, '--', taskFile).split('\n').some((l) => /^\+\s*(- )?Flag:/.test(l));
  return { names, src, before, after, added, unparsed, flag };
}

// ---- one review a task: a record of an earlier one, in the session, the committed runs or the inbox
function reviewedAt(root, id) {
  const own = path.join(root, 'work', 'review', id + '.json');
  if (fs.existsSync(own)) return 'work/review/' + id + '.json';
  const dir = path.join(root, 'docs', 'agents', 'usage');
  for (const f of fs.existsSync(dir) ? fs.readdirSync(dir) : []) {
    try { const r = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')).review; if (r && r.task === id && r.arm === 'review') return 'docs/agents/usage/' + f; } catch {}
  }
  return null;
}

function eligibility(root, id, base, head, c = change(root, id, base, head)) {
  const done = reviewedAt(root, id);
  if (done) return { arm: 'reviewed', why: [`a review is recorded: ${done}`] };
  const t = c.after || c.before || '', name = (t.split('\n')[0] || '').replace(/^# VB-\d+: /, '');
  const why = [], refactor = /^Refactor:/.test(name);
  if (field(t, 'Phase') === 'plan' || /^Plan:/.test(name)) why.push('a plan');
  if (/^[ML]$/.test(field(t, 'Size'))) why.push(`size ${field(t, 'Size')}`);
  const s = Object.entries(c.added).filter(([, v]) => v.length).map(([k, v]) => `${k} ${v.length}`);
  if (s.length) why.push(`new structure (${s.join(', ')})`);
  const mods = c.src.filter((n) => n.s === 'M').length;
  if (!refactor && mods >= 3) why.push(`behaviour in ${mods} modules`);
  if (c.flag) why.push('a Flag: line');
  if (!why.length) return { arm: 'ineligible', why: [refactor ? 'a refactor with no new structure (it shows `same`)' : 'no rule holds (an S task, no new structure, under 3 modules)'] };
  const hash = fnv1a(id) % 3;
  if (HOLDOUT && hash === 0) return { arm: 'control', why: [...why, `held out: FNV-1a of ${id} mod 3 is 0`] };
  return { arm: 'review', why: [...why, `FNV-1a of ${id} mod 3 is ${hash}`] };
}

// ---- a run of node scripts, a few at a time, each with a time limit
function runAll(jobs, width = Math.max(1, Math.min(4, os.availableParallelism?.() || os.cpus().length))) {
  return new Promise((resolve) => {
    const res = new Array(jobs.length); let next = 0, open = 0;
    const start = () => {
      if (next >= jobs.length && !open) return resolve(res);
      while (open < width && next < jobs.length) {
        const i = next++, j = jobs[i]; open++;
        cp.execFile(process.execPath, j.args, { cwd: j.cwd, timeout: 240000, maxBuffer: 1 << 26 }, (err, out, errOut) => {
          res[i] = { ok: !err, tail: String(errOut || out || '').trim().split('\n').slice(-2).join(' / ').slice(0, 300) }; open--; start();
        });
      }
    };
    start();
  });
}

async function packet(root, id, base, head) {
  const c = change(root, id, base, head), e = eligibility(root, id, base, head, c), out = [];
  const t = c.after || '', name = (t.split('\n')[0] || '').replace(/^# VB-\d+: /, ''), refactor = /^Refactor:/.test(name);
  out.push(`# Review of ${id}: ${name}\nbase ${base}, head ${head}; arm ${e.arm} (${e.why.join('; ')})`);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vb-review-')), tree = path.join(tmp, 'base');
  git(root, 'worktree', 'add', '--detach', tree, base);
  try {
    const mods = path.join(root, 'node_modules');
    if (fs.existsSync(mods)) fs.symlinkSync(fs.realpathSync(mods), path.join(tree, 'node_modules'));
    const node = (args, cwd) => cp.spawnSync(process.execPath, args, { cwd, encoding: 'utf8', maxBuffer: 1 << 26 });
    // the vision and the principles, as they stood at the base
    const doc = (q) => node([path.join(__dirname, 'doc.js'), 'design.md', q], tree);
    const vision = ["The game, in Kim's terms", 'Principles for decisions'].map(doc).filter((r) => r.status === 0).map((r) => r.stdout.trim());
    out.push('## The vision and the design principles (design.md, section 1, at the base): the first thing a review checks\n' +
      (vision.join('\n\n') || '(not found in design.md at the base)'));
    // the task as it stood at the base: a task made on the branch is shown as at the head, its ticks cleared and its notes cut
    if (c.before == null && c.after != null) {
      const ls = c.after.split('\n'), end = ls.findIndex((l, i) => i > 0 && /^Notes:/.test(l));
      fs.writeFileSync(path.join(tree, 'backlog', id + '.md'), (end > 0 ? ls.slice(0, end) : ls).join('\n').replace(/^- \[x\]/gm, '- [ ]') + '\n');
    }
    const brief = node([path.join(__dirname, 'brief.js'), id, '--root', tree], tree);
    out.push(`## The task as it stood at the base${c.before == null ? ' (made on this branch: its criteria as written, unticked)' : ''}\n` +
      (brief.status === 0 ? brief.stdout.trim() : 'brief failed: ' + brief.stderr.trim()));
    // the evidence
    const ev = [];
    const headIsTree = git(root, 'rev-parse', 'HEAD') === git(root, 'rev-parse', head);
    if (!headIsTree) ev.push(`- runs: not taken, the working tree is not at the head (${head}); run the packet in a checkout of it`);
    else {
      const pkg = fs.existsSync(path.join(root, 'package.json')) ? JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) : {};
      if (pkg.scripts?.test) {
        const r = cp.spawnSync('npm', ['test', '--silent'], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 26 });
        ev.push(`- npm test at the head: ${r.status === 0 ? 'passes' : 'FAILS'}: ${(r.stdout + r.stderr).trim().split('\n').filter((l) => /passed|failed|FAIL/.test(l)).slice(-3).join(' / ')}`);
      }
      const tests = c.names.filter((n) => n.s !== 'D' && /^tests\/[^/]+\.js$/.test(n.f) && !RUNNERS.includes(n.f)).map((n) => n.f);
      if (tests.length) {
        fs.rmSync(path.join(tree, 'tests'), { recursive: true, force: true });
        fs.cpSync(path.join(root, 'tests'), path.join(tree, 'tests'), { recursive: true, filter: (s) => !s.includes(`${path.sep}fixtures`) });
        const fx = path.join(root, 'tests', 'fixtures');
        if (fs.existsSync(fx)) fs.symlinkSync(fs.realpathSync(fx), path.join(tree, 'tests', 'fixtures'));
        const res = await runAll(tests.flatMap((f) => [{ args: [f], cwd: root }, { args: [f], cwd: tree }]));
        ev.push(`- the tests the diff adds or changes, at the head and with the head's tests against the base's sources:`);
        tests.forEach((f, i) => {
          const [h, b] = [res[2 * i], res[2 * i + 1]];
          const verdict = !h.ok ? `FAILS at the head: ${h.tail}` : b.ok ? (refactor ? 'passes on base (as a refactor should)' : 'passes on base: does not detect the change') : 'fails on base: detects the change';
          ev.push(`  - ${f}: ${verdict}`);
        });
      }
      if (refactor) {
        const r = node([path.join(__dirname, 'same.js'), '--base', base], root);
        ev.push(`- same.js --base ${base}: ${(r.stdout + r.stderr).trim().split('\n').slice(-1)[0]}`);
      }
    }
    const bl = c.names.filter((n) => BASELINES.test(n.f)).map((n) => n.f);
    ev.push(`- baselines changed: ${bl.join(', ') || 'none'}`);
    const a = c.added, list = (k, label) => a[k].length ? `- ${label}: ${a[k].join(', ')}` : null;
    ev.push(...[list('modules', 'modules added (src/manifest.json)'), list('state', '@state fields added'), list('owners', 'src/owners.json entries added or changed'),
      list('verbs', 'verbs registered'), list('kinds', 'job kinds declared'), list('counters', 'work counters declared'), list('reads', 'reads of another module the base did not have')].filter(Boolean));
    if (!Object.values(a).some((v) => v.length)) ev.push('- structure: no module, @state field, owner, verb, job kind, counter or read between modules added');
    if (c.unparsed.length) ev.push(`- not parsed (structure unknown): ${c.unparsed.join(', ')}`);
    out.push('## Evidence, computed: do not run these again\n' + ev.join('\n'));
  } finally {
    git(root, 'worktree', 'remove', '--force', tree);
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  // the diff, without derived files and the task's own file
  const spec = ['--', '.', ...EXCLUDE.map((x) => `:(exclude)${x}`), `:(exclude)backlog/${id}.md`];
  const stat = git(root, 'diff', '--stat=120', base, head, ...spec), order = (f) => (/^src\//.test(f) ? 0 : /^tests\//.test(f) ? 1 : 2);
  const files = git(root, 'diff', '--name-only', base, head, ...spec).split('\n').filter(Boolean).sort((x, y) => order(x) - order(y));
  let body = '', left = [];
  for (const f of files) {
    const d = git(root, 'diff', base, head, '--', f);
    if (body.length + d.length > CAP) left.push(f); else body += d + '\n';
  }
  out.push(`## The diff (${files.length} files; left out: derived files, the backlog's tables and backlog/${id}.md, which claims shows after your draft)\n${stat}\n\n${body.trim()}` +
    (left.length ? `\n\n(cut at ${kb(CAP)}: read the rest with  git diff ${base} ${head} -- FILE : ${left.join(', ')})` : ''));
  out.push(`## Next\nWrite your draft findings to work/review/${id}.json; then  node tools/review.js claims ${id}  for the implementer's ticks and notes.`);
  return out.join('\n\n');
}

// ---- the findings file
function readFindings(root, id) {
  const f = path.join(root, 'work', 'review', id + '.json');
  if (!fs.existsSync(f)) return { error: `no draft findings: write work/review/${id}.json first (review.js --help gives its shape)` };
  try { const r = JSON.parse(fs.readFileSync(f, 'utf8')); return Array.isArray(r.findings) ? { r } : { error: 'the findings file has no "findings" list' }; }
  catch (e) { return { error: 'the findings file is not JSON: ' + e.message }; }
}

function checkFindings(r) {
  const errors = [], fs_ = r.findings, prefs = fs_.filter((f) => f.grade === 'preference').length;
  if (fs_.length > 10) errors.push(`${fs_.length} findings: at most 10`);
  if (prefs > 3) errors.push(`${prefs} preferences: at most 3`);
  const ids = new Set();
  for (const f of fs_) {
    const at = f.id || '(no id)';
    if (!f.id || ids.has(f.id)) errors.push(`${at}: an id of its own`); ids.add(f.id);
    if (!GRADES.includes(f.grade)) errors.push(`${at}: grade one of ${GRADES.join(', ')}`);
    if (!CATEGORIES.includes(f.category)) errors.push(`${at}: category one of ${CATEGORIES.join(', ')}`);
    for (const k of ['authority', 'place', 'check']) if (f.grade !== 'preference' && !f[k]) errors.push(`${at}: needs "${k}"`);
    if (f.grade === 'blocking') {
      if (!f.scenario) errors.push(`${at}: a blocking finding states its failing scenario`);
      const a = String(f.authority || '');
      if (/\bProposed\b|Under revision/i.test(a)) errors.push(`${at}: rests on a Proposed or Under revision point: advisory at most`);
      else if (!/criterion|Decided|Agreed|Principles for decisions|The game, in Kim's terms|AGENTS\.md|BACKLOG\.md|target-v2/i.test(a))
        errors.push(`${at}: a blocking finding quotes its authority: a criterion, a Decided or Agreed point (the principles are Decided), AGENTS.md, BACKLOG.md or target-v2 section 2`);
    }
  }
  const blocking = fs_.filter((f) => f.grade === 'blocking').length;
  return { errors, blocking, verdict: blocking ? 'revise' : 'pass' };
}

// ---- the command line
async function main(argv) {
  const opt = (k) => { const i = argv.indexOf(k); if (i < 0) return null; const v = argv[i + 1]; argv.splice(i, 2); return v; };
  const root = path.resolve(opt('--root') || path.join(__dirname, '..')), baseRef = opt('--base'), head = opt('--head') || 'HEAD';
  const [cmd, id] = argv;
  if (!['eligible', 'packet', 'claims', 'check'].includes(cmd)) throw new Error('a command: eligible, packet, claims, check (--help)');
  if (!/^VB-\d{3,}$/.test(id || '')) throw new Error('a task ID (VB-NNN)');
  let base = baseRef;
  if (!base && cmd !== 'check') {
    try { base = git(root, 'merge-base', head, 'origin/main'); } catch { throw new Error('no merge base with origin/main: name it, --base REF'); }
  }
  const short = (ref) => git(root, 'rev-parse', '--short', `${ref}^{commit}`);
  if (cmd === 'eligible') { const e = eligibility(root, id, short(base), short(head)); console.log(`${id}: ${e.arm}: ${e.why.join('; ')}`); return; }
  if (cmd === 'packet') { console.log(await packet(root, id, short(base), short(head))); return; }
  const { r, error } = readFindings(root, id);
  if (error) throw new Error(error);
  if (cmd === 'check') {
    const c = checkFindings(r);
    if (c.errors.length) { console.log(c.errors.map((e) => '- ' + e).join('\n')); process.exitCode = 1; return; }
    console.log(`${id} review: ${c.verdict}${c.blocking ? ` ${c.blocking} blocking` : ''}; ${r.findings.length - c.blocking} advisory or preference`); return;
  }
  // claims: what the implementer says it did, read after the draft
  const before = show(root, short(base), `backlog/${id}.md`), after = show(root, short(head), `backlog/${id}.md`) || '';
  const ticked = criteria(after).filter((l) => /^- \[x\]/.test(l)).length, all = criteria(after).length;
  console.log(`# The implementer's claims for ${id}: ${ticked} of ${all} criteria ticked\nCheck each against the code; a claim is not evidence.\n`);
  console.log(before == null ? after : git(root, 'diff', short(base), short(head), '--', `backlog/${id}.md`));
}

module.exports = { facts, checkFindings, fnv1a, CATEGORIES, GRADES };
if (require.main === module) main(process.argv.slice(2)).catch((e) => { console.error('review: ' + e.message); process.exitCode = 2; });
