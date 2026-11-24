// @sys sim/sleep: sleep owed (VB-1615): the SLEEP tunable, what the hours owed cost in mood (sim/mood) and health (sim/hunger), and
//   the page's read of the played pawn's sleep. The hours are the player's (st.player.sleep): sim/player keeps them each step and carries
//   out the verb `sleep`; unplayed pawns do not sleep by this rule yet
VB['sim/sleep'] = (() => {
  // @tunable SLEEP: sleep for the played pawn (VB-1615; Kim, 24 Nov: "Night work at a cost; sleep can be a planned action. Sleep
  //   deprivation affects mood and (to a lesser degree initially, health)"). Starting values.
  // need: hours of sleep a day; each hour awake owes need / (24 - need) of an hour (need 8: half an hour), each hour asleep pays one,
  //   never under 0 and at most `cap` (two days and nights awake). An ordinary day (awake 6 to 18, WORK) owes 6 by its evening.
  // mood: `tired`, nothing up to `over` hours owed (a waking day's 8, which a night pays off), then `per` an hour owed beyond, to `cap`: a
  //   night lost (12 owed at dawn) is -10, its evening the cap, about as hungry is (MOOD.hungry: -20 at full hunger).
  // health: at the day's reckoning (sim/hunger, at midnight), only once a whole night or more is owed (`over`, need), `value` for each
  //   night owed: 1.5 the night after a day and a night awake, at most 3 a day (hunger drains up to 4, a cold house 2).
  const SLEEP = {
    need: 8,
    cap: 24,
    mood: { over: 8, per: -2.5, cap: -20 },
    health: { over: 8, value: 1 },
  };
  // what an hour awake owes
  const AWAKE = SLEEP.need / (24 - SLEEP.need);
  // The hours of sleep pawn id owes: the played pawn's, 0 for any other (they do not sleep by this rule yet).
  const owedBy = (st, id) => {
    const pl = st.player;
    return pl && pl.pawn === id && pl.sleep ? pl.sleep.owed : 0;
  };
  // The mood modifier `tired` for hours owed (0 under the allowance), and the day's health cost.
  const tiredMood = (owed) =>
    owed > SLEEP.mood.over ? Math.max(SLEEP.mood.cap, SLEEP.mood.per * (owed - SLEEP.mood.over)) : 0;
  const tiredHealth = (owed) => (owed >= SLEEP.health.over ? (SLEEP.health.value * owed) / SLEEP.need : 0);
  // The page's read (the Sim facade): the played pawn's hours owed, whether it sleeps now, and the mood and health terms now (mood as
  // its card shows it, rounded; health what the day's reckoning would take); null with no pawn played.
  function sleepOf(st) {
    const pl = st.player;
    if (!pl) return null;
    const owed = pl.sleep ? pl.sleep.owed : 0;
    return {
      owed,
      asleep: !!(pl.sleep && pl.sleep.asleep),
      mood: Math.round(tiredMood(owed)),
      health: tiredHealth(owed),
    };
  }
  return { SLEEP, AWAKE, owedBy, tiredMood, tiredHealth, sleepOf };
})();
