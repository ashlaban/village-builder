// @sys sim/layout: placing villages (a green, and a farm at a time round it, by its land), farmsteads, fields and fences on the map
VB['sim/layout'] = (() => {
  const { B } = VB['gen'];
  const { RIVER, PATHS, SOIL, WOOD, farmable, byRiver, fertility } = VB['sim/rules'];
  const { drawnName, nameVillages, nameFarms, loneFarmName } = VB['sim/names']; // names at seeding
  const { bfs, hexSteps, cutsOff, rimFull } = VB['sim/hex'];
  const { walkable } = VB['sim/routes'];
  const { initWear, wearIn } = VB['sim/paths'];
  const { initFish } = VB['sim/fish'], { initForage } = VB['sim/forage'];
  // ---- placing farms: houses, fields, fences ----
  // A farm's fields lie within FIELD_REACH walking steps of its house (VB-109).
  const FIELD_REACH = 4;
  // What a step from the house costs a field, against its fertility (meadow 1): the fields lie close to the house (was 0.15; Kim, 12 Nov).
  const FIELD_NEAR = 0.3;
  const nextTo = (w, t, set) => { for (let k = 0; k < 6; k++) { const j = w.nb[t * 6 + k]; if (j >= 0 && set.has(j)) return true; } return false; };
  // n free farmable tiles in one connected block (each touching another, by hex neighbour) within FIELD_REACH walking steps of the house,
  // none in `avoid` (the ground kept open: a street's tiles and the tiles round a green). A field may touch a house, its own or
  // another's (Kim, 12 Nov: the fields lie close). Grown from each candidate tile, taking the best
  // neighbouring candidate each time; of these blocks, the one with the highest summed fertility less FIELD_NEAR per step from the house.
  // Null when no block of n exists. ok (optional): a test every tile of the block passes (a village's fields lie outward of their house).
  function placeFields(w, used, house, n, avoid, ok = null) {
    const score = new Map();
    for (const [t, d] of bfs(w, house, FIELD_REACH, walkable(w)).dist) {
      if (d >= 1 && farmable(w, t) && !used.has(t) && !(avoid && avoid.has(t)) && (!ok || ok(t))) score.set(t, fertility(w, t) - FIELD_NEAR * d);
    }
    let best = null, bs = -Infinity;
    for (const [seed, s0] of score) {
      const block = [seed], inBlock = new Set(block);
      let s = s0;
      while (block.length < n) {
        let pick = -1, ps = -Infinity;
        for (const b of block) for (let k = 0; k < 6; k++) {
          const j = w.nb[b * 6 + k];
          if (j >= 0 && !inBlock.has(j) && score.has(j) && score.get(j) > ps) { ps = score.get(j); pick = j; }
        }
        if (pick < 0) break;
        block.push(pick); inBlock.add(pick); s += ps;
      }
      if (block.length === n && s > bs) { bs = s; best = block; }
    }
    return best;
  }
  function siteScore(w, c) {
    if (!farmable(w, c) || w.biome[c] !== B.MEADOW) return -1;
    const { dist } = bfs(w, c, 3, walkable(w));
    let farm = 0;
    for (const [j] of dist) if (farmable(w, j)) farm += fertility(w, j);
    const { dist: d6 } = bfs(w, c, 6, walkable(w));
    let wood = 0, shore = 0, river = Infinity;
    // steps to the nearest river: one more than to the nearest bank on this side (a river tile is not walked on but at a ford)
    for (const [j, d] of d6) { const b = w.biome[j]; if (b === B.FOREST || b === B.PINE) wood++; if (byRiver(w, j) && d + 1 < river) river = d + 1; }
    for (let k = 0; k < 6; k++) { const j = w.nb[c * 6 + k]; if (j >= 0 && w.water[j]) shore++; }
    return farm + Math.min(wood, 12) * 0.6 + (shore > 0 ? 4 : 0) + (RIVER.site[river] || 0) - w.hp[c] * 6;
  }

  // The land a village fences: its green, houses and fields, and the yards and gaps they close in: every tile within their reach from the
  // green that open land outside cannot reach without crossing them, and any tile with four or more of its six neighbours inside.
  function enclose(w, inner, centre) {
    const out = new Set(inner);
    let r = 0;
    for (const t of inner) r = Math.max(r, hexSteps(w, centre, t));
    const { dist } = bfs(w, centre, r + 1, () => true), outside = new Set(), q = [];
    for (const [t, d] of dist) if (d === r + 1 && !out.has(t)) { outside.add(t); q.push(t); }
    for (let h = 0; h < q.length; h++) for (let k = 0; k < 6; k++) {
      const j = w.nb[q[h] * 6 + k];
      if (j >= 0 && dist.has(j) && !out.has(j) && !outside.has(j)) { outside.add(j); q.push(j); }
    }
    for (const [t] of dist) if (!outside.has(t) && !w.water[t]) out.add(t);
    for (const [t] of dist) {
      if (out.has(t) || w.water[t]) continue;
      let n = 0; for (let k = 0; k < 6; k++) if (out.has(w.nb[t * 6 + k])) n++;
      if (n >= 4) out.add(t);
    }
    return out;
  }
  // Fence (gärdesgård) around an infield: hex edges between enclosed land and open land, split into stretches.
  // open: the centre is a green, open ground that ways cross from every side (VB-402): no fence runs along it.
  function makeFence(w, infield, centre, owner, stretches, rand, open = false) {
    const NA = [0, -60, -120, 180, 120, 60], edges = [];
    for (const i of infield) for (let d = 0; d < 6; d++) {
      const j = w.nb[i * 6 + d];
      if (j < 0 || infield.has(j) || w.water[j] || (open && i === centre)) continue;
      const a0 = ((NA[d] - 30) * Math.PI) / 180, a1 = ((NA[d] + 30) * Math.PI) / 180, R = w.R;
      const x1 = w.hx[i] + Math.cos(a0) * R, y1 = w.hy[i] + Math.sin(a0) * R, x2 = w.hx[i] + Math.cos(a1) * R, y2 = w.hy[i] + Math.sin(a1) * R;
      edges.push({ x1, y1, x2, y2, tile: i, ang: Math.atan2((y1 + y2) / 2 - w.hy[centre], (x1 + x2) / 2 - w.hx[centre]) });
    }
    edges.sort((a, b) => a.ang - b.ang);
    const out = [];
    const per = Math.max(1, Math.ceil(edges.length / stretches));
    for (let k = 0; k < edges.length; k += per) {
      const es = edges.slice(k, k + per), m = es[(es.length / 2) | 0];
      out.push({ id: out.length, edges: es, cond: 0.75 + rand() * 0.25, owner, tile: m.tile, mx: (m.x1 + m.x2) / 2, my: (m.y1 + m.y2) / 2 });
    }
    return out;
  }

  function makeFarmstead(w, id, house, fields, village, used) {
    used.add(house); for (const j of fields) used.add(j);
    if (w.dev) w.dev[house] = 3; // a house raised in play; a generated one is marked when the land is finished (finishLand)
    const a = (((w.hrnd[house] * 6) | 0) * Math.PI) / 3;
    return {
      id, house, fields: fields.map((t, k) => ({ id: k, tile: t, crop: 'barley', stage: 'stubble', sown: null, reaped: null, held: 0, fert: fertility(w, t),
        soil: SOIL.start, weedOpen: false, weedPosted: null, weedMiss: 0 })),
      village: village ? village.id : null, household: null, name: '', rowAngle: a, fence: null, meadows: [], booth: null,
      grade: 'ground', // a house stands on the bare ground until raised onto stone (sim/building, VB-332)
    };
  }

  // cache (optional): a Float32Array of NaN that remembers site scores between calls on the same world. A village stands only within reach
  // of a wood: WOOD.least wooded tiles within WOOD.reach walking steps (VB-326), asked only of a site that would be the best so far.
  const NONE = new Set();
  function findSite(w, rand, comp, filter, cache = null) {
    let best = -1, bs = -Infinity;
    for (let i = 0; i < w.N; i++) {
      if (w.biome[i] !== B.MEADOW || (i * 7919) % 5 || !filter(i)) continue;
      if (cache && cache[i] !== cache[i]) cache[i] = siteScore(w, i);
      const s = (cache ? cache[i] : siteScore(w, i)) + rand() * 2;
      if (s > bs && woodNear(w, NONE, i, WOOD.least).length >= WOOD.least) { bs = s; best = i; }
    }
    return best;
  }
  // ---- the form of a village: houses round a green, each where its land is best ----
  // A village laid out by its land (Kim, 12 Nov; it was a street and a row, VB-113): the green, then a farm at a time. A house stands on
  // a tile touching the green or hanging together with the village so far (its tile or a neighbour touches one of its houses, or its
  // tile one of its fields, so the village grows out past the fields of its first farms); it keeps off
  // stony and wet ground, and would rather have open ground on most sides than neighbours on all: touching one house costs nothing,
  // each one more costs `crowd`. Of the `tries` best such sites, the house stands where the land round it is best: its site's score,
  // plus `byLand` times the worth of the block of fields it would take (placeFields), less `spare` times the house tile's own fertility,
  // since a house stands on the poorer ground and spares the good (the stony rise beside the clay of a Swedish village). Its fields lie
  // no nearer the green than the house, so the green stays the village's centre, and off the ring round the green, which stays open;
  // a site whose fields find no room, or only ground too poor to feed a household (`land`), is no site. The village has no laid
  // street: its lanes wear in where its people walk (sim/paths). fieldsAt, yards (the ground kept open: the tiles round a green) and
  // homes (houses and greens) are kept by the settlement generator across villages.
  const HOUSE = { reach: 8, far: 0.3, crowd: 0.9, offGreen: 1.4, wander: 1.6, land: 2.4, tries: 16, byLand: 1.5, spare: 1 };
  function buildVillage(w, used, rand, center, nFarms, id, farmsteads, villages = [], fieldsAt = new Set(), yards = new Set(), homes = new Set()) {
    const name = drawnName(rand, villages); // named when all are laid (nameVillages)
    const village = { id, name, center, farmsteads: [], fence: [], wood: [], grain: {}, ledger: [], totals: [], green: true, well: true };
    used.add(center);
    const mine = new Set([center]), near = new Set(), tilled = new Set();
    const build = (t) => { mine.add(t); for (let k = 0; k < 6; k++) { const j = w.nb[t * 6 + k]; if (j >= 0) near.add(j); } };
    build(center);
    for (const t of near) yards.add(t); // the ring round the green stays open: houses may stand on it, fields may not
    const reach = bfs(w, center, HOUSE.reach, walkable(w)).dist;
    const fromGreen = bfs(w, center, HOUSE.reach + FIELD_REACH, walkable(w)).dist, outward = (h) => (t) => (fromGreen.get(t) ?? Infinity) >= fromGreen.get(h);
    // no route crosses a house: this village's so far (mine, but its green) and the other villages' (homes)
    const walk = walkable(w), house = (j) => j !== center && (mine.has(j) || homes.has(j)), shut = (j) => j < 0 || !walk(j) || house(j);
    // the house sites still open, with their scores, best first
    const sites = () => {
      const out = [];
      for (const [t, d] of reach) {
        if (d < 1 || used.has(t) || !farmable(w, t) || !(near.has(t) || nextTo(w, t, near) || nextTo(w, t, tilled))) continue;
        if (cutsOff(w, t, shut, house) || rimFull(w, center, t, house)) continue;
        let touch = 0; for (let k = 0; k < 6; k++) if (mine.has(w.nb[t * 6 + k]) && w.nb[t * 6 + k] !== center) touch++;
        const b = w.biome[t];
        out.push([t, -HOUSE.far * d - HOUSE.crowd * Math.max(0, touch - 1) - (d === 1 ? 0 : HOUSE.offGreen) - (1.5 * w.stones[t]) / 255
          - (b === B.MARSH ? 2 : b === B.HILLS ? 0.5 : 0) + rand() * HOUSE.wander]);
      }
      return out.sort((x, y) => y[1] - x[1] || x[0] - y[0]);
    };
    const worth = (block) => block.reduce((sum, j) => sum + fertility(w, j), 0);
    for (let n = 0; n < nFarms; n++) {
      let best = null, bs = -Infinity;
      const open = sites();
      // the best of the first `tries` sites; where none of them finds its fields, of the next `tries`, and so on
      for (let k = 0; k < open.length && !best; k += HOUSE.tries) for (const [t, base] of open.slice(k, k + HOUSE.tries)) {
        used.add(t); // placeFields takes no used tile
        const fields = placeFields(w, used, t, 3, yards, outward(t));
        used.delete(t);
        if (!fields || worth(fields) < HOUSE.land) continue;
        const sc = base + HOUSE.byLand * worth(fields) - HOUSE.spare * fertility(w, t);
        if (sc > bs) { bs = sc; best = [t, fields]; }
      }
      if (!best) break;
      const f = makeFarmstead(w, farmsteads.length, best[0], best[1], village, used);
      farmsteads.push(f); village.farmsteads.push(f.id); homes.add(best[0]); build(best[0]);
      for (const j of best[1]) { fieldsAt.add(j); tilled.add(j); }
    }
    village.green = village.well = village.farmsteads.length >= 2;
    // a village that came to one farm is a lone farm: its centre is the house, and the ground meant for the green is free again
    if (village.farmsteads.length === 1) { used.delete(center); village.center = farmsteads[village.farmsteads[0]].house; }
    return village;
  }
  // Up to n wooded tiles within WOOD.reach walking steps of `from`, nearest first, none a house or field (`used`) or in `taken`.
  function woodNear(w, used, from, n, taken = null) {
    const out = [];
    for (const [j, d] of bfs(w, from, WOOD.reach, walkable(w)).dist) {
      if ((w.biome[j] === B.FOREST || w.biome[j] === B.PINE) && !used.has(j) && !(taken && taken.has(j))) out.push([j, d]);
    }
    return out.sort((a, b) => a[1] - b[1] || a[0] - b[0]).slice(0, n).map(([j]) => j);
  }
  // bare: the farms keep their houses only; the fields they would have had stay unmade meadow, with their stones. Each village's wood
  // (VB-326): WOOD.perHousehold of the nearest wooded tiles for each of its farms, at least WOOD.least, none another village's; sim/territory
  // reckons it again once the land is held.
  function finishLand(w, villages, farmsteads, used, rand, bare = false) {
    if (bare) for (const f of farmsteads) { for (const fd of f.fields) used.delete(fd.tile); f.fields = []; }
    const taken = new Set();
    for (const v of villages) {
      const n = Math.min(WOOD.cap, Math.max(WOOD.least, WOOD.perHousehold * v.farmsteads.length));
      v.wood = woodNear(w, used, v.center, n, taken); for (const t of v.wood) taken.add(t);
      const vin = new Set([v.center]); for (const f of farmsteads) if (f.village === v.id) { vin.add(f.house); for (const fd of f.fields) vin.add(fd.tile); }
      v.fence = makeFence(w, enclose(w, vin, v.center), v.center, { type: 'village', id: v.id }, 8, rand, v.green);
    }
    for (const f of farmsteads) for (const fd of f.fields) w.stones[fd.tile] = 0; // fields are already made: no stones
    w.dev = new Uint8Array(w.N);
    for (const j of used) w.dev[j] = 1;
    for (const f of farmsteads) w.dev[f.house] = 3; // a house: no way wears through it (sim/paths)
    for (const v of villages) if (v.green) w.dev[v.center] = 2; // the green is open ground: the ways that meet there cross it (gen/paths)
    initWear(w); initFish(w); initForage(w);
    w.graze = new Float32Array(w.N); // grazing pressure, none yet (sim/herds, VB-136)
  }
  // The lone farm, as a village of one farm: the best meadow house site 12 to 40 steps from a village centre, with three fields and a wood
  // in reach (findSite).
  function findLoneFarm(w, used, rand, center, farmsteads, villages = [], fieldsAt = new Set(), yards = new Set()) {
    const { dist: reach } = bfs(w, center, 40, walkable(w));
    let lone = null, ls = -Infinity;
    for (const [j, d] of reach) {
      if (d < 12 || !farmable(w, j) || w.biome[j] !== B.MEADOW || (j * 31) % 3 || yards.has(j)) continue;
      const fields = placeFields(w, used, j, 3, yards);
      if (!fields) continue;
      const s = siteScore(w, j) + fields.reduce((a, k) => a + fertility(w, k), 0) + rand();
      if (s > ls && woodNear(w, used, j, WOOD.least).length >= WOOD.least) { ls = s; lone = { house: j, fields }; }
    }
    if (!lone) return null;
    const village = loneVillage(rand, villages, lone.house); villages.push(village);
    return farmIn(w, used, village, lone.house, lone.fields, farmsteads, fieldsAt, yards);
  }
  // A farm as a village of its own: its centre is the house, and it has neither green nor well; it takes its farm's name (nameFarms).
  function loneVillage(rand, villages, house) {
    return { id: villages.length, name: drawnName(rand, villages), center: house, farmsteads: [], fence: [], wood: [], grain: {}, ledger: [], totals: [],
      green: false, well: false };
  }
  // The farmstead of a house and fields found, in village v; the caller adds it to `farmsteads`.
  function farmIn(w, used, v, house, fields, farmsteads, fieldsAt, yards) {
    const f = makeFarmstead(w, farmsteads.length, house, fields, v, used);
    v.farmsteads.push(f.id);
    for (const t of fields) fieldsAt.add(t);
    return f;
  }
  // One more field for a farm: the best free farmable tile touching one of its fields, within FIELD_REACH walking steps of the house and
  // not in a yard (next to a house or green), so the block stays one. False when there is none.
  function addField(w, used, f, yards = new Set()) {
    const { dist } = bfs(w, f.house, FIELD_REACH, walkable(w));
    let best = -1, bs = -Infinity;
    for (const [t, d] of dist) {
      if (used.has(t) || yards.has(t) || !farmable(w, t) || !f.fields.some((fd) => hexSteps(w, fd.tile, t) === 1)) continue;
      const s = fertility(w, t) - FIELD_NEAR * d;
      if (s > bs) { bs = s; best = t; }
    }
    if (best < 0) return false;
    fieldOn(w, used, f, best);
    return true;
  }
  function fieldOn(w, used, f, tile) {
    used.add(tile);
    f.fields.push({ id: f.fields.length, tile, crop: 'barley', stage: 'stubble', sown: null, reaped: null, held: 0, fert: fertility(w, tile),
      soil: SOIL.start, weedOpen: false, weedPosted: null, weedMiss: 0 });
  }
  // Hooks run on every farmstead the generator makes, in every scenario: (w, farmstead, used) => void.
  const farmHooks = [];
  // The one generator of settlements, used by every scenario. A scenario chooses sites and sizes; the generator places villages
  // (farms, fields), then names, commons wood and fences. Call addVillage / addLoneFarm in order, then finish().
  function settlementGenerator(w, rand, bare = false) {
    const used = new Set(), farmsteads = [], villages = [], fieldsAt = new Set(), yards = new Set(), homes = new Set();
    return {
      used, farmsteads, villages, rand, fieldsAt, yards, // rand and the two sets: for what is placed by hand (sim/byhand)
      addVillage(center, nFarms) {
        const v = buildVillage(w, used, rand, center, nFarms, villages.length, farmsteads, villages, fieldsAt, yards, homes);
        villages.push(v); return v;
      },
      addField(fid) {
        const f = farmsteads[fid], ok = addField(w, used, f, yards);
        if (ok) fieldsAt.add(f.fields[f.fields.length - 1].tile);
        return ok;
      },
      addLoneFarm(nearCenter) {
        const f = findLoneFarm(w, used, rand, nearCenter, farmsteads, villages, fieldsAt, yards);
        if (f) farmsteads.push(f);
        return f;
      },
      finish() {
        nameVillages(w, villages); nameFarms(w, villages, farmsteads, rand);
        finishLand(w, villages, farmsteads, used, rand, bare);
        if (!bare) wearIn(w, villages, farmsteads, PATHS.wornYears); // villages that have stood a while have their paths (VB-114)
        for (const f of farmsteads) for (const hook of farmHooks) hook(w, f, used);
        return this;
      },
    };
  }
  return {
    settlementGenerator, farmHooks, FIELD_REACH, nextTo, loneVillage, farmIn, fieldOn, placeFields, enclose, siteScore, nameVillages, makeFence, makeFarmstead,
    findSite, buildVillage, nameFarms, loneFarmName, finishLand, woodNear, findLoneFarm,
  };
})();
