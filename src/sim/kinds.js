// @sys sim/kinds: the registry of job kinds: it joins the records each domain module declares (KINDS), builds the fetch kinds and each role's
// ranks, and holds the order in which sim/jobs asks the kinds' rules (ASK). A kind's record lives with its domain (VB-418)
VB['sim/kinds'] = (() => {
  const { ROLES } = VB['sim/roles'],
    { doneOf } = VB['sim/progress'];
  const Fieldwork = VB['sim/fieldwork'],
    Chores = VB['sim/chores'],
    Meadows = VB['sim/meadows'],
    Byre = VB['sim/byre'],
    Expansion = VB['sim/expansion'],
    Farmclaims = VB['sim/farmclaims'],
    Building = VB['sim/building'],
    Green = VB['sim/green'],
    Workdays = VB['sim/workdays'],
    Commons = VB['sim/commons'],
    Lying = VB['sim/lying'],
    Drying = VB['sim/drying'],
    Carts = VB['sim/carts'];
  const { landProject } = VB['sim/projects'],
    { meadowWork } = Meadows,
    { byreWork } = Byre,
    { plotWork } = Expansion,
    { claimWork } = Farmclaims;
  // A kind's fields:
  //   verb, go, back: what the pawn panel says while working, walking there and carrying home; name: the job in the settlers panel;
  //   label: the job in the line that says why a pawn is idle; anim: the page's work animation; hours: work hours to finish;
  //   hands: how many pawns may work one job at once (VB-102: field, land and threshing work takes the whole household);
  //   type: the type of work, which roles rank (ROLES in sim/roles); field: worked row by row across the tile, at `pace` map units an hour;
  //   inside: worked in the house; carry: what is carried home when the work is done, to the cottage door, the woodpile or the barn (`to`);
  //   spot(st, a, j): where on the site the pawn stands; urgency(st, j, c, U): the job's weight in a bid (U is MATCH.urgency; 1 without it);
  //   done(st, j, hh, c): what finishing the work does; deliver(st, j, hh, f, a): what arriving home with a load does;
  //   load(st, a, j, cap): a trip's load from the field; again(j): the job stays open for the next (haul, VB-335);
  //   draw(st, j): the site of a job of the kind, drawn when it is first posted, in place of the site its rule names (VB-326: firewood);
  //   worked(st, j, dt, a, from): what dt hours of work by pawn a do besides the progress, run as the task is reckoned (from: its hours done
  //   before; VB-472); project: true for a stage of a land project, whose job ends with
  //   the project (sim/jobs drops it, its hands freed, once it is no longer posted);
  //   available(st, holder, at, c, post, f): where the kind could be done now (VB-208); it calls post(key, site, extra) for each job it
  //   would post. holder is the household (or the village), at the field, farm or village asked about, f the household's farm. sim/jobs'
  //   refreshJobs asks the rules in the order of ASK, below. A rule shared by the kinds a module posts together names each job's kind,
  //   post(key, site, extra, kind), and the owner of a job not the household's, post(key, site, extra, kind, owner). A kind posted by two
  //   rules names its household's: clear and break, also a plot's steps, and the cottage's stages, also a plot's (plotWork).
  //   stages: a field kind's, the field stages at which it can be available; refreshJobs asks it only at a field in one of them.
  //   window: a time-bound kind's (VB-249), {from: the hour of the day its work can first fall due}: the due-queue (sim/plans) asks it for
  //   each household from that hour, and again each hour while it gives work, so it waits for no review of the plan.
  //   attention: `full` (the default), `partial` (left and returned to within the hour) or `background` (done at the side, at `rate` of
  //   the pawn's hours, only within `reach` steps of the task's site); a pawn holds one task, and besides one partial and one background
  //   (VB-251; sim/agents; herd the first, VB-136); held(st, j, a, c): what taking it up does; worked(st, j, dt, null, from), as it is reckoned; minAge.
  //   late: a job of the kind under way, its worker walking there or at work, is finished after the end of work (VB-119: the cook).
  //   together: worked by all together (VB-120: a work day): a bid does not fall for the hands already at the job (MATCH.join, sim/jobs).
  // ---- the rules shared by the kinds a module posts together; each names its jobs' kinds ----
  // The village's common fields (VB-100): their kinds, as at a farm's fields, while its meeting chose the routine.
  function commonWork(st, v, at, c, post) {
    if (st.plans.villages.get(v.id).routines.includes('commons')) Commons.work(st, v, c, post, ASK.fieldAt);
  }
  // Every kind, in a fixed order: the order is part of saved state (st.plans.due holds an index into the windowed kinds, sim/plans) and of
  // the fetch kinds' and the ranks' order, so a new kind is added at the end, whatever its module.
  // The field's kinds, and for a common field the three whose end is the village's (sim/commons).
  const F = Commons.common(Fieldwork.KINDS);
  const KINDS = {
    plow: F.plow,
    sow: F.sow,
    reap: F.reap,
    haul: F.haul,
    wood: Chores.KINDS.wood,
    water: Chores.KINDS.water,
    cook: Chores.KINDS.cook,
    brew: Chores.KINDS.brew,
    weed: F.weed,
    thresh: F.thresh,
    clear: F.clear,
    break: F.break,
    meadow: Meadows.KINDS.meadow,
    reclaim: F.reclaim,
    restore: Farmclaims.KINDS.restore,
    rake: Meadows.KINDS.rake,
    mow: Meadows.KINDS.mow,
    hay: { ...Meadows.KINDS.hay, ...Carts.HAY }, // by the load: sim/carts imports sim/meadows, so the cart's part joins here
    fodder: Byre.KINDS.fodder,
    manure: F.manure,
    milk: Byre.KINDS.milk,
    slaughter: Byre.KINDS.slaughter,
    shear: Byre.KINDS.shear,
    salt: Byre.KINDS.salt,
    fell: Expansion.KINDS.fell,
    grub: Expansion.KINDS.grub,
    ...Building.KINDS, // the cottage's stages and the timber its walls take (sim/building)
    ...Green.KINDS, // the village green and well (sim/green, VB-058)
    ...Workdays.KINDS, // the village's work days (sim/workdays, VB-120)
    mend: Building.UPKEEP.mend,
    repair: Building.UPKEEP.repair,
    fish: Drying.KINDS.fish,
    gather: Chores.KINDS.gather,
  };
  KINDS.dig = VB['sim/dig'].KIND; // digging clay and bog iron (VB-359): its record is sim/dig's
  KINDS.herd = VB['sim/grazing'].KIND;
  KINDS.lead = VB['sim/exchange'].KIND;
  KINDS.drove = VB['sim/droving'].KIND; // animals that changed household led home from where they stand (VB-674)
  Object.assign(KINDS, VB['sim/quern'].KINDS); // grinding and hewing a quern (VB-009): their records are sim/quern's
  KINDS.hunt = VB['sim/deer'].KIND; // hunting roe deer (VB-139): its record is sim/deer's
  Object.assign(KINDS, Drying.KINDS, Carts.KINDS); // herding (VB-136); drying fish and the boat (VB-300): their modules'
  Object.assign(KINDS, VB['sim/tar'].KINDS); // the tar pit, burning tar, tarring the house and the boat (VB-301): sim/tar's
  // a load left lying where its carrier fell is fetched by its owner (VB-611): a fetch kind for each kind that carries a load (sim/lying)
  for (const [k, K] of Object.entries(KINDS))
    if (K.carry && (K.load || K.stack)) KINDS[Lying.fetchKey(k)] = Lying.fetchKind(k, K);
  // A job is open while it has work left and fewer workers than hands; a carried job whose work is done waits for its carrier.
  const isOpen = (st, j) =>
    j.claims.length < KINDS[j.kind].hands &&
    doneOf(st, j, j.hours ?? KINDS[j.kind].hours) < (j.hours ?? KINDS[j.kind].hours);
  // Each role's rank of every kind: its exception for the kind (a fetch kind's: the kind it fetches for, VB-611), else its rank of the
  // kind's type of work, else 0.
  for (const r of Object.values(ROLES))
    r.prio = Object.fromEntries(
      Object.entries(KINDS).map(([k, K]) => [k, r.except[k] ?? r.except[K.fetch] ?? r.work[K.type] ?? 0]),
    );
  // Where refreshJobs (sim/jobs) asks, in this order: for each occupied farm in turn, at each of its fields (field), at the farm (farm),
  // and at the farm again after the household's plans for land (farmAfterPlans); then at each village (village), then once for the island
  // (island). An entry is [kind, rule]: a kind's own rule posts that kind; a shared rule (kind null) names its jobs' kinds. A job's id is its
  // posting order and matching visits jobs by id, so this order is part of the behaviour: two jobs new in the same hour keep their order.
  // fieldAt: the field's rules by the field's stage (each kind's `stages`), in the order of `field`; refreshJobs asks only those.
  const rule = (k) => (typeof k === 'string' ? [k, KINDS[k].available] : [null, k]);
  const ASK = {
    field: ['plow', 'sow', 'weed', 'reap', 'haul', 'reclaim'].map(rule),
    farm: [meadowWork, 'manure', byreWork, 'herd'].map(rule),
    farmAfterPlans: [
      landProject,
      Building.boothWork,
      'wood',
      'thresh',
      'water',
      'cook',
      'brew',
      'mend',
      'repair',
      'fish',
      'gather',
      Building.stoneWork,
    ].map(rule),
    // the green's rule posts each of its kinds (sim/green); the work day's both (sim/workdays); the common fields' (sim/commons, VB-100) the
    // open step of the one under way and the field kinds of each one's stage, while the meeting chose them
    village: ['mend', 'green', 'workfence', commonWork].map(rule),
    island: [plotWork, claimWork, Building.stakedWork, Building.timberWork].map(rule),
    fieldAt: {},
  };
  // VB-359, VB-300, sim/carts (a boat or a cart is a project's step), VB-139 (hunting roe deer), VB-390 (a cow led home, sim/exchange)
  ASK.farmAfterPlans.push(
    rule('dig'),
    rule('rackfish'),
    rule('dry'),
    rule('mendcart'),
    rule('hunt'),
    rule('lead'),
    rule('drove'),
  );
  ASK.farmAfterPlans.push(rule('grind'), rule('hewQuern')); // the hand quern (VB-009, sim/quern)
  ASK.farmAfterPlans.push(rule('burntar'), rule('tarhouse'), rule('tarboat')); // tar (VB-301, sim/tar)
  (ASK.farmAfterPlans.push(rule(Lying.fetchWork)), ASK.village.push(rule(Lying.fetchWork))); // loads left lying (VB-611)
  for (const e of ASK.field) for (const g of KINDS[e[0]].stages) (ASK.fieldAt[g] ||= []).push(e);
  return { KINDS, ASK, isOpen };
})();
