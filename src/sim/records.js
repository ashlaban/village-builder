// @sys sim/records: person and household records, family-record queries, culture lookups per person
VB['sim/records'] = (() => {
  const Culture = VB['culture'];
  const { DAY, YEAR_DAYS, YEAR, ECON, MALE, FEMALE, patronym } = VB['sim/rules'];
  const { hexSteps } = VB['sim/hex'];
  const log = (st, text) => { st.events.unshift({ t: st.t, text }); if (st.events.length > 40) st.events.pop(); };
  // A person on record. Patronymics come from the recorded father, or from a name known only from the patronymic.
  function person(R, o) {
    const father = o.father !== undefined && o.father !== null ? R.pawns[o.father] : null;
    const fatherName = father ? father.given : o.fatherName || R.pickFather();
    const p = {
      id: R.pawns.length, given: o.given || R.pickGiven(o.sex), sex: o.sex, born: -(o.age * YEAR + ((R.rand() * YEAR_DAYS) | 0) * DAY),
      died: o.diedYearsAgo !== undefined ? -o.diedYearsAgo * YEAR - ((R.rand() * YEAR_DAYS) | 0) * DAY : null,
      father: father ? father.id : null, mother: o.mother !== undefined ? o.mother : null, fatherName, patronym: patronym(fatherName, o.sex),
      founder: !father && (o.mother === undefined || o.mother === null), household: null, role: 'child', servant: !!o.servant, retired: false,
      look: (R.rand() * 1e9) >>> 0, events: [],
    };
    if (p.died !== null) { p.born = p.died - o.age * YEAR; }
    R.pawns.push(p);
    return p.id;
  }
  function marry(R, a, b, yearsAgo, endYearsAgo) {
    R.unions.push({ id: R.unions.length, a, b, start: -yearsAgo * YEAR, end: endYearsAgo !== undefined ? -endYearsAgo * YEAR : null, kind: 'marriage' });
  }
  function nameKit(rand) {
    const usedM = new Set(), usedF = new Set(), usedFather = new Set();
    const take = (list, s) => {
      const free = list.filter((n) => !s.has(n)); const n = (free.length ? free : list)[(rand() * (free.length || list.length)) | 0]; s.add(n); return n;
    };
    return { rand, pickGiven: (sex) => take(sex === 'm' ? MALE : FEMALE, sex === 'm' ? usedM : usedF), pickFather: () => take(MALE, usedFather) };
  }
  function makeHousehold(R, id, f, members, holder) {
    const hh = { id, farmstead: f.id, members: [...members], holder, grain: ECON.startGrain, wood: ECON.startWood,
      ledger: [], unthreshed: [], hungryDays: 0, waterDay: -1, cookDay: -1, dissolved: false };
    f.household = id; f.line = holder; f.state = 'occupied';
    for (const m of members) R.pawns[m].household = id;
    if (f.fence) for (const s of f.fence) s.owner.id = id;
    return hh;
  }
  function joinHousehold(R, hh, id) { hh.members.push(id); R.pawns[id].household = hh.id; }
  function settlementIdOf(st, p) {
    const hh = p.household !== null ? st.households[p.household] : null;
    if (!hh) return null;
    const f = st.farmsteads[hh.farmstead];
    if (f.village !== null) return f.village;
    // a lone farm takes part in the nearest village's meeting
    let best = 0, bd = Infinity; for (const v of st.villages) { const d = hexSteps(st.w, f.house, v.center); if (d < bd) { bd = d; best = v.id; } }
    return best;
  }
  const kinNear = (st, id) => {
    const p = st.pawns[id], out = new Set(); if (p.father !== null) out.add(p.father); if (p.mother !== null) out.add(p.mother);
    for (const c of childrenOf(st, id)) out.add(c); for (const s of siblingsOf(st, id)) out.add(s);
    const sp = spouseOf(st, id); if (sp !== null) out.add(sp); return [...out];
  };
  const isHolder = (st, id) => st.households.some((h) => !h.dissolved && h.holder === id);
  const holdingOf = (st, id) => st.households.find((h) => !h.dissolved && h.holder === id) || null;
  const practice = (st, settlementId) => {
    const s = st.cenv.settlements[settlementId], out = {};
    Culture.DIMS.forEach((d, k) => { out[d.key] = d.opts[s.practice[k]][0]; });
    return out;
  };
  const farmPractice = (st, f) => practice(st, f.village !== null ? f.village : settlementIdOf(st, st.pawns[st.households[f.household].holder]));
  function personEvent(st, id, kind, text) { st.pawns[id].events.push({ t: st.t, kind, text }); }
  const age = (st, p, t = st.t) => Math.floor((t - p.born) / YEAR);
  const birthYear = (p) => Math.floor(p.born / YEAR) + 1;
  const fullName = (p) => `${p.given} ${p.patronym}`;
  function spouseOf(st, id, t = st.t) {
    const u = st.unions.find((u) => (u.a === id || u.b === id) && u.start <= t && (u.end === null || u.end > t));
    return u ? (u.a === id ? u.b : u.a) : null;
  }
  const childrenOf = (st, id) => st.pawns.filter((p) => p.father === id || p.mother === id).map((p) => p.id);
  const siblingsOf = (st, id) => {
    const p = st.pawns[id]; if (p.father === null && p.mother === null) return [];
    return st.pawns.filter((q) => q.id !== id && ((p.father !== null && q.father === p.father) || (p.mother !== null && q.mother === p.mother)))
      .map((q) => q.id);
  };
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
  return {
    person, marry, nameKit, makeHousehold, joinHousehold, personEvent, log, age, birthYear, fullName, spouseOf, childrenOf, siblingsOf, kinship,
    kinNear, villageOf, settlementIdOf, isHolder, holdingOf, practice, farmPractice,
  };
})();
