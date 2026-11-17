// The supply outlook beside what came of it (VB-666; sim/outlook, Sim.supplyOutlook): how often the head's reckoning was right.
// node tools/sim.js --scenario founders --seed 7 --map small --years 3 --report outlook [--village N] [--json]
// After the run's years, each household of the village (default 0) is read: the outlook its head made at its last review (made anew,
// as the next review would, where it is stale), each supply's `with` and state: the first season of the frame (0 to 3, from the start
// of the season the outlook was made in) it expects to go short in, or safe. The run then goes on to the frame's end a day at a time,
// and the report adds the season each household did first go short in: food, a day some member went hungry (household.hungryDays);
// fuel, a cold day (household.coldLog); hay, a stall day a herd went without its full hay (herd.unfed). A description with no target:
// a row each household and supply, and the share where the reckoning named the season it came (or safe, and none came).
// The run is longer by up to a year than the one asked: the report is not the same run as a plain tools/sim.js to the same year.
require('./help.js')(__filename);
function report(VB, st, { village = 0 } = {}) {
  const Sim = VB.sim, O = VB['sim/outlook'], { SEASON_DAYS, DAY, cal } = VB['sim/rules'];
  const v = st.villages[village];
  if (!v) throw new Error('no such village ' + village);
  const c = cal(st.t), F = c.day - c.sday, end = F + O.FRAME * SEASON_DAYS;
  const rows = [];
  for (const fid of v.farmsteads) {
    const f = st.farmsteads[fid], hh = f.household === null ? null : st.households[f.household];
    if (!hh || hh.dissolved) continue;
    const plan = st.plans.households.get(hh.id);
    if (!plan) continue;
    let o = Sim.supplyOutlook(st, hh.id);
    if (!o || o.stale) o = O.reckon(st, hh, plan, c);
    rows.push({ hh, farm: f.name, o, came: { food: null, fuel: null, hay: null } });
  }
  // on to the frame's end a day at a time; the first season each supply went short in
  // the season of the day just run (the clock stands a day on from where the step began)
  const seasonOf = () => Math.floor((Math.floor((st.t - DAY / 2) / DAY) - F) / SEASON_DAYS);
  const hungry0 = new Map(rows.map((r) => [r.hh.id, r.hh.hungryDays]));
  while (Math.floor(st.t / DAY) < end) {
    Sim.advance(st, DAY);
    const k = Math.min(O.FRAME - 1, seasonOf());
    for (const r of rows) {
      const hh = r.hh;
      if (r.came.food === null && hh.hungryDays > hungry0.get(hh.id)) r.came.food = k;
      hungry0.set(hh.id, hh.hungryDays);
      const L = hh.coldLog || [];
      if (r.came.fuel === null && L.length && L[L.length - 1] > 0) r.came.fuel = k;
      if (r.came.hay === null && hh.herds.some((id) => st.herds[id].unfed > 0)) r.came.hay = k;
    }
  }
  const out = [],
    right = { food: 0, fuel: 0, hay: 0 },
    counted = { food: 0, fuel: 0, hay: 0 };
  for (const r of rows)
    for (const k of O.SUPPLIES) {
      const s = r.o[k];
      if (s.state === 'none') continue;
      const said = s.state === 'safe' ? null : s.season,
        came = r.came[k];
      counted[k]++;
      if (said === came) right[k]++;
      out.push({ household: r.hh.id, farm: r.farm, supply: k, own: s.own, with: s.with, state: s.state, expected: said ?? 'safe',
        came: came ?? 'none', right: said === came });
    }
  const share = Object.fromEntries(O.SUPPLIES.map((k) => [k, counted[k] ? +(right[k] / counted[k]).toFixed(2) : null]));
  return { village, made: { year: c.year, season: c.season }, rows: out, right: share, counted };
}
function print(r) {
  console.log(`village ${r.village}: outlooks of year ${r.made.year}, season ${r.made.season}, beside the four seasons that followed`);
  console.table(r.rows);
  console.log('share where the reckoning named the season it came (or safe, and none came):', JSON.stringify(r.right),
    'of', JSON.stringify(r.counted));
}
module.exports = { report, print };
