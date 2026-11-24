// Mock A for the town's plan (VB-189): the craftsman's transition. Throwaway research code, not game code; no test or tool reads it.
//   node docs/cities/mocks/craft.js              every table of docs/cities/mock-town-emergence.md, part A (about 10 seconds)
//   node docs/cities/mocks/craft.js --only sweep|drops|maps|work|food
// One household with a craft among N farm households within reach. Each year the island draws one harvest factor. Each farm eats,
// keeps a reserve, and may give a part of what it can spare for the craft's good, when it has worn one out, cannot make it at home, values
// it above its customary worth and the walk; goods are bought in whole pieces. The craft household's head plans the year in spring, before
// it knows what the craft will bring: it wants its own cautious estimate of its food to reach 1.1 times its need (the game's FIELDS.want), and
// takes the plan that does so with the fewest hours of its adults. Its estimate of the craft is the second lowest of the last 8 years it
// remembers (principle "The future is someone's estimate": a pawn's estimate). Numbers: numbers.js (GAME from the game and its plans, INVENTED made up).
const { GAME: G, INVENTED: I, rng, harvest, table, median, mean, opt } = require('./numbers.js');
const need = G.household.hands * G.ration.adult + G.household.children * G.ration.child; // 216 rations a year
const T = G.want * need;
const fieldHours = G.field.hours.reduce((s, h) => s + h, 0); // 85
const fieldEst = G.field.yield * G.expect - G.field.seed; // 50
const farmFields = T / (G.field.yield * G.expect); // 3.2 fields a farm
const wear = (farmFields * fieldHours) / 10 * G.tools.wearPer10h; // 0.27 of the tools' condition a year
const rate = (L) => G.skills.novice + (G.skills.master - G.skills.novice) * L;
const winterHour = I.peakHourValue[1] * (1 - G.idle[3]); // what an hour of a winter's walk costs a farm: a field hour's return x the busy share
// the three crafts: what a farm wears out a year, what a piece is worth by custom, what it is worth to the farm, who must buy, the hours to make one
const savedHours = farmFields * fieldHours * (1 - (0.7 + 0.3 * (G.tools.woodCeiling - wear / 2)) / (0.7 + 0.3 * (1 - wear / 2))); // field hours iron saves a year
const typicalLoss = G.storeLoss[0] * need + G.storeLoss[1] * need * (mean(G.farmRatio) - 1);
const CRAFTS = {
  smith: {
    unit: 'bloom', worth: G.bloom.worth, demand: wear, buyers: 1 - G.place.bogIron,
    value: (f) => (savedHours / wear) * f.hourValue, // a bloom keeps the tools above the wooden ceiling: field hours saved, at what an hour is worth to this farm
    hours: (L) => (G.bloom.smeltHours / rate(L) + G.bloom.ore * I.oreHoursPerLoad + G.bloom.wood * G.woodHoursPerLoad) / (1 + (G.bloom.masterYield - 1) * L),
  },
  potter: {
    unit: 'pot', worth: G.pot.worth, demand: G.pot.want * G.pot.breakShare, buyers: 1 - G.place.clay,
    value: () => (typicalLoss * G.pot.saves) / (G.pot.want * G.pot.breakShare), // the grain the pots save a year, over the pots replaced
    hours: (L) => (G.pot.fireHours / rate(L) + I.oreHoursPerLoad + G.woodHoursPerLoad) / G.pot.perFiring,
  },
  weaver: {
    unit: 'length', worth: G.cloth.worth, demand: G.household.people / G.cloth.yearsPerPerson, buyers: I.clothBuyers,
    value: () => I.clothValue,
    hours: (L) => (G.cloth.spinHours * G.cloth.skeins + G.cloth.weaveHours) / rate(L),
  },
};
const cowAdult = G.cow.hayHours * I.cowAdultShare, cowAll = G.cow.hayHours + G.cow.milkHours + G.cow.fodderHours;
const adultPool = G.household.hands * G.adultHours - G.chores;

// One run: a craft household among farms at the walking hours `dist` (an array, one a farm), `years` long. o: the variant's switches.
function run(craft, dist, seed, o = {}) {
  const c = CRAFTS[craft], r = rng(seed), years = o.years || 60, burn = 20;
  const worth = c.worth * (o.worth || 1), demand = c.demand * (o.demand || 1), ratio = o.ratio || G.farmRatio;
  const share = o.budgetShare ?? I.budgetShare, hv = o.hourValue || I.peakHourValue;
  const farms = dist.map((h) => ({ h, need: need * (0.6 + 0.8 * r()), ratio: ratio[0] + (ratio[1] - ratio[0]) * r(), hourValue: hv[0] + (hv[1] - hv[0]) * r(),
    buys: r() < (o.buyers ?? c.buyers), store: 0, backlog: r() * Math.max(1, demand) }));
  const nearFarms = Math.min(20, dist.filter((h) => h <= 1).length), hireCap = Math.round(I.hired.daysPerFarm * nearFarms * 2);
  let L = 0, store = 0; const memory = [], out = [];
  for (let y = 0; y < years; y++) {
    // spring: the head's plan, on its own estimate of what the craft will bring
    const s = [...memory].sort((a, b) => a - b);
    const estCraft = s.length < 3 ? 0 : o.estimate === 'mean' ? mean(s) : s[1];
    const estCraftHours = s.length ? (mean(s) / worth) * c.hours(L) : 0;
    let best = null;
    for (let F = 0; F <= (o.maxFields ?? 6); F++) for (let C = 0; C <= 2; C++) for (let gd = 0; gd <= (o.garden === false ? 0 : 1); gd++) for (const D of hireCap ? [0, hireCap] : [0]) {
      const est = estCraft + F * fieldEst + C * G.cow.food * 0.9 + gd * I.garden.food + D * G.day.rations * 0.75;
      const hrs = F * fieldHours + C * (o.cowHours === 'all' ? cowAll : cowAdult) + gd * I.garden.hours + D * G.day.hours;
      if (hrs + estCraftHours > adultPool) continue;
      const ok = est >= T;
      // the satisficer: enough, with the fewest hours; the maximiser (a variant): the most food its hours allow
      const better = !best || (o.maximise ? est > best.est : ok !== best.ok ? ok : ok ? hrs < best.hrs : est > best.est);
      if (better) best = { F, C, gd, D, est, hrs, ok };
    }
    const { F, C, gd, D } = best;
    // autumn: the harvest, and what the farms give for the craft's goods
    const w = o.steady ? G.weather.mean : harvest(r), chance = () => (o.steady ? 1 : 0.9 + 0.2 * r());
    let wanted = 0, sold = 0; const capacity = (adultPool - best.hrs) / c.hours(L);
    const order = farms.map((_, i) => i).sort(() => r() - 0.5);
    for (const i of order) {
      const f = farms[i];
      let g = f.store + f.need * f.ratio * (w / G.weather.mean) * chance() - f.need;
      if (g < 0) g = 0;
      f.backlog = Math.min(f.backlog + demand, Math.max(1, 2 * demand));
      if (f.buys && c.value(f) > worth) {
        const spare = Math.max(0, g - I.reserve * f.need) * share;
        let q = Math.min(f.backlog, spare / worth); if (!o.smooth) q = Math.floor(q);
        wanted += Math.min(f.backlog, o.smooth ? f.backlog : Math.floor(f.backlog));
        q = Math.min(q, Math.max(0, capacity - sold)); if (!o.smooth) q = Math.floor(q);
        if (q > 0 && q * (c.value(f) - worth) >= 2 * f.h * (o.walkHour ?? winterHour)) { sold += q; f.backlog -= q; g -= q * worth; }
      }
      f.store = g - G.storeLoss[1] * Math.min(g, f.need) - G.storeLoss[2] * Math.max(0, g - f.need);
    }
    const craftFood = sold * worth, craftHours = sold * c.hours(L);
    const farmFood = F * (G.field.yield * (G.expect / G.weather.mean) * w * chance() - G.field.seed) + C * G.cow.food * (w / G.weather.mean) + gd * I.garden.food +
      D * G.day.rations * (w < 0.85 && !o.steady ? I.hired.badYear : 1);
    const food = craftFood + farmFood;
    let g = store + food - need, short = 0; if (g < 0) { short = -g / need; g = 0; }
    store = g - G.storeLoss[1] * Math.min(g, need) - G.storeLoss[2] * Math.max(0, g - need);
    L = (1 - (1 - L) * Math.pow(0.5, craftHours / G.skills.half)) * (1 - G.skills.fade);
    memory.push(craftFood); if (memory.length > I.memory) memory.shift();
    if (y >= burn) out.push({ F, C, gd, D, craftFood, food, craftHours, otherHours: best.hrs, short, L, wanted, sold });
  }
  return out;
}
// many seeds of one case, summed up
function sum(craft, dist, o = {}, seeds = 30) {
  const all = []; for (let s = 1; s <= seeds; s++) all.push(...run(craft, dist, s * 7 + dist.length, o));
  const cf = all.map((x) => x.craftFood), m = mean(cf), sd = Math.sqrt(mean(cf.map((x) => (x - m) ** 2)));
  return { share: mean(all.map((x) => x.craftFood)) / mean(all.map((x) => x.food)), F: mean(all.map((x) => x.F)), C: mean(all.map((x) => x.C)),
    medF: median(all.map((x) => x.F)), medC: median(all.map((x) => x.C)), garden: mean(all.map((x) => x.gd)), hired: mean(all.map((x) => x.D)),
    craftHours: mean(all.map((x) => x.craftHours)), otherHours: mean(all.map((x) => x.otherHours)), craftFood: m, cv: m ? sd / m : 0,
    hungry: mean(all.map((x) => (x.short > 0.05 ? 1 : 0))), L: mean(all.map((x) => x.L)), zero: mean(cf.map((x) => (x === 0 ? 1 : 0))) };
}
const at = (n, h = 1) => new Array(n).fill(h);
const GRID = [5, 10, 15, 20, 30, 40, 50, 60, 80, 100, 120, 160, 200, 240, 320, 400, 500, 640, 800, 1000, 1300, 1600];
// the reach-populations at which the craft is half the food, the fields go (none in the median year), and the cow goes
function drops(craft, o = {}, seeds = 12) {
  let half = null, fields = null, cow = null, last = null;
  for (const n of GRID) { const s = sum(craft, at(n), o, seeds); last = s; if (half === null && s.share >= 0.5) half = n; if (fields === null && s.medF === 0) fields = n;
    if (cow === null && s.medC === 0 && s.medF === 0) cow = n; if (half && fields && cow) break; }
  return { half: half ?? '>1600', fields: fields ?? '>1600', cow: cow ?? '>1600', last };
}
const f1 = (x) => (Math.round(x * 10) / 10).toFixed(1), pc = (x) => Math.round(x * 100) + '%';
const only = opt('only', '');

if (!only || only === 'sweep') {
  console.log(`\nA0. The game's numbers behind the crafts. A household of ${G.household.people} needs ${need} rations a year and its head wants ${f1(T)}; a farm tills ${f1(farmFields)} fields in ${Math.round(farmFields * fieldHours)} hours.`);
  table(Object.entries(CRAFTS).map(([k, c]) => { const f = { hourValue: mean(I.peakHourValue) }; return { craft: k, piece: c.unit, 'worth (rations)': c.worth, 'a farm wears out a year': f1(c.demand),
    'hours a piece, novice': f1(c.hours(0)), 'hours, master': f1(c.hours(1)), 'rations an hour': `${f1(c.worth / c.hours(0))} to ${f1(c.worth / c.hours(1))}`,
    'worth to a middling farm': f1(c.value(f)), 'farms that must buy': pc(c.buyers), 'rations a farm in reach a year': f1(c.demand * c.worth * c.buyers * (k === 'smith' ? 1 - (c.worth * wear / savedHours - I.peakHourValue[0]) / (I.peakHourValue[1] - I.peakHourValue[0]) : 1)) }; }),
    ['craft', 'piece', 'worth (rations)', 'a farm wears out a year', 'hours a piece, novice', 'hours, master', 'rations an hour', 'worth to a middling farm', 'farms that must buy', 'rations a farm in reach a year']);
  console.log(`For comparison, rations an hour: a field ${f1(fieldEst / fieldHours)} (50 net of seed in ${fieldHours} h), a day's hire ${f1(G.day.rations / G.day.hours)}, a cow ${f1(G.cow.food / cowAll)} on all its hours and ${f1(G.cow.food / cowAdult)} on the haymaking alone.`);
  for (const craft of Object.keys(CRAFTS)) {
    console.log(`\nA1. ${craft}: the household's year as the farms within an hour's walk grow (30 seeds, years 21 to 60 of each)`);
    table([5, 10, 20, 40, 60, 80, 120, 160, 240, 320].map((n) => { const s = sum(craft, at(n)); return { farms: n, 'craft share of food': pc(s.share), fields: f1(s.F), cows: f1(s.C), garden: f1(s.garden),
      'hired days': f1(s.hired), 'craft hours': Math.round(s.craftHours), 'farm hours (adults)': Math.round(s.otherHours), 'craft share of hours': pc(s.craftHours / (s.craftHours + s.otherHours || 1)),
      'craft income CV': f1(s.cv), 'years with no sale': pc(s.zero), 'hungry years': pc(s.hungry), skill: f1(s.L) }; }),
      ['farms', 'craft share of food', 'fields', 'cows', 'garden', 'hired days', 'craft hours', 'farm hours (adults)', 'craft share of hours', 'craft income CV', 'years with no sale', 'hungry years', 'skill']);
  }
}
if (!only || only === 'drops') {
  console.log('\nA2. Farms within reach at which the craft is half the household\'s food, at which it keeps no field in the median year, and no cow; and how many such households 160 farms (1,000 people) carry');
  const rows = [];
  for (const craft of Object.keys(CRAFTS)) { const d = drops(craft); rows.push({ craft, 'half its food': d.half, 'no fields': d.fields, 'no cow': d.cow,
    'no-field households per 160 farms': typeof d.fields === 'number' ? f1(160 / d.fields) : '0', 'half-craft households per 160 farms': typeof d.half === 'number' ? f1(160 / d.half) : '0' }); }
  table(rows, ['craft', 'half its food', 'no fields', 'no cow', 'no-field households per 160 farms', 'half-craft households per 160 farms']);
  console.log('\nA3. What keeps the smith half a farmer: farms within reach at which it keeps no field, one thing changed at a time (12 seeds a point)');
  const V = [
    ['as above', {}],
    ['every year the same harvest', { steady: true }],
    ['goods sold in any fraction (no lumps)', { smooth: true }],
    ['steady and no lumps', { steady: true, smooth: true }],
    ['the head plans on its mean craft income, not its second worst year', { estimate: 'mean' }],
    ['the head takes the most food its hours allow (a maximiser)', { maximise: true }],
    ['a full island: farms make 1.0 to 1.25 times their need', { ratio: [1.0, 1.25] }],
    ['a lean island: 1.0 to 1.1', { ratio: [1.0, 1.1] }],
    ['a bloom worth 15, not 30', { worth: 0.5 }],
    ['a bloom worth 60', { worth: 2 }],
    ['tools wear half as fast', { demand: 0.5 }],
    ['tools wear twice as fast', { demand: 2 }],
    ['every farm must buy its iron (no bog but the smith\'s)', { buyers: 1 }],
    ['a farm gives a tenth of its spare for iron, not a third', { budgetShare: 0.1 }],
    ['a peak hour is worth 0.3 to 0.58 to every farm', { hourValue: [0.3, 0.58] }],
    ['the cow\'s every hour counted against it', { cowHours: 'all' }],
    ['no garden', { garden: false }],
    ['no land to till: a plot household (a cow, a garden, hired days)', { maxFields: 0 }],
    ['a plot household on a full island', { maxFields: 0, ratio: [1.0, 1.25] }],
  ];
  table(V.map(([name, o]) => { const d = drops('smith', o); const s = sum('smith', at(60), o, 12); return { variant: name, 'half its food': d.half, 'no fields': o.maxFields === 0 ? '-' : d.fields, 'no cow': d.cow,
    'at 60 farms: craft share': pc(s.share), fields: f1(s.F), cows: f1(s.C), 'hired days': f1(s.hired), 'hungry years': pc(s.hungry), 'income CV': f1(s.cv) }; }),
    ['variant', 'half its food', 'no fields', 'no cow', 'at 60 farms: craft share', 'fields', 'cows', 'hired days', 'hungry years', 'income CV']);
}
if (!only || only === 'maps') {
  const maps = require('./hours.json');
  console.log('\nA4. On real maps: households within a day\'s walk there and back (6 hours one way) of each village, and a craft household set down in each (8 seeds a village)');
  const rows = [];
  for (const m of maps) {
    const reachN = [], res = { smith: [], potter: [], weaver: [] };
    m.villages.forEach((v, a) => {
      const dist = [];
      m.villages.forEach((u, b) => { const h = a === b ? 0.2 : m.hours[a][b] === null ? Infinity : m.hours[a][b] + 0.2; if (h <= G.travel.dayWalk / 2) for (let k = 0; k < u.households - (a === b ? 1 : 0); k++) dist.push(h); });
      reachN.push(dist.length);
      for (const craft of Object.keys(res)) res[craft].push(sum(craft, dist, {}, 8));
    });
    const row = { map: m.key, villages: m.villages.length, households: m.villages.reduce((s, v) => s + v.households, 0), 'in reach: median': median(reachN), most: Math.max(...reachN) };
    for (const craft of Object.keys(res)) { const best = res[craft].reduce((x, y) => (y.share > x.share ? y : x));
      row[`${craft}: villages half-craft`] = res[craft].filter((s) => s.share >= 0.5).length; row[`${craft}: no fields`] = res[craft].filter((s) => s.medF === 0).length; row[`${craft}: best share`] = pc(best.share); }
    rows.push(row);
  }
  table(rows, Object.keys(rows[0]));
}
if (!only || only === 'work') {
  // An account, not a simulation: the hours the planned goods take a household of six a year, against the hours a farm household works today.
  const worked = G.household.hands * G.adultHours * (1 - mean(G.idle)), avail = G.household.hands * G.adultHours;
  const rows = [
    ['dress: 2 lengths of cloth, spun and woven (VB-362)', (G.household.people / G.cloth.yearsPerPerson) * (G.cloth.spinHours * G.cloth.skeins + G.cloth.weaveHours), 'craft'],
    ['iron: the blooms its tools wear (VB-364) and their mending in winter (VB-121)', wear * CRAFTS.smith.hours(0.5) + (wear / 0.1) * G.tools.mendHours, 'craft'],
    ['pots: 2 a year (VB-366)', 2 * CRAFTS.potter.hours(0.5), 'craft'],
    ['ale and tar, as measured where a household makes them (brew 10, burntar 13)', 10 + 13, 'craft'],
    ['walking to deal: 1.8 walks a year (mock B) of 2 hours each way and a morning\'s dealing', 1.8 * 8, 'trade'],
    ['grinding at the quern, as measured (100; a mill takes it over)', 100, 'household'],
    ['building and upkeep, as measured (walls, roof, raise, foundation, repair: 66)', 66, 'household'],
  ];
  const craft = rows.filter((r) => r[2] !== 'household').reduce((s, r) => s + r[1], 0), house = rows.filter((r) => r[2] === 'household').reduce((s, r) => s + r[1], 0);
  console.log(`\nA5. What the work line of 600 / 325 / 75 would read: hours a household of six a year (it has ${avail} work hours and works ${Math.round(worked)} of them today, idle ${pc(mean(G.idle))})`);
  table(rows.map(([what, h, kind]) => ({ work: what, hours: Math.round(h), kind })), ['work', 'hours', 'kind']);
  const line = (c, denom) => Math.round((1000 * c) / denom);
  console.log(`Craft and trade: ${Math.round(craft)} hours a household a year, ${pc(((G.household.people / G.cloth.yearsPerPerson) * 92) / craft)} of it dress.`);
  console.log(`Per 1,000 on the work line, if every household makes or buys these and the elite is left out:`);
  console.log(`  of hours worked, crafts added to today's work: ${line(craft, worked + craft)}; with grinding and building counted as specialised: ${line(craft + house, worked + craft)}`);
  console.log(`  of all work hours (576 an adult), idle hours counted as nobody's: ${line(craft, avail)}; with grinding and building: ${line(craft + house, avail)}`);
  console.log(`  without dress: ${line(craft - 184, worked + craft - 184)} of hours worked`);
  const full = Object.keys(CRAFTS).map((k) => { const d = drops(k); return [k, d.fields, d.last]; });
  console.log('  by heads: ' + full.map(([k, n]) => `${k} ${typeof n === 'number' ? f1(160 / n) : 0}`).join(', ') + ' households with no field per 160 farms; each is 6 heads on the heads line and, by its craft hours, far less on the work line');
}
if (!only || only === 'food') {
  // What the farms could spare at all, against what the crafts ask of them: the food side of a town before the ship.
  console.log('\nA6. Food for those who do not farm, per 160 farm households (about 1,000 people), by what farms make over their need (40 years, 10 seeds)');
  const rows = [];
  for (const ratio of [[1.0, 1.1], [1.0, 1.25], [1.1, 1.3], [1.1, 1.6], [1.3, 1.6]]) {
    let spare = 0, bad = 0, n = 0, badN = 0;
    for (let s = 1; s <= 10; s++) { const r = rng(900 + s); const farms = at(160).map(() => ({ need: need * (0.6 + 0.8 * r()), ratio: ratio[0] + (ratio[1] - ratio[0]) * r(), store: 0 }));
      for (let y = 0; y < 60; y++) { const w = harvest(r); let tot = 0;
        for (const f of farms) { let g = Math.max(0, f.store + f.need * f.ratio * (w / G.weather.mean) * (0.9 + 0.2 * r()) - f.need); const sp = Math.max(0, g - I.reserve * f.need);
          // a farm parts with all it holds beyond the year's need and its reserve (the most it could: feasts, help, rent and rot take none here)
          const give = sp; tot += give; g -= give; f.store = g - G.storeLoss[1] * Math.min(g, f.need) - G.storeLoss[2] * Math.max(0, g - f.need); }
        if (y >= 20) { spare += tot; n++; if (w < 0.85) { bad += tot; badN++; } } } }
    const perYear = spare / n, badYear = bad / (badN || 1);
    const asked = Object.entries(CRAFTS).reduce((s, [k, c]) => s + 160 * c.demand * c.worth * c.buyers * (k === 'smith' ? 0.68 : 1), 0);
    rows.push({ 'farms make (x need)': ratio.join(' to '), 'spared a year (rations)': Math.round(perYear), 'households it feeds': f1(perYear / T), 'in a bad year (harvest under 0.85)': f1(badYear / T),
      'the three crafts ask (rations)': Math.round(asked), 'households that feeds': f1(Math.min(asked, perYear) / T), 'people, at 6': Math.round((6 * Math.min(asked, perYear)) / T) });
  }
  table(rows, Object.keys(rows[0]));
}
