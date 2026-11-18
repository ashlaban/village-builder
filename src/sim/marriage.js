// @sys sim/marriage: a marriage (wed, the marry verb's act), the handover in life (the holder's rule for offering it, and the basis
//   `handover`: the first in line answers, a no passes it on; VB-824), and the basis `match` of sim/offers (VB-690): what may be offered,
//   who answers, what a yes, a no and a lapse do (split from sim/lifecycle, VB-876)
VB['sim/marriage'] = (() => {
  const { living, home } = VB['sim/records'];
  const { emit } = VB['sim/events'];
  const { MARRIAGE, SOCIAL, ASK, HUNGER } = VB['sim/rules'];
  const { personEvent, log, fullName, spouseOf, settlementIdOf, farmPractice, holdingOf, atHousehold, spokesmanOf } =
    VB['sim/records'];
  const { startInLife } = VB['sim/exchange'];
  const { stayOf } = VB['sim/agents'];
  const { heirRanking, refreshRoles, handOn } = VB['sim/heirs'];
  const { issue, register } = VB['sim/commands'];
  const { clearMatchWish } = VB['sim/player'];
  const { moveWhy, wishOf } = VB['sim/wishes'];
  const { meansOf, sideScore, askerOf, askedOf, askedBy, asksMatch } = VB['sim/matching'];
  const Courting = VB['sim/courting'];
  const Offers = VB['sim/offers'],
    { heldBy } = Offers;
  const { raiseTie, remember, opinionOf } = VB['sim/relations'];
  const { wedding } = VB['sim/occasions'];
  const { goBack } = VB['sim/trust'],
    { trustOfHolder } = VB['sim/ownership'];
  // A marriage (the marry command, VB-171): the union, both move to the home household, the event, ties, a spouse who held a farm of
  // their own hands it on (VB-153), and the wedding is called for the next day (VB-126).
  function wed(st, mId, fId, home) {
    const m = st.pawns[mId],
      f = st.pawns[fId];
    for (const id of [mId, fId]) {
      const t = trustOfHolder(st, id); // a holder whose farm is held in trust goes back to it first (VB-309)
      if (t) goBack(st, t, 'married', 'round');
    }
    m.kinPush = f.kinPush = null; // pushed at an earlier village's round, she takes the pull of the round that married her (VB-277)
    st.unions.push({ id: st.unions.length, a: mId, b: fId, start: st.t, end: null, kind: 'marriage' });
    const olds = [mId, fId].map((id) => st.pawns[id].household).filter((h) => h !== null && h !== home);
    for (const id of [mId, fId]) {
      if (st.pawns[id].household !== home)
        issue(st, { actor: id, verb: 'move', target: home, args: { reason: 'marriage' }, source: 'round' });
      personEvent(st, id, 'married', `Married ${fullName(st.pawns[id === mId ? fId : mId])}`, false);
      st.rigDirty.add(id); // recorded below
    }
    emit(st, 'wed', { a: mId, b: fId }); // newly married (sim/mood, VB-062)
    const fm = st.farmsteads[st.households[home].farmstead],
      away = [m, f].filter((q) => stayOf(st, q.id)); // from another village: and sets out for it (VB-287)
    const out = away.length
      ? `, and ${away.map((q) => q.given).join(' and ')} ${away.length > 1 ? 'set' : 'sets'} out for it`
      : '';
    log(st, `${fullName(m)} and ${fullName(f)} marry and live at ${fm.name}${out}.`, {
      kind: 'married',
      pawn: mId,
      other: fId,
      ...atHousehold(st, st.households[home]),
    });
    raiseTie(st, mId, fId, 2);
    raiseTie(st, fId, mId, 2);
    clearMatchWish(st, mId, fId);
    for (const id of [mId, fId]) {
      const own2 = holdingOf(st, id);
      if (own2 && own2.id !== home) handOn(st, own2, id, home);
    }
    // a heifer from the old household of the one who moved in, where the home wants a cow (sim/exchange, VB-390)
    for (const h of olds) if (startInLife(st, st.households[home], st.households[h])) break;
    wedding(st, mId, fId, home); // the next day's feast at their farm (sim/occasions, VB-126)
  }
  // ---- the handover in life (VB-824; design.md, Succession: Handed on, and taken up; plan VB-682, section 4.6) ----
  // Household hh's line as its holder would ask it: [{id, no}] (heirRanking's `asked`), the grown only (a minor is not asked), those in
  // `passed` (who have said no to this offer) left out.
  function lineOf(st, hh, passed = null) {
    const asked = [];
    heirRanking(st, hh, null, false, null, null, asked);
    return asked.filter((e) => st.pawns[e.id].age >= 18 && !(passed && passed.includes(e.id)));
  }
  // The holder of hh considers handing it on, by its own rule (Kim, 18 November: the elder chooses; the custom's time is when the
  // village expects it): an unplayed holder offers at the custom's time, when the one it expects to take the farm (rank(h)[0], `rank` a
  // ranking function of household ids) is grown and, under 'marriage', has married and lives there, or, under 'age60', the holder is
  // 60; unless its opinion of that heir is ill (SOCIAL.enemy or below), when it holds out. Nothing offers for the played holder: it
  // offers by the verb when it chooses. The offer (the basis `handover`) goes to the first in line, due at `due` (the moving round's
  // time; at once when null, at the heir's wedding). Considered at a marriage into hh (settleMatch) and on the holder's birthday
  // (sim/asking). The new holder if it was handed on at once, else null.
  function handover(st, hh, rank, due = null) {
    if (hh.dissolved || (st.player && st.player.pawn === hh.holder) || heldBy(st, hh.holder, 'handover')) return null;
    const f = st.farmsteads[hh.farmstead],
      cu = farmPractice(st, f),
      old = hh.holder,
      heir = rank(hh.id)[0];
    if (heir === undefined || st.pawns[heir].age < 18) return null;
    const why =
      cu.handover === 'marriage' && spouseOf(st, heir) !== null && st.pawns[heir].household === hh.id
        ? 'marriage'
        : cu.handover === 'age60' && st.pawns[old].age >= 60
          ? 'retirement'
          : null;
    if (!why || opinionOf(st, old, heir) <= SOCIAL.enemy) return null;
    issue(st, {
      actor: old,
      verb: 'offer',
      target: lineOf(st, hh)[0].id,
      args: {
        basis: 'handover',
        gives: { household: hh.id, reason: why },
        ...(due === null ? {} : { due, round: true }),
      },
      source: 'handover',
    });
    return hh.holder !== old ? hh.holder : null;
  }
  // ---- the basis `handover` of sim/offers (VB-692, VB-824): {from (the holder of gives.household), to (the first in its line not yet
  // asked), gives {household, reason ('marriage' or 'retirement': what the holder gives it up for), passed (those in line who have said
  // no to it; only a refusal passes it on)}}: the holding, for the holder's keep on the farm for life (retired there). The one asked
  // answers: yes, unless it holds a farm or lives on a spouse's (heirRanking's answers; a betrothal joins them with VB-825). A yes is
  // the handOn verb, and the heir's move. A no is told, nobody remembers it, and the holder offers it to the next in line at once. It is
  // nobody's `pawn.ask` (no subject): open from the holder's day to the round, it must not keep the holder or an unmarried heir from a
  // match; a holder has one open at a time. ----
  const reasons = ['marriage', 'retirement'];
  function handoverWhy(st, o, c) {
    const g = o.gives || {},
      hh = st.households[g.household],
      p = Number.isInteger(o.to) ? st.pawns[o.to] : null;
    if (!hh || hh.dissolved) return `there is no household ${g.household}`;
    if (hh.holder !== o.from) return `pawn ${o.from} does not hold household ${hh.id}`;
    if (!p || !p.alive || p.id === o.from) return `pawn ${o.to} cannot take the holding`;
    if (!reasons.includes(g.reason)) return `a holding is not handed on for ${JSON.stringify(g.reason)}`;
    if (g.passed !== undefined && !(c && c.source === 'handover')) return 'only a refusal passes a handover on';
    if (heldBy(st, o.from, 'handover')) return `${fullName(st.pawns[o.from])} has offered the holding already`;
    const first = lineOf(st, hh, g.passed)[0];
    if (!first || first.id !== o.to)
      return `the holding is offered to the first in line${first ? `, ${fullName(st.pawns[first.id])}` : ', and there is none'}`;
    const whose = moveWhy(st, p.id, hh.id, 'heir');
    return typeof whose === 'string' ? whose : {};
  }
  // Why the one asked would not take hh, or null
  const heirNo = (st, hh, id) => (lineOf(st, hh).find((e) => e.id === id) || { no: 'is not in line' }).no;
  function refusedHandover(st, o) {
    const hh = st.households[o.gives.household],
      why = hh.dissolved ? null : heirNo(st, hh, o.to);
    log(
      st,
      `${fullName(st.pawns[o.to])} would not take over ${st.farmsteads[hh.farmstead].name}${why ? `: ${why}` : ''}.`,
      { kind: 'offerRefused', pawn: o.to, other: o.from, ...atHousehold(st, hh) },
    );
    if (hh.dissolved || hh.holder !== o.from || !st.pawns[o.from].alive) return;
    const passed = [...(o.gives.passed || []), o.to],
      next = lineOf(st, hh, passed)[0];
    if (next)
      issue(st, {
        actor: o.from,
        verb: 'offer',
        target: next.id,
        args: { basis: 'handover', gives: { household: hh.id, reason: o.gives.reason, passed } },
        source: 'handover',
      });
  }
  Offers.basis('handover', {
    books: 'nothing',
    memory: false,
    wait: () => MARRIAGE.offerDays,
    check: handoverWhy,
    answers: (st, o) => [{ key: 'self', by: o.to, yes: null }], // the holder's yes is the offer
    weigh: (st, o) => heirNo(st, st.households[o.gives.household], o.to) === null,
    refused: refusedHandover,
    settle: (st, o) => {
      const hh = st.households[o.gives.household];
      if (hh.dissolved || hh.holder !== o.from) return 'the holding has passed';
      const no = heirNo(st, hh, o.to); // farms are not combined, whoever says yes
      if (no) return `${fullName(st.pawns[o.to])} ${no}`;
      const r = issue(st, {
        actor: o.from,
        verb: 'handOn',
        target: o.to,
        args: { household: o.gives.household, reason: o.gives.reason },
        source: 'round',
      });
      if (r === true) refreshRoles(st); // on any day, by whoever's answer: the roles follow the holder
      return r;
    },
    where: (st, o) => st.farmsteads[st.households[o.gives.household].farmstead].village,
    what: (st, o) =>
      `the handover of ${st.farmsteads[st.households[o.gives.household].farmstead].name} to ${fullName(st.pawns[o.to])}`,
  });
  // A courting pair's own offer, an unplayed pawn's answer (VB-275, VB-036): no at enmity or below towards the one it weighs: the other
  // one to marry, or, for a spokesman, the other side's spokesman.
  function unplayedNo(st, answers, a) {
    const other = a.key.startsWith('man') ? 'woman' : 'man',
      side = answers.find((b) => b.key === other + 'Side');
    return (
      opinionOf(st, a.by, (a.key.endsWith('Side') && side ? side : answers.find((b) => b.key === other)).by) <=
      SOCIAL.enemy
    );
  }
  // ---- the basis `match` of sim/offers (VB-690, VB-693): an offer {from (the spokesman of the one who asks: the man, or the woman where
  // her side asks, `asker` 'woman'), to (the spokesman of the one asked), gives {man, home}, wants {woman}, village (the man's
  // settlement), fancy (the asking spokesman's fancy, the score's noise drawn once at the asking: 0..1, absent for its mean)}; and a
  // courting pair's own offer (VB-036; plan VB-682, section 4.1), from one of the two to the other, marked `courted` (read from who
  // courts whom, not from what the offer says): the two and their spokesmen answer it as any, the means of the home and the two's hunger
  // are read where it settles (the round), and a head's no is remembered by both ----
  const names = (st, o) => `${fullName(st.pawns[o.gives.man])} and ${fullName(st.pawns[o.wants.woman])}`;
  // What may be offered: a man and a woman, living and unmarried, a home for them, made by the spokesman of one to the spokesman of the
  // other: the one who asks in no other open match, the one asked asking in none and asked by fewer than ASK.held (VB-823). The offer
  // gains the man's village, who asks, and the fancy (or why not)
  function matchWhy(st, o, c) {
    const man = o.gives && o.gives.man,
      woman = o.wants && o.wants.woman,
      hh = o.gives && st.households[o.gives.home];
    if (![man, woman].every((id) => Number.isInteger(id) && st.pawns[id] && st.pawns[id].died === null))
      return 'a match is of two living pawns';
    if (st.pawns[man].sex !== 'm' || st.pawns[woman].sex !== 'f') return 'a match is of a man and a woman';
    if (spouseOf(st, man) !== null || spouseOf(st, woman) !== null) return 'one of them is married';
    if (!hh || hh.dissolved) return `there is no household ${o.gives.home}`;
    const courted = st.pawns[man].courting === woman,
      own = courted && ((o.from === man && o.to === woman) || (o.from === woman && o.to === man)),
      his = own || (o.from === spokesmanOf(st, man) && o.to === spokesmanOf(st, woman)),
      hers = !his && o.from === spokesmanOf(st, woman) && o.to === spokesmanOf(st, man);
    if (!his && !hers)
      return 'a match is offered by the spokesman of one to the spokesman of the other, or by one of a courting pair to the other';
    for (const id of [man, woman])
      if (!courted && Number.isInteger(st.pawns[id].courting)) return `${fullName(st.pawns[id])} is courting another`;
    const [a, b] = hers ? [woman, man] : [man, woman],
      she = (id) => (id === woman ? 'she' : 'he');
    if (heldBy(st, a, 'match') || asksMatch(st, b)) return `${she(heldBy(st, a, 'match') ? a : b)} is in an open offer`;
    if (askedBy(st, b) >= ASK.held) return `${she(b)} is asked by ${ASK.held} open offers already`;
    const fancy = c && c.args ? c.args.fancy : undefined,
      out = { village: settlementIdOf(st, st.pawns[man]) };
    if (fancy !== undefined && !(Number.isFinite(fancy) && fancy >= 0 && fancy <= 1)) return `a fancy is not ${fancy}`;
    if (fancy !== undefined && c.source !== 'asking' && c.source !== 'round') return 'only an asking draws a fancy';
    if (courted) out.courted = true;
    if (hers) out.asker = 'woman';
    if (fancy !== undefined) out.fancy = fancy;
    return out;
  }
  // The answers a match asks for, all unanswered: the man's and the woman's, and each one's spokesman's where another speaks for them;
  // and, where neither is, the head of the home one of them moves to (moveWhy, VB-692: the receiving head's yes, always).
  const movers = (st, o) => [o.gives.man, o.wants.woman].filter((id) => st.pawns[id].household !== o.gives.home);
  function matchAnswers(st, o) {
    const out = [
      ['man', o.gives.man],
      ['woman', o.wants.woman],
    ].flatMap(([key, id]) => {
      const s = spokesmanOf(st, id),
        own = { key, by: id, yes: null };
      return s === id ? [own] : [own, { key: key + 'Side', by: s, yes: null }];
    });
    for (const id of movers(st, o))
      for (const a of moveWhy(st, id, o.gives.home, 'marriage'))
        if (!out.some((b) => b.by === a.by)) out.push({ key: a.key, by: a.by, yes: null });
    return out;
  }
  // One of the two who courts another says no to a match arranged for it, unless it holds the spokesman who made it dearer than the one
  // it courts: then it yields, and remembers (VB-036; VB-693).
  function courtsAnother(st, o, a) {
    if ((a.key !== 'man' && a.key !== 'woman') || o.courted) return false;
    const c = st.pawns[a.by].courting,
      side = o.answers.find((b) => b.key === a.key + 'Side');
    return Number.isInteger(c) && !(side && opinionOf(st, a.by, side.by) > opinionOf(st, a.by, c));
  }
  // Whether the home of offer o lacks the means to marry (sim/matching meansOf): the farm cannot feed another mouth
  function meansShort(st, o) {
    const hh = st.households[o.gives.home],
      m = hh.dissolved ? null : meansOf(st, hh.id);
    return !!m && !m.exempt && m.held < m.asked;
  }
  // Which of the two answer `a` of offer o speaks or answers for ('man' or 'woman'; null for the head of the home), and whether it
  // answers as that one's spokesman: a `Side` answer, or the one to marry where no other speaks for it.
  const sideOf = (a) => (a.key.startsWith('man') ? 'man' : a.key.startsWith('woman') ? 'woman' : null);
  const speaks = (o, a) => a.key.endsWith('Side') || !o.answers.some((b) => b.key === a.key + 'Side');
  const speakerOf = (o, side) =>
    (o.answers.find((b) => b.key === side + 'Side') || o.answers.find((b) => b.key === side)).by;
  // The score of offer o as the spokesman of `side` reads it (plan VB-682, 4.1): the same terms, his own opinion of the other side's
  // spokesman, and the fancy drawn at the asking for the side that asked, the noise at its mean for the side that answers.
  function readBy(st, o, side) {
    const asked = (o.asker === 'woman' ? 'woman' : 'man') === side && o.fancy !== undefined;
    return sideScore(
      st,
      st.pawns[o.gives.man],
      st.pawns[o.wants.woman],
      asked ? o.fancy : 0.5,
      speakerOf(o, side),
      speakerOf(o, side === 'man' ? 'woman' : 'man'),
    );
  }
  // Why answer `a` of offer o is a no by its pawn's own judgement, or null for a yes: an unplayed pawn's answer, and the played pawn's
  // advice (VB-275, VB-693; plan VB-682, 4.1). The head of the home says no at enmity or below towards one who would move in
  // ('enmity'). One to marry says no at enmity or below towards the other, while it courts another unless it yields ('courting'), and
  // under "not this year" (its wish ranks staying above a match, sim/wishes: 'wish'). A spokesman, and one who speaks for itself, weighs
  // the score as it reads it, which must reach MARRIAGE.minScore ('score'), and the means of the home, read now ('means'). A courting
  // pair's own offer asks no score: a spokesman says no to it at enmity or below towards the other side's (unplayedNo), and the means
  // and the two's hunger are read where it settles.
  function whyNo(st, o, a) {
    if (a.key === 'head') return movers(st, o).every((id) => opinionOf(st, a.by, id) > SOCIAL.enemy) ? null : 'enmity';
    if (o.courted) return unplayedNo(st, o.answers, a) ? 'enmity' : null;
    const side = sideOf(a);
    if (!a.key.endsWith('Side')) {
      if (opinionOf(st, a.by, side === 'man' ? o.wants.woman : o.gives.man) <= SOCIAL.enemy) return 'enmity';
      if (courtsAnother(st, o, a)) return 'courting';
      if (wishOf(st, a.by, 'match') === false) return 'wish';
    }
    if (!speaks(o, a)) return null;
    return readBy(st, o, side) < MARRIAGE.minScore ? 'score' : meansShort(st, o) ? 'means' : null;
  }
  const matchYes = (st, o, a) => whyNo(st, o, a) === null;
  const WHY_NO = {
    enmity: 'for ill will',
    courting: 'courting another',
    wish: 'not this year',
    score: 'the two are ill matched',
  };
  // A match kept for the player's answer is told.
  function toldMatch(st, o) {
    const { man, home } = o.gives,
      woman = o.wants.woman,
      hh = st.households[home];
    for (const id of [man, woman])
      personEvent(st, id, 'offered', `Offered a match with ${fullName(st.pawns[id === man ? woman : man])}`, false);
    log(st, `A match is offered: ${names(st, o)}, to live at ${st.farmsteads[hh.farmstead].name}.`, {
      kind: 'offered',
      pawn: man,
      other: woman,
      ...atHousehold(st, hh),
    });
  }
  // A yes: the marriage, through the marry verb, and the handover it brings to its home. True, or why the verb refused (one has died
  // or married).
  function settleMatch(st, o) {
    const hh = st.households[o.gives.home];
    if (o.courted) {
      // the gate's last two lines, read at the round: the couple waits, courting (hunger postpones the marriage, not the courting)
      for (const id of [o.gives.man, o.wants.woman])
        if (!(st.pawns[id].hunger < HUNGER.marryBelow)) return `${fullName(st.pawns[id])} is too hungry to marry`;
      const m = hh.dissolved ? null : meansOf(st, hh.id);
      if (m && !m.exempt && m.held < m.asked) return 'the farm cannot feed another mouth';
    }
    // one who yields: it courts another, and marries the one its spokesman chose (read before the wedding ends the courtship)
    const yielded = [];
    if (!o.courted)
      for (const [key, id, sp] of [
        ['man', o.gives.man, o.wants.woman],
        ['woman', o.wants.woman, o.gives.man],
      ]) {
        const c = st.pawns[id].courting,
          side = (o.answers || []).find((b) => b.key === key + 'Side');
        if (Number.isInteger(c) && c !== sp && side && side.by !== id)
          yielded.push({ id, sp, by: side.by, courted: c });
      }
    const why = issue(st, {
      actor: o.gives.man,
      verb: 'marry',
      target: o.wants.woman,
      args: { home: o.gives.home },
      source: 'round',
    });
    if (why !== true) return why;
    for (const y of yielded) {
      const who = fullName(st.pawns[y.courted]),
        sp = fullName(st.pawns[y.sp]);
      if (st.pawns[y.by].alive) remember(st, y.id, y.by, 'marriedAgainst');
      personEvent(st, y.id, 'marriedAgainst', `Married ${sp} against a wish for ${who}`, false);
      log(st, `${fullName(st.pawns[y.id])} married ${sp} against a wish: ${who} was the one courted.`, {
        kind: 'marriedAgainst',
        pawn: y.id,
        other: y.sp,
        ...atHousehold(st, hh),
      });
    }
    // the heir has married: the home's holder considers handing on (the custom 'marriage')
    const handed = handover(st, hh, (h) => heirRanking(st, st.households[h]));
    if (o.id !== undefined && handed === null) refreshRoles(st); // the handover refreshes its own
    return true;
  }
  // A no (VB-293, VB-693): the refusal is told, by the log and in the lives of the two. A pawn that refuses the match its spokesman
  // made costs the spokesman's opinion of it (SOCIAL.memories.refusedMatch). A spokesman of the side asked who refuses (hers, or she
  // where she speaks for herself) is remembered by the spokesman who asked (refusedSuit). A home that cannot feed another mouth is no
  // refusal of anyone: the couple put it off, nobody remembers it, and it is told as that (the kind `putOff`).
  function refusedMatch(st, o, no) {
    const hh = st.households[o.gives.home],
      at = { pawn: o.gives.man, other: o.wants.woman, ...atHousehold(st, hh) };
    // a head refused a courting pair: each of the two remembers it, and they keep courting (sim/courting, VB-036)
    if (
      o.courted &&
      st.pawns[o.gives.man].courting === o.wants.woman &&
      no.by !== o.gives.man &&
      no.by !== o.wants.woman
    )
      Courting.refused(st, o.gives.man, o.wants.woman, no.by);
    // why, by the pawn's own judgement; the played pawn's no is its player's, and no reason is read into it
    const why = st.player && st.player.pawn === no.by ? null : whyNo(st, o, no);
    if (why === 'means') {
      log(st, `${names(st, o)} put off marrying: the farm cannot feed another mouth.`, {
        kind: 'putOff',
        n: 1,
        village: st.farmsteads[hh.farmstead].village,
        ...at,
      });
      return;
    }
    for (const a of o.answers) {
      const side = a.yes === false && o.answers.find((b) => b.key === a.key + 'Side');
      if (side && side.by !== a.by && st.pawns[side.by].alive) remember(st, side.by, a.by, 'refusedMatch');
    }
    const asked = o.asker === 'woman' ? 'man' : 'woman';
    if (!o.courted && sideOf(no) === asked && speaks(o, no) && no.by !== o.from && st.pawns[o.from].alive)
      remember(st, o.from, no.by, 'refusedSuit');
    const who = fullName(st.pawns[no.by]),
      said = WHY_NO[why] ? `: ${WHY_NO[why]}` : '';
    for (const id of [o.gives.man, o.wants.woman])
      personEvent(
        st,
        id,
        'matchRefused',
        `${id === no.by ? 'Refused' : `${who} refused`} the match with ${fullName(st.pawns[id === o.gives.man ? o.wants.woman : o.gives.man])}${said}`,
        false,
      );
    log(st, `${who} refused the match of ${names(st, o)}${said}.`, {
      kind: 'matchRefused',
      by: no.by,
      ...(why ? { reason: why } : {}),
      ...at,
    });
  }
  function lapsedMatch(st, o, why) {
    const at = { pawn: o.gives.man, other: o.wants.woman, ...atHousehold(st, st.households[o.gives.home]) };
    log(st, `The match of ${names(st, o)} lapsed: ${why}.`, { kind: 'offerLapsed', ...at });
  }
  Offers.basis('match', {
    books: 'nothing',
    wait: () => MARRIAGE.offerDays,
    check: matchWhy,
    answers: matchAnswers,
    weigh: matchYes,
    settle: settleMatch,
    refused: refusedMatch,
    lapsed: lapsedMatch,
    opened: toldMatch,
    subject: (st, o) => askerOf(o), // the one whose side asks: the man, or the woman (plan VB-682, section 4.1; VB-693)
    where: (st, o) => settlementIdOf(st, st.pawns[askedOf(o)]), // the step of the village of the one asked answers (Proposed)
  });
  // marry(target, {home}): the actor and the target marry and live in household args.home
  register('marry', {
    check: (st, c) =>
      living(st, c.actor) ||
      living(st, c.target) ||
      (c.actor === c.target
        ? 'one cannot marry oneself'
        : spouseOf(st, c.actor) !== null || spouseOf(st, c.target) !== null
          ? 'one of them is married'
          : !home(st, c.args && c.args.home)
            ? `there is no household ${c.args && c.args.home}`
            : null),
    run: (st, c) => wed(st, c.actor, c.target, c.args.home),
  });
  return {
    wed,
    handover,
  };
})();
