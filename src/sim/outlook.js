// @sys sim/outlook: the supply outlook (VB-666): how long a household's food, fuel and hay last, on one scale (seasons of need) over the
// four seasons from the start of the one we are in, by its head's reckoning at each review of its plan, with its doubt (VB-669); kept in
// plan.outlook, read by the page
// Design: docs/mocks/supply-scale.html and supply-doubt.html (the UI review with Kim, 16 Nov); principle "The future is someone's estimate" (the future
// is someone's estimate: this is the head's) and 15 (one scale for every supply). What is still to come is the plan's: the crop the head
// expects of its fields (FIELDS.expect of the full yield, as the plan reckons when it asks how many fields), the hay of its meadows in an
// ordinary year (sim/meadows' expectedHay), the woodpile's goal of each season (its wood target's seasons); no weather to come is read. Nothing
// reads the outlook to decide: it is a view the review keeps, so that the page never computes one.
VB['sim/outlook'] = (() => {
  const { targetOf } = VB['sim/steps'];
  const { SEASON_DAYS, YEAR_DAYS, FIELDS, HERD, BUILD, PEAT, HELP, cal } = VB['sim/rules'],
    { CROPS, ROTATIONS } = VB['sim/crops'];
  const { on } = VB['sim/events'];
  const Stores = VB['sim/stores'],
    Goods = VB['sim/goods'];
  const Pot = VB['sim/pot'];
  const { dailyNeed, seedPer } = VB['sim/hunger'],
    { larderOf } = VB['sim/larder'];
  const { householdHay } = VB['sim/herds'];
  const { HAY } = VB['sim/meadows'];
  const { fuelFree, timberOf } = VB['sim/chores'];
  const { fireOf } = VB['sim/house'];
  const { hands } = VB['sim/targets'];
  const { headSkill } = VB['sim/seasonal'];
  const { CHAINS } = VB['sim/planchains'];
  // Proposed (VB-666): `little`, a first short season whose need is covered at least this share is short a little ('short'), else badly
  // ('bad'); `woodTrips`, the firewood trips a working hand makes in a season towards the pile's goal (ECON.woodPerTrip units each), which
  // bounds the wood the plan's goal brings in a season. Named tunables of the view; nothing in the simulation reads them.
  const OUTLOOK = Object.freeze({ little: 0.5, woodTrips: 6 });
  // @tunable DOUBT: the head's doubt on an outlook (VB-669; design.md section 7, The estimate: a centre and a range, honest and wide).
  // The range is the centre times 1 ± (`sure` + `unseen` × (1 - the head's skill)): `sure`, the spread of the mishaps no head foresees
  // (a wet harvest, a beast lost), 0.1, a tenth either way under the best head; `unseen`, what a head of no skill does not reckon with,
  // 0.4, so the worst head's range is half the centre either way. `unseen` is at least the bias's reach (Traits.HEAD.bias, 0.3): the
  // centre leans by the head's bias on the store's target, and a range that did not cover the lean would not be honest. First values:
  // populous small seed 7, year 10, the run's outcomes fell within the range at the shares in VB-669's notes. Nothing reads them to decide.
  const DOUBT = Object.freeze({ sure: 0.1, unseen: 0.4 });
  // The head's bias on the target of each supply's store (plan.head.bias, sim/seasonal): food leans by the fields it wants, fuel by its
  // woodpile, hay by its hay. A bias over 1 is a head that believes it needs more than it does, so reckons its store lasts less.
  const LEAN = Object.freeze({ food: 'fields', fuel: 'wood', hay: 'hay' });
  // The frame: four seasons from the start of the season we are in. A value of FRAME or more lasts the frame (safe).
  const FRAME = 4;
  const SUPPLIES = Object.freeze(['food', 'fuel', 'hay']);
  // What a supply's state says: 'safe' (it lasts the frame), 'short' or 'bad' (its first short season, `season`, is covered at least
  // OUTLOOK.little of its need, or less), 'none' (nothing needs it: no herds for hay, nobody to feed).
  const STATES = Object.freeze(['safe', 'short', 'bad', 'none']);
  // @state plan.outlook (a household's standing plan; VB-666): absent until its first review, then {year, season, day (of cal: when the
  //   head made it), food, fuel, hay}, each supply {own, with (seasons from the start of the season it was made in that the store alone,
  //   and the store with every intake the plan expects, last, spoilage taken off; 0 to FRAME), state (STATES), season (the first short
  //   season of the frame, 0 to 3, or null), lo, mid, hi (VB-669: the head's doubt on `with`, on its scale: the worst it expects, its
  //   likeliest (with, leaned by its bias on the store), the best; lo <= mid <= hi, 0 to FRAME; with no head, the middle skill and no
  //   lean), seasons (the seasons of the year it is needed in: [0, 1, 2, 3], or [3] for hay), parts: {store
  //   (what is held now, in the supply's units), need (by season of the frame, from the start of the one we are in), intakes ([{what, season
  //   (of the frame), n}], summed by what and season), spoilt (what the reckoning with intakes lets spoil within the frame), and for a
  //   household planned by hand (VB-1661) left ([{good, what, tile?, crop?, n}]: the intakes still to be worked that no task of the plan
  //   covers, left out of `with`: fuel 'timber' (home, no firewood task to cut it), 'fell' (a fell task's loads, none to cut them),
  //   'cutting' (the head's own felling to the season's goal); hay 'mown' and 'meadow' (lying, or to mow: no hay task there); food
  //   'harvest' (a field's crop: no harvest task there, or not sown yet))}}. Made again at
  //   every review (sim/plans' event planReviewed): on the planning day, out of turn when a store crosses a target (the harvest stacked
  //   wakes it), and so at the first review of each season, which makes a stale one (made in an earlier season) anew. Plain data.
  const r2 = (x) => Math.round(x * 100) / 100,
    r1 = (x) => Math.round(x * 10) / 10;
  // One supply walked a day at a time from `from` (the absolute day today) to `to` (exclusive), the frame starting on day F: `keep` is held
  // and does not spoil, `rot` spoils by loss(rot) a day; need(d) is the day's need, inflow(d, held) what comes in on day d (into rot when
  // `intoRot`). The day's need is taken from keep first. Returns {at (days from F when it first ran short, Infinity if never), met, need (by
  // frame season, from today: what was eaten of the need and the need), spoilt, left (what is held at the end)}. Walks on after running
  // short (the hay of a later winter).
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
    return { at, met, need, spoilt, left: keep + rot };
  }
  // A day's loss of a store spoiling by tiers, by its good's keeping (sim/goods: grain by years of need, hay by winters): `unit` held a tier,
  // times the barn's (BUILD.barn.loss with one); q: the good's daily shares (Goods.shares), reckoned once a supply.
  const tierLoss = (x, unit, q, barn) => (unit > 0 ? Goods.tierLoss(x, unit, q) * barn : 0);
  // A supply's value and state from a walk on the seasons scale: when it first ran short, capped at the frame, and how much of that season's
  // need it covered.
  function reading(w) {
    const v = Math.min(FRAME, w.at / SEASON_DAYS);
    if (v >= FRAME) return { v: FRAME, state: 'safe', season: null };
    const k = Math.floor(v),
      share = w.need[k] > 0 ? w.met[k] / w.need[k] : 1;
    return { v, state: share >= OUTLOOK.little ? 'short' : 'bad', season: k };
  }
  // The head's doubt (VB-669): its bias on each store's target (null: none) and the range's reach either way of the centre, a share of
  // it (DOUBT); a household with no head is reckoned at the middle skill (sim/seasonal's headSkill) and no lean.
  const headDoubt = (st, hh, plan) => ({
    bias: plan && plan.head ? plan.head.bias : null,
    sp: DOUBT.sure + DOUBT.unseen * (1 - headSkill(st, hh.id)),
  });
  // The range on a reckoning x (in the reading's units: seasons, or for hay the share of the stall covered): the centre x leaned by the
  // head's bias b on the store, and that times 1 ± sp, each read onto the outlook's scale by `read`.
  const range = (x, b, sp, read) => {
    const m = x / b;
    return { lo: read(m * (1 - sp)), mid: read(m), hi: read(m * (1 + sp)) };
  };
  const onFrame = (y) => r2(Math.min(FRAME, Math.max(0, y)));
  // A supply of four seasons given its doubt: the walk with the intakes, w, read past the frame where it lasts it (what is left at the
  // frame's end, at a season's need on average, perSeason); a supply not needed, or with no doubt reckoned (dz null), has none.
  function doubted(s, w, perSeason, dz, key) {
    if (s.state === 'none' || !dz) return Object.assign(s, { lo: s.with, mid: s.with, hi: s.with });
    const x = s.with < FRAME || !(perSeason > 0) ? s.with : FRAME + w.left / perSeason;
    return Object.assign(s, range(x, dz.bias ? dz.bias[LEAN[key]] : 1, dz.sp, onFrame));
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
  // ---- what a plan by hand covers (VB-1661; Kim, 24 Nov 2026: "Stores count what is in the plan. There is no 'automatic plan'") ----
  // A household planned by hand: the played pawn's, with automatic behaviour off. Its outlook counts an intake still to be worked only
  // when a task of the plan covers it; what is held, or needs no work, is counted as for any household.
  const handOf = (st, hh) => {
    const pl = st.player;
    return !!pl && !pl.auto && st.pawns[pl.pawn].household === hh.id;
  };
  const playedOf = (st, hh) => !!st.player && st.pawns[st.player.pawn].household === hh.id;
  const tasksOf = (st) => (st.player && st.player.plan ? st.player.plan.tasks : []);
  // Whether a task of the plan covers chain `name` (sim/planchains CHAINS) at `tile` (any, when undefined): a task at the tile, or a task
  // by key of one of the chain's job kinds there.
  const covered = (st, name, tile) =>
    tasksOf(st).some((t) =>
      t.key === undefined
        ? t.kind === name && (tile === undefined || t[name] === tile)
        : CHAINS[name].kinds.includes(t.kind) && (tile === undefined || t.site === tile),
    );
  const STANDING = ['sown', 'growing', 'ripe', 'stooks'];
  // A supply's reckoning with what it left out (`parts.left`) for a household planned by hand.
  const withLeft = (s, hand, left) => (hand ? { ...s, parts: { ...s.parts, left } } : s);
  const farmOf = (st, hh) => {
    const f = hh.farmstead === null || hh.farmstead === undefined ? null : st.farmsteads[hh.farmstead];
    return f && f.household === hh.id ? f : null;
  };
  // The crops a field brings in before day `end`, by the head's reckoning, each as fn(absolute day, crop, first): its rotation walked
  // from its present course (VB-350). A crop standing is in at its sowing day and the crop's days to ripe; stooks are in today; a course to
  // be sown is sown on the first day of its crop's next window from the day the course before it ends (today, inside it); a fallow course
  // ends on the autumn's first day after a summer it stood (sim/fields). `first`: the present course's crop.
  function cropDays(fd, c, end, fn) {
    if (fd.stage === 'fallow' || fd.stage === 'scrub') return;
    const R = ROTATIONS[fd.rotation] ? ROTATIONS[fd.rotation].courses : [fd.crop],
      y0 = c.day - c.doy,
      yearOf = (d) => y0 + Math.floor((d - y0) / YEAR_DAYS) * YEAR_DAYS, // the first day of the year of day d
      next = (d, season, day) => {
        const x = yearOf(d) + season * SEASON_DAYS + day;
        return x >= d ? x : x + YEAR_DAYS;
      }; // the first day on or after d that is `day` of `season`
    let from = c.day,
      step = fd.step || 0;
    for (let n = 0; n <= R.length && from < end; n++) {
      const first = n === 0,
        k = first ? fd.crop : R[step],
        C = CROPS[k];
      step = (step + 1) % R.length;
      if (!C) return;
      if (C.fallow) {
        from = next(first && fd.rest !== undefined ? from : next(from, 1, 0), 2, 0);
        continue;
      }
      let day;
      if (first && (fd.stage === 'stooks' || fd.stage === 'ripe')) day = c.day;
      else if (first && fd.sown !== null && fd.sown !== undefined) day = Math.max(c.day, fd.sown + C.ripe);
      else {
        const open = yearOf(from) + C.sow[0] * SEASON_DAYS + C.sow[1],
          last = yearOf(from) + C.sow[0] * SEASON_DAYS + C.sow[2];
        day = (from <= last ? Math.max(from, open) : open + YEAR_DAYS) + C.ripe;
      }
      if (day < end) fn(day, k, first);
      from = day;
    }
  }
  // Food: grain above the seed (it spoils), and the meals, flour, sheaves, larder and fresh food (kept), over the household's daily need.
  // Its intakes: each field's crop, FIELDS.expect of its full yield less the seed it takes back (stooks: what lies in them, less the seed).
  function food(st, hh, f, c, F, end, less = 0, dz = null) {
    const D = dailyNeed(st, hh),
      seed = hh.farmstead === null ? 0 : Stores.reserved(st, hh, 'grain'), // a household with no farm keeps no seed
      rot = Math.max(0, Stores.grainOf(hh) - seed - less),
      sheaves = (hh.unthreshed || []).reduce((s, x) => s + (+x || 0), 0),
      keep =
        (hh.meals || 0) +
        (hh.flour || 0) +
        sheaves +
        larderOf(hh) +
        (hh.fresh && hh.fresh.length ? Pot.freshHeld(st, hh) : 0);
    const ins = [],
      hand = handOf(st, hh),
      left = [];
    if (f) {
      const per = seedPer(st, hh);
      for (const fd of f.fields)
        cropDays(fd, c, end, (day, k, first) => {
          const gross = first && fd.stage === 'stooks' ? fd.held || 0 : FIELDS.expect * CROPS[k].yield,
            n = Math.max(0, gross - (k === 'barley' ? per : CROPS[k].seed));
          // by hand, a crop standing is counted with a harvest task on its field; one not sown yet is in no task (VB-1661)
          if (hand && !(first && STANDING.includes(fd.stage) && covered(st, 'harvest', fd.tile))) {
            if (n > 0) left.push({ good: 'food', what: 'harvest', tile: fd.tile, crop: k, n: r1(n) });
          } else ins.push([day, k, n]);
        });
    }
    ins.sort((a, b) => a[0] - b[0]);
    const barn = f && f.barn ? BUILD.barn.loss : 1,
      year = D * YEAR_DAYS,
      q = Goods.shares(st, 'grain'),
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
    const out = doubted(
      supply(own, w, D > 0, [0, 1, 2, 3], keep + rot, rows(ins, F), D),
      w,
      D * SEASON_DAYS,
      dz,
      'food',
    );
    return withLeft(out, hand, left);
  }
  // Fuel: firewood and peat as one supply (sim/chores' fuelFree: the pile less what a project holds back, peat at PEAT.worth), burnt at
  // the season's ECON.woodUse times the house's own fire (sim/house fireOf: a timber house's is smaller; VB-1669). Its intake is the
  // plan's: at the start of each season (today, for this one) the household cuts towards the season's goal, its wood target of the season,
  // at most hands × OUTLOOK.woodTrips × ECON.woodPerTrip a season (the share of it left, for the season we are in); none with no farm or no wood in its
  // village's reach. Firewood does not spoil. Timber home and not yet cut
  // counts as firewood (VB-1653): the head has it cut by its own rule (sim/chores); for the household of a pawn planned by hand
  // (automatic behaviour off) only while a `firewood` task of the plan covers it (sim/playerplan).
  // For a household planned by hand (VB-1661; Kim, 24 Nov: "Stores count what is in the plan"), the head's own cutting to the goal is
  // left out, and a fell task's loads still to come home are counted, today, only with a `firewood` task to cut them.
  function fuel(st, hh, f, plan, c, F, end, dz = null) {
    const fire = fireOf(st, hh),
      use = st.ECON.woodUse.map((u) => u * fire),
      hand = handOf(st, hh),
      cut = !hand || covered(st, 'firewood'),
      left = [],
      keep =
        Math.max(0, hh.farmstead === null ? (hh.wood || 0) + PEAT.worth * (hh.peat || 0) : fuelFree(st, hh)) +
        (cut ? timberOf(hh) : 0),
      goal = targetOf(plan, 'wood') && targetOf(plan, 'wood').seasons,
      wood = f && st.villages[f.village] && st.villages[f.village].wood,
      cap = hands(st, hh) * OUTLOOK.woodTrips * st.ECON.woodPerTrip,
      cuts = !!(goal && wood && wood.length && cap > 0);
    const need = (d) => use[Math.floor((((d % YEAR_DAYS) + YEAR_DAYS) % YEAR_DAYS) / SEASON_DAYS)];
    const ins = [],
      would = [];
    // the head's cutting to the season's goal, each cut noted in `into`
    const cutting = (into) => (d, held, k) => {
      const first = d === c.day || (d - F) % SEASON_DAYS === 0;
      if (!cuts || !first || k >= FRAME) return 0;
      const s = (c.season + k) % 4,
        part = k === 0 ? (SEASON_DAYS - c.sday) / SEASON_DAYS : 1,
        n = Math.max(0, Math.min(goal[s] - held, cap * part));
      if (n > 0) into.push([d, 'firewood', n]);
      return n;
    };
    let planned = 0;
    if (hand) {
      const T = timberOf(hh);
      if (!cut && T > 0) left.push({ good: 'fuel', what: 'timber', n: r1(T) });
      for (const t of tasksOf(st))
        if (t.key === undefined && t.kind === 'fell' && (t.got || 0) < (t.n || 1)) {
          const n = ((t.n || 1) - (t.got || 0)) * st.ECON.woodPerTrip;
          if (cut) planned += n;
          else left.push({ good: 'fuel', what: 'fell', tile: t.fell, n: r1(n) });
        }
      if (planned > 0) ins.push([c.day, 'firewood', planned]);
    }
    const head = cutting(ins),
      inflow = (d, held, k) => (d === c.day ? planned : 0) + (hand ? 0 : head(d, held, k));
    const own = walk({ from: c.day, to: end, F, keep, rot: 0, need }),
      w = walk({ from: c.day, to: end, F, keep, rot: 0, need, inflow });
    if (hand && cuts) {
      const mine = cutting(would);
      walk({
        from: c.day,
        to: end,
        F,
        keep,
        rot: 0,
        need,
        inflow: (d, held, k) => (d === c.day ? planned : 0) + mine(d, held, k),
      });
      const n = would.reduce((a, x) => a + x[2], 0);
      if (n > 0) left.push({ good: 'fuel', what: 'cutting', n: r1(n) });
    }
    const perSeason = ((use[0] + use[1] + use[2] + use[3]) / 4) * SEASON_DAYS,
      out = doubted(supply(own, w, true, [0, 1, 2, 3], keep, rows(ins, F), null, use, c), w, perSeason, dz, 'fuel');
    return withLeft(out, hand, left);
  }
  // Hay: needed on the stall days only, which are counted as the winter's (HERD.stall: from autumn's day 8 to spring's day 4), so its
  // outlook is the share of the coming winter's stall covered, read as the winter's season of the frame plus that share (FRAME if all of
  // it). Its intakes: hay lying mown in the meadows, and the meadows still to mow this year at HAY × their fertility (expectedHay), at
  // the middle of the haymaking window (today, inside it), the mowing stopping at the plan's target (targets.hayWinters winters' need).
  // Hay spoils by HERD.hayLoss.
  function hay(st, hh, f, plan, c, F, dz = null) {
    const H = householdHay(st, hh),
      W = H * HERD.stallDays,
      k = (3 - c.season + 4) % 4,
      winter = F + k * SEASON_DAYS,
      to = winter + SEASON_DAYS + HERD.stall[1],
      stall = (d) => {
        const doy = ((d % YEAR_DAYS) + YEAR_DAYS) % YEAR_DAYS;
        return doy >= HERD.stall[0] || doy < HERD.stall[1];
      };
    const ins = [],
      hand = handOf(st, hh),
      left = [];
    if (f && H > 0) {
      const y0 = c.day - c.doy,
        mid = y0 + SEASON_DAYS + SEASON_DAYS / 2,
        last = y0 + 2 * SEASON_DAYS + 2; // the window's last day (sim/meadows, MOW_LAST)
      let lying = 0,
        grass = 0;
      for (const m of f.meadows) {
        // by hand, a meadow's hay still to bring in is counted with a hay task on it (VB-1661)
        const by = !hand || covered(st, 'hay', m.tile);
        if (m.stage === 'mown') {
          if (!by) {
            if (m.held > 0) left.push({ good: 'hay', what: 'mown', tile: m.tile, n: r1(m.held) });
            continue;
          }
          lying += m.held || 0;
          ins.push([Math.max(c.day, (m.mown || c.day) + 1), 'mown', m.held || 0]);
        } else if (m.stage === 'grass' && c.day <= last) {
          if (by) grass += HAY * m.fert;
          else left.push({ good: 'hay', what: 'meadow', tile: m.tile, n: r1(HAY * m.fert) });
        }
      }
      const target = targetOf(plan, 'hay') ? targetOf(plan, 'hay').level * W : W,
        mow = Math.min(grass, Math.max(0, target - hh.hay - lying));
      if (mow > 0) ins.push([Math.max(c.day, Math.floor(mid)) + 1, 'meadows', mow]);
    }
    ins.sort((a, b) => a[0] - b[0]);
    const barn = f && f.barn ? BUILD.barn.loss : 1,
      q = Goods.shares(st, 'hay'),
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
    // the doubt on the share of the stall covered, read past a full one by what is left at the stall's end; a share of 1 or more reads
    // as FRAME, as `with` does
    const sw = share(w),
      x = sw >= 1 - 1e-9 && W > 0 ? 1 + w.left / W : sw,
      R =
        none || !dz
          ? null
          : range(x, dz.bias ? dz.bias[LEAN.hay] : 1, dz.sp, (y) => (y >= 1 - 1e-9 ? FRAME : r2(k + Math.max(0, y)))),
      wv = none ? FRAME : r2(b.v);
    return {
      own: none ? FRAME : r2(a.v),
      with: wv,
      lo: R ? R.lo : wv,
      mid: R ? R.mid : wv,
      hi: R ? R.hi : wv,
      state: none ? 'none' : b.state,
      season: none ? null : b.season,
      seasons: [3],
      parts: {
        store: r1(Math.max(0, hh.hay || 0)),
        need,
        intakes: rows(ins, F),
        spoilt: r1(w.spoilt),
        share: r2(share(w)),
        ...(hand ? { left } : {}),
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
      end = F + FRAME * SEASON_DAYS,
      dz = headDoubt(st, hh, plan);
    return {
      year: c.year,
      season: c.season,
      day: c.day,
      food: food(st, hh, f, c, F, end, 0, dz),
      fuel: fuel(st, hh, f, plan, c, F, end, dz),
      hay: hay(st, hh, f, plan, c, F, dz),
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
      hh = st.households[id],
      c = cal(st.t),
      // the played pawn's household's, reckoned when asked (VB-1661): by hand it counts only what the plan's tasks cover, and they, and
      // automatic behaviour, change between its reviews
      O = plan && hh && !hh.dissolved && playedOf(st, hh) ? reckon(st, hh, plan, c) : plan && plan.outlook;
    if (!O) return null;
    return {
      ...JSON.parse(JSON.stringify(O)),
      stale: O.year !== c.year || O.season !== c.season,
      head: plan.head ? plan.head.pawn : null, // whose estimate it is (principle "The future is someone's estimate")
    };
  }
  // The food outlook of household id as its head reckons it now, had it given `less` rations of grain away (VB-671: the gift form shows it
  // before and after); the same shape as supplyOutlook, fuel and hay 'none'. Computed when asked, stored nowhere; null with no plan.
  function giftOutlook(st, id, less = 0) {
    const hh = st.households[id],
      plan = st.plans && st.plans.households.get(id);
    if (!hh || hh.dissolved || !plan) return null;
    const c = cal(st.t),
      F = c.day - c.sday,
      none = {
        own: FRAME,
        with: FRAME,
        lo: FRAME,
        mid: FRAME,
        hi: FRAME,
        state: 'none',
        season: null,
        seasons: [3],
        parts: { store: 0, need: [0, 0, 0, 0], intakes: [], spoilt: 0 },
      };
    return {
      year: c.year,
      season: c.season,
      day: c.day,
      food: food(st, hh, farmOf(st, hh), c, F, F + FRAME * SEASON_DAYS, less, headDoubt(st, hh, plan)),
      fuel: none,
      hay: none,
      stale: false,
      head: plan.head ? plan.head.pawn : null,
    };
  }
  // The village store's outlook (VB-966), made when asked and kept nowhere: how long its grain lasts, on the household's scale, at the daily need
  // of the village's households, the store losing grain's share of tier ECON.villageStoreTier a year (sim/goods); no intake is reckoned
  // (what the households give in and what the common fields bring is not promised: VB-849's filling is hauled to the green), so own and
  // with are the same. Its target
  // (HELP.storeTarget years of need, VB-457) is in parts.target. Shaped as a household's outlook (food only; fuel and hay 'none'), with
  // `head`, whose estimate it is: the viewer's (the played pawn), else the village's eldest holder, who speaks for it until it has an
  // alderman (as sim/overview's warnings; a village never acts or estimates, a pawn does: principle "The future is someone's estimate"; principle "Every
  // act is a pawn's").
  // One pass over the village's farmsteads, with the card; stores nothing.
  function villageOutlook(st, vid, head = null) {
    const v = st.villages[vid],
      c = cal(st.t),
      F = c.day - c.sday,
      end = F + FRAME * SEASON_DAYS;
    let D = 0;
    for (const id of v.farmsteads) {
      const f = st.farmsteads[id];
      if (f.household !== null && !st.households[f.household].dissolved) D += dailyNeed(st, st.households[f.household]);
    }
    const store = Math.max(0, Stores.grainOf(v) - Stores.reserved(st, v, 'grain')),
      share = Goods.dayLoss(st, 'grain', 1, Infinity, st.ECON.villageStoreTier); // the day's share (grain's keeping)
    const w = walk({
      from: c.day,
      to: end,
      F,
      keep: 0,
      rot: store,
      need: () => D,
      loss: (x) => x * share,
      intoRot: true,
    });
    const food = doubted(supply(w, w, D > 0, [0, 1, 2, 3], store, [], D), w, D * SEASON_DAYS, null, 'food'); // no doubt reckoned
    food.parts.target = r1(HELP.storeTarget * D * YEAR_DAYS);
    const none = {
      own: FRAME,
      with: FRAME,
      lo: FRAME,
      mid: FRAME,
      hi: FRAME,
      state: 'none',
      season: null,
      seasons: [0, 1, 2, 3],
      parts: { store: 0, need: [0, 0, 0, 0], intakes: [], spoilt: 0 },
    };
    return {
      year: c.year,
      season: c.season,
      day: c.day,
      stale: false,
      village: true, // the store's: reckoned when asked, not at a review
      head, // whose estimate it is: sim/overview chooses (viewerOf)
      food,
      fuel: none,
      hay: { ...none, seasons: [3] },
    };
  }
  return { OUTLOOK, DOUBT, FRAME, SUPPLIES, STATES, reckon, supplyOutlook, giftOutlook, villageOutlook, handOf };
})();
