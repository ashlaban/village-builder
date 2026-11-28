// @sys sim/skills [kernel]: a pawn's skill at each type of work (VB-475: a stand-in drawn once, from the stream `traits`, that does not grow) and
// at each craft (VB-360: learnt by doing, faster with aptitude, fading unused, read in closed form), and what they do to a hand's rate:
// skill speeds the work, and a mishap drawn at a work leg's start (the stream `mishap`) slows it, less for a skilled hand; a hand of
// middling skill works at the norm on average; a craft's level multiplies the rate from a novice's to a master's.
VB['sim/skills'] = (() => {
  const { next: rnd } = VB['sim/rng'];
  const { YEAR } = VB['sim/rules'];
  const { pass, of: traitOf } = VB['sim/traits'];
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
  // @tunable SKILLS (VB-360; design.md, Goods, production and animals, The mill and the loom: Skills; slice 6's plan, VB-185):
  //   crafts: the crafts a pawn can learn (the declared cap of pawn.skills; a job kind names its craft as `craft`, sim/kinds);
  //   half: the hours of practice that take a craft from 0 to halfway (0.5), at aptitude 1: each hour closes the same share of the gap to 1;
  //   fade: the share of its level a craft loses a year unused (in closed form from the time it was last practised);
  //   novice, master: the rate a hand works a craft at, times its rate, at level 0 and at level 1, linear between;
  //   learn: the aptitude, [at the trait's 0, at its 1], times the hours a practice counts; the trait a craft reads is `aptitude` (design.md,
  //   People, The twelve traits: hands for the crafts of the hands, body for heavy work; until slice 7 the trait stands in directly);
  //   shown: the level from which the pawn panel lists a craft; words: the fixed scale of four steps (Kim, 18 Nov, VB-1123: an absolute
  //   standard), each [the level from which it holds, its word], in quarters as the mocks drew them.
  const SKILLS = Object.freeze({
    crafts: Object.freeze([
      'spinning',
      'weaving',
      'smelting',
      'smithing',
      'pottery',
      'building',
      'milling',
      'stonework',
      'casting',
    ]),
    half: 400,
    fade: 0.1,
    novice: 0.6,
    master: 1.3,
    learn: Object.freeze([0.75, 1.25]),
    aptitude: Object.freeze({ smelting: 'body', milling: 'body', stonework: 'body' }),
    shown: 0.1,
    words: Object.freeze([
      Object.freeze([0, 'novice']),
      Object.freeze([0.25, 'able']),
      Object.freeze([0.5, 'skilled']),
      Object.freeze([0.75, 'master']),
    ]),
  });
  const CRAFT = Object.freeze(Object.fromEntries(SKILLS.crafts.map((k) => [k, true])));
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
  // ---- crafts, learnt by doing (VB-360) ----
  // @state pawn.skills (VB-360): the pawn's crafts practised, {[craft]: {level, at}}: the level (0 to 1) when it was last set and the game
  //   hour it was set; only crafts of SKILLS.crafts; absent until the pawn first practises one (it then reads 0 at every craft). The level
  //   now is read in closed form (level): no yearly pass. Written only here (practise).
  // The pawn's level at a craft now: its stored level, less SKILLS.fade of itself a year since it was set.
  function level(st, id, craft) {
    const k = st.pawns[id].skills,
      s = k && k[craft];
    if (!s) return 0;
    const years = (st.t - s.at) / YEAR;
    return years > 0 ? s.level * Math.pow(1 - SKILLS.fade, years) : s.level;
  }
  // The pawn's aptitude for a craft: SKILLS.learn at its trait (hands, or body for heavy work), linear between.
  const aptitude = (st, id, craft) => {
    const L = SKILLS.learn;
    return L[0] + (L[1] - L[0]) * traitOf(st, id, SKILLS.aptitude[craft] || 'hands');
  };
  // Hours of practice at a craft (sim/work, as a craft's task is reckoned): the level read now rises towards 1, each hour (times the
  // pawn's aptitude) closing the share of the gap that makes SKILLS.half hours from 0 reach a half.
  // What so many hours of practice from now would bring the pawn's level to, in closed form, writing nothing (plan mode's estimate, VB-1123).
  const grownBy = (st, id, craft, hours) =>
    1 - (1 - level(st, id, craft)) * Math.pow(0.5, (Math.max(0, hours) * aptitude(st, id, craft)) / SKILLS.half);
  function practise(st, id, craft, hours) {
    if (!CRAFT[craft] || !(hours > 0)) return;
    const p = st.pawns[id],
      l = grownBy(st, id, craft, hours),
      k = p.skills || (p.skills = {});
    k[craft] = { level: l, at: st.t };
  }
  // What a craft's level makes of a hand's rate: SKILLS.novice at 0 to SKILLS.master at 1.
  const craftRate = (l) => SKILLS.novice + (SKILLS.master - SKILLS.novice) * l;
  // The pawn's word for a level on the fixed scale.
  function wordOf(l) {
    let word = SKILLS.words[0][1];
    for (const [at, w] of SKILLS.words) if (l >= at) word = w;
    return word;
  }
  // The pawn's crafts at SKILLS.shown or above, each {craft, level, word}, in the order of SKILLS.crafts (the pawn panel).
  function craftsOf(st, id) {
    const out = [];
    if (!st.pawns[id].skills) return out;
    for (const c of SKILLS.crafts) {
      const l = level(st, id, c);
      if (l >= SKILLS.shown) out.push({ craft: c, level: l, word: wordOf(l) });
    }
    return out;
  }
  // A work leg begins (sim/agents): the hand's pace for the leg at a type of work, with its mishap drawn now from the stream `mishap`,
  // times its craft's rate for a kind that names one (`craft`); to a thousandth, so the save stays small. One read of the craft's level.
  const workPace = (st, id, type, craft) =>
    craft ? Math.round(legPace(st, id, type) * craftRate(level(st, id, craft)) * 1000) / 1000 : legPace(st, id, type);
  return {
    SKILL,
    SKILLS,
    NORM,
    born,
    seedSkills,
    skillOf,
    paceOf,
    legPace,
    level,
    grownBy,
    practise,
    craftRate,
    wordOf,
    craftsOf,
    workPace,
  };
})();
