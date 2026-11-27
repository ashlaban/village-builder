// @sys sim/agents: what a pawn does with its legs: a task's next leg read from the world (set out, arrive, a load home, done, released;
// no phases, VB-1751), home placement, talks, death, a journey's walking, the step that takes the legs and tasks due, and the verbs;
// its legs are sim/legs', its work sim/work's (VB-422)
VB['sim/agents'] = (() => {
  const { unbound, atWork } = VB['sim/pose'];
  const { living, commanded } = VB['sim/records'];
  const { isOpen } = VB['sim/kinds'];
  const { register } = VB['sim/commands'];
  const { cal, DAY, TICKS, WORK } = VB['sim/rules'];
  const { eligible } = VB['sim/eligibility'];
  const Carts = VB['sim/carts'];
  const { driveHome } = VB['sim/grazing'];
  const { workedTogether } = VB['sim/relations'];
  const { on, emit } = VB['sim/events'];
  const { worked: prospected } = VB['sim/prospect'];
  const { KINDS, carriedOn } = VB['sim/kinds'],
    { workTick } = VB['sim/progress'];
  const Lying = VB['sim/lying'];
  const Days = VB['sim/days'];
  const Doing = VB['sim/doing'],
    Methods = VB['sim/methods'],
    { DONE } = Methods;
  const Skills = VB['sim/skills'];
  const { tileAt, here, endTile, placeOf, travelling, stayOf, bed } = VB['sim/pose'];
  const { attentionOf, settle, rerate, retune, dequeue, teamKind, ownerKey, withOxen, teamFree, dueWork } =
    VB['sim/work'];
  const { minds, mindWhy, hold, unhold, dropMind, reachAfter, mindCheck, assign, inSlot, holds } = VB['sim/attention'],
    Attention = VB['sim/attention'];
  const { legsOf, waitLeg, roadWait, unleg, halt, begin, repace, setOut, putAt, workAt, walked, dueLegs, restamp } =
    VB['sim/legs'];
  // the spot by the door of the house on tile `house`, where pawn a would stand
  const spotAt = (st, a, house) => [st.w.hx[house] - 12 + a.ox * 0.3, st.w.hy[house] + 14 + a.oy * 0.15];
  // By the door of pawn a's household's house, wherever it sleeps: where an indoor task is done, and a load for the door is brought.
  const homeSpot = (st, a) => spotAt(st, a, st.farmsteads[st.households[st.pawns[a.id].household].farmstead].house);
  // Where pawn a lies down: by the door of its bed (VB-783: its household's house, unless it is away).
  const bedSpot = (st, a) => spotAt(st, a, bed(st, a));
  // @state agent.homeward: true while the pawn walks home to its bed (goHome) until it is in or bound elsewhere, else absent; written here
  //   only; plain data, saved. agent.journey: 'walk' while a journey's pawn walks a leg, 'rest' before its first leg and between legs, when
  //   it rests on the road and keeps its route (a.path, a.seg); null on no journey (sim/journeys, VB-287); written here only, saved.
  // The pawn is bound for nothing (sim/pose unbound): no walk home, no journey.
  const unbind = (a) => {
    a.journey = null;
    delete a.homeward;
  };
  function placeAtHome(st, a) {
    unleg(st, a);
    const [x, y] = bedSpot(st, a);
    putAt(st, a, x, y);
    a.inside = true;
    halt(st, a); // with no leg, its route is dropped
    unbind(a);
    a.job = null;
    a.anim = 'idle';
    a.carry = null;
  }
  // Dawn repositions an indoor pawn without clearing its movement or work state; one indoors at another house (moved at night, or waiting
  // there for its journey's first leg; VB-287) stays where it is, and walks when its day starts.
  function placeByDoor(st, a) {
    const [x, y] = bedSpot(st, a);
    if (travelling(a) || Math.hypot(a.x - x, a.y - y) > st.w.R) return;
    putAt(st, a, x, y);
  }
  // The pawn looks for nothing to do until game time `until`: a free pawn's wait is told again; one walking waits from its arrival.
  function idle(st, a, until) {
    a.idleUntil = until;
    if (!a.path && unbound(a)) waitLeg(st, a);
  }
  // A talk stops only an idle pawn outdoors, not one on its way to an occasion (VB-126), and never shortens an existing pause: its walk is
  // cut where it has come to, and it waits. Not a walk on an errand (VB-228; Kim, 18 Nov): an idle walk is a stroll towards company, so
  // the talk is where it was going, and a walk let go of has nowhere left to go; a walk to a place the pawn chose is not broken off.
  // @state agent.errand: true from the verb `walkTo` to a place (not a stroll, `near`) until the pawn's next walk or its release, else
  //   absent: the walk is to somewhere of its own choosing. Written here only (walkTo, release); plain data, saved.
  function haltForTalk(st, g, until) {
    if (g.path && g.errand) return;
    if (!g.inside && !g.job && unbound(g) && g.occasion === null) {
      if (g.path) halt(st, g);
      g.anim = 'idle';
      g.idleUntil = Math.max(g.idleUntil, until);
      waitLeg(st, g);
    }
  }
  function stillAtDeath(st, a) {
    delete a.moving;
    if (a.away !== undefined) emit(st, 'stillAway', a); // a pawn who dies away dies there (VB-287); a gift still to fetch stays where it lies
    release(st, a);
    dropMind(st, a);
    halt(st, a); // where its walk had come to; its route dropped
    a.inside = true;
    unleg(st, a);
    const p = st.pawns[a.id];
    if (p.household !== null) driveHome(st, st.households[p.household], a.id); // its herds are left by the farm
  }
  // The pawn walks to (x, y) in `tile`, outdoors, by the cheapest route (sim/legs setOut); `near`, an idle stroll to a neighbouring tile;
  // `errand`: the verb's walk to a place.
  function walkTo(st, a, tile, x, y, near, errand) {
    if (errand) a.errand = true;
    else delete a.errand;
    a.inside = false;
    a.anim = 'walk';
    setOut(st, a, tile, x, y, near);
  }
  // Where on the site a pawn stands to do the job: as its kind says, else the middle of the tile.
  const workSpot = (st, a, j) =>
    KINDS[j.kind].spot ? KINDS[j.kind].spot(st, a, j) : [st.w.hx[j.site], st.w.hy[j.site]];
  // The pawn joins the job's workers (j.claims) and sets out for it.
  function start(st, a, j) {
    settle(st, j);
    j.claims.push(a.id);
    a.job = j;
    delete a.homeward; // a task begun is no walk home
    assign(a, 'full');
    rerate(st, j);
    const setOut = Methods.says(KINDS[j.kind], 'setOut'); // its method's (VB-1821)
    if (setOut) setOut(st, a, j, teamFree); // what it sets out with (the water's barrel, VB-1586), not a load in hand
    onward(st, a); // its first leg read from the world (VB-1775; VB-1750: every kind a goal with methods)
  }
  function dropJob(st, j) {
    // those holding it at the side let it go at once (VB-473: a herder's task taken down)
    for (const id of [...(j.claims || [])]) {
      const b = st.agents[id];
      if (b && minds(b, j)) unhold(st, b, j);
    }
    dequeue(st, j);
    if (st.jobs.get(j.key) === j) st.jobs.delete(j.key);
    const s = j.owner && st.jobsBy.get(ownerKey(j.owner));
    if (s) s.delete(j);
    if (teamKind(j) && st.households[j.owner.id]) retune(st, st.households[j.owner.id]); // the ox team goes to the next task
  }
  // The cart pawn `a` has out stands at (at, x, y), with a lying `leftCart` for its household's hands to fetch (VB-649).
  function standCart(st, a, at, x, y) {
    const hh = st.pawns[a.id].household !== null ? st.households[st.pawns[a.id].household] : null,
      cart = hh && Carts.leave(st, hh, a.id, { tile: at, x, y });
    if (cart)
      Lying.leave(
        st,
        'leftCart',
        1,
        at,
        { type: 'household', id: hh.id },
        { x, y, of: { cart: { kind: cart.kind, built: cart.built } } },
      );
  }
  // The pawn leaves its job, which keeps its progress for whoever takes it up. `homeward`: it is let go to go home (the working day's end):
  // a trip whose yield accrues, cut at its work, carries what it has home instead (tripHome), and the pawn keeps its task until it is in.
  function release(st, a, homeward = false) {
    if (homeward && atWork(a) && KINDS[a.job.kind].accrues && tripHome(st, a)) return;
    // A load on its way home is not brought in from the road: a hand that can walk on is not released until it has (VB-581: `moved`
    // waits for the delivery, and the planner, the occasions, the orders and the working day's end find it on its way home and leave it).
    // One released here puts the load down where it stands: in its own field or meadow it goes back with the stooks or the mown hay;
    // elsewhere (its death on the road, its household dissolving) it lies there for the task's owner to fetch (VB-611, sim/lying). A task
    // that has no more loads to give is done with. A load no kind fetches (a barrel's water, VB-1604) is spilt: nothing lies.
    let laid = null;
    if (a.load > 0 && a.job) {
      const [x, y] = placeOf(st, a),
        at = tileAt(st, x, y);
      // a pile with title where it stands (VB-1775: it cannot walk on), or at its site back where its method took it up (VB-1821)
      Doing.unload(st, a, Methods.RULE.drop, x, y);
      standCart(st, a, at, x, y); // its cart stands where it was, with the team that drew it, until a hand fetches them (VB-649)
      a.carry = null;
      laid = a.job;
    }
    // a pawn released at its work (dung carted, firewood cut beside the cart) leaves the cart there too, away from the farm (VB-993)
    if (!laid && a.job && st.pawns[a.id].household !== null) {
      const [x, y] = placeOf(st, a),
        at = tileAt(st, x, y),
        hh = st.households[st.pawns[a.id].household];
      if (hh.farmstead !== null && at !== st.farmsteads[hh.farmstead].house) standCart(st, a, at, x, y);
    }
    const left = a.job;
    if (left) settle(st, left);
    if (left && atWork(a) && KINDS[left.kind].accrues) cutTrip(st, a, left);
    if (left) {
      const c = left.claims,
        i = c.indexOf(a.id);
      if (i >= 0) c.splice(i, 1);
      a.job = null;
    }
    delete a.errand;
    delete a.sentHome;
    unbind(a);
    if (left) rerate(st, left); // a hand gone: the end is told again; the goal stays posted while it is wanted (VB-1812)
    a.basis = null;
    a.load = 0; // wood cut and stacked, not yet on its way, is left
    const hid = st.pawns[a.id].household;
    if (hid !== null) {
      Carts.leave(st, st.households[hid], a.id); // and its cart is free
      retune(st, st.households[hid]);
    }
    if (!a.path) waitLeg(st, a);
    else repace(st, a); // a walk goes on, at the pace of what it now carries
  }
  // A trip whose yield accrues with the work, cut at its work by the end of the working day (VB-1748; design.md section 7, A trip's yield
  // accrues with the work): what its hours so far have yielded is made, and the pawn carries it home as at the work's end; nothing made
  // (a hunt with no kill), the hours are spent, and the pawn is let go. Whether it went home with a load.
  function tripHome(st, a) {
    const j = a.job,
      K = KINDS[j.kind];
    settle(st, j);
    const frac = Math.min(1, (j.done || 0) / (j.hours ?? K.hours));
    if (!(frac > 0)) return false;
    K.make(st, a, j, frac, workFor(st, a, j));
    j.done = 0;
    a.loadOf = null; // made in the hand (sim/doing)
    if (!(a.load > 0)) {
      a.load = 0;
      return false; // nothing made: the trip is not done, and the next hand takes it from none (VB-1749 review, F1)
    }
    j.made = (j.made || 0) + 1; // a trip's goal is its work done, a load made (sim/methods trip, VB-1749)
    freeHands(st, j, a.id);
    a.carry = Doing.lookOf(j.kind);
    a.inside = false;
    unleg(st, a); // the work leg is over: its load in hand goes home by the methods (the rule for a load in hand)
    rerate(st, j);
    onward(st, a);
    return true;
  }
  // A trip whose yield accrues with the work (fishing, hunting, gathering; design.md section 7, The good is made where the work is done)
  // cut at its work otherwise (a death, a call): what its hours so far have yielded is made, and lies where the pawn stands as a pile
  // of the task's owner, fetched home by its fetch kind (sim/lying); the hours are the yield's, so the task begins again from none. Only
  // the hours not yet worked are lost (VB-1748).
  function cutTrip(st, a, j) {
    const K = KINDS[j.kind],
      frac = Math.min(1, (j.done || 0) / (j.hours ?? K.hours));
    if (!(frac > 0)) return;
    K.make(st, a, j, frac, workFor(st, a, j));
    if (a.load > 0) {
      const [x, y] = placeOf(st, a);
      // a goal's pile lies at its site, where its method looks for it (sim/doing's view: a spot by the water counts as the site)
      Lying.lay(st, a, j, Doing.planOf(j.kind).uses[0], Doing.VIEW.at(st, a), x, y);
    }
    a.load = 0;
    j.done = 0;
  }
  // The background task j is due (sim/work dueWork, which found its first holder a, and finished it): a lets it go, its kind's `done` runs
  // for a's household, and the task is taken down (the others let it go there); a, if it stands idle outdoors, goes home.
  function sideEnded(st, j, a) {
    const K = KINDS[j.kind];
    unhold(st, a, j);
    if (K.done) K.done(st, j, st.households[st.pawns[a.id].household], cal(st.t), a.id);
    prospected(st, a.id, here(st, a), j.hours ?? K.hours);
    dropJob(st, j);
    if (!a.job && !a.path && !a.inside && unbound(a)) goHome(st, a);
  }
  // The work is done: everyone working the job but the one who finished it stops, and looks for other work; one that held it at the side
  // lets it go and keeps its task. (Over a copy: letting go takes the pawn out of j.claims, which skipped the next worker; VB-136.)
  function freeHands(st, j, finisher) {
    settle(st, j);
    for (const id of [...j.claims]) {
      if (id === finisher) continue;
      const b = st.agents[id];
      if (b.load > 0) continue; // a load on the road stays the job's (VB-335)
      if (minds(b, j)) {
        unhold(st, b, j);
        continue;
      }
      if (b.path) halt(st, b); // it stands where its walk had come to
      b.job = null;
      unbind(b);
      b.inside = false;
      b.anim = 'idle';
      waitLeg(st, b); // it looks for work at once
    }
    j.claims = j.claims.filter((id) => id === finisher || st.agents[id].load > 0);
    rerate(st, j);
  }
  // Household hh is going (sim/heirs' extinct): the jobs it posted and those on its farm f go, and those working them stop, as freeHands
  // stops them (a neighbour helping, VB-106, would finish a job of no household); a load on its way home, its own people's or a helper's,
  // is put down first where its carrier stands (release), for the task's owner to fetch (VB-611; one of the household going rots at the frost).
  function stopWorkFor(st, hh, f) {
    const jobs = new Set(st.jobsBy.get(`household:${hh.id}`));
    for (const j of st.jobs.values()) if (j.farm === f) jobs.add(j);
    const carriers = new Set(hh.members);
    for (const j of jobs) for (const id of j.claims) carriers.add(id);
    for (const id of carriers) {
      const a = st.agents[id];
      if (!a || !(a.load > 0) || !a.job || !st.pawns[id].alive) continue;
      release(st, a);
      if (a.moving)
        emit(st, 'moveOn', a); // the move it was told of (sim/journeys' moved)
      else standStill(st, a);
      a.anim = 'idle';
    }
    for (const j of jobs) {
      freeHands(st, j, -1);
      dropJob(st, j);
    }
  }
  // The household a job is done for: the job's own, or the pawn's for a village's job (a helper works for another household, VB-106).
  const workFor = (st, a, j) =>
    st.households[j.owner && j.owner.type === 'household' ? j.owner.id : st.pawns[a.id].household];
  // The work is done: those who finished it together know each other better (sim/relations); the job does what its kind says (sim/kinds:
  // a plot's step finished through its kind's, sim/expansion plotted, VB-1821), for the household it was done for.
  function complete(st, a) {
    const j = a.job,
      hh = workFor(st, a, j),
      K = KINDS[j.kind];
    if (j.claims.length > 1) workedTogether(st, j.claims);
    freeHands(st, j, a.id);
    prospected(st, a.id, here(st, a), j.hours ?? K.hours ?? 0); // a hidden vein near the work may be come on (sim/prospect)
    if (K.done) K.done(st, j, hh, cal(st.t), a.id); // a.id: who finished it (a made piece's grade is its maker's, VB-761)
    if (st.player && st.player.pawn === a.id)
      emit(st, 'yielded', { pawn: a.id, kind: j.kind, farm: j.farm ?? null, good: null, n: 0 });
    dropJob(st, j);
  }
  const wantsWork = (st, a, c) => !a.path && unbound(a) && c.hour >= WORK[0] && c.hour < WORK[1] && a.idleUntil <= st.t;
  // A walk has ended where it was going (walkEnd): what the pawn went for begins. One left with nothing in hand waits, and looks for work
  // at the next step.
  function arrived(st, a) {
    a.anim = 'idle';
    if (a.job) {
      onward(st, a); // the next leg read from the world (VB-1775)
      const h = cal(st.t).hour;
      if ((h >= WORK[1] || h < WORK[0]) && !a.job && !a.path && !a.inside && unbound(a) && a.away === undefined)
        goHome(st, a);
    } else if (a.homeward) {
      a.inside = true;
      unbind(a);
      if (a.away === undefined) {
        driveHome(st, st.households[st.pawns[a.id].household], a.id); // the herds it brought home are by the farm (VB-136)
        if (a.packing) emit(st, 'homeToPack', a); // home to pack for a stay (sim/away, VB-1175)
      } else emit(st, 'atBed', a); // at the bed of its stay, or home from it (sim/away)
    } else if (a.journey === 'walk') emit(st, 'legEnd', a); // a journey's leg has arrived (sim/journeys)
    if (!a.leg && !a.path && unbound(a) && st.pawns[a.id].alive) waitLeg(st, a, st.tick + 1);
    mindCheck(st, a);
  }
  // Home, letting go of its side tasks (VB-136).
  function goHome(st, a) {
    const to = bed(st, a),
      [x, y] = spotAt(st, a, to);
    dropMind(st, a);
    walkTo(st, a, to, x, y);
    a.homeward = true;
  }
  // A work leg is done: its effect where the pawn stands, if it is still the step the world asks for, and on (VB-1775, VB-1750).
  function ended(st, a) {
    const j = a.job,
      K = KINDS[j.kind];
    const s = Doing.ask(st, a),
      work = s !== DONE && !s.blocked && s.prim === 'work',
      ends = work && !!K.ops[s.op].ends;
    if (work) {
      Doing.work(st, a, s);
      if (ends) {
        complete(st, a); // the work's end is the kind's (its `done`, a plot's step finished; VB-1750)
        // a completion that moved its pawn (a farm restored: it founds a household there) released it and set it out
        if (a.job !== j) return;
      } else prospected(st, a.id, here(st, a), Doing.hoursOf(j, s));
    }
    settle(st, j);
    if (!ends) j.done = 0; // a task ended keeps its hours done as it is taken down
    if (atWork(a)) unleg(st, a); // the work leg is over (a hand walking when its task's end fell due walks on)
    a.anim = 'idle';
    rerate(st, j);
    onward(st, a);
  }
  // ---- a goal with methods (sim/methods, VB-1775; design.md section 7, The task as a plan): the one switch is in start, arrived, ended
  // and release; every kind is one (VB-1750). At each leg's end or cut the pawn's next step is read from the world
  // (sim/doing's view) and begun: a walk ('go' out, 'back' with a load), a work leg, or at once a cart taken, a load taken up or set down.
  // Past the working day only a load in hand goes on home (A load in hand), and a task lived by (VB-1547); the rest waits for tomorrow.
  const spotFor = (st, a, to, j) =>
    to === j.site && KINDS[j.kind].spot
      ? workSpot(st, a, j)
      : [st.w.hx[to] + 7 + a.ox * 0.3, st.w.hy[to] + 16 + a.oy * 0.15];
  // A pawn on a day owed whose hours are booked (sim/days given: no longer on duty) has given its working day: as at the day's end, only a
  // load in hand goes on, to the creditor's store, and the pawn then goes home (VB-1749; design.md section 7, A load in hand).
  const dayGiven = (st, a) => Days.given(st, a.id);
  // The hours a pawn may work now: the working day, or past it a task lived by (VB-1547) or the player's command, and never a day owed
  // already given (VB-1813: one rule for the day's end and the day given).
  const mayWork = (st, a, j) => {
    if (dayGiven(st, a) || a.sentHome) return false;
    const h = cal(st.t).hour;
    return (h >= WORK[0] && h < WORK[1]) || carriedOn(st, j) || commanded(st, a.id);
  };
  function onward(st, a, depth = 0) {
    const j = a.job,
      g = Doing.goalOf(st, a),
      s = Doing.ask(st, a, g),
      h = cal(st.t).hour,
      given = dayGiven(st, a) || !!a.sentHome; // sent home with its load in hand: the delivery done, it goes in (VB-1893)
    if (s === DONE) {
      // the goal met: its other hands stop, and it is taken down; the pawn looks for work
      freeHands(st, j, a.id);
      if (st.jobs.get(j.key) === j) dropJob(st, j);
      a.job = null;
      a.basis = null;
      unbind(a);
      a.inside = false;
      // past the working day, free, it goes in, as one whose load came in does (arrived; VB-1812: a goal met at its work leg)
      if ((given || h >= WORK[1] || h < WORK[0]) && !a.path && a.away === undefined && st.pawns[a.id].alive)
        goHome(st, a);
      else if (!a.path) waitLeg(st, a);
      return;
    }
    const carrying = s.rule || s.prim === 'haul' || s.prim === 'unload' || s.prim === 'return';
    if (a.moving && !carrying) {
      // told to move while on the road (VB-581): its load set down, it lets the goal go and moves on (sim/away's moved; VB-1812)
      release(st, a);
      emit(st, 'moveOn', a);
      return;
    }
    if (s.blocked || depth > 8 || (!carrying && !mayWork(st, a, j))) {
      // nothing it can do now (the reason is the step's), or the day is over: it lets the task go, which stays posted while wanted
      if (s.blocked && st.jobs.get(j.key) === j && j.claims.length <= 1) dropJob(st, j);
      release(st, a);
      if (given && !a.path && !a.inside && unbound(a) && a.away === undefined) goHome(st, a); // its day given, home
      return;
    }
    const at = here(st, a),
      to = Doing.placeOf(st, a, s, g);
    if (
      s.prim === 'load' ||
      s.prim === 'unload' ||
      (s.prim === 'fetch' && to === at) ||
      (s.prim === 'return' && to === at)
    ) {
      if (s.prim === 'load') Doing.load(st, a, s, g);
      else if (s.prim === 'unload') {
        const [x, y] = placeOf(st, a);
        Doing.unload(st, a, s, x, y);
      } else if (s.prim === 'fetch') {
        Doing.takeCart(st, a);
      } else {
        Carts.home(st, st.households[st.pawns[a.id].household], a.id); // the cart is back where it is kept, and wears
        retune(st, st.households[st.pawns[a.id].household]);
      }
      onward(st, a, depth + 1);
      return;
    }
    if (s.prim === 'work') {
      settle(st, j);
      if (j.op !== s.op) {
        // the hours on the task are a work leg's of one kind (sim/progress), begun anew for another; a task's first leg keeps the hours it
        // was posted with (a stage's, kept on its record while its task is posted again: VB-1407, VB-1750)
        if (j.op !== undefined) j.done = 0;
        j.op = s.op;
      }
      j.hours = Doing.hoursOf(j, s);
      const K = KINDS[j.kind];
      a.anim = K.anim || 'idle';
      a.inside = !!s.inside; // a step worked indoors (sim/methods labour)
      unleg(st, a); // a wait it had (begun from start) is over
      halt(st, a); // at work it walks nowhere: a route left from a walk its task cut is dropped (VB-1751)
      workAt(st, a);
      a.pace = Skills.workPace(st, a.id, K.type, K.craft);
      rerate(st, j);
      return;
    }
    if (to === null || to === undefined) {
      release(st, a);
      return;
    }
    const [x, y] = spotFor(st, a, to, j);
    if (s.prim === 'haul') a.carry = a.carry || Doing.lookOf(j.kind);
    rerate(st, j);
    walkTo(st, a, to, x, y);
  }
  // The pawn stops where it is: a walk in hand is cut there, and, with nothing in hand, it waits.
  function standStill(st, a) {
    if (a.path) halt(st, a);
    if (unbound(a)) waitLeg(st, a);
  }
  // Walk leg l is due: the pawn arrives (every tile of the rest of the way trodden), or, on a journey, stops for the night where it has come
  // to and rests there until 6:00.
  function walkEnd(st, a, l) {
    if (walked(st, a, l)) {
      arrived(st, a);
      return;
    }
    a.journey = 'rest';
    a.anim = 'idle';
    roadWait(st, a);
  }
  // ---- the step (VB-205, VB-473): the legs due end, and nothing else is touched ----
  // @state st.stepAt: {moving, walked}, a cache owned here; null until the first step; derived, not saved (`sim/saves` DERIVED): the
  //   tick whose legs have begun to be taken, and the tick whose legs have all been taken. Between steps both are the tick (a loaded run).
  // The working day's start (WORK[0]) is one event for those waiting for it: the free pawns with no leg look for work, or wait for their
  // pause to end. Once a day over the living, where the awake list walked them every hour.
  function dayStart(st, c, offer) {
    for (const id of st.living) {
      VB.count.walkAwake++;
      const a = st.agents[id];
      if (a.leg || a.path || !unbound(a)) continue;
      if (wantsWork(st, a, c)) offer(a);
      else waitLeg(st, a, st.tick);
    }
  }
  // The tasks due end (dueWork); then the legs due: a walk arrives (or stops on the road for the night), a journey's rest ends and its
  // next leg sets out, and a wait ends: a free pawn that wants work joins the list returned (in id order) for the planner (sim/clock),
  // with those the working day's start finds waiting. A whole 6-minute step, always: the page draws the pawns between steps (VB-244).
  function stepAgents(st, c) {
    if (!st.stepAt) st.stepAt = { moving: -1, walked: -1 };
    st.stepAt.moving = st.tick; // the step's work is done and its legs are being taken (workTick, walkTick)
    legsOf(st); // the queue, built at the first step
    const out = [],
      seen = new Set(),
      offer = (a) => {
        if (!seen.has(a.id)) {
          seen.add(a.id);
          out.push(a);
        }
      };
    dueWork(st, ended, sideEnded);
    if (st.tick % (DAY * TICKS) === WORK[0] * TICKS) dayStart(st, c, offer);
    dueLegs(st, (st, a, l) => {
      if (l.kind === 'walk') walkEnd(st, a, l);
      else if (a.journey === 'rest')
        emit(st, 'legDue', a); // a journey's rest on the road is over (sim/journeys)
      else if (wantsWork(st, a, c)) offer(a);
      else waitLeg(st, a, st.tick + 1);
    });
    st.stepAt.walked = st.tick;
    return out.filter((a) => !a.leg && wantsWork(st, a, c)).sort((a, b) => a.id - b.id);
  }
  // After the planner (sim/clock): a pawn it was offered to and left free with nothing in hand (a side task taken up where it stands, a
  // command refused, the player's pawn) looks again at the next step, as the stepping did.
  function rest(st, all) {
    for (const a of all) if (!a.leg && !a.path && unbound(a) && st.pawns[a.id].alive) waitLeg(st, a);
  }
  // A loaded run: a save is made between steps, so the step now has been worked and walked. A save made before VB-472 stepped its workers
  // (agent.work, the rows; job.cast, VB-471): its tasks under work are reckoned from now. One made before VB-473 has no legs (an awake list,
  // journeys with a due time): each pawn's leg is built from where it is and what it does.
  // The kind an older save's fetch kind fetched for (until VB-1814: 'fetch' and the kind's name, its first letter raised), or undefined.
  const fetchedFor = (kind) => {
    const k = kind.startsWith('fetch') && kind.length > 5 ? kind[5].toLowerCase() + kind.slice(6) : null;
    return k && KINDS[k] ? k : undefined;
  };
  function loaded(st) {
    st.stepAt = { moving: st.tick, walked: st.tick };
    Attention.loaded(st); // a charge held as a side task before VB-1750 is minded
    for (const a of st.agents) if ('work' in a) delete a.work;
    for (const stay of st.away || []) delete stay.due; // lint-allow: owner a stay of sim/away in a save made before VB-473 loses its due
    legsOf(st);
    // a task of a kind this build has no more (VB-1775, VB-1814: the fetch kinds; their piles are the stray method's) is taken down, its hands
    // freed where they stand, a load in hand set down there as its owner's pile
    for (const j of [...st.jobs.values()]) {
      if (KINDS[j.kind]) continue;
      for (const id of j.claims) {
        const b = st.agents[id];
        if (!b || b.job !== j) continue;
        const [x, y] = placeOf(st, b),
          lying = fetchedFor(j.kind);
        // what its delivery reads kept with it (the grain's crops, a move's mark: VB-1814)
        if (b.load > 0 && lying && j.owner) Lying.lay(st, b, j, lying, tileAt(st, x, y), x, y);
        if (b.path) halt(st, b);
        Object.assign(b, { job: null, basis: null, load: 0, carry: null, inside: false, anim: 'idle' });
        waitLeg(st, b);
      }
      dequeue(st, j);
      st.jobs.delete(j.key);
      const s = j.owner && st.jobsBy.get(ownerKey(j.owner));
      if (s) s.delete(j);
    }
    for (const j of st.jobs.values()) {
      delete j.cast;
      if ((j.at === undefined || j.at === null) && j.claims.length) rerate(st, j, false);
      // a background task minded in a save made before VB-473 had its due but was not queued: its end is queued now
      else if (j.rate > 0 && attentionOf(j) === 'mind' && !(st.workDue || []).includes(j)) rerate(st, j, false);
    }
  }
  // ---- away from home (VB-783; design.md, Sleeping away from home): the stays are sim/away's (st.away, agent.away); what is left here is
  // the walking of a journey's legs (the bed, which every walk home reads, is sim/pose's). sim/away loads after this module, and hears
  // by sim/events of a leg's end, a rest's end on the road, a death, a move made once a load is in, and an arrival at the bed of one
  // away ----
  // A journey's pawn rests on the road where it stands until its next leg, at the next 6:00.
  function restOnRoad(st, a) {
    if (a.path) halt(st, a);
    a.journey = 'rest';
    a.anim = 'idle';
    roadWait(st, a);
  }
  // A journey's leg to tile `to`: the route is found at the first (a journey costs one search), and walked on from where the pawn stopped
  // at the others. Its walk stops for the night at the last step before WORK[1] (begin), and its rest on the road ends at 6:00.
  function walkLeg(st, a, to) {
    a.journey = 'walk';
    if (!a.path) {
      const [x, y] = spotAt(st, a, to);
      walkTo(st, a, to, x, y);
    } else {
      a.inside = false;
      a.anim = 'walk';
      begin(st, a); // the walk goes on from where it stopped
    }
  }
  // A journey's pawn turns for tile `to`: walking, from where its walk has come to; resting on the road, its next leg finds its way from
  // where it stopped.
  function turnTo(st, a, to) {
    if (a.journey === 'walk') {
      const [x, y] = spotAt(st, a, to);
      walkTo(st, a, to, x, y);
    } else halt(st, a); // resting on the road: its route is dropped
  }
  // Pawn a lets go of what it has in hand (its task, its side tasks, a load of its own field) before it sets out.
  function setDown(st, a) {
    release(st, a);
    dropMind(st, a);
    a.carry = null; // the load of a hand in its own field was set down by release
  }
  // A walk in hand ends where it has come to.
  function stop(st, a) {
    if (a.path) halt(st, a);
  }
  // A pawn moved at night, or in its own house (sim/journeys' moved), stays where it is and walks when its day starts; in its own house
  // (`same`) it is home already.
  function waitIndoors(st, a, same) {
    if (a.path) halt(st, a);
    unbind(a);
    a.anim = 'idle';
    if (same) placeAtHome(st, a);
    waitLeg(st, a);
  }
  // A child born to a mother away from home (VB-425; no teleporting) is where she is, outdoors.
  function standBy(st, a, m) {
    const [x, y] = placeOf(st, m);
    putAt(st, a, x, y);
    a.inside = false;
    a.anim = 'idle';
  }
  function describe(st, id) {
    const a = st.agents[id];
    if (a.job) {
      const J = KINDS[a.job.kind],
        K = J.words ? { ...J, ...J.words(st, a.job) } : J; // VB-1670: a kind whose words read the state (sim/byre fodder)
      if (a.load > 0) return Doing.wordsOf(a.job.kind); // the haul leg's words, its method's
      if (!atWork(a)) return K.go;
      return withOxen(st, a) ? 'Ploughing with the oxen' : K.verb;
    }
    const bg = a.mind ? a.mind[0] : null;
    if (bg) return a.path ? KINDS[bg.kind].go : KINDS[bg.kind].verb; // VB-136: with the herds
    const s = a.away === undefined || travelling(a) ? null : stayOf(st, id); // a stay at a bed (VB-783)
    if (a.homeward) return s && !s.back ? 'Walking to where it sleeps away' : 'Walking home';
    if (travelling(a)) {
      const g = stayOf(st, id).gift; // a fetch of a gift (VB-461)
      if (g && g.haul)
        return g.held > 0 ? 'Carrying grain to the store' : `Going for grain for the store at ${g.stops[0].name}`;
      if (g && g.stops)
        return g.held > 0 ? `Carrying grain home from ${g.from}` : `Going for grain at ${g.stops[0].name}`;
      const j = stayOf(st, id); // a suitor's visit (VB-289)
      if (j.why === 'visit' && (j.guest || !j.back)) {
        const name = st.villages[j.village].name;
        return j.guest
          ? `A guest at ${name}`
          : a.journey === 'walk'
            ? `On the road to visit ${name}`
            : `Resting on the road to ${name}`;
      }
      const f = st.farmsteads[st.households[st.pawns[a.id].household].farmstead];
      return a.journey === 'walk' ? `On the road to ${f.name}` : `Resting on the road to ${f.name}`;
    }
    if (a.inside) return s ? 'Away from home' : 'At home';
    return a.path ? 'Strolling' : 'Resting';
  }
  // A pawn on a day owed has given its day's hours (sim/days step, VB-1749): its working day is over, as at the day's end (sim/clock): a
  // trip cut at its work carries its yield home, a load in hand goes on to the creditor's store (onward, the rule for a load in hand), and
  // one free goes home. sim/days sends nobody home itself.
  on('dayGiven', (st, d) => {
    const a = st.agents[d.pawn];
    if (!a || !st.pawns[a.id].alive || a.load > 0 || commanded(st, a.id) || travelling(a)) return;
    if (a.occasion !== null || a.homeward || a.away !== undefined) return;
    if (a.job) release(st, a, true);
    if (!a.inside && !(a.load > 0)) goHome(st, a);
  });
  // A charge held out of reach, with no task in hand (sim/attention hold): the pawn sets out for it (the last taken up).
  on('mindAway', (st, a) => {
    const j = a.mind[a.mind.length - 1],
      [x, y] = workSpot(st, a, j);
    walkTo(st, a, j.site, x, y);
  });
  // A living pawn not on a journey (VB-287): on the road it takes no work, walks nowhere else and goes to no occasion.
  const free = (st, id) => living(st, id) || (travelling(st.agents[id]) ? `pawn ${id} is on the road` : null);
  // work(job): leave the job in hand, if any (it keeps its progress), and set out for the job with key `target`; it holds it in the
  // slot of its attention. Pending while the pawn holds that assignment ({slot, key, n}, sim/attention): it ends when the pawn lets it go,
  // whoever else works on, even if the same key is posted again or the pawn takes the job afresh. A command begun before VB-1405 kept no
  // reference: it goes on while any slot of the pawn holds a job of that key.
  register('work', {
    check: (st, c) =>
      free(st, c.actor) ||
      (!st.jobs.has(c.target)
        ? `there is no job ${c.target}`
        : !isOpen(st, st.jobs.get(c.target))
          ? `job ${c.target} has no room`
          : !eligible(st, st.jobs.get(c.target), st.pawns[c.actor])
            ? `job ${c.target} is not pawn ${c.actor}'s to take`
            : attentionOf(st.jobs.get(c.target)) !== 'full'
              ? mindWhy(st, st.agents[c.actor], st.jobs.get(c.target))
              : null),
    run: (st, c) => {
      const a = st.agents[c.actor],
        j = st.jobs.get(c.target),
        slot = attentionOf(j);
      if (slot !== 'full')
        hold(st, a, j); // a charge is minded beside the pawn's task (VB-251, VB-1750)
      else {
        release(st, a);
        // @state agent.opener (VB-1761): who opened the task in hand, 'head' (the planner's command: the head's allotment, call or duty)
        //   or 'pawn' (its own, or the player's); read only by its legs' `by` (sim/legs). Written only here.
        a.opener = c.source === 'planner' ? 'head' : 'pawn';
        start(st, a, j);
        a.basis = eligible(st, j, st.pawns[a.id]);
        restamp(st, a); // the leg it set out on, told its basis (sim/legs, VB-1761)
        if (a.mind) reachAfter(st, a);
      }
      return { slot, key: j.key, n: slot === 'full' ? a.assigned.full : a.assigned.mind[j.key] };
    },
    active: (st, c, ref) => {
      const a = st.agents[c.actor];
      if (ref) return holds(a, ref);
      return inSlot(a, 'full', c.target) || inSlot(a, 'mind', c.target);
    },
  });
  // The pawn's walk, its way home and its idling last as the pawn's own state says (its walk, out of doors; the hour), whatever
  // the reference: each pawn has one walk at a time.
  // walkTo(tile): walk to the tile, to the spot args {x, y} in map units (the tile's centre if absent), by the cheapest route
  register('walkTo', {
    // Not refused on a tile the walking rule closes: an idle walk to company may end on a river tile (twice in a founders year at seed 7),
    // and the walk goes ahead as it always has; refusing it would change behaviour (VB-168). A player's walk should offer open tiles only.
    check: (st, c) =>
      free(st, c.actor) ||
      (!(Number.isInteger(c.target) && c.target >= 0 && c.target < st.w.N) ? `there is no tile ${c.target}` : null),
    run: (st, c) => {
      const x = c.args && c.args.x !== undefined ? c.args.x : st.w.hx[c.target],
        y = c.args && c.args.y !== undefined ? c.args.y : st.w.hy[c.target];
      const near = !!(c.args && c.args.near);
      walkTo(st, st.agents[c.actor], c.target, x, y, near, !near);
      return { walk: c.target };
    },
    active: (st, c) => !!st.agents[c.actor].path,
    frees: true,
  });
  // goHome: walk home and go in (agent.homeward)
  register('goHome', {
    check: (st, c) =>
      free(st, c.actor) || (st.pawns[c.actor].household === null ? `pawn ${c.actor} has no home` : null),
    run: (st, c) => {
      // the job in hand is let go first, whoever sends it home (the queue, the day's end, a lent hand's hours given, its own time):
      // a hand on its way home works no task (VB-1565)
      const a = st.agents[c.actor];
      // except a load in hand on a call that is not urgent (design.md section 7, a load in hand; VB-1893): it is brought to its owner's
      // store first, by the rule, and the pawn goes in when it is down (a.sentHome, read by onward). Urgent, or a pawn that cannot walk
      // on (its caller says so, urgent): the load is put down where it stands, as release does.
      if (a.job && a.load > 0 && !(c.args && c.args.urgent) && !a.inside) {
        a.sentHome = true;
        return { home: 'after the load' };
      }
      if (a.job) release(st, a);
      goHome(st, a);
      return { home: true };
    },
    active: (st, c) => !st.agents[c.actor].inside && !!st.agents[c.actor].path,
    frees: true,
  });
  // idle(until): look for nothing to do until game time args.until
  register('idle', {
    check: (st, c) =>
      free(st, c.actor) ||
      (!(c.args && c.args.until >= st.t) ? `idle until ${c.args && c.args.until}, which is past` : null),
    run: (st, c) => {
      idle(st, st.agents[c.actor], c.args.until);
      return { until: c.args.until };
    },
    active: (st, c) => st.t < c.args.until,
    frees: true,
  });
  // haltForTalk(until): pause an idle outdoor pawn until the talk ends, leaving work and indoor pawns alone
  register('haltForTalk', {
    check: (st, c) =>
      living(st, c.actor) ||
      (!(c.args && c.args.until >= st.t) ? `talk until ${c.args && c.args.until}, which is past` : null),
    run: (st, c) => haltForTalk(st, st.agents[c.actor], c.args.until),
  });
  return {
    free,
    dropJob,
    homeSpot,
    placeAtHome,
    placeByDoor,
    idle,
    haltForTalk,
    stillAtDeath,
    walkTo,
    workSpot,
    start,
    release,
    freeHands,
    stopWorkFor,
    complete,
    wantsWork,
    arrived,
    goHome,
    standStill,
    loaded,
    stepAgents,
    rest,
    describe,
    restOnRoad,
    walkLeg,
    turnTo,
    setDown,
    stop,
    waitIndoors,
    standBy,
  };
})();
