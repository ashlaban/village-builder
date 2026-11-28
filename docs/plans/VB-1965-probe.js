// VB-1965 (docs/plans/VB-1965-hunger.md): the gate's run (tools/gate.js run) reproduced, read-only, with per household-season records.
// node probe.js ROOT SEED > out.json   (ROOT: an extracted commit)
const ROOT = process.argv[2],
  seed = +process.argv[3],
  scenario = process.argv[4] || 'populous';
process.chdir(ROOT);
const accounts = require(ROOT + '/tools/accounts.js'),
  VB = accounts.load(),
  G = VB.gen,
  Sim = VB.sim;
const it = G.generate(seed, { cols: 180, rows: 130 });
let r;
while (!(r = it.next()).done);
const st = Sim.seed(r.value, seed, scenario, null, {}),
  Rec = VB['sim/records'],
  Lev = VB['sim/levies'];
const planOf = (Lev && Lev.planOf) || (VB['sim/plans'] && VB['sim/plans'].planOf) || Sim.planOf || null;
if (process.env.PERTURB) VB['sim/rng'].next(st.rng[process.env.PERTURB]); // a null perturbation: one draw of a stream, a different realisation of the same model
const hungry0 = st.households.reduce((s, h) => s + h.hungryDays, 0);
const [W0, W1] = Sim.WORK;
const recs = new Map();
function rec(h, c) {
  const k = `${h}|${c.year}|${c.season}`;
  let e = recs.get(k);
  if (!e) {
    const hh = st.households[h],
      f = st.farmsteads[hh.farmstead];
    e = {
      hh: h,
      year: c.year,
      season: c.season,
      village: hh.members.length ? Rec.settlementIdOf(st, st.pawns[hh.members[0]]) : null,
      members: hh.members.length,
      adults: hh.members.filter((m) => Sim.age(st, st.pawns[m]) >= 14).length,
      grain0: Math.round(Sim.grainOf(hh)),
      flour0: Math.round(hh.flour || 0),
      meals0: Math.round(hh.meals || 0),
      larder0: Math.round((hh.larder || []).reduce((s, x) => s + (x.n || x.amount || 0), 0)),
      fields: f ? f.fields.length : 0,
      sown: f ? f.fields.filter((fd) => fd.sown !== null).length : 0,
      hungry: 0,
      hours: {},
      by: {},
      owner: {},
      idle: 0,
      work: 0,
    };
    recs.set(k, e);
  }
  return e;
}
const last = new Map(st.households.map((h) => [h.id, h.hungryDays]));
const adv = Sim.advance;
let lastDay = -1;
const SPLIT = +process.env.SPLIT || 1; // a null perturbation: each step taken in SPLIT pieces (the clock's rounding moves the run in detail)
const step =
  SPLIT > 1
    ? (s, dt) => {
        for (let i = 0; i < SPLIT; i++) adv(s, dt / SPLIT);
      }
    : adv;
Sim.advance = (s, dt) => {
  step(s, dt);
  const c = Sim.cal(s.t),
    hr = s.t % Sim.DAY;
  if (hr >= W0 && hr < W1)
    for (const a of s.agents) {
      const p = s.pawns[a.id];
      if (!p.alive || p.household === null || Sim.age(s, p) < 7) continue;
      const hh = s.households[p.household];
      if (hh.dissolved) continue;
      const e = rec(hh.id, c);
      if (!a.job) {
        e.idle++;
        continue;
      }
      e.work++;
      const kind = String(a.job.kind || a.job.key || '?').split(/[:@#]/)[0];
      e.hours[kind] = (e.hours[kind] || 0) + 1;
      const by = (a.leg && a.leg.by) || 'own';
      e.by[by] = (e.by[by] || 0) + 1;
      const o = a.job.owner,
        ow = !o ? 'none' : o.type === 'household' ? (o.id === hh.id ? 'self' : 'otherhh') : o.type;
      e.owner[ow] = (e.owner[ow] || 0) + 1;
    }
  const day = Math.floor(s.t / Sim.DAY);
  if (day !== lastDay) {
    lastDay = day;
    for (const hh of s.households) {
      const d = hh.hungryDays - (last.get(hh.id) || 0);
      last.set(hh.id, hh.hungryDays);
      if (hh.dissolved || !hh.members.length) {
        if (d > 0) rec(hh.id, c).hungry += d;
        continue;
      }
      const e = rec(hh.id, c);
      if (d > 0) {
        e.hungry += d;
        if (e.firstHungryDay === undefined) {
          e.firstHungryDay = c.day;
          e.grainAtHunger = Math.round(Sim.grainOf(hh));
        }
      }
      const plan = planOf ? planOf(s, 'household', hh.id) : null;
      if (plan && plan.budget && plan.budget.at === c.year * 4 + c.season) {
        e.budget = Math.round(plan.budget.total);
        e.outer = plan.budget.outer;
      }
      if (plan && plan.fit && plan.fit.at === c.year * 4 + c.season) {
        e.short = Math.round(plan.fit.short || 0);
        e.lowered = plan.fit.lowered;
        e.demand = plan.fit.demand;
      }
    }
  }
};
const acc = accounts.report(VB, st);
const FOOD = new Set([
  'grain',
  'sheaves',
  'flour',
  'fish',
  'gathered',
  'dried fish',
  'meat',
  'salt meat',
  'smoked meat',
  'milk',
  'butter',
]);
const ledgers = [];
for (let y = 0; y < (+process.argv[5] || 10); y++) {
  acc.advanceYear();
  const year = Sim.cal(st.t - 1).year,
    hungry = new Set();
  for (const r of recs.values()) if (r.year === year && r.hungry) hungry.add(r.hh);
  for (const h of hungry) {
    const hh = st.households[h],
      o = {};
    for (const e of [...(hh.ledger || []), ...(hh.totals || [])]) {
      const ey = e.year !== undefined ? e.year : Sim.cal(e.t).year;
      if (ey !== year || !FOOD.has(e.good)) continue;
      const k = e.kind + (e.kind === 'harvest' || e.good === 'grain' ? '' : ':' + e.good);
      o[k] = Math.round(((o[k] || 0) + e.n) * 10) / 10;
    }
    ledgers.push({ hh: h, year, dissolved: !!hh.dissolved, lines: o });
  }
}
Sim.advance = adv;
const out = acc.result();
const deaths = [];
for (const e of st.record)
  if (e && e.kind === 'died' && (e.cause === 'hunger' || e.cause === 'starvation'))
    deaths.push({ pawn: e.pawn, t: e.t, hh: st.pawns[e.pawn].household });
console.log(
  JSON.stringify({
    seed,
    planOf: !!planOf,
    hungryDays: st.households.reduce((s, h) => s + h.hungryDays, 0) - hungry0,
    deaths,
    ledgers,
    recs: [...recs.values()],
    years: out.years,
  }),
);
