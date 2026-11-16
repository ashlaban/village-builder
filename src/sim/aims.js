// @sys sim/aims: a head's projects (design.md section 7, How a holder chooses: projects; VB-255): layer 3 of how a holder chooses. Once a
// year, at its first review after the autumn count, a head whose plan's targets are met, whose store holds food beyond the year's need
// and the seed and whose hands stood idle over a third of the last season has a surplus, and takes one project from a menu weighed by its
// values: a field beyond those it needs, a claim on land (a new hay meadow), a farm for its heir, a barn; dropped when the surplus is gone
// a whole season
VB['sim/aims'] = (() => {
  const { HERD, DAY, SEASON_DAYS, YEAR_DAYS, WORK, MARRIAGE } = VB['sim/rules'];
  const { next: rnd } = VB['sim/rng'];
  const Traits = VB['sim/traits'];
  const Projects = VB['sim/projects'];
  const Stores = VB['sim/stores'];
  const { on } = VB['sim/events'];
  const { log, personEvent, fullName, atHousehold, isHolder } = VB['sim/records'];
  const { dailyNeed, larderOf } = VB['sim/hunger'];
  const { winterNeed } = VB['sim/herds'];
  const { pickField } = VB['sim/fields'];
  const { pickMeadow } = VB['sim/meadows'];
  const { findSite, hasPlot, awaitsCottage } = VB['sim/expansion'];
  const { issue } = VB['sim/commands'];
  const Plans = VB['sim/plans'];
  const { heirRanking } = VB['sim/heirs'];
  // The surplus (design.md section 7, How a holder chooses: projects; the first values of VB-255's criteria): food beyond `years` of the
  // household's need over the seed held back (the means to marry's measure, MARRIAGE.means, is the first value), and its hands idle over
  // `idle` of their work hours in the last season. The weights of the menu: `base` for each option, `heirs` for the heir's farm when two or
  // more would inherit (so that one would be left without the home farm); each times the head's lean (choose).
  const AIMS = Object.freeze({ years: MARRIAGE.means, idle: 1 / 3, base: 1, heirs: 2, hands: Object.freeze([14, 60]) });
  const KIND = Object.freeze(['field', 'claim', 'heir', 'barn']);
  // @state plan.aim (a household's standing plan; VB-255): absent until its first review after an autumn count, then {year (the year of cal
  //   of its last yearly look at the surplus), surplus (what that look, or the last one after a project ended, found), again (true when a
  //   project of the head's ended: it looks again at its next review), project (the id of the head's project plan under way, or null), what
  //   (its kind of KIND, or null), since (game hours: when it was taken, or null), shortSince (game hours since the food has stood under the
  //   surplus while it is under way, or null)}. Written only here.
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
  // Every target of the plan met now: the fields it wants, the woodpile's goal of the season, the hay for its herds' winters.
  function targetsMet(st, plan, hh, f, c) {
    const T = plan.targets;
    if (f.fields.length < T.fields || hh.wood < T.wood[c.season]) return false;
    return !hh.herds.length || hh.hay >= T.hayWinters * winterNeed(st, hh);
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
  // The menu: the options open to the household now, each {what, weight, tile | heir}, computed for the holder (never stored). Only for a
  // holder with a surplus and no project (VB.count.aimMenu).
  function menu(st, plan, hh, f) {
    VB.count.aimMenu++;
    const head = hh.holder,
      ambition = 1 + Traits.of(st, head, 'ambition'),
      generosity = 1 + Traits.of(st, head, 'generosity'),
      T = plan.targets,
      out = [];
    if (f.fields.length >= T.fields && f.fields.length < T.workable) {
      const tile = pickField(st, f, hh);
      if (tile >= 0) out.push({ what: 'field', weight: AIMS.base * ambition, tile });
    }
    const meadow = pickMeadow(st, f, hh);
    if (meadow >= 0) out.push({ what: 'claim', weight: AIMS.base * ambition, tile: meadow });
    const [heir, ranked] = heirOf(st, hh);
    if (heir !== null && findSite(st, st.villages[f.village]))
      out.push({ what: 'heir', weight: (ranked >= 2 ? AIMS.heirs : AIMS.base) * generosity, heir });
    if (!f.barn && !f.booth && st.villages[f.village].wood.length) out.push({ what: 'barn', weight: AIMS.base });
    return out;
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
  // The option begun by the head through its verb (the player's verbs as the head's rule's: source 'pawn'): true when a project began.
  function begin(st, hh, o) {
    const actor = hh.holder,
      target = hh.id;
    if (o.what === 'field' || o.what === 'claim')
      return (
        issue(st, {
          actor,
          verb: 'project',
          target,
          args: { what: o.what === 'field' ? 'field' : 'meadow', tile: o.tile },
          source: 'pawn',
        }) === true
      );
    if (o.what === 'heir')
      return issue(st, { actor, verb: 'heirFarm', target, args: { heir: o.heir }, source: 'pawn' }) === true;
    return issue(st, { actor, verb: 'barn', target, args: {}, source: 'pawn' }) === true;
  }
  const TAKEN = {
    field: () => 'break a new field',
    claim: () => 'take in a new hay meadow',
    heir: (st, p) => `build a farm for ${fullName(st.pawns[p.intended])}`,
    barn: () => 'build a barn',
  };
  const DONE = { field: 'a new field', claim: 'a new hay meadow', heir: 'a new farm for its heir', barn: 'a new barn' };
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
  function giveUp(st, hh, f, A, p) {
    for (const s of p.steps) if (s.stake) VB['sim/claims'].dropClaim(st, s.place, p.holder);
    const text = `${f.name} gives up building ${DONE[A.what]}: its surplus is gone.`;
    personEvent(st, hh.holder, 'projectDropped', text, false); // recorded below
    Plans.drop(st, p, text, { pawn: hh.holder, ...atHousehold(st, hh) });
    A.project = A.what = A.since = A.shortSince = null;
  }
  // At each review of a household's plan (sim/plans' event planReviewed): a project of the head's under way is watched for its surplus;
  // at the first review after the autumn count, or after a project ended, the head looks at its surplus and, with one, no project and no
  // hold on projects (VB-253), takes one.
  function reviewed(st, plan, c) {
    const hh = st.households[plan.holder.id],
      f = hh.farmstead === null ? null : st.farmsteads[hh.farmstead];
    if (!f || f.household !== hh.id || hh.holder === null || hh.holder === undefined) return;
    const A = plan.aim;
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
    if (!B.surplus || Projects.projectOf(st, 'household', hh.id) || Projects.heldOff(st, hh.id)) return;
    const o = choose(st, menu(st, plan, hh, f));
    if (!o || !begin(st, hh, o)) return;
    const p = Projects.projectOf(st, 'household', hh.id);
    if (!p) return;
    B.project = p.id;
    B.what = o.what;
    B.since = st.t;
    B.shortSince = null;
    tell(st, hh, 'projectTaken', `${fullName(st.pawns[hh.holder])} of ${f.name} sets out to ${TAKEN[o.what](st, p)}.`);
  }
  on('planReviewed', (st, d) => reviewed(st, d.plan, d.c));
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
  // Why household hh may not begin a barn now, or null (the verb barn): a farm of its own with none, no booth, no project under way, a
  // village wood to fell its timber in.
  function barnWhy(st, hh) {
    const f = hh.farmstead === null ? null : st.farmsteads[hh.farmstead];
    if (!f || f.household !== hh.id) return `household ${hh.id} has no farm of its own`;
    if (f.barn) return `${f.name} has a barn`;
    if (f.booth) return `${f.name} has no cottage yet`;
    if (!st.villages[f.village].wood.length) return `${st.villages[f.village].name} has no wood to fell its timber in`;
    const p = Projects.projectOf(st, 'household', hh.id);
    return p ? `household ${hh.id} has a ${p.what} under way` : null;
  }
  // Why household hh may not begin a farm for pawn `heir` now, or null (the verb heirFarm): an adult of the household with no farm nor
  // plot, no project under way, and a site in its village.
  function heirWhy(st, hh, heir) {
    const f = hh.farmstead === null ? null : st.farmsteads[hh.farmstead];
    if (!f || f.household !== hh.id) return `household ${hh.id} has no farm of its own`;
    const p = st.pawns[heir];
    if (!p || !p.alive || p.household !== hh.id || p.age < 18) return `pawn ${heir} is no adult of household ${hh.id}`;
    if (isHolder(st, heir) || hasPlot(st, heir) || awaitsCottage(st, heir)) return `pawn ${heir} has a farm or a plot`;
    const q = Projects.projectOf(st, 'household', hh.id);
    if (q) return `household ${hh.id} has a ${q.what} under way`;
    return findSite(st, st.villages[f.village])
      ? null
      : `there is no room for a farm in ${st.villages[f.village].name}`;
  }
  return { AIMS, KIND, idleShare, surplusOf, menu, choose, heirOf, barnWhy, heirWhy };
})();
