// VB-284 (11 Nov 2026): where rations fall short of need, by season, household size and farm (fields, hands, herd). Reads only: runs a scenario a day
// at a time, as docs/bench/hunger-causes.js does, and prints JSON. Per household and season (spring 0, summer 1, autumn 2, winter 3; the harvest comes
// in at the start of autumn): its shape on its first day in the season (members, adults and children by ration, hands 14 to 59 not retired, fields, fields
// in the ground, cattle and sheep), its need and its shortfall in rations (each living member's unmet share of the day's ration, from the hunger log),
// its hungry days and how many of them its stores still covered (the seed reserve, as the replay's 'blocked'), its food held at the season's start in days
// of need; per household and year its harvest (net of seed), the fields it reaped and its rows as the replay's (hungry over 0.3 of its days after year 3).
// Usage: node docs/bench/food-season.js populous 3 30 > out.json; docs/bench/food-season-report.js reads the files and prints the tables.
const R = __dirname + '/../../';
const VB = require(R + 'src/load.js'), G = VB.gen, Sim = VB.sim; const { DAY, YEAR_DAYS, SEASON_DAYS } = VB['sim/rules'];
const F = VB['sim/hunger'], H = VB['sim/herds'], { age } = VB['sim/records'];
const [scenario, seed, years] = [process.argv[2], +process.argv[3], +process.argv[4]];
const it = G.generate(seed, { cols: 180, rows: 130 }); let r; while (!(r = it.next()).done);
const st = Sim.seed(r.value, seed, scenario), E = st.ECON;
const out = { scenario, seed, years, seasons: [], years_: [] };
const cattleOf = (hh) => H.herdsOf(st, hh).reduce((s, hd) => s + (hd.species === 'cattle' ? hd.head.length : 0), 0);
const sheepOf = (hh) => H.herdsOf(st, hh).reduce((s, hd) => s + (hd.species === 'sheep' ? hd.ewes + hd.rams + hd.lambs : 0), 0);
const IDLE = new Set(['stubble', 'plowed']);
function shape(hh) {
  const f = st.farmsteads[hh.farmstead], s = { members: 0, adults: 0, children: 0, hands: 0 };
  for (const id of hh.members) {
    const p = st.pawns[id]; if (p.died !== null) continue;
    const a = age(st, p); s.members++; if (a >= 14) s.adults++; else s.children++; if (a >= 14 && a < 60 && !p.retired) s.hands++;
  }
  return { ...s, fields: f ? f.fields.length : 0, inGround: f ? f.fields.filter((q) => !IDLE.has(q.stage)).length : 0, meadows: f ? f.meadows.length : 0,
    cattle: cattleOf(hh), sheep: sheepOf(hh), food: Math.round(F.foodHeld(hh) + hh.meals), need: F.dailyNeed(st, hh) };
}
for (let y = 1; y <= years; y++) {
  const t0 = st.t, cur = new Map(), yr = new Map(); // cur: household -> its season row; yr: household -> its year row
  for (let d = 0; d < YEAR_DAYS; d++) {
    const season = Math.floor(d / SEASON_DAYS), hs0 = new Map();
    if (d % SEASON_DAYS === 0) { for (const row of cur.values()) out.seasons.push(row); cur.clear(); }
    for (const id of st.liveHouseholds) {
      const h = st.households[id]; hs0.set(id, h.hungryDays);
      if (!cur.has(id)) cur.set(id, { y, s: season, hh: id, ...shape(h), days: 0, needSum: 0, lack: 0, hungry: 0, blocked: 0 });
      if (!yr.has(id)) yr.set(id, { y, hh: id, days: 0, hungry: 0, blocked: 0, bySeason: [0, 0, 0, 0], start: shape(h) });
    }
    Sim.advance(st, DAY);
    for (const id of st.liveHouseholds) {
      const h = st.households[id], row = cur.get(id), yrow = yr.get(id); if (!row) continue;
      const need = F.dailyNeed(st, h); let lack = 0;
      for (const m of h.members) { const p = st.pawns[m]; if (p.died !== null || !p.hungerLog.length) continue; lack += p.hungerLog[p.hungerLog.length - 1] * (age(st, p) >= 14 ? E.ration.adult : E.ration.child); }
      row.days++; row.needSum += need; row.lack += lack; yrow.days++;
      if (h.hungryDays > (hs0.get(id) ?? h.hungryDays)) {
        const blocked = h.grain + h.meals >= need - 1e-6;
        row.hungry++; yrow.hungry++; yrow.bySeason[season]++; if (blocked) { row.blocked++; yrow.blocked++; }
      }
    }
  }
  for (const row of cur.values()) out.seasons.push(row);
  for (const [id, yrow] of yr) {
    const h = st.households[id], f = st.farmsteads[h.farmstead]; let harvest = 0, reaped = 0;
    for (const e of h.ledger) if (e.t >= t0 && e.t < st.t && e.kind === 'harvest') { harvest += e.n - E.seedPerField; reaped++; }
    const share = yrow.hungry / Math.max(1, yrow.days);
    out.years_.push({ ...yrow, harvest: Math.round(harvest), reaped, fieldsEnd: f ? f.fields.length : 0, dissolved: h.dissolved,
      row: y > 3 && yrow.days >= SEASON_DAYS && share > 0.3, share: +share.toFixed(2) });
  }
}
for (const row of out.seasons) { row.needSum = +row.needSum.toFixed(1); row.lack = +row.lack.toFixed(1); }
console.log(JSON.stringify(out));
