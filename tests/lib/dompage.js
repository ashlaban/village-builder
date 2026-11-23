// The page in jsdom (VB-409), as tests/smoke.js and tests/page.js load it: the built page with PixiJS replaced by stand-ins that count their
// draw calls, canvases from @napi-rs/canvas, and the frame loop driven by hand (`tick`). `patch(html)` may change the page's text before it
// runs (tests/page.js adds a smaller island size); `url` may carry a hash that starts a game at once (page/frame).
const { JSDOM, VirtualConsole } = require('jsdom');
const { createCanvas } = require('@napi-rs/canvas');
const { builtPage } = require('./page');

function openPage({ patch = (h) => h, url = 'https://x.test/', label = 'PAGE', painted = 3 } = {}) {
  const html = patch(builtPage().replace(/<script src=[^>]+><\/script>/, ''));
  const out = { failed: 0 };
  const fail = (m) => { out.failed++; console.error(`${label} FAIL:`, m); };
  out.fail = fail;
  // an error the page throws in a handler or a timer, which jsdom reports and goes on from, fails the test
  const vc = new VirtualConsole();
  vc.sendTo(console, { omitJSDOMErrors: true });
  vc.on('jsdomError', (e) => fail('page error: ' + ((e.detail && e.detail.stack) || e.stack || e.message)));
  const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true, url, virtualConsole: vc });
  const win = dom.window, doc = win.document;
  out.win = win; out.doc = doc;
  win.console.error = (...a) => fail('page console.error: ' + a.map((x) => (x && x.stack) || String(x)).join(' '));
  win.matchMedia = () => ({ matches: false });
  doc.hasFocus = () => true;
  Object.defineProperty(doc, 'fonts', { value: { load: () => Promise.resolve() } });
  const origCreate = doc.createElement.bind(doc);
  doc.createElement = (t) => t === 'canvas' ? createCanvas(1, 1) : origCreate(t);
  win.HTMLCanvasElement.prototype.getContext = function () { if (!this._c) this._c = createCanvas(Math.max(1, this.width), Math.max(1, this.height)); if (this._c.width !== this.width) { this._c.width = Math.max(1, this.width); this._c.height = Math.max(1, this.height); } return this._c.getContext('2d'); };
  Object.defineProperty(doc.getElementById('minimap'), 'clientWidth', { value: 200 });
  const calls = {}; out.calls = calls;
  const P = () => ({ x: 1, y: 1, set(a, b) { this.x = a; this.y = b ?? a; }, copyFrom(p) { this.x = p.x; this.y = p.y; } });
  class Obj { constructor(o) { this.children = []; this.scale = P(); this.position = P(); this.anchor = P(); this.tilePosition = { x: 0, y: 0 }; this.tileScale = P(); this.alpha = 1; this.visible = true; this.x = 0; this.y = 0; this.opts = o; this.texture = o && o.source ? o : { source: { update() {} } }; }
    get width() { return 400 * this.scale.x; }
    addChild(c) { this.children.push(c); c.parent = this; return c; } removeChildren() { const c = this.children; this.children = []; return c; }
    destroy() { this._dead = this.destroyed = true; if (this.parent) this.parent.children = this.parent.children.filter((x) => x !== this); } }
  class Graphics extends Obj { constructor() { super(); ['moveTo', 'lineTo', 'stroke', 'poly', 'rect', 'roundRect', 'fill', 'clear', 'ellipse', 'circle'].forEach((m) => { this[m] = (...a) => { if (this._dead) throw new Error('Graphics.' + m + ' after destroy'); calls[m] = (calls[m] || 0) + 1; return this; }; }); } }
  const tickers = [];
  class Application { constructor() { out.APP = this; } async init(o) { this.canvas = origCreate('div'); this.screen = { width: 1440, height: 900 }; this.renderer = { gl: null }; this.ticker = { add: (f) => tickers.push(f) }; this.stage = new Obj(); } }
  class Rectangle { constructor(x, y, w, h) { Object.assign(this, { x, y, width: w, height: h }); } }
  class Text extends Obj { constructor(o) { super(o); this.text = o.text; } }
  win.PIXI = { Rectangle, Text, Application, Container: Obj, Sprite: Obj, TilingSprite: Obj, Graphics, Texture: class { constructor(o) { this.o = o; } }, CanvasSource: class { constructor(o) { if (!o.resource) throw new Error('no resource'); } } };
  for (const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) win.eval(m[1].replace(/^const (\w+) =/gm, 'var $1 ='));
  // Terrain pixels are painted in full for the first `painted` chunks of each level of detail (a number, or one for each level, 0 the
  // nearest) and left blank after that: nothing here reads
  // them, and painting every chunk the page asks for (it repaints as trees and fields change) was three fifths of the smoke's time.
  // The rest of a chunk's job (rivers, paths, decoration, the texture) runs for every chunk; the Chromium tests paint them all.
  out.baked = [0, 0, 0]; out.blank = 0;
  { const G = win.VB['draw/bake'], bake = G.bakeChunk; G.bakeChunk = function* (w, P, l, cx, cy, img) { if (out.baked[l]++ < (Array.isArray(painted) ? painted[l] : painted)) yield* bake(w, P, l, cx, cy, img); else out.blank++; }; }
  // the simulation's state, as the page last advanced it (the page script keeps it in its closure); `seeded`, the last one Sim.seed made
  out.st = null; out.seeded = null;
  { const adv = win.Sim.advance; win.Sim.advance = (st, h) => { out.st = st; return adv(st, h); }; }
  { const seed = win.Sim.seed; win.Sim.seed = (...a) => (out.seeded = seed(...a)); }
  let frameErr = false;
  out.tick = (n) => { for (let k = 0; k < n; k++) for (const f of tickers) { try { f({ deltaMS: 16 }); } catch (e) { if (!frameErr) { frameErr = true; console.log('FRAME ERROR:', e.message); fail('frame error: ' + e.message); } throw e; } } };
  out.q = (s) => doc.querySelector(s);
  out.qa = (s) => [...doc.querySelectorAll(s)];
  out.$ = (id) => doc.getElementById(id);
  // resolves when `pred()` holds, polling every 20 ms; rejects after `ms`
  out.until = (pred, ms, what) => new Promise((res, rej) => {
    const t0 = Date.now(), iv = setInterval(() => {
      if (pred()) { clearInterval(iv); res(); } else if (Date.now() - t0 > ms) { clearInterval(iv); rej(new Error(`${what} not within ${ms} ms`)); }
    }, 20);
  });
  return out;
}
module.exports = { openPage };
