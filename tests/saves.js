// Saves (VB-074): a run saved, written as JSON text, parsed and loaded into a freshly generated world goes on exactly as the run that was
// never saved: every key of the state (the world aside) has the same canonical text, and the tiles the simulation changes are the same.
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim;
const { canon } = require('./lib/canon.js');
const TILES = ['trees', 'treesMax', 'stones', 'biome', 'dev', 'wear', 'worn', 'tr', 'tg', 'tb'];
const world = (seed, size) => { const it = G.generate(seed, size); let r; while (!(r = it.next()).done); return r.value; };
let failed = 0; const out = [];
// [scenario, seed, map size, hours before the save, hours after]; the last is saved mid-hour, when the idle pawns of the hour were drawn
// earlier in it (st.idlers). Both runs make the same advance calls after the save: steps of 6 minutes add up differently in other chunks.
const Y = Sim.YEAR, TINY = { cols: 120, rows: 85 };
for (const [scenario, seed, size, before, after] of [['founders', 7, null, 2 * Y, Y], ['founders', 42, null, 2 * Y, Y], ['heirs', 7, null, 2 * Y, Y],
  ['heirs', 42, null, 2 * Y, Y], ['populous', 7, TINY, Y, Y], ['populous', 7, TINY, 3000.75, 30 * Sim.DAY]]) {
  const st = Sim.seed(world(seed, size || undefined), seed, scenario);
  Sim.advance(st, before);
  const text = JSON.stringify(Sim.save(st));
  Sim.advance(st, after); // the run that was never saved
  const data = JSON.parse(text), w2 = world(data.seed, { cols: data.cols, rows: data.rows }), back = Sim.load(w2, data);
  Sim.advance(back, after);
  const bad = [];
  for (const k of new Set([...Object.keys(st), ...Object.keys(back)])) if (k !== 'w' && canon(st[k]) !== canon(back[k])) bad.push(k);
  for (const k of TILES) if (canon(st.w[k]) !== canon(back.w[k])) bad.push('w.' + k);
  const label = `${scenario} ${seed} at ${(before / Y).toFixed(2)} y`;
  if (bad.length) { failed++; console.error(`SAVES FAIL: ${label}, saved at t=${before} h, ${after} h more: ${bad.join(', ')} differ`); }
  out.push(`${label} ${(text.length / 1024).toFixed(0)} KB`);
}
if (failed) process.exit(1);
console.log(`saves ok: saved, loaded into a new world and advanced, each run matches the unbroken one (${out.join(', ')})`);
