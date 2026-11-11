// @sys page/loader: the main menu, the generation screen and the loader: building a world and a scenario, and the menu's showcase island
  // ---- loader ----
  const loader = $('loader');
  const setLoad = (text, p) => { if (text) $('loadText').textContent = text; if (p != null) $('loadBar').style.width = (p * 100).toFixed(1) + '%'; };
  async function drive(gen, onP) {
    let r, last = performance.now();
    while (!(r = gen.next()).done) {
      onP(r.value);
      if (performance.now() - last > 30) { await frame(); last = performance.now(); }
    }
    return r.value;
  }

  let building = false;
  const SIZES = { t: [120, 85], s: [180, 130], m: [280, 200], l: [380, 270] };
  let choice = { seed: (Math.random() * 1e6) | 0, scenario: 'founders', size: 'm' }; // what the generation screen shows
  // The landing page: New archipelago (the generation screen) and Load archipelago (the Saves overlay; page/saves). A game that is open
  // stays as it is, paused, until another is generated or loaded: Back to game returns to it (Kim, 10 Nov).
  // With no game open, a tiny island of its own plays behind the menu screens (VB-307): `demo` says the world and the run on the stage are
  // that showcase, not a game. It is page state: never saved, never offered to go back to, and dropped when a game is generated or loaded.
  let demo = false, demoJob = null, demoAt = null;
  // seeds whose island of this size holds standing villages (populous asks for more people than most hold) and looks well from its largest
  const DEMO = { seeds: [7, 12, 15, 26, 28, 29, 43, 54, 75, 98], cols: 56, rows: 40, speed: 3 };
  function showLanding() {
    $('landBack').hidden = $('gameInfo').hidden = !w || demo; // the open game: its name, its map and settings, at the menu's top left (VB-338)
    $('landLoad').textContent = !w || demo ? 'Load archipelago' : 'Saves'; // with a game open, it can be saved there too
    $('genScreen').hidden = true; $('landing').hidden = false; loader.classList.add('done'); $('landNew').focus();
  }
  function showGenScreen(msg) {
    $('genSeed').value = String(choice.seed); $('genScenario').value = choice.scenario; $('genSize').value = choice.size;
    $('genMsg').hidden = !msg; $('genMsg').textContent = msg || '';
    $('landing').hidden = true; $('genScreen').hidden = false; loader.classList.add('done'); $('genSeed').focus();
  }
  // The sea and the overview level of a world, painted before it is swapped in; onP hears the share done.
  async function paintOverview(wd, onP) {
    const wc = makeCanvas(wd.CW, wd.CH);
    G.bakeWater(wd, wc.getContext('2d'));
    const nx2 = Math.ceil(wd.W / LV[2].size), ny2 = Math.ceil(wd.H / LV[2].size), over = [];
    for (let cy = 0; cy < ny2; cy++) for (let cx = 0; cx < nx2; cx++) {
      const canvas = makeCanvas(TEX, TEX);
      await drive(chunkJob(wd, 2, cx, cy, canvas), (p) => onP((over.length + p) / (nx2 * ny2)));
      over.push({ cx, cy, canvas });
    }
    return { wc, over };
  }
  // Swaps a painted world and its run onto the stage, in place of the one there.
  async function swapWorld(wd, sim, { wc, over }) {
    job = null;
    for (const k of [...chunks.keys()]) dropChunk(k);
    for (const ch of L.water.removeChildren()) ch.destroy({ texture: true, textureSource: true });
    if (regionG) { regionG.destroy(); regionG = null; }
    w = wd; loc = G.hexLocator(wd); sel = -1; hoverDirty = true; showTile(-1);
    const water = new PIXI.Sprite(texFrom(wc));
    water.scale.set(wd.STEP); water.position.set(-wd.STEP / 2, -wd.STEP / 2);
    L.water.addChild(water);
    for (const o of over) addChunk(2, o.cx, o.cy, o.canvas);
    regionG = buildRegions(wd); L.regions.addChild(regionG);
    if (!waves.length) {
      waves = [new PIXI.TilingSprite({ texture: waveTex, width: wd.W, height: wd.H })];
      for (const s of waves) L.waves.addChild(s);
    }
    makeClouds(wd);
    drawMinimap(wd, wc, over);
    await buildSettlement(wd, sim);
    if (landG) landG.clear();
    if (landOn) drawLand();
  }
  // save: a save of this build to go on from (Sim.save's data; page/saves), on the world regenerated from its seed and size.
  async function build(seed, scenario, size, save = null) {
    choice = { seed, scenario, size };
    $('genScreen').hidden = true; $('landing').hidden = true;
    building = true; $('menuBtn').disabled = true;
    loader.classList.remove('done'); $('playOffer').hidden = true; followPlayed = false; endTool(); playMsg = null; skipCursor = null; dropSkipNote();
    setLoad('Raising the land', 0);
    if (demoJob) await demoJob; // the showcase island is still being raised: it is swapped in first, and out again below
    await frame(); await frame();
    const wd = await drive(G.generate(seed, { cols: SIZES[size][0], rows: SIZES[size][1] }), (p) => setLoad(null, p * 0.5));
    setLoad(save ? 'Returning to the villages' : 'Settling the founders', 0.52); await frame();
    let sim = null;
    try { sim = save ? Sim.load(wd, save) : Sim.seed(wd, seed, scenario); }
    catch (e) { console.warn(save ? 'The save could not be loaded' : 'No settlement on this map for this scenario', e); }
    if (!sim) {
      building = false; $('menuBtn').disabled = false;
      showGenScreen(save ? 'That save could not be loaded.' : 'This map has no room for that scenario. Pick another seed, size or scenario.');
      return;
    }
    treeSel = -1; selPawn = -1; selVillage = -1; selFarm = -1; selectionPinned = false;
    openPanel(null); peopleFolds.clear(); peopleQuery = ''; $('peopleSearch').value = '';
    settlersHTML = ''; $('settlers').textContent = ''; customVillage = 0; comparisonOpen = false; customsStamp = '';
    setLoad('Painting the overview', 0.55); await frame();
    const painted = await paintOverview(wd, (p) => setLoad(null, 0.55 + p * 0.4));
    setLoad('Drawing the regions', 0.96); await frame();
    demo = false; demoAt = null; document.body.classList.remove('demo');
    await swapWorld(wd, sim, painted);
    const landRegions = wd.regions.filter((r) => r.land > 0).length;
    $('name').textContent = wd.name;
    const named = (sel, v) => { const o = [...$(sel).options].find((x) => x.value === v); return o ? o.textContent : v; };
    $('meta').textContent = `${named('genScenario', scenario)}, ${named('genSize', size).split(' (')[0].toLowerCase()} map, seed ${wd.seed}: `
      + `${wd.COLS} by ${wd.ROWS} tiles, ${landRegions} regions`;
    document.title = `${wd.name}, a hex archipelago`;

    // Opening move: start on the whole chart, then glide down through the clouds to the village.
    let best = sim ? sim.villages[0].center : -1, bd = sim ? -1 : Infinity;
    for (let i = 0; i < wd.N && bd >= 0; i++) {
      if (wd.water[i]) continue;
      const d = Math.hypot(wd.hx[i] - wd.W / 2, wd.hy[i] - wd.H / 2);
      if (d < bd) { bd = d; best = i; }
    }
    const z0 = zMin(), z1 = clamp(34 / wd.HW, z0, zMax);
    const tx = best >= 0 ? wd.hx[best] : wd.W / 2, ty = best >= 0 ? wd.hy[best] : wd.H / 2;
    const end = { x: tx, y: ty, z: z1 };
    T = 2;
    if (reduceMotion) { cam.x = tx; cam.y = ty; cam.z = z1; }
    else {
      cam.x = wd.W / 2; cam.y = wd.H / 2; cam.z = z0;
      intro = { t: -0.6, d: 3.8, x0: cam.x, y0: cam.y, z0, x1: tx, y1: ty, z1, T: levelFor(z1, 1), rect: viewRect(LV[levelFor(z1, 1)].size * 0.25, end) };
    }
    zt = cam.z; vel.x = vel.y = 0;
    loader.classList.add('done');
    if (!sim.player) offerPlay(); else if (sim.pawns[sim.player.pawn].alive) openPanel('actions');
    building = false; $('menuBtn').disabled = false;
  }

  // The showcase island: a very small generated one with its villages standing (populous; founders where that finds no room), raised
  // behind the main menu without the loader. The camera rests on its largest village and drifts (page/frame); the run goes on at 3x.
  async function buildDemo() {
    const seed = DEMO.seeds[(Math.random() * DEMO.seeds.length) | 0]; // a visit's island: the page's choice, as the offered seed is
    const wd = await drive(G.generate(seed, { cols: DEMO.cols, rows: DEMO.rows }), () => {});
    let sim = null;
    for (const sc of ['populous', 'founders']) { try { sim = sim || Sim.seed(wd, seed, sc); } catch (e) { /* no room: the next */ } }
    if (!sim) return; // the menu stays on the plain sea
    const painted = await paintOverview(wd, () => {});
    demo = true; document.body.classList.add('demo');
    await swapWorld(wd, sim, painted);
    const v = sim.villages.reduce((a, b) => (b.farmsteads.length > a.farmsteads.length ? b : a));
    demoAt = { x: wd.hx[v.center], y: wd.hy[v.center], r: wd.HW * 5 };
    intro = null; T = 2; cam.x = demoAt.x; cam.y = demoAt.y; cam.z = zt = clamp(52 / wd.HW, zMin(), zMax); vel.x = vel.y = 0;
  }
  function startDemo() { demoJob = buildDemo().catch((e) => console.warn('The showcase island could not be raised', e)).then(() => { demoJob = null; }); }

  function makeClouds(wd) {
    for (const c of clouds) { c.spr.destroy(); c.sh.destroy(); }
    clouds = [];
    const r = G.mulberry32(wd.seed * 7 + 3), K = wd.KS;
    for (let k = 0; k < 13; k++) {
      const tex = cloudTex[k % cloudTex.length], s = (1.8 + r() * 1.8) * K;
      const spr = new PIXI.Sprite(tex), sh = new PIXI.Sprite(tex);
      spr.anchor.set(0.5); sh.anchor.set(0.5); spr.scale.set(s, s * (0.8 + r() * 0.4)); sh.scale.copyFrom(spr.scale);
      sh.tint = 0x06202c;
      spr.x = r() * (wd.W + 800 * K) - 400 * K; spr.y = r() * wd.H;
      L.shadows.addChild(sh); L.clouds.addChild(spr);
      clouds.push({ spr, sh, vx: (9 + r() * 9) * K, vy: (r() - 0.5) * 3 * K });
    }
  }

