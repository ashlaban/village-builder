// @sys page/animate: animating the settlement each frame: oxen at the plough, herds by the farm or out with their herder, the clock and the pawns
// ---- oxen at the plough (VB-138): the team walks ahead of its driver along the furrow, the ard's beam between them; and the cow being
// milked (VB-135) stands by the milker at the byre ----
function drawTeams(show) {
  const used = new Set();
  teamOut.clear();
  const c = Sim.cal(st.t);
  for (const a of st.agents) {
    if (!show || a.inside || !a.job || !(a.leg && a.leg.kind === 'work')) continue;
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
      sp.scale.set(-drawFacing[a.id] * COW_SCALE.cow, COW_SCALE.cow);
      sp.position.set(ax + drawFacing[a.id] * 8, ay - 1.5);
      sp.zIndex = ay - 1.5;
      e.g.clear();
      continue;
    }
    const dir = drawFacing[a.id],
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
// The led animal (VB-429): a pawn on the way home from fetching a cow (job `lead`, phase back, carry 'cow') has it on a halter, beside
// and a little behind it; which animal is the household's want (sim/exchange), the coat from the pawn. A pool, refilled each frame.
function drawLed(show) {
  const used = new Set();
  ledOut.clear();
  for (const a of st.agents) {
    if (!show || a.inside || a.carry !== 'cow' || !(a.load > 0) || !a.job || !rigs[a.id].root.visible) continue;
    const plan = st.plans.households.get(st.pawns[a.id].household),
      kind = plan && plan.want && plan.want.kind ? plan.want.kind : 'cow';
    used.add(a.id);
    // the animal is the first of its kind in the giver's herd, as sim/herds' giveAnimal takes it: until ledHome moves it, not drawn there too
    const giver = plan && plan.want && plan.want.from !== null ? st.households[plan.want.from] : null;
    if (giver)
      for (const hd of Sim.herdsOf(st, giver)) {
        const an = hd.head && hd.head.find((h) => h.kind === kind && !ledOut.has(h.id));
        if (an) {
          ledOut.add(an.id);
          break;
        }
      }
    let e = ledDraw.get(a.id);
    if (!e) {
      const sp = new PIXI.Sprite(art.cow[0][1]);
      sp.anchor.set(0.5, 0.92);
      L.objects.addChild(sp);
      e = { sp, g: new PIXI.Graphics() };
      L.objects.addChild(e.g);
      ledDraw.set(a.id, e);
    }
    const dir = drawFacing[a.id],
      x = drawX[a.id],
      y = drawY[a.id],
      sway = Math.sin(time * 3 + a.id) * 0.5,
      tex = art.cow[(hash(a.id * 7 + 3) * COATS.length) | 0][1];
    if (e.sp.texture !== tex) e.sp.texture = tex;
    e.sp.visible = true;
    e.sp.scale.set(dir * COW_SCALE[kind], COW_SCALE[kind]);
    e.sp.position.set(x - dir * 13, y + 2 + sway);
    e.sp.zIndex = y + 2;
    e.g
      .clear()
      .moveTo(x + dir * 1, y - 6)
      .lineTo(x - dir * 8, y - 3)
      .stroke({ width: 1, color: 0x5a4128 });
    e.g.zIndex = y + 2.1;
  }
  for (const [id, e] of ledDraw)
    if (!used.has(id)) {
      e.sp.visible = false;
      e.g.clear();
    }
}
// The carts (VB-410): a cart at home stands in the farm's yard, as many as the household has; one out is drawn with its pawn, behind it,
// with the load it carries and, for the ox cart, the team before it (the team leaves the byre meanwhile, as at the plough). Which is out
// is read as sim/carts reads it. A cart below the condition it is mended at is drawn worn. A pool of sprites, refilled each frame.
function cartSprite(n) {
  while (cartDraw.length <= n) {
    const sp = new PIXI.Sprite(art.cart.hand.none[0]);
    sp.anchor.set(0.5, 0.85);
    sp.visible = false;
    L.objects.addChild(sp);
    const oxen = [0, 1].map(() => {
      const o = new PIXI.Sprite(art.cow[0][1]);
      o.anchor.set(0.5, 0.92);
      o.visible = false;
      L.objects.addChild(o);
      return o;
    });
    cartDraw.push({ sp, oxen });
  }
  return cartDraw[n];
}
function drawCarts(show) {
  let n = 0;
  for (const h of houseInfo) {
    const hh = st.households[h.f.household];
    if (!hh || !hh.carts.length) continue;
    const hx = w.hx[h.f.house],
      hy = w.hy[h.f.house];
    let home = 0;
    for (const c of hh.carts) {
      const a = c.by === null ? null : st.agents[c.by],
        away = a && !a.inside && Carts.out(st, c) && rigs[a.id].root.visible,
        e = cartSprite(n++),
        worn = c.cond < Carts.CART.mendAt ? 1 : 0;
      for (const o of e.oxen) o.visible = false;
      if (!show) {
        e.sp.visible = false;
        continue;
      }
      e.sp.visible = true;
      if (!away && c.at) {
        // left standing where it was unhitched (sim/carts: a load left lying, or the move's cart at the landing, VB-1667)
        e.sp.texture = art.cart[c.kind].none[worn];
        e.sp.scale.set(CART_S);
        e.sp.position.set(c.at.x, c.at.y);
        e.sp.zIndex = c.at.y;
        continue;
      }
      if (!away) {
        const k = home++;
        e.sp.texture = art.cart[c.kind].none[worn];
        e.sp.scale.set(CART_S);
        e.sp.position.set(hx + YARD.cart[0] - (k % 3) * 12, hy + YARD.cart[1] + ((k / 3) | 0) * 5);
        e.sp.zIndex = e.sp.y;
        continue;
      }
      const dir = drawFacing[a.id],
        x = drawX[a.id],
        y = drawY[a.id],
        ox = c.kind === 'ox',
        load = a.carry === 'sheaf' || a.carry === 'hay' || a.carry === 'logs' ? a.carry : 'none';
      e.sp.texture = art.cart[c.kind][load][worn];
      e.sp.scale.set(dir * CART_S, CART_S);
      // the cart's far end (the shafts, or the yoke) is where the pawn's hand, or the team, is: the cart trails behind
      e.sp.position.set(x - dir * (ox ? 4 : 8), y + 1.5);
      e.sp.zIndex = y - 0.2;
      if (ox) {
        // the team walks ahead of the cart, the pawn at its flank
        const oxen = Sim.team(st, hh),
          sway = Math.sin(time * 3 + a.id) * 0.6;
        oxen.slice(0, 2).forEach((q, k) => {
          for (const t of [q.id]) teamOut.add(t);
          const o = e.oxen[k],
            tex = art.cow[(hash(q.id * 7 + 3) * COATS.length) | 0][1];
          if (o.texture !== tex) o.texture = tex;
          o.visible = true;
          o.scale.set(dir * COW_SCALE.ox, COW_SCALE.ox);
          o.position.set(x + dir * (11 + k * 2), y - 4 + k * 5 + sway);
          o.zIndex = y - 4 + k * 5;
        });
      }
    }
  }
  for (let k = n; k < cartDraw.length; k++) {
    cartDraw[k].sp.visible = false;
    for (const o of cartDraw[k].oxen) o.visible = false;
  }
}
function drawHerds(c, show) {
  const out = Sim.stalled(c) || c.hour < 6 || c.hour >= 20,
    [x0, y0, x1, y1] = viewRect(60);
  for (const hd of st.herds) {
    let e = herdSprites.get(hd.id);
    const gone = hd.household === null && hd.at === undefined; // emptied (a herd left with nobody stands at its farm; VB-674)
    const sig = gone ? '' : hd.head ? hd.head.map((h) => h.id + h.kind).join() : `${hd.ewes},${hd.rams},${hd.lambs}`;
    if (!e || e.sig !== sig) {
      if (e) for (const a of e.list) a.s.destroy();
      e = { sig, list: [] };
      for (const an of gone ? [] : herdAnimals(hd)) {
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
    const at = hr && !hr.path && hr.mind ? hr.mind[0].site : -1;
    // a herd left at the landing of a farm placed elsewhere stands there (herd.tile, VB-1667) until it is driven home
    const stand = hd.tile !== undefined ? hd.tile : hd.home,
      cx = at >= 0 ? w.hx[at] : hr ? drawX[hr.id] - drawFacing[hr.id] * 16 : w.hx[stand],
      cy = at >= 0 ? w.hy[at] : hr ? drawY[hr.id] + 3 : w.hy[stand];
    const on = show && !out && cx > x0 && cx < x1 && cy > y0 && cy < y1;
    for (const a of e.list) {
      a.s.visible = on && !teamOut.has(a.id) && !ledOut.has(a.id);
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
// fastest, on a lane) is drawn where it is. A pawn at work on a field walks its rows (VB-472): the simulation has it stand at the start of
// its first row, and the page walks it row by row from the tick its work began, at the drawn time. Page state only: nothing of it is
// written to st. ----
let drawX = new Float64Array(0),
  drawY = new Float64Array(0),
  drawStride = new Float64Array(0),
  drawFacing = new Float64Array(0);
const ROW_PACE = 3.2; // map units an hour along a field row, unless the kind sets its own pace
// The place on its rows of a pawn working a field at drawn tick `at`, [x, y, face, distance walked], or null: from the start of its row
// (where its work leg began, a.leg), along rows 26 units long and 6 apart, five across the tile, turning at each end.
function rowPlace(a, at) {
  const j = a.job,
    K = j && a.leg && a.leg.kind === 'work' && !a.inside && a.leg ? Sim.KINDS[j.kind] : null;
  if (!K || !K.field) return null;
  const th = VB['sim/fieldwork'].rowAngle(j),
    cx = w.hx[j.site],
    cy = w.hy[j.site],
    c = Math.cos(th),
    sn = Math.sin(th);
  const row0 = Math.round((-sn * (a.leg.x - cx) + c * (a.leg.y - cy) + 12) / 6),
    d = ((K.pace || ROW_PACE) * Math.max(0, at - a.leg.t)) / VB['sim/rules'].TICKS,
    k = Math.floor(d / 26),
    u = d - 26 * k,
    dir = k % 2 ? -1 : 1,
    along = dir > 0 ? -13 + u : 13 - u,
    row = -12 + 6 * ((((row0 + k) % 5) + 5) % 5);
  return [cx + c * along - sn * row, cy + sn * along + c * row, Math.abs(c) > 0.05 ? Math.sign(c * dir) : a.face, d];
}
const Carts = VB['sim/carts'],
  CART_S = ART_S * 1.3; // a cart is drawn a little over the scale of the farm art, to read at the zoom the yard is seen from
function placePawns() {
  const n = st.agents.length;
  if (drawX.length < n) {
    const cap = Math.max(64, n * 2);
    drawX = new Float64Array(cap);
    drawY = new Float64Array(cap);
    drawStride = new Float64Array(cap);
    drawFacing = new Float64Array(cap);
  }
  const at = st.tick + stepShare; // drawn along each walker's leg, ahead of the simulation by less than a step (VB-474)
  for (let i = 0; i < n; i++) {
    const a = st.agents[i],
      [x, y, face, stride] = Sim.poseOf(st, a, at); // a walker's place from its leg (VB-473)
    const rows = rowPlace(a, at);
    if (rows) {
      drawX[i] = rows[0];
      drawY[i] = rows[1];
      drawFacing[i] = rows[2];
      drawStride[i] = stride + rows[3] / 3.4;
      continue;
    }
    drawX[i] = x;
    drawY[i] = y;
    drawFacing[i] = face;
    drawStride[i] = stride;
  }
}
let tAcc = 0;
// The clock shown is the UI's own state: the time the simulation has reached (st.tick), floored to 5 game minutes, redrawn only when
// that value changes. The pawns are drawn up to a step ahead along their legs (VB-474), but the clock never shows a time the
// simulation has not reached (principle "The future is someone's estimate"): it is at most 5 minutes behind st.t, never ahead.
let uiClock = null,
  uiClockSt = null;
function updateClock() {
  const step = Math.floor((st.tick * 6) / 5 + 1e-9); // 5-minute steps from the clock's 6-minute ones (st.tick, VB-235)
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
  if (st.visualDirty || st.rigDirty.size || st.farmDirty.size || st.villageDirty.size) redrawSettlement(w);
  if (st.treeDirty.size || st.biomeDirty.size) refreshTrees();
  if (st.pathDirty.size) refreshPaths();
  refreshOverlays();
  for (const o of fieldSprites) {
    const s = fieldLook(o.fd);
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
    ageRig(R, pp); // hair greys and a beard comes with the years (VB-1029)
    const k = sizeAt(pp.age);
    // an idle pawn that stands talking faces the other
    const tk = a.talk,
      other = tk && !a.path && !a.job && st.t >= tk.at && st.t < tk.until ? st.agents[tk.with] : null;
    // a pawn fishing faces the water (VB-117)
    const wet =
      !a.path && a.leg && a.leg.kind === 'work' && a.job && a.job.water !== undefined
        ? w.hx[a.job.water] - drawX[a.id]
        : 0;
    const face =
      other && Math.abs(drawX[other.id] - drawX[a.id]) > 0.5
        ? Math.sign(drawX[other.id] - drawX[a.id])
        : Math.abs(wet) > 0.5
          ? Math.sign(wet)
          : drawFacing[a.id];
    const x = drawX[a.id],
      y = drawY[a.id];
    R.root.position.set(x, y);
    R.root.scale.set((face * PAWN_S * k) / PX, (PAWN_S * k) / PX);
    R.root.zIndex = y;
    // a pawn with a cart pushes or draws it: the load is on the cart, and both hands are on the shafts (VB-410)
    const cart = Carts.cartOf(st, st.households[pp.household], a.id);
    pose(R, cart ? { ...a, carry: null } : a, time, winter, drawStride[a.id]);
    if (cart) R.armF.rotation = R.armB.rotation = -0.9;
    // a dealer with its load for the fair (sim/fair's pawn.load) carries it on the road in a basket on its back, while it carries
    // nothing else; on the green it is set out (page/gathering, VB-303)
    else if (pp.load && a.path && !a.carry && !R.back.visible) {
      R.back.texture = atlas.basket;
      R.back.visible = true;
    }
  }
  drawTeams(show);
  drawCarts(show);
  drawLed(show);
  drawHerds(c, show);
  drawMoveLoads(); // the loads of a farm's move lying at its landing (page/settlement)
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
  drawGatherings(show); // a mark over each gathering that is on (VB-1032, page/gathering)
  drawToolMarks();
  drawPlanMarks();
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
    for (const a of st.agents)
      if (a.job && a.job.kind === 'burntar' && a.leg && a.leg.kind === 'work') burning.add(a.job.site);
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
      if (gatheringShown()) showGathering();
      else if (selPawn >= 0) showPawn(selPawn);
      else if (selVillage >= 0) showVillage(selVillage);
      else if (sel >= 0 && (selFarm >= 0 || w.treesMax[sel] > 0)) showTile(sel);
    }
  }
}
