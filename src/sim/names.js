// @sys sim/names: name generators by kind of thing named (farms, villages; VB-026, VB-399) and the culture's order of preference among the farms'
VB['sim/names'] = (() => {
  const { B } = VB['gen'];
  const { DIRNAME } = VB['sim/rules'];
  const { bfs, hexSteps } = VB['sim/hex'];
  // ---- farms ----
  // A generator is (ctx, rand) => [names, best first]; the caller takes the first not already taken. ctx: {w, f (the farmstead),
  // village (its centre for the names that need one), owner (the first holder, a pawn, or null), farms (the village's farmsteads, for
  // the largest and the smallest, or none), fresh (a farm built in play)}. A generator offers nothing ([]) when it has no name.
  const FARMS = { near: 1, out: 3, rise: 0.08 };
  // The sixth of the compass tile `to` lies in, seen from `from`: an index of DIRNAME.
  function sixth(w, from, to) {
    const a = (Math.atan2(w.hy[from] - w.hy[to], w.hx[to] - w.hx[from]) + Math.PI * 2) % (Math.PI * 2);
    return Math.round(a / (Math.PI / 3)) % 6;
  }
  // compass: by direction from the village centre (Norrgården, Södergården).
  function compass(ctx) {
    const { w, f, village: v } = ctx;
    return !v || f.house === v.center ? [] : [DIRNAME[sixth(w, v.center, f.house)] + 'gården'];
  }
  // position: by where the farm lies in the village: above or below its centre by FARMS.rise of height (Övergården, Uppgården;
  // Nedergården), within FARMS.near steps of it (Mellangården, Hemgården, Innergården) or FARMS.out steps and more from it (Yttergården,
  // Bortgården); height first or distance first, by one draw.
  function position(ctx, rand) {
    const { w, f, village: v } = ctx, first = rand() < 0.5;
    if (!v || f.house === v.center) return [];
    const dh = w.he[f.house] - w.he[v.center], d = hexSteps(w, v.center, f.house);
    const height = dh >= FARMS.rise ? ['Övergården', 'Uppgården'] : dh <= -FARMS.rise ? ['Nedergården'] : [];
    const dist = d <= FARMS.near ? ['Mellangården', 'Hemgården', 'Innergården'] : d >= FARMS.out ? ['Yttergården', 'Bortgården'] : [];
    return first ? [...height, ...dist] : [...dist, ...height];
  }
  // The ground of the house tile and its six neighbours, for feature; and the kind of ground within 2 steps, for landmark.
  function around(w, t, steps) {
    const g = { coast: false, woods: 0, pine: 0, hills: 0, marsh: 0, beach: 0, open: 0 };
    for (const [j] of bfs(w, t, steps, () => true).dist) {
      if (w.water[j]) g.coast = true; const b = w.biome[j];
      if (b === B.FOREST) g.woods++; if (b === B.PINE) { g.woods++; g.pine++; } if (b === B.HILLS) g.hills++; if (b === B.MARSH) g.marsh++;
      if (b === B.BEACH) g.beach++; if (b === B.MEADOW || b === B.HEATH) g.open++;
    }
    return g;
  }
  const kindOf = (g) => (g.coast ? 'coast' : g.woods >= 4 ? 'woods' : g.hills >= 3 ? 'hills' : g.marsh >= 2 ? 'marsh' : 'open');
  const landKind = (w, t) => kindOf(around(w, t, 2));
  // feature: by what lies at the house, the rarer first: water, marsh, a hill, stony ground, wood, open land (Strandgården, Kärrgården,
  // Backgården, Stengården, Lundgården, Ängsgården).
  function feature(ctx) {
    const { w, f } = ctx, g = around(w, f.house, 1);
    return [...(g.coast ? ['Strandgården', 'Sjögården'] : []), ...(g.marsh ? ['Kärrgården', 'Myrgården'] : []),
      ...(g.hills ? ['Backgården', 'Bergsgården'] : []), ...(w.stones && w.stones[f.house] > 96 ? ['Stengården', 'Hällgården'] : []),
      ...(g.woods - g.pine > 0 ? ['Lundgården'] : []), ...(g.woods ? ['Skogsgården'] : []), ...(g.open ? ['Ängsgården', 'Hagagården', 'Vallgården'] : [])];
  }
  // age: a farm built in play is the new one (Nygården, Nybygget); of the old ones, that of most fields is the great farm and that of
  // fewest the little one (Storgården, Lillgården), and any may be the old farm (Gammelgården).
  function age(ctx) {
    if (ctx.fresh) return ['Nygården', 'Nybygget'];
    const n = ctx.f.fields.length, others = (ctx.farms || []).filter((g) => g !== ctx.f).map((g) => g.fields.length);
    const most = others.length && others.every((k) => k < n), least = others.length && others.every((k) => k > n);
    return [...(most ? ['Storgården'] : []), ...(least ? ['Lillgården'] : []), 'Gammelgården'];
  }
  // landmark: by the surroundings within 2 steps: shore, woods, hills, marsh, or open land (Strand, Lunden, Backa, Myra, Ängen...). The
  // first word is the lone farm's old name (on open land one of the first four, by one draw); then other words for the same ground, then
  // each word with a prefix from the ground (Björklunden, Sandstrand, Långmyra), in an order fixed by the house tile, so farms near each
  // other differ.
  const WORDS = {
    coast: ['Strand', 'Viken', 'Näset', 'Udden', 'Sjöänden'],
    woods: ['Lunden', 'Dungen', 'Lid', 'Skogen', 'Rödjan', 'Svedjan'],
    hills: ['Backa', 'Åsen', 'Kullen', 'Berget', 'Höjden', 'Hällen', 'Berga'],
    marsh: ['Myra', 'Mossen', 'Kärret', 'Sjöängen', 'Vassen'],
    open: ['Ängen', 'Hagen', 'Vallen', 'Åkern', 'Gärdet', 'Vreten', 'Tegen', 'Slätten'],
  };
  const PREFIX = {
    broadleaf: ['Björk', 'Ek', 'Asp', 'Al', 'Lind', 'Hassel', 'Rönn'], pine: ['Gran', 'Tall', 'Fur'], water: ['Sjö', 'Vik', 'Sand'],
    stone: ['Sten', 'Häll'], marsh: ['Myr', 'Starr', 'Kärr'],
    any: ['Ny', 'Stor', 'Lill', 'Lång', 'Norr', 'Söder', 'Öster', 'Väster', 'Mel', 'Hög', 'Bred', 'Sol', 'Ljung', 'Häst', 'Ox', 'Lamm', 'Vall'],
  };
  const lower = (s) => s[0].toLowerCase() + s.slice(1);
  function landmark(ctx, rand) {
    const { w, f } = ctx, g = around(w, f.house, 2), kind = kindOf(g);
    const first = WORDS[kind][kind === 'open' ? (rand() * 4) | 0 : 0];
    const words = [first, ...WORDS[kind].filter((x) => x !== first)];
    const pre = [...(g.woods - g.pine > 0 ? PREFIX.broadleaf : []), ...(g.pine ? PREFIX.pine : []), ...(g.coast || g.beach ? PREFIX.water : []),
      ...(w.stones && w.stones[f.house] > 96 ? PREFIX.stone : []), ...(g.marsh ? PREFIX.marsh : []), ...PREFIX.any];
    const out = [...words], n = pre.length, start = (f.house * 7919) % n;
    for (let k = 0; k < n; k++) for (const x of words) {
      const nm = pre[(start + k) % n] + lower(x); if (!nm.toLowerCase().startsWith(lower(x) + lower(x))) out.push(nm); }
    return [...new Set(out)];
  }
  // A person's name before an ending: a man's in the genitive (an s unless it ends in s, x or z), a woman's bare, as the medieval names
  // have it (Gunnilbo).
  const stem = (p) => (p.sex === 'f' || /[sxz]$/.test(p.given) ? p.given : p.given + 's');
  // owner: the first holder's given name before the farm (Olofsgården, Hansgården, Ingridgården).
  const owner = (ctx) => (ctx.owner ? [stem(ctx.owner) + 'gården'] : []);
  const FARM = { compass, owner, position, landmark, feature, age };
  // The order of preference every culture starts with (culture.js NAME_PREFS; c.namePrefs on each culture), also used before cultures exist.
  const DEFAULT_PREFS = VB['culture'].NAME_PREFS;
  const prefsOf = (st, villageId) => {
    const env = st && st.cenv, s = env && villageId !== null ? env.settlements[villageId] : null, c = s ? env.cultures[s.culture] : null;
    return (c && c.namePrefs) || DEFAULT_PREFS;
  };
  // A random stream of its own for a farm named in play and for a village (mulberry32 seeded by the house or centre tile; `salt` keeps
  // a village's stream apart from its farm's), so naming never shifts the layout's stream or the simulation's (st.rng), and so their history.
  const tileRand = (t, salt = 0) => {
    let a = (Math.imul(t + 1, 0x9e3779b1) ^ salt) >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0; let x = a;
      x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  };
  // The generators of a preference (a culture's namePrefs.farm, the preferred first) in a random order by weight: the first of n
  // weighs n, the last 1.
  const farmOrder = (prefs, rand) => weighed(prefs.map((g, k) => [g, prefs.length - k]), rand);
  // The name of farm f by the generators in `order` (by default the first preference's, drawn by weight): the first name not in
  // `taken` (a Set); if every generator fails, the first name offered with the lowest number not taken ("Norrgården 2").
  function farmName(ctx, taken, rand, order = farmOrder(DEFAULT_PREFS.farm, rand)) {
    let firstOffer = null;
    for (const g of order) {
      for (const nm of FARM[g](ctx, rand)) { if (firstOffer === null) firstOffer = nm; if (!taken.has(nm)) return nm; }
    }
    const base = firstOffer || 'Gården';
    let n = 2; while (taken.has(`${base} ${n}`)) n++;
    return `${base} ${n}`;
  }
  // ---- villages ----
  // One set of generators for every village, seeded or founded in play (VB-399): a generator is (ctx, rand) => [names, best first], as for
  // farms. ctx: {w, site (the centre tile), founder (a pawn, or null), mother (the village it left, or null)}; a village with no mother
  // is an old one. The word stock follows the layers of Swedish place names, to a medieval ceiling (backlog/VB-399.md).
  const VILLAGE = { reach: 5, isle: 250, head: 0.3, bay: 0.45, wood: 6, hill: 6, open: 0.5, sacred: 0.08, offers: 48, centre: 8, far: 12,
    salt: 0x5bd1e995, prefs: { founder: 3, mother: 1 } };
  // The ground within VILLAGE.reach steps of tile t: counts by kind, and whether t lies on an island of at most VILLAGE.isle tiles.
  function ground(w, t) {
    const g = { n: 0, water: 0, broadleaf: 0, pine: 0, hills: 0, marsh: 0, open: 0, stony: !!(w.stones && w.stones[t] > 96), isle: true };
    for (const [j] of bfs(w, t, VILLAGE.reach, () => true).dist) {
      g.n++; if (w.water[j]) { g.water++; continue; }
      const b = w.biome[j];
      if (b === B.FOREST) g.broadleaf++; else if (b === B.PINE) g.pine++; else if (b === B.HILLS) g.hills++; else if (b === B.MARSH) g.marsh++;
      else if (b === B.MEADOW || b === B.HEATH) g.open++;
    }
    const seen = new Set([t]), q = [t];
    for (let h = 0; h < q.length && g.isle; h++) for (let k = 0; k < 6; k++) {
      const j = w.nb[q[h] * 6 + k]; if (j < 0 || w.water[j] || seen.has(j)) continue;
      seen.add(j); q.push(j); if (q.length > VILLAGE.isle) { g.isle = false; break; }
    }
    return g;
  }
  // First parts by what they mean, as bare stems (the old endings take no genitive): the first six are offered only where the ground has
  // them, and then count twice; the lie of the land, crops, beasts, size and colour are offered anywhere.
  const FIRST = {
    tree: ['Ek', 'Ask', 'Asp', 'Al', 'Björk', 'Lind', 'Hassel', 'Alm', 'Lönn'], pine: ['Gran', 'Furu', 'Tall'], shore: ['Sand', 'Vass', 'Ör'],
    stone: ['Sten', 'Hall', 'Berg', 'Hammar'], marsh: ['Myr', 'Kärr'], open: ['Äng', 'Hag', 'Val', 'Hed', 'Ljung'],
    land: ['Dal', 'Bäck', 'Ås', 'Kull', 'Lund'], crop: ['Lin', 'Korn', 'Råg', 'Ärt'],
    beast: ['Ox', 'Häst', 'Get', 'Hjort', 'Björn', 'Varg', 'Räv', 'Örn', 'Gås', 'Svan', 'Tran', 'Säl'],
    size: ['Stor', 'Lill', 'Lång', 'Bred', 'Hög', 'Sol'], colour: ['Svart', 'Röd', 'Grå', 'Vit'],
  };
  const NATURE = ['tree', 'pine', 'shore', 'stone', 'beast', 'size', 'colour'];
  // Endings of the old layer: e the ending, n its weight, fits the ground it wants (none: anywhere), takes the kinds of first part it joins.
  // Habitation: -by (farm, village), -sta (place), -inge (the people at). Nature: -lunda (grove), -åker (field), -berga (the heights),
  // -vik (bay), -näs (headland), -ö (island).
  const END = [
    { e: 'by', n: 3, takes: ['tree', 'pine', 'shore', 'stone', 'marsh', 'open', 'land', 'size'] },
    { e: 'sta', n: 3, takes: ['tree', 'shore', 'stone', 'open', 'land', 'size'] },
    { e: 'inge', n: 1, takes: ['stone', 'land'] },
    { e: 'lunda', n: 2, fits: (g) => g.broadleaf >= VILLAGE.wood, takes: ['tree', 'beast', 'size'] },
    { e: 'åker', n: 1, fits: (g) => g.open >= VILLAGE.open * g.n, takes: ['stone', 'crop', 'size'] },
    { e: 'berga', n: 2, fits: (g) => g.hills >= VILLAGE.hill, takes: ['tree', 'pine', 'stone', 'size'] },
    { e: 'vik', n: 3, fits: (g) => g.water > 0 && g.water < VILLAGE.bay * g.n, takes: NATURE },
    { e: 'näs', n: 3, fits: (g) => g.water >= VILLAGE.head * g.n, takes: NATURE },
    { e: 'ö', n: 4, fits: (g) => g.isle, takes: NATURE },
  ];
  const HAS = { tree: (g) => g.broadleaf > 0, pine: (g) => g.pine > 0, shore: (g) => g.water > 0, stone: (g) => g.stony || g.hills > 0,
    marsh: (g) => g.marsh > 0, open: (g) => g.open > 0 };
  // Joining: these trees take a link -e- before -by and -berga (Ekeby, Askeberga); an ending that begins with a vowel wants a consonant
  // before it; a first part is not joined to itself (Berg + berga); three of a letter become two (Hall + lunda: Hallunda).
  const LINK = new Set(['Ek', 'Ask', 'Asp', 'Björk', 'Lind']), LINKED = new Set(['by', 'berga']), VOWEL = /[aeiouyåäö]/;
  function join(a, e) {
    if (VOWEL.test(e[0]) && VOWEL.test(a[a.length - 1])) return null;
    if (e.startsWith(a.toLowerCase())) return null;
    return (a + (LINK.has(a) && LINKED.has(e) ? 'e' : '') + e).replace(/(.)\1\1/, '$1$1');
  }
  // Names of gods and of holy and central places, whole: a few villages of the old layer bear a god's grove or field (VILLAGE.sacred of
  // those the ground suits), and one village of a map, its largest if it has VILLAGE.centre farms, is the old centre (-tuna, the
  // enclosure; -vi, the holy place).
  const SACRED = { lunda: ['Fröslunda', 'Torslunda', 'Ullunda'], åker: ['Frösåker', 'Torsåker', 'Ulleråker'] };
  const CENTRAL = { tuna: ['Frötuna', 'Ultuna', 'Torstuna', 'Tuna'], vi: ['Frövi', 'Ullvi', 'Torsvi', 'Odensvi'] };
  const pick = (xs, rand) => xs[(rand() * xs.length) | 0];
  const turned = (xs, rand) => { const k = (rand() * xs.length) | 0; return [...xs.slice(k), ...xs.slice(0, k)]; };
  // site: a first part from the ground and an ending that fits the site, VILLAGE.offers draws by weight; where the ground suits it, now
  // and then a god's name first.
  function site(ctx, rand) {
    const g = ground(ctx.w, ctx.site), ends = [], out = [];
    for (const x of END) if (!x.fits || x.fits(g)) for (let k = 0; k < x.n; k++) ends.push(x);
    const holy = rand() < VILLAGE.sacred, which = rand();
    const suited = ends.filter((x, k) => SACRED[x.e] && ends.indexOf(x) === k);
    if (holy && suited.length) out.push(...turned(SACRED[suited[(which * suited.length) | 0].e], rand));
    for (let k = 0; k < VILLAGE.offers; k++) {
      const x = pick(ends, rand), kinds = [];
      for (const t of x.takes) { if (!HAS[t]) kinds.push(t); else if (HAS[t](g)) kinds.push(t, t); }
      const nm = join(pick(FIRST[pick(kinds, rand)], rand), x.e);
      if (nm && !out.includes(nm)) out.push(nm);
    }
    return out;
  }
  // central: the old centre of a map: on a hill the holy place first, else the enclosure.
  function central(ctx, rand) {
    const g = ground(ctx.w, ctx.site), tuna = turned(CENTRAL.tuna, rand), vi = turned(CENTRAL.vi, rand);
    return g.hills >= VILLAGE.hill ? [...vi, ...tuna] : [...tuna, ...vi];
  }
  // Endings of the colonisation layer, for a daughter village: -torp (a daughter farm) and -böle (a new farm) anywhere, -ryd (a
  // clearing) in wood, -boda (booths by an outlying meadow) on open land, -säter (an outland meadow) and -mark (border forest) far from
  // the mother village, and the endings of the shore as an old village has them.
  const woods = (g) => g.broadleaf + g.pine;
  const shoreFit = (e) => END.find((x) => x.e === e).fits;
  const NEW_END = [
    { e: 'torp', n: 2 }, { e: 'böle', n: 2 }, { e: 'ryd', n: 3, fits: (g) => woods(g) >= VILLAGE.wood },
    { e: 'boda', n: 2, fits: (g) => g.open >= VILLAGE.open * g.n }, { e: 'säter', n: 2, fits: (g, far) => far && g.open > 0 },
    { e: 'mark', n: 2, fits: (g, far) => far && woods(g) >= VILLAGE.wood },
    { e: 'vik', n: 2, fits: shoreFit('vik') }, { e: 'näs', n: 2, fits: shoreFit('näs') }, { e: 'ö', n: 3, fits: shoreFit('ö') },
  ];
  // xs ([[x, weight]...]) in a random order, the heavier sooner: drawn one by one by weight.
  function weighed(xs, rand) {
    const out = [];
    for (let rest = xs; rest.length;) {
      let r = rand() * rest.reduce((a, x) => a + x[1], 0), k = 0;
      while (k < rest.length - 1 && r >= rest[k][1]) r -= rest[k++][1];
      out.push(rest[k][0]); rest = rest.filter((x, j) => j !== k);
    }
    return out;
  }
  const far = (ctx) => !!ctx.mother && hexSteps(ctx.w, ctx.mother.center, ctx.site) >= VILLAGE.far;
  // founder: the founder's given name with an ending of the colonisation layer that fits the site, the endings by weight (Erikstorp,
  // Olofsryd, Ingridböle): a man's name in the genitive, a woman's bare, as the medieval names have it (Gunnilbo).
  function founder(ctx, rand) {
    const p = ctx.founder; if (!p) return [];
    const g = ground(ctx.w, ctx.site), isFar = far(ctx), name = stem(p);
    return weighed(NEW_END.filter((x) => !x.fits || x.fits(g, isFar)).map((x) => [x.e, x.n]), rand).map((e) => join(name, e)).filter(Boolean);
  }
  // mother: from the village it left: the by to its north, south, west or east (Norrby, Sörby, Väsby, Ösby), the new village (Nyby,
  // Nytorp, Nyböle), the little one of the mother's name (Lillvalby), the village out there (Utby).
  const DIRBY = { Norr: 'Norrby', Söder: 'Sörby', Väster: 'Väsby', Öster: 'Ösby' };
  function mother(ctx) {
    const m = ctx.mother; if (!m) return [];
    const little = /^[A-ZÅÄÖ][a-zåäö]{3,8}$/.test(m.name) && !/^(Lill|Ny|Ut)/.test(m.name) ? ['Lill' + lower(m.name)] : [];
    return [DIRBY[DIRNAME[sixth(ctx.w, m.center, ctx.site)]], 'Nyby', ...little, 'Nytorp', 'Nyböle', 'Utby'];
  }
  const PLACE = { site, central, founder, mother };
  // The order of the generators for the village of ctx: a daughter's by the weights of VILLAGE.prefs, at random, then its site; an old
  // village's by its site alone (and no draw).
  const placeOrder = (ctx, rand) => (ctx.founder || ctx.mother ? [...weighed(Object.entries(VILLAGE.prefs), rand), 'site'] : ['site']);
  // The name of the village of ctx by the generators in `order`: the first name not in `taken` (a Set); if all are taken, the first
  // offered with the lowest number not taken.
  function villageName(ctx, taken, rand, order = placeOrder(ctx, rand)) {
    let firstOffer = null;
    for (const gname of order) {
      for (const nm of PLACE[gname](ctx, rand)) { if (firstOffer === null) firstOffer = nm; if (!taken.has(nm)) return nm; }
    }
    const base = firstOffer || 'Byn';
    let n = 2; while (taken.has(`${base} ${n}`)) n++;
    return `${base} ${n}`;
  }
  // ---- at seeding (called by sim/layout) ----
  // The layout's stream is drawn as it was when village names came from it (VB-026: 11 first parts and 8 last, drawn again while
  // taken), so every seed's villages stand where they stood: a village holds the drawn name while the villages are laid, and
  // nameVillages and nameFarms replace it. A change of the name stock (sim/names) never comes here.
  const DRAWN = [['Hal', 'Skog', 'Ul', 'Bred', 'Lin', 'Sand', 'Hög', 'Ek', 'Vall', 'Rön', 'Al'], ['by', 'sta', 'vik', 'nes', 'inge', 'berga', 'tuna', 'säter']];
  function drawnName(rand, villages) {
    const taken = new Set(villages.map((v) => v.name)), draw = () => DRAWN[0][(rand() * 11) | 0] + DRAWN[1][(rand() * 8) | 0];
    let name = draw(); for (let k = 0; k < 200 && taken.has(name); k++) name = draw();
    return name;
  }
  // Village names at seeding (VB-399), when all are laid: each village of two farms or more by its site (sim/names), from a stream of
  // its own by its centre tile. The largest (the lowest id among equals) is named first and, with VILLAGE.centre farms, as the map's
  // old centre; a lone farm's village is named by nameFarms.
  function nameVillages(w, villages) {
    const many = villages.filter((v) => v.farmsteads.length >= 2), taken = new Set();
    let big = null; for (const v of many) if (!big || v.farmsteads.length > big.farmsteads.length) big = v;
    const centre = big && big.farmsteads.length >= VILLAGE.centre;
    for (const v of villages) if (v.farmsteads.length < 2) v.name = '';
    for (const v of big ? [big, ...many.filter((u) => u !== big)] : []) {
      const order = centre && v === big ? ['central', 'site'] : ['site'];
      v.name = villageName({ w, site: v.center, founder: null, mother: null }, taken, tileRand(v.center, VILLAGE.salt), order);
      taken.add(v.name);
    }
  }
  // Names at seeding (VB-026, VB-401), before any culture exists, so by the generators every culture starts with (sim/names): the farms
  // of a village of two or more by those generators, their order drawn by weight; a lone farm (a one-farm village) by its surroundings,
  // with a name no other village has, and its village takes that name, so the farm's map label is unique on the island. Each farm's
  // name comes from a stream of its house tile's own; the layout's stream is drawn as it was when the names came from it (drawnFarm).
  function nameFarms(w, villages, farmsteads, rand) {
    const old = new Map();
    for (const f of farmsteads) {
      const v = villages[f.village], many = v.farmsteads.length >= 2, own = tileRand(f.house);
      drawnFarm(w, v, f, many, old, rand);
      if (many) {
        const farms = v.farmsteads.map((id) => farmsteads[id]), taken = new Set(farms.filter((g) => g !== f && g.name).map((g) => g.name));
        f.name = farmName({ w, f, village: v, owner: null, farms }, taken, own);
      } else { f.name = loneFarmName(w, f, own, new Set(villages.filter((u) => u !== v).map((u) => u.name))); v.name = f.name; }
    }
  }
  // The draws VB-026's names took from the layout's stream, taken still, so every seed's land is finished as it was: one draw for a
  // farm named by its surroundings on open land, which a lone farm was, and a village's farm once its compass name, the middle farm
  // and the new farm were taken (`old`: those names by village).
  function drawnFarm(w, v, f, many, old, rand) {
    if (many && f.house !== v.center) {
      if (!old.has(v.id)) old.set(v.id, new Set());
      const had = old.get(v.id), free = [compass({ w, f, village: v })[0], 'Mellangården', 'Nygården'].find((nm) => !had.has(nm));
      if (free) { had.add(free); return; }
    }
    if (landKind(w, f.house) === 'open') rand();
  }
  // The name of a lone farm (a one-farm village) by its surroundings within 2 steps (sim/names landmark), not one in `taken`.
  const loneFarmName = (w, f, rand, taken = new Set()) => farmName({ w, f, village: null, owner: null }, taken, rand, ['landmark']);
  return { FARM, PLACE, VILLAGE, FIRST, END, NEW_END, DEFAULT_PREFS, prefsOf, farmName, tileRand, farmOrder, landKind, FARMS, compass, landmark, owner,
    position, feature, age, ground, join, site, central,
    founder, mother, weighed, villageName, drawnName, nameVillages, nameFarms, loneFarmName };
})();
