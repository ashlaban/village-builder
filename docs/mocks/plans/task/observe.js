// A throwaway observer for Study A of the plans mocks (P3, P4): it steps a real run a 6-minute step at a time, as docs/mocks/blocks/mock.js
// does, reads st and writes nothing to it. It records, at every task begun (a change of agent.job), the kind, the pawn's distance in hex steps
// to the site, to home and to the site of its previous task that day; the walking hours by kind (0.1 h a step with a path and a job); the leg
// ends a pawn-day (a change of agent.leg: where `next` would be asked); and, offline, the walking saved by re-ordering each pawn-day's run of
// tasks of one urgency class by nearest-next (straight hex distance times the run's mean hours a step).
// node docs/mocks/plans/task/observe.js [--scenario populous] [--seed 7] [--map small] [--from 1] [--years 1] [--json FILE]
const path = require('path'), fs = require('fs'), root = path.join(__dirname, '../../../..');
const VB = require(path.join(root, 'src/load.js')), G = VB.gen, Sim = VB.sim;
const { KINDS } = VB['sim/kinds'], { TICKS, DAY } = VB['sim/rules'], { here, tileAt } = VB['sim/pose'];
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i >= 0 ? process.argv[i + 1] : d; };
const SIZES = { tiny: [120, 85], small: [180, 130], medium: [280, 200] };
const scenario = arg('scenario', 'populous'), seed = Number(arg('seed', 7)), map = arg('map', 'small');
const from = Number(arg('from', 1)), years = Number(arg('years', 1)), out = arg('json', null);
const t0 = Date.now();
const it = G.generate(seed, { cols: SIZES[map][0], rows: SIZES[map][1] }); let r; while (!(r = it.next()).done);
const st = Sim.seed(r.value, seed, scenario), STEP = 1 / TICKS, DAYS = Sim.YEAR / DAY;
const COLS = st.w.COLS;
const ax = (t) => { const row = Math.floor(t / COLS), col = t % COLS; return [col - ((row - (row & 1)) >> 1), row]; };
const dist = (a, b) => { if (a < 0 || b < 0 || a == null || b == null) return NaN; const [q1, r1] = ax(a), [q2, r2] = ax(b), dq = q1 - q2, dr = r1 - r2; return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2; };
const homeOf = (id) => { const p = st.pawns[id], hh = p.household !== null ? st.households[p.household] : null; return hh && hh.farmstead !== null ? st.farmsteads[hh.farmstead].house : null; };
const cls = (K) => (K.vital ? 'vital' : K.window ? 'window' : 'other');

for (let y = 0; y < from; y++) for (let d = 0; d < DAYS; d++) for (let k = 0; k < DAY * TICKS; k++) Sim.advance(st, STEP);
const tSkip = Date.now() - t0;

const prev = new Map(), firstSeen = new Map(), walks = new Map();
const tasks = [], walkH = {}, walkLeg = { h: 0, steps: 0, n: 0 };
const n = { pawnDays: 0, workPawnDays: 0, legEnds: 0, legEndsInTask: 0, steps: 0 };
let dayWorkers = new Set();
for (let y = 0; y < years; y++) for (let d = 0; d < DAYS; d++) {
  n.pawnDays += st.living.length; dayWorkers = new Set();
  const lastSite = new Map();
  for (let k = 0; k < DAY * TICKS; k++) {
    Sim.advance(st, STEP); n.steps++;
    if (k % TICKS === 0) for (const j of st.jobs.values()) if (!firstSeen.has(j)) firstSeen.set(j, st.t);
    for (const id of st.living) {
      const a = st.agents[id], p = prev.get(id) || {}, ls = a.leg ? a.leg.kind + ':' + a.leg.t : null;
      if (p.ls !== undefined && p.ls !== ls && p.ls !== null) { n.legEnds++; if (p.job) n.legEndsInTask++; }
      if (a.job && a.job !== p.job) {
        const j = a.job, K = KINDS[j.kind] || {}, home = homeOf(id), at = here(st, a);
        const site = K.inside ? home : j.site ?? (j.farm ? j.farm.house : null);
        if (!firstSeen.has(j)) firstSeen.set(j, st.t);
        tasks.push({ id, day: y * DAYS + d, t: st.t, kind: j.kind, cls: cls(K), carry: !!K.carry, at, site, home,
          dSite: dist(at, site), dHome: dist(at, home), dPrev: lastSite.has(id) ? dist(at, lastSite.get(id)) : null,
          seen: firstSeen.get(j) });
        lastSite.set(id, site); dayWorkers.add(id);
      }
      // walks with a job: straight distance of the walk against its hours, for the mean hours a step
      if (a.path && a.job) walkH[a.job.kind] = (walkH[a.job.kind] || 0) + STEP;
      const w = walks.get(id);
      if (w && w.path !== a.path) { walkLeg.h += st.t - w.t; walkLeg.steps += w.d; walkLeg.n++; walks.delete(id); }
      if (a.path && a.job && !walks.has(id)) { const e = a.path[a.path.length - 1]; walks.set(id, { path: a.path, t: st.t, d: dist(here(st, a), tileAt(st, e[0], e[1])) }); }
      prev.set(id, { job: a.job, ls });
    }
  }
  n.workPawnDays += dayWorkers.size;
}
const secs = (Date.now() - t0) / 1000, hPerStep = walkLeg.h / walkLeg.steps;

// P3: tasks away from home begun within one step of the site (or of the previous task's site that day)
const away = tasks.filter((t) => t.site != null && t.home != null && t.site !== t.home && Number.isFinite(t.dSite));
const besideBy = {};
for (const t of away) { const b = (besideBy[t.kind] ||= [0, 0]); b[1]++; if (t.dSite <= 1) b[0]++; }
const beside = away.filter((t) => t.dSite <= 1).length, besidePrev = away.filter((t) => t.dSite <= 1 || (t.dPrev !== null && t.dPrev <= 1 && t.dSite <= 2)).length;
// Offline re-ordering: a pawn-day's consecutive tasks of one class, greedy nearest-next among those already posted when the slot begins.
// The approach walk to task i is dist(end of the one before, site i); a carrying task ends at home, any other at its site.
const byKind = {}; let base = 0, best = 0, runs = 0, runs2 = 0, inRuns2 = 0;
const groups = new Map();
for (const t of tasks) { const k = t.id + ':' + t.day; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(t); }
const endOf = (t) => (t.carry ? t.home : t.site);
for (const g of groups.values()) {
  let i = 0;
  while (i < g.length) {
    let j = i; while (j + 1 < g.length && g[j + 1].cls === g[i].cls) j++;
    const run = g.slice(i, j + 1), start = run[0].at;
    runs++; if (run.length > 1) { runs2++; inRuns2 += run.length; }
    if (run.every((t) => t.site != null && t.site >= 0) && start >= 0) {
      let cur = start;
      for (const t of run) { const dd = dist(cur, t.site); base += dd; (byKind[t.kind] ||= { base: 0, best: 0, n: 0 }).base += dd; byKind[t.kind].n++; cur = endOf(t); }
      cur = start; const left = [...run];
      for (let s = 0; s < run.length; s++) {
        const slotT = run[s].t; let bi = -1, bd = Infinity;
        for (let q = 0; q < left.length; q++) { if (left[q].seen > slotT + 1e-9) continue; const dd = dist(cur, left[q].site); if (dd < bd) { bd = dd; bi = q; } }
        if (bi < 0) { bi = 0; bd = dist(cur, left[0].site); } // none posted yet: keep the order seen
        const t = left.splice(bi, 1)[0]; best += bd; byKind[t.kind].best += bd; cur = endOf(t);
      }
    }
    i = j + 1;
  }
}
const allWalk = Object.values(walkH).reduce((s, x) => s + x, 0);
const FAM = { wood: ['wood', 'fell', 'timber', 'firewood', 'leftTimber', 'fetchWood', 'fetchLeftTimber'], stone: ['pick', 'quarry', 'wellstone', 'fetchWellstone', 'clear'], haul: ['haul', 'hay', 'fetchHaul', 'fetchHay', 'leftGrain', 'fetchLeftGrain', 'leftCart', 'fetchLeftCart', 'manure'] };
const fam = {};
for (const [f, ks] of Object.entries(FAM)) {
  const w = ks.reduce((s, k) => s + (walkH[k] || 0), 0), sv = ks.reduce((s, k) => s + (byKind[k] ? (byKind[k].base - byKind[k].best) * hPerStep : 0), 0);
  fam[f] = { walkH: +w.toFixed(1), savedH: +sv.toFixed(1), share: w ? +(sv / w).toFixed(3) : null };
}
const kinds = Object.entries(byKind).map(([k, v]) => ({ kind: k, tasks: v.n, walkH: +(walkH[k] || 0).toFixed(1), savedH: +((v.base - v.best) * hPerStep).toFixed(1) }))
  .sort((a, b) => b.walkH - a.walkH);
const res = {
  scenario, seed, map, from, years, secs: +secs.toFixed(1), skipSecs: +(tSkip / 1000).toFixed(1),
  pawnDays: n.pawnDays, workPawnDays: n.workPawnDays, tasks: tasks.length, awayTasks: away.length,
  besideShare: +(beside / away.length).toFixed(3), besideOrPrevShare: +(besidePrev / away.length).toFixed(3),
  meanDSite: +(away.reduce((s, t) => s + t.dSite, 0) / away.length).toFixed(2),
  hPerStep: +hPerStep.toFixed(3), walkLegs: walkLeg.n, walkHAll: +allWalk.toFixed(1),
  savedHAll: +((base - best) * hPerStep).toFixed(1), savedShareAll: +(((base - best) * hPerStep) / allWalk).toFixed(3),
  approachShareOfWalk: +((base * hPerStep) / allWalk).toFixed(3),
  fam, legEndsPerPawnDay: +(n.legEnds / n.pawnDays).toFixed(2), legEndsInTaskPerWorkPawnDay: +(n.legEndsInTask / n.workPawnDays).toFixed(2),
  legEndsInTaskPerPawnDay: +(n.legEndsInTask / n.pawnDays).toFixed(2),
  runs, runsOfTwoOrMore: runs2, tasksInRunsOfTwoOrMore: inRuns2,
  besideByKind: Object.entries(besideBy).sort((a, b) => b[1][1] - a[1][1]).slice(0, 16).map(([k, [b, n]]) => `${k} ${b}/${n}`).join(', '),
  tasksPerWorkPawnDay: +(tasks.length / n.workPawnDays).toFixed(2), topKinds: kinds.slice(0, 14),
};
console.log(JSON.stringify(res, null, 1));
if (out) fs.writeFileSync(out, JSON.stringify(res, null, 1));
