// Periods of agent work (VB-1615): the log of changes that may move token use (docs/agents/changes.md) cuts time into periods, and the
// tasks measured in docs/agents/usage (as tools/usage-page.js's model sums them: a task is all its runs, continuations included) are
// compared period by period, in strata of run kind (sub-agent, session, orchestrator), size and model. A task belongs to the period its
// first run started in. A stratum with fewer than FEW tasks in a period is shown and marked, never compared.
// Quality comes from the backlog and git, not from the transcript, and some of it is a proxy (named so in the report):
//   done          the outcome the task's last run reported (sub-agents), else its status in the backlog now (a proxy for a session);
//   merge undone  the orchestrator undid the merge and said why in the result (a proxy, from the words of its summary);
//   reopened      a task named "Fix:" or "Mend..." opened within 7 days of the task's last run, whose file names it (a proxy);
//   ticked        criteria ticked of the criteria in its file now.
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');

const FEW = 5, REOPEN = 7 * 864e5;

// The rows of the log: [{ at (ms), when, change }], in time order; a row is a table row whose first cell is an ISO date (UTC).
function parseChanges(md) {
  return md.split('\n').map((l) => l.match(/^\|\s*(\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2})?Z?)?)\s*\|\s*([^|]*)\|/)).filter(Boolean)
    .map((m) => ({ at: Date.parse(/T/.test(m[1]) ? m[1].replace(/Z?$/, 'Z') : m[1] + 'T00:00Z'), when: m[1], change: m[2].trim() }))
    .filter((r) => Number.isFinite(r.at)).sort((a, b) => a.at - b.at);
}
// The periods the rows cut: before the first row, then one from each row to the next.
function periodsOf(changes) {
  const ps = [{ from: -Infinity, to: changes.length ? changes[0].at : Infinity, when: 'start', change: 'before the first logged change' }];
  changes.forEach((c, i) => ps.push({ from: c.at, to: i + 1 < changes.length ? changes[i + 1].at : Infinity, when: c.when, change: c.change }));
  return ps;
}

const quantile = (xs, p) => {
  const s = [...xs].sort((a, b) => a - b), i = (s.length - 1) * p, lo = Math.floor(i);
  return s[lo] + (s[Math.ceil(i)] - s[lo]) * (i - lo);
};
const stats = (xs) => (xs.length ? { n: xs.length, median: quantile(xs, 0.5), q1: quantile(xs, 0.25), q3: quantile(xs, 0.75) } : null);
const share = (xs) => (xs.length ? { n: xs.length, share: xs.filter(Boolean).length / xs.length } : null);
const num = (x) => (Number.isFinite(x) ? x : null);

// What a task file says now: its status, and its criteria ticked of all (before its notes).
function fileInfo(text) {
  const head = text.split(/^Notes:/m)[0];
  return { status: (text.match(/^Status: ([\w-]+)/m) || [])[1] || null, ticked: (head.match(/^\s*- \[x\]/gim) || []).length,
    criteria: (head.match(/^\s*- \[[ x]\]/gim) || []).length };
}
// The tasks named "Fix:" or "Mend..." with when their file was added: [{ id, at, text }]. One git call; [] outside a repository.
function fixes(root) {
  let log;
  try {
    log = execFileSync('git', ['log', '--diff-filter=A', '--format=%x00%aI', '--name-only', '--', 'backlog/'], {
      cwd: root, encoding: 'utf8', maxBuffer: 1 << 28,
      stdio: ['ignore', 'pipe', 'ignore'] });
  } catch (e) { return []; }
  const out = [];
  for (const chunk of log.split('\0').filter(Boolean)) {
    const [when, ...files] = chunk.split('\n').map((x) => x.trim()).filter(Boolean);
    for (const f of files) {
      const id = (f.match(/(VB-\d+)\.md$/) || [])[1];
      let text;
      try { text = fs.readFileSync(path.join(root, f), 'utf8'); } catch (e) { continue; }
      if (id && /^# VB-\d+: (Fix:|Mend)/m.test(text)) out.push({ id, at: Date.parse(when), text });
    }
  }
  const first = new Map(); // a file added twice (renumbered at a merge) counts once, when it was first added
  for (const f of out) if (!first.has(f.id) || f.at < first.get(f.id).at) first.set(f.id, f);
  return [...first.values()];
}

const MEASURES = [
  ['weighted', (t) => t.w, true], ['calls', (t) => t.calls], ['runs', (t) => t.runs], ['cacheReadShare', (t) => (t.w ? (0.1 * t.cr) / t.w : null)],
  ['peak', (t) => t.peak], ['boot', (t) => t.boot], ['repeats', (t) => t.repeats], ['repeatBytes', (t) => t.repeatBytes], ['testsFailed', (t) => t.testsFailed],
  ['streak', (t) => t.streak], ['handoverBytes', (t) => (t.continued ? t.handoverBytes : null)], ['reconstruct', (t) => (t.continued ? t.reconstruct : null)],
  ['compactions', (t) => t.compactions], ['ticked', (t) => (t.criteria ? t.ticked / t.criteria : null)],
  ['launchCalls', (t) => (t.launched ? t.launchCalls / t.launched : null)], // a session's calls to start each continuation (VB-1616)
];
const SHARES = [['done', (t) => t.done], ['continued', (t) => t.runs > 1], ['mergeUndone', (t) => t.mergeUndone], ['reopened', (t) => t.reopened],
  ['resetBoundary', (t) => (t.reasons ? t.reasons.includes('boundary') : null)], ['resetStuck', (t) => (t.reasons ? t.reasons.includes('stuck') : null)],
  ['resetCeiling', (t) => (t.reasons ? t.reasons.includes('ceiling') : null)]];

// data: tools/usage-page.js's model ({ tasks, sessions }); changes: parseChanges(); info(id): fileInfo() of its task file, or null;
// fixList: fixes(); from, to: ms or null, limiting the tasks by their start; peakFrom, peakUnder: tokens or null, limiting them by
// their peak context (orchestrators are kept).
function compare({ data, changes, info, fixList = [], from = null, to = null, peakFrom = null, peakUnder = null }) {
  const periods = periodsOf(changes).map((p) => ({ ...p, tasks: [], orchestrators: [] }));
  const at = (ms) => periods.find((p) => ms >= p.from && ms < p.to);
  const inRange = (ms) => Number.isFinite(ms) && (from == null || ms >= from) && (to == null || ms < to);
  for (const t of data.tasks) {
    const start = Date.parse(t.start || t.date), end = Date.parse(t.end || t.start || t.date);
    if (!inRange(start)) continue;
    // eligible for a reset (VB-1616): the task's peak context reached the threshold, the same rule in every period whether or not it reset
    if ((peakFrom != null && !(t.peak >= peakFrom)) || (peakUnder != null && !(t.peak < peakUnder))) continue;
    const file = info(t.id) || {}, status = t.statuses && t.statuses.length ? t.statuses[t.statuses.length - 1] : file.status;
    at(start).tasks.push({ ...t, status, done: status == null ? null : /^done/.test(status), ticked: file.ticked, criteria: file.criteria,
      reopened: fixList.some((f) => f.id !== t.id && f.at > end && f.at - end <= REOPEN && new RegExp(`\\b${t.id}\\b`).test(f.text)) });
  }
  for (const s of data.sessions.filter((x) => x.kind === 'orchestrator')) {
    const start = Date.parse(s.start || s.date);
    if (inRange(start)) at(start).orchestrators.push(s);
  }
  const out = periods.filter((p) => p.tasks.length || p.orchestrators.length).map((p) => {
    const groups = new Map();
    for (const t of p.tasks) {
      const key = `${t.src} ${t.size} ${t.model}`;
      groups.set(key, [...(groups.get(key) || []), t]);
    }
    const strata = [...groups].map(([key, ts]) => {
      const done = ts.filter((t) => t.done);
      return { key, kind: ts[0].src, size: ts[0].size, model: ts[0].model, n: ts.length, few: ts.length < FEW,
        measures: Object.fromEntries(MEASURES.map(([name, f, onlyDone]) => [name, stats((onlyDone ? done : ts).map(f).map(num).filter((x) => x != null))])),
        shares: Object.fromEntries(SHARES.map(([name, f]) => [name, share(ts.map(f).filter((x) => x != null))])) };
    }).sort((a, b) => a.key.localeCompare(b.key));
    const orch = new Map();
    for (const s of p.orchestrators) orch.set(s.model, [...(orch.get(s.model) || []), s]);
    for (const [model, ss] of orch) {
      strata.push({ key: `orchestrator - ${model}`, kind: 'orchestrator', size: '-', model, n: ss.length, few: ss.length < FEW,
        measures: { weighted: stats(ss.map((s) => s.w)), calls: stats(ss.map((s) => s.calls)), peak: stats(ss.map((s) => s.peak)),
          launchCalls: stats(ss.filter((s) => s.continuations && s.continuations.launched).map((s) => s.continuations.calls / s.continuations.launched)) },
        shares: {} });
    }
    return { from: Number.isFinite(p.from) ? new Date(p.from).toISOString() : null, to: Number.isFinite(p.to) ? new Date(p.to).toISOString() : null,
      when: p.when, change: p.change, tasks: p.tasks.length, strata };
  });
  // each stratum against the same stratum in the period before it that has one, when neither has too few
  out.forEach((p, i) => p.strata.forEach((s) => {
    let prev = null, against = null;
    for (let j = i - 1; j >= 0 && !prev; j--) { prev = out[j].strata.find((x) => x.key === s.key) || null; against = out[j].when; }
    const a = prev && prev.measures.weighted, b = s.measures.weighted;
    s.change = !s.few && prev && !prev.few && a && b && a.median ? { against, weighted: b.median / a.median - 1 } : null;
  }));
  return { few: FEW, periods: out };
}

const k = (n) => (n == null ? '-' : n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'k' : String(Math.round(n * 100) / 100));
const pct = (x) => (x == null ? '-' : Math.round(x * 100) + '%');
// The comparison as text: a block a period, a line a stratum.
function report(c) {
  const m = (s, name) => (s.measures[name] ? k(s.measures[name].median) : '-'), sh = (s, name) => (s.shares[name] ? pct(s.shares[name].share) : '-');
  return c.periods.map((p) => [`${p.when} to ${p.to ? p.to.slice(0, 16) + 'Z' : 'now'}: ${p.change} (${p.tasks} tasks)`,
    '  stratum                           n   done  weighted a done task [quartiles]  change  calls runs peak   boot   repeats fails reopened* reset b/s',
    ...p.strata.map((s) => {
      const w = s.measures.weighted;
      return `  ${(s.key + (s.few ? ' (few)' : '')).padEnd(32)} ${String(s.n).padStart(3)}  ${sh(s, 'done').padStart(4)}  `
        + `${(w ? `${k(w.median)} [${k(w.q1)}, ${k(w.q3)}]` : '-').padEnd(30)} ${(s.change ? (s.change.weighted >= 0 ? '+' : '') + pct(s.change.weighted) :
          '').padStart(6)}  `
        + `${m(s, 'calls').padStart(5)} ${m(s, 'runs').padStart(4)} ${m(s, 'peak').padStart(6)} ${m(s, 'boot').padStart(6)} ${m(s, 'repeats').padStart(7)} `
        + `${m(s, 'testsFailed').padStart(5)} ${sh(s,
          'reopened').padStart(8)}  ${s.kind === 'orchestrator' ? '' : `${sh(s, 'resetBoundary')}/${sh(s, 'resetStuck')}`}`;
    })].join('\n')).join('\n') +
      `\n* a proxy. Medians; a stratum with fewer than ${c.few} tasks is marked (few) and not compared; "change" is the median weighted cost of a`
    + ' done task against the same stratum in the period before it; a measure a period\'s files lack is "-"; reset b/s, the share of tasks with a'
    + ' voluntary reset at a boundary and when stuck (VB-1616).';
}

module.exports = { parseChanges, periodsOf, fileInfo, fixes, compare, report, FEW };
