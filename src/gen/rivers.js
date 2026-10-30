// @sys gen/rivers: rivers traced over the generated terrain, from hills, mountains and marsh through lakes to the sea
// ===== Rivers: drainage by priority flood, catchment, sources per island, courses to the sea =====
// Listed before gen.js, which calls trace; it reads no other module, so gen.js passes in the arrays, a random source and the biome codes.
VB['gen/rivers'] = (() => {
  // perTiles: land tiles of an island per river source (rounded); fromWater: least steps from a source to any water;
  // spacing: least steps between two sources; own: least land tiles a new river runs before it meets water or another river;
  // longEnough: a course of this many land tiles counts as long, so beyond it the noise (up to `noise`) spreads sources over the island.
  const RIVERS = { perTiles: 700, fromWater: 3, spacing: 10, own: 3, longEnough: 15, noise: 10 };

  // A binary min-heap of tile indexes by key[i], ties broken by the lower index, so the order is the same on every run.
  function minHeap(key) {
    const a = [];
    const less = (i, j) => key[i] < key[j] || (key[i] === key[j] && i < j);
    return {
      get size() { return a.length; },
      push(i) {
        let c = a.push(i) - 1;
        while (c > 0) { const p = (c - 1) >> 1; if (!less(a[c], a[p])) break; [a[c], a[p]] = [a[p], a[c]]; c = p; }
      },
      pop() {
        const top = a[0], last = a.pop();
        if (a.length) {
          a[0] = last;
          for (let c = 0; ;) {
            const l = 2 * c + 1, r = l + 1;
            let m = c;
            if (l < a.length && less(a[l], a[m])) m = l;
            if (r < a.length && less(a[r], a[m])) m = r;
            if (m === c) break;
            [a[c], a[m]] = [a[m], a[c]]; c = m;
          }
        }
        return top;
      },
    };
  }

  // Every land and lake tile drains to one neighbour (down) on a path to the sea that never climbs above its spill level: a priority flood
  // from the sea (Barnes, Lehman and Mulla 2014), with a tiny rise per step so flats and lakes drain toward their outlet.
  // order lists the tiles as the flood reached them, so a tile always comes after the tile it drains to.
  function drainage({ N, nb, he, ocean }) {
    const fill = new Float64Array(N), down = new Int32Array(N).fill(-1), seen = new Uint8Array(N), order = [], h = minHeap(fill);
    for (let i = 0; i < N; i++) {
      if (!ocean[i]) continue;
      seen[i] = 1; fill[i] = he[i];
      for (let k = 0; k < 6; k++) { const j = nb[i * 6 + k]; if (j >= 0 && !ocean[j]) { h.push(i); break; } }
    }
    while (h.size) {
      const i = h.pop();
      for (let k = 0; k < 6; k++) {
        const j = nb[i * 6 + k];
        if (j < 0 || seen[j]) continue;
        seen[j] = 1; fill[j] = Math.max(he[j], fill[i] + 1e-7); down[j] = i; order.push(j); h.push(j);
      }
    }
    return { down, order };
  }

  // Tiles within r steps of `from` (any terrain), by breadth-first search; calls f(tile) for each.
  function around(nb, from, r, f) {
    const q = [from], d = new Map([[from, 0]]);
    for (let h = 0; h < q.length; h++) {
      const i = q[h]; f(i);
      if (d.get(i) >= r) continue;
      for (let k = 0; k < 6; k++) { const j = nb[i * 6 + k]; if (j >= 0 && !d.has(j)) { d.set(j, d.get(i) + 1); q.push(j); } }
    }
  }

  // The rivers of a world. t: {N, nb, he, hm, water, ocean, biome} as made by ArchGen.generate; rand: a seeded source of numbers in [0, 1);
  // sources: biome codes rivers rise in. Returns {river, riverTo}.
  function trace(t, rand, sources) {
    const { N, nb, hm, water, ocean, biome } = t;
    const { down, order } = drainage(t);
    // catchment: each tile's own rain (land 0.5 + moisture, lakes 1) plus all that drains through it
    const acc = new Float64Array(N);
    for (const i of order) acc[i] = water[i] ? 1 : 0.5 + hm[i];
    for (let k = order.length - 1; k >= 0; k--) { const i = order[k], d = down[i]; if (!ocean[d]) acc[d] += acc[i]; }
    // course length: land tiles from a tile to the sea
    const len = new Int32Array(N);
    for (const i of order) len[i] = (water[i] ? 0 : 1) + (ocean[down[i]] ? 0 : len[down[i]]);
    // steps to the nearest water, and islands (land joined through land neighbours) with their sizes
    const wet = new Int32Array(N).fill(-1), q = [];
    for (let i = 0; i < N; i++) if (water[i]) { wet[i] = 0; q.push(i); }
    for (let h = 0; h < q.length; h++) for (let k = 0; k < 6; k++) {
      const j = nb[q[h] * 6 + k]; if (j >= 0 && wet[j] < 0) { wet[j] = wet[q[h]] + 1; q.push(j); }
    }
    const island = new Int32Array(N).fill(-1), left = [];
    for (let s = 0; s < N; s++) {
      if (water[s] || island[s] >= 0) continue;
      const c = left.length, iq = [s]; island[s] = c;
      for (let h = 0; h < iq.length; h++) for (let k = 0; k < 6; k++) {
        const j = nb[iq[h] * 6 + k]; if (j >= 0 && !water[j] && island[j] < 0) { island[j] = c; iq.push(j); }
      }
      left.push(Math.round(iq.length / RIVERS.perTiles));
    }
    // sources: long courses first, with noise so they spread over the island instead of crowding the one longest drainage
    const cand = [], score = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      if (water[i] || !sources.includes(biome[i]) || wet[i] < RIVERS.fromWater) continue;
      score[i] = Math.min(len[i], RIVERS.longEnough) + RIVERS.noise * rand(); cand.push(i);
    }
    cand.sort((a, b) => score[b] - score[a] || a - b);
    const river = new Uint16Array(N), riverTo = new Int32Array(N).fill(-1), blocked = new Uint8Array(N);
    for (const s of cand) {
      if (left[island[s]] <= 0 || blocked[s] || riverTo[s] >= 0) continue;
      let own = 0;
      for (let i = s; !ocean[i] && riverTo[i] < 0; i = down[i]) if (!water[i]) own++;
      if (own < RIVERS.own) continue;
      for (let i = s; !ocean[i] && riverTo[i] < 0; i = down[i]) {
        riverTo[i] = down[i];
        if (!water[i]) river[i] = Math.min(65535, Math.max(1, Math.round(acc[i])));
      }
      left[island[s]]--;
      around(nb, s, RIVERS.spacing - 1, (j) => { blocked[j] = 1; });
    }
    // @state w.river: Uint16Array per tile; catchment of a land tile a river runs through (tiles, weighted by moisture), 0 elsewhere
    // @state w.riverTo: Int32Array per tile; next tile down a river's course (river tile, lake on the course, or sea), -1 off every course
    return { river, riverTo };
  }

  return { RIVERS, trace };
})();
