// @sys sim/outlook: the supply outlook (VB-666): how long a household's food, fuel and hay last, on one scale (seasons of need) over the
// four seasons from the start of the one we are in, by its head's reckoning at each review of its plan; kept in plan.outlook, read by the page
// Design: docs/mocks/supply-scale.html and supply-doubt.html (the UI review with Kim, 16 Nov); AGENTS.md, Deciding without Kim, 14 (the future
// is someone's estimate: this is the head's) and 15 (one scale for every supply). What is still to come is the plan's: the crop the head
// expects of its fields (FIELDS.expect of the full yield, as the plan reckons when it asks how many fields), the hay of its meadows in an
// ordinary year (sim/meadows' expectedHay), the woodpile's goal of each season (plan.targets.wood); no weather to come is read. Nothing
// reads the outlook to decide: it is a view the review keeps, so that the page never computes one.
VB['sim/outlook'] = (() => {
  const { SEASON_DAYS, YEAR_DAYS, CROPS, FIELDS, HERD, BUILD, PEAT, cal } = VB['sim/rules'];
  const { on } = VB['sim/events'];
  const Stores = VB['sim/stores'];
  const Pot = VB['sim/pot'];
  const { dailyNeed, larderOf, seedPer } = VB['sim/hunger'];
  const { householdHay } = VB['sim/herds'];
  const { HAY } = VB['sim/meadows'];
  const { fuelFree } = VB['sim/kinds'];
  const { hands } = VB['sim/targets'];
  // Proposed (VB-666): `little`, a first short season whose need is covered at least this share is short a little ('short'), else badly
  // ('bad'); `woodTrips`, the firewood trips a working hand makes in a season towards the pile's goal (ECON.woodPerTrip units each), which
  // bounds the wood the plan's goal brings in a season. Named tunables of the view; nothing in the simulation reads them.
  const OUTLOOK = Object.freeze({ little: 0.5, woodTrips: 6 });
  // The frame: four seasons from the start of the season we are in. A value of FRAME or more lasts the frame (safe).
  const FRAME = 4;
  const SUPPLIES = Object.freeze(['food', 'fuel', 'hay']);
  // What a supply's state says: 'safe' (it lasts the frame), 'short' or 'bad' (its first short season, `season`, is covered at least
  // OUTLOOK.little of its need, or less), 'none' (nothing needs it: no herds for hay, nobody to feed).
  const STATES = Object.freeze(['safe', 'short', 'bad', 'none']);
  // @state plan.outlook (a household's standing plan; VB-666): absent until its first review, then {year, season, day (of cal: when the
  //   head made it), food, fuel, hay}, each supply {own, with (seasons from the start of the season it was made in that the store alone,
  //   and the store with every intake the plan expects, last, spoilage taken off; 0 to FRAME), state (STATES), season (the first short
  //   season of the frame, 0 to 3, or null), seasons (the seasons of the year it is needed in: [0, 1, 2, 3], or [3] for hay), parts: {store
  //   (what is held now, in the supply's units), need (by season of the frame, from the start of the one we are in), intakes ([{what, season
  //   (of the frame), n}], summed by what and season), spoilt (what the reckoning with intakes lets spoil within the frame)}}. Made again at
  //   every review (sim/plans' event planReviewed): on the planning day, out of turn when a store crosses a target (the harvest stacked
  //   wakes it), and so at the first review of each season, which makes a stale one (made in an earlier season) anew. Plain data.
  const r2 = (x) => Math.round(x * 100) / 100,
    r1 = (x) => Math.round(x * 10) / 10;
  // One supply walked a day at a time from `from` (the absolute day today) to `to` (exclusive), the frame starting on day F: `keep` is held
  // and does not spoil, `rot` spoils by loss(rot) a day; need(d) is the day's need, inflow(d, held) what comes in on day d (into rot when
  // `intoRot`). The day's need is taken from keep first. Returns {at (days from F when it first ran short, Infinity if never), met, need (by
  // frame season, from today: what was eaten of the need and the need), spoilt}. Walks on after running short (the hay of a later winter).
  function walk(o) {
    let keep = o.keep,
      rot = o.rot,
      spoilt = 0,
      at = Infinity;
    const met = [0, 0, 0, 0, 0, 0],
      need = [0, 0, 0, 0, 0, 0];
    for (let d = o.from; d < o.to; d++) {
      const k = Math.floor((d - o.F) / SEASON_DAYS);
      if (o.inflow) {
        const n = o.inflow(d, keep + rot, k);
        if (o.intoRot) rot += n;
        else keep += n;
      }
      const want = o.need(d);
      const fromKeep = Math.min(keep, want),
        fromRot = Math.min(rot, want - fromKeep),
        got = fromKeep + fromRot;
      keep -= fromKeep;
      rot -= fromRot;
      if (k < need.length) {
        need[k] += want;
        met[k] += got;
      }
      if (got < want - 1e-9 && at === Infinity) at = d - o.F + (want > 0 ? got / want : 0);
      if (o.loss && rot > 0) {
        const l = Math.min(rot, o.loss(rot));
        rot -= l;
        if (d - o.F < FRAME * SEASON_DAYS) spoilt += l;
      }
    }
    return { at, met, need, spoilt };
  }
  // A day's loss of a store spoiling by tiers (ECON.storeLoss of grain, HERD.hayLoss of hay): a share a year of what is held up to one
  // `unit` (a year's need of food, a winter's of hay), of the next unit, and of the rest; times the barn's (BUILD.barn.loss with one).
  // q: the daily shares of the tiers (daily(L)), reckoned once a supply.
  const daily = (L) => L.map((s) => 1 - Math.pow(1 - s, 1 / YEAR_DAYS));
  function tierLoss(x, unit, q, barn) {
    if (!(unit > 0)) return 0;
    const a = Math.min(x, unit),
      b = Math.min(Math.max(0, x - unit), unit),
      c = Math.max(0, x - 2 * unit);
    return (a * q[0] + b * q[1] + c * q[2]) * barn;
  }
  // A supply's value and state from a walk on the seasons scale: when it first ran short, capped at the frame, and how much of that season's
  // need it covered.
  function reading(w) {
    const v = Math.min(FRAME, w.at / SEASON_DAYS);
    if (v >= FRAME) return { v: FRAME, state: 'safe', season: null };
    const k = Math.floor(v),
      share = w.need[k] > 0 ? w.met[k] / w.need[k] : 1;
    return { v, state: share >= OUTLOOK.little ? 'short' : 'bad', season: k };
  }
  // The intakes expected, summed by what and frame season, as plain rows.
  function rows(list, F) {
    const out = [];
    for (const [day, what, n] of list) {
      const season = Math.floor((day - F) / SEASON_DAYS);
      if (season >= FRAME || !(n > 0)) continue;
      const row = out.find((x) => x.what === what && x.season === season);
      if (row) row.n += n;
      else out.push({ what, season, n });
    }
    for (const x of out) x.n = r1(x.n);
    return out;
  }
  const farmOf = (st, hh) => {
    const f = hh.farmstead === null || hh.farmstead === undefined ? null : st.farmsteads[hh.farmstead];
    return f && f.household === hh.id ? f : null;
  };
  // The day a field's crop comes in, by the head's reckoning (absolute day), or null for none: a crop standing is in at its sowing day and
  // the crop's days to ripe; a field to be sown is sown on the first day of its crop's next window (today, inside it); stooks are in today.
  function cropDay(fd, c) {
    const C = CROPS[fd.crop];
    if (!C || C.fallow || !(C.seed > 0) || fd.stage === 'fallow' || fd.stage === 'scrub') return null;
    if (fd.stage === 'stooks' || fd.stage === 'ripe') return c.day;
    if (fd.sown !== null && fd.sown !== undefined) return Math.max(c.day, fd.sown + C.ripe);
    const y0 = c.day - c.doy,
      first = y0 + C.sow[0] * SEASON_DAYS + C.sow[1],
      last = y0 + C.sow[0] * SEASON_DAYS + C.sow[2];
    const sow = c.day <= last ? Math.max(c.day, first) : first + YEAR_DAYS;
    return sow + C.ripe;
  }
  // Food: grain above the seed (it spoils), and the meals, flour, sheaves, larder and fresh food (kept), over the household's daily need.
  // Its intakes: each field's crop, FIELDS.expect of its full yield less the seed it takes back (stooks: what lies in them, less the seed).
  function food(st, hh, f, c, F, end) {
    const D = dailyNeed(st, hh),
      seed = hh.farmstead === null ? 0 : Stores.reserved(st, hh, 'grain'), // a household with no farm keeps no seed
      rot = Math.max(0, Stores.grainOf(hh) - seed),
      sheaves = (hh.unthreshed || []).reduce((s, x) => s + (+x || 0), 0),
      keep =
        (hh.meals || 0) +
        (hh.flour || 0) +
        sheaves +
        larderOf(hh) +
        (hh.fresh && hh.fresh.length ? Pot.freshHeld(st, hh) : 0);
    const ins = [];
    if (f) {
      const back = seedPer(st, hh);
      for (const fd of f.fields) {
        const day = cropDay(fd, c);
        if (day === null || day >= end) continue;
        const gross = fd.stage === 'stooks' ? fd.held || 0 : FIELDS.expect * CROPS[fd.crop].yield;
        ins.push([day, fd.crop, Math.max(0, gross - back)]);
      }
    }
    ins.sort((a, b) => a[0] - b[0]);
    const barn = f && f.barn ? BUILD.barn.loss : 1,
      year = D * YEAR_DAYS,
      q = daily(st.ECON.storeLoss),
      loss = (g) => (g > 0 ? (tierLoss(g + seed, year, q, barn) * g) / (g + seed) : 0);
    const base = { from: c.day, to: end, F, keep, rot, need: () => D, loss, intoRot: true };
    let j = 0;
    const own = walk(base),
      w = walk({
        ...base,
        inflow: (d) => {
          let n = 0;
          while (j < ins.length && ins[j][0] <= d) n += ins[j++][2];
          return n;
        },
      });
    return supply(own, w, D > 0, [0, 1, 2, 3], keep + rot, rows(ins, F), D);
  }
  // Fuel: firewood and peat as one supply (sim/kinds' fuelFree: the pile less what a project holds back, peat at PEAT.worth), burnt at
  // the season's ECON.woodUse. Its intake is the plan's: at the start of each season (today, for this one) the household cuts towards the
  // season's goal, plan.targets.wood[season], at most hands × OUTLOOK.woodTrips × ECON.woodPerTrip a season (the share of it left, for
  // the season we are in); none with no farm or no wood in its village's reach. Firewood does not spoil.
  function fuel(st, hh, f, plan, c, F, end) {
    const use = st.ECON.woodUse,
      keep = Math.max(0, hh.farmstead === null ? (hh.wood || 0) + PEAT.worth * (hh.peat || 0) : fuelFree(st, hh)),
      goal = plan.targets && plan.targets.wood,
      wood = f && st.villages[f.village] && st.villages[f.village].wood,
      cap = hands(st, hh) * OUTLOOK.woodTrips * st.ECON.woodPerTrip,
      cuts = !!(goal && wood && wood.length && cap > 0);
    const need = (d) => use[Math.floor((((d % YEAR_DAYS) + YEAR_DAYS) % YEAR_DAYS) / SEASON_DAYS)];
    const ins = [];
    const inflow = (d, held, k) => {
      const first = d === c.day || (d - F) % SEASON_DAYS === 0;
      if (!cuts || !first || k >= FRAME) return 0;
      const s = (c.season + k) % 4,
        left = k === 0 ? (SEASON_DAYS - c.sday) / SEASON_DAYS : 1,
        n = Math.max(0, Math.min(goal[s] - held, cap * left));
      if (n > 0) ins.push([d, 'firewood', n]);
      return n;
    };
    const own = walk({ from: c.day, to: end, F, keep, rot: 0, need }),
      w = walk({ from: c.day, to: end, F, keep, rot: 0, need, inflow });
    return supply(own, w, true, [0, 1, 2, 3], keep, rows(ins, F), null, use, c);
  }
  // Hay: needed on the stall days only, which are counted as the winter's (HERD.stall: from autumn's day 8 to spring's day 4), so its
  // outlook is the share of the coming winter's stall covered, read as the winter's season of the frame plus that share (FRAME if all of
  // it). Its intakes: hay lying mown in the meadows, and the meadows still to mow this year at HAY × their fertility (expectedHay), at
  // the middle of the haymaking window (today, inside it), the mowing stopping at the plan's target (targets.hayWinters winters' need).
  // Hay spoils by HERD.hayLoss.
  function hay(st, hh, f, plan, c, F) {
    const H = householdHay(st, hh),
      W = H * HERD.stallDays,
      k = (3 - c.season + 4) % 4,
      winter = F + k * SEASON_DAYS,
      to = winter + SEASON_DAYS + HERD.stall[1],
      stall = (d) => {
        const doy = ((d % YEAR_DAYS) + YEAR_DAYS) % YEAR_DAYS;
        return doy >= HERD.stall[0] || doy < HERD.stall[1];
      };
    const ins = [];
    if (f && H > 0) {
      const y0 = c.day - c.doy,
        mid = y0 + SEASON_DAYS + SEASON_DAYS / 2,
        last = y0 + 2 * SEASON_DAYS + 2; // the window's last day (sim/meadows, MOW_LAST)
      let lying = 0,
        grass = 0;
      for (const m of f.meadows) {
        if (m.stage === 'mown') {
          lying += m.held || 0;
          ins.push([Math.max(c.day, (m.mown || c.day) + 1), 'mown', m.held || 0]);
        } else if (m.stage === 'grass' && c.day <= last) grass += HAY * m.fert;
      }
      const target = plan.targets ? plan.targets.hayWinters * W : W,
        mow = Math.min(grass, Math.max(0, target - hh.hay - lying));
      if (mow > 0) ins.push([Math.max(c.day, Math.floor(mid)) + 1, 'meadows', mow]);
    }
    ins.sort((a, b) => a[0] - b[0]);
    const barn = f && f.barn ? BUILD.barn.loss : 1,
      q = daily(HERD.hayLoss),
      loss = (x) => tierLoss(x, W, q, barn),
      base = {
        from: c.day,
        to,
        F,
        keep: 0,
        rot: Math.max(0, hh.hay || 0),
        need: (d) => (stall(d) ? H : 0),
        loss,
        intoRot: true,
      };
    let j = 0;
    const own = walk(base),
      w = walk({
        ...base,
        inflow: (d) => {
          let n = 0;
          while (j < ins.length && ins[j][0] <= d) n += ins[j++][2];
          return n;
        },
      });
    // the share of the coming stall covered: its seasons are the autumn before the winter, the winter and the spring after
    const share = (x) => {
      let m = 0,
        n = 0;
      for (let s = Math.max(0, k - 1); s <= k + 1; s++) {
        m += x.met[s];
        n += x.need[s];
      }
      return n > 0 ? m / n : 1;
    };
    const read = (x) => {
      const s = share(x);
      return s >= 1 - 1e-9
        ? { v: FRAME, state: 'safe', season: null }
        : { v: k + s, state: s >= OUTLOOK.little ? 'short' : 'bad', season: k };
    };
    const a = read(own),
      b = read(w),
      none = !(H > 0);
    const need = [0, 0, 0, 0];
    need[k] = r1(W);
    return {
      own: none ? FRAME : r2(a.v),
      with: none ? FRAME : r2(b.v),
      state: none ? 'none' : b.state,
      season: none ? null : b.season,
      seasons: [3],
      parts: {
        store: r1(Math.max(0, hh.hay || 0)),
        need,
        intakes: rows(ins, F),
        spoilt: r1(w.spoilt),
        share: r2(share(w)),
      },
    };
  }
  // A supply's plain data from its two walks (the store alone, and with the intakes).
  function supply(own, w, needed, seasons, store, intakes, daily, use, c) {
    const a = reading(own),
      b = reading(w);
    const need = [0, 0, 0, 0];
    for (let k = 0; k < FRAME; k++)
      need[k] = r1(daily !== null ? daily * SEASON_DAYS : use[(c.season + k) % 4] * SEASON_DAYS);
    return {
      own: needed ? r2(a.v) : FRAME,
      with: needed ? r2(b.v) : FRAME,
      state: needed ? b.state : 'none',
      season: needed ? b.season : null,
      seasons,
      parts: { store: r1(store), need, intakes, spoilt: r1(w.spoilt) },
    };
  }
  // The outlook of household hh by its plan now: plain data, as plan.outlook holds it. Reads the state only.
  function reckon(st, hh, plan, c = cal(st.t)) {
    const f = farmOf(st, hh),
      F = c.day - c.sday,
      end = F + FRAME * SEASON_DAYS;
    return {
      year: c.year,
      season: c.season,
      day: c.day,
      food: food(st, hh, f, c, F, end),
      fuel: fuel(st, hh, f, plan, c, F, end),
      hay: hay(st, hh, f, plan, c, F),
    };
  }
  // At a review of a household's plan (sim/plans' event planReviewed) the head reckons its outlook again: on its planning day ('day'),
  // when a store crossed a target ('store': the harvest stacked wakes it), and at the first review of a season, where the one it holds is
  // stale; a review for a window closing ('window') keeps the outlook it has. Draws nothing.
  on('planReviewed', (st, d) => {
    const plan = d.plan;
    if (plan.holder.type !== 'household') return;
    const hh = st.households[plan.holder.id],
      O = plan.outlook;
    if (!hh || hh.dissolved) return;
    if (d.why === 'window' && O && O.year === d.c.year && O.season === d.c.season) return;
    plan.outlook = reckon(st, hh, plan, d.c);
  });
  // The outlook household id's head made at its last review, for the page (Sim.supplyOutlook): a copy, with `stale` true when it was made
  // in an earlier season than now (it is made again at the first review of this one); null with no plan or before its first review.
  function supplyOutlook(st, id) {
    const plan = st.plans && st.plans.households.get(id),
      O = plan && plan.outlook;
    if (!O) return null;
    const c = cal(st.t);
    return {
      ...JSON.parse(JSON.stringify(O)),
      stale: O.year !== c.year || O.season !== c.season,
      head: plan.head ? plan.head.pawn : null, // whose estimate it is (AGENTS.md, Deciding without Kim, 14)
    };
  }
  return { OUTLOOK, FRAME, SUPPLIES, STATES, reckon, supplyOutlook };
})();
