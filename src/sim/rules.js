// @sys sim/rules: calendar, economy, roles and their work, names and other simulation constants
VB['sim/rules'] = (() => {
  const { B } = VB['gen'];
  // ---- calendar: 4 seasons of 12 days; one game hour is the base unit of time ----
  const DAY = 24, SEASON_DAYS = 12, YEAR_DAYS = SEASON_DAYS * 4, YEAR = YEAR_DAYS * DAY;
  const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
  const cal = (t) => {
    const day = Math.floor(t / DAY), y = Math.floor(day / YEAR_DAYS), doy = day - y * YEAR_DAYS;
    return { year: y + 1, doy, season: Math.floor(doy / SEASON_DAYS), sday: doy % SEASON_DAYS, hour: t - day * DAY, day };
  };
  const WORK = [6, 18];
  // The dark part of the day for a calendar date, [start, end] in hours (start > end when it runs past midnight): 4 hours at
  // midsummer, 8 at midwinter and 6 at the equinoxes, centred on 1:00.
  const DARK_CENTRE = 1;
  const dark = (c) => {
    const len = 6 - 2 * Math.cos((2 * Math.PI * (c.doy - 15)) / 48), h = (x) => ((x % 24) + 24) % 24;
    return [h(DARK_CENTRE - len / 2), h(DARK_CENTRE + len / 2)];
  };

  // ---- economy (rations = one adult's food for one game day) ----
  const ECON = {
    ration: { adult: 1, child: 0.5 },
    fieldYield: 100, seedPerField: 25, // a 4:1 yield ratio
    sowWindow: [0, 9], ripeAfterDays: 26, dryDays: 1,
    woodPerTrip: 3, woodTarget: 30, woodWinter: 40, woodUse: [0.35, 0.3, 0.5, 1.6],
    startGrain: 180, startWood: 16,
    fenceDecay: [0.012, 0.01, 0.014, 0.03], fenceMendBelow: 0.65,
    weedEvery: 6, weedCut: 0.08, weedCutMax: 0.4, // a growing field wants weeding every 6 days; each missed job cuts the yield
    // grain in store spoils (mice, damp, mould; balance review): a share a year of the grain up to a year's need, of the next year's worth, and of
    // the rest; the FAO puts losses in traditional stores at about 5% a year, and up to 20% where rats are many
    storeLoss: [0.05, 0.2, 0.4], villageStoreLoss: 0.2, // the village store (sim/help) loses a fifth a year, as grain kept a second year
  };
  // ---- fields a household wants (balance review, 1 Nov 2026): enough for `want` times a year's rations at `expect` of the full yield, but no more
  // than its hands can till: perHand fields a working adult (14 to 59, not retired) and oxenHands more for a team of oxen (VB-138); no fixed cap ----
  // room (stability review, VB-154): a new farm (a plot, a settler's farm, a new village) needs this many free farmable tiles within FIELD_REACH
  // walking steps of its house besides its first field, for more fields, meadow and pasture; so fewer farms fit between villages.
  const FIELDS = { want: 1.1, expect: 0.75, perHand: 2, oxenHands: 1.5, room: 6 };
  const FERTILITY = { [B.MEADOW]: 1, [B.HEATH]: 0.65, [B.HILLS]: 0.7, [B.MARSH]: 0.5 };
  // ---- rivers (src/gen/rivers.js): no house or field on a river tile; a field next to one is watered from it ----
  // irrigation: extra fertility of a field next to a river tile; site: added to a village site's score by steps to the nearest river tile (0..3).
  const RIVER = { irrigation: 0.2, site: [0, 10, 10, 5] };
  const farmable = (w, i) => i >= 0 && !w.water[i] && !w.river[i] && FERTILITY[w.biome[i]] !== undefined;
  const byRiver = (w, i) => { for (let k = 0; k < 6; k++) { const j = w.nb[i * 6 + k]; if (j >= 0 && w.river[j]) return true; } return false; };
  // Fertility of a farmable tile as a field: by its biome, and more when a river waters it.
  const fertility = (w, i) => FERTILITY[w.biome[i]] * (byRiver(w, i) ? 1 + RIVER.irrigation : 1);

  // ---- roles and work: each role ranks types of work from 0 to 10 (`work`), with exceptions for single job kinds (`except`); sim/kinds gives
  // every kind its type and fills in `prio`, each role's rank of every kind. Jobs carry an owner that decides who may take them ----
  const ROLES = {
    farmer: { title: 'Farmer', sv: 'bonde', work: { tilling: 10, tending: 10, harvest: 8, threshing: 8, wood: 7, upkeep: 6, household: 2, husbandry: 3 },
      except: { reap: 9, cook: 1, slaughter: 8 } },
    wife: { title: 'Mistress of the house', sv: 'husfru', work: { tilling: 2, tending: 5, harvest: 6, threshing: 2, wood: 2, upkeep: 2, household: 9,
      husbandry: 9 }, except: { reap: 7, cook: 10, mow: 4, slaughter: 2, milk: 10 } },
    farmhand: { title: 'Farmhand', sv: 'dräng', work: { tilling: 9, tending: 6, harvest: 8, threshing: 8, wood: 9, upkeep: 7, household: 3, husbandry: 4 },
      except: { cook: 0, slaughter: 8 } },
    maid: { title: 'Maid', sv: 'piga', work: { tilling: 1, tending: 4, harvest: 6, threshing: 2, wood: 2, upkeep: 1, household: 10, husbandry: 10 },
      except: { reap: 7, cook: 8, mow: 4, slaughter: 2 } },
    son: { title: 'Son of the house', sv: 'son', work: { tilling: 9, tending: 6, harvest: 8, threshing: 8, wood: 9, upkeep: 7, household: 3, husbandry: 3 },
      except: { cook: 0, slaughter: 7 } },
    daughter: { title: 'Daughter of the house', sv: 'dotter', work: { tilling: 1, tending: 4, harvest: 6, threshing: 2, wood: 2, upkeep: 1, household: 10,
      husbandry: 9 }, except: { reap: 7, cook: 8, mow: 4, slaughter: 2 } },
    retired: { title: 'Retired', sv: 'undantag', work: { tending: 2, threshing: 2, upkeep: 2, household: 3, husbandry: 3 }, except: { cook: 4, slaughter: 2 } },
    child: { title: 'Child', sv: 'barn', work: { harvest: 3 }, except: { water: 6, weed: 5, haul: 4, rake: 4, hay: 4, mow: 0 } },
  };
  // Children of 7 to 13 work at a reduced rate: 0.3 at 7, rising 0.1 a year to 0.9 at 13; under 7 they take no jobs.
  const CHILD = { from: 7, base: 0.3, perYear: 0.1 };
  const workRate = (role, age) => (role === 'child' ? Math.min(1, CHILD.base + CHILD.perYear * (age - CHILD.from)) : 1);
  // Who clears a new plot for the village (see sim/expansion): by role; those waiting for the plot take 9 whatever their role.
  const PLOT_PRIO = { waiting: 9, farmhand: 7, maid: 7, son: 5, daughter: 5, farmer: 3 };

  // ---- names ----
  const MALE = ['Erik', 'Olof', 'Anders', 'Nils', 'Per', 'Lars', 'Jon', 'Sven', 'Håkan', 'Gunnar', 'Ivar',
    'Björn', 'Arvid', 'Ragnar', 'Torsten', 'Mats', 'Hans', 'Jöns'];
  const FEMALE = ['Kerstin', 'Karin', 'Ingrid', 'Brita', 'Märta', 'Elin', 'Sigrid', 'Astrid', 'Gunhild', 'Margit', 'Ragnhild',
    'Ingeborg', 'Signe', 'Tora', 'Gertrud', 'Cecilia'];
  const patronym = (father, sex) => father + (father.endsWith('s') ? '' : 's') + (sex === 'm' ? 'son' : 'dotter');
  const DIRNAME = ['Öster', 'Norr', 'Norr', 'Väster', 'Söder', 'Söder'];

  // Annual death hazard at age a (years, may be fractional): Gompertz-Makeham for adults plus a juvenile term that falls with age (Siler 1979),
  // so that about 20% die before age 1 and a third before 15.
  const hazard = (a) => 0.006 + 0.0007 * Math.exp(0.07 * a) + 0.381 * Math.exp(-1.265 * a);

  // ---- births: natural fertility of married women (Coale and Trussell 1974), relative to ages 20-24; times in game days ----
  const BIRTH = {
    peak: 0.015, ageFactor: [0.89, 1, 0.94, 0.86, 0.7, 0.36, 0.05], from: 15, to: 50, // chance per day to conceive; factor per 5 years of age from 15
    pregnancyDays: 36, nursingDays: 48, boys: 105 / 205, childbedDeath: 0.01,
  };

  // ---- hunger: a member's hunger h (0..1) multiplies the death hazard by 1 + k(age) * h, and slows work by HUNGER.slow * h ----
  const HUNGER = { days: 12, slow: 0.4, marryBelow: 0.5, k: (a) => (a < 5 || a >= 60 ? 1.5 : a < 15 ? 0.6 : 0.3) };

  // ---- health: a pawn's health (0..100) is drained daily by hunger (h squared) and restored by full meals; at 0 the pawn dies of starvation ----
  const HEALTH = { drain: 4, frail: 1.5, recover: 3, riskBelow: 50, riskSlope: 25, slow: 0.3 };

  // ---- relationships (sim/relations; docs/review-relationships.md): one pawn's opinion of another (-1..1) is a situational part (kin,
  // spouse, housemate) plus timed memories. A memory gains v at each event, up to cap, and fades to 0 over `days` from the last one.
  // Talk: between 6:00 and 22:00 each pawn of minAge or more, not carrying a load, starts a talk at `chance` an hour with one nearby
  // pawn (`sample` candidates at most), weighted by (1 + min(tie, 1)) * (1 + opinion). The talk is a chat, a good talk or cross words
  // by weights 1, good * e^(2c) and cross * e^(-2c), c being the pair's compatibility (+kin for kin and housemates). Two unmarried pawns
  // aged within `young` count `youngBonus` times in both the choice and the good talk. A talk adds `tie` to the tie of both and shows a
  // bubble for `bubbleHours`. friend and dislike: an opinion entering them is a life event; leaving needs `back` past the line.
  // seek: chance that an idle pawn walks to someone it likes who idles in its village (of seekSample drawn), rather than to the green or its yard.
  const SOCIAL = {
    situational: { spouse: 0.3, parent: 0.3, child: 0.3, sibling: 0.2, housemate: 0.1 },
    memories: {
      chat: { label: 'Chatted', v: 0.03, cap: 0.2, days: YEAR_DAYS },
      goodTalk: { label: 'A good talk', v: 0.1, cap: 0.5, days: 3 * YEAR_DAYS },
      crossWords: { label: 'Cross words', v: -0.12, cap: -0.6, days: 3 * YEAR_DAYS },
      bull: { label: 'Lent us the bull', v: 0.05, cap: 0.2, days: 3 * YEAR_DAYS }, // sim/herds: a cow calved by another farm's bull
    },
    talk: { from: 6, to: 22, chance: 0.5, minAge: 4, sample: 8, good: 0.15, cross: 0.08, kin: 0.15, young: [16, 30], youngBonus: 2,
      tie: 0.1, bubbleHours: 0.5 },
    friend: 0.25, dislike: -0.2, back: 0.1, closeFriend: 0.6, enemy: -0.5,
    seek: 0.5, seekSample: 4,
  };

  // ---- marriage: who is matched in the moving round (ages in years; the score is -|gap error| * gapWeight + village bonus + noise) ----
  const MARRIAGE = {
    menFrom: 20, womenFrom: 18, // youngest age to marry
    ageGap: 3, gapWeight: 0.3, // preferred age gap (man older) and score lost per year off it
    // a widow or widower minds the gap less (balance review): remarriage was common in pre-industrial Sweden, above all for men, and a widowed
    // holder brought a farm to the marriage (Lundh 2007)
    widowedGapWeight: 0.15,
    sameVillage: 2, noise: 1.5, // score bonus for the same village; amplitude of the random term
    minScore: -1.5, goAhead: 0.75, // lowest score accepted; chance that an accepted match goes ahead
    kinDegree: { second: 8, first: 6, close: 4, uncle: 3 }, // closest civil degree allowed per kinLimit custom; degree 2 or less never marries
    scarcePush: 1, plentyPush: 0.5, // self-interest pull on kinLimit towards the next looser option (scarcity) or stricter (plenty)
    // the means to marry (stability review, VB-153): the household the couple will live in holds food, above its seed, for `means` years of
    // its members and the newcomer; a match that lacks it waits a year (Malthus's preventive check: marriages fell after bad harvests). A home
    // with fewer than two adults is exempt: it needs the spouse's hands. Proposed 1.5 (stability review): the round falls just after the harvest,
    // when stores are at their highest, and at 1 the check seldom bound (births and hunger as before); at 1.5, over four tiny-map runs of 80
    // years, deaths from hunger fell by about 40% and women married 2 to 3 years later.
    means: 1.5,
  };

  // ---- animals (sim/herds; docs/review-animals.md): hay a stall day by kind of animal; the stall period, from autumn day 9 (doy 32) to the
  // turn-out on spring day 6 (doy 5), 21 days; breeding on spring day 3 (doy 2) with a bull of bullAge or more, or a ram, within reach steps of
  // the farm; deaths of grown animals a year; the byre's room in cattle (a calf counts half); ages in years ----
  const HERD = {
    hay: { cow: 1, bull: 1, ox: 1, heifer: 0.6, steer: 0.6, calf: 0.4, ewe: 0.2, ram: 0.2, lamb: 0.1 },
    stall: [32, 5], stallDays: 21, springDay: 2, reach: 12,
    calve: 0.85, calfDeath: 0.15, lamb: 0.9, twins: 0.3, lambDeath: 0.2, death: { cattle: 0.03, sheep: 0.05 },
    bullAge: 2, grown: 3, maxAge: 15, keepBullUnder: 8, byre: 6, startMargin: 1.1,
    // the byre and the autumn count (sim/byre, VB-134): the count on autumn day 8 (doy 31) keeps what hay × margin feeds; old ages; meat a head
    // (Kim, 31 Oct); fodder hours (base, a head of cattle, a sheep); slaughter hours; fresh meat keeps freshDays, salt meat saltDays; salting
    // makes saltPerHour rations an hour; emergency meat is lean (half); a herd unfed starveDays running loses an animal a day
    countDay: 31, margin: 1.1, old: { cow: 12, ox: 12, bull: 10 }, oldEwe: 1 / 7,
    meat: { cow: 15, ox: 18, bull: 18, heifer: 10, steer: 10, calf: 5, ewe: 3, ram: 3, lamb: 1.5 },
    fodder: [0.5, 0.15, 0.03], slaughter: { cattle: 3, sheep: 1 }, freshDays: 3, saltDays: 48, saltPerHour: 8, lean: 0.5, eatSoonDays: 6, starveDays: 2,
    // milk (VB-135): a cow that calved this spring is in milk while the herds are out; milking hours (base, a cow in milk); rations a cow
    // a day, less leanPer a lean day of the winter, at most leanMax; the share churned to butter, which keeps butterDays; fresh milk keeps a day
    milkHours: [0.3, 0.2], milk: 0.5, leanPer: 0.02, leanMax: 0.4, butter: 0.4, butterDays: 48,
    // oxen at the plough (VB-138): two oxen make a team, which draws the ard for the first hand on these kinds, `rate` times a hoe
    team: { oxen: 2, kinds: ['plow', 'break'], rate: 2.5 },
  };
  // ---- soil (VB-137): a field's soil multiplies its yield; each reaped crop wears it by `wear` to `floor`; a load of manure, carted to a field in
  // stubble or hoed in spring days 1 to 6 (sday window), raises it by perLoad to `cap`. Fodder collects loads a stall day: a head of cattle, a sheep.
  // The heap loses `rot` of what lies on it in a year (balance review). perLoad 0.02 would make about 3 head of cattle, not 1.5, hold 3 fields, but
  // cost a quarter more hungry days over 8 seeds, so it stays at 0.04 until Kim chooses (QUESTIONS.md). A field broken on ground never farmed
  // (w.dev 0) starts at `fresh`, above the cap: virgin and burnt-over land gave far more its first crops (VB-149, docs/review-expansion.md) ----
  const SOIL = { start: 1, fresh: 1.4, wear: 0.08, floor: 0.75, perLoad: 0.04, cap: 1.15, cattle: 0.2, sheep: 0.04, window: [0, 5], rot: 0.5 };
  const HELP = {
    bufferDays: [20, 60], // days of the household's food a holder wants in store before giving; drawn uniformly per pawn
    askBelow: 3, askDays: 12, // a household asks when its spare grain covers fewer days than this, for this many days of food
    storeShare: 0.25, tieGain: 0.5, // share of its surplus a household gives the village store each year; tie gain between the holders
  };

  const SPEED = 3; // tiles per game hour on foot, on meadow
  // ---- walking (sim/routes): the cost of crossing a tile by its biome, relative to meadow; a pawn walks at SPEED / cost ----
  // Houses and fields cost 1 whatever the biome under them; water and snowfields are closed, and so is a river but at a ford or bridge.
  const TERRAIN = { [B.BEACH]: 1, [B.MEADOW]: 1, [B.HEATH]: 1, [B.FOREST]: 1.5, [B.PINE]: 1.5, [B.HILLS]: 2, [B.MARSH]: 2, [B.MOUNTAIN]: 3,
    [B.SNOW]: Infinity, ford: 2, bridge: 1 };
  // ---- worn paths (sim/paths): a tile's crossings, halving every halfLifeDays, make it trodden ground, a path or a lane at `at`;
  // a stage is lost only below `keep` of its threshold; speed: how much faster a pawn walks there, by stage (VB-110) ----
  // A generated village (but the founders') starts with `wornYears` of its daily trips worn in (VB-114): `trips` per farm and day, there
  // and back, to each field, to the well (water) and to the green on an idle stroll, and to the woodlot; set from grown runs.
  const PATHS = { at: [0, 50, 200, 800], keep: 0.85, halfLifeDays: YEAR_DAYS, speed: [1, 1.05, 1.15, 1.3],
    wornYears: 3, trips: { field: 0.25, water: 1, stroll: 0.5, wood: 0.45 } };
  // reach: the dearest route searched for, in meadow steps (beyond it a pawn walks straight); minStep: the cheapest step there is,
  // a lane over meadow.
  const ROUTE = { reach: 200, minStep: 1 / PATHS.speed[3] };
  // Shares for the siblings who do not inherit (heirs.js, transfer): the farm is worth perField per field and perGrain per ration in the store;
  // the reserve (reserveBase plus reservePerMember per member) is never paid out.
  const SHARES = { perField: 120, perGrain: 0.5, reserveBase: 60, reservePerMember: 30 };
  // Moving to new land (sim/settle; docs/review-expansion.md): a waiting adult of ages[0]..ages[1] in a crowded village leaves with a chance of
  // chance[k] after k + 1 rounds of waiting there (the last from then on); each waiting sibling follows with `follow`, at most maxFollow. A party
  // needs provisionDays of its rations and seed for one field. A new village lies reach[0]..reach[1] walking steps from home, its house at least
  // `apart` steps from any house, green or field, with a block of `fields` fields at least `fertility` times as fertile as home's and a wood within
  // woodReach; sites score siteScore + fieldWeight × the block's fertility − perStep a step, and the best `candidates` by the first and last
  // terms are tried. A small village (VB-147) has 1..smallFarms farms, its centre within `join` steps of home. Spacing (stability review,
  // VB-154): `apart` was 3, and a new village's house lies at least centreApart hex steps from every village centre.
  const SETTLE = { ages: [18, 45], chance: [0.3, 0.6, 0.8], follow: 0.5, maxFollow: 2, provisionDays: 36, reach: [10, 30], apart: 5, centreApart: 12,
    fields: 3, fertility: 0.9, woodReach: 24, fieldWeight: 3, perStep: 0.15, candidates: 40, smallFarms: 3, join: 30 };
  // Service (sim/service; stability review, a slice of VB-090): a holder who lives alone takes in an unmarried adult of ages[0]..ages[1] who
  // wants land, if that adult's household keeps keepHands working hands (14 to 59) without them; from the holder's village, or one whose
  // centre lies within `reach` steps of it.
  const SERVICE = { ages: [18, 50], keepHands: 2, reach: 15 };
  // Job matching (jobs.js): a poor fit (role priority at most poorFit) bids once the job has waited poorFitWaitHours; each step from home costs
  // distanceWeight; noise breaks ties; a bid for a job that k pawns already work is multiplied by join^k (VB-102), so a free job comes first.
  // Once an hour a pawn at work leaves its job for another whose noise-free bid is above switchRatio × its own job's + switchMargin (VB-107).
  // urgency: a job's weight in a bid, by kind (see the kinds in sim/kinds).
  const MATCH = {
    poorFit: 2, poorFitWaitHours: 2, floor: 0.1, // a good fit (priority above poorFit) always bids at least the floor
    distanceWeight: 0.15, noise: 0.3, join: 0.8, switchRatio: 1.5, switchMargin: 1,
    urgency: {
      field: 1, fieldPerDay: 8, // plow and sow: 1 + sday / 8
      reap: 1.3, reapFrostPerDay: 5, haul: 1.1, // reap: 1.3, and in autumn + sday / 5 (the frost comes on autumn day 11)
      woodLow: 8, woodLowUrgency: 2.2, woodSummer: 0.5, // wood: 2.2 under 8 in store, else its shortfall of the goal, + 0.5 in autumn
      waterMorning: 1.4, waterMorningHour: 10, water: 1, cookEvening: 2.2, cookEveningHour: 15, cook: 0.6, mendPerCond: 2, other: 1,
      rake: 0.8, mow: 1, mowPerDay: 12, // mow: 1 + days into the haymaking window / 12 (sim/meadows)
      fodder: 1.5, slaughter: 1.2, slaughterNow: 3, salt: 1.6, // the byre (sim/byre): slaughterNow when hay runs short
      milk: 1.5, milkLate: 0.8, milkLateHour: 10, // milking (VB-135): in the morning, less pressing after milkLateHour
      manure: 1.7, // carting manure (VB-137): before the hoeing, as the winter's dung went out before the plough
    },
  };
  return { DAY, SEASON_DAYS, YEAR_DAYS, YEAR, SEASONS, cal, WORK, dark, ECON, FIELDS, FERTILITY, RIVER, farmable, byRiver, fertility, ROLES, CHILD, workRate,
    PLOT_PRIO,
    MALE, FEMALE, patronym, DIRNAME, hazard,
    BIRTH, HUNGER, HEALTH, MARRIAGE, HELP, HERD, SOIL, SOCIAL, SPEED, TERRAIN, ROUTE, PATHS, SHARES, SETTLE, SERVICE, MATCH };
})();
