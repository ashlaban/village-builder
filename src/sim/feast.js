// @sys sim/feast: what a host household lays out at an occasion at its farm (VB-458, VB-305; split from sim/occasions, VB-1270): the ale
//   it pours and the guests' memory of it, the feast from its grain above the rule 'feast', and what each guest household owes for what it
//   ate and drank (the gift's booking between the holders)
VB['sim/feast'] = (() => {
  const { DAY, BREW, YEAR_DAYS } = VB['sim/rules'];
  const { fullName, log, atFarm, age } = VB['sim/records'];
  const { emit } = VB['sim/events'],
    { remember, book } = VB['sim/relations'],
    Stores = VB['sim/stores'];
  const Rules = VB['sim/registry'],
    Traits = VB['sim/traits'],
    { dailyNeed } = VB['sim/hunger'];
  // @tunable FEAST: what a host lays out at a feast, and when it is due
  // The feast (VB-458; design.md, The gift: The feast, What a feast books; Kim, 13 Nov): at a wedding or a funeral ale at its farm, a
  // household whose grain stands above its seed and `above` years of its need lays out food: `share` of what it holds beyond that (times its
  // holder's generosity, TRAITS.acts.generosity.feast), and at most `perGuest` rations a ration of need of those who came (a day's food
  // three times over, the ale poured counted at its grain). Those who ate have eaten the day's meal; guest households owe the host goodwill.
  const FEAST = { above: 2, share: 0.25, perGuest: 3 };
  // The host household pours its ale for those who came (VB-305; a barrel serves BREW.guests): as many barrels as it has for them, used up through
  // sim/stores with the reason 'pour', at most `most` (an ale evening's one). Each guest of another household remembers the host's holder
  // for it (SOCIAL.memories.ale), and the host's standing is told to sim/society ('alePoured'). Returns the barrels poured.
  function pourAle(st, f, present, most = Infinity) {
    if (f.household === null) return 0;
    const hh = st.households[f.household];
    if (hh.dissolved || hh.holder === null || !st.pawns[hh.holder].alive) return 0;
    const barrels = Stores.pour(st, hh, Math.min(Stores.aleOf(st, hh), Math.ceil(present.length / BREW.guests), most));
    if (!barrels) return 0;
    for (const id of present)
      if (id !== hh.holder && st.pawns[id].alive && st.pawns[id].household !== hh.id)
        remember(st, id, hh.holder, 'ale');
    emit(st, 'alePoured', { host: hh.holder, household: hh.id, barrels });
    return barrels;
  }
  // ---- the feast (VB-458; design.md, The gift: The feast, What a feast books) ----
  // The rule 'feast', with the context {hh}: the grain the household holds beyond its seed and FEAST.above years of its need, which it
  // feasts from when above 0; the household's panel explains it (Sim.explainFeast). Allocates nothing.
  Rules.declare({ id: 'feast', owner: 'sim/feast', combine: 'sum', base: (st, c) => Stores.grainOf(c.hh) });
  Rules.contribute({
    rule: 'feast',
    source: 'sim/feast',
    key: 'seed',
    label: 'Seed for its fields',
    tunables: [],
    value: (st, c) => -Stores.reserved(st, c.hh, 'grain'),
  });
  Rules.contribute({
    rule: 'feast',
    source: 'sim/feast',
    key: 'keep',
    label: 'Years of food kept',
    tunables: ['FEAST.above'],
    value: (st, c) => -FEAST.above * YEAR_DAYS * dailyNeed(st, c.hh),
  });
  const fctx = { hh: null }; // reused, so the rule's value allocates nothing
  function surplus(st, hh) {
    fctx.hh = hh;
    const v = Rules.value(st, 'feast', fctx);
    fctx.hh = null;
    return v;
  }
  const explainFeast = (st, hh) => Rules.explain(st, 'feast', { hh });
  // What a feast books (design.md, The gift): what pawn p ate and drank at household hh's is owed to the host's holder by p's household,
  // when it has a living holder not the host's (that household, else null). bookAll books each sum of `owed` (household to worth) by the
  // gift's booking between the two holders (relations' book) and returns the whole.
  function owing(st, hh, p) {
    const g = p.household === null ? null : st.households[p.household];
    return !g || g === hh || g.holder === null || g.holder === hh.holder || !st.pawns[g.holder].alive ? null : g;
  }
  function bookAll(st, hh, owed) {
    let booked = 0;
    for (const [g, worth] of owed) {
      book(st, hh.holder, g.holder, worth); // the host's holder is owed the worth (What a feast books: the two holders)
      booked += worth;
    }
    return booked;
  }
  const ration = (st, p) => (age(st, p) >= 14 ? st.ECON.ration.adult : st.ECON.ration.child); // as sim/hunger's day's need
  // The host household of farm f lays out food for those `present` (its own members too) after `barrels` of ale were poured, if its holder
  // lives and its grain stands above the rule 'feast': its share of the surplus (FEAST.share, times the holder's generosity), at most
  // FEAST.perGuest a ration of need of those who eat, less the ale's grain. A feast too small to make each a day's meal is not laid out.
  // Each eats its part by its ration, and has eaten the day's meal (pawn.feast; sim/hunger feeds it no more that day); each guest
  // household with a living holder owes the host's holder the worth of what its members ate and drank, ale at its grain (relations'
  // book, the gift's rule). Returns {eaten, rations} or null.
  // @state pawn.feast: absent, or {t (game hour), n (rations it ate), host (the household that laid it out)}: the last feast the pawn ate
  //   at; written only here, read by sim/hunger (the day's meal) and the invariants.
  function feast(st, f, present, barrels) {
    if (f.household === null) return null;
    const hh = st.households[f.household];
    if (hh.dissolved || hh.holder === null || !st.pawns[hh.holder].alive) return null;
    const excess = surplus(st, hh);
    if (!(excess > 0)) return null;
    const eaters = present.filter((id) => {
      const p = st.pawns[id];
      return p.alive && (p.feast === undefined || st.t - p.feast.t >= DAY); // one feast a day
    });
    let need = 0;
    for (const id of eaters) need += ration(st, st.pawns[id]);
    const ale = barrels * BREW.grain,
      offered = FEAST.share * Traits.act(st, hh.holder, 'generosity', 'feast') * excess,
      served = Math.min(offered, FEAST.perGuest * need - ale);
    if (!(need > 0) || served < need) return null;
    const keep = Stores.grainOf(hh) - excess,
      owed = new Map(),
      aleEach = ale / present.length;
    for (const id of eaters) {
      const p = st.pawns[id],
        n = (served * ration(st, p)) / need;
      VB.count.feastServed++;
      p.feast = { t: st.t, n, host: hh.id };
      const g = owing(st, hh, p);
      if (g) owed.set(g, (owed.get(g) || 0) + n + aleEach);
    }
    const booked = bookAll(st, hh, owed);
    const left = Stores.grainOf(hh) - served; // above keep, as served is a share of the excess (tests/lib/invariants.js)
    Stores.takeSpare(st, hh, served, { kind: 'feast', guests: eaters.length, booked, keep, left });
    const host = st.pawns[hh.holder];
    log(
      st,
      `${fullName(host)} laid out a feast at ${f.name}: ${eaters.length} ate, ${Math.round(served)} rations of food.`,
      { kind: 'feast', pawn: host.id, n: Math.round(served), ...atFarm(f) },
    );
    return { eaten: eaters.length, rations: served };
  }
  return { FEAST, pourAle, surplus, explainFeast, owing, bookAll, feast };
})();
