// @sys sim/player: the player (VB-169), a source of commands with one pawn at a time: the frame (which pawn, since when, its line's
// record), its pawn's controller (sim/controller) reached through the verbs, its wish, its answer and its choices as head, its pawn's death
// and whom it goes on as
VB['sim/player'] = (() => {
  const { reckon, adopt } = VB['sim/sleepers'];
  const { holdingOf, spouseOf, personEvent, living, villageOf, fullName, spokesmanOf } = VB['sim/records'];
  const { HEALTH } = VB['sim/rules'],
    { SOCIAL } = VB['sim/ties'];
  const { relationsOf, opinionWord } = VB['sim/relations'];
  const { setWish, resetWish, endPartner, WISH } = VB['sim/wishes'];
  const { issue, active, VERBS, register } = VB['sim/commands'];
  const { QUEUE_MAX, controlOf, attach, detach, keepOnly, put, queueStep } = VB['sim/controller'];
  const { on } = VB['sim/events'];
  const { daysOfFood } = VB['sim/foodneed'];
  const { KINDS } = VB['sim/kinds'];
  const { planDay, planBegun } = VB['sim/playerplan'];
  const { nextOf } = VB['sim/plannext'];
  const { MOVE_KINDS } = VB['sim/planchains'];
  // ---- the player (VB-169): one source, `player`, with one pawn at a time, whose controller's queue goes before the pawn's own logic ----
  // @state st.player: null, or {pawn (the inhabited pawn's id; its switch, queue and last refusal are its controller's, pawn.control,
  //   sim/controller, VB-1745), since (game hours), left (null while the pawn
  //   lives; from its death {t, held (the household it held, or null), spouse (pawn id or null), ties[] (at most TIES_MAX {id, why}: those
  //   it thought friends, best first), village (the settlement whose customs name its successor, VB-1121)}: what a death erases and the
  //   player's succession needs, VB-213), ended (null, or when the line ended: its pawn died with no successor, VB-1121), last (null, or {kind, farm, good,
  //   n, t}: the pawn's last task done or load brought home, VB-1118), days[] (at most DAYS_KEPT {t, health, before, hunger, food, why}:
  //   the pawn's health after each of its last meals, its hunger level, its household's food in days of need, and what moved its health,
  //   why {hunger, cold, damp, ill, tired, rest}, VB-1118; tired absent in a day kept before VB-1643)}; plain data, saved with the run. A
  //   save made from VB-1643 to VB-1645 holds sleep ({owed, asleep, at}): the hours its pawn owes, handed to the pawn (sim/sleepers adopt)
  //   at the next step. The pawn's sleep is reckoned each step while it is played (sim/sleepers reckon), for the page
  // @state pawn.proposal (VB-276): absent, else {for (a member the pawn speaks for), partner (a pawn id), terms (null, or what its side
  //   gives: {dowry} for a daughter, {gift} for a son, rations of customary worth)}: a spokesman's match for a member, any pawn's as its
  //   wish is, offered at the round of the man's village (sim/round proposed), until one of the two marries or dies or it is changed
  const TIES_MAX = 12,
    DAYS_KEPT = 5;
  function inhabit(st, id) {
    const dead = living(st, id);
    if (dead) return dead;
    if (st.player) uninhabit(st);
    st.player = {
      pawn: id,
      since: st.t,
      left: null,
      ended: null,
      last: null,
      days: [],
    };
    attach(st, id); // its controller: automatic, nothing queued (a controller it had before is kept)
    resetWish(st, id); // the player starts from the default wish (VB-680): its wishes are the pawn's (pawn.wish, sim/wishes)
    personEvent(st, id, 'player', 'Played by the player');
    return true;
  }
  function uninhabit(st) {
    if (!st.player) return 'no pawn is played';
    personEvent(st, st.player.pawn, 'player', 'No longer played by the player');
    detach(st, st.player.pawn); // its own logic chooses all its acts again
    st.player = null;
    return true;
  }
  // The played pawn dies (sim/lifecycle, before the death ends its marriage and drops its ties; its controller ended with the death,
  // sim/controller): the player keeps it until it goes on as another (VB-213), and what the death erases is noted: the farm it held,
  // its spouse, those it thought friends.
  // `next(st, id, village)` names its successor (successorOf, sim/heirranking, which loads later): with none, the line ends at once.
  function playerDied(st, id, next) {
    const pl = st.player;
    if (!pl || pl.pawn !== id) return;
    const held = holdingOf(st, id),
      friends = relationsOf(st, id).filter((r) => r.opinion >= SOCIAL.friend);
    friends.sort((x, y) => y.opinion - x.opinion || x.id - y.id);
    pl.left = {
      t: st.t,
      held: held ? held.id : null,
      spouse: spouseOf(st, id),
      ties: friends.slice(0, TIES_MAX).map((r) => ({ id: r.id, why: opinionWord(r.opinion) })),
      village: st.pawns[id].household !== null ? villageOf(st, st.pawns[id]) : null,
    };
    if (next(st, id, pl.left.village) === null)
      goOnAs(st, null, `The line ended with ${fullName(st.pawns[id])}: no one of it was left`);
  }
  // The player goes on as pawn id after its pawn's death: `text` is written to the dead pawn's events, and id is played from now, with
  // nothing queued and no wishes. sim/opportunities' succeed checks who may be chosen; true, or why not.
  // With id null no one of the line lives (VB-1121): the game ends, the break is written, and the player keeps the dead pawn, so a save of
  // an ended game loads as ended.
  function goOnAs(st, id, text) {
    const pl = st.player;
    if (!pl || !pl.left) return 'the played pawn has not died';
    if (pl.ended !== null) return 'the line has ended';
    if (id === null) {
      pl.ended = st.t;
      personEvent(st, pl.pawn, 'player', text);
      return 'the line has ended';
    }
    const dead = living(st, id);
    if (dead) return dead;
    personEvent(st, pl.pawn, 'player', text);
    st.player = null;
    return inhabit(st, id);
  }
  // Sim.queue, Sim.unqueue and Sim.setAuto: the played pawn's controller's verbs (sim/controller), issued for it by the player, so a
  // command queued joins with source 'player'. True, or why not: no pawn is played, the command's actor is not the played pawn, or the
  // verb's reason.
  function queue(st, cmd) {
    const pl = st.player;
    if (!pl) return 'no pawn is played';
    const c = cmd || {};
    if (VERBS[c.verb] && c.actor !== pl.pawn) return `pawn ${c.actor} is not the player's pawn`;
    const what = { verb: c.verb, target: c.target, args: c.args };
    return issue(st, { actor: pl.pawn, verb: 'queue', target: null, args: { cmd: what }, source: 'player' });
  }
  function unqueue(st, i) {
    const pl = st.player;
    if (!pl) return 'no pawn is played';
    return issue(st, { actor: pl.pawn, verb: 'unqueue', target: null, args: { i }, source: 'player' });
  }
  function setAuto(st, on) {
    const pl = st.player;
    if (!pl) return 'no pawn is played';
    return issue(st, { actor: pl.pawn, verb: 'auto', target: null, args: { on: !!on }, source: 'player' });
  }
  // The wish and match verbs (VB-212, VB-680, VB-1744; VB-276: a match for a member is the head's): a pawn's own wish at the moving
  // round, written on the pawn as every pawn's is (pawn.wish, sim/wishes), and a spokesman's match for a member (pawn.proposal). Each
  // check reads the actor's position, never whether it is played, so the played pawn's controller and any other issue them alike.
  // The round reads a wish as anyone's and decides by its rules, so a wish is not checked against them here; it stays until changed.
  // wish: target the kind, args {value}; match: target the member, args {partner, terms}.
  const WISH_KINDS = ['out', 'claim', 'serve', 'match', 'settle', 'rank'];
  function wishWhy(st, c) {
    const p = st.pawns[c.actor],
      kind = c.target,
      value = c.args ? c.args.value : undefined;
    if (!p || !p.alive) return `${c.actor} is not a pawn that lives`;
    if (!WISH_KINDS.includes(kind)) return `there is no wish ${kind}`;
    // claim takes a farm id and match a pawn id (of the other sex, living and single), else null or false; out, serve and settle null,
    // true or false; rank a whole ranking (sim/wishes)
    const id = (kind === 'claim' || kind === 'match') && Number.isInteger(value);
    const target = kind === 'claim' ? st.farmsteads[value] : st.pawns[value];
    if (
      kind !== 'rank' &&
      (id ? !target : !(value === null || value === false || (value === true && kind !== 'claim' && kind !== 'match')))
    ) {
      return id
        ? `there is no ${kind === 'claim' ? 'farm' : 'pawn'} ${value}`
        : `${kind} cannot be wished ${JSON.stringify(value)}`;
    }
    if (kind === 'match' && id && (target.sex === p.sex || !target.alive))
      return `${value} is not one the pawn may marry`;
    return null;
  }
  register('wish', {
    check: (st, c) => {
      const why = wishWhy(st, c);
      if (why) return why;
      // a ranking's shape is checked by the write (sim/wishes): the one reason it gives
      if (c.target === 'rank') {
        const v = c.args.value;
        if (!Array.isArray(v) || v.length !== WISH.rungs.length || WISH.rungs.some((r) => !v.includes(r)))
          return `a ranking holds each of ${WISH.rungs.join(', ')} once`;
      }
      return null;
    },
    run: (st, c) => {
      setWish(st, c.actor, c.target, c.args.value);
    },
  });
  // The head's match for a member (VB-276; design.md, Marriage as a negotiation, The player's doors): the spokesman proposes
  // args.partner for the member c.target with the terms its side gives (null for the defaults; `{dowry}` for a daughter, `{gift}` for a
  // son); partner null withdraws it. The round reads it as a wish, by its rules (sim/round).
  function matchWhy(st, c) {
    const p = st.pawns[c.actor],
      member = c.target,
      partner = c.args ? c.args.partner : undefined,
      terms = c.args && c.args.terms !== undefined ? c.args.terms : null;
    if (!p || !p.alive) return `${c.actor} is not a pawn that lives`;
    if (partner === null) return null;
    const m = st.pawns[member],
      q = st.pawns[partner];
    if (!m || !m.alive || member === c.actor) return `${member} is not a member the pawn may speak for`;
    if (spokesmanOf(st, member) !== c.actor) return `${fullName(m)} does not have the pawn as spokesman`;
    if (!q || !q.alive || q.sex === m.sex || spouseOf(st, partner) !== null)
      return `${partner} is not one ${fullName(m)} may marry`;
    const k = m.sex === 'f' ? 'dowry' : 'gift';
    if (terms !== null && (typeof terms !== 'object' || Object.keys(terms).some((x) => x !== k)))
      return `the side of ${fullName(m)} gives only the ${k === 'dowry' ? 'dowry' : 'morning gift'}`;
    if (terms !== null && terms[k] !== undefined && !(Number.isFinite(terms[k]) && terms[k] >= 0))
      return `cannot give ${terms[k]}`;
    return null;
  }
  register('match', {
    check: matchWhy,
    run: (st, c) => {
      const { partner, terms } = c.args;
      if (partner === null) delete st.pawns[c.actor].proposal;
      else st.pawns[c.actor].proposal = { for: c.target, partner, terms: terms ? { ...terms } : null };
    },
  });
  // Sim.wish: the played pawn's wish (VB-212; a match for a member, opts {for, terms}, is the head's); the page's calls. True, or why not.
  function wish(st, kind, value, opts = null) {
    const pl = st.player;
    if (!pl) return 'no pawn is played';
    if (kind === 'match' && opts && opts.for !== undefined && opts.for !== pl.pawn)
      return issue(st, {
        actor: pl.pawn,
        verb: 'match',
        target: opts.for,
        args: { partner: value, terms: opts.terms === undefined ? null : opts.terms },
        source: 'player',
      });
    return issue(st, { actor: pl.pawn, verb: 'wish', target: kind, args: { value }, source: 'player' });
  }
  // A wish for a match ends when the one who wished or the wished partner marries (a and b have married) or dies (a is b); so does the
  // head's match for a member.
  const clearMatchWish = (st, a, b) => {
    endPartner(st, a, b);
    for (const s of new Set([spokesmanOf(st, a), spokesmanOf(st, b)])) {
      const pr = s !== null && st.pawns[s] ? st.pawns[s].proposal : undefined;
      if (pr && [pr.for, pr.partner].some((id) => id === a || id === b)) delete st.pawns[s].proposal;
    }
  };
  // Each six-minute step (sim/clock), before the agents move: the played pawn's sleep is reckoned and, with automatic behaviour off, its
  // plan feeds its queue; then every controller's queue runs (sim/controller queueStep), a command the plan fed marking its task begun.
  const begun = (st, cmd) => {
    if (cmd.plan) planBegun(st, cmd.plan);
  };
  function playerStep(st) {
    const pl = st.player;
    if (pl && pl.sleep) {
      adopt(st, pl.pawn, pl.sleep); // a save made before VB-1645
      delete pl.sleep;
    }
    if (pl) reckon(st, pl.pawn);
    if (pl && pl.plan && !controlOf(st, pl.pawn).auto && !living(st, pl.pawn)) feed(st, pl);
    queueStep(st, begun);
  }
  // ---- the plan's feeder (VB-1646; sim/playerplan): with automatic behaviour off, the plan feeds the queue when nothing queued by hand
  // waits. A command queued by hand goes first, as an order for now: the plan's commands give way to it (a task left keeps its progress
  // and stays planned). In the sleeping hours the plan's work in hand is left for its sleep; else the plan's command runs to its end.
  // A trip of the move under way (the farmstead chain's droving and fetching from the landing, sim/planchains MOVE_KINDS) is not left
  // for the sleeping hours: it goes on to its end, and the pawn sleeps after (VB-1670: on a way of 7 hours each way, the walk out left at
  // bedtime every evening had the move undone for 50 days, and the frost took the loads).
  const onTrip = (st, pl, c) =>
    c.begun !== null && c.plan.from === 'task' && MOVE_KINDS.includes(c.plan.kind) && !!st.agents[pl.pawn].job;
  function feed(st, pl) {
    const id = pl.pawn,
      q = controlOf(st, id).queue;
    if (q.some((c) => !c.plan)) {
      keepOnly(st, id, (c) => !c.plan);
      return;
    }
    if (q.length && q[0].begun !== null && !active(st, q[0], q[0].ref)) keepOnly(st, id, () => false); // its act ended: the next is fed at once
    planDay(st);
    const next = nextOf(st);
    if (q.length) {
      if (!(next && next.plan.from === 'sleep' && q[0].plan.from !== 'sleep') || onTrip(st, pl, q[0])) return;
      keepOnly(st, id, () => false);
    }
    if (next) put(st, id, { ...next, begun: null, ref: null });
  }
  // ---- what the played pawn's acts brought, and what moved its levels (VB-1118) ----
  // A task finished or a load brought home by the played pawn (sim/agents): the last one is kept for its sheet.
  on('yielded', (st, d) => {
    const pl = st.player;
    if (!pl || pl.pawn !== d.pawn) return;
    pl.last = { kind: d.kind, farm: d.farm, good: d.good, n: d.n, t: st.t };
  });
  // The played pawn's meal (sim/hunger): its health and what moved it, its hunger and its household's food, for its last DAYS_KEPT days.
  on('health', (st, d) => {
    const pl = st.player;
    if (!pl || pl.pawn !== d.pawn) return;
    const household = st.pawns[d.pawn].household;
    const food = household === null ? null : daysOfFood(st, st.households[household]);
    if (!pl.days) pl.days = []; // a save made before VB-1118
    pl.days.push({
      t: st.t,
      health: d.after,
      before: d.before,
      hunger: d.hungerLevel,
      food: Number.isFinite(food) ? food : null,
      why: { hunger: d.hunger, cold: d.cold, damp: d.damp, ill: d.ill, tired: d.tired, rest: d.rest },
    });
    if (pl.days.length > DAYS_KEPT) pl.days.shift();
  });
  const round1 = (x) => Math.round(x * 10) / 10;
  // What the played pawn's last act yielded, in words for its sheet (null with none): "Fishing: 6.2 rations of fish brought home", or the
  // task's name done, with the farm where it was done.
  function yieldWords(st) {
    const pl = st.player,
      L = pl && pl.last;
    if (!L) return null;
    const K = KINDS[L.kind] || {},
      what = K.label || K.name || L.kind,
      at = L.farm !== null && st.farmsteads[L.farm] ? ` at ${st.farmsteads[L.farm].name}` : '';
    if (L.good && L.n > 0) return `${what}: brought home ${round1(L.n)} of ${L.good}${at}.`;
    return `${what}: done${at}.`;
  }
  // What moved the played pawn's levels over its last days, in words for its sheet: health, hunger and the household's food, each with
  // its change and, for health, the causes that moved it most (hunger, cold, damp, illness; a full meal on a warm day restores). [] with
  // fewer than two days kept, or nothing moved.
  const CAUSE_WORDS = {
    hunger: 'hunger',
    cold: 'a cold house',
    damp: 'a damp house',
    ill: 'illness',
    tired: 'lack of sleep',
    rest: 'rest and full meals',
  };
  function movedWords(st) {
    const pl = st.player,
      D = (pl && pl.days) || [];
    if (!D.length) return [];
    const first = D[0],
      last = D[D.length - 1],
      out = [],
      n = D.length,
      days = n === 1 ? 'today' : `over ${n} days`;
    const dh = last.health - first.before;
    if (Math.abs(dh) >= 0.5) {
      const sum = { hunger: 0, cold: 0, damp: 0, ill: 0, tired: 0, rest: 0 };
      for (const d of D) for (const k in sum) sum[k] += d.why[k] || 0; // tired absent in a day kept before VB-1643
      const causes = Object.keys(sum)
        .filter((k) => sum[k] >= 0.5 && (dh < 0 ? k !== 'rest' : k === 'rest'))
        .sort((x, y) => sum[y] - sum[x])
        .map((k) => `${CAUSE_WORDS[k]} (${dh < 0 ? '-' : '+'}${Math.round(sum[k])})`);
      out.push(
        `Health ${dh < 0 ? 'fell' : 'rose'} ${Math.round(Math.abs(dh))} ${days}${causes.length ? `: ${causes.join(', ')}` : ''}.`,
      );
    }
    if (n > 1 && Math.abs(last.hunger - first.hunger) >= 0.05)
      out.push(
        `Hunger ${last.hunger > first.hunger ? 'rose' : 'eased'} ${days}: the meals ${last.hunger > first.hunger ? 'fell short' : 'were full'}.`,
      );
    if (n > 1 && first.food !== null && last.food !== null && Math.abs(last.food - first.food) >= 1) {
      const up = last.food > first.food,
        brought = pl.last && pl.last.t >= first.t && pl.last.good && pl.last.n > 0;
      out.push(
        `The household's food ${up ? 'rose' : 'fell'} from ${Math.round(first.food)} to ${Math.round(last.food)} days ${days}` +
          `${up ? (brought ? ': what was brought in' : ': food brought in') : ': eaten faster than brought in'}.`,
      );
    }
    return out;
  }
  // Who of the played pawn's household ails, as its kin see it (principle "The future is someone's estimate": what they see, not what will come): "Gunnar
  // is ailing", and
  // "is gravely ill" once health has fallen under HEALTH's risk line. The played pawn itself is "You are ailing".
  function ailingWords(st) {
    const pl = st.player;
    if (!pl) return [];
    const p = st.pawns[pl.pawn],
      hh = p.household !== null ? st.households[p.household] : null,
      ids = hh ? hh.members : [pl.pawn],
      out = [];
    for (const id of ids) {
      const q = st.pawns[id];
      if (!q.alive || q.ill === undefined) continue;
      const grave = q.health < HEALTH.riskBelow;
      out.push(
        id === pl.pawn
          ? `You are ${grave ? 'gravely ill' : 'ailing'}.`
          : `${q.given} is ${grave ? 'gravely ill' : 'ailing'}.`,
      );
    }
    return out;
  }
  // The notes of the played pawn's sheet (VB-1118), made when asked: what its last act yielded, what moved its levels, who ails.
  const sheetNotes = (st) => ({ yielded: yieldWords(st), moved: movedWords(st), ailing: ailingWords(st) });
  // The played pawn answers the open marriage offer offerId (VB-293; the first question asked through Decisions.answer, which slice 5's
  // Decisions module takes over): true, or why not.
  function answer(st, offerId, yes) {
    if (!st.player) return 'no pawn is played';
    return issue(st, { actor: st.player.pawn, verb: 'answer', target: offerId, args: { yes }, source: 'player' });
  }
  // The played pawn chooses as head of its household (VB-253, for the page's plan panel, VB-256): verb one of HEAD_VERBS, at once, not
  // queued (a choice of the plan takes no time); its target the household it holds, else the one it lives in, so a pawn that is not the
  // head is refused with the reason. True, or why not.
  const HEAD_VERBS = [
    'target',
    'tile',
    'order',
    'project',
    'dropProject',
    'rotation',
    'sowOutOfTurn',
    'dayOrder',
    'dayGive',
    'dayCall',
  ];
  function head(st, verb, args) {
    const pl = st.player;
    if (!pl) return 'no pawn is played';
    if (!HEAD_VERBS.includes(verb)) return `${verb} is not a choice of the plan`;
    const held = holdingOf(st, pl.pawn),
      target = held && !held.dissolved ? held.id : st.pawns[pl.pawn].household;
    return issue(st, { actor: pl.pawn, verb, target, args: args || {}, source: 'player' });
  }
  return {
    head,
    QUEUE_MAX,
    inhabit,
    uninhabit,
    queue,
    unqueue,
    setAuto,
    wish,
    clearMatchWish,
    answer,
    playerStep,
    playerDied,
    goOnAs,
    TIES_MAX,
    sheetNotes,
    DAYS_KEPT,
  };
})();
