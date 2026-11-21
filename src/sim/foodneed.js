// @sys sim/foodneed: how a household values food in exchange, given its stores and the time until harvest
VB['sim/foodneed'] = (() => {
  const { FOODS, DAY, YEAR_DAYS, SEASON_DAYS } = VB['sim/rules'];
  const Goods = VB['sim/goods'];
  const { grainOf, reserved } = VB['sim/stores'];
  const { larderOf } = VB['sim/larder'];
  const Pot = VB['sim/pot'];
  const { dailyNeed } = VB['sim/hunger'];
  const { bufferOf } = VB['sim/traits'];
  const Rules = VB['sim/registry'];

  // ---- need (VB-299; design.md, The fair: Need; target-v2 5.1): what a quantity of a good is worth to the household taking it now, in rations of
  // its welfare; the sum of each good's term, by the module that knows the need (food here, animals sim/byre, tar and ale sim/exchange). The
  // context is {hh, good (a good of sim/goods), n (quanta; below 0, what giving them up costs), kept (rations' worth of keeping goods it
  // holds to pass on)}; sim/exchange's needValue reads it. A term allocates nothing. ----
  Rules.declare({ id: 'need', owner: 'sim/foodneed', combine: 'sum', base: () => 0 });
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
  // The food a household holds, in rations: its grain and flour, its larder and its fresh food (VB-119; read with st, for the batches past their day);
  // and in days of its need (Infinity with nobody to feed).
  const foodHeld = (hh, st) =>
    grainOf(hh) + (hh.flour || 0) + larderOf(hh) + (st && hh.fresh.length ? Pot.freshHeld(st, hh) : 0);
  function daysOfFood(st, hh) {
    const need = dailyNeed(st, hh);
    return need > 0 ? foodHeld(hh, st) / need : Infinity;
  }
  // The food a household holds of one source of the pot (FOODS' source; dried fish 'fish').
  function sourceHeld(st, hh, source) {
    let s = source === 'grain' ? grainOf(hh) + hh.flour : 0;
    for (const l of hh.larder) {
      const f = FOODS[l.kind],
        src = f ? f.source : Goods.GOODS.has(l.kind) ? Goods.GOODS.get(l.kind).source : null;
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
    source: 'sim/foodneed',
    key: 'food',
    label: 'Food against the year ahead',
    tunables: ['TRAITS.acts.generosity.reserve', 'HELP.floorDays', 'NEED.empty', 'NEED.beyond', 'NEED.lacking'],
    value: (st, c) => {
      const r = c.n * c.good.quantum * c.good.rations;
      if (r === 0) return 0;
      const hh = c.hh,
        need = dailyNeed(st, hh),
        held = foodHeld(hh, st);
      if (!(need > 0)) return NEED.beyond * r;
      const days = toHarvest(st.t),
        buffer = bufferOf(st, hh.holder);
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
  return { NEED, toHarvest, foodHeld, daysOfFood, stockWorth };
})();
