// @sys sim/hunger: feeding households, the daily hearth and the effects of food and shelter on pawns' health
VB['sim/hunger'] = (() => {
  const { owedBy, tiredHealth } = VB['sim/sleep'];
  const { fireOf } = VB['sim/house'];
  const { HUNGER, HEALTH, ILLNESS, HERD, HELP, DAY, YEAR, YEAR_DAYS, PEAT, BUILD, GATHERING } = VB['sim/rules'],
    { CROPS, ROTATIONS } = VB['sim/crops'];
  const { age, farmPractice } = VB['sim/records'];
  const Stores = VB['sim/stores'],
    Pot = VB['sim/pot'],
    { hungryDay, act } = VB['sim/traits'];
  const { takeFood } = VB['sim/larder'];
  const { dayLoss, GRAIN } = VB['sim/goods'];
  const Rules = VB['sim/registry'],
    { emit } = VB['sim/events'];
  const Thirst = VB['sim/thirst'];
  // The seed kept for a field: the standing plan's target (from its culture's template, sim/plans; VB-252), the crop's seed (barley's) before it has one.
  function seedPer(st, hh) {
    const plan = st.plans && st.plans.households.get(hh.id);
    return (plan && plan.targets && plan.targets.seed) ?? CROPS.barley.seed;
  }
  // The seed the household's fields not yet sown this year need: the standing plan's reservation of grain (sim/plans reserves it at each
  // review; sim/stores counts it with this rule when it is read, so a field sown since counts at once); a land project holds back its new
  // field's seed itself (sim/projects, VB-123). Only the day's meal reaches below the seed, and only when the day would otherwise fall short
  // (feedHousehold; Kim, 10 November: the hungry household eats its seed). By crop (VB-347, VB-350): the fields its rotation sows with it
  // next (sownNext: a fallow field's next sown course); without one, every field to be sown. A field's seed is the plan's for barley
  // (seedPer), the crop's own for another. And a crop of the farm's rotation that no field bears or sows next (between its harvest and
  // its field's turn: two fields in three courses) keeps a field's seed, so that it is lost only by hunger (design.md, Seed, What is
  // eaten first). A village's (VB-100): its common fields', a crop's seed each.
  function seedNeed(st, hh, crop) {
    const village = !('farmstead' in hh),
      fields = village ? hh.commonFields || [] : st.farmsteads[hh.farmstead].fields;
    let barley = 0,
      other = 0;
    for (const fd of fields) {
      if (fd.stage !== 'stubble' && fd.stage !== 'plowed') continue;
      const k = sownNext(fd);
      if (k === null || (crop !== undefined && k !== crop)) continue;
      if (k === 'barley') barley++;
      else other += CROPS[k].seed;
    }
    const R = !village && fields.length ? ROTATIONS[fields[0].rotation].courses : null;
    if (R && R.length > 1)
      for (let i = 0; i < R.length; i++) {
        const k = R[i];
        if (!(CROPS[k].seed > 0) || (crop !== undefined && k !== crop) || R.indexOf(k) !== i || kept(fields, k))
          continue;
        if (k === 'barley') barley++;
        else other += CROPS[k].seed;
      }
    const keeps = village ? null : st.farmsteads[hh.farmstead].keeps; // crops the farm holds a field's seed of, not sown (VB-353)
    if (keeps)
      for (const k of keeps)
        if ((crop === undefined || k === crop) && !(R && R.includes(k)) && !kept(fields, k)) other += CROPS[k].seed;
    return (barley ? barley * (village ? CROPS.barley.seed : seedPer(st, hh)) : 0) + other;
  }
  // Does a field bear crop k now, or sow it next?
  function kept(fields, k) {
    for (const fd of fields) {
      const s = fd.stage;
      if (s === 'stubble' || s === 'plowed' ? sownNext(fd) === k : fd.crop === k) return true;
    }
    return false;
  }
  // The crop a field is sown with next (VB-350): its course's, or after a fallow course the next sown course of its rotation; null for none.
  function sownNext(fd) {
    if (CROPS[fd.crop].seed > 0) return fd.crop;
    const R = fd.rotation === undefined ? null : ROTATIONS[fd.rotation].courses;
    if (!R) return null;
    for (let i = 1; i <= R.length; i++) {
      const k = R[(fd.step + i) % R.length];
      if (CROPS[k].seed > 0) return k;
    }
    return null;
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
  // eaten uncooked (FOODS raw), then flour (VB-009) and grain above the seed reserve eaten uncooked (a ration of either feeds
  // ECON.uncooked, VB-327), then the
  // rest of the larder, then, as the last step and for what the day lacks, the seed below the reserve (VB-282; the fields it cannot sow go
  // unsown), uncooked too; when that is not enough, what there is goes by the household's feedOrder, in groups served one after the other.
  // Amounts below are in rations of need; grain is taken at 1 / uncooked a ration. Given the day's season, the day's fire burns first
  // (warmHouse), and its cold reaches each member's health; without it (a meal alone, as tests feed one) the day is warm.
  // A pawn away from home (VB-287, VB-783: on the road or lodging; sim/away's agent.away) eats what it carries, not its household's meal.
  // A pawn who ate at a feast in the last day (VB-458; sim/occasions writes pawn.feast) has had the day's meal: it is not fed again.
  const feasted = (st, p) => p.feast !== undefined && st.t - p.feast.t < DAY;
  // `roof` 'none': the household sleeps under the open sky tonight (VB-1544, sim/building roofless, which the clock asks).
  function feedHousehold(st, hh, season, roof) {
    const E = st.ECON;
    let mem = hh.members.map((id) => st.pawns[id]).filter((p) => p.died === null && st.agents[p.id].away === undefined);
    const fed = mem.some((p) => feasted(st, p)) ? mem.filter((p) => feasted(st, p)) : null;
    if (fed) mem = mem.filter((p) => !feasted(st, p));
    const cold = season === undefined ? 0 : warmHouse(st, hh, season, roof),
      // a house with nobody at home today has no dry day (VB-1585): nothing was to be cooked there, and nobody was there to fetch
      // and it is dry by the part of its people the day's loads did not cover (VB-1586)
      people = mem.length + (fed ? fed.length : 0),
      dry = season === undefined ? 0 : dryHouse(st, hh, people),
      // the day's water was a marsh's (hh.marshDay, sim/chores): poor water, which costs those it covers HEALTH.marsh (VB-1582)
      poor = season !== undefined && dry < 1 && hh.marshDay >= Math.floor(st.t / DAY) - 1;
    const need = new Map(mem.map((p) => [p, age(st, p) >= 14 ? E.ration.adult : E.ration.child])),
      total = [...need.values()].reduce((s, n) => s + n, 0);
    const eaten = new Map(mem.map((p) => [p, need.get(p)]));
    if (hh.fresh.length) Pot.settle(st, hh);
    const by = hh.larder.length ? {} : null; // the larder's takes by food, for the ledger (VB-683)
    const early = by ? takeFood(st, hh, total, HERD.eatSoonDays * DAY, undefined, by) : 0,
      rest = total - early;
    const R = 1 / E.uncooked,
      wild = hh.fresh.length ? Pot.freshHeld(st, hh, null, true) : 0;
    const spare = Math.max(0, grainOf(hh) - reserved(st, hh, 'grain')),
      flour = hh.flour,
      avail = hh.meals + wild + (flour + spare) / R; // meals, then uncooked food
    const late = avail < rest && hh.larder.length ? takeFood(st, hh, rest - avail, Infinity, undefined, by) : 0;
    if (by) for (const k in by) Stores.record(st, hh, k, -by[k], 'meal');
    const seed = (grainOf(hh) - spare) / R,
      lack = rest - late - avail,
      dip = lack > 1e-9 && seed > 0 ? Math.min(lack, seed) : 0; // the seed the meal needs
    if (avail + dip >= rest - late) {
      // the larder's pieces may sum past what was asked by a rounding error, so what is left to eat is never below 0 (populous 3, year 15)
      const left = Math.max(0, rest - late),
        cooked = Math.min(hh.meals, left),
        uncooked = Math.min(wild, left - cooked);
      const raw = Math.max(0, left - cooked - uncooked) * R,
        fl = Math.min(raw, flour),
        grain = raw - fl;
      Stores.take(st, hh, 'meals', cooked, 'meal');
      if (uncooked > 0) Pot.takeFresh(st, hh, uncooked, 'meal', null, true);
      if (fl > 0) Stores.take(st, hh, 'flour', fl, 'raw');
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
      if (flour > 0) Stores.take(st, hh, 'flour', flour, 'raw');
      if (spare > 0) Stores.takeSpare(st, hh, spare, 'raw');
      hh.hungryDays++;
    }
    // the dry day's health is the pawn's own (VB-1585): with the day's water in, each drank at the meal; with none, who drank at a
    // source that day loses nothing, and who did not is thirsty (sim/thirst dayEnd); marsh water a pawn drank by itself is poor too
    // On a day whose loads covered a part of the people (VB-1586) the water goes first to those who do not go for their own drink (a
    // child under 7, the bedridden), then to who is thirsty, then by the members' order: who goes without can go to a source
    let given = null;
    if (dry > 0 && dry < 1) {
      const all = fed ? [...mem, ...fed] : mem;
      given = new Set();
      for (const first of [(p) => !Thirst.goes(st, p), (p) => Thirst.thirsty(st, p), () => true])
        for (const p of all) if (given.size < hh.waterFor && first(p)) given.add(p);
    }
    const drink = (p) => {
      const [d, m] = season === undefined ? [0, false] : Thirst.dayEnd(st, p, given ? given.has(p) : !dry);
      return [d, (poor && (!given || given.has(p))) || m];
    };
    let sum = 0;
    for (const p of mem) {
      ate(st, p, eaten.get(p), need.get(p), cold, ...drink(p));
      hungryDay(p); // a child's hungry days, for its traits at 15 (sim/traits, VB-519)
      sum += p.hunger;
    }
    if (fed)
      for (const p of fed) {
        const n = rationOf(st, p);
        ate(st, p, n, n, cold, ...drink(p)); // fed at the feast; the night's cold and a day without a drink still reach it at home
        hungryDay(p);
        sum += p.hunger;
      }
    const n = mem.length + (fed ? fed.length : 0);
    hh.hunger = n ? sum / n : 0;
  }
  // The day's fire (VB-327; design.md, Fuel): the hearth burns the season's use (ECON.woodUse), or what the pile holds. A household whose pile
  // does not cover it is cold that day by the part it lacked times the season's use over winter's, which is the wood it lacked over winter's
  // use: a summer day without wood barely counts. hh.cold is the mean of the last HUNGER.days days' cold (hh.coldLog), as a pawn's hunger is
  // of its hungerLog. Returns the day's cold. One comparison a live household a day, in the pass that burns the wood.
  // A household with no roof yet (`roof` 'none'; sim/building roofless, VB-1544: a lone settler before its booth stands) lights no hearth:
  // its day is the open sky's cold (nightCost's), and it burns nothing; that cold is not the hearth's, and goes into no log (hh.cold
  // ranks the wood).
  // A timber house's hearth burns ROOM.timberFire of a cottage's (sim/house fireOf, VB-1664); its cold is still the wood lacked over
  // a cottage's winter use.
  function warmHouse(st, hh, season, roof) {
    if (roof === 'none') return nightCost(st, season, 'none')[0];
    const use = st.ECON.woodUse,
      want = use[season] * fireOf(st, hh),
      burnt = Stores.take(st, hh, 'wood', want, 'burn'); // the day's fire, what the pile holds of it (VB-328: through the stores)
    let lack = want - burnt;
    if (lack > 1e-9 && hh.peat > 0) {
      // then dry peat (VB-367): a unit burns as PEAT.worth of wood
      const dry = Stores.peatDry(st, hh);
      if (dry > 0) lack -= Stores.take(st, hh, 'peat', Math.min(dry, lack / PEAT.worth), 'burn') * PEAT.worth;
    }
    const day = lack > 1e-9 ? lack / use[3] : 0;
    if (day > 0 || hh.cold > 0) {
      hh.coldLog.push(day);
      if (hh.coldLog.length > HUNGER.days) hh.coldLog.shift();
      hh.cold = hh.coldLog.reduce((s, x) => s + x, 0) / HUNGER.days;
      if (!hh.coldLog.some((x) => x > 0)) {
        hh.coldLog.length = 0; // warm for HUNGER.days days: the log empties, and a warm house's day is the one comparison
        hh.cold = 0;
      }
    }
    return day;
  }
  // A day without water (VB-331): the day that ends, if its water was not fetched (hh.waterDay behind it), costs each member HEALTH.dry and the
  // meal restores nothing; a house with nobody at home (`people` 0) has no dry day. With water in for a part of its `people` at home
  // (hh.waterFor, the people the day's loads covered: VB-1586) the day is dry by the part not covered.
  // hh.dry is the mean of the last HUNGER.days days (hh.dryLog, 1 a dry day, a part-dry day its part) as hh.cold is. Returns the day's
  // part: 1 on a dry day. One comparison a live household a day.
  function dryHouse(st, hh, people = 1) {
    const ended = Math.floor(st.t / DAY) - 1,
      day =
        people <= 0 || hh.waterDay > ended
          ? 0
          : hh.waterDay < ended
            ? 1
            : Math.max(0, people - (hh.waterFor ?? people)) / people;
    if (day > 0 || hh.dry > 0) {
      hh.dryLog.push(day);
      if (hh.dryLog.length > HUNGER.days) hh.dryLog.shift();
      hh.dry = hh.dryLog.reduce((s, x) => s + x, 0) / HUNGER.days;
      if (!hh.dryLog.some((x) => x > 0)) {
        hh.dryLog.length = 0;
        hh.dry = 0;
      }
    }
    return day;
  }
  // The day's cold and wet of a night away (VB-785), by the house's rule read for the stay's roof: none, as a house with no wood and no
  // roof; a booth, as a heated house when its wood covers the day's fire (`fire`, the booth's, burnt once a day for all in it), else an
  // unheated one; a guest's, its host's today (the last of the host's logs, which its meal wrote before); a barn's, dry and GATHERING.barnCold
  // of the open sky's cold. Returns [cold, dry]. A booth's water is not the roof's: its day's fetch (sim/building, VB-1601), which
  // sim/away reads for each who sleeps there.
  function nightCost(st, season, roof, host, fire) {
    const use = st.ECON.woodUse;
    if (roof === 'house' && host && !host.dissolved) {
      const c = host.coldLog.length ? host.coldLog[host.coldLog.length - 1] : 0;
      return [c, host.dryLog.length ? host.dryLog[host.dryLog.length - 1] : 0];
    }
    if (roof === 'booth') return [Math.max(0, use[season] - fire) / use[3], 0];
    if (roof === 'barn') return [(GATHERING.barnCold * use[season]) / use[3], 0]; // a guest in a barn (VB-295): dry, the beasts' warmth

    return [use[season] / use[3], 1];
  }
  // The day's meal of pawn p: `eaten` of its `need` rations, into its hunger log, its hunger and its health.
  function ate(st, p, eaten, need, cold = 0, dry = 0, poor = false) {
    p.hungerLog.push(1 - eaten / need);
    if (p.hungerLog.length > HUNGER.days) p.hungerLog.shift();
    p.hunger = p.hungerLog.reduce((s, x) => s + x, 0) / HUNGER.days;
    updateHealth(st, p, eaten >= need, cold, dry, poor);
  }
  // A pawn's day's need in rations.
  const rationOf = (st, p) => (age(st, p) >= 14 ? st.ECON.ration.adult : st.ECON.ration.child);
  // The seed a meal eats (VB-282): taken through the stores with its own reason, and the fields it leaves unsown told once a season at most
  // (sim/pot, which the cook's seed tells too, VB-388).
  function eatSeed(st, hh, n) {
    Stores.take(st, hh, 'grain', n, 'seedMeal', undefined, 'seedLast'); // the crop with most seed first, each crop's last field last (VB-352)
    Pot.seedTold(st, hh);
  }
  // Health after the meal: hunger drains it, and the day's cold in the house (VB-327), both faster for the very young and the old; a full meal
  // restores some on a warm day, nothing on a cold one; a dry day costs HEALTH.dry and restores nothing, a day of marsh water HEALTH.marsh
  // (VB-1582). An illness running its course (pawn.ill, sim/deaths; VB-1118) takes ILLNESS.fall
  // over its days (ILLNESS.passing of it for one that passes, VB-1246), and nothing is restored while it runs. The played pawn's day is
  // told to sim/player (event 'health': what moved it); its sleep owed, a whole night or more, costs health too (VB-1643).
  function updateHealth(st, p, fed, cold = 0, dry = 0, poor = false) {
    const a = age(st, p),
      frail = a < 5 || a >= 60 ? HEALTH.frail : 1,
      before = p.health;
    const hungry = p.hunger > 0 ? HEALTH.drain * p.hunger * p.hunger * frail : 0,
      chill = cold > 0 ? HEALTH.cold * cold * frail : 0,
      damp = dry > 0 ? HEALTH.dry * frail : poor ? HEALTH.marsh * frail : 0, // marsh water: the meal is cooked and restores (VB-1582)
      ill =
        p.ill === undefined
          ? 0
          : ((p.ill.passes ? ILLNESS.passing : 1) * ILLNESS.fall * DAY) / (p.ill.until - p.ill.from),
      tired = tiredHealth(owedBy(st, p.id)), // the pawn's sleep owed, a whole night or more (sim/sleep, VB-1643, VB-1645)
      rest = cold <= 0 && dry <= 0 && fed && !ill ? HEALTH.recover * act(st, p.id, 'body', 'recover') : 0; // 2.5 to 3.5 by body (VB-520)
    p.health = Math.max(0, Math.min(100, p.health - hungry - chill - damp - ill - tired + rest));
    if (st.player && st.player.pawn === p.id)
      emit(st, 'health', {
        pawn: p.id,
        before,
        after: p.health,
        hungerLevel: p.hunger,
        hunger: hungry,
        cold: chill,
        damp,
        ill,
        tired,
        rest,
      });
  }
  // What a household's farm loses to spoilage, as a share of a farm without a barn: BUILD.barn.loss with one (VB-255; farmstead.barn, sim/building).
  function barnLoss(st, hh) {
    const f = hh.farmstead === null ? null : st.farmsteads[hh.farmstead];
    return f && f.barn ? BUILD.barn.loss : 1;
  }
  // Grain in the barn spoils a little each day (balance review): by grain's keeping (sim/goods), its tiers a year of need held each, so a
  // good farm's store levels off at a year or two of need instead of growing for ever. hh.spoilt counts the rations lost.
  function spoilGrain(st, hh) {
    const g = grainOf(hh);
    if (!(g > 0)) return;
    Stores.spoil(st, hh, dayLoss(st, GRAIN, g, dailyNeed(st, hh) * YEAR_DAYS) * barnLoss(st, hh));
  }
  // The grain the village store lacks of its target (VB-457; HELP.storeTarget years of its members' need), 0 at or above it.
  function storeRoom(st, v) {
    let need = 0;
    for (const id of v.farmsteads) {
      const f = st.farmsteads[id];
      if (f.household !== null) need += dailyNeed(st, st.households[f.household]);
    }
    return Math.max(0, HELP.storeTarget * need * YEAR_DAYS - Stores.grainOf(v));
  }
  // The household's spare food in days of its need: grain above the seed reserve, cooked meals and fresh food (sim/pot, VB-119).
  const spareDays = (st, hh) => {
    const need = dailyNeed(st, hh);
    return need > 0 ? Pot.spareFood(st, hh) / need : Infinity;
  };
  // The urgency of the work that brings food in (fishing, gathering, hunting): fishCalm while spare food covers fishCalmDays of need or
  // more, rising in a line to fishLean at none; and under needDays, the household's need, rising in a line to `need` at none (VB-1549),
  // whichever is higher. A line in the days of food, so no threshold to hold with hysteresis.
  const spareUrgency = (st, j, U) => {
    const d = spareDays(st, st.households[j.farm.household]),
      lean = d >= U.fishCalmDays ? U.fishCalm : U.fishLean - ((U.fishLean - U.fishCalm) * d) / U.fishCalmDays;
    return d >= U.needDays ? lean : Math.max(lean, U.need * (1 - d / U.needDays));
  };
  return {
    spareDays,
    spareUrgency,
    storeRoom,
    feedHousehold,
    ate,
    nightCost,
    rationOf,
    feedGroups,
    servedLast,
    dailyNeed,
    seedNeed,
    sownNext,
    seedPer,
    seedReserve,
    floorOf,
    updateHealth,
    spoilGrain,
  };
})();
