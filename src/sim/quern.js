// @sys sim/quern: the hand quern (VB-009): a household's quern stone, of sandstone or granite, worn out QUERN.years after it was made (read
// from when it was made); grinding grain to flour at home, at the grit of the quern's rock; hewing a new quern from a load of sandstone or
// granite on the heap, of the rock of that load (VB-733); the quern as a good of two kinds
// Design: design.md, Long work and processing (Milling at home: Decided, Agreed) and The mill and the loom (The quern: Decided, 11 Nov;
// Proposed numbers); The metals and the stones (The heap by its rock, VB-733). Flour is a store of sim/stores (household.flour) that the
// cook puts in the pot at 1:1 (sim/pot); grain cooked unground gives 1 / ECON.unground a ration.
VB['sim/quern'] = (() => {
  const { YEAR } = VB['sim/rules'];
  const { rockKey } = VB['world/geology'];
  const Goods = VB['sim/goods'],
    Stores = VB['sim/stores'],
    { grainOf, reserved } = Stores;
  const { dailyNeed } = VB['sim/hunger'];
  const Targets = VB['sim/targets'];
  const Workmanship = VB['sim/workmanship'];
  // Proposed (slice 6's plan, VB-185, 11 Nov): years, a quern's life from when it was made; renewYears, how long before its end a new one is
  // wanted; perHour, grain ground an hour on sandstone, 1 grain to 1 flour (design.md: about 1 work hour per 4 units); grindHours, one
  // grinding job's work on sandstone (on another rock it takes 1 / its grit as long for the same flour: the registry's row of the quern's
  // kind, VB-733, granite's 0.8); flourDays, the flour a household keeps ground, in days of its need; hewHours, the work of hewing a quern
  // at home, in winter; startAge, the start's querns are of every age below it, spread by household (no draw: the scenario's seeding
  // stream is shared).
  const QUERN = {
    years: 20,
    renewYears: 2,
    perHour: 4,
    grindHours: 2,
    flourDays: 10,
    hewHours: 12,
    startAge: 16,
    urgency: { grind: 1, hew: 0.5 },
  };
  // The rock of the village's ground, by its key (world/geology ROCKS): the bedrock under its green, of which the start's querns are. A
  // world made without the ground layers is granite.
  function villageRock(st, v) {
    return rockKey(st.w, v.center) || 'granite';
  }
  // A rock a quern can be hewn of: a kind of the good 'quern' (sim/goods: sandstone and granite, the best grit first).
  const hewable = (rock) => Goods.kindRow('quern', rock) !== undefined;
  const rockOf = (st, hh) => villageRock(st, st.villages[st.farmsteads[hh.farmstead].village]);
  // @state household.quern: {kind ('sandstone' | 'granite', a kind of the good 'quern'), grade (0 to 4, its workmanship: VB-761), made
  //   (game hours)} or null: the household's hand quern, of the rock it was hewn from (VB-733), of the grade drawn at its hewing by the
  //   hewer's skill at stonework (sim/workmanship); worn out QUERN.years times its grade's life after `made`, read in closed form (Rules for
  //   cost, 3), and left in place until a new one replaces it. Written only here.
  function setQuern(hh, q) {
    hh.quern = q;
  }
  // A save from before VB-733 named the quern's stone `rock`: it is its kind; one from before VB-761 has no grade: it is sound.
  function quernsLoaded(st) {
    for (const hh of st.households) {
      const q = hh.quern;
      if (q && (q.kind === undefined || q.grade === undefined))
        setQuern(hh, { kind: q.kind ?? q.rock, grade: q.grade ?? Workmanship.SOUND, made: q.made });
    }
  }
  // The registry's row of a quern's kind and grade (sim/goods: its grit scaled by the grade's work, and the grade's life).
  const rowOf = (q) => Goods.kindRow('quern', q.kind).grades[q.grade];
  // The hour a quern wears out: QUERN.years times its grade's life after it was made.
  const endOf = (q) => q.made + QUERN.years * rowOf(q).life * YEAR;
  // The household's working quern, or null: none, or worn out.
  const quernOf = (st, hh) => (hh.quern && st.t < endOf(hh.quern) ? hh.quern : null);
  // Years left of the household's quern (0 when worn out; null with none).
  const yearsLeft = (st, hh) => (hh.quern ? Math.max(0, (endOf(hh.quern) - st.t) / YEAR) : null);
  // The grinding speed of a quern against sound sandstone's: its kind's grit, times its grade's work.
  const speed = (q) => rowOf(q).grit;
  // A household of the scenario's start has a sound quern of its village's bedrock where that is sandstone or granite, else granite, of an
  // age below QUERN.startAge years spread by its id, so that the start's querns do not all wear out in one year.
  function startQuern(st, hh) {
    const rock = rockOf(st, hh),
      age = (hh.id * 7) % QUERN.startAge;
    setQuern(hh, { kind: hewable(rock) ? rock : 'granite', grade: Workmanship.SOUND, made: st.t - age * YEAR });
  }
  // A new quern is wanted from QUERN.renewYears before the old one ends, or at once with none. It is hewn of a load on the heap that is
  // of a rock it can be hewn of; the load comes from the household's building step (sim/building), picked (field stone is granite) or
  // quarried where the rock can be hewn, within the step's reach; elsewhere it comes from the fair, when VB-302's fair trades the good.
  const wanted = (st, hh) => !hh.quern || st.t >= endOf(hh.quern) - QUERN.renewYears * YEAR;
  const canHew = (st, hh) => hh.farmstead !== null;
  // The rock of the best load on the heap a quern can be hewn of (the quern's kinds in their order: sandstone's grit first), or null.
  function hewLoad(hh) {
    const kinds = Goods.kindsOf('quern');
    for (let i = 0; i < kinds.length; i++) if ((hh.stone[kinds[i]] || 0) >= 1) return kinds[i]; // the heap by rock (sim/stores)
    return null;
  }
  // The quern as a made good (VB-698): its head's target the working querns the household keeps, 1 by default; one it holds is counted
  // while it is not yet due for renewal, so a new one is hewn while the target is above that (a target of 0 lets the quern wear out,
  // to be got elsewhere). None beyond its own: a quern hewn is set in the house, and no store holds a loose one yet (VB-699 reads the asks).
  const held = (st, hh) => (wanted(st, hh) ? 0 : 1);
  const hewWanted = (st, hh) => held(st, hh) < Targets.target(st, hh, 'quern');
  Targets.made({ good: 'quern', unit: 'stone', whole: true, need: () => 1, most: () => 0, held });
  // The heap lacks a load a wanted quern can be hewn of (sim/building's building step fetches one, of a rock that can be hewn).
  const wantsStone = (st, hh) => hewWanted(st, hh) && canHew(st, hh) && hewLoad(hh) === null;
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
  // ---- hewing: a load of sandstone or granite off the heap, QUERN.hewHours at home; in winter, or in any season with no working quern;
  // the quern is of the load's rock (VB-733), of the grade drawn by its hewer `by`'s skill at stonework (VB-761; none named: sound) ----
  function hewn(st, hh, by = null) {
    const rock = hewLoad(hh);
    if (!hewWanted(st, hh) || !canHew(st, hh) || rock === null) return false;
    Stores.take(st, hh, 'stone/' + rock, 1, 'quern');
    setQuern(hh, {
      kind: rock,
      grade: by === null ? Workmanship.SOUND : Workmanship.draw(st, by, 'stonework'),
      made: st.t,
    });
    return true;
  }
  const atHome = (dx, dy) => (st, a, j) => [st.w.hx[j.site] + dx + a.ox * 0.2, st.w.hy[j.site] + dy + a.oy * 0.2];
  // The job kinds (sim/kinds registers them; their fields are described there).
  const KINDS = {
    grind: {
      verb: 'Grinding grain at the quern',
      go: 'Going home to grind',
      name: 'Grind grain',
      at: ['house'],
      needs: ['grain', 'quern'],
      gives: ['flour'],
      label: 'Grinding',
      anim: null,
      hours: QUERN.grindHours,
      hands: 1,
      type: 'household',
      craft: 'milling', // VB-360
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
      at: ['house'],
      needs: ['stone'],
      gives: ['quern'],
      label: 'Quern',
      anim: 'mallet',
      hours: QUERN.hewHours,
      hands: 1,
      type: 'upkeep',
      craft: 'stonework', // VB-360
      spot: atHome(-6, 12),
      urgency: () => QUERN.urgency.hew,
      done: (st, j, hh, c, by) => {
        hewn(st, hh, by);
      },
      // while a new quern is wanted and the heap holds a load it can be hewn of: in winter, or at once with none working
      available: (st, hh, f, c, post) => {
        if (hewLoad(hh) === null || !hewWanted(st, hh) || !canHew(st, hh)) return;
        if (c.season === 3 || !quernOf(st, hh)) post(`hewQuern:h${hh.id}`, f.house, { farm: f });
      },
    },
  };
  // worked indoors (VB-1820: the work step says it, sim/methods labour; no field of the kind)
  VB['sim/methods'].labour(KINDS.grind, { inside: true });
  // The quern as a good of the fair (design.md, The mill and the loom: a good of place; Culture's worth table holds it at 25 rations).
  Goods.declareGood({
    id: 'quern',
    kind: 'quern',
    class: 'wares',
    unit: 'stone',
    quantum: 1,
    lump: 'quern',
    rations: 0,
    perish: null,
    keeping: true,
    material: 'stone',
    kinds: ['sandstone', 'granite'], // VB-733: a quern is of the rock it was hewn from, and grinds at its grit
    reads: ['grit'],
    graded: { work: ['grit'] }, // VB-761: a quern's grade multiplies its grit (grinding speed) by its work, its years by its life
  });
  return {
    // what it gives the page through the Sim facade (src/sim.js joins the lists, VB-1944)
    PAGE: [['quernYears', 'yearsLeft']],
    QUERN,
    KINDS,
    villageRock,
    hewable,
    hewLoad,
    quernsLoaded,
    quernOf,
    yearsLeft,
    speed,
    startQuern,
    wanted,
    canHew,
    wantsStone,
    flourWanted,
    ground,
    hewn,
  };
})();
