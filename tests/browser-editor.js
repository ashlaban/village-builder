// The archipelago editor in real Chromium: Archipelago editor on the main menu opens a world alone on the stage (no run, none of the game's
// interface); the tools at the top left open their panels in the one scene, Play and Main menu are at the top right and there is no Back; a
// changed form is said to be changed, and Regenerate raises the world it asks for; Main menu goes back, and a game that was open comes back
// with it; Play starts a game on the world shown, settled as chosen, which cannot be saved yet. Runs in verify only.
const { chromium } = require('playwright'), fs = require('fs'), path = require('path');
const { browserHTML } = require('./lib/browser');
const root = path.join(__dirname, '..'), pixi = fs.readFileSync(path.join(root, 'node_modules/pixi.js/dist/pixi.min.js'));
const errors = [], fail = (m) => { errors.push(m); console.error('EDITOR FAIL:', m); };
const HOOK = 'let st = null, speed = 1, selPawn = -1;';
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.VB_CHROMIUM || undefined }),
    page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.setDefaultTimeout(60000);
  page.on('console', (m) => { if (m.type() === 'error') fail('console.error: ' + m.text()); });
  page.on('pageerror', (e) => fail('page error: ' + (e.stack || e.message)));
  await page.route(/^https?:\/\//, (r) => (/pixi(\.min)?\.js/.test(r.request().url())
    ? r.fulfill({ contentType: 'application/javascript', body: pixi }) : r.fulfill({ contentType: 'text/css', body: '' })));
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  if (!html.includes(HOOK)) throw new Error('hook not found');
  await page.route('https://village.test/', (r) => r.fulfill({ contentType: 'text/html', body: browserHTML(html.replace(HOOK,
    HOOK + ' window.__ed = { get st() { return st; }, get w() { return w; }, get demo() { return demo; }, get unsaved() { return unsaved; } };')) }));
  await page.goto('https://village.test/');
  const landing = () => page.waitForFunction(() => !document.getElementById('landing').hidden);
  const raised = () => page.waitForFunction(() => !document.getElementById('edGo').disabled && !document.getElementById('edFacts').hidden
    && document.getElementById('edBar').hidden, null, { timeout: 180000 });
  const world = () => page.evaluate(() => { const w = window.__ed.w; let land = 0; for (let i = 0; i < w.N; i++) land += !w.water[i];
    return { seed: w.seed, cols: w.COLS, rows: w.ROWS, rr: w.RR, land: land / w.N, run: !!window.__ed.st, demo: window.__ed.demo }; });
  await landing();

  // From the main menu: the default world, alone on the stage, with the editor's own interface
  await page.click('#landEdit'); await raised();
  const a = await world();
  if (a.run || !a.demo || a.cols !== 180 || a.rows !== 130 || a.rr !== 7 || Math.abs(a.land - 0.36) > 0.02) fail(`the first world: ${JSON.stringify(a)}`);
  for (const sel of ['.hud.top', '.navigation', '.map-tools']) {
    if (await page.locator(sel).first().isVisible()) fail(`${sel} of the game shows in the editor`);
  }
  const menu = await page.locator('#edMenu').boundingBox(), side = await page.locator('#edGen').boundingBox();
  if (!menu || menu.x + menu.width < 1280 - 40 || menu.y > 40) fail(`Main menu is not in the top right corner: ${JSON.stringify(menu)}`);
  if (!side || side.x > 40) fail('the open tool has no panel at the left');
  if (await page.locator('#editor button', { hasText: /^Back$/ }).count()) fail('the editor has a Back button');
  // the tools: one panel at a time in the one scene; the open tool's button puts its panel away
  await page.click('#edTools [data-tool="settle"]');
  if (await page.locator('#edGen').isVisible() || !(await page.locator('#edSettle').isVisible())) fail('Settlement does not take the place of Generation');
  await page.click('#edTools [data-tool="settle"]');
  if (await page.locator('#edSettle').isVisible()) fail("the open tool's button does not put its panel away");
  await page.click('#edTools [data-tool="gen"]');
  if (!/36%/.test(await page.locator('#edFactList').innerText())) fail('This world does not report the share of land');

  // A changed form says so; Raise the land raises what it asks for
  await page.fill('#edSeed', '42'); await page.selectOption('#edSize', 't'); await page.locator('#edLand').fill('55');
    await page.locator('#edRegion').fill('10');
  if (!/Changed/.test(await page.locator('#edState').innerText())) fail('a changed form is not said to be changed');
  if ((await page.inputValue('#edCols')) !== '120' || (await page.inputValue('#edRows')) !== '85') fail('a size chosen does not set columns and rows');
  await page.fill('#edCols', '100');
  if ((await page.inputValue('#edSize')) !== 'c') fail('columns typed do not make the size Custom');
  await page.click('#edGo'); await page.waitForFunction(() => window.__ed.w.seed === 42, null, { timeout: 180000 }); await raised();
  const b = await world();
  if (b.run || b.cols !== 100 || b.rows !== 85 || b.rr !== 10 || Math.abs(b.land - 0.55) > 0.03) fail(`the world raised: ${JSON.stringify(b)}`);
  if (/Changed/.test(await page.locator('#edState').innerText())) fail('the raised world is still said to be changed');
  await page.fill('#edCols', '5'); await page.click('#edGo'); await page.waitForTimeout(300);
  if ((await world()).cols !== 100 || await page.locator('#edGo').isDisabled()) fail('a size out of range was raised');
  await page.fill('#edCols', '100');

  // Main menu (Esc): no game to go back to; the editor keeps its world for the next visit
  await page.mouse.click(400, 400); await page.keyboard.press('Escape'); await landing();
  if (!(await page.locator('#landBack').isHidden())) fail("the editor's world is offered as a game to go back to");
  await page.click('#landEdit'); await page.waitForTimeout(500);
  if ((await world()).seed !== 42 || (await page.inputValue('#edSeed')) !== '42') fail('the editor did not keep its world');
  await page.click('#edMenu'); await landing();

  // With a game open: it is kept aside, and comes back from the editor
  await page.click('#landQuick');
  await page.waitForFunction(() => window.__ed.st && !window.__ed.demo && document.getElementById('loader').classList.contains('done')
    && !document.getElementById('menuBtn').disabled, null, { timeout: 180000 });
  await page.evaluate(() => { window.__game = window.__ed.st; });
  await page.click('#menuBtn'); await page.click('#landEdit'); await raised();
  if ((await world()).run) fail('the game runs under the editor');
  if ((await page.inputValue('#edSeed')) !== '42') fail('the settings of the earlier visit were lost');
  await page.click('#edMenu'); await landing();
  await page.waitForFunction(() => window.__ed.st === window.__game && !window.__ed.demo);
  if (await page.locator('#landBack').isHidden()) fail('the open game is not offered to go back to');
  await page.click('#landBack');
  if (!(await page.locator('.hud.top').isVisible())) fail("the game's interface did not come back");

  // Play: a game on the world shown (not on a form changed since), settled as the Settlement tool says, and not saved
  await page.click('#menuBtn'); await page.click('#landEdit'); await raised();
  await page.click('#edTools [data-tool="settle"]'); await page.selectOption('#edSettled', 'populous');
  await page.click('#edTools [data-tool="gen"]'); await page.fill('#edSeed', '7');
  await page.click('#edPlay');
  await page.waitForFunction(() => window.__ed.st && window.__ed.st !== window.__game && !window.__ed.demo
    && document.getElementById('loader').classList.contains('done') && !document.getElementById('menuBtn').disabled, null, { timeout: 180000 });
  const g = await page.evaluate(() => { const s = window.__ed.st; return { scenario: s.scenario, seed: s.w.seed, cols: s.w.COLS, rr: s.w.RR,
    unsaved: window.__ed.unsaved, editor: !document.getElementById('editor').hidden, choose: !document.getElementById('choose').hidden }; });
  if (g.scenario !== 'populous' || g.seed !== 42 || g.cols !== 100 || g.rr !== 10 || !g.unsaved || g.editor || !g.choose) fail(`Play: ${JSON.stringify(g)}`);
  await page.click('#chooseWatch'); await page.click('#menuBtn'); await landing(); await page.click('#landLoad');
  await page.waitForSelector('#savesBody .save-files');
  if (!/cannot be saved yet/.test(await page.locator('#savesBody').innerText())) fail('the Saves screen does not say an editor game is not saved');
  if (await page.locator('#savesBody button', { hasText: 'Save to file' }).count()) fail('an editor game is offered to be saved');
  await page.click('#savesClose');
  // and the editor still holds the world that game began on
  await page.click('#landEdit'); await raised();
  const c = await world();
  if (c.run || c.seed !== 42 || c.cols !== 100 || c.rr !== 10) fail(`the editor after Play: ${JSON.stringify(c)}`);

  await browser.close();
  if (errors.length) { console.log(`browser-editor: ${errors.length} failure(s)`); process.exit(1); }
  console.log('browser-editor: a world alone on the stage, its tools in one scene, raised again as the parameters ask; the open game kept aside and '
    + 'brought back; Play starts a game on the world shown');
})().catch((e) => { console.error(e); process.exit(1); });
