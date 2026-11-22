// @sys sim/house: a well-kept house (VB-306; VB-419, from sim/rules): a house's condition and how it wears, tar and a stone house,
// and the standing its term gives
VB['sim/house'] = (() => {
  const { YEAR } = VB['sim/rules'];
  // @tunable HOUSE: a well-kept house (VB-306; design.md, Goods of place and side crafts: A well-kept house)
  // A farmstead's condition 0..1 (f.condition) is the value at f.condAt (game hours; 0 when never set) for an occupied house, and it wears
  // by closed form from then (rule 3: no daily pass), 0.1 a year, 0.067 while tarred (f.tarredUntil, game hours: a barrel lasts 6 years;
  // nothing tars a house before VB-301). An empty farm's condition is worn by the daily pass of sim/clock, as before.
  // Upkeep is offered under `mendBelow`; `hours` of work raise it `raise`; standing gains `term` (tarred `termTarred`) times the condition.
  // A house raised onto a stone foundation (f.grade 'stone', VB-332) wears `wearStone` a year and its term is `termStone`; tar's gain adds on
  // either grade (the term's 0.03, wear a third less), so a house on the ground reads as before.
  const HOUSE = {
    wear: 0.1,
    wearTarred: 0.067,
    term: 0.15,
    termTarred: 0.18,
    mendBelow: 0.8,
    hours: 4,
    raise: 0.1,
    tarYears: 6,
    wearStone: 0.08,
    termStone: 0.2,
  };
  const onStone = (f) => f.grade === 'stone';
  const houseTarred = (st, f) => (f.tarredUntil || 0) > st.t;
  function houseCondition(st, f) {
    const c = f.condition ?? 1;
    if (f.household === null || st.liveTrusts?.some((i) => st.trusts[i].household === f.household)) return c; // empty, or in trust
    const t0 = f.condAt ?? 0,
      tar = Math.min(st.t, f.tarredUntil || 0),
      tarred = Math.max(0, tar - t0),
      plain = Math.max(0, st.t - t0) - tarred;
    const wear = onStone(f) ? HOUSE.wearStone : HOUSE.wear,
      wearTarred = wear * (HOUSE.wearTarred / HOUSE.wear);
    return Math.max(0, c - (plain * wear + tarred * wearTarred) / YEAR);
  }
  const houseTerm = (st, f) =>
    ((onStone(f) ? HOUSE.termStone : HOUSE.term) + (houseTarred(st, f) ? HOUSE.termTarred - HOUSE.term : 0)) *
    houseCondition(st, f);
  return { HOUSE, houseTarred, houseCondition, houseTerm };
})();
