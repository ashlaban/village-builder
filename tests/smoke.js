// The page in jsdom, at night (docs/testing.md): the tiny map, its panels, a year skipped, regenerating, the toasts, the goodwill rows and
// the action bar. Its quick sibling in verify is tests/page.js; the harness both load the page with is tests/lib/dompage.js.
const P = require('./lib/dompage').openPage({ label: 'SMOKE' });
const { win, doc, fail, tick } = P;
const names = ['water', 'waves', 'lod2', 'lod1', 'lod0', 'fields', 'fences', 'grid', 'regions', 'objects', 'labels', 'hover', 'shadows', 'clouds'];
const state = () => { const lay = P.APP.stage.children[0].children; return names.map((n, k) => `${n}:${lay[k].children.length}/${lay[k].children.filter((c) => c.visible).length}`).join(' '); };
const start = Date.now();
const generate = (scenario, size, seed) => {
  doc.getElementById('genScenario').value = scenario; doc.getElementById('genSize').value = size; doc.getElementById('genSeed').value = seed;
  doc.getElementById('genForm').dispatchEvent(new win.Event('submit', { cancelable: true }));
};
let started = false;
const iv = setInterval(async () => {
  if (!started) {
    if (Date.now() - start > 90000) { fail('the generation screen never appeared'); process.exit(1); }
    if (doc.getElementById('landing').hidden) return;
    const docs = [...doc.querySelectorAll('#landing #genDocs a')].map((a) => a.getAttribute('href')).join(' ');
    if (docs !== 'docs/roadmap.html BACKLOG.html QUESTIONS.html') fail(`the main menu links "${docs}", not the roadmap, backlog and open questions`);
    started = true; generate('heirs', 't', '7'); return;
  }
  if (!doc.getElementById('loader').classList.contains('done')) { if (Date.now() - start > 90000) { fail('loader timeout'); process.exit(1); } return; }
  clearInterval(iv); if (globalThis.__ran) return; globalThis.__ran = 1;
  console.log('built', Date.now() - start, 'ms |', doc.getElementById('meta').textContent);
  // whom to play (VB-339): a new game opens the choosing mode, paused, on a farm and a person; Watch only closes it with no one played
  if (doc.getElementById('choose').hidden) fail('a new game does not open whom to play');
  if (!doc.querySelector('#chooseCard .person') || !doc.querySelector('#chooseStories .story')) fail('whom to play shows no household or no archetype');
  doc.getElementById('chooseWatch').click();
  if (!doc.getElementById('choose').hidden || doc.body.classList.contains('choosing')) fail('Watch only leaves whom to play open');
  let t = Date.now(); tick(300); console.log('after intro (300 frames,', Date.now() - t, 'ms):', state(), '| lod:', doc.getElementById('lod').hidden ? 'idle' : doc.getElementById('lod').textContent);
  t = Date.now(); let n = 0; while (!doc.getElementById('lod').hidden && n < 2000) { tick(1); n++; } console.log('settled after', n, 'more frames', Date.now() - t, 'ms:', state());
  const q = (s) => doc.querySelector(s), qa = (s) => [...doc.querySelectorAll(s)];
  // a farm with a cart draws one (VB-410): a hand cart given to a household adds one visible sprite to the objects layer (the 14th of the world's layers; `names` above is older)
  {
    const vis = () => P.APP.stage.children[0].children[13].children.filter((c) => c.visible).length;
    const hh = P.st.households.find((h) => !h.dissolved && h.farmstead !== null), before = vis();
    hh.carts.push({ kind: 'hand', cond: 0.3, built: P.st.t, by: null }); tick(3);
    if (vis() !== before + 1) fail(`a farm given a hand cart draws ${vis() - before} more sprites, not 1`);
    hh.carts.pop(); tick(3);
    if (vis() !== before) fail('a cart taken away is still drawn');
    // a cart out with a pawn (VB-410), taken as the simulation takes it (sim/carts take): drawn at the pawn, not below the house, with the
    // team ahead of an ox cart; home again, it stands below the house
    {
      const C = win.VB['sim/carts'], hh2 = P.st.households.find((h) => !h.dissolved && h.farmstead !== null && h.members.some((m) => P.st.agents[m] && !P.st.agents[m].inside));
      const a = P.st.agents[hh2.members.find((m) => !P.st.agents[m].inside)];
      hh2.carts.length = 0; hh2.carts.push({ kind: 'hand', cond: 1, built: P.st.t, by: null }); tick(3);
      const home = vis(), objs = P.APP.stage.children[0].children[13].children;
      const saved = { job: a.job, phase: a.phase, carry: a.carry, load: a.load };
      a.job = a.job || { kind: 'haul', farm: P.st.farmsteads[hh2.farmstead] }; a.phase = 'back'; a.carry = 'hay'; a.load = 60;
      C.take(P.st, hh2, a.id, false); tick(3);
      const near = objs.filter((o) => o.visible && o.anchor.y === 0.85 && Math.hypot(o.position.x - a.x, o.position.y - a.y) < 14);
      if (!C.out(P.st, hh2.carts[0])) fail('the cart given to a pawn is not out');
      if (near.length !== 1) fail(`a cart out with its pawn is drawn ${near.length} times at the pawn`);
      if (vis() !== home) fail(`a cart out leaves ${vis() - home} more sprites visible than at home: it is drawn twice`);
      C.leave(P.st, hh2, a.id); Object.assign(a, saved); tick(3);
      if (objs.some((o) => o.visible && o.anchor.y === 0.85 && Math.hypot(o.position.x - a.x, o.position.y - a.y) < 1)) fail('a cart home is still drawn at its pawn');
      if (vis() !== home) fail('a cart home is not drawn below the house again');
    }
    // a pawn leading a cow home (VB-429), as sim/exchange's `lead` job has it (carry 'cow', phase 'back'): the animal is drawn beside it, and
    // not once the pawn has delivered it
    {
      const hh3 = P.st.households.find((h) => !h.dissolved && h.farmstead !== null && h.members.some((m) => P.st.agents[m] && !P.st.agents[m].inside && !P.st.agents[m].job));
      const a = P.st.agents[hh3.members.find((m) => !P.st.agents[m].inside && !P.st.agents[m].job)], objs = P.APP.stage.children[0].children[13].children;
      const saved = { job: a.job, phase: a.phase, carry: a.carry, load: a.load, x: a.x, y: a.y, path: a.path };
      const cows = () => objs.filter((o) => o.visible && o.anchor.y === 0.92).length;
      const base = cows();
      a.job = { kind: 'lead', farm: P.st.farmsteads[hh3.farmstead] }; a.phase = 'back'; a.carry = 'cow'; a.load = 0; tick(3);
      if (cows() !== base + 1) fail(`a pawn leading a cow is drawn with ${cows() - base} animals beside it, not 1`);
      // with the household's want naming a giver that has a cow, the animal is the giver's: its herd does not draw it as well (VB-616)
      const givers = P.st.households.filter((h) => !h.dissolved && h.herds.some((id) => P.st.herds[id].head && P.st.herds[id].head.some((x) => x.kind === 'cow')));
      const plan = P.st.plans.households.get(hh3.id), want = plan.want;
      // the page keeps its camera in its closure: the check moves it as a player does, by a press on the minimap (which maps its box to the world)
      const mm = q('#minimap'), W = P.st.w.W, H = P.st.w.H, look = (x, y) => {
        mm.setPointerCapture = () => {}; mm.getBoundingClientRect = () => ({ left: 0, top: 0, width: W, height: H });
        mm.dispatchEvent(new win.MouseEvent('pointerdown', { clientX: x, clientY: y, bubbles: true }));
      };
      let best = 0;
      // herds are drawn only by day and out of the stall (animate, drawHerds): the page is shown a calendar ten days on while the check looks;
      // the simulation's own time is left alone
      const cal = win.Sim.cal; win.Sim.cal = (t) => cal(t + 10 * 24);
      for (const giver of givers) {
        const hd = P.st.herds[giver.herds.find((id) => P.st.herds[id].head && P.st.herds[id].head.some((x) => x.kind === 'cow'))];
        look(P.st.w.hx[hd.home], P.st.w.hy[hd.home]); a.path = null; a.x = P.st.w.hx[hd.home]; a.y = P.st.w.hy[hd.home]; plan.want = null; tick(2); // the giver's farm in view, and the leader with it (a pawn out of view is not drawn)
        const alone = cows();
        plan.want = { what: 'cow', from: giver.id, kind: 'cow', by: 'deal' }; tick(2);
        const hidden = alone - cows();
        if (hidden !== 0 && hidden !== 1) fail(`a cow being led is drawn ${hidden} fewer sprites in its giver's herd, not 0 or 1`);
        best = Math.max(best, hidden);
      }
      if (givers.length && !best) fail('a cow being led is drawn in the giver herd as well: no giver in view loses a sprite');
      plan.want = want; win.Sim.cal = cal;
      Object.assign(a, saved); tick(3);
      if (cows() !== base) fail(`a cow delivered is still drawn at its leader (${cows()} cows drawn, ${base} before)`);
    }
  }
  console.log('clock:', doc.getElementById('clockDate').textContent, '|', doc.getElementById('clockYear').textContent, '| scenario', doc.getElementById('genScenario').value);
  // the shown clock is the time the simulation has reached, floored to whole 5 minutes: never ahead of it, less than 5 minutes behind
  // (VB-474; the pawns are drawn a fraction of a step ahead, the clock is not)
  const shownMin = () => { const m = /Year (\d+), (\d\d):(\d\d)/.exec(doc.getElementById('clockYear').textContent); return m ? (+m[2]) * 60 + (+m[3]) : -1; };
  for (const sp of [1, 3, 10, 30, Infinity]) {
    q(`[data-speed="${sp}"]`).click();
    for (let k = 0; k < (sp === Infinity ? 10 : 400); k++) {
      tick(1); const shown = shownMin(), real = Math.floor(P.st.t * 60 + 1e-6) % 1440, lag = (real - shown + 1440) % 1440;
      if (shown < 0 || shown % 5 !== 0 || lag > 5) { fail(`clock at ${sp}x shows ${shown} min but simulation is at ${real} min`); break; }
    }
  }
  q('[data-speed="1"]').click();
  doc.getElementById('landBtn').click(); tick(5); doc.getElementById('landBtn').click(); tick(2); // the Land overlay on and off (VB-004)
  doc.getElementById('groundBtn').click(); tick(5);
  if (doc.getElementById('groundKey').hidden || !/Bedrock/.test(doc.getElementById('groundKey').textContent)) fail('the Ground overlay shows no key');
  doc.getElementById('groundBtn').click(); tick(2); // the Ground overlay on and off
  doc.getElementById('reachBtn').click(); tick(5); // the Reach overlay (VB-437): its key names the origin, or asks for one
  if (doc.getElementById('reachKey').hidden || !/Walking time/.test(doc.getElementById('reachKey').textContent)) fail('the Reach overlay shows no key');
  doc.getElementById('reachBtn').click(); tick(2);
  if (!doc.getElementById('reachKey').hidden) fail('the Reach overlay keeps its key when off');
  doc.getElementById('settlersBtn').click(); tick(20);
  const expand = (selector) => qa(selector).forEach((el) => {
    el.open = true; el.dispatchEvent(new win.Event('toggle'));
  });
  expand('.village-block');
  // The People sheet finds (VB-664): a village's fold lists its farms and their people, each a row that opens its card; a household is
  // told of on its farm's card, whose tabs Stores, Land and Animals are stats (an icon, a value, the one meter where it is a level).
  console.log('settlers:', qa('#settlers button[data-farm] .who').map((h) => h.firstChild.textContent).join(' / '));
  if (qa('#settlers button[data-farm]').length === 0) fail('settlers list is empty');
  if (q('#settlers .household-block, #settlers .show-map')) fail('the People sheet still tells of a household in folds');
  {
    const lived = qa('#settlers button[data-farm]').find((b) => b.querySelector('.ppl'));
    lived.click(); tick(5);
    const shown = (id) => !doc.getElementById(id).hidden;
    if (!q('#tileStats .supplies, #tileStats .card-note')) fail("a farm's card shows no supplies");
    // The supply component (VB-667) on a constructed short household: its head's outlook made by sim/outlook, then food set to last half
    // the season we are in on the store and 1.4 seasons with what is to come, short badly in the next. The Stores tab draws four cells
    // (the first half solid, the second 40% striped, the last three framed red), its state in words, its numbers under the i; hay one
    // wide cell; the farm's row on its village's card a red chip, and none for a safe supply.
    {
      const f = P.st.farmsteads[+lived.dataset.farm], hh = P.st.households[f.household], plan = P.st.plans.households.get(hh.id);
      const kept = plan.outlook, O = win.VB['sim/outlook'].reckon(P.st, hh, plan);
      O.food = { own: 0.5, with: 1.4, state: 'bad', season: 1, seasons: [0, 1, 2, 3], parts: { store: 30, need: [60, 60, 60, 60], intakes: [{ what: 'barley', season: 1, n: 50 }], spoilt: 2 } };
      O.fuel = { ...O.fuel, own: 4, with: 4, state: 'safe', season: null };
      O.hay = { own: 3.3, with: 3.6, state: 'short', season: 3, seasons: [3], parts: { store: 20, need: [0, 0, 0, 50], intakes: [], spoilt: 1, share: 0.6 } };
      O.season = win.Sim.cal(P.st.t).season; O.year = win.Sim.cal(P.st.t).year;
      plan.outlook = O;
      doc.getElementById('tabStores').click(); tick(2);
      const food = q('#tileHouse .supply[data-supply="food"]'), cells = food ? [...food.querySelectorAll('.cell')] : [];
      const w = (c, k) => c && parseFloat(c.querySelector(`i.${k}`).style.width);
      if (cells.length !== 4) fail(`the food supply draws ${cells.length} season cells, not 4`);
      else {
        if (w(cells[0], 'own') !== 50 || w(cells[0], 'with') !== 100 || w(cells[1], 'with') !== 40 || w(cells[1], 'own') !== 0) fail(`the food cells are filled ${cells.map((c) => `${w(c, 'own')}/${w(c, 'with')}`).join(' ')}`);
        if (cells.map((c) => c.classList.contains('short')).join() !== 'false,true,true,true') fail('the food cells the outlook does not cover are not framed red');
      }
      const next = win.Sim.SEASONS[(O.season + 1) % 4];
      if (!food || food.querySelector('.supply-state').textContent !== `short in ${next}` || !food.classList.contains('bad')) fail(`the food supply's state reads "${food && food.querySelector('.supply-state').textContent}"`);
      if (qa('#tileHouse .supply.head .cell-season svg').length !== 4) fail('the Supplies section has no header of four seasons');
      if (qa('#tileHouse .supply[data-supply="hay"] .cell').length !== 1) fail('hay is not one wide cell');
      if (!/By .+'s reckoning|By your reckoning/.test(q('#tileHouse .supplies .card-note').textContent)) fail('the Supplies section does not say whose reckoning it is');
      q('#tileHouse [data-supply-more="food"]').click(); tick(2);
      const nums = q('#tileHouse [data-supply-nums="food"]');
      if (!nums || !/In store\s*30 rations/.test(nums.textContent) || !/barley harvest/.test(nums.textContent) || !/spoil/.test(nums.textContent)) fail(`the food's numbers read "${nums && nums.textContent}"`);
      q('#tileHouse [data-supply-more="hay"]').click(); tick(2);
      if (!/byre over winter/.test((q('#tileHouse [data-supply-nums="hay"]') || {}).textContent || '')) fail("hay's numbers do not open with its sentence");
      q('#tileHouse [data-supply-more="food"]').click(); q('#tileHouse [data-supply-more="hay"]').click(); tick(2);
      if (q('#tileHouse [data-supply-nums]')) fail('the numbers do not close');
      doc.getElementById('settlers').querySelector(`button[data-village="${f.village}"]`).click(); tick(5);
      const row = q(`#tileList [data-farm="${f.id}"]`), chips = row ? [...row.querySelectorAll('.supply-chip:not([data-warning])')] : [];
      if (chips.length !== 2 || !chips[0].classList.contains('bad') || !chips[1].classList.contains('warn') || chips[0].querySelectorAll('svg').length !== 2) fail(`the short farm's row shows ${chips.map((c) => c.className).join(', ') || 'no chips'}, not a red food chip and a gold hay chip`);
      if (!row || !row.querySelector('.ppl') || /Fed|Short of food/.test(row.querySelector('.state').textContent) || !row.title) fail("the farm's row lacks its people or its title, or still has the words");
      console.log('supplies:', [...row.querySelectorAll('.supply-chip:not([data-warning])')].map((c) => c.title).join('; '));
      plan.outlook = kept;
      lived.click(); tick(5);
    }
    for (const [tab, want] of [['tabStores', /Grain/], ['tabLand', /Hay meadows/], ['tabAnimals', /Larder/]]) {
      if (doc.getElementById(tab).hidden) { fail(`a lived-in farm's card has no tab ${tab}`); continue; }
      doc.getElementById(tab).click(); tick(2);
      const house = doc.getElementById('tileHouse');
      if (!shown('tileHouse') || !want.test(house.textContent) || !house.querySelector('.stat .stat-ico svg')) fail(`the tab ${tab} shows no stats with icons`);
    }
    console.log('farm card:', doc.getElementById('tileName').textContent, '|', doc.getElementById('tileHouse').textContent.replace(/\s+/g, ' ').slice(0, 160));
    if (/Tile \d+, \d+/.test(doc.getElementById('tile').textContent)) fail("a card shows the tile's numbers, which are Debug's");
    doc.getElementById('tabFacts').click(); tick(2);
    qa('#tileList button[data-pawn]')[0].click(); tick(5);
    if (qa('#tileStats .traits .trait svg').length !== 12) fail("a pawn's card does not show its twelve traits as icons");
    if (!doc.getElementById('tabStores').hidden) fail("a pawn's card keeps the household's tabs");
  }
  // The Culture pane (VB-397): titled by the culture; a row a village; the culture's own charter, a phrase a custom, and a phrase opened
  // to its ways; the meetings; a village's row opens its card at the Customs tab, whose culture link comes back here.
  {
    const nDims = require('../src/load.js').culture.DIMS.length, body = doc.getElementById('drawerBody'), pane = (sel) => [...body.querySelectorAll(sel)];
    doc.getElementById('cultureBtn').click(); tick(5);
    const title = doc.getElementById('drawerTitle').textContent, rows = pane('[data-charter]').length, villages = P.st.cenv.settlements.length;
    if (!/ culture$/.test(title)) fail(`the Culture pane is titled ${title}`);
    if (rows !== villages) fail(`the Culture pane lists ${rows} villages of ${villages}`);
    body.querySelector('[data-ctab="custom"]').click(); tick(2);
    if (pane('.charter [data-phrase]').length !== nDims) fail(`the culture's charter has ${pane('.charter [data-phrase]').length} phrases, expected ${nDims}`);
    body.querySelector('[data-phrase]').click(); tick(2);
    const ways = pane('.stand .way').length;
    if (ways !== require('../src/load.js').culture.DIMS[+body.querySelector('[aria-expanded="true"]').dataset.phrase].opts.length) fail(`an opened custom of the culture shows ${ways} ways`);
    body.querySelector('[data-ctab="meetings"]').click(); tick(2);
    if (!pane('.note').length) fail('the Meetings tab says nothing');
    console.log('culture pane:', title, '|', rows, 'villages |', ways, 'ways |', pane('.note').map((p) => p.textContent).join(' || ').slice(0, 200));
    body.querySelector('[data-ctab="villages"]').click(); tick(2);
    const row = body.querySelector('[data-charter]'), name = row.querySelector('.who').firstChild.textContent;
    row.click(); tick(5);
    if (doc.getElementById('tileName').textContent !== name || doc.getElementById('tileCustoms').hidden) fail(`the row of ${name} did not open its customs`);
    const link = doc.querySelector('#tileCustoms [data-culture]');
    if (!link) fail("a village's customs do not name its culture as a link"); else {
      link.click(); tick(5);
      if (doc.getElementById('drawer').hidden || doc.getElementById('drawerTitle').textContent !== link.textContent) fail('the culture link did not open the Culture pane');
    }
    doc.getElementById('tabFacts').click();
  }
  doc.getElementById('debugBtn').click(); tick(5);
  console.log('debug when:', doc.getElementById('dbgWhen').textContent, '| out:', doc.getElementById('dbgOut').textContent);
  q('[data-act="meet"]').click(); console.log('meet:', doc.getElementById('dbgMsg').textContent);
  q('[data-act="move"]').click(); console.log('move:', doc.getElementById('dbgMsg').textContent);
  // select a settler through the settlers list, then kill them from the debug panel (a debug command, VB-170); the farm names of an older
  // world were matched here once, so the step had stopped running
  const sb = qa('#settlers button[data-pawn]')[0];
  if (!sb) fail('no settler to select');
  sb.click(); doc.getElementById('debugBtn').click(); tick(3); console.log('selected:', doc.getElementById('dbgSel').textContent);
  q('[data-act="kill"]').click(); const killed = doc.getElementById('dbgMsg').textContent; console.log('kill:', killed);
  if (!/has died/.test(killed)) fail(`the debug kill did not report a death: ${killed}`);
  tick(30);
  // the death of the selected pawn raises a toast (VB-098)
  console.log('toasts:', qa('#toasts .toast').map((b) => b.textContent).join(' / '));
  if (!qa('#toasts .toast').some((b) => / was killed, aged \d+\.$/.test(b.textContent))) fail('the debug kill raised no toast');
  doc.getElementById('treeBtn').click(); tick(2);
  console.log('tree:', doc.getElementById('treeSub').textContent, '| nodes', qa('#treeSvg g.tn').length, 'dead', qa('#treeSvg g.tn.dead').length, 'heir dots', qa('#treeSvg .heir').length);
  if (!qa('#treeSvg g.tn').length) fail('family tree is empty');
  // the line view: a living person's line shows fewer people than the records hold, each mode draws, and a chip opens in place
  const everyone = () => { q('#treeModes [data-mode="all"]').click(); return qa('#treeSvg g.tn').length; };
  const all = everyone(), parent = +q('#treeSvg g.tn:not(.dead)').dataset.pawn;
  q(`#treeSvg g.tn[data-pawn="${parent}"]`).dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  const shown = {};
  for (const mode of ['line', 'father', 'mother', 'desc']) {
    q(`#treeModes [data-mode="${mode}"]`).click(); shown[mode] = qa('#treeSvg g.tn').length;
    if (!q('#treeSvg g.tn.focus')) fail(`the ${mode} view does not show the person it is of`);
    if (shown[mode] > all) fail(`the ${mode} view shows more people than the records hold`);
    if (q(`#treeModes [data-mode="${mode}"]`).getAttribute('aria-pressed') !== 'true') fail(`the ${mode} button is not pressed`);
    const chip = q('#treeSvg g.chip');
    if (chip) {
      chip.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
      if (qa('#treeSvg g.tn').length < shown[mode]) fail(`a chip of the ${mode} view hid people`);
    }
  }
  // the path: to a spouse or a child of the first living person who has one, and it names the relation
  q(`#treeModes [data-mode="line"]`).click();
  if (q('#treeSvg g.tn:not(.focus)')) {
    q('#treeModes [data-mode="path"]').click();
    if (!/second person/.test(q('#treeCaption').textContent)) fail('Path does not ask for the second person');
    q('#treeSvg g.tn:not(.focus)').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
    const cap = q('#treeCaption').textContent; console.log('tree path:', qa('#treeSvg g.tn').length, 'shown |', cap);
    if (qa('#treeSvg g.tn.focus').length !== 2 || !/ is .*'s /.test(cap)) fail(`the path view does not show both people and their relation: ${cap}`);
  }
  console.log('tree lines:', JSON.stringify(shown), 'of', all);
  everyone();
  const dn = q('#treeSvg g.tn.dead'); dn.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  console.log('dead info:', doc.getElementById('treeInfo').textContent.replace(/\s+/g, ' ').slice(0, 200));
  doc.getElementById('treeClose').click();
  doc.getElementById('debugBtn').click(); doc.getElementById('debugBtn').click(); tick(2);
  if (!q('[data-act="skip1"]')) fail('"Skip a year" button missing');
  q('[data-act="skip1"]').click();
  let n2 = 0; while (n2 < 4000 && (!doc.getElementById('dbgMsg').textContent.startsWith('Skipped'))) { await new Promise((r) => setTimeout(r, 5)); n2++; }
  console.log('skip:', doc.getElementById('dbgMsg').textContent, '|', doc.getElementById('dbgWhen').textContent);
  if (!doc.getElementById('dbgMsg').textContent.startsWith('Skipped')) fail('"Skip a year" did not finish');
  tick(10);
  console.log('log:', qa('#settlers .log p').slice(0, 6).map((p) => p.textContent).join(' / '));
  // back to the generation screen with the last choices filled in, then a Tiny Populous Villages map
  doc.getElementById('menuBtn').click(); doc.getElementById('landNew').click();
  if (doc.getElementById('genScreen').hidden || doc.getElementById('genSeed').value !== '7' || doc.getElementById('genScenario').value !== 'heirs') fail('the generation screen did not keep the last choices');
  generate('populous', 't', '7');
  const iv2 = setInterval(() => { if (!doc.getElementById('menuBtn').disabled && doc.getElementById('loader').classList.contains('done')) tick(20);  if (doc.getElementById('loader').classList.contains('done') && !doc.getElementById('menuBtn').disabled) { clearInterval(iv2); doc.getElementById('chooseWatch').click(); let ok = true; try { tick(10); } catch (e) { ok = false; }
    const deadAttached = []; const walk = (n, path) => { for (const c of n.children || []) { if (c._dead) deadAttached.push(path); walk(c, path + '>' + (c.constructor.name)); } }; walk(P.APP.stage, 'stage'); doc.getElementById('settlersBtn').click(); if (!doc.querySelector('#settlers .village-block')) fail('settlers list is empty after regenerating');
    if (!ok) fail('frame error after regenerating');
    console.log('destroyed objects still in the scene:', deadAttached.length); console.log('regen frames ran:', ok, '|', doc.getElementById('name').textContent, '| settlers', [...doc.querySelectorAll('#settlers .farm h2')].map((h) => h.textContent).join(' / ')); goodwillPanel().then(notices).then(actionBar).then(() => process.exit(P.failed ? 1 : 0)); } }, 50);
}, 50);
// The pawn panel's goodwill balances (VB-218): after a year of populous 7 on the tiny map, with its gifts, a holder with a balance toward
// another household shows its rows, each with what it would give and the parts of that allowance on hover.
async function goodwillPanel() {
  const Sim = win.Sim, msg = doc.getElementById('dbgMsg'); msg.textContent = '';
  doc.querySelector('[data-act="skip1"]').click();
  for (let k = 0; k < 6000 && !msg.textContent.startsWith('Skipped'); k++) await new Promise((r) => setTimeout(r, 5));
  if (!msg.textContent.startsWith('Skipped')) { fail('"Skip a year" did not finish on the tiny map'); return; }
  tick(5);
  const st = P.st;
  // A well-fed island makes no gifts (hunger drives them), and populous 7 on the tiny map has no hungry household in its first years, so
  // the run has no balance to show: the panel is tested on a balance made by hand, a gift of 20 rations between two holders (VB-427).
  const hs = st.pawns.filter((p) => p.alive && Sim.isHolder(st, p.id));
  const other = hs.find((q) => q.household !== hs[0].household);
  if (!hs.some((p) => Sim.goodwillOf(st, p.id).length) && other) win.VB['sim/relations'].addGoodwill(st, hs[0].id, other.id, 20);
  const holder = st.pawns.find((p) => p.alive && Sim.isHolder(st, p.id)
    && Sim.goodwillOf(st, p.id).some((x) => Math.abs(x.balance) >= 1 && Sim.explainAllowance(st, p.id, x.other)));
  if (!holder) { fail('no holder has a goodwill balance after a year of populous 7 on the tiny map'); return; }
  const settlers = doc.getElementById('settlers');
  if (doc.getElementById('peopleSheet').classList.contains('collapsed')) doc.getElementById('settlersBtn').click();
  tick(2);
  // each toggle redraws the list, so the next closed fold is found afresh
  for (let el, k = 0; k < 500 && (el = settlers.querySelector('.village-block:not([open])')); k++) {
    el.open = true; el.dispatchEvent(new win.Event('toggle'));
  }
  tick(2);
  const b = settlers.querySelector(`button[data-pawn="${holder.id}"]`);
  if (!b) { fail(`no settlers button for holder ${holder.id}`); return; }
  b.click(); tick(20);
  const rel = doc.getElementById('tileRel'), heads = [...rel.querySelectorAll('h3')].map((h) => h.textContent);
  const rows = [...rel.querySelectorAll('h3')].filter((h) => h.textContent === 'Owes and is owed').flatMap((h) => {
    const out = []; for (let n = h.nextElementSibling; n && n.tagName === 'BUTTON'; n = n.nextElementSibling) out.push(n); return out; });
  const want = Math.min(5, Sim.goodwillOf(st, holder.id).filter((x) => Math.abs(x.balance) >= 1).length);
  console.log(`goodwill: ${Sim.fullName(holder)} |`, heads.join(' / '), '|', rows.map((r) => `${r.textContent} [${r.title}]`).join(' / '));
  if (rel.hidden || rows.length !== want) fail(`the goodwill list of holder ${holder.id} has ${rows.length} rows, expected ${want}`);
  if (!rows.every((r) => /^(Owes .+ \d+ rations?|Is owed \d+ rations? by .+?)(would give up to \d+ rations?)?$/.test(r.textContent))) {
    fail('a goodwill row does not read "Owes X N rations" or "Is owed N rations by X"'); }
  const given = rows.filter((r) => r.querySelector('i.give'));
  if (!given.length || !given.every((r) => ['Grain above the floor', 'Own reserve', 'Goodwill'].every((label) =>
    new RegExp(`(^| · )${label}[^·]* (0|[+−]\\d+)( ·|$)`).test(r.title)))) {
    fail("no goodwill row of a holder shows what it would give, with its allowance's parts on hover"); }
  // a pawn with no balance of a ration or more has no list
  const none = [...settlers.querySelectorAll('button[data-pawn]')].map((x) => +x.dataset.pawn)
    .find((id) => st.pawns[id].alive && !Sim.goodwillOf(st, id).some((x) => Math.abs(x.balance) >= 1));
  if (none === undefined) fail('every listed pawn has a goodwill balance');
  else {
    settlers.querySelector(`button[data-pawn="${none}"]`).click(); tick(20);
    if (/Owes and is owed/.test(rel.innerHTML)) fail(`pawn ${none}, with no balance, shows a goodwill list`);
  }
  // The History tab (VB-099) on the card of a pawn, a farm and a village: it opens, lists events of the record with their dates, each
  // filter by kind narrows it, and a name in a line selects what it names. The village log lists the record's last lines.
  const hist = doc.getElementById('historyList'), tabH = doc.getElementById('tabHistory'), opened = [];
  const openHistory = (what, pick) => {
    pick(); tick(20);
    if (doc.getElementById('tileTabs').hidden) { fail(`no tabs on the card of ${what}`); return; }
    tabH.click(); tick(2);
    if (doc.getElementById('tileHistory').hidden || !doc.getElementById('tileFacts').hidden || tabH.getAttribute('aria-selected') !== 'true') {
      fail(`the History tab of ${what} did not open`); }
    const all = hist.querySelectorAll('p:not(.more)').length; // the line that tells of earlier events not listed has no date
    if (!all || hist.querySelectorAll('time').length !== all) fail(`the history of ${what} has ${all} lines, not each with its date`);
    for (const k of doc.querySelectorAll('#historyKinds button')) {
      k.click(); tick(2);
      if (k.getAttribute('aria-pressed') !== 'true' || hist.querySelectorAll('time').length > all) fail(`the filter ${k.textContent} of ${what}`);
    }
    doc.querySelector('#historyKinds [data-history=""]').click(); tick(2);
    opened.push(`${what} ${all}`);
  };
  const farmId = st.households[holder.household].farmstead, farm = st.farmsteads[farmId];
  openHistory('a pawn', () => settlers.querySelector(`button[data-pawn="${holder.id}"]`).click());
  // its farm is told by a line that names it: founders hold theirs from the start, a pawn who left a crowded village founds or settles at one
  if (!hist.textContent.includes(farm.name) || !/was born/.test(hist.textContent)) fail("a holder's history lacks its birth or its farm");
  openHistory('a farm', () => settlers.querySelector(`button[data-farm="${farmId}"]`).click());
  openHistory('a village', () => settlers.querySelector(`button[data-village="${farm.village}"]`).click());
  const link = hist.querySelector('button.name[data-farm]');
  if (!link) fail("no farm's name in the village's history is a link");
  else {
    link.click(); tick(5);
    const shown = doc.getElementById('tileName').textContent;
    if (shown !== link.textContent) fail(`the link ${link.textContent} selected ${shown}`);
    if (doc.getElementById('tileHistory').hidden) fail('following a name left the History tab');
  }
  doc.getElementById('tabFacts').click(); tick(2);
  if (doc.getElementById('tileFacts').hidden || !doc.getElementById('tileHistory').hidden) fail('the Details tab did not come back');
  // The village's overview (VB-162): food, the harvest, the hungry and idle hands as stats, people by age band, and a warning with the farm it
  // concerns as a chip that selects it: a member of the farm's household made hungry on every day of the window, then restored.
  {
    const box = doc.getElementById('tileStats'), hh = st.households[farm.household], p = st.pawns[hh.members.find((m) => st.pawns[m].alive)];
    const log = p.hungerLog.slice();
    p.hungerLog = Array(Sim.OVERVIEW.window).fill(1);
    settlers.querySelector(`button[data-village="${farm.village}"]`).click(); tick(5);
    const S = Sim.villageSummary(st, farm.village, st.player ? st.player.pawn : null);
    const words = [...box.querySelectorAll('.stat-name')].map((e) => e.textContent);
    for (const n of ['Food', 'Harvest', 'Hungry', 'Idle hands', '0–14', '15–49', '50+']) if (!words.includes(n)) fail(`the village's overview lacks ${n}`);
    const warned = Object.values(S.warnings).reduce((n, l) => n + l.length, 0), chips = box.querySelectorAll('.warning [data-farm]');
    if (!S.warnings.hunger.includes(hh.id) || chips.length !== warned) fail(`the overview shows ${chips.length} farm chips for ${warned} warned`);
    if (!doc.querySelector(`#tileList [data-farm="${farm.id}"] .supply-chip[data-warning="hunger"]`)) fail("the warned farm's row has no chip for its warning");
    // the store's supply row (VB-966): food by the component's cells, its target in the numbers, and whose estimate it is
    const row = box.querySelector('.supplies [data-supply="food"]');
    if (!row || row.querySelectorAll('.cell').length !== 4) fail("the village card has no store row of four season cells");
    if (!/reckoning/.test(box.querySelector('.supplies .card-note').textContent)) fail("the store's row does not say whose estimate it is");
    row.querySelector('[data-supply-more]').click(); tick(2);
    if (!/target/.test(box.querySelector('[data-supply-nums="food"]').textContent)) fail("the store's numbers lack its target");
    box.querySelector('[data-supply-more]').click(); tick(2);
    console.log('village overview:', words.join(', '), '|', warned, 'warned', '|', [...box.querySelectorAll('.warning > span:not(.stat-ico)')].map((e) => e.textContent).join('; '));
    const chip = box.querySelector(`.warning [data-farm="${farm.id}"]`);
    if (chip) { chip.click(); tick(5); if (doc.getElementById('tileName').textContent !== farm.name) fail('a warning\'s chip did not select its farm'); }
    p.hungerLog = log;
  }
  // The Customs tab (VB-396) of a village's card: the customs as a charter, a phrase a custom; a phrase opens the ways of its custom, each
  // voice of the meeting by exactly one of them; a pawn's card has no such tab, and shows its Details while the choice is kept.
  {
    const tabC = doc.getElementById('tabCustoms'), box = doc.getElementById('tileCustoms'), DIMS = require('../src/load.js').culture.DIMS;
    settlers.querySelector(`button[data-village="${farm.village}"]`).click(); tick(5);
    if (tabC.hidden) fail("no Customs tab on a village's card");
    tabC.click(); tick(2);
    const phrases = box.querySelectorAll('.charter [data-phrase]');
    if (box.hidden || !doc.getElementById('tileFacts').hidden) fail('the Customs tab did not open');
    if (phrases.length !== DIMS.length) fail(`the charter has ${phrases.length} phrases, expected ${DIMS.length}`);
    if (!box.querySelector('h3.lead') || box.querySelectorAll('h3:not(.lead)').length !== 4) fail('the charter lacks its heading or its four heads');
    const sett = st.cenv.settlements[farm.village], voices = Sim.membersOf(st, sett.id).filter((p) => p.alive && Sim.voiceOf(st, p, sett) > 0).length;
    phrases[0].click(); tick(2);
    const stand = box.querySelector('.stand'), ways = stand ? stand.querySelectorAll('.way').length : 0;
    const dim = DIMS[+phrases[0].dataset.phrase];
    if (ways !== dim.opts.length) fail(`an opened custom shows ${ways} ways, expected ${dim.opts.length}`);
    if (stand && voices <= 8 && stand.querySelectorAll('.voice').length !== voices) fail(`${stand.querySelectorAll('.voice').length} faces for ${voices} voices`);
    if (stand && stand.querySelectorAll('.tag').length < 1) fail('no way of the opened custom is marked as in force');
    if (/%/.test(box.textContent)) fail('the Customs tab shows a percentage');
    // a face shows its note (VB-398): how far the person leans, as two percentages, and why; again, and it goes
    const voice = box.querySelector('.voice');
    if (voice) {
      voice.click(); tick(2);
      const why = box.querySelector('.why');
      if (!why || !/leans? \d+% to “.+” and \d+% to “.+”\. \S/.test(why.textContent)) fail(`a voice's note reads: ${why && why.textContent}`);
      if (box.querySelector('.voice[aria-pressed="true"]').dataset.voice !== voice.dataset.voice) fail('the chosen face is not marked');
      console.log('voice note:', why && why.textContent);
      box.querySelector('.voice[aria-pressed="true"]').click(); tick(2);
      if (box.querySelector('.why')) fail('the note stays when its face is chosen again');
    }
    box.querySelector('[aria-expanded="true"]').dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); tick(2);
    if (box.querySelector('.stand')) fail('Enter on the open phrase did not close it');
    console.log('customs tab:', phrases.length, 'phrases |', ways, 'ways,', voices, 'voices |', box.querySelector('.charter').textContent.replace(/\s+/g, ' '));
    // the name in a note opens the person's card
    box.querySelector('.charter [data-phrase]').click(); tick(2);
    const other = [...box.querySelectorAll('.voice')].find((v) => !st.player || +v.dataset.voice !== st.player.pawn);
    if (other) {
      other.click(); tick(2);
      const name = box.querySelector('.why button.name');
      if (!name) fail("a voice's note has no name to follow"); else {
        name.click(); tick(5);
        if (doc.getElementById('tileName').textContent !== name.textContent) fail(`the name ${name.textContent} opened ${doc.getElementById('tileName').textContent}`);
      }
    }
    settlers.querySelector(`button[data-pawn="${holder.id}"]`).click(); tick(5);
    if (!tabC.hidden || doc.getElementById('tileFacts').hidden || !box.hidden) fail("a pawn's card shows the Customs tab or not its Details");
    doc.getElementById('tabFacts').click(); tick(2);
  }
  const recent = settlers.querySelector('[data-fold="recent"]');
  recent.open = true; recent.dispatchEvent(new win.Event('toggle')); tick(2);
  const lines = settlers.querySelectorAll('[data-fold="recent"] .log p').length, told = Sim.villageLog(st).length;
  if (!lines || lines !== told || lines > 40) fail(`the village log shows ${lines} lines, the record's log has ${told}`);
  if (!settlers.querySelector('[data-fold="recent"] .log button.name')) fail('no name in the village log is a link');
  console.log(`history: ${opened.join(', ')} lines; the village log ${lines} lines`);
}
// Notifications (VB-098), on the tiny populous map: a landholder's death raises a toast that tells it as the log did, a click selects the
// farm and takes the toast away, deaths of one day in one village share a toast, at most 3 show, a kind turned off raises none and the
// choice is kept, and a toast goes after 6 s.
function notices() {
  const Sim = win.Sim, st = P.st, q = (s) => doc.querySelector(s), shown = () => [...doc.querySelectorAll('#toasts .toast')];
  const texts = () => shown().map((b) => b.textContent).join(' / ');
  q('[data-speed="0"]').click(); tick(400);
  if (shown().length) fail(`toasts still up after 6 s: ${texts()}`);
  const holdersOf = (v) => st.liveHouseholds.map((id) => st.households[id]).filter((h) => st.farmsteads[h.farmstead].village === v.id
    && st.pawns[h.holder].alive).map((h) => h.holder);
  const v = st.villages.find((u) => holdersOf(u).length >= 6);
  if (!v) { fail('no village with 6 holders on the tiny populous map'); return; }
  const kill = (id) => { Sim.killPawn(st, id, 'illness'); return st.record.filter((e) => e.kind === 'died' && e.pawn === id).pop(); };
  const boxes = [...doc.querySelectorAll('#noticeList input[data-notice]')];
  if (boxes.map((b) => b.dataset.notice).join() !== Object.keys(Sim.NOTABLE).join()) fail('the notification list does not show the kinds of Sim.NOTABLE');
  if (!boxes.every((b) => b.checked)) fail('a kind of notification starts turned off');
  // one death: its sentence, and the click
  const ids = holdersOf(v), ev = kill(ids[0]); tick(2);
  console.log('toast:', texts());
  const mine = shown().find((b) => b.textContent === Sim.eventLine(st, ev));
  if (!mine || !/ died of illness, aged \d+\.$/.test(mine.textContent)) fail(`no toast tells the death of a landholder: ${texts()}`);
  else {
    mine.click(); tick(2);
    const farm = st.farmsteads[ev.farm].name, title = doc.getElementById('tileName').textContent;
    if (doc.getElementById('tile').hidden || !title.startsWith(farm)) fail(`a click on the toast selected "${title}", not ${farm}`);
    if (shown().includes(mine)) fail('a clicked toast stays up');
  }
  // three deaths of one day in one village share a toast, and no more than 3 toasts show
  tick(400);
  for (const id of ids.slice(1, 4)) kill(id);
  tick(2); console.log('chunks asked for by level:', P.baked.join(', '), '| painted in full', P.baked.reduce((n, x) => n + x, 0) - P.blank, '| left blank', P.blank); if (!P.baked[2] || !P.baked[0]) fail('no chunk was painted in full');
  console.log('merged:', texts());
  if (!shown().some((b) => b.textContent === `3 deaths in ${v.name}`)) fail(`3 deaths in a day did not merge: ${texts()}`);
  if (shown().length > 3) fail(`${shown().length} toasts at once`);
  // every kind turned off: no toast, and the choice is kept
  tick(400);
  for (const b of boxes) { b.checked = false; b.dispatchEvent(new win.Event('change', { bubbles: true })); }
  kill(ids[4]); tick(2);
  if (shown().length) fail(`a toast with every kind turned off: ${texts()}`);
  const kept = JSON.parse(win.localStorage.getItem('vb.notices.off') || '[]');
  if (kept.slice().sort().join() !== Object.keys(Sim.NOTABLE).sort().join()) fail(`the kinds turned off were not kept: ${kept}`);
  for (const b of boxes) { b.checked = true; b.dispatchEvent(new win.Event('change', { bubbles: true })); }
  if (win.localStorage.getItem('vb.notices.off') !== '[]') fail('the kinds turned on again were not kept');
  // and a toast goes after 6 s: up at 5.9 s, gone at 6.1
  kill(ids[5]); tick(2);
  if (!shown().length) fail('no toast once the kinds are on again');
  tick(366); if (!shown().length) fail('a toast went before 6 s');
  tick(15); if (shown().length) fail(`a toast is still up after 6 s: ${texts()}`);
}
// The action bar (VB-341): played as a holder, the dock's Actions shows the bar over the dock; each group opens its list; Go home is queued
// from the Myself list, a gift from the Household list's form (Give all the same, if the floor's warning asks), and Walk here's tool takes
// the tile tapped on the map, the camera following the pawn.
async function actionBar() {
  const Sim = win.Sim, st = P.st, q = (sel) => doc.querySelector(sel), queue = () => st.player.queue.map((c) => c.verb);
  q('[data-speed="0"]').click();
  const holder = st.pawns.find((p) => p.alive && p.age >= 18 && Sim.isHolder(st, p.id) && Sim.holdingOf(st, p.id)
    && Sim.grainOf(Sim.holdingOf(st, p.id)) - Sim.seedReserve(st, Sim.holdingOf(st, p.id)) >= 5);
  if (!holder || Sim.inhabit(st, holder.id) !== true) { fail('no holder with grain to spare to play'); return; }
  tick(20);
  if (q('#actionsBtn').hidden) { fail('no Actions in the dock for the played pawn'); return; }
  if (q('#actBar').hidden) q('#actionsBtn').click();
  tick(1);
  if (q('#actBar').hidden || q('#actionsBtn').getAttribute('aria-pressed') !== 'true') { fail('the dock\'s Actions did not open the bar'); return; }
  const rows = {};
  for (const g of ['self', 'house', 'village']) {
    q(`#actBar [data-group="${g}"]`).click(); tick(1);
    if (q('#actMenu').hidden || !q('#actMenu .act-row, #actMenu .act-empty')) fail(`the ${g} group's list did not open`);
    rows[g] = [...doc.querySelectorAll('#actMenu .act-row .nm')].map((n) => n.firstChild.textContent);
  }
  console.log('action bar:', JSON.stringify(rows));
  if (!rows.self.includes('Walk here') || !rows.self.includes('Go home') || !rows.house.includes('Give grain')) fail('the lists lack their acts');
  // Go home, from the Myself list: queued, or refused with its reason
  q('#actBar [data-group="self"]').click(); tick(1);
  const home = [...doc.querySelectorAll('#actMenu .act-row')].find((b) => b.querySelector('.nm').firstChild.textContent === 'Go home');
  home.click(); tick(1);
  const said = q('#actMenu .act-msg') ? q('#actMenu .act-msg').textContent : '';
  if (home.getAttribute('aria-disabled') === 'true' ? !/^Go home: /.test(said) : !queue().includes('goHome') || !/^Queued: Go home/.test(said)) {
    fail(`Go home from the Myself list: ${said} ${queue()}`); }
  Sim.unqueue(st, 0);
  // a winter's visit (VB-292): the Myself list offers it by village, with its days and its pack, for the pawn and for one it speaks for; a
  // click plans it at once (Sim.orderVisit), and the sheet says what is planned and what is under way. On constructed items: the tiny
  // map has no village beyond a day's walk (the simulation's side is tests/journeys.js).
  {
    const real = { o: Sim.opportunities, v: Sim.orderVisit, s: Sim.visitState }, calls = [], place = st.villages[0].name;
    const it = (name, why) => ({ verb: 'visit', target: 0, args: null, holder: null, basis: 'self', fit: null, why, kind: null, when: 'winter',
      visit: { who: holder.id, name, place, days: 5, rations: 5 } });
    Sim.opportunities = (s, id, near) => [...real.o(s, id, near), it(null, null), it('Kari Olsdotter', 'Kari Olsdotter has planned a visit already')];
    Sim.orderVisit = (s, who, v) => { calls.push([who, v]); return true; };
    let state = null; Sim.visitState = () => state;
    q('#actBar [data-group="self"]').click(); tick(1); if (q('#actMenu').hidden) { q('#actBar [data-group="self"]').click(); tick(1); }
    const row = (name) => [...doc.querySelectorAll('#actMenu .act-row')].find((b) => b.querySelector('.nm').firstChild.textContent === name);
    const own = row(`Visit ${place}`), sent = row(`Send Kari Olsdotter to visit ${place}`);
    if (!own || !sent) fail(`the Myself list offers no visit: ${[...doc.querySelectorAll('#actMenu .act-row .nm')].map((n) => n.firstChild.textContent)}`);
    else {
      if (!/5 days away on 5 rations/.test(own.textContent) || !own.querySelector('svg')) fail(`the visit's row lacks its days, its pack or its icon: ${own.textContent}`);
      if (sent.getAttribute('aria-disabled') !== 'true' || !/planned a visit already/.test(sent.textContent)) fail(`a barred visit does not say why: ${sent.textContent}`);
      own.click(); tick(1);
      const msg = q('#actMenu .act-msg') ? q('#actMenu .act-msg').textContent : '';
      if (JSON.stringify(calls) !== JSON.stringify([[holder.id, 0]]) || !/^The visit is planned/.test(msg)) fail(`a visit clicked: ${JSON.stringify(calls)} "${msg}"`);
      if (queue().length) fail('a visit is planned at once, not queued');
      state = { village: 0, state: 'planned', due: st.t + Sim.DAY }; q('#queueBtn').click(); tick(1);
      if (!new RegExp(`A visit to ${place} is planned: you set out on \\w+ day \\d+`).test(q('#playTop').textContent)) fail(`the sheet does not say the visit planned: ${q('#playTop').textContent.slice(0, 300)}`);
      state = { village: 0, state: 'away', daysLeft: 3 }; win.renderActions ? win.renderActions() : tick(20);
      if (!new RegExp(`On a visit to ${place}: 3 days left, by your pack`).test(q('#playTop').textContent)) fail(`the sheet does not say the days left: ${q('#playTop').textContent.slice(0, 300)}`);
      q('#queueBtn').click(); tick(1);
      console.log('action bar, a visit:', own.textContent, '|', sent.textContent);
    }
    Sim.opportunities = real.o; Sim.orderVisit = real.v; Sim.visitState = real.s;
  }
  // the agenda: a cause is no act of the Village list; the dock's Agenda offers each custom's other options, queues one, and links to the customs
  q('#actBar [data-group="village"]').click(); tick(1);
  if ([...doc.querySelectorAll('#actMenu .act-row')].some((b) => /cause/i.test(b.textContent))) fail('the Village list still offers a cause');
  q('#agendaBtn').click(); tick(1);
  const offer = q('#agendaContent [data-agenda="do"]:not([aria-disabled])');
  if (q('#drawerTitle').textContent !== 'Agenda' || !offer) { fail('the Agenda panel offers no cause'); return; }
  offer.click(); tick(1);
  if (!queue().includes('argue') || !/^Queued: /.test(q('#agendaContent [role="status"]').textContent)) fail(`a cause from the Agenda: ${queue()}`);
  Sim.unqueue(st, 0);
  q('#agendaContent [data-agenda="customs"]').click(); tick(1);
  if (q('#tileCustoms').hidden || !q('#tileCustoms .phrase[aria-expanded="true"]') || !q('#tileCustoms .stand')) {
    fail("the Agenda's link does not open the custom on the village's card"); }
  q('#tabFacts').click(); q('#actionsBtn').click(); tick(1);
  q('#actBar [data-group="house"]').click(); tick(1);
  q('#actMenu [data-view="give"]').click(); tick(1);
  const to = q('#giveTo'), opt = to && to.querySelector('option:not([value=""])');
  if (!opt) { fail('the gift\'s form has no household to give to'); return; }
  to.value = opt.value; to.dispatchEvent(new win.Event('change', { bubbles: true })); tick(1);
  q('#giveN').value = '5'; q('#giveN').dispatchEvent(new win.Event('input', { bubbles: true }));
  // VB-1111: the form names who carries it: one of the household who may, the played pawn first, or the receiver's, who fetch it
  const by = q('#giveBy'), byVal = by && by.value;
  if (!by || !by.querySelector('option[value="fetch"]')) fail('the gift\'s form does not say who carries it');
  q('#actMenu [data-give="go"]').click(); tick(1);
  const carried = st.player.queue.find((c) => c.verb === 'give');
  if (carried && (byVal === 'fetch' ? carried.args.carrier !== undefined : carried.args.carrier !== +byVal)) {
    fail(`the gift's carrier is not the one the form names (${byVal}): ${JSON.stringify(carried.args)}`); }
  if (q('#actMenu [data-give="confirm"]')) { q('#actMenu [data-give="confirm"]').click(); tick(1); }
  const gift = st.player.queue.find((c) => c.verb === 'give');
  if (!gift || gift.target !== +opt.value || gift.args.n !== 5 || !/^Queued: 5 grain/.test(q('#actMenu .act-msg').textContent)) {
    fail(`the gift was not queued: ${JSON.stringify(gift)}`); }
  while (st.player.queue.length) Sim.unqueue(st, 0);
  // Walk here: the camera follows the pawn, and a tap at the view's middle (the page's 0, 0 here) is its tile
  q('#queueBtn').click(); tick(1); q('#playBox [data-play="follow"]').click(); tick(200); // the camera glides to the pawn, wherever its work has taken it
  q('#actBar [data-group="self"]').click(); tick(1); q('#actMenu [data-bar="walk"]').click(); tick(1);
  if (q('#actBanner').hidden || !/^Walk here: (tap|click) an open tile/.test(q('#actBanner').textContent) || !q('#actMenu').hidden) {
    fail('Walk here\'s tool is not shown'); }
  win.HTMLElement.prototype.setPointerCapture = () => {};
  const tap = (type) => {
    const e = new win.MouseEvent(type, { bubbles: true, clientX: 0, clientY: 0 }); Object.defineProperty(e, 'pointerId', { value: 1 }); return e; };
  doc.getElementById('stage').dispatchEvent(tap('pointerdown')); doc.getElementById('stage').dispatchEvent(tap('pointerup')); tick(1);
  console.log('action bar, Walk here:', q('#actBanner').textContent, '|', queue().join());
  if (!queue().includes('walkTo') || !/^Queued: walk/.test(q('#actBanner').textContent)) fail('Walk here\'s tool did not queue the walk to the tapped tile');
  await new Promise((r) => setTimeout(r, 3100)); tick(20); // its line stays 3 s
  if (!q('#actBanner').hidden) fail('the banner stays up after the tool is done');
}
