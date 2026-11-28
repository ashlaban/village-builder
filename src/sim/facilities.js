// @sys sim/facilities [material]: built things on sites (VB-361; target-v2 4.3, Facility, cut to slice 6): st.facilities, each with its kind, tile,
// owner (a household or a village), the stage of its building, its condition and when it was built; the registry FACILITY of the kinds
// each craft's module declares (its stages, where it may stand, its capabilities and capacity); found, the verb `found`, a facility's
// stages as the steps of its owner's project plan (the job kind raisestage), and its upkeep offered on the owner's planning day (the verb
// `upkeep`, the job kind mendfacility)
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
  const { atLoad } = VB['sim/registry'];
  const Stores = VB['sim/stores'],
    Projects = VB['sim/projects'],
    { makeProject } = VB['sim/projectplans'];
  const { emit, on } = VB['sim/events'];
  const { register, issue } = VB['sim/commands'],
    { agentWhy } = VB['sim/decisions'];
  const { log } = VB['sim/records'];
  // @tunable FACILITIES: a built facility's upkeep (VB-361). `mend`: below this condition its owner is offered its upkeep on its planning
  // day; a kind's own `wear` (condition lost a year) and `upkeep` (hours to mend it from nothing) are its record's.
  const FACILITIES = { mend: 0.6 };
  // ---- the kinds (declared at load by each craft's module, as sim/makings and sim/commands are) ----
  // A kind is {name, stages: [{hours (work hours), loads ({[good]: n}, taken from the owner's stores with the reason `build` as the stage
  // is done, reserved from its founding), name (what the stage is called, optional)}], may(st, tile, owner): why the kind may not stand on
  // the tile for the owner, or null; can: its capabilities (['grind'], ['smelt'] ...), capacity (what it does at once, in its own unit),
  // wear (condition lost a year once built), upkeep (hours to mend it from nothing), small (a small construction, VB-1414: built beside any
  // other project), farm (VB-1911: it stands at a farm's house and goes with the farm, owned by {type: 'farm', id}, one of the kind a
  // farm; founded by foundOn as its household's making, not by the verb `found`, and kept out of the index by tile, as several stand on
  // the house tile)}. A stage may name its job kind (`job`, its module's; raisestage by default) and the timber it waits for at its site
  // (`timber`, felled in the village's wood, as a building step's). No kind is declared here: each craft's task declares its own, and
  // sim/ladder the farm's outbuildings (OUTBUILDINGS).
  const FACILITY = {};
  function declare(kind, F) {
    atLoad();
    if (FACILITY[kind]) throw new Error('Duplicate facility: ' + kind);
    if (!F || typeof F.name !== 'string' || !Array.isArray(F.stages) || !F.stages.length)
      throw new Error(`Facility ${kind} needs a name and stages`);
    for (const s of F.stages)
      if (
        !(s.hours > 0) ||
        (s.loads && Object.values(s.loads).some((n) => !(n > 0))) ||
        (s.timber !== undefined && !(s.timber > 0))
      )
        throw new Error(`Facility ${kind}: a stage has hours, loads and timber above zero`);
    if (typeof F.may !== 'function') throw new Error(`Facility ${kind} needs may (where it may stand)`);
    FACILITY[kind] = Object.freeze({ can: [], capacity: 0, wear: 0, upkeep: 0, small: false, farm: false, ...F, kind });
  }
  // @state st.facilities[]: the built things on sites (VB-361), ids their indexes, never reused: {id, kind (of FACILITY), tile, owner
  //   ({type: 'household' | 'village', id}; {type: 'farm', id} for a farm's outbuilding, VB-1911), stage (the index of the stage being
  //   raised; its kind's stages.length once built), done (hours worked on that stage, kept while its plan is dropped), condition (0..1
  //   at condAt, worn in closed form by its kind's wear; 1 while
  //   it is being built), condAt, built (the game hour it was finished, null while it is being built)}. Absent in a save from before it
  //   (read as none). Written only here.
  const NONE = [];
  const all = (st) => st.facilities || NONE;
  // @state st.facilityIdx: the cache of st.facilities by tile and by owner, {tile: Map of a tile to its facility's id (but a farm's
  //   outbuildings'), owner: Map of 'type:id' to its facilities' ids in the order founded}; left out of a save and built again at its
  //   first read. Written only here.
  const ownerKey = (ref) => `${ref.type}:${ref.id}`;
  function idx(st) {
    if (st.facilityIdx) return st.facilityIdx;
    const I = { tile: new Map(), owner: new Map() };
    for (const fac of all(st)) index(I, fac);
    return (st.facilityIdx = I);
  }
  function index(I, fac) {
    if (fac.owner.type !== 'farm') I.tile.set(fac.tile, fac.id);
    const k = ownerKey(fac.owner);
    if (!I.owner.has(k)) I.owner.set(k, []);
    I.owner.get(k).push(fac.id);
  }
  // The facility on tile t, or null; the ids of the owner's facilities (an empty list, never written to, for none). Allocate nothing
  // once the index is built.
  const at = (st, t) => {
    const id = idx(st).tile.get(t);
    return id === undefined ? null : st.facilities[id];
  };
  const ofOwner = (st, ref) => idx(st).owner.get(ownerKey(ref)) || NONE;
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
  // The project plan's steps for fac from its open stage: each stage a step of the job kind raisestage, the open one less the hours done.
  // A stage that waits for its timber (a farm's outbuilding's walls) has it brought to the step (`wood`, sim/plans).
  const stepsFor = (F, fac) =>
    F.stages.slice(fac.stage).map((s, i) => ({
      kind: s.job || 'raisestage',
      place: fac.tile,
      hours: s.hours - (i === 0 ? fac.done : 0),
      ...(s.timber ? { wood: 0, timber: s.timber } : {}),
      ...(s.loads ? { spends: { ...s.loads } } : {}),
    }));
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
      steps: stepsFor(F, fac),
      ...(F.small ? { small: true } : {}),
    });
    if (!plan) return `the stores no longer hold the loads of the ${F.name}`;
    st.visualDirty = true;
    return fac;
  }
  // A new facility of `kind` on `tile` for owner ref, at its first stage (`built`: standing since that hour, whole).
  function make(st, kind, tile, ref, built = null) {
    st.facilities ||= [];
    const fac = { id: st.facilities.length, kind, tile, owner: { type: ref.type, id: ref.id }, stage: 0, done: 0 };
    Object.assign(fac, { condition: 1, condAt: st.t, built: null });
    if (built !== null) Object.assign(fac, { stage: FACILITY[kind].stages.length, built });
    st.facilities.push(fac);
    index(idx(st), fac);
    return fac;
  }
  // ---- a farm's outbuildings (VB-1911): kinds declared `farm`, at its house, begun as its household's making ----
  // Farm f's facility of `kind`, standing or half-built, or null; `standing`: the one that stands (how sim/byre, sim/storehouse, sim/aims,
  // sim/ladder and the page read a farm's barn, byre and storehouse). A farm's few facilities, by the index.
  function ofFarm(st, f, kind) {
    for (const id of ofOwner(st, { type: 'farm', id: f.id }))
      if (st.facilities[id].kind === kind) return st.facilities[id];
    return null;
  }
  const standing = (st, f, kind) => {
    const fac = ofFarm(st, f, kind);
    return fac && fac.built !== null ? fac : null;
  };
  // The making's plan record (sim/makings begin, also asked for what is left to build, sim/upgrade) of farm f's `kind`: its stages the
  // plan's steps, each of its stage's job kind, from the open stage of the half-built one there. Writes nothing.
  function stepsOn(st, kind, f) {
    const fac = ofFarm(st, f, kind) || { tile: f.house, stage: 0, done: 0 };
    return { steps: stepsFor(FACILITY[kind], fac) };
  }
  // The making's plan made (sim/makings made): farm f's `kind` founded at its house, or the half-built one taken up again, and the plan
  // names it.
  function foundOn(st, kind, f, plan) {
    plan.facility = (ofFarm(st, f, kind) || make(st, kind, f.house, { type: 'farm', id: f.id })).id;
  }
  // A stage of the outbuilding that plan builds is done (sim/projects stepEnds' effect, from its job kind's done): the next opens; after
  // the last it stands, whole, and its farm is drawn anew. Whether it stands now.
  function raiseOn(st, plan) {
    const fac = plan.facility === undefined ? null : st.facilities[plan.facility];
    if (!fac || fac.built !== null) return false;
    fac.stage++;
    fac.done = 0;
    if (fac.stage < FACILITY[fac.kind].stages.length) return false;
    Object.assign(fac, { built: st.t, condition: 1, condAt: st.t });
    const f = st.farmsteads[fac.owner.id];
    st.biomeDirty.add(f.house);
    st.farmDirty.add(f.id);
    return true;
  }
  // Farm f's `kind` standing since hour `built` (the farms at seeding, sim/scenarios; an older save's, outbuildingsLoaded).
  const seedOn = (st, f, kind, built = st.t) =>
    ofFarm(st, f, kind) || make(st, kind, f.house, { type: 'farm', id: f.id }, built);
  // Farm f's `kind` gone (a camp landed by hand, sim/scenarios landAlone: nothing stands on it): the record taken out, the ids after it
  // moved down, the index built again. Rare: at the landing, before any plan names a facility.
  function raze(st, f, kind) {
    const fac = ofFarm(st, f, kind);
    if (!fac) return;
    st.facilities.splice(fac.id, 1);
    st.facilities.forEach((x, i) => (x.id = i));
    st.facilityIdx = null;
  }
  // A save from before VB-1911: each farm's farmstead.barn, .byre and .storehouse ({built}, or `true` in a save older than that record)
  // as a standing facility, whole; a plan of one under way (its steps all its kind's stages) as a half-built one at its open stage; the
  // fields taken out. A farm of such a save has the field `byre` (every save this build reads: VB-1665 came before its format) and a
  // farm of a later one none of them. `had(f, kind)`: whether the older save's farm with no field of the kind had it standing.
  function outbuildingsLoaded(st, had = () => false) {
    st.facilities ||= [];
    for (const f of st.farmsteads)
      for (const kind in FACILITY) {
        if (!('byre' in f || 'barn' in f || 'storehouse' in f)) break;
        if (!FACILITY[kind].farm) continue;
        const x = kind === 'barn' ? f.barn : kind === 'byre' ? f.byre : f.storehouse;
        if (x === undefined ? had(f, kind) : x) seedOn(st, f, kind, x && typeof x === 'object' ? x.built : st.t);
      }
    for (const f of st.farmsteads) {
      delete f.barn;
      delete f.byre;
      delete f.storehouse;
    }
    for (const hh of st.households) {
      const f = hh.farmstead === null || hh.dissolved ? null : st.farmsteads[hh.farmstead];
      for (const p of f ? Projects.projectsOf(st, 'household', hh.id) : NONE) {
        const F = Object.hasOwn(FACILITY, p.what) && FACILITY[p.what].farm ? FACILITY[p.what] : null;
        if (!F || p.facility !== undefined || ofFarm(st, f, p.what)) continue;
        const fac = make(st, p.what, f.house, { type: 'farm', id: f.id });
        fac.stage = Math.min(p.open, F.stages.length - 1);
        p.facility = fac.id;
      }
    }
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
    effect(st, st.facilities[plan.facility]);
    emit(st, 'stepDone', { type: plan.holder.type, id: plan.holder.id, plan });
  }
  // A stage raised: the next opens; after the last the facility stands, whole.
  function raised(st, fac) {
    const F = FACILITY[fac.kind];
    fac.stage++;
    fac.done = 0;
    st.visualDirty = true;
    if (fac.stage < F.stages.length) return;
    Object.assign(fac, { built: st.t, condition: 1, condAt: st.t });
    const o = owner(st, fac.owner),
      house = fac.owner.type === 'household',
      f = house && o.farmstead !== null ? st.farmsteads[o.farmstead] : null;
    const where = house
      ? { household: o.id, ...(f ? { farm: f.id, village: f.village } : {}) }
      : { village: fac.owner.id };
    log(st, `${f ? f.name : o.name} has built a ${F.name}.`, { kind: 'facilityBuilt', facility: fac.id, ...where });
  }
  function mended(st, fac) {
    fac.condition = 1;
    fac.condAt = st.t;
    st.visualDirty = true;
  }
  // The hours worked on the open stage, kept on the facility as the task is reckoned (sim/work): the stage's hours less the step's,
  // where it was taken up again half-built, and the job's hours done.
  function worked(st, j) {
    const plan = planOf(st, j);
    if (!plan) return;
    const fac = st.facilities[plan.facility],
      s = FACILITY[fac.kind].stages[fac.stage];
    if (s) fac.done = Math.min(s.hours, s.hours - j.hours + j.done);
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
    FACILITY,
    KINDS,
    declare,
    at,
    ofOwner,
    conditionOf,
    foundWhy,
    found,
    upkeepWhy,
    villageUpkeep,
    villageWork,
    view,
    ofFarm,
    standing,
    stepsOn,
    foundOn,
    raiseOn,
    seedOn,
    raze,
    outbuildingsLoaded,
    PAGE: ['standing'],
  };
})();
