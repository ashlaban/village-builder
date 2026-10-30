// @sys sim/records: person and household records, family-record queries, culture lookups per person
VB['sim/records'] = (() => {
  const Culture = VB['culture'];
  const { DAY, YEAR_DAYS, YEAR, ECON, MALE, FEMALE, patronym } = VB['sim/rules'];
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
      look: (R.rand() * 1e9) >>> 0, events: [], pregnantUntil: null, pregnantBy: null, nursingUntil: null,
      hunger: 0, hungerLog: [], health: 100,
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
    const hh = { id, farmstead: f.id, members: [...members], holder, grain: ECON.startGrain, rations: 0, wood: ECON.startWood, stone: 0,
      ledger: [], unthreshed: [], hungryDays: 0, hunger: 0, waterDay: -1, cookDay: -1, dissolved: false };
    f.household = id; f.line = holder; f.state = 'occupied';
    for (const m of members) R.pawns[m].household = id;
    if (f.fence) for (const s of f.fence) s.owner.id = id;
    return hh;
  }
  function joinHousehold(R, hh, id) { hh.members.push(id); R.pawns[id].household = hh.id; }
  function settlementIdOf(st, p) {
    const hh = p.household !== null ? st.households[p.household] : null;
    if (!hh) return null;
    return st.farmsteads[hh.farmstead].village;
  }
  const kinNear = (st, id) => {
    const p = st.pawns[id], out = new Set(); if (p.father !== null) out.add(p.father); if (p.mother !== null) out.add(p.mother);
    for (const c of childrenOf(st, id)) out.add(c); for (const s of siblingsOf(st, id)) out.add(s);
    const sp = spouseOf(st, id); if (sp !== null) out.add(sp); return [...out];
  };
  // Indexes over the records, built on first use and caught up with new pawns, unions and households on each read (records are only
  // appended); the places that end a union or change a holder call noteUnionEnd and noteHolder. Not enumerable: they are derived data.
  // @state st.idx: {children: Map of pawn id to child ids, spouse: Map of pawn id to current spouse id, holds: Map of pawn id to the ids of
  //   households it holds, seen: counts of pawns, unions and households already indexed}; derived from the records, see sim/records
  function index(st) {
    if (!st.idx) Object.defineProperty(st, 'idx', { value: { children: new Map(), spouse: new Map(), holds: new Map(), np: 0, nu: 0, nh: 0 }, writable: true });
    const x = st.idx;
    for (; x.np < st.pawns.length; x.np++) {
      const p = st.pawns[x.np];
      for (const parent of p.father === p.mother ? [p.father] : [p.father, p.mother]) {
        if (parent === null) continue;
        const l = x.children.get(parent); if (l) l.push(p.id); else x.children.set(parent, [p.id]);
      }
    }
    for (; x.nu < st.unions.length; x.nu++) {
      const u = st.unions[x.nu];
      if (u.end === null && u.start <= st.t) { if (!x.spouse.has(u.a)) x.spouse.set(u.a, u.b); if (!x.spouse.has(u.b)) x.spouse.set(u.b, u.a); }
    }
    while (x.nh < st.households.length) addHolder(x, st.households[x.nh++]);
    return x;
  }
  function noteHolder(st, hh) { if (st.idx && hh.id < st.idx.nh) addHolder(st.idx, hh); } // households not yet indexed are added by index()
  function addHolder(x, hh) {
    if (hh.holder === null || hh.holder === undefined) return;
    const l = x.holds.get(hh.holder);
    if (!l) x.holds.set(hh.holder, [hh.id]); else if (!l.includes(hh.id)) { l.push(hh.id); l.sort((a, b) => a - b); }
  }
  function noteUnionEnd(st, u) {
    const x = st.idx; if (!x) return;
    if (x.spouse.get(u.a) === u.b) x.spouse.delete(u.a);
    if (x.spouse.get(u.b) === u.a) x.spouse.delete(u.b);
  }
  const holdingOf = (st, id) => {
    for (const k of index(st).holds.get(id) || []) { const h = st.households[k]; if (!h.dissolved && h.holder === id) return h; }
    return null;
  };
  const isHolder = (st, id) => holdingOf(st, id) !== null;
  const practice = (st, settlementId) => {
    const s = st.cenv.settlements[settlementId], out = {};
    Culture.DIMS.forEach((d, k) => { out[d.key] = d.opts[s.practice[k]][0]; });
    return out;
  };
  const farmPractice = (st, f) => practice(st, f.village);
  function personEvent(st, id, kind, text) { st.pawns[id].events.push({ t: st.t, kind, text }); }
  const age = (st, p, t = st.t) => Math.floor((t - p.born) / YEAR);
  const birthYear = (p) => Math.floor(p.born / YEAR) + 1;
  const fullName = (p) => `${p.given} ${p.patronym}`;
  function spouseOf(st, id, t = st.t) {
    if (t === st.t) { const sp = index(st).spouse.get(id); return sp === undefined ? null : sp; }
    const u = st.unions.find((u) => (u.a === id || u.b === id) && u.start <= t && (u.end === null || u.end > t));
    return u ? (u.a === id ? u.b : u.a) : null;
  }
  const childrenOf = (st, id) => [...(index(st).children.get(id) || [])];
  const siblingsOf = (st, id) => {
    const p = st.pawns[id]; if (p.father === null && p.mother === null) return [];
    const ids = new Set([...(p.father !== null ? childrenOf(st, p.father) : []), ...(p.mother !== null ? childrenOf(st, p.mother) : [])]);
    ids.delete(id);
    return [...ids].sort((a, b) => a - b);
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
    kinNear, villageOf, settlementIdOf, isHolder, holdingOf, noteHolder, noteUnionEnd, index, practice, farmPractice,
  };
})();
