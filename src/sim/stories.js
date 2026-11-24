// @sys sim/stories: stories (VB-523; design.md, Traits, talk and stories: Stories; Kim, 3 Nov, model B): an event worth telling, known first
// to those who were there, told in talk by its salience, believed by trust and fit, sharper at each retelling, forgotten untold; a believed
// story is remembered of its subject as hearsay (sim/relations). Owns st.stories, st.storySeq and pawn.known.
VB['sim/stories'] = (() => {
  const { next: rnd } = VB['sim/rng'];
  const { DAY } = VB['sim/rules'];
  const { SOCIAL, tieOf } = VB['sim/ties'];
  const Traits = VB['sim/traits'];
  const { settlementIdOf, age } = VB['sim/records'];
  const { on, emit } = VB['sim/events'];
  const { remember, opinionOf } = VB['sim/relations'];
  // @tunable STORY (design.md, Stories; the numbers Proposed 15 Nov from the experiment, docs/gossip-experiment.md):
  //   keep: stories a pawn holds; a story is told in a talk, by each side once, at `tell` × (0.5 + the teller's sociability), weighed by
  //   |v| × zeal × strength × `negative` for bad news × (1 + min(1, the hearer's tie to the subject / `knownTie`)) against `background`;
  //   told to one who holds it, the teller's zeal for that audience × `stifle`, not told under `quiet`; each retelling × (1 + `sharpen`),
  //   noise ± `noise`; belief at `belief` + 0.5 (trust − 0.5) + 0.5 fit; the hearsay memory the told valence × `hop` ^ hops, at most `cap`
  //   a subject, fading over `fade` days; strength halves every `half` days (`halfFirst` first-hand) / (0.5 + wits), forgotten under `forget`.
  //   kinds: the event of the record each is made from, its domain and its valence at the source; a later slice adds a kind by one line.
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
    kinds: {
      claim: { event: 'claimTaken', domain: 'law', v: -0.5 }, // a claim taken (sim/stakes)
      crop: { event: 'cattleInCrop', domain: 'law', v: -0.3 }, // cattle let into a crop (sim/byre)
      shirked: { event: 'stayedAway', domain: 'law', v: -0.2 }, // a work day shirked (sim/workdays)
      refusedMatch: { event: 'matchRefused', domain: 'kin', v: -0.3 }, // a match refused (sim/marriage)
      quarrel: { event: 'quarrelled', domain: 'kin', v: -0.2 }, // a quarrel (sim/relations, VB-520)
      helped: { event: 'giftGiven', domain: 'dealings', v: 0.4 }, // help given in hunger: grain given (sim/exchange)
      ale: { event: 'alePoured', domain: 'dealings', v: 0.3 }, // ale poured or a feast laid out (sim/feast)
    },
  };
  // the memories a believed story leaves of its subject (sim/relations remember, given the value): declared here, beside their rule
  Object.assign(SOCIAL.memories, {
    heardIll: { label: 'Heard ill of them', v: -0.1, cap: -STORY.cap, days: STORY.fade },
    heardWell: { label: 'Heard well of them', v: 0.1, cap: STORY.cap, days: STORY.fade },
  });
  // @state st.stories: Map of story id to {id, kind (a key of STORY.kinds), subject (pawn id), other (pawn id or null), t (game hour), v
  //   (the valence at the source), by (the pawn who first told it, null until told), held (how many living pawns hold it)}; the live ones
  //   only: a story nobody holds is dropped. st.storySeq: the next story id (ids are never reused). Absent until the first story.
  // @state pawn.known: [{story (id), v (the valence as heard), hops (the mouths it came through, 0 first-hand), s (strength at t), t (game
  //   hour last told or heard), zeal: [home, away] (for an audience of the pawn's own village, of another), first (known first-hand)}], at
  //   most STORY.keep; absent before the pawn's first story; none for the dead.
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
  function hold(st, id, s, v, hops, first) {
    const p = st.pawns[id];
    const k = find(p, s.id);
    if (k >= 0) {
      restore(st, p.known[k]);
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
    p.known.push({ story: s.id, v, hops, s: 1, t: st.t, zeal: [1, 1], first });
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
  function witness(st, kind, subject, other, present) {
    const K = STORY.kinds[kind],
      ps = st.pawns[subject];
    if (!K || !ps || !ps.alive) return null;
    st.stories ||= new Map();
    st.storySeq ??= 0;
    const s = { id: st.storySeq++, kind, subject, other: other ?? null, t: st.t, v: K.v, by: null, held: 0 };
    st.stories.set(s.id, s);
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
    else emit(st, 'storyMade', { story: s.id });
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
    tellMaybe(st, e.a, e.b);
    tellMaybe(st, e.b, e.a);
  });
  const wts = [];
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
      return;
    }
    const v = clamp(e.v * (1 + STORY.sharpen) + (2 * rnd(st.rng.stories) - 1) * STORY.noise, -1, 1);
    if (rnd(st.rng.stories) >= belief(st, b, a, s.subject, v)) return;
    hold(st, b, s, v, e.hops + 1, false);
    heard(st, b, s, v, e.hops + 1);
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
    for (const id of e.heard)
      if (holds(st.pawns[id]) && hold(st, id, s, best.v, best.hops + 1, true)) heard(st, id, s, best.v, best.hops + 1);
  });
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
  return { STORY, witness, strength, knownOf, belief, tellMaybe, tell };
})();
