// @sys sim/relations: relationships between pawns: compatibility, opinion derived from kin, familiarity and memories, talk, company for the idle,
// and the people a pawn knows; owns familiarity (from talk, waking hours at home and work together, on a decay scale per pawn), memories and bands
VB['sim/relations'] = (() => {
  const { next: rnd } = VB['sim/rng'];
  const { DAY, YEAR, YEAR_DAYS, SEASON_DAYS, TICKS, SOCIAL, GOODWILL } = VB['sim/rules'];
  const { personEvent, fullName, spouseOf, settlementIdOf, kinNear, scaleOf, tieOf } = VB['sim/records'];
  const { on } = VB['sim/events'];
  const issue = (st, cmd) => VB['sim/commands'].issue(st, cmd); // sim/commands loads after this module
  const M = SOCIAL.memories;

  // ---- allowance (VB-216): how much one agent would give up to another in one deal, in rations, never below 0. Its context is
  //   {giver, receiver, from, to}: the two agents (pawn ids, or null for a household without a holder) and the giving and receiving
  //   households, an object the caller reuses. Contributions: the giving household's grain above its floor (sim/hunger) and its holder's
  //   own reserve (sim/help); goodwill's term comes with VB-217.
  const Rules = VB['sim/registry'];
  Rules.declare({ id: 'allowance', owner: 'sim/relations', combine: 'sum', base: () => 0, clamp: [0, Infinity], order: ['slack', 'goodwill', 'reserve'] });

  // ---- familiarity (VB-127): ties grow from talk, from waking hours at home and from work done together, and halve every year ----
  // A pawn's ties are stored on its own decay scale, so no step decays them (Rules for cost, 3): the tie now is the stored weight halved each
  // year since pawn.tieT (tieOf; Culture.dailyStep divides by their sum, so the scale cancels there), put back on today's scale every
  // TIES.renorm years, on a day spread by the pawn's id.
  // @state pawn.ties: Map of other pawn id to a's familiarity with it, stored on a's scale (tieOf); at most TIES.cap, the strongest, kin
  //   always kept. pawn.tieT: game hour from which they halve each year. pawn.homeHours: the waking hours (the talk hours) the pawn has spent
  //   in its house since midnight. All initialized and changed only here.
  const TIES = SOCIAL.ties; // scaleOf and tieOf, the reads, are in sim/records (read by sim/claims below this layer)
  function initRelations(st, p) { p.ties = new Map(); p.rel = new Map(); p.bands = new Map(); p.tieT = st.t; p.homeHours = 0; }
  // p's tie to b is stored as w. A new tie at the cap takes the place of the weakest not to kin (the earlier on a tie in weight), unless it is
  // weaker still and not to kin either; then it is not kept.
  function put(st, p, b, w) {
    if (p.ties.size >= TIES.cap && !p.ties.has(b)) {
      const kin = kinNear(st, p.id), isKin = kin.includes(b); let worst = -1, least = Infinity;
      VB.count.walkTies += p.ties.size; for (const [j, v] of p.ties) if (v < least && !kin.includes(j)) { least = v; worst = j; }
      if (worst < 0 && !isKin) return; // every tie is to kin, none may be dropped, and the new one is not to kin
      if (!isKin && w <= least) return; // not to kin, and no stronger than the weakest that may be dropped
      if (worst >= 0) p.ties.delete(worst); // the weakest that may be dropped goes; kin is kept, over the cap if all are kin
    }
    p.ties.set(b, w);
  }
  function addTie(st, a, b, v) { const p = st.pawns[a]; put(st, p, b, (p.ties.get(b) || 0) + v / scaleOf(st, p)); } // a's tie to b grows by v
  function raiseTie(st, a, b, v) { const p = st.pawns[a], w = v / scaleOf(st, p); if ((p.ties.get(b) || 0) < w) put(st, p, b, w); } // at least v
  // Keep the dead pawn's historical ties, but remove it from its contacts' ties (one who had dropped its own tie to them keeps theirs, read by
  // nobody, until they renormalise).
  function dropTies(st, id) { for (const [j] of st.pawns[id].ties) { const q = st.pawns[j]; if (q && q.ties) q.ties.delete(id); } }
  function grow(st, a, b, v) { addTie(st, a, b, v); addTie(st, b, a, v); touch(st, a, b); touch(st, b, a); } // both ties grow; bands checked
  function workedTogether(st, ids) { // the pawns `ids` finished one job together (sim/agents): each pair grows by TIES.work
    VB.count.tiePairs += ids.length * (ids.length - 1) / 2;
    for (let x = 0; x < ids.length; x++) for (let y = x + 1; y < ids.length; y++) {
      const i = ids[x], j = ids[y]; if (st.pawns[i].alive && st.pawns[j].alive) grow(st, i, j, TIES.work);
    }
  }
  // p's ties put back on today's scale; those under TIES.forget go, unless to kin (the floor raises them again), and those to the dead
  function renormalise(st, p) {
    const f = scaleOf(st, p), kin = kinNear(st, p.id), gone = (j, v) => !st.pawns[j].alive || (v < TIES.forget && !kin.includes(j));
    VB.count.walkTies += p.ties.size;
    for (const [j, w] of p.ties) { const v = w * f; if (gone(j, v)) p.ties.delete(j); else p.ties.set(j, v); } p.tieT = st.t;
  }
  // Once a day, at midnight: two housemates' tie grows by TIES.home per 24 waking hours both spent in their house (the lesser of their
  // hours); the pawns due put their ties back on today's scale, or raise their near kin to the floor (once a season, spread by id).
  function dailyTies(st) {
    for (const liveId of st.liveHouseholds) {
      const hh = st.households[liveId], m = hh.members; if (hh.dissolved || m.length < 2) continue;
      VB.count.tiePairs += m.length * (m.length - 1) / 2;
      for (let x = 0; x < m.length; x++) for (let y = x + 1; y < m.length; y++) {
        const h = Math.min(st.pawns[m[x]].homeHours, st.pawns[m[y]].homeHours) * TIES.home / DAY;
        if (h > 0) grow(st, m[x], m[y], h);
      }
    }
    const day = Math.floor(st.t / DAY), every = TIES.renorm * YEAR_DAYS;
    VB.count.walkDaily += st.living.length;
    for (const id of st.living) {
      const p = st.pawns[id]; p.homeHours = 0;
      if ((day - id) % every === 0) renormalise(st, p); // pawn id on day id, and every TIES.renorm years after
      if ((day + id) % SEASON_DAYS === 0) for (const q of kinNear(st, id)) if (st.pawns[q].alive) { floorKin(st, id, q); touch(st, id, q); }
    }
  }
  // a's tie to its near kin b is raised to the floor and a season's fading: so it stays at the floor or above until a's next turn
  function floorKin(st, a, b) { raiseTie(st, a, b, TIES.kin * Math.pow(2, SEASON_DAYS / YEAR_DAYS)); }
  // An older save: its ties are today's values, on a scale from now; one over the cap keeps its strongest, kin always kept. One before
  // VB-240 loses the memories of talk (a record left with none goes), and its bands are set from the opinion now, as no news.
  function migrateTies(st) {
    for (const p of st.pawns) if (p.ties && p.tieT === undefined) {
      p.tieT = st.t; p.homeHours = 0;
      if (p.alive && p.ties.size > TIES.cap) { const old = [...p.ties]; p.ties = new Map(); for (const [j, w] of old) put(st, p, j, w); }
      if (p.alive) for (const q of kinNear(st, p.id)) if (st.pawns[q].alive) floorKin(st, p.id, q);
    }
    const old = st.pawns.filter((p) => p.rel && !p.bands);
    for (const p of old) { p.bands = new Map(); for (const [j, r] of p.rel) if (!sift(r, (k) => M[k])) p.rel.delete(j); }
    for (const p of old) if (p.alive) for (const j of new Set([...p.ties.keys(), ...p.rel.keys()])) {
      const band = st.pawns[j].alive ? bandOf(0, opinionOf(st, p.id, j)) : 0; if (band) p.bands.set(j, band);
    }
  }
  // ---- compatibility: fixed for a pair, from the world seed and the two ids, so it needs no memory; a large age gap lowers it ----
  const mix = (h) => {
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b); h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
    return (h ^ (h >>> 16)) >>> 0;
  };
  const unit = (s, i, j) => mix(Math.imul(s, 0x9e3779b1) ^ Math.imul(i + 1, 73856093) ^ Math.imul(j + 1, 19349663)) / 4294967296;
  // -1..1, shaped like a triangle around 0; less by 0.02 a year of age gap beyond 5 years, at most 0.4
  function compat(st, a, b) {
    const i = Math.min(a, b), j = Math.max(a, b), s = st.w.seed >>> 0;
    const gap = Math.abs(st.pawns[i].born - st.pawns[j].born) / YEAR;
    return Math.max(-1, unit(s, i, j) + unit(s ^ 0x5bd1e995, j, i) - 1 - Math.min(0.4, Math.max(0, gap - 5) * 0.02));
  }

  // ---- standing: what b is to a by the family records and the household: spouse, parent, child, sibling, housemate or null ----
  function standing(st, a, b) {
    const pa = st.pawns[a], pb = st.pawns[b];
    if (spouseOf(st, a) === b) return 'spouse';
    if (pa.father === b || pa.mother === b) return 'parent';
    if (pb.father === a || pb.mother === a) return 'child';
    if ((pa.father !== null && pa.father === pb.father) || (pa.mother !== null && pa.mother === pb.mother)) return 'sibling';
    if (pa.household !== null && pa.household === pb.household) return 'housemate';
    return null;
  }
  const WORDS = { spouse: ['husband', 'wife'], parent: ['father', 'mother'], child: ['son', 'daughter'], sibling: ['brother', 'sister'],
    housemate: ['housemate', 'housemate'] };
  // b as a's husband, mother, brother..., or null
  const standingWord = (st, a, b) => { const k = standing(st, a, b); return k ? WORDS[k][st.pawns[b].sex === 'f' ? 1 : 0] : null; };

  // ---- opinion (VB-240; Kim, 10 Nov): derived, never stored: kin standing, plus affinity, plus memories of things that happened ----
  // @state pawn.rel: Map of other pawn id to a's relationship record {mem: {kind: {v, t}}}; a record exists while it holds a memory of an
  //   event. kind is a key of SOCIAL.memories; v the memory's value at its last event, at game hour t. Empty for the dead.
  // @state pawn.bands: Map of other pawn id to a's band towards it as last checked, 1 (close friend) or -1 (enemy), only for pairs in one,
  //   so reaching one is told once. Checked for the pair touched (touch), never by a pass over pairs; empty for the dead.
  const memNow = (st, kind, m) => m.v * Math.max(0, 1 - (st.t - m.t) / (M[kind].days * DAY));
  const A = SOCIAL.affinity, affinity = (st, a, b, tie) => A.weight * compat(st, a, b) * Math.min(1, tie / A.known);
  // a's opinion of b, -1..1, a's tie to b being `tie`: the standing's value, plus affinity (compatibility, shown as the two grow familiar),
  // plus the memories, as they are now. Goodwill's gratitude (VB-220) is to add to the same sum.
  function opinionAt(st, a, b, tie) {
    const k = standing(st, a, b), r = st.pawns[a].rel.get(b);
    let o = (k ? SOCIAL.situational[k] : 0) + affinity(st, a, b, tie);
    if (r) for (const kind in r.mem) o += memNow(st, kind, r.mem[kind]);
    return Math.max(-1, Math.min(1, o));
  }
  const opinionOf = (st, a, b) => opinionAt(st, a, b, tieOf(st, a, b));
  // close friend (1), enemy (-1) or neither (0): entered at SOCIAL.closeFriend and SOCIAL.enemy, left only SOCIAL.back past them
  const bandOf = (was, o) => (o >= SOCIAL.closeFriend || (was === 1 && o >= SOCIAL.closeFriend - SOCIAL.back) ? 1
    : o <= SOCIAL.enemy || (was === -1 && o <= SOCIAL.enemy + SOCIAL.back) ? -1 : 0);
  // a's opinion of b may have moved: its tie grew (a talk, a job done together, the day's hours at home, the season's kin floor), a memory
  // came, or the season's pass. The band is checked for this pair only; reaching close friends or enemies is a life event of a. A line
  // crossed lazily, as a tie or a memory fades, is told when the pair is next touched, dated then.
  function touch(st, a, b) {
    const bands = st.pawns[a].bands, was = bands.get(b) || 0, now = bandOf(was, opinionOf(st, a, b));
    if (now === was) return;
    if (now) bands.set(b, now); else bands.delete(b);
    if (now) personEvent(st, a, now > 0 ? 'closeFriend' : 'enemy', `${now > 0 ? 'Became close friends with' : 'Became the enemy of'} `
      + fullName(st.pawns[b]), { other: b, village: settlementIdOf(st, st.pawns[a]) });
  }
  // a remembers an event with b: the memory of its kind gains v, up to its cap, and fades from now
  function remember(st, a, b, kind) {
    const rel = st.pawns[a].rel, r = rel.get(b) || rel.set(b, { mem: {} }).get(b), K = M[kind], m = r.mem[kind];
    const sum = (m ? memNow(st, kind, m) : 0) + K.v, v = K.cap > 0 ? Math.min(K.cap, sum) : Math.max(K.cap, sum);
    if (m) { m.v = v; m.t = st.t; } else r.mem[kind] = { v, t: st.t };
    touch(st, a, b);
  }
  // The land's memories (sim/stakes, sim/territory, sim/herds emit; they load below this module): the loser remembers the taker, the favour is
  // remembered by the borrower.
  on('claimTaken', (st, e) => remember(st, e.loser, e.taker, 'claim'));
  on('borderLost', (st, e) => remember(st, e.loser, e.winner, 'border'));
  on('bullLent', (st, e) => remember(st, e.borrower, e.lender, 'bull'));
  // r keeps the memories of the kinds `keep` passes, copied in their order to a new object, not deleted from the old: a deleted key leaves
  // it a slow dictionary, and opinionOf reads every memory of every pair it weighs (VB-205). False if none is left.
  function sift(r, keep) { const mem = {}; let n = 0; for (const k in r.mem) if (keep(k)) { mem[k] = r.mem[k]; n++; } r.mem = mem; return n > 0; }
  // Once a season: memories that have faded away are forgotten, and records with none left, or about the dead, are dropped (a faded
  // memory counts 0 until then); the bands are checked again, those to the dead dropped.
  function fadeRelations(st) {
    for (const liveId of st.living) {
      const p = st.pawns[liveId]; if (!p.alive) continue;
      for (const [j, r] of p.rel) if (!st.pawns[j].alive || !sift(r, (k) => memNow(st, k, r.mem[k]) !== 0)) p.rel.delete(j);
      for (const j of p.bands.keys()) if (!st.pawns[j].alive) p.bands.delete(j); else touch(st, liveId, j);
    }
  }
  // A pawn's death ends the relationships of others with it (a band of one it had no tie to goes at the season's pass).
  function forget(st, id) {
    const p = st.pawns[id];
    for (const m of [p.rel, p.bands, p.ties]) for (const j of m.keys()) { const q = st.pawns[j]; if (q.rel) q.rel.delete(id); if (q.bands) q.bands.delete(id); }
    p.rel.clear(); p.bands.clear();
  }

  // ---- talk: in each waking hour a pawn may start one talk, with a pawn in its house or near it outdoors (VB-061) ----
  const T = SOCIAL.talk;
  const young = (st, p) => p.age >= T.young[0] && p.age <= T.young[1] && spouseOf(st, p.id) === null;
  const able = (st, a) => { const p = st.pawns[a.id]; return p.alive && p.age >= T.minAge && !a.carry; };
  // Scratch for the hourly round (derived, not state): busy[id] === round marks a pawn talking this hour, seen[id] === look a pawn already
  // drawn as a partner; found holds the partners of one pawn.
  let busy = new Int32Array(1024), seen = new Int32Array(1024), round = 0, look = 0;
  const found = [], lists = [];
  // Who a could talk with, into `found`: the housemates in the house with it; outdoors, up to T.sample pawns drawn from the cells around
  // it (`near`, from outdoors in sim/society), within near.size in x and y. Pawns talking already this hour are left out.
  function partnersOf(st, a, near) {
    found.length = 0;
    if (a.inside) {
      const hh = st.households[st.pawns[a.id].household];
      if (hh) for (const m of hh.members) if (m !== a.id && st.agents[m].inside && busy[m] !== round) found.push(st.agents[m]);
      return;
    }
    const S = near.size, cx = Math.floor(a.x / S), cy = Math.floor(a.y / S);
    let n = 0; lists.length = 0; look++; seen[a.id] = look;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      const l = near.cells.get(near.cellOf(cx + dx, cy + dy)); if (l) { lists.push(l); n += l.length; }
    }
    const draws = n <= T.sample + 1 ? n : T.sample;
    for (let d = 0; d < draws; d++) {
      let k = draws === n ? d : Math.floor(rnd(st.rng.talk) * n), b = null;
      for (const l of lists) { if (k < l.length) { b = near.out[l[k]]; break; } k -= l.length; }
      if (seen[b.id] === look) continue;
      seen[b.id] = look;
      if (busy[b.id] !== round && Math.abs(a.x - b.x) < S && Math.abs(a.y - b.y) < S) found.push(b);
    }
  }
  // How much a would rather talk with b: more with the familiar and the liked, less with someone it dislikes. sa is a's tie scale (scaleOf).
  function talkWeight(st, a, b, ya, sa) {
    const tie = (st.pawns[a].ties.get(b) || 0) * sa;
    return (1 + Math.min(tie, 1)) * (1 + opinionAt(st, a, b, tie)) * (ya && young(st, st.pawns[b]) ? T.youngBonus : 1);
  }
  // Waking hour h: each pawn in its house counts the hour (pawn.homeHours, for dailyTies); then the pawns, from a random one on, each start a
  // talk at chance T.chance, unless already talking this hour.
  const cand = [], wts = [];
  function talkHour(st, h, near) {
    if (h < T.from || h >= T.to) return;
    const ag = st.agents, ids = st.living, n = ids.length;
    for (const id of ids) if (ag[id].inside) st.pawns[id].homeHours++;
    const start = Math.floor(rnd(st.rng.talk) * n); // a random place in the living, and on round them from there
    if (busy.length < ag.length) { busy = new Int32Array(2 * ag.length); seen = new Int32Array(2 * ag.length); }
    round++;
    let weighed = 0;
    for (let k = 0; k < n; k++) {
      const a = ag[ids[(start + k) % n]];
      if (busy[a.id] === round || !able(st, a) || rnd(st.rng.talk) >= T.chance) continue;
      const ya = young(st, st.pawns[a.id]), sa = scaleOf(st, st.pawns[a.id]);
      let tot = 0; cand.length = 0; wts.length = 0;
      partnersOf(st, a, near);
      for (const b of found) {
        if (!able(st, b)) continue;
        weighed++;
        const w = talkWeight(st, a.id, b.id, ya, sa); if (w > 0) { cand.push(b); wts.push(w); tot += w; }
      }
      if (!cand.length) continue;
      let x = rnd(st.rng.talk) * tot, i = 0;
      while (i < cand.length - 1 && (x -= wts[i]) > 0) i++;
      busy[a.id] = round; busy[cand[i].id] = round;
      talk(st, a, cand[i]);
    }
    VB.count.talkWeighed += weighed;
  }
  // A talk is a chat, a good talk or cross words, by the pair's compatibility, for its bubble; it leaves no memory (VB-240): their tie
  // grows, which shows their compatibility, and their bands are checked.
  // @state agent.talk: {with (pawn id), kind (chat, goodTalk or crossWords), at, until (game hours)} or null; the latest talk, for the bubble
  function talk(st, a, b) {
    const i = a.id, j = b.id, yy = young(st, st.pawns[i]) && young(st, st.pawns[j]);
    const c = Math.max(-1, Math.min(1, compat(st, i, j) + (standing(st, i, j) ? T.kin : 0)));
    const wg = T.good * Math.exp(2 * c) * (yy ? T.youngBonus : 1), wc = T.cross * Math.exp(-2 * c), x = rnd(st.rng.talk) * (1 + wg + wc);
    const kind = x < 1 ? 'chat' : x < 1 + wg ? 'goodTalk' : 'crossWords';
    const at = st.t + rnd(st.rng.talk) * T.bubbleHours, until = at + T.bubbleHours;
    grow(st, i, j, TIES.talk);
    const show = (g, other) => { const s = g.talk || (g.talk = {}); s.with = other; s.kind = kind; s.at = at; s.until = until; };
    show(a, j); show(b, i);
    // an idle pawn outdoors stops where it is until the talk is over
    const halt = (g) => issue(st, { actor: g.id, verb: 'haltForTalk', args: { until }, source: 'talk' });
    halt(a); halt(b);
    st.talks++;
  }

  // ---- company: an idle pawn may join someone it likes who idles outdoors in its village ----
  // The idle pawns outdoors of each village as of the first ask in this game hour; companyFor checks that a pawn drawn from it still idles
  // outdoors. It is kept in the state, not a cache aside, because who is in it depends on when in the hour it was built: a run loaded
  // mid-hour must draw from the same list as the run that was saved (VB-074).
  // @state st.idlers: {hour, by: Map(village id -> agents[])} or absent; the idle pawns outdoors by village, as of the first ask in that hour
  const idles = (st, b) => !b.inside && !b.job && b.phase === null && st.pawns[b.id].alive;
  function idlersBy(st) {
    let c = st.idlers;
    const hour = Math.floor(st.tick / TICKS);
    if (!c || c.hour !== hour) {
      c = { hour, by: new Map() };
      for (const liveId of st.living) {
        const b = st.agents[liveId];
        if (!idles(st, b)) continue;
        const v = settlementIdOf(st, st.pawns[b.id]); if (v === null) continue;
        const l = c.by.get(v); if (l) l.push(b); else c.by.set(v, [b]);
      }
      st.idlers = c;
    }
    return c.by;
  }
  // Whom idle pawn a joins, at chance SOCIAL.seek: one of up to SOCIAL.seekSample idle pawns of its village, by liking (opinion + 0.05, so
  // never one it dislikes) and familiarity; null if none, and it strolls to the green or its yard as before.
  function companyFor(st, a) {
    if (rnd(st.rng.talk) >= SOCIAL.seek) return null;
    const v = settlementIdOf(st, st.pawns[a.id]), list = v === null ? null : idlersBy(st).get(v);
    if (!list || !list.length) return null;
    const p = st.pawns[a.id], sa = scaleOf(st, p);
    let tot = 0; cand.length = 0; wts.length = 0;
    VB.count.companyWeighed += SOCIAL.seekSample;
    for (let k = 0; k < SOCIAL.seekSample; k++) {
      const b = list[Math.floor(rnd(st.rng.talk) * list.length)];
      if (b === a || cand.includes(b) || !idles(st, b)) continue;
      const tie = (p.ties.get(b.id) || 0) * sa, w = Math.max(0, 0.05 + opinionAt(st, a.id, b.id, tie)) * (1 + Math.min(tie, 1));
      if (w > 0) { cand.push(b); wts.push(w); tot += w; }
    }
    if (!cand.length) return null;
    let x = rnd(st.rng.talk) * tot, i = 0;
    while (i < cand.length - 1 && (x -= wts[i]) > 0) i++;
    return cand[i];
  }

  // ---- goodwill (VB-217; design.md, The gift): one signed balance per pair of pawns that have dealt, in customary rations ----
  // @state pawn.goodwill: Map of the other pawn's id to {v, t}, made at the pawn's first booking and written only here: v > 0 means the
  //   other owes this pawn v rations as of game hour t. It is read as v halved every GOODWILL.halfLife years since t, so no step decays
  //   it (Kim, 8 Nov: decay when read). The other pawn holds {v: -v, t}. A balance read under GOODWILL.forget is forgotten: it reads as 0,
  //   and is dropped when either pawn next books, when a pawn has GOODWILL.cap counterparts, or at a death, when the map goes too.
  const GW = GOODWILL;
  const goodwillNow = (st, e) => e.v * Math.pow(0.5, (st.t - e.t) / (GW.halfLife * YEAR));
  // what b owes a now (negative: what a owes b); 0 once forgotten
  function balance(st, a, b) {
    const g = st.pawns[a].goodwill, e = g && g.get(b); if (!e) return 0;
    const v = goodwillNow(st, e); return Math.abs(v) < GW.forget ? 0 : v;
  }
  function setPair(st, a, b, v) {
    const pa = st.pawns[a], pb = st.pawns[b];
    if (!pa.goodwill) pa.goodwill = new Map();
    if (!pb.goodwill) pb.goodwill = new Map();
    pa.goodwill.set(b, { v, t: st.t }); pb.goodwill.set(a, { v: -v, t: st.t });
  }
  function dropPair(st, a, b) { const ga = st.pawns[a].goodwill, gb = st.pawns[b].goodwill; if (ga) ga.delete(b); if (gb) gb.delete(a); }
  // a's forgotten balances go, on both sides: at most GOODWILL.cap of them, when a books
  function dropForgotten(st, a) {
    const g = st.pawns[a].goodwill; if (!g) return;
    for (const [j, e] of g) if (Math.abs(goodwillNow(st, e)) < GW.forget) dropPair(st, a, j);
  }
  // Room for a new counterpart of a: at the cap, its smallest balance goes (the lower id on a tie).
  function makeRoom(st, a) {
    const g = st.pawns[a].goodwill; if (!g || g.size < GW.cap) return;
    let worst = -1, least = Infinity;
    for (const [j, e] of g) { const m = Math.abs(goodwillNow(st, e)); if (m < least || (m === least && j < worst)) { least = m; worst = j; } }
    dropPair(st, a, worst);
  }
  // b owes a x rations more (x < 0: a owes b)
  function addGoodwill(st, a, b, x) {
    if (!Number.isFinite(x) || a === b || !st.pawns[a].alive || !st.pawns[b].alive) throw new Error(`goodwill: cannot add ${x} between ${a} and ${b}`);
    if (x === 0) return;
    dropForgotten(st, a); dropForgotten(st, b);
    const g = st.pawns[a].goodwill, e = g && g.get(b);
    if (!e) { makeRoom(st, a); makeRoom(st, b); setPair(st, a, b, x); return; }
    const v = goodwillNow(st, e) + x;
    if (v === 0) dropPair(st, a, b); else setPair(st, a, b, v);
  }
  // a gives b something worth `rations`: b owes a that much more
  function book(st, creditor, debtor, rations) {
    if (!(rations > 0)) throw new Error(`goodwill: cannot book ${rations}`);
    addGoodwill(st, creditor, debtor, rations);
  }
  // At a handover, `share` of each of from's balances passes to `to`; from keeps the rest. A balance with `to` itself is only reduced; a
  // forgotten one goes.
  function passGoodwill(st, from, to, share) {
    const g = st.pawns[from].goodwill; if (!g || from === to) return;
    for (const j of [...g.keys()]) {
      const e = g.get(j); if (!e) continue; // dropped while passing an earlier counterpart
      const v = goodwillNow(st, e);
      if (Math.abs(v) < GW.forget) { dropPair(st, from, j); continue; }
      const passed = v * share, kept = v - passed;
      if (kept === 0) dropPair(st, from, j); else setPair(st, from, j, kept);
      if (j !== to && st.pawns[j].alive) addGoodwill(st, to, j, passed);
    }
  }
  // A pawn's death ends its balances, on both sides; the dead keep no map, so the save does not grow with them.
  function endGoodwill(st, id) {
    const p = st.pawns[id], g = p.goodwill; if (!g) return;
    for (const j of g.keys()) { const q = st.pawns[j]; if (q.goodwill) q.goodwill.delete(id); }
    delete p.goodwill;
  }
  // a pawn's balances not yet forgotten, for the panel and the tools: [{other, balance}], the largest first
  function goodwillOf(st, id) {
    const g = st.pawns[id].goodwill, out = [];
    if (g) for (const [j, e] of g) { const v = goodwillNow(st, e); if (Math.abs(v) >= GW.forget) out.push({ other: j, balance: v }); }
    return out.sort((x, y) => Math.abs(y.balance) - Math.abs(x.balance) || x.other - y.other);
  }

  // ---- for the page and the tools ----
  const opinionWord = (o) => (o >= SOCIAL.closeFriend ? 'close friend' : o >= SOCIAL.friend ? 'friend' : o <= SOCIAL.enemy ? 'enemy'
    : o <= SOCIAL.dislike ? 'dislikes' : 'neutral');
  // The living people a pawn knows, by tie (most familiar first): {id, tie, opinion, standing}
  function relationsOf(st, id) {
    const p = st.pawns[id], ids = new Set([...p.ties.keys(), ...p.rel.keys()]), out = [];
    for (const j of ids) {
      if (!st.pawns[j].alive) continue;
      out.push({ id: j, tie: tieOf(st, id, j), opinion: opinionOf(st, id, j), standing: standing(st, id, j) });
    }
    return out.sort((x, y) => y.tie - x.tie || x.id - y.id);
  }
  // What a's opinion of b is made of now, largest first: [{label, value}], the standing first if there is one
  function reasonsOf(st, a, b) {
    const out = [], k = standing(st, a, b), r = st.pawns[a].rel.get(b);
    if (r) for (const kind in r.mem) out.push({ label: M[kind].label, value: memNow(st, kind, r.mem[kind]) });
    const f = affinity(st, a, b, tieOf(st, a, b)); if (Math.abs(f) >= 0.005) out.push({ label: f > 0 ? 'Get on well' : 'Do not get on', value: f });
    out.sort((x, y) => Math.abs(y.value) - Math.abs(x.value));
    if (k) out.unshift({ label: WORDS[k][st.pawns[b].sex === 'f' ? 1 : 0], value: SOCIAL.situational[k] });
    return out;
  }
  return {
    initRelations, tieOf, addTie, raiseTie, dropTies, workedTogether, renormalise, dailyTies, floorKin, migrateTies,
    compat, standing, standingWord, memNow, opinionOf, bandOf, touch, remember, fadeRelations, forget, talkHour, talkWeight, companyFor, opinionWord,
    relationsOf, reasonsOf, balance, book, addGoodwill, passGoodwill, endGoodwill, goodwillOf,
  };
})();
