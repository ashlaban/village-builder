// VB-254: every head of a state made to plan by the template alone: of no skill (it reacts, so it projects nothing) and with no bias (the
// traits' stream forced with `fix` while its heads are drawn again); for tests written against the template's targets.
function templateHeads(VB, st) {
  const P = VB['sim/plans'];
  for (const plan of st.plans.households.values())
    if (plan.head) {
      const t = st.pawns[plan.head.pawn].traits, I = VB['sim/traits'].IDX;
      t[I.wits] = t[I.husbandry] = VB['sim/rules'].TRAITS.bounds[0]; // the least of each (VB-519)
    }
  st.rng.traits.fix = 0.5;
  P.startHeads(st);
  delete st.rng.traits.fix;
  return st;
}
module.exports = { templateHeads };
