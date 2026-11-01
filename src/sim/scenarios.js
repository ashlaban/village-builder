// @sys sim/scenarios: the founders and heirs scenarios and the initial simulation state
VB['sim/scenarios'] = (() => {
  const { B, mulberry32 } = VB['gen'];
  const { YEAR, ECON, FERTILITY, farmable } = VB['sim/rules'];
  const { bfs, hexSteps, landComponents } = VB['sim/hex'];
  const { walkable } = VB['sim/routes'];
  const { settlementGenerator, findSite } = VB['sim/layout'];
  const { foundersHouseholds, drawSize, populousHouseholds } = VB['sim/people'];
  const { person, marry, nameKit, makeHousehold, joinHousehold, log, age } = VB['sim/records'];
  const { placeAtHome } = VB['sim/agents'];
  const { dailyNeed } = VB['sim/hunger'];
  const { refreshRoles, wantsOut, firstHeirs, ownFirstOf } = VB['sim/heirs'];
  const { initCulture } = VB['sim/society'];
  const { seedOwners } = VB['sim/ownership'];
  const { yearlyRations, fieldsWanted } = VB['sim/fields'];
  const { foundersHerds, populousHerds, heirsHerds } = VB['sim/herds'];
  const { placeMeadows } = VB['sim/meadows'];
  function seedFounders(w, seedNum) {
    const rand = mulberry32((seedNum * 2654435761) ^ 0x51ed);
    const comp = landComponents(w), minLand = Math.round((1500 * w.N) / (280 * 200)); // the required land mass scales with the map
    const center = findSite(w, rand, comp, (i) => comp.size[comp.id[i]] >= minLand);
    if (center < 0) throw new Error('No village site found');
    const gen = settlementGenerator(w, rand, true), village = gen.addVillage(center, 3), lone = gen.addLoneFarm(center);
    const { used, farmsteads, villages } = gen.finish();
    const R = { rand, pawns: [], unions: [], ...nameKit(rand) };
    const households = foundersHouseholds(R, farmsteads);
    const st = makeState(w, rand, R, households, farmsteads, villages, used, 'founders');
    initCulture(st, null, { kinLimit: 'close' }); st.countDemand();
    st.makeFields = true;
    // grain for a full year of rations, and seed for the fields the household wants
    for (const hh of st.households) hh.grain = yearlyRations(st, hh) + fieldsWanted(st, hh) * ECON.seedPerField;
    foundersHerds(st);
    log(st, `${R.pawns.length} settlers land and found ${village.name}${lone ? ` and ${lone.name}` : ''}.`);
    return st;
  }
  // Populous Villages: only villages, of three size bands, until the map holds the target population; on a Medium or Large map
  // the first two villages are a large and a medium one, which take the best sites.
  const POPULATION = { tiny: [130, 170], small: [320, 380], big: [800, 950] };
  const BANDS = [[0.6, 2, 5], [0.3, 6, 10], [0.1, 12, 16]]; // share of villages, farms from, farms to
  const VILLAGE_SPACING = 10; // steps between village centres
  function seedPopulous(w, seedNum) {
    const rand = mulberry32((seedNum * 2654435761) ^ 0x9091);
    const [lo, hi] = POPULATION[w.N < 15000 ? 'tiny' : w.N < 40000 ? 'small' : 'big'], comp = landComponents(w);
    const gen = settlementGenerator(w, rand), centres = [], sizes = [], scores = new Float32Array(w.N).fill(NaN);
    let pop = 0;
    while (pop < lo) {
      let u = rand(), band = BANDS[BANDS.length - 1];
      for (const b of BANDS) { if (u < b[0]) { band = b; break; } u -= b[0]; }
      if (lo >= POPULATION.big[0] && centres.length < 2) band = BANDS[2 - centres.length]; // a big map has a large and a medium village
      const farms = Math.min(band[1] + ((rand() * (band[2] - band[1] + 1)) | 0), Math.floor((hi - pop) / 9));
      const free = (i) => comp.size[comp.id[i]] >= 60 && !gen.used.has(i) && centres.every((x) => hexSteps(w, x, i) >= VILLAGE_SPACING);
      const c = findSite(w, rand, comp, free, scores);
      if (c < 0) break;
      centres.push(c);
      for (const fid of gen.addVillage(c, farms).farmsteads) {
        sizes[fid] = drawSize(rand); pop += sizes[fid];
        if (sizes[fid] >= 7) gen.addField(fid); // a big household works a fourth field
      }
    }
    if (pop < lo) throw new Error(`Populous Villages: only ${pop} of ${lo} people fit on this map; try a larger map or another seed`);
    const { used, farmsteads, villages } = gen.finish();
    const R = { rand, pawns: [], unions: [], ...nameKit(rand) };
    const households = populousHouseholds(R, farmsteads, sizes);
    const st = makeState(w, rand, R, households, farmsteads, villages, used, 'populous');
    initCulture(st, null); st.countDemand();
    // grain for a full year of rations and seed for every field the farm has, as for the founders
    for (const hh of st.households) hh.grain = yearlyRations(st, hh) + st.farmsteads[hh.farmstead].fields.length * ECON.seedPerField;
    populousHerds(st); placeMeadows(st);
    log(st, `${R.pawns.length} people in ${villages.length} villages.`);
    return st;
  }
  // Debug scenario: two villages, three generations on record, adult children, an empty farm and a ruin.
  function seedHeirs(w, seedNum) {
    const rand = mulberry32((seedNum * 2654435761) ^ 0x2a11);
    const comp = landComponents(w);
    const a = findSite(w, rand, comp, (i) => comp.size[comp.id[i]] >= 1500);
    if (a < 0) throw new Error('No village site found');
    // village B as remote as possible: another island if there is a decent one, otherwise far along the same land
    const { dist: far } = bfs(w, a, 200, walkable(w));
    let b = findSite(w, rand, comp, (i) => comp.id[i] !== comp.id[a] && comp.size[comp.id[i]] >= 350 && hexSteps(w, a, i) >= 30);
    if (b < 0) b = findSite(w, rand, comp, (i) => (far.get(i) || 0) >= 45);
    if (b < 0) b = findSite(w, rand, comp, (i) => hexSteps(w, a, i) >= 20);
    const gen = settlementGenerator(w, rand), vA = gen.addVillage(a, 4), vB = gen.addVillage(b, 3);
    const { used, farmsteads, villages } = gen.finish();
    const A = farmsteads.filter((f) => f.village === 0), Bf = farmsteads.filter((f) => f.village === 1);
    if (A.length < 4 || Bf.length < 3) throw new Error('Not enough room for the debug villages');
    const [A1, A2, A3, A4] = A, [B1, B2, B3] = Bf;
    const R = { rand, pawns: [], unions: [], ...nameKit(rand) };
    const P = (o) => person(R, o), dead = (sex, age, yearsAgo, o = {}) => P({ sex, age, diedYearsAgo: yearsAgo, ...o });
    // --- village B's old line at B3: three children, who went three ways ---
    const g1m = dead('m', 74, 10), g1f = dead('f', 70, 8); marry(R, g1m, g1f, 62, 10);
    const kerstin = P({ given: 'Kerstin', sex: 'f', age: 58, father: g1m, mother: g1f });
    const erik = P({ given: 'Erik', sex: 'm', age: 52, father: g1m, mother: g1f });
    const olof = P({ given: 'Olof', sex: 'm', age: 47, father: g1m, mother: g1f }); // the bachelor who held on to B3
    // --- B1: the heiress Ingrid married Erik, who moved in with her ---
    const g2m = dead('m', 66, 12), g2f = dead('f', 72, 5); marry(R, g2m, g2f, 55, 12);
    dead('m', 2, 46, { father: g2m, mother: g2f });
    const ingrid = P({ given: 'Ingrid', sex: 'f', age: 49, father: g2m, mother: g2f });
    marry(R, erik, ingrid, 29);
    const sigrid = P({ given: 'Sigrid', sex: 'f', age: 27, father: erik, mother: ingrid }),
      nils = P({ given: 'Nils', sex: 'm', age: 24, father: erik, mother: ingrid });
    const per = P({ given: 'Per', sex: 'm', age: 20, father: erik, mother: ingrid }),
      elin = P({ given: 'Elin', sex: 'f', age: 16, father: erik, mother: ingrid });
    // --- B2: a family that died out fifteen years ago ---
    const b2m = dead('m', 58, 15), b2f = dead('f', 55, 16); marry(R, b2m, b2f, 40, 16); dead('m', 20, 18, { father: b2m, mother: b2f });
    // --- village A: A1 old couple; Kerstin came from B3 ---
    const g3m = dead('m', 65, 20), g3f = dead('f', 70, 14); marry(R, g3m, g3f, 45, 20);
    const lars = P({ given: 'Lars', sex: 'm', age: 61, father: g3m, mother: g3f });
    marry(R, lars, kerstin, 31);
    const jon = P({ given: 'Jon', sex: 'm', age: 29, father: lars, mother: kerstin }),
      brita = P({ given: 'Brita', sex: 'f', age: 25, father: lars, mother: kerstin }),
      gunnar = P({ given: 'Gunnar', sex: 'm', age: 20, father: lars, mother: kerstin });
    // --- A2 and A4 share a line: two brothers; the elder married into A4, the younger kept A2 ---
    const g4m = dead('m', 60, 25), g4f = dead('f', 66, 18); marry(R, g4m, g4f, 64, 25);
    const anders = dead('m', 60, 4, { given: 'Anders', father: g4m, mother: g4f }), nils2 = dead('m', 55, 3, { given: 'Nils', father: g4m, mother: g4f });
    const marta = P({ given: 'Marta', sex: 'f', age: 54 }); marry(R, nils2, marta, 24, 3);
    const karin = P({ given: 'Karin', sex: 'f', age: 22, father: nils2, mother: marta });
    const g5m = dead('m', 62, 30), g5f = dead('f', 64, 26); marry(R, g5m, g5f, 50, 30);
    const ragnhild = dead('f', 58, 2, { given: 'Ragnhild', father: g5m, mother: g5f }); marry(R, anders, ragnhild, 36, 4);
    const hakan = P({ given: 'Håkan', sex: 'm', age: 33, father: anders, mother: ragnhild }),
      signe = P({ given: 'Signe', sex: 'f', age: 30 }); marry(R, hakan, signe, 10);
    const margit = P({ given: 'Margit', sex: 'f', age: 8, father: hakan, mother: signe }),
      smaOlof = P({ given: 'Olof', sex: 'm', age: 5, father: hakan, mother: signe });
    // --- A3: died out six years ago, a couple and their baby ---
    const g6m = dead('m', 65, 30), g6f = dead('f', 63, 22); marry(R, g6m, g6f, 48, 30);
    const ivar = dead('m', 36, 6, { given: 'Ivar', father: g6m, mother: g6f }), gertrud = dead('f', 34, 6, { given: 'Gertrud' }); marry(R, ivar, gertrud, 9, 6);
    dead('m', 1, 6, { father: ivar, mother: gertrud });

    const households = [];
    households.push(makeHousehold(R, 0, A1, [lars, kerstin, jon, brita, gunnar], lars)); A1.line = lars;
    households.push(makeHousehold(R, 1, A2, [marta, karin], marta)); A2.line = nils2; // a widow holding for life
    households.push(makeHousehold(R, 2, A4, [hakan, signe, margit, smaOlof], hakan));
    households.push(makeHousehold(R, 3, B1, [erik, ingrid, sigrid, nils, per, elin], erik)); B1.line = ingrid;
    households.push(makeHousehold(R, 4, B3, [olof], olof));
    for (const [f, years, line, stage, state] of [[A3, 6, ivar, 'fallow', 'derelict'], [B2, 15, b2m, 'scrub', 'ruin']]) {
      f.household = null; f.state = state; f.emptySince = -years * YEAR; f.line = line; f.condition = Math.max(0.08, 1 - years * 0.075);
      for (const fd of f.fields) fd.stage = stage;
    }
    const st = makeState(w, rand, R, households, farmsteads, villages, used, 'heirs');
    // village B grew up apart and leans its own way on some customs
    initCulture(st, { 1: { heirSex: { any: 0.35 }, handover: { death: 0.3 }, claims: { anyone: 0.25 }, voice: { heads: 0.2 } } }); st.countDemand();
    // herds by household: [household, cows, heifers, bull and oxen, ewes (and a ram with the bull)]
    heirsHerds(st, [[0, 3, 0, true, 6], [1, 1, 0, false, 3], [2, 2, 1, false, 0], [3, 3, 0, true, 6], [4, 1, 0, false, 0]]);
    placeMeadows(st);
    log(st, `Debug scenario: ${vA.name} and ${vB.name}, with heirs, younger siblings and two empty farms.`);
    return st;
  }
  function makeState(w, rand, R, households, farmsteads, villages, used, scenario) {
    for (const p of R.pawns) { p.events = p.events || []; if (p.died === null) p.events.push({ t: p.born, kind: 'born' }); }
    // @state st.t: number; game time in hours since the start of year 1 (negative before it)
    // @state st.rand: function; seeded random source, 0..1. st.w: the world (see w.*). st.ECON: the economy table
    // @state st.scenario: string; 'founders', 'heirs' or 'populous'. st.weather: number; harvest weather factor, redrawn each year, about 0.75..1.2
    // @state st.pawns[]: {id, given, sex, born, died, father, mother, patronym, household, role, servant, retired, look, events[], alive, age,
    //   pregnantUntil, pregnantBy, nursingUntil (game hours or null; sim/births), hunger (0..1), hungerLog[] (last 12 daily shortfalls; sim/hunger),
    //   buffer (days of food a holder keeps before giving, 20..60; sim/help),
    //   health (0..100, float; drained by hunger, 0 is death by starvation; sim/hunger),
    //   kinPush ({to: kinLimit option key, w} or null; the marriage limit pull of the last moving round; sim/lifecycle), ...}
    //   id = index; born and died in game hours (died null while living); father, mother, household are ids or null; culture fields att, anc,
    //   ties; rel (sim/relations)
    // @state st.unions[]: {id, a, b, start, end, kind}; pawn ids a and b, game hours (end null while it lasts), kind 'marriage'
    // @state st.households[]: {id, farmstead, members[], holder, grain (rations), rations (cooked, ready to eat; sim/hunger),
    //   unthreshed[] (rations still in sheaf, one per field's crop), guardian (pawn id or null; set while a minor heir has not come of age;
    //   sim/heirs) and ward (the minor's id),
    //   wood (loads), stone (loads),
    //   ledger[] ({t, kind, n}; kind 'harvest', 'gift' (n signed, from or to; sim/help), 'meat', 'milk' (drunk fresh), 'butter' (rations made;
    //   sim/byre)), hungryDays, hunger (mean of members'), waterDay, cookDay, dissolved,
    //   herds[] (ids into st.herds), hay (units in the barn), larder[] ({kind 'meat'|'salt meat'|'milk'|'butter', n, until}: stored food lots;
    //   sim/hunger), fodderDay (the last day the animals were fed in the byre; sim/byre), milkDay (the last day the cows were milked; VB-135),
    //   manure (loads on the heap by the byre; VB-137), spoilt (rations of grain lost in store since the start; sim/hunger)}
    // @state st.farmsteads[]: {id, house, fields[], village, household, name, rowAngle, fence, woodlot, line, state, condition, emptySince}
    //   house is a tile index; project {tile, stage 'clear'|'break'|'meadow', hours} or null (the field or meadow in the making; sim/fields,
    //   sim/meadows); meadows[] {id, tile, stage 'grass'|'mown'|'aftermath', fert, raked, mown (day), held} (hay meadows; sim/meadows);
    //   fields[] {id, tile, stage, sown, reaped, held, fert, soil (0.75..1.15: worn by harvests, raised by manure; VB-137), weedOpen,
    //   weedPosted (day), weedMiss (jobs missed)};
    //   state 'occupied', 'derelict' or 'ruin'; condition 0..1
    // @state st.villages[]: {id, name, center, farmsteads[], fence, commonsWood, grain, green, well}; center is a tile index, farmsteads are ids;
    //   grain: the village store, in rations (sim/help); green, well: booleans; a one-farm village has neither
    //   plots[] (sim/expansion): {id, village, intended (pawn id), hours {pawn id: hours worked}, done, holder (pawn id or null), started,
    //   tiles[] {tile, kind 'house'|'field', steps[] of 'fell'|'grub'|'clear'|'break', i (steps done)}}; a plot is cleared for those who want out
    // @state st.owner: Int32Array of tile owners (see sim/ownership)
    // @state st.makeFields: boolean; households start projects for new fields and meadows (every scenario since the balance review, 1 Nov 2026;
    //   tests may turn it off; see sim/fields, sim/meadows)
    // @state st.used: Set of tile indexes taken by houses and fields
    // @state st.jobs: Map of job key to open job; st.jobSeq: number; counter for job ids. A job: {id, key, kind, owner, site, done (work hours),
    //   claims[] (ids of the pawns working it, at most KINDS[kind].hands; VB-102), posted, live, and its source's fields (field, farm, plot, ...)}
    // @state st.jobsBy: Map of owner ('household:<id>' or 'village:<id>') to the Set of its open jobs (by id);
    //   kept with st.jobs by post and dropJob
    // @state st.events[]: {t, text}; newest first. st.meetingLog[]: {year, text}; newest first
    // @state st.pathCache: Map of route key (from * w.N + to) to path (tiles, both ends included; sim/routes).
    // @state st.routeFallbacks: number; routes not found within ROUTE.reach, walked straight
    // @state st.routeDirty: Set of tile indexes whose walking cost changed today; the cached routes they touch are dropped at the end of the day
    // @state st.talks: number; talks since the start (sim/relations)
    // @state st.contacts: Map of pawn pair (pairKey in sim/society: i * 2^21 + j, i < j) to hours spent together since the last drift step
    // @state st.driftMul: number; multiplier on attitude drift, set by the page. st.naturalDeaths: boolean; set by the page
    // @state st.demand: array of pawn ids who want to move out. st.countDemand: function; recomputes st.demand
    // @state st.agents[]: {id, x, y, path, seg, phase, job, inside, anim, carry, face, stride, ox, oy, work, idleUntil, talk (sim/relations)};
    //   one per pawn, map units
    // @state st.visualDirty: boolean; set when the map must be redrawn. st.rigDirty: Set; marks changed farms or people for the page to rebuild
    // @state st.regrow: Set of tile indexes with some but not all trees, which grow back daily (see sim/forest)
    // @state st.pathDirty: Set of tile indexes whose worn-path stage (w.worn) changed; the page repaints them and clears it
    // @state st.treeDirty,biomeDirty: Set of tile indexes whose tree density stage changed, or that turned to meadow; the page repaints them
    // @state st.cenv: {t, cultures[], settlements[], people[], driftMul, ...}; the Culture environment (see culture.js)
    const st = {
      t: 6, rand, w, ECON, pawns: R.pawns, unions: R.unions, households, farmsteads, villages, used, scenario,
      makeFields: true, jobs: new Map(), jobsBy: new Map(), jobSeq: 0, weather: 0.85 + rand() * 0.3, events: [],
      pathCache: new Map(), routeFallbacks: 0, routeDirty: new Set(),
      contacts: new Map(), talks: 0, driftMul: 1, naturalDeaths: true, demand: [], meetingLog: [], herds: [], headSeq: 0,
      agents: R.pawns.map((p) => ({
        id: p.id, x: 0, y: 0, path: null, seg: 0, phase: null, job: null, inside: true, anim: 'idle', carry: null, face: 1, stride: rand() * 6,
        ox: (rand() - 0.5) * 12, oy: (rand() - 0.5) * 8, work: null, idleUntil: 0, talk: null,
      })),
      visualDirty: false, rigDirty: new Set(), regrow: new Set(), treeDirty: new Set(), biomeDirty: new Set(), pathDirty: new Set(),
    };
    for (const v of villages) v.plots = [];
    seedOwners(st);
    refreshRoles(st);
    for (const hh of st.households) hh.rations = 2 * dailyNeed(st, hh); // two days of cooked food to start with
    for (const a of st.agents) if (!st.pawns[a.id].died) placeAtHome(st, a);
    st.countDemand = () => {
      const own = ownFirstOf(st), heirs = firstHeirs(st, own); st.demand = st.pawns.filter((p) => p.alive && wantsOut(st, p, heirs, own)).map((p) => p.id);
    };
    return st;
  }

  function seed(w, seedNum, scenario = 'founders') {
    return scenario === 'heirs' ? seedHeirs(w, seedNum) : scenario === 'populous' ? seedPopulous(w, seedNum) : seedFounders(w, seedNum);
  }
  return { seedFounders, seedHeirs, seedPopulous, makeState, seed };
})();
