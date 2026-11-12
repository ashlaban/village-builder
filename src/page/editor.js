// @sys page/editor: the archipelago editor: a world alone on the stage, with no run; its tools' panels, Regenerate, and Play on that world
  // ---- archipelago editor ----
  // The parameters are the options of G.generate: the seed, the grid's columns and rows, the share of land and the regions' radius. A
  // world is raised from the form on Regenerate, never while a control moves. `edit.p` holds the parameters of the world raised, so
  // the panel can say when the form has moved on from it. It is page state, as the showcase island is: never saved, and no game.
  const ED = { size: 's', land: 36, region: 7, cols: [40, 400], rows: [30, 300] };
  // edit: { p: {seed, cols, rows, land, region} of the world raised, wd, painted, busy, cover, deposit, armed, places, kept, sim }; cover and
  // deposit: what the terrain brush painted, Maps of tile to biome and to deposit code, laid again on that land whenever it is raised anew
  // (edApply). places: what the Settlement tool placed, in order, each {village: tile, farms} or {farm: tile} (Sim.seed's manual scenario).
  // kept: the world's arrays as raised and painted, with no run (gen/cover, keep); sim: the run seeded on it from the places, the picture
  // of what is placed, which never advances (`still`). The world is put back to `kept` before it is painted or seeded again.
  let edit = null;
  const editorOpen = () => !$('editor').hidden;
  const edSizeOf = (cols, rows) => Object.keys(SIZES).find((k) => SIZES[k][0] === cols && SIZES[k][1] === rows) || 'c';
  function edFill(p) {
    $('edSeed').value = String(p.seed); $('edCols').value = p.cols; $('edRows').value = p.rows; $('edSize').value = edSizeOf(p.cols, p.rows);
    $('edLand').value = p.land; $('edRegion').value = p.region;
    edEcho();
  }
  // What the form asks for, or null where a field does not hold a number in its range (the form's own validity says which).
  function edRead() {
    if (!$('edGen').checkValidity()) return null;
    return { seed: Number($('edSeed').value.trim()), cols: Number($('edCols').value), rows: Number($('edRows').value),
      land: Number($('edLand').value), region: Number($('edRegion').value) };
  }
  const edSame = (a, b) => !!a && !!b && ['seed', 'cols', 'rows', 'land', 'region'].every((k) => a[k] === b[k]);
  // The read-outs beside the controls, and whether the form still shows the world on the stage.
  function edEcho() {
    const rr = Number($('edRegion').value), cols = Number($('edCols').value), rows = Number($('edRows').value);
    $('edLandOut').textContent = `${$('edLand').value}%`;
    $('edRegionOut').textContent = `${rr} tiles, ${3 * rr * (rr + 1) + 1} a region`;
    $('edSizeNote').textContent = cols > 0 && rows > 0 ? `${(cols * rows).toLocaleString('en')} tiles` : '';
    if (!edit || edit.busy) return;
    const p = edRead(), changed = edit.p && !edSame(p, edit.p);
    $('edState').textContent = !edit.p ? '' : changed ? 'Changed since this land was raised.' : 'The land shown is raised from these settings.';
    $('edState').classList.toggle('changed', !!changed);
  }
  // What the raised world holds: the land's biomes as one bar, and counts.
  function edFacts() {
    const wd = edit.wd, n = new Array(G.BIOMES.length).fill(0);
    let land = 0, river = 0, lake = 0, deposit = 0;
    for (let i = 0; i < wd.N; i++) {
      n[wd.biome[i]]++;
      if (!wd.water[i]) { land++; if (wd.river[i]) river++; if (wd.deposit[i]) deposit++; } else if (!wd.ocean[i]) lake++;
    }
    const pct = (k, of) => (of ? `${(100 * k / of).toFixed(k / of < 0.1 ? 1 : 0)}%` : '0%'), num = (k) => k.toLocaleString('en');
    const kinds = G.BIOMES.map((b, k) => ({ b, k: n[k] })).filter((x) => !x.b.water && x.k > 0).sort((a, b) => b.k - a.k);
    const col = (b) => `rgb(${b.c.join(',')})`;
    $('edBiomes').innerHTML = kinds.map((x) => `<i style="flex:${x.k} 0 0;background:${col(x.b)}"></i>`).join('');
    $('edBiomes').setAttribute('aria-label', `The land by kind: ${kinds.map((x) => `${x.b.name} ${pct(x.k, land)}`).join(', ')}`);
    const rows = [['Tiles', num(wd.N)], ['Land', `${num(land)} (${pct(land, wd.N)})`],
      ...kinds.map((x) => [`<i style="background:${col(x.b)}"></i>${x.b.name}`, pct(x.k, land), 'sub']),
      ['Regions with land', num(wd.regions.filter((r) => r.land > 0).length)], ['Lake tiles', num(lake)], ['River tiles', num(river)],
      ['Tiles with a deposit', num(deposit)]];
    $('edFactList').innerHTML = rows.map(([k, v, c]) => `<dt${c ? ` class="${c}"` : ''}>${k}</dt><dd>${v}</dd>`).join('');
    $('edFacts').hidden = false;
    $('edName').textContent = wd.name; $('edMeta').textContent = `Seed ${wd.seed}, ${wd.COLS} by ${wd.ROWS} tiles`;
  }
  function edBusy(on, p) {
    edit.busy = on; $('edGo').disabled = $('edMenu').disabled = $('edReset').disabled = on; edSettleEcho();
    $('edBar').hidden = !on; $('edBarFill').style.width = `${((p || 0) * 100).toFixed(1)}%`;
    if (on) { $('edState').textContent = 'Raising the land'; $('edState').classList.remove('changed'); }
    else { edit.armed = false; $('edGo').textContent = 'Regenerate'; edEcho(); edPaintedEcho(); edSettleEcho(); }
  }
  // The editor's world on the stage, alone, with the picture of what is placed on it, which stands still: nothing of the game is advanced.
  // `whole`: seen from above, all of it.
  async function edShow(whole) {
    demo = true; demoAt = null; demoRun = null; document.body.classList.add('demo');
    await swapWorld(edit.wd, edit.sim, edit.painted);
    still = true; intro = null;
    if (whole) { T = 2; cam.x = edit.wd.W / 2; cam.y = edit.wd.H / 2; cam.z = zt = zMin(); vel.x = vel.y = 0; }
    edFacts();
  }
  // `again`: the parameters of the world a game dropped, raised as it was, whatever the form says now.
  function edRaise(again) {
    const p = again || edRead();
    if (!p || !edit || edit.busy) { $('edGen').reportValidity(); return; }
    if (!again && edit.cover.size + edit.deposit.size + edit.places.length && !edit.armed) { // what was made by hand would be lost: asked once more
      edit.armed = true; $('edGo').textContent = 'Regenerate, and clear what is painted and placed';
      $('edState').textContent = 'Regenerating clears what you painted and placed on this land.'; $('edState').classList.add('changed');
      return;
    }
    $('edMsg').hidden = true; edBusy(true, 0);
    onStage(async () => {
      try {
        await frame(); await frame();
        const opt = { cols: p.cols, rows: p.rows, landFrac: p.land / 100, regionRadius: p.region };
        const wd = await drive(G.generate(p.seed, opt), (x) => { $('edBarFill').style.width = `${(x * 60).toFixed(1)}%`; });
        if (!edit) return;
        if (again) edApply(wd); else { edit.cover.clear(); edit.deposit.clear(); edit.places = []; }
        const kept = VB['gen/cover'].keep(wd), sim = edLay(wd, kept, p.seed);
        const painted = await paintOverview(wd, (x) => { $('edBarFill').style.width = `${(60 + x * 40).toFixed(1)}%`; });
        const first = !edit.wd || edit.wd.COLS !== wd.COLS || edit.wd.ROWS !== wd.ROWS;
        edit.p = p; edit.wd = wd; edit.painted = painted; edit.kept = kept; edit.sim = sim; edStale.clear();
        if (editorOpen()) await edShow(first);
      } catch (e) {
        console.warn('The land could not be raised', e);
        $('edMsg').hidden = false; $('edMsg').textContent = 'This land could not be raised. Try another seed or other settings.';
        if (edit && !edit.wd) edit.p = null;
      }
      if (edit) edBusy(false);
    });
  }
  // The tools: one panel open at a time, under the tools; the open tool's button pressed again puts its panel away.
  const ED_TOOLS = { gen: 'edGen', terrain: 'edTerrain', settle: 'edSettle' };
  let edTool = 'gen';
  function edOpenTool(k) {
    edTool = k;
    for (const b of $('edTools').querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.tool === k));
    for (const t of Object.keys(ED_TOOLS)) $(ED_TOOLS[t]).hidden = t !== k;
    edHoldBrush();
  }
  // From the main menu, or from a Play that found no room (msg). A game that is open is kept aside, as at the start (page/start), and
  // comes back when the editor is left.
  function openEditor(msg) {
    if (building || skipping) return;
    if (w && !demo && !aside) aside = { wd: w, sim: st, painted: stagePainted, cam: { x: cam.x, y: cam.y, z: cam.z } };
    openPanel(null); closeSpeedOptions(); closeNotices();
    $('landing').hidden = true; $('genScreen').hidden = true; $('editor').hidden = false; document.body.classList.add('editing');
    loader.classList.add('done');
    $('edMsg').hidden = !msg; $('edMsg').textContent = msg || '';
    if (!edit) {
      edit = { p: null, wd: null, painted: null, busy: false, cover: new Map(), deposit: new Map(), armed: false, places: [], kept: null, sim: null };
      if ($('edSeed').value) edEcho(); // the settings of an earlier visit
      else edFill({ seed: choice.seed, cols: SIZES[ED.size][0], rows: SIZES[ED.size][1], land: ED.land, region: ED.region });
    }
    edHoldBrush(); edPaintedEcho(); edSettleEcho();
    if (!edit.wd) edRaise(edit.p);
    else if (w !== edit.wd) onStage(() => (editorOpen() && edit && edit.wd ? edShow(true) : null));
    $('edPlay').focus({ preventScroll: true });
  }
  // Play: a game on the world shown, settled as the Settlement tool says. The land is raised again from the parameters of the world
  // shown (not from a form changed since), so the editor keeps its own world, to come back to from the main menu. Such a game cannot be
  // saved yet: a save rebuilds its world from seed and size alone (page/loader, `unsaved`).
  function edPlay() {
    if (!edit || !edit.wd || edit.busy || building || (edManual() && !edit.places.length)) return;
    const p = edit.p;
    build(p.seed, $('edSettled').value, { cols: p.cols, rows: p.rows, landFrac: p.land / 100, regionRadius: p.region, apply: edApply,
      places: edManual() ? edit.places.map((x) => ({ ...x })) : null });
  }
  // Main menu: the game kept aside comes back behind it; with none, the editor's world stays there.
  function closeEditor() {
    if (!editorOpen() || (edit && edit.busy)) return;
    $('editor').hidden = true; document.body.classList.remove('editing'); sel = -1; hoverDirty = true; edHoldBrush();
    onStage(async () => {
      if (aside && !editorOpen()) await restoreAside();
      if (!editorOpen() && $('genScreen').hidden && !building) showLanding();
    });
  }
  // ---- the terrain brush ----
  // A brush lays a ground cover or a deposit on the land tiles under it, as the pointer is dragged over the map (page/input, mapBrush);
  // with no brush the map is dragged as ever. The sea, lakes and rivers are not painted: the relief stays as it was raised.
  const ED_COVERS = G.BIOMES.map((b, k) => k).filter((k) => !G.BIOMES[k].water);
  let edBrush = null, edAt = null, edStruck = 0; // the brush held ({cover} or {deposit}); a stroke's last point on the map; tiles it changed
  const edFar = new Set(); // tiles a stroke recoloured while the overview was out of sight: its chunks are painted when the stroke ends
  function edBrushList() {
    const on = (b) => String(!!edBrush && !!b && edBrush.cover === b.cover && edBrush.deposit === b.deposit);
    const btn = (attr, swatch, name, b, cls = '') =>
      `<button type="button" ${attr} aria-pressed="${on(b)}"${cls ? ` class="${cls}"` : ''}>${swatch}${name}</button>`;
    $('edBrushes').innerHTML = `<button type="button" data-brush="none" aria-pressed="${!edBrush}" class="wide">Look around</button><h4>Ground cover</h4>`
      + ED_COVERS.map((k) => btn(`data-cover="${k}"`, `<i style="background:rgb(${G.BIOMES[k].c.join(',')})"></i>`, G.BIOMES[k].name, { cover: k })).join('')
      + '<h4>Deposits</h4>' + btn('data-deposit="0"', '', 'No deposit', { deposit: 0 }, 'wide')
      + Geo.DEPOSITS.map((d, k) => (k ? btn(`data-deposit="${k}"`, `<i class="${DEPOSIT_MARK[k]}" style="background:${hex6(DEPOSIT_COLOUR[k])}"></i>`,
        d.name, { deposit: k }) : '')).join('');
    $('edBrushNote').textContent = !edBrush ? 'Drag the map to move it. Choose a brush to paint.'
      : edBrush.cover !== undefined ? 'Drag over the land to lay this cover. Two fingers, the wheel and the arrow keys still move the map.'
        : edBrush.deposit && Geo.DEPOSITS[edBrush.deposit].hidden ? 'A hidden ore: a village must find it before it can be dug.'
          : edBrush.deposit ? 'Drag over the land to lay this deposit.' : 'Drag over the land to take its deposits away.';
    const r = Number($('edBrushSize').value);
    $('edBrushOut').textContent = r ? `${2 * r + 1} tiles` : '1 tile';
  }
  // The brush takes the map's drags only while the Terrain tool is open in the editor; a deposit brush shows the ground as the Ground
  // overlay does (page/ground), where no run means every deposit is seen.
  function edHoldBrush() {
    const held = editorOpen() && edTool === 'terrain' && edBrush ? edBrush : null, ground = !!held && held.deposit !== undefined;
    const placing = editorOpen() && edTool === 'settle' && edManual() && edPlace;
    mapBrush = held ? edStroke : placing ? edPlaceAt : null; document.body.classList.toggle('brushing', !!held || !!placing);
    L.ground.visible = ground || groundOn;
    if (ground) { groundFor = null; drawGround(); }
    edBrushList();
  }
  function edPaintedEcho() {
    const c = edit ? edit.cover.size : 0, d = edit ? edit.deposit.size : 0, n = (k) => `${k.toLocaleString('en')} ${k === 1 ? 'tile' : 'tiles'}`;
    $('edPainted').textContent = c + d ? [c ? `Ground cover on ${n(c)}` : '', d ? `${c ? 'd' : 'D'}eposits on ${n(d)}` : ''].filter(Boolean).join(', ') + '.'
      : 'Nothing yet.';
    $('edUnpaint').disabled = !(c + d) || !edit || edit.busy;
  }
  // One tile under the brush: true if it changed. What is painted is kept in the order painted, the last word on a tile last.
  function edPaint(t) {
    const wd = edit.wd, b = edBrush;
    if (b.cover !== undefined) {
      if (wd.biome[t] === b.cover || !VB['gen/cover'].set(G, wd, t, b.cover)) return false;
      edit.cover.delete(t); edit.cover.set(t, b.cover);
    } else {
      if (wd.deposit[t] === b.deposit || !Geo.setDeposit(wd, t, b.deposit)) return false;
      edit.deposit.delete(t); edit.deposit.set(t, b.deposit);
    }
    return true;
  }
  // page/input's mapBrush: a stroke's first point (first true), a later one (false), or its end (null). Between two points the brush is
  // laid every tile's width, so a quick drag leaves no gaps.
  function edStroke(sx, sy, first) {
    if (!edit || !edit.wd || edit.busy || w !== edit.wd || !edBrush) return;
    const wd = edit.wd;
    if (first === null) {
      if (edStruck) {
        if (edBrush.deposit !== undefined) Geo.reveins(wd);
        edit.kept = VB['gen/cover'].keep(wd); // the land as painted, still with no run on it
        repaintTiles([], edFar); edFacts(); edPaintedEcho(); edEcho();
      }
      edAt = null; edStruck = 0; edFar.clear();
      const had = edit.places.length; // what is placed stands again, on the land as it is now; a place left with no room is gone
      if (edManual() && had) {
        edRelay().then(() => {
          if (edit && edit.places.length < had) $('edBrushNote').textContent = 'What was placed there no longer had room, and was taken away.'; });
      }
      return;
    }
    if (first && edit.sim) edUnseat(); // the land is painted with no run on it
    const [x, y] = toWorld(sx, sy), from = first || !edAt ? [x, y] : edAt, steps = Math.max(1, Math.ceil(Math.hypot(x - from[0], y - from[1]) / wd.HW));
    const r = Number($('edBrushSize').value), seen = new Set(), done = [];
    for (let s = first || !edAt ? steps : 1; s <= steps; s++) {
      const c = loc(from[0] + ((x - from[0]) * s) / steps, from[1] + ((y - from[1]) * s) / steps, [0, 0]);
      if (c < 0 || seen.has(c)) continue;
      let ring = [c]; seen.add(c);
      for (let k = 0; k < r; k++) {
        const next = [];
        for (const i of ring) for (let d = 0; d < 6; d++) { const j = wd.nb[i * 6 + d]; if (j >= 0 && !seen.has(j)) { seen.add(j); next.push(j); } }
        ring = next;
      }
    }
    for (const t of seen) if (edPaint(t)) done.push(t);
    edAt = [x, y];
    if (!done.length) return;
    edStruck += done.length; edit.armed = false; $('edGo').textContent = 'Regenerate';
    if (edBrush.deposit !== undefined) { groundFor = null; drawGround(); }
    else if (T === 2) repaintTiles(done, done); // the overview is what is seen: recoloured as the brush goes
    else { repaintTiles(done, []); for (const t of done) edFar.add(t); }
  }
  // What was painted, laid on that land raised anew: in the editor after a game dropped its world, and under a game begun with Play.
  function edApply(wd) {
    for (const [t, b] of edit.cover) VB['gen/cover'].set(G, wd, t, b);
    for (const [t, d] of edit.deposit) Geo.setDeposit(wd, t, d);
    if (edit.deposit.size) Geo.reveins(wd);
  }
  // ---- what is placed ----
  // Settled by a scenario, the land is settled when Play is pressed. Placed by hand (Sim.seed's manual scenario), each place is laid at
  // once by the game's own generator, and what stands there is that run, which Play begins on a land raised the same.
  const edManual = () => $('edSettled').value === 'manual';
  let edPlace = null; // the place tool held: 'village', 'farm', 'remove', or null
  const edStale = new Set(); // tiles whose look a run taken away or laid has changed, to paint again
  const edMark = (wd, sim) => {
    if (sim) for (const t of sim.used) edStale.add(t); if (wd.worn) for (let i = 0; i < wd.N; i++) if (wd.worn[i]) edStale.add(i); };
  // The run of the places on a world as kept, or null with none. A place that finds no room is taken out of the list, and the rest laid.
  function edLay(wd, kept, seed) {
    while (edManual() && edit.places.length) {
      try { return Sim.seed(wd, seed, 'manual', edit.places); } catch (e) {
        VB['gen/cover'].restore(wd, kept);
        if (e.place === undefined) { console.warn('What is placed could not be laid', e); return null; }
        edit.places.splice(e.place, 1);
      }
    }
    return null;
  }
  // The run taken off the editor's world, which is as kept again.
  function edUnseat() {
    edMark(edit.wd, edit.sim); VB['gen/cover'].restore(edit.wd, edit.kept); edit.sim = null;
    buildSettlement(edit.wd, null);
  }
  // The places laid anew on the world as kept, and shown.
  async function edRelay() {
    if (!edit || !edit.wd || w !== edit.wd) return;
    const wd = edit.wd;
    edMark(wd, edit.sim); VB['gen/cover'].restore(wd, edit.kept);
    edit.sim = edLay(wd, edit.kept, edit.p.seed);
    edMark(wd, edit.sim);
    const tiles = [...edStale]; edStale.clear();
    await buildSettlement(wd, edit.sim); still = true;
    repaintTiles(tiles, tiles); edSettleEcho();
  }
  // page/input's mapBrush, for a place tool: a press on the map places a village about the tile or a household on it, or takes away the
  // place nearest the tile. A place that finds no room is not kept, and the panel says so.
  async function edPlaceAt(sx, sy, first) {
    if (first !== true || !edit || !edit.wd || edit.busy || w !== edit.wd || !edPlace) return;
    const wd = edit.wd, [x, y] = toWorld(sx, sy), t = loc(x, y, [0, 0]), n = edit.places.length;
    if (t < 0) return;
    let msg = '';
    if (edPlace === 'remove') {
      let k = -1, kd = 5;
      edit.places.forEach((p, j) => { const d = VB['sim/hex'].hexSteps(wd, t, p.farm !== undefined ? p.farm : p.village); if (d < kd) { kd = d; k = j; } });
      if (k < 0) return;
      edit.places.splice(k, 1);
    } else edit.places.push(edPlace === 'village' ? { village: t, farms: Number($('edFarms').value) } : { farm: t });
    await edRelay();
    if (edPlace !== 'remove' && edit.places.length <= n) {
      msg = edPlace === 'village' ? 'A village finds no room there.' : 'A house cannot stand there, or finds no fields about it.';
    }
    $('edPlaceMsg').hidden = !msg; $('edPlaceMsg').textContent = msg;
  }
  // The Settlement panel as things stand, and whether Play can begin: placed by hand, only once something is placed.
  function edSettleEcho() {
    const manual = edManual(), sim = edit && edit.sim;
    $('edSettledNote').textContent = manual ? 'Place villages and households yourself. Close households are one village, as they are in play.'
      : `${START_WORDS[$('edSettled').value].line} They are placed when you press Play.`;
    $('edPlacing').hidden = $('edPlacedBox').hidden = !manual;
    for (const b of $('edPlaces').querySelectorAll('button')) b.setAttribute('aria-pressed',
      String((b.dataset.place === 'none' ? null : b.dataset.place) === edPlace));
    $('edFarmsOut').textContent = $('edFarms').value; $('edFarmsRow').hidden = edPlace !== 'village';
    $('edPlaceNote').textContent = edPlace === 'village' ? 'Press on the land: the village is laid about that tile, with the farms that find room.'
      : edPlace === 'farm' ? 'Press on the land: the house stands on that tile, its fields beside it.'
        : edPlace === 'remove' ? 'Press on a village\u2019s green, or on a house you placed.' : 'Drag the map to move it. Choose what to place.';
    const farms = sim ? sim.farmsteads.length : 0, vs = sim ? sim.villages.length : 0, people = sim ? sim.pawns.length : 0;
    $('edPlaced').textContent = sim ? `${farms} ${farms === 1 ? 'household' : 'households'} in ${vs} ${vs === 1 ? 'village' : 'villages'}, ${people} people.`
      : 'Nothing yet. Play begins once something is placed.';
    $('edUnplace').disabled = !edit || edit.busy || !edit.places.length;
    $('edPlay').disabled = !edit || edit.busy || !edit.wd || (manual && !edit.places.length);
  }
  // A game raised or loaded drops the editor's world, which is heavy, and keeps what it was raised from: the next visit raises it again.
  function dropEditor() {
    $('editor').hidden = true; document.body.classList.remove('editing'); edHoldBrush();
    if (edit) { edit.wd = null; edit.painted = null; edit.kept = null; edit.sim = null; }
  }

  $('landEdit').addEventListener('click', () => openEditor());
  $('edMenu').addEventListener('click', () => closeEditor());
  $('edGen').addEventListener('submit', (e) => { e.preventDefault(); edRaise(); });
  $('edGen').addEventListener('input', (e) => {
    if (e.target.id === 'edSize' && SIZES[e.target.value]) [$('edCols').value, $('edRows').value] = SIZES[e.target.value];
    if (e.target.id === 'edCols' || e.target.id === 'edRows') $('edSize').value = edSizeOf(Number($('edCols').value), Number($('edRows').value));
    edEcho();
  });
  $('edReroll').addEventListener('click', () => { $('edSeed').value = String((Math.random() * 1e6) | 0); edEcho(); });
  $('edReset').addEventListener('click', () => {
    edFill({ seed: Number($('edSeed').value) || 0, cols: SIZES[ED.size][0], rows: SIZES[ED.size][1], land: ED.land, region: ED.region }); });
  $('edPlay').addEventListener('click', () => edPlay());
  $('edTools').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-tool]');
    if (b) edOpenTool(b.dataset.tool === edTool ? null : b.dataset.tool);
  });
  $('edBrushes').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    edBrush = b.dataset.cover !== undefined ? { cover: Number(b.dataset.cover) } : b.dataset.deposit !== undefined ? {
      deposit: Number(b.dataset.deposit) } : null;
    edHoldBrush();
  });
  $('edBrushSize').addEventListener('input', edBrushList);
  // the land as it was raised: the same parameters once more, with nothing laid on it
  $('edUnpaint').addEventListener('click', () => { if (edit && !edit.busy && edit.p) { edit.cover.clear(); edit.deposit.clear(); edRaise(edit.p); } });
  edBrushList();
  $('edSettled').innerHTML = '<option value="manual">Placed by hand</option>'
    + START_ORDER.map((k) => `<option value="${k}">${START_WORDS[k].name}</option>`).join('');
  $('edSettled').value = 'founders';
  // by hand or by a scenario: the picture of what is placed stands only while it is what Play would begin on
  $('edSettled').addEventListener('input', () => {
    edHoldBrush(); edSettleEcho(); if (edit && edit.wd && !edit.busy && (edit.sim || edit.places.length)) edRelay(); });
  $('edPlaces').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    edPlace = b.dataset.place === 'none' ? null : b.dataset.place; $('edPlaceMsg').hidden = true; edHoldBrush(); edSettleEcho();
  });
  $('edFarms').addEventListener('input', edSettleEcho);
  $('edUnplace').addEventListener('click', () => { if (edit && !edit.busy && edit.places.length) { edit.places = []; edRelay(); } });
  edSettleEcho();
