// @sys page/editplace: the archipelago editor's Settlement tool: what is placed by hand, laid at once as a run that stands still
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
    const lived = () => edit.places.some((p) => p.village !== undefined || p.farm !== undefined);
    if (!lived()) edit.places = edit.places.filter((p) => p.way); // with no farm left, its fields and meadows go; roads wait for a run
    while (edManual() && lived()) {
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
    repaintTiles(tiles, tiles); edWays(); edSettleEcho();
  }
  // page/input's mapBrush, for a place tool. A press on the map places a village about the tile, or a household, a field or a meadow on
  // it, or takes away the place nearest the tile; a road is drawn by a drag over its tiles, or found by the walkers' own route search
  // between two presses. A place that finds no room is not kept, and the panel says so.
  const ED_NO_ROOM = { village: 'A village finds no room there.', farm: 'A house cannot stand there, or finds no fields about it.',
    field: 'No field can lie there: the ground must be free and fit to till, within six tiles of a house.',
    meadow: 'No meadow can lie there: it takes free meadow, marsh or heath within six tiles of a house.',
    pawn: 'Press on a house. A child cannot live alone in an empty one, and no one lives in a ruin.',
    green: 'No green can lie there: it takes a free tile near a village that has none.',
    empty: 'A house cannot stand there, or finds no fields about it.', ruin: 'A house cannot stand there, or finds no fields about it.',
    way: 'No road can run there.', route: 'No way on foot was found between the two.' };
  const edWayG = new PIXI.Graphics(); L.hover.addChild(edWayG);
  let edWay = null, edFrom = -1; // a road being drawn (its tiles in order); the first press of a road to be found
  const edAnchors = (p) => (p.way ? p.way : [[p.farm, p.field, p.meadow, p.village, p.pawn, p.green].find((t) => t !== undefined)]);
  // The roads that the land does not show: one being drawn, the start of one to be found, and all of them while no run stands to wear them.
  function edWays() {
    edWayG.clear();
    if (!edit || !edit.wd || w !== edit.wd || !editorOpen()) return;
    const wd = edit.wd, line = (tiles, alpha) => {
      if (tiles.length < 2) return;
      edWayG.moveTo(wd.hx[tiles[0]], wd.hy[tiles[0]]);
      for (let k = 1; k < tiles.length; k++) edWayG.lineTo(wd.hx[tiles[k]], wd.hy[tiles[k]]);
      edWayG.stroke({ width: wd.R * 0.5, color: 0x8a6a3c, alpha, cap: 'round', join: 'round' });
    };
    if (!edit.sim && edManual()) for (const p of edit.places) if (p.way) line(p.way, 0.75);
    if (edWay) line(edWay, 0.9);
    if (edFrom >= 0) edWayG.circle(wd.hx[edFrom], wd.hy[edFrom], wd.R * 0.5).fill({ color: 0x8a6a3c, alpha: 0.9 }).stroke({ width: 2, color: 0xfff4e2 });
  }
  async function edPlaceAt(sx, sy, first) {
    if (!edit || !edit.wd || edit.busy || w !== edit.wd || !edPlace) return;
    const wd = edit.wd, [x, y] = toWorld(sx, sy), t = loc(x, y, [0, 0]), n = edit.places.length, steps = VB['sim/hex'].hexSteps;
    if (edPlace === 'way') { // drawn: the tiles the drag passes, each a neighbour of the last
      if (first === true) edWay = [];
      if (!edWay) return;
      const last = edWay.length ? edWay[edWay.length - 1] : -1;
      if (first !== null && t >= 0 && t !== last && !wd.water[t]) {
        const gap = last >= 0 && steps(wd, last, t) > 1 ? VB['sim/routes'].findRoute(wd, last, t, 1e9) : null;
        edWay.push(...(gap ? gap.slice(1) : [t]));
      }
      edWays();
      if (first !== null) return;
      const way = edWay; edWay = null;
      if (way.length < 2) { edWays(); return; }
      edit.places.push({ way, stage: 3 });
    } else if (first !== true || t < 0) return;
    else if (edPlace === 'route') { // found: from the first press to the second
      if (edFrom < 0 || edFrom === t) { edFrom = wd.water[t] ? -1 : t; edWays(); edSettleEcho(); return; }
      const way = wd.water[t] ? null : VB['sim/routes'].findRoute(wd, edFrom, t, 1e9);
      edFrom = -1;
      if (way && way.length > 1) edit.places.push({ way, stage: 3 });
    } else if (edPlace === 'remove') {
      let k = -1, kd = 2; // the nearest; of those on one tile, the last placed (a person before the house)
      edit.places.forEach((p, j) => { for (const a of edAnchors(p)) { const d = steps(wd, t, a); if (d <= kd) { kd = d; k = j; } } });
      if (k < 0) return;
      edit.places.splice(k, 1);
    } else if (edPlace === 'pawn') { // a person, of the house pressed on or beside
      const f = edit.sim ? edit.sim.farmsteads.find((g) => steps(wd, g.house, t) <= 1) : null,
        age = clamp(Math.round(Number($('edPawnAge').value) || 0), 0, 80);
      edit.places.push({ pawn: f ? f.house : t, sex: $('edPawnSex').value, age, servant: $('edPawnRole').value === 'servant' });
    } else {
      edit.places.push(edPlace === 'village' ? { village: t, farms: Number($('edFarms').value) }
        : edPlace === 'farm' ? { farm: t, fill: $('edFill').value } : edPlace === 'empty' || edPlace === 'ruin' ? { farm: t, fill: edPlace } : {
          [edPlace]: t });
    }
    const was = edPlace;
    await edRelay();
    const msg = was !== 'remove' && edit.places.length <= n ? ED_NO_ROOM[was] : '';
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
    $('edFillRow').hidden = edPlace !== 'farm'; $('edPawnRow').hidden = edPlace !== 'pawn';
    $('edPlaceNote').textContent = { village: 'Press on the land: the village is laid about that tile, with the farms that find room.',
      farm: 'Press on the land: the house stands on that tile, its fields beside it.',
      pawn: 'Press on a house: the person joins its household. On an empty farm the first adult founds the household and holds the farm.',
      green: 'Press on a free tile by households you placed: their village takes it as its green, with a well.',
      empty: 'Press on the land: a house and fields with no one, for an heir or a settler to take.',
      ruin: 'Press on the land: a farm long empty, its house fallen in and its fields grown over.',
      field: 'Press on free ground near a house: the field is of the nearest farm.',
      meadow: 'Press on free meadow, marsh or heath near a house: the hay meadow is of the nearest farm.',
      way: 'Drag over the land to draw the road. Where no one walks it, it fades with the years.',
      route: edFrom >= 0 ? 'Now press where the road ends.' : 'Press where the road begins, then where it ends: the way is found as people would walk it.',
      remove: 'Press on a village\u2019s green, or on a house, field, meadow or road you placed. On a house, those added to it go first.' }[edPlace] ||
        'Drag the map to move it. Choose what to place.';
    const farms = sim ? sim.households.length : 0, vs = sim ? sim.villages.length : 0, people = sim ? sim.pawns.length : 0;
    const bare = sim ? sim.farmsteads.filter((f) => f.household === null).length : 0;
    const roads = edit ? edit.places.filter((p) => p.way).length : 0,
      lived = !!sim && sim.households.length > 0; // someone to play
    $('edPlaced').textContent = (sim &&
      farms ? `${farms} ${farms === 1 ? 'household' : 'households'} in ${vs} ${vs === 1 ? 'village' : 'villages'}, ${people} people`
      : roads || bare ? 'No one lives here yet' : 'Nothing yet') + (bare ? `, ${bare} empty ${bare === 1 ? 'farm' : 'farms'}` : '')
      + (roads ? `, ${roads} ${roads === 1 ? 'road' : 'roads'}.` : '.')
      + (lived ? '' : ' Play begins once someone lives here.');
    $('edUnplace').disabled = !edit || edit.busy || !edit.places.length;
    $('edPlay').disabled = !edit || edit.busy || !edit.wd || (manual && !lived);
  }
  $('edSettled').innerHTML = '<option value="manual">Placed by hand</option>'
    + START_ORDER.map((k) => `<option value="${k}">${START_WORDS[k].name}</option>`).join('');
  $('edSettled').value = 'founders';
  // by hand or by a scenario: the picture of what is placed stands only while it is what Play would begin on
  $('edSettled').addEventListener('input', () => {
    edHoldBrush(); edSettleEcho(); if (edit && edit.wd && !edit.busy && (edit.sim || edit.places.length)) edRelay(); });
  $('edPlaces').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    edPlace = b.dataset.place === 'none' ? null : b.dataset.place; edFrom = -1; edWay = null; $('edPlaceMsg').hidden = true;
    edHoldBrush(); edWays(); edSettleEcho();
  });
  for (const b of $('edPlaces').querySelectorAll('[data-ico]')) b.insertAdjacentHTML('afterbegin', actIcon(b.dataset.ico));
  $('edFarms').addEventListener('input', edSettleEcho);
  $('edUnplace').addEventListener('click', () => { if (edit && !edit.busy && edit.places.length) { edit.places = []; edRelay(); } });
  edSettleEcho();
