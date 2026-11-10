// usage: node tools/save-times.js [--fixtures small-y40,medium-y5] [--runs 3] [--json]
//   the time of each stage of a save and of a load (VB-260), at late fixtures, in Node and in real Chromium (the page's own code and
//   CompressionStream, IndexedDB); the median of --runs after one warm-up. Save: encode (Sim.save), stringify, gzip, IndexedDB write
//   (Chromium only). Load: IndexedDB read (Chromium only), gunzip, parse, decode (Sim.load on the world already generated).
//   Says when a fixture is stale (its golden hash differs from tests/golden.json; the state is still the saved one). The 0.5 s line is
//   VB-199's and VB-226's, not this tool's. Needs the fixtures (node tools/fixtures.js fetch) and, for Chromium, Playwright.
require('./help.js')(__filename);
const fs = require('fs'), path = require('path'), zlib = require('zlib'), { performance } = require('perf_hooks');
const F = require('../tests/lib/fixtures.js');
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const names = opt('--fixtures', 'small-y40,medium-y5').split(','), runs = +opt('--runs', 3), asJson = args.includes('--json');
const median = (v) => { const s = [...v].sort((a, b) => a - b); return s[s.length >> 1]; };
const STAGES = ['encode', 'stringify', 'gzip', 'idbWrite', 'idbRead', 'gunzip', 'parse', 'decode'];
const reduce = (rows) => Object.fromEntries(STAGES.filter((k) => rows.every((r) => k in r)).map((k) => [k, median(rows.map((r) => r[k]))]));
const SIZES = { 'small-y5': 's', 'small-y40': 's', 'medium-y5': 'm', 'medium-ref': 'm' };

function nodeTimes(name) {
  const data = JSON.parse(zlib.gunzipSync(fs.readFileSync(F.files(name).save)).toString('utf8'));
  const VB = require('../src/load.js'), Sim = VB.sim, it = VB.gen.generate(data.seed, { cols: data.cols, rows: data.rows });
  let r; while (!(r = it.next()).done);
  const wd = r.value, st = Sim.load(wd, data), rows = [], t = (f) => { const a = performance.now(), v = f(); return [v, performance.now() - a]; };
  for (let i = 0; i <= runs; i++) {
    const [sv, encode] = t(() => Sim.save(st)), [text, stringify] = t(() => JSON.stringify(sv)), [gz, gzip] = t(() => zlib.gzipSync(text));
    const [raw, gunzip] = t(() => zlib.gunzipSync(gz).toString('utf8')), [obj, parse] = t(() => JSON.parse(raw)), [, decode] = t(() => Sim.load(wd, obj));
    if (i) rows.push({ encode, stringify, gzip, gunzip, parse, decode, jsonMB: text.length / 1e6, gzipMB: gz.length / 1e6 });
  }
  return { ...reduce(rows), jsonMB: rows[0].jsonMB, gzipMB: rows[0].gzipMB };
}

async function chromiumTimes(list) {
  const { chromium } = require('playwright'), root = path.join(__dirname, '..');
  const pixi = fs.readFileSync(path.join(root, 'node_modules/pixi.js/dist/pixi.min.js')), HOOK = 'let st = null, speed = 1, selPawn = -1;';
  const browser = await chromium.launch({ executablePath: process.env.VB_CHROMIUM || undefined }), out = {};
  const { browserHTML } = require('../tests/lib/browser');
  for (const name of list) {
    const text = zlib.gunzipSync(fs.readFileSync(F.files(name).save)).toString('utf8'), page = await browser.newPage();
    page.setDefaultTimeout(600000); page.on('pageerror', (e) => console.error('pageerror', e.message));
    await page.route(/^https?:\/\//, (r) => /pixi(\.min)?\.js/.test(r.request().url()) ? r.fulfill({ contentType: 'application/javascript', body: pixi }) : r.fulfill({ contentType: 'text/css', body: '' }));
    await page.route('https://village.test/', (r) => r.fulfill({ contentType: 'text/html', body: browserHTML(fs.readFileSync(path.join(root, 'index.html'), 'utf8')
      .replace(HOOK, HOOK + ' window.__play = { get st() { return st; }, Sim, build: (...a) => build(...a), gzip: (...a) => gzip(...a), gunzip: (...a) => gunzip(...a), saveTx: (...a) => saveTx(...a) };')) }));
    await page.goto('https://village.test/');
    await page.waitForFunction(() => !!window.__play && !document.getElementById('landing').hidden);
    // go on from the fixture the way Continue does: the world regenerated, then Sim.load
    await page.evaluate(async ({ text, size }) => { const d = JSON.parse(text); await window.__play.build(d.seed, d.scenario, size, d); }, { text, size: SIZES[name] });
    await page.waitForFunction(() => document.getElementById('loader').classList.contains('done') && !!window.__play.st, null, { timeout: 120000 });
    await page.evaluate(() => document.querySelector('[data-speed="0"]').click());
    out[name] = await page.evaluate(async (n) => {
      const { st, Sim, gzip, gunzip, saveTx } = window.__play, w = st.w, rows = [], tm = async (f) => { const a = performance.now(), v = await f(); return [v, performance.now() - a]; };
      for (let i = 0; i <= n; i++) {
        const [sv, encode] = await tm(() => Sim.save(st)), [txt, stringify] = await tm(() => JSON.stringify(sv)), [blob, gz] = await tm(() => gzip(txt));
        const [, idbWrite] = await tm(() => saveTx('readwrite', (m, b) => { b.put({ key: 'times:probe', blob }); }));
        const [rec, idbRead] = await tm(() => saveTx('readonly', (m, b) => b.get('times:probe')));
        const [raw, gunzipMs] = await tm(() => gunzip(rec.blob)), [obj, parse] = await tm(() => JSON.parse(raw)), [, decode] = await tm(() => Sim.load(w, obj));
        if (i) rows.push({ encode, stringify, gzip: gz, idbWrite, idbRead, gunzip: gunzipMs, parse, decode, jsonMB: txt.length / 1e6, gzipMB: blob.size / 1e6 });
      }
      await saveTx('readwrite', (m, b) => { b.delete('times:probe'); });
      return rows;
    }, runs);
    out[name] = { ...reduce(out[name]), jsonMB: out[name][0].jsonMB, gzipMB: out[name][0].gzipMB };
    await page.close();
  }
  await browser.close();
  return out;
}

(async () => {
  const stale = {}, res = { node: {}, chromium: {} };
  for (const n of names) { const s = F.status(n); if (s.status === 'missing') { console.error(`${n}: missing (node tools/fixtures.js fetch)`); process.exit(1); } stale[n] = s.status === 'stale'; }
  for (const n of names) res.node[n] = nodeTimes(n);
  res.chromium = await chromiumTimes(names);
  if (asJson) { console.log(JSON.stringify({ stale, ...res }, null, 1)); return; }
  const f = (v) => (v === undefined ? '-' : v.toFixed(0).padStart(6));
  console.log(`Median of ${runs} runs after a warm-up, ms; the 0.5 s line covers the main thread's stages (VB-199, VB-226).`);
  for (const where of ['node', 'chromium']) for (const n of names) {
    const r = res[where][n];
    console.log(`${where.padEnd(8)} ${n.padEnd(10)}${stale[n] ? ' (stale fixture)' : ''}  JSON ${r.jsonMB.toFixed(1)} MB, gzip ${r.gzipMB.toFixed(2)} MB`);
    console.log('  save: ' + ['encode', 'stringify', 'gzip', 'idbWrite'].map((k) => `${k} ${f(r[k])}`).join(' | '));
    console.log('  load: ' + ['idbRead', 'gunzip', 'parse', 'decode'].map((k) => `${k} ${f(r[k])}`).join(' | '));
  }
})().catch((e) => { console.error(e.stack || e); process.exit(1); });
