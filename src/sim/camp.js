// @sys sim/camp: the camp of a settler who plans by hand (VB-1627; Kim, 24 Nov 2026: "land first, place from the menu"): the farm kept on
//   the landing tile with nothing on it, roofless (sim/building roofless), until its head places the farmstead (the verb `placeFarmstead`:
//   the house moved to the tile chosen within LANDING.soilSteps of the landing, the shelter begun on it, VB-1638) and its shelter stands; what the
//   played head may build now (the build menu, a registry) and why a tile will not take it; a camp left to itself placed by its head's
//   own rule (placeOwn, VB-1630)
VB['sim/camp'] = (() => {
  const { register, issue } = VB['sim/commands'];
  const { living } = VB['sim/records'];
  const { on } = VB['sim/events'];
  const { bfs, hexSteps } = VB['sim/hex'];
  const { walkable } = VB['sim/walking'];
  const { setOwner } = VB['sim/ownership'];
  const { freeFor, woodTaken } = VB['sim/territory'];
  const { costChanged } = VB['sim/routes'];
  const { homeTile } = VB['sim/herds'];
  const Water = VB['sim/water'];
  const { BOOTH } = VB['sim/rules'];
  const { LANDING } = VB['sim/landing'];
  const { stakedEach, stakeShelter } = VB['sim/building'];
  // @state farmstead.camp: absent on a farm not landed by hand; true while nothing stands on the farm of a settler who plans by hand (the
  //   solo start with `hand`: its household sleeps under the open sky, sim/building roofless), false once its shelter stands (VB-1638; in a
  //   save before it, its booth beside the house), the cottage not yet planned (VB-1627). Written here only: at the landing (makeCamp) and
  //   when the shelter is raised.
  // The landing (VB-1630): the farm is a camp, and the village fence the generator laid round its tile (sim/layout finishLand: the solo
  // village encloses its one house) is taken down before anything reads it, its stretches numbered again: nothing of the farm stands
  // until it is placed, and a farm placed in play gets no fence by itself, as a settler's (sim/cottage) gets none.
  const makeCamp = (st, f) => {
    f.camp = true;
    const v = st.villages[f.village],
      kept = v.fence.filter((s) => !s.edges.some((e) => e.tile === f.house)).map((s, i) => ({ ...s, id: i }));
    v.fence = kept; // lint-allow: owner the fence round a camp's landing taken down at seeding (VB-1630)
  };
  // The bound on how far from the landing the farmstead may be placed: the reach of the site's reading.
  const reach = () => LANDING.soilSteps;
  // The booth plan staked by a member of household hh within one step of its house, or null (few plans: a pawn's are its booths). A save
  // before VB-1638 only: a farm's first roof is now its shelter (farmstead.shelter, sim/building).
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
  // walked to from the camp within reach() steps (the shelter stands on the tile itself, VB-1638).
  function tileWhy(st, id, tile) {
    const w = st.w,
      { f } = homeOf(st, id);
    if (!(Number.isInteger(tile) && tile >= 0 && tile < w.N)) return `there is no tile ${tile}`;
    if (w.water[tile]) return 'that is water';
    if (w.river[tile]) return 'a river runs there';
    if (tile !== f.house && st.used.has(tile)) return `tile ${tile} is in use`;
    if (w.trees[tile] > 0) return `trees stand on tile ${tile}`;
    if (tile !== f.house && !freeFor(st, tile, f.village)) return `tile ${tile} is owned or claimed by another`;
    const R = reach();
    if (hexSteps(w, f.house, tile) > R) return `tile ${tile} is farther than ${R} steps from the camp`;
    if (!bfs(w, f.house, R, walkable(w)).dist.has(tile))
      return `tile ${tile} is not within ${R} steps' walk of the camp`;
    return null;
  }
  // The house of household hh's farm f is moved to `tile`, and what follows the house with it: the tile in use and its owner (the landing
  // given back to nobody), the ground's mark, the travel cost, the herds' home tile, the farm's water (found again where found already).
  function moveHouse(st, hh, f, tile) {
    const old = f.house;
    st.used.delete(old);
    st.used.add(tile);
    st.w.dev[old] = 0;
    st.w.dev[tile] = 3;
    setOwner(st, old, null);
    setOwner(st, tile, { type: 'household', id: hh.id });
    f.house = tile; // lint-allow: owner the farm placed from its camp (VB-1627)
    costChanged(st, old);
    costChanged(st, tile);
    woodTaken(st, tile);
    for (const id of hh.herds) st.herds[id].home = homeTile(st, f);
    if (f.water) Water.find(st, f);
    st.visualDirty = true;
  }
  // placeFarmstead(tile) (VB-1627): the head of a household with a camp places its farmstead on `tile`: the house moved there if it is not
  // the landing's, and its shelter begun on that tile (VB-1638; sim/building stakeShelter), which its household then raises.
  register('placeFarmstead', {
    check: (st, c) => living(st, c.actor) || campWhy(st, c.actor) || tileWhy(st, c.actor, c.target),
    run: (st, c) => {
      const { hh, f } = homeOf(st, c.actor);
      if (c.target !== f.house) moveHouse(st, hh, f, c.target);
      stakeShelter(st, f);
    },
  });
  // The shelter on a camp's house tile is raised (VB-1638): the camp is over, its household sleeps under it.
  on('shelterRaised', (st, f) => {
    if (f.camp === true) f.camp = false;
  });
  // A save before VB-1638: the booth beside a camp's house is raised: the camp is over, its household sleeps under the booth.
  on('boothRaised', (st, b) => {
    const hh = b.by === null || b.by === undefined ? null : st.households[b.by],
      f = hh && hh.farmstead !== null ? st.farmsteads[hh.farmstead] : null;
    if (f && f.camp === true && hexSteps(st.w, b.tile, f.house) <= 1) f.camp = false;
  });
  // What stands for the farmstead chain of household hid at `tile` (sim/planchains CHAINS.farmstead), or null: {f, camp: true} while its
  // camp has no shelter begun (any tile, its placing to come); at its house's tile {f, shelter} (farmstead.shelter being raised) or {f,
  // raised: true} once it stands; in a save before VB-1638, {f, staked} (the booth plan) or {f, raised: true} beside it.
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
  // ---- the head's own rule (VB-1630): a camp left to itself places its farmstead ----
  // The tile the head of household hh places its camp's farmstead on by its own rule, or -1: the tile of the played head's farmstead task
  // if it has one that takes it, else the landing, else the nearest that takes it within reach() steps' walk (bfs order).
  function ownTile(st, hh, f) {
    const id = hh.holder,
      pl = st.player,
      t = pl && pl.pawn === id && pl.plan ? pl.plan.tasks.find((k) => k.kind === 'farmstead') : null;
    if (t && tileWhy(st, id, t.farmstead) === null) return t.farmstead;
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
  // ---- the build menu (VB-1627): what the played head may build now, a registry later rungs add to ----
  // Each: why the played pawn cannot build it now whatever the tile (`why`), why not on `tile` (`tile`), its raising's hours and its timber
  // (loads).
  const planned = (st, what) => !!(st.player.plan && st.player.plan.tasks.some((t) => t.kind === what));
  const BUILDS = {
    farmstead: {
      why: (st, id) => campWhy(st, id) || (planned(st, 'farmstead') ? 'the farmstead is planned already' : null),
      tile: tileWhy,
      hours: BOOTH.hours,
      timber: BOOTH.wood,
    },
  };
  // The build menu: [{what, ok, why, hours, timber}] for the played pawn; [] with none played (Sim.buildMenu adds each entry's `work`,
  // sim/agenda). Reads only.
  function buildMenu(st) {
    if (!st.player) return [];
    const id = st.player.pawn,
      dead = living(st, id);
    return Object.keys(BUILDS).map((what) => {
      const B = BUILDS[what],
        why = dead || B.why(st, id);
      return { what, ok: why === null, why, hours: B.hours, timber: B.timber };
    });
  }
  // Sim.placeWhy(st, what, tile): null, or why `tile` will not take `what` for the played pawn now. Reads only.
  function placeWhy(st, what, tile) {
    const B = BUILDS[what];
    if (!B) return `there is nothing called ${what} to build`;
    if (!st.player) return 'no pawn is played';
    const id = st.player.pawn;
    return living(st, id) || B.why(st, id) || B.tile(st, id, tile);
  }
  return { BUILDS, makeCamp, campAt, campWhy, placeWhy, buildMenu, placeOwn };
})();
