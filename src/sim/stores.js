// @sys sim/stores: food quantities, paid stakes, movements and three-year household and village ledgers, routine movements as yearly totals;
// the registry of goods (VB-299) and Culture's worth and proper as rules
VB['sim/stores'] = (() => {
  const { YEAR, YEAR_DAYS, SEASON_DAYS, TICKS, FOODS, HERD, ECON } = VB['sim/rules'];
  const Rules = VB['sim/registry'], Culture = VB['culture'];
  const KINDS = ['harvest', 'gift', 'meat', 'milk', 'butter', 'seed', 'meal', 'seedMeal', 'cooking', 'spoilage', 'share', 'handingOn', 'provisions', 'thresh'];
  // VB-204: routine kinds (95% of movements) add to a yearly total per holder, kind and good instead of writing an entry each.
  const ROUTINE = ['meal', 'seedMeal', 'cooking', 'spoilage', 'thresh', 'milk', 'butter'];
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
    return 'farmstead' in holder ? 'household' : 'center' in holder ? 'village' : 'pawn';
  }
  function villageEntry(v, entry) { if (!v.ledger) v.ledger = []; v.ledger.push(entry); }
  function record(st, holder, good, n, why) {
    amount(Math.abs(n));
    const detail = typeof why === 'string' ? { kind: why } : why;
    if (!detail || !KINDS.includes(detail.kind)) throw new Error('stores: unknown reason');
    const kind = type(holder), hh = kind === 'pawn' ? st.households[holder.household] : holder;
    if (hh && kind !== 'pawn' && ROUTINE.includes(detail.kind)) fold(hh, yearNow(st), detail.kind, good, n);
    else if (hh) {
      const entry = { ...detail, t: st.t, n, good, ...(kind === 'pawn' ? { pawn: holder.id, stake: true } : {}) };
      if (kind === 'village') villageEntry(holder, entry);
      else { if (!hh.ledger) hh.ledger = []; hh.ledger.push(entry); }
    }
  }
  function field(holder, good) {
    const kind = type(holder);
    if (kind === 'pawn' && good === 'grain') return 'stake';
    if (good === 'grain' || kind === 'household' && good === 'meals') return good;
    throw new Error(`stores: ${kind} cannot hold ${good}`);
  }
  // Explicit writes keep the ownership scan aware of every stored quantity.
  const setStake = (p, n) => { p.stake = n; };
  const setVillage = (v, n) => { v.grain = n; };
  function setFood(hh, good, n) { if (good === 'grain') hh.grain = n; else hh.meals = n; }
  function set(holder, good, n) {
    const kind = type(holder);
    if (kind === 'pawn') setStake(holder, n);
    else if (kind === 'village') setVillage(holder, n);
    else setFood(holder, good, n);
  }
  function put(st, holder, good, n, why) {
    amount(n); const k = field(holder, good);
    record(st, holder, good, n, why); set(holder, good, (holder[k] || 0) + n); return n;
  }
  function take(st, holder, good, n, why) {
    amount(n); const k = field(holder, good), got = Math.min(holder[k] || 0, n);
    record(st, holder, good, -got, why); set(holder, good, (holder[k] || 0) - got); return got;
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
    amount(n); record(st, hh, 'sheaves', n, 'harvest'); hh.unthreshed.push(n);
  }
  function thresh(st, hh) {
    type(hh); const n = hh.unthreshed.shift() || 0;
    record(st, hh, 'sheaves', -n, 'thresh'); put(st, hh, 'grain', n, 'thresh');
  }
  // Only a newly constructed household, before its members move in. Constructor supplies are replaced, not consumed.
  function start(st, hh, grain, meals = 0) {
    amount(grain); amount(meals); type(hh);
    hh.grain = grain; hh.meals = meals;
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
      hh.ledger = hh.ledger.filter(recent); hh.totals = hh.totals.filter(kept);
    }
    for (const v of st.villages) {
      VB.count.storeWalk += v.ledger.length + v.totals.length;
      v.ledger = v.ledger.filter(recent); v.totals = v.totals.filter(kept);
    }
  }
  // A household's ledger ends when it dissolves: no movement can reach it afterwards (type refuses a dissolved holder).
  function close(st, hh) { if (!hh.dissolved) throw new Error('stores: close a dissolved household only'); hh.ledger = []; hh.totals = []; }
  // The sum of a holder's totals of one routine kind in a calendar year (its entries are read from the ledger as before).
  function yearSum(holder, kind, year) { let n = 0; for (const x of holder.totals) if (x.year === year && x.kind === kind) n += x.n; return n; }
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
    KINDS, ROUTINE, RESERVE, yearNow, close, yearSum, record, put, take, move, mealsFrom, cook, sheaf, thresh, start, spoil, villageDay, prune,
    follow, reserve, release, reserved };
})();
