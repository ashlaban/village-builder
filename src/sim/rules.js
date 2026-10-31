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
  const WORK = [7, 17];

  // ---- economy (rations = one adult's food for one game day) ----
  const ECON = {
    ration: { adult: 1, child: 0.5 },
    fieldYield: 100, seedPerField: 25, // a 4:1 yield ratio
    sowWindow: [0, 9], ripeAfterDays: 26, dryDays: 1,
    woodPerTrip: 3, woodTarget: 30, woodWinter: 40, woodUse: [0.35, 0.3, 0.5, 1.6],
    startGrain: 180, startWood: 16,
    fenceDecay: [0.012, 0.01, 0.014, 0.03], fenceMendBelow: 0.65,
    weedEvery: 6, weedCut: 0.08, weedCutMax: 0.4, // a growing field wants weeding every 6 days; each missed job cuts the yield
  };
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
    farmer: { title: 'Farmer', sv: 'bonde', work: { tilling: 10, tending: 10, harvest: 8, threshing: 8, wood: 7, upkeep: 6, household: 2 },
      except: { reap: 9, cook: 1 } },
    wife: { title: 'Mistress of the house', sv: 'husfru', work: { tilling: 2, tending: 5, harvest: 6, threshing: 2, wood: 2, upkeep: 2, household: 9 },
      except: { reap: 7, cook: 10 } },
    farmhand: { title: 'Farmhand', sv: 'dräng', work: { tilling: 9, tending: 6, harvest: 8, threshing: 8, wood: 9, upkeep: 7, household: 3 },
      except: { cook: 0 } },
    maid: { title: 'Maid', sv: 'piga', work: { tilling: 1, tending: 4, harvest: 6, threshing: 2, wood: 2, upkeep: 1, household: 10 },
      except: { reap: 7, cook: 8 } },
    son: { title: 'Son of the house', sv: 'son', work: { tilling: 9, tending: 6, harvest: 8, threshing: 8, wood: 9, upkeep: 7, household: 3 },
      except: { cook: 0 } },
    daughter: { title: 'Daughter of the house', sv: 'dotter', work: { tilling: 1, tending: 4, harvest: 6, threshing: 2, wood: 2, upkeep: 1, household: 10 },
      except: { reap: 7, cook: 8 } },
    retired: { title: 'Retired', sv: 'undantag', work: { tending: 2, threshing: 2, upkeep: 2, household: 3 }, except: { cook: 4 } },
    child: { title: 'Child', sv: 'barn', work: { harvest: 3 }, except: { water: 6, weed: 5, haul: 4 } },
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
  // seek: chance that an idle pawn walks to someone it likes who idles in its village, rather than to the green or its yard.
  const SOCIAL = {
    situational: { spouse: 0.3, parent: 0.3, child: 0.3, sibling: 0.2, housemate: 0.1 },
    memories: {
      chat: { label: 'Chatted', v: 0.03, cap: 0.2, days: YEAR_DAYS },
      goodTalk: { label: 'A good talk', v: 0.1, cap: 0.5, days: 3 * YEAR_DAYS },
      crossWords: { label: 'Cross words', v: -0.12, cap: -0.6, days: 3 * YEAR_DAYS },
    },
    talk: { from: 6, to: 22, chance: 0.5, minAge: 4, sample: 8, good: 0.15, cross: 0.08, kin: 0.15, young: [16, 30], youngBonus: 2,
      tie: 0.1, bubbleHours: 0.5 },
    friend: 0.25, dislike: -0.2, back: 0.1, closeFriend: 0.6, enemy: -0.5,
    seek: 0.5,
  };

  // ---- marriage: who is matched in the moving round (ages in years; the score is -|gap error| * gapWeight + village bonus + noise) ----
  const MARRIAGE = {
    menFrom: 20, womenFrom: 18, // youngest age to marry
    ageGap: 3, gapWeight: 0.3, // preferred age gap (man older) and score lost per year off it
    sameVillage: 2, noise: 1.5, // score bonus for the same village; amplitude of the random term
    minScore: -1.5, goAhead: 0.75, // lowest score accepted; chance that an accepted match goes ahead
    kinPhi: { second: 1 / 64, first: 1 / 16, close: 1 / 8 }, // kinship coefficient limit per kinLimit custom
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
    },
  };
  return { DAY, SEASON_DAYS, YEAR_DAYS, YEAR, SEASONS, cal, WORK, ECON, FERTILITY, RIVER, farmable, byRiver, fertility, ROLES, CHILD, workRate,
    PLOT_PRIO,
    MALE, FEMALE, patronym, DIRNAME, hazard,
    BIRTH, HUNGER, HEALTH, MARRIAGE, SOCIAL, SPEED, TERRAIN, ROUTE, PATHS, SHARES, MATCH };
})();
