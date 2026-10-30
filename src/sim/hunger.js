// @sys sim/hunger: the daily meal shared out by custom, each pawn's hunger level and the death roll it feeds into
VB['sim/hunger'] = (() => {
  const { YEAR, YEAR_DAYS, hazard, HUNGER, HEALTH } = VB['sim/rules'];
  const { age, farmPractice } = VB['sim/records'];
  // Seed kept back for the fields not yet sown this year; never eaten.
  function seedReserve(st, hh) {
    return st.farmsteads[hh.farmstead].fields.filter((fd) => fd.stage === 'stubble' || fd.stage === 'plowed').length * st.ECON.seedPerField;
  }
  // Feeds a household for the day: what grain there is goes by the household's feedOrder, in groups served one after the other.
  function feedHousehold(st, hh) {
    const E = st.ECON, mem = hh.members.map((id) => st.pawns[id]).filter((p) => p.died === null);
    const need = new Map(mem.map((p) => [p, age(st, p) >= 14 ? E.ration.adult : E.ration.child])), total = [...need.values()].reduce((s, n) => s + n, 0);
    const eaten = new Map(mem.map((p) => [p, need.get(p)]));
    const avail = Math.max(0, hh.grain - seedReserve(st, hh));
    if (avail >= total) hh.grain -= total;
    else {
      const order = st.cenv ? farmPractice(st, st.farmsteads[hh.farmstead]).feedOrder : 'equal';
      const worker = (p) => { const a = age(st, p); return a >= 14 && a < 60 && !p.retired; };
      const first = order === 'children' ? (p) => age(st, p) < 14 : order === 'workers' ? worker : null;
      let left = avail;
      for (const group of first ? [mem.filter(first), mem.filter((p) => !first(p))] : [mem]) {
        const gneed = group.reduce((s, p) => s + need.get(p), 0), give = Math.min(left, gneed);
        for (const p of group) eaten.set(p, gneed > 0 ? need.get(p) * give / gneed : 0);
        left -= give;
      }
      hh.grain -= avail; hh.hungryDays++;
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
  // One pawn's death roll for the day: null, 'old age' or 'hunger' (a roll that falls in the share added by hunger). One random draw.
  function deathRoll(st, p) {
    const a = (st.t - p.born) / YEAR, base = hazard(a) / YEAR_DAYS, u = st.rand();
    if (p.health <= 0) return 'starvation';
    const frail = p.health < HEALTH.riskBelow ? 1 + (HEALTH.riskBelow - p.health) / HEALTH.riskSlope : 1;
    if (u >= base * (1 + HUNGER.k(Math.floor(a)) * p.hunger) * frail) return null;
    return u >= base ? 'hunger' : 'old age';
  }
  return { feedHousehold, deathRoll, seedReserve, updateHealth };
})();
