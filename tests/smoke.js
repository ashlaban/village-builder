const { JSDOM } = require('jsdom');
const { createCanvas } = require('@napi-rs/canvas');
const fs = require('fs');
const html = fs.readFileSync(require('path').join(__dirname, '../index.html'), 'utf8').replace(/<script src=[^>]+><\/script>/, '');
const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://x.test/#h7' });
const win = dom.window, doc = win.document;
let failed = 0; const fail = (m) => { failed++; console.error('SMOKE FAIL:', m); };
win.console.error = (...a) => fail('page console.error: ' + a.map(String).join(' '));
win.matchMedia = () => ({ matches: false });
Object.defineProperty(doc, 'fonts', { value: { load: () => Promise.resolve() } });
const origCreate = doc.createElement.bind(doc);
doc.createElement = (t) => t === 'canvas' ? createCanvas(1, 1) : origCreate(t);
win.HTMLCanvasElement.prototype.getContext = function () { if (!this._c) this._c = createCanvas(Math.max(1, this.width), Math.max(1, this.height)); if (this._c.width !== this.width) { this._c.width = Math.max(1, this.width); this._c.height = Math.max(1, this.height); } return this._c.getContext('2d'); };
Object.defineProperty(doc.getElementById('minimap'), 'clientWidth', { value: 200 });
const calls = {}; let destroyed = 0;
const P = () => ({ x: 1, y: 1, set(a, b) { this.x = a; this.y = b ?? a; }, copyFrom(p) { this.x = p.x; this.y = p.y; } });
class Obj { constructor(o) { this.children = []; this.scale = P(); this.position = P(); this.anchor = P(); this.tilePosition = { x: 0, y: 0 }; this.tileScale = P(); this.alpha = 1; this.visible = true; this.x = 0; this.y = 0; this.opts = o; }
  get width() { return 400 * this.scale.x; }
  addChild(c) { this.children.push(c); c.parent = this; return c; } removeChildren() { const c = this.children; this.children = []; return c; }
  destroy() { destroyed++; this._dead = true; if (this.parent) this.parent.children = this.parent.children.filter((x) => x !== this); } }
class Graphics extends Obj { constructor() { super(); ['moveTo', 'lineTo', 'stroke', 'poly', 'fill', 'clear', 'ellipse'].forEach((m) => { this[m] = (...a) => { if (this._dead) throw new Error('Graphics.' + m + ' after destroy'); calls[m] = (calls[m] || 0) + 1; return this; }; }); } }
const tickers = []; let APP;
class Application { constructor() { APP = this; } async init(o) { this.canvas = origCreate('div'); this.screen = { width: 1440, height: 900 }; this.renderer = { gl: null }; this.ticker = { add: (f) => tickers.push(f) }; this.stage = new Obj(); } }
class Rectangle { constructor(x, y, w, h) { Object.assign(this, { x, y, width: w, height: h }); } }
class Text extends Obj { constructor(o) { super(o); this.text = o.text; } }
win.PIXI = { Rectangle, Text, Application, Container: Obj, Sprite: Obj, TilingSprite: Obj, Graphics, Texture: class { constructor(o) { this.o = o; } }, CanvasSource: class { constructor(o) { if (!o.resource) throw new Error('no resource'); } } };
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
win.eval(scripts[0].replace('const ArchGen', 'var ArchGen'));
win.eval(scripts[1].replace('const Culture', 'var Culture'));
win.eval(scripts[2].replace('const Sim', 'var Sim'));
win.eval(scripts[3]);
const names = ['water', 'waves', 'lod2', 'lod1', 'lod0', 'fields', 'fences', 'grid', 'regions', 'objects', 'labels', 'hover', 'shadows', 'clouds'];
const state = () => { const lay = APP.stage.children[0].children; return names.map((n, k) => `${n}:${lay[k].children.length}/${lay[k].children.filter((c) => c.visible).length}`).join(' '); };
const tick = (n) => { for (let k = 0; k < n; k++) for (const f of tickers) { try { f({ deltaMS: 16 }); } catch (e) { if (!globalThis.__err) { globalThis.__err = 1; console.log('FRAME ERROR:', e.message); fail('frame error: ' + e.message); } throw e; } } };
const start = Date.now();
const iv = setInterval(async () => {
  if (!doc.getElementById('loader').classList.contains('done')) { if (Date.now() - start > 90000) { fail('loader timeout'); process.exit(1); } return; }
  clearInterval(iv); if (globalThis.__ran) return; globalThis.__ran = 1;
  console.log('built', Date.now() - start, 'ms |', doc.getElementById('meta').textContent);
  let t = Date.now(); tick(300); console.log('after intro (300 frames,', Date.now() - t, 'ms):', state(), '| lod:', doc.getElementById('lod').hidden ? 'idle' : doc.getElementById('lod').textContent);
  t = Date.now(); let n = 0; while (!doc.getElementById('lod').hidden && n < 2000) { tick(1); n++; } console.log('settled after', n, 'more frames', Date.now() - t, 'ms:', state());
  const q = (s) => doc.querySelector(s), qa = (s) => [...doc.querySelectorAll(s)];
  console.log('clock:', doc.getElementById('clockDate').textContent, '|', doc.getElementById('clockYear').textContent, '| scenario', doc.getElementById('scenarioSel').value);
  doc.getElementById('settlersBtn').click(); tick(20);
  console.log('settlers:', qa('#settlers .farm h2').map((h) => h.textContent).join(' / '));
  console.log('village block:', q('#settlers .farm').textContent.replace(/\s+/g, ' ').slice(0, 300));
  doc.getElementById('customsBtn').click(); tick(20);
  if (qa('#settlers .farm h2').length === 0) fail('settlers list is empty');
  if (qa('.cust tbody tr').length !== 11) fail('customs table has ' + qa('.cust tbody tr').length + ' rows, expected 11');
  console.log('customs rows:', qa('.cust tbody tr').length, '| first row:', q('.cust tbody tr').textContent.replace(/\s+/g, ' '), '| bars', qa('.sbar').length);
  console.log('customs text:', qa('#drawerBody .dm').slice(0, 4).map((p) => p.textContent).join(' || '));
  doc.getElementById('debugBtn').click(); tick(5);
  console.log('debug when:', doc.getElementById('dbgWhen').textContent, '| out:', doc.getElementById('dbgOut').textContent);
  q('[data-act="meet"]').click(); console.log('meet:', doc.getElementById('dbgMsg').textContent);
  q('[data-act="move"]').click(); console.log('move:', doc.getElementById('dbgMsg').textContent);
  // select the bachelor through the settlers list, then kill him from the debug panel
  const sb = qa('#settlers button[data-pawn]').find((x) => /Röninge|Ulsäter/.test(x.closest('.farm').textContent) && x.closest('.farm').querySelectorAll('li').length === 1);
  if (sb) { sb.click(); tick(3); console.log('selected:', doc.getElementById('dbgSel').textContent); q('[data-act="kill"]').click(); console.log('kill:', doc.getElementById('dbgMsg').textContent); }
  tick(30);
  doc.getElementById('treeBtn').click(); tick(2);
  console.log('tree:', doc.getElementById('treeSub').textContent, '| nodes', qa('#treeSvg g.tn').length, 'dead', qa('#treeSvg g.tn.dead').length, 'heir dots', qa('#treeSvg .heir').length);
  if (!qa('#treeSvg g.tn').length) fail('family tree is empty');
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
  doc.getElementById('scenarioSel').value = 'founders'; doc.getElementById('regen').click();
  const iv2 = setInterval(() => { if (!doc.getElementById('regen').disabled && doc.getElementById('loader').classList.contains('done')) tick(20);  if (doc.getElementById('loader').classList.contains('done') && !doc.getElementById('regen').disabled) { clearInterval(iv2); let ok = true; try { tick(10); } catch (e) { ok = false; }
    const deadAttached = []; const walk = (n, path) => { for (const c of n.children || []) { if (c._dead) deadAttached.push(path); walk(c, path + '>' + (c.constructor.name)); } }; walk(APP.stage, 'stage'); if (!doc.querySelectorAll('#settlers .farm h2').length) fail('settlers list is empty after regenerating');
    if (!ok) fail('frame error after regenerating');
    console.log('destroyed objects still in the scene:', deadAttached.length); console.log('regen frames ran:', ok, '|', doc.getElementById('name').textContent, '| settlers', [...doc.querySelectorAll('#settlers .farm h2')].map((h) => h.textContent).join(' / ')); process.exit(failed ? 1 : 0); } }, 50);
}, 50);
