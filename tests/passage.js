// VB-816: passage on foot. A field in crop is closed to routes through it (sim/passage, sim/walking tileCost), its holder's too, but along
// a path or a lane; it opens at its reaping; a field whose closing would cut a house off stays open; a meadow in grass is closed where the
// custom `passage` is `ways`, and open where it is `free`. On a small constructed state (tests/lib/tiny.js).
const VB = require('../src/load.js');
const { tinyWorld, tinyState } = require('./lib/tiny.js');
const { findRoute } = VB['sim/routes'],
  { through, passable } = VB['sim/walking'],
  { passageDay } = VB['sim/passage'],
  { cal } = VB['sim/rules'];
let failed = 0;
const check = (ok, m) => {
  if (!ok) {
    failed++;
    console.error('PASSAGE FAIL:', m);
  }
};
const map = Array.from({ length: 12 }, () => '.'.repeat(16));
const make = (customs = {}) => {
  const w = tinyWorld(map),
    st = tinyState(w, [{ at: [7, 6], farms: 2 }], { seed: 7, customs });
  return { w, st };
};
const sweep = (st) => passageDay(st, cal(st.t));
// Two open tiles on either side of field tile F (neighbours d and d + 3), neither developed, and F a field of farm f.
function across(w, st) {
  for (const f of st.farmsteads)
    for (const fd of f.fields) {
      const F = fd.tile;
      for (let d = 0; d < 3; d++) {
        const a = w.nb[F * 6 + d],
          b = w.nb[F * 6 + d + 3];
        if (a >= 0 && b >= 0 && !w.dev[a] && !w.dev[b] && through(w, a) && through(w, b)) return { f, fd, F, a, b };
      }
    }
  return null;
}

// a sown field is gone round; along a path it is crossed; reaped, it is crossed
{
  const { w, st } = make(),
    x = across(w, st);
  check(x, 'a field with open ground on two sides');
  if (x) {
    for (const f of st.farmsteads) for (const fd of f.fields) fd.stage = 'stubble';
    w.worn[x.F] = 0;
    sweep(st);
    const open = findRoute(w, x.a, x.b);
    check(open && open.length === 3 && open[1] === x.F, `in stubble the way crosses the field: ${open}`);
    x.fd.stage = 'sown';
    sweep(st);
    check(w.shut[x.F] === 1, `sown, the field is closed: ${w.shut[x.F]}`);
    check(!through(w, x.F) && passable(w, x.F), 'a closed field is not crossed, but stood on');
    const round = findRoute(w, x.a, x.b);
    check(round && !round.includes(x.F) && round.length > 3, `sown, the way goes round it: ${round}`);
    const home = findRoute(w, st.farmsteads[x.f.id].house, x.F);
    check(home && home[home.length - 1] === x.F, 'a route still ends on the closed field (its holder works it)');
    w.worn[x.F] = 2; // a path over it: the way between the strips
    const along = findRoute(w, x.a, x.b);
    check(along && along[1] === x.F, `along a path the field is crossed in crop: ${along}`);
    w.worn[x.F] = 0;
    x.fd.stage = 'stooks';
    sweep(st);
    check(w.shut[x.F] === 0, 'reaped, the field is open');
    const after = findRoute(w, x.a, x.b);
    check(after && after[1] === x.F, `reaped, the way crosses it again: ${after}`);
  }
}

// a field that is a house's only way out stays open in crop
{
  const { w, st } = make(),
    f = st.farmsteads[0],
    H = f.house,
    fd = f.fields[0];
  let k = -1;
  for (let d = 0; d < 6; d++) if (w.nb[H * 6 + d] >= 0 && k < 0) k = d;
  const F = w.nb[H * 6 + k];
  for (let d = 0; d < 6; d++) {
    const j = w.nb[H * 6 + d];
    if (j >= 0 && j !== F) {
      w.water[j] = 1;
      w.dev[j] = 0;
    }
  }
  fd.tile = F;
  w.dev[F] = 1;
  for (const g of st.farmsteads) for (const q of g.fields) if (q !== fd) q.stage = 'stubble';
  fd.stage = 'sown';
  sweep(st);
  check(w.shut[F] === 2, `the house's only way out stays open in crop: ${w.shut[F]}`);
  check(through(w, F), 'and it is crossed');
}

// a meadow in grass: crossed where passage is free, closed where it is `ways`
for (const [rule, want] of [
  ['free', 0],
  ['ways', 1],
]) {
  const { w, st } = make({ passage: rule }),
    f = st.farmsteads[0];
  for (const g of st.farmsteads) for (const q of g.fields) q.stage = 'stubble';
  if (!f.meadows.length) {
    // the tiny farms are laid with fields only: a meadow on open ground two steps from the house
    let t = -1;
    for (let d = 0; d < 6 && t < 0; d++) {
      const j = w.nb[f.house * 6 + d],
        k = j >= 0 ? w.nb[j * 6 + d] : -1;
      if (k >= 0 && !w.dev[k] && through(w, k)) t = k;
    }
    w.dev[t] = 1;
    f.meadows.push({ id: 0, tile: t, stage: 'grass', fert: 1, held: 0, mown: null, raked: false });
  }
  const m = f.meadows[0];
  m.stage = 'grass';
  sweep(st);
  check((w.shut[m.tile] === 1) === (want === 1), `passage ${rule}: a meadow in grass is ${want ? 'closed' : 'open'}: ${w.shut[m.tile]}`);
  m.stage = 'mown';
  sweep(st);
  check(w.shut[m.tile] === 0, `passage ${rule}: a mown meadow is open`);
}

if (failed) {
  console.error(`passage: ${failed} failed`);
  process.exit(1);
}
console.log('passage ok');
