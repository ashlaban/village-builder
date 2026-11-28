// @sys sim/stories [social]: stories (VB-523; design.md, Traits, talk and stories: Stories; Kim, 3 Nov, model B): an event worth telling, known first
// to those who were there, told in talk by its salience, believed by trust and fit, sharper at each retelling, forgotten untold; a believed
// story is remembered of its subject as hearsay (sim/relations); lies about an enemy, by pawns and the player (the verb slander), and
// their exposure by a hearer who knows better, the source of a counter-story about the liar (VB-554); what a pawn has heard, as its
// belief (heard, the actor view). Owns st.stories, st.storySeq and pawn.known.
VB['sim/stories'] = (() => {
  const { next: rnd } = VB['sim/rng'];
  const { DAY, TRAITS } = VB['sim/rules'];
  const { SOCIAL, tieOf } = VB['sim/ties'];
  const Traits = VB['sim/traits'];
  const { settlementIdOf, age, fullName, personEvent } = VB['sim/records'];
  const { on } = VB['sim/events'];
  const { remember, opinionOf, bond } = VB['sim/relations'];
  const { register, issue } = VB['sim/commands'];
  // @tunable STORY (design.md, Stories; the numbers Proposed 15 Nov from the experiment, docs/gossip-experiment.md):
  //   keep: stories a pawn holds; a story is told in a talk, by each side once, at `tell` × (0.5 + the teller's sociability), weighed by
  //   |v| × zeal × strength × `negative` for bad news × (1 + min(1, the hearer's tie to the subject / `knownTie`)) against `background`;
  //   told to one who holds it, the teller's zeal for that audience × `stifle`, not told under `quiet`; each retelling × (1 + `sharpen`),
  //   noise ± `noise`; belief at `belief` + 0.5 (trust − 0.5) + 0.5 fit; the hearsay memory the told valence × `hop` ^ hops, at most `cap`
  //   a subject, fading over `fade` days; strength halves every `half` days (`halfFirst` first-hand) / (0.5 + wits), forgotten under `forget`.
  //   kinds: the event of the record each is made from, its domain and its valence at the source, and what it says in words (% the other
  //   party); a later slice adds a kind by one line. `lied` (VB-554) is the counter-story about a liar, in every domain ('*'), its valence
  //   set at each exposure.
  //   lie: a pawn with an enemy invents a story about it at its talk turn at `lie` × 2(1 − honour) × (0.5 + ambition) (TRAITS.acts: honour
  //   and ambition `lie`; the design's 0.005 × (1 − honour), written so the honour factor is 1 at 0.5); counter: a lie exposed gives
  //   a counter-story of −min(1, `counter` × |the lie's valence| × (0.5 + the hearer's
  //   honour) × (0.5 + its culture's mean honour)) (TRAITS.acts.honour.judge). domains: the domain of each first-hand memory
  //   (SOCIAL.memories) a hearer may know better by; hearsay has none. `worked` is the law's good memory (one who worked beside the
  //   subject knows it pulls its weight) and a kin bond the kin domain's (sim/relations bond): the only good first-hand knowledge of the
  //   two domains the negative kinds are in.
  const STORY = {
    keep: 8,
    tell: 0.3,
    background: 1,
    negative: 1.3,
    knownTie: 8,
    stifle: 0.5,
    quiet: 0.05,
    sharpen: 0.08,
    noise: 0.05,
    belief: 0.6,
    hop: 0.8,
    cap: 0.4,
    fade: 120,
    half: 40,
    halfFirst: 120,
    forget: 0.2,
    lie: 0.0025,
    counter: 1.5,
    kinds: {
      claim: { event: 'claimTaken', domain: 'law', v: -0.5, words: 'took a claim from %' }, // a claim taken (sim/stakes)
      crop: { event: 'cattleInCrop', domain: 'law', v: -0.3, words: "let cattle into %'s crop" }, // cattle let into a crop (sim/byre)
      shirked: { event: 'stayedAway', domain: 'law', v: -0.2, words: 'stayed away from the work day' }, // a work day shirked (sim/workdays)
      refusedMatch: { event: 'matchRefused', domain: 'kin', v: -0.3, words: 'refused the match % offered' }, // a match refused (sim/marriage)
      quarrel: { event: 'quarrelled', domain: 'kin', v: -0.2, words: 'quarrelled with %' }, // a quarrel (sim/relations, VB-520)
      helped: { event: 'giftGiven', domain: 'dealings', v: 0.4, words: 'gave % grain in hunger' }, // help given in hunger (sim/exchange)
      ale: { event: 'alePoured', domain: 'dealings', v: 0.3, words: 'poured ale for the neighbours' }, // ale poured, a feast (sim/feast)
      lied: { event: 'lieExposed', domain: '*', v: -0.5, words: 'lied about %' }, // a lie exposed (below; VB-554)
    },
    domains: {
      claim: 'law',
      crop: 'law',
      stayedAway: 'law',
      border: 'law',
      worked: 'law',
      refusedMatch: 'kin',
      refusedCourting: 'kin',
      refusedSuit: 'kin',
      marriedAgainst: 'kin',
      quarrel: 'kin',
      bull: 'dealings',
      ale: 'dealings',
      refusedUs: 'dealings',
      refusedThem: 'dealings',
      hardBargain: 'dealings',
      lied: '*',
    },
  };
  // the kinds a lie may be of: the negative ones of the record's events, each drawn by |v| (VB-554)
  const TALES = Object.keys(STORY.kinds).filter((k) => STORY.kinds[k].v < 0 && k !== 'lied');
  // the memories a believed story leaves of its subject (sim/relations remember, given the value): declared here, beside their rule
  Object.assign(SOCIAL.memories, {
    heardIll: { label: 'Heard ill of them', v: -0.1, cap: -STORY.cap, days: STORY.fade },
    heardWell: { label: 'Heard well of them', v: 0.1, cap: STORY.cap, days: STORY.fade },
    lied: { label: 'Lied to me', v: -0.3, cap: -0.6, days: 3 * STORY.fade }, // a lie it knew better than, of the liar (VB-554)
  });
  // @state st.stories: Map of story id to {id, kind (a key of STORY.kinds), subject (pawn id), other (pawn id or null), t (game hour), v
  //   (the valence at the source), by (the pawn who first told it, null until told; a lie's inventor), held (how many living pawns hold
  //   it), and for a lie (VB-554) lie: true, why ('enemy' or 'player') and counter (the id of the counter-story about its inventor, once
  //   exposed)}; the live ones only: a story nobody holds is dropped. st.storySeq: the next story id (ids are never reused). Absent until
  //   the first story. The flag `lie` is read by expose and the reports only: no pawn's choice and no view.
  // @state pawn.known: [{story (id), v (the valence as heard), hops (the mouths it came through, 0 first-hand), s (strength at t), t (game
  //   hour last told or heard), zeal: [home, away] (for an audience of the pawn's own village, of another), first (known first-hand), from
  //   (the pawn it last heard it from, VB-554; null or absent first-hand)}], at most STORY.keep; absent before the pawn's first story;
  //   none for the dead.
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const holds = (p) => p.alive && p.age >= SOCIAL.account; // below the age of account a child neither holds nor tells a story
  // A held story's strength now, in closed form (rule 3): s halved every `half` days (`halfFirst` first-hand) / (0.5 + the pawn's wits).
  function strength(st, id, e) {
    const days = (st.t - e.t) / DAY,
      half = e.first ? STORY.halfFirst : STORY.half;
    return e.s * Math.pow(0.5, days / half / (0.5 + Traits.of(st, id, 'wits')));
  }
  function release(st, sid) {
    const s = st.stories.get(sid);
    if (s && --s.held <= 0) st.stories.delete(sid);
  }
  // pawn id lets entry k go
  function drop(st, p, k) {
    const e = p.known[k];
    p.known.splice(k, 1);
    release(st, e.story);
  }
  // the entries pawn id has forgotten go (read when room is made, at renormalising, and as they are weighed)
  function dropForgotten(st, p) {
    if (!p.known) return;
    for (let k = p.known.length - 1; k >= 0; k--) if (strength(st, p.id, p.known[k]) < STORY.forget) drop(st, p, k);
  }
  const find = (p, sid) => (p.known ? p.known.findIndex((e) => e.story === sid) : -1);
  // Pawn id comes to hold story s, its valence as heard v, through `hops` mouths: room made by dropping the forgotten, then, at STORY.keep,
  // the entry of least |v| × strength. False if it held it already (then its strength is restored).
  function hold(st, id, s, v, hops, first, from = null) {
    const p = st.pawns[id];
    const k = find(p, s.id);
    if (k >= 0) {
      restore(st, p.known[k]);
      if (from !== null) p.known[k].from = from;
      return false;
    }
    p.known ||= [];
    dropForgotten(st, p);
    if (p.known.length >= STORY.keep) {
      let worst = 0,
        least = Infinity;
      for (let i = 0; i < p.known.length; i++) {
        const e = p.known[i],
          w = Math.abs(e.v) * strength(st, id, e);
        if (w < least) {
          least = w;
          worst = i;
        }
      }
      drop(st, p, worst);
    }
    p.known.push({ story: s.id, v, hops, s: 1, t: st.t, zeal: [1, 1], first, from });
    s.held++;
    return true;
  }
  const restore = (st, e) => {
    e.s = 1;
    e.t = st.t;
  };
  // ---- making a story: Stories.witness, from a subscriber to the kind's event ----
  // A story of kind `kind` about pawn `subject` (the other party `other`, or null), known first-hand to the parties, the adults of their
  // households and those `present` (pawn ids) where it happened. The first-hand knowers keep no hearsay of it: the parties remember the
  // event itself, and the others saw it. Returns the story, or null when nobody could hold it.
  function make(st, kind, subject, other, v) {
    st.stories ||= new Map();
    st.storySeq ??= 0;
    const s = { id: st.storySeq++, kind, subject, other: other ?? null, t: st.t, v, by: null, held: 0 };
    st.stories.set(s.id, s);
    return s;
  }
  VB.counter('storyMade', 'Stories made, a witnessed event each (sim/stories, VB-523)');
  function witness(st, kind, subject, other, present) {
    const K = STORY.kinds[kind],
      ps = st.pawns[subject];
    if (!K || !ps || !ps.alive) return null;
    const s = make(st, kind, subject, other, K.v);
    const knowers = [subject];
    if (other !== null && other !== undefined) knowers.push(other);
    for (const party of [subject, other]) {
      const hid = party === null || party === undefined ? null : st.pawns[party].household;
      if (hid !== null) for (const m of st.households[hid].members) if (age(st, st.pawns[m]) >= 16) knowers.push(m);
    }
    if (present) for (const id of present) knowers.push(id);
    for (const id of knowers) if (holds(st.pawns[id])) hold(st, id, s, K.v, 0, true);
    VB.count.storyMade++;
    if (!s.held) st.stories.delete(s.id);
    return s.held ? s : null;
  }
  on('claimTaken', (st, e) => witness(st, 'claim', e.taker, e.loser, null));
  on('cattleInCrop', (st, e) => witness(st, 'crop', e.keeper, e.holder, null));
  on('stayedAway', (st, e) => witness(st, 'shirked', e.holder, null, e.came));
  on('matchRefused', (st, e) => witness(st, 'refusedMatch', e.by, e.side, null));
  on('quarrelled', (st, e) => witness(st, 'quarrel', e.a, e.b, null));
  on('giftGiven', (st, e) => e.receiver != null && witness(st, 'helped', e.giver, e.receiver, null));
  on('alePoured', (st, e) => witness(st, 'ale', e.host, null, e.present));

  // ---- telling (design.md, Stories: Telling, Saturation, Sharpening, Belief) ----
  // a's zeal for an audience of pawn b: 0 for its own village, 1 for another
  const audience = (st, a, b) => (settlementIdOf(st, st.pawns[a]) === settlementIdOf(st, st.pawns[b]) ? 0 : 1);
  // In a talk of a and b (sim/relations), each side may tell once.
  on('talked', (st, e) => {
    lieMaybe(st, e.a); // the talk's starter, at its turn (VB-554)
    tellMaybe(st, e.a, e.b);
    tellMaybe(st, e.b, e.a);
  });
  const wts = [];
  VB.counter('storyWeighed', 'Held stories weighed by a teller at its telling in a talk (sim/stories, VB-523)');
  // a may tell b one of the stories it holds: at STORY.tell × (0.5 + sociability), the one drawn by salience against other talk, or none.
  // Nobody tells a pawn of itself but its close friend, and nobody tells of itself. Forgotten entries are dropped as they are weighed.
  function tellMaybe(st, a, b) {
    const pa = st.pawns[a];
    if (!pa.known || !pa.known.length || !holds(pa) || !holds(st.pawns[b])) return;
    if (rnd(st.rng.stories) >= STORY.tell * (0.5 + Traits.of(st, a, 'sociability'))) return;
    const aud = audience(st, a, b),
      friend = pa.bands.get(b) === 1;
    let tot = STORY.background;
    wts.length = 0;
    for (let k = pa.known.length - 1; k >= 0; k--) if (strength(st, a, pa.known[k]) < STORY.forget) drop(st, pa, k);
    for (let k = 0; k < pa.known.length; k++) {
      const e = pa.known[k],
        s = st.stories.get(e.story);
      let w = 0;
      if (s.subject !== a && (s.subject !== b || friend) && e.zeal[aud] >= STORY.quiet) {
        VB.count.storyWeighed++;
        w =
          Math.abs(e.v) *
          e.zeal[aud] *
          strength(st, a, e) *
          (e.v < 0 ? STORY.negative : 1) *
          (1 + Math.min(1, (s.subject === b ? 0 : tieOf(st, b, s.subject)) / STORY.knownTie));
      }
      wts.push(w);
      tot += w;
    }
    let x = rnd(st.rng.stories) * tot - STORY.background;
    if (x < 0) return; // talk of other things
    let k = 0;
    while (k < wts.length - 1 && (x -= wts[k]) > 0) k++;
    if (wts[k] > 0) tell(st, a, b, pa.known[k], aud);
  }
  VB.counter('storyTold', 'Stories told in a talk, believed or not (sim/stories, VB-523)');
  // a tells b the story of its entry e, its zeal that for b's audience `aud`
  function tell(st, a, b, e, aud) {
    const s = st.stories.get(e.story),
      pb = st.pawns[b];
    VB.count.storyTold++;
    restore(st, e);
    s.by ??= a;
    const k = find(pb, s.id);
    if (k >= 0) {
      e.zeal[aud] *= STORY.stifle; // saturation: told to one who holds it, for this audience only
      restore(st, pb.known[k]);
      pb.known[k].from = a;
      return;
    }
    const v = clamp(e.v * (1 + STORY.sharpen) + (2 * rnd(st.rng.stories) - 1) * STORY.noise, -1, 1);
    if (s.lie && knowsBetter(st, b, s)) return expose(st, a, b, s, v, e);
    if (rnd(st.rng.stories) >= belief(st, b, a, s.subject, v)) return;
    hold(st, b, s, v, e.hops + 1, false, a);
    heard(st, b, s, v, e.hops + 1);
    notice(st, b, s, a);
  }
  // The chance hearer b believes a story about `subject` of told valence v from teller a: STORY.belief + 0.5 (trust − 0.5) + 0.5 fit, with
  // trust 0.2 + 0.6 min(1, b's tie to a / knownTie) + 0.5 × b's opinion of a within 0..1, and fit b's opinion of the subject × the sign.
  function belief(st, b, a, subject, v) {
    const trust = clamp(0.2 + 0.6 * Math.min(1, tieOf(st, b, a) / STORY.knownTie) + 0.5 * opinionOf(st, b, a), 0, 1),
      fit = b === subject ? 0 : opinionOf(st, b, subject) * Math.sign(v);
    return STORY.belief + 0.5 * (trust - 0.5) + 0.5 * fit;
  }
  // A believed story is a memory of its subject (heardIll or heardWell), of v × hop ^ hops, capped a subject (sim/relations remember).
  function heard(st, b, s, v, hops) {
    if (b === s.subject || !st.pawns[s.subject].alive) return;
    const x = v * Math.pow(STORY.hop, hops);
    if (x !== 0) remember(st, b, s.subject, x < 0 ? 'heardIll' : 'heardWell', x);
  }
  // ---- said to all: Encounters.said at a rite (sim/venues): the speaker's most salient story is known first-hand to all who heard ----
  on('spoke', (st, e) => {
    const p = st.pawns[e.by];
    if (!p.known || !p.known.length) return;
    let best = null,
      bw = 0;
    for (const x of p.known) {
      const s = st.stories.get(x.story),
        w = s.subject === e.by ? 0 : Math.abs(x.v) * strength(st, e.by, x) * (x.v < 0 ? STORY.negative : 1);
      if (w > bw) {
        bw = w;
        best = x;
      }
    }
    if (!best || strength(st, e.by, best) < STORY.forget) return;
    const s = st.stories.get(best.story);
    restore(st, best);
    s.by ??= e.by;
    for (const id of e.heard) {
      if (!holds(st.pawns[id]) || find(st.pawns[id], s.id) >= 0) continue;
      if (s.lie && knowsBetter(st, id, s)) expose(st, e.by, id, s, best.v, best);
      else if (hold(st, id, s, best.v, best.hops + 1, true, e.by)) {
        heard(st, id, s, best.v, best.hops + 1);
        notice(st, id, s, e.by);
      }
    }
  });
  // ---- lies (VB-554; design.md, Stories: Lies, Exposure) ----
  // A first-hand memory as it is now (sim/relations' memories fade linearly over their days).
  const memNow = (st, kind, m) => m.v * Math.max(0, 1 - (st.t - m.t) / (SOCIAL.memories[kind].days * DAY));
  // Does hearer b know better than lie s: it is the subject; or it holds a first-hand memory of the subject in the lie's domain (STORY.
  // domains) and of the other sign, or a first-hand true story of the subject so; or, for a kin lie, is the subject's kin or housemate.
  // One lookup of b's memories of the subject, and its few held stories.
  function knowsBetter(st, b, s) {
    if (b === s.subject) return true;
    const pb = st.pawns[b],
      domain = STORY.kinds[s.kind].domain,
      sign = Math.sign(s.v),
      fits = (d) => d === '*' || d === domain,
      r = pb.rel.get(s.subject);
    if (r)
      for (const k in r.mem)
        if (STORY.domains[k] && fits(STORY.domains[k]) && Math.sign(memNow(st, k, r.mem[k])) === -sign) return true;
    if (domain === 'kin' && sign < 0 && bond(st, b, s.subject)) return true;
    if (pb.known)
      for (const x of pb.known) {
        const t = x.first && st.stories.get(x.story);
        if (
          t &&
          t !== s &&
          !t.lie &&
          t.subject === s.subject &&
          fits(STORY.kinds[t.kind].domain) &&
          Math.sign(x.v) === -sign
        )
          return true;
      }
    return false;
  }
  // the mean honour of the culture pawn id belongs to (its village's, or culture 0's, or the archetype's before any culture), as sim/traits
  // reads a culture's values
  function cultureHonour(st, id) {
    const env = st.cenv;
    if (!env || !env.cultures.length) return TRAITS.culture.oldNordic.honour;
    const v = settlementIdOf(st, st.pawns[id]),
      set = v !== null ? env.settlements[v] : null,
      c = env.cultures[set ? set.culture : 0];
    return ((c && c.values) || TRAITS.culture.oldNordic).honour;
  }
  VB.counter('lieExposed', 'Lies told to one who knew better (sim/stories, VB-554)');
  // A lie told by a to b, who knows better (its told valence v; a's entry e): not believed. b holds first-hand the counter-story about the
  // lie's inventor, of −min(1, counter × |v| × (0.5 + b's honour) × (0.5 + its culture's mean honour)), and remembers the liar by it; a is
  // told it at once and tells the lie no more. One counter-story a lie, each holder's valence its own. An event of the record, of the
  // hearer, `other` the liar and `reason` the lie's kind.
  function expose(st, a, b, s, v, e) {
    const liar = s.by,
      pl = st.pawns[liar];
    e.zeal[0] = e.zeal[1] = 0;
    VB.count.lieExposed++;
    if (!pl.alive) return;
    const x = -Math.min(
      1,
      STORY.counter * Math.abs(v) * Traits.act(st, b, 'honour', 'judge') * (0.5 + cultureHonour(st, b)),
    );
    let c = s.counter !== undefined ? st.stories.get(s.counter) : undefined;
    if (!c) {
      c = make(st, 'lied', liar, s.subject, x);
      c.by = b;
      s.counter = c.id;
    }
    hold(st, b, c, x, 0, true);
    if (b !== liar) remember(st, b, liar, 'lied', x);
    notice(st, b, c, b);
    if (a !== b && holds(st.pawns[a])) {
      const mine = a === liar;
      if (hold(st, a, c, x, mine ? 0 : 1, mine, b) && !mine) heard(st, a, c, x, 1);
      notice(st, a, c, b);
    }
    personEvent(
      st,
      b,
      'lieExposed',
      `Knew better than the tale ${fullName(pl)} made up about ${fullName(st.pawns[s.subject])}`,
      { other: liar, reason: s.kind, village: settlementIdOf(st, st.pawns[b]) },
    );
  }
  // Why pawn `teller` may not make up a story of `kind` about `about`, or null: a kind of TALES; a living other pawn of 16 or more; one lie
  // about one pawn at a time (a lie it still holds about it).
  function slanderWhy(st, teller, about, kind) {
    const p = Number.isInteger(about) ? st.pawns[about] : null;
    if (!TALES.includes(kind)) return 'there is no such tale to tell';
    if (!p || !p.alive) return 'there is no one living of that name';
    if (about === teller) return 'nobody speaks ill of itself';
    if (age(st, p) < 16) return 'not of a child under 16';
    const pt = st.pawns[teller];
    if (!holds(pt)) return 'a child tells no tales';
    if (pt.known)
      for (const x of pt.known) {
        const s = st.stories.get(x.story);
        if (s.lie && s.by === teller && s.subject === about) return 'a tale of yours about them goes round already';
      }
    return null;
  }
  VB.counter('lieInvented', 'Lies made up, by pawns and the player (sim/stories, VB-554)');
  // Stories.invent: pawn `teller` makes up a story of `kind` about `about` (why: 'enemy' or 'player'), which it holds first-hand and tells
  // as any other. Checked by the verb slander; returns the story.
  function invent(st, teller, about, kind, why) {
    const s = make(st, kind, about, null, STORY.kinds[kind].v);
    s.by = teller;
    s.lie = true;
    s.why = why;
    hold(st, teller, s, s.v, 0, true);
    VB.count.lieInvented++;
    return s;
  }
  // slander: the actor makes up a story about the target, of args.kind (a pawn's own rule at its talk turn, or the player's Speak ill of)
  register('slander', {
    check: (st, c) => slanderWhy(st, c.actor, c.target, c.args && c.args.kind),
    run: (st, c) => {
      invent(st, c.actor, c.target, c.args.kind, c.source === 'player' ? 'player' : 'enemy');
    },
  });
  // At its talk turn a pawn that holds another as an enemy (pawn.bands, -1) may make up a story about one, drawn evenly, at STORY.lie ×
  // (1 − honour) × (0.5 + ambition), of a kind of TALES drawn by |v|. One draw a turn, only for a pawn with an enemy.
  const TALE_W = TALES.reduce((n, k) => n + Math.abs(STORY.kinds[k].v), 0);
  VB.counter('lieChance', 'Talk turns of a pawn with an enemy, a chance to make up a story each (sim/stories, VB-554)');
  function lieMaybe(st, a) {
    const pa = st.pawns[a];
    if (!pa.bands.size || !holds(pa)) return;
    let n = 0;
    for (const band of pa.bands.values()) if (band === -1) n++;
    if (!n) return;
    VB.count.lieChance++;
    if (rnd(st.rng.stories) >= STORY.lie * Traits.act(st, a, 'honour', 'lie') * Traits.act(st, a, 'ambition', 'lie'))
      return;
    let k = Math.floor(rnd(st.rng.stories) * n),
      about = null;
    for (const [q, band] of pa.bands) if (band === -1 && k-- === 0) about = q;
    let x = rnd(st.rng.stories) * TALE_W,
      kind = TALES[TALES.length - 1];
    for (const t of TALES)
      if ((x -= Math.abs(STORY.kinds[t].v)) < 0) {
        kind = t;
        break;
      }
    issue(st, { actor: a, verb: 'slander', target: about, args: { kind }, source: 'pawn' });
  }
  // ---- what the player hears (design.md, Stories: What the player hears) ----
  // A story about the played pawn's household (or itself) that the played pawn comes to hold is an event of its life, notable
  // (sim/notable: it stops a skip). Told as it was heard, from `from`: its belief, never whether it is true.
  function notice(st, id, s, from) {
    const pl = st.player;
    if (!pl || pl.pawn !== id) return;
    const p = st.pawns[id],
      q = st.pawns[s.subject];
    if (s.subject !== id && (p.household === null || q.household !== p.household)) return;
    const who = from === null || from === id ? '' : ` from ${fullName(st.pawns[from])}`;
    personEvent(st, id, 'heardOfUs', `Heard${who} that ${s.subject === id ? 'you' : fullName(q)} ${what(st, s)}`, {
      other: s.subject,
      household: p.household,
      village: settlementIdOf(st, p),
    });
  }
  // a story in words: what its subject did, the other party named (STORY.kinds words)
  const what = (st, s) =>
    STORY.kinds[s.kind].words.replace('%', s.other === null ? 'someone' : fullName(st.pawns[s.other]));
  // how well a story is remembered, in a word, by its strength now
  const memoryWord = (x) => (x >= 0.7 ? 'clearly' : x >= 0.4 ? 'well' : 'faintly');
  // Stories.heard, the actor view (VB-554): what pawn id has heard, as its belief, the strongest first: [{story, about (pawn id), name,
  // what (the kind in words), good (its valence as held is good), from (pawn id or null: first-hand), fromName, mouths, remembered (a
  // word)}]. Nothing says whether a story is true.
  function heardBy(st, id) {
    const p = st.pawns[id];
    if (!p.known) return [];
    return p.known
      .map((e) => {
        const s = st.stories.get(e.story),
          from = e.first || e.from === undefined || e.from === null ? null : e.from;
        return {
          story: e.story,
          about: s.subject,
          name: fullName(st.pawns[s.subject]),
          what: what(st, s),
          good: e.v > 0,
          from,
          fromName: from === null ? null : fullName(st.pawns[from]),
          mouths: e.hops,
          x: strength(st, id, e),
        };
      })
      .sort((a, b) => b.x - a.x || a.story - b.story)
      .map(({ x, ...r }) => ({ ...r, remembered: memoryWord(x) }));
  }
  // ---- forgetting and death ----
  on('tiesRenormalised', (st, e) => dropForgotten(st, st.pawns[e.pawn])); // every TIES.renorm years a pawn
  // the dead hold none: a story whose last holder dies is dropped
  on('died', (st, e) => {
    const p = st.pawns[e.pawn];
    if (!p.known) return;
    for (const x of p.known) release(st, x.story);
    delete p.known;
  });
  // ---- for the page and the tools ----
  // the stories pawn id holds, the strongest first: [{story, kind, subject, other, v, hops, strength, first}]
  function knownOf(st, id) {
    const p = st.pawns[id];
    if (!p.known) return [];
    return p.known
      .map((e) => {
        const s = st.stories.get(e.story);
        return {
          story: e.story,
          kind: s.kind,
          subject: s.subject,
          other: s.other,
          v: e.v,
          hops: e.hops,
          strength: strength(st, id, e),
          first: e.first,
        };
      })
      .sort((x, y) => y.strength - x.strength || x.story - y.story);
  }
  return {
    // what it gives the page through the Sim facade (src/sim.js joins the lists, VB-1944)
    PAGE: ['heard'],
    STORY,
    TALES,
    witness,
    strength,
    knownOf,
    belief,
    tellMaybe,
    tell,
    invent,
    knowsBetter,
    lieMaybe,
    heard: heardBy,
  };
})();
