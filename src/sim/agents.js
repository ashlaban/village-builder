// @sys sim/agents: pawn movement and work: routes, walking, talks, home placement, journeys between villages, death and jobs; the six-minute
// step of the awake agents
VB['sim/agents'] = (() => {
  const { next: rnd } = VB['sim/rng'];
  const { cal, DAY, TICKS, WORK, SPEED, HUNGER, HEALTH, HERD, TRAVEL, workRate } = VB['sim/rules'];
  const { route, stepCost, tileCost, hoursBetween } = VB['sim/routes'];
  const { tread } = VB['sim/paths'];
  const { age, personEvent } = VB['sim/records'];
  const Stores = VB['sim/stores'];
  const { ate, rationOf } = VB['sim/hunger'];
  const { hexSteps } = VB['sim/hex'];
  const { eligible } = VB['sim/eligibility'];
  const { hasTeam } = VB['sim/herds'];
  const Carts = VB['sim/carts'];
  const { driveHome, driven } = VB['sim/grazing'];
  const { workedTogether } = VB['sim/relations'];
  const { finishStep } = VB['sim/expansion'];
  const { worked: prospected } = VB['sim/prospect'];
  const { KINDS, rowAngle, firstRow, isOpen } = VB['sim/kinds'];
  const ROW_PACE = 3.2; // map units an hour along a field row, unless the kind sets its own pace
  function homeSpot(st, a) {
    const f = st.farmsteads[st.households[st.pawns[a.id].household].farmstead];
    return [st.w.hx[f.house] - 12 + a.ox * 0.3, st.w.hy[f.house] + 14 + a.oy * 0.15]; // by the cottage door
  }
  function placeAtHome(st, a) {
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
  function idle(st, a, until) {
    a.idleUntil = until;
    wake(st, a.id);
  }
  // A talk stops only an idle pawn outdoors, not one on its way to an occasion (VB-126), and never shortens an existing pause.
  function haltForTalk(st, g, until) {
    if (!g.inside && !g.job && g.phase === null && g.occasion === null) {
      g.path = null;
      g.anim = 'idle';
      g.idleUntil = Math.max(g.idleUntil, until);
    }
  }
  function stillAtDeath(st, a) {
    dropJourney(st, a.id); // a pawn who dies on the road dies there (VB-287)
    release(st, a);
    dropSides(st, a);
    a.path = null;
    a.inside = true;
    sleep(st, a.id);
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
  // The way to (x, y) in `tile`: each point [x, y, cost, tile] carries the cost of the step that ends there, so a pawn walks slower over
  // rough ground, and the tile it enters there (-1 when it stays in the tile), whose wear the step adds to (sim/paths).
  function walkTo(st, a, tile, x, y) {
    const w = st.w,
      from = tileAt(st, a.x, a.y),
      p = from >= 0 && from !== tile ? route(st, from, tile) : null;
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
    wake(st, a.id);
  }
  // Where on the site a pawn stands to do the job: as its kind says, else the middle of the tile.
  const workSpot = (st, a, j) =>
    KINDS[j.kind].spot ? KINDS[j.kind].spot(st, a, j) : [st.w.hx[j.site], st.w.hy[j.site]];
  // The pawn joins the job's workers (j.claims) and sets out for it.
  function start(st, a, j) {
    j.claims.push(a.id);
    a.job = j;
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
    if (st.jobs.get(j.key) === j) st.jobs.delete(j.key);
    const s = j.owner && st.jobsBy.get(ownerKey(j.owner));
    if (s) s.delete(j);
  }
  // The pawn leaves its job, which keeps its progress for whoever takes it up.
  function release(st, a) {
    // a load on its way home is put down in its farm's barn first (VB-335: a wedding or a move at the round found a pawn mid-haul)
    if (a.load > 0 && a.phase === 'back' && a.job) deposit(st, a, a.job.farm);
    if (a.job) {
      const c = a.job.claims,
        i = c.indexOf(a.id);
      if (i >= 0) c.splice(i, 1);
      a.job = null;
    }
    a.phase = null;
    a.work = null;
    a.basis = null;
    a.load = 0; // wood cut and stacked, not yet on its way, is left
    const hid = st.pawns[a.id].household;
    if (hid !== null) Carts.leave(st, st.households[hid], a.id); // and its cart is free
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
    if (att === 'background' && a.job && !(inReach(st, j, tileAt(st, a.x, a.y)) && inReach(st, j, a.job.site)))
      return `${j.key} is out of its reach`;
    return null;
  }
  // The pawn takes up side task j; a background task out of its reach, with no task in hand, it sets out for. The kind's `held` says what
  // taking it up does (VB-136: the herds go out with the herder).
  function hold(st, a, j) {
    if (!a.side) a.side = { partial: null, background: null };
    a.side[attentionOf(j)] = j;
    j.claims.push(a.id);
    if (attentionOf(j) === 'background' && !a.job && !inReach(st, j, tileAt(st, a.x, a.y))) {
      const [x, y] = workSpot(st, a, j);
      walkTo(st, a, j.site, x, y);
    }
    if (KINDS[j.kind].held) KINDS[j.kind].held(st, j, a, cal(st.t));
  }
  // The pawn lets go of side task j, which stays posted, with its progress, for others.
  function unhold(a, j) {
    const i = j.claims.indexOf(a.id);
    if (i >= 0) j.claims.splice(i, 1);
    for (const slot of ['partial', 'background']) if (a.side[slot] === j) a.side[slot] = null;
    if (!a.side.partial && !a.side.background) delete a.side;
  }
  function dropSides(st, a) {
    if (a.side) for (const slot of ['partial', 'background']) if (a.side && a.side[slot]) unhold(a, a.side[slot]);
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
    if (bg && a.job && !inReach(st, bg, a.job.site)) unhold(a, bg);
  }
  // Each step of a pawn that holds side tasks: a task finished or gone from the board is let go; a background task is done at its rate
  // of the pawn's hours (VB-136: hours, not work: a child minds the herd as long as a man), with its kind's `worked`, while the pawn is
  // within its reach; on its way into reach it is kept, not worked; it is let go out of reach, and outside the working hours. Its work
  // done, a pawn with nothing else in hand goes home (VB-136: the herder brings the herds home).
  // A pawn standing still (no path, no work) is where it was last step, so its reach is not looked at again: every walk out of reach is
  // seen while it has its path, as this runs before the step's walking (VB-136, cost).
  const SLOTS = ['partial', 'background'];
  function stepSide(st, a, dt, h) {
    for (let k = 0; k < 2; k++) {
      const slot = SLOTS[k],
        j = heldAt(a, slot);
      if (!j) continue;
      if (st.jobs.get(j.key) !== j) {
        unhold(a, j);
        if (!a.side) return;
        continue;
      }
      if (slot !== 'background') continue;
      const K = KINDS[j.kind];
      if (h < WORK[0] || h >= WORK[1]) {
        unhold(a, j);
        if (!a.side) return;
        continue;
      }
      if ((a.path || a.phase !== null) && !inReach(st, j, tileAt(st, a.x, a.y))) {
        const end = a.path && a.path[a.path.length - 1];
        if (end && inReach(st, j, tileAt(st, end[0], end[1]))) continue;
        unhold(a, j);
        if (!a.side) return;
        continue;
      }
      j.done += dt * K.rate;
      if (K.worked) K.worked(st, j, dt);
      if (j.done >= (j.hours ?? K.hours)) {
        unhold(a, j);
        if (K.done) K.done(st, j, st.households[st.pawns[a.id].household], cal(st.t));
        prospected(st, a.id, tileAt(st, a.x, a.y), j.hours ?? K.hours);
        dropJob(st, j);
        if (!a.job && !a.path && !a.inside && a.phase === null) goHome(st, a);
        if (!a.side) return;
      }
    }
  }
  // The work is done: everyone working the job but the one who finished it stops, and looks for other work; one that held it at the side
  // lets it go and keeps its task. (Over a copy: letting go takes the pawn out of j.claims, which skipped the next worker; VB-136.)
  function freeHands(st, j, finisher) {
    for (const id of [...j.claims]) {
      if (id === finisher) continue;
      const b = st.agents[id];
      if (b.phase === 'back') continue; // a load on the road stays the job's (VB-335)
      if (b.side && (b.side.partial === j || b.side.background === j)) {
        unhold(b, j);
        continue;
      }
      if (b.phase === 'go') b.path = null;
      b.job = null;
      b.phase = null;
      b.work = null;
      b.inside = false;
      b.anim = 'idle';
    }
    j.claims = j.claims.filter((id) => id === finisher || st.agents[id].phase === 'back');
  }
  // The work is done: those who finished it together know each other better (sim/relations); a plot's step is finished (sim/expansion),
  // any other job does what its kind says (sim/kinds).
  function complete(st, a) {
    const j = a.job,
      hh = st.households[st.pawns[a.id].household],
      K = KINDS[j.kind];
    if (j.claims.length > 1) workedTogether(st, j.claims);
    freeHands(st, j, a.id);
    prospected(st, a.id, tileAt(st, a.x, a.y), j.hours ?? K.hours ?? 0); // a hidden vein near the work may be come on (sim/prospect)
    if (j.plot) {
      finishStep(st, j);
      dropJob(st, j);
      return;
    }
    if (K.done) K.done(st, j, hh, cal(st.t));
    dropJob(st, j);
  }
  // Home with the load: the kind says what it brings.
  function deposit(st, a, farm = null) {
    const j = a.job,
      K = KINDS[j.kind];
    const hh = st.households[farm && farm.household !== null ? farm.household : st.pawns[a.id].household];
    if (K.deliver) K.deliver(st, j, hh, st.farmsteads[hh.farmstead], a);
    Carts.home(st, st.households[st.pawns[a.id].household], a.id); // the cart it came on, if any, wears
    if (!K.again || !K.again(j)) dropJob(st, j);
    else j.claims.splice(j.claims.indexOf(a.id), 1); // open for the next load
    a.carry = null;
    a.load = 0;
    a.job = null;
    a.basis = null;
    a.phase = null;
  }
  const wantsWork = (st, a, c) =>
    !a.path && a.phase === null && c.hour >= WORK[0] && c.hour < WORK[1] && a.idleUntil <= st.t;
  function arrived(st, a) {
    a.anim = 'idle';
    if (a.phase === 'go') {
      const K = KINDS[a.job.kind];
      a.phase = 'work';
      a.anim = K.anim || 'idle';
      a.inside = !!K.inside;
      if (K.field)
        a.work = {
          s: -13,
          dir: 1,
          row: firstRow(a.job, a),
          th: rowAngle(a.job),
          cx: st.w.hx[a.job.site],
          cy: st.w.hy[a.job.site],
        };
    } else if (a.phase === 'back') deposit(st, a);
    else if (a.phase === 'home') {
      a.inside = true;
      a.phase = null;
      driveHome(st, st.households[st.pawns[a.id].household], a.id); // the herds it brought home are by the farm (VB-136)
    } else if (a.phase === 'journey') endJourney(st, a);
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
  function stepWork(st, a, dt) {
    const j = a.job,
      K = KINDS[j.kind];
    // manure is carted faster with a cart (sim/carts): taken as the work begins, and kept until it ends
    const hhW = K.carted || K.stack ? st.households[st.pawns[a.id].household] : null;
    j.done +=
      dt *
      rateOf(st, st.pawns[a.id]) *
      (withOxen(st, a) ? HERD.team.rate : 1) *
      (K.carted ? Carts.carting(st, hhW, a.id, teamFree(st, hhW)) : 1);
    if (K.worked) K.worked(st, j);
    if (j.plot) j.plot.hours[a.id] = (j.plot.hours[a.id] || 0) + dt;
    if (a.work) {
      // walk the field row by row while working
      const wk = a.work,
        speed = K.pace || ROW_PACE;
      wk.s += wk.dir * speed * dt;
      if (wk.s > 13 || wk.s < -13) {
        wk.s = Math.max(-13, Math.min(13, wk.s));
        wk.dir = -wk.dir;
        wk.row += 6;
        if (wk.row > 12) wk.row = -12;
      }
      const nx = wk.cx + Math.cos(wk.th) * wk.s - Math.sin(wk.th) * wk.row,
        ny = wk.cy + Math.sin(wk.th) * wk.s + Math.cos(wk.th) * wk.row;
      if (Math.abs(nx - a.x) > 0.01) a.face = nx > a.x ? 1 : -1;
      a.stride += Math.hypot(nx - a.x, ny - a.y) / 3.4;
      a.x = nx;
      a.y = ny;
    }
    if (j.done >= (j.hours ?? K.hours) && K.stack) {
      // firewood (sim/carts): a trip's cutting is a back load; with a cart that has room for one more, the cutter stays and cuts
      // it, while the pile is short and the working day has the hours; with no cart free and the pile still short, a miss
      a.load = (a.load || 0) + TRAVEL.load;
      const c = cal(st.t);
      if (K.stack(st, j, hhW, c, a.load) && c.hour + K.hours <= WORK[1]) {
        const cap = Carts.holds(st, hhW, a.id) || Carts.take(st, hhW, a.id, teamFree(st, hhW));
        if (cap >= a.load + TRAVEL.load) {
          j.done = 0;
          return;
        }
        if (cap === TRAVEL.load) Carts.missed(st, hhW);
      }
      if (a.load <= TRAVEL.load) Carts.leave(st, hhW, a.id);
    }
    if (j.done >= (j.hours ?? K.hours)) {
      // a load taken from the field (VB-335), on the household's best free cart or on the back (sim/carts); a load on the back
      // with more left waiting is a miss the head counts
      const hhL = K.load ? st.households[st.pawns[a.id].household] : null,
        cap = K.load ? Carts.take(st, hhL, a.id, teamFree(st, hhL)) : 0;
      const n = K.load ? K.load(st, a, j, cap) : null;
      if (K.load && cap === TRAVEL.load && n > 0 && K.again(j)) Carts.missed(st, hhL);
      if (K.load && n <= TRAVEL.load) Carts.leave(st, hhL, a.id); // a load for the back needs no cart
      if (K.carry && n !== 0) {
        if (n !== null && K.again(j)) {
          j.done = 0;
          if (K.reload) j.hours = K.reload;
        } // the others go on loading
        else freeHands(st, j, a.id);
        a.carry = K.carry;
        a.phase = 'back';
        a.work = null;
        const f = st.farmsteads[st.households[st.pawns[a.id].household].farmstead],
          to = K.to === 'site' ? j.dest : f.house;
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
        if (K.carted) Carts.home(st, st.households[st.pawns[a.id].household], a.id); // the dung cart is back, and wears
        a.job = null;
        a.basis = null;
        a.work = null;
        a.phase = null;
        a.inside = false;
        if (K.inside) {
          a.inside = false;
          a.anim = 'idle';
        }
      }
    }
  }
  function moveAgent(st, a, dt) {
    let left = SPEED * st.w.HW * dt * (a.carry ? Carts.pace(st, a) : 1); // map units of meadow walking; a step of cost c takes c of them per unit
    while (left > 0 && a.seg < a.path.length - 1) {
      const pt = a.path[a.seg + 1],
        tx = pt[0],
        ty = pt[1],
        c = pt[2] === undefined ? 1 : pt[2];
      const dx = tx - a.x,
        dy = ty - a.y,
        d = Math.hypot(dx, dy),
        reach = left / c;
      if (Math.abs(dx) > 0.3) a.face = dx > 0 ? 1 : -1;
      const m = Math.min(d, reach);
      a.stride += m / 3.4;
      if (d <= reach) {
        a.x = tx;
        a.y = ty;
        a.seg++;
        VB.count.walkPoint++;
        const t = a.path[a.seg][3] ?? -1;
        // the herds it drives wear the way too (VB-136): only a herder out with them, or bringing them home, can drive any
        if (t >= 0) tread(st.w, t, a.side || a.phase === 'home' ? 1 + HERD.herding.move * driven(st, a.id) : 1);
      } else if (reach > 0) {
        a.x += (dx / d) * reach;
        a.y += (dy / d) * reach;
      } else break; // a budget so small (a few 1e-324) that it moves nothing: it never shrinks, so stop until the next step
      left -= m * c;
    }
    if (a.seg >= a.path.length - 1) {
      a.path = null;
      arrived(st, a);
    }
  }
  // ---- the six-minute step (VB-205): only the agents that may act this hour are walked (rule 4) ----
  // @state st.awake: {hour, ids, at}, a cache owned here, not saved (non-enumerable, like st.idx): the ids, in increasing order, of the
  //   living agents that may act in game hour `hour`: those walking or working, and in working hours those with no task whose pause ends
  //   by the hour's end. Rebuilt at the first step of each hour, after its onHour; between, only walkTo and idle can make an agent act, and
  //   they wake it (add it here); a death takes it out. `at` is the step's place in ids, kept right when an agent is woken mid-step.
  //   Read by stepAgents only, so an agent left out is one the step would have passed over.
  function awake(st) {
    const hour = Math.floor(st.tick / TICKS);
    if (st.awake && st.awake.hour === hour) return st.awake;
    const h = ((hour % DAY) + DAY) % DAY,
      work = h >= WORK[0] && h <= WORK[1],
      ids = [];
    VB.count.walkAwake += st.living.length;
    for (const id of st.living) {
      const a = st.agents[id];
      // a pawn holding a side task is stepped while it holds it (VB-136: the herder minds the herds while it waits)
      // a pawn between the legs of a journey keeps its route but sleeps where it stopped (VB-287)
      if (
        (a.path && a.phase !== 'road') ||
        a.phase === 'work' ||
        a.side ||
        (work && a.phase === null && a.idleUntil <= hour + 1)
      )
        ids.push(id);
    }
    if (!st.awake) Object.defineProperty(st, 'awake', { value: null, writable: true });
    st.awake = { hour, ids, at: ids.length };
    return st.awake;
  }
  // Where id is in the sorted ids, or where it would go.
  function place(ids, id) {
    let lo = 0,
      hi = ids.length;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (ids[m] < id) lo = m + 1;
      else hi = m;
    }
    return lo;
  }
  function wake(st, id) {
    const w = st.awake;
    if (!w) return;
    const i = place(w.ids, id);
    if (w.ids[i] === id) return;
    w.ids.splice(i, 0, id);
    if (i <= w.at) w.at++;
  }
  function sleep(st, id) {
    const w = st.awake;
    if (!w) return;
    const i = place(w.ids, id);
    if (w.ids[i] !== id) return;
    w.ids.splice(i, 1);
    if (i <= w.at) w.at--;
  }
  // Each awake agent walks, works, or, if it wants work, joins the list returned (in id order) for the planner (sim/clock). A whole
  // 6-minute step, always: the page draws the pawns between steps (VB-244).
  const STEP_HOURS = 1 / TICKS;
  function stepAgents(st, c) {
    const w = awake(st),
      ids = w.ids,
      out = [],
      dt = STEP_HOURS;
    VB.count.walkStep += ids.length;
    for (w.at = 0; w.at < ids.length; w.at++) {
      const a = st.agents[ids[w.at]];
      if (a.side) stepSide(st, a, dt, c.hour);
      if (a.path) moveAgent(st, a, dt);
      else if (a.phase === 'work') stepWork(st, a, dt);
      else if (wantsWork(st, a, c)) out.push(a);
    }
    return out;
  }
  // ---- journeys (VB-287; design.md, Between villages: A journey, Provisions and the season) ----
  // @state st.journeys[]: the open journeys, sorted by due (after those due at the same time), each {id, pawn, to (tile: the house of the
  //   pawn's household), why ('move'), due (game hours: its next leg's start, 6:00; while a leg is walked, the next day's 6:00), food (the
  //   rations it carries), from (the farm it left, or null)}. Plain data, saved; a save without it loads with none.
  // @state st.journeySeq: number; the next journey's id; ids are never reused
  // A pawn on a journey is in phase 'journey' while it walks a leg and 'road' before its first leg and between legs, when it is not awake and
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
  // Journey j takes its place in st.journeys by its due time.
  function queueJourney(st, j) {
    const at = st.journeys.indexOf(j);
    if (at >= 0) st.journeys.splice(at, 1);
    let i = st.journeys.length;
    while (i > 0 && st.journeys[i - 1].due > j.due) i--;
    st.journeys.splice(i, 0, j);
  }
  function dropJourney(st, id) {
    const j = journeyOf(st, id);
    if (j) st.journeys.splice(st.journeys.indexOf(j), 1);
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
    release(st, a);
    dropSides(st, a);
    a.carry = null; // a load on its way home was put down by release
    const from = old ? st.farmsteads[old.farmstead] : null,
      at = tileAt(st, a.x, a.y);
    if (from ? from.village !== f.village : hoursTo(st, null, at, f.village) > TRAVEL.dayWalk)
      return setOut(st, a, old, hh, carry, hoursTo(st, from ? from.village : null, at, f.village));
    const h = cal(st.t).hour,
      same = from !== null && from.id === f.id;
    if (a.inside && (same || h < WORK[0] || h >= WORK[1])) {
      // in its own house it is home already; indoors elsewhere at night, it walks at 6:00
      a.path = null;
      a.phase = null;
      a.anim = 'idle';
      if (same) placeAtHome(st, a);
      return;
    }
    goHome(st, a);
  }
  // A child born to a mother on the road (VB-425; no teleporting): it is where she is, outdoors, and walks to its home as she does.
  function placeBorn(st, a, mother, hh) {
    const m = st.agents[mother];
    if (!travelling(m)) return placeAtHome(st, a);
    a.x = m.x;
    a.y = m.y;
    a.inside = false;
    a.anim = 'idle';
    setOut(st, a, null, hh, false, hoursTo(st, null, tileAt(st, a.x, a.y), st.farmsteads[hh.farmstead].village));
  }
  // A journey starts: provisions from the household it leaves, its record, and the first leg now if a day's walking is left (6:00 to
  // 16:00), else at the next 6:00, from where it stands.
  function setOut(st, a, old, hh, carry, hours) {
    const p = st.pawns[a.id],
      f = st.farmsteads[hh.farmstead],
      j = {
        id: st.journeySeq++,
        pawn: a.id,
        to: f.house,
        why: 'move',
        due: 0,
        food: 0,
        from: old ? old.farmstead : null,
      };
    // provisions (design: Provisions and the season): a ration (half below 14) a day of walking, from the grain above the seed of the
    // household it leaves, then of the one it joins; with none to give it goes unprovisioned, and hungry
    const want = Math.ceil(hours / TRAVEL.dayWalk) * rationOf(st, p),
      R = 1 / st.ECON.uncooked;
    for (const src of carry && old && !old.dissolved ? [old, hh] : [hh]) {
      const n = Math.min(want - j.food, Math.max(0, Stores.grainOf(src) - Stores.reserved(st, src, 'grain')) / R);
      if (n > 1e-9) {
        Stores.takeSpare(st, src, n * R, { kind: 'journey', pawn: a.id });
        j.food += n;
      }
    }
    const left = old ? st.farmsteads[old.farmstead].name : 'where it stood';
    personEvent(st, a.id, 'setOut', `Set out from ${left} for ${f.name}, ${Math.round(hours)} hours' walk`, false);
    const h = cal(st.t).hour;
    if (h >= WORK[0] && h < WORK[1] - 2) {
      leg(st, j);
      return;
    }
    a.path = null;
    a.phase = 'road';
    a.anim = 'idle';
    sleep(st, a.id);
    j.due = nextLeg(st.t);
    queueJourney(st, j);
  }
  // A leg: the route is found at the first (a journey costs one search), and walked on from where the pawn stopped at the others.
  function leg(st, j) {
    const a = st.agents[j.pawn];
    if (!a.path) {
      const [x, y] = homeSpot(st, a);
      walkTo(st, a, j.to, x, y);
    } else {
      a.inside = false;
      a.anim = 'walk';
      wake(st, a.id);
    }
    a.phase = 'journey';
    j.due = nextLeg(st.t);
    queueJourney(st, j);
  }
  // A pawn's household changed again on the road (a death at home, a handover): it walks to the new home, turning back if need be.
  function retarget(st, a, to) {
    const j = journeyOf(st, a.id);
    if (j.to === to) return;
    j.to = to;
    a.path = null;
    if (a.phase === 'journey') {
      const [x, y] = homeSpot(st, a);
      walkTo(st, a, to, x, y);
    }
  }
  // The calendar's 6:00 (sim/clock): the legs due start. Only the first journey's due time is read (Rules for cost, 4).
  function dueJourneys(st) {
    while (st.journeys.length && st.journeys[0].due <= st.t) leg(st, st.journeys[0]);
  }
  // The calendar's 18:00: a pawn still on the road stops where it stands, outdoors, and sleeps there; its next leg is due at 6:00.
  function stopJourneys(st) {
    for (const j of st.journeys) {
      const a = st.agents[j.pawn];
      if (a.phase !== 'journey') continue;
      a.phase = 'road';
      a.anim = 'idle';
      sleep(st, a.id);
    }
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
  function endJourney(st, a) {
    const j = journeyOf(st, a.id),
      hh = st.households[st.pawns[a.id].household];
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
    complete,
    deposit,
    wantsWork,
    arrived,
    goHome,
    rateOf,
    withOxen,
    stepWork,
    moveAgent,
    stepAgents,
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
    dueJourneys,
    stopJourneys,
    feedTravellers,
  };
})();
