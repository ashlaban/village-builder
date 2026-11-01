// @sys sim/settle: moving to new land: crowded villages, who leaves and with whom, provisions, the site, and the new village with its booth
VB['sim/settle'] = (() => {
  const { B } = VB['gen'];
  const { SETTLE, ECON, FIELDS, fertility, farmable } = VB['sim/rules'];
  const { seedReserve } = VB['sim/hunger'];
  const { bfs, hexSteps } = VB['sim/hex'];
  const { walkable } = VB['sim/routes'];
  const { log, fullName, spouseOf, childrenOf, siblingsOf, kinNear, makeHousehold, settlementIdOf, isHolder } = VB['sim/records'];
  const { setOwner } = VB['sim/ownership'];
  const { placeFields, siteScore, nearestWood, makeFarmstead } = VB['sim/layout'];
  const names = VB['sim/names'];
  const { builtTiles, clearHours } = VB['sim/fields'];
  const { findSite, hasPlot, activePlots, building, roomAt } = VB['sim/expansion'];
  const { moveTo, refreshRoles } = VB['sim/heirs'];
  const { farmName } = VB['sim/cottage'];
  const { addSettlement } = VB['sim/society'];
  const MAX_PLOTS = 2; // plots and booths under way in a village, as sim/expansion's projects at a time
  const listed = (xs) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
  const guardian = (st, id) => st.households.some((h) => !h.dissolved && h.guardian === id);
  // ---- who waits, and which villages are crowded ----
  // The adults of each village who want out (st.demand) and have no plot coming: village id -> pawn ids, in demand order.
  function waitingByVillage(st) {
    const out = new Map();
    for (const id of st.demand) {
      const p = st.pawns[id]; if (!p.alive || p.household === null || hasPlot(st, id)) continue;
      const v = settlementIdOf(st, p), l = out.get(v); if (l) l.push(id); else out.set(v, [id]);
    }
    return out;
  }
  // After plots are started: a village is crowded when adults of it wait for land and there is no room for a plot (findSite). v.crowded counts
  // them; each counts the moving rounds waited in a crowded village (p.landWait), 0 for every other living pawn.
  function markCrowded(st) {
    const waiting = waitingByVillage(st), crowded = new Set();
    for (const v of st.villages) {
      const ids = waiting.get(v.id) || [];
      v.crowded = ids.length && findSite(st, v) === null ? ids.length : 0;
      if (v.crowded) for (const id of ids) crowded.add(id);
    }
    for (const p of st.pawns) if (p.alive) p.landWait = crowded.has(p.id) ? (p.landWait || 0) + 1 : 0;
    return waiting;
  }
  // ---- the party and its provisions ----
  // Who goes with settler p: their spouse, waiting unmarried siblings who choose to follow (each with SETTLE.follow, at most SETTLE.maxFollow,
  // in id order), and the children under 18 of any of them who live with them, unless the child holds a farm or is a ward.
  function partyOf(st, p, waiting, taken) {
    const all = [p.id], followers = [], sp = spouseOf(st, p.id);
    if (sp !== null && st.pawns[sp].alive) all.push(sp);
    for (const id of siblingsOf(st, p.id)) {
      if (followers.length >= SETTLE.maxFollow) break;
      if (!st.pawns[id].alive || taken.has(id) || !waiting.includes(id) || spouseOf(st, id) !== null || guardian(st, id)) continue;
      if (st.rand() < SETTLE.follow) followers.push(id);
    }
    all.push(...followers);
    for (const id of [...all]) for (const c of childrenOf(st, id)) {
      const q = st.pawns[c], hh = q.household !== null ? st.households[q.household] : null;
      if (!q.alive || q.age >= 18 || all.includes(c) || q.household !== st.pawns[id].household || isHolder(st, c) || (hh && hh.ward === c)) continue;
      all.push(c);
    }
    return { all, followers };
  }
  // Food until the next harvest (SETTLE.provisionDays of the party's rations) and seed for one field: the party's stakes, then their old
  // households' grain, the settler's household first. An old household keeps its seed and the food of those who stay for its holder's buffer
  // (HELP) or until the harvest, whichever is longer, as kin keep theirs before giving (sim/help). {grain, gifts: [[household, grain]]}, or
  // null when it is not enough (and nothing is taken).
  const rationsOf = (st, ids) => ids.reduce((s, id) => s + (st.pawns[id].age >= 14 ? ECON.ration.adult : ECON.ration.child), 0);
  function provisions(st, all) {
    const need = Math.ceil(SETTLE.provisionDays * rationsOf(st, all)) + ECON.seedPerField, gifts = [];
    let have = all.reduce((s, id) => s + (st.pawns[id].stake || 0), 0);
    for (const h of new Set(all.map((id) => st.pawns[id].household))) {
      if (have >= need) break;
      const hh = st.households[h], stay = hh.members.filter((m) => !all.includes(m)), holder = st.pawns[hh.holder];
      const keep = seedReserve(st, hh) + Math.max(holder.buffer, SETTLE.provisionDays) * rationsOf(st, stay);
      const give = Math.min(need - have, Math.max(0, Math.floor(hh.grain - keep)));
      if (give > 0) { gifts.push([h, give]); have += give; }
    }
    return have >= need ? { grain: have, gifts } : null;
  }
  // ---- the site of a new village ----
  // The land in use, for the site search: `taken`, tiles a new farm may not take (houses, greens, fields, field projects, plots, owned tiles);
  // `near`, every tile within SETTLE.apart - 1 steps of a house, green, field, field project or plot tile, where no new house or field goes.
  function landInUse(st) {
    const w = st.w, use = { taken: new Set(st.used), near: new Set() }, marks = [...builtTiles(st)];
    for (let t = 0; t < w.N; t++) if (st.owner[t] !== 0) use.taken.add(t);
    for (const f of st.farmsteads) { for (const fd of f.fields) marks.push(fd.tile); if (f.project) marks.push(f.project.tile); }
    for (const v of st.villages) for (const p of v.plots) for (const tr of p.tiles) marks.push(tr.tile);
    for (const t of marks) markUsed(w, use, t);
    return use;
  }
  function markUsed(w, use, t) {
    use.taken.add(t);
    for (const [j] of bfs(w, t, SETTLE.apart - 1, () => true).dist) use.near.add(j);
  }
  const meanFertility = (st, v) => {
    let n = 0, s = 0;
    for (const id of v.farmsteads) for (const fd of st.farmsteads[id].fields) { s += fd.fert; n++; }
    return n ? s / n : 1;
  };
  // Walking steps from village v's centre to every tile within reach of new villages and small villages to join.
  const reachOf = (st, v) => bfs(st.w, v.center, Math.max(SETTLE.reach[1], SETTLE.join), walkable(st.w)).dist;
  // House sites SETTLE.reach walking steps from village v's centre (reach: reachOf(st, v)), on meadow nobody uses, at least SETTLE.centreApart
  // hex steps from every village centre (VB-154), by siteScore less SETTLE.perStep a step, best first; a third of the tiles are tried, as for
  // the generated lone farm.
  function candidates(st, v, use, reach) {
    const w = st.w, [lo, hi] = SETTLE.reach, out = [], centres = st.villages.map((u) => u.center);
    for (const [t, d] of reach) {
      if (d > hi) continue;
      if (d < lo || (t * 31) % 3 || w.biome[t] !== B.MEADOW || !farmable(w, t) || use.taken.has(t) || use.near.has(t)) continue;
      if (centres.some((c) => hexSteps(w, c, t) < SETTLE.centreApart)) continue;
      out.push([t, d, siteScore(w, t) - SETTLE.perStep * d]);
    }
    return out.sort((a, b) => b[2] - a[2] || a[0] - b[0]);
  }
  // The best site for a new village from village v: of the best SETTLE.candidates sites still free, one with a block of SETTLE.fields fields
  // (placeFields, none near other farms) at least SETTLE.fertility times as fertile on average as v's fields, and a wood within reach; scored
  // by the site's score plus SETTLE.fieldWeight times the block's fertility. {house, field, steps, wood}, or null.
  function newSite(st, v, use, cands) {
    const w = st.w, minFert = SETTLE.fertility * meanFertility(st, v);
    let best = null, bs = -Infinity, tried = 0;
    for (const [t, d, s0] of cands) {
      if (tried >= SETTLE.candidates) break;
      if (use.taken.has(t) || use.near.has(t)) continue;
      tried++;
      const block = placeFields(w, use.taken, t, SETTLE.fields, use.near); if (!block) continue;
      // room besides the block for meadow and pasture, away from other farms (VB-154)
      if (roomAt(st, t, (j) => j === t || block.includes(j) || use.taken.has(j) || use.near.has(j)) < FIELDS.room) continue;
      const fert = block.reduce((a, k) => a + fertility(w, k), 0), s = s0 + SETTLE.fieldWeight * fert;
      if (fert / block.length < minFert || s <= bs) continue;
      const wood = nearestWood(w, use.taken, t); if (wood < 0) continue;
      bs = s; best = { house: t, field: block[0], steps: d, wood };
    }
    return best;
  }
  // The founder's given name in the genitive with a settlement ending, as many torp took their founder's name (sim/names); the first not taken.
  const founderName = (st, p) => names.founderName(p, new Set(st.villages.map((v) => v.name)), st.rand);
  // ---- a small village to join (VB-147) ----
  // The small village settler p of village `home` joins before founding one: 1 to SETTLE.smallFarms farms, its centre within SETTLE.join
  // walking steps (reach), and not crowded: none of its own adults waits for land (waiting), fewer than MAX_PLOTS plots and booths are under
  // way (plots not cleared or not built on, booths), and findSite finds room. Villages with living near kin of the settler first, then the
  // nearest, then the lowest id.
  // {village, house, field, steps}, or null.
  function smallVillage(st, home, p, waiting, reach) {
    const kin = new Set();
    for (const q of kinNear(st, p.id)) if (st.pawns[q].alive && st.pawns[q].household !== null) kin.add(settlementIdOf(st, st.pawns[q]));
    const near = st.villages.filter((u) => {
      const d = reach.get(u.center), n = u.farmsteads.length;
      return u.id !== home.id && d !== undefined && d <= SETTLE.join && n >= 1 && n <= SETTLE.smallFarms && !(waiting.get(u.id) || []).length;
    });
    const rank = (u) => (kin.has(u.id) ? 0 : 1);
    near.sort((a, b) => rank(a) - rank(b) || reach.get(a.center) - reach.get(b.center) || a.id - b.id);
    for (const u of near) {
      const under = activePlots(u).length + u.plots.filter(building).length + u.farmsteads.filter((id) => st.farmsteads[id].booth).length;
      if (under >= MAX_PLOTS) continue;
      const site = findSite(st, u);
      if (site) return { village: u, house: site.house, field: site.field, steps: reach.get(u.center) };
    }
    return null;
  }
  // ---- settling ----
  // The party moves into a booth on `house` in village v: a farmstead with no fields whose cottage is still to build (f.booth, built by
  // sim/expansion's booth jobs), a household with the provisions as its grain, and `field` as its first field project.
  function settleFarm(st, v, home, party, house, field, prov, use) {
    const w = st.w, settler = st.pawns[party.all[0]];
    const f = makeFarmstead(w, st.farmsteads.length, house, [], v, st.used);
    f.woodlot = v.commonsWood; f.condition = 1; f.emptySince = null; f.booth = { i: 0, done: 0 };
    st.farmsteads.push(f); v.farmsteads.push(f.id);
    // the farm of a village just founded bears the village's name (Erikstorp); one that joins a village is named as a new cottage is
    f.name = v.founded && v.farmsteads.length === 1 ? v.name : farmName(st, v, f, settler);
    const hh = makeHousehold({ pawns: st.pawns }, st.households.length, f, [], settler.id);
    hh.grain = prov.grain; hh.rations = 0; st.households.push(hh);
    for (const id of party.all) st.pawns[id].stake = 0;
    for (const [h, n] of prov.gifts) st.households[h].grain -= n;
    setOwner(st, house, { type: 'household', id: hh.id }); setOwner(st, field, { type: 'household', id: hh.id });
    f.project = { tile: field, stage: 'clear', hours: clearHours(st, field) };
    const text = `Left ${home.name} to settle at ${f.name}, ${v.name}`;
    for (const id of party.all) { moveTo(st, id, hh.id, text); st.rigDirty.add(id); }
    for (const id of party.followers) st.pawns[id].servant = true;
    for (const t of [house, field]) markUsed(w, use, t);
    refreshRoles(st); st.biomeDirty.add(house); st.visualDirty = true;
    return f;
  }
  // A new village of one farm on `site`, founded by settler p of village `home`: it keeps the mother village's culture and practice.
  function found(st, home, p, party, site, prov, use) {
    const hs = st.cenv.settlements[home.id];
    const v = { id: st.villages.length, name: founderName(st, p), center: site.house, farmsteads: [], fence: [], commonsWood: site.wood, grain: 0,
      green: false, well: false, plots: [], crowded: 0, founded: { t: st.t, from: home.id, by: p.id } };
    st.villages.push(v); addSettlement(st, v, hs.culture, hs.practice, hs.tie);
    return settleFarm(st, v, home, party, site.house, site.field, prov, use);
  }
  // At the moving round, after plots are started: in each crowded village, the waiting adults of SETTLE.ages, longest waiting first, then
  // oldest, may leave (SETTLE.chance by rounds waited) with their party, if it has provisions: to a small village nearby that is not
  // crowded (VB-147), else to found a new one where there is land.
  function settleRound(st) {
    const waiting = markCrowded(st);
    let use = null;
    for (const v of [...st.villages]) {
      if (!v.crowded) continue;
      const ids = [...waiting.get(v.id)], taken = new Set(), at = (id) => st.pawns[id];
      ids.sort((a, b) => at(b).landWait - at(a).landWait || at(a).born - at(b).born || a - b);
      let reach = null, cands = null, noLand = false;
      for (const id of ids) {
        const p = st.pawns[id];
        if (taken.has(id) || !p.alive || p.age < SETTLE.ages[0] || p.age > SETTLE.ages[1] || guardian(st, id)) continue;
        if (st.rand() >= SETTLE.chance[Math.min(p.landWait, SETTLE.chance.length) - 1]) continue;
        const party = partyOf(st, p, ids, taken), prov = provisions(st, party.all);
        if (!prov) { log(st, `${fullName(p)} would leave crowded ${v.name} for new land, but the family cannot spare the grain.`); continue; }
        if (!use) use = landInUse(st);
        if (!reach) reach = reachOf(st, v);
        let f = null, steps = 0;
        const join = smallVillage(st, v, p, waiting, reach);
        if (join) { f = settleFarm(st, join.village, v, party, join.house, join.field, prov, use); steps = join.steps; }
        else if (!noLand) {
          if (!cands) cands = candidates(st, v, use, reach);
          const site = newSite(st, v, use, cands);
          if (site) { f = found(st, v, p, party, site, prov, use); steps = site.steps; }
          else { noLand = true; log(st, `No land worth clearing lies within a day's walk of crowded ${v.name}.`); }
        }
        if (!f) continue;
        const nv = st.villages[f.village];
        for (const q of party.all) taken.add(q);
        const others = party.all.slice(1), adults = others.filter((q) => st.pawns[q].age >= 18), kids = others.length - adults.length;
        const company = [...adults.map((q) => fullName(st.pawns[q])), ...kids ? [`${kids} ${kids > 1 ? 'children' : 'child'}`] : []];
        log(st, `${fullName(p)} leaves crowded ${v.name}${company.length ? ` with ${listed(company)}` : ''} and `
          + `${join ? `settles at ${f.name} in ${nv.name}` : `founds ${nv.name}`}, ${steps} steps away.`);
        v.crowded = Math.max(0, v.crowded - party.all.filter((q) => ids.includes(q)).length);
        st.demand = st.demand.filter((q) => !party.all.includes(q) || party.followers.includes(q)); // the followers still want land
      }
    }
  }
  return { waitingByVillage, markCrowded, partyOf, provisions, landInUse, reachOf, candidates, newSite, smallVillage, founderName, settleFarm, found,
    settleRound };
})();
