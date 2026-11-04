// @sys sim/deaths: causes of death, the death.hazard rule and its daily roll
VB['sim/deaths'] = (() => {
  const { next: rnd } = VB['sim/rng'];
  const { YEAR, YEAR_DAYS, hazard, HUNGER, HEALTH } = VB['sim/rules'];
  const Rules = VB['sim/registry'];
  Rules.declare({ id: 'death.hazard', owner: 'sim/deaths', combine: 'product',
    base: (st, p) => hazard((st.t - p.born) / YEAR) / YEAR_DAYS });
  Rules.contribute({ rule: 'death.hazard', source: 'sim/hunger', key: 'hunger', label: 'Hunger', cause: 'hunger',
    range: [1, 2.5], tunables: ['HUNGER.k'],
    value: (st, p) => 1 + HUNGER.k(Math.floor((st.t - p.born) / YEAR)) * p.hunger });
  Rules.contribute({ rule: 'death.hazard', source: 'sim/hunger', key: 'frailty', label: 'Poor health', cause: 'hunger',
    range: [1, 3], tunables: ['HEALTH.riskBelow', 'HEALTH.riskSlope'],
    value: (st, p) => p.health < HEALTH.riskBelow ? 1 + (HEALTH.riskBelow - p.health) / HEALTH.riskSlope : 1 });
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
  // One pawn's death roll for the day: null or a cause key; a roll that falls in the share added by hunger is 'hunger'. One random draw.
  function deathRoll(st, p) {
    const a = (st.t - p.born) / YEAR, u = rnd(st.rng.deaths);
    if (p.health <= 0) return 'starvation';
    if (u >= Rules.value(st, 'death.hazard', p)) return null;
    return u >= hazard(a) / YEAR_DAYS ? 'hunger' : baseCause(a);
  }
  return { CAUSES, deathRoll };
})();
