// @sys sim/skills: a pawn's skill at each type of work (VB-475: the stand-in until slice 7's skills learnt by doing, VB-360) and what it
// does to a hand's rate: skill speeds the work, and a mishap drawn at a work leg's start (the stream `mishap`) slows it, less for a
// skilled hand; a hand of middling skill works at the norm on average. Skill is drawn once, from the stream `traits`, and does not grow.
VB['sim/skills'] = (() => {
  const { next: rnd } = VB['sim/rng'];
  const { pass } = VB['sim/traits'];
  // @state pawn.skill (VB-475): the pawn's skill at each type of work, in the order of SKILL.types (an array, to keep the save small),
  //   each to a thousandth within TRAITS.bounds (0.5 the middle); drawn from the stream `traits` around the middle, as a placed pawn's
  //   temperament is (Traits.pass), at birth (born, after its traits) and at seed for those a scenario places (seedSkills); it does not grow.
  //   A pawn without it (a save made before VB-475) reads the middle. Written only here; read through skillOf.
  // The tunables (Kim, 15 Nov: variation in the time taken has a cause, and is small):
  //   types: the types of work a kind declares (`type`, sim/kinds; the keys ROLES rank in sim/roles), in a fixed order: the save's;
  //   rate: a hand's rate is multiplied by rate[0] at skill 0 to rate[1] at skill 1, linearly (1 at the middle);
  //   mishap: the most a mishap lowers a leg's rate by, mishap[0] at skill 0 to mishap[1] at skill 1, linearly; the draw is uniform
  //   between 0 and that most, so it lowers the rate by half of it on average. A hand at the middle skill averages the norm: the rate is
  //   divided by what the mean mishap leaves at the middle (norm), so a mishap is a cause of spread, not of a slower village.
  const SKILL = Object.freeze({
    types: Object.freeze([
      'workday',
      'duty',
      'tilling',
      'tending',
      'harvest',
      'threshing',
      'wood',
      'upkeep',
      'household',
      'husbandry',
      'foraging',
      'herding',
    ]),
    rate: Object.freeze([0.9, 1.1]),
    mishap: Object.freeze([0.2, 0.05]),
  });
  const IDX = Object.freeze(Object.fromEntries(SKILL.types.map((k, i) => [k, i])));
  const MIDDLE = 0.5,
    lerp = (ab, s) => ab[0] + (ab[1] - ab[0]) * s;
  // the most a mishap takes at skill s, and what the mean mishap leaves of the rate at the middle skill
  const mostOf = (s) => lerp(SKILL.mishap, s),
    NORM = 1 - mostOf(MIDDLE) / 2;
  // ---- the draw ----
  // The pawn's skills, one draw of the stream `traits` a type, in the order of SKILL.types.
  function draw(st, id) {
    const t = new Array(SKILL.types.length);
    for (let i = 0; i < t.length; i++) t[i] = pass(st, MIDDLE, 0);
    st.pawns[id].skill = t;
    return t;
  }
  // A child born (sim/births, after its traits): its skills.
  const born = (st, id) => draw(st, id);
  // Every pawn without skills gets them, in id order (sim/scenarios, after the traits: those a scenario places, the living and the dead).
  function seedSkills(st) {
    for (const p of st.pawns) if (!p.skill || p.skill.length !== SKILL.types.length) draw(st, p.id);
  }
  // ---- read ----
  // The pawn's skill at a type of work; a type not in SKILL.types, or a pawn without skills, reads the middle.
  function skillOf(st, id, type) {
    const t = st.pawns[id].skill,
      i = IDX[type];
    return t && i !== undefined ? t[i] : MIDDLE;
  }
  // What skill s and a mishap's draw u (in [0, 1)) make of a hand's rate over a leg: skill's multiplier, lowered by the mishap, over the norm.
  const paceOf = (s, u) => (lerp(SKILL.rate, s) * (1 - u * mostOf(s))) / NORM;
  // A work leg begins (sim/agents): the hand's pace at a type of work for the leg, its mishap drawn now from the stream `mishap`; to a
  // thousandth, so the save stays small.
  const legPace = (st, id, type) => Math.round(paceOf(skillOf(st, id, type), rnd(st.rng.mishap)) * 1000) / 1000;
  return { SKILL, NORM, born, seedSkills, skillOf, paceOf, legPace };
})();
