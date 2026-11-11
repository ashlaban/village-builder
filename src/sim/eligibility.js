// @sys sim/eligibility: who may take a task, and on what basis (design.md section 7; VB-250): one table of bases, each a check, in a fixed order
VB['sim/eligibility'] = (() => {
  const { villageOf } = VB['sim/records'];
  // A basis is a check of (st, task, pawn); the first that holds is the answer, so later bases (helper VB-106, debtor, hired) are added
  // here, in their place in the order. A task is {owner: {type, id}}: a job, or the owner of a work opportunity not yet posted.
  const BASES = [
    ['servant', (st, t, p) => t.owner.type === 'household' && t.owner.id === p.household && p.servant],
    ['member', (st, t, p) => t.owner.type === 'household' && t.owner.id === p.household],
    ['villager', (st, t, p) => t.owner.type === 'village' && villageOf(st, p) === t.owner.id],
    ['self', (st, t) => t.owner.type !== 'household' && t.owner.type !== 'village'],
  ];
  // The basis on which the pawn may take the task, or null.
  function eligible(st, task, pawn) {
    for (let i = 0; i < BASES.length; i++) if (BASES[i][1](st, task, pawn)) return BASES[i][0];
    return null;
  }
  return { eligible, BASES };
})();
