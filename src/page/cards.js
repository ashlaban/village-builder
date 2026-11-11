// @sys page/cards: the selection cards of farms and villages, the links between cards, and flying the camera to what is selected
  // ======== selection cards ========
  // What is selected is the page's own state: a pawn (selPawn), a tile (sel), and with a tile, the farm whose house stands on it (selFarm);
  // or a village (selVillage), whose green, where it has one, is the tile shown.
  let selVillage = -1, selFarm = -1;
  function flyTo(x, y, z1 = Math.max(cam.z, 1.5)) {
    intro = { t: 0, d: 1.1, x0: cam.x, y0: cam.y, z0: cam.z, x1: x, y1: y, z1, T: levelFor(z1, 1),
      rect: viewRect(LV[levelFor(z1, 1)].size * 0.25, { x, y, z: z1 }) };
  }
  const villageSpot = (v) => (v.center >= 0 ? v.center : st.farmsteads[v.farmsteads[0]].house);
  function selectFarm(id, fly = true) {
    const f = st.farmsteads[id];
    selectionPinned = true; openPanel('tile'); selPawn = -1; sel = f.house; hoverDirty = true; showTile(sel);
    if (fly) flyTo(w.hx[f.house], w.hy[f.house]);
  }
  function selectVillage(id, fly = true) {
    const v = st.villages[id], at = villageSpot(v);
    selectionPinned = true; openPanel('tile'); selPawn = -1; selFarm = -1; selVillage = id; sel = v.green ? v.center : -1; hoverDirty = true;
    showVillage(id);
    if (fly) flyTo(w.hx[at], w.hy[at], Math.max(cam.z, 0.9));
  }
  // The key F and the card's button: bring what is selected to the middle of the view.
  function centreSelection() {
    if (!st || activePanel !== 'tile') return;
    if (selPawn >= 0) {
      const a = st.agents[selPawn], f = farmOf(st.pawns[selPawn]);
      if (a && (!a.inside || f)) flyTo(a.inside ? w.hx[f.house] : a.x, a.inside ? w.hy[f.house] : a.y);
    } else if (selVillage >= 0) { const at = villageSpot(st.villages[selVillage]); flyTo(w.hx[at], w.hy[at], Math.max(cam.z, 0.9)); }
    else if (sel >= 0) flyTo(w.hx[sel], w.hy[sel], Math.max(cam.z, 1.2));
  }
  $('tileFocus').addEventListener('click', centreSelection);
  // A name on the map under a point of the world, while it shows.
  function labelAt(x, y) {
    for (const l of labels) if (l.t.visible && l.t.alpha > 0.3 && Math.abs(x - l.x) < l.t.width / 2 && y < l.y && y > l.y - l.t.height) return l;
    return null;
  }

  // ---- links and rows ----
  const pawnChip = (id) => `<button type="button" class="chip" data-pawn="${id}">${faceImg(id, 'mini')}${esc(Sim.fullName(st.pawns[id]))}</button>`;
  const farmChip = (f) => `<button type="button" class="chip" data-farm="${f.id}">${iconImg(farmIcon(f), 'mini')}${esc(f.name)}</button>`;
  const villageChip = (v) => `<button type="button" class="chip" data-village="${v.id}">${iconImg(villageIcon(v), 'mini')}${esc(v.name)}</button>`;
  const row = (attr, img, name, note, state) => `<button type="button" class="row" ${attr}>${img}<span class="who">${esc(name)}<i>${
    esc(note)}</i></span><span class="state">${state}</span></button>`;
  // One listener for every link: a person, a farm, a village, or a village's customs.
  function follow(e) {
    const b = e.target.closest('button[data-pawn], button[data-farm], button[data-village], button[data-customs]');
    if (!b || !st) return;
    if (b.dataset.pawn) focusPawn(+b.dataset.pawn);
    else if (b.dataset.farm) selectFarm(+b.dataset.farm);
    else if (b.dataset.village) selectVillage(+b.dataset.village);
    else {
      customVillage = +b.dataset.customs; customsStamp = '';
      if (activePanel !== 'customs') openDrawer('customs'); else buildCustoms();
      renderDrawer();
    }
  }
  $('settlers').addEventListener('click', follow);
  $('tile').addEventListener('click', follow);

  // ---- what a tile of a farm adds to its card: the farm's icon, kind and people on its house; a way back to the farm from its fields ----
  function tileExtras(of) {
    const f = st.farmsteads[of.farm], v = st.villages[f.village];
    if (!of.house) return { links: farmChip(f) + villageChip(v) };
    const hh = f.household === null ? null : st.households[f.household];
    const list = hh ? `<h3>Lives here</h3>${hh.members.map((id) => {
      const p = st.pawns[id];
      return row(`data-pawn="${id}"`, faceImg(id, 'mini'), Sim.fullName(p), `${p.age}, ${roleLine(p)}`, esc(Sim.describe(st, id)));
    }).join('')}` : '';
    return { badge: iconImg(farmIcon(f), hh ? 'badge' : 'badge gone'), kind: `${hh ? 'Farm' : f.state === 'ruin' ? 'Ruined farm' : 'Empty farm'} in ${v.name}`,
      links: villageChip(v), list };
  }
  function showVillage(id) {
    const v = st.villages[id], farms = v.farmsteads.map((k) => st.farmsteads[k]), lived = farms.filter((f) => f.household !== null);
    const people = lived.reduce((n, f) => n + st.households[f.household].members.length, 0), empty = farms.length - lived.length;
    const worst = v.fence.length ? Math.min(...v.fence.map((fence) => fence.cond)) : 1;
    const mother = v.founded ? st.villages[v.founded.from] : null;
    const lines = [`${people} people in ${lived.length} ${lived.length === 1 ? 'household' : 'households'}${empty ? `, ${empty} empty` : ''}`,
      `${v.fence.length ? `Fence in ${worst < .45 ? 'poor' : worst < .65 ? 'fair' : 'good'} repair` : 'No fence yet'}; ${
        v.well ? 'a shared well and woods' : 'shared woods'}`,
      v.founded ? `Founded in year ${Math.floor(v.founded.t / Sim.YEAR) + 1} from ${mother.name} by ${Sim.fullName(st.pawns[v.founded.by])}` : '',
      v.crowded > 0 ? `Crowded: ${v.crowded} adults wait for land, and there is no room to clear` : ''].filter(Boolean);
    const list = `<h3>Farms</h3>${farms.map((f) => {
      const hh = f.household === null ? null : st.households[f.household];
      return row(`data-farm="${f.id}"`, iconImg(farmIcon(f), hh ? 'mini' : 'mini gone'), f.name,
        hh ? `Held by ${Sim.fullName(st.pawns[hh.holder])}` : `Empty for ${emptyYears(f)} years${f.state === 'ruin' ? ', a ruin' : ''}`,
        hh ? `${hungerMark(hh)}${hh.members.length} people · ${hungerWord(hh)}` : '');
    }).join('')}`;
    const customs = st.cenv.settlements[id] && st.cenv.settlements[id].id === id
      ? `<button type="button" class="chip" data-customs="${id}">Customs</button>` : '';
    card(v.name, lines, '', { badge: iconImg(villageIcon(v)), kind: v.green || farms.length >= 2 ? 'Village' : 'Lone farm',
      links: (mother ? villageChip(mother) : '') + customs, list });
  }

  // On a wide screen a pinned card opens with its details; on a phone it opens as its summary, to leave the map in view.
  if (!mobileUI.matches) {
    $('tile').classList.remove('collapsed');
    const b = document.querySelector('#tile .sheet-expand'); b.setAttribute('aria-expanded', 'true'); nameFold(b);
  }
