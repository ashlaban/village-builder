// VB-1146: a field's card in the page: the crop, its course, what is sown next and the grain held; for the head of the farm the rotation
// buttons (an allowed one changes the field's rotation and answers "Done", a refused one answers the verb's reason and changes nothing),
// and none for a pawn that is not the head; and the field sprites take the crop's texture (rye under snow in winter).
const { builtPage } = require('./lib/page');
const assert = require('assert'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const { browserHTML } = require('./lib/browser');
const root = path.join(__dirname, '..');
const pixi = fs.readFileSync(path.join(root, 'node_modules/pixi.js/dist/pixi.min.js'));
const HOOK = 'let st = null,\n  speed = 1,\n  selPawn = -1;';
const rawHTML = builtPage().replace(HOOK, HOOK + ' window.__fieldTest = { get st() { return st; }, open(i) { sel = i; showTile(i); }, '
  + 'look: (fd) => fieldLook(fd), hasTex: (k) => !!fieldTex[k] };');
const html = browserHTML(rawHTML);
assert(html.includes('window.__fieldTest'), 'page hook exists');
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
    await page.click('#choosePlay');
    await page.click('[data-speed="0"]');
    // the played head's field, and a field of another household
    const t = await page.evaluate(async () => {
      const st = window.__fieldTest.st, me = st.player.pawn, held = () => st.farmsteads.some((f) => f.household !== null
        && st.households[f.household].holder === me && f.fields.length);
      for (let k = 0; k < 4 * 365 && !held(); k++) { Sim.advance(st, 24); if (k % 20 === 0) await new Promise((r) => setTimeout(r, 0)); }
      const mine = st.farmsteads.find((f) => f.household !== null && st.households[f.household].holder === me && f.fields.length);
      const other = st.farmsteads.find((f) => f.household !== null && st.households[f.household].holder !== me && f.fields.length);
      return { mine: mine ? mine.fields[0].tile : null, other: other ? other.fields[0].tile : null };
    });
    assert(t.mine !== null, 'the played pawn holds a farm with a field: ' + JSON.stringify(t));
    const card = () => page.evaluate(() => ({
      text: document.getElementById('tile').textContent,
      btns: [...document.querySelectorAll('#tileList button[data-field]')].map((b) => ({
        f: b.dataset.field, key: b.dataset.key || null, off: b.classList.contains('off'), on: b.classList.contains('on') })),
      msg: (document.querySelector('#tileList .plan-msg') || {}).textContent || '' }));
    const rotOf = () => page.evaluate((i) => { const f = window.__fieldTest.st.farmsteads.find((q) => q.fields.some((x) => x.tile === i));
      return f.fields.find((x) => x.tile === i).rotation; }, t.mine);
    await page.evaluate((i) => window.__fieldTest.open(i), t.mine);
    let c = await card();
    assert(/Crop|Resting/.test(c.text), 'the crop');
    for (const w of ['Course', 'Sown next', 'held']) assert(c.text.includes(w), `the card shows ${w}: ${c.text}`);
    const rots = c.btns.filter((b) => b.f === 'rotation' && b.key);
    const allowed = rots.find((b) => !b.off && !b.on), refused = rots.find((b) => b.off);
    assert(allowed, 'a rotation the verb allows');
    const before = await rotOf();
    await page.locator(`#tileList button[data-field="rotation"][data-key="${allowed.key}"]`).evaluate((b) => b.click());
    c = await card();
    assert(/^Done/.test(c.msg), `Done: ${c.msg}`);
    assert.strictEqual(await rotOf(), allowed.key); assert.notStrictEqual(before, allowed.key);
    if (refused) {
      const was = await rotOf();
      await page.locator(`#tileList button[data-field="rotation"][data-key="${refused.key}"]`).evaluate((b) => b.click());
      c = await card();
      assert(c.msg && !/^Done/.test(c.msg), `the verb's reason: ${c.msg}`);
      assert.strictEqual(await rotOf(), was, 'a refused choice changes nothing');
    }
    // not the head: no buttons
    if (t.other !== null) {
      await page.evaluate((i) => window.__fieldTest.open(i), t.other);
      c = await card();
      assert(/Course/.test(c.text) && c.btns.length === 0, "another household's field shows its stats and no buttons");
    }
    // winter rye wears the snow
    const look = await page.evaluate(() => { const T = window.__fieldTest, st = T.st;
      while (Sim.cal(st.t).season !== 3) Sim.advance(st, 6);
      return { snow: T.look({ crop: 'rye', stage: 'growing', sown: Math.floor(st.t / Sim.DAY) - 60, tile: 0 }), tex: T.hasTex('rye-snow') }; });
    assert.strictEqual(look.snow, 'rye-snow'); assert(look.tex, 'rye-snow texture exists');
    assert.deepStrictEqual(errors, [], 'no page errors');
    console.log(`browser-fields: the card, ${allowed.key} chosen (Done), ${refused ? 'a refusal answered' : 'no refusal on this seed'}, no buttons for another's field, rye-snow in winter`);
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
