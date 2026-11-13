// @sys sim/quern: the hand quern (VB-009): a household's quern stone, of sandstone or granite, worn out QUERN.years after it was made (read
// from when it was made); grinding grain to flour at home, and hewing a new quern from a load of stone on the heap; the quern as a good
// Design: design.md, Long work and processing (Milling at home: Decided, Agreed) and The mill and the loom (The quern: Decided, 11 Nov;
// Proposed numbers). Flour is a store of sim/stores (household.flour) that the cook puts in the pot at 1:1 (sim/pot); grain cooked unground
// gives 1 / ECON.unground a ration.
VB['sim/quern'] = (() => {
  const { YEAR } = VB['sim/rules'];
  const { ROCK, ROCKS } = VB['gen/geology'];
  const Stores = VB['sim/stores'],
    { grainOf, reserved } = Stores;
  const { dailyNeed } = VB['sim/hunger'];
  // Proposed (slice 6's plan, VB-185, 11 Nov): years, a quern's life from when it was made; renewYears, how long before its end a new one is
  // wanted; granite, its grinding speed against sandstone's; perHour, grain ground an hour on sandstone, 1 grain to 1 flour (design.md:
  // about 1 work hour per 4 units); grindHours, one grinding job's work on sandstone (on granite it takes 1 / granite as long for the same
  // flour); flourDays, the flour a household keeps ground, in days of its need; hewHours, the work of hewing a quern at home, in winter;
  // startAge, the start's querns are of every age below it, spread by household (no draw: the scenario's seeding stream is shared).
  const QUERN = {
    years: 20,
    renewYears: 2,
    granite: 0.8,
    perHour: 4,
    grindHours: 2,
    flourDays: 10,
    hewHours: 12,
    startAge: 16,
    urgency: { grind: 1, hew: 0.5 },
  };
  const STONES = ['sandstone', 'granite'];
  // The rock of the village's ground, by its key (gen/geology ROCKS): the bedrock under its green. The heap's stone is of it (VB-332's heap
  // keeps no kinds yet: a load picked or quarried within the house's reach is taken as of the village's bedrock). A world made without the
  // ground layers is granite.
  function villageRock(st, v) {
    const w = st.w;
    return w.rock ? ROCKS[w.rock[v.center]].key : ROCKS[ROCK.GRANITE].key;
  }
  const hewable = (rock) => STONES.includes(rock);
  const rockOf = (st, hh) => villageRock(st, st.villages[st.farmsteads[hh.farmstead].village]);
  // @state household.quern: {rock ('sandstone' | 'granite'), made (game hours)} or null: the household's hand quern; worn out QUERN.years
  //   after `made`, read in closed form (Rules for cost, 3), and left in place until a new one replaces it. Written only here.
  function setQuern(hh, q) {
    hh.quern = q;
  }
  // The household's working quern, or null: none, or worn out.
  const quernOf = (st, hh) => (hh.quern && st.t < hh.quern.made + QUERN.years * YEAR ? hh.quern : null);
  // Years left of the household's quern (0 when worn out; null with none).
  const yearsLeft = (st, hh) => (hh.quern ? Math.max(0, (hh.quern.made + QUERN.years * YEAR - st.t) / YEAR) : null);
  // The grinding speed of a quern against sandstone's.
  const speed = (q) => (q.rock === 'granite' ? QUERN.granite : 1);
  // A household of the scenario's start has a quern of its village's bedrock where that is sandstone or granite, else granite, of an age
  // below QUERN.startAge years spread by its id, so that the start's querns do not all wear out in one year.
  function startQuern(st, hh) {
    const rock = rockOf(st, hh),
      age = (hh.id * 7) % QUERN.startAge;
    setQuern(hh, { rock: hewable(rock) ? rock : 'granite', made: st.t - age * YEAR });
  }
  // A new quern is wanted from QUERN.renewYears before the old one ends, or at once with none; it can be hewn only where the village's
  // ground is sandstone or granite (elsewhere it comes from the fair: the good 'quern', when VB-302's fair trades).
  const wanted = (st, hh) => !hh.quern || st.t >= hh.quern.made + (QUERN.years - QUERN.renewYears) * YEAR;
  const canHew = (st, hh) => hh.farmstead !== null && hewable(rockOf(st, hh));
  // The heap lacks the load a wanted quern is hewn from (sim/building's building step fetches one).
  const wantsStone = (st, hh) => hh.stone < 1 && wanted(st, hh) && canHew(st, hh);
  // ---- grinding: a job at home while the household holds grain above its seed reserve and fewer than QUERN.flourDays of its need in flour ----
  const flourWanted = (st, hh) =>
    hh.flour < QUERN.flourDays * dailyNeed(st, hh) && grainOf(hh) - reserved(st, hh, 'grain') > 1e-9;
  // A job's grinding: QUERN.perHour * QUERN.grindHours grain, at most the grain above the seed reserve and what the flour stock lacks.
  function ground(st, hh) {
    const want = Math.max(0, QUERN.flourDays * dailyNeed(st, hh) - hh.flour),
      n = Stores.takeSpare(st, hh, Math.min(QUERN.perHour * QUERN.grindHours, want), 'grind');
    if (n > 0) Stores.put(st, hh, 'flour', n, 'grind');
    return n;
  }
  // ---- hewing: a load of sandstone or granite off the heap, QUERN.hewHours at home; in winter, or in any season with no working quern ----
  function hewn(st, hh) {
    if (!wanted(st, hh) || !canHew(st, hh) || hh.stone < 1) return false;
    Stores.take(st, hh, 'stone', 1, 'quern');
    setQuern(hh, { rock: rockOf(st, hh), made: st.t });
    return true;
  }
  const atHome = (dx, dy) => (st, a, j) => [st.w.hx[j.site] + dx + a.ox * 0.2, st.w.hy[j.site] + dy + a.oy * 0.2];
  // The job kinds (sim/kinds registers them; their fields are described there).
  const KINDS = {
    grind: {
      verb: 'Grinding grain at the quern',
      go: 'Going home to grind',
      name: 'Grind grain',
      label: 'Grinding',
      anim: null,
      hours: QUERN.grindHours,
      hands: 1,
      type: 'household',
      inside: true,
      spot: atHome(-2, 4),
      urgency: () => QUERN.urgency.grind,
      done: (st, j, hh) => {
        ground(st, hh);
      },
      // while the household has a working quern, grain above its seed reserve and too little flour; on granite the job takes longer
      available: (st, hh, f, c, post) => {
        const q = quernOf(st, hh);
        if (!q || !flourWanted(st, hh)) return;
        const s = speed(q);
        post(`grind:h${hh.id}`, f.house, s === 1 ? { farm: f } : { farm: f, hours: QUERN.grindHours / s });
      },
    },
    hewQuern: {
      verb: 'Hewing a quern stone',
      go: 'Going home to hew a quern',
      name: 'Hew a quern',
      label: 'Quern',
      anim: 'mallet',
      hours: QUERN.hewHours,
      hands: 1,
      type: 'upkeep',
      spot: atHome(-6, 12),
      urgency: () => QUERN.urgency.hew,
      done: (st, j, hh) => {
        hewn(st, hh);
      },
      // while a new quern is wanted, the village's ground gives its stone and the heap holds a load: in winter, or at once with none working
      available: (st, hh, f, c, post) => {
        if (hh.stone < 1 || !wanted(st, hh) || !canHew(st, hh)) return;
        if (c.season === 3 || !quernOf(st, hh)) post(`hewQuern:h${hh.id}`, f.house, { farm: f });
      },
    },
  };
  // The quern as a good of the fair (design.md, The mill and the loom: a good of place; Culture's worth table holds it at 25 rations).
  Stores.declareGood({
    id: 'quern',
    kind: 'quern',
    class: 'wares',
    unit: 'stone',
    quantum: 1,
    lump: 'quern',
    rations: 0,
    perish: null,
    keeping: true,
  });
  return {
    QUERN,
    KINDS,
    villageRock,
    quernOf,
    yearsLeft,
    startQuern,
    wanted,
    canHew,
    wantsStone,
    flourWanted,
    ground,
    hewn,
  };
})();
