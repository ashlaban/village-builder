// @sys sim/obligations: every explicit claim of one party on another (VB-310; target-v2, 4.4): what is owed, by whom, to whom and by when,
// with a due-queue; a kind (KINDS) says when its term ends. The first kind is the heirs' share still owed (design.md, Handover and shares)
VB['sim/obligations'] = (() => {
  const Due = VB['sim/due'];
  const { DAY, YEAR, YEAR_DAYS, SEASON_DAYS, ASK } = VB['sim/rules'];
  const { personEvent, log, fullName, atHousehold } = VB['sim/records'];
  const Stores = VB['sim/stores'];
  // @state st.obligations: every obligation ever made, by id, never reused: {id, kind (a key of KINDS), debtor, creditor (party refs:
  //   {kind: 'household' | 'village' | 'pawn', id}), owes ({rations: n} or {hours: n}), due (the hour its term ends), every (hours from one
  //   term to the next, or null: a single term), enforcer (a party ref, or null: social only), status ('open', 'part', 'overdue' while it
  //   lives; 'met', 'forgiven', 'lapsed', 'defaulted' once closed), delivered (of what it owes), since (the hour it was made)}; written
  //   only here; absent until the first. A `days` one (VB-462) also has source ('debt', 'keep', 'patron') and called (the days called, not
  //   yet over: written by sim/days).
  // @state st.obligationsDue: the ids of the obligations whose term runs (status open or part), sorted by due, then id: the due-queue
  //   (Rules for cost, 4). A cache owned here.
  // @state st.obligationsBy: {debtor, creditor}, each a party's key ('household:3') to the sorted ids of its live obligations (open,
  //   part or overdue); a party with none has no key (Rules for cost, 1). A cache owned here, read through `due`.
  const AUTUMN = 2; // the season of the moving round (sim/clock)
  // A kind: every (its terms' length, null for one term), term(t) (the hour the term running at t ends).
  const KINDS = {
    // a sibling's share still owed is paid at each moving round (sim/cottage payOwed): its term ends with the round's first day
    share: {
      every: YEAR,
      term: (t) => {
        const end = (Math.floor(t / YEAR) * YEAR_DAYS + AUTUMN * SEASON_DAYS + ASK.day + 1) * DAY;
        return end > t ? end : end + YEAR;
      },
    },
    // a servant's wage for a year served (VB-637, sim/service): owed at the moving round that ends the year and paid there, as a share
    // is; what is not paid stays owed to the next round
    wage: {
      every: YEAR,
      term: (t) => {
        const end = (Math.floor(t / YEAR) * YEAR_DAYS + AUTUMN * SEASON_DAYS + ASK.day + 1) * DAY;
        return end > t ? end : end + YEAR;
      },
    },
    // days of work owed (VB-462, sim/days): owes {days}, source 'debt' | 'keep' | 'patron'; it runs to the year's end. A debt's days then
    // stand (overdue: VB-315 says what follows); those of the keep and of a patron's due lapse, told once.
    days: {
      every: null,
      term: (t) => (Math.floor(t / YEAR) + 1) * YEAR,
      ended: (st, o) => (o.source === 'debt' ? 'overdue' : 'lapsed'),
    },
  };
  const LIVE = ['open', 'part', 'overdue'];
  const isLive = (o) => LIVE.includes(o.status);
  const running = (o) => o.status === 'open' || o.status === 'part';
  const keyOf = (party) => `${party.kind}:${party.id}`;
  const amount = (o) =>
    o.owes.rations !== undefined ? o.owes.rations : o.owes.days !== undefined ? o.owes.days : o.owes.hours;
  const left = (o) => amount(o) - o.delivered;
  const NONE = [];
  // ---- the caches: the due-queue and the parties' live obligations ----
  // st.obligationsDue's order (sim/due): by the obligation's due, then its id.
  const dueOf = (id, st) => st.obligations[id].due,
    idOf = (id) => id;
  function enqueue(st, o) {
    Due.insert(st.obligationsDue, o.id, o.due, o.id, dueOf, idOf, st);
  }
  function dequeue(st, o) {
    const at = st.obligationsDue.indexOf(o.id);
    if (at >= 0) st.obligationsDue.splice(at, 1);
  }
  function index(st, as, party, id) {
    const by = st.obligationsBy[as],
      k = keyOf(party),
      ids = by[k] || (by[k] = []);
    let at = ids.length;
    while (at > 0 && ids[at - 1] > id) at--;
    ids.splice(at, 0, id);
  }
  function unindex(st, as, party, id) {
    const by = st.obligationsBy[as],
      k = keyOf(party),
      ids = by[k];
    if (!ids) return;
    const at = ids.indexOf(id);
    if (at >= 0) ids.splice(at, 1);
    if (!ids.length) delete by[k];
  }
  // The caches as the records make them: {due, by}, to be compared with st.obligationsDue and st.obligationsBy (tests, the invariants).
  function rebuilt(st) {
    const all = st.obligations || NONE,
      by = { debtor: {}, creditor: {} };
    const due = all
      .filter(running)
      .sort((a, b) => a.due - b.due || a.id - b.id)
      .map((o) => o.id);
    for (const o of all) {
      if (!isLive(o)) continue;
      for (const as of ['debtor', 'creditor']) (by[as][keyOf(o[as])] || (by[as][keyOf(o[as])] = [])).push(o.id);
    }
    return { due, by };
  }
  // A closed obligation leaves the queue and both parties' lists; its record stays.
  function close(st, o, status) {
    st.obligations[o.id].status = status;
    dequeue(st, o);
    unindex(st, 'debtor', o.debtor, o.id);
    unindex(st, 'creditor', o.creditor, o.id);
  }
  // Told once in the record, at the pawn who is a party to it (the creditor first), at the household that is.
  function tell(st, o, text) {
    const pawn = o.creditor.kind === 'pawn' ? o.creditor.id : o.debtor.kind === 'pawn' ? o.debtor.id : null,
      body = [o.debtor, o.creditor].find((x) => x.kind === 'household'),
      place = body ? atHousehold(st, st.households[body.id]) : {};
    if (pawn !== null) personEvent(st, pawn, o.kind, text, { n: 0, ...place });
    else log(st, `${text}.`, { kind: o.kind, pawn: null, ...place });
  }
  const unit = (o) =>
    o.owes.rations !== undefined ? 'rations' : o.owes.days !== undefined ? 'days of work' : 'hours of work';
  // ---- the operations ----
  // A new obligation of draft {kind, debtor, creditor, owes, due?, every?, enforcer?}: its term is its kind's unless the draft names one.
  // Returns its id.
  function create(st, draft) {
    const K = KINDS[draft.kind];
    if (!st.obligations) {
      st.obligations = [];
      st.obligationsDue = [];
      st.obligationsBy = { debtor: {}, creditor: {} };
    }
    const o = {
      id: st.obligations.length,
      kind: draft.kind,
      debtor: { kind: draft.debtor.kind, id: draft.debtor.id },
      creditor: { kind: draft.creditor.kind, id: draft.creditor.id },
      owes: { ...draft.owes },
      due: draft.due !== undefined ? draft.due : K.term(st.t),
      every: draft.every !== undefined ? draft.every : K.every,
      enforcer: draft.enforcer ? { kind: draft.enforcer.kind, id: draft.enforcer.id } : null,
      status: 'open',
      delivered: 0,
      since: st.t,
    };
    if (draft.source) o.source = draft.source;
    if (o.owes.days !== undefined) o.called = 0; // days called and not yet over (sim/days)
    st.obligations.push(o);
    enqueue(st, o);
    index(st, 'debtor', o.debtor, o.id);
    index(st, 'creditor', o.creditor, o.id);
    return o.id;
  }
  // The live obligations party has as `as` ('creditor': what it is owed; 'debtor': what it owes), of one kind when given, oldest first.
  function due(st, party, as = 'creditor', kind = null) {
    const ids = st.obligationsBy ? st.obligationsBy[as][keyOf(party)] : null;
    if (!ids) return NONE;
    const out = ids.map((id) => st.obligations[id]);
    return kind === null ? out : out.filter((o) => o.kind === kind);
  }
  // What is left to deliver of the live obligations party has as `as`, of one kind when given.
  const owed = (st, party, as = 'creditor', kind = null) => due(st, party, as, kind).reduce((s, o) => s + left(o), 0);
  // n of what is owed is delivered against obligation id, or against several of one debtor and creditor (ids, the oldest first): part or
  // whole. `goods` ({from, to, good}): the n are moved by sim/stores, in one movement, for the reason `why`; without it they came another
  // way (animals led, hours worked) and are only booked. One met leaves the caches: the caller tells the payment, which knows its words.
  // Returns null, or why not.
  function fulfil(st, id, n, why, goods = null) {
    const list = (Array.isArray(id) ? id : [id]).map((k) => st.obligations[k]);
    if (!list.every((o) => o && isLive(o))) return 'the obligation is closed';
    if (!(n > 0) || n > list.reduce((s, o) => s + left(o), 0) + 1e-9) return 'more than is owed';
    if (goods) Stores.move(st, goods.from, goods.to, goods.good, n, why);
    for (const { id: k } of list) {
      const o = st.obligations[k];
      const part = Math.min(n, left(o));
      if (!(part > 0)) continue;
      n -= part;
      o.delivered += part;
      // Met within rounding (parts of hours or rations summed: 3.9999999999999996 of 4), and then booked as whole (VB-1175's run).
      if (left(o) <= 1e-9) {
        o.delivered = amount(o);
        close(st, o, 'met');
      } else if (o.status === 'open') o.status = 'part';
    }
    return null;
  }
  // n days of days-obligation id are called (+1) or over (-1): its `called` (sim/days).
  function setCalled(st, id, by) {
    const o = st.obligations[id];
    o.called = Math.max(0, o.called + by);
  }
  // The creditor's pawn `by` lets go of what is left of obligation id.
  function forgive(st, id, by) {
    const o = st.obligations[id];
    if (!o || !isLive(o)) return 'the obligation is closed';
    const n = left(o);
    close(st, o, 'forgiven');
    tell(st, o, `What was still owed of the ${o.kind} (${n} ${unit(o)}) was forgiven by ${fullName(st.pawns[by])}`);
    return null;
  }
  // What is left of obligation id can no longer be paid or claimed (why: 'the one owed has died').
  function lapse(st, id, why) {
    const o = st.obligations[id];
    if (!o || !isLive(o)) return 'the obligation is closed';
    const n = left(o);
    close(st, o, 'lapsed');
    tell(st, o, `What was still owed of the ${o.kind} (${n} ${unit(o)}) lapsed: ${why}`);
    return null;
  }
  // Obligation id passes to a successor: to = {debtor} or {creditor}, a party ref. A right, so it moves at once (AGENTS.md, the hard rule).
  function transfer(st, id, to) {
    const o = st.obligations[id];
    if (!o || !isLive(o)) return 'the obligation is closed';
    for (const as of ['debtor', 'creditor']) {
      if (!to[as]) continue;
      unindex(st, as, o[as], o.id);
      o[as] = { kind: to[as].kind, id: to[as].id };
      index(st, as, o[as], o.id);
    }
    return null;
  }
  // Each step: the obligations whose term has ended, and only those (Rules for cost, 4). One of a kind with terms goes on to its next
  // term, as it stands; one with a single term is overdue, and waits out of the queue for who enforces it (VB-315).
  function step(st) {
    const q = st.obligationsDue;
    while (q.length && st.obligations[q[0]].due <= st.t) {
      const o = st.obligations[q.shift()];
      VB.count.obligationsDue++;
      if (o.every) {
        while (o.due <= st.t) o.due += o.every;
        enqueue(st, o);
      } else {
        const to = KINDS[o.kind].ended ? KINDS[o.kind].ended(st, o) : 'overdue';
        if (to === 'lapsed') {
          o.status = 'overdue';
          lapse(st, o.id, 'its year ended with the days not called');
        } else o.status = to;
      }
    }
  }
  // ---- the heirs' shares (design.md, Handover and shares: Shares still owed) ----
  // Household hh owes pawn id n rations of its share. As pawn.owedFrom did, the farm that owes last owes all: what earlier farms still
  // owe the pawn passes to hh (VB-1155 gives each farm its own debt).
  function oweShare(st, hh, id, n) {
    // each share keeps its debtor: a sibling owed by two farms is paid by each (VB-1155)
    return create(st, {
      kind: 'share',
      debtor: { kind: 'household', id: hh.id },
      creditor: { kind: 'pawn', id },
      owes: { rations: n },
    });
  }
  // The rations of shares pawn id is still owed.
  const shareOwed = (st, id) => (st.obligationsBy ? owed(st, { kind: 'pawn', id }, 'creditor', 'share') : 0);
  // The open obligations of a kind owed to pawns (the siblings' shares, unless another kind is named: a servant's wages), grouped by the
  // pawn owed, in the order of the pawns' ids: [[pawn id, its obligations, the oldest first], ...].
  function openShares(st, kind = 'share') {
    const out = [];
    for (const k of Object.keys(st.obligationsBy ? st.obligationsBy.creditor : {})) {
      if (!k.startsWith('pawn:')) continue;
      const id = +k.slice(5),
        list = due(st, { kind: 'pawn', id }, 'creditor', kind);
      if (list.length) out.push([id, list]);
    }
    return out.sort((a, b) => a[0] - b[0]);
  }
  return {
    KINDS,
    create,
    isLive,
    setCalled,
    due,
    owed,
    fulfil,
    forgive,
    lapse,
    transfer,
    step,
    rebuilt,
    left,
    oweShare,
    shareOwed,
    openShares,
  };
})();
