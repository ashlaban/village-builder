// @sys sim/plandays: when a holder's plan is reviewed (design.md section 7, Planning days; VB-249): its planning day by its head's
// diligence, staggered over the days and the hours of work, and out of turn when a window closes on it, its fields are due, a village's
// work day comes or a store crosses a target; and the due-queue that opens the time-bound kinds for a household at their hours
VB['sim/plandays'] = (() => {
  const { WORK, DAY, TICKS } = VB['sim/rules'],
    { CROPS, ROTATIONS } = VB['sim/crops'];
  const { sowOpen, frostSeen, frostExpected } = VB['sim/weather'];
  const Traits = VB['sim/traits'];
  const { KINDS } = VB['sim/kinds'];
  const Workdays = VB['sim/workdays'];
  const Due = VB['sim/due'];
  const { heldFarms } = VB['sim/ownership'];
  // @state st.plans.due: [[hour, household id, index in WINDOWED]], sorted by hour, then id, then index: one entry per live household and
  //   time-bound kind, the hour its kind is next asked for the household (VB-249; Rules for cost, 4). Written only here.
  // The hours at which plans may be reviewed and the due-queue is asked: every hour from one before work starts to the end of work
  // (sim/clock calls refreshJobs then).
  const reviewHour = (h) => h >= WORK[0] - 1 && h <= WORK[1];
  // The first review hour after the hour of time t.
  function reviewAfter(t) {
    const day = Math.floor(t / DAY),
      h = Math.floor(t - day * DAY) + 1;
    if (h < WORK[0] - 1) return day * DAY + WORK[0] - 1;
    if (h > WORK[1]) return (day + 1) * DAY + WORK[0] - 1;
    return day * DAY + h;
  }
  // ---- planning days (design.md section 7, Planning days; VB-249) ----
  const FIRST = WORK[0] - 1,
    HOURS = WORK[1] - FIRST + 1; // the review hours, 5:00 to 18:00
  // Days between a holder's reviews: by its head's diligence, every third day (the lowest third), every second, or daily; a village's daily.
  function cadence(st, plan) {
    if (plan.holder.type !== 'household') return 1;
    const head = st.households[plan.holder.id].holder;
    if (head === null || head === undefined) return 1;
    const d = Traits.of(st, head, 'diligence');
    return d < 1 / 3 ? 3 : d < 2 / 3 ? 2 : 1;
  }
  // The holder's next planning hour after `hour`: its hour of the working day and its day in the cycle are offset by its id, so reviews
  // spread over the days and over the hours of work (rule 5); a village is offset from the household of the same id.
  function nextSlot(plan, cad, hour) {
    const id = plan.holder.id + (plan.holder.type === 'household' ? 0 : 7),
      h = FIRST + ((id * 5) % HOURS);
    let day = Math.floor(hour / DAY);
    if (day * DAY + h <= hour) day++;
    while ((day + id) % cad) day++;
    return day * DAY + h;
  }
  // Days on which a window is about to close, or has just closed, and every holder is reviewed at its first review hour: the last day of
  // sowing and the day after it (its hoeing and sowing taken down), the frost the head expects and the day before it (the harvest before
  // the frost: sim/weather frostExpected, VB-354, VB-1175) and the day the year's frost falls (frostSeen: seen, not foreseen, VB-1686), and the
  // first day of winter (the ice: fishing taken down, VB-117).
  const SOWN = Object.keys(CROPS).filter((k) => !CROPS[k].fallow && CROPS[k].sow);
  // Barley's window closes for every holder; another crop's (rye's in autumn, VB-999) only for a household whose farm sows it.
  const closes = (k, c) => {
    const W = CROPS[k].sow;
    return c.season === W[0] && (c.sday === W[2] || c.sday === W[2] + 1);
  };
  function closing(st, c, plan) {
    return (
      closes('barley', c) ||
      (c.season === 2 &&
        (c.sday === frostExpected(st) - 1 || c.sday === frostExpected(st) || c.sday === frostSeen(st))) ||
      (c.season === 3 && c.sday === 0) ||
      (!!plan && cropClosing(st, c, plan))
    );
  }
  function cropClosing(st, c, plan) {
    if (plan.holder.type !== 'household' || !SOWN.some((k) => closes(k, c))) return false;
    const hh = st.households[plan.holder.id],
      f = hh.farmstead === null ? null : st.farmsteads[hh.farmstead];
    return (
      !!f &&
      f.fields.some((fd) => ROTATIONS[fd.rotation || 'every'].courses.some((k) => SOWN.includes(k) && closes(k, c)))
    );
  }
  // A household whose field is ripe, or that has a field still to hoe or sow while the sowing window is open, at the first review hour:
  // its fields' window is closing on it (a crop that waits for a planning day meets the frost; VB-322). Walks its own fields and those of a
  // farm it holds in trust (VB-309).
  function fieldsDue(st, plan, c) {
    if (plan.holder.type !== 'household' || c.hour !== FIRST) return false;
    const hh = st.households[plan.holder.id],
      f = hh.farmstead === null ? null : st.farmsteads[hh.farmstead];
    if (!f || f.household !== hh.id) return false;
    const due = (g) =>
      g.fields.some((fd) => {
        const sow = sowOpen(st, fd.crop, c);
        const idle = fd.stage === 'plowed' || (fd.stage === 'stubble' && !(CROPS[fd.crop].fallow && fd.rest === 1)); // fallow: tilled once
        return fd.stage === 'ripe' || (sow && idle);
      });
    return due(f) || heldFarms(st, hh.id).some(due);
  }
  // A village whose meeting chose work days, at the first review hour of a work day: it calls its village out (VB-120).
  const workdayDue = (plan, c) =>
    plan.holder.type === 'village' && c.hour === FIRST && !!Workdays.dayOf(c) && plan.routines.includes('workdays');
  // Why the holder's plan is reviewed at this hour, or null: its planning day ('day'); a window closing today, its fields due today, or a
  // village's work day, once ('window'); a store that crossed a target, at most one such review a day ('store').
  function reviewWhy(st, plan, hour, c) {
    if (hour >= plan.nextReview) return 'day';
    if (plan.last !== c.day && (closing(st, c, plan) || fieldsDue(st, plan, c) || workdayDue(plan, c))) return 'window';
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
  // Its order (sim/due): by hour, then household id, then index (an index is below WINDOWED.length, so the two make one tie).
  const entryHour = (e) => e[0],
    entryTie = (e) => e[1] * WINDOWED.length + e[2];
  const insert = (q, e) => Due.insert(q, e, e[0], entryTie(e), entryHour, entryTie);
  // The first hour after `hour` at which the window of WINDOWED[k] opens.
  function opens(k, hour) {
    const from = KINDS[WINDOWED[k]].window.from;
    let day = Math.floor(hour / DAY);
    if (day * DAY + from <= hour) day++;
    return day * DAY + from;
  }
  // The entries due by this hour, taken off the queue (they are its first).
  function dueNow(st, hour) {
    return Due.take(st.plans.due, hour, entryHour);
  }
  // The entries asked at this hour, back on the queue: the next hour while the kind gave work (gave[i]) and the day's work goes on, else at
  // the window's next opening. An entry of a household whose plan is gone is dropped.
  function again(st, entries, gave, hour) {
    const q = st.plans.due,
      end = Math.floor(hour / DAY) * DAY + WORK[1];
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      if (!st.plans.households.has(e[1])) continue;
      e[0] = gave[i] && hour + 1 <= end ? hour + 1 : opens(e[2], hour);
      insert(q, e);
    }
  }
  // A household's entries, one per time-bound kind, at their next openings.
  function enqueue(st, id) {
    const hour = Math.floor(st.tick / TICKS);
    for (let k = 0; k < WINDOWED.length; k++) insert(st.plans.due, [opens(k, hour), id, k]);
  }
  // A dissolved household's entries leave the due-queue.
  function dequeue(st, id) {
    st.plans.due = st.plans.due.filter((e) => e[1] !== id);
  }
  return {
    reviewHour,
    reviewAfter,
    cadence,
    nextSlot,
    closing,
    reviewWhy,
    mayLook,
    WINDOWED,
    dueNow,
    again,
    enqueue,
    dequeue,
  };
})();
