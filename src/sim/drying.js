// @sys sim/drying: dried fish (VB-300), the first good of place: a village's reach to fishing water, refreshed when its farms change;
// fishing for the drying rack and hanging the catch, a side craft of spring to autumn; the fishing boat, a household's facility on
// a shore built as a project plan (the cook puts dried fish in the winter's pot: sim/pot, VB-119)
// Design: design.md, Goods of place and side crafts (Goods of place, First goods, Side crafts, The fishing boat; Agreed, 10 Nov). Fish are
// split and hung on racks in the dry winds of spring to autumn (stockfish, klippfisk), and keep a year or more: here through winter
// and spring, to the next summer (the good's keepsDays, sim/stores). Nobody travels in a boat (slice 10). VB-301: a boat wants a barrel
// of tar every BOAT.tarYears (sim/tar spends it); untarred that long it fishes at BOAT.leaky of its catch, and after BOAT.lostYears it is lost.
// VB-388 (Kim, 12 Nov): the catch for the pot a household cannot eat before it spoils goes to the rack while the rack has room.
VB['sim/drying'] = (() => {
  const { FISH, FIELDS, FOODS, SEASON_DAYS, YEAR, YEAR_DAYS, cal } = VB['sim/rules'];
  const { bfs } = VB['sim/hex'],
    { passable } = VB['sim/routes'];
  const { isWater, lakeSizes, ground, landCatch } = VB['sim/fish'];
  const { age, log, atFarm } = VB['sim/records'];
  const Stores = VB['sim/stores'],
    Projects = VB['sim/projects'],
    { emit } = VB['sim/events'];
  const { dailyNeed, larderOf, floorOf } = VB['sim/hunger'];
  const Pot = VB['sim/pot'];
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
  const catchOf = (st, j) => landCatch(st, j.water) * (j.boat ? BOAT.catch * (j.leaky ? BOAT.leaky : 1) : 1);
  // ---- drying ----
  // The dried fish a household wants in store: the winter pot's fish share of its need over the days without fresh fish, in whole lots.
  const wanted = (st, hh) => Math.ceil((Pot.WINTER_FISH * dailyNeed(st, hh) * winterDays) / DRY.lot - 1e-9) * DRY.lot;
  // The drying season: from spring day FISH.from + 1 to the end of autumn (VB-388).
  const drying = (c) => (c.season === 0 && c.sday >= FISH.from) || c.season === 1 || c.season === 2;
  // The catch for the pot (sim/kinds' fish): fresh fish (sim/pot), and the fresh fish held beyond what the household eats before it spoils
  // (its need over the fish's keeps) laid by the rack, the oldest first, while the drying season is open and the rack has room (the dried
  // fish wanted, less what is held and what waits by the rack). One comparison a catch (VB-388).
  function potCatch(st, j, hh) {
    Pot.putFresh(st, hh, 'fish', catchOf(st, j), 'catch');
    if (!drying(cal(st.t))) return 0;
    const need = dailyNeed(st, hh),
      room = wanted(st, hh) - larderOf(hh, 'dried fish') - (hh.rack || 0),
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
  function hands(st, hh) {
    let n = 0;
    for (const id of hh.members) {
      const p = st.pawns[id],
        a = age(st, p);
      if (p.died === null && a >= 14 && a < 60 && !p.retired) n++;
    }
    return n;
  }
  // VB-393 (Kim, 12 Nov): a boat is built only by a household that can spare it: grain above its floor (which holds the seed reserve)
  // and a year's need besides, and BOAT.hands working hands that its fields do not need (FIELDS.perHand fields a hand).
  function boatable(st, hh, f) {
    const free = hands(st, hh) - Math.ceil(f.fields.length / FIELDS.perHand);
    return free >= BOAT.hands && Stores.grainOf(hh) - floorOf(st, hh) >= dailyNeed(st, hh) * YEAR_DAYS;
  }
  // At the start of the drying season: a boat untarred BOAT.lostYears is lost (VB-301); then each household of a village by fishing water,
  // with no boat for its house, no project plan (nor a head holding off projects, VB-253), grain and hands to spare (boatable) and a village wood to fell in, begins a boat if a shore by the sea
  // or a large lake is in its reach.
  function boatYear(st) {
    for (const v of st.villages) {
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
      if (!v.wood.length || !villageFishes(st, v)) continue;
      for (const id of v.farmsteads) {
        const f = st.farmsteads[id],
          hh = f.household === null ? null : st.households[f.household];
        VB.count.boatAsk++;
        if (
          !hh ||
          hh.dissolved ||
          f.booth ||
          (hh.boat && hh.boat.house === f.house) ||
          Projects.projectOf(st, 'household', hh.id) ||
          Projects.heldOff(st, hh.id)
        )
          continue;
        if (!boatable(st, hh, f)) continue;
        const s = boatShore(st, f.house);
        if (s)
          emit(st, 'projectBegun', {
            type: 'household',
            id: hh.id,
            project: {
              what: 'boat',
              water: s.water,
              steps: [{ kind: 'boat', place: s.shore, hours: BOAT.hours, wood: 0, timber: BOAT.timber }],
            },
          });
      }
    }
  }
  // The boat built: the household's, at the plan's shore; the plan is finished (sim/plans).
  function boatBuilt(st, j, hh) {
    const plan = Projects.projectOf(st, 'household', hh.id),
      s = plan && Projects.openStep(plan);
    if (!s || s.kind !== 'boat' || s.place !== j.site) return;
    const f = st.farmsteads[hh.farmstead];
    hh.boat = { tile: s.place, water: plan.water, house: f.house, built: st.t, tarred: st.t };
    emit(st, 'stepDone', { type: 'household', id: hh.id });
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
  const KINDS = {
    rackfish: {
      verb: 'Fishing for the drying rack',
      go: 'Going fishing for the rack',
      back: 'Carrying the catch to the rack',
      name: 'Fish for the rack',
      label: 'Fishing',
      anim: 'fish',
      hours: 3,
      hands: 1,
      type: 'foraging',
      carry: 'fish',
      to: 'door',
      spot: (st, a, j) => {
        const w = st.w,
          x = w.hx[j.site],
          y = w.hy[j.site],
          k = w.water[j.water] ? 0.45 : 0.7;
        return [x + (w.hx[j.water] - x) * k + a.ox * 0.15, y + (w.hy[j.water] - y) * k + a.oy * 0.1];
      },
      urgency: () => DRY.urgency,
      // the catch is laid by the rack, to be split and hung
      deliver: (st, j, hh) => {
        Stores.put(st, hh, 'fish', catchOf(st, j), 'catch');
      },
      // in the drying season, in a village by fishing water, while the household holds less dried fish than it wants and no catch waits
      available: (st, hh, f, c, post) => {
        if (
          !drying(c) ||
          hh.rack > 0 ||
          larderOf(hh, 'dried fish') >= wanted(st, hh) ||
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
      label: 'Boat',
      anim: 'mallet',
      hours: BOAT.hours,
      hands: 2,
      type: 'wood',
      project: true,
      spot: (st, a, j) => [st.w.hx[j.site] + a.ox * 0.4, st.w.hy[j.site] + a.oy * 0.3],
      done: (st, j, hh) => boatBuilt(st, j, hh),
    },
  };
  return {
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
    boatYear,
    untarred,
    boatDue,
    boatTarred,
    hands,
  };
})();
