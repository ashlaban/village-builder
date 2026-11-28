// @sys sim/kinds: the registry of job kinds: it joins the records each domain module declares (KINDS), builds each role's
// ranks, and holds the order in which sim/jobs asks the kinds' rules (ASK). A kind's record lives with its domain (VB-418). It joins
//   the goal kinds likewise (GOALS, VB-1777: a task at a tile carried through several steps, for any pawn) and reads them (goalSteps)
VB['sim/kinds'] = (() => {
  const { ROLES, STAND_KEYS } = VB['sim/roles'],
    { doneOf } = VB['sim/progress'];
  const Fieldwork = VB['sim/fieldwork'],
    Chores = VB['sim/chores'],
    Wood = VB['sim/wood'],
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
  const { pawnPlan } = VB['sim/steps'],
    { VERBS } = VB['sim/commands'];
  const { landProject, projectsOf } = VB['sim/projects'],
    { meadowWork } = Meadows,
    { byreWork } = Byre,
    { plotWork } = Expansion,
    { claimWork } = Farmclaims;
  // A kind's fields:
  //   verb, go, back: what the pawn panel says while working, walking there and carrying home (words(st, j): any of them read from the
  //   state, VB-1670: sim/byre's fodder with no byre standing); name: the job in the settlers panel;
  //   label: the job in the line that says why a pawn is idle; anim: the page's work animation; hours: work hours to finish;
  //   hands: how many pawns may work one job at once (VB-102: field, land and threshing work takes the whole household);
  //   type: the type of work, which roles rank (ROLES in sim/roles); craft: the craft the work is (SKILLS.crafts, sim/skills; VB-360),
  //   whose level speeds a hand and which its hours practise; field: worked row by row across the tile, at `pace` map units an hour;
  //   inside: worked in the house; carry: what is carried home when the work is done, to the cottage door, the woodpile or the barn (`to`);
  //   spot(st, a, j): where on the site the pawn stands; urgency(st, j, c, U): the job's weight in a bid (U is MATCH.urgency; 1 without it);
  //   done(st, j, hh, c): what finishing the work does; deliver(st, j, hh, f, a): what arriving home with a load does;
  //   load(st, a, j, cap): a trip's load from the field; again(j): the job stays open for the next (haul, VB-335);
  //   make(st, a, j, frac, hh): the good made where the work is done, as its work leg ends (VB-1748: the tree felled, the stones taken
  //   off the tile, the catch and the game rolled, the ground dug), set on the pawn as its load (a.load, in the units its delivery
  //   puts): its `deliver` then only puts the load into the store, and a carrier cut on the road leaves it lying (sim/lying);
  //   accrues: a trip whose yield accrues with its hours (fishing, hunting, gathering): one cut at its work makes `frac` of its yield,
  //   the share of its hours done, which lies where it was cut; lies: the kind whose load lying it is, if not its own (timber's);
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
  //   mind: set by sim/methods' `mind` (VB-1750): a charge minded beside its holder's task, at `rate` of the pawn's hours, only within
  //   `reach` steps of the task's site; a pawn holds one task, and besides it one charge that bars and one that yields (sim/attention;
  //   herd the first, VB-136); held(st, j, a, c): what taking it up does; worked(st, j, dt, null, from), as it is reckoned; minAge.
  //   yields: a background kind that bars its holder from no full task: one out of its reach lets it go (VB-362: spinning at the house);
  //   rank(st, p, j, stand): the kind's own rank for pawn p, in place of its role's (sim/fit prioOf; VB-362: by a practice and the sex).
  //   late: a task with a deadline today: unmanned, it goes first in its hand's list and calls it when the day is allotted (sim/day; the cook).
  //   vital: a kind a household lives by, true or (st, j) => boolean: once begun it is carried to its end though the work day ends
  //   meanwhile (`carriedOn`, below; VB-1547, Kim, 23 November). evening: a vital kind a hand may also begin after the end of work, until
  //   MATCH.day.evening: open and unmanned then, it calls a hand at home (sim/day eveningCall; the water); true or, as vital, (st, j) =>
  //   boolean (the firewood cut at home while the house is cold or the pile short, VB-1653).
  //   daily: a kind due each day that a household lives by (the water, the meal, the fire, milking, fodder; VB-1755, design.md section 7,
  //   Authors): its expected hours are reserved before anything authored (sim/day reserveOf), and a pawn on its own plan takes one the
  //   day leaves unmanned before its routine and its tasks (sim/controller nextOf).
  //   first: a kind that heads the list of the member best fit for it when the day is allotted (the water; VB-1582). The hours of its
  //   trip besides its work and what its hand takes as it sets out are its method's go step's (`trip`, `setOut`: sim/methods, VB-1821).
  //   together: worked by all together (VB-120: a work day): a bid does not fall for the hands already at the job (MATCH.join, sim/fit).
  //   norm(st, j): the job's hours for a normal crop, where its hours go by the crop's size (reap, thresh): what a head that does not
  //   reckon with the size estimates (sim/estimate, VB-476).
  // ---- the rules shared by the kinds a module posts together; each names its jobs' kinds ----
  // The village's common fields (VB-100): their kinds, as at a farm's fields, while its meeting chose the routine.
  function commonWork(st, v, at, c, post) {
    if (st.plans.villages.get(v.id).routines.includes('commons')) Commons.work(st, v, c, post, ASK.fieldAt);
  }
  // Every kind, in a fixed order: the order is part of saved state (st.plans.due holds an index into the windowed kinds, sim/plans) and of
  // the ranks' order, so a new kind is added at the end, whatever its module.
  // The field's kinds, and for a common field the three whose end is the village's (sim/commons).
  const F = Commons.common(Fieldwork.KINDS);
  const KINDS = {
    plow: F.plow,
    sow: F.sow,
    reap: F.reap,
    haul: F.haul,
    wood: Wood.KINDS.wood,
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
    hay: Meadows.KINDS.hay, // by the load, as a goal (sim/meadows, VB-1812)
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
  Object.assign(KINDS, VB['sim/drain'].KINDS); // ditching a wet field (VB-721): sim/drain's
  Object.assign(KINDS, VB['sim/saltpan'].KINDS); // boiling salt at a spring (VB-700): sim/saltpan's
  Object.assign(KINDS, VB['sim/ironwork'].KINDS); // smelting bog ore and mending the tools (VB-701): sim/ironwork's
  Object.assign(KINDS, VB['sim/wells'].KINDS); // a household's well, dug by its house (VB-1584): sim/wells's
  // a load left lying where its carrier fell is the stray of its owner's goal that uses it (sim/methods; VB-1814: no fetch kinds); the
  // hay left lying with no meadow mown is its own goal's, where the fetch kinds stood in the order
  KINDS.leftHay = Meadows.KINDS.leftHay;
  KINDS.blaze = VB['sim/trails'].KINDS.blaze; // blazing a trail (VB-447): sim/trails'
  KINDS.drink = VB['sim/thirst'].KINDS.drink; // a pawn's drink at a source (VB-1585): sim/thirst's
  Object.assign(KINDS, VB['sim/leather'].KINDS); // shoes and harness cut from a hide (VB-911): sim/leather's
  Object.assign(KINDS, VB['sim/textile'].KINDS); // spinning, weaving and the loom (VB-362): sim/textile's
  KINDS.firewood = Wood.KINDS.firewood; // timber cut into firewood at the house (VB-1653): sim/wood's
  KINDS.cutpile = Wood.KINDS.cutpile; // and where timber lies, carried home cut (VB-1931): sim/wood's
  Object.assign(KINDS, VB['sim/byrehouse'].KINDS); // the byre's walls and roof (VB-1665): sim/byrehouse's
  Object.assign(KINDS, VB['sim/storehouse'].KINDS); // the storehouse's walls and roof (VB-1898): sim/storehouse's
  Object.assign(KINDS, VB['sim/gateturn'].KINDS); // moving a farmstead's gate (VB-1951): sim/gateturn's
  Object.assign(KINDS, VB['sim/timberhouse'].KINDS); // the timber house's frame and roof (VB-1664): sim/timberhouse's
  Object.assign(KINDS, VB['sim/facilities'].KINDS); // a facility's stages raised and its upkeep (VB-361): sim/facilities'
  Object.assign(KINDS, Expansion.plotted(KINDS)); // a plot's step ends in its finish, through its kind's `done` (sim/expansion, VB-1821)
  Object.assign(KINDS, VB['sim/sites'].sited(KINDS)); // a site's step ends in its finish, as a plot's (sim/sites, VB-787)
  // every kind that declares no methods of its own is work done at its site (sim/methods labour, VB-1750: no kind runs on the phases); an
  // indoor kind's work stands by the door of its house (as sim/agents' spotAt)
  for (const k in KINDS) {
    const K = KINDS[k].methods ? KINDS[k] : VB['sim/methods'].labour(KINDS[k]);
    if (!K.spot && K.methods.some((m) => m.steps.some((s) => s.inside)))
      K.spot = (st, a, j) => [st.w.hx[j.site] - 12 + a.ox * 0.3, st.w.hy[j.site] + 14 + a.oy * 0.15];
  }
  // ---- where a kind is worked, what it takes and what it gives (VB-1124): each kind's record declares `at` (the places of PLACES where its
  // work is done), `needs` (the things of THINGS it takes or must find there: a good used up, a tool or a facility) and `gives` (the
  // things it makes or brings home), beside its rule, as its name and hours are. The game's guide (page/guide) reads them, and a kind
  // added to the game appears there; a name outside these lists fails at load. A thing names the good of the registry (sim/goods) or
  // the food of FOODS (sim/rules) it is, where it is one; it says what a thing is, not what it is worth or how much a job gives. ----
  const PLACES = {
    field: 'a field of the farm',
    meadow: 'a hay meadow',
    land: 'open land beside the farm, to make a field, a meadow or a plot',
    farm: 'the farmyard',
    house: 'in the house',
    barn: 'the barn',
    storehouse:
      'the storehouse on posts, where the threshed grain and the food keep (a farm without one keeps them in the house)',
    byre: 'the byre and the fold',
    pasture: 'the pasture and the outland',
    woods: 'the woods',
    water: 'a well, a spring, a lake or a river',
    shore: 'the shore',
    bog: 'a bog or a clay bank',
    hills: 'the hills, mountains and heath, where rock lies near the surface', // VB-733: heath, thin soil over rock
    spring: 'a salt spring',
    site: 'a building site',
    green: 'the village green',
    fence: 'the village fence',
    commons: "the village's commons",
    road: 'where a load was left lying',
  };
  const THINGS = {
    seed: { name: 'seed grain', food: 'grain' },
    sheaves: { name: 'sheaves' },
    grain: { name: 'grain', good: 'grain', food: 'grain' },
    flour: { name: 'flour', food: 'flour' },
    meals: { name: 'meals' },
    ale: { name: 'ale', good: 'ale' },
    hay: { name: 'hay' },
    manure: { name: 'manure' },
    water: { name: 'water' },
    firewood: { name: 'firewood' },
    timber: { name: 'timber' },
    stone: { name: 'stone' },
    clay: { name: 'clay' },
    peat: { name: 'peat' },
    ore: { name: 'bog iron ore' },
    iron: { name: 'iron', good: 'iron' },
    tools: { name: 'tools' },
    tar: { name: 'tar', good: 'tar' },
    salt: { name: 'salt', good: 'salt' },
    meat: { name: 'meat', food: 'meat' },
    'salt meat': { name: 'salt meat', good: 'salt meat', food: 'salt meat' },
    milk: { name: 'milk', food: 'milk' },
    butter: { name: 'butter', good: 'butter', food: 'butter' },
    fish: { name: 'fish', food: 'fish' },
    'dried fish': { name: 'dried fish', good: 'dried fish', food: 'dried fish' },
    'wild food': { name: 'berries, mushrooms and nuts', food: 'gathered' },
    hide: { name: 'hides', good: 'hide' },
    shoes: { name: 'shoes' },
    harness: { name: "the team's harness" },
    fleece: { name: 'fleece' },
    yarn: { name: 'yarn', good: 'yarn' },
    cloth: { name: 'cloth', good: 'cloth' },
    loom: { name: 'a loom' },
    cattle: { name: 'cattle', good: 'cattle/cow' },
    sheep: { name: 'sheep', good: 'sheep' },
    quern: { name: 'a hand quern', good: 'quern' },
    cart: { name: 'a cart' },
    boat: { name: 'a fishing boat' },
    'tar pit': { name: 'a tar pit' },
    field: { name: 'a field' },
    meadow: { name: 'a hay meadow' },
    house: { name: 'the house' },
    barn: { name: 'a barn' },
    byre: { name: 'a byre' },
    storehouse: { name: 'a storehouse' },
    booth: { name: 'a booth' },
    fence: { name: 'the village fence' },
    green: { name: 'the village green' },
    well: { name: 'a well' },
    trail: { name: 'a trail' },
    facility: { name: 'a facility: a mill, a kiln, a bloomery' },
  };
  for (const [k, K] of Object.entries(KINDS)) {
    const bad =
      !Array.isArray(K.at) || !K.at.length || K.at.some((p) => !PLACES[p])
        ? 'at'
        : ['needs', 'gives'].find((f) => !Array.isArray(K[f]) || K[f].some((t) => !THINGS[t]));
    if (bad) throw new Error(`sim/kinds: kind ${k} declares no ${bad} of PLACES or THINGS`);
  }
  // A job is open while it has work left and fewer workers than hands; a carried job whose work is done waits for its carrier.
  const isOpen = (st, j) =>
    j.claims.length < KINDS[j.kind].hands &&
    doneOf(st, j, j.hours ?? KINDS[j.kind].hours) < (j.hours ?? KINDS[j.kind].hours);
  // The one rule of the work day's end for a task begun (VB-1547; design.md, The head calls): a task of a kind a household lives by (`vital`)
  // whose hand is walking to it or at work is carried to its end; any other is let go (sim/clock, at WORK[1]). A load on its way home is
  // brought in whatever its kind (sim/agents release).
  const carriedOn = (st, j) => {
    const v = KINDS[j.kind].vital;
    return v === true || (!!v && v(st, j));
  };
  // Whether task j is daily work a household lives by now (VB-1755): a `daily` kind, while its `vital` rule, if it has one, holds (the
  // fire: while the house is cold or the pile short, not the woodpile's stocking).
  const dailyNow = (st, j) => {
    const K = KINDS[j.kind];
    return !!K.daily && (typeof K.vital !== 'function' || !!K.vital(st, j));
  };
  // Each role's rank of every kind: its exception for the kind, else for the good a kind of strays brings (VB-1821: the hay left lying
  // ranked as the hay, VB-611; sim/methods bring), else its rank of the kind's type of work, else 0.
  const brings = (K) => (K.strays && K.strays.length ? (K.strays[0].good ?? K.strays[0]) : null);
  for (const r of Object.values(ROLES))
    r.prio = Object.fromEntries(
      Object.entries(KINDS).map(([k, K]) => [k, r.except[k] ?? r.except[brings(K)] ?? r.work[K.type] ?? 0]),
    );
  // A holder's ranks with the roles of its household's head pair absent (sim/roles STAND, VB-1545): `ranks[mask]`, for each kind the
  // highest of its own and each absent role's (bit i of the mask for STAND_KEYS[i]); ranks[0] is prio. Made once, at load.
  for (const r of Object.values(ROLES)) {
    r.ranks = [r.prio];
    for (let m = 1; m < 1 << STAND_KEYS.length; m++)
      r.ranks.push(
        Object.fromEntries(
          Object.keys(KINDS).map((k) => [
            k,
            STAND_KEYS.reduce((x, s, i) => (m & (1 << i) ? Math.max(x, ROLES[s].prio[k]) : x), r.prio[k]),
          ]),
        ),
      );
  }
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
      Building.shelterRule,
      VB['sim/sites'].farmWork, // a farm's own cottage, its site's (VB-1937)
      'wood',
      'firewood',
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
    island: [plotWork, claimWork, Building.stakedWork, Building.timberWork, 'boothwater'].map(rule), // a booth's water: VB-1601
    fieldAt: {},
    stages: VB['sim/fieldwork'].STAGES, // the field stages each field kind is asked at (VB-1820)
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
  ASK.farmAfterPlans.push(rule('boilsalt')); // salt (VB-700, sim/saltpan)
  ASK.farmAfterPlans.push(rule('smelt'), rule('mendtools')); // iron and the tools (VB-701, sim/ironwork)
  ASK.farmAfterPlans.push(rule('cobble'), rule('harness')); // shoes and harness (VB-911, sim/leather)
  ASK.farmAfterPlans.push(rule('spin'), rule('weave')); // wool to cloth (VB-362, sim/textile)
  // the goods left lying with no goal of their own (VB-611), each brought home by a goal of its kind (sim/lying BRING, VB-1814)
  (ASK.farmAfterPlans.push(rule(Lying.bringWork)), ASK.village.push(rule(Lying.bringWork)));
  ASK.village.push(rule(VB['sim/facilities'].villageWork)); // a village's facilities raised and mended (VB-361)
  ASK.island.push(rule('blaze')); // the trails under way, each its blazer's household's (VB-447, sim/trails)
  ASK.island.push(rule(VB['sim/sites'].siteWork)); // the sites of new farms under way, each its leader's household's (VB-787, sim/sites)
  for (const e of ASK.field) for (const g of ASK.stages[e[0]]) (ASK.fieldAt[g] ||= []).push(e);
  // ---- goals (VB-1777; docs/plans/four-scales/README.md, 3.2): a task at a tile carried through several steps, for any pawn ----
  // A goal kind is declared as data by the domain whose kinds carry its steps, beside their rules (GOALS): sim/fieldwork's plant and
  // harvest, sim/meadows' hay, sim/wood's fell and firewood, sim/camp's farmstead, joined here in that order; sim/upgrade contributes
  // upgrade, foundation and outbuilding at load, before the first seed. Each step is a job of a kind whose methods carry it (sim/methods,
  // sim/doing). A goal kind's fields: noun; mark (the land project a marked or a free tile begins, 'field' or 'meadow', or null) and
  // project(st, hh, tile) (the project it would make, read only); kinds (the job kinds that carry it: sim/agenda's gaps, sim/outlook's
  // cover); which (why its task leaves); args(g, st, id) (its own args, or why not; optional); at(st, hid, tile, task) (what of the
  // household's stands at the tile for it, or null); none(tile); why(st, where, tile, id) (why it takes no task now, or null);
  // steps(st, hid, where) ([{kind, hours (of one piece; absent: its kind's), n (pieces: a carrying's loads, else 1), from (the game hour
  // it may begin while its job is not posted), what (what `from` waits for), keys (its jobs found by key, not at the tile), posted
  // (listed only while posted), trip}], in the order the work goes); gone(st, where) (one of `which`, or null while it stands);
  // deadline(st, hid, where, frost) ({t, what} or null); and as it needs: act(st, id, where, tile) (a command of its own before its
  // steps), hold(st, hid, where, y, tile) (the household's rule that holds open step y's job back: [rule, ...args] of sim/controller's
  // HOLDS, or null), due(where, y) (what is raised at the next ask of the review hour, or null), ask(st, hid, task, steps) (whether the
  // plan asks its head now; steps() the goal's steps left), whole (kinds whose trip is not left for the sleeping hours).
  const GOALS = {
    plant: Fieldwork.GOALS.plant,
    hay: Meadows.GOALS.hay,
    harvest: Fieldwork.GOALS.harvest,
    ...Wood.GOALS,
    ...VB['sim/camp'].GOALS,
  };
  // The goal kind of task t (a task at a tile: no key), or null for a task by key.
  const goalOf = (t) => (t.key === undefined && GOALS[t.kind] ? t.kind : null);
  const homeOf = (st, hid) => {
    const hh = st.households[hid];
    return hh.farmstead === null ? null : st.farmsteads[hh.farmstead];
  };
  // The open project of household hid making `what` (a field, a meadow) whose step stands at `tile`, or null.
  function projectAt(st, hid, what, tile) {
    for (const p of projectsOf(st, 'household', hid)) {
      const s = p.steps[p.open];
      if (p.what === what && s && s.place === tile) return p;
    }
    return null;
  }
  // Whether household hid's head plans for itself (VB-1754: it holds a plan record of its own, sim/steps pawnPlan).
  const headPlans = (st, hid) => pawnPlan(st, st.households[hid].holder) !== null;
  // What stands at `tile` for goal kind `name` of household hid: the kind's own (`at`); else, for a kind with a mark, its open project
  // at the tile ({plan, f}), the tile the head has marked for its next field or meadow (sim/plans, plan.tiles; {mark, f, tile}), or, for a
  // task already planned (`planned`), its tile as one the head's verb `project` begins a field or meadow on when the head plans for
  // itself (VB-1651: no mark needed; {mark, f, tile, free: true}); null for nothing.
  function goalWhere(st, hid, name, tile, planned = false, task = null) {
    if (hid === null || hid === undefined || !Number.isInteger(tile) || tile < 0) return null;
    const C = GOALS[name],
      where = C.at(st, hid, tile, task);
    if (where) return where;
    if (!C.mark) return null;
    const p = projectAt(st, hid, C.mark, tile);
    if (p) return { plan: p, f: homeOf(st, hid) };
    const plan = st.plans.households.get(hid);
    if (plan && plan.tiles && plan.tiles[C.mark] === tile) return { mark: C.mark, f: homeOf(st, hid), tile };
    return planned && headPlans(st, hid) ? { mark: C.mark, f: homeOf(st, hid), tile, free: true } : null;
  }
  // The head's check, through its own verb (sim/plans' project: only the head changes its plan), as a command.
  const headCmd = (id, hid, args) => ({ actor: id, verb: 'project', target: hid, args, source: 'player' });
  // Why pawn `id` cannot plan goal kind `name` at `tile`, or null, whoever plays it: a marked tile only by the head of the household,
  // and any other tile where the head's verb `project` would begin the kind's field or meadow now (VB-1651).
  function goalWhy(st, id, name, tile) {
    const hid = st.pawns[id].household,
      C = GOALS[name];
    if (!Number.isInteger(tile) || tile < 0) return `there is no tile ${tile}`;
    const where = goalWhere(st, hid, name, tile);
    if (!where) {
      if (!C.mark || hid === null || st.households[hid].holder !== id) return C.none(tile);
      const why = VERBS.project.check(st, headCmd(id, hid, { what: C.mark, tile }));
      return why === null ? null : `${C.none(tile)} (${why})`;
    }
    if (where.plan) return null;
    if (where.mark) return VERBS.project.check(st, headCmd(id, hid, { what: null }));
    return C.why(st, where, tile, id);
  }
  // The steps left of goal kind `name` at `tile` for household hid's task there, in the order the work goes: a project's (begun, or the
  // one a marked or free tile would begin) at their own hours, then the kind's: {where, steps: [{kind, job (its job posted at the tile or
  // by its keys, or null), hours, n, from, what (what its `from` waits for, or absent), trip}]}; null where nothing of the household's
  // stands there. A step whose job is not posted now and that is listed only while posted (`posted`) is left out. Reads only.
  function goalSteps(st, hid, name, tile, task = null) {
    const where = goalWhere(st, hid, name, tile, true, task);
    if (!where) return null;
    const C = GOALS[name],
      p = where.plan || (where.mark ? C.project(st, st.households[hid], tile) : null),
      first = p
        ? p.steps.slice(where.plan ? p.open : 0).map((s) => ({ kind: s.kind, hours: s.hours, n: 1, from: -Infinity }))
        : [];
    const js = st.jobsBy.get(`household:${hid}`),
      steps = [];
    for (const s of [...first, ...C.steps(st, hid, where)]) {
      let job = null;
      if (s.keys)
        for (const k of s.keys) job = job || st.jobs.get(k) || null; // jobs found by key (the timber at the wood)
      else if (js && !where.mark) for (const j of js) if (j.kind === s.kind && j.site === tile) job = j;
      if (!job && s.posted) continue;
      const hours = s.hours ?? KINDS[s.kind].hours;
      steps.push({ kind: s.kind, job, hours, n: s.n, from: s.from, what: s.what, trip: s.trip });
    }
    return { where, steps };
  }
  // Why a task of goal kind `name` leaves the plan now (one of the kind's `which`), or null: nothing of the household's stands there
  // ('gone'); a project's tile, a marked one or a free one stands.
  function goalGone(st, hid, name, tile, task = null) {
    const where = goalWhere(st, hid, name, tile, true, task);
    if (!where) return 'gone';
    return where.plan || where.mark ? null : GOALS[name].gone(st, where);
  }
  return {
    // what it gives the page through the Sim facade (src/sim.js joins the lists, VB-1944)
    PAGE: ['KINDS'],
    KINDS,
    ASK,
    isOpen,
    carriedOn,
    dailyNow,
    PLACES,
    THINGS,
    GOALS,
    goalOf,
    goalWhy,
    goalSteps,
    goalGone,
    headCmd,
  };
})();
