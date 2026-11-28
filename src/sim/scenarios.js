// @sys sim/scenarios: the founders (and solo), heirs and populous scenarios and the initial simulation state
VB['sim/scenarios'] = (() => {
  const { B } = VB['world/biomes'];
  const { fromState, drawer, seeding, splitStreams } = VB['sim/rng'];
  const { YEAR, TICKS, ECON, TESTBED, SEASON_DAYS, cal } = VB['sim/rules'],
    { CROPS, ROTATIONS, openGround: farmable } = VB['sim/crops'];
  const { seal } = VB['sim/registry'];
  const { makeCamp } = VB['sim/camp'];
  const { seedByres, noByre } = VB['sim/byrehouse'];
  const { bfs, hexSteps, landComponents } = VB['sim/hex'];
  const { walkable } = VB['sim/walking'],
    { buildHours } = VB['sim/villagehours'];
  const { settlementGenerator, findSite } = VB['sim/layout'];
  const ByHand = VB['sim/byhand'];
  const { foundersHouseholds, soloHousehold, drawSize, populousHouseholds, handHouseholds } = VB['sim/people'];
  const { rebuildLiving, person, marry, nameKit, makeHousehold, joinHousehold, log, age, record, atHousehold } =
    VB['sim/records'];
  const { placeAtHome } = VB['sim/agents'];
  const { seedPlans } = VB['sim/plans'],
    { startHeads } = VB['sim/seasonal'];
  const { seedTraits } = VB['sim/traits'];
  const { seedAsking } = VB['sim/wishes'];
  // The end of seeding: a stream for each system, then the living's traits and each household's head (VB-254), and their skills
  // (VB-475), from the stream `traits`.
  // Also for a state made outside the scenarios (tests/lib/tiny.js).
  function startStreams(st, seedNum) {
    splitStreams(st, seedNum);
    VB['sim/passage'].unshut(st); // a world seeded again holds no closed field of the run before
    VB['sim/weather'].seedWeather(st, cal(st.t)); // last year's seasons and this spring's (VB-354), from the weather's own stream
    const c = cal(st.t),
      W = VB['sim/weather'];
    VB['sim/climate'].seedClimate(st, c, c.season >= 2 ? W.winterAhead(st) : W.season(st, 3, 1)[0]); // the winter in course (VB-807)
    seedTraits(st);
    startHeads(st);
    seedAsking(st); // each who seeks, or will, on its asking day (VB-823)
    VB['sim/courting'].seedCourtships(st); // nobody courts at the start (VB-036)
    VB['sim/skills'].seedSkills(st); // each pawn's skill at each type of work (VB-475), after the heads' draws
  }
  const { dailyNeed, seedNeed } = VB['sim/hunger'];
  const { startQuern } = VB['sim/quern'];
  const { refreshRoles, countDemand } = VB['sim/heirs'];
  const { initCulture } = VB['sim/society'];
  const { seedOwners } = VB['sim/ownership'];
  const { restagger } = VB['sim/courses'];
  const { yearlyRations, fieldsWanted, fieldProject, pickField } = VB['sim/fieldplans'];
  const { issue } = VB['sim/commands'],
    { stake } = VB['sim/stakes'],
    { makeProject } = VB['sim/projectplans'],
    { cottagePlan } = VB['sim/cottageplan'];
  const { foundersHerds, populousHerds, heirsHerds } = VB['sim/herds'];
  const { placeMeadows, meadowAt } = VB['sim/meadows'];
  const { initDeer } = VB['sim/deer'];
  const { initFront } = VB['sim/spread'];
  const { layWay } = VB['sim/paths'];
  const { seedOutland } = VB['sim/territory'];
  const { birthright } = VB['sim/farmclaims'];
  // Founders, or with `solo` one settler alone on a village of one farm, landed with what a founders household of the village brings.
  // hand (solo; VB-1651): the settler is planned by hand, and lands with no field or meadow under way.
  function seedFounders(w, seedNum, solo = false, site = -1, hand = false) {
    const S = fromState((seedNum * 2654435761) ^ 0x51ed),
      rand = drawer(S);
    const comp = landComponents(w),
      minLand = Math.round((1500 * w.N) / (280 * 200)); // the required land mass scales with the map
    // site: the tile the player chose for the settler's farm (solo; sim/landing reads it), in place of the search's
    const center = site >= 0 ? site : findSite(w, rand, comp, (i) => comp.size[comp.id[i]] >= minLand);
    if (center < 0) throw new Error('No village site found');
    const gen = settlementGenerator(w, rand, true),
      village = gen.addVillage(center, solo ? 1 : 3),
      lone = solo ? null : gen.addLoneFarm(center);
    const { used, farmsteads, villages } = gen.finish();
    const R = { rand, pawns: [], unions: [], ...nameKit(rand) };
    const households = solo ? soloHousehold(R, farmsteads) : foundersHouseholds(R, farmsteads);
    const st = makeState(w, S, R, households, farmsteads, villages, used, solo ? 'solo' : 'founders');
    initCulture(st, null, { kinLimit: 'close' });
    countDemand(st);
    st.makeFields = true;
    // grain for a full year of rations, and seed for the fields the household wants
    // The crops (VB-353): the village's three farms bring barley and rye in three courses, the lone farm barley and peas by turns; where
    // the map had no room for it, the third farm grows the peas. One farm of the village, the backup, carries a field's seed of peas
    // that it does not sow (farm.keeps), so one bad year at the lone farm does not lose the island its peas.
    const farms = (v) => st.farmsteads.filter((f) => f.village === v.id);
    const rotations = new Map(villages.map((v) => [v.id, v === village ? 'three' : 'peas']));
    for (const f of farms(village)) if (!lone && f === farms(village)[2]) f.firstRotation = 'peas';
    const keyOf = (f) => f.firstRotation || rotations.get(f.village);
    const backup = lone ? farms(village).at(-1) : farms(village)[1];
    if (backup) st.farmsteads[backup.id].keeps = ['peas'];
    for (const v of st.villages) v.rotation = rotations.get(v.id);
    for (const hh of st.households) {
      const f = st.farmsteads[hh.farmstead],
        R = ROTATIONS[keyOf(f)].courses;
      hh.grain = { barley: yearlyRations(st, hh) };
      for (const k of R) if (k !== 'barley' && !CROPS[k].fallow) hh.grain[k] = CROPS[k].seed; // enough to hold the rotation (rotationOf)
      if (f.keeps) hh.grain.peas = CROPS.peas.seed;
      f.firstRotation = keyOf(f);
      const n = Math.ceil(fieldsWanted(st, hh) / R.length); // fields at each course
      hh.grain.barley += n * CROPS.barley.seed;
      for (const k of R) if (k !== 'barley' && !CROPS[k].fallow) hh.grain[k] = n * CROPS[k].seed;
      if (f.keeps && !R.includes('peas')) hh.grain.peas = CROPS.peas.seed;
    }
    foundersHerds(st, solo); // solo: its one farm keeps the first household's herd, though it stands alone
    seedOutland(st, false); // newcomers claim their outland on arrival; it is theirs at the first meeting
    const n = R.pawns.length,
      who = n === 1 ? 'A settler lands and founds' : `${n} settlers land and found`;
    log(st, `${who} ${village.name}${lone ? ` and ${lone.name}` : ''}.`, { kind: 'settled', n, village: village.id });
    VB['sim/carts'].seedCarts(st, false);
    startStreams(st, seedNum);
    if (solo) landAlone(st, hand); // no cottage stands: a shelter first, then the cottage (VB-1544, VB-1666)
    return st;
  }
  // The lone settler lands (VB-1544; the solo start): no cottage stands on its farm, which is a booth farm as a settler
  // household's is (f.booth, its cottage its project plan, sim/settle's settleFarm), and its shelter is begun on the house tile by the same
  // rule (VB-1666; sim/building stakeShelter), raised by the settler's own work; it sleeps under the open sky until the shelter stands
  // (sim/building roofless), and the cottage follows on the same tile as a settler household's does. Its first field is staked at the
  // landing as a settler household's is (settleFarm), on the tile its head would pick (sim/fieldplans pickField): a household's land
  // projects wait while another of its projects is under way, and the cottage's would hold the field back to the roof. With `hand` (a
  // player who plans by hand; Kim, 24 Nov 2026: "begin with nothing under way") nothing is: no field, no booth, no cottage plan; the farm is
  // a camp (sim/camp, VB-1655) until its head places the farmstead by its plan.
  function landAlone(st, hand = false) {
    const hh = st.households[0],
      f = st.farmsteads[hh.farmstead],
      field = hand ? -1 : pickField(st, f, hh);
    f.booth = true;
    if (hand) {
      makeCamp(st, f); // VB-1655: a camp, nothing under way; the head places the farmstead by its plan
      noByre(st, f); // VB-1665: nor a byre
      return;
    }
    if (field >= 0) {
      stake(st, hh, field, 'field');
      makeProject(st, 'household', hh.id, fieldProject(st, hh, field));
    }
    makeProject(st, 'household', hh.id, cottagePlan(st, f));
    VB['sim/building'].stakeShelter(st, f);
  }
  // Populous Villages: only villages, of three size bands, until the map holds the target population (POPULATION's first number a
  // map size: 800 on a Medium or Large map) or has no site left, in which case it starts with fewer; on a Medium or Large map
  // the first two villages are a large and a medium one, which take the best sites.
  const POPULATION = { tiny: [130, 170], small: [320, 380], big: [800, 950] };
  const BANDS = [
    [0.6, 2, 5],
    [0.3, 6, 10],
    [0.1, 12, 16],
  ]; // share of villages, farms from, farms to
  const VILLAGE_SPACING = 10; // steps between village centres
  const NOT_TOWN = ' (the market town, a test bed known to decay: not evidence that a town emerges)';
  function seedPopulous(w, seedNum, testbed = false) {
    const S = fromState((seedNum * 2654435761) ^ 0x9091),
      rand = drawer(S);
    const [lo, hi] = POPULATION[w.N < 15000 ? 'tiny' : w.N < 40000 ? 'small' : 'big'],
      comp = landComponents(w);
    const gen = settlementGenerator(w, rand),
      centres = [],
      sizes = [],
      scores = new Float32Array(w.N).fill(NaN);
    let pop = 0;
    while (pop < lo) {
      let u = rand(),
        band = BANDS[BANDS.length - 1];
      for (const b of BANDS) {
        if (u < b[0]) {
          band = b;
          break;
        }
        u -= b[0];
      }
      if (lo >= POPULATION.big[0] && centres.length < 2) band = BANDS[2 - centres.length]; // a big map has a large and a medium village
      const farms = Math.min(band[1] + ((rand() * (band[2] - band[1] + 1)) | 0), Math.floor((hi - pop) / 9));
      const free = (i) =>
        comp.size[comp.id[i]] >= 60 && !gen.used.has(i) && centres.every((x) => hexSteps(w, x, i) >= VILLAGE_SPACING);
      const c = findSite(w, rand, comp, free, scores);
      if (c < 0) break;
      const laid = gen.addVillage(c, farms).farmsteads;
      if (laid.length) centres.push(c);
      for (const fid of laid) {
        sizes[fid] = drawSize(rand);
        pop += sizes[fid];
        if (sizes[fid] >= 7) gen.addField(fid); // a big household works a fourth field
      }
    }
    // The population is a target (Kim, 15 Nov): a map with too few sites is seeded with the villages it holds. Only a map that
    // holds no village at all is refused, since a run needs someone.
    if (!centres.length)
      throw new Error('Populous Villages: no village fits on this map; try a larger map or another seed');
    // the market town, a test bed known to decay and no evidence that a town emerges (VB-778): plot households packed at one village
    if (testbed) for (const f of ByHand.packPlots(w, gen, TESTBED, sizes)) sizes[f.id] = drawSize(rand);
    return standing(w, S, rand, gen, sizes, testbed ? 'market' : 'populous', seedNum);
  }
  // Placed by hand (the archipelago editor): `places`, each {village: tile, farms}, a village laid by the generator about that tile;
  // {farm: tile, fill}, a house on that very tile (sim/byhand, farmAt) with a family as in Populous Villages, or by `fill` a 'couple',
  // or no one, an 'empty' farm or a 'ruin'; {green: tile}, a green and well for a village without (greenAt); {pawn: tile, sex, age,
  // servant}, one more of the house on that tile (sim/people, handHouseholds); {field: tile} and {meadow: tile}, of the farm nearest
  // (fieldAt; sim/meadows, meadowAt); or {way: tiles, stage}, a worn way (sim/paths, layWay). Villages and farms are laid first, in their
  // order, then the greens, the fields, the people, the meadows and the ways. Where a place finds no room the error's `place` is its index.
  const EMPTY = { empty: [3, 'derelict', 'fallow'], ruin: [15, 'ruin', 'scrub'] }; // years empty, the farm's state, its fields' stage
  function seedManual(w, seedNum, places) {
    const S = fromState((seedNum * 2654435761) ^ 0x3d17),
      rand = drawer(S),
      gen = settlementGenerator(w, rand),
      sizes = [],
      fill = [];
    const list = places || [],
      no = (k) => {
        throw Object.assign(new Error('No room for what was placed there'), { place: k });
      };
    const each = (key, fn) =>
      list.forEach((p, k) => {
        if (p[key] !== undefined && !fn(p, k)) no(k);
      });
    list.forEach((p, k) => {
      // villages and farms in the one order, as each takes its room from those after it
      if (p.village === undefined && p.farm === undefined) return;
      const at = p.farm !== undefined ? p.farm : p.village,
        f = p.farm !== undefined && !w.water[at] ? ByHand.farmAt(w, gen, at) : null;
      const made =
        p.farm !== undefined
          ? f
            ? [f.id]
            : []
          : w.water[at] || gen.used.has(at)
            ? []
            : gen.addVillage(at, p.farms).farmsteads;
      if (!made.length) no(k);
      if (f && p.fill && p.fill !== 'full') {
        fill[f.id] = p.fill;
        return;
      }
      for (const fid of made) {
        sizes[fid] = drawSize(rand);
        if (sizes[fid] >= 7) gen.addField(fid);
      }
    });
    if (!gen.farmsteads.length) throw new Error('Nothing is placed to live in');
    each('green', (p) => ByHand.greenAt(w, gen, p.green));
    each('field', (p) => ByHand.fieldAt(w, gen, p.field));
    const pawns = list
      .map((p, k) =>
        p.pawn === undefined
          ? null
          : {
              k,
              sex: p.sex,
              age: p.age | 0,
              servant: p.servant,
              farm: gen.farmsteads.findIndex((f) => f.house === p.pawn),
            },
      )
      .filter(Boolean);
    const people = (R, farmsteads) => {
      const made = handHouseholds(R, farmsteads, sizes, fill, pawns);
      if (made.refused >= 0) no(pawns[made.refused].k);
      for (const f of farmsteads) {
        // a farm left with no one stands empty, as one of the old farms does (seedHeirs)
        if (f.household !== null) continue;
        const [years, state, stage] = EMPTY[fill[f.id]] || EMPTY.empty;
        f.state = state;
        f.emptySince = -years * YEAR;
        f.line = null;
        f.condition = Math.max(0.08, 1 - years * 0.075);
        for (const fd of f.fields) fd.stage = stage;
      }
      return made.households;
    };
    const st = standing(
      w,
      S,
      rand,
      gen,
      sizes,
      'manual',
      seedNum,
      (run) => each('meadow', (p) => meadowAt(run, p.meadow)),
      people,
    );
    each('way', (p) => layWay(w, p.way, p.stage || 3) > 0);
    return st;
  }
  // Villages that have stood a while, as the generator laid them: their households of the sizes drawn, a year's grain, herds and meadows.
  // byHand(st), if given: what is placed on the run before its farms take the meadows they still want. people(R, farmsteads), if given,
  // makes the households in place of a family on every farm.
  function standing(w, S, rand, gen, sizes, scenario, seedNum, byHand = null, people = null) {
    const { used, farmsteads, villages } = gen.finish();
    const R = { rand, pawns: [], unions: [], ...nameKit(rand) };
    const households = people ? people(R, farmsteads) : populousHouseholds(R, farmsteads, sizes);
    const st = makeState(w, S, R, households, farmsteads, villages, used, scenario);
    initCulture(st, null);
    countDemand(st);
    // grain for a full year of rations and seed for every field the farm has, as for the founders
    for (const hh of st.households)
      hh.grain = { barley: yearlyRations(st, hh) + st.farmsteads[hh.farmstead].fields.length * CROPS.barley.seed };
    // each village its crops, drawn from its ground (VB-353)
    if (scenario === 'populous' || scenario === 'market') {
      const key = new Map(st.villages.map((v) => [v.id, drawRotation(w, rand, v.center, v.farmsteads.length)]));
      giveCrops(st, (f) => key.get(f.village), true);
    }
    populousHerds(st);
    if (byHand) byHand(st);
    placeMeadows(st);
    seedOutland(st, true); // villages that have stood a while hold their outland
    log(st, `${R.pawns.length} people in ${villages.length} villages${scenario === 'market' ? NOT_TOWN : ''}.`, {
      kind: 'settled',
      n: R.pawns.length,
    });
    VB['sim/carts'].seedCarts(st, true);
    VB['sim/textile'].seedLooms(st); // a farm that has stood for years has its loom (VB-362)
    startStreams(st, seedNum);
    return st;
  }
  // Debug scenario: two villages, three generations on record, adult children, an empty farm and a ruin.
  function seedHeirs(w, seedNum) {
    const S = fromState((seedNum * 2654435761) ^ 0x2a11),
      rand = drawer(S);
    const comp = landComponents(w),
      minLand = Math.round((1500 * w.N) / (280 * 200)); // on a small map, the requirement scaled to it
    // On the forested island (VB-780) meadow lies in small patches, and the first site found may hold too few farms: a site that held too
    // few is set aside and the next best tried, up to `tries` times; a generator's villages write nothing to the world until finish().
    const tries = 12,
      skipA = new Set(),
      skipB = new Set();
    let a, b, gen, vA, vB, A, Bf;
    for (let k = 0; ; k++) {
      a = findSite(w, rand, comp, (i) => !skipA.has(i) && comp.size[comp.id[i]] >= 1500);
      if (a < 0) a = findSite(w, rand, comp, (i) => !skipA.has(i) && comp.size[comp.id[i]] >= minLand);
      if (a < 0) throw new Error('No village site found');
      // village B as remote as possible: another island if there is a decent one, otherwise far along the same land
      const { dist: far } = bfs(w, a, 200, walkable(w)),
        okB = (i) => !skipB.has(i) && i !== a;
      b = findSite(
        w,
        rand,
        comp,
        (i) => okB(i) && comp.id[i] !== comp.id[a] && comp.size[comp.id[i]] >= 350 && hexSteps(w, a, i) >= 30,
      );
      if (b < 0) b = findSite(w, rand, comp, (i) => okB(i) && (far.get(i) || 0) >= 45);
      if (b < 0) b = findSite(w, rand, comp, (i) => okB(i) && hexSteps(w, a, i) >= 20);
      gen = settlementGenerator(w, rand);
      vA = gen.addVillage(a, 4);
      vB = gen.addVillage(b, 3);
      A = gen.farmsteads.filter((f) => f.village === 0);
      Bf = gen.farmsteads.filter((f) => f.village === 1);
      if (A.length >= 4 && Bf.length >= 3) break;
      if (k + 1 >= tries) throw new Error('Not enough room for the debug villages');
      if (A.length < 4) skipA.add(a);
      else skipB.add(b);
    }
    const { used, farmsteads, villages } = gen.finish();
    const [A1, A2, A3, A4] = A,
      [B1, B2, B3] = Bf;
    const R = { rand, pawns: [], unions: [], ...nameKit(rand) };
    const P = (o) => person(R, o),
      dead = (sex, age, yearsAgo, o = {}) => P({ sex, age, diedYearsAgo: yearsAgo, ...o });
    // --- village B's old line at B3: three children, who went three ways ---
    const g1m = dead('m', 74, 10),
      g1f = dead('f', 70, 8);
    marry(R, g1m, g1f, 62, 10);
    const kerstin = P({ given: 'Kerstin', sex: 'f', age: 58, father: g1m, mother: g1f });
    const erik = P({ given: 'Erik', sex: 'm', age: 52, father: g1m, mother: g1f });
    const olof = P({ given: 'Olof', sex: 'm', age: 47, father: g1m, mother: g1f }); // the bachelor who held on to B3
    // --- B1: the heiress Ingrid married Erik, who moved in with her ---
    const g2m = dead('m', 66, 12),
      g2f = dead('f', 72, 5);
    marry(R, g2m, g2f, 55, 12);
    dead('m', 2, 46, { father: g2m, mother: g2f });
    const ingrid = P({ given: 'Ingrid', sex: 'f', age: 49, father: g2m, mother: g2f });
    marry(R, erik, ingrid, 29);
    const sigrid = P({ given: 'Sigrid', sex: 'f', age: 27, father: erik, mother: ingrid }),
      nils = P({ given: 'Nils', sex: 'm', age: 24, father: erik, mother: ingrid });
    const per = P({ given: 'Per', sex: 'm', age: 20, father: erik, mother: ingrid }),
      elin = P({ given: 'Elin', sex: 'f', age: 16, father: erik, mother: ingrid });
    // --- B2: a family that died out fifteen years ago ---
    const b2m = dead('m', 58, 15),
      b2f = dead('f', 55, 16);
    marry(R, b2m, b2f, 40, 16);
    dead('m', 20, 18, { father: b2m, mother: b2f });
    // --- village A: A1 old couple; Kerstin came from B3 ---
    const g3m = dead('m', 65, 20),
      g3f = dead('f', 70, 14);
    marry(R, g3m, g3f, 45, 20);
    const lars = P({ given: 'Lars', sex: 'm', age: 61, father: g3m, mother: g3f });
    marry(R, lars, kerstin, 31);
    const jon = P({ given: 'Jon', sex: 'm', age: 29, father: lars, mother: kerstin }),
      brita = P({ given: 'Brita', sex: 'f', age: 25, father: lars, mother: kerstin }),
      gunnar = P({ given: 'Gunnar', sex: 'm', age: 20, father: lars, mother: kerstin });
    // --- A2 and A4 share a line: two brothers; the elder married into A4, the younger kept A2 ---
    const g4m = dead('m', 60, 25),
      g4f = dead('f', 66, 18);
    marry(R, g4m, g4f, 64, 25);
    const anders = dead('m', 60, 4, { given: 'Anders', father: g4m, mother: g4f }),
      nils2 = dead('m', 55, 3, { given: 'Nils', father: g4m, mother: g4f });
    const marta = P({ given: 'Marta', sex: 'f', age: 54 });
    marry(R, nils2, marta, 24, 3);
    const karin = P({ given: 'Karin', sex: 'f', age: 22, father: nils2, mother: marta });
    const g5m = dead('m', 62, 30),
      g5f = dead('f', 64, 26);
    marry(R, g5m, g5f, 50, 30);
    const ragnhild = dead('f', 58, 2, { given: 'Ragnhild', father: g5m, mother: g5f });
    marry(R, anders, ragnhild, 36, 4);
    const hakan = P({ given: 'Håkan', sex: 'm', age: 33, father: anders, mother: ragnhild }),
      signe = P({ given: 'Signe', sex: 'f', age: 30 });
    marry(R, hakan, signe, 10);
    const margit = P({ given: 'Margit', sex: 'f', age: 8, father: hakan, mother: signe }),
      smaOlof = P({ given: 'Olof', sex: 'm', age: 5, father: hakan, mother: signe });
    // --- A3: died out six years ago, a couple and their baby ---
    const g6m = dead('m', 65, 30),
      g6f = dead('f', 63, 22);
    marry(R, g6m, g6f, 48, 30);
    const ivar = dead('m', 36, 6, { given: 'Ivar', father: g6m, mother: g6f }),
      gertrud = dead('f', 34, 6, { given: 'Gertrud' });
    marry(R, ivar, gertrud, 9, 6);
    dead('m', 1, 6, { father: ivar, mother: gertrud });

    const households = [];
    households.push(makeHousehold(R, 0, A1, [lars, kerstin, jon, brita, gunnar], lars));
    A1.line = lars;
    households.push(makeHousehold(R, 1, A2, [marta, karin], marta));
    A2.line = nils2; // a widow holding for life
    households.push(makeHousehold(R, 2, A4, [hakan, signe, margit, smaOlof], hakan));
    households.push(makeHousehold(R, 3, B1, [erik, ingrid, sigrid, nils, per, elin], erik));
    B1.line = ingrid;
    households.push(makeHousehold(R, 4, B3, [olof], olof));
    for (const [f, years, line, stage, state] of [
      [A3, 6, ivar, 'fallow', 'derelict'],
      [B2, 15, b2m, 'scrub', 'ruin'],
    ]) {
      f.household = null;
      f.state = state;
      f.emptySince = -years * YEAR;
      f.line = line;
      f.condition = Math.max(0.08, 1 - years * 0.075);
      for (const fd of f.fields) fd.stage = stage;
    }
    const st = makeState(w, S, R, households, farmsteads, villages, used, 'heirs');
    // village B grew up apart and leans its own way on some customs
    initCulture(st, {
      1: { heirSex: { any: 0.35 }, handover: { death: 0.3 }, claims: { anyone: 0.25 }, voice: { heads: 0.2 } },
    });
    countDemand(st);
    giveCrops(st, (f) => (f.village === 0 ? 'three' : 'peas'), false); // village A barley and rye in three courses, village B barley and peas (VB-353)
    // herds by household: [household, cows, heifers, bull and oxen, ewes (and a ram with the bull)]
    heirsHerds(st, [
      [0, 3, 0, true, 6],
      [1, 1, 0, false, 3],
      [2, 2, 1, false, 0],
      [3, 3, 0, true, 6],
      [4, 1, 0, false, 0],
    ]);
    placeMeadows(st);
    seedOutland(st, true);
    for (const f of [A3, B2]) birthright(st, f, f.line, f.emptySince); // the old families' birthright, from when the farms emptied (VB-033)
    log(st, `Debug scenario: ${vA.name} and ${vB.name}, with heirs, younger siblings and two empty farms.`, {
      kind: 'settled',
      n: R.pawns.length,
    });
    VB['sim/carts'].seedCarts(st, true);
    VB['sim/textile'].seedLooms(st); // VB-362
    startStreams(st, seedNum);
    return st;
  }
  function makeState(w, S, R, households, farmsteads, villages, used, scenario) {
    seal();
    VB['sim/water'].layWalk(w); // VB-1581: the walk to fresh water, from the land as generated
    // VB-1582: the wells the run starts with, as sources on the map (design.md, Water by the site, At the start)
    VB['sim/water'].startWells(w, villages, farmsteads, scenario !== 'founders' && scenario !== 'solo');
    const rand = drawer(S); // the scenario's one seeding stream
    for (const p of R.pawns) p.events = p.events || [];
    // @state st.t: number; game time in hours since the start of year 1 (negative before it): st.tick / TICKS (sim/clock)
    // @state st.rng: {work, fields, weather, fences, births, deaths, culture, people, society, talk, herds, settle}: one random stream per
    //   system, each {s} as plain data (sim/rng); every call site names its system's. While seeding they are all one stream, also `seed`.
    // @state st.w: the world (see w.*). st.ECON: the economy table
    // @state st.scenario: string; 'founders', 'solo' (one settler), 'heirs', 'populous', 'market' (a test bed, VB-778), or 'manual' (placed by hand)
    // (st.weather: the seasons' weather, sim/weather)
    // (pawn.events: the positions of its events in st.record, in the order they were written; sim/records, VB-199)
    // @state st.pawns[]: {id, given, sex, born, died, father, mother, patronym, household, role, servant, retired, look, events[], alive, age,
    //   pregnantUntil, pregnantBy, nursingUntil (game hours or null; sim/births), nursling (the child she nurses, or null; sim/births),
    //   hunger (0..1), hungerLog[] (last 12 daily shortfalls; sim/hunger),
    //   health (0..100, float; drained by hunger, 0 is death by starvation; sim/hunger),
    //   kinPush ({to: kinLimit option key, w} or null; the marriage limit pull of the last moving round; sim/lifecycle),
    //   visited ({village, year} or null: its last suitor's visit; sim/visits, VB-289),
    //   landWait (moving rounds waited for land in a crowded village, 0 otherwise; unset before the first round; sim/settle), ...}
    //   id = index; born and died in game hours (died null while living); father, mother, household are ids or null; culture fields att, anc,
    //   ties, tieT, homeHours (sim/ties); rel (sim/relations)
    // @state st.unions[]: {id, a, b, start, end, kind}; pawn ids a and b, game hours (end null while it lasts), kind 'marriage'
    // @state st.households[]: {id, farmstead, members[], holder, grain ({crop: rations}), meals (rations of cooked food, ready to eat; sim/hunger),
    //   unthreshed[] (rations still in sheaf, one per field's crop), guardian (pawn id or null; set while a minor heir has not come of age;
    //   sim/heirs) and ward (the minor's id),
    //   wood (loads), stone (loads), rack (rations of fish waiting by the drying rack; sim/stores) and boat (null or the household's fishing
    //   boat; sim/drying; VB-300),
    //   ledger[] ({t, kind, n, good, pawn?, stake?}; sim/stores; signed movements by good; 'harvest', 'gift', 'meat', 'milk', 'butter' (rations made;
    //   sim/byre)); kinds not in Stores.ROUTINE only (VB-204), kept three years and emptied when the household dissolves,
    //   totals[] ({year, kind, good, n, count}; sim/stores; the routine kinds summed per calendar year, kind and good, n signed; three years),
    //   hungryDays, seedSeason (the season the seed was last eaten in and told; sim/hunger), hunger (mean of members'),
    //   cold (0..1, the mean of coldLog over HUNGER.days) and coldLog[] (the last days' cold, each the wood the fire lacked over winter's use;
    //   empty when warm that long; sim/hunger, VB-327),
    //   dry (0..1, the mean of dryLog over HUNGER.days) and dryLog[] (the last days, 1 a day its water was not fetched; empty when
    //   none was dry that long; sim/hunger, VB-331), waterDay, cookDay, marshDay (the last day its water was a marsh's; sim/chores, VB-1582),
    //   dissolved,
    //   herds[] (ids into st.herds), hay (units in the barn), haySpoilt (hay lost in store since the start; sim/byre),
    //   larder[] ({kind 'meat'|'salt meat'|'smoked meat'|'milk'|'butter'|'dried fish' (rules FOODS), n (rations), until}: stored food lots;
    //   sim/hunger), fresh[] ({food 'fish'|'gathered' (rules FOODS held 'fresh'), day, qty (units)}: fresh food in batches by day; sim/pot, VB-119),
    //   fodderDay (the last day the animals were fed in the byre; sim/byre), milkDay (the last day the cows were milked; VB-135),
    //   manure (loads on the heap by the byre; VB-137), wool (fleeces shorn, summer day 1; VB-144),
    //   spoilt (rations of grain lost in store since the start; sim/hunger)}
    // @state st.farmsteads[]: {id, house, fields[], village, household, name, rowAngle, fence, line, state, condition, condAt, grade,
    //   tarredUntil, emptySince}
    //   house is a tile index (the field or meadow in the making is its household's project plan, st.plans.projects, and an empty farm's
    //   restoration its claimant's; VB-123); meadows[] {id, tile, stage 'grass'|'mown'|'aftermath',
    //   fert, raked, mown (day), held} (hay meadows; sim/meadows);
    //   fields[] {id, tile, crop (key of CROPS), stage, sown, reaped, held, fert, soil (0.75..1.4: worn by harvests, raised by manure to 1.15; a field
    //   broken on ground never farmed starts at 1.4; VB-137, VB-149), weedOpen,
    //   weedPosted (day), weedMiss (jobs missed)};
    //   state 'occupied', 'derelict' or 'ruin'; condition 0..1 at condAt (hours; an occupied house wears from it, houseCondition of
    //   sim/house); tarredUntil (hours, VB-301); grade 'ground' or 'stone' (the house raised onto a stone foundation; sim/building, VB-332);
    //   booth true or null: settlers live in a booth until their cottage has its roof (sim/settle), the cottage itself a plan of
    //   their household in st.plans.projects (sim/expansion, VB-1411)
    // @state st.villages[]: {id, name, center, farmsteads[], fence, wood[], grain, ledger[], totals[] (as a household's), green, well};
    //   center is a tile index, farmsteads are ids; wood: the tiles the village cuts its firewood on (sim/territory, VB-326);
    //   grain: the village store, {crop: rations} (sim/help); green: a boolean; well: the tile of its well, on its green, or null
    //   (VB-1584); a one-farm village has neither
    //   plots[] (sim/expansion): {id, village, intended (pawn id), hours {pawn id: hours worked}, done (cleared), holder (pawn id or null),
    //   started, cottage {i (stages done of foundation, walls, roof), done (hours on the open stage)} once cleared, built (the roof is on;
    //   farmstead is then its id; sim/cottage), wood (loads: its felled trees and the timber carried to it, less the walls'; VB-328),
    //   tiles[] {tile, kind 'house'|'field', steps[] of 'fell'|'grub'|'clear'|'break', i (steps done), fresh (a field broken on ground never
    //   farmed; VB-149)}}; a plot is cleared for those who want out
    //   crowded: adults of the village waiting for land with no room for a plot, at the last moving round (0 when not crowded; sim/settle);
    //   founded {t, from (village id), by (pawn id)} for a village founded in play by settlers, else null (sim/settle)
    // @state st.owner: Int32Array of tile owners (see sim/ownership). st.claims, st.claimSeq, st.landDirty: see sim/claims
    // @state st.cairns: Map of tile to {a (village that won it), b (village that lost it), t (game hours)}: the marks of settled borders (sim/territory)
    // @state st.makeFields: boolean; households start projects for new fields and meadows (every scenario since the balance review, 1 Nov 2026;
    //   tests may turn it off; see sim/fields, sim/meadows)
    // @state st.used: Set of tile indexes taken by houses and fields
    // @state st.jobs: Map of job key to open job; st.jobSeq: number; counter for job ids. A job: {id, key, kind, owner, site, done (work hours),
    //   claims[] (ids of the pawns working it, at most KINDS[kind].hands; VB-102), posted, live, step (the id of the plan's step that
    //   opened it, or null: sim/steps stepFor, VB-1752), and its source's fields (field, farm, plot, ...)}
    //   A goal with methods (VB-1775) adds amount (the store it was posted to reach) and op (the work leg its `done` hours are of).
    // @state st.jobsBy: Map of owner ('household:<id>' or 'village:<id>') to the Set of its open jobs (by id);
    //   kept with st.jobs by post and dropJob; derived, not saved (`sim/saves` DERIVED)
    // @state st.meetingLog[]: {year, text, close?: true where a custom came close to changing and did not (VB-082)}; newest first.
    //   (The village log is a view of st.record: sim/notable, villageLog.)
    // @state st.record[]: {t, kind, pawn, other, household, farm, village, n, text, self, tile, reason (of a `joined` event: why it
    //   moved, VB-822)}; every event, append-only (sim/records, VB-075);
    //   seeding writes the history before the start (births, deaths, marriages), in time order, and who holds each farm at the start.
    //   A routine event's slot becomes, once folded, the index of its count in st.recordYears (VB-199); slots are never removed.
    // @state st.pathCache: Map of route key ((class * w.N + from) * w.N + to; the load class only while discomfort weighs, VB-448)
    //   to path (tiles, both ends; sim/routes), oldest first, emptied each day a tile
    //   changed cost (the routes untouched kept aside in st.routeKept), at most ROUTE.cacheMax.
    // @state st.routeFallbacks: number; routes not found within ROUTE.reach, walked straight
    // @state st.routeDirty: Set of tile indexes whose walking cost changed today; a nonempty set invalidates the route cache at day’s end
    // @state st.routeKept: {routes: Map of route key to [path, choice cost, epoch], log, epoch}: set aside (sim/routes, VB-1563); derived
    // @state st.routeCosts: Map of route key to the choice cost of a st.pathCache route its search found (sim/routes); derived
    // @state st.talks: number; talks since the start (sim/relations)
    // @state st.driftMul: number; multiplier on attitude drift, set by the page. st.naturalDeaths: boolean; set by the page
    // @state st.player: null, or the frame of the pawn the player inhabits (see sim/player; its controller, sim/controller)
    // @state st.offers, st.offerSeq: the open offers and the next offer's id (see sim/offers)
    // @state st.occasions, st.occasionSeq: the occasions called and not over, and the next one's id (see sim/occasions)
    // @state st.away, st.awaySeq: the open stays away from home, journeys among them, and the next one's id (see sim/away, VB-783)
    // @state st.booths, st.boothSeq: the booths raised or being raised, and the next one's id (see sim/building, VB-784)
    // @state st.sites, st.siteSeq: the sites of new farms under way, and the next one's id (see sim/sites, VB-787)
    // @state st.demand: array of pawn ids who want to move out. recomputed by countDemand(st) (sim/heirs)
    // @state st.agents[]: {id, x, y, path, seg, journey, homeward, job, inside, anim, carry, face, stride, ox, oy, idleUntil, talk (sim/relations)};
    //   one per pawn, map units; side (sim/agents, VB-251): absent unless the pawn holds a partial or background task
    // @state st.visualDirty: boolean; set when the whole settlement layer must be redrawn. st.rigDirty: Set of pawn ids whose rigs the page remakes
    // @state st.farmDirty,villageDirty: Sets of farm and village ids whose drawings the page rebuilds alone, and clears (VB-442)
    // @state st.regrow: Set of tile indexes with some but not all trees, which grow back daily (see sim/forest)
    // @state st.pathDirty: Set of tile indexes whose worn-path stage (w.worn) changed; the page repaints them and clears it
    // @state st.treeDirty,biomeDirty: Set of tile indexes whose tree density stage changed, or that turned to meadow; the page repaints them
    // @state st.cenv: {t, cultures[], settlements[], people[], driftMul, ...}; the Culture environment (see culture.js), plain data;
    //   its lookups are hooks(st) (sim/society)
    // @state culture.namePrefs: {farm: [generator names of sim/names, preferred first]}; a culture's preference among farm names: weights, the first heaviest
    // @state culture.practices: {noDecision: 'nothing' | 'asLastYear'}; the culture's practices that are not customs (culture.js PRACTICES; VB-257)
    // @state culture.values: {generosity, piety, ambition, honour}; the means of its living adults' values (VB-519), each to a thousandth,
    //   reckoned at its yearly reckoning and at a split (culture.js, through sim/traits' addValues); an archetype's at the start
    rand(); // the yearly weather factor's draw (VB-354 left it to sim/weather), kept so that seeding draws as before
    const st = {
      t: 6,
      tick: 6 * TICKS,
      rng: seeding(S),
      w,
      ECON,
      pawns: R.pawns,
      unions: R.unions,
      households,
      farmsteads,
      villages,
      used,
      scenario,
      makeFields: true,
      jobs: new Map(),
      jobsBy: new Map(),
      idx: null, // sim/records index, built at its first use
      stepAt: null, // sim/agents, at the first step
      jobSeq: 0,
      weather: [], // drawn by startStreams (sim/weather seedWeather)
      record: [],
      recordYears: [],
      recordFold: { shortAt: 0, longAt: 0, pass: null },
      pathCache: new Map(),
      routeFallbacks: 0,
      routeDirty: new Set(),
      routeKept: null,
      routeCosts: null,
      talks: 0,
      driftMul: 1,
      naturalDeaths: true,
      player: null,
      demand: [],
      meetingLog: [],
      herds: [],
      headSeq: 0,
      agents: R.pawns.map((p) => ({
        id: p.id,
        x: 0,
        y: 0,
        path: null,
        seg: 0,
        journey: null,
        job: null,
        inside: true,
        anim: 'idle',
        carry: null,
        face: 1,
        stride: rand() * 6,
        ox: (rand() - 0.5) * 12,
        oy: (rand() - 0.5) * 8,
        idleUntil: 0,
        talk: null,
        occasion: null,
      })),
      visualDirty: false,
      rigDirty: new Set(),
      farmDirty: new Set(),
      villageDirty: new Set(),
      regrow: new Set(),
      treeDirty: new Set(),
      biomeDirty: new Set(),
      pathDirty: new Set(),
      claims: new Map(),
      claimSeq: 0,
      landDirty: new Set(),
      cairns: new Map(),
      offers: [],
      offerSeq: 0,
      occasions: [],
      occasionSeq: 0,
      away: [],
      awaySeq: 0,
      visits: [], // the suitors' visits planned (sim/visits, VB-289)
      booths: [],
      boothSeq: 0,
      sites: [], // the sites of new farms under way (sim/sites, VB-787)
      siteSeq: 0,
      facilities: [], // built things on sites (sim/facilities, VB-361)
      finds: new Map(),
      deer: null,
    };
    rebuildLiving(st);
    initDeer(st); // roe deer in every region with forest edges, at their capacity (VB-139)
    initFront(st); // the open land beside the forest, where it may spread (VB-091)
    seedPlans(st);
    for (const v of villages) {
      v.plots = [];
      v.crowded = 0;
      v.founded = null;
    }
    seedOwners(st);
    refreshRoles(st);
    buildHours(st); // VB-286: the walking hours between the villages' greens
    for (const hh of st.households) hh.meals = 2 * dailyNeed(st, hh); // two days of meals to start with
    for (const hh of st.households) startQuern(st, hh); // each with its hand quern (VB-009)
    for (const a of st.agents) if (!st.pawns[a.id].died) placeAtHome(st, a);
    // the record's history before the start: births, deaths and marriages of the people on record, in time order
    const before = [];
    for (const p of st.pawns) {
      const hh = p.household !== null && p.household !== undefined ? atHousehold(st, st.households[p.household]) : {};
      before.push([p.born, { kind: 'born', pawn: p.id, other: p.mother, ...(p.died === null ? hh : {}) }]);
      if (p.died !== null) before.push([p.died, { kind: 'died', pawn: p.id, text: 'before the record' }]);
    }
    for (const u of st.unions) before.push([u.start, { kind: 'married', pawn: u.a, other: u.b }]);
    // and who holds each farm at the start, so a farm's history names every holder it has had (VB-099)
    for (const hh of st.households)
      if (hh.holder !== null && !hh.dissolved)
        before.push([st.t, { kind: 'holds', pawn: hh.holder, ...atHousehold(st, hh) }]);
    before
      .map((e, i) => [...e, i])
      .sort((a, b) => a[0] - b[0] || a[2] - b[2])
      .forEach(([t, ev]) => record(st, ev, t));
    // a living pawn's events begin with its birth (VB-199: positions in the record)
    st.record.forEach((e, i) => {
      if (e.kind === 'born' && st.pawns[e.pawn].died === null) st.pawns[e.pawn].events.unshift(i);
    });
    seedByres(st); // VB-1665: every farm that stands at seeding has its byre
    return st;
  }

  // The scenarios' crops (VB-353; design.md, Crops and rotations, The scenarios' crops): each village is given the rotation its preset names,
  // its farms' fields staggered (sim/fields, restagger) and its households' seed for them, placed at the start, not carried. A field at the
  // rye course was sown last autumn (day 3) and stands, weeded; each other crop's seed is what its household's fields sow with it next
  // (sim/hunger, seedNeed), and a crop of the rotation no field sows keeps a field's seed. `keyFor(farm)`: its rotation, or null to leave
  // the farm as it is. `trim`: barley is a year's food and the seed its own fields sow, no more (a populous farm's fields are all barley's before).
  function giveCrops(st, keyFor, trim = false) {
    const c = cal(st.t),
      sown = c.day - c.doy - 2 * SEASON_DAYS + 2;
    for (const f of st.farmsteads) {
      const key = f.household === null ? null : keyFor(f);
      if (!key) continue;
      const hh = st.households[f.household];
      if (f.fields.length) {
        restagger(f, key);
        for (const fd of f.fields)
          if (fd.crop === 'rye') Object.assign(fd, { stage: 'growing', sown, weeds: CROPS.rye.weeds });
      } else f.firstRotation = key; // a farm yet to break its fields takes it for the first (sim/fields, rotationOf)
      const grain = { ...hh.grain };
      for (const k of ROTATIONS[key].courses) {
        if (k === 'barley' || CROPS[k].fallow) continue;
        grain[k] = f.fields.length ? seedNeed(st, hh, k) : CROPS[k].seed;
      }
      if (trim && f.fields.length) grain.barley = yearlyRations(st, hh) + seedNeed(st, hh, 'barley');
      for (const k in grain) if (!grain[k]) delete grain[k];
      hh.grain = grain;
    }
    for (const v of st.villages) {
      const keys = v.farmsteads
        .map((id) => st.farmsteads[id].fields[0]?.rotation || st.farmsteads[id].firstRotation)
        .filter(Boolean);
      if (keys.length) v.rotation = keys[0];
    }
  }
  // The rotation a village of the Populous preset is drawn from its ground (design.md, The scenarios' crops): within CROP_DRAW.reach steps of
  // its green, rye where forest is `forest` of the land or more (fresh land to break), peas where meadow is `meadow` of it, both
  // (peas, rye, barley) from `both` farms, barley alone on heath and high ground; and barley alone for `alone` of the villages whatever
  // the ground. One draw a village, on the scenario's stream (the shares are tunables, to tune).
  // Tried for `forest` on small and medium at seeds 3, 11 and 42, 92 villages: 0.5 gave rye to none, 0.35 to 3, 0.25 to 14 (the disc takes in
  // shore and heath, so forest is seldom half of it).
  const CROP_DRAW = { reach: 8, forest: 0.25, meadow: 0.3, both: 12, alone: 0.33 };
  function drawRotation(w, rand, centre, farms) {
    const u = rand(),
      { dist } = bfs(w, centre, CROP_DRAW.reach, (i) => !w.water[i]);
    let land = 0,
      forest = 0,
      meadow = 0;
    for (const i of dist.keys()) {
      land++;
      if (w.biome[i] === B.FOREST || w.biome[i] === B.PINE) forest++;
      else if (w.biome[i] === B.MEADOW) meadow++;
    }
    if (farms >= CROP_DRAW.both) return 'peasRye';
    if (u < CROP_DRAW.alone || !land) return 'every';
    if (forest / land >= CROP_DRAW.forest) return 'three';
    if (meadow / land >= CROP_DRAW.meadow) return u > 0.65 ? 'wheat' : 'peas';
    return u > 0.65 ? 'oats' : 'every';
  }
  // The test switch (VB-350; tools/sim.js and tools/balance.js --rye): every village is given rye and farms in three courses.
  const giveRye = (st) => giveCrops(st, () => 'three');
  // places: what was placed by hand, for the 'manual' scenario (seedManual). opts: {rye} (giveRye), {site} (solo: the tile chosen), {hand}
  // (solo: no field begun at the landing, VB-1651).
  function seed(w, seedNum, scenario = 'founders', places = null, opts = null) {
    if (scenario === 'manual') return seedManual(w, seedNum, places);
    const st =
      scenario === 'heirs'
        ? seedHeirs(w, seedNum)
        : scenario === 'populous' || scenario === 'market'
          ? seedPopulous(w, seedNum, scenario === 'market')
          : seedFounders(
              w,
              seedNum,
              scenario === 'solo',
              scenario === 'solo' && opts && opts.site >= 0 ? opts.site : -1,
              scenario === 'solo' && !!(opts && opts.hand),
            );
    if (opts && opts.rye) giveRye(st);
    return st;
  }
  return { seedFounders, seedHeirs, seedPopulous, makeState, startStreams, seed };
})();
