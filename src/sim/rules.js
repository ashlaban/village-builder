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
  };
  const FERTILITY = { [B.MEADOW]: 1, [B.HEATH]: 0.65, [B.HILLS]: 0.7, [B.MARSH]: 0.5 };
  const farmable = (w, i) => i >= 0 && !w.water[i] && FERTILITY[w.biome[i]] !== undefined;

  // ---- roles and jobs: who prefers what; jobs carry an owner that decides who may take them ----
  const ROLES = {
    farmer: { title: 'Farmer', sv: 'bonde', prio: { plow: 10, sow: 10, reap: 9, haul: 8, wood: 7, mend: 6, water: 2, cook: 1 } },
    wife: { title: 'Mistress of the house', sv: 'husfru', prio: { cook: 10, water: 9, reap: 7, haul: 6, sow: 5, wood: 2, mend: 2, plow: 2 } },
    farmhand: { title: 'Farmhand', sv: 'dräng', prio: { plow: 9, wood: 9, haul: 8, reap: 8, mend: 7, sow: 6, water: 3, cook: 0 } },
    maid: { title: 'Maid', sv: 'piga', prio: { water: 10, cook: 8, reap: 7, haul: 6, sow: 4, wood: 2, mend: 1, plow: 1 } },
    son: { title: 'Son of the house', sv: 'son', prio: { plow: 9, wood: 9, haul: 8, reap: 8, mend: 7, sow: 6, water: 3, cook: 0 } },
    daughter: { title: 'Daughter of the house', sv: 'dotter', prio: { water: 10, cook: 8, reap: 7, haul: 6, sow: 4, wood: 2, mend: 1, plow: 1 } },
    retired: { title: 'Retired', sv: 'undantag', prio: { cook: 4, water: 3, sow: 2, mend: 2 } },
    child: { title: 'Child', sv: 'barn', prio: {} },
  };
  const KINDS = {
    plow: { verb: 'Hoeing a field', go: 'Going to hoe a field', anim: 'hoe', hours: 4, field: true },
    sow: { verb: 'Sowing', go: 'Going to sow', anim: 'sow', hours: 2, field: true },
    reap: { verb: 'Reaping', go: 'Going to reap', anim: 'reap', hours: 5, field: true },
    haul: { verb: 'Bringing in the sheaves', go: 'Going for the sheaves', anim: 'gather', hours: 0.7, carry: 'sheaf', back: 'Carrying sheaves to the barn' },
    wood: { verb: 'Cutting firewood', go: 'Heading to the woods', anim: 'chop', hours: 3, carry: 'logs', back: 'Carrying firewood home' },
    water: { verb: 'Drawing water', go: 'Going for water', anim: 'draw', hours: 0.5, carry: 'buckets', back: 'Carrying water home' },
    cook: { verb: 'Cooking at the hearth', go: 'Going home to cook', anim: null, hours: 2, inside: true },
    mend: { verb: 'Mending the fence', go: 'Going to mend the fence', anim: 'mallet', hours: 2.5 },
  };

  // ---- names ----
  const MALE = ['Erik', 'Olof', 'Anders', 'Nils', 'Per', 'Lars', 'Jon', 'Sven', 'Håkan', 'Gunnar', 'Ivar',
    'Björn', 'Arvid', 'Ragnar', 'Torsten', 'Mats', 'Hans', 'Jöns'];
  const FEMALE = ['Kerstin', 'Karin', 'Ingrid', 'Brita', 'Märta', 'Elin', 'Sigrid', 'Astrid', 'Gunhild', 'Margit', 'Ragnhild',
    'Ingeborg', 'Signe', 'Tora', 'Gertrud', 'Cecilia'];
  const patronym = (father, sex) => father + (father.endsWith('s') ? '' : 's') + (sex === 'm' ? 'son' : 'dotter');
  const DIRNAME = ['Öster', 'Norr', 'Norr', 'Väster', 'Söder', 'Söder'];

  const hazard = (a) => 0.006 + 0.0007 * Math.exp(0.07 * a) + (a < 10 ? 0.01 : 0); // per year, roughly pre-industrial adults

  const SPEED = 3; // tiles per game hour on foot
  return { DAY, SEASON_DAYS, YEAR_DAYS, YEAR, SEASONS, cal, WORK, ECON, FERTILITY, farmable, ROLES, KINDS, MALE, FEMALE, patronym, DIRNAME, hazard, SPEED };
})();
