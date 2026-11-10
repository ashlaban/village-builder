// @sys sim/hunger: the daily meal shared out by custom, the larder of stored food, grain spoiling in store, each pawn's hunger level and health
VB['sim/hunger'] = (() => {
  const { HUNGER, HEALTH, HERD, HELP, DAY, YEAR_DAYS } = VB['sim/rules'];
  const { age, farmPractice } = VB['sim/records'];
  const Stores = VB['sim/stores'];
  const Rules = VB['sim/registry'], { ALLOWANCE_BOUND } = VB['sim/relations'];
  // Seed kept back for the fields not yet sown this year; never eaten.
  function seedReserve(st, hh) {
    const f = st.farmsteads[hh.farmstead];
    return (f.fields.filter((fd) => fd.stage === 'stubble' || fd.stage === 'plowed').length + (f.project ? 1 : 0)) * st.ECON.seedPerField;
  }
  // What the household's living members eat in a day, in rations.
  function dailyNeed(st, hh) {
    const adult = st.ECON.ration.adult, child = st.ECON.ration.child;
    let s = 0; // a loop, not map, filter and reduce: the job review asks it every hour from 14:00 for every household (VB-227)
    for (const id of hh.members) { const p = st.pawns[id]; if (p.died === null) s += age(st, p) >= 14 ? adult : child; }
    return s;
  }
  // The floor (VB-182): the seed reserve and HELP.floorDays of the household's need; no deal takes a household below it.
  const floorOf = (st, hh) => seedReserve(st, hh) + HELP.floorDays * dailyNeed(st, hh);
  // allowance's first term: the giving household's grain above its floor (sim/relations, VB-216)
  Rules.contribute({ rule: 'allowance', source: 'sim/hunger', key: 'slack', label: 'Grain above the floor', range: [0, ALLOWANCE_BOUND],
    tunables: ['HELP.floorDays'], value: (st, c) => Math.max(0, c.from.grain - floorOf(st, c.from)) });
  // ---- the larder (VB-134): lots of stored food {kind, n (rations), until (game hours)}: fresh meat, salt meat, later milk and butter ----
  function addFood(st, hh, kind, n, days) { if (n > 0) hh.larder.push({ kind, n, until: st.t + days * DAY }); }
  function larderOf(hh, kind) { let s = 0; for (const l of hh.larder) s += !kind || l.kind === kind ? l.n : 0; return s; } // the review asks it hourly
  // Takes up to `want` rations from the larder, the lots that spoil first first; only those within `soon` hours of spoiling when soon is
  // given. Returns what it took.
  function takeFood(st, hh, want, soon = Infinity) {
    let got = 0;
    for (const l of [...hh.larder].sort((a, b) => a.until - b.until)) {
      if (got >= want || l.until - st.t > soon) break;
      const k = Math.min(l.n, want - got); l.n -= k; got += k;
    }
    hh.larder = hh.larder.filter((l) => l.n > 1e-9);
    return got;
  }
  // The groups a short meal is served in, one after the other, by the household's feedOrder: its children or its workers first and then
  // the rest, or everyone together. mem: its living members, as pawns.
  function feedGroups(st, hh, mem) {
    const order = st.cenv ? farmPractice(st, st.farmsteads[hh.farmstead]).feedOrder : 'equal';
    const worker = (p) => { const a = age(st, p); return a >= 14 && a < 60 && !p.retired; };
    const first = order === 'children' ? (p) => age(st, p) < 14 : order === 'workers' ? worker : null;
    return first ? [mem.filter(first), mem.filter((p) => !first(p))] : [mem];
  }
  // The members a short meal reaches last, as pawn ids: the feed order's last group with anyone in it. Reads only.
  function servedLast(st, hh) {
    const groups = feedGroups(st, hh, hh.members.map((id) => st.pawns[id]).filter((p) => p.died === null)).filter((g) => g.length);
    return groups.length ? groups[groups.length - 1].map((p) => p.id) : [];
  }
  // Feeds a household for the day: larder food about to spoil first, then cooked rations and grain above the seed reserve, then the rest
  // of the larder; when that is not enough, what there is goes by the household's feedOrder, in groups served one after the other.
  function feedHousehold(st, hh) {
    const E = st.ECON, mem = hh.members.map((id) => st.pawns[id]).filter((p) => p.died === null);
    const need = new Map(mem.map((p) => [p, age(st, p) >= 14 ? E.ration.adult : E.ration.child])), total = [...need.values()].reduce((s, n) => s + n, 0);
    const eaten = new Map(mem.map((p) => [p, need.get(p)]));
    const early = hh.larder.length ? takeFood(st, hh, total, HERD.eatSoonDays * DAY) : 0, rest = total - early;
    const spare = Math.max(0, hh.grain - seedReserve(st, hh)), avail = hh.rations + spare; // cooked rations first, then grain
    const late = avail < rest && hh.larder.length ? takeFood(st, hh, rest - avail) : 0;
    if (avail >= rest - late) {
      // the larder's pieces may sum past what was asked by a rounding error, so what is left to eat is never below 0 (populous 3, year 15)
      const left = Math.max(0, rest - late), cooked = Math.min(hh.rations, left); Stores.take(st, hh, 'rations', cooked, 'meal');
      Stores.take(st, hh, 'grain', Math.max(0, left - cooked), 'meal'); }
    else {
      let left = avail + early + late;
      for (const group of feedGroups(st, hh, mem)) {
        const gneed = group.reduce((s, p) => s + need.get(p), 0), give = Math.min(left, gneed);
        for (const p of group) eaten.set(p, gneed > 0 ? need.get(p) * give / gneed : 0);
        left -= give;
      }
      Stores.take(st, hh, 'rations', hh.rations, 'meal'); Stores.take(st, hh, 'grain', spare, 'meal'); hh.hungryDays++;
    }
    let sum = 0;
    for (const p of mem) {
      p.hungerLog.push(1 - eaten.get(p) / need.get(p)); if (p.hungerLog.length > HUNGER.days) p.hungerLog.shift();
      p.hunger = p.hungerLog.reduce((s, x) => s + x, 0) / HUNGER.days; sum += p.hunger;
      updateHealth(st, p, eaten.get(p) >= need.get(p));
    }
    hh.hunger = mem.length ? sum / mem.length : 0;
  }
  // Health after the meal: hunger drains it (faster for the very young and the old), a full meal restores some.
  function updateHealth(st, p, fed) {
    const a = age(st, p);
    if (p.hunger > 0) p.health -= HEALTH.drain * p.hunger * p.hunger * (a < 5 || a >= 60 ? HEALTH.frail : 1);
    if (fed) p.health += HEALTH.recover;
    p.health = Math.max(0, Math.min(100, p.health));
  }
  // Grain in the barn spoils a little each day (balance review): ECON.storeLoss a year of the first year's need held, of the second, and of the
  // rest, so a good farm's store levels off at a year or two of need instead of growing for ever. hh.spoilt counts the rations lost.
  function spoilGrain(st, hh) {
    const year = dailyNeed(st, hh) * YEAR_DAYS, L = st.ECON.storeLoss, g = hh.grain;
    if (!(g > 0)) return;
    const parts = [Math.min(g, year), Math.min(Math.max(0, g - year), year), Math.max(0, g - 2 * year)];
    const lost = parts.reduce((s, x, k) => s + x * (1 - Math.pow(1 - L[k], 1 / YEAR_DAYS)), 0);
    Stores.spoil(st, hh, lost);
  }
  return { feedHousehold, feedGroups, servedLast, dailyNeed, seedReserve, floorOf, updateHealth, addFood, larderOf, takeFood, spoilGrain };
})();
