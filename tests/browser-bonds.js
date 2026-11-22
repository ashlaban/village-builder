// VB-1026, VB-1033, VB-1029, VB-1035: a portrait drawn in relation to someone carries its bonds as badges: in a person's Knows best rows and on the spouse's chip of
// its card, with the word as the badge's label; a portrait drawn for nobody carries none.
const { builtPage } = require('./lib/page');
const assert = require('assert'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const { browserHTML } = require('./lib/browser');
const root = path.join(__dirname, '..');
const pixi = fs.readFileSync(path.join(root, 'node_modules/pixi.js/dist/pixi.min.js'));
const HOOK = 'let st = null,\n  speed = 1,\n  selPawn = -1;';
const rawHTML = builtPage().replace(HOOK, HOOK + ' window.__bondTest = { get st() { return st; }, select(id) { stopIntro(); selectPawn(id); }, '
  + 'face: (id, cls, of) => faceImg(id, cls, of), kinds: () => Object.keys(BOND_PATHS), states: () => Object.keys(STATE_PATHS), '
  + 'aged: (id, age) => agedLook(lookOf(st.pawns[id]), age), look: (id) => lookOf(st.pawns[id]), faceAt(id, age) { const p = st.pawns[id], was = p.age; p.age = age; clearPortraits(); '
  + 'const url = faceOf(id); p.age = was; clearPortraits(); return url; }, rigSig(id, age) { const p = st.pawns[id], was = p.age, R = makeRig(p, false); p.age = age; '
  + 'ageRig(R, p); p.age = was; return R.look.aged; } };');
const html = browserHTML(rawHTML);
assert(html.includes('window.__bondTest'), 'page hook exists');
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
    await page.click('#chooseWatch'); await page.click('[data-speed="0"]');
    // a married founder: the first holder with a living spouse
    const pair = await page.evaluate(() => { const st = window.__bondTest.st;
      for (const hh of st.households) { const sp = hh.holder !== null ? Sim.spouseOf(st, hh.holder) : null; if (sp !== null) return [hh.holder, sp]; }
      return null; });
    assert(pair, 'a founding couple');
    const [man, wife] = pair;
    await page.evaluate((id) => window.__bondTest.select(id), man);
    const card = await page.evaluate(() => ({
      chip: [...document.querySelectorAll('#tileLinks .chip .bond, .links .chip .bond')].map((b) => [b.className, b.getAttribute('aria-label'), !!b.querySelector('svg')]),
      rows: [...document.querySelectorAll('#tileRel button.op')].map((r) => ({ pawn: +r.dataset.pawn,
        title: r.title, words: r.querySelector('i:not(.bond)').textContent,
        bonds: [...r.querySelectorAll('.bond')].map((b) => [b.className, b.getAttribute('aria-label')]) })),
      text: document.querySelector('.tile').textContent }));
    assert(card.chip.some(([cls, word, svg]) => /\bkin\b/.test(cls) && word === 'wife' && svg), `the spouse's chip says wife: ${JSON.stringify(card.chip)}`);
    const row = card.rows.find((r) => r.pawn === wife);
    assert(row && row.bonds.some(([cls, word]) => /\bkin\b/.test(cls) && word === 'wife'), `her Knows best row says wife: ${JSON.stringify(card.rows)}`);
    // VB-1033: the words the badges carry are the row's tooltip, not its text, and the card does not write whom he is married to
    assert(/\bwife\b/.test(row.title) && !/wife/.test(row.words), `her row's word is its tooltip: ${JSON.stringify(row)}`);
    assert(!/Husband of/.test(card.text), 'the card leaves the spouse to the chip');
    // the function itself: every bond has an icon; kin both ways in the pawn's own word; nobody's portrait is bare; the opinion's tone
    const fn = await page.evaluate(([m, f]) => { const T = window.__bondTest, st = T.st, P = VB['sim/ties'].SOCIAL, has = (h, w) => h.includes(`aria-label="${w}"`);
      const bare = T.face(f, 'mini'), self = T.face(m, 'mini', m), hers = T.face(m, 'mini', f);
      const rel = st.pawns[m].rel, old = rel.get(f); // a memory made for the check, and taken back: the page writes nothing itself
      const mem = (v) => rel.set(f, { mem: { [Object.keys(P.memories)[0]]: { v, t: st.t } } });
      mem(2); const warm = T.face(f, 'mini', m); mem(-2); const cold = T.face(f, 'mini', m);
      if (old) rel.set(f, old); else rel.delete(f);
      return { kinds: T.kinds(), bare: bare.includes('bond'), self: self.includes('bond'), husband: has(hers, 'husband'),
        warm: has(warm, 'close friend') && warm.includes('bond op good'), cold: has(cold, 'enemy') && cold.includes('bond op bad') }; }, [man, wife]);
    assert.deepStrictEqual(fn.kinds.sort(), ['child', 'close friend', 'dislikes', 'enemy', 'friend', 'housemate', 'parent', 'sibling', 'spouse'], 'one icon a bond');
    assert(!fn.bare && !fn.self, 'a portrait for nobody, or of oneself, has no badge');
    assert(fn.husband, 'he is her husband');
    assert(fn.warm && fn.cold, `the opinion badge and its tone: ${JSON.stringify(fn)}`);
    // VB-1029: a face ages. Hair greys in steps from the pawn's own age for it, a beard comes at 18, on the map's figure as in the portrait;
    // the old have lines in the face, so a married woman's portrait, her hair under the headcloth, ages too
    const age = await page.evaluate(([m, f]) => { const T = window.__bondTest, from = T.aged(m, 0).grey === 0 && T.look(m).greyFrom;
      return { from, young: T.aged(m, 20), old: T.aged(m, 90), boy: T.aged(m, 12).beard, man: T.aged(m, 30).beard === T.look(m).beard,
        steps: [0, 1, 7, 13, 30].map((d) => T.aged(m, Math.ceil(from) + d - (d ? 0 : 2)).grey), rig: [T.rigSig(m, 20), T.rigSig(m, 90)],
        wife: [T.faceAt(f, 30), T.faceAt(f, 90), T.faceAt(f, 30)].map((u) => u.length + ':' + u.slice(-40)) }; }, [man, wife]);
    assert(age.from >= 38 && age.from <= 52, `hair begins to grey between 38 and 52: ${age.from}`);
    assert.deepStrictEqual(age.steps, [0, 1, 2, 3, 3], 'grey in three steps of six years');
    assert(age.young.grey === 0 && age.old.grey === 3 && age.old.hair.join() !== age.young.hair.join(), 'the hair of the old is another colour');
    assert(age.boy === false && age.man, 'no beard on a boy; a man keeps the beard of his look');
    assert(age.rig[0] !== age.rig[1], 'the map figure is aged as the portrait');
    assert(age.wife[0] !== age.wife[1] && age.wife[0] === age.wife[2], 'a married woman\'s portrait ages, by its lines, and is the same again at the same age');
    // VB-1035: unmarried, widowed, expecting and nursing are marks on the card, an icon each with its words as the label, not text;
    // VB-1033: a widower is widowed, as a widow is (the debug's death, as the Debug panel deals it)
    const marks = () => page.evaluate(() => ({ marks: [...document.querySelectorAll('#tileLinks .state-mark')].map((m) => [m.getAttribute('aria-label'), m.title, !!m.querySelector('svg')]),
      text: document.getElementById('tileFacts').textContent }));
    const wed = await marks();
    assert.deepStrictEqual(wed.marks, [], 'a married man has no mark: his wife\'s chip says it');
    const mother = await page.evaluate(([m, f]) => { const T = window.__bondTest, p = T.st.pawns[f], was = [p.pregnantUntil, p.nursingUntil, p.nursling];
      const read = () => { T.select(f); return [...document.querySelectorAll('#tileLinks .state-mark')].map((x) => x.getAttribute('aria-label')); };
      p.pregnantUntil = T.st.t + 100; const expecting = read(); // set for the check, and put back: the page writes neither itself
      p.pregnantUntil = null; p.nursingUntil = T.st.t + 100; p.nursling = null; const nursing = read();
      [p.pregnantUntil, p.nursingUntil, p.nursling] = was; return { expecting, nursing }; }, [man, wife]);
    assert.deepStrictEqual([mother.expecting, mother.nursing], [['Expecting a child'], ['Nursing a baby']], JSON.stringify(mother));
    await page.evaluate(([m, f]) => { Sim.killPawn(window.__bondTest.st, f, 'illness'); window.__bondTest.select(m); }, [man, wife]);
    const widower = await marks();
    assert.deepStrictEqual(widower.marks, [['Widowed', 'Widowed', true]], `a widower is widowed, by its mark: ${JSON.stringify(widower.marks)}`);
    assert(!/Widowed|Unmarried|Expecting|Nursing/.test(wed.text + widower.text), 'and none of it is written');
    // VB-036: the one a pawn courts is that one's chip on its card, with the two hearts and the word as its title (set for the check, and put back)
    const court = await page.evaluate((m) => { const T = window.__bondTest, st = T.st, p = st.pawns[m], q = st.pawns.find((x) => x.alive && x.sex === 'f' && x.id !== m);
      p.courting = q.id; T.select(m);
      const c = document.querySelector(`#tileLinks .chip.as[data-pawn="${q.id}"]`), out = c ? [c.title, c.textContent.trim(), !!c.querySelector('svg')] : null;
      p.courting = null; T.select(m);
      return { out, name: Sim.fullName(q), after: !!document.querySelector('#tileLinks .chip.as') }; }, man);
    assert.deepStrictEqual(court.out, ['Courting', court.name, true], `the courted one's chip: ${JSON.stringify(court)}`);
    assert(!court.after, 'and none for one who courts nobody');
    const kinds = await page.evaluate(() => window.__bondTest.states());
    assert.deepStrictEqual(kinds.sort(), ['expecting', 'nursing', 'unmarried', 'widowed']);
    assert.deepStrictEqual(errors, [], 'no page errors');
    console.log(`browser-bonds: the chip and ${card.rows.length} Knows best rows carry their bonds; 9 icons; faces age`);
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
