// @sys page/land: the Land overlay (VB-004): who holds each tile and who claims it, and each village's wood
// ---- the Land overlay (VB-004): who holds each tile and who claims it ----
// Village land a light tint of the village's colour, household land a stronger one with the household's own outline; borders between
// villages' land dark; unrealised claims as a dashed ring in the claimant's colour, realised ones (a birthright) as a solid ring; tiles claimed
// by two or more hatched; cairns (VB-157) as small stone piles; the tiles of each village's wood (VB-326) as a small tree in its colour.
// Drawn a map chunk at a time (below): only the chunks in view, and only those whose tiles changed.
let landOn = false,
  landAt = -1;
const EDGE = [0, -60, -120, 180, 120, 60]; // the centre angle of a hex's edge towards neighbour d (the generator's direction order)
function hslHex(h, sat, l) {
  const f = (n) => {
    const k = (n + h / 30) % 12,
      a = sat * Math.min(l, 1 - l);
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return (f(0) << 16) | (f(8) << 8) | f(4);
}
const villageHue = (vid) => (vid * 137.508 + 20) % 360;
const villageColour = (vid) => hslHex(villageHue(vid), 0.7, 0.5);
const householdColour = (st_, hid) =>
  hslHex(villageHue(st_.farmsteads[st_.households[hid].farmstead].village), 0.75, 0.28 + 0.4 * ((hid * 0.618034) % 1));
const ownerVillage = (n) => (n < 0 ? -n - 1 : st.farmsteads[st.households[n - 1].farmstead].village);
function claimColour(by) {
  if (by.type === 'village') return villageColour(by.id);
  if (by.type === 'household') return householdColour(st, by.id);
  const p = st.pawns[by.id];
  return p && p.household !== null ? householdColour(st, p.household) : 0x555555;
}
const corner = (i, a, s) => [
  w.hx[i] + Math.cos((a * Math.PI) / 180) * w.R * s,
  w.hy[i] + Math.sin((a * Math.PI) / 180) * w.R * s,
];
function hexPoly(i, s = 1) {
  const out = [];
  for (let k = 0; k < 6; k++) out.push(...corner(i, 30 + 60 * k, s));
  return out;
}
function edge(g, i, d, s = 1, from = 0, to = 1) {
  const [x0, y0] = corner(i, EDGE[d] - 30, s),
    [x1, y1] = corner(i, EDGE[d] + 30, s);
  g.moveTo(x0 + (x1 - x0) * from, y0 + (y1 - y0) * from).lineTo(x0 + (x1 - x0) * to, y0 + (y1 - y0) * to);
}
// ---- drawn per map chunk (VB-045) ----
// One graphics object a chunk of LAND_CHUNK units, holding the tiles whose centre lies in it. A dirty tile marks its own chunk and its
// neighbours' stale (an edge or a border crosses into them); a stale chunk is drawn when it is in view, at once the first time and at most
// twice a second after a change; out of view it waits, hidden, and is drawn as it comes into view.
const LAND_CHUNK = LV[0].size,
  LAND_MS = 10; // the milliseconds of a frame a drawing of stale chunks may take (one chunk at least)
let landWorld = null,
  landTiles = null,
  landCols = 0,
  landOf = null;
const landChunks = new Map(),
  landStale = new Set(); // key -> {g, drawn}; the keys of chunks whose graphics are not current
function landIndex() {
  // the tiles of each chunk, once a world
  if (landWorld === w) return;
  resetLand();
  landWorld = w;
  landCols = Math.ceil(w.W / LAND_CHUNK);
  landOf = new Int32Array(w.N);
  landTiles = new Map();
  for (let i = 0; i < w.N; i++) {
    const k = Math.floor(w.hy[i] / LAND_CHUNK) * landCols + Math.floor(w.hx[i] / LAND_CHUNK);
    landOf[i] = k;
    let list = landTiles.get(k);
    if (!list) landTiles.set(k, (list = []));
    list.push(i);
  }
}
function resetLand() {
  for (const c of landChunks.values()) c.g.destroy();
  landChunks.clear();
  landStale.clear();
  landWorld = null;
}
function landMarkAll() {
  if (landTiles) for (const k of landTiles.keys()) landStale.add(k);
  for (const c of landChunks.values()) c.drawn = false;
}
function landMarkDirty() {
  for (const t of st.landDirty) {
    landStale.add(landOf[t]);
    for (let d = 0; d < 6; d++) {
      const j = w.nb[t * 6 + d];
      if (j >= 0) landStale.add(landOf[j]);
    }
  }
  st.landDirty.clear();
}
function drawLandChunk(tiles, g, woodOf) {
  const R = w.R;
  g.clear();
  for (const i of tiles) {
    const n = st.owner[i];
    if (!n) continue;
    g.poly(hexPoly(i)).fill({ color: villageColour(ownerVillage(n)), alpha: n < 0 ? 0.28 : 0.42 });
  }
  // a household's outline: edges between its tiles and any other owner's or none
  for (const i of tiles) {
    const n = st.owner[i];
    if (n <= 0) continue;
    for (let d = 0; d < 6; d++) {
      const j = w.nb[i * 6 + d];
      if (j < 0 || st.owner[j] !== n) edge(g, i, d, 0.94);
    }
    g.stroke({ width: R * 0.07, color: householdColour(st, n - 1), alpha: 0.9 });
  }
  // borders between villages' land, and of each village's land against the unheld
  for (const i of tiles) {
    const n = st.owner[i];
    if (!n) continue;
    const v = ownerVillage(n);
    for (let d = 0; d < 6; d++) {
      const j = w.nb[i * 6 + d];
      if (j >= 0 && st.owner[j] && ownerVillage(st.owner[j]) !== v) edge(g, i, d);
    }
  }
  g.stroke({ width: R * 0.13, color: 0x2a1a0c, alpha: 0.85 });
  // the edge of each village's land against land nobody holds, in the village's colour
  const edges = new Map();
  for (const i of tiles) {
    const n = st.owner[i];
    if (!n) continue;
    for (let d = 0; d < 6; d++) {
      const j = w.nb[i * 6 + d];
      if (j < 0 || st.owner[j] || w.water[j]) continue;
      const v = ownerVillage(n);
      if (!edges.has(v)) edges.set(v, []);
      edges.get(v).push([i, d]);
    }
  }
  for (const [v, list] of edges) {
    for (const [i, d] of list) edge(g, i, d);
    g.stroke({ width: R * 0.11, color: hslHex(villageHue(v), 0.8, 0.3), alpha: 0.9 });
  }
  for (const i of tiles) {
    const list = st.claims.get(i);
    if (!list) continue;
    if (list.length > 1) {
      // contested: hatched
      for (const k of [-0.4, 0, 0.4])
        g.moveTo(w.hx[i] - R * 0.45 + k * R, w.hy[i] + R * 0.45).lineTo(w.hx[i] + R * 0.45 + k * R, w.hy[i] - R * 0.45);
      g.stroke({ width: R * 0.08, color: 0xb02020, alpha: 0.8 });
    }
    list.forEach((c, k) => {
      const s = 0.8 - 0.14 * k;
      if (c.state === 'realised') g.poly(hexPoly(i, s));
      else
        for (let d = 0; d < 6; d++)
          for (const [a, b] of [
            [0, 0.32],
            [0.5, 0.82],
          ])
            edge(g, i, d, s, a, b);
      g.stroke({ width: R * 0.08, color: claimColour(c.by), alpha: 0.95 });
    });
  }
  // each village's wood (VB-326): a small tree in the village's colour on each of its tiles
  const wood = new Map();
  for (const i of tiles) {
    const v = woodOf.get(i);
    if (v !== undefined) {
      if (!wood.has(v)) wood.set(v, []);
      wood.get(v).push(i);
    }
  }
  for (const [v, list] of wood) {
    for (const i of list)
      g.poly([
        w.hx[i],
        w.hy[i] - R * 0.4,
        w.hx[i] + R * 0.24,
        w.hy[i] + R * 0.14,
        w.hx[i] - R * 0.24,
        w.hy[i] + R * 0.14,
      ]);
    g.fill({ color: hslHex(villageHue(v), 0.8, 0.35), alpha: 0.9 }).stroke({
      width: R * 0.05,
      color: 0xf6f1e2,
      alpha: 0.9,
    });
  }
  if (st.cairns)
    for (const i of tiles) {
      if (!st.cairns.has(i)) continue;
      for (const [dx, dy, r] of [
        [-0.16, 0.1, 0.13],
        [0.16, 0.1, 0.13],
        [0, -0.1, 0.14],
      ])
        g.circle(w.hx[i] + dx * R, w.hy[i] + dy * R, r * R);
      g.fill({ color: 0x9a948a }).stroke({ width: R * 0.04, color: 0x3b362f });
    }
}
// Called each frame while the overlay is on (and by the toggle): names the stale chunks, draws those in view, hides the others.
function refreshLand() {
  if (!w || !st) return;
  if (!landOn) {
    st.landDirty.clear();
    return;
  }
  landIndex();
  if (st.landDirty.size) landMarkDirty();
  const [x0, y0, x1, y1] = viewRect(w.R * 2),
    cx1 = Math.min(Math.floor(x1 / LAND_CHUNK), landCols - 1);
  const cx0 = Math.max(0, Math.floor(x0 / LAND_CHUNK)),
    cy0 = Math.max(0, Math.floor(y0 / LAND_CHUNK)),
    cy1 = Math.floor(y1 / LAND_CHUNK);
  const inView = new Set();
  for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) inView.add(cy * landCols + cx);
  let woodOf = null,
    drew = false;
  const t0 = performance.now();
  const slow = time - landAt >= 0.5; // a drawn chunk that changed is redrawn at most twice a second; a first drawing waits for nothing
  for (const k of inView) {
    const tiles = landTiles.get(k);
    if (!tiles) continue;
    let c = landChunks.get(k);
    if (!c) {
      c = { g: new PIXI.Graphics(), drawn: false };
      L.land.addChild(c.g);
      landChunks.set(k, c);
      landStale.add(k);
    }
    if (!landStale.has(k) || (drew && performance.now() - t0 > LAND_MS) || (c.drawn && !slow)) continue;
    if (!woodOf) {
      woodOf = new Map();
      for (const v of st.villages) if (v.wood) for (const i of v.wood) woodOf.set(i, v.id);
    }
    drawLandChunk(tiles, c.g, woodOf);
    c.drawn = true;
    landStale.delete(k);
    drew = true;
  }
  if (drew) landAt = time;
  for (const [k, c] of landChunks) c.g.visible = inView.has(k);
}
function drawLand() {
  landIndex();
  landMarkAll();
  refreshLand();
}
