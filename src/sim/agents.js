// @sys sim/agents: pawn movement and work: routes, walking, talks, home placement, journeys between villages, death and jobs; each pawn
// in one leg (a walk, work or a wait) whose end waits in a due-queue, and the step that takes what is due
VB['sim/agents'] = (() => {
  const { next: rnd } = VB['sim/rng'];
  const { cal, DAY, TICKS, WORK, SPEED, HUNGER, HEALTH, HERD, TRAVEL, workRate } = VB['sim/rules'];
  const HANDS = [14, 60]; // the ages of a working hand, as sim/drying's hands (VB-255's count of work)
  const { route, stepCost, tileCost, hoursBetween } = VB['sim/routes'];
  const { tread } = VB['sim/paths'];
  const { age, personEvent } = VB['sim/records'];
  const Stores = VB['sim/stores'];
  const { ate, rationOf } = VB['sim/hunger'];
  const { receive, booked } = VB['sim/exchange'];
  const { hexSteps } = VB['sim/hex'];
  const { eligible } = VB['sim/eligibility'];
  const { hasTeam } = VB['sim/herds'];
  const Carts = VB['sim/carts'];
  const { driveHome, driven } = VB['sim/grazing'];
  const { workedTogether } = VB['sim/relations'];
  const { emit } = VB['sim/events'];
  const { finishStep } = VB['sim/expansion'];
  const { worked: prospected } = VB['sim/prospect'];
  const { KINDS } = VB['sim/kinds'],
    Progress = VB['sim/progress'],
    { workTick } = Progress;
  const Lying = VB['sim/lying'];
  function homeSpot(st, a) {
    const f = st.farmsteads[st.households[st.pawns[a.id].household].farmstead];
    return [st.w.hx[f.house] - 12 + a.ox * 0.3, st.w.hy[f.house] + 14 + a.oy * 0.15]; // by the cottage door
  }
  // the spot by the door of the house on tile `house`, where pawn a would stand
  const spotAt = (st, a, house) => [st.w.hx[house] - 12 + a.ox * 0.3, st.w.hy[house] + 14 + a.oy * 0.15];
  function placeAtHome(st, a) {
    unleg(st, a);
    const [x, y] = homeSpot(st, a);
    a.x = x;
    a.y = y;
    a.inside = true;
    a.path = null;
    a.phase = null;
    a.job = null;
    a.anim = 'idle';
    a.carry = null;
  }
  // Dawn repositions an indoor pawn without clearing its movement or work state; one indoors at another house (moved at night, or waiting
  // there for its journey's first leg; VB-287) stays where it is, and walks when its day starts.
  function placeByDoor(st, a) {
    const [x, y] = homeSpot(st, a);
    if (travelling(a) || Math.hypot(a.x - x, a.y - y) > st.w.R) return;
    a.x = x;
    a.y = y;
  }
  // The pawn looks for nothing to do until game time `until`: a free pawn's wait is told again; one walking waits from its arrival.
  function idle(st, a, until) {
    a.idleUntil = until;
    if (!a.path && a.phase === null) waitLeg(st, a);
  }
  // A talk stops only an idle pawn outdoors, not one on its way to an occasion (VB-126), and never shortens an existing pause: its walk is
  // cut where it has come to, and it waits.
  function haltForTalk(st, g, until) {
    if (!g.inside && !g.job && g.phase === null && g.occasion === null) {
      if (g.path) halt(st, g);
      g.anim = 'idle';
      g.idleUntil = Math.max(g.idleUntil, until);
      waitLeg(st, g);
    }
  }
  function stillAtDeath(st, a) {
    delete a.moving;
    dropJourney(st, a.id); // a pawn who dies on the road dies there (VB-287); a gift still to fetch stays where it lies
    release(st, a);
    dropSides(st, a);
    if (a.path) halt(st, a); // where its walk had come to
    a.path = null;
    a.inside = true;
    unleg(st, a);
    const p = st.pawns[a.id];
    if (p.household !== null) driveHome(st, st.households[p.household], a.id); // its herds are left by the farm
  }
  function tileAt(st, x, y) {
    const w = st.w,
      R = w.R,
      HW = w.HW,
      AP = w.AP;
    const px = x - AP,
      py = y - R,
      qf = ((Math.sqrt(3) / 3) * px - py / 3) / R,
      rf = ((2 / 3) * py) / R,
      sf = -qf - rf;
    let q = Math.round(qf),
      r = Math.round(rf),
      s = Math.round(sf);
    const dq = Math.abs(q - qf),
      dr = Math.abs(r - rf),
      ds = Math.abs(s - sf);
    if (dq > dr && dq > ds) q = -r - s;
    else if (dr > ds) r = -q - s;
    const col = q + ((r - (r & 1)) >> 1);
    return r >= 0 && r < w.ROWS && col >= 0 && col < w.COLS ? r * w.COLS + col : -1;
  }
  // The tile the pawn is on now (placeOf: a walker along its leg).
  const here = (st, a) => {
    const [x, y] = placeOf(st, a);
    return tileAt(st, x, y);
  };
  // The way to (x, y) in `tile`: each point [x, y, cost, tile] carries the cost of the step that ends there, so a pawn walks slower over
  // rough ground, and the tile it enters there (-1 when it stays in the tile), whose wear the step adds to (sim/paths).
  // `near` (an idle stroll, VB-468): to a neighbouring tile it walks straight over, with no route search.
  // A walk in hand is cut first, where it has come to; the new one is a leg from there (begin).
  function walkTo(st, a, tile, x, y, near) {
    if (a.path) halt(st, a, false, true);
    const w = st.w,
      from = tileAt(st, a.x, a.y),
      k = near && from >= 0 ? w.nb.indexOf(tile, from * 6) : -1,
      step = k >= from * 6 && k < from * 6 + 6,
      p = step ? [from, tile] : from >= 0 && from !== tile ? route(st, from, tile) : null;
    const ok = p && p[0] === from,
      tiles = ok ? p.slice(1, -1) : [],
      cost = (i) => (i >= 0 && tileCost(w, i) < Infinity ? tileCost(w, i) : 1);
    a.path = [[a.x, a.y]];
    for (let s = 0; s < tiles.length; s++) {
      const t = tiles[s];
      a.path.push([w.hx[t] + a.ox * 0.4, w.hy[t] + a.oy * 0.4, stepCost(w, p[s], t), t]);
    }
    a.path.push([x, y, ok ? stepCost(w, p[p.length - 2], tile) : cost(tile), ok ? tile : -1]);
    a.seg = 0;
    a.inside = false;
    a.anim = 'walk';
    begin(st, a);
  }
  // Where on the site a pawn stands to do the job: as its kind says, else the middle of the tile.
  const workSpot = (st, a, j) =>
    KINDS[j.kind].spot ? KINDS[j.kind].spot(st, a, j) : [st.w.hx[j.site], st.w.hy[j.site]];
  // The pawn joins the job's workers (j.claims) and sets out for it.
  function start(st, a, j) {
    settle(st, j);
    j.claims.push(a.id);
    a.job = j;
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
    walkTo(st, a, j.site, x, y);
  }
  // st.jobs by key, and st.jobsBy by owner ('household:3', 'village:1'); every job leaves both together.
  const ownerKey = (o) => `${o.type}:${o.id}`;
  function dropJob(st, j) {
    // those holding it at the side let it go at once (VB-473: a herder's task taken down)
    for (const id of [...(j.claims || [])]) {
      const b = st.agents[id];
      if (b && b.side && (b.side.partial === j || b.side.background === j)) unhold(st, b, j);
    }
    unqueue(st, j);
    j.due = null;
    if (st.jobs.get(j.key) === j) st.jobs.delete(j.key);
    const s = j.owner && st.jobsBy.get(ownerKey(j.owner));
    if (s) s.delete(j);
    if (teamKind(j) && st.households[j.owner.id]) retune(st, st.households[j.owner.id]); // the ox team goes to the next task
  }
  // The pawn leaves its job, which keeps its progress for whoever takes it up.
  function release(st, a) {
    // A load on its way home is not brought in from the road: a hand that can walk on is not released until it has (VB-581: `moved`
    // waits for the delivery, and the planner, the occasions, the orders and the working day's end find it on its way home and leave it).
    // One released here puts the load down where it stands: in its own field or meadow it goes back with the stooks or the mown hay;
    // elsewhere (its death on the road, its household dissolving) it lies there for the task's owner to fetch (VB-611, sim/lying). A task
    // that has no more loads to give is done with.
    let laid = null;
    if (a.load > 0 && a.phase === 'back' && a.job) {
      const K = KINDS[a.job.kind],
        [x, y] = placeOf(st, a),
        at = tileAt(st, x, y);
      if (K.setDown && at === a.job.site) K.setDown(st, a.job, a);
      else Lying.lay(st, a, a.job, K.fetch || a.job.kind, at, x, y);
      a.carry = null;
      laid = a.job;
    }
    const left = a.job;
    if (left) settle(st, left);
    if (left) {
      const c = left.claims,
        i = c.indexOf(a.id);
      if (i >= 0) c.splice(i, 1);
      a.job = null;
    }
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
  // ---- attention (VB-251; design.md section 7): a pawn holds one task (a.job), and besides it one partial and one background task ----
  // @state agent.side: absent, or {partial, background}: the jobs the pawn holds besides its task, each a job of st.jobs listing the pawn
  //   among its workers (j.claims), or null; absent when it holds none. A kind's attention is `full` (the default), `partial` or `background`
  //   (sim/kinds): a background task is done at the side at the kind's `rate` of the pawn's hours, while the pawn is within `reach` steps of it.
  const attentionOf = (j) => KINDS[j.kind].attention || 'full';
  const heldAt = (a, slot) => (a.side ? a.side[slot] : null);
  // The held task a is within reach of from tile `at`, or beyond it (a background task only).
  const inReach = (st, j, at) => at >= 0 && hexSteps(st.w, at, j.site) <= KINDS[j.kind].reach;
  // Why the pawn may not hold side task j now, or null: its slot is taken, it is no side kind, or a background task out of reach of the
  // pawn, or of its full task's site (a full task never takes a background one out of reach). A pawn with no task in hand may take a
  // background task out of its reach: it sets out for it (VB-136: the herder takes the herds to their pasture).
  function sideWhy(st, a, j) {
    const att = attentionOf(j);
    if (att === 'full') return `${j.key} is not a side task`;
    if (heldAt(a, att)) return `the pawn already holds a ${att} task`;
    if (att === 'background' && a.job && !(inReach(st, j, here(st, a)) && inReach(st, j, a.job.site)))
      return `${j.key} is out of its reach`;
    return null;
  }
  // The pawn takes up side task j; a background task out of its reach, with no task in hand, it sets out for. The kind's `held` says what
  // taking it up does (VB-136: the herds go out with the herder).
  function hold(st, a, j) {
    settle(st, j);
    if (!a.side) a.side = { partial: null, background: null };
    a.side[attentionOf(j)] = j;
    j.claims.push(a.id);
    if (attentionOf(j) === 'background' && !a.job && !inReach(st, j, here(st, a))) {
      const [x, y] = workSpot(st, a, j);
      walkTo(st, a, j.site, x, y);
    }
    if (KINDS[j.kind].held) KINDS[j.kind].held(st, j, a, cal(st.t));
    rerate(st, j);
  }
  // The pawn lets go of side task j, which stays posted, with its progress, for others; reckoned at tick t.
  function unhold(st, a, j, t = workTick(st)) {
    settle(st, j, t);
    const i = j.claims.indexOf(a.id);
    if (i >= 0) j.claims.splice(i, 1);
    for (const slot of ['partial', 'background']) if (a.side[slot] === j) a.side[slot] = null;
    if (!a.side.partial && !a.side.background) delete a.side;
    rerate(st, j);
  }
  // A walk in hand is trodden up to here first, at the weight of the herds it drives, and goes on from there (treadTo reads the side tasks).
  function dropSides(st, a) {
    if (a.side && a.path && a.leg && a.leg.kind === 'walk') {
      halt(st, a, true, true);
      begin(st, a);
    }
    if (a.side) for (const slot of ['partial', 'background']) if (a.side && a.side[slot]) unhold(st, a, a.side[slot]);
  }
  // The matcher offers a pawn that holds a background task only tasks within its reach (a full one beyond it never, until the urgency
  // switch; VB-136: the herder may take other work within reach of the pasture); null when job j may be bid for, else why not.
  function offerWhy(st, a, j) {
    const att = attentionOf(j),
      bg = heldAt(a, 'background');
    if (att !== 'full') return sideWhy(st, a, j);
    if (bg && !inReach(st, bg, j.site)) return `${j.key} would take the background task ${bg.key} out of reach`;
    return null;
  }
  // The pawn takes a full task by the urgency switch (or an order): a background task the new site takes out of reach is let go.
  function reachAfter(st, a) {
    const bg = heldAt(a, 'background');
    if (bg && a.job && !inReach(st, bg, a.job.site)) unhold(st, a, bg);
  }
  // A background task (VB-136) is reckoned in closed form, as a task under work is (VB-472): its holders minding it give its rate (a
  // child minds the herd as long as a man: hours, not work), and its end waits in st.workDue (sideEnded). What its holder does is looked
  // at when the holder's leg begins and ends (sideCheck, VB-473): a walk that ends out of its reach lets it go, one into reach keeps it,
  // unworked, and a holder standing at other work out of its reach lets it go. A task taken down is let go at once (dropJob), and at the
  // end of the working day every holder lets go (sim/clock). Its work done, a pawn with nothing else in hand goes home (VB-136: the
  // herder brings the herds home).
  const endTile = (st, a) => {
    const p = a.path[a.path.length - 1];
    return tileAt(st, p[0], p[1]);
  };
  // The holder's leg has begun or ended (its background task reckoned before it changed): out of reach the task is let go, else its rate
  // is told again if its minding changed.
  function sideCheck(st, a) {
    const j = heldAt(a, 'background');
    if (!j) return;
    const walking = a.path && a.leg && a.leg.kind === 'walk';
    if (walking ? !inReach(st, j, endTile(st, a)) : a.phase !== null && !inReach(st, j, tileAt(st, a.x, a.y)))
      return unhold(st, a, j);
    if (Math.abs(manning(st, j) - (j.rate || 0)) > 1e-12) {
      settle(st, j);
      rerate(st, j);
    }
  }
  // The background task j is due (dueWork): its first holder lets it go, its kind's `done` runs for that holder's household, and the task
  // is taken down (the others let it go there); that holder, if it stands idle outdoors, goes home.
  function sideEnded(st, j) {
    let a = null;
    for (const id of j.claims) if (heldAt(st.agents[id], 'background') === j && (!a || id < a.id)) a = st.agents[id];
    if (!a) {
      unqueue(st, j);
      j.rate = 0;
      j.due = null;
      return;
    }
    const K = KINDS[j.kind];
    if (j.done < hoursOfJob(j)) j.done = hoursOfJob(j); // the due step's work finishes it (rounding)
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
      if (a.moving) finishMove(st, a);
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
  // Those of `ids` who worked the household job j as helpers (sim/eligibility) are told to sim/relations (VB-106): help is a gift, so
  // nothing is owed and nothing moves.
  function helped(st, j, ids) {
    let hs = null;
    for (const id of ids) if (st.agents[id].basis === 'helper') (hs || (hs = [])).push(id);
    if (hs) emit(st, 'helped', { helpers: hs, household: j.owner.id, farm: j.farm || null });
  }
  // The work is done: those who finished it together know each other better (sim/relations); a plot's step is finished (sim/expansion),
  // any other job does what its kind says (sim/kinds), for the household it was done for.
  function complete(st, a) {
    const j = a.job,
      hh = workFor(st, a, j),
      K = KINDS[j.kind];
    if (j.claims.length > 1) workedTogether(st, j.claims);
    helped(st, j, j.claims);
    freeHands(st, j, a.id);
    prospected(st, a.id, here(st, a), j.hours ?? K.hours ?? 0); // a hidden vein near the work may be come on (sim/prospect)
    if (j.plot) {
      finishStep(st, j);
      dropJob(st, j);
      return;
    }
    if (K.done) K.done(st, j, hh, cal(st.t));
    dropJob(st, j);
  }
  // Home with the load: the kind says what it brings.
  function deposit(st, a) {
    const j = a.job,
      K = KINDS[j.kind];
    const hh = workFor(st, a, j);
    helped(st, j, [a.id]); // a load brought in is a task done
    if (K.deliver) K.deliver(st, j, hh, st.farmsteads[hh.farmstead], a);
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
      a.leg = { kind: 'work', t: st.tick, x: a.x, y: a.y, seg: 0 }; // the work leg (the page walks a field's rows from it)
      rerate(st, a.job);
    } else if (a.phase === 'back') {
      deposit(st, a);
      if (a.moving) finishMove(st, a); // the move it was told of while on the road (VB-581)
    } else if (a.phase === 'home') {
      a.inside = true;
      a.phase = null;
      driveHome(st, st.households[st.pawns[a.id].household], a.id); // the herds it brought home are by the farm (VB-136)
    } else if (a.phase === 'journey') endJourney(st, a);
    if (!a.leg && !a.path && a.phase === null && st.pawns[a.id].alive) waitLeg(st, a, st.tick + 1);
    sideCheck(st, a);
  }
  // Home, letting go of its side tasks (VB-136).
  function goHome(st, a) {
    const f = st.farmsteads[st.households[st.pawns[a.id].household].farmstead],
      [x, y] = homeSpot(st, a);
    dropSides(st, a);
    walkTo(st, a, f.house, x, y);
    a.phase = 'home';
  }
  // Work hours a pawn does in an hour: by role and age (children), slowed by hunger and poor health.
  const rateOf = (st, p) =>
    workRate(p.role, age(st, p)) * (1 - HUNGER.slow * p.hunger) * (1 - (HEALTH.slow * (100 - p.health)) / 100);
  // The pawn drives the household's oxen (VB-138): it is the first hand on the household's earliest hoeing or breaking job that has hands,
  // and the household has a team. Derived each time, so the team is never in two fields.
  function withOxen(st, a) {
    const j = a.job;
    if (
      !j ||
      a.phase !== 'work' ||
      j.claims[0] !== a.id ||
      j.owner.type !== 'household' ||
      !HERD.team.kinds.includes(j.kind)
    )
      return false;
    let first = null;
    for (const q of st.jobsBy.get(ownerKey(j.owner)) || [])
      if (HERD.team.kinds.includes(q.kind) && q.claims.length && (!first || q.id < first.id)) first = q;
    return first === j && hasTeam(st, st.households[j.owner.id]);
  }
  // The household's team may draw the ox cart: it has a team, at no plough and with no other cart on the road (VB-335; sim/carts).
  function teamFree(st, hh) {
    if (!hasTeam(st, hh) || Carts.oxOut(st, hh)) return false;
    for (const id of hh.members) if (withOxen(st, st.agents[id])) return false;
    return true;
  }
  // ---- work as a block (VB-472; design.md section 7, A leg, and its end; docs/review-blocks.md, step 2): a worker is not stepped ----
  // @state job.done, job.at, job.rate: the task's hours done when it was last reckoned, the tick it was reckoned at, and the hours of work
  //   its hands at work (or a background task's holders minding it) do together in a game hour since; its progress now is
  //   done + rate × the hours since (doneOf; sim/progress holds its closed form, read by every other module). Reckoned, and its end queued again, when a
  //   hand joins or leaves, when a hand's rate may have changed (after the meal; an ox team gone to another task), at the end of work, at
  //   its end, and at a cut. `done` is exact while no hand is at work, and below the task's hours otherwise. at and rate are absent until the
  //   task is first reckoned. Written only here; plain data, saved.
  // @state job.due: the tick at whose step the task's work is done, as last reckoned, or null with no hands at work (absent until reckoned).
  // @state st.workDue: the tasks under work (full attention with a hand at work, or background with a holder minding it; rate > 0), each
  //   once, sorted by due, then id: a due-queue (Rules for cost 4), bounded by the tasks under work; plain data, saved; absent until the
  //   first. A step takes what is due (dueWork) and nothing else.
  // A step's work is done as the step's legs begin to be taken (stepAgents, dueWork): the tick up to which the hands have worked, so a hand
  // leaving at the calendar's hour (before the legs) does not work that step, and one joining in or after them works from the next. Between
  // steps (a fresh or a loaded run, st.stepAt absent or both its marks at the tick) the step now has been worked.
  const hoursOfJob = (j) => j.hours ?? KINDS[j.kind].hours;
  const atWork = (st, j, id) => {
    const b = st.agents[id];
    return b.job === j && b.phase === 'work';
  };
  // A holder minds its background task while it stands free (where it last stood was in reach), stands at other work within reach, or
  // walks a leg that begins and ends within reach; one walking into reach keeps it, unworked (sideCheck lets go one walking out of reach).
  // Constant over a leg, so the task's rate is told again only as its holders' legs begin and end.
  function minding(st, b, j) {
    if (!b.side || b.side.background !== j) return false;
    const l = b.leg;
    if (b.path && l && l.kind === 'walk') return inReach(st, j, tileAt(st, l.x, l.y)) && inReach(st, j, endTile(st, b));
    return b.phase === null || inReach(st, j, tileAt(st, b.x, b.y));
  }
  // The hours of work j's hands do together in a game hour now: rateOf, the ox team and the cart's part in carting (a hand at carting
  // takes a free cart as it is reckoned, as it did each step); a background task's kind rate for each holder minding it. `take` false
  // reads only.
  function manning(st, j, take = false) {
    const K = KINDS[j.kind];
    let rate = 0;
    if (attentionOf(j) !== 'full') {
      if (attentionOf(j) === 'background')
        for (const id of j.claims || []) if (minding(st, st.agents[id], j)) rate += K.rate;
      return rate;
    }
    for (const id of j.claims || []) {
      if (!atWork(st, j, id)) continue;
      const a = st.agents[id],
        hh = K.carted ? st.households[st.pawns[id].household] : null;
      rate +=
        rateOf(st, st.pawns[id]) *
        (withOxen(st, a) ? HERD.team.rate : 1) *
        (hh ? (take ? Carts.carting : Carts.cartingRate)(st, hh, id, teamFree(st, hh)) : 1);
    }
    return rate;
  }
  // The task's progress brought up to tick t (the hands' work so far, at the rate last reckoned), with its kind's `worked` for each hand
  // at work (a background task's once) over the hours since, and a plot's hours by pawn. Before its hands change.
  function settle(st, j, t = workTick(st)) {
    if (j.at === undefined || j.at === null) {
      j.at = t;
      j.rate = 0;
      return;
    }
    if (!(t > j.at)) return;
    const dt = (t - j.at) / TICKS,
      from = j.done;
    j.at = t;
    if (!(j.rate > 0)) return;
    VB.count.workReckon++;
    const K = KINDS[j.kind];
    j.done = from + dt * j.rate;
    if (attentionOf(j) !== 'full') {
      if (K.worked) K.worked(st, j, dt, null, from);
      return;
    }
    for (const id of j.claims) {
      if (!atWork(st, j, id)) continue;
      if (K.worked) K.worked(st, j, dt, st.agents[id], from);
      if (j.plot) j.plot.hours[id] = (j.plot.hours[id] || 0) + dt;
      countWork(st, id, dt, t);
    }
  }
  // @state household.workHours (VB-255): [season (year * 4 + season of cal, of the hours counted), hours, last]: the hours its working hands
  //   (Traits' hands: 14 to 59, not retired) worked at full attention on any task this season, and `last` those of the season before (0
  //   when that season was not the one before); absent until its first hour of work. Counted as a task's work is reckoned (settle), so it
  //   costs an addition a hand; read by sim/aims (idleShare) at a head's review. Written only here.
  function countWork(st, id, dt, t) {
    const p = st.pawns[id],
      hh = p.household === null ? null : st.households[p.household];
    if (!hh || p.retired || p.age < HANDS[0] || p.age >= HANDS[1]) return;
    const c = cal(t / TICKS),
      key = c.year * 4 + c.season,
      W = hh.workHours;
    if (!W) hh.workHours = [key, dt, 0];
    else if (W[0] === key) W[1] += dt;
    else {
      W[2] = W[0] === key - 1 ? W[1] : 0;
      W[0] = key;
      W[1] = dt;
    }
  }
  const teamKind = (j) => j.owner && j.owner.type === 'household' && HERD.team.kinds.includes(j.kind);
  // The rate after the hands changed (settle first), and the end queued again; the household's other tasks under the ox team are
  // reckoned again too, as the team goes to its earliest task with hands (withOxen).
  function rerate(st, j, others = true) {
    if (j.at === undefined || j.at === null) settle(st, j);
    j.rate = manning(st, j, true);
    queue(st, j);
    if (!others || !teamKind(j)) return;
    for (const q of st.jobsBy.get(ownerKey(j.owner)) || [])
      if (q !== j && q.rate > 0 && teamKind(q)) {
        settle(st, q);
        rerate(st, q, false);
      }
  }
  // The ox team or a cart of household hh is free again (a team task dropped, a cart home or left): its tasks under work that the team or
  // a cart speeds are reckoned again, so the next takes them up at once, as the stepping did at its next step.
  function retune(st, hh) {
    if (!hh || hh.dissolved) return;
    for (const q of [...(st.jobsBy.get(`household:${hh.id}`) || [])])
      if (q.rate > 0 && (teamKind(q) || KINDS[q.kind].carted)) {
        settle(st, q);
        rerate(st, q, false);
      }
  }
  // Where job j stands in the sorted queue q (by due, then id), or where it would go.
  function slotOf(q, due, id) {
    let lo = 0,
      hi = q.length;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (q[m].due < due || (q[m].due === due && q[m].id < id)) lo = m + 1;
      else hi = m;
    }
    return lo;
  }
  function unqueue(st, j) {
    const q = st.workDue;
    if (!q || j.due === null || j.due === undefined) return;
    const i = slotOf(q, j.due, j.id);
    if (q[i] === j) q.splice(i, 1);
  }
  // The task's end from its progress and rate: the step whose work finishes it (whole steps: the clock stands), into the queue.
  function queue(st, j) {
    unqueue(st, j);
    if (!(j.rate > 0)) {
      j.due = null;
      return;
    }
    const left = hoursOfJob(j) - j.done;
    j.due = j.at + Math.max(1, Math.ceil((left / j.rate) * TICKS - 1e-7));
    const q = st.workDue || (st.workDue = []);
    q.splice(slotOf(q, j.due, j.id), 0, j);
  }
  // Every task under work reckoned now (the end of work, after the meal: a hand's rate may have changed).
  function reckonAll(st) {
    for (const j of [...(st.workDue || [])]) {
      settle(st, j);
      rerate(st, j, false);
    }
  }
  // The job's hours done now, worked out from its last reckoning with no stepping.
  const doneOf = (st, j) => Progress.doneOf(st, j, hoursOfJob(j));
  // The tasks whose end is due at this step (stepAgents, as its legs begin to be taken): each is reckoned and ended by its first hand at
  // work, a background task by its first holder (sideEnded).
  function dueWork(st) {
    const q = st.workDue;
    while (q && q.length && q[0].due <= st.tick) {
      const j = q[0];
      settle(st, j);
      if (attentionOf(j) === 'background') {
        sideEnded(st, j);
        if (q[0] === j && j.due <= st.tick) unqueue(st, j); // a guard: an end never waits on itself
        continue;
      }
      const id = j.claims.find((x) => atWork(st, j, x));
      if (id === undefined) {
        q.shift();
        j.rate = 0;
        j.due = null;
        continue;
      }
      if (j.done < hoursOfJob(j)) j.done = hoursOfJob(j); // the due step's work finishes it (rounding)
      ended(st, st.agents[id]);
      if (q[0] === j && j.due <= st.tick) unqueue(st, j); // a guard: an end never waits on itself
    }
  }
  // The work of a's task is done (dueWork): its load is taken home, it cuts another, or the task is complete.
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
  // ---- legs (VB-471, VB-473; design.md section 7, A leg, and its end; docs/review-blocks.md, step 3): a pawn is touched when its leg is due ----
  // @state agent.leg: the leg the pawn is in, or null (none: free, waiting for the working day's start; or dead):
  //   a walk {kind 'walk', t, x, y, seg, pace, h, end, due, s}: a.path walked from point seg, begun at place (x, y) after the step of tick t
  //     (it moves from step t + 1), at `pace` (map units of meadow a game hour); h[k] the hours from its start to path point seg + 1 + k;
  //     `end` the step it arrives at, `due` the step it ends at (its end, or a journey's stop for the night); s the stride at its start (the page's);
  //   a wait {kind 'wait', t, due}: a free pawn (or one resting on the road) whose pause ends at step `due`, in the working hours;
  //   work {kind 'work', t, x, y, seg 0}: the tick and place its work began (its end is its task's, in st.workDue; the page walks a
  //     field's rows from it).
  //   Written only here, at a leg's start and end; plain data, saved.
  // @state st.legDue: the ids of the pawns whose walk or wait is under way, each once, sorted by their leg's due, then id: one due-queue for
  //   walks, waits and the legs of journeys (Rules for cost 4), bounded by the living; plain data, saved; built from the pawns' state when
  //   absent (a fresh run, an older save). A step takes what is due (stepAgents) and nothing else.
  // @state st.stepAt: {moving, walked}, a cache owned here, not saved (non-enumerable): the tick whose legs have begun to be taken, and the
  //   tick whose legs have all been taken. Between steps both are the tick (a loaded run).
  // A walk begun before or while the step's legs are taken moves this step (its start is the step before); one begun after, from the next.
  const walkTick = (st) => (!st.stepAt || st.stepAt.walked === st.tick ? st.tick : st.tick - 1);
  // The first step a pawn freed now may look for work at: this one while its legs are being taken (or before), else the next.
  const pollTick = (st) => (!st.stepAt || st.stepAt.walked === st.tick ? st.tick + 1 : st.tick);
  // The first step at or after game time u (a pause ends when st.t reaches it).
  function tickOf(u) {
    let k = Math.ceil(u * TICKS);
    if ((k - 1) / TICKS >= u) k--;
    if (k / TICKS < u) k++;
    return k;
  }
  const working = (k) => {
    const h = Math.floor(k / TICKS) % DAY;
    return h >= WORK[0] && h < WORK[1];
  };
  // The pace of a walking pawn in map units of meadow a game hour.
  const paceOf = (st, a) => SPEED * st.w.HW * (a.carry ? Carts.pace(st, a) : 1);
  const dueAt = (st, id) => st.agents[id].leg.due;
  // Where pawn id stands in the queue q (by due, then id), or where it would go.
  function legSlot(st, q, due, id) {
    let lo = 0,
      hi = q.length;
    while (lo < hi) {
      const m = (lo + hi) >> 1,
        d = dueAt(st, q[m]);
      if (d < due || (d === due && q[m] < id)) lo = m + 1;
      else hi = m;
    }
    return lo;
  }
  // The queue, built from the pawns' state the first time it is needed (a fresh run, an older save).
  function legsOf(st) {
    if (!st.legDue) {
      st.legDue = [];
      for (const p of st.pawns) {
        const a = st.agents[p.id];
        if (!p.alive || !a) continue;
        const was = a.leg;
        a.leg = null;
        if (a.phase === 'road') roadWait(st, a);
        else if (a.path)
          begin(st, a); // from where it stands now
        else if (a.phase === 'work')
          a.leg = was && was.t !== undefined ? { kind: 'work', t: was.t, x: was.x, y: was.y, seg: 0 } : workLeg(st, a);
        else if (a.phase === null) waitLeg(st, a);
      }
    }
    return st.legDue;
  }
  const workLeg = (st, a) => ({ kind: 'work', t: st.tick, x: a.x, y: a.y, seg: 0 });
  function enqueue(st, a) {
    const q = st.legDue;
    if (!Number.isFinite(a.leg.due)) throw new Error(`pawn ${a.id}'s ${a.leg.kind} leg is due at no step`); // a NaN jams the queue (VB-255)
    q.splice(legSlot(st, q, a.leg.due, a.id), 0, a.id);
  }
  // The pawn's leg is over (or replaced): out of the queue.
  function unleg(st, a) {
    const l = a.leg,
      q = st.legDue;
    if (l && (l.kind === 'walk' || l.kind === 'wait') && q) {
      const i = legSlot(st, q, l.due, a.id);
      if (q[i] === a.id) q.splice(i, 1);
    }
    a.leg = null;
  }
  // A free pawn (no walk, no task in hand) waits: until its pause ends, and at least until step `from`; a wait that would end outside the
  // working hours is none, and the working day's start takes it (dayStart).
  function waitLeg(st, a, from = pollTick(st)) {
    legsOf(st);
    unleg(st, a);
    if (!st.pawns[a.id].alive) return;
    const due = Math.max(from, tickOf(a.idleUntil));
    if (working(due)) {
      a.leg = { kind: 'wait', t: st.tick, due };
      enqueue(st, a);
    }
    sideCheck(st, a);
  }
  // A pawn on a journey rests on the road until its next leg, at the next 6:00 (VB-287).
  function roadWait(st, a) {
    legsOf(st);
    unleg(st, a);
    a.leg = { kind: 'wait', t: st.tick, due: nextLeg(st.t) * TICKS };
    enqueue(st, a);
  }
  // The walk along a.path from where the pawn is (a.x, a.y, past point a.seg) is a leg: the hours to each point at its pace, its end the
  // step they reach (whole steps: the clock stands), cut short on a journey at the night's stop (the last step before WORK[1]).
  function begin(st, a) {
    legsOf(st);
    unleg(st, a);
    const P = a.path,
      pace = paceOf(st, a),
      h = [];
    let s = 0,
      x = a.x,
      y = a.y;
    for (let i = a.seg + 1; i < P.length; i++) {
      const p = P[i];
      s += (Math.hypot(p[0] - x, p[1] - y) * (p[2] === undefined ? 1 : p[2])) / pace;
      h.push(s);
      x = p[0];
      y = p[1];
    }
    const t = walkTick(st),
      end = t + Math.max(1, Math.ceil(s * TICKS - 1e-9));
    let due = end;
    if (a.phase === 'journey') {
      const day = Math.floor((t + 1) / (DAY * TICKS));
      due = Math.min(end, Math.max(t + 1, (day * DAY + WORK[1]) * TICKS - 1));
    }
    a.leg = { kind: 'walk', t, x: a.x, y: a.y, seg: a.seg, pace, h, end, due };
    if (st.pawns[a.id].alive) enqueue(st, a);
    sideCheck(st, a);
  }
  // How far walk leg l has come e hours after its start: [the last path point passed, x, y].
  function along(a, l, e) {
    const h = l.h,
      P = a.path;
    if (!(e > 0) || !h.length) return [l.seg, l.x, l.y];
    if (e >= h[h.length - 1]) {
      const p = P[P.length - 1];
      return [P.length - 1, p[0], p[1]];
    }
    let lo = 0,
      hi = h.length - 1; // the first point not yet reached: h[lo] > e (halving: Rules for cost)
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (h[m] <= e) lo = m + 1;
      else hi = m;
    }
    const i = l.seg + 1 + lo,
      h0 = lo > 0 ? h[lo - 1] : 0,
      p0 = lo > 0 ? P[i - 1] : [l.x, l.y],
      p1 = P[i],
      r = h[lo] > h0 ? (e - h0) / (h[lo] - h0) : 0;
    return [i - 1, p0[0] + (p1[0] - p0[0]) * r, p0[1] + (p1[1] - p0[1]) * r];
  }
  // The tiles entered from point `from` to point `to` are trodden; the herds a herder drives wear the way too (VB-136): only a herder out
  // with them, or bringing them home, can drive any.
  function treadTo(st, a, from, to) {
    for (let i = from + 1; i <= to; i++) {
      VB.count.walkPoint++;
      const t = a.path[i][3] ?? -1;
      if (t >= 0) tread(st.w, t, a.side || a.phase === 'home' ? 1 + HERD.herding.move * driven(st, a.id) : 1);
    }
  }
  // Where the pawn is now, worked out from its leg: for a walk, the hours since its start along its route; else where it stands (a pawn at
  // work stands at its task's spot: the rows of a field are the page's).
  function placeOf(st, a) {
    const l = a.leg;
    if (!a.path || !l || l.kind !== 'walk') return [a.x, a.y];
    VB.count.walkPlace++;
    const [, x, y] = along(a, l, (workTick(st) - l.t) / TICKS);
    return [x, y];
  }
  // The way the pawn faces and the stride it has come to, e hours into walk leg l, standing at point i, (x, y) (the page's pose).
  function poseAt(a, l, e, i, x, y) {
    const P = a.path,
      dx = i + 1 < P.length ? P[i + 1][0] - x : x - (i > l.seg ? P[i - 1][0] : l.x);
    return [x, y, Math.abs(dx) > 0.3 ? Math.sign(dx) : a.face, (a.stride || 0) + (e * l.pace) / 3.4];
  }
  // Walk leg l ends e hours in (its end, a cut, a journey's night): the tiles entered so far are trodden, and the pawn stands where its
  // hours reach, facing the way it went (a.x, a.y, a.seg, and the page's face and stride: written at a leg's start and end only).
  function stopAt(st, a, l, e) {
    const [i, x, y] = along(a, l, e);
    treadTo(st, a, l.seg, i);
    [a.x, a.y, a.face, a.stride] = poseAt(a, l, e, i, x, y);
    a.seg = i;
  }
  // A walk is cut where it has come to; `keep` keeps its route, to walk on from there (a pace changed); `quiet` leaves its side task to
  // the walk that follows.
  function halt(st, a, keep = false, quiet = false) {
    const l = a.leg;
    if (!l || l.kind !== 'walk') {
      if (!keep) a.path = null; // a route kept on the road, dropped
      return;
    }
    unleg(st, a);
    stopAt(st, a, l, Math.max(0, workTick(st) - l.t) / TICKS);
    if (!keep) a.path = null;
    if (!quiet) sideCheck(st, a);
  }
  // The pawn stops where it is: a walk in hand is cut there, and, with nothing in hand, it waits.
  function standStill(st, a) {
    if (a.path) halt(st, a);
    if (a.phase === null) waitLeg(st, a);
  }
  // A walk's pace changed (what it carries): it goes on from where it has come to, at the new pace.
  function repace(st, a) {
    if (!a.path || !a.leg || a.leg.kind !== 'walk' || paceOf(st, a) === a.leg.pace) return;
    halt(st, a, true, true);
    begin(st, a);
  }
  // Walk leg l is due: the pawn arrives (every tile of the rest of the way trodden), or, on a journey, stops for the night where it has come
  // to and rests there until 6:00.
  function walkEnd(st, a, l) {
    if (l.due >= l.end) {
      stopAt(st, a, l, l.h.length ? l.h[l.h.length - 1] : 0); // at its route's end
      a.path = null;
      arrived(st, a);
      return;
    }
    stopAt(st, a, l, (l.due - l.t) / TICKS);
    a.phase = 'road';
    a.anim = 'idle';
    roadWait(st, a);
  }
  // The hours a walk still takes from now.
  function walkHours(st, a) {
    const l = a.leg;
    if (!a.path || !l || l.kind !== 'walk' || !l.h.length) return 0;
    return Math.max(0, l.h[l.h.length - 1] - (workTick(st) - l.t) / TICKS);
  }
  // The page's view of a pawn at time `at` (a tick, fractional: the page draws between steps, VB-474; the step now if absent): [x, y,
  // face, stride], a walker's worked out from its leg, ahead of the simulation by less than a step and never past the leg's due; read only.
  function poseOf(st, a, at = workTick(st)) {
    const l = a.leg;
    if (!a.path || !l || l.kind !== 'walk') return [a.x, a.y, a.face, a.stride || 0];
    const e = Math.max(0, Math.min(at, l.due) - l.t) / TICKS,
      [i, x, y] = along(a, l, e);
    return poseAt(a, l, Math.min(e, l.h.length ? l.h[l.h.length - 1] : 0), i, x, y);
  }
  // ---- the step (VB-205, VB-473): the legs due end, and nothing else is touched ----
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
    if (!st.stepAt) Object.defineProperty(st, 'stepAt', { value: { moving: -1, walked: -1 }, writable: true });
    st.stepAt.moving = st.tick; // the step's work is done and its legs are being taken (workTick, walkTick)
    const q = legsOf(st),
      out = [],
      seen = new Set(),
      offer = (a) => {
        if (!seen.has(a.id)) {
          seen.add(a.id);
          out.push(a);
        }
      };
    dueWork(st);
    if (st.tick % (DAY * TICKS) === WORK[0] * TICKS) dayStart(st, c, offer);
    while (q.length && dueAt(st, q[0]) <= st.tick) {
      const a = st.agents[q.shift()],
        l = a.leg;
      a.leg = null;
      VB.count.walkStep++;
      if (l.kind === 'walk') walkEnd(st, a, l);
      else if (a.phase === 'road') leg(st, journeyOf(st, a.id));
      else if (wantsWork(st, a, c)) offer(a);
      else waitLeg(st, a, st.tick + 1);
    }
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
    if (!st.stepAt) Object.defineProperty(st, 'stepAt', { value: null, writable: true });
    st.stepAt = { moving: st.tick, walked: st.tick };
    for (const a of st.agents) if ('work' in a) delete a.work;
    for (const j of st.journeys || []) delete j.due;
    legsOf(st);
    for (const j of st.jobs.values()) {
      delete j.cast;
      if ((j.at === undefined || j.at === null) && j.claims.length) rerate(st, j, false);
      // a background task minded in a save made before VB-473 had its due but was not queued: its end is queued now
      else if (j.rate > 0 && attentionOf(j) === 'background' && !(st.workDue || []).includes(j)) rerate(st, j, false);
    }
  }
  // ---- journeys (VB-287; design.md, Between villages: A journey, Provisions and the season) ----
  // @state st.journeys[]: the open journeys, in the order they set out (by id), each {id, pawn, to (tile: the house of the pawn's
  //   household; a carrier's receiver's, a fetcher's stop), why ('move', 'carry' or 'fetch'), food (the rations it carries), from (the
  //   farm it left, or null), and a carrier's or fetcher's gift and back (VB-291, VB-461: fetchGift)}. Plain data, saved; a save
  //   without it loads with none. When its legs start and stop is its pawn's (st.legDue, VB-473): a walk that stops for the night, a wait
  //   on the road until 6:00.
  // @state st.journeySeq: number; the next journey's id; ids are never reused
  // A pawn on a journey is in phase 'journey' while it walks a leg and 'road' before its first leg and between legs, when it rests and
  // keeps its route (a.path, a.seg). Its household changed at the act; the journey changes only where it is and what it does until it arrives.
  const travelling = (a) => a.phase === 'journey' || a.phase === 'road';
  const journeyOf = (st, id) => {
    for (const j of st.journeys) if (j.pawn === id) return j;
    return null;
  };
  // The next 6:00 after game time t (t itself excluded at 6:00 sharp).
  function nextLeg(t) {
    const day = Math.floor(t / DAY);
    return day * DAY + WORK[0] + (t - day * DAY < WORK[0] ? 0 : DAY);
  }
  function dropJourney(st, id) {
    const j = journeyOf(st, id);
    if (!j) return;
    if ((j.why === 'fetch' || j.why === 'haul') && j.gift) {
      // the grain on his back is put down where he fell (VB-850; sim/lying), for the household it is the gift of to fetch; what lies at the
      // stops goes back
      if (j.gift.held > 0) layGift(st, st.agents[id], j.gift.held, j.gift.parts, j.gift.to);
      unfetched(st, j.gift);
    } else if (j.why === 'carry' && j.gift && !j.back) layGift(st, st.agents[id], j.gift.n, j.gift.parts, j.gift.to);
    st.journeys.splice(st.journeys.indexOf(j), 1);
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
  // door at once (one indoors at night walks when its day starts, at 6:00). A pawn already on the road walks on to the new home. `carry`
  // false: its provisions come from the new household (settlers, who walk on their stakes).
  function moved(st, a, old, hh, carry = true) {
    const f = st.farmsteads[hh.farmstead];
    if (old) driveHome(st, old, a.id); // the old household's herds it had out are left by that farm (its herder is no longer a member)
    if (travelling(a)) return retarget(st, a, f.house);
    if (a.load > 0 && a.phase === 'back' && a.job) {
      // a hand with a load on its way home brings it in first, and then goes (VB-581: the load is carried, not booked from the road)
      if (!a.moving) a.moving = { old: old ? old.id : null, carry };
      return;
    }
    release(st, a);
    dropSides(st, a);
    a.carry = null; // the load of a hand in its own field was set down by release
    const from = old ? st.farmsteads[old.farmstead] : null,
      at = here(st, a);
    if (from ? from.village !== f.village : hoursTo(st, null, at, f.village) > TRAVEL.dayWalk)
      return setOut(st, a, old, hh, carry, hoursTo(st, from ? from.village : null, at, f.village));
    const h = cal(st.t).hour,
      same = from !== null && from.id === f.id;
    if (a.inside && (same || h < WORK[0] || h >= WORK[1])) {
      // in its own house it is home already; indoors elsewhere at night, it walks at 6:00
      if (a.path) halt(st, a);
      a.phase = null;
      a.anim = 'idle';
      if (same) placeAtHome(st, a);
      waitLeg(st, a);
      return;
    }
    goHome(st, a);
  }
  // @state agent.moving: absent, or {old (the household it left, or null), carry}: a move it was told of with a load on its way home, made when
  //   the load is in (VB-581); the pawn's household is already the new one.
  function finishMove(st, a) {
    const { old, carry } = a.moving;
    delete a.moving;
    moved(st, a, old === null ? null : st.households[old], st.households[st.pawns[a.id].household], carry);
  }
  // A child born to a mother on the road (VB-425; no teleporting): it is where she is, outdoors, and walks to its home as she does.
  function placeBorn(st, a, mother, hh) {
    const m = st.agents[mother];
    if (!travelling(m)) {
      placeAtHome(st, a);
      return waitLeg(st, a);
    }
    [a.x, a.y] = placeOf(st, m);
    a.inside = false;
    a.anim = 'idle';
    setOut(st, a, null, hh, false, hoursTo(st, null, tileAt(st, a.x, a.y), st.farmsteads[hh.farmstead].village));
  }
  // A journey starts: provisions from the household it leaves, its record, and the first leg now if a day's walking is left (6:00 to
  // 16:00), else at the next 6:00, from where it stands. A fetch (VB-461) sets out from its own home, for the first place its gift lies.
  function setOut(st, a, old, hh, carry, hours, gift = null) {
    const p = st.pawns[a.id],
      f = st.farmsteads[hh.farmstead],
      fetch = !!(gift && gift.stops),
      j = {
        id: st.journeySeq++,
        pawn: a.id,
        to: fetch ? gift.stops[0].at : f.house,
        why: fetch ? (gift.haul ? 'haul' : 'fetch') : gift ? 'carry' : 'move',
        food: 0,
        from: old ? old.farmstead : null,
      };
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
    if (a.path) halt(st, a); // a walk in hand (to a task it was released from) ends where it has come to: the journey sets out from there
    st.journeys.push(j);
    startLeg(st, a, j);
  }
  // Journey j's provisions topped up to `want` rations from the grain above the seed of the households `from`, in turn.
  function provide(st, j, from, want) {
    const R = 1 / st.ECON.uncooked;
    for (const src of from) {
      const n = Math.min(want - j.food, Math.max(0, Stores.grainOf(src) - Stores.reserved(st, src, 'grain')) / R);
      if (n > 1e-9) {
        Stores.takeSpare(st, src, n * R, { kind: 'journey', pawn: j.pawn });
        j.food += n;
      }
    }
  }
  // The first leg now if a day's walking is left (6:00 to 16:00), else at the next 6:00, from where the pawn stands (a wait on the road).
  function startLeg(st, a, j) {
    const h = cal(st.t).hour;
    if (h >= WORK[0] && h < WORK[1] - 2) {
      leg(st, j);
      return;
    }
    if (a.path) halt(st, a);
    a.phase = 'road';
    a.anim = 'idle';
    roadWait(st, a);
  }
  // A gift of n grain from household `from` to household `to`, further than a day's walk (VB-291; Kim, 10 Nov: carried, not sent): the
  // grain leaves the giver's store as the carrier, one of its adults, sets out; the receiver books it when he arrives (delivered).
  // Only the verb `give` calls it.
  function carryGift(st, o) {
    const a = st.agents[o.carrier],
      parts = {};
    Stores.take(st, o.from, 'grain', o.n, { kind: 'gift', to: st.farmsteads[o.to.farmstead].name }, parts);
    release(st, a);
    dropSides(st, a);
    a.carry = null;
    const hours = hoursBetween(st, st.farmsteads[o.from.farmstead].village, st.farmsteads[o.to.farmstead].village);
    setOut(st, a, o.from, o.to, false, hours, { to: o.to.id, n: o.n, parts });
  }
  // ---- a gift fetched (VB-461; AGENTS.md, the hard rule: a gift changes owner where it lies and waits there until someone fetches it) ----
  // A gift to household hh from another farmstead, or from a village store, is set aside where it lies (the giver's house, the green where
  // the store stands) as hh's, and a member of hh fetches it, TRAVEL.load a trip, walking home with each load; it is hh's to eat as each
  // load comes in. One member fetches all of hh's gifts of the day, a stop after the other.
  // j.gift of a fetch: {to (household), held (the grain on his back, 0 on the way out), parts, stops: [{at (tile), from (household id, or
  // null), village (the store's village, or null), name, left (grain still lying there), parts}]}.
  // The member of household hh who fetches its gift: the one already fetching, else its youngest of 14 or more who is not on the road nor
  // carrying a load home; -1 when none can go.
  function fetcherOf(st, hh) {
    for (const j of st.journeys)
      if (j.why === 'fetch' && j.gift && j.gift.to === hh.id && st.pawns[j.pawn].household === hh.id) return j.pawn;
    return haulerOf(st, hh);
  }
  // The youngest member of household hh of 14 or more who is not on the road nor carrying a load home, or -1: who goes for a gift, or
  // takes the household's quarter to the green (VB-849)
  function haulerOf(st, hh) {
    let best = -1;
    for (const id of hh.members) {
      const p = st.pawns[id],
        a = st.agents[id];
      if (!p.alive || age(st, p) < HANDS[0] || travelling(a) || a.phase === 'back') continue;
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
      j = journeyOf(st, a.id);
    if (j) return void j.gift.stops.push(stop);
    release(st, a);
    dropSides(st, a);
    a.carry = null;
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
    release(st, a);
    dropSides(st, a);
    a.carry = null;
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
    a.anim = 'idle';
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
    const s = journeyOf(st, j.pawn).gift.stops[0];
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
    a.anim = 'idle';
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
  // A leg: the route is found at the first (a journey costs one search), and walked on from where the pawn stopped at the others. Its
  // walk stops for the night at the last step before WORK[1] (begin), and its rest on the road ends at 6:00 (stepAgents).
  function leg(st, j) {
    const a = st.agents[j.pawn];
    a.phase = 'journey';
    if (!a.path) {
      const [x, y] = spotAt(st, a, j.to);
      walkTo(st, a, j.to, x, y);
    } else {
      a.inside = false;
      a.anim = 'walk';
      begin(st, a); // the walk goes on from where it stopped
    }
  }
  // A pawn's household changed again on the road (a death at home, a handover): it walks to the new home, turning back if need be.
  function retarget(st, a, to) {
    const j = journeyOf(st, a.id);
    if ((j.why === 'fetch' || j.why === 'haul') && j.gift) {
      if (j.gift.held > 0) return; // a fetcher brings his load in first (fetchStop), and then walks to the home he has
      unfetched(st, j.gift); // on his way out: what lies there is fetched no more
      j.gift = null;
      j.back = true;
    }
    if (j.to === to || (j.why === 'carry' && !j.back)) return; // a carrier delivers first, and then walks to the home he has
    if (j.why === 'carry') j.back = true;
    j.to = to;
    if (a.phase === 'journey') {
      const [x, y] = spotAt(st, a, to);
      walkTo(st, a, to, x, y); // from where its walk has come to
    } else a.path = null; // resting on the road: its next leg finds its way from where it stopped
  }
  // The day's meal on the road (sim/clock, after the households' meals): each traveller eats what it carries, a ration a day (half below 14).
  function feedTravellers(st) {
    for (const j of st.journeys) {
      const p = st.pawns[j.pawn],
        need = rationOf(st, p),
        eat = Math.min(j.food, need);
      j.food = Math.max(0, j.food - eat);
      ate(st, p, eat, need);
    }
  }
  // Arrival: the journey ends, what is left of its provisions goes into the new home's meals, and the pawn is at home.
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
    a.anim = 'idle';
    startLeg(st, a, j);
  }
  function endJourney(st, a) {
    const j = journeyOf(st, a.id);
    if (j.why === 'carry' && !j.back) return delivered(st, a, j);
    if (j.why === 'fetch' && j.gift) return fetchStop(st, a, j);
    if (j.why === 'haul' && j.gift) return haulStop(st, a, j);
    const hh = st.households[st.pawns[a.id].household];
    st.journeys.splice(st.journeys.indexOf(j), 1);
    if (j.food > 1e-9 && !hh.dissolved) Stores.put(st, hh, 'meals', j.food, { kind: 'journey', pawn: a.id });
    placeAtHome(st, a);
    personEvent(st, a.id, 'arrived', `Arrived at ${st.farmsteads[hh.farmstead].name}`, false);
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
    if (a.phase === 'home') return 'Walking home';
    if (travelling(a)) {
      const g = journeyOf(st, id).gift; // a fetch of a gift (VB-461)
      if (g && g.haul)
        return g.held > 0 ? 'Carrying grain to the store' : `Going for grain for the store at ${g.stops[0].name}`;
      if (g && g.stops)
        return g.held > 0 ? `Carrying grain home from ${g.from}` : `Going for grain at ${g.stops[0].name}`;
      const f = st.farmsteads[st.households[st.pawns[a.id].household].farmstead];
      return a.phase === 'journey' ? `On the road to ${f.name}` : `Resting on the road to ${f.name}`;
    }
    if (a.inside) return 'At home';
    return a.path ? 'Strolling' : 'Resting';
  }
  return {
    ownerKey,
    dropJob,
    homeSpot,
    placeAtHome,
    placeBorn,
    placeByDoor,
    idle,
    haltForTalk,
    stillAtDeath,
    tileAt,
    route,
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
    rateOf,
    withOxen,
    walkHours,
    placeOf,
    poseOf,
    standStill,
    doneOf,
    reckonAll,
    loaded,
    stepAgents,
    rest,
    describe,
    attentionOf,
    heldAt,
    sideWhy,
    offerWhy,
    hold,
    unhold,
    dropSides,
    reachAfter,
    travelling,
    journeyOf,
    moved,
    carryGift,
    fetcherOf,
    haulerOf,
    fetchGift,
    haulGift,
    feedTravellers,
  };
})();
