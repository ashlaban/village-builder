// @sys sim/commands: commands, the one way an actor acts: plain data {actor, verb, target, args, source}, checked, then carried out (VB-167)
VB['sim/commands'] = (() => {
  const { start, release, walkTo, goHome } = VB['sim/agents'];
  const { isOpen } = VB['sim/kinds'];
  const Culture = VB['culture'];
  const { holdingOf, membersOf, voiceOf, spouseOf } = VB['sim/records'];
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
  // later 'player', 'debug', 'meeting' or 'round' (VB-168 to VB-171). Each verb checks the command and returns why it is refused, or null;
  // then carries it out. The systems below a verb are unchanged: a command decides nothing, it only puts a name between choosing and doing.
  const living = (st, id) => (st.pawns[id] && st.pawns[id].died === null && st.agents[id] ? null : `pawn ${id} is not a living pawn`);
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
      run: (st, c) => { const a = st.agents[c.actor]; goHome(st, a); a.phase = 'home'; },
    },
    // idle(until): look for nothing to do until game time args.until
    idle: {
      check: (st, c) => living(st, c.actor) || (!(c.args && c.args.until >= st.t) ? `idle until ${c.args && c.args.until}, which is past` : null),
      run: (st, c) => { st.agents[c.actor].idleUntil = c.args.until; },
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
    // argue({dim, option}): the pawn takes up the cause for ten years
    argue: {
      check: (st, c) => living(st, c.actor) || option(c),
      run: (st, c) => { st.pawns[c.actor].advocate = { dim: c.args.dim, opt: c.args.option, until: st.cenv.t + 10 }; },
    },
    // rally({dim, option}): a fifth of the settlement's voices, the most esteemed first, take up the cause
    rally: {
      check: (st, c) => settlement(st, c) || option(c),
      run: (st, c) => {
        const s = st.cenv.settlements[c.actor.settlement];
        const voiced = membersOf(st, s.id).filter((q) => voiceOf(st, q, s) > 0).sort((x, y) => y.prestige - x.prestige);
        const want = Math.max(1, Math.ceil(voiced.length * 0.2));
        for (const q of voiced.slice(0, want)) q.advocate = { dim: c.args.dim, opt: c.args.option, until: st.cenv.t + 10 };
      },
    },
    // skip({hours}): the world goes on for that long (no actor)
    skip: {
      check: (st, c) => (c.args && c.args.hours > 0 && Number.isFinite(c.args.hours) ? null : `cannot skip ${c.args && c.args.hours} hours`),
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
  return { issue, VERBS };
})();
