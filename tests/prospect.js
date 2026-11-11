// Finding ores (VB-358, sim/prospect): every deposit tile is of a vein; the land within reach of a hidden vein names it; what shows at
// the surface is known to all and an upland ore to none at the start; work near a vein finds it for the pawn's village only, once, with
// an event on the record; work elsewhere finds nothing; the finds survive a save.
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim, Geo = VB['gen/geology'], P = VB['sim/prospect'], { bfs } = VB['sim/hex'];
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('PROSPECT FAIL:', m); } };
const it = G.generate(42, { cols: 180, rows: 130 }); let r; while (!(r = it.next()).done);
const w = r.value, hidden = (i) => !!Geo.DEPOSITS[w.deposit[i]].hidden;
let ore = -1, clay = -1, far = -1;
for (let i = 0; i < w.N; i++) {
  check(!!w.deposit[i] === !!w.vein[i], `tile ${i}: deposit ${w.deposit[i]} but vein ${w.vein[i]}`);
  if (w.vein[i]) check(w.veinKind[w.vein[i]] === w.deposit[i], `tile ${i}: vein ${w.vein[i]} is of kind ${w.veinKind[w.vein[i]]}, the tile ${w.deposit[i]}`);
  if (w.deposit[i] && hidden(i)) { check(w.veinNear[i] === w.vein[i], `ore tile ${i} is not near its own vein`); if (ore < 0) ore = i; }
  if (w.deposit[i] === Geo.DEPOSIT.CLAY && clay < 0) clay = i;
  if (w.veinNear[i]) check(!w.water[i] && Geo.DEPOSITS[w.veinKind[w.veinNear[i]]].hidden, `tile ${i} is near vein ${w.veinNear[i]}, not a hidden one on land`);
  else if (!w.water[i] && far < 0) far = i;
}
check(ore >= 0 && clay >= 0 && far >= 0, 'the test map has an ore, clay and land far from every vein');
// every tile near a vein is within reach of one of its tiles
const vein = w.vein[ore], near = []; for (let i = 0; i < w.N; i++) if (w.veinNear[i] === vein) near.push(i);
const reach = new Set(); for (let i = 0; i < w.N; i++) if (w.vein[i] === vein) for (const t of bfs(w, i, Geo.FIND.reach, () => true).dist.keys()) reach.add(t);
check(near.length > 1 && near.every((t) => reach.has(t)), `vein ${vein}: a tile near it is beyond ${Geo.FIND.reach} steps`);

const st = Sim.seed(w, 42, 'populous');
const pawnOf = (v) => st.pawns.find((p) => p.alive && p.household !== null && st.farmsteads[st.households[p.household].farmstead].village === v);
check(st.villages.length >= 2, 'two villages to tell apart');
const a = pawnOf(0), b = pawnOf(1), beside = near.find((t) => t !== ore && !w.vein[t]);
check(P.knows(st, 0, clay) && P.known(st, clay), 'clay is known to all');
check(!P.knows(st, 0, ore) && !P.known(st, ore), 'no village knows an upland ore at the start');
const events = () => st.record.filter((e) => e.kind === 'oreFound');
st.rng.prospect.fix = 0.999; P.worked(st, a.id, beside, 8);
check(!P.knows(st, 0, ore), 'an unlucky day finds nothing');
st.rng.prospect.fix = 0; P.worked(st, a.id, far, 8);
check(!P.knows(st, 0, ore) && !events().length, 'work far from every vein finds nothing');
P.worked(st, a.id, beside, 8);
check(P.knows(st, 0, ore) && P.known(st, ore) && !P.knows(st, 1, ore), 'the vein is found for the village of the pawn, and for no other');
for (let i = 0; i < w.N; i++) if (w.vein[i] === vein) check(P.knows(st, 0, i), `tile ${i} of the found vein is not known`);
const ev = events();
check(ev.length === 1 && ev[0].pawn === a.id && ev[0].village === 0 && /knows of it now/.test(ev[0].text), 'one event on the record names the finder and the village');
P.worked(st, a.id, beside, 8);
check(events().length === 1 && st.finds.get(0).length === 1, 'a vein is found once');
P.worked(st, b.id, beside, 8);
check(P.knows(st, 1, ore) && events().length === 2, 'another village finds it for itself');
delete st.rng.prospect.fix;
const it2 = G.generate(42, { cols: 180, rows: 130 }); while (!(r = it2.next()).done);
const back = Sim.load(r.value, JSON.parse(JSON.stringify(Sim.save(st))));
check(JSON.stringify([...back.finds]) === JSON.stringify([...st.finds]) && P.knows(back, 0, ore), 'the finds survive a save');
if (failed) process.exit(1);
console.log('prospect ok');
