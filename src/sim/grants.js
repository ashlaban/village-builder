// @sys sim/grants [agency]: the head's grants on a member's levy (VB-1763; design.md section 7, The levy and own hours: Grant and ask; Leave, and
//   a stay away; Children, lodgers, elders and servants): a standing grant of hours a day for a season, and a dated one (leave: from an
//   hour to the end of the working day, or whole days), written on the household's plan by the verb grant, by a yes to a member's ask
//   (sim/voice) or by a servant's contract (its free day at its term, sim/service); read by sim/levies as the levy in force.
VB['sim/grants'] = (() => {
  const { cal, DAY, WORK, HEALTH, SEASON_DAYS } = VB['sim/rules'],
    { workRate, MATCH } = VB['sim/roles'];
  const { age } = VB['sim/records'];
  const { planOf } = VB['sim/plans'];
  // @tunable VOICE: a member's voice (VB-1555; design.md section 7, A member's voice)
  // days: a pawn asks of its own accord when it has not visited near kin or a close friend for this many days, at most once in them;
  // from: the hour its own ask's leave begins (the afternoon's allotment, MATCH.day.afternoon); wait: the days the played head has to
  // answer; closing: a window that closes within this many days wants the hands the head gave it; base, diligence: the head says yes
  // when base + its opinion of the member - diligence * (its diligence - 0.5) * 2 is above 0; lighter: the hours a day by the clock a
  // member asks off its levy for the season (VB-1763); dutyDays: a member asks for a duty of its own accord when it has held none for
  // this many days, at most once in them (VB-1556). Kept here, where sim/levies (the member's need: closing) reads it, before both; sim/voice's.
  const VOICE = {
    days: 6,
    from: MATCH.day.afternoon,
    wait: 0.125,
    base: 0.2,
    diligence: 0.3,
    closing: 3,
    lighter: 1,
    dutyDays: SEASON_DAYS,
  };
  const today = (st) => Math.floor(st.t / DAY);
  const endOfWork = (st) => today(st) * DAY + WORK[1];
  const seasonKey = (c) => c.year * 4 + c.season;
  // A pawn's hands: its rate by age (a child's, sim/roles workRate) by its health; hunger, which passes, is the rate's, not the levy's.
  const handsOf = (st, p) => workRate(p.role, age(st, p)) * (1 - (HEALTH.slow * (100 - p.health)) / 100);
  // @state plan.grants (a household's plan's): absent until its head's first grant, then {season: {pawn id: [at (the season: year × 4 +
  //   season), hours a day by the clock]}, dated: [[pawn id, day (its first game day), days (whole days, at least 1), from (the game
  //   hour it begins on its first day: that day's start for a whole day), with (the pawn its leave means to visit, or null), begun (the
  //   last game day it was begun, sim/voice's, or -1)]]}: the head's grants lowering a member's levy in force, a standing
  //   one for a season and a dated one (leave; a servant's free day at its term, written by its contract, sim/service). Those of a
  //   season or a day past, or of one no longer a member, are dropped at the next grant and at each review of the plan. Plain data,
  //   saved with the plan. Written only by sim/voice (the head's grant, its asks' yes, a leave begun, the pruning).
  const grantsOf = (st, hh) => {
    const plan = planOf(st, 'household', hh.id);
    return plan && plan.grants ? plan.grants : null;
  };
  // The standing grant of member id in season `key`, hours a day by the clock (0 for none).
  function standing(G, id, key) {
    const e = G && G.season[id];
    return e && e[0] === key ? e[1] : 0;
  }
  // The dated grant of member id that covers game day `day`, or null: one lookup a grant on the plan (bounded by the pruning).
  function datedOn(G, id, day) {
    if (!G) return null;
    for (const g of G.dated) {
      VB.count.grantLook++;
      if (g[0] === +id && day >= g[1] && day < g[1] + g[2]) return g;
    }
    return null;
  }
  // The clock hours of the working day dated grant g gives on game day `day`: from its hour to the end of the working day on its first
  // day, the whole working day after.
  const grantHours = (g, day) =>
    day > g[1] ? WORK[1] - WORK[0] : Math.max(0, WORK[1] - Math.max(WORK[0], Math.min(WORK[1], g[3] - day * DAY)));
  // A member's row hours (`row`, null when not levied) less what its head grants it on game day `day`: the levy in force, at least 0.
  function inForce(G, id, day, row) {
    if (row === null || !G) return row;
    const g = datedOn(G, id, day),
      less = standing(G, id, seasonKey(cal(day * DAY + WORK[0]))) + (g ? grantHours(g, day) : 0);
    return Math.max(0, row - less);
  }
  // The dated grant member id of household hh holds on game day `day` (default today), or null.
  const leaveOn = (st, hh, id, day = Math.floor(st.t / DAY)) => datedOn(grantsOf(st, hh), id, day);
  // The dated grants of household hh's plan (for sim/voice's hour), or none.
  const datedOf = (st, hh) => {
    const G = grantsOf(st, hh);
    return G ? G.dated : [];
  };
  // The leave (a dated grant, sim/levies) pawn id holds today on its household's plan, or null
  function grantOf(st, id) {
    const p = st.pawns[id],
      hh = p && p.household !== null ? st.households[p.household] : null;
    return hh && !hh.dissolved ? leaveOn(st, hh, id) : null;
  }
  // The hour leave g begins today: its own hour on its first day, the day's start after
  const startOf = (st, g) => (g[1] === today(st) ? g[3] : today(st) * DAY);
  // Is pawn id on leave now: a lookup of its household's grants, for the allotment of every member (sim/fit allotted).
  function on(st, id) {
    const g = grantOf(st, id);
    return !!g && st.t >= startOf(st, g) && st.t < endOfWork(st);
  }
  // The leave pawn id holds today, {from, until (game hours), begun, with (the pawn it means to visit, or null), days}, or null
  const leaveOf = (st, id) => {
    const g = grantOf(st, id);
    return g ? { from: startOf(st, g), until: endOfWork(st), begun: g[5] === today(st), with: g[4], days: g[2] } : null;
  };
  return {
    VOICE,
    seasonKey,
    handsOf,
    grantsOf,
    standing,
    datedOn,
    grantHours,
    inForce,
    leaveOn,
    datedOf,
    grantOf,
    startOf,
    on,
    leaveOf,
  };
})();
