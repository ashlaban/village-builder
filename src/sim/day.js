// @sys sim/day: the day's work (VB-466; design.md section 7, The day's work): the head allots its household's tasks to its members by
// their fit (sim/fit), each takes the first of its list it can, the head calls for what is urgent, due today or left for the evening; one
// on a day owed or lent (sim/days, sim/hands) takes of the tasks of the household it works for; the hours of help a head lacks, asked at
// the morning's allotment (sim/hands, VB-470). Owns plan.day
VB['sim/day'] = (() => {
  const { WORK, TICKS } = VB['sim/rules'],
    { CHILD, MATCH, absentMask } = VB['sim/roles'];
  const { age } = VB['sim/records'];
  const { travelling } = VB['sim/pose'],
    { rateOf, attentionOf, doneOf } = VB['sim/work'];
  const { issue } = VB['sim/commands'];
  const { eligible } = VB['sim/eligibility'];
  const { KINDS, isOpen } = VB['sim/kinds'];
  const Days = VB['sim/days'];
  const Hands = VB['sim/hands'];
  const { planOf } = VB['sim/plans'];
  const Estimate = VB['sim/estimate'];
  const { score, bid, matchBar, joined, allotted, workCommand, jobsFor } = VB['sim/fit'];
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
  //   an empty list; free: {pawn id: hours}: the working hours of the horizon the head gave each member no task in (VB-470: what it may
  //   lend). Written only by allot, whole, each time; a key whose job is gone is passed over. Plain data, saved with the plan.
  // A member's working hours of the horizon, by the clock; what it does in them at a task is the head's belief of its rate there (VB-476).
  const dayHours = () => MATCH.day.horizon * (WORK[1] - WORK[0]);
  const hoursLeft = (st, j) => (j.hours ?? KINDS[j.kind].hours ?? 0) - doneOf(st, j);
  // The head allots the household's day. Every member is weighed for every task of the household and of its village that it may take, by
  // its fit (score); best fit first, a further hand on a task counting for less (join), a task is given hands until they cover its work
  // left as the head estimates it (sim/estimate, VB-476: the causes its judgement reckons with, leaned by its lean), each member up to its
  // working hours of the horizon at the rate the head believes it works that task at; then each member's list goes on with the other
  // tasks it may take, by its fit, so that no one stands idle while there is work (design.md section 7, Work beats idling). No random
  // draw. Then the head calls: a member at work leaves its task for the first of its list when that is much more urgent (switchRatio,
  // switchMargin; VB-107), a task with a deadline today (`late`: the meal)
  // calls its hand from work, from the road or from idling. The others take their tasks when they next look for work (takeDay).
  // `asking`, in the morning's allotment (allotChanged): the list that gains [household id, hours short] when the household is short of hands.
  function allot(st, hh, c, asking = null) {
    const plan = planOf(st, 'household', hh.id);
    if (!plan || hh.farmstead === null) return;
    const lists = {},
      members = [];
    for (const id of hh.members) {
      const p = st.pawns[id];
      if (p.died !== null) continue;
      lists[id] = [];
      // the head allots around those it does not have today (allotted)
      if (allotted(st, p)) members.push(p);
    }
    const pairs = [],
      memo = new Map(),
      // the roles the household lacks today, whose ranks its holder takes (VB-1545): one pass over the members allotted
      stand = hh.holder !== null && members.some((p) => p.id === hh.holder) ? absentMask(hh.holder, members) : 0;
    if (members.length) {
      const jobs = jobsFor(st, members[0]);
      VB.count.dayPair += (jobs.length ?? jobs.size) * members.length;
      for (const j of jobs) {
        if (attentionOf(j) === 'full' && hoursLeft(st, j) <= 0) continue; // only its load is on the road
        for (const p of members) {
          if (!eligible(st, j, p)) continue;
          const s = score(st, p, j, c, memo, p.id === hh.holder ? stand : 0);
          if (s !== null && s > 0) pairs.push([s, p.id, j]);
        }
      }
    }
    pairs.sort((x, y) => y[0] - x[0] || x[2].id - y[2].id || x[1] - y[1]);
    const H = Estimate.headOf(st, hh),
      est = new Map(), // job -> the work left as the head sees it, once an allotment
      cap = new Map(members.map((p) => [p.id, dayHours()])),
      manned = new Map(), // job -> [hours of work given, hands]
      given = new Map(), // pawn -> its first task of the first pass, with its fit
      due = new Map(), // pawn -> the task with a deadline today it is the hand for
      heads = new Set(), // the pawns whose list a task that comes first heads (`first`: the water)
      spare = [];
    // best first; a pair whose task has gained hands since it was weighed falls by `join` for each (VB-102: the hands spread over the
    // tasks that can be worked at once) and waits its turn again
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
      // the hours of a trip beside its work (the water's walk) are hours of its hand's day too (VB-1551)
      cap.set(id, Math.max(0, cap.get(id) - h - (K.trip ? K.trip(st, j) : 0)));
      manned.set(j, [m[0] + h * r, m[1] + 1]);
      // water first (VB-1551): the fetch heads the list of the member best fit for it. A task with a deadline today that waits
      // unmanned goes first in its hand's list too, after a fetch, whatever its fit, and calls it (below)
      if (K.first && !j.claims.length && !heads.has(id)) {
        heads.add(id);
        lists[id].unshift(j.key);
      } else if (K.late && !j.claims.length && !due.has(id)) {
        due.set(id, j);
        lists[id].splice(heads.has(id) ? 1 : 0, 0, j.key);
      } else lists[id].push(j.key);
      if (full && !given.has(id)) given.set(id, [s, j]);
    }
    for (const [, id, j] of spare) lists[id].push(j.key);
    const free = {};
    for (const p of members) free[p.id] = cap.get(p.id);
    plan.day = { made: Math.floor(st.tick / TICKS), lists, free };
    // the morning's allotment: the hours of help the head's estimate says the household lacks to finish its field work in its windows
    if (asking && est.size) {
      const tasks = [];
      for (const [j, left] of est) tasks.push([j, left, (manned.get(j) || [0])[0]]);
      const short = Hands.shortOf(st, tasks, c);
      if (short > 0) asking.push([hh.id, short]);
    }
    for (const p of members) {
      const a = st.agents[p.id],
        dj = due.get(p.id),
        top = given.get(p.id),
        busy = !!a.job && attentionOf(a.job) === 'full';
      if (dj && a.job !== dj && isOpen(st, dj) && c.hour <= WORK[1]) {
        // the deadline calls: from work, from the road to it, or from idling (waiting, or out for company; not at an occasion)
        if (busy ? a.phase === 'work' || a.phase === 'go' : !a.job && a.phase === null && a.occasion === null)
          issue(st, workCommand(a.id, dj.key, 'planner'));
        continue;
      }
      if (!top || !busy || a.phase !== 'work' || a.job === top[1] || !isOpen(st, top[1])) continue;
      if (
        hoursLeft(st, a.job) > rateOf(st, p) &&
        top[0] >
          MATCH.switchRatio * (score(st, p, a.job, c, memo, p.id === hh.holder ? stand : 0) ?? 0) + MATCH.switchMargin
      )
        issue(st, workCommand(a.id, top[1].key, 'planner'));
    }
  }
  // The days of the holders `changed` (their keys, as sim/jobs noted them in a review or a look), in the order of their ids: a household's
  // own, and for a village's tasks each of its households'.
  function allotChanged(st, changed, c) {
    const ids = new Set();
    for (const key of changed) {
      const [type, n] = key.split(':'),
        id = Number(n);
      if (type === 'household') ids.add(id);
      else if (type === 'village' && st.villages[id])
        for (const fid of st.villages[id].farmsteads) {
          const hid = st.farmsteads[fid].household;
          if (hid !== null) ids.add(hid);
        }
    }
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
        if (!KINDS[j.kind].evening || j.claims.length || !isOpen(st, j)) continue;
        let best = null,
          at = Infinity;
        for (const pid of st.households[id].members) {
          const p = st.pawns[pid],
            a = st.agents[pid],
            n = lists[pid] ? lists[pid].indexOf(j.key) : -1,
            i = n < 0 ? Number.MAX_SAFE_INTEGER : n;
          if (i >= at || p.died !== null || a.job || a.occasion !== null || travelling(a)) continue;
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
      const list0 = plan.day && plan.day.lists[a.id],
        missed =
          !!list0 &&
          !list0.length &&
          !!plan.day.free &&
          !(a.id in plan.day.free) &&
          age(st, p) >= CHILD.from &&
          a.away === undefined &&
          Days.on(st, a.id) === null &&
          Hands.on(st, a.id) === null;
      if (!list0 || missed) allot(st, hh, c);
      if (a.job || a.path) {
        got.add(a); // the allotment called it
        continue;
      }
      const list = plan.day.lists[a.id];
      if (!list) continue;
      for (const key of list) {
        VB.count.dayTake++;
        const j = st.jobs.get(key);
        if (!j || !canTake(st, a, j)) continue;
        if (issue(st, workCommand(a.id, key, 'planner')) === true) {
          got.add(a);
          break;
        }
      }
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
  return { allot, allotChanged, takeDay, dutyRound, eveningCall, dayHours, hoursLeft };
})();
