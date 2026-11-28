// @sys sim/obligations [social]: every explicit claim of one party on another (VB-310; target-v2, 4.4): what is owed, by whom, to whom and by when,
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
  //   only here; absent until the first. A `days` one, an outer levy (VB-462, VB-1767; design.md, Outer levies), also has source ('debt',
  //   'keep', 'patron', 'routine', 'due'), terms ({names: 'levied' | 'levier' | 'together', notice (days), substitute, commute (rations a
  //   day, or null), carry, onBreach}: the draft's, sim/days TERMS by source), window ([first, last] game day the days asked may
  //   be named in, or null until its levier asks), asked (the days asked in the window, less the hours worked of them over OUTER.hours),
  //   named ([{day, pawn (an id, or null: picked on the day)}], by day: the days named and not yet come), worked (the days worked) and
  //   breaches ([{day, K (what the levied head reckoned keeping it would cost, rations), by (that head's id)}]: the breaches its levier's
  //   agent has still to let stand or forgive at its next planning day, VB-1769; emptied as it closes).
  //   A `loan` one (VB-312, sim/loans) also has lent (the grain lent, before what custom adds) and
  //   missed (its dues passed unpaid: overdue at the first, defaulted at the second).
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
    // the share of a harvest owed the owner of land its user works (VB-034, sim/heirland: half of an heir's fields' until its house
    // stands): owed as the sheaves come in, paid at the moving round from the grain above the user's reserve, as a share is
    rent: {
      every: YEAR,
      term: (t) => {
        const end = (Math.floor(t / YEAR) * YEAR_DAYS + AUTUMN * SEASON_DAYS + ASK.day + 1) * DAY;
        return end > t ? end : end + YEAR;
      },
    },
    // an outer levy (VB-462, VB-1767; sim/levies): owes {days}, a source of TERMS; it runs to its due (the year's end unless laid with
    // one). A debt's days then stand (overdue: VB-315 says what follows), and so do those whose terms carry; the rest lapse, told once.
    days: {
      every: null,
      term: (t) => (Math.floor(t / YEAR) + 1) * YEAR,
      // a day of a debt lent to another household (sim/levies transfer: terms.lent) is not a debt to it, and lapses unworked
      ended: (st, o) => ((o.source === 'debt' && !o.terms.lent) || o.terms.carry ? 'overdue' : 'lapsed'),
    },
  };
  // A kind contributed by the module whose rules carry it out (a loan: sim/loans, VB-312), before the first seed. Its row may also have
  // ended ((st, o) => what it becomes at its due, 'overdue' or 'lapsed', unless its kind's verbs meet it there), dues (how many times a
  // single-term obligation falls due: one still unpaid at a due before the last is overdue and due again at its next term, `missed`
  // counting them; at the last it is defaulted) and defaulted ((st, o): told as it is).
  // kind(name) alone reads its row, or null.
  function kind(name, row) {
    if (row === undefined) return KINDS[name] || null;
    if (KINDS[name]) throw new Error(`obligation kind ${name} is declared twice`);
    KINDS[name] = row;
  }
  const LIVE = ['open', 'part', 'overdue'];
  const isLive = (o) => LIVE.includes(o.status);
  // In the due-queue: a term running, or overdue with a due still to come (missed under its kind's dues)
  const running = (o) =>
    o.status === 'open' ||
    o.status === 'part' ||
    (o.status === 'overdue' && o.missed !== undefined && o.missed < (KINDS[o.kind].dues || 0));
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
    if (o.kind === 'days') {
      st.obligations[o.id].named = []; // its days named are over with it (Rules for cost, 9)
      st.obligations[o.id].breaches = [];
    }
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
    if (K.dues) o.missed = 0; // dues missed (a loan, VB-312)
    if (draft.lent !== undefined) o.lent = draft.lent; // a loan's grain lent, before what custom adds (VB-312)
    if (o.kind === 'days') {
      // an outer levy's terms, window and days named (sim/levies)
      o.terms = { ...draft.terms };
      o.window = draft.window ? [draft.window[0], draft.window[1]] : null;
      o.asked = o.window ? o.owes.days : 0;
      o.named = [];
      o.worked = 0;
      o.breaches = [];
      if (draft.why) o.why = { step: draft.why.step, of: draft.why.of }; // the step it serves (a routine's, VB-1768)
    }
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
  // way (animals led, hours worked) and are only booked. A levy's days count as worked only for the reason 'days worked' (a day
  // commuted is paid, not worked: VB-1769). One met leaves the caches: the caller tells the payment, which knows its words.
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
      if (o.kind === 'days') {
        if (why === 'days worked') o.worked += part; // hours worked, not a day commuted
        o.asked = Math.max(0, o.asked - part);
      }
      // Met within rounding (parts of hours or rations summed: 3.9999999999999996 of 4), and then booked as whole (VB-1175's run).
      if (left(o) <= 1e-9) {
        o.delivered = amount(o);
        close(st, o, 'met');
      } else if (o.status === 'open') o.status = 'part';
    }
    return null;
  }
  // An outer levy's working fields, written by sim/levies through this one door (VB-1767): any of {window, asked, named} (its days
  // asked in a window by its levier, named by whoever its terms say), breaches (those its levier's agent has still to answer).
  function setLevy(st, id, fields) {
    const o = st.obligations[id];
    if (fields.window !== undefined) o.window = fields.window && [fields.window[0], fields.window[1]];
    if (fields.asked !== undefined) o.asked = fields.asked;
    if (fields.named !== undefined) o.named = fields.named.map((e) => ({ day: e.day, pawn: e.pawn }));
    if (fields.breaches !== undefined) o.breaches = fields.breaches.map((b) => ({ day: b.day, K: b.K, by: b.by }));
  }
  // n of obligation o is struck (forgiven or lapsed in part, VB-1769: a day of a levy released or breached): what it owes is lowered by
  // n, and a levy's days asked with it. True where only a part went; false where n reaches what is left, for the whole to close.
  function strike(st, id, n) {
    const ob = st.obligations[id];
    if (n === null || n === undefined || n >= left(ob) - 1e-9) return false;
    if (ob.owes.rations !== undefined) ob.owes.rations -= n;
    else if (ob.owes.days !== undefined) ob.owes.days -= n;
    else ob.owes.hours -= n;
    if (ob.kind === 'days') ob.asked = Math.max(0, ob.asked - n);
    return true;
  }
  // The creditor's pawn `by` lets go of what is left of obligation id, or of n of it (VB-1769: a day of a levy released).
  function forgive(st, id, by, n = null) {
    const o = st.obligations[id];
    if (!o || !isLive(o)) return 'the obligation is closed';
    if (!(n === null || n > 0)) return 'nothing to forgive';
    if (strike(st, o.id, n)) {
      tell(
        st,
        o,
        `${n} ${unit(o)} of the ${o.kind} ${o.source ? `(${o.source}) ` : ''}were let go by ${fullName(st.pawns[by])}`,
      );
      return null;
    }
    n = left(o);
    close(st, o, 'forgiven');
    tell(st, o, `What was still owed of the ${o.kind} (${n} ${unit(o)}) was forgiven by ${fullName(st.pawns[by])}`);
    return null;
  }
  // What is left of obligation id, or n of it (VB-1769: a day of a levy breached), can no longer be paid or claimed (why: 'the one owed
  // has died'). A part is struck without a line of the record: its caller tells it.
  function lapse(st, id, why, n = null) {
    const o = st.obligations[id];
    if (!o || !isLive(o)) return 'the obligation is closed';
    if (!(n === null || n > 0)) return 'nothing to lapse';
    if (strike(st, o.id, n)) return null;
    n = left(o);
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
  // Household hh dissolves (sim/heirs extinct, once its people are placed): each obligation it is debtor or creditor of that still runs
  // passes to `to`, the household that takes on its estate (design, A dissolved debtor), or lapses with no one to pass to, or when it
  // would owe itself. Returns the number passed and lapsed.
  function dissolving(st, hh, to) {
    if (!st.obligationsBy) return { passed: 0, lapsed: 0 };
    const me = { kind: 'household', id: hh.id },
      out = { passed: 0, lapsed: 0 };
    for (const as of ['debtor', 'creditor']) {
      const other = as === 'debtor' ? 'creditor' : 'debtor';
      for (const id of [...(st.obligationsBy[as][keyOf(me)] || [])]) {
        const o = st.obligations[id];
        if (to === null || to === undefined || (o[other].kind === 'household' && o[other].id === to)) {
          lapse(
            st,
            id,
            as === 'debtor'
              ? 'its debtor household was dissolved, with none to take it on'
              : 'its creditor household was dissolved, with none to take it on',
          );
          out.lapsed++;
        } else {
          transfer(st, id, { [as]: { kind: 'household', id: to } });
          out.passed++;
        }
      }
    }
    return out;
  }
  VB.counter(
    'obligationsDue',
    'Obligations whose term ended at a step, taken off the due-queue (sim/obligations, VB-310)',
  );
  // Each step: the obligations whose term has ended, and only those (Rules for cost, 4). One of a kind with terms goes on to its next
  // term, as it stands; one with a single term is what its kind's `ended` makes it (overdue by default, waiting out of the queue for
  // who enforces it, VB-315; a loan is paid there, or overdue and due again, or defaulted: sim/loans).
  function step(st) {
    const q = st.obligationsDue;
    while (q.length && st.obligations[q[0]].due <= st.t) {
      const o = st.obligations[q[0]];
      VB.count.obligationsDue++;
      if (o.every) {
        q.shift();
        while (o.due <= st.t) o.due += o.every;
        enqueue(st, o);
      } else {
        const K = KINDS[o.kind],
          to = K.ended ? K.ended(st, o) : 'overdue'; // still queued as it ends: what it issues sees the caches whole (a loan's repay)
        dequeue(st, o);
        if (!isLive(o)) continue; // met, or lapsed, as it ended
        if (to === 'lapsed') {
          o.status = 'overdue';
          lapse(st, o.id, 'its year ended with the days not called');
        } else if (K.dues && ++o.missed >= K.dues) {
          if (K.defaulted) K.defaulted(st, o);
          close(st, o, 'defaulted');
        } else {
          o.status = to;
          if (K.dues) {
            o.due = K.term(o.due); // due again at its next term (a loan overdue)
            enqueue(st, o);
          }
        }
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
    // what it gives the page through the Sim facade (src/sim.js joins the lists, VB-1944)
    PAGE: ['shareOwed'],
    kind, // its KINDS, contributed to and read
    create,
    isLive,
    setLevy,
    due,
    owed,
    fulfil,
    forgive,
    lapse,
    transfer,
    dissolving,
    step,
    rebuilt,
    left,
    oweShare,
    shareOwed,
    openShares,
  };
})();
