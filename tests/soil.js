// Manure and the soil (VB-137): a reaped crop yields in proportion to the field's soil and wears it by 0.08 to 0.75; fodder collects manure
// (0.2 loads a head of cattle, 0.04 a sheep, each stall day); in spring days 1-6 the heap is carted to the poorest field not yet sown, a load
// raising its soil by 0.04 to 1.15. On the small islands of tests/lib/probe.js (VB-855): the rules on populous at seed 7, and founders' first
// spring carting in a run. With --extended (at night), founders at seed 7 on the small map, 10 years: farms that winter cattle keep their
// soil, the farm without declines (a balance of a decade's crops and dung, which a small state cannot show).
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim, { scenario } = require('./lib/probe.js'), H = VB['sim/herds'], Y = VB['sim/byre'], F = VB['sim/fields'];
const { CROPS } = VB['sim/rules'];
const { checkState } = require('./lib/invariants.js');
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('SOIL FAIL:', m); } };
const world = (seed, size = [120, 85]) => { const it = G.generate(seed, { cols: size[0], rows: size[1] }); let r; while (!(r = it.next()).done); return r.value; };
const cal = (doy, hour = 8) => ({ doy, day: doy, season: Math.floor(doy / 12), sday: doy % 12, hour });
const S = Sim.SOIL, near = (a, b) => Math.abs(a - b) < 1e-9;

// --- every field starts at 1; the crop yields by its soil and wears it, not below the floor
let st = scenario('populous', 7);
check(st.farmsteads.every((f) => f.fields.every((fd) => fd.soil === S.start)), 'a field does not start at soil 1');
const f0 = st.farmsteads.find((f) => f.household !== null && f.fields.length >= 3 && H.herdOf(st, st.households[f.household], 'cattle'));
const hh0 = st.households[f0.household], fd = f0.fields[0], reap = Sim.KINDS.reap.done;
const ratios = [];
for (const soil of [1, 0.8, 0.76]) {
  fd.soil = soil; fd.weedMiss = 0; reap(st, { field: fd }, hh0, cal(30));
  ratios.push(fd.held / (CROPS.barley.yield * fd.fert * soil * st.weather));
  check(near(fd.soil, Math.max(S.floor, soil - CROPS.barley.wear)), `soil ${soil} after a crop: ${fd.soil}`);
}
check(ratios.every((x) => x > 0.88 && x < 1.12), `yield not in proportion to the soil: ${ratios.map((x) => x.toFixed(2))}`);

// --- fodder puts the day's dung on the heap
const animals = H.herdsOf(st, hh0), cattle = animals.filter((h) => h.species === 'cattle').reduce((s, h) => s + h.head.length, 0);
const sheep = animals.filter((h) => h.species === 'sheep').reduce((s, h) => s + h.ewes + h.rams + h.lambs, 0);
hh0.manure = 0; Y.fodderDone(st, hh0, cal(40));
check(near(hh0.manure, S.cattle * cattle + S.sheep * sheep), `fodder: ${hh0.manure} loads for ${cattle} cattle and ${sheep} sheep`);
check(hh0.fodderDay === 40, 'fodder does not mark the day');

// --- carting: spring days 1-6 only, a load or more on the heap, the poorest field not yet sown; a load raises it 0.04 to the cap
for (const [k, q] of f0.fields.entries()) { q.stage = 'stubble'; q.soil = [0.9, 0.8, 1.1][k] ?? 1.1; }
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

// --- founders seed 7, a year on: the heap of a farm that wintered animals is carted onto its fields in spring days 1-6, the poorest first
st = scenario('founders', 7);
Sim.advance(st, Sim.YEAR);
// the carting test is of barley land in stubble (the scenarios' crops, VB-353, give fields other courses): every field is made so
for (const f of st.farmsteads) for (const [k, q] of f.fields.entries()) Object.assign(q, { crop: 'barley', rotation: 'every', step: 0, stage: 'stubble', soil: S.start - 0.1 * (k % 3) - 0.01 * k }); // below the cap, the poorest apart
const heaps = st.farmsteads.filter((f) => f.household !== null).map((f) => ({ f, h: st.households[f.household], heap: st.households[f.household].manure,
  soils: f.fields.map((q) => q.soil) }));
Sim.advance(st, (S.window[1] + 1) * Sim.DAY);
const fed = heaps.filter((x) => x.heap >= 2), bare = heaps.filter((x) => !(x.heap > 0));
check(fed.length >= 2 && bare.length >= 1, `founders: ${fed.length} farms with a heap, ${bare.length} without`);
for (const x of fed) {
  const up = x.f.fields.map((q, k) => q.soil - x.soils[k]);
  check(x.h.manure < x.heap && up.some((d) => d > 1e-9), `${x.f.name}: heap ${x.heap.toFixed(1)} -> ${x.h.manure.toFixed(1)}, soil rose ${up.map((d) => d.toFixed(2))}`);
  const poorest = x.soils.indexOf(Math.min(...x.soils));
  // the poorest field not yet sown when the carting began: with five or six fields some are sown first (VB-353), so no manured field is
  // richer than an unsown one left bare
  const bareOpen = x.f.fields.filter((q, k) => up[k] <= 1e-9 && (q.stage === 'stubble' || q.stage === 'plowed'));
  check(up[poorest] > 1e-9 || bareOpen.every((q) => x.soils.every((v, k) => up[k] <= 1e-9 || v <= x.soils[q.id] + 1e-9)), `${x.f.name}: the poorest field not manured`);
}
for (const x of bare) check(x.f.fields.every((q, k) => k >= x.soils.length || q.soil === x.soils[k]), `${x.f.name}: no heap, yet its soil rose`);
{ const bad = checkState(st); check(!bad.length, 'founders after the carting: ' + bad.slice(0, 3).join('; ')); }
console.log(`soil ok: founders 7, spring of year 2: ${fed.map((x) => `${x.f.name} heap ${x.heap.toFixed(1)} -> ${x.h.manure.toFixed(1)}`).join('; ')}`);

// --- at night: founders seed 7 (small map), 10 years: the soil of farms with and without cattle
if (process.argv.includes('--extended')) {
  st = Sim.seed(world(7, [180, 130]), 7, 'founders');
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
  console.log(`soil ok (extended): founders 7 after 10 years: ${rows.map((r) => `${r.name} ${r.cattle} cattle, ${r.fields} fields, soil ${r.soil.toFixed(2)}`).join('; ')}`);
}
if (failed) process.exit(1);
