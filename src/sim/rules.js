// @sys sim/rules [kernel]: the calendar, the economy and the foods, the herds, the ages of life and health, travel, given names, and the other
// tables several domains read (VB-419: a table one domain reads lives in that domain's module, found by its @tunable line)
VB['sim/rules'] = (() => {
  const { B } = VB['world/biomes'];
  // ---- calendar: 4 seasons of 12 days; one game hour is the base unit of time ----
  const DAY = 24,
    SEASON_DAYS = 12,
    YEAR_DAYS = SEASON_DAYS * 4,
    YEAR = YEAR_DAYS * DAY;
  // The clock counts whole 6-minute steps (st.tick, sim/clock; VB-235): TICKS of them an hour. The hour, the day and the year the clock is
  // working through are found from the count, never by adding a tolerance to st.t.
  const TICKS = 10;
  const cal = (t) => {
    const day = Math.floor(t / DAY),
      y = Math.floor(day / YEAR_DAYS),
      doy = day - y * YEAR_DAYS;
    return {
      year: y + 1,
      doy,
      season: Math.floor(doy / SEASON_DAYS),
      sday: doy % SEASON_DAYS,
      hour: t - day * DAY,
      day,
    };
  };
  const WORK = [6, 18];
  // The dark part of the day for a calendar date, [start, end] in hours (start > end when it runs past midnight): 4 hours at
  // midsummer, 8 at midwinter and 6 at the equinoxes, centred on 1:00.
  const DARK_CENTRE = 1;
  const dark = (c) => {
    const len = 6 - 2 * Math.cos((2 * Math.PI * (c.doy - 15)) / 48),
      h = (x) => ((x % 24) + 24) % 24;
    return [h(DARK_CENTRE - len / 2), h(DARK_CENTRE + len / 2)];
  };

  // ---- economy (a ration, the unit of food, is one adult's food for one game day; FOODS below) ----
  const ECON = {
    ration: { adult: 1, child: 0.5 },
    dryDays: 1,
    woodPerTrip: 3,
    woodTarget: 30,
    woodWinter: 40,
    woodUse: [0.35, 0.3, 0.5, 1.6],
    startGrain: 180,
    startWood: 16,
    fenceDecay: [0.012, 0.01, 0.014, 0.03],
    fenceMendBelow: 0.65,
    weedDays: [6, 15],
    weedCut: 0.2,
    weedCutMax: 0.4, // a growing field is weeded in rounds, each falling due this many days after sowing; each missed round cuts the yield
    // grain in store spoils (mice, damp, mould; balance review): a share a year of the grain up to a year's need, of the next year's worth, and of
    // the rest; the FAO puts losses in traditional stores at about 5% a year, and up to 20% where rats are many
    storeLoss: [0.05, 0.2, 0.4],
    // the village store (sim/help) keeps as a household's grain of a second year, all of it (sim/goods dayLoss's flat tier): nobody eats
    // from it day by day, so it is not turned and aired as a household's daily grain is (VB-683; a fifth a year)
    villageStoreTier: 1,
    // the pot (VB-119; design.md, Meals; Kim, 30 Oct and 10 Nov): a food is a source of the pot when it gives at least potShare of its rations;
    // a pot of k sources needs pot[k] of the food a pot of one source needs for the same meals (1 / 0.9 and 1 / 0.8 times its rations in
    // meals for 2 and for 3 or more). A household with no meals eats its grain uncooked, and a ration of grain eaten so feeds `uncooked` of a
    // ration of need (VB-327; design.md, Fuel: Agreed, 10 Nov, 0.75 in every meal no one cooked, wood or not; it was rawGrain 1.25, the
    // agent's value of VB-119, a cost of 1 / 0.8)
    pot: [1, 1, 0.9, 0.8],
    potShare: 0.2,
    uncooked: 0.75,
    // grain cooked unground, without flour from the quern (VB-009; design.md, Milling at home: Decided, Agreed): `unground` grain a ration;
    // flour cooks 1 to 1
    unground: 1.25,
  };
  // ---- fields a household wants (balance review, 1 Nov 2026): enough for `want` times a year's rations at `expect` of the full yield, but no more
  // than its hands can till: perHand fields a working adult (14 to 59, not retired) and oxenHands more for a team of oxen (VB-138); no fixed cap ----
  // room (stability review, VB-154): a new farm (a plot, a settler's farm, a new village) needs this many free farmable tiles within FIELD_REACH
  // walking steps of its house besides its first field, for more fields, meadow and pasture; so fewer farms fit between villages.
  // memory (VB-767): the years of each source of food a head remembers; trustFrom (VB-768): the years it must remember before it counts on
  // its other sources at all; letGo (VB-768): the most fields a household lets go in a year, so one good year does not strip a farm; slack
  // (VB-768): the fields a household keeps over those it wants before it lets one go, so that a target moving by a field from one year to
  // the next does not let a field go and break it again (hysteresis: AGENTS.md, a derived view feeds a rule only through hysteresis)
  const FIELDS = {
    want: 1.1,
    expect: 0.75,
    perHand: 2,
    oxenHands: 1.5,
    room: 6,
    memory: 8,
    trustFrom: 3,
    letGo: 1,
    slack: 1,
  };
  // ---- fishing (VB-117; Kim, 10 Nov, QUESTION_ARCHIVE.md, VB-117 to VB-119, question 1): from a bank within `reach` walking steps of the
  // house; a trip brings home `trip` rations times the water tile's stock and lowers a river or small lake tile's stock by `take`, which
  // recovers `recover` a day; lakes of `bigLake` tiles or more and the sea do not run down. Water holds fish at a stock of `least` or more (a
  // trip's take). Posted from spring day `from + 1` to the end of autumn; a second trip while the household's spare food covers fewer than
  // `secondDays` days of its need ----
  const FISH = { reach: 6, trip: 4, take: 0.1, recover: 0.02, bigLake: 20, least: 0.1, from: 2, secondDays: 12 };
  // The ages of life, in one table (VB-686): each row says what the age is for; the modules read it, none writes its own.
  //   hands [14, 60): a working hand: strong enough for a season's labour from 14 (a boy at the plough, a girl at the dairy; the
  //     ration of an adult starts there too), and past it at 60, when a body tires; the hands counted for fields, herds, help and service.
  //   major 18: of age: holds a household and goes to law without a guardian or trust; heirs and settlers of a party are counted from it.
  const AGES = Object.freeze({ hands: Object.freeze([14, 60]), major: 18 });
  // ---- roe deer (VB-139; Kim, 30 Oct: the one wild grazer, meat and hides when hunted, forest edges and meadows, can damage crops), starting
  // values with no source but a roe deer's size: a region's stock grows logistically at `growth` a year towards `perEdge` deer for each of
  // its forest-edge tiles (a wood tile beside open land: a tile of land about 150 m across, Two readings of one grid, so about 0.15 deer a
  // hectare of edge). Each day its deer graze `graze` cow-hours of pressure a deer (sim/grazing) over `spots` of its edge tiles in turn. In
  // summer a standing crop beside a wood and a broken stretch of the village fence (below `crop.below`, the cattle's HERD.stray.below) is
  // browsed with `crop.chance` a day times the region's deer against its capacity, losing `crop.loss` of its yield. Hunting (`hunt`): in
  // autumn and winter, men of `minAge` or more, a trip of `hours` to the nearest forest edge within `reach` walking steps whose region holds
  // `least` deer or more; it kills with `chance` times the deer against the capacity, a kill giving `meat` rations of fresh meat (a sheep's) ----
  const DEER = {
    perEdge: 0.3,
    growth: 0.35,
    graze: 1.5,
    spots: 3,
    crop: { below: 0.45, chance: 0.04, loss: 0.05 },
    hunt: { reach: 6, hours: 4, chance: 0.3, least: 1, meat: 3, minAge: 14, hide: 1 }, // a kill's hide: for leather (sim/leather, VB-911)
  };
  // ---- names ----
  const MALE = [
    'Erik',
    'Olof',
    'Anders',
    'Nils',
    'Per',
    'Lars',
    'Jon',
    'Sven',
    'Håkan',
    'Gunnar',
    'Ivar',
    'Björn',
    'Arvid',
    'Ragnar',
    'Torsten',
    'Mats',
    'Hans',
    'Jöns',
  ];
  const FEMALE = [
    'Kerstin',
    'Karin',
    'Ingrid',
    'Brita',
    'Märta',
    'Elin',
    'Sigrid',
    'Astrid',
    'Gunhild',
    'Margit',
    'Ragnhild',
    'Ingeborg',
    'Signe',
    'Tora',
    'Gertrud',
    'Cecilia',
  ];
  const patronym = (father, sex) => father + (father.endsWith('s') ? '' : 's') + (sex === 'm' ? 'son' : 'dotter');
  // ---- hunger: a member's hunger h (0..1) multiplies the death hazard by 1 + k(age) * h, and slows work by HUNGER.slow * h ----
  const HUNGER = { days: 12, slow: 0.4, marryBelow: 0.5, k: (a) => (a < 5 || a >= 60 ? 1.5 : a < 15 ? 0.6 : 0.3) };

  // ---- health: a pawn's health (0..100) is drained daily by hunger (h squared) and by a cold house (VB-327: `cold` times the day's cold,
  // 0..1), and restored by a full meal on a warm day; at 0 the pawn dies of starvation ----
  const HEALTH = {
    drain: 4,
    cold: 2,
    dry: 1,
    marsh: 0.25,
    frail: 1.5,
    recover: 3,
    riskBelow: 50,
    riskSlope: 25,
    slow: 0.3,
  };
  // The scenario "The market town" (VB-778; a test bed, known to decay): `plots` plot households set within 2 steps of each other, at the
  // village with most people within `reach` hex steps (about a day's walk). Read at the start only; no rule reads it afterwards.
  const TESTBED = { plots: 8, reach: 15 };

  // ---- illness (VB-1118, principle "A wait is the thing waited for"): a death the day's roll draws of a cause in `days` (the base hazard's causes; not
  // hunger, which
  // health already shows) comes as an illness that runs that cause's days before it kills; while it runs the pawn's health falls by `fall`
  // over the course (sim/hunger), with no recovery, and no other roll is drawn for it. Kin see the pawn ailing, never the outcome.
  // VB-1246: a pawn also falls ill at an incidence of its own, `incidence` a year by the cause its age gives (above the roll's deaths,
  // which stay its share of the courses); such a course passes, its health falling by `passing` of `fall`, unless its health gives out.
  // First values (Proposed): an infant falls gravely ill about once in its first year, a child or an old pawn one year in three, a grown
  // one in ten; the hazard at 0, 30 and 80 is 0.39, 0.012 and 0.2 a year, so a course at those ages kills about two in five, one in nine
  // and two in three.
  const ILLNESS = {
    days: { infancy: 2, childhood: 4, illness: 6, oldAge: 10 },
    fall: 60,
    incidence: { infancy: 1, childhood: 0.3, illness: 0.1, oldAge: 0.3 },
    passing: 0.5,
  };

  // ---- marriage: who is matched in the moving round (ages in years; the score is -|gap error| * gapWeight + village bonus + noise) ----
  const MARRIAGE = {
    menFrom: 20,
    womenFrom: 18, // youngest age to marry
    ageGap: 3,
    gapWeight: 0.3, // preferred age gap (man older) and score lost per year off it
    // a widow or widower minds the gap less (balance review): remarriage was common in pre-industrial Sweden, above all for men, and a widowed
    // holder brought a farm to the marriage (Lundh 2007)
    widowedGapWeight: 0.15,
    sameVillage: 2,
    noise: 1.5, // score bonus for the same village; amplitude of the random term
    // walking hours over which the villages' term falls by e (VB-288): sameVillage x exp(-hours / nearHours), 0.45 at a day's walk (12 h);
    // the tie's own scale (its decay exp(-d / 25) in steps is about 8 h of walking)
    nearHours: 8,
    liking: 1, // score per point of the mean of the two young's opinions of each other (VB-275); a stranger's opinion is 0
    minScore: -1.5, // lowest score accepted, by the spokesman who asks and by each who answers
    // score per point of a spokesman's opinion of the other side's spokesman (VB-693; plan VB-682, 4.1): 0 between strangers
    headsLiking: 0.5,
    affinityDegree: { fourth: 8, line: 0, free: -1 }, // affinity: the widest civil degree from a spouse that bars (0 the direct line; -1 none)
    kinDegree: { second: 8, first: 6, close: 4, uncle: 3 }, // closest civil degree allowed per kinLimit custom; degree 2 or less never marries
    scarcePush: 1,
    plentyPush: 0.5, // self-interest pull on kinLimit towards the next looser option (scarcity) or stricter (plenty)
    // the means to marry (stability review, VB-153): the household the couple will live in holds food, above its seed, for `means` years of
    // its members and the newcomer; a match that lacks it waits a year (Malthus's preventive check: marriages fell after bad harvests). A home
    // with fewer than two adults is exempt: it needs the spouse's hands. Proposed 1.5 (stability review): the round falls just after the harvest,
    // when stores are at their highest, and at 1 the check seldom bound (births and hunger as before); at 1.5, over four tiny-map runs of 80
    // years, deaths from hunger fell by about 40% and women married 2 to 3 years later.
    means: 1.5,
    // an offer the player must answer stays open this many days; unanswered, it is answered as the pawn would unplayed (VB-293)
    offerDays: 7,
  };
  // ---- the holder's choice to hand on in life (VB-1314; plan VB-1122, section 5; design.md, Handover and shares: Timing): an unplayed
  // holder hands on when the weighing custom x due + years x max(0, age - from) + weak x (1 - hand) + wish x wish + opinion x op - keep x
  // keepShare reaches `at` (sim/marriage, handover). due: 1 once the custom's time has come (the heir married and living in the house, or
  // the holder at 60); hand: 1 while the holder is a working hand (under AGES.hands[1]); wish: 1 when the heir is married in the house,
  // or courts with no place to marry onto; op: the holder's opinion of the heir (-1 to 1); keepShare: the keep of the holder and its
  // spouse (a ration a day each) over what the farm made last year (sheaves and milk), at most 1. A holder who holds out past the
  // custom's time loses its heir's opinion, grudge a year from then up to grudgeMax (sim/relations, derived). First values, Proposed. ----
  const HANDOVER = {
    custom: 0.8, // the pull of what the village expects
    from: 55,
    years: 0.05, // from 55, each year of age adds 0.05 (a holder of 65 is at 0.5 from age alone)
    weak: 0.3, // a holder who no longer counts as a working hand
    wish: 0.3, // the heir married in the house, or waiting on a place to marry
    opinion: 0.4, // times the holder's opinion of the heir, either way
    keep: 1, // times the keep's share of the farm's yield
    at: 1, // the weighing at which the holder offers
    grudge: 0.05, // the heir's opinion of a holder holding out past the custom's time, lost a year
    grudgeMax: 0.3, // and at most
  };

  // ---- animals (sim/herds; docs/review-animals.md): hay a stall day by kind of animal; the stall period, from autumn day 9 (doy 32) to the
  // turn-out on spring day 6 (doy 5), 21 days; breeding on spring day 3 (doy 2) with a bull of bullAge or more, or a ram, within reach steps of
  // the farm; deaths of grown animals a year; the byre's room in cattle (a calf counts half); ages in years ----
  // ---- what one adult carries (Kim, 10 Nov: one number for the fields, the fair and the journeys): rations on the back, and on a cart with
  // two oxen (VB-335, VB-291, VB-295) ----
  // hand, cart: on a hand cart and an ox cart (sim/carts; it was 90 with two oxen); pace: a laden pawn's speed; hay, hayCart: units of hay a ration of load,
  // and what an ox cart takes at most (10 on the back, 60 on a cart: hay is light, so two oxen draw twice what a sheaf cart takes; VB-394);
  // dayWalk: the walking hours of a day on a journey, 6:00 to 18:00 (VB-287): a day's provisions for each dayWalk hours of the way, and a
  // pawn with no household further than this from its new home walks there as a journey, and a village further than this is courted only
  // after a visit (VB-289); stay: the days a visitor stays as the other village's guest; hayReload: the hours a further load of hay is
  // raked onto a cart in, the first taking its task's (CART.reload until VB-1812)
  const TRAVEL = {
    load: 30,
    hand: 90,
    cart: 300,
    pace: { back: 0.9, hand: 0.8, ox: 0.6 },
    hay: 1 / 3,
    hayCart: 60,
    hayReload: 1.5,
    dayWalk: 12,
    stay: 1,
  };
  // @tunable LYING: what lies out degrades (VB-1910; design.md, Goods and the farming year, Risk; Decided, Kim, 27 Nov: over time, no
  // condition on each item): frostLoss, the share of a lying load (sim/lying) lost each game day once the year's frost has come (Proposed,
  // a first value); quantum, the load (in a load's units, rations of weight: a sack of grain's 10) under which what is left is dropped.
  // The wet day's share waits for a wet day in the sim (VB-2000).
  const LYING = Object.freeze({ frostLoss: 0.25, quantum: 10 });
  // @tunable WINTER: the ground by season (VB-808; design.md, Climate and travel beyond walking, The ground by season; docs/plans/VB-190.md,
  // section 5.2), read by sim/walking as the winter's dates fall (sim/climate): ice, the cost of a tile of lake, river or sound ice that
  // bears, crossed with no slope (a river needs no ford); marsh, frozen marsh's ground in place of TERRAIN's 5 (the dear ground of the
  // journey scale, so a winter way runs straight over the mire); snow, what deep snow multiplies a tile's cost by where no lane is
  // trodden (lanes stay trodden under snow: Worn paths); soft, the same for the days between the thaw and firm ground; near, the tiles
  // from land within which sound ice bears. Proposed by the plan (16 Nov); estimates, not measured (docs/tuning.md).
  const WINTER = { ice: 1, marsh: 1.5, snow: 1.3, soft: 1.3, near: 3 };
  // A booth (bod; VB-784; design.md, Moving to new land, The booth): a shelter of poles, bark and turf, `hours` of work and `wood` loads at its
  // tile, `sleeps` at most; unkept it wears `wear` of its condition a year (poles and bark: about three years) and is gone at none. A pawn
  // lodging under the open sky stakes one at its bed when its stay plans more than `worth` nights (VB-1172; design: a stay of more than a
  // night or two wants a booth).
  const BOOTH = { hours: 12, wood: 2, sleeps: 4, wear: 1 / 3, worth: 2 };
  const HERD = {
    hayLoss: [0.05, 0.25, 0.5], // annual barn losses by winters of need held (VB-159)
    hay: { cow: 1, bull: 1, ox: 1, heifer: 0.6, steer: 0.6, calf: 0.4, ewe: 0.2, ram: 0.2, lamb: 0.1 },
    stall: [32, 5],
    stallDays: 21,
    springDay: 2,
    reach: 12,
    calve: 0.85,
    calfDeath: 0.15,
    lamb: 0.9,
    twins: 0.3,
    lambDeath: 0.2,
    death: { cattle: 0.03, sheep: 0.05 },
    bullAge: 2,
    grown: 3,
    maxAge: 15,
    keepBullUnder: 8,
    byre: 6,
    // a farm with no byre (VB-1665; sim/byrehouse) winters its animals in the open: each lean day of the stall winter counts openLean
    // (a whole number: herd.lean counts days) towards the herd's lean, against 1 under a roof (sim/byre)
    openLean: 2,
    startMargin: 1.1,
    // the byre and the autumn count (sim/byre, VB-134): the count on autumn day 8 (doy 31) keeps what hay × margin feeds; old ages; meat a head
    // (Kim, 31 Oct); fodder hours (base, a head of cattle, a sheep); slaughter hours; fresh meat keeps freshDays, salt meat saltDays; salting
    // makes saltPerHour rations an hour; emergency meat is lean (half); a herd unfed starveDays running loses an animal a day; smokeDays
    // (VB-700): meat a household has no salt for is hung in the smoke under the roof and dried, and keeps two seasons, from the autumn
    // slaughter into spring, against salt meat's year (Proposed, no source: smoked and dried meat keeps months, not a year, in a damp house);
    // saltPerRation (VB-700): measures of salt a ration of meat takes, dry-salted (a part of salt to ten of meat by weight; sim/saltpan)
    countDay: 31,
    // margins by the village's custom `stocking` (VB-711): the count keeps the animals whose winter's need times the margin the hay covers;
    // over 1 keeps a reserve, under 1 expects the hay stretched (the cost falls on the lean days and starvation, as built)
    margins: { hay: 1.1, herd: 0.8 },
    old: { cow: 12, ox: 12, bull: 10 },
    oldEwe: 1 / 7,
    meat: { cow: 15, ox: 18, bull: 18, heifer: 10, steer: 10, calf: 5, ewe: 3, ram: 3, lamb: 1.5 },
    fodder: [0.5, 0.15, 0.03],
    slaughter: { cattle: 3, sheep: 1 },
    freshDays: 3,
    saltDays: 48,
    smokeDays: 24,
    saltPerRation: 0.1,
    saltPerHour: 8,
    lean: 0.5,
    eatSoonDays: 6,
    starveDays: 2,
    // milk (VB-135): a cow that calved this spring is in milk while the herds are out; milking hours (base, a cow in milk); rations a cow
    // a day, less leanPer a lean day of the winter, at most leanMax; the share churned to butter, which keeps butterDays; fresh milk keeps a day
    milkHours: [0.3, 0.2],
    milk: 0.5,
    leanPer: 0.02,
    leanMax: 0.4,
    butter: 0.4,
    butterDays: 48,
    // ewes' milk and wool (VB-144; Walter of Henley): a ewe that lambed this spring gives eweMilk rations a day from turn-out to the end of
    // summer (day `eweEnd`, a doy), eweHours more milking hours a ewe; each sheep of a year or more grows a fleece by summer day 1 (doy
    // `shear`), shorn at the fold by a hand in shearHours a sheep (VB-679: blade shears, catching and rolling the fleece, about 30 a day),
    // the flock kept in until it is shorn; a fleece not shorn by the end of summer (eweEnd) is shed on the pasture and lost
    eweMilk: 0.05,
    eweHours: 0.03,
    eweEnd: 24,
    shear: 12,
    shearHours: 0.3,
    // oxen at the plough (VB-138): two oxen make a team, which draws the ard for the first hand on these kinds, `rate` times a hoe
    team: { oxen: 2, kinds: ['plow', 'break'], rate: 5 },
    // a cow wanted (VB-390; sim/exchange): a household of `hands` working hands or more that holds a meadow and no cattle wants one
    want: { hands: 2 },
    // herding (VB-136; docs/review-animals.md, G6 and G7): each grazing day a household with a herd posts `herd` from `from` (6:00); a herder
    // of minAge or more takes the household's herds to a pasture within `steps` steps of the house and keeps them there `hours` hours,
    // working at the side (background attention) within `reach` steps of it, then brings them home. Unherded by `by` (10:00), the herds
    // stay by the farm. The pasture: open land or wood, by its grass (`grass`, by biome), less its pressure over `full`, less `perStep` a
    // step from the house. A herd's load: 1 a head of cattle, `sheep` a sheep, an hour on the pasture, `nb` of it on each neighbour; on the
    // move it wears the tiles it crosses `move` crossings a head (sim/paths). The pressure (w.graze) halves each game year.
    // An unherded herd's cows give `milk` of their milk.
    // A herd keeps its pasture until it is grazed down to `downAt` (a middling herd's week on it), and at least `keepDays` days.
    // The way out (VB-446): a village's herds go by one way, chosen a season, from the green to the best tile of its outland, and graze
    // within `around` steps of its end (sim/grazing wayOf); a village with no outland to graze keeps them by the house.
    herding: {
      around: 3,
      from: 6,
      by: 10,
      hours: 9,
      steps: 8,
      downAt: 300,
      keepDays: 7,
      reach: 3,
      rate: 1,
      minAge: 8,
      full: 100,
      perStep: 0.05,
      sheep: 0.25,
      nb: 0.25,
      move: 0.25,
      milk: 0.5,
      // A crowded pasture lowers the milk (VB-709): over `downAt` of pressure (a herd's week) a herd that grazed there loses `bite` of its
      // milk for each `downAt` over (0.05: 5% at twice a week's pressure), and never more than leaves `floor` of it (0.5, an unherded herd's).
      bite: 0.05,
      floor: 0.5,
      grass: {
        [B.MEADOW]: 1,
        [B.MARSH]: 0.8,
        [B.HEATH]: 0.6,
        [B.HILLS]: 0.4,
        [B.FOREST]: 0.4,
        [B.PINE]: 0.3,
        [B.BEACH]: 0.3,
      },
    },
    // an unherded herd of cattle (VB-136, G7): with a stretch of its village's fence below `below` beside a growing crop of the village, it
    // gets in with `chance` a day; the field loses `loss` of its yield
    stray: { below: 0.45, chance: 0.2, loss: 0.1 },
  };
  // In the byre: from autumn day 9 to spring day 5; the herds graze out of it (sim/herds, sim/grazing).
  const stalled = (c) => c.doy >= HERD.stall[0] || c.doy < HERD.stall[1];
  // ---- foods (VB-259; design.md, Goods and the farming year: Food, Meals; Kim, 10 Nov): a ration is only the unit, one adult's food for a
  // day. Each food the game has: worth (rations a unit), keeps (shelf life in game days; null: it does not spoil by date, as grain, which
  // spoils in store by sim/hunger's share instead), source (its source in the pot, VB-119: grain and flour are one, fresh and dried fish one),
  // held (where a household keeps it: 'grain', its grain; 'larder', lots eaten as they are, sim/larder addFood, from sim/byre and sim/drying;
  // 'fresh', batches by the day they came in, sim/pot putFresh) and raw (it may be eaten uncooked, at no penalty: the larder's foods always,
  // fresh food on a day without meals). Grain, fresh food and dried fish are cooked into meals (sim/pot); grain eaten uncooked costs
  // 1 / ECON.uncooked a ration. Grain cooked unground gives 1 / ECON.unground a ration; flour, ground on the hand quern (sim/quern, VB-009),
  // is held as 'flour' (household.flour) and cooks 1 to 1, one source with grain. ----
  const FOODS = {
    grain: { worth: 1 / ECON.unground, keeps: null, source: 'grain', held: 'grain', raw: false },
    // peas, held as grain of their crop (stores) and so spoiling and eaten uncooked as grain; in the pot a source of their own (VB-349)
    pulses: { worth: 1, keeps: null, source: 'pulses', held: 'grain', raw: false },
    flour: { worth: 1, keeps: null, source: 'grain', held: 'flour', raw: false }, // a few days' stock: its keeping is not modelled
    meat: { worth: 1, keeps: HERD.freshDays, source: 'meat', held: 'larder', raw: true }, // fresh, from the slaughter
    'salt meat': { worth: 1, keeps: HERD.saltDays, source: 'meat', held: 'larder', raw: true },
    'smoked meat': { worth: 1, keeps: HERD.smokeDays, source: 'meat', held: 'larder', raw: true }, // salting without salt (VB-700)
    milk: { worth: 1, keeps: 1, source: 'milk', held: 'larder', raw: true }, // fresh milk keeps a day
    butter: { worth: 1, keeps: HERD.butterDays, source: 'milk', held: 'larder', raw: true },
    'dried fish': { worth: 1, keeps: YEAR_DAYS, source: 'fish', held: 'larder', raw: true }, // hung on the rack (VB-300); also cooked in the winter's pot
    fish: { worth: 1, keeps: 3, source: 'fish', held: 'fresh', raw: false }, // the catch (VB-117), cooked
    gathered: { worth: 1, keeps: 3, source: 'gathered', held: 'fresh', raw: true }, // berries, mushrooms and nuts (VB-118)
  };
  // `surplus` (VB-718): the most loads of manure a field takes in a year beyond what its soil asks, for its tilth only (an estimate, no source).
  // Ale (VB-305; design.md, Goods, Ale and standing; Kim, 10 Nov): a side craft in autumn and winter. `grain` rations of grain from the
  // household's surplus (above its floor, which holds the seed reserve) and `hours` of work in the house give a barrel, which keeps one season
  // (the good's perish, sim/stores) and serves `guests` guests; a household brews while it holds fewer than `stock` barrels. A barrel poured at
  // an occasion gives the host `standing` for `years` years, at most `maxBarrels` barrels counted (a cap of 0.2); each guest's memory of
  // it is SOCIAL.memories.ale.
  const BREW = { grain: 10, hours: 4, guests: 20, stock: 1, standing: 0.05, maxBarrels: 4, years: 3 };
  // The ale evening (VB-522; design.md, Where pawns meet): a holder whose household holds a barrel no occasion called at its farm needs
  // opens its house from the end of work to `until`, the small, frequent sibling of the feast. `call`: a holder's chance a day, times
  // (0.5 + sociability) and (0.5 + ambition), asked at its planning day's review; one evening a village a day. `reach`: the walking hours
  // between villages (sim/routes' table) within which a village's adults are asked. `come`: an adult's chance to come, times (0.5 +
  // sociability), (1 + its opinion of the host) and (1 - its walk / reach); counted until `guests` (a barrel's) have said yes. `mix`: the
  // floor for strangers among the partners drawn there (sim/encounters). `reach` 2, not the design's 1.5 (VB-522's runs, populous small
  // seed 7: at 1.5 a twelfth of the guests came from another village, at 2 a fifth, at 2.5 over a third).
  const ALE_EVENING = { call: 0.1, reach: 2, come: 0.25, guests: 20, mix: 0.5, until: 22 };
  // The season's rite (VB-522; design.md, Where pawns meet): on each village green, on day sday of `days`' seasons (spring day 1, summer
  // day 6, winter day 7), from `hour` for `hours`. An adult of the village, and of a lone farm within `reach` walking hours of a green,
  // comes at chance `come` + `piety` × its piety; work is not stopped for it. Its leader is the holder present highest in piety × standing;
  // each who came gains SOCIAL.ties.rite to it. `mix`: the floor for strangers there (sim/encounters).
  const RITE = {
    hour: 12,
    hours: 2,
    reach: 2,
    come: 0.3,
    piety: 0.6,
    mix: 0.2,
    spread: 5, // a village's own rite falls within this many days after the season's day (VB-775)
    days: [
      [0, 0],
      [1, 5],
      [3, 6],
    ],
  };
  // The gathering (VB-294; design.md, The gathering; Kim, 10 Nov): a village's effective hours to a host are the walk between the greens,
  // less `kin` hours for each household of kin in the villages that went there last winter (at most `kinMax`), less or plus up to
  // `disposition` hours by the pull between the two villages' holders, less `held` if it was held last winter, less `ale` an hour for each
  // barrel its host poured there (at most `aleMax`); a village goes to the host with the fewest, under TRAVEL.dayWalk. A gathering stands
  // with `least` villages or more; a host lodges `lodge` guests a farm, `goers` from each household of a village beyond `homeHours` of
  // walk. `dates`: when it is held, by the key of its date (`harvest`: winter days 1 to 3, after the threshing; VB-809's custom adds others).
  // Going there (VB-295): a household's goers are its holder, its unmarried of marrying age and, by wish, others of `wishAge` or more, each
  // at `wish` times (0.5 + sociability); at least one of `adult` years or more stays. A goer beyond homeHours lodges at a farm of the
  // host village, `house` in its house and `barn` in its barn (their sum is `lodge`); the barn is dry and its cold `barnCold` of the open
  // sky's, the beasts' warmth. The days on the green run from `from` to the end of work.
  const GATHERING = {
    kin: 0.5,
    kinMax: 2,
    disposition: 2,
    held: 1,
    ale: 0.25,
    aleMax: 1,
    least: 3,
    lodge: 10,
    goers: 3,
    homeHours: 2,
    dates: { harvest: { season: 3, from: 0, days: 3 } },
    wish: 0.3,
    wishAge: 12,
    adult: 16,
    house: 4,
    barn: 6,
    barnCold: 0.5,
    from: 9,
    mix: 0.5, // VB-296: the floor added to a partner's weight on the green, so that strangers of other villages are drawn (an ale evening's)
    contacts: 6, // the most new contacts a pawn makes a day of it (Kim, 10 Nov)
    tie: 0.15, // added to a village's tie to its culture's centre when both go to one gathering (VB-296)
  };
  const HELP = {
    // a holder wants floorDays and its own reserve (TRAITS.acts.generosity.reserve, by its generosity: 0 to 40 days; VB-520) of the
    // household's food in store before giving
    floorDays: 20, // the floor (VB-182): no deal takes a household below its seed reserve and this many days of its need
    answerDays: 1, // an offer of goods (a gift, an ask) the played pawn must answer stays open this many days (sim/offers, VB-690)
    askLeast: 1, // an ask for food that would be given less than this many rations is answered no (sim/exchange, VB-691)
    askBelow: 3,
    askDays: 12, // a household asks when its spare grain covers fewer days than this, once a season, for food until the
    // next harvest and at least this many days (VB-222)
    storeShare: 0.25,
    storeTarget: 0.5, // years of its village's need the store is filled to, and under which its common fields are sown (VB-457)
    tieGain: 0.5, // share of its surplus a household gives the village store each year; tie gain between the holders
  };
  // ---- goodwill (sim/relations, VB-217; design.md, The gift): a balance between two pawns in customary rations ----
  const GOODWILL = {
    halfLife: 4,
    forget: 1,
    cap: 32, // a balance halves in 4 years (tunable from 2 to 20), read when needed; one under a ration is
    // forgotten; counterparts a pawn
    share: 0.5, // the share of a holder's balances that passes to the new holder at a retirement or a holder's death
    limitDays: 30, // allowance: what the receiver owes beyond this many days of its household's need counts against it
    acts: true, // slice 1 booked and showed goodwill only; slice 4 switched on its terms (VB-220): gratitude, and allowance's two
    gratitude: 0.15,
    scale: 20, // a debtor's opinion of its creditor gains gratitude x s / (s + scale) for a balance of s rations
    opinionRations: 10, // allowance: the giver's opinion of the receiver (-1 to 1) times this many rations
    // an hour of help given to another household books this many rations to the worker's credit, owed by the head helped (VB-704):
    // the worth table's day's work, 3 rations for 8 work hours (design.md, Remedies: "Debts are paid with")
    hour: 3 / 8,
  };

  // tiles per game hour on foot, on meadow (design.md, The journey scale; Kim, 15 Nov; VB-780): it was 3, then 12 (the distance review, Kim,
  // 12 Nov); at 8 the neighbouring village is 2.5 to 3 hours off and the far side of the medium island days away (VB-444's plan, section 5)
  const SPEED = 8;
  // Shares for the siblings who do not inherit (heirs.js, transfer): the farm is worth perField per field and perGrain per ration in the store;
  // the reserve (reserveBase plus reservePerMember per member) is never paid out.
  const SHARES = {
    perField: 120,
    perGrain: 0.5,
    reserveBase: 60,
    reservePerMember: 30,
    // animals pay a share at their customary worth (Norms.norm('worth'), VB-299) when grain runs short; a new household takes a cow and
    // `start.ewes` ewes from its old one (VB-140)
    start: { ewes: 2 },
  };
  // Moving to new land (sim/settle; docs/review-expansion.md): a waiting adult of ages[0]..ages[1] in a crowded village leaves with a chance of
  // chance[k] after k + 1 rounds of waiting there (the last from then on); each waiting sibling follows with `follow`, at most maxFollow. A party
  // needs provisionDays of its rations and seed for one field. A new village lies within `hours` walking hours of home's green along a
  // trail the party would blaze (a wooded tile with no path at a path's cost; VB-786, docs/plans/VB-445.md: 6 hours is there and back in a
  // day; the 10 to 30 steps it replaces were 10 hours at 3 tiles an hour when decided, 3.75 at 8), on meadow or wood (wood read as the
  // meadow it becomes when grubbed), its house at least `apart` steps from any house, green or field, with a block of `fields` fields at
  // least `fertility` times as fertile as home's and a wood (WOOD.least wooded tiles within WOOD.reach); sites score siteScore +
  // fieldWeight × the block's fertility − perHour an hour (0.15 a step at 8 steps an hour), and the best `candidates` by the first and last
  // terms are tried; a site's water (VB-1583; design.md, Water by the site, The site's access: Proposed, Kim's starting value of 23
  // November) takes perFetch a daily hour of its fetch off the score, twice an hour of nearness, which is paid once; `shown`: the best
  // sites a played leader chooses among (sim/settle sites). A small village (VB-147) has 1..smallFarms farms, its green within `join`
  // hours of home's by the villages' table.
  // Spacing (stability review, VB-154): `apart` was 3, and a new village's house lies at least centreApart hex steps from every village
  // centre, the only near bound. Provisions were 36 days, which left no margin before the first threshing; 42 agreed by Kim, 2 Nov.
  const SETTLE = {
    ages: [18, 45],
    chance: [0.3, 0.6, 0.8],
    follow: 0.5,
    maxFollow: 2,
    provisionDays: 42,
    hours: 6,
    apart: 5,
    centreApart: 12,
    fields: 3,
    fertility: 0.9,
    fieldWeight: 3,
    perHour: 1.2,
    perFetch: 2.4,
    shown: 5,
    candidates: 40,
    smallFarms: 3,
    join: 6,
  };
  // The moving round as offers (VB-692; docs/plans/VB-682.md, section 2; Proposed): it lasts `passes` days from autumn day `day` + 1 (sday
  // `day`, 0-based: days 11 to 13), each day every village in its step; a village's step answers the offers due to its people in `order`
  // (a home handed on before a match that needs it, land before the party that would leave for want of it, service last, for those
  // nothing else took); one refused on a day asks anew that evening, due the next day; what is open after the last day lapses.
  // The asking day (VB-823; plan, sections 2 and 7): a pawn who seeks reviews its wish once a season, on season day id mod SEASON_DAYS
  // at `hour`, and makes an offer due at the round; nobody is asked on one basis by more than `held` open offers (the next asker turns
  // to its next best), and an asking weighs at most `pool` candidates, the nearest villages first.
  // The man's side asks a match; a woman's side that holds no offer asks from the asking day of season `womenFrom` (1: the summer) until
  // the round, and a woman who holds a farm and speaks for herself asks as a man does (VB-693; plan, section 4.1).
  const ASK = Object.freeze({
    passes: 3,
    day: 10,
    order: Object.freeze(['handover', 'match', 'land', 'party', 'place']),
    hour: 6,
    held: 5,
    pool: 40,
    womenFrom: 1,
  });
  // The village's wood (VB-326; design, Land and ecology, The village's wood; Agreed, Kim, 10 Nov): an allotted area of wooded tiles, v.wood
  // (sim/territory), perHousehold tiles for each live household of the village (a household fells about 11 trees a year and a tile of 60 to 80
  // regrows 2 to 2.7), at least `least` and at most `cap`; the nearest within `reach` walking steps of the centre. Where reach holds too few,
  // the rest of the area lies beyond it, up to `far` steps (VB-421). A trip cuts on a tile drawn evenly among those keeping more than `thin`
  // of their trees, else among any (sim/forest). A generated village or a settlers' site needs `least` wooded tiles within `reach`. The two
  // reaches are distances (Kim, 16 Nov; VB-781 gives them hours), written at 3 steps an hour, when `far` was 9 hours' walk out: at SPEED 8
  // and the journey scale's dear ground (VB-780), `reach` is 1.5 hours out over meadow, 6 through pathless broadleaf forest and 2.4 on the
  // path the wood trips wear (worn in at seeding); `far` is 5.4 hours out on a path, and out of a day's work without one.
  const WOOD = { perHousehold: 5, least: 6, cap: 150, reach: 12, far: 27, thin: 0.25 };
  // Peat (VB-367; design.md, Fuel; Proposed, slice 6's plan, 11 Nov): cut in summer (sim/dig) and burnt in place of wood once dry, from the
  // season after it was cut. A load of peat is dug a trip (ECON.woodPerTrip units, as a firewood trip brings); `worth` of wood a unit burns
  // as. A household cuts when the village's wood lies more than `far` steps from its house, or from day `late` of summer (summer's end
  // nears) while its fuel pile is under the winter's goal, up to the shortfall.
  const PEAT = { worth: 0.5, far: 8, late: 6 };
  // What building takes (sim/building; design, Land and ecology, Timber; Agreed, Kim, 10 Nov): a cottage's or booth's walls take `timber` loads of
  // wood (six trees). A stone foundation (VB-332; design, Land and ecology, Stone; Agreed, Kim, 11 Nov) takes `foundationStone` loads from the
  // household's heap and `foundationHours` of work at the house; stone is picked (`pickHours` a load) on a meadow tile holding more than
  // `keepStones` (what a meadow keeps, sim/meadows) or quarried (`quarryHours` a load) on `quarryOn`, within `stoneReach` walking steps
  // and `stoneWalk` hours' walk of the house (proposed, 11 Nov). The village's well (VB-058; sim/green) takes its stone from its
  // households' heaps, carried to the green, and its hours and stone are by the depth of the green's ground (world/water, VB-1584);
  // the green is cleared in `greenHours` and the sweep raised in `sweepHours` (Agreed, Kim, 30 Oct); the green lies within `greenReach`
  // walking steps of a farm's house (VB-058's own choice).
  // quarryOn: the biomes stone is quarried on, each with the rocks quarried there (null: any) (VB-733, the plan of VB-702's D7; Proposed):
  // any rock on the hills and mountains of VB-332, and on heath, thin soil over rock, the bedded building stones, limestone and sandstone,
  // as limestone was quarried on flat ground (Gotland, Öland); flat granite lies under till.
  const BUILD = {
    quarryOn: Object.freeze({
      [B.HILLS]: null,
      [B.MOUNTAIN]: null,
      [B.HEATH]: Object.freeze(['limestone', 'sandstone']),
    }),
    timber: 18,
    foundationStone: 12,
    foundationHours: 40,
    pickHours: 2,
    quarryHours: 4,
    keepStones: 80,
    stoneReach: 12,
    stoneWalk: 3,
    greenHours: 10,
    sweepHours: 10,
    greenReach: 4,
    // a barn (VB-255; Kim, 10 Nov: QUESTION_ARCHIVE.md, "VB-255: the barn as a project"): a second store building on the farm's block,
    // built by a plot's cottage's stages (hours as theirs) with `timber` loads felled in the village's wood for its walls; a farm with one
    // loses `loss` times the hay to spoilage (HERD.hayLoss, sim/byre), the grain no longer (VB-1898: the storehouse keeps it)
    barn: Object.freeze({ timber: 40, hours: Object.freeze([30, 60, 30]), loss: 0.5 }),
    // a storehouse on posts (VB-1898; design.md, Settlements and look, Farmstead, Decided 27 Nov; its cost Proposed, as the byre's): its
    // walls take `timber` loads felled in the village's wood, `hours` its walls' and its roof's (sim/storehouse); a farm with one loses
    // `loss` times the grain to spoilage (sim/hunger storeLoss)
    storehouse: Object.freeze({ timber: 20, hours: Object.freeze([40, 20]), loss: 0.5 }),
    // a byre (VB-1665; Kim, 24 Nov 2026: "a byre of about 20 timber loads and 60 hours houses six"): its walls take `timber` loads felled
    // in the village's wood; `hours` its walls' and its roof's (sim/byrehouse); it houses HERD.byre places
    byre: Object.freeze({ timber: 20, hours: Object.freeze([40, 20]) }),
    // the timber house (VB-1664), built up from a cottage (sim/timberhouse): its frame takes `timber` loads felled in the village's wood;
    // `hours` its frame's and its roof's, about 150 in all; its room and its smaller fire are sim/house's ROOM; a head left to its own rule
    // begins one only with `hands` working hands or more (sim/upgrade ownTimber)
    timberHouse: Object.freeze({ timber: 30, hours: Object.freeze([100, 50]), hands: 3 }),
  };
  // The village's office (VB-314; design.md, The alderman): standing gained while in office, and what the election weighs: a candidate's
  // standing (`standing` the weight of one point of it) against a voice's opinion of him (opinions run -1 to 1).
  // keepDays: the days of work each other farm's household owes the alderman's from one autumn meeting to the next; keepShare: the share of its
  // surplus it sets aside for him at the moving round (the practice `keep`, VB-463; about 0.7 of a household's need, a village's keep in all).
  const OFFICE = { standing: 0.3, weighStanding: 0.25, keepDays: 4, keepShare: 0.1 };
  // Claims on land (sim/claims, sim/territory; claims review, docs/review-claims.md; numbers Proposed): an unrealised claim fades over `years`
  // without work or renewal; a village claims outland within `outReach` walking steps of its green, `outPerFarm` tiles an occupied farm; a
  // household may contest a stake weaker than `contestBelow`; a family's birthright on its empty farm lasts `birthrightYears`; a household
  // that lost a dispute leans for `grievanceYears` towards the rules that would have let it win.
  // A village short of outland presses a richer neighbour for at most `pressPerMeeting` tiles a meeting; a cairn keeps the village that lost a
  // border dispute from pressing for that tile again for `cairnYears`. An empty farm may be claimed from a village within `farmHours`
  // walking hours of the farm's village, there and back in a day, since the claimant's household mends it from home (VB-290; it was 15 hex
  // steps), under the customs that let outsiders claim (VB-033); the claimants start
  // with seed for its fields and `farmFood` days of food; they mend it at role priority `claimantPrio`, their housemates help at `helperPrio`.
  const CLAIMS = {
    years: 3,
    outReach: 8,
    outPerFarm: 8,
    contestBelow: 0.5,
    birthrightYears: 20,
    grievanceYears: 5,
    pressPerMeeting: 4,
    cairnYears: 3,
    farmHours: 6,
    farmFood: 60,
    claimantPrio: 9,
    helperPrio: 5,
  };
  // ---- the twelve traits (VB-519; design.md, People, Traits, talk and stories; Customs and culture, A culture's values) ----
  // A pawn's traits, in the order of `names`: four values, four of temperament, four aptitudes. Every trait passes on by one equation,
  // mean + b × (the two parents' mean − mean) + a normal chance of spread sd × √(1 − b²/2), so its spread stays `sd` from one generation to
  // the next; within `bounds`. b: the share of the parents' departure from the mean a child keeps (twin studies, 0.4 to 0.5, for
  // temperament; values from those who raised it and from the many, Cavalli-Sforza and Feldman 1981). setAge: the age its values set for
  // good. lean: a hungry childhood (stunting) takes up to `body` from body and `wits` from wits, in proportion to the days of `days` the
  // child went hungry (its hunger at `hunger` or more). label: the reference distribution's 15th and 85th percentiles, beyond which a
  // trait is named. culture: the means of the four values an archetype's culture starts with (Old Nordic: a culture of one's word).
  const TRAITS = Object.freeze({
    names: Object.freeze([
      ...['generosity', 'piety', 'ambition', 'honour'],
      ...['sociability', 'temper', 'diligence', 'openness'],
      ...['body', 'hands', 'husbandry', 'wits'],
    ]),
    sd: 0.15,
    b: Object.freeze({ values: 0.6, temperament: 0.45, aptitudes: 0.5 }),
    setAge: 15,
    lean: Object.freeze({ body: 0.2, wits: 0.1, days: 96, hunger: 0.5 }),
    bounds: Object.freeze([0.02, 0.98]),
    label: Object.freeze({ low: 0.345, high: 0.655 }),
    culture: Object.freeze({ oldNordic: Object.freeze({ generosity: 0.5, piety: 0.5, ambition: 0.5, honour: 0.6 }) }),
    // What a trait does (VB-520; design.md, The twelve traits and the rules each changes): acts.<trait>.<rule> is [the value at 0, at 1],
    // linear in the trait between (Traits.act), its midpoint the rule's value before traits, so a pawn at 0.5 acts as every pawn did.
    // reserve: the holder's own reserve beyond HELP.floorDays, in days of the household's need (it was drawn per pawn, 0 to 40); one
    // without a holder keeps the most; feast: times FEAST.share of its surplus it lays out at a feast (VB-458). anchor: times the pull of
    // what was learned young (sim/attitudes' P.anchor). settle: times the pressure (the
    // rounds waited in a crowded village) a pawn needs before it wishes to leave at the moving round (sim/settle reads SETTLE.chance there).
    // breach: times the memories of a breach (`breach`, SOCIAL.memories) as this pawn feels them. lie (honour and ambition, VB-554): times
    // STORY.lie, the chance a pawn with an enemy makes up a story about it (2 × (1 − honour), 1 at 0.5 as every act; 0.5 + ambition);
    // judge: times the counter-story
    // a lie it knew better than gives of the liar (0.5 + honour; sim/stories). talk: times the chance to start a talk at
    // its turn (SOCIAL.talk.chance), at most 1; seek: times SOCIAL.seek. idleWait: times IDLE.wait (the design's 4 to 2 hours about its 3).
    // malleability: times a custom's malleability in its attitudes' drift; cause: times the chance to take up a cause. recover: times
    // HEALTH.recover (2.5 to 3.5). Temper acts through chemistry and the quarrel (SOCIAL.chemistry, SOCIAL.talk.quarrel); wits and
    // husbandry through a head's skill (sim/traits).
    acts: Object.freeze({
      generosity: Object.freeze({ reserve: Object.freeze([40, 0]), feast: Object.freeze([0.5, 1.5]) }),
      piety: Object.freeze({ anchor: Object.freeze([0.5, 1.5]) }),
      ambition: Object.freeze({ settle: Object.freeze([1.5, 0.5]), lie: Object.freeze([0.5, 1.5]) }),
      honour: Object.freeze({
        breach: Object.freeze([0.5, 1.5]),
        lie: Object.freeze([2, 0]),
        judge: Object.freeze([0.5, 1.5]),
      }),
      sociability: Object.freeze({ talk: Object.freeze([0.5, 1.5]), seek: Object.freeze([0.5, 1.5]) }),
      diligence: Object.freeze({ idleWait: Object.freeze([4 / 3, 2 / 3]) }),
      openness: Object.freeze({ malleability: Object.freeze([0.5, 1.5]), cause: Object.freeze([0, 2]) }),
      body: Object.freeze({ recover: Object.freeze([2.5 / 3, 3.5 / 3]) }),
    }),
    breach: Object.freeze(['claim', 'border', 'refusedMatch', 'crop', 'stayedAway', 'failedUs']),
  });
  return {
    // what it gives the page through the Sim facade (src/sim.js joins the lists, VB-1944)
    PAGE: ['cal', 'DAY', 'YEAR', 'YEAR_DAYS', 'SEASON_DAYS', 'ECON', 'TRAVEL', 'WORK', 'dark', 'HERD', 'CLAIMS'],
    TRAITS,
    DAY,
    SEASON_DAYS,
    YEAR_DAYS,
    YEAR,
    TICKS,
    cal,
    WORK,
    dark,
    ECON,
    FIELDS,
    FISH,
    AGES,
    DEER,
    MALE,
    FEMALE,
    patronym,
    HUNGER,
    HEALTH,
    ILLNESS,
    TESTBED,
    MARRIAGE,
    HANDOVER,
    HELP,
    GOODWILL,
    TRAVEL,
    LYING,
    WINTER,
    BOOTH,
    HERD,
    stalled,
    FOODS,
    SPEED,
    BREW,
    ALE_EVENING,
    RITE,
    GATHERING,
    SHARES,
    SETTLE,
    ASK,
    CLAIMS,
    WOOD,
    PEAT,
    BUILD,
    OFFICE,
  };
})();
