// @sys sim/dress [material]: clothing that wears out (VB-363): each person's dress is a length of cloth worn out in DRESS.years, read in closed form;
// on the household's planning day a person whose dress is worn takes a length from the store; in rags winter costs more health and
// standing falls. Design: design.md, Goods, production and animals (The mill and the loom: Dress); backlog/VB-185.md.
VB['sim/dress'] = (() => {
  const { YEAR } = VB['sim/rules'];
  const Stores = VB['sim/stores'];
  const { WORKMANSHIP } = VB['sim/workmanship'];
  const { on } = VB['sim/events'];
  // @tunable DRESS (VB-363; Proposed by slice 6's plan, 11 Nov): years: a length worn from new (1) to nothing (0), times the grade's life;
  //   mend: the worth under which a person takes a new length at the household's planning day; rags: the worth under which it is rags;
  //   cold: what the cold's health loss is multiplied by in rags; shame: the standing lost in rags; child: the share of a length a child
  //   takes (its dress lasts the longer for it: it wears the span 1 / child as long); start: the worth the scenarios' first people start
  //   at, [from, to], drawn.
  const DRESS = { years: 3, mend: 0.3, rags: 0.1, cold: 1.5, shame: 0.1, child: 0.5, start: Object.freeze([0.3, 1]) };
  // @state pawn.dress: {worth (at `at`), at (game hour), grade (of its cloth, sim/workmanship), span (absent: 1; 1 / DRESS.child for a
  //   child's half length)}: the worth now is read in closed form, falling to 0 over DRESS.years times the grade's life times span; set at
  //   the pawn's making (sim/records) and renewed only here
  function worth(st, p) {
    const d = p.dress;
    if (!d) return 1;
    const life = DRESS.years * YEAR * WORKMANSHIP.life[d.grade] * (d.span || 1);
    return Math.max(0, d.worth - (st.t - d.at) / life);
  }
  const rags = (st, p) => worth(st, p) < DRESS.rags;
  // The grade a take of cloth hands over (the least worth first, sim/stores takeCloth).
  function gradeAtHand(hh) {
    for (let g = 0; g < 5; g++) if (hh.cloth && hh.cloth[g] > 0) return g;
    return -1;
  }
  // A pawn takes a length from its household's store when its dress is under DRESS.mend; says whether it did.
  function mend(st, p, hh) {
    if (worth(st, p) >= DRESS.mend) return false;
    const g = gradeAtHand(hh);
    if (g < 0) return false;
    Stores.take(st, hh, 'cloth', 1, 'dress');
    p.dress = { worth: 1, at: st.t, grade: g };
    if (p.role === 'child') p.dress.span = 1 / DRESS.child;
    return true;
  }
  // The household's planning day (sim/plans' planReviewed, why 'day'): the head first, then the grown, then the children.
  on('planReviewed', (st, d) => {
    if (d.why !== 'day' || d.plan.holder.type !== 'household') return;
    const hh = st.households[d.plan.holder.id];
    if (hh.dissolved || !hh.cloth || Stores.heldOf(hh, 'cloth') < 1) return;
    const order = (p) => (p.id === hh.holder ? 0 : p.role === 'child' ? 2 : 1);
    const who = hh.members
      .map((id) => st.pawns[id])
      .filter((p) => p.alive && p.household === hh.id)
      .sort((a, b) => order(a) - order(b) || a.id - b.id);
    for (const p of who) if (!mend(st, p, hh) && Stores.heldOf(hh, 'cloth') < 1) break;
  });
  return { DRESS, worth, rags, mend };
})();
