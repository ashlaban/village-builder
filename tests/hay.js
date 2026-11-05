// Haymaking (VB-133): populous tiny at seed 7 rakes its meadows in spring and mows and carries at least 90% of them by autumn day 4; the hay
// goes into the household's barn; founders at seed 7 bring in hay in year 1; hay left lying at the frost rots; every spring the meadows are
// grass again. Reports each household's hay against its winter's need.
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim, M = VB['sim/meadows'], { checkState } = require('./lib/invariants.js');
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('HAY FAIL:', m); } };
const world = (seed) => { const it = G.generate(seed, { cols: 120, rows: 85 }); let r; while (!(r = it.next()).done); return r.value; };
const at = (st, doy) => Sim.advance(st, doy * Sim.DAY + 6 - st.t); // to 6:00 on that day of year 1
const meadows = (st) => st.farmsteads.flatMap((f) => f.meadows);

// Constructed barns isolate spoilage from feeding, breeding, and haymaking.
const { spoilHay, byreDay } = VB['sim/byre'];
const barnState = { herds: [{ species: 'sheep', ewes: 5, rams: 0, lambs: 0 }] };
const winter = Sim.winterNeed(barnState, { herds: [0] });
const barn = (n, herds = [0]) => ({ hay: n, haySpoilt: 0, herds });
const yearLoss = (hh) => { for (let d = 0; d < Sim.YEAR_DAYS; d++) spoilHay(barnState, hh); return hh.haySpoilt; };
let hh = barn(winter);
check(Math.abs(yearLoss(hh) - winter * 0.05) < 1e-9, 'one winter loses 5% in a year');
hh = barn(4 * winter);
spoilHay(barnState, hh);
const daily = (rate) => 1 - Math.pow(1 - rate, 1 / Sim.YEAR_DAYS);
check(Math.abs(hh.haySpoilt - winter * (daily(0.05) + daily(0.25) + 2 * daily(0.5))) < 1e-9, 'daily loss uses all three tiers');
hh = barn(4 * winter);
// The tiers are reassessed daily as the barn empties, just as grain is: roughly 1.3 winters lost, slightly less as stocks fall.
check(Math.abs(yearLoss(hh) / winter - 1.3) < 0.1, 'four winters lose about 5% + 25% + twice 50% of a winter');
check(Math.abs(hh.hay + hh.haySpoilt - 4 * winter) < 1e-9, 'hay plus cumulative loss is conserved');
hh = barn(100, []);
check(Math.abs(yearLoss(hh) - 50) < 1e-9, 'without animals, stored hay halves in a year');
hh = barn(0); spoilHay(barnState, hh);
check(hh.hay === 0 && hh.haySpoilt === 0, 'empty barn stays empty');
// The daily hook must also spoil barns without a herd; it never touches mown hay outside.
hh = { ...barn(100, []), larder: [], manure: 0 };
const lying = { stage: 'mown', held: 25 };
byreDay({ ...barnState, households: [hh], farmsteads: [{ meadows: [lying] }] }, { doy: 10 });
check(hh.hay < 100 && hh.haySpoilt > 0, 'daily hook spoils hay even without animals');
check(lying.held === 25, 'barn spoilage leaves mown meadow hay alone');

let st = Sim.seed(world(7), 7, 'populous');
// Old saves have no loss counter; loading starts it at zero without accepting invalid new values.
const savedLoss = st.households[0].haySpoilt;
for (const invalid of [NaN, Infinity, -1]) {
  st.households[0].haySpoilt = invalid;
  check(checkState(st).some((e) => e.includes('haySpoilt')), `invariant rejects haySpoilt ${invalid}`);
}
st.households[0].haySpoilt = savedLoss;
const oldState = { ...st, households: st.households.map(({ haySpoilt, ...h }) => h) };
const loaded = Sim.load(st.w, Sim.save(oldState));
check(loaded.households.every((h) => h.haySpoilt === 0), 'older saves initialize haySpoilt');
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
