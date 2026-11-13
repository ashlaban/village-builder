// @sys sim/trust: a farm held in trust by kin (VB-309): a household nobody can come to goes to its nearest kin household, which works its
// fields and takes their harvest while the owner, holder and line stay the same; the trust ends at the holder's marriage, a servant, a
// ward's coming of age, the trustee's end or the holder's death
VB['sim/trust'] = (() => {
  const { personEvent, log, fullName, spouseOf, childrenOf, isHolder, atHousehold, kinship } = VB['sim/records'];
  const { moveTo, refreshRoles, handOn } = VB['sim/heirs'];
  const { freeHands, dropJob } = VB['sim/agents'];
  const { issue } = VB['sim/commands'];
  const { houseCondition } = VB['sim/rules'];
  const { passHerds } = VB['sim/herds'];
  const Stores = VB['sim/stores'];
  const { kinHouseholds, shortOfPeople } = VB['sim/help'];
  const { trustOf } = VB['sim/ownership'];
  const { hexSteps } = VB['sim/hex'];
  const { SERVICE } = VB['sim/rules'];
  // @state st.trusts: every farm ever held in trust (design.md, Households short of people: Held by kin when nobody can come), by id, never
  //   reused: {id, household (the household whose farm is held; its holder, owner and line unchanged), trustee (the kin household that works
  //   it), ward (its holder while a minor, else null), people (the members who went to the trustee), start, end (null while it holds), why
  //   (how it ended: 'married', 'servant', 'of age', 'trustee gone', 'death', 'inherited')}; written only here; absent until the first.
  // @state st.liveTrusts: sorted ids of the live trusts in st.trusts (Rules for cost, 1): a cache owned here, read through sim/ownership.
  const farmOf = (st, hh) => st.farmsteads[hh.farmstead];
  // The jobs household ownerId has posted, on farm f only when f is given: dropped, their hands freed.
  function dropJobs(st, ownerId, f = null) {
    const mine = st.jobsBy.get(`household:${ownerId}`);
    if (!mine) return;
    for (const j of [...mine])
      if (f === null || j.farm === f) {
        if (j.claims.length) freeHands(st, j, -1);
        dropJob(st, j);
      }
  }
  // Whether household g lies within the service reach of household hh: one village, or village centres SERVICE.reach steps apart or less
  // (the placement of every service rule, sim/service's reachSteps).
  function inReach(st, g, hh) {
    const u = farmOf(st, g).village,
      v = farmOf(st, hh).village;
    return u === v || hexSteps(st.w, st.villages[u].center, st.villages[v].center) <= SERVICE.reach;
  }
  // The kin household that would hold hh's farm in trust, or null: the first of its kin households (sim/help's kinHouseholds: parents and
  // children before siblings, then by id) within reach that is not itself short of people nor held in trust. For an orphaned heir (`ward`)
  // with none, the household of its nearest grown kin within reach that is not short of people, by kinship then the oldest, as the children
  // of a farm that empties go to kin (sim/heirs, kinHomeFor).
  function trusteeFor(st, hh, ward = null) {
    for (const k of kinHouseholds(st, hh)) {
      const g = st.households[k];
      if (!trustOf(st, k) && !shortOfPeople(st, g) && inReach(st, g, hh)) return k;
    }
    if (ward === null) return null;
    const memo = new Map();
    let best = null,
      bk = 0;
    VB.count.takeInWeighed += st.living.length;
    for (const id of st.living) {
      const q = st.pawns[id];
      if (!q.alive || q.age < 18 || q.household === null || q.household === hh.id) continue;
      const g = st.households[q.household];
      if (g.dissolved || shortOfPeople(st, g) || !inReach(st, g, hh)) continue;
      const k = kinship(st, ward, id, memo);
      if (k > bk || (k === bk && k > 0 && q.born < best.born)) {
        best = q;
        bk = k;
      }
    }
    return best ? best.household : null;
  }
  // Household hh (at most one grown member, nobody to come, or an orphaned heir with no guardian, `ward`) goes to its trusteeFor, which
  // holds its farm in trust: its people move there with its grain and animals; its own tasks are taken down; the house stands empty, its
  // condition kept from now as an empty farm's (sim/rules' houseCondition, the clock's decay); the trustee posts the farm's field work as its
  // own (sim/jobs), and its harvest comes to the trustee's barn as any of its work's does. `why`: the end of the log line.
  function holdInTrust(st, hh, why, ward = null) {
    const trustee = trusteeFor(st, hh, ward);
    const f = farmOf(st, hh),
      k = st.households[trustee],
      holder = st.pawns[hh.holder];
    f.condition = houseCondition(st, f);
    if (!st.trusts) st.trusts = [];
    if (!st.liveTrusts) st.liveTrusts = [];
    const t = {
      id: st.trusts.length,
      household: hh.id,
      trustee,
      ward: holder.age < 18 ? holder.id : null,
      people: hh.members.filter((id) => st.pawns[id].alive),
      start: st.t,
      end: null,
      why: null,
    };
    st.trusts.push(t);
    st.liveTrusts.push(t.id); // ids rise, so the cache stays sorted
    dropJobs(st, hh.id);
    Stores.move(st, hh, k, 'grain', Stores.grainOf(hh), 'handingOn');
    passHerds(st, hh, trustee);
    const at = farmOf(st, k).name;
    for (const id of t.people) moveTo(st, id, trustee, `Moved to kin at ${at}, who hold ${f.name} in trust`);
    log(st, `${fullName(holder)} of ${f.name} ${why}, and goes to kin at ${at}, who hold the farm in trust.`, {
      kind: 'moved',
      pawn: holder.id,
      other: k.holder,
      ...atHousehold(st, hh),
    });
    refreshRoles(st);
    st.visualDirty = true;
    return t;
  }
  // The trust ends, its people where they are: the record closed, the house wearing again from the condition it kept, the trustee's tasks
  // on the farm taken down. Its own act at the holder's death (succession then as today); the return's first step.
  function closeTrust(st, t, why) {
    const hh = st.households[t.household],
      f = farmOf(st, hh);
    t.end = st.t;
    t.why = why;
    st.liveTrusts = st.liveTrusts.filter((id) => id !== t.id);
    f.condAt = st.t;
    dropJobs(st, t.trustee, f);
    log(st, `${f.name} is no longer held in trust by kin at ${farmOf(st, st.households[t.trustee]).name} (${why}).`, {
      kind: 'moved',
      pawn: hh.holder,
      ...atHousehold(st, hh),
    });
  }
  // The holder goes back to the farm held in trust (the goBack command): with a spouse and minor children living with the trustee, and those
  // of its people who went with it and still live there unmarried; with them, their part of the trustee's grain (its store by mouths).
  function endTrust(st, t, why) {
    const hh = st.households[t.household],
      k = st.households[t.trustee],
      holder = hh.holder,
      sp = spouseOf(st, holder);
    const minor = (id) => st.pawns[id].age < 18 && !isHolder(st, id);
    const going = [
      holder,
      ...(sp !== null ? [sp] : []),
      ...childrenOf(st, holder).filter(minor),
      ...t.people.filter((id) => id !== holder && spouseOf(st, id) === null && !isHolder(st, id)),
    ].filter((id, i, a) => a.indexOf(id) === i && st.pawns[id].alive && st.pawns[id].household === k.id);
    const n = (Stores.grainOf(k) * going.length) / Math.max(1, k.members.length);
    closeTrust(st, t, why);
    if (n > 0) Stores.move(st, k, hh, 'grain', n, 'handingOn');
    for (const id of going) moveTo(st, id, hh.id, `Went back to ${farmOf(st, hh).name}`);
    personEvent(st, holder, 'moved', `Went back to ${farmOf(st, hh).name}, held in trust by kin until then`, false); // below
    log(st, `${fullName(st.pawns[holder])} goes back to ${farmOf(st, hh).name}.`, {
      kind: 'moved',
      pawn: holder,
      ...atHousehold(st, hh),
    });
    refreshRoles(st);
    st.visualDirty = true;
  }
  const goBack = (st, t, why, src) =>
    issue(st, {
      actor: st.households[t.household].holder,
      verb: 'goBack',
      target: t.household,
      args: { why },
      source: src,
    });
  // Daily, with sim/heirs' comeOfAge: a ward of 18 goes back to the farm held for it.
  function wardsOfAge(st) {
    if (!st.liveTrusts || !st.liveTrusts.length) return;
    for (const id of st.liveTrusts.slice()) {
      const t = st.trusts[id];
      if (t.ward !== null && st.pawns[t.ward].alive && st.pawns[t.ward].age >= 18) goBack(st, t, 'of age', 'trust');
    }
  }
  // After a death or a retirement hands a farm on (sim/lifecycle): when the trustee's new holder is the holder of the farm it holds, that
  // holder now keeps a farm where it lives, and hands the held one on as a holder who marries onto another farm does (handOn).
  function inheritedHeld(st) {
    if (!st.liveTrusts || !st.liveTrusts.length) return;
    for (const id of st.liveTrusts.slice()) {
      const t = st.trusts[id],
        hh = st.households[t.household],
        k = st.households[t.trustee];
      if (k.dissolved || k.holder !== hh.holder) continue;
      closeTrust(st, t, 'inherited');
      handOn(st, hh, hh.holder, k.id);
    }
  }
  return { trusteeFor, holdInTrust, closeTrust, endTrust, goBack, wardsOfAge, inheritedHeld };
})();
