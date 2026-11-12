// @sys sim/layout: placing villages (a green, a street, houses along them), farmsteads, fields and fences on the map
VB['sim/layout'] = (() => {
  const { B } = VB['gen'];
  const { RIVER, PATHS, SOIL, WOOD, farmable, byRiver, fertility } = VB['sim/rules'];
  const { farmName, villageName } = VB['sim/names'];
  const { bfs, hexSteps } = VB['sim/hex'];
  const { walkable } = VB['sim/routes'];
  const { initWear, wearIn } = VB['sim/paths'];
  const { initFish } = VB['sim/fish'], { initForage } = VB['sim/forage'];
  // ---- placing farms: houses, fields, fences ----
  // A farm's fields lie within FIELD_REACH walking steps of its house (VB-109).
  const FIELD_REACH = 4;
  const nextTo = (w, t, set) => { for (let k = 0; k < 6; k++) { const j = w.nb[t * 6 + k]; if (j >= 0 && set.has(j)) return true; } return false; };
  // n free farmable tiles in one connected block (each touching another, by hex neighbour) within FIELD_REACH walking steps of the house,
  // none next to the house or in `avoid` (the yards: tiles next to any house or green). Grown from each candidate tile, taking the best
  // neighbouring candidate each time; of these blocks, the one with the highest summed fertility less 0.15 per step from the house.
  // Null when no block of n exists.
  function placeFields(w, used, house, n, avoid) {
    const score = new Map(), own = new Set([house]);
    for (const [t, d] of bfs(w, house, FIELD_REACH, walkable(w)).dist) {
      if (d >= 2 && farmable(w, t) && !used.has(t) && !(avoid && avoid.has(t)) && !nextTo(w, t, own)) score.set(t, fertility(w, t) - 0.15 * d);
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
  function makeFence(w, infield, centre, owner, stretches, rand) {
    const NA = [0, -60, -120, 180, 120, 60], edges = [];
    for (const i of infield) for (let d = 0; d < 6; d++) {
      const j = w.nb[i * 6 + d];
      if (j < 0 || infield.has(j) || w.water[j]) continue;
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
    const a = (((w.hrnd[house] * 6) | 0) * Math.PI) / 3;
    return {
      id, house, fields: fields.map((t, k) => ({ id: k, tile: t, crop: 'barley', stage: 'stubble', sown: null, reaped: null, held: 0, fert: fertility(w, t),
        soil: SOIL.start, weedOpen: false, weedPosted: null, weedMiss: 0 })),
      village: village ? village.id : null, household: null, project: null, claim: null, name: '', rowAngle: a, fence: null, meadows: [], booth: null,
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
  // ---- the form of a village: a street, and houses along it ----
  // A village of four or more farms has a street: a row of open tiles through the green that is never built on, so it wears into the
  // village's lane as its people walk it (sim/paths). `need` tiles are laid as arms from the green, the first two leaving it on
  // opposite sides and a village of ten or more farms sending a side lane off as a third. An arm grows a tile at a time, straight on or
  // bearing one step left or right: it keeps to the height of the green (so it follows a shore, a river bank or a valley floor rather
  // than climbing), to dry and stoneless ground with room for houses beside it, and wanders a little; it does not bend twice the same
  // way running (no hooks), touch the street's earlier tiles (no doubling back) or run by another village's fields or houses.
  const STREET = { from: 4, perFarm: 0.7, lane: 10, level: 14, straight: 0.35, hook: 1.2, room: 0.25, wander: 0.9 };
  function layStreet(w, used, rand, center, need, arms, taken) {
    const street = new Set(), level = w.hp[center];
    const open = (t) => t >= 0 && farmable(w, t) && !used.has(t) && !street.has(t) && !w.river[t] && !taken.has(t) && !nextTo(w, t, taken);
    const worth = (t) => {
      let room = 0;
      for (let k = 0; k < 6; k++) { const j = w.nb[t * 6 + k]; if (j >= 0 && farmable(w, j) && !used.has(j) && !street.has(j)) room++; }
      const b = w.biome[t];
      return STREET.room * room - STREET.level * Math.abs(w.hp[t] - level) - (1.5 * w.stones[t]) / 255 - (b === B.MARSH ? 2 : b === B.HILLS ? 0.6 : 0);
    };
    const heads = []; // the directions the arms left the green in
    for (let a = 0; a < arms && street.size < need; a++) {
      const len = Math.ceil((need - street.size) / (arms - a));
      let at = center, dir = -1, bent = 0;
      for (let n = 0; n < len; n++) {
        let pick = -1, pd = -1, ps = -Infinity;
        for (let k = 0; k < 6; k++) {
          const turn = dir < 0 ? 0 : ((k - dir + 9) % 6) - 3; // -1, 0 or 1 once the arm has a heading
          if (dir >= 0 && Math.abs(turn) > 1) continue;
          // a new arm leaves the green well away from the others: opposite the first, or between them
          if (dir < 0 && heads.some((h) => Math.abs(((k - h + 9) % 6) - 3) < 2)) continue;
          const t = w.nb[at * 6 + k];
          if (!open(t)) continue;
          let doubled = false; // touching the street anywhere but where it came from
          for (let q = 0; q < 6; q++) { const j = w.nb[t * 6 + q]; if (j !== at && (street.has(j) || (j === center && at !== center))) doubled = true; }
          if (doubled) continue;
          const sc = worth(t) + (turn === 0 ? STREET.straight : turn === bent ? -STREET.hook : 0) + rand() * STREET.wander;
          if (sc > ps) { ps = sc; pick = t; pd = k; }
        }
        if (pick < 0) break;
        if (dir < 0) heads.push(pd); else if (pd !== dir) bent = ((pd - dir + 9) % 6) - 3;
        street.add(pick); at = pick; dir = pd;
      }
    }
    return street;
  }
  // A village laid out (VB-113, revised): the green, its street (layStreet), if it has one, and houses one by one along them. A house
  // stands on a tile touching the street or the green, or, where those are full or there is no street, an earlier house's yard; it
  // hangs together with the houses so far (its tile or a neighbour is one of their yards); it keeps off stony and wet ground and never
  // stands next to a field. It would rather have open ground on most sides than neighbours on all: touching one house costs nothing,
  // each one more costs `crowd`, so the village is a loose row with gaps (yards, a tree, a way through to the fields), not a block.
  // Then each house takes its block of fields beyond the yards and the street (placeFields); a house whose fields find no room is
  // not built, and another site is tried in its place. fieldsAt, yards (tiles next to a house or green, and street tiles) and homes (houses and greens) are
  // kept by the settlement generator across villages.
  const HOUSE = { reach: 8, far: 0.3, crowd: 0.9, offStreet: 1.4, wander: 1.6, better: 0.15, land: 2.4 };
  // The form follows the site: where the street village comes out short of its farms (a neck of land, where the street and its row take
  // the ground the fields need), the village is laid again without a street, close round its green, and the form with more farms stands.
  function buildVillage(w, used, rand, center, nFarms, id, farmsteads, villages = [], fieldsAt = new Set(), yards = new Set(), homes = new Set()) {
    const name = villageName(rand, new Set(villages.map((v) => v.name)));
    if (nFarms < STREET.from) return layVillage(w, used, rand, center, nFarms, id, name, farmsteads, fieldsAt, yards, homes, false);
    const sets = [used, fieldsAt, yards, homes], keep = () => ({ sets: sets.map((x) => [...x]), farms: farmsteads.slice() });
    const back = (k) => { sets.forEach((x, n) => { x.clear(); for (const t of k.sets[n]) x.add(t); }); farmsteads.length = 0; farmsteads.push(...k.farms); };
    const before = keep(), row = layVillage(w, used, rand, center, nFarms, id, name, farmsteads, fieldsAt, yards, homes, true);
    if (row.farmsteads.length >= nFarms) return row;
    const withRow = keep();
    back(before);
    const close = layVillage(w, used, rand, center, nFarms, id, name, farmsteads, fieldsAt, yards, homes, false);
    if (close.farmsteads.length > row.farmsteads.length) return close;
    back(withRow);
    return row;
  }
  function layVillage(w, used, rand, center, nFarms, id, name, farmsteads, fieldsAt, yards, homes, withStreet) {
    const village = { id, name, center, farmsteads: [], fence: [], wood: [], grain: 0, ledger: [], totals: [], green: true, well: true };
    used.add(center);
    const taken = new Set([...fieldsAt, ...homes]);
    const street = !withStreet ? new Set()
      : layStreet(w, used, rand, center, Math.ceil(nFarms * STREET.perFarm) + 1, nFarms >= STREET.lane ? 3 : 2, taken);
    const mine = new Set([center]), near = new Set();
    const build = (t) => { mine.add(t); for (let k = 0; k < 6; k++) { const j = w.nb[t * 6 + k]; if (j >= 0) near.add(j); } };
    build(center);
    // fields keep off the street, and off the tiles along it, which are the house sites, so they lie behind the row; where a house
    // finds no fields so (a narrow neck of land), fields may take the sites along the street that no house has taken
    const sides = new Set(yards);
    for (const t of street) { yards.add(t); sides.add(t); for (let k = 0; k < 6; k++) { const j = w.nb[t * 6 + k]; if (j >= 0) sides.add(j); } }
    for (const t of near) { yards.add(t); sides.add(t); }
    const front = new Set([center, ...street]), reach = bfs(w, center, HOUSE.reach, walkable(w)).dist;
    // the house sites still open, best first
    const sites = () => {
      const out = [];
      for (const [t, d] of reach) {
        if (d < 1 || used.has(t) || street.has(t) || !farmable(w, t) || nextTo(w, t, fieldsAt) || !(near.has(t) || nextTo(w, t, near))) continue;
        let touch = 0; for (let k = 0; k < 6; k++) if (mine.has(w.nb[t * 6 + k]) && w.nb[t * 6 + k] !== center) touch++;
        const b = w.biome[t];
        out.push([t, -HOUSE.far * d - HOUSE.crowd * Math.max(0, touch - 1) - (nextTo(w, t, front) ? 0 : HOUSE.offStreet) - (1.5 * w.stones[t]) / 255
          - (b === B.MARSH ? 2 : b === B.HILLS ? 0.5 : 0) + rand() * HOUSE.wander]);
      }
      return out.sort((x, y) => y[1] - x[1] || x[0] - y[0]).map((x) => x[0]);
    };
    const stand = (t) => { used.add(t); build(t); for (let k = 0; k < 6; k++) { const j = w.nb[t * 6 + k]; if (j >= 0) { yards.add(j); sides.add(j); } } };
    // the farm of the house at t, if it finds its fields: behind the row, unless the unbuilt sites along the street give clearly
    // better land (HOUSE.better more fertility over the block): a tidy row is not worth a poor farm
    const worth = (block) => (block ? block.reduce((sum, j) => sum + fertility(w, j), 0) : -Infinity);
    const farm = (t) => {
      const behind = placeFields(w, used, t, 3, sides), any = placeFields(w, used, t, 3, yards);
      const fields = worth(any) > worth(behind) + HOUSE.better ? any : behind;
      if (!fields || worth(fields) < HOUSE.land) return false; // ground too poor to feed a household is no room for a farm
      const f = makeFarmstead(w, farmsteads.length, t, fields, village, used);
      farmsteads.push(f); village.farmsteads.push(f.id); homes.add(t);
      for (const j of fields) fieldsAt.add(j);
      return true;
    };
    // first the houses, so that no field takes a house's place; then each house's fields, the first house first; then, for the houses
    // that found none, other sites one at a time, each kept only if its fields find room
    const houses = [];
    for (let n = 0; n < nFarms; n++) { const t = sites()[0]; if (t === undefined) break; houses.push(t); stand(t); }
    // a house is kept if it still hangs together with the houses kept before it, and finds its fields
    mine.clear(); near.clear(); build(center);
    for (const t of houses) { if ((near.has(t) || nextTo(w, t, near)) && farm(t)) build(t); else used.delete(t); }
    while (village.farmsteads.length < nFarms) {
      let done = false;
      for (const t of sites()) {
        used.add(t); // placeFields takes no used tile, and makeFarmstead marks the house
        if (farm(t)) { stand(t); done = true; break; }
        used.delete(t);
      }
      if (!done) break;
    }
    village.green = village.well = village.farmsteads.length >= 2;
    return village;
  }
  // Names at seeding (VB-026), before any culture exists, so by the generators every culture starts with (sim/names): the farms of a village
  // of two or more by compass, then landmark; a lone farm (a one-farm village) by its surroundings, with a name no other village has, and
  // its village takes that name, so the farm's map label is unique on the island.
  function nameFarms(w, villages, farmsteads, rand) {
    for (const f of farmsteads) {
      const v = villages[f.village];
      if (v.farmsteads.length >= 2) {
        const taken = new Set(farmsteads.filter((g) => g !== f && g.village === f.village && g.name).map((g) => g.name));
        f.name = farmName({ w, f, village: v, owner: null }, taken, rand);
      } else { f.name = loneFarmName(w, f, rand, new Set(villages.filter((u) => u !== v).map((u) => u.name))); v.name = f.name; }
    }
  }
  // The name of a lone farm (a one-farm village) by its surroundings within 2 steps (sim/names landmark), not one in `taken`.
  const loneFarmName = (w, f, rand, taken = new Set()) => farmName({ w, f, village: null, owner: null }, taken, rand, ['landmark']);
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
      v.fence = makeFence(w, enclose(w, vin, v.center), v.center, { type: 'village', id: v.id }, 8, rand);
    }
    for (const f of farmsteads) for (const fd of f.fields) w.stones[fd.tile] = 0; // fields are already made: no stones
    w.dev = new Uint8Array(w.N);
    for (const j of used) w.dev[j] = 1;
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
      if (d < 12 || !farmable(w, j) || w.biome[j] !== B.MEADOW || (j * 31) % 3 || yards.has(j) || nextTo(w, j, fieldsAt)) continue;
      const fields = placeFields(w, used, j, 3, yards);
      if (!fields) continue;
      const s = siteScore(w, j) + fields.reduce((a, k) => a + fertility(w, k), 0) + rand();
      if (s > ls && woodNear(w, used, j, WOOD.least).length >= WOOD.least) { ls = s; lone = { house: j, fields }; }
    }
    if (!lone) return null;
    // the farm is a village of its own: its centre is the house, and it has neither green nor well; it takes its farm's name (nameFarms)
    const name = villageName(rand, new Set(villages.map((v) => v.name)));
    const village = {
      id: villages.length, name, center: lone.house, farmsteads: [], fence: [], wood: [], grain: 0, ledger: [], totals: [], green: false, well: false };
    const f = makeFarmstead(w, farmsteads.length, lone.house, lone.fields, village, used);
    village.farmsteads.push(f.id); villages.push(village);
    for (let k = 0; k < 6; k++) { const j = w.nb[lone.house * 6 + k]; if (j >= 0) yards.add(j); }
    for (const t of lone.fields) fieldsAt.add(t);
    return f;
  }
  // One more field for a farm: the best free farmable tile touching one of its fields, within FIELD_REACH walking steps of the house and
  // not in a yard (next to a house or green), so the block stays one. False when there is none.
  function addField(w, used, f, yards = new Set()) {
    const { dist } = bfs(w, f.house, FIELD_REACH, walkable(w));
    let best = -1, bs = -Infinity;
    for (const [t, d] of dist) {
      if (used.has(t) || yards.has(t) || !farmable(w, t) || !f.fields.some((fd) => hexSteps(w, fd.tile, t) === 1)) continue;
      const s = fertility(w, t) - 0.15 * d;
      if (s > bs) { bs = s; best = t; }
    }
    if (best < 0) return false;
    used.add(best);
    f.fields.push({ id: f.fields.length, tile: best, crop: 'barley', stage: 'stubble', sown: null, reaped: null, held: 0, fert: fertility(w, best),
      soil: SOIL.start, weedOpen: false, weedPosted: null, weedMiss: 0 });
    return true;
  }
  // Hooks run on every farmstead the generator makes, in every scenario: (w, farmstead, used) => void.
  const farmHooks = [];
  // The one generator of settlements, used by every scenario. A scenario chooses sites and sizes; the generator places villages
  // (farms, fields), then names, commons wood and fences. Call addVillage / addLoneFarm in order, then finish().
  function settlementGenerator(w, rand, bare = false) {
    const used = new Set(), farmsteads = [], villages = [], fieldsAt = new Set(), yards = new Set(), homes = new Set();
    return {
      used, farmsteads, villages,
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
        nameFarms(w, villages, farmsteads, rand);
        finishLand(w, villages, farmsteads, used, rand, bare);
        if (!bare) wearIn(w, villages, farmsteads, PATHS.wornYears); // villages that have stood a while have their paths (VB-114)
        for (const f of farmsteads) for (const hook of farmHooks) hook(w, f, used);
        return this;
      },
    };
  }
  return {
    settlementGenerator, farmHooks, FIELD_REACH, nextTo, placeFields, enclose, siteScore, villageName, makeFence, makeFarmstead, findSite,
    buildVillage, layStreet, nameFarms, loneFarmName, finishLand, woodNear, findLoneFarm,
  };
})();
