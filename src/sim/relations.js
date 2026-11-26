// @sys sim/relations: relationships between pawns: compatibility, opinion derived from kin, familiarity and memories, talk, company for the idle,
// and the people a pawn knows; owns opinion memories, bands and goodwill
VB['sim/relations'] = (() => {
  const { next: rnd } = VB['sim/rng'];
  const { DAY, YEAR, TICKS, GOODWILL, TRAITS, HANDOVER } = VB['sim/rules'],
    { MATCH } = VB['sim/roles'],
    { SOCIAL } = VB['sim/ties'];
  const Traits = VB['sim/traits'],
    { DIMS } = VB['sim/customs'];
  const { personEvent, fullName, spouseOf, settlementIdOf, age } = VB['sim/records'];
  const { partners, atHome } = VB['sim/encounters'];
  const { on, emit } = VB['sim/events'];
  const { issue } = VB['sim/commands'];
  const M = SOCIAL.memories; // the land's memories, from events (sim/stakes, sim/territory, sim/herds), are the three `on` below
  // ---- allowance (VB-216): how much one agent would give up to another in one deal, in rations, never below 0. Its context is
  //   {giver, receiver, from, to}: the two agents (pawn ids, or null for a household without a holder) and the two households, reused.
  //   Terms: grain above the floor (sim/hunger), goodwill and opinion (sim/exchange), the holder's own reserve (sim/help), the giver's
  //   mood (sim/exchange, VB-875).
  const Rules = VB['sim/registry'],
    ORDER = ['slack', 'goodwill', 'opinion', 'reserve', 'patron', 'mood'];
  Rules.declare({
    id: 'allowance',
    owner: 'sim/relations',
    combine: 'sum',
    base: () => 0,
    clamp: [0, Infinity],
    order: ORDER,
  });

  const Ties = VB['sim/ties'];
  const { scaleOf, tieOf, addTie } = Ties;
  const TIES = SOCIAL.ties;
  function initRelations(st, p) {
    Ties.initTies(st, p);
    p.rel = new Map();
    p.bands = new Map();
  }
  function grow(st, a, b, v) {
    addTie(st, a, b, v);
    addTie(st, b, a, v);
    touch(st, a, b);
    touch(st, b, a);
  } // both ties grow; bands checked
  function workedTogether(st, ids) {
    // the pawns `ids` finished one job together (sim/agents): each pair grows by TIES.work
    VB.count.tiePairs += (ids.length * (ids.length - 1)) / 2;
    for (let x = 0; x < ids.length; x++)
      for (let y = x + 1; y < ids.length; y++) {
        const i = ids[x],
          j = ids[y];
        if (st.pawns[i].alive && st.pawns[j].alive) grow(st, i, j, TIES.work);
      }
  }
  function dailyTies(st) {
    Ties.dailyTies(st, grow, touch);
  }
  // ---- compatibility (chemistry, VB-520; design.md, Chemistry): a function of the two pawns, nothing stored for the pair ----
  // The seeded personal term is fixed for a pair, from the world seed and the two ids, so it needs no memory.
  const mix = (h) => {
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
    return (h ^ (h >>> 16)) >>> 0;
  };
  const unit = (s, i, j) =>
    mix(Math.imul(s, 0x9e3779b1) ^ Math.imul(i + 1, 73856093) ^ Math.imul(j + 1, 19349663)) / 4294967296;
  // Likeness, friction and the customs between them (SOCIAL.chemistry): the traits read by index, the customs a byte each (culture's
  // pawn.leans), each custom weighed by 1 − its malleability (LEAN_W, over its sum).
  const CH = SOCIAL.chemistry,
    TI = Traits.IDX,
    ALIKE = [TI.generosity, TI.piety, TI.ambition, TI.honour, TI.sociability],
    LEAN_W = Float64Array.from(DIMS, (d) => 1 - d.m),
    LEAN_SUM = LEAN_W.reduce((x, y) => x + y, 0);
  const traitAt = (t, k) => (t ? t[k] : 0.5);
  // 1 for two alike in the four values and sociability, 0 at CH.span (two drawn at random), -1 at twice that
  function likeness(ta, tb) {
    let d = 0;
    for (let k = 0; k < ALIKE.length; k++) d += Math.abs(traitAt(ta, ALIKE[k]) - traitAt(tb, ALIKE[k]));
    return Math.max(-1, Math.min(1, (CH.span - d / ALIKE.length) / CH.span));
  }
  // the share of customs on which the two lean to different options, each weighed by 1 − its malleability; 0 without leanings
  function customsBetween(pa, pb) {
    const la = pa.leans,
      lb = pb.leans;
    if (!la || !lb || LEAN_SUM <= 0) return 0;
    let x = 0;
    for (let d = 0; d < LEAN_W.length; d++) if (la[d] !== lb[d]) x += LEAN_W[d];
    return x / LEAN_SUM;
  }
  // personal × the seeded term (-1..1, a triangle around 0) + likeness × likeness − friction × (the two tempers' sum − 1) − customs × the
  // customs between them; less 0.02 a year of age gap beyond 5 years, at most 0.4, none between a parent and a child; within -1..1. Allocates nothing.
  function compat(st, a, b) {
    const i = Math.min(a, b),
      j = Math.max(a, b),
      s = st.w.seed >>> 0,
      pi = st.pawns[i],
      pj = st.pawns[j];
    // a parent and a child owe no chemistry to the years between them: what sets a family against itself is what happened (VB-1125)
    const gap =
        pi.father === j || pi.mother === j || pj.father === i || pj.mother === i
          ? 0
          : Math.abs(pi.born - pj.born) / YEAR,
      personal = unit(s, i, j) + unit(s ^ 0x5bd1e995, j, i) - 1,
      friction = traitAt(pi.traits, TI.temper) + traitAt(pj.traits, TI.temper) - 1;
    const c =
      CH.personal * personal +
      CH.likeness * likeness(pi.traits, pj.traits) -
      CH.friction * friction -
      CH.customs * customsBetween(pi, pj);
    return Math.max(-1, Math.min(1, c - Math.min(0.4, Math.max(0, gap - 5) * 0.02)));
  }

  // ---- bond: what b is to a by the family records and the household: spouse, parent, child, sibling, housemate or null ----
  function bond(st, a, b) {
    const pa = st.pawns[a],
      pb = st.pawns[b];
    if (spouseOf(st, a) === b) return 'spouse';
    if (pa.father === b || pa.mother === b) return 'parent';
    if (pb.father === a || pb.mother === a) return 'child';
    if ((pa.father !== null && pa.father === pb.father) || (pa.mother !== null && pa.mother === pb.mother))
      return 'sibling';
    if (pa.household !== null && pa.household === pb.household) return 'housemate';
    return null;
  }
  const WORDS = {
    spouse: ['husband', 'wife'],
    parent: ['father', 'mother'],
    child: ['son', 'daughter'],
    sibling: ['brother', 'sister'],
    housemate: ['housemate', 'housemate'],
  };
  // b as a's husband, mother, brother..., or null
  const bondWord = (st, a, b) => {
    const k = bond(st, a, b);
    return k ? WORDS[k][st.pawns[b].sex === 'f' ? 1 : 0] : null;
  };

  // ---- opinion (VB-240; Kim, 10 Nov): derived, never stored: the kin bond, plus affinity, plus memories of things that happened ----
  // @state pawn.rel: Map of other pawn id to a's relationship record {mem: {kind: {v, t}}}; a record exists while it holds a memory of an
  //   event. kind is a key of SOCIAL.memories; v the memory's value at its last event, at game hour t. Empty for the dead.
  // @state pawn.bands: Map of other pawn id to a's band towards it as last checked, 1 (close friend) or -1 (enemy), only for pairs in one,
  //   so reaching one is told once. Checked for the pair touched (touch), never by a pass over pairs; empty for the dead.
  // A pair with one below the age of account (SOCIAL.account; VB-1106): chemistry counts between them only where it is liking, and
  // cross words with the child are a scolding or a squabble, no quarrel. What happened between them is remembered as between any two.
  const small = (pa, pb) => pa.age < SOCIAL.account || pb.age < SOCIAL.account;
  const memNow = (st, kind, m) => m.v * Math.max(0, 1 - (st.t - m.t) / (M[kind].days * DAY));
  const A = SOCIAL.affinity,
    affinity = (st, a, b, tie) => A.weight * compat(st, a, b) * Math.min(1, tie / A.known);
  // a's opinion of b, -1..1, a's tie to b being `tie`: the bond's value, plus affinity, plus the memories as they are now, plus
  // gratitude for what a owes b (one Map lookup; VB-220).
  function opinionAt(st, a, b, tie) {
    const pa = st.pawns[a],
      k = bond(st, a, b),
      r = pa.rel.get(b);
    let o = affinity(st, a, b, tie);
    if (o < 0 && small(pa, st.pawns[b])) o = 0; // nobody holds a small child's nature against it, nor does it yet hold another's (VB-1106)
    if (k) o += SOCIAL.situational[k];
    if (r) for (const kind in r.mem) o += memNow(st, kind, r.mem[kind]);
    if (GOODWILL.acts) o += gratitude(st, pa, b);
    o -= grudge(st, a, st.pawns[b]);
    return Math.max(-1, Math.min(1, o));
  }
  // The heir's grudge against a holder holding out past the custom's time (VB-1314; HANDOVER.grudge): a's opinion of b falls a little a
  // year since the household b holds came to expect a (household.expected, sim/marriage), up to HANDOVER.grudgeMax; ended with it. Two
  // lookups, no allocation: a holder lives in the household it holds.
  function grudge(st, a, pb) {
    const hh = pb.household === null ? null : st.households[pb.household];
    if (!hh || hh.holder !== pb.id) return 0;
    const e = hh.expected;
    return e && e.heir === a ? Math.min(HANDOVER.grudgeMax, (HANDOVER.grudge * (st.t - e.since)) / YEAR) : 0;
  }
  // a owes b s rations: +gratitude x s / (s + scale), fading as the balance decays; else 0
  const gratitude = (st, pa, b, e = pa.goodwill && pa.goodwill.get(b), s = e && e.v < 0 ? -goodwillNow(st, e) : 0) =>
    s < GOODWILL.forget ? 0 : (GOODWILL.gratitude * s) / (s + GOODWILL.scale);
  const opinionOf = (st, a, b) => opinionAt(st, a, b, tieOf(st, a, b));
  // close friend (1), enemy (-1) or neither (0): entered at SOCIAL.closeFriend and SOCIAL.enemy, left only SOCIAL.back past them
  const bandOf = (was, o) =>
    o >= SOCIAL.closeFriend || (was === 1 && o >= SOCIAL.closeFriend - SOCIAL.back)
      ? 1
      : o <= SOCIAL.enemy || (was === -1 && o <= SOCIAL.enemy + SOCIAL.back)
        ? -1
        : 0;
  // a's opinion of b may have moved: its tie grew (a talk, a job done together, hours at home, the season's kin floor), a memory came, or
  // the season's pass. The band is checked for this pair only; reaching close friends or enemies is a life event of a. A line crossed
  // lazily, as a tie or a memory fades, is told when the pair is next touched, dated then. Returns a's opinion of b as read.
  function touch(st, a, b) {
    const bands = st.pawns[a].bands,
      was = bands.get(b) || 0,
      o = opinionOf(st, a, b),
      now = bandOf(was, o);
    if (st.pawns[a].courting === b) emit(st, 'courtTouched', { a, b, o }); // the courting pair is read (sim/courting, VB-036)
    if (now === was) return o;
    if (now) bands.set(b, now);
    else bands.delete(b);
    if (now)
      personEvent(
        st,
        a,
        now > 0 ? 'closeFriend' : 'enemy',
        `${now > 0 ? 'Became close friends with' : 'Became the enemy of'} ` + fullName(st.pawns[b]),
        { other: b, village: settlementIdOf(st, st.pawns[a]) },
      );
    return o;
  }
  // a remembers an event with b: the memory of its kind gains v, up to its cap, and fades from now. A breach (TRAITS.breach) is felt by
  // a's honour, its v and cap 0.5 to 1.5 times (TRAITS.acts.honour.breach; VB-520). `gain`, if given, in place of the kind's v (a story's
  // hearsay, sim/stories: its value set by the telling).
  const BREACH = new Set(TRAITS.breach);
  function remember(st, a, b, kind, gain) {
    const rel = st.pawns[a].rel,
      r = rel.get(b) || rel.set(b, { mem: {} }).get(b),
      K = M[kind],
      m = r.mem[kind],
      felt = BREACH.has(kind) ? Traits.act(st, a, 'honour', 'breach') : 1;
    const sum = (m ? memNow(st, kind, m) : 0) + (gain ?? K.v) * felt,
      v = K.cap > 0 ? Math.min(K.cap * felt, sum) : Math.max(K.cap * felt, sum);
    if (m) {
      m.v = v;
      m.t = st.t;
    } else r.mem[kind] = { v, t: st.t };
    touch(st, a, b);
  }
  on('claimTaken', (st, e) => remember(st, e.loser, e.taker, 'claim'));
  on('borderLost', (st, e) => remember(st, e.loser, e.winner, 'border'));
  on('bullLent', (st, e) => remember(st, e.borrower, e.lender, 'bull'));
  on('cattleInCrop', (st, e) => remember(st, e.holder, e.keeper, 'crop'));
  on('helped', (st, e) => helped(st, e));
  // Helpers gave e.hours of help to household e.household (sim/hands; VB-106, VB-470): each knows each adult there better, by
  // MATCH.help.tie for each tieHours given, and both remember working together; the helper's life tells of the farm helped, once a day for a farm.
  // Credit follows the pawn who acted (VB-704; Kim, 16 Nov): the hours' worth (GOODWILL.hour a work hour) is booked to the helper, owed
  // by the head helped, and stays the helper's own wherever it goes; goods given stay booked between the two heads.
  function helped(st, e) {
    const hh = st.households[e.household],
      f = e.farm || st.farmsteads[hh.farmstead],
      H = MATCH.help,
      head = hh.holder !== null && st.pawns[hh.holder].alive ? hh.holder : null;
    for (const h of e.helpers) {
      if (head !== null && h !== head && st.pawns[h].alive && e.hours > 0) book(st, h, head, e.hours * GOODWILL.hour);
      for (const m of hh.members) {
        const q = st.pawns[m];
        if (m === h || !q.alive || age(st, q) < H.minAge) continue;
        grow(st, h, m, (H.tie * e.hours) / H.tieHours);
        remember(st, h, m, 'worked');
        remember(st, m, h, 'worked');
      }
      const ev = st.pawns[h].events,
        last = ev.length ? st.record[ev[ev.length - 1]] : null;
      if (last && last.kind === 'helped' && last.farm === f.id && Math.floor(last.t / DAY) === Math.floor(st.t / DAY))
        continue;
      personEvent(st, h, 'helped', `Helped at ${f.name}`, { farm: f.id, household: hh.id, village: f.village });
    }
  }
  // r keeps the memories of the kinds `keep` passes, copied in their order to a new object, not deleted from the old: a deleted key leaves
  // it a slow dictionary, and opinionOf reads every memory of every pair it weighs (VB-205; timed by tests/perf.js --engine). False if none is left.
  function sift(r, keep) {
    const mem = {};
    let n = 0;
    for (const k in r.mem)
      if (keep(k)) {
        mem[k] = r.mem[k];
        n++;
      }
    r.mem = mem;
    return n > 0;
  }
  // Once a season: memories that have faded away are forgotten, and records with none left, or about the dead, are dropped (a faded
  // memory counts 0 until then); the bands are checked again, those to the dead dropped.
  function fadeRelations(st) {
    for (const liveId of st.living) {
      const p = st.pawns[liveId];
      if (!p.alive) continue;
      for (const [j, r] of p.rel)
        if (!st.pawns[j].alive || !sift(r, (k) => memNow(st, k, r.mem[k]) !== 0)) p.rel.delete(j);
      for (const j of p.bands.keys())
        if (!st.pawns[j].alive) p.bands.delete(j);
        else touch(st, liveId, j);
    }
  }
  // A pawn's death ends the relationships of others with it (a band of one it had no tie to goes at the season's pass).
  function forget(st, id) {
    const p = st.pawns[id];
    for (const m of [p.rel, p.bands, p.ties])
      for (const j of m.keys()) {
        const q = st.pawns[j];
        if (q.rel) q.rel.delete(id);
        if (q.bands) q.bands.delete(id);
      }
    p.rel.clear();
    p.bands.clear();
  }

  // ---- talk: at its turn in the waking hours a pawn may start one talk, with a partner sim/encounters finds for it (VB-061, VB-521) ----
  const T = SOCIAL.talk;
  const young = (st, p) => p.age >= T.young[0] && p.age <= T.young[1] && spouseOf(st, p.id) === null;
  const able = (st, a) => {
    const p = st.pawns[a.id];
    return p.alive && p.age >= T.minAge && !a.carry;
  };
  // Scratch for the hourly round (derived, not state): busy[id] === round marks a pawn talking this hour; found holds the partners of
  // one pawn (sim/encounters fills it).
  let busy = new Int32Array(1024),
    round = 0;
  const found = [];
  // How much a would rather talk with b: more with the familiar and the liked, less with someone it dislikes. sa is a's tie scale (scaleOf).
  function talkWeight(st, a, b, ya, sa) {
    const tie = (st.pawns[a].ties.get(b) || 0) * sa;
    return (1 + Math.min(tie, 1)) * (1 + opinionAt(st, a, b, tie)) * (ya && young(st, st.pawns[b]) ? T.youngBonus : 1);
  }
  // The talk turns (VB-521; design.md, Where pawns meet): the living bucketed by id % T.every, each in the order of st.living; a cache
  // derived from st.living, written only here, rebuilt when the living have changed (their array, its length or its last id: ids only
  // grow, so a list of the same length and last id is the same list).
  const turns = { of: null, n: -1, last: -1, every: 0, by: [] };
  function turnsOf(st) {
    const L = st.living,
      last = L.length ? L[L.length - 1] : -1;
    if (turns.of !== L || turns.n !== L.length || turns.last !== last || turns.every !== T.every) {
      turns.of = L;
      turns.n = L.length;
      turns.last = last;
      turns.every = T.every;
      turns.by = Array.from({ length: T.every }, () => []);
      VB.count.talkBucket += L.length;
      for (const id of L) turns.by[id % T.every].push(id);
    }
    return turns.by;
  }
  // Waking hour h: the pawns whose talk turn it is ((h + id) % T.every is 0) each count the T.every hours to their next turn in their
  // house, if they are in it (pawn.homeHours, for dailyTies); then, from a random one on, each starts a talk at chance T.chance with a
  // partner sim/encounters finds, unless already talking this hour. Anyone may be drawn as a partner in any hour, once.
  const cand = [],
    wts = [];
  function talkHour(st, h, near) {
    if (h < T.from || h >= T.to) return;
    const ag = st.agents,
      ids = turnsOf(st)[(T.every - (h % T.every)) % T.every],
      n = ids.length;
    VB.count.talkTurn += n;
    for (const id of ids) if (atHome(st, ag[id])) Ties.countHomeHours(st.pawns[id]);
    const start = Math.floor(rnd(st.rng.talk) * n); // a random place in the turn, and on round it from there
    if (busy.length < ag.length) busy = new Int32Array(2 * ag.length);
    round++;
    let weighed = 0;
    for (let k = 0; k < n; k++) {
      const a = ag[ids[(start + k) % n]];
      if (
        busy[a.id] === round ||
        !able(st, a) ||
        rnd(st.rng.talk) >= Math.min(1, T.chance * Traits.act(st, a.id, 'sociability', 'talk'))
      )
        continue;
      const ya = young(st, st.pawns[a.id]),
        sa = scaleOf(st, st.pawns[a.id]);
      let tot = 0;
      cand.length = 0;
      wts.length = 0;
      const mix = partners(st, a, near, busy, round, found);
      for (const b of found) {
        if (!able(st, b)) continue;
        weighed++;
        const w = Math.max(0, talkWeight(st, a.id, b.id, ya, sa)) + mix;
        if (w > 0) {
          cand.push(b);
          wts.push(w);
          tot += w;
        }
      }
      if (!cand.length) continue;
      let x = rnd(st.rng.talk) * tot,
        i = 0;
      while (i < cand.length - 1 && (x -= wts[i]) > 0) i++;
      busy[a.id] = round;
      busy[cand[i].id] = round;
      talk(st, a, cand[i]);
    }
    VB.count.talkWeighed += weighed;
  }
  // A talk is a chat, a good talk or cross words, by the pair's compatibility, for its bubble; it leaves no memory (VB-240): their tie
  // grows, which shows their compatibility, and their bands are checked.
  // @state agent.talk: {with (pawn id), kind (chat, goodTalk or crossWords), at, until (game hours), friendAt (the hour of its last talk
  //   with one it held at SOCIAL.friend or above, as the talk's band check read it; absent before one)} or null; the latest talk, for the
  //   bubble, and talked with a friend for its mood (sim/mood, VB-062)
  const told = { a: -1, b: -1 };
  function talk(st, a, b) {
    const i = a.id,
      j = b.id,
      yy = young(st, st.pawns[i]) && young(st, st.pawns[j]);
    const c = Math.max(-1, Math.min(1, compat(st, i, j) + (bond(st, i, j) ? T.kin : 0)));
    const wg = T.good * Math.exp(2 * c) * (yy ? T.youngBonus : 1),
      wc = T.cross * Math.exp(-2 * c),
      x = rnd(st.rng.talk) * (1 + wg + wc);
    const kind = x < 1 ? 'chat' : x < 1 + wg ? 'goodTalk' : 'crossWords';
    const at = st.t + rnd(st.rng.talk) * T.bubbleHours,
      until = at + T.bubbleHours;
    addTie(st, i, j, TIES.talk); // grow's, with the opinions its band checks read kept for the talk's friend (VB-062)
    addTie(st, j, i, TIES.talk);
    const oi = touch(st, i, j),
      oj = touch(st, j, i);
    if (kind === 'crossWords') quarrelMaybe(st, i, j);
    else if (kind === 'goodTalk') emit(st, 'goodTalk', { a: i, b: j, oa: oi, ob: oj }); // two who like each other may court (sim/courting)
    const show = (g, other, o) => {
      const s = g.talk || (g.talk = {});
      s.with = other;
      s.kind = kind;
      s.at = at;
      s.until = until;
      if (o >= SOCIAL.friend) s.friendAt = at;
    };
    show(a, j, oi);
    show(b, i, oj);
    // an idle pawn outdoors stops where it is until the talk is over
    const halt = (g) => issue(st, { actor: g.id, verb: 'haltForTalk', args: { until }, source: 'talk' });
    halt(a);
    halt(b);
    st.talks++;
    told.a = i; // each side may tell a story (sim/stories, VB-523); the event's data reused, read at once
    told.b = j;
    emit(st, 'talked', told);
  }

  // Cross words become a quarrel (VB-520; design.md, The twelve traits: temper) at T.quarrel × the two tempers' sum, one draw of the talk
  // stream: both remember it (SOCIAL.memories.quarrel) and it is an event of the record, of i with j where i lives, for the stories to come.
  // Not with a child below the age of account (SOCIAL.account, VB-1106): cross words with one stay cross words, remembered by neither.
  function quarrelMaybe(st, i, j) {
    if (small(st.pawns[i], st.pawns[j])) return; // no draw
    if (rnd(st.rng.talk) >= T.quarrel * (Traits.of(st, i, 'temper') + Traits.of(st, j, 'temper'))) return;
    remember(st, i, j, 'quarrel');
    remember(st, j, i, 'quarrel');
    emit(st, 'quarrelled', { a: i, b: j }); // a story (sim/stories)
    personEvent(st, i, 'quarrel', `Quarrelled with ${fullName(st.pawns[j])}`, {
      other: j,
      village: settlementIdOf(st, st.pawns[i]),
    });
  }

  // ---- company: an idle pawn may join someone it likes who idles outdoors in its village ----
  // The idle pawns outdoors of each village as of the first ask in this game hour; companyFor checks that a pawn drawn from it still idles
  // outdoors. It is kept in the state, not a cache aside, because who is in it depends on when in the hour it was built: a run loaded
  // mid-hour must draw from the same list as the run that was saved (VB-074).
  // @state st.idlers: {hour, by: Map(village id -> agent ids[])} or absent; the idle pawns outdoors by village, as of the first ask in that hour
  const idles = (st, b) => !b.inside && !b.job && !b.homeward && !b.journey && st.pawns[b.id].alive;
  function idlersBy(st) {
    let c = st.idlers;
    const hour = Math.floor(st.tick / TICKS);
    if (!c || c.hour !== hour) {
      c = { hour, by: new Map() };
      for (const liveId of st.living) {
        const b = st.agents[liveId];
        if (!idles(st, b)) continue;
        const v = settlementIdOf(st, st.pawns[b.id]);
        if (v === null) continue;
        const l = c.by.get(v);
        if (l) l.push(b.id);
        else c.by.set(v, [b.id]);
      }
      st.idlers = c;
    }
    return c.by;
  }
  // Whom idle pawn a joins, at chance SOCIAL.seek: one of up to SOCIAL.seekSample idle pawns of its village, by liking (opinion + 0.05, so
  // never one it dislikes) and familiarity; null if none, and it strolls to the green or its yard as before.
  function companyFor(st, a) {
    if (rnd(st.rng.talk) >= SOCIAL.seek * Traits.act(st, a.id, 'sociability', 'seek')) return null; // 0.25 to 0.75 (VB-520)
    const v = settlementIdOf(st, st.pawns[a.id]),
      list = v === null ? null : idlersBy(st).get(v);
    if (!list || !list.length) return null;
    const p = st.pawns[a.id],
      sa = scaleOf(st, p);
    let tot = 0;
    cand.length = 0;
    wts.length = 0;
    VB.count.companyWeighed += SOCIAL.seekSample;
    for (let k = 0; k < SOCIAL.seekSample; k++) {
      const b = st.agents[list[Math.floor(rnd(st.rng.talk) * list.length)]];
      if (b === a || cand.includes(b) || !idles(st, b)) continue;
      const tie = (p.ties.get(b.id) || 0) * sa,
        w = Math.max(0, 0.05 + opinionAt(st, a.id, b.id, tie)) * (1 + Math.min(tie, 1));
      if (w > 0) {
        cand.push(b);
        wts.push(w);
        tot += w;
      }
    }
    if (!cand.length) return null;
    let x = rnd(st.rng.talk) * tot,
      i = 0;
    while (i < cand.length - 1 && (x -= wts[i]) > 0) i++;
    return cand[i];
  }

  // ---- goodwill (VB-217; design.md, The gift): one signed balance per pair of pawns that have dealt, in customary rations ----
  // @state pawn.goodwill: Map of the other pawn's id to {v, t}, made at the pawn's first booking and written only here: v > 0 means the
  //   other owes this pawn v rations as of game hour t, read as v halved every GOODWILL.halfLife years since t (decay when read; Kim,
  //   8 Nov). The other pawn holds {v: -v, t}. A balance under GOODWILL.forget reads as 0 and is dropped when either pawn next books,
  //   at GOODWILL.cap counterparts, or at a death, when the map goes too.
  const GW = GOODWILL;
  const goodwillNow = (st, e) => e.v * Math.pow(0.5, (st.t - e.t) / (GW.halfLife * YEAR));
  // what b owes a now (negative: what a owes b); 0 once forgotten
  function balance(st, a, b) {
    const g = st.pawns[a].goodwill,
      e = g && g.get(b);
    if (!e) return 0;
    const v = goodwillNow(st, e);
    return Math.abs(v) < GW.forget ? 0 : v;
  }
  function setPair(st, a, b, v) {
    const pa = st.pawns[a],
      pb = st.pawns[b];
    pa.goodwill ||= new Map();
    pb.goodwill ||= new Map();
    pa.goodwill.set(b, { v, t: st.t });
    pb.goodwill.set(a, { v: -v, t: st.t });
  }
  function dropPair(st, a, b) {
    const ga = st.pawns[a].goodwill,
      gb = st.pawns[b].goodwill;
    if (ga) ga.delete(b);
    if (gb) gb.delete(a);
  }
  // a's forgotten balances go, on both sides: at most GOODWILL.cap of them, when a books
  function dropForgotten(st, a) {
    const g = st.pawns[a].goodwill;
    if (!g) return;
    for (const [j, e] of g) if (Math.abs(goodwillNow(st, e)) < GW.forget) dropPair(st, a, j);
  }
  // Room for a new counterpart of a: at the cap, its smallest balance goes (the lower id on a tie).
  function makeRoom(st, a) {
    const g = st.pawns[a].goodwill;
    if (!g || g.size < GW.cap) return;
    let worst = -1,
      least = Infinity;
    for (const [j, e] of g) {
      const m = Math.abs(goodwillNow(st, e));
      if (m < least || (m === least && j < worst)) {
        least = m;
        worst = j;
      }
    }
    dropPair(st, a, worst);
  }
  // b owes a x rations more (x < 0: a owes b)
  function addGoodwill(st, a, b, x) {
    if (!Number.isFinite(x) || a === b || !st.pawns[a].alive || !st.pawns[b].alive)
      throw new Error(`goodwill: cannot add ${x} between ${a} and ${b}`);
    if (x === 0) return;
    dropForgotten(st, a);
    dropForgotten(st, b);
    const g = st.pawns[a].goodwill,
      e = g && g.get(b);
    if (!e) {
      makeRoom(st, a);
      makeRoom(st, b);
      setPair(st, a, b, x);
      return;
    }
    const v = goodwillNow(st, e) + x;
    if (v === 0) dropPair(st, a, b);
    else setPair(st, a, b, v);
  }
  // a gives b something worth `rations`: b owes a that much more
  function book(st, creditor, debtor, rations) {
    if (!(rations > 0)) throw new Error(`goodwill: cannot book ${rations}`);
    addGoodwill(st, creditor, debtor, rations);
    emit(st, 'goodwillBooked', { creditor, debtor }); // a debt paid down may end a follower's tie at once (sim/followers, VB-708)
  }
  // At a handover, `share` of each of from's balances passes to `to`; from keeps the rest (one with `to` itself is only reduced).
  function passGoodwill(st, from, to, share) {
    const g = st.pawns[from].goodwill;
    if (!g || from === to) return;
    for (const j of [...g.keys()]) {
      const e = g.get(j);
      if (!e) continue; // dropped while passing an earlier counterpart
      const v = goodwillNow(st, e);
      if (Math.abs(v) < GW.forget) {
        dropPair(st, from, j);
        continue;
      }
      const passed = v * share,
        kept = v - passed;
      if (kept === 0) dropPair(st, from, j);
      else setPair(st, from, j, kept);
      if (j !== to && st.pawns[j].alive) addGoodwill(st, to, j, passed);
    }
  }
  // A pawn's death ends its balances, on both sides; the dead keep no map, so the save does not grow with them.
  function endGoodwill(st, id) {
    const p = st.pawns[id],
      g = p.goodwill;
    if (!g) return;
    for (const j of g.keys()) {
      const q = st.pawns[j];
      if (q.goodwill) q.goodwill.delete(id);
    }
    delete p.goodwill;
  }
  // a pawn's balances not yet forgotten, for the panel and the tools: [{other, balance}], the largest first
  function goodwillOf(st, id) {
    const g = st.pawns[id].goodwill,
      out = [];
    if (g)
      for (const [j, e] of g) {
        const v = goodwillNow(st, e);
        if (Math.abs(v) >= GW.forget) out.push({ other: j, balance: v });
      }
    return out.sort((x, y) => Math.abs(y.balance) - Math.abs(x.balance) || x.other - y.other);
  }

  // ---- for the page and the tools ----
  const opinionWord = (o) =>
    o >= SOCIAL.closeFriend
      ? 'close friend'
      : o >= SOCIAL.friend
        ? 'friend'
        : o <= SOCIAL.enemy
          ? 'enemy'
          : o <= SOCIAL.dislike
            ? 'dislikes'
            : 'neutral';
  // The living people a pawn knows, by tie (most familiar first): {id, tie, opinion, bond}
  function relationsOf(st, id) {
    const p = st.pawns[id],
      ids = new Set([...p.ties.keys(), ...p.rel.keys()]),
      out = [];
    for (const j of ids) {
      if (!st.pawns[j].alive) continue;
      out.push({ id: j, tie: tieOf(st, id, j), opinion: opinionOf(st, id, j), bond: bond(st, id, j) });
    }
    return out.sort((x, y) => y.tie - x.tie || x.id - y.id);
  }
  // What a's opinion of b is made of now, largest first: [{label, value}], the bond first if there is one
  function reasonsOf(st, a, b) {
    const out = [],
      k = bond(st, a, b),
      r = st.pawns[a].rel.get(b);
    if (r) for (const kind in r.mem) out.push({ label: M[kind].label, value: memNow(st, kind, r.mem[kind]) });
    const f = affinity(st, a, b, tieOf(st, a, b));
    if (Math.abs(f) >= 0.005) out.push({ label: f > 0 ? 'Get on well' : 'Do not get on', value: f });
    const gr = GOODWILL.acts ? gratitude(st, st.pawns[a], b) : 0;
    if (gr > 0) out.push({ label: 'Owes us for help', value: gr });
    out.sort((x, y) => Math.abs(y.value) - Math.abs(x.value));
    if (k) out.unshift({ label: WORDS[k][st.pawns[b].sex === 'f' ? 1 : 0], value: SOCIAL.situational[k] });
    return out;
  }
  return {
    initRelations,
    workedTogether,
    dailyTies,
    compat,
    bond,
    bondWord,
    memNow,
    opinionOf,
    bandOf,
    touch,
    remember,
    fadeRelations,
    forget,
    talkHour,
    talkWeight,
    quarrelMaybe,
    companyFor,
    opinionWord,
    relationsOf,
    reasonsOf,
    balance,
    book,
    addGoodwill,
    passGoodwill,
    endGoodwill,
    goodwillOf,
  };
})();
