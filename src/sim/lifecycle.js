// @sys sim/lifecycle: deaths, retirement, village meetings, the moving round and the daily life step
VB['sim/lifecycle'] = (() => {
  const Culture = VB['culture'];
  const { YEAR_DAYS, YEAR, cal, HUNGER, MARRIAGE } = VB['sim/rules'];
  const { deathRoll, CAUSES } = VB['sim/deaths'];
  const {
    personEvent, log, age, fullName, spouseOf, kinDegree, kinNear, settlementIdOf, practice, farmPractice, noteUnionEnd,
  } = VB['sim/records'];
  const { release } = VB['sim/agents'];
  const { heirRanking, moveTo, transfer, succession, comeOfAge, refreshRoles, placeIfMarried, wantsOut, firstHeirs, ownFirstOf } = VB['sim/heirs'];
  const { startPlots } = VB['sim/expansion'];
  const { payOwed } = VB['sim/cottage'];
  const { fillStores } = VB['sim/help'];
  const { updateTies, refreshPrestige, refreshInterests, pairOf } = VB['sim/society'];
  const { fadeRelations, forget } = VB['sim/relations'];
  function killPawn(st, id, cause = 'killed') {
    const p = st.pawns[id]; if (!p.alive) return;
    p.died = st.t; p.alive = false;
    p.events.push({ t: st.t, kind: 'died', text: CAUSES[cause].event, cause });
    const a = st.agents[id]; release(st, a); a.path = null; a.inside = true;
    for (const u of st.unions) if ((u.a === id || u.b === id) && u.end === null) { u.end = st.t; noteUnionEnd(st, u); }
    for (const [j] of p.ties) { const q = st.pawns[j]; if (q && q.ties) q.ties.delete(id); }
    if (p.rel) forget(st, id);
    log(st, `${fullName(p)} of ${p.household !== null ? st.farmsteads[st.households[p.household].farmstead].name : 'the island'} `
      + `${CAUSES[cause].log}, aged ${p.age}.`);
    const hh = p.household !== null ? st.households[p.household] : null;
    if (hh) { hh.members = hh.members.filter((m) => m !== id); if (hh.holder === id) succession(st, hh, 'death'); }
    refreshRoles(st); refreshPrestige(st); st.visualDirty = true;
  }
  function retireHolder(st, hhId) {
    const hh = st.households[hhId]; if (!hh || hh.dissolved) return false;
    const r = heirRanking(st, hh); if (!r.length) return false;
    transfer(st, hh, r[0], 'retirement'); refreshRoles(st); refreshPrestige(st); return true;
  }
  function holdMeetings(st) {
    const env = st.cenv; env.t = st.t / YEAR;
    refreshRoles(st); refreshPrestige(st); refreshInterests(st); updateTies(st);
    const starters = Culture.entrepreneurs(env, st.rand);
    for (const p of starters) {
      personEvent(st, p.id, 'cause',
        `Took up the cause: ${Culture.DIMS[p.advocate.dim].label.toLowerCase()}, ${Culture.DIMS[p.advocate.dim].opts[p.advocate.opt][1].toLowerCase()}`);
    }
    const c = cal(st.t), out = [];
    for (const s of env.settlements) {
      const ch = Culture.meeting(env, s);
      for (const x of ch) {
        const d = Culture.DIMS[x.dim],
          txt = `At the ${s.name} meeting: ${d.label.toLowerCase()} is now “${d.opts[x.to][1]}” (was “${d.opts[x.from][1]}”).`;
        log(st, txt); out.push({ year: c.year, text: txt });
      }
    }
    for (const cu of env.cultures) {
      const r = Culture.cultureYear(env, cu);
      for (const x of r.changes) {
        const d = Culture.DIMS[x.dim], txt = `Across the ${cu.name} culture: ${d.label.toLowerCase()} is now “${d.opts[x.to][1]}”.`;
        log(st, txt); out.push({ year: c.year, text: txt });
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
    for (const p of st.pawns) p.kinPush = null;
    const wed = new Map(); for (const u of st.unions) if (u.start === st.t && u.end === null) { wed.set(u.a, u.b); wed.set(u.b, u.a); }
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
      log(st, txt); out.push({ year: c.year, text: txt });
    }
    st.meetingLog.unshift(...out); st.meetingLog.length = Math.min(st.meetingLog.length, 30);
  }
  function movingRound(st) {
    const env = st.cenv; refreshRoles(st); fillStores(st);
    const alive = st.pawns.filter((p) => p.alive);
    for (const p of alive) p.age = age(st, p);
    const single = (p) => spouseOf(st, p.id) === null && p.died === null;
    // marriages: a couple needs a place to live, as the customs define it
    const fed = (p) => p.hunger < HUNGER.marryBelow;
    const men = alive.filter((p) => p.sex === 'm' && p.age >= MARRIAGE.menFrom && single(p) && !p.retired && fed(p)),
      women = alive.filter((p) => p.sex === 'f' && p.age >= MARRIAGE.womenFrom && single(p) && !p.retired && fed(p));
    const own = ownFirstOf(st);
    men.sort((x, y) => (placeIfMarried(st, y.id, own) !== null) - (placeIfMarried(st, x.id, own) !== null) || x.born - y.born);
    const taken = new Set();
    // where a couple would live, or null; one of them needs a place under 'land', and the spouse's home counts otherwise
    const homeFor = (m, f, cu, pm = placeIfMarried(st, m.id), pf = placeIfMarried(st, f.id)) => {
      if (cu.residence === 'land') return pm !== null && pf !== null ? null : pm !== null ? pm : pf;
      return cu.residence === 'husband' ? m.household : f.household;
    };
    for (const m of men) {
      const sm = settlementIdOf(st, m), cu = practice(st, sm);
      let best = null, bs = -Infinity;
      const pm = placeIfMarried(st, m.id);
      for (const f of women) {
        if (taken.has(f.id) || !kinOk(st, m.id, f.id, cu)) continue;
        const home = homeFor(m, f, cu, pm);
        if (home === null) continue;
        const sf = settlementIdOf(st, f), sameV = sf === sm, tie = env.settlements[sf] ? env.settlements[sf].tie : 0;
        const s = -Math.abs(m.age - f.age - MARRIAGE.ageGap) * MARRIAGE.gapWeight
          + (sameV ? MARRIAGE.sameVillage : 2 * Math.min(tie, env.settlements[sm].tie)) + st.rand() * MARRIAGE.noise;
        if (s > bs) { bs = s; best = { f, home }; }
      }
      if (!best || bs < MARRIAGE.minScore || st.rand() > MARRIAGE.goAhead) continue;
      taken.add(best.f.id);
      st.unions.push({ id: st.unions.length, a: m.id, b: best.f.id, start: st.t, end: null, kind: 'marriage' });
      for (const id of [m.id, best.f.id]) {
        if (st.pawns[id].household !== best.home) moveTo(st, id, best.home);
        personEvent(st, id, 'married', `Married ${fullName(st.pawns[id === m.id ? best.f.id : m.id])}`); st.rigDirty.add(id);
      }
      const fm = st.farmsteads[st.households[best.home].farmstead];
      log(st, `${fullName(m)} and ${fullName(best.f)} marry and live at ${fm.name}.`);
      m.ties.set(best.f.id, 2); best.f.ties.set(m.id, 2);
    }
    kinPressure(st, men, women, taken, homeFor);
    // handovers by custom: when the heir marries, or when the holder turns 60
    for (const hh of st.households) {
      if (hh.dissolved) continue;
      const f = st.farmsteads[hh.farmstead], cu = farmPractice(st, f), holder = st.pawns[hh.holder], r = heirRanking(st, hh, cu), heir = r[0];
      if (heir === undefined || st.pawns[heir].age < 18) continue;
      if (cu.handover === 'marriage' && spouseOf(st, heir) !== null && st.pawns[heir].household === hh.id) transfer(st, hh, heir, 'marriage');
      else if (cu.handover === 'age60' && holder.age >= 60) transfer(st, hh, heir, 'retirement');
    }
    refreshRoles(st);
    // who wants out: landless adults with no prospect of a farm
    st.demand = (() => { const heirs = firstHeirs(st); return alive.filter((p) => wantsOut(st, p, heirs)).map((p) => p.id); })();
    startPlots(st);
    payOwed(st);
    refreshPrestige(st);
    st.visualDirty = true;
  }
  function dailyLife(st, c) {
    const env = st.cenv;
    for (const p of st.pawns) if (p.alive) p.age = age(st, p);
    comeOfAge(st);
    // contact over the day builds ties; ties fade with a half-life of about a year; kin never fall below a floor; weak ties are dropped.
    // Contact and the floor only raise a tie, so only the ties that fade below 0.02 here can be dropped at the end.
    const decay = Math.pow(0.5, 1 / YEAR_DAYS), low = [];
    for (const p of st.pawns) {
      if (!p.alive) continue;
      for (const [j, w0] of p.ties) { const v = w0 * decay; p.ties.set(j, v); if (v < 0.02) low.push(p, j); }
    }
    for (const [k, hrs] of st.contacts) {
      const [i, j] = pairOf(k), pi = st.pawns[i], pj = st.pawns[j]; if (!pi.alive || !pj.alive) continue;
      const add = hrs / 24; pi.ties.set(j, (pi.ties.get(j) || 0) + add); pj.ties.set(i, (pj.ties.get(i) || 0) + add);
    }
    st.contacts.clear();
    for (const p of st.pawns) if (p.alive) for (const q of kinNear(st, p.id)) if (st.pawns[q].alive && (p.ties.get(q) || 0) < 0.4) p.ties.set(q, 0.4);
    for (let n = 0; n < low.length; n += 2) { const p = low[n], j = low[n + 1], v = p.ties.get(j); if (v !== undefined && v < 0.02) p.ties.delete(j); }
    if (c.sday === 0) fadeRelations(st);
    env.t = st.t / YEAR; env.driftMul = st.driftMul;
    Culture.dailyStep(env, 1 / YEAR_DAYS, st.rand);
    if (st.naturalDeaths) for (const p of st.pawns) if (p.alive) { const cause = deathRoll(st, p); if (cause) killPawn(st, p.id, cause); }
  }
  return { killPawn, retireHolder, holdMeetings, kinOk, movingRound, dailyLife };
})();
