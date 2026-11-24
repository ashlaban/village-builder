// @sys sim/cottageplan: the cottage as stages of a plan (foundation, walls, roof), a plot's after its clearing (sim/expansion) and a settler
// household's own while it lives in a booth (cottagePlan, VB-1411): the stages' steps, the walls' timber (VB-328), the booth household's
// open stage as a job, a stage finished, and the roof on
VB['sim/cottageplan'] = (() => {
  const { issue } = VB['sim/commands'];
  const { keptDone } = VB['sim/progress'];
  const { BUILD } = VB['sim/rules'];
  const Stores = VB['sim/stores'],
    Projects = VB['sim/projects'],
    { emit } = VB['sim/events'];
  const { log, fullName, atFarm } = VB['sim/records'];
  const { fellSteps } = VB['sim/fieldplans'];
  const COTTAGE = ['foundation', 'walls', 'roof'],
    COTTAGE_HOURS = { foundation: 30, walls: 60, roof: 30 }; // stages in order; hours as in KINDS
  // The village a plot lies in (sim/expansion: `village` on every plot made since VB-255; a village's plot without it, its holder's).
  const villageOf = (p) => (p.village !== undefined ? p.village : p.holder.id);
  // A plan's walls step, by its kind (a plot's clearing, then COTTAGE's stages, each a step of that kind):
  const wallsOf = (p) => Projects.stepOf(p, 'walls'); // where the plan's wood lies (VB-328), and the cottage's site (its place)
  // The loads of timber a cottage's site needs at its stage i (as COTTAGE's index): its walls' BUILD.timber until they stand, then none.
  const timberNeed = (i) => (i <= COTTAGE.indexOf('walls') ? BUILD.timber : 0);
  // A site's walls wait until BUILD.timber loads of wood lie there (VB-328; site: a plot's walls step, or a booth's cottage).
  const waitsForTimber = (site, i) => COTTAGE[i] === 'walls' && Projects.lacks(site, timberNeed(i)) > 0;
  // The cottage plan of household id (settlers living in a booth, sim/settle: its project plan 'cottage'), or null.
  const cottageOf = (st, id) => {
    for (const p of Projects.projectsOf(st, 'household', id)) if (p.what === 'cottage') return p;
    return null;
  };
  // The cottage of farm f's household while it lives in a booth, as a plot's timber site (sim/expansion plotTimber: from the foundation on,
  // its wood on its walls step), or null. Not Projects.timberOf's: that brings a step's timber only while the step is open, a barn's walls,
  // a cart, a boat.
  function cottageTimber(st, f) {
    const p = f.household !== null ? cottageOf(st, f.household) : null;
    return p
      ? {
          key: `timber:f${f.id}`,
          site: wallsOf(p),
          need: timberNeed(stageOf(p)),
          dest: f.house,
          owner: { type: 'household', id: f.household },
        }
      : null;
  }
  // The plan of the cottage of a household settling on farm f (sim/settle makes it, beside its first field's): the plot's stages at f's house;
  // `farmstead` names the farm it is kept with when its household is dissolved (sim/plans' dropAll).
  // A house on a wooded tile (a forest site, VB-786) is felled and grubbed before its foundation.
  const cottagePlan = (st, f) => ({
    what: 'cottage',
    farmstead: f.id,
    steps: [...fellSteps(st, f.house).map((s) => ({ ...s, done: 0 })), ...cottageSteps(f.house)], // done: as a stage's
  });
  // The cottage's stage the plan's open step is (as COTTAGE's index), or -1 while its house tile is felled and grubbed.
  const stageOf = (p) => COTTAGE.indexOf(p.steps[p.open].kind);
  // A cottage's stages at `house` as steps of a plan (a plot's after its clearing; a settler household's own, cottagePlan): each its hours
  // and its `done`, the walls the `wood` brought to the site (VB-328).
  const cottageSteps = (house) =>
    COTTAGE.map((kind) => ({
      kind,
      place: house,
      hours: COTTAGE_HOURS[kind],
      done: 0,
      ...(kind === 'walls' ? { wood: 0 } : {}),
    }));
  // A cottage stage of `plan` is done (a plot's, or a settler household's own while it lives in a booth): the walls take their timber; the
  // last stage hands a plot to sim/cottage, which makes the farmstead and household, and takes a household out of its booth (roofOn).
  function finishCottageStage(st, plan) {
    const k = plan.steps[plan.open];
    if (k.kind === 'walls') k.wood -= BUILD.timber; // the walls took their timber (VB-328)
    st.biomeDirty.add(k.place);
    // a plot's stages are drawn with its village, a farm's own cottage with its farm (page/settlement, VB-442)
    if (plan.what === 'cottage') st.farmDirty.add(plan.farmstead);
    else st.villageDirty.add(villageOf(plan));
    if (plan.open < plan.steps.length - 1 || plan.what === 'cottage') {
      if (plan.open === plan.steps.length - 1) roofOn(st, plan);
      emit(st, 'stepDone', { type: plan.holder.type, id: plan.holder.id, plan }); // the next stage, or the plan finished (sim/plans)
      return;
    }
    k.done = k.hours; // the roof is on: the household moves in, and the plan is finished (sim/cottage)
    issue(st, {
      actor: null,
      verb: 'finishCottage',
      target: plan.plot,
      args: { village: villageOf(plan) },
      source: 'construction',
    });
  }
  // ---- the cottage of a household living in a booth (settlers, sim/settle): its project plan 'cottage', the plot's stages ----
  // The open stage of household hh's cottage, on farm f: [key, kind, extra], or null. Hours on the stage persist while its job is dropped.
  function cottageJob(st, hh, f) {
    const p = cottageOf(st, hh.id);
    if (!p) return null;
    const k = p.steps[p.open],
      key = `booth:f${f.id}`;
    k.done = keptDone(st, key, k.hours, k.done);
    if (waitsForTimber(wallsOf(p), stageOf(p))) return null;
    return [key, k.kind, { farm: f, booth: true, done: k.done, hours: k.hours }];
  }
  // A booth household's stage job j is done (sim/building's stage kinds): its plan's stage, while it is still its stage.
  function finishBoothStage(st, j) {
    const plan = Projects.onProject(st, j);
    if (plan) finishCottageStage(st, plan);
  }
  // The roof on a household's cottage (its plan's last stage done): the household leaves its shelter, taken down (VB-1666: the cottage
  // stands on its tile in its place; in a save before it, the booth beside the house is left to rot), and timber left over goes to its
  // woodpile.
  function roofOn(st, plan) {
    const hh = st.households[plan.holder.id],
      f = st.farmsteads[hh.farmstead],
      wood = wallsOf(plan).wood;
    if (wood > 0) Stores.put(st, hh, 'wood', wood, 'timber'); // timber left over goes to the woodpile
    f.booth = null;
    f.shelter = null; // lint-allow: owner the shelter taken down when the cottage on its tile has its roof (VB-1666)
    log(
      st,
      `The new cottage at ${f.name} in ${st.villages[f.village].name} has its roof; ${fullName(st.pawns[hh.holder])} leaves the shelter.`,
      {
        kind: 'cottage',
        pawn: hh.holder,
        ...atFarm(f),
      },
    );
  }
  return {
    COTTAGE,
    COTTAGE_HOURS,
    villageOf,
    wallsOf,
    timberNeed,
    waitsForTimber,
    cottageSteps,
    cottagePlan,
    cottageOf,
    cottageJob,
    cottageTimber,
    finishCottageStage,
    finishBoothStage,
  };
})();
