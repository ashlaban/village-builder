// @sys sim/births: conception, pregnancy, childbirth and nursing of married women
VB['sim/births'] = (() => {
  const { next: rnd, drawer } = VB['sim/rng'];
  const { DAY, YEAR_DAYS, BIRTH, MALE, FEMALE } = VB['sim/rules'];
  const { joinHousehold, person, personEvent, lifeEvent, log, fullName, spouseOf, atHousehold, kinNear } =
    VB['sim/records'];
  const Culture = VB['culture'];
  const { initRelations, raiseTie, floorKin } = VB['sim/relations'];
  const { placeAtHome } = VB['sim/agents'];
  const { refreshRoles } = VB['sim/heirs'];
  const { killPawn } = VB['sim/lifecycle'];
  // chance per game day that a married woman of this age conceives, when she is neither pregnant nor nursing
  const conceiveChance = (a) =>
    a < BIRTH.from || a >= BIRTH.to ? 0 : BIRTH.peak * BIRTH.ageFactor[Math.floor((a - BIRTH.from) / 5)];
  // births to one woman who is married from age `from` to age `to`, for calibration: no deaths, no hunger
  function expectedBirths(rand, from, to) {
    let births = 0,
      freeAt = 0,
      bornAt = -1;
    for (let d = Math.round(from * YEAR_DAYS); d < to * YEAR_DAYS; d++) {
      if (bornAt >= 0 && d >= bornAt) {
        births++;
        bornAt = -1;
        freeAt = d + BIRTH.nursingDays;
      }
      if (bornAt < 0 && d >= freeAt && rand() < conceiveChance(Math.floor(d / YEAR_DAYS)))
        bornAt = d + BIRTH.pregnancyDays;
    }
    return births + (bornAt >= 0 ? 1 : 0);
  }
  function giveBirth(st, m) {
    const hh = m.household !== null ? st.households[m.household] : null,
      fatherId = m.pregnantBy,
      father = st.pawns[fatherId];
    m.pregnantUntil = null;
    m.pregnantBy = null;
    if (!hh || hh.dissolved) return;
    const sex = rnd(st.rng.births) < BIRTH.boys ? 'm' : 'f',
      taken = new Set(hh.members.map((id) => st.pawns[id].given)),
      names = sex === 'm' ? MALE : FEMALE;
    const free = names.filter((n) => !taken.has(n)),
      pool = free.length ? free : names,
      given = pool[(rnd(st.rng.people) * pool.length) | 0];
    const id = person(
        { pawns: st.pawns, living: st.living, rand: drawer(st.rng.people) },
        { sex, age: 0, given, father: fatherId, mother: m.id },
      ),
      p = st.pawns[id];
    p.born = st.t;
    p.alive = true;
    p.age = 0;
    joinHousehold(st, hh, id);
    Culture.initPerson(
      p,
      Float32Array.from(m.att, (x, k) => (x + father.att[k]) / 2),
    );
    initRelations(st, p);
    for (const j of hh.members)
      if (j !== id && st.pawns[j].alive) {
        raiseTie(st, id, j, 1);
        raiseTie(st, j, id, 1);
      }
    for (const q of kinNear(st, id))
      if (st.pawns[q].alive) {
        floorKin(st, id, q);
        floorKin(st, q, id);
      } // kin elsewhere, till their turn (sim/relations)
    personEvent(st, m.id, 'child', `Child born: ${given}`, false);
    personEvent(st, fatherId, 'child', `Child born: ${given}`, false); // the born event below
    st.agents.push({
      id,
      x: 0,
      y: 0,
      path: null,
      seg: 0,
      phase: null,
      job: null,
      inside: true,
      anim: 'idle',
      carry: null,
      face: 1,
      stride: rnd(st.rng.people) * 6,
      ox: (rnd(st.rng.people) - 0.5) * 12,
      oy: (rnd(st.rng.people) - 0.5) * 8,
      work: null,
      idleUntil: 0,
      talk: null,
      occasion: null,
    });
    placeAtHome(st, st.agents[id]);
    m.nursingUntil = st.t + BIRTH.nursingDays * DAY;
    lifeEvent(
      st,
      id,
      log(st, `${fullName(m)} gave birth to ${fullName(p)} at ${st.farmsteads[hh.farmstead].name}.`, {
        kind: 'born',
        pawn: id,
        other: m.id,
        ...atHousehold(st, hh),
      }),
    );
    refreshRoles(st);
    st.rigDirty.add(id);
    st.rigDirty.add(m.id);
    st.visualDirty = true;
    if (rnd(st.rng.births) < BIRTH.childbedDeath) killPawn(st, m.id, 'childbirth');
  }
  function dailyBirths(st) {
    // Childbirth may remove the mother; newborns have no spouse to consider today.
    for (const liveId of st.living.slice()) {
      const m = st.pawns[liveId];
      if (!m.alive || m.sex !== 'f') continue;
      if (m.pregnantUntil !== null) {
        if (st.t >= m.pregnantUntil) giveBirth(st, m);
        continue;
      }
      if (m.nursingUntil !== null && st.t < m.nursingUntil) continue;
      const sp = spouseOf(st, m.id);
      if (sp === null || m.household === null || st.pawns[sp].household !== m.household) continue;
      if (rnd(st.rng.births) < conceiveChance(m.age) * (1 - m.hunger)) {
        m.pregnantUntil = st.t + BIRTH.pregnancyDays * DAY;
        m.pregnantBy = sp;
      }
    }
  }
  return { conceiveChance, expectedBirths, dailyBirths };
})();
