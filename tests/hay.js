// Haymaking (VB-133), on the small islands of tests/lib/probe.js (VB-855): populous at seed 7 (6 before VB-1547's evening shifted the draws: 89% of 37 meadows there, 91% of 35 before; 3 before VB-1107's custom) rakes its meadows in spring and mows and
// carries at least 90% of them by autumn day 4; the hay goes into the household's barn; founders at seed 7 bring in hay by year 3 (VB-360); hay left
// lying at the frost rots; every spring the meadows are grass again. Reports each household's hay against its winter's need.
const VB = require('../src/load.js'), Sim = VB.sim, { scenario } = require('./lib/probe.js'), M = VB['sim/meadows'], { checkState } = require('./lib/invariants.js');
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('HAY FAIL:', m); } };
const at = (st, doy) => Sim.advance(st, doy * Sim.DAY + 6 - st.t); // to 6:00 on that day of year 1
const meadows = (st) => st.farmsteads.flatMap((f) => f.meadows);

// Constructed barns isolate spoilage from feeding, breeding, and haymaking.
const { spoilHay, byreDay } = VB['sim/byre'];
const barnState = { herds: [{ species: 'sheep', ewes: 5, rams: 0, lambs: 0 }] };
const winter = Sim.winterNeed(barnState, { herds: [0] });
const barn = (n, herds = [0]) => ({ hay: n, haySpoilt: 0, herds, farmstead: null }); // no farmstead, so no barn building (VB-255)
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
byreDay({ ...barnState, liveHouseholds: [0], households: [hh], farmsteads: [{ meadows: [lying] }] }, { doy: 10 });
check(hh.hay < 100 && hh.haySpoilt > 0, 'daily hook spoils hay even without animals');
check(lying.held === 25, 'barn spoilage leaves mown meadow hay alone');

let st = scenario('populous', 7);
st.naturalDeaths = false; // haymaking is tested, not who lives: a holder who dies in spring leaves a widow whose hay lies mown (VB-402's seed)
// Old saves have no loss counter; loading starts it at zero without accepting invalid new values.
const savedLoss = st.households[0].haySpoilt;
for (const invalid of [NaN, Infinity, -1]) {
  st.households[0].haySpoilt = invalid;
  check(checkState(st).some((e) => e.includes('haySpoilt')), `invariant rejects haySpoilt ${invalid}`);
}
st.households[0].haySpoilt = savedLoss;
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
VB['sim/meadows'].meadowsFrost(st);
check(m0.stage === 'aftermath' && m0.held === 0, 'frost: hay lying was not lost');
check(st.households.reduce((s, h) => s + h.hay, 0) === hayBefore, 'frost: rotted hay reached a barn');
at(st, Sim.YEAR_DAYS + 1);
check(meadows(st).every((m) => m.stage === 'grass' && !m.mown), 'spring: meadows not grass again');

st = scenario('founders', 7);
// by the end of year 3: since VB-360 a founder starts a novice at its crafts (grinding, building), and the smallest herding household
// (Strand) is short of hands for its last meadow in years 1 and 2 (its hay 24 and 54 against 37 and 69 before)
at(st, 3 * Sim.YEAR_DAYS - 1);
// the hay is in each farm's log (with five or six fields to sow for its courses, VB-353, a founders farm's stock is eaten as fast as it is mown, so its
// stock is no measure)
const told = Sim.villageLog(st, Infinity).map((e) => e.text).join('\n');
// a herd with a winter to feed: a new farm's herd with no head yet has none (VB-1565: a plot's site moved, and Yttergården, founded at the end
// of year 1, has a cattle herd of no head and no meadow by year 3)
const wintering = st.households.filter((x) => x.herds.length && Sim.winterNeed(st, x) > 0);
check(wintering.length >= 3, `founders: ${wintering.length} households with a herd to winter`);
for (const h of wintering) check(told.includes(`${st.farmsteads[h.farmstead].name} has its hay in`), `founders: household ${h.id} brought in no hay by the end of year 3`);
check(Sim.villageLog(st, Infinity).some((e) => /has its hay in/.test(e.text)), 'founders: no log line for the hay');

if (failed) process.exit(1);
console.log(`hay ok: populous 7, small island: ${Math.round(raked * 100)}% raked, ${Math.round(done * 100)}% in by autumn day 4; hay / winter need ` +
  `min ${ratio[0].toFixed(2)}, median ${ratio[ratio.length >> 1].toFixed(2)}, max ${ratio[ratio.length - 1].toFixed(2)} (${fed.length} households)`);
