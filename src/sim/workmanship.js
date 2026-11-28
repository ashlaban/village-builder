// @sys sim/workmanship [kernel]: the five grades of workmanship on a made good (VB-761): the tunables, the odds of each grade at a maker's skill at
// the craft, the draw of a piece's grade at its making (the stream `making`), the head's estimate of what its own hand's piece is worth,
// and who of a household takes a making (its most skilled hand at the craft)
// Design: design.md, The metals and the stones (Workmanship: Decided, 16 Nov; the numbers Proposed); docs/plans/VB-702.md, section 13.
// The registry's rows of a graded good, kind by grade, are sim/goods' (`kindRow(good, kind).grades`); custom's worth of a grade is
// sim/norms' (`norm('workmanship', grade)`). A grade is an index 0 to 4 into WORKMANSHIP.grades; no piece has a record or a maker's name.
VB['sim/workmanship'] = (() => {
  const { next: rnd } = VB['sim/rng'];
  const Skills = VB['sim/skills'],
    Traits = VB['sim/traits'],
    Norms = VB['sim/norms'];
  // @tunable WORKMANSHIP (VB-761; all Proposed by the plan of VB-702, section 13): grades, the five in order (Kim's, Decided);
  //   life: what a grade multiplies a piece's life by (its years, or divides the share that breaks a year); work: what it multiplies the
  //   effect its use reads by, measured from having none (a quern's grinding speed); odds: the shares of the five grades, in hundredths,
  //   at a maker's level at the craft of 0 (novice), 0.5 (practised) and 1 (master), in a straight line between; a practised maker averages
  //   the sound row (life 1.01, working 1.00); hands: the hands trait moves the skill the odds are read at by hands × (trait − 0.5), a tenth
  //   of skill either way and nothing at the middle (design.md, The twelve traits). Custom's worth by grade is sim/norms' WORKMANSHIP.
  const WORKMANSHIP = Object.freeze({
    grades: Object.freeze(['shoddy', 'sound', 'good', 'fine', 'masterwork']),
    life: Object.freeze([0.7, 1, 1.1, 1.25, 1.5]),
    work: Object.freeze([0.85, 1, 1.05, 1.12, 1.25]),
    odds: Object.freeze({
      novice: Object.freeze([60, 35, 5, 0, 0]),
      practised: Object.freeze([15, 45, 33, 6, 1]),
      master: Object.freeze([2, 23, 50, 20, 5]),
    }),
    hands: 0.2,
  });
  const N = WORKMANSHIP.grades.length,
    SOUND = 1; // the grade of a piece made before VB-761, of the start's, and of an old save's
  const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  // The share (0 to 1) of grade g among pieces made at skill s: the odds' rows read in a straight line between 0, 0.5 and 1.
  function oddsAt(s, g) {
    const O = WORKMANSHIP.odds;
    s = clamp01(s);
    return (
      (s <= 0.5
        ? O.novice[g] + (O.practised[g] - O.novice[g]) * 2 * s
        : O.practised[g] + (O.master[g] - O.practised[g]) * (2 * s - 1)) / 100
    );
  }
  // The skill a pawn's odds are read at for a craft: its level now (sim/skills), moved by its hands trait.
  const skillFor = (st, id, craft) =>
    clamp01(Skills.level(st, id, craft) + WORKMANSHIP.hands * (Traits.of(st, id, 'hands') - 0.5));
  // The mean of a row by grade (WORKMANSHIP.life, .work, or custom's worth) over the odds at skill s, in closed form; allocates nothing.
  function meanAt(s, row) {
    let m = 0;
    for (let g = 0; g < N; g++) m += oddsAt(s, g) * row(g);
    return m;
  }
  // The grade of a piece pawn id makes at a craft: one draw of the stream `making` (a test forces a grade with `fix`).
  function draw(st, id, craft) {
    const s = skillFor(st, id, craft),
      u = rnd(st.rng.making);
    let acc = 0;
    for (let g = 0; g < N - 1; g++) if (u < (acc += oddsAt(s, g))) return g;
    return N - 1;
  }
  // The head's estimate (principle "The future is someone's estimate") of what a piece of its own hand id's making is worth, against a sound one: the mean
  // of custom's
  // multipliers by grade over the odds at the hand's skill (a novice 0.77, practised 1.11, a master 1.47). Offered to VB-698 and VB-699.
  const worthOf = (g) => Norms.norm('workmanship', g);
  const expectedWorth = (st, id, craft) => meanAt(skillFor(st, id, craft), worthOf);
  // Who of a household takes a making: of the pawns `ids` that may take it, the most skilled at the craft (by the skill its odds read),
  // the first in the order given on a tie (plan, 13.5: a target is on a good, never on a grade; what a head chooses is who makes it).
  function maker(st, ids, craft) {
    let best = null,
      top = -1;
    for (const id of ids) {
      const s = skillFor(st, id, craft);
      if (s > top) ((top = s), (best = id));
    }
    return best;
  }
  return { WORKMANSHIP, SOUND, oddsAt, skillFor, meanAt, draw, expectedWorth, maker };
})();
