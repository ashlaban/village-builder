// @sys sim/agents: what a pawn does with its legs: the job's phases (set out, arrive, a load home, done, released), home placement, talks,
// death, a journey's walking, the step that takes the legs and tasks due, and the verbs; its legs are sim/legs', its work sim/work's (VB-422)
VB['sim/agents'] = (() => {
  const { living } = VB['sim/records'];
  const { isOpen } = VB['sim/kinds'];
  const { register } = VB['sim/commands'];
  const { cal, DAY, TICKS, WORK, TRAVEL } = VB['sim/rules'];
  const { eligible } = VB['sim/eligibility'];
  const Carts = VB['sim/carts'];
  const { driveHome } = VB['sim/grazing'];
  const { workedTogether } = VB['sim/relations'];
  const { on, emit } = VB['sim/events'];
  const { finishStep } = VB['sim/expansion'];
  const { worked: prospected } = VB['sim/prospect'];
  const { KINDS } = VB['sim/kinds'],
    { workTick } = VB['sim/progress'];
  const Lying = VB['sim/lying'];
  const Skills = VB['sim/skills'];
  const { tileAt, here, endTile, placeOf, travelling, stayOf, bed } = VB['sim/pose'];
  const {
    attentionOf,
    inReach,
    manning,
    settle,
    rerate,
    retune,
    dequeue,
    teamKind,
    ownerKey,
    withOxen,
    teamFree,
    dueWork,
  } = VB['sim/work'];
  const { heldAt, sideWhy, hold, unhold, dropSides, reachAfter, sideCheck, assign, inSlot, holds } =
    VB['sim/attention'];
  const { legsOf, waitLeg, roadWait, unleg, halt, begin, repace, setOut, putAt, workAt, walked, dueLegs } =
    VB['sim/legs'];
  // the spot by the door of the house on tile `house`, where pawn a would stand
  const spotAt = (st, a, house) => [st.w.hx[house] - 12 + a.ox * 0.3, st.w.hy[house] + 14 + a.oy * 0.15];
  // By the door of pawn a's household's house, wherever it sleeps: where an indoor task is done, and a load for the door is brought.
  const homeSpot = (st, a) => spotAt(st, a, st.farmsteads[st.households[st.pawns[a.id].household].farmstead].house);
  // Where pawn a lies down: by the door of its bed (VB-783: its household's house, unless it is away).
  const bedSpot = (st, a) => spotAt(st, a, bed(st, a));
  function placeAtHome(st, a) {
    unleg(st, a);
    const [x, y] = bedSpot(st, a);
    putAt(st, a, x, y);
    a.inside = true;
    halt(st, a); // with no leg, its route is dropped
    a.phase = null;
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
    if (!a.path && a.phase === null) waitLeg(st, a);
  }
  // A talk stops only an idle pawn outdoors, not one on its way to an occasion (VB-126), and never shortens an existing pause: its walk is
  // cut where it has come to, and it waits. Not a walk on an errand (VB-228; Kim, 18 Nov): an idle walk is a stroll towards company, so
  // the talk is where it was going, and a walk let go of has nowhere left to go; a walk to a place the pawn chose is not broken off.
  // @state agent.errand: true from the verb `walkTo` to a place (not a stroll, `near`) until the pawn's next walk or its release, else
  //   absent: the walk is to somewhere of its own choosing. Written here only (walkTo, release); plain data, saved.
  function haltForTalk(st, g, until) {
    if (g.path && g.errand) return;
    if (!g.inside && !g.job && g.phase === null && g.occasion === null) {
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
    dropSides(st, a);
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
    assign(a, 'full');
    rerate(st, j);
    const K = KINDS[j.kind];
    if (K.inside) {
      const [x, y] = homeSpot(st, a);
      a.phase = 'go';
      walkTo(st, a, j.farm.house, x, y);
      return;
    }
    const [x, y] = workSpot(st, a, j);
    a.phase = 'go';
    if (K.setOut) a.load = K.setOut(st, a, j, teamFree); // what it sets out with: a cart taken at the house (the water's barrel, VB-1555)
    walkTo(st, a, j.site, x, y);
  }
  function dropJob(st, j) {
    // those holding it at the side let it go at once (VB-473: a herder's task taken down)
    for (const id of [...(j.claims || [])]) {
      const b = st.agents[id];
      if (b && b.side && (b.side.partial === j || b.side.background === j)) unhold(st, b, j);
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
  // The pawn leaves its job, which keeps its progress for whoever takes it up.
  function release(st, a) {
    // A load on its way home is not brought in from the road: a hand that can walk on is not released until it has (VB-581: `moved`
    // waits for the delivery, and the planner, the occasions, the orders and the working day's end find it on its way home and leave it).
    // One released here puts the load down where it stands: in its own field or meadow it goes back with the stooks or the mown hay;
    // elsewhere (its death on the road, its household dissolving) it lies there for the task's owner to fetch (VB-611, sim/lying). A task
    // that has no more loads to give is done with. A load no kind fetches (a barrel's water, VB-1573) is spilt: nothing lies.
    let laid = null;
    if (a.load > 0 && a.phase === 'back' && a.job) {
      const K = KINDS[a.job.kind],
        [x, y] = placeOf(st, a),
        at = tileAt(st, x, y);
      if (K.setDown && at === a.job.site) K.setDown(st, a.job, a);
      else if (K.fetch || K.load || K.stack) Lying.lay(st, a, a.job, K.fetch || a.job.kind, at, x, y);
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
    if (left) {
      const c = left.claims,
        i = c.indexOf(a.id);
      if (i >= 0) c.splice(i, 1);
      a.job = null;
    }
    delete a.errand;
    a.phase = null;
    if (left) rerate(st, left); // a hand gone: the end is told again
    if (laid && !(KINDS[laid.kind].again && KINDS[laid.kind].again(laid))) dropJob(st, laid);
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
  // The background task j is due (sim/work dueWork, which found its first holder a, and finished it): a lets it go, its kind's `done` runs
  // for a's household, and the task is taken down (the others let it go there); a, if it stands idle outdoors, goes home.
  function sideEnded(st, j, a) {
    const K = KINDS[j.kind];
    unhold(st, a, j);
    if (K.done) K.done(st, j, st.households[st.pawns[a.id].household], cal(st.t));
    prospected(st, a.id, here(st, a), j.hours ?? K.hours);
    dropJob(st, j);
    if (!a.job && !a.path && !a.inside && a.phase === null) goHome(st, a);
  }
  // The work is done: everyone working the job but the one who finished it stops, and looks for other work; one that held it at the side
  // lets it go and keeps its task. (Over a copy: letting go takes the pawn out of j.claims, which skipped the next worker; VB-136.)
  function freeHands(st, j, finisher) {
    settle(st, j);
    for (const id of [...j.claims]) {
      if (id === finisher) continue;
      const b = st.agents[id];
      if (b.phase === 'back') continue; // a load on the road stays the job's (VB-335)
      if (b.side && (b.side.partial === j || b.side.background === j)) {
        unhold(st, b, j);
        continue;
      }
      if (b.phase === 'go') halt(st, b); // it stands where its walk had come to
      b.job = null;
      b.phase = null;
      b.inside = false;
      b.anim = 'idle';
      waitLeg(st, b); // it looks for work at once
    }
    j.claims = j.claims.filter((id) => id === finisher || st.agents[id].phase === 'back');
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
      if (!a || a.phase !== 'back' || !a.job || !st.pawns[id].alive) continue;
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
  // The work is done: those who finished it together know each other better (sim/relations); a plot's step is finished (sim/expansion),
  // any other job does what its kind says (sim/kinds), for the household it was done for.
  function complete(st, a) {
    const j = a.job,
      hh = workFor(st, a, j),
      K = KINDS[j.kind];
    if (j.claims.length > 1) workedTogether(st, j.claims);
    freeHands(st, j, a.id);
    prospected(st, a.id, here(st, a), j.hours ?? K.hours ?? 0); // a hidden vein near the work may be come on (sim/prospect)
    if (j.plot) {
      finishStep(st, j);
      dropJob(st, j);
      return;
    }
    if (K.done) K.done(st, j, hh, cal(st.t));
    if (st.player && st.player.pawn === a.id)
      emit(st, 'yielded', { pawn: a.id, kind: j.kind, farm: j.farm ?? null, good: null, n: 0 });
    dropJob(st, j);
  }
  // Home with the load: the kind says what it brings.
  function deposit(st, a) {
    const j = a.job,
      K = KINDS[j.kind];
    const hh = workFor(st, a, j);
    const load = a.load,
      got = K.deliver ? K.deliver(st, j, hh, st.farmsteads[hh.farmstead], a) : undefined;
    // the played pawn's sheet tells what the trip brought (sim/player, VB-1118): what the kind's delivery says it put, else the load carried
    if (st.player && st.player.pawn === a.id)
      emit(st, 'yielded', {
        pawn: a.id,
        kind: j.kind,
        farm: j.farm ?? null,
        good: K.carry ?? null,
        n: typeof got === 'number' ? got : load,
      });
    if (a.job !== j) return; // a delivery that moved its pawn released it (as `ended` after a completion)
    Carts.home(st, st.households[st.pawns[a.id].household], a.id); // the cart it came on, if any, wears
    retune(st, st.households[st.pawns[a.id].household]);
    if (!K.again || !K.again(j)) dropJob(st, j);
    else {
      settle(st, j);
      j.claims.splice(j.claims.indexOf(a.id), 1); // open for the next load
      rerate(st, j);
    }
    a.carry = null;
    a.load = 0;
    a.job = null;
    a.basis = null;
    a.phase = null;
  }
  const wantsWork = (st, a, c) =>
    !a.path && a.phase === null && c.hour >= WORK[0] && c.hour < WORK[1] && a.idleUntil <= st.t;
  // A walk has ended where it was going (walkEnd): what the pawn went for begins. One left with nothing in hand waits, and looks for work
  // at the next step.
  function arrived(st, a) {
    a.anim = 'idle';
    if (a.phase === 'go') {
      const K = KINDS[a.job.kind];
      settle(st, a.job);
      a.phase = 'work';
      a.anim = K.anim || 'idle';
      a.inside = !!K.inside;
      workAt(st, a); // the work leg
      a.pace = Skills.workPace(st, a.id, K.type, K.craft); // its skill at the work, the leg's mishap (VB-475), its craft (VB-360)
      rerate(st, a.job);
    } else if (a.phase === 'back') {
      deposit(st, a);
      if (a.moving) emit(st, 'moveOn', a); // the move it was told of while on the road (VB-581; sim/away's moved)
      // a load brought in after the work day, as one carried on (VB-1547): free, it goes in, as everyone free did at its end
      const h = cal(st.t).hour;
      if ((h >= WORK[1] || h < WORK[0]) && !a.job && !a.path && !a.inside && a.phase === null && a.away === undefined)
        goHome(st, a);
    } else if (a.phase === 'home') {
      a.inside = true;
      a.phase = null;
      if (a.away === undefined) {
        driveHome(st, st.households[st.pawns[a.id].household], a.id); // the herds it brought home are by the farm (VB-136)
        if (a.packing) emit(st, 'homeToPack', a); // home to pack for a stay (sim/away, VB-1175)
      } else emit(st, 'atBed', a); // at the bed of its stay, or home from it (sim/away)
    } else if (a.phase === 'journey') emit(st, 'legEnd', a); // a journey's leg has arrived (sim/journeys)
    if (!a.leg && !a.path && a.phase === null && st.pawns[a.id].alive) waitLeg(st, a, st.tick + 1);
    sideCheck(st, a);
  }
  // Home, letting go of its side tasks (VB-136).
  function goHome(st, a) {
    const to = bed(st, a),
      [x, y] = spotAt(st, a, to);
    dropSides(st, a);
    walkTo(st, a, to, x, y);
    a.phase = 'home';
  }
  function ended(st, a) {
    const j = a.job,
      K = KINDS[j.kind];
    const hhW = K.carted || K.stack ? st.households[st.pawns[a.id].household] : null;
    if (K.stack) {
      // firewood (sim/carts): a trip's cutting is a back load; with a cart that has room for one more, the cutter stays and cuts
      // it, while the pile is short and the working day has the hours; with no cart free and the pile still short, a miss
      a.load = (a.load || 0) + TRAVEL.load;
      const c = cal(st.t);
      if (K.stack(st, j, hhW, c, a.load) && c.hour + K.hours <= WORK[1]) {
        const cap = Carts.holds(st, hhW, a.id) || Carts.take(st, hhW, a.id, teamFree(st, hhW));
        if (cap >= a.load + TRAVEL.load) {
          j.done = 0;
          rerate(st, j);
          return;
        }
        if (cap === TRAVEL.load) Carts.missed(st, hhW);
      }
      if (a.load <= TRAVEL.load) {
        Carts.leave(st, hhW, a.id);
        retune(st, hhW);
      }
    }
    // a load taken from the field (VB-335), on the household's best free cart or on the back (sim/carts); a load on the back
    // with more left waiting is a miss the head counts
    const hhL = K.load ? st.households[st.pawns[a.id].household] : null,
      cap = K.load ? Carts.take(st, hhL, a.id, teamFree(st, hhL)) : 0;
    const n = K.load ? K.load(st, a, j, cap) : null;
    if (K.load && cap === TRAVEL.load && n > 0 && K.again(j)) Carts.missed(st, hhL);
    if (K.load && n <= TRAVEL.load) {
      Carts.leave(st, hhL, a.id); // a load for the back needs no cart
      retune(st, hhL);
    }
    if (K.carry && n !== 0) {
      if (n !== null && K.again(j)) {
        j.done = 0;
        if (K.reload) j.hours = K.reload;
      } // the others go on loading
      else freeHands(st, j, a.id);
      a.carry = K.carry;
      a.phase = 'back';
      rerate(st, j); // the hand is off the work, and the hours may begin anew
      const f = st.farmsteads[workFor(st, a, j).farmstead],
        to = K.to === 'site' || j.common ? j.dest : f.house; // a common field's sheaves go to the green (VB-100)
      // sheaves go to the barn door, firewood to the woodpile, water into the cottage, timber to its building site (VB-328)
      const hx = st.w.hx[to],
        hy = st.w.hy[to];
      const [x, y] =
        K.to === 'door'
          ? homeSpot(st, a)
          : K.to === 'woodpile' || K.to === 'site'
            ? [hx + 7, hy + 16]
            : [hx - 3, hy - 9];
      walkTo(st, a, to, x, y);
    } else {
      complete(st, a);
      // a completion that moved its pawn (a farm restored: it founds a household there) released it and set it out, or home: its new
      // walk or journey is its own, and is left be
      if (a.job !== j) return;
      if (K.carted) {
        Carts.home(st, st.households[st.pawns[a.id].household], a.id); // the dung cart is back, and wears
        retune(st, st.households[st.pawns[a.id].household]);
      }
      a.job = null;
      a.basis = null;
      a.phase = null;
      a.inside = false;
      if (K.inside) a.anim = 'idle';
      waitLeg(st, a); // it looks for work at once
    }
  }
  // The pawn stops where it is: a walk in hand is cut there, and, with nothing in hand, it waits.
  function standStill(st, a) {
    if (a.path) halt(st, a);
    if (a.phase === null) waitLeg(st, a);
  }
  // Walk leg l is due: the pawn arrives (every tile of the rest of the way trodden), or, on a journey, stops for the night where it has come
  // to and rests there until 6:00.
  function walkEnd(st, a, l) {
    if (walked(st, a, l)) {
      arrived(st, a);
      return;
    }
    a.phase = 'road';
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
      if (a.leg || a.path || a.phase !== null) continue;
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
      else if (a.phase === 'road')
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
    for (const a of all) if (!a.leg && !a.path && a.phase === null && st.pawns[a.id].alive) waitLeg(st, a);
  }
  // A loaded run: a save is made between steps, so the step now has been worked and walked. A save made before VB-472 stepped its workers
  // (agent.work, the rows; job.cast, VB-471): its tasks under work are reckoned from now. One made before VB-473 has no legs (an awake list,
  // journeys with a due time): each pawn's leg is built from where it is and what it does.
  function loaded(st) {
    st.stepAt = { moving: st.tick, walked: st.tick };
    for (const a of st.agents) if ('work' in a) delete a.work;
    for (const stay of st.away || []) delete stay.due; // lint-allow: owner a stay of sim/away in a save made before VB-473 loses its due
    legsOf(st);
    for (const j of st.jobs.values()) {
      delete j.cast;
      if ((j.at === undefined || j.at === null) && j.claims.length) rerate(st, j, false);
      // a background task minded in a save made before VB-473 had its due but was not queued: its end is queued now
      else if (j.rate > 0 && attentionOf(j) === 'background' && !(st.workDue || []).includes(j)) rerate(st, j, false);
    }
  }
  // ---- away from home (VB-783; design.md, Sleeping away from home): the stays are sim/away's (st.away, agent.away); what is left here is
  // the walking of a journey's legs (the bed, which every walk home reads, is sim/pose's). sim/away loads after this module, and hears
  // by sim/events of a leg's end, a rest's end on the road, a death, a move made once a load is in, and an arrival at the bed of one
  // away ----
  // A journey's pawn rests on the road where it stands until its next leg, at the next 6:00.
  function restOnRoad(st, a) {
    if (a.path) halt(st, a);
    a.phase = 'road';
    a.anim = 'idle';
    roadWait(st, a);
  }
  // A journey's leg to tile `to`: the route is found at the first (a journey costs one search), and walked on from where the pawn stopped
  // at the others. Its walk stops for the night at the last step before WORK[1] (begin), and its rest on the road ends at 6:00.
  function walkLeg(st, a, to) {
    a.phase = 'journey';
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
    if (a.phase === 'journey') {
      const [x, y] = spotAt(st, a, to);
      walkTo(st, a, to, x, y);
    } else halt(st, a); // resting on the road: its route is dropped
  }
  // Pawn a lets go of what it has in hand (its task, its side tasks, a load of its own field) before it sets out.
  function setDown(st, a) {
    release(st, a);
    dropSides(st, a);
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
    a.phase = null;
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
      const K = KINDS[a.job.kind];
      if (a.phase === 'go') return K.go;
      if (a.phase === 'back') return K.back;
      return withOxen(st, a) ? 'Ploughing with the oxen' : K.verb;
    }
    const bg = heldAt(a, 'background');
    if (bg) return a.path ? KINDS[bg.kind].go : KINDS[bg.kind].verb; // VB-136: with the herds
    const s = a.away === undefined || travelling(a) ? null : stayOf(st, id); // a stay at a bed (VB-783)
    if (a.phase === 'home') return s && !s.back ? 'Walking to where it sleeps away' : 'Walking home';
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
          : a.phase === 'journey'
            ? `On the road to visit ${name}`
            : `Resting on the road to ${name}`;
      }
      const f = st.farmsteads[st.households[st.pawns[a.id].household].farmstead];
      return a.phase === 'journey' ? `On the road to ${f.name}` : `Resting on the road to ${f.name}`;
    }
    if (a.inside) return s ? 'Away from home' : 'At home';
    return a.path ? 'Strolling' : 'Resting';
  }
  // A background task held out of reach, with no task in hand (sim/attention hold): the pawn sets out for it.
  on('sideAway', (st, a) => {
    const j = a.side.background,
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
              ? sideWhy(st, st.agents[c.actor], st.jobs.get(c.target))
              : null),
    run: (st, c) => {
      const a = st.agents[c.actor],
        j = st.jobs.get(c.target),
        slot = attentionOf(j);
      if (slot !== 'full')
        hold(st, a, j); // a partial or background task is held beside the pawn's task (VB-251)
      else {
        release(st, a);
        start(st, a, j);
        a.basis = eligible(st, j, st.pawns[a.id]);
        if (a.side) reachAfter(st, a);
      }
      return { slot, key: j.key, n: a.assigned[slot] };
    },
    active: (st, c, ref) => {
      const a = st.agents[c.actor];
      if (ref) return holds(a, ref);
      return ['full', 'partial', 'background'].some((slot) => {
        const j = inSlot(a, slot);
        return !!j && j.key === c.target;
      });
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
  // goHome: walk home and go in (phase 'home')
  register('goHome', {
    check: (st, c) =>
      free(st, c.actor) || (st.pawns[c.actor].household === null ? `pawn ${c.actor} has no home` : null),
    run: (st, c) => {
      goHome(st, st.agents[c.actor]);
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
    deposit,
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
