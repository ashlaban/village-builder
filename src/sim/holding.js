// @sys sim/holding: who may come to hold a farm, and who goes with a new holder (VB-688): one table of the bars, named in a fixed order, and
// each way to a farm (a claim, a plot, settling, the ask for land, wanting out) as the list of the bars it reads; the bars whose state another
// module owns (a claim under way, a plot coming) are contributed by it at load
VB['sim/holding'] = (() => {
  const { spouseOf, childrenOf, isHolder } = VB['sim/records'];
  // A pawn with a farm already: a holder, or married to one (who lives on the spouse's farm; VB-153).
  const landed = (st, id) => {
    const sp = spouseOf(st, id);
    return isHolder(st, id) || (sp !== null && isHolder(st, sp));
  };
  // A pawn who is a household's guardian keeps its ward, and leaves it for no farm.
  const keepsWard = (st, id) => st.liveHouseholds.some((hid) => st.households[hid].guardian === id);
  // The bars to holding a farm, in the order a pawn is told why: [name, why, check (st, id) true when it bars]. `claim` (sim/farmclaims)
  // and `plot` (sim/expansion) are contributed by their owners.
  const BARS = [
    ['grown', 'under 18', (st, id) => !st.pawns[id].alive || st.pawns[id].age < 18],
    ['home', 'has no home', (st, id) => st.pawns[id].household === null],
    ['landed', 'holds a farm, or is married to its holder', landed],
    ['claim', 'restoring a farm it claimed', null],
    ['plot', 'has a plot coming', null],
    ['ward', 'keeps a ward', keepsWard],
  ];
  // The ways to a farm, each the bars it reads (the pathway's difference, by name). What else differs, and why, is the table of VB-688:
  //   claim   a derelict farm claimed and mended (sim/farmclaims): every bar
  //   plot    a cleared plot allotted by the village (sim/allotment): its own villagers, so neither home nor ward is asked of them
  //   waits   waiting for land in a crowded village (sim/settle's count of the crowded)
  //   settle  leaving it for new land (sim/settle): its age band is SETTLE.ages, read beside these
  //   ask     the asking day's ask for land (sim/asking): landed only, the claim's own check follows at the claim
  const WAYS = {
    claim: ['grown', 'home', 'landed', 'claim', 'plot', 'ward'],
    plot: ['landed', 'plot'],
    waits: ['grown', 'home', 'plot'],
    settle: ['grown', 'home', 'plot', 'ward'],
    ask: ['landed'],
  };
  // sim/farmclaims and sim/expansion give the check of their bar, at load.
  function contribute(name, check) {
    const bar = BARS.find((b) => b[0] === name);
    if (!bar || bar[2] !== null) throw new Error(`sim/holding: no open bar ${name}`);
    bar[2] = check;
  }
  // Why pawn id may not hold a farm by way `way` (a key of WAYS), or null.
  function barredWhy(st, id, way) {
    const names = WAYS[way];
    for (const [name, why, check] of BARS) if (names.includes(name) && check(st, id)) return why;
    return null;
  }
  const mayHoldFarm = (st, id, way) => barredWhy(st, id, way) === null;
  // Who goes with a new holder to its farm (the start in life every way shares): the holder, its living spouse, `followers` (settlers' kin),
  // then the children under 18 of any of them who live in one of their homes and hold no farm, nor are its ward (who stays with the farm it
  // is heir to), holder first.
  function goesWith(st, holder, followers = []) {
    const all = [holder],
      sp = spouseOf(st, holder);
    if (sp !== null && st.pawns[sp].alive) all.push(sp);
    all.push(...followers);
    const from = new Set(all.map((id) => st.pawns[id].household));
    for (const id of [...all])
      for (const c of childrenOf(st, id)) {
        const q = st.pawns[c];
        if (!q.alive || q.age >= 18 || !from.has(q.household) || all.includes(c) || isHolder(st, c)) continue;
        if (q.household !== null && st.households[q.household].ward === c) continue;
        all.push(c);
      }
    return all;
  }
  return { landed, keepsWard, BARS, WAYS, contribute, barredWhy, mayHoldFarm, goesWith };
})();
