// @sys sim/drying: dried fish (VB-300), the first good of place: a village's reach to fishing water, refreshed when its farms change;
// fishing for the drying rack and hanging the catch, a side craft of spring to autumn; the fishing boat, a household's facility on
// a shore built as a project plan (the cook puts dried fish in the winter's pot: sim/pot, VB-119)
// Design: design.md, Goods of place and side crafts (Goods of place, First goods, Side crafts, The fishing boat; Agreed, 10 Nov). Fish are
// split and hung on racks in the dry winds of spring to autumn (stockfish, klippfisk), and keep a year or more: here through winter
// and spring, to the next summer (the good's keepsDays, sim/stores). Nobody travels in a boat (slice 10). VB-301: a boat wants a barrel
// of tar every BOAT.tarYears (sim/tar spends it); untarred that long it fishes at BOAT.leaky of its catch, and after BOAT.lostYears it is lost.
// VB-388 (Kim, 12 Nov): the catch for the pot a household cannot eat before it spoils goes to the rack while the rack has room.
VB['sim/drying'] = (() => {
  // The kinds of event it writes on the record (sim/eventkinds, VB-1946).
  VB['sim/eventkinds'].eventKinds('sim/drying', {
    boatLost: { keep: 'generation' }, // a fishing boat lost for want of tar (VB-301)
  });
  const { FISH, FIELDS, FOODS, SEASON_DAYS, YEAR, YEAR_DAYS, cal } = VB['sim/rules'];
  const { bfs } = VB['sim/hex'],
    { passable } = VB['sim/walking'];
  const { isWater, lakeSizes, ground, landCatch } = VB['sim/fish'];
  const { age, log, atFarm } = VB['sim/records'];
  const Stores = VB['sim/stores'],
    Projects = VB['sim/projects'];
  const { declare } = VB['sim/makings'];
  const { dailyNeed, floorOf, spareDays, spareUrgency } = VB['sim/hunger'],
    { larderOf } = VB['sim/larder'];
  const Pot = VB['sim/pot'],
    Targets = VB['sim/targets'],
    { hands } = Targets;
  // Proposed (VB-300, the orchestrator's starting values for Kim): a household dries enough fish for the winter's fish share of its pot
  // (sim/pot's WINTER_FISH, VB-388) over the days without fresh fish (the winter and spring's first FISH.from days, under the ice), in
  // whole lots of `lot` rations; it fishes for the rack from spring day FISH.from + 1 to the end of autumn (VB-388: the season of fishing
  // for the pot), one catch waiting at a time; splitting and hanging a catch takes `hours` at the rack by the house, at `hang` urgency (as
  // salting meat: the catch does not wait), the trip is fishing's (3 hours) at `urgency` (a side craft's, as ale and digging: the
  // household's slack). Out of the fishing season the cook puts dried fish in for that share of the pot (sim/pot, VB-119), so it lasts the winter.
  const DRY = { lot: 10, hours: 1, hang: 1.6, urgency: 0.5 };
  // The fishing boat (design.md, The fishing boat; Agreed, 10 Nov): `hours` of work at the shore, `timber` loads of the village's wood
  // felled and carried to it (two trees, at 3 loads a tree as VB-328's timber trip), a trip in it brings `catch` times the bank's (8 rations
  // where the bank gives 4). A household with `hands` working hands (14 to 59) may build one, at the start of the drying season.
  // Tar (VB-301; design.md, The fishing boat; Agreed, 10 Nov): a boat is tarred as it is built and wants a barrel every `tarYears`;
  // untarred that long it leaks and fishes at `leaky` of its catch (8 rations a trip to 4), and untarred `lostYears` it is lost.
  const BOAT = { hours: 20, timber: 6, catch: 2, hands: 2, tarYears: 2, leaky: 0.5, lostYears: 4 };
  const winterDays = SEASON_DAYS + FISH.from;
  VB.counter(
    'fishReach',
    "Tiles within reach of a house searched for fishing water: a village's reach test when it has a new farm, a household's shore " +
      'for a boat (sim/drying; VB-300)',
  );
  // ---- the village's reach (the reach test, as VB-117's): fishing water (a river, a lake or the sea) next to a bank within FISH.reach
  // walking steps of one of its houses. The world's water does not change in play, so the test changes only with the village's farms. ----
  // @state village.fishing: {farms, near}: the reach test as of the village's farms (farms: how many it had when tested; near: whether
  //   fishing water was in reach of one of their houses); a cache, written only here, tested again when the village has a new farm.
  function nearWater(st, house) {
    const w = st.w,
      { dist } = bfs(w, house, FISH.reach, (j) => passable(w, j));
    VB.count.fishReach += dist.size;
    for (const t of dist.keys()) {
      if (w.river[t]) continue;
      for (let k = 0; k < 6; k++) if (isWater(w, w.nb[t * 6 + k])) return true;
    }
    return false;
  }
  function villageFishes(st, v) {
    const n = v.farmsteads.length;
    if (v.fishing && v.fishing.farms === n) return v.fishing.near;
    let near = false;
    for (const id of v.farmsteads)
      if (nearWater(st, st.farmsteads[id].house)) {
        near = true;
        break;
      }
    v.fishing = { farms: n, near };
    return near;
  }
  // ---- where a household fishes: from its boat while it lies in reach of the house it was built for, else from its fishing ground ----
  // @state household.boat: {tile, water, house, built, tarred} or null: the household's fishing boat, kept on shore tile `tile` by water
  //   tile `water`, built for the house on tile `house` (a household that moves leaves it behind), at game hour `built`, last tarred at game
  //   hour `tarred` (VB-301; tarred as it is built). Written only here.
  // Years since the boat was last tarred (read in closed form: no pass ages it).
  const untarred = (st, b) => (st.t - (b.tarred ?? b.built)) / YEAR;
  // The boat is past saving: untarred BOAT.lostYears (the yearly round takes it away; until then nobody fishes from it).
  const boatGone = (st, b) => untarred(st, b) >= BOAT.lostYears;
  // The household's boat is due a barrel of tar: untarred for BOAT.tarYears less `lead` years (tarred in the season before it leaks).
  const boatDue = (st, hh, f, lead = 0) =>
    !!hh.boat && hh.boat.house === f.house && !boatGone(st, hh.boat) && untarred(st, hh.boat) >= BOAT.tarYears - lead;
  function fishingPlace(st, hh, f) {
    const b = hh.boat;
    if (b && b.house === f.house && !boatGone(st, b))
      return { shore: b.tile, water: b.water, boat: true, leaky: untarred(st, b) >= BOAT.tarYears };
    const g = ground(st, f.house);
    return g ? { shore: g.shore, water: g.water, boat: false, leaky: false } : null;
  }
  // A trip's catch, in rations: the bank's (sim/fish, lowering the stock of water that runs down), BOAT.catch times it from a boat, and
  // BOAT.leaky of that from a boat untarred too long (VB-301).
  // `frac`: the share of the trip's hours fished (VB-1748: a trip cut at its work brings what its hours so far have yielded)
  const catchOf = (st, j, frac = 1) =>
    landCatch(st, j.water, frac) * (j.boat ? BOAT.catch * (j.leaky ? BOAT.leaky : 1) : 1);
  // ---- drying ----
  // The dried fish a household wants in store: the winter pot's fish share of its need over the days without fresh fish, in whole lots.
  const wanted = (st, hh) => Math.ceil((Pot.WINTER_FISH * dailyNeed(st, hh) * winterDays) / DRY.lot - 1e-9) * DRY.lot;
  // The drying season: from spring day FISH.from + 1 to the end of autumn (VB-388).
  const drying = (c) => (c.season === 0 && c.sday >= FISH.from) || c.season === 1 || c.season === 2;
  // The catch for the pot (sim/kinds' fish): fresh fish (sim/pot), and the fresh fish held beyond what the household eats before it spoils
  // (its need over the fish's keeps) laid by the rack, the oldest first, while the drying season is open and the rack has room (the dried
  // fish wanted, less what is held and what waits by the rack). One comparison a catch (VB-388).
  // It returns the catch (VB-1118: the played pawn's sheet tells it); toRack returns what went to the rack.
  function potCatch(st, j, hh, n = catchOf(st, j)) {
    Pot.putFresh(st, hh, 'fish', n, 'catch');
    if (drying(cal(st.t))) toRack(st, hh);
    return n;
  }
  function toRack(st, hh) {
    const need = dailyNeed(st, hh),
      room = Targets.target(st, hh, 'dried fish') - larderOf(hh, 'dried fish') - (hh.rack || 0),
      n = Math.min(room, Pot.freshHeld(st, hh, 'fish') - need * FOODS.fish.keeps);
    if (!(n > 1e-9)) return 0;
    const got = Pot.takeFresh(st, hh, n, 'drying', 'fish').fish || 0;
    if (got > 0) Stores.put(st, hh, 'fish', got, 'drying');
    return got;
  }
  // ---- the boat's project (VB-123's project plan: one step at the shore, which waits for its timber; sim/building fells it) ----
  // The bank nearest the house within FISH.reach walking steps by the sea or a lake of FISH.bigLake tiles or more: {shore, water}, or null.
  function boatShore(st, house) {
    const w = st.w,
      { dist } = bfs(w, house, FISH.reach, (j) => passable(w, j)),
      size = lakeSizes(w);
    VB.count.fishReach += dist.size;
    for (const t of dist.keys()) {
      if (w.river[t]) continue;
      for (let k = 0; k < 6; k++) {
        const j = w.nb[t * 6 + k];
        if (j >= 0 && w.water[j] === 1 && (w.ocean[j] || size[j] >= FISH.bigLake)) return { shore: t, water: j };
      }
    }
    return null;
  }
  // VB-393 (Kim, 12 Nov): a boat is built only by a household that can spare it: grain above its floor (which holds the seed reserve)
  // and a year's need besides, and BOAT.hands working hands that its fields do not need (FIELDS.perHand fields a hand).
  function boatable(st, hh, f) {
    const free = hands(st, hh) - Math.ceil(f.fields.length / FIELDS.perHand);
    return free >= BOAT.hands && Stores.grainOf(hh) - floorOf(st, hh) >= dailyNeed(st, hh) * YEAR_DAYS;
  }
  VB.counter(
    'tarAsk',
    "Farms asked once a year whether a boat is lost for want of tar or a tar pit is begun, and pine tiles of a village's wood walked " +
      'for tar (sim/drying, sim/tar; VB-301)',
  );
  // At the start of the drying season a boat untarred BOAT.lostYears is lost (VB-301): the yearly round takes it away and tells it. No boat
  // is begun here (VB-678): the head weighs one at its look (the making below).
  function boatsRot(st) {
    for (const v of st.villages)
      for (const id of v.farmsteads) {
        const f = st.farmsteads[id],
          hh = f.household === null ? null : st.households[f.household];
        VB.count.tarAsk++;
        if (hh && hh.boat && boatGone(st, hh.boat)) {
          hh.boat = null;
          log(st, `${f.name}'s fishing boat, untarred for ${BOAT.lostYears} years, has rotted and is lost.`, {
            kind: 'boatLost',
            ...atFarm(f),
          });
        }
      }
  }
  // The household has a boat for its house still to be saved.
  const hasBoat = (st, hh, f) => !!hh.boat && hh.boat.house === f.house && !boatGone(st, hh.boat);
  VB.counter(
    'boatAsk',
    'Farms of villages by fishing water asked whether their household begins a boat, once a year (sim/drying; VB-300)',
  );
  // The boat, a making the head begins through the verb project (VB-678; sim/projects' declare): possible with no boat for the house nor
  // one under way, a village wood to fell its timber in, fishing water in the village's reach and a shore by the sea or a large lake in
  // the house's; the head weighs it once a year from the start of the drying season, when the fishing is ahead, and wants it with grain
  // and hands to spare (boatable). A small construction, beside any other project (VB-1414).
  declare('boat', {
    small: true,
    why: (st, hh, f) => {
      const v = st.villages[f.village];
      if (hasBoat(st, hh, f)) return `${f.name} has a fishing boat`;
      if (Projects.underWay(st, hh.id, 'boat')) return `the household has a boat under way`;
      if (!v.wood.length) return `${v.name} has no wood to fell its timber in`;
      if (!villageFishes(st, v) || !boatShore(st, f.house))
        return `${f.name} has no shore by the sea or a large lake in reach`;
      return null;
    },
    begin: (st, hh, f) => {
      const s = boatShore(st, f.house);
      return {
        water: s.water,
        steps: [{ kind: 'boat', place: s.shore, hours: BOAT.hours, wood: 0, timber: BOAT.timber }],
      };
    },
    look: {
      from: FISH.from,
      want: (st, hh, f) => {
        VB.count.boatAsk++;
        const v = st.villages[f.village];
        return !hasBoat(st, hh, f) && v.wood.length && villageFishes(st, v) && boatable(st, hh, f) ? {} : null;
      },
    },
  });
  // The boat built: the household's, at the plan's shore; the plan is finished (sim/plans).
  function boatBuilt(st, j, hh, plan, s) {
    const f = st.farmsteads[hh.farmstead];
    hh.boat = { tile: s.place, water: plan.water, house: f.house, built: st.t, tarred: st.t };
  }
  // The boat is tarred (VB-301; sim/tar spends the barrel).
  function boatTarred(st, hh) {
    if (hh.boat) hh.boat.tarred = st.t;
  }
  // ---- the job kinds (sim/kinds registers them; their fields are described there) ----
  const nearHouse = (dx, dy) => (st, a, j) => [
    st.w.hx[j.farm.house] + dx + a.ox * 0.3,
    st.w.hy[j.farm.house] + dy + a.oy * 0.2,
  ];
  // Fishing: from spring day FISH.from + 1 to the end of autumn; the water is ice in winter.
  const fishing = (c) => (c.season === 0 && c.sday >= FISH.from) || c.season === 1 || c.season === 2;
  const KINDS = {
    rackfish: {
      verb: 'Fishing for the drying rack',
      go: 'Going fishing for the rack',
      name: 'Fish for the rack',
      at: ['shore'],
      needs: [],
      gives: ['fish'],
      label: 'Fishing',
      anim: 'fish',
      hours: 3,
      hands: 1,
      type: 'foraging',
      spot: (st, a, j) => {
        const w = st.w,
          x = w.hx[j.site],
          y = w.hy[j.site],
          k = w.water[j.water] ? 0.45 : 0.7;
        return [x + (w.hx[j.water] - x) * k + a.ox * 0.15, y + (w.hy[j.water] - y) * k + a.oy * 0.1];
      },
      urgency: () => DRY.urgency,
      // the catch, made as the fishing ends (VB-1748), is laid by the rack, to be split and hung
      accrues: true,
      make: (st, a, j, frac) => {
        a.load = catchOf(st, j, frac);
      },
      // in the drying season, in a village by fishing water, while the household holds less dried fish than its head's target (by default
      // the dried fish wanted, VB-698) and no catch waits
      available: (st, hh, f, c, post) => {
        if (
          !drying(c) ||
          hh.rack > 0 ||
          larderOf(hh, 'dried fish') >= Targets.target(st, hh, 'dried fish') ||
          !villageFishes(st, st.villages[f.village])
        )
          return;
        const g = fishingPlace(st, hh, f);
        if (g)
          post(`rackfish:h${hh.id}:${g.shore}`, g.shore, { farm: f, water: g.water, boat: g.boat, leaky: g.leaky });
      },
    },
    dry: {
      verb: 'Splitting and hanging fish to dry',
      go: 'Going to the drying rack',
      name: 'Hang fish to dry',
      at: ['shore'],
      needs: ['fish'],
      gives: ['dried fish'],
      label: 'Drying',
      anim: 'gather',
      hours: DRY.hours,
      hands: 1,
      type: 'household',
      spot: nearHouse(18, 4),
      urgency: () => DRY.hang,
      done: (st, j, hh) => {
        Stores.dry(st, hh);
      },
      available: (st, hh, f, c, post) => {
        if (hh.rack > 0) post(`dry:h${hh.id}`, f.house, { farm: f });
      },
    },
    boat: {
      verb: 'Building a fishing boat',
      go: 'Going to the boat on the shore',
      name: 'Build a fishing boat',
      at: ['shore'],
      needs: ['timber'],
      gives: ['boat'],
      label: 'Boat',
      anim: 'mallet',
      hours: BOAT.hours,
      hands: 2,
      type: 'wood',
      craft: 'building', // VB-360
      project: true,
      spot: (st, a, j) => [st.w.hx[j.site] + a.ox * 0.4, st.w.hy[j.site] + a.oy * 0.3],
      done: (st, j, hh) => Projects.stepEnds(st, j, hh, boatBuilt),
    },
    fish: {
      verb: 'Fishing',
      go: 'Going fishing',
      name: 'Go fishing',
      at: ['shore'],
      needs: [],
      gives: ['fish'],
      label: 'Fishing',
      anim: 'fish',
      hours: 3,
      hands: 1,
      type: 'foraging',
      // at the water's edge: the edge of the lake or sea tile, or by the brook that runs through the middle of a river tile
      spot: (st, a, j) => {
        const w = st.w,
          x = w.hx[j.site],
          y = w.hy[j.site],
          k = w.water[j.water] ? 0.45 : 0.7;
        return [x + (w.hx[j.water] - x) * k + a.ox * 0.15, y + (w.hy[j.water] - y) * k + a.oy * 0.1];
      },
      // fishCalm while spare food covers fishCalmDays of need or more, rising in a line to fishLean at none
      urgency: (st, j, c, U) => spareUrgency(st, j, U),
      // the catch (twice the bank's from a boat, VB-300) is fresh food, cooked in the pot (sim/pot, VB-119); beyond it, to the rack (VB-388)
      accrues: true,
      make: (st, a, j, frac) => {
        a.load = catchOf(st, j, frac); // the catch made as the fishing ends (VB-1748)
      },
      // in the fishing season, from its boat or the house's fishing ground (sim/drying): one trip, two while spare food is under FISH.secondDays
      available: (st, hh, f, c, post) => {
        if (!fishing(c) || Pot.fishCovered(st, hh, dailyNeed(st, hh))) return; // none while fresh fish covers 2 days (VB-388)
        const g = fishingPlace(st, hh, f);
        if (!g) return;
        // the key names the bank, so a ground fished out is left for the next one at the following review
        post(`fish:h${hh.id}:${g.shore}`, g.shore, { farm: f, water: g.water, boat: g.boat, leaky: g.leaky });
        if (spareDays(st, hh) < FISH.secondDays)
          post(`fish:h${hh.id}:${g.shore}b`, g.shore, { farm: f, water: g.water, boat: g.boat, leaky: g.leaky });
      },
    },
  };
  // Dried fish as a made good (VB-698): its default target the dried fish wanted; its top bound, in a village by fishing water (as last
  // tested: the view reads no new test), what the household's spare hours bring at a bank's catch a trip (twice from a boat), each trip
  // fished and hung.
  Targets.made({
    good: 'dried fish',
    unit: 'ration',
    whole: false,
    need: (st, hh) => wanted(st, hh),
    most: (st, hh, f, spare) => {
      const v = f && st.villages[f.village];
      if (!v || (v.fishing && !v.fishing.near)) return 0;
      return Math.floor((spare * FISH.trip * (hh.boat ? BOAT.catch : 1)) / (KINDS.rackfish.hours + DRY.hours));
    },
    held: (st, hh) => larderOf(hh, 'dried fish'),
  });
  // the trips that make their good at the work go on from the world (VB-1749: sim/methods trip)
  VB['sim/methods'].trip(KINDS.fish, 'fish', {
    look: 'fish',
    words: 'Carrying the catch home',
    deliver: (st, j, hh, f, a) => potCatch(st, j, hh, a.load), // the catch, for the played pawn's sheet (VB-1118)
  });
  VB['sim/methods'].trip(KINDS.rackfish, 'fish', {
    look: 'fish',
    words: 'Carrying the catch to the rack',
    deliver: (st, j, hh, f, a) => {
      if (a.load > 0) Stores.put(st, hh, 'fish', a.load, 'catch');
    },
  });
  return {
    // what it gives the page through the Sim facade (src/sim.js joins the lists, VB-1944)
    PAGE: [['boatUntarred', 'untarred']],
    DRY,
    BOAT,
    KINDS,
    villageFishes,
    fishingPlace,
    catchOf,
    potCatch,
    wanted,
    drying,
    boatShore,
    boatsRot,
    untarred,
    boatDue,
    boatTarred,
    hands,
  };
})();
