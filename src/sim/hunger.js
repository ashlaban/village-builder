// @sys sim/hunger: the daily meal shared out by custom, the larder of stored food, each pawn's hunger level and health
VB['sim/hunger'] = (() => {
  const { HUNGER, HEALTH, HERD, DAY } = VB['sim/rules'];
  const { age, farmPractice } = VB['sim/records'];
  // Seed kept back for the fields not yet sown this year; never eaten.
  function seedReserve(st, hh) {
    const f = st.farmsteads[hh.farmstead];
    return (f.fields.filter((fd) => fd.stage === 'stubble' || fd.stage === 'plowed').length + (f.project ? 1 : 0)) * st.ECON.seedPerField;
  }
  // What the household's living members eat in a day, in rations.
  function dailyNeed(st, hh) {
    const adult = st.ECON.ration.adult, child = st.ECON.ration.child;
    return hh.members.map((id) => st.pawns[id]).filter((p) => p.died === null).reduce((s, p) => s + (age(st, p) >= 14 ? adult : child), 0);
  }
  // ---- the larder (VB-134): lots of stored food {kind, n (rations), until (game hours)}: fresh meat, salt meat, later milk and butter ----
  function addFood(st, hh, kind, n, days) { if (n > 0) hh.larder.push({ kind, n, until: st.t + days * DAY }); }
  const larderOf = (hh, kind) => hh.larder.reduce((s, l) => s + (!kind || l.kind === kind ? l.n : 0), 0);
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
  // Feeds a household for the day: larder food about to spoil first, then cooked rations and grain above the seed reserve, then the rest
  // of the larder; when that is not enough, what there is goes by the household's feedOrder, in groups served one after the other.
  function feedHousehold(st, hh) {
    const E = st.ECON, mem = hh.members.map((id) => st.pawns[id]).filter((p) => p.died === null);
    const need = new Map(mem.map((p) => [p, age(st, p) >= 14 ? E.ration.adult : E.ration.child])), total = [...need.values()].reduce((s, n) => s + n, 0);
    const eaten = new Map(mem.map((p) => [p, need.get(p)]));
    const early = hh.larder.length ? takeFood(st, hh, total, HERD.eatSoonDays * DAY) : 0, rest = total - early;
    const spare = Math.max(0, hh.grain - seedReserve(st, hh)), avail = hh.rations + spare; // cooked rations first, then grain
    const late = avail < rest && hh.larder.length ? takeFood(st, hh, rest - avail) : 0;
    if (avail >= rest - late) { const cooked = Math.min(hh.rations, rest - late); hh.rations -= cooked; hh.grain -= rest - late - cooked; }
    else {
      const order = st.cenv ? farmPractice(st, st.farmsteads[hh.farmstead]).feedOrder : 'equal';
      const worker = (p) => { const a = age(st, p); return a >= 14 && a < 60 && !p.retired; };
      const first = order === 'children' ? (p) => age(st, p) < 14 : order === 'workers' ? worker : null;
      let left = avail + early + late;
      for (const group of first ? [mem.filter(first), mem.filter((p) => !first(p))] : [mem]) {
        const gneed = group.reduce((s, p) => s + need.get(p), 0), give = Math.min(left, gneed);
        for (const p of group) eaten.set(p, gneed > 0 ? need.get(p) * give / gneed : 0);
        left -= give;
      }
      hh.rations = 0; hh.grain -= spare; hh.hungryDays++;
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
  return { feedHousehold, dailyNeed, seedReserve, updateHealth, addFood, larderOf, takeFood };
})();
