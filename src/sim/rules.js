// @sys sim/rules: calendar, economy, roles and their work, names and other simulation constants
VB['sim/rules'] = (() => {
  const { B } = VB['gen'];
  // ---- calendar: 4 seasons of 12 days; one game hour is the base unit of time ----
  const DAY = 24,
    SEASON_DAYS = 12,
    YEAR_DAYS = SEASON_DAYS * 4,
    YEAR = YEAR_DAYS * DAY;
  // The clock counts whole 6-minute steps (st.tick, sim/clock; VB-235): TICKS of them an hour. The hour, the day and the year the clock is
  // working through are found from the count, never by adding a tolerance to st.t.
  const TICKS = 10;
  const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
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
    villageStoreLoss: 0.2, // the village store (sim/help) loses a fifth a year, as grain kept a second year
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
  // ---- crops (VB-346; design.md, Crops and rotations): one row each, and a field holds the key of its crop (`fd.crop`). A plain table here,
  // not the registry's: nothing yet changes a row at run time, so it is no rule with contributions; it never enters saved state. Barley is today's
  // grain. Days are game days. yield: rations a field gives at fertility and soil 1; seed: rations sown on a field (a 4:1 ratio); sow: the window
  // [season, first day, last day]; ripe: days from sowing to ripe; wear: the soil a harvest takes (the frost's day is the
  // calendar's, sim/clock FROST; it takes every crop but a winter one). hours: the work of each stage; KINDS plow, sow, weed, reap and thresh (sim/kinds)
  // read them from here. ----
  const CROPS = {
    barley: {
      yield: 100,
      seed: 25,
      sow: [0, 0, 9],
      ripe: 26,
      wear: 0.08,
      weeds: 2,
      hours: { plow: 20, sow: 2, weed: 5, reap: 15, thresh: 20 },
    },
    // winter rye (VB-348): sown in autumn days 1 to 6, it stands the winter and the frost (winter), and is ripe in summer days 7 to 12; a
    // ripe field still standing on `lost` [season, day] is lost; weeds: the rounds of weeding it gets (barley 2, at ECON.weedDays)
    rye: {
      yield: 100,
      seed: 25,
      sow: [2, 0, 5],
      ripe: 42,
      wear: 0.08,
      winter: true,
      lost: [2, 0],
      weeds: 1,
      hours: { plow: 20, sow: 2, weed: 5, reap: 15, thresh: 20 },
    },
    // peas (VB-349): a spring crop, the soil mended `gain` a crop (to SOIL.start; a field manured above it keeps its soil) and no wear; hoed
    // (plow), pulled (reap) and threshed in fewer hours; lost to the frost as barley is; cooked in the pot as the food `pulses`, a source of its own
    peas: {
      yield: 60,
      seed: 20,
      sow: [0, 0, 9],
      ripe: 18,
      wear: 0,
      gain: 0.04,
      weeds: 2,
      hours: { plow: 20, sow: 2, weed: 5, reap: 10, thresh: 10 },
    },
    // fallow (VB-348), a course and not a crop: never sown, no seed and no grain (sim/stores holds only the rows with seed); tilled once in
    // `sow`, the summer; at the year's end a field that stood fallow through the summer gains `mend` of soil if tilled, half if not, to
    // at most SOIL.start
    fallow: { fallow: true, sow: [1, 0, SEASON_DAYS - 1], mend: 0.08, hours: { plow: 10 } },
  };
  // ---- rotations (VB-350; design.md, Crops and rotations, The rotation): a field holds one (`fd.rotation`, a key) and the step it is at
  // (`fd.step`); its crop is the step's course (a key of CROPS, fallow among them). A plain table, as CROPS. Barley every year is today's
  // farming; in three courses a field is fallow a year, then rye sown that autumn, then barley the spring after its rye is in. ----
  const ROTATIONS = {
    every: { courses: ['barley'], label: 'barley every year' },
    two: { courses: ['barley', 'fallow'], label: 'two courses' },
    three: { courses: ['fallow', 'rye', 'barley'], label: 'three courses' },
    peas: { courses: ['barley', 'peas'], label: 'barley and peas by turns' },
    peasRye: { courses: ['peas', 'rye', 'barley'], label: 'peas, rye, barley' },
  };
  // ---- fields a household wants (balance review, 1 Nov 2026): enough for `want` times a year's rations at `expect` of the full yield, but no more
  // than its hands can till: perHand fields a working adult (14 to 59, not retired) and oxenHands more for a team of oxen (VB-138); no fixed cap ----
  // room (stability review, VB-154): a new farm (a plot, a settler's farm, a new village) needs this many free farmable tiles within FIELD_REACH
  // walking steps of its house besides its first field, for more fields, meadow and pasture; so fewer farms fit between villages.
  const FIELDS = { want: 1.1, expect: 0.75, perHand: 2, oxenHands: 1.5, room: 6, memory: 8 };
  // ---- fishing (VB-117; Kim, 10 Nov, QUESTION_ARCHIVE.md, VB-117 to VB-119, question 1): from a bank within `reach` walking steps of the
  // house; a trip brings home `trip` rations times the water tile's stock and lowers a river or small lake tile's stock by `take`, which
  // recovers `recover` a day; lakes of `bigLake` tiles or more and the sea do not run down. Water holds fish at a stock of `least` or more (a
  // trip's take). Posted from spring day `from + 1` to the end of autumn; a second trip while the household's spare food covers fewer than
  // `secondDays` days of its need ----
  const FISH = { reach: 6, trip: 4, take: 0.1, recover: 0.02, bigLake: 20, least: 0.1, from: 2, secondDays: 12 };
  // ---- gathering (VB-118; Kim, 10 Nov, QUESTION_ARCHIVE.md, VB-117 to VB-119, question 2): berries, mushrooms and nuts on a forest or heath tile
  // within `reach` walking steps of the house, with at least `least` (a trip's take) left; a trip brings home `trip` rations times the tile's
  // stock and lowers it by `take`; every stock is full each spring. Posted from summer day `from` + 1 to the end of autumn; its second trip and
  // urgency are fishing's (FISH.secondDays, MATCH.urgency) ----
  // The ages of life, in one table (VB-686): each row says what the age is for; the modules read it, none writes its own.
  //   hands [14, 60): a working hand: strong enough for a season's labour from 14 (a boy at the plough, a girl at the dairy; the
  //     ration of an adult starts there too), and past it at 60, when a body tires; the hands counted for fields, herds, help and service.
  //   major 18: of age: holds a household and goes to law without a guardian or trust; heirs and settlers of a party are counted from it.
  const AGES = Object.freeze({ hands: Object.freeze([14, 60]), major: 18 });
  const FORAGE = { reach: 5, trip: 2.5, take: 0.2, least: 0.2, from: 5 };
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
    hunt: { reach: 6, hours: 4, chance: 0.3, least: 1, meat: 3, minAge: 14, hide: 1 },
    // leather for shoes and harness (VB-424): a household wants `leather` hides a year for each of its people, so a kill's hide is worth
    // to it what is lacking of them, at the fair or in a gift
    leather: 0.25,
  };
  const FERTILITY = { [B.MEADOW]: 1, [B.HEATH]: 0.65, [B.HILLS]: 0.7, [B.MARSH]: 0.5 };
  // ---- rivers (src/gen/rivers.js): no house or field on a river tile; a field next to one is watered from it ----
  // irrigation: extra fertility of a field next to a river tile; site: added to a village site's score by steps to the nearest river tile (0..3).
  const RIVER = { irrigation: 0.2, site: [0, 10, 10, 5] };
  const farmable = (w, i) => i >= 0 && !w.water[i] && !w.river[i] && FERTILITY[w.biome[i]] !== undefined;
  const byRiver = (w, i) => {
    for (let k = 0; k < 6; k++) {
      const j = w.nb[i * 6 + k];
      if (j >= 0 && w.river[j]) return true;
    }
    return false;
  };
  // Fertility of a farmable tile as a field: by its biome, and more when a river waters it.
  const fertility = (w, i) => FERTILITY[w.biome[i]] * (byRiver(w, i) ? 1 + RIVER.irrigation : 1);

  // ---- roles and work: each role ranks types of work from 0 to 10 (`work`), with exceptions for single job kinds (`except`); sim/kinds gives
  // every kind its type and fills in `prio`, each role's rank of every kind. Herding (VB-136; Kim, 31 Oct): child 8, daughter 6, son 5,
  // retired 4, farmhand 3, farmer 2, and none for the mistress and the maid. Hunting (VB-139) is foraging for the men alone: none for the
  // women, the retired and children. A village duty (VB-058: the green and well; Kim, 30 Oct): farmhand and son 6, farmer 5, mistress, maid
  // and daughter 3, below the farm's own work; none for the retired and children. A village work day (VB-120; Kim, 10 Nov): 8 for every
  // adult whatever the role (WORKDAY.prio), none for children. Jobs carry an owner that decides who may take them ----
  const ROLES = {
    farmer: {
      title: 'Farmer',
      sv: 'bonde',
      work: {
        workday: 8,
        duty: 5,
        tilling: 10,
        tending: 10,
        harvest: 8,
        threshing: 8,
        wood: 7,
        upkeep: 6,
        household: 2,
        husbandry: 3,
        foraging: 3,
        herding: 2,
      },
      except: { reap: 9, cook: 1, slaughter: 8, grind: 1 },
    },
    wife: {
      title: 'Mistress of the house',
      sv: 'husfru',
      work: {
        workday: 8,
        duty: 3,
        tilling: 2,
        tending: 5,
        harvest: 6,
        threshing: 2,
        wood: 2,
        upkeep: 2,
        household: 9,
        husbandry: 9,
        foraging: 4,
      },
      except: { reap: 7, cook: 10, mow: 4, slaughter: 2, milk: 10, fish: 2, hunt: 0, grind: 7 },
    },
    farmhand: {
      title: 'Farmhand',
      sv: 'dräng',
      work: {
        workday: 8,
        duty: 6,
        tilling: 9,
        tending: 6,
        harvest: 8,
        threshing: 8,
        wood: 9,
        upkeep: 7,
        household: 3,
        husbandry: 4,
        foraging: 6,
        herding: 3,
      },
      except: { cook: 0, slaughter: 8, gather: 3, grind: 1 },
    },
    maid: {
      title: 'Maid',
      sv: 'piga',
      work: {
        workday: 8,
        duty: 3,
        tilling: 1,
        tending: 4,
        harvest: 6,
        threshing: 2,
        wood: 2,
        upkeep: 1,
        household: 10,
        husbandry: 10,
        foraging: 5,
      },
      except: { reap: 7, cook: 8, mow: 4, slaughter: 2, fish: 2, hunt: 0, grind: 7 },
    },
    son: {
      title: 'Son of the house',
      sv: 'son',
      work: {
        workday: 8,
        duty: 6,
        tilling: 9,
        tending: 6,
        harvest: 8,
        threshing: 8,
        wood: 9,
        upkeep: 7,
        household: 3,
        husbandry: 3,
        foraging: 7,
        herding: 5,
      },
      except: { cook: 0, slaughter: 7, gather: 3, grind: 1 },
    },
    daughter: {
      title: 'Daughter of the house',
      sv: 'dotter',
      work: {
        workday: 8,
        duty: 3,
        tilling: 1,
        tending: 4,
        harvest: 6,
        threshing: 2,
        wood: 2,
        upkeep: 1,
        household: 10,
        husbandry: 9,
        foraging: 6,
        herding: 6,
      },
      except: { reap: 7, cook: 8, mow: 4, slaughter: 2, fish: 2, hunt: 0, grind: 6 },
    },
    retired: {
      title: 'Retired',
      sv: 'undantag',
      work: { workday: 8, tending: 2, threshing: 2, upkeep: 2, household: 3, husbandry: 3, foraging: 3, herding: 4 },
      except: { cook: 4, slaughter: 2, hunt: 0, grind: 3 },
    },
    child: {
      title: 'Child',
      sv: 'barn',
      work: { harvest: 3, foraging: 5, herding: 8 },
      except: { water: 6, weed: 5, haul: 4, rake: 4, hay: 4, mow: 0, hunt: 0 },
    },
  };
  // Children of 7 to 13 work at a reduced rate: 0.3 at 7, rising 0.1 a year to 0.9 at 13; under 7 they take no jobs.
  const CHILD = { from: 7, base: 0.3, perYear: 0.1 };
  const workRate = (role, age) => (role === 'child' ? Math.min(1, CHILD.base + CHILD.perYear * (age - CHILD.from)) : 1);
  // Who clears a new plot for the village (see sim/expansion): by role; those waiting for the plot take 9 whatever their role.
  const PLOT_PRIO = { waiting: 9, farmhand: 7, maid: 7, son: 5, daughter: 5, farmer: 3 };

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
  const DIRNAME = ['Öster', 'Norr', 'Norr', 'Väster', 'Söder', 'Söder'];

  // Annual death hazard at age a (years, may be fractional): Gompertz-Makeham for adults plus a juvenile term that falls with age (Siler 1979),
  // so that about 20% die before age 1 and a third before 15.
  const hazard = (a) => 0.006 + 0.0007 * Math.exp(0.07 * a) + 0.381 * Math.exp(-1.265 * a);

  // ---- births: natural fertility of married women (Coale and Trussell 1974), relative to ages 20-24; times in game days ----
  const BIRTH = {
    peak: 0.015,
    ageFactor: [0.89, 1, 0.94, 0.86, 0.7, 0.36, 0.05],
    from: 15,
    to: 50, // chance per day to conceive; factor per 5 years of age from 15
    pregnancyDays: 36,
    nursingDays: 48,
    boys: 105 / 205,
    childbedDeath: 0.01,
  };

  // ---- hunger: a member's hunger h (0..1) multiplies the death hazard by 1 + k(age) * h, and slows work by HUNGER.slow * h ----
  const HUNGER = { days: 12, slow: 0.4, marryBelow: 0.5, k: (a) => (a < 5 || a >= 60 ? 1.5 : a < 15 ? 0.6 : 0.3) };

  // ---- health: a pawn's health (0..100) is drained daily by hunger (h squared) and by a cold house (VB-327: `cold` times the day's cold,
  // 0..1), and restored by a full meal on a warm day; at 0 the pawn dies of starvation ----
  const HEALTH = { drain: 4, cold: 2, dry: 1, frail: 1.5, recover: 3, riskBelow: 50, riskSlope: 25, slow: 0.3 };
  // ---- illness (VB-1118, principle 19): a death the day's roll draws of a cause in `days` (the base hazard's causes; not hunger, which
  // health already shows) comes as an illness that runs that cause's days before it kills; while it runs the pawn's health falls by `fall`
  // over the course (sim/hunger), with no recovery, and no other roll is drawn for it. Kin see the pawn ailing, never the outcome.
  // VB-1246: a pawn also falls ill at an incidence of its own, `incidence` a year by the cause its age gives (above the roll's deaths,
  // which stay its share of the courses); such a course passes, its health falling by `passing` of `fall`, unless its health gives out.
  // First values (Proposed): an infant falls gravely ill about once in its first year, a child or an old pawn one year in three, a grown
  // one in ten; the hazard at 0, 30 and 80 is 0.39, 0.012 and 0.2 a year, so a course at those ages kills about two in five, one in nine
  // and two in three.
  // ---- crowding (VB-766; design.md, Balance loops and targets: Deaths; Kim, 16 Nov): living close costs lives, wherever it happens, and
  // stands in for disease until disease exists. A household's crowding is the people living in houses within `steps` hex steps of its
  // house, its own among them; its members' death hazard is multiplied by 1 + `per` for each beyond `free`, at most `max`. First values
  // (Proposed): `steps` 2, hexes round a house that count as living close; `free` 36, the people within them that cost nothing (about the
  // 99th percentile of a village house, 31 to 41); `per` 0.035, hazard added for each person beyond; `max` 2.5, the factor's ceiling. ----
  const CROWD = { steps: 2, free: 36, per: 0.035, max: 2.5 };
  // The scenario "The market town" (VB-778; a test bed, known to decay): `plots` plot households set within 2 steps of each other, at the
  // village with most people within `reach` hex steps (about a day's walk). Read at the start only; no rule reads it afterwards.
  const TESTBED = { plots: 8, reach: 15 };

  const ILLNESS = {
    days: { infancy: 2, childhood: 4, illness: 6, oldAge: 10 },
    fall: 60,
    incidence: { infancy: 1, childhood: 0.3, illness: 0.1, oldAge: 0.3 },
    passing: 0.5,
  };

  // ---- relationships (sim/relations; docs/review-relationships.md; VB-240, Kim 10 Nov): one pawn's opinion of another (-1..1) is derived:
  // the bond's value (kin, spouse, housemate), plus affinity, affinity.weight * compatibility * min(1, tie / affinity.known), the pair's
  // fixed compatibility shown as the two grow familiar, plus timed memories of things that happened. A memory gains v at each event, up to
  // cap, and fades to 0 over `days` from the last one.
  // Talk (VB-521: by turns): between 6:00 and 22:00 a pawn has a talk turn in the hours where (hour + id) % `every` is 0, four a day; at it,
  // of minAge or more and not carrying a load, it starts a talk at `chance` with one partner sim/encounters finds (`sample` drawn at most
  // outdoors), weighted by (1 + min(tie, 1)) * (1 + opinion), plus the encounter's mix; it may be drawn as a partner in any hour, once.
  // The talk is a chat, a good talk or cross words by weights 1, good * e^(2c) and cross * e^(-2c), c being the pair's compatibility (+kin
  // for kin and housemates): its kind is the bubble's, and leaves no memory. Two unmarried pawns aged within `young` count `youngBonus`
  // times in both the choice and the good talk. A talk adds ties.talk to the tie of both and shows a bubble for `bubbleHours`. closeFriend
  // and enemy: an opinion reaching them is a life event; leaving needs `back` past the line. friend and dislike are the page's words only.
  // seek: chance that an idle pawn walks to someone it likes who idles in its village (of seekSample drawn), rather than to the green or its yard.
  // An idle pawn the planner found no work looks again after wait[0] to wait[1] hours (VB-245; Kim, 10 Nov: 2 to 4, from 0.75 to 2). It hears of new
  // work meanwhile through the hourly refresh, looks again when its wait ends (a leg in sim/agents' queue, VB-473), and of an occasion by the asking.
  const IDLE = { wait: [4, 8] };
  const SOCIAL = {
    situational: { spouse: 0.3, parent: 0.3, child: 0.3, sibling: 0.2, housemate: 0.1 },
    memories: {
      bull: { label: 'Lent us the bull', v: 0.05, cap: 0.2, days: 3 * YEAR_DAYS }, // sim/herds: a cow calved by another farm's bull
      border: { label: 'Won the border from us', v: -0.1, cap: -0.3, days: 3 * YEAR_DAYS }, // sim/territory: lost a border dispute to their village (VB-157)
      claim: { label: 'Took our claim', v: -0.15, cap: -0.45, days: 3 * YEAR_DAYS }, // sim/stakes: their household took a stake of ours (VB-158)
      // sim/lifecycle: the pawn refused a match its spokesman made (consent's cost; design.md, Marriage as a negotiation; VB-293)
      ale: { label: 'Poured us ale', v: 0.05, cap: 0.2, days: 3 * YEAR_DAYS }, // sim/occasions: a barrel poured at a wedding or a funeral ale (VB-305)
      refusedMatch: { label: 'Refused the match I made', v: -0.2, cap: -0.4, days: 3 * YEAR_DAYS },
      // sim/courting: a head refused the match of a courting pair; each of the two remembers that head (VB-036; plan VB-682, 4.1)
      refusedCourting: { label: 'Refused our match', v: -0.2, cap: -0.4, days: 3 * YEAR_DAYS },
      // sim/marriage (VB-693; plan VB-682, 4.1): a spokesman, of the spokesman who refused the match he offered (not when hers took a
      // better offer, which is no slight); and one who yielded to a match made for it while it courted another, of its spokesman
      refusedSuit: { label: 'Refused the match I offered', v: -0.1, cap: -0.3, days: 2 * YEAR_DAYS },
      marriedAgainst: { label: 'Married me against my wish', v: -0.3, cap: -0.3, days: 5 * YEAR_DAYS },
      // sim/offers: a refusal of goods offered or asked for (VB-690) is a memory of both: the one refused, and, fainter, the one who refused
      refusedUs: { label: 'Refused what we offered', v: -0.1, cap: -0.3, days: 2 * YEAR_DAYS },
      refusedThem: { label: 'We refused them', v: -0.05, cap: -0.15, days: YEAR_DAYS },
      // sim/byre: an unherded herd got into the field through a broken stretch of fence; about the holder of the stretch's keeper (VB-136)
      crop: { label: 'Cattle in our crop', v: -0.1, cap: -0.3, days: 2 * YEAR_DAYS },
      // sim/agents: a helper finished a job of another household of its village, both ways with each adult there (VB-106; Kim, 10 Nov)
      worked: { label: 'Worked together', v: 0.05, cap: 0.3, days: YEAR_DAYS },
      // sim/workdays: a holder of the village whose household stayed away from a work day; each other holder with a tie to it (VB-120; Kim,
      // 10 Nov: a small negative memory fading over a year; the numbers are the agent's starting values)
      stayedAway: { label: 'Stayed away from the work day', v: -0.05, cap: -0.15, days: YEAR_DAYS },
      // sim/relations: cross words that became a quarrel, both ways (VB-520; design.md, The twelve traits: temper)
      quarrel: { label: 'Quarrelled with us', v: -0.1, cap: -0.3, days: YEAR_DAYS },
    },
    talk: {
      from: 6,
      to: 22,
      every: 4,
      chance: 1,
      minAge: 4,
      sample: 8,
      good: 0.15,
      cross: 0.08,
      kin: 0.15,
      young: [16, 30],
      youngBonus: 2,
      bubbleHours: 0.5,
      quarrel: 0.05, // a talk of cross words becomes a quarrel at this times the two tempers' sum (VB-520)
    },
    // Chemistry (VB-520; design.md, Chemistry): a pair's compatibility is personal × the seeded term + likeness × how alike the two are in
    // the four values and sociability (1 alike, 0 at `span`, the mean difference of two drawn at random, -1 at twice that) − friction ×
    // (the two tempers' sum − 1) − customs × the share of customs on which they lean to different options (each weighed by 1 − its
    // malleability), less the age gap, within -1..1. The last term is Like seeks like (Balance loops and targets; Decided, 12 Nov). The
    // design's first weights were 0.7, 0.5, 0.3, 0.3; personal 0.9 and friction 0.4 keep the shares of close friends, friends, dislikes
    // and enemies within a fifth of what they were (VB-520's five runs, populous small seed 7, 3 years).
    chemistry: { personal: 0.9, likeness: 0.5, friction: 0.4, customs: 0.3, span: 0.17 },
    // Familiarity (VB-127; docs/review-relationships.md, proposal B): a tie grows by `talk` a talk (VB-521: 0.8, a longer conversation at
    // four turns a day; it was 0.5), by `home` per 24 waking hours (the talk hours) two housemates spend in their house, counted once a
    // day, and by `work` for each job two pawns finish together; it halves every year. Near kin never fall below `kin`. A pawn keeps at
    // most `cap` ties, the strongest, kin always kept; ties under `forget` are dropped when the pawn's ties are put back on today's scale,
    // every `renorm` years.
    ties: { talk: 0.8, home: 1, work: 0.5, kin: 0.4, rite: 0.25, cap: 150, forget: 0.02, renorm: 4 }, // rite: to the rite's leader (VB-522)
    affinity: { weight: 0.6, known: 8 },
    friend: 0.25,
    dislike: -0.2,
    // VB-1106: at 0.1 one telling in five was a second telling of the same pair (populous small seed 7, 20 years); at 0.2, one in 75,
    // and a close friendship is left where the two are no longer friends (the friend line)
    back: 0.2,
    // The age of account (VB-1106): the lawful age of the Norse and Anglo-Saxon laws, 12, below which a child answered for nothing it
    // did. Between a pawn below it and anyone, chemistry counts only where it is liking (the opinion's affinity is not below 0), and
    // cross words become no quarrel: no memory, no event. A physical fact of childhood, not a custom.
    account: 12,
    closeFriend: 0.45,
    enemy: -0.5,
    seek: 0.5,
    seekSample: 4,
  };
  // ---- mood (VB-062; design.md, Traits, talk and stories: Mood): 50 plus its modifiers' values, within 0 to 100; shown, read by no rule ----
  // Starting values, each a feeling's weight on that scale (Kim, 30 Oct: "talked with a friend +5"). For a state, read from it: hungry,
  // `value` × the pawn's hunger while over `over`; cold, `value` × its household's cold (VB-327, cold's weight as hunger's until Kim sets
  // one); without water, `value` while its household's hh.dry is above 0 (VB-331); weak, `value` while health is under `under`. For an
  // event, kept `days` from it (pawn.mods): married; a child born, both parents; grieving at the death of a spouse, child or parent;
  // talked with a friend, read from the pawn's latest talk (agent.talk) with one it holds at SOCIAL.friend or above.
  const MOOD = {
    base: 50,
    hungry: { value: -20, over: 0.1 },
    cold: { value: -20 },
    dry: { value: -10 },
    weak: { value: -10, under: 50 },
    married: { value: 10, days: 12 },
    child: { value: 5, days: 12 },
    grieving: { value: -15, days: 12 },
    friend: { value: 5, days: 2 },
  };

  // ---- marriage: who is matched in the moving round (ages in years; the score is -|gap error| * gapWeight + village bonus + noise) ----
  // The founders' ages (VB-635; design.md, Starting scenarios): each couple's man is manMin to manMin+manSpan-1 years old, his wife
  // 1 to wifeYounger years younger and at least wifeMin; the two servants are servantMin to servantMin+servantSpan-1.
  const FOUNDERS = { manMin: 23, manSpan: 11, wifeYounger: 6, wifeMin: 19, servantMin: 16, servantSpan: 4 };

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
  // after a visit (VB-289); stay: the days a visitor stays as the other village's guest
  const TRAVEL = {
    load: 30,
    hand: 90,
    cart: 300,
    pace: { back: 0.9, hand: 0.8, ox: 0.6 },
    hay: 1 / 3,
    hayCart: 60,
    dayWalk: 12,
    stay: 1,
  };
  // ---- sleeping away from home (VB-783; design.md, Sleeping away from home): pack, the rations a pawn away carries at most (12 days of the
  // 30 rations a back carries, the rest of the load being tools and seed); walk, the walking hours there and back over which a place is
  // worked from a bed there rather than from home (a third of the working day) ----
  // asks: the households a visitor asks for a bed, one after the other (VB-1151), before he sleeps at the green
  const AWAY = { pack: 12, walk: 4, asks: 3 };
  // A booth (bod; VB-784; design.md, Moving to new land, The booth): a shelter of poles, bark and turf, `hours` of work and `wood` loads at its
  // tile, `sleeps` at most; unkept it wears `wear` of its condition a year (poles and bark: about three years) and is gone at none.
  const BOOTH = { hours: 12, wood: 2, sleeps: 4, wear: 1 / 3 };
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
    startMargin: 1.1,
    // the byre and the autumn count (sim/byre, VB-134): the count on autumn day 8 (doy 31) keeps what hay × margin feeds; old ages; meat a head
    // (Kim, 31 Oct); fodder hours (base, a head of cattle, a sheep); slaughter hours; fresh meat keeps freshDays, salt meat saltDays; salting
    // makes saltPerHour rations an hour; emergency meat is lean (half); a herd unfed starveDays running loses an animal a day
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
    // summer (day `eweEnd`, a doy), eweHours more milking hours a ewe; each sheep of a year or more gives a fleece on summer day 1 (doy `shear`)
    eweMilk: 0.05,
    eweHours: 0.03,
    eweEnd: 24,
    shear: 12,
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
    herding: {
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
  // ---- grazing pressure (VB-136; read by forest spread, VB-091): a tile at or above keepsOpen stays open; at or above thins, its trees
  // are thinned. Pressure is 1 a cow-hour (HERD.herding), halving each game year (sim/grazing). At populous medium, seed 7, year 5, the
  // grazed tiles' pressure runs p10 15, p50 87, p90 219, p99 385, max 628: keepsOpen is a herd's half day on the tile, or a pasture's
  // neighbour, within about a year (87% of grazed tiles); thins is a small herd's week a year, kept up (about the 90th percentile). ----
  const GRAZE = { keepsOpen: 20, thins: 200 };
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
    milk: { worth: 1, keeps: 1, source: 'milk', held: 'larder', raw: true }, // fresh milk keeps a day
    butter: { worth: 1, keeps: HERD.butterDays, source: 'milk', held: 'larder', raw: true },
    'dried fish': { worth: 1, keeps: YEAR_DAYS, source: 'fish', held: 'larder', raw: true }, // hung on the rack (VB-300); also cooked in the winter's pot
    fish: { worth: 1, keeps: 3, source: 'fish', held: 'fresh', raw: false }, // the catch (VB-117), cooked
    gathered: { worth: 1, keeps: 3, source: 'gathered', held: 'fresh', raw: true }, // berries, mushrooms and nuts (VB-118)
  };
  // ---- soil (VB-137): a field's soil multiplies its yield; each reaped crop wears it by `wear` to `floor`; a load of manure, carted to a field in
  // stubble or hoed in spring days 1 to 6 (sday window), raises it by perLoad to `cap`. Fodder collects loads a stall day: a head of cattle, a sheep.
  // The heap loses `rot` of what lies on it in a year (balance review). perLoad 0.02 would make about 3 head of cattle, not 1.5, hold 3 fields, but
  // cost a quarter more hungry days over 8 seeds, so it stays at 0.04 until Kim chooses (QUESTIONS.md). A field broken on ground never farmed
  // (w.dev 0) starts at `fresh`, above the cap: virgin and burnt-over land gave far more its first crops (VB-149, docs/review-expansion.md) ----
  const SOIL = {
    start: 1,
    fresh: 1.4,
    floor: 0.75,
    perLoad: 0.04,
    cap: 1.15,
    cattle: 0.2,
    sheep: 0.04,
    window: [0, 5],
    rot: 0.5,
  };
  // ---- tilth (VB-717; docs/review-yields.md, 4): a field's slow soil, built by dung and fading over decades. Estimates, with no medieval
  // Nordic source. `perLoad`: what one load of manure adds to a field's tilth (on top of its soil); `years`: the time constant of its
  // fading, in game years (e^-1 left after that long without dung); `max`: a bound for the invariant, which play should never reach.
  // A harvest is multiplied by 1 + tilth ----
  const TILTH = { perLoad: 0.0011, years: 70, max: 0.4, surplus: 2 };
  // `surplus` (VB-718): the most loads of manure a field takes in a year beyond what its soil asks, for its tilth only (an estimate, no source).
  // Ale (VB-305; design.md, Goods, Ale and standing; Kim, 10 Nov): a side craft in autumn and winter. `grain` rations of grain from the
  // household's surplus (above its floor, which holds the seed reserve) and `hours` of work in the house give a barrel, which keeps one season
  // (the good's perish, sim/stores) and serves `guests` guests; a household brews while it holds fewer than `stock` barrels. A barrel poured at
  // an occasion gives the host `standing` for `years` years, at most `maxBarrels` barrels counted (a cap of 0.2); each guest's memory of
  // it is SOCIAL.memories.ale.
  const BREW = { grain: 10, hours: 4, guests: 20, stock: 1, standing: 0.05, maxBarrels: 4, years: 3 };
  // The feast (VB-458; design.md, The gift: The feast, What a feast books; Kim, 13 Nov): at a wedding or a funeral ale at its farm, a
  // household whose grain stands above its seed and `above` years of its need lays out food: `share` of what it holds beyond that (times its
  // holder's generosity, TRAITS.acts.generosity.feast), and at most `perGuest` rations a ration of need of those who came (a day's food
  // three times over, the ale poured counted at its grain). Those who ate have eaten the day's meal; guest households owe the host goodwill.
  const FEAST = { above: 2, share: 0.25, perGuest: 3 };
  // The good-year gift (VB-460): a holder above FEAST.above gives unasked to a tie holding under shortBelow years of its need above its seed;
  // under least rations (a sack) the walk is not worth it and none is made
  const GIFT = { shortBelow: 1, least: 10 };
  // The ale evening (VB-522; design.md, Where pawns meet): a holder whose household holds a barrel no occasion called at its farm needs
  // opens its house from the end of work to `until`, the small, frequent sibling of the feast. `call`: a holder's chance a day, times
  // (0.5 + sociability) and (0.5 + ambition), asked at its planning day's review; one evening a village a day. `reach`: the walking hours
  // between villages (sim/routes' table) within which a village's adults are asked. `come`: an adult's chance to come, times (0.5 +
  // sociability), (1 + its opinion of the host) and (1 - its walk / reach); counted until `guests` (a barrel's) have said yes. `mix`: the
  // floor for strangers among the partners drawn there (sim/encounters). `reach` 2, not the design's 1.5 (VB-522's runs, populous small
  // seed 7: at 1.5 a twelfth of the guests came from another village, at 2 a fifth, at 2.5 over a third).
  // A call at a farm (VB-1119; design.md, Where pawns meet): a pawn walks to another household's farm within a day's walk and stays from the
  // end of work to `until`; those at home meet it there as at an occasion, with `mix` the floor for strangers among the partners drawn
  // (sim/encounters). `every`: a pawn calls at most once in so many game hours (a week), the cost's bound; `rung`: an unplayed pawn whose
  // asking found nobody calls at a farm of another village (sim/asking, calls).
  const CALL = { until: 22, mix: 0.5, every: 7 * DAY };
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
  };
  const HELP = {
    // a holder wants floorDays and its own reserve (TRAITS.acts.generosity.reserve, by its generosity: 0 to 40 days; VB-520) of the
    // household's food in store before giving
    floorDays: 20, // the floor (VB-182): no deal takes a household below its seed reserve and this many days of its need
    answerDays: 1, // an offer of goods (a gift, an ask) the played pawn must answer stays open this many days (sim/offers, VB-690)
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
  };

  const SPEED = 12; // tiles per game hour on foot, on meadow (it was 3: the distance review, Kim, 12 Nov; design.md, World and scale)
  // ---- walking (sim/walking): the cost of crossing a tile by its biome, relative to meadow; a pawn walks at SPEED / cost ----
  // Houses and fields cost 1 whatever the biome under them; water and snowfields are closed, and so is a river but at a ford or bridge.
  // Each kind of ground has its own cost (Kim, 13 Nov; VB-439): sand and heather slow a walker a little, open pine wood more, rough
  // hill ground more again, a thick broadleaf wood with no way through it takes twice the time of meadow, marsh and bare rock longer.
  // What a worn way takes off these is PATHS.clear.
  const TERRAIN = {
    [B.MEADOW]: 1,
    [B.BEACH]: 1.15,
    [B.HEATH]: 1.25,
    [B.PINE]: 1.6,
    [B.HILLS]: 1.8,
    [B.FOREST]: 2,
    [B.MARSH]: 2.5,
    [B.MOUNTAIN]: 3.5,
    [B.SNOW]: Infinity,
    ford: 2,
    bridge: 1,
  };
  // ---- worn paths (sim/paths): a tile's crossings, halving every halfLifeDays, make it trodden ground, a path or a lane at `at`;
  // a stage is lost only below `keep` of its threshold; speed: how much faster a pawn walks there, by stage (VB-110) ----
  // clear: the share of the ground's cost above meadow that the wear takes away, by stage (VB-439): a tile costs
  // (1 + (TERRAIN - 1) (1 - clear)) / speed. A road is a path or a lane (stages 2 and 3): cleared and firm, it is walked almost alike
  // through any ground, so a road through thick forest (1.14 a path, 1.04 a lane) is a little slower than open meadow (1), which is a
  // little slower than a road over meadow (0.91, 0.87); trodden ground (stage 1) is only a little easier than none (forest 1.72).
  // A generated village (but the founders') starts with `wornYears` of its daily trips worn in (VB-114): `trips` per farm and day, there
  // and back, to each field, to the well (water) and to the green on an idle stroll, and to the village's wood; set so a new village has the paths a
  // played one has after two years (populous Tiny, seeds 7 and 11: 14 and 18 path tiles worn in, 14 to 21 and 13 to 19 played).
  const PATHS = {
    at: [0, 50, 200, 800],
    keep: 0.85,
    halfLifeDays: YEAR_DAYS,
    speed: [1, 1.03, 1.1, 1.15],
    clear: [0, 0.25, 0.75, 0.8],
    wornYears: 3,
    trips: { field: 0.5, water: 2, stroll: 1, wood: 0.9 },
  };
  // ---- slopes (sim/walking): a step between two tiles is slowed by its slope, up or down alike, whatever its terrain (VB-438) ----
  // Tobler's hiking function (Tobler 1993: 6 exp(-3.5 |S + 0.05|) km an hour at slope S, rise over run), made symmetric around the
  // flat: a walker's speed falls by exp(-tobler |S|), so a step's cost is its terrain's times exp(tobler |S|).
  // tobler: the function's exponent; grade: the slope S of a step whose two tiles differ by one unit of elevation (w.he, 0 to 1 over
  // the land): the heightmap is far steeper than ground is (read as 1,400 m of relief over tiles of 150 m, grade would be 9.3 and the
  // median step a slope of 0.3), so grade was set where the median step cost what it did before, then raised from 1.5 to 2 (Kim,
  // 13 Nov; VB-439); max: the cap on the factor, where Tobler's 6 km an hour has fallen to 1, which bounds the dearest step (the
  // route cache's refresh needs one).
  // Walkable neighbours differ by 0.03 to 0.04 at the median, 0.08 to 0.12 at the 90th percentile, 0.16 to 0.24 at the 99th and 0.4
  // to 0.5 at the most (small and medium, seeds 7 and 42): factors of about 1.3, 2.0, 4.1 and the cap (from a difference of 0.26). grade 0 switches slopes off.
  const SLOPE = { tobler: 3.5, grade: 2, max: 6 };
  // reach: the dearest route searched for, in meadow steps (beyond it a pawn walks straight); minStep: the cheapest step there is,
  // a lane over meadow. cacheMax: entries, first in first out; the cache is emptied each day a tile changes cost (VB-236), and the most
  // it held over 48 days after the first emptying was 4,028 at medium-ref and 2,779 at small-y40: twice the larger, for a run of quiet days.
  const ROUTE = { cacheMax: 8000, reach: 200, minStep: 1 / PATHS.speed[3] };
  // Shares for the siblings who do not inherit (heirs.js, transfer): the farm is worth perField per field and perGrain per ration in the store;
  // the reserve (reserveBase plus reservePerMember per member) is never paid out.
  const SHARES = {
    perField: 120,
    perGrain: 0.5,
    reserveBase: 60,
    reservePerMember: 30,
    // animals pay a share at their customary worth (Culture.norm('worth'), VB-299) when grain runs short; a new household takes a cow and
    // `start.ewes` ewes from its old one (VB-140)
    start: { ewes: 2 },
  };
  // Moving to new land (sim/settle; docs/review-expansion.md): a waiting adult of ages[0]..ages[1] in a crowded village leaves with a chance of
  // chance[k] after k + 1 rounds of waiting there (the last from then on); each waiting sibling follows with `follow`, at most maxFollow. A party
  // needs provisionDays of its rations and seed for one field. A new village lies reach[0]..reach[1] walking steps from home, its house at least
  // `apart` steps from any house, green or field, with a block of `fields` fields at least `fertility` times as fertile as home's and a
  // wood (WOOD.least wooded tiles within WOOD.reach); sites score siteScore + fieldWeight × the block's fertility − perStep a step, and the
  // best `candidates` by the first and last terms are tried. A small village (VB-147) has 1..smallFarms farms, its centre within `join`
  // steps of home. Spacing (stability review, VB-154): `apart` was 3, and a new village's house lies at least centreApart hex steps from
  // every village centre. Provisions were 36 days, which left no margin before the first threshing; 42 agreed by Kim, 2 Nov.
  const SETTLE = {
    ages: [18, 45],
    chance: [0.3, 0.6, 0.8],
    follow: 0.5,
    maxFollow: 2,
    provisionDays: 42,
    reach: [10, 30],
    apart: 5,
    centreApart: 12,
    fields: 3,
    fertility: 0.9,
    fieldWeight: 3,
    perStep: 0.15,
    candidates: 40,
    smallFarms: 3,
    join: 30,
  };
  // A pawn's wish at the moving round (sim/wishes, VB-680; docs/plans/VB-682.md, section 3): `rungs`, the answers to "where do I live next
  // year" in their default ranking, best first (heir to the farm it lives on, a match, an empty farm, a plot, new land, service, stay at
  // home: the order of the round's steps); from ambition `landAmbition` a pawn ranks new land above a plot.
  const WISH = Object.freeze({
    rungs: Object.freeze(['heir', 'match', 'farm', 'plot', 'party', 'service', 'stay']),
    landAmbition: 0.75,
  });
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
  // Courting (VB-036; design.md, Traits, talk and stories: Courting): two unmarried pawns of `minAge` or more court once each holds the
  // other at an opinion of `opinion` with a tie of `tie`, read when the two have a good talk; it ends when either's opinion of the other
  // falls under `end`, or `years` after it began with no offer of theirs open. A refusal sends one of the two to ask for service at the
  // next round when it holds the head who refused at an opinion under `leaveBelow` (a threshold on what the pawn feels, in place of
  // the design's first chance of 0.5: principle 19).
  const COURT = Object.freeze({ minAge: 16, opinion: 0.4, tie: 1.5, end: 0.2, years: 3, leaveBelow: 0 });
  // The village's wood (VB-326; design, Land and ecology, The village's wood; Agreed, Kim, 10 Nov): an allotted area of wooded tiles, v.wood
  // (sim/territory), perHousehold tiles for each live household of the village (a household fells about 11 trees a year and a tile of 60 to 80
  // regrows 2 to 2.7), at least `least` and at most `cap`; the nearest within `reach` walking steps of the centre (4 hours each way on meadow,
  // so a trip with its 3 hours' cutting fits the working day). A trip cuts on a tile drawn evenly among those keeping more than `thin` of
  // their trees, else among any (sim/forest). A generated village or a settlers' site needs `least` wooded tiles within `reach`. Where reach
  // holds too few, the rest of the area lies beyond it, up to `far` steps (VB-421): the farthest a trip still fits the working day, 9 hours'
  // walk out on meadow (3 steps an hour) and its 3 hours' cutting between 6:00 and 18:00; the laden walk home may run past the day's end.
  const WOOD = { perHousehold: 5, least: 6, cap: 150, reach: 12, far: 27, thin: 0.25 };
  // Peat (VB-367; design.md, Fuel; Proposed, slice 6's plan, 11 Nov): cut in summer (sim/dig) and burnt in place of wood once dry, from the
  // season after it was cut. A load of peat is dug a trip (ECON.woodPerTrip units, as a firewood trip brings); `worth` of wood a unit burns
  // as. A household cuts when the village's wood lies more than `far` steps from its house, or from day `late` of summer (summer's end
  // nears) while its fuel pile is under the winter's goal, up to the shortfall.
  const PEAT = { worth: 0.5, far: 8, late: 6 };
  // What building takes (sim/building; design, Land and ecology, Timber; Agreed, Kim, 10 Nov): a cottage's or booth's walls take `timber` loads of
  // wood (six trees). A stone foundation (VB-332; design, Land and ecology, Stone; Agreed, Kim, 11 Nov) takes `foundationStone` loads from the
  // household's heap and `foundationHours` of work at the house; stone is picked (`pickHours` a load) on a meadow tile holding more than
  // `keepStones` (what a meadow keeps, sim/meadows) or quarried (`quarryHours` a load) on hills or mountains, within `stoneReach` walking steps
  // and `stoneWalk` hours' walk of the house (proposed, 11 Nov). The village's well (VB-058; sim/green) takes `wellStone` loads from its
  // households' heaps, carried to the green; the green is cleared in `greenHours`, the well dug and lined in `wellHours` and its sweep raised
  // in `sweepHours` (Agreed, Kim, 30 Oct); the green lies within `greenReach` walking steps of a farm's house (VB-058's own choice).
  const BUILD = {
    timber: 18,
    foundationStone: 12,
    foundationHours: 40,
    pickHours: 2,
    quarryHours: 4,
    keepStones: 80,
    stoneReach: 12,
    stoneWalk: 3,
    wellStone: 6,
    greenHours: 10,
    wellHours: 40,
    sweepHours: 10,
    greenReach: 4,
    // a barn (VB-255; Kim, 10 Nov: QUESTION_ARCHIVE.md, "VB-255: the barn as a project"): a second store building on the farm's block,
    // built by a plot's cottage's stages (hours as theirs) with `timber` loads felled in the village's wood for its walls; a farm with one
    // loses `loss` times the grain to spoilage (ECON.storeLoss, sim/hunger) and the barn hay (HERD.hayLoss, sim/byre)
    barn: Object.freeze({ timber: 40, hours: Object.freeze([30, 60, 30]), loss: 0.5 }),
  };
  // Village work days (VB-120; Kim, 10 Nov; design, Jobs, owners and roles: Village work days): a routine the meeting may choose for a village
  // with a fence; chosen, the village works together on `days` ([season, day of the season, what]): spring's first day the fence, its stretches
  // below `fenceBelow` (each `fenceHours`, as a mend), summer's second the commons, scrub cleared at the wood's edge (`clearHours` an adult of
  // the village). Every adult (from `minAge`) takes the work at role priority `prio`, whatever the role; it takes unlimited hands, all
  // together. An adult who works `hours` gains `came` standing for the year; a household none of whose adults worked their share (`hours`, or
  // the day's work over its adults when that is less) is away: its holder loses `missed` (the agent's own reading of "at the work day").
  // Days owed (VB-462; design.md, Remedies, The alderman's keep): a day is `hours` of work of one adult, called for a day at least `notice`
  // days ahead by the creditor's holder, as tasks of its plan.
  const DAYS = { notice: 3, hours: 8 };
  // The village's office (VB-314; design.md, The alderman): standing gained while in office, and what the election weighs: a candidate's
  // standing (`standing` the weight of one point of it) against a voice's opinion of him (opinions run -1 to 1).
  // keepDays: the days of work each other farm's household owes the alderman's from one autumn meeting to the next; keepShare: the share of its
  // surplus it sets aside for him at the moving round (the practice `keep`, VB-463; about 0.7 of a household's need, a village's keep in all).
  const OFFICE = { standing: 0.3, weighStanding: 0.25, keepDays: 4, keepShare: 0.1 };
  const WORKDAY = {
    days: [
      [0, 0, 'fence'],
      [1, 1, 'commons'],
    ],
    fenceBelow: 0.9,
    fenceHours: 2.5,
    clearHours: 3,
    prio: 8,
    minAge: 14,
    hours: 2,
    came: 0.05,
    missed: -0.1,
  };
  // Common fields worked by the village (VB-100; Kim, 10 Nov; design, Commons): a routine the meeting may choose for a village of `minFarms`
  // or more occupied farms whose store holds less than `storeDays` days of its members' need, with a free meadow tile within `reach` steps of
  // its green (its centre before it has one); at most one common field for every `perFarms` farms. Its tasks are the village's, at the
  // village-duty priorities of ROLES (`duty`) moved by the village's custom `commons` (`lean`: its options' steps from them).
  // `pull`: how far the help a person's household was given leans it to the next higher option, at `fullDays` days of its need owed.
  const COMMONS = {
    minFarms: 3,
    storeDays: 10,
    reach: 3,
    perFarms: 3,
    lean: { own: -2, fair: 0, first: 2 },
    fullDays: 30,
    pull: 0.6,
  };
  // Service (sim/service; stability review, a slice of VB-090): a holder who lives alone takes in an unmarried adult of ages[0]..ages[1] who
  // wants land, if that adult's household keeps keepHands working hands (14 to 59) without them; from the holder's village, or one within
  // `hours` walking hours of it, a day's walk, since the servant moves (VB-290; design.md, The round's other acts; it was 15 hex steps).
  // Where labour is short (VB-090; Agreed, Kim, 30 Oct): hands per field below `short`, to spare above `spare`.
  const SERVICE = { ages: [18, 50], keepHands: 2, hours: 12, short: 1, spare: 1.5 };
  // The tie of a settlement to its culture's centre (sim/society, VB-290): exp(-h / hours) for h walking hours between the two greens (the
  // table of VB-286), plus the kin term; over the sea or beyond walking reach, `sea` times the hex steps, in hours (/ SPEED).
  const TIE = { hours: 8, sea: 1.6 };
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
  // The fit of a pawn for a job (jobs.js): its role's priority for the kind times the job's urgency, less distanceWeight for each step
  // from home; a good fit (priority above poorFit) never falls under `floor`. The head allots a household's day by it (VB-466); a
  // further hand on a job counts for join of the one before (VB-102), so a free job comes first. When the day is allotted anew, a pawn
  // at work leaves its job for one whose fit is above switchRatio × its own job's + switchMargin (VB-107). `noise` is on a helper's
  // bid for a neighbour's job only.
  // urgency: a job's weight in a bid, by kind (see the kinds in sim/kinds).
  const MATCH = {
    poorFit: 2,
    // The head's day (VB-466): a task is given hands until they finish it within `horizon` working days, and a member is given tasks
    // up to its working hours of that time; what it may do besides follows in its list.
    day: { horizon: 0.5 },
    floor: 0.1, // a good fit (priority above poorFit) always bids at least the floor
    distanceWeight: 0.15,
    noise: 0.3,
    join: 0.8,
    switchRatio: 1.5,
    switchMargin: 1,
    // Help between households (VB-106; design.md, Who may take a job): an adult of `minAge` or more with no bid of its own in a round
    // bids on another household's job of its village, of the `kinds`, once the job has waited `waitHours`; each household offers its
    // most urgent open job of each kind. The bid is multiplied by `factor`, plus `kin` for near kin of the holder, plus the helper's
    // opinion of the holder. Each finished task (a load, for hauling) raises the tie with each adult helped by `tie`.
    help: {
      minAge: 14,
      waitHours: 2,
      kinds: ['plow', 'sow', 'weed', 'reap', 'haul', 'thresh', 'clear', 'break', 'mend'],
      factor: 0.5,
      kin: 1,
      tie: 0.2,
    },
    urgency: {
      field: 1,
      fieldPerDay: 8, // plow and sow: 1 + sday / 8
      reap: 1.3,
      reapFrostPerDay: 5,
      haul: 1.1, // reap: 1.3, and in autumn + sday / 5 (the frost comes on autumn day 11)
      woodLow: 8,
      woodLowUrgency: 2.2,
      woodColdUrgency: 3, // VB-327: a cold household's wood comes before its cooking (cookEvening 2.2)
      woodSummer: 0.5, // wood: 2.2 under 8 in store, else its shortfall of the goal, + 0.5 in autumn
      waterMorning: 1.4,
      waterMorningHour: 10,
      water: 1,
      waterLate: 3.3, // VB-331: from waterLateHour, 1.5 times cookEvening: the water comes before the cooking
      waterLateHour: 14,
      cookEvening: 2.2,
      cookEveningHour: 15,
      cook: 0.6,
      brew: 0.5,
      mendPerCond: 2,
      other: 1,
      rake: 0.8,
      mow: 1,
      mowPerDay: 12, // mow: 1 + days into the haymaking window / 12 (sim/meadows)
      fodder: 1.5,
      slaughter: 1.2,
      slaughterNow: 3,
      salt: 1.6, // the byre (sim/byre): slaughterNow when hay runs short
      milk: 1.5,
      milkLate: 0.8,
      milkLateHour: 10, // milking (VB-135): in the morning, less pressing after milkLateHour
      manure: 1.7, // carting manure (VB-137): before the hoeing, as the winter's dung went out before the plough
      manureSurplus: 0.5, // dung to spare (VB-718): after the hoeing and the sowing, so that it never makes a household sow late
      repair: 0.5, // the house's upkeep (VB-306): below the fields' work and the fence's mending
      herd: 1.5, // herding (VB-136): the animals' daily care, as milking and the byre
      fishCalm: 0.2,
      fishLean: 2,
      fishCalmDays: 24, // fishing (VB-117): 0.2 while spare food covers 24 days of need, rising in a line to 2 at none
    },
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
    // what was learned young (culture's P.anchor). settle: times the pressure (the
    // rounds waited in a crowded village) a pawn needs before it wishes to leave at the moving round (sim/settle reads SETTLE.chance there).
    // breach: times the memories of a breach (`breach`, SOCIAL.memories) as this pawn feels them. talk: times the chance to start a talk at
    // its turn (SOCIAL.talk.chance), at most 1; seek: times SOCIAL.seek. idleWait: times IDLE.wait (the design's 4 to 2 hours about its 3).
    // malleability: times a custom's malleability in its attitudes' drift; cause: times the chance to take up a cause. recover: times
    // HEALTH.recover (2.5 to 3.5). Temper acts through chemistry and the quarrel (SOCIAL.chemistry, SOCIAL.talk.quarrel); wits and
    // husbandry through a head's skill (sim/traits).
    acts: Object.freeze({
      generosity: Object.freeze({ reserve: Object.freeze([40, 0]), feast: Object.freeze([0.5, 1.5]) }),
      piety: Object.freeze({ anchor: Object.freeze([0.5, 1.5]) }),
      ambition: Object.freeze({ settle: Object.freeze([1.5, 0.5]) }),
      honour: Object.freeze({ breach: Object.freeze([0.5, 1.5]) }),
      sociability: Object.freeze({ talk: Object.freeze([0.5, 1.5]), seek: Object.freeze([0.5, 1.5]) }),
      diligence: Object.freeze({ idleWait: Object.freeze([4 / 3, 2 / 3]) }),
      openness: Object.freeze({ malleability: Object.freeze([0.5, 1.5]), cause: Object.freeze([0, 2]) }),
      body: Object.freeze({ recover: Object.freeze([2.5 / 3, 3.5 / 3]) }),
    }),
    breach: Object.freeze(['claim', 'border', 'refusedMatch', 'crop', 'stayedAway']),
  });
  // ---- a well-kept house (VB-306; design.md, Goods of place and side crafts: A well-kept house) ----
  // A farmstead's condition 0..1 (f.condition) is the value at f.condAt (game hours; 0 when never set) for an occupied house, and it wears
  // by closed form from then (rule 3: no daily pass), 0.1 a year, 0.067 while tarred (f.tarredUntil, game hours: a barrel lasts 6 years;
  // nothing tars a house before VB-301). An empty farm's condition is worn by the daily pass of sim/clock, as before.
  // Upkeep is offered under `mendBelow`; `hours` of work raise it `raise`; standing gains `term` (tarred `termTarred`) times the condition.
  // A house raised onto a stone foundation (f.grade 'stone', VB-332) wears `wearStone` a year and its term is `termStone`; tar's gain adds on
  // either grade (the term's 0.03, wear a third less), so a house on the ground reads as before.
  const HOUSE = {
    wear: 0.1,
    wearTarred: 0.067,
    term: 0.15,
    termTarred: 0.18,
    mendBelow: 0.8,
    hours: 4,
    raise: 0.1,
    tarYears: 6,
    wearStone: 0.08,
    termStone: 0.2,
  };
  const houseTarred = (st, f) => (f.tarredUntil || 0) > st.t;
  const onStone = (f) => f.grade === 'stone';
  function houseCondition(st, f) {
    const c = f.condition ?? 1;
    if (f.household === null || st.liveTrusts?.some((i) => st.trusts[i].household === f.household)) return c; // empty, or in trust
    const t0 = f.condAt ?? 0,
      tar = Math.min(st.t, f.tarredUntil || 0),
      tarred = Math.max(0, tar - t0),
      plain = Math.max(0, st.t - t0) - tarred;
    const wear = onStone(f) ? HOUSE.wearStone : HOUSE.wear,
      wearTarred = wear * (HOUSE.wearTarred / HOUSE.wear);
    return Math.max(0, c - (plain * wear + tarred * wearTarred) / YEAR);
  }
  const houseTerm = (st, f) =>
    ((onStone(f) ? HOUSE.termStone : HOUSE.term) + (houseTarred(st, f) ? HOUSE.termTarred - HOUSE.term : 0)) *
    houseCondition(st, f);
  return {
    TRAITS,
    DAY,
    SEASON_DAYS,
    YEAR_DAYS,
    YEAR,
    TICKS,
    HOUSE,
    houseCondition,
    houseTarred,
    houseTerm,
    SEASONS,
    cal,
    WORK,
    dark,
    ECON,
    CROPS,
    ROTATIONS,
    FIELDS,
    FISH,
    AGES,
    FORAGE,
    DEER,
    FERTILITY,
    RIVER,
    farmable,
    byRiver,
    fertility,
    ROLES,
    CHILD,
    workRate,
    PLOT_PRIO,
    MALE,
    FEMALE,
    patronym,
    DIRNAME,
    hazard,
    BIRTH,
    HUNGER,
    HEALTH,
    ILLNESS,
    CROWD,
    TESTBED,
    MARRIAGE,
    HANDOVER,
    FOUNDERS,
    HELP,
    GOODWILL,
    TRAVEL,
    AWAY,
    BOOTH,
    HERD,
    stalled,
    GRAZE,
    FOODS,
    SOIL,
    TILTH,
    SOCIAL,
    MOOD,
    IDLE,
    SPEED,
    BREW,
    FEAST,
    GIFT,
    ALE_EVENING,
    CALL,
    RITE,
    GATHERING,
    TERRAIN,
    SLOPE,
    ROUTE,
    PATHS,
    SHARES,
    SETTLE,
    WISH,
    ASK,
    COURT,
    SERVICE,
    TIE,
    MATCH,
    CLAIMS,
    WOOD,
    PEAT,
    BUILD,
    WORKDAY,
    DAYS,
    OFFICE,
    COMMONS,
  };
})();
