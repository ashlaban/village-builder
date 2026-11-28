// @suite fast
// Shoes come only from a hide or with their wearers (VB-1620, sim/leather carry): a household formed after the start has none, or the pairs
// its members bring; a dissolved household's pairs go with its people; the households placed at the start keep their start.
const VB = require('../src/load.js'), H = VB['sim/heirs'], M = VB['sim/membership'], L = VB['sim/leather'];
const { tinyWorld, tinyState } = require('./lib/tiny.js');
const { checkState } = require('./lib/invariants.js');
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('SHOES FAIL:', m); } };
const near = (a, b) => Math.abs(a - b) < 1e-9;
const scene = (farms = 2) => tinyState(tinyWorld(Array.from({ length: 10 }, () => '.'.repeat(20))), [{ at: [8, 5], farms, sizes: Array(farms).fill(8) }], { seed: 3 });
// three farms, the last one emptied by hand (its people to the others), to found a household on
const withEmpty = () => { const st = scene(3); H.extinct(st, st.households[2]); return st; };
const total = (st) => st.households.reduce((n, h) => n + L.shoesOf(h), 0);

// the start: placed households are shod as placed, on their first day's wear
{
  const st = scene(), hh = st.households[0], n = L.walkers(st, hh);
  check(hh.shoes === undefined, 'a placed household has no count before its first day');
  L.wearDay(st);
  check(n > 0 && near(hh.shoes, n * L.LEATHER.keep - n / L.LEATHER.shoeDays), `a placed household is shod as placed: ${hh.shoes}`);
}
// a household formed after the start brings what its members carry, and no more
{
  const st = withEmpty(), a = st.households[0];
  a.shoes = 4;
  const walkers = L.walkers(st, a), id = a.members.find((m) => st.pawns[m].age >= 18);
  const empty = st.farmsteads.find((f) => f.household === null);
  check(!!empty, 'the scene has an empty farm');
  if (empty) {
    const before = total(st);
    const hh = M.foundHousehold(st, empty, [id], id, { carry: false });
    check(near(total(st), before), `no shoes from nothing: ${total(st)} of ${before}`);
    check(near(hh.shoes, 4 / walkers) && near(a.shoes, 4 - 4 / walkers), `the walker takes their share: ${hh.shoes}, ${a.shoes}`);
    const now = hh.shoes;
    L.wearDay(st);
    check(hh.shoes <= now + 1e-9, 'a new household is not shod up to the target by its first day');
  }
}
// a household formed after the start from people who carry none starts barefoot
{
  const st = withEmpty(), a = st.households[0];
  L.wearDay(st);
  a.shoes = 0;
  const id = a.members.find((m) => st.pawns[m].age >= 18), empty = st.farmsteads.find((f) => f.household === null);
  const hh = M.foundHousehold(st, empty, [id], id, { carry: false });
  L.wearDay(st);
  check(hh.shoes === 0, `barefoot: ${hh.shoes}`);
}
// a dissolved household's pairs go with its people
{
  const st = scene(), a = st.households[0], b = st.households[1];
  L.wearDay(st);
  a.shoes = 5; b.shoes = 1;
  const before = total(st);
  H.extinct(st, a);
  check(a.dissolved && near(L.shoesOf(a), 0), `the dissolved household holds none: ${a.shoes}`);
  check(near(total(st), before), `none leave but by wear: ${total(st)} of ${before}`);
  check(near(b.shoes, 6), `they reach the household its people joined: ${b.shoes}`);
  const bad = checkState(st); check(!bad.length, `invariants: ${bad.slice(0, 2).join('; ')}`);
}
if (failed) process.exit(1);
console.log('shoescarry: ok');
