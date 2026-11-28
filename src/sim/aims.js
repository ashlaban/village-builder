// @sys sim/aims: a head's projects (design.md section 7, How a holder chooses: projects; VB-255): layer 3 of how a holder chooses. Once a
// year, at its first review after the autumn count, a head whose plan's targets are met, whose store holds food beyond the year's need
// and the seed and whose hands stood idle over a third of the last season has a surplus, and takes one project from a menu weighed by its
// values: a field beyond those it needs, a claim on land (a new hay meadow), a farm for its heir, a storehouse, a barn; dropped when the surplus is gone
// a whole season. And once a year the head weighs each small construction (a boat, a cart, a tar pit) by its making's own test (VB-678);
// all of them begun through the verb project, which the played head has as any head
VB['sim/aims'] = (() => {
  const { targetOf } = VB['sim/steps'];
  const { barnSteps } = VB['sim/building'];
  const { emit } = VB['sim/events'];
  const { HERD, DAY, SEASON_DAYS, YEAR_DAYS, WORK, MARRIAGE, BUILD, cal } = VB['sim/rules'];
  const { next: rnd } = VB['sim/rng'];
  const Traits = VB['sim/traits'];
  const Projects = VB['sim/projects'];
  const { declare, looks, makingOf } = VB['sim/makings'];
  const Stores = VB['sim/stores'];
  const { on } = VB['sim/events'];
  const { log, personEvent, fullName, atHousehold, isHolder } = VB['sim/records'];
  const { dailyNeed } = VB['sim/hunger'],
    { hayLoss } = VB['sim/byre'],
    { storehouseWhy, grainLoss } = VB['sim/storehouse'],
    { larderOf } = VB['sim/larder'];
  const { winterNeed } = VB['sim/herds'];
  const { pickField, freesFields } = VB['sim/fieldplans'];
  const { pickMeadow } = VB['sim/meadows'];
  const { findSite } = VB['sim/expansion'],
    { hasPlot, awaitsCottage } = VB['sim/allotment'];
  const { issue, register } = VB['sim/commands'];
  const Plans = VB['sim/plans'],
    ProjectPlans = VB['sim/projectplans'],
    Seasonal = VB['sim/seasonal'];
  const { heirRanking } = VB['sim/heirranking'];
  const { CROPS, ROTATIONS } = VB['sim/crops'];
  const { tierOf, turnWhy } = VB['sim/rotations'];
  // The surplus (design.md section 7, How a holder chooses: projects; the first values of VB-255's criteria): food beyond `years` of the
  // household's need over the seed held back (the means to marry's measure, MARRIAGE.means, is the first value), and its hands idle over
  // `idle` of their work hours in the last season. The weights of the menu: `base` for each option, `heirs` for the heir's farm when two or
  // more would inherit (so that one would be left without the home farm); each times the head's lean (choose). An outbuilding that keeps a
  // store (VB-1898: the storehouse the grain, the barn the hay) weighs `base` times what it would save a year (rations, or units of hay)
  // over `keep` times its hours of work, at most `outbuilding` (a cap of its own, so that no store's saving outweighs the rest of the menu
  // by more); none while it would save nothing (Proposed, VB-1898: a ration or a unit of hay saved a year for each hour of building weighs
  // as any other option).
  const AIMS = Object.freeze({
    keep: 1,
    outbuilding: 2,
    years: MARRIAGE.means,
    idle: 1 / 3,
    base: 1,
    heirs: 2,
    hands: VB['sim/rules'].AGES.hands,
  });
  const KIND = Object.freeze(['field', 'claim', 'heir', 'storehouse', 'barn', 'trial']);
  const Targets = VB['sim/targets'];
  // @state plan.aim (a household's standing plan; VB-255): absent until its first review after an autumn count, then {year (the year of cal
  //   of its last yearly look at the surplus), surplus (what that look, or the last one after a project ended, found), again (true when a
  //   project of the head's ended: it looks again at its next review), project (the id of the head's project plan under way, or null), what
  //   (its kind of KIND, or null), since (game hours: when it was taken, or null), shortSince (game hours since the food has stood under the
  //   surplus while it is under way, or null), trial (absent, or the crop of a trial taken: VB-351; it has no project plan, and ends when
  //   a field is sown with the crop out of turn, or the seed is gone), fair (absent, or the rations of dried fish beyond its household's year
  //   that the head took for the fair at its last yearly look: VB-644, no project plan; sim/seasonal's goodTargets adds it to the target)}.
  //   Written only here.
  // The household's working hands: members alive, of AIMS.hands' ages, not retired (as sim/agents counts their work: household.workHours).
  function handsOf(st, hh) {
    let n = 0;
    for (const id of hh.members) {
      const p = st.pawns[id];
      if (p.alive && !p.retired && p.age >= AIMS.hands[0] && p.age < AIMS.hands[1]) n++;
    }
    return n;
  }
  // The share of the last season's work hours the household's hands stood idle (1 with none counted; 0 with no hands): read from the
  // count sim/agents keeps as their work is reckoned (household.workHours), not from the record.
  function idleShare(st, hh, c) {
    const hands = handsOf(st, hh);
    if (!hands) return 0;
    const key = c.year * 4 + c.season,
      W = hh.workHours,
      last = !W ? 0 : W[0] === key ? W[2] : W[0] === key - 1 ? W[1] : 0;
    return Math.max(0, 1 - last / (hands * (WORK[1] - WORK[0]) * SEASON_DAYS));
  }
  // Food held beyond the seed (the store, the sheaves, the meals and the larder less the grain reserved), against AIMS.years of need.
  function foodSpare(st, hh) {
    const store = Stores.grainOf(hh) + hh.meals + hh.unthreshed.reduce((a, x) => a + (+x || 0), 0) + larderOf(hh);
    return store - Stores.reserved(st, hh, 'grain') - AIMS.years * YEAR_DAYS * dailyNeed(st, hh);
  }
  // Every target of the plan met now: the fields it wants, the woodpile's goal of the season, the hay for its herds' winters; the stores
  // against the head's reserve (the template's targets times its bias), not what its horizon adds to lay in before the season's end
  // (targets.ahead, VB-254): a far-seeing head lays that in from what it has, and a capable head reaches a surplus more often (design.md
  // section 7, projects).
  function targetsMet(st, plan, hh, f, c) {
    const W = targetOf(plan, 'wood'),
      H = targetOf(plan, 'hay'),
      A = W.ahead;
    if (
      f.fields.length < targetOf(plan, 'fields').level ||
      hh.wood < W.seasons[c.season] - (A.season === c.season ? A.wood : 0)
    )
      return false;
    return !hh.herds.length || hh.hay >= (H.level - H.ahead) * winterNeed(st, hh);
  }
  // Does the household have a surplus now ({met, food, idle}: each part, and all).
  function surplusOf(st, plan, hh, f, c) {
    const met = targetsMet(st, plan, hh, f, c),
      food = foodSpare(st, hh) >= 0,
      idle = idleShare(st, hh, c) > AIMS.idle;
    return { met, food, idle, all: met && food && idle };
  }
  // The heir a farm would be built for: an adult of the household at home, holding no farm nor to have a plot, among those the custom of
  // inheritance ranks, past the first (who has the home farm) when two or more are ranked; null for none. With the ranking's length.
  function heirOf(st, hh) {
    const ranking = heirRanking(st, hh),
      from = ranking.length >= 2 ? 1 : 0;
    for (let i = from; i < ranking.length; i++) {
      const id = ranking[i],
        p = st.pawns[id];
      if (
        p.alive &&
        p.age >= 18 &&
        p.household === hh.id &&
        !isHolder(st, id) &&
        !hasPlot(st, id) &&
        !awaitsCottage(st, id)
      )
        return [id, ranking.length];
    }
    return [null, ranking.length];
  }
  // The weight of an outbuilding that keeps a store (VB-1898): what `day` (the store's loss today without it, by the doing's own
  // reckoning: sim/storehouse grainLoss, sim/byre hayLoss) comes to a year, times the share it saves (1 − B.loss), against B's hours (AIMS.keep).
  const keepWeight = (day, B) =>
    Math.min(
      AIMS.outbuilding,
      (AIMS.base * day * YEAR_DAYS * (1 - B.loss)) / (AIMS.keep * B.hours.reduce((a, h) => a + h, 0)),
    );
  // The menu: the options open to the household now, each {what, weight, tile | heir}, computed for the holder (never stored). Only for a
  // holder with a surplus and no project (VB.count.aimMenu).
  function menu(st, plan, hh, f) {
    VB.count.aimMenu++;
    const head = hh.holder,
      ambition = 1 + Traits.of(st, head, 'ambition'),
      generosity = 1 + Traits.of(st, head, 'generosity'),
      T = targetOf(plan, 'fields'),
      out = [];
    // a field beyond the target, unless the head counts on its other sources for a field's food already (VB-768): it would let it go again
    if (f.fields.length >= T.level && f.fields.length < T.workable && !freesFields(st, plan, hh)) {
      const tile = pickField(st, f, hh);
      if (tile >= 0) out.push({ what: 'field', weight: AIMS.base * ambition, tile });
    }
    const meadow = pickMeadow(st, f, hh);
    if (meadow >= 0) out.push({ what: 'claim', weight: AIMS.base * ambition, tile: meadow });
    const [heir, ranked] = heirOf(st, hh);
    if (heir !== null) {
      VB.count.aimMenu++; // a search of the village's reach for a site (findSite), counted with the menus
      if (findSite(st, st.villages[f.village], false))
        out.push({ what: 'heir', weight: (ranked >= 2 ? AIMS.heirs : AIMS.base) * generosity, heir });
    }
    // the storehouse by the grain it would save, the barn by the hay (VB-1898): a farm that leans on crops builds the one first, a farm
    // that leans on animals the other; each under its own check
    if (storehouseWhy(st, hh) === null) {
      const w = keepWeight(grainLoss(st, hh, dailyNeed(st, hh) * YEAR_DAYS), BUILD.storehouse);
      if (w > 0) out.push({ what: 'storehouse', weight: w });
    }
    if (barnWhy(st, hh) === null) {
      const w = keepWeight(hayLoss(st, hh), BUILD.barn);
      if (w > 0) out.push({ what: 'barn', weight: w });
    }
    const crop = trialCrop(st, plan, hh, f);
    if (crop) out.push({ what: 'trial', weight: AIMS.base * ambition, crop });
    // dried fish for the fair (VB-644): in a village by fishing water, rations beyond the household's year that its spare hands can fish and
    // hang and a back load carries; no project plan, a target (VB-698), weighed by the head's lean as the asks' reckoning is (VB-699)
    const n = fairDried(st, hh, f);
    if (n > 0) out.push({ what: 'fair', weight: AIMS.base * (plan.head ? plan.head.bias.hours : 1), n });
    return out;
  }
  // The rations of dried fish beyond its year that household hh can make for the fair: what its spare hands bring (sim/targets' bound), within
  // a back load (sim/asks' carried); 0 where its village does not fish.
  function fairDried(st, hh, f) {
    if (!VB['sim/drying'].villageFishes(st, st.villages[f.village])) return 0;
    const M = Targets.MADE.get('dried fish'),
      most = M.most(st, hh, f, Targets.hands(st, hh) * Targets.TARGET.spareHours);
    return Math.floor(Math.min(most, VB['sim/asks'].carried('dried fish')));
  }
  // A trial (VB-351; design.md, How the head chooses what to sow: a trial is a project): a good head (sim/rotations' tierOf) whose store
  // holds a field's seed of a crop its farm's rotation does not grow tries it on one field; the first such crop of CROPS, or null.
  function trialCrop(st, plan, hh, f) {
    if (!f.fields.length || tierOf(Seasonal.headSkill(st, hh.id)) !== 'good') return null;
    const R = ROTATIONS[f.fields[0].rotation].courses;
    for (const k in CROPS) if (CROPS[k].seed > 0 && !R.includes(k) && Stores.grainOf(hh, k) >= CROPS[k].seed) return k;
    return null;
  }
  // The trial carried out at a review in its crop's window: a free field, a fallow one first, sown with it out of turn (the verb
  // sowOutOfTurn, its checks turnWhy); true once sown or given up (the seed eaten), and told.
  function tryCrop(st, hh, f, A, c) {
    const k = A.trial;
    if (Stores.grainOf(hh, k) < CROPS[k].seed) {
      tell(st, hh, 'projectDropped', `${f.name} gives up its trial of ${k}: the seed is gone.`);
      return true;
    }
    const fields = [...f.fields].sort((x, y) => (CROPS[y.crop].fallow ? 1 : 0) - (CROPS[x.crop].fallow ? 1 : 0)),
      fd = fields.find((q) => turnWhy(st, f, hh, q.tile, k, c) === null && !q.turn);
    if (!fd) return false;
    const done =
      issue(st, {
        actor: hh.holder,
        verb: 'sowOutOfTurn',
        target: hh.id,
        args: { tile: fd.tile, crop: k },
        source: 'pawn',
      }) === true;
    if (done) tell(st, hh, 'projectDone', `${f.name} tries ${k} on a field.`);
    return done;
  }
  // One option of the menu, by one draw from the stream `plans` over their weights; null for an empty menu.
  function choose(st, options) {
    if (!options.length) return null;
    let total = 0;
    for (const o of options) total += o.weight;
    let u = rnd(st.rng.plans) * total;
    for (const o of options) if ((u -= o.weight) < 0) return o;
    return options[options.length - 1];
  }
  // The option begun by the head through the verb project (the player's verb as the head's rule's: source 'pawn'; VB-678): true when a
  // project began.
  const ARGS = {
    field: (o) => ({ what: 'field', tile: o.tile }),
    claim: (o) => ({ what: 'meadow', tile: o.tile }),
    heir: (o) => ({ what: 'heirFarm', heir: o.heir }),
    storehouse: () => ({ what: 'storehouse' }),
    barn: () => ({ what: 'barn' }),
  };
  function begin(st, hh, o) {
    if (o.what === 'trial') return true; // no plan: carried out at its window (tryCrop)
    return (
      issue(st, { actor: hh.holder, verb: 'project', target: hh.id, args: ARGS[o.what](o), source: 'pawn' }) === true
    );
  }
  const TAKEN = {
    field: () => 'break a new field',
    claim: () => 'take in a new hay meadow',
    heir: (st, p) => `build a farm for ${fullName(st.pawns[p.intended])}`,
    storehouse: () => 'build a storehouse',
    barn: () => 'build a barn',
    trial: (st, p, o) => `try ${o.crop} on a field`,
  };
  const DONE = {
    field: 'a new field',
    claim: 'a new hay meadow',
    heir: 'a new farm for its heir',
    storehouse: 'a new storehouse',
    barn: 'a new barn',
  };
  // A notable event of the head and its household: a project taken or finished.
  function tell(st, hh, kind, text) {
    personEvent(st, hh.holder, kind, text, false); // recorded below
    log(st, text, { kind, pawn: hh.holder, ...atHousehold(st, hh) });
  }
  function aimOf(plan) {
    if (!plan.aim)
      plan.aim = { year: null, surplus: false, again: false, project: null, what: null, since: null, shortSince: null };
    return plan.aim;
  }
  // The head's project under way, by its id, or null.
  const underWay = (st, hh, A) => Projects.projectsOf(st, 'household', hh.id).find((p) => p.id === A.project) || null;
  // The project given up: its surplus gone a whole season. Its stakes go with it (sim/claims), as when a head gives one up (sim/plans).
  // A plot for the heir is not dropped but passes to the village, its tiles and work with it (the verb plotToVillage, VB-255).
  function giveUp(st, hh, f, A, p) {
    const text = `${f.name} gives up building ${DONE[A.what]}: its surplus is gone.`;
    personEvent(st, hh.holder, 'projectDropped', text, false); // recorded below
    if (p.what === 'plot') {
      log(st, text, { kind: 'projectDropped', pawn: hh.holder, ...atHousehold(st, hh) });
      issue(st, {
        actor: hh.holder !== null ? hh.holder : { household: hh.id }, // its head gives it up (VB-681)
        verb: 'plotToVillage',
        target: hh.id,
        args: { plan: p.id, why: 'its surplus is gone' },
        source: 'pawn',
      });
    } else {
      A.project = A.what = A.since = A.shortSince = null; // given up, not ended: planDropped below leaves `again` as it is
      for (const s of p.steps) if (s.stake) VB['sim/claims'].dropClaim(st, s.place, p.holder);
      ProjectPlans.drop(st, p, text, { pawn: hh.holder, ...atHousehold(st, hh) });
    }
    A.project = A.what = A.since = A.shortSince = null;
  }
  // At each review of a household's plan (sim/plans' event planReviewed): a project of the head's under way is watched for its surplus;
  // at the first review after the autumn count, or after a project ended, the head looks at its surplus and, with one, no project and no
  // hold on projects (VB-253), takes one.
  function reviewed(st, plan, c) {
    const hh = st.households[plan.holder.id],
      f = hh.farmstead === null ? null : st.farmsteads[hh.farmstead];
    if (!f || f.household !== hh.id || hh.holder === null || hh.holder === undefined) return;
    weigh(st, plan, hh, f, c);
    const A = plan.aim;
    if (A && A.trial) {
      if (tryCrop(st, hh, f, A, c)) {
        delete A.trial;
        A.what = A.since = null;
        A.again = true;
      }
      return;
    }
    if (A && A.project !== null) {
      const p = underWay(st, hh, A);
      if (!p) {
        A.project = A.what = A.since = A.shortSince = null; // dropped as impossible, or given up by the head (told there)
        A.again = true;
        return;
      }
      if (foodSpare(st, hh) >= 0) A.shortSince = null;
      else if (A.shortSince === null) A.shortSince = st.t;
      else if (st.t - A.shortSince >= SEASON_DAYS * DAY) giveUp(st, hh, f, A, p);
      return;
    }
    const yearly = c.doy >= HERD.countDay && (!A || A.year !== c.year);
    if (!yearly && !(A && A.again)) return;
    const B = aimOf(plan);
    if (yearly) B.year = c.year;
    B.again = false;
    B.surplus = surplusOf(st, plan, hh, f, c).all;
    if (yearly && B.fair) {
      delete B.fair; // each year's look takes the head's fair project again or lets it go
      Seasonal.goodTargets(st, plan, hh);
    }
    // the head's prudence, its own choice and not a refusal (VB-1668): its yearly look begins a large project only with none under way
    if (!B.surplus || Projects.ownOf(st, hh.id) || Projects.heldOff(st, hh.id)) return;
    const o = choose(st, menu(st, plan, hh, f));
    if (o && o.what === 'fair') {
      B.fair = o.n;
      Seasonal.goodTargets(st, plan, hh);
      tell(
        st,
        hh,
        'projectTaken',
        `${fullName(st.pawns[hh.holder])} of ${f.name} sets out to dry ${o.n} rations of fish for the fair.`,
      );
      return;
    }
    if (!o || !begin(st, hh, o)) return;
    if (o.what === 'trial') {
      Object.assign(B, { trial: o.crop, what: 'trial', since: st.t });
      tell(
        st,
        hh,
        'projectTaken',
        `${fullName(st.pawns[hh.holder])} of ${f.name} sets out to ${TAKEN.trial(st, null, o)}.`,
      );
      return;
    }
    const p = Projects.ownOf(st, hh.id);
    if (!p) return;
    B.project = p.id;
    B.what = o.what;
    B.since = st.t;
    B.shortSince = null;
    tell(st, hh, 'projectTaken', `${fullName(st.pawns[hh.holder])} of ${f.name} sets out to ${TAKEN[o.what](st, p)}.`);
  }
  on('planReviewed', (st, d) => reviewed(st, d.plan, d.c));
  // @state plan.weighed (VB-678): absent until the head's first yearly look at a making, then {[what]: the year of cal of its last look},
  //   for the makings with a look (sim/makings: a boat, a cart, a tar pit). Written only here.
  // The head's yearly look at the small constructions (VB-678; no project by the calendar): at its first review on or after each making's
  // `from` in a year, a head that does not hold off projects and may begin one (none under way) asks the making's own `want`, and begins
  // it through the verb project with the args it gives. Each a review: a comparison of the day a making.
  function weigh(st, plan, hh, f, c) {
    if (Projects.heldOff(st, hh.id)) return;
    for (const M of looks()) {
      if (c.doy < M.look.from || (plan.weighed && plan.weighed[M.what] === c.year)) continue;
      (plan.weighed || (plan.weighed = {}))[M.what] = c.year;
      lookAt(st, hh, f, M, c);
    }
  }
  // The head's look at the making M now: when it may begin one, the making's want, and the verb with the args it gives; true when begun.
  function lookAt(st, hh, f, M, c) {
    if (!Projects.mayBegin(st, hh, M.what)) return false;
    const args = M.look.want(st, hh, f, c);
    if (!args) return false;
    return (
      issue(st, {
        actor: hh.holder,
        verb: 'project',
        target: hh.id,
        args: { ...args, what: M.what },
        source: 'pawn',
      }) === true
    );
  }
  // The look at making `what` of household hh's head now, out of its yearly turn, or with hh omitted of every head holding its farm, in
  // the order of the villages' farms (the tests' starter): the households that began one.
  function lookNow(st, what, hh) {
    const M = makingOf(what),
      c = cal(st.t),
      out = [];
    for (const v of hh ? [null] : st.villages)
      for (const id of hh ? [hh.farmstead] : v.farmsteads) {
        const f = st.farmsteads[id],
          h = hh || (f.household === null ? null : st.households[f.household]);
        if (h && !h.dissolved && h.holder !== null && h.holder !== undefined && f.household === h.id)
          if (lookAt(st, h, f, M, c)) out.push(h);
      }
    return out;
  }

  // A step of a household's project done (after sim/plans has advanced it): the head's project finished is told, and the head looks
  // again at its next review.
  on('stepDone', (st, d) => {
    if (d.type !== 'household') return;
    const plan = st.plans.households.get(d.id),
      A = plan && plan.aim;
    if (!A || A.project === null) return;
    const hh = st.households[d.id];
    if (underWay(st, hh, A)) return;
    const f = st.farmsteads[hh.farmstead];
    if (hh.holder !== null && hh.holder !== undefined) tell(st, hh, 'projectDone', `${f.name} has ${DONE[A.what]}.`);
    A.project = A.what = A.since = A.shortSince = null;
    A.again = true;
  });
  // The head's project dropped by another rule (a stake lapsed, its goods short: sim/plans' dropProject; VB-1224): the aim ends at once, as
  // its next review would end it, so that a household that reviews no plan meanwhile (its farm held in trust) keeps no aim on a plan gone.
  on('planDropped', (st, d) => {
    if (d.plan.holder.type !== 'household') return;
    const plan = st.plans.households.get(d.plan.holder.id),
      A = plan && plan.aim;
    if (!A || A.project !== d.plan.id) return;
    A.project = A.what = A.since = A.shortSince = null;
    A.again = true;
  });
  // A household's plot for its heir passed to its village (sim/expansion): the head's project is over, and it looks again.
  on('projectHanded', (st, d) => {
    const plan = d.plan.by !== undefined ? st.plans.households.get(d.plan.by) : null,
      A = plan && plan.aim;
    if (!A || A.project !== d.plan.id) return;
    A.project = A.what = A.since = A.shortSince = null;
    A.again = true;
  });
  // Why household hh may not begin a barn now, or null (the verb barn): a farm of its own with none, no booth, none under way, a village
  // wood to fell its timber in; beside any other project (VB-1668).
  function barnWhy(st, hh) {
    const f = hh.farmstead === null ? null : st.farmsteads[hh.farmstead];
    if (!f || f.household !== hh.id) return `the household has no farm of its own`;
    if (f.barn) return `${f.name} has a barn`;
    if (f.booth) return `${f.name} has no cottage yet`;
    if (!st.villages[f.village].wood.length) return `${st.villages[f.village].name} has no wood to fell its timber in`;
    return Projects.underWay(st, hh.id, 'barn') ? `the household has a barn under way` : null;
  }
  // Why household hh may not begin a farm for pawn `heir` now, or null (the verb heirFarm): an adult of the household with no farm nor
  // plot (one under way counts: hasPlot); beside any other project (VB-1668; the site is the plot's to find).
  function heirWhy(st, hh, heir) {
    const f = hh.farmstead === null ? null : st.farmsteads[hh.farmstead];
    if (!f || f.household !== hh.id) return `the household has no farm of its own`;
    const p = st.pawns[heir];
    if (!p || !p.alive || p.household !== hh.id || p.age < 18) return `pawn ${heir} is no adult of the household`;
    if (isHolder(st, heir) || hasPlot(st, heir) || awaitsCottage(st, heir)) return `pawn ${heir} has a farm or a plot`;
    return null; // the site is found as the plot is begun (sim/expansion's startPlot), and none begins where there is no room
  }
  // The barn (VB-255), a making begun through the verb project (VB-678; sim/projects' declare): a project at the house (sim/building's
  // barnSteps), under barnWhy; a large project, offered by the menu.
  declare('barn', {
    why: (st, hh) => barnWhy(st, hh),
    begin: (st, hh, f) => ({ steps: barnSteps(f.house) }),
  });
  // The farm for the heir (VB-255), a making begun through the verb project with args.heir (VB-678): clearing a plot and building its
  // cottage for pawn `heir`, an adult of the household with no farm, as the household's project (sim/expansion's plot, held by the
  // household, which it begins on the event heirFarm), under heirWhy; a large project, offered by the menu.
  declare('heirFarm', {
    why: (st, hh, f, args) => heirWhy(st, hh, args && args.heir),
    begin: (st, hh, f, args) => {
      emit(st, 'heirFarm', { village: f.village, heir: args.heir, by: hh.id });
      return null;
    },
  });
  // plotToVillage({plan, why}): household target's plot for its heir (project plan `plan`) passes to its village, its tiles and work with
  // it (VB-255; sim/expansion hears it by an event): its head gives it up, the household dissolves, the heir cannot take it
  // The right (VB-681): the head of the household gives it up (Plans.heads), or the plot's own course passes it on (source 'construction':
  // its heir cannot take it, its household is no more), with no actor.
  register('plotToVillage', {
    check: (st, c) =>
      (c.source === 'construction' || c.source === 'debug'
        ? c.actor === null
          ? null
          : 'a plot passes to its village by its own course with no actor'
        : Plans.heads(st, c)) ||
      (Projects.projectsOf(st, 'household', c.target).some((p) => p.what === 'plot' && p.id === (c.args && c.args.plan))
        ? null
        : `the household has no plot ${c.args && c.args.plan} under way`),
    run: (st, c) =>
      emit(st, 'plotToVillage', { household: c.target, plan: c.args.plan, why: c.args.why || 'given up' }),
  });
  return { AIMS, KIND, lookNow, idleShare, surplusOf, menu, choose, heirOf, barnWhy, heirWhy };
})();
