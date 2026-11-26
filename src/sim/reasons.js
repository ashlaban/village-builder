// @sys sim/reasons: why a pawn does what it does (VB-1551; design.md section 7, Reasons shown): who chose its present act (the head's day
// and its place in the member's list, the head's call, a day lent or owed, the village's work, the player's order, its own choosing, or
// none) and one line of why, from the day's lists, the task's basis and what its kind declares; what presses is the head's estimate.
// A view computed when a card asks: it writes nothing, draws nothing, and no simulation module reads it (tests/reasons.js)
VB['sim/reasons'] = (() => {
  const { targetOf } = VB['sim/steps'];
  const { SEASON_DAYS, WORK, cal } = VB['sim/rules'],
    { ROLES, CHILD } = VB['sim/roles'],
    { CROPS } = VB['sim/crops'],
    { frostExpected } = VB['sim/weather'],
    { shiftOf } = VB['sim/climate'];
  const { carriesTo } = VB['sim/doing'];
  const { KINDS } = VB['sim/kinds'],
    { MADE, target } = VB['sim/targets'],
    { fuelFree } = VB['sim/chores'];
  const { age, fullName, commanded, unplanned } = VB['sim/records'];
  const { travelling, stayOf } = VB['sim/pose'];
  const { chain } = VB['sim/steps'];
  const Days = VB['sim/days'],
    Hands = VB['sim/hands'],
    { idleLine } = VB['sim/fit'];
  // The view's wording: a field's window is said to close when it ends within `closing` days (the design's "within three days"); the
  // occasions the village holds, whose attending is the village's (the others, a call, an ale evening, a rite, are the pawn's own).
  const REASONS = Object.freeze({ closing: 3, village: Object.freeze(['meeting', 'gathering']) });
  const BY = Object.freeze(['day', 'call', 'duty', 'lent', 'owed', 'village', 'player', 'self', 'none']);
  const ORD = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];
  const NUM = ['none', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
  const ord = (i) => ORD[i] || `${i + 1}th`,
    num = (n) => NUM[n] || String(n),
    days = (n) => (n <= 0 ? 'today' : n === 1 ? 'within a day' : `within ${num(n)} days`);
  const planOf = (st, hid) => (hid === null || hid === undefined ? null : st.plans.households.get(hid) || null);
  // The days left in field task j's window as its head sees it, or null for a task with none: the sowing window of its field's crop for
  // ploughing and sowing (the calendar, known to all), the expected frost for reaping and carrying the sheaves.
  function windowLeft(st, j, c) {
    const now = c.season * SEASON_DAYS + c.sday,
      crop = j.field && CROPS[j.field.crop];
    let end = null;
    if ((j.kind === 'plow' || j.kind === 'sow') && crop && crop.sow) end = crop.sow[0] * SEASON_DAYS + crop.sow[2];
    else if ((j.kind === 'reap' || j.kind === 'haul') && crop) end = 2 * SEASON_DAYS + frostExpected(st);
    return end === null || end < now ? null : end - now;
  }
  const WINDOW = { plow: 'to be ploughed', sow: 'to be sown', reap: 'to be reaped', haul: 'to be carried in' };
  // What presses at task j, in a few words, or null: a deadline today (`late`), a field window closing, a store under the head's target,
  // a kind that falls due each day (`window`). Read from the kind's record and the head's own figures.
  function cause(st, j, c) {
    const K = KINDS[j.kind];
    if (K.late) return 'to be done before the day is out';
    const left = windowLeft(st, j, c);
    if (left !== null && left <= REASONS.closing) {
      const what = j.kind === 'reap' || j.kind === 'haul' ? `the ${j.field.crop}` : `the field for ${j.field.crop}`;
      return `${what} is ${WINDOW[j.kind]} ${days(left)}${j.kind === 'reap' || j.kind === 'haul' ? ', before the frost' : ''}`;
    }
    const hh = j.owner && j.owner.type === 'household' ? st.households[j.owner.id] : null;
    if (hh && !hh.dissolved) {
      const plan = planOf(st, hh.id);
      // a kind that brings timber to its owner's store fills the woodpile (VB-1820: read from its method, not a field `to`)
      if (carriesTo(j.kind) === 'store' && (K.gives || []).includes('timber') && targetOf(plan, 'wood')) {
        const goal = targetOf(plan, 'wood').seasons[c.season],
          held = fuelFree(st, hh);
        if (held < goal) return `the woodpile holds ${Math.round(held)} of the ${Math.round(goal)} the head wants`;
      }
      for (const g of K.gives || []) {
        const M = MADE.get(g);
        if (!M) continue;
        const held = M.held(st, hh),
          want = target(st, hh, g);
        if (Number.isFinite(want) && held < want)
          return `${Math.round(held)} ${M.unit}${Math.round(held) === 1 ? '' : 's'} of ${g} held, the head wants ${Math.round(want)}`;
      }
    }
    if (K.window) return 'due every day';
    return null;
  }
  // The job pawn id has in hand: its task, else the one it holds at the side (with the herds).
  const actOf = (a) => a.job || (a.mind ? a.mind[0] : null);
  const farmName = (st, hid) => {
    const hh = st.households[hid];
    return hh && hh.farmstead !== null ? st.farmsteads[hh.farmstead].name : 'another farm';
  };
  // Who chose pawn id's present act and why: {by (one of BY), head (the head whose day or call it is), place ({at, of}: the task's place
  // in the member's list), why (what presses, in a few words; null on the head's day or the village's work when nothing does: who chose
  // and the place in the list are then the reason)}; null for a pawn not living. Writes nothing, draws nothing.
  function reasonOf(st, id) {
    const p = st.pawns[id],
      a = st.agents[id];
    if (!p || p.died !== null || !a) return null;
    const c = cal(st.t),
      plan = planOf(st, p.household),
      head = plan && plan.head ? plan.head.pawn : null,
      j = actOf(a);
    // a controller's order or switch is the player's only on the played pawn; any other pawn's is its own (VB-1745)
    const played = !!st.player && st.player.pawn === id;
    if (commanded(st, id))
      return played ? { by: 'player', why: 'you gave the order' } : { by: 'self', why: 'an order of its own' };
    if (j) {
      const K = KINDS[j.kind],
        why = cause(st, j, c),
        owner = j.owner || {};
      const owed = Days.on(st, id),
        lent = Hands.on(st, id);
      if (owner.type === 'household' && owner.id !== p.household) {
        const by = owed === owner.id ? 'owed' : lent === owner.id ? 'lent' : 'self';
        return { by, why: why || `at ${farmName(st, owner.id)}` };
      }
      const list = plan && plan.day && plan.day.lists[id],
        i = list ? list.indexOf(j.key) : -1,
        place = i >= 0 ? { at: i, of: list.length } : undefined;
      if (owner.type === 'village')
        return { by: 'village', ...(head !== null && place ? { head, place } : {}), why: why || null };
      if (!place) return { by: played && unplanned(st, id) ? 'player' : 'self', why: why || 'taken without the plan' };
      // a task with a deadline today put first in its hand's list is the head's call (sim/jobs allot)
      if (K.late && i === 0) return { by: 'call', head, place, why: why || 'due today' };
      return { by: 'day', head, place, why: why || planned(st, j) };
    }
    if (a.occasion !== null && a.occasion !== undefined) {
      const o = st.occasions.find((x) => x.id === a.occasion);
      return {
        by: o && REASONS.village.includes(o.kind) ? 'village' : 'self',
        why: o ? `the ${o.kind === 'ale' ? 'ale evening' : o.kind}` : 'an occasion',
      };
    }
    if (travelling(a)) {
      const s = stayOf(st, id);
      if (s && s.gift) return { by: 'call', head, why: 'sent to fetch grain' };
      if (s && s.why === 'visit') return { by: 'self', why: 'a visit of its own' };
      return { by: 'self', why: 'on the road home' };
    }
    if (unplanned(st, id))
      return played
        ? { by: 'player', why: 'you have turned its own plans off' }
        : { by: 'self', why: 'its own plans are off' };
    const owed = Days.on(st, id),
      lent = Hands.on(st, id);
    if (owed !== null) return { by: 'owed', why: `nothing to take at ${farmName(st, owed)} yet` };
    if (lent !== null) return { by: 'lent', why: `nothing to take at ${farmName(st, lent)} yet` };
    // at a pastime (sim/pastimes, VB-1552), the choice is its own: the line under it says why it has no work
    return { by: VB['sim/pastimes'].of(st, id) ? 'self' : 'none', why: noWork(st, id, p, a, c) };
  }
  // The plan's step behind task j, in a few words, when nothing presses (VB-1752; design.md, Reasons shown: the chain of steps): the
  // project it is a step of, or its season's routine; null for a task no step opened.
  function planned(st, j) {
    const C = chain(st, j),
      top = C.length ? C[C.length - 1] : null;
    if (!top) return null;
    if (top.what.project !== undefined)
      return `a step of the new ${top.why && top.why.custom ? top.why.custom : 'work'}`;
    if (top.what.target) return `in the season's plan, for its ${top.what.target.store}`;
    return top.what.routine ? "in the season's plan" : null;
  }
  // Why a pawn with no work has none: too young, the working day over, else the idle line (sim/jobs idleLine).
  function noWork(st, id, p, a, c) {
    if (age(st, p) < CHILD.from) return 'too young to work';
    if (c.hour < WORK[0] || c.hour >= WORK[1]) return 'the working day is over';
    if (!!a.homeward) return 'going home';
    const line = idleLine(st, id);
    if (line) return line;
    return p.household === null
      ? `no household gives ${ROLES[p.role].title.toLowerCase()} work`
      : 'it takes the next task it may at its next look';
  }
  // The reason as the card's one line, under what the pawn is doing: who chose, with the place in the list, then why. Null when none.
  function reasonLine(st, id) {
    const r = reasonOf(st, id);
    if (!r) return null;
    const name = (h, low) => (h === id ? (low ? 'its own' : 'Its own') : `${fullName(st.pawns[h])}'s`),
      at = !r.place ? '' : r.place.of === 1 ? ', its one task' : `, ${ord(r.place.at)} of ${num(r.place.of)}`;
    const who = {
      day: () => `${name(r.head)} day${at}`,
      call: () => (r.head === null || r.head === undefined ? "The head's call" : `${name(r.head)} call`),
      duty: () => 'A duty kept',
      lent: () => 'A day lent',
      owed: () => 'A day owed',
      village: () => `The village's work${r.head !== undefined ? ` in ${name(r.head, true)} day${at}` : ''}`,
      player: () => 'Your order',
      self: () => 'Its own choosing',
      none: () => null, // the idle line says it whole
    }[r.by]();
    if (!who) return r.why.charAt(0).toUpperCase() + r.why.slice(1);
    return r.why ? `${who}: ${r.why}` : who;
  }
  return { REASONS, BY, reasonOf, reasonLine, windowLeft, cause, planned };
})();
