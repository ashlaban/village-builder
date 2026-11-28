// @sys sim/goods [material]: the catalog of trade goods with their materials and kinds (VB-733), grain subtype identifiers and culture's worth and propriety
//   rules
VB['sim/goods'] = (() => {
  const { FOODS, HERD, YEAR_DAYS, SEASON_DAYS } = VB['sim/rules'],
    { CROPS } = VB['sim/crops'];
  const Rules = VB['sim/registry'],
    Norms = VB['sim/norms'];
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
  KEEPING.salt = Object.freeze({
    never: 'boiled dry and kept in a sack under the roof, it keeps (sim/saltpan, VB-700)',
  });
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
  // closed when the rules registry seals; code, never saved state. A good: id ('grain', 'cattle/cow'), kind and subtype, class (Norms.CLASSES:
  // which exchanges custom calls proper), unit (what is counted: a ration, a barrel, a head), quantum (units that change hands at once) and
  // lump (its name: a sack, a lot), rations (food a unit gives; 0 for what is not eaten), source (its source in the pot, as FOODS; null),
  // perish ({keepsDays}: a lot spoils by date; {tiers: true}: a share of the stock is lost by tiers; null: it does not perish in store; an
  // animal lives and dies as an animal): its keeping row (perishOf; VB-683), keeping (accepted beyond need, to be passed on; design.md,
  // The fair, Keeping goods), weight (optional, VB-700: rations of TRAVEL.load a unit weighs; VB-684 gives every good one). ----
  // ---- materials and kinds (VB-733; design.md, The metals and the stones: goods by purpose, kinds by property; design.md, "A good, its material and its
  // kind"): a good is
  // what it is for and is made of a material, its `material`, one of MATERIALS (`class` keeps its meaning, custom's class of exchange). A
  // good with kinds lists them (at most KINDS_MAX), each a key of its material's table of properties below, and names the properties its
  // use reads (`reads`); the kind is the good's subtype, 'quern/granite', carried from the material into the good, with no record for each
  // item. Each good and kind is compiled at load into one frozen row ({id, good, kind, worth, ...the properties read}), read by kindRow
  // without allocating. Worth is custom's row for each good and kind (sim/norms), never computed from the properties (D14). ----
  const MATERIALS = Object.freeze(['stone', 'metal', 'clay', 'wood', 'ore', 'amber']),
    KINDS_MAX = 8;
  // @tunable STONE: the stones' physical properties that a good's use reads, one row a rock of world/geology's ROCKS (design.md, The
  // metals and the stones, The kinds; Proposed, 16 Nov, the plan of VB-702). grit: the rate a quern or a millstone of the rock grinds,
  // against sandstone's even grit (granite's coarse, uneven crystals grind at 0.8, QUERN.granite of VB-009); 0 where the rock cannot be
  // dressed into a grinding stone (limestone and marble are too soft, slate splits into sheets, soapstone is cut with a knife).
  const STONE = Object.freeze({
    granite: Object.freeze({ grit: 0.8 }),
    limestone: Object.freeze({ grit: 0 }),
    sandstone: Object.freeze({ grit: 1 }),
    slate: Object.freeze({ grit: 0 }),
    marble: Object.freeze({ grit: 0 }),
    soapstone: Object.freeze({ grit: 0 }),
  });
  const PROPERTIES = Object.freeze({ stone: STONE }); // a material's table of kinds; metal, clay, ore and amber join with their goods
  const ROWS = {}; // good -> {kind -> its frozen row}; filled at load, never saved
  const NO_KINDS = Object.freeze([]);
  function compileKinds(spec) {
    const table = PROPERTIES[spec.material],
      reads = spec.reads || NO_KINDS,
      rows = {};
    if (!table || spec.kinds.length > KINDS_MAX || new Set(spec.kinds).size !== spec.kinds.length) return null;
    for (const kind of spec.kinds) {
      const props = table[kind],
        id = spec.id + '/' + kind,
        worth = Norms.norm('worth', id);
      if (!props || !(worth > 0) || reads.some((p) => typeof props[p] !== 'number')) return null;
      const row = { id, good: spec.id, kind, worth };
      for (const p of reads) row[p] = props[p];
      if (spec.graded) row.grades = gradeRows(spec, row);
      rows[kind] = Object.freeze(row);
    }
    return Object.freeze(rows);
  }
  // ---- workmanship (VB-761; the plan of VB-702, 13.1 and 13.4): a made good declares `graded: {work: [properties]}`, the properties of
  // its kinds that a grade's `work` multiplies (the effect its use reads: a quern's grit); every grade's `life` multiplies how long a piece
  // lasts, read by the good's own module from its row. Each kind's row carries `grades`, one frozen row a grade, compiled here at load:
  // {id, good, kind, grade, worth (custom's worth of the kind times custom's multiplier for the grade), life, work, ...the properties read,
  // those named scaled by work}, so a reader allocates nothing. The grade is not part of a good's id. ----
  const Workmanship = VB['sim/workmanship'];
  function gradeRows(spec, row) {
    const W = Workmanship.WORKMANSHIP,
      scaled = spec.graded.work || NO_KINDS;
    if (scaled.some((p) => typeof row[p] !== 'number'))
      throw new Error('stores: graded good scales a property it does not read ' + spec.id);
    return Object.freeze(
      W.grades.map((_, g) => {
        const r = {
          ...row,
          grade: g,
          worth: row.worth * Norms.norm('workmanship', g),
          life: W.life[g],
          work: W.work[g],
        };
        for (const p of scaled) r[p] = row[p] * W.work[g];
        return Object.freeze(r);
      }),
    );
  }
  const GOODS = new Map();
  function declareGood(spec) {
    Rules.atLoad();
    const kinded = !!(spec && spec.kinds),
      ok =
        spec &&
        typeof spec.id === 'string' &&
        !GOODS.has(spec.id) &&
        typeof spec.kind === 'string' &&
        Norms.CLASSES.includes(spec.class) &&
        typeof spec.unit === 'string' &&
        typeof spec.lump === 'string' &&
        spec.quantum > 0 &&
        spec.rations >= 0 &&
        typeof spec.keeping === 'boolean' &&
        (spec.weight === undefined || spec.weight > 0) &&
        (spec.material === undefined || MATERIALS.includes(spec.material)) &&
        (!kinded || (Array.isArray(spec.kinds) && spec.material !== undefined)) &&
        (spec.graded === undefined || kinded) && // VB-761: a graded good has kinds, today; one of no kinds would carry its own rows
        (spec.perish === null || spec.perish.keepsDays > 0 || spec.perish.tiers === true) &&
        Norms.norm('worth', spec.id) > 0,
      rows = ok && kinded ? compileKinds(spec) : null;
    if (!ok || (kinded && !rows)) throw new Error('stores: invalid or duplicate good ' + (spec && spec.id));
    if (rows) ROWS[spec.id] = rows;
    GOODS.set(
      spec.id,
      Object.freeze({
        subtype: null,
        source: null,
        material: null,
        ...spec,
        kinds: kinded ? Object.freeze([...spec.kinds]) : NO_KINDS,
        // the kinds by customary worth, least first, ties in the order declared: what a take of the good, any kind, spends first
        cheapest: kinded
          ? Object.freeze(
              spec.kinds
                .map((k, i) => [rows[k].worth, i, k])
                .sort((a, b) => a[0] - b[0] || a[1] - b[1])
                .map((e) => e[2]),
            )
          : NO_KINDS,
        reads: Object.freeze([...(spec.reads || [])]),
        graded: spec.graded ? Object.freeze({ work: Object.freeze([...(spec.graded.work || [])]) }) : null,
        perish: spec.perish && Object.freeze({ ...spec.perish }),
      }),
    );
  }
  // The row of a good's kind ('quern', 'granite'), or undefined for a kind the good has not. Allocates nothing.
  const kindRow = (good, kind) => {
    const rows = ROWS[good];
    return rows ? rows[kind] : undefined;
  };
  // A good's kinds, in the order declared (an empty list for a good of no kinds).
  const kindsOf = (good) => goodOf(good).kinds;
  // A good's id split at its kind: 'stone/granite' -> 'stone' and 'granite'; a good of no kinds, or the good itself, has kind null.
  const baseOf = (id) => {
    const i = id.indexOf('/');
    return i > 0 && ROWS[id.slice(0, i)] ? id.slice(0, i) : id;
  };
  const kindIn = (id) => {
    const i = id.indexOf('/');
    return i > 0 && ROWS[id.slice(0, i)] ? id.slice(i + 1) : null;
  };
  function goodOf(id) {
    const g = GOODS.get(id);
    if (!g) throw new Error('stores: unknown good ' + id);
    return g;
  }
  const goods = () => [...GOODS.values()];
  // The goods the fair trades (design.md, Quanta and worth). Wool and cheese are not goods yet (slice 6; yarn and cloth are, VB-362);
  // labour days are promises (slice 5).
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
  // Wool to cloth (VB-362, sim/textile): a skein of yarn, and a length of woollen cloth, of the grade its weaver's skill drew (counted by
  // grade in the household's store, sim/stores; custom's worth here is a sound length's). Not yet dealt at the fair (VB-363 wears cloth).
  for (const id of ['yarn', 'cloth'])
    declareGood({
      id,
      kind: id,
      class: 'wares',
      unit: id === 'yarn' ? 'skein' : 'length',
      quantum: 1,
      lump: id === 'yarn' ? 'skein' : 'length',
      rations: 0,
      perish: null,
      keeping: true,
    });
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
  // A load of stone (VB-332's heap, in loads of 25 stones) by its rock (VB-733): quarried of its tile's bedrock, picked or cleared as granite
  // (sim/building, sim/meadows, sim/newground); the foundation and the well take any kind, the quern a kind it can be hewn of (sim/quern).
  // Kept in the household's heap, not dealt at the fair.
  declareGood({
    id: 'stone',
    kind: 'stone',
    class: 'wares',
    unit: 'load',
    quantum: 1,
    lump: 'load',
    rations: 0,
    perish: null,
    keeping: false,
    material: 'stone',
    kinds: Object.keys(STONE),
  });
  // The two norms on goods (sim/norms) as rules, so the registry lists and explains them (Norms.norm is the table; norms learn in slice 8):
  // worth, rations a quantum, with the context {good, grade?} (VB-761: a made piece's grade of workmanship multiplies by custom's multiplier
  // for it, sim/norms; none given is sound); proper, the index in Norms.PROPER of what custom calls giving a good of class `from`
  // for one of class `to`, with the context {from, to, days} (days: the giving side's food, in days of its need).
  Rules.declare({
    id: 'worth',
    owner: 'culture',
    combine: 'sum',
    base: (st, c) => Norms.norm('worth', c.good.id) * (c.grade == null ? 1 : Norms.norm('workmanship', c.grade)),
    clamp: [0, 1e9],
  });
  Rules.declare({
    id: 'proper',
    owner: 'culture',
    combine: 'sum',
    base: (st, c) => Norms.PROPER.indexOf(Norms.norm('proper', c.from, c.to, c.days)),
    clamp: [0, Norms.PROPER.length - 1],
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
    kindRow,
    kindsOf,
    baseOf,
    kindIn,
    GRAIN,
    CROP_LIST,
    CROP_GOOD,
    GOOD_CROP,
    isGrain,
    grainGood,
  };
})();
