// @sys sim/names: name generators by kind of thing named (farms, villages) and the culture's order of preference among them (VB-026)
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
  // A random stream of its own for a farm named in play (mulberry32 seeded by the house tile), so naming never shifts the simulation's
  // stream (st.rand) and so its history.
  const tileRand = (t) => {
    let a = Math.imul(t + 1, 0x9e3779b1) >>> 0;
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
  // syllable: today's village names from 11 first and 8 last parts (Halby, Sandvik); a name not taken, or after 200 tries a numbered one.
  const SYL_A = ['Hal', 'Skog', 'Ul', 'Bred', 'Lin', 'Sand', 'Hög', 'Ek', 'Vall', 'Rön', 'Al'],
    SYL_C = ['by', 'sta', 'vik', 'nes', 'inge', 'berga', 'tuna', 'säter'];
  const syllable = (rand) => SYL_A[(rand() * SYL_A.length) | 0] + SYL_C[(rand() * SYL_C.length) | 0];
  function villageName(rand, taken = new Set()) {
    let name = syllable(rand);
    for (let k = 0; k < 200 && taken.has(name); k++) name = syllable(rand);
    let n = 2; const base = name; while (taken.has(name)) name = `${base} ${n++}`;
    return name;
  }
  // founder: a village founded in play takes its founder's given name in the genitive with a settlement ending (Erikstorp, Olofsboda), as
  // many torp did; the first not taken, then a syllable name.
  const SUFFIX = ['torp', 'ryd', 'boda', 'hult', 'mark']; // daughter (-torp), clearing (-ryd), booths (-boda), grove (-hult), outland (-mark)
  function founderName(p, taken, rand) {
    const base = p.given.endsWith('s') ? p.given : p.given + 's';
    for (const s of SUFFIX) if (!taken.has(base + s)) return base + s;
    return villageName(rand, taken);
  }
  return { FARM, DEFAULT_PREFS, prefsOf, farmName, tileRand, compass, landmark, owner, villageName, founderName, SUFFIX };
})();
