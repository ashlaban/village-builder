// What bars the unmarried of age (under 45), the day before each moving round, summed by 20 years: the best outcome over every
// unmarried pawn of the other sex (nobody free, kin, no home, the score, the means, free to marry). A research script of VB-405's plan
// (16 November 2026), not game code; VB-633 makes the report. node docs/balance/mocks/measure/scripts/marriage-bars.js "$PWD" SEED YEARS [SCENARIO]  (small map)
const root = process.argv[2],
  seed = +process.argv[3],
  years = +process.argv[4],
  scenario = process.argv[5] || 'founders';
const VB = require(root + '/src/load.js'),
  G = VB.gen,
  Sim = VB.sim;
const { matchRules, kinOk, matchScore } = VB['sim/matching'];
const { MARRIAGE, HUNGER, DAY } = VB['sim/rules'];
const { spouseOf, settlementIdOf } = VB['sim/records'];
const practice = VB['sim/records'].practice;
const it = G.generate(seed, { cols: 180, rows: 130 });
let r;
while (!(r = it.next()).done);
const st = Sim.seed(r.value, seed, scenario);
const dec = {};
const yrs = (p) => (st.t - p.born) / Sim.YEAR;
const start = st.living.length;
Sim.advance(st, (2 * 12 + 10) * DAY); // autumn day 10
for (let y = 1; y <= years; y++) {
  const k = Math.ceil(y / 20);
  const d = (dec[k] = dec[k] || { n: 0, none: 0, kin: 0, home: 0, means: 0, score: 0, ok: 0, hungry: 0, servants: 0, single: 0, hh: 0, pop: 0 });
  const live = st.living.map((id) => st.pawns[id]);
  d.pop = live.length;
  const free = live.filter(
    (p) => spouseOf(st, p.id) === null && !p.retired && yrs(p) >= (p.sex === 'm' ? MARRIAGE.menFrom : MARRIAGE.womenFrom) && yrs(p) < 45,
  );
  const rules = matchRules(st);
  for (const h of st.liveHouseholds) {
    d.hh++;
    if (st.households[h].members.length === 1) d.single++;
  }
  for (const p of free) {
    d.n++;
    if (p.servant) d.servants++;
    if (!(p.hunger < HUNGER.marryBelow)) {
      d.hungry++;
      continue;
    }
    const others = free.filter((q) => q.sex !== p.sex);
    if (!others.length) {
      d.none++;
      continue;
    }
    let best = 0; // 1 kin, 2 home, 3 score, 4 means, 5 ok
    for (const q of others) {
      const m = p.sex === 'm' ? p : q,
        f = m === p ? q : p,
        cu = practice(st, settlementIdOf(st, m));
      let s = 1;
      if (kinOk(st, m.id, f.id, cu)) {
        s = 2;
        const home = rules.homeFor(m, f, cu);
        if (home !== null) {
          s = 3;
          const a = (x) => ({ ...x, age: yrs(x) });
          if (matchScore(st, a(m), a(f), 0.5, false) >= MARRIAGE.minScore) s = rules.affords(home) ? 5 : 4;
        }
      }
      if (s > best) best = s;
    }
    d[['', 'kin', 'home', 'score', 'means', 'ok'][best]]++;
  }
  if (y < years) Sim.advance(st, Sim.YEAR);
}
console.log(scenario, 'seed', seed, 'start', start, 'end', st.living.length, 'growth', (Math.pow(st.living.length / start, 1 / years) - 1).toFixed(4));
for (const [k, d] of Object.entries(dec)) console.log(`y${k * 20 - 19}-${k * 20}`, JSON.stringify(d));
const u0 = st.unions[0] || {};
const mk = Object.keys(u0);
const wed = new Set();
for (const u of st.unions) for (const key of mk) if (typeof u[key] === 'number' && (key === 'man' || key === 'woman' || key === 'husband' || key === 'wife' || key === 'a' || key === 'b')) wed.add(u[key]);
const ever = st.pawns.filter((p) => !p.founder && p.born > 0 && (p.alive ? yrs(p) : (p.died - p.born) / Sim.YEAR) >= 45);
console.log('reached 45:', ever.length, 'never married:', ever.filter((p) => !wed.has(p.id)).length, '| union keys', mk.join(','));
const firsts = { m: [], f: [] };
const seen = new Set();
for (const u of st.unions)
  for (const key of mk)
    if (wed.has(u[key]) && typeof u[key] === 'number' && ['man', 'woman', 'husband', 'wife', 'a', 'b'].includes(key) && !seen.has(u[key])) {
      seen.add(u[key]);
      const p = st.pawns[u[key]];
      if (!p.founder && u.start > 0) firsts[p.sex].push((u.start - p.born) / Sim.YEAR);
    }
const mean = (a) => (a.length ? (a.reduce((s, x) => s + x, 0) / a.length).toFixed(1) : '-');
console.log('first marriages: women', firsts.f.length, 'mean age', mean(firsts.f), '| men', firsts.m.length, 'mean age', mean(firsts.m));
