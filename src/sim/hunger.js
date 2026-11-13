// @sys sim/hunger: the daily meal shared out by custom, the larder of stored food, grain spoiling in store, each pawn's hunger level and health;
// the need rule (VB-299) and its food term
VB['sim/hunger'] = (() => {
  const { HUNGER, HEALTH, HERD, HELP, FOODS, DAY, YEAR, YEAR_DAYS, SEASON_DAYS, CROPS } = VB['sim/rules'];
  const { age, farmPractice, log, atFarm } = VB['sim/records'];
  const Stores = VB['sim/stores'],
    Pot = VB['sim/pot'];
  const Rules = VB['sim/registry'];
  // The seed kept for a field: the standing plan's target (from its culture's template, sim/plans; VB-252), the crop's seed (barley's) before it has one.
  function seedPer(st, hh) {
    const plan = st.plans && st.plans.households.get(hh.id);
    return (plan && plan.targets && plan.targets.seed) ?? CROPS.barley.seed;
  }
  // The seed the household's fields not yet sown this year need: the standing plan's reservation of grain (sim/plans reserves it at each
  // review; sim/stores counts it with this rule when it is read, so a field sown since counts at once); a land project holds back its new
  // field's seed itself (sim/projects, VB-123). Only the day's meal reaches below the seed, and only when the day would otherwise fall short
  // (feedHousehold; Kim, 10 November: the hungry household eats its seed). By crop (VB-347): the fields that bear or last bore it (their
  // next crop, until rotations choose it, VB-350); every field without one.
  function seedNeed(st, hh, crop) {
    const f = st.farmsteads[hh.farmstead];
    let n = 0;
    for (const fd of f.fields)
      if ((fd.stage === 'stubble' || fd.stage === 'plowed') && (crop === undefined || fd.crop === crop)) n++;
    return n * seedPer(st, hh);
  }
  Stores.follow('seed', seedNeed);
  const { reserved, grainOf } = Stores;
  // The grain held back as seed, as the Sim API has read it (the page); the simulation reads reserved(st, hh, 'grain').
  const seedReserve = (st, hh) => reserved(st, hh, 'grain');
  // What the household's living members eat in a day, in rations.
  function dailyNeed(st, hh) {
    const adult = st.ECON.ration.adult,
      child = st.ECON.ration.child;
    let s = 0; // a loop, not map, filter and reduce: the job review asks it every hour from 14:00 for every household (VB-227)
    for (const id of hh.members) {
      const p = st.pawns[id];
      if (p.died === null) s += age(st, p) >= 14 ? adult : child;
    }
    return s;
  }
  // The floor (VB-182): the seed reserve and HELP.floorDays of the household's need; no deal takes a household below it.
  const floorOf = (st, hh) => reserved(st, hh, 'grain') + HELP.floorDays * dailyNeed(st, hh);
  // death.hazard's hunger and frailty terms (the rule is declared in sim/deaths, which loads later)
  Rules.contribute({
    rule: 'death.hazard',
    source: 'sim/hunger',
    key: 'hunger',
    label: 'Hunger',
    cause: 'hunger',
    range: [1, 2.5],
    tunables: ['HUNGER.k'],
    value: (st, p) => 1 + HUNGER.k(Math.floor((st.t - p.born) / YEAR)) * p.hunger,
  });
  Rules.contribute({
    rule: 'death.hazard',
    source: 'sim/hunger',
    key: 'frailty',
    label: 'Poor health',
    cause: 'hunger',
    range: [1, 3],
    tunables: ['HEALTH.riskBelow', 'HEALTH.riskSlope'],
    value: (st, p) => (p.health < HEALTH.riskBelow ? 1 + (HEALTH.riskBelow - p.health) / HEALTH.riskSlope : 1),
  });
  // allowance's first term: the giving household's grain above its floor (sim/relations, VB-216)
  Rules.contribute({
    rule: 'allowance',
    source: 'sim/hunger',
    key: 'slack',
    label: 'Grain above the floor',
    tunables: ['HELP.floorDays'],
    value: (st, c) => Math.max(0, grainOf(c.from) - floorOf(st, c.from)),
  });
  // ---- need (VB-299; design.md, The fair: Need; target-v2 5.1): what a quantity of a good is worth to the household taking it now, in rations of
  // its welfare; the sum of each good's term, by the module that knows the need (food here, animals sim/byre, tar and ale sim/exchange). The
  // context is {hh, good (a good of sim/stores), n (quanta; below 0, what giving them up costs), kept (rations' worth of keeping goods it
  // holds to pass on)}; sim/exchange's needValue reads it. A term allocates nothing. ----
  Rules.declare({ id: 'need', owner: 'sim/hunger', combine: 'sum', base: () => 0 });
  const NEED = { empty: 3, beyond: 0.5, beyondYears: 2, lacking: 1.2, lackingShare: 0.2 };
  const AUTUMN = 2;
  // Days to the next harvest, the start of autumn; in autumn, while it comes in, a season (as help's askDaysAt). Allocates nothing.
  function toHarvest(t) {
    const doy = Math.floor(t / DAY) % YEAR_DAYS,
      season = Math.floor(doy / SEASON_DAYS);
    return season === AUTUMN
      ? SEASON_DAYS
      : season < AUTUMN
        ? AUTUMN * SEASON_DAYS - doy
        : YEAR_DAYS - doy + AUTUMN * SEASON_DAYS;
  }
  // The food a household holds, in rations: its grain, its larder and its fresh food (VB-119; read with st, for the batches past their day);
  // and in days of its need (Infinity with nobody to feed).
  const foodHeld = (hh, st) => grainOf(hh) + larderOf(hh) + (st && hh.fresh.length ? Pot.freshHeld(st, hh) : 0);
  function daysOfFood(st, hh) {
    const need = dailyNeed(st, hh);
    return need > 0 ? foodHeld(hh, st) / need : Infinity;
  }
  // The food a household holds of one source of the pot (FOODS' source; dried fish 'fish').
  function sourceHeld(st, hh, source) {
    let s = source === 'grain' ? grainOf(hh) : 0;
    for (const l of hh.larder) {
      const f = FOODS[l.kind],
        src = f ? f.source : Stores.GOODS.has(l.kind) ? Stores.GOODS.get(l.kind).source : null;
      if (src === source) s += l.n;
    }
    for (const b of hh.fresh) if (FOODS[b.food].source === source) s += b.qty; // fresh batches (VB-119), stale ones too: a read for a deal
    return s;
  }
  // The worth of a household's food stock from 0 to s rations: a ration is worth NEED.empty at empty stores, falling in a line to 1 at
  // `reach` (stores that reach the next harvest with the reserve), 1 up to `ample` (two years' need), NEED.beyond beyond it.
  function stockWorth(s, reach, ample) {
    if (s <= 0) return NEED.empty * s;
    if (s <= reach) return NEED.empty * s - ((NEED.empty - 1) * s * s) / (2 * reach);
    const atReach = ((NEED.empty + 1) / 2) * reach;
    return s <= ample ? atReach + (s - reach) : atReach + (ample - reach) + NEED.beyond * (s - ample);
  }
  // Food: the change in the stock's worth; and a food the pot lacks (its source held below a fifth of the need to the next harvest) counts
  // NEED.lacking times for the part of it that fills that fifth.
  Rules.contribute({
    rule: 'need',
    source: 'sim/hunger',
    key: 'food',
    label: 'Food against the year ahead',
    tunables: ['HELP.bufferDays', 'NEED.empty', 'NEED.beyond', 'NEED.lacking'],
    value: (st, c) => {
      const r = c.n * c.good.quantum * c.good.rations;
      if (r === 0) return 0;
      const hh = c.hh,
        need = dailyNeed(st, hh),
        held = foodHeld(hh, st);
      if (!(need > 0)) return NEED.beyond * r;
      const days = toHarvest(st.t),
        buffer = hh.holder !== null ? st.pawns[hh.holder].buffer : HELP.bufferDays[1];
      const reach = reserved(st, hh, 'grain') + (days + buffer) * need,
        ample = Math.max(reach, NEED.beyondYears * YEAR_DAYS * need);
      const worth = stockWorth(held + r, reach, ample) - stockWorth(held, reach, ample);
      if (c.good.source === null) return worth;
      const fifth = NEED.lackingShare * days * need,
        src = sourceHeld(st, hh, c.good.source);
      const lo = Math.max(0, Math.min(src, src + r)),
        hi = Math.min(fifth, Math.max(src, src + r)),
        filled = Math.max(0, hi - lo);
      return worth * (1 + ((NEED.lacking - 1) * filled) / Math.abs(r));
    },
  });
  // ---- the larder (VB-134): lots of stored food {kind, n (rations), until (game hours)}: the foods of rules FOODS eaten as they are ----
  function addFood(st, hh, kind, n, days) {
    if (n > 0) hh.larder.push({ kind, n, until: st.t + days * DAY });
  }
  function larderOf(hh, kind) {
    let s = 0;
    for (const l of hh.larder) s += !kind || l.kind === kind ? l.n : 0;
    return s;
  } // the review asks it hourly
  // Takes up to `want` rations from the larder, the lots that spoil first first; only those within `soon` hours of spoiling when soon is
  // given. Returns what it took.
  function takeFood(st, hh, want, soon = Infinity) {
    let got = 0;
    for (const l of [...hh.larder].sort((a, b) => a.until - b.until)) {
      if (got >= want || l.until - st.t > soon) break;
      const k = Math.min(l.n, want - got);
      l.n -= k;
      got += k;
    }
    hh.larder = hh.larder.filter((l) => l.n > 1e-9);
    return got;
  }
  // The groups a short meal is served in, one after the other, by the household's feedOrder: its children or its workers first and then
  // the rest, or everyone together. mem: its living members, as pawns.
  function feedGroups(st, hh, mem) {
    const order = st.cenv ? farmPractice(st, st.farmsteads[hh.farmstead]).feedOrder : 'equal';
    const worker = (p) => {
      const a = age(st, p);
      return a >= 14 && a < 60 && !p.retired;
    };
    const first = order === 'children' ? (p) => age(st, p) < 14 : order === 'workers' ? worker : null;
    return first ? [mem.filter(first), mem.filter((p) => !first(p))] : [mem];
  }
  // The members a short meal reaches last, as pawn ids: the feed order's last group with anyone in it. Reads only.
  function servedLast(st, hh) {
    const groups = feedGroups(
      st,
      hh,
      hh.members.map((id) => st.pawns[id]).filter((p) => p.died === null),
    ).filter((g) => g.length);
    return groups.length ? groups[groups.length - 1].map((p) => p.id) : [];
  }
  // Feeds a household for the day: larder food about to spoil first, then meals (VB-119: people eat meals), and with no meals fresh food
  // eaten uncooked (FOODS raw), then grain above the seed reserve eaten uncooked at ECON.rawGrain, then the rest of the larder, then, as the
  // last step and for what the day lacks, the seed below the reserve (VB-282; the fields it cannot sow go unsown), uncooked too; when that
  // is not enough, what there is goes by the household's feedOrder, in groups served one after the other. Amounts below are in rations of
  // need; grain is taken at rawGrain a ration.
  function feedHousehold(st, hh) {
    const E = st.ECON,
      mem = hh.members.map((id) => st.pawns[id]).filter((p) => p.died === null);
    const need = new Map(mem.map((p) => [p, age(st, p) >= 14 ? E.ration.adult : E.ration.child])),
      total = [...need.values()].reduce((s, n) => s + n, 0);
    const eaten = new Map(mem.map((p) => [p, need.get(p)]));
    if (hh.fresh.length) Pot.settle(st, hh);
    const early = hh.larder.length ? takeFood(st, hh, total, HERD.eatSoonDays * DAY) : 0,
      rest = total - early;
    const R = E.rawGrain,
      wild = hh.fresh.length ? Pot.freshHeld(st, hh, null, true) : 0;
    const spare = Math.max(0, grainOf(hh) - reserved(st, hh, 'grain')),
      avail = hh.meals + wild + spare / R; // meals, then uncooked food
    const late = avail < rest && hh.larder.length ? takeFood(st, hh, rest - avail) : 0;
    const seed = (grainOf(hh) - spare) / R,
      lack = rest - late - avail,
      dip = lack > 1e-9 && seed > 0 ? Math.min(lack, seed) : 0; // the seed the meal needs
    if (avail + dip >= rest - late) {
      // the larder's pieces may sum past what was asked by a rounding error, so what is left to eat is never below 0 (populous 3, year 15)
      const left = Math.max(0, rest - late),
        cooked = Math.min(hh.meals, left),
        uncooked = Math.min(wild, left - cooked);
      const grain = Math.max(0, left - cooked - uncooked) * R;
      Stores.take(st, hh, 'meals', cooked, 'meal');
      if (uncooked > 0) Pot.takeFresh(st, hh, uncooked, 'meal', null, true);
      if (grain > 0) Stores.takeSpare(st, hh, Math.min(grain, spare), 'raw'); // Math.min: the same amount as ever when no seed is eaten
      if (dip > 0) eatSeed(st, hh, grain - Math.min(grain, spare));
    } else {
      let left = avail + early + late;
      for (const group of feedGroups(st, hh, mem)) {
        const gneed = group.reduce((s, p) => s + need.get(p), 0),
          give = Math.min(left, gneed);
        for (const p of group) eaten.set(p, gneed > 0 ? (need.get(p) * give) / gneed : 0);
        left -= give;
      }
      Stores.take(st, hh, 'meals', hh.meals, 'meal');
      if (wild > 0) Pot.takeFresh(st, hh, wild, 'meal', null, true);
      if (spare > 0) Stores.takeSpare(st, hh, spare, 'raw');
      hh.hungryDays++;
    }
    let sum = 0;
    for (const p of mem) {
      p.hungerLog.push(1 - eaten.get(p) / need.get(p));
      if (p.hungerLog.length > HUNGER.days) p.hungerLog.shift();
      p.hunger = p.hungerLog.reduce((s, x) => s + x, 0) / HUNGER.days;
      sum += p.hunger;
      updateHealth(st, p, eaten.get(p) >= need.get(p));
    }
    hh.hunger = mem.length ? sum / mem.length : 0;
  }
  // The seed a meal eats (VB-282): taken through the stores with its own reason, and the fields it leaves unsown told once a season at most.
  function eatSeed(st, hh, n) {
    Stores.take(st, hh, 'grain', n, 'seedMeal'); // of each crop as it is held (VB-352 orders it)
    const season = Math.floor(st.t / (SEASON_DAYS * DAY)),
      f = st.farmsteads[hh.farmstead];
    if (hh.seedSeason === season) return;
    hh.seedSeason = season;
    const short = Math.max(0, Math.ceil((reserved(st, hh, 'grain') - grainOf(hh)) / CROPS.barley.seed - 1e-9));
    if (short)
      log(st, `${f.name} eats the seed it kept back: ${short === 1 ? 'a field' : short + ' fields'} may go unsown.`, {
        kind: 'seedEaten',
        n: short,
        ...atFarm(f),
      });
  }
  // Health after the meal: hunger drains it (faster for the very young and the old), a full meal restores some.
  function updateHealth(st, p, fed) {
    const a = age(st, p);
    if (p.hunger > 0) p.health -= HEALTH.drain * p.hunger * p.hunger * (a < 5 || a >= 60 ? HEALTH.frail : 1);
    if (fed) p.health += HEALTH.recover;
    p.health = Math.max(0, Math.min(100, p.health));
  }
  // Grain in the barn spoils a little each day (balance review): ECON.storeLoss a year of the first year's need held, of the second, and of the
  // rest, so a good farm's store levels off at a year or two of need instead of growing for ever. hh.spoilt counts the rations lost.
  function spoilGrain(st, hh) {
    const year = dailyNeed(st, hh) * YEAR_DAYS,
      L = st.ECON.storeLoss,
      g = grainOf(hh);
    if (!(g > 0)) return;
    const parts = [Math.min(g, year), Math.min(Math.max(0, g - year), year), Math.max(0, g - 2 * year)];
    const lost = parts.reduce((s, x, k) => s + x * (1 - Math.pow(1 - L[k], 1 / YEAR_DAYS)), 0);
    Stores.spoil(st, hh, lost);
  }
  return {
    NEED,
    toHarvest,
    foodHeld,
    daysOfFood,
    stockWorth,
    feedHousehold,
    feedGroups,
    servedLast,
    dailyNeed,
    seedNeed,
    seedPer,
    seedReserve,
    floorOf,
    updateHealth,
    addFood,
    larderOf,
    takeFood,
    spoilGrain,
  };
})();
