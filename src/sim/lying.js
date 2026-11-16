// @sys sim/lying: loads lying where their carrier fell (VB-611): a load on its way home whose carrier died on the road, or whose household
// dissolved, is put down where it was, as a lying load the task's owner fetches (a fetch kind for each kind that carries a load) and carries
// home; one nobody fetches rots at the autumn frost, as the stooks and the mown hay do. Writes st.lying; read by sim/kinds (the fetch kinds,
// the rule that posts them) and sim/agents (release lays a load down).
VB['sim/lying'] = (() => {
  const { log, atHousehold } = VB['sim/records'];
  // @state st.lying: absent, or [{id, kind, n, tile, x, y, t, owner, of}]: the loads lying where their carrier was released on the road,
  //   in the order they were put down (id): `kind` the job kind that carried it (haul, hay, wood, wellstone), `n` the load in that kind's
  //   units (a.load), `tile` and `x`, `y` where it lies, `t` the game hour it was put down, `owner` the task's owner ({type, id}: the
  //   household or village it was carried for), `of` what the kind's delivery reads of the task (its field or meadow, farm, village,
  //   common, dest, step, from, and `src`, the task's tile). A small live list (Rules for cost 1): an entry leaves it when its last load
  //   is taken (take) or at the autumn frost (frost), so it holds at most a year's loads put down on the road. Written only here; plain
  //   data, saved (with the sharing of the fields and meadows it names); absent until the first and once empty.
  // @state st.lyingSeq: the last lying load's id (ids are never reused); absent until the first.
  // What a kind's delivery reads of its task, kept with the load.
  const OF = ['field', 'meadow', 'farm', 'village', 'common', 'dest', 'step', 'from'];
  // Pawn a, released on its way home with its load of task j (sim/agents' release), puts the load down at (x, y) on `tile`; `kind` the
  // kind that took it up (a fetch's, the kind it fetches for).
  function lay(st, a, j, kind, tile, x, y) {
    const of = { src: j.src ?? j.site };
    for (const k of OF) if (j[k] !== undefined) of[k] = j[k];
    // the sheaves' crop and the barn entry of their harvest, as they were: the field may be sown anew before they are fetched
    if (j.field) {
      of.crop = j.field.crop;
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
  function leave(st, kind, n, tile, owner) {
    if (!st.lying) st.lying = [];
    st.lyingSeq = (st.lyingSeq || 0) + 1;
    const l = {
      id: st.lyingSeq,
      kind,
      n,
      tile,
      x: st.w.hx[tile] + 7,
      y: st.w.hy[tile] + 16,
      t: st.t,
      owner: { ...owner },
      of: { src: tile },
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
  function fetchKind(kind, K) {
    return {
      verb: 'Picking up a load left lying',
      go: 'Going for a load left lying',
      back: K.back,
      name: 'Fetch a load left lying',
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
        a.load = take(st, j.lying, cap);
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
  // The autumn frost (sim/clock, with the stooks and the mown hay): every load still lying rots where it lies, and the list is empty.
  function frost(st) {
    if (!st.lying) return;
    for (const l of st.lying) {
      const o = l.owner,
        hh = o.type === 'household' ? st.households[o.id] : null;
      const what =
        l.kind === 'haul'
          ? 'sheaves'
          : l.kind === 'hay'
            ? 'hay'
            : l.kind === 'wood'
              ? 'firewood'
              : l.kind === 'leftTimber'
                ? 'timber'
                : 'stone';
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
    delete st.lying;
  }
  return { lay, leave, take, left, fetchKey, fetchKind, fetchWork, frost, LIFT };
})();
