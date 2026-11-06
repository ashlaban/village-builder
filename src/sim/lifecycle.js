// @sys sim/lifecycle: deaths, retirement, village meetings, the moving round and the daily life step
VB['sim/lifecycle'] = (() => {
  const { next: rnd, drawer } = VB['sim/rng'];
  const Culture = VB['culture'];
  const { YEAR_DAYS, YEAR, cal, HUNGER, MARRIAGE } = VB['sim/rules'];
  const { dailyNeed, seedReserve, larderOf } = VB['sim/hunger'];
  const { deathRoll, CAUSES } = VB['sim/deaths'];
  const {
    leaveHousehold, unionOf, wasWidowed, noteDeath, personEvent, log, age, fullName, spouseOf, kinDegree, settlementIdOf, practice, farmPractice, noteUnionEnd,
      holdingOf, atHousehold,
  } = VB['sim/records'];
  const { stillAtDeath } = VB['sim/agents'];
  const {
    heirRanking, moveTo, transfer, succession, comeOfAge, refreshRoles, countDemand, handOn, heirFor, roundHeirs,
  } = VB['sim/heirs'];
  const { startPlots } = VB['sim/expansion'];
  const { claimFarms } = VB['sim/farmclaims'];
  const { settleRound } = VB['sim/settle'];
  const { careForOrphans, takeServants } = VB['sim/service'];
  const { payOwed } = VB['sim/cottage'];
  const { fillStores } = VB['sim/help'];
  const { updateTies, refreshPrestige, refreshInterests, hooks } = VB['sim/society'];
  const { issue } = VB['sim/commands'];
  const { fadeRelations, forget, dropTies, setTie, dailyTies } = VB['sim/relations'];
  function killPawn(st, id, cause = 'killed') {
    const p = st.pawns[id]; if (!p.alive) return;
    p.died = st.t; p.alive = false; noteDeath(st, id);
    p.events.push({ t: st.t, kind: 'died', text: CAUSES[cause].event, cause });
    const a = st.agents[id]; stillAtDeath(st, a);
    const u = unionOf(st, id); if (u) { u.end = st.t; noteUnionEnd(st, u); }
    dropTies(st, id);
    if (p.rel) forget(st, id);
    log(st, `${fullName(p)} of ${p.household !== null ? st.farmsteads[st.households[p.household].farmstead].name : 'the island'} `
      + `${CAUSES[cause].log}, aged ${p.age}.`, {
        kind: 'died', pawn: id, text: cause, ...(p.household !== null ? atHousehold(st, st.households[p.household]) : {}) });
    const hh = p.household !== null ? st.households[p.household] : null;
    if (hh) { leaveHousehold(st, id, true); if (hh.holder === id) succession(st, hh, 'death'); }
    refreshRoles(st); refreshPrestige(st); st.visualDirty = true;
  }
  function retireHolder(st, hhId) {
    const hh = st.households[hhId]; if (!hh || hh.dissolved) return false;
    const r = heirRanking(st, hh); if (!r.length) return false;
    transfer(st, hh, r[0], 'retirement'); refreshRoles(st); refreshPrestige(st); return true;
  }
  function holdMeetings(st) {
    const env = st.cenv, hk = hooks(st); env.t = st.t / YEAR;
    refreshRoles(st); refreshPrestige(st); refreshInterests(st); updateTies(st);
    const starters = Culture.entrepreneurs(env, hk, drawer(st.rng.culture));
    for (const p of starters) {
      personEvent(st, p.id, 'cause',
        `Took up the cause: ${Culture.DIMS[p.advocate.dim].label.toLowerCase()}, ${Culture.DIMS[p.advocate.dim].opts[p.advocate.opt][1].toLowerCase()}`);
    }
    const c = cal(st.t), out = [];
    for (const s of env.settlements) {
      const ch = Culture.meeting(env, hk, s);
      for (const x of ch) {
        const d = Culture.DIMS[x.dim],
          txt = `At the ${s.name} meeting: ${d.label.toLowerCase()} is now “${d.opts[x.to][1]}” (was “${d.opts[x.from][1]}”).`;
        log(st, txt, { kind: 'custom', village: s.id }); out.push({ year: c.year, text: txt });
      }
    }
    for (const cu of env.cultures) {
      const r = Culture.cultureYear(env, hk, cu);
      for (const x of r.changes) {
        const d = Culture.DIMS[x.dim], txt = `Across the ${cu.name} culture: ${d.label.toLowerCase()} is now “${d.opts[x.to][1]}”.`;
        log(st, txt, { kind: 'custom', village: cu.centres[0] }); out.push({ year: c.year, text: txt });
      }
    }
    st.meetingLog.unshift(...out.length ? out : [{ year: c.year, text: 'The meetings changed nothing this year.' }]);
    st.meetingLog.length = Math.min(st.meetingLog.length, 30);
    st.lastMeeting = st.t;
  }
  // the closest degree each kinLimit option allows; siblings, half-siblings and direct lines (degree 2 or less) never marry
  const kinOk = (st, a, b, cu, opt = cu.kinLimit) => {
    const d = kinDegree(st, a, b);
    return d > 2 && d >= MARRIAGE.kinDegree[opt];
  };
  const kinOpts = Culture.DIMS[Culture.IDX.kinLimit].opts.map((o) => o[0]); // strictest first
  // Scarcity and plenty of spouses push the marriage limit: an adult who finds no allowed partner but would under the next looser
  // option pulls towards it; one who married a partner also allowed under the next stricter option pulls back, at half the weight.
  function kinPressure(st, men, women, taken, homeFor) {
    const env = st.cenv, blocked = new Map(), at = (cu) => kinOpts.indexOf(cu.kinLimit);
    // Annual historical cleanup also clears the last pressure recorded on people who have since died.
    for (const p of st.pawns) p.kinPush = null;
    const wed = new Map();
    for (const id of st.living) { const u = unionOf(st, id); if (u && u.start === st.t) wed.set(u.id, u); }
    // Unions were visited in record order; retain that order for equal-time remarriages too.
    const pairs = [...wed.values()].sort((a, b) => a.id - b.id); wed.clear();
    for (const u of pairs) { wed.set(u.a, u.b); wed.set(u.b, u.a); }
    for (const [x, y] of wed) {
      const cu = practice(st, settlementIdOf(st, st.pawns[x])), k = at(cu);
      if (k > 0 && kinOk(st, x, y, cu, kinOpts[k - 1])) st.pawns[x].kinPush = { to: kinOpts[k - 1], w: MARRIAGE.plentyPush };
    }
    for (const [mine, others] of [[men, women], [women, men]]) {
      for (const p of mine) {
        if (taken.has(p.id) || wed.has(p.id)) continue;
        const s = settlementIdOf(st, p); if (s === null) continue;
        const cu = practice(st, s), k = at(cu); if (k >= kinOpts.length - 1) continue;
        const can = (o, opt) => !taken.has(o.id) && (p.sex === 'm' ? homeFor(p, o, cu) : homeFor(o, p, cu)) !== null && kinOk(st, p.id, o.id, cu, opt);
        if (others.some((o) => can(o, cu.kinLimit)) || !others.some((o) => can(o, kinOpts[k + 1]))) continue;
        p.kinPush = { to: kinOpts[k + 1], w: MARRIAGE.scarcePush }; blocked.set(s, (blocked.get(s) || 0) + 1);
      }
    }
    const c = cal(st.t), out = [];
    for (const [s, n] of blocked) {
      const txt = `At the ${env.settlements[s].name} moving round, ${n} adult${n > 1 ? 's' : ''} found no spouse only because of kin.`;
      log(st, txt, { kind: 'kinBarred', village: s, n }); out.push({ year: c.year, text: txt });
    }
    st.meetingLog.unshift(...out); st.meetingLog.length = Math.min(st.meetingLog.length, 30);
  }
  // A marriage (the marry command, VB-171): the union, both move to the home household, the event, ties, and a spouse who held a farm of
  // their own hands it on (VB-153).
  function wed(st, mId, fId, home) {
    const m = st.pawns[mId], f = st.pawns[fId];
    st.unions.push({ id: st.unions.length, a: mId, b: fId, start: st.t, end: null, kind: 'marriage' });
    for (const id of [mId, fId]) {
      if (st.pawns[id].household !== home) moveTo(st, id, home);
      personEvent(st, id, 'married', `Married ${fullName(st.pawns[id === mId ? fId : mId])}`, false); st.rigDirty.add(id); // recorded below
    }
    const fm = st.farmsteads[st.households[home].farmstead];
    log(st, `${fullName(m)} and ${fullName(f)} marry and live at ${fm.name}.`, {
      kind: 'married', pawn: mId, other: fId, ...atHousehold(st, st.households[home]) });
    setTie(st, mId, fId, 2); setTie(st, fId, mId, 2);
    for (const id of [mId, fId]) { const own2 = holdingOf(st, id); if (own2 && own2.id !== home) handOn(st, own2, id, home); }
  }
  function movingRound(st) {
    let pairs = 0;
    const env = st.cenv; refreshRoles(st); fillStores(st);
    const alive = st.living.map((id) => st.pawns[id]);
    for (const p of alive) p.age = age(st, p);
    const single = (p) => spouseOf(st, p.id) === null && p.died === null;
    // marriages: a couple needs a place to live, as the customs define it
    const fed = (p) => p.hunger < HUNGER.marryBelow;
    const widowed = new Set(); // the single who have been married: their marriage ended by a death (balance review)
    for (const p of alive) if (wasWidowed(st, p.id)) widowed.add(p.id);
    const men = alive.filter((p) => p.sex === 'm' && p.age >= MARRIAGE.menFrom && single(p) && !p.retired && fed(p)),
      women = alive.filter((p) => p.sex === 'f' && p.age >= MARRIAGE.womenFrom && single(p) && !p.retired && fed(p));
    // Where each pawn would live if married (placeIfMarried), cached until the next marriage changes the families: ranking every farm's
    // heirs for every pair of candidates made the round cost about a second at populous medium.
    const heirs = roundHeirs(st), places = new Map(), homes = new Map(alive.map((p) => [p.id, p.household]));
    const place = (id) => {
      if (!places.has(id)) {
        const hh = st.households[st.pawns[id].household];
        places.set(id, hh && !hh.dissolved && (hh.holder === id || heirs.rank(hh.id)[0] === id) ? hh.id : null);
      }
      return places.get(id);
    };
    men.sort((x, y) => (place(y.id) !== null) - (place(x.id) !== null) || x.born - y.born);
    const taken = new Set();
    // Where a couple would live, or null. Under 'land' one of them needs a place (the farm they hold or are first heir to). When both have one
    // (VB-153): a holder keeps their farm and a spouse who is only first heir steps out of that line; of two holders, the couple lives where
    // the other farm is best handed on (handOn: an adult heir, then a landless adult of its village, then a child or nobody), then on the
    // farm with more fields, the man's on a tie. Under the other customs the spouse's home counts.
    const fieldsAt = (h) => st.farmsteads[st.households[h].farmstead].fields.length;
    const handed = new Map();
    const handsOnWell = (h) => {
      if (!handed.has(h)) {
        const hh = st.households[h], heir = heirFor(st, hh, heirs.rank(h), hh.holder), v = st.farmsteads[hh.farmstead].village;
        const grown = heir !== null && (st.pawns[heir].age >= 18 || hh.members.some((id) => id !== hh.holder && st.pawns[id].age >= 18));
        handed.set(h, grown ? 2 : st.demand.some((id) => st.pawns[id].alive && settlementIdOf(st, st.pawns[id]) === v) ? 1 : 0);
      }
      return handed.get(h);
    };
    const both = (m, f, pm, pf) => {
      const hm = st.households[pm].holder === m.id, hf = st.households[pf].holder === f.id;
      if (hm !== hf) return hm ? pm : pf;
      if (hm && hf && handsOnWell(pm) !== handsOnWell(pf)) return handsOnWell(pm) > handsOnWell(pf) ? pf : pm;
      return fieldsAt(pf) > fieldsAt(pm) ? pf : pm;
    };
    const homeFor = (m, f, cu, pm = place(m.id), pf = place(f.id)) => {
      if (cu.residence === 'land') return pm !== null && pf !== null ? both(m, f, pm, pf) : pm !== null ? pm : pf;
      return cu.residence === 'husband' ? m.household : f.household;
    };
    // The means to marry (VB-153): the home holds food above its seed for MARRIAGE.means years of its members and one more, counting grain
    // still in sheaf and the larder, so that marriages fall after a bad harvest (the preventive check). A home with fewer than two adults
    // needs no means: a lone holder, or a widow with small children, needs the spouse's hands. Cached per household until a marriage.
    const means = new Map();
    const affords = (h) => {
      if (!means.has(h)) {
        const hh = st.households[h], store = hh.grain + hh.rations + hh.unthreshed.reduce((a, x) => a + (+x || 0), 0) + larderOf(hh);
        const grown = hh.members.filter((id) => st.pawns[id].alive && st.pawns[id].age >= 18).length;
        means.set(h, grown < 2 || store - seedReserve(st, hh) >= MARRIAGE.means * YEAR_DAYS * (dailyNeed(st, hh) + st.ECON.ration.adult));
      }
      return means.get(h);
    };
    const putOff = new Map(); // village -> couples who put off marrying for want of means
    const changedSince = (mark, people, households) => {
      for (const e of st.record.slice(mark)) {
        if (e.household !== undefined && e.household !== null) households.add(e.household);
        for (const id of [e.pawn, e.other]) if (id !== undefined && id !== null) {
          people.add(id); households.add(homes.get(id)); households.add(st.pawns[id].household);
        }
      }
      households.delete(null); households.delete(undefined);
      const dirty = heirs.invalidate(people, households);
      for (const h of households) means.delete(h);
      for (const h of dirty) {
        handed.delete(h);
        for (const id of st.households[h].members) places.delete(id);
      }
      for (const id of people) { places.delete(id); homes.set(id, st.pawns[id].household); }
    };
    let housed = null;
    for (const m of men) {
      const sm = settlementIdOf(st, m), cu = practice(st, sm);
      let best = null, bs = -Infinity;
      const pm = place(m.id);
      // With land residence and no place of his own, only women with a place can be candidates.
      // Keep the original order and random draws; skip pairs whose homeFor would return null.
      if (cu.residence === 'land' && pm === null && !housed) housed = women.filter((p) => place(p.id) !== null);
      for (const f of cu.residence === 'land' && pm === null ? housed : women) {
        pairs++;
        if (taken.has(f.id) || !kinOk(st, m.id, f.id, cu)) continue;
        const home = homeFor(m, f, cu, pm);
        if (home === null) continue;
        const sf = settlementIdOf(st, f), sameV = sf === sm, tie = env.settlements[sf] ? env.settlements[sf].tie : 0;
        const gw = widowed.has(m.id) || widowed.has(f.id) ? MARRIAGE.widowedGapWeight : MARRIAGE.gapWeight;
        const s = -Math.abs(m.age - f.age - MARRIAGE.ageGap) * gw
          + (sameV ? MARRIAGE.sameVillage : 2 * Math.min(tie, env.settlements[sm].tie)) + rnd(st.rng.society) * MARRIAGE.noise;
        if (s > bs) { bs = s; best = { f, home }; }
      }
      if (!best || bs < MARRIAGE.minScore || rnd(st.rng.society) > MARRIAGE.goAhead) continue;
      if (!affords(best.home)) { putOff.set(sm, (putOff.get(sm) || 0) + 1); continue; }
      taken.add(best.f.id);
      const mark = st.record.length;
      issue(st, { actor: m.id, verb: 'marry', target: best.f.id, args: { home: best.home }, source: 'round' });
      housed = null;
      const people = new Set([m.id, best.f.id]), households = new Set([homes.get(m.id), homes.get(best.f.id), best.home]);
      // Commands record all moves, transfers and extinctions, including children and third-party claimants.
      changedSince(mark, people, households);
      // Marriage can move a village's last waiting adult, and a claim can remove one from demand.
      // Other farms in either village must refresh their fallback handover score too.
      for (const h of handed.keys()) {
        const v = st.farmsteads[st.households[h].farmstead].village;
        if ([...households].some((id) => st.farmsteads[st.households[id].farmstead].village === v)) handed.delete(h);
      }
    }
    for (const [v, n] of putOff) {
      log(st, `At the ${st.villages[v].name} moving round, ${n} couple${n > 1 ? 's' : ''} put off marrying: the farm cannot feed another mouth.`, {
        kind: 'putOff', village: v, n });
    }
    kinPressure(st, men, women, taken, homeFor);
    // handovers by custom: when the heir marries, or when the holder turns 60
    for (const liveId of st.liveHouseholds) {
      const hh = st.households[liveId];
      if (hh.dissolved) continue;
      const f = st.farmsteads[hh.farmstead], cu = farmPractice(st, f), holder = st.pawns[hh.holder], heir = heirs.rank(hh.id)[0];
      if (heir === undefined || st.pawns[heir].age < 18) continue;
      const why = cu.handover === 'marriage' && spouseOf(st, heir) !== null && st.pawns[heir].household === hh.id ? 'marriage'
        : cu.handover === 'age60' && holder.age >= 60 ? 'retirement' : null;
      if (why) {
        const mark = st.record.length, old = hh.holder;
        issue(st, { actor: old, verb: 'handOn', target: heir, args: { household: hh.id, reason: why }, source: 'round' });
        changedSince(mark, new Set([old, heir]), new Set([hh.id]));
      }
    }
    refreshRoles(st);
    // who wants out: landless adults with no prospect of a farm
    countDemand(st, heirs.rank);
    claimFarms(st); // empty farms go to claimants by custom before any plot is cleared
    startPlots(st);
    settleRound(st); // adults of a crowded village may leave for new land (docs/review-expansion.md)
    takeServants(st); // a holder who lives alone takes in a landless adult (sim/service)
    payOwed(st);
    refreshPrestige(st);
    VB.count.roundPairs += pairs;
    st.visualDirty = true;
  }
  function dailyLife(st, c) {
    const env = st.cenv;
    VB.count.walkDaily += st.living.length;
    for (const id of st.living) { const p = st.pawns[id]; p.age = age(st, p); }
    comeOfAge(st);
    careForOrphans(st); // a household with no adult left takes in a guardian (sim/service)
    dailyTies(st);
    if (c.sday === 0) fadeRelations(st);
    env.t = st.t / YEAR; env.driftMul = st.driftMul;
    Culture.dailyStep(env, hooks(st), 1 / YEAR_DAYS, drawer(st.rng.culture));
    if (st.naturalDeaths) {
      VB.count.walkDaily += st.living.length;
      // Death splices the live index; visit the original ids once, in the original order.
      for (const id of st.living.slice()) {
        const p = st.pawns[id];
        if (p.alive) { const cause = deathRoll(st, p); if (cause) killPawn(st, p.id, cause); }
      }
    }
  }
  return { killPawn, retireHolder, holdMeetings, kinOk, wed, movingRound, dailyLife };
})();
