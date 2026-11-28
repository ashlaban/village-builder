// @sys sim/storehouse: the storehouse on posts (*härbre*) as a building (VB-1898; design.md, Settlements and look, Farmstead, 27 Nov):
//   farmstead.storehouse, the making `storehouse` (a project of the household at its house, its stages the job kinds storewalls and
//   storeroof, the walls waiting for their timber), its check storehouseWhy, the storehouses the run begins with and an older save's; the
//   grain it keeps (a farm with one loses BUILD.storehouse.loss as much grain to spoilage: storeLoss; the day's loss, grainLoss, one
//   reckoning for sim/hunger's spoilGrain and sim/aims' weighing of a storehouse)
VB['sim/storehouse'] = (() => {
  const { BUILD } = VB['sim/rules'];
  const Projects = VB['sim/projects'];
  const { declare } = VB['sim/makings'];
  const { dayLoss, GRAIN } = VB['sim/goods'];
  const { grainOf } = VB['sim/stores'];
  // @state farmstead.storehouse (VB-1898): {built (game hours)} once the farm has a storehouse, where its threshed grain and food keep
  //   (sim/hunger storeLoss); absent or null while it has none. Every farm that stands at seeding has one (seedStorehouses), but a camp
  //   landed by hand (noStorehouse); a farm made in play (a settler's, an heir's) has none until its household builds it. One a farm; it
  //   goes with the farm. Written only here.
  const STAGES = ['storewalls', 'storeroof'];
  // The steps of a storehouse's project plan at house tile `house`: the walls with the timber they wait for, then the roof.
  const storehouseSteps = (house) =>
    STAGES.map((kind, i) => ({
      kind,
      place: house,
      hours: BUILD.storehouse.hours[i],
      ...(kind === 'storewalls' ? { wood: 0, timber: BUILD.storehouse.timber } : {}),
    }));
  // Why household hh may not begin a storehouse now, or null: a farm of its own with none, its cottage built, a village wood to fell its
  // timber in, none under way; beside any other project (VB-1668), as the byre.
  function storehouseWhy(st, hh) {
    const f = hh.farmstead === null ? null : st.farmsteads[hh.farmstead];
    if (!f || f.household !== hh.id) return `the household has no farm of its own`;
    if (f.storehouse) return `${f.name} has a storehouse`;
    if (f.booth) return `${f.name} has no cottage yet`;
    if (!st.villages[f.village].wood.length) return `${st.villages[f.village].name} has no wood to fell its timber in`;
    return Projects.underWay(st, hh.id, 'storehouse') ? `the household has a storehouse under way` : null;
  }
  declare('storehouse', {
    why: (st, hh) => storehouseWhy(st, hh),
    begin: (st, hh, f) => ({ steps: storehouseSteps(f.house) }),
  });
  // A stage done: the next opens (sim/plans); with the roof on, the farm has its storehouse. The holder is the farm's household (j.owner).
  function built(st, j) {
    if (j.kind !== 'storeroof') return;
    const f = j.farm;
    f.storehouse = { built: st.t };
    st.biomeDirty.add(f.house);
    st.farmDirty.add(f.id);
  }
  const done = (st, j) =>
    Projects.stepEnds(st, j, j.owner && j.owner.type === 'household' ? st.households[j.owner.id] : null, built);
  const kind = (verb, name, anim, i, gives) => ({
    at: ['farm'],
    needs: i === 0 ? ['timber'] : [],
    gives,
    verb,
    go: 'Going to build the storehouse',
    name,
    label: 'Storehouse',
    anim,
    hours: BUILD.storehouse.hours[i],
    hands: Infinity,
    type: 'wood',
    project: true,
    spot: (st, a, j) => [st.w.hx[j.site] + 14 + a.ox * 0.4, st.w.hy[j.site] + 7 + a.oy * 0.3],
    done,
  });
  const KINDS = {
    storewalls: kind("Raising the storehouse's walls", 'Raise the storehouse', 'chop', 0, []),
    storeroof: kind('Roofing the storehouse', 'Roof the storehouse', 'mallet', 1, ['storehouse']),
  };
  // ---- the grain it keeps ----
  // The grain household hh's store would lose today with no storehouse: by grain's keeping (sim/goods), its tiers `yearNeed` (a year of
  // the household's need) held each.
  function grainLoss(st, hh, yearNeed) {
    const g = grainOf(hh);
    return g > 0 ? dayLoss(st, GRAIN, g, yearNeed) : 0;
  }
  // What household hh's farm loses of its grain, as a share of a farm without a storehouse: BUILD.storehouse.loss with one.
  function storeLoss(st, hh) {
    const f = hh.farmstead === null ? null : st.farmsteads[hh.farmstead];
    return f && f.storehouse ? BUILD.storehouse.loss : 1;
  }
  // ---- the storehouses the run begins with ----
  // At seeding (sim/scenarios makeState): every farm has its storehouse, as every farm kept its grain before VB-1898.
  function seedStorehouses(st) {
    for (const f of st.farmsteads) f.storehouse = { built: st.t };
  }
  // A camp landed by hand (sim/scenarios landAlone): nothing stands on it, a storehouse neither.
  const noStorehouse = (st, f) => {
    f.storehouse = null;
  };
  // A save from before VB-1898: every farm reads as having its storehouse, as the grain's keeping assumed then; but a farm landed by hand
  // (f.camp defined, sim/camp) none, as none was drawn on it: only what it built stands.
  function storehousesLoaded(st) {
    for (const f of st.farmsteads)
      if (f.storehouse === undefined) f.storehouse = f.camp === undefined ? { built: st.t } : null;
  }
  return {
    KINDS,
    storehouseSteps,
    storehouseWhy,
    grainLoss,
    storeLoss,
    seedStorehouses,
    noStorehouse,
    storehousesLoaded,
  };
})();
