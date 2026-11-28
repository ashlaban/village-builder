// @sys sim/scopes [derived]: a scope on the membership graph (VB-043; design.md, One scope model for overlays, stores and trees): an entity level, the
// entities chosen and a dimension, and the pawns, households, villages, tiles and stores it covers; read-only, no state
VB['sim/scopes'] = (() => {
  const { liveFrom, liveTo } = VB['sim/graph'];
  const { childrenOf, kinNear } = VB['sim/records'];
  const { ownedCodes } = VB['sim/ownership'];
  const { FOODS } = VB['sim/rules'],
    { grainOf } = VB['sim/stores'],
    { larderOf } = VB['sim/larder'],
    { owed } = VB['sim/obligations'],
    { dailyNeed, seedReserve } = VB['sim/hunger'];
  const LEVELS = Object.freeze(['pawn', 'family', 'household', 'village', 'culture']);
  const DIMS = Object.freeze(['owns', 'claims', 'uses', 'works', 'kin']);
  // A family: its heads and all their descendants, living and dead (a pawn's children by sim/records' index).
  function descent(st, ids) {
    const out = new Set(ids),
      todo = [...ids];
    while (todo.length)
      for (const c of childrenOf(st, todo.pop()))
        if (!out.has(c)) {
          out.add(c);
          todo.push(c);
        }
    return out;
  }
  const sorted = (s) => [...s].sort((a, b) => a - b);
  // scope {level, ids, dim}: what it covers, {pawns, households, villages, tiles, stores}, each in ascending id (stores: {type, id}). The
  // level chooses the people and bodies: a pawn; a family (its head and descendants); a household (its members); a village (its households
  // by their village edges, and the village itself); a culture (its villages by theirs). The dimension chooses the tiles: owns, the tiles
  // the households and villages own (a title's owner, else the user: sim/ownership); uses, those they work (st.owner); claims, the tiles any of them
  // claims; works, their farms' fields and meadows and the villages' common fields; is kin of (`kin`), none, and the people become their
  // kin: a family's descent, or the near kin of everyone in scope (sim/records kinNear). At most the map's tiles a call: a view's read.
  function inScope(st, { level, ids, dim }) {
    if (!LEVELS.includes(level)) throw new Error(`no level ${level}`);
    if (!DIMS.includes(dim)) throw new Error(`no dimension ${dim}`);
    let pawns = new Set();
    const hhs = new Set(),
      vs = new Set(),
      live = (h) => h !== null && h !== undefined && !st.households[h].dissolved;
    if (level === 'culture') for (const c of ids) for (const k of liveTo(st, 'culture', c)) vs.add(st.edges[k].from);
    if (level === 'village') for (const v of ids) vs.add(v);
    for (const v of vs) for (const k of liveTo(st, 'village', v)) hhs.add(st.edges[k].from);
    if (level === 'household') for (const h of ids) if (live(h)) hhs.add(h);
    for (const h of hhs) for (const m of st.households[h].members) pawns.add(m);
    if (level === 'pawn') for (const id of ids) pawns.add(id);
    if (level === 'family') pawns = descent(st, ids);
    if (dim === 'kin' && level !== 'family')
      for (const id of [...pawns]) if (st.pawns[id].died === null) for (const q of kinNear(st, id)) pawns.add(q);
    if (level === 'pawn' || level === 'family' || dim === 'kin')
      for (const id of pawns) {
        const p = st.pawns[id];
        if (p.died === null && live(p.household)) hhs.add(p.household);
      }
    const tiles = new Set();
    const owned = dim === 'owns' ? ownedCodes(st) : null;
    if (dim === 'owns' || dim === 'uses')
      for (let t = 0; t < st.owner.length; t++) {
        const n = owned && owned.has(t) ? owned.get(t) : st.owner[t];
        if ((n > 0 && hhs.has(n - 1)) || (n < 0 && vs.has(-n - 1))) tiles.add(t);
      }
    if (dim === 'claims') {
      const by = { pawn: pawns, household: hhs, village: vs };
      for (const [t, list] of st.claims)
        if (list.some((c) => by[c.by.type] && by[c.by.type].has(c.by.id))) tiles.add(t);
    }
    if (dim === 'works') {
      for (const h of hhs) {
        const f = st.farmsteads[st.households[h].farmstead];
        for (const fd of f.fields) tiles.add(fd.tile);
        for (const m of f.meadows || []) tiles.add(m.tile);
      }
      for (const v of vs) for (const fd of st.villages[v].commonFields || []) tiles.add(fd.tile);
    }
    const stores = [
      ...sorted(hhs).map((id) => ({ type: 'household', id })),
      ...sorted(vs).map((id) => ({ type: 'village', id })),
    ];
    return { pawns: sorted(pawns), households: sorted(hhs), villages: sorted(vs), tiles: sorted(tiles), stores };
  }
  // ---- store views (VB-092; design.md, Store views): the stores of a scope's households, a row each, and their total ----
  // The columns, in order: {key, label, food}; food: counted in rations of food, which a view may show in days of the row's need. The
  // larder's foods are FOODS held in the larder. Seed is the grain set aside for sowing, part of the grain; owed, the heirs' shares the
  // household still owes (sim/obligations).
  const LARDER = Object.keys(FOODS).filter((k) => FOODS[k].held === 'larder');
  const STORE_COLUMNS = Object.freeze([
    { key: 'grain', label: 'Grain', food: true },
    { key: 'seed', label: 'Seed', food: false },
    { key: 'flour', label: 'Flour', food: true },
    { key: 'meals', label: 'Meals', food: true },
    ...LARDER.map((k) => ({ key: k, label: k[0].toUpperCase() + k.slice(1), food: true })),
    { key: 'sheaves', label: 'Sheaves', food: false },
    { key: 'wood', label: 'Firewood', food: false },
    { key: 'peat', label: 'Peat', food: false },
    { key: 'stone', label: 'Stone', food: false },
    { key: 'owed', label: 'Shares owed', food: false },
  ]);
  const sum = (o) => Object.values(o || {}).reduce((s, x) => s + x, 0);
  function householdStores(st, hh) {
    const r = { type: 'household', id: hh.id, need: dailyNeed(st, hh), grain: grainOf(hh), seed: seedReserve(st, hh) };
    r.flour = hh.flour || 0;
    r.meals = hh.meals || 0;
    for (const k of LARDER) r[k] = larderOf(hh, k);
    r.sheaves = hh.unthreshed.reduce((s, x) => s + x, 0);
    r.wood = hh.wood || 0;
    r.peat = hh.peat || 0;
    r.stone = sum(hh.stone);
    r.owed = owed(st, { kind: 'household', id: hh.id }, 'debtor', 'share');
    return r;
  }
  // storesOf(st, scope): {columns, rows, total, villages}. rows: a row a household in scope, by id ({type, id, need: its rations a day,
  // and a number a column}); total: their sums (type 'total'); villages: for a village scope, a row a village of its own store (v.grain),
  // its need its households' (its grain in days of their food), null in the columns a village does not hold; else none. The dimension is
  // the scope's; the stores are the bodies' whatever it is (VB-092: "owns"). A view's read, a few dozen numbers a household.
  function storesOf(st, scope) {
    const S = inScope(st, scope),
      rows = S.households.map((h) => householdStores(st, st.households[h])),
      total = { type: 'total', id: null, need: 0 };
    for (const c of STORE_COLUMNS) total[c.key] = 0;
    for (const r of rows) {
      total.need += r.need;
      for (const c of STORE_COLUMNS) total[c.key] += r[c.key];
    }
    const villages =
      scope.level !== 'village'
        ? []
        : S.villages.map((id) => {
            const v = st.villages[id],
              r = { type: 'village', id, need: 0 };
            for (const c of STORE_COLUMNS) r[c.key] = null;
            for (const x of rows) if (st.farmsteads[st.households[x.id].farmstead].village === id) r.need += x.need;
            r.grain = grainOf(v);
            return r;
          });
    return { columns: STORE_COLUMNS, rows, total, villages };
  }
  // The bodies a pawn belongs to now, by role: its live edges (the multi-membership test: several roles at once, several of one role).
  const membershipsOf = (st, id) =>
    ['resides', 'service', 'holder', 'alderman', 'family', 'line', 'spouse'].flatMap((role) =>
      liveFrom(st, role, id).map((k) => ({ role, to: st.edges[k].to })),
    );
  // PAGE: what it gives the page through the Sim facade (src/sim.js joins the lists, VB-1944)
  return { LEVELS, DIMS, STORE_COLUMNS, inScope, storesOf, membershipsOf, PAGE: ['inScope', 'storesOf'] };
})();
