// @sys gen/noise: seeded random draws and the noise fields used to generate relief and brush texture
VB['gen/noise'] = (() => {
  const SQ3 = Math.sqrt(3);

  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function makeSimplex(rand) {
    const p = new Uint8Array(256),
      perm = new Uint8Array(512);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = (rand() * (i + 1)) | 0;
      const t = p[i];
      p[i] = p[j];
      p[j] = t;
    }
    for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
    const GX = [1, -1, 1, -1, 1, -1, 0, 0],
      GY = [1, 1, -1, -1, 0, 0, 1, -1];
    const F2 = 0.5 * (SQ3 - 1),
      G2 = (3 - SQ3) / 6;
    return function (x, y) {
      const s = (x + y) * F2,
        i = Math.floor(x + s),
        j = Math.floor(y + s);
      const t = (i + j) * G2,
        x0 = x - (i - t),
        y0 = y - (j - t);
      const i1 = x0 > y0 ? 1 : 0,
        j1 = 1 - i1;
      const x1 = x0 - i1 + G2,
        y1 = y0 - j1 + G2,
        x2 = x0 - 1 + 2 * G2,
        y2 = y0 - 1 + 2 * G2;
      const ii = i & 255,
        jj = j & 255;
      let n = 0,
        tt,
        g;
      tt = 0.5 - x0 * x0 - y0 * y0;
      if (tt > 0) {
        g = perm[ii + perm[jj]] & 7;
        tt *= tt;
        n += tt * tt * (GX[g] * x0 + GY[g] * y0);
      }
      tt = 0.5 - x1 * x1 - y1 * y1;
      if (tt > 0) {
        g = perm[ii + i1 + perm[jj + j1]] & 7;
        tt *= tt;
        n += tt * tt * (GX[g] * x1 + GY[g] * y1);
      }
      tt = 0.5 - x2 * x2 - y2 * y2;
      if (tt > 0) {
        g = perm[ii + 1 + perm[jj + 1]] & 7;
        tt *= tt;
        n += tt * tt * (GX[g] * x2 + GY[g] * y2);
      }
      return 70 * n;
    };
  }

  function fbm(n, x, y, oct) {
    let s = 0,
      a = 1,
      f = 1,
      t = 0;
    for (let o = 0; o < oct; o++) {
      s += a * n(x * f, y * f);
      t += a;
      a *= 0.5;
      f *= 2.03;
    }
    return s / t;
  }
  function ridged(n, x, y, oct) {
    let s = 0,
      a = 1,
      f = 1,
      t = 0,
      w = 1;
    for (let o = 0; o < oct; o++) {
      let r = 1 - Math.abs(n(x * f, y * f));
      r *= r;
      r *= w;
      w = Math.min(1, r * 1.6);
      s += a * r;
      t += a;
      a *= 0.5;
      f *= 2.1;
    }
    return s / t;
  }
  const smooth = (a, b, x) => {
    const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };

  // Periodic multi-octave value noise, 0..1, used for brush texture lookups.
  function makeTile(rand, size, cells0, oct) {
    const out = new Float32Array(size * size);
    let amp = 1,
      cells = cells0;
    for (let o = 0; o < oct; o++) {
      const lat = new Float32Array(cells * cells);
      for (let k = 0; k < lat.length; k++) lat[k] = rand();
      for (let y = 0; y < size; y++) {
        const fy = (y / size) * cells,
          y0 = fy | 0,
          ty0 = fy - y0,
          ty = ty0 * ty0 * (3 - 2 * ty0),
          y1 = (y0 + 1) % cells;
        for (let x = 0; x < size; x++) {
          const fx = (x / size) * cells,
            x0 = fx | 0,
            tx0 = fx - x0,
            tx = tx0 * tx0 * (3 - 2 * tx0),
            x1 = (x0 + 1) % cells;
          const a = lat[y0 * cells + x0],
            b = lat[y0 * cells + x1],
            c = lat[y1 * cells + x0],
            d = lat[y1 * cells + x1];
          out[y * size + x] += amp * (a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty);
        }
      }
      amp *= 0.5;
      cells *= 2;
    }
    let mn = Infinity,
      mx = -Infinity;
    for (const v of out) {
      if (v < mn) mn = v;
      if (v > mx) mx = v;
    }
    for (let k = 0; k < out.length; k++) out[k] = (out[k] - mn) / (mx - mn);
    return out;
  }

  return { mulberry32, makeSimplex, fbm, ridged, smooth, makeTile };
})();
