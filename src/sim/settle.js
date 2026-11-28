// @sys sim/settle [social]: moving to new land: crowded villages, who leaves and with whom, provisions, the site, and the new village with its booth
VB['sim/settle'] = (() => {
  const { living } = VB['sim/records'];
  const { issue, register } = VB['sim/commands'];
  const Offers = VB['sim/offers'];
  const { next: rnd, drawer } = VB['sim/rng'];
  const { B } = VB['world/biomes'];
  const { DAY, SETTLE, ECON, FIELDS, WOOD, MARRIAGE, SPEED } = VB['sim/rules'],
    { CROPS, SOIL, fertility, openGround: farmable, clearable, clearedFertility } = VB['sim/crops'];
  const { bufferOf, act } = VB['sim/traits'];
  const { wishOf, moveWhy } = VB['sim/wishes'];
  const { reserved } = VB['sim/stores'];
  const { bfs, hexSteps, cutsOff } = VB['sim/hex'];
  const { cutTests } = VB['sim/walking'],
    { villageAdded, hoursBetween } = VB['sim/villagehours'],
    { costChanged, trailReach } = VB['sim/routes'];
  const { log, fullName, spouseOf, unionOf, siblingsOf, kinNear, settlementIdOf, atFarm } = VB['sim/records'];
  const { placeFields, siteScore, woodNear, makeFarmstead } = VB['sim/layout'];
  const names = VB['sim/names'];
  const { builtTiles, fieldProject } = VB['sim/fieldplans'];
  const { stake } = VB['sim/stakes'];
  const { findSite, activePlots, building, roomAt, livePlots, tilesOf } = VB['sim/expansion'];
  const Sites = VB['sim/sites'];
  const { foundHousehold } = VB['sim/membership'];
  const { farmName } = VB['sim/cottage'];
  const { addSettlement } = VB['sim/society'];
  const { makePlan } = VB['sim/plans'],
    { makeProject } = VB['sim/projectplans'];
  const { projectsOf } = VB['sim/projects'];
  const { reckonWood, woodTaken } = VB['sim/territory'];
  const { siteFetch, siteWater } = VB['sim/water'];
  const { siteWell } = VB['sim/wells'];
  const MAX_PLOTS = 2; // plots and booths under way in a village, as sim/expansion's projects at a time
  const listed = (xs) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
  const { keepsWard, mayHoldFarm, goesWith } = VB['sim/holding'];
  // ---- who waits, and which villages are crowded ----
  // The adults of each village who want out (st.demand) and have no plot coming: village id -> pawn ids, in demand order.
  function waitingByVillage(st) {
    const out = new Map();
    for (const id of st.demand) {
      const p = st.pawns[id];
      if (!mayHoldFarm(st, id, 'waits')) continue;
      const v = settlementIdOf(st, p),
        l = out.get(v);
      if (l) l.push(id);
      else out.set(v, [id]);
    }
    return out;
  }
  // After plots are started: a village is crowded when adults of it wait for land and there is no room for a plot (findSite). v.crowded counts
  // them; each counts the moving rounds waited in a crowded village (p.landWait), 0 for every other living pawn.
  function markCrowded(st) {
    const waiting = waitingByVillage(st),
      crowded = new Set();
    for (const v of st.villages) {
      const ids = waiting.get(v.id) || [];
      v.crowded = ids.length && findSite(st, v, false) === null ? ids.length : 0;
      if (v.crowded) for (const id of ids) crowded.add(id);
    }
    for (const id of st.living) {
      const p = st.pawns[id];
      p.landWait = crowded.has(p.id) ? (p.landWait || 0) + 1 : 0;
    }
    return waiting;
  }
  // ---- the party and its provisions ----
  // Who goes with settler p: their spouse, waiting unmarried siblings who choose to follow (each with SETTLE.follow, at most SETTLE.maxFollow,
  // in id order; one whose wish heads with new land follows without the draw, one who wishes never to settle stays: VB-392), and the
  // children under 18 of any of them who live with them, unless the child holds a farm or is a ward.
  function partyOf(st, p, waiting, taken) {
    const followers = [];
    for (const id of siblingsOf(st, p.id)) {
      if (followers.length >= SETTLE.maxFollow) break;
      if (
        !st.pawns[id].alive ||
        taken.has(id) ||
        !waiting.includes(id) ||
        spouseOf(st, id) !== null ||
        keepsWard(st, id)
      )
        continue;
      const wish = wishOf(st, id, 'settle');
      if (wish === true || (wish === null && rnd(st.rng.settle) < SETTLE.follow)) followers.push(id);
    }
    const all = goesWith(st, p.id, followers); // the start in life every way to a farm shares (sim/holding)
    return { all, followers };
  }
  // A home that took in a spouse at this round gives none (Kim, 10 November, VB-330): a member whose union started on this day, since the
  // villages' rounds marry on earlier steps of the day than settlement's (VB-277).
  const wedThisRound = (st, hh) =>
    hh.members.some((m) => {
      const u = unionOf(st, m);
      return u && Math.floor(u.start / DAY) === Math.floor(st.t / DAY);
    });
  // Food until the next harvest (SETTLE.provisionDays of the party's rations) and seed for one field: the party's stakes, then their old
  // households' grain, the settler's household first. An old household keeps its seed and the food of those who stay for its holder's buffer
  // (HELP) or until the harvest, whichever is longer, as kin keep theirs before giving (sim/help). {grain, gifts: [[household, grain]]}, or
  // null when it is not enough (and nothing is taken).
  const Stores = VB['sim/stores'];
  const rationsOf = (st, ids) =>
    ids.reduce((s, id) => s + (st.pawns[id].age >= 14 ? ECON.ration.adult : ECON.ration.child), 0);
  function provisions(st, all) {
    const need = Math.ceil(SETTLE.provisionDays * rationsOf(st, all)) + CROPS.barley.seed,
      gifts = [];
    let have = all.reduce((s, id) => s + (st.pawns[id].stake || 0), 0);
    for (const h of new Set(all.map((id) => st.pawns[id].household))) {
      if (have >= need) break;
      const hh = st.households[h];
      if (wedThisRound(st, hh)) continue;
      const stay = hh.members.filter((m) => !all.includes(m));
      const keep =
        reserved(st, hh, 'grain') + Math.max(bufferOf(st, hh.holder), SETTLE.provisionDays) * rationsOf(st, stay);
      const give = Math.min(need - have, Math.max(0, Math.floor(Stores.grainOf(hh) - keep)));
      if (give > 0) {
        gifts.push([h, give]);
        have += give;
      }
    }
    return have >= need ? { grain: have, gifts } : null;
  }
  // ---- the site of a new village ----
  // The land in use, for the site search: `taken`, tiles a new farm may not take (houses, greens, fields, field projects, plots, owned or claimed
  // tiles: a new village is founded in wilderness only, sim/territory);
  // `near`, every tile within SETTLE.apart - 1 steps of a house, green, field, field project or plot tile, where no new house or field goes.
  function landInUse(st) {
    const w = st.w,
      use = { taken: new Set(st.used), near: new Set() },
      marks = builtTiles(st);
    for (let t = 0; t < w.N; t++) if (st.owner[t] !== 0 || st.claims.has(t)) use.taken.add(t);
    for (const f of st.farmsteads) {
      for (const fd of f.fields) marks.add(fd.tile);
      if (f.household !== null)
        for (const p of projectsOf(st, 'household', f.household)) marks.add(p.steps[p.open].place); // its projects (sim/projects)
    }
    for (const v of st.villages)
      for (const p of [...v.plots, ...livePlots(st, v)]) for (const tr of tilesOf(p)) marks.add(tr.tile);
    for (const v of st.villages) for (const t of v.wood || []) use.near.add(t); // no house or field in a village's wood (VB-786)
    // A multi-source search computes the union of the same radius searches. Each tile is visited once,
    // even where hundreds of fields overlap; source order and BFS order cannot affect set membership.
    const queue = [...marks],
      depth = new Map(queue.map((t) => [t, 0]));
    for (const t of marks) use.taken.add(t);
    for (let head = 0; head < queue.length; head++) {
      const t = queue[head],
        d = depth.get(t);
      use.near.add(t);
      if (d >= SETTLE.apart - 1) continue;
      for (let k = 0; k < 6; k++) {
        const j = w.nb[t * 6 + k];
        if (j < 0 || depth.has(j)) continue;
        depth.set(j, d + 1);
        queue.push(j);
      }
    }
    return use;
  }
  function markUsed(w, use, t) {
    use.taken.add(t);
    for (const [j] of bfs(w, t, SETTLE.apart - 1, () => true).dist) use.near.add(j);
  }
  const meanFertility = (st, v) => {
    let n = 0,
      s = 0;
    for (const id of v.farmsteads)
      for (const fd of st.farmsteads[id].fields) {
        s += fd.fert;
        n++;
      }
    return n ? s / n : 1;
  };
  // The walking cost from village v's green to every tile within SETTLE.hours along a trail (VB-786): one bounded search (sim/routes
  // trailReach: a wooded tile with no path at a path's cost, the trail the party would blaze), a Map of tile to cost (hours × SPEED).
  const reachOf = (st, v) => trailReach(st.w, v.center, SETTLE.hours * SPEED);
  const wooded = (w, t) => w.biome[t] === B.FOREST || w.biome[t] === B.PINE;
  // House sites within SETTLE.hours of village v's green along a trail (reach: reachOf(st, v)), on meadow or wood (read as the meadow it
  // becomes when grubbed: sim/crops clearable) nobody uses, at least SETTLE.centreApart hex steps from every village centre (VB-154), by
  // siteScore less SETTLE.perHour an hour and SETTLE.perFetch a daily hour of the site's fetch for the party's `people` (sim/water
  // siteFetch: array reads; no site is refused for its water, VB-1583), best first: [tile, hours, score]; a third of the tiles are
  // tried, as for the generated lone farm.
  function candidates(st, v, use, reach, people = 1) {
    const w = st.w,
      out = [],
      centres = st.villages.map((u) => u.center);
    for (const [t, c] of reach) {
      if ((t * 31) % 3 || !(w.biome[t] === B.MEADOW || wooded(w, t)) || !clearable(w, t)) continue;
      if (use.taken.has(t) || use.near.has(t)) continue;
      if (centres.some((x) => hexSteps(w, x, t) < SETTLE.centreApart)) continue;
      const h = c / SPEED;
      out.push([t, h, siteScore(w, t, true) - SETTLE.perHour * h - SETTLE.perFetch * siteFetch(w, t, people)]);
    }
    return out.sort((a, b) => b[2] - a[2] || a[0] - b[0]);
  }
  // The best n sites for a new village from village v, best first: of the best SETTLE.candidates sites still free, those with a block of
  // SETTLE.fields fields (placeFields, none near other farms) at least SETTLE.fertility times as fertile on average as v's fields, and a
  // wood within reach; scored by the site's score plus SETTLE.fieldWeight times the block's fertility. Wooded land is read as the meadow it
  // becomes when grubbed (VB-786). [{house, field, hours, score}], none where there is no land.
  function bestSites(st, v, use, cands, n) {
    const w = st.w,
      minFert = SETTLE.fertility * meanFertility(st, v);
    const { shut, end: house } = cutTests(w); // a closed field counts as a house does (VB-816)
    const best = [];
    let bs = -Infinity, // the score to beat: the last kept, once n are
      tried = 0;
    for (const [t, h, s0] of cands) {
      if (tried >= SETTLE.candidates) break;
      if (use.taken.has(t) || use.near.has(t) || cutsOff(w, t, shut, house)) continue; // a house may not close a way (VB-402)
      tried++;
      const block = placeFields(w, use.taken, t, SETTLE.fields, use.near, null, true);
      if (!block) continue;
      // room besides the block for meadow and pasture, away from other farms (VB-154)
      const taken = (j) => j === t || block.includes(j) || use.taken.has(j) || use.near.has(j);
      if (roomAt(st, t, taken, null, true) < FIELDS.room) continue;
      const fert = block.reduce((a, k) => a + clearedFertility(w, k), 0),
        s = s0 + SETTLE.fieldWeight * fert;
      if (fert / block.length < minFert || s <= bs) continue;
      if (woodNear(w, use.taken, t, WOOD.least).length < WOOD.least) continue; // a wood in reach (VB-326)
      let k = best.length;
      while (k > 0 && best[k - 1].score < s) k--;
      best.splice(k, 0, { house: t, field: block[0], hours: h, score: s });
      if (best.length > n) best.pop();
      if (best.length === n) bs = best[n - 1].score;
    }
    return best;
  }
  // The site a leader not played takes: the first, the one its judgement ranks best. {house, field, hours, score}, or null.
  const newSite = (st, v, use, cands) => bestSites(st, v, use, cands, 1)[0] || null;
  // The sites a played leader chooses among (design.md, Settling in steps, The played pawn): the best SETTLE.shown, best first, each
  // with its water as the leader's estimate for the party's `people` (sim/water siteWater: the source and the walk, the daily fetch
  // and its share of a hand's day, the well's band with its hours; VB-1583).
  const sites = (st, v, use, cands, people = 1) =>
    bestSites(st, v, use, cands, SETTLE.shown).map((s) => ({ ...s, water: siteWater(st, s.house, people, null) }));
  // The name of a village founded on tile `site` by p of village `home` (sim/names: by its founder or its mother village, as the site
  // has it), from a stream of the tile's own, so naming draws nothing from the simulation's streams.
  const foundedName = (st, p, home, site) =>
    names.villageName(
      { w: st.w, site, founder: p, mother: home },
      new Set(st.villages.map((v) => v.name)),
      names.tileRand(site, names.VILLAGE.salt),
    );
  // ---- a small village to join (VB-147) ----
  // The small village settler p of village `home` joins before founding one: 1 to SETTLE.smallFarms farms, its green within SETTLE.join
  // walking hours of home's by the villages' table (hoursBetween, VB-786), and not crowded: none of its own adults waits for land
  // (waiting), fewer than MAX_PLOTS plots and booths are under way (plots not cleared or not built on, booths), and findSite finds room.
  // Villages with living near kin of the settler first, then the nearest, then the lowest id.
  // {village, house, field, hours}, or null.
  function smallVillage(st, home, p, waiting) {
    const kin = new Set();
    for (const q of kinNear(st, p.id))
      if (st.pawns[q].alive && st.pawns[q].household !== null) kin.add(settlementIdOf(st, st.pawns[q]));
    const near = st.villages.filter((u) => {
      const n = u.farmsteads.length;
      return (
        u.id !== home.id &&
        hoursBetween(st, home.id, u.id) <= SETTLE.join &&
        n >= 1 &&
        n <= SETTLE.smallFarms &&
        !(waiting.get(u.id) || []).length
      );
    });
    const rank = (u) => (kin.has(u.id) ? 0 : 1);
    const hours = (u) => hoursBetween(st, home.id, u.id);
    near.sort((a, b) => rank(a) - rank(b) || hours(a) - hours(b) || a.id - b.id);
    for (const u of near) {
      const under =
        activePlots(st, u).length +
        livePlots(st, u).filter(building).length +
        u.farmsteads.filter((id) => st.farmsteads[id].rung === 'shelter').length;
      if (under >= MAX_PLOTS) continue;
      const site = findSite(st, u);
      if (site) return { village: u, house: site.house, field: site.land, hours: hours(u) }; // its first field where the site was weighed by
    }
    return null;
  }
  // ---- settling: the move (step 4) ----
  // The party of site `site` settles on its house in village v: a farmstead whose cottage stands (built at the site, sim/sites), a
  // household with the provisions as its grain, and the first field its own where it was broken at the site, else its field project
  // (staked, and cleared, broken and sown from the household: Kim, 27 Nov 2026); the walls' timber left over on its woodpile.
  function settleFarm(st, v, home, party, house, field, prov, site = null) {
    const w = st.w,
      settler = st.pawns[party.all[0]];
    const ftr = site ? site.plot.places.find((tr) => tr.kind === 'field') : null,
      broken = !!ftr && ftr.i >= ftr.steps.length;
    if (!broken) st.used.delete(field); // the site's mark: the field is the household's project from now
    const f = makeFarmstead(w, st.farmsteads.length, house, broken ? [field] : [], v, st.used);
    if (broken && ftr.fresh) f.fields[0].soil = SOIL.fresh; // broken on ground never farmed (VB-149)
    f.condition = 1;
    f.condAt = st.t;
    f.emptySince = null;
    siteWell(st, f, v, party.all.length); // a site chosen for the well it means to dig (VB-1587)
    st.farmsteads.push(f);
    v.farmsteads.push(f.id);
    costChanged(st, house); // routes go round the house from now on
    // the farm of a village just founded bears the village's name (Erikstorp); one that joins a village is named as a new cottage is
    f.name = v.founded && v.farmsteads.length === 1 ? v.name : farmName(st, v, f, settler);
    const grain = {}, // by crop (VB-347), as the stakes and the gifts are taken
      piles = []; // where each was taken: it lies there, and the party bears it to the new farm (VB-675)
    for (const id of party.all) {
      const n = Stores.take(st, st.pawns[id], 'grain', st.pawns[id].stake || 0, 'provisions', grain);
      if (n > 0 && st.pawns[id].household !== null) piles.push([st.pawns[id].household, n]);
    }
    for (const [h, n] of prov.gifts) {
      Stores.take(st, st.households[h], 'grain', n, 'provisions', grain, 'seedFirst');
      piles.push([h, n]);
    }
    const text = `Left ${home.name} to settle at ${f.name}, ${v.name}`;
    const wood = site ? Math.min(ECON.woodWinter, Math.max(0, VB['sim/sites'].wallsOf(site).wood || 0)) : 0; // the rest burnt where it lies, as a plot's
    if (site) VB['sim/sites'].end(st, site); // the site is the farm now: the leader's stake ends, the household's own begin
    const hh = foundHousehold(st, f, party.all, settler.id, {
      grain,
      piles,
      text,
      followers: party.followers,
      wood,
      carry: false,
    });
    woodTaken(st, house);
    reckonWood(st, v); // a farm founded: the village's wood is reckoned again (VB-326)
    if (!broken) {
      stake(st, hh, field, 'field'); // the first field is staked till broken (sim/stakes)
      makeProject(st, 'household', hh.id, fieldProject(st, hh, field)); // its project plan (sim/plans, VB-123)
    }
    return f;
  }
  // A new village of one farm on `site`, founded by settler p of village `home`: it keeps the mother village's culture and practice.
  function found(st, home, p, party, site, prov) {
    const hs = st.cenv.settlements[home.id];
    const v = {
      id: st.villages.length,
      name: foundedName(st, p, home, site.house),
      center: site.house,
      farmsteads: [],
      rotation: home.rotation, // the mother village's usual rotation, as its practice (VB-350)
      fence: [],
      wood: [],
      grain: {},
      ledger: [],
      totals: [],
      green: false,
      well: null,
      plots: [],
      crowded: 0,
      founded: { t: st.t, from: home.id, by: p.id },
    };
    st.villages.push(v);
    makePlan(st, 'village', v.id);
    addSettlement(st, v, hs.culture, hs.practice, hs.tie);
    const f = settleFarm(st, v, home, party, site.house, site.field, prov, site.site || null);
    villageAdded(st); // VB-286: its row of the table of walking hours, at once
    return f;
  }
  // ---- the basis `party` of sim/offers (VB-692; plan VB-682, sections 2 and 4.5): {from (the one who would leave), to (the first grown
  // one of the party after it, else itself), gives {from (the village left), all (the party, the caller first), followers, house, field,
  // village (a small village joined, or absent to found one)}}. The grown of the party answer, and say yes by today's rule, as the round
  // drew them (partyOf); its minor children are not asked, and the caller leaves without leave (moveWhy). A yes is the leave verb. ----
  function partyWhy(st, o) {
    const g = o.gives || {},
      p = Number.isInteger(o.from) ? st.pawns[o.from] : null;
    if (!p || !p.alive) return `pawn ${o.from} is not a living pawn`;
    if (!st.villages[g.from] || !Array.isArray(g.all) || g.all[0] !== p.id || !Array.isArray(g.followers))
      return 'a party is called by its first, from its village';
    const whose = moveWhy(st, p.id, null, 'settle');
    return typeof whose === 'string' ? whose : {};
  }
  const partyAnswers = (st, o) => [
    ...moveWhy(st, o.from, null, 'settle')
      .filter((a) => a.by !== o.from)
      .map((a) => ({ key: a.key, by: a.by, yes: null })),
    ...o.gives.all
      .slice(1)
      .filter((id) => st.pawns[id].age >= 18)
      .map((id) => ({ key: `with${id}`, by: id, yes: null })),
  ];
  Offers.basis('party', {
    books: 'nothing',
    memory: false,
    wait: () => MARRIAGE.offerDays,
    check: partyWhy,
    answers: partyAnswers,
    weigh: () => true,
    settle: (st, o) => {
      const g = o.gives,
        { from, all, followers, house, field, village } = g;
      return issue(st, {
        actor: o.from,
        verb: 'stakeSite',
        args: { from, party: { all, followers }, house, field, ...(village !== undefined ? { village } : {}) },
        source: 'round',
      });
    },
    subject: (st, o) => o.from,
    where: (st, o) => o.gives.from,
    what: (st, o) => `the party of ${fullName(st.pawns[o.from])} for new land`,
  });
  // The chance to leave after `felt` rounds of waiting: SETTLE.chance[k] at k + 1 rounds, the last from then on, in a line between them
  // and from none at 0. The rounds felt are those waited over the pressure the pawn needs (TRAITS.acts.ambition.settle, 1 at ambition 0.5,
  // where it is SETTLE.chance by rounds waited; VB-520).
  function leaveChance(felt) {
    const C = SETTLE.chance;
    if (felt >= C.length) return C[C.length - 1];
    if (felt <= 1) return C[0] * Math.max(0, felt);
    const k = Math.floor(felt);
    return C[k - 1] + (C[k] - C[k - 1]) * (felt - k);
  }
  // At the moving round, after plots are started: in each crowded village, the waiting adults of SETTLE.ages, longest waiting first, then
  // oldest, may leave (leaveChance, by rounds waited and ambition; its wish may pass the draw or refuse it, VB-392) with their party, if
  // it has provisions: to a small village nearby that is not crowded (VB-147), else to found a new one where there is land.
  function settleRound(st) {
    const waiting = markCrowded(st);
    let use = null;
    for (const v of [...st.villages]) {
      if (!v.crowded) continue;
      const ids = [...waiting.get(v.id)],
        taken = new Set(ids.filter((id) => Sites.siteOf(st, id))), // a site's party waits for its move, and stakes no other
        at = (id) => st.pawns[id];
      ids.sort((a, b) => at(b).landWait - at(a).landWait || at(a).born - at(b).born || a - b);
      let reach = null,
        cands = null,
        candsFor = 0, // the party's people the candidates were scored for: a site's fetch is theirs
        noLand = false;
      for (const id of ids) {
        const p = st.pawns[id];
        if (
          taken.has(id) ||
          !p.alive ||
          p.age < SETTLE.ages[0] ||
          p.age > SETTLE.ages[1] ||
          !mayHoldFarm(st, id, 'settle') ||
          (p.ask !== undefined && p.ask !== null)
        )
          continue;
        const wish = wishOf(st, id, 'settle');
        if (
          wish === false ||
          (wish === null && rnd(st.rng.settle) >= leaveChance(p.landWait / act(st, id, 'ambition', 'settle')))
        )
          continue;
        const party = partyOf(st, p, ids, taken); // the provisions are reckoned at the move (step 4), not here
        if (!use) use = landInUse(st);
        if (!reach) reach = reachOf(st, v);
        let f = null,
          hours = 0;
        // the call to the party (the basis `party`, due at once: VB-692), whose yes is the stakeSite command; the site is the last one
        // staked, and its house and field are marked used for the rest of the round
        const leave = (args) => {
          const n = st.siteSeq;
          issue(st, {
            actor: p.id,
            verb: 'offer',
            target: party.all.slice(1).find((q) => st.pawns[q].age >= 18) ?? p.id,
            args: { basis: 'party', gives: { from: v.id, all: party.all, followers: party.followers, ...args } },
            source: 'round',
          });
          const s = Sites.byId(st, n);
          if (!s) return null;
          for (const t of [args.house, args.field]) markUsed(st.w, use, t);
          return s;
        };
        // a small village is not joined unasked: a plot there is asked of its alderman on the asking day (sim/asking, VB-697)
        if (!noLand) {
          if (!cands || candsFor !== party.all.length)
            cands = candidates(st, v, use, reach, (candsFor = party.all.length));
          const site = newSite(st, v, use, cands);
          if (site) {
            f = leave({ house: site.house, field: site.field });
            hours = site.hours;
          } else {
            noLand = true;
            const text = `No land worth clearing lies within ${SETTLE.hours} hours' walk of crowded ${v.name}, along a trail cut through the wood.`;
            log(st, text, {
              kind: 'noLand',
              village: v.id,
            });
          }
        }
        if (!f) continue;
        for (const q of party.all) taken.add(q);
        const others = party.all.slice(1),
          adults = others.filter((q) => st.pawns[q].age >= 18),
          kids = others.length - adults.length;
        const company = [
          ...adults.map((q) => fullName(st.pawns[q])),
          ...(kids ? [`${kids} ${kids > 1 ? 'children' : 'child'}`] : []),
        ];
        log(
          st,
          `${fullName(p)} of crowded ${v.name} stakes the site of a new farm${company.length ? ` for ${listed(company)} and itself` : ''}, ` +
            `${hours.toFixed(1)} hours' walk away along a trail.`,
          {
            kind: 'siteStaked',
            pawn: p.id,
            n: party.all.length,
            village: v.id,
            tile: f.house,
          },
        );
        v.crowded = Math.max(0, v.crowded - party.all.filter((q) => ids.includes(q)).length);
        st.demand = st.demand.filter((q) => !party.all.includes(q) || party.followers.includes(q)); // the followers still want land
      }
    }
  }
  // Why the party `party` of village `from` cannot stake a site at `house` with its first `field` (args as stakeSite's), or null.
  function stakeWhy(st, c) {
    const a = c.args || {};
    if (!st.villages[a.from]) return `there is no village ${a.from}`;
    if (!a.party || !Array.isArray(a.party.all) || a.party.all[0] !== c.actor)
      return 'the party must be led by the actor';
    for (const id of a.party.all) {
      const dead = living(st, id);
      if (dead) return dead;
      if (Sites.siteOf(st, id)) return `${fullName(st.pawns[id])} is of a party with a site already`;
    }
    if (![a.house, a.field].every((t) => Number.isInteger(t) && t >= 0 && t < st.w.N))
      return 'the house and field must be tiles';
    if (st.used.has(a.house) || st.used.has(a.field)) return 'the site is taken';
    if (a.village !== undefined && !st.villages[a.village]) return `there is no village ${a.village}`;
    return null;
  }
  // stakeSite({from, party: {all, followers}, house, field, village}) (VB-787; design.md, Settling in steps, 1): the actor stakes the site
  // of its party's new farm, in the small village `village` if given, else a new one: nobody moves, no grain is taken, no household or
  // village is made (sim/sites: the site, its stake and its trail).
  register('stakeSite', {
    check: stakeWhy,
    run: (st, c) => {
      Sites.stakeSite(st, c.args);
    },
  });
  // Why the leader of site `sid` cannot move its party there, or null: its cottage has its roof, and the provisions are there.
  function leaveWhy(st, c) {
    const s = Sites.byId(st, c.target);
    if (!s) return `there is no site ${c.target}`;
    if (s.leader !== c.actor) return 'the party must be led by the actor';
    if (!Sites.roofed(s)) return 'its cottage has no roof yet';
    for (const id of s.party.all) {
      const dead = living(st, id);
      if (dead) return dead;
    }
    return provisions(st, s.party.all) ? null : 'the family cannot spare the grain';
  }
  // leave(site) (VB-787; design.md, Settling in steps, 4): the leader moves its party to the site's finished cottage: the household is
  // founded with it as head, and the village where the site is a new one; provisions to the harvest and seed, as the round reckoned them.
  register('leave', {
    check: leaveWhy,
    run: (st, c) => {
      const s = Sites.byId(st, c.target),
        home = st.villages[s.from],
        party = { all: s.party.all, followers: s.party.followers },
        prov = provisions(st, party.all),
        p = st.pawns[c.actor],
        n = st.farmsteads.length;
      if (s.village !== null) settleFarm(st, st.villages[s.village], home, party, s.house, s.field, prov, s);
      else found(st, home, p, party, { house: s.house, field: s.field, site: s }, prov);
      const f = st.farmsteads[n],
        nv = st.villages[f.village];
      const others = party.all.length - 1 ? ` with ${party.all.length - 1} more` : '';
      log(st, `${fullName(p)} moves from ${home.name}${others} into the new cottage of ${f.name}, ${nv.name}.`, {
        kind: 'left',
        pawn: p.id,
        n: party.all.length,
        ...atFarm(f),
      });
    },
  });
  return {
    waitingByVillage,
    markCrowded,
    partyOf,
    provisions,
    landInUse,
    reachOf,
    candidates,
    newSite,
    sites,
    smallVillage,
    foundedName,
    settleFarm,
    found,
    leaveChance,
    settleRound,
  };
})();
