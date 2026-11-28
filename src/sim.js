// @sys sim: the public Sim object, joined from what each sim/* module gives the page, and what it composes itself
// Each module names what it gives the page beside its exports (VB-1944): `PAGE: [name, ...]` in its returned namespace, an entry the
// export's own name or [the name on Sim, the export's name]; `grep -rn "PAGE: \[" src` finds them. Sim joins the lists in the modules'
// load order (src/manifest.json); a name given twice, or also composed below, throws at load. What is left here composes several
// modules, or wraps one for the page: the skip's aids, the reads through the actor view, the debug list, the replay.
const Sim = (() => {
  const joined = {};
  for (const [key, ns] of Object.entries(VB)) {
    if (key === 'sim' || !ns || typeof ns !== 'object' || !Array.isArray(ns.PAGE)) continue;
    for (const entry of ns.PAGE) {
      const [name, exp] = Array.isArray(entry) ? entry : [entry, entry];
      if (!(exp in ns)) throw new Error(`${key} gives the page ${name}, but exports no ${exp}`);
      if (Object.hasOwn(joined, name)) throw new Error(`${key} gives the page ${name}, already given`);
      joined[name] = ns[exp];
    }
  }
  const { TICKS } = VB['sim/rules'];
  const { skipStop: skipStopWith } = VB['sim/skip'];
  const { describe: doing } = VB['sim/agents'],
    { occasionLabel } = VB['sim/occasions'],
    { line: pastimeLine } = VB['sim/pastimes'];
  // What a pawn is doing, for its card: at or on its way to an occasion (VB-126), else as sim/agents tells it.
  // its pastime and with whom (sim/pastimes, VB-1552),
  const describe = (st, id) => occasionLabel(st, st.agents[id]) || pastimeLine(st, id) || doing(st, id);
  const { leviesOf } = VB['sim/levies'];
  const { actorView, forPawn, roundChoice } = VB['sim/opportunities'];
  // The outer levies body ({kind, id}) lays and bears, with their terms and days named, read through the actor view (VB-1767).
  const levies = (st, body) => leviesOf(actorView(st), body);
  const { villageSummary } = VB['sim/overview'];
  // Sim.command(st, cmd): the one door a controller issues through (VB-1757), keyed by the pawn it acts as (cmd.actor), each command
  // recorded with its game time (sim/controller, st.commanded); Sim.decisions(st, pawn), the points open to its controller (sim/points)
  const { command } = VB['sim/controller'];
  // The skip's stop (VB-1101): sim/skip asks, at the round's eve, for a choice the round will read and for the year's food in brief.
  const skipAids = {
    choice: roundChoice,
    brief(st, vid) {
      if (vid === null) return '';
      const s = villageSummary(st, vid);
      return `the last harvest ${Math.round(s.harvest.rations)} rations, the village's food lasts ${Math.round(s.food.days)} days`;
    },
  };
  const skipStop = (st, from) => skipStopWith(st, from, skipAids);
  // What a pawn may do here (and at tile `near`), read through its actor view (sim/opportunities).
  const opportunities = (st, id, near = null) => forPawn(st, actorView(st, id), id, near);
  // The plan record (VB-1752; sim/steps), read through the actor view: why(st, task), the chain of steps above a task, the one that
  // opened it first; plans(st, {kind, id}), a body's record, a copy, with its agent (the head, the alderman, the pawn itself).
  const Steps = VB['sim/steps'];
  const why = (st, j) => Steps.chain(actorView(st), j);
  function plans(st, body) {
    const view = actorView(st),
      r = Steps.recordOf(view, body);
    if (r)
      r.agent =
        body.kind === 'household'
          ? (view.households[body.id].holder ?? null)
          : body.kind === 'village'
            ? (VB['sim/decisions'].agentOf(view, body.id) ?? null)
            : body.id;
    // a household's labour budget and its season's fit beside its season's steps (sim/levies, VB-1778)
    const plan = r && body.kind === 'household' ? view.plans.households.get(body.id) : null;
    if (plan) {
      r.budget = plan.budget ? { ...plan.budget, weeks: plan.budget.weeks.slice() } : null;
      r.fit = plan.fit ? JSON.parse(JSON.stringify(plan.fit)) : null;
    }
    return r;
  }
  // Who of household hh may carry a gift of its holder's to household `to` (VB-1111): its members the verb `give` takes as the carrier,
  // by the verb's own check (sim/offers giftOf), the holder first, then the others by id; none within one farmstead, where nothing is carried.
  const giftCarriers = (st, hh, to) =>
    [hh.holder, ...hh.members.filter((id) => id !== hh.holder)].filter(
      (id) =>
        id !== null &&
        typeof VB['sim/offers'].giftOf(st, hh.holder, to, { good: 'grain', n: 1, carrier: id }, 'player') !== 'string',
    );
  // The facade's direct mutators are debug (VB-681): the world's hand, for the page's debug drawer and the tests, never a pawn's act; a
  // pawn acts by a verb (command, queue, head), whose check asks its right. tests/commands.js holds that none is a verb and that the page
  // calls them only from its drawer.
  // The world's rules run out of turn (refreshRoles, updateTies, refreshInterests, countDemand: the clock runs them) are its hand too (VB-1756).
  const DEBUG = [
    'setOwner',
    'killPawn',
    'retireHolder',
    'holdMeetings',
    'movingRound',
    'refreshRoles',
    'updateTies',
    'refreshInterests',
    'countDemand',
  ];
  const { stakedEach } = VB['sim/building'];
  const { advance } = VB['sim/clock'];
  // Sim.replay(st, entries): the commands recorded since a save (entries of st.commanded, in order: a run's own record past the length the
  // saved state's had), given again on st, the save loaded, each at its game time, the clock advanced to it (VB-1757). The run then goes
  // on as it went, its record again the same. The frame (which pawn is played: Sim.inhabit, uninhabit, succeed), the debug drawer's
  // direct mutators and the page's flags are not commands and are not recorded: a run that changed them since the save is not replayed.
  function replay(st, entries) {
    for (const e of entries) {
      if (e.tick < st.tick) throw new Error(`replay: a command at tick ${e.tick}, the run at ${st.tick}`);
      advance(st, (e.tick - st.tick) / TICKS);
      command(st, JSON.parse(JSON.stringify(e.cmd)));
    }
    return st;
  }

  const composed = {
    landing: VB['sim/landing'],
    Culture: VB['culture'],
    replay,
    DEBUG,
    opportunities,
    describe,
    // (st, pawn, op, args): pawn's verb `plan` on its own plan (VB-1754; sim/plans, its ops sim/controller's PLAN_OPS), a facade
    plan: (st, id, op, args) =>
      Number.isInteger(id) && st.pawns[id]
        ? command(st, {
            actor: id,
            verb: 'plan',
            target: { kind: 'pawn', id },
            args: { ...(args || {}), op },
            source: 'player',
          })
        : `there is no pawn ${id}`,
    levies, // the outer levies a body lays and bears, with their terms, through the actor view (VB-1767)
    why,
    plans,
    // VB-1172: the tiles of the booths staked and not yet raised (each its maker's plan), for the page's ring of stakes; and (VB-1666)
    // the house tiles of the farms whose shelter is being raised (farmstead.shelter, built null), after them
    stakedBooths: (st) => {
      const out = [];
      stakedEach(st, (plan) => out.push(plan.tile));
      for (const f of st.farmsteads) if (f.shelter && f.shelter.built === null) out.push(f.house);
      return out;
    },
    moveCost: (st, pawn, tile) => VB['sim/camp'].moveCost(st, pawn, tile, VB['sim/weather'].frostExpected(st)), // VB-1667
    giftCarriers,
    skipStop,
  };
  for (const name of Object.keys(composed))
    if (Object.hasOwn(joined, name)) throw new Error(`sim composes ${name}, which a module also gives the page`);
  return { ...joined, ...composed };
})();
VB['sim'] = Sim;
if (typeof globalThis !== 'undefined') globalThis.Sim = Sim; // the page script reads it; the bundle (VB-374) keeps the const local
if (typeof module !== 'undefined') module.exports = Sim;
