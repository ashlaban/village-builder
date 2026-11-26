// @sys sim/commons: common fields worked by the village (VB-100; Kim, 10 Nov): a routine its meeting may choose for a village of three or more
// occupied farms whose store runs short, with free meadow near its green; the village claims the tile and clears and breaks it as a farm
// makes a field, then works it through a farm field's stages, its tasks the village's at the priorities its custom `commons` sets; the seed
// comes from the village store and the harvest goes into it. Help a household was given leans its people towards the commons.
VB['sim/commons'] = (() => {
  const Projects = VB['sim/projects'],
    Stores = VB['sim/stores'],
    { DIMS, IDX, inForceAt } = VB['sim/customs'];
  const { cal } = VB['sim/rules'],
    { ROLES } = VB['sim/roles'],
    { CROPS, openGround: farmable, fertility } = VB['sim/crops'],
    { groundKey } = VB['sim/fieldrec'];
  const { B } = VB['world/biomes'];
  const { bfs } = VB['sim/hex'];
  const { walkable } = VB['sim/walking'];
  const { freeFor } = VB['sim/territory'];
  const { addClaim, realise } = VB['sim/claims'];
  const { log } = VB['sim/records'];
  const { emit } = VB['sim/events'];
  const { dailyNeed, storeRoom } = VB['sim/hunger'];
  const { goodwillOf } = VB['sim/relations'];
  const { clearHours, builtTiles, BREAK_HOURS } = VB['sim/fieldplans'],
    { clearStones, broken } = VB['sim/newground'];
  const { houses } = VB['sim/green'];
  // @tunable COMMONS: the village's common fields: when the meeting chooses them, and how many
  // Common fields worked by the village (VB-100; Kim, 10 Nov; design, Commons): a routine the meeting may choose for a village of `minFarms`
  // or more occupied farms whose store holds less than `storeDays` days of its members' need, with a free meadow tile within `reach` steps of
  // its green (its centre before it has one); at most one common field for every `perFarms` farms. Its tasks are the village's, at the
  // village-duty priorities of ROLES (`duty`) moved by the village's custom `commons` (`lean`: its options' steps from them).
  // `pull`: how far the help a person's household was given leans it to the next higher option, at `fullDays` days of its need owed.
  const COMMONS = {
    minFarms: 3,
    storeDays: 10,
    reach: 3,
    perFarms: 3,
    lean: { own: -2, fair: 0, first: 2 },
    fullDays: 30,
    pull: 0.6,
  };
  // @state village.commonFields: the village's common fields, records as a farm's (farmstead.fields, sim/fields: stage, crop, sown...),
  //   absent before its first; a field is added only here, when its ground is broken; its stages are written by sim/fields as a farm's.
  // @state the common field's project plan (st.plans.projects.village; sim/projects): {what: 'commons', started (game hours), steps: [{kind
  //   'clear', place, hours, stake 'field'}, {kind 'break', place, hours, stake 'field'}]}, at most one a village; from its making its tile
  //   is claimed by the village (st.claims, why 'field'; renewed by the work) and in use (st.used); breaking makes it the village's.
  //   village.commonSow: absent, or {year, sow}: the year's decision to sow the common fields (VB-457), taken on the first review of the village
  //   in the crop's sowing window: sow only while its store lacks of its target (HELP.storeTarget); written only here.
  const NONE = [];
  const VILLAGE = (v) => ({ type: 'village', id: v.id });
  const fieldsOf = (v) => v.commonFields || NONE;
  // The village's common field under way, or null.
  function underWay(st, v) {
    for (const p of Projects.projectsOf(st, 'village', v.id)) if (p.what === 'commons') return p;
    return null;
  }
  // The days of its members' need that the village store holds, less the seed it holds back for its common fields.
  function storeDays(st, v) {
    let need = 0;
    for (const id of v.farmsteads) {
      const f = st.farmsteads[id];
      if (f.household !== null) need += dailyNeed(st, st.households[f.household]);
    }
    return need > 0 ? Math.max(0, Stores.grainOf(v) - Stores.reserved(st, v, 'grain')) / need : Infinity;
  }
  // Whether the village has room for another common field: fewer, with the one under way, than one for every COMMONS.perFarms farms.
  const room = (st, v, farms) => fieldsOf(v).length + (underWay(st, v) ? 1 : 0) < Math.floor(farms / COMMONS.perFarms);
  // The common field's tile: of the free open meadow within COMMONS.reach walking steps of the green (the village's centre), farmable,
  // unbroken and not in use, not a house's or a green's, not in the village's wood, land the village may take in (its outland, or wilderness
  // nobody claims; sim/territory): the nearest, the most fertile between equals, then the lowest id; -1 for none.
  function site(st, v) {
    const w = st.w,
      wood = new Set(v.wood),
      built = builtTiles(st);
    let best = -1,
      bd = Infinity,
      bf = -Infinity;
    for (const [t, d] of bfs(w, v.center, COMMONS.reach, walkable(w)).dist) {
      if (d < 1 || w.biome[t] !== B.MEADOW || !farmable(w, t) || w.dev[t] || st.used.has(t) || built.has(t)) continue;
      if (wood.has(t) || !freeFor(st, t, v.id)) continue;
      const fe = fertility(w, t);
      if (d < bd || (d === bd && (fe > bf || (fe === bf && t < best)))) {
        best = t;
        bd = d;
        bf = fe;
      }
    }
    return best;
  }
  // Whether the village would make a common field now (Kim, 10 Nov): COMMONS.minFarms or more occupied farms, its store under
  // COMMONS.storeDays days of its members' need, room for one more, and a tile for it.
  function wanted(st, v) {
    const farms = houses(st, v).length;
    return farms >= COMMONS.minFarms && room(st, v, farms) && storeDays(st, v) < COMMONS.storeDays && site(st, v) >= 0;
  }
  // Whether the routine is open to the village (VILLAGE_ROUTINES, sim/routines): it has common fields to work, one under way, or would make one.
  const available = (st, v) => fieldsOf(v).length > 0 || !!underWay(st, v) || wanted(st, v);
  // The common field's project plan, as sim/plans makes it (makeProject), or null while the village would make none.
  function project(st, v) {
    if (underWay(st, v) || !wanted(st, v)) return null;
    const t = site(st, v);
    return {
      what: 'commons',
      started: st.t,
      ground: groundKey(st.w, t),
      steps: [
        { kind: 'clear', place: t, hours: clearHours(st, t), stake: 'field' },
        { kind: 'break', place: t, hours: BREAK_HOURS, stake: 'field' },
      ],
    };
  }
  // The plan made: the village claims its tile (VB-042), in use from now, and the village's log tells it.
  function begun(st, v, plan) {
    const t = plan.steps[0].place;
    addClaim(st, t, VILLAGE(v), 'field');
    st.used.add(t);
    log(st, `${v.name} sets out to clear a common field for the village store.`, { kind: 'field', village: v.id });
  }
  // The open step of the village's common field, on its tile, is the job's.
  const onStep = (st, j, kind) => {
    const plan = underWay(st, st.villages[j.village]),
      s = plan && plan.steps[plan.open];
    return s && s.kind === kind && s.place === j.site ? plan : null;
  };
  // The clearing done (the kind `clear`, sim/kinds): the stones to the heap of the household of the one who finished it; breaking opens.
  function cleared(st, j, hh) {
    const plan = onStep(st, j, 'clear');
    if (!plan) return;
    clearStones(st, j.site, hh);
    emit(st, 'stepDone', { type: 'village', id: j.village, plan });
  }
  // The ground broken (the kind `break`): the tile is the village's, a common field in stubble; the project is finished.
  function brokenUp(st, j) {
    const plan = onStep(st, j, 'break');
    if (!plan) return;
    const v = st.villages[j.village];
    realise(st, j.site, VILLAGE(v));
    if (!v.commonFields) v.commonFields = [];
    v.commonFields.push(broken(st, j.site, v.commonFields.length, plan.ground));
    st.villageDirty.add(v.id); // its new field is drawn (VB-442)
    emit(st, 'stepDone', { type: 'village', id: v.id, plan });
    log(st, `${v.name} has broken a common field: its harvest will go to the village store.`, {
      kind: 'field',
      village: v.id,
    });
  }
  // A load of the common field's sheaves brought to the green (the kind `haul`): threshed there, its grain goes into the village store
  // (the village has no barn; the agent's reading). The last load is told in the village's log.
  function brought(st, j, a) {
    const v = st.villages[j.village],
      n = a.load || 0;
    if (n > 0) Stores.put(st, v, Stores.grainGood(j.field.crop), n, 'harvest');
    const more = j.claims.some((id) => id !== a.id && st.agents[id].load > 0 && st.agents[id].load > 0);
    if (j.field.stage !== 'stooks' && !more)
      log(st, `${v.name} has brought in the harvest of its common field to the village store.`, {
        kind: 'harvest',
        village: v.id,
      });
  }
  // Whether the common fields are sown this year (VB-457): decided once a year, at the village's first review in the sowing window, by its
  // store under its target at that hour; otherwise they lie fallow, grazed as meadow. A field already sown is harvested whatever the store.
  function sowThisYear(st, v, c) {
    if (!v.commonSow || v.commonSow.year !== c.year) v.commonSow = { year: c.year, sow: storeRoom(st, v) > 1e-9 };
    return v.commonSow.sow;
  }
  // The village's review (sim/jobs), while its meeting chose the commons: the open step of the common field under way, and at each common
  // field the field kinds of its stage, as a farm's (fieldAt: sim/kinds' ASK.fieldAt), owned by the village; a common field's job carries
  // `common` and its village, and the haul brings the sheaves to the green.
  function work(st, v, c, post, fieldAt) {
    const own = VILLAGE(v),
      plan = underWay(st, v);
    if (plan) {
      const s = plan.steps[plan.open];
      post(`${s.kind}:v${v.id}`, s.place, { village: v.id, common: true, hours: s.hours }, s.kind, own);
    }
    for (const fd of fieldsOf(v)) {
      const rules = fieldAt[fd.stage];
      if (!rules) continue;
      if (fd.stage === 'stubble') {
        const w = CROPS[fd.crop].sow;
        if (c.season !== w[0] || c.sday < w[1] || c.sday > w[2] || !sowThisYear(st, v, c)) continue; // a field's hoeing is the sowing's start
      }
      for (let i = 0; i < rules.length; i++) {
        const k = rules[i][0];
        rules[i][1](
          st,
          v,
          fd,
          c,
          (key, site, extra) => {
            const x = { field: fd, village: v.id, common: true };
            if (extra.hours !== undefined) x.hours = extra.hours;
            if (k === 'haul') x.dest = v.center;
            post(`${k}:v${v.id}.${fd.id}`, site, x, k, own);
          },
          v,
        );
      }
    }
  }
  // ---- the custom (Kim, 10 Nov): the priority of the commons' tasks, a role's village duty (ROLES' `duty`) moved by COMMONS.lean of the
  // option in force, compiled once into a table by option and role (Rules for cost, 6: read in the bid, it allocates nothing) ----
  const DIM = IDX.commons,
    OPTS = DIMS[DIM].opts.map((o) => o[0]);
  const PRIO = OPTS.map((k) =>
    Object.fromEntries(
      Object.keys(ROLES).map((r) => [r, ROLES[r].work.duty ? Math.max(0, ROLES[r].work.duty + COMMONS.lean[k]) : 0]),
    ),
  );
  // The option of the custom in force in village vid (its settlement's practice), an index of OPTS.
  const optionOf = (st, vid) => inForceAt(st, DIM, vid);
  // A pawn's priority for a common field's job (sim/fit).
  const commonPrio = (st, p, j) => PRIO[optionOf(st, j.village)][p.role] || 0;
  // Help received leans a person towards the commons (Kim, 10 Nov): the days of its household's need it owes in goodwill (what its holder
  // was given and has not given back, fading as goodwill fades: sim/relations), up to COMMONS.fullDays, lean it by up to COMMONS.pull
  // towards the next higher option than the one in force. Read at the refresh of the interests (sim/society), from the balances as kept.
  // {to (an index of OPTS), w}, or null.
  function helpLean(st, p, vid) {
    const hh = p.household === null ? null : st.households[p.household];
    if (!hh || hh.dissolved || hh.holder === null || vid === null) return null;
    let owed = 0;
    for (const g of goodwillOf(st, hh.holder)) if (g.balance < 0) owed -= g.balance;
    const need = dailyNeed(st, hh);
    if (!(owed > 0) || !(need > 0)) return null;
    return {
      to: Math.min(OPTS.length - 1, optionOf(st, vid) + 1),
      w: COMMONS.pull * Math.min(1, owed / need / COMMONS.fullDays),
    };
  }
  // A common field shares the field's kinds (sim/fieldwork): three end otherwise for it. Its sheaves go into the village store, and its
  // clearing and breaking are the village's project, not a household's (VB-100). K: the field's kinds; sim/kinds joins what this gives.
  const common = (K) => ({
    ...K,
    haul: { ...K.haul, deliver: (st, j, hh, f, a) => (j.common ? brought(st, j, a) : K.haul.deliver(st, j, hh, f, a)) },
    clear: { ...K.clear, done: (st, j, hh) => (j.common ? cleared(st, j, hh) : K.clear.done(st, j, hh)) },
    break: { ...K.break, done: (st, j) => (j.common ? brokenUp(st, j) : K.break.done(st, j)) },
  });
  return {
    COMMONS,
    common,
    fieldsOf,
    underWay,
    storeDays,
    site,
    wanted,
    available,
    project,
    begun,
    cleared,
    brokenUp,
    brought,
    work,
    commonPrio,
    helpLean,
    OPTS,
  };
})();
