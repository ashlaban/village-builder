// @sys sim/offers: offer and answer (VB-690; principle "Every act is a pawn's"): every crossing between households is an offer one pawn
//   makes and another answers, yes or no, once, when it falls due, by its basis's rule (the played pawn as it likes, its pawn's judgement
//   shown as advice); a yes settles by the basis's verbs (the right at once, goods carried by the one who gives), a no is a memory
// @state st.offers[]: the open offers, sorted by due (after those due at the same time), each {id, from, to (pawn ids; for a gift given
//   where no pawn acts yet, the giving or taking party itself, {household} or {village}), basis (a key of BASES), gives, wants (the
//   basis's terms, plain data, or null: a want with nothing given is an ask, a gift wants nothing), made, due (game hours), answers[]
//   ({key, by (a pawn id), yes: null | true | false}: who must say yes, the asked first), and the basis's own fields (the parties of
//   goods, {from, to} refs; a match's village, its `asker` where the woman's side asks, the asking spokesman's `fancy`, and its
//   `terms` {dowry, gift} in rations of customary worth, with `norms`, the defaults, where the asking side set its own: sim/terms)}.
//   An offer is kept only while an answer is owed past the moment it was made: one answered
//   at once never enters and takes no id, so with no player and nothing due later the queue stays empty. Plain data, saved; an answered
//   or lapsed offer leaves it.
// @state st.offerSeq: number; the next kept offer's id; ids are never reused
// @state pawn.ask (VB-692): absent or null, else the id of the one open offer about the pawn's own future it holds (the basis's subject: the
//   one a match would marry for the man's side, the claimant, the leader of a party, the servant, the heir); written when such an offer
//   is kept and cleared when it closes, so a pawn holds at most one (plan VB-682, section 2, Caps). Plain data, saved with the pawn.
VB['sim/offers'] = (() => {
  const Due = VB['sim/due'],
    dueKey = (e) => e.due; // its order (sim/due): by due, after those due at the same time
  const { living, unplanned } = VB['sim/records'];
  const { register } = VB['sim/commands'];
  const { DAY, YEAR, TRAVEL } = VB['sim/rules'];
  const Relations = VB['sim/relations'],
    Ties = VB['sim/ties'],
    { remember } = Relations,
    { SOCIAL } = Ties;
  const { log, fullName, holdingOf, atHousehold, mindsWhy, settlementIdOf } = VB['sim/records'];
  const { grainOf } = VB['sim/stores'];
  const { agentWhy } = VB['sim/decisions'];
  const home = (st, id) => Number.isInteger(id) && !!st.households[id] && !st.households[id].dissolved;
  const alive = (st, id) => Number.isInteger(id) && !!st.pawns[id] && st.pawns[id].died === null;
  const onRoad = (a) => a.away !== undefined; // away from home (sim/away's agent.away, VB-783), as on the road
  // The party a ref names ({household} or {village}), or null
  const partyOf = (st, ref) =>
    ref && ref.household !== undefined
      ? st.households[ref.household] || null
      : ref && ref.village !== undefined
        ? st.villages[ref.village] || null
        : null;
  const refOf = (x) => ('farmstead' in x ? { household: x.id } : { village: x.id });
  const nameOf = (st, x) => (x ? ('farmstead' in x ? st.farmsteads[x.farmstead].name : x.name) : 'no one');

  // ---- the table of bases (VB-690): a row a basis, contributed by the module whose rules weigh it, before the first seed. A row:
  // books ('goodwill', 'an obligation' or 'nothing': what a yes books), wait (st => days the played pawn has to answer), check ((st, o, c)
  // => why the offer may not be made, or the basis's own fields to add to it ({} or null for none): what may be offered and wanted), answers ((st, o) =>
  // [{key, by, yes: null}]: who must say yes), weigh ((st, o, a) => the unplayed pawn's answer, and the played pawn's advice), settle
  // ((st, o) => true, or why it lapsed: what a yes does, by verbs), and optionally refused ((st, o, no): what a no leaves; by default a
  // memory of both), lapsed ((st, o, why)) and opened ((st, o): told when it is kept); and for an offer about a life (VB-692) subject
  // ((st, o) => the pawn whose own future it is, who holds it as pawn.ask), where ((st, o) => the village whose step of the moving round
  // answers it), what ((st, o) => its words, as `what`) and memory (false: a no is told, and nobody remembers it). The rows: gift and
  // ask (sim/exchange), match and handover (sim/marriage), land (sim/farmclaims), party (sim/settle) and place (sim/service). An offer
  // made with args.round is due at the moving round: sim/round answers it there, or it lapses when the round ends. A row may name the
  // word it is asked for (`asked`: 'leave', sim/voice; 'hands', sim/hands' help): an offer on it is made by the verb ask, never offer. ----
  const BASES = {};
  function basis(name, row) {
    if (BASES[name]) throw new Error(`basis ${name} is declared twice`);
    BASES[name] = row;
  }
  // A sentence's object for offer o: "the match of A and B", "a gift of 40 grain from X", "an ask of 40 grain by X"
  function what(st, o) {
    if (BASES[o.basis].what) return BASES[o.basis].what(st, o);
    if (o.basis === 'match')
      return `the match of ${fullName(st.pawns[o.gives.man])} and ${fullName(st.pawns[o.wants.woman])}`;
    const t = o.gives || o.wants || {},
      gift = o.basis === 'gift',
      by = nameOf(st, partyOf(st, o.parties && o.parties.from));
    return `${gift ? 'a gift' : `an ${o.basis}`} of ${Math.round(t.n)} ${t.good} ${gift ? 'from' : 'by'} ${by}`;
  }
  // A refusal (the default): both remember it (SOCIAL.memories refusedUs and refusedThem; not for a row with memory false), and opinion
  // follows; nothing else
  function refused(st, o, no) {
    if (BASES[o.basis].memory !== false && alive(st, o.from) && alive(st, no.by) && o.from !== no.by) {
      remember(st, o.from, no.by, 'refusedUs');
      remember(st, no.by, o.from, 'refusedThem');
    }
    const at = partyOf(st, o.parties && o.parties.to);
    log(st, `${fullName(st.pawns[no.by])} refused ${what(st, o)}.`, {
      kind: 'offerRefused',
      pawn: no.by,
      other: Number.isInteger(o.from) ? o.from : null,
      ...(at && 'farmstead' in at ? atHousehold(st, at) : {}),
    });
  }
  function lapsed(st, o, why) {
    const at = partyOf(st, o.parties && o.parties.to),
      w = what(st, o);
    log(st, `${w.charAt(0).toUpperCase() + w.slice(1)} lapsed: ${why}.`, {
      kind: 'offerLapsed',
      pawn: Number.isInteger(o.from) ? o.from : null,
      other: Number.isInteger(o.to) ? o.to : null,
      ...(at && 'farmstead' in at ? atHousehold(st, at) : {}),
    });
  }

  // ---- goods: what a gift or an ask names ----
  // The store of village vid, given by `actor`, or why he may not give from it: he is its alderman, at home (VB-673).
  function storeOf(st, actor, vid) {
    if (!st.villages[vid]) return `there is no village ${vid}`;
    return agentWhy(st, vid, actor) || st.villages[vid];
  }
  // The gift a giver's actor, target and terms describe, {from, to (households or villages), good, n, source, carrier?}, or why there is
  // none: the actor is the giving household's holder, {household} for a household without one, or a village's alderman, at home, for its
  // store (args.store, the village's id; VB-673: a village never acts but through him); the target a
  // household, or {village} for the yearly filling; with a carrier (VB-291), an adult of the giving household free to set out, to another
  // farmstead (a farmstead is one place: nothing is carried within it), with at most a back-load (TRAVEL.load; VB-1111: a physical bound,
  // which help and the good-year gift already kept; a larger gift is fetched, a load a trip).
  function giftOf(st, actor, target, args, source) {
    const n = args && args.n;
    let from;
    if (args && args.store !== undefined) {
      from = storeOf(st, actor, args.store);
      if (typeof from === 'string') return from;
    } else if (Number.isInteger(actor)) {
      if (!alive(st, actor) || !st.agents[actor]) return `pawn ${actor} is not a living pawn`;
      from = holdingOf(st, actor);
      if (!from || from.dissolved) return `pawn ${actor} holds no household`;
    } else if (actor && actor.household !== undefined) {
      if (!home(st, actor.household)) return `there is no household ${actor.household}`;
      from = st.households[actor.household];
      if (from.holder !== null) return `household ${actor.household} gives through its holder`;
    } else if (actor && actor.village !== undefined) return 'a village gives through its alderman';
    else return 'there is no giver';
    const to = Number.isInteger(target)
      ? home(st, target)
        ? st.households[target]
        : null
      : target && st.villages[target.village]
        ? st.villages[target.village]
        : null;
    if (!to) return `there is no household or village ${JSON.stringify(target)}`;
    if (to === from) return 'one cannot give to oneself';
    if (!(args && args.good === 'grain')) return 'only grain is given';
    if (!(Number.isFinite(n) && n > 0)) return `cannot give ${n}`;
    const g = { from, to, good: 'grain', n, source };
    if (args.keep === true) g.keep = true; // the alderman's keep (VB-463): a due of custom, answered yes in the making
    if (args.loan === true) g.loan = true; // a loan (VB-312, sim/loans): set aside and fetched, an obligation booked, not goodwill
    if (args.crops !== undefined) g.crops = args.crops; // a seed loan names its crops (VB-2045: sim/loans cropsFor)
    if (args.carrier !== undefined) {
      const p = st.pawns[args.carrier],
        a = p && st.agents[p.id];
      if (!('farmstead' in from) || !('farmstead' in to)) return 'only a household carries a gift to a household';
      if (!p || !p.alive || p.household !== from.id || p.age < 14 || p.age >= 60 || !a || onRoad(a) || a.load > 0)
        return `pawn ${args.carrier} cannot carry the gift`;
      const kept = mindsWhy(st, p.id); // VB-1602
      if (kept) return kept;
      if (from.farmstead === to.farmstead) return 'nothing is carried within a farmstead';
      if (n > TRAVEL.load + 1e-9) return `one pawn carries at most ${TRAVEL.load} rations: a larger gift is fetched`;
      g.carrier = p.id;
    }
    return g;
  }
  // The goods a command `deliver` hands over (what a yes settles), as giftOf's gift, or why not: the gift, and the goods still there
  function delivery(st, c) {
    const g = giftOf(st, c.actor, c.target, c.args, c.source);
    if (typeof g === 'string') return g;
    return grainOf(g.from) < g.n - 1e-9 ? `${nameOf(st, g.from)} has no longer ${Math.round(g.n)} grain` : g;
  }

  // ---- offers ----
  // The offer a command `offer` describes (actor from, target to; args {basis, gives, wants, due}), or why there is none. The basis's
  // check may add its own fields (the parties of goods, a match's village).
  function offerOf(st, c) {
    const a = c.args || {},
      B = BASES[a.basis];
    if (!B) return `there is no basis ${JSON.stringify(a.basis)}`;
    const due = a.due === undefined ? st.t : a.due;
    if (!(Number.isFinite(due) && due >= st.t && due <= st.t + YEAR)) return `cannot be due at ${due}`;
    const o = {
      from: c.actor,
      to: c.target,
      basis: a.basis,
      gives: a.gives === undefined ? null : a.gives,
      wants: a.wants === undefined ? null : a.wants,
      made: st.t,
      due,
    };
    if (a.round === true) o.round = true;
    const r = B.check(st, o, c);
    if (typeof r === 'string') return r;
    Object.assign(o, r);
    const s = B.subject ? B.subject(st, o) : null,
      held = Number.isInteger(s) && st.pawns[s] ? st.pawns[s].ask : null;
    return held !== null && held !== undefined ? `pawn ${s} holds an open offer about its future already` : o;
  }
  // The pawn whose own future offer o is (its basis's subject), or null
  const subjectOf = (st, o) => {
    const B = BASES[o.basis],
      s = B && B.subject ? B.subject(st, o) : null;
    return Number.isInteger(s) && st.pawns[s] ? s : null;
  };
  // Why the actor's offer cannot be made, or null
  const cannotOffer = (st, c) => {
    const o = offerOf(st, c);
    return typeof o === 'string' ? o : null;
  };
  VB.counter('offerWeighed', 'Answers to an offer weighed by the pawn asked, at the due time (sim/offers, VB-690)');
  VB.counter('answerYesTie', 'Answers given yes, by the basis `tie` of the opinion (sim/offers, VB-706)');
  VB.counter('answerYesStanding', 'Answers given yes, by the basis `standing` of the opinion (sim/offers, VB-706)');
  VB.counter('answerNoTie', 'Answers given no, by the basis `tie` of the opinion (sim/offers, VB-706)');
  VB.counter('answerNoStanding', 'Answers given no, by the basis `standing` of the opinion (sim/offers, VB-706)');
  // The answer `a` of offer o by its pawn's own judgement: the basis's rule (one evaluation; VB.count.offerWeighed)
  function judge(st, o, a) {
    VB.count.offerWeighed++;
    seen.clear();
    const yes = !!BASES[o.basis].weigh(st, o, a);
    // the answer's basis (VB-706): on standing if it read a stranger's standing, else on a tie (or on none read)
    if (seen.size) {
      if (yes) {
        VB.count.answerYesStanding++;
      } else {
        VB.count.answerNoStanding++;
      }
    } else if (yes) {
      VB.count.answerYesTie++;
    } else {
      VB.count.answerNoTie++;
    }
    return yes;
  }
  // What a thinks of b for an answer to an offer (VB-706; sim/offers): opinion where there is a tie (a tie, a bond or a memory), else b's standing as a
  // knows it, above the base of a member, times SOCIAL.standing.weight (times .far from another village), -1..1. Read as the offer is
  // answered: no pass, no state. VB.count.answerOpinion(Standing) count the two.
  const seen = new Set(); // the bases the answers since it was cleared read (sim/offers judge, answerOpinion.basis)
  VB.counter(
    'answerOpinionTie',
    'Answers whose opinion of the asker rests on a tie (sim/offers answerOpinion, VB-706)',
  );
  VB.counter(
    'answerOpinionStanding',
    'Answers whose opinion of the asker rests on its standing, no tie (sim/offers answerOpinion, VB-706)',
  );
  const answerOpinion = Object.assign(
    (st, a, b) => {
      const pa = st.pawns[a];
      if (Ties.tieOf(st, a, b) > 0 || pa.rel.has(b) || Relations.bond(st, a, b)) {
        VB.count.answerOpinionTie++;
        return Relations.opinionOf(st, a, b);
      }
      VB.count.answerOpinionStanding++;
      seen.add('standing');
      const pb = st.pawns[b],
        S = SOCIAL.standing,
        far = settlementIdOf(st, pa) === settlementIdOf(st, pb) ? 1 : S.far,
        o = Relations.opinionOf(st, a, b) + far * S.weight * (pb.standing - S.base);
      return Math.max(-1, Math.min(1, o));
    },
    { basis: seen },
  );
  // ---- faith (VB-707): a debtor's refusal ----
  // Would pawn `by`'s no to the ask o of `worth` rations, which it could meet (`can`: above its floor), break faith: it owes the asker at
  // least that worth in goodwill, and custom (sim/norms 'proper', food for food) does not excuse it.
  function breaks(st, o, by, worth, can) {
    if (!can || !alive(st, o.from) || !alive(st, by) || o.from === by) return false;
    const hh = st.pawns[by].household;
    if (hh === null || st.households[hh].dissolved) return false;
    if (Relations.balance(st, o.from, by) < worth) return false; // what `by` owes the asker, now
    const w = VB['sim/norms'].norm('proper', 'food', 'food', 0); // grain for nothing, within a class: ordinary unless custom says none
    return w !== 'none' && w !== 'hard';
  }
  // Does pawn `by` meet a debt it could meet: its honour's weight of the breach (TRAITS.acts.honour.breach, 0.5 to 1.5) at least 1,
  // that is, an honour from half up
  const keepsFaith = (st, by) => VB['sim/traits'].act(st, by, 'honour', 'breach') >= 1;
  VB.counter(
    'faithBroken',
    'Refusals of an ask by one who owed the asker its worth and could have met it (sim/offers, VB-707)',
  );
  // The deed: standing (sim/society), the creditor's memory, the record
  function breakFaith(st, o, by, worth) {
    VB.count.faithBroken++;
    remember(st, o.from, by, 'brokeFaith');
    VB['sim/events'].emit(st, 'faithBroken', { by, creditor: o.from, worth });
    log(
      st,
      `${fullName(st.pawns[by])} broke faith with ${fullName(st.pawns[o.from])}, refusing ${what(st, o)} it owed.`,
      {
        kind: 'faithBroken',
        pawn: by,
        other: o.from,
      },
    );
  }
  // The warning to a played pawn about to say no to an ask o it would break faith by, or null (the basis's `breach`)
  function warning(st, o, id) {
    const B = BASES[o.basis];
    return B.breach && o.answers.some((a) => a.by === id && a.yes === null) && B.breach(st, o, id)
      ? `${fullName(st.pawns[id])} owes ${fullName(st.pawns[o.from])} this and could give it: a no breaks faith.`
      : null;
  }
  // Keep offer o in the queue, in order of due time (after those due at the same time)
  function keep(st, o) {
    o.id = st.offerSeq++;
    Due.append(st.offers, o, o.due, dueKey);
    const s = subjectOf(st, o);
    if (s !== null) st.pawns[s].ask = o.id;
  }
  // Make the offer of command c (the verb `offer`, and `give` for a gift), checked. Its answers are drawn up; `given` lists the keys said
  // yes in the making (the maker's own wish). Due at once, each pawn's judgement answers now but an unplanned one's (sim/records: its
  // automatic behaviour off, or a command queued), whose controller answers: that offer is kept for the basis's wait (VB-1776); one
  // due later is kept until then. A no closes it, all yes settles it. Returns 'open', 'yes', 'no' or 'lapsed'.
  function make(st, c, given = []) {
    const o = offerOf(st, c),
      B = BASES[o.basis];
    o.answers = B.answers(st, o);
    for (const a of o.answers) if (given.includes(a.key)) a.yes = true;
    if (o.due <= st.t) for (const a of o.answers) if (a.yes === null && !unplanned(st, a.by)) a.yes = judge(st, o, a);
    if (!o.answers.some((a) => a.yes === false) && o.answers.some((a) => a.yes === null)) {
      if (o.due <= st.t) o.due = st.t + B.wait(st) * DAY;
      keep(st, o);
      if (B.opened) B.opened(st, o);
      return 'open';
    }
    return close(st, o);
  }
  // Offer o closes: at a no, the basis's refusal; else its settling, or, if that is refused (one has died, the goods are gone), it lapses.
  function close(st, o) {
    const at = st.offers.indexOf(o);
    if (at >= 0) st.offers.splice(at, 1);
    const s = o.id === undefined ? null : subjectOf(st, o);
    if (s !== null && st.pawns[s].ask === o.id) st.pawns[s].ask = null;
    const B = BASES[o.basis],
      no = o.answers.find((a) => a.yes === false);
    if (no) {
      (B.refused || refused)(st, o, no);
      return 'no';
    }
    const r = B.settle(st, o);
    if (r === true) return 'yes';
    (B.lapsed || lapsed)(st, o, r);
    return 'lapsed';
  }
  const openOffer = (st, id) => st.offers.find((o) => o.id === id) || null;
  // Why pawn id may not answer offer `offerId`, or null: the offer is open and the pawn has an answer in it still to give.
  function cannotAnswer(st, id, offerId) {
    const o = openOffer(st, offerId);
    if (!o) return `there is no open offer ${offerId}`;
    return o.answers.some((a) => a.by === id && a.yes === null)
      ? null
      : `pawn ${id} has no answer to give to offer ${offerId}`;
  }
  // Pawn id answers offer `offerId` (the verb answer), all its answers in it at once; it closes at the first no, or when all have said yes.
  function answer(st, id, offerId, yes) {
    const o = openOffer(st, offerId);
    for (const a of o.answers) if (a.by === id && a.yes === null) a.yes = !!yes;
    if (o.answers.some((a) => a.yes === false) || o.answers.every((a) => a.yes === true)) close(st, o);
  }
  // What pawn id's own judgement would answer to the open offer o, as advice to the player (principle "The future is someone's estimate": that pawn's
  // estimate): true
  // (yes), false (no), or null when it has no answer to give. Reads only.
  function advice(st, o, id) {
    const mine = o.answers.filter((a) => a.by === id && a.yes === null);
    return mine.length ? mine.every((a) => !!BASES[o.basis].weigh(st, o, a)) : null;
  }
  // At the day's end: the offers due close, each unanswered answer given by its pawn's judgement. Only the first offer's due time is read
  // (Rules for cost, 4).
  function dueOffers(st) {
    while (st.offers.length && st.offers[0].due <= st.t) conclude(st, st.offers[0]);
  }
  // The open offer o is answered now, out of its time (a courting pair's offer of the round, their child on the way: VB-555): due now
  // and no longer at the round, each unanswered answer given by its pawn's judgement but an unplanned pawn's, as when it is made due at
  // once; one an unplanned pawn has still to give keeps it open for the basis's wait. 'open', 'yes', 'no' or 'lapsed'.
  function answerNow(st, o) {
    const at = st.offers.indexOf(o);
    if (at >= 0) st.offers.splice(at, 1);
    delete o.round;
    o.due = st.t;
    for (const a of o.answers) if (a.yes === null && !unplanned(st, a.by)) a.yes = judge(st, o, a);
    if (!o.answers.some((a) => a.yes === false) && o.answers.some((a) => a.yes === null)) {
      o.due = st.t + BASES[o.basis].wait(st) * DAY;
      Due.append(st.offers, o, o.due, dueKey);
      return 'open';
    }
    return close(st, o);
  }
  // The open offer o ends now (VB-692): each unanswered answer given by its pawn's judgement (once each), and it closes; or, given `why`
  // (the moving round ended with it open), it lapses unanswered. 'yes', 'no' or 'lapsed'. `early`: it is answered out of its time
  // (answerNow), and may stay open for an unplanned pawn ('open').
  function conclude(st, o, why = null, early = false) {
    if (early) return answerNow(st, o);
    if (why === null) {
      for (const a of o.answers) if (a.yes === null) a.yes = judge(st, o, a);
      return close(st, o);
    }
    const at = st.offers.indexOf(o);
    if (at >= 0) st.offers.splice(at, 1);
    const s = subjectOf(st, o);
    if (s !== null && st.pawns[s].ask === o.id) st.pawns[s].ask = null;
    (BASES[o.basis].lapsed || lapsed)(st, o, why);
    return 'lapsed';
  }
  // Is pawn id held by an open offer of `basis`: one of the two a match would marry, else the one who made it
  const heldBy = (st, id, basis) =>
    st.offers.some(
      (o) => o.basis === basis && (basis === 'match' ? o.gives.man === id || o.wants.woman === id : o.from === id),
    );
  // ---- offers (VB-690): one pawn offers another a crossing between households, the other answers (sim/offers' BASES) ----
  // offer(target, {basis, gives, wants, due, given}): the actor offers pawn `target` the terms of `basis`; due at args.due (game hours,
  // within a year; at once when absent); `given` (the round only) the answer keys the played pawn's own wish has said yes to
  register('offer', {
    check: (st, c) =>
      living(st, c.actor) ||
      (c.args && c.args.given && c.args.given.length && c.source !== 'round'
        ? 'only the round makes an offer with answers given'
        : c.args && BASES[c.args.basis] && BASES[c.args.basis].asked
          ? `${BASES[c.args.basis].asked} is asked, by the verb ask`
          : cannotOffer(st, c)),
    run: (st, c) => make(st, c, (c.args && c.args.given) || []),
  });
  // ask(target, {basis, wants, due}) (VB-1756; docs/plans/four-scales/README.md, 3.6): the actor asks pawn `target` for what `basis`
  // names, a word a row of the table is asked for (`asked`: leave, hands); an offer on that row, made and answered as any, under its
  // check, the same for every pawn. The default authors: a member's own ask of leave (sim/voice), a head short of hands (sim/hands).
  const askedOf = (word) => Object.keys(BASES).find((b) => BASES[b].asked === word) || null;
  const asOffer = (c) => ({
    ...c,
    verb: 'offer',
    args: { basis: askedOf(c.args.basis), wants: c.args.wants, due: c.args.due },
  });
  register('ask', {
    check: (st, c) =>
      living(st, c.actor) ||
      (!c.args || typeof c.args.basis !== 'string' || askedOf(c.args.basis) === null
        ? `one asks for ${Object.values(BASES)
            .filter((B) => B.asked)
            .map((B) => B.asked)
            .join(' or ')}, not ${JSON.stringify(c.args && c.args.basis)}`
        : cannotOffer(st, asOffer(c))),
    run: (st, c) => make(st, asOffer(c)),
  });
  // answer(target, {yes}): the actor answers the open offer `target`, all its answers in it at once; the offer closes at a no, or when
  // all have said yes (an unplayed pawn answers by its own judgement when the offer falls due: sim/offers)
  register('answer', {
    check: (st, c) =>
      living(st, c.actor) ||
      (!(c.args && typeof c.args.yes === 'boolean')
        ? `cannot answer ${JSON.stringify(c.args && c.args.yes)}`
        : cannotAnswer(st, c.actor, c.target)),
    run: (st, c) => answer(st, c.actor, c.target, c.args.yes),
  });
  return {
    BASES,
    basis,
    make,
    cannotOffer,
    cannotAnswer,
    answer,
    advice,
    breaks,
    keepsFaith,
    breakFaith,
    warning,
    dueOffers,
    conclude,
    heldBy,
    answerOpinion,
    giftOf,
    delivery,
    partyOf,
    refOf,
    what,
  };
})();
