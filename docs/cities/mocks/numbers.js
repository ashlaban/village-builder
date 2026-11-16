// The numbers the town's mock runs on (VB-189; throwaway research code, not game code). GAME holds what the game or its design already
// says, each with where it was read on 16 November 2026; INVENTED holds what had to be made up, each said to be so. The mocks read both
// and nothing else, so a number that changes in the game is changed here, in one place.
const GAME = {
  yearDays: 48, // src/sim/rules.js: SEASON_DAYS 12 x 4
  seasonDays: 12,
  adultHours: 576, // design.md, The mill and the loom: "the game's work hours (576 an adult a year)", 12 a day
  ration: { adult: 48, child: 24 }, // ECON.ration 1 and 0.5 a day, a year of 48 days
  household: { people: 6, hands: 3, children: 3 }, // populous year 0: 324 to 350 people in 54 to 56 households (hours.json); "dress for a household of six"
  want: 1.1, // FIELDS.want: a head wants fields for 1.1 times a year's rations ...
  expect: 0.75, // ... at FIELDS.expect of the full yield: the head's own cautious estimate
  field: {
    yield: 100, seed: 25, // CROPS.barley
    // hours a field a year with the walking, by season: `tools/sim.js --scenario populous --seed 7 --map small --years 3 --report hours`,
    // a household of 8 fields (plough 18.8, sow 2.7, weed 17.4, reap 18.7, haul 2.8, thresh 25.6 = 86; CROPS.barley's work alone is 67);
    // ripe and reaped in autumn (median autumn 6 and 7), threshed by winter 1
    hours: [30, 9, 34, 12],
  },
  weather: { low: 0.75, high: 1.2, mean: 0.975 }, // design.md, Crops and the weather: barley's yearly factor, 0.75 to 1.2, about 0.975
  farmRatio: [1.1, 1.6], // docs/balance/mocks/brief.md: a farming household makes 1.1 to 1.6 times its need, falling as the island fills
  storeLoss: [0.05, 0.2, 0.4], // ECON.storeLoss: of the grain up to a year's need, of the next year's worth, of the rest
  idle: [0.44, 0.44, 0.62, 0.72], // design.md, How busy (10 Nov): farmers idle 40-48% in spring and summer, 60-65% in autumn, 67-76% in winter
  chores: 300, // the same --report hours: cook 95, water 41, wood 64, grind 100, a household a year
  // a cow: HERD.milk 0.5 a day for the 27 days out (turn-out doy 5 to stall doy 32) x HERD.calve 0.85 = 11.5 rations; a calf kept to the
  // autumn count 0.85 x (1 - calfDeath 0.15) x meat.calf 5 = 3.6; hay 21 stall days x 1 x margin 1.1 = 23 of a meadow's 30 (sim/meadows HAY)
  cow: { food: 15.1, hayHours: 0.77 * (16 + 2 + 4.5), milkHours: 27 * 0.5, fodderHours: 21 * 0.65, worth: 40 },
  day: { rations: 3, hours: 8 }, // design.md, Goods of place: "a day's work 3"; the draft plan: 3 rations for 8 hours
  travel: { load: 30, hand: 90, cart: 300, dayWalk: 12 }, // TRAVEL
  skills: { novice: 0.6, master: 1.3, half: 400, fade: 0.1 }, // VB-360
  tools: { wearPer10h: 0.01, mendHours: 4, woodCeiling: 0.5 }, // VB-121: rate 0.7 + 0.3 x condition; a tenth of a bloom each 0.1 mended above 0.5
  bloom: { worth: 30, smeltHours: 10, ore: 4, wood: 6, masterYield: 1.5 }, // VB-364
  woodHoursPerLoad: 1.8, // the same --report hours: wood 64.3 h a household a year for about 35 loads (ECON.woodUse over a year)
  pot: { worth: 3, fireHours: 4, perFiring: 4, want: 8, breakShare: 0.25, per: 60, saves: 0.5 }, // VB-366
  cloth: { worth: 40, spinHours: 40, skeins: 2, weaveHours: 12, yearsPerPerson: 3 }, // VB-362, design.md Dress
  // villages of a populous start with the resource within 12 walking steps of the green (docs/plans/VB-702.md, section 6): small 189, medium 81
  place: { bogIron: (27 + 6) / (189 + 81), clay: (92 + 44) / (189 + 81) },
  gatherMin: 3, // VB-294: a gathering fewer than three villages chose is not held
};
const INVENTED = {
  oreHoursPerLoad: 1.5, // digging and carrying a load of bog ore or clay: no number in the plans
  // what an hour saved at a farm's peak is worth to it: from nothing (hands to spare) to what an hour on a field returns (50 rations / 86 h)
  peakHourValue: [0, 0.58],
  budgetShare: 1 / 3, // of what a farm can spare, the part it would give for one craft's goods (three crafts share it; feasts, help and rent take none here)
  reserve: 0.25, // a farm keeps a quarter of a year's need above the year's own need before it spares anything (the game has a floor and a reserve; this value is mine)
  clothBuyers: 0.2, // share of households that cannot make their own cloth (no sheep, or no spare hands indoors)
  clothValue: 60, // what a length of cloth is worth to one who lacks it (rags cost health and standing; no ration figure exists)
  garden: { food: 17, hours: 22 }, // a kitchen garden as a third of a field with no walk: the game has no garden crop
  hired: { daysPerFarm: 0.4, badYear: 0.5 }, // days of hire a near farm gives at each of the two peaks; halved in a bad year
  cowAdultShare: 1, // of a cow's hours, haymaking falls on the adults the craft also uses; milking, fodder and herding on wife, old and children
  memory: 8, // years of its own craft income a head remembers; it plans on the second lowest
  // B, the market: wants a household a year by good, the gain of a want filled (value less worth), the share lost for each day waited
  wants: [
    { key: 'iron', rate: 0.3, gain: 15, wait: 1 / 48 },
    { key: 'pots', rate: 0.5, gain: 6, wait: 1 / 96 },
    { key: 'cloth', rate: 0.4, gain: 20, wait: 1 / 96 },
    { key: 'fish', rate: 1, gain: 5, wait: 1 / 48, sea: true },
    { key: 'tar', rate: 0.25, gain: 4, wait: 1 / 96 },
  ],
  marketHours: 4, // a market date's dealing, 8:00 to 12:00 (the draft plan)
  prior: 0.5, // what a household that has never been to a place's date expects of finding a good there
  tryChance: 0.3, // a host with a mind to it tries one new date a year with this chance
  hostBreakEven: 6, // households from other villages a date must draw for its host to call it again
};
// one seeded stream a run (mulberry32), as the game's own streams are
const rng = (seed) => { let a = (seed * 2654435761 + 12345) >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
// the year's harvest factor, one for the island: a triangle on [low, high] whose mean is the design's 0.975
const harvest = (r) => { const { low, high, mean } = GAME.weather, mode = 3 * mean - low - high, u = r(), f = (mode - low) / (high - low);
  return u < f ? low + Math.sqrt(u * (high - low) * (mode - low)) : high - Math.sqrt((1 - u) * (high - low) * (high - mode)); };
const table = (rows, cols) => { const w = cols.map((c) => Math.max(c.length, ...rows.map((r) => String(r[c] ?? '').length)));
  console.log(cols.map((c, i) => c.padEnd(w[i])).join('  ')); for (const r of rows) console.log(cols.map((c, i) => String(r[c] ?? '').padEnd(w[i])).join('  ')); };
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor((s.length - 1) / 2)] : NaN; };
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN);
const opt = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
module.exports = { GAME, INVENTED, rng, harvest, table, median, mean, opt };
