// @sys sim/eligibility [agency]: who may take a task, and on what basis (design.md section 7; VB-250): one table of bases, each a check, in a fixed order
VB['sim/eligibility'] = (() => {
  const { villageOf } = VB['sim/records'];
  const HELP = VB['sim/roles'].MATCH.help;
  const Days = VB['sim/days'];
  const Hands = VB['sim/hands'];
  // A hand lent to another household today (sim/hands, VB-470) helps with its field work, of the kinds help takes: a gift, nothing owed.
  const helps = (st, t, p) =>
    t.owner.type === 'household' && HELP.kinds.includes(t.kind) && Hands.on(st, p.id) === t.owner.id;
  // A basis is a check of (st, task, pawn); the first that holds is the answer, so later bases (debtor, hired) are added
  // here, in their place in the order. A task is {owner: {type, id}}: a job, or the owner of a work opportunity not yet posted.
  const BASES = [
    // a pawn called for a day of work owed (sim/days) takes the tasks of the household that is owed, and no other, for its hours (VB-462)
    // (a routine's day, VB-1768: the village's tasks)
    ['owed', (st, t, p) => Days.on(st, p.id) === t.owner.id && Days.kindOn(st, p.id) === t.owner.type],
    ['servant', (st, t, p) => t.owner.type === 'household' && t.owner.id === p.household && p.servant],
    ['member', (st, t, p) => t.owner.type === 'household' && t.owner.id === p.household],
    ['villager', (st, t, p) => t.owner.type === 'village' && villageOf(st, p) === t.owner.id],
    ['helper', helps], // (a hired hand, VB-319, is lent the same way: its basis is `hired`, its wage paid at the day's end)
    ['self', (st, t) => t.owner.type !== 'household' && t.owner.type !== 'village'],
  ];
  // The basis on which the pawn may take the task, or null.
  function eligible(st, task, pawn) {
    if (Days.on(st, pawn.id) !== null) return BASES[0][1](st, task, pawn) ? 'owed' : null; // on duty: this basis only
    if (Hands.on(st, pawn.id) !== null)
      return helps(st, task, pawn) ? (Hands.hired(st, pawn.id) ? 'hired' : 'helper') : null; // lent: this basis only
    for (let i = 1; i < BASES.length; i++) if (BASES[i][1](st, task, pawn)) return BASES[i][0];
    return null;
  }
  return { eligible, BASES };
})();
