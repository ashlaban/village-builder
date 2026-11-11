// Geology (gen/geology): the same on every generation and leaving the rest of the world as it was; bedrock on land only; each deposit
// on a tile that can hold it, with loads left; tin only in granite; no island of the test maps with every kind.
const VB = require('../src/load.js'), G = VB.gen, Geo = VB['gen/geology'], { landComponents } = VB['sim/hex'];
const { ROCK, DEPOSIT, ROCKS, DEPOSITS, ENDLESS, VEINS } = Geo, B = G.B;
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('GEOLOGY FAIL:', m); } };
const world = (seed) => { const it = G.generate(seed, { cols: 180, rows: 130 }); let r; while (!(r = it.next()).done); return r.value; };
const same = (a, b) => Buffer.compare(Buffer.from(a.buffer), Buffer.from(b.buffer)) === 0;
const amount = new Map(VEINS.filter((v) => v.deposit).map((v) => [v.deposit, v.amount]));
const kinds = ROCKS.length - 1 + DEPOSITS.length - 1, differ = [];
let deposits = 0;
for (const seed of [7, 42, 3]) {
  const w = world(seed), again = world(seed);
  for (const k of ['rock', 'deposit', 'depositLeft']) check(same(w[k], again[k]), `seed ${seed}: ${k} differs between generations`);
  const comp = landComponents(w), has = new Map();
  for (let i = 0; i < w.N; i++) {
    const r = w.rock[i], d = w.deposit[i], left = w.depositLeft[i], b = w.biome[i];
    if (w.water[i]) { check(!r && !d && !left, `seed ${seed}: water tile ${i} has rock ${r}, deposit ${d}, ${left} left`); continue; }
    check(r >= 1 && r < ROCKS.length, `seed ${seed}: land tile ${i} has rock ${r}`);
    check(d < DEPOSITS.length, `seed ${seed}: tile ${i} has deposit ${d}`);
    let set = has.get(comp.id[i]); if (!set) has.set(comp.id[i], set = new Set());
    set.add('r' + r);
    if (!d) { check(left === 0, `seed ${seed}: tile ${i} has no deposit but ${left} loads`); continue; }
    deposits++; set.add('d' + d);
    const [lo, hi] = amount.get(d);
    check(left === ENDLESS || (left >= lo && left <= hi), `seed ${seed}: tile ${i} has ${left} loads of ${DEPOSITS[d].key}`);
    check(b !== B.BEACH && b !== B.SNOW, `seed ${seed}: deposit on tile ${i} of biome ${b}`);
    if (d === DEPOSIT.TIN) check(r === ROCK.GRANITE, `seed ${seed}: tin on tile ${i} in rock ${ROCKS[r].key}`);
    if (d === DEPOSIT.CLAY) check(w.hp[i] < 0.4, `seed ${seed}: clay on high tile ${i}`);
    if (d >= DEPOSIT.IRON) check(w.hp[i] > 0.76, `seed ${seed}: ${DEPOSITS[d].key} on low tile ${i}`);
  }
  for (const [c, set] of has) {
    check(set.size < kinds, `seed ${seed}: an island of ${comp.size[c]} tiles has every kind`);
    if (comp.size[c] >= 60) differ.push([...set].sort().join());
  }
}
check(deposits > 50, `only ${deposits} deposit tiles on three maps`);
check(new Set(differ).size > differ.length / 2, `islands too alike: ${new Set(differ).size} sets of kinds on ${differ.length} islands`);
if (failed) process.exit(1);
console.log('geology ok');
