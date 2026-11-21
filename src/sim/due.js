// @sys sim/due: the due-queue (Rules for cost, 4) as a pure helper over a list its owner keeps sorted by a due key: where an entry stands,
// its insert, its removal, and the taking of the entries due by a time (VB-1406). No state of its own, no domain, no randomness.
VB['sim/due'] = (() => {
  // A queue is a plain array its owner holds in state. Its order is given by `key(entry, ctx)`, the entry's due time, and for a queue
  // ordered by due then id by `tie(entry, ctx)`, a number no two entries share; the queue in the order of due alone puts a new entry after
  // those due at the same time. The key functions are the owner's, made once at its load, and ctx (st, mostly) is handed to them, so that
  // a call makes no closure and no array: the step's queues (st.workDue, st.legDue) go through here at every step.

  // Where an entry due at `due` with tie `id` stands in q, ordered by due then tie: the first entry not before it.
  function at(q, due, id, key, tie, ctx) {
    let lo = 0,
      hi = q.length;
    while (lo < hi) {
      const m = (lo + hi) >> 1,
        d = key(q[m], ctx);
      if (d < due || (d === due && tie(q[m], ctx) < id)) lo = m + 1;
      else hi = m;
    }
    return lo;
  }
  // Where an entry due at `due` goes in q, ordered by due alone: after those due by then.
  function after(q, due, key, ctx) {
    let lo = 0,
      hi = q.length;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (key(q[m], ctx) > due) hi = m;
      else lo = m + 1;
    }
    return lo;
  }
  // Entry e, due at `due` with tie `id`, into q ordered by due then tie.
  function insert(q, e, due, id, key, tie, ctx) {
    q.splice(at(q, due, id, key, tie, ctx), 0, e);
  }
  // Entry e, due at `due`, into q ordered by due alone, after those due at the same time.
  function append(q, e, due, key, ctx) {
    q.splice(after(q, due, key, ctx), 0, e);
  }
  // Entry e, due at `due` with tie `id`, out of q ordered by due then tie: true if it stood there.
  function remove(q, e, due, id, key, tie, ctx) {
    const i = at(q, due, id, key, tie, ctx);
    if (q[i] !== e) return false;
    q.splice(i, 1);
    return true;
  }
  // How many of q's first entries are due by time t.
  function count(q, t, key, ctx) {
    let n = 0;
    while (n < q.length && key(q[n], ctx) <= t) n++;
    return n;
  }
  // The entries due by time t, taken off the head of q (a new array; an empty one when none is due).
  function take(q, t, key, ctx) {
    const n = count(q, t, key, ctx);
    return n ? q.splice(0, n) : [];
  }
  return { at, after, insert, append, remove, count, take };
})();
