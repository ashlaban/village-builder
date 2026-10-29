// @sys sim: settlement simulation, family records, job board, yearly round
// ===== Settlement simulation: founders, family records, a job board with ownership, role-driven planning =====
const Sim = (() => {
  const G = VB['gen'], Culture = VB['culture'];
  const { B, mulberry32 } = G;

  // ---- calendar: 4 seasons of 12 days; one game hour is the base unit of time ----
  const DAY = 24, SEASON_DAYS = 12, YEAR_DAYS = SEASON_DAYS * 4, YEAR = YEAR_DAYS * DAY;
  const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
  const cal = (t) => {
    const day = Math.floor(t / DAY), y = Math.floor(day / YEAR_DAYS), doy = day - y * YEAR_DAYS;
    return { year: y + 1, doy, season: Math.floor(doy / SEASON_DAYS), sday: doy % SEASON_DAYS, hour: t - day * DAY, day };
  };
  const WORK = [7, 17];

  // ---- economy (rations = one adult's food for one game day) ----
  const ECON = {
    ration: { adult: 1, child: 0.5 },
    fieldYield: 80, seedPerField: 20, // a 4:1 yield ratio
    sowWindow: [0, 9], ripeAfterDays: 26, dryDays: 1,
    woodPerTrip: 3, woodTarget: 30, woodUse: [0.35, 0.3, 0.5, 1.6],
    startGrain: 180, startWood: 16,
    fenceDecay: [0.012, 0.01, 0.014, 0.03], fenceMendBelow: 0.65,
  };
  const FERTILITY = { [B.MEADOW]: 1, [B.HEATH]: 0.65, [B.HILLS]: 0.7, [B.MARSH]: 0.5 };
  const farmable = (w, i) => i >= 0 && !w.water[i] && FERTILITY[w.biome[i]] !== undefined;

  // ---- roles and jobs: who prefers what; jobs carry an owner that decides who may take them ----
  const ROLES = {
    farmer: { title: 'Farmer', sv: 'bonde', prio: { plow: 10, sow: 10, reap: 9, haul: 8, wood: 7, mend: 6, water: 2, cook: 1 } },
    wife: { title: 'Mistress of the house', sv: 'husfru', prio: { cook: 10, water: 9, reap: 7, haul: 6, sow: 5, wood: 2, mend: 2, plow: 2 } },
    farmhand: { title: 'Farmhand', sv: 'dräng', prio: { plow: 9, wood: 9, haul: 8, reap: 8, mend: 7, sow: 6, water: 3, cook: 0 } },
    maid: { title: 'Maid', sv: 'piga', prio: { water: 10, cook: 8, reap: 7, haul: 6, sow: 4, wood: 2, mend: 1, plow: 1 } },
    son: { title: 'Son of the house', sv: 'son', prio: { plow: 9, wood: 9, haul: 8, reap: 8, mend: 7, sow: 6, water: 3, cook: 0 } },
    daughter: { title: 'Daughter of the house', sv: 'dotter', prio: { water: 10, cook: 8, reap: 7, haul: 6, sow: 4, wood: 2, mend: 1, plow: 1 } },
    retired: { title: 'Retired', sv: 'undantag', prio: { cook: 4, water: 3, sow: 2, mend: 2 } },
    child: { title: 'Child', sv: 'barn', prio: {} },
  };
  const KINDS = {
    plow: { verb: 'Hoeing a field', go: 'Going to hoe a field', anim: 'hoe', hours: 4, field: true },
    sow: { verb: 'Sowing', go: 'Going to sow', anim: 'sow', hours: 2, field: true },
    reap: { verb: 'Reaping', go: 'Going to reap', anim: 'reap', hours: 5, field: true },
    haul: { verb: 'Bringing in the sheaves', go: 'Going for the sheaves', anim: 'gather', hours: 0.7, carry: 'sheaf', back: 'Carrying sheaves to the barn' },
    wood: { verb: 'Cutting firewood', go: 'Heading to the woods', anim: 'chop', hours: 3, carry: 'logs', back: 'Carrying firewood home' },
    water: { verb: 'Drawing water', go: 'Going for water', anim: 'draw', hours: 0.5, carry: 'buckets', back: 'Carrying water home' },
    cook: { verb: 'Cooking at the hearth', go: 'Going home to cook', anim: null, hours: 2, inside: true },
    mend: { verb: 'Mending the fence', go: 'Going to mend the fence', anim: 'mallet', hours: 2.5 },
  };

  // ---- names ----
  const MALE = ['Erik', 'Olof', 'Anders', 'Nils', 'Per', 'Lars', 'Jon', 'Sven', 'Håkan', 'Gunnar', 'Ivar', 'Björn', 'Arvid', 'Ragnar', 'Torsten', 'Mats', 'Hans', 'Jöns'];
  const FEMALE = ['Kerstin', 'Karin', 'Ingrid', 'Brita', 'Märta', 'Elin', 'Sigrid', 'Astrid', 'Gunhild', 'Margit', 'Ragnhild', 'Ingeborg', 'Signe', 'Tora', 'Gertrud', 'Cecilia'];
  const patronym = (father, sex) => father + (father.endsWith('s') ? '' : 's') + (sex === 'm' ? 'son' : 'dotter');
  const DIRNAME = ['Öster', 'Norr', 'Norr', 'Väster', 'Söder', 'Söder'];

  // ---- hex helpers ----
  function bfs(w, from, maxSteps, pass) {
    const dist = new Map([[from, 0]]), prev = new Map(), q = [from];
    for (let h = 0; h < q.length; h++) {
      const i = q[h], d = dist.get(i);
      if (d >= maxSteps) continue;
      for (let k = 0; k < 6; k++) {
        const j = w.nb[i * 6 + k];
        if (j < 0 || dist.has(j) || !pass(j)) continue;
        dist.set(j, d + 1); prev.set(j, i); q.push(j);
      }
    }
    return { dist, prev };
  }
  const pathTo = (prev, from, to) => { const p = [to]; while (p[0] !== from) { const q = prev.get(p[0]); if (q === undefined) return null; p.unshift(q); } return p; };
  const land = (w) => (j) => !w.water[j];
  function hexSteps(w, a, b) {
    const ax = a % w.COLS, ay = (a / w.COLS) | 0, bx = b % w.COLS, by = (b / w.COLS) | 0;
    const aq = ax - ((ay - (ay & 1)) >> 1), bq = bx - ((by - (by & 1)) >> 1), dq = aq - bq, dr = ay - by;
    return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
  }
  function landComponents(w) {
    const id = new Int32Array(w.N).fill(-1), size = [];
    for (let s = 0; s < w.N; s++) {
      if (w.water[s] || id[s] >= 0) continue;
      const c = size.length, q = [s]; id[s] = c;
      for (let h = 0; h < q.length; h++) for (let k = 0; k < 6; k++) { const j = w.nb[q[h] * 6 + k]; if (j >= 0 && !w.water[j] && id[j] < 0) { id[j] = c; q.push(j); } }
      size.push(q.length);
    }
    return { id, size };
  }

  // ---- placing the founders ----
  function placeFields(w, used, house, n, avoid) {
    const cand = [];
    for (let k = 0; k < 6; k++) { const j = w.nb[house * 6 + k]; if (farmable(w, j) && !used.has(j) && !(avoid && avoid.has(j))) cand.push(j); }
    if (cand.length < n) {
      const { dist } = bfs(w, house, 2, (j) => farmable(w, j));
      for (const [j, d] of dist) if (d === 2 && !used.has(j) && !(avoid && avoid.has(j))) cand.push(j);
    }
    cand.sort((a, b) => FERTILITY[w.biome[b]] - FERTILITY[w.biome[a]]);
    return cand.length >= n ? cand.slice(0, n) : null;
  }
  function siteScore(w, c) {
    if (!farmable(w, c) || w.biome[c] !== B.MEADOW) return -1;
    const { dist } = bfs(w, c, 3, land(w));
    let farm = 0;
    for (const [j] of dist) if (farmable(w, j)) farm += FERTILITY[w.biome[j]];
    const { dist: d6 } = bfs(w, c, 6, land(w));
    let wood = 0, shore = 0;
    for (const [j] of d6) { const b = w.biome[j]; if (b === B.FOREST || b === B.PINE) wood++; }
    for (let k = 0; k < 6; k++) { const j = w.nb[c * 6 + k]; if (j >= 0 && w.water[j]) shore++; }
    return farm + Math.min(wood, 12) * 0.6 + (shore > 0 ? 4 : 0) - w.hp[c] * 6;
  }
  function villageName(rand) {
    const A = ['Hal', 'Skog', 'Ul', 'Bred', 'Lin', 'Sand', 'Hög', 'Ek', 'Vall', 'Rön', 'Al'], C = ['by', 'sta', 'vik', 'nes', 'inge', 'berga', 'tuna', 'säter'];
    return A[(rand() * A.length) | 0] + C[(rand() * C.length) | 0];
  }

  // Fence (gärdesgård) around an infield: hex edges between enclosed land and open land, split into stretches.
  function makeFence(w, infield, centre, owner, stretches, rand) {
    const NA = [0, -60, -120, 180, 120, 60], edges = [];
    for (const i of infield) for (let d = 0; d < 6; d++) {
      const j = w.nb[i * 6 + d];
      if (j < 0 || infield.has(j) || w.water[j]) continue;
      const a0 = ((NA[d] - 30) * Math.PI) / 180, a1 = ((NA[d] + 30) * Math.PI) / 180, R = w.R;
      const x1 = w.hx[i] + Math.cos(a0) * R, y1 = w.hy[i] + Math.sin(a0) * R, x2 = w.hx[i] + Math.cos(a1) * R, y2 = w.hy[i] + Math.sin(a1) * R;
      edges.push({ x1, y1, x2, y2, tile: i, ang: Math.atan2((y1 + y2) / 2 - w.hy[centre], (x1 + x2) / 2 - w.hx[centre]) });
    }
    edges.sort((a, b) => a.ang - b.ang);
    const out = [];
    const per = Math.max(1, Math.ceil(edges.length / stretches));
    for (let k = 0; k < edges.length; k += per) {
      const es = edges.slice(k, k + per), m = es[(es.length / 2) | 0];
      out.push({ id: out.length, edges: es, cond: 0.75 + rand() * 0.25, owner, tile: m.tile, mx: (m.x1 + m.x2) / 2, my: (m.y1 + m.y2) / 2 });
    }
    return out;
  }

  function makeFarmstead(w, id, house, fields, village, used) {
    used.add(house); for (const j of fields) used.add(j);
    const a = (((w.hrnd[house] * 6) | 0) * Math.PI) / 3;
    return { id, house, fields: fields.map((t, k) => ({ id: k, tile: t, stage: 'stubble', sown: null, reaped: null, held: 0, fert: FERTILITY[w.biome[t]] })), village: village ? village.id : null, household: null, name: '', rowAngle: a, fence: null };
  }
  const log = (st, text) => { st.events.unshift({ t: st.t, text }); if (st.events.length > 40) st.events.pop(); };

  // ======== scenarios ========
  function findSite(w, rand, comp, filter) {
    let best = -1, bs = -Infinity;
    for (let i = 0; i < w.N; i++) {
      if (w.biome[i] !== B.MEADOW || (i * 7919) % 5 || !filter(i)) continue;
      const s = siteScore(w, i) + rand() * 2;
      if (s > bs) { bs = s; best = i; }
    }
    return best;
  }
  function buildVillage(w, used, rand, center, nFarms, id, farmsteads) {
    const village = { id, name: villageName(rand), center, farmsteads: [], fence: [], commonsWood: -1 };
    used.add(center);
    const ring = [], { dist } = bfs(w, center, 2, land(w));
    for (const [j, d] of dist) if (d >= 1 && farmable(w, j)) ring.push(j);
    const greenAvoid = new Set([center]);
    for (let n = 0; n < nFarms; n++) {
      let pick = null, ps = -1;
      for (const h of ring) {
        if (used.has(h) || farmsteads.some((f) => hexSteps(w, f.house, h) < 2)) continue;
        const fields = placeFields(w, used, h, 3, greenAvoid);
        if (!fields) continue;
        const s = fields.reduce((a, j) => a + FERTILITY[w.biome[j]], 0) - hexSteps(w, h, center) * 0.3;
        if (s > ps) { ps = s; pick = { house: h, fields }; }
      }
      if (!pick) break;
      const f = makeFarmstead(w, farmsteads.length, pick.house, pick.fields, village, used);
      farmsteads.push(f); village.farmsteads.push(f.id);
    }
    return village;
  }
  function nameFarms(w, villages, farmsteads, rand) {
    for (const f of farmsteads) {
      if (f.village !== null) {
        const v = villages[f.village], dx = w.hx[f.house] - w.hx[v.center], dy = w.hy[f.house] - w.hy[v.center];
        const a = (Math.atan2(-dy, dx) + Math.PI * 2) % (Math.PI * 2), k = Math.round(a / (Math.PI / 3)) % 6;
        let nm = DIRNAME[k] + 'gården';
        if (farmsteads.some((g) => g !== f && g.village === f.village && g.name === nm)) nm = farmsteads.some((g) => g.village === f.village && g.name === 'Mellangården') ? 'Nygården' : 'Mellangården';
        f.name = nm;
      } else {
        let coast = false, woods = 0, hills = 0, marsh = 0;
        const { dist: near } = bfs(w, f.house, 2, () => true);
        for (const [j] of near) { if (w.water[j]) coast = true; const b = w.biome[j]; if (b === B.FOREST || b === B.PINE) woods++; if (b === B.HILLS) hills++; if (b === B.MARSH) marsh++; }
        const plain = ['Ängen', 'Hagen', 'Berga', 'Åkern'];
        f.name = coast ? 'Strand' : woods >= 4 ? 'Lunden' : hills >= 3 ? 'Backa' : marsh >= 2 ? 'Myra' : plain[(rand() * plain.length) | 0];
      }
    }
  }
  function finishLand(w, villages, farmsteads, used, rand) {
    const nearestWood = (from) => {
      const { dist: dd } = bfs(w, from, 16, land(w));
      let wl = -1, wd = Infinity;
      for (const [j, d] of dd) if ((w.biome[j] === B.FOREST || w.biome[j] === B.PINE) && !used.has(j) && d < wd) { wd = d; wl = j; }
      return wl;
    };
    for (const v of villages) {
      v.commonsWood = nearestWood(v.center);
      const vin = new Set([v.center]); for (const f of farmsteads) if (f.village === v.id) { vin.add(f.house); for (const fd of f.fields) vin.add(fd.tile); }
      v.fence = makeFence(w, vin, v.center, { type: 'village', id: v.id }, 8, rand);
    }
    for (const f of farmsteads) {
      f.woodlot = f.village !== null ? villages[f.village].commonsWood : nearestWood(f.house);
      if (f.village === null) { const inf = new Set([f.house, ...f.fields.map((fd) => fd.tile)]); f.fence = makeFence(w, inf, f.house, { type: 'household', id: null }, 4, rand); }
    }
    w.dev = new Uint8Array(w.N);
    for (const j of used) w.dev[j] = 1;
  }
  // A person on record. Patronymics come from the recorded father, or from a name known only from the patronymic.
  function person(R, o) {
    const father = o.father !== undefined && o.father !== null ? R.pawns[o.father] : null;
    const fatherName = father ? father.given : o.fatherName || R.pickFather();
    const p = {
      id: R.pawns.length, given: o.given || R.pickGiven(o.sex), sex: o.sex, born: -(o.age * YEAR + ((R.rand() * YEAR_DAYS) | 0) * DAY), died: o.diedYearsAgo !== undefined ? -o.diedYearsAgo * YEAR - ((R.rand() * YEAR_DAYS) | 0) * DAY : null,
      father: father ? father.id : null, mother: o.mother !== undefined ? o.mother : null, fatherName, patronym: patronym(fatherName, o.sex),
      founder: !father && (o.mother === undefined || o.mother === null), household: null, role: 'child', servant: !!o.servant, retired: false, look: (R.rand() * 1e9) >>> 0, events: [],
    };
    if (p.died !== null) { p.born = p.died - o.age * YEAR; }
    R.pawns.push(p);
    return p.id;
  }
  function marry(R, a, b, yearsAgo, endYearsAgo) { R.unions.push({ id: R.unions.length, a, b, start: -yearsAgo * YEAR, end: endYearsAgo !== undefined ? -endYearsAgo * YEAR : null, kind: 'marriage' }); }
  function nameKit(rand) {
    const usedM = new Set(), usedF = new Set(), usedFather = new Set();
    const take = (list, s) => { const free = list.filter((n) => !s.has(n)); const n = (free.length ? free : list)[(rand() * (free.length || list.length)) | 0]; s.add(n); return n; };
    return { rand, pickGiven: (sex) => take(sex === 'm' ? MALE : FEMALE, sex === 'm' ? usedM : usedF), pickFather: () => take(MALE, usedFather) };
  }

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
  function makeHousehold(R, id, f, members, holder) {
    const hh = { id, farmstead: f.id, members: [...members], holder, grain: ECON.startGrain, wood: ECON.startWood, ledger: [], hungryDays: 0, waterDay: -1, cookDay: -1, dissolved: false };
    f.household = id; f.line = holder; f.state = 'occupied';
    for (const m of members) R.pawns[m].household = id;
    if (f.fence) for (const s of f.fence) s.owner.id = id;
    return hh;
  }
  function joinHousehold(R, hh, id) { hh.members.push(id); R.pawns[id].household = hh.id; }

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
  function settlementIdOf(st, p) {
    const hh = p.household !== null ? st.households[p.household] : null;
    if (!hh) return null;
    const f = st.farmsteads[hh.farmstead];
    if (f.village !== null) return f.village;
    // a lone farm takes part in the nearest village's meeting
    let best = 0, bd = Infinity; for (const v of st.villages) { const d = hexSteps(st.w, f.house, v.center); if (d < bd) { bd = d; best = v.id; } }
    return best;
  }
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
  const kinNear = (st, id) => { const p = st.pawns[id], out = new Set(); if (p.father !== null) out.add(p.father); if (p.mother !== null) out.add(p.mother); for (const c of childrenOf(st, id)) out.add(c); for (const s of siblingsOf(st, id)) out.add(s); const sp = spouseOf(st, id); if (sp !== null) out.add(sp); return [...out]; };
  const isHolder = (st, id) => st.households.some((h) => !h.dissolved && h.holder === id);
  const holdingOf = (st, id) => st.households.find((h) => !h.dissolved && h.holder === id) || null;
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
  const practice = (st, settlementId) => {
    const s = st.cenv.settlements[settlementId], out = {};
    Culture.DIMS.forEach((d, k) => { out[d.key] = d.opts[s.practice[k]][0]; });
    return out;
  };
  const farmPractice = (st, f) => practice(st, f.village !== null ? f.village : settlementIdOf(st, st.pawns[st.households[f.household].holder]));

  // ======== succession ========
  // Who would inherit this farm now, in order, under the practice of its village.
  function heirRanking(st, hh, cust = null, nested = false) {
    const f = st.farmsteads[hh.farmstead], cu = cust || practice(st, f.village !== null ? f.village : 0);
    const line = f.line !== undefined && f.line !== null ? f.line : hh.holder;
    const sexRank = (p) => cu.heirSex === 'sonsFirst' ? (p.sex === 'm' ? 0 : 1) : cu.heirSex === 'daughtersFirst' ? (p.sex === 'f' ? 0 : 1) : 0;
    const order = (ids) => [...ids].sort((a, b) => {
      const pa = st.pawns[a], pb = st.pawns[b], s = sexRank(pa) - sexRank(pb);
      if (s) return s;
      if (cu.birthOrder === 'youngest') return pb.born - pa.born;
      if (cu.birthOrder === 'chosen') { const ha = pa.household === hh.id ? 0 : 1, hb = pb.household === hh.id ? 0 : 1; if (ha !== hb) return ha - hb; }
      return pa.born - pb.born;
    });
    const out = [], seen = new Set();
    const lineOf = (id, depth) => {
      if (depth > 3) return;
      for (const c of order(childrenOf(st, id))) {
        if (seen.has(c)) continue; seen.add(c);
        if (st.pawns[c].died === null) out.push(c);
        lineOf(c, depth + 1); // a dead child's children stand in their place; a living child's line follows them
      }
    };
    lineOf(line, 0);
    const direct = new Set(out);
    // then the wider family: siblings and their lines, then the parents' siblings (cousins) and theirs
    seen.add(line);
    let anc = line;
    for (let up = 0; up < 2; up++) {
      const lp = st.pawns[anc];
      if (lp.father === null && lp.mother === null) break;
      const parent = lp.father !== null ? lp.father : lp.mother;
      for (const s of order(childrenOf(st, parent).filter((q) => q !== anc))) { if (seen.has(s)) continue; seen.add(s); if (st.pawns[s].died === null) out.push(s); lineOf(s, 1); }
      anc = parent; seen.add(parent);
    }
    const ok = out.filter((id) => {
      const p = st.pawns[id];
      if (cu.heirSex === 'sons' && p.sex === 'f') return false;
      const own = holdingOf(st, id); if (own && own !== hh) return false; // already holds a farm
      const sp = spouseOf(st, id); if (sp !== null) { const so = holdingOf(st, sp); if (so && so !== hh) return false; } // lives on a spouse's farm
      return id !== hh.holder;
    });
    if (nested) return ok.filter((id) => direct.has(id));
    // a relative who is first in line for their own parents' farm steps behind the others here: farms are not
    // combined while someone else in the family can take this one. Direct heirs of this farm keep their place.
    const ownFirst = new Set();
    for (const o of st.households) if (!o.dissolved && o !== hh) { const r = heirRanking(st, o, null, true); if (r.length) ownFirst.add(r[0]); }
    const back = (id) => !direct.has(id) && ownFirst.has(id);
    return [...ok.filter((id) => !back(id)), ...ok.filter(back)];
  }
  function personEvent(st, id, kind, text) { st.pawns[id].events.push({ t: st.t, kind, text }); }
  function moveTo(st, id, hhId) {
    const p = st.pawns[id], old = p.household !== null ? st.households[p.household] : null;
    if (old) old.members = old.members.filter((m) => m !== id);
    const hh = st.households[hhId]; if (!hh.members.includes(id)) hh.members.push(id);
    p.household = hhId; p.servant = false;
    const a = st.agents[id]; release(st, a); placeAtHome(st, a);
    if (old && old.farmstead !== hh.farmstead) personEvent(st, id, 'moved', `Moved to ${st.farmsteads[hh.farmstead].name}`);
  }
  function transfer(st, hh, heir, reason) {
    const f = st.farmsteads[hh.farmstead], cu = farmPractice(st, f), old = hh.holder, op = st.pawns[old];
    const hp = st.pawns[heir];
    if (hp.household !== hh.id) {
      const from = hp.household !== null ? st.households[hp.household] : null, sp = spouseOf(st, heir);
      const kids = childrenOf(st, heir).filter((c) => st.pawns[c].alive && st.pawns[c].age < 18 && st.pawns[c].household === hp.household);
      moveTo(st, heir, hh.id);
      if (sp !== null && st.pawns[sp].alive && from && st.pawns[sp].household === from.id) moveTo(st, sp, hh.id);
      for (const c of kids) moveTo(st, c, hh.id);
    }
    hh.holder = heir; f.line = heir;
    if (op && op.alive && op.household === hh.id) { op.retired = true; const s = spouseOf(st, old); if (s !== null && st.pawns[s].alive) st.pawns[s].retired = true; }
    // shares for the siblings who do not inherit
    if (cu.heirCount !== 'one') {
      const sibs = siblingsOf(st, heir).filter((q) => st.pawns[q].alive);
      const wt = (q) => (cu.daughterShare === 'half' && st.pawns[q].sex === 'f' ? 1 : 2);
      const value = f.fields.length * 120 + hh.grain * 0.5, total = [...sibs, heir].reduce((s, q) => s + wt(q), 0);
      for (const q of sibs) {
        const reserve = 60 + hh.members.length * 30; // shares never eat the seed corn or the winter's food
        const due = Math.round((value * wt(q)) / total), paid = Math.min(due, Math.max(0, Math.floor(hh.grain - reserve)));
        hh.grain -= paid; st.pawns[q].stake = (st.pawns[q].stake || 0) + paid; st.pawns[q].owed = (st.pawns[q].owed || 0) + (due - paid);
        if (due) personEvent(st, q, 'share', `Received ${paid} rations as a share of ${f.name}${due > paid ? `, ${due - paid} still owed` : ''}${cu.heirCount === 'split' ? ' (splitting land comes in a later batch)' : ''}`);
      }
    }
    personEvent(st, heir, 'inherited', `Took over ${f.name} (${reason})`);
    log(st, `${fullName(hp)} takes over ${f.name}${reason === 'death' ? ` after ${fullName(op)}` : reason === 'marriage' ? ' on marrying' : ' as the old holder retires'}.`);
    st.visualDirty = true;
  }
  function extinct(st, hh) {
    const f = st.farmsteads[hh.farmstead];
    f.household = null; f.state = 'derelict'; f.emptySince = st.t; f.condition = 1;
    for (const fd of f.fields) { if (fd.stage !== 'stubble') fd.held = 0; fd.stage = 'stubble'; fd.sown = null; }
    hh.dissolved = true;
    for (const j of [...st.jobs.values()]) if (j.farm === f) st.jobs.delete(j.key);
    // anyone left moves in with their nearest kin, or into service elsewhere in the village
    for (const id of [...hh.members]) {
      const p = st.pawns[id]; if (!p.alive) continue;
      const kinHome = kinNear(st, id).map((q) => st.pawns[q]).find((q) => q.alive && q.household !== null && !st.households[q.household].dissolved && q.household !== hh.id);
      const target = kinHome ? kinHome.household : st.households.filter((h) => !h.dissolved && h.id !== hh.id).sort((x, y) => x.members.length - y.members.length)[0];
      if (target !== undefined) { moveTo(st, id, typeof target === 'number' ? target : target.id); if (!kinHome) st.pawns[id].servant = true; }
    }
    hh.members = [];
    log(st, `${f.name} stands empty: no heir would take it.`);
    st.visualDirty = true;
  }
  function succession(st, hh, reason) {
    const f = st.farmsteads[hh.farmstead], cu = farmPractice(st, f), dead = st.pawns[hh.holder];
    const sp = spouseOf(st, dead.id, dead.died - 0.01);
    const spouse = sp !== null && st.pawns[sp].alive && st.pawns[sp].household === hh.id ? sp : null;
    const ranking = heirRanking(st, hh, cu), heir = ranking.length ? ranking[0] : null;
    if (spouse !== null && (cu.widow === 'life' || cu.widow === 'outright' || heir === null || st.pawns[heir].age < 18)) {
      hh.holder = spouse; if (cu.widow === 'outright') f.line = spouse;
      personEvent(st, spouse, 'inherited', `Holds ${f.name} ${cu.widow === 'outright' ? 'outright' : cu.widow === 'life' ? 'for life' : `as guardian for ${fullName(st.pawns[heir])}`}`);
      log(st, `${fullName(st.pawns[spouse])} keeps ${f.name}${cu.widow === 'life' ? ' for life' : cu.widow === 'outright' ? ' as her own' : ' until the heir comes of age'}.`);
      st.visualDirty = true;
      return;
    }
    if (heir === null) { extinct(st, hh); return; }
    if (st.pawns[heir].age < 18) {
      // a minor heir holds in name; the nearest adult kin in the house acts as guardian
      const g = hh.members.map((q) => st.pawns[q]).filter((q) => q.alive && q.age >= 18).sort((x, y) => x.born - y.born)[0];
      hh.guardian = g ? g.id : null;
    }
    transfer(st, hh, heir, 'death');
  }
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
  function refreshRoles(st) {
    for (const p of st.pawns) {
      if (p.died !== null) continue;
      const hh = p.household !== null ? st.households[p.household] : null, a = age(st, p);
      if (!hh) { p.role = a < 14 ? 'child' : 'farmhand'; continue; }
      const sp = spouseOf(st, p.id);
      if (hh.holder === p.id) p.role = 'farmer';
      else if (sp !== null && sp === hh.holder) p.role = p.sex === 'f' ? 'wife' : 'farmer';
      else if (p.retired) p.role = 'retired';
      else if (a < 14) p.role = 'child';
      else if (p.servant) p.role = p.sex === 'm' ? 'farmhand' : 'maid';
      else p.role = p.sex === 'm' ? 'son' : 'daughter';
    }
  }

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
  function placeIfMarried(st, id) {
    const p = st.pawns[id], hh = p.household !== null ? st.households[p.household] : null;
    if (!hh || hh.dissolved) return null;
    if (hh.holder === id) return hh.id;
    return heirRanking(st, hh)[0] === id ? hh.id : null;
  }
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
  function wantsOut(st, p) {
    if (!p.alive || p.age < 18 || p.retired) return false;
    if (isHolder(st, p.id)) return false;
    const sp = spouseOf(st, p.id); if (sp !== null && isHolder(st, sp)) return false;
    if (placeIfMarried(st, p.id) !== null) return false;
    for (const hh of st.households) if (!hh.dissolved && heirRanking(st, hh)[0] === p.id) return false; // heir somewhere else
    return true;
  }
  const hazard = (a) => 0.006 + 0.0007 * Math.exp(0.07 * a) + (a < 10 ? 0.01 : 0); // per year, roughly pre-industrial adults
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
  const age = (st, p, t = st.t) => Math.floor((t - p.born) / YEAR);
  const birthYear = (p) => Math.floor(p.born / YEAR) + 1;
  const fullName = (p) => `${p.given} ${p.patronym}`;
  function spouseOf(st, id, t = st.t) {
    const u = st.unions.find((u) => (u.a === id || u.b === id) && u.start <= t && (u.end === null || u.end > t));
    return u ? (u.a === id ? u.b : u.a) : null;
  }
  const childrenOf = (st, id) => st.pawns.filter((p) => p.father === id || p.mother === id).map((p) => p.id);
  const siblingsOf = (st, id) => { const p = st.pawns[id]; if (p.father === null && p.mother === null) return []; return st.pawns.filter((q) => q.id !== id && ((p.father !== null && q.father === p.father) || (p.mother !== null && q.mother === p.mother))).map((q) => q.id); };
  // Malécot's kinship coefficient: probability that genes drawn at random from a and b are identical by descent.
  function kinship(st, a, b, memo = new Map()) {
    if (a === null || b === null) return 0;
    const k = a < b ? a + ':' + b : b + ':' + a;
    if (memo.has(k)) return memo.get(k);
    let v;
    const pa = st.pawns[a], pb = st.pawns[b];
    if (a === b) v = 0.5 * (1 + kinship(st, pa.father, pa.mother, memo));
    else {
      const young = pa.born > pb.born ? pa : pb, other = young === pa ? b : a;
      v = young.father === null && young.mother === null ? 0 : 0.5 * (kinship(st, young.father, other, memo) + kinship(st, young.mother, other, memo));
    }
    memo.set(k, v);
    return v;
  }
  const villageOf = (st, p) => st.farmsteads[st.households[p.household].farmstead].village;

  // ---- job board ----
  // Sources (fields, households, village fences) post jobs; each job names an owner. A pawn may take a job
  // owned by its own household, or by its village if it lives there. Servants count as household members.
  function post(st, key, kind, owner, site, extra) {
    let j = st.jobs.get(key);
    if (!j) { j = { id: ++st.jobSeq, key, kind, owner, site, done: 0, claim: null, posted: st.t, ...extra }; st.jobs.set(key, j); }
    j.live = true;
    return j;
  }
  function refreshJobs(st, c) {
    const E = st.ECON;
    for (const j of st.jobs.values()) j.live = false;
    const inWork = c.hour >= WORK[0] - 1 && c.hour < WORK[1];
    for (const f of st.farmsteads) {
      if (f.household === null) continue;
      const hh = st.households[f.household], own = { type: 'household', id: hh.id };
      for (const fd of f.fields) {
        const fk = `f${f.id}.${fd.id}`;
        const sowing = c.season === 0 && c.sday >= E.sowWindow[0] && c.sday <= E.sowWindow[1];
        if (sowing && fd.stage === 'stubble') post(st, 'plow:' + fk, 'plow', own, fd.tile, { field: fd, farm: f });
        if (sowing && fd.stage === 'plowed' && hh.grain >= E.seedPerField + 10) post(st, 'sow:' + fk, 'sow', own, fd.tile, { field: fd, farm: f });
        if (fd.stage === 'ripe') post(st, 'reap:' + fk, 'reap', own, fd.tile, { field: fd, farm: f });
        if (fd.stage === 'stooks' && c.day >= fd.reaped + E.dryDays) post(st, 'haul:' + fk, 'haul', own, fd.tile, { field: fd, farm: f });
      }
      if (f.woodlot >= 0 && hh.wood < E.woodTarget) {
        post(st, `wood:h${hh.id}`, 'wood', own, f.woodlot, { farm: f });
        if (hh.wood < E.woodTarget * 0.4) post(st, `wood:h${hh.id}b`, 'wood', own, f.woodlot, { farm: f });
      }
      if (inWork && hh.waterDay !== c.day) post(st, `water:h${hh.id}:${c.day}`, 'water', own, f.village !== null ? st.villages[f.village].center : f.house, { farm: f });
      if (c.hour >= 14 && c.hour < WORK[1] && hh.cookDay !== c.day) post(st, `cook:h${hh.id}:${c.day}`, 'cook', own, f.house, { farm: f });
      if (f.fence) for (const s of f.fence) if (s.cond < E.fenceMendBelow) post(st, `mend:f${f.id}.${s.id}`, 'mend', own, s.tile, { stretch: s, farm: f });
    }
    for (const v of st.villages) for (const s of v.fence) if (s.cond < E.fenceMendBelow) post(st, `mend:v${v.id}.${s.id}`, 'mend', { type: 'village', id: v.id }, s.tile, { stretch: s });
    for (const [k, j] of st.jobs) if (!j.live && j.claim === null) st.jobs.delete(k);
  }
  function mayTake(st, p, j) {
    if (j.owner.type === 'household') return j.owner.id === p.household;
    if (j.owner.type === 'village') return villageOf(st, p) === j.owner.id;
    return true;
  }
  function urgency(st, j, c) {
    const E = st.ECON, hh = j.farm ? st.households[j.farm.household] : null;
    switch (j.kind) {
      case 'plow': case 'sow': return 1 + c.sday / 8;
      case 'reap': return 1.3 + (c.season === 2 ? c.sday / 5 : 0);
      case 'haul': return 1.1;
      case 'wood': return hh.wood < 8 ? 2.2 : (E.woodTarget - hh.wood) / E.woodTarget + (c.season === 2 ? 0.5 : 0);
      case 'water': return c.hour < 10 ? 1.4 : 1;
      case 'cook': return c.hour >= 15 ? 2.2 : 0.6;
      case 'mend': return (1 - j.stretch.cond) * 2;
    }
    return 1;
  }
  // Matching, not first-come: every idle pawn bids for every open job it may take, and the best fits are
  // assigned first. A poor fit (role priority 2 or less) only bids once the job has waited two hours.
  function bid(st, a, j, c) {
    const p = st.pawns[a.id];
    if (j.claim !== null || !mayTake(st, p, j)) return -1;
    const pr = ROLES[p.role].prio[j.kind] || 0;
    if (pr <= 0 || (pr <= 2 && st.t - j.posted < 2)) return -1;
    const here = st.farmsteads[st.households[p.household].farmstead].house;
    return pr * urgency(st, j, c) - hexSteps(st.w, here, j.site) * 0.15 + st.rand() * 0.3;
  }
  function planRound(st, idle, c) {
    const bids = [];
    for (const a of idle) for (const j of st.jobs.values()) { const s = bid(st, a, j, c); if (s > 0) bids.push([s, a, j]); }
    bids.sort((x, y) => y[0] - x[0]);
    const busy = new Set();
    for (const [, a, j] of bids) { if (busy.has(a) || j.claim !== null) continue; start(st, a, j); busy.add(a); }
    return busy;
  }

  // ---- agents ----
  function homeSpot(st, a) {
    const f = st.farmsteads[st.households[st.pawns[a.id].household].farmstead];
    return [st.w.hx[f.house] - 12 + a.ox * 0.3, st.w.hy[f.house] + 14 + a.oy * 0.15]; // by the cottage door
  }
  function placeAtHome(st, a) { const [x, y] = homeSpot(st, a); a.x = x; a.y = y; a.inside = true; a.path = null; a.phase = null; a.job = null; a.anim = 'idle'; a.carry = null; }
  function tileAt(st, x, y) {
    const w = st.w, R = w.R, HW = w.HW, AP = w.AP;
    const px = x - AP, py = y - R, qf = ((Math.sqrt(3) / 3) * px - py / 3) / R, rf = ((2 / 3) * py) / R, sf = -qf - rf;
    let q = Math.round(qf), r = Math.round(rf), s = Math.round(sf);
    const dq = Math.abs(q - qf), dr = Math.abs(r - rf), ds = Math.abs(s - sf);
    if (dq > dr && dq > ds) q = -r - s; else if (dr > ds) r = -q - s;
    const col = q + ((r - (r & 1)) >> 1);
    return r >= 0 && r < w.ROWS && col >= 0 && col < w.COLS ? r * w.COLS + col : -1;
  }
  function route(st, from, to) {
    const k = from * 100000 + to;
    if (st.pathCache.has(k)) return st.pathCache.get(k);
    const { prev } = bfs(st.w, from, 60, land(st.w));
    const p = pathTo(prev, from, to) || [to];
    st.pathCache.set(k, p);
    return p;
  }
  function walkTo(st, a, tile, x, y) {
    const from = tileAt(st, a.x, a.y), tiles = from >= 0 && from !== tile ? route(st, from, tile).slice(1, -1) : [];
    a.path = [[a.x, a.y], ...tiles.map((i) => [st.w.hx[i] + a.ox * 0.4, st.w.hy[i] + a.oy * 0.4]), [x, y]];
    a.seg = 0; a.inside = false; a.anim = 'walk';
  }
  // Where on the site a pawn stands to do the job.
  function workSpot(st, a, j) {
    const w = st.w;
    if (KINDS[j.kind].field) { const th = j.farm.rowAngle; return [w.hx[j.site] - Math.cos(th) * 13 + Math.sin(th) * -12, w.hy[j.site] - Math.sin(th) * 13 - Math.cos(th) * -12]; }
    if (j.kind === 'haul') return [w.hx[j.site] + a.ox * 0.6, w.hy[j.site] + a.oy * 0.6];
    if (j.kind === 'water') return j.farm.village !== null ? [w.hx[j.site] - 10 + a.ox * 0.2, w.hy[j.site] + 8] : [w.hx[j.site] - 1, w.hy[j.site] + 4];
    if (j.kind === 'mend') return [j.stretch.mx + (w.hx[j.site] - j.stretch.mx) * 0.25, j.stretch.my + (w.hy[j.site] - j.stretch.my) * 0.25 + 3];
    if (j.kind === 'wood') return [w.hx[j.site] - 8 + a.ox * 0.4, w.hy[j.site] + 6];
    return [w.hx[j.site], w.hy[j.site]];
  }
  function start(st, a, j) {
    j.claim = a.id; a.job = j;
    const K = KINDS[j.kind];
    if (K.inside) { const [x, y] = homeSpot(st, a); a.phase = 'go'; walkTo(st, a, j.farm.house, x, y); return; }
    const [x, y] = workSpot(st, a, j);
    a.phase = 'go'; walkTo(st, a, j.site, x, y);
  }
  function release(st, a) { if (a.job) { a.job.claim = null; a.job = null; } a.phase = null; a.work = null; }
  function complete(st, a) {
    const j = a.job, E = st.ECON, hh = st.households[st.pawns[a.id].household], c = cal(st.t);
    switch (j.kind) {
      case 'plow': j.field.stage = 'plowed'; break;
      case 'sow': if (hh.grain >= E.seedPerField) { hh.grain -= E.seedPerField; j.field.stage = 'sown'; j.field.sown = c.day; } break;
      case 'reap': j.field.stage = 'stooks'; j.field.reaped = c.day; j.field.held = Math.round(E.fieldYield * j.field.fert * st.weather * (0.9 + st.rand() * 0.2)); break;
      case 'mend': j.stretch.cond = 1; j.stretch.dirty = true; break;
      case 'cook': hh.cookDay = c.day; break;
    }
    st.jobs.delete(j.key);
  }
  function deposit(st, a) {
    const j = a.job, hh = st.households[st.pawns[a.id].household], f = st.farmsteads[hh.farmstead];
    if (j.kind === 'haul') { hh.grain += j.field.held; hh.ledger.push({ t: st.t, kind: 'harvest', n: j.field.held }); if (f.fields.every((q) => q.stage !== 'ripe' && q.stage !== 'stooks' || q === j.field)) log(st, `${f.name} has brought in its harvest.`); j.field.held = 0; j.field.stage = 'stubble'; j.field.sown = null; }
    if (j.kind === 'wood') hh.wood += st.ECON.woodPerTrip;
    if (j.kind === 'water') hh.waterDay = cal(st.t).day;
    st.jobs.delete(j.key);
    a.carry = null; a.job = null; a.phase = null;
  }
  const wantsWork = (st, a, c) => !a.path && a.phase === null && c.hour >= WORK[0] && c.hour < WORK[1] && a.idleUntil <= st.t;
  function idleAbout(st, a) {
    // nothing suitable: drift to the green or the yard, and look again in a while
    const p = st.pawns[a.id], f = st.farmsteads[st.households[p.household].farmstead];
    const v = f.village !== null ? st.villages[f.village] : null, spot = v && st.rand() < 0.5 ? v.center : f.house;
    walkTo(st, a, spot, st.w.hx[spot] + (st.rand() - 0.5) * 26, st.w.hy[spot] + 6 + (st.rand() - 0.5) * 12);
    a.idleUntil = st.t + 0.75 + st.rand() * 1.25;
  }
  function arrived(st, a) {
    a.anim = 'idle';
    if (a.phase === 'go') {
      const K = KINDS[a.job.kind];
      a.phase = 'work'; a.anim = K.anim || 'idle'; a.inside = !!K.inside;
      if (K.field) { const th = a.job.farm.rowAngle; a.work = { s: -13, dir: 1, row: -12, th, cx: st.w.hx[a.job.site], cy: st.w.hy[a.job.site] }; }
    } else if (a.phase === 'back') deposit(st, a);
    else if (a.phase === 'home') { a.inside = true; a.phase = null; }
  }
  function goHome(st, a) {
    const f = st.farmsteads[st.households[st.pawns[a.id].household].farmstead], [x, y] = homeSpot(st, a);
    walkTo(st, a, f.house, x, y);
  }
  function stepWork(st, a, dt) {
    const j = a.job, K = KINDS[j.kind];
    j.done += dt;
    if (a.work) {
      // walk the field row by row while working
      const wk = a.work, speed = j.kind === 'sow' ? 9 : 3.2;
      wk.s += wk.dir * speed * dt;
      if (wk.s > 13 || wk.s < -13) { wk.s = Math.max(-13, Math.min(13, wk.s)); wk.dir = -wk.dir; wk.row += 6; if (wk.row > 12) wk.row = -12; }
      const nx = wk.cx + Math.cos(wk.th) * wk.s - Math.sin(wk.th) * wk.row, ny = wk.cy + Math.sin(wk.th) * wk.s + Math.cos(wk.th) * wk.row;
      if (Math.abs(nx - a.x) > 0.01) a.face = nx > a.x ? 1 : -1;
      a.stride += Math.hypot(nx - a.x, ny - a.y) / 3.4;
      a.x = nx; a.y = ny;
    }
    if (j.done >= K.hours) {
      if (K.carry) {
        a.carry = K.carry; a.phase = 'back'; a.work = null;
        const f = st.farmsteads[st.households[st.pawns[a.id].household].farmstead];
        // sheaves go to the barn door, firewood to the woodpile, water into the cottage
        const hx = st.w.hx[f.house], hy = st.w.hy[f.house];
        const [x, y] = j.kind === 'water' ? homeSpot(st, a) : j.kind === 'logs' || K.carry === 'logs' ? [hx + 7, hy + 16] : [hx - 3, hy - 9];
        walkTo(st, a, f.house, x, y);
      } else {
        complete(st, a);
        a.job = null; a.work = null;
        a.phase = null; a.inside = false;
        if (K.inside) { a.inside = false; a.anim = 'idle'; }
      }
    }
  }

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

  const SPEED = 3; // tiles per game hour on foot
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
  function moveAgent(st, a, dt) {
    let dist = SPEED * st.w.HW * dt * (a.carry ? 0.8 : 1);
    while (dist > 0 && a.seg < a.path.length - 1) {
      const [tx, ty] = a.path[a.seg + 1], dx = tx - a.x, dy = ty - a.y, d = Math.hypot(dx, dy);
      if (Math.abs(dx) > 0.3) a.face = dx > 0 ? 1 : -1;
      const m = Math.min(d, dist);
      a.stride += m / 3.4;
      if (d <= dist) { a.x = tx; a.y = ty; a.seg++; } else { a.x += (dx / d) * dist; a.y += (dy / d) * dist; }
      dist -= m;
    }
    if (a.seg >= a.path.length - 1) { a.path = null; arrived(st, a); }
  }
  function describe(st, id) {
    const a = st.agents[id];
    if (a.job) {
      const K = KINDS[a.job.kind];
      if (a.phase === 'go') return K.go;
      if (a.phase === 'back') return K.back;
      return K.verb;
    }
    if (a.phase === 'home') return 'Walking home';
    if (a.inside) return 'At home';
    return a.path ? 'Strolling' : 'Resting';
  }

  function seed(w, seedNum, scenario = 'founders') { return scenario === 'heirs' ? seedHeirs(w, seedNum) : seedFounders(w, seedNum); }
  return { seed, advance, cal, age, birthYear, fullName, spouseOf, childrenOf, siblingsOf, kinship, describe, villageOf, SEASONS, DAY, YEAR, YEAR_DAYS, SEASON_DAYS, ECON, ROLES, KINDS, WORK,
    killPawn, retireHolder, holdMeetings, movingRound, heirRanking, practice, farmPractice, wantsOut, isHolder, holdingOf, settlementIdOf, refreshInterests, updateTies, refreshRoles, Culture };
})();
VB['sim'] = Sim;
if (typeof module !== 'undefined') module.exports = Sim;
