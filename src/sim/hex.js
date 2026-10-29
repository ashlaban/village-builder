// @sys sim/hex: hex-grid search, paths and land components
VB['sim/hex'] = (() => {
  // ---- hex helpers ----
  function bfs(w, from, maxSteps, pass) {
    const dist = new Map([[from, 0]]), prev = new Map(), q = [from];
    for (let h = 0; h < q.length; h++) {
      const i = q[h], d = dist.get(i);
      if (d >= maxSteps) continue;
      for (let k = 0; k < 6; k++) {
        const j = w.nb[i * 6 + k];
        if (j < 0 || dist.has(j) || !pass(j)) continue;
        dist.set(j, d + 1); prev.set(j, i); q.push(j);
      }
    }
    return { dist, prev };
  }
  const pathTo = (prev, from, to) => {
    const p = [to]; while (p[0] !== from) { const q = prev.get(p[0]); if (q === undefined) return null; p.unshift(q); } return p;
  };
  const land = (w) => (j) => !w.water[j];
  function hexSteps(w, a, b) {
    const ax = a % w.COLS, ay = (a / w.COLS) | 0, bx = b % w.COLS, by = (b / w.COLS) | 0;
    const aq = ax - ((ay - (ay & 1)) >> 1), bq = bx - ((by - (by & 1)) >> 1), dq = aq - bq, dr = ay - by;
    return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
  }
  function landComponents(w) {
    const id = new Int32Array(w.N).fill(-1), size = [];
    for (let s = 0; s < w.N; s++) {
      if (w.water[s] || id[s] >= 0) continue;
      const c = size.length, q = [s]; id[s] = c;
      for (let h = 0; h < q.length; h++) for (let k = 0; k < 6; k++) {
        const j = w.nb[q[h] * 6 + k]; if (j >= 0 && !w.water[j] && id[j] < 0) { id[j] = c; q.push(j); }
      }
      size.push(q.length);
    }
    return { id, size };
  }
  return { bfs, pathTo, land, hexSteps, landComponents };
})();
