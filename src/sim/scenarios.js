// @sys sim/scenarios: the founders and heirs scenarios and the initial simulation state
VB['sim/scenarios'] = (() => {
  const { B, mulberry32 } = VB['gen'];
  const { YEAR, ECON, FERTILITY, farmable } = VB['sim/rules'];
  const { bfs, land, hexSteps, landComponents } = VB['sim/hex'];
  const { placeFields, siteScore, makeFarmstead, findSite, buildVillage, nameFarms, finishLand } = VB['sim/layout'];
  const { person, marry, nameKit, makeHousehold, joinHousehold, log, age } = VB['sim/records'];
  const { placeAtHome } = VB['sim/agents'];
  const { refreshRoles, wantsOut } = VB['sim/heirs'];
  const { initCulture } = VB['sim/society'];
  function seedFounders(w, seedNum) {
    const rand = mulberry32((seedNum * 2654435761) ^ 0x51ed);
    const used = new Set(), comp = landComponents(w), farmsteads = [];
    const center = findSite(w, rand, comp, (i) => comp.size[comp.id[i]] >= 1500);
    if (center < 0) throw new Error('No village site found');
    const village = buildVillage(w, used, rand, center, 3, 0, farmsteads), villages = [village];
    const { dist: reach } = bfs(w, center, 40, land(w));
    let lone = null, ls = -Infinity;
    for (const [j, d] of reach) {
      if (d < 12 || !farmable(w, j) || w.biome[j] !== B.MEADOW || (j * 31) % 3) continue;
      const fields = placeFields(w, used, j, 3);
      if (!fields) continue;
      const s = siteScore(w, j) + fields.reduce((a, k) => a + FERTILITY[w.biome[k]], 0) + rand();
      if (s > ls) { ls = s; lone = { house: j, fields }; }
    }
    if (lone) farmsteads.push(makeFarmstead(w, farmsteads.length, lone.house, lone.fields, null, used));
    nameFarms(w, villages, farmsteads, rand);
    finishLand(w, villages, farmsteads, used, rand);
    const R = { rand, pawns: [], unions: [], ...nameKit(rand) };
    const households = [];
    farmsteads.forEach((f) => {
      const hAge = 23 + ((rand() * 11) | 0), wAge = Math.max(19, hAge - 1 - ((rand() * 6) | 0));
      const man = person(R, { sex: 'm', age: hAge }), wife = person(R, { sex: 'f', age: wAge });
      households.push(makeHousehold(R, households.length, f, [man, wife], man));
      marry(R, man, wife, 1 + ((rand() * 4) | 0));
    });
    const order = households.map((h) => h.id).sort(() => rand() - 0.5);
    const hand = person(R, { sex: 'm', age: 16 + ((rand() * 4) | 0), servant: true }),
      maid = person(R, { sex: 'f', age: 16 + ((rand() * 4) | 0), servant: true });
    joinHousehold(R, households[order[0]], hand); joinHousehold(R, households[order[1 % order.length]], maid);
    const st = makeState(w, rand, R, households, farmsteads, villages, used, 'founders');
    initCulture(st, null); st.countDemand();
    log(st, `${R.pawns.length} settlers land and found ${village.name}${lone ? ` and ${farmsteads[farmsteads.length - 1].name}` : ''}.`);
    return st;
  }
  // Debug scenario: two villages, three generations on record, adult children, an empty farm and a ruin.
  function seedHeirs(w, seedNum) {
    const rand = mulberry32((seedNum * 2654435761) ^ 0x2a11);
    const used = new Set(), comp = landComponents(w), farmsteads = [];
    const a = findSite(w, rand, comp, (i) => comp.size[comp.id[i]] >= 1500);
    if (a < 0) throw new Error('No village site found');
    // village B as remote as possible: another island if there is a decent one, otherwise far along the same land
    const { dist: far } = bfs(w, a, 200, land(w));
    let b = findSite(w, rand, comp, (i) => comp.id[i] !== comp.id[a] && comp.size[comp.id[i]] >= 350 && hexSteps(w, a, i) >= 30);
    if (b < 0) b = findSite(w, rand, comp, (i) => (far.get(i) || 0) >= 45);
    if (b < 0) b = findSite(w, rand, comp, (i) => hexSteps(w, a, i) >= 20);
    const vA = buildVillage(w, used, rand, a, 4, 0, farmsteads), vB = buildVillage(w, used, rand, b, 3, 1, farmsteads);
    const villages = [vA, vB];
    nameFarms(w, villages, farmsteads, rand);
    finishLand(w, villages, farmsteads, used, rand);
    const A = farmsteads.filter((f) => f.village === 0), Bf = farmsteads.filter((f) => f.village === 1);
    if (A.length < 4 || Bf.length < 3) throw new Error('Not enough room for the debug villages');
    const [A1, A2, A3, A4] = A, [B1, B2, B3] = Bf;
    const R = { rand, pawns: [], unions: [], ...nameKit(rand) };
    const P = (o) => person(R, o), dead = (sex, age, yearsAgo, o = {}) => P({ sex, age, diedYearsAgo: yearsAgo, ...o });
    // --- village B's old line at B3: three children, who went three ways ---
    const g1m = dead('m', 74, 10), g1f = dead('f', 70, 8); marry(R, g1m, g1f, 62, 10);
    const kerstin = P({ sex: 'f', age: 58, father: g1m, mother: g1f });
    const erik = P({ sex: 'm', age: 52, father: g1m, mother: g1f });
    const olof = P({ sex: 'm', age: 47, father: g1m, mother: g1f }); // the bachelor who held on to B3
    // --- B1: the heiress Ingrid married Erik, who moved in with her ---
    const g2m = dead('m', 66, 12), g2f = dead('f', 72, 5); marry(R, g2m, g2f, 55, 12);
    dead('m', 2, 46, { father: g2m, mother: g2f });
    const ingrid = P({ sex: 'f', age: 49, father: g2m, mother: g2f });
    marry(R, erik, ingrid, 29);
    const sigrid = P({ sex: 'f', age: 27, father: erik, mother: ingrid }), nils = P({ sex: 'm', age: 24, father: erik, mother: ingrid });
    const per = P({ sex: 'm', age: 20, father: erik, mother: ingrid }), elin = P({ sex: 'f', age: 16, father: erik, mother: ingrid });
    // --- B2: a family that died out fifteen years ago ---
    const b2m = dead('m', 58, 15), b2f = dead('f', 55, 16); marry(R, b2m, b2f, 40, 16); dead('m', 20, 18, { father: b2m, mother: b2f });
    // --- village A: A1 old couple; Kerstin came from B3 ---
    const g3m = dead('m', 65, 20), g3f = dead('f', 70, 14); marry(R, g3m, g3f, 45, 20);
    const lars = P({ sex: 'm', age: 61, father: g3m, mother: g3f });
    marry(R, lars, kerstin, 31);
    const jon = P({ sex: 'm', age: 29, father: lars, mother: kerstin }), brita = P({ sex: 'f', age: 25, father: lars, mother: kerstin }),
      gunnar = P({ sex: 'm', age: 20, father: lars, mother: kerstin });
    // --- A2 and A4 share a line: two brothers; the elder married into A4, the younger kept A2 ---
    const g4m = dead('m', 60, 25), g4f = dead('f', 66, 18); marry(R, g4m, g4f, 64, 25);
    const anders = dead('m', 60, 4, { father: g4m, mother: g4f }), nils2 = dead('m', 55, 3, { father: g4m, mother: g4f });
    const marta = P({ sex: 'f', age: 54 }); marry(R, nils2, marta, 24, 3);
    const karin = P({ sex: 'f', age: 22, father: nils2, mother: marta });
    const g5m = dead('m', 62, 30), g5f = dead('f', 64, 26); marry(R, g5m, g5f, 50, 30);
    const ragnhild = dead('f', 58, 2, { father: g5m, mother: g5f }); marry(R, anders, ragnhild, 36, 4);
    const hakan = P({ sex: 'm', age: 33, father: anders, mother: ragnhild }), signe = P({ sex: 'f', age: 30 }); marry(R, hakan, signe, 10);
    const margit = P({ sex: 'f', age: 8, father: hakan, mother: signe }), smaOlof = P({ sex: 'm', age: 5, father: hakan, mother: signe });
    // --- A3: died out six years ago, a couple and their baby ---
    const g6m = dead('m', 65, 30), g6f = dead('f', 63, 22); marry(R, g6m, g6f, 48, 30);
    const ivar = dead('m', 36, 6, { father: g6m, mother: g6f }), gertrud = dead('f', 34, 6); marry(R, ivar, gertrud, 9, 6);
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
    log(st, `Debug scenario: ${vA.name} and ${vB.name}, with heirs, younger siblings and two empty farms.`);
    return st;
  }
  function makeState(w, rand, R, households, farmsteads, villages, used, scenario) {
    for (const p of R.pawns) { p.events = p.events || []; if (p.died === null) p.events.push({ t: p.born, kind: 'born' }); }
    // @state st.t: number; game time in hours since the start of year 1 (negative before it)
    // @state st.rand: function; seeded random source, 0..1. st.w: the world (see w.*). st.ECON: the economy table
    // @state st.scenario: string; 'founders' or 'heirs'. st.weather: number; harvest weather factor, redrawn each year, about 0.75..1.2
    // @state st.pawns[]: {id, given, sex, born, died, father, mother, patronym, household, role, servant, retired, look, events[], alive, age, ...}
    //   id = index; born and died in game hours (died null while living); father, mother, household are ids or null; culture fields att, anc, ties
    // @state st.unions[]: {id, a, b, start, end, kind}; pawn ids a and b, game hours (end null while it lasts), kind 'marriage'
    // @state st.households[]: {id, farmstead, members[], holder, grain (rations), wood (loads), ledger[], hungryDays, waterDay, cookDay, dissolved}
    // @state st.farmsteads[]: {id, house, fields[], village, household, name, rowAngle, fence, woodlot, line, state, condition, emptySince}
    //   house is a tile index; fields[] {id, tile, stage, sown, reaped, held, fert}; state 'occupied', 'derelict' or 'ruin'; condition 0..1
    // @state st.villages[]: {id, name, center, farmsteads[], fence, commonsWood}; center is a tile index, farmsteads are ids
    // @state st.used: Set of tile indexes taken by houses and fields
    // @state st.jobs: Map of job key to open job; st.jobSeq: number; counter for job ids
    // @state st.events[]: {t, text}; newest first. st.meetingLog[]: {year, text}; newest first
    // @state st.pathCache: Map of route key to path. st.contacts: Map of 'i:j' pawn pair to hours spent together since the last drift step
    // @state st.driftMul: number; multiplier on attitude drift, set by the page. st.naturalDeaths: boolean; set by the page
    // @state st.demand: array of pawn ids who want to move out. st.countDemand: function; recomputes st.demand
    // @state st.agents[]: {id, x, y, path, seg, phase, job, inside, anim, carry, face, stride, ox, oy, work, idleUntil}; one per pawn, map units
    // @state st.visualDirty: boolean; set when the map must be redrawn. st.rigDirty: Set; marks changed farms or people for the page to rebuild
    // @state st.cenv: {t, cultures[], settlements[], people[], driftMul, ...}; the Culture environment (see culture.js)
    const st = {
      t: 6, rand, w, ECON, pawns: R.pawns, unions: R.unions, households, farmsteads, villages, used, scenario,
      jobs: new Map(), jobSeq: 0, weather: 0.85 + rand() * 0.3, events: [], pathCache: new Map(),
      contacts: new Map(), driftMul: 1, naturalDeaths: true, demand: [], meetingLog: [],
      agents: R.pawns.map((p) => ({
        id: p.id, x: 0, y: 0, path: null, seg: 0, phase: null, job: null, inside: true, anim: 'idle', carry: null, face: 1, stride: rand() * 6,
        ox: (rand() - 0.5) * 12, oy: (rand() - 0.5) * 8, work: null, idleUntil: 0,
      })),
      visualDirty: false, rigDirty: new Set(),
    };
    refreshRoles(st);
    for (const a of st.agents) if (!st.pawns[a.id].died) placeAtHome(st, a);
    st.countDemand = () => { st.demand = st.pawns.filter((p) => p.alive && wantsOut(st, p)).map((p) => p.id); };
    return st;
  }
  function seed(w, seedNum, scenario = 'founders') { return scenario === 'heirs' ? seedHeirs(w, seedNum) : seedFounders(w, seedNum); }
  return { seedFounders, seedHeirs, makeState, seed };
})();
