// @sys sim/targets: the head's target on each stored good a household makes (VB-698): the goods with a maker, declared at load by the
// module that makes each; the target a household's plan holds for a good (sim/plans compiles it at the head's review), its default (the
// household's need, as the maker's rule sets it) and its bounds (what the place and the hands allow); the working hands of a household
// Design: AGENTS.md, Deciding without Kim (7, 9, 16); design.md, Goods, production and animals. What a household makes of each good is its
// head's target: its own need by default, plus what the head means to give or exchange (VB-699 reads the asks); the played head sets it by
// the verb `target` (sim/commands, sim/plans' setTarget), within the bounds. A made good's maker reads the target where it asked its own
// constant before (DIG.stock, BREW.stock, the dried fish wanted, the barrels a pit's household keeps): a held stock below the target is
// work to post. A target is on a good, never on a grade of workmanship (Kim, 16 Nov; VB-702).
VB['sim/targets'] = (() => {
  const { targetOf } = VB['sim/steps'];
  const { BREW, AGES } = VB['sim/rules'];
  const Rules = VB['sim/registry'];
  const { age } = VB['sim/records'];
  const Stores = VB['sim/stores'];
  // Proposed (VB-698): spareHours, the hours of a year a working hand can give to a side craft beyond what its household needs (about
  // a month of days in the slack: the hay, the harvest and the sowing take the rest); a good's top bound is its need and what the hands
  // make besides in those hours. A tunable for the tuning run, not a limit on any work: it bounds only what a head may choose.
  const TARGET = { spareHours: 200 };
  // ---- the registry: a good a household makes (code, never saved state; closed when the rules registry seals) ----
  // A made good: good (its id: the store's field or the larder's kind, 'dried fish', 'tar', 'peat'), unit (what is counted), whole (whether
  // its target is a whole number), need(st, hh, f) (the default target: what the household's rule wants held now; Infinity where the
  // maker has no cap of its own: butter and salt meat are what the milk and the meat give, peat what the fuel pile's goal asks),
  // most(st, hh, f, spare) (what may be held beyond a finite need, or in all beside an infinite one: what the place allows, and the hands
  // in `spare` hours; 0 where the place has none), held(st, hh) (what the household holds of it now).
  const MADE = new Map();
  function made(spec) {
    Rules.atLoad();
    const ok =
      spec &&
      typeof spec.good === 'string' &&
      !MADE.has(spec.good) &&
      typeof spec.unit === 'string' &&
      typeof spec.whole === 'boolean' &&
      typeof spec.need === 'function' &&
      typeof spec.most === 'function' &&
      typeof spec.held === 'function';
    if (!ok) throw new Error('sim/targets: invalid or duplicate made good ' + (spec && spec.good));
    MADE.set(spec.good, Object.freeze({ ...spec }));
  }
  const isMade = (good) => MADE.has(good);
  const madeGoods = () => [...MADE.keys()];
  const farmOf = (st, hh) => (hh.farmstead === null ? null : st.farmsteads[hh.farmstead]);
  // The working hands of household hh: its living members from 14 to 59 who are not retired.
  function hands(st, hh) {
    let n = 0;
    for (const id of hh.members) {
      const p = st.pawns[id],
        a = age(st, p);
      if (p.died === null && a >= AGES.hands[0] && a < AGES.hands[1] && !p.retired) n++;
    }
    return n;
  }
  // The household's rule's target for a good now: its need (the default target).
  const need = (st, hh, good) => MADE.get(good).need(st, hh, farmOf(st, hh));
  // The target household hh holds for a good: the one its plan compiled at its head's last review (sim/plans), else, before a first
  // review or with no plan, its need now. One read; allocates nothing.
  function target(st, hh, good) {
    const P = st.plans && st.plans.households,
      plan = P && P.get && P.get(hh.id),
      G = targetOf(plan, good);
    const n = G ? G.level : undefined;
    return n === undefined ? need(st, hh, good) : n;
  }
  // The bounds of a good's target for household hh, [least, most]: 0 to its need (where finite) and what the place and the hands allow
  // beyond it; null for a good no household makes. Read by the head's verb and the page's view, never in a step.
  function bounds(st, hh, good) {
    const M = MADE.get(good);
    if (!M) return null;
    const f = farmOf(st, hh),
      n = M.need(st, hh, f),
      most = M.most(st, hh, f, hands(st, hh) * TARGET.spareHours);
    return [0, Number.isFinite(n) ? n + most : most];
  }
  // What the page shows of the goods' targets: each made good's held stock, the target now, the household's rule's (its need), the
  // head's choice (null for none), its bounds and what the head reckons it can place of the asks it read beyond its need (VB-699: its
  // estimate, from plan.placed; 0 for none). Plain data.
  function view(st, hh, chosen, placed) {
    const out = {};
    for (const [good, M] of MADE)
      out[good] = {
        held: M.held(st, hh),
        now: target(st, hh, good),
        custom: need(st, hh, good),
        chosen: (chosen && chosen[good]) ?? null,
        bounds: bounds(st, hh, good),
        unit: M.unit,
        placed: (placed && placed[good]) || 0,
      };
    return out;
  }
  // Ale as a made good: brewed in sim/stores and posted by sim/kinds (both at their size baselines: VB-416, VB-418 split them), so its
  // entry is here. BREW.stock barrels by default; beyond that, the barrels the spare hours brew (the grain above the floor is asked at
  // the brewing, sim/kinds' brewWanted).
  made({
    good: 'ale',
    unit: 'barrel',
    whole: true,
    need: () => BREW.stock,
    most: (st, hh, f, spare) => Math.floor(spare / BREW.hours),
    held: (st, hh) => Stores.aleOf(st, hh),
  });
  return { TARGET, MADE, made, isMade, madeGoods, hands, need, target, bounds, view };
})();
