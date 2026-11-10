// @sys page/talk: the settlement layer's state, talk bubbles on the map (VB-061) and the selected pawn's lens
  // ======== settlement layer ========
  let st = null, speed = 1, selPawn = -1;
  const HOUR_SECONDS = 2; // one game day lasts 48 seconds at 1x
  let fieldTex = null, art = null;
  let fieldSprites = [], rigs = [], houseInfo = [], fences = [], labels = [], meadowSprites = [];
  let herdSprites = new Map(); // herd id -> {sig, list of {s, ox, oy, ph, k}}; rebuilt only when the herd changes (see drawHerds)
  let teamDraw = new Map(); const teamOut = new Set(); // oxen at the plough (drawTeams): driver's pawn id -> {oxen: [sprites], g}; oxen out
  const ring = new PIXI.Graphics();
  const PAWN_S = 0.68; // a grown pawn's size on the map, against the rig's own
  const sizeAt = (age) => (age < 6 ? 0.55 : age < 10 ? 0.66 : age < 14 ? 0.8 : age < 17 ? 0.93 : 1); // children are smaller

  // ---- talk on the map (VB-061): a bubble over each pawn talking on screen, a chat faint; the lens of the selected pawn ----
  const lens = new PIXI.Graphics(), bubbles = new PIXI.Container(), bubblePool = [];
  L.hover.addChild(lens); L.hover.addChild(bubbles);
  let bubbleTex = null;
  function bubbleCanvas(kind) {
    const c = makeCanvas(40, 34), g = c.getContext('2d'), cross = kind === 'crossWords';
    g.beginPath(); g.moveTo(12, 3); g.arcTo(37, 3, 37, 25, 9); g.arcTo(37, 25, 3, 25, 9); g.lineTo(19, 25); g.lineTo(9, 32); g.lineTo(11, 25);
    g.arcTo(3, 25, 3, 3, 9); g.arcTo(3, 3, 37, 3, 9); g.closePath();
    g.fillStyle = cross ? '#f2d6c0' : '#f6eed8'; g.fill(); g.lineWidth = 2.6; g.lineJoin = 'round'; g.strokeStyle = '#2c201c'; g.stroke();
    g.fillStyle = kind === 'chat' ? '#2c201c' : cross ? '#a03c28' : '#4c7a44';
    if (kind === 'chat') for (const x of [12, 20, 28]) { g.beginPath(); g.arc(x, 14, 2.4, 0, Math.PI * 2); g.fill(); }
    else { g.font = 'bold 19px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(cross ? '!' : '♪', 20, 15); }
    return c;
  }
  // a talk shows from `at` to `until`, fading in and out over its first and last sixth
  function drawTalk(show) {
    if (!bubbleTex) bubbleTex = Object.fromEntries(['chat', 'goodTalk', 'crossWords'].map((k) => [k, texFrom(bubbleCanvas(k), { autoGenerateMipmaps: true })]));
    const [x0, y0, x1, y1] = viewRect(20);
    let n = 0;
    if (show) for (const a of st.agents) {
      const tk = a.talk;
      if (!tk || st.t < tk.at || st.t >= tk.until || !rigs[a.id].root.visible || a.x < x0 || a.x > x1 || a.y < y0 || a.y > y1) continue;
      let b = bubblePool[n];
      if (!b) { b = new PIXI.Sprite(bubbleTex.chat); b.anchor.set(0.25, 1); bubbles.addChild(b); bubblePool.push(b); }
      const f = clamp(Math.min(st.t - tk.at, tk.until - st.t) / ((tk.until - tk.at) / 6), 0, 1);
      b.texture = bubbleTex[tk.kind]; b.alpha = (tk.kind === 'chat' ? 0.5 : 0.95) * f; b.visible = true;
      b.position.set(a.x + 1.5, a.y - 22 * PAWN_S * sizeAt(st.pawns[a.id].age)); b.scale.set(0.25);
      n++;
    }
    for (let i = n; i < bubblePool.length; i++) bubblePool[i].visible = false;
  }
  // The selected pawn's lens: a line to each of the 20 people it knows best, where they are (at home: their house); green for liked,
  // red for disliked, stronger for a closer tie.
  function drawLens() {
    lens.clear();
    if (selPawn < 0 || !rigs[selPawn] || !rigs[selPawn].root.visible) return;
    const a = st.agents[selPawn], z = Math.max(cam.z, 0.6);
    for (const x of Sim.relationsOf(st, selPawn).slice(0, 20)) {
      const b = st.agents[x.id], f = farmOf(st.pawns[x.id]);
      if (b.inside && !f) continue;
      const bx = b.inside ? w.hx[f.house] : b.x, by = b.inside ? w.hy[f.house] : b.y - 6, s = Math.min(1, x.tie / 10);
      const col = x.opinion >= 0.25 ? 0x3f9a5c : x.opinion <= -0.2 ? 0xc8553d : 0xf2ead8;
      lens.moveTo(a.x, a.y - 6).lineTo(bx, by).stroke({ width: (1 + 1.5 * s) / z, color: col, alpha: 0.35 + 0.5 * s });
      lens.ellipse(bx, by, 2.4 / z, 2.4 / z).fill({ color: col, alpha: 0.8 });
    }
  }

