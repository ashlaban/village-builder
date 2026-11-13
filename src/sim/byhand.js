// @sys sim/byhand: what the archipelago editor places by hand on a settlement generator: a farm, a field or a green on a very tile
VB['sim/byhand'] = (() => {
  const { SETTLE, farmable } = VB['sim/rules'];
  const { hexSteps } = VB['sim/hex'];
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
    const fields = placeFields(w, used, house, 3, yards);
    if (!fields) return null;
    let v = null, vd = SETTLE.centreApart + 1;
    for (const u of villages) { const d = hexSteps(w, u.center, house); if (d < vd) { vd = d; v = u; } }
    if (!v) { v = loneVillage(gen.rand, villages, house); villages.push(v); }
    const f = farmIn(w, used, v, house, fields, farmsteads, fieldsAt, yards);
    farmsteads.push(f);
    return f;
  }
  // A green with a well on this very tile: of the village with no green whose centre is the nearest within SETTLE.centreApart steps; the
  // green is its centre from then on. False where the tile is taken or water, or no such village is near.
  function greenAt(w, gen, tile) {
    const { used, villages, yards } = gen;
    if (w.water[tile] || w.river[tile] || used.has(tile)) return false;
    let v = null, vd = SETTLE.centreApart + 1;
    for (const u of villages) { const d = hexSteps(w, u.center, tile); if (!u.green && d < vd) { vd = d; v = u; } }
    if (!v) return false;
    v.center = tile; v.green = v.well = true; used.add(tile);
    for (let k = 0; k < 6; k++) { const j = w.nb[tile * 6 + k]; if (j >= 0) yards.add(j); }
    return true;
  }
  // A field on this very tile: of the farm whose house is nearest, within HAND_REACH steps. False where the tile cannot be a field (not
  // farmable, taken, a yard) or no farm is near enough.
  function fieldAt(w, gen, tile) {
    if (!farmable(w, tile) || gen.used.has(tile) || gen.yards.has(tile)) return false;
    let f = null, fd = HAND_REACH + 1;
    for (const g of gen.farmsteads) { const d = hexSteps(w, g.house, tile); if (d < fd) { fd = d; f = g; } }
    if (!f) return false;
    fieldOn(w, gen.used, f, tile); gen.fieldsAt.add(tile);
    return true;
  }
  return { HAND_REACH, farmAt, greenAt, fieldAt };
})();
