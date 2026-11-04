// @sys gen/geometry: world-position lookup and point-to-segment distance
VB['gen/geometry'] = (() => {
  const SQ3 = Math.sqrt(3);

  // Convert a map position to its nearest hex, or -1 outside the grid.
  function tileIndexAt(w, px, py, out) {
    const { R, COLS, ROWS, AP } = w;
    const x = px - AP, y = py - R;
    const qf = ((SQ3 / 3) * x - y / 3) / R, rf = ((2 / 3) * y) / R, sf = -qf - rf;
    let q = Math.round(qf), r = Math.round(rf);
    const s = Math.round(sf), dq = Math.abs(q - qf), dr = Math.abs(r - rf), ds = Math.abs(s - sf);
    if (dq > dr && dq > ds) q = -r - s; else if (dr > ds) r = -q - s;
    const col = q + ((r - (r & 1)) >> 1);
    if (!(r >= 0 && r < ROWS && col >= 0 && col < COLS)) return -1;
    if (out) {
      out[0] = px - (w.HW * (col + 0.5 * (r & 1)) + AP);
      out[1] = py - (1.5 * R * r + R);
    }
    return r * COLS + col;
  }

  // Squared distance from (x, y) to the segment (ax, ay)-(bx, by).
  function dist2(x, y, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy, t = l2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2)) : 0;
    const px = ax + t * dx - x, py = ay + t * dy - y;
    return px * px + py * py;
  }
  return { tileIndexAt, dist2 };
})();
