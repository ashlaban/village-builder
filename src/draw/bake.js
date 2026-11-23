// @sys draw/bake: rasterizing the map into levels of detail, including land, water and decorations
VB['draw/bake'] = (() => {
  const { mulberry32 } = VB['gen/noise'];
  const { BIOMES } = VB['gen/biomes'],
    { B, treeStage } = VB['world/biomes'],
    { hexLocator, csample } = VB['world/grid'];

  // Level-of-detail pyramid: every chunk is TEX x TEX texels; each level up covers 3x3 chunks of the one below.
  const TEX = 512;
  const LV = [
    { size: 512, scale: 1 },
    { size: 1536, scale: 1 / 3 },
    { size: 4608, scale: 1 / 9 },
  ];

  // Low-resolution water colour layer, one texel per coarse cell: a painted sea, in flat bands of blue-grey that darken away from the
  // land, each blended into the next over a narrow edge; a lake is one flat colour.
  const SEA = [
      [158, 190, 178],
      [118, 160, 162],
      [88, 132, 146],
      [68, 108, 130],
      [56, 90, 116],
    ],
    LAKE = [126, 164, 164];
  function bakeWater(w, ctx) {
    const { CW, CH, elev, KS } = w;
    const img = ctx.createImageData(CW, CH),
      D = img.data;
    for (let cy = 0; cy < CH; cy++)
      for (let cx = 0; cx < CW; cx++) {
        const k = cy * CW + cx,
          i = w.chex[k];
        let c = LAKE;
        if (!(i >= 0 && w.biome[i] === B.LAKE)) {
          const depth =
            0.85 * (1 - Math.exp(-w.cdist[k] / ((120 + w.macro[k] * 70) * KS))) +
            0.15 * Math.min(1, Math.max(0, -elev[k]) * 1.5);
          const u = Math.max(0, Math.min(0.9999, depth)) * (SEA.length - 1),
            n = Math.floor(u + 0.5),
            fr = u + 0.5 - n;
          const a = SEA[Math.max(0, n - 1)],
            b = SEA[n],
            q = n > 0 && fr < 0.12 ? 0.5 + fr / 0.24 : 1;
          c = [a[0] + (b[0] - a[0]) * q, a[1] + (b[1] - a[1]) * q, a[2] + (b[2] - a[2]) * q];
        }
        D[k * 4] = c[0];
        D[k * 4 + 1] = c[1];
        D[k * 4 + 2] = c[2];
        D[k * 4 + 3] = 255;
      }
    ctx.putImageData(img, 0, 0);
  }

  // One chunk of the land layer at level l (0 = full detail). Transparent over open water.
  // Generator: yields every 16 texel rows so the caller can spread work across frames.
  const INK = [44, 32, 28]; // the contour's colour (page/farmart's MP.line)
  function* bakeChunk(w, l, cx, cy, img) {
    const { W, H, AP, biome, hrnd, nb, water, ocean, landDist, tile, shade, tr, tg, tb } = w;
    const lv = LV[l],
      inv = 1 / lv.scale,
      x0 = cx * lv.size,
      y0 = cy * lv.size;
    const full = l === 0,
      far = l === 2;
    const D = img.data,
      loc = hexLocator(w),
      o = [0, 0],
      pr = new Float32Array(6);
    // the contour of the coast and the seam where two biomes meet, in map units: at least most of a texel wide, blended over half a texel
    const COAST = Math.max(1.5, 0.8 * inv),
      SEAM = Math.max(0.6, 0.45 * inv),
      SOFT = 0.5 * inv;
    const tn = (x, y) => {
      const xf = Math.floor(x),
        yf = Math.floor(y),
        tx = x - xf,
        ty = y - yf;
      const x0 = xf & 255,
        y0 = yf & 255,
        x1 = (x0 + 1) & 255,
        y1 = (y0 + 1) & 255;
      const a = tile[y0 * 256 + x0],
        b = tile[y0 * 256 + x1],
        c = tile[y1 * 256 + x0],
        d = tile[y1 * 256 + x1];
      return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
    };
    for (let ty = 0; ty < TEX; ty++) {
      const y = y0 + (ty + 0.5) * inv;
      if (y < H)
        for (let tx = 0, p = ty * TEX * 4; tx < TEX; tx++, p += 4) {
          const x = x0 + (tx + 0.5) * inv;
          if (x >= W) break;
          let i = loc(x, y, o);
          if (i < 0 || (water[i] && (far || landDist[i] > 1))) continue;
          let dx = o[0],
            dy = o[1];
          if (full) {
            // hand-painted tile edges: jitter only matters near an edge, and only re-locates within 2.4 units of one
            const ed0 = AP - Math.max(Math.abs(dx), Math.abs(0.5 * dx - 0.866 * dy), Math.abs(-0.5 * dx - 0.866 * dy));
            if (ed0 < 7.6) {
              const jx = (tn(x * 0.09, y * 0.09) - 0.5) * 3.2,
                jy = (tn(x * 0.09 + 97, y * 0.09 + 31) - 0.5) * 3.2;
              if (ed0 < 2.4) {
                i = loc(x + jx, y + jy, o);
                if (i < 0) continue;
                dx = o[0];
                dy = o[1];
              } else {
                dx += jx;
                dy += jy;
              }
            }
          }
          const pa = dx,
            pb = 0.5 * dx - 0.866 * dy,
            pc = -0.5 * dx - 0.866 * dy;
          if (water[i]) {
            if (far) continue;
            // the shore: a band of limewash along the land and, on the closer levels, one fine line off it
            let md = 99;
            pr[0] = pa;
            pr[1] = pb;
            pr[2] = pc;
            pr[3] = -pa;
            pr[4] = -pb;
            pr[5] = -pc;
            for (let d = 0; d < 6; d++) {
              const j = nb[i * 6 + d];
              if (j >= 0 && !water[j] && AP - pr[d] < md) md = AP - pr[d];
            }
            const A =
              Math.max(
                md < 3.2 ? 0.86 : 0,
                Math.max(0, 1 - Math.abs(md - 7.6) / (0.55 * Math.max(1, inv * 0.6))) * 0.5,
              ) * (ocean[i] ? 1 : 0.7);
            if (A > 0.002) {
              D[p] = 238;
              D[p + 1] = 238;
              D[p + 2] = 222;
              D[p + 3] = A * 255;
            }
            continue;
          }
          // Land, as a mural's ground: the tile's flat pigment with the mottling of old plaster, under the light of the land's own relief
          // (so that height reads), with no bevel round a tile: one dark contour along the coast and a faint seam where two biomes meet.
          const bt = biome[i];
          let f = 1 + (tn(x * 0.045 + 7, y * 0.045 + 3) - 0.5) * 0.07;
          if (!far) f += (tn(x * 0.8, y * 0.8) - 0.5) * 0.035;
          else if (bt === B.FOREST || bt === B.PINE) f *= tn(x * 0.12, y * 0.12) > 0.5 ? 1.04 : 0.9; // far view: canopy stands in for the trees
          const sh = csample(w, shade, x, y) - 1;
          f *= 1 + (sh < -0.45 ? -0.45 : sh > 0.32 ? 0.32 : sh) * BIOMES[bt].shade;
          const aa = Math.abs(pa),
            ab = Math.abs(pb),
            ac = Math.abs(pc);
          let mp, dir;
          if (aa >= ab && aa >= ac) {
            mp = aa;
            dir = pa > 0 ? 0 : 3;
          } else if (ab >= ac) {
            mp = ab;
            dir = pb > 0 ? 1 : 4;
          } else {
            mp = ac;
            dir = pc > 0 ? 2 : 5;
          }
          const ed = AP - mp,
            jn = nb[i * 6 + dir];
          let k = 0;
          if (jn >= 0 && water[jn]) k = Math.min(1, Math.max(0, (COAST - ed) / SOFT)) * (far ? 0.8 : 1);
          else if (jn >= 0 && !far && biome[jn] !== bt) k = Math.min(1, Math.max(0, (SEAM - ed) / SOFT)) * 0.3;
          const r = tr[i] * f,
            g = tg[i] * f,
            b = tb[i] * f;
          D[p] = r + (INK[0] - r) * k;
          D[p + 1] = g + (INK[1] - g) * k;
          D[p + 2] = b + (INK[2] - b) * k;
          D[p + 3] = 255;
        }
      if ((ty & 15) === 15) yield ty / TEX;
    }
  }

  // Decorations for one chunk. Items come from every tile near the chunk, so objects that straddle
  // a chunk edge are drawn identically on both sides.
  function decorateChunk(w, ctx, l, cx, cy, S) {
    if (l >= 2) return;
    const { R, HW, AP, COLS, ROWS, hx, hy, biome, seed } = w;
    const lv = LV[l],
      sc = lv.scale,
      x0 = cx * lv.size,
      y0 = cy * lv.size,
      x1 = x0 + lv.size,
      y1 = y0 + lv.size;
    const full = l === 0,
      M = 36,
      items = [];
    const r0 = Math.max(0, Math.floor((y0 - M - R) / (1.5 * R)) - 1),
      r1 = Math.min(ROWS - 1, Math.ceil((y1 + M - R) / (1.5 * R)) + 1);
    const c0 = Math.max(0, Math.floor((x0 - M - AP) / HW) - 1),
      c1 = Math.min(COLS - 1, Math.ceil((x1 + M - AP) / HW) + 1);
    for (let row = r0; row <= r1; row++)
      for (let col = c0; col <= c1; col++) {
        const i = row * COLS + col,
          b = w.trees && w.trees[i] > 0 && biome[i] < B.FOREST ? B.FOREST : biome[i]; // scrub drawn as wood (VB-091)
        if (w.dev && w.dev[i]) continue; // farmland and yards are drawn by the settlement layer
        if (hx[i] < x0 - M - R || hx[i] > x1 + M + R || hy[i] < y0 - M - R || hy[i] > y1 + M + R) continue;
        const rnd = mulberry32((seed * 31 + i * 2654435761) >>> 0);
        const spot = (rr) => {
          const a = rnd() * Math.PI * 2,
            d = Math.sqrt(rnd()) * rr * R;
          return [hx[i] + Math.cos(a) * d, hy[i] + Math.sin(a) * d * 0.9];
        };
        if (b === B.FOREST || b === B.PINE) {
          const n = (b === B.PINE ? 4 : 4) + ((rnd() * 2.4) | 0),
            shown = w.trees ? Math.max(1, Math.round((n * treeStage(w, i)) / 4)) : n;
          for (let k = 0; k < n; k++) {
            const [x, y] = spot(0.62);
            const pine = b === B.PINE ? rnd() < 0.92 : rnd() < 0.15;
            const item = { t: pine ? 'pine' : 'broad', x, y, sc: 0.85 + rnd() * 0.3, v: (rnd() * 10) | 0 };
            if (k < shown) items.push(item);
          }
        } else if (b === B.MEADOW) {
          const u = rnd();
          if (u < 0.07) {
            const [x, y] = spot(0.4);
            items.push({ t: 'broad', x, y, sc: 0.95, v: (rnd() * 10) | 0 });
          } else if (u < 0.13) {
            const [x, y] = spot(0.5);
            items.push({ t: 'shrub', x, y, v: (rnd() * 4) | 0 });
          }
          if (full) items.push({ t: 'flowers', x: hx[i], y: hy[i], s: (rnd() * 1e9) >>> 0 });
          if (full && w.stones) {
            for (let k = Math.ceil(w.stones[i] / 70); k > 0; k--) {
              const [x, y] = spot(0.6);
              items.push({ t: 'stone', x, y, r: 1.8 + rnd() * 2 });
            }
          }
        } else if (b === B.HEATH) {
          const n = 2 + ((rnd() * 2) | 0);
          for (let k = 0; k < n; k++) {
            const [x, y] = spot(0.65);
            items.push({ t: 'shrub', x, y, v: (rnd() * 4) | 0 });
          }
          if (full && rnd() < 0.5) {
            const [x, y] = spot(0.6);
            items.push({ t: 'stone', x, y, r: 2 + rnd() * 2 });
          }
        } else if (b === B.HILLS) {
          if (rnd() < 0.12) {
            const [x, y] = spot(0.5);
            items.push({ t: 'pine', x, y, sc: 0.85, v: (rnd() * 8) | 0 });
          }
          if (full) {
            const n = 1 + ((rnd() * 3) | 0);
            for (let k = 0; k < n; k++) {
              const [x, y] = spot(0.65);
              items.push({ t: 'stone', x, y, r: 2 + rnd() * 3 });
            }
          }
          for (let k = 1 + ((rnd() * 2) | 0); k > 0; k--) {
            const [x, y] = spot(0.5);
            items.push({ t: 'hump', x, y, wd: R * (0.36 + rnd() * 0.2), h: R * (0.17 + rnd() * 0.1) });
          }
        } else if (b === B.MOUNTAIN || b === B.SNOW) {
          for (let k = 1 + ((rnd() * 2) | 0); k > 0; k--) {
            const [x, y] = spot(0.5),
              wd = R * (0.42 + rnd() * 0.2) * (b === B.SNOW ? 1.15 : 1);
            items.push({
              t: 'crag',
              x,
              y: y + R * 0.3,
              wd,
              h: wd * (1.25 + rnd() * 0.35),
              snow: b === B.SNOW,
              v: rnd(),
            });
          }
        } else if (b === B.MARSH) {
          items.push({ t: 'marsh', x: hx[i], y: hy[i], s: (rnd() * 1e9) >>> 0 });
        } else if (b === B.BEACH) {
          if (full && rnd() < 0.15) {
            const [x, y] = spot(0.5);
            items.push({ t: 'stone', x, y, r: 1.8 + rnd() * 2 });
          }
        }
      }
    VB['gen/paths'].thin(w, VB['draw/rivers'].thin(w, items, hexLocator(w)), hexLocator(w)).sort((a, b) => a.y - b.y); // none on rivers or paths
    ctx.setTransform(sc, 0, 0, sc, -x0 * sc, -y0 * sc);
    VB['gen/marks'].draw(ctx, items, S, R, full, mulberry32);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  return { bakeWater, bakeChunk, decorateChunk, LV, TEX };
})();
