// @sys sim/eligibility: who may take a task, and on what basis (design.md section 7; VB-250): one table of bases, each a check, in a fixed order
VB['sim/eligibility'] = (() => {
  const { villageOf, age } = VB['sim/records'];
  const HELP = VB['sim/rules'].MATCH.help;
  // An adult of the household's village helps with its job of a kind neighbours helped with, once it has waited (VB-106): a gift, nothing owed.
  const helps = (st, t, p) => {
    if (t.owner.type !== 'household' || t.owner.id === p.household || !HELP.kinds.includes(t.kind)) return false;
    if (st.t - t.posted < HELP.waitHours || age(st, p) < HELP.minAge) return false;
    const hh = st.households[t.owner.id];
    return !hh.dissolved && hh.farmstead !== null && st.farmsteads[hh.farmstead].village === villageOf(st, p);
  };
  // A basis is a check of (st, task, pawn); the first that holds is the answer, so later bases (debtor, hired) are added
  // here, in their place in the order. A task is {owner: {type, id}}: a job, or the owner of a work opportunity not yet posted.
  const BASES = [
    ['servant', (st, t, p) => t.owner.type === 'household' && t.owner.id === p.household && p.servant],
    ['member', (st, t, p) => t.owner.type === 'household' && t.owner.id === p.household],
    ['villager', (st, t, p) => t.owner.type === 'village' && villageOf(st, p) === t.owner.id],
    ['helper', helps],
    ['self', (st, t) => t.owner.type !== 'household' && t.owner.type !== 'village'],
  ];
  // The basis on which the pawn may take the task, or null.
  function eligible(st, task, pawn) {
    for (let i = 0; i < BASES.length; i++) if (BASES[i][1](st, task, pawn)) return BASES[i][0];
    return null;
  }
  return { eligible, BASES };
})();
