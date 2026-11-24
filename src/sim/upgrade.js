// @sys sim/upgrade: the main building built up a rung as a task of the player's plan (VB-1632; Kim, 24 Nov 2026: "It should then be
//   possible to upgrade the main building"): the chain `upgrade` (the booth to a cottage today), contributed to sim/planchains' CHAINS at
//   load; the head's verb that begins the cottage (beginCottage: its plan made as sim/settle and sim/scenarios make it); and the timber
//   held at home taken into the walls of a cottage so begun before any is fetched
VB['sim/upgrade'] = (() => {
  const { BUILD, ECON } = VB['sim/rules'];
  const { register } = VB['sim/commands'];
  const { living } = VB['sim/records'];
  const { on } = VB['sim/events'];
  const Stores = VB['sim/stores'],
    Projects = VB['sim/projects'];
  const { KINDS } = VB['sim/kinds'];
  const { makeProject } = VB['sim/projectplans'];
  const { COTTAGE, cottagePlan, cottageOf, wallsOf } = VB['sim/cottageplan'];
  const { CHAINS, taskAt } = VB['sim/planchains'];
  const { rungWhy } = VB['sim/ladder'];
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
  // beginCottage(tile): the head of a household living in a booth begins its cottage at its house (`tile`): the cottage plan made as a
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
  return { homeTimber };
})();
