// @sys sim/trails [material]: blazing a trail (VB-447): the verb blaze, its route through the wood and its plan of a job a wooded tile, worked by the
// blazer's household; each tile blazed becomes a path (sim/paths), a worn way kept only by being walked
VB['sim/trails'] = (() => {
  const { emit } = VB['sim/events'];
  const { register } = VB['sim/commands'];
  const { log, living, fullName, atFarm } = VB['sim/records'];
  const { PATHS, trailStep, unblazed } = VB['sim/walking'];
  const { findRoute } = VB['sim/routes'];
  const { blazeTile } = VB['sim/paths'];
  // A trail under way is its blazer's project plan (sim/projects, holder {type: 'pawn', id: the blazer}; as a staked booth is, VB-1172):
  //   {..., what: 'trail', from, to (the tiles it joins), steps: [{kind: 'blaze', place (a wooded tile of its route, in order from `from`),
  //   hours (PATHS.blaze.hours, or .again where the tile is still trodden)}]}. The blazer's household works it; the plan ends with its last
  //   tile, or is given up when the blazer dies or its household has no farm to go out from. Nothing of the trail is kept once blazed: its
  //   tiles are worn ways (w.wear, sim/paths), and fade as any do.
  // A pawn's trails under way (few: a pawn's plans are its booths, a restoration and its trail). Allocates nothing.
  function trailsEach(st, fn) {
    const P = st.plans && st.plans.projects;
    if (!P || !P.pawn.size) return;
    for (const list of P.pawn.values()) for (const plan of list) if (plan.what === 'trail') fn(plan);
  }
  function trailOf(st, id) {
    let out = null;
    trailsEach(st, (plan) => {
      if (out === null && plan.holder.id === id) out = plan;
    });
    return out;
  }
  // The steps of a trail from tile `from` to `to`: the route the trail would make (sim/routes findRoute by sim/walking trailStep, a wooded
  // tile at a path's cost, within ROUTE.reach), and a blaze step for each of its tiles still to blaze (unblazed: wood with no path), in
  // order from `from`; open ground is not blazed (it wears its own way). Null when there is no route by land; [] when no wood lies between.
  function trailSteps(st, from, to) {
    const w = st.w,
      route = findRoute(w, from, to, undefined, 0, trailStep);
    if (!route) return null;
    const steps = [];
    for (const i of route)
      if (unblazed(w, i))
        steps.push({ kind: 'blaze', place: i, hours: w.worn[i] >= 1 ? PATHS.blaze.again : PATHS.blaze.hours });
    return steps;
  }
  const tileWhy = (st, t, what) =>
    Number.isInteger(t) && t >= 0 && t < st.w.N ? null : `there is no tile ${t} to blaze ${what}`;
  // Why pawn `id` cannot blaze a trail from `from` to `to`, or null: it is grown, of a household with a farm to go out from (whose
  // hands do the work), has no trail under way, and wood with no path lies on the way the trail would take.
  function blazeWhy(st, id, from, to) {
    const p = st.pawns[id];
    if (p.age < 16) return `${fullName(p)} is not grown`;
    const hh = p.household === null ? null : st.households[p.household];
    if (!hh || hh.dissolved || hh.farmstead === null) return `${fullName(p)} has no farm to go out from`;
    if (trailOf(st, id)) return `${fullName(p)} is blazing a trail already`;
    const why = tileWhy(st, from, 'from') || tileWhy(st, to, 'to');
    if (why) return why;
    const steps = trailSteps(st, from, to);
    if (!steps) return `there is no way by land from tile ${from} to tile ${to}`;
    return steps.length ? null : `no wood lies on the way from tile ${from} to tile ${to}: it wears its own way`;
  }
  // blaze(null, {from, to}) (VB-447): any grown pawn's: it opens a trail from tile `from` to tile `to`, the cheapest route counted as the
  // trail would make it, each tile of wood on it a job of its household's, from `from` outward. A party's leader blazes to the site it
  // staked (VB-787); a village's trail is its alderman's, as a village duty (VB-1494). Taking no time, it may be ordered from
  // anywhere.
  register('blaze', {
    check: (st, c) =>
      living(st, c.actor) || (c.args ? blazeWhy(st, c.actor, c.args.from, c.args.to) : 'blaze names from and to'),
    run: (st, c) => {
      const { from, to } = c.args;
      emit(st, 'projectBegun', {
        type: 'pawn',
        id: c.actor,
        project: { what: 'trail', from, to, steps: trailSteps(st, from, to) },
      });
    },
  });
  // The trails' work, asked once for the island (Rules for cost, 1: the live plans only): for each, its open tile, owned by the blazer's
  // household. A trail whose blazer has died or has no farm to go out from is given up (nothing is left: the tiles blazed are paths).
  function trailWork(st, holder, at, c, post) {
    trailsEach(st, (plan) => {
      const p = st.pawns[plan.holder.id],
        hh = p.household === null ? null : st.households[p.household];
      if (p.died !== null || !hh || hh.dissolved || hh.farmstead === null) {
        emit(st, 'projectGivenUp', { plan });
        return;
      }
      const s = plan.steps[plan.open];
      post(`blaze:p${p.id}`, s.place, { trailOf: p.id, hours: s.hours }, 'blaze', { type: 'household', id: hh.id });
    });
  }
  // A tile blazed: it is a path (sim/paths blazeTile), and the trail's next tile opens; after its last, the trail is told.
  function blazed(st, j) {
    const plan = trailOf(st, j.trailOf);
    if (!plan || plan.steps[plan.open].place !== j.site) return;
    blazeTile(st, j.site);
    const last = plan.open === plan.steps.length - 1,
      p = st.pawns[plan.holder.id];
    emit(st, 'stepDone', { type: 'pawn', id: p.id, plan });
    if (!last || p.household === null) return;
    const f = st.farmsteads[st.households[p.household].farmstead];
    log(st, `${fullName(p)} of ${f.name} has blazed a trail of ${plan.steps.length} tiles through the wood.`, {
      kind: 'trail',
      pawn: p.id,
      ...atFarm(f),
    });
  }
  // The job kind (sim/kinds joins it; a kind's fields are described there). Two hands to a tile: one marks and cuts, one clears.
  const atSite = (st, a, j) => [st.w.hx[j.site] + a.ox * 0.4, st.w.hy[j.site] + a.oy * 0.3];
  const KINDS = {
    blaze: {
      verb: 'Blazing a trail',
      go: 'Going to blaze the trail',
      name: 'Blaze a trail',
      at: ['woods'],
      needs: [],
      gives: ['trail'],
      label: 'Trail',
      anim: 'chop',
      hours: PATHS.blaze.hours,
      hands: 2,
      type: 'wood',
      project: true, // a trail given up takes its job with it, its hands freed (sim/jobs)
      spot: atSite,
      done: (st, j) => blazed(st, j),
      available: trailWork,
    },
  };
  return { KINDS, trailSteps, trailOf, trailWork };
})();
