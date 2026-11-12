// @sys sim/plans: holders' plans (design.md section 7; VB-258, VB-248, VB-249, VB-252): a standing plan per live household and village, a
// seasonal plan per live household from its culture's template of the year; targets, land step, seed; planning days by the head's
// diligence, and the due-queue that opens the time-bound kinds at their hours
VB['sim/plans'] = (() => {
  const { WORK, DAY, TICKS, HERD, SEASON_DAYS, FIELDS, cal } = VB['sim/rules'];
  const Rules = VB['sim/registry'];
  const { next: rnd } = VB['sim/rng'];
  const Stores = VB['sim/stores'];
  const { KINDS } = VB['sim/kinds'];
  const { seedNeed, seedPer } = VB['sim/hunger'];
  const { fieldsWanted, fieldsWorkable, startProject, BREAK_HOURS } = VB['sim/fields'];
  const Projects = VB['sim/projects'], CL = VB['sim/claims'], { on } = VB['sim/events'], { log, atHousehold } = VB['sim/records'];
  const { startMeadow } = VB['sim/meadows'];
  const { buildStep } = VB['sim/building'];
  // @state st.plans: {households: Map of household id to plan, villages: Map of village id to plan, seasons: Map of household id to its
  //   seasonal plan, due: the due-queue, projects and projectSeq: the project plans (sim/projects, VB-123)}; a standing plan is
  //   {holder: {type: 'household' | 'village', id}, kind: 'standing', nextReview (game hours: its next planning day's review), last (the day
  //   of its last review), woke (the day of its last review woken by a store), looked (the day a member last looked for work outside the
  //   plan's tasks), dirty (sim/stores: a store crossed a target since the last review), reserved, reasons (sim/stores' reservations)}, and a
  //   household's also {targets, tiles, counted}. One standing plan per undissolved household and per village; a dissolved household's plan
  //   is dropped with it, so the maps hold only live holders (Rules for cost, 1). Its review asks each kind where it is available for the
  //   holder (refreshJobs, sim/jobs) on the holder's planning day, and out of turn when a window closes or a store crosses a target.
  // @state st.plans.seasons (VB-252): a household's seasonal plan, {holder, kind: 'season', year, season (of cal), made (the day), steps (the
  //   season's routines in the template's order: kinds of sim/kinds)}; one per undissolved household, made with its standing plan and again
  //   at the standing plan's first review in each season, from its culture's template; dropped with it. The order is recorded, not yet
  //   enforced beyond what the role rankings do (VB-023 enforces the first order).
  // @state st.plans.due: [[hour, household id, index in WINDOWED]], sorted by hour, then id, then index: one entry per live household and
  //   time-bound kind, the hour its kind is next asked for the household (VB-249; Rules for cost, 4). Written only here.
  // @state pawn.diligence: a number in [0, 1) from the stream `traits`, drawn once, when the pawn first heads a household's review (a
  //   stand-in until VB-254); its thirds give the planning day's cadence (every third day, every second, daily).
  // @state plan.targets (a household's; VB-248, VB-252): {wood: [the woodpile's goal by season], woodSecond (a second hand cuts below it),
  //   hayWinters (hay is made while the barn holds less than this many winters' need), seed (grain kept back for each field not yet sown),
  //   perHand (fields a working adult can till): copied from the template when its seasonal plan is made; fields, workable (the fields
  //   wanted and those its hands can till, written at each review, which takes the land step)}. Read by wood (sim/kinds), hayWanted
  //   (sim/meadows), seedNeed (sim/hunger), the review and its land step.
  // @state plan.tiles: {field, meadow}: the tile the plan names for its next field or meadow in place of the holder's choice, -1 for none
  //   (nothing names one yet: VB-253's verb). plan.counted: the year its herds were last counted for the cull (sim/byre), or null.
  // @state plan.build (a household's; VB-332): its building step, {tile, kind 'pick' | 'quarry' | null} (where its stone comes from; -1 and
  //   null for nowhere in reach) while it means to raise its house onto stone, else null or absent; set at each review (sim/building's buildStep).
  // ---- project plans (VB-123; design.md section 7, Holders and plans, Reservations): a holder's plan of steps, each opening when the one
  // before is done, reserving in the holder's store what its steps spend, reviewed at once when its open step is no longer possible. The
  // record and its reads are sim/projects'; only this section writes it, and hears the lower modules' changes by events (target-v2 3.2) ----
  const { projectsOf, projectOf, holderOf } = Projects;
  function remove(st, plan) {
    const map = st.plans.projects[plan.holder.type], list = map.get(plan.holder.id), i = list ? list.indexOf(plan) : -1;
    if (i >= 0) list.splice(i, 1);
    if (list && !list.length) map.delete(plan.holder.id);
  }
  // A project plan for holder {type, id}, from {what, steps, hold} (sim/fields' fieldProject, sim/meadows' meadowProject): what it makes,
  // its steps in order (the first open now), and what it holds back for after it (the seed of a new field). What the steps spend is
  // reserved from the holder's free stock: null, and no plan, when it is not there (another plan holds it).
  function makeProject(st, type, id, { what, steps, hold = null }) {
    const holder = holderOf(st, { type, id }), P = st.plans.projects, spend = {};
    const plan = { id: ++st.plans.projectSeq, holder: { type, id }, kind: 'project', what, steps, open: 0, reserved: {}, reasons: {} };
    if (!P[type].has(id)) P[type].set(id, []);
    P[type].get(id).push(plan);
    for (const s of steps) for (const good in s.spends || {}) spend[good] = (spend[good] || 0) + s.spends[good];
    for (const good in spend) if (!Stores.reserve(st, holder, plan, good, spend[good], 'build')) { dropProject(st, plan); return null; }
    for (const good in hold || {}) Stores.reserve(st, holder, plan, good, hold[good], 'field');
    return plan;
  }
  // The open step is done: what it spends is taken from the store, its reservation with it, and the next step opens; after the last, the
  // plan is finished, what it held released and the plan removed.
  function advance(st, plan) {
    const s = plan.steps[plan.open], holder = holderOf(st, plan.holder);
    for (const good in s.spends || {}) {
      const left = plan.reserved[good] - s.spends[good];
      if (left > 1e-9) Stores.reserve(st, holder, plan, good, left, 'build'); else Stores.release(st, holder, plan, good, 'build');
      Stores.take(st, holder, good, s.spends[good], 'build');
    }
    if (++plan.open >= plan.steps.length) { Stores.releaseAll(plan); remove(st, plan); }
  }
  // The plan is given up: its reservations released, the plan removed, and `text` told as a notable event when given.
  function dropProject(st, plan, text = null, at = {}) {
    Stores.releaseAll(plan); remove(st, plan);
    if (text) log(st, text, { kind: 'projectDropped', ...at });
  }
  // Why the open step is no longer possible, or null: the holder is gone; the claim it works under is lost (contested away, lapsed); the
  // holder's stock no longer covers what its steps will spend (the reserved good lost).
  function impossible(st, plan) {
    const h = holderOf(st, plan.holder), s = plan.steps[plan.open];
    if (!h || h.dissolved || (plan.holder.type === 'pawn' && !h.alive)) return 'its holder is gone';
    if (s.stake && CL.claimOf(st, s.place, plan.holder)?.why !== s.stake) return 'its claim on the land is lost';
    for (const good in plan.reasons) if (plan.reasons[good] === 'build' && plan.reserved[good] > (h[good] || 0) + 1e-9) return `its ${good} is gone`;
    return null;
  }
  // The plan reviewed at once, when a store or a right of its holder changed: while its step is possible it stands (its task posted again
  // at the next review if it was taken down); else it is dropped and told, in the plan's words, or in `text` and `at` given by the change
  // (none when `told`: the change was told already). True when it stands.
  function review(st, plan, told = false, text = null, at = null) {
    const why = impossible(st, plan), h = holderOf(st, plan.holder);
    if (!why) return true;
    if (!told && !text) {
      const house = plan.holder.type === 'household';
      text = `${house ? st.farmsteads[h.farmstead].name : h.name} gives up its ${plan.what === 'meadow' ? 'new hay meadow' : 'new ' + plan.what}: ${why}.`;
      at = house ? atHousehold(st, h) : { [plan.holder.type]: plan.holder.id };
    }
    dropProject(st, plan, told ? null : text, at || {});
    return false;
  }
  // Every plan of a holder that ends (a household dissolved), without a word: the end of its holder is told.
  const dropAll = (st, type, id) => { for (const plan of [...projectsOf(st, type, id)]) dropProject(st, plan); };
  // A holder's claim lost on a tile (sim/stakes: contested away, lapsed; -1: all of them; `told`, or `text` and `at` to tell a plan
  // dropped for it); a store fallen below what a plan's steps will spend (sim/stores); a step done (sim/fields, sim/meadows).
  on('rightLost', (st, d) => {
    for (const plan of [...projectsOf(st, d.type, d.id)]) {
      if (d.tile < 0 || plan.steps.some((s) => s.place === d.tile)) review(st, plan, !!d.told, d.text || null, d.at || null);
    }
  });
  on('storeShort', (st, d) => { for (const plan of [...projectsOf(st, d.type, d.id)]) if (plan.reasons[d.good] === 'build') review(st, plan); });
  on('stepDone', (st, d) => { const plan = projectOf(st, d.type, d.id); if (plan) advance(st, plan); });
  // ---- the template of the year (design.md section 7, How a holder chooses: the year; VB-252) ----
  // A culture's year as rules of sim/registry, so that a culture, a head's foresight (VB-254) or the player (VB-253) changes one row: for
  // each season the routines in the order the work is done (year.order: a routine's place in the season, -1 when it is not done then), and
  // a target for each store. Its first values are those of the code before it, the same for every culture: the woodpile is laid in for
  // winter from summer on, so its goal is higher in summer and autumn; hay for two winters; a field's seed; FIELDS.perHand fields a hand.
  // ctx: {culture (an index of st.cenv.cultures; -1 for a household of none), season, routine (a kind of sim/kinds)}.
  const HAY_WINTERS = 2;
  const ROUTINES = [
    ['manure', 'plow', 'sow', 'rake', 'reclaim', 'clear', 'break', 'meadow', 'thresh', 'wood', 'mend', 'water', 'cook', 'fodder', 'milk', 'fish'],
    ['weed', 'mow', 'hay', 'reclaim', 'clear', 'break', 'meadow', 'wood', 'mend', 'water', 'cook', 'fodder', 'milk', 'fish', 'gather'],
    ['reap', 'haul', 'mow', 'hay', 'thresh', 'slaughter', 'salt', 'wood', 'reclaim', 'clear', 'break', 'meadow', 'mend', 'water', 'cook',
      'fodder', 'milk', 'fish', 'gather', 'brew'], // fishing last, gathering after it (VB-118), as a household checks it (VB-117); not in winter, under the ice
    ['thresh', 'wood', 'slaughter', 'salt', 'mend', 'water', 'cook', 'fodder', 'milk', 'brew'],
  ];
  const ROUTINE_KINDS = [...new Set(ROUTINES.flat())];
  for (const k of ROUTINE_KINDS) if (!KINDS[k]) throw new Error('The template names an unknown kind: ' + k);
  const year = (id, base) => Rules.declare({ id: 'year.' + id, owner: 'sim/plans', combine: 'sum', base });
  year('order', (st, x) => ROUTINES[x.season].indexOf(x.routine));
  year('wood', (st, x) => (x.season === 1 || x.season === 2 ? st.ECON.woodWinter : st.ECON.woodTarget));
  year('woodSecond', (st) => st.ECON.woodTarget * 0.4);
  year('hayWinters', () => HAY_WINTERS);
  year('seed', (st) => st.ECON.seedPerField);
  year('perHand', () => FIELDS.perHand);
  // The template compiled at the season's turn (Rules for cost, 6): per culture {wood: [by season], and of this season woodSecond,
  // hayWinters, seed, perHand, steps: the routines in order}, made at its first need in a season, so a seasonal plan copies arrays and
  // reads no rule (the woodpile's goal is kept for every season, since the kinds read it by the season of the hour). A
  // cache of the rules, not state: never saved; a loaded run compiles it again from the same rules (one ctx, reused: value() allocates
  // nothing, and neither does its caller per rule read).
  const compiled = new WeakMap(), CTX = { culture: -1, season: 0, routine: '' };
  const seasonKey = (c) => c.year * 4 + c.season;
  const rule = (st, id) => Rules.value(st, 'year.' + id, CTX);
  function templateOf(st, culture, c) {
    let cache = compiled.get(st);
    if (!cache || cache.key !== seasonKey(c)) compiled.set(st, cache = { key: seasonKey(c), by: new Map() });
    let T = cache.by.get(culture);
    if (T) return T;
    CTX.culture = culture; CTX.season = 0; CTX.routine = '';
    T = { wood: [0, 0, 0, 0], woodSecond: 0, hayWinters: 0, seed: 0, perHand: 0, steps: null };
    for (let s = 0; s < 4; s++) { CTX.season = s; T.wood[s] = rule(st, 'wood'); }
    CTX.season = c.season;
    T.woodSecond = rule(st, 'woodSecond'); T.hayWinters = rule(st, 'hayWinters'); T.seed = rule(st, 'seed'); T.perHand = rule(st, 'perHand');
    const ranked = [];
    for (const k of ROUTINE_KINDS) { CTX.routine = k; const n = rule(st, 'order'); if (n >= 0) ranked.push([n, k]); }
    T.steps = ranked.sort((a, b) => a[0] - b[0]).map((e) => e[1]);
    cache.by.set(culture, T);
    return T;
  }
  // The culture of a household's village (-1: no farm, or no culture yet).
  function cultureOf(st, hh) {
    const s = hh.farmstead !== null && st.cenv ? st.cenv.settlements[st.farmsteads[hh.farmstead].village] : null;
    return s ? s.culture : -1;
  }
  // The household's seasonal plan for the season of c, from its culture's template, and the standing plan's targets copied from it; from
  // then on the review reads the plan, never the template, so a later change to one household's plan touches no other.
  function seasonal(st, plan, c) {
    const id = plan.holder.id, T = templateOf(st, cultureOf(st, st.households[id]), c), P = plan.targets;
    for (let s = 0; s < 4; s++) P.wood[s] = T.wood[s];
    P.woodSecond = T.woodSecond; P.hayWinters = T.hayWinters; P.seed = T.seed; P.perHand = T.perHand;
    const sp = { holder: { type: 'household', id }, kind: 'season', year: c.year, season: c.season, made: c.day, steps: [...T.steps] };
    st.plans.seasons.set(id, sp);
    return sp;
  }
  const seasonOf = (st, id) => st.plans.seasons.get(id);
  // The hours at which plans may be reviewed and the due-queue is asked: every hour from one before work starts to the end of work
  // (sim/clock calls refreshJobs then).
  const reviewHour = (h) => h >= WORK[0] - 1 && h <= WORK[1];
  // The first review hour after the hour of time t.
  function reviewAfter(t) {
    const day = Math.floor(t / DAY), h = Math.floor(t - day * DAY) + 1;
    if (h < WORK[0] - 1) return day * DAY + WORK[0] - 1;
    if (h > WORK[1]) return (day + 1) * DAY + WORK[0] - 1;
    return day * DAY + h;
  }
  const mapOf = (st, type) => (type === 'household' ? st.plans.households : st.plans.villages);
  // ---- planning days (design.md section 7, Planning days; VB-249) ----
  const FIRST = WORK[0] - 1, HOURS = WORK[1] - FIRST + 1; // the review hours, 5:00 to 18:00
  // The head's diligence, drawn once (a stand-in until VB-254).
  function diligence(st, id) {
    const p = st.pawns[id];
    if (p.diligence === undefined) p.diligence = rnd(st.rng.traits);
    return p.diligence;
  }
  // Days between a holder's reviews: by its head's diligence, every third day (the lowest third), every second, or daily; a village's daily.
  function cadence(st, plan) {
    if (plan.holder.type !== 'household') return 1;
    const head = st.households[plan.holder.id].holder;
    if (head === null || head === undefined) return 1;
    const d = diligence(st, head);
    return d < 1 / 3 ? 3 : d < 2 / 3 ? 2 : 1;
  }
  // The holder's next planning hour after `hour`: its hour of the working day and its day in the cycle are offset by its id, so reviews
  // spread over the days and over the hours of work (rule 5); a village is offset from the household of the same id.
  function nextSlot(plan, cad, hour) {
    const id = plan.holder.id + (plan.holder.type === 'household' ? 0 : 7), h = FIRST + (id * 5) % HOURS;
    let day = Math.floor(hour / DAY);
    if (day * DAY + h <= hour) day++;
    while ((day + id) % cad) day++;
    return day * DAY + h;
  }
  // Days on which a window is about to close, or has just closed, and every holder is reviewed at its first review hour: the last day of
  // sowing and the day after it (its hoeing and sowing taken down), the two last days of autumn (the harvest before the frost), and the first
  // day of winter (the ice: fishing taken down, VB-117).
  function closing(st, c) {
    const last = st.ECON.sowWindow[1];
    return (c.season === 0 && (c.sday === last || c.sday === last + 1)) || (c.season === 2 && c.sday >= SEASON_DAYS - 2) || (c.season === 3 && c.sday === 0);
  }
  // A household whose field is ripe, or that has a field still to hoe or sow while the sowing window is open, at the first review hour:
  // its fields' window is closing on it (a crop that waits for a planning day meets the frost; VB-322). Walks its own fields only.
  function fieldsDue(st, plan, c) {
    if (plan.holder.type !== 'household' || c.hour !== FIRST) return false;
    const hh = st.households[plan.holder.id], f = hh.farmstead === null ? null : st.farmsteads[hh.farmstead];
    if (!f || f.household !== hh.id) return false;
    const W = st.ECON.sowWindow, sow = c.season === 0 && c.sday >= W[0] && c.sday <= W[1];
    for (const fd of f.fields) if (fd.stage === 'ripe' || (sow && (fd.stage === 'stubble' || fd.stage === 'plowed'))) return true;
    return false;
  }
  // Why the holder's plan is reviewed at this hour, or null: its planning day ('day'); a window closing today, or its fields due today,
  // once ('window'); a store that crossed a target, at most one such review a day ('store').
  function reviewWhy(st, plan, hour, c) {
    if (hour >= plan.nextReview) return 'day';
    if (plan.last !== c.day && (closing(st, c) || fieldsDue(st, plan, c))) return 'window';
    return plan.dirty && plan.woke !== c.day ? 'store' : null;
  }
  // A member without a task looks at the household's opportunities: true at most once a household a day (VB-249).
  function mayLook(plan, day) {
    if (plan.looked === day) return false;
    plan.looked = day;
    return true;
  }
  // ---- the due-queue (Rules for cost, 4): each time-bound kind (its `window`, sim/kinds) is asked for a household from its window's hour,
  // and again the next hour while it gives work and the day's work goes on; else at its next opening ----
  const WINDOWED = Object.keys(KINDS).filter((k) => KINDS[k].window);
  const byDue = (x, y) => x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
  // The first hour after `hour` at which the window of WINDOWED[k] opens.
  function opens(k, hour) {
    const from = KINDS[WINDOWED[k]].window.from;
    let day = Math.floor(hour / DAY);
    if (day * DAY + from <= hour) day++;
    return day * DAY + from;
  }
  // The entries due by this hour, taken off the queue (they are its first).
  function dueNow(st, hour) {
    const q = st.plans.due;
    let n = 0;
    while (n < q.length && q[n][0] <= hour) n++;
    return n ? q.splice(0, n) : [];
  }
  // The entries asked at this hour, back on the queue: the next hour while the kind gave work (gave[i]) and the day's work goes on, else at
  // the window's next opening. An entry of a household whose plan is gone is dropped.
  function again(st, entries, gave, hour) {
    const q = st.plans.due, end = Math.floor(hour / DAY) * DAY + WORK[1];
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      if (!st.plans.households.has(e[1])) continue;
      e[0] = gave[i] && hour + 1 <= end ? hour + 1 : opens(e[2], hour);
      q.push(e);
    }
    if (entries.length) q.sort(byDue);
  }
  // A household's entries, one per time-bound kind, at their next openings.
  function enqueue(st, id) {
    const hour = Math.floor(st.tick / TICKS);
    for (let k = 0; k < WINDOWED.length; k++) st.plans.due.push([opens(k, hour), id, k]);
    st.plans.due.sort(byDue);
  }
  // A household's targets, seasonal plan, tiles, cull record and reservation of seed, at its plan's making and at the load of a save
  // without them.
  function household(st, plan) {
    const hh = st.households[plan.holder.id];
    plan.targets = { wood: [0, 0, 0, 0], woodSecond: 0, hayWinters: 0, seed: 0, perHand: 0, fields: 0, workable: 0 };
    seasonal(st, plan, cal(st.t));
    const T = plan.targets;
    if (hh.farmstead !== null) { T.workable = fieldsWorkable(st, hh, T.perHand); T.fields = fieldsWanted(st, hh, T.workable); }
    plan.tiles = { field: -1, meadow: -1 };
    plan.counted = null;
    Stores.reserve(st, hh, plan, 'grain', hh.farmstead !== null ? seedNeed(st, hh) : 0, 'seed');
  }
  // A holder's standing plan, made when the household is founded or the village is (and for every holder at seed and load). Its first
  // review is at the next review hour, whatever its planning day.
  function makePlan(st, type, id) {
    const plan = { holder: { type, id }, kind: 'standing', nextReview: reviewAfter(Math.floor(st.tick / TICKS) - 1), last: null, woke: null,
      looked: null, dirty: false, reserved: {}, reasons: {} };
    mapOf(st, type).set(id, plan);
    if (type === 'household') { household(st, plan); enqueue(st, id); }
    return plan;
  }
  // A dissolved household's plan goes with it, its reservations with the plan, and its entries leave the due-queue.
  function dropPlan(st, type, id) {
    mapOf(st, type).delete(id);
    dropAll(st, type, id); // its project plans with it
    if (type === 'household') { st.plans.seasons.delete(id); st.plans.due = st.plans.due.filter((e) => e[1] !== id); }
  }
  const planOf = (st, type, id) => mapOf(st, type).get(id);
  // The plans of every live holder, at seed, and at the load of a save made before plans (VB-258).
  function seedPlans(st) {
    st.plans = { households: new Map(), villages: new Map(), seasons: new Map(), due: [], projects: Projects.emptyProjects(), projectSeq: 0 };
    for (const id of st.liveHouseholds) makePlan(st, 'household', id);
    for (const v of st.villages) makePlan(st, 'village', v.id);
    fromFarms(st);
  }
  // A save made before project plans (VB-123) held a farm's land project on the farm ({tile, stage, hours}): its household's plan now.
  function fromFarms(st) {
    for (const f of st.farmsteads) {
      const p = f.project, hh = p && f.household !== null ? st.households[f.household] : null, why = p && p.stage === 'meadow' ? 'meadow' : 'field';
      const step = (kind, hours) => ({ kind, place: p.tile, hours, stake: why });
      if (hh && !hh.dissolved) makeProject(st, 'household', hh.id, { what: why, hold: { grain: seedPer(st, hh) },
        steps: p.stage === 'clear' ? [step('clear', p.hours), step('break', BREAK_HOURS)] : [step(p.stage, p.hours)] });
      if ('project' in f) delete f.project; // lint-allow: owner a save made before project plans loses the farm's field
    }
  }
  // A save made before the plans' targets and reservations (VB-248), before planning days and the due-queue (VB-249), or before seasonal
  // plans (VB-252): its plans get them as made now.
  function fillPlans(st) {
    if (!st.plans.seasons) st.plans.seasons = new Map();
    if (!st.plans.projects) { st.plans.projects = Projects.emptyProjects(); st.plans.projectSeq = 0; } // VB-123: project plans
    for (const plan of [...st.plans.households.values(), ...st.plans.villages.values()]) {
      if (!plan.reserved) {
        plan.reserved = {}; plan.reasons = {}; // lint-allow: owner a save made before reservations gets empty ones (sim/stores writes them)
        if (plan.holder.type === 'household') household(st, plan);
      }
      if (plan.holder.type === 'household' && !st.plans.seasons.has(plan.holder.id)) seasonal(st, plan, cal(st.t));
      if (plan.last === undefined) {
        plan.last = null; plan.woke = null; plan.looked = null;
        plan.dirty = false; // lint-allow: owner a save made before the flag gets it clear (sim/stores sets it)
      }
    }
    if (!st.plans.due) { st.plans.due = []; for (const id of st.plans.households.keys()) enqueue(st, id); }
    fromFarms(st);
  }
  // A plan reviewed now, for `why` (reviewWhy): on its planning day its next is set by its cadence; a review out of turn leaves it. The
  // flag of a store is cleared. A household's first review in a season makes its seasonal plan from the template (VB-252); every review
  // reads the targets from the plan, writes those of today's values (the fields wanted, which the land step reads), notes the year's count
  // of its herds once it is held, and reserves the seed its unsown fields and its land project need (sim/stores counts it again when read).
  function reviewed(st, plan, c, why = 'day') {
    const hour = Math.floor(st.tick / TICKS);
    VB.count.planReview++;
    if (hour >= plan.nextReview) plan.nextReview = nextSlot(plan, cadence(st, plan), hour);
    plan.last = c.day;
    if (why === 'store') plan.woke = c.day;
    plan.dirty = false; // lint-allow: owner the review has read the stores whose crossing sim/stores flagged
    if (plan.holder.type !== 'household') return;
    const hh = st.households[plan.holder.id], T = plan.targets, sp = seasonOf(st, hh.id);
    if (sp.year !== c.year || sp.season !== c.season) seasonal(st, plan, c);
    T.workable = fieldsWorkable(st, hh, T.perHand); T.fields = fieldsWanted(st, hh, T.workable);
    if (c.doy >= HERD.countDay && plan.counted !== c.year && hh.herds.length) plan.counted = c.year;
    Stores.reserve(st, hh, plan, 'grain', seedNeed(st, hh), 'seed');
    plan.build = buildStep(st, plan, hh); // the building step (VB-332): open while the house is to be raised onto stone, and where its stone comes from
  }
  // The land step (at each review of a household's plan): a new field while the household has fewer than the plan's target, else a hay
  // meadow while it is short of one; the tile is the holder's choice (chooseTile, chooseMeadow) unless the plan names one.
  // `built`: the houses and greens, once for every farm's look (sim/fields, builtTiles).
  function landStep(st, plan, f, hh, built) {
    let p = startProject(st, f, hh, built, plan.targets.fields, plan.tiles.field);
    if (p) makeProject(st, 'household', hh.id, p);
    p = startMeadow(st, f, hh, built, plan.tiles.meadow);
    if (p) makeProject(st, 'household', hh.id, p);
    Stores.reserve(st, hh, plan, 'grain', seedNeed(st, hh), 'seed'); // a project begun holds its seed from now
  }
  return { reviewHour, makePlan, dropPlan, planOf, seasonOf, seedPlans, fillPlans, reviewed, landStep, reviewWhy, mayLook, closing, cadence, WINDOWED,
    dueNow, again, ROUTINES, cultureOf,
    // the project plans, read through here by the modules above sim/projects (VB-123)
    projectOf: Projects.projectOf, projectsOf: Projects.projectsOf, openOf: Projects.openOf,
    makeProject, advance, drop: dropProject, review, dropAll, impossible };
})();
