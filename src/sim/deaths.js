// @sys sim/deaths: causes of death, with their texts, and the daily death roll
VB['sim/deaths'] = (() => {
  const { YEAR, YEAR_DAYS, hazard, HUNGER, HEALTH } = VB['sim/rules'];
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
    const a = (st.t - p.born) / YEAR, base = hazard(a) / YEAR_DAYS, u = st.rand();
    if (p.health <= 0) return 'starvation';
    const frail = p.health < HEALTH.riskBelow ? 1 + (HEALTH.riskBelow - p.health) / HEALTH.riskSlope : 1;
    if (u >= base * (1 + HUNGER.k(Math.floor(a)) * p.hunger) * frail) return null;
    return u >= base ? 'hunger' : baseCause(a);
  }
  return { CAUSES, deathRoll };
})();
