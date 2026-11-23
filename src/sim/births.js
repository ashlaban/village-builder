// @sys sim/births: conception, pregnancy, childbirth and nursing of married women, and of courting ones (VB-555): a child born to an
//   unmarried mother is born outside marriage, until its parents marry each other
VB['sim/births'] = (() => {
  const { next: rnd, drawer } = VB['sim/rng'];
  const { emit } = VB['sim/events'];
  const { DAY, YEAR_DAYS, MALE, FEMALE } = VB['sim/rules'];
  const {
    joinHousehold,
    person,
    personEvent,
    lifeEvent,
    log,
    fullName,
    spouseOf,
    atHousehold,
    kinNear,
    settlementIdOf,
    membersOf,
    childrenOf,
  } = VB['sim/records'];
  const Culture = VB['culture'],
    Attitudes = VB['sim/attitudes'],
    Traits = VB['sim/traits'];
  const { initRelations } = VB['sim/relations'],
    { raiseTie, floorKin } = VB['sim/ties'];
  const { refreshRoles } = VB['sim/heirs'];
  const { killPawn } = VB['sim/lifecycle'];
  const { COURT } = VB['sim/courting'];
  const { on } = VB['sim/events'];
  // @tunable BIRTH: births: natural fertility of married women (Coale and Trussell 1974), relative to ages 20-24; times in game days
  const BIRTH = {
    peak: 0.015,
    ageFactor: [0.89, 1, 0.94, 0.86, 0.7, 0.36, 0.05],
    from: 15,
    to: 50, // chance per day to conceive; factor per 5 years of age from 15
    pregnancyDays: 36,
    nursingDays: 48,
    boys: 105 / 205,
    childbedDeath: 0.01,
  };

  // chance per game day that a married woman of this age conceives, when she is neither pregnant nor nursing
  const conceiveChance = (a) =>
    a < BIRTH.from || a >= BIRTH.to ? 0 : BIRTH.peak * BIRTH.ageFactor[Math.floor((a - BIRTH.from) / 5)];
  // chance per game day that a courting woman of this age conceives (VB-555; design.md, Courting: A child on the way): COURT.conceive a
  // year at the peak of the married women's curve, by the same curve
  const courtChance = (a) => (conceiveChance(a) * COURT.conceive) / (BIRTH.peak * YEAR_DAYS);
  // @state pawn.outside (VB-555): absent or false, else true: born to an unmarried mother, and its parents have not married each other
  //   since (legitimation by the later marriage). Written at its birth and at its parents' wedding (sim/births). Plain data, saved.
  // @state pawn.pregnantCourting (VB-555): absent or false, else true while a pregnancy conceived while courting, unmarried, lasts.
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
    const courted = m.pregnantCourting === true;
    m.pregnantUntil = null;
    m.pregnantBy = null;
    if (courted) m.pregnantCourting = false;
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
    // conceived while courting, and its mother has not married since: born outside marriage, in her household (VB-555); a widow's
    // child by her late husband is born in marriage
    if (courted && spouseOf(st, m.id) === null) p.outside = true;
    joinHousehold(st, hh, id);
    Traits.born(st, id); // its traits, from its parents by birth and its culture (VB-519)
    VB['sim/skills'].born(st, id); // its skill at each type of work (VB-475)
    const v = settlementIdOf(st, p); // its village's norm joins its parents' (VB-1230)
    Culture.initPerson(p, Attitudes.inherit(m.att, father.att, v === null ? null : membersOf(st, v)));
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
    emit(st, 'born', { child: id, mother: m.id, father: fatherId }); // both parents glad (sim/mood, VB-062)
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
      idleUntil: 0,
      talk: null,
      occasion: null,
    });
    emit(st, 'placeBorn', { a: st.agents[id], mother: m.id, hh }); // at home, or where its mother is (sim/away)
    m.nursingUntil = st.t + BIRTH.nursingDays * DAY;
    m.nursling = id; // the child she nurses: its death ends the nursing (VB-632)
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
    if (p.outside) {
      const fn = father ? fullName(father) : 'an unknown father';
      log(st, `${fullName(p)} was born outside marriage, to ${fullName(m)} and ${fn}.`, {
        kind: 'bornOutside',
        pawn: id,
        other: m.id,
        by: fatherId,
        ...atHousehold(st, hh),
      });
      emit(st, 'bornOutside', { child: id, mother: m.id, father: fatherId });
    }
    refreshRoles(st);
    st.rigDirty.add(id);
    st.rigDirty.add(m.id);
    if (rnd(st.rng.births) < BIRTH.childbedDeath) {
      killPawn(st, m.id, 'childbirth');
      m.nursling = null;
      m.nursingUntil = null;
    }
  }
  function dailyBirths(st) {
    // Childbirth may remove the mother; newborns have no spouse to consider today.
    for (const liveId of st.living.slice()) {
      const m = st.pawns[liveId];
      if (!m.alive || m.sex !== 'f') continue;
      if (m.nursling !== null && (st.t >= m.nursingUntil || !st.pawns[m.nursling].alive)) {
        // the term is out, or the child has died: the nursing ends, read here and not pushed from the death (VB-632)
        m.nursling = null;
        m.nursingUntil = null;
      }
      if (m.pregnantUntil !== null) {
        if (st.t >= m.pregnantUntil) giveBirth(st, m);
        continue;
      }
      if (m.nursingUntil !== null && st.t < m.nursingUntil) continue;
      if (m.household === null) continue;
      // a married woman, living with her husband, by the curve; an unmarried one who courts, at COURT.conceive (VB-555)
      const sp = spouseOf(st, m.id),
        by = sp !== null ? sp : Number.isInteger(m.courting) ? m.courting : null;
      if (by === null || (sp !== null && st.pawns[sp].household !== m.household)) continue;
      const chance = sp !== null ? conceiveChance(m.age) : courtChance(m.age);
      if (rnd(st.rng.births) < chance * (1 - m.hunger)) {
        m.pregnantUntil = st.t + BIRTH.pregnancyDays * DAY;
        m.pregnantBy = by;
        if (sp === null) {
          m.pregnantCourting = true;
          emit(st, 'conceivedCourting', { woman: m.id, man: by }); // the couple's offer, once it is known (sim/asking)
        }
      }
    }
  }
  // The parents of a child born outside marriage marry each other: it counts as born in marriage from that day (legitimation by the
  // later marriage, as medieval law had it; VB-555). A walk of the two's children.
  on('wed', (st, d) => {
    for (const c of childrenOf(st, d.a)) {
      const p = st.pawns[c];
      if (p.outside !== true || (p.father !== d.b && p.mother !== d.b)) continue;
      p.outside = false;
      const mother = st.pawns[p.mother],
        hh = mother.household !== null ? st.households[mother.household] : null;
      log(st, `${fullName(p)} counts as born in marriage: ${p.sex === 'm' ? 'his' : 'her'} parents have married.`, {
        kind: 'legitimated',
        pawn: c,
        other: p.mother,
        by: p.father,
        ...(hh ? atHousehold(st, hh) : {}),
      });
    }
  });
  return { BIRTH, conceiveChance, courtChance, expectedBirths, dailyBirths };
})();
