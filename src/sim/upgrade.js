// @sys sim/upgrade: the main building built up a rung as a task of the player's plan (VB-1632; Kim, 24 Nov 2026: "It should then be
//   possible to upgrade the main building"): the chain `upgrade` (the shelter to a cottage today), contributed to sim/planchains' CHAINS at
//   load; the head's verb that begins the cottage (beginCottage: its plan made as sim/settle and sim/scenarios make it); and the timber
//   held at home taken into the walls of a cottage so begun before any is fetched; a camp's household left to itself placing its
//   farmstead and beginning its cottage by its head's own rule (ownRung, VB-1630); the house set on stone and an outbuilding built as
//   tasks of the plan (VB-1635: the chains `foundation`, its review asked at once, and `outbuilding`, the timber at home first); a farm
//   with animals and no byre building one by its head's own rule (ownByre, VB-1637)
VB['sim/upgrade'] = (() => {
  const { BUILD, ECON, DAY, SEASON_DAYS, YEAR, WORK, cal } = VB['sim/rules'];
  const { register, issue } = VB['sim/commands'];
  const Camp = VB['sim/camp'];
  const { living } = VB['sim/records'];
  const { on, emit } = VB['sim/events'];
  const Stores = VB['sim/stores'],
    Projects = VB['sim/projects'];
  const { projectsOf, lacks } = Projects;
  const { KINDS } = VB['sim/kinds'];
  const { makingOf } = VB['sim/makings'];
  const { makeProject } = VB['sim/projectplans'];
  const { COTTAGE, cottagePlan, cottageOf, wallsOf } = VB['sim/cottageplan'];
  const { CHAINS, taskAt, headCmd } = VB['sim/planchains'];
  const { rungWhy, foundationWhy, outWhy, OUTBUILDINGS } = VB['sim/ladder'];
  const { byreWhy } = VB['sim/byrehouse'];
  const WALLS = COTTAGE.indexOf('walls');
  // The farm of household hid while it lives, or null.
  const farmOf = (st, hid) => {
    const hh = hid === null || hid === undefined ? null : st.households[hid];
    return hh && !hh.dissolved && hh.farmstead !== null ? st.farmsteads[hh.farmstead] : null;
  };
  // ---- the timber at home first ----
  // The timber household hh holds at home taken into the walls of its cottage plan p while they lack it (through sim/stores, the reason
  // 'build': what a project's step spends); the loads taken. Only for a cottage the upgrade task began: an unplayed household's timber
  // home is its firewood, cut at the house as before.
  function homeTimber(st, hh, p) {
    if (COTTAGE.indexOf(p.steps[p.open].kind) > WALLS) return 0;
    const walls = wallsOf(p),
      n = Math.min(Stores.heldOf(hh, 'timber'), Projects.lacks(walls, BUILD.timber));
    if (!(n > 0)) return 0;
    const got = Stores.take(st, hh, 'timber', n, 'build');
    walls.wood = (walls.wood || 0) + got; // the walls' timber brought from home, as a trip's load is (sim/building)
    return got;
  }
  // A trip of timber is home (sim/chores' wood): the played household's cottage begun by its upgrade task takes it while its walls lack it.
  on('timberHome', (st, { household }) => {
    const pl = st.player,
      f = pl && st.pawns[pl.pawn].household === household ? farmOf(st, household) : null,
      p = f && f.booth ? cottageOf(st, household) : null;
    if (p && taskAt(st, 'upgrade', f.house)) homeTimber(st, st.households[household], p);
  });
  // ---- the verb: the head begins its cottage ----
  // beginCottage(tile): the head of a household living in its shelter (VB-1638) begins its cottage at its house (`tile`): the cottage plan made as a
  // settler household's is (sim/cottageplan cottagePlan), its stages then posted as theirs are (sim/building boothWork), and the timber
  // held at home taken into its walls. A verb, not the making registry: the cottage is the household's one main building, a project plan
  // of its own (sim/projects, 'cottage'), not a small construction beside others; the plan's chain reaches it as the farmstead's placing.
  function beginWhy(st, id, tile) {
    const p = st.pawns[id],
      f = p ? farmOf(st, p.household) : null;
    if (!f) return `pawn ${id} has no household`;
    if (f.house !== tile) return `the household's house is not at ${tile}`;
    return rungWhy(st, id, f, 'cottage');
  }
  register('beginCottage', {
    check: (st, c) => living(st, c.actor) || beginWhy(st, c.actor, c.target),
    run: (st, c) => {
      const hh = st.households[st.pawns[c.actor].household],
        f = st.farmsteads[hh.farmstead],
        p = makeProject(st, 'household', hh.id, cottagePlan(st, f));
      st.farmDirty.add(f.id);
      if (p) homeTimber(st, hh, p);
    },
  });
  // ---- the head's own rule (VB-1630): a camp left to itself gets its roof ----
  // Each working hour, every household whose farm was landed as a camp (sim/camp; f.camp set) and whose head does not hold off projects
  // (sim/projects heldOff: automatic behaviour on, or a head not played) builds up by its own rule, by the verbs a player's plan issues:
  // from a camp with no shelter begun it places the farmstead (sim/camp placeOwn); once the shelter stands (camp false, f.booth) it begins
  // its cottage (beginCottage), as the solo start without `hand` makes it at the landing (sim/scenarios landAlone). Few farms are camps;
  // the rest are passed over at one read each (the work counter campLook).
  // And the played head's foundation task asks its review (askFoundation, VB-1635); its outbuilding begun takes the timber at home (outTimber).
  function ownRung(st) {
    askFoundation(st);
    if (st.player) outTimber(st, st.pawns[st.player.pawn].household); // an outbuilding whose first step is its walls (a byre, VB-1637)
    for (const hid of st.liveHouseholds) {
      VB.count.campLook++;
      const f = farmOf(st, hid);
      if (f && !f.byre && !f.booth) ownByre(st, st.households[hid]);
      if (!f || f.camp === undefined || !f.booth || Projects.heldOff(st, hid)) continue;
      const hh = st.households[hid];
      if (f.camp === true) Camp.placeOwn(st, hh, f);
      else if (hh.holder !== null && !cottageOf(st, hid))
        issue(st, { actor: hh.holder, verb: 'beginCottage', target: f.house, source: 'pawn' });
    }
  }
  // The byre (VB-1637; one rule for every household, Kim): a head not held off projects whose farm has its cottage, animals and no byre
  // begins one (the making `byre`, sim/byrehouse, under byreWhy) as soon as its hands are free of any other large project (its prudence,
  // its own choice and not a refusal, VB-1640), before its first winter if it can: its animals winter in the open until it stands.
  function ownByre(st, hh) {
    if (!hh.herds.length || hh.holder === null || Projects.heldOff(st, hh.id) || Projects.ownOf(st, hh.id)) return;
    if (byreWhy(st, hh) !== null) return;
    issue(st, { actor: hh.holder, verb: 'project', target: hh.id, args: { what: 'byre' }, source: 'pawn' });
  }
  // ---- the chain: upgrade (CHAINS.upgrade) ----
  // At the house's tile of the household's farm: {f, hh, tile, what (the task's rung, 'cottage' before it is planned), cottage (its plan
  // once begun, or null)}. Its act begins the cottage (beginCottage); then its stages at the house, the walls' timber trips before the
  // walls while they lack it (their jobs stand at the wood: found by their keys); it leaves when the roof is on ('roof'), or when the
  // household or its house is gone ('gone').
  const trips = (lack) => Math.max(1, Math.ceil(lack / ECON.woodPerTrip - 1e-9));
  const upgrade = {
    noun: 'upgrade',
    mark: null,
    kinds: ['fell', 'grub', 'foundation', 'timber', 'walls', 'roof'],
    which: ['roof', 'gone'],
    // `what`: the rung to build, one that follows the one standing; only the cottage today
    args: (g, st, id) => {
      if (g.what === undefined || g.what === null) return 'name the rung to build (what)';
      const why = rungWhy(st, id, farmOf(st, st.pawns[id].household), g.what);
      return why === null ? { what: g.what } : why;
    },
    at: (st, hid, tile) => {
      const f = farmOf(st, hid);
      if (!f || f.house !== tile || f.household !== hid) return null;
      const t = taskAt(st, 'upgrade', tile);
      return { f, hh: st.households[hid], tile, what: t ? t.what : 'cottage', cottage: cottageOf(st, hid) };
    },
    none: (tile) => `the household's house is not at ${tile}`,
    why: (st, { hh, cottage }) => (cottage ? `household ${hh.id} has a cottage under way` : null),
    // the cottage plan's stages left (all of them before it is begun), the timber trips its walls lack before the walls: before it is
    // begun, what the timber at home will not cover
    steps: (st, hid, { f, hh, cottage: p }) => {
      if (!f.booth) return [];
      const list = p ? p.steps.slice(p.open) : cottagePlan(st, f).steps,
        lack = p
          ? COTTAGE.indexOf(p.steps[p.open].kind) > WALLS
            ? 0
            : Projects.lacks(wallsOf(p), BUILD.timber)
          : Math.max(0, BUILD.timber - Stores.heldOf(hh, 'timber')),
        out = [];
      for (const s of list) {
        if (s.kind === 'walls' && lack > 0)
          out.push({
            kind: 'timber',
            hours: KINDS.timber.hours,
            n: trips(lack),
            from: -Infinity,
            keys: [`timber:f${f.id}`, `timber:f${f.id}b`],
          });
        out.push({ kind: s.kind, hours: s.hours, n: 1, from: -Infinity });
      }
      return out;
    },
    gone: (st, { f }) => (f.booth ? null : 'roof'),
    deadline: () => null,
    act: (st, id, where, tile) =>
      !where.cottage && where.f.booth && where.what === 'cottage'
        ? { actor: id, verb: 'beginCottage', target: tile, args: null, source: 'player' }
        : null,
  };
  CHAINS.upgrade = upgrade; // contributed at load, before the first seed (VB-1632)
  // ---- the chain: foundation (CHAINS.foundation; VB-1635) ----
  // The house set on stone as a task of the plan: the head's own building step (sim/building buildStep, opened at a review of its plan),
  // which a played head holding off projects opens for this task alone; the plan asks its head for that review at once (askFoundation,
  // the event planAsks), as a firewood task asks for its cutting (VB-1633). Then the stone's loads as the step posts them (stoneWork:
  // picked or quarried, two trips at a time, found by their keys at the source), and the raising at the house. The played head with
  // automatic behaviour off raises outside the slack of the year, as it builds its cottage (VB-1632: the plan says when); any other head
  // raises in the slack (the wait `opens`, what: 'the slack of the year'). It leaves when the house stands on stone ('raised') or the
  // household or its house is gone ('gone').
  const handAt = (st, hh) => !!st.player && !st.player.auto && hh.holder === st.player.pawn;
  const inSlack = (c) => (c.season === 1 && c.sday < SEASON_DAYS / 2) || c.season === 3;
  // The game hour the raising may be posted from: now in the slack (or for the played head by hand), else the next slack's first day.
  function raiseFrom(st, hh) {
    const c = cal(st.t);
    if (handAt(st, hh) || inSlack(c)) return -Infinity;
    return Math.floor(st.t / YEAR) * YEAR + (c.season === 0 ? 1 : 3) * SEASON_DAYS * DAY + WORK[0];
  }
  const foundation = {
    noun: 'stone foundation',
    mark: null,
    kinds: ['pick', 'quarry', 'raise'],
    which: ['raised', 'gone'],
    at: (st, hid, tile) => {
      const f = farmOf(st, hid);
      if (!f || f.house !== tile || f.household !== hid) return null;
      const plan = st.plans.households.get(hid);
      return { f, hh: st.households[hid], tile, step: (plan && plan.build) || null };
    },
    none: (tile) => `the household's house is not at ${tile}`,
    why: (st, { f }) => foundationWhy(st, st.player.pawn, f),
    // the loads the heap lacks (of the step's kind; picked before the step opens), then the raising
    steps: (st, hid, { f, hh, step }) => {
      if (f.booth || f.grade !== 'ground') return [];
      const lack = Math.max(0, BUILD.foundationStone - Stores.heldOf(hh, 'stone')),
        out = [];
      if (lack > 0) {
        const kind = step && step.kind ? step.kind : 'pick';
        out.push({
          kind,
          hours: KINDS[kind].hours,
          n: lack,
          from: -Infinity,
          keys: [`${kind}:h${hid}`, `${kind}:h${hid}b`],
        });
      }
      out.push({
        kind: 'raise',
        hours: BUILD.foundationHours,
        n: 1,
        from: raiseFrom(st, hh),
        what: 'the slack of the year',
        keys: [`raise:f${f.id}`],
      });
      return out;
    },
    gone: (st, { f }) => (f.grade === 'stone' ? 'raised' : null),
    deadline: () => null,
  };
  CHAINS.foundation = foundation;
  // The played head's foundation task with no building step open: its plan asks its head for a review (at most one a day, sim/stores).
  function askFoundation(st) {
    const pl = st.player,
      hid = pl && pl.plan ? st.pawns[pl.pawn].household : null,
      f = farmOf(st, hid);
    if (!f || f.booth || f.grade !== 'ground' || !taskAt(st, 'foundation', f.house)) return;
    const plan = st.plans.households.get(hid);
    if (plan && !plan.build && !plan.dirty) emit(st, 'planAsks', { household: hid });
  }
  // ---- the chain: outbuilding (CHAINS.outbuilding; VB-1635) ----
  // Any outbuilding of sim/ladder's OUTBUILDINGS (`what`, the task's: a barn today) built as a task of the plan: its act begins it by the
  // head's verb `project` and the making of its name (sim/makings; a barn: sim/aims, under barnWhy), as the head's own rule would; then its
  // stages at the house, the timber trips a stage that carries timber lacks before it (their jobs at the wood, found by their keys), the
  // timber held at home first (outTimber, as the cottage's walls take it, VB-1632). It leaves when the farm has it ('built'), or when the
  // household or its house is gone ('gone'). One task an outbuilding, several at a house side by side (VB-1640): each read for its task.
  function openOut(st, hid, what) {
    for (const p of projectsOf(st, 'household', hid)) if (p.what === what) return p;
    return null;
  }
  const outbuilding = {
    noun: 'outbuilding',
    mark: null,
    kinds: ['timber', ...new Set(Object.values(OUTBUILDINGS).flatMap((o) => o.kinds))],
    which: ['built', 'gone'],
    // `what`: one of OUTBUILDINGS, none built, under way or planned, under its making's check
    args: (g, st, id) => {
      if (g.what === undefined || g.what === null) return 'name the outbuilding to build (what)';
      const why = outWhy(st, id, farmOf(st, st.pawns[id].household), g.what);
      return why === null ? { what: g.what } : why;
    },
    at: (st, hid, tile, task) => {
      const f = farmOf(st, hid);
      if (!f || f.house !== tile || f.household !== hid) return null;
      const t = task && task.kind === 'outbuilding' ? task : taskAt(st, 'outbuilding', tile),
        what = t ? t.what : null;
      return { f, hh: st.households[hid], tile, what, project: what ? openOut(st, hid, what) : null };
    },
    none: (tile) => `the household's house is not at ${tile}`,
    why: () => null,
    // its stages left (all of them before it is begun, as its making would begin it), each that carries timber after the trips it lacks:
    // before it opens, what the timber at home will not cover
    steps: (st, hid, { f, hh, what, project: p }) => {
      if (!what || f[what]) return [];
      const list = p ? p.steps.slice(p.open) : makingOf(what).begin(st, hh, f).steps,
        out = [];
      let home = Stores.heldOf(hh, 'timber');
      list.forEach((s, i) => {
        if (s.timber) {
          const open = !!p && i === 0;
          let lack = open ? lacks(s, s.timber) : s.timber;
          if (!open) {
            const h = Math.min(home, lack);
            lack -= h;
            home -= h;
          }
          if (lack > 0)
            out.push({
              kind: 'timber',
              hours: KINDS.timber.hours,
              n: trips(lack),
              from: -Infinity,
              keys: p ? [`timber:b${f.id}.${p.id}`, `timber:b${f.id}.${p.id}b`] : [],
            });
        }
        out.push({ kind: s.kind, hours: s.hours, n: 1, from: -Infinity });
      });
      return out;
    },
    gone: (st, { f, what }) => (what && f[what] ? 'built' : null),
    deadline: () => null,
    act: (st, id, where) =>
      where.what && !where.project && !where.f[where.what] ? headCmd(id, where.hh.id, { what: where.what }) : null,
  };
  CHAINS.outbuilding = outbuilding;
  // The timber household hid holds at home taken into the open step of each outbuilding its played head's tasks name, in the plan's
  // order, while that step carries timber and lacks it (through sim/stores, the reason 'build'); the loads taken. At each trip of timber
  // home, and as a stage ends (the walls open).
  function outTimber(st, hid) {
    const pl = st.player,
      f = pl && st.pawns[pl.pawn].household === hid ? farmOf(st, hid) : null;
    if (!f || !pl.plan) return 0;
    let got = 0;
    for (const t of pl.plan.tasks) {
      const p = t.kind === 'outbuilding' && t.outbuilding === f.house ? openOut(st, hid, t.what) : null,
        s = p && p.steps[p.open];
      if (!s || !s.timber) continue;
      const hh = st.households[hid],
        n = Math.min(Stores.heldOf(hh, 'timber'), lacks(s, s.timber));
      if (!(n > 0)) continue;
      const took = Stores.take(st, hh, 'timber', n, 'build');
      s.wood = (s.wood || 0) + took; // the timber brought from home, as a trip's load is (sim/building)
      got += took;
    }
    return got;
  }
  on('timberHome', (st, { household }) => outTimber(st, household));
  on('stepDone', (st, { type, id }) => (type === 'household' ? outTimber(st, id) : 0));
  return { homeTimber, ownRung };
})();
