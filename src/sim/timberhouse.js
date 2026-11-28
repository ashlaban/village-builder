// @sys sim/timberhouse [material]: the timber house (VB-1664), the rung of the main building above the cottage: farmstead.rung, the rung stored
//   where it cannot be derived; the making `timberhouse` (a project of the household at its house, its stages the job kinds timberframe
//   and timberroof, the frame waiting for its timber; the household lives in its cottage meanwhile) and its check timberWhy. Its room
//   and its smaller fire are sim/house's (ROOM); the plan's task and the head's own rule that begin it, sim/upgrade's
VB['sim/timberhouse'] = (() => {
  const { BUILD } = VB['sim/rules'];
  const Projects = VB['sim/projects'];
  const { declare } = VB['sim/makings'];
  const { log, fullName, atFarm } = VB['sim/records'];
  // @state farmstead.rung (VB-1664): the rung the farm's main building stands at where it cannot be derived from the farm's state
  //   (sim/ladder rungOf derives a camp, a shelter and a cottage): 'shelter' while the farm has no cottage yet (its own site's,
  //   sim/sites, VB-1937; null again at the roof), absent or null for a cottage, 'timber' once the timber house is finished. A save from
  //   before reads as the rung derived. It goes with the farm and its house; written here, by sim/sites and by the scenarios.
  // @notstock farmstead.rung: land, buildings and their records (fields, meadows, a site's timber)
  const STAGES = ['timberframe', 'timberroof'];
  // The steps of a timber house's project plan at house tile `house`: the frame with the timber it waits for, then the roof.
  const timberSteps = (house) =>
    STAGES.map((kind, i) => ({
      kind,
      place: house,
      hours: BUILD.timberHouse.hours[i],
      ...(kind === 'timberframe' ? { wood: 0, timber: BUILD.timberHouse.timber } : {}),
    }));
  // Why household hh may not begin its timber house now, or null: a farm of its own standing at a cottage (finished, not a shelter; no
  // timber house yet) and a village wood to fell its timber in. No refusal for another project under way (the limit of one large project
  // at a time is being taken out of every check).
  function timberWhy(st, hh) {
    const f = hh.farmstead === null ? null : st.farmsteads[hh.farmstead];
    if (!f || f.household !== hh.id) return `the household has no farm of its own`;
    if (f.rung === 'shelter') return `${f.name} has no cottage yet`;
    if (f.rung === 'timber') return `${f.name} has a farmhouse`;
    if (!st.villages[f.village].wood.length) return `${st.villages[f.village].name} has no wood to fell its timber in`;
    return null;
  }
  declare('timberhouse', {
    why: (st, hh) => timberWhy(st, hh),
    begin: (st, hh, f) => ({ steps: timberSteps(f.house) }),
  });
  // A stage done: the next opens (sim/plans); with its last stage done, the house is finished: the farm's main building is a timber
  // house. The holder is the farm's household (j.owner).
  function built(st, j) {
    if (j.kind !== 'timberroof') return;
    const f = j.farm,
      hh = st.households[f.household];
    f.rung = 'timber';
    st.biomeDirty.add(f.house);
    st.farmDirty.add(f.id);
    log(st, `The farmhouse at ${f.name} is finished; ${fullName(st.pawns[hh.holder])} and the household move in.`, {
      kind: 'cottage',
      pawn: hh.holder,
      ...atFarm(f),
    });
  }
  const done = (st, j) =>
    Projects.stepEnds(st, j, j.owner && j.owner.type === 'household' ? st.households[j.owner.id] : null, built);
  const kind = (verb, name, anim, i, gives) => ({
    at: ['farm'],
    needs: i === 0 ? ['timber'] : [],
    gives,
    verb,
    go: 'Going to build the farmhouse',
    name,
    label: 'Farmhouse',
    anim,
    hours: BUILD.timberHouse.hours[i],
    hands: Infinity,
    type: 'wood',
    project: true,
    spot: (st, a, j) => [st.w.hx[j.site] + 12 + a.ox * 0.4, st.w.hy[j.site] + 2 + a.oy * 0.3],
    done,
  });
  const KINDS = {
    timberframe: kind("Raising the farmhouse's frame", 'Raise the frame', 'chop', 0, []),
    timberroof: kind('Roofing the farmhouse', 'Roof the farmhouse', 'mallet', 1, ['house']),
  };
  return { KINDS, STAGES, timberSteps, timberWhy };
})();
