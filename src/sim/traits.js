// @sys sim/traits: the stand-in traits (design.md section 7, Traits before slice 7; VB-254): wits, husbandry, diligence, ambition and
// generosity, one number in [0, 1) per pawn and trait, drawn at birth (and for the living at a run's start) from the stream `traits`;
// read through Traits.of, which slice 7 re-points to the real traits; a head's skill and its bias, as numbers, for sim/plans
VB['sim/traits'] = (() => {
  const { next: rnd } = VB['sim/rng'];
  const { YEAR } = VB['sim/rules'];
  // @state pawn.traits (VB-254): [wits, husbandry, diligence, ambition, generosity] in the order of NAMES (an array, to keep the save
  //   small), each uniform in [0, 1) from the stream `traits` to a thousandth, so neutral on average; drawn once, in this order, when the pawn
  //   is born or, for the living, when the run is seeded (and at the load of a save without them, keeping VB-249's diligence where the pawn
  //   had one). Absent for the dead on record before the run. Written only here; read through Traits.of.
  const NAMES = Object.freeze(['wits', 'husbandry', 'diligence', 'ambition', 'generosity']),
    IDX = Object.freeze(Object.fromEntries(NAMES.map((k, i) => [k, i])));
  // Skill as head (design.md section 7, foresight): the mean of wits and husbandry, plus GROWTH a year as head up to MOST, capped at 1.
  // The bias on a head's targets is within BIAS × (1 - skill) either way of the template's, drawn once when it becomes head.
  const HEAD = Object.freeze({ growth: 0.02, most: 0.2, bias: 0.3 });
  // The pawn's traits, drawn now (`keep`: values already held by name, as an old save's diligence, kept in place of their draws; drawn all
  // the same, so the stream advances as for any pawn).
  function draw(st, id, keep = {}) {
    const t = [];
    for (const k of NAMES) {
      const u = Math.floor(rnd(st.rng.traits) * 1000) / 1000;
      t.push(keep[k] !== undefined ? keep[k] : u);
    }
    st.pawns[id].traits = t;
    return t;
  }
  // Every living pawn without traits gets them, in id order: at seed, and at the load of a save made before them (VB-249's diligence kept).
  function seedTraits(st) {
    for (const id of st.living) {
      const p = st.pawns[id];
      if (p.traits) continue;
      draw(st, id, p.diligence !== undefined ? { diligence: p.diligence } : {});
      delete p.diligence; // lint-allow: owner VB-249's field becomes the trait of the same name
    }
  }
  // The pawn's trait `name`, in [0, 1): the one read of a trait (slice 7 re-points it). A pawn without traits (one of the dead on record)
  // reads the middle.
  function of(st, id, name) {
    const t = st.pawns[id].traits;
    return t ? t[IDX[name]] : 0.5;
  }
  // Skill as head of a pawn head since `since` (game hours): the mean of wits and husbandry, plus HEAD.growth a year as head up to HEAD.most.
  const skill = (st, id, since) =>
    Math.min(
      1,
      (of(st, id, 'wits') + of(st, id, 'husbandry')) / 2 +
        Math.min(HEAD.most, (HEAD.growth * Math.max(0, st.t - since)) / YEAR),
    );
  // A head's multiplier on one target, of skill s: within HEAD.bias × (1 - s) either way of 1, uniform; drawn from the stream `traits`.
  const biasOf = (st, s) => Math.round((1 + HEAD.bias * (1 - s) * (2 * rnd(st.rng.traits) - 1)) * 1000) / 1000; // to a thousandth
  return { NAMES, IDX, HEAD, draw, seedTraits, of, skill, biasOf };
})();
