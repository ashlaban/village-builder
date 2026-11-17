// @sys sim/away: the nights a pawn spends away from its household's house (VB-783): the open stays, a journey's (a bed where its leg
// ends) and a lodger's (a bed at a place, or a guest's in another house), their packs and meals, and a journey's arrivals and gifts
VB['sim/away'] = (() => {
  const { cal, WORK, SPEED, HEALTH, TRAVEL, AWAY } = VB['sim/rules'];
  const HANDS = [14, 60]; // the ages of a working hand, as sim/agents' (who goes for a gift or carries the quarter)
  const { route, routeCost, hoursBetween } = VB['sim/routes'];
  const { age, personEvent } = VB['sim/records'];
  const Stores = VB['sim/stores'];
  const { ate, rationOf } = VB['sim/hunger'];
  const { receive, booked } = VB['sim/exchange'];
  const { hexSteps } = VB['sim/hex'];
  const { opinionOf } = VB['sim/relations'];
  const { driveHome } = VB['sim/grazing'];
  const { on } = VB['sim/events'];
  const Lying = VB['sim/lying'];
  const {
    travelling,
    stayOf,
    here,
    placeOf,
    tileAt,
    placeAtHome,
    restOnRoad,
    walkLeg,
    turnTo,
    setDown,
    stop,
    waitIndoors,
    standBy,
  } = VB['sim/agents'];
  // Acts this module's pawns choose (going home, coming home from a stay, work at it) go through the verbs (AGENTS.md, Every act is a pawn's).
  const issue = (st, cmd) => VB['sim/commands'].issue(st, cmd);
  // ---- the stays (design.md, Moving to new land, Sleeping away from home) ----
  // @state st.away[]: the open stays, in the order they began (by id), each {id, pawn, why, bed, roof, food, from, to}: why 'move', 'carry',
  //   'fetch' or 'haul' for a journey (VB-287, VB-291, VB-461, VB-849), else the lodger's (the caller's word: 'work', 'visit'); bed the
  //   tile it sleeps at, null on the road (a journey's bed is where its leg ends, sim/agents' bed); roof 'none', 'booth' or 'house' (a
  //   guest's); food the rations of its pack; from the farm it left (a lodger's household's), or null; to the tile it walks to (a journey:
  //   the house of the pawn's household, a carrier's receiver's, a fetcher's stop; a lodger: its bed). A journey's carrier or fetcher
  //   also holds its gift and back (VB-291, VB-461: fetchGift); a lodger its jobs (the keys of the tasks it is away for), walk (the hours
  //   from its house to its bed, its estimate when it set out), host (a guest's: the household whose house it sleeps in) and back (true
  //   once it has turned for home). Plain data, saved; a save with st.journeys loads them as stays. When a journey's legs start and stop
  //   is its pawn's (st.legDue, VB-473): a walk that stops for the night, a wait on the road until 6:00.
  // @state st.awaySeq: number; the next stay's id; ids are never reused (a save's journeySeq)
  // @state agent.away: the id of the pawn's open stay, absent when it is at home: st.away's index, a cache written only here
  // A pawn's stay begins: it is in st.away, and its agent knows it.
  function open(st, s) {
    st.away.push(s);
    st.agents[s.pawn].away = s.id;
  }
  // Stay s ends: out of st.away and the index.
  function close(st, s) {
    st.away.splice(st.away.indexOf(s), 1);
    delete st.agents[s.pawn].away;
  }
  // Stay j's pack topped up to `want` rations from the grain above the seed of the households `from`, in turn (eaten uncooked: a ration
  // away costs 1 / ECON.uncooked of grain).
  function provide(st, j, from, want) {
    const R = 1 / st.ECON.uncooked;
    for (const src of from) {
      const n = Math.min(want - j.food, Math.max(0, Stores.grainOf(src) - Stores.reserved(st, src, 'grain')) / R);
      if (n > 1e-9) {
        Stores.takeSpare(st, src, n * R, { kind: 'away', pawn: j.pawn });
        j.food += n;
      }
    }
  }
  // The day's meal away (sim/clock, after the households' meals): each pawn away eats from its pack, a ration a day (half below 14). A
  // lodger whose stay is over by its meal (stayOver) comes home.
  function feedAway(st) {
    for (const j of st.away) {
      VB.count.awayMeals++;
      const p = st.pawns[j.pawn],
        need = rationOf(st, p),
        eat = Math.min(j.food, need);
      j.food = Math.max(0, j.food - eat);
      ate(st, p, eat, need);
      if (j.bed !== null && !j.back && stayOver(st, j, eat < need - 1e-9))
        issue(st, { actor: j.pawn, verb: 'comeHome', source: 'pawn' });
    }
  }
  // ---- a lodger: a stay at a bed, by the verbs lodge and comeHome (design: Sleeping away from home) ----
  // The walking hours between two tiles, by the route a pawn would take (its estimate of the walk).
  const walkHours = (st, from, to) => (from === to ? 0 : routeCost(st.w, route(st, from, to)) / SPEED);
  const houseOf = (st, hh) => st.farmsteads[hh.farmstead].house;
  // The pack for `days` planned away: a ration a day, at most AWAY.pack.
  const packOf = (st, p, days) => Math.min(days, AWAY.pack) * rationOf(st, p);
  // Why pawn id cannot lodge at tile `at` (args {why, days, jobs, host}), or null: it is at home with a household that has a farm, the
  // household can spare the whole pack from its food above its seed (one with nothing to spare sends nobody), and a guest's bed is in a
  // house of another household whose head says yes (it does not dislike the guest).
  function lodgeWhy(st, id, at, args) {
    const p = st.pawns[id],
      hh = p.household === null ? null : st.households[p.household],
      o = args || {};
    if (st.agents[id].away !== undefined) return `pawn ${id} is away from home already`;
    if (!hh || hh.dissolved || hh.farmstead === null) return `pawn ${id} has no home to go out from`;
    if (typeof o.why !== 'string' || !o.why) return 'a stay names why the pawn is away';
    if (!(Number.isInteger(o.days) && o.days >= 1)) return 'a stay plans a whole number of days, one or more';
    if (o.jobs !== undefined && !Array.isArray(o.jobs)) return 'the tasks of a stay must be a list';
    if (o.host !== undefined && o.host !== null) {
      const host = st.households[o.host];
      if (!host || host.dissolved || host.farmstead === null || host.id === hh.id)
        return `there is no other household ${o.host} to stay with`;
      if (host.holder === null || !st.pawns[host.holder].alive) return `household ${o.host} has no head to ask`;
      if (opinionOf(st, host.holder, id) < 0)
        return `the head of household ${o.host} will not have pawn ${id} as a guest`;
    } else if (!(Number.isInteger(at) && at >= 0 && at < st.w.N)) return `there is no tile ${at}`;
    const R = 1 / st.ECON.uncooked,
      spare = Math.max(0, Stores.grainOf(hh) - Stores.reserved(st, hh, 'grain')) / R;
    return spare + 1e-9 < packOf(st, p, o.days) ? `household ${hh.id} has no food to spare for the pack` : null;
  }
  // Pawn a lodges (the verb `lodge`, its only caller): it lets go of what it has in hand, takes its pack from its household's food above
  // the seed, and its stay is open; the verb walks it to its bed (sim/agents' goHome reads the bed). With args.host its bed is that
  // household's house, roof 'house'; else tile `at`, under the open sky until a booth is built there.
  function lodge(st, a, at, args) {
    const p = st.pawns[a.id],
      hh = st.households[p.household],
      host = args.host === undefined || args.host === null ? null : st.households[args.host],
      b = host ? houseOf(st, host) : at,
      s = {
        id: st.awaySeq++,
        pawn: a.id,
        why: args.why,
        bed: b,
        roof: host ? 'house' : 'none',
        food: 0,
        from: hh.farmstead,
        to: b,
        jobs: [...(args.jobs || [])],
        walk: walkHours(st, houseOf(st, hh), b),
      };
    if (host) s.host = host.id;
    setDown(st, a);
    provide(st, s, [hh], packOf(st, p, args.days));
    open(st, s);
  }
  // Why pawn id cannot come home from a stay, or null: it lodges away and has not turned for home yet.
  function comeHomeWhy(st, id) {
    const s = stayOf(st, id);
    return s && s.bed !== null && !s.back ? null : `pawn ${id} is not lodging away from home`;
  }
  // Pawn a turns for home (the verb `comeHome`, its only caller): its bed is its household's house again; the verb walks it there, now in
  // the working hours, else when its day starts (dayAway). Its stay ends when it is home (atBed).
  function comeHome(st, a) {
    stayOf(st, a.id).back = true;
  }
  // Whether lodger s's stay is over at its meal: its household changed (it wed, its head died: from is no longer its farm), it went hungry
  // (`hungry`: its pack fell short) or is ill (health below HEALTH.riskBelow), or its pack is down to the walk home's ration (none for a walk
  // home within the day: it eats at home that night).
  function stayOver(st, s, hungry) {
    const p = st.pawns[s.pawn],
      hh = p.household === null ? null : st.households[p.household];
    if (!hh || hh.dissolved || hh.farmstead !== s.from) return true;
    if (hungry || p.health < HEALTH.riskBelow) return true;
    return s.food <= rationOf(st, p) * (Math.ceil(s.walk / TRAVEL.dayWalk) - 1) + 1e-9;
  }
  // The working day of the pawns away (sim/clock, before the household's day): of the free pawns `idle`, each lodger takes the first open
  // task of those its stay names, and no other (no chore of its house, no help, no idling about); one with none left, or turned for home,
  // walks home. The others, for the household's day; `idle` itself when none is away.
  function dayAway(st, idle) {
    let rest = null;
    for (let i = 0; i < idle.length; i++) {
      const a = idle[i];
      if (a.away === undefined || travelling(a)) {
        if (rest) rest.push(a);
        continue;
      }
      if (!rest) rest = idle.slice(0, i);
      const s = stayOf(st, a.id);
      if (s.back) {
        issue(st, { actor: a.id, verb: 'goHome', source: 'pawn' });
        continue;
      }
      let got = false;
      for (const key of s.jobs) {
        const j = st.jobs.get(key);
        if (j && issue(st, { actor: a.id, verb: 'work', target: key, source: 'planner' }) === true) {
          got = true;
          break;
        }
      }
      if (!got) issue(st, { actor: a.id, verb: 'comeHome', source: 'pawn' }); // its work is done, or none is open
    }
    return rest || idle;
  }
  // A pawn away has come to its bed (sim/agents' arrived): one that turned for home is home, and its stay ends; what is left of its pack
  // goes into its household's meals, and the herds it brought home are by the farm.
  function atBed(st, a) {
    const s = stayOf(st, a.id);
    if (!s || !s.back || s.bed === null) return;
    const hh = st.households[st.pawns[a.id].household];
    close(st, s);
    if (s.food > 1e-9 && !hh.dissolved) Stores.put(st, hh, 'meals', s.food, { kind: 'away', pawn: a.id });
    driveHome(st, hh, a.id);
  }
  // ---- journeys (VB-287; design.md, Between villages: A journey, Provisions and the season): a stay whose bed is where its leg ends ----
  // A pawn who dies away: its stay ends where it fell. A bearer's grain is put down there (VB-850; sim/lying), for the household it is the
  // gift of to fetch; what lies at the stops goes back.
  function dropStay(st, a) {
    const j = stayOf(st, a.id);
    if (!j) return;
    if ((j.why === 'fetch' || j.why === 'haul') && j.gift) {
      if (j.gift.held > 0) layGift(st, a, j.gift.held, j.gift.parts, j.gift.to);
      unfetched(st, j.gift);
    } else if (j.why === 'carry' && j.gift && !j.back) layGift(st, a, j.gift.n, j.gift.parts, j.gift.to);
    close(st, j);
  }
  // A bearer who dies on the road lays n of grain (by crop, `parts`) down where he fell: the household `to`'s (its village's, if it is gone),
  // a carried or fetched gift's receiver; a quarter hauled to the green is still its giver's (`to`) until it is in the store.
  function layGift(st, a, n, parts, to) {
    const hh = st.households[to],
      [x, y] = placeOf(st, a),
      at = tileAt(st, x, y);
    const owner = hh.dissolved
      ? { type: 'village', id: st.farmsteads[hh.farmstead].village }
      : { type: 'household', id: to };
    Lying.leave(st, 'leftGrain', n, at, owner, { x, y, of: { parts: { ...parts } } });
  }
  // Walking hours from village `from` (null: the village whose centre is nearest tile `at`) to village v, by the table of walking hours
  // (sim/routes); with no table, or no route by land within reach, the straight line from `at` at SPEED.
  function hoursTo(st, from, at, v) {
    if (from === null && at >= 0)
      for (const u of st.villages)
        if (from === null || hexSteps(st.w, at, u.center) < hexSteps(st.w, at, st.villages[from].center)) from = u.id;
    const h = from !== null && st.villageHours ? hoursBetween(st, from, v) : Infinity;
    return Number.isFinite(h) ? h : (at >= 0 ? hexSteps(st.w, at, st.villages[v].center) : 0) / SPEED;
  }
  // Pawn a changed household (sim/heirs' moveTo), from household `old` (or none) to hh: it is released from its job and goes to its new
  // home on foot. To another village (from no household: further than TRAVEL.dayWalk hours), on a journey; within one, home to the new
  // door at once (one indoors at night walks when its day starts, at 6:00). A pawn already on the road walks on to the new home; one
  // lodging away turns for home with its pack, from its bed. `carry` false: its provisions come from the new household (settlers, who walk
  // on their stakes).
  function moved(st, a, old, hh, carry = true) {
    const f = st.farmsteads[hh.farmstead];
    if (old) driveHome(st, old, a.id); // the old household's herds it had out are left by that farm (its herder is no longer a member)
    if (travelling(a)) return retarget(st, a, f.house);
    if (a.load > 0 && a.phase === 'back' && a.job) {
      // a hand with a load on its way home brings it in first, and then goes (VB-581: the load is carried, not booked from the road)
      if (!a.moving) a.moving = { old: old ? old.id : null, carry };
      return;
    }
    setDown(st, a);
    const s = stayOf(st, a.id);
    if (s) s.back = true; // lodging away: it goes to the new home from its bed (VB-783)
    const from = old ? st.farmsteads[old.farmstead] : null,
      at = here(st, a);
    if (from ? from.village !== f.village : hoursTo(st, null, at, f.village) > TRAVEL.dayWalk)
      return setOut(st, a, old, hh, carry, hoursTo(st, from ? from.village : null, at, f.village));
    const h = cal(st.t).hour,
      same = from !== null && from.id === f.id && !s;
    // in its own house it is home already; indoors elsewhere at night, it walks at 6:00
    if (a.inside && (same || h < WORK[0] || h >= WORK[1])) return waitIndoors(st, a, same);
    issue(st, { actor: a.id, verb: 'goHome', source: 'pawn' });
  }
  // @state agent.moving: absent, or {old (the household it left, or null), carry}: a move it was told of with a load on its way home, made when
  //   the load is in (VB-581); the pawn's household is already the new one.
  function finishMove(st, a) {
    const { old, carry } = a.moving;
    delete a.moving;
    moved(st, a, old === null ? null : st.households[old], st.households[st.pawns[a.id].household], carry);
  }
  // A child born to a mother away from home (VB-425; no teleporting): it is where she is, outdoors, and walks to its home as she does.
  function placeBorn(st, a, mother, hh) {
    const m = st.agents[mother];
    if (m.away === undefined) return waitIndoors(st, a, true);
    standBy(st, a, m);
    setOut(st, a, null, hh, false, hoursTo(st, null, tileAt(st, a.x, a.y), st.farmsteads[hh.farmstead].village));
  }
  // A journey starts: provisions from the household it leaves, its record, and the first leg now if a day's walking is left (6:00 to
  // 16:00), else at the next 6:00, from where it stands. A fetch (VB-461) sets out from its own home, for the first place its gift lies.
  // A lodger's stay becomes the journey, with what is left of its pack.
  function setOut(st, a, old, hh, carry, hours, gift = null) {
    const p = st.pawns[a.id],
      f = st.farmsteads[hh.farmstead],
      fetch = !!(gift && gift.stops),
      was = stayOf(st, a.id),
      j = was || { id: st.awaySeq++, pawn: a.id, food: 0 };
    j.to = fetch ? gift.stops[0].at : f.house;
    j.why = fetch ? (gift.haul ? 'haul' : 'fetch') : gift ? 'carry' : 'move';
    j.bed = null;
    j.roof = 'none';
    j.from = old ? old.farmstead : null;
    if (was) for (const k of ['jobs', 'walk', 'host', 'back']) delete j[k];
    if (gift) {
      j.gift = gift; // VB-291: {to (household), n (grain), parts (by crop)}; null from its arrival on, the pawn walking home
      j.back = false;
    }
    // provisions (design: Provisions and the season): a ration (half below 14) a day of walking, from the grain above the seed of the
    // household it leaves, never of the one it joins (VB-676: nothing is carried from a store the pawn has not reached); with none to give
    // it goes unprovisioned, and hungry. Settlers (carry false) walk on the stakes booked to their new household. A gift's bearer walks
    // there and back, and takes at least a day's meal (VB-461: a pawn working away from home carries its meal)
    const days = Math.ceil(hours / TRAVEL.dayWalk);
    provide(
      st,
      j,
      gift ? [old] : carry ? (old && !old.dissolved ? [old] : []) : [hh],
      (gift ? Math.max(1, 2 * days) : days) * rationOf(st, p),
    );
    const left = old ? st.farmsteads[old.farmstead].name : 'where it stood';
    personEvent(
      st,
      a.id,
      'setOut',
      `Set out from ${left} for ${fetch ? gift.stops[0].name : f.name}, ${Math.round(hours)} hours' walk`,
      false,
    );
    stop(st, a); // a walk in hand (to a task it was released from) ends where it has come to: the journey sets out from there
    if (!was) open(st, j);
    startLeg(st, a, j);
  }
  // The first leg now if a day's walking is left (6:00 to 16:00), else at the next 6:00, from where the pawn stands (a wait on the road).
  function startLeg(st, a, j) {
    const h = cal(st.t).hour;
    if (h >= WORK[0] && h < WORK[1] - 2) return walkLeg(st, a, j.to);
    restOnRoad(st, a);
  }
  // A gift of n grain from household `from` to household `to`, further than a day's walk (VB-291; Kim, 10 Nov: carried, not sent): the
  // grain leaves the giver's store as the carrier, one of its adults, sets out; the receiver books it when he arrives (delivered).
  // Only the verb `give` calls it.
  function carryGift(st, o) {
    const a = st.agents[o.carrier],
      parts = {};
    Stores.take(st, o.from, 'grain', o.n, { kind: 'gift', to: st.farmsteads[o.to.farmstead].name }, parts);
    setDown(st, a);
    const hours = hoursBetween(st, st.farmsteads[o.from.farmstead].village, st.farmsteads[o.to.farmstead].village);
    setOut(st, a, o.from, o.to, false, hours, { to: o.to.id, n: o.n, parts });
  }
  // ---- a gift fetched (VB-461; AGENTS.md, the hard rule: a gift changes owner where it lies and waits there until someone fetches it) ----
  // A gift to household hh from another farmstead, or from a village store, is set aside where it lies (the giver's house, the green where
  // the store stands) as hh's, and a member of hh fetches it, TRAVEL.load a trip, walking home with each load; it is hh's to eat as each
  // load comes in. One member fetches all of hh's gifts of the day, a stop after the other.
  // j.gift of a fetch: {to (household), held (the grain on his back, 0 on the way out), parts, stops: [{at (tile), from (household id, or
  // null), village (the store's village, or null), name, left (grain still lying there), parts}]}.
  // The member of household hh who fetches its gift: the one already fetching, else its youngest of 14 or more who is not away nor
  // carrying a load home; -1 when none can go.
  function fetcherOf(st, hh) {
    for (const j of st.away)
      if (j.why === 'fetch' && j.gift && j.gift.to === hh.id && st.pawns[j.pawn].household === hh.id) return j.pawn;
    return haulerOf(st, hh);
  }
  // The youngest member of household hh of 14 or more who is not away nor carrying a load home, or -1: who goes for a gift, or takes the
  // household's quarter to the green (VB-849)
  function haulerOf(st, hh) {
    let best = -1;
    for (const id of hh.members) {
      const p = st.pawns[id],
        a = st.agents[id];
      if (!p.alive || age(st, p) < HANDS[0] || a.away !== undefined || a.phase === 'back') continue;
      if (best < 0 || age(st, p) < age(st, st.pawns[best])) best = id;
    }
    return best;
  }
  // The verb `give`'s gift o {from, to, n} set aside and fetched by o.fetcher (fetcherOf): its records at once (sim/exchange booked), its
  // grain taken from the giver to lie where it is, a stop of the fetcher's journey.
  function fetchGift(st, o) {
    const store = !('farmstead' in o.from),
      name = store ? o.from.name + "'s store" : st.farmsteads[o.from.farmstead].name,
      parts = {},
      to = st.farmsteads[o.to.farmstead];
    Stores.take(st, o.from, 'grain', o.n, { kind: 'gift', to: to.name }, parts);
    booked(st, store ? null : o.from, o.to, o.n, name);
    const stop = {
      at: store ? o.from.center : st.farmsteads[o.from.farmstead].house,
      from: store ? null : o.from.id,
      village: store ? o.from.id : null,
      name,
      left: o.n,
      parts,
    };
    const a = st.agents[o.fetcher],
      j = stayOf(st, a.id);
    if (j) return void j.gift.stops.push(stop);
    setDown(st, a);
    const v = store ? o.from.id : st.farmsteads[o.from.farmstead].village;
    setOut(st, a, o.to, o.to, false, hoursBetween(st, to.village, v), {
      to: o.to.id,
      held: 0,
      parts: {},
      stops: [stop],
    });
  }
  // What still lies of gift g goes back to the stores it lies in, its giver's again (a dissolved giver's to its village's store).
  function unfetched(st, g) {
    const why = { kind: 'gift', back: st.farmsteads[st.households[g.to].farmstead].name };
    for (const s of g.stops) {
      const hh = s.from === null ? null : st.households[s.from];
      Stores.put(
        st,
        hh && !hh.dissolved ? hh : st.villages[s.village ?? st.farmsteads[hh.farmstead].village],
        'grain',
        s.left,
        why,
        s.parts,
      );
    }
    g.stops = [];
  }
  // A household's quarter for its village's store (VB-849: the yearly filling, carried): grain of o.from, o.n of it, is set aside at its
  // house, and o.hauler, one of its members (haulerOf), carries it to the green (`v.center`) TRAVEL.load a trip; it is in the store only as
  // each load arrives. The journey's gift is a fetch's, reversed: {to (the giving household), village, held, parts, stops: [its house]}.
  function haulGift(st, o) {
    const parts = {},
      house = st.farmsteads[o.from.farmstead];
    Stores.take(st, o.from, 'grain', o.n, { kind: 'gift', to: 'the village store' }, parts);
    const a = st.agents[o.hauler];
    setDown(st, a);
    setOut(st, a, o.from, o.from, false, 1, {
      to: o.from.id,
      village: o.to.id,
      haul: true,
      held: 0,
      parts: {},
      stops: [{ at: house.house, from: o.from.id, village: null, name: house.name, left: o.n, parts }],
    });
  }
  // The hauler at the end of a walk: at the house he takes up a load and walks to the green; at the green it goes into the store, and he
  // goes home for the next while any lies and he is still of the household; else the journey ends at his home.
  function haulStop(st, a, j) {
    const g = j.gift,
      from = st.households[g.to],
      v = st.villages[g.village];
    if (g.held === 0) {
      const s = g.stops[0];
      g.held = Math.min(TRAVEL.load, s.left);
      g.parts = takeUp(st, j, g.held);
      if (!(s.left > 1e-9)) g.stops.shift();
      j.to = v.center;
      return startLeg(st, a, j);
    }
    Stores.put(st, v, 'grain', g.held, { kind: 'gift', from: st.farmsteads[from.farmstead].name }, g.parts);
    g.held = 0;
    g.parts = {};
    if (g.stops.length && !from.dissolved && st.pawns[a.id].household === from.id) {
      provide(st, j, [from], rationOf(st, st.pawns[a.id])); // his meal for the next trip
      j.to = g.stops[0].at;
      return startLeg(st, a, j);
    }
    unfetched(st, g);
    j.gift = null;
    j.back = true;
    const home = st.farmsteads[st.households[st.pawns[a.id].household].farmstead].house;
    if (home === v.center) return endJourney(st, a);
    j.to = home;
    startLeg(st, a, j);
  }
  // A load of n of the grain at journey j's first stop taken up, by crop: the rest of its crops stays.
  function takeUp(st, j, n) {
    const s = j.gift.stops[0];
    if (n >= s.left - 1e-9) {
      s.left = 0;
      return s.parts;
    }
    const parts = {},
      k = n / s.left;
    for (const c in s.parts) {
      parts[c] = s.parts[c] * k;
      s.parts[c] -= parts[c];
    }
    s.left -= n;
    return parts;
  }
  // The fetcher at the end of a walk: at a stop, he takes up a load (TRAVEL.load at most) and walks home; at home with a load, it is his
  // household's, and he goes for the next while any lies and he is still its member; else the journey ends at his home.
  function fetchStop(st, a, j) {
    const g = j.gift,
      to = st.households[g.to],
      house = st.farmsteads[to.farmstead].house;
    if (g.held === 0) {
      const s = g.stops[0];
      g.held = Math.min(TRAVEL.load, s.left);
      g.parts = takeUp(st, j, g.held);
      g.from = s.name;
      if (!(s.left > 1e-9)) g.stops.shift();
      j.to = house;
      return startLeg(st, a, j);
    }
    const at = to.dissolved ? st.villages[st.farmsteads[to.farmstead].village] : to;
    Stores.put(st, at, 'grain', g.held, { kind: 'gift', from: g.from }, g.parts);
    g.held = 0;
    g.parts = {};
    if (g.stops.length && !to.dissolved && st.pawns[a.id].household === to.id) {
      provide(st, j, [to], rationOf(st, st.pawns[a.id])); // his meal for the next trip
      j.to = g.stops[0].at;
      return startLeg(st, a, j);
    }
    unfetched(st, g);
    j.gift = null;
    j.back = true;
    const home = st.farmsteads[st.households[st.pawns[a.id].household].farmstead].house;
    if (home === house) return endJourney(st, a);
    j.to = home;
    startLeg(st, a, j);
  }
  // A pawn's household changed again on the road (a death at home, a handover): it walks to the new home, turning back if need be.
  function retarget(st, a, to) {
    const j = stayOf(st, a.id);
    if ((j.why === 'fetch' || j.why === 'haul') && j.gift) {
      if (j.gift.held > 0) return; // a fetcher brings his load in first (fetchStop), and then walks to the home he has
      unfetched(st, j.gift); // on his way out: what lies there is fetched no more
      j.gift = null;
      j.back = true;
    }
    if (j.to === to || (j.why === 'carry' && !j.back)) return; // a carrier delivers first, and then walks to the home he has
    if (j.why === 'carry') j.back = true;
    j.to = to;
    turnTo(st, a, to);
  }
  // A carrier arrives with his gift: the receiving household books it (its village's store, if the household is gone) and he turns for home.
  function delivered(st, a, j) {
    const g = j.gift,
      from = st.households[st.pawns[a.id].household],
      to = st.households[g.to],
      f = st.farmsteads[to.farmstead];
    j.gift = null;
    j.back = true;
    if (to.dissolved) Stores.put(st, st.villages[f.village], 'grain', g.n, { kind: 'gift', from: f.name }, g.parts);
    else receive(st, from && !from.dissolved ? from : null, to, g.n, st.farmsteads[j.from].name, g.parts);
    personEvent(st, a.id, 'arrived', `Arrived at ${f.name} with ${Math.round(g.n)} grain`, false);
    j.to = st.farmsteads[from.farmstead].house;
    startLeg(st, a, j);
  }
  // Arrival: the journey ends, what is left of its provisions goes into the new home's meals, and the pawn is at home.
  function endJourney(st, a) {
    const j = stayOf(st, a.id);
    if (j.why === 'carry' && !j.back) return delivered(st, a, j);
    if (j.why === 'fetch' && j.gift) return fetchStop(st, a, j);
    if (j.why === 'haul' && j.gift) return haulStop(st, a, j);
    const hh = st.households[st.pawns[a.id].household];
    close(st, j);
    if (j.food > 1e-9 && !hh.dissolved) Stores.put(st, hh, 'meals', j.food, { kind: 'away', pawn: a.id });
    placeAtHome(st, a);
    personEvent(st, a.id, 'arrived', `Arrived at ${st.farmsteads[hh.farmstead].name}`, false);
  }
  // What sim/agents tells of the pawns away (sim/events): a journey's leg has arrived; its rest on the road is over and the next leg sets
  // out; one away has died; a move it was told of with a load in hand is made; one away is at its bed.
  on('legEnd', endJourney);
  on('legDue', (st, a) => walkLeg(st, a, stayOf(st, a.id).to));
  on('stillAway', dropStay);
  on('moveOn', finishMove);
  on('atBed', atBed);
  // A pawn's household changed (sim/heirs' moveTo); a child is born (sim/births).
  on('rehoused', (st, d) => moved(st, d.a, d.old, d.hh, d.carry));
  on('placeBorn', (st, d) => placeBorn(st, d.a, d.mother, d.hh));
  return {
    feedAway,
    dayAway,
    lodgeWhy,
    lodge,
    comeHomeWhy,
    comeHome,
    moved,
    placeBorn,
    carryGift,
    fetcherOf,
    haulerOf,
    fetchGift,
    haulGift,
  };
})();
