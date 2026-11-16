// VB-254: every head of a state made to plan by the template alone: of middling skill (wits and husbandry 0.4: under 0.67 with all its
// years as head, so it projects to the season's end, which is the template's own look-ahead, VB-485) and with no bias (the
// traits' stream forced with `fix` while its heads are drawn again); for tests written against the template's targets.
function templateHeads(VB, st) {
  const P = VB['sim/plans'];
  for (const plan of st.plans.households.values())
    if (plan.head) {
      const t = st.pawns[plan.head.pawn].traits, I = VB['sim/traits'].IDX;
      t[I.wits] = t[I.husbandry] = 0.4;
    }
  st.rng.traits.fix = 0.5;
  P.startHeads(st);
  delete st.rng.traits.fix;
  return st;
}
module.exports = { templateHeads };
