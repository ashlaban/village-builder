// @sys sim/camp [material]: the camp of a settler who plans by hand, and the farmstead goal (VB-1777) (VB-1655; Kim, 24 Nov 2026: "land first, place
//   from the menu"): the farm kept on
//   the landing tile with nothing on it, roofless (sim/building roofless), until its head places the farmstead (the verb `placeFarmstead`:
//   the house moved to the tile chosen anywhere reachable on foot, the shelter begun on it, VB-1666, VB-1667) and its shelter stands; the
//   goods, the carts and the herds left at the landing when the house moves, to be fetched (leaveLanding, VB-1667), and what that costs
//   (moveCost, a read for the page); what the played head may build now (the build menu, a registry) and why a tile will not take it; a
//   camp left to itself placed by its head's own rule (placeOwn, VB-1658), within LANDING.soilSteps of the landing
VB['sim/camp'] = (() => {
  const { register, issue } = VB['sim/commands'];
  const { living } = VB['sim/records'];
  const { on } = VB['sim/events'];
  const { bfs, hexSteps, stepsTo } = VB['sim/hex'];
  const { walkable, partOf } = VB['sim/walking'];
  const { faceGate, clearGate, sansGate } = VB['sim/entrances'];
  const { pawnPlan: planOf } = VB['sim/steps'];
  const Stores = VB['sim/stores'],
    Lying = VB['sim/lying'],
    { leaveAt } = VB['sim/droving'];
  const { emit } = VB['sim/events'];
  const { TRAVEL, SPEED, ECON, DAY, YEAR, SEASON_DAYS, WORK } = VB['sim/rules'];
  const { setOwner } = VB['sim/ownership'];
  const { freeFor, woodTaken } = VB['sim/territory'];
  const { costChanged, findRoute, routeCost } = VB['sim/routes'];
  const { homeTile } = VB['sim/herds'];
  const Water = VB['sim/water'];
  const { BOOTH } = VB['sim/rules'];
  const { lacks } = VB['sim/projects'];
  const { LANDING } = VB['sim/landing'];
  const { stakedEach, stakeShelter } = VB['sim/building'];
  // @state farmstead.camp: absent on a farm not landed by hand; true while nothing stands on the farm of a settler who plans by hand (the
  //   solo start with `hand`: its household sleeps under the open sky, sim/building roofless), false once its shelter stands (VB-1666; in a
  //   save before it, its booth beside the house), the cottage not yet planned (VB-1655). Written here only: at the landing (makeCamp) and
  //   when the shelter is raised.
  // @notstock farmstead.camp: land, buildings and their records (fields, meadows, a site's timber)
  // The landing (VB-1658): the farm is a camp, and the village fence the generator laid round its tile (sim/layout finishLand: the solo
  // village encloses its one house) is taken down before anything reads it, its stretches numbered again: nothing of the farm stands
  // until it is placed, and a farm placed in play gets no fence by itself, as a settler's (sim/cottage) gets none.
  const makeCamp = (st, f) => {
    f.camp = true;
    const v = st.villages[f.village],
      kept = v.fence.filter((s) => !s.edges.some((e) => e.tile === f.house)).map((s, i) => ({ ...s, id: i }));
    v.fence = kept; // lint-allow: owner the fence round a camp's landing taken down at seeding (VB-1658)
  };
  // The bound on how far from the landing the farmstead may be placed: the reach of the site's reading.
  const reach = () => LANDING.soilSteps;
  // The booth plan staked by a member of household hh within one step of its house, or null (few plans: a pawn's are its booths). A save
  // before VB-1666 only: a farm's first roof is now its shelter (farmstead.shelter, sim/building).
  function stakedHome(st, hh, f) {
    let out = null;
    stakedEach(st, (p) => {
      if (out === null && st.pawns[p.holder.id].household === hh.id && hexSteps(st.w, p.tile, f.house) <= 1) out = p;
    });
    return out;
  }
  const raisedHome = (st, hh, f) => st.booths.some((b) => b.by === hh.id && hexSteps(st.w, b.tile, f.house) <= 1);
  // The household and farm of pawn id, or a reason.
  function homeOf(st, id) {
    const p = st.pawns[id],
      hh = p && p.household !== null ? st.households[p.household] : null;
    if (!hh || hh.dissolved || hh.farmstead === null) return `pawn ${id} has no household`;
    return { hh, f: st.farmsteads[hh.farmstead] };
  }
  // Why pawn id cannot place its household's farmstead now, whatever the tile, or null: the head of a household with a camp, no shelter begun.
  function campWhy(st, id) {
    const h = homeOf(st, id);
    if (typeof h === 'string') return h;
    if (h.hh.holder !== id) return 'only the head of the household places its farmstead';
    if (h.f.camp !== true) return 'there is no camp: the farmstead stands';
    if (h.f.shelter || stakedHome(st, h.hh, h.f)) return 'the farmstead is placed: its shelter is begun';
    return null;
  }
  // Why the house of pawn id's camp cannot stand on `tile`, or null: ground, not water or a river, not in use, no trees, nobody else's,
  // reachable on foot from the camp (one walkable component, sim/walking partOf: one lookup a tile; VB-1667, Kim, 24 Nov 2026: "They
  // should be unrestricted (but it will be more difficult to survive of course)"); the shelter stands on the tile itself (VB-1666).
  function tileWhy(st, id, tile) {
    const w = st.w,
      { f } = homeOf(st, id);
    if (!(Number.isInteger(tile) && tile >= 0 && tile < w.N)) return `there is no tile ${tile}`;
    if (w.water[tile]) return 'that is water';
    if (w.river[tile]) return 'a river runs there';
    if (tile !== f.house && st.used.has(tile)) return `tile ${tile} is in use`;
    if (w.trees[tile] > 0) return `trees stand on tile ${tile}`;
    if (tile !== f.house && !freeFor(st, tile, f.village)) return `tile ${tile} is owned or claimed by another`;
    if (partOf(w, tile) < 0 || partOf(w, tile) !== partOf(w, f.house))
      return `tile ${tile} is not reachable on foot from the camp`;
    return null;
  }
  // The house of household hh's farm f is moved to `tile`, and what follows the house with it: the tile in use and its owner (the landing
  // given back to nobody), the ground's mark, the travel cost, the herds' home tile, the farm's water (found again where found already).
  function moveHouse(st, hh, f, tile) {
    const old = f.house,
      walk = wayHours(st, old, tile);
    leaveLanding(st, hh, f, old, walk);
    st.used.delete(old);
    st.used.add(tile);
    st.w.dev[old] = 0;
    st.w.dev[tile] = 3;
    setOwner(st, old, null);
    setOwner(st, tile, { type: 'household', id: hh.id });
    f.house = tile; // lint-allow: owner the farm placed from its camp (VB-1655)
    clearGate(st.w, old);
    faceGate(st.w, tile, f.village === null ? -1 : st.villages[f.village].center); // VB-1951
    costChanged(st, old);
    costChanged(st, tile);
    woodTaken(st, tile);
    for (const id of hh.herds) st.herds[id].home = homeTile(st, f);
    if (f.water) Water.find(st, f);
    emit(st, 'houseMoved', { f, from: old, walk }); // a lone farm's village follows its house (sim/green)
    st.visualDirty = true;
  }
  // ---- the move (VB-1667): nothing teleports ----
  // What household hh holds stays at the landing `tile` when its house moves, as loads to fetch, each marked `moving` (its delivery puts it
  // back as it was, sim/building's leftGrain and leftTimber, sim/meadows' hay): its grain by crop but for one back load the head carries
  // to the new house (TRAVEL.load: the first night is not foodless), its firewood, its hay; its carts stand there (`kept`, with a lying
  // leftCart each: not lost at the frost; sim/carts, on 'houseMoved', and sim/lying); its herds stand there (sim/droving leaveAt: herd.tile; its owner has
  // a farm, so the frost does not take them). The loads are lost at the frost as any load left lying (sim/lying).
  // Each load's `of` also keeps `walk`, the hours of the way from the landing to the new house (wayHours, once at the move), which the
  // farmstead goal reckons its trips by (VB-1670).
  // The walking hours of the way from tile a to tile b, by the route a pawn takes (sim/routes findRoute at the costs in force, unladen;
  // VB-1670: the hex steps at a meadow's pace had reckoned a quarter of it on the tiny map's shore); the steps at SPEED with no route.
  // The way from the landing `a` to the site `b`, as it is once the house has left the landing: by no gate of the house there (VB-1951).
  function wayHours(st, a, b) {
    if (a === b) return 0;
    const p = sansGate(st.w, a, () => findRoute(st.w, a, b, Infinity));
    return p ? routeCost(st.w, p) / SPEED : stepsTo(st.w, a, b, st.w.N, walkable(st.w)) / SPEED;
  }
  function leaveLanding(st, hh, f, tile, walk) {
    const owner = { type: 'household', id: hh.id },
      grain = Stores.grainOf(hh) - Math.min(TRAVEL.load, Stores.grainOf(hh)),
      moving = { moving: true, walk };
    if (grain > 1e-9) {
      const parts = {},
        n = Stores.take(st, hh, 'grain', grain, 'moving', parts);
      Lying.leave(st, 'leftGrain', n, tile, owner, { of: { ...moving, parts } });
    }
    if (hh.wood > 1e-9) {
      const n = Stores.take(st, hh, 'wood', hh.wood, 'moving');
      Lying.leave(st, 'leftTimber', (n / ECON.woodPerTrip) * TRAVEL.load, tile, owner, { of: { ...moving } });
    }
    if (hh.hay > 1e-9) {
      Lying.leave(st, 'hay', hh.hay / TRAVEL.hay, tile, owner, { of: { ...moving } });
      hh.hay = 0; // lint-allow: owner the hay left lying at the landing, fetched back (VB-1667), as sim/droving's leaveHay
    }
    leaveAt(st, hh, tile); // its carts: sim/carts hears the house moved
  }
  // What household hh's things standing at the landing are, for the farmstead goal's steps (moveSteps) and the page's drawing:
  // {herds (ids standing at a tile, herd.tile), carts (the lying leftCart loads), loads (the other lying loads marked moving)}.
  function leftAt(st, hh) {
    const out = { herds: [], carts: [], loads: [] };
    for (const id of st.herdsAway || []) {
      const hd = st.herds[id];
      if (hd.household === hh.id && hd.tile !== undefined) out.herds.push(id);
    }
    for (const l of st.lying || [])
      if (l.owner.type === 'household' && l.owner.id === hh.id && l.of.moving)
        (l.kind === 'leftCart' ? out.carts : out.loads).push(l);
    return out;
  }
  // ---- the move's trips (VB-1670): one reckoning for the page's callout (moveCost) and the farmstead goal's steps (moveSteps) ----
  // A load of `n` (its kind's load units) on a carrier of `cap` load units takes ceil(n / cap) trips; hay by the rule of every load of hay
  // (sim/meadows hayLoad, sim/doing cap): TRAVEL.hay of hay a unit of load, at most TRAVEL.hayCart a trip.
  const capOf = (cap, hay) => (hay ? Math.min(cap, TRAVEL.hayCart / TRAVEL.hay) : cap);
  const tripsOf = (n, cap, hay) => Math.ceil(n / capOf(cap, hay) - 1e-9);
  // The carrier a household's loads go on: its best cart ('ox', 'hand') or the back; its load (units) and its laden pace.
  const carrierOf = (hh) => (hh.carts.some((c) => c.kind === 'ox') ? 'ox' : hh.carts.length ? 'hand' : 'back');
  const capOfCarrier = (k) => TRAVEL[k === 'ox' ? 'cart' : k === 'hand' ? 'hand' : 'load'];
  // One trip of the move over `walk` hours of way: {go (the walk there, at `out`), lift (its hours at the landing), back (the walk home at
  // `pace`)}. A herd is haltered (HERD_LIFT, sim/droving's kind's hours) and led home at the pawn's own pace; a cart fetched comes home
  // unladen (VB-1667 brings no load on it), on the back's pace (it is led as a load is carried, sim/carts leftCart); a load is taken up at
  // once (the stray method's `load`, VB-1814), on the cart that walks out at its pace, laden or not (sim/carts pace).
  const HERD_LIFT = 0.5;
  const tripOf = (walk, lift, pace, out = 1) => ({ go: walk / out, lift, back: walk / pace });
  // The trips of a move: herds (driven, sim/droving), carts (fetched, sim/carts), and the loads [{n, hay}] on `carrier`, in the order the
  // farmstead chain takes them: [{kind, trips: [{go, lift, back}]}], the kinds its steps (moveSteps).
  function moveTrips(walk, herds, carts, loads, carrier) {
    const cap = capOfCarrier(carrier),
      pace = TRAVEL.pace[carrier],
      out = [],
      add = (kind, n, lift, p, o) => {
        if (n > 0) out.push({ kind, trips: Array.from({ length: n }, () => tripOf(walk, lift, p, o)) });
      };
    add('drove', herds, HERD_LIFT, 1);
    add('leftCart', carts, 0, TRAVEL.pace.back);
    for (const l of loads) add(l.kind, tripsOf(l.n, cap, l.hay), 0, pace, carrier === 'back' ? 1 : pace);
    return out;
  }
  const hoursOf = (steps) => steps.reduce((s, x) => s + x.trips.reduce((u, t) => u + t.go + t.lift + t.back, 0), 0);
  // Sim.moveCost(st, pawn, tile) (VB-1667): what placing the farmstead of the head `id` (the page asks for the played pawn) on `tile`
  // costs in carrying and droving: {steps (walking steps from the landing), trips: {cart, back} (the loads' trips on the household's
  // best cart, 0 with none, and on the back), hours (the work of the move: each trip's walks by the route, wayHours, and its
  // lifting, moveTrips; the first from the landing, where the head stands at the camp), frost (whether that work, one hand's
  // working days from now, ends after the frost the head expects (`frost`, its autumn day, sim/reasons frostExpected: the caller's),
  // when the loads left lying are lost)}; null where it cannot be placed by that pawn. Plain data; writes nothing (one route search,
  // findRoute, outside the route cache).
  function moveCost(st, id, tile, frost) {
    if (placeWhy(st, id, 'farmstead', tile) !== null) return null;
    const { hh, f } = homeOf(st, id),
      steps = tile === f.house ? 0 : stepsTo(st.w, f.house, tile, st.w.N, walkable(st.w));
    if (!steps) return { steps, trips: { cart: 0, back: 0 }, hours: 0, frost: false };
    const grain = Stores.grainOf(hh) - Math.min(TRAVEL.load, Stores.grainOf(hh)),
      loads = [
        { kind: 'leftGrain', n: grain, hay: false },
        { kind: 'leftHay', n: hh.hay / TRAVEL.hay, hay: true },
        { kind: 'leftTimber', n: (hh.wood / ECON.woodPerTrip) * TRAVEL.load, hay: false },
      ].filter((l) => l.n > 1e-9),
      carrier = carrierOf(hh),
      count = (k) => loads.reduce((s, l) => s + tripsOf(l.n, capOfCarrier(k), l.hay), 0),
      m = moveTrips(wayHours(st, f.house, tile), hh.herds.length, hh.carts.length, loads, carrier);
    if (m.length) m[0].trips[0].go = 0; // the head stands at the landing
    const hours = hoursOf(m),
      y = Math.floor(st.t / YEAR) * YEAR,
      next = frostAt(y, frost) >= st.t ? frostAt(y, frost) : frostAt(y + YEAR, frost),
      ends = st.t + (hours / (WORK[1] - WORK[0])) * DAY;
    return {
      steps,
      trips: { cart: carrier === 'back' ? 0 : count(carrier), back: count('back') },
      hours: Math.round(hours * 10) / 10,
      frost: ends > next,
    };
  }
  // The game hour the frost on autumn day `frost` of the year that begins at `y` takes the loads left lying: that day's first step
  // (sim/clock runs sim/lying's frost then). VB-1670: the chain's deadline had read the end of that day's work, after they were lost.
  const frostAt = (y, frost) => y + (2 * SEASON_DAYS + frost) * DAY;
  // placeFarmstead(tile) (VB-1655): the head of a household with a camp places its farmstead on `tile`: the house moved there if it is not
  // the landing's, and its shelter begun on that tile (VB-1666; sim/building stakeShelter), which its household then raises.
  register('placeFarmstead', {
    check: (st, c) => living(st, c.actor) || campWhy(st, c.actor) || tileWhy(st, c.actor, c.target),
    run: (st, c) => {
      const { hh, f } = homeOf(st, c.actor);
      if (c.target !== f.house) moveHouse(st, hh, f, c.target);
      stakeShelter(st, f);
    },
  });
  // The shelter on a camp's house tile is raised (VB-1666): the camp is over, its household sleeps under it.
  on('shelterRaised', (st, f) => {
    if (f.camp === true) f.camp = false;
  });
  // A save before VB-1666: the booth beside a camp's house is raised: the camp is over, its household sleeps under the booth.
  on('boothRaised', (st, b) => {
    const hh = b.by === null || b.by === undefined ? null : st.households[b.by],
      f = hh && hh.farmstead !== null ? st.farmsteads[hh.farmstead] : null;
    if (f && f.camp === true && hexSteps(st.w, b.tile, f.house) <= 1) f.camp = false;
  });
  // What stands for the farmstead goal of household hid at `tile` (GOALS.farmstead), or null: {f, camp: true} while its
  // camp has no shelter begun (any tile, its placing to come); at its house's tile {f, shelter} (farmstead.shelter being raised) or {f,
  // raised: true} once it stands; in a save before VB-1666, {f, staked} (the booth plan) or {f, raised: true} beside it.
  function campAt(st, hid, tile) {
    const hh = st.households[hid],
      f = hh.farmstead === null ? null : st.farmsteads[hh.farmstead];
    if (!f || f.camp === undefined || f.household !== hid) return null;
    const staked = stakedHome(st, hh, f);
    if (f.camp === true && !staked && !f.shelter) return { f, camp: true };
    if (f.house !== tile) return null;
    if (f.shelter) return f.shelter.built === null ? { f, shelter: f.shelter } : { f, raised: true };
    if (staked) return { f, staked };
    return raisedHome(st, hh, f) ? { f, raised: true } : null;
  }
  // ---- the head's own rule (VB-1658): a camp left to itself places its farmstead ----
  // The tile the head of household hh places its camp's farmstead on by its own rule, or -1: the tile of the played head's farmstead task
  // if it has one that takes it, else the landing, else the nearest that takes it within reach() steps' walk (bfs order).
  function ownTile(st, hh, f) {
    const id = hh.holder,
      pp = id === null ? null : planOf(st, id),
      t = pp ? pp.tasks.find((k) => k.key === undefined && k.kind === 'farmstead') : null;
    if (t && tileWhy(st, id, t.site) === null) return t.site;
    if (tileWhy(st, id, f.house) === null) return f.house;
    for (const [u] of bfs(st.w, f.house, reach(), walkable(st.w)).dist) if (tileWhy(st, id, u) === null) return u;
    return -1;
  }
  // The head of household hh, whose farm f is a camp with no shelter begun, places the farmstead by its own rule (the verb, as a player
  // would): with automatic behaviour on, or a head not played (the caller asks sim/projects heldOff). Whether it was placed.
  function placeOwn(st, hh, f) {
    if (hh.holder === null || campWhy(st, hh.holder) !== null) return false;
    const tile = ownTile(st, hh, f);
    return tile >= 0 && issue(st, { actor: hh.holder, verb: 'placeFarmstead', target: tile, source: 'pawn' }) === true;
  }
  // ---- the build menu (VB-1655): what the played head may build now, a registry later rungs add to ----
  // Each: why the played pawn cannot build it now whatever the tile (`why`), why not on `tile` (`tile`), its raising's hours and its timber
  // (loads).
  // Pawn id's own plan (sim/steps, VB-1754), or null.
  const planned = (st, id, what) => !!(planOf(st, id) && planOf(st, id).tasks.some((t) => t.kind === what));
  const BUILDS = {
    farmstead: {
      why: (st, id) => campWhy(st, id) || (planned(st, id, 'farmstead') ? 'the farmstead is planned already' : null),
      tile: tileWhy,
      hours: BOOTH.hours,
      timber: BOOTH.wood,
    },
  };
  // The build menu: [{what, ok, why, hours, timber}] for pawn id; [] when it is no pawn (Sim.buildMenu(st, pawn) adds each entry's
  // `work`, sim/agenda). Reads only.
  function buildMenu(st, id) {
    if (!Number.isInteger(id) || !st.pawns[id]) return [];
    const dead = living(st, id);
    return Object.keys(BUILDS).map((what) => {
      const B = BUILDS[what],
        why = dead || B.why(st, id);
      return { what, ok: why === null, why, hours: B.hours, timber: B.timber };
    });
  }
  // Sim.placeWhy(st, pawn, what, tile): null, or why `tile` will not take `what` for pawn id now (the page asks for the played pawn;
  // VB-1753: keyed by pawn, as the farmstead task's check of any controller is). Reads only.
  function placeWhy(st, id, what, tile) {
    const B = BUILDS[what];
    if (!B) return `there is nothing called ${what} to build`;
    if (!Number.isInteger(id) || !st.pawns[id]) return `there is no pawn ${id}`;
    return living(st, id) || B.why(st, id) || B.tile(st, id, tile);
  }
  // ---- the goal (VB-1777): the first shelter, placed from the camp and raised (VB-1655), a task at a tile carried by its kinds' methods
  // (sim/kinds GOALS joins it) ----
  // On a camp the head places the farmstead by its own verb (`act`: placeFarmstead, the house moved to the tile and its shelter begun
  // there, VB-1666); then the shelter's timber trips, whose jobs stand at the wood (`keys`: found by their keys, not at the tile), and its
  // raising on the house tile. It leaves when the shelter stands ('raised'), or when nothing of the camp's stands for it ('gone'). A save
  // before VB-1666 may hold a booth staked beside the house instead (`staked`): its trips and raising, as before.
  const trips = (lack) => Math.max(1, Math.ceil(lack / ECON.woodPerTrip - 1e-9));
  // VB-1667: placed off the landing, the move goes first, as steps found by their keys: each herd standing at the landing driven to the new
  // house (drove), each cart standing there fetched with its team, then each load left there fetched (its trips: on the household's best
  // cart once fetched, else on the back); a step's job is posted at the household's review (sim/droving, sim/lying bringWork: a goal of
  // each kind of the goods left, VB-1814). Its trips are not left for the sleeping hours (`whole`, sim/controller's feeder; VB-1670).
  const MOVE_KINDS = ['drove', 'leftCart', 'leftGrain', 'leftHay', 'leftTimber'];
  // VB-1670: each step's trips are moveTrips, the reckoning of the page's Sim.moveCost: `trip` {go, lift, back} one trip's hours (the
  // walks by the way's route hours kept with the loads, `of.walk`), `hours` their sum, `n` the trips, the loads' on the carrier the
  // household has now (a cart standing at the landing reckoned home: it is fetched first).
  function moveSteps(st, hid) {
    const hh = st.households[hid],
      { herds, carts, loads } = leftAt(st, hh),
      out = [];
    if (!herds.length && !carts.length && !loads.length) return out;
    const any = carts[0] || loads[0],
      walk = any && any.of.walk !== undefined ? any.of.walk : moveWalk(st, hh, herds, any),
      keys = { drove: herds.map((id) => `drove:H${id}`), leftCart: carts.length ? [`leftCart:h${hid}`] : [] },
      ls = MOVE_KINDS.slice(2).map((k) => ({ kind: k, of: loads.filter((l) => Lying.BRING[l.kind] === k) }));
    for (const x of ls) keys[x.kind] = x.of.length ? [`${x.kind}:h${hid}`] : [];
    const m = moveTrips(
      walk,
      herds.length,
      carts.length,
      ls.map((x) => ({ kind: x.kind, n: x.of.reduce((s, l) => s + l.n, 0), hay: x.kind === 'leftHay' })),
      carrierOf(hh),
    );
    for (const x of m) {
      const t = x.trips[0];
      out.push({
        kind: x.kind,
        hours: t.go + t.lift + t.back,
        trip: t,
        n: x.trips.length,
        from: -Infinity,
        keys: keys[x.kind],
      });
    }
    return out;
  }
  // The walking hours from the landing to the house for a move whose loads keep no `walk` (a save before VB-1670): its steps at SPEED.
  function moveWalk(st, hh, herds, l) {
    const from = l ? l.tile : st.herds[herds[0]].tile,
      to = st.farmsteads[hh.farmstead].house;
    return hexSteps(st.w, from, to) / SPEED;
  }
  const farmstead = {
    noun: 'farmstead',
    mark: null,
    kinds: ['timber', 'shelter', 'booth', ...MOVE_KINDS],
    which: ['raised', 'gone'],
    whole: MOVE_KINDS,
    at: (st, hid, tile) => campAt(st, hid, tile),
    none: (tile) => `there is no camp to place a farmstead from, nor a farmstead under way at ${tile}`,
    why: (st, where, tile, id) =>
      where.camp ? placeWhy(st, id, 'farmstead', tile) : where.raised ? `the farmstead at ${tile} stands` : null,
    // the timber trips (their hours the kind's: sim/kinds goalSteps) and the raising
    steps: (st, hid, { f, camp, staked, shelter, raised }) => {
      if (shelter || (camp && !staked)) {
        const lack = lacks(shelter || {}, BOOTH.wood),
          raise = { kind: 'shelter', hours: BOOTH.hours, n: 1, from: -Infinity, keys: [`shelter:f${f.id}`] };
        const move = shelter ? moveSteps(st, hid) : [];
        if (!lack) return [...move, raise];
        return [
          ...move,
          { kind: 'timber', n: trips(lack), from: -Infinity, keys: [`timber:f${f.id}`, `timber:f${f.id}b`] },
          raise,
        ];
      }
      if (raised) return moveSteps(st, hid); // VB-1667: the shelter raised before the move was all fetched
      if (!camp && !staked) return [];
      const s = staked && staked.steps[staked.open],
        bid = staked ? staked.booth : null,
        raise = { kind: 'booth', hours: BOOTH.hours, n: 1, from: -Infinity, keys: staked ? [`booth:o${bid}`] : [] };
      if (s && s.kind !== 'timber') return [raise];
      const lack = s ? lacks(s, s.timber) : BOOTH.wood,
        keys = staked ? [`timber:o${bid}`, `timber:o${bid}b`] : [];
      return lack > 0 ? [{ kind: 'timber', n: trips(lack), from: -Infinity, keys }, raise] : [raise];
    },
    gone: (st, where) =>
      where.raised && !(where.f.household !== null && moveSteps(st, where.f.household).length) ? 'raised' : null,
    // VB-1667: while loads of the move lie at the landing, the frost the head expects (`frost`, an autumn day), when they are lost (sim/lying);
    // VB-1670: at the first step of that day, when sim/lying's frost runs (frostAt), not the end of its work
    deadline: (st, hid, where, frost) => {
      if (!where.shelter || frost === null || frost === undefined || !leftAt(st, st.households[hid]).loads.length)
        return null;
      const y = Math.floor(st.t / YEAR) * YEAR,
        t = frostAt(y, frost);
      return { t: t >= st.t ? t : frostAt(y + YEAR, frost), what: 'the frost' };
    },
    act: (st, id, where, tile) =>
      where.camp ? { actor: id, verb: 'placeFarmstead', target: tile, args: null, source: 'player' } : null,
    // the household's rule that holds a step back: the shelter's (or a staked booth's) timber not all fetched, or no wood to fetch it from
    hold: (st, hid, where, y) => {
      if (where.shelter) {
        // VB-1666: the shelter on the house tile, raised once its timber is in; its timber fetched from the village's wood
        if (y.kind === 'shelter' && lacks(where.shelter, BOOTH.wood) > 0) return ['booth'];
        if (y.kind === 'timber' && !st.villages[where.f.village].wood.length) return ['wood'];
      }
      if (where.staked) {
        const s = where.staked.steps[where.staked.open],
          hh = st.households[hid];
        if (y.kind === 'booth' && s && s.kind === 'timber') return ['booth'];
        const v = st.villages[st.farmsteads[hh.farmstead].village];
        if (y.kind === 'timber' && !(st.w.trees[where.staked.tile] > 0) && !v.wood.length) return ['wood'];
      }
      return null;
    },
    // VB-1658: the timber all in, the raising not yet posted: posted at the next ask of the household's review hour (sim/controller
    // nextAsk; VB-1666: the shelter's), a wait with its hour, not work missing. What is raised then, or null.
    due: (where, y) => {
      if (where.shelter) return y.kind === 'shelter' && lacks(where.shelter, BOOTH.wood) === 0 ? 'shelter' : null;
      const s = where.staked && where.staked.steps[where.staked.open];
      return y.kind === 'booth' && !!s && s.kind === 'timber' && lacks(s, s.timber) === 0 ? 'booth' : null;
    },
    // the next step (the move's droving and fetching, the shelter's raising once its timber is in) open but not posted: the plan asks its
    // head now, so that a step does not wait days for the household's planning day (VB-1670: the shelter's raising had waited 34 hours for
    // it on the tiny map); only while the plan's review is not asked already
    ask: (st, hid, task, steps) => {
      const plan = st.plans && st.plans.households.get(hid);
      if (!plan || plan.dirty) return false;
      const s = steps(),
        y = s && !s.where.camp ? s.steps[0] : null;
      return !!(y && !y.job && y.from <= st.t);
    },
  };
  const GOALS = { farmstead };
  return {
    // what it gives the page through the Sim facade (src/sim.js joins the lists, VB-1944)
    PAGE: ['placeWhy'],
    BUILDS,
    GOALS,
    makeCamp,
    campAt,
    campWhy,
    placeWhy,
    buildMenu,
    placeOwn,
    leftAt,
    moveCost,
    moveTrips,
    carrierOf,
    frostAt,
  };
})();
