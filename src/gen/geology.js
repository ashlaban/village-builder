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
  // Deposits, w.deposit's codes. hidden: an ore that does not show at the surface, and must be found (sim/prospect).
  const DEPOSIT = {
    NONE: 0,
    CLAY: 1,
    BOG_IRON: 2,
    IRON: 3,
    COPPER: 4,
    LEAD_SILVER: 5,
    TIN: 6,
    GOLD: 7,
    SALT: 8,
    PEAT: 9,
    FLINT: 10,
    AMBER: 11,
  };
  const DEPOSITS = [
    { key: 'none', name: '' },
    { key: 'clay', name: 'Clay' },
    { key: 'bogIron', name: 'Bog iron ore' },
    { key: 'iron', name: 'Iron ore', hidden: true },
    { key: 'copper', name: 'Copper ore', hidden: true },
    { key: 'leadSilver', name: 'Lead and silver ore', hidden: true },
    { key: 'tin', name: 'Tin ore', hidden: true },
    { key: 'gold', name: 'Gold', hidden: true },
    { key: 'salt', name: 'Salt spring' },
    { key: 'peat', name: 'Peat' },
    { key: 'flint', name: 'Flint' },
    { key: 'amber', name: 'Amber' },
  ];
  // A deposit tile's w.depositLeft of ENDLESS is a source that does not run out in any game.
  const ENDLESS = 65535;
  // A hidden vein can be come on by work within `reach` tiles of it (w.veinNear).
  const FIND = { reach: 2 };
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
    {
      deposit: DEPOSIT.GOLD,
      host: 'peak',
      chance: 0.08,
      full: 30,
      per: 600,
      most: 2,
      size: [1, 2],
      amount: [10, 80],
      rich: 0,
    },
    {
      deposit: DEPOSIT.TIN,
      host: 'tin',
      chance: 0.25,
      full: 40,
      per: 500,
      most: 2,
      size: [1, 3],
      amount: [80, 400],
      rich: 0.05,
    },
    {
      deposit: DEPOSIT.LEAD_SILVER,
      host: 'upland',
      chance: 0.3,
      full: 40,
      per: 400,
      most: 3,
      size: [1, 3],
      amount: [100, 500],
      rich: 0.1,
    },
    {
      deposit: DEPOSIT.COPPER,
      host: 'upland',
      chance: 0.25,
      full: 40,
      per: 400,
      most: 3,
      size: [2, 4],
      amount: [150, 800],
      rich: 0.15,
    },
    {
      deposit: DEPOSIT.IRON,
      host: 'upland',
      chance: 0.45,
      full: 40,
      per: 250,
      most: 5,
      size: [2, 5],
      amount: [200, 1200],
      rich: 0.15,
    },
    {
      deposit: DEPOSIT.AMBER,
      host: 'shore',
      chance: 0.1,
      full: 20,
      per: 150,
      most: 2,
      size: [1, 3],
      amount: [5, 40],
      rich: 0,
    },
    {
      deposit: DEPOSIT.SALT,
      host: 'salt',
      chance: 0.1,
      full: 60,
      per: 2000,
      most: 1,
      size: [1, 1],
      amount: [0, 0],
      rich: 1,
    }, // a spring flows on
    {
      deposit: DEPOSIT.FLINT,
      host: 'flint',
      chance: 0.5,
      full: 20,
      per: 80,
      most: 4,
      size: [2, 4],
      amount: [100, 600],
      rich: 0,
    },
    {
      deposit: DEPOSIT.BOG_IRON,
      host: 'bog',
      chance: 0.7,
      full: 12,
      per: 40,
      most: 8,
      size: [2, 5],
      amount: [60, 300],
      rich: 0,
    },
    {
      deposit: DEPOSIT.PEAT,
      host: 'peat',
      chance: 0.8,
      full: 10,
      per: 20,
      most: 10,
      size: [3, 8],
      amount: [500, 3000],
      rich: 0,
    },
    {
      deposit: DEPOSIT.CLAY,
      host: 'clay',
      chance: 0.9,
      full: 40,
      per: 80,
      most: 30,
      size: [4, 10],
      amount: [300, 1500],
      rich: 0.1,
    },
  ];

  // g: {N, nb, hx, hy, hp, hm, water, biome, river, W, H, R, seed} of the world in the making; B: the biome codes. rng(seed): a seeded
  // random source: the bedrock (0) and each kind of VEINS draw from one of their own, so a kind added later leaves the others' draws as they were.
  // Returns the three layers.
  function lay(g, rng, B) {
    const stream = (k) => rng(g.seed ^ 0x6e0106 ^ Math.imul(k, 0x9e3779b1));
    const { N, nb, hx, hy, hp, hm, water, biome, river } = g,
      rnd = stream(0);
    // @state w.rock: Uint8Array per tile; bedrock, a ROCK code of gen/geology (granite..soapstone on land, 0 on water)
    // @state w.deposit: Uint8Array per tile; what can be dug here, a DEPOSIT code of gen/geology (0 on most tiles)
    // @state w.depositLeft: Uint16Array per tile; loads left of the tile's deposit, 65535 (ENDLESS) for one that does not run out; 0 with none
    // @state w.vein: Uint16Array per tile; the id (1..) of the vein the tile's deposit belongs to, 0 with none
    // @state w.veinKind: array by vein id of the vein's DEPOSIT code (index 0 unused)
    // @state w.veinNear: Uint16Array per tile; the id of a hidden vein within FIND.reach tiles over land, the nearest, 0 with none
    const rock = new Uint8Array(N),
      deposit = new Uint8Array(N),
      depositLeft = new Uint16Array(N);
    const vein = new Uint16Array(N),
      veinNear = new Uint16Array(N),
      veinKind = [0];

    // ---- bedrock: provinces round scattered centres, the nearest centre's rock, with ragged borders ----
    const K = Math.max(PROVINCES.least, Math.round(N / PROVINCES.tiles)),
      px = [],
      py = [],
      pr = [];
    const total = ROCKS.reduce((s, r) => s + (r.weight || 0), 0);
    for (let k = 0; k < K; k++) {
      px.push(rnd() * g.W);
      py.push(rnd() * g.H);
      let x = rnd() * total,
        c = 1;
      while (c < ROCKS.length - 1 && ROCKS[c].weight && x >= ROCKS[c].weight) {
        x -= ROCKS[c].weight;
        c++;
      }
      pr.push(ROCKS[c].weight ? c : ROCK.GRANITE);
    }
    const rag = PROVINCES.ragged * g.R * 1.7;
    for (let i = 0; i < N; i++) {
      if (water[i]) {
        rnd();
        rnd();
        continue;
      } // the same draws on every tile, so a changed coast does not move the noise inland
      const x = hx[i] + (rnd() - 0.5) * rag,
        y = hy[i] + (rnd() - 0.5) * rag;
      let best = 0,
        bd = Infinity;
      for (let k = 0; k < K; k++) {
        const d = (x - px[k]) * (x - px[k]) + (y - py[k]) * (y - py[k]);
        if (d < bd) {
          bd = d;
          best = k;
        }
      }
      rock[i] = pr[best];
    }

    // ---- where each kind can lie ----
    // wet: on a river, or beside a lake or a river; lakeside: beside a lake; coast: beside any water
    const wet = new Uint8Array(N),
      lakeside = new Uint8Array(N),
      coast = new Uint8Array(N);
    for (let i = 0; i < N; i++) {
      if (water[i]) continue;
      if (river[i]) wet[i] = 1;
      for (let d = 0; d < 6; d++) {
        const j = nb[i * 6 + d];
        if (j < 0) continue;
        if (biome[j] === B.LAKE) {
          wet[i] = 1;
          lakeside[i] = 1;
        } else if (river[j]) wet[i] = 1;
        if (water[j]) coast[i] = 1; // on the sea or a lake
      }
    }
    const upland = (i) => hp[i] > 0.76 && biome[i] !== B.SNOW; // hills, mountains and the pine woods as high
    const soil = (i) =>
      biome[i] === B.MEADOW ||
      biome[i] === B.FOREST ||
      biome[i] === B.PINE ||
      biome[i] === B.HEATH ||
      biome[i] === B.MARSH;
    const hosts = {
      marble: (i) => rock[i] === ROCK.LIMESTONE && hp[i] > 0.6 && biome[i] !== B.SNOW, // limestone changed by the mountain's heat
      soapstone: (i) => upland(i) && (rock[i] === ROCK.GRANITE || rock[i] === ROCK.SLATE),
      peak: (i) => hp[i] > 0.85 && biome[i] !== B.SNOW,
      tin: (i) => upland(i) && rock[i] === ROCK.GRANITE,
      upland,
      bog: (i) => biome[i] === B.MARSH || (lakeside[i] && soil(i) && hp[i] < 0.5), // marsh and the shores of lakes (myrmalm, sjömalm)
      shore: (i) => biome[i] === B.BEACH, // amber, washed up on sandy shores
      salt: (i) =>
        soil(i) &&
        !coast[i] &&
        !wet[i] &&
        hp[i] > 0.2 &&
        hp[i] < 0.7 &&
        (rock[i] === ROCK.LIMESTONE || rock[i] === ROCK.SANDSTONE),
      flint: (i) => rock[i] === ROCK.LIMESTONE && hp[i] < 0.3 && biome[i] !== B.MARSH, // nodules in the low limestone and its shores
      peat: (i) => biome[i] === B.MARSH,
      clay: (i) => soil(i) && hp[i] < 0.4 && (hm[i] > 0.55 || wet[i]), // low and damp: valleys, lake shores, the old sea floor
    };

    // ---- islands (land joined through land neighbours), each laid in turn ----
    const streams = VEINS.map((v) => stream(v.rock ? v.rock : 16 + v.deposit));
    const seen = new Uint8Array(N),
      free = (v, i) => (v.rock ? rock[i] !== v.rock : !deposit[i]);
    for (let s = 0; s < N; s++) {
      if (water[s] || seen[s]) continue;
      const isle = [s];
      seen[s] = 1;
      for (let h = 0; h < isle.length; h++)
        for (let d = 0; d < 6; d++) {
          const j = nb[isle[h] * 6 + d];
          if (j >= 0 && !water[j] && !seen[j]) {
            seen[j] = 1;
            isle.push(j);
          }
        }
      for (let k = 0; k < VEINS.length; k++) {
        const v = VEINS[k],
          draw = streams[k];
        const host = hosts[v.host],
          at = isle.filter((i) => host(i) && free(v, i));
        const here = draw() < v.chance * Math.min(1, at.length / v.full); // drawn even with no host, so each island's draws stay in step
        if (!here || !at.length) continue;
        const veins = Math.max(1, Math.min(v.most, Math.round(at.length / v.per)));
        for (let n = 0; n < veins; n++) {
          const first = at[(draw() * at.length) | 0],
            size = v.size[0] + ((draw() * (v.size[1] - v.size[0] + 1)) | 0),
            rich = draw() < (v.rich || 0);
          if (!free(v, first)) continue;
          const run = [first],
            edge = [first],
            inVein = new Set(run);
          if (v.deposit) veinKind.push(v.deposit);
          while (run.length < size && edge.length) {
            const e = (draw() * edge.length) | 0,
              i = edge[e],
              open = [];
            for (let d = 0; d < 6; d++) {
              const j = nb[i * 6 + d];
              if (j >= 0 && !water[j] && !inVein.has(j) && host(j) && free(v, j)) open.push(j);
            }
            if (!open.length) {
              edge[e] = edge[edge.length - 1];
              edge.pop();
              continue;
            }
            const j = open[(draw() * open.length) | 0];
            inVein.add(j);
            run.push(j);
            edge.push(j);
          }
          for (const i of run) {
            if (v.rock) {
              rock[i] = v.rock;
              continue;
            }
            vein[i] = veinKind.length - 1;
            const r = draw();
            deposit[i] = v.deposit;
            depositLeft[i] =
              rich && i === first ? ENDLESS : Math.round(v.amount[0] + (v.amount[1] - v.amount[0]) * r * r);
          }
        }
      }
    }
    nearVeins({ N, nb, water, deposit, vein, veinNear });
    return { rock, deposit, depositLeft, vein, veinKind, veinNear };
  }
  // The land within reach of each hidden vein, the nearest vein's id (the lower tile first among equals), into w.veinNear (all 0 before).
  function nearVeins(w) {
    const { N, nb, water, deposit, vein, veinNear } = w,
      q = [],
      steps = new Uint8Array(N);
    for (let i = 0; i < N; i++)
      if (vein[i] && DEPOSITS[deposit[i]].hidden) {
        veinNear[i] = vein[i];
        q.push(i);
      }
    for (let h = 0; h < q.length; h++) {
      const i = q[h];
      if (steps[i] >= FIND.reach) continue;
      for (let d = 0; d < 6; d++) {
        const j = nb[i * 6 + d];
        if (j < 0 || water[j] || veinNear[j]) continue;
        veinNear[j] = veinNear[i];
        steps[j] = steps[i] + 1;
        q.push(j);
      }
    }
  }
  // By hand (the editor; before a run is seeded on the world): a land tile's deposit, with a middling amount of its kind, or one that does
  // not run out where the kind's veins hold nothing else (a salt spring); DEPOSIT.NONE takes the deposit away. Then reveins(w), once.
  function setDeposit(w, i, d) {
    if (w.water[i]) return false;
    const v = VEINS.find((x) => x.deposit === d);
    w.deposit[i] = d;
    w.depositLeft[i] = !d || !v ? 0 : v.amount[1] > 0 ? Math.round((v.amount[0] + v.amount[1]) / 2) : ENDLESS;
    return true;
  }
  // The veins anew from the deposits as they lie: each run of one kind joined through neighbours is a vein, numbered in tile order.
  function reveins(w) {
    const { N, nb, deposit, vein, veinNear } = w;
    vein.fill(0);
    veinNear.fill(0);
    w.veinKind.length = 1;
    for (let s = 0; s < N; s++) {
      if (!deposit[s] || vein[s]) continue;
      w.veinKind.push(deposit[s]);
      const id = w.veinKind.length - 1,
        run = [s];
      vein[s] = id;
      for (let h = 0; h < run.length; h++)
        for (let d = 0; d < 6; d++) {
          const j = nb[run[h] * 6 + d];
          if (j >= 0 && deposit[j] === deposit[s] && !vein[j]) {
            vein[j] = id;
            run.push(j);
          }
        }
    }
    nearVeins(w);
  }

  return { lay, setDeposit, reveins, ROCK, ROCKS, DEPOSIT, DEPOSITS, ENDLESS, FIND, PROVINCES, VEINS };
})();
