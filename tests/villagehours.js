// VB-286: the walking hours between villages (sim/routes): the table agrees with the route search, is read by hoursBetween, is refreshed a
// village a step on autumn day 9 from noon (calendar), grows with a village founded, and is built for a save that lacks it.
const assert = require('assert'), VB = require('../src/load.js'), Sim = VB.sim;
const { tinyWorld, tinyState } = require('./lib/tiny.js'), { checkState } = require('./lib/invariants.js'), agree = require('./lib/reach.js');
const { reachCosts, hoursBetween, refreshHoursStep, villageAdded, ROW_STEPS } = VB['sim/routes'], { ROUTE, SPEED, TICKS } = VB['sim/rules'];
const fresh = (st) => {
  const c = st.villages.map((v) => v.center);
  return st.villages.map((v) => reachCosts(st.w, v.center, ROUTE.reach, c).map((x, u) => x === null ? null : x / SPEED)); };

// the costs of a search from each end differ in the last digits (the sums run in another order); the table writes each pair once
const close = (a, b, m) => {
  assert.strictEqual(a.length, b.length, m);
  a.forEach((x, i) => (Array.isArray(x) ? close(x, b[i], m) : assert(x === b[i] || Math.abs(x - b[i]) < 1e-9, `${m}: ${x} against ${b[i]}`))); };

// four villages on one island, a fifth across the sea
const rows = Array.from({ length: 24 }, () => '.'.repeat(30) + '~' + '.'.repeat(19));
const world = () => tinyWorld(rows);
const w = world(), at = (c, r) => r * w.COLS + c;
const st = tinyState(w,
  [{ at: [6, 5], farms: 2 }, { at: [20, 5], farms: 2 }, { at: [6, 17], farms: 2 }, { at: [20, 17], farms: 2 }, { at: [40, 10], farms: 2 }], { seed: 7 });
assert.deepStrictEqual(checkState(st), [], 'a seeded table passes the invariants');
assert.strictEqual(st.villageHours.length, 5);
assert.strictEqual(hoursBetween(st, 1, 1), 0);
assert.strictEqual(hoursBetween(st, 0, 4), Infinity, 'no route across the sea');
assert(hoursBetween(st, 0, 1) > 0 && hoursBetween(st, 0, 1) === hoursBetween(st, 1, 0) && hoursBetween(st, 0, 1) < 67);
const nobody = (f) => { const was = VB.count.reachSettled; f(); return VB.count.reachSettled === was; };
assert(nobody(() => hoursBetween(st, 2, 3)), 'reading the table searches nothing');
assert.deepStrictEqual(agree(VB, st, 'tiny'), { pairs: 10, routed: 6 });
close(st.villageHours, fresh(st), 'built from the greens');

// worn paths between the south pair change what a search finds; the table follows by a row a step from noon of autumn day 9
if (!w.dev) w.dev = new Uint8Array(w.N);
if (!w.worn) w.worn = new Uint8Array(w.N);
for (let c = 8; c < 19; c++) if (!w.dev[at(c, 17)]) w.worn[at(c, 17)] = 3;
const was = JSON.stringify(st.villageHours), noon = (2 * VB['sim/rules'].SEASON_DAYS + 8) * 24 + 12;
Sim.advance(st, noon - st.t - 0.1);
assert.strictEqual(JSON.stringify(st.villageHours), was, 'until noon the table stands (a year of walking has not moved it)');
const want = fresh(st); // the costs of the day: the path, and whatever the year wore or faded
assert.notStrictEqual(JSON.stringify(want), was, 'the worn path changes the hours');
Sim.advance(st, 0.1); // step 0 of the 60: village 0
close(st.villageHours[0], want[0], 'village 0 is fresh');
assert.notStrictEqual(st.villageHours[2][3], want[2][3], 'and the south pair is not yet');
Sim.advance(st, 0.1); // village 1
Sim.advance(st, 0.1); // village 2: its row and column
close(st.villageHours[2], want[2], 'village 2');
close([st.villageHours[3][2]], [want[3][2]], 'its column too');
const midway = JSON.parse(JSON.stringify(Sim.save(st))); // a save between two rows goes on as the unbroken run
Sim.advance(st, 0.1);
close(st.villageHours, want, 'by village 3 the table is fresh');
Sim.advance(st, 6);
close(st.villageHours, want, 'a year on');
const back = Sim.load(world(), midway);
Sim.advance(back, 0.1 + 6);
assert.deepStrictEqual(back.villageHours, st.villageHours, 'the save between rows goes on as the unbroken run');
assert.deepStrictEqual(checkState(st).filter((m) => m.startsWith('villageHours')), [], 'the table passes its invariants after a year');

// a save without the table (all saves before VB-286) has it built at the load
const old = JSON.parse(JSON.stringify(Sim.save(st)));
delete old.state.villageHours;
close(Sim.load(world(), old).villageHours, fresh(st), 'built at a load of an older save');

// a village added: a row and a column, found at once
{
  const s = tinyState(world(), [{ at: [6, 5], farms: 2 }, { at: [20, 5], farms: 2 }], { seed: 7 });
  s.villages.push({ center: at(12, 12) }); villageAdded(s);
  assert.strictEqual(s.villageHours.length, 3);
  close(s.villageHours, fresh(s), 'a village added');
  assert(s.villageHours.every((r) => r.length === 3) && hoursBetween(s, 2, 0) === hoursBetween(s, 0, 2));
}

// more than 60 villages: village k on step floor(k * 60 / villages), each row once
{
  const big = tinyWorld(Array.from({ length: 40 }, () => '.'.repeat(90))), V = 70;
  const s = { w: big, villages: Array.from({ length: V }, (_, k) => ({ center: (5 + 2 * ((k / 10) | 0)) * 90 + 5 + 8 * (k % 10) })) };
  s.villageHours = Array.from({ length: V }, (_, k) => Array.from({ length: V }, (_, u) => u === k ? -1 : null));
  const done = new Set();
  for (let j = 0; j < ROW_STEPS; j++) {
    refreshHoursStep(s, j);
    for (let k = 0; k < V; k++) if (s.villageHours[k][k] === 0 && !done.has(k)) {
      done.add(k); assert.strictEqual(Math.floor(k * ROW_STEPS / V), j, `village ${k} on step ${j}`); }
  }
  assert.strictEqual(done.size, V, 'every row once a year');
  close(s.villageHours, fresh(s), '70 villages');
}
console.log(`village hours ok: ${st.villages.length} villages; agreement with the route search, a row a step from noon of autumn day 9 (${TICKS} steps an hour), a save between rows, an older save, a village added, 70 villages in 60 steps`);
