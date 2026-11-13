// @sys sim/help: food help between households: whom a hungry household asks (kin, then the village store), for how much and when (once a
// season, until the harvest), and the village store's yearly filling; each gift is a command `give`, settled by sim/exchange (VB-216)
VB['sim/help'] = (() => {
  const issue = (st, cmd) => VB['sim/commands'].issue(st, cmd); // sim/commands loads after this module
  const { HELP, DAY, SEASON_DAYS, YEAR_DAYS, cal } = VB['sim/rules'];
  const { childrenOf, siblingsOf } = VB['sim/records'];
  const { dailyNeed } = VB['sim/hunger'],
    { reserved, grainOf } = VB['sim/stores'];
  const Rules = VB['sim/registry'];
  // allowance's second term (VB-216): the holder's own reserve beyond the floor, from 0 to 40 days of the household's need, a stand-in for
  // generosity until traits; a household without a holder keeps the most, as surplus does
  Rules.contribute({
    rule: 'allowance',
    source: 'sim/help',
    key: 'reserve',
    label: 'Own reserve',
    tunables: ['HELP.bufferDays', 'HELP.floorDays'],
    value: (st, c) =>
      -((c.giver !== null ? st.pawns[c.giver].buffer : HELP.bufferDays[1]) - HELP.floorDays) * dailyNeed(st, c.from),
  });
  // grain a household would give: what is above its holder's buffer and its seed reserve
  const surplus = (st, hh) => {
    const holder = hh.holder !== null ? st.pawns[hh.holder] : null,
      buffer = (holder ? holder.buffer : HELP.bufferDays[1]) * dailyNeed(st, hh);
    return Math.max(0, grainOf(hh) - reserved(st, hh, 'grain') - buffer);
  };
  const spare = (st, hh) => Math.max(0, grainOf(hh) - reserved(st, hh, 'grain'));
  // households holding a parent, child or sibling of a member, closest first (parents and children before siblings, then by id)
  function kinHouseholds(st, hh) {
    const rank = new Map();
    const note = (id, r) => {
      const q = st.pawns[id];
      if (!q.alive || q.household === null || q.household === hh.id || st.households[q.household].dissolved) return;
      rank.set(q.household, Math.min(rank.get(q.household) ?? 9, r));
    };
    for (const id of hh.members) {
      const p = st.pawns[id];
      for (const par of [p.father, p.mother]) if (par !== null) note(par, 1);
      for (const c of childrenOf(st, id)) note(c, 1);
      for (const s of siblingsOf(st, id)) note(s, 2);
    }
    return [...rank].sort((a, b) => a[1] - b[1] || a[0] - b[0]).map((x) => x[0]);
  }
  // A gift of n grain, as the command `give` (source 'help'): its actor is the giver's holder, or the household or village itself
  // without one; true when it was given.
  const actorOf = (x) => ('farmstead' in x ? (x.holder !== null ? x.holder : { household: x.id }) : { village: x.id });
  const give = (st, from, to, n) =>
    issue(st, {
      actor: actorOf(from),
      verb: 'give',
      target: 'farmstead' in to ? to.id : { village: to.id },
      args: { good: 'grain', n },
      source: 'help',
    }) === true;
  // @state household.askedIn: the season (game seasons since the start) in which the household last asked for help, or absent; written only
  //   here. A household asks at most once a season (VB-222; design.md, The gift: Lumps and occasions).
  const seasonOf = (t) => Math.floor(t / (SEASON_DAYS * DAY));
  const noteAsked = (hh, season) => {
    hh.askedIn = season;
  };
  // Days of food a household asks for: enough to reach the next harvest, the start of autumn, and at least HELP.askDays (a season's);
  // in autumn, while the harvest comes in, a season's. From 12 days (late summer, autumn) to 36 (the start of winter).
  const AUTUMN = 2;
  function askDaysAt(st) {
    const c = cal(st.t);
    if (c.season === AUTUMN) return HELP.askDays;
    const toHarvest = c.season < AUTUMN ? AUTUMN * SEASON_DAYS - c.doy : YEAR_DAYS - c.doy + AUTUMN * SEASON_DAYS;
    return Math.max(HELP.askDays, toHarvest);
  }
  // Short of people (design.md, Households short of people: Taken in before it starves; VB-308): at most one member of 18 or more, and fields.
  // Over its members only; read at the ask, never polled.
  const shortOfPeople = (st, hh) =>
    st.farmsteads[hh.farmstead].fields.length > 0 &&
    hh.members.filter((id) => {
      const p = st.pawns[id];
      return p.alive && p.age >= 18;
    }).length <= 1;
  // Each day, a household whose spare grain covers fewer than HELP.askBelow days, and that has not asked this season, asks kin, then the
  // village store, for food until the next harvest (askDaysAt); if the gifts fall short, it waits for the next season. Returns the ids of
  // the households short of people whose ask fell short today, in ascending id, for sim/service to take in (sim/help moves nobody).
  function shareFood(st) {
    const season = seasonOf(st.t),
      short = [];
    for (const liveId of st.liveHouseholds) {
      const hh = st.households[liveId];
      if (hh.dissolved) continue;
      if (hh.askedIn === season) continue;
      const need = dailyNeed(st, hh);
      if (need <= 0 || spare(st, hh) >= HELP.askBelow * need) continue;
      noteAsked(hh, season);
      let want = askDaysAt(st) * need - spare(st, hh);
      for (const k of kinHouseholds(st, hh)) {
        const n = Math.min(want, surplus(st, st.households[k]));
        if (n <= 1e-9) continue;
        if (give(st, st.households[k], hh, n)) want -= n;
        if (want <= 1e-9) break;
      }
      const v = st.villages[st.farmsteads[hh.farmstead].village],
        n = Math.min(want, grainOf(v));
      if (n > 1e-9 && give(st, v, hh, n)) want -= n;
      if (want > 1e-9 && shortOfPeople(st, hh)) short.push(hh.id);
    }
    return short;
  }
  // At the moving round every household gives a share of its surplus to its village's store: a village's at its own round (VB-277), or
  // every village's when v is null.
  function fillStores(st, v = null) {
    for (const liveId of st.liveHouseholds) {
      const hh = st.households[liveId];
      if (hh.dissolved || (v !== null && st.farmsteads[hh.farmstead].village !== v)) continue;
      const n = surplus(st, hh) * HELP.storeShare;
      if (n <= 1e-9) continue;
      give(st, hh, st.villages[st.farmsteads[hh.farmstead].village], n);
    }
  }
  return { surplus, kinHouseholds, shareFood, fillStores, askDaysAt, seasonOf, shortOfPeople };
})();
