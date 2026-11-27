// @sys sim/records: person and household records, membership and service, live indexes, family queries, culture lookups; the
// record of events, a pawn's events as positions in it, and the yearly fold of its routine events (VB-199)
VB['sim/records'] = (() => {
  const Customs = VB['sim/customs'],
    { inForce } = VB['sim/customs'];
  const Crowding = VB['sim/crowding'],
    Graph = VB['sim/graph'];
  const { DAY, YEAR_DAYS, YEAR, ECON, MALE, FEMALE, patronym } = VB['sim/rules'];
  // ---- the record of events (VB-075) ----
  // st.record: every event, appended in play: {t, kind, pawn, other, household, farm, village, n, text, self, cold, tile, reason,
  // fromFarm, by}, the fields that do not apply absent (cold: a death in a cold house, VB-327; tile: where a pawn died on the road,
  // VB-287; fromFarm: the farm a `joined` pawn left, VB-1027; by: the pawn who refused a match, VB-693, its `reason` why). log and
  // personEvent write their event as they write their text; `false` for ev says another call records the event.
  // A pawn's own events (pawn.events) are positions in it, not copies (VB-199). A slot is never removed, so a position stays good: a
  // routine event, once folded, becomes the index of its count in st.recordYears.
  const FIELDS = [
    'pawn',
    'other',
    'household',
    'farm',
    'village',
    'n',
    'text',
    'self',
    'cold',
    'tile',
    'reason',
    'fromFarm',
    'by',
  ];
  function record(st, ev, t = st.t) {
    const e = { t, kind: ev.kind };
    for (const k of FIELDS) if (ev[k] !== undefined && ev[k] !== null) e[k] = ev[k];
    st.record.push(e);
    return e;
  }
  // How many years each kind of event stays on the record in full (Kim, 10 November 2026; QUESTION_ARCHIVE.md, "VB-199"): 0 for the
  // notable ones, kept for good; the routine ones are folded into one count per kind, village and year once that old. A kind not listed
  // is kept; tests/record.js checks that every kind on the record is listed.
  const GENERATION = 25,
    SHORT = 2;
  const HISTORY = {
    // notable: births, marriages and deaths; inheritances and handovers; moves and leaving; farms, plots, cottages and meadows; customs
    // and causes; shares paid; and the kinds no task has called routine yet
    born: 0,
    bornOutside: 0, // a child born outside marriage, and one its parents' marriage made born in it (sim/births, VB-555)
    legitimated: 0,
    married: 0,
    died: 0,
    child: 0,
    holds: 0,
    inherited: 0,
    guardian: 0,
    service: 0,
    provisions: 0,
    moved: 0,
    joined: 0,
    left: 0,
    stayed: 0,
    settled: 0,
    noLand: 0,
    empty: 0,
    claim: 0,
    claimEnded: 0,
    cottage: 0,
    plot: 0,
    plotStarted: 0,
    green: 0, // the village's green and well laid out, and done (VB-058)
    field: 0,
    fieldLeft: 0, // a field a household let go, its tile back to the village (sim/fields, VB-768)
    meadow: 0,
    stake: 0,
    stakeLapsed: 0,
    projectDropped: 0,
    projectTaken: 0, // a head's project taken and finished (VB-255)
    projectDone: 0,
    border: 0,
    oreFound: 0,
    custom: 0,
    split: 0,
    cause: 0,
    wishLapsed: 0, // the played pawn's wish for a match ended or passed by, with why (sim/wishes, VB-1113)
    kinBarred: 0,
    share: 0,
    wage: 0, // a servant's wage paid, or what was still owed of it lapsed (sim/service, VB-637)
    player: 0,
    year: 0,
    hayRotted: 0,
    offered: 0,
    visited: 0, // a suitor's visit to another village (VB-289)
    visitOff: GENERATION, // kept home by the farm's food
    matchRefused: 0,
    marriedAgainst: 0, // one who courted another married the one its spokesman chose (sim/marriage, VB-693)
    leftRefused: 0, // left home for service after a head refused the one it courts (sim/service, VB-036)
    offerLapsed: 0,
    offerRefused: 0, // goods offered or asked for, refused (sim/offers, VB-690)
    advice: GENERATION, // a retired member's advice taken by its head (sim/advice, VB-1316)
    renounced: 0, // an inheritance renounced by one in line who holds a place (sim/heirs, VB-824)
    meetingFailed: 0,
    loan: 0, // a loan of grain made (sim/loans, VB-312)
    loanRepaid: 0, // a loan's repayment at the harvest, in whole or in part (sim/loans, VB-312)
    loanDefaulted: 0, // a loan unpaid after its second harvest (sim/loans, VB-312; VB-315 hears it)
    days: 0, // days of work owed lapsed (sim/obligations, VB-462; the alderman's keep, VB-463)
    follower: 0, // a tie of a follower to its lord begun or ended, with why (sim/followers, VB-708)
    alderman: 0, // the village's alderman chosen, and the office vacated (sim/meetings, VB-314)
    gathering: 0, // the villages that go to a host's gathering this winter (VB-294)
    gatheringHeld: 0, // who was at a host's gathering on its last day, and the ale poured (VB-295)
    fair: 0, // the fair at a gathering: its deals, what changed hands, those that failed for want of change (VB-302)
    cartBuilt: 0, // a household's new cart (VB-327)
    loomBuilt: 0, // a household's loom built (VB-362)
    tarPit: 0, // a household's tar pit dug (VB-301)
    drained: 0, // a household's wet field ditched (VB-721)
    wellDug: 0, // a household's well dug by its house (VB-1584)
    facilityBuilt: 0, // a facility's last stage raised (VB-361)
    thirst: SHORT, // a pawn that left what it did to drink, THIRST.leave hours without one (sim/drinking, VB-1585)
    trail: 0, // a trail blazed through the wood (VB-447)
    setOut: 0, // a journey to a new home in another village (VB-287)
    // routine (a wedding and a funeral ale add to the marriage and the death that are kept)
    closeFriend: SHORT,
    enemy: SHORT,
    friend: SHORT,
    swap: SHORT, // a deal at the fair, each side's (VB-302)
    fellOut: SHORT,
    quarrel: SHORT, // cross words that became a quarrel (VB-520)
    lieExposed: SHORT, // a lie told to one who knew better (sim/stories, VB-554)
    heardOfUs: SHORT, // the played pawn heard a story of its household (sim/stories, VB-554)
    helped: SHORT, // helped another household of the village with its work (VB-106)
    workday: SHORT, // a village's work day: who turned out and who stayed away (VB-120)
    workLeft: SHORT, // a village's routine work left undone at its seasons' ends, heard at its meeting (VB-1768)
    levyBreached: SHORT, // a household's levied day not worked, booked as goodwill its head owes (sim/levies, VB-1768)
    courting: GENERATION, // a courtship begun, and ended unmarried (sim/courting, VB-036)
    courtingEnded: GENERATION,
    gift: GENERATION,
    harvest: GENERATION,
    hay: GENERATION,
    frost: GENERATION,
    misjudged: GENERATION,
    seasonShort: SHORT, // a head reckoned its season's work past its household's labour budget, and how it answered (sim/levies, VB-1778)
    climate: SHORT, // a winter's date falls in a band of the map (sim/climate, VB-807)
    weather: SHORT, // a season's weather, named as it begins (sim/weather, VB-354)
    herdBirths: GENERATION,
    herdDeath: GENERATION,
    herdLed: GENERATION, // animals that changed household led home, or taken in where they were left (sim/droving, VB-674)
    slaughter: GENERATION,
    spoiled: GENERATION,
    putOff: GENERATION,
    seedEaten: GENERATION,
    wedding: GENERATION,
    funeralAle: GENERATION,
    feast: GENERATION, // food laid out at a wedding or a funeral ale (VB-458)
    aleEvening: SHORT, // a holder's open house on a barrel of its ale (VB-522)
    rite: GENERATION, // the season's rite on a village green, and who led it (VB-522)
    noWood: GENERATION,
    cattleInCrop: GENERATION,
    cartGone: GENERATION, // a cart worn out (VB-327)
    boatLost: GENERATION, // a fishing boat lost for want of tar (VB-301)
    arrived: GENERATION, // the journey's end (VB-287)
    deerInCrop: GENERATION,
  };
  // @state st.recordYears[]: {year (Math.floor(t / YEAR) of its events), kind, village (absent for events of none), tally}: the routine
  //   events folded, one count per kind, village and year; a folded slot of st.record holds its count's index. tally counts record
  //   events, so a gift between two holders counts twice. Appended only, by foldHistory.
  // @state st.recordFold: {shortAt, longAt, pass}: how far through st.record the fold has come, as positions, for the kinds kept SHORT
  //   years and those kept a generation; pass, while one runs: {shortEnd, longEnd, shortNext, longNext (how far this pass has folded each
  //   end), made (the counts made in this pass, by "kind|village|year")}, else null.
  // At the year's turn the fold marks the events old enough (appended in time order, so it stops at the first that is not), and folds
  // them over the year's first FOLD_DAYS days, a slice of the slots a day (rule 5). Each slot is passed once by each end to mark it and
  // once to fold it, never once a village; it touches st.record only, never the pawns.
  const FOLD_DAYS = 4;
  // The year's start (sim/clock's CALENDAR) begins a pass, unless one is under way; foldHistory, daily, folds a slice of it.
  function startFold(st) {
    const F = st.recordFold,
      R = st.record;
    if (F.pass) return;
    const start = Math.floor(st.t / YEAR) * YEAR,
      upTo = (i, limit) => {
        for (; i < R.length; i++) {
          VB.count.recordFold++;
          if (typeof R[i] === 'object' && R[i].t >= limit) break;
        }
        return i;
      };
    const shortEnd = upTo(F.shortAt, start - SHORT * YEAR),
      longEnd = upTo(F.longAt, start - GENERATION * YEAR);
    if (shortEnd > F.shortAt || longEnd > F.longAt)
      F.pass = { shortEnd, longEnd, shortNext: F.shortAt, longNext: F.longAt, made: {} };
  }
  function foldHistory(st) {
    const F = st.recordFold,
      R = st.record,
      P = F.pass;
    if (!P) return;
    const fold = (from, to, short) => {
      for (let i = from; i < to; i++) {
        const e = R[i];
        VB.count.recordFold++;
        if (typeof e !== 'object') continue;
        const years = HISTORY[e.kind];
        if (!years || (years === SHORT) !== short) continue;
        const year = Math.floor(e.t / YEAR),
          key = `${e.kind}|${e.village === undefined ? '' : e.village}|${year}`;
        let k = P.made[key];
        if (k === undefined) {
          k = P.made[key] = st.recordYears.length;
          st.recordYears.push(
            e.village === undefined
              ? { year, kind: e.kind, tally: 0 }
              : { year, kind: e.kind, village: e.village, tally: 0 },
          );
        }
        st.recordYears[k].tally++;
        R[i] = k;
      }
    };
    const slice = (at, end, next) => Math.min(end, next + Math.ceil((end - at) / FOLD_DAYS));
    const s = slice(F.shortAt, P.shortEnd, P.shortNext),
      l = slice(F.longAt, P.longEnd, P.longNext);
    fold(P.shortNext, s, true);
    fold(P.longNext, l, false);
    P.shortNext = s;
    P.longNext = l;
    if (s >= P.shortEnd && l >= P.longEnd) {
      F.shortAt = P.shortEnd;
      F.longAt = P.longEnd;
      F.pass = null;
    }
  }
  // Pawn id's own events gain the event at position `at` of the record (a birth or a death, which the log's line records).
  function lifeEvent(st, id, at) {
    st.pawns[id].events.push(at);
  }
  // where an event of household hh or farm f happened
  const atHousehold = (st, hh) => ({
    household: hh.id,
    farm: hh.farmstead,
    village: st.farmsteads[hh.farmstead].village,
  });
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
  // @state st.living: sorted ids of living pawns; a cache owned here; derived, not saved (`sim/saves` DERIVED).
  // @state st.liveHouseholds: sorted ids of undissolved households; a cache owned here; derived, not saved (`sim/saves` DERIVED).
  // Rebuilt once at seed/load, including older format-1 saves. In play only creation and ending a record change them.
  function rebuildLiving(st) {
    st.living = st.pawns.filter((p) => p.died === null).map((p) => p.id);
    st.liveHouseholds = st.households.filter((h) => !h.dissolved).map((h) => h.id);
    Crowding.rebuild(st);
    Graph.migrate(st); // the membership graph, built from the records at a seed or from an older save's (VB-043)
    if (!st.peopleCheck) st.peopleCheck = st.liveHouseholds.slice(); // a new run, or an older save: every household is checked once
  }
  // @state st.peopleCheck: ids of households whose membership lost a member, or took in a minor, since sim/service last asked whether
  //   an adult is left (VB-323); no duplicates; owned here, emptied by takePeopleCheck
  function notePeopleCheck(st, hh) {
    if (st.peopleCheck && !hh.dissolved && !st.peopleCheck.includes(hh.id)) st.peopleCheck.push(hh.id);
  }
  // The noted households in ascending id, the queue emptied.
  function takePeopleCheck(st) {
    const q = st.peopleCheck.sort((a, b) => a - b);
    st.peopleCheck = [];
    return q;
  }
  function noteDeath(st, id) {
    Graph.died(st, id);
    const i = st.living.indexOf(id);
    if (i >= 0) st.living.splice(i, 1);
  }
  function noteDissolved(st, hh) {
    const i = st.liveHouseholds.indexOf(hh.id);
    if (i >= 0) st.liveHouseholds.splice(i, 1);
    Crowding.ended(st, hh);
    Graph.dissolved(st, hh);
    const j = st.peopleCheck ? st.peopleCheck.indexOf(hh.id) : -1;
    if (j >= 0) st.peopleCheck.splice(j, 1);
  }
  // A person on record. Patronymics come from the recorded father, or from a name known only from the patronymic.
  function person(R, o) {
    const father = o.father !== undefined && o.father !== null ? R.pawns[o.father] : null;
    const fatherName = father ? father.given : o.fatherName || R.pickFather();
    const p = {
      id: R.pawns.length,
      given: o.given || R.pickGiven(o.sex),
      sex: o.sex,
      born: -(o.age * YEAR + ((R.rand() * YEAR_DAYS) | 0) * DAY),
      died: o.diedYearsAgo !== undefined ? -o.diedYearsAgo * YEAR - ((R.rand() * YEAR_DAYS) | 0) * DAY : null,
      father: father ? father.id : null,
      mother: o.mother !== undefined ? o.mother : null,
      fatherName,
      patronym: patronym(fatherName, o.sex),
      founder: !father && (o.mother === undefined || o.mother === null),
      household: null,
      role: 'child',
      servant: !!o.servant,
      servedSince: o.servant ? R.t || 0 : null,
      retired: false,
      look: (R.rand() * 1e9) >>> 0,
      events: [],
      pregnantUntil: null,
      pregnantBy: null,
      nursingUntil: null,
      nursling: null,
      hunger: 0,
      hungerLog: [],
      health: 100,
      drank: R.t || 0, // the hour it last drank (sim/thirst, VB-1585): at its making
      kinPush: null,
      visited: null,
    };
    R.rand(); // the draw that was pawn.buffer's (VB-216), now generosity's (VB-520): kept, so the stream goes on as before
    if (p.died !== null) {
      p.born = p.died - o.age * YEAR;
    }
    R.pawns.push(p);
    if (R.living && p.died === null) R.living.push(p.id);
    return p.id;
  }
  function marry(R, a, b, yearsAgo, endYearsAgo) {
    R.unions.push({
      id: R.unions.length,
      a,
      b,
      start: -yearsAgo * YEAR,
      end: endYearsAgo !== undefined ? -endYearsAgo * YEAR : null,
      kind: 'marriage',
    });
    Graph.wed(R, a, b, -yearsAgo * YEAR); // a scenario's kit, before the graph: nothing (migrate reads the unions)
  }
  function nameKit(rand) {
    const usedM = new Set(),
      usedF = new Set(),
      usedFather = new Set();
    const take = (list, s) => {
      const free = list.filter((n) => !s.has(n));
      const n = (free.length ? free : list)[(rand() * (free.length || list.length)) | 0];
      s.add(n);
      return n;
    };
    return {
      rand,
      pickGiven: (sex) => take(sex === 'm' ? MALE : FEMALE, sex === 'm' ? usedM : usedF),
      pickFather: () => take(MALE, usedFather),
    };
  }
  function makeHousehold(R, id, f, members, holder) {
    const hh = {
      id,
      farmstead: f.id,
      members: [...members],
      holder,
      grain: { barley: ECON.startGrain },
      meals: 0,
      flour: 0, // ground on the quern (VB-009; sim/stores holds it, sim/quern grinds it)
      quern: null, // the hand quern (VB-009, sim/quern); a household of the scenario's start is given one there
      wood: ECON.startWood,
      stone: {}, // the stone heap by rock (VB-332, VB-733; sim/stores)
      ledger: [],
      totals: [],
      unthreshed: [],
      hungryDays: 0,
      seedSeason: -1,
      hunger: 0,
      cold: 0,
      coldLog: [],
      dry: 0,
      dryLog: [],
      waterDay: Math.floor((R.t || 0) / DAY), // the first day counts as fetched (VB-331; a scenario's record kit has no clock: day 0)
      cookDay: -1,
      dissolved: false,
      herds: [],
      hay: 0,
      haySpoilt: 0,
      clay: 0,
      bogOre: 0,
      peat: 0,
      rack: 0,
      boat: null,
      tar: 0,
      hides: 0,
      tarPit: null, // tar: barrels held (sim/stores), tarPit: the household's tar pit (sim/tar; VB-301)
      carts: [],
      cartMiss: 0, // carts, cartMiss: sim/carts; clay, bogOre: loads dug (VB-359); rack, boat: VB-300 (sim/drying)
      larder: [],
      fresh: [],
      fodderDay: -1,
      ale: [],
      poured: [],
      milkDay: -1,
      manure: 0,
      wool: 0,
      spoilt: 0,
    };
    if (R.liveHouseholds) R.liveHouseholds.push(id);
    f.household = id;
    f.line = holder;
    f.state = 'occupied';
    noteLine(R, f);
    for (const m of members) R.pawns[m].household = id;
    Graph.made(R, hh, f.village);
    Crowding.founded(R, hh);
    if (f.fence) for (const s of f.fence) s.owner.id = id;
    return hh;
  }
  // @state pawn.household, pawn.servant, household.members: membership and service, written only here, as caches of the membership graph
  //   (sim/graph): each move writes its edge with them (VB-043).
  function joinHousehold(R, hh, id, servant = R.pawns[id].servant) {
    if (!hh.members.includes(id)) {
      hh.members.push(id);
      Graph.link(R, id, hh.id, 'resides');
      Crowding.moved(R, hh, 1);
    }
    if (R.pawns[id].age < 18) notePeopleCheck(R, hh); // a minor may be all a household has
    R.pawns[id].household = hh.id;
    setServant(R, id, servant);
  }
  // Death keeps the last household and service on the historical person record.
  function leaveHousehold(st, id, historical = false) {
    const p = st.pawns[id],
      hh = p.household !== null ? st.households[p.household] : null;
    if (hh) {
      const had = hh.members.length;
      hh.members = hh.members.filter((m) => m !== id);
      Crowding.moved(st, hh, hh.members.length - had);
      notePeopleCheck(st, hh);
      Graph.leave(st, id, hh.id, !historical);
    }
    if (!historical) p.household = null;
  }
  function clearMembers(st, hh) {
    Crowding.moved(st, hh, -hh.members.length);
    if (st.edges) Graph.end(st, Graph.liveTo(st, 'resides', hh.id)); // kept on their records (VB-043)
    hh.members = [];
  } // an empty household is skipped by the check, so it is not noted
  // @state pawn.servedSince: the game hour a pawn entered service (null outside it), kept with pawn.servant (VB-634).
  function setServant(st, id, servant) {
    const p = st.pawns[id];
    if (servant && !p.servant) Graph.link(st, id, p.household, 'service');
    else if (!servant && p.servant && st.edges) Graph.end(st, Graph.liveFrom(st, 'service', id), true);
    if (servant && !p.servant) p.servedSince = st.t || 0;
    else if (!servant) p.servedSince = null;
    p.servant = servant;
  }
  function settlementIdOf(st, p) {
    const hh = p.household !== null ? st.households[p.household] : null;
    if (!hh) return null;
    return st.farmsteads[hh.farmstead].village;
  }
  const kinNear = (st, id) => {
    const p = st.pawns[id],
      out = new Set();
    if (p.father !== null) out.add(p.father);
    if (p.mother !== null) out.add(p.mother);
    for (const c of childrenOf(st, id)) out.add(c);
    for (const s of siblingsOf(st, id)) out.add(s);
    const sp = spouseOf(st, id);
    if (sp !== null) out.add(sp);
    return [...out];
  };
  // Indexes over the records, built on first use and caught up with new pawns, unions, households and farmsteads on each read (records are
  // only appended); the places that end a union, change a holder or set a farm's line call noteUnionEnd, noteHolder and noteLine.
  // @state st.idx: {children: Map of pawn id to child ids, spouse: Map of pawn id to current spouse id, holds: Map of pawn id to the ids of
  //   households it holds, lines: Map of pawn id to the ids of farmsteads whose line it is or was (VB-224), union: Map of pawn id to active
  //   union id, widowed: Set of pawn ids with an ended union; seen: counts of pawns, unions, households and farmsteads already indexed};
  //   derived from the records, see sim/records; null until its first use; derived, not saved (`sim/saves` DERIVED)
  function index(st) {
    if (!st.idx)
      st.idx = {
        children: new Map(),
        spouse: new Map(),
        union: new Map(),
        widowed: new Set(),
        spouses: new Map(),
        holds: new Map(),
        lines: new Map(),
        np: 0,
        nu: 0,
        nh: 0,
        nf: 0,
      };
    const x = st.idx;
    for (; x.np < st.pawns.length; x.np++) {
      const p = st.pawns[x.np];
      for (const parent of p.father === p.mother ? [p.father] : [p.father, p.mother]) {
        if (parent === null) continue;
        const l = x.children.get(parent);
        if (l) l.push(p.id);
        else x.children.set(parent, [p.id]);
      }
    }
    for (; x.nu < st.unions.length; x.nu++) {
      const u = st.unions[x.nu];
      for (const [i, j] of [
        [u.a, u.b],
        [u.b, u.a],
      ]) {
        const l = x.spouses.get(i);
        if (l) l.push(j);
        else x.spouses.set(i, [j]);
      }
      if (u.end !== null) {
        x.widowed.add(u.a);
        x.widowed.add(u.b);
      }
      if (u.end === null && u.start <= st.t) {
        if (!x.spouse.has(u.a)) {
          x.spouse.set(u.a, u.b);
          x.union.set(u.a, u.id);
        }
        if (!x.spouse.has(u.b)) {
          x.spouse.set(u.b, u.a);
          x.union.set(u.b, u.id);
        }
      }
    }
    while (x.nh < st.households.length) addHolder(x, st.households[x.nh++]);
    while (x.nf < st.farmsteads.length) addLine(x, st.farmsteads[x.nf++]);
    return x;
  }
  function noteHolder(st, hh) {
    Graph.single(st, 'holder', hh.id, hh.holder);
    if (st.idx && hh.id < st.idx.nh) addHolder(st.idx, hh);
  } // households not yet indexed are added by index()
  function addHolder(x, hh) {
    if (hh.holder === null || hh.holder === undefined) return;
    const l = x.holds.get(hh.holder);
    if (!l) x.holds.set(hh.holder, [hh.id]);
    else if (!l.includes(hh.id)) {
      l.push(hh.id);
      l.sort((a, b) => a - b);
    }
  }
  // A farm keeps an entry under every line it has had; householdsOfLine reads only those whose line is still that pawn.
  function noteLine(st, f) {
    Graph.single(st, 'line', f.id, f.line);
    if (st.idx && f.id < st.idx.nf) addLine(st.idx, f);
  } // farmsteads not yet indexed are added by index()
  function addLine(x, f) {
    if (f.line === null || f.line === undefined) return;
    const l = x.lines.get(f.line);
    if (!l) x.lines.set(f.line, [f.id]);
    else if (!l.includes(f.id)) {
      l.push(f.id);
      l.sort((a, b) => a - b);
    }
  }
  // The ids of the live households whose farm's line is pawn `id`, or, on a farm with no line, whose holder it is: those whose direct
  // heirs are its descendants (heirRanking's lineOf), in farmstead order, then holdings.
  function householdsOfLine(st, id) {
    const x = index(st),
      out = [];
    for (const k of x.lines.get(id) || []) {
      const f = st.farmsteads[k];
      if (f.line !== id || f.household === null || f.household === undefined) continue;
      if (!st.households[f.household].dissolved) out.push(f.household);
    }
    for (const k of x.holds.get(id) || []) {
      const h = st.households[k],
        line = st.farmsteads[h.farmstead].line;
      if (!h.dissolved && h.holder === id && (line === null || line === undefined)) out.push(k);
    }
    return out;
  }
  function noteUnionEnd(st, u) {
    Graph.unwed(st, u.a, u.b);
    const x = st.idx;
    if (!x) return;
    x.widowed.add(u.a);
    x.widowed.add(u.b);
    if (x.spouse.get(u.a) === u.b) {
      x.spouse.delete(u.a);
      x.union.delete(u.a);
    }
    if (x.spouse.get(u.b) === u.a) {
      x.spouse.delete(u.b);
      x.union.delete(u.b);
    }
  }
  const unionOf = (st, id) => {
    const uid = index(st).union.get(id);
    return uid === undefined ? null : st.unions[uid];
  };
  // Everyone pawn id has been married to, in order of marriage (an ended union too: affinity outlives death).
  const spousesOf = (st, id) => index(st).spouses.get(id) || [];
  const wasWidowed = (st, id) => index(st).widowed.has(id);
  const holdingOf = (st, id) => {
    for (const k of index(st).holds.get(id) || []) {
      const h = st.households[k];
      if (!h.dissolved && h.holder === id) return h;
    }
    return null;
  };
  const isHolder = (st, id) => holdingOf(st, id) !== null;
  // Who speaks for pawn id in a match (design.md, Marriage as a negotiation: Who negotiates; VB-293): the holder of its household when it
  // lives there as a son or daughter of the house (a child of the holder, of the holder's spouse or of the holder's parent, not in service,
  // and not the holder); otherwise the pawn itself. O(1): the holder, its spouse and its two parents.
  // Under the custom `matchBy` (VB-826) 'couple' in the pawn's village every pawn speaks for itself.
  const matchByOf = (st, p) => inForce(st, 'matchBy', settlementIdOf(st, p));
  function spokesmanOf(st, id) {
    const p = st.pawns[id];
    if (p.household === null || p.servant) return id;
    if (matchByOf(st, p) === 'couple') return id;
    const hh = st.households[p.household],
      h = hh.holder;
    if (hh.dissolved || h === null || h === id) return id;
    const hp = st.pawns[h],
      sp = spouseOf(st, h),
      of = (q) => q !== null && (q === h || q === sp || q === hp.father || q === hp.mother);
    return of(p.father) || of(p.mother) ? h : id;
  }
  // Every custom in force at a settlement, by key (one object a call: for the readers that read several at once).
  const practice = (st, settlementId) => {
    const out = {};
    for (const d of Customs.DIMS) out[d.key] = inForce(st, d.key, settlementId);
    return out;
  };
  const farmPractice = (st, f) => practice(st, f.village);
  // An event of pawn id in its own words: one event on the record, and its position on the pawn (VB-199). With `false` for ev another
  // call records the happening, and this is the pawn's own telling of it (`self`), which only the pawn's life reads.
  function personEvent(st, id, kind, text, ev = {}) {
    record(
      st,
      ev
        ? { kind, pawn: id, text, ...ev }
        : { kind, pawn: id, text, village: settlementIdOf(st, st.pawns[id]), self: true },
    );
    st.pawns[id].events.push(st.record.length - 1);
  }
  const age = (st, p, t = st.t) => Math.floor((t - p.born) / YEAR);
  // ---- nobody leaves a small child alone (VB-1602) ----
  // Why pawn id may not go away from home, or null: it is at home, of CHILD.from (7) or over, and the only such member of its household
  // at home (not away: agent.away, sim/away), with a member under 7 at home too. One who minds a child does not leave (the verb lodge, a
  // gift's carrier, fetcher and hauler, a suitor's visit): the child cannot draw its water, cook nor go for its own drink, and the
  // gathering's rule (an adult stays with the animals and the fire) is every stay's. At most a household's members a call, asked
  // only where one is about to leave.
  function mindsWhy(st, id) {
    const p = st.pawns[id],
      hh = p.household === null ? null : st.households[p.household],
      from = VB['sim/roles'].CHILD.from;
    if (!hh || hh.dissolved || !p.alive || st.agents[id].away !== undefined || age(st, p) < from) return null;
    let child = false;
    for (const m of hh.members) {
      const q = st.pawns[m];
      if (m === id || !q.alive || !st.agents[m] || st.agents[m].away !== undefined) continue;
      if (age(st, q) >= from) return null;
      child = true;
    }
    if (!child) return null;
    VB.count.childMinded++;
    return `the last one at home with a child under ${from} does not leave it alone`;
  }
  const birthYear = (p) => Math.floor(p.born / YEAR) + 1;
  const fullName = (p) => `${p.given} ${p.patronym}`;
  function spouseOf(st, id, t = st.t) {
    if (t === st.t) {
      const sp = index(st).spouse.get(id);
      return sp === undefined ? null : sp;
    }
    const u = st.unions.find((u) => (u.a === id || u.b === id) && u.start <= t && (u.end === null || u.end > t));
    return u ? (u.a === id ? u.b : u.a) : null;
  }
  const childrenOf = (st, id) => [...(index(st).children.get(id) || [])];
  // The ancestors of `ids`, one to `generations` up (VB-224); each is reached first at its nearest generation, and walked from there.
  function ancestorsOf(st, ids, generations) {
    const out = new Set();
    for (let up = 0, gen = ids; up < generations && gen.length; up++) {
      const next = [];
      for (const id of gen)
        for (const q of [st.pawns[id].father, st.pawns[id].mother])
          if (q !== null && !out.has(q)) {
            out.add(q);
            next.push(q);
          }
      gen = next;
    }
    return out;
  }
  const siblingsOf = (st, id) => {
    const p = st.pawns[id];
    if (p.father === null && p.mother === null) return [];
    const ids = new Set([
      ...(p.father !== null ? childrenOf(st, p.father) : []),
      ...(p.mother !== null ? childrenOf(st, p.mother) : []),
    ]);
    ids.delete(id);
    return [...ids].sort((a, b) => a - b);
  };
  // Malécot's kinship coefficient: probability that genes drawn at random from a and b are identical by descent.
  function kinship(st, a, b, memo = new Map()) {
    if (a === null || b === null) return 0;
    const k = a < b ? a + ':' + b : b + ':' + a;
    if (memo.has(k)) return memo.get(k);
    let v;
    const pa = st.pawns[a],
      pb = st.pawns[b];
    if (a === b) v = 0.5 * (1 + kinship(st, pa.father, pa.mother, memo));
    else {
      const young = pa.born > pb.born ? pa : pb,
        other = young === pa ? b : a;
      v =
        young.father === null && young.mother === null
          ? 0
          : 0.5 * (kinship(st, young.father, other, memo) + kinship(st, young.mother, other, memo));
    }
    memo.set(k, v);
    return v;
  }
  // Civil degree of kin: for each common ancestor add the generations up from each person; the smallest sum.
  // 0 for a direct line, Infinity when no common ancestor is on record.
  function kinDegree(st, a, b) {
    if (a === b) return 0;
    const up = (id) => {
      // ancestor id -> fewest generations up from id, id itself 0
      const m = new Map([[id, 0]]);
      let front = [id];
      for (let g = 1; front.length; g++) {
        const next = [];
        for (const x of front)
          for (const q of [st.pawns[x].father, st.pawns[x].mother])
            if (q !== null && !m.has(q)) {
              m.set(q, g);
              next.push(q);
            }
        front = next;
      }
      return m;
    };
    const ua = up(a),
      ub = up(b);
    let best = Infinity;
    for (const [id, ga] of ua) {
      const gb = ub.get(id);
      if (gb === undefined) continue;
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
      if (st.farmsteads[hh.farmstead].village === sid)
        for (const m of hh.members) {
          const p = st.pawns[m];
          if (p.alive && p.household === hh.id) out.push(p);
        }
    }
    return out.sort((a, b) => a.id - b.id);
  }
  // How much p's voice counts at the meeting of settlement s, by its practice of the custom "voice": 0 or 1.
  function voiceOf(st, p, s) {
    if (!p.alive || p.age < 18) return 0;
    const v = inForce(st, 'voice', s.id);
    if (v === 'adults') return 1;
    const holder = isHolder(st, p.id);
    if (holder) return 1;
    if (v === 'heads') {
      const sp = spouseOf(st, p.id);
      return sp !== null && isHolder(st, sp) ? 1 : 0;
    }
    return 0;
  }
  // Guards of the commands' checks (VB-228), lookups on the register: why id is not a living pawn, or null; whether id is a live household.
  const living = (st, id) =>
    st.pawns[id] && st.pawns[id].died === null && st.agents[id] ? null : `pawn ${id} is not a living pawn`;
  const home = (st, id) => Number.isInteger(id) && st.households[id] && !st.households[id].dissolved;
  // Lookups on a pawn against its controller (pawn.control; sim/controller writes it, VB-1745): the planner's sites ask these two
  // (docs/review-life.md, section 2). commanded: a command of its controller's is queued or under way for the pawn, so nothing else moves
  // it. unplanned: that, or its automatic behaviour is off, so the planner gives it no work.
  const commanded = (st, id) => {
    const c = st.pawns[id] && st.pawns[id].control; // its controller (sim/controller, VB-1745), any pawn's
    return !!c && c.queue.length > 0;
  };
  const unplanned = (st, id) => {
    const c = st.pawns[id] && st.pawns[id].control;
    return !!c && (c.queue.length > 0 || !c.auto);
  };
  const settlement = (st, c) =>
    c.actor && st.cenv && st.cenv.settlements[c.actor.settlement]
      ? null
      : `there is no settlement ${c.actor && c.actor.settlement}`;
  return {
    settlement,
    commanded,
    unplanned,
    living,
    home,
    rebuildLiving,
    notePeopleCheck,
    takePeopleCheck,
    noteDeath,
    noteDissolved,
    person,
    marry,
    nameKit,
    makeHousehold,
    joinHousehold,
    leaveHousehold,
    clearMembers,
    setServant,
    personEvent,
    log,
    record,
    HISTORY,
    startFold,
    foldHistory,
    lifeEvent,
    atHousehold,
    atFarm,
    age,
    mindsWhy,
    birthYear,
    fullName,
    spouseOf,
    childrenOf,
    siblingsOf,
    kinship,
    kinDegree,
    kinNear,
    villageOf,
    settlementIdOf,
    isHolder,
    membersOf,
    voiceOf,
    holdingOf,
    noteHolder,
    noteUnionEnd,
    unionOf,
    wasWidowed,
    spousesOf,
    index,
    practice,
    farmPractice,
    noteLine,
    householdsOfLine,
    ancestorsOf,
    spokesmanOf,
    matchByOf,
  };
})();
