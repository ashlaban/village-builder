// @sys sim/help: food help between households: whom a hungry household asks (kin, then the village store), for how much and when (once a
// season, until the harvest), and the village store's yearly filling; each gift is a command `give`, settled by sim/exchange (VB-216)
VB['sim/help'] = (() => {
  const issue = (st, cmd) => VB['sim/commands'].issue(st, cmd); // read at each call: tools/store-flows.js caps the yearly filling by replacing it
  const { AGES, HELP, GIFT, YEAR, DAY, SEASON_DAYS, YEAR_DAYS, TRAVEL, cal } = VB['sim/rules'];
  const { hoursBetween, withinDay, byLand } = VB['sim/villagehours'];
  const { kinHouseholds } = VB['sim/exchange']; // VB-390: a deal for a cow asks kin first as well
  const { dailyNeed, storeRoom } = VB['sim/hunger'],
    { reserved, grainOf } = VB['sim/stores'];
  const { on } = VB['sim/events'],
    { unplanned } = VB['sim/records'],
    { assessGift } = VB['sim/exchange'];
  const Rules = VB['sim/registry'],
    { bufferOf } = VB['sim/traits'];
  // allowance's second term (VB-216): the holder's own reserve beyond the floor, 40 to 0 days of the household's need by its generosity
  // (TRAITS.acts.generosity.reserve; VB-520, after VB-484); a household without a holder keeps the most, as surplus does
  Rules.contribute({
    rule: 'allowance',
    source: 'sim/help',
    key: 'reserve',
    label: 'Own reserve',
    tunables: ['TRAITS.acts.generosity.reserve', 'HELP.floorDays'],
    value: (st, c) => -(bufferOf(st, c.giver) - HELP.floorDays) * dailyNeed(st, c.from),
  });
  // grain a household would give: what is above its holder's buffer and its seed reserve
  const surplus = (st, hh) => {
    const buffer = bufferOf(st, hh.holder) * dailyNeed(st, hh);
    return Math.max(0, grainOf(hh) - reserved(st, hh, 'grain') - buffer);
  };
  const spare = (st, hh) => Math.max(0, grainOf(hh) - reserved(st, hh, 'grain'));
  // A gift of n grain, as the command `give` (source 'help'): its actor is the giver's holder, or the household or village itself
  // without one; true when it was given.
  const actorOf = (x) => ('farmstead' in x ? (x.holder !== null ? x.holder : { household: x.id }) : { village: x.id });
  const give = (st, from, to, n, carrier) =>
    issue(st, {
      actor: actorOf(from),
      verb: 'give',
      target: 'farmstead' in to ? to.id : { village: to.id },
      args: carrier === undefined ? { good: 'grain', n } : { good: 'grain', n, carrier },
      source: 'help',
    }) === true;
  // The youngest adult of 14 to 59 of household hh who is not on the road (VB-291), or -1: the one who carries a far gift
  function carrierOf(st, hh) {
    let best = -1;
    for (const id of hh.members) {
      const p = st.pawns[id];
      if (!p.alive || p.age < AGES.hands[0] || p.age >= AGES.hands[1] || st.agents[id].away !== undefined) continue;
      if (best < 0 || p.age < st.pawns[best].age) best = id;
    }
    return best;
  }
  // Walking hours from household k's village to hh's
  const hoursOf = (st, k, hh) =>
    hoursBetween(st, st.farmsteads[st.households[k].farmstead].village, st.farmsteads[hh.farmstead].village);
  // @state household.askedIn: the season (game seasons since the start) in which the household last asked for help, or absent; written only
  //   here. A household asks at most once a season (VB-222; design.md, The gift: Lumps and occasions), and an ask that moved no goods does not count (VB-391).
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
  // village store, for food until the next harvest (askDaysAt); if the gifts fall short, it waits for the next season. An ask that
  // brought nothing at all does not count, and it asks again tomorrow (VB-391). Returns the ids of the households short of people whose
  // ask fell short today, in ascending id, for sim/service to take in (sim/help moves nobody).
  function shareFood(st) {
    const season = seasonOf(st.t),
      short = [];
    for (const liveId of st.liveHouseholds) {
      const hh = st.households[liveId];
      if (hh.dissolved) continue;
      if (hh.askedIn === season) continue;
      const need = dailyNeed(st, hh);
      if (need <= 0 || spare(st, hh) >= HELP.askBelow * need) continue;
      let moved = false,
        want = askDaysAt(st) * need - spare(st, hh);
      // kin within a day's walk, then the village store: their gift is set aside where it lies and fetched by a member of the household
      // (VB-461, the verb's; at once only from a household of the same farmstead), and with no one to fetch it the ask goes on; then kin
      // further away, nearest first, each by a carrier on a journey (VB-291; kin over the sea or beyond reach are not asked)
      const near = [],
        far = [];
      for (const k of kinHouseholds(st, hh)) {
        const a = st.farmsteads[st.households[k].farmstead].village,
          b = st.farmsteads[hh.farmstead].village;
        if (withinDay(st, a, b)) near.push(k);
        else if (byLand(st, a, b)) far.push(k);
      }
      far.sort((a, b) => hoursOf(st, a, hh) - hoursOf(st, b, hh) || a - b);
      for (const k of near) {
        const n = Math.min(want, surplus(st, st.households[k]));
        if (n <= 1e-9) continue;
        if (give(st, st.households[k], hh, n)) {
          want -= n;
          moved = true;
        }
        if (want <= 1e-9) break;
      }
      const v = st.villages[st.farmsteads[hh.farmstead].village],
        n = Math.min(want, grainOf(v) - reserved(st, v, 'grain')); // not the seed of its common fields (VB-100)
      if (n > 1e-9 && give(st, v, hh, n)) {
        want -= n;
        moved = true;
      }
      for (const k of far) {
        if (want <= 1e-9) break;
        const g = st.households[k],
          n = Math.min(want, surplus(st, g), TRAVEL.load); // what one adult carries on his back
        if (n <= 1e-9) continue;
        const c = carrierOf(st, g);
        if (c < 0) continue; // no one can go: the ask goes on
        if (give(st, g, hh, n, c)) {
          want -= n;
          moved = true;
        }
      }
      // an ask that moved no goods marks nothing worth remembering (VB-391): it is not the season's ask, and the household asks again on a later day
      if (moved) noteAsked(hh, season);
      if (want > 1e-9 && shortOfPeople(st, hh)) short.push(hh.id);
    }
    return short;
  }
  // At the moving round every household gives a share of its surplus to its village's store: a village's at its own round (VB-277), or
  // every village's when v is null.
  // A household's quarter is taken only up to what the store lacks of its target, shared among the givers in proportion to what each would
  // have given; the rest stays at home (VB-457).
  function fillStores(st, v = null) {
    const gifts = new Map(); // village id -> [[household, n]]
    for (const liveId of st.liveHouseholds) {
      const hh = st.households[liveId],
        vid = st.farmsteads[hh.farmstead].village;
      if (hh.dissolved || (v !== null && vid !== v)) continue;
      const n = surplus(st, hh) * HELP.storeShare;
      if (n <= 1e-9) continue;
      if (!gifts.has(vid)) gifts.set(vid, []);
      gifts.get(vid).push([hh, n]);
    }
    for (const [vid, list] of gifts) {
      const village = st.villages[vid];
      let total = 0;
      for (const g of list) total += g[1];
      const k = Math.min(1, storeRoom(st, village) / total);
      if (!(k > 1e-9)) continue;
      for (const [hh, n] of list) give(st, hh, village, n * k);
    }
  }
  // ---- the good-year gift (VB-460; design.md, The gift: The good-year gift) ----
  // @state household.giftedIn: the year (game years since the start) in which the household last gave unasked, or absent; written only here.
  // On a holder's planning day from the harvest on, a household above the feast's threshold (rule 'feast') offers, once a year, to the first
  // of its ties (kin, then by the tie's strength) within a day's walk and by land that holds under GIFT.shortBelow years of its need above its
  // seed: its allowance, at most TRAVEL.load, at most what brings the receiver to a year; under GIFT.least no gift. The verb `give`'s, carried
  // by one of the giver's own; the receiver's holder answers, and goodwill is booked on arrival (sim/exchange).
  const yearOf = (t) => Math.floor(t / YEAR);
  const { tieOf } = VB['sim/records'];
  // Why household hh gives no unasked gift now, or the gift {to, n, carrier}
  function goodYearGift(st, hh) {
    const id = hh.holder;
    if (Rules.value(st, 'feast', { hh }) <= 0) return "its grain is not above the feast's threshold";
    const p = st.pawns[id],
      kin = new Set(kinHouseholds(st, hh)),
      ranked = [];
    for (const [b] of p.ties) {
      VB.count.giftTiesWeighed++;
      const q = st.pawns[b];
      if (!q.alive || q.household === null || q.household === hh.id) continue;
      const k = st.households[q.household];
      if (k.dissolved) continue;
      ranked.push([kin.has(k.id) ? 0 : 1, -tieOf(st, id, b), k.id]);
    }
    for (const k of kin) if (!ranked.some((r) => r[2] === k)) ranked.push([0, 0, k]);
    ranked.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
    let why = 'no one is short',
      seen = new Set();
    for (const [, , kid] of ranked) {
      if (seen.has(kid)) continue;
      seen.add(kid);
      const to = st.households[kid],
        need = dailyNeed(st, to) * YEAR_DAYS;
      if (need <= 0 || spare(st, to) >= GIFT.shortBelow * need) continue;
      const a = st.farmsteads[hh.farmstead].village,
        b = st.farmsteads[to.farmstead].village;
      if (a !== b && !(withinDay(st, a, b) && byLand(st, a, b))) {
        why = 'no route to the one who is short';
        continue;
      }
      const n = Math.min(
        assessGift(st, { from: hh, to, n: Infinity, source: 'help' }).allowance,
        TRAVEL.load,
        need - spare(st, to),
      );
      if (n < GIFT.least) return 'the allowance is under a sack';
      const carrier = carrierOf(st, hh);
      if (carrier < 0) return 'no one of the household can carry it';
      return { to, n, carrier };
    }
    return why;
  }
  // The verb `giveUnasked`'s act: the offer `give` makes, with the receiver's yes still to come
  function giveUnasked(st, hh) {
    const g = goodYearGift(st, hh);
    if (typeof g === 'string') return g;
    const r = issue(st, {
      actor: hh.holder,
      verb: 'give',
      target: g.to.id,
      args: { good: 'grain', n: g.n, carrier: g.carrier },
      source: 'pawn',
    });
    if (r !== true) return r;
    hh.giftedIn = yearOf(st.t);
    return true;
  }
  on('planReviewed', (st, d) => {
    if (d.why !== 'day' || d.plan.holder.type !== 'household' || cal(st.t).season < AUTUMN) return;
    const hh = st.households[d.plan.holder.id],
      id = hh.holder;
    if (hh.dissolved || id === null || id === undefined || !st.pawns[id].alive || hh.giftedIn === yearOf(st.t)) return;
    if (unplanned(st, id)) return;
    giveUnasked(st, hh);
  });
  return {
    goodYearGift,
    giveUnasked,
    surplus,
    kinHouseholds,
    shareFood,
    fillStores,
    askDaysAt,
    seasonOf,
    shortOfPeople,
  };
})();
