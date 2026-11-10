// The hunger report (VB-128): which households were hungry for over 30 days in the last year, and why. Advances a year in four seasons
// and reads the state at the ends of them; it only reads st. Like the idle report it steps the clock in pieces (a season at a time), so the
// run differs in detail from a plain one (the clock adds its 0.1 hour steps per call).
// Used by tools/sim.js: `const h = require('./hunger.js')(Sim, st)`; `h.advanceYear()` in place of `Sim.advance(st, Sim.YEAR)`; `h.result()`.
require('./help.js')(__filename);
module.exports = (Sim, st) => {
  const SEASON = Sim.SEASON_DAYS * Sim.DAY, LIMIT = 30;
  const band = (a) => (a < 6 ? 'infant' : a < 16 ? 'child' : a < 60 ? 'adult' : 'old');
  let last = null;
  function advanceYear() {
    const y0 = st.t, live = () => st.households.filter((h) => !h.dissolved);
    const days0 = new Map(st.households.map((h) => [h.id, h.hungryDays])), seasons = new Map(), at = new Map();
    for (let s = 0; s < 4; s++) {
      const before = new Map(st.households.map((h) => [h.id, h.hungryDays]));
      Sim.advance(st, SEASON);
      for (const h of st.households) {
        const rec = seasons.get(h.id) || [0, 0, 0, 0]; rec[s] = h.hungryDays - (before.get(h.id) || 0); seasons.set(h.id, rec);
      }
      if (s === 1) for (const h of live()) { // end of summer: fields and what stands in them, before the harvest
        const f = st.farmsteads[h.farmstead];
        at.set(h.id, { fields: f ? f.fields.length : 0, sown: f ? f.fields.filter((fd) => fd.sown !== null).length : 0 });
      }
      if (s === 2) for (const h of live()) (at.get(h.id) || at.set(h.id, { fields: 0, sown: 0 }).get(h.id)).harvestGrain = Math.round(h.grain);
    }
    last = { y0, days0, seasons, at };
  }
  function result() {
    const { y0, days0, seasons, at } = last, live = st.households.filter((h) => !h.dissolved);
    const starved = (p) => p.died !== null && p.died >= y0 && p.died < st.t
      && Sim.recordOf(st, { pawn: p.id, life: true }).some((e) => e.kind === 'died' && (e.cause === 'hunger' || e.cause === 'starvation'));
    const rows = [];
    for (const h of live) {
      const days = h.hungryDays - (days0.get(h.id) || 0);
      if (days <= LIMIT) continue;
      const bands = { infant: 0, child: 0, adult: 0, old: 0 };
      for (const m of h.members) bands[band(st.pawns[m].age)]++;
      const a = at.get(h.id) || {};
      rows.push({ id: h.id, village: Sim.settlementIdOf(st, st.pawns[h.members[0]] || st.pawns[h.holder]), members: h.members.length, ...bands,
        fields: a.fields || 0, sown: a.sown || 0, grainAtHarvest: a.harvestGrain || 0, grainNow: Math.round(h.grain), hungryDays: days,
        spring: seasons.get(h.id)[0], summer: seasons.get(h.id)[1], autumn: seasons.get(h.id)[2], winter: seasons.get(h.id)[3],
        starved: st.pawns.filter((p) => p.household === h.id && starved(p)).length });
    }
    const grains = live.map((h) => h.grain).sort((x, y) => x - y), q = (f) => Math.round(grains[Math.min(grains.length - 1, Math.floor(f * grains.length))] || 0);
    const people = live.reduce((s, h) => s + h.members.length, 0), hungryPeople = rows.reduce((s, r) => s + r.members, 0);
    return { households: rows, summary: { year: Math.floor(y0 / Sim.YEAR) + 1, households: live.length, hungryHouseholds: rows.length,
      hungryHouseholdShare: +(rows.length / Math.max(1, live.length)).toFixed(3), people, hungryPeople, hungryPeopleShare: +(hungryPeople / Math.max(1, people)).toFixed(3),
      starvedInYear: st.pawns.filter(starved).length, grainQuartiles: { min: q(0), q1: q(0.25), median: q(0.5), q3: q(0.75), max: q(1) } } };
  }
  return { advanceYear, result };
};
