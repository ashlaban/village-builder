// @sys page/land: the Land overlay (VB-004): who holds each tile and who claims it, and each village's wood
// ---- the Land overlay (VB-004): who holds each tile and who claims it ----
// Village land a light tint of the village's colour, household land a stronger one with the household's own outline; borders between
// villages' land dark; unrealised claims as a dashed ring in the claimant's colour, realised ones (a birthright) as a solid ring; tiles claimed
// by two or more hatched; cairns (VB-157) as small stone piles; the tiles of each village's wood (VB-326) as a small tree in its colour.
// Drawn a map chunk at a time (below): only the chunks in view, and only those whose tiles changed.
let landOn = false,
  landAt = -1;
// ---- the filter (VB-044; design.md, Claims, ownership and territory, Filters) ----
// A level (everyone, households or villages), a dimension (owns: every tile a body holds; works: the fields and meadows it works, its farms'
// and a village's common fields) and, optionally, the selected entity alone; the selected one is outlined in white. The filter is the
// page's, never st. Its scope is sim/scopes' (VB-043, the one scope model): inScope's tiles and bodies, cached, asked again only when the
// filter, the selection or the bodies change (a change marks every chunk stale) and, at most twice a second, when land changed hands
// (the chunks that changed are stale already); the chunks are drawn from the cache, st.owner and st.claims. When VB-311 records titles,
// `owns` and `works` follow inScope's own reading of them.
const landFilter = { level: 'all', dim: 'owns', only: false };
const { inScope: landInScope } = VB['sim/scopes'];
let landScopeKey = '',
  landScopeAt = -1,
  landShow = null, // {tiles, codes}: the tiles in scope and the owner codes of its bodies (st.owner's coding), or null for all
  landHi = null; // the selected entity's tiles in scope, or null
// The selected household and village: a pawn's household, a farm's, a village, or the body that owns the selected tile.
function landSelected() {
  let h = -1,
    v = -1;
  const p = selPawn >= 0 ? st.pawns[selPawn] : null;
  if (p) h = p.household ?? -1;
  else if (selFarm >= 0) h = st.farmsteads[selFarm].household ?? -1;
  else if (selVillage >= 0) v = selVillage;
  else if (sel >= 0 && sel < st.owner.length) {
    const n = st.owner[sel];
    if (n > 0) h = n - 1;
    else if (n < 0) v = -n - 1;
  }
  if (h >= 0 && st.households[h].dissolved) h = -1;
  if (h >= 0) v = st.farmsteads[st.households[h].farmstead].village;
  return [h, v];
}
// Rebuilds the scope: true when the filter, the selection or the bodies changed (every chunk is then stale); asked again, false, when
// land changed hands and half a second has passed.
function landScope() {
  const [h, v] = landSelected(),
    { level, dim, only } = landFilter,
    key = `${level}|${dim}|${only}|${h}|${v}|${st.households.length}|${st.edges.length}`;
  if (key === landScopeKey && !(st.landDirty.size && (landShow || landHi) && time - landScopeAt >= 0.5)) return false;
  const changed = key !== landScopeKey;
  landScopeKey = key;
  landScopeAt = time;
  const one = level === 'household' && h >= 0 ? [h] : level === 'village' && v >= 0 ? [v] : null,
    mine = one && landInScope(st, { level, ids: one, dim });
  landHi = mine ? new Set(mine.tiles) : null;
  let parts;
  if (level !== 'all' && only) parts = mine ? [mine] : [];
  else if (level === 'household')
    parts = [landInScope(st, { level, ids: st.households.filter((x) => !x.dissolved).map((x) => x.id), dim })];
  else if (level === 'village' || dim !== 'owns')
    parts = [landInScope(st, { level: 'village', ids: st.villages.map((x) => x.id), dim })];
  else parts = null; // everyone's land: all of it
  landShow = parts && { tiles: new Set(), codes: new Set() };
  if (parts)
    for (const sc of parts) {
      for (const t of sc.tiles) landShow.tiles.add(t);
      for (const x of sc.households) landShow.codes.add(x + 1);
      for (const x of sc.villages) landShow.codes.add(-x - 1);
    }
  return changed;
}
// The code a tile is drawn under, by st.owner's coding, or 0 when it is out of scope; on the villages level a household's tile is drawn
// as its village's.
function landCode(i) {
  let n = st.owner[i];
  if (!n || (landShow && !landShow.tiles.has(i))) return 0;
  if (landFilter.level === 'household' && n < 0) return 0;
  if (landFilter.level === 'village' && n > 0) n = -ownerVillage(n) - 1;
  return n;
}
// Is a claim drawn: its claimant (a pawn as its household) in scope; on the households level, no village's.
function claimShown(by) {
  if (by.type === 'village') return landFilter.level !== 'household' && (!landShow || landShow.codes.has(-by.id - 1));
  const h = by.type === 'household' ? by.id : st.pawns[by.id] ? st.pawns[by.id].household : null;
  if (h === null || h === undefined) return !landShow;
  return !landShow || landShow.codes.has(h + 1);
}
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
  const R = w.R,
    memo = new Map(),
    at = (i) => {
      let n = memo.get(i);
      if (n === undefined) memo.set(i, (n = landCode(i)));
      return n;
    };
  g.clear();
  for (const i of tiles) {
    const n = at(i);
    if (!n) continue;
    g.poly(hexPoly(i)).fill({ color: villageColour(ownerVillage(n)), alpha: st.owner[i] < 0 ? 0.28 : 0.42 });
  }
  // a household's outline: edges between its tiles and any other owner's or none
  for (const i of tiles) {
    const n = at(i);
    if (n <= 0) continue;
    for (let d = 0; d < 6; d++) {
      const j = w.nb[i * 6 + d];
      if (j < 0 || at(j) !== n) edge(g, i, d, 0.94);
    }
    g.stroke({ width: R * 0.07, color: householdColour(st, n - 1), alpha: 0.9 });
  }
  // borders between villages' land, and of each village's land against the unheld
  for (const i of tiles) {
    const n = at(i);
    if (!n) continue;
    const v = ownerVillage(n);
    for (let d = 0; d < 6; d++) {
      const j = w.nb[i * 6 + d];
      if (j >= 0 && at(j) && ownerVillage(at(j)) !== v) edge(g, i, d);
    }
  }
  g.stroke({ width: R * 0.13, color: 0x2a1a0c, alpha: 0.85 });
  // the edge of each village's land against land nobody holds, in the village's colour
  const edges = new Map();
  for (const i of tiles) {
    const n = at(i);
    if (!n) continue;
    for (let d = 0; d < 6; d++) {
      const j = w.nb[i * 6 + d];
      if (j < 0 || at(j) || w.water[j]) continue;
      const v = ownerVillage(n);
      if (!edges.has(v)) edges.set(v, []);
      edges.get(v).push([i, d]);
    }
  }
  for (const [v, list] of edges) {
    for (const [i, d] of list) edge(g, i, d);
    g.stroke({ width: R * 0.11, color: hslHex(villageHue(v), 0.8, 0.3), alpha: 0.9 });
  }
  // the selected household or village (VB-044): a white edge round its land in scope
  if (landHi) {
    const hi = (i) => landHi.has(i) && at(i) !== 0;
    let any = false;
    for (const i of tiles) {
      if (!hi(i)) continue;
      for (let d = 0; d < 6; d++) {
        const j = w.nb[i * 6 + d];
        if (j < 0 || !hi(j)) {
          edge(g, i, d, 0.98);
          any = true;
        }
      }
    }
    if (any) g.stroke({ width: R * 0.12, color: 0xffffff, alpha: 0.95 });
  }
  for (const i of tiles) {
    const all = st.claims.get(i),
      list = all && all.filter((c) => claimShown(c.by));
    if (!list || !list.length) continue;
    if (all.length > 1) {
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
    if (v !== undefined && landFilter.level !== 'household' && (!landShow || landShow.codes.has(-v - 1))) {
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
  if (landScope()) landMarkAll();
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
  if (time - landKeyAt >= 0.5) {
    landKeyAt = time;
    paintLandKey();
  }
  for (const [k, c] of landChunks) c.g.visible = inView.has(k);
}
// The key (as Ground's and Reach's): what a fill, an outline and a ring mean, and the colours of the villages in view.
let landKeyHTML = '',
  landKeyAt = -1;
function paintLandKey() {
  if (!st || !w) return;
  const [x0, y0, x1, y1] = viewRect(0),
    seen = st.villages.filter(
      (v) => w.hx[v.center] >= x0 && w.hx[v.center] <= x1 && w.hy[v.center] >= y0 && w.hy[v.center] <= y1,
    ),
    row = (cls, style, name) => `<li><i class="${cls}" style="${style}"></i>${name}</li>`;
  const html =
    '<h2 class="menu-label">Land</h2><ul>' +
    row('fill', 'background:#8a8f7a;opacity:.45', "A village's land: a light tint of its colour") +
    row(
      'fill',
      'background:#8a8f7a;opacity:.8;box-shadow:inset 0 0 0 2px #555',
      "A household's land: a stronger tint, outlined",
    ) +
    row('line', 'border-color:#2a1a0c', "Border between two villages' land") +
    row('line', 'border-color:#4d6b2a', "A village's land against land no one holds") +
    row('woodmark', 'background:#4d6b2a', "A village's wood") +
    '</ul><h2 class="menu-label">Claims</h2><ul>' +
    row('dash', 'border-color:#4d6b2a', "Claimed, not yet held: a dashed ring in the claimant's colour") +
    row('ring', 'border-color:#4d6b2a', 'Held by birthright: a solid ring') +
    row('line', 'border-color:#b02020;border-style:dotted', 'Claimed by several: hatched') +
    '</ul>' +
    (landFilter.level === 'all'
      ? ''
      : '<ul>' +
        (landHi
          ? row('line', 'border-color:#fff', `The selected ${landFilter.level}: a white edge`)
          : `<li>Select a ${landFilter.level} to outline it${landFilter.only ? ' (none shown till then)' : ''}</li>`) +
        '</ul>') +
    '<h2 class="menu-label">Villages in view</h2><ul>' +
    (seen.map((v) => row('fill', `background:${hex6(villageColour(v.id))}`, esc(v.name))).join('') ||
      '<li>None in view</li>') +
    '</ul>';
  if (html !== landKeyHTML) {
    landKeyHTML = html;
    $('landKeyBody').innerHTML = html;
  }
}
function drawLand() {
  landIndex();
  landMarkAll();
  refreshLand();
  paintLandKey();
}
// The filter's controls, at the head of the key: a change rebuilds the scope on the next refresh.
for (const [id, field, read] of [
  ['landLevel', 'level', (e) => e.value],
  ['landDim', 'dim', (e) => e.value],
  ['landOnly', 'only', (e) => e.checked],
])
  $(id).addEventListener('change', (e) => {
    landFilter[field] = read(e.target);
    if (landOn) {
      refreshLand();
      paintLandKey();
    }
  });
function setLand(on) {
  landOn = on;
  L.land.visible = on;
  if (on) drawLand();
}
registerOverlay({
  id: 'land',
  name: 'Land ownership',
  key: 'l',
  icon: 'land',
  group: 'people',
  set: setLand,
  refresh: () => {
    if (landOn || (st && st.landDirty.size)) refreshLand();
  },
  reset: () => {
    resetLand();
    if (landOn) drawLand();
  },
  layer: L.land,
  keyEl: $('landKey'),
});
