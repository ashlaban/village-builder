// @sys sim/society: Culture wiring: settlements, ties, standing and interests of pawns (a village's, at its meeting)
VB['sim/society'] = (() => {
  const { living, settlement } = VB['sim/records'];
  const { personEvent } = VB['sim/records'];
  const { next: rnd, drawer } = VB['sim/rng'];
  const { issue, register } = VB['sim/commands'];
  const { ask } = VB['sim/decisions'];
  const Culture = VB['culture'],
    Customs = VB['sim/customs'],
    { inForceAt } = VB['sim/customs'];
  const { initRelations } = VB['sim/relations'],
    { raiseTie } = VB['sim/ties'];
  const { YEAR, SPEED, OFFICE, cal, TRAITS, HERD, DAY } = VB['sim/rules'],
    { houseTerm } = VB['sim/house'],
    { SOCIAL } = VB['sim/ties'],
    { WORKDAY } = VB['sim/workdays'];
  const { herdsOf, winterNeed } = VB['sim/herds'];
  const { addValues, act } = VB['sim/traits'];
  const { hexSteps } = VB['sim/hex'];
  const { hoursBetween } = VB['sim/villagehours'];
  const {
    log,
    age,
    spouseOf,
    childrenOf,
    siblingsOf,
    kinNear,
    settlementIdOf,
    isHolder,
    holdingOf,
    membersOf,
    voiceOf,
  } = VB['sim/records'];
  const { on } = VB['sim/events'],
    { aleStanding } = VB['sim/stores'];
  const { heirRanking } = VB['sim/heirranking'];
  const { helpLean } = VB['sim/commons'];
  // @tunable TIE: a settlement's tie to its culture's centre, by the walking hours between
  // The tie of a settlement to its culture's centre (sim/society, VB-290): exp(-h / hours) for h walking hours between the two greens (the
  // table of VB-286), plus the kin term; over the sea or beyond walking reach, `sea` times the hex steps, in hours (/ SPEED).
  const TIE = { hours: 8, sea: 1.6 };
  // The lookups Culture's functions take (VB-073): built from st on each call, so nothing in st.cenv is a function.
  function hooks(st) {
    const env = st.cenv;
    return {
      living: st.living,
      byId: (id) => st.pawns[id],
      settlementOf: (p) => {
        const s = settlementIdOf(st, p);
        return s === null ? null : env.settlements[s];
      },
      voiceOf: (p, s) => voiceOf(st, p, s),
      ask: (q) => ask(st, q), // a meeting's question, settled by the village's procedure (sim/decisions, VB-313)
      decide: (s, dim, option) =>
        issue(st, { actor: { settlement: s.id }, verb: 'decide', args: { dim, option }, source: 'meeting' }) === true,
      membersOf: (s) => membersOf(st, s.id),
      addValues, // a culture's values, the mean of its living adults' (sim/traits, VB-519)
      act: (p, name, rule) => act(st, p.id, name, rule), // what a trait does to the drift (sim/traits, VB-520)
      nameCulture: (s) => `${s.name.replace(/(by|sta|vik|nes|inge|berga|tuna|säter)$/, '') || s.name}folk`,
      onSplit: (nc, from) =>
        log(
          st,
          `${nc.name}: the people of ${env.settlements[nc.centres[0]].name} now keep their own customs, apart from ${from.name}.`,
          { kind: 'split', village: nc.centres[0] },
        ),
    };
  }
  function initCulture(st, leanBySettlement, overrides = {}) {
    const env = (st.cenv = { t: st.t / YEAR, cultures: [], settlements: [], people: st.pawns, driftMul: 1 });
    const customs = Customs.fromArchetype('oldNordic');
    for (const [key, opt] of Object.entries(overrides)) customs[Customs.IDX[key]] = Customs.optIndex(key, opt);
    const c = Culture.makeCulture(env, 'Nordic', customs, 0, null, TRAITS.culture.oldNordic);
    for (const v of st.villages) addSettlement(st, v, c.id, customs, v.id === 0 ? 1 : 0.5);
    for (const p of st.pawns) {
      p.alive = p.died === null;
      p.age = age(st, p);
      const s = settlementIdOf(st, p),
        lean = leanBySettlement && s !== null ? leanBySettlement[s] : null;
      Culture.initPerson(p, Culture.seedAttitude(customs, drawer(st.rng.culture), 0.6, lean));
      initRelations(st, p);
    }
    // starting ties, on the pawns' tie scale (sim/relations): household members 1, near kin at least 0.5
    for (const hh of st.households)
      for (const i of hh.members) for (const j of hh.members) if (i !== j) raiseTie(st, i, j, 1);
    for (const p of st.pawns)
      if (p.alive)
        for (const q of kinNear(st, p.id))
          if (st.pawns[q].alive) {
            raiseTie(st, p.id, q, 0.5);
            raiseTie(st, q, p.id, 0.5);
          }
    updateTies(st);
    refreshStanding(st);
    refreshInterests(st);
  }
  // The Culture settlement of village v, with the same id: its culture, a copy of the practice it keeps and its tie to the centre.
  // Seeding makes one per village; a village founded in play (sim/settle) gets one too, so the two lists keep the same ids.
  function addSettlement(st, v, culture, practice, tie) {
    const s = {
      id: v.id,
      name: v.name,
      culture,
      kind: 'village',
      tie,
      practice: Int8Array.from(practice),
      fissionYears: 0,
      divergence: 0,
    };
    st.cenv.settlements.push(s);
    return s;
  }
  // tie of each settlement to its culture's centre: the walking hours between the greens plus living kin across the gap. s.distance: those
  // hours (VB-290: it was unweighted steps), from the table of walking hours (sim/routes), or TIE.sea times the hex steps over SPEED over
  // the sea or beyond walking reach (a sea crossing costs more). `updateTies(st)` sets every settlement's; `updateTie(st, sid, people)` one
  // settlement's (by id), from its living people (a village's meeting, VB-278), counting the near kin of each who live in the centre.
  function updateTie(st, sid, people) {
    const env = st.cenv,
      s = env.settlements[sid],
      c = env.cultures[s.culture],
      centre = c.centres[0];
    if (s.id === centre) {
      s.tie = 1;
      return;
    }
    const va = st.villages[s.id],
      vb = st.villages[centre];
    const walk = hoursBetween(st, s.id, centre);
    const d = walk < Infinity ? walk : (hexSteps(st.w, va.center, vb.center) * TIE.sea) / SPEED;
    let kin = 0;
    for (const p of people)
      for (const q of kinNear(st, p.id)) {
        const o = st.pawns[q];
        if (o.alive && settlementIdOf(st, o) === centre) kin++;
      }
    s.tie = Math.min(1, Math.exp(-d / TIE.hours) + Math.min(0.3, kin * 0.04));
    s.distance = d;
    s.kinLinks = kin;
  }
  function updateTies(st) {
    const by = new Map(); // the living pawns of each settlement, in id order
    for (const id of st.living) {
      const p = st.pawns[id],
        v = settlementIdOf(st, p),
        l = by.get(v);
      if (l) l.push(p);
      else by.set(v, [p]);
    }
    for (const s of st.cenv.settlements) updateTie(st, s.id, by.get(s.id) || []);
  }
  // The parts of a pawn's standing, [label, value]: its position (1.6 a holder, 1.3 a holder's spouse, else 1), age from 55, and for a holder and
  // a holder's spouse the term of the house's condition (VB-306), read from the farm's closed form (nothing is stored beside the condition).
  function standingParts(st, p) {
    const sp = spouseOf(st, p.id),
      holder = isHolder(st, p.id),
      spHolder = sp !== null && isHolder(st, sp);
    const parts = [[holder ? 'Holder' : spHolder ? "Holder's spouse" : 'Villager', holder ? 1.6 : spHolder ? 1.3 : 1]];
    if (p.age >= 55) parts.push(['Age', 0.2]);
    if (holder && st.villages[settlementIdOf(st, p)].alderman === p.id) parts.push(['Alderman', OFFICE.standing]); // VB-314
    const hh = holder || spHolder ? st.households[p.household] : null,
      f = hh && !hh.dissolved && hh.farmstead !== null ? st.farmsteads[hh.farmstead] : null;
    if (f && f.household === hh.id && !f.booth)
      parts.push([f.grade === 'stone' ? 'A well-kept house on stone' : 'A well-kept house', houseTerm(st, f)]);
    if (holder) {
      const ale = aleStanding(st, holdingOf(st, p.id));
      if (ale > 0) parts.push(['Ale poured', ale]);
    }
    // the village's work days this year (VB-120): turned out, and, as a holder, stayed away
    const wd = p.workdays;
    if (wd && wd.year === cal(st.t).year) {
      if (wd.came) parts.push(['Turned out for the work days', wd.came * WORKDAY.came]);
      if (wd.missed) parts.push(['Stayed away from the work day', wd.missed * WORKDAY.missed]);
    }
    return parts;
  }
  function refreshStanding(st) {
    for (const id of st.living) {
      const p = st.pawns[id];
      p.standing = standingParts(st, p).reduce((s, x) => s + x[1], 0);
    }
  }
  // A host poured ale (sim/occasions): its holder's standing gains at once, not at the year's round.
  on('alePoured', (st, e) => {
    const p = st.pawns[e.host];
    if (p.alive) p.standing = standingParts(st, p).reduce((n, x) => n + x[1], 0);
  });
  // A village's work day ended (sim/workdays): the standing of those who turned out, and of the holders who stayed away, at once.
  on('workDay', (st, e) => {
    for (const id of e.pawns) {
      const p = st.pawns[id];
      if (p.alive) p.standing = standingParts(st, p).reduce((n, x) => n + x[1], 0);
    }
  });
  // Self-interest follows position: what would this option do for me, or for my children? For `people` (pawn records; all the living when
  // left out): a village's meeting refreshes its own (VB-278). Each household's first heir is ranked once a call (a memo by household);
  // the dead's interest is cleared at the death (sim/lifecycle, killPawn), so no walk of every pawn ever is made.
  function refreshInterests(st, people = null) {
    const I = Customs.IDX,
      O = Customs.OFF,
      first = new Map();
    const firstHeir = (hh) => {
      if (!first.has(hh.id)) first.set(hh.id, heirRanking(st, hh)[0]);
      return first.get(hh.id);
    };
    for (const p of people || st.living.map((id) => st.pawns[id])) {
      if (!p.alive || p.age < 12) {
        p.interest = null;
        continue;
      }
      const it = Float32Array.from(p.att);
      const set = (dim, prefs) => {
        const k = I[dim],
          o = O[k];
        for (let j = 0; j < Customs.NOPT[k]; j++) it[o + j] = 0;
        for (const [opt, v] of Object.entries(prefs)) it[o + Customs.optIndex(dim, opt)] = v;
      };
      const holder = isHolder(st, p.id),
        sp = spouseOf(st, p.id),
        spHolder = sp !== null && isHolder(st, sp);
      const heirOfHome =
        p.household !== null && !st.households[p.household].dissolved && firstHeir(st.households[p.household]) === p.id;
      const landless = !holder && !spHolder && !heirOfHome && p.age >= 16;
      const sibs = siblingsOf(st, p.id).filter((q) => st.pawns[q].alive),
        sisters = sibs.filter((q) => st.pawns[q].sex === 'f').length,
        brothers = sibs.length - sisters;
      if (landless) {
        set('claims', { anyone: 0.6, villagers: 0.4 });
        set('newLand', { intended: 0.5, labour: 0.5 });
        set('heirCount', { buyout: 0.6, split: 0.4 });
        set('voice', { adults: 1 });
      }
      if (landless) set('ownHeir', { behind: 1 });
      if (heirOfHome) set('ownHeir', { keeps: 1 });
      if (holder) {
        set('claims', { kin: 0.5, assembly: 0.5 });
        set('newLand', { village: 1 });
        set('voice', { landholders: 1 });
      }
      if (holder || heirOfHome) set('heirCount', { one: 1 });
      if (heirOfHome && p.age >= 18) set('handover', { marriage: 1 });
      if (holder && p.age >= 50) set('handover', { death: 1 });
      if (p.sex === 'f') set('daughterShare', { equal: 1 });
      else if (sisters) set('daughterShare', { half: 1 });
      if (p.sex === 'f' && sp !== null) set('widow', { life: 0.5, outright: 0.5 });
      if (p.sex === 'm' && heirOfHome) set('widow', { keep: 1 });
      if (p.sex === 'f' && brothers && !heirOfHome) set('heirSex', { any: 1 });
      if (p.sex === 'm' && sisters && heirOfHome) set('heirSex', { sonsFirst: 0.6, sons: 0.4 });
      if (spHolder && !holder) set('voice', { heads: 1 });
      if (sibs.length) {
        const older = sibs.filter((q) => st.pawns[q].born < p.born).length;
        if (older === 0) set('birthOrder', { eldest: 1 });
        else if (older === sibs.length) set('birthOrder', { youngest: 1 });
      }
      if (holder && childrenOf(st, p.id).length >= 2) set('birthOrder', { chosen: 1 });
      const young = childrenOf(st, p.id).filter(
        (c) => st.pawns[c].alive && st.pawns[c].age < 14 && st.pawns[c].household === p.household,
      );
      if (young.length) set('feedOrder', { children: 1 });
      if (p.kinPush) set('kinLimit', { [p.kinPush.to]: p.kinPush.w });
      // disputed claims (sim/claims): holders favour the claim already made, the landless the claim that is worked or has friends; a household
      // that lost a dispute leans for a while towards the rules that would have let it win
      if (landless) set('dispute', { strongest: 0.5, meeting: 0.5 });
      if (holder) set('dispute', { first: 0.6, kin: 0.4 });
      const gr = p.household !== null ? st.households[p.household].grievance : null;
      if (gr && st.t < gr.until && p.age >= 16)
        set('dispute', Object.fromEntries(gr.rules.map((r) => [r, 1 / gr.rules.length])));
      // the commons (VB-100; Kim, 10 Nov): help its household was given leans a person towards the next higher option than its village's
      const hl = helpLean(st, p, settlementIdOf(st, p));
      if (hl) {
        const o = O[I.commons];
        for (let j = 0; j < Customs.NOPT[I.commons]; j++) it[o + j] = it[o + j] * (1 - hl.w) + (j === hl.to ? hl.w : 0);
      }
      // stocking for winter (VB-711): a head whose herd fills its byre, or whose barn holds over two winters' hay, leans to keeping the herd;
      // one whose herd had lean days this year (herd.lean, kept by sim/byre until the next count: no loss is recorded beyond it) to the hay
      if (holder && p.household !== null) {
        const hh = st.households[p.household],
          herds = herdsOf(st, hh);
        if (herds.length) {
          const full = herds.reduce((n, h) => n + (h.species === 'cattle' ? h.head.length : 0), 0) >= HERD.byre,
            stacked = hh.hay > 2 * winterNeed(st, hh),
            lean = herds.some((h) => h.lean > 0);
          if (lean) set('stocking', { hay: 1 });
          else if (full || stacked) set('stocking', { herd: 1 });
        }
      }
      // who makes a match (VB-826): the unmarried young lean to the couple, holders to the heads; one refused with its courting pair, while the
      // memory of it lasts (SOCIAL.memories.refusedCourting), to the couple
      if (holder) set('matchBy', { heads: 1 });
      else if (sp === null && p.age >= 14 && p.age < 30) set('matchBy', { couple: 1 });
      if (sp === null && p.rel)
        for (const r of p.rel.values()) {
          const m = r.mem && r.mem.refusedCourting;
          if (m && st.t - m.t < SOCIAL.memories.refusedCourting.days * DAY) set('matchBy', { couple: 1 });
        }
      p.interest = it;
    }
  }
  const option = (c) =>
    !(c.args && Number.isInteger(c.args.dim) && c.args.dim >= 0 && c.args.dim < Customs.DIMS.length)
      ? `there is no custom ${c.args && c.args.dim}`
      : !(Number.isInteger(c.args.option) && c.args.option >= 0 && c.args.option < Customs.NOPT[c.args.dim])
        ? `custom ${c.args.dim} has no option ${c.args.option}`
        : null;
  const causeWait = (st, p) => {
    // why the pawn may not take up a new cause yet, or null
    const left = Culture.causeFree(p) - st.cenv.t;
    return left > 0
      ? `took up a cause ${(Culture.P.causeEvery - left).toFixed(1)} years ago: ${left.toFixed(1)} more before a new one`
      : null;
  };
  // ---- a settlement's meeting (source 'meeting') ----
  // decide({dim, option}): the settlement's practice of the custom becomes the option
  register('decide', {
    check: (st, c) =>
      settlement(st, c) ||
      option(c) ||
      (inForceAt(st, c.args.dim, c.actor.settlement) === c.args.option ? 'the practice is that already' : null),
    run: (st, c) => {
      Culture.setPractice(st.cenv.settlements[c.actor.settlement], c.args.dim, c.args.option);
    },
  });
  // argue({dim, option}): the pawn takes up the cause for Culture.P.causeEvery years (the debug's, and the player's for its pawn: VB-211); it
  // replaces any cause held. A cause is a long agenda: no new one within those years of the last one taken up (the debug's is not held to that).
  register('argue', {
    check: (st, c) =>
      living(st, c.actor) || option(c) || (c.source === 'debug' ? null : causeWait(st, st.pawns[c.actor])),
    run: (st, c) => {
      const d = Customs.DIMS[c.args.dim];
      Culture.advocate(st.pawns[c.actor], c.args.dim, c.args.option, st.cenv.t + Culture.P.causeEvery, st.cenv.t);
      personEvent(
        st,
        c.actor,
        'cause',
        `Took up the cause: ${d.label.toLowerCase()}, ${d.opts[c.args.option][1].toLowerCase()}`,
      );
    },
  });
  // dropCause: the pawn lays down the cause it argues
  register('dropCause', {
    check: (st, c) => living(st, c.actor) || (st.pawns[c.actor].advocate ? null : 'the pawn argues no cause'),
    run: (st, c) => {
      const p = st.pawns[c.actor],
        d = Customs.DIMS[p.advocate.dim];
      Culture.advocate(p, null, undefined, undefined, st.cenv.t);
      personEvent(st, c.actor, 'cause', `Dropped the cause: ${d.label.toLowerCase()}`);
    },
  });
  // rally({dim, option}): a fifth of the settlement's voices, the most esteemed first, take up the cause
  register('rally', {
    check: (st, c) => settlement(st, c) || option(c),
    run: (st, c) => {
      const s = st.cenv.settlements[c.actor.settlement];
      const voiced = membersOf(st, s.id)
        .filter((q) => voiceOf(st, q, s) > 0)
        .sort((x, y) => y.standing - x.standing);
      const want = Math.max(1, Math.ceil(voiced.length * 0.2));
      for (const q of voiced.slice(0, want))
        Culture.advocate(q, c.args.dim, c.args.option, st.cenv.t + Culture.P.causeEvery, st.cenv.t);
    },
  });
  return {
    TIE,
    standingParts,
    hooks,
    initCulture,
    addSettlement,
    updateTies,
    updateTie,
    refreshStanding,
    refreshInterests,
  };
})();
