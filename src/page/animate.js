// @sys page/animate: animating the settlement each frame: oxen at the plough, herds by the farm or out with their herder, the clock and the pawns
// ---- oxen at the plough (VB-138): the team walks ahead of its driver along the furrow, the ard's beam between them; and the cow being
// milked (VB-135) stands by the milker at the byre ----
function drawTeams(show) {
  const used = new Set();
  teamOut.clear();
  const c = Sim.cal(st.t);
  for (const a of st.agents) {
    if (!show || a.inside || !a.job || a.phase !== 'work') continue;
    const hh = st.households[st.pawns[a.id].household],
      milking = a.job.kind === 'milk';
    const oxen = milking
      ? Sim.herdsOf(st, hh)
          .flatMap((hd) => Sim.inMilk(st, hd, c))
          .slice(0, 1)
      : Sim.withOxen(st, a)
        ? Sim.team(st, hh)
        : null;
    if (!oxen || !oxen.length) continue;
    used.add(a.id);
    for (const h of oxen) teamOut.add(h.id);
    const ax = drawX[a.id],
      ay = drawY[a.id]; // where its driver is drawn (VB-244)
    let e = teamDraw.get(a.id);
    if (!e) {
      e = {
        oxen: [0, 1].map(() => {
          const sp = new PIXI.Sprite(art.cow[0][1]);
          sp.anchor.set(0.5, 0.92);
          L.objects.addChild(sp);
          return sp;
        }),
        g: new PIXI.Graphics(),
      };
      L.objects.addChild(e.g);
      teamDraw.set(a.id, e);
    }
    if (milking) {
      // the cow stands side on just beyond the milker, chewing, head now down, now up
      const sp = e.oxen[0],
        tex = art.cow[(hash(oxen[0].id * 7 + 3) * COATS.length) | 0][Math.sin(time * 0.5 + a.id) > 0.3 ? 1 : 0];
      for (const q of e.oxen) q.visible = false;
      if (sp.texture !== tex) sp.texture = tex;
      sp.visible = true;
      sp.scale.set(-a.face * COW_SCALE.cow, COW_SCALE.cow);
      sp.position.set(ax + a.face * 8, ay - 1.5);
      sp.zIndex = ay - 1.5;
      e.g.clear();
      continue;
    }
    const dir = a.face,
      sway = Math.sin(time * 3 + a.id) * 0.6;
    oxen.forEach((h, k) => {
      const sp = e.oxen[k],
        tex = art.cow[(hash(h.id * 7 + 3) * COATS.length) | 0][1];
      if (sp.texture !== tex) sp.texture = tex;
      sp.visible = true;
      sp.scale.set(dir * COW_SCALE.ox, COW_SCALE.ox);
      sp.position.set(ax + dir * (21 + k * 2), ay - 3 + k * 5 + sway);
      sp.zIndex = ay - 3 + k * 5;
    });
    e.g
      .clear()
      .moveTo(ax + dir * 2, ay - 8)
      .lineTo(ax + dir * 12, ay - 6)
      .stroke({ width: 1.1, color: 0x5a4128 });
    e.g.zIndex = ay + 0.1;
  }
  for (const [id, e] of teamDraw)
    if (!used.has(id)) {
      for (const sp of e.oxen) sp.visible = false;
      e.g.clear();
    }
}
function drawHerds(c, show) {
  const out = Sim.stalled(c) || c.hour < 6 || c.hour >= 20,
    [x0, y0, x1, y1] = viewRect(60);
  for (const hd of st.herds) {
    let e = herdSprites.get(hd.id);
    const sig =
      hd.household === null
        ? ''
        : hd.head
          ? hd.head.map((h) => h.id + h.kind).join()
          : `${hd.ewes},${hd.rams},${hd.lambs}`;
    if (!e || e.sig !== sig) {
      if (e) for (const a of e.list) a.s.destroy();
      e = { sig, list: [] };
      for (const an of hd.household === null ? [] : herdAnimals(hd)) {
        const s = new PIXI.Sprite(an.cow !== undefined ? art.cow[an.cow][0] : art.sheep[0]);
        s.anchor.set(0.5, 0.92);
        s.scale.set(an.sc);
        if (an.tint !== undefined) s.tint = an.tint;
        const r = 4 + hash(an.key) * 10,
          a = hash(an.key + 11) * 6.283;
        e.list.push({
          s,
          id: an.id,
          ox: Math.cos(a) * r,
          oy: Math.sin(a) * r * 0.6,
          ph: hash(an.key + 5) * 6.283,
          sc: an.sc,
          cow: an.cow,
        });
        L.objects.addChild(s);
      }
      herdSprites.set(hd.id, e);
    }
    // out with a herder (VB-136): at its heels on the way, on the pasture while it minds them there, else by the farm
    const hr = hd.herder !== null && st.agents[hd.herder] && !st.agents[hd.herder].inside ? st.agents[hd.herder] : null;
    const at = hr && !hr.path && hr.side && hr.side.background ? hr.side.background.site : -1;
    const cx = at >= 0 ? w.hx[at] : hr ? drawX[hr.id] - hr.face * 16 : w.hx[hd.home],
      cy = at >= 0 ? w.hy[at] : hr ? drawY[hr.id] + 3 : w.hy[hd.home];
    const on = show && !out && cx > x0 && cx < x1 && cy > y0 && cy < y1;
    for (const a of e.list) {
      a.s.visible = on && !teamOut.has(a.id);
      if (!a.s.visible) continue; // oxen at the plough are drawn with their driver
      const u = time * 0.06 + a.ph,
        x = cx + a.ox + Math.sin(u) * 4,
        y = cy + a.oy + Math.cos(u * 0.7) * 1.6;
      const look = Math.sin(time * 0.25 + a.ph * 3) > 0.75 ? 1 : 0,
        tex = a.cow !== undefined ? art.cow[a.cow][look] : art.sheep[look];
      if (a.s.texture !== tex) a.s.texture = tex;
      a.s.position.set(x, y);
      a.s.zIndex = y;
      a.s.scale.set(Math.cos(u) >= 0 ? a.sc : -a.sc, a.sc);
    }
  }
}
// ---- where each pawn is drawn this frame (VB-244): between its place before the last step (page/speed) and its own, by the share of
// the next step the frames have asked for; a pawn that went indoors, came out or was placed (moved more than a step's walk at the
// fastest, on a lane) is drawn where it is. Page state only: nothing of it is written to st. ----
let drawX = new Float64Array(0),
  drawY = new Float64Array(0),
  drawStride = new Float64Array(0);
function placePawns() {
  const n = st.agents.length,
    R = VB['sim/rules'];
  if (drawX.length < n) {
    const cap = Math.max(64, n * 2);
    drawX = new Float64Array(cap);
    drawY = new Float64Array(cap);
    drawStride = new Float64Array(cap);
  }
  const s = drawingBetween() ? stepShare : 1,
    far = ((R.SPEED * w.HW) / R.TICKS / R.ROUTE.minStep) * 1.01 + 1e-6,
    far2 = far * far;
  for (let i = 0; i < n; i++) {
    const a = st.agents[i];
    let x = a.x,
      y = a.y,
      stride = a.stride || 0;
    if (s < 1 && i < prevN && !prevIn[i] && !a.inside) {
      const dx = a.x - prevX[i],
        dy = a.y - prevY[i];
      if (dx * dx + dy * dy <= far2) {
        x = prevX[i] + dx * s;
        y = prevY[i] + dy * s;
        stride = prevStride[i] + (stride - prevStride[i]) * s;
      }
    }
    drawX[i] = x;
    drawY[i] = y;
    drawStride[i] = stride;
  }
}
let tAcc = 0;
// The clock shown is the UI's own state: the time the pawns are drawn at, floored to 5 game minutes, redrawn only when that value
// changes. While the pawns are drawn between steps (VB-244) that is the step before the last and the share of a step gone, so the
// clock moves smoothly with them, at most a step behind st.t; otherwise it is st.t.
let uiClock = null,
  uiClockSt = null;
function updateClock() {
  const drawn = drawingBetween() ? st.tick - 1 + stepShare : st.tick;
  const step = Math.floor((drawn * 6) / 5 + 1e-9); // 5-minute steps from the clock's 6-minute ones (st.tick, VB-235)
  if (step === uiClock && st === uiClockSt) return;
  uiClock = step;
  uiClockSt = st;
  const c = Sim.cal(step / 12),
    minutes = (((step * 5) % 1440) + 1440) % 1440;
  dayLight.style.opacity = (0.4 * lightAt(minutes / 60, c)).toFixed(3);
  $('clockDate').textContent =
    `${Sim.SEASONS[c.season][0].toUpperCase() + Sim.SEASONS[c.season].slice(1)}, day ${c.sday + 1}`;
  $('clockYear').textContent =
    `Year ${c.year}, ${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}
function updateSettlement(dt) {
  if (!st) return;
  if (!simulationAway()) advanceSimulation(dt);
  updateClock();
  updateNotices(dt);
  if (st.visualDirty || st.rigDirty.size) buildFarms(w);
  if (st.treeDirty.size) refreshTrees();
  if (st.pathDirty.size) refreshPaths();
  if (landOn || st.landDirty.size) refreshLand();
  refreshGround();
  for (const o of fieldSprites) {
    const s = cropStage(o.fd);
    if (s !== o.stage) {
      o.stage = s;
      o.sp.texture = fieldTex[s];
    }
    const on = o.fd.stage === 'stooks';
    if (o.stooks[0].visible !== on) for (const sk of o.stooks) sk.visible = on;
  }
  for (const o of meadowSprites)
    if (o.m.stage !== o.stage) {
      o.stage = o.m.stage;
      o.sp.texture = fieldTex['meadow-' + o.stage];
    }
  for (const f of fences)
    if (f.s.dirty) {
      drawFence(f.g, f.s);
      f.s.dirty = false;
    }
  const c = Sim.cal(st.t),
    show = cam.z > 0.28,
    winter = c.season === 3;
  placePawns();
  for (const a of st.agents) {
    const R = rigs[a.id];
    const pp = st.pawns[a.id];
    R.root.visible = show && !a.inside && pp.died === null;
    if (!R.root.visible) continue;
    const k = sizeAt(pp.age);
    // an idle pawn that stands talking faces the other
    const tk = a.talk,
      other = tk && !a.path && !a.job && st.t >= tk.at && st.t < tk.until ? st.agents[tk.with] : null;
    // a pawn fishing faces the water (VB-117)
    const wet = !a.path && a.phase === 'work' && a.job && a.job.water !== undefined ? w.hx[a.job.water] - a.x : 0;
    const face =
      other && Math.abs(other.x - a.x) > 0.5 ? Math.sign(other.x - a.x) : Math.abs(wet) > 0.5 ? Math.sign(wet) : a.face;
    const x = drawX[a.id],
      y = drawY[a.id];
    R.root.position.set(x, y);
    R.root.scale.set((face * PAWN_S * k) / PX, (PAWN_S * k) / PX);
    R.root.zIndex = y;
    pose(R, a, time, winter, drawStride[a.id]);
  }
  drawTeams(show);
  drawHerds(c, show);
  drawDeer(c, show); // roe deer at the forest edges in the twilight (VB-139, page/deer)
  ring.clear();
  if (selPawn >= 0 && rigs[selPawn].root.visible) {
    const x = drawX[selPawn],
      y = drawY[selPawn];
    ring.ellipse(x, y + 0.5, 6.5, 2.6).stroke({ width: 1.4 / Math.max(cam.z, 0.6), color: 0xffffff, alpha: 0.95 });
    ring.zIndex = y - 0.5;
  }
  drawTalk(show);
  drawLens();
  drawPlayMark();
  drawToolMarks();
  offerSuccession();
  // The hearth is lit while someone cooks and, where there is wood, in the evening until bedtime, round daybreak, and all through the
  // winter; it is banked for the night otherwise. A lit hearth sends smoke out of the smoke hole, and after dark its light shows.
  const fireHours =
    (c.hour >= Sim.WORK[1] - 1 && c.hour < 22) || (c.hour >= Sim.WORK[0] - 1 && c.hour < Sim.WORK[0] + 1);
  const night = lightAt(c.hour, c),
    ease = Math.min(1, dt * 1.5),
    near = cam.z > 0.3;
  const cooks = new Set(); // households with someone cooking inside: one pass over the agents, not one per house
  for (const a of st.agents) if (a.job && a.job.kind === 'cook' && a.inside) cooks.add(st.pawns[a.id].household);
  for (const h of houseInfo) {
    const hh = st.households[h.f.household];
    if (!hh) continue;
    const cooking = cooks.has(hh.id);
    const fireLit = cooking || (hh.wood > 0.5 && (winter || fireHours));
    h.smoke += ((fireLit ? 0.55 + (cooking ? 0.3 : 0) + (winter ? 0.15 : 0) : 0) - h.smoke) * ease;
    h.fire += ((fireLit ? night : 0) - h.fire) * ease;
    const smoking = near && h.smoke > 0.02;
    h.puffs.forEach((p, k) => {
      p.visible = smoking;
      if (!smoking) return;
      const ph = (time * 0.16 + k / h.puffs.length + h.f.id * 0.37) % 1;
      p.position.set(h.cx + ph * 9 + Math.sin(ph * 6 + k) * 1.4, h.cy - ph * 20);
      p.scale.set(0.09 + ph * 0.24);
      p.alpha = Math.min(0.95, (1 - ph * ph) * 2.2 * h.smoke * (ph < 0.1 ? ph * 10 : 1));
    });
    const glowing = near && h.fire > 0.02,
      flicker = reduceMotion ? 1 : 0.86 + 0.14 * Math.sin(time * 7 + h.f.id * 1.7) * Math.sin(time * 2.3 + h.f.id);
    if (h.lit) {
      h.lit.visible = glowing;
      h.lit.alpha = h.fire;
    }
    h.glow.visible = glowing;
    h.glow.alpha = h.fire * 0.75 * flicker;
    const level = hh.wood <= 0.5 ? 0 : hh.wood < 10 ? 1 : hh.wood < 22 ? 2 : 3;
    if (h.wood.texture !== art.wood[level]) h.wood.texture = art.wood[level];
    if (h.stack) {
      const need = Sim.winterNeed(st, hh),
        k = hh.hay <= 0.5 ? 0 : !need || hh.hay >= 0.75 * need ? 3 : hh.hay >= 0.33 * need ? 2 : 1;
      if (h.stack.texture !== art.haystack[k]) h.stack.texture = art.haystack[k];
    }
    if (h.heap) {
      const n = hh.manure || 0,
        k = n < 4 ? 0 : n < 10 ? 1 : 2;
      h.heap.visible = n >= 0.5;
      if (h.heap.texture !== art.manure[k]) h.heap.texture = art.manure[k];
    }
  }
  // the tar pits smoke while someone burns tar at them (VB-301)
  if (pitInfo.length) {
    const burning = new Set();
    for (const a of st.agents) if (a.job && a.job.kind === 'burntar' && a.phase === 'work') burning.add(a.job.site);
    for (const q of pitInfo) {
      q.smoke += ((burning.has(q.tile) ? 0.9 : 0) - q.smoke) * ease;
      const on = near && q.smoke > 0.02;
      q.puffs.forEach((p, k) => {
        p.visible = on;
        if (!on) return;
        const ph = (time * 0.12 + k / q.puffs.length + q.tile * 0.13) % 1;
        p.position.set(q.x + ph * 7 + Math.sin(ph * 5 + k) * 1.6, q.y - ph * 26);
        p.scale.set(0.12 + ph * 0.32);
        p.alpha = Math.min(0.95, (1 - ph * ph) * 2 * q.smoke * (ph < 0.1 ? ph * 10 : 1));
      });
    }
  }
  for (const l of labels) {
    l.t.scale.set(0.55 / cam.z);
    l.t.position.set(l.x, l.y);
    l.t.alpha = clamp((1.5 - cam.z) / 0.5, 0, 1);
    l.t.visible = l.t.alpha > 0.01;
  }
  tAcc += dt;
  if (tAcc > 0.25) {
    tAcc = 0;
    if (!$('settlers').hidden) renderSettlers();
    if (drawerTab) renderDrawer();
    if (st) renderActions();
    if (activePanel === 'tile' && !document.body.classList.contains('ui-hidden')) {
      if (selPawn >= 0) showPawn(selPawn);
      else if (selVillage >= 0) showVillage(selVillage);
      else if (sel >= 0 && (selFarm >= 0 || w.treesMax[sel] > 0)) showTile(sel);
    }
  }
}
