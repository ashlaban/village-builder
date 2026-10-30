// @sys gen: seeded terrain, hex tiles, regions and the painterly chunk bake
// ===== Archipelago generator: seeded terrain, hex tiles, regions, chunked painterly bake =====
const ArchGen = (() => {
  const SQ3 = Math.sqrt(3);

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function makeSimplex(rand) {
    const p = new Uint8Array(256), perm = new Uint8Array(512);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) { const j = (rand() * (i + 1)) | 0; const t = p[i]; p[i] = p[j]; p[j] = t; }
    for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
    const GX = [1, -1, 1, -1, 1, -1, 0, 0], GY = [1, 1, -1, -1, 0, 0, 1, -1];
    const F2 = 0.5 * (SQ3 - 1), G2 = (3 - SQ3) / 6;
    return function (x, y) {
      const s = (x + y) * F2, i = Math.floor(x + s), j = Math.floor(y + s);
      const t = (i + j) * G2, x0 = x - (i - t), y0 = y - (j - t);
      const i1 = x0 > y0 ? 1 : 0, j1 = 1 - i1;
      const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2, x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
      const ii = i & 255, jj = j & 255;
      let n = 0, tt, g;
      tt = 0.5 - x0 * x0 - y0 * y0;
      if (tt > 0) { g = perm[ii + perm[jj]] & 7; tt *= tt; n += tt * tt * (GX[g] * x0 + GY[g] * y0); }
      tt = 0.5 - x1 * x1 - y1 * y1;
      if (tt > 0) { g = perm[ii + i1 + perm[jj + j1]] & 7; tt *= tt; n += tt * tt * (GX[g] * x1 + GY[g] * y1); }
      tt = 0.5 - x2 * x2 - y2 * y2;
      if (tt > 0) { g = perm[ii + 1 + perm[jj + 1]] & 7; tt *= tt; n += tt * tt * (GX[g] * x2 + GY[g] * y2); }
      return 70 * n;
    };
  }

  function fbm(n, x, y, oct) {
    let s = 0, a = 1, f = 1, t = 0;
    for (let o = 0; o < oct; o++) { s += a * n(x * f, y * f); t += a; a *= 0.5; f *= 2.03; }
    return s / t;
  }
  function ridged(n, x, y, oct) {
    let s = 0, a = 1, f = 1, t = 0, w = 1;
    for (let o = 0; o < oct; o++) {
      let r = 1 - Math.abs(n(x * f, y * f)); r *= r; r *= w; w = Math.min(1, r * 1.6);
      s += a * r; t += a; a *= 0.5; f *= 2.1;
    }
    return s / t;
  }
  const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  // Periodic multi-octave value noise, 0..1, used for brush texture lookups.
  function makeTile(rand, size, cells0, oct) {
    const out = new Float32Array(size * size);
    let amp = 1, cells = cells0;
    for (let o = 0; o < oct; o++) {
      const lat = new Float32Array(cells * cells);
      for (let k = 0; k < lat.length; k++) lat[k] = rand();
      for (let y = 0; y < size; y++) {
        const fy = (y / size) * cells, y0 = fy | 0, ty0 = fy - y0, ty = ty0 * ty0 * (3 - 2 * ty0), y1 = (y0 + 1) % cells;
        for (let x = 0; x < size; x++) {
          const fx = (x / size) * cells, x0 = fx | 0, tx0 = fx - x0, tx = tx0 * tx0 * (3 - 2 * tx0), x1 = (x0 + 1) % cells;
          const a = lat[y0 * cells + x0], b = lat[y0 * cells + x1], c = lat[y1 * cells + x0], d = lat[y1 * cells + x1];
          out[y * size + x] += amp * (a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty);
        }
      }
      amp *= 0.5; cells *= 2;
    }
    let mn = Infinity, mx = -Infinity;
    for (const v of out) { if (v < mn) mn = v; if (v > mx) mx = v; }
    for (let k = 0; k < out.length; k++) out[k] = (out[k] - mn) / (mx - mn);
    return out;
  }

  // ---- Biomes ----
  const B = { DEEP: 0, SEA: 1, SHALLOW: 2, LAKE: 3, BEACH: 4, MEADOW: 5, HEATH: 6, FOREST: 7, PINE: 8, MARSH: 9, HILLS: 10, MOUNTAIN: 11, SNOW: 12 };
  const BIOMES = [
    { key: 'deep', name: 'Open sea', water: 1 },
    { key: 'sea', name: 'Sea', water: 1 },
    { key: 'shallow', name: 'Shallows', water: 1 },
    { key: 'lake', name: 'Lake', water: 1 },
    { key: 'beach', name: 'Sandy shore', c: [226, 210, 166], c2: [210, 190, 146], shade: 0.4, bevel: 0.7 },
    { key: 'meadow', name: 'Meadow', c: [139, 176, 84], c2: [172, 182, 90], shade: 0.6, bevel: 1 },
    { key: 'heath', name: 'Heath', c: [162, 154, 100], c2: [148, 120, 110], shade: 0.6, bevel: 1 },
    { key: 'forest', name: 'Broadleaf forest', c: [78, 116, 58], c2: [102, 128, 62], shade: 0.7, bevel: 1 },
    { key: 'pine', name: 'Pine forest', c: [58, 90, 64], c2: [72, 96, 60], shade: 0.95, bevel: 1 },
    { key: 'marsh', name: 'Marsh', c: [108, 136, 80], c2: [126, 140, 84], shade: 0.4, bevel: 0.8 },
    { key: 'hills', name: 'Hills', c: [138, 148, 98], c2: [152, 142, 108], shade: 1.1, bevel: 1 },
    { key: 'mountain', name: 'Mountains', c: [138, 131, 120], c2: [116, 111, 104], shade: 1.45, bevel: 1.1 },
    { key: 'snow', name: 'Snowfields', c: [234, 239, 242], c2: [212, 222, 232], shade: 1.1, bevel: 1.1 },
  ];
  // neighbour directions for pointy-top odd-r: E, NE, NW, W, SW, SE
  const NX = [1, 0.5, -0.5, -1, -0.5, 0.5], NY = [0, -0.866, -0.866, 0, 0.866, 0.866];
  const DIR_EVEN = [[1, 0], [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1]];
  const DIR_ODD = [[1, 0], [1, -1], [0, -1], [-1, 0], [0, 1], [1, 1]];

  const SYL_A = ['Ska', 'Ul', 'Ve', 'Ar', 'Tor', 'Mal', 'Sig', 'Bre', 'Hal', 'Ost', 'Fje', 'Lun', 'Rå', 'Gry', 'Ny'];
  const SYL_B = ['ra', 'vi', 'no', 'sa', 'ke', 'li', '', '', 'de'];
  const SYL_C = ['holm', 'ö', 'skär', 'nes', 'vik', 'sund', 'ey', 'land', 'by'];

  // Level-of-detail pyramid: every chunk is TEX x TEX texels; each level up covers 3x3 chunks of the one below.
  const TEX = 512;
  const LV = [{ size: 512, scale: 1 }, { size: 1536, scale: 1 / 3 }, { size: 4608, scale: 1 / 9 }];

  // Pointy-top odd-r offset <-> axial helpers
  const toAxial = (col, row) => [col - ((row - (row & 1)) >> 1), row];
  const hexDist = (q1, r1, q2, r2) => { const dq = q1 - q2, dr = r1 - r2; return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2; };

  function* generate(seed, opt = {}) {
    const R = opt.R || 28, COLS = opt.cols || 280, ROWS = opt.rows || 200, RR = opt.regionRadius || 7;
    const HW = SQ3 * R, AP = (SQ3 / 2) * R;
    const W = Math.ceil(HW * (COLS + 0.5)), H = Math.ceil(1.5 * R * (ROWS - 1) + 2 * R);
    const KS = W / 3264; // relative to the first prototype, for features tuned in map units
    const rand = mulberry32(seed);
    const n1 = makeSimplex(rand), n2 = makeSimplex(rand), n3 = makeSimplex(rand), n4 = makeSimplex(rand);
    const STEP = 16, CW = Math.ceil(W / STEP) + 2, CH = Math.ceil(H / STEP) + 2, CN = CW * CH;
    const S = H;
    const h0 = new Float32Array(CN), wxa = new Float32Array(CN), wya = new Float32Array(CN);
    for (let cy = 0; cy < CH; cy++) {
      for (let cx = 0; cx < CW; cx++) {
        const x = cx * STEP, y = cy * STEP, u = x / S, v = y / S;
        const wx = fbm(n2, u * 1.4 + 11.3, v * 1.4 - 4.1, 2) * 0.2;
        const wy = fbm(n2, u * 1.4 - 7.7, v * 1.4 + 9.2, 2) * 0.2;
        // warp bends the coastlines; applying it fully to fine octaves would smear them into streaks
        let h = 0, a = 1, f = 2.3, t = 0;
        for (let o = 0; o < 8; o++) { const wk = o < 3 ? 1 : 0.12; h += a * n1((u + wx * wk) * f, (v + wy * wk) * f); t += a; a *= 0.5; f *= 2.03; }
        h /= t;
        const nx = x / W, ny = y / H, e = Math.min(nx, 1 - nx, ny, 1 - ny);
        const k = cy * CW + cx;
        h0[k] = h * 0.9 - (1 - smooth(0.0, 0.17, e)) * 0.55;
        wxa[k] = wx; wya[k] = wy;
      }
    }
    yield 0.3;
    const sorted = Float32Array.from(h0).sort();
    const landFrac = opt.landFrac || 0.36;
    const sea = sorted[Math.floor((1 - landFrac) * CN)];
    const hf = new Float32Array(CN);
    let mx = -Infinity, mn = Infinity;
    for (let k = 0; k < CN; k++) {
      const land = smooth(sea, sea + 0.14, h0[k]);
      let m = 0;
      if (land > 0) {
        const cx = k % CW, cy = (k / CW) | 0, u = (cx * STEP) / S, v = (cy * STEP) / S;
        const mm = smooth(0.2, 0.5, fbm(n3, u * 1.5 + 40, v * 1.5 + 40, 3));
        if (mm > 0) {
          let sr = 0, a = 1, f = 4.2, t = 0, wt = 1;
          for (let o = 0; o < 6; o++) {
            const wk = o < 2 ? 1 : 0.15;
            let r = 1 - Math.abs(n3((u + wxa[k] * wk) * f, (v + wya[k] * wk) * f)); r *= r; r *= wt; wt = Math.min(1, r * 1.6);
            sr += a * r; t += a; a *= 0.5; f *= 2.1;
          }
          m = mm * sr / t;
        }
      }
      const v = h0[k] + land * (m * 0.5 + 0.03);
      hf[k] = v; if (v > mx) mx = v; if (v < mn) mn = v;
    }
    yield 0.55;
    const elev = new Float32Array(CN);
    for (let k = 0; k < CN; k++) {
      const v = hf[k];
      elev[k] = v >= sea ? Math.pow((v - sea) / (mx - sea), 0.9) : -Math.pow((sea - v) / (sea - mn), 0.7);
    }
    const ZS = 75 * KS;
    const L = [-0.55, -0.6, 0.58];
    const shade = new Float32Array(CN), moist = new Float32Array(CN), macro = new Float32Array(CN);
    for (let cy = 0; cy < CH; cy++) {
      for (let cx = 0; cx < CW; cx++) {
        const k = cy * CW + cx;
        const xl = cx > 0 ? k - 1 : k, xr = cx < CW - 1 ? k + 1 : k, yu = cy > 0 ? k - CW : k, yd = cy < CH - 1 ? k + CW : k;
        const z = (i) => Math.max(0, elev[i]) * ZS;
        const dzx = (z(xr) - z(xl)) / (2 * STEP), dzy = (z(yd) - z(yu)) / (2 * STEP);
        const nl = Math.hypot(dzx, dzy, 1);
        shade[k] = (-dzx * L[0] - dzy * L[1] + L[2]) / nl / L[2];
        const u = (cx * STEP) / S, v = (cy * STEP) / S;
        moist[k] = 0.5 + 0.8 * fbm(n4, u * 2.6 + 70, v * 2.6 - 30, 4);
        macro[k] = 0.5 + 0.9 * fbm(n4, u * 9 + 3, v * 9 + 8, 3);
      }
    }
    const csample = (arr, x, y) => {
      let gx = x / STEP, gy = y / STEP;
      if (gx < 0) gx = 0; if (gy < 0) gy = 0; if (gx > CW - 1.001) gx = CW - 1.001; if (gy > CH - 1.001) gy = CH - 1.001;
      const ix = gx | 0, iy = gy | 0, tx = gx - ix, ty = gy - iy, k = iy * CW + ix;
      const a = arr[k], b = arr[k + 1], c = arr[k + CW], d = arr[k + CW + 1];
      return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
    };
    yield 0.75;

    // ---- tiles ----
    const N = COLS * ROWS;
    const hx = new Float32Array(N), hy = new Float32Array(N), he = new Float32Array(N), hm = new Float32Array(N);
    const biome = new Uint8Array(N), water = new Uint8Array(N), hrnd = new Float32Array(N), nb = new Int32Array(N * 6);
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const i = row * COLS + col;
        hx[i] = HW * (col + 0.5 * (row & 1)) + AP; hy[i] = 1.5 * R * row + R;
        let s = 2 * csample(elev, hx[i], hy[i]);
        for (let d = 0; d < 6; d++) s += csample(elev, hx[i] + Math.cos(d * Math.PI / 3 + Math.PI / 6) * R * 0.6, hy[i] + Math.sin(d * Math.PI / 3 + Math.PI / 6) * R * 0.6);
        he[i] = s / 8;
        const u = hx[i] / S, v = hy[i] / S;
        hm[i] = csample(moist, hx[i], hy[i]) + 0.14 * fbm(n4, u * 30 + 5, v * 30 - 9, 2);
        water[i] = he[i] <= 0 ? 1 : 0;
        hrnd[i] = rand();
        const dirs = row & 1 ? DIR_ODD : DIR_EVEN;
        for (let d = 0; d < 6; d++) {
          const c2 = col + dirs[d][0], r2 = row + dirs[d][1];
          nb[i * 6 + d] = c2 >= 0 && c2 < COLS && r2 >= 0 && r2 < ROWS ? r2 * COLS + c2 : -1;
        }
      }
    }
    // Drop single-tile ponds and specks: they read as noise at this scale.
    for (let i = 0; i < N; i++) {
      let same = 0, tot = 0;
      for (let d = 0; d < 6; d++) { const j = nb[i * 6 + d]; if (j >= 0) { tot++; if (water[j] === water[i]) same++; } }
      if (tot === 6 && same === 0) { water[i] = 1 - water[i]; he[i] = water[i] ? -0.01 : 0.01; }
    }
    const ocean = new Uint8Array(N), q = [];
    for (let i = 0; i < N; i++) {
      const row = (i / COLS) | 0, col = i % COLS;
      if (water[i] && (row === 0 || col === 0 || row === ROWS - 1 || col === COLS - 1)) { ocean[i] = 1; q.push(i); }
    }
    for (let h = 0; h < q.length; h++) {
      const i = q[h];
      for (let d = 0; d < 6; d++) { const j = nb[i * 6 + d]; if (j >= 0 && water[j] && !ocean[j]) { ocean[j] = 1; q.push(j); } }
    }
    const landDist = new Int16Array(N).fill(999), q2 = [];
    for (let i = 0; i < N; i++) if (!water[i]) { landDist[i] = 0; q2.push(i); }
    for (let h = 0; h < q2.length; h++) {
      const i = q2[h];
      for (let d = 0; d < 6; d++) { const j = nb[i * 6 + d]; if (j >= 0 && landDist[j] > landDist[i] + 1) { landDist[j] = landDist[i] + 1; q2.push(j); } }
    }
    const landIdx = [];
    for (let i = 0; i < N; i++) if (!water[i]) landIdx.push(i);
    landIdx.sort((a, b) => he[a] - he[b]);
    const hp = new Float32Array(N);
    landIdx.forEach((i, r) => { hp[i] = r / Math.max(1, landIdx.length - 1); });
    for (let i = 0; i < N; i++) {
      if (water[i]) {
        biome[i] = !ocean[i] ? B.LAKE : landDist[i] <= 2 ? B.SHALLOW : landDist[i] <= 12 ? B.SEA : B.DEEP;
        continue;
      }
      let coast = false;
      for (let d = 0; d < 6; d++) { const j = nb[i * 6 + d]; if (j >= 0 && water[j]) coast = true; }
      const p = hp[i];
      const m = Math.max(0, Math.min(1, hm[i] + (coast ? 0.05 : 0) - p * 0.15));
      hm[i] = m;
      let b;
      if (p > 0.975) b = B.SNOW;
      else if (p > 0.9) b = B.MOUNTAIN;
      else if (coast && p < 0.16) b = m > 0.76 ? B.MARSH : B.BEACH;
      else if (p > 0.76) b = m > 0.5 ? B.PINE : B.HILLS;
      else if (m < 0.3) b = B.HEATH;
      else if (m < 0.54) b = B.MEADOW;
      else if (m < 0.7) b = B.FOREST;
      else b = p < 0.22 && m > 0.8 ? B.MARSH : B.PINE;
      biome[i] = b;
    }

    // ---- trees: a count per forest tile, +-20% around 60 (broadleaf) or 80 (pine) at full cover ----
    const trees = new Float32Array(N), treesMax = new Uint8Array(N);
    for (let i = 0; i < N; i++) {
      if (biome[i] !== B.FOREST && biome[i] !== B.PINE) continue;
      const k = Math.round((biome[i] === B.PINE ? 80 : 60) * (0.8 + 0.4 * mulberry32((seed * 31 + i * 2654435761 + 0x7ee5) >>> 0)()));
      trees[i] = treesMax[i] = k;
    }

    // ---- stones: every meadow tile has at least 30; up to +100 more next to hills, fading to nothing beyond 2 tiles ----
    const stones = new Uint8Array(N), hillDist = new Uint8Array(N).fill(9), hq = [];
    for (let i = 0; i < N; i++) if (biome[i] === B.HILLS) { hillDist[i] = 0; hq.push(i); }
    for (let h = 0; h < hq.length; h++) {
      const i = hq[h]; if (hillDist[i] >= 3) continue;
      for (let d = 0; d < 6; d++) { const j = nb[i * 6 + d]; if (j >= 0 && hillDist[j] > hillDist[i] + 1) { hillDist[j] = hillDist[i] + 1; hq.push(j); } }
    }
    for (let i = 0; i < N; i++) {
      if (biome[i] !== B.MEADOW) continue;
      const mc = Math.max(0, Math.min(1, csample(macro, hx[i], hy[i]))), rn = mulberry32((seed * 31 + i * 2654435761 + 0x5707e) >>> 0)();
      const near = hillDist[i] <= 2 ? Math.round((100 * (3 - hillDist[i])) / 2) : 0;
      stones[i] = Math.min(255, 30 + Math.round((0.5 * mc + 0.5 * rn) * 60) + near);
    }
    const { river, riverTo } = VB['gen/rivers'].trace({ N, nb, he, hm, water, ocean, biome }, mulberry32(seed ^ 0x2177e5), [B.HILLS, B.MOUNTAIN, B.MARSH]);

    // ---- regions: hexagonal patches of radius RR (3RR(RR+1)+1 tiles) that tile the plane exactly ----
    const v1q = RR + 1, v1r = RR, v2q = -RR, v2r = 2 * RR + 1, det = v1q * v2r - v2q * v1r;
    const region = new Int32Array(N), regKey = new Map(), regions = [];
    for (let i = 0; i < N; i++) {
      const [aq, ar] = toAxial(i % COLS, (i / COLS) | 0);
      const fa = (aq * v2r - ar * v2q) / det, fb = (v1q * ar - v1r * aq) / det;
      let best = null;
      for (let da = -1; da <= 2 && !best; da++) for (let db = -1; db <= 2; db++) {
        const a = Math.floor(fa) + da, b = Math.floor(fb) + db;
        const cq = a * v1q + b * v2q, cr = a * v1r + b * v2r;
        if (hexDist(aq, ar, cq, cr) <= RR) { best = [a, b, cq, cr]; break; }
      }
      const key = best[0] + ',' + best[1];
      let id = regKey.get(key);
      if (id === undefined) { id = regions.length; regKey.set(key, id); regions.push({ cq: best[2], cr: best[3], tiles: 0, land: 0 }); }
      region[i] = id; regions[id].tiles++; if (!water[i]) regions[id].land++;
    }
    // number land regions in reading order of their centres, so labels are stable and meaningful
    const order = regions.map((r, id) => id).filter((id) => regions[id].land > 0)
      .sort((a, b) => (regions[a].cr - regions[b].cr) || (regions[a].cq - regions[b].cq));
    order.forEach((id, k) => { regions[id].label = k + 1; });

    // per-tile base colour (biome colour, macro variation, tile tint) and brush direction
    const tr = new Float32Array(N), tg = new Float32Array(N), tb = new Float32Array(N), ang = new Float32Array(N * 2);
    for (let i = 0; i < N; i++) {
      const bi = BIOMES[biome[i]];
      const a = (hrnd[i] - 0.5) * 1.4 + 0.5; ang[i * 2] = Math.cos(a); ang[i * 2 + 1] = Math.sin(a);
      if (bi.water) continue;
      const mc = Math.max(0, Math.min(1, csample(macro, hx[i], hy[i]))), t = 1 + (hrnd[i] - 0.5) * 0.07;
      tr[i] = (bi.c[0] + (bi.c2[0] - bi.c[0]) * mc) * t; tg[i] = (bi.c[1] + (bi.c2[1] - bi.c[1]) * mc) * t; tb[i] = (bi.c[2] + (bi.c2[2] - bi.c[2]) * mc) * t;
    }

    // smooth distance-to-land field (chamfer) for water depth colour
    const locC = hexLocator({ R, COLS, ROWS, HW, AP }), oc = [0, 0];
    const cdist = new Float32Array(CN), chex = new Int32Array(CN);
    for (let k = 0; k < CN; k++) {
      const i = locC((k % CW) * STEP, ((k / CW) | 0) * STEP, oc);
      chex[k] = i;
      cdist[k] = i >= 0 && !water[i] ? 0 : 1e9;
    }
    const D1 = STEP, D2 = STEP * Math.SQRT2;
    for (let cy = 0; cy < CH; cy++) for (let cx = 0; cx < CW; cx++) {
      const k = cy * CW + cx; let v = cdist[k];
      if (cx > 0) v = Math.min(v, cdist[k - 1] + D1);
      if (cy > 0) { v = Math.min(v, cdist[k - CW] + D1); if (cx > 0) v = Math.min(v, cdist[k - CW - 1] + D2); if (cx < CW - 1) v = Math.min(v, cdist[k - CW + 1] + D2); }
      cdist[k] = v;
    }
    for (let cy = CH - 1; cy >= 0; cy--) for (let cx = CW - 1; cx >= 0; cx--) {
      const k = cy * CW + cx; let v = cdist[k];
      if (cx < CW - 1) v = Math.min(v, cdist[k + 1] + D1);
      if (cy < CH - 1) { v = Math.min(v, cdist[k + CW] + D1); if (cx < CW - 1) v = Math.min(v, cdist[k + CW + 1] + D2); if (cx > 0) v = Math.min(v, cdist[k + CW - 1] + D2); }
      cdist[k] = v;
    }
    const name = SYL_A[(rand() * SYL_A.length) | 0] + SYL_B[(rand() * SYL_B.length) | 0] + SYL_C[(rand() * SYL_C.length) | 0];
    // @state w.seed,name: number, string; the generator seed and the map's name
    // @state w.R,COLS,ROWS,RR: numbers; hex circumradius (map units), grid columns, grid rows, region radius (tiles)
    // @state w.W,H,HW,AP: numbers; map width and height, hex width and hex apothem (map units)
    // @state w.N,STEP,CW,CH,KS: numbers; tile count COLS*ROWS, coarse-grid step (map units), coarse grid size, scale vs the first prototype
    // @state w.elev,shade,macro: Float32Array per coarse cell (CW*CH); elevation (<0 sea floor, 0..1 land), hillshade (~1 flat), tint
    // @state w.cdist,chex: coarse-cell arrays; distance to the nearest land tile (map units, 1e9 if none), tile index under the cell
    // @state w.csample: function(arr, x, y); bilinear sample of a coarse-cell array at a map position
    // @state w.hx,hy: Float32Array per tile; tile centre in map units
    // @state w.he,hp,hm: Float32Array per tile; elevation (<=0 water), land elevation rank 0..1, moisture 0..1
    // @state w.biome: Uint8Array per tile; B.* code
    // @state w.water,ocean: Uint8Array per tile; 1 = water, 1 = open sea (0 for lakes)
    // @state w.hrnd: Float32Array per tile; fixed random number 0..1
    // @state w.landDist: Int16Array per tile; steps to the nearest land tile (0 on land, 999 if none)
    // @state w.nb: Int32Array, 6 per tile; neighbour tile indexes in direction order, -1 off the map
    // @state w.region: Int32Array per tile; index into w.regions
    // @state w.regions[]: {cq, cr, tiles, land, label}; hex patch centre, tile count, land tile count, 1.. label for land regions
    // @state w.tr,tg,tb: Float32Array per tile; baked tile colour channels, 0..255
    // @state w.ang: Float32Array, 2 per tile; texture direction (cos, sin)
    // @state w.trees,treesMax: Float32Array, Uint8Array per tile; trees standing and at full cover (forest tiles only, 0 elsewhere)
    // @state w.stones: Uint8Array per tile; stones on meadow tiles, 30..255 (few < 85, some < 170, many above); 0 elsewhere and on fields
    // @state w.tile: Float32Array 256*256; tileable noise texture
    return {
      seed, name, R, COLS, ROWS, RR, W, H, HW, AP, N, STEP, CW, CH, KS,
      elev, shade, macro, csample, cdist, chex, hx, hy, he, hp, hm, biome, water, ocean, hrnd, nb, landDist,
      region, regions, tr, tg, tb, ang, trees, treesMax, stones, river, riverTo,
      tile: makeTile(mulberry32(seed ^ 0x9e3779b9), 256, 8, 5),
    };
  }

  function hexLocator(w) {
    const { R, COLS, ROWS, HW, AP } = w;
    return function (px, py, out) {
      const x = px - AP, y = py - R;
      const qf = ((SQ3 / 3) * x - y / 3) / R, rf = ((2 / 3) * y) / R, sf = -qf - rf;
      let q = Math.round(qf), r = Math.round(rf), s = Math.round(sf);
      const dq = Math.abs(q - qf), dr = Math.abs(r - rf), ds = Math.abs(s - sf);
      if (dq > dr && dq > ds) q = -r - s; else if (dr > ds) r = -q - s;
      const row = r, col = q + ((r - (r & 1)) >> 1);
      if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return -1;
      out[0] = px - (HW * (col + 0.5 * (row & 1)) + AP);
      out[1] = py - (1.5 * R * row + R);
      return row * COLS + col;
    };
  }

  // Low-resolution water colour layer, one texel per coarse cell.
  function bakeWater(w, ctx) {
    const { CW, CH, elev, tile, KS } = w;
    const img = ctx.createImageData(CW, CH), D = img.data;
    const stops = [[0, [122, 196, 186]], [0.1, [84, 164, 176]], [0.32, [48, 122, 156]], [0.68, [30, 84, 124]], [1, [22, 58, 96]]];
    const lake = [[0, [104, 168, 160]], [1, [48, 104, 118]]];
    const grad = (st, t) => {
      for (let s = 1; s < st.length; s++) if (t <= st[s][0]) {
        const a = st[s - 1], b = st[s], k = (t - a[0]) / (b[0] - a[0]);
        return [a[1][0] + (b[1][0] - a[1][0]) * k, a[1][1] + (b[1][1] - a[1][1]) * k, a[1][2] + (b[1][2] - a[1][2]) * k];
      }
      return st[st.length - 1][1];
    };
    for (let cy = 0; cy < CH; cy++) for (let cx = 0; cx < CW; cx++) {
      const k = cy * CW + cx, i = w.chex[k];
      const isLake = i >= 0 && w.biome[i] === B.LAKE;
      const d = w.cdist[k];
      const nz = tile[(cy & 255) * 256 + (cx & 255)] - 0.5;
      let c;
      if (isLake) c = grad(lake, Math.min(1, 1 - Math.exp(-d / 70)));
      else {
        const depth = 0.85 * (1 - Math.exp(-d / ((95 + w.macro[k] * 120) * KS))) + 0.15 * Math.min(1, Math.max(0, -elev[k]) * 1.5) + nz * 0.04;
        c = grad(stops, Math.max(0, Math.min(1, depth)));
      }
      const f = 1 + nz * 0.06;
      D[k * 4] = c[0] * f; D[k * 4 + 1] = c[1] * f; D[k * 4 + 2] = c[2] * f; D[k * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }

  // One chunk of the land layer at level l (0 = full detail). Transparent over open water.
  // Generator: yields every 16 texel rows so the caller can spread work across frames.
  function* bakeChunk(w, l, cx, cy, img) {
    const { W, H, AP, biome, hrnd, nb, water, ocean, landDist, tile, shade, csample, tr, tg, tb, ang } = w;
    const lv = LV[l], inv = 1 / lv.scale, x0 = cx * lv.size, y0 = cy * lv.size;
    const full = l === 0, far = l === 2;
    const D = img.data, loc = hexLocator(w), o = [0, 0], pr = new Float32Array(6);
    const LX = -0.62, LY = -0.78, BV = 3.4, SEAM = full ? 0.8 : 1.6;
    const tn = (x, y) => {
      const xf = Math.floor(x), yf = Math.floor(y), tx = x - xf, ty = y - yf;
      const x0 = xf & 255, y0 = yf & 255, x1 = (x0 + 1) & 255, y1 = (y0 + 1) & 255;
      const a = tile[y0 * 256 + x0], b = tile[y0 * 256 + x1], c = tile[y1 * 256 + x0], d = tile[y1 * 256 + x1];
      return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
    };
    const crag = (X, Y) => {
      const a = 1 - Math.abs(2 * tn(X * 0.3 + 13, Y * 0.3 + 57) - 1), c = 1 - Math.abs(2 * tn(X * 0.71 + 91, Y * 0.71 + 7) - 1);
      return a * a + c * c * 0.45;
    };
    for (let ty = 0; ty < TEX; ty++) {
      const y = y0 + (ty + 0.5) * inv;
      if (y < H) for (let tx = 0, p = ty * TEX * 4; tx < TEX; tx++, p += 4) {
        const x = x0 + (tx + 0.5) * inv;
        if (x >= W) break;
        let i = loc(x, y, o);
        if (i < 0 || (water[i] && (far || landDist[i] > 1))) continue;
        let dx = o[0], dy = o[1];
        if (full) {
          // hand-painted tile edges: jitter only matters near an edge, and only re-locates within 2.4 units of one
          const ed0 = AP - Math.max(Math.abs(dx), Math.abs(0.5 * dx - 0.866 * dy), Math.abs(-0.5 * dx - 0.866 * dy));
          if (ed0 < 7.6) {
            const jx = (tn(x * 0.09, y * 0.09) - 0.5) * 3.2, jy = (tn(x * 0.09 + 97, y * 0.09 + 31) - 0.5) * 3.2;
            if (ed0 < 2.4) { i = loc(x + jx, y + jy, o); if (i < 0) continue; dx = o[0]; dy = o[1]; } else { dx += jx; dy += jy; }
          }
        }
        const pa = dx, pb = 0.5 * dx - 0.866 * dy, pc = -0.5 * dx - 0.866 * dy;
        if (water[i]) {
          if (far) continue;
          let md = 99, sd = 99, sl = 0;
          pr[0] = pa; pr[1] = pb; pr[2] = pc; pr[3] = -pa; pr[4] = -pb; pr[5] = -pc;
          for (let d = 0; d < 6; d++) {
            const j = nb[i * 6 + d];
            if (j >= 0 && !water[j]) {
              const dd = AP - pr[d]; if (dd < md) md = dd;
              const lit = NX[d] * LX + NY[d] * LY;
              if (lit > 0.2 && dd < sd) { sd = dd; sl = lit; }
            }
          }
          if (md < 12) {
            const nz = tn(x * 0.35, y * 0.35);
            let a = md < 5.5 ? Math.pow(1 - md / 5.5, 1.6) * (0.55 + 0.45 * nz) : 0;
            if (full) { const ring = Math.abs(md - 8.5); if (ring < 1.1 && nz > 0.42) a = Math.max(a, (1 - ring / 1.1) * 0.32); }
            if (!ocean[i]) a *= 0.6;
            const sa2 = sd < 9 ? Math.pow(1 - sd / 9, 1.5) * 0.32 * sl : 0;
            const A = a + sa2 * (1 - a);
            if (A > 0.002) {
              D[p] = (244 * a + 12 * sa2 * (1 - a)) / A; D[p + 1] = (250 * a + 36 * sa2 * (1 - a)) / A; D[p + 2] = (247 * a + 52 * sa2 * (1 - a)) / A; D[p + 3] = A * 255;
            }
          }
          continue;
        }
        const bt = biome[i], bi = BIOMES[bt];
        let r = tr[i], g = tg[i], b = tb[i];
        let f = 1;
        if (!far) {
          const ca = ang[i * 2], sa = ang[i * 2 + 1];
          f += (tn((x * ca + y * sa) * 0.42 + hrnd[i] * 80, (-x * sa + y * ca) * 0.085) - 0.5) * 0.2;
        } else if (bt === B.FOREST || bt === B.PINE) {
          // far view: canopy texture stands in for the individual trees
          f *= 0.78 + 0.35 * tn(x * 0.12, y * 0.12);
        }
        let sh = csample(shade, x, y) - 1;
        const rocky = bt === B.MOUNTAIN || bt === B.SNOW;
        const lo = rocky ? -0.55 : -0.45, hi = rocky ? 0.45 : 0.32;
        sh = sh < lo ? lo : sh > hi ? hi : sh;
        if (rocky) {
          const h0r = crag(x, y), gx = (crag(x + 1.5, y) - h0r) * 6, gy = (crag(x, y + 1.5) - h0r) * 6;
          let mi = (-gx * -0.55 - gy * -0.6 + 0.58) / Math.sqrt(gx * gx + gy * gy + 1) / 0.58 - 1;
          mi = mi < -0.7 ? -0.7 : mi > 0.45 ? 0.45 : mi;
          f *= 1 + mi * (far ? 0.3 : 0.42);
          if (bt === B.SNOW) { const k = Math.min(1, Math.max(0, (-0.1 - sh - mi * 0.35) * 3)); r += (128 - r) * k; g += (124 - g) * k; b += (128 - b) * k; }
        }
        f *= 1 + sh * bi.shade;
        if (!far) {
          const aa = Math.abs(pa), ab = Math.abs(pb), ac = Math.abs(pc);
          let mp, dir;
          if (aa >= ab && aa >= ac) { mp = aa; dir = pa > 0 ? 0 : 3; } else if (ab >= ac) { mp = ab; dir = pb > 0 ? 1 : 4; } else { mp = ac; dir = pc > 0 ? 2 : 5; }
          const ed = AP - mp;
          const jn = nb[i * 6 + dir], coastEdge = jn >= 0 && water[jn];
          const bw = coastEdge ? BV * 1.5 : BV;
          if (ed < bw) {
            const k = 1 - ed / bw, lit = NX[dir] * LX + NY[dir] * LY;
            f *= 1 + lit * k * (coastEdge ? 0.28 : 0.11) * bi.bevel;
            if (coastEdge && bt !== B.BEACH && lit < 0) f *= 1 - k * 0.25;
            if (coastEdge && bt === B.BEACH) { r -= k * 26; g -= k * 22; b -= k * 12; }
            if (ed < SEAM && !coastEdge) f *= full ? 0.91 : 0.95;
          }
        }
        D[p] = r * f; D[p + 1] = g * f; D[p + 2] = b * f; D[p + 3] = 255;
      }
      if ((ty & 15) === 15) yield ty / TEX;
    }
  }
  // ---- Decoration sprites (pre-rendered small canvases) ----
  function makeSprites(makeCanvas) {
    const S = {};
    const mk = (w, h, fn) => { const c = makeCanvas(w, h); fn(c.getContext('2d')); return c; };
    const rgb = (c, f = 1, a = 1) => `rgba(${(c[0] * f) | 0},${(c[1] * f) | 0},${(c[2] * f) | 0},${a})`;
    S.broad = [];
    const leafs = [[72, 112, 52], [86, 124, 54], [64, 102, 56], [98, 128, 58], [110, 120, 50]];
    for (let v = 0; v < 10; v++) {
      const rnd = mulberry32(1000 + v), col = leafs[v % leafs.length];
      S.broad.push(mk(28, 30, (g) => {
        g.fillStyle = 'rgba(70,48,30,1)'; g.fillRect(13, 18, 2.4, 8);
        const blobs = 4 + ((rnd() * 3) | 0);
        const pts = [];
        for (let k = 0; k < blobs; k++) pts.push([14 + (rnd() - 0.5) * 10, 13 + (rnd() - 0.5) * 8, 4.5 + rnd() * 3]);
        for (const [x, y, r] of pts) { g.fillStyle = rgb(col, 0.68); g.beginPath(); g.arc(x + 0.8, y + 1, r, 0, 7); g.fill(); }
        for (const [x, y, r] of pts) { g.fillStyle = rgb(col, 1); g.beginPath(); g.arc(x, y, r * 0.9, 0, 7); g.fill(); }
        for (const [x, y, r] of pts) { g.fillStyle = rgb(col, 1.28, 0.9); g.beginPath(); g.arc(x - r * 0.3, y - r * 0.35, r * 0.45, 0, 7); g.fill(); }
        for (let k = 0; k < 6; k++) { g.fillStyle = rgb(col, 1.5, 0.5); g.beginPath(); g.arc(9 + rnd() * 10, 7 + rnd() * 9, 0.9, 0, 7); g.fill(); }
      }));
    }
    S.pine = [];
    const needles = [[48, 84, 58], [56, 92, 60], [42, 76, 62], [62, 90, 54]];
    for (let v = 0; v < 8; v++) {
      const rnd = mulberry32(2000 + v), col = needles[v % needles.length], tall = 0.85 + rnd() * 0.3;
      S.pine.push(mk(20, 34, (g) => {
        g.fillStyle = 'rgba(66,44,30,1)'; g.fillRect(9, 26, 2, 6);
        const tiers = 3, top = 34 - 30 * tall;
        for (let t = 0; t < tiers; t++) {
          const y0 = top + (t * (28 * tall)) / tiers, y1 = y0 + (14 * tall), hw = 3.5 + t * 2.3;
          g.fillStyle = rgb(col, 1.18); g.beginPath(); g.moveTo(10, y0); g.lineTo(10 - hw, y1); g.lineTo(10, y1 - 1); g.closePath(); g.fill();
          g.fillStyle = rgb(col, 0.72); g.beginPath(); g.moveTo(10, y0); g.lineTo(10 + hw, y1); g.lineTo(10, y1 - 1); g.closePath(); g.fill();
        }
      }));
    }
    S.shrub = [];
    for (let v = 0; v < 4; v++) {
      const rnd = mulberry32(3000 + v), col = [[112, 104, 66], [96, 98, 60], [128, 100, 84], [104, 86, 70]][v];
      S.shrub.push(mk(12, 10, (g) => {
        for (let k = 0; k < 3; k++) {
          const x = 4 + rnd() * 4, y = 5 + rnd() * 2, r = 2 + rnd() * 1.5;
          g.fillStyle = rgb(col, 0.75); g.beginPath(); g.arc(x + 0.5, y + 0.6, r, 0, 7); g.fill();
          g.fillStyle = rgb(col, 1.1); g.beginPath(); g.arc(x, y, r * 0.8, 0, 7); g.fill();
        }
      }));
    }
    return S;
  }

  // Decorations for one chunk. Items come from every tile near the chunk, so objects that straddle
  // a chunk edge are drawn identically on both sides.
  // Density stage of a tile's trees: 4 (more than 75% of max left) down to 1 (25% or less), 0 when none are left.
  function treeStage(w, i) {
    const t = w.trees[i], m = w.treesMax[i];
    return t <= 0 || m === 0 ? 0 : t > 0.75 * m ? 4 : t > 0.5 * m ? 3 : t > 0.25 * m ? 2 : 1;
  }
  // Changes a tile's biome and its baked base colour (the same formula as in generate).
  function setBiome(w, i, b) {
    const bi = BIOMES[b];
    w.biome[i] = b;
    const mc = Math.max(0, Math.min(1, w.csample(w.macro, w.hx[i], w.hy[i]))), t = 1 + (w.hrnd[i] - 0.5) * 0.07;
    w.tr[i] = (bi.c[0] + (bi.c2[0] - bi.c[0]) * mc) * t;
    w.tg[i] = (bi.c[1] + (bi.c2[1] - bi.c[1]) * mc) * t;
    w.tb[i] = (bi.c[2] + (bi.c2[2] - bi.c[2]) * mc) * t;
  }
  function decorateChunk(w, ctx, l, cx, cy, S) {
    if (l >= 2) return;
    const { R, HW, AP, COLS, ROWS, hx, hy, biome, seed } = w;
    const lv = LV[l], sc = lv.scale, x0 = cx * lv.size, y0 = cy * lv.size, x1 = x0 + lv.size, y1 = y0 + lv.size;
    const full = l === 0, M = 36, items = [];
    const r0 = Math.max(0, Math.floor((y0 - M - R) / (1.5 * R)) - 1), r1 = Math.min(ROWS - 1, Math.ceil((y1 + M - R) / (1.5 * R)) + 1);
    const c0 = Math.max(0, Math.floor((x0 - M - AP) / HW) - 1), c1 = Math.min(COLS - 1, Math.ceil((x1 + M - AP) / HW) + 1);
    for (let row = r0; row <= r1; row++) for (let col = c0; col <= c1; col++) {
      const i = row * COLS + col, b = biome[i];
      if (w.dev && w.dev[i]) continue; // farmland and yards are drawn by the settlement layer
      if (hx[i] < x0 - M - R || hx[i] > x1 + M + R || hy[i] < y0 - M - R || hy[i] > y1 + M + R) continue;
      const rnd = mulberry32((seed * 31 + i * 2654435761) >>> 0);
      const spot = (rr) => { const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * rr * R; return [hx[i] + Math.cos(a) * d, hy[i] + Math.sin(a) * d * 0.9]; };
      if (b === B.FOREST || b === B.PINE) {
        const n = (b === B.PINE ? 4 : 4) + ((rnd() * 2.4) | 0), shown = w.trees ? Math.max(1, Math.round((n * treeStage(w, i)) / 4)) : n;
        for (let k = 0; k < n; k++) {
          const [x, y] = spot(0.62);
          const pine = b === B.PINE ? rnd() < 0.92 : rnd() < 0.15;
          const item = { t: pine ? 'pine' : 'broad', x, y, sc: 0.85 + rnd() * 0.3, v: (rnd() * 10) | 0 };
          if (k < shown) items.push(item);
        }
      } else if (b === B.MEADOW) {
        const u = rnd();
        if (u < 0.07) { const [x, y] = spot(0.4); items.push({ t: 'broad', x, y, sc: 0.95, v: (rnd() * 10) | 0 }); }
        else if (u < 0.13) { const [x, y] = spot(0.5); items.push({ t: 'shrub', x, y, v: (rnd() * 4) | 0 }); }
        if (full) items.push({ t: 'flowers', x: hx[i], y: hy[i], s: (rnd() * 1e9) >>> 0 });
        if (full && w.stones) {
          for (let k = Math.ceil(w.stones[i] / 70); k > 0; k--) { const [x, y] = spot(0.6); items.push({ t: 'stone', x, y, r: 1.8 + rnd() * 2 }); }
        }
      } else if (b === B.HEATH) {
        const n = 2 + ((rnd() * 2) | 0);
        for (let k = 0; k < n; k++) { const [x, y] = spot(0.65); items.push({ t: 'shrub', x, y, v: (rnd() * 4) | 0 }); }
        if (full && rnd() < 0.5) { const [x, y] = spot(0.6); items.push({ t: 'stone', x, y, r: 2 + rnd() * 2 }); }
      } else if (b === B.HILLS) {
        if (rnd() < 0.12) { const [x, y] = spot(0.5); items.push({ t: 'pine', x, y, sc: 0.85, v: (rnd() * 8) | 0 }); }
        if (full) { const n = 1 + ((rnd() * 3) | 0); for (let k = 0; k < n; k++) { const [x, y] = spot(0.65); items.push({ t: 'stone', x, y, r: 2 + rnd() * 3 }); } }
      } else if (b === B.MARSH) {
        items.push({ t: 'marsh', x: hx[i], y: hy[i], s: (rnd() * 1e9) >>> 0 });
      } else if (b === B.BEACH) {
        if (full && rnd() < 0.15) { const [x, y] = spot(0.5); items.push({ t: 'stone', x, y, r: 1.8 + rnd() * 2 }); }
      }
    }
    ctx.setTransform(sc, 0, 0, sc, -x0 * sc, -y0 * sc);
    ctx.fillStyle = 'rgba(28,36,24,0.26)';
    for (const it of items) {
      if (it.t === 'broad' || it.t === 'pine') { ctx.beginPath(); ctx.ellipse(it.x + 3, it.y + 1, 6 * it.sc, 2.8 * it.sc, -0.3, 0, 7); ctx.fill(); }
    }
    items.sort((a, b) => a.y - b.y);
    for (const it of items) {
      if (it.t === 'broad') { const c = S.broad[it.v], k = it.sc * 0.74; ctx.drawImage(c, it.x - 14 * k, it.y - 26 * k, 28 * k, 30 * k); }
      else if (it.t === 'pine') { const c = S.pine[it.v % 8], k = it.sc * 0.72; ctx.drawImage(c, it.x - 10 * k, it.y - 32 * k, 20 * k, 34 * k); }
      else if (it.t === 'shrub') ctx.drawImage(S.shrub[it.v], it.x - 6, it.y - 7, 12, 10);
      else if (it.t === 'stone') {
        ctx.fillStyle = 'rgba(40,40,44,0.25)'; ctx.beginPath(); ctx.ellipse(it.x + 1, it.y + 0.8, it.r * 1.15, it.r * 0.6, 0, 0, 7); ctx.fill();
        ctx.fillStyle = 'rgb(150,146,138)'; ctx.beginPath(); ctx.ellipse(it.x, it.y, it.r, it.r * 0.68, 0, 0, 7); ctx.fill();
        ctx.fillStyle = 'rgba(214,210,200,0.8)'; ctx.beginPath(); ctx.ellipse(it.x - it.r * 0.3, it.y - it.r * 0.25, it.r * 0.4, it.r * 0.22, 0, 0, 7); ctx.fill();
      } else if (it.t === 'flowers') {
        const rnd = mulberry32(it.s), cols = ['rgba(250,250,240,0.85)', 'rgba(244,214,92,0.85)', 'rgba(222,140,170,0.8)', 'rgba(170,150,220,0.8)'];
        const c0 = cols[(rnd() * 4) | 0];
        for (let k = 0; k < 9; k++) {
          const a = rnd() * 6.283, d = Math.sqrt(rnd()) * R * 0.72;
          ctx.fillStyle = rnd() < 0.7 ? c0 : cols[(rnd() * 4) | 0];
          ctx.beginPath(); ctx.arc(it.x + Math.cos(a) * d, it.y + Math.sin(a) * d * 0.9, 0.9 + rnd() * 0.5, 0, 7); ctx.fill();
        }
        ctx.strokeStyle = 'rgba(70,104,48,0.5)'; ctx.lineWidth = 0.9;
        for (let k = 0; k < 5; k++) {
          const a = rnd() * 6.283, d = Math.sqrt(rnd()) * R * 0.7, x = it.x + Math.cos(a) * d, y = it.y + Math.sin(a) * d * 0.9;
          ctx.beginPath(); ctx.moveTo(x - 2, y - 2.5); ctx.lineTo(x, y); ctx.lineTo(x + 1.8, y - 3); ctx.stroke();
        }
      } else if (it.t === 'marsh') {
        const rnd = mulberry32(it.s);
        const n = 1 + ((rnd() * 2) | 0);
        for (let k = 0; k < n; k++) {
          const a = rnd() * 6.283, d = Math.sqrt(rnd()) * R * 0.45, x = it.x + Math.cos(a) * d, y = it.y + Math.sin(a) * d * 0.9, rw = 4 + rnd() * 5;
          ctx.fillStyle = 'rgba(86,132,138,0.9)'; ctx.beginPath(); ctx.ellipse(x, y, rw, rw * 0.5, 0, 0, 7); ctx.fill();
          ctx.fillStyle = 'rgba(170,206,206,0.6)'; ctx.beginPath(); ctx.ellipse(x - rw * 0.25, y - rw * 0.12, rw * 0.45, rw * 0.18, 0, 0, 7); ctx.fill();
        }
        if (full) {
          ctx.strokeStyle = 'rgba(92,96,52,0.85)'; ctx.lineWidth = 0.9;
          for (let k = 0; k < 5; k++) {
            const a = rnd() * 6.283, d = Math.sqrt(rnd()) * R * 0.7, x = it.x + Math.cos(a) * d, y = it.y + Math.sin(a) * d * 0.9;
            for (let s = -1; s <= 1; s++) { ctx.beginPath(); ctx.moveTo(x + s * 1.2, y); ctx.lineTo(x + s * 2, y - 4 - rnd() * 2); ctx.stroke(); }
          }
        }
      }
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  return { generate, bakeWater, bakeChunk, decorateChunk, makeSprites, hexLocator, BIOMES, B, NX, NY, LV, TEX, mulberry32, treeStage, setBiome };
})();
VB['gen'] = ArchGen;
if (typeof module !== 'undefined') module.exports = ArchGen;
