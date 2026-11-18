// VB-1031, VB-1032: a gathering while it is on. Its mark stands on the map over the spot, and a click on it opens its card: what it is,
// where and until when, and who is there, the portraits with what each is to the played pawn; the card closes when it is over and the
// mark goes. As it begins, a notice says so to the one it concerns (the record tells it only when it is over).
const { builtPage } = require('./lib/page');
const assert = require('assert'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const { browserHTML } = require('./lib/browser');
const root = path.join(__dirname, '..');
const pixi = fs.readFileSync(path.join(root, 'node_modules/pixi.js/dist/pixi.min.js'));
const HOOK = 'let st = null,\n  speed = 1,\n  selPawn = -1;';
const rawHTML = builtPage().replace(HOOK, HOOK + ' window.__gatherTest = { get st() { return st; }, marks: () => [...occMarks.keys()], shown: () => selOcc, '
  + 'view(x, y, z) { stopIntro(); cam.x = x; cam.y = y; cam.z = zt = z; vel.x = vel.y = 0; }, '
  + 'markAt(o) { const k = occScale(); return [(o.x - cam.x) * cam.z + app.screen.width / 2, (o.y - OCC_LIFT - OCC_R * k - cam.y) * cam.z + app.screen.height / 2]; } };');
const html = browserHTML(rawHTML);
assert(html.includes('window.__gatherTest'), 'page hook exists');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.VB_CHROMIUM || undefined });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } }), errors = [];
    page.setDefaultTimeout(60000);
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.route('https://village.test/', (r) => r.fulfill({ contentType: 'text/html', body: html }));
    await page.route(/https:\/\/(cdn\.jsdelivr\.net|fonts\.)/, (r) => /pixi(\.min)?\.js/.test(r.request().url())
      ? r.fulfill({ contentType: 'application/javascript', body: pixi }) : r.fulfill({ contentType: 'text/css', body: '' }));
    await page.goto('https://village.test/');
    await page.waitForFunction(() => !document.getElementById('landing').hidden); await page.click('#landNew');
    await page.click('[data-sc="founders"]'); await page.selectOption('#genSize', 't'); await page.fill('#genSeed', '7');
    await page.locator('#genForm').evaluate((form) => form.dispatchEvent(new Event('submit', { cancelable: true })));
    await page.waitForFunction(() => document.getElementById('loader').classList.contains('done'), null, { timeout: 120000 });
    await page.click('#choosePlay'); // the suggested pawn: a holder of the first village
    await page.click('[data-speed="0"]');
    await page.evaluate(() => { const b = document.querySelector('#tile [data-panel-close], #tileClose'); if (b) b.click(); });
    // on to the first gathering of its village as it begins: the notice says so on the next frames
    await page.evaluate(async () => { const st = window.__gatherTest.st, v = Sim.settlementIdOf(st, st.pawns[st.player.pawn]);
      for (let k = 0; k < 10 * 240 * 4 && !st.occasions.some((x) => x.village === v && st.t >= x.start); k++) {
        Sim.advance(st, 0.1); if (k % 240 === 0) await new Promise((r) => setTimeout(r, 0)); } });
    await page.waitForFunction(() => [...document.querySelectorAll('#toasts .toast')].some((t) => /gathers on|begins (on|at)/.test(t.textContent)));
    // and on until people stand at it
    const o = await page.evaluate(async () => { const st = window.__gatherTest.st, me = st.player.pawn, v = Sim.settlementIdOf(st, st.pawns[me]);
      for (let k = 0; k < 10 * 240 * 4; k++) { Sim.advance(st, 0.1);
        const o = st.occasions.find((x) => x.village === v && st.t >= x.start && st.t < x.end - 0.3 && st.agents.some((a) => a.occasion === x.id && !a.path));
        if (o) return { id: o.id, kind: o.kind, x: o.x, y: o.y, end: o.end, there: st.agents.filter((a) => a.occasion === o.id).map((a) => a.id), me };
        if (k % 240 === 0) await new Promise((r) => setTimeout(r, 0)); }
      return null; });
    assert(o, 'a gathering in the played pawn\'s village within a year');
    await page.evaluate(([x, y]) => window.__gatherTest.view(x, y, 2), [o.x, o.y]);
    await page.waitForFunction((id) => window.__gatherTest.marks().includes(id), o.id);
    const [sx, sy] = await page.evaluate((o) => window.__gatherTest.markAt(o), o);
    await page.mouse.click(sx, sy);
    await page.waitForFunction((id) => window.__gatherTest.shown() === id, o.id);
    await page.waitForTimeout(400);
    const card = await page.evaluate(() => ({ title: document.getElementById('tileName').textContent, text: document.getElementById('tile').textContent,
      badge: !!document.querySelector('#tileBadge .occ-badge svg'), chips: [...document.querySelectorAll('#tileList .chip[data-pawn]')].map((c) => +c.dataset.pawn),
      bonds: document.querySelectorAll('#tileList .chip .bond').length }));
    assert(['The village meeting', 'The rite', 'An ale evening', 'A wedding', 'A funeral ale'].includes(card.title), card.title);
    assert(/until \d\d:\d\d/.test(card.text) && /\d+ there/.test(card.text) && card.badge, `the card says where, until when and how many: ${card.text}`);
    assert.deepStrictEqual([...card.chips].sort((a, b) => a - b), [...o.there].sort((a, b) => a - b), 'its chips are those standing there and those on the way');
    // a chip leads to its person, which closes the gathering's card; when the gathering is over its mark goes
    await page.click(`#tileList .chip[data-pawn="${card.chips[0]}"]`);
    await page.waitForFunction(() => window.__gatherTest.shown() === -1);
    await page.evaluate(([x, y]) => window.__gatherTest.view(x, y, 2), [o.x, o.y]);
    await page.evaluate((end) => { const st = window.__gatherTest.st; while (st.t < end + 0.2) Sim.advance(st, 0.1); }, o.end);
    await page.waitForFunction((id) => !window.__gatherTest.marks().includes(id), o.id);
    assert.deepStrictEqual(errors, [], 'no page errors');
    console.log(`browser-gathering: ${card.title.toLowerCase()}, ${card.chips.length} there (${card.bonds} bonds to the played pawn): the notice, the mark, the card, and gone when over`);
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
