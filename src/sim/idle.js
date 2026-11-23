// @sys sim/idle: the pawn that found no work: it joins someone it likes who idles in the village, or drifts to the green or the yard (a
// herder waits by its herds), and looks again in a while (VB-245)
VB['sim/idle'] = (() => {
  const { next: rnd } = VB['sim/rng'];
  const { act } = VB['sim/traits'];
  const { workSpot } = VB['sim/agents'],
    { heldAt } = VB['sim/attention'];
  const { tileAt, placeOf } = VB['sim/pose'];
  const { companyFor } = VB['sim/relations'];
  const { issue } = VB['sim/commands'];
  // @tunable IDLE: how long an idle pawn waits before it looks for work again
  // An idle pawn the planner found no work looks again after wait[0] to wait[1] hours (VB-245; Kim, 10 Nov: 2 to 4, from 0.75 to 2). It hears of new
  // work meanwhile through the hourly refresh, looks again when its wait ends (a leg in sim/agents' queue, VB-473), and of an occasion by the asking.
  const IDLE = { wait: [4, 8] };
  // Nothing suitable: join someone it likes who idles in the village (sim/relations), or drift to the green or the yard; look again in a while.
  function idleAbout(st, a) {
    VB.count.idleStroll++;
    const bg = heldAt(a, 'background'),
      go = (tile, x, y) =>
        issue(st, { actor: a.id, verb: 'walkTo', target: tile, args: { x, y, near: true }, source: 'planner' });
    const mate = !bg && st.cenv ? companyFor(st, a) : null;
    // a herder waits by its herds, within reach of the pasture (VB-136)
    if (bg) {
      const [x, y] = workSpot(st, a, bg);
      go(bg.site, x + (rnd(st.rng.work) - 0.5) * 16, y + (rnd(st.rng.work) - 0.5) * 8);
    } else if (mate) {
      const [mx, my] = placeOf(st, mate); // where it is now, a walker along its leg (VB-473)
      go(tileAt(st, mx, my), mx + (rnd(st.rng.work) - 0.5) * 16, my + (rnd(st.rng.work) - 0.5) * 8);
    } else {
      const p = st.pawns[a.id],
        f = st.farmsteads[st.households[p.household].farmstead];
      const v = st.villages[f.village],
        spot = v.green && rnd(st.rng.work) < 0.5 ? v.center : f.house;
      go(spot, st.w.hx[spot] + (rnd(st.rng.work) - 0.5) * 26, st.w.hy[spot] + 6 + (rnd(st.rng.work) - 0.5) * 12);
    }
    issue(st, {
      actor: a.id,
      verb: 'idle',
      // IDLE.wait times 4/3 to 2/3 by diligence (the design's 4 to 2 hours about its 3; TRAITS.acts.diligence.idleWait, VB-520)
      args: {
        until:
          st.t +
          (IDLE.wait[0] + rnd(st.rng.work) * (IDLE.wait[1] - IDLE.wait[0])) * act(st, a.id, 'diligence', 'idleWait'),
      },
      source: 'planner',
    });
  }
  return { idleAbout };
})();
