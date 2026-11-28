// @sys sim/lying: loads lying where their carrier fell (VB-611): a load on its way home whose carrier died on the road, or whose household
// dissolved, is put down where it was, as a pile with title the stray method of the owner's goal that uses it fetches (sim/methods;
// the goods with no goal of their own, BRING, VB-1814) and carries home; one nobody fetches loses a share of itself each game day once
// the autumn frost has come, and is gone under its quantum (decay, VB-1910). A good made where the work is done (VB-1748: the catch,
// game, wild food, what is dug, salt, a basket of stone) lies so too, and the yield of a fishing, hunting or gathering trip cut at its
// work (sim/agents cutTrip). Writes st.lying; read by sim/doing
// (the piles of the goals' view), sim/kinds (the rule that posts the goals of BRING) and sim/agents (release lays a load down).
VB['sim/lying'] = (() => {
  const { log, atHousehold } = VB['sim/records'];
  const { TRAVEL, LYING } = VB['sim/rules'];
  const { emit } = VB['sim/events'];
  // @state st.lying: absent, or [{id, kind, n, tile, x, y, t, owner, of}]: the loads lying where their carrier was released on the road,
  //   in the order they were put down (id): `kind` the job kind that carried it (haul, hay, wood, wellstone; VB-1748 the kinds that make
  //   their good where the work is done: fish, rackfish, hunt, gather, dig, boilsalt, pick, quarry), `n` the load in that kind's
  //   units (a.load), `tile` and `x`, `y` where it lies, `t` the game hour it was put down, `owner` the task's owner ({type, id}: the
  //   household or village it was carried for), `of` what the kind's delivery reads of the task (its field or meadow, farm, village,
  //   common, dest, step, from, and `src`, the task's tile). A small live list (Rules for cost 1): an entry leaves it when its last load
  //   is taken (take) or once the frost has worn it under LYING.quantum (decay), so it holds at most a year's loads put down on the
  //   road; its amount `n` falls a day once the frost has come (VB-1910). Written only here; plain data, saved (with the sharing of
  //   the fields and meadows it names); absent until the first and once empty.
  // @state st.lyingSeq: the last lying load's id (ids are never reused); absent until the first.
  // @state st.lyingBy: a cache owned here, derived and not saved (sim/saves DERIVED, built at its first use): the loads lying by owner,
  //   `type:id` to the entries of st.lying it owns, in their order; so a pile of an owner's is found without a scan (VB-1775).
  const keyOf = (o) => `${o.type}:${o.id}`;
  function index(st) {
    if (st.lyingBy) return st.lyingBy;
    st.lyingBy = new Map();
    for (const l of st.lying || []) mine(st, keyOf(l.owner)).push(l);
    return st.lyingBy;
  }
  function mine(st, k) {
    let a = st.lyingBy.get(k);
    if (!a) st.lyingBy.set(k, (a = []));
    return a;
  }
  function add(st, l) {
    index(st); // built before the entry joins the list, so that it is not counted twice
    if (!st.lying) st.lying = [];
    st.lying.push(l);
    mine(st, keyOf(l.owner)).push(l);
    return l;
  }
  // What a kind's delivery reads of its task, kept with the load.
  // `parts` and `moving`: grain left lying (sim/building leftGrain), its crops and whether a house's move carried it (VB-312: a fetcher of
  // it falling on the road left it with no crops, and its delivery failed)
  // `good`: what a basket dug holds (sim/dig: clay, bog ore or peat; VB-1748)
  const OF = [
    'cart',
    'field',
    'meadow',
    'farm',
    'village',
    'common',
    'dest',
    'step',
    'from',
    'parts',
    'moving',
    'good',
    'kept', // a cart its household left at its landing (VB-1667), and the way's hours from there (VB-1670), if it is laid again
    'walk',
  ];
  // Pawn a, released on its way home with its load of task j (sim/agents' release), puts the load down at (x, y) on `tile`; `kind` the
  // kind that took it up (a fetch's, the kind it fetches for).
  function lay(st, a, j, kind, tile, x, y) {
    const of = { src: j.src ?? j.site };
    for (const k of OF) if (j[k] !== undefined) of[k] = j[k];
    // the sheaves' crop and the barn entry of their harvest, as they were: the field may be sown anew before they are fetched
    if (j.field) {
      of.crop = j.crop ?? j.field.crop; // the task's crop: its field may be on its next course (VB-350)
      if (j.field.bin !== undefined) of.bin = j.field.bin;
    }
    st.lyingSeq = (st.lyingSeq || 0) + 1;
    return add(st, { id: st.lyingSeq, kind, n: a.load, tile, x, y, t: st.t, owner: { ...j.owner }, of });
  }
  // Timber carried to a building step at `tile` whose plan is given up (sim/plans' leftWood) is put down where it lies, `n` in a.load's units:
  // a load of the household's, fetched home as firewood (the kind leftTimber, sim/building) or rotting at the frost.
  // `at` {x, y, of}: where it lies, if not the tile's foot, and what its delivery reads (VB-850: the grain of a gift, `of.parts` by crop).
  function leave(st, kind, n, tile, owner, at = {}) {
    st.lyingSeq = (st.lyingSeq || 0) + 1;
    return add(st, {
      id: st.lyingSeq,
      kind,
      n,
      tile,
      x: at.x ?? st.w.hx[tile] + 7,
      y: at.y ?? st.w.hy[tile] + 16,
      t: st.t,
      owner: { ...owner },
      of: { src: tile, ...at.of },
    });
  }
  const byId = (st, id) => (st.lying ? st.lying.find((l) => l.id === id) || null : null);
  const drop = (st, l) => {
    st.lying.splice(st.lying.indexOf(l), 1);
    const o = index(st).get(keyOf(l.owner)),
      i = o ? o.indexOf(l) : -1;
    if (i < 0)
      delete st.lyingBy; // the list was written past the index (a test's state): built again at its next use
    else {
      o.splice(i, 1);
      if (!o.length) st.lyingBy.delete(keyOf(l.owner));
    }
    if (!st.lying.length) delete st.lying;
  };
  // ---- piles with title (design.md section 7, Progress lives in the world; VB-1775): a lying load of kind `kind` is a pile of its
  // owner's at its tile, found through the owner's index, never a scan of the list. `owner` {type, id}.
  const ownedBy = (st, owner) => (st.lying ? index(st).get(keyOf(owner)) : undefined);
  function pileAt(st, tile, kind, owner) {
    const o = ownedBy(st, owner);
    if (o) for (let i = 0; i < o.length; i++) if (o[i].tile === tile && o[i].kind === kind) return o[i];
    return null;
  }
  const amountAt = (st, tile, kind, owner) => {
    const l = pileAt(st, tile, kind, owner);
    return l ? l.n : 0;
  };
  // The tile of a pile of the owner's of kind `kind` lying at neither tile a nor b (the stray method, sim/methods), or null.
  // A pile kept for a task planned at its tile is no stray (VB-1931: the timber a cutting is planned on, sim/chores), by the rules the
  // domains give (keep(fn), fn(st, l) true for a pile kept), read only for a pile otherwise taken up.
  const KEPT = [];
  const keep = (fn) => KEPT.push(fn);
  const kept = (st, l) => KEPT.some((fn) => fn(st, l));
  function strayOf(st, owner, kind, a, b) {
    const o = ownedBy(st, owner);
    if (o)
      for (let i = 0; i < o.length; i++)
        if (o[i].kind === kind && o[i].tile !== a && o[i].tile !== b && !kept(st, o[i])) return o[i].tile;
    return null;
  }
  // `n` of the owner's put down at `tile`: on the pile already there, or a new one (at {x, y, of} as `leave`).
  function put(st, kind, n, tile, owner, at = {}) {
    const l = pileAt(st, tile, kind, owner);
    if (!l) return leave(st, kind, n, tile, owner, at);
    l.n += n;
    return l;
  }
  VB.counter(
    'lyingAt',
    'Loads lying read for the timber at a tile a firewood task names off the house, at each read of the task (sim/lying pilesAt; VB-1931)',
  );
  // The loads lying at `tile`, whoever owns them (VB-1931: the timber a household may cut there, its own or nobody's, sim/chores): a read
  // of the small live list, for a tile a played pawn names; the index by owner cannot say what lies of an owner not known.
  function pilesAt(st, tile) {
    const out = [];
    for (const l of st.lying || []) {
      VB.count.lyingAt++;
      if (l.tile === tile) out.push(l);
    }
    return out;
  }
  // At most `cap` taken up from the owner's pile of kind `kind` at `tile`: what was taken.
  function takeAt(st, tile, kind, owner, cap) {
    const l = pileAt(st, tile, kind, owner);
    return l ? takeFrom(st, l, cap) : 0;
  }
  // A load of at most `cap` is taken up from lying load `id`: what was taken (0 when it is gone); the load leaves the list with its last.
  function take(st, id, cap) {
    const l = byId(st, id);
    return l ? takeFrom(st, l, cap) : 0;
  }
  // At most `cap` taken up from lying entry l (found by its owner's index, not by id: VB-1775); it leaves the list with its last.
  function takeFrom(st, l, cap) {
    const n = Math.min(cap, l.n);
    l.n -= n;
    if (l.n <= 1e-9) drop(st, l);
    return n;
  }
  const left = (st, id) => {
    const l = byId(st, id);
    return l ? l.n : 0;
  };
  // What a load of each kind is, in the words the player reads (VB-1670: named by what they bring, not all "a load"); the frost's log
  // line names it the same.
  const WHAT = {
    haul: 'sheaves',
    hay: 'hay',
    wood: 'timber',
    leftTimber: 'timber',
    cutpile: 'firewood', // cut where timber lay, on its way to the woodpile (sim/chores cutpile, VB-1931)
    timber: 'timber', // the building's, cut on its way to the site (VB-1812)
    leftGrain: 'grain',
    wellstone: 'stone',
    // the goods made where the work is done (VB-1748)
    // named by what they are, not by the kind that made them (VB-1813): a pile of stone is found by any goal that uses stone
    fish: 'fish',
    game: 'game',
    wild: 'wild food',
    earth: 'dug earth',
    salt: 'salt',
    stone: 'stone',
  };
  const whatOf = (kind) => (kind === 'leftCart' ? 'cart' : WHAT[kind] || 'goods');
  // ---- the goods left lying with no goal of their own (VB-1814; design.md section 7, A stray pile) ----
  // The goal that brings each home, by the kind it lies as: the timber and the grain left lying (sim/building), a cart left standing
  // (sim/carts), the hay (sim/meadows leftHay: the hay goal takes it up too while its meadow is mown). Each is a goal with the stray method
  // alone (sim/methods bring), one an owner, posted at the owner's review while a pile of its lies; the piles themselves are found by
  // the owner's index (Nothing searches) at each leg. Every other pile is the stray of the goal of the kind it lies as.
  const BRING = { leftCart: 'leftCart', leftGrain: 'leftGrain', leftTimber: 'leftTimber', hay: 'leftHay' },
    BRUNG = Object.keys(BRING);
  // The review's rule (sim/kinds' ASK, at the farm and the village): one goal of each kind of BRING for the piles of it the holder owns,
  // at the tile of the first (`h` a household's key, `v` a village's).
  function bringWork(st, holder, at, c, post) {
    const owner = { type: holder.farmstead === undefined ? 'village' : 'household', id: holder.id },
      o = ownedBy(st, owner);
    if (!o) return;
    let seen = 0;
    for (const l of o) {
      const k = BRING[l.kind],
        bit = k ? 1 << BRUNG.indexOf(l.kind) : 0;
      if (!k || seen & bit || kept(st, l)) continue;
      seen |= bit;
      post(`${k}:${owner.type[0]}${owner.id}`, l.tile, {}, k, owner);
    }
  }
  // ---- what lies out degrades (VB-1910; design.md, Goods and the farming year, Risk): a share of its amount each game day once the
  // year's frost has come, and the pile is gone under LYING.quantum; nothing on the load but its amount. The wet day's share waits for a
  // wet day in the sim (VB-2000). ----
  // One quantity, one reckoning: what `n` lying out loses over `days` game days after the frost; all of it once what is left is under
  // the quantum. The day's loss (decay) and a head's estimate of it (sim/outlook) are both this; so are the stooks' in the field and the
  // mown hay's on the meadow (sim/fields stooksDecay, sim/meadows hayDecay; VB-2001), in the same units (rations; hay by TRAVEL.hay).
  function lossOver(n, days) {
    if (!(days > 0) || !(n > 0)) return 0;
    const rest = n * (1 - LYING.frostLoss) ** days;
    return rest < LYING.quantum ? n : n - rest;
  }
  // A lying load's loss in its owner's store, as the stores book spoilage (event lyingSpoilt): the good, and its units a unit of load
  // (the sheaves and grain in rations, the hay at TRAVEL.hay). The other goods lying are in no store's units, and are not booked.
  const SPOILS = { haul: ['grain', 1], leftGrain: ['grain', 1], hay: ['hay', TRAVEL.hay] };
  VB.counter(
    'lyingDecay',
    "Loads lying out read by the day's decay, each day from the autumn frost to the year's end while any lies (sim/lying decay; VB-1910)",
  );
  // The game day's loss once the frost has come (sim/clock, each day from the frost's to the year's end; `days` over one: so many days at
  // once, as a test passing over them): each load but a cart left standing loses lossOver of its amount, booked as spoilage; one worn
  // under its quantum is lost, and told as the frost's.
  function decay(st, days = 1) {
    if (!st.lying) return;
    for (const l of st.lying.slice()) {
      VB.count.lyingDecay++;
      if (l.kind === 'leftCart') continue;
      const lost = lossOver(l.n, days),
        sp = SPOILS[l.kind];
      if (sp && lost > 0) emit(st, 'lyingSpoilt', { owner: l.owner, good: sp[0], n: lost * sp[1] });
      if (lost < l.n - 1e-9) l.n -= lost;
      else {
        drop(st, l);
        lostTold(st, l);
      }
    }
  }
  // The line for a load the frost has taken: named by its owner's farm, by the farm its household held, or by its village.
  function lostTold(st, l) {
    const o = l.owner,
      hh = o.type === 'household' ? st.households[o.id] : null,
      what = whatOf(l.kind);
    if (hh && !hh.dissolved)
      log(st, `A load of ${what} left lying for ${st.farmsteads[hh.farmstead].name} was lost to the frost.`, {
        kind: 'frost',
        ...atHousehold(st, hh),
      });
    else if (hh && hh.farmstead !== null && st.farmsteads[hh.farmstead]) {
      // its household gone: the place is named, the farm it held
      const f = st.farmsteads[hh.farmstead];
      log(st, `A load of ${what} left lying for ${f.name}, whose household is gone, was lost to the frost.`, {
        kind: 'frost',
        farm: f.id,
        village: f.village,
      });
    } else if (o.type === 'village' && st.villages[o.id])
      log(st, `A load of ${what} left lying for ${st.villages[o.id].name} was lost to the frost.`, {
        kind: 'frost',
        village: o.id,
      });
  }
  // The autumn frost (sim/clock): a cart left standing goes from the list, but one its household left at the landing when its house moved
  // (`of.kept`, VB-1667; sim/carts' frost keeps that one too, and names the one it loses, VB-649). What else lies, decay wears from today.
  function frost(st) {
    if (!st.lying) return;
    for (const l of st.lying.slice()) if (l.kind === 'leftCart' && !l.of.kept) drop(st, l);
  }
  // What lies out of `owner`'s that is booked as `good` (SPOILS), in its store's units: {n, lost}, `lost` what lossOver takes of it over
  // `days` game days after the frost, all of it reckoned as the day's decay reckons it (a head's estimate, sim/outlook: its own goods,
  // the days its own reckoning of the frost gives).
  function lyingOut(st, owner, good, days) {
    let n = 0,
      lost = 0;
    for (const l of ownedBy(st, owner) || []) {
      const sp = SPOILS[l.kind];
      if (!sp || sp[0] !== good) continue;
      n += l.n * sp[1];
      lost += lossOver(l.n, days) * sp[1];
    }
    return { n, lost };
  }
  return {
    lay,
    leave,
    take,
    left,
    BRING,
    bringWork,
    ownedPiles: ownedBy,
    pilesAt,
    keep,
    takeFrom,
    frost,
    decay,
    lossOver,
    lyingOut,
    pileAt,
    amountAt,
    strayOf,
    put,
    takeAt,
  };
})();
