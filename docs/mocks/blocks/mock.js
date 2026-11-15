// A throwaway mock for option C of docs/review-jobs.md: work as scheduled blocks. It builds nothing: it steps a real run a 6-minute step
// at a time, as tools/hours.js does, reads st, and answers what a block scheduler would have had to do in its place:
//   1. how many events (a leg of walking or of work beginning or ending, a task's end moved) against how many agent-steps are stepped;
//   2. whether a leg's end can be known when it starts: the walk's from its route, the work's from the hours left over the hands' rates;
//   3. the four problems: talk reads positions, paths wear by steps, hands join and leave, hunger changes a rate.
// node docs/mocks/blocks/mock.js [--scenario populous] [--seed 7] [--map small] [--years 2]
// It writes nothing to st and is no game code; its numbers are in docs/mocks/blocks/README.md.
const path = require('path'), root = path.join(__dirname, '../../..');
const VB = require(path.join(root, 'src/load.js')), G = VB.gen, Sim = VB.sim, A = VB['sim/agents'], Carts = VB['sim/carts'];
const { KINDS } = VB['sim/kinds'], { SPEED, TICKS, DAY, HERD } = VB['sim/rules'];
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i >= 0 ? process.argv[i + 1] : d; };
const SIZES = { tiny: [120, 85], small: [180, 130], medium: [280, 200] };
const scenario = arg('scenario', 'populous'), seed = Number(arg('seed', 7)), map = arg('map', 'small'), years = Number(arg('years', 2));
const it = G.generate(seed, { cols: SIZES[map][0], rows: SIZES[map][1] }); let r; while (!(r = it.next()).done);
const st = Sim.seed(r.value, seed, scenario), STEP = 1 / TICKS;

const walks = new Map(), jobs = new Map(), sig = new Map();
const n = { pawnDays: 0, steps: 0, legEvents: 0, walkLegs: 0, walkArrived: 0, walkCut: 0, walkOverDay: 0, walkersAtHour: 0, hours: 0,
  workTasks: 0, workDone: 0, workDropped: 0, movedByHands: 0, movedByRate: 0, outdoorsAtHour: 0 };
const walkErr = [], workErrLast = [], workErrFirst = [];
// The hours a walk takes from where the pawn stands: each point's distance times its cost, at the pawn's pace (sim/agents moveAgent).
function walkHours(a) {
  let s = 0, x = a.x, y = a.y;
  for (let i = a.seg + 1; i < a.path.length; i++) { const p = a.path[i]; s += Math.hypot(p[0] - x, p[1] - y) * (p[2] === undefined ? 1 : p[2]); x = p[0]; y = p[1]; }
  return s / (SPEED * st.w.HW * (a.carry ? Carts.pace(st, a) : 1));
}
// The hands at work on job j and the hours a game hour of theirs does (rateOf, the ox team; a cart's part in carting is left out).
function manning(j) {
  let rate = 0; const ids = [];
  for (const id of j.claims) { const a = st.agents[id]; if (a.job === j && a.phase === 'work') { ids.push(id); rate += A.rateOf(st, st.pawns[id]) * (A.withOxen(st, a) ? HERD.team.rate : 1); } }
  return { key: ids.join(','), rate };
}
const hoursOf = (j) => j.hours ?? KINDS[j.kind].hours;
function finish(key, rec) { n.workDone++; workErrLast.push(st.t - rec.due); workErrFirst.push(st.t - rec.first); (errByKind[rec.job.kind] ||= []).push(st.t - rec.due); jobs.delete(key); }
const errByKind = {};
function observe() {
  const day = Math.floor(st.t / DAY), onHour = Math.abs(st.t - Math.round(st.t)) < 1e-9;
  if (onHour) n.hours++;
  for (const id of st.living) {
    const a = st.agents[id], leg = a.path ? 'walk' : a.phase === 'work' ? 'work' : 'rest', s = leg + ':' + (a.job ? a.job.key : '');
    if (sig.get(id) !== s) { n.legEvents++; sig.set(id, s); }
    if (onHour && a.path) n.walkersAtHour++;
    if (onHour && !a.inside) n.outdoorsAtHour++;
    const w = walks.get(id);
    if (w && w.path !== a.path) { // the walk ended: arrived where it was going, or cut short
      const arrived = Math.hypot(a.x - w.to[0], a.y - w.to[1]) < 1e-6 || (!a.path && w.lastSeg >= w.path.length - 2);
      if (arrived) { n.walkArrived++; walkErr.push(st.t - w.due); } else n.walkCut++;
      if (Math.floor(w.from / DAY) !== day) n.walkOverDay++;
      walks.delete(id);
    }
    if (a.path && !walks.has(id)) { n.walkLegs++; const last = a.path[a.path.length - 1]; walks.set(id, { path: a.path, from: st.t, due: st.t + walkHours(a), to: last, lastSeg: a.seg }); }
    else if (a.path) walks.get(id).lastSeg = a.seg;
  }
  // tasks under work: the end foretold when work begins, and told again whenever the hands or their rate change
  for (const [key, rec] of jobs) {
    const j = st.jobs.get(key), same = j === rec.job;
    // its work is finished: the hours are done (a load may still be on the road), it is gone having been within a step of its end, or
    // it was begun anew for the next load; gone short of that, it was taken down unfinished
    if (same && j.done >= hoursOf(j) - 1e-9) finish(key, rec);
    else if (same && j.done < rec.done - 1e-9) finish(key, rec);
    else if (!same) { if (rec.done + rec.rate * STEP >= rec.hours - 1e-9) finish(key, rec); else { n.workDropped++; jobs.delete(key); } }
  }
  for (const j of st.jobs.values()) {
    if (!j.claims.length || !(hoursOf(j) > 0) || (KINDS[j.kind].attention || 'full') !== 'full') continue;
    const m = manning(j), rec = jobs.get(j.key);
    if (j.done >= hoursOf(j) - 1e-9) continue; // only its load is on the road
    if (!m.rate) { if (rec) { rec.hands = ''; rec.done = j.done; rec.rate = 0; } continue; }
    const due = st.t + (hoursOf(j) - j.done) / m.rate;
    if (!rec) { n.workTasks++; jobs.set(j.key, { job: j, first: due, due, hands: m.key, done: j.done, rate: m.rate, hours: hoursOf(j) }); continue; }
    rec.rate = m.rate; rec.hours = hoursOf(j);
    if (rec.hands !== m.key) { n.movedByHands++; rec.due = due; rec.hands = m.key; }
    else if (Math.abs(due - rec.due) > STEP / 2) { n.movedByRate++; rec.due = due; }
    rec.done = j.done;
  }
}
const steps0 = VB.count.walkStep, t0 = Date.now();
for (let y = 0; y < years; y++) for (let d = 0; d < Sim.YEAR / DAY; d++) {
  n.pawnDays += st.living.length;
  for (let k = 0; k < DAY * TICKS; k++) { Sim.advance(st, STEP); n.steps++; observe(); }
}
const stepped = VB.count.walkStep - steps0;
const pct = (xs, p) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : NaN; };
const within = (xs, h) => (100 * xs.filter((x) => Math.abs(x) <= h + 1e-9).length / Math.max(1, xs.length)).toFixed(1);
const per = (x) => (x / n.pawnDays).toFixed(2);
// the queue's own cost: as many pushes and pops of a binary heap as there were events, timed
const events = n.legEvents + n.movedByHands + n.movedByRate;
function heapMs(count) {
  const h = []; const t = process.hrtime.bigint();
  const up = (i) => { while (i > 0) { const p = (i - 1) >> 1; if (h[p] <= h[i]) break; [h[p], h[i]] = [h[i], h[p]]; i = p; } };
  const down = () => { let i = 0; for (;;) { const l = 2 * i + 1, r2 = l + 1; let m = i; if (l < h.length && h[l] < h[m]) m = l; if (r2 < h.length && h[r2] < h[m]) m = r2; if (m === i) break; [h[m], h[i]] = [h[i], h[m]]; i = m; } };
  let x = 1;
  for (let i = 0; i < count; i++) { x = (x * 1103515245 + 12345) % 2147483648; h.push(x); up(h.length - 1); if (h.length > 400) { h[0] = h.pop(); down(); } }
  return Number(process.hrtime.bigint() - t) / 1e6;
}
const days = n.steps / (DAY * TICKS);
console.log(`${scenario} seed ${seed} ${map}, ${years} years: ${n.pawnDays} pawn-days, ${st.living.length} living at the end (${((Date.now() - t0) / 1000).toFixed(0)} s with the mock)`);
console.log(`1. agent-steps stepped by sim/agents: ${per(stepped)} a pawn-day; events a block scheduler would handle: ${per(events)} a pawn-day`);
console.log(`   (legs begun or ended ${per(n.legEvents)}, a task's end moved by its hands ${per(n.movedByHands)}, by a rate ${per(n.movedByRate)}); steps per event ${(stepped / events).toFixed(1)}`);
console.log(`   the queue itself: ${(heapMs(events) / days).toFixed(3)} ms a game day for ${Math.round(events / days)} events a day`);
console.log(`2. walks: ${per(n.walkLegs)} a pawn-day; ${(100 * n.walkArrived / n.walkLegs).toFixed(1)}% arrive, ${(100 * n.walkCut / n.walkLegs).toFixed(1)}% are cut short`);
console.log(`   arrival against the time foretold at the start: within one step ${within(walkErr, STEP)}%, within two ${within(walkErr, 2 * STEP)}%; median ${pct(walkErr, 0.5).toFixed(2)} h, 5th to 95th percentile ${pct(walkErr, 0.05).toFixed(2)} to ${pct(walkErr, 0.95).toFixed(2)} h`);
console.log(`   work: ${per(n.workTasks)} tasks worked a pawn-day; end against the last time foretold: within one step ${within(workErrLast, STEP)}%, within two ${within(workErrLast, 2 * STEP)}%`);
console.log(`   ${(100 * n.workDropped / Math.max(1, n.workTasks)).toFixed(1)}% of tasks are taken down unfinished; end against the first time foretold (never told again): within one step ${within(workErrFirst, STEP)}%, within an hour ${within(workErrFirst, 1)}%`);
const worst = Object.entries(errByKind).map(([k, xs]) => [k, xs.length, Number(within(xs, STEP))]).filter((e) => e[1] >= 20).sort((x, y) => x[2] - y[2]).slice(0, 6);
console.log(`   the kinds whose end is foretold worst (kind, tasks, % within one step): ${worst.map((e) => e.join(' ')).join('; ')}`);
console.log(`3. talk: at each hour ${(n.outdoorsAtHour / n.hours).toFixed(1)} pawns are outdoors, of whom ${(n.walkersAtHour / n.hours).toFixed(1)} are mid-walk and need their place worked out from the leg (${per(n.walkersAtHour)} a pawn-day)`);
console.log(`   wear: ${(100 * n.walkOverDay / n.walkLegs).toFixed(2)}% of walks cross midnight, when the day's fade runs: only those would wear a tile on another day than now`);
console.log(`   hands: a task's end is moved ${(n.movedByHands / Math.max(1, n.workTasks)).toFixed(2)} times a task by hands joining or leaving (the night included); by a rate ${(n.movedByRate / Math.max(1, n.workTasks)).toFixed(2)} times`);
