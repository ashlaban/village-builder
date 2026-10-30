// @sys sim/layout: placing villages, farmsteads, fields and fences on the map
VB['sim/layout'] = (() => {
  const { B } = VB['gen'];
  const { RIVER, farmable, byRiver, fertility, DIRNAME } = VB['sim/rules'];
  const { bfs, hexSteps } = VB['sim/hex'];
  const { walkable } = VB['sim/routes'];
  const { initWear } = VB['sim/paths'];
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
  function villageName(rand) {
    const A = ['Hal', 'Skog', 'Ul', 'Bred', 'Lin', 'Sand', 'Hög', 'Ek', 'Vall', 'Rön', 'Al'],
      C = ['by', 'sta', 'vik', 'nes', 'inge', 'berga', 'tuna', 'säter'];
    return A[(rand() * A.length) | 0] + C[(rand() * C.length) | 0];
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
      id, house, fields: fields.map((t, k) => ({ id: k, tile: t, stage: 'stubble', sown: null, reaped: null, held: 0, fert: fertility(w, t),
        weedOpen: false, weedPosted: null, weedMiss: 0 })),
      village: village ? village.id : null, household: null, project: null, name: '', rowAngle: a, fence: null,
    };
  }

  // cache (optional): a Float32Array of NaN that remembers site scores between calls on the same world.
  function findSite(w, rand, comp, filter, cache = null) {
    let best = -1, bs = -Infinity;
    for (let i = 0; i < w.N; i++) {
      if (w.biome[i] !== B.MEADOW || (i * 7919) % 5 || !filter(i)) continue;
      if (cache && cache[i] !== cache[i]) cache[i] = siteScore(w, i);
      const s = (cache ? cache[i] : siteScore(w, i)) + rand() * 2;
      if (s > bs) { bs = s; best = i; }
    }
    return best;
  }
  // A cluster village (VB-113): houses grow round the green one by one, each touching the green, an earlier house or an earlier house's
  // yard, preferring tiles that touch more houses, near the green, off stony and wet ground, never next to a field; then each house, the
  // first first, takes its block of fields beyond the yards (placeFields). A house whose fields find no room is not built.
  // fieldsAt and yards (tiles next to a house or green) are kept by the settlement generator across villages.
  function buildVillage(w, used, rand, center, nFarms, id, farmsteads, villages = [], fieldsAt = new Set(), yards = new Set()) {
    let name = villageName(rand);
    while (villages.some((v) => v.name === name)) name = villageName(rand);
    const village = { id, name, center, farmsteads: [], fence: [], commonsWood: -1, green: true, well: true };
    used.add(center);
    const built = new Set([center]), near = new Set(), houses = [];
    const build = (t) => { built.add(t); for (let k = 0; k < 6; k++) { const j = w.nb[t * 6 + k]; if (j >= 0) near.add(j); } };
    build(center);
    const reach = bfs(w, center, 6, walkable(w)).dist;
    for (let n = 0; n < nFarms; n++) {
      let pick = -1, ps = -Infinity;
      for (const [t, d] of reach) {
        if (d < 1 || used.has(t) || !farmable(w, t) || nextTo(w, t, fieldsAt) || !(near.has(t) || nextTo(w, t, near))) continue;
        let touch = 0; for (let k = 0; k < 6; k++) if (built.has(w.nb[t * 6 + k])) touch++;
        const b = w.biome[t], s = 0.5 * Math.min(touch, 3) - 0.5 * d - (1.5 * w.stones[t]) / 255 - (b === B.MARSH ? 2 : b === B.HILLS ? 0.5 : 0) + rand() * 1.6;
        if (s > ps) { ps = s; pick = t; }
      }
      if (pick < 0) break;
      houses.push(pick); used.add(pick); build(pick);
    }
    for (const t of near) yards.add(t);
    for (const h of houses) {
      const fields = placeFields(w, used, h, 3, yards);
      if (!fields) { used.delete(h); continue; }
      const f = makeFarmstead(w, farmsteads.length, h, fields, village, used);
      farmsteads.push(f); village.farmsteads.push(f.id);
      for (const t of fields) fieldsAt.add(t);
    }
    village.green = village.well = village.farmsteads.length >= 2;
    return village;
  }
  function nameFarms(w, villages, farmsteads, rand) {
    for (const f of farmsteads) {
      if (villages[f.village].farmsteads.length >= 2) {
        const v = villages[f.village], dx = w.hx[f.house] - w.hx[v.center], dy = w.hy[f.house] - w.hy[v.center];
        const a = (Math.atan2(-dy, dx) + Math.PI * 2) % (Math.PI * 2), k = Math.round(a / (Math.PI / 3)) % 6;
        let nm = DIRNAME[k] + 'gården';
        if (farmsteads.some((g) => g !== f && g.village === f.village && g.name === nm)) {
          nm = farmsteads.some((g) => g.village === f.village && g.name === 'Mellangården') ? 'Nygården' : 'Mellangården';
        }
        // a big village runs out of names: number the rest
        for (let n = 2; farmsteads.some((g) => g !== f && g.village === f.village && g.name === nm); n++) nm = `${nm.replace(/ \d+$/, '')} ${n}`;
        f.name = nm;
      } else { // a one-farm village: the farm is named for its surroundings
        let coast = false, woods = 0, hills = 0, marsh = 0;
        const { dist: near } = bfs(w, f.house, 2, () => true);
        for (const [j] of near) {
          if (w.water[j]) coast = true; const b = w.biome[j];
          if (b === B.FOREST || b === B.PINE) woods++; if (b === B.HILLS) hills++; if (b === B.MARSH) marsh++;
        }
        const plain = ['Ängen', 'Hagen', 'Berga', 'Åkern'];
        f.name = coast ? 'Strand' : woods >= 4 ? 'Lunden' : hills >= 3 ? 'Backa' : marsh >= 2 ? 'Myra' : plain[(rand() * plain.length) | 0];
      }
    }
  }
  // The nearest forest tile within 24 walking steps that is not a house or field, or -1 (a river can put the wood out of easy reach).
  function nearestWood(w, used, from) {
    const { dist: dd } = bfs(w, from, 24, walkable(w));
    let wl = -1, wd = Infinity;
    for (const [j, d] of dd) if ((w.biome[j] === B.FOREST || w.biome[j] === B.PINE) && !used.has(j) && d < wd) { wd = d; wl = j; }
    return wl;
  }
  // bare: the farms keep their houses only; the fields they would have had stay unmade meadow, with their stones.
  function finishLand(w, villages, farmsteads, used, rand, bare = false) {
    if (bare) for (const f of farmsteads) { for (const fd of f.fields) used.delete(fd.tile); f.fields = []; }
    const nearWood = (from) => nearestWood(w, used, from);
    for (const v of villages) {
      v.commonsWood = nearWood(v.center);
      const vin = new Set([v.center]); for (const f of farmsteads) if (f.village === v.id) { vin.add(f.house); for (const fd of f.fields) vin.add(fd.tile); }
      v.fence = makeFence(w, enclose(w, vin, v.center), v.center, { type: 'village', id: v.id }, 8, rand);
    }
    for (const f of farmsteads) f.woodlot = villages[f.village].commonsWood;
    for (const f of farmsteads) for (const fd of f.fields) w.stones[fd.tile] = 0; // fields are already made: no stones
    w.dev = new Uint8Array(w.N);
    for (const j of used) w.dev[j] = 1;
    initWear(w);
  }
  // The lone farm, as a village of one farm: the best meadow house site 12 to 40 steps from a village centre, with three fields.
  function findLoneFarm(w, used, rand, center, farmsteads, villages = [], fieldsAt = new Set(), yards = new Set()) {
    const { dist: reach } = bfs(w, center, 40, walkable(w));
    let lone = null, ls = -Infinity;
    for (const [j, d] of reach) {
      if (d < 12 || !farmable(w, j) || w.biome[j] !== B.MEADOW || (j * 31) % 3 || yards.has(j) || nextTo(w, j, fieldsAt)) continue;
      const fields = placeFields(w, used, j, 3, yards);
      if (!fields) continue;
      const s = siteScore(w, j) + fields.reduce((a, k) => a + fertility(w, k), 0) + rand();
      if (s > ls) { ls = s; lone = { house: j, fields }; }
    }
    if (!lone) return null;
    // the farm is a village of its own: its centre is the house, and it has neither green nor well
    let name = villageName(rand);
    while (villages.some((v) => v.name === name)) name = villageName(rand);
    const village = { id: villages.length, name, center: lone.house, farmsteads: [], fence: [], commonsWood: -1, green: false, well: false };
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
    f.fields.push({ id: f.fields.length, tile: best, stage: 'stubble', sown: null, reaped: null, held: 0, fert: fertility(w, best),
      weedOpen: false, weedPosted: null, weedMiss: 0 });
    return true;
  }
  // Hooks run on every farmstead the generator makes, in every scenario: (w, farmstead, used) => void.
  const farmHooks = [];
  // The one generator of settlements, used by every scenario. A scenario chooses sites and sizes; the generator places villages
  // (farms, fields), then names, commons wood and fences. Call addVillage / addLoneFarm in order, then finish().
  function settlementGenerator(w, rand, bare = false) {
    const used = new Set(), farmsteads = [], villages = [], fieldsAt = new Set(), yards = new Set();
    return {
      used, farmsteads, villages,
      addVillage(center, nFarms) {
        const v = buildVillage(w, used, rand, center, nFarms, villages.length, farmsteads, villages, fieldsAt, yards);
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
        for (const f of farmsteads) for (const hook of farmHooks) hook(w, f, used);
        return this;
      },
    };
  }
  return {
    settlementGenerator, farmHooks, FIELD_REACH, nextTo, placeFields, enclose, siteScore, villageName, makeFence, makeFarmstead, findSite,
    buildVillage, nameFarms, finishLand, nearestWood, findLoneFarm,
  };
})();
