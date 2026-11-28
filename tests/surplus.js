// @suite integration
// Surplus dung goes to tilth (VB-718): with no field wanting dung for its soil, the heap's loads go to the unsown field of least tilth,
// up to TILTH.surplus loads a field-year, after the loads to the cap; a sown field takes none; the count is read as 0 in another year.
const VB = require('../src/load.js'), F = VB['sim/fields'], { scenario } = require('./lib/probe.js');
const { YEAR } = VB['sim/rules'], { SOIL } = VB['sim/crops'], { TILTH } = VB['sim/soil'];
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('SURPLUS FAIL:', m); } };
const cal = (doy) => ({ doy, day: doy, season: Math.floor(doy / 12), sday: doy % 12, hour: 8 });
const st = scenario('populous', 7);
const f = st.farmsteads.find((q) => q.household !== null && q.fields.length >= 3);
const hh = st.households[f.household];
f.fields.length = 3;
const [a, b, c] = f.fields;
const set = (tilths) => { f.fields.forEach((fd, k) => { fd.stage = 'stubble'; fd.soil = SOIL.cap; fd.tilth = tilths[k]; fd.tilthAt = st.t; delete fd.surplus; delete fd.surplusYear; }); };
const spread = (heap) => { // what the head's jobs would do: post, carry, repeat
  hh.manure = heap; const order = [];
  for (let n = 0; n < 20; n++) { const w = VB['sim/soil'].manureWanted(st, f, hh, cal(2)); if (!w) break; order.push([w[0].id, w[1]]); VB['sim/soil'].manureDone(st, w[0], hh, w[1]); }
  return order;
};
st.t = 5 * YEAR + 100;
set([0.02, 0.05, 0]);
let o = spread(5);
check(JSON.stringify(o) === JSON.stringify([[c.id, 2], [a.id, 2], [b.id, 1]]), `5 loads: ${JSON.stringify(o)}`);
set([0.02, 0.05, 0]);
o = spread(10);
check(o.length === 3 && Math.abs(hh.manure - 4) < 1e-9, `10 loads: ${JSON.stringify(o)}, ${hh.manure} left`);
check(o.every((x) => x[1] <= TILTH.surplus), 'a field took more than TILTH.surplus');
set([0.02, 0.05, 0]); b.soil = 1.0; hh.manure = 5;
let w = VB['sim/soil'].manureWanted(st, f, hh, cal(2));
check(w && w[0] === b && !w[2], 'a field below the cap is served first, for its soil');
set([0.02, 0.05, 0]); a.stage = 'sown'; c.stage = 'sown'; hh.manure = 5;
w = VB['sim/soil'].manureWanted(st, f, hh, cal(2));
check(w && w[0] === b && w[1] === 2, 'a sown field takes none');
set([0, 0, 0]); spread(10); st.t += YEAR;
check(VB['sim/soil'].surplusOf(st, a) === 0, 'the count is read as 0 next year');
hh.manure = 10; w = VB['sim/soil'].manureWanted(st, f, hh, cal(2));
check(w && w[1] === 2, 'next spring each may take 2 again');
if (failed) process.exit(1); console.log('surplus ok');
