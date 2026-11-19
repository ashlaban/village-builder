// @sys sim/deaths: causes of death, the death.hazard rule and its daily roll, and the course of a fatal illness (VB-1118)
VB['sim/deaths'] = (() => {
  const { next: rnd } = VB['sim/rng'];
  const { YEAR, YEAR_DAYS, DAY, hazard, ILLNESS } = VB['sim/rules'];
  const Rules = VB['sim/registry'];
  Rules.declare({
    id: 'death.hazard',
    owner: 'sim/deaths',
    combine: 'product',
    base: (st, p) => hazard((st.t - p.born) / YEAR) / YEAR_DAYS,
    baseCause: (st, p) => baseCause((st.t - p.born) / YEAR),
    order: ['hunger', 'frailty'],
  }); // the terms are contributed by sim/hunger
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
  // One pawn's death roll for the day: null or a cause key, read from the rule's contributions (Rules.draw). One random draw.
  function deathRoll(st, p) {
    const u = rnd(st.rng.deaths);
    if (p.health <= 0) return 'starvation';
    return Rules.draw(st, 'death.hazard', p, u);
  }
  // @state pawn.ill: absent, or {cause (a key of ILLNESS.days), from, until (game hours)}: an illness running its course (VB-1118). A
  // death the roll draws of a cause with a course is not dealt at once: the pawn falls ill, ails for the cause's days (its health falls,
  // sim/hunger) and dies when the course is run. While ill it draws no other roll. Plain data, saved with the pawn.
  // The day's death of pawn p (sim/lifecycle): a cause to kill it with now, or null; a draw of a cause with a course starts the illness.
  function dayOfDeath(st, p) {
    if (p.ill !== undefined) {
      const cause = p.health <= 0 ? 'starvation' : st.t >= p.ill.until ? p.ill.cause : null;
      if (cause !== null) delete p.ill; // the course is run
      return cause;
    }
    const cause = deathRoll(st, p);
    const days = cause === null ? undefined : ILLNESS.days[cause];
    if (days === undefined) return cause;
    p.ill = { cause, from: st.t, until: st.t + days * DAY };
    return null;
  }
  return { CAUSES, COLD, deathRoll, dayOfDeath };
})();
