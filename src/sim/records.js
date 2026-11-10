// @sys sim/records: person and household records, membership and service, live indexes, family queries, culture lookups; the record of
// events, a pawn's events as positions in it, and the yearly fold of its routine events (VB-199)
VB['sim/records'] = (() => {
  const Culture = VB['culture'];
  const { DAY, YEAR_DAYS, YEAR, ECON, HELP, MALE, FEMALE, patronym } = VB['sim/rules'];
  // ---- the record of events (VB-075) ----
  // st.record: every event, appended in play: {t, kind, pawn, other, household, farm, village, n, text, self}, the fields that do not
  // apply absent. log and personEvent write their event as they write their text; `false` for ev says another call records the event.
  // A pawn's own events (pawn.events) are positions in it, not copies (VB-199). A slot is never removed, so a position stays good: a
  // routine event, once folded, becomes the index of its count in st.recordYears.
  const FIELDS = ['pawn', 'other', 'household', 'farm', 'village', 'n', 'text', 'self'];
  function record(st, ev, t = st.t) {
    const e = { t, kind: ev.kind };
    for (const k of FIELDS) if (ev[k] !== undefined && ev[k] !== null) e[k] = ev[k];
    st.record.push(e);
    return e;
  }
  // How many years each kind of event stays on the record in full (Kim, 10 November 2026; QUESTION_ARCHIVE.md, "VB-199"): 0 for the
  // notable ones, kept for good; the routine ones are folded into one count per kind, village and year once that old. A kind not listed
  // is kept; tests/record.js checks that every kind on the record is listed.
  const GENERATION = 25, SHORT = 2;
  const HISTORY = {
    // notable: births, marriages and deaths; inheritances and handovers; moves and leaving; farms, plots, cottages and meadows; customs
    // and causes; shares paid; and the kinds no task has called routine yet
    born: 0, married: 0, died: 0, child: 0, holds: 0, inherited: 0, guardian: 0, service: 0, provisions: 0, moved: 0, joined: 0, left: 0,
    stayed: 0, settled: 0, noLand: 0, empty: 0, claim: 0, claimEnded: 0, cottage: 0, plot: 0, plotStarted: 0, field: 0, meadow: 0,
    stake: 0, stakeLapsed: 0, border: 0, custom: 0, split: 0, cause: 0, kinBarred: 0, share: 0, player: 0, year: 0, hayRotted: 0, offered: 0,
    matchRefused: 0, offerLapsed: 0,
    // routine
    closeFriend: SHORT, enemy: SHORT, friend: SHORT, fellOut: SHORT, gift: GENERATION, harvest: GENERATION, hay: GENERATION, frost: GENERATION,
    herdBirths: GENERATION, herdDeath: GENERATION, slaughter: GENERATION, spoiled: GENERATION, putOff: GENERATION, seedEaten: GENERATION,
  };
  // @state st.recordYears[]: {year (Math.floor(t / YEAR) of its events), kind, village (absent for events of none), tally}: the routine
  //   events folded, one count per kind, village and year; a folded slot of st.record holds its count's index. tally counts record
  //   events, so a gift between two holders counts twice. Appended only, by foldHistory.
  // @state st.recordFold: {shortAt, longAt, pass}: how far through st.record the fold has come, as positions, for the kinds kept SHORT
  //   years and those kept a generation; pass, while one runs: {shortEnd, longEnd, next (the village folded next; `none` for the events
  //   of none), none (the villages when it began), made (the counts made in this pass, by "kind|village|year")}, else null.
  // At the year's turn the fold marks the events old enough (appended in time order, so it stops at the first that is not), and folds
  // them over the year's first days, a village a day and then the events of none (rule 5). Each event is passed by each end once, and
  // by each day of its pass; it touches st.record only, never the pawns.
  function foldHistory(st, c) {
    const F = st.recordFold, R = st.record;
    if (!F.pass && c.doy === 0) {
      const start = Math.floor(st.t / YEAR) * YEAR, upTo = (i, limit) => {
        for (; i < R.length; i++) { VB.count.recordFold++; if (typeof R[i] === 'object' && R[i].t >= limit) break; }
        return i;
      };
      const shortEnd = upTo(F.shortAt, start - SHORT * YEAR), longEnd = upTo(F.longAt, start - GENERATION * YEAR);
      if (shortEnd > F.shortAt || longEnd > F.longAt) F.pass = { shortEnd, longEnd, next: 0, none: st.villages.length, made: {} };
    }
    const P = F.pass; if (!P) return;
    const fold = (from, to, short) => {
      for (let i = from; i < to; i++) {
        const e = R[i]; VB.count.recordFold++;
        if (typeof e !== 'object') continue;
        const years = HISTORY[e.kind];
        if (!years || (years === SHORT) !== short || (e.village === undefined ? P.none : e.village) !== P.next) continue;
        const year = Math.floor(e.t / YEAR), key = `${e.kind}|${e.village === undefined ? '' : e.village}|${year}`;
        let k = P.made[key];
        if (k === undefined) {
          k = P.made[key] = st.recordYears.length;
          st.recordYears.push(e.village === undefined ? { year, kind: e.kind, tally: 0 }
            : { year, kind: e.kind, village: e.village, tally: 0 });
        }
        st.recordYears[k].tally++; R[i] = k;
      }
    };
    fold(F.shortAt, P.shortEnd, true); fold(F.longAt, P.longEnd, false);
    if (++P.next > P.none) { F.shortAt = P.shortEnd; F.longAt = P.longEnd; F.pass = null; }
  }
  // Pawn id's own events gain the event at position `at` of the record (a birth or a death, which the log's line records).
  function lifeEvent(st, id, at) { st.pawns[id].events.push(at); }
  // Older saves kept a copy of each event on its pawn: each copy becomes the position of its event on the record (the same pawn, time
  // and text, whatever its kind: a move told as `joined`; a birth or death by pawn, time and kind). A copy told beside another event
  // (personEvent with `false`) has none: it is written to the record's end as the pawn's own (`self`), unless it is of a routine kind
  // (a gift given), which is dropped, as its fold would drop it. One pass over the record, at load, and only for such a save.
  function indexEvents(st) {
    if (!st.recordYears) st.recordYears = [];
    if (!st.recordFold) st.recordFold = { shortAt: 0, longAt: 0, pass: null };
    let by = null;
    for (const p of st.pawns) {
      if (!p.events.some((x) => typeof x === 'object')) continue;
      if (!by) {
        by = new Map();
        st.record.forEach((e, i) => {
          if (typeof e !== 'object' || e.pawn === undefined) return;
          const key = `${e.pawn}|${e.t}`, l = by.get(key);
          if (l) l.push(i); else by.set(key, [i]);
        });
      }
      const out = [];
      for (const x of p.events) {
        if (typeof x !== 'object') { out.push(x); continue; }
        const l = by.get(`${p.id}|${x.t}`) || [], vital = x.kind === 'born' || x.kind === 'died';
        const j = l.findIndex((i) => (vital ? st.record[i].kind === x.kind : st.record[i].text === x.text));
        if (j >= 0) { out.push(l[j]); l.splice(j, 1); continue; }
        if (HISTORY[x.kind]) continue;
        record(st, { kind: x.kind, pawn: p.id, text: x.text, self: true }, x.t); out.push(st.record.length - 1);
      }
      p.events = out;
    }
  }
  // where an event of household hh or farm f happened
  const atHousehold = (st, hh) => ({ household: hh.id, farm: hh.farmstead, village: st.farmsteads[hh.farmstead].village });
  const atFarm = (f) => ({ household: f.household, farm: f.id, village: f.village });
  // A line of the village log: its event goes on the record, and the log is a view of the record (sim/notable, villageLog; VB-099).
  // Every line names its event (tests/record.js checks each call), or false when another call records the same happening. It gives the
  // event's position on the record, or -1.
  const log = (st, text, ev) => {
    if (ev === undefined) throw new Error(`log without an event: ${text}`);
    if (!ev) return -1;
    record(st, { ...ev, text: ev.text !== undefined ? ev.text : text });
    return st.record.length - 1;
  };
  // @state st.living: sorted ids of living pawns; a cache owned here.
  // @state st.liveHouseholds: sorted ids of undissolved households; a cache owned here.
  // Rebuilt once at seed/load, including older format-1 saves. In play only creation and ending a record change them.
  function rebuildLiving(st) {
    st.living = st.pawns.filter((p) => p.died === null).map((p) => p.id);
    st.liveHouseholds = st.households.filter((h) => !h.dissolved).map((h) => h.id);
  }
  function noteDeath(st, id) { const i = st.living.indexOf(id); if (i >= 0) st.living.splice(i, 1); }
  function noteDissolved(st, hh) { const i = st.liveHouseholds.indexOf(hh.id); if (i >= 0) st.liveHouseholds.splice(i, 1); }
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
      hunger: 0, hungerLog: [], health: 100, kinPush: null,
      buffer: HELP.bufferDays[0] + R.rand() * (HELP.bufferDays[1] - HELP.bufferDays[0]),
    };
    if (p.died !== null) { p.born = p.died - o.age * YEAR; }
    R.pawns.push(p);
    if (R.living && p.died === null) R.living.push(p.id);
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
    const hh = { id, farmstead: f.id, members: [...members], holder, grain: ECON.startGrain, meals: 0, wood: ECON.startWood, stone: 0,
      ledger: [], totals: [], unthreshed: [], hungryDays: 0, seedSeason: -1, hunger: 0, waterDay: -1, cookDay: -1, dissolved: false, herds: [], hay: 0,
        haySpoilt: 0,
      larder: [], fodderDay: -1,
      milkDay: -1, manure: 0, spoilt: 0 };
    if (R.liveHouseholds) R.liveHouseholds.push(id);
    f.household = id; f.line = holder; f.state = 'occupied'; noteLine(R, f);
    for (const m of members) R.pawns[m].household = id;
    if (f.fence) for (const s of f.fence) s.owner.id = id;
    return hh;
  }
  // @state pawn.household, pawn.servant, household.members: membership and service, written only here.
  function joinHousehold(R, hh, id, servant = R.pawns[id].servant) {
    if (!hh.members.includes(id)) hh.members.push(id);
    R.pawns[id].household = hh.id; setServant(R, id, servant);
  }
  // Death keeps the last household and service on the historical person record.
  function leaveHousehold(st, id, historical = false) {
    const p = st.pawns[id], hh = p.household !== null ? st.households[p.household] : null;
    if (hh) hh.members = hh.members.filter((m) => m !== id);
    if (!historical) p.household = null;
  }
  function clearMembers(st, hh) { hh.members = []; }
  function setServant(st, id, servant) { st.pawns[id].servant = servant; }
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
  // Indexes over the records, built on first use and caught up with new pawns, unions, households and farmsteads on each read (records are
  // only appended); the places that end a union, change a holder or set a farm's line call noteUnionEnd, noteHolder and noteLine. Not
  // enumerable: they are derived data.
  // @state st.idx: {children: Map of pawn id to child ids, spouse: Map of pawn id to current spouse id, holds: Map of pawn id to the ids of
  //   households it holds, lines: Map of pawn id to the ids of farmsteads whose line it is or was (VB-224), union: Map of pawn id to active
  //   union id, widowed: Set of pawn ids with an ended union; seen: counts of pawns, unions, households and farmsteads already indexed};
  //   derived from the records, see sim/records
  function index(st) {
    if (!st.idx) Object.defineProperty(st, 'idx', {
      value: { children: new Map(), spouse: new Map(), union: new Map(), widowed: new Set(), holds: new Map(), lines: new Map(),
        np: 0, nu: 0, nh: 0, nf: 0 }, writable: true });
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
      if (u.end !== null) { x.widowed.add(u.a); x.widowed.add(u.b); }
      if (u.end === null && u.start <= st.t) {
        if (!x.spouse.has(u.a)) { x.spouse.set(u.a, u.b); x.union.set(u.a, u.id); }
        if (!x.spouse.has(u.b)) { x.spouse.set(u.b, u.a); x.union.set(u.b, u.id); }
      }
    }
    while (x.nh < st.households.length) addHolder(x, st.households[x.nh++]);
    while (x.nf < st.farmsteads.length) addLine(x, st.farmsteads[x.nf++]);
    return x;
  }
  function noteHolder(st, hh) { if (st.idx && hh.id < st.idx.nh) addHolder(st.idx, hh); } // households not yet indexed are added by index()
  function addHolder(x, hh) {
    if (hh.holder === null || hh.holder === undefined) return;
    const l = x.holds.get(hh.holder);
    if (!l) x.holds.set(hh.holder, [hh.id]); else if (!l.includes(hh.id)) { l.push(hh.id); l.sort((a, b) => a - b); }
  }
  // A farm keeps an entry under every line it has had; householdsOfLine reads only those whose line is still that pawn.
  function noteLine(st, f) { if (st.idx && f.id < st.idx.nf) addLine(st.idx, f); } // farmsteads not yet indexed are added by index()
  function addLine(x, f) {
    if (f.line === null || f.line === undefined) return;
    const l = x.lines.get(f.line);
    if (!l) x.lines.set(f.line, [f.id]); else if (!l.includes(f.id)) { l.push(f.id); l.sort((a, b) => a - b); }
  }
  // The ids of the live households whose farm's line is pawn `id`, or, on a farm with no line, whose holder it is: those whose direct
  // heirs are its descendants (heirRanking's lineOf), in farmstead order, then holdings.
  function householdsOfLine(st, id) {
    const x = index(st), out = [];
    for (const k of x.lines.get(id) || []) {
      const f = st.farmsteads[k];
      if (f.line !== id || f.household === null || f.household === undefined) continue;
      if (!st.households[f.household].dissolved) out.push(f.household);
    }
    for (const k of x.holds.get(id) || []) {
      const h = st.households[k], line = st.farmsteads[h.farmstead].line;
      if (!h.dissolved && h.holder === id && (line === null || line === undefined)) out.push(k);
    }
    return out;
  }
  function noteUnionEnd(st, u) {
    const x = st.idx; if (!x) return;
    x.widowed.add(u.a); x.widowed.add(u.b);
    if (x.spouse.get(u.a) === u.b) { x.spouse.delete(u.a); x.union.delete(u.a); }
    if (x.spouse.get(u.b) === u.a) { x.spouse.delete(u.b); x.union.delete(u.b); }
  }
  const unionOf = (st, id) => { const uid = index(st).union.get(id); return uid === undefined ? null : st.unions[uid]; };
  const wasWidowed = (st, id) => index(st).widowed.has(id);
  const holdingOf = (st, id) => {
    for (const k of index(st).holds.get(id) || []) { const h = st.households[k]; if (!h.dissolved && h.holder === id) return h; }
    return null;
  };
  const isHolder = (st, id) => holdingOf(st, id) !== null;
  // The player's wish for pawn id at the moving round (`kind`: 'out', 'claim' or 'serve'; st.player.wishes, sim/commands), or null: no one
  // plays the pawn, or the player leaves it to the pawn. The round reads it only where it asks what a pawn itself wants (VB-212).
  const wishOf = (st, id, kind) => { const pl = st.player; return pl && pl.pawn === id ? pl.wishes[kind] : null; };
  // Who speaks for pawn id in a match (design.md, Marriage as a negotiation: Who negotiates; VB-293): the holder of its household when it
  // lives there as a son or daughter of the house (a child of the holder, of the holder's spouse or of the holder's parent, not in service,
  // and not the holder); otherwise the pawn itself. O(1): the holder, its spouse and its two parents.
  function spokesmanOf(st, id) {
    const p = st.pawns[id];
    if (p.household === null || p.servant) return id;
    const hh = st.households[p.household], h = hh.holder;
    if (hh.dissolved || h === null || h === id) return id;
    const hp = st.pawns[h], sp = spouseOf(st, h), of = (q) => q !== null && (q === h || q === sp || q === hp.father || q === hp.mother);
    return of(p.father) || of(p.mother) ? h : id;
  }
  const practice = (st, settlementId) => {
    const s = st.cenv.settlements[settlementId], out = {};
    Culture.DIMS.forEach((d, k) => { out[d.key] = d.opts[s.practice[k]][0]; });
    return out;
  };
  const farmPractice = (st, f) => practice(st, f.village);
  // An event of pawn id in its own words: one event on the record, and its position on the pawn (VB-199). With `false` for ev another
  // call records the happening, and this is the pawn's own telling of it (`self`), which only the pawn's life reads.
  function personEvent(st, id, kind, text, ev = {}) {
    record(st, ev ? { kind, pawn: id, text, ...ev } : { kind, pawn: id, text, village: settlementIdOf(st, st.pawns[id]), self: true });
    st.pawns[id].events.push(st.record.length - 1);
  }
  const age = (st, p, t = st.t) => Math.floor((t - p.born) / YEAR);
  const birthYear = (p) => Math.floor(p.born / YEAR) + 1;
  const fullName = (p) => `${p.given} ${p.patronym}`;
  function spouseOf(st, id, t = st.t) {
    if (t === st.t) { const sp = index(st).spouse.get(id); return sp === undefined ? null : sp; }
    const u = st.unions.find((u) => (u.a === id || u.b === id) && u.start <= t && (u.end === null || u.end > t));
    return u ? (u.a === id ? u.b : u.a) : null;
  }
  const childrenOf = (st, id) => [...(index(st).children.get(id) || [])];
  // The ancestors of `ids`, one to `generations` up (VB-224); each is reached first at its nearest generation, and walked from there.
  function ancestorsOf(st, ids, generations) {
    const out = new Set();
    for (let up = 0, gen = ids; up < generations && gen.length; up++) {
      const next = [];
      for (const id of gen) for (const q of [st.pawns[id].father, st.pawns[id].mother]) if (q !== null && !out.has(q)) { out.add(q); next.push(q); }
      gen = next;
    }
    return out;
  }
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
  // Civil degree of kin: for each common ancestor add the generations up from each person; the smallest sum.
  // 0 for a direct line, Infinity when no common ancestor is on record.
  function kinDegree(st, a, b) {
    if (a === b) return 0;
    const up = (id) => { // ancestor id -> fewest generations up from id, id itself 0
      const m = new Map([[id, 0]]); let front = [id];
      for (let g = 1; front.length; g++) {
        const next = [];
        for (const x of front) for (const q of [st.pawns[x].father, st.pawns[x].mother]) if (q !== null && !m.has(q)) { m.set(q, g); next.push(q); }
        front = next;
      }
      return m;
    };
    const ua = up(a), ub = up(b); let best = Infinity;
    for (const [id, ga] of ua) {
      const gb = ub.get(id); if (gb === undefined) continue;
      if (ga === 0 || gb === 0) return 0;
      best = Math.min(best, ga + gb);
    }
    return best;
  }
  const villageOf = (st, p) => st.farmsteads[st.households[p.household].farmstead].village;
  // The living pawns of settlement sid (a village and its households), in id order.
  function membersOf(st, sid) {
    const out = [];
    for (const id of st.liveHouseholds) {
      const hh = st.households[id];
      if (st.farmsteads[hh.farmstead].village === sid) for (const m of hh.members) {
        const p = st.pawns[m]; if (p.alive && p.household === hh.id) out.push(p);
      }
    }
    return out.sort((a, b) => a.id - b.id);
  }
  // How much p's voice counts at the meeting of settlement s, by its practice of the custom "voice": 0 or 1.
  function voiceOf(st, p, s) {
    if (!p.alive || p.age < 18) return 0;
    const v = Culture.DIMS[Culture.IDX.voice].opts[s.practice[Culture.IDX.voice]][0];
    if (v === 'adults') return 1;
    const holder = isHolder(st, p.id);
    if (holder) return 1;
    if (v === 'heads') { const sp = spouseOf(st, p.id); return sp !== null && isHolder(st, sp) ? 1 : 0; }
    return 0;
  }
  return {
    rebuildLiving, noteDeath, noteDissolved, person, marry, nameKit, makeHousehold, joinHousehold, leaveHousehold, clearMembers, setServant, personEvent, log,
      record, HISTORY, foldHistory, lifeEvent, indexEvents,
      atHousehold, atFarm, age,
      birthYear, fullName, spouseOf,
      childrenOf, siblingsOf, kinship, kinDegree,
    kinNear, villageOf, settlementIdOf, isHolder, membersOf, voiceOf, holdingOf, noteHolder, noteUnionEnd, unionOf, wasWidowed, index, practice, farmPractice,
    noteLine, householdsOfLine, ancestorsOf, wishOf, spokesmanOf,
  };
})();
