// @sys sim/overview: a village at a glance (VB-162): its food against its need, the year's harvest, its people by age band, its hungry
// households and idle hands, and the warnings; computed when asked and stored nowhere. The warnings that foretell are a pawn's estimate.
VB['sim/overview'] = (() => {
  const { YEAR, YEAR_DAYS, SEASON_DAYS, WORK, HUNGER, FIELDS, CROPS, MARRIAGE, cal } = VB['sim/rules'];
  const { age, spouseOf } = VB['sim/records'];
  const Stores = VB['sim/stores'];
  const { toHarvest, foodHeld } = VB['sim/foodneed'],
    { dailyNeed } = VB['sim/hunger'];
  const { fieldsWorkable } = VB['sim/fields'];
  // The fields a farm sows: a fallow course does not count against the hands (VB-350; design.md, The rotation, Fallow and the hands).
  const sownFields = (f) => f.fields.filter((fd) => !CROPS[fd.crop].fallow).length;
  const { heirRanking } = VB['sim/heirranking'];
  const Plans = VB['sim/plans'],
    Traits = VB['sim/traits'];
  // The overview's bounds (VB-162; Kim, 10 November, as the task's criteria, read on the game's calendar): the window of the counted facts
  // is the last HUNGER.days days, the days a pawn's hunger log holds (a season: the game's year is four seasons of SEASON_DAYS days, so the
  // criteria's 30 days stand as one season); a household is warned of as hungry on `hungry` of them (the criteria's 5 of 30, the same
  // share); a holder is old from `old`; the age bands start at 0, bands[0] and bands[1]; a working hand is of `hands`' ages, not retired
  // (as sim/agents counts its hours, household.workHours).
  const OVERVIEW = Object.freeze({
    window: HUNGER.days,
    hungry: Math.ceil((HUNGER.days * 5) / 30),
    old: 60,
    bands: Object.freeze([15, 50]),
    hands: VB['sim/rules'].AGES.hands,
    kin: 0.1, // a household lives partly on help at this share of its year's need received (VB-1114)
  });
  const AUTUMN = 2; // the season the harvest comes in (as sim/foodneed's toHarvest)
  const bandOf = (a) => (a < OVERVIEW.bands[0] ? 0 : a < OVERVIEW.bands[1] ? 1 : 2);
  // A living pawn of marrying age (the custom's: MARRIAGE.menFrom, womenFrom).
  const adultOf = (st, p) => p.alive && age(st, p) >= (p.sex === 'm' ? MARRIAGE.menFrom : MARRIAGE.womenFrom);
  const live = (st, v) => {
    const out = [];
    for (const id of v.farmsteads) {
      const f = st.farmsteads[id];
      if (f.household !== null && !st.households[f.household].dissolved) out.push(st.households[f.household]);
    }
    return out;
  };
  // Whose estimate the warnings that foretell are (AGENTS.md, Deciding without Kim, 14): the viewer, a living pawn (the page passes the
  // played pawn); else the village's eldest living holder, who speaks for it until it has an alderman; null in a village with no holder.
  function viewerOf(st, v, viewer) {
    if (viewer !== null && viewer !== undefined && st.pawns[viewer] && st.pawns[viewer].alive) return viewer;
    let best = null;
    for (const hh of live(st, v)) {
      const p = hh.holder === null ? null : st.pawns[hh.holder];
      if (p && p.alive && (best === null || p.born < st.pawns[best].born)) best = p.id;
    }
    return best;
  }
  // The pawn's estimate: how far ahead it looks, by its skill as head (sim/plans' foresight: a head that reacts sees a shortage only when it
  // is on it, a day ahead; one that looks a season ahead, to the season's end; two, a season further), capped at the next harvest; and the
  // fields a working hand can till by its own household's plan (its head's), FIELDS.perHand without one.
  function estimateOf(st, id) {
    const p = st.pawns[id],
      hh = p.household === null ? null : st.households[p.household],
      plan = hh && st.plans ? st.plans.households.get(hh.id) : null,
      heads = plan && plan.head && plan.head.pawn === id,
      skill = heads ? Plans.headSkill(st, hh.id) : Traits.skill(st, id, st.t),
      hz = Plans.horizonOf(skill),
      c = cal(st.t),
      harvest = toHarvest(st.t),
      ahead = hz ? SEASON_DAYS - c.sday + (hz - 1) * SEASON_DAYS : 1;
    const perHand = plan && plan.targets && plan.targets.perHand > 0 ? plan.targets.perHand : FIELDS.perHand;
    return { pawn: id, horizon: hz, days: Math.min(harvest, ahead), toHarvest: harvest, perHand };
  }
  // A household's food in rations: what it may eat (sim/foodneed's foodHeld: grain, flour, larder, fresh food) less the seed held back, its
  // meals, and the sheaves in its barn, which are grain once threshed.
  function foodOf(st, hh) {
    let sheaves = 0;
    for (const x of hh.unthreshed) sheaves += +x || 0;
    return Math.max(0, foodHeld(hh, st) - Stores.reserved(st, hh, 'grain')) + hh.meals + sheaves;
  }
  // The rations a holder's harvest brought in calendar year `year` (0 the first): a household's sheaves, the village's grain (its ledger, kept three years).
  function harvestOf(holder, year, good) {
    let n = 0;
    for (const e of holder.ledger || [])
      if (e.kind === 'harvest' && e.good === good && e.n > 0 && Math.floor(e.t / YEAR) === year) n += e.n;
    return n;
  }
  // The days of the window on which someone of the household ate short: the last `window` entries of each member's hunger log (a day's
  // meal each, the newest last), a day counted once whoever went short.
  function hungryDaysOf(st, hh) {
    const W = OVERVIEW.window,
      day = new Uint8Array(W);
    for (const id of hh.members) {
      const L = st.pawns[id].alive ? st.pawns[id].hungerLog : null;
      if (L) for (let k = 0; k < W && k < L.length; k++) if (L[L.length - 1 - k] > 1e-9) day[k] = 1;
    }
    let n = 0;
    for (let k = 0; k < W; k++) n += day[k];
    return n;
  }
  // The household's working hands now.
  function handsOf(st, hh) {
    let n = 0;
    for (const id of hh.members) {
      const p = st.pawns[id];
      if (p.alive && !p.retired && p.age >= OVERVIEW.hands[0] && p.age < OVERVIEW.hands[1]) n++;
    }
    return n;
  }
  // The hours its hands worked in the last SEASON_DAYS days, from sim/agents' count (this season's hours, and the season before's taken
  // for the part of it still in the window, as if spread evenly over it), and the hours its hands had: each work day's WORK hours.
  function hoursOf(st, hh, c, hands) {
    const key = c.year * 4 + c.season,
      W = hh.workHours,
      span = WORK[1] - WORK[0],
      now = W && W[0] === key ? W[1] : 0,
      before = !W ? 0 : W[0] === key ? W[2] : W[0] === key - 1 ? W[1] : 0,
      into = c.sday + Math.max(0, Math.min(1, (c.hour - WORK[0]) / span));
    return { worked: now + (before * Math.max(0, SEASON_DAYS - into)) / SEASON_DAYS, had: hands * span * SEASON_DAYS };
  }
  // The grain each household received as help in the last year (VB-1114), read from the record back to a year ago: Map household id to
  // {n, from: [[giver's name, rations]] most first}. Written nowhere; one pass over the year's events, made when the panel is drawn.
  function helpReceived(st) {
    const out = new Map(),
      since = st.t - YEAR,
      { helpIn } = VB['sim/notable'];
    for (let i = st.record.length - 1; i >= 0; i--) {
      const e = st.record[i];
      if (typeof e !== 'object' || e.t < since) break;
      VB.count.overviewWalk++;
      const h = helpIn(e);
      if (!h || e.household === undefined) continue;
      const r = out.get(e.household) || { n: 0, from: new Map() };
      r.n += h.n;
      r.from.set(h.from, (r.from.get(h.from) || 0) + h.n);
      out.set(e.household, r);
    }
    for (const r of out.values()) r.from = [...r.from].sort((a, b) => b[1] - a[1]);
    return out;
  }
  // The summary of village `vid` (an id of st.villages) as pawn `viewer` would estimate what is ahead (null: the village's eldest holder):
  //   {village, name, year (of cal), viewer (the estimate's: {pawn, horizon, days (it looks ahead), toHarvest, perHand}, or null),
  //    households, people, food: {rations (the households' and the village store's), store (the village store's), need (a day's), days,
  //    short (the rations do not reach the viewer's days)}, harvest: {year (of cal: this year's from autumn, when it comes in, last year's
  //    before), rations, need (a year's), share}, bands: {now, ago} (people of 0 to
  //    14, 15 to 49 and 50 on, now and a year ago), hungry: {window, households (ids hungry on any day of it)}, idle: {worked, had, share},
  //    marry: {adults, single: {f, m} (adults of marrying age, and of them the unmarried, of the village's households), alone (the
  //    households of one adult, by id), reach: {f, m} (the unmarried of the pool within walking reach, VB-288), by: 'f'|'m'|null (the sex
  //    that outnumbers the other two to one there)},
  //    warnings: {food, hunger, heir, hands, match, kin}: the households each concerns, by id; `kin`: those that live partly on help
  //    received (OVERVIEW.kin), and `kin` beside them, by household: {share (of its year's need), n, from: [[giver, rations]]};
  //    `match`: those of the village with an unmarried of the sex `marry.by`}.
  // People a year ago are those then alive whose household (their last, for the dead) is of the village: who moved in during the year
  // counts as of it then. A walk of every pawn, made when the panel is drawn and never by a step (VB.count.overviewWalk).
  function villageSummary(st, vid, viewer = null) {
    const v = st.villages[vid],
      c = cal(st.t),
      year = c.year - 1 - (c.season < AUTUMN ? 1 : 0), // the latest harvest's (VB-162: in spring this year's is not in)
      hhs = live(st, v),
      who = viewerOf(st, v, viewer),
      est = who === null ? null : estimateOf(st, who);
    const store = Math.max(0, Stores.grainOf(v) - Stores.reserved(st, v, 'grain'));
    const out = {
      village: v.id,
      name: v.name,
      year: c.year,
      viewer: est,
      households: hhs.length,
      people: 0,
      food: { rations: store, store, need: 0, days: 0, short: false },
      harvest: { year: year + 1, rations: harvestOf(v, year, 'grain'), need: 0, share: 0 },
      bands: { now: [0, 0, 0], ago: [0, 0, 0] },
      hungry: { window: OVERVIEW.window, households: [] },
      idle: { worked: 0, had: 0, share: 0 },
      marry: { adults: { f: 0, m: 0 }, single: { f: 0, m: 0 }, alone: [], reach: { f: 0, m: 0 }, by: null },
      warnings: { food: [], hunger: [], heir: [], hands: [], match: [], kin: [] },
      kin: {},
    };
    const help = helpReceived(st);
    const single = new Set(); // households of the village holding an unmarried adult, by sex
    for (const hh of hhs) {
      const need = dailyNeed(st, hh),
        food = foodOf(st, hh),
        f = st.farmsteads[hh.farmstead];
      out.food.rations += food;
      out.food.need += need;
      out.harvest.rations += harvestOf(hh, year, 'sheaves');
      const hungry = hungryDaysOf(st, hh);
      if (hungry > 0) out.hungry.households.push(hh.id);
      if (hungry >= OVERVIEW.hungry) out.warnings.hunger.push(hh.id);
      const hands = handsOf(st, hh),
        h = hoursOf(st, hh, c, hands);
      out.idle.worked += h.worked;
      out.idle.had += h.had;
      const got = help.get(hh.id);
      if (got && need > 0) {
        const share = Math.min(1, got.n / (need * YEAR_DAYS));
        out.kin[hh.id] = { share, n: got.n, from: got.from };
        if (share >= OVERVIEW.kin) out.warnings.kin.push(hh.id);
      }
      if (est && need > 0 && food < need * est.days) out.warnings.food.push(hh.id);
      const holder = hh.holder === null ? null : st.pawns[hh.holder];
      if (holder && holder.alive && age(st, holder) >= OVERVIEW.old) {
        const heir = heirRanking(st, hh).some(
          (id) => id !== holder.id && st.pawns[id].alive && st.pawns[id].household === hh.id,
        );
        if (!heir) out.warnings.heir.push(hh.id);
      }
      if (hh.members.filter((id) => adultOf(st, st.pawns[id])).length === 1) out.marry.alone.push(hh.id);
      if (est && sownFields(f) > fieldsWorkable(st, hh, est.perHand)) out.warnings.hands.push(hh.id);
    }
    VB.count.overviewWalk += st.pawns.length;
    const ago = st.t - YEAR;
    for (const p of st.pawns) {
      if (p.household === null || st.farmsteads[st.households[p.household].farmstead].village !== v.id) continue;
      if (p.alive) {
        if (adultOf(st, p)) {
          out.marry.adults[p.sex]++;
          if (spouseOf(st, p.id) === null) {
            out.marry.single[p.sex]++;
            single.add(p.sex + p.household);
          }
        }
        out.people++;
        out.bands.now[bandOf(age(st, p))]++;
      }
      if (p.born <= ago && (p.died === null || p.died > ago)) out.bands.ago[bandOf(age(st, p, ago))]++;
    }
    // within walking reach: the unmarried of the pool of marrying age (the round's, sim/matching)
    const pool = VB['sim/matching'].poolFor(st, vid);
    VB.count.overviewWalk += pool.length;
    for (const id of pool) {
      const p = st.pawns[id];
      if (adultOf(st, p) && spouseOf(st, id) === null) out.marry.reach[p.sex]++;
    }
    const { f: rf, m: rm } = out.marry.reach;
    out.marry.by = rm >= 2 * rf && rm > 0 ? 'm' : rf >= 2 * rm && rf > 0 ? 'f' : null;
    if (out.marry.by) for (const hh of hhs) if (single.has(out.marry.by + hh.id)) out.warnings.match.push(hh.id);
    out.food.days = out.food.need > 0 ? out.food.rations / out.food.need : 0;
    out.food.short = !!est && out.food.need > 0 && out.food.rations < out.food.need * est.days;
    out.harvest.need = out.food.need * YEAR_DAYS;
    out.harvest.share = out.harvest.need > 0 ? out.harvest.rations / out.harvest.need : 0;
    out.idle.share = out.idle.had > 0 ? Math.max(0, Math.min(1, 1 - out.idle.worked / out.idle.had)) : 0;
    return out;
  }
  // The village store's supply outlook (VB-966) as pawn `viewer` (null: the village's eldest holder) would reckon it; computed when asked.
  const villageOutlookOf = (st, vid, viewer = null) =>
    VB['sim/outlook'].villageOutlook(st, vid, viewerOf(st, st.villages[vid], viewer));
  return { OVERVIEW, villageSummary, viewerOf, estimateOf, villageOutlookOf };
})();
