// @sys gen: assembly of the seeded archipelago's terrain, tile and region data, and the public ArchGen API
const ArchGen = (() => {
  const { mulberry32, makeSimplex, fbm, smooth } = VB['gen/noise'];
  const { COVER: BASE_COVER } = VB['gen/biomes'];
  const { B, BIOMES } = VB['world/biomes'],
    Grid = VB['world/grid'],
    { DIR_EVEN, DIR_ODD, toAxial, hexDist } = Grid;
  const SQ3 = Math.sqrt(3);

  const SYL_A = ['Ska', 'Ul', 'Ve', 'Ar', 'Tor', 'Mal', 'Sig', 'Bre', 'Hal', 'Ost', 'Fje', 'Lun', 'Rå', 'Gry', 'Ny'];
  const SYL_B = ['ra', 'vi', 'no', 'sa', 'ke', 'li', '', '', 'de'];
  const SYL_C = ['holm', 'ö', 'skär', 'nes', 'vik', 'sund', 'ey', 'land', 'by'];

  function* generate(seed, opt = {}) {
    // opt.cover: thresholds that replace COVER's for this world (the tests' probe islands keep the open island's, tests/lib/probe.js)
    const COVER = opt.cover ? { ...BASE_COVER, ...opt.cover } : BASE_COVER;
    const Cover = VB['gen/cover'];
    const R = opt.R || 28,
      COLS = opt.cols || 280,
      ROWS = opt.rows || 200,
      RR = opt.regionRadius || 7;
    const HW = SQ3 * R,
      AP = (SQ3 / 2) * R;
    const W = Math.ceil(HW * (COLS + 0.5)),
      H = Math.ceil(1.5 * R * (ROWS - 1) + 2 * R);
    const KS = W / 3264; // relative to the first prototype, for features tuned in map units
    const rand = mulberry32(seed);
    const n1 = makeSimplex(rand),
      n2 = makeSimplex(rand),
      n3 = makeSimplex(rand),
      n4 = makeSimplex(rand);
    const STEP = 16,
      CW = Math.ceil(W / STEP) + 2,
      CH = Math.ceil(H / STEP) + 2,
      CN = CW * CH;
    const S = H;
    const h0 = new Float32Array(CN),
      wxa = new Float32Array(CN),
      wya = new Float32Array(CN);
    for (let cy = 0; cy < CH; cy++) {
      for (let cx = 0; cx < CW; cx++) {
        const x = cx * STEP,
          y = cy * STEP,
          u = x / S,
          v = y / S;
        const wx = fbm(n2, u * 1.4 + 11.3, v * 1.4 - 4.1, 2) * 0.2;
        const wy = fbm(n2, u * 1.4 - 7.7, v * 1.4 + 9.2, 2) * 0.2;
        // warp bends the coastlines; applying it fully to fine octaves would smear them into streaks
        let h = 0,
          a = 1,
          f = 2.3,
          t = 0;
        for (let o = 0; o < 8; o++) {
          const wk = o < 3 ? 1 : 0.12;
          h += a * n1((u + wx * wk) * f, (v + wy * wk) * f);
          t += a;
          a *= 0.5;
          f *= 2.03;
        }
        h /= t;
        const nx = x / W,
          ny = y / H,
          e = Math.min(nx, 1 - nx, ny, 1 - ny);
        const k = cy * CW + cx;
        h0[k] = h * 0.9 - (1 - smooth(0.0, 0.17, e)) * 0.55;
        wxa[k] = wx;
        wya[k] = wy;
      }
    }
    yield 0.3;
    const sorted = Float32Array.from(h0).sort();
    const landFrac = opt.landFrac || 0.36;
    const sea = sorted[Math.floor((1 - landFrac) * CN)];
    const hf = new Float32Array(CN);
    let mx = -Infinity,
      mn = Infinity;
    for (let k = 0; k < CN; k++) {
      const land = smooth(sea, sea + 0.14, h0[k]);
      let m = 0;
      if (land > 0) {
        const cx = k % CW,
          cy = (k / CW) | 0,
          u = (cx * STEP) / S,
          v = (cy * STEP) / S;
        const mm = smooth(0.2, 0.5, fbm(n3, u * 1.5 + 40, v * 1.5 + 40, 3));
        if (mm > 0) {
          let sr = 0,
            a = 1,
            f = 4.2,
            t = 0,
            wt = 1;
          for (let o = 0; o < 6; o++) {
            const wk = o < 2 ? 1 : 0.15;
            let r = 1 - Math.abs(n3((u + wxa[k] * wk) * f, (v + wya[k] * wk) * f));
            r *= r;
            r *= wt;
            wt = Math.min(1, r * 1.6);
            sr += a * r;
            t += a;
            a *= 0.5;
            f *= 2.1;
          }
          m = (mm * sr) / t;
        }
      }
      const v = h0[k] + land * (m * 0.5 + 0.03);
      hf[k] = v;
      if (v > mx) mx = v;
      if (v < mn) mn = v;
    }
    yield 0.55;
    const elev = new Float32Array(CN);
    for (let k = 0; k < CN; k++) {
      const v = hf[k];
      elev[k] = v >= sea ? Math.pow((v - sea) / (mx - sea), 0.9) : -Math.pow((sea - v) / (sea - mn), 0.7);
    }
    VB['gen/climate'].shape(elev, CW, CH); // running water cuts its valleys and ponds in its basins before the tiles read the relief
    const moist = new Float32Array(CN),
      macro = new Float32Array(CN);
    for (let cy = 0; cy < CH; cy++) {
      for (let cx = 0; cx < CW; cx++) {
        const k = cy * CW + cx;
        const u = (cx * STEP) / S,
          v = (cy * STEP) / S;
        moist[k] = 0.5 + 0.8 * fbm(n4, u * 2.6 + 70, v * 2.6 - 30, 4);
        macro[k] = 0.5 + 0.9 * fbm(n4, u * 9 + 3, v * 9 + 8, 3);
      }
    }
    const csample = (arr, x, y) => Grid.csample({ STEP, CW, CH }, arr, x, y);
    yield 0.75;

    // ---- tiles ----
    const N = COLS * ROWS;
    const hx = new Float32Array(N),
      hy = new Float32Array(N),
      he = new Float32Array(N),
      hm = new Float32Array(N);
    const biome = new Uint8Array(N),
      water = new Uint8Array(N),
      hrnd = new Float32Array(N),
      nb = new Int32Array(N * 6);
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const i = row * COLS + col;
        hx[i] = HW * (col + 0.5 * (row & 1)) + AP;
        hy[i] = 1.5 * R * row + R;
        let s = 2 * csample(elev, hx[i], hy[i]);
        for (let d = 0, a = Math.PI / 6; d < 6; d++, a += Math.PI / 3)
          s += csample(elev, hx[i] + Math.cos(a) * R * 0.6, hy[i] + Math.sin(a) * R * 0.6);
        he[i] = s / 8;
        const u = hx[i] / S,
          v = hy[i] / S;
        hm[i] = csample(moist, hx[i], hy[i]) + 0.14 * fbm(n4, u * 30 + 5, v * 30 - 9, 2);
        water[i] = he[i] <= 0 ? 1 : 0;
        hrnd[i] = rand();
        const dirs = row & 1 ? DIR_ODD : DIR_EVEN;
        for (let d = 0; d < 6; d++) {
          const c2 = col + dirs[d][0],
            r2 = row + dirs[d][1];
          nb[i * 6 + d] = c2 >= 0 && c2 < COLS && r2 >= 0 && r2 < ROWS ? r2 * COLS + c2 : -1;
        }
      }
    }
    // Drop single-tile ponds and specks: they read as noise at this scale.
    for (let i = 0; i < N; i++) {
      let same = 0,
        tot = 0;
      for (let d = 0; d < 6; d++) {
        const j = nb[i * 6 + d];
        if (j >= 0) {
          tot++;
          if (water[j] === water[i]) same++;
        }
      }
      if (tot === 6 && same === 0) {
        water[i] = 1 - water[i];
        he[i] = water[i] ? -0.01 : 0.01;
      }
    }
    const ocean = new Uint8Array(N),
      q = [];
    for (let i = 0; i < N; i++) {
      const row = (i / COLS) | 0,
        col = i % COLS;
      if (water[i] && (row === 0 || col === 0 || row === ROWS - 1 || col === COLS - 1)) {
        ocean[i] = 1;
        q.push(i);
      }
    }
    for (let h = 0; h < q.length; h++) {
      const i = q[h];
      for (let d = 0; d < 6; d++) {
        const j = nb[i * 6 + d];
        if (j >= 0 && water[j] && !ocean[j]) {
          ocean[j] = 1;
          q.push(j);
        }
      }
    }
    const landDist = new Int16Array(N).fill(999),
      q2 = [];
    for (let i = 0; i < N; i++)
      if (!water[i]) {
        landDist[i] = 0;
        q2.push(i);
      }
    for (let h = 0; h < q2.length; h++) {
      const i = q2[h];
      for (let d = 0; d < 6; d++) {
        const j = nb[i * 6 + d];
        if (j >= 0 && landDist[j] > landDist[i] + 1) {
          landDist[j] = landDist[i] + 1;
          q2.push(j);
        }
      }
    }
    const landIdx = [],
      hp = new Float32Array(N);
    for (let i = 0; i < N; i++) if (!water[i]) landIdx.push(i);
    // moisture, noise so far, is dealt out again by the rain of the seed's wind (gen/climate)
    const { wind, rain } = VB['gen/climate'].tiles(
      { elev, CW, CH, csample, hx, hy, hm, N, land: landIdx },
      mulberry32(seed ^ 0xc11a7e),
    );
    landIdx
      .sort((a, b) => he[a] - he[b])
      .forEach((i, r) => {
        hp[i] = r / Math.max(1, landIdx.length - 1);
      });
    for (let i = 0; i < N; i++) {
      if (water[i]) {
        biome[i] = !ocean[i] ? B.LAKE : landDist[i] <= 2 ? B.SHALLOW : landDist[i] <= 12 ? B.SEA : B.DEEP;
        continue;
      }
      let coast = false;
      for (let d = 0; d < 6; d++) {
        const j = nb[i * 6 + d];
        if (j >= 0 && water[j]) coast = true;
      }
      const p = hp[i];
      const m = Math.max(0, Math.min(1, hm[i] + (coast ? 0.05 : 0) - p * 0.15));
      hm[i] = m;
      let b;
      if (p > COVER.snow) b = B.SNOW;
      else if (p > COVER.mountain) b = B.MOUNTAIN;
      else if (coast && p < COVER.shore) b = m > COVER.shoreMarsh ? B.MARSH : B.BEACH;
      else if (p > COVER.upland) b = m > COVER.uplandPine ? B.PINE : B.HILLS;
      else if (m < COVER.heath) b = B.HEATH;
      else if (m < COVER.meadow) b = B.MEADOW;
      else if (m < COVER.forest) b = B.FOREST;
      else b = p < COVER.marshLow && m > COVER.marshWet ? B.MARSH : B.PINE;
      biome[i] = b;
    }

    // ---- trees: a count per forest tile, +-20% around 60 (broadleaf) or 80 (pine) at full cover ----
    const trees = new Float32Array(N),
      treesMax = new Uint8Array(N);
    for (let i = 0; i < N; i++) {
      if (biome[i] !== B.FOREST && biome[i] !== B.PINE) continue;
      trees[i] = treesMax[i] = Cover.fullTrees(seed, i, biome[i]);
    }

    // ---- stones: every meadow tile has at least 30; up to +100 more next to hills, fading to nothing beyond 2 tiles ----
    const stones = new Uint8Array(N),
      hillDist = new Uint8Array(N).fill(9),
      hq = [];
    for (let i = 0; i < N; i++)
      if (biome[i] === B.HILLS) {
        hillDist[i] = 0;
        hq.push(i);
      }
    for (let h = 0; h < hq.length; h++) {
      const i = hq[h];
      if (hillDist[i] >= 3) continue;
      for (let d = 0; d < 6; d++) {
        const j = nb[i * 6 + d];
        if (j >= 0 && hillDist[j] > hillDist[i] + 1) {
          hillDist[j] = hillDist[i] + 1;
          hq.push(j);
        }
      }
    }
    for (let i = 0; i < N; i++) {
      if (biome[i] !== B.MEADOW) continue;
      stones[i] = Cover.meadowStones(seed, i, csample(macro, hx[i], hy[i]), hillDist[i]);
    }
    const rivers = VB['gen/rivers'].trace({ N, nb, he, hm, water, ocean, biome }, mulberry32(seed ^ 0x2177e5));

    // ---- regions: hexagonal patches of radius RR (3RR(RR+1)+1 tiles) that tile the plane exactly ----
    const v1q = RR + 1,
      v1r = RR,
      v2q = -RR,
      v2r = 2 * RR + 1,
      det = v1q * v2r - v2q * v1r;
    const region = new Int32Array(N),
      regKey = new Map(),
      regions = [];
    for (let i = 0; i < N; i++) {
      const [aq, ar] = toAxial(i % COLS, (i / COLS) | 0);
      const fa = (aq * v2r - ar * v2q) / det,
        fb = (v1q * ar - v1r * aq) / det;
      let best = null;
      for (let da = -1; da <= 2 && !best; da++)
        for (let db = -1; db <= 2; db++) {
          const a = Math.floor(fa) + da,
            b = Math.floor(fb) + db;
          const cq = a * v1q + b * v2q,
            cr = a * v1r + b * v2r;
          if (hexDist(aq, ar, cq, cr) <= RR) {
            best = [a, b, cq, cr];
            break;
          }
        }
      const key = best[0] + ',' + best[1];
      let id = regKey.get(key);
      if (id === undefined) {
        id = regions.length;
        regKey.set(key, id);
        regions.push({ cq: best[2], cr: best[3], tiles: 0, land: 0 });
      }
      region[i] = id;
      regions[id].tiles++;
      if (!water[i]) regions[id].land++;
    }
    // number land regions in reading order of their centres, so labels are stable and meaningful
    const order = regions
      .map((r, id) => id)
      .filter((id) => regions[id].land > 0)
      .sort((a, b) => regions[a].cr - regions[b].cr || regions[a].cq - regions[b].cq);
    order.forEach((id, k) => {
      regions[id].label = k + 1;
    });

    const name =
      SYL_A[(rand() * SYL_A.length) | 0] + SYL_B[(rand() * SYL_B.length) | 0] + SYL_C[(rand() * SYL_C.length) | 0];
    // @state w.lat: number; the world's latitude, degrees north at its middle row: the climate it was made in (sim/climate CLIMATE.worlds,
    //   VB-807), not drawn from the seed, so a seed's island is the same in every climate; 59, the middle world's, where none is given
    // @state w.seed,name: number, string; the generator seed and the map's name
    // @state w.R,COLS,ROWS,RR: numbers; hex circumradius (map units), grid columns, grid rows, region radius (tiles)
    // @state w.W,H,HW,AP: numbers; map width and height, hex width and hex apothem (map units)
    // @state w.N,STEP,CW,CH,KS: numbers; tile count COLS*ROWS, coarse-grid step (map units), coarse grid size, scale vs the first prototype
    // @state w.elev,macro: Float32Array per coarse cell (CW*CH); elevation (<0 sea floor, 0..1 land), tint (the map's colours, the light
    //   of the relief and the distance to the land are the page's paint, draw/paint, VB-1504)
    // @state w.hx,hy: Float32Array per tile; tile centre in map units
    // @state w.he,hp,hm: Float32Array per tile; elevation (<=0 water), land elevation rank 0..1, moisture 0..1
    // @state w.wind,rain: [x, y], Float32Array per tile; the way the seed's wind blows (unit vector), a land tile's rain 0..1 (gen/climate)
    // @state w.biome: Uint8Array per tile; B.* code
    // @state w.water,ocean: Uint8Array per tile; 1 = water, 1 = open sea (0 for lakes)
    // @state w.hrnd: Float32Array per tile; fixed random number 0..1
    // @state w.landDist: Int16Array per tile; steps to the nearest land tile (0 on land, 999 if none)
    // @state w.nb: Int32Array, 6 per tile; neighbour tile indexes in direction order, -1 off the map
    // @state w.region: Int32Array per tile; index into w.regions
    // @state w.regions[]: {cq, cr, tiles, land, label}; hex patch centre, tile count, land tile count, 1.. label for land regions
    // @state w.trees,treesMax: Float32Array, Uint8Array per tile; trees standing and at full cover (forest tiles only, 0 elsewhere)
    // @state w.stones: Uint8Array per tile; stones on meadow tiles, 30..255 (few < 85, some < 170, many above); 0 elsewhere and on fields
    return {
      seed,
      lat: typeof opt.lat === 'number' ? opt.lat : 59,
      name,
      R,
      COLS,
      ROWS,
      RR,
      W,
      H,
      HW,
      AP,
      N,
      STEP,
      CW,
      CH,
      KS,
      elev,
      macro,
      hx,
      hy,
      he,
      hp,
      hm,
      wind,
      rain,
      biome,
      water,
      ocean,
      hrnd,
      nb,
      landDist,
      region,
      regions,
      trees,
      treesMax,
      stones,
      ...rivers,
      ...VB['gen/geology'].lay({ N, nb, hx, hy, hp, hm, water, biome, river: rivers.river, W, H, R, seed }),
    };
  }

  return {
    generate,
    BIOMES,
    COVER: BASE_COVER,
  };
})();
VB['gen'] = ArchGen;
if (typeof globalThis !== 'undefined') globalThis.ArchGen = ArchGen; // the page script reads it (VB-374)
if (typeof module !== 'undefined') module.exports = ArchGen;
