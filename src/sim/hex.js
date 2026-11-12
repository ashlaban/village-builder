// @sys sim/hex: hex-grid search, paths and land components, and where a house would close a way or a green in
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
  // Steps from `from` to `to` by the same search as bfs, or -1 beyond maxSteps; it stops once `to` is reached (VB-145: the yearly ties
  // searched the whole island from each village).
  let mark = new Int32Array(0), stamp = 0, depth = new Int32Array(0);
  function stepsTo(w, from, to, maxSteps, pass) {
    if (from === to) return 0;
    if (mark.length < w.N) { mark = new Int32Array(w.N); depth = new Int32Array(w.N); stamp = 0; }
    const q = [from]; stamp++; mark[from] = stamp; depth[from] = 0;
    for (let h = 0; h < q.length; h++) {
      const i = q[h], d = depth[i];
      if (d >= maxSteps) continue;
      for (let k = 0; k < 6; k++) {
        const j = w.nb[i * 6 + k];
        if (j < 0 || mark[j] === stamp || !pass(j)) continue;
        if (j === to) return d + 1;
        mark[j] = stamp; depth[j] = d + 1; q.push(j);
      }
    }
    return -1;
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
  // ---- where a house may stand (VB-402): no route crosses a house (sim/routes), so it may close neither a way nor the green in ----
  // Would a house on tile t shut land off? No route crosses a house (sim/routes, VB-402), so a house may not stand where it would close
  // a way: true when t would have no open tile beside it, when it would take the last open tile beside a house next to it, or when the
  // open tiles round it would no longer reach each other going round it (looked for within CUT_REACH steps, so a long way round counts
  // as none). shut(j): no route crosses j (off the map, water, a house); house(j): a house stands on j.
  const CUT_REACH = 10;
  function cutsOff(w, t, shut, house) {
    const open = [];
    for (let k = 0; k < 6; k++) {
      const j = w.nb[t * 6 + k];
      if (j < 0) continue;
      if (!shut(j)) { open.push(k); continue; }
      if (!house(j)) continue;
      let left = 0; for (let q = 0; q < 6; q++) { const n = w.nb[j * 6 + q]; if (n >= 0 && n !== t && !shut(n)) left++; }
      if (!left) return true;
    }
    if (!open.length) return true;
    let arcs = 0; for (const k of open) if (!open.includes((k + 1) % 6)) arcs++;
    if (arcs < 2) return false;
    const { dist } = bfs(w, w.nb[t * 6 + open[0]], CUT_REACH, (j) => j !== t && !shut(j));
    return open.some((k) => !dist.has(w.nb[t * 6 + k]));
  }
  // Would a house on tile t close the green at `center` in? The green keeps ways out on every side (Kim, VB-402): of the six tiles round
  // it at most GREEN_HOUSES bear a house, and never two side by side. True when t is one of the six and breaks that.
  const GREEN_HOUSES = 3;
  function rimFull(w, center, t, house) {
    let at = -1, n = 0;
    for (let k = 0; k < 6; k++) { const j = w.nb[center * 6 + k]; if (j === t) at = k; else if (j >= 0 && house(j)) n++; }
    if (at < 0) return false;
    const side = (d) => { const j = w.nb[center * 6 + ((at + d) % 6)]; return j >= 0 && house(j); };
    return n >= GREEN_HOUSES || side(1) || side(5);
  }
  return { bfs, stepsTo, pathTo, land, hexSteps, landComponents, cutsOff, rimFull };
})();
