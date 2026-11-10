// VB-270 (10 Nov 2026): who is hungry on the bands' full runs, and why. Reads only: runs a band's scenario a day at a time, as tests/lib/bands.js, and prints JSON:
// the households after year 3 hungry over 0.3 of their days ('blocked': days hungry while stores held a day's need, behind the seed reserve; 'short': days
// stores were short), the hunger and starvation deaths with their household, and yearly counts. Usage: node docs/bench/hunger-causes.js populous 3 30
const R = __dirname + '/../../';
const VB = require(R + 'src/load.js'), G = VB.gen, Sim = VB.sim; const { DAY, YEAR_DAYS, SEASON_DAYS } = VB['sim/rules'];
const [scenario, seed, years] = [process.argv[2], +process.argv[3], +process.argv[4]];
const it = G.generate(seed, { cols: 180, rows: 130 }); let r; while (!(r = it.next()).done);
const st = Sim.seed(r.value, seed, scenario);
const dday = new Map(); const first = new Map(), out = { scenario, seed, yr: {}, hh: [], deaths: [], yearly: [] };
for (const id of st.liveHouseholds) first.set(id, 0);
const band = (a) => (a < 6 ? 'inf' : a < 16 ? 'child' : a < 60 ? 'adult' : 'old');
for (let y = 1; y <= years; y++) {
  const from = st.record.length, h0 = new Map(), days = new Map(), sz0 = new Map(), t0 = st.t;
  for (const id of st.liveHouseholds) { h0.set(id, st.households[id].hungryDays); sz0.set(id, st.households[id].members.length); }
  const blk = new Map(), sht = new Map(); const hs0 = new Map(); let rc = st.record.length;
  for (let d = 0; d < YEAR_DAYS; d++) {
    for (const id of st.liveHouseholds) hs0.set(id, st.households[id].hungryDays);
    Sim.advance(st, DAY);
    for (const id of st.liveHouseholds) { const h = st.households[id]; if (h.hungryDays > (hs0.get(id) ?? h.hungryDays)) { const need = VB["sim/hunger"].dailyNeed(st, h); if (h.grain + h.meals >= need - 1e-6) blk.set(id, (blk.get(id) || 0) + 1); else sht.set(id, (sht.get(id) || 0) + 1); } }
    for (; rc < st.record.length; rc++) { const e = st.record[rc]; if (typeof e === "object" && !e.self && e.kind === "died" && (e.text === "hunger" || e.text === "starvation")) { const p = st.pawns[e.pawn], h = p.household !== null ? st.households[p.household] : null; dday.set(e.pawn, h ? { blockedNow: h.grain + h.meals >= VB["sim/hunger"].dailyNeed(st, h) - 1e-6 && h.hungryDays > (hs0.get(h.id) ?? h.hungryDays), hadHungryDay: h.hungryDays > (hs0.get(h.id) ?? h.hungryDays), grainLeft: Math.round(h.grain), reserve: VB["sim/hunger"].seedReserve(st, h) } : null); } }
    for (const id of st.liveHouseholds) {
      days.set(id, (days.get(id) || 0) + 1);
      if (!h0.has(id)) { h0.set(id, 0); sz0.set(id, 0); }
      if (!first.has(id)) first.set(id, st.t);
    }
  }
  let hd = 0, dd = 0; for (const [id, b] of blk) out.yr[y + ":" + id] = { b, s: sht.get(id) || 0 }; for (const [id, s] of sht) if (!blk.has(id)) out.yr[y + ":" + id] = { b: 0, s };
  for (const [id, n] of days) {
    const h = st.households[id], hung = h.hungryDays - h0.get(id); hd += hung; dd += n;
    const share = hung / Math.max(n, hung);
    if (y > 3 && n >= SEASON_DAYS && share > 0.3) {
      const f = st.farmsteads[h.farmstead], b = { inf: 0, child: 0, adult: 0, old: 0 };
      for (const m of h.members) b[band(st.pawns[m].age)]++;
      out.hh.push({ y, id, n, hung, share: +share.toFixed(2), members: h.members.length, ...b, startSize: sz0.get(id), newThisYear: first.get(id) >= t0,
        blocked: blk.get(id) || 0, short: sht.get(id) || 0, dissolved: h.dissolved, fields: f ? f.fields.length : 0, herds: h.herds.length, grain: Math.round(h.grain),
        holderAge: st.pawns[h.holder] ? st.pawns[h.holder].age : null });
    }
  }
  let all = 0, hdth = 0;
  for (let i = from; i < st.record.length; i++) {
    const e = st.record[i]; if (typeof e !== 'object' || e.self || e.kind !== 'died') continue; all++;
    if (e.text === 'hunger' || e.text === 'starvation') {
      hdth++;
      const p = st.pawns[e.pawn], h = p.household !== null ? st.households[p.household] : null;
      const live = h ? h.members.filter((m) => st.pawns[m].died === null) : [], f = h && st.farmsteads[h.farmstead];
      if (y > 3) out.deaths.push({ y, pawn: e.pawn, cause: e.text, age: p.age, sex: p.sex, hh: p.household, hhLive: live.length,
        hhAdults: live.filter((m) => st.pawns[m].age >= 16).length, hhDissolved: h ? h.dissolved : null, hhHungry: h ? h.hungryDays - (h0.get(h.id) || 0) : null,
        fields: f ? f.fields.length : null, herds: h ? h.herds.length : null, grain: h ? Math.round(h.grain) : null,
        isHolder: h ? h.holder === p.id : null, day: dday.get(e.pawn), holderAge: h && st.pawns[h.holder] ? st.pawns[h.holder].age : null });
    }
  }
  out.yearly.push({ y, living: st.living.length, hh: st.liveHouseholds.length, deaths: all, hunger: hdth, hungryShare: +(hd / dd).toFixed(3) });
}
console.log(JSON.stringify(out));
