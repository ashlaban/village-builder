// Roadmap: writes docs/roadmap.html, the page of what was built when and when the rest may be done, from the backlog and git.
// The Pages workflow runs it before its Jekyll step; the page is derived and never committed (as index.html is not).
// Usage: node tools/roadmap.js [--out FILE] [--today YYYY-MM-DD] [--json]
//   --out FILE    the page to write (default docs/roadmap.html)
//   --today DATE  the day the page is as of (default the date of the last commit)
//   --json        print the data the page is drawn from, and write nothing
// Reads: the task files in backlog/ (status, arch, name, priority, size), the Archs tables of BACKLOG.md and BACKLOG_ARCHIVE.md (which archs are
// slices, and their order), and `git log -p` of the backlog (the day each task first appeared, and the day a task without a date in
// its Status line was marked done; the open and the done tasks by size at the end of each day). Needs the full history: in a shallow clone the earliest tasks take the clone's first day.
// The estimate is the tool's, from the backlog's history (design.md, Principles for decisions: it says whose estimate it is):
//   pace    tasks done on a full day (10 or more), times the share of full days, over the last 14 days and over all days;
//   growth  a plan writes its arch's tasks and more follow: the middle half of total / size at the plan, over slices planned 5 or
//           more days ago; an arch whose plan is still open counts as the middle half of the planned slices' sizes, grown so;
//   order   the slices in the order of the Archs table (Kim's), each side arch before the first slice that began after it, side
//           archs not begun before the last slice; tasks with no arch are done alongside, in proportion.
// Kim's decisions marked on the axis are the list KIM below, kept by hand.
require('./help.js')(__filename);
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');

const KIM = [
  ['2026-10-29', 'Design v0.1'],
  ['2026-11-03', 'target-v2 the architecture; ten slices replace the first archs; the budget and the ten rules'],
  ['2026-11-07', 'medium-ref: the late reference'],
  ['2026-11-09', 'The gameplay review: marriage as a negotiation, the chronicle'],
  ['2026-11-10', 'Hard checks and soft targets'],
  ['2026-11-12', 'Principles for deciding without Kim'],
  ['2026-11-14', 'Nothing teleports'],
  ['2026-11-16', 'Every act is a pawn’s; the ship last of all'],
];
const FULL_DAY = 10, MATURE_DAYS = 5;

// ---- reading the backlog and git
const archRows = (text, heading) => {
  const at = text.indexOf('\n## ' + heading);
  if (at < 0) return [];
  const rows = [];
  for (const l of text.slice(at + 1).split('\n').slice(1)) {
    if (l.startsWith('## ')) break;
    const m = l.match(/^\| ([\w-]+) \| ([^|]+) \|/);
    if (m && m[1] !== 'Key') rows.push({ key: m[1], name: m[2].trim() });
  }
  return rows;
};
// One task file's header: name, arch, status, priority, size, and whether and when it was done.
function parseTask(id, t) {
  const status = (t.match(/^Status: (.*)$/m) || [])[1] || '';
  return { id, name: (t.match(/^# VB-\d+: (.*)$/m) || [])[1] || '', arch: (t.match(/^Arch: (\S+)/m) || [])[1] || '-',
    done: status.startsWith('done'), doneDate: (status.match(/done \((\d{4}-\d\d-\d\d)/) || [])[1] || null,
    status: status.split(' ')[0], priority: (t.match(/^Priority: (\S+)/m) || [])[1] || '', size: (t.match(/^Size: (\S+)/m) || [])[1] || '' };
}
function readBacklog(root) {
  const tasks = [];
  for (const f of fs.readdirSync(path.join(root, 'backlog')).filter((f) => /^VB-\d+\.md$/.test(f)).sort((a, b) => parseInt(a.slice(3)) - parseInt(b.slice(3))))
    tasks.push(parseTask(f.slice(0, -3), fs.readFileSync(path.join(root, 'backlog', f), 'utf8')));
  const open = archRows(fs.readFileSync(path.join(root, 'BACKLOG.md'), 'utf8'), 'Archs');
  const closed = archRows(fs.readFileSync(path.join(root, 'BACKLOG_ARCHIVE.md'), 'utf8'), 'Closed archs');
  return { tasks, open, closed };
}
// One pass over the backlog's history: the first day each ID appears in an added line, and the day `Status: done` was added to a task file.
function gitDates(root) {
  const git = (...a) => execFileSync('git', a, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 30 });
  let shallow = false;
  try { shallow = git('rev-parse', '--is-shallow-repository').trim() === 'true'; } catch (e) { return { created: {}, done: {}, last: null, shallow: false, git: false }; }
  const log = git('log', '--reverse', '-m', '--format=@@%ad', '--date=short', '-p', '--unified=0', '--', 'BACKLOG.md', 'backlog/');
  const created = {}, done = {};
  let day = null, file = null;
  for (const l of log.split('\n')) {
    if (l.startsWith('@@2')) { day = l.slice(2); continue; }
    if (l.startsWith('+++ ')) { file = (l.match(/backlog\/(VB-\d+)\.md$/) || [])[1] || null; continue; }
    if (l[0] !== '+') continue;
    for (const m of l.matchAll(/VB-\d+/g)) if (!created[m[0]]) created[m[0]] = day;
    if (file && !done[file] && l.startsWith('+Status: done')) done[file] = day;
  }
  return { created, done, last: git('log', '-1', '--format=%ad', '--date=short').trim(), shallow, git: true };
}
// The backlog as it stood at the end of each day with a commit to backlog/ (the last such commit of the day on the first-parent line):
// [{day, total: {S, M, L}, done: {S, M, L}}], the open and the done tasks by size, through sizeMix. Done tasks keep their files in
// backlog/ (BACKLOG_ARCHIVE.md only indexes them), so the files alone give both. Each task file version is read once (`git cat-file --batch`).
function gitSizeHistory(root) {
  const git = (a, input) => execFileSync('git', a, { cwd: root, input, maxBuffer: 1 << 30 });
  const days = new Map();
  for (const l of git(['log', '--first-parent', '--format=%H %ad', '--date=short', 'HEAD', '--', 'backlog/']).toString().trim().split('\n'))
    if (l) { const [h, d] = l.split(' '); if (!days.has(d)) days.set(d, h); }
  const snaps = [...days].sort((a, b) => a[0].localeCompare(b[0])).map(([day, h]) => ({ day, files: git(['ls-tree', h, 'backlog/']).toString().split('\n')
    .map((l) => l.match(/^\d+ blob (\w+)\tbacklog\/(VB-\d+)\.md$/)).filter(Boolean).map((m) => [m[2], m[1]]) }));
  const blobs = [...new Set(snaps.flatMap((s) => s.files.map((f) => f[1])))], text = {};
  if (blobs.length) {
    const out = git(['cat-file', '--batch'], blobs.join('\n') + '\n');
    for (let at = 0; at < out.length; ) {
      const nl = out.indexOf(10, at), [sha, , size] = out.toString('utf8', at, nl).split(' ');
      text[sha] = out.toString('utf8', nl + 1, nl + 1 + +size); at = nl + 1 + +size + 1;
    }
  }
  return snaps.map((s) => { const m = sizeMix(s.files.map(([id, sha]) => parseTask(id, text[sha] || ''))); return { day: s.day, total: m.total, done: m.done }; });
}
// The open and the done tasks by size on each day from day0, N days, {sizes, open: [], done: []}: each day takes the last snapshot
// on or before it, null before the first.
function sizeHistory(snaps, day0, N) {
  const idx = dayIndex(day0), sorted = [...snaps].sort((a, b) => a.day.localeCompare(b.day));
  const seen = new Set(snaps.flatMap((s) => [...Object.keys(s.total), ...Object.keys(s.done || {})]));
  const sizes = [...['S', 'M', 'L'].filter((z) => seen.has(z)), ...[...seen].filter((z) => !['S', 'M', 'L'].includes(z)).sort()];
  const open = Array(N).fill(null), done = Array(N).fill(null), pick = (o) => Object.fromEntries(sizes.map((z) => [z, (o || {})[z] || 0]));
  let j = -1;
  for (let i = 0; i < N; i++) {
    while (j + 1 < sorted.length && idx(sorted[j + 1].day) <= i) j++;
    if (j >= 0) { open[i] = pick(sorted[j].total); done[i] = pick(sorted[j].done); }
  }
  return { sizes, open, done };
}

// The open tasks by size, against their status and their priority: {sizes, total, status: {ready: {S, M, L}}, priority: {P1: {...}}},
// and the done tasks by size, done: {S, M, L} (its own sizes, in the same order).
// A task with no size or priority counts under '?'; the statuses and priorities are listed in a fixed order, then any others.
function sizeMix(tasks) {
  const open = tasks.filter((t) => !t.done), order = (seen, first) => [...first.filter((k) => seen.has(k)), ...[...seen].filter((k) => !first.includes(k)).sort()];
  const size = (t) => t.size || '?', sizes = order(new Set(open.map(size)), ['S', 'M', 'L']);
  const by = (key, first) => {
    const keys = order(new Set(open.map(key)), first), out = {};
    for (const k of keys) out[k] = Object.fromEntries(sizes.map((z) => [z, open.filter((t) => key(t) === k && size(t) === z).length]));
    return out;
  };
  return { sizes, total: Object.fromEntries(sizes.map((z) => [z, open.filter((t) => size(t) === z).length])),
    done: Object.fromEntries(order(new Set(tasks.filter((t) => t.done).map(size)), ['S', 'M', 'L']).map((z) => [z, tasks.filter((t) => t.done && size(t) === z).length])),
    status: by((t) => t.status || '?', ['ready', 'blocked', 'needs-review']), priority: by((t) => (t.priority ? 'P' + t.priority : '?'), ['P1', 'P2', 'P3']) };
}

// ---- the model: a pure function of the tasks, the archs and the day
const DAY = 864e5;
const dayIndex = (d0) => (d) => Math.round((Date.parse(d) - Date.parse(d0)) / DAY);
const addDays = (d, n) => new Date(Date.parse(d) + Math.ceil(n) * DAY).toISOString().slice(0, 10);
const quantile = (a, p) => { a = [...a].sort((x, y) => x - y); if (!a.length) return 0; const i = (a.length - 1) * p, f = Math.floor(i); return a[f] + (a[Math.ceil(i)] - a[f]) * (i - f); };
const sliceNo = (name) => { const m = name.match(/^Slice (\d+):\s*(.*)$/); return m ? { n: +m[1], label: `${m[1]} · ${m[2][0].toUpperCase()}${m[2].slice(1)}` } : null; };

// tasks: [{id, name, arch, done, created, doneDate}]; open, closed: the Archs tables' rows in order; today: YYYY-MM-DD
function model({ tasks, open, closed, today, kim = KIM, sizeSnaps = [] }) {
  const dated = tasks.filter((t) => t.created);
  const day0 = dated.map((t) => t.created).sort()[0] || today, idx = dayIndex(day0), N = idx(today) + 1;
  // which archs are slices, side archs, or the first archs folded into one row
  const slicesOpen = open.filter((a) => sliceNo(a.name)).map((a) => ({ ...a, ...sliceNo(a.name) }));
  const slicesClosed = closed.filter((a) => sliceNo(a.name)).map((a) => ({ ...a, ...sliceNo(a.name) }));
  const slices = [];
  for (const s of slicesOpen) { for (const c of slicesClosed.filter((c) => c.n < s.n && !slices.includes(c))) slices.push(c); slices.push(s); }
  for (const c of slicesClosed) if (!slices.includes(c)) slices.push(c);
  const side = open.filter((a) => !sliceNo(a.name)).map((a) => ({ ...a, label: a.name }));
  const firstKeys = closed.filter((a) => !sliceNo(a.name)).map((a) => a.key);
  const keyOf = (t) => (firstKeys.includes(t.arch) ? 'first' : t.arch);
  const zeros = () => Array(N).fill(0);
  const per = {}, all = { c: zeros(), d: zeros() };
  for (const t of tasks) {
    const k = keyOf(t), p = (per[k] = per[k] || { c: zeros(), d: zeros() });
    const ci = t.created ? idx(t.created) : -1, di = t.done && t.doneDate ? idx(t.doneDate) : -1;
    if (ci >= 0 && ci < N) { p.c[ci]++; all.c[ci]++; }
    if (di >= 0 && di < N) { p.d[di]++; all.d[di]++; }
  }
  // pace
  const lastDays = all.d.slice(-14), full = lastDays.filter((v) => v >= FULL_DAY);
  const paceFull = full.length ? full.reduce((a, b) => a + b, 0) / full.length : 0;
  const share14 = full.length / lastDays.length, shareAll = all.d.filter((v) => v >= FULL_DAY).length / N;
  const rate = [paceFull * Math.min(share14, shareAll), paceFull * Math.max(share14, shareAll)];
  // each arch: its plan, its start, its size then and now
  const info = {};
  for (const a of [...slices, ...side]) {
    const ts = tasks.filter((t) => t.arch === a.key), isPlan = (t) => /^Plan:/.test(t.name);
    const plans = ts.filter((t) => isPlan(t) && t.done && t.doneDate).map((t) => t.doneDate).sort();
    const firstDone = ts.filter((t) => t.done && t.doneDate).map((t) => t.doneDate).sort()[0] || null;
    const plan = plans[0] || null, start = [plan, firstDone].filter(Boolean).sort()[0] || null;
    const planPending = !plan && ts.some((t) => isPlan(t) && !t.done), built = ts.some((t) => !/^(Plan|Wrap-up):/.test(t.name));
    const base = plan || (built && !planPending ? ts.map((t) => t.created).filter(Boolean).sort()[0] : null);
    info[a.key] = { plan, start, total: ts.length, done: ts.filter((t) => t.done).length, atPlan: base ? ts.filter((t) => t.created && t.created <= base).length : null };
  }
  const mature = slices.filter((s) => info[s.key].plan && idx(info[s.key].plan) <= N - 1 - MATURE_DAYS && info[s.key].atPlan);
  const growth = mature.map((s) => info[s.key].total / info[s.key].atPlan), gLo = quantile(growth, 0.25) || 1, gHi = quantile(growth, 0.75) || 1;
  const sizes = slices.filter((s) => info[s.key].plan && info[s.key].atPlan).map((s) => info[s.key].atPlan);
  const sizeLo = quantile(sizes, 0.25) * gLo, sizeHi = quantile(sizes, 0.75) * gHi;
  const rem = {};
  for (const [k, i] of Object.entries(info)) {
    const openN = i.total - i.done;
    if (!openN) rem[k] = [0, 0];
    else if (i.atPlan == null) rem[k] = [Math.max(openN, sizeLo), Math.max(openN, sizeHi)];
    else rem[k] = [Math.max(i.total, i.atPlan * gLo) - i.done, Math.max(i.total * 1.1, i.atPlan * gHi) - i.done];
  }
  // the order of work
  const st = (k) => info[k].start || '9999-99-99', pending = side.map((a) => a.key), order = [];
  const sortPending = () => pending.sort((a, b) => st(a).localeCompare(st(b)));
  slices.forEach((s, i) => {
    sortPending();
    if (i === slices.length - 1) order.push(...pending.splice(0));
    else while (pending.length && info[pending[0]].start && st(pending[0]) < st(s.key)) order.push(pending.shift());
    order.push(s.key);
  });
  order.push(...pending.splice(0));
  // tasks with no arch, and the finish of each arch
  const none = tasks.filter((t) => keyOf(t) === '-'), noneOpen = none.filter((t) => !t.done).length;
  rem['-'] = [noneOpen * gLo, noneOpen * gHi];
  const seq = (j) => order.reduce((a, k) => a + rem[k][j], 0);
  const spread = [seq(0) ? 1 + rem['-'][0] / seq(0) : 1, seq(1) ? 1 + rem['-'][1] / seq(1) : 1];
  const est = {};
  let lo = 0, hi = 0;
  for (const k of order) {
    lo += rem[k][0]; hi += rem[k][1];
    if (info[k].total > info[k].done && rate[0] > 0) est[k] = [addDays(today, (lo * spread[0]) / rate[1]), addDays(today, (hi * spread[1]) / rate[0])];
  }
  const ends = Object.values(est);
  const finish = ends.length ? [ends.map((e) => e[0]).sort().at(-1), ends.map((e) => e[1]).sort().at(-1)] : null;
  if (finish && noneOpen) est['-'] = finish;
  const doneN = tasks.filter((t) => t.done).length;
  const scope = [doneN + seq(0) + rem['-'][0], doneN + seq(1) + rem['-'][1]];
  const names = { first: `The first archs (${firstKeys.length})`, '-': 'No arch' };
  for (const a of [...slices, ...side]) names[a.key] = a.label;
  return { day0, today, N, per, all, rate, paceFull, share14, shareAll, gLo, gHi, sizeLo, sizeHi, info, rem, est, finish, scope, order,
    slices: slices.map((s) => s.key), side: side.map((a) => a.key), names, kim, mix: sizeMix(tasks), bySize: sizeHistory(sizeSnaps, day0, N), created: dated.length, done: doneN, undated: tasks.filter((t) => !t.created).length };
}

// ---- main
if (require.main === module) {
  const root = path.join(__dirname, '..'), args = process.argv.slice(2);
  const opt = (k, d) => { const i = args.indexOf(k); return i < 0 ? d : args[i + 1]; };
  const { tasks, open, closed } = readBacklog(root), g = gitDates(root);
  if (!g.git) { console.error('roadmap: not a git repository; the page needs the backlog\'s history'); process.exit(1); }
  if (g.shallow) console.error('roadmap: a shallow clone: tasks older than the clone take its first day (fetch with --unshallow, or fetch-depth: 0)');
  for (const t of tasks) { t.created = g.created[t.id] || null; if (t.done && !t.doneDate) t.doneDate = g.done[t.id] || null; }
  const data = model({ tasks, open, closed, today: opt('--today', g.last), sizeSnaps: gitSizeHistory(root) });
  if (args.includes('--json')) { console.log(JSON.stringify(data)); process.exit(0); }
  const page = fs.readFileSync(path.join(__dirname, 'lib', 'roadmap-page.html'), 'utf8').replace('/*DATA*/', () => JSON.stringify(data));
  const out = path.resolve(root, opt('--out', 'docs/roadmap.html'));
  fs.writeFileSync(out, page);
  console.log(`roadmap: ${path.relative(root, out)}, as of ${data.today}: ${data.done} of ${data.created} tasks done; all done ${data.finish ? data.finish.join(' to ') : 'not estimated'} (est.)`);
}
module.exports = { model, sizeMix, sizeHistory, gitSizeHistory, parseTask, readBacklog, gitDates, KIM };
