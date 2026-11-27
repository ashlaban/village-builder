// @sys sim/day: the day's work (VB-466; design.md section 7, The day's work): the head allots its household's tasks to its members by
// their fit (sim/fit), each takes the first of its list it can, the head calls for what is urgent, due today or left for the evening; one
// on a day owed or lent (sim/days, sim/hands) takes of the tasks of the household it works for; the hours of help a head lacks, asked at
// the morning's allotment (sim/hands, VB-470). Owns plan.day
VB['sim/day'] = (() => {
  const { unbound, atWork } = VB['sim/pose'];
  const { WORK, TICKS, cal } = VB['sim/rules'],
    { CHILD, MATCH, absentMask } = VB['sim/roles'];
  const { age } = VB['sim/records'];
  const { travelling } = VB['sim/pose'],
    { rateOf, attentionOf, doneOf } = VB['sim/work'];
  const { issue, register } = VB['sim/commands'];
  const { on } = VB['sim/events'];
  const { eligible } = VB['sim/eligibility'];
  const { KINDS, isOpen, carriedOn } = VB['sim/kinds'];
  const { says } = VB['sim/methods'];
  const Days = VB['sim/days'];
  const Levies = VB['sim/levies'];
  const Hands = VB['sim/hands'];
  const { planOf, heads, planOp, planFacade } = VB['sim/plans'];
  const Estimate = VB['sim/estimate'];
  const { score, bid, matchBar, joined, allotted, workCommand, jobsFor } = VB['sim/fit'];
  const Workmanship = VB['sim/workmanship'],
    { GOODS } = VB['sim/goods'];
  const Offers = VB['sim/offers'],
    { remember } = VB['sim/relations'],
    { unplanned, fullName, living } = VB['sim/records'],
    Pastimes = VB['sim/pastimes'],
    { release } = VB['sim/agents'],
    { CROPS } = VB['sim/crops'];
  // A kind whose work makes a graded good at a craft (VB-761: the hewing of a quern): the household's most skilled hand at the craft
  // takes it (sim/workmanship maker). Kinds are fixed at load: worked out once a kind, never saved.
  const MAKES = new Map();
  const makesGraded = (kind) => {
    let m = MAKES.get(kind);
    if (m === undefined) {
      const K = KINDS[kind];
      MAKES.set(kind, (m = !!(K.craft && K.gives && K.gives.some((g) => GOODS.get(g) && GOODS.get(g).graded))));
    }
    return m;
  };
  const none = new Set();
  // Where a bid of score s goes in bids[from..], which is sorted best first: after every bid at least as good.
  function slot(bids, from, s) {
    let lo = from,
      hi = bids.length;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (bids[m][0] >= s) lo = m + 1;
      else hi = m;
    }
    return lo;
  }
  // ---- the head's day (VB-466; design.md section 7, The day's work) ----
  // @state plan.day (a household's standing plan's; sim/plans holds the plan): absent until first allotted, then {made (the game hour),
  //   lists: {pawn id: [job keys]}}: for each living member the tasks the head gave it, in the order it takes them; a member too young has
  //   an empty list; fits: {pawn id: [fit or null]} and hours: {pawn id: [hours]}, beside each list, the fit each entry was given at and
  //   the hours of the member's day it was given (given, further: VB-1558); free:
  //   {pawn id: hours}: the working hours of the horizon the head gave each member no task in (VB-470: what it may lend). Written by
  //   allot, whole, and by slotIn, a task put into the lists as they stand; a key whose job is gone is passed over; edited: absent, or
  //   {t (the game hour), by (the actor)} of the head's last change by its verbs dayOrder, assign and call (VB-477), which stands
  //   until the day is next allotted (allot writes the day whole, without it); off: absent, or the ids of the members the head called off
  //   (call), given and taking no task until the day is next allotted; risk (VB-1779): absent, or [[job key, work left unmanned]], the
  //   tasks at risk the allotment found no member's levy could take and no demand covered (sim/points' decision point `demand`). Plain
  //   data, saved with the plan.
  // A member's working hours of the horizon, by the clock; what it does in them at a task is the head's belief of its rate there (VB-476).
  const dayHours = () => MATCH.day.horizon * (WORK[1] - WORK[0]);
  const hoursLeft = (st, j) => (j.hours ?? KINDS[j.kind].hours ?? 0) - doneOf(st, j);
  // The head allots the household's day. Every member is weighed for every task of the household and of its village that it may take, by
  // its fit (score); best fit first, a further hand on a task counting for less (join), a task is given hands until they cover its work
  // left as the head estimates it (sim/estimate, VB-476: the causes its judgement reckons with, leaned by its lean), each member up to its
  // working hours of the horizon at the rate the head believes it works that task at; then each member's list goes on with the other
  // tasks it may take, by its fit: a levied member's list past its levy, which it gives its own hours to only by its judgement (takeDay;
  // VB-1762: Work beats idling, replaced), and the head pair's, whose plan it is. No random
  // draw. Then the head calls: a member at work leaves its task for the first of its list when that is much more urgent (switchRatio,
  // switchMargin; VB-107), a task with a deadline today (`late`: the meal)
  // calls its hand from work, from the road or from idling. The others take their tasks when they next look for work (takeDay).
  // `asking`, in the morning's allotment (allotDays): the list that gains [household id, hours short] when the household is short of hands.
  function allot(st, hh, c, asking = null) {
    const plan = planOf(st, 'household', hh.id);
    if (!plan || hh.farmstead === null) return;
    VB.count.dayAllot++;
    const w = weighDay(st, hh, c);
    plan.day = { made: Math.floor(st.tick / TICKS), lists: w.lists, fits: w.fits, hours: w.hours, free: w.free };
    // the morning's allotment: the hours of help the head's estimate says the household lacks to finish its field work in its windows
    const ctx = w.ctx;
    if (asking && ctx.est.size) {
      const tasks = [];
      for (const [j, left] of ctx.est) tasks.push([j, left, (ctx.manned.get(j) || [0])[0]]);
      const short = Math.max(Hands.shortOf(st, tasks, c), Hands.plannedHelp(st, hh, c)); // and what its season's fit planned (VB-1778)
      if (short > 0) asking.push([hh.id, short]);
    }
    demandAtRisk(st, hh, w.H, w.pairs, ctx, c, plan);
    for (const p of w.members) call(st, hh, p, ctx.due.get(p.id), ctx.given.get(p.id), c, w.memo, w.stand);
  }
  // The day the rule would allot household hh, as it stands now, and nothing written (allot's first part; sim/points reads it, VB-1848):
  // {lists, fits, hours, free, members (those allotted), ctx, memo, stand, H (the head's estimate), pairs}. Counts dayWould.
  function weighDay(st, hh, c) {
    VB.count.dayWould++;
    const lists = {},
      fits = {},
      hours = {},
      members = [];
    for (const id of hh.members) {
      const p = st.pawns[id];
      if (p.died !== null) continue;
      lists[id] = [];
      fits[id] = [];
      hours[id] = [];
      // the head allots around those it does not have today (allotted)
      if (allotted(st, p)) members.push(p);
    }
    const memo = new Map(),
      stand = standIn(hh, members),
      pairs = [];
    if (members.length) {
      const jobs = jobsFor(st, members[0]);
      VB.count.dayPair += (jobs.length ?? jobs.size) * members.length;
      for (const j of jobs) weigh(st, hh, members, j, c, memo, stand, pairs);
    }
    pairs.sort((x, y) => y[0] - x[0] || x[2].id - y[2].id || x[1] - y[1]);
    vitalFirst(st, hh, pairs);
    const H = Estimate.headOf(st, hh),
      ctx = {
        lists,
        fits,
        hours,
        est: new Map(), // job -> the work left as the head sees it, once an allotment
        // a member's levy left today (sim/levies capacity); the head pair, not levied, their working hours of the horizon (VB-1760)
        cap: new Map(members.map((p) => [p.id, Levies.capacity(st, hh, p, c)])),
        manned: new Map(), // job -> [hours of work given, hands]
        given: new Map(), // pawn -> its first task of the first pass, with its fit
        due: new Map(), // pawn -> the task with a deadline today it is the hand for
        heads: new Map(), // pawn -> the tasks that come first at the head of its list (`first`: the water, each of the day's trips)
      };
    man(st, H, pairs, ctx);
    const free = {};
    for (const p of members) free[p.id] = ctx.cap.get(p.id);
    return { lists, fits, hours, free, members, ctx, memo, stand, H, pairs };
  }
  // ---- the head's demand (VB-1779; design.md section 7, The levy and own hours: The head's demand, Demand and take) ----
  // The work at risk the allotment left unmanned, [[task, work left unmanned, rations at risk]]: a field step whose window its hands given
  // today cannot cover (sim/hands shortOf, by the head's estimate), its target's yield (sim/estimate fieldYield) times the share of
  // its work unmanned; a task due today (`late`), a ration a living member for the share unmanned (the day's food it stands for).
  function atRisk(st, hh, ctx, c) {
    const out = [];
    for (const [j, left] of ctx.est) {
      VB.count.riskWeighed++;
      const m = ctx.manned.get(j) || [0, 0],
        u = left - m[0],
        K = KINDS[j.kind];
      if (!(u > 1e-9) || !(left > 0) || m[1] >= K.hands) continue;
      let R = 0;
      if (K.late) R = (hh.members.filter((id) => st.pawns[id].died === null).length * u) / left;
      else if (j.field && CROPS[j.field.crop] && Hands.shortOf(st, [[j, left, m[0]]], c) > 0)
        R = (Estimate.fieldYield(j.field.crop) * u) / left; // sim/estimate's one reckoning of a field's yield
      if (R > 0) out.push([j, u, R]);
    }
    return out;
  }
  // The head weighs a demand for each task at risk (atRisk) that no member's levy left today can take: of the members its allotment would
  // give it, in the allotment's order (its pairs, best fit first), each whose levy left is spent and who has working hours left today,
  // h hours of it when R > DEMAND.weight × h × V + G (sim/levies demands), one at a time until the work is found or none complies. The
  // demand is an offer to the member on the basis `demand`, which it answers by its judgement (sim/levies complies); a yes puts the task
  // into its list among its tasks given hands, with those hours. A head with no levied member demands nothing; a head on its own
  // commands is asked instead (the decision point `demand`, sim/points): the tasks still at risk are kept on the day (day.risk).
  function demandAtRisk(st, hh, H, pairs, ctx, c, plan) {
    const day = plan.day;
    if (hh.holder === null || !ctx.est.size) return;
    const risk = atRisk(st, hh, ctx, c);
    if (!risk.length) return;
    const own = unplanned(st, hh.holder),
      left = [],
      dayLeft = WORK[1] - Math.min(WORK[1], Math.max(WORK[0], c.hour));
    for (const [j, u0, R] of risk) {
      let u = u0;
      if (!own)
        for (const [s, id, pj] of pairs) {
          if (pj !== j || u <= 1e-9) continue;
          const p = st.pawns[id];
          if (ctx.cap.get(id) > 1e-9 || !Levies.levied(st, hh, p) || (day.off && day.off.includes(id))) continue;
          if (ctx.lists[id].includes(j.key) && ctx.fits[id][ctx.lists[id].indexOf(j.key)] > 0) continue;
          const r = Estimate.rateFor(st, H, id, j, true),
            had = ctx.hours[id].reduce((x, y) => x + y, 0),
            h = r > 0 ? Math.min(u / r, dayLeft - had) : 0;
          if (h < 1 || !Levies.demands(st, hh, p, h, (R * h * r) / u0)) continue;
          VB.count.demandMade++;
          const o = Offers.make(st, {
            actor: hh.holder,
            target: id,
            args: { basis: 'demand', wants: { verb: 'default', key: j.key, hours: h, fit: s } },
            source: 'pawn',
          });
          // an open demand (a played member to answer) is counted as asked: no second demand, no risk named for it (review F4)
          if (o === 'yes' || o === 'open') u -= h * r;
          if (o === 'yes') {
            const m = ctx.manned.get(j) || [0, 0];
            ctx.manned.set(j, [m[0] + h * r, m[1] + 1]);
          }
          if (o === 'yes' || o === 'open') break;
        }
      if (u > 1e-9) left.push([j.key, u]);
    }
    if (left.length) plan.day.risk = left;
  }
  // The demand past the levy (Demand and take: "a call past the levy left is the same demand, whoever issues it"), an offer from the head
  // to its member, answered by the member's judgement at once (J + GIVE.press > 0), or by its controller within the day; wants {verb
  // ('assign', 'call': the verb's args; 'default': the head's own at its allotment, key, hours, fit), ...}. A yes carries the act out; a
  // no is the head's memory. The hours it works so are booked demanded (sim/levies), the goodwill its head then owes it with them.
  Offers.basis('demand', {
    books: 'nothing',
    wait: () => 0,
    check: (st, o) => {
      const w = o.wants,
        p = st.pawns[o.to];
      if (!w || !['assign', 'call', 'default'].includes(w.verb)) return 'a demand names what it asks';
      const hh = p && p.died === null && p.household !== null ? st.households[p.household] : null;
      if (!hh || hh.holder !== o.from) return `pawn ${o.from} is not the head of pawn ${o.to}'s household`;
      return { household: hh.id };
    },
    answers: (st, o) => [{ key: 'member', by: o.to, yes: null }],
    weigh: (st, o) => Levies.complies(st, st.households[o.household], st.pawns[o.to], st.jobs.get(o.wants.key)),
    settle: (st, o) => {
      const w = o.wants,
        hh = st.households[o.household],
        day = planOf(st, 'household', hh.id).day;
      VB.count.demandMet++;
      if (w.verb !== 'default') {
        const r = issue(st, {
          actor: o.from,
          verb: w.verb,
          target: hh.id,
          args: { ...w.args, demand: 'met' },
          source: 'pawn',
        });
        return r === true ? true : r;
      }
      const j = st.jobs.get(w.key);
      if (!j || !day || !day.lists[o.to] || !day.fits || cal(st.t).hour >= WORK[1])
        return 'the work it was asked for is gone';
      const ctx = { lists: day.lists, fits: day.fits, hours: day.hours },
        k = day.lists[o.to].indexOf(w.key);
      if (k >= 0) leave(ctx, o.to, k);
      given(ctx, o.to, w.key, w.fit, w.hours);
      return true;
    },
    refused: (st, o, no) => {
      VB.count.demandRefused++;
      if (living(st, o.from) === null && living(st, no.by) === null) remember(st, o.from, no.by, 'refusedUs');
    },
    lapsed: () => {},
    what: (st, o) =>
      `a demand of ${Math.round(o.wants.hours * 10) / 10} hours past the levy by ${fullName(st.pawns[o.from])}`,
  });
  // The hours past member id's levy left today that `h` hours more of its household's work would ask of it: 0 for one not levied (the
  // head pair) or a household with no day's hours kept. Its levy left is what the day left it given no task (plan.day.free).
  function pastLevy(st, hh, id, h, day) {
    if (!(h > 0) || !Levies.levied(st, hh, st.pawns[id])) return 0;
    const free = day.free && id in day.free ? day.free[id] : Levies.capacity(st, hh, st.pawns[id], cal(st.t));
    return Math.max(0, h - free);
  }
  // A verb past the levy is a demand, named before it is issued (3.6): refused unless args.demand is true, with the hours it asks; with
  // it, the demand is made (an offer to the member: Offers' basis `demand`), and the act is carried out at its yes.
  const demandWhy = (st, c, id, past) =>
    past > 1e-9 && !c.args.demand
      ? `${c.verb} is a demand: ${Math.round(past * 10) / 10} hours past pawn ${id}'s levy left today (issue it with demand: true)`
      : null;
  function demand(st, c, id, past) {
    VB.count.demandMade++;
    Offers.make(st, {
      actor: c.actor,
      target: id,
      args: { basis: 'demand', wants: { verb: c.verb, args: { ...c.args }, key: c.args.key, hours: past } },
      source: c.source,
    });
  }
  // Work a household lives by is inside a member's levy and slotted first (VB-1760; design.md section 7, The day's capacity): the best
  // pair of each task of a vital kind (sim/kinds carriedOn), where its member is levied, goes before the rest, in order, so that its
  // hours come out of the levy before lesser work's. Only the task's best pair, so the head pair, not levied, keep a vital task they fit
  // best (a meal the wife cooks), and the hand a vital task goes to is the one it went to before.
  function vitalFirst(st, hh, pairs) {
    const seen = new Set(),
      first = [],
      rest = [];
    for (const pair of pairs) {
      const j = pair[2],
        best = !seen.has(j);
      seen.add(j);
      if (best && carriedOn(st, j) && Levies.levied(st, hh, st.pawns[pair[1]])) first.push(pair);
      else rest.push(pair);
    }
    if (!first.length) return;
    pairs.length = 0;
    for (const pair of first) pairs.push(pair);
    for (const pair of rest) pairs.push(pair);
  }
  // The roles the household lacks today, whose ranks its holder takes (VB-1545): one pass over the members allotted.
  const standIn = (hh, members) =>
    hh.holder !== null && members.some((p) => p.id === hh.holder) ? absentMask(hh.holder, members) : 0;
  // Each member weighed for task j (allot's for every task, the slot's for the one): its fit (score) where it may take it, into `pairs`.
  function weigh(st, hh, members, j, c, memo, stand, pairs) {
    if (attentionOf(j) === 'full' && hoursLeft(st, j) <= 0) return; // only its load is on the road
    // a making of a graded good goes to the most skilled hand at its craft of those who may take it (VB-761)
    const only = makesGraded(j.kind)
      ? Workmanship.maker(
          st,
          members.filter((p) => eligible(st, j, p)).map((p) => p.id),
          KINDS[j.kind].craft,
        )
      : null;
    for (const p of members) {
      if (only !== null && p.id !== only) continue;
      if (!eligible(st, j, p)) continue;
      const s = score(st, p, j, c, memo, p.id === hh.holder ? stand : 0);
      if (s !== null && s > 0) pairs.push([s, p.id, j]);
    }
  }
  // A list's entries, their fits and their hours (plan.day.fits, plan.day.hours): the fit is null at its head (a fetch, a task with a
  // deadline today), the fit a task was given hands at in the first pass (> 0, best first), less than 0 for the rest (minus the fit, best
  // first); the hours, those of the member's day the entry was given (0 for the rest). A task given hands goes after the first pass's
  // entries as good, a further one after the rest as good: in the allotment, the end of each; in the slot, its place.
  function given(ctx, id, key, s, h) {
    const fit = ctx.fits[id];
    let i = fit.length;
    while (i > 0 && fit[i - 1] !== null && fit[i - 1] < 0) i--;
    while (i > 0 && fit[i - 1] !== null && fit[i - 1] < s) i--;
    enter(ctx, id, i, key, s, h);
  }
  function further(ctx, id, key, s) {
    const fit = ctx.fits[id];
    let i = fit.length;
    while (i > 0 && fit[i - 1] !== null && fit[i - 1] < 0 && -fit[i - 1] < s) i--;
    enter(ctx, id, i, key, -s, 0);
  }
  function enter(ctx, id, i, key, fit, h) {
    ctx.lists[id].splice(i, 0, key);
    ctx.fits[id].splice(i, 0, fit);
    ctx.hours[id].splice(i, 0, h);
  }
  function leave(ctx, id, i) {
    ctx.lists[id].splice(i, 1);
    ctx.fits[id].splice(i, 1);
    return ctx.hours[id].splice(i, 1)[0];
  }
  // The pass over the pairs weighed, best first (allot's over the day's tasks, the slot's over its one): a pair whose task has gained
  // hands since it was weighed falls by `join` for each (VB-102: the hands spread over the tasks that can be worked at once) and waits its
  // turn again; a task is given hands until they cover its work left as the head estimates it, each member up to its hours left (`cap`);
  // the pairs left over go on each member's list after.
  function man(st, H, pairs, ctx) {
    const { est, cap, manned, given: first, due, heads } = ctx,
      spare = [];
    for (let i = 0; i < pairs.length; i++) {
      const pair = pairs[i],
        [s, id, j, k = 0] = pair,
        full = attentionOf(j) === 'full',
        m = manned.get(j) || [0, 0],
        K = KINDS[j.kind];
      let left = 0;
      if (full && (left = est.get(j)) === undefined) est.set(j, (left = Estimate.workFor(st, H, j)));
      if (m[1] >= KINDS[j.kind].hands || (full && (cap.get(id) <= 0 || m[0] >= left)) || (!full && m[1] > 0)) {
        spare.push(pair);
        continue;
      }
      if (m[1] > k) {
        const again = [s * joined(j, m[1] - k), id, j, m[1]];
        pairs.splice(slot(pairs, i + 1, again[0]), 0, again);
        continue;
      }
      const r = full ? Estimate.rateFor(st, H, id, j, m[1] === 0) : 0,
        h = r > 0 ? Math.min(cap.get(id), (left - m[0]) / r) : 0;
      // the hours of a trip beside its work (the water's walk) are hours of its hand's day too (VB-1582)
      const had = cap.get(id);
      const trip = says(K, 'trip'); // its method's go step's (VB-1821)
      cap.set(id, Math.max(0, had - h - (trip ? trip(st, j) : 0)));
      manned.set(j, [m[0] + h * r, m[1] + 1]);
      // water first (VB-1582): the fetch heads the list of the member best fit for it. A task with a deadline today that waits
      // unmanned goes first in its hand's list too, after a fetch, whatever its fit, and calls it (call)
      const head = heads.get(id) || 0;
      if (K.first && !j.claims.length) {
        heads.set(id, head + 1);
        enter(ctx, id, head, j.key, null, had - cap.get(id));
      } else if (K.late && !j.claims.length && !due.has(id)) {
        due.set(id, j);
        enter(ctx, id, head, j.key, null, had - cap.get(id));
      } else given(ctx, id, j.key, s, had - cap.get(id));
      if (full && !first.has(id)) first.set(id, [s, j]);
    }
    for (const [s, id, j] of spare) further(ctx, id, j.key, s);
  }
  // The head calls member p (design.md section 7, The head calls): to `dj`, the task with a deadline today it is the hand for, from work,
  // from the road or from idling; else from its work to `top`, the first of its list, when that is much more urgent (switchRatio,
  // switchMargin; VB-107).
  function call(st, hh, p, dj, top, c, memo, stand) {
    const a = st.agents[p.id],
      busy = !!a.job && attentionOf(a.job) === 'full';
    if (a.taking > st.tick) return; // keeping hours of its levy for itself (breach)
    if (dj && a.job !== dj && isOpen(st, dj) && c.hour <= WORK[1]) {
      // the deadline calls: from work, from the road to it, or from idling (waiting, or out for company; not at an occasion)
      if (busy ? a.job && !(a.load > 0) : !a.job && unbound(a) && a.occasion === null)
        issue(st, workCommand(a.id, dj.key, 'planner'));
      return;
    }
    if (!top || !busy || !atWork(a) || a.job === top[1] || !isOpen(st, top[1])) return;
    if (
      hoursLeft(st, a.job) > rateOf(st, p) &&
      top[0] >
        MATCH.switchRatio * (score(st, p, a.job, c, memo, p.id === hh.holder ? stand : 0) ?? 0) + MATCH.switchMargin
    )
      issue(st, workCommand(a.id, top[1].key, 'planner'));
  }
  // ---- the slot (VB-1558; design.md section 7, The day's work: "a task the due-queue opens in the day is weighed alone") ----
  // Task j, newly due for household hh, put into the day's lists as they stand: each member allotted is weighed for it alone, and the pass
  // of the allotment (man) gives it hands by its fit among the tasks already there and within the members' hours left (plan.day.free); a
  // task with a deadline today goes first in its hand's list and calls it; the hand it is now the first task of is called from lesser
  // work, as by the allotment. False where the day cannot take it as it stands (no day yet, or made before the fits were kept, or a
  // member it does not know or left out then and allotted now: nothing changed), or where the task found no hand in the hours left (the
  // lists changed, nobody called; a meal or the milking would wait at the end of every list): its caller has the day allotted anew,
  // which weighs every member's hours afresh.
  function slotIn(st, hh, j, c) {
    const plan = planOf(st, 'household', hh.id),
      day = plan && plan.day;
    if (!day || !day.fits || !day.hours || !day.free || hh.farmstead === null) return false;
    const members = [];
    for (const id of hh.members) {
      const p = st.pawns[id];
      if (p.died !== null) continue;
      const list = day.lists[id],
        fit = day.fits[id],
        hrs = day.hours[id];
      if (!list || !fit || !hrs || fit.length !== list.length || hrs.length !== list.length) return false;
      // one the head called off (call) is given nothing until the day is next allotted
      if (allotted(st, p) && !(day.off && day.off.includes(id))) {
        if (!(id in day.free)) return false;
        members.push(p);
      }
    }
    // the task's key out of the lists, its hours back to the member, where a task of that key stood before (an earlier one gone)
    for (const id of Object.keys(day.lists)) {
      const i = day.lists[id].indexOf(j.key),
        h = i >= 0 ? leave(day, id, i) : 0;
      if (h > 0 && id in day.free) day.free[id] += h;
    }
    const memo = new Map(),
      stand = standIn(hh, members),
      pairs = [];
    VB.count.dayPair += members.length;
    weigh(st, hh, members, j, c, memo, stand, pairs);
    pairs.sort((x, y) => y[0] - x[0] || x[1] - y[1]);
    // a member's hours for the task: those left, and those of its tasks given hands at a lesser fit, which it would give up for it as
    // the allotment would have (the hours of the lesser ones taken, the least first, below)
    const fitOf = new Map(pairs.map(([s, id]) => [id, s])),
      lesser = (id, s) => {
        let h = 0;
        for (let i = 0; i < day.fits[id].length; i++)
          if (day.fits[id][i] > 0 && day.fits[id][i] < s) h += day.hours[id][i];
        return h;
      };
    const ctx = {
      lists: day.lists,
      fits: day.fits,
      hours: day.hours,
      est: new Map(),
      cap: new Map(members.map((p) => [p.id, day.free[p.id] + (fitOf.has(p.id) ? lesser(p.id, fitOf.get(p.id)) : 0)])),
      manned: new Map(),
      given: new Map(),
      due: new Map(),
      heads: new Map(),
    };
    // what the lists already hold at their heads: the fetches before, a task with a deadline today the member is the hand for
    for (const p of members) {
      const list = day.lists[p.id],
        fit = day.fits[p.id];
      let n = 0;
      for (let i = 0; i < list.length && fit[i] === null; i++) {
        const t = st.jobs.get(list[i]);
        if (t && KINDS[t.kind].late && !t.claims.length) ctx.due.set(p.id, t);
        else if (!ctx.due.has(p.id)) n++;
      }
      ctx.heads.set(p.id, n);
    }
    man(st, Estimate.headOf(st, hh), pairs, ctx);
    if (!ctx.manned.has(j) && pairs.length) return false;
    for (const p of members) {
      const at0 = day.lists[p.id].indexOf(j.key);
      if (at0 >= 0) {
        // the hours given, from those left first, then from its tasks given hands at a lesser fit, the least first; one left no hours
        // goes on among the rest
        let over = day.hours[p.id][at0] - day.free[p.id];
        day.free[p.id] = Math.max(0, -over);
        const s0 = day.fits[p.id][at0] ?? Infinity;
        for (let i = day.fits[p.id].length - 1; i >= 0 && over > 1e-9; i--) {
          const fi = day.fits[p.id][i];
          if (fi === null || fi <= 0 || fi >= s0 || i === at0) continue;
          const take = Math.min(day.hours[p.id][i], over);
          day.hours[p.id][i] -= take;
          over -= take;
          if (day.hours[p.id][i] <= 1e-9) {
            const key = day.lists[p.id][i];
            leave(day, p.id, i);
            further(day, p.id, key, fi);
          }
        }
      }
      const dj = ctx.due.get(p.id),
        fit = day.fits[p.id],
        at = fit.findIndex((x) => x !== null && x > 0);
      // the member called is one the task changed for: its hand when due today, or the one it now comes first for
      if (dj === j) call(st, hh, p, j, null, c, memo, stand);
      else if (at >= 0 && day.lists[p.id][at] === j.key && attentionOf(j) === 'full')
        call(st, hh, p, null, [fit[at], j], c, memo, stand);
    }
    return true;
  }
  // The households whose days hold the tasks of `owner` ({type, id}), into `ids`: a household's own, and for a village's tasks each of its
  // households'.
  function daysOf(st, owner, ids = new Set()) {
    if (!owner) return ids;
    if (owner.type === 'household') ids.add(owner.id);
    else if (owner.type === 'village' && st.villages[owner.id])
      for (const fid of st.villages[owner.id].farmsteads) {
        const hid = st.farmsteads[fid].household;
        if (hid !== null) ids.add(hid);
      }
    return ids;
  }
  // ---- the lists edited in place (VB-1758; design.md, Plans at four scales, Replanning: a task that arrives is slotted into the lists as
  // they stand, a lost holder's tasks go to the pool and are slotted to others; the whole day only at the morning, at 14:00 and when a
  // slot-in finds nobody) ----
  // Tasks `arrived` (posted at a review or by a member looking for work; sim/jobs), each slotted into the days of its holder's households
  // as they stand, in the order they came; a household whose day cannot take one (slotIn) has its day allotted anew, which weighs the rest
  // with it, as have the days of the holders `changed` (their keys: every household's at the morning and at 14:00, or one the due-queue's
  // slot found no hand for). A task gone again before its turn is passed over.
  // Then each household of `reviewed` (its review's, sim/jobs) has the tasks its review made more urgent slotted again (reweigh).
  function slotArrived(st, arrived, changed, c, reviewed = []) {
    const whole = new Set();
    for (const key of changed) {
      const [type, n] = key.split(':');
      daysOf(st, { type, id: Number(n) }, whole);
    }
    for (const j of arrived) {
      if (st.jobs.get(j.key) !== j) continue;
      for (const id of daysOf(st, j.owner)) {
        const hh = st.households[id];
        if (whole.has(id) || !hh || hh.dissolved) continue;
        if (!slotIn(st, hh, j, c)) whole.add(id);
      }
    }
    if (reviewed.length) {
      const came = new Set(arrived);
      for (const id of reviewed) {
        const hh = st.households[id];
        if (whole.has(id) || !hh || hh.dissolved) continue;
        if (!reweigh(st, hh, c, came)) whole.add(id);
      }
    }
    allotDays(st, whole, c);
  }
  // ---- the head's review re-weighs in place (VB-1854; design.md section 7, Plans at four scales, Replanning: the head's review rung) ----
  // Household hh reviewed: each of its own tasks in the day's lists that its stores or windows have made more urgent since it was given
  // its place (a store fallen below its target, a window closing) is slotted again (slotIn), as one arriving would be: its best fit now
  // against the best it was given at (a task in no list, at 0), risen by more than the switch test's margin
  // (MATCH.switchMargin; VB-107). A task at the head of a list (a fetch, a task due today) keeps its place; those `came` (slotted by this
  // review) are passed over. False where a slot found nobody: its caller has the day allotted whole.
  function reweigh(st, hh, c, came) {
    const plan = planOf(st, 'household', hh.id),
      day = plan && plan.day,
      mine = st.jobsBy.get(`household:${hh.id}`);
    if (!day || !day.fits || !mine || !mine.size || hh.farmstead === null) return true;
    const members = [];
    for (const id of hh.members) {
      const p = st.pawns[id];
      if (p.died === null && allotted(st, p) && !(day.off && day.off.includes(id))) members.push(p);
    }
    if (!members.length) return true;
    // the best fit each task was given at, over the lists, and the member given it (the rest's are kept negative; a list's head, null,
    // keeps its place)
    const was = new Map();
    for (const p of members) {
      const list = day.lists[p.id],
        fit = day.fits[p.id];
      if (!list || !fit) continue;
      for (let i = 0; i < list.length; i++) {
        const f = fit[i] === null ? Infinity : Math.abs(fit[i]),
          w = was.get(list[i]);
        if (!w || f > w[0]) was.set(list[i], [f, p]);
      }
    }
    // a task's rise is read on the member it was best fit for, whose priority for it is the highest, so whose fit an urgency raises most:
    // one pair a task; a task in no list, on every member
    const memo = new Map(),
      stand = standIn(hh, members),
      rose = [];
    for (const j of mine) {
      const w = was.get(j.key),
        f0 = w ? w[0] : 0;
      if (f0 === Infinity || came.has(j) || (attentionOf(j) === 'full' && hoursLeft(st, j) <= 0)) continue;
      let best = 0;
      for (const p of w ? [w[1]] : members) {
        VB.count.dayPair++;
        if (!eligible(st, j, p)) continue;
        const s = score(st, p, j, c, memo, p.id === hh.holder ? stand : 0);
        if (s !== null && s > best) best = s;
      }
      if (best - f0 > MATCH.switchMargin) rose.push(j);
    }
    VB.count.dayRose += rose.length;
    for (const j of rose) if (st.jobs.get(j.key) === j && !slotIn(st, hh, j, c)) return false;
    return true;
  }
  // Task j taken down (sim/jobs): its entries leave the lists of its holder's days, the hours given to it back to their members.
  function slotOut(st, j) {
    for (const id of daysOf(st, j.owner)) {
      const plan = planOf(st, 'household', id),
        day = plan && plan.day;
      if (!day) continue;
      for (const m of Object.keys(day.lists)) {
        const i = day.lists[m].indexOf(j.key);
        if (i < 0) continue;
        if (!day.fits || !day.hours) {
          day.lists[m].splice(i, 1);
          continue;
        }
        const h = leave(day, m, i);
        if (h > 0 && day.free && m in day.free) day.free[m] += h;
      }
    }
  }
  // Pawn id is lost to its household's day (it died, fell ill, was lent, took its leave or went away): the tasks it was given hands for go
  // back to the pool at once, each slotted to the others as the lists stand (slotIn); its list is emptied and its hours taken out of the
  // day, so that one back in the day has it allotted anew (takeDay). Out of working hours its list is only emptied: the morning weighs all.
  function lostHolder(st, id, c = cal(st.t)) {
    const p = st.pawns[id],
      hh = !p || p.household == null ? null : st.households[p.household],
      plan = hh && !hh.dissolved && hh.farmstead !== null ? planOf(st, 'household', hh.id) : null,
      day = plan && plan.day,
      list = day && day.lists[id];
    if (!list || !list.length) return;
    const keys = [];
    for (let i = 0; i < list.length; i++)
      if (!day.fits || day.fits[id][i] === null || day.fits[id][i] > 0) keys.push(list[i]);
    day.lists[id] = [];
    if (day.fits) day.fits[id] = [];
    if (day.hours) day.hours[id] = [];
    if (day.free) delete day.free[id];
    if (c.hour < WORK[0] - 1 || c.hour >= WORK[1]) return;
    VB.count.dayLost += keys.length;
    for (const key of keys) {
      const j = st.jobs.get(key);
      if (j && !slotIn(st, hh, j, c)) return allot(st, hh, c);
    }
  }
  on('died', (st, d) => lostHolder(st, d.pawn));
  on('leftDay', (st, d) => lostHolder(st, d.pawn));
  // An illness keeps its pawn from work (sim/fit allotted): it lets its task go and goes home, where it keeps to bed (abed), and its
  // tasks go to the pool.
  on('fellIll', (st, d) => {
    const a = st.agents[d.pawn]; // none for a pawn made bare in a test
    if (a && a.job) issue(st, { actor: d.pawn, verb: 'goHome', args: { urgent: true }, source: 'planner' }); // cannot walk on: load put down (VB-1893)
    lostHolder(st, d.pawn);
  });
  // The idle pawns in bed (VB-1758; design.md section 7, Plans at four scales: an ill pawn cannot walk on): one ill is given no task, no look
  // at the household's opportunities and no pastime; out of doors it goes home, inside it rests the hour. The others, to be given work.
  function abed(st, idle) {
    const up = [];
    for (const a of idle) {
      if (st.pawns[a.id].ill === undefined) up.push(a);
      else if (a.inside || st.pawns[a.id].household === null)
        issue(st, { actor: a.id, verb: 'idle', args: { until: st.t + 1 }, source: 'planner' });
      else issue(st, { actor: a.id, verb: 'goHome', source: 'planner' });
    }
    return up;
  }
  // The days of households `ids` allotted whole, in the order of their ids.
  function allotDays(st, ids, c) {
    // the households short of hands the morning's allotment finds, [[household id, hours short]], asked once it is over
    const ask = c.hour === WORK[0] - 1 ? [] : null;
    for (const id of [...ids].sort((x, y) => x - y)) {
      const hh = st.households[id];
      if (hh && !hh.dissolved) allot(st, hh, c, ask);
    }
    // once every day is allotted, so that the heads asked answer by their own (VB-470)
    if (ask)
      for (const [id, short] of ask) if (!st.households[id].dissolved) Hands.askFor(st, st.households[id], short, c);
  }
  // The evening (VB-1547; design.md, The head calls): from the end of work to MATCH.day.evening, each hour, a household's task of a kind
  // that may be begun after work (`evening`, sim/kinds: the water) that stands open and unmanned calls one hand: the member free of a task
  // whom the head's day put it earliest for (the lower id on a tie; one whose list was made before the task was posted, after those), at
  // home or on its way there, not away, commanded, on a day owed, lent, at an occasion or on the road. A pass over each live household's
  // tasks, two hours a day.
  function eveningCall(st, c) {
    for (const id of st.liveHouseholds) {
      const plan = planOf(st, 'household', id),
        lists = plan && plan.day && plan.day.lists;
      if (!lists) continue;
      for (const j of st.jobsBy.get(`household:${id}`) || none) {
        VB.count.eveningAsk++;
        const ev = KINDS[j.kind].evening;
        if (!ev || (ev !== true && !ev(st, j)) || j.claims.length || !isOpen(st, j)) continue;
        let best = null,
          at = Infinity;
        for (const pid of st.households[id].members) {
          const p = st.pawns[pid],
            a = st.agents[pid],
            n = lists[pid] ? lists[pid].indexOf(j.key) : -1,
            i = n < 0 ? Number.MAX_SAFE_INTEGER : n;
          if (i >= at || p.died !== null || a.job || a.occasion !== null || travelling(a)) continue;
          if (plan.day.off && plan.day.off.includes(pid)) continue; // called off (call)
          if (allotted(st, p) && eligible(st, j, p)) [best, at] = [a, i];
        }
        if (best) issue(st, workCommand(best.id, j.key, 'planner'));
      }
    }
  }
  // Whether pawn a can take job j of its list now: there is room, it still may, and a task held at the side is in reach.
  const canTake = (st, a, j) => !matchBar(st, a, j);
  // Each idle pawn takes the first task of its list that it can (a task held at the side leaves it free for the next one, next step). A
  // household with no day yet, or a member its day does not know (it moved in, or was born, since) or left out, has its day allotted first. The
  // pawns that got work.
  function takeDay(st, idle, c) {
    const got = new Set();
    for (const a of idle) {
      const p = st.pawns[a.id],
        hh = p.household === null ? null : st.households[p.household],
        plan = hh && planOf(st, 'household', hh.id);
      if (!plan || hh.farmstead === null) continue;
      // a member the day left out when it was allotted (commanded, away, on duty or lent then) and free now has it allotted anew (VB-470:
      // the round of help no longer gave such a one a neighbour's work)
      // who is allotted is said once, in fit's allotted; it also leaves out a commanded pawn and one on leave, as the allotment does
      const list0 = plan.day && plan.day.lists[a.id],
        missed = !!list0 && !list0.length && !!plan.day.free && !(a.id in plan.day.free) && allotted(st, p);
      if (!list0 || missed) allot(st, hh, c);
      if (a.job || a.path) {
        got.add(a); // the allotment called it
        continue;
      }
      const list = plan.day.lists[a.id];
      if (!list || (plan.day.off && plan.day.off.includes(a.id))) continue;
      if (a.taking > st.tick) continue; // keeping hours of its levy for itself (breach)
      // a levied member takes the head's tasks of its list while its levy has room today; past it, and once no such task is left, its
      // hours are its own (VB-1762; design.md section 7, What own hours are for): it weighs giving one leg of the first task past the
      // levy that has room (sim/levies gives), and else goes to its own time. The head pair, not levied, work their own plan's list.
      const levied = list.length > 0 && age(st, p) >= CHILD.from && Levies.levied(st, hh, p),
        room = !levied || Levies.capacity(st, hh, p, c) > 1e-9,
        fits = plan.day.fits && plan.day.fits[a.id];
      let past = null;
      for (let i = 0; i < list.length; i++) {
        const key = list[i];
        VB.count.dayTake++;
        const j = st.jobs.get(key);
        if (!j || !canTake(st, a, j)) continue;
        if (levied && (!room || (fits && fits[i] !== null && fits[i] < 0))) {
          if (!past) past = j;
          continue;
        }
        // at the start of a levied leg the member may take its hours instead (sim/levies takes: J < -GIVE.hold)
        if (!unplanned(st, a.id) && takeWhy(st, a.id) === null && Levies.takes(st, hh, p, j)) {
          const left = Levies.capacity(st, hh, p, c),
            h = plan.day.hours && plan.day.hours[a.id][i] > 0 ? Math.min(left, plan.day.hours[a.id][i]) : left;
          if (issue(st, { actor: a.id, verb: 'breach', args: { hours: h }, source: 'pawn' }) === true) {
            got.add(a);
            break;
          }
        }
        if (issue(st, workCommand(a.id, key, 'planner')) === true) {
          got.add(a);
          break;
        }
      }
      if (
        !got.has(a) &&
        past &&
        Levies.gives(st, hh, p, past) &&
        issue(st, workCommand(a.id, past.key, 'pawn')) === true
      )
        got.add(a); // given: booked levied up to the levy left, the rest given (sim/levies)
    }
    return got;
  }
  // The idle pawns called for a day of work owed (sim/days, VB-462) or lent for the day (sim/hands, VB-470) bid on the tasks of the
  // household they work for, the best bid first; `busy` gains those who go. A lent pawn with nothing there it can take goes back to its
  // own day.
  function dutyRound(st, idle, busy, c) {
    const memo = new Map();
    for (const a of idle) {
      const owed = Days.on(st, a.id),
        cred = owed !== null ? owed : Hands.on(st, a.id);
      if (cred === null || busy.has(a)) continue;
      let best = null,
        top = 0;
      for (const j of st.jobsBy.get(`household:${cred}`) || none) {
        const s = bid(st, a, j, c, memo);
        if (s > top) [best, top] = [j, s];
      }
      if (best && issue(st, workCommand(a.id, best.key, 'planner')) === true) busy.add(a);
      else if (owed === null) Hands.release(st, a.id);
    }
    return busy;
  }
  // ---- the head's verbs on the day (VB-477; design.md section 7, The timetable; section 15, Parity of command) ----
  // The head of household c.target changes its day as it stands: the player as head (source 'player') or a head's own rule, under the same
  // check (sim/plans heads). The change stands until the day is next allotted (allot: the morning, 14:00, or when the household's tasks
  // change), and the day says so (plan.day.edited). Each refuses with its reason; none draws a random number.
  // Why household c.target's day cannot be changed, or null; `member` a living member with a list in it, when named.
  function dayWhy(st, c, member) {
    const why = heads(st, c);
    if (why) return why;
    const day = planOf(st, 'household', c.target).day;
    if (!day) return `household ${c.target} has no day allotted yet`;
    if (member === undefined) return null;
    if (
      !Number.isInteger(member) ||
      !st.households[c.target].members.includes(member) ||
      st.pawns[member].died !== null
    )
      return `pawn ${member} is not a living member of household ${c.target}`;
    return day.lists[member] ? null : `pawn ${member} has no list in the day`;
  }
  const edited = (st, day, c) => (day.edited = { t: st.t, by: Number.isInteger(c.actor) ? c.actor : null });
  const index = (n, len) => Number.isInteger(n) && n >= 0 && n < len;
  // dayOrder({member, from, to}): the entry at `from` of the member's list goes to `to`, its fit and hours with it: an op of the verb
  // `plan` on the household's plan (sim/plans), the verb dayOrder its facade (VB-1754). A pawn's own day's order (VB-1756): the op
  // dayOrder({from, to}) on its own plan (target {kind: 'pawn', id}) reorders its own list of its household's day, for any member with
  // one, head or not: `own` skips the head's check, the pawn its own member. It stands, as the head's change does, until the next allotment.
  function orderWhy(st, c, own) {
    const a = c.args || {},
      why = own ? ownDay(st, c.target) : dayWhy(st, c, a.member);
    if (why) return why;
    const member = own ? c.target : a.member,
      n = planOf(st, 'household', st.pawns[member].household).day.lists[member].length;
    return index(a.from, n) && index(a.to, n) ? null : `no place ${a.from} or ${a.to} in a list of ${n}`;
  }
  // Why pawn id cannot reorder its own list of its household's day, or null
  function ownDay(st, id) {
    const p = st.pawns[id],
      hh = p.household === null ? null : st.households[p.household];
    if (!hh || hh.dissolved || p.died !== null) return `pawn ${id} is a living member of no household`;
    const plan = planOf(st, 'household', hh.id),
      day = plan && plan.day;
    if (!day) return `household ${hh.id} has no day allotted yet`;
    return day.lists[id] ? null : `pawn ${id} has no list in the day`;
  }
  function reorder(st, c, own) {
    const member = own ? c.target : c.args.member,
      plan = planOf(st, 'household', own ? st.pawns[member].household : c.target),
      day = plan.day,
      { from, to } = c.args,
      key = day.lists[member][from],
      fit = day.fits ? day.fits[member][from] : null;
    const h = day.fits ? leave(day, member, from) : (day.lists[member].splice(from, 1), 0);
    if (day.fits) enter(day, member, to, key, fit, h);
    else day.lists[member].splice(to, 0, key);
    edited(st, day, c);
  }
  planOp('household', 'dayOrder', { check: (st, c) => orderWhy(st, c, false), run: (st, c) => reorder(st, c, false) });
  planOp('pawn', 'dayOrder', { check: (st, c) => orderWhy(st, c, true), run: (st, c) => reorder(st, c, true) });
  register('dayOrder', planFacade('dayOrder'));
  // assign({key, from, to}): task `key` leaves member from's list and is given to member to, after its tasks given hands (its own entry
  // of it among the rest, if any, gives way), with the hours the giver had of it; one at work on it now works on until it next looks
  // for work. Refused when `to`
  // may not take it (sim/eligibility).
  register('assign', {
    check: (st, c) => {
      const a = c.args || {},
        why = dayWhy(st, c, a.from) || dayWhy(st, c, a.to);
      if (why) return why;
      const plan = planOf(st, 'household', c.target),
        day = plan.day,
        j = st.jobs.get(a.key);
      if (a.from === a.to) return 'a task is given to another member';
      if (!day.lists[a.from].includes(a.key)) return `task ${a.key} is not in pawn ${a.from}'s list`;
      const k = day.lists[a.to].indexOf(a.key);
      if (k >= 0 && (!day.fits || day.fits[a.to][k] === null || day.fits[a.to][k] > 0))
        return `task ${a.key} is given to pawn ${a.to} already`;
      if (!j) return `there is no task ${a.key}`;
      if (age(st, st.pawns[a.to]) < CHILD.from || !eligible(st, j, st.pawns[a.to]))
        return `task ${a.key} is not pawn ${a.to}'s to take`;
      return demandWhy(st, c, a.to, assignPast(st, c));
    },
    run: (st, c) => {
      const past = c.args.demand === true ? assignPast(st, c) : 0;
      if (past > 1e-9) return demand(st, c, c.args.to, past);
      const plan = planOf(st, 'household', c.target),
        day = plan.day,
        { key, from, to } = c.args,
        i = day.lists[from].indexOf(key);
      if (!day.fits || !day.hours) {
        day.lists[from].splice(i, 1);
        if (!day.lists[to].includes(key)) day.lists[to].push(key);
      } else {
        // the taker's own entry of it among the rest gives way; the task goes after its tasks given hands, with the giver's fit and hours
        const fit = day.fits[from][i],
          h = leave(day, from, i),
          k = day.lists[to].indexOf(key);
        if (k >= 0) leave(day, to, k);
        const f = day.fits[to];
        let at = 0;
        while (at < f.length && (f[at] === null || f[at] > 0)) at++;
        enter(day, to, at, key, fit === null || fit > 0 ? fit : -fit, h);
        if (day.free) {
          if (from in day.free) day.free[from] += h;
          if (to in day.free) day.free[to] = Math.max(0, day.free[to] - h);
        }
      }
      edited(st, day, c);
    },
  });
  // The hours past member `to`'s levy left that assign c gives it: those the giver had of the task.
  function assignPast(st, c) {
    const day = planOf(st, 'household', c.target).day,
      { key, from, to } = c.args,
      i = day.lists[from].indexOf(key),
      h = day.hours && i >= 0 ? day.hours[from][i] : 0;
    return pastLevy(st, st.households[c.target], to, h, day);
  }
  // The hours past member id's levy left that a call to task j asks: the hours of its work left at the member's rate, to the day's end.
  // None for a task already on the member's list: the allotment gave it those hours, and a later call inside them is no breach (design.md,
  // The day's capacity; the call only puts it first).
  function callPast(st, c) {
    const hh = st.households[c.target],
      id = c.args.member,
      day = planOf(st, 'household', hh.id).day,
      j = st.jobs.get(c.args.key),
      r = rateOf(st, st.pawns[id]),
      hour = cal(st.t).hour,
      h = r > 0 ? Math.min(hoursLeft(st, j) / r, WORK[1] - Math.min(WORK[1], Math.max(WORK[0], hour))) : 0;
    if (day.lists && day.lists[id] && day.lists[id].includes(c.args.key)) return 0;
    return pastLevy(st, hh, id, h, day);
  }
  // call({member, key}) (VB-1779): the member is called to task `key` now, from work, from the road home or from idling, as the head's
  // call (design.md section 7, The head calls): a work command the head opened. Past its levy left a demand (above).
  // call({member}): the member is called off: its list is emptied and it is off (plan.day.off) until the day is next allotted, and it lets its
  // task go and walks home (the verb goHome: a load in hand is brought in first, or on an urgent call
  // (args.urgent) put down where it stands, VB-1893). The cost, its walk home and
  // the load it leaves, is the timetable's callCost (sim/timetable), named before the call. Refused for one on the road or away.
  register('call', {
    check: (st, c) => {
      const a = c.args || {},
        why = dayWhy(st, c, a.member);
      if (why) return why;
      const ag = st.agents[a.member];
      if (travelling(ag)) return `pawn ${a.member} is on the road`;
      if (ag.away !== undefined) return `pawn ${a.member} is away from home`;
      if (a.key === undefined) return null;
      const j = st.jobs.get(a.key);
      if (!j) return `there is no task ${a.key}`;
      if (!isOpen(st, j) || !eligible(st, j, st.pawns[a.member]))
        return `task ${a.key} is not pawn ${a.member}'s to take`;
      return demandWhy(st, c, a.member, callPast(st, c));
    },
    run: (st, c) => {
      if (c.args.key !== undefined) {
        const past = c.args.demand === true ? callPast(st, c) : 0;
        if (past > 1e-9) return demand(st, c, c.args.member, past);
        edited(st, planOf(st, 'household', c.target).day, c);
        return issue(st, workCommand(c.args.member, c.args.key, 'planner'));
      }
      const plan = planOf(st, 'household', c.target),
        day = plan.day,
        id = c.args.member;
      day.lists[id] = [];
      if (day.fits) day.fits[id] = [];
      if (day.hours) day.hours[id] = [];
      // off for the rest of the day: no task slotted in, none taken, none in the evening, its hours not lent (free 0)
      if (day.free && id in day.free) day.free[id] = 0;
      day.off = (day.off || []).filter((x) => x !== id).concat(id);
      edited(st, day, c);
      const ag = st.agents[id];
      if (ag.job || !ag.inside)
        issue(st, { actor: id, verb: 'goHome', args: c.args.urgent ? { urgent: true } : undefined, source: c.source });
    },
  });
  // ---- the member's take (VB-1779; design.md section 7, The levy and own hours: Demand and take, The member's judgement) ----
  // Why pawn id cannot take hours of its levy now, or null: a living levied member (not the head pair) of a household with a head, at
  // home, in the working day, with levy left today and not taking already.
  function takeWhy(st, id) {
    const p = st.pawns[id],
      hh = p && p.died === null && p.household !== null ? st.households[p.household] : null;
    if (!hh || hh.dissolved || hh.holder === null || hh.holder === id) return `pawn ${id} owes no household hours`;
    if (age(st, p) < CHILD.from || !Levies.levied(st, hh, p)) return `pawn ${id} owes no household hours`;
    const a = st.agents[id],
      c = cal(st.t);
    if (a.taking > st.tick) return `pawn ${id} is keeping its hours already`;
    if (travelling(a) || a.away !== undefined) return `pawn ${id} is not at home`;
    if (c.hour < WORK[0] || c.hour >= WORK[1]) return 'hours of the levy are taken in the working day';
    return Levies.capacity(st, hh, p, c) > 1e-9 ? null : `pawn ${id} has no levy left today`;
  }
  // breach({hours}): the member keeps hours of its levy for itself (the levied's breach, 3.6), up to its levy left today (all of it when
  // none are named): it lets its task go and spends them as its own time (sim/pastimes), and until they end (agent.taking) it takes no
  // task of its list and the head calls it to none; the hours are booked taken (sim/levies), and the goodwill it then owes its head
  // with them. The work is not done: its list waits for the next allotment.
  // @state agent.taking (VB-1779): absent, or the tick to which the pawn keeps hours of its levy (the verb breach). Written only here;
  //   cleared by sim/levies when its hours are booked past it.
  // With args {levy, day, K}: the levied head's breach of an outer levy's day named (sim/levies breach, VB-1769).
  register('breach', {
    check: (st, c) => {
      if (c.args && c.args.levy !== undefined) return Levies.breachWhy(st, c.actor, c.args);
      const why = takeWhy(st, c.actor);
      if (why) return why;
      const h = c.args && c.args.hours;
      return h === undefined || (Number.isFinite(h) && h > 0) ? null : `cannot take ${h} hours`;
    },
    run: (st, c) => {
      if (c.args && c.args.levy !== undefined) return Levies.breach(st, c.actor, c.args);
      const p = st.pawns[c.actor],
        hh = st.households[p.household],
        left = Levies.capacity(st, hh, p, cal(st.t)),
        h = Math.min(left, c.args && c.args.hours !== undefined ? c.args.hours : left),
        a = st.agents[c.actor];
      VB.count.breachTaken++;
      a.taking = st.tick + Math.max(1, Math.round(h * TICKS));
      if (a.job) release(st, a);
      if (!unplanned(st, c.actor) && unbound(a)) Pastimes.ownTime(st, a);
    },
  });
  return {
    allot,
    weighDay,
    vitalFirst,
    takeWhy,
    slotIn,
    slotArrived,
    slotOut,
    lostHolder,
    takeDay,
    abed,
    dutyRound,
    eveningCall,
    dayHours,
    hoursLeft,
  };
})();
