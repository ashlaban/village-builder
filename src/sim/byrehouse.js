// @sys sim/byrehouse: the byre as a building (VB-1665): farmstead.byre, the making `byre` (a project of the household at its house, its
//   stages the job kinds byrewalls and byreroof, the walls waiting for their timber), its check byreWhy, the byres the run begins with and
//   an older save's; the stall winter it shelters is sim/byre's (a farm without one winters its animals in the open: HERD.openLean)
VB['sim/byrehouse'] = (() => {
  const { BUILD } = VB['sim/rules'];
  const Projects = VB['sim/projects'];
  const { declare } = VB['sim/makings'];
  // @state farmstead.byre (VB-1665): {built (game hours)} once the farm has a byre, where its animals stand through the stall winter
  //   (HERD.byre places, sim/byre); absent or null while it has none. Every farm that stands at seeding has one (seedByres), but a camp
  //   landed by hand (noByre); a farm made in play (a settler's, sim/settle; an heir's cottage, sim/cottage) has none until its household
  //   builds it. One a farm; it goes with the farm. Written only here.
  const STAGES = ['byrewalls', 'byreroof'];
  // The steps of a byre's project plan at house tile `house`: the walls with the timber they wait for, then the roof.
  const byreSteps = (house) =>
    STAGES.map((kind, i) => ({
      kind,
      place: house,
      hours: BUILD.byre.hours[i],
      ...(kind === 'byrewalls' ? { wood: 0, timber: BUILD.byre.timber } : {}),
    }));
  // Why household hh may not begin a byre now, or null: a farm of its own with none, its cottage built, a village wood to fell its timber
  // in, none under way; beside any other project (VB-1668; the byre is a large project, as the barn is).
  function byreWhy(st, hh) {
    const f = hh.farmstead === null ? null : st.farmsteads[hh.farmstead];
    if (!f || f.household !== hh.id) return `the household has no farm of its own`;
    if (f.byre) return `${f.name} has a byre`;
    if (f.rung === 'shelter') return `${f.name} has no cottage yet`;
    if (!st.villages[f.village].wood.length) return `${st.villages[f.village].name} has no wood to fell its timber in`;
    return Projects.underWay(st, hh.id, 'byre') ? `the household has a byre under way` : null;
  }
  declare('byre', {
    why: (st, hh) => byreWhy(st, hh),
    begin: (st, hh, f) => ({ steps: byreSteps(f.house) }),
  });
  // A stage done: the next opens (sim/plans); with the roof on, the farm has its byre. The holder is the farm's household (j.owner).
  function built(st, j) {
    if (j.kind !== 'byreroof') return;
    const f = j.farm;
    f.byre = { built: st.t };
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
    go: 'Going to build the byre',
    name,
    label: 'Byre',
    anim,
    hours: BUILD.byre.hours[i],
    hands: Infinity,
    type: 'wood',
    project: true,
    spot: (st, a, j) => [st.w.hx[j.site] - 16 + a.ox * 0.4, st.w.hy[j.site] + 4 + a.oy * 0.3],
    done,
  });
  const KINDS = {
    byrewalls: kind("Raising the byre's walls", 'Raise the byre', 'chop', 0, []),
    byreroof: kind('Roofing the byre', 'Roof the byre', 'mallet', 1, ['byre']),
  };
  // ---- the byres the run begins with ----
  // At seeding (sim/scenarios makeState): every farm has its byre, as the stall winter assumed before VB-1665.
  function seedByres(st) {
    for (const f of st.farmsteads) f.byre = { built: st.t };
  }
  // A camp landed by hand (sim/scenarios landAlone): nothing stands on it, a byre neither.
  const noByre = (st, f) => {
    f.byre = null;
  };
  // A save from before VB-1665: every farm reads as having its byre, as the stall winter assumed then.
  function byresLoaded(st) {
    for (const f of st.farmsteads) if (f.byre === undefined) f.byre = { built: st.t };
  }
  return { KINDS, byreSteps, byreWhy, seedByres, noByre, byresLoaded };
})();
