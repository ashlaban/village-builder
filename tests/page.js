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
    .replace('/^#([shp]?)([tsml]?)(\\d{1,9})$/', () => { patched++; return '/^#([shp]?)([tsmlx]?)(\\d{1,9})$/'; }),
});
const { doc, win, fail, tick, q, qa, $ } = P;
if (patched !== 2) { fail(`the page's sizes or its hash were not found to add the small island (${patched} of 2 patched)`); process.exit(1); }
const shown = (id) => !$(id).hidden;
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
  const farmB = qa('#settlers button[data-farm]').find((b) => /people/.test(b.textContent));
  if (click(farmB, 'lived-in farm')) {
    tick(3);
    if (!q('#tileStats .stat .meter[role="meter"]')) fail("a farm's card shows no meter of its food");
    for (const [tab, want] of [['tabStores', /Grain/], ['tabLand', /Hay meadows/], ['tabAnimals', /Larder/]]) {
      if ($(tab).hidden) { fail(`a lived-in farm's card has no tab ${tab}`); continue; }
      $(tab).click(); tick(2);
      if (!shown('tileHouse') || !want.test($('tileHouse').textContent) || !q('#tileHouse .stat .stat-ico svg')) fail(`the tab ${tab} shows no stats with icons`);
    }
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
    for (const g of ['self', 'house', 'village']) {
      q(`#actBar [data-group="${g}"]`).click(); tick(1);
      if (q('#actMenu').hidden || !q('#actMenu .act-row, #actMenu .act-empty')) fail(`the ${g} group's list did not open`);
    }
  }
  tick(30);
  console.log('chunks asked for by level:', P.baked.join(', '), '| left blank', P.blank);
  console.log(`page ok: ${days} days run, ${nodes} in the tree, ${rows} villages; built in ${built} ms, ${Date.now() - t0} ms in all`);
}
main().catch((e) => fail(e.stack || e.message)).then(() => process.exit(P.failed ? 1 : 0));
