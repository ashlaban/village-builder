// @sys page/tileinfo: the tile info panel
  // ---- tile info ----
  function showTile(i) {
    const box = $('tile');
    if (i < 0 || !w) { box.hidden = true; selVillage = -1; selFarm = -1; return; }
    const b = G.BIOMES[w.biome[i]], col = i % w.COLS, row = (i / w.COLS) | 0;
    let line;
    if (w.water[i]) {
      const d = w.csample(w.cdist, w.hx[i], w.hy[i]);
      const m = b.key === 'lake' ? 2 + 28 * (1 - Math.exp(-d / 70)) : 3 + 150 * (1 - Math.exp(-d / (150 * w.KS)));
      line = `Depth about ${Math.round(m)} m`;
    } else {
      const soil = w.hm[i] < 0.33 ? 'dry ground' : w.hm[i] < 0.56 ? 'fresh ground' : 'damp ground';
      line = `Elevation ${Math.max(2, Math.round(w.he[i] * 1400))} m, ${soil}`;
    }
    const rg = w.regions[w.region[i]];
    const where = rg.label ? `Tile ${col}, ${row} in region ${rg.label}` : `Tile ${col}, ${row}, open water`;
    const farm = settlementTileInfo(i), own = st ? Sim.ownerOf(st, i) : null, of = farm ? farm[2] : null;
    // the green stands for its village; a house for its farm, whose card is kept fresh while it is shown
    if (of && of.village !== undefined) { selVillage = of.village; selFarm = -1; showVillage(of.village); return; }
    selVillage = -1; selFarm = of && of.house ? of.farm : -1;
    const ownLine = own ?
      [own.type === 'village' ? `${st.villages[own.id].name} village` : `${st.farmsteads[st.households[own.id].farmstead].name} household`] : [];
    const cross = ['no crossing on foot here', 'a ford crosses it', 'a bridge crosses it'][w.crossing[i]];
    const perDay = w.worn ? w.wear[i] / 70 : 0; // a count kept up by n crossings a day settles at about 70 n
    const worn = w.worn && w.worn[i] ? [`${['', 'Trodden ground', 'A worn path', 'A lane'][w.worn[i]]}, ${perDay >= 0.75
      ? `crossed about ${Math.round(perDay)} times a day` : 'little used now'}`] : [];
    const river = w.river[i] ? [`${Rivers.kind(w, i)} runs through; ${cross}`] : !w.water[i] && Sim.byRiver(w, i)
      ? [`By the river: a field here yields ${Math.round(Sim.RIVER.irrigation * 100)}% more`] : [];
    const claims = claimLines(i), cutBy = st && Sim.woodOf(st, i); // the village whose wood the tile is (VB-326)
    if (cutBy) claims.push(`Cut for firewood by ${cutBy.name}`);
    if (farm) card(farm[0], [...farm[1], ...(of.house ? [] : ownLine), ...claims, where], '', tileExtras(of));
    else card(b.name, [line, ...river, ...worn, ...ownLine, ...claims, ...(w.treesMax[i] > 0 ? [`${Math.round(w.trees[i])} of ${w.treesMax[i]} trees`] : []),
      ...(w.stones[i] > 0 ? [`${w.stones[i] < 85 ? 'Few' : w.stones[i] < 170 ? 'Some' : 'Many'} stones`] : []), ...groundLines(i), where]);
  }
  // What lies in the ground (gen/geology): the bedrock, and a deposit with the loads left in it. Nothing digs yet. An upland ore shows only
  // as the viewer knows it (page/ground's depositShown).
  function groundLines(i) {
    if (!w.rock || !w.rock[i]) return [];
    const how = w.deposit[i] ? depositShown(i) : 0, d = how ? w.deposit[i] : 0, left = st ? Sim.depositLeftNow(st, i) : w.depositLeft[i];
    return [`${Geo.ROCKS[w.rock[i]].name} bedrock`,
      ...(d ? [`${Geo.DEPOSITS[d].name}: ${left === Geo.ENDLESS ? 'more than can ever be dug' : `about ${left} loads`}${how === 2 ?
        ', which no village has found' : ''}`] : [])];
  }
  // The claims on a tile (sim/claims) and its cairn (VB-157), one line each, for the tile panel.
  function claimLines(i) {
    if (!st) return [];
    const who = (by) => (by.type === 'village' ? st.villages[by.id].name : by.type === 'household' ? st.farmsteads[st.households[by.id].farmstead].name
      : `the family of ${Sim.fullName(st.pawns[by.id])}`);
    const WHY = { outland: 'as outland', field: 'for a field', meadow: 'for a hay meadow', farm: 'to take the farm', birthright: 'by birthright' };
    const out = Sim.claimsOn(st, i).map((c) => (c.state === 'realised'
      ? `Held ${WHY[c.why]} by ${who(c.by)}${c.until !== null ? ` until year ${Math.floor(c.until / Sim.YEAR) + 1}` : ''}`
      : `Claimed by ${who(c.by)} ${WHY[c.why]}, ${Math.round(Sim.claimStrength(st, c) * 100)}% strong`));
    const cairn = st.cairns && st.cairns.get(i);
    if (cairn) out.push(`A cairn between ${st.villages[cairn.a].name} and ${st.villages[cairn.b].name}, set in year ${Math.floor(cairn.t / Sim.YEAR) + 1}`);
    return out;
  }
  function pick(sx, sy, inspect = true) {
    if (!w || document.body.classList.contains('ui-hidden') || startOpen()) return; // the start's picture is only dragged and zoomed
    if (choose) { if (inspect) chooseAt(sx, sy); return; } // whom to play takes the map's clicks (page/choose)
    if (!$('editor').hidden) { // the editor: no cards; the tile under the pointer is only marked
      const [ex, ey] = toWorld(sx, sy), t = loc(ex, ey, [0, 0]);
      if (t !== sel) { sel = t; selPawn = -1; hoverDirty = true; }
      return;
    }
    if (!inspect && (selectionPinned || barMenu || tool || (activePanel && activePanel !== 'tile'))) return; // no hover card over the action bar's list or tool
    if (inspect) selectionPinned = true;
    const [x, y] = toWorld(sx, sy), pw = pawnAt(x, y);
    if (inspect && tool) { toolTap(pw, labelAt(x, y), loc(x, y, [0, 0])); return; } // the action bar's tool waits for a tile (page/actbar)
    if (pw >= 0) { if (inspect || pw !== selPawn) selectPawn(pw, inspect); return; }
    const named = inspect ? labelAt(x, y) : null; // a click on a name on the map selects the village or the lone farm it names
    if (named) { if (named.village !== undefined) selectVillage(named.village, false); else selectFarm(named.farm, false); return; }
    const i = loc(x, y, [0, 0]);
    if (inspect || !activePanel) openPanel('tile');
    if (i !== sel || selPawn >= 0 || inspect) { selPawn = -1; sel = i; hoverDirty = true; showTile(i); }
  }
  function drawHover() {
    hoverG.clear();
    if (sel < 0 || !w || selPawn >= 0) return;
    const pts = [];
    for (let k = 0; k < 6; k++) { const a = (Math.PI / 180) * (30 + 60 * k); pts.push(w.hx[sel] + Math.cos(a) * w.R, w.hy[sel] + Math.sin(a) * w.R); }
    hoverG.poly(pts).fill({ color: 0xffffff, alpha: 0.14 }).stroke({ width: 2.4 / cam.z, color: 0xffffff, alpha: 0.95 });
  }

