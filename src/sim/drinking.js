// @sys sim/drinking: the verb `drink` (VB-1554; design.md, Water by the site, The thirsty pawn): a pawn walks to the nearest source it
// may draw at and drinks, and where its household's water is not in takes the household's fetch from there; and the pawns that ended a
// day without a drink, held due (st.thirstDue) until THIRST.leave hours without one, when each leaves whatever it does to drink
VB['sim/drinking'] = (() => {
  const { WORK, cal } = VB['sim/rules'],
    EVENING = VB['sim/roles'].MATCH.day.evening;
  const { register, issue } = VB['sim/commands'];
  const { on } = VB['sim/events'];
  const Due = VB['sim/due'];
  const { log, age, commanded, villageOf, fullName } = VB['sim/records'];
  const { here, travelling } = VB['sim/pose'];
  const { holds, reachAfter } = VB['sim/attention'];
  const { free, start, release, freeHands, dropJob } = VB['sim/agents'];
  const { KINDS, isOpen } = VB['sim/kinds'];
  const { post } = VB['sim/jobs'];
  const { workCommand } = VB['sim/fit'];
  const Water = VB['sim/water'],
    { FRESH, FRESHES } = VB['world/water'];
  const Thirst = VB['sim/thirst'],
    { THIRST } = Thirst;
  const NONE = { tile: -1, cls: FRESH.NONE, walk: 0 };
  // The farm pawn p lives on, when it is at home there: its household's own farm; else null (away, or of no farm).
  function homeFarm(st, p) {
    const hh = p.household === null ? null : st.households[p.household],
      f = hh && hh.farmstead !== null ? st.farmsteads[hh.farmstead] : null;
    return f && f.household === hh.id && st.agents[p.id].away === undefined ? f : null;
  }
  // Where pawn p goes to drink: {tile, cls, walk}, tile -1 when no source is in reach. At home, its farm's source (sim/water: found
  // already, so nothing is searched); away at a bed (a new site, a booth) or of no farm, the nearest source it may draw at by one search
  // outward from where it stands (the site's source; a well only its own village's).
  function sourceFor(st, p) {
    const f = homeFarm(st, p);
    if (f) return Water.sourceOf(st, f);
    const at = here(st, st.agents[p.id]),
      hh = p.household === null ? null : st.households[p.household],
      v = hh && hh.farmstead !== null ? st.villages[villageOf(st, p)] : null;
    return at >= 0 && !st.w.water[at] ? Water.source(st.w, at, v) : NONE;
  }
  // drink: the pawn leaves what it has in hand, walks to its source and drinks (the job kind `drink`, sim/thirst, posted for it alone
  // on the tile it draws at); any pawn's, and the played pawn's. Refused for one on the road (water on a journey is Open), a child
  // under 7 or one ill in bed (given their drink at home), and where no source is in reach. Pending while the pawn holds the drink.
  const keyOf = (id) => `drink:p${id}`;
  register('drink', {
    check: (st, c) => {
      const why = free(st, c.actor);
      if (why) return why;
      const p = st.pawns[c.actor];
      if (!Thirst.goes(st, p))
        return age(st, p) < VB['sim/roles'].CHILD.from
          ? `pawn ${c.actor} is too young to go for its drink`
          : `pawn ${c.actor} is ill in bed`;
      return sourceFor(st, p).tile < 0
        ? `no source of fresh water within ${Water.WATER.search} hours' walk of pawn ${c.actor}`
        : null;
    },
    run: (st, c) => {
      const a = st.agents[c.actor],
        s = sourceFor(st, st.pawns[c.actor]),
        key = keyOf(c.actor);
      release(st, a);
      const old = st.jobs.get(key); // a drink it was called from: taken down, and posted where its source is now
      if (old) {
        if (old.claims.length) freeHands(st, old, -1);
        dropJob(st, old);
      }
      const j = post(st, key, 'drink', { type: 'pawn', id: c.actor }, s.tile, {
        pawn: c.actor,
        cls: s.cls,
        ...(s.cls === FRESH.MARSH ? { poor: true } : {}),
      });
      start(st, a, j);
      a.basis = 'self';
      if (a.side) reachAfter(st, a);
      return { slot: 'full', key, n: a.assigned.full };
    },
    active: (st, c, ref) => holds(st.agents[c.actor], ref),
  });
  // ---- the thirsty pawn: due at THIRST.leave ----
  // @state st.thirstDue: absent until a pawn first ends a day without a drink, then [{pawn, at}, ...] in the order of `at`: the pawns
  //   that ended a day thirsty and go for their own drink, each due at the hour it has been THIRST.leave hours without one (at once
  //   when that is past), and {pawn, at, home: true}: one that drank outside the working day and goes in at the next step. An entry is
  //   taken when due, and none is made again before the pawn's next dry day's end (sim/drinking)
  const atOf = (e) => e.at;
  const hold = (st, e) => Due.append(st.thirstDue || (st.thirstDue = []), e, e.at, atOf, st);
  on('thirsty', (st, id) => {
    if (st.thirstDue && st.thirstDue.some((e) => e.pawn === id && !e.home)) return;
    hold(st, { pawn: id, at: Math.max(st.t, st.pawns[id].drank + THIRST.leave) });
  });
  // The pawn has drunk at a source (sim/thirst, the kind's `done`, within the job's completion): where its household's water is not
  // in and its fetch stands open at this source (or is not posted at this hour of the day, when it is posted here as the kind's own
  // rule posts it), the pawn takes the fetch from there: the walk it made is the fetch's first half. Else, outside the working day,
  // it goes in at the next step.
  on('drank', (st, j) => {
    const p = st.pawns[j.pawn],
      f = homeFarm(st, p),
      c = cal(st.t);
    if (f) {
      const hh = st.households[f.household],
        s = Water.sourceOf(st, f);
      if (hh.waterDay !== c.day && s.tile === j.site && c.hour < EVENING) {
        const key = `water:h${hh.id}:${c.day}`,
          fetch =
            st.jobs.get(key) ||
            post(st, key, 'water', { type: 'household', id: hh.id }, s.tile, {
              farm: f,
              ...(s.cls === FRESH.MARSH ? { poor: true } : {}),
            });
        if (isOpen(st, fetch) && issue(st, workCommand(p.id, key, 'pawn')) === true) return;
      }
    }
    if (c.hour >= WORK[1] || c.hour < WORK[0]) hold(st, { pawn: p.id, at: st.t, home: true });
  });
  // The step's entries due (sim/clock, only while any is held). A thirsty pawn still THIRST.leave hours without a drink leaves
  // whatever it does, a task rank never interrupts as well, and goes to drink (the verb, which names why not: then it waits for its
  // next day's end). One carrying a load home, at an occasion or under the player's command is asked again in an hour.
  function step(st) {
    for (const e of Due.take(st.thirstDue, st.t, atOf, st)) {
      VB.count.thirstDue++;
      const p = st.pawns[e.pawn],
        a = st.agents[e.pawn];
      if (p.died !== null) continue;
      if (e.home) {
        if (!a.job && !a.path && !a.inside && a.phase === null && a.away === undefined && a.occasion === null)
          issue(st, { actor: p.id, verb: 'goHome', source: 'pawn' });
        continue;
      }
      if (Thirst.thirst(st, p) < THIRST.leave || !Thirst.goes(st, p) || travelling(a)) continue;
      if (a.phase === 'back' || a.occasion !== null || commanded(st, p.id)) {
        hold(st, { pawn: p.id, at: st.t + 1 });
        continue;
      }
      // on its way to drink already, or to draw its household's water, where it drinks (sim/chores)
      if (a.job && (a.job.kind === 'drink' || a.job.kind === 'water')) continue;
      const left = a.job ? a.job.kind : null;
      if (issue(st, { actor: p.id, verb: 'drink', source: 'pawn' }) !== true) continue;
      const hh = p.household === null ? null : st.households[p.household],
        f = hh && hh.farmstead !== null ? st.farmsteads[hh.farmstead] : null;
      log(
        st,
        `${fullName(p)}${f ? ` of ${f.name}` : ''}, ${Math.floor(Thirst.thirst(st, p))} hours without a drink, ${
          left ? `left ${KINDS[left].name.toLowerCase()}` : 'went'
        } to drink at ${FRESHES[a.job.cls].name}.`,
        {
          kind: 'thirst',
          pawn: p.id,
          tile: a.job.site,
          ...(left ? { reason: left } : {}),
          ...(f ? { household: hh.id, farm: f.id, village: f.village } : {}),
        },
      );
    }
  }
  return { sourceFor, step };
})();
