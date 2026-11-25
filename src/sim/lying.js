// @sys sim/lying: loads lying where their carrier fell (VB-611): a load on its way home whose carrier died on the road, or whose household
// dissolved, is put down where it was, as a lying load the task's owner fetches (a fetch kind for each kind that carries a load) and carries
// home; one nobody fetches rots at the autumn frost, as the stooks and the mown hay do. Writes st.lying; read by sim/kinds (the fetch kinds,
// the rule that posts them) and sim/agents (release lays a load down).
VB['sim/lying'] = (() => {
  const { log, atHousehold } = VB['sim/records'];
  const { TRAVEL } = VB['sim/rules'];
  // @state st.lying: absent, or [{id, kind, n, tile, x, y, t, owner, of}]: the loads lying where their carrier was released on the road,
  //   in the order they were put down (id): `kind` the job kind that carried it (haul, hay, wood, wellstone), `n` the load in that kind's
  //   units (a.load), `tile` and `x`, `y` where it lies, `t` the game hour it was put down, `owner` the task's owner ({type, id}: the
  //   household or village it was carried for), `of` what the kind's delivery reads of the task (its field or meadow, farm, village,
  //   common, dest, step, from, and `src`, the task's tile). A small live list (Rules for cost 1): an entry leaves it when its last load
  //   is taken (take) or at the autumn frost (frost), so it holds at most a year's loads put down on the road. Written only here; plain
  //   data, saved (with the sharing of the fields and meadows it names); absent until the first and once empty.
  // @state st.lyingSeq: the last lying load's id (ids are never reused); absent until the first.
  // What a kind's delivery reads of its task, kept with the load.
  // `parts` and `moving`: grain left lying (sim/building leftGrain), its crops and whether a house's move carried it (VB-312: a fetcher of
  // it falling on the road left it with no crops, and its delivery failed)
  const OF = ['cart', 'field', 'meadow', 'farm', 'village', 'common', 'dest', 'step', 'from', 'parts', 'moving'];
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
    if (!st.lying) st.lying = [];
    st.lyingSeq = (st.lyingSeq || 0) + 1;
    const l = { id: st.lyingSeq, kind, n: a.load, tile, x, y, t: st.t, owner: { ...j.owner }, of };
    st.lying.push(l);
    return l;
  }
  // Timber carried to a building step at `tile` whose plan is given up (sim/plans' leftWood) is put down where it lies, `n` in a.load's units:
  // a load of the household's, fetched home as firewood (the kind leftTimber, sim/building) or rotting at the frost.
  // `at` {x, y, of}: where it lies, if not the tile's foot, and what its delivery reads (VB-850: the grain of a gift, `of.parts` by crop).
  function leave(st, kind, n, tile, owner, at = {}) {
    if (!st.lying) st.lying = [];
    st.lyingSeq = (st.lyingSeq || 0) + 1;
    const l = {
      id: st.lyingSeq,
      kind,
      n,
      tile,
      x: at.x ?? st.w.hx[tile] + 7,
      y: at.y ?? st.w.hy[tile] + 16,
      t: st.t,
      owner: { ...owner },
      of: { src: tile, ...at.of },
    };
    st.lying.push(l);
    return l;
  }
  const byId = (st, id) => (st.lying ? st.lying.find((l) => l.id === id) || null : null);
  const drop = (st, l) => {
    st.lying.splice(st.lying.indexOf(l), 1);
    if (!st.lying.length) delete st.lying;
  };
  // A load of at most `cap` is taken up from lying load `id`: what was taken (0 when it is gone); the load leaves the list with its last.
  function take(st, id, cap) {
    const l = byId(st, id);
    if (!l) return 0;
    const n = Math.min(cap, l.n);
    l.n -= n;
    if (l.n <= 1e-9) drop(st, l);
    return n;
  }
  const left = (st, id) => {
    const l = byId(st, id);
    return l ? l.n : 0;
  };
  const fetchKey = (kind) => 'fetch' + kind[0].toUpperCase() + kind.slice(1);
  // The kind of fetching a load of kind `kind` (record K) left lying: picked up where it lies in LIFT hours (bundled already: sheaves
  // tied, hay raked, logs cut, stone in its basket; a named guess, half an hour), carried as K carries, delivered as K delivers, with the
  // task's tile as it was (a felled tree's, sim/kinds wood).
  const LIFT = 0.5;
  // What a load of each kind is, in the words the player reads (VB-1670: the fetch kinds named by what they bring, not all "a load"); the
  // frost's log line names it the same.
  const WHAT = {
    haul: 'sheaves',
    hay: 'hay',
    wood: 'timber',
    leftTimber: 'timber',
    leftGrain: 'grain',
    wellstone: 'stone',
  };
  const whatOf = (kind) => (kind === 'leftCart' ? 'cart' : WHAT[kind] || 'goods');
  // Hay is taken by the rule of every load of hay (sim/meadows hayLoad): TRAVEL.hay of hay a unit of load, at most TRAVEL.hayCart a load
  // (VB-1670: a cart had taken 300 units, 100 hay, from hay left lying, where a meadow gives it 60).
  const capOf = (kind, cap) => (kind === 'hay' ? Math.min(cap, TRAVEL.hayCart / TRAVEL.hay) : cap);
  function fetchKind(kind, K) {
    const what = whatOf(kind),
      lies = kind === 'leftCart' ? 'left standing' : 'left lying';
    return {
      verb: `Picking up the ${what} ${lies}`,
      go: `Going for the ${what} ${lies}`,
      back: K.back,
      name: `Fetch the ${what} ${lies}`,
      at: ['road'], // where it was left (sim/kinds PLACES; VB-1124)
      needs: [],
      gives: K.gives,
      label: K.label,
      anim: 'gather',
      hours: LIFT,
      hands: 1,
      type: K.type,
      carry: K.carry,
      to: K.to,
      fetch: kind,
      spot: (st, a, j) => [j.x + a.ox * 0.3, j.y + a.oy * 0.3],
      urgency: (st, j, c, U) => U.haul,
      // j.left: what still lies after this load (posted with the whole load), so that the task stays open for the rest
      load: (st, a, j, cap) => {
        a.load = take(st, j.lying, capOf(kind, cap));
        j.left = left(st, j.lying);
        return a.load;
      },
      // taken on the back with more left lying, it counts towards the head's missing carts (sim/carts missed), as a load from the
      // field does: a real carrying need
      again: (j) => j.left > 0,
      deliver: (st, j, hh, f, a) =>
        K.deliver(
          st,
          { ...j, site: j.src, ...(j.field ? { field: { ...j.field, crop: j.crop, bin: j.bin } } : {}) },
          hh,
          f,
          a,
        ),
    };
  }
  // The review's rule (sim/kinds' ASK, at the farm and the village): the loads lying that holder owns, each a task to fetch it.
  function fetchWork(st, holder, at, c, post) {
    if (!st.lying) return;
    const type = holder.farmstead === undefined ? 'village' : 'household';
    for (const l of st.lying)
      if (l.owner.type === type && l.owner.id === holder.id)
        post(`fetch:L${l.id}`, l.tile, { ...l.of, lying: l.id, x: l.x, y: l.y, left: l.n }, fetchKey(l.kind), l.owner);
  }
  // The autumn frost (sim/clock, with the stooks and the mown hay): every load still lying rots where it lies, and the list is empty but for
  // a cart its household left standing at the landing when its house moved (`of.kept`, VB-1667: sim/carts' frost keeps it too).
  function frost(st) {
    if (!st.lying) return;
    const keep = st.lying.filter((l) => l.kind === 'leftCart' && l.of.kept);
    for (const l of st.lying) {
      const o = l.owner,
        hh = o.type === 'household' ? st.households[o.id] : null;
      if (l.kind === 'leftCart') continue; // its cart is gone with it, and named (sim/carts' frost sweep, VB-649)
      const what = whatOf(l.kind);
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
    if (keep.length) st.lying = keep;
    else delete st.lying;
  }
  return { lay, leave, take, left, fetchKey, fetchKind, fetchWork, frost, LIFT };
})();
