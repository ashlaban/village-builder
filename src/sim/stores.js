// @sys sim/stores: food quantities, paid stakes, movements and three-year household and village ledgers, routine movements as yearly totals;
// reservations, grain by crop, a good by kind (the stone heap by rock, VB-733) and ale brewed, poured and spoiling (VB-305)
VB['sim/stores'] = (() => {
  const { DAY, YEAR, YEAR_DAYS, TICKS, FOODS, BREW, cal } = VB['sim/rules'],
    { MATCH } = VB['sim/roles'],
    { CROPS } = VB['sim/crops'];
  const { addFood, takeFood } = VB['sim/larder'];
  const WOOD_LOW = MATCH.urgency.woodLow;
  const { goodOf, dayLoss, keepsDays, GRAIN, CROP_LIST, CROP_GOOD, GOOD_CROP, isGrain, grainGood } = VB['sim/goods'],
    { kindRow, baseOf, kindIn } = VB['sim/goods'];
  const STAKE_CROP = 'barley';
  const { emit } = VB['sim/events'],
    Projects = VB['sim/projects'],
    Yields = VB['sim/yields'];
  const KINDS = [
    'harvest',
    'gift',
    'keep',
    'meat',
    'milk',
    'butter',
    'seed',
    'meal',
    'seedMeal',
    'cooking',
    'spoilage',
    'share',
    'handingOn',
    'provisions',
    'thresh',
    'catch',
    'gathering',
    'brew',
    'pour',
  ];
  KINDS.push('feast'); // VB-458: the food a host lays out at a wedding or a funeral ale, eaten there by those who came (sim/occasions)
  KINDS.push('wage'); // VB-637: a servant's wage, paid from its master's grain into its stake (sim/service)
  KINDS.push('dig'); // loads of clay and bog iron ore dug into a household's store (VB-359, sim/dig)
  // VB-204: routine kinds (95% of movements) add to a yearly total per holder, kind and good instead of writing an entry each.
  const ROUTINE = ['meal', 'seedMeal', 'cooking', 'spoilage', 'thresh', 'milk', 'butter', 'catch', 'gathering'];
  // VB-683: fresh meat salted in the larder, out of 'meat' into 'salt meat' (sim/byre), a routine total; VB-700: the salt it took, and
  // the meat it had no salt for smoked into 'smoked meat'
  KINDS.push('salting');
  ROUTINE.push('salting');
  // VB-328: the woodpile, in loads: a firewood trip, the day's burning (routine), a plot's wood, timber left over, a new household's first wood.
  KINDS.push('firewood', 'burn', 'plot', 'timber', 'start');
  ROUTINE.push('firewood', 'burn');
  // VB-332: the stone heap, in loads of 25 stones: cleared from a field or meadow, picked, quarried; taken by a stone foundation.
  KINDS.push('clear', 'pick', 'quarry', 'foundation');
  KINDS.push('well'); // VB-058: a load carried from the heap to the village's well (sim/green)
  // VB-123: what a project plan's step spends, taken from the store when the step is done (sim/projects).
  KINDS.push('build');
  // VB-300: a catch hung on the drying rack (sim/drying), out of the rack's store into the larder; VB-119: 'raw', grain eaten uncooked (sim/hunger)
  KINDS.push('drying', 'raw');
  // VB-287, VB-783: the pack given to a pawn who goes away from home, on a journey or to lodge (sim/away), and what it carried back into its
  // home's meals
  KINDS.push('away');
  KINDS.push('fair'); // VB-302: a dealer's load, packed from the store for the fair and put back with what it got there (sim/fair)
  ROUTINE.push('drying', 'raw');
  // VB-139: a roe deer's meat, brought home from a hunt (sim/deer), folded as the catch is.
  KINDS.push('hunt');
  // VB-709: the milk a crowded pasture cost (sim/byre), a yearly total only, never a movement of goods
  KINDS.push('milkbite');
  ROUTINE.push('milkbite');
  ROUTINE.push('hunt');
  // VB-009: grain ground to flour on the hand quern (routine), and a load of stone off the heap for a new quern (sim/quern)
  KINDS.push('grind', 'quern');
  ROUTINE.push('grind');
  // VB-301: a barrel of tar burnt at the household's pit, and one laid on its house or its boat (sim/tar)
  KINDS.push('tarburn', 'tarring');
  // VB-700: salt boiled at a spring and carried home (sim/saltpan); it is used up by the salting (the reason 'salting')
  KINDS.push('saltboil');
  // VB-701: a bloom smelted at the household's pit, out of bog ore and firewood, and the iron a mending of its tools takes (sim/smelting)
  KINDS.push('smelt', 'mendtools');
  // The calendar year (as cal(hour).year) of the hour the clock is working through (sim/clock, st.tick): midnight's work belongs to the day it starts.
  const yearNow = (st) => Math.floor(st.tick / (YEAR * TICKS)) + 1;
  // Adds to the year's total; this year's totals are the last ones, so the search stops at the first earlier year.
  function fold(holder, year, kind, good, n) {
    const T = holder.totals;
    for (let i = T.length - 1; i >= 0 && T[i].year === year; i--) {
      const x = T[i];
      if (x.kind === kind && x.good === good) {
        x.n += n;
        x.count++;
        return;
      }
    }
    T.push({ year, kind, good, n, count: 1 });
  }
  function amount(n) {
    if (!Number.isFinite(n) || n < 0) throw new Error(`stores: invalid amount ${n}`);
  }
  function type(holder) {
    if (!holder || holder.dissolved) throw new Error('stores: missing or dissolved holder');
    // A pawn is told by `given` (a person on record has it, no other holder does); anything else is refused.
    if ('farmstead' in holder) return 'household';
    if ('center' in holder) return 'village';
    if ('given' in holder) return 'pawn';
    throw new Error('stores: not a holder');
  }
  function villageEntry(v, entry) {
    if (!v.ledger) v.ledger = [];
    v.ledger.push(entry);
  }
  // A movement of nothing is not recorded (VB-239): no ledger entry or yearly total moves 0.
  function record(st, holder, good, n, why, kind = type(holder)) {
    amount(Math.abs(n));
    if (n === 0) return;
    if (good !== GRAIN && GOOD_CROP[good] !== undefined)
      good = GRAIN; // the ledger counts grain whatever its crop
    else if (good.indexOf('/') > 0) good = baseOf(good); // and a good of kinds whatever its kind (VB-733)
    const detail = typeof why === 'string' ? { kind: why } : why;
    if (!detail || !KINDS.includes(detail.kind)) throw new Error('stores: unknown reason');
    const hh = kind === 'pawn' ? st.households[holder.household] : holder;
    if (kind === 'household') Yields.book(holder, good, n, detail); // the head's remembered yield of each source (VB-767)
    if (hh && kind !== 'pawn' && ROUTINE.includes(detail.kind)) fold(hh, yearNow(st), detail.kind, good, n);
    else if (hh) {
      const entry = { ...detail, t: st.t, n, good, ...(kind === 'pawn' ? { pawn: holder.id, stake: true } : {}) };
      if (kind === 'village') villageEntry(holder, entry);
      else {
        if (!hh.ledger) hh.ledger = [];
        hh.ledger.push(entry);
      }
    }
  }
  function field(holder, good, kind = type(holder)) {
    if (isGrain(good)) return kind === 'pawn' ? 'stake' : GRAIN;
    if (kind === 'household' && good === 'meals') return good;
    if (kind === 'household' && good === 'flour') return good; // ground on the quern (VB-009, sim/quern)
    if (kind === 'household' && good === 'wood') return good; // the woodpile (VB-328)
    if (kind === 'household' && (good === 'stone' || baseOf(good) === 'stone')) return 'stone'; // the stone heap (VB-332), by rock (VB-733)
    if (kind === 'household' && good === 'peat') return good; // the peat stack (VB-367)
    if (kind === 'household' && good === 'tar') return good; // barrels of tar (VB-301, sim/tar)
    if (kind === 'household' && good === 'hide') return 'hides'; // the hides of the hunt (VB-424, sim/deer)
    if (kind === 'household' && good === 'salt') return good; // salt boiled at a spring (VB-700, sim/saltpan)
    if (kind === 'household' && (good === 'iron' || good === 'clay' || good === 'bogOre')) return good; // blooms (VB-701); dug loads, taken by the smelting
    if (kind === 'household' && good === 'fish') return 'rack'; // the catch waiting by the drying rack (VB-300)
    throw new Error(`stores: ${kind} cannot hold ${good}`);
  }
  // ---- grain by crop (VB-347; design.md, Goods, recipes and facilities: goods in subtypes): a household's and a village's grain is
  // {[crop]: rations}, a crop of CROPS each, a row with seed (fallow is a course, not a grain; VB-348) (none held: no key, or 0). The good
  // 'grain/<crop>' is one crop's grain, 'grain' any crop's: a take of 'grain' falls on each crop in proportion to what is held of it
  // (takeSpare: to what is held of it above its reservation), and a put of 'grain' names its crops, as a take's `into` gave them. The
  // ledger counts grain as 'grain' whatever its crop. A pawn's stake is one number of no crop; it goes into a store as STAKE_CROP (VB-352
  // gives stakes and starts their crops).
  // @state household.grain, village.grain: {[crop]: rations >= 0}, crops of CROPS; their sum, grainOf, is the grain the readers see
  // The grain a household or a village holds, of every crop or of one (VB-347): the one reader of the store's grain. Allocates nothing; the
  // crops are added in CROPS' order, so that grain of one crop is its number itself.
  function grainOf(holder, crop) {
    const g = holder.grain;
    if (crop !== undefined) return g[crop] || 0;
    let n = 0;
    for (let i = 0; i < CROP_LIST.length; i++) {
      const x = g[CROP_LIST[i]];
      if (x !== undefined) n += x;
    }
    return n;
  }
  // Grain by crop as a take's `into` gave it, or as a constructor names it: an object of crops of CROPS, each a number >= 0.
  const partsOk = (parts) =>
    !!parts &&
    typeof parts === 'object' &&
    Object.keys(parts).every((c) => CROP_GOOD[c] && parts[c] >= 0 && parts[c] < Infinity);
  const partsSum = (parts) => {
    let n = 0;
    for (const c of CROP_LIST) if (parts[c] !== undefined) n += parts[c];
    return n;
  };
  // Explicit writes keep the ownership scan aware of every stored quantity.
  const setStake = (p, n) => {
    p.stake = n;
  };
  const setHouseholdGrain = (hh, crop, n) => {
    hh.grain[crop] = n;
  };
  const setVillageGrain = (v, crop, n) => {
    v.grain[crop] = n;
  };
  const setGrain = (holder, crop, n) =>
    'center' in holder ? setVillageGrain(holder, crop, n) : setHouseholdGrain(holder, crop, n);
  const setPeat = (hh, n) => {
    hh.peat = n;
  };
  const setWood = (hh, n) => {
    hh.wood = n;
  };
  // ---- a good by kind (VB-733; design.md, The metals and the stones: Kind in state; principle 17): a store of a good with kinds is
  // {[kind]: n}, as grain is by crop (none held: no key, or 0). A put names the kind ('stone/granite'); a take of a kind takes it; a take of
  // the good, any kind, falls on the kind of least customary worth first (the registry's `cheapest`; D13: a head spends the common stone
  // and keeps the one with a use of its own). The ledger counts the good whatever its kind. Today the household's stone heap alone.
  // @state household.stone: {[rock]: loads >= 0}, rocks of the good 'stone' (sim/goods): the stone heap, a load of 25 stones (VB-332) by
  //   the rock it is of (VB-733); its sum, heldOf(hh, 'stone'), is what the foundation and the well read
  const setStone = (hh, kind, n) => {
    hh.stone[kind] = n;
  };
  // A save from before VB-733 held the heap as one number of no rock: it becomes granite, the commonest kind.
  function heapsLoaded(st) {
    for (const hh of st.households)
      if (typeof hh.stone === 'number') hh.stone = hh.stone > 0 ? { granite: hh.stone } : {};
  }
  // What a holder's single store holds of a good: of a good with kinds, of one kind ('stone/granite') or of all ('stone'). Grain is read by
  // grainOf. Allocates nothing.
  function heldOf(holder, good) {
    const k = field(holder, good);
    if (k !== 'stone') return holder[k] || 0;
    const store = holder.stone;
    if (good !== k) return store[kindIn(good)] || 0;
    let n = 0;
    for (const kind in store) n += store[kind];
    return n;
  }
  // Takes up to n of a good with kinds: of its kind, or of any, the least worth first.
  function takeKinds(holder, good, n) {
    const store = holder.stone; // the one store by kind (field: 'stone')
    if (good !== 'stone') {
      const kind = kindIn(good),
        got = Math.min(store[kind] || 0, n);
      if (got > 0) setStone(holder, kind, store[kind] - got);
      return got;
    }
    let got = 0;
    for (const kind of goodOf('stone').cheapest) {
      if (got >= n) break;
      const x = Math.min(store[kind] || 0, n - got);
      if (x > 0) setStone(holder, kind, store[kind] - x);
      got += x;
    }
    return got;
  }
  const setMeals = (hh, n) => {
    hh.meals = n;
  };
  // @state household.flour: rations of flour ground on the household's quern and not yet cooked (VB-009; sim/quern grinds, sim/pot cooks), 0 at the start
  const setFlour = (hh, n) => {
    hh.flour = n;
  };
  // @state household.rack: rations of fresh fish laid by the drying rack, waiting to be split and hung (VB-300; sim/drying), 0 at the start
  const setRack = (hh, n) => {
    hh.rack = n;
  };
  // @state household.tar: barrels of tar held (VB-301; burnt at the household's pit and laid on its house or boat, sim/tar), whole numbers, 0 at the start
  const setTar = (hh, n) => {
    hh.tar = n;
  };
  // @state household.hides: hides of roe deer held, whole numbers (VB-424; a kill gives one, sim/deer; wanted for shoes and harness), 0 at the start
  const setHides = (hh, n) => {
    hh.hides = n;
  };
  // @state household.salt: measures of salt held (VB-700; boiled at a spring, sim/saltpan, and used up by the salting, sim/byre; a measure
  //   weighs a ration of load), undefined (none) until its first boiling
  const setSalt = (hh, n) => {
    hh.salt = n;
  };
  // @state household.iron: blooms of iron held (VB-701; smelted at the pit, sim/smelting, and used up a tenth at a time by the mending of
  //   the household's tools), undefined (none) until its first smelting
  const setIron = (hh, n) => {
    hh.iron = n;
  };
  function set(holder, good, n, kind) {
    if (kind === 'pawn') setStake(holder, n);
    else if (good === 'wood') setWood(holder, n);
    else if (good === 'peat') setPeat(holder, n);
    else if (good === 'fish') setRack(holder, n);
    else if (good === 'tar') setTar(holder, n);
    else if (good === 'hide') setHides(holder, n);
    else if (good === 'salt') setSalt(holder, n);
    else if (good === 'iron') setIron(holder, n);
    else if (DUG.includes(good)) setDug(holder, good, n);
    else if (good === 'flour') setFlour(holder, n);
    else setMeals(holder, n);
  }
  // VB-249: a store crossing a target wakes its household's plan for a review (sim/plans reads and clears the flag, at most one such review
  // a day): the grain above the seed reserve running out or coming back, sheaves coming into an empty barn. The one call from the stores
  // to the plans is this flag.
  // @state plan.dirty: true when a store of the plan's household crossed a target since the plan's last review; set only here.
  function wake(st, hh) {
    const plan = st.plans && st.plans.households.get(hh.id);
    if (plan) plan.dirty = true;
  }
  function crossed(st, holder, kind, before) {
    if (kind !== 'household' || !st.plans) return;
    const r = reserved(st, holder, GRAIN);
    if (before > r !== grainOf(holder) > r) wake(st, holder);
  }
  // Puts n of a good. Grain: 'grain/<crop>' into its crop; 'grain' by `parts` ({[crop]: n}, summing to n: a take's `into`); a stake: any crop.
  function put(st, holder, good, n, why, parts) {
    amount(n);
    const kind = type(holder),
      k = field(holder, good, kind);
    if (k === GRAIN) {
      if (good === GRAIN && !(partsOk(parts) && Math.abs(partsSum(parts) - n) <= 1e-9 * Math.max(1, n))) {
        throw new Error('stores: grain is put by its crops');
      }
      const before = grainOf(holder);
      record(st, holder, good, n, why, kind);
      if (good !== GRAIN) setGrain(holder, GOOD_CROP[good], (holder.grain[GOOD_CROP[good]] || 0) + n);
      else for (const c of CROP_LIST) if (parts[c] > 0) setGrain(holder, c, (holder.grain[c] || 0) + parts[c]);
      crossed(st, holder, kind, before);
      return n;
    }
    if (k === 'stone') {
      const row = kindRow('stone', kindIn(good) || '');
      if (!row) throw new Error('stores: stone is put by its rock');
      record(st, holder, good, n, why, kind);
      setStone(holder, row.kind, (holder.stone[row.kind] || 0) + n);
      return n;
    }
    const before = holder[k] || 0;
    record(st, holder, good, n, why, kind);
    set(holder, good, before + n, kind);
    return n;
  }
  // Takes up to n of a good and says how much it got. Grain: 'grain/<crop>' from its crop, 'grain' from each crop in proportion to what is
  // held of it; `into`, when given, has the amounts by crop added (a pawn's stake gives STAKE_CROP).
  // `how` (a take of 'grain' only, VB-352): 'seedFirst' gives a field's seed of each crop above its reservation before the rest (a start in
  // life, settlers' provisions); 'seedLast' eats reserved seed the crop with most of it first, the last field's seed of each crop last of all.
  function take(st, holder, good, n, why, into, how) {
    amount(n);
    const kind = type(holder),
      k = field(holder, good, kind);
    if (k === GRAIN) return takeGrain(st, holder, good, n, why, into, kind, false, undefined, how);
    if (k === 'stone') {
      if (good !== k && !kindRow(k, kindIn(good))) throw new Error('stores: unknown rock ' + good);
      const got = takeKinds(holder, good, n);
      record(st, holder, good, -got, why, kind);
      if (got > 0) short(st, holder, kind, k, heldOf(holder, k));
      return got;
    }
    const before = holder[k] || 0,
      got = Math.min(before, n);
    record(st, holder, good, -got, why, kind);
    set(holder, good, before - got, kind);
    if (got > 0) short(st, holder, kind, good, holder[k]);
    // a woodpile that falls under the low mark wakes the head (VB-466: the day is allotted anew, and a hand may be called to the woods)
    if (kind === 'household' && good === 'wood' && before >= WOOD_LOW && holder[k] < WOOD_LOW) wake(st, holder);
    if (into && k === 'stake') into[STAKE_CROP] = (into[STAKE_CROP] || 0) + got;
    return got;
  }
  // Takes up to n of a household's unreserved grain, whatever its crop (the cook, the meal, the brewer): by what each crop holds above its reservation.
  // `skip`: a crop left out (the pot's grain is not its pulses, VB-349).
  function takeSpare(st, hh, n, why, into, skip) {
    amount(n);
    if (type(hh) !== 'household') throw new Error("stores: spare grain is a household's");
    return takeGrain(st, hh, GRAIN, n, why, into, 'household', true, skip);
  }
  function takeGrain(st, holder, good, n, why, into, kind, spare, skip, how) {
    const before = grainOf(holder);
    let got;
    if (good !== GRAIN) {
      const c = GOOD_CROP[good],
        x = holder.grain[c] || 0;
      got = Math.min(x, n);
      setGrain(holder, c, x - got);
      if (into) into[c] = (into[c] || 0) + got;
    } else {
      got = Math.min(before - (skip ? holder.grain[skip] || 0 : 0), n);
      if (how === 'seedFirst') seedFirst(st, holder, got, into);
      else if (how === 'seedLast') seedLast(holder, got, into);
      else split(st, holder, got, spare, into, skip);
    }
    record(st, holder, good, -got, why, kind);
    crossed(st, holder, kind, before);
    if (got > 0) short(st, holder, kind, GRAIN, grainOf(holder));
    return got;
  }
  // A crop's weight in a take of 'grain': what is held of it, or what is held above its reservation.
  const weight = (st, holder, c, spare, skip) => {
    const x = c === skip ? 0 : holder.grain[c] || 0; // a crop not held is not asked for its reservation
    return spare && x > 0 ? Math.max(0, x - reserved(st, holder, CROP_GOOD[c])) : x;
  };
  // Takes n (at most what is held) from the crops by their weights; the last crop with weight takes what is left, so that one crop gives
  // exactly n, and what the weights could not place is taken from the crops in order. Allocates nothing but `into`.
  function split(st, holder, n, spare, into, skip) {
    let total = 0,
      last = -1;
    for (let i = 0; i < CROP_LIST.length; i++) {
      const w = weight(st, holder, CROP_LIST[i], spare, skip);
      if (w > 0) {
        total += w;
        last = i;
      }
    }
    if (last < 0) {
      if (spare) split(st, holder, n, false, into, skip);
      return;
    }
    let left = n;
    for (let i = 0; i <= last; i++) {
      const c = CROP_LIST[i],
        w = weight(st, holder, c, spare, skip),
        x = holder.grain[c];
      if (w > 0) left -= takeCrop(holder, c, i === last ? Math.min(x, left) : Math.min(x, left, (n * w) / total), into);
    }
    for (let i = 0; i < CROP_LIST.length && left > 0; i++) {
      if (CROP_LIST[i] === skip) continue;
      left -= takeCrop(holder, CROP_LIST[i], Math.min(holder.grain[CROP_LIST[i]] || 0, left), into);
    }
  }
  // A field's seed of each crop held above its reservation, in the order of CROP_LIST, up to n; the rest by the crops' weights.
  function seedFirst(st, holder, n, into) {
    let left = n;
    for (const c of CROP_LIST) {
      const x = holder.grain[c] || 0;
      if (left > 0 && x > 0)
        left -= takeCrop(
          holder,
          c,
          Math.min(left, CROPS[c].seed, Math.max(0, x - reserved(st, holder, CROP_GOOD[c]))),
          into,
        );
    }
    if (left > 0) split(st, holder, left, false, into);
  }
  // Seed eaten in hunger: first what each crop holds above its last field's seed, the crop with most of it first, then the last fields' seed,
  // the crop with most first.
  function seedLast(holder, n, into) {
    let left = n;
    for (const keep of [true, false]) {
      const order = CROP_LIST.filter((c) => holder.grain[c] > 0).sort(
        (a, b) => over(holder, b, keep) - over(holder, a, keep) || (a < b ? -1 : 1),
      );
      for (const c of order) if (left > 0) left -= takeCrop(holder, c, Math.min(left, over(holder, c, keep)), into);
    }
  }
  const over = (holder, c, keep) => (holder.grain[c] || 0) - (keep ? Math.min(holder.grain[c] || 0, CROPS[c].seed) : 0);
  function takeCrop(holder, c, k, into) {
    if (k > 0) {
      setGrain(holder, c, holder.grain[c] - k);
      if (into) into[c] = (into[c] || 0) + k;
    }
    return k;
  }
  // Moves up to n of a good between holders; grain keeps its crops (in the proportion the giver holds them, for 'grain').
  function move(st, from, to, good, n, why) {
    amount(n);
    field(from, good);
    field(to, good);
    const parts = isGrain(good) ? {} : undefined;
    const got = take(st, from, good, n, why, parts);
    put(st, to, good, got, why, parts);
    return got;
  }
  // Meals, in rations, from n units of a food (VB-259): its worth in FOODS. The one place a food becomes meals.
  const mealsFrom = (food, n) => n * FOODS[food].worth;
  // The cook takes up to n of a food from the household's store and makes meals of what it got (today: grain, 1 to 1).
  function cook(st, hh, food, n) {
    const got = food === GRAIN ? takeSpare(st, hh, n, 'cooking') : take(st, hh, food, n, 'cooking');
    put(st, hh, 'meals', mealsFrom(food, got), 'cooking');
  }
  // ---- dried fish (VB-300; sim/drying): a lot in the larder (sim/larder's {kind, n, until}), kept the good's keepsDays ----
  // The fish waiting by the rack are split and hung: they leave the rack's store and are dried fish from now (the weeks on the rack are not
  // told apart: fish hanging is food in store). Returns the rations hung.
  function dry(st, hh) {
    const n = take(st, hh, 'fish', hh.rack || 0, 'drying');
    if (!(n > 0)) return 0;
    record(st, hh, 'dried fish', n, 'drying');
    addFood(st, hh, 'dried fish', n);
    return n;
  }
  // The cook takes up to n rations of a larder food (dried fish), the lots that spoil first first, and makes meals of it, 1 to 1.
  function cookLarder(st, hh, kind, n) {
    amount(n);
    if (kind === undefined) return 0;
    const got = takeFood(st, hh, n, Infinity, kind);
    if (!(got > 0)) return 0;
    record(st, hh, kind, -got, 'cooking');
    put(st, hh, 'meals', got * goodOf(kind).rations, 'cooking');
    return got;
  }
  // @state household.threshed: entries of unthreshed threshed so far (absent: 0); seq numbers a field's entry
  // @state household.sheafCrops: absent while every entry of unthreshed is barley's; else the crop of each entry, in its order (VB-348)
  function sheaf(st, hh, n, seq = -1, crop = 'barley') {
    const th = hh.threshed || 0,
      i = seq - th,
      old = i >= 0 && i < hh.unthreshed.length; // a field's loads add to its entry
    // first: its first load; crop: a crop other than barley (VB-350: the balance reads the harvest by crop)
    const first = seq < 0 ? { first: true } : null;
    record(
      st,
      hh,
      'sheaves',
      n,
      crop === 'barley' ? (first ? { kind: 'harvest', ...first } : 'harvest') : { kind: 'harvest', ...first, crop },
    );
    if (!hh.unthreshed.length) wake(st, hh);
    if (old) {
      hh.unthreshed[i] += n;
      return seq;
    }
    grainGood(crop); // an unknown crop throws
    if (crop !== 'barley' && !hh.sheafCrops) hh.sheafCrops = hh.unthreshed.map(() => 'barley');
    if (hh.sheafCrops) hh.sheafCrops.push(crop);
    return th + hh.unthreshed.push(n) - 1;
  }
  // The barn's first entry is threshed into grain of its crop.
  function thresh(st, hh) {
    type(hh);
    const n = hh.unthreshed.shift() || 0,
      crop = hh.sheafCrops ? hh.sheafCrops.shift() || 'barley' : 'barley';
    if (hh.sheafCrops && !hh.sheafCrops.some((c) => c !== 'barley')) delete hh.sheafCrops;
    hh.threshed = (hh.threshed || 0) + (n ? 1 : 0);
    record(st, hh, 'sheaves', -n, 'thresh');
    put(st, hh, grainGood(crop), n, 'thresh');
  }
  // ---- dug goods (VB-359; sim/dig): whole loads of clay and bog iron ore in a household's store, nothing using them until slice 6 ----
  // @state household.clay, household.bogOre: loads of clay and of bog iron ore dug and held (sim/dig), whole numbers, 0 at the start
  const DUG = ['clay', 'bogOre'];
  function setDug(hh, good, n) {
    if (good === 'clay') hh.clay = n;
    else hh.bogOre = n;
  }
  // @state household.peat: units of peat held, wet or dry (VB-367; a unit burns as PEAT.worth of wood), 0 at the start
  // @state household.peatCut: {key, n} or undefined: the units cut in the season keyed year * 4 + season, which are still drying: peat cut in
  //   a season burns from the next (rule 3: read in closed form against the clock, no pass that dries it)
  const seasonKey = (st) => {
    const c = cal(st.t);
    return c.year * 4 + c.season;
  };
  const peatCut = (st, hh) => (hh.peatCut && hh.peatCut.key === seasonKey(st) ? hh.peatCut.n : 0);
  // The peat that burns today: what is held less what was cut this season.
  const peatDry = (st, hh) => Math.max(0, (hh.peat || 0) - peatCut(st, hh));
  function dug(st, hh, good, n) {
    amount(n);
    if (type(hh) !== 'household' || !(DUG.includes(good) || good === 'peat'))
      throw new Error(`stores: cannot dig ${good}`);
    record(st, hh, good, n, 'dig');
    if (good === 'peat') {
      hh.peatCut = { key: seasonKey(st), n: peatCut(st, hh) + n };
      hh.peat = (hh.peat || 0) + n;
    } else setDug(hh, good, (hh[good] || 0) + n);
    return n;
  }
  // Only a newly constructed household, before its members move in. Constructor supplies are replaced, not consumed. grain: by crop (a
  // take's `into`).
  function start(st, hh, grain, meals = 0) {
    if (!partsOk(grain)) throw new Error("stores: a start's grain is by crop");
    amount(meals);
    type(hh);
    hh.grain = { ...grain };
    hh.meals = meals;
    hh.wood = 0; // its first wood comes from somewhere (sim/membership, VB-328)
    record(st, hh, 'grain', partsSum(grain), 'provisions');
    record(st, hh, 'meals', meals, 'provisions');
  }
  // Grain spoiling in store, n in all, on each crop in proportion to what is held of it (sim/hunger reckons n).
  function spoil(st, hh, n) {
    const lost = take(st, hh, 'grain', n, 'spoilage');
    hh.spoilt = (hh.spoilt || 0) + lost;
  }
  function villageDay(st) {
    VB.count.storeWalk += st.villages.length;
    for (const v of st.villages) {
      const g = grainOf(v);
      if (g > 0) take(st, v, GRAIN, dayLoss(st, GRAIN, g, Infinity, st.ECON.villageStoreTier), 'spoilage'); // grain's keeping (sim/goods)
    }
  }
  // At the new year: entries and totals older than three years go. Only live holders are walked (rule 1); a dissolved household's
  // ledger was emptied when it dissolved (close).
  function prune(st) {
    const keep = yearNow(st) - 3,
      recent = (e) => st.t - e.t < YEAR * 3,
      kept = (x) => x.year >= keep;
    VB.count.storeWalk += st.liveHouseholds.length + st.villages.length;
    for (const id of st.liveHouseholds) {
      const hh = st.households[id];
      VB.count.storeWalk += hh.ledger.length + hh.totals.length;
      hh.ledger = hh.ledger.filter(recent);
      hh.totals = hh.totals.filter(kept);
      hh.poured = hh.poured.filter((t) => st.t - t < YEAR * BREW.years);
    }
    for (const v of st.villages) {
      VB.count.storeWalk += v.ledger.length + v.totals.length;
      v.ledger = v.ledger.filter(recent);
      v.totals = v.totals.filter(kept);
    }
  }
  // A household's ledger ends when it dissolves: no movement can reach it afterwards (type refuses a dissolved holder).
  function close(st, hh) {
    if (!hh.dissolved) throw new Error('stores: close a dissolved household only');
    hh.ledger = [];
    hh.totals = [];
    hh.ale = [];
    hh.poured = [];
  }
  // The sum of a holder's totals of one routine kind in a calendar year (its entries are read from the ledger as before).
  function yearSum(holder, kind, year) {
    let n = 0;
    for (const x of holder.totals) if (x.year === year && x.kind === kind) n += x.n;
    return n;
  }
  // ---- ale (VB-305; design.md, Goods, Ale and standing): barrels in lots {n, until (game hours)}, oldest first, kept in hh.ale (a household
  // holds ale and no other holder does); BREW.grain rations of grain make a barrel, which keeps the good's season. hh.poured: the game hours
  // of the barrels poured in the last BREW.years years, the last BREW.maxBarrels of them (the host's standing counts no more), pruned at the
  // year's turn. ----
  // @state household.ale: [{n, until}]: lots of barrels of ale, oldest first, each n a whole number above 0, those past `until` lost at the day's turn
  // @state household.poured: number[]: the game hours at which barrels were poured, oldest first, at most BREW.maxBarrels, those over BREW.years old pruned
  // The barrels the household holds now.
  function aleOf(st, hh) {
    let n = 0;
    for (const l of hh.ale) if (l.until > st.t) n += l.n;
    return n;
  }
  // Brews a barrel from the household's grain (sim/kinds checks that it is surplus: grain above the floor); 0 if the grain is not there.
  function brew(st, hh) {
    type(hh);
    if (grainOf(hh) < BREW.grain) return 0;
    takeSpare(st, hh, BREW.grain, 'brew');
    record(st, hh, 'ale', 1, 'brew');
    hh.ale.push({ n: 1, until: st.t + keepsDays('ale') * DAY });
    return 1;
  }
  // Ale past its season is lost (each day; sim/clock).
  function spoilAle(st, hh) {
    if (!hh.ale.length) return;
    let lost = 0;
    for (const l of hh.ale) if (l.until <= st.t) lost += l.n;
    if (!lost) return;
    record(st, hh, 'ale', -lost, 'spoilage');
    hh.ale = hh.ale.filter((l) => l.until > st.t);
  }
  // Pours up to n barrels, the oldest first, and says how many (the host's standing counts them, sim/society); used up with its reason.
  function pour(st, hh, n) {
    type(hh);
    spoilAle(st, hh);
    const rest = [];
    let left = Math.floor(n);
    for (const l of hh.ale) {
      const k = Math.min(l.n, left);
      left -= k;
      if (l.n > k) rest.push({ n: l.n - k, until: l.until });
    }
    const got = Math.floor(n) - left;
    if (!got) return 0;
    hh.ale = rest;
    record(st, hh, 'ale', -got, 'pour');
    for (let i = 0; i < got; i++) hh.poured.push(st.t);
    if (hh.poured.length > BREW.maxBarrels) hh.poured.splice(0, hh.poured.length - BREW.maxBarrels);
    return got;
  }
  // The host's standing from its pours: BREW.standing a barrel poured in the last BREW.years years, counted up to BREW.maxBarrels.
  function aleStanding(st, hh) {
    let n = 0;
    for (const t of hh.poured) if (st.t - t < BREW.years * YEAR) n++;
    return n * BREW.standing;
  }
  // ---- reservations (VB-248; design.md section 7, Reservations): a plan holds back a count of a good in its holder's store, so that
  // two plans do not spend it twice and the holder's free stock is the rest. A count per holder, good and plan, kept on the plan (st.plans,
  // whose records sim/plans makes and drops: a reservation goes with its plan); only these operations write it.
  // @state plan.reserved: {[good]: n}: the plan's reservation of a good, as counted at its last reserve (the plan's review); plan.reasons:
  //   {[good]: why}, one of RESERVE. A reservation whose reason follows the plan's needs between reviews (FOLLOWS) is counted at read by its rule.
  //   A project plan's (VB-123, sim/projects) is one of two: `field`, the seed held back for the new field it makes (as the seed of the
  //   standing plan, it may exceed the stock: a hungry household eats its seed), and `build`, what its steps will spend, which is made only
  //   from the holder's free stock (its stock less what its plans hold back) and is reviewed at once when the stock falls below it.
  const RESERVE = ['seed', 'field', 'build'],
    CHECKED = 'build';
  // Rules that count a following reservation at read, by reason, given before the first seed (like sim/registry's): seed follows the
  // fields as they are sown (sim/hunger). Stored counts lag a sowing or a stage change by up to an hour, and the readers of the seed
  // (the cook, the meal, help, deals, provisions, the means to marry) read it within the hour, so the count is read where it is wanted.
  const FOLLOWS = {};
  function follow(why, count) {
    if (!RESERVE.includes(why) || FOLLOWS[why]) throw new Error(`stores: cannot follow ${why}`);
    FOLLOWS[why] = count;
  }
  function reason(why) {
    if (!RESERVE.includes(why)) throw new Error(`stores: unknown reservation ${why}`);
  }
  // The plans of a holder's that a reservation is kept on: its standing plan (sim/plans; a pawn has none) and its project plans (sim/projects,
  // st.plans.projects: a list per holder, none for most).
  const planFor = (st, holder, kind = type(holder)) =>
    kind === 'household'
      ? st.plans.households.get(holder.id)
      : kind === 'village'
        ? st.plans.villages.get(holder.id)
        : undefined;
  const projectsFor = (st, holder, kind = type(holder)) => Projects.projectsOf(st, kind, holder.id);
  const isPlanOf = (st, holder, plan) => plan === planFor(st, holder) || projectsFor(st, holder).includes(plan);
  // A plan holds back n of a good. A `build` reservation is refused (false) beyond the holder's free stock, so that two plans do not count
  // on the same timber; the others are not checked. True when made.
  function reserve(st, holder, plan, good, n, why) {
    amount(n);
    reason(why);
    const k = field(holder, good);
    if (k === GRAIN && good === GRAIN) throw new Error('stores: grain is reserved by its crop');
    if (!isPlanOf(st, holder, plan)) throw new Error("stores: a reservation names its holder's plan");
    if (
      why === CHECKED &&
      n > heldOf(holder, good) - reserved(st, holder, good) + (plan.reasons[good] ? plan.reserved[good] : 0) + 1e-9
    ) {
      return false;
    }
    plan.reserved[good] = n;
    plan.reasons[good] = why;
    return true;
  }
  function release(st, holder, plan, good, why) {
    reason(why);
    if (!isPlanOf(st, holder, plan) || plan.reasons[good] !== why) throw new Error('stores: no such reservation');
    delete plan.reserved[good];
    delete plan.reasons[good];
  }
  // Every reservation of a plan that ends (sim/projects: done, or dropped; its holder may be gone, so it is not asked).
  function releaseAll(plan) {
    for (const good of Object.keys(plan.reasons)) {
      delete plan.reserved[good];
      delete plan.reasons[good];
    }
  }
  // What the holder's plans hold back of a good; a following reservation counted now. Grain is reserved by crop ('grain/<crop>', VB-347):
  // 'grain' reads the sum of its crops'. Allocates nothing (the review reads it hourly).
  const counts = (key, good) => key === good || (good === GRAIN && GOOD_CROP[key] !== undefined);
  function reserved(st, holder, good) {
    if (!st.plans) return 0;
    const kind = type(holder),
      plan = planFor(st, holder, kind);
    let n = 0;
    if (plan)
      for (const key in plan.reasons) {
        if (!counts(key, good)) continue;
        const why = plan.reasons[key];
        n += FOLLOWS[why] ? FOLLOWS[why](st, holder, GOOD_CROP[key]) : plan.reserved[key];
      }
    const list = projectsFor(st, holder, kind);
    for (let i = 0; i < list.length; i++)
      for (const key in list[i].reasons) if (counts(key, good)) n += list[i].reserved[key];
    return n;
  }
  // After a take: a holder whose stock of a good fell below what its project plans' steps will spend has those plans reviewed at once
  // (design.md section 7, Reservations): sim/plans hears it. The one call from the stores to the project plans is this event.
  function short(st, holder, kind, good, left) {
    const list = projectsFor(st, holder, kind);
    if (!list.length) return;
    let n = 0;
    for (let i = 0; i < list.length; i++) if (list[i].reasons[good] === CHECKED) n += list[i].reserved[good];
    if (left < n - 1e-9) emit(st, 'storeShort', { type: kind, id: holder.id, good });
  }
  return {
    dug,
    peatDry,
    dry,
    cookLarder,
    grainOf,
    heldOf,
    heapsLoaded,
    grainGood,
    partsOk,
    partsSum,
    takeSpare,
    CROP_LIST,
    STAKE_CROP,
    KINDS,
    ROUTINE,
    RESERVE,
    yearNow,
    close,
    yearSum,
    record,
    put,
    take,
    move,
    mealsFrom,
    cook,
    sheaf,
    thresh,
    start,
    spoil,
    villageDay,
    prune,
    follow,
    reserve,
    release,
    releaseAll,
    reserved,
    aleOf,
    brew,
    spoilAle,
    pour,
    aleStanding,
  };
})();
