// @sys sim/commands: commands, the one way an actor acts: plain data {actor, verb, target, args, source}, checked, then carried out; the player's queue
VB['sim/commands'] = (() => {
  const { start, release, walkTo, goHome, idle, haltForTalk } = VB['sim/agents'];
  const { isOpen } = VB['sim/kinds'];
  const Culture = VB['culture'];
  const { holdingOf, membersOf, voiceOf, spouseOf, personEvent } = VB['sim/records'];
  const { cal, WORK, SOCIAL, TICKS } = VB['sim/rules'];
  const { relationsOf, opinionWord } = VB['sim/relations'];
  const { assessGift, settleGift } = VB['sim/exchange'];
  // Verbs carried out by systems loaded after this module (sim/heirs, sim/lifecycle, sim/clock) find them when they run.
  const later = (key) => VB[key];
  const option = (c) =>
    (!(c.args && Number.isInteger(c.args.dim) && c.args.dim >= 0 && c.args.dim < Culture.DIMS.length) ? `there is no custom ${c.args && c.args.dim}`
    : !(Number.isInteger(c.args.option) && c.args.option >= 0 &&
      c.args.option < Culture.NOPT[c.args.dim]) ? `custom ${c.args.dim} has no option ${c.args.option}` : null);
  const home = (st, id) => Number.isInteger(id) && st.households[id] && !st.households[id].dissolved;
  const settlement = (st, c) =>
    (c.actor && st.cenv && st.cenv.settlements[c.actor.settlement] ? null : `there is no settlement ${c.actor && c.actor.settlement}`);
  // A command names its actor (a pawn id), a verb from VERBS, its target and arguments, and its source: 'planner' (the job matcher),
  // later 'player', 'debug', 'meeting', 'round' (VB-168 to VB-171) or 'occasion' (VB-126). Each verb checks the command and returns why it is refused, or null;
  // then carries it out. The systems below a verb are unchanged: a command decides nothing, it only puts a name between choosing and doing.
  const living = (st, id) => (st.pawns[id] && st.pawns[id].died === null && st.agents[id] ? null : `pawn ${id} is not a living pawn`);
  // The gift a `give` command describes, {from, to, good, n, source}, or why there is none: the actor is the giving household's holder,
  // {household} for a household without one, or {village} for its store; the target a household, or {village} for the yearly filling.
  function giftOf(st, c) {
    const a = c.actor, t = c.target, n = c.args && c.args.n;
    let from;
    if (Number.isInteger(a)) {
      const dead = living(st, a); if (dead) return dead;
      from = holdingOf(st, a); if (!from || from.dissolved) return `pawn ${a} holds no household`;
    } else if (a && a.household !== undefined) {
      if (!home(st, a.household)) return `there is no household ${a.household}`;
      from = st.households[a.household]; if (from.holder !== null) return `household ${a.household} gives through its holder`;
    } else if (a && st.villages[a.village]) from = st.villages[a.village];
    else return 'there is no giver';
    const to = Number.isInteger(t) ? (home(st, t) ? st.households[t] : null) : t && st.villages[t.village] ? st.villages[t.village] : null;
    if (!to) return `there is no household or village ${JSON.stringify(t)}`;
    if (to === from) return 'one cannot give to oneself';
    if (!(c.args && c.args.good === 'grain')) return 'only grain is given';
    if (!(Number.isFinite(n) && n > 0)) return `cannot give ${n}`;
    return { from, to, good: 'grain', n, source: c.source };
  }
  const VERBS = {
    // work(job): leave the job in hand, if any (it keeps its progress), and set out for the job with key `target`
    work: {
      check: (st, c) => living(st, c.actor) || (!st.jobs.has(c.target) ? `there is no job ${c.target}`
        : !isOpen(st.jobs.get(c.target)) ? `job ${c.target} has no room` : null),
      run: (st, c) => { const a = st.agents[c.actor]; release(st, a); start(st, a, st.jobs.get(c.target)); },
    },
    // walkTo(tile): walk to the tile, to the spot args {x, y} in map units (the tile's centre if absent), by the cheapest route
    walkTo: {
      // Not refused on a tile the walking rule closes: an idle walk to company may end on a river tile (twice in a founders year at seed 7),
      // and the walk goes ahead as it always has; refusing it would change behaviour (VB-168). A player's walk should offer open tiles only.
      check: (st, c) => living(st, c.actor) || (!(Number.isInteger(c.target) && c.target >= 0 && c.target < st.w.N) ? `there is no tile ${c.target}` : null),
      run: (st, c) => {
        const x = c.args && c.args.x !== undefined ? c.args.x : st.w.hx[c.target], y = c.args && c.args.y !== undefined ? c.args.y : st.w.hy[c.target];
        walkTo(st, st.agents[c.actor], c.target, x, y);
      },
    },
    // goHome: walk home and go in (phase 'home')
    goHome: {
      check: (st, c) => living(st, c.actor) || (st.pawns[c.actor].household === null ? `pawn ${c.actor} has no home` : null),
      run: (st, c) => goHome(st, st.agents[c.actor]),
    },
    // idle(until): look for nothing to do until game time args.until
    idle: {
      check: (st, c) => living(st, c.actor) || (!(c.args && c.args.until >= st.t) ? `idle until ${c.args && c.args.until}, which is past` : null),
      run: (st, c) => idle(st, st.agents[c.actor], c.args.until),
    },
    // haltForTalk(until): pause an idle outdoor pawn until the talk ends, leaving work and indoor pawns alone
    haltForTalk: {
      check: (st, c) => living(st, c.actor) || (!(c.args && c.args.until >= st.t) ? `talk until ${c.args && c.args.until}, which is past`
        : commanded(st, c.actor) ? `pawn ${c.actor} is on the player's command` : null),
      run: (st, c) => haltForTalk(st, st.agents[c.actor], c.args.until),
    },
    // attend(occasion): set out for the occasion with id `target` (sim/occasions; source 'occasion'), leaving the work in hand, walk to a spot
    // about it and stand there until its end
    attend: {
      check: (st, c) => living(st, c.actor) || later('sim/occasions').cannotAttend(st, c.actor, c.target),
      run: (st, c) => {
        const a = st.agents[c.actor];
        release(st, a);
        const [tile, x, y, until] = later('sim/occasions').join(st, a, c.target);
        walkTo(st, a, tile, x, y); idle(st, a, until);
      },
    },
    // ---- gifts (source 'help', later 'player'; VB-216) ----
    // give(target, {good, n}): the actor's household, or village store, gives n of good to household `target`, or to the village store
    // (target {village}); refused when it would take the giver below its floor or beyond its allowance (sim/exchange)
    give: {
      check: (st, c) => { const o = giftOf(st, c); return typeof o === 'string' ? o : assessGift(st, o).why; },
      run: (st, c) => settleGift(st, giftOf(st, c)),
    },
    // ---- a settlement's meeting (source 'meeting') ----
    // decide({dim, option}): the settlement's practice of the custom becomes the option
    decide: {
      check: (st, c) => settlement(st, c) || option(c)
        || (st.cenv.settlements[c.actor.settlement].practice[c.args.dim] === c.args.option ? 'the practice is that already' : null),
      run: (st, c) => { st.cenv.settlements[c.actor.settlement].practice[c.args.dim] = c.args.option; },
    },
    // ---- the moving round (source 'round'); what the round weighs to choose stays with it, the verbs check only what makes the act possible ----
    // marry(target, {home}): the actor and the target marry and live in household args.home
    marry: {
      check: (st, c) => living(st, c.actor) || living(st, c.target) || (c.actor === c.target ? 'one cannot marry oneself'
        : spouseOf(st, c.actor) !== null || spouseOf(st, c.target) !== null ? 'one of them is married'
          : !home(st, c.args && c.args.home) ? `there is no household ${c.args && c.args.home}` : null),
      run: (st, c) => later('sim/lifecycle').wed(st, c.actor, c.target, c.args.home),
    },
    // answer(target, {yes}): the player's pawn (source 'player') answers the open marriage offer `target` (st.offers, sim/lifecycle; VB-293),
    // all its answers in it at once; the offer closes at a no, or when all have said yes
    answer: {
      check: (st, c) => (!st.player || st.player.pawn !== c.actor ? `pawn ${c.actor} is not the player's pawn` : living(st, c.actor)
        || (!(c.args && typeof c.args.yes === 'boolean') ? `cannot answer ${JSON.stringify(c.args && c.args.yes)}`
          : later('sim/lifecycle').cannotAnswer(st, c.actor, c.target))),
      run: (st, c) => later('sim/lifecycle').answerOffer(st, c.actor, c.target, c.args.yes),
    },
    // handOn(target, {household, reason}): the actor, holding household args.household, hands it to the heir `target`
    handOn: {
      check: (st, c) => (!home(st, c.args && c.args.household) ? `there is no household ${c.args && c.args.household}`
        : st.households[c.args.household].holder !== c.actor ? `pawn ${c.actor} does not hold household ${c.args.household}` : living(st, c.target)),
      run: (st, c) => later('sim/heirs').transfer(st, st.households[c.args.household], c.target, c.args.reason),
    },
    // serve(target): the actor goes into service with the holder of household `target`
    serve: {
      check: (st, c) => living(st, c.actor) || (!home(st, c.target) ? `there is no household ${c.target}`
        : st.pawns[c.actor].household === c.target ? `pawn ${c.actor} lives there already` : null),
      run: (st, c) => later('sim/service').enterService(st, c.actor, c.target),
    },
    // claim(target): the actor claims the empty farm `target` and sets about restoring it
    claim: {
      check: (st, c) => living(st, c.actor) || (!st.farmsteads[c.target] ? `there is no farm ${c.target}`
        : !later('sim/farmclaims').claimable(st.farmsteads[c.target]) ? `farm ${c.target} cannot be claimed` : null),
      run: (st, c) => later('sim/farmclaims').startClaim(st, st.farmsteads[c.target], c.actor),
    },
    // leave({from, party: {all, followers}, house, field, village | wood}): the actor's party leaves village `from` to settle at `house` with
    // its first `field`: in the small village `village` if given, else founding a new one with woodlot `wood`; provisions as the round reckons them
    leave: {
      check: (st, c) => {
        const a = c.args || {}, S = later('sim/settle');
        if (!st.villages[a.from]) return `there is no village ${a.from}`;
        if (!a.party || !Array.isArray(a.party.all) || a.party.all[0] !== c.actor) return 'the party must be led by the actor';
        for (const id of a.party.all) { const dead = living(st, id); if (dead) return dead; }
        if (![a.house, a.field].every((t) => Number.isInteger(t) && t >= 0 && t < st.w.N)) return 'the house and field must be tiles';
        if (a.village !== undefined && !st.villages[a.village]) return `there is no village ${a.village}`;
        return S.provisions(st, a.party.all) ? null : 'the family cannot spare the grain';
      },
      run: (st, c) => {
        const a = c.args, S = later('sim/settle'), home = st.villages[a.from], party = { all: a.party.all, followers: a.party.followers || [] };
        const prov = S.provisions(st, party.all);
        if (a.village !== undefined) S.settleFarm(st, st.villages[a.village], home, party, a.house, a.field, prov);
        else S.found(st, home, st.pawns[c.actor], party, { house: a.house, field: a.field, wood: a.wood }, prov);
      },
    },
    // A restored farm gains its household; construction keeps plot/farm-specific steps in their owners.
    foundHousehold: {
      check: (st, c) => {
        const f = st.farmsteads[c.target], a = c.args || {};
        if (!f || f.household !== null) return 'there is no empty farm';
        if (!Array.isArray(a.members) || !a.members.includes(c.actor) || new Set(a.members).size !== a.members.length) {
          return 'the household must include its holder and unique members';
        }
        for (const id of a.members) { const dead = living(st, id); if (dead) return dead; }
        return Number.isFinite(a.grain) && a.grain >= 0 ? null : 'invalid provisions';
      },
      run: (st, c) => later('sim/membership').foundHousehold(st, st.farmsteads[c.target], c.args.members, c.actor, { grain: c.args.grain }),
    },
    finishCottage: {
      check: (st, c) => {
        const v = st.villages[c.args && c.args.village], plot = v && v.plots[c.target];
        return plot && plot.cottage && plot.cottage.i >= 3 && !plot.built ? null : 'there is no finished cottage';
      },
      run: (st, c) => later('sim/cottage').finishCottage(st, st.villages[c.args.village].plots[c.target]),
    },
    // ---- debug actions (source 'debug') ----
    kill: { check: (st, c) => living(st, c.actor), run: (st, c) => later('sim/lifecycle').killPawn(st, c.actor, 'killed') },
    // retire: a holder hands the farm to the first heir
    retire: {
      check: (st, c) => {
        const dead = living(st, c.actor); if (dead) return dead;
        const hh = holdingOf(st, c.actor);
        return !hh || hh.dissolved ? `pawn ${c.actor} holds no farm` : !later('sim/heirs').heirRanking(st, hh).length ? 'the farm has no heir' : null;
      },
      run: (st, c) => later('sim/lifecycle').retireHolder(st, holdingOf(st, c.actor).id),
    },
    // argue({dim, option}): the pawn takes up the cause for ten years (the debug's, and the player's for its pawn: VB-211); it replaces any cause held
    argue: {
      check: (st, c) => living(st, c.actor) || option(c),
      run: (st, c) => {
        const d = Culture.DIMS[c.args.dim];
        Culture.advocate(st.pawns[c.actor], c.args.dim, c.args.option, st.cenv.t + 10);
        personEvent(st, c.actor, 'cause', `Took up the cause: ${d.label.toLowerCase()}, ${d.opts[c.args.option][1].toLowerCase()}`);
      },
    },
    // dropCause: the pawn lays down the cause it argues
    dropCause: {
      check: (st, c) => living(st, c.actor) || (st.pawns[c.actor].advocate ? null : 'the pawn argues no cause'),
      run: (st, c) => {
        const p = st.pawns[c.actor], d = Culture.DIMS[p.advocate.dim];
        Culture.advocate(p, null);
        personEvent(st, c.actor, 'cause', `Dropped the cause: ${d.label.toLowerCase()}`);
      },
    },
    // rally({dim, option}): a fifth of the settlement's voices, the most esteemed first, take up the cause
    rally: {
      check: (st, c) => settlement(st, c) || option(c),
      run: (st, c) => {
        const s = st.cenv.settlements[c.actor.settlement];
        const voiced = membersOf(st, s.id).filter((q) => voiceOf(st, q, s) > 0).sort((x, y) => y.prestige - x.prestige);
        const want = Math.max(1, Math.ceil(voiced.length * 0.2));
        for (const q of voiced.slice(0, want)) Culture.advocate(q, c.args.dim, c.args.option, st.cenv.t + 10);
      },
    },
    // skip({hours}): the world goes on for that long (no actor), whole 6-minute steps (VB-244)
    skip: {
      check: (st, c) => {
        const h = c.args && c.args.hours;
        if (!(h > 0 && Number.isFinite(h))) return `cannot skip ${h} hours`;
        const x = h * TICKS;
        return Math.abs(x - Math.round(x)) < 1e-6 ? null : `cannot skip ${h} hours: not a whole number of 6-minute steps`;
      },
      run: (st, c) => later('sim/clock').advance(st, c.args.hours),
    },
  };
  // Carries out cmd, or changes nothing: true, or the reason it was refused.
  function issue(st, cmd) {
    const V = VERBS[cmd.verb];
    if (!V) return `there is no verb ${cmd.verb}`;
    const why = V.check(st, cmd);
    if (why) return why;
    V.run(st, cmd);
    return true;
  }
  // ---- the player (VB-169): one source, `player`, with one pawn at a time, whose queued commands go before the pawn's own logic ----
  // @state st.player: null, or {pawn (the inhabited pawn's id), auto (boolean: left to itself, the pawn does what its role's automatic
  //   behaviour chooses), queue[] (at most QUEUE_MAX commands {actor: pawn, verb, target, args, source: 'player', begun}, in turn; `begun` is
  //   null until the command is issued, then the game time: only the head is ever begun, and it stays the head while its act lasts),
  //   refused (null, or {verb, why, t}: the last command refused when its turn came), since (game hours), wishes ({out, claim, serve}: what
  //   the player wishes for its pawn at the moving round, each null for "as the pawn would"; out true (move out, though heir to a farm) or
  //   false (stay); claim a farm id (only that farm) or false (none); serve true (as the pawn would) or false (decline). Set by wish, kept
  //   across rounds until changed, read through sim/records' wishOf where the round asks what a pawn wants), left (null while the pawn
  //   lives; from its death {t, held (the household it held, or null), spouse (pawn id or null), ties[] (at most TIES_MAX {id, why}: those
  //   it thought friends, best first)}: what a death erases and the player's succession needs, VB-213)}; plain data, saved with the run
  const QUEUE_MAX = 8, TIES_MAX = 12;
  // A command begun lasts while its act does: work while the pawn holds that job, a walk until it arrives, going home until it is indoors,
  // idling until its time is up. Any other verb is done at once.
  const LASTS = {
    work: (st, a, c) => !!a.job && a.job.key === c.target,
    walkTo: (st, a) => !!a.path,
    goHome: (st, a) => !a.inside && !!a.path,
    idle: (st, a, c) => st.t < c.args.until,
  };
  // The planner's sites ask these two (docs/review-life.md, section 2). commanded: a command of the player's is queued or under way for the
  // pawn, so nothing else moves it. unplanned: that, or the player has turned its automatic behaviour off, so the planner gives it no work.
  const commanded = (st, id) => { const pl = st.player; return !!pl && pl.pawn === id && pl.queue.length > 0; };
  const unplanned = (st, id) => { const pl = st.player; return !!pl && pl.pawn === id && (pl.queue.length > 0 || !pl.auto); };
  function inhabit(st, id) {
    const dead = living(st, id); if (dead) return dead;
    if (st.player) uninhabit(st);
    st.player = { pawn: id, auto: true, queue: [], refused: null, since: st.t, wishes: { out: null, claim: null, serve: null }, left: null };
    personEvent(st, id, 'player', 'Played by the player');
    return true;
  }
  function uninhabit(st) {
    if (!st.player) return 'no pawn is played';
    personEvent(st, st.player.pawn, 'player', 'No longer played by the player');
    st.player = null;
    return true;
  }
  // The played pawn dies (sim/lifecycle, before the death ends its marriage and drops its ties): the player keeps it, with an empty queue,
  // until it goes on as another (VB-213), and what the death erases is noted: the farm it held, its spouse, those it thought friends.
  function playerDied(st, id) {
    const pl = st.player;
    if (!pl || pl.pawn !== id) return;
    const held = holdingOf(st, id), friends = relationsOf(st, id).filter((r) => r.opinion >= SOCIAL.friend);
    friends.sort((x, y) => y.opinion - x.opinion || x.id - y.id);
    pl.queue = [];
    pl.left = { t: st.t, held: held ? held.id : null, spouse: spouseOf(st, id),
      ties: friends.slice(0, TIES_MAX).map((r) => ({ id: r.id, why: opinionWord(r.opinion) })) };
  }
  // The player goes on as pawn id after its pawn's death: `text` is written to the dead pawn's events, and id is played from now, with
  // nothing queued and no wishes. sim/opportunities' succeed checks who may be chosen; true, or why not.
  function goOnAs(st, id, text) {
    const pl = st.player;
    if (!pl || !pl.left) return 'the played pawn has not died';
    const dead = living(st, id); if (dead) return dead;
    personEvent(st, pl.pawn, 'player', text);
    st.player = null;
    return inhabit(st, id);
  }
  // Needs go on: with nothing left to do after the end of work, the player's pawn goes home, as everyone did at dark.
  function homeAtDark(st, pl) {
    const a = st.agents[pl.pawn], h = cal(st.t).hour;
    if ((h >= WORK[1] || h < WORK[0]) && !a.inside && a.phase === null) issue(st, { actor: pl.pawn, verb: 'goHome', source: 'planner' });
  }
  // The command joins the queue, to be checked when its turn comes; true, or why it does not: the queue is full, there is no such verb,
  // or its actor is not the player's pawn. `skip` is the world's, not a pawn's (it would advance time from within a step).
  function queue(st, cmd) {
    const pl = st.player;
    if (!pl) return 'no pawn is played';
    if (!cmd || !VERBS[cmd.verb] || cmd.verb === 'skip') return `there is no verb ${cmd && cmd.verb} to queue`;
    if (cmd.actor !== pl.pawn) return `pawn ${cmd.actor} is not the player's pawn`;
    if (pl.queue.length >= QUEUE_MAX) return `the queue is full (${QUEUE_MAX} commands)`;
    const copy = (v) => (v === undefined ? null : JSON.parse(JSON.stringify(v))); // the queue keeps its own plain data
    pl.queue.push({ actor: pl.pawn, verb: cmd.verb, target: copy(cmd.target), args: copy(cmd.args), source: 'player', begun: null });
    return true;
  }
  // Takes command i off the queue. The head, once begun, only stops being the player's: the pawn goes on with the act as its own.
  function unqueue(st, i) {
    const pl = st.player;
    if (!pl) return 'no pawn is played';
    if (!(Number.isInteger(i) && i >= 0 && i < pl.queue.length)) return `the queue has no command ${i}`;
    pl.queue.splice(i, 1);
    if (!pl.queue.length && !living(st, pl.pawn)) homeAtDark(st, pl);
    return true;
  }
  function setAuto(st, on) {
    if (!st.player) return 'no pawn is played';
    st.player.auto = !!on;
    return true;
  }
  // The player's wish for its pawn at the moving round (VB-212): it stands in where the round asks what the pawn itself wants, and the round
  // decides by its rules, so a wish is not checked against them here; it stays until changed. True, or why it is not a wish.
  function wish(st, kind, value) {
    const pl = st.player;
    if (!pl) return 'no pawn is played';
    if (kind !== 'out' && kind !== 'claim' && kind !== 'serve') return `there is no wish ${kind}`;
    const farm = kind === 'claim' && Number.isInteger(value);
    if (farm ? !st.farmsteads[value] : !(value === null || value === false || (value === true && kind !== 'claim'))) {
      return farm ? `there is no farm ${value}` : `${kind} cannot be wished ${JSON.stringify(value)}`;
    }
    pl.wishes[kind] = value;
    return true;
  }
  // Each six-minute step (sim/clock), before the agents move: a begun head whose act has ended leaves the queue, and the next command is
  // issued; one refused then is dropped, its reason kept in `refused`. A load being carried home is delivered first, as at the end of work.
  function playerStep(st) {
    const pl = st.player;
    if (!pl || !pl.queue.length) return;
    const a = st.agents[pl.pawn], q = pl.queue;
    if (q[0].begun !== null) {
      const lasts = LASTS[q[0].verb];
      if (lasts && !living(st, pl.pawn) && lasts(st, a, q[0])) return;
      q.shift();
    }
    while (q.length) {
      if (a.phase === 'back') return;
      // told to walk, go home or idle, the pawn leaves the job in hand, which keeps its progress (work leaves it itself): only if it may
      const cmd = q[0], leaves = !!a.job && cmd.verb !== 'work' && !!LASTS[cmd.verb], barred = leaves ? VERBS[cmd.verb].check(st, cmd) : null;
      if (leaves && !barred) release(st, a);
      const why = barred || issue(st, cmd);
      if (why === true) { cmd.begun = st.t; return; }
      q.shift(); pl.refused = { verb: cmd.verb, why, t: st.t };
    }
    if (!living(st, pl.pawn)) homeAtDark(st, pl);
  }
  // The played pawn answers the open marriage offer offerId (VB-293; the first question asked through Decisions.answer, which slice 5's
  // Decisions module takes over): true, or why not.
  function answer(st, offerId, yes) {
    if (!st.player) return 'no pawn is played';
    return issue(st, { actor: st.player.pawn, verb: 'answer', target: offerId, args: { yes }, source: 'player' });
  }
  return {
    issue, VERBS, QUEUE_MAX, commanded, unplanned, inhabit, uninhabit, queue, unqueue, setAuto, wish, answer, playerStep, playerDied, goOnAs, TIES_MAX,
  };
})();
