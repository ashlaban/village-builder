// @sys sim/layout: placing villages, farmsteads, fields and fences on the map
VB['sim/layout'] = (() => {
  const { B } = VB['gen'];
  const { FERTILITY, farmable, DIRNAME } = VB['sim/rules'];
  const { bfs, land, hexSteps } = VB['sim/hex'];
  // ---- placing the founders ----
  function placeFields(w, used, house, n, avoid) {
    const cand = [];
    for (let k = 0; k < 6; k++) { const j = w.nb[house * 6 + k]; if (farmable(w, j) && !used.has(j) && !(avoid && avoid.has(j))) cand.push(j); }
    if (cand.length < n) {
      const { dist } = bfs(w, house, 2, (j) => farmable(w, j));
      for (const [j, d] of dist) if (d === 2 && !used.has(j) && !(avoid && avoid.has(j))) cand.push(j);
    }
    cand.sort((a, b) => FERTILITY[w.biome[b]] - FERTILITY[w.biome[a]]);
    return cand.length >= n ? cand.slice(0, n) : null;
  }
  function siteScore(w, c) {
    if (!farmable(w, c) || w.biome[c] !== B.MEADOW) return -1;
    const { dist } = bfs(w, c, 3, land(w));
    let farm = 0;
    for (const [j] of dist) if (farmable(w, j)) farm += FERTILITY[w.biome[j]];
    const { dist: d6 } = bfs(w, c, 6, land(w));
    let wood = 0, shore = 0;
    for (const [j] of d6) { const b = w.biome[j]; if (b === B.FOREST || b === B.PINE) wood++; }
    for (let k = 0; k < 6; k++) { const j = w.nb[c * 6 + k]; if (j >= 0 && w.water[j]) shore++; }
    return farm + Math.min(wood, 12) * 0.6 + (shore > 0 ? 4 : 0) - w.hp[c] * 6;
  }
  function villageName(rand) {
    const A = ['Hal', 'Skog', 'Ul', 'Bred', 'Lin', 'Sand', 'Hög', 'Ek', 'Vall', 'Rön', 'Al'],
      C = ['by', 'sta', 'vik', 'nes', 'inge', 'berga', 'tuna', 'säter'];
    return A[(rand() * A.length) | 0] + C[(rand() * C.length) | 0];
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
      id, house, fields: fields.map((t, k) => ({ id: k, tile: t, stage: 'stubble', sown: null, reaped: null, held: 0, fert: FERTILITY[w.biome[t]] })),
      village: village ? village.id : null, household: null, name: '', rowAngle: a, fence: null,
    };
  }

  function findSite(w, rand, comp, filter) {
    let best = -1, bs = -Infinity;
    for (let i = 0; i < w.N; i++) {
      if (w.biome[i] !== B.MEADOW || (i * 7919) % 5 || !filter(i)) continue;
      const s = siteScore(w, i) + rand() * 2;
      if (s > bs) { bs = s; best = i; }
    }
    return best;
  }
  function buildVillage(w, used, rand, center, nFarms, id, farmsteads) {
    const village = { id, name: villageName(rand), center, farmsteads: [], fence: [], commonsWood: -1 };
    used.add(center);
    const ring = [], { dist } = bfs(w, center, 2, land(w));
    for (const [j, d] of dist) if (d >= 1 && farmable(w, j)) ring.push(j);
    const greenAvoid = new Set([center]);
    for (let n = 0; n < nFarms; n++) {
      let pick = null, ps = -1;
      for (const h of ring) {
        if (used.has(h) || farmsteads.some((f) => hexSteps(w, f.house, h) < 2)) continue;
        const fields = placeFields(w, used, h, 3, greenAvoid);
        if (!fields) continue;
        const s = fields.reduce((a, j) => a + FERTILITY[w.biome[j]], 0) - hexSteps(w, h, center) * 0.3;
        if (s > ps) { ps = s; pick = { house: h, fields }; }
      }
      if (!pick) break;
      const f = makeFarmstead(w, farmsteads.length, pick.house, pick.fields, village, used);
      farmsteads.push(f); village.farmsteads.push(f.id);
    }
    return village;
  }
  function nameFarms(w, villages, farmsteads, rand) {
    for (const f of farmsteads) {
      if (f.village !== null) {
        const v = villages[f.village], dx = w.hx[f.house] - w.hx[v.center], dy = w.hy[f.house] - w.hy[v.center];
        const a = (Math.atan2(-dy, dx) + Math.PI * 2) % (Math.PI * 2), k = Math.round(a / (Math.PI / 3)) % 6;
        let nm = DIRNAME[k] + 'gården';
        if (farmsteads.some((g) => g !== f && g.village === f.village && g.name === nm)) {
          nm = farmsteads.some((g) => g.village === f.village && g.name === 'Mellangården') ? 'Nygården' : 'Mellangården';
        }
        f.name = nm;
      } else {
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
  function finishLand(w, villages, farmsteads, used, rand) {
    const nearestWood = (from) => {
      const { dist: dd } = bfs(w, from, 16, land(w));
      let wl = -1, wd = Infinity;
      for (const [j, d] of dd) if ((w.biome[j] === B.FOREST || w.biome[j] === B.PINE) && !used.has(j) && d < wd) { wd = d; wl = j; }
      return wl;
    };
    for (const v of villages) {
      v.commonsWood = nearestWood(v.center);
      const vin = new Set([v.center]); for (const f of farmsteads) if (f.village === v.id) { vin.add(f.house); for (const fd of f.fields) vin.add(fd.tile); }
      v.fence = makeFence(w, vin, v.center, { type: 'village', id: v.id }, 8, rand);
    }
    for (const f of farmsteads) {
      f.woodlot = f.village !== null ? villages[f.village].commonsWood : nearestWood(f.house);
      if (f.village === null) {
        const inf = new Set([f.house, ...f.fields.map((fd) => fd.tile)]); f.fence = makeFence(w, inf, f.house, { type: 'household', id: null }, 4, rand);
      }
    }
    w.dev = new Uint8Array(w.N);
    for (const j of used) w.dev[j] = 1;
  }
  return { placeFields, siteScore, villageName, makeFence, makeFarmstead, findSite, buildVillage, nameFarms, finishLand };
})();
