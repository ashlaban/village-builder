// @sys sim/projectplans: the project plans' one writer (VB-123; design.md section 7): a project plan made with what its steps spend
// reserved, its open step advanced as done, reviewed when a store or a right of its holder changes, handed on, and dropped (its timber
// left where it was carried); their record and reads are sim/projects'
VB['sim/projectplans'] = (() => {
  const { TRAVEL } = VB['sim/rules'];
  const Stores = VB['sim/stores'];
  const Projects = VB['sim/projects'],
    { on, emit } = VB['sim/events'],
    { log } = VB['sim/records'];
  const { issue } = VB['sim/commands'];
  const Lying = VB['sim/lying'];
  const { projectsOf, holderOf } = Projects;
  function remove(st, plan) {
    const map = st.plans.projects[plan.holder.type],
      list = map.get(plan.holder.id) || [],
      i = list.indexOf(plan);
    if (i >= 0) list.splice(i, 1);
    if (!list.length) map.delete(plan.holder.id);
    const k = st.plans.projects.heirPlots.indexOf(plan);
    if (k >= 0) st.plans.projects.heirPlots.splice(k, 1);
  }
  // Whether household id's plan of `what` with `steps` would open a step of a kind another of its plans posted by sim/projects'
  // landProject (not a plot's nor a cottage's) has: then it is marked `side` and its jobs are keyed apart by its id (VB-1651, VB-1668).
  // A household with one such plan at a time, or plans of kinds of their own, keeps its keys. A few plans of a few steps.
  const posted = (what) => what !== 'plot' && what !== 'cottage';
  function besideKind(st, id, what, steps) {
    if (!posted(what)) return false;
    for (const p of projectsOf(st, 'household', id))
      if (posted(p.what) && p.steps.some((x) => steps.some((s) => s.kind === x.kind))) return true;
    return false;
  }
  // A project plan for holder {type, id}, from {what, steps, hold, ...its own fields} (sim/fields' fieldProject, sim/meadows', a plot): what
  // its steps spend is reserved from the holder's free stock (null, and no plan, when another plan holds it), `hold` kept back for after it.
  function makeProject(st, type, id, { what, steps, hold = null, ...own }) {
    const holder = holderOf(st, { type, id }),
      P = st.plans.projects,
      spend = {},
      side = type === 'household' && !own.side && besideKind(st, id, what, steps);
    const plan = {
      id: ++st.plans.projectSeq,
      holder: { type, id },
      kind: 'project',
      what,
      ...own,
      ...(side ? { side: true } : {}),
      steps,
      open: 0,
      reserved: {},
      reasons: {},
    };
    if (!P[type].has(id)) P[type].set(id, []);
    P[type].get(id).push(plan);
    if (type === 'household' && what === 'plot') P.heirPlots.push(plan);
    for (const s of steps) for (const good in s.spends || {}) spend[good] = (spend[good] || 0) + s.spends[good];
    for (const good in spend)
      if (!Stores.reserve(st, holder, plan, good, spend[good], 'build')) {
        dropProject(st, plan);
        return null;
      }
    for (const good in hold || {}) Stores.reserve(st, holder, plan, good, hold[good], 'field');
    return plan;
  }
  // The open step done: what it spends taken from the store with its reservation, the next step open; after the last, the plan finished.
  function advance(st, plan) {
    const s = plan.steps[plan.open],
      holder = holderOf(st, plan.holder);
    for (const good in s.spends || {}) {
      const left = plan.reserved[good] - s.spends[good];
      if (left > 1e-9) Stores.reserve(st, holder, plan, good, left, 'build');
      else Stores.release(st, holder, plan, good, 'build');
      Stores.take(st, holder, good, s.spends[good], 'build');
    }
    if (++plan.open >= plan.steps.length) {
      Stores.releaseAll(plan);
      remove(st, plan);
    }
  }
  // The plan is given up: its reservations released, the plan removed, and `text` told as a notable event when given.
  function dropProject(st, plan, text = null, at = {}) {
    Stores.releaseAll(plan);
    remove(st, plan);
    leftWood(st, plan);
    if (text) log(st, text, { kind: 'projectDropped', ...at });
    emit(st, 'planDropped', { plan }); // a head's aim on it ends at once (sim/aims, VB-1224), not at its next review
  }
  // Timber carried to a step at its household's house and not yet built in (a barn's walls, a cart's: VB-255) goes onto that farm's
  // woodpile as the plan is dropped: the farmstead is one place, so nothing is carried, and nothing vanishes. Only the dropped plan's own
  // steps are read: the wood of a plan beside it (a cart beside a barn, VB-1414) stays at its own step.
  function leftWood(st, plan) {
    if (plan.holder.type !== 'household') return;
    const hh = st.households[plan.holder.id],
      f = hh.farmstead === null ? null : st.farmsteads[hh.farmstead];
    for (let i = plan.open; i < plan.steps.length && f; i++) {
      const s = plan.steps[i];
      if (s.place === f.house && s.wood > 0) Stores.put(st, hh, 'wood', s.wood, 'timber');
      // timber carried to a boat's shore (VB-300) lies there, for its household to fetch home or for the frost (sim/lying; VB-645)
      else if (s.wood > 0)
        Lying.leave(st, 'leftTimber', (s.wood / st.ECON.woodPerTrip) * TRAVEL.load, s.place, plan.holder);
    }
  }
  // Why the plan's open step is no longer possible, or null: its holder is gone; the claim it works under is lost (contested away, lapsed;
  // st.claims read as sim/claims keeps it); the holder's stock no longer covers what its steps will spend (the reserved good lost).
  function impossible(st, plan) {
    const h = holderOf(st, plan.holder),
      s = plan.steps[plan.open],
      by = plan.holder;
    if (!h || h.dissolved || (by.type === 'pawn' && !h.alive)) return 'its holder is gone';
    const c = s.stake && (st.claims.get(s.place) || []).find((x) => x.by.type === by.type && x.by.id === by.id);
    if (s.stake && (!c || c.why !== s.stake)) return 'its claim on the land is lost';
    for (const good in plan.reasons)
      if (plan.reasons[good] === 'build' && plan.reserved[good] > (h[good] || 0) + 1e-9) return `its ${good} is gone`;
    return null;
  }
  // How a plan dropped for `why` is told: [text, the event's place].
  function dropWords(st, plan, why) {
    const h = holderOf(st, plan.holder),
      house = plan.holder.type === 'household',
      f = house ? st.farmsteads[h.farmstead] : null;
    const text = `${house ? f.name : h.name} gives up its ${plan.what === 'meadow' ? 'new hay meadow' : 'new ' + plan.what}: ${why}.`;
    return [text, house ? { household: h.id, farm: f.id, village: f.village } : { [plan.holder.type]: plan.holder.id }];
  }
  // The plan reviewed at once when a store or a right of its holder changed: while its step is possible it stands; else it is dropped and
  // told, in its own words (dropWords), in `text` and `at` given by the change, or not at all when `told`. True when it stands.
  function review(st, plan, told = false, text = null, at = null) {
    const why = impossible(st, plan);
    if (!why) return true;
    if (!told && !text) [text, at] = dropWords(st, plan, why);
    dropProject(st, plan, told ? null : text, at || {});
    return false;
  }
  // Every plan of a holder that ends (a household dissolved), without a word: the end of its holder is told.
  // A household's plot for its heir is not dropped but passes to its village (the verb plotToVillage; VB-255), its tiles and work with it;
  // its cottage (settlers, sim/settle) passes to its village too, kept with the farm for the household that comes (makePlan; VB-1411).
  const dropAll = (st, type, id) => {
    for (const plan of [...projectsOf(st, type, id)])
      if (plan.what === 'cottage')
        emit(st, 'projectHanded', { plan, type: 'village', id: st.farmsteads[plan.farmstead].village });
      else if (plan.what === 'plot' && type === 'household')
        issue(st, {
          actor: null,
          verb: 'plotToVillage',
          target: id,
          args: { plan: plan.id, why: 'the household is no more' },
          source: 'construction',
        });
      else dropProject(st, plan);
  };
  // A claim lost on a tile (sim/stakes; -1: all; `told`, or `text` and `at`); a store short (sim/stores); a step done (sim/fields,
  // sim/meadows, sim/expansion, sim/cottage: `plan` names it when the holder has several); a plot begun (sim/expansion).
  on('rightLost', (st, d) => {
    for (const plan of [...projectsOf(st, d.type, d.id)]) {
      if (d.tile < 0 || plan.steps.some((s) => s.place === d.tile))
        review(st, plan, !!d.told, d.text || null, d.at || null);
    }
  });
  on('storeShort', (st, d) => {
    for (const plan of [...projectsOf(st, d.type, d.id)]) if (plan.reasons[d.good] === 'build') review(st, plan);
  });
  on('stepDone', (st, d) => {
    if (d.plan) advance(st, d.plan); // every emitter names its plan
  });
  on('projectBegun', (st, d) => {
    makeProject(st, d.type, d.id, d.project);
  });
  // A plan passes to another holder (sim/expansion: a household's plot for its heir, to its village; VB-255), its steps and work with it.
  on('projectHanded', (st, d) => {
    const P = st.plans.projects,
      plan = d.plan;
    remove(st, plan);
    plan.holder = { type: d.type, id: d.id };
    if (!P[d.type].has(d.id)) P[d.type].set(d.id, []);
    P[d.type].get(d.id).push(plan);
  });
  // A village gives up a cleared plot nobody came for (sim/expansion, VB-646): the plan goes, its reservations released.
  on('plotReleased', (st, d) => dropProject(st, d.plan));
  // A plan given up by its holder's own verb or rule (sim/building: a booth staked and not raised, VB-1172), `text` told when given.
  on('projectGivenUp', (st, d) => dropProject(st, d.plan, d.text || null, d.at || {}));
  return { makeProject, advance, drop: dropProject, review, dropAll, impossible, dropWords };
})();
