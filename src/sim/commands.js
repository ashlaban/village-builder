// @sys sim/commands: commands, the one way an actor acts: plain data {actor, verb, target, args, source}, checked, then carried out; the player's queue
VB['sim/commands'] = (() => {
  const {
    start,
    release,
    walkTo,
    goHome,
    idle,
    haltForTalk,
    attentionOf,
    sideWhy,
    hold,
    reachAfter,
    travelling,
    carryGift,
    fetcherOf,
    fetchGift,
  } = VB['sim/agents'];
  const { isOpen } = VB['sim/kinds'];
  const { emit } = VB['sim/events'];
  const { eligible } = VB['sim/eligibility'];
  const Culture = VB['culture'];
  const { holdingOf, membersOf, voiceOf, spouseOf, personEvent } = VB['sim/records'];
  const { cal, WORK, SOCIAL, TICKS } = VB['sim/rules'];
  const { relationsOf, opinionWord } = VB['sim/relations'];
  const { setWish, resetWish, endPartner } = VB['sim/wishes'];
  const { settleGift } = VB['sim/exchange'];
  // Verbs carried out by systems loaded after this module (sim/heirs, sim/trust, sim/lifecycle, sim/clock) find them when they run.
  const later = (key) => VB[key];
  const option = (c) =>
    !(c.args && Number.isInteger(c.args.dim) && c.args.dim >= 0 && c.args.dim < Culture.DIMS.length)
      ? `there is no custom ${c.args && c.args.dim}`
      : !(Number.isInteger(c.args.option) && c.args.option >= 0 && c.args.option < Culture.NOPT[c.args.dim])
        ? `custom ${c.args.dim} has no option ${c.args.option}`
        : null;
  // The live trust of household id's farm (st.liveTrusts, sim/trust; read as sim/ownership's trustOf reads it), or null.
  const trustOf = (st, id) => (st.liveTrusts || []).map((i) => st.trusts[i]).find((t) => t.household === id) || null;
  const home = (st, id) => Number.isInteger(id) && st.households[id] && !st.households[id].dissolved;
  const settlement = (st, c) =>
    c.actor && st.cenv && st.cenv.settlements[c.actor.settlement]
      ? null
      : `there is no settlement ${c.actor && c.actor.settlement}`;
  // A command names its actor (a pawn id), a verb from VERBS, its target and arguments, and its source: 'planner' (the job matcher),
  // later 'player', 'debug', 'meeting', 'round' (VB-168 to VB-171) or 'occasion' (VB-126). Each verb checks the command and returns why it is refused, or null;
  // then carries it out. The systems below a verb are unchanged: a command decides nothing, it only puts a name between choosing and doing.
  const causeWait = (st, p) => {
    // why the pawn may not take up a new cause yet, or null
    const left = Culture.causeFree(p) - st.cenv.t;
    return left > 0
      ? `took up a cause ${(Culture.P.causeEvery - left).toFixed(1)} years ago: ${left.toFixed(1)} more before a new one`
      : null;
  };
  const living = (st, id) =>
    st.pawns[id] && st.pawns[id].died === null && st.agents[id] ? null : `pawn ${id} is not a living pawn`;
  // A living pawn not on a journey (VB-287): on the road it takes no work, walks nowhere else and goes to no occasion.
  const free = (st, id) => living(st, id) || (travelling(st.agents[id]) ? `pawn ${id} is on the road` : null);
  // A `give` command as the offer of a gift (VB-690): to the receiving household's holder, or the household or village itself where no pawn
  // holds it; the terms are the command's args
  // Why gift g (sim/offers giftOf) cannot be fetched, or null: one to a household from another farmstead or a village store, with no
  // carrier, is set aside where it lies and fetched by a member of the receiving household (VB-461), who must be free to go.
  const fetched = (g) =>
    !g.carrier && 'farmstead' in g.to && !('farmstead' in g.from && g.from.farmstead === g.to.farmstead);
  function fetchWhy(st, g) {
    if (typeof g === 'string' || !fetched(g)) return null;
    return fetcherOf(st, g.to) < 0 ? 'no one of the household can fetch it' : null;
  }
  function giftOffer(st, c) {
    const t = c.target,
      hh = Number.isInteger(t) && home(st, t) ? st.households[t] : null,
      to = hh && hh.holder !== null ? hh.holder : Number.isInteger(t) ? { household: t } : t;
    return { actor: c.actor, verb: 'offer', target: to, args: { basis: 'gift', gives: c.args }, source: c.source };
  }
  // The head of household c.target, or why the actor is not: a living pawn that holds it, or {household} for a household with no holder
  // (its own rule); the household has a standing plan (VB-253).
  function heads(st, c) {
    const id = c.target;
    if (!home(st, id) || !st.plans.households.has(id)) return `there is no household ${id} with a plan`;
    const hh = st.households[id];
    if (Number.isInteger(c.actor))
      return (
        living(st, c.actor) ||
        (hh.holder !== c.actor
          ? `pawn ${c.actor} is not the head of household ${id}: only its head changes its plan`
          : null)
      );
    return c.actor && c.actor.household === id && hh.holder === null
      ? null
      : `only the head of household ${id} changes its plan`;
  }
  const farmOf = (st, c) => {
    const hh = st.households[c.target];
    return hh.farmstead !== null && st.farmsteads[hh.farmstead].household === hh.id
      ? null
      : `household ${c.target} has no farm of its own`;
  };
  const landWhat = (what) => (what === 'field' || what === 'meadow' ? null : `there is no land project ${what}`);
  // The tile a land project `what` is begun on: args.tile, else the tile the plan names, else the holder's own pick (-1: none).
  function landTile(st, hh, args) {
    if (Number.isInteger(args.tile)) return args.tile;
    const named = st.plans.households.get(hh.id).tiles[args.what];
    if (named >= 0) return named;
    return args.what === 'field'
      ? later('sim/fields').pickField(st, st.farmsteads[hh.farmstead], hh)
      : later('sim/meadows').pickMeadow(st, st.farmsteads[hh.farmstead], hh);
  }
  const VERBS = {
    // work(job): leave the job in hand, if any (it keeps its progress), and set out for the job with key `target`
    work: {
      check: (st, c) =>
        free(st, c.actor) ||
        (!st.jobs.has(c.target)
          ? `there is no job ${c.target}`
          : !isOpen(st.jobs.get(c.target))
            ? `job ${c.target} has no room`
            : attentionOf(st.jobs.get(c.target)) !== 'full'
              ? sideWhy(st, st.agents[c.actor], st.jobs.get(c.target))
              : null),
      run: (st, c) => {
        const a = st.agents[c.actor],
          j = st.jobs.get(c.target);
        if (attentionOf(j) !== 'full') {
          hold(st, a, j);
          return;
        } // a partial or background task is held beside the pawn's task (VB-251)
        release(st, a);
        start(st, a, j);
        a.basis = eligible(st, j, st.pawns[a.id]);
        if (a.side) reachAfter(st, a);
      },
    },
    // walkTo(tile): walk to the tile, to the spot args {x, y} in map units (the tile's centre if absent), by the cheapest route
    walkTo: {
      // Not refused on a tile the walking rule closes: an idle walk to company may end on a river tile (twice in a founders year at seed 7),
      // and the walk goes ahead as it always has; refusing it would change behaviour (VB-168). A player's walk should offer open tiles only.
      check: (st, c) =>
        free(st, c.actor) ||
        (!(Number.isInteger(c.target) && c.target >= 0 && c.target < st.w.N) ? `there is no tile ${c.target}` : null),
      run: (st, c) => {
        const x = c.args && c.args.x !== undefined ? c.args.x : st.w.hx[c.target],
          y = c.args && c.args.y !== undefined ? c.args.y : st.w.hy[c.target];
        walkTo(st, st.agents[c.actor], c.target, x, y, !!(c.args && c.args.near));
      },
    },
    // goHome: walk home and go in (phase 'home')
    goHome: {
      check: (st, c) =>
        free(st, c.actor) || (st.pawns[c.actor].household === null ? `pawn ${c.actor} has no home` : null),
      run: (st, c) => goHome(st, st.agents[c.actor]),
    },
    // idle(until): look for nothing to do until game time args.until
    idle: {
      check: (st, c) =>
        free(st, c.actor) ||
        (!(c.args && c.args.until >= st.t) ? `idle until ${c.args && c.args.until}, which is past` : null),
      run: (st, c) => idle(st, st.agents[c.actor], c.args.until),
    },
    // haltForTalk(until): pause an idle outdoor pawn until the talk ends, leaving work and indoor pawns alone
    haltForTalk: {
      check: (st, c) =>
        living(st, c.actor) ||
        (!(c.args && c.args.until >= st.t)
          ? `talk until ${c.args && c.args.until}, which is past`
          : commanded(st, c.actor)
            ? `pawn ${c.actor} is on the player's command`
            : null),
      run: (st, c) => haltForTalk(st, st.agents[c.actor], c.args.until),
    },
    // attend(occasion): set out for the occasion with id `target` (sim/occasions; source 'occasion'), leaving the work in hand, walk to a spot
    // about it and stand there until its end
    attend: {
      check: (st, c) => free(st, c.actor) || later('sim/occasions').cannotAttend(st, c.actor, c.target),
      run: (st, c) => {
        const a = st.agents[c.actor];
        release(st, a);
        const [tile, x, y, until] = later('sim/occasions').join(st, a, c.target);
        walkTo(st, a, tile, x, y);
        idle(st, a, until);
      },
    },
    // ---- offers (VB-690): one pawn offers another a crossing between households, the other answers (sim/offers' BASES) ----
    // offer(target, {basis, gives, wants, due, given}): the actor offers pawn `target` the terms of `basis`; due at args.due (game hours,
    // within a year; at once when absent); `given` (the round only) the answer keys the played pawn's own wish has said yes to
    offer: {
      check: (st, c) =>
        living(st, c.actor) ||
        (c.args && c.args.given && c.args.given.length && c.source !== 'round'
          ? 'only the round makes an offer with answers given'
          : later('sim/offers').cannotOffer(st, c)),
      run: (st, c) => later('sim/offers').make(st, c, (c.args && c.args.given) || []),
    },
    // answer(target, {yes}): the actor answers the open offer `target`, all its answers in it at once; the offer closes at a no, or when
    // all have said yes (an unplayed pawn answers by its own judgement when the offer falls due: sim/offers)
    answer: {
      check: (st, c) =>
        living(st, c.actor) ||
        (!(c.args && typeof c.args.yes === 'boolean')
          ? `cannot answer ${JSON.stringify(c.args && c.args.yes)}`
          : later('sim/offers').cannotAnswer(st, c.actor, c.target)),
      run: (st, c) => later('sim/offers').answer(st, c.actor, c.target, c.args.yes),
    },
    // give(target, {good, n, carrier}) (source 'help', 'player'; VB-216): the offer of a gift, made by the actor's household, or its village
    // store, to household `target` or the village store (target {village}); refused when it would take the giver below its floor or beyond
    // its allowance (sim/exchange). The receiver's holder answers it; a yes delivers it.
    give: {
      check: (st, c) =>
        later('sim/offers').cannotOffer(st, giftOffer(st, c)) ||
        fetchWhy(st, later('sim/offers').giftOf(st, c.actor, c.target, c.args, c.source)),
      // help (source 'help') answers a hungry household's ask (sim/help): its receiver said yes in asking
      run: (st, c) => later('sim/offers').make(st, giftOffer(st, c), c.source === 'help' ? ['to'] : []),
    },
    // deliver(target, {good, n, carrier}) (source 'offer' only: what a yes settles): the actor's household, or village store, hands over n
    // of good to household `target` or the village store; with a carrier (a pawn of the giving household) it is carried to the receiver
    // and booked there when he arrives (VB-291); from another farmstead or a village store with none, it is set aside where it lies and
    // fetched by a member of the receiving household (VB-461: fetchWhy). Refused when the goods are no longer there.
    deliver: {
      check: (st, c) => {
        if (c.source !== 'offer') return 'goods are delivered only as an offer settles';
        const g = later('sim/offers').delivery(st, c);
        return typeof g === 'string' ? g : fetchWhy(st, g);
      },
      run: (st, c) => {
        const g = later('sim/offers').delivery(st, c);
        if (g.carrier !== undefined) carryGift(st, g);
        else if (fetched(g))
          fetchGift(st, Object.assign(g, { fetcher: fetcherOf(st, g.to) })); // set aside, fetched (VB-461)
        else settleGift(st, g);
      },
    },
    // ---- the head's plan (VB-253; design.md section 7, The player as head; section 15, Parity of command): household `target`'s head
    // chooses, the player in it (source 'player') or its own rule (source 'pawn'; the actor {household} for a household with no holder), and
    // the same check binds both. A target or the hold on projects lasts until cleared, a tile until it is used, an order until the season's
    // plan is made again ----
    // target({store, n}): the plan's target of `store` becomes n, within its bounds (sim/plans' targetBounds: hay 0 to 3 winters, fields 0
    // to what the hands can till, wood 0 to twice the winter's goal, cow 0 or 1); n null clears it, and the holder's rule sets it again
    target: {
      check: (st, c) =>
        heads(st, c) ||
        (!c.args || c.args.n === undefined
          ? 'a target names n, or null to clear it'
          : later('sim/plans').targetWhy(st, c.target, c.args.store, c.args.n)),
      run: (st, c) => later('sim/plans').setTarget(st, c.target, c.args.store, c.args.n),
    },
    // tile({what, tile}): the tile of the next field or meadow (what) becomes `tile`, under the checks of the holder's own choice (sim/fields'
    // fieldWhy, sim/meadows' meadowWhy: claims, reach, the farm's block); tile null or -1 clears it
    tile: {
      check: (st, c) => {
        const why = heads(st, c) || farmOf(st, c) || landWhat(c.args && c.args.what);
        if (why || c.args.tile === null || c.args.tile === -1) return why;
        const hh = st.households[c.target];
        return c.args.what === 'field'
          ? later('sim/fields').fieldWhy(st, st.farmsteads[hh.farmstead], hh, c.args.tile)
          : later('sim/meadows').meadowWhy(st, st.farmsteads[hh.farmstead], hh, c.args.tile);
      },
      run: (st, c) => later('sim/plans').nameTile(st, c.target, c.args.what, c.args.tile === null ? -1 : c.args.tile),
    },
    // order({steps}): the season's routines in this order (the seasonal plan's, each once), until the next season's plan
    order: {
      check: (st, c) => heads(st, c) || later('sim/plans').orderWhy(st, c.target, c.args && c.args.steps),
      run: (st, c) => later('sim/plans').setOrder(st, c.target, c.args.steps),
    },
    // project({what, tile}): begin a new field or meadow (what) now, on `tile`, else the tile the plan names, else the holder's own pick;
    // refused while a project is under way, and under the tile's checks. The land step is the holder's rule for it (sim/plans, source
    // 'pawn'). what 'none': the head holds off projects (its rule begins none: the land step, the boat, the tar pit); null clears that.
    // VB-255's menu of projects adds its own whats.
    project: {
      check: (st, c) => {
        const what = c.args && c.args.what,
          why = heads(st, c);
        if (why || what === 'none' || what === null) return why;
        const bad = farmOf(st, c) || landWhat(what);
        if (bad) return bad;
        const hh = st.households[c.target],
          tile = landTile(st, hh, c.args);
        return tile < 0
          ? `no tile within reach can be taken in for a ${what}`
          : later('sim/plans').landWhy(st, hh, what, tile);
      },
      run: (st, c) => {
        const P = later('sim/plans'),
          what = c.args.what;
        if (what === 'none' || what === null) P.holdProject(st, c.target, what === 'none');
        else P.beginLand(st, st.households[c.target], what, landTile(st, st.households[c.target], c.args));
      },
    },
    // barn(): begin a barn on the household's farm, a project at the house (VB-255; sim/building's barnSteps; its checks sim/aims' barnWhy)
    barn: {
      check: (st, c) => heads(st, c) || later('sim/aims').barnWhy(st, st.households[c.target]),
      run: (st, c) => {
        const f = st.farmsteads[st.households[c.target].farmstead];
        later('sim/plans').makeProject(st, 'household', c.target, {
          what: 'barn',
          steps: later('sim/building').barnSteps(f.house),
        });
      },
    },
    // heirFarm({heir}): begin clearing a plot and building its cottage for pawn `heir`, an adult of the household with no farm, as the
    // household's project (VB-255; sim/expansion's plot, held by the household; its checks sim/aims' heirWhy)
    heirFarm: {
      check: (st, c) => heads(st, c) || later('sim/aims').heirWhy(st, st.households[c.target], c.args && c.args.heir),
      run: (st, c) => {
        const hh = st.households[c.target];
        emit(st, 'heirFarm', {
          village: st.farmsteads[hh.farmstead].village,
          heir: c.args.heir,
          by: hh.id,
        });
      },
    },
    // plotToVillage({plan, why}): household target's plot for its heir (project plan `plan`) passes to its village, its tiles and work with
    // it (VB-255; sim/expansion hears it by an event): its head gives it up, the household dissolves, the heir cannot take it
    plotToVillage: {
      check: (st, c) =>
        later('sim/projects')
          .projectsOf(st, 'household', c.target)
          .some((p) => p.what === 'plot' && p.id === (c.args && c.args.plan))
          ? null
          : `household ${c.target} has no plot ${c.args && c.args.plan} under way`,
      run: (st, c) =>
        emit(st, 'plotToVillage', { household: c.target, plan: c.args.plan, why: c.args.why || 'given up' }),
    },
    // dropProject({id, hold}): give up the household's project under way (args.id, the plan's id, when given: a field, a meadow, a boat,
    // a tar pit, ...), and with hold, hold off projects as project 'none' does
    dropProject: {
      check: (st, c) => {
        const why = heads(st, c);
        if (why) return why;
        const p = later('sim/projects').projectOf(st, 'household', c.target);
        return !p
          ? `household ${c.target} has no project under way`
          : c.args && c.args.id !== undefined && c.args.id !== p.id
            ? `household ${c.target} has no project ${c.args.id} under way`
            : null;
      },
      run: (st, c) => {
        const P = later('sim/plans');
        P.giveUp(st, st.households[c.target], later('sim/projects').projectOf(st, 'household', c.target));
        if (c.args && c.args.hold) P.holdProject(st, c.target, true);
      },
    },
    // ---- a settlement's meeting (source 'meeting') ----
    // decide({dim, option}): the settlement's practice of the custom becomes the option
    decide: {
      check: (st, c) =>
        settlement(st, c) ||
        option(c) ||
        (st.cenv.settlements[c.actor.settlement].practice[c.args.dim] === c.args.option
          ? 'the practice is that already'
          : null),
      run: (st, c) => {
        st.cenv.settlements[c.actor.settlement].practice[c.args.dim] = c.args.option;
      },
    },
    // routines({routines, by}): the village's routines this year (VB-257) become args.routines, set by the meeting's decision (by
    // 'meeting') or, when it did not decide, by its culture's practice (by 'nothing' or 'asLastYear'; sim/lifecycle)
    routines: {
      check: (st, c) =>
        settlement(st, c) ||
        (!st.plans.villages.has(c.actor.settlement)
          ? `village ${c.actor.settlement} has no plan`
          : !(c.args && ['meeting', 'nothing', 'asLastYear'].includes(c.args.by))
            ? `routines cannot be set by ${c.args && c.args.by}`
            : later('sim/plans').routinesWhy(c.args.routines)),
      run: (st, c) => later('sim/plans').setRoutines(st, c.actor.settlement, c.args.routines, c.args.by),
    },
    // ---- the moving round (source 'round'); what the round weighs to choose stays with it, the verbs check only what makes the act possible ----
    // goBack(target, {why}): the actor, holder of household `target`'s farm held in trust by kin (VB-309, sim/trust), goes back to it with
    // its people, and the trust ends: at its marriage, a servant at the round, its coming of age or the trustee's end (args.why)
    goBack: {
      check: (st, c) =>
        living(st, c.actor) ||
        (!trustOf(st, c.target)
          ? `household ${c.target} is not held in trust`
          : st.households[c.target].holder !== c.actor
            ? `pawn ${c.actor} does not hold household ${c.target}`
            : null),
      run: (st, c) => later('sim/trust').endTrust(st, trustOf(st, c.target), (c.args && c.args.why) || 'return'),
    },
    // goToKin(target, {why, ward}): the actor, holder of household `target`, which nobody can come to (sim/service: VB-308's search found
    // nobody, or an orphaned heir with no guardian, args.ward), goes to the kin household that will hold its farm in trust (VB-309)
    goToKin: {
      check: (st, c) =>
        living(st, c.actor) ||
        (!home(st, c.target)
          ? `there is no household ${c.target}`
          : st.households[c.target].holder !== c.actor
            ? `pawn ${c.actor} does not hold household ${c.target}`
            : trustOf(st, c.target)
              ? `household ${c.target} is held in trust already`
              : later('sim/trust').trusteeFor(st, st.households[c.target], (c.args && c.args.ward) ?? null) === null
                ? 'no kin household within reach can hold the farm'
                : null),
      run: (st, c) =>
        later('sim/trust').holdInTrust(st, st.households[c.target], c.args.why, (c.args && c.args.ward) ?? null),
    },
    // marry(target, {home}): the actor and the target marry and live in household args.home
    marry: {
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
      run: (st, c) => later('sim/lifecycle').wed(st, c.actor, c.target, c.args.home),
    },
    // handOn(target, {household, reason}): the actor, holding household args.household, hands it to the heir `target`
    handOn: {
      check: (st, c) =>
        !home(st, c.args && c.args.household)
          ? `there is no household ${c.args && c.args.household}`
          : st.households[c.args.household].holder !== c.actor
            ? `pawn ${c.actor} does not hold household ${c.args.household}`
            : living(st, c.target),
      run: (st, c) => later('sim/heirs').transfer(st, st.households[c.args.household], c.target, c.args.reason),
    },
    // serve(target): the actor goes into service with the holder of household `target`
    serve: {
      check: (st, c) =>
        living(st, c.actor) ||
        (!home(st, c.target)
          ? `there is no household ${c.target}`
          : st.pawns[c.actor].household === c.target
            ? `pawn ${c.actor} lives there already`
            : null),
      run: (st, c) => later('sim/service').enterService(st, c.actor, c.target),
    },
    // claim(target): the actor claims the empty farm `target` and sets about restoring it
    claim: {
      check: (st, c) =>
        living(st, c.actor) ||
        (!st.farmsteads[c.target]
          ? `there is no farm ${c.target}`
          : !later('sim/farmclaims').claimable(st, st.farmsteads[c.target])
            ? `farm ${c.target} cannot be claimed`
            : null),
      run: (st, c) => later('sim/farmclaims').startClaim(st, st.farmsteads[c.target], c.actor),
    },
    // leave({from, party: {all, followers}, house, field, village}): the actor's party leaves village `from` to settle at `house` with its first
    // `field`: in the small village `village` if given, else founding a new one; provisions as the round reckons them
    leave: {
      check: (st, c) => {
        const a = c.args || {},
          S = later('sim/settle');
        if (!st.villages[a.from]) return `there is no village ${a.from}`;
        if (!a.party || !Array.isArray(a.party.all) || a.party.all[0] !== c.actor)
          return 'the party must be led by the actor';
        for (const id of a.party.all) {
          const dead = living(st, id);
          if (dead) return dead;
        }
        if (![a.house, a.field].every((t) => Number.isInteger(t) && t >= 0 && t < st.w.N))
          return 'the house and field must be tiles';
        if (a.village !== undefined && !st.villages[a.village]) return `there is no village ${a.village}`;
        return S.provisions(st, a.party.all) ? null : 'the family cannot spare the grain';
      },
      run: (st, c) => {
        const a = c.args,
          S = later('sim/settle'),
          home = st.villages[a.from],
          party = { all: a.party.all, followers: a.party.followers || [] };
        const prov = S.provisions(st, party.all);
        if (a.village !== undefined) S.settleFarm(st, st.villages[a.village], home, party, a.house, a.field, prov);
        else S.found(st, home, st.pawns[c.actor], party, { house: a.house, field: a.field }, prov);
      },
    },
    // A restored farm gains its household; construction keeps plot/farm-specific steps in their owners.
    foundHousehold: {
      check: (st, c) => {
        const f = st.farmsteads[c.target],
          a = c.args || {};
        if (!f || f.household !== null) return 'there is no empty farm';
        if (!Array.isArray(a.members) || !a.members.includes(c.actor) || new Set(a.members).size !== a.members.length) {
          return 'the household must include its holder and unique members';
        }
        for (const id of a.members) {
          const dead = living(st, id);
          if (dead) return dead;
        }
        return later('sim/stores').partsOk(a.grain) ? null : 'invalid provisions';
      },
      run: (st, c) =>
        later('sim/membership').foundHousehold(st, st.farmsteads[c.target], c.args.members, c.actor, {
          grain: c.args.grain,
        }),
    },
    finishCottage: {
      check: (st, c) => {
        const v = st.villages[c.args && c.args.village],
          X = later('sim/expansion'),
          plot = v && X.livePlots(st, v).find((p) => p.plot === c.target);
        return plot && X.cottageAt(plot) >= 3 ? null : 'there is no finished cottage';
      },
      run: (st, c) =>
        later('sim/cottage').finishCottage(
          st,
          later('sim/expansion')
            .livePlots(st, st.villages[c.args.village])
            .find((p) => p.plot === c.target),
        ),
    },
    // ---- debug actions (source 'debug') ----
    kill: {
      check: (st, c) => living(st, c.actor),
      run: (st, c) => later('sim/lifecycle').killPawn(st, c.actor, 'killed'),
    },
    // retire: a holder hands the farm to the first heir
    retire: {
      check: (st, c) => {
        const dead = living(st, c.actor);
        if (dead) return dead;
        const hh = holdingOf(st, c.actor);
        return !hh || hh.dissolved
          ? `pawn ${c.actor} holds no farm`
          : !later('sim/heirs').heirRanking(st, hh).length
            ? 'the farm has no heir'
            : null;
      },
      run: (st, c) => later('sim/lifecycle').retireHolder(st, holdingOf(st, c.actor).id),
    },
    // argue({dim, option}): the pawn takes up the cause for Culture.P.causeEvery years (the debug's, and the player's for its pawn: VB-211); it
    // replaces any cause held. A cause is a long agenda: no new one within those years of the last one taken up (the debug's is not held to that).
    argue: {
      check: (st, c) =>
        living(st, c.actor) || option(c) || (c.source === 'debug' ? null : causeWait(st, st.pawns[c.actor])),
      run: (st, c) => {
        const d = Culture.DIMS[c.args.dim];
        Culture.advocate(st.pawns[c.actor], c.args.dim, c.args.option, st.cenv.t + Culture.P.causeEvery, st.cenv.t);
        personEvent(
          st,
          c.actor,
          'cause',
          `Took up the cause: ${d.label.toLowerCase()}, ${d.opts[c.args.option][1].toLowerCase()}`,
        );
      },
    },
    // dropCause: the pawn lays down the cause it argues
    dropCause: {
      check: (st, c) => living(st, c.actor) || (st.pawns[c.actor].advocate ? null : 'the pawn argues no cause'),
      run: (st, c) => {
        const p = st.pawns[c.actor],
          d = Culture.DIMS[p.advocate.dim];
        Culture.advocate(p, null);
        personEvent(st, c.actor, 'cause', `Dropped the cause: ${d.label.toLowerCase()}`);
      },
    },
    // rally({dim, option}): a fifth of the settlement's voices, the most esteemed first, take up the cause
    rally: {
      check: (st, c) => settlement(st, c) || option(c),
      run: (st, c) => {
        const s = st.cenv.settlements[c.actor.settlement];
        const voiced = membersOf(st, s.id)
          .filter((q) => voiceOf(st, q, s) > 0)
          .sort((x, y) => y.prestige - x.prestige);
        const want = Math.max(1, Math.ceil(voiced.length * 0.2));
        for (const q of voiced.slice(0, want))
          Culture.advocate(q, c.args.dim, c.args.option, st.cenv.t + Culture.P.causeEvery, st.cenv.t);
      },
    },
    // skip({hours}): the world goes on for that long (no actor), whole 6-minute steps (VB-244)
    skip: {
      check: (st, c) => {
        const h = c.args && c.args.hours;
        if (!(h > 0 && Number.isFinite(h))) return `cannot skip ${h} hours`;
        const x = h * TICKS;
        return Math.abs(x - Math.round(x)) < 1e-6
          ? null
          : `cannot skip ${h} hours: not a whole number of 6-minute steps`;
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
  //   refused (null, or {verb, why, t}: the last command refused when its turn came), since (game hours), left (null while the pawn
  //   lives; from its death {t, held (the household it held, or null), spouse (pawn id or null), ties[] (at most TIES_MAX {id, why}: those
  //   it thought friends, best first)}: what a death erases and the player's succession needs, VB-213)}; plain data, saved with the run
  const QUEUE_MAX = 8,
    TIES_MAX = 12;
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
  const commanded = (st, id) => {
    const pl = st.player;
    return !!pl && pl.pawn === id && pl.queue.length > 0;
  };
  const unplanned = (st, id) => {
    const pl = st.player;
    return !!pl && pl.pawn === id && (pl.queue.length > 0 || !pl.auto);
  };
  function inhabit(st, id) {
    const dead = living(st, id);
    if (dead) return dead;
    if (st.player) uninhabit(st);
    st.player = {
      pawn: id,
      auto: true,
      queue: [],
      refused: null,
      since: st.t,
      left: null,
    };
    resetWish(st, id); // the player starts from the default wish (VB-680): its wishes are the pawn's (pawn.wish, sim/wishes)
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
    const held = holdingOf(st, id),
      friends = relationsOf(st, id).filter((r) => r.opinion >= SOCIAL.friend);
    friends.sort((x, y) => y.opinion - x.opinion || x.id - y.id);
    pl.queue = [];
    pl.left = {
      t: st.t,
      held: held ? held.id : null,
      spouse: spouseOf(st, id),
      ties: friends.slice(0, TIES_MAX).map((r) => ({ id: r.id, why: opinionWord(r.opinion) })),
    };
  }
  // The player goes on as pawn id after its pawn's death: `text` is written to the dead pawn's events, and id is played from now, with
  // nothing queued and no wishes. sim/opportunities' succeed checks who may be chosen; true, or why not.
  function goOnAs(st, id, text) {
    const pl = st.player;
    if (!pl || !pl.left) return 'the played pawn has not died';
    const dead = living(st, id);
    if (dead) return dead;
    personEvent(st, pl.pawn, 'player', text);
    st.player = null;
    return inhabit(st, id);
  }
  // Needs go on: with nothing left to do after the end of work, the player's pawn goes home, as everyone did at dark.
  function homeAtDark(st, pl) {
    const a = st.agents[pl.pawn],
      h = cal(st.t).hour;
    if ((h >= WORK[1] || h < WORK[0]) && !a.inside && a.phase === null)
      issue(st, { actor: pl.pawn, verb: 'goHome', source: 'planner' });
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
    pl.queue.push({
      actor: pl.pawn,
      verb: cmd.verb,
      target: copy(cmd.target),
      args: copy(cmd.args),
      source: 'player',
      begun: null,
    });
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
  // The wish verb (VB-212, VB-680): the played pawn's wish at the moving round, written on the pawn as every pawn's is (pawn.wish,
  // sim/wishes); the round reads it as anyone's and decides by its rules, so a wish is not checked against them here; it stays until
  // changed. True, or why it is not a wish.
  function wish(st, kind, value) {
    const pl = st.player;
    if (!pl) return 'no pawn is played';
    if (!['out', 'claim', 'serve', 'match', 'settle', 'rank'].includes(kind)) return `there is no wish ${kind}`;
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
    if (kind === 'match' && id && (target.sex === st.pawns[pl.pawn].sex || !target.alive))
      return `${value} is not one the pawn may marry`;
    return setWish(st, pl.pawn, kind, value);
  }
  // A wish for a match ends when the one who wished or the wished partner marries (a and b have married) or dies (a is b).
  const clearMatchWish = (st, a, b) => endPartner(st, a, b);
  // Each six-minute step (sim/clock), before the agents move: a begun head whose act has ended leaves the queue, and the next command is
  // issued; one refused then is dropped, its reason kept in `refused`. A load being carried home is delivered first, as at the end of work.
  function playerStep(st) {
    const pl = st.player;
    if (!pl || !pl.queue.length) return;
    const a = st.agents[pl.pawn],
      q = pl.queue;
    if (q[0].begun !== null) {
      const lasts = LASTS[q[0].verb];
      if (lasts && !living(st, pl.pawn) && lasts(st, a, q[0])) return;
      q.shift();
    }
    while (q.length) {
      if (a.phase === 'back') return;
      // told to walk, go home or idle, the pawn leaves the job in hand, which keeps its progress (work leaves it itself): only if it may
      const cmd = q[0],
        leaves = !!a.job && cmd.verb !== 'work' && !!LASTS[cmd.verb],
        barred = leaves ? VERBS[cmd.verb].check(st, cmd) : null;
      if (leaves && !barred) release(st, a);
      const why = barred || issue(st, cmd);
      if (why === true) {
        cmd.begun = st.t;
        return;
      }
      q.shift();
      pl.refused = { verb: cmd.verb, why, t: st.t };
    }
    if (!living(st, pl.pawn)) homeAtDark(st, pl);
  }
  // The played pawn answers the open marriage offer offerId (VB-293; the first question asked through Decisions.answer, which slice 5's
  // Decisions module takes over): true, or why not.
  function answer(st, offerId, yes) {
    if (!st.player) return 'no pawn is played';
    return issue(st, { actor: st.player.pawn, verb: 'answer', target: offerId, args: { yes }, source: 'player' });
  }
  // The played pawn chooses as head of its household (VB-253, for the page's plan panel, VB-256): verb one of HEAD_VERBS, at once, not
  // queued (a choice of the plan takes no time); its target the household it holds, else the one it lives in, so a pawn that is not the
  // head is refused with the reason. True, or why not.
  const HEAD_VERBS = ['target', 'tile', 'order', 'project', 'dropProject'];
  function head(st, verb, args) {
    const pl = st.player;
    if (!pl) return 'no pawn is played';
    if (!HEAD_VERBS.includes(verb)) return `${verb} is not a choice of the plan`;
    const held = holdingOf(st, pl.pawn),
      target = held && !held.dissolved ? held.id : st.pawns[pl.pawn].household;
    return issue(st, { actor: pl.pawn, verb, target, args: args || {}, source: 'player' });
  }
  return {
    issue,
    VERBS,
    head,
    QUEUE_MAX,
    commanded,
    unplanned,
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
  };
})();
