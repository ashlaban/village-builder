// The offline estimate of VB-1615: what a voluntary context reset at T tokens could save against the 120-call ceiling alone, from the
// measured runs, before any agent is changed. An upper bound on cost that says nothing of quality:
// - a run's context is its measured curve (context.series, VB-1615) or, in a file from before that, a straight line from first to peak;
// - a call costs 0.1 × the context it reads from the cache + 1.25 × what it adds; output is the same either way and left out;
// - a reset (at the ceiling, every CEILING calls of a run, or voluntarily: context at T or over, the run's VOLUNTARY_FROM-th call or later,
//   at least MIN_LEFT calls of work left, once a task) starts a fresh context of the run's first call + H of handover, written to the
//   cache (the first call's prefix is cached across agents), then R calls of reading again, each adding the run's mean growth a call;
//   the work left goes on adding what it added in the run;
// - a reset may come at any call once over T: the real ones wait for a boundary, so the bound is generous.
const CEILING = 120, VOLUNTARY_FROM = 30, MIN_LEFT = 20;

// The context at calls 1..n, from first, the series' points and peak.
function curve(run) {
  const n = run.calls, pts = [[1, run.first]];
  for (const [c, x] of run.series || []) if (c > 1 && c <= n) pts.push([c, x]);
  if (pts[pts.length - 1][0] < n) pts.push([n, run.series && run.series.length ? pts[pts.length - 1][1] : run.peak]);
  const out = [];
  for (let k = 1, j = 0; k <= n; k++) {
    while (j + 1 < pts.length - 1 && pts[j + 1][0] < k) j++;
    const [a, x] = pts[j], [b, y] = pts[Math.min(j + 1, pts.length - 1)];
    out.push(b === a ? x : x + ((y - x) * (k - a)) / (b - a));
  }
  return out;
}

// The modelled cost of a run, and its resets, under a policy: { T } (null for the ceiling alone), H, R.
function simulate(ctx, { T = null, H, R }) {
  const n = ctx.length, first = ctx[0], g = n > 1 ? Math.max(0, (ctx[n - 1] - first) / (n - 1)) : 0;
  let cost = 0, now = first, since = 0, voluntary = 0, resets = 0;
  const reset = () => {
    resets++; since = 0;
    cost += 0.1 * first + 1.25 * H; now = first + H; // the new context, written once
    for (let r = 0; r < R; r++) { cost += 0.1 * now + 1.25 * g; now += g; since++; } // reading again
  };
  for (let k = 0; k < n; k++) {
    const add = k ? Math.max(0, ctx[k] - ctx[k - 1]) : 0;
    if (since >= CEILING) reset();
    else if (T != null && !voluntary && now >= T && since >= VOLUNTARY_FROM && n - k >= MIN_LEFT) { voluntary++; reset(); }
    cost += 0.1 * now + 1.25 * add; now += add; since++;
  }
  return { cost, resets, voluntary };
}

// runs: [{ calls, first, peak, series, weighted }]; the grid of T, H and R. The saving is a share of the runs' measured weighted cost.
function estimate(runs, { Ts = [100e3, 130e3, 160e3, 200e3], Hs = [5e3, 15e3, 30e3], Rs = [0, 6, 15] } = {}) {
  const ok = runs.filter((r) => r.calls > 1 && r.first && r.peak), curves = ok.map(curve), total = ok.reduce((a, r) => a + (r.weighted || 0), 0);
  const rows = [];
  for (const T of Ts) for (const H of Hs) for (const R of Rs) {
    let saved = 0, reset = 0;
    curves.forEach((c) => { const a = simulate(c, { H, R }), b = simulate(c, { T, H, R }); saved += a.cost - b.cost; if (b.voluntary) reset++; });
    rows.push({ T, H, R, saved: Math.round(saved), share: total ? saved / total : 0, reset, resetShare: ok.length ? reset / ok.length : 0 });
  }
  return { runs: ok.length, withSeries: ok.filter((r) => r.series && r.series.length).length, total, rows };
}

// The runs of the usage files that do a task's work: each sub-agent, and each session with no sub-agents (not an orchestrator).
const runsOf = (files, from = null) => files.flatMap((f) => (f.subagents && f.subagents.length
  ? f.subagents.map((s) => ({ start: s.start, calls: s.calls, first: s.first, peak: s.peak, series: s.series, weighted: s.weighted }))
  : [{ start: f.start, calls: f.calls, first: f.context && f.context.first, peak: f.context && f.context.peak, series: f.context && f.context.series,
    weighted: f.weighted }])).filter((r) => !from || Date.parse(r.start) >= from);

function report(e) {
  const k = (x) => (x >= 1e6 ? (x / 1e6).toFixed(2) + 'M' : Math.round(x / 1e3) + 'k'), pct = (x) => (x * 100).toFixed(1) + '%';
  return [`${e.runs} runs (${e.withSeries} with a measured curve, the rest a straight line), ${k(
    e.total)} weighted; a voluntary reset at T against the ceiling alone:`,
    '  T      handover  re-read  saved     of all   runs reset',
    ...e.rows.map((r) => `  ${k(r.T).padEnd(6)} ${k(r.H).padStart(8)} ${String(r.R).padStart(8)}  ${(r.saved < 0 ? '-' : '') + k(Math.abs(r.saved))}`.padEnd(37)
      + `${pct(r.share).padStart(7)}   ${r.reset} (${pct(r.resetShare)})`),
    'An upper bound on cost (tools/lib/reset-estimate.js): a reset at any call once over T, with knowledge of the calls left; it says nothing of quality.'].join('\n');
}

module.exports = { curve, simulate, estimate, runsOf, report, CEILING };
