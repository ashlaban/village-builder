// @sys world/grid [kernel]: the hex grid's geometry: the pointy-top odd-r neighbour directions, axial coordinates and distance, the tile under a map
// point, and the sample of a coarse-cell array at one
VB['world/grid'] = (() => {
  const SQ3 = Math.sqrt(3);

  // neighbour directions for pointy-top odd-r: E, NE, NW, W, SW, SE
  const NX = [1, 0.5, -0.5, -1, -0.5, 0.5],
    NY = [0, -0.866, -0.866, 0, 0.866, 0.866];
  const DIR_EVEN = [
    [1, 0],
    [0, -1],
    [-1, -1],
    [-1, 0],
    [-1, 1],
    [0, 1],
  ];
  const DIR_ODD = [
    [1, 0],
    [1, -1],
    [0, -1],
    [-1, 0],
    [0, 1],
    [1, 1],
  ];

  // Pointy-top odd-r offset <-> axial helpers
  const toAxial = (col, row) => [col - ((row - (row & 1)) >> 1), row];
  const hexDist = (q1, r1, q2, r2) => {
    const dq = q1 - q2,
      dr = r1 - r2;
    return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
  };

  function hexLocator(w) {
    const { R, COLS, ROWS, HW, AP } = w;
    return function (px, py, out) {
      const x = px - AP,
        y = py - R;
      const qf = ((SQ3 / 3) * x - y / 3) / R,
        rf = ((2 / 3) * y) / R,
        sf = -qf - rf;
      let q = Math.round(qf),
        r = Math.round(rf),
        s = Math.round(sf);
      const dq = Math.abs(q - qf),
        dr = Math.abs(r - rf),
        ds = Math.abs(s - sf);
      if (dq > dr && dq > ds) q = -r - s;
      else if (dr > ds) r = -q - s;
      const row = r,
        col = q + ((r - (r & 1)) >> 1);
      if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return -1;
      out[0] = px - (HW * (col + 0.5 * (row & 1)) + AP);
      out[1] = py - (1.5 * R * row + R);
      return row * COLS + col;
    };
  }

  // Bilinear sample of a coarse-cell array arr (w.CW by w.CH cells, w.STEP map units apart) at map position x, y.
  function csample(w, arr, x, y) {
    const { STEP, CW, CH } = w;
    let gx = x / STEP,
      gy = y / STEP;
    if (gx < 0) gx = 0;
    if (gy < 0) gy = 0;
    if (gx > CW - 1.001) gx = CW - 1.001;
    if (gy > CH - 1.001) gy = CH - 1.001;
    const ix = gx | 0,
      iy = gy | 0,
      tx = gx - ix,
      ty = gy - iy,
      k = iy * CW + ix;
    const a = arr[k],
      b = arr[k + 1],
      c = arr[k + CW],
      d = arr[k + CW + 1];
    return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
  }

  return { NX, NY, DIR_EVEN, DIR_ODD, toAxial, hexDist, hexLocator, csample };
})();
