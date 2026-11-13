// @sys gen/climate: the weather that shapes a generated world (VB-342): the seed's wind, erosion of the relief by running water, the rain the
// ===== Climate at generation: wind carries off the sea, and each tile's moisture from that rain and the water of its valley =====
// Listed before gen.js, which calls it on its coarse grid (CW by CH cells, elevation above 0 land); it reads gen/rivers for its heap only.
VB['gen/climate'] = (() => {
  const { minHeap } = VB['gen/rivers'];
  // Erosion: `rounds` of stream power, each lowering a cell towards the cell it drains to by k times (the root of its catchment in cells, less
  // `hillside`, so slopes that gather no water keep their shape), then `creep` of the way to the mean of its four neighbours; land stays
  // above `floor`, so the coast does not move. The drainage is found afresh every `redrain` rounds: it is most of the cost and shifts little.
  // Rain: air crosses the map along the wind with a load of water, 1 where it enters. Over water it takes up `evap` of what it lacks a
  // cell; over land it drops `base` of its load a cell, and `rise` more per unit of elevation gained over the last cell, on relief
  // smoothed `smooth` times; where the ground falls it drops `lee` less. `spread`: how sharply the load follows the wind's own line.
  // Moisture: rain between its 2nd and 98th percentile on land is 0 to 1; a valley floor adds up to `valley` by the log of its catchment
  // of rain, counted from `valleyFrom` cells of the wettest rain; `noise` of the generator's old moisture noise keeps the land patchy.
  // Lakes: where a basin has no way down to the sea its water ponds to the level of its lowest rim. Land more than `pondDepth` under that
  // level, in a patch of `pondCells` cells or more, becomes lake (bed at -`pondBed`); a shallower or smaller hollow stays land, and so does
  // one that would stand above `pondHigh`: water lies at sea level in this world, so a lake in the hills would sit in a pit.
  const CLIMATE = {
    rounds: 12,
    redrain: 3,
    k: 0.008,
    hillside: 1.5,
    creep: 0.1,
    floor: 0.002,
    pondDepth: 0.012,
    pondHigh: 0.12,
    pondCells: 27,
    pondBed: 0.02,
    evap: 0.03,
    base: 0.01,
    rise: 1.6,
    lee: 0.4,
    spread: 2,
    smooth: 10,
    valley: 0.3,
    valleyFrom: 150,
    valleyMost: 1.5,
    noise: 0.25,
  };
  const DX = [1, 1, 0, -1, -1, -1, 0, 1],
    DY = [0, -1, -1, -1, 0, 1, 1, 1],
    DL = [1, Math.SQRT2, 1, Math.SQRT2, 1, Math.SQRT2, 1, Math.SQRT2];

  // The wind of a world: a unit vector, the way the air moves (y grows southwards), fixed for the seed (Kim, 11 Nov). rand: a seeded source.
  function wind(rand) {
    const a = rand() * Math.PI * 2;
    return [Math.cos(a), Math.sin(a)];
  }

  // Every land cell drains to one of its eight neighbours (down) on a path to water that never climbs above its spill level: a priority
  // flood from the water, as gen/rivers does on tiles. order lists the land cells as the flood reached them, downstream first.
  // With `sea` (a mask of cells), the flood starts from those cells only and runs over everything else, lakes too; fill is then the level
  // water stands at in each cell.
  function drainage(z, CW, CH, sea) {
    const N = CW * CH,
      fill = new Float64Array(N),
      down = new Int32Array(N).fill(-1),
      seen = new Uint8Array(N),
      order = [],
      h = minHeap(fill);
    for (let k = 0; k < N; k++) {
      if (sea ? !sea[k] : z[k] > 0) continue;
      seen[k] = 1;
      const x = k % CW,
        y = (k / CW) | 0;
      for (let d = 0; d < 8; d++) {
        const X = x + DX[d],
          Y = y + DY[d];
        if (X >= 0 && Y >= 0 && X < CW && Y < CH && (sea ? !sea[Y * CW + X] : z[Y * CW + X] > 0)) {
          h.push(k);
          break;
        }
      }
    }
    while (h.size) {
      const k = h.pop(),
        x = k % CW,
        y = (k / CW) | 0;
      for (let d = 0; d < 8; d++) {
        const X = x + DX[d],
          Y = y + DY[d];
        if (X < 0 || Y < 0 || X >= CW || Y >= CH) continue;
        const j = Y * CW + X;
        if (seen[j]) continue;
        seen[j] = 1;
        fill[j] = Math.max(z[j], fill[k] + 1e-6);
        down[j] = k;
        order.push(j);
        h.push(j);
      }
    }
    return { down, order, fill };
  }
  // Catchment: each land cell's own water (1, or rain[k]) plus all that drains through it.
  function catchment({ down, order }, N, rain) {
    const acc = new Float32Array(N);
    for (const k of order) acc[k] = rain ? rain[k] : 1;
    for (let i = order.length - 1; i >= 0; i--) {
      const k = order[i],
        d = down[k];
      if (acc[d] > 0) acc[d] += acc[k];
    }
    return acc;
  }

  // The relief as water leaves it, for gen.js: eroded, then ponded. In place.
  function shape(z, CW, CH) {
    erode(z, CW, CH);
    pond(z, CW, CH);
  }

  // Erodes z in place (see CLIMATE). The step is implicit, so it is stable for any k: a cell never falls below the cell it drains to.
  function erode(z, CW, CH) {
    const C = CLIMATE,
      N = CW * CH,
      t = new Float32Array(N);
    for (let round = 0, dr, acc; round < C.rounds; round++) {
      if (round % C.redrain === 0) {
        dr = drainage(z, CW, CH);
        acc = catchment(dr, N);
      }
      for (const k of dr.order) {
        const zd = Math.max(0, z[dr.down[k]]),
          f = C.k * Math.max(0, Math.sqrt(acc[k]) - C.hillside);
        if (z[k] > zd) z[k] = Math.max(C.floor, (z[k] + f * zd) / (1 + f));
      }
      t.set(z);
      for (let y = 1; y < CH - 1; y++)
        for (let x = 1; x < CW - 1; x++) {
          const k = y * CW + x;
          if (t[k] <= 0) continue;
          const mean =
            (Math.max(0, t[k - 1]) + Math.max(0, t[k + 1]) + Math.max(0, t[k - CW]) + Math.max(0, t[k + CW])) / 4;
          z[k] = Math.max(C.floor, t[k] + C.creep * (mean - t[k]));
        }
    }
  }

  // Lakes where basins pond (see CLIMATE): lowers the ponded land of z to a lake bed, in place; returns the number of cells made lake.
  function pond(z, CW, CH) {
    const C = CLIMATE,
      N = CW * CH,
      sea = new Uint8Array(N),
      q = [];
    for (let k = 0; k < N; k++) {
      const x = k % CW,
        y = (k / CW) | 0;
      if (z[k] <= 0 && (x === 0 || y === 0 || x === CW - 1 || y === CH - 1)) {
        sea[k] = 1;
        q.push(k);
      }
    }
    for (let h = 0; h < q.length; h++)
      for (let d = 0; d < 8; d += 2) {
        const X = (q[h] % CW) + DX[d],
          Y = ((q[h] / CW) | 0) + DY[d];
        if (X < 0 || Y < 0 || X >= CW || Y >= CH) continue;
        const j = Y * CW + X;
        if (z[j] <= 0 && !sea[j]) {
          sea[j] = 1;
          q.push(j);
        }
      }
    const { fill } = drainage(z, CW, CH, sea),
      seen = new Uint8Array(N);
    const deep = (k) => !sea[k] && fill[k] - z[k] > C.pondDepth && fill[k] <= C.pondHigh;
    let made = 0;
    for (let s = 0; s < N; s++) {
      if (seen[s] || !deep(s)) continue;
      const patch = [s];
      seen[s] = 1;
      for (let h = 0; h < patch.length; h++)
        for (let d = 0; d < 8; d += 2) {
          const X = (patch[h] % CW) + DX[d],
            Y = ((patch[h] / CW) | 0) + DY[d];
          if (X < 0 || Y < 0 || X >= CW || Y >= CH) continue;
          const j = Y * CW + X;
          if (!seen[j] && deep(j)) {
            seen[j] = 1;
            patch.push(j);
          }
        }
      if (patch.length >= C.pondCells)
        for (const k of patch)
          if (z[k] > 0) {
            z[k] = -C.pondBed;
            made++;
          }
    }
    return made;
  }

  // `times` passes of a 3 by 3 mean over a coarse-cell array; returns a new array.
  function blur(a, CW, CH, times) {
    let s = a;
    for (let p = 0; p < times; p++) {
      const t = new Float32Array(s.length);
      for (let y = 0; y < CH; y++)
        for (let x = 0; x < CW; x++) {
          let v = 0,
            n = 0;
          const x0 = Math.max(0, x - 1),
            x1 = Math.min(CW - 1, x + 1),
            y0 = Math.max(0, y - 1),
            y1 = Math.min(CH - 1, y + 1);
          for (let Y = y0; Y <= y1; Y++)
            for (let X = x0; X <= x1; X++) {
              v += s[Y * CW + X];
              n++;
            }
          t[y * CW + x] = v / n;
        }
      s = t;
    }
    return s;
  }

  // Rain per coarse cell for a wind (see CLIMATE), on a scale of its own. Cells are walked with the wind, along its longer axis first, so
  // the cells a cell's air comes from (the neighbours against the wind) are always done before it.
  function rainfall(z, CW, CH, dir) {
    const C = CLIMATE,
      N = CW * CH,
      [wx, wy] = dir;
    const land = new Float32Array(N);
    for (let k = 0; k < N; k++) land[k] = Math.max(0, z[k]);
    const zs = blur(land, CW, CH, C.smooth);
    const wgt = DX.map((dx, d) => Math.pow(Math.max(0, -(dx * wx + DY[d] * wy) / DL[d]), C.spread));
    const load = new Float32Array(N),
      rain = new Float32Array(N),
      byX = Math.abs(wx) >= Math.abs(wy);
    const outer = byX ? CW : CH,
      inner = byX ? CH : CW,
      oUp = (byX ? wx : wy) >= 0,
      iUp = (byX ? wy : wx) >= 0;
    for (let a = 0; a < outer; a++)
      for (let b = 0; b < inner; b++) {
        const o = oUp ? a : outer - 1 - a,
          i = iUp ? b : inner - 1 - b,
          x = byX ? o : i,
          y = byX ? i : o,
          k = y * CW + x;
        let h = 0,
          zu = 0,
          w = 0;
        for (let d = 0; d < 8; d++) {
          if (!wgt[d]) continue;
          const X = x + DX[d],
            Y = y + DY[d];
          if (X < 0 || Y < 0 || X >= CW || Y >= CH) continue;
          const j = Y * CW + X;
          h += wgt[d] * load[j];
          zu += wgt[d] * zs[j];
          w += wgt[d];
        }
        if (!w) {
          load[k] = 1;
          continue;
        }
        h /= w;
        zu /= w;
        if (z[k] <= 0) {
          load[k] = h + (1 - h) * C.evap;
          rain[k] = h * C.base;
          continue;
        }
        const up = zs[k] - zu,
          r = Math.min(h, h * (C.base + (up > 0 ? C.rise * up : 0)) * (up < 0 ? 1 - C.lee : 1));
        rain[k] = r;
        load[k] = h - r;
      }
    return blur(rain, CW, CH, 3);
  }

  // Rain and wetness of a world's coarse grid: rain 0..1 between its 2nd and 98th percentile on land (it may pass 1), and wet, what a
  // valley floor adds to its moisture (0..valley * valleyMost).
  function climate(z, CW, CH, dir) {
    const C = CLIMATE,
      N = CW * CH,
      raw = rainfall(z, CW, CH, dir),
      on = [];
    for (let k = 0; k < N; k++) if (z[k] > 0) on.push(raw[k]);
    const s = Float32Array.from(on).sort(),
      lo = s[(s.length * 0.02) | 0] || 0,
      hi = s[(s.length * 0.98) | 0] || 1,
      span = Math.max(1e-9, hi - lo);
    const acc = catchment(drainage(z, CW, CH), N, raw),
      rain = new Float32Array(N),
      wet = new Float32Array(N);
    for (let k = 0; k < N; k++) {
      rain[k] = Math.max(0, (raw[k] - lo) / span);
      if (acc[k] > 0) wet[k] = C.valley * Math.min(C.valleyMost, Math.max(0, Math.log(acc[k] / (hi * C.valleyFrom))));
    }
    return { rain, wet: blur(wet, CW, CH, 4) };
  }

  // Moisture of the land tiles from their wetness: the values of `was` (the generator's noise moisture) handed out again in the order of
  // `wetness`, ties by tile, so the world is as moist as it was, tile for tile in number, and only where it is moist follows the weather:
  // each biome keeps its share of the land. Writes hm for the tiles listed.
  function moisture(tiles, wetness, was, hm) {
    const byWet = tiles.slice().sort((a, b) => wetness[a] - wetness[b] || a - b),
      vals = Float32Array.from(tiles, (i) => was[i]).sort();
    byWet.forEach((i, r) => {
      hm[i] = vals[r];
    });
  }

  // The climate of a world's tiles, for gen.js: t is {elev, CW, CH, csample, hx, hy, hm, N, land (its land tiles)} and rand a seeded source.
  // Rewrites hm on the land and returns {wind, rain}: the wind, and each land tile's rain, 0..1.
  function tiles(t, rand) {
    const C = CLIMATE,
      dir = wind(rand),
      cl = climate(t.elev, t.CW, t.CH, dir),
      rain = new Float32Array(t.N),
      wetness = new Float32Array(t.N);
    for (const i of t.land) {
      const r = t.csample(cl.rain, t.hx[i], t.hy[i]);
      rain[i] = Math.min(1, r);
      wetness[i] = r + t.csample(cl.wet, t.hx[i], t.hy[i]) + C.noise * t.hm[i];
    }
    moisture(t.land, wetness, t.hm, t.hm);
    return { wind: dir, rain };
  }

  return { CLIMATE, wind, drainage, catchment, erode, pond, shape, rainfall, climate, moisture, tiles };
})();
