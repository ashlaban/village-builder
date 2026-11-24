// @sys sim/yields: a head's remembered yield of each source of food (VB-767): a household's yearly tally of rations by source, booked by
// sim/stores with each food operation, closed at the head's planning day after the harvest into a ring of FIELDS.memory years a source;
// what the head expects of a source (poor and mean), how cautious it is, and what it trusts its sources other than its fields to bring
// (trusted, which sim/fieldplans' fieldsWanted takes off the food its fields must grow: VB-768).
// Design: docs/plans/VB-189.md section 5.5; principle "The future is someone's estimate" (the future is someone's estimate).
VB['sim/yields'] = (() => {
  const { FIELDS } = VB['sim/rules'],
    { CROPS } = VB['sim/crops'];
  const { on } = VB['sim/events'];
  const Traits = VB['sim/traits'];
  // The sources, and which reason books to which. A trade is booked as a gift of the one who gave (sim/exchange), so 'deals' stays 0 until
  // a reason of its own exists; days worked for others are paid as a 'share' (sim/cottage).
  const SOURCES = Object.freeze(['fields', 'animals', 'fish', 'wild', 'deals', 'work', 'gifts']);
  const BY_KIND = {
    harvest: 'fields',
    milk: 'animals',
    butter: 'animals',
    meat: 'animals',
    catch: 'fish',
    gathering: 'wild',
    hunt: 'wild',
    gift: 'gifts',
    share: 'work',
  };
  const FOOD_GIFT = (good) =>
    good === 'grain' || good === 'meals' || good === 'flour' || String(good).startsWith('grain/');
  // @state household.yields: {tally: {[source]: rations >= 0} (booked since the last close), ring: {[source]: [rations a year, the latest
  //   last, at most FIELDS.memory]}, closed (the game year of the last close)}; the head's memory is the farm's, kept by its heir (VB-767)
  function make() {
    const tally = {},
      ring = {};
    for (const s of SOURCES) {
      tally[s] = 0;
      ring[s] = [];
    }
    return { tally, ring, closed: 0 };
  }
  const of = (hh) => hh.yields || (hh.yields = make());
  // A food operation, as sim/stores books it: n rations of `good` into a household for `why` (n > 0 only; what is taken out is no yield).
  function book(hh, good, n, why) {
    if (!(n > 0)) return;
    const s = BY_KIND[why.kind];
    if (s === undefined) return;
    if ((s === 'gifts' || s === 'work') && !FOOD_GIFT(good)) return;
    if (why.kind === 'harvest' && why.first) n = Math.max(0, n - CROPS[why.crop || 'barley'].seed); // the seed sown from the store
    if (!hh.yields) hh.yields = make();
    hh.yields.tally[s] += n;
  }
  function close(hh, year) {
    if (!hh.yields) hh.yields = make();
    for (const s of SOURCES) {
      hh.yields.ring[s].push(hh.yields.tally[s]);
      if (hh.yields.ring[s].length > FIELDS.memory) hh.yields.ring[s].shift();
      hh.yields.tally[s] = 0;
    }
    hh.yields.closed = year;
  }
  // What the head expects of a source: the second lowest and the mean of its ring; with under 3 years, poor 0 and half the mean so far.
  function expects(st, hh, source) {
    const r = of(hh).ring[source],
      years = r.length;
    if (!years) return { poor: 0, mean: 0, years };
    let sum = 0;
    for (let i = 0; i < years; i++) sum += r[i];
    const mean = sum / years;
    if (years < 3) return { poor: 0, mean: mean / 2, years };
    const low = r.slice().sort((a, b) => a - b);
    return { poor: low[1], mean, years };
  }
  // 0 bold to 1 cautious, from the head's bias on fields (sim/plans' plan.head.bias.fields); 0.5 for a head with none.
  function caution(st, hh) {
    const plan = st.plans && st.plans.households.get(hh.id),
      b = plan && plan.head ? plan.head.bias.fields : 1;
    return Math.max(0, Math.min(1, 0.5 + (b - 1) / (2 * Traits.HEAD.bias)));
  }
  // What the head trusts its sources other than its fields to bring in a year (VB-768; design.md, Fields a household wants): over each,
  // c x its poor year + (1 - c) x its mean, c the head's caution; what it was given (gifts and help) at its poor year only, whatever the
  // caution: a head does not plan on charity (a close call, backlog/VB-768.md). Nothing while the head remembers fewer than FIELDS.trustFrom
  // years (the household sizes its fields as before it had a memory). {total, by: {[source]: rations}, years, c}; a few reads, no draw.
  function trusted(st, hh) {
    if (!hh.yields) return { total: 0, by: {}, years: 0, c: 0.5 }; // read without making the record (a constructed household, the start)
    const c = caution(st, hh),
      by = {};
    let total = 0,
      years = 0;
    for (const s of SOURCES) {
      if (s === 'fields') continue;
      const e = expects(st, hh, s);
      years = Math.max(years, e.years);
      const n = s === 'gifts' ? e.poor : c * e.poor + (1 - c) * e.mean;
      by[s] = n;
      total += n;
    }
    if (years < FIELDS.trustFrom) return { total: 0, by: {}, years, c };
    return { total, by, years, c };
  }
  // The head's planning day after the harvest (winter's first review of the household): the tally closes into the ring.
  on('planReviewed', (st, d) => {
    if (d.why !== 'day' || d.c.season !== 3 || d.plan.holder.type !== 'household') return;
    const hh = st.households[d.plan.holder.id];
    if (!hh.dissolved && of(hh).closed !== d.c.year) close(hh, d.c.year);
  });
  return { SOURCES, book, expects, caution, trusted, of, close };
})();
