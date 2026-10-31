// Haymaking (VB-133): populous tiny at seed 7 rakes its meadows in spring and mows and carries at least 90% of them by autumn day 4; the hay
// goes into the household's barn; founders at seed 7 bring in hay in year 1; hay left lying at the frost rots; every spring the meadows are
// grass again. Reports each household's hay against its winter's need.
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim, M = VB['sim/meadows'], { checkState } = require('./lib/invariants.js');
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('HAY FAIL:', m); } };
const world = (seed) => { const it = G.generate(seed, { cols: 120, rows: 85 }); let r; while (!(r = it.next()).done); return r.value; };
const at = (st, doy) => Sim.advance(st, doy * Sim.DAY + 6 - st.t); // to 6:00 on that day of year 1
const meadows = (st) => st.farmsteads.flatMap((f) => f.meadows);

let st = Sim.seed(world(7), 7, 'populous');
const start = new Map(st.households.map((h) => [h.id, h.hay]));
at(st, 11);
const raked = meadows(st).filter((m) => m.raked).length / meadows(st).length;
check(raked >= 0.8, `populous: ${Math.round(raked * 100)}% of meadows raked by spring day 11`);
at(st, 27); // autumn day 4
const done = meadows(st).filter((m) => m.stage === 'aftermath').length / meadows(st).length;
check(done >= 0.9, `populous: ${Math.round(done * 100)}% of meadows mown and carried by autumn day 4`);
const fed = st.households.filter((h) => h.herds.length);
for (const h of fed) check(h.hay > start.get(h.id), `populous: household ${h.id} brought in no hay`);
const ratio = fed.map((h) => h.hay / Sim.winterNeed(st, h)).sort((a, b) => a - b);
check(!checkState(st).length, 'populous: ' + checkState(st).slice(0, 3).join('; '));

// the frost: hay still lying rots; the next spring every meadow is grass again
const m0 = meadows(st)[0]; m0.stage = 'mown'; m0.held = 25; m0.mown = Math.floor(st.t / Sim.DAY);
st.jobs.forEach((j) => { if (j.meadow === m0) VB['sim/agents'].dropJob(st, j); });
const hayBefore = st.households.reduce((s, h) => s + h.hay, 0);
VB['sim/meadows'].meadowsDay(st, { doy: 35, season: 2, sday: 11, day: 35 });
check(m0.stage === 'aftermath' && m0.held === 0, 'frost: hay lying was not lost');
check(st.households.reduce((s, h) => s + h.hay, 0) === hayBefore, 'frost: rotted hay reached a barn');
at(st, Sim.YEAR_DAYS + 1);
check(meadows(st).every((m) => m.stage === 'grass' && !m.mown), 'spring: meadows not grass again');

st = Sim.seed(world(7), 7, 'founders');
const fStart = new Map(st.households.map((h) => [h.id, h.hay]));
at(st, 28);
for (const h of st.households.filter((x) => x.herds.length)) check(h.hay > fStart.get(h.id), `founders: household ${h.id} brought in no hay in year 1`);
check(st.events.some((e) => /has its hay in/.test(e.text)), 'founders: no log line for the hay');

if (failed) process.exit(1);
console.log(`hay ok: populous 7 tiny: ${Math.round(raked * 100)}% raked, ${Math.round(done * 100)}% in by autumn day 4; hay / winter need ` +
  `min ${ratio[0].toFixed(2)}, median ${ratio[ratio.length >> 1].toFixed(2)}, max ${ratio[ratio.length - 1].toFixed(2)} (${fed.length} households)`);
