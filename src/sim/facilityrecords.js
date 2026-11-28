// @sys sim/facilityrecords [material]: the records of the built things on sites (VB-361, VB-1911): the registry FACILITY of the kinds
//   (declare), st.facilities and its index by tile and by owner (at, ofOwner), a new record (make) and the writes to a record's stage and
//   condition (raiseOn, mend, workedOn); a farm's outbuildings (the barn, the byre and the storehouse, kinds declared `farm`), read by
//   standing, begun as their household's making (stepsOn, foundOn), seeded (seedOn), razed at a camp's landing and read from an older
//   save (outbuildingsLoaded). Loaded early, before the modules that read a farm's outbuildings (sim/storehouse, sim/byre ...); the verbs
//   `found` and `upkeep`, the job kinds and the view are sim/facilities'.
// Cost (docs/cost.md, rule 9): facilities are few; they are read by tile and by owner through the index, never all walked but at a load.
VB['sim/facilityrecords'] = (() => {
  const { atLoad } = VB['sim/registry'];
  const Projects = VB['sim/projects'];
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
  // ---- a record's work: a stage raised, the hours worked on it, a facility mended ----
  // A stage of the facility that plan builds is done (sim/facilities' job kind raisestage; a farm's outbuilding's stage job, through
  // sim/projects stepEnds' effect): the next opens; after the last it stands, whole, and a farm's is drawn anew. Whether it stands now.
  function raiseOn(st, plan) {
    const fac = plan.facility === undefined ? null : st.facilities[plan.facility];
    if (!fac || fac.built !== null) return false;
    fac.stage++;
    fac.done = 0;
    const farm = fac.owner.type === 'farm';
    if (!farm) st.visualDirty = true;
    if (fac.stage < FACILITY[fac.kind].stages.length) return false;
    Object.assign(fac, { built: st.t, condition: 1, condAt: st.t });
    if (farm) {
      const f = st.farmsteads[fac.owner.id];
      st.biomeDirty.add(f.house);
      st.farmDirty.add(f.id);
    }
    return true;
  }
  // The hours done on fac's open stage (sim/facilities worked).
  function workedOn(fac, done) {
    fac.done = done;
  }
  // fac mended whole (sim/facilities' job kind mendfacility).
  function mend(st, fac) {
    fac.condition = 1;
    fac.condAt = st.t;
    st.visualDirty = true;
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
  // The steps of a plan building `kind` from the open stage of fac: by default farm f's (sim/makings begin, also asked for what is left to
  // build, sim/upgrade), the half-built one there or a new one at its house; sim/facilities found's own. Writes nothing.
  function stepsOn(st, kind, f, fac = ofFarm(st, f, kind) || { tile: f.house, stage: 0, done: 0 }) {
    return { steps: stepsFor(FACILITY[kind], fac) };
  }
  // The making's plan made (sim/makings made): farm f's `kind` founded at its house, or the half-built one taken up again, and the plan
  // names it.
  function foundOn(st, kind, f, plan) {
    plan.facility = (ofFarm(st, f, kind) || make(st, kind, f.house, { type: 'farm', id: f.id })).id;
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
  return {
    FACILITY,
    declare,
    at,
    ofOwner,
    make,
    raiseOn,
    workedOn,
    mend,
    standing,
    stepsOn,
    foundOn,
    seedOn,
    raze,
    outbuildingsLoaded,
    PAGE: ['standing'],
  };
})();
