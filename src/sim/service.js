// @sys sim/service: households short of people: a guardian for orphaned minor heirs, and a servant for a holder who lives alone
VB['sim/service'] = (() => {
  const { personEvent, log, fullName, spouseOf, childrenOf, isHolder, kinship } = VB['sim/records'];
  const { moveTo, refreshRoles, setGuardian, extinct } = VB['sim/heirs'];
  const { hexSteps } = VB['sim/hex'];
  const { SERVICE } = VB['sim/rules'];
  const { hasPlot } = VB['sim/expansion'];
  const adult = (p) => p.alive && p.age >= 18;
  // a before b, comparing arrays of numbers element by element
  const before = (a, b) => { for (let k = 0; k < a.length; k++) if (a[k] !== b[k]) return a[k] < b[k]; return false; };
  const farmOf = (st, hh) => st.farmsteads[hh.farmstead];
  // a farm by name, with its village's name when it lies in another village than `here` (farm names repeat between villages)
  const farmIn = (st, hh, here = null) => { const f = farmOf(st, hh); return f.village === here ? f.name : `${f.name} in ${st.villages[f.village].name}`; };
  const isGuardian = (st, id) => st.households.some((h) => !h.dissolved && h.guardian === id);
  // Working hands of a household: members of 14 to 59 who have not retired (as VB-090 counts them).
  const hands = (st, hh) => hh.members.filter((id) => { const p = st.pawns[id]; return p.alive && p.age >= 14 && p.age < 60 && !p.retired; }).length;
  // An adult who wants land (st.demand, refreshed at each moving round) and can move: alive, landless still, with no plot coming, not a guardian.
  const free = (st, p) => adult(p) && !p.retired && p.household !== null && !isHolder(st, p.id) && !hasPlot(st, p.id) && !isGuardian(st, p.id)
    && (spouseOf(st, p.id) === null || !isHolder(st, spouseOf(st, p.id)));

  // ---- guardians (stability review) ----
  // A minor heir holds in name with a guardian until 18 (sim/heirs), but when no adult is left in the house, a child kept the farm alone and
  // mostly starved. Daily, a household with no adult takes in the ward's nearest landless adult relative (by kinship, then the oldest), with
  // their spouse and the minor children who live with them, and that relative becomes the guardian. With no such relative, the children go to
  // their nearest kin (or into service in the village) and the farm stands empty, as one that dies out.
  function familyOf(st, id) {
    const p = st.pawns[id], out = [id], sp = spouseOf(st, id);
    if (sp !== null && st.pawns[sp].alive && st.pawns[sp].household === p.household) out.push(sp);
    for (const q of out.slice()) for (const c of childrenOf(st, q)) {
      const k = st.pawns[c];
      if (k.alive && k.age < 18 && k.household === p.household && !out.includes(c) && !isHolder(st, c)) out.push(c);
    }
    return out;
  }
  function careForOrphans(st) {
    for (const hh of st.households) {
      if (hh.dissolved || !hh.members.length || hh.members.some((id) => adult(st.pawns[id]))) continue;
      const ward = st.pawns[hh.holder], f = farmOf(st, hh), memo = new Map();
      let best = null, bk = 0;
      for (const id of st.demand) {
        const q = st.pawns[id]; if (!free(st, q) || q.household === hh.id) continue;
        const k = kinship(st, ward.id, id, memo); if (k <= 0) continue;
        if (!best || k > bk || (k === bk && q.born < best.born)) { best = q; bk = k; }
      }
      if (best) {
        for (const id of familyOf(st, best.id)) moveTo(st, id, hh.id);
        setGuardian(st, hh, ward.id);
        personEvent(st, best.id, 'guardian', `Became guardian of ${fullName(ward)} at ${f.name}`);
        log(st, `${fullName(best)} moves to ${f.name} as guardian of ${fullName(ward)}, who was left there with no grown kin.`);
      } else extinct(st, hh, `its heir ${fullName(ward)} is a child, with no grown kin to keep it`);
      refreshRoles(st); st.visualDirty = true;
    }
  }

  // ---- a servant for the lone (stability review; a slice of VB-090) ----
  // At the moving round, after marriages and moves to new land: a holder of 18 or more who lives alone takes in an unmarried adult who wants
  // land (st.demand) as farmhand or maid, if that adult's household keeps at least SERVICE.keepHands working hands without them: from the
  // holder's village first, then from the nearest village whose centre lies within SERVICE.reach steps; among them, the one whose household
  // keeps the most hands, then the oldest. The servant still wants land, as VB-090 has it, and may marry the holder.
  function takeServants(st) {
    const lone = st.households.filter((h) => !h.dissolved && h.members.length === 1 && adult(st.pawns[h.holder]));
    if (!lone.length) return;
    const village = (hh) => farmOf(st, hh).village;
    for (const hh of lone) {
      if (hh.members.length !== 1) continue;
      const v = st.villages[village(hh)], holder = st.pawns[hh.holder];
      let best = null, bs = null;
      for (const id of st.demand) {
        const q = st.pawns[id]; if (!free(st, q) || spouseOf(st, id) !== null || q.age > SERVICE.ages[1] || q.age < SERVICE.ages[0]) continue;
        const from = st.households[q.household]; if (from.dissolved || from.members.length < 2) continue;
        const left = hands(st, from) - (q.age >= 14 && q.age < 60 ? 1 : 0); if (left < SERVICE.keepHands) continue;
        const u = st.villages[village(from)], d = u.id === v.id ? 0 : hexSteps(st.w, u.center, v.center);
        if (d > SERVICE.reach) continue;
        const s = [d, -left, q.born];
        if (!bs || before(s, bs)) { best = q; bs = s; }
      }
      if (!best) continue;
      const from = farmIn(st, st.households[best.household], v.id);
      moveTo(st, best.id, hh.id); best.servant = true;
      personEvent(st, best.id, 'service', `Went into service with ${fullName(holder)} at ${farmIn(st, hh)}`);
      log(st, `${fullName(best)} of ${from} goes into service with ${fullName(holder)} at ${farmIn(st, hh)}, who lived alone.`);
    }
    refreshRoles(st); st.visualDirty = true;
  }
  return { careForOrphans, takeServants, hands };
})();
