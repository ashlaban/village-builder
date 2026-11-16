// scratch (VB-682): the pools the round's offers are drawn from, after the years run. Reads; changes
// nothing. node docs/plans/VB-682-pools.js ROOT populous small 7,42 20
const [root, scenario, map, seeds, years] = process.argv.slice(2);
const VB = require(root + '/src/load.js'), Sim = VB.sim, R = VB['sim/routes'], Rec = VB['sim/records'], RU = VB['sim/rules'];
const SIZES = { small: [180, 130], medium: [280, 200] };
const q = (a, p) => { a = [...a].sort((x, y) => x - y); return a.length ? +a[Math.round((a.length - 1) * p)].toFixed(2) : null; };
const row = (a) => `${q(a, 0)}/${q(a, 0.5)}/${q(a, 1)}`;
for (const seed of seeds.split(',').map(Number)) {
  const it = VB.gen.generate(seed, { cols: SIZES[map][0], rows: SIZES[map][1] }); let r; while (!(r = it.next()).done);
  const st = Sim.seed(r.value, seed, scenario);
  for (let y = 0; y < +years; y++) Sim.advance(st, Sim.YEAR);
  const vOf = (p) => Rec.settlementIdOf(st, p), sp = (id) => Rec.spouseOf(st, id);
  const live = st.living.map((id) => st.pawns[id]);
  const men = live.filter((p) => p.sex === 'm' && p.age >= RU.MARRIAGE.menFrom && sp(p.id) === null && !p.retired);
  const women = live.filter((p) => p.sex === 'f' && p.age >= RU.MARRIAGE.womenFrom && sp(p.id) === null && !p.retired);
  const byV = new Map(); for (const w of women) byV.set(vOf(w), (byV.get(vOf(w)) || 0) + 1);
  const own = [], day = [], reach = [];
  for (const m of men) {
    const v = vOf(m); let d = 0, rr = 0;
    for (const [u, n] of byV) { const h = R.hoursBetween(st, v, u); if (h <= 12) d += n; if (Number.isFinite(h)) rr += n; }
    own.push(byV.get(v) || 0); day.push(d); reach.push(rr);
  }
  const hhs = st.liveHouseholds.map((id) => st.households[id]).filter((h) => !h.dissolved);
  const hands = (h) => h.members.filter((id) => { const p = st.pawns[id]; return p.alive && p.age >= 14 && p.age < 60 && !p.retired; }).length;
  const fields = (h) => st.farmsteads[h.farmstead].fields.length;
  const short = hhs.filter((h) => fields(h) > 0 && hands(h) / Math.max(1, fields(h)) < RU.SERVICE.short).length;
  const lone = hhs.filter((h) => h.members.length === 1).length;
  const empty = st.farmsteads.filter((f) => f.household === null && f.state === 'derelict').length;
  console.log(JSON.stringify({ scenario, map, seed, year: +years, living: live.length, villages: st.villages.length, households: hhs.length,
    men: men.length, women: women.length, womenOwnVillage: row(own), womenDayWalk: row(day), womenReach: row(reach),
    pairsAll: men.length * women.length, pairsDay: day.reduce((a, b) => a + b, 0), pairsOwn: own.reduce((a, b) => a + b, 0),
    demand: (st.demand || []).length, short, lone, empty, crowded: st.villages.filter((v) => v.crowded).length, servants: live.filter((p) => p.servant).length,
    roundPairs: VB.count.roundPairs }));
}
