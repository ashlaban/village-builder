// @sys sim/rules: calendar, economy, roles and their work, names and other simulation constants
VB['sim/rules'] = (() => {
  const { B } = VB['gen'];
  // ---- calendar: 4 seasons of 12 days; one game hour is the base unit of time ----
  const DAY = 24, SEASON_DAYS = 12, YEAR_DAYS = SEASON_DAYS * 4, YEAR = YEAR_DAYS * DAY;
  // The clock counts whole 6-minute steps (st.tick, sim/clock; VB-235): TICKS of them an hour. The hour, the day and the year the clock is
  // working through are found from the count, never by adding a tolerance to st.t.
  const TICKS = 10;
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

  // ---- economy (a ration, the unit of food, is one adult's food for one game day; FOODS below) ----
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
  const FORAGE = { reach: 5, trip: 2.5, take: 0.2, least: 0.2, from: 5 };
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
    farmer: { title: 'Farmer', sv: 'bonde', work: { tilling: 10, tending: 10, harvest: 8, threshing: 8, wood: 7, upkeep: 6, household: 2, husbandry: 3,
      foraging: 3 }, except: { reap: 9, cook: 1, slaughter: 8 } },
    wife: { title: 'Mistress of the house', sv: 'husfru', work: { tilling: 2, tending: 5, harvest: 6, threshing: 2, wood: 2, upkeep: 2, household: 9,
      husbandry: 9, foraging: 4 }, except: { reap: 7, cook: 10, mow: 4, slaughter: 2, milk: 10, fish: 2 } },
    farmhand: { title: 'Farmhand', sv: 'dräng', work: { tilling: 9, tending: 6, harvest: 8, threshing: 8, wood: 9, upkeep: 7, household: 3, husbandry: 4,
      foraging: 6 }, except: { cook: 0, slaughter: 8, gather: 3 } },
    maid: { title: 'Maid', sv: 'piga', work: { tilling: 1, tending: 4, harvest: 6, threshing: 2, wood: 2, upkeep: 1, household: 10, husbandry: 10,
      foraging: 5 }, except: { reap: 7, cook: 8, mow: 4, slaughter: 2, fish: 2 } },
    son: { title: 'Son of the house', sv: 'son', work: { tilling: 9, tending: 6, harvest: 8, threshing: 8, wood: 9, upkeep: 7, household: 3, husbandry: 3,
      foraging: 7 }, except: { cook: 0, slaughter: 7, gather: 3 } },
    daughter: { title: 'Daughter of the house', sv: 'dotter', work: { tilling: 1, tending: 4, harvest: 6, threshing: 2, wood: 2, upkeep: 1, household: 10,
      husbandry: 9, foraging: 6 }, except: { reap: 7, cook: 8, mow: 4, slaughter: 2, fish: 2 } },
    retired: { title: 'Retired', sv: 'undantag', work: { tending: 2, threshing: 2, upkeep: 2, household: 3, husbandry: 3, foraging: 3 },
      except: { cook: 4, slaughter: 2 } },
    child: { title: 'Child', sv: 'barn', work: { harvest: 3, foraging: 5 }, except: { water: 6, weed: 5, haul: 4, rake: 4, hay: 4, mow: 0 } },
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

  // ---- relationships (sim/relations; docs/review-relationships.md; VB-240, Kim 10 Nov): one pawn's opinion of another (-1..1) is derived:
  // the standing's value (kin, spouse, housemate), plus affinity, affinity.weight * compatibility * min(1, tie / affinity.known), the pair's
  // fixed compatibility shown as the two grow familiar, plus timed memories of things that happened. A memory gains v at each event, up to
  // cap, and fades to 0 over `days` from the last one.
  // Talk: between 6:00 and 22:00 each pawn of minAge or more, not carrying a load, starts a talk at `chance` an hour with one nearby
  // pawn (`sample` candidates at most), weighted by (1 + min(tie, 1)) * (1 + opinion). The talk is a chat, a good talk or cross words
  // by weights 1, good * e^(2c) and cross * e^(-2c), c being the pair's compatibility (+kin for kin and housemates): its kind is the
  // bubble's, and leaves no memory. Two unmarried pawns aged within `young` count `youngBonus` times in both the choice and the good talk.
  // A talk adds ties.talk to the tie of both and shows a bubble for `bubbleHours`. closeFriend and enemy: an opinion reaching them is a
  // life event; leaving needs `back` past the line. friend and dislike are the page's words only.
  // seek: chance that an idle pawn walks to someone it likes who idles in its village (of seekSample drawn), rather than to the green or its yard.
  // An idle pawn the planner found no work looks again after wait[0] to wait[1] hours (VB-245; Kim, 10 Nov: 2 to 4, from 0.75 to 2). It hears of new
  // work meanwhile through the hourly refresh and `awake` (sim/agents), which wakes those whose pause ends by the hour's end, and of an occasion by the asking.
  const IDLE = { wait: [2, 4] };
  const SOCIAL = {
    situational: { spouse: 0.3, parent: 0.3, child: 0.3, sibling: 0.2, housemate: 0.1 },
    memories: {
      bull: { label: 'Lent us the bull', v: 0.05, cap: 0.2, days: 3 * YEAR_DAYS }, // sim/herds: a cow calved by another farm's bull
      border: { label: 'Won the border from us', v: -0.1, cap: -0.3, days: 3 * YEAR_DAYS }, // sim/territory: lost a border dispute to their village (VB-157)
      claim: { label: 'Took our claim', v: -0.15, cap: -0.45, days: 3 * YEAR_DAYS }, // sim/stakes: their household took a stake of ours (VB-158)
      // sim/lifecycle: the pawn refused a match its spokesman made (consent's cost; design.md, Marriage as a negotiation; VB-293)
      ale: { label: 'Poured us ale', v: 0.05, cap: 0.2, days: 3 * YEAR_DAYS }, // sim/occasions: a barrel poured at a wedding or a funeral ale (VB-305)
      refusedMatch: { label: 'Refused the match I made', v: -0.2, cap: -0.4, days: 3 * YEAR_DAYS },
    },
    talk: { from: 6, to: 22, chance: 0.5, minAge: 4, sample: 8, good: 0.15, cross: 0.08, kin: 0.15, young: [16, 30], youngBonus: 2,
      bubbleHours: 0.5 },
    // Familiarity (VB-127; docs/review-relationships.md, proposal B): a tie grows by `talk` a talk, by `home` per 24 waking hours (the talk
    // hours) two housemates spend in their house, counted once a day, and by `work` for each job two pawns finish together; it halves every
    // year. Near kin never fall below `kin`. A pawn keeps at most `cap` ties, the strongest, kin always kept; ties under `forget` are dropped
    // when the pawn's ties are put back on today's scale, every `renorm` years.
    ties: { talk: 0.5, home: 1, work: 0.5, kin: 0.4, cap: 150, forget: 0.02, renorm: 4 },
    affinity: { weight: 0.6, known: 8 },
    friend: 0.25, dislike: -0.2, back: 0.1, closeFriend: 0.45, enemy: -0.5,
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
    liking: 1, // score per point of the mean of the two young's opinions of each other (VB-275); a stranger's opinion is 0
    minScore: -1.5, goAhead: 0.75, // lowest score accepted; chance that an accepted match goes ahead
    kinDegree: { second: 8, first: 6, close: 4, uncle: 3 }, // closest civil degree allowed per kinLimit custom; degree 2 or less never marries
    scarcePush: 1, plentyPush: 0.5, // self-interest pull on kinLimit towards the next looser option (scarcity) or stricter (plenty)
    // the means to marry (stability review, VB-153): the household the couple will live in holds food, above its seed, for `means` years of
    // its members and the newcomer; a match that lacks it waits a year (Malthus's preventive check: marriages fell after bad harvests). A home
    // with fewer than two adults is exempt: it needs the spouse's hands. Proposed 1.5 (stability review): the round falls just after the harvest,
    // when stores are at their highest, and at 1 the check seldom bound (births and hunger as before); at 1.5, over four tiny-map runs of 80
    // years, deaths from hunger fell by about 40% and women married 2 to 3 years later.
    means: 1.5,
    // an offer the player must answer stays open this many days; unanswered, it is answered as the pawn would unplayed (VB-293)
    offerDays: 7,
  };

  // ---- animals (sim/herds; docs/review-animals.md): hay a stall day by kind of animal; the stall period, from autumn day 9 (doy 32) to the
  // turn-out on spring day 6 (doy 5), 21 days; breeding on spring day 3 (doy 2) with a bull of bullAge or more, or a ram, within reach steps of
  // the farm; deaths of grown animals a year; the byre's room in cattle (a calf counts half); ages in years ----
  const HERD = {
    hayLoss: [0.05, 0.25, 0.5], // annual barn losses by winters of need held (VB-159)
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
  // ---- foods (VB-259; design.md, Goods and the farming year: Food, Meals; Kim, 10 Nov): a ration is only the unit, one adult's food for a
  // day. Each food the game has: worth (rations a unit), keeps (shelf life in game days; null: it does not spoil by date, as grain, which
  // spoils in store by sim/hunger's share instead), source (for a meal's variety; grain and flour are one; null: not given yet) and raw (eaten
  // as it is, from the larder, not cooked into meals). Grain goes into the household's grain and is cooked into meals (sim/stores cook);
  // the rest go into the larder (sim/hunger addFood, from sim/byre). Nothing reads source yet (the pot, VB-119). ----
  const FOODS = {
    grain: { worth: 1, keeps: null, source: 'grain', raw: false },
    meat: { worth: 1, keeps: HERD.freshDays, source: 'meat', raw: true }, // fresh, from the slaughter
    'salt meat': { worth: 1, keeps: HERD.saltDays, source: 'meat', raw: true },
    milk: { worth: 1, keeps: 1, source: 'milk', raw: true }, // fresh milk keeps a day
    butter: { worth: 1, keeps: HERD.butterDays, source: 'milk', raw: true },
  };
  // ---- soil (VB-137): a field's soil multiplies its yield; each reaped crop wears it by `wear` to `floor`; a load of manure, carted to a field in
  // stubble or hoed in spring days 1 to 6 (sday window), raises it by perLoad to `cap`. Fodder collects loads a stall day: a head of cattle, a sheep.
  // The heap loses `rot` of what lies on it in a year (balance review). perLoad 0.02 would make about 3 head of cattle, not 1.5, hold 3 fields, but
  // cost a quarter more hungry days over 8 seeds, so it stays at 0.04 until Kim chooses (QUESTIONS.md). A field broken on ground never farmed
  // (w.dev 0) starts at `fresh`, above the cap: virgin and burnt-over land gave far more its first crops (VB-149, docs/review-expansion.md) ----
  const SOIL = { start: 1, fresh: 1.4, wear: 0.08, floor: 0.75, perLoad: 0.04, cap: 1.15, cattle: 0.2, sheep: 0.04, window: [0, 5], rot: 0.5 };
  // Ale (VB-305; design.md, Goods, Ale and standing; Kim, 10 Nov): a side craft in autumn and winter. `grain` rations of grain from the
  // household's surplus (above its floor, which holds the seed reserve) and `hours` of work in the house give a barrel, which keeps one season
  // (the good's perish, sim/stores) and serves `guests` guests; a household brews while it holds fewer than `stock` barrels. A barrel poured at
  // an occasion gives the host `prestige` for `years` years, at most `maxBarrels` barrels counted (a cap of 0.2); each guest's memory of
  // it is SOCIAL.memories.ale.
  const BREW = { grain: 10, hours: 4, guests: 20, stock: 1, prestige: 0.05, maxBarrels: 4, years: 3 };
  const HELP = {
    bufferDays: [20, 60], // days of the household's food a holder wants in store before giving; drawn uniformly per pawn
    floorDays: 20, // the floor (VB-182): no deal takes a household below its seed reserve and this many days of its need
    askBelow: 3, askDays: 12, // a household asks when its spare grain covers fewer days than this, once a season, for food until the
    // next harvest and at least this many days (VB-222)
    storeShare: 0.25, tieGain: 0.5, // share of its surplus a household gives the village store each year; tie gain between the holders
  };
  // ---- goodwill (sim/relations, VB-217; design.md, The gift): a balance between two pawns in customary rations ----
  const GOODWILL = {
    halfLife: 4, forget: 1, cap: 32, // a balance halves in 4 years (tunable from 2 to 20), read when needed; one under a ration is
    // forgotten; counterparts a pawn
    share: 0.5, // the share of a holder's balances that passes to the new holder at a retirement or a holder's death
    limitDays: 30, // allowance: what the receiver owes beyond this many days of its household's need counts against it
    acts: true, // slice 1 booked and showed goodwill only; slice 4 switched on its terms (VB-220): gratitude, and allowance's two
    gratitude: 0.15, scale: 20, // a debtor's opinion of its creditor gains gratitude x s / (s + scale) for a balance of s rations
    opinionRations: 10, // allowance: the giver's opinion of the receiver (-1 to 1) times this many rations
  };

  const SPEED = 3; // tiles per game hour on foot, on meadow
  // ---- walking (sim/routes): the cost of crossing a tile by its biome, relative to meadow; a pawn walks at SPEED / cost ----
  // Houses and fields cost 1 whatever the biome under them; water and snowfields are closed, and so is a river but at a ford or bridge.
  const TERRAIN = { [B.BEACH]: 1, [B.MEADOW]: 1, [B.HEATH]: 1, [B.FOREST]: 1.5, [B.PINE]: 1.5, [B.HILLS]: 2, [B.MARSH]: 2, [B.MOUNTAIN]: 3,
    [B.SNOW]: Infinity, ford: 2, bridge: 1 };
  // ---- worn paths (sim/paths): a tile's crossings, halving every halfLifeDays, make it trodden ground, a path or a lane at `at`;
  // a stage is lost only below `keep` of its threshold; speed: how much faster a pawn walks there, by stage (VB-110) ----
  // A generated village (but the founders') starts with `wornYears` of its daily trips worn in (VB-114): `trips` per farm and day, there
  // and back, to each field, to the well (water) and to the green on an idle stroll, and to the village's wood; set so a new village has the paths a
  // played one has after two years (populous Tiny, seeds 7 and 11: 14 and 18 path tiles worn in, 14 to 21 and 13 to 19 played).
  const PATHS = { at: [0, 50, 200, 800], keep: 0.85, halfLifeDays: YEAR_DAYS, speed: [1, 1.05, 1.15, 1.3],
    wornYears: 3, trips: { field: 0.5, water: 2, stroll: 1, wood: 0.9 } };
  // ---- slopes (sim/routes): a step between two tiles costs more by its rise, up or down alike, on top of the terrain's cost ----
  // perRise: meadow steps added per unit of elevation difference between the two tiles (w.he, 0 to 1 over the land); max: the cap on a
  // step's surcharge, which bounds the dearest step (the route cache's refresh needs one). A rise per step is about 0.04 to 0.07 at the
  // median, 0.10 to 0.18 at the 90th percentile and 0.5 to 0.7 at the most (more on smaller maps). perRise 0 switches slopes off.
  const SLOPE = { perRise: 6, max: 2 };
  // reach: the dearest route searched for, in meadow steps (beyond it a pawn walks straight); minStep: the cheapest step there is,
  // a lane over meadow. cacheMax: LRU entries; 60,000 keeps the late fixture's hit-rate loss within 5 points (VB-198).
  const ROUTE = { cacheMax: 60000, reach: 200, minStep: 1 / PATHS.speed[3] };
  // Shares for the siblings who do not inherit (heirs.js, transfer): the farm is worth perField per field and perGrain per ration in the store;
  // the reserve (reserveBase plus reservePerMember per member) is never paid out.
  const SHARES = { perField: 120, perGrain: 0.5, reserveBase: 60, reservePerMember: 30,
    // animals pay a share at their customary worth (Culture.norm('worth'), VB-299) when grain runs short; a new household takes a cow and
    // `start.ewes` ewes from its old one (VB-140)
    start: { ewes: 2 } };
  // Moving to new land (sim/settle; docs/review-expansion.md): a waiting adult of ages[0]..ages[1] in a crowded village leaves with a chance of
  // chance[k] after k + 1 rounds of waiting there (the last from then on); each waiting sibling follows with `follow`, at most maxFollow. A party
  // needs provisionDays of its rations and seed for one field. A new village lies reach[0]..reach[1] walking steps from home, its house at least
  // `apart` steps from any house, green or field, with a block of `fields` fields at least `fertility` times as fertile as home's and a
  // wood (WOOD.least wooded tiles within WOOD.reach); sites score siteScore + fieldWeight × the block's fertility − perStep a step, and the
  // best `candidates` by the first and last terms are tried. A small village (VB-147) has 1..smallFarms farms, its centre within `join`
  // steps of home. Spacing (stability review, VB-154): `apart` was 3, and a new village's house lies at least centreApart hex steps from
  // every village centre. Provisions were 36 days, which left no margin before the first threshing; 42 agreed by Kim, 2 Nov.
  const SETTLE = { ages: [18, 45], chance: [0.3, 0.6, 0.8], follow: 0.5, maxFollow: 2, provisionDays: 42, reach: [10, 30], apart: 5, centreApart: 12,
    fields: 3, fertility: 0.9, fieldWeight: 3, perStep: 0.15, candidates: 40, smallFarms: 3, join: 30 };
  // The village's wood (VB-326; design, Land and ecology, The village's wood; Agreed, Kim, 10 Nov): an allotted area of wooded tiles, v.wood
  // (sim/territory), perHousehold tiles for each live household of the village (a household fells about 11 trees a year and a tile of 60 to 80
  // regrows 2 to 2.7), at least `least` and at most `cap`; the nearest within `reach` walking steps of the centre (4 hours each way on meadow,
  // so a trip with its 3 hours' cutting fits the working day). A trip cuts on a tile drawn evenly among those keeping more than `thin` of
  // their trees, else among any (sim/forest). A generated village or a settlers' site needs `least` wooded tiles within `reach`.
  const WOOD = { perHousehold: 5, least: 6, cap: 150, reach: 12, thin: 0.25 };
  // What building takes (sim/building; design, Land and ecology, Timber; Agreed, Kim, 10 Nov): a cottage's or booth's walls take `timber` loads of
  // wood (six trees).
  const BUILD = { timber: 18 };
  // Service (sim/service; stability review, a slice of VB-090): a holder who lives alone takes in an unmarried adult of ages[0]..ages[1] who
  // wants land, if that adult's household keeps keepHands working hands (14 to 59) without them; from the holder's village, or one whose
  // centre lies within `reach` steps of it. Where labour is short (VB-090; Agreed, Kim, 30 Oct): hands per field below `short`, to spare above `spare`.
  const SERVICE = { ages: [18, 50], keepHands: 2, reach: 15, short: 1, spare: 1.5 };
  // Claims on land (sim/claims, sim/territory; claims review, docs/review-claims.md; numbers Proposed): an unrealised claim fades over `years`
  // without work or renewal; a village claims outland within `outReach` walking steps of its green, `outPerFarm` tiles an occupied farm; a
  // household may contest a stake weaker than `contestBelow`; a family's birthright on its empty farm lasts `birthrightYears`; a household
  // that lost a dispute leans for `grievanceYears` towards the rules that would have let it win.
  // A village short of outland presses a richer neighbour for at most `pressPerMeeting` tiles a meeting; a cairn keeps the village that lost a
  // border dispute from pressing for that tile again for `cairnYears`. An empty farm may be claimed from a village whose centre lies within
  // `farmReach` steps of the farm's village centre, under the customs that let outsiders claim (VB-033; as SERVICE.reach); the claimants start
  // with seed for its fields and `farmFood` days of food; they mend it at role priority `claimantPrio`, their housemates help at `helperPrio`.
  const CLAIMS = { years: 3, outReach: 8, outPerFarm: 8, contestBelow: 0.5, birthrightYears: 20, grievanceYears: 5, pressPerMeeting: 4, cairnYears: 3,
    farmReach: 15, farmFood: 60, claimantPrio: 9, helperPrio: 5 };
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
      waterMorning: 1.4, waterMorningHour: 10, water: 1, cookEvening: 2.2, cookEveningHour: 15, cook: 0.6, brew: 0.5, mendPerCond: 2, other: 1,
      rake: 0.8, mow: 1, mowPerDay: 12, // mow: 1 + days into the haymaking window / 12 (sim/meadows)
      fodder: 1.5, slaughter: 1.2, slaughterNow: 3, salt: 1.6, // the byre (sim/byre): slaughterNow when hay runs short
      milk: 1.5, milkLate: 0.8, milkLateHour: 10, // milking (VB-135): in the morning, less pressing after milkLateHour
      manure: 1.7, // carting manure (VB-137): before the hoeing, as the winter's dung went out before the plough
      repair: 0.5, // the house's upkeep (VB-306): below the fields' work and the fence's mending
      fishCalm: 0.2, fishLean: 2, fishCalmDays: 24, // fishing (VB-117): 0.2 while spare food covers 24 days of need, rising in a line to 2 at none
    },
  };
  // ---- a well-kept house (VB-306; design.md, Goods of place and side crafts: A well-kept house) ----
  // A farmstead's condition 0..1 (f.condition) is the value at f.condAt (game hours; 0 when never set) for an occupied house, and it wears
  // by closed form from then (rule 3: no daily pass), 0.1 a year, 0.067 while tarred (f.tarredUntil, game hours: a barrel lasts 6 years;
  // nothing tars a house before VB-301). An empty farm's condition is worn by the daily pass of sim/clock, as before.
  // Upkeep is offered under `mendBelow`; `hours` of work raise it `raise`; prestige gains `term` (tarred `termTarred`) times the condition.
  const HOUSE = { wear: 0.1, wearTarred: 0.067, term: 0.15, termTarred: 0.18, mendBelow: 0.8, hours: 4, raise: 0.1, tarYears: 6 };
  const houseTarred = (st, f) => (f.tarredUntil || 0) > st.t;
  function houseCondition(st, f) {
    const c = f.condition ?? 1;
    if (f.household === null) return c;
    const t0 = f.condAt ?? 0, tar = Math.min(st.t, f.tarredUntil || 0), tarred = Math.max(0, tar - t0), plain = Math.max(0, st.t - t0) - tarred;
    return Math.max(0, c - (plain * HOUSE.wear + tarred * HOUSE.wearTarred) / YEAR);
  }
  const houseTerm = (st, f) => (houseTarred(st, f) ? HOUSE.termTarred : HOUSE.term) * houseCondition(st, f);
  return { DAY, SEASON_DAYS, YEAR_DAYS, YEAR, TICKS, HOUSE, houseCondition, houseTarred, houseTerm,
    SEASONS, cal, WORK, dark, ECON, FIELDS, FISH, FORAGE, FERTILITY, RIVER, farmable, byRiver, fertility, ROLES, CHILD, workRate,
    PLOT_PRIO,
    MALE, FEMALE, patronym, DIRNAME, hazard,
    BIRTH, HUNGER, HEALTH, MARRIAGE, HELP, GOODWILL, HERD, FOODS, SOIL, SOCIAL, IDLE, SPEED, BREW, TERRAIN, SLOPE, ROUTE, PATHS, SHARES, SETTLE, SERVICE, MATCH,
      CLAIMS, WOOD, BUILD };
})();
