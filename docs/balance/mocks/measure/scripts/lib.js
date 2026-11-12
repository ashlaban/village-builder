// loads a save the way tools/sim.js does
const ROOT = '/home/user/village-builder';
const VB = require(ROOT + '/src/load.js'), G = VB.gen, Sim = VB.sim, fs = require('fs'), zlib = require('zlib');
const SIZES = { tiny: [120, 85], small: [180, 130], medium: [280, 200], large: [380, 270] };
function loadSave(f) {
  const d = JSON.parse((f.endsWith('.gz') ? zlib.gunzipSync(fs.readFileSync(f)) : fs.readFileSync(f)).toString('utf8'));
  const it = G.generate(d.seed, { cols: d.cols, rows: d.rows }); let r; while (!(r = it.next()).done);
  return { st: Sim.load(r.value, d), w: r.value, data: d };
}
module.exports = { VB, Sim, loadSave };
