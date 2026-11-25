// Study B of the plans mocks (docs/mocks/plans/README of the scratchpad spec): the observer. It steps a real run a 6-minute step at a
// time, as tools/hours.js does, reads st and writes nothing to it, and records what a household's week planner would have had in front
// of it and what the household then did:
//   - for every household-day: its members (age, adult, rate, ill, servant, the role), the woodpile against its target, the hay, the
//     seasonal plan's steps, the cadence of its head's planning days, the reviews and allotments of the day (plan.last, plan.day changed),
//     the open jobs at the day's start, and each member's hours by what they were spent on (own household's kind, village, owed, lent,
//     other household, own time, idle, abed, away), in the working hours (6 to 18) and outside them;
//   - for every job a household owns: kind, site, distance to the house, the hour posted, first worked and gone, the hours its kind
//     estimates, and each member's hours on it (work and walk);
//   - per day: the counters dayPair and oppAsk.
// node docs/mocks/plans/week/record.js [--scenario populous] [--seed 7] [--map small] [--years 2] [--out FILE]
// Writes one JSON-lines file (default docs/mocks/plans/week/data/<scenario>-<seed>.jsonl; not committed). No game code.
const path = require('path'), fs = require('fs'), root = path.join(__dirname, '../../../..');
const VB = require(path.join(root, 'src/load.js')), G = VB.gen, Sim = VB.sim;
const { KINDS } = VB['sim/kinds'], { TICKS, DAY, WORK } = VB['sim/rules'];
const { planOf } = VB['sim/plans'], { cadence } = VB['sim/plandays'], { hexSteps } = VB['sim/hex'];
const Days = VB['sim/days'], Hands = VB['sim/hands'], { workRate } = VB['sim/roles'];
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i >= 0 ? process.argv[i + 1] : d; };
const SIZES = { tiny: [120, 85], small: [180, 130], medium: [280, 200] };
const scenario = arg('scenario', 'populous'), seed = Number(arg('seed', 7)), map = arg('map', 'small'), years = Number(arg('years', 2));
const out = arg('out', path.join(__dirname, 'data', `${scenario}-${seed}.jsonl`));
fs.mkdirSync(path.dirname(out), { recursive: true });
const fd = fs.openSync(out, 'w'), emit = (o) => fs.writeSync(fd, JSON.stringify(o) + '\n');
const t0 = Date.now();
const it = G.generate(seed, { cols: SIZES[map][0], rows: SIZES[map][1] }); let r; while (!(r = it.next()).done);
const st = Sim.seed(r.value, seed, scenario), STEP = 1 / TICKS;
const r2 = (x) => Math.round(x * 100) / 100;
emit({ type: 'head', scenario, seed, map, years, WORK, kinds: Object.fromEntries(Object.entries(KINDS).map(([k, K]) => [k, {
  type: K.type, hours: typeof K.hours === 'number' ? K.hours : null, window: K.window || null, vital: !!K.vital, hands: K.hands,
  first: !!K.first, late: !!K.late }])) });

const live = new Map(); // job id -> record
const dayAgg = new Map(); // household id -> {members: {id: {cat: hours}}, first: {id: type}, allots, reviews, allotHours}
const lastDay = new Map(), lastLast = new Map(); // household id -> plan.day object / plan.last seen
let day = -1, cnt0 = { dayPair: 0, oppAsk: 0 };
const homeOf = (hh) => (hh.farmstead === null ? null : st.farmsteads[hh.farmstead].house);
const dist = (a, b) => (a === null || b === null || a === undefined || b === undefined ? null : hexSteps(st.w, a, b));
const bump = (o, k, n) => { o[k] = (o[k] || 0) + n; };
function aggOf(id) { let g = dayAgg.get(id); if (!g) dayAgg.set(id, g = { m: {}, off: {}, first: {}, allots: 0, allotHours: [], reviews: 0 }); return g; }

function closeJob(rec) {
  rec.gone = r2(st.t);
  for (const k of ['by', 'walk']) for (const id of Object.keys(rec[k])) rec[k][id] = r2(rec[k][id]);
  emit(rec); live.delete(rec.id);
}
function startDay(d) {
  // the day just ended: its households' hours
  for (const [id, g] of dayAgg) {
    for (const m of Object.values(g.m)) for (const k of Object.keys(m)) m[k] = r2(m[k]);
    for (const m of Object.values(g.off)) for (const k of Object.keys(m)) m[k] = r2(m[k]);
    emit({ type: 'hours', d: day, hh: id, m: g.m, off: g.off, first: g.first, allots: g.allots, allotHours: g.allotHours, reviews: g.reviews });
  }
  dayAgg.clear();
  if (day >= 0) emit({ type: 'count', d: day, dayPair: VB.count.dayPair - cnt0.dayPair, oppAsk: VB.count.oppAsk - cnt0.oppAsk, households: st.liveHouseholds.length });
  cnt0 = { dayPair: VB.count.dayPair, oppAsk: VB.count.oppAsk };
  day = d;
  const c = Sim.cal(st.t);
  for (const id of st.liveHouseholds) {
    const hh = st.households[id]; if (hh.dissolved || hh.farmstead === null) continue;
    const plan = planOf(st, 'household', id), sp = st.plans.seasons.get(id), home = homeOf(hh);
    const members = hh.members.map((pid) => st.pawns[pid]).filter((p) => p.died === null).map((p) => {
      const a = Sim.age(st, p);
      return { id: p.id, age: Math.floor(a), adult: a >= 14 && a < 60 && !p.retired, rate: a >= 7 && !p.retired ? r2(workRate(p.role, a)) : 0,
        ill: !!(p.ill && p.ill.until > st.t), servant: !!p.servant, role: p.role, holder: p.id === hh.holder };
    });
    const open = [];
    for (const j of (st.jobsBy.get(`household:${id}`) || [])) {
      const left = (j.hours ?? KINDS[j.kind].hours ?? 0) - (j.done || 0);
      open.push([j.id, j.kind, r2(left), dist(home, j.site)]);
    }
    emit({ type: 'day', d, season: c.season, year: c.year, hh: id, members, home, cad: plan ? cadence(st, plan) : null,
      wood: r2(hh.wood || 0), woodT: plan && plan.targets && plan.targets.wood ? r2(plan.targets.wood[c.season]) : null,
      hay: r2(hh.hay || 0), steps: sp ? sp.steps : [], open, nextReview: plan ? plan.nextReview : null });
  }
}
function sample(c) {
  const inWork = c.hour >= WORK[0] && c.hour < WORK[1];
  for (const a of st.agents) {
    const p = st.pawns[a.id];
    if (!p.alive || p.household === null) continue;
    const hh = st.households[p.household]; if (hh.dissolved) continue;
    const g = aggOf(hh.id), m = inWork ? (g.m[p.id] ||= {}) : (g.off[p.id] ||= {});
    const j = a.job;
    let cat;
    if (j) {
      const ow = j.owner || {}, w = a.phase === 'work' ? '' : '~';
      if (ow.type === 'household' && ow.id === p.household) cat = 'h:' + w + j.kind;
      else if (ow.type === 'village') cat = 'v:' + w + j.kind;
      else if (ow.type === 'household') cat = Days.on(st, p.id) !== null ? 'owed' : Hands.on(st, p.id) !== null ? 'lent' : 'other';
      else cat = 's:' + j.kind;
      if (inWork && !(p.id in g.first) && ow.type === 'household' && ow.id === p.household) g.first[p.id] = KINDS[j.kind].type;
      const rec = live.get(j.id) || (ow.type === 'household' ? register(j) : null);
      if (rec && ow.type === 'household' && ow.id === p.household) {
        bump(a.phase === 'work' ? rec.by : rec.walk, p.id, STEP);
        if (rec.first === null) rec.first = r2(st.t);
      } else if (rec) bump(rec.outside, 'h', STEP);
    } else if (p.ill && p.ill.until > st.t) cat = 'abed';
    else if (a.away !== undefined && a.away !== null) cat = 'away';
    else if (a.pastime || a.occasion !== null) cat = 'own';
    else cat = 'idle';
    bump(m, cat, STEP);
  }
}
function register(j) {
  const hh = st.households[j.owner.id], rec = { type: 'job', id: j.id, key: j.key, kind: j.kind, hh: j.owner.id, site: j.site,
    dist: dist(homeOf(hh), j.site), posted: r2(j.posted), seen: r2(st.t), first: null, gone: null,
    est: r2(j.hours ?? KINDS[j.kind].hours ?? 0), by: {}, walk: {}, outside: {} };
  live.set(j.id, rec); return rec;
}
function scanJobs() {
  const seen = new Set();
  for (const j of st.jobs.values()) {
    if (!j.owner || j.owner.type !== 'household') continue;
    seen.add(j.id);
    if (!live.has(j.id)) register(j);
  }
  for (const rec of [...live.values()]) if (!seen.has(rec.id)) closeJob(rec);
}
function plansWatch() {
  for (const id of st.liveHouseholds) {
    const plan = planOf(st, 'household', id); if (!plan) continue;
    if (plan.day && lastDay.get(id) !== plan.day) { const g = aggOf(id); g.allots++; g.allotHours.push(r2(st.t % DAY)); lastDay.set(id, plan.day); }
    if (plan.last !== lastLast.get(id)) { if (lastLast.has(id)) aggOf(id).reviews++; lastLast.set(id, plan.last); }
  }
}
const total = years * Sim.YEAR * TICKS;
for (let k = 0; k < total; k++) {
  const d = Math.floor(st.t / DAY + 1e-9);
  if (d !== day) startDay(d);
  Sim.advance(st, STEP);
  const c = Sim.cal(st.t - STEP);
  sample(c);
  plansWatch();
  if (st.tick % TICKS === 0) scanJobs();
}
startDay(day + 1);
for (const rec of [...live.values()]) { rec.open = true; closeJob(rec); }
fs.closeSync(fd);
console.log(`${scenario} seed ${seed} ${map}: ${years} years, ${st.living.length} living, ${st.liveHouseholds.length} households; ${((Date.now() - t0) / 1000).toFixed(0)} s -> ${path.relative(root, out)}`);
