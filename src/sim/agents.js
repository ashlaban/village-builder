// @sys sim/agents: pawn movement and work: routes, walking, starting and finishing jobs
VB['sim/agents'] = (() => {
  const { cal, WORK, KINDS, SPEED, HUNGER } = VB['sim/rules'];
  const { bfs, pathTo, land } = VB['sim/hex'];
  const { log } = VB['sim/records'];
  const { fellTree } = VB['sim/forest'];
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
  function route(st, from, to) {
    const k = from * st.w.N + to;
    if (st.pathCache.has(k)) return st.pathCache.get(k);
    let p = pathTo(bfs(st.w, from, 60, land(st.w)).prev, from, to);
    if (!p) { p = pathTo(bfs(st.w, from, 200, land(st.w)).prev, from, to); if (!p) { p = [to]; st.routeFallbacks++; } }
    st.pathCache.set(k, p);
    return p;
  }
  function walkTo(st, a, tile, x, y) {
    const from = tileAt(st, a.x, a.y), tiles = from >= 0 && from !== tile ? route(st, from, tile).slice(1, -1) : [];
    a.path = [[a.x, a.y], ...tiles.map((i) => [st.w.hx[i] + a.ox * 0.4, st.w.hy[i] + a.oy * 0.4]), [x, y]];
    a.seg = 0; a.inside = false; a.anim = 'walk';
  }
  // Where on the site a pawn stands to do the job.
  function workSpot(st, a, j) {
    const w = st.w;
    if (KINDS[j.kind].field) {
      const th = j.farm.rowAngle;
      return [w.hx[j.site] - Math.cos(th) * 13 + Math.sin(th) * -12, w.hy[j.site] - Math.sin(th) * 13 - Math.cos(th) * -12];
    }
    if (j.kind === 'haul') return [w.hx[j.site] + a.ox * 0.6, w.hy[j.site] + a.oy * 0.6];
    if (j.kind === 'water') return st.villages[j.farm.village].well ? [w.hx[j.site] - 10 + a.ox * 0.2, w.hy[j.site] + 8] : [w.hx[j.site] - 1, w.hy[j.site] + 4];
    if (j.kind === 'mend') return [j.stretch.mx + (w.hx[j.site] - j.stretch.mx) * 0.25, j.stretch.my + (w.hy[j.site] - j.stretch.my) * 0.25 + 3];
    if (j.kind === 'wood') return [w.hx[j.site] - 8 + a.ox * 0.4, w.hy[j.site] + 6];
    return [w.hx[j.site], w.hy[j.site]];
  }
  function start(st, a, j) {
    j.claim = a.id; a.job = j;
    const K = KINDS[j.kind];
    if (K.inside) { const [x, y] = homeSpot(st, a); a.phase = 'go'; walkTo(st, a, j.farm.house, x, y); return; }
    const [x, y] = workSpot(st, a, j);
    a.phase = 'go'; walkTo(st, a, j.site, x, y);
  }
  function release(st, a) { if (a.job) { a.job.claim = null; a.job = null; } a.phase = null; a.work = null; }
  function complete(st, a) {
    const j = a.job, E = st.ECON, hh = st.households[st.pawns[a.id].household], c = cal(st.t);
    switch (j.kind) {
      case 'plow': j.field.stage = 'plowed'; break;
      case 'sow':
        if (hh.grain >= E.seedPerField) {
          hh.grain -= E.seedPerField; j.field.stage = 'sown'; j.field.sown = c.day;
          j.field.weedOpen = false; j.field.weedPosted = null; j.field.weedMiss = 0;
        } break;
      case 'weed': j.field.weedOpen = false; break;
      case 'reap':
        j.field.stage = 'stooks'; j.field.reaped = c.day;
        j.field.held = Math.round(E.fieldYield * j.field.fert * st.weather * (0.9 + st.rand() * 0.2)
          * (1 - Math.min(E.weedCutMax, E.weedCut * j.field.weedMiss)));
        j.field.weedOpen = false; j.field.weedPosted = null; j.field.weedMiss = 0; break;
      case 'mend': j.stretch.cond = 1; j.stretch.dirty = true; break;
      case 'cook': hh.cookDay = c.day; break;
      case 'thresh': hh.grain += hh.unthreshed.shift() || 0; break;
    }
    st.jobs.delete(j.key);
  }
  function deposit(st, a) {
    const j = a.job, hh = st.households[st.pawns[a.id].household], f = st.farmsteads[hh.farmstead];
    if (j.kind === 'haul') {
      hh.unthreshed.push(j.field.held); hh.ledger.push({ t: st.t, kind: 'harvest', n: j.field.held });
      if (f.fields.every((q) => q.stage !== 'ripe' && q.stage !== 'stooks' || q === j.field)) log(st, `${f.name} has brought in its harvest.`);
      j.field.held = 0; j.field.stage = 'stubble'; j.field.sown = null;
    }
    if (j.kind === 'wood') { hh.wood += st.ECON.woodPerTrip; fellTree(st, j.farm); }
    if (j.kind === 'water') hh.waterDay = cal(st.t).day;
    st.jobs.delete(j.key);
    a.carry = null; a.job = null; a.phase = null;
  }
  const wantsWork = (st, a, c) => !a.path && a.phase === null && c.hour >= WORK[0] && c.hour < WORK[1] && a.idleUntil <= st.t;
  function idleAbout(st, a) {
    // nothing suitable: drift to the green or the yard, and look again in a while
    const p = st.pawns[a.id], f = st.farmsteads[st.households[p.household].farmstead];
    const v = st.villages[f.village], spot = v.green && st.rand() < 0.5 ? v.center : f.house;
    walkTo(st, a, spot, st.w.hx[spot] + (st.rand() - 0.5) * 26, st.w.hy[spot] + 6 + (st.rand() - 0.5) * 12);
    a.idleUntil = st.t + 0.75 + st.rand() * 1.25;
  }
  function arrived(st, a) {
    a.anim = 'idle';
    if (a.phase === 'go') {
      const K = KINDS[a.job.kind];
      a.phase = 'work'; a.anim = K.anim || 'idle'; a.inside = !!K.inside;
      if (K.field) { const th = a.job.farm.rowAngle; a.work = { s: -13, dir: 1, row: -12, th, cx: st.w.hx[a.job.site], cy: st.w.hy[a.job.site] }; }
    } else if (a.phase === 'back') deposit(st, a);
    else if (a.phase === 'home') { a.inside = true; a.phase = null; }
  }
  function goHome(st, a) {
    const f = st.farmsteads[st.households[st.pawns[a.id].household].farmstead], [x, y] = homeSpot(st, a);
    walkTo(st, a, f.house, x, y);
  }
  function stepWork(st, a, dt) {
    const j = a.job, K = KINDS[j.kind];
    j.done += dt * (1 - HUNGER.slow * st.pawns[a.id].hunger);
    if (a.work) {
      // walk the field row by row while working
      const wk = a.work, speed = j.kind === 'sow' ? 9 : 3.2;
      wk.s += wk.dir * speed * dt;
      if (wk.s > 13 || wk.s < -13) { wk.s = Math.max(-13, Math.min(13, wk.s)); wk.dir = -wk.dir; wk.row += 6; if (wk.row > 12) wk.row = -12; }
      const nx = wk.cx + Math.cos(wk.th) * wk.s - Math.sin(wk.th) * wk.row, ny = wk.cy + Math.sin(wk.th) * wk.s + Math.cos(wk.th) * wk.row;
      if (Math.abs(nx - a.x) > 0.01) a.face = nx > a.x ? 1 : -1;
      a.stride += Math.hypot(nx - a.x, ny - a.y) / 3.4;
      a.x = nx; a.y = ny;
    }
    if (j.done >= K.hours) {
      if (K.carry) {
        a.carry = K.carry; a.phase = 'back'; a.work = null;
        const f = st.farmsteads[st.households[st.pawns[a.id].household].farmstead];
        // sheaves go to the barn door, firewood to the woodpile, water into the cottage
        const hx = st.w.hx[f.house], hy = st.w.hy[f.house];
        const [x, y] = j.kind === 'water' ? homeSpot(st, a) : K.carry === 'logs' ? [hx + 7, hy + 16] : [hx - 3, hy - 9];
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
    let dist = SPEED * st.w.HW * dt * (a.carry ? 0.8 : 1);
    while (dist > 0 && a.seg < a.path.length - 1) {
      const [tx, ty] = a.path[a.seg + 1], dx = tx - a.x, dy = ty - a.y, d = Math.hypot(dx, dy);
      if (Math.abs(dx) > 0.3) a.face = dx > 0 ? 1 : -1;
      const m = Math.min(d, dist);
      a.stride += m / 3.4;
      if (d <= dist) { a.x = tx; a.y = ty; a.seg++; } else { a.x += (dx / d) * dist; a.y += (dy / d) * dist; }
      dist -= m;
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
    homeSpot, placeAtHome, tileAt, route, walkTo, workSpot, start, release, complete, deposit, wantsWork, idleAbout, arrived, goHome, stepWork,
    moveAgent, describe,
  };
})();
