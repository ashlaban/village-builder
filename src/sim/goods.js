// @sys sim/goods: the catalog of trade goods, grain subtype identifiers and culture's worth and propriety rules
VB['sim/goods'] = (() => {
  const { FOODS, HERD, YEAR_DAYS, SEASON_DAYS } = VB['sim/rules'],
    { CROPS } = VB['sim/crops'];
  const Rules = VB['sim/registry'],
    Culture = VB['culture'];
  const GRAIN = 'grain',
    CROP_LIST = Object.freeze(Object.keys(CROPS).filter((c) => CROPS[c].seed > 0)),
    CROP_GOOD = {},
    GOOD_CROP = {};
  for (const c of CROP_LIST) {
    CROP_GOOD[c] = GRAIN + '/' + c;
    GOOD_CROP[GRAIN + '/' + c] = c;
  }
  const isGrain = (good) => good === GRAIN || GOOD_CROP[good] !== undefined;
  function grainGood(crop) {
    const g = CROP_GOOD[crop];
    if (!g) throw new Error(`stores: unknown crop ${crop}`);
    return g;
  }
  // ---- keeping (VB-683): how each stored good is lost, one row a good, read alike by every store that holds it (a household's, the
  // village's, a pawn's stake; the larder's lots, the fresh batches, the barn's hay, the ale). {keepsDays}: a lot or a batch spoils whole
  // that many game days after it was put in (FOODS.keeps of a food); {tiers(st)}: a share a year of what is held, the first unit held at
  // tiers[0], the second at tiers[1], the rest at tiers[2], the unit given by the store (a household's year of need for grain, its herds'
  // winter for hay), so that a large store levels off (balance review; VB-159); {never}: it is not lost in store, the reason told. ----
  const KEEPING = {};
  for (const id of Object.keys(FOODS))
    if (FOODS[id].keeps !== null)
      KEEPING[id] = Object.freeze({
        get keepsDays() {
          return FOODS[id].keeps; // the one number of a food's shelf life (sim/rules), read when asked
        },
      });
  KEEPING.grain = Object.freeze({ tiers: (st) => st.ECON.storeLoss }); // pulses are grain of their crop (sim/stores)
  KEEPING.hay = Object.freeze({ tiers: () => HERD.hayLoss });
  KEEPING.ale = Object.freeze({ keepsDays: SEASON_DAYS }); // a barrel keeps its season (VB-305)
  KEEPING.meals = Object.freeze({ never: 'cooked for the coming day and eaten within it' });
  KEEPING.flour = Object.freeze({ never: 'a few days of the pot ground at a time (sim/quern)' });
  KEEPING.rack = Object.freeze({ never: 'the catch waits by the rack for a day or two, then is hung (sim/drying)' });
  KEEPING.stake = Object.freeze({
    never:
      "a stake is grain promised a party and kept with its household's until the move (sim/settle), lost there as that is",
  });
  function keepingOf(id) {
    const k = KEEPING[id];
    if (!k) throw new Error('goods: no keeping for ' + id);
    return k;
  }
  // The daily shares of a good kept by tiers (its tiers' yearly shares as a day's), reckoned once for a walk over many days (sim/outlook).
  const daily = (share) => 1 - Math.pow(1 - share, 1 / YEAR_DAYS);
  const shares = (st, id) => keepingOf(id).tiers(st).map(daily);
  // The day's loss of `held` by tiers of `unit`, at the daily shares q (shares).
  const tierLoss = (held, unit, q) =>
    Math.min(held, unit) * q[0] + Math.min(Math.max(0, held - unit), unit) * q[1] + Math.max(0, held - 2 * unit) * q[2];
  // The day's loss of `held` units of a good kept by tiers, `unit` held a tier (Infinity: all at the first). `flat`: a tier's index, when
  // the whole store keeps at that tier's rate (the village's store, ECON.villageStoreTier).
  function dayLoss(st, id, held, unit = Infinity, flat = -1) {
    if (!(held > 0)) return 0;
    if (flat >= 0) return held * daily(keepingOf(id).tiers(st)[flat]);
    return tierLoss(held, unit, shares(st, id));
  }
  // The days a good kept by date keeps (FOODS.keeps of a food): a lot put in at hour t spoils at t + keepsDays * DAY.
  const keepsDays = (id) => keepingOf(id).keepsDays;
  // A good's perish, as the registry declares it: its keeping row (a good of no row does not perish in store).
  const perishOf = (id) => {
    const k = KEEPING[id];
    if (!k || k.never) return null;
    return k.keepsDays ? { keepsDays: k.keepsDays } : { tiers: true };
  };
  // ---- goods (VB-299; target-v2 4.3; design.md, The fair): a registry of the goods that change hands, declared at load like a rule and
  // closed when the rules registry seals; code, never saved state. A good: id ('grain', 'cattle/cow'), kind and subtype, class (Culture.CLASSES:
  // which exchanges custom calls proper), unit (what is counted: a ration, a barrel, a head), quantum (units that change hands at once) and
  // lump (its name: a sack, a lot), rations (food a unit gives; 0 for what is not eaten), source (its source in the pot, as FOODS; null),
  // perish ({keepsDays}: a lot spoils by date; {tiers: true}: a share of the stock is lost by tiers; null: it does not perish in store; an
  // animal lives and dies as an animal): its keeping row (perishOf; VB-683), keeping (accepted beyond need, to be passed on; design.md,
  // The fair, Keeping goods). ----
  const GOODS = new Map();
  function declareGood(spec) {
    Rules.atLoad();
    const ok =
      spec &&
      typeof spec.id === 'string' &&
      !GOODS.has(spec.id) &&
      typeof spec.kind === 'string' &&
      Culture.CLASSES.includes(spec.class) &&
      typeof spec.unit === 'string' &&
      typeof spec.lump === 'string' &&
      spec.quantum > 0 &&
      spec.rations >= 0 &&
      typeof spec.keeping === 'boolean' &&
      (spec.perish === null || spec.perish.keepsDays > 0 || spec.perish.tiers === true) &&
      Culture.norm('worth', spec.id) > 0;
    if (!ok) throw new Error('stores: invalid or duplicate good ' + (spec && spec.id));
    GOODS.set(
      spec.id,
      Object.freeze({ subtype: null, source: null, ...spec, perish: spec.perish && Object.freeze({ ...spec.perish }) }),
    );
  }
  function goodOf(id) {
    const g = GOODS.get(id);
    if (!g) throw new Error('stores: unknown good ' + id);
    return g;
  }
  const goods = () => [...GOODS.values()];
  // The goods the fair trades (design.md, Quanta and worth). Wool and cheese are not goods yet (slice 6); labour days are promises (slice 5).
  const food = (id, lump, source, keeping) => ({
    id,
    kind: id,
    class: 'food',
    unit: 'ration',
    quantum: 10,
    lump,
    rations: 1,
    source,
    perish: perishOf(id),
    keeping,
  });
  declareGood(food('grain', 'sack', 'grain', false));
  declareGood(food('butter', 'lot', 'milk', true));
  declareGood(food('salt meat', 'lot', 'meat', true));
  declareGood(food('dried fish', 'lot', 'fish', true)); // through winter and spring (VB-300 makes it)
  declareGood({
    id: 'ale',
    kind: 'ale',
    class: 'food',
    unit: 'barrel',
    quantum: 1,
    lump: 'barrel',
    rations: 0,
    perish: perishOf('ale'),
    keeping: false,
  }); // poured for guests, not eaten as rations (VB-305)
  declareGood({
    id: 'hide',
    kind: 'hide',
    class: 'wares',
    unit: 'hide',
    quantum: 1,
    lump: 'hide',
    rations: 0,
    perish: null,
    keeping: true,
  }); // a roe deer's hide (VB-424)
  declareGood({
    id: 'tar',
    kind: 'tar',
    class: 'wares',
    unit: 'barrel',
    quantum: 1,
    lump: 'barrel',
    rations: 0,
    perish: null,
    keeping: true,
  });
  for (const k of ['cow', 'ox', 'heifer', 'steer'])
    declareGood({
      id: 'cattle/' + k,
      kind: 'cattle',
      subtype: k,
      class: 'wares',
      unit: 'head',
      quantum: 1,
      lump: 'head',
      rations: 0,
      perish: null,
      keeping: false,
    });
  declareGood({
    id: 'sheep',
    kind: 'sheep',
    class: 'wares',
    unit: 'head',
    quantum: 1,
    lump: 'head',
    rations: 0,
    perish: null,
    keeping: true,
  });
  // Culture's two norms on goods as rules, so the registry lists and explains them (Culture.norm is the table; norms learn in slice 8):
  // worth, rations a quantum, with the context {good}; proper, the index in Culture.PROPER of what custom calls giving a good of class `from`
  // for one of class `to`, with the context {from, to, days} (days: the giving side's food, in days of its need).
  Rules.declare({
    id: 'worth',
    owner: 'culture',
    combine: 'sum',
    base: (st, c) => Culture.norm('worth', c.good.id),
    clamp: [0, 1e9],
  });
  Rules.declare({
    id: 'proper',
    owner: 'culture',
    combine: 'sum',
    base: (st, c) => Culture.PROPER.indexOf(Culture.norm('proper', c.from, c.to, c.days)),
    clamp: [0, Culture.PROPER.length - 1],
  });
  return {
    GOODS,
    keepingOf,
    dayLoss,
    shares,
    tierLoss,
    keepsDays,
    declareGood,
    goodOf,
    goods,
    GRAIN,
    CROP_LIST,
    CROP_GOOD,
    GOOD_CROP,
    isGrain,
    grainGood,
  };
})();
