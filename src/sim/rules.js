// @sys sim/rules: calendar, economy, roles, job kinds, names and other simulation constants
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
    fieldYield: 80, seedPerField: 20, // a 4:1 yield ratio
    sowWindow: [0, 9], ripeAfterDays: 26, dryDays: 1,
    woodPerTrip: 3, woodTarget: 30, woodUse: [0.35, 0.3, 0.5, 1.6],
    startGrain: 180, startWood: 16,
    fenceDecay: [0.012, 0.01, 0.014, 0.03], fenceMendBelow: 0.65,
    weedEvery: 6, weedCut: 0.08, weedCutMax: 0.4, // a growing field wants weeding every 6 days; each missed job cuts the yield
  };
  const FERTILITY = { [B.MEADOW]: 1, [B.HEATH]: 0.65, [B.HILLS]: 0.7, [B.MARSH]: 0.5 };
  const farmable = (w, i) => i >= 0 && !w.water[i] && FERTILITY[w.biome[i]] !== undefined;

  // ---- roles and jobs: who prefers what; jobs carry an owner that decides who may take them ----
  const ROLES = {
    farmer: { title: 'Farmer', sv: 'bonde', prio: { plow: 10, sow: 10, reap: 9, haul: 8, thresh: 8, wood: 7, mend: 6, water: 2, cook: 1, weed: 10 } },
    wife: { title: 'Mistress of the house', sv: 'husfru', prio: { cook: 10, water: 9, reap: 7, haul: 6, sow: 5, wood: 2, mend: 2, plow: 2, thresh: 2,
      weed: 5 } },
    farmhand: { title: 'Farmhand', sv: 'dräng', prio: { plow: 9, wood: 9, haul: 8, reap: 8, thresh: 8, mend: 7, sow: 6, water: 3, cook: 0, weed: 6 } },
    maid: { title: 'Maid', sv: 'piga', prio: { water: 10, cook: 8, reap: 7, haul: 6, sow: 4, wood: 2, mend: 1, plow: 1, thresh: 2, weed: 4 } },
    son: { title: 'Son of the house', sv: 'son', prio: { plow: 9, wood: 9, haul: 8, reap: 8, thresh: 8, mend: 7, sow: 6, water: 3, cook: 0, weed: 6 } },
    daughter: { title: 'Daughter of the house', sv: 'dotter', prio: { water: 10, cook: 8, reap: 7, haul: 6, sow: 4, wood: 2, mend: 1, plow: 1,
      thresh: 2, weed: 4 } },
    retired: { title: 'Retired', sv: 'undantag', prio: { cook: 4, water: 3, sow: 2, mend: 2, thresh: 2, weed: 2 } },
    child: { title: 'Child', sv: 'barn', prio: {} },
  };
  for (const r of Object.values(ROLES)) r.prio.clear = r.prio.break = r.prio.plow; // new fields are heavy field work, like hoeing
  const KINDS = {
    plow: { verb: 'Hoeing a field', go: 'Going to hoe a field', anim: 'hoe', hours: 20, field: true },
    sow: { verb: 'Sowing', go: 'Going to sow', anim: 'sow', hours: 2, field: true },
    reap: { verb: 'Reaping', go: 'Going to reap', anim: 'reap', hours: 5, field: true },
    haul: { verb: 'Bringing in the sheaves', go: 'Going for the sheaves', anim: 'gather', hours: 0.7, carry: 'sheaf', back: 'Carrying sheaves to the barn' },
    wood: { verb: 'Cutting firewood', go: 'Heading to the woods', anim: 'chop', hours: 3, carry: 'logs', back: 'Carrying firewood home' },
    water: { verb: 'Drawing water', go: 'Going for water', anim: 'draw', hours: 0.5, carry: 'buckets', back: 'Carrying water home' },
    cook: { verb: 'Cooking at the hearth', go: 'Going home to cook', anim: null, hours: 2, inside: true },
    weed: { verb: 'Weeding a field', go: 'Going to weed a field', anim: 'gather', hours: 2, field: true },
    thresh: { verb: 'Threshing in the barn', go: 'Going to the barn to thresh', anim: null, hours: 6, inside: true },
    clear: { verb: 'Clearing scrub and stones', go: 'Going to clear land', anim: 'hoe', hours: 10, field: true },
    break: { verb: 'Breaking new ground', go: 'Going to break new ground', anim: 'hoe', hours: 30, field: true },
    mend: { verb: 'Mending the fence', go: 'Going to mend the fence', anim: 'mallet', hours: 2.5 },
  };

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
  const HEALTH = { drain: 9, frail: 1.5, recover: 3, riskBelow: 50, riskSlope: 25, slow: 0.3 };

  // ---- marriage: who is matched in the moving round (ages in years; the score is -|gap error| * gapWeight + village bonus + noise) ----
  const MARRIAGE = {
    menFrom: 20, womenFrom: 18, // youngest age to marry
    ageGap: 3, gapWeight: 0.3, // preferred age gap (man older) and score lost per year off it
    sameVillage: 2, noise: 1.5, // score bonus for the same village; amplitude of the random term
    minScore: -1.5, goAhead: 0.75, // lowest score accepted; chance that an accepted match goes ahead
    kinPhi: { second: 1 / 64, first: 1 / 16, close: 1 / 8 }, // kinship coefficient limit per kinLimit custom
  };

  const SPEED = 3; // tiles per game hour on foot
  return { DAY, SEASON_DAYS, YEAR_DAYS, YEAR, SEASONS, cal, WORK, ECON, FERTILITY, farmable, ROLES, KINDS, MALE, FEMALE, patronym, DIRNAME, hazard, BIRTH,
    HUNGER, HEALTH, MARRIAGE, SPEED };
})();
