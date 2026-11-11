// @sys gen/geology: what lies in the ground: each land tile's bedrock, and the deposits of clay and ores laid as patches and veins, by island
// ===== Geology: bedrock provinces, lenses of rare stone, and finite deposits of clay and ore (generation only: nothing digs yet) =====
// Listed before gen.js, which calls lay; it reads no other module, so gen.js passes in the arrays, a random source and the biome codes.
// The setting is Europe of 1300 to 1700, continental and Scandinavian: granite and gneiss are the common ground, limestone and sandstone
// the building stones, slate, marble and soapstone the rarer ones; iron comes from bogs and from rock, silver with lead, tin only in granite.
VB['gen/geology'] = (() => {
  // Bedrock, w.rock's codes. weight: a province's chance of each of the four common rocks; marble and soapstone are lenses (VEINS).
  const ROCK = { NONE: 0, GRANITE: 1, LIMESTONE: 2, SANDSTONE: 3, SLATE: 4, MARBLE: 5, SOAPSTONE: 6 };
  const ROCKS = [
    { key: 'none', name: '' },
    { key: 'granite', name: 'Granite', weight: 45 },
    { key: 'limestone', name: 'Limestone', weight: 22 },
    { key: 'sandstone', name: 'Sandstone', weight: 18 },
    { key: 'slate', name: 'Slate', weight: 15 },
    { key: 'marble', name: 'Marble' },
    { key: 'soapstone', name: 'Soapstone' },
  ];
  // Deposits, w.deposit's codes.
  const DEPOSIT = { NONE: 0, CLAY: 1, BOG_IRON: 2, IRON: 3, COPPER: 4, LEAD_SILVER: 5, TIN: 6, GOLD: 7 };
  const DEPOSITS = [
    { key: 'none', name: '' },
    { key: 'clay', name: 'Clay' },
    { key: 'bogIron', name: 'Bog iron ore' },
    { key: 'iron', name: 'Iron ore' },
    { key: 'copper', name: 'Copper ore' },
    { key: 'leadSilver', name: 'Lead and silver ore' },
    { key: 'tin', name: 'Tin ore' },
    { key: 'gold', name: 'Gold' },
  ];
  // A deposit tile's w.depositLeft of ENDLESS is a source that does not run out in any game.
  const ENDLESS = 65535;
  // tiles: map tiles (sea included) to a bedrock province, at least `least` provinces; ragged: how far, in tiles, noise moves a border.
  const PROVINCES = { tiles: 2200, least: 3, ragged: 2.5 };
  // Lenses of stone and deposits, laid island by island in this order (the rarest first: a tile holds one deposit, the first to reach it).
  // An island has a kind at all with `chance`, less on an island with fewer than `full` host tiles (in proportion); then one vein for
  // every `per` host tiles, at most `most`, each of size[0]..size[1] tiles grown through hosts from a random one. A deposit tile holds
  // amount[0]..amount[1] loads, most of them few; with chance `rich` a vein's first tile is ENDLESS. host: where it can lie (hosts, below).
  // Untuned for play: the amounts wait for the goods that use them.
  const VEINS = [
    { rock: ROCK.MARBLE, host: 'marble', chance: 0.3, full: 25, per: 300, most: 3, size: [2, 5] },
    { rock: ROCK.SOAPSTONE, host: 'soapstone', chance: 0.25, full: 30, per: 400, most: 2, size: [1, 3] },
    { deposit: DEPOSIT.GOLD, host: 'peak', chance: 0.08, full: 30, per: 600, most: 2, size: [1, 2], amount: [10, 80], rich: 0 },
    { deposit: DEPOSIT.TIN, host: 'tin', chance: 0.12, full: 40, per: 500, most: 2, size: [1, 3], amount: [80, 400], rich: 0.05 },
    { deposit: DEPOSIT.LEAD_SILVER, host: 'upland', chance: 0.2, full: 40, per: 400, most: 3, size: [1, 3], amount: [100, 500], rich: 0.1 },
    { deposit: DEPOSIT.COPPER, host: 'upland', chance: 0.25, full: 40, per: 400, most: 3, size: [2, 4], amount: [150, 800], rich: 0.15 },
    { deposit: DEPOSIT.IRON, host: 'upland', chance: 0.45, full: 40, per: 250, most: 5, size: [2, 5], amount: [200, 1200], rich: 0.15 },
    { deposit: DEPOSIT.BOG_IRON, host: 'bog', chance: 0.7, full: 12, per: 40, most: 8, size: [2, 5], amount: [60, 300], rich: 0 },
    { deposit: DEPOSIT.CLAY, host: 'clay', chance: 0.9, full: 40, per: 80, most: 30, size: [4, 10], amount: [300, 1500], rich: 0.1 },
  ];

  // g: {N, nb, hx, hy, hp, hm, water, biome, river, W, H, R} of the world in the making; rnd: its own random source; B: the biome codes.
  // Returns the three layers.
  function lay(g, rnd, B) {
    const { N, nb, hx, hy, hp, hm, water, biome, river } = g;
    // @state w.rock: Uint8Array per tile; bedrock, a ROCK code of gen/geology (granite..soapstone on land, 0 on water)
    // @state w.deposit: Uint8Array per tile; what can be dug here, a DEPOSIT code of gen/geology (0 on most tiles)
    // @state w.depositLeft: Uint16Array per tile; loads left of the tile's deposit, 65535 (ENDLESS) for one that does not run out; 0 with none
    const rock = new Uint8Array(N), deposit = new Uint8Array(N), depositLeft = new Uint16Array(N);

    // ---- bedrock: provinces round scattered centres, the nearest centre's rock, with ragged borders ----
    const K = Math.max(PROVINCES.least, Math.round(N / PROVINCES.tiles)), px = [], py = [], pr = [];
    const total = ROCKS.reduce((s, r) => s + (r.weight || 0), 0);
    for (let k = 0; k < K; k++) {
      px.push(rnd() * g.W); py.push(rnd() * g.H);
      let x = rnd() * total, c = 1;
      while (c < ROCKS.length - 1 && ROCKS[c].weight && x >= ROCKS[c].weight) { x -= ROCKS[c].weight; c++; }
      pr.push(ROCKS[c].weight ? c : ROCK.GRANITE);
    }
    const rag = PROVINCES.ragged * g.R * 1.7;
    for (let i = 0; i < N; i++) {
      if (water[i]) { rnd(); rnd(); continue; } // the same draws on every tile, so a changed coast does not move the noise inland
      const x = hx[i] + (rnd() - 0.5) * rag, y = hy[i] + (rnd() - 0.5) * rag;
      let best = 0, bd = Infinity;
      for (let k = 0; k < K; k++) { const d = (x - px[k]) * (x - px[k]) + (y - py[k]) * (y - py[k]); if (d < bd) { bd = d; best = k; } }
      rock[i] = pr[best];
    }

    // ---- where each kind can lie ----
    // wet: on a river, or beside a lake or a river; lakeside: beside a lake
    const wet = new Uint8Array(N), lakeside = new Uint8Array(N);
    for (let i = 0; i < N; i++) {
      if (water[i]) continue;
      if (river[i]) wet[i] = 1;
      for (let d = 0; d < 6; d++) {
        const j = nb[i * 6 + d]; if (j < 0) continue;
        if (biome[j] === B.LAKE) { wet[i] = 1; lakeside[i] = 1; } else if (river[j]) wet[i] = 1;
      }
    }
    const upland = (i) => hp[i] > 0.76 && biome[i] !== B.SNOW; // hills, mountains and the pine woods as high
    const soil = (i) => biome[i] === B.MEADOW || biome[i] === B.FOREST || biome[i] === B.PINE || biome[i] === B.HEATH || biome[i] === B.MARSH;
    const hosts = {
      marble: (i) => rock[i] === ROCK.LIMESTONE && hp[i] > 0.6 && biome[i] !== B.SNOW, // limestone changed by the mountain's heat
      soapstone: (i) => upland(i) && (rock[i] === ROCK.GRANITE || rock[i] === ROCK.SLATE),
      peak: (i) => hp[i] > 0.85 && biome[i] !== B.SNOW,
      tin: (i) => upland(i) && rock[i] === ROCK.GRANITE,
      upland,
      bog: (i) => biome[i] === B.MARSH || (lakeside[i] && soil(i) && hp[i] < 0.5), // marsh and the shores of lakes (myrmalm, sjömalm)
      clay: (i) => soil(i) && hp[i] < 0.4 && (hm[i] > 0.55 || wet[i]), // low and damp: valleys, lake shores, the old sea floor
    };

    // ---- islands (land joined through land neighbours), each laid in turn ----
    const seen = new Uint8Array(N), free = (v, i) => (v.rock ? rock[i] !== v.rock : !deposit[i]);
    for (let s = 0; s < N; s++) {
      if (water[s] || seen[s]) continue;
      const isle = [s]; seen[s] = 1;
      for (let h = 0; h < isle.length; h++) for (let d = 0; d < 6; d++) {
        const j = nb[isle[h] * 6 + d]; if (j >= 0 && !water[j] && !seen[j]) { seen[j] = 1; isle.push(j); }
      }
      for (const v of VEINS) {
        const host = hosts[v.host], at = isle.filter((i) => host(i) && free(v, i));
        const here = rnd() < v.chance * Math.min(1, at.length / v.full); // drawn even with no host, so each island's draws stay in step
        if (!here || !at.length) continue;
        const veins = Math.max(1, Math.min(v.most, Math.round(at.length / v.per)));
        for (let n = 0; n < veins; n++) {
          const first = at[(rnd() * at.length) | 0], size = v.size[0] + ((rnd() * (v.size[1] - v.size[0] + 1)) | 0), rich = rnd() < (v.rich || 0);
          if (!free(v, first)) continue;
          const vein = [first], edge = [first], inVein = new Set(vein);
          while (vein.length < size && edge.length) {
            const e = (rnd() * edge.length) | 0, i = edge[e], open = [];
            for (let d = 0; d < 6; d++) { const j = nb[i * 6 + d]; if (j >= 0 && !water[j] && !inVein.has(j) && host(j) && free(v, j)) open.push(j); }
            if (!open.length) { edge[e] = edge[edge.length - 1]; edge.pop(); continue; }
            const j = open[(rnd() * open.length) | 0]; inVein.add(j); vein.push(j); edge.push(j);
          }
          for (const i of vein) {
            if (v.rock) { rock[i] = v.rock; continue; }
            const r = rnd();
            deposit[i] = v.deposit;
            depositLeft[i] = rich && i === first ? ENDLESS : Math.round(v.amount[0] + (v.amount[1] - v.amount[0]) * r * r);
          }
        }
      }
    }
    return { rock, deposit, depositLeft };
  }

  return { lay, ROCK, ROCKS, DEPOSIT, DEPOSITS, ENDLESS, PROVINCES, VEINS };
})();
