// VB-283 (10 Nov 2026): the lone survivor and the ward. Reads only: runs a band's scenario a day at a time, as tests/lib/bands.js and
// docs/bench/hunger-causes.js do (the same rows over 0.3), and prints JSON: each household-year after year 3 hungry on over 0.3 of its days, with
// what the household was on its first hungry day of the year (members, adults of 16 or more, the holder's age, a guardian, fields, working
// hands) and who could have taken it in (kin households in its village, within SERVICE.reach steps and anywhere; kin households with a hand
// to spare; landless adults free to serve); every lone household-year (one adult of 16 or more at most, on most of its days) with fields;
// and the days a household became lone (the membership changes a rule would check). Usage:
//   node docs/bench/lone-households.js populous 3 30 [root]   (root: another checkout's top directory, to replay an older commit)
const R = (process.argv[5] || __dirname + '/../..') + '/';
const VB = require(R + 'src/load.js'), G = VB.gen, Sim = VB.sim; const { DAY, YEAR_DAYS, SEASON_DAYS, SERVICE } = VB['sim/rules'];
const Rec = VB['sim/records'], Svc = VB['sim/service'], Hex = VB['sim/hex'], Hunger = VB['sim/hunger'];
const [scenario, seed, years] = [process.argv[2], +process.argv[3], +process.argv[4]];
const it = G.generate(seed, { cols: 180, rows: 130 }); let r; while (!(r = it.next()).done);
const st = Sim.seed(r.value, seed, scenario);
const out = { scenario, seed, rows: [], lone: [], becameLone: [] };
const grownN = (h) => h.members.filter((m) => st.pawns[m].alive && st.pawns[m].age >= 16).length;
const villageOf = (h) => st.farmsteads[h.farmstead].village;
const fieldsOf = (h) => { const f = st.farmsteads[h.farmstead]; return f ? f.fields.length : 0; };
// A household that could take in a member of h: a live household other than h holding a grown (18+) parent, child or sibling of a member.
function kinHomes(h) {
  const homes = new Set();
  for (const m of h.members) for (const k of Rec.kinNear(st, m)) {
    const q = st.pawns[k]; if (!q.alive || q.age < 18 || q.household === null || q.household === h.id) continue;
    const g = st.households[q.household]; if (!g.dissolved) homes.add(g.id);
  }
  return [...homes];
}
// Cousins and closer (kinship of 1/16 or more) in other households, grown: the reach of `kinship`, as careForOrphans reads it.
function cousinHomes(h) {
  const homes = new Set(), memo = new Map();
  for (const id of st.living) {
    const q = st.pawns[id]; if (q.age < 18 || q.household === null || q.household === h.id || st.households[q.household].dissolved) continue;
    for (const m of h.members) if (Rec.kinship(st, m, id, memo) >= 1 / 16) { homes.add(q.household); break; }
  }
  return [...homes];
}
function snap(h) {
  const v = villageOf(h), vc = st.villages[v].center, steps = (g) => (villageOf(g) === v ? 0 : Hex.hexSteps(st.w, st.villages[villageOf(g)].center, vc));
  const near = kinHomes(h).map((id) => st.households[id]), cous = cousinHomes(h).map((id) => st.households[id]);
  const spare = (g) => Svc.hands(st, g) - Math.max(1, fieldsOf(g)) >= 1; // a kin home with a hand beyond one per field
  const serve = st.demand.filter((id) => { const q = st.pawns[id]; return q.alive && q.household !== null && q.household !== h.id && Svc.unfit(st, q) === null
    && Svc.handsLeft(st, q) >= SERVICE.keepHands; }).map((id) => steps(st.households[st.pawns[id].household]));
  // grown kin (cousins and closer) free to come: unmarried, 18 to 50, landless, no plot, no ward (Svc.unfit), whose household keeps a grown member
  const memo = new Map(), free = [];
  for (const id of st.living) {
    const q = st.pawns[id]; if (q.household === null || q.household === h.id || Svc.unfit(st, q) !== null) continue;
    const from = st.households[q.household]; if (from.dissolved || grownN(from) < 2) continue;
    if (h.members.some((m) => Rec.kinship(st, m, id, memo) >= 1 / 16)) free.push(steps(from));
  }
  const holder = h.holder !== null ? st.pawns[h.holder] : null;
  return { members: h.members.length, grown: grownN(h), holderAge: holder ? holder.age : null, guardian: h.guardian ?? null, fields: fieldsOf(h),
    hands: Svc.hands(st, h), grain: Math.round(h.grain),
    kinVillage: near.filter((g) => steps(g) === 0).length, kinReach: near.filter((g) => steps(g) <= SERVICE.reach).length, kinAny: near.length,
    kinVillageSpare: near.filter((g) => steps(g) === 0 && spare(g)).length,
    cousinVillage: cous.filter((g) => steps(g) === 0).length, cousinReach: cous.filter((g) => steps(g) <= SERVICE.reach).length, cousinAny: cous.length,
    serveVillage: serve.filter((d) => d === 0).length, serveReach: serve.filter((d) => d <= SERVICE.reach).length,
    freeKinVillage: free.filter((d) => d === 0).length, freeKinReach: free.filter((d) => d <= SERVICE.reach).length };
}
const loneSince = new Map(), wasLone = new Map();
const noteLone = (h, y) => {
  const lone = grownN(h) <= 1, was = wasLone.get(h.id);
  if (lone && was !== true) {
    loneSince.set(h.id, st.t); if (y > 3 && fieldsOf(h) > 0) out.becameLone.push({ y, id: h.id, founded: was === undefined, fields: fieldsOf(h),
    members: h.members.length, holderAge: h.holder !== null ? st.pawns[h.holder].age : null }); }
  wasLone.set(h.id, lone);
};
for (const id of st.liveHouseholds) noteLone(st.households[id], 0);
for (let y = 1; y <= years; y++) {
  const h0 = new Map(), days = new Map(), loneDays = new Map(), first = new Map(), blk = new Map(), hs0 = new Map();
  for (const id of st.liveHouseholds) h0.set(id, st.households[id].hungryDays);
  for (let d = 0; d < YEAR_DAYS; d++) {
    for (const id of st.liveHouseholds) hs0.set(id, st.households[id].hungryDays);
    Sim.advance(st, DAY);
    for (const id of st.liveHouseholds) {
      const h = st.households[id]; noteLone(h, y);
      days.set(id, (days.get(id) || 0) + 1); if (!h0.has(id)) h0.set(id, 0);
      if (wasLone.get(id)) loneDays.set(id, (loneDays.get(id) || 0) + 1);
      if (h.hungryDays > (hs0.get(id) ?? h.hungryDays)) {
        if (!first.has(id)) first.set(id, {
          t: st.t, loneFor: wasLone.get(id) ? +((st.t - loneSince.get(id)) / (YEAR_DAYS * DAY)).toFixed(2) : null, ...snap(h) });
        if (h.grain + (h.meals || 0) >= Hunger.dailyNeed(st, h) - 1e-6) blk.set(id, (blk.get(id) || 0) + 1);
      }
    }
  }
  if (y <= 3) continue;
  for (const [id, n] of days) {
    const h = st.households[id], hung = h.hungryDays - h0.get(id), share = hung / Math.max(n, hung);
    if (n >= SEASON_DAYS && share > 0.3) out.rows.push({ y, id, n, hung, share: +share.toFixed(2), blocked: blk.get(id) || 0, dissolved: h.dissolved,
      endMembers: h.members.length, endHolderAge: h.holder !== null && st.pawns[h.holder] ? st.pawns[h.holder].age : null, endGrown: grownN(h),
        ...first.get(id) });
    if (n >= SEASON_DAYS && (loneDays.get(id) || 0) * 2 > n && fieldsOf(h) > 0) out.lone.push({
      y, id, share: +share.toFixed(2), fields: fieldsOf(h), dissolved: h.dissolved });
  }
}
console.log(JSON.stringify(out));
