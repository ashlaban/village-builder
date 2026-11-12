// @sys page/editor: the world editor: a world alone on the stage, with no run, raised from the generator's parameters shown in its panel
  // ---- world editor ----
  // The parameters are the options of G.generate: the seed, the grid's columns and rows, the share of land and the regions' radius. A
  // world is raised from the form on Raise the land, never while a control moves. `edit.p` holds the parameters of the world raised, so
  // the panel can say when the form has moved on from it. It is page state, as the showcase island is: never saved, and no game.
  const ED = { size: 's', land: 36, region: 7, cols: [40, 400], rows: [30, 300] };
  let edit = null; // { p: {seed, cols, rows, land, region} of the world raised, wd, painted, busy }
  const editorOpen = () => !$('editor').hidden;
  const edSizeOf = (cols, rows) => Object.keys(SIZES).find((k) => SIZES[k][0] === cols && SIZES[k][1] === rows) || 'c';
  function edFill(p) {
    $('edSeed').value = String(p.seed); $('edCols').value = p.cols; $('edRows').value = p.rows; $('edSize').value = edSizeOf(p.cols, p.rows);
    $('edLand').value = p.land; $('edRegion').value = p.region;
    edEcho();
  }
  // What the form asks for, or null where a field does not hold a number in its range (the form's own validity says which).
  function edRead() {
    if (!$('edForm').checkValidity()) return null;
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
    $('edName').textContent = wd.name; $('edMeta').textContent = `World editor · seed ${wd.seed}, ${wd.COLS} by ${wd.ROWS} tiles`;
  }
  function edBusy(on, p) {
    edit.busy = on; $('edGo').disabled = $('edMenu').disabled = $('edReset').disabled = on;
    $('edBar').hidden = !on; $('edBarFill').style.width = `${((p || 0) * 100).toFixed(1)}%`;
    if (on) { $('edState').textContent = 'Raising the land'; $('edState').classList.remove('changed'); } else edEcho();
  }
  // The editor's world on the stage, alone: no run, so nothing of the game is drawn or advanced. `whole`: seen from above, all of it.
  async function edShow(whole) {
    demo = true; demoAt = null; demoRun = null; document.body.classList.add('demo');
    await swapWorld(edit.wd, null, edit.painted);
    intro = null;
    if (whole) { T = 2; cam.x = edit.wd.W / 2; cam.y = edit.wd.H / 2; cam.z = zt = zMin(); vel.x = vel.y = 0; }
    edFacts();
  }
  function edRaise() {
    const p = edRead();
    if (!p || !edit || edit.busy) { $('edForm').reportValidity(); return; }
    $('edMsg').hidden = true; edBusy(true, 0);
    onStage(async () => {
      try {
        await frame(); await frame();
        const opt = { cols: p.cols, rows: p.rows, landFrac: p.land / 100, regionRadius: p.region };
        const wd = await drive(G.generate(p.seed, opt), (x) => { $('edBarFill').style.width = `${(x * 60).toFixed(1)}%`; });
        const painted = await paintOverview(wd, (x) => { $('edBarFill').style.width = `${(60 + x * 40).toFixed(1)}%`; });
        if (!edit) return; // a game was raised or loaded meanwhile
        const first = !edit.wd || edit.wd.COLS !== wd.COLS || edit.wd.ROWS !== wd.ROWS;
        edit.p = p; edit.wd = wd; edit.painted = painted;
        if (editorOpen()) await edShow(first);
      } catch (e) {
        console.warn('The land could not be raised', e);
        $('edMsg').hidden = false; $('edMsg').textContent = 'This land could not be raised. Try another seed or other settings.';
      }
      if (edit) edBusy(false);
    });
  }
  // From the main menu. A game that is open is kept aside, as at the start (page/start), and comes back when the editor is left.
  function openEditor() {
    if (building || skipping) return;
    if (w && !demo && !aside) aside = { wd: w, sim: st, painted: stagePainted, cam: { x: cam.x, y: cam.y, z: cam.z } };
    openPanel(null); closeSpeedOptions(); closeNotices();
    $('landing').hidden = true; $('genScreen').hidden = true; $('editor').hidden = false; document.body.classList.add('editing');
    loader.classList.add('done');
    if (!edit) {
      edit = { p: null, wd: null, painted: null, busy: false };
      if ($('edSeed').value) edEcho(); // the settings of an earlier visit, whose world a game has dropped
      else edFill({ seed: choice.seed, cols: SIZES[ED.size][0], rows: SIZES[ED.size][1], land: ED.land, region: ED.region });
    }
    if (!edit.wd) edRaise();
    else if (w !== edit.wd) onStage(() => (editorOpen() && edit && edit.wd ? edShow(true) : null));
    $('edGo').focus({ preventScroll: true });
  }
  // Main menu: the game kept aside comes back behind it; with none, the editor's world stays there.
  function closeEditor() {
    if (!editorOpen() || (edit && edit.busy)) return;
    $('editor').hidden = true; document.body.classList.remove('editing'); sel = -1; hoverDirty = true;
    onStage(async () => {
      if (aside && !editorOpen()) await restoreAside();
      if (!editorOpen() && $('genScreen').hidden && !building) showLanding();
    });
  }
  // A game raised or loaded drops the editor's world (page/loader, build); its settings stay in the form.
  function dropEditor() { edit = null; $('edFacts').hidden = true; $('edName').textContent = 'World editor'; $('edMeta').textContent = 'No land raised yet'; }

  $('landEdit').addEventListener('click', () => openEditor());
  $('edMenu').addEventListener('click', () => closeEditor());
  $('edForm').addEventListener('submit', (e) => { e.preventDefault(); edRaise(); });
  $('edForm').addEventListener('input', (e) => {
    if (e.target.id === 'edSize' && SIZES[e.target.value]) [$('edCols').value, $('edRows').value] = SIZES[e.target.value];
    if (e.target.id === 'edCols' || e.target.id === 'edRows') $('edSize').value = edSizeOf(Number($('edCols').value), Number($('edRows').value));
    edEcho();
  });
  $('edReroll').addEventListener('click', () => { $('edSeed').value = String((Math.random() * 1e6) | 0); edEcho(); });
  $('edReset').addEventListener('click', () => {
    edFill({ seed: Number($('edSeed').value) || 0, cols: SIZES[ED.size][0], rows: SIZES[ED.size][1], land: ED.land, region: ED.region }); });
  $('edFold').addEventListener('click', () => {
    const folded = $('edForm').classList.toggle('folded');
    $('edFold').textContent = folded ? 'Show' : 'Hide'; $('edFold').setAttribute('aria-expanded', String(!folded));
  });
