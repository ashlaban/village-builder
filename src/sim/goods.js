// @sys sim/goods: the catalog of trade goods, grain subtype identifiers and culture's worth and propriety rules
VB['sim/goods'] = (() => {
  const { CROPS, ECON, HERD, YEAR_DAYS, SEASON_DAYS } = VB['sim/rules'];
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
  // ---- goods (VB-299; target-v2 4.3; design.md, The fair): a registry of the goods that change hands, declared at load like a rule and
  // closed when the rules registry seals; code, never saved state. A good: id ('grain', 'cattle/cow'), kind and subtype, class (Culture.CLASSES:
  // which exchanges custom calls proper), unit (what is counted: a ration, a barrel, a head), quantum (units that change hands at once) and
  // lump (its name: a sack, a lot), rations (food a unit gives; 0 for what is not eaten), source (its source in the pot, as FOODS; null),
  // perish ({keepsDays}: a lot spoils by date; {lossPerYear}: a share of the stock is lost; null: it does not perish in store; an animal
  // lives and dies as an animal), keeping (accepted beyond need, to be passed on; design.md, The fair, Keeping goods). ----
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
      (spec.perish === null || spec.perish.keepsDays > 0 || spec.perish.lossPerYear > 0) &&
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
  const food = (id, lump, source, perish, keeping) => ({
    id,
    kind: id,
    class: 'food',
    unit: 'ration',
    quantum: 10,
    lump,
    rations: 1,
    source,
    perish,
    keeping,
  });
  declareGood(food('grain', 'sack', 'grain', { lossPerYear: ECON.storeLoss[0] }, false)); // more of what is held beyond a year (sim/hunger)
  declareGood(food('butter', 'lot', 'milk', { keepsDays: HERD.butterDays }, true));
  declareGood(food('salt meat', 'lot', 'meat', { keepsDays: HERD.saltDays }, true));
  declareGood(food('dried fish', 'lot', 'fish', { keepsDays: YEAR_DAYS }, true)); // through winter and spring (VB-300 makes it)
  declareGood({
    id: 'ale',
    kind: 'ale',
    class: 'food',
    unit: 'barrel',
    quantum: 1,
    lump: 'barrel',
    rations: 0,
    perish: { keepsDays: SEASON_DAYS },
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
  return { GOODS, declareGood, goodOf, goods, GRAIN, CROP_LIST, CROP_GOOD, GOOD_CROP, isGrain, grainGood };
})();
