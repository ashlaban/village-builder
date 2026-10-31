// @sys sim/agents: pawn movement and work: routes, walking, starting and finishing jobs
VB['sim/agents'] = (() => {
  const { cal, WORK, SPEED, HUNGER, HEALTH, workRate } = VB['sim/rules'];
  const { route, stepCost, tileCost } = VB['sim/routes'];
  const { tread } = VB['sim/paths'];
  const { age } = VB['sim/records'];
  const { companyFor } = VB['sim/relations'];
  const { finishStep } = VB['sim/expansion'];
  const { KINDS, rowAngle, firstRow } = VB['sim/kinds'];
  const ROW_PACE = 3.2; // map units an hour along a field row, unless the kind sets its own pace
  function homeSpot(st, a) {
    const f = st.farmsteads[st.households[st.pawns[a.id].household].farmstead];
    return [st.w.hx[f.house] - 12 + a.ox * 0.3, st.w.hy[f.house] + 14 + a.oy * 0.15]; // by the cottage door
  }
  function placeAtHome(st, a) {
    const [x, y] = homeSpot(st, a); a.x = x; a.y = y; a.inside = true; a.path = null; a.phase = null; a.job = null; a.anim = 'idle'; a.carry = null;
  }
  function tileAt(st, x, y) {
    const w = st.w, R = w.R, HW = w.HW, AP = w.AP;
    const px = x - AP, py = y - R, qf = ((Math.sqrt(3) / 3) * px - py / 3) / R, rf = ((2 / 3) * py) / R, sf = -qf - rf;
    let q = Math.round(qf), r = Math.round(rf), s = Math.round(sf);
    const dq = Math.abs(q - qf), dr = Math.abs(r - rf), ds = Math.abs(s - sf);
    if (dq > dr && dq > ds) q = -r - s; else if (dr > ds) r = -q - s;
    const col = q + ((r - (r & 1)) >> 1);
    return r >= 0 && r < w.ROWS && col >= 0 && col < w.COLS ? r * w.COLS + col : -1;
  }
  // The way to (x, y) in `tile`: each point [x, y, cost, tile] carries the cost of the step that ends there, so a pawn walks slower over
  // rough ground, and the tile it enters there (-1 when it stays in the tile), whose wear the step adds to (sim/paths).
  function walkTo(st, a, tile, x, y) {
    const w = st.w, from = tileAt(st, a.x, a.y), p = from >= 0 && from !== tile ? route(st, from, tile) : null;
    const ok = p && p[0] === from, tiles = ok ? p.slice(1, -1) : [], cost = (i) => (i >= 0 && tileCost(w, i) < Infinity ? tileCost(w, i) : 1);
    a.path = [[a.x, a.y]];
    for (let s = 0; s < tiles.length; s++) {
      const t = tiles[s];
      a.path.push([w.hx[t] + a.ox * 0.4, w.hy[t] + a.oy * 0.4, stepCost(w, p[s], t), t]);
    }
    a.path.push([x, y, ok ? stepCost(w, p[p.length - 2], tile) : cost(tile), ok ? tile : -1]);
    a.seg = 0; a.inside = false; a.anim = 'walk';
  }
  // Where on the site a pawn stands to do the job: as its kind says, else the middle of the tile.
  const workSpot = (st, a, j) => (KINDS[j.kind].spot ? KINDS[j.kind].spot(st, a, j) : [st.w.hx[j.site], st.w.hy[j.site]]);
  // The pawn joins the job's workers (j.claims) and sets out for it.
  function start(st, a, j) {
    j.claims.push(a.id); a.job = j;
    const K = KINDS[j.kind];
    if (K.inside) { const [x, y] = homeSpot(st, a); a.phase = 'go'; walkTo(st, a, j.farm.house, x, y); return; }
    const [x, y] = workSpot(st, a, j);
    a.phase = 'go'; walkTo(st, a, j.site, x, y);
  }
  // st.jobs by key, and st.jobsBy by owner ('household:3', 'village:1'); every job leaves both together.
  const ownerKey = (o) => `${o.type}:${o.id}`;
  function dropJob(st, j) { st.jobs.delete(j.key); const s = j.owner && st.jobsBy.get(ownerKey(j.owner)); if (s) s.delete(j); }
  // The pawn leaves its job, which keeps its progress for whoever takes it up.
  function release(st, a) {
    if (a.job) { const c = a.job.claims, i = c.indexOf(a.id); if (i >= 0) c.splice(i, 1); a.job = null; }
    a.phase = null; a.work = null;
  }
  // The work is done: everyone working the job but the one who finished it stops, and looks for other work.
  function freeHands(st, j, finisher) {
    for (const id of j.claims) {
      if (id === finisher) continue;
      const b = st.agents[id];
      if (b.phase === 'go') b.path = null;
      b.job = null; b.phase = null; b.work = null; b.inside = false; b.anim = 'idle';
    }
    j.claims = j.claims.filter((id) => id === finisher);
  }
  // The work is done: a plot's step is finished (sim/expansion), any other job does what its kind says (sim/kinds).
  function complete(st, a) {
    const j = a.job, hh = st.households[st.pawns[a.id].household], K = KINDS[j.kind];
    freeHands(st, j, a.id);
    if (j.plot) { finishStep(st, j); dropJob(st, j); return; }
    if (K.done) K.done(st, j, hh, cal(st.t));
    dropJob(st, j);
  }
  // Home with the load: the kind says what it brings.
  function deposit(st, a) {
    const j = a.job, hh = st.households[st.pawns[a.id].household], K = KINDS[j.kind];
    if (K.deliver) K.deliver(st, j, hh, st.farmsteads[hh.farmstead]);
    dropJob(st, j);
    a.carry = null; a.job = null; a.phase = null;
  }
  const wantsWork = (st, a, c) => !a.path && a.phase === null && c.hour >= WORK[0] && c.hour < WORK[1] && a.idleUntil <= st.t;
  function idleAbout(st, a) {
    // nothing suitable: join someone it likes who idles in the village (sim/relations), or drift to the green or the yard; look again in a while
    const mate = st.cenv ? companyFor(st, a) : null;
    if (mate) walkTo(st, a, tileAt(st, mate.x, mate.y), mate.x + (st.rand() - 0.5) * 16, mate.y + (st.rand() - 0.5) * 8);
    else {
      const p = st.pawns[a.id], f = st.farmsteads[st.households[p.household].farmstead];
      const v = st.villages[f.village], spot = v.green && st.rand() < 0.5 ? v.center : f.house;
      walkTo(st, a, spot, st.w.hx[spot] + (st.rand() - 0.5) * 26, st.w.hy[spot] + 6 + (st.rand() - 0.5) * 12);
    }
    a.idleUntil = st.t + 0.75 + st.rand() * 1.25;
  }
  function arrived(st, a) {
    a.anim = 'idle';
    if (a.phase === 'go') {
      const K = KINDS[a.job.kind];
      a.phase = 'work'; a.anim = K.anim || 'idle'; a.inside = !!K.inside;
      if (K.field) a.work = { s: -13, dir: 1, row: firstRow(a.job, a), th: rowAngle(a.job), cx: st.w.hx[a.job.site], cy: st.w.hy[a.job.site] };
    } else if (a.phase === 'back') deposit(st, a);
    else if (a.phase === 'home') { a.inside = true; a.phase = null; }
  }
  function goHome(st, a) {
    const f = st.farmsteads[st.households[st.pawns[a.id].household].farmstead], [x, y] = homeSpot(st, a);
    walkTo(st, a, f.house, x, y);
  }
  // Work hours a pawn does in an hour: by role and age (children), slowed by hunger and poor health.
  const rateOf = (st, p) => workRate(p.role, age(st, p)) * (1 - HUNGER.slow * p.hunger) * (1 - HEALTH.slow * (100 - p.health) / 100);
  function stepWork(st, a, dt) {
    const j = a.job, K = KINDS[j.kind];
    j.done += dt * rateOf(st, st.pawns[a.id]);
    if (j.plot) j.plot.hours[a.id] = (j.plot.hours[a.id] || 0) + dt;
    if (a.work) {
      // walk the field row by row while working
      const wk = a.work, speed = K.pace || ROW_PACE;
      wk.s += wk.dir * speed * dt;
      if (wk.s > 13 || wk.s < -13) { wk.s = Math.max(-13, Math.min(13, wk.s)); wk.dir = -wk.dir; wk.row += 6; if (wk.row > 12) wk.row = -12; }
      const nx = wk.cx + Math.cos(wk.th) * wk.s - Math.sin(wk.th) * wk.row, ny = wk.cy + Math.sin(wk.th) * wk.s + Math.cos(wk.th) * wk.row;
      if (Math.abs(nx - a.x) > 0.01) a.face = nx > a.x ? 1 : -1;
      a.stride += Math.hypot(nx - a.x, ny - a.y) / 3.4;
      a.x = nx; a.y = ny;
    }
    if (j.done >= (j.hours ?? K.hours)) {
      if (K.carry) {
        freeHands(st, j, a.id);
        a.carry = K.carry; a.phase = 'back'; a.work = null;
        const f = st.farmsteads[st.households[st.pawns[a.id].household].farmstead];
        // sheaves go to the barn door, firewood to the woodpile, water into the cottage
        const hx = st.w.hx[f.house], hy = st.w.hy[f.house];
        const [x, y] = K.to === 'door' ? homeSpot(st, a) : K.to === 'woodpile' ? [hx + 7, hy + 16] : [hx - 3, hy - 9];
        walkTo(st, a, f.house, x, y);
      } else {
        complete(st, a);
        a.job = null; a.work = null;
        a.phase = null; a.inside = false;
        if (K.inside) { a.inside = false; a.anim = 'idle'; }
      }
    }
  }
  function moveAgent(st, a, dt) {
    let left = SPEED * st.w.HW * dt * (a.carry ? 0.8 : 1); // map units of meadow walking; a step of cost c takes c of them per unit
    while (left > 0 && a.seg < a.path.length - 1) {
      const [tx, ty, c = 1] = a.path[a.seg + 1], dx = tx - a.x, dy = ty - a.y, d = Math.hypot(dx, dy), reach = left / c;
      if (Math.abs(dx) > 0.3) a.face = dx > 0 ? 1 : -1;
      const m = Math.min(d, reach);
      a.stride += m / 3.4;
      if (d <= reach) { a.x = tx; a.y = ty; a.seg++; tread(st.w, a.path[a.seg][3] ?? -1); } else { a.x += (dx / d) * reach; a.y += (dy / d) * reach; }
      left -= m * c;
    }
    if (a.seg >= a.path.length - 1) { a.path = null; arrived(st, a); }
  }
  function describe(st, id) {
    const a = st.agents[id];
    if (a.job) {
      const K = KINDS[a.job.kind];
      if (a.phase === 'go') return K.go;
      if (a.phase === 'back') return K.back;
      return K.verb;
    }
    if (a.phase === 'home') return 'Walking home';
    if (a.inside) return 'At home';
    return a.path ? 'Strolling' : 'Resting';
  }
  return {
    ownerKey, dropJob,
    homeSpot, placeAtHome, tileAt, route, walkTo, workSpot, start, release, freeHands, complete, deposit, wantsWork, idleAbout, arrived, goHome, rateOf,
    stepWork,
    moveAgent, describe,
  };
})();
