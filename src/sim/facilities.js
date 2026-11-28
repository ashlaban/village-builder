// @sys sim/facilities [material]: built things on sites (VB-361; target-v2 4.3, Facility, cut to slice 6): a facility's condition, found,
// the verb `found`, a facility's stages as the steps of its owner's project plan (the job kind raisestage), and its upkeep offered on the
// owner's planning day (the verb `upkeep`, the job kind mendfacility), and the tile panel's view; the records (st.facilities, the registry
// FACILITY of the kinds each craft's module declares, a farm's outbuildings) are sim/facilityrecords' (VB-1911).
// Design: design.md, Goods, production and animals (The mill and the loom, the kiln and the quarry: Facilities). A facility owns its
// building progress, so a half-built one outlives a dropped plan and is taken up again by founding it anew on its tile. A farm's
// outbuildings (the barn, the byre and the storehouse, VB-1911) are kinds of it too (`farm`), owned by their farm and begun as its
// household's making; houses, wells, fences and the fishing boat stay where they are (a task for each when a slice needs it).
// Cost (docs/cost.md, rule 9): facilities are few (one or two a household that crafts, one mill a village); nothing walks them all: they
// are read by tile and by owner through the index, their condition in closed form, and upkeep is weighed on the owner's planning day
// among its own facilities only.
VB['sim/facilities'] = (() => {
  // The kinds of event it writes on the record (sim/eventkinds, VB-1946).
  VB['sim/eventkinds'].eventKinds('sim/facilities', {
    facilityBuilt: {}, // a facility's last stage raised (VB-361)
  });
  const { YEAR } = VB['sim/rules'];
  const Stores = VB['sim/stores'],
    Projects = VB['sim/projects'],
    { makeProject } = VB['sim/projectplans'];
  const { emit, on } = VB['sim/events'];
  const { register, issue } = VB['sim/commands'],
    { agentWhy } = VB['sim/decisions'];
  const { log } = VB['sim/records'];
  const R = VB['sim/facilityrecords'],
    { FACILITY, at, ofOwner, make } = R;
  // @tunable FACILITIES: a built facility's upkeep (VB-361). `mend`: below this condition its owner is offered its upkeep on its planning
  // day; a kind's own `wear` (condition lost a year) and `upkeep` (hours to mend it from nothing) are its record's.
  const FACILITIES = { mend: 0.6 };
  const ownerKey = (ref) => `${ref.type}:${ref.id}`;
  const all = (st) => st.facilities || [];
  // A facility's condition now: as it was at condAt, less its kind's wear for the years since once it stands. Allocates nothing.
  function conditionOf(st, fac) {
    if (fac.built === null) return fac.condition;
    const F = FACILITY[fac.kind];
    return Math.max(0, fac.condition - ((F ? F.wear : 0) * (st.t - fac.condAt)) / YEAR);
  }
  const owner = (st, ref) =>
    ref.type === 'household'
      ? st.households[ref.id]
      : ref.type === 'farm'
        ? st.farmsteads[ref.id]
        : st.villages[ref.id];
  // The plan building facility fac, or null.
  function buildPlan(st, fac) {
    for (const p of Projects.projectsOf(st, fac.owner.type, fac.owner.id))
      if (p.what === 'facility' && p.facility === fac.id) return p;
    return null;
  }
  // The loads of each good the stages from fac's open one on still take (fac null: the whole kind's).
  function loadsLeft(F, from) {
    const need = {};
    for (let i = from; i < F.stages.length; i++)
      for (const g in F.stages[i].loads || {}) need[g] = (need[g] || 0) + F.stages[i].loads[g];
    return need;
  }
  // Why `kind` may not be founded on tile `tile` for owner {type, id} now, or null. A household lives and holds a farm of its own (its
  // project's steps are posted at its farm); a village is one. The tile has no facility, but a half-built one of the kind and owner whose
  // plan was dropped, which is taken up again. The owner's stores hold, free of other plans, the loads its stages still take. The kind's
  // own test of the tile.
  function foundWhy(st, kind, tile, ref) {
    const F = Object.hasOwn(FACILITY, kind) ? FACILITY[kind] : null;
    if (!F) return `there is no facility ${kind}`;
    if (F.farm) return `a ${F.name} is begun as its farm's own project`;
    if (!Number.isInteger(tile) || tile < 0 || tile >= st.w.biome.length) return `there is no tile ${tile}`;
    if (!ref || (ref.type !== 'household' && ref.type !== 'village'))
      return 'a facility is owned by a household or a village';
    const o = owner(st, ref);
    if (!o || o.dissolved) return `there is no ${ref.type} ${ref.id}`;
    if (ref.type === 'household' && (o.farmstead === null || st.farmsteads[o.farmstead].household !== o.id))
      return 'the household has no farm of its own';
    const there = at(st, tile);
    let from = 0;
    if (there) {
      const again = there.kind === kind && there.built === null && ownerKey(there.owner) === ownerKey(ref);
      if (!again) return `${FACILITY[there.kind] ? FACILITY[there.kind].name : there.kind} stands on the tile`;
      if (buildPlan(st, there)) return `the ${F.name} is being built`;
      from = there.stage;
    }
    const need = loadsLeft(F, from);
    for (const g in need) {
      const free = Stores.heldOf(o, g) - Stores.reserved(st, o, g);
      if (free + 1e-9 < need[g])
        return `the ${F.name} takes ${need[g]} loads of ${g}, and the stores hold ${Math.floor(free)} free`;
    }
    return there ? null : F.may(st, tile, ref);
  }
  // `kind` founded on `tile` for owner {type, id}: the facility (or the half-built one there, taken up again) and its owner's project
  // plan of its stages, whose loads are reserved now. The facility, or why not (foundWhy; the plan refused by the stores).
  function found(st, kind, tile, ref) {
    const why = foundWhy(st, kind, tile, ref);
    if (why) return why;
    const F = FACILITY[kind];
    const fac = at(st, tile) || make(st, kind, tile, ref);
    const plan = makeProject(st, ref.type, ref.id, {
      what: 'facility',
      facility: fac.id,
      steps: R.stepsOn(st, kind, null, fac).steps,
      ...(F.small ? { small: true } : {}),
    });
    if (!plan) return `the stores no longer hold the loads of the ${F.name}`;
    st.visualDirty = true;
    return fac;
  }
  // Why the actor may not act for owner ref: a household's head (or {household} for one with no holder: its own rule), a village's alderman.
  function actsFor(st, actor, ref) {
    if (!ref || !Number.isInteger(ref.id)) return 'the owner is not named';
    if (ref.type === 'village')
      return st.villages[ref.id] ? agentWhy(st, ref.id, actor) : `there is no village ${ref.id}`;
    const hh = ref.type === 'household' ? st.households[ref.id] : null;
    if (!hh || hh.dissolved) return `there is no household ${ref.id}`;
    if (Number.isInteger(actor))
      return hh.holder === actor ? null : `pawn ${actor} is not the head of the household: only its head builds for it`;
    return actor && actor.household === hh.id && hh.holder === null
      ? null
      : 'only the head of the household builds for it';
  }
  // found(tile, {kind, owner: {type, id}}): the owner's head (or alderman) founds a facility of `kind` on the tile, its stages the steps
  // of the owner's plan.
  register('found', {
    check: (st, c) => {
      const a = c.args || {};
      return actsFor(st, c.actor, a.owner) || foundWhy(st, a.kind, c.target, a.owner);
    },
    run: (st, c) => {
      found(st, c.args.kind, c.target, c.args.owner);
    },
  });
  // ---- upkeep (offered on the owner's planning day) ----
  const mending = (st, fac) =>
    Projects.projectsOf(st, fac.owner.type, fac.owner.id).some((p) => p.what === 'upkeep' && p.facility === fac.id);
  // Why facility id may not be mended now, or null: it stands, worn below whole, its kind asks upkeep, none under way.
  function upkeepWhy(st, id) {
    const fac = Number.isInteger(id) ? all(st)[id] : null;
    if (!fac) return `there is no facility ${id}`;
    if (fac.built === null) return 'it is still being built';
    if (!(FACILITY[fac.kind] && FACILITY[fac.kind].upkeep > 0)) return 'it asks no upkeep';
    if (conditionOf(st, fac) >= 1) return 'it is whole';
    return mending(st, fac) ? 'it is being mended' : null;
  }
  // upkeep(facility id): its owner's head (or alderman) begins its mending, a small project of one step of the job kind mendfacility, of its
  // kind's upkeep hours for the share worn.
  register('upkeep', {
    check: (st, c) => {
      const fac = Number.isInteger(c.target) ? all(st)[c.target] : null;
      return (fac ? actsFor(st, c.actor, fac.owner) : null) || upkeepWhy(st, c.target);
    },
    run: (st, c) => {
      const fac = st.facilities[c.target],
        hours = FACILITY[fac.kind].upkeep * (1 - conditionOf(st, fac));
      makeProject(st, fac.owner.type, fac.owner.id, {
        what: 'upkeep',
        facility: fac.id,
        small: true,
        steps: [{ kind: 'mendfacility', place: fac.tile, hours }],
      });
    },
  });
  VB.counter(
    'facilityAsk',
    "An owner's facilities read on its planning day for their upkeep (sim/facilities offerUpkeep, VB-361)",
  );
  // The owner's planning day: each of its facilities worn below FACILITIES.mend is offered to its head, who begins the upkeep through
  // the verb. The owner's few facilities, by the index.
  function offerUpkeep(st, ref, actor) {
    for (const id of ofOwner(st, ref)) {
      VB.count.facilityAsk++;
      const fac = st.facilities[id];
      if (fac.built === null || conditionOf(st, fac) >= FACILITIES.mend || upkeepWhy(st, id)) continue;
      issue(st, { actor, verb: 'upkeep', target: id, args: {}, source: 'pawn' });
    }
  }
  on('planReviewed', (st, d) => {
    if (d.why !== 'day' || d.plan.holder.type !== 'household' || !st.facilities || !st.facilities.length) return;
    const hh = st.households[d.plan.holder.id];
    if (Projects.heldOff(st, hh.id)) return;
    offerUpkeep(st, d.plan.holder, hh.holder === null ? { household: hh.id } : hh.holder);
  });
  // A village's review (sim/routines villageSteps), its alderman acting: its facilities' upkeep.
  function villageUpkeep(st, v, a) {
    if (st.facilities && st.facilities.length) offerUpkeep(st, { type: 'village', id: v.id }, a);
  }
  // ---- the work: a stage raised, a facility mended ----
  // The owner's plan whose open step job j is (its kind at its tile) and that names a facility, or null.
  function planOf(st, j) {
    if (!j.owner) return null;
    for (const p of Projects.projectsOf(st, j.owner.type, j.owner.id)) {
      const s = p.steps[p.open];
      if (p.facility !== undefined && s && s.kind === j.kind && s.place === j.site) return p;
    }
    return null;
  }
  // The job's step is done: effect runs and the owner's plan is told (sim/projectplans takes the stage's loads and opens the next).
  function ends(st, j, effect) {
    const plan = planOf(st, j);
    if (!plan) return;
    effect(st, st.facilities[plan.facility], plan);
    emit(st, 'stepDone', { type: plan.holder.type, id: plan.holder.id, plan });
  }
  // A stage raised: the next opens; after the last the facility stands, whole.
  function raised(st, fac, plan) {
    const F = FACILITY[fac.kind];
    if (!R.raiseOn(st, plan)) return;
    const o = owner(st, fac.owner),
      house = fac.owner.type === 'household',
      f = house && o.farmstead !== null ? st.farmsteads[o.farmstead] : null;
    const where = house
      ? { household: o.id, ...(f ? { farm: f.id, village: f.village } : {}) }
      : { village: fac.owner.id };
    log(st, `${f ? f.name : o.name} has built a ${F.name}.`, { kind: 'facilityBuilt', facility: fac.id, ...where });
  }
  const mended = (st, fac) => R.mend(st, fac);
  // The hours worked on the open stage, kept on the facility as the task is reckoned (sim/work): the stage's hours less the step's,
  // where it was taken up again half-built, and the job's hours done.
  function worked(st, j) {
    const plan = planOf(st, j);
    if (!plan) return;
    const fac = st.facilities[plan.facility],
      s = FACILITY[fac.kind].stages[fac.stage];
    if (s) R.workedOn(fac, Math.min(s.hours, s.hours - j.hours + j.done));
  }
  // A village's facility steps (asked at the village, sim/kinds ASK): the open step of each of its plans that names a facility, owned by
  // the village. A household's are posted with its other project steps (sim/projects landProject).
  function villageWork(st, v, at, c, post) {
    for (const p of Projects.projectsOf(st, 'village', v.id)) {
      const s = p.facility !== undefined ? p.steps[p.open] : null;
      if (s)
        post(`${s.kind}:v${v.id}.p${p.id}`, s.place, { village: v.id, hours: s.hours }, s.kind, {
          type: 'village',
          id: v.id,
        });
    }
  }
  const spot = (st, a, j) => [st.w.hx[j.site] + a.ox * 0.4, st.w.hy[j.site] + 4 + a.oy * 0.3];
  const kind = (verb, go, name, label, anim, gives, done, more = {}) => ({
    at: ['site'],
    needs: [],
    gives,
    verb,
    go,
    name,
    label,
    anim,
    hours: 10,
    hands: Infinity,
    type: 'wood', // as a cart's building, a tar pit's digging and a well's
    project: true,
    spot,
    done: (st, j) => ends(st, j, done),
    ...more,
  });
  // The job kinds (sim/kinds registers them): their hours are each step's.
  const KINDS = {
    raisestage: kind(
      'Raising a building',
      'Going to the building site',
      'Raise a building',
      'Building',
      'mallet',
      ['facility'],
      raised,
      {
        worked,
      },
    ),
    mendfacility: kind(
      'Mending a building',
      'Going to mend a building',
      'Mend a building',
      'Mending',
      'mallet',
      [],
      mended,
    ),
  };
  // What the tile panel says of facility fac: its kind's name, its owner's name and its stage.
  function view(st, fac) {
    const F = FACILITY[fac.kind],
      o = owner(st, fac.owner),
      who =
        fac.owner.type === 'village'
          ? `${o.name} village`
          : fac.owner.type === 'farm'
            ? `${o.name} farm`
            : o.farmstead !== null
              ? `${st.farmsteads[o.farmstead].name} household`
              : 'a household';
    const s = fac.built === null ? F.stages[fac.stage] : null,
      named = s && s.name ? `, ${s.name}` : '';
    const stage = s
      ? `being built: stage ${fac.stage + 1} of ${F.stages.length}${named}, ${Math.round(fac.done)} of ${s.hours} hours`
      : `standing, in ${Math.round(conditionOf(st, fac) * 100)}% condition`;
    return { name: F ? F.name : fac.kind, owner: who, stage };
  }
  return {
    FACILITIES,
    KINDS,
    conditionOf,
    foundWhy,
    found,
    upkeepWhy,
    villageUpkeep,
    villageWork,
    view,
  };
})();
