// The archipelago editor in real Chromium: Archipelago editor on the main menu opens a world alone on the stage (no run, none of the game's
// interface); the tools at the top left open their panels in the one scene, Play and Main menu are at the top right and there is no Back; a
// changed form is said to be changed, and Regenerate raises the world it asks for; Main menu goes back, and a game that was open comes back
// with it; the terrain brush lays ground cover and deposits on the land, and Regenerate asks before it clears them; Play starts a game on
// the world shown, with what was painted, settled as chosen, which cannot be saved yet; placed by hand, a village and a household are laid at
// once and stand still, Play waits for something placed and begins on what is placed. Runs in verify only.
const { chromium } = require('playwright'), fs = require('fs'), path = require('path');
const { browserHTML } = require('./lib/browser');
const root = path.join(__dirname, '..'), pixi = fs.readFileSync(path.join(root, 'node_modules/pixi.js/dist/pixi.min.js'));
const errors = [], fail = (m) => { errors.push(m); console.error('EDITOR FAIL:', m); };
const HOOK = 'let st = null,\n  speed = 1,\n  selPawn = -1;';
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
    HOOK + ' window.__ed = { get st() { return st; }, get w() { return w; }, get demo() { return demo; }, get unsaved() { return unsaved; }, get cam() { return cam; } };')) }));
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

  // The terrain brush: a land tile on the open map, away from the panels; a cover dragged over it, a deposit laid on it
  const spot = (not) => page.evaluate((not) => {
    const w = window.__ed.w, c = window.__ed.cam, r = document.getElementById('stage').getBoundingClientRect();
    for (let i = 0; i < w.N; i++) {
      const x = r.left + r.width / 2 + (w.hx[i] - c.x) * c.z, y = r.top + r.height / 2 + (w.hy[i] - c.y) * c.z;
      if (w.water[i] || w.biome[i] === not || x < 420 || x > 1180 || y < 120 || y > 740) continue;
      if ([0, 1, 2, 3, 4, 5].every((d) => w.nb[i * 6 + d] >= 0 && !w.water[w.nb[i * 6 + d]] && !w.river[w.nb[i * 6 + d]])) return { i, x, y, step: w.HW * c.z };
    }
    return null;
  }, not);
  await page.click('#menuBtn'); await page.click('#landEdit'); await raised(); await page.click('#edTools [data-tool="terrain"]');
  const SNOW = 12, IRON = 3, at = await spot(SNOW);
  if (!at) throw new Error('no land tile to paint on');
  await page.click(`#edBrushes [data-cover="${SNOW}"]`); await page.locator('#edBrushSize').fill('1');
  const camWas = await page.evaluate(() => ({ ...window.__ed.cam }));
  await page.mouse.move(at.x, at.y); await page.mouse.down(); await page.mouse.move(at.x + at.step * 3, at.y, { steps: 3 }); await page.mouse.up();
  const snow = await page.evaluate(([i, b]) => { const w = window.__ed.w, c = window.__ed.cam;
    return { here: w.biome[i], east: w.biome[i + 3], ring: [0, 1, 2, 3, 4, 5].filter((d) => w.biome[w.nb[i * 6 + d]] === b).length, x: c.x, y: c.y }; },
      [at.i, SNOW]);
  if (snow.here !== SNOW || snow.east !== SNOW || snow.ring !== 6) fail(`the cover brush: ${JSON.stringify(snow)}`);
  if (snow.x !== camWas.x || snow.y !== camWas.y) fail('a drag with a brush moved the map');
  await page.click('#edBrushes [data-deposit="' + IRON + '"]'); await page.locator('#edBrushSize').fill('0');
  await page.mouse.click(at.x, at.y);
  const ore = await page.evaluate((i) => {
    const w = window.__ed.w; return { d: w.deposit[i], left: w.depositLeft[i], vein: w.veinKind[w.vein[i]], near: w.veinNear[i + 1] === w.vein[i] }; }, at.i);
  if (ore.d !== IRON || !(ore.left > 0) || ore.vein !== IRON || !ore.near) fail(`the deposit brush: ${JSON.stringify(ore)}`);
  if (!/Ground cover on \d+ tiles, deposits on 1 tile\./.test(await page.locator('#edPainted').innerText())) fail(
    `painted: ${await page.locator('#edPainted').innerText()}`);
  // with no brush the map is dragged again; Regenerate asks once before it clears what is painted
  await page.click('#edBrushes [data-brush="none"]'); await page.mouse.move(700, 400); await page.mouse.wheel(0, -600); await page.waitForTimeout(600);
  await page.mouse.move(700, 400); await page.mouse.down(); await page.mouse.move(600, 400, { steps: 4 }); await page.mouse.up();
  if ((await page.evaluate(() => window.__ed.cam.x)) === camWas.x) fail('without a brush a drag does not move the map');
  await page.click('#edTools [data-tool="gen"]'); await page.click('#edGo'); await page.waitForTimeout(300);
  if (!/clear what is painted/.test(await page.locator('#edGo').innerText()) ||
    (await world()).seed !== 42) fail('Regenerate did not ask before clearing what is painted');
  await page.click('#edMenu'); await landing(); await page.click('#landBack');

  // Play: a game on the world shown (not on a form changed since), with what was painted, settled as the Settlement tool says, not saved
  await page.click('#menuBtn'); await page.click('#landEdit'); await raised();
  await page.click('#edTools [data-tool="settle"]'); await page.selectOption('#edSettled', 'populous');
  await page.click('#edTools [data-tool="gen"]'); await page.fill('#edSeed', '7');
  await page.click('#edPlay');
  await page.waitForFunction(() => window.__ed.st && window.__ed.st !== window.__game && !window.__ed.demo
    && document.getElementById('loader').classList.contains('done') && !document.getElementById('menuBtn').disabled, null, { timeout: 180000 });
  const g = await page.evaluate(() => { const s = window.__ed.st; return { scenario: s.scenario, seed: s.w.seed, cols: s.w.COLS, rr: s.w.RR,
    unsaved: window.__ed.unsaved, editor: !document.getElementById('editor').hidden, choose: !document.getElementById('choose').hidden }; });
  if (g.scenario !== 'populous' || g.seed !== 42 || g.cols !== 100 || g.rr !== 10 || !g.unsaved || g.editor || !g.choose) fail(`Play: ${JSON.stringify(g)}`);
  const laid = await page.evaluate(([i, b]) => {
    const w = window.__ed.st.w; return { d: w.deposit[i], vein: w.veinKind[w.vein[i]], east: w.biome[i + 3] === b }; }, [at.i, SNOW]);
  if (laid.d !== IRON || laid.vein !== IRON || !laid.east) fail(`the game does not begin on the land as painted: ${JSON.stringify(laid)}`);
  await page.click('#chooseWatch'); await page.click('#menuBtn'); await landing(); await page.click('#landLoad');
  await page.waitForSelector('#savesBody .save-files');
  if (!/cannot be saved yet/.test(await page.locator('#savesBody').innerText())) fail('the Saves screen does not say an editor game is not saved');
  if (await page.locator('#savesBody button', { hasText: 'Save to file' }).count()) fail('an editor game is offered to be saved');
  await page.click('#savesClose');
  // and the editor still holds the world that game began on
  await page.click('#landEdit'); await raised();
  const c = await world();
  if (c.run || c.seed !== 42 || c.cols !== 100 || c.rr !== 10) fail(`the editor after Play: ${JSON.stringify(c)}`);
  if ((await page.evaluate((i) => window.__ed.w.deposit[i], at.i)) !== IRON) fail('the editor lost what was painted when a game was played');
  await page.click('#edTools [data-tool="terrain"]'); await page.click('#edUnpaint'); await page.waitForTimeout(200); await raised();
  if ((await page.evaluate((i) => window.__ed.w.deposit[i], at.i)) === IRON || !/Nothing yet/.test(await page.locator('#edPainted').innerText())) {
    fail('Clear what is painted left the deposit');
  }

  // Placed by hand: Play waits for something placed; a village is laid at once about a tile, and a household near it joins it
  await page.click('#edTools [data-tool="settle"]'); await page.selectOption('#edSettled', 'manual');
  if (!(await page.locator('#edPlay').isDisabled())) fail('Play is offered with nothing placed by hand');
  const placed = () => page.evaluate(() => { const s = window.__ed.st; return s ? { farms: s.farmsteads.length, villages: s.villages.length, t: s.t,
    centre: s.villages[0].center, sizes: s.villages.map((v) => v.farmsteads.length) } : { farms: 0, villages: 0 }; });
  // land tiles on the open map, the best meadows first (or those 4 to 8 steps from a tile), to press on until one takes
  const tries = (near) => page.evaluate((near) => {
    const w = window.__ed.w, c = window.__ed.cam, r = document.getElementById('stage').getBoundingClientRect(), out = [];
    const ax = (i) => { const row = (i / w.COLS) | 0, col = i % w.COLS; return [col - ((row - (row & 1)) >> 1), row]; };
    const steps = (a, b) => { const [q1, r1] = ax(a), [q2, r2] = ax(b); return (Math.abs(q1 - q2) + Math.abs(r1 - r2) + Math.abs(q1 + r1 - q2 - r2)) / 2; };
    for (let i = 0; i < w.N; i++) {
      const x = r.left + r.width / 2 + (w.hx[i] - c.x) * c.z, y = r.top + r.height / 2 + (w.hy[i] - c.y) * c.z;
      if (w.water[i] || w.biome[i] !== 5 || w.river[i] || x < 420 || x > 1180 || y < 120 || y > 740) continue;
      if (near >= 0 ? steps(i, near) < 4 || steps(i, near) > 8 : ![0, 1, 2, 3, 4, 5].every((d) => w.nb[i * 6 + d] >= 0 && w.biome[w.nb[i * 6 + d]] === 5)) continue;
      out.push({ x, y });
    }
    return out.slice(0, 40);
  }, near);
  const pressUntil = async (list, more) => { for (const p of list) { await page.mouse.click(p.x, p.y); await page.waitForTimeout(250); if (await more()) return true; } return false; };
  await page.click('#edPlaces [data-place="village"]'); await page.locator('#edFarms').fill('4');
  if (!(await pressUntil(await tries(-1), async () => (await placed()).farms > 0))) fail('no village could be placed on the meadows');
  const v1 = await placed();
  if (v1.villages !== 1 || v1.farms < 2 || v1.farms > 4 || await page.locator('#edPlay').isDisabled()) fail(`a village placed: ${JSON.stringify(v1)}`);
  await page.click('#edPlaces [data-place="farm"]');
  if (!(await pressUntil(await tries(v1.centre), async () => (await placed()).farms > v1.farms))) fail('no household could be placed near the village');
  const v2 = await placed();
  if (v2.villages !== 1 || v2.farms !== v1.farms + 1) fail(`a household placed near a village is not of it: ${JSON.stringify(v2)}`);
  // a field by the household; a road found from the green to the house, worn as a lane where nothing is built; each button has its icon
  const extra = () => page.evaluate(() => { const s = window.__ed.st, w = s.w; let lane = 0; for (let i = 0; i < w.N; i++) lane += w.worn[i] === 3;
    return { fields: s.farmsteads.reduce((n, f) => n + f.fields.length, 0), lane, house: s.farmsteads[s.farmsteads.length - 1].house }; });
  const e0 = await extra();
  await page.click('#edPlaces [data-place="field"]');
  if (!(await pressUntil(await tries(e0.house), async () => (await extra()).fields > e0.fields))) fail('no field could be placed by the household');
  const xy = (i) => page.evaluate((i) => { const w = window.__ed.w, c = window.__ed.cam, r = document.getElementById('stage').getBoundingClientRect();
    return { x: r.left + r.width / 2 + (w.hx[i] - c.x) * c.z, y: r.top + r.height / 2 + (w.hy[i] - c.y) * c.z }; }, i);
  await page.click('#edPlaces [data-place="route"]');
  const from = await xy(v1.centre), to = await xy(e0.house);
  await page.mouse.click(from.x, from.y); await page.mouse.click(to.x, to.y); await page.waitForTimeout(400);
  const e1 = await extra();
  if (!(e1.lane > e0.lane) || !/1 road/.test(await page.locator('#edPlaced').innerText())) fail(`a road found: ${JSON.stringify([e0, e1])}`);
  if ((await page.locator('#edPlaces button svg').count()) !== 11) fail('a place button has no icon');
  // an empty farm by the village, and a person placed in it, who founds its household and holds it
  const folk = () => page.evaluate(() => { const s = window.__ed.st; return { n: s.pawns.length, hh: s.households.length, bare: s.farmsteads.filter((f) => f.household === null).length,
    last: s.farmsteads[s.farmsteads.length - 1].house, holder: s.households.length ? s.pawns[s.households[s.households.length - 1].holder].age : -1 }; });
  const f0 = await folk();
  await page.click('#edPlaces [data-place="empty"]');
  if (!(await pressUntil(await tries(v1.centre), async () => (await folk()).bare > f0.bare))) fail('no empty farm could be placed near the village');
  const f1 = await folk();
  if (f1.n !== f0.n || f1.hh !== f0.hh || !/1 empty farm/.test(await page.locator('#edPlaced').innerText())) fail(`an empty farm: ${JSON.stringify([f0, f1])}`);
  await page.click('#edPlaces [data-place="pawn"]'); await page.fill('#edPawnAge', '41'); await page.selectOption('#edPawnSex', 'f');
  const door = await xy(f1.last);
  await page.mouse.click(door.x, door.y); await page.waitForTimeout(400);
  const f2 = await folk();
  if (f2.n !== f1.n + 1 || f2.hh !== f1.hh + 1 || f2.bare !== f0.bare || f2.holder !== 41) fail(`a person placed in an empty farm: ${JSON.stringify([f1, f2])}`);
  Object.assign(v2, { farms: v2.farms + 1 }); Object.assign(e1, await extra()); // the game is held to all that is placed now
  await page.waitForTimeout(1500);
  if ((await placed()).t !== v2.t) fail('the picture of what is placed does not stand still');
  if (!/households in 1 village/.test(await page.locator('#edPlaced').innerText())) fail(`placed: ${await page.locator('#edPlaced').innerText()}`);
  // Play begins on what is placed
  await page.click('#edPlay');
  await page.waitForFunction(() => window.__ed.st && !window.__ed.demo && window.__ed.st.scenario === 'manual'
    && document.getElementById('loader').classList.contains('done') && !document.getElementById('menuBtn').disabled, null, { timeout: 180000 });
  const g2 = await page.evaluate(() => { const s = window.__ed.st; return { farms: s.farmsteads.length, villages: s.villages.length, centre: s.villages[0].center,
    unsaved: window.__ed.unsaved, choose: !document.getElementById('choose').hidden }; });
  const e2 = await extra();
  if (e2.fields !== e1.fields || e2.lane !== e1.lane) fail(`the game's fields and roads are not those placed: ${JSON.stringify([e1, e2])}`);
  if (g2.farms !== v2.farms || g2.villages !== 1 || g2.centre !== v2.centre || !g2.unsaved || !g2.choose) fail(`Play, placed by hand: ${JSON.stringify(g2)} for ${JSON.stringify(v2)}`);
  // back in the editor what was placed stands again; one taken away, then all
  await page.click('#chooseWatch'); await page.click('#menuBtn'); await landing(); await page.click('#landEdit'); await raised();
  if ((await placed()).farms !== v2.farms) fail('the editor lost what was placed when a game was played');
  await page.click('#edUnplace'); await page.waitForTimeout(400);
  if ((await placed()).farms !== 0 || !(await page.locator('#edPlay').isDisabled())) fail('Take all away left something placed, or Play offered');

  await browser.close();
  if (errors.length) { console.log(`browser-editor: ${errors.length} failure(s)`); process.exit(1); }
  console.log('browser-editor: a world alone on the stage, its tools in one scene, raised again as the parameters ask; the open game kept aside and '
    + 'brought back; the brush lays cover and deposits; a village, a household, a field, a road, an empty farm and a person placed by hand; Play starts a game on the world as made');
})().catch((e) => { console.error(e); process.exit(1); });
