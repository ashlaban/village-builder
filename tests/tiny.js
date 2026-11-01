// The tiny-world kit (VB-155, tests/lib/tiny.js): a text map lays its tiles as the generator does, and a state of two villages seeds fast and runs.
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim;
const { tinyWorld, tinyState, tileAt } = require('./lib/tiny.js');
const { checkState } = require('./lib/invariants.js');
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('TINY FAIL:', m); } };

// neighbours as the generator lays them, on an odd and an even row
const it = G.generate(3, { cols: 12, rows: 10 }); let r; while (!(r = it.next()).done);
const gw = r.value, tw = tinyWorld(Array.from({ length: 10 }, () => '.'.repeat(12)));
for (const [col, row] of [[4, 3], [4, 4], [0, 0], [11, 9]]) {
  const i = tileAt(tw, col, row);
  for (let d = 0; d < 6; d++) check(tw.nb[i * 6 + d] === gw.nb[i * 6 + d], `neighbour ${d} of ${col}, ${row}: ${tw.nb[i * 6 + d]} against ${gw.nb[i * 6 + d]}`);
  check(Math.abs(tw.hx[i] - gw.hx[i]) < 1e-3 && Math.abs(tw.hy[i] - gw.hy[i]) < 1e-3, `position of ${col}, ${row}`);
}
check(tinyWorld(['.F~', 'hmP'], { stones: 90 }).stones[0] === 90 && tinyWorld(['.F~', 'hmP']).water[2] === 1, 'tiles from characters');

// two villages on a 14 by 10 map: seeded in well under 100 ms, a day advances, the state holds its invariants
const map = [
  '..............',
  '...FF.........',
  '...FF.........',
  '..............',
  '..........FF..',
  '..............',
  '.........^^...',
  '..............',
  '~.............',
  '~~............',
];
const t0 = Date.now(), w = tinyWorld(map), st = tinyState(w, [{ at: [3, 5], farms: 2 }, { at: [11, 2], farms: 1 }], { seed: 7, customs: { dispute: 'kin' } });
const ms = Date.now() - t0;
check(ms < 500, `seeding took ${ms} ms`); // about 15 ms alone; the suite runs scripts in parallel
check(st.villages.length === 2 && st.farmsteads.length === 3 && st.households.length === 3, `villages ${st.villages.length}, farms ${st.farmsteads.length}`);
check(st.villages[0].center === tileAt(w, 3, 5), 'the first village stands where it was put');
check(Sim.practice(st, 1).dispute === 'kin', 'customs set in every village');
Sim.advance(st, Sim.DAY);
const bad = checkState(st);
check(!bad.length, `invariants: ${bad.slice(0, 3).join('; ')}`);
if (failed) process.exit(1);
console.log(`tiny ok: two villages on a 14 x 10 map seeded in ${ms} ms, ${st.pawns.length} people`);
