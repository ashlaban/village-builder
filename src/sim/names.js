// @sys sim/names: name generators by kind of thing named (farms, villages; VB-026, VB-399) and the culture's order of preference among the farms'
VB['sim/names'] = (() => {
  const { B } = VB['gen'];
  const { DIRNAME } = VB['sim/rules'];
  const { bfs } = VB['sim/hex'];
  // ---- farms ----
  // A generator is (ctx, rand) => [names, best first]; the caller takes the first not already taken. ctx: {w, f (the farmstead),
  // village (its centre for compass names), owner (the first holder, a pawn, or null)}. A generator offers nothing ([]) when it has no name.
  // compass: by direction from the village centre (Norrgården, Södergården), then the middle farm and the new farm.
  function compass(ctx) {
    const { w, f, village: v } = ctx;
    if (!v || f.house === v.center) return [];
    const dx = w.hx[f.house] - w.hx[v.center], dy = w.hy[f.house] - w.hy[v.center];
    const a = (Math.atan2(-dy, dx) + Math.PI * 2) % (Math.PI * 2), k = Math.round(a / (Math.PI / 3)) % 6;
    return [DIRNAME[k] + 'gården', 'Mellangården', 'Nygården'];
  }
  // landmark: by the surroundings within 2 steps: shore, woods, hills, marsh, or open land (Strand, Lunden, Backa, Myra, Ängen...). The
  // first word is the lone farm's old name; then other words for the same ground, then each word with a prefix from the ground (Björklunden,
  // Sandstrand, Långmyra), in an order fixed by the house tile, so farms near each other differ. Only open land draws from rand, once.
  const WORDS = {
    coast: ['Strand', 'Viken', 'Näset', 'Udden', 'Sjöänden', 'Bryggan'],
    woods: ['Lunden', 'Hult', 'Lid', 'Skogen', 'Rödjan', 'Bråten'],
    hills: ['Backa', 'Åsen', 'Kullen', 'Berget', 'Höjden', 'Hällen'],
    marsh: ['Myra', 'Mossen', 'Kärret', 'Sjöängen', 'Vassen'],
    open: ['Ängen', 'Hagen', 'Berga', 'Åkern', 'Gärdet', 'Vreten', 'Tegen', 'Slätten'],
  };
  const PLAIN = ['Ängen', 'Hagen', 'Berga', 'Åkern']; // the old plain names, drawn as before
  const PREFIX = {
    broadleaf: ['Björk', 'Ek', 'Asp', 'Al', 'Lind', 'Hassel', 'Rönn'], pine: ['Gran', 'Tall', 'Fur'], water: ['Sjö', 'Vik', 'Sand'],
    stone: ['Sten', 'Häll'], marsh: ['Myr', 'Starr', 'Kärr'],
    any: ['Ny', 'Stor', 'Lill', 'Lång', 'Norr', 'Söder', 'Öster', 'Väster', 'Mel', 'Hög', 'Bred', 'Sol', 'Ljung', 'Ros', 'Häst', 'Ox', 'Lamm', 'Vall'],
  };
  const lower = (s) => s[0].toLowerCase() + s.slice(1);
  function landmark(ctx, rand) {
    const { w, f } = ctx;
    let coast = false, woods = 0, pine = 0, hills = 0, marsh = 0, beach = 0;
    const { dist: near } = bfs(w, f.house, 2, () => true);
    for (const [j] of near) {
      if (w.water[j]) coast = true; const b = w.biome[j];
      if (b === B.FOREST) woods++; if (b === B.PINE) { woods++; pine++; } if (b === B.HILLS) hills++; if (b === B.MARSH) marsh++; if (b === B.BEACH) beach++;
    }
    const kind = coast ? 'coast' : woods >= 4 ? 'woods' : hills >= 3 ? 'hills' : marsh >= 2 ? 'marsh' : 'open';
    const first = kind === 'open' ? PLAIN[(rand() * PLAIN.length) | 0] : WORDS[kind][0];
    const words = [first, ...WORDS[kind].filter((x) => x !== first)];
    const pre = [...(woods - pine > 0 ? PREFIX.broadleaf : []), ...(pine ? PREFIX.pine : []), ...(coast || beach ? PREFIX.water : []),
      ...(w.stones && w.stones[f.house] > 96 ? PREFIX.stone : []), ...(marsh ? PREFIX.marsh : []), ...PREFIX.any];
    const out = [...words], n = pre.length, start = (f.house * 7919) % n;
    for (let k = 0; k < n; k++) for (const x of words) out.push(pre[(start + k) % n] + lower(x));
    return out;
  }
  // owner: the first holder's given name in the genitive (Olofsgården, Hansgården).
  const owner = (ctx) => (ctx.owner ? [(ctx.owner.given.endsWith('s') ? ctx.owner.given : ctx.owner.given + 's') + 'gården'] : []);
  const FARM = { compass, landmark, owner };
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
  // The name of farm f by the generators in `order`: the first name not in `taken` (a Set); if every generator fails, the first name
  // offered with the lowest number not taken ("Norrgården 2").
  function farmName(ctx, taken, rand, order = DEFAULT_PREFS.farm) {
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
  const VILLAGE = { reach: 5, isle: 250, head: 0.3, bay: 0.45, wood: 6, hill: 6, open: 0.5, sacred: 0.08, offers: 48, centre: 8 };
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
  const PLACE = { site, central };
  // The name of the village of ctx by the generators in `order`: the first name not in `taken` (a Set); if all are taken, the first
  // offered with the lowest number not taken.
  function villageName(ctx, taken, rand, order = ['site']) {
    let firstOffer = null;
    for (const gname of order) {
      for (const nm of PLACE[gname](ctx, rand)) { if (firstOffer === null) firstOffer = nm; if (!taken.has(nm)) return nm; }
    }
    const base = firstOffer || 'Byn';
    let n = 2; while (taken.has(`${base} ${n}`)) n++;
    return `${base} ${n}`;
  }
  // founder: a village founded in play takes its founder's given name in the genitive with a settlement ending (Erikstorp, Olofsboda), as
  // many torp did; the first not taken, then the first with a number (till founded villages go through villageName, VB-399's second batch).
  const SUFFIX = ['torp', 'ryd', 'boda', 'hult', 'mark']; // daughter (-torp), clearing (-ryd), booths (-boda), grove (-hult), outland (-mark)
  function founderName(p, taken) {
    const base = p.given.endsWith('s') ? p.given : p.given + 's';
    for (const s of SUFFIX) if (!taken.has(base + s)) return base + s;
    let n = 2; while (taken.has(`${base}${SUFFIX[0]} ${n}`)) n++;
    return `${base}${SUFFIX[0]} ${n}`;
  }
  return { FARM, PLACE, VILLAGE, FIRST, END, DEFAULT_PREFS, prefsOf, farmName, tileRand, compass, landmark, owner, ground, join, site, central, villageName,
    founderName,
    SUFFIX };
})();
