// @sys sim/deaths: causes of death, the death.hazard rule and its daily roll, and the course of an illness, which kills (VB-1118) or passes (VB-1246)
VB['sim/deaths'] = (() => {
  const { next: rnd } = VB['sim/rng'];
  const { YEAR, YEAR_DAYS, DAY, ILLNESS } = VB['sim/rules'],
    { CROWD } = VB['sim/crowding'];
  const Rules = VB['sim/registry'];
  const Crowding = VB['sim/crowding'];
  Rules.declare({
    id: 'death.hazard',
    owner: 'sim/deaths',
    combine: 'product',
    base: (st, p) => hazard((st.t - p.born) / YEAR) / YEAR_DAYS,
    baseCause: (st, p) => baseCause((st.t - p.born) / YEAR),
    order: ['hunger', 'frailty', 'crowding'],
  }); // the terms are contributed by sim/hunger, and crowding here
  Rules.contribute({
    rule: 'death.hazard',
    source: 'sim/crowding',
    key: 'crowding',
    label: 'Crowding',
    cause: 'illness', // stands in for disease until disease exists
    range: [1, CROWD.max],
    tunables: ['CROWD.free', 'CROWD.per', 'CROWD.max'],
    value: Crowding.factor,
    note: Crowding.note,
  });
  // Annual death hazard at age a (years, may be fractional): Gompertz-Makeham for adults plus a juvenile term that falls with age (Siler 1979),
  // so that about 20% die before age 1 and a third before 15.
  const hazard = (a) => 0.006 + 0.0007 * Math.exp(0.07 * a) + 0.381 * Math.exp(-1.265 * a);

  // Cause keys: the base hazard by age (infancy, childhood, illness, oldAge), the share added by hunger, and the causes set elsewhere.
  // `event` is the text of the pawn's life event, `log` the text of the village log ("<name> of <farm> <log>, aged <n>").
  const CAUSES = {
    infancy: { event: 'Died in infancy', log: 'died in infancy' },
    childhood: { event: 'Died of a childhood illness', log: 'died of a childhood illness' },
    illness: { event: 'Died of illness', log: 'died of illness' },
    oldAge: { event: 'Died of old age', log: 'died of old age' },
    hunger: { event: 'Died of hunger', log: 'died of hunger' },
    starvation: { event: 'Died of starvation', log: 'starved to death' },
    childbirth: { event: 'Died in childbirth', log: 'died in childbirth' },
    killed: { event: 'Killed', log: 'was killed' },
  };
  // A death in a cold house (VB-327: its household's hh.cold above 0) is told with this after the cause's words; no cause of its own.
  const COLD = ' in a cold house';
  const baseCause = (a) => (a < 1 ? 'infancy' : a < 15 ? 'childhood' : a < 60 ? 'illness' : 'oldAge');
  // One pawn's death roll for the day: null or a cause key, read from the rule's contributions (Rules.draw). One random draw, `u`.
  function deathRoll(st, p, u = rnd(st.rng.deaths)) {
    if (p.health <= 0) return 'starvation';
    return Rules.draw(st, 'death.hazard', p, u);
  }
  // @state pawn.ill: absent, or {cause (a key of ILLNESS.days), from, until (game hours), passes (absent, or true: a course that passes,
  //   VB-1246)}: an illness running its course (VB-1118). A death the roll draws of a cause with a course is not dealt at once: the pawn
  //   falls ill, ails for the cause's days (its health falls, sim/hunger) and dies when the course is run; while it runs no other roll is
  //   drawn. A pawn also falls ill at an incidence of its own (ILLNESS.incidence, by the cause its age gives) above the roll's deaths: that
  //   course passes, its health falling by ILLNESS.passing of the fall, and the pawn recovers at its end unless its health gives out
  //   first; the day's roll still runs while it ails, and a death drawn then turns the course to one that kills, so the deaths the roll
  //   draws are as before. Plain data, saved with the pawn.
  // The day's death of pawn p (sim/lifecycle): a cause to kill it with now, or null; a draw of a cause with a course starts the illness.
  function dayOfDeath(st, p) {
    const I = p.ill;
    if (I !== undefined && !I.passes) {
      const cause = p.health <= 0 ? 'starvation' : st.t >= I.until ? I.cause : null;
      if (cause !== null) delete p.ill; // the course is run
      return cause;
    }
    const u = rnd(st.rng.deaths),
      cause = deathRoll(st, p, u),
      days = cause === null ? undefined : ILLNESS.days[cause];
    if (I !== undefined) {
      if (p.health <= 0) {
        delete p.ill;
        return p.hunger > 0 ? 'starvation' : I.cause; // its health gave out: the illness took it, unless hunger did
      }
      if (days !== undefined) {
        p.ill = { cause, from: I.from, until: Math.max(I.until, st.t + days * DAY) }; // the course turns to one that kills
        return null;
      }
      if (cause === null && st.t >= I.until) delete p.ill; // recovered
      return cause;
    }
    if (days !== undefined) {
      p.ill = { cause, from: st.t, until: st.t + days * DAY };
      return null;
    }
    if (cause !== null) return cause;
    const base = baseCause((st.t - p.born) / YEAR);
    if (u < ILLNESS.incidence[base] / YEAR_DAYS)
      p.ill = { cause: base, from: st.t, until: st.t + ILLNESS.days[base] * DAY, passes: true };
    return null;
  }
  return { hazard, CAUSES, COLD, deathRoll, dayOfDeath };
})();
