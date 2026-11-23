// @sys draw/paint: a world's paint, built from the world alone: each tile's colour, the light of the relief and the distance to the land per
// coarse cell, and the brush texture; the page keeps one per world (page/chunks paintOf) and recolours a tile where its biome changed
VB['draw/paint'] = (() => {
  const { mulberry32, makeTile } = VB['gen/noise'];
  const { PIGMENTS } = VB['gen/biomes'],
    { BIOMES } = VB['world/biomes'],
    { hexLocator, csample } = VB['world/grid'];

  // interface Paint { tr, tg, tb: Float32Array per tile, the tile's colour 0..255 (0 on water); shade: Float32Array per coarse cell, the
  //   hillshade (~1 flat); cdist: Float32Array per coarse cell, the distance to the nearest land tile (map units, 1e9 if none); chex:
  //   Int32Array per coarse cell, the tile under it; tile: Float32Array 256*256, a tileable noise texture }

  // One tile's colour from its biome: the pigment from c to c2 by the macro tint, and the tile's own small tint (mc in double precision).
  function colour(P, w, i) {
    const bi = PIGMENTS[w.biome[i]];
    if (BIOMES[w.biome[i]].water) {
      P.tr[i] = P.tg[i] = P.tb[i] = 0;
      return;
    }
    const mc = Math.max(0, Math.min(1, csample(w, w.macro, w.hx[i], w.hy[i]))),
      t = 1 + (w.hrnd[i] - 0.5) * 0.03;
    P.tr[i] = (bi.c[0] + (bi.c2[0] - bi.c[0]) * mc) * t;
    P.tg[i] = (bi.c[1] + (bi.c2[1] - bi.c[1]) * mc) * t;
    P.tb[i] = (bi.c[2] + (bi.c2[2] - bi.c[2]) * mc) * t;
  }

  // A world's paint, all of it anew.
  function paint(w) {
    const { N, CW, CH, STEP, KS, elev, water } = w,
      CN = CW * CH;
    const P = {
      tr: new Float32Array(N),
      tg: new Float32Array(N),
      tb: new Float32Array(N),
      shade: new Float32Array(CN),
      cdist: new Float32Array(CN),
      chex: new Int32Array(CN),
      tile: makeTile(mulberry32(w.seed ^ 0x9e3779b9), 256, 8, 5),
    };
    for (let i = 0; i < N; i++) colour(P, w, i);
    // the light of the relief, from the upper left
    const ZS = 75 * KS,
      L = [-0.55, -0.6, 0.58],
      z = (i) => Math.max(0, elev[i]) * ZS;
    for (let cy = 0; cy < CH; cy++)
      for (let cx = 0; cx < CW; cx++) {
        const k = cy * CW + cx;
        const xl = cx > 0 ? k - 1 : k,
          xr = cx < CW - 1 ? k + 1 : k,
          yu = cy > 0 ? k - CW : k,
          yd = cy < CH - 1 ? k + CW : k;
        const dzx = (z(xr) - z(xl)) / (2 * STEP),
          dzy = (z(yd) - z(yu)) / (2 * STEP);
        const nl = Math.hypot(dzx, dzy, 1);
        P.shade[k] = (-dzx * L[0] - dzy * L[1] + L[2]) / nl / L[2];
      }
    // smooth distance-to-land field (chamfer) for water depth colour
    const { cdist, chex } = P,
      locC = hexLocator(w),
      oc = [0, 0];
    for (let k = 0; k < CN; k++) {
      const i = locC((k % CW) * STEP, ((k / CW) | 0) * STEP, oc);
      chex[k] = i;
      cdist[k] = i >= 0 && !water[i] ? 0 : 1e9;
    }
    const D1 = STEP,
      D2 = STEP * Math.SQRT2;
    for (let cy = 0; cy < CH; cy++)
      for (let cx = 0; cx < CW; cx++) {
        const k = cy * CW + cx;
        let v = cdist[k];
        if (cx > 0) v = Math.min(v, cdist[k - 1] + D1);
        if (cy > 0) {
          v = Math.min(
            v,
            cdist[k - CW] + D1,
            cx > 0 ? cdist[k - CW - 1] + D2 : v,
            cx < CW - 1 ? cdist[k - CW + 1] + D2 : v,
          );
        }
        cdist[k] = v;
      }
    for (let cy = CH - 1; cy >= 0; cy--)
      for (let cx = CW - 1; cx >= 0; cx--) {
        const k = cy * CW + cx;
        let v = cdist[k];
        if (cx < CW - 1) v = Math.min(v, cdist[k + 1] + D1);
        if (cy < CH - 1)
          v = Math.min(
            v,
            cdist[k + CW] + D1,
            cx < CW - 1 ? cdist[k + CW + 1] + D2 : v,
            cx > 0 ? cdist[k + CW - 1] + D2 : v,
          );
        cdist[k] = v;
      }
    return P;
  }

  return { paint, colour };
})();
