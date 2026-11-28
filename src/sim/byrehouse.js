// @sys sim/byrehouse [material]: the byre as a building (VB-1665): the making `byre` (a project of the household at its house, its stages the
//   job kinds byrewalls and byreroof, the walls waiting for their timber), its check byreWhy, the byres the run begins with and an older
//   save's; the byre itself is a facility of its farm (VB-1911: its row in sim/ladder OUTBUILDINGS, its record sim/facilityrecords'); the stall
//   winter it shelters is sim/byre's (a farm without one winters its animals in the open: HERD.openLean)
VB['sim/byrehouse'] = (() => {
  const { BUILD } = VB['sim/rules'];
  const Projects = VB['sim/projects'];
  const { declare } = VB['sim/makings'];
  // The farm's byre (VB-1665, VB-1911): the facility `byre` of its farm (sim/facilities, loaded after this module), where its animals
  // stand through the stall winter (HERD.byre places, sim/byre). Every farm that stands at seeding has one (seedByres), but a camp landed
  // by hand (noByre); a farm made in play (a settler's, sim/settle; an heir's cottage, sim/cottage) has none until its household builds it.
  const Fac = VB['sim/facilityrecords'];
  // Why household hh may not begin a byre now, or null: a farm of its own with none, its cottage built, a village wood to fell its timber
  // in, none under way; beside any other project (VB-1668; the byre is a large project, as the barn is).
  function byreWhy(st, hh) {
    const f = hh.farmstead === null ? null : st.farmsteads[hh.farmstead];
    if (!f || f.household !== hh.id) return `the household has no farm of its own`;
    if (Fac.standing(st, f, 'byre')) return `${f.name} has a byre`;
    if (f.rung === 'shelter') return `${f.name} has no cottage yet`;
    if (!st.villages[f.village].wood.length) return `${st.villages[f.village].name} has no wood to fell its timber in`;
    return Projects.underWay(st, hh.id, 'byre') ? `the household has a byre under way` : null;
  }
  declare('byre', {
    why: (st, hh) => byreWhy(st, hh),
    begin: (st, hh, f) => Fac.stepsOn(st, 'byre', f),
    made: (st, hh, f, plan) => Fac.foundOn(st, 'byre', f, plan),
  });
  // A stage done: the next opens (sim/plans), the byre raised by it (sim/facilityrecords raiseOn); with the roof on, the farm has its byre. The
  // holder is the farm's household (j.owner).
  const done = (st, j) =>
    Projects.stepEnds(
      st,
      j,
      j.owner && j.owner.type === 'household' ? st.households[j.owner.id] : null,
      (st, j, hh, plan) => Fac.raiseOn(st, plan),
    );
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
    for (const f of st.farmsteads) Fac.seedOn(st, f, 'byre');
  }
  // A camp landed by hand (sim/scenarios landAlone): nothing stands on it, a byre neither.
  const noByre = (st, f) => Fac.raze(st, f, 'byre');
  return { KINDS, byreWhy, seedByres, noByre };
})();
