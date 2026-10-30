// @sys sim/births: conception, pregnancy, childbirth and nursing of married women
VB['sim/births'] = (() => {
  const { DAY, YEAR_DAYS, BIRTH, MALE, FEMALE } = VB['sim/rules'];
  const { person, personEvent, log, fullName, spouseOf } = VB['sim/records'];
  const { placeAtHome } = VB['sim/agents'];
  const { refreshRoles } = VB['sim/heirs'];
  const { killPawn } = VB['sim/lifecycle'];
  // chance per game day that a married woman of this age conceives, when she is neither pregnant nor nursing
  const conceiveChance = (a) => (a < BIRTH.from || a >= BIRTH.to ? 0 : BIRTH.peak * BIRTH.ageFactor[Math.floor((a - BIRTH.from) / 5)]);
  // births to one woman who is married from age `from` to age `to`, for calibration: no deaths, no hunger
  function expectedBirths(rand, from, to) {
    let births = 0, freeAt = 0, bornAt = -1;
    for (let d = Math.round(from * YEAR_DAYS); d < to * YEAR_DAYS; d++) {
      if (bornAt >= 0 && d >= bornAt) { births++; bornAt = -1; freeAt = d + BIRTH.nursingDays; }
      if (bornAt < 0 && d >= freeAt && rand() < conceiveChance(Math.floor(d / YEAR_DAYS))) bornAt = d + BIRTH.pregnancyDays;
    }
    return births + (bornAt >= 0 ? 1 : 0);
  }
  function giveBirth(st, m) {
    const hh = m.household !== null ? st.households[m.household] : null, fatherId = m.pregnantBy, father = st.pawns[fatherId];
    m.pregnantUntil = null; m.pregnantBy = null;
    if (!hh || hh.dissolved) return;
    const sex = st.rand() < BIRTH.boys ? 'm' : 'f', taken = new Set(hh.members.map((id) => st.pawns[id].given)), names = sex === 'm' ? MALE : FEMALE;
    const free = names.filter((n) => !taken.has(n)), pool = free.length ? free : names, given = pool[(st.rand() * pool.length) | 0];
    const id = person({ pawns: st.pawns, rand: st.rand }, { sex, age: 0, given, father: fatherId, mother: m.id }), p = st.pawns[id];
    p.born = st.t; p.alive = true; p.age = 0; p.household = hh.id; hh.members.push(id);
    p.att = Float32Array.from(m.att, (x, k) => (x + father.att[k]) / 2); p.anc = Float32Array.from(p.att);
    p.ties = new Map(); p.prestige = 1; p.interest = null; p.advocate = null;
    for (const j of hh.members) if (j !== id && st.pawns[j].alive) { p.ties.set(j, 1); st.pawns[j].ties.set(id, 1); }
    p.events.push({ t: st.t, kind: 'born' });
    personEvent(st, m.id, 'child', `Child born: ${given}`); personEvent(st, fatherId, 'child', `Child born: ${given}`);
    st.agents.push({
      id, x: 0, y: 0, path: null, seg: 0, phase: null, job: null, inside: true, anim: 'idle', carry: null, face: 1, stride: st.rand() * 6,
      ox: (st.rand() - 0.5) * 12, oy: (st.rand() - 0.5) * 8, work: null, idleUntil: 0,
    });
    placeAtHome(st, st.agents[id]);
    m.nursingUntil = st.t + BIRTH.nursingDays * DAY;
    log(st, `${fullName(m)} gave birth to ${fullName(p)} at ${st.farmsteads[hh.farmstead].name}.`);
    refreshRoles(st); st.rigDirty.add(id); st.rigDirty.add(m.id); st.visualDirty = true;
    if (st.rand() < BIRTH.childbedDeath) killPawn(st, m.id, 'childbirth');
  }
  function dailyBirths(st) {
    for (const m of st.pawns) {
      if (!m.alive || m.sex !== 'f') continue;
      if (m.pregnantUntil !== null) { if (st.t >= m.pregnantUntil) giveBirth(st, m); continue; }
      if (m.nursingUntil !== null && st.t < m.nursingUntil) continue;
      const sp = spouseOf(st, m.id);
      if (sp === null || m.household === null || st.pawns[sp].household !== m.household) continue;
      if (st.rand() < conceiveChance(m.age)) { m.pregnantUntil = st.t + BIRTH.pregnancyDays * DAY; m.pregnantBy = sp; }
    }
  }
  return { conceiveChance, expectedBirths, dailyBirths };
})();
