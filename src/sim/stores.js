// @sys sim/stores: food quantities, paid stakes, movements and three-year household and village ledgers, routine movements as yearly totals;
// ale brewed, poured and spoiling (VB-305); the registry of goods (VB-299) and Culture's worth and proper as rules
VB['sim/stores'] = (() => {
  const { DAY, YEAR, YEAR_DAYS, SEASON_DAYS, TICKS, FOODS, HERD, ECON, BREW } = VB['sim/rules'];
  const Rules = VB['sim/registry'], Culture = VB['culture'];
  const KINDS = ['harvest', 'gift', 'meat', 'milk', 'butter', 'seed', 'meal', 'seedMeal', 'cooking', 'spoilage', 'share', 'handingOn', 'provisions', 'thresh',
    'catch', 'gathering', 'brew', 'pour'];
  KINDS.push('dig'); // loads of clay and bog iron ore dug into a household's store (VB-344, sim/dig)
  // VB-204: routine kinds (95% of movements) add to a yearly total per holder, kind and good instead of writing an entry each.
  const ROUTINE = ['meal', 'seedMeal', 'cooking', 'spoilage', 'thresh', 'milk', 'butter', 'catch', 'gathering'];
  // VB-328: the woodpile, in loads: a firewood trip, the day's burning (routine), a plot's wood, timber left over, a new household's first wood.
  KINDS.push('firewood', 'burn', 'plot', 'timber', 'start'); ROUTINE.push('firewood', 'burn');
  // VB-332: the stone heap, in loads of 25 stones: cleared from a field or meadow, picked, quarried; taken by a stone foundation.
  KINDS.push('clear', 'pick', 'quarry', 'foundation');
  // The calendar year (as cal(hour).year) of the hour the clock is working through (sim/clock, st.tick): midnight's work belongs to the day it starts.
  const yearNow = (st) => Math.floor(st.tick / (YEAR * TICKS)) + 1;
  // Adds to the year's total; this year's totals are the last ones, so the search stops at the first earlier year.
  function fold(holder, year, kind, good, n) {
    const T = holder.totals;
    for (let i = T.length - 1; i >= 0 && T[i].year === year; i--) {
      const x = T[i]; if (x.kind === kind && x.good === good) { x.n += n; x.count++; return; }
    }
    T.push({ year, kind, good, n, count: 1 });
  }
  function amount(n) { if (!Number.isFinite(n) || n < 0) throw new Error(`stores: invalid amount ${n}`); }
  function type(holder) {
    if (!holder || holder.dissolved) throw new Error('stores: missing or dissolved holder');
    // A pawn is told by `given` (a person on record has it, no other holder does); anything else is refused.
    if ('farmstead' in holder) return 'household';
    if ('center' in holder) return 'village';
    if ('given' in holder) return 'pawn';
    throw new Error('stores: not a holder');
  }
  function villageEntry(v, entry) { if (!v.ledger) v.ledger = []; v.ledger.push(entry); }
  function record(st, holder, good, n, why, kind = type(holder)) {
    amount(Math.abs(n));
    const detail = typeof why === 'string' ? { kind: why } : why;
    if (!detail || !KINDS.includes(detail.kind)) throw new Error('stores: unknown reason');
    const hh = kind === 'pawn' ? st.households[holder.household] : holder;
    if (hh && kind !== 'pawn' && ROUTINE.includes(detail.kind)) fold(hh, yearNow(st), detail.kind, good, n);
    else if (hh) {
      const entry = { ...detail, t: st.t, n, good, ...(kind === 'pawn' ? { pawn: holder.id, stake: true } : {}) };
      if (kind === 'village') villageEntry(holder, entry);
      else { if (!hh.ledger) hh.ledger = []; hh.ledger.push(entry); }
    }
  }
  function field(holder, good, kind = type(holder)) {
    if (kind === 'pawn' && good === 'grain') return 'stake';
    if (good === 'grain' || kind === 'household' && good === 'meals') return good;
    if (kind === 'household' && good === 'wood') return good; // the woodpile (VB-328)
    if (kind === 'household' && good === 'stone') return good; // the stone heap (VB-332)
    throw new Error(`stores: ${kind} cannot hold ${good}`);
  }
  // Explicit writes keep the ownership scan aware of every stored quantity.
  const setStake = (p, n) => { p.stake = n; };
  const setVillage = (v, n) => { v.grain = n; };
  const setWood = (hh, n) => { hh.wood = n; };
  const setStone = (hh, n) => { hh.stone = n; };
  function setFood(hh, good, n) { if (good === 'grain') hh.grain = n; else hh.meals = n; }
  function set(holder, good, n, kind) {
    if (kind === 'pawn') setStake(holder, n);
    else if (kind === 'village') setVillage(holder, n);
    else if (good === 'wood') setWood(holder, n);
    else if (good === 'stone') setStone(holder, n);
    else setFood(holder, good, n);
  }
  // VB-249: a store crossing a target wakes its household's plan for a review (sim/plans reads and clears the flag, at most one such review
  // a day): the grain above the seed reserve running out or coming back, sheaves coming into an empty barn. The one call from the stores
  // to the plans is this flag.
  // @state plan.dirty: true when a store of the plan's household crossed a target since the plan's last review; set only here.
  function wake(st, hh) {
    const plan = st.plans && st.plans.households.get(hh.id);
    if (plan) plan.dirty = true;
  }
  function crossed(st, holder, kind, good, before) {
    if (good !== 'grain' || kind !== 'household' || !st.plans) return;
    const r = reserved(st, holder, 'grain');
    if ((before > r) !== (holder.grain > r)) wake(st, holder);
  }
  function put(st, holder, good, n, why) {
    amount(n); const kind = type(holder), k = field(holder, good, kind), before = holder[k] || 0;
    record(st, holder, good, n, why, kind); set(holder, good, before + n, kind); crossed(st, holder, kind, good, before); return n;
  }
  function take(st, holder, good, n, why) {
    amount(n); const kind = type(holder), k = field(holder, good, kind), before = holder[k] || 0, got = Math.min(before, n);
    record(st, holder, good, -got, why, kind); set(holder, good, before - got, kind); crossed(st, holder, kind, good, before); return got;
  }
  function move(st, from, to, good, n, why) {
    amount(n); field(from, good); field(to, good);
    const got = take(st, from, good, n, why); put(st, to, good, got, why); return got;
  }
  // Meals, in rations, from n units of a food (VB-259): its worth in FOODS. The one place a food becomes meals.
  const mealsFrom = (food, n) => n * FOODS[food].worth;
  // The cook takes up to n of a food from the household's store and makes meals of what it got (today: grain, 1 to 1).
  function cook(st, hh, food, n) { const got = take(st, hh, food, n, 'cooking'); put(st, hh, 'meals', mealsFrom(food, got), 'cooking'); }
  function sheaf(st, hh, n) {
    amount(n); record(st, hh, 'sheaves', n, 'harvest');
    if (!hh.unthreshed.length) wake(st, hh);
    hh.unthreshed.push(n);
  }
  function thresh(st, hh) {
    type(hh); const n = hh.unthreshed.shift() || 0;
    record(st, hh, 'sheaves', -n, 'thresh'); put(st, hh, 'grain', n, 'thresh');
  }
  // ---- dug goods (VB-344; sim/dig): whole loads of clay and bog iron ore in a household's store, nothing using them until slice 6 ----
  // @state household.clay, household.bogOre: loads of clay and of bog iron ore dug and held (sim/dig), whole numbers, 0 at the start
  const DUG = ['clay', 'bogOre'];
  function setDug(hh, good, n) { if (good === 'clay') hh.clay = n; else hh.bogOre = n; }
  function dug(st, hh, good, n) {
    amount(n);
    if (type(hh) !== 'household' || !DUG.includes(good)) throw new Error(`stores: cannot dig ${good}`);
    record(st, hh, good, n, 'dig'); setDug(hh, good, (hh[good] || 0) + n); return n;
  }
  // Only a newly constructed household, before its members move in. Constructor supplies are replaced, not consumed.
  function start(st, hh, grain, meals = 0) {
    amount(grain); amount(meals); type(hh);
    hh.grain = grain; hh.meals = meals;
    hh.wood = 0; // its first wood comes from somewhere (sim/membership, VB-328)
    record(st, hh, 'grain', grain, 'provisions'); record(st, hh, 'meals', meals, 'provisions');
  }
  function spoil(st, hh, n) {
    const lost = take(st, hh, 'grain', n, 'spoilage'); hh.spoilt = (hh.spoilt || 0) + lost;
  }
  function villageDay(st) {
    VB.count.storeWalk += st.villages.length;
    const share = 1 - Math.pow(1 - st.ECON.villageStoreLoss, 1 / YEAR_DAYS); // the day's share of the year's loss
    for (const v of st.villages) if (v.grain > 0) take(st, v, 'grain', v.grain * share, 'spoilage');
  }
  // At the new year: entries and totals older than three years go. Only live holders are walked (rule 1); a dissolved household's
  // ledger was emptied when it dissolved (close).
  function prune(st) {
    const keep = yearNow(st) - 3, recent = (e) => st.t - e.t < YEAR * 3, kept = (x) => x.year >= keep;
    VB.count.storeWalk += st.liveHouseholds.length + st.villages.length;
    for (const id of st.liveHouseholds) {
      const hh = st.households[id];
      VB.count.storeWalk += hh.ledger.length + hh.totals.length;
      hh.ledger = hh.ledger.filter(recent); hh.totals = hh.totals.filter(kept); hh.poured = hh.poured.filter((t) => st.t - t < YEAR * BREW.years);
    }
    for (const v of st.villages) {
      VB.count.storeWalk += v.ledger.length + v.totals.length;
      v.ledger = v.ledger.filter(recent); v.totals = v.totals.filter(kept);
    }
  }
  // A household's ledger ends when it dissolves: no movement can reach it afterwards (type refuses a dissolved holder).
  function close(st, hh) {
    if (!hh.dissolved) throw new Error('stores: close a dissolved household only');
    hh.ledger = []; hh.totals = [];
    hh.ale = []; hh.poured = [];
  }
  // The sum of a holder's totals of one routine kind in a calendar year (its entries are read from the ledger as before).
  function yearSum(holder, kind, year) { let n = 0; for (const x of holder.totals) if (x.year === year && x.kind === kind) n += x.n; return n; }
  // ---- ale (VB-305; design.md, Goods, Ale and standing): barrels in lots {n, until (game hours)}, oldest first, kept in hh.ale (a household
  // holds ale and no other holder does); BREW.grain rations of grain make a barrel, which keeps the good's season. hh.poured: the game hours
  // of the barrels poured in the last BREW.years years, the last BREW.maxBarrels of them (the host's standing counts no more), pruned at the
  // year's turn. ----
  // @state household.ale: [{n, until}]: lots of barrels of ale, oldest first, each n a whole number above 0, those past `until` lost at the day's turn
  // @state household.poured: number[]: the game hours at which barrels were poured, oldest first, at most BREW.maxBarrels, those over BREW.years old pruned
  const aleKeeps = () => goodOf('ale').perish.keepsDays * DAY;
  // The barrels the household holds now.
  function aleOf(st, hh) { let n = 0; for (const l of hh.ale) if (l.until > st.t) n += l.n; return n; }
  // Brews a barrel from the household's grain (sim/kinds checks that it is surplus: grain above the floor); 0 if the grain is not there.
  function brew(st, hh) {
    type(hh);
    if (hh.grain < BREW.grain) return 0;
    take(st, hh, 'grain', BREW.grain, 'brew'); record(st, hh, 'ale', 1, 'brew');
    hh.ale.push({ n: 1, until: st.t + aleKeeps() });
    return 1;
  }
  // Ale past its season is lost (each day; sim/clock).
  function spoilAle(st, hh) {
    if (!hh.ale.length) return;
    let lost = 0;
    for (const l of hh.ale) if (l.until <= st.t) lost += l.n;
    if (!lost) return;
    record(st, hh, 'ale', -lost, 'spoilage'); hh.ale = hh.ale.filter((l) => l.until > st.t);
  }
  // Pours up to n barrels, the oldest first, and says how many (the host's standing counts them, sim/society); used up with its reason.
  function pour(st, hh, n) {
    type(hh); spoilAle(st, hh);
    const rest = []; let left = Math.floor(n);
    for (const l of hh.ale) { const k = Math.min(l.n, left); left -= k; if (l.n > k) rest.push({ n: l.n - k, until: l.until }); }
    const got = Math.floor(n) - left;
    if (!got) return 0;
    hh.ale = rest; record(st, hh, 'ale', -got, 'pour');
    for (let i = 0; i < got; i++) hh.poured.push(st.t);
    if (hh.poured.length > BREW.maxBarrels) hh.poured.splice(0, hh.poured.length - BREW.maxBarrels);
    return got;
  }
  // The host's standing from its pours: BREW.prestige a barrel poured in the last BREW.years years, counted up to BREW.maxBarrels.
  function aleStanding(st, hh) {
    let n = 0; for (const t of hh.poured) if (st.t - t < BREW.years * YEAR) n++;
    return n * BREW.prestige;
  }
  // ---- reservations (VB-248; design.md section 7, Reservations): a plan holds back a count of a good in its holder's store, so that
  // two plans do not spend it twice and the holder's free stock is the rest. A count per holder, good and plan, kept on the plan (st.plans,
  // whose records sim/plans makes and drops: a reservation goes with its plan); only these operations write it.
  // @state plan.reserved: {[good]: n}: the plan's reservation of a good, as counted at its last reserve (the plan's review); plan.reasons:
  //   {[good]: why}, one of RESERVE. A reservation whose reason follows the plan's needs between reviews (FOLLOWS) is counted at read by its rule.
  const RESERVE = ['seed'];
  // Rules that count a following reservation at read, by reason, given before the first seed (like sim/registry's): seed follows the
  // fields as they are sown (sim/hunger). Stored counts lag a sowing or a stage change by up to an hour, and the readers of the seed
  // (the cook, the meal, help, deals, provisions, the means to marry) read it within the hour, so the count is read where it is wanted.
  const FOLLOWS = {};
  function follow(why, count) { if (!RESERVE.includes(why) || FOLLOWS[why]) throw new Error(`stores: cannot follow ${why}`); FOLLOWS[why] = count; }
  function reason(why) { if (!RESERVE.includes(why)) throw new Error(`stores: unknown reservation ${why}`); }
  // The plan of a holder's that a reservation is kept on: today its standing plan (sim/plans), the only plan a holder has.
  const planFor = (st, holder) => (type(holder) === 'household' ? st.plans.households : st.plans.villages).get(holder.id);
  function reserve(st, holder, plan, good, n, why) {
    amount(n); reason(why); field(holder, good);
    if (plan !== planFor(st, holder)) throw new Error('stores: a reservation names its holder\'s plan');
    plan.reserved[good] = n; plan.reasons[good] = why;
  }
  function release(st, holder, plan, good, why) {
    reason(why);
    if (plan !== planFor(st, holder) || plan.reasons[good] !== why) throw new Error('stores: no such reservation');
    delete plan.reserved[good]; delete plan.reasons[good];
  }
  // What the holder's plans hold back of a good; a following reservation counted now. Allocates nothing (the review reads it hourly).
  function reserved(st, holder, good) {
    const plan = st.plans && planFor(st, holder), why = plan && plan.reasons[good];
    if (!why) return 0;
    return FOLLOWS[why] ? FOLLOWS[why](st, holder) : plan.reserved[good];
  }
  // ---- goods (VB-299; target-v2 4.3; design.md, The fair): a registry of the goods that change hands, declared at load like a rule and
  // closed when the rules registry seals; code, never saved state. A good: id ('grain', 'cattle/cow'), kind and subtype, class (Culture.CLASSES:
  // which exchanges custom calls proper), unit (what is counted: a ration, a barrel, a head), quantum (units that change hands at once) and
  // lump (its name: a sack, a lot), rations (food a unit gives; 0 for what is not eaten), source (its source in the pot, as FOODS; null),
  // perish ({keepsDays}: a lot spoils by date; {lossPerYear}: a share of the stock is lost; null: it does not perish in store; an animal
  // lives and dies as an animal), keeping (accepted beyond need, to be passed on; design.md, The fair, Keeping goods). ----
  const GOODS = new Map();
  function declareGood(spec) {
    Rules.atLoad();
    const ok = spec && typeof spec.id === 'string' && !GOODS.has(spec.id) && typeof spec.kind === 'string' && Culture.CLASSES.includes(spec.class)
      && typeof spec.unit === 'string' && typeof spec.lump === 'string' && spec.quantum > 0 && spec.rations >= 0 && typeof spec.keeping === 'boolean'
      && (spec.perish === null || spec.perish.keepsDays > 0 || spec.perish.lossPerYear > 0) && Culture.norm('worth', spec.id) > 0;
    if (!ok) throw new Error('stores: invalid or duplicate good ' + (spec && spec.id));
    GOODS.set(spec.id, Object.freeze({ subtype: null, source: null, ...spec, perish: spec.perish && Object.freeze({ ...spec.perish }) }));
  }
  function goodOf(id) { const g = GOODS.get(id); if (!g) throw new Error('stores: unknown good ' + id); return g; }
  const goods = () => [...GOODS.values()];
  // The goods the fair trades (design.md, Quanta and worth). Wool and cheese are not goods yet (slice 6); labour days are promises (slice 5).
  const food = (id, lump, source, perish, keeping) => ({ id, kind: id, class: 'food', unit: 'ration', quantum: 10, lump, rations: 1, source, perish, keeping });
  declareGood(food('grain', 'sack', 'grain', { lossPerYear: ECON.storeLoss[0] }, false)); // more of what is held beyond a year (sim/hunger)
  declareGood(food('butter', 'lot', 'milk', { keepsDays: HERD.butterDays }, true));
  declareGood(food('salt meat', 'lot', 'meat', { keepsDays: HERD.saltDays }, true));
  declareGood(food('dried fish', 'lot', 'fish', { keepsDays: YEAR_DAYS }, true)); // through winter and spring (VB-300 makes it)
  declareGood({ id: 'ale', kind: 'ale', class: 'food', unit: 'barrel', quantum: 1, lump: 'barrel', rations: 0, perish: { keepsDays: SEASON_DAYS },
    keeping: false }); // poured for guests, not eaten as rations (VB-305)
  declareGood({ id: 'tar', kind: 'tar', class: 'wares', unit: 'barrel', quantum: 1, lump: 'barrel', rations: 0, perish: null, keeping: true });
  for (const k of ['cow', 'ox', 'heifer', 'steer']) declareGood({ id: 'cattle/' + k, kind: 'cattle', subtype: k, class: 'wares', unit: 'head', quantum: 1,
    lump: 'head', rations: 0, perish: null, keeping: false });
  declareGood({ id: 'sheep', kind: 'sheep', class: 'wares', unit: 'head', quantum: 1, lump: 'head', rations: 0, perish: null, keeping: true });
  // Culture's two norms on goods as rules, so the registry lists and explains them (Culture.norm is the table; norms learn in slice 8):
  // worth, rations a quantum, with the context {good}; proper, the index in Culture.PROPER of what custom calls giving a good of class `from`
  // for one of class `to`, with the context {from, to, days} (days: the giving side's food, in days of its need).
  Rules.declare({ id: 'worth', owner: 'culture', combine: 'sum', base: (st, c) => Culture.norm('worth', c.good.id), clamp: [0, 1e9] });
  Rules.declare({ id: 'proper', owner: 'culture', combine: 'sum', base: (st, c) => Culture.PROPER.indexOf(Culture.norm('proper', c.from, c.to, c.days)),
    clamp: [0, Culture.PROPER.length - 1] });
  return { GOODS, declareGood, goodOf, goods,
    dug,
    KINDS, ROUTINE, RESERVE, yearNow, close, yearSum, record, put, take, move, mealsFrom, cook, sheaf, thresh, start, spoil, villageDay, prune,
    follow, reserve, release, reserved, aleOf, brew, spoilAle, pour, aleStanding };
})();
