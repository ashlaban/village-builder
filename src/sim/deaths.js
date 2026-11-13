// @sys sim/deaths: causes of death, the death.hazard rule and its daily roll
VB['sim/deaths'] = (() => {
  const { next: rnd } = VB['sim/rng'];
  const { YEAR, YEAR_DAYS, hazard } = VB['sim/rules'];
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
  const baseCause = (a) => (a < 1 ? 'infancy' : a < 15 ? 'childhood' : a < 60 ? 'illness' : 'oldAge');
  // One pawn's death roll for the day: null or a cause key, read from the rule's contributions (Rules.draw). One random draw.
  function deathRoll(st, p) {
    const u = rnd(st.rng.deaths);
    if (p.health <= 0) return 'starvation';
    return Rules.draw(st, 'death.hazard', p, u);
  }
  return { CAUSES, deathRoll };
})();
