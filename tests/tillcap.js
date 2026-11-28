// @suite integration
// Hoeing and sowing only what the hands can till (VB-1186): a household whose plan says its hands can till 2 fields hoes the first 2 of
// its stubble fields in the window and leaves the rest; with 1 already sown, it hoes 1; it sows a hoed field only under the same count.
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim, { CROPS } = VB['sim/crops'];
const { targets: TG } = require('./lib/season.js');
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('TILLCAP FAIL:', m); } };
const it = G.generate(7); let r; while (!(r = it.next()).done);
const st = Sim.seed(r.value, 7, 'heirs'), hh = st.households[0], f = st.farmsteads[hh.farmstead];
const plan = st.plans.households.get(hh.id), c = { season: 0, sday: 2 };
for (const fd of f.fields) { fd.crop = 'barley'; fd.stage = 'stubble'; fd.sown = null; }
while (f.fields.length < 4) f.fields.push({ ...f.fields[0], id: f.fields.length + 100 });
TG(plan).workable = 2;
const posted = (kind) => { const out = []; for (const fd of f.fields) Sim.KINDS[kind].available(st, hh, fd, c, (k) => out.push(k), f); return out; };
check(posted('plow').length === 2, `with 2 workable and 4 fields in stubble, ${posted('plow').length} hoed, wanted 2`);
f.fields[3].stage = 'sown';
check(posted('plow').length === 1, `with one field sown, ${posted('plow').length} hoed, wanted 1`);
for (const fd of f.fields.slice(0, 3)) fd.stage = 'plowed';
const Stores = VB['sim/stores'];
Stores.put(st, hh, Stores.grainGood('barley'), 10 * CROPS.barley.seed, 'harvest');
check(posted('sow').length === 1, `with one field sown, 3 hoed and 2 workable, ${posted('sow').length} sown, wanted 1`);
TG(plan).workable = 0;
f.fields[3].stage = 'stubble';
for (const fd of f.fields) fd.stage = 'stubble';
check(posted('plow').length === 1, `with no hands a household still hoes 1 field, as it wants 1 (fieldsWanted); got ${posted('plow').length}`);
console.log('tillcap ok');
if (failed) process.exit(1);
