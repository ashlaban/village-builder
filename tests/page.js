// The page in verify (VB-409): the built page in jsdom on a 36 by 26 island (a size added to the page's own here, which start at 120 by
// 85), a founders game started from the address's hash, some days run through the speed buttons, and each panel opened once: whom to
// play, the overlays, the People sheet, a farm's card and its tabs, a pawn's card and its History tab, a village's Customs tab, the
// Culture pane, Debug, the family tree and the action bar. A quick check that the page loads, runs and draws its panels without an
// error, in about 3 seconds; tests/smoke.js (the tiny map, a year skipped, regenerating, the toasts, the goodwill rows, the tree's
// paths) and the Chromium scripts hold the rest at night.
const { openPage } = require('./lib/dompage');
const SEED = 18; // its island of this size holds the founders' two villages
const t0 = Date.now();
let patched = 0;
const P = openPage({
  label: 'PAGE',
  painted: [1, 0, 0], // one chunk of the nearest level painted in full, the rest left blank (tests/lib/dompage)
  url: `https://x.test/#sx${SEED}`,
  patch: (html) => html
    .replace(/const SIZES = \{ t:/, () => { patched++; return 'const SIZES = { x: [36, 26], t:'; })
    .replace('let allMaterials = false;', () => { patched++; return 'let allMaterials = false; window.__materialsHTML = (...a) => materialsHTML(...a); window.__materialsOf = (h) => materialsOf(h);'; })
    .replace('/^#([shp]?)([tsml]?)(\\d{1,9})$/', () => { patched++; return '/^#([shp]?)([tsmlx]?)(\\d{1,9})$/'; })
    .replace('const THEMES = {', () => { patched++; return 'const THEMES = window.__themes = {'; }) // the themes, to walk each (VB-1531)
    .replace('const chunks = new Map();', () => { patched++; return 'const chunks = new Map(); window.__lod = { chunks, w: () => w, st: () => st, T: () => T, size: (l) => LV[l].size, zoom(z) { cam.z = zt = z; }, zMin: () => zMin(), intro: () => !!intro, pending: () => pending, over: () => stagePainted.over };'; })
    .replace(/const t0 = performance\.now\(\);\s*while \(performance\.now\(\) - t0 < budget\) \{/, () => { patched++; return 'const t0 = performance.now(); let __n = 0; while (window.__lodSteps ? __n++ < window.__lodSteps : performance.now() - t0 < budget) {'; }),
});
const { doc, win, fail, tick, q, qa, $ } = P;
if (patched !== 6) { fail(`the page's sizes, its hash, its THEMES, its chunks or the painter's budget were not found to patch (${patched} of 6 patched)`); process.exit(1); }
const shown = (id) => !$(id).hidden;
const ckey2 = (o) => 2e6 + o.cy * 1000 + o.cx; // page/chunks' key of an overview chunk
const click = (el, what) => { if (!el) { fail(`no ${what} to click`); return false; } el.click(); tick(2); return true; };

async function main() {
  await P.until(() => $('loader').classList.contains('done') && !$('menuBtn').disabled, 30000, 'the game'); // a bound for a stuck page, not a budget
  const built = Date.now() - t0;
  console.log('built', built, 'ms |', $('meta').textContent);
  if (!/36 by 26 tiles/.test($('meta').textContent)) fail(`the game is not on the small island: ${$('meta').textContent}`);
  // whom to play opens on a new game, paused; Watch only closes it
  if (!shown('choose') || !q('#chooseCard .person')) fail('a new game does not open whom to play with a household');
  $('chooseWatch').click(); tick(5);
  if (shown('choose')) fail('Watch only leaves whom to play open');
  // some days as fast as it goes (a frame at 30x costs as much to draw and runs a fiftieth of the hours), then at 30x, where the clock
  // follows the simulation
  const st = () => P.seeded, day0 = Math.floor(st().t / 24);
  q('[data-speed="Infinity"]').click();
  for (let k = 0; k < 400 && st().t / 24 < day0 + 2.5; k++) tick(1); // as fast as it goes is as much as a frame's time allows
  q('[data-speed="30"]').click(); tick(10);
  const days = Math.floor(st().t / 24) - day0;
  if (days < 2) fail(`the game ran ${days} days`);
  const m = /Year (\d+), (\d\d):(\d\d)/.exec($('clockYear').textContent), real = Math.floor(st().t * 60 + 1e-6) % 1440;
  if (!m || (real - (+m[2] * 60 + +m[3]) + 1440) % 1440 > 5) fail(`the clock shows ${$('clockYear').textContent} at ${real} min of the day`);
  console.log('ran', days, 'days |', $('clockDate').textContent, '|', $('clockYear').textContent);
  q('[data-speed="1"]').click(); tick(2);
  // VB-1492: the close chunks over a tile whose trees changed stay on screen, every frame, until their replacements are painted; dropped
  // at once, they showed the blurry overview through their holes for the frames the repaints took
  {
    const lod = win.__lod;
    q('[data-speed="0"]').click(); lod.zoom(1);
    for (let k = 0; k < 300 && (lod.T() !== 0 || lod.pending()); k++) tick(1);
    const T = lod.T(), s = lod.size(T), wd = lod.w();
    const shownAt = () => [...lod.chunks.entries()].filter(([, c]) => c.l === T && c.spr.visible);
    const before = shownAt(), mid = before[Math.floor(before.length / 2)];
    const tile = mid && [...wd.hx.keys()].find((i) => Math.floor(wd.hx[i] / s) === mid[1].cx && Math.floor(wd.hy[i] / s) === mid[1].cy);
    if (T !== 0 || lod.pending() || tile === undefined) fail(`no close view painted in full to repaint (level ${T}, ${lod.pending()} areas left)`);
    else {
      lod.st().treeDirty.add(tile);
      let frames = 0, holes = 0, left = 1, swapped = 0;
      for (; frames < 100 && left; frames++) {
        tick(1);
        left = swapped = 0;
        for (const [k, c] of before) {
          const now = lod.chunks.get(k);
          if (!now || !now.spr.visible || now.spr.destroyed) holes++;
          else if (now.stale) left++;
          else if (now !== c) swapped++;
        }
      }
      if (holes || left || !swapped) fail(`a repaint left ${holes} holes in the close view over ${frames} frames, ${swapped} of ${before.length} chunks replaced, ${left} not yet`);
      console.log(`repainted ${swapped} of ${before.length} close chunks over ${frames} frames, ${holes} holes`);
    }
    q('[data-speed="1"]').click(); tick(2);
  }
  // VB-1491: the overview is repainted by the budgeted painter, as the close levels are: every one of its chunks stays resident and on
  // screen through the repaint, the old picture until its replacement is done. Painted one step a frame here, the repaint takes frames;
  // painted whole in the frame of the change, as before, no chunk was ever stale or replaced.
  {
    const lod = win.__lod, screen = P.APP.screen, was = { ...screen };
    Object.assign(screen, { width: 120, height: 80 }); // a window small enough that the whole island is seen at the overview's level
    q('[data-speed="0"]').click();
    for (let k = 0; k < 400 && lod.intro(); k++) tick(1); // the opening glide sets the zoom while it lasts
    lod.zoom(lod.zMin());
    for (let k = 0; k < 100 && lod.T() !== 2; k++) tick(1);
    const s = lod.size(2), wd = lod.w();
    const before = [...lod.chunks.entries()].filter(([, c]) => c.l === 2);
    const tiles = before.map(([, c]) => [...wd.hx.keys()].find((i) => Math.floor(wd.hx[i] / s) === c.cx && Math.floor(wd.hy[i] / s) === c.cy));
    if (lod.T() !== 2 || !before.length || tiles.some((t) => t === undefined)) fail(`no overview to repaint (level ${lod.T()}, ${before.length} chunks)`);
    else {
      win.__lodSteps = 1;
      for (const t of tiles) { lod.st().treeDirty.add(t); lod.st().biomeDirty.add(t); }
      let frames = 0, holes = 0, hidden = 0, staleFrames = 0, left = 1;
      for (; frames < 200 && left; frames++) {
        tick(1);
        left = 0;
        let stale = 0;
        for (const [k] of before) {
          const now = lod.chunks.get(k);
          if (!now || now.spr.destroyed) holes++;
          else if (!now.spr.visible) hidden++;
          else if (now.stale) stale++;
        }
        if (stale) staleFrames++;
        left = stale;
      }
      win.__lodSteps = 0;
      const swapped = before.filter(([k, c]) => lod.chunks.get(k) && lod.chunks.get(k) !== c).length;
      const kept = before.filter(([k]) => { const o = lod.over().find((x) => ckey2(x) === k); return o && !o.stale && o.canvas === lod.chunks.get(k).canvas; }).length;
      if (holes || hidden || left || swapped !== before.length || staleFrames < 2 || kept !== before.length)
        fail(`an overview repaint: ${holes} frames missing a chunk, ${hidden} hidden, ${swapped} of ${before.length} replaced over ${frames} frames (${staleFrames} showing the old picture, ${left} not done), ${kept} kept for a world set aside`);
      console.log(`repainted ${swapped} of ${before.length} overview chunks over ${frames} frames, the old picture shown for ${staleFrames}, ${holes} holes`);
    }
    Object.assign(screen, was); lod.zoom(1); tick(2);
    q('[data-speed="1"]').click(); tick(2);
  }
  // the overlays on and off
  for (const [b, key, want] of [['landBtn'], ['groundBtn', 'groundKey', /Bedrock/], ['reachBtn', 'reachKey', /Walking time/]]) {
    $(b).click(); tick(3);
    if (key && (!shown(key) || !want.test($(key).textContent))) fail(`the overlay of ${b} shows no key`);
    $(b).click(); tick(2);
    if (key && shown(key)) fail(`the overlay of ${b} keeps its key when off`);
  }
  // the People sheet: a village's fold lists its farms; a lived-in farm's card has its tabs, each stats with icons
  $('settlersBtn').click(); tick(5);
  for (const el of qa('.village-block')) { el.open = true; el.dispatchEvent(new win.Event('toggle')); }
  tick(2);
  if (q('#settlers .household-block, #settlers .show-map')) fail('the People sheet tells of a household in folds');
  const farmB = qa('#settlers button[data-farm]').find((b) => b.querySelector('.ppl'));
  if (click(farmB, 'lived-in farm')) {
    tick(3);
    if (!q('#tileStats .supplies, #tileStats .card-note')) fail("a farm's card shows no supplies");
    for (const [tab, want] of [['tabStores', /Grain/], ['tabLand', /Hay meadows/], ['tabAnimals', /Larder/]]) {
      if ($(tab).hidden) { fail(`a lived-in farm's card has no tab ${tab}`); continue; }
      $(tab).click(); tick(2);
      if (!shown('tileHouse') || !want.test($('tileHouse').textContent) || !q('#tileHouse .stat .stat-ico svg')) fail(`the tab ${tab} shows no stats with icons`);
    }
    // the Stores tab: three sections; the switch lists every material, those of none too, and is kept
    $('tabStores').click(); tick(2);
    const secs = qa('#tileHouse .card-sec').map((e) => e.textContent).join('|');
    if (!/^Supplies\|Materials\|Gear/.test(secs)) fail(`the Stores tab's sections are ${secs}`);
    const nStat = () => [...qa('#tileHouse .stat-grid')[1].children].filter((e) => !e.classList.contains('kinds')).length; // a heap's kinds row is not a material (VB-733)
    const few = nStat();
    click(q('#tileHouse [data-all-materials]'), 'All materials switch'); tick(2);
    if (nStat() !== 8 || !q('#tileHouse [data-all-materials][aria-pressed="true"]')) fail(`All materials lists ${nStat()} of 8 (${few} by default)`);
    // the layout takes a list of kinds and a work's asks: kinds show under the total only where more than one is held
    const mat = (key, n, kinds) => ({ key, label: key, icon: 'stone', n, kinds, title: key });
    const lay = win.__materialsHTML([mat('stone', 9, [{ label: 'granite', n: 5 }, { label: 'sandstone', n: 4 }]), mat('clay', 4, [{ label: 'one', n: 4 }])],
      [{ icon: 'field', name: 'A barn', step: 'Walls', asks: [{ key: 'stone', have: 6, want: 10 }] }], false);
    if ((lay.match(/class="stat wide kinds"/g) || []).length !== 1 || !/granite 5/.test(lay) || !/6 of 10/.test(lay) || !/asked: 10/.test(lay)) fail('the materials layout of a constructed list is wrong');
    // the stone heap by its rock (VB-733): the total, and each rock held as its label and its Ground tint
    const heap = win.__materialsOf({ farmstead: 0, stone: { granite: 3, sandstone: 2, slate: 0 } }).find((m) => m.key === 'stone');
    if (heap.n !== 5 || heap.kinds.map((k) => `${k.label} ${k.n}`).join(', ') !== 'Granite 3, Sandstone 2' || !heap.kinds.every((k) => /^#[0-9a-f]{6}$/.test(k.tint)))
      fail(`the heap by rock: ${JSON.stringify(heap)}`);
    click(q('#tileHouse [data-all-materials]'), 'All materials switch'); tick(2);
    $('tabFacts').click(); tick(2);
    // a pawn's card: its twelve traits as icons, no household tabs; its History tab lists dated lines
    if (click(q('#tileList button[data-pawn]'), "pawn on the farm's card")) {
      tick(3);
      if (qa('#tileStats .traits .trait svg').length !== 12) fail("a pawn's card does not show its twelve traits as icons");
      if (!$('tabStores').hidden) fail("a pawn's card keeps the household's tabs");
      $('tabHistory').click(); tick(2);
      const lines = qa('#historyList p:not(.more)').length;
      if (!shown('tileHistory') || !lines || qa('#historyList time').length !== lines) fail(`a pawn's History tab has ${lines} lines, not each dated`);
      $('tabFacts').click(); tick(2);
    }
  }
  // a village's card: its Customs tab is a charter of phrases; one opens its ways
  const vb = q('#settlers button[data-village]');
  if (click(vb, "village's row")) {
    tick(3);
    if ($('tabCustoms').hidden) fail("no Customs tab on a village's card");
    else {
      $('tabCustoms').click(); tick(2);
      const phrases = qa('#tileCustoms .charter [data-phrase]');
      if (!phrases.length) fail('the Customs tab shows no charter');
      else { phrases[0].click(); tick(2); if (!q('#tileCustoms .stand .way')) fail('an opened custom shows no ways'); }
      $('tabFacts').click(); tick(2);
    }
  }
  // the Culture pane: titled by its culture, a row a village
  $('cultureBtn').click(); tick(5);
  const rows = qa('#drawerBody [data-charter]').length, villages = st().cenv.settlements.length;
  if (!/ culture$/.test($('drawerTitle').textContent) || rows !== villages) fail(`the Culture pane is "${$('drawerTitle').textContent}" with ${rows} rows for ${villages} villages`);
  // Debug: a moving round runs; a selected pawn is killed, and a toast tells it
  $('debugBtn').click(); tick(3);
  if (!$('dbgWhen').textContent) fail('the Debug panel says nothing of when');
  q('[data-act="move"]').click();
  if (!/^Moving round done/.test($('dbgMsg').textContent)) fail(`the moving round: ${$('dbgMsg').textContent}`);
  const sb = q('#settlers button[data-pawn]');
  if (click(sb, 'settler')) {
    $('debugBtn').click(); tick(3);
    q('[data-act="kill"]').click();
    if (!/has died/.test($('dbgMsg').textContent)) fail(`the debug kill: ${$('dbgMsg').textContent}`);
    tick(10);
    if (!qa('#toasts .toast').some((b) => / was killed, aged \d+\.$/.test(b.textContent))) fail('the debug kill raised no toast');
  }
  // the family tree draws, and each of its views shows its person
  $('treeBtn').click(); tick(2);
  const nodes = qa('#treeSvg g.tn').length;
  if (!nodes) fail('the family tree is empty');
  else {
    q('#treeSvg g.tn:not(.dead)').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
    for (const mode of ['line', 'desc']) { q(`#treeModes [data-mode="${mode}"]`).click(); if (!q('#treeSvg g.tn.focus')) fail(`the ${mode} view does not show its person`); }
  }
  $('treeClose').click(); tick(2);
  // played as a holder: the action bar opens, and each group lists its acts
  const S = win.Sim, s = st();
  const holder = s.pawns.find((p) => p.alive && p.age >= 18 && S.isHolder(s, p.id));
  if (!holder || S.inhabit(s, holder.id) !== true) fail('no holder to play');
  else {
    tick(10);
    if (q('#actBar').hidden) q('#actionsBtn').click();
    tick(1);
    if (q('#actBar').hidden) fail("the dock's Actions did not open the bar");
    // VB-1536: the dock's and the bar's buttons are labelled icon buttons, the icon and then the name in the piece
    for (const b of qa('.navigation > button, #actBar > button'))
      if (!b.matches('.icon-btn.labelled') || !b.querySelector(':scope > .ico + .label'))
        fail(`${b.id || b.dataset.group} is not a labelled icon button (an icon, then its .label)`);
    for (const g of ['self', 'house', 'village']) {
      q(`#actBar [data-group="${g}"]`).click(); tick(1);
      if (q('#actMenu').hidden || !q('#actMenu .act-row, #actMenu .act-empty')) fail(`the ${g} group's list did not open`);
    }
  }
  // Options (VB-1161): the main menu opens it, a theme's card sets the theme on the page's root and keeps it, and Glass takes it off
  click($('menuBtn'), 'main menu');
  if (!shown('landing')) fail('the main menu did not open');
  click($('landOptions'), 'Options');
  const themes = win.__themes || {}, keys = Object.keys(themes);
  if (!shown('optionsScreen') || !keys.length || qa('#themeList [role="radio"]').length !== keys.length)
    fail(`Options did not open with a card for each of its ${keys.length} themes`);
  else {
    const root = doc.documentElement, kept = () => { try { return win.localStorage.getItem('vb.theme'); } catch (e) { return undefined; } };
    if (root.dataset.theme !== 'glass') fail(`the page opened in the ${root.dataset.theme || 'no'} theme, not the default glass`);
    // each theme in turn, then back to glass: the card sets the root's theme and icons and keeps the choice; its sample carries its theme
    for (const k of keys.filter((k) => k !== 'glass').concat('glass')) {
      const card = q(`[data-theme-choice="${k}"]`);
      if (!card || !card.querySelector(`.theme-pv [data-theme="${k}"]`)) fail(`the ${k} theme's card has no sample in its own theme (VB-1531)`);
      click(card, `the ${k} theme`);
      if (root.dataset.theme !== k || q(`[data-theme-choice="${k}"]`).getAttribute('aria-checked') !== 'true') fail(`${k} was not set on the page`);
      if (kept() !== undefined && kept() !== k) fail(`the theme kept is ${kept()}, not ${k}`);
      if (root.dataset.icons !== themes[k].icons) fail(`the ${k} theme shows the ${root.dataset.icons} icons, not its ${themes[k].icons} (VB-1533)`);
      if (k !== 'mural') continue;
      if (!/--lo:0%;--hi:/.test((q('.meter') || { getAttribute: () => '' }).getAttribute('style') || '')) fail('a meter does not say where its fill starts and ends, for the mural\'s beads');
      for (const sel of ['#settlersBtn .ico', '#pauseBtn .ico, [data-speed="0"] .ico', '.stat-ico .ico', '.trait .ico'])
        if (q(sel) && !q(sel).querySelector(':scope > [data-set="stencil"]')) fail(`an icon has no stencil for the mural theme (VB-1162, VB-1163): ${sel}`);
    }
    click($('optionsClose'), 'Close');
    if (shown('optionsScreen') || !shown('landing')) fail('Options did not close back to the main menu');
  }
  // The guide (VB-1124): the main menu opens it; a row a kind of work, read from sim/kinds, so a kind added appears with no change to the
  // page; a thing a row names leads to what makes and uses it; Escape closes it back to the menu; plan mode's links open it at a row.
  click($('landGuide'), 'Guide');
  const KINDS = win.VB['sim/kinds'].KINDS, names = new Set(Object.values(KINDS).map((K) => K.name));
  if (!shown('guideScreen')) fail('the guide did not open from the main menu');
  else if (qa('#guideBody [data-kind]').length !== names.size) fail(`the guide lists ${qa('#guideBody [data-kind]').length} kinds of work, not the ${names.size} sim/kinds names`);
  else {
    const cook = q('#guideBody [data-kind="cook"]');
    if (!cook || !/Cook/.test(cook.textContent) || !cook.querySelector('[data-guide-thing="firewood"]')) fail('the guide\'s Cook row does not name the firewood it needs');
    click(cook.querySelector('[data-guide-thing="firewood"]'), 'firewood, in the Cook row');
    const fw = q('#guideBody [data-thing="firewood"]');
    if (!fw || !fw.open || !fw.querySelector('[data-guide-kind="wood"]') || !fw.querySelector('[data-guide-kind="cook"]'))
      fail('firewood in the guide does not say it is made by cutting firewood and used by cooking');
    click(q('#guideTabs [data-guide-tab="crops"]'), 'the Crops chapter');
    if (!q('#guideBody [data-crop="rye"]')) fail('the guide\'s crops do not list rye');
    $('guideScreen').dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    tick(2);
    if (shown('guideScreen') || !shown('landing')) fail('the guide did not close back to the main menu on Escape');
    // a plan-mode link (the Plan tab's key, the plan tool's banner) opens it at its row
    const link = doc.createElement('a');
    link.dataset.guide = 'work:break';
    doc.body.appendChild(link);
    click(link, 'a link to the guide');
    if (!shown('guideScreen') || !(q('#guideBody [data-kind="break"]') || {}).open) fail('a link marked data-guide="work:break" did not open the guide at Break new ground');
    link.remove();
    click($('guideClose'), 'Close the guide');
  }
  click($('landBack'), 'Back to game');
  tick(30);
  console.log('chunks asked for by level:', P.baked.join(', '), '| left blank', P.blank);
  console.log(`page ok: ${days} days run, ${nodes} in the tree, ${rows} villages; built in ${built} ms, ${Date.now() - t0} ms in all`);
}
main().catch((e) => fail(e.stack || e.message)).then(() => process.exit(P.failed ? 1 : 0));
