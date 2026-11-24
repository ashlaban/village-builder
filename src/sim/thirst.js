// @sys sim/thirst: a pawn's own thirst (VB-1554; design.md, Water by the site, The thirsty pawn): the hour it last drank (pawn.drank), from
// which its thirst is read in closed form, so nothing ticks; the day's end of each pawn (the meal's pass asks: did it drink today), who
// goes for its own drink, and the job kind `drink`, a drink at a source. The verb and the leaving of work are sim/drinking's
VB['sim/thirst'] = (() => {
  const { DAY } = VB['sim/rules'],
    CHILD_FROM = VB['sim/roles'].CHILD.from;
  const { age } = VB['sim/records'];
  const { emit } = VB['sim/events'];
  const { FRESH } = VB['world/water'];
  // @tunable THIRST: a pawn's thirst (design.md, Water by the site, The thirsty pawn; Proposed, Kim's starting values of 23 November).
  // thirsty: the hours without a drink from which a pawn is thirsty, and a day that ends so costs it the dry day's health; leave: the
  // hours at which it leaves whatever it does and goes to drink; sip: the hours a drink at a source takes; meal: the hour of the day at
  // which a household whose water is in drinks with its meal (the day's end reads it back: 36 hours on is the morning after a dry day).
  const THIRST = { thirsty: 24, leave: 36, sip: 0.05, meal: 18 };
  // The hours since pawn p last drank.
  const thirst = (st, p) => st.t - p.drank;
  const thirsty = (st, p) => st.t - p.drank >= THIRST.thirsty;
  // Pawn p drank at game hour t (now, unless given), of a marsh's poor water if `poor`. Never moves the hour back.
  function drank(st, p, t = st.t, poor = false) {
    // @state pawn.drank: the game hour the pawn last drank: at home at the meal of a day whose water was in (THIRST.meal), at a source
    //   when it drew or drank there; set at its making, and by `loaded` for a save from before VB-1554 (as having drunk). Its thirst is
    //   st.t - drank, never stored (sim/thirst)
    if (!(p.drank >= t)) p.drank = t;
    // @state pawn.marsh: absent, or the day (st.t / DAY, whole) the pawn last drank marsh water at a source by itself: poor water, which
    //   costs it HEALTH.marsh at that day's end, once, with its household's marsh water or without (sim/thirst; sim/hunger reads it)
    if (poor) p.marsh = Math.floor(t / DAY);
  }
  // Who goes for its own drink: not a child under 7 nor one ill in bed (the bedridden), who are given their drink at home.
  const goes = (st, p) => p.died === null && age(st, p) >= CHILD_FROM && p.ill === undefined;
  // The day that ends for pawn p, asked by the meal's pass (sim/hunger feedHousehold, sim/away feedAway), which visits it already:
  // `given`, its household's water was in (or its host's, or its booth's), so it drank at the day's meal. Returns [dry, poor]: 1 if it
  // ended the day without a drink (thirsty: HEALTH.dry is its own), and whether it drank marsh water by itself that day. One that ended
  // the day thirsty and goes for its own drink is told to sim/drinking ('thirsty'), which holds it due at THIRST.leave.
  function dayEnd(st, p, given) {
    const day = Math.floor(st.t / DAY) - 1; // the day that ended
    if (given) drank(st, p, day * DAY + THIRST.meal);
    const dry = thirsty(st, p) ? 1 : 0;
    if (dry && goes(st, p)) emit(st, 'thirsty', p.id);
    return [dry, p.marsh === day];
  }
  // A save from before VB-1554 loads as having drunk.
  function loaded(st) {
    for (const p of st.pawns) if (typeof p.drank !== 'number') p.drank = st.t;
  }
  // One line for the pawn's panel: thirsty, and for how long; null below THIRST.thirsty.
  function line(st, id) {
    const p = st.pawns[id];
    if (p.died !== null || !thirsty(st, p)) return null;
    const h = Math.floor(thirst(st, p));
    return h >= THIRST.leave ? `Parched: no drink for ${h} hours` : `Thirsty: no drink for ${h} hours`;
  }
  const KINDS = {
    // a drink at a source (the verb `drink`, sim/drinking, posts it for its pawn, j.pawn, on the tile it draws at): the walk there, the
    // drink; lived by, so the end of work does not take it from a pawn on its way
    drink: {
      verb: 'Drinking',
      go: 'Going to drink',
      name: 'Drink',
      at: ['water'],
      needs: [],
      gives: [],
      label: 'Drink',
      anim: 'draw',
      hours: THIRST.sip,
      hands: 1,
      type: 'household',
      vital: true,
      // by the curb of a well, else at the water's edge
      spot: (st, a, j) => {
        const w = st.w;
        return w.fresh[j.site] === FRESH.WELL
          ? [w.hx[j.site] - 10 + a.ox * 0.2, w.hy[j.site] + 8]
          : [w.hx[j.site] + a.ox * 0.2, w.hy[j.site] + 4];
      },
      // the pawn has drunk; what it does next (its household's fetch, from there) is sim/drinking's, told by 'drank'
      done: (st, j) => {
        drank(st, st.pawns[j.pawn], st.t, !!j.poor);
        emit(st, 'drank', j);
      },
    },
  };
  return { THIRST, KINDS, thirst, thirsty, drank, goes, dayEnd, loaded, line };
})();
