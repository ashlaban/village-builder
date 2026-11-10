// VB-282 (10 Nov 2026): what eating the seed does, on the bands' own runs. Runs a scenario a day at a time and prints JSON: hunger deaths' share
// after year 3, the share of household-years (present 12 days or more, after year 3) hungry on over 0.3 of their days, hunger deaths of a household that
// had a day its stores covered its need (reserve-blocked before VB-282) or ate seed (after), the fields in the ground a household has after the spring's
// sowing (day 24 of each year), living and households at the end, and the cohort: households with such a day in a year after year 3 and what became of
// each the year after (dissolved, hungry over 0.3, fine). Usage: node docs/bench/seed-eaten.js populous 3 15
const R = __dirname + '/../../';
const VB = require(R + 'src/load.js'), G = VB.gen, Sim = VB.sim; const { DAY, YEAR_DAYS } = VB['sim/rules'];
const [scenario, seed, years] = [process.argv[2], +process.argv[3], +process.argv[4]];
const it = G.generate(seed, { cols: 180, rows: 130 }); let r; while (!(r = it.next()).done);
const st = Sim.seed(r.value, seed, scenario), H = VB['sim/hunger'];
const out = { scenario, seed, deaths: 0, hungerDeaths: 0, hhYears: 0, hungryHHYears: 0, hungerDeathsBlocked: 0, sown: [], cohort: { n: 0, dissolved: 0, hungryNext: 0, fine: 0 } };
const cohort = [], badBy = {};
for (let y = 1; y <= years; y++) {
  const from = st.record.length, h0 = new Map(), days = new Map(), hs0 = new Map(), blockedDay = new Set(); let rc = from, sownNow = 0, hhNow = 0;
  for (const id of st.liveHouseholds) h0.set(id, st.households[id].hungryDays);
  for (let d = 0; d < YEAR_DAYS; d++) {
    for (const id of st.liveHouseholds) { const h = st.households[id]; hs0.set(id, [h.hungryDays, h.seedSeason]); }
    Sim.advance(st, DAY);
    for (const id of st.liveHouseholds) {
      const h = st.households[id], was = hs0.get(id) || [h.hungryDays, h.seedSeason];
      if (h.hungryDays > was[0] && h.grain + h.meals >= H.dailyNeed(st, h) - 1e-6) blockedDay.add(id); // before: hungry behind the reserve
      if (h.seedSeason !== undefined && h.seedSeason !== -1 && h.seedSeason !== was[1]) blockedDay.add(id); // after: ate seed (told once a season)
      days.set(id, (days.get(id) || 0) + 1); if (!h0.has(id)) h0.set(id, 0);
    }
    for (; rc < st.record.length; rc++) {
      const e = st.record[rc]; if (typeof e !== 'object' || e.self || e.kind !== 'died' || y <= 3) continue;
      out.deaths++;
      if (e.text === 'hunger' || e.text === 'starvation') { out.hungerDeaths++; const p = st.pawns[e.pawn]; if (p.household !== null && blockedDay.has(p.household)) out.hungerDeathsBlocked++; }
    }
    if (d === 24) for (const id of st.liveHouseholds) {
      hhNow++; for (const fd of st.farmsteads[st.households[id].farmstead].fields) if (fd.stage === 'sown' || fd.stage === 'growing' || fd.stage === 'ripe') sownNow++;
    }
  }
  out.sown.push(+(sownNow / Math.max(1, hhNow)).toFixed(2));
  const bad = new Set();
  for (const [id, n] of days) {
    const hung = st.households[id].hungryDays - h0.get(id), share = hung / Math.max(n, hung);
    if (y > 3 && n >= 12) { out.hhYears++; if (share > 0.3) { out.hungryHHYears++; bad.add(id); } }
    if (y > 3 && blockedDay.has(id)) cohort.push([id, y]);
  }
  badBy[y] = bad;
}
for (const [id, y] of cohort) {
  if (y >= years) continue; out.cohort.n++;
  if (st.households[id].dissolved) out.cohort.dissolved++; else if (badBy[y + 1].has(id)) out.cohort.hungryNext++; else out.cohort.fine++;
}
out.shareHungerDeaths = +(out.hungerDeaths / Math.max(1, out.deaths)).toFixed(3); out.bandShare = +(out.hungryHHYears / Math.max(1, out.hhYears)).toFixed(3);
out.end = { living: st.living.length, households: st.liveHouseholds.length };
console.log(JSON.stringify(out));
