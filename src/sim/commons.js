// @sys sim/commons: common fields worked by the village (VB-100; Kim, 10 Nov): a routine its meeting may choose for a village of three or more
// occupied farms whose store runs short, with free meadow near its green; the village claims the tile and clears and breaks it as a farm
// makes a field, then works it through a farm field's stages, its tasks the village's at the priorities its custom `commons` sets; the seed
// comes from the village store and the harvest goes into it. Help a household was given leans its people towards the commons.
VB['sim/commons'] = (() => {
  const Projects = VB['sim/projects'],
    Stores = VB['sim/stores'],
    Culture = VB['culture'];
  const { COMMONS, ROLES, farmable, fertility } = VB['sim/rules'];
  const { B } = VB['gen'];
  const { bfs } = VB['sim/hex'];
  const { walkable } = VB['sim/routes'];
  const { freeFor } = VB['sim/territory'];
  const { addClaim, realise } = VB['sim/claims'];
  const { log } = VB['sim/records'];
  const { emit } = VB['sim/events'];
  const { dailyNeed } = VB['sim/hunger'];
  const { goodwillOf } = VB['sim/relations'];
  const { clearHours, clearStones, broken, builtTiles, BREAK_HOURS } = VB['sim/fields'];
  const { houses } = VB['sim/green'];
  // @state village.commonFields: the village's common fields, records as a farm's (farmstead.fields, sim/fields: stage, crop, sown...),
  //   absent before its first; a field is added only here, when its ground is broken; its stages are written by sim/fields as a farm's.
  // @state the common field's project plan (st.plans.projects.village; sim/projects): {what: 'commons', started (game hours), steps: [{kind
  //   'clear', place, hours, stake 'field'}, {kind 'break', place, hours, stake 'field'}]}, at most one a village; from its making its tile
  //   is claimed by the village (st.claims, why 'field'; renewed by the work) and in use (st.used); breaking makes it the village's.
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
  // Whether the routine is open to the village (VILLAGE_ROUTINES, sim/plans): it has common fields to work, one under way, or would make one.
  const available = (st, v) => fieldsOf(v).length > 0 || !!underWay(st, v) || wanted(st, v);
  // The common field's project plan, as sim/plans makes it (makeProject), or null while the village would make none.
  function project(st, v) {
    if (underWay(st, v) || !wanted(st, v)) return null;
    const t = site(st, v);
    return {
      what: 'commons',
      started: st.t,
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
    v.commonFields.push(broken(st, j.site, v.commonFields.length));
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
    const more = j.claims.some((id) => id !== a.id && st.agents[id].phase === 'back' && st.agents[id].load > 0);
    if (j.field.stage !== 'stooks' && !more)
      log(st, `${v.name} has brought in the harvest of its common field to the village store.`, {
        kind: 'harvest',
        village: v.id,
      });
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
  const DIM = Culture.IDX.commons,
    OPTS = Culture.DIMS[DIM].opts.map((o) => o[0]),
    FAIR = OPTS.indexOf('fair');
  const PRIO = OPTS.map((k) =>
    Object.fromEntries(
      Object.keys(ROLES).map((r) => [r, ROLES[r].work.duty ? Math.max(0, ROLES[r].work.duty + COMMONS.lean[k]) : 0]),
    ),
  );
  // The option of the custom in force in village vid (its settlement's practice), an index of OPTS.
  const optionOf = (st, vid) => (st.cenv && st.cenv.settlements[vid] ? st.cenv.settlements[vid].practice[DIM] : FAIR);
  // A pawn's priority for a common field's job (sim/jobs).
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
  return {
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
