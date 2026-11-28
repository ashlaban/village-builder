// @sys sim/cottageplan [material]: the cottage as stages of a plan (foundation, walls, roof), a plot's after its clearing (sim/expansion; a
// farm's own cottage is its site's, sim/sites, VB-1937): the stages' steps, the walls' timber (VB-328), and a stage finished
VB['sim/cottageplan'] = (() => {
  const { issue } = VB['sim/commands'];
  const { BUILD } = VB['sim/rules'];
  const Projects = VB['sim/projects'],
    { emit } = VB['sim/events'];
  const COTTAGE = ['foundation', 'walls', 'roof'],
    COTTAGE_HOURS = { foundation: 30, walls: 60, roof: 30 }; // stages in order; hours as in KINDS
  // The village a plot lies in (sim/expansion: `village` on every plot made since VB-255; a village's plot without it, its holder's).
  const villageOf = (p) => (p.village !== undefined ? p.village : p.holder.id);
  // A plan's walls step, by its kind (a plot's clearing, then COTTAGE's stages, each a step of that kind):
  const wallsOf = (p) => Projects.stepOf(p, 'walls'); // where the plan's wood lies (VB-328), and the cottage's site (its place)
  // The loads of timber a cottage's site needs at its stage i (as COTTAGE's index): its walls' BUILD.timber until they stand, then none.
  const timberNeed = (i) => (i <= COTTAGE.indexOf('walls') ? BUILD.timber : 0);
  // A site's walls wait until BUILD.timber loads of wood lie there (VB-328; site: a plot's walls step, or a site's, sim/sites).
  const waitsForTimber = (site, i) => COTTAGE[i] === 'walls' && Projects.lacks(site, timberNeed(i)) > 0;
  // A cottage's stages at `house` as steps of a plan (a plot's after its clearing; a site's, sim/sites): each its hours
  // and its `done`, the walls the `wood` brought to the site (VB-328).
  const cottageSteps = (house) =>
    COTTAGE.map((kind) => ({
      kind,
      place: house,
      hours: COTTAGE_HOURS[kind],
      done: 0,
      ...(kind === 'walls' ? { wood: 0 } : {}),
    }));
  // A cottage stage of plot `plan` is done: the walls take their timber; the last stage hands the plot to sim/cottage, which makes the
  // farmstead and household.
  function finishCottageStage(st, plan) {
    const k = plan.steps[plan.open];
    if (k.kind === 'walls') k.wood -= BUILD.timber; // the walls took their timber (VB-328)
    st.biomeDirty.add(k.place);
    // a plot's stages are drawn with its village (page/settlement, VB-442)
    st.villageDirty.add(villageOf(plan));
    if (plan.open < plan.steps.length - 1) {
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
  // ---- a farm's own cottage under way, its site (sim/sites farmSite, VB-1937), read where sim/sites is above the reader ----
  // The site of farm fid's own cottage, or null: st.sites, a few under way.
  const homeSite = (st, fid) => (st.sites && st.sites.length ? st.sites.find((s) => s.farm === fid) || null : null);
  // A site's walls stage, where its wood lies (VB-328).
  const siteWalls = (s) => s.plot.steps[COTTAGE.indexOf('walls')];
  // The timber farm f's own site still lacks for its walls, as a plot's timber site (sim/building fetchTimber; from the start, as the
  // cottage plan's was), or null.
  function farmTimber(st, f) {
    const s = homeSite(st, f.id);
    if (!s || f.household === null) return null;
    const owner = { type: 'household', id: f.household };
    return { key: `timber:s${s.id}`, site: siteWalls(s), need: timberNeed(s.plot.open), dest: f.house, owner };
  }
  return {
    homeSite,
    siteWalls,
    farmTimber,
    COTTAGE,
    COTTAGE_HOURS,
    villageOf,
    wallsOf,
    timberNeed,
    waitsForTimber,
    cottageSteps,
    finishCottageStage,
  };
})();
