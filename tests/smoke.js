const { JSDOM } = require('jsdom');
const { createCanvas } = require('@napi-rs/canvas');
const fs = require('fs');
const html = fs.readFileSync(require('path').join(__dirname, '../index.html'), 'utf8').replace(/<script src=[^>]+><\/script>/, '');
const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://x.test/' });
const win = dom.window, doc = win.document;
let failed = 0; const fail = (m) => { failed++; console.error('SMOKE FAIL:', m); };
win.console.error = (...a) => fail('page console.error: ' + a.map((x) => (x && x.stack) || String(x)).join(' '));
win.matchMedia = () => ({ matches: false });
doc.hasFocus = () => true;
Object.defineProperty(doc, 'fonts', { value: { load: () => Promise.resolve() } });
const origCreate = doc.createElement.bind(doc);
doc.createElement = (t) => t === 'canvas' ? createCanvas(1, 1) : origCreate(t);
win.HTMLCanvasElement.prototype.getContext = function () { if (!this._c) this._c = createCanvas(Math.max(1, this.width), Math.max(1, this.height)); if (this._c.width !== this.width) { this._c.width = Math.max(1, this.width); this._c.height = Math.max(1, this.height); } return this._c.getContext('2d'); };
Object.defineProperty(doc.getElementById('minimap'), 'clientWidth', { value: 200 });
const calls = {}; let destroyed = 0;
const P = () => ({ x: 1, y: 1, set(a, b) { this.x = a; this.y = b ?? a; }, copyFrom(p) { this.x = p.x; this.y = p.y; } });
class Obj { constructor(o) { this.children = []; this.scale = P(); this.position = P(); this.anchor = P(); this.tilePosition = { x: 0, y: 0 }; this.tileScale = P(); this.alpha = 1; this.visible = true; this.x = 0; this.y = 0; this.opts = o; this.texture = o && o.source ? o : { source: { update() {} } }; }
  get width() { return 400 * this.scale.x; }
  addChild(c) { this.children.push(c); c.parent = this; return c; } removeChildren() { const c = this.children; this.children = []; return c; }
  destroy() { destroyed++; this._dead = true; if (this.parent) this.parent.children = this.parent.children.filter((x) => x !== this); } }
class Graphics extends Obj { constructor() { super(); ['moveTo', 'lineTo', 'stroke', 'poly', 'rect', 'roundRect', 'fill', 'clear', 'ellipse', 'circle'].forEach((m) => { this[m] = (...a) => { if (this._dead) throw new Error('Graphics.' + m + ' after destroy'); calls[m] = (calls[m] || 0) + 1; return this; }; }); } }
const tickers = []; let APP;
class Application { constructor() { APP = this; } async init(o) { this.canvas = origCreate('div'); this.screen = { width: 1440, height: 900 }; this.renderer = { gl: null }; this.ticker = { add: (f) => tickers.push(f) }; this.stage = new Obj(); } }
class Rectangle { constructor(x, y, w, h) { Object.assign(this, { x, y, width: w, height: h }); } }
class Text extends Obj { constructor(o) { super(o); this.text = o.text; } }
win.PIXI = { Rectangle, Text, Application, Container: Obj, Sprite: Obj, TilingSprite: Obj, Graphics, Texture: class { constructor(o) { this.o = o; } }, CanvasSource: class { constructor(o) { if (!o.resource) throw new Error('no resource'); } } };
for (const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) win.eval(m[1].replace(/^const (\w+) =/gm, 'var $1 ='));
// Terrain pixels are painted in full for the first three chunks of each level of detail and left blank after that: nothing here reads
// them, and painting every chunk the page asks for (it repaints as trees and fields change) was three fifths of this test's time.
// The rest of a chunk's job (rivers, paths, decoration, the texture) runs for every chunk; the Chromium tests paint them all.
const baked = [0, 0, 0]; let blank = 0;
{ const G = win.ArchGen, bake = G.bakeChunk; G.bakeChunk = function* (w, l, cx, cy, img) { if (baked[l]++ < 3) yield* bake(w, l, cx, cy, img); else blank++; }; }
let simSt = null; { const adv = win.Sim.advance; win.Sim.advance = (st, h) => { simSt = st; return adv(st, h); }; }
const names = ['water', 'waves', 'lod2', 'lod1', 'lod0', 'fields', 'fences', 'grid', 'regions', 'objects', 'labels', 'hover', 'shadows', 'clouds'];
const state = () => { const lay = APP.stage.children[0].children; return names.map((n, k) => `${n}:${lay[k].children.length}/${lay[k].children.filter((c) => c.visible).length}`).join(' '); };
const tick = (n) => { for (let k = 0; k < n; k++) for (const f of tickers) { try { f({ deltaMS: 16 }); } catch (e) { if (!globalThis.__err) { globalThis.__err = 1; console.log('FRAME ERROR:', e.message); fail('frame error: ' + e.message); } throw e; } } };
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
  console.log('clock:', doc.getElementById('clockDate').textContent, '|', doc.getElementById('clockYear').textContent, '| scenario', doc.getElementById('genScenario').value);
  // the shown clock follows simulation time within a 6-minute step and 5 game minutes, in whole 5-minute steps: it shows the time the
  // pawns are drawn at, between the last two steps (VB-244)
  const shownMin = () => { const m = /Year (\d+), (\d\d):(\d\d)/.exec(doc.getElementById('clockYear').textContent); return m ? (+m[2]) * 60 + (+m[3]) : -1; };
  for (const sp of [1, 3, 10, 30, Infinity]) {
    q(`[data-speed="${sp}"]`).click();
    for (let k = 0; k < (sp === Infinity ? 10 : 400); k++) {
      tick(1); const shown = shownMin(), real = Math.floor(simSt.t * 60 + 1e-6) % 1440, lag = (real - shown + 1440) % 1440;
      if (shown < 0 || shown % 5 !== 0 || lag > 11) { fail(`clock at ${sp}x shows ${shown} min but simulation is at ${real} min`); break; }
    }
  }
  q('[data-speed="1"]').click();
  doc.getElementById('landBtn').click(); tick(5); doc.getElementById('landBtn').click(); tick(2); // the Land overlay on and off (VB-004)
  doc.getElementById('groundBtn').click(); tick(5);
  if (doc.getElementById('groundKey').hidden || !/Bedrock/.test(doc.getElementById('groundKey').textContent)) fail('the Ground overlay shows no key');
  doc.getElementById('groundBtn').click(); tick(2); // the Ground overlay on and off
  doc.getElementById('settlersBtn').click(); tick(20);
  const expand = (selector) => qa(selector).forEach((el) => {
    el.open = true; el.dispatchEvent(new win.Event('toggle'));
  });
  expand('.village-block'); expand('.household-block'); expand('[data-fold^="commons-"]');
  console.log('settlers:', qa('#settlers .farm h2').map((h) => h.textContent).join(' / '));
  console.log('village block:', q('#settlers .farm').textContent.replace(/\s+/g, ' ').slice(0, 300));
  doc.getElementById('customsBtn').click(); expand('#customComparison'); tick(20);
  if (qa('#settlers .farm h2').length === 0) fail('settlers list is empty');
  const nDims = require('../src/load.js').culture.DIMS.length;
  if (qa('.cust tbody tr').length !== nDims) fail('customs table has ' + qa('.cust tbody tr').length + ' rows, expected ' + nDims);
  console.log('customs rows:', qa('.cust tbody tr').length, '| first row:', q('.cust tbody tr').textContent.replace(/\s+/g, ' '), '| bars', qa('.sbar').length);
  console.log('customs text:', qa('#drawerBody .dm').slice(0, 4).map((p) => p.textContent).join(' || '));
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
    const deadAttached = []; const walk = (n, path) => { for (const c of n.children || []) { if (c._dead) deadAttached.push(path); walk(c, path + '>' + (c.constructor.name)); } }; walk(APP.stage, 'stage'); doc.getElementById('settlersBtn').click(); if (!doc.querySelector('#settlers .village-block')) fail('settlers list is empty after regenerating');
    if (!ok) fail('frame error after regenerating');
    console.log('destroyed objects still in the scene:', deadAttached.length); console.log('regen frames ran:', ok, '|', doc.getElementById('name').textContent, '| settlers', [...doc.querySelectorAll('#settlers .farm h2')].map((h) => h.textContent).join(' / ')); goodwillPanel().then(notices).then(actionBar).then(() => process.exit(failed ? 1 : 0)); } }, 50);
}, 50);
// The pawn panel's goodwill balances (VB-218): after a year of populous 7 on the tiny map, with its gifts, a holder with a balance toward
// another household shows its rows, each with what it would give and the parts of that allowance on hover.
async function goodwillPanel() {
  const Sim = win.Sim, msg = doc.getElementById('dbgMsg'); msg.textContent = '';
  doc.querySelector('[data-act="skip1"]').click();
  for (let k = 0; k < 6000 && !msg.textContent.startsWith('Skipped'); k++) await new Promise((r) => setTimeout(r, 5));
  if (!msg.textContent.startsWith('Skipped')) { fail('"Skip a year" did not finish on the tiny map'); return; }
  tick(5);
  const st = simSt, holder = st.pawns.find((p) => p.alive && Sim.isHolder(st, p.id)
    && Sim.goodwillOf(st, p.id).some((x) => Math.abs(x.balance) >= 1 && Sim.explainAllowance(st, p.id, x.other)));
  if (!holder) { fail('no holder has a goodwill balance after a year of populous 7 on the tiny map'); return; }
  const settlers = doc.getElementById('settlers');
  if (doc.getElementById('peopleSheet').classList.contains('collapsed')) doc.getElementById('settlersBtn').click();
  tick(2);
  // each toggle redraws the list, so the next closed fold is found afresh
  for (let el, k = 0; k < 500 && (el = settlers.querySelector('.village-block:not([open]), .household-block:not([open])')); k++) {
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
    const all = hist.querySelectorAll('p').length;
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
  if (!/ holds /.test(hist.textContent) || !/was born/.test(hist.textContent)) fail("a holder's history lacks its birth or its farm");
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
  // The Customs tab (VB-389) of a village's card: the customs as a charter, a phrase a custom; a phrase opens the ways of its custom, each
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
    // a face shows its note (VB-391): how far the person leans, as two percentages, and why; again, and it goes
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
  const Sim = win.Sim, st = simSt, q = (s) => doc.querySelector(s), shown = () => [...doc.querySelectorAll('#toasts .toast')];
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
  tick(2); console.log('chunks asked for by level:', baked.join(', '), '| painted in full', baked.reduce((n, x) => n + x, 0) - blank, '| left blank', blank); if (!baked[2] || !baked[0]) fail('no chunk was painted in full');
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
  const Sim = win.Sim, st = simSt, q = (sel) => doc.querySelector(sel), queue = () => st.player.queue.map((c) => c.verb);
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
  // the gift: a household, 5 rations, Add to the queue
  q('#actBar [data-group="house"]').click(); tick(1);
  q('#actMenu [data-view="give"]').click(); tick(1);
  const to = q('#giveTo'), opt = to && to.querySelector('option:not([value=""])');
  if (!opt) { fail('the gift\'s form has no household to give to'); return; }
  to.value = opt.value; to.dispatchEvent(new win.Event('change', { bubbles: true })); tick(1);
  q('#giveN').value = '5'; q('#giveN').dispatchEvent(new win.Event('input', { bubbles: true }));
  q('#actMenu [data-give="go"]').click(); tick(1);
  if (q('#actMenu [data-give="confirm"]')) { q('#actMenu [data-give="confirm"]').click(); tick(1); }
  const gift = st.player.queue.find((c) => c.verb === 'give');
  if (!gift || gift.target !== +opt.value || gift.args.n !== 5 || !/^Queued: 5 grain/.test(q('#actMenu .act-msg').textContent)) {
    fail(`the gift was not queued: ${JSON.stringify(gift)}`); }
  while (st.player.queue.length) Sim.unqueue(st, 0);
  // Walk here: the camera follows the pawn, and a tap at the view's middle (the page's 0, 0 here) is its tile
  q('#queueBtn').click(); tick(1); q('#playBox [data-play="follow"]').click(); tick(5);
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
