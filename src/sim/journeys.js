// @sys sim/journeys: a stay whose bed is where its leg ends (VB-287; design.md, Between villages: A journey, Provisions and the season):
// setting out, the legs and their rests, arrival and the change of home (moved, a child born away, a small child fetched: VB-1240), a gift carried,
// fetched or hauled (VB-291, VB-461), the suitor's visit there and back (VB-289), and JOURNEYS, what each kind does of its own (VB-1409); the stays'
// record, packs and meals are sim/away's; split from sim/away (VB-1474)
VB['sim/journeys'] = (() => {
  const { cal, DAY, WORK, SPEED, TRAVEL } = VB['sim/rules'];
  const { hoursBetween } = VB['sim/villagehours'];
  const { personEvent } = VB['sim/records'];
  const Stores = VB['sim/stores'];
  const { rationOf } = VB['sim/hunger'];
  const { receive } = VB['sim/exchange'];
  const { hexSteps } = VB['sim/hex'];
  const { driveHome } = VB['sim/grazing'];
  const { on, emit } = VB['sim/events'];
  const Lying = VB['sim/lying'];
  const { placeAtHome, restOnRoad, walkLeg, turnTo, setDown, stop, waitIndoors, standBy } = VB['sim/agents'];
  const { placeOf, tileAt, travelling, stayOf, endTile } = VB['sim/pose'];
  const { open, close, provide, packLeft, packHome, nextStay, bedAt, turn, unlodge } = VB['sim/away'];
  const { askBed } = VB['sim/hosting'];
  const { issue, register } = VB['sim/commands'];
  const { age, living } = VB['sim/records'],
    { CHILD } = VB['sim/roles'];
  function addFetchStop(st, pawn, stop) {
    const stay = stayOf(st, pawn);
    if (!stay) return false;
    stay.gift.stops.push(stop);
    return true;
  }
  // Pawn `pawn`, setting out to its new home in another village (a move's journey, not yet turned back), bears `stops` there (VB-675: a
  // start in life lies where it was taken, and is carried): its journey becomes a fetch for household `to`, first to the place the
  // first stop lies, a load at a time. False when it is not on such a journey.
  function bear(st, pawn, to, stops) {
    const j = stayOf(st, pawn);
    if (!j || j.why !== 'move' || j.back || j.to !== st.farmsteads[st.households[to].farmstead].house) return false;
    j.why = 'fetch';
    j.gift = { to, held: 0, parts: {}, stops };
    turn(j, false);
    j.to = stops[0].at;
    turnTo(st, st.agents[pawn], j.to);
    return true;
  }
  // ---- journeys (VB-287; design.md, Between villages: A journey, Provisions and the season): a stay whose bed is where its leg ends ----
  // A pawn who dies away: its stay ends where it fell. A bearer's grain is put down there (VB-850; sim/lying), for the household it is the
  // gift of to fetch; what lies at the stops goes back.
  function dropStay(st, a) {
    const j = stayOf(st, a.id);
    if (!j) return;
    const k = kindOf(j);
    if (k.fall) k.fall(st, a, j);
    layPack(st, a, j);
    close(st, j);
  }
  // What is left of a pack lies where its bearer fell (sim/lying), for the household it came from to fetch (as a gift's grain is laid).
  function layPack(st, a, j) {
    const g = packLeft(st, j),
      hh = st.pawns[a.id].household;
    if (g && hh !== null) layGift(st, a, g.n, g.parts, hh);
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
    if (a.fetching) {
      // fetching a small child of the household it joins, it walks home with it (VB-1240); a fetch of another household's is let go
      const f2 = a.fetching;
      if (
        f2.led
          ? !!a.homeward && a.path && endTile(st, a) === f.house
          : hh.members.some((m) => st.agents[m] && st.agents[m].awaits === a.id)
      )
        return;
      delete a.fetching;
    }
    if (a.load > 0 && a.load > 0 && a.job) {
      // a hand with a load on its way home brings it in first, and then goes (VB-581: the load is carried, not booked from the road)
      if (!a.moving) a.moving = { old: old ? old.id : null, carry };
      return;
    }
    setDown(st, a);
    const s = stayOf(st, a.id);
    if (s) turn(s, true); // lodging away: it goes to the new home from its bed (VB-783)
    const from = old ? st.farmsteads[old.farmstead] : null,
      at = tileAt(st, ...placeOf(st, a));
    if (from ? from.village !== f.village : hoursTo(st, null, at, f.village) > TRAVEL.dayWalk)
      return setOut(st, a, old, hh, carry, hoursTo(st, from ? from.village : null, at, f.village));
    const h = cal(st.t).hour,
      same = from !== null && from.id === f.id && !s;
    // a child under 7 does not go on its own: one of its new household of 7 or over takes it, or the first of them to join it (VB-1240)
    if (!same && young(st, a)) return void (fetch(st, a, hh) || wait(st, a, -1));
    // in its own house it is home already; indoors elsewhere at night, it walks at 6:00
    if (a.inside && (same || h < WORK[0] || h >= WORK[1])) waitIndoors(st, a, same);
    else issue(st, { actor: a.id, verb: 'goHome', source: 'pawn' });
    if (!young(st, a))
      for (const m of hh.members)
        if (st.agents[m] && st.agents[m].awaits === -1)
          issue(st, { actor: a.id, verb: 'fetchChild', target: m, source: 'pawn' });
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
      j = was || { id: nextStay(st), pawn: a.id, food: 0 };
    j.to = fetch ? gift.stops[0].at : f.house;
    j.why = fetch ? (gift.haul ? 'haul' : 'fetch') : gift ? 'carry' : 'move';
    bedAt(j, null, 'none');
    j.from = old ? old.farmstead : null;
    if (was) unlodge(j);
    if (gift) {
      j.gift = gift; // VB-291: {to (household), n (grain), parts (by crop)}; null from its arrival on, the pawn walking home
      turn(j, false);
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
  // ---- the suitor's visit (VB-289; design.md, Between villages: The suitor's visit, Provisions and the season) ----
  // The days away on a visit to a village `hours` off: there and back at a day for each TRAVEL.dayWalk hours, and TRAVEL.stay as a guest.
  const visitDays = (hours) => 2 * Math.ceil(hours / TRAVEL.dayWalk) + TRAVEL.stay;
  // Pawn a sets out on a visit to village v (sim/visits' due step, its only caller, carrying out the plan made by the verb `visit`): a
  // journey to its green and back, on a ration a day
  // away from its household's grain above the seed.
  function visit(st, a, v) {
    const p = st.pawns[a.id],
      hh = st.households[p.household],
      f = st.farmsteads[hh.farmstead],
      hours = hoursBetween(st, f.village, v),
      j = { id: nextStay(st), pawn: a.id, why: 'visit', bed: null, roof: 'none', food: 0, from: f.id, village: v };
    j.to = st.villages[v].center;
    j.back = false;
    j.stay = TRAVEL.stay;
    setDown(st, a);
    provide(st, j, [hh], visitDays(hours) * rationOf(st, p));
    personEvent(
      st,
      a.id,
      'setOut',
      `Set out from ${f.name} to visit ${st.villages[v].name}, ${Math.round(hours)} hours' walk`,
      false,
    );
    stop(st, a);
    open(st, j);
    startLeg(st, a, j);
  }
  // The visitor arrives at the other village's green: the visit is his (sim/visits writes pawn.visited), and he rests there, its guest,
  // until he walks home.
  function visited(st, a, j) {
    const hh = st.households[st.pawns[a.id].household];
    emit(st, 'visited', { pawn: a.id, village: j.village });
    turn(j, true);
    j.guest = true;
    j.to = st.farmsteads[hh.farmstead].house;
    const host = askBed(st, a.id, j.village);
    if (host) {
      // a guest in the host's house (roof 'house', the host's fire): he stands at its door for his nights there
      bedAt(j, st.farmsteads[host.farmstead].house, 'house', host.id);
      return walkLeg(st, a, j.bed);
    }
    restOnRoad(st, a);
  }
  // A guest's nights at the host's house are over: his bed is the road again.
  function leaveHost(j) {
    bedAt(j, null, 'none');
  }
  // A journey's rest is over at 6:00: a guest with days to stay stays one more (he takes no work there), else the next leg sets out.
  function legDue(st, a) {
    const j = stayOf(st, a.id),
      k = kindOf(j);
    if (k.morning && k.morning(st, a, j)) return;
    delete j.guest;
    if (j.host !== undefined) leaveHost(j);
    walkLeg(st, a, j.to);
  }
  // The first leg now if a day's walking is left (6:00 to 16:00), else at the next 6:00, from where the pawn stands (a wait on the road).
  function startLeg(st, a, j) {
    const h = cal(st.t).hour;
    if (h >= WORK[0] && h < WORK[1] - 2) return walkLeg(st, a, j.to);
    restOnRoad(st, a);
  }
  // What still lies of gift g goes back to the stores it lies in, its giver's again (a dissolved giver's to its village's store).
  function unfetched(st, g) {
    const why = { kind: 'gift', back: st.farmsteads[st.households[g.to].farmstead].name };
    for (const s of g.stops) {
      const hh = s.from === null ? null : st.households[s.from];
      // a loan's grain, lent or repaid, is no longer the one's it lies at (VB-312): it lies there for the fetcher's household's hands
      if (s.loan && !st.households[g.to].dissolved) {
        Lying.leave(st, 'leftGrain', s.left, s.at, { type: 'household', id: g.to }, { of: { parts: s.parts } });
        continue;
      }
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
    Stores.put(
      st,
      v,
      'grain',
      g.held,
      { kind: g.loan ? 'loan' : 'gift', from: st.farmsteads[from.farmstead].name },
      g.parts,
    );
    g.held = 0;
    g.parts = {};
    if (g.stops.length && !from.dissolved && st.pawns[a.id].household === from.id) {
      provide(st, j, [from], rationOf(st, st.pawns[a.id])); // his meal for the next trip
      j.to = g.stops[0].at;
      return startLeg(st, a, j);
    }
    unfetched(st, g);
    j.gift = null;
    turn(j, true);
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
      g.keep = s.keep === true;
      g.start = s.start === true;
      g.loan = s.loan === true;
      if (!(s.left > 1e-9)) g.stops.shift();
      j.to = house;
      return startLeg(st, a, j);
    }
    const at = to.dissolved ? st.villages[st.farmsteads[to.farmstead].village] : to;
    Stores.put(
      st,
      at,
      'grain',
      g.held,
      { kind: g.start ? 'provisions' : g.keep ? 'keep' : g.loan ? 'loan' : 'gift', from: g.from },
      g.parts,
    );
    g.held = 0;
    g.parts = {};
    if (g.stops.length && !to.dissolved && st.pawns[a.id].household === to.id) {
      provide(st, j, [to], rationOf(st, st.pawns[a.id])); // his meal for the next trip
      j.to = g.stops[0].at;
      return startLeg(st, a, j);
    }
    unfetched(st, g);
    j.gift = null;
    turn(j, true);
    const home = st.farmsteads[st.households[st.pawns[a.id].household].farmstead].house;
    if (home === house) return endJourney(st, a);
    j.to = home;
    startLeg(st, a, j);
  }
  // A pawn's household changed again on the road (a death at home, a handover): it walks to the new home, turning back if need be.
  function retarget(st, a, to) {
    const j = stayOf(st, a.id),
      k = kindOf(j);
    if (k.rehome && k.rehome(st, a, j)) return;
    if (j.to === to) return;
    j.to = to;
    turnTo(st, a, to);
  }
  // A carrier arrives with his gift: the receiving household books it (its village's store, if the household is gone) and he turns for home.
  // The giver is the household of the farm he set out from, not his own: his household may have changed on the road (into service, or
  // a handover, at the very farm he carries to), and he walks home to the one he has, or is there.
  function delivered(st, a, j) {
    const g = j.gift,
      gave = j.from === null ? null : st.farmsteads[j.from].household,
      from = gave === null ? null : st.households[gave],
      to = st.households[g.to],
      f = st.farmsteads[to.farmstead];
    j.gift = null;
    turn(j, true);
    if (to.dissolved) Stores.put(st, st.villages[f.village], 'grain', g.n, { kind: 'gift', from: f.name }, g.parts);
    else
      receive(st, from && !from.dissolved && from !== to ? from : null, to, g.n, st.farmsteads[j.from].name, g.parts);
    personEvent(st, a.id, 'arrived', `Arrived at ${f.name} with ${Math.round(g.n)} grain`, false);
    const home = st.farmsteads[st.households[st.pawns[a.id].household].farmstead].house;
    if (home === f.house) return endJourney(st, a);
    j.to = home;
    startLeg(st, a, j);
  }
  // ---- a journey's kinds (VB-1409): what each does of its own; sim/kinds' KINDS in spirit ----
  // A journey's kind is its stay's why, and its course is read here, never saved (a stay keeps only the word). Each hook is optional: one
  // a kind does not name, or a hook that answers false, leaves the common course (a move's). arrive(st, a, j): the leg's end, in
  // endJourney; morning(st, a, j): its rest on the road is over, in legDue; fall(st, a, j): its pawn died away, in dropStay, before its
  // pack is laid down; rehome(st, a, j): its pawn's household changed on the road, in retarget, true to walk on to where it goes. What is
  // state, not kind (back, gift, stay), each hook tests itself: a carrier who has delivered ends as a move does.
  // A lodger's stay shares st.away and may carry the same word (a caller's 'visit'), and is told from a journey as it was before the table:
  // arrive, morning and rehome are reached only by a pawn on the road (agent.journey 'walk' or 'rest', sim/pose travelling), which only a
  // journey's legs set; fall by any stay, but a lodger holds no gift, and a visit's fall is none.
  const fetching = {
    // a fetcher or hauler who dies: the load he held lies where he fell, and what lies at the stops goes back
    fall: (st, a, j) => {
      if (!j.gift) return;
      if (j.gift.held > 0) layGift(st, a, j.gift.held, j.gift.parts, j.gift.to);
      unfetched(st, j.gift);
    },
    // a fetcher brings his load in first (fetchStop), and then walks to the home he has; on his way out, what lies there is fetched no more
    rehome: (st, a, j) => {
      if (!j.gift) return false;
      if (j.gift.held > 0) return true;
      unfetched(st, j.gift);
      j.gift = null;
      turn(j, true);
      return false;
    },
  };
  const JOURNEYS = {
    move: {},
    carry: {
      arrive: (st, a, j) => !j.back && (delivered(st, a, j), true),
      fall: (st, a, j) => {
        if (j.gift && !j.back) layGift(st, a, j.gift.n, j.gift.parts, j.gift.to);
      },
      rehome: (st, a, j) => !j.back, // a carrier delivers first, and then walks to the home he has
    },
    fetch: { ...fetching, arrive: (st, a, j) => !!j.gift && (fetchStop(st, a, j), true) },
    haul: { ...fetching, arrive: (st, a, j) => !!j.gift && (haulStop(st, a, j), true) },
    visit: {
      // he arrives at the village he visits; later, a guest of a house, at his host's door (VB-1151), where he rests
      arrive: (st, a, j) => {
        if (!j.back) visited(st, a, j);
        else if (j.bed !== null) restOnRoad(st, a);
        else return false;
        return true;
      },
      // a guest with days to stay stays one more (he takes no work there)
      morning: (st, a, j) => {
        if (!(j.back && j.stay > 0)) return false;
        j.stay--;
        restOnRoad(st, a);
        return true;
      },
      // his home changed on the way (VB-289): the visit is over, and he walks to the home he has
      rehome: (st, a, j) => {
        turn(j, true);
        j.stay = 0;
        delete j.guest;
        if (j.host !== undefined) leaveHost(j);
        return false;
      },
    },
  };
  const NONE = {};
  const kindOf = (j) => (Object.hasOwn(JOURNEYS, j.why) ? JOURNEYS[j.why] : NONE);
  // ---- a small child taken to its new home (VB-1240: an act with no pawn, sim/journeys moved): within a day's walk a child under
  // CHILD.from does not walk to its new home alone; one of its new household of that age or over fetches it, and they walk home together ----
  // @state agent.fetching: absent, or {at (the tile it walks to for a child), led (true from when it has the child: it walks it home)}:
  //   the pawn fetches the children of its household who await it (the verb fetchChild); cleared when it is home. Written here only.
  // @state agent.awaits: absent, or the pawn id of the one of its household fetching it, or -1 (none yet: the first of CHILD.from or over to
  //   join its household fetches it): a child under CHILD.from waits where it is until fetched; cleared when it is led home, or at the
  //   day's end when nobody came (it goes home alone). Written here only.
  const young = (st, a) => age(st, st.pawns[a.id]) < CHILD.from;
  const tileOf = (st, a) => tileAt(st, ...placeOf(st, a));
  // Who of household hh fetches child k: of CHILD.from or over, alive, at home in the village (on no road, away at no bed, at no
  // occasion), not leading another child home; one where the child is first, else the nearest. Null when none can.
  function fetcherFor(st, k, hh) {
    const at = tileOf(st, k);
    let best = null,
      d = Infinity;
    for (const m of hh.members) {
      const b = st.agents[m];
      if (m === k.id || !b || living(st, m) || young(st, b) || b.away !== undefined || b.occasion !== null) continue;
      if (b.fetching && (b.fetching.led || b.fetching.at !== at)) continue;
      const e = hexSteps(st.w, tileOf(st, b), at);
      if (e < d) [best, d] = [m, e];
    }
    return best;
  }
  // Child k, moved to household hh, is fetched: true when one of its household takes it (the verb fetchChild), else false (it goes alone).
  function fetch(st, k, hh) {
    const m = fetcherFor(st, k, hh);
    return m !== null && issue(st, { actor: m, verb: 'fetchChild', target: k.id, source: 'pawn' }) === true;
  }
  // Child a waits where it is for `by`, the one of its household fetching it, or -1: the first of 7 or over to join its household.
  function wait(st, a, by) {
    stop(st, a);
    a.awaits = by;
    issue(st, { actor: a.id, verb: 'idle', args: { until: st.t + DAY }, source: 'pawn' });
  }
  // The fetcher b has the children who await it (it stands where they are): it walks home, and they with it.
  function lead(st, b) {
    b.fetching.led = true;
    issue(st, { actor: b.id, verb: 'goHome', source: 'pawn' });
    for (const id of st.households[st.pawns[b.id].household].members) {
      const a = st.agents[id];
      if (!a || a.awaits !== b.id) continue;
      delete a.awaits;
      issue(st, { actor: id, verb: 'goHome', source: 'pawn' });
    }
  }
  // fetchChild: pawn actor goes for the child `target` of its household, under CHILD.from, and takes it home: the child waits where it is
  // until fetched; one at the child's place leads it home at once
  register('fetchChild', {
    check: (st, c) => {
      const no = living(st, c.actor) || living(st, c.target);
      if (no) return no;
      const a = st.agents[c.actor],
        k = st.agents[c.target],
        hh = st.pawns[c.actor].household;
      if (hh === null || st.pawns[c.target].household !== hh) return 'the child is not of its household';
      if (young(st, a)) return `a child under ${CHILD.from} fetches no one`;
      if (!young(st, k)) return `pawn ${c.target} is ${CHILD.from} or over and walks alone`;
      if (travelling(a) || a.away !== undefined) return `pawn ${c.actor} is away`;
      if (travelling(k) || k.away !== undefined) return `pawn ${c.target} is away`;
      if (a.fetching && (a.fetching.led || a.fetching.at !== tileOf(st, k)))
        return `pawn ${c.actor} is fetching another`;
      return null;
    },
    run: (st, c) => {
      const a = st.agents[c.actor],
        k = st.agents[c.target],
        at = tileOf(st, k);
      wait(st, k, a.id);
      if (a.fetching) return { fetch: k.id };
      setDown(st, a);
      a.fetching = { at, led: false };
      if (tileOf(st, a) === at) lead(st, a);
      else issue(st, { actor: a.id, verb: 'walkTo', target: at, args: { x: k.x, y: k.y }, source: 'pawn' });
      return { fetch: k.id };
    },
    active: (st, c) => st.agents[c.target].awaits === c.actor,
  });
  // A fetcher's walk has ended (sim/legs, a leg changed with no walk in hand): at the children's place it leads them home; home, it is done.
  function fetchLeg(st, a) {
    const f = a.fetching;
    if (!f || a.path) return;
    if (f.led) {
      if (a.inside) delete a.fetching;
    } else if (tileOf(st, a) === f.at) lead(st, a);
  }
  // At the day's end (sim/clock): true while a fetch goes on, and the pawn is left to it. One whose fetch was broken off (its fetcher
  // sent elsewhere or dead) is let go: a child is fetched again, by another if need be, or goes home alone; a fetcher goes home.
  function fetchGoesOn(st, a) {
    if (a.fetching) {
      if (a.path && (a.fetching.led ? !!a.homeward : a.errand)) return true;
      delete a.fetching;
      return false;
    }
    if (a.awaits === undefined) return false;
    const b = a.awaits >= 0 ? st.agents[a.awaits] : null;
    if (b && st.pawns[b.id].alive && b.fetching && !b.fetching.led) return true;
    delete a.awaits;
    const hid = st.pawns[a.id].household;
    return hid !== null && !st.households[hid].dissolved && fetch(st, a, st.households[hid]);
  }
  // Arrival: the journey ends, what is left of its provisions goes into the new home's meals, and the pawn is at home.
  function endJourney(st, a) {
    const j = stayOf(st, a.id),
      k = kindOf(j);
    if (k.arrive && k.arrive(st, a, j)) return;
    const hh = st.households[st.pawns[a.id].household];
    close(st, j);
    packHome(st, j, hh);
    placeAtHome(st, a);
    personEvent(st, a.id, 'arrived', `Arrived at ${st.farmsteads[hh.farmstead].name}`, false);
  }
  // What sim/agents tells of the pawns on a journey (sim/events): a journey's leg has arrived; its rest on the road is over and the next
  // leg sets out; one away has died; a move it was told of with a load in hand is made.
  on('legEnd', endJourney);
  on('legDue', legDue);
  on('stillAway', dropStay);
  on('moveOn', finishMove);
  // A pawn's household changed (sim/heirs' moveTo); a child is born (sim/births).
  on('rehoused', (st, d) => moved(st, d.a, d.old, d.hh, d.carry));
  on('placeBorn', (st, d) => placeBorn(st, d.a, d.mother, d.hh));
  on('legChanged', fetchLeg);
  return { moved, fetchGoesOn, placeBorn, setOut, addFetchStop, bear, visit, visitDays };
})();
