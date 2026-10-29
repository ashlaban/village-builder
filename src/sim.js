// @sys sim: settlement simulation, family records, job board, yearly round
// ===== Settlement simulation: founders, family records, a job board with ownership, role-driven planning =====
const Sim = (() => {
  const G = VB['gen'], Culture = VB['culture'];
  const { B, mulberry32 } = G;
  const {
    DAY, SEASON_DAYS, YEAR_DAYS, YEAR, SEASONS, cal, WORK, ECON, FERTILITY, farmable, ROLES, KINDS, MALE, FEMALE, patronym, hazard, SPEED,
  } = VB['sim/rules'];
  const { bfs, pathTo, land, hexSteps, landComponents } = VB['sim/hex'];
  const {
    person, marry, nameKit, makeHousehold, joinHousehold, personEvent, log, age, birthYear, fullName, spouseOf, childrenOf, siblingsOf, kinship,
    kinNear, villageOf, settlementIdOf, isHolder, holdingOf, practice, farmPractice,
  } = VB['sim/records'];
  const {
    homeSpot, placeAtHome, tileAt, route, walkTo, workSpot, start, release, complete, deposit, wantsWork, idleAbout, arrived, goHome, stepWork,
    moveAgent, describe,
  } = VB['sim/agents'];
  const { post, refreshJobs, mayTake, urgency, bid, planRound } = VB['sim/jobs'];
  const { heirRanking, moveTo, transfer, extinct, succession, refreshRoles, placeIfMarried, wantsOut } = VB['sim/heirs'];
  const { placeFields, siteScore, makeFarmstead, findSite, buildVillage, nameFarms, finishLand } = VB['sim/layout'];

  // ======== scenarios ========

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
    const hand = person(R, { sex: 'm', age: 16 + ((rand() * 4) | 0), servant: true }), maid = person(R, { sex: 'f', age: 16 + ((rand() * 4) | 0), servant: true });
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
    const jon = P({ sex: 'm', age: 29, father: lars, mother: kerstin }), brita = P({ sex: 'f', age: 25, father: lars, mother: kerstin }), gunnar = P({ sex: 'm', age: 20, father: lars, mother: kerstin });
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
      agents: R.pawns.map((p) => ({ id: p.id, x: 0, y: 0, path: null, seg: 0, phase: null, job: null, inside: true, anim: 'idle', carry: null, face: 1, stride: rand() * 6, ox: (rand() - 0.5) * 12, oy: (rand() - 0.5) * 8, work: null, idleUntil: 0 })),
      visualDirty: false, rigDirty: new Set(),
    };
    refreshRoles(st);
    for (const a of st.agents) if (!st.pawns[a.id].died) placeAtHome(st, a);
    st.countDemand = () => { st.demand = st.pawns.filter((p) => p.alive && wantsOut(st, p)).map((p) => p.id); };
    return st;
  }

  // ======== culture wiring ========
  function initCulture(st, leanBySettlement) {
    const env = st.cenv = { t: st.t / YEAR, cultures: [], settlements: [], people: st.pawns, driftMul: 1 };
    env.byId = (id) => st.pawns[id];
    env.settlementOf = (p) => { const s = settlementIdOf(st, p); return s === null ? null : env.settlements[s]; };
    env.voiceOf = (p, s) => {
      if (!p.alive || p.age < 18) return 0;
      const v = Culture.DIMS[Culture.IDX.voice].opts[s.practice[Culture.IDX.voice]][0];
      if (v === 'adults') return 1;
      const holder = isHolder(st, p.id);
      if (holder) return 1;
      if (v === 'heads') { const sp = spouseOf(st, p.id); return sp !== null && isHolder(st, sp) ? 1 : 0; }
      return 0;
    };
    env.nameCulture = (s) => `${s.name.replace(/(by|sta|vik|nes|inge|berga|tuna|säter)$/, '') || s.name}folk`;
    env.onSplit = (nc, from, cause) => log(st, `${nc.name}: the people of ${env.settlements[nc.centres[0]].name} now keep their own customs, apart from ${from.name}.`);
    const customs = Culture.fromArchetype('oldNordic');
    const c = Culture.makeCulture(env, 'Nordic', customs, 0);
    for (const v of st.villages) {
      const s = { id: v.id, name: v.name, culture: c.id, kind: 'village', tie: v.id === 0 ? 1 : 0.5, practice: Int8Array.from(customs), fissionYears: 0, divergence: 0 };
      s.members = () => st.pawns.filter((p) => p.alive && settlementIdOf(st, p) === s.id);
      env.settlements.push(s);
    }
    for (const p of st.pawns) {
      p.alive = p.died === null; p.age = age(st, p);
      const s = settlementIdOf(st, p), lean = leanBySettlement && s !== null ? leanBySettlement[s] : null;
      p.att = Culture.seedAttitude(customs, st.rand, 0.6, lean); p.anc = Float32Array.from(p.att);
      p.ties = new Map(); p.prestige = 1; p.interest = null; p.advocate = null;
    }
    // starting ties: household, kin, and a few neighbours
    for (const hh of st.households) for (const i of hh.members) for (const j of hh.members) if (i !== j) st.pawns[i].ties.set(j, 1);
    for (const p of st.pawns) if (p.alive) for (const q of kinNear(st, p.id)) if (st.pawns[q].alive) { p.ties.set(q, Math.max(p.ties.get(q) || 0, 0.5)); st.pawns[q].ties.set(p.id, Math.max(st.pawns[q].ties.get(p.id) || 0, 0.5)); }
    updateTies(st); refreshPrestige(st); refreshInterests(st);
  }
  // tie of each settlement to its culture's centre: travel distance plus living kin across the gap
  function updateTies(st) {
    const env = st.cenv;
    for (const s of env.settlements) {
      const c = env.cultures[s.culture], centre = c.centres[0];
      if (s.id === centre) { s.tie = 1; continue; }
      const va = st.villages[s.id], vb = st.villages[centre];
      const { dist } = bfs(st.w, va.center, 160, land(st.w));
      const d = dist.has(vb.center) ? dist.get(vb.center) : hexSteps(st.w, va.center, vb.center) * 1.6; // a sea crossing costs more
      let kin = 0;
      for (const p of st.pawns) if (p.alive && settlementIdOf(st, p) === s.id) for (const q of kinNear(st, p.id)) { const o = st.pawns[q]; if (o.alive && settlementIdOf(st, o) === centre) kin++; }
      s.tie = Math.min(1, Math.exp(-d / 25) + Math.min(0.3, kin * 0.04));
      s.distance = d; s.kinLinks = kin;
    }
  }
  function refreshPrestige(st) {
    for (const p of st.pawns) {
      if (!p.alive) continue;
      const sp = spouseOf(st, p.id);
      p.prestige = isHolder(st, p.id) ? 1.6 : sp !== null && isHolder(st, sp) ? 1.3 : 1;
      if (p.age >= 55) p.prestige += 0.2;
    }
  }
  // Self-interest follows position: what would this option do for me, or for my children?
  function refreshInterests(st) {
    const D = Culture.DIMS, I = Culture.IDX, O = Culture.OFF;
    for (const p of st.pawns) {
      if (!p.alive || p.age < 12) { p.interest = null; continue; }
      const it = Float32Array.from(p.att);
      const set = (dim, prefs) => { const k = I[dim], o = O[k]; for (let j = 0; j < Culture.NOPT[k]; j++) it[o + j] = 0; for (const [opt, v] of Object.entries(prefs)) it[o + Culture.optIndex(dim, opt)] = v; };
      const holder = isHolder(st, p.id), sp = spouseOf(st, p.id), spHolder = sp !== null && isHolder(st, sp);
      const heirOfHome = p.household !== null && !st.households[p.household].dissolved && heirRanking(st, st.households[p.household])[0] === p.id;
      const landless = !holder && !spHolder && !heirOfHome && p.age >= 16;
      const sibs = siblingsOf(st, p.id).filter((q) => st.pawns[q].alive), sisters = sibs.filter((q) => st.pawns[q].sex === 'f').length, brothers = sibs.length - sisters;
      if (landless) { set('claims', { anyone: 0.6, villagers: 0.4 }); set('newLand', { intended: 0.5, labour: 0.5 }); set('heirCount', { buyout: 0.6, split: 0.4 }); set('voice', { adults: 1 }); }
      if (holder) { set('claims', { kin: 0.5, assembly: 0.5 }); set('newLand', { village: 1 }); set('voice', { landholders: 1 }); }
      if (holder || heirOfHome) set('heirCount', { one: 1 });
      if (heirOfHome && p.age >= 18) set('handover', { marriage: 1 });
      if (holder && p.age >= 50) set('handover', { death: 1 });
      if (p.sex === 'f') set('daughterShare', { equal: 1 }); else if (sisters) set('daughterShare', { half: 1 });
      if (p.sex === 'f' && sp !== null) set('widow', { life: 0.5, outright: 0.5 });
      if (p.sex === 'm' && heirOfHome) set('widow', { keep: 1 });
      if (p.sex === 'f' && brothers && !heirOfHome) set('heirSex', { any: 1 });
      if (p.sex === 'm' && sisters && heirOfHome) set('heirSex', { sonsFirst: 0.6, sons: 0.4 });
      if (spHolder && !holder) set('voice', { heads: 1 });
      if (sibs.length) { const older = sibs.filter((q) => st.pawns[q].born < p.born).length; if (older === 0) set('birthOrder', { eldest: 1 }); else if (older === sibs.length) set('birthOrder', { youngest: 1 }); }
      if (holder && childrenOf(st, p.id).length >= 2) set('birthOrder', { chosen: 1 });
      p.interest = it;
    }
  }

  // ======== succession ========
  function killPawn(st, id, cause = 'died') {
    const p = st.pawns[id]; if (!p.alive) return;
    p.died = st.t; p.alive = false;
    personEvent(st, id, 'died', cause === 'old age' ? 'Died' : `Died (${cause})`);
    const a = st.agents[id]; release(st, a); a.path = null; a.inside = true;
    for (const u of st.unions) if ((u.a === id || u.b === id) && u.end === null) u.end = st.t;
    for (const [j] of p.ties) { const q = st.pawns[j]; if (q && q.ties) q.ties.delete(id); }
    log(st, `${fullName(p)} of ${p.household !== null ? st.farmsteads[st.households[p.household].farmstead].name : 'the island'} has died, aged ${p.age}.`);
    const hh = p.household !== null ? st.households[p.household] : null;
    if (hh) { hh.members = hh.members.filter((m) => m !== id); if (hh.holder === id) succession(st, hh, 'death'); }
    refreshRoles(st); refreshPrestige(st); st.visualDirty = true;
  }
  function retireHolder(st, hhId) {
    const hh = st.households[hhId]; if (!hh || hh.dissolved) return false;
    const r = heirRanking(st, hh); if (!r.length) return false;
    transfer(st, hh, r[0], 'retirement'); refreshRoles(st); refreshPrestige(st); return true;
  }

  // ======== roles ========

  // ======== the yearly round: meetings after harvest, then marriages and handovers ========
  function holdMeetings(st) {
    const env = st.cenv; env.t = st.t / YEAR;
    refreshRoles(st); refreshPrestige(st); refreshInterests(st); updateTies(st);
    const starters = Culture.entrepreneurs(env, st.rand);
    for (const p of starters) personEvent(st, p.id, 'cause', `Took up the cause: ${Culture.DIMS[p.advocate.dim].label.toLowerCase()}, ${Culture.DIMS[p.advocate.dim].opts[p.advocate.opt][1].toLowerCase()}`);
    const c = cal(st.t), out = [];
    for (const s of env.settlements) {
      const ch = Culture.meeting(env, s);
      for (const x of ch) { const d = Culture.DIMS[x.dim], txt = `At the ${s.name} meeting: ${d.label.toLowerCase()} is now “${d.opts[x.to][1]}” (was “${d.opts[x.from][1]}”).`; log(st, txt); out.push({ year: c.year, text: txt }); }
    }
    for (const cu of env.cultures) {
      const r = Culture.cultureYear(env, cu);
      for (const x of r.changes) { const d = Culture.DIMS[x.dim], txt = `Across the ${cu.name} culture: ${d.label.toLowerCase()} is now “${d.opts[x.to][1]}”.`; log(st, txt); out.push({ year: c.year, text: txt }); }
    }
    st.meetingLog.unshift(...out.length ? out : [{ year: c.year, text: 'The meetings changed nothing this year.' }]);
    st.meetingLog.length = Math.min(st.meetingLog.length, 30);
    st.lastMeeting = st.t;
  }
  const kinOk = (st, a, b, cu) => {
    const phi = kinship(st, a, b), lim = { second: 1 / 64, first: 1 / 16, close: 1 / 8 }[cu.kinLimit];
    return phi < lim;
  };
  function movingRound(st) {
    const env = st.cenv; refreshRoles(st);
    const alive = st.pawns.filter((p) => p.alive);
    for (const p of alive) p.age = age(st, p);
    const single = (p) => spouseOf(st, p.id) === null && p.died === null;
    // marriages: a couple needs a place to live, as the customs define it
    const men = alive.filter((p) => p.sex === 'm' && p.age >= 20 && single(p) && !p.retired), women = alive.filter((p) => p.sex === 'f' && p.age >= 18 && single(p) && !p.retired);
    men.sort((x, y) => (placeIfMarried(st, y.id) !== null) - (placeIfMarried(st, x.id) !== null) || x.born - y.born);
    const taken = new Set();
    for (const m of men) {
      const sm = settlementIdOf(st, m), cu = practice(st, sm);
      let best = null, bs = -Infinity;
      for (const f of women) {
        if (taken.has(f.id) || !kinOk(st, m.id, f.id, cu)) continue;
        const pm = placeIfMarried(st, m.id), pf = placeIfMarried(st, f.id);
        let home = null;
        if (cu.residence === 'land') { if (pm !== null && pf !== null) continue; home = pm !== null ? pm : pf; }
        else if (cu.residence === 'husband') home = m.household; else home = f.household;
        if (home === null) continue;
        const sf = settlementIdOf(st, f), sameV = sf === sm, tie = env.settlements[sf] ? env.settlements[sf].tie : 0;
        const s = -Math.abs(m.age - f.age - 3) * 0.3 + (sameV ? 2 : 2 * Math.min(tie, env.settlements[sm].tie)) + st.rand() * 1.5;
        if (s > bs) { bs = s; best = { f, home }; }
      }
      if (!best || bs < -1.5 || st.rand() > 0.75) continue;
      taken.add(best.f.id);
      st.unions.push({ id: st.unions.length, a: m.id, b: best.f.id, start: st.t, end: null, kind: 'marriage' });
      for (const id of [m.id, best.f.id]) { if (st.pawns[id].household !== best.home) moveTo(st, id, best.home); personEvent(st, id, 'married', `Married ${fullName(st.pawns[id === m.id ? best.f.id : m.id])}`); st.rigDirty.add(id); }
      const fm = st.farmsteads[st.households[best.home].farmstead];
      log(st, `${fullName(m)} and ${fullName(best.f)} marry and live at ${fm.name}.`);
      m.ties.set(best.f.id, 2); best.f.ties.set(m.id, 2);
    }
    // handovers by custom: when the heir marries, or when the holder turns 60
    for (const hh of st.households) {
      if (hh.dissolved) continue;
      const f = st.farmsteads[hh.farmstead], cu = farmPractice(st, f), holder = st.pawns[hh.holder], r = heirRanking(st, hh, cu), heir = r[0];
      if (heir === undefined || st.pawns[heir].age < 18) continue;
      if (cu.handover === 'marriage' && spouseOf(st, heir) !== null && st.pawns[heir].household === hh.id) transfer(st, hh, heir, 'marriage');
      else if (cu.handover === 'age60' && holder.age >= 60) transfer(st, hh, heir, 'retirement');
    }
    refreshRoles(st);
    // who wants out: landless adults with no prospect of a farm
    st.demand = alive.filter((p) => wantsOut(st, p)).map((p) => p.id);
    refreshPrestige(st);
    st.visualDirty = true;
  }
  function dailyLife(st, c) {
    const env = st.cenv;
    for (const p of st.pawns) if (p.alive) p.age = age(st, p);
    // contact over the day builds ties; ties fade with a half-life of about a year; kin never fall below a floor
    const decay = Math.pow(0.5, 1 / YEAR_DAYS);
    for (const p of st.pawns) { if (!p.alive) continue; for (const [j, w0] of p.ties) p.ties.set(j, w0 * decay); }
    for (const [k, hrs] of st.contacts) { const [i, j] = k.split(':').map(Number), pi = st.pawns[i], pj = st.pawns[j]; if (!pi.alive || !pj.alive) continue; const add = hrs / 24; pi.ties.set(j, (pi.ties.get(j) || 0) + add); pj.ties.set(i, (pj.ties.get(i) || 0) + add); }
    st.contacts.clear();
    for (const p of st.pawns) if (p.alive) for (const q of kinNear(st, p.id)) if (st.pawns[q].alive && (p.ties.get(q) || 0) < 0.4) p.ties.set(q, 0.4);
    for (const p of st.pawns) if (p.alive) for (const [j, w0] of p.ties) if (w0 < 0.02) p.ties.delete(j);
    env.t = st.t / YEAR; env.driftMul = st.driftMul;
    Culture.dailyStep(env, 1 / YEAR_DAYS, st.rand);
    if (st.naturalDeaths) for (const p of st.pawns) if (p.alive && st.rand() < hazard(p.age) / YEAR_DAYS) killPawn(st, p.id, 'old age');
  }
  function noteContacts(st) {
    const live = st.agents.filter((a) => st.pawns[a.id].alive);
    const add = (i, j) => { const k = i < j ? i + ':' + j : j + ':' + i; st.contacts.set(k, (st.contacts.get(k) || 0) + 1); };
    for (const hh of st.households) { if (hh.dissolved) continue; const ins = hh.members.filter((m) => st.agents[m].inside); for (let x = 0; x < ins.length; x++) for (let y = x + 1; y < ins.length; y++) add(ins[x], ins[y]); }
    const out = live.filter((a) => !a.inside);
    for (let x = 0; x < out.length; x++) for (let y = x + 1; y < out.length; y++) { const a = out[x], b = out[y]; if (Math.abs(a.x - b.x) < 30 && Math.abs(a.y - b.y) < 30) add(a.id, b.id); }
  }
  // ---- family-record queries ----

  // ---- job board ----

  // ---- agents ----

  function onHour(st, h, c) {
    if (st.cenv) noteContacts(st);
    if (st.cenv && c.season === 2 && c.sday === 9 && h === 12) holdMeetings(st);
    if (st.cenv && c.season === 2 && c.sday === 10 && h === 12) movingRound(st);
    if (h === 6) for (const a of st.agents) if (a.inside && !a.job && st.pawns[a.id].alive) { const [x, y] = homeSpot(st, a); a.x = x; a.y = y; }
    if (h >= WORK[0] - 1 && h <= WORK[1]) refreshJobs(st, c);
    if (h === WORK[1]) for (const a of st.agents) {
      if (st.pawns[a.id].died) continue;
      if (a.phase === 'back') continue; // finish the delivery first
      release(st, a);
      if (!a.inside) { goHome(st, a); a.phase = 'home'; }
    }
    if (h === 0) { endOfDay(st, c); if (st.cenv) dailyLife(st, c); if (c.doy === 0) newYear(st, c); }
  }
  function endOfDay(st, c) {
    const E = st.ECON;
    for (const hh of st.households) {
      if (hh.dissolved) continue;
      let need = 0;
      for (const id of hh.members) { const p = st.pawns[id]; if (!p.died) need += age(st, p) >= 14 ? E.ration.adult : E.ration.child; }
      if (hh.grain >= need) hh.grain -= need; else { hh.grain = 0; hh.hungryDays++; }
      hh.wood = Math.max(0, hh.wood - E.woodUse[c.season]);
    }
    const day = Math.floor(st.t / DAY);
    for (const f of st.farmsteads) for (const fd of f.fields) {
      if (f.household === null || fd.sown === null || fd.stage === 'stooks') continue;
      const g = day - fd.sown;
      if (g >= E.ripeAfterDays) fd.stage = 'ripe';
      else if (g >= 3 && fd.stage === 'sown') fd.stage = 'growing';
    }
    if (c.season === 2 && c.sday === SEASON_DAYS - 1) for (const f of st.farmsteads) for (const fd of f.fields) if (f.household !== null && ['ripe', 'growing', 'stooks'].includes(fd.stage)) { fd.stage = 'stubble'; fd.sown = null; fd.held = 0; log(st, `A crop at ${f.name} was lost to frost.`); }
    const decay = E.fenceDecay[c.season];
    const all = [...st.villages.flatMap((v) => v.fence), ...st.farmsteads.flatMap((f) => f.fence || [])];
    // empty farms decay: buildings lose about 8% a year, untended fields go to grass and then scrub
    for (const f of st.farmsteads) if (f.household === null) {
      f.condition = Math.max(0, (f.condition ?? 1) - 0.08 / YEAR_DAYS);
      const yrs = (st.t - f.emptySince) / YEAR;
      if (f.state === 'derelict' && f.condition < 0.15) { f.state = 'ruin'; st.visualDirty = true; }
      for (const fd of f.fields) { const want = yrs > 8 ? 'scrub' : yrs > 1 ? 'fallow' : fd.stage; if (fd.stage !== want) { fd.stage = want; st.visualDirty = true; } }
    }
    for (const s of all) { const before = s.cond; s.cond = Math.max(0, s.cond - decay * (0.5 + st.rand())); if ((before >= 0.45) !== (s.cond >= 0.45)) s.dirty = true; }
  }
  function newYear(st, c) {
    st.weather = 0.75 + st.rand() * 0.45;
    const word = st.weather > 1.05 ? 'promises a good year' : st.weather < 0.88 ? 'looks poor' : 'looks ordinary';
    log(st, `Year ${c.year} begins. The weather ${word}.`);
    for (const hh of st.households) hh.ledger = hh.ledger.filter((e) => st.t - e.t < YEAR * 3);
  }

  function advance(st, hours) {
    let left = hours;
    while (left > 1e-9) {
      const step = Math.min(left, 0.1);
      const before = Math.floor(st.t + 1e-9);
      st.t += step; left -= step;
      const after = Math.floor(st.t + 1e-9);
      for (let hh = before + 1; hh <= after; hh++) onHour(st, ((hh % DAY) + DAY) % DAY, cal(hh));
      const c = cal(st.t), idle = [];
      for (const a of st.agents) {
        if (st.pawns[a.id].died) continue;
        if (a.path) moveAgent(st, a, step);
        else if (a.phase === 'work') stepWork(st, a, step);
        else if (wantsWork(st, a, c)) idle.push(a);
      }
      if (idle.length) { const got = planRound(st, idle, c); for (const a of idle) if (!got.has(a)) idleAbout(st, a); }
    }
  }

  function seed(w, seedNum, scenario = 'founders') { return scenario === 'heirs' ? seedHeirs(w, seedNum) : seedFounders(w, seedNum); }
  return { seed, advance, cal, age, birthYear, fullName, spouseOf, childrenOf, siblingsOf, kinship, describe, villageOf, SEASONS, DAY, YEAR, YEAR_DAYS, SEASON_DAYS, ECON, ROLES, KINDS, WORK,
    killPawn, retireHolder, holdMeetings, movingRound, heirRanking, practice, farmPractice, wantsOut, isHolder, holdingOf, settlementIdOf, refreshInterests, updateTies, refreshRoles, Culture };
})();
VB['sim'] = Sim;
if (typeof module !== 'undefined') module.exports = Sim;
