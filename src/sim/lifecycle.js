// @sys sim/lifecycle: deaths, retirement, village meetings, the moving round and the daily life step
VB['sim/lifecycle'] = (() => {
  const Culture = VB['culture'];
  const { YEAR_DAYS, YEAR, cal, HUNGER } = VB['sim/rules'];
  const { deathRoll } = VB['sim/hunger'];
  const {
    personEvent, log, age, fullName, spouseOf, kinship, kinNear, settlementIdOf, practice, farmPractice,
  } = VB['sim/records'];
  const { release } = VB['sim/agents'];
  const { heirRanking, moveTo, transfer, succession, refreshRoles, placeIfMarried, wantsOut, firstHeirs } = VB['sim/heirs'];
  const { updateTies, refreshPrestige, refreshInterests } = VB['sim/society'];
  function killPawn(st, id, cause = 'died') {
    const p = st.pawns[id]; if (!p.alive) return;
    p.died = st.t; p.alive = false;
    personEvent(st, id, 'died', cause === 'old age' ? 'Died' : `Died (${cause})`);
    const a = st.agents[id]; release(st, a); a.path = null; a.inside = true;
    for (const u of st.unions) if ((u.a === id || u.b === id) && u.end === null) u.end = st.t;
    for (const [j] of p.ties) { const q = st.pawns[j]; if (q && q.ties) q.ties.delete(id); }
    log(st, `${fullName(p)} of ${p.household !== null ? st.farmsteads[st.households[p.household].farmstead].name : 'the island'} has died, aged ${p.age}.`);
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
  const kinOk = (st, a, b, cu) => {
    const phi = kinship(st, a, b), lim = { second: 1 / 64, first: 1 / 16, close: 1 / 8 }[cu.kinLimit];
    return phi < lim;
  };
  function movingRound(st) {
    const env = st.cenv; refreshRoles(st);
    const alive = st.pawns.filter((p) => p.alive);
    for (const p of alive) p.age = age(st, p);
    const single = (p) => spouseOf(st, p.id) === null && p.died === null;
    // marriages: a couple needs a place to live, as the customs define it
    const fed = (p) => p.hunger < HUNGER.marryBelow;
    const men = alive.filter((p) => p.sex === 'm' && p.age >= 20 && single(p) && !p.retired && fed(p)),
      women = alive.filter((p) => p.sex === 'f' && p.age >= 18 && single(p) && !p.retired && fed(p));
    men.sort((x, y) => (placeIfMarried(st, y.id) !== null) - (placeIfMarried(st, x.id) !== null) || x.born - y.born);
    const taken = new Set();
    for (const m of men) {
      const sm = settlementIdOf(st, m), cu = practice(st, sm);
      let best = null, bs = -Infinity;
      for (const f of women) {
        if (taken.has(f.id) || !kinOk(st, m.id, f.id, cu)) continue;
        const pm = placeIfMarried(st, m.id), pf = placeIfMarried(st, f.id);
        let home = null;
        if (cu.residence === 'land') { if (pm !== null && pf !== null) continue; home = pm !== null ? pm : pf; }
        else if (cu.residence === 'husband') home = m.household; else home = f.household;
        if (home === null) continue;
        const sf = settlementIdOf(st, f), sameV = sf === sm, tie = env.settlements[sf] ? env.settlements[sf].tie : 0;
        const s = -Math.abs(m.age - f.age - 3) * 0.3 + (sameV ? 2 : 2 * Math.min(tie, env.settlements[sm].tie)) + st.rand() * 1.5;
        if (s > bs) { bs = s; best = { f, home }; }
      }
      if (!best || bs < -1.5 || st.rand() > 0.75) continue;
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
    refreshPrestige(st);
    st.visualDirty = true;
  }
  function dailyLife(st, c) {
    const env = st.cenv;
    for (const p of st.pawns) if (p.alive) p.age = age(st, p);
    // contact over the day builds ties; ties fade with a half-life of about a year; kin never fall below a floor
    const decay = Math.pow(0.5, 1 / YEAR_DAYS);
    for (const p of st.pawns) { if (!p.alive) continue; for (const [j, w0] of p.ties) p.ties.set(j, w0 * decay); }
    for (const [k, hrs] of st.contacts) {
      const [i, j] = k.split(':').map(Number), pi = st.pawns[i], pj = st.pawns[j]; if (!pi.alive || !pj.alive) continue;
      const add = hrs / 24; pi.ties.set(j, (pi.ties.get(j) || 0) + add); pj.ties.set(i, (pj.ties.get(i) || 0) + add);
    }
    st.contacts.clear();
    for (const p of st.pawns) if (p.alive) for (const q of kinNear(st, p.id)) if (st.pawns[q].alive && (p.ties.get(q) || 0) < 0.4) p.ties.set(q, 0.4);
    for (const p of st.pawns) if (p.alive) for (const [j, w0] of p.ties) if (w0 < 0.02) p.ties.delete(j);
    env.t = st.t / YEAR; env.driftMul = st.driftMul;
    Culture.dailyStep(env, 1 / YEAR_DAYS, st.rand);
    if (st.naturalDeaths) for (const p of st.pawns) if (p.alive) { const cause = deathRoll(st, p); if (cause) killPawn(st, p.id, cause); }
  }
  return { killPawn, retireHolder, holdMeetings, kinOk, movingRound, dailyLife };
})();
