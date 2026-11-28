// @sys sim/help: food help between households: whom a hungry household's head asks (kin, then its lord, the village store's alderman, then kin
// further away), for how much and when (at its plan's review, once a season, until the harvest; VB-691), each ask an offer on the basis
// `ask` (sim/exchange) the one asked answers; and the village store's yearly filling, called by its alderman, each quarter a command
// `give`; the store gives and is filled only through its alderman at home (VB-673)
VB['sim/help'] = (() => {
  const issue = (st, cmd) => VB['sim/commands'].issue(st, cmd); // read at each call: tools/store-flows.js caps the yearly filling by replacing it
  const { HELP, YEAR, DAY, SEASON_DAYS, YEAR_DAYS, TRAVEL, cal } = VB['sim/rules'];
  const { hoursBetween, withinDay, byLand } = VB['sim/villagehours'];
  const { kinHouseholds, carrierOf } = VB['sim/exchange']; // VB-390: a deal for a cow asks kin first as well
  const { agentOf, agentWhy } = VB['sim/decisions'];
  const { dailyNeed, storeRoom } = VB['sim/hunger'],
    { reserved, grainOf } = VB['sim/stores'];
  const { on } = VB['sim/events'],
    { unplanned, holdingOf } = VB['sim/records'],
    { assessGift } = VB['sim/exchange'];
  const Rules = VB['sim/registry'],
    { bufferOf } = VB['sim/traits'];
  // @tunable GIFT: the good-year gift: who gives unasked, and how much
  // The good-year gift (VB-460): a holder above FEAST.above gives unasked to a tie holding under shortBelow years of its need above its seed;
  // under least rations (a sack) the walk is not worth it and none is made
  const GIFT = { shortBelow: 1, least: 10 };
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
  // A gift of n grain, as the command `give` (source 'help'): its actor is the giver's holder, or the household itself without one, or
  // for a village's store its alderman at home (VB-673; none, and the store gives nothing); true when it was given.
  const actorOf = (st, x) =>
    'farmstead' in x ? (x.holder !== null ? x.holder : { household: x.id }) : agentOf(st, x.id);
  function give(st, from, to, n, carrier) {
    const actor = actorOf(st, from);
    if (actor === null) return false;
    const args = { good: 'grain', n };
    if (carrier !== undefined) args.carrier = carrier;
    if (!('farmstead' in from)) args.store = from.id;
    return (
      issue(st, {
        actor,
        verb: 'give',
        target: 'farmstead' in to ? to.id : { village: to.id },
        args,
        source: 'help',
      }) === true
    );
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
  // @state household.fellShort: the game day on which the household, short of people (shortOfPeople), last asked for food and was given
  //   less than it asked, or absent; written only here, read by sim/service's takeIn at the next midnight (VB-308, VB-691)
  // The pawn who asks for household hh: its holder, else its eldest living member; null with none
  function askerOf(st, hh) {
    if (hh.holder !== null && hh.holder !== undefined && st.pawns[hh.holder].alive) return hh.holder;
    let best = null;
    for (const id of hh.members)
      if (st.pawns[id].alive && (best === null || st.pawns[id].age > st.pawns[best].age)) best = id;
    return best;
  }
  VB.counter(
    'foodAsked',
    'Asks for food made by a hungry head at its plan review, one an asked party (sim/help askFood, VB-691)',
  );
  // The head of household hh asks for food (VB-691; design.md, The gift), at a review of its plan: on its planning day, or when its grain
  // above the seed runs out (sim/stores wakes the plan). While its spare grain covers fewer than HELP.askBelow days, and it has not asked
  // this season, it asks for food until the next harvest (askDaysAt): an offer on the basis `ask` to the head of each kin household
  // within a day's walk, then to its village's alderman for the store, then to kin further away by land, nearest first, each for what it
  // still lacks, none who refused it this season (its memory refusedUs); each answers by its floor and allowance and gives what they
  // allow (sim/exchange). The asker knows what it was given by what was set aside for it; an ask answered later (the played head's)
  // moves nothing now. An ask that moved nothing marks nothing worth
  // remembering (VB-391): it asks again at its next review. The played head asks for itself, by the same verb, unless its pawn plans for
  // it. True when the ask was made.
  function askFood(st, hh) {
    const season = seasonOf(st.t);
    if (hh.dissolved || hh.askedIn === season) return false;
    const need = dailyNeed(st, hh);
    if (need <= 0 || spare(st, hh) >= HELP.askBelow * need) return false;
    const by = askerOf(st, hh);
    if (by === null || unplanned(st, by)) return false;
    let moved = false,
      want = askDaysAt(st) * need - spare(st, hh);
    const ask = (party, target, wants) => {
      if (st.offers.some((o) => o.basis === 'ask' && o.from === by && o.to === target)) return; // asked already, not yet answered
      const before = grainOf(party);
      VB.count.foodAsked++;
      issue(st, { actor: by, verb: 'offer', target, args: { basis: 'ask', wants }, source: 'planner' });
      const n = before - grainOf(party); // what the yes set aside, or sent with one of the giver's own
      if (n > 1e-9) {
        want -= n;
        moved = true;
      }
    };
    // the head of kin household k, unless it refused us this season: an ask refused is remembered (VB-690), and not made again until the next
    const head = (k) => {
      const g = st.households[k],
        h = g.holder;
      if (h === null || !st.pawns[h].alive) return null;
      const r = st.pawns[by].rel.get(h),
        m = r && r.mem.refusedUs;
      return m && seasonOf(m.t) === season ? null : h;
    };
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
      if (want < HELP.askLeast) break;
      const h = head(k);
      if (h !== null) ask(st.households[k], h, { good: 'grain', n: want });
    }
    // its lord, first after kin (VB-708): one who looks to another asks him before the village's store, unless he refused it this season
    const lord = st.pawns[by].looksTo,
      lh = lord !== null && lord !== undefined && st.pawns[lord].alive ? holdingOf(st, lord) : null;
    if (want >= HELP.askLeast && lh && lh.id !== hh.id && !near.includes(lh.id) && head(lh.id) === lord) {
      const a = st.farmsteads[lh.farmstead].village,
        b = st.farmsteads[hh.farmstead].village;
      if (withinDay(st, a, b)) ask(lh, lord, { good: 'grain', n: want });
      else if (byLand(st, a, b)) ask(lh, lord, { good: 'grain', n: Math.min(want, TRAVEL.load) });
    }
    // a patron (VB-464; design.md, Patronage): the household of its village with the most grain above the feast's threshold, not one
    // asked already, given by the gift's rule (its floor, its allowance) and of its plenty (at most what is above the feast's threshold),
    // carried as help is, goodwill booked between the two holders
    const pt = want >= HELP.askLeast ? patronFor(st, hh, near, lh, head) : null;
    if (pt) ask(pt.hh, pt.hh.holder, { good: 'grain', n: Math.min(want, pt.over) }); // of its plenty: what is over its keep
    const v = st.villages[st.farmsteads[hh.farmstead].village],
      alderman = agentOf(st, v.id);
    const refused = alderman !== null && st.pawns[by].rel.get(alderman),
      no = refused && refused.mem.refusedUs && seasonOf(refused.mem.refusedUs.t) === season;
    if (want >= HELP.askLeast && alderman !== null && !no) ask(v, alderman, { good: 'grain', n: want, store: v.id });
    for (const k of far) {
      if (want < HELP.askLeast) break;
      const h = head(k);
      if (h !== null) ask(st.households[k], h, { good: 'grain', n: Math.min(want, TRAVEL.load) });
    }
    if (moved) noteAsked(hh, season);
    if (want > 1e-9 && shortOfPeople(st, hh)) hh.fellShort = Math.floor(st.t / DAY);
    return true;
  }
  VB.counter(
    'patronWeighed',
    "Households of its village weighed for the richest patron by a hungry household's ask, a season (sim/help, VB-464)",
  );
  // The richest household of hh's village above the feast's threshold (rule 'feast', VB-458) whose head would be asked: not hh, nor the
  // kin near or the lord's household asked already, nor a head who refused it this season; ties by id. Over the village's farms.
  function patronFor(st, hh, near, lh, head) {
    let best = null,
      most = 0;
    for (const fid of st.villages[st.farmsteads[hh.farmstead].village].farmsteads) {
      const k = st.farmsteads[fid].household;
      VB.count.patronWeighed++;
      if (k === null || k === hh.id || (lh && k === lh.id) || near.includes(k)) continue;
      const g = st.households[k];
      if (g.dissolved || head(k) === null) continue;
      const over = Rules.value(st, 'feast', { hh: g });
      if (over > most || (over === most && best && k < best.id && over > 0)) {
        best = g;
        most = over;
      }
    }
    return best ? { hh: best, over: most } : null;
  }
  on('planReviewed', (st, d) => {
    if ((d.why !== 'day' && d.why !== 'store') || d.plan.holder.type !== 'household') return;
    askFood(st, st.households[d.plan.holder.id]);
  });
  // The households short of people whose ask fell short yesterday, in ascending id: sim/service takes them in at midnight (VB-308)
  const fellShort = (st) => {
    const day = Math.floor(st.t / DAY) - 1;
    return st.liveHouseholds.filter((id) => st.households[id].fellShort === day);
  };
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
  // fillStore(village) (VB-673): the village's alderman, at home, calls its households' quarters to its store at the village's round;
  // each household gives by its own holder (fillStores). With no alderman, or one away, the store is not filled that year.
  VB['sim/commands'].register('fillStore', {
    check: (st, c) => (st.villages[c.target] ? agentWhy(st, c.target, c.actor) : `there is no village ${c.target}`),
    run: (st, c) => fillStores(st, c.target),
  });
  // At village v's round: its alderman, at home and planned, calls the filling (the verb fillStore); true when it was called.
  function callFilling(st, v) {
    const a = agentOf(st, v);
    return (
      a !== null && !unplanned(st, a) && issue(st, { actor: a, verb: 'fillStore', target: v, source: 'round' }) === true
    );
  }
  // ---- the good-year gift (VB-460; design.md, The gift: The good-year gift) ----
  // @state household.giftedIn: the year (game years since the start) in which the household last gave unasked, or absent; written only here.
  // On a holder's planning day from the harvest on, a household above the feast's threshold (rule 'feast') offers, once a year, to the first
  // of its ties (kin, then by the tie's strength) within a day's walk and by land that holds under GIFT.shortBelow years of its need above its
  // seed: its allowance, at most TRAVEL.load, at most what brings the receiver to a year; under GIFT.least no gift. The verb `give`'s, carried
  // by one of the giver's own; the receiver's holder answers, and goodwill is booked on arrival (sim/exchange).
  const yearOf = (t) => Math.floor(t / YEAR);
  const { tieOf } = VB['sim/ties'];
  VB.counter(
    'giftTiesWeighed',
    'Ties of a holder weighed for the good-year gift, at most 32, on its one planning day a year (sim/help, VB-460)',
  );
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
    // what it gives the page through the Sim facade (src/sim.js joins the lists, VB-1944)
    PAGE: ['kinHouseholds'],
    GIFT,
    goodYearGift,
    giveUnasked,
    surplus,
    kinHouseholds,
    askFood,
    askerOf,
    fellShort,
    fillStores,
    callFilling,
    askDaysAt,
    seasonOf,
    shortOfPeople,
  };
})();
