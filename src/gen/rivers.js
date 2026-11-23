// @sys gen/rivers: rivers traced over the generated terrain, from hills, mountains and marsh through lakes to the sea
// ===== Rivers: drainage by priority flood, catchment, sources per island, courses to the sea =====
// Listed before gen.js, which calls trace with the arrays of the world in the making and a random source.
VB['gen/rivers'] = (() => {
  const { B } = VB['world/biomes'];
  // perTiles: land tiles of an island per river source (rounded); fromWater: least steps from a source to any water;
  // spacing: least steps between two sources; own: least land tiles a new river runs before it meets water or another river;
  // Which courses become rivers goes by drainage basin (VB-342): the main stems of the largest catchments first (trace).
  const RIVERS = { perTiles: 700, fromWater: 3, spacing: 10, own: 3 };
  // Fords: in stretches of `every` land tiles down each reach, the best site is a ford; a last stretch under `least` joins the one before.
  // A site's score (lower is better) is its drop to the next tile per `drop` of elevation, plus the root of its catchment per `narrow`,
  // plus up to `noise` at random: a ford is flat and narrow.
  const FORDS = { every: 10, least: 3, drop: 0.03, narrow: 10, noise: 1 };

  // A binary min-heap of tile indexes by key[i], ties broken by the lower index, so the order is the same on every run.
  function minHeap(key) {
    const a = [];
    const less = (i, j) => key[i] < key[j] || (key[i] === key[j] && i < j);
    return {
      get size() {
        return a.length;
      },
      push(i) {
        let c = a.push(i) - 1;
        while (c > 0) {
          const p = (c - 1) >> 1;
          if (!less(a[c], a[p])) break;
          [a[c], a[p]] = [a[p], a[c]];
          c = p;
        }
      },
      pop() {
        const top = a[0],
          last = a.pop();
        if (a.length) {
          a[0] = last;
          for (let c = 0; ;) {
            const l = 2 * c + 1,
              r = l + 1;
            let m = c;
            if (l < a.length && less(a[l], a[m])) m = l;
            if (r < a.length && less(a[r], a[m])) m = r;
            if (m === c) break;
            [a[c], a[m]] = [a[m], a[c]];
            c = m;
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
    const fill = new Float64Array(N),
      down = new Int32Array(N).fill(-1),
      seen = new Uint8Array(N),
      order = [],
      h = minHeap(fill);
    for (let i = 0; i < N; i++) {
      if (!ocean[i]) continue;
      seen[i] = 1;
      fill[i] = he[i];
      for (let k = 0; k < 6; k++) {
        const j = nb[i * 6 + k];
        if (j >= 0 && !ocean[j]) {
          h.push(i);
          break;
        }
      }
    }
    while (h.size) {
      const i = h.pop();
      for (let k = 0; k < 6; k++) {
        const j = nb[i * 6 + k];
        if (j < 0 || seen[j]) continue;
        seen[j] = 1;
        fill[j] = Math.max(he[j], fill[i] + 1e-7);
        down[j] = i;
        order.push(j);
        h.push(j);
      }
    }
    return { down, order };
  }

  // Tiles within r steps of `from` (any terrain), by breadth-first search; calls f(tile) for each.
  function around(nb, from, r, f) {
    const q = [from],
      d = new Map([[from, 0]]);
    for (let h = 0; h < q.length; h++) {
      const i = q[h];
      f(i);
      if (d.get(i) >= r) continue;
      for (let k = 0; k < 6; k++) {
        const j = nb[i * 6 + k];
        if (j >= 0 && !d.has(j)) {
          d.set(j, d.get(i) + 1);
          q.push(j);
        }
      }
    }
  }

  // The rivers of a world. t: {N, nb, he, hm, water, ocean, biome} as made by ArchGen.generate; rand: a seeded source of numbers in [0, 1);
  // Rivers rise in hills, mountains and marsh. Returns {river, riverTo, crossing}.
  function trace(t, rand) {
    const sources = [B.HILLS, B.MOUNTAIN, B.MARSH];
    const { N, nb, hm, water, ocean, biome } = t;
    const { down, order } = drainage(t);
    // catchment: each tile's own rain (land 0.5 + moisture, lakes 1) plus all that drains through it
    const acc = new Float64Array(N);
    for (const i of order) acc[i] = water[i] ? 1 : 0.5 + hm[i];
    for (let k = order.length - 1; k >= 0; k--) {
      const i = order[k],
        d = down[i];
      if (!ocean[d]) acc[d] += acc[i];
    }
    // steps to the nearest water, and islands (land joined through land neighbours) with their sizes
    const wet = new Int32Array(N).fill(-1),
      q = [];
    for (let i = 0; i < N; i++)
      if (water[i]) {
        wet[i] = 0;
        q.push(i);
      }
    for (let h = 0; h < q.length; h++)
      for (let k = 0; k < 6; k++) {
        const j = nb[q[h] * 6 + k];
        if (j >= 0 && wet[j] < 0) {
          wet[j] = wet[q[h]] + 1;
          q.push(j);
        }
      }
    const island = new Int32Array(N).fill(-1),
      left = [];
    for (let s = 0; s < N; s++) {
      if (water[s] || island[s] >= 0) continue;
      const c = left.length,
        iq = [s];
      island[s] = c;
      for (let h = 0; h < iq.length; h++)
        for (let k = 0; k < 6; k++) {
          const j = nb[iq[h] * 6 + k];
          if (j >= 0 && !water[j] && island[j] < 0) {
            island[j] = c;
            iq.push(j);
          }
        }
      left.push(Math.round(iq.length / RIVERS.perTiles));
    }
    // sources, by drainage basin: every basin is cut into stems. A stem runs from where it ends (at the sea, or on a larger stem) up
    // the tributary of the largest catchment at each fork; the other tributaries are stems of their own. A stem's source is its highest
    // tile in a source biome far enough from water, and stems are taken in the order of the catchment they carry: the trunk of the
    // largest basin first, then large tributaries and the trunks of smaller basins.
    const up = new Array(N),
      stems = [],
      cand = [],
      carried = new Float64Array(N);
    for (const i of order) {
      const d = down[i];
      if (ocean[d]) stems.push(i);
      else (up[d] || (up[d] = [])).push(i);
    }
    for (let h = 0; h < stems.length; h++) {
      let top = -1;
      for (let i = stems[h]; i >= 0;) {
        if (!water[i] && sources.includes(biome[i]) && wet[i] >= RIVERS.fromWater) top = i;
        let best = -1;
        for (const j of up[i] || []) if (best < 0 || acc[j] > acc[best] || (acc[j] === acc[best] && j < best)) best = j;
        for (const j of up[i] || []) if (j !== best) stems.push(j);
        i = best;
      }
      if (top >= 0) {
        carried[top] = acc[stems[h]];
        cand.push(top);
      }
    }
    cand.sort((a, b) => carried[b] - carried[a] || a - b);
    const river = new Uint16Array(N),
      riverTo = new Int32Array(N).fill(-1),
      blocked = new Uint8Array(N),
      starts = [];
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
      starts.push(s);
      around(nb, s, RIVERS.spacing - 1, (j) => {
        blocked[j] = 1;
      });
    }
    const crossing = fords(t, rand, river, riverTo, starts);
    // @state w.river: Uint16Array per tile; catchment of a land tile a river runs through (tiles, weighted by moisture), 0 elsewhere
    // @state w.riverTo: Int32Array per tile; next tile down a river's course (river tile, lake on the course, or sea), -1 off every course
    // @state w.crossing: Uint8Array per tile; how a river tile is crossed on foot: 0 not at all, 1 a ford, 2 a bridge (built in play)
    return { river, riverTo, crossing };
  }
  // A river tile whose dry neighbours lie on two sides or more, none of them water: crossing it joins two banks.
  function joinsBanks({ nb, water }, river, i) {
    let arcs = 0;
    for (let k = 0; k < 6; k++) {
      const j = nb[i * 6 + k],
        p = nb[i * 6 + ((k + 5) % 6)];
      if (j >= 0 && water[j]) return false;
      const dry = (x) => x >= 0 && !water[x] && !river[x];
      if (dry(j) && !dry(p)) arcs++;
    }
    return arcs >= 2;
  }
  // Fords along every course, in reaches that run from a source or a confluence down to the next confluence, a lake or the sea;
  // returns w.crossing.
  function fords(t, rand, river, riverTo, starts) {
    const { N, he, water } = t,
      crossing = new Uint8Array(N),
      seen = new Uint8Array(N),
      into = new Uint8Array(N);
    for (let i = 0; i < N; i++) if (riverTo[i] >= 0) into[riverTo[i]]++;
    const score = (i) =>
      Math.max(0, he[i] - he[riverTo[i]]) / FORDS.drop + Math.sqrt(river[i]) / FORDS.narrow + FORDS.noise * rand();
    const place = (stretch) => {
      const parts = [];
      for (let k = 0; k < stretch.length; k += FORDS.every) parts.push(stretch.slice(k, k + FORDS.every));
      if (parts.length > 1 && parts[parts.length - 1].length < FORDS.least)
        parts[parts.length - 2].push(...parts.pop());
      for (const part of parts) {
        if (part.length < FORDS.least) continue;
        let best = -1,
          bs = Infinity;
        for (const i of part) {
          if (!joinsBanks(t, river, i)) continue;
          const sc = score(i);
          if (sc < bs) {
            bs = sc;
            best = i;
          }
        }
        if (best >= 0) crossing[best] = 1;
      }
    };
    for (const s of starts) {
      let stretch = [];
      for (let i = s; i >= 0 && river[i] + water[i] && !seen[i]; i = riverTo[i]) {
        seen[i] = 1;
        if (water[i] || into[i] > 1) {
          place(stretch);
          stretch = [];
        }
        if (!water[i]) stretch.push(i);
      }
      place(stretch);
    }
    return crossing;
  }
  return { RIVERS, FORDS, minHeap, drainage, trace };
})();
