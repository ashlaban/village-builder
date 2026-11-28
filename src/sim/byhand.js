// @sys sim/byhand: what is placed by hand on a settlement generator: the editor's farm, field or green on a very tile; the market town's packed plots
VB['sim/byhand'] = (() => {
  const { SETTLE } = VB['sim/rules'],
    { openGround: farmable } = VB['sim/crops'];
  const { hexSteps, bfs } = VB['sim/hex'];
  const { walkable } = VB['sim/walking'];
  const { nextTo, placeFields, loneVillage, farmIn, fieldOn } = VB['sim/layout'];
  // A field or a meadow placed by hand is of the farm nearest within HAND_REACH steps (sim/meadows' own reach).
  const HAND_REACH = 6;
  // gen: a settlementGenerator of sim/layout, before its finish(). Each is false (null) where the tile cannot take what is placed.
  // A farm on this very tile, with three fields: it joins the village whose centre is the nearest within SETTLE.centreApart steps, as
  // close farms are one village in play, or is a village of its own, as a lone farm is. Null where the tile cannot bear a house (not
  // farmable, taken, ground kept open) or finds no fields.
  function farmAt(w, gen, house) {
    const { used, farmsteads, villages, fieldsAt, yards } = gen;
    if (!farmable(w, house) || used.has(house) || yards.has(house)) return null;
    let v = null,
      vd = SETTLE.centreApart + 1;
    for (const u of villages) {
      const d = hexSteps(w, u.center, house);
      if (d < vd) {
        vd = d;
        v = u;
      }
    }
    // its fields by the gate it will have, toward its village's centre (VB-1951), as the generator places them
    const fields = placeFields(w, used, house, 3, yards, null, false, v ? v.center : house);
    if (!fields) return null;
    if (!v) {
      v = loneVillage(gen.rand, villages, house);
      villages.push(v);
    }
    const f = farmIn(w, used, v, house, fields, farmsteads, fieldsAt, yards);
    farmsteads.push(f);
    return f;
  }
  // A green with a well on this very tile: of the village with no green whose centre is the nearest within SETTLE.centreApart steps; the
  // green is its centre from then on. False where the tile is taken or water, or no such village is near.
  function greenAt(w, gen, tile) {
    const { used, villages, yards } = gen;
    if (w.water[tile] || w.river[tile] || used.has(tile)) return false;
    let v = null,
      vd = SETTLE.centreApart + 1;
    for (const u of villages) {
      const d = hexSteps(w, u.center, tile);
      if (!u.green && d < vd) {
        vd = d;
        v = u;
      }
    }
    if (!v) return false;
    v.center = tile;
    v.green = true;
    v.well = tile; // the well's tile (VB-1584)
    used.add(tile);
    for (let k = 0; k < 6; k++) {
      const j = w.nb[tile * 6 + k];
      if (j >= 0) yards.add(j);
    }
    return true;
  }
  // A field on this very tile: of the farm whose house is nearest, within HAND_REACH steps. False where the tile cannot be a field (not
  // farmable, taken, a yard) or no farm is near enough.
  function fieldAt(w, gen, tile) {
    if (!farmable(w, tile) || gen.used.has(tile) || gen.yards.has(tile)) return false;
    let f = null,
      fd = HAND_REACH + 1;
    for (const g of gen.farmsteads) {
      const d = hexSteps(w, g.house, tile);
      if (d < fd) {
        fd = d;
        f = g;
      }
    }
    if (!f) return false;
    fieldOn(w, gen.used, f, tile);
    gen.fieldsAt.add(tile);
    return true;
  }

  // The market town (VB-778; design.md, Starting scenarios), a test bed known to decay and no evidence that a town emerges: TESTBED.plots
  // plot households set within 2 steps of each other, at the village with most people within TESTBED.reach steps. Placed at the start by
  // the generators' own farmstead (a house and one field where one is free); nothing after the start holds the place together. Returns the
  // farmsteads laid; their households' sizes are drawn by the scenario.
  function packPlots(w, gen, TESTBED, sizes) {
    const { used, villages, farmsteads, yards, fieldsAt } = gen;
    let hub = null,
      most = -1;
    for (const v of villages) {
      let n = 0;
      for (const f of farmsteads) if (hexSteps(w, v.center, f.house) <= TESTBED.reach) n += sizes[f.id] || 0;
      if (n > most) {
        most = n;
        hub = v;
      }
    }
    if (!hub) return [];
    const free = (t) => farmable(w, t) && !used.has(t);
    const room = (c) => [...bfs(w, c, 2, walkable(w)).dist.keys()].filter(free).length;
    // the anchor: the free tile within 6 steps of the village's centre with the most free ground within 2 steps of it
    let anchor = -1,
      best = -1;
    for (const [t] of [...bfs(w, hub.center, 6, walkable(w)).dist].sort((a, b) => a[1] - b[1] || a[0] - b[0])) {
      const n = free(t) ? room(t) : -1;
      if (n > best) {
        best = n;
        anchor = t;
      }
    }
    if (anchor < 0) return [];
    const near = [...bfs(w, anchor, 2, walkable(w)).dist].sort((a, b) => a[1] - b[1] || a[0] - b[0]);
    const at = [];
    for (const [t] of near) {
      if (at.length >= TESTBED.plots) break;
      if (!free(t) || at.some((u) => hexSteps(w, u.house, t) > 2)) continue;
      const f = farmIn(w, used, hub, t, [], farmsteads, fieldsAt, yards);
      farmsteads.push(f);
      at.push(f);
    }
    // the houses first, then each a field where one is free (the houses leave less ground than the fields would)
    for (const f of at) {
      const field = placeFields(w, used, f.house, 1, yards);
      if (field) {
        fieldOn(w, used, f, field[0]);
        fieldsAt.add(field[0]);
      }
    }
    return at;
  }
  return { HAND_REACH, farmAt, greenAt, fieldAt, packPlots };
})();
