// Lanes (VB-1678): which ready tasks may run side by side. A task's footprint is its `Touches:` line (docs/agents/tasks.md): the
// functions it will edit. Two tasks that edit different functions merge cleanly far more often than two that edit one file
// (docs/plans/VB-1677-conflicts.md: function level flags 41% fewer pairs than file level and misses no conflict), so the tool takes the
// ready tasks in order and holds back one that meets a task already taken or the work in flight: the run's inbox claims, and the
// branches pushed to origin and not merged into main, by the functions they edit (tools/lib/symbols.js).
// usage: node tools/lanes.js [N] [--size S|M|L] [--unattended] [--days D] [--no-flight] [--json]
//                              up to N tasks (default 4) to start now beside what runs, from `backlog.js next` (its order, --size and
//                              --unattended), and for each one held back, what it meets; in a run, N is the free places: the tasks the
//                              inbox has started are in flight by their Touches line and their claims, and never offered again
//        node tools/lanes.js --check VB-NNN [--days D]
//                              what in flight a task would meet, for a session that starts one by hand
//        node tools/lanes.js --measure VB-NNN BASE..TIP [--inbox]
//                              after a merge (BASE..TIP read from their merge base, as git's three dots; after `git merge --no-ff`,
//                              HEAD^1..HEAD^2): the declared footprint against the edits (recall: the edits it named; precision: what
//                              it named that was edited); --inbox leaves it as a `footprint` note for the night's report
// Rules: a plan or a wrap-up runs alone. A task without a footprint (no line, or `unknown (...)`) runs only beside tasks of other archs,
// the rule of before, and is listed so. The list and bookkeeping files, a module's imports, exports and head, and the tables marked
// `// @merge union` are no footprint: they merge by themselves (tools/merge.js) or are lists until VB-1406.
// It reads the branches as fetched: run `git fetch origin` first for the latest.
require('./help.js')(__filename);
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
const { parseTouches, fileOf } = require('./lib/touches.js');
const { ignored, symbolMap, editsBetween, overlap } = require('./lib/symbols.js');
const root = path.join(__dirname, '..');
const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); if (i < 0) return null; const v = args[i + 1]; args.splice(i, 2); return v; };
const flag = (k) => { const i = args.indexOf(k); if (i < 0) return false; args.splice(i, 1); return true; };
const check = opt('--check'), measure = flag('--measure'), days = +(opt('--days') || 3), size = opt('--size');
const unattended = flag('--unattended');
const json = flag('--json'), noFlight = flag('--no-flight'), toInbox = flag('--inbox');
const fail = (m) => { console.error('lanes: ' + m); process.exit(1); };
const git = (...a) => spawnSync('git', ['-C', root, ...a], { encoding: 'utf8', maxBuffer: 1 << 28 });

// ---- the tasks
const num = (id) => +id.slice(3);
function readTask(id) {
  const f = path.join(root, 'backlog', id + '.md');
  if (!fs.existsSync(f)) fail(`no task ${id}`);
  const text = fs.readFileSync(f, 'utf8'), field = (k) => ((text.match(new RegExp(`^${k}: (.*)$`, 'm')) || [])[1] || '').trim();
  return { id, name: (text.match(/^# VB-\d+: (.*)$/m) || [])[1] || '', status: field('Status').split(' ')[0], priority: +field('Priority') || 3,
    size: field('Size'), arch: field('Arch') || '-', touches: field('Touches') };
}
// the candidates, as `tools/backlog.js next` gives them (its order and its filters), but those this run's inbox has started already
function readyTasks(started) {
  const r = spawnSync(process.execPath, [path.join(__dirname, 'backlog.js'), 'next', '60', ...(size ? ['--size', size] : []),
    ...(unattended ? ['--unattended'] : [])], { cwd: root, encoding: 'utf8' });
  if (r.status) fail('backlog.js next: ' + (r.stderr || r.stdout).trim());
  return r.stdout.split('\n').map((l) => (/^(VB-\d+) P\d/.exec(l) || [])[1]).filter((id) => id && !started.has(id)).map(readTask);
}
// a task's footprint: Map(file -> Set(symbols, '*' the whole file)), or null when it has none
function footprint(t) {
  if (!t.touches || t.touches === '(to write)') return null;
  let p; try { p = parseTouches(t.touches); } catch { return null; }
  if (p.unknown) return null;
  const out = new Map();
  for (const it of p.items) {
    const file = fileOf(root, it.target);
    if (ignored(file)) continue;
    const marked = fs.existsSync(path.join(root, file)) ? symbolMap(fs.readFileSync(path.join(root, file), 'utf8')).marked : new Set();
    const names = it.created || !it.names.length ? ['*'] : it.names.filter((n) => !marked.has(n));
    if (!names.length) continue;
    out.set(file, new Set([...(out.get(file) || []), ...names]));
  }
  return out;
}
const show = (fp) => [...fp].map(([f, s]) => (s.has('*') ? f : `${f} (${[...s].join(', ')})`)).join('; ') || '(only parts that merge by themselves)';
const alone = (t) => /^(Plan|Wrap-up):/.test(t.name);

// ---- the work in flight: the inbox's claims, and the branches pushed and not merged into main
const started = new Set(); // the tasks this run's inbox has started, whatever became of them: never offered again the same night
const running = []; // the tasks running in this run: { t, fp } (fp null without a footprint), for the plan and the arch rules
function inFlight() {
  const out = [];
  const common = git('rev-parse', '--git-common-dir').stdout.trim(), db = path.resolve(root, common, 'vb-inbox.db');
  if (fs.existsSync(db)) { // read through inbox.js, the one reader of its tables
    const r = spawnSync(process.execPath, [path.join(__dirname, 'inbox.js'), 'flight'], { cwd: root, encoding: 'utf8' });
    if (r.status) fail('inbox.js flight: ' + (r.stderr || r.stdout).trim());
    const inbox = JSON.parse(r.stdout), byTask = new Map();
    for (const id of inbox.started) started.add(id);
    for (const id of inbox.running) { // a task running: its Touches line from the start, before its first claim
      if (!/^VB-\d+$/.test(id) || !fs.existsSync(path.join(root, 'backlog', id + '.md'))) continue;
      const t = readTask(id), fp = footprint(t);
      running.push({ t, fp });
      if (fp) byTask.set(id, fp);
    }
    for (const { file, task } of inbox.claims) {
      const m = /^(.*?):([A-Za-z_$][\w$]*)$/.exec(file), f = m ? m[1] : file, s = m ? m[2] : '*';
      if (ignored(f)) continue;
      const fp = byTask.get(task) || new Map(); fp.set(f, new Set([...(fp.get(f) || []), s])); byTask.set(task, fp);
    }
    for (const [task, fp] of byTask) out.push({ who: `${task} (running, in the inbox)`, task, fp });
  }
  if (noFlight) return out;
  const main = git('rev-parse', '--verify', '-q', 'origin/main').stdout.trim();
  if (!main) return out;
  const mine = git('rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}').stdout.trim();
  const since = Date.now() / 1000 - days * 86400;
  for (const line of git('for-each-ref', '--format=%(refname:short) %(committerdate:unix)', 'refs/remotes/origin/claude').stdout.trim().split('\n')) { // the agents' branches
    const [ref, t] = line.split(' ');
    if (!ref || +t < since || ['origin/main', 'origin/HEAD', 'origin', mine].includes(ref)) continue;
    if (git('merge-base', '--is-ancestor', ref, main).status === 0) continue; // merged
    const base = git('merge-base', ref, main).stdout.trim();
    if (!base) continue;
    let fp; try { fp = editsBetween(root, base, ref); } catch { continue; }
    if (fp.size) out.push({ who: ref, fp });
  }
  return out;
}

// ---- measure: the declared footprint against the edits
if (measure) {
  const id = args.find((a) => /^VB-\d+$/.test(a)), range = args.find((a) => a.includes('..'));
  if (!id || !range) fail('--measure VB-NNN BASE..TIP');
  const t = readTask(id), [from, tip] = range.split('..').map((x) => x || 'HEAD');
  // from the merge base of the two, as git's three dots: what TIP's side changed, not what BASE's side gained meanwhile
  const base = git('merge-base', from, tip).stdout.trim() || fail(`no merge base of ${from} and ${tip}`);
  const edited = editsBetween(root, base, tip), declared = footprint(t);
  const units = (fp) => [...fp].flatMap(([f, s]) => [...s].map((x) => [f, x]));
  const covers = (fp, f, s) => fp.has(f) && (fp.get(f).has('*') || fp.get(f).has(s) || s === '*');
  const eu = units(edited), du = declared ? units(declared) : [];
  const hit = eu.filter(([f, s]) => declared && covers(declared, f, s)), used = du.filter(([f, s]) => covers(edited, f, s));
  const recall = eu.length ? hit.length / eu.length : 1, precision = du.length ? used.length / du.length : declared ? 1 : 0;
  const r2 = (x) => Math.round(x * 100) / 100;
  const missed = eu.filter((u) => !hit.includes(u)).map(([f, s]) => (s === '*' ? f : `${f} (${s})`));
  const unused = du.filter((u) => !used.includes(u)).map(([f, s]) => (s === '*' ? f : `${f} (${s})`));
  console.log(`${id} footprint: ${declared ? `declared ${du.length}` : 'none declared'}, edited ${eu.length}; recall ${r2(recall)}, precision ${r2(precision)}`
    + (missed.length ? `\n  edited, not declared: ${missed.join('; ')}` : '') + (unused.length ? `\n  declared, not edited: ${unused.join('; ')}` : ''));
  if (toInbox) {
    const r = spawnSync(process.execPath, [path.join(__dirname, 'inbox.js'), 'note', id, 'footprint', `recall=${r2(recall)}`, `precision=${r2(precision)}`,
      `declared=${du.length}`, `edited=${eu.length}`], { cwd: root, encoding: 'utf8' });
    process.stdout.write(r.stdout + r.stderr);
    if (r.status) process.exit(r.status);
  }
  process.exit(0);
}

// ---- check: what in flight one task would meet
if (check) {
  const t = readTask(check), fp = footprint(t), flight = inFlight().filter((w) => w.task !== t.id);
  if (!fp) { console.log(`${t.id}: no footprint (${t.touches || 'no Touches: line'}): write its Touches: line (docs/agents/tasks.md) to check it`); process.exit(0); }
  const meets = flight.map((w) => [w.who, overlap(fp, w.fp)]).filter(([, o]) => o.length);
  console.log(`${t.id} touches ${show(fp)}`);
  console.log(meets.length ? meets.map(([w, o]) => `  meets ${w}: ${o.join('; ')}`).join('\n') : `  nothing in flight meets it (${flight.length} in flight)`);
  process.exit(meets.length ? 1 : 0);
}

// ---- lanes: up to N ready tasks side by side
const n = +(args[0] || 4);
if (!(n > 0)) fail('N is a count of tasks (--help)');
const flight = inFlight(), taken = [], held = [];
const runningAlone = running.find((r) => alone(r.t));
for (const t of runningAlone ? [] : readyTasks(started)) {
  if (taken.length >= n) break;
  if (alone(t)) { // alone: nothing taken and nothing running in this run
    if (!taken.length && !running.length) { taken.push({ t, fp: footprint(t), why: 'a plan or a wrap-up: alone' }); break; }
    held.push({ t, why: `a plan or a wrap-up runs alone (${running.length} running, ${taken.length} taken)` }); continue;
  }
  const fp = footprint(t), why = [];
  // the arch rule, where one of two has no footprint: against the tasks taken and those running
  for (const o of [...running.map((r) => ({ ...r, who: `${r.t.id} (running, in the inbox)` })), ...taken.map((x) => ({ ...x, who: x.t.id }))]) {
    if ((!fp || !o.fp) && t.arch === o.t.arch) why.push(`${o.who}, of its arch (${t.arch}), and one of them has no footprint`);
    else if (fp && o.fp && !o.who.includes('running')) { const x = overlap(fp, o.fp); if (x.length) why.push(`${o.who} at ${x.join('; ')}`); }
  }
  if (fp) for (const w of flight) { const x = overlap(fp, w.fp); if (x.length) why.push(`${w.who} at ${x.join('; ')}`); }
  if (why.length) held.push({ t, why: 'meets ' + why.join(', ') });
  else taken.push({ t, fp, why: fp ? show(fp) : `no footprint: beside other archs only (${t.touches || 'no Touches: line'})` });
}
if (json) { console.log(JSON.stringify({ take: taken.map((x) => ({ id: x.t.id, size: x.t.size, why: x.why })), hold: held.map((x) => ({ id: x.t.id, why: x.why })), inFlight: flight.map((w) => w.who),
  running: running.map((r) => r.t.id), alone: runningAlone ? runningAlone.t.id : null }, null, 1)); process.exit(0); }
if (runningAlone) console.log(`${runningAlone.t.id} is running, a plan or a wrap-up: it runs alone, so nothing is taken`);
console.log(`${flight.length} in flight${noFlight ? ' (the inbox only)' : ` (the inbox and the branches pushed in ${days} days, not merged)`}`);
for (const x of taken) console.log(`take ${x.t.id} ${x.t.size} ${x.t.name}\n     ${x.why}`);
for (const x of held) console.log(`hold ${x.t.id}: ${x.why}`);
