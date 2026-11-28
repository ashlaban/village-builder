// @sys sim/eventkinds: the kinds of event of the record (VB-1946), one record a kind declared at load by the module that writes it, joined here
VB['sim/eventkinds'] = (() => {
  // How many years a kind stays on the record in full (Kim, 10 November 2026; QUESTION_ARCHIVE.md, "VB-199"): a kind with no `keep` is
  // notable and kept for good; the routine ones are folded by sim/records into one count per kind, village and year once that old.
  const KEEP = { short: 2, generation: 25 };
  // What a record says of its kind, each optional:
  //   keep      'short' or 'generation' (KEEP); none: kept for good
  //   group     the history's filter it is shown under (a key of CHRONICLE, sim/notable)
  //   personal  told by a pawn's own history in its own voice, never by the village log nor a farm's history (sim/notable)
  //   notice    why it is notable, for the page's toasts (a key of NOTABLE, sim/notable; the rule of that key decides for whom)
  //   skip      the rule by which it stops a skip for the played pawn (a key of STOPS, sim/skip)
  //   word      the page's word for many of them, in a toast that gathers a day's ("3 births in ...")
  const FIELDS = new Set(['keep', 'group', 'personal', 'notice', 'skip', 'word']);
  // kind -> its record, with `owner` (the module that declared it); no kind is declared twice.
  const EVENTS = {};
  function eventKinds(owner, table) {
    for (const [kind, rec] of Object.entries(table)) {
      if (Object.hasOwn(EVENTS, kind))
        throw new Error(`event kind ${kind} declared by ${EVENTS[kind].owner} and ${owner}`);
      for (const k of Object.keys(rec))
        if (!FIELDS.has(k)) throw new Error(`event kind ${kind} (${owner}): no field ${k}`);
      if (rec.keep !== undefined && !KEEP[rec.keep]) throw new Error(`event kind ${kind} (${owner}): keep ${rec.keep}`);
      EVENTS[kind] = { ...rec, owner };
    }
  }
  // The years kind stays on the record in full: 0 for good (and for a kind not declared, which tests/record.js forbids).
  const keepOf = (kind) => (Object.hasOwn(EVENTS, kind) && EVENTS[kind].keep ? KEEP[EVENTS[kind].keep] : 0);
  // The field `field` of kind's record, or undefined.
  const eventOf = (kind, field) => (Object.hasOwn(EVENTS, kind) ? EVENTS[kind][field] : undefined);
  return { KEEP, EVENTS, eventKinds, keepOf, eventOf };
})();
