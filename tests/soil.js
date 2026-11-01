// Manure and the soil (VB-137): a reaped crop yields in proportion to the field's soil and wears it by 0.08 to 0.75; fodder collects manure
// (0.2 loads a head of cattle, 0.04 a sheep, each stall day); in spring days 1-6 the heap is carted to the poorest field not yet sown, a load
// raising its soil by 0.04 to 1.15. Founders at seed 7, 10 years: farms that winter cattle keep their soil, the farm without declines.
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim, H = VB['sim/herds'], Y = VB['sim/byre'], F = VB['sim/fields'];
const { checkState } = require('./lib/invariants.js');
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('SOIL FAIL:', m); } };
const world = (seed, size = [120, 85]) => { const it = G.generate(seed, { cols: size[0], rows: size[1] }); let r; while (!(r = it.next()).done); return r.value; };
const cal = (doy, hour = 8) => ({ doy, day: doy, season: Math.floor(doy / 12), sday: doy % 12, hour });
const S = Sim.SOIL, near = (a, b) => Math.abs(a - b) < 1e-9;

// --- every field starts at 1; the crop yields by its soil and wears it, not below the floor
let st = Sim.seed(world(7), 7, 'populous');
check(st.farmsteads.every((f) => f.fields.every((fd) => fd.soil === S.start)), 'a field does not start at soil 1');
const f0 = st.farmsteads.find((f) => f.household !== null && f.fields.length >= 3 && H.herdOf(st, st.households[f.household], 'cattle'));
const hh0 = st.households[f0.household], fd = f0.fields[0], reap = Sim.KINDS.reap.done;
const ratios = [];
for (const soil of [1, 0.8, 0.76]) {
  fd.soil = soil; fd.weedMiss = 0; reap(st, { field: fd }, hh0, cal(30));
  ratios.push(fd.held / (st.ECON.fieldYield * fd.fert * soil * st.weather));
  check(near(fd.soil, Math.max(S.floor, soil - S.wear)), `soil ${soil} after a crop: ${fd.soil}`);
}
check(ratios.every((x) => x > 0.88 && x < 1.12), `yield not in proportion to the soil: ${ratios.map((x) => x.toFixed(2))}`);

// --- fodder puts the day's dung on the heap
const animals = H.herdsOf(st, hh0), cattle = animals.filter((h) => h.species === 'cattle').reduce((s, h) => s + h.head.length, 0);
const sheep = animals.filter((h) => h.species === 'sheep').reduce((s, h) => s + h.ewes + h.rams + h.lambs, 0);
hh0.manure = 0; Y.fodderDone(st, hh0, cal(40));
check(near(hh0.manure, S.cattle * cattle + S.sheep * sheep), `fodder: ${hh0.manure} loads for ${cattle} cattle and ${sheep} sheep`);
check(hh0.fodderDay === 40, 'fodder does not mark the day');

// --- carting: spring days 1-6 only, a load or more on the heap, the poorest field not yet sown; a load raises it 0.04 to the cap
for (const [k, q] of f0.fields.entries()) { q.stage = 'stubble'; q.soil = [0.9, 0.8, 1.1][k] ?? 1; }
hh0.manure = 3;
const w = F.manureWanted(f0, hh0, cal(2));
check(w && w[0] === f0.fields[1] && near(w[1], 3), `carting: wanted ${w && w[0].id}, ${w && w[1]} loads; wanted field 1, 3 loads`);
check(!F.manureWanted(f0, hh0, cal(S.window[1] + 1)) && !F.manureWanted(f0, hh0, cal(20)), 'carting outside spring days 1-6');
f0.fields[1].stage = 'sown';
check(F.manureWanted(f0, hh0, cal(2))[0] === f0.fields[0], 'carting to a sown field');
hh0.manure = 0.5; check(!F.manureWanted(f0, hh0, cal(2)), 'carting with less than a load on the heap');
hh0.manure = 10; f0.fields[0].soil = 1.1;
check(near(F.manureWanted(f0, hh0, cal(2))[1], (S.cap - 1.1) / S.perLoad), 'carting more than the soil can take');
const toCap = (S.cap - 1.1) / S.perLoad;
F.manureDone(st, f0.fields[0], hh0, toCap);
check(near(f0.fields[0].soil, S.cap) && near(hh0.manure, 10 - toCap), `after ${toCap} loads: soil ${f0.fields[0].soil}, heap ${hh0.manure}`);
F.manureDone(st, f0.fields[2], hh0, 100);
check(near(hh0.manure, 0) && f0.fields[2].soil <= S.cap + 1e-9, 'spreading more than the heap holds');

// --- founders seed 7 (small map), 10 years: the soil of farms with and without cattle
st = Sim.seed(world(7, [180, 130]), 7, 'founders');
const carted = new Map();
for (let y = 0; y < 10; y++) {
  Sim.advance(st, Sim.YEAR);
  const bad = checkState(st); if (bad.length) { check(false, `year ${y + 1}: ${bad.slice(0, 3).join('; ')}`); break; }
}
const rows = st.farmsteads.filter((f) => f.household !== null).map((f) => {
  const h = st.households[f.household], cows = H.herdsOf(st, h).filter((x) => x.species === 'cattle').reduce((s, x) => s + x.head.length, 0);
  const soil = f.fields.reduce((s, q) => s + q.soil, 0) / Math.max(1, f.fields.length);
  return { name: f.name, cattle: cows, fields: f.fields.length, soil };
});
const withC = rows.filter((r) => r.cattle >= 2), without = rows.filter((r) => r.cattle === 0);
check(withC.length && withC.every((r) => r.soil >= 0.95), `a farm with cattle lost its soil: ${JSON.stringify(withC)}`);
check(!without.length || without.every((r) => r.soil < Math.min(...withC.map((r) => r.soil))), `a farm without cattle kept its soil: ${JSON.stringify(rows)}`);
console.log(`soil ok: founders 7 after 10 years: ${rows.map((r) => `${r.name} ${r.cattle} cattle, ${r.fields} fields, soil ${r.soil.toFixed(2)}`).join('; ')}`);
if (failed) process.exit(1);
