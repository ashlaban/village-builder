// @sys page/settlement: building the settlement layer: farms, pawns, labels, booths, fences and herd sprites
// World units per art unit, and where a farm's buildings stand from the centre of its house tile: [x, y of the foot]. The yard is one
// hex, so the byre and the barn stand at the back, the storehouse and the cottage before them, and the piles in the corners left.
const ART_S = 0.2;
const YARD = {
  byre: [-10, -3],
  lada: [6, -1],
  barn: [19, -6], // the second barn a household builds as a project (VB-255), behind the storehouse
  harbre: [14, 7],
  stuga: [-4, 14],
  wood: [10, 15],
  stack: [-14.5, 10.5],
  heap: [-17.5, -1],
  curb: [1, 19],
  booth: [10, 6],
  cart: [-3, 21],
};
const INK = 0x2c201c; // the contour of what is drawn straight onto the map, as MP.line of the farm art
const place = (tex, x, y, ax, ay, layer = L.objects, sc = ART_S) => {
  const s = new PIXI.Sprite(tex);
  s.anchor.set(ax, ay);
  s.scale.set(sc);
  s.position.set(x, y);
  s.zIndex = y;
  layer.addChild(s);
  return s;
};

function clearSettlement() {
  labelsReady = false;
  // the selection ring is shared across settlements and re-added later, so it must survive the clean-up
  for (const s of [
    ...L.fields.removeChildren(),
    ...L.fences.removeChildren(),
    ...L.objects.removeChildren(),
    ...L.labels.removeChildren(),
  ])
    // the move's loads and the green's loads (page/gathering) too: kept, and re-added (buildFarms)
    if (s !== ring && s !== moveG && s !== greenG) s.destroy({ children: true, context: true });
  selPawn = -1;
  selVillage = -1;
  selFarm = -1;
  clearPortraits();
  fieldSprites = [];
  rigs = [];
  houseInfo = [];
  pitInfo = [];
  fences = [];
  labels = [];
  herdSprites = new Map();
  deerSprites = [];
  meadowSprites = [];
  teamDraw = new Map();
  cartDraw = [];
  ledDraw = new Map();
}
async function buildSettlement(wd, s) {
  clearSettlement();
  st = s;
  if (!st) return;
  if (!art) makeArt(wd.R);
  buildFarms(wd);
  try {
    await Promise.race([document.fonts.load('italic 700 30px Alegreya'), new Promise((r) => setTimeout(r, 1500))]);
  } catch (e) {
    /* the fallback font is fine */
  }
  if (st !== s) return; // another settlement was built while the font loaded
  labelsReady = true;
  buildLabels(wd);
}
// Map labels: a village of two or more farms (or with a green) by its name, at its centre; a lone farm by its farm's name, at the house
// (a one-farm village bears its farm's name, unique on the island; VB-026). Rebuilt when villages or farm names change (settlers found
// villages and join them in play; VB-148), or a village lays out its green (its label moves there, larger; VB-058), once the label font
// has loaded.
let labelsReady = false,
  labelSig = '';
const byName = (v) => v.green || v.farmsteads.length >= 2;
const labelSigOf = () =>
  st.villages
    .map((v) =>
      byName(v)
        ? `${v.name}@${v.center}${v.green ? 'g' : ''}:${v.farmsteads.length}`
        : v.farmsteads.map((id) => st.farmsteads[id].name).join('|'),
    )
    .join('/');
function buildLabels(wd) {
  for (const t of L.labels.removeChildren()) t.destroy();
  labels = [];
  labelSig = labelSigOf();
  const mkLabel = (text, x, y, size, of) => {
    // `of` names what the label stands for, for a click on it
    const t = new PIXI.Text({
      text,
      style: {
        fontFamily: 'Alegreya, Georgia, serif',
        fontStyle: 'italic',
        fontWeight: '700',
        fontSize: size,
        fill: 0xfff4e2,
        stroke: {
          color: 0x1a2e2a,
          width: size / 6,
          join: 'round',
        },
      },
      resolution: 2,
    });
    t.anchor.set(0.5, of.below ? 0 : 1);
    L.labels.addChild(t);
    labels.push({ t, x, y, ...of });
  };
  // Is a house of village v on the row of tiles `row` rows from its centre (-1 above, 1 below, -2 two above), within `wide` tile
  // radii to either side: where its name would lie over the house?
  const houseOn = (v, row, wide) =>
    v.farmsteads.some((id) => {
      const h = st.farmsteads[id].house;
      return (
        Math.abs(wd.hx[h] - wd.hx[v.center]) < wd.R * wide &&
        Math.abs(wd.hy[h] - wd.hy[v.center] - row * 1.5 * wd.R) < wd.R * 0.5
      );
    });
  for (const v of st.villages) {
    if (byName(v)) {
      // the name over the centre; where a house stands on the row above, under the centre, or with a house there too, raised over
      // that row: so that the name and a farm (and its mark, when it is chosen: page/choose) do not hide each other (VB-1027)
      const up = houseOn(v, -1, 1.5),
        below = up && !houseOn(v, 1, 1.5),
        raised = up && !below && !houseOn(v, -2, 1);
      mkLabel(
        v.name,
        wd.hx[v.center],
        wd.hy[v.center] + wd.R * (below ? 1.2 : raised ? -2.6 : -1.7),
        v.green ? 30 : 26,
        {
          village: v.id,
          below,
        },
      );
    } else
      for (const id of v.farmsteads) {
        const f = st.farmsteads[id];
        mkLabel(f.name, wd.hx[f.house], wd.hy[f.house] - wd.R * 1.5, 24, { farm: f.id });
      }
  }
}
// A cottage in building, by stage: foundation stones, the log walls rising, then the turf roof.
function cottageStage(g, x, y, n) {
  if (n >= 1)
    for (const [dx, dy] of [
      [-8, 3],
      [-3, 5],
      [3, 5],
      [8, 3],
      [-8, -2],
      [8, -2],
    ])
      g.ellipse(x + dx, y + dy, 2.6, 1.7)
        .fill(0xdad2c2)
        .stroke({
          width: 0.6,
          color: INK,
        });
  if (n >= 2)
    for (let k = 0; k < 3; k++)
      g.roundRect(x - 8.5, y - 5.4 + k * 2.8, 17, 2.8, 1.1)
        .fill(0xdeac58)
        .stroke({ width: 0.6, color: INK });
  if (n >= 3)
    g.poly([x - 10.5, y - 5, x - 7, y - 12.5, x + 7, y - 12.5, x + 10.5, y - 5])
      .fill(0x7aa258)
      .stroke({ width: 0.9, color: INK, join: 'round' });
}
// The booth's tent itself, of leaning poles and bark: one presentation for the settlers' booth by their house tile and a booth that stands
// by itself on a tile (VB-784).
function tent(g, bx, by) {
  for (const dx of [-2.4, 0, 2.4])
    g.moveTo(bx + dx, by - 11)
      .lineTo(bx + dx * 2.6, by - 15)
      .stroke({ width: 1.5, color: INK })
      .moveTo(bx + dx, by - 11)
      .lineTo(bx + dx * 2.6, by - 15)
      .stroke({ width: 0.7, color: 0x96462f });
  g.poly([bx - 7.5, by, bx, by - 12, bx + 7.5, by])
    .fill(0xcc9a58)
    .stroke({ width: 0.9, color: INK, join: 'round' });
  for (const dx of [-3.6, 3.6])
    g.moveTo(bx + dx, by - 0.6)
      .lineTo(bx + dx * 0.25, by - 9.5)
      .stroke({ width: 0.5, color: INK, alpha: 0.5 });
  g.poly([bx - 1.9, by, bx - 1.2, by - 5.4, bx + 1.2, by - 5.4, bx + 1.9, by]).fill(0x30241f); // the opening
}
// A settlers' booth (bod) of leaning poles and bark by the house tile, and beside it the cottage by stage, as on a plot: foundation stones,
// rising log walls, the turf roof; a ring while the work goes on (VB-148).
// The cottage plan of farm f's settlers (sim/cottageplan's cottagePlan): its household's, or its village's while the farm waits for a
// household (sim/plans' dropAll), or undefined.
function boothCottage(f) {
  const P = VB['sim/projects'],
    mine = (p) => p.what === 'cottage' && p.farmstead === f.id;
  return (
    (f.household !== null && P.projectsOf(st, 'household', f.household).find(mine)) ||
    P.projectsOf(st, 'village', f.village).find(mine)
  );
}
// A camp (farmstead.camp, VB-1655: the settler who plans by hand lands with nothing built): the goods landed on the house tile, a
// covered pile of sacks and a chest beside a ring of hearth stones, and nothing standing; the shelter's poles come when it is staked
// on the tile (VB-1666), the pile then moved aside for them.
const CAMP_AT = [3, 6]; // the pile, from the tile's middle; the hearth to its left
const campAt = (f) => (f.shelter ? [CAMP_AT[0] - 5, CAMP_AT[1] + 4] : CAMP_AT);
function drawCamp(wd, f) {
  const x = wd.hx[f.house] + campAt(f)[0],
    y = wd.hy[f.house] + campAt(f)[1],
    g = new PIXI.Graphics(),
    line = { width: 0.8, color: INK, join: 'round' };
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2;
    g.ellipse(x - 13 + Math.cos(a) * 3.4, y - 1 + Math.sin(a) * 2, 1.3, 0.9)
      .fill(0xb9b2a4)
      .stroke({ width: 0.4, color: INK });
  }
  g.roundRect(x + 1.5, y - 5.5, 8, 5.5, 0.8)
    .fill(0x8a5a36)
    .stroke(line); // the chest
  g.moveTo(x + 1.5, y - 3.6)
    .lineTo(x + 9.5, y - 3.6)
    .stroke({ width: 0.5, color: INK });
  for (const [dx, dy, s] of [
    [-6, 0, 1],
    [-1.5, 0.6, 0.9],
    [-3.8, -4, 0.85],
  ])
    g.ellipse(x + dx, y + dy - 2.6 * s, 3 * s, 3.2 * s)
      .fill(0xd9c79c)
      .stroke(line); // the sacks
  g.poly([x - 9.5, y + 0.5, x - 7.5, y - 6, x - 2, y - 8.5, x + 0.5, y - 4.5, x + 0.5, y + 0.8])
    .fill({ color: 0x6f7c55, alpha: 0.9 })
    .stroke(line); // the cover
  g.zIndex = y + 1;
  L.objects.addChild(g);
}
// A shelter (or a booth) staked and not yet raised: its poles stand, leaning together, with no cover on them.
function stakedPoles(g, bx, by) {
  for (const [a, b] of [
    [-7, 3],
    [7, -3],
    [-2.5, 1.5],
    [2.5, -1.5],
  ])
    g.moveTo(bx + a, by)
      .lineTo(bx + b * 0.4, by - 13.5)
      .stroke({ width: 1.6, color: INK })
      .moveTo(bx + a, by)
      .lineTo(bx + b * 0.4, by - 13.5)
      .stroke({ width: 0.8, color: 0x96462f });
  g.ellipse(bx, by, 8.5, 2.4).stroke({ width: 0.7, color: INK, alpha: 0.45 });
}
// The move of a farm placed off its landing (VB-1667): the loads left lying at the landing, marked `of.moving`, drawn as the camp's pile
// was, smaller as they are fetched; one Graphics, redrawn only when what lies changes (each frame, page/animate).
const moveG = new PIXI.Graphics();
let moveKey = '';
function drawMoveLoads() {
  const lying = (st.lying || []).filter((x) => x.of && x.of.moving),
    key = lying.map((x) => `${x.kind}${Math.ceil(x.n)}@${x.tile}`).join();
  if (key === moveKey) return;
  moveKey = key;
  moveG.clear();
  const line = { width: 0.8, color: INK, join: 'round' },
    clamp1 = (v, a, b) => Math.max(a, Math.min(b, v));
  for (const x of lying) {
    const px = x.x,
      py = x.y;
    if (x.kind === 'hay')
      moveG
        .ellipse(
          px,
          py - 4 * clamp1(Math.sqrt(x.n / 500), 0.45, 1),
          9 * clamp1(Math.sqrt(x.n / 500), 0.45, 1),
          6 * clamp1(Math.sqrt(x.n / 500), 0.45, 1),
        )
        .fill(0xd9b44a)
        .stroke(line);
    else if (x.kind === 'leftTimber')
      for (let k = 0; k < clamp1(Math.ceil(x.n / 40), 1, 4); k++)
        moveG
          .roundRect(px - 7 + (k % 2) * 2, py - 3 - k * 2.6, 14, 2.6, 1.2)
          .fill(0x9a6a3e)
          .stroke({ width: 0.6, color: INK });
    else if (x.kind === 'leftGrain' || x.kind === 'grain')
      for (let k = 0; k < clamp1(Math.ceil(x.n / 20), 1, 4); k++)
        moveG
          .ellipse(px - 6 + k * 3.6, py - 2.6 - (k % 2) * 2, 2.8, 3)
          .fill(0xd9c79c)
          .stroke(line);
    else if (x.kind !== 'leftCart')
      moveG
        .roundRect(px - 3, py - 4, 6, 4, 0.8)
        .fill(0x8a5a36)
        .stroke(line);
  }
  moveG.zIndex = lying.length ? Math.max(...lying.map((x) => x.y)) + 1 : 0;
}
// A building record stands (farmstead.barn, farmstead.byre: {built}); `true` in a save older than the record.
const hasBuilt = (x) => !!x && (typeof x !== 'object' || (x.built !== null && x.built !== undefined));
function drawBooth(wd, f, empty) {
  const x = wd.hx[f.house],
    y = wd.hy[f.house],
    g = new PIXI.Graphics(),
    n = boothCottage(f) ? boothCottage(f).open : 0, // the stages done
    bx = x + YARD.booth[0],
    by = y + YARD.booth[1];
  // the shelter on the house tile (VB-1666): poles while it is raised, the tent once it stands, worn as a booth wears; an older save's
  // farm booth: the tent here as before, or (a farm landed by hand) on its own tile beside the house (drawBooths)
  const sh = f.shelter;
  if (sh && sh.built === null) stakedPoles(g, bx, by);
  else if (sh || f.camp === undefined) {
    const t = new PIXI.Graphics();
    tent(t, bx, by);
    if (sh) t.alpha = 0.55 + 0.45 * Sim.boothCondition(st, sh);
    g.addChild(t);
  }
  cottageStage(g, x + YARD.stuga[0], y + YARD.stuga[1] - 5, n);
  if (!empty && f.camp === undefined) g.ellipse(x, y + 4, 17, 11).stroke({ width: 1.2, color: 0xf6eed8, alpha: 0.7 });
  if (empty) g.alpha = 0.55;
  g.zIndex = y + 8;
  L.objects.addChild(g);
}
// A field's sprite and its stooks, its rows at angle th: a farm's, or a village's common field (VB-100).
function addField(wd, fd, th) {
  const sp = new PIXI.Sprite(fieldTex[fieldLook(fd)] || fieldTex.stubble);
  sp.anchor.set(0.5);
  sp.scale.set(0.5);
  sp.rotation = th;
  sp.position.set(wd.hx[fd.tile], wd.hy[fd.tile]);
  L.fields.addChild(sp);
  const stooks = [];
  for (let k = 0; k < 9; k++) {
    const u = ((k % 3) - 1) * 12,
      v = (Math.floor(k / 3) - 1) * 12,
      jx = Math.sin(k * 7.1) * 2,
      jy = Math.cos(k * 3.3) * 2;
    const x = wd.hx[fd.tile] + Math.cos(th) * u - Math.sin(th) * v + jx,
      y = wd.hy[fd.tile] + Math.sin(th) * u + Math.cos(th) * v + jy;
    const sk = place(art.stook[k % 2], x, y + 2, 0.5, 0.9);
    sk.visible = false;
    stooks.push(sk);
  }
  fieldSprites.push({ sp, fd, stage: fieldLook(fd), stooks });
}
// Farms and pawns. A whole rebuild (st.visualDirty, a load, a new game) takes the settlement layer down and draws it again; a change to
// one farm or village (st.farmDirty, st.villageDirty) redraws that one alone, and a birth, a death or a wedding remakes the rigs it names
// (st.rigDirty; VB-442). What is taken down is destroyed with its context (VB-441): PixiJS frees a Graphics' own geometry only when asked
// to, and the renderer otherwise keeps every fence ever drawn.
let farmDrawn = [], // by farm id: the display objects its drawing added to the layers, taken down when it alone is redrawn
  villageDrawn = []; // by village id, the same
const settlementLayers = () => [L.fields, L.fences, L.objects];
// The display objects draw() adds to the three layers: each is appended, and no frame sorts a layer while draw() runs.
function drawnBy(draw) {
  const at = settlementLayers().map((l) => l.children.length);
  draw();
  return settlementLayers().flatMap((l, k) => l.children.slice(at[k]));
}
function buildFarms(wd) {
  for (const s2 of [...L.fields.removeChildren(), ...L.fences.removeChildren(), ...L.objects.removeChildren()])
    if (s2 !== ring && s2 !== moveG && s2 !== greenG) s2.destroy({ children: true, context: true });
  fieldSprites = [];
  rigs = [];
  houseInfo = [];
  pitInfo = [];
  fences = [];
  herdSprites = new Map();
  deerSprites = [];
  meadowSprites = [];
  teamDraw = new Map();
  cartDraw = [];
  ledDraw = new Map();
  farmDrawn = [];
  villageDrawn = [];
  L.objects.sortableChildren = true;
  drawBooths(wd);
  for (const f of st.farmsteads) farmDrawn[f.id] = drawnBy(() => drawFarm(wd, f));
  drawTarPits(wd);
  drawFacilities(wd);
  for (const v of st.villages) villageDrawn[v.id] = drawnBy(() => drawVillage(wd, v));
  if (labelsReady && labelSigOf() !== labelSig) buildLabels(wd);
  for (const p of st.pawns) rigs.push(pawnRig(p));
  L.objects.addChild(ring, moveG, greenG);
  moveKey = '';
  greenKey = ''; // the loads on a gathering's green (page/gathering), drawn anew on this world
  st.visualDirty = false;
  st.rigDirty.clear();
  st.farmDirty.clear();
  st.villageDirty.clear();
}
// What the simulation asked to be redrawn since the last frame: the whole layer, or the farms, villages and rigs it names.
function redrawSettlement(wd) {
  if (st.visualDirty) return buildFarms(wd);
  if (st.farmDirty.size || st.villageDirty.size) {
    const redraw = (drawn, id, draw) => {
      for (const o of drawn[id] || []) o.destroy({ children: true, context: true }); // and so out of its layer
      drawn[id] = drawnBy(draw);
    };
    for (const id of st.farmDirty) redraw(farmDrawn, id, () => drawFarm(wd, st.farmsteads[id]));
    for (const id of st.villageDirty) redraw(villageDrawn, id, () => drawVillage(wd, st.villages[id]));
    // the frame's lists keep only what still stands
    fieldSprites = fieldSprites.filter((o) => !o.sp.destroyed);
    meadowSprites = meadowSprites.filter((o) => !o.sp.destroyed);
    fences = fences.filter((o) => !o.g.destroyed);
    houseInfo = houseInfo.filter((o) => !o.wood.destroyed);
    if (labelsReady && labelSigOf() !== labelSig) buildLabels(wd);
    st.farmDirty.clear();
    st.villageDirty.clear();
  }
  for (const id of st.rigDirty)
    if (rigs[id]) {
      rigs[id].root.destroy({ children: true });
      rigs[id] = pawnRig(st.pawns[id]);
    }
  while (rigs.length < st.pawns.length) rigs.push(pawnRig(st.pawns[rigs.length])); // the newborn and the newcome
  st.rigDirty.clear();
}
function pawnRig(p) {
  const R = makeRig(p, wedded(p));
  R.root.visible = false;
  L.objects.addChild(R.root);
  return R;
}
// booths on their own tile (VB-784): a raised one stands, a worn one fades; one staked and being raised (its maker's plan, VB-1172) is a
// ring of stakes
function drawBooths(wd) {
  const add = (g, by) => {
    g.zIndex = by + 8;
    L.objects.addChild(g);
  };
  for (const b of st.booths) {
    const g = new PIXI.Graphics();
    tent(g, wd.hx[b.tile], wd.hy[b.tile]);
    g.alpha = 0.55 + 0.45 * Sim.boothCondition(st, b);
    add(g, wd.hy[b.tile]);
  }
  const camps = st.farmsteads.filter((f) => f.camp === true).map((f) => f.house),
    sheltered = new Set(st.farmsteads.filter((f) => f.shelter).map((f) => f.house)), // drawn with their farm (drawBooth)
    { hexSteps } = VB['sim/hex'];
  for (const t of Sim.stakedBooths(st)) {
    if (sheltered.has(t)) continue;
    const g = new PIXI.Graphics();
    if (camps.some((h) => hexSteps(wd, h, t) <= 1)) stakedPoles(g, wd.hx[t], wd.hy[t]);
    else g.circle(wd.hx[t], wd.hy[t] - 3, 6).stroke({ width: 1, color: INK, alpha: 0.6 });
    add(g, wd.hy[t]);
  }
}
// The gate of the house on tile `house` (VB-1951; sim/entrances): two posts and a rail on the edge its walks cross, along that edge, the
// gate swung half open; none where the house has no gate (open on every side).
function drawGate(wd, house, faded) {
  const p = VB['sim/entrances'].gatePoint(st.w, house);
  if (!p) return;
  const n = st.w.nb[house * 6 + st.w.gate[house]],
    dx = wd.hx[n] - wd.hx[house],
    dy = wd.hy[n] - wd.hy[house],
    len = Math.hypot(dx, dy) || 1,
    ex = -dy / len, // along the edge
    ey = dx / len,
    half = 0.16 * len,
    [x, y] = p,
    g = new PIXI.Graphics();
  const post = (px, py) =>
    g
      .rect(px - 1, py - 5, 2, 6)
      .fill({ color: 0x6b4a2e })
      .stroke({ width: 0.4, color: INK, alpha: 0.7 });
  // the gate leaf hangs on the first post, swung toward the house
  g.moveTo(x - ex * half, y - ey * half - 2.5)
    .lineTo(x - ex * half * 0.1 - (dx / len) * half * 0.6, y - ey * half * 0.1 - (dy / len) * half * 0.6 - 2.5)
    .stroke({ width: 1.4, color: 0x8a6440 });
  g.moveTo(x - ex * half, y - ey * half - 0.5)
    .lineTo(x - ex * half * 0.1 - (dx / len) * half * 0.6, y - ey * half * 0.1 - (dy / len) * half * 0.6 - 0.5)
    .stroke({ width: 1.1, color: 0x8a6440 });
  post(x - ex * half, y - ey * half);
  post(x + ex * half, y + ey * half);
  g.alpha = faded ? 0.45 : 1;
  g.zIndex = y + 0.02;
  L.objects.addChild(g);
}
// One farm: its fields, meadows, yard and buildings, its woodpile, byre and stacks, its smoke and firelight, and its fence.
function drawFarm(wd, f) {
  const hx = wd.hx[f.house],
    hy = wd.hy[f.house],
    empty = f.household === null,
    ruin = f.state === 'ruin';
  for (const fd of f.fields) addField(wd, fd, f.rowAngle);
  for (const m of f.meadows) {
    const sp = new PIXI.Sprite(fieldTex['meadow-' + m.stage]);
    sp.anchor.set(0.5);
    sp.scale.set(0.5);
    sp.position.set(wd.hx[m.tile], wd.hy[m.tile]);
    L.fields.addChild(sp);
    meadowSprites.push({ sp, m, stage: m.stage });
  }
  const yard = place(art.yard, hx, hy + 1, 0.5, 0.5, L.fields, 0.27);
  if (empty) yard.alpha = ruin ? 0.2 : 0.35;
  const v = f.id % 3;
  // an empty farm greys; a ruin keeps only the cottage's lower walls (proper decay art comes with claims); a tarred house's logs
  // are darker (VB-301)
  const tint = empty ? (ruin ? 0x6e6a66 : 0x8e8a86) : Sim.houseTarred(st, f) ? 0x9a8a7c : 0xffffff;
  const camp = f.camp === true,
    landed = f.camp !== undefined; // landed by hand: only what it built stands, no byre, heap, storehouse or loft (VB-1655, VB-1660)
  if (camp) {
    yard.alpha = 0.3; // trodden ground only
    drawCamp(wd, f);
    if (f.shelter) drawBooth(wd, f, empty);
  } else if (f.booth) drawBooth(wd, f, empty);
  else {
    const lada = place(art.lada, hx + YARD.lada[0], hy + YARD.lada[1], 0.5, 0.93),
      harbre = place(art.harbre, hx + YARD.harbre[0], hy + YARD.harbre[1], 0.5, 0.95),
      stuga = place(art.stuga[v], hx + YARD.stuga[0], hy + YARD.stuga[1], 0.5, 0.92);
    const barn = hasBuilt(f.barn) ? place(art.lada, hx + YARD.barn[0], hy + YARD.barn[1], 0.5, 0.93) : null; // farmstead.barn (VB-255)
    for (const b of barn ? [lada, harbre, stuga, barn] : [lada, harbre, stuga]) {
      b.tint = tint;
      if (empty && !ruin) b.alpha = 0.9;
    }
    if (landed) lada.visible = harbre.visible = false;
    if (f.rung === 'timber') {
      // the timber house (VB-1664): a larger house of another of the three cottages' looks, standing where the cottage stood
      stuga.texture = art.stuga[(v + 1) % 3];
      stuga.scale.set(ART_S * 1.32);
    }
    if (ruin) {
      lada.visible = harbre.visible = false;
      if (barn) barn.visible = false;
      stuga.scale.y = ART_S * 0.55;
      stuga.alpha = 0.85;
    }
    if (f.grade === 'stone' && !ruin) {
      // the stone sill a house raised onto a foundation stands on (VB-332)
      const sx = hx + YARD.stuga[0],
        sy = hy + YARD.stuga[1],
        sill = new PIXI.Graphics();
      for (let k = 0; k < 7; k++) sill.ellipse(sx - 10.5 + k * 3.5, sy + 0.6 + (k % 2) * 0.3, 2, 1.25);
      sill.fill({ color: empty ? 0x77736e : 0x9a958c }).stroke({ width: 0.35, color: 0x4a463f });
      sill.zIndex = sy + 0.005;
      L.objects.addChild(sill);
    }
  }
  if (!ruin) drawGate(wd, f.house, empty);
  const wood = place(art.wood[0], hx + YARD.wood[0], hy + YARD.wood[1], 0.5, 0.9);
  wood.visible = !empty;
  const herds = !empty && st.households[f.household].herds.length > 0;
  // the byre (VB-1665) where one stands; an older save's farm, with no record of it, has one where it keeps animals
  const byre = f.byre === undefined ? herds && !landed : hasBuilt(f.byre);
  if (byre) place(art.byre, hx + YARD.byre[0], hy + YARD.byre[1], 0.5, 0.92);
  const stack =
    herds || (!empty && st.households[f.household].hay > 0)
      ? place(art.haystack[0], hx + YARD.stack[0], hy + YARD.stack[1], 0.5, 0.93)
      : null;
  const heap = herds && byre ? place(art.manure[0], hx + YARD.heap[0], hy + YARD.heap[1], 0.5, 0.88) : null; // the dung heap by the byre (VB-137)
  if (st.w.fresh && st.w.fresh[f.house] === Water.FRESH.WELL)
    place(art.curb, hx + YARD.curb[0], hy + YARD.curb[1], 0.5, 0.85);
  if (!empty) {
    const puffs = [];
    for (let k = 0; k < 6; k++) {
      const p = new PIXI.Sprite(art.puff);
      p.anchor.set(0.5);
      p.zIndex = 1e6;
      L.objects.addChild(p);
      puffs.push(p);
    }
    // Smoke from the cottage's smoke hole, or from the booth's fire while the cottage is built; and the firelight after dark: the
    // cottage's openings lit over it, and a warm glow on the ground before the door (before the booth, the glow alone).
    const sx = hx + YARD.stuga[0],
      sy = hy + YARD.stuga[1],
      at = (q) => [sx + (q[0] - STUGA.w / 2) * ART_S, sy + (q[1] - STUGA.h * 0.92) * ART_S];
    // a camp's hearth ring; the booth beside the house of a farm landed by hand
    const near = (b) => b.by === f.household && VB['sim/hex'].hexSteps(wd, b.tile, f.house) <= 1,
      booth = f.camp === false ? st.booths.find(near) : null,
      fire = camp
        ? [hx + campAt(f)[0] - 13, hy + campAt(f)[1] - 1]
        : booth
          ? [wd.hx[booth.tile], wd.hy[booth.tile] + 1]
          : null;
    const [cx, cy] = fire
      ? [fire[0], fire[1] - (booth ? 14 : 3)]
      : f.booth
        ? [hx + YARD.booth[0], hy + YARD.booth[1] - 13]
        : at(STUGA.hole);
    const [gx, gy] = fire || (f.booth ? [hx + YARD.booth[0], hy + YARD.booth[1] + 1] : at([48, 62]));
    const lit = f.booth ? null : place(art.lit, sx, sy, 0.5, 0.92);
    if (lit) {
      lit.zIndex = sy + 0.01;
      lit.visible = false;
    }
    const glow = new PIXI.Sprite(art.glow);
    glow.anchor.set(0.5);
    glow.blendMode = 'add';
    glow.position.set(gx, gy);
    glow.scale.set(f.booth ? 0.2 : 0.36, f.booth ? 0.13 : 0.23);
    glow.zIndex = sy + 0.02;
    glow.visible = false;
    L.objects.addChild(glow);
    houseInfo.push({ f, puffs, wood, stack, heap, cx, cy, lit, glow, smoke: 0, fire: 0 });
  }
  if (f.fence) for (const s2 of f.fence) addFence(s2);
}
// the tar pits (VB-301): a funnel of dark earth on the pine slope, a barrel by its run-off, and smoke while tar is burnt (page/animate)
function drawTarPits(wd) {
  for (const hh of st.households) {
    const pit = hh.tarPit;
    if (hh.dissolved || !pit) continue;
    const x = wd.hx[pit.tile] + 8,
      y = wd.hy[pit.tile] + 6,
      g = new PIXI.Graphics();
    g.ellipse(x, y, 7.5, 4.2).fill({ color: 0x5a4a3a }).stroke({ width: 0.7, color: INK });
    g.ellipse(x, y - 0.6, 4.6, 2.4).fill({ color: 0x2a211b });
    g.ellipse(x + 0.4, y + 0.2, 1.6, 0.8).fill({ color: 0x120d0a });
    g.rect(x + 5.2, y + 1.2, 4, 2.6)
      .fill({ color: 0x7a5636 })
      .stroke({ width: 0.4, color: INK });
    g.zIndex = y;
    L.objects.addChild(g);
    const puffs = [];
    for (let k = 0; k < 5; k++) {
      const p = new PIXI.Sprite(art.puff);
      p.anchor.set(0.5);
      p.zIndex = 1e6;
      p.tint = 0x6a625c; // tar smoke is dark
      p.visible = false;
      L.objects.addChild(p);
      puffs.push(p);
    }
    pitInfo.push({ tile: pit.tile, x, y: y - 2, puffs, smoke: 0 });
  }
}
// One village: its common fields, its well sweep, its fence and the plots under way.
function drawVillage(wd, v) {
  for (const fd of v.commonFields || []) addField(wd, fd, 0); // the village's common fields (VB-100)
  if (v.well !== null) place(art.sweep, wd.hx[v.well] + 1, wd.hy[v.well] + 10, 0.44, 0.95);
  for (const s2 of v.fence) addFence(s2);
  const X = VB['sim/expansion'];
  for (const plot of X.livePlots(st, v))
    for (const tr of X.tilesOf(plot)) {
      // the plots under way: their village's project plans (VB-123)
      // stumps while the wood is felled but not grubbed out, turned soil once the ground is broken, a ring while the work goes on
      const g = new PIXI.Graphics(),
        x = wd.hx[tr.tile],
        y = wd.hy[tr.tile],
        step = tr.steps[tr.i];
      if (step === 'grub')
        for (const [dx, dy] of [
          [-7, 2],
          [0, -5],
          [6, 4],
          [-2, 8],
        ]) {
          g.ellipse(x + dx, y + dy, 2.2, 1.7)
            .fill(0xf2deac)
            .stroke({ width: 0.7, color: INK });
          g.ellipse(x + dx, y + dy, 0.9, 0.7).stroke({ width: 0.4, color: 0x96462f });
        }
      if (tr.kind === 'field' && tr.i >= tr.steps.length)
        g.ellipse(x, y + 2, 14, 8)
          .fill({ color: 0x986846, alpha: 0.9 })
          .stroke({
            width: 0.8,
            color: INK,
            alpha: 0.6,
          });
      if (tr.kind === 'house' && plot.open >= 1)
        cottageStage(g, x + YARD.stuga[0], y + YARD.stuga[1] - 5, X.cottageAt(plot));
      g.ellipse(x, y + 4, 17, 11).stroke({ width: 1.2, color: 0xf6eed8, alpha: 0.7 });
      L.fences.addChild(g);
    }
}
function addFence(s) {
  const g = new PIXI.Graphics();
  drawFence(g, s);
  L.fences.addChild(g);
  fences.push({ g, s });
  s.dirty = false;
}

function cropStage(fd) {
  if (fd.stage === 'stooks') return 'stubble';
  if (fd.stage === 'fallow' || fd.stage === 'scrub') return fd.stage;
  if (fd.stage !== 'growing') return fd.stage;
  return Math.floor(st.t / Sim.DAY) - fd.sown < 12 ? 'young' : 'growing';
}
// A field's picture (VB-355; a key of page/fieldart's FIELD_P): its crop at its stage, read from the field alone. Barley's are the
// stages; rye, sown in autumn, stands green and lies under snow all winter; a fallow course lies in weedy stubble, then tilled.
function fieldLook(fd) {
  const s = cropStage(fd);
  if (fd.stage === 'stubble' && VB['sim/crops'].CROPS[fd.crop].fallow) return fd.rest === 1 ? 'tilled' : 'lea';
  if (fd.crop === 'rye' && (s === 'sown' || s === 'young' || s === 'growing')) {
    if (Sim.cal(st.t).season === 3) return 'rye-snow';
    if (s === 'growing' && Sim.cal(fd.sown * Sim.DAY).season === 2 && Sim.cal(st.t).season === 2) return 'rye-young';
  }
  const k = `${fd.crop}-${s}`;
  return fieldTex[k] ? k : s;
}
// Herds by the farm (VB-131): in the grazing season, from 6:00 to 20:00, each herd's animals graze around its home tile, or its pasture when
// out with a herder (VB-136, page/animate), wandering slowly and now and then looking up; inside the byre otherwise. Sprites are made per
// herd and remade only when its animals change.
const hash = (n) => {
  n = Math.imul(n ^ (n >>> 15), 0x2c1b3c6d);
  n = Math.imul(n ^ (n >>> 12), 0x297a2d39);
  return ((n ^ (n >>> 15)) >>> 0) / 4294967296;
};
const SHEEP_TINT = [0xffffff, 0xece6da, 0xbab2a6, 0x8c7c6a, 0x5c5248];
const COW_SCALE = { cow: 0.21, bull: 0.245, ox: 0.245, heifer: 0.19, steer: 0.195, calf: 0.135 };
function herdAnimals(hd) {
  const out = [];
  if (hd.head)
    for (const h of hd.head)
      out.push({ id: h.id, key: h.id * 2 + 1, cow: (hash(h.id * 7 + 3) * COATS.length) | 0, sc: COW_SCALE[h.kind] });
  else {
    const all = hd.ewes + hd.rams + hd.lambs,
      n = Math.min(10, all),
      lambs = all ? Math.round((n * hd.lambs) / all) : 0;
    for (let k = 0; k < n; k++)
      out.push({
        key: hd.id * 1000 + k * 2,
        tint: SHEEP_TINT[(hash(hd.id * 31 + k) * SHEEP_TINT.length) | 0],
        sc: k < n - lambs ? 0.21 : 0.145,
      });
  }
  return out;
}
