// @sys sim/building: the cottage's stages as job kinds, and what building takes (VB-328): timber felled in the village's wood and carried to
// every site that lacks it, one rule over the sites their modules name (VB-1407), and the plot's wood shared out when the plot is given;
// raising a house onto a stone foundation, with stone picked or quarried for it (VB-332); a booth, staked as its maker's project plan and
// raised (VB-784, VB-1172), standing until it rots
VB['sim/building'] = (() => {
  const Stores = VB['sim/stores'],
    Projects = VB['sim/projects'];
  const { BUILD, ECON, SEASON_DAYS, SPEED, TRAVEL, YEAR, BOOTH } = VB['sim/rules'],
    { HOUSE, houseCondition } = VB['sim/house'];
  const { B } = VB['gen'];
  const { bfs } = VB['sim/hex'];
  const { walkable } = VB['sim/walking'],
    { findRoute } = VB['sim/routes'];
  const { log, atFarm } = VB['sim/records'];
  const { emit, on } = VB['sim/events'];
  const Lying = VB['sim/lying'];
  const { living } = VB['sim/records'];
  const { fellTree, drawWood } = VB['sim/forest'];
  const { cottageJob, finishStep, plotTimber, cottageTimber } = VB['sim/expansion'];
  const { wantsStone } = VB['sim/quern'];
  const { freeFor } = VB['sim/territory'];
  const { register } = VB['sim/commands'];
  // Design (Land and ecology, Timber; Agreed, Kim, 10 Nov): a cottage's walls take BUILD.timber loads (six trees, 3 loads a tree as a firewood
  // trip's); a plot's felled tiles give their trees as its wood (sim/expansion, plot.wood); a cottage or booth short of it fells the rest in
  // the village's wood before its walls are raised, as firewood trips whose load goes to the site (site.wood: a plot's or a booth's cottage's walls step).
  // The timber trips (VB-328, VB-1407), one rule for every site that lacks timber: each module names its sites ({key, site, need, dest, owner,
  // and fell: the site's own tile when it is felled there}; sim/expansion a plot's and a booth's cottage, sim/projects a project step that
  // carries `timber`, this module a staked booth), and a trip is posted for each load the site lacks (sim/projects, lacks), at most two at a
  // time, from the village's wood (none where it has none, sim/territory) or the site's own tile.
  function fetchTimber(v, n, post) {
    if (!n) return;
    const from = n.fell ?? (v.wood.length ? v.wood[0] : null),
      k = Math.min(2, Math.ceil(Projects.lacks(n.site, n.need) / ECON.woodPerTrip));
    if (from === null) return;
    for (let i = 0; i < k; i++) {
      const extra = { village: v.id, timberFor: n.site, dest: n.dest };
      if (n.fell !== undefined) extra.onSite = true;
      post(`${n.key}${i ? 'b' : ''}`, from, extra, 'timber', n.owner);
    }
  }
  // Asked once for the island: in each village with wood, its cottages being built on a plot (the village's, or a household's for its heir),
  // then at each farm its booth's cottage and each of its household's open project steps that carries timber (a boat, VB-300; a cart, a
  // barn's walls, VB-255; several at once, VB-1414).
  function timberWork(st, holder, at, c, post) {
    for (const v of st.villages) {
      if (!v.wood.length) continue;
      for (const n of plotTimber(st, v)) fetchTimber(v, n, post);
      for (const id of v.farmsteads) {
        const f = st.farmsteads[id];
        fetchTimber(v, cottageTimber(st, f), post);
        for (const n of Projects.timberOf(st, f)) fetchTimber(v, n, post);
      }
    }
  }
  // Settlers build their cottage (sim/settle): the open stage of their household's cottage plan (sim/expansion).
  function boothWork(st, hh, f, c, post) {
    const bj = cottageJob(st, hh, f);
    if (bj) post(bj[0], f.house, bj[2], bj[1]);
  }
  // ---- a booth (VB-784; design.md, Sleeping away from home) ----
  // @state st.booths[]: the booths that stand, live ones only (one that has rotted away is taken out), in the order of their ids, each {id,
  //   tile, by (the household it is for: its maker's when raised), maker (the pawn who staked it), guests (pawns its maker lets in besides
  //   the household's), built (game hours), wood (loads lying at its tile, its fire), cond (0..1 at condAt), condAt}; st.boothSeq: the next
  //   id, never reused, taken when a booth is staked.
  // A booth staked and not yet raised is its maker's project plan (VB-1172; sim/projects, holder {type: 'pawn', id: the maker}): {...,
  //   what: 'booth', booth (the id it will stand under), tile, guests, steps: [{kind: 'timber', place: tile, hours: 0, timber: BOOTH.wood, wood (loads
  //   brought)}, {kind: 'booth', place: tile, hours: BOOTH.hours}]}: the wood, then the raising; the record is made when it is raised.
  const boothAt = (st, tile) => (st.booths.length ? st.booths.find((b) => b.tile === tile) || null : null);
  // The booths staked and not yet raised: each a pawn's plan (few: a pawn's plans are its booths and a restoration). Allocates nothing.
  function stakedEach(st, fn) {
    const P = st.plans && st.plans.projects;
    if (!P || !P.pawn.size) return;
    for (const list of P.pawn.values()) for (const plan of list) if (plan.what === 'booth') fn(plan);
  }
  // The staked booth on `tile`, or of id `bid`, or null.
  function stakedBy(st, test) {
    let out = null;
    stakedEach(st, (plan) => {
      if (out === null && test(plan)) out = plan;
    });
    return out;
  }
  const stakedAt = (st, tile) => stakedBy(st, (p) => p.tile === tile);
  const stakedId = (st, bid) => stakedBy(st, (p) => p.booth === bid);
  // A booth's condition now: it wears by closed form from condAt, whoever sleeps in it (a stay renews nothing).
  const boothCondition = (st, b) => Math.max(0, b.cond - ((st.t - b.condAt) / YEAR) * BOOTH.wear);
  // Whether pawn id may sleep in booth b: its household's own, or whom its maker let in.
  const boothOpenTo = (st, b, id) => st.pawns[id].household === b.by || b.guests.includes(id);
  // Why pawn id cannot raise a booth at `tile`, or null: ground nobody else owns or has staked, and no booth on it or staked there.
  function raiseBoothWhy(st, id, tile) {
    const p = st.pawns[id],
      hh = p.household === null ? null : st.households[p.household];
    if (!hh || hh.dissolved || hh.farmstead === null) return `pawn ${id} has no household to raise a booth for`;
    if (!(Number.isInteger(tile) && tile >= 0 && tile < st.w.N)) return `there is no tile ${tile}`;
    if (st.w.water[tile] || st.used.has(tile)) return `tile ${tile} is not open ground`;
    if (boothAt(st, tile)) return `a booth stands on tile ${tile}`;
    if (stakedAt(st, tile)) return `a booth is staked on tile ${tile}`;
    return freeFor(st, tile, st.farmsteads[hh.farmstead].village) ? null : `tile ${tile} is owned or staked by another`;
  }
  // Pawn id stakes a booth at tile (the verb `raiseBooth`, its only caller), for its household and the pawns `guests` names: its project
  // plan, the wood and then the raising (sim/projectplans makes it on projectBegun). The booth's id.
  function raiseBooth(st, id, tile, guests = []) {
    const bid = st.boothSeq++;
    st.visualDirty = true; // its ring of stakes
    emit(st, 'projectBegun', {
      type: 'pawn',
      id,
      project: {
        what: 'booth',
        booth: bid,
        tile,
        guests: [...guests],
        steps: [
          { kind: 'timber', place: tile, hours: 0, timber: BOOTH.wood, wood: 0 },
          { kind: 'booth', place: tile, hours: BOOTH.hours },
        ],
      },
    });
    return bid;
  }
  // The staked booths' work, asked once for the island (Rules for cost, 1: the live plans only): for each, owned by its maker's household,
  // the timber trips while its wood step lacks loads (felled on its tile where that is wooded, else fetched from the village's wood, as a
  // timber trip is), the step done once its wood lies there, then the raising. A plan whose maker has died or has no farm to go out from is
  // given up, its wood left lying.
  function stakedWork(st, holder, at, c, post) {
    stakedEach(st, (plan) => {
      const p = st.pawns[plan.holder.id],
        hh = p.household === null ? null : st.households[p.household];
      if (p.died !== null || !hh || hh.dissolved || hh.farmstead === null) {
        emit(st, 'projectGivenUp', { plan });
        return;
      }
      const owner = { type: 'household', id: hh.id },
        s = plan.steps[plan.open];
      if (s.kind === 'timber') {
        if (Projects.lacks(s, s.timber) > 0) {
          const n = { key: `timber:o${plan.booth}`, site: s, need: s.timber, dest: plan.tile, owner };
          if (st.w.trees[plan.tile] > 0) n.fell = plan.tile;
          fetchTimber(st.villages[st.farmsteads[hh.farmstead].village], n, post);
          return;
        }
        emit(st, 'stepDone', { type: 'pawn', id: p.id, plan }); // its wood lies there: the raising opens
      }
      post(`booth:o${plan.booth}`, plan.tile, { boothOf: p.id, boothId: plan.booth }, 'booth', owner);
    });
  }
  // Why the maker of booth `bid` cannot let pawn `id` in, or null (VB-984): only the pawn who staked it says whom it sleeps, before it is
  // built (its plan's guests) and after (the booth's); its own household needs no leave.
  function letInWhy(st, actor, bid, id) {
    const b = st.booths.find((x) => x.id === bid) || null,
      plan = b ? null : stakedId(st, bid);
    if (!b && !plan) return `there is no booth ${bid}`;
    if ((b ? b.maker : plan.holder.id) !== actor) return `pawn ${actor} did not make booth ${bid}`;
    if (!(Number.isInteger(id) && st.pawns[id] && st.pawns[id].alive)) return `there is no living pawn ${id}`;
    const open = b
      ? boothOpenTo(st, b, id)
      : st.pawns[id].household === st.pawns[actor].household || plan.guests.includes(id);
    return open ? `booth ${bid} is open to pawn ${id} already` : null;
  }
  // letIn(booth, {pawn}) (VB-984): the maker lets a pawn sleep in its booth; a right, so it holds at once wherever the maker stands.
  register('letIn', {
    check: (st, c) =>
      (st.pawns[c.actor] && st.pawns[c.actor].alive ? null : `pawn ${c.actor} is not living`) ||
      letInWhy(st, c.actor, c.target, c.args && c.args.pawn),
    run: (st, c) => {
      const b = st.booths.find((x) => x.id === c.target);
      if (b) b.guests.push(c.args.pawn);
      else {
        const plan = stakedId(st, c.target); // a booth not yet raised: its plan's guests, this module's (VB-1172)
        plan.guests.push(c.args.pawn);
      }
    },
  });
  // raiseBooth(tile, {guests}) (VB-784, VB-1172): stake a booth on ground nobody else owns or has staked, for the pawn's household and the
  // guests named: the pawn's project plan, which its household's pawns work (the wood, then BOOTH.hours of work). Staking takes no time, so
  // a pawn on the road or lodging away may stake one.
  register('raiseBooth', {
    check: (st, c) => living(st, c.actor) || raiseBoothWhy(st, c.actor, c.target),
    run: (st, c) => {
      raiseBooth(st, c.actor, c.target, (c.args && c.args.guests) || []);
    },
  });
  // Why pawn `actor` cannot give up booth `bid`, or null: it staked it, and it is not yet raised.
  function dropBoothWhy(st, actor, bid) {
    const plan = stakedId(st, bid);
    if (!plan) return st.booths.some((b) => b.id === bid) ? `booth ${bid} stands already` : `no booth ${bid} is staked`;
    return plan.holder.id === actor ? null : `pawn ${actor} did not stake booth ${bid}`;
  }
  // dropBooth(booth) (VB-1172): its maker gives up a booth staked and not yet raised: its plan is dropped (sim/projectplans' dropProject),
  // the wood brought left lying at its tile for the household to fetch.
  register('dropBooth', {
    check: (st, c) => living(st, c.actor) || dropBoothWhy(st, c.actor, c.target),
    run: (st, c) => {
      emit(st, 'projectGivenUp', { plan: stakedId(st, c.target) });
      st.visualDirty = true;
    },
  });
  // A booth plan dropped (given up, or its maker gone): the loads brought to its tile lie there, its household's to fetch home as firewood
  // (sim/lying's leftTimber), or to rot at the frost; with no household, they lie for the frost.
  on('planDropped', (st, d) => {
    const plan = d.plan;
    if (plan.what !== 'booth' || !(plan.steps[0].wood > 0)) return;
    const p = st.pawns[plan.holder.id],
      owner = p.household === null ? plan.holder : { type: 'household', id: p.household };
    Lying.leave(st, 'leftTimber', (plan.steps[0].wood / ECON.woodPerTrip) * TRAVEL.load, plan.tile, owner);
  });
  // A night's fire in booth b (VB-785): what its wood holds of `want`, taken (a booth's wood is its own, written only here and by the
  // raising); returns the amount burnt.
  function burnBooth(st, booth, want) {
    const b = st.booths[st.booths.indexOf(booth)],
      n = Math.min(b.wood || 0, want);
    b.wood = (b.wood || 0) - n;
    return n;
  }
  // The raising is done: the booth stands, whole, from now, for its maker's household and its guests, the wood brought lying at it (its
  // fire); its plan is finished, and the stays that sleep at its tile are under its roof (sim/away).
  function finishBooth(st, j) {
    const plan = stakedId(st, j.boothId);
    if (!plan || plan.holder.id !== j.boothOf) return;
    const b = {
      id: plan.booth,
      tile: plan.tile,
      by: st.pawns[plan.holder.id].household,
      maker: plan.holder.id,
      guests: [...plan.guests],
      built: st.t,
      wood: plan.steps[0].wood,
      cond: 1,
      condAt: st.t,
    };
    let i = st.booths.length;
    while (i > 0 && st.booths[i - 1].id > b.id) i--;
    st.booths.splice(i, 0, b);
    emit(st, 'stepDone', { type: 'pawn', id: plan.holder.id, plan });
    emit(st, 'boothRaised', b);
    st.visualDirty = true;
  }
  // Booths worn to nothing are gone and their tile is as it was; a stay that slept there is under the open sky from then. Daily, over the
  // live booths only.
  function rotBooths(st) {
    if (!st.booths.length) return;
    const gone = st.booths.filter((b) => boothCondition(st, b) <= 0);
    if (!gone.length) return;
    for (const b of gone) emit(st, 'boothGone', b.tile);
    st.booths = st.booths.filter((b) => !gone.includes(b));
    st.visualDirty = true;
  }
  // ---- a stone foundation (VB-332; design, Land and ecology, Stone, and Goods of place, A well-kept house) ----
  // A house is built on the bare ground (f.grade 'ground'); its household may raise it onto stone ('stone'), which lifts its standing term and
  // slows its wear (HOUSE, sim/house). Stone is wanted only while the household means to raise its house: its plan's building step
  // (plan.build, opened at a review by sim/plans from buildStep), not a standing target, so heaps do not grow without use.
  const STONES_PER_LOAD = 25; // as clearing loads them (sim/fields, sim/meadows)
  const pickable = (w, t) => w.biome[t] === B.MEADOW && w.stones[t] > BUILD.keepStones;
  const quarry = (w, t) => w.biome[t] === B.HILLS || w.biome[t] === B.MOUNTAIN;
  // Where the household's stone comes from: the nearest tile within BUILD.stoneReach walking steps of its house where a load may be picked (a
  // meadow tile of its own land or its village's outland holding more than a meadow keeps), else the nearest hills or mountain tile, not
  // another's land, to quarry; {tile, kind ('pick' | 'quarry')}, or {tile: -1, kind: null} when there is none (its heap may still fill
  // from clearing). One search, when the step opens or its tile is picked down.
  function stoneSource(st, f) {
    const w = st.w,
      own = (t) => st.owner[t] === f.household + 1 || (st.owner[t] === -f.village - 1 && !st.used.has(t));
    // Proposed (merge of VB-332 with VB-359, 11 Nov): the tile is also within BUILD.stoneWalk hours' walk of the house, so that a trip up a
    // steep slope does not end in the dark (tests/daylight.js); the nearest few of each kind are tried, nearest first.
    const near = (t) => findRoute(w, f.house, t, BUILD.stoneWalk * SPEED) !== null,
      picks = [],
      rocks = [];
    for (const [t, d] of bfs(w, f.house, BUILD.stoneReach, walkable(w)).dist) {
      if (pickable(w, t) && own(t)) picks.push([d, t]);
      else if (quarry(w, t) && (st.owner[t] === 0 || own(t))) rocks.push([d, t]);
    }
    const first = (list) => {
      const c = list
        .sort((a, b) => a[0] - b[0] || a[1] - b[1])
        .slice(0, 6)
        .find((e) => near(e[1]));
      return c ? c[1] : -1;
    };
    const pick = first(picks),
      rock = pick >= 0 ? -1 : first(rocks);
    return pick >= 0 ? { tile: pick, kind: 'pick' } : { tile: rock, kind: rock >= 0 ? 'quarry' : null };
  }
  // The building step a household's plan holds after a review: open while its house stands on the ground, lived in by it, and it has no
  // land project under way when the step would open (a household makes its land first); its source kept while a load can still be got there.
  // It is also open, whatever the house and the land, while the household wants a quern and its heap lacks the load to hew it from (VB-009).
  function buildStep(st, plan, hh) {
    const f = hh.farmstead !== null ? st.farmsteads[hh.farmstead] : null,
      old = plan.build || null,
      quern = !!f && wantsStone(st, hh);
    if (
      !f ||
      f.household !== hh.id ||
      f.booth ||
      (f.grade !== 'ground' && !quern) ||
      (!old && !quern && Projects.ownOf(st, hh.id))
    )
      return null;
    if (old && (old.kind !== 'pick' || pickable(st.w, old.tile))) return old;
    return stoneSource(st, f);
  }
  // The slack of the year, when a house is raised: the first half of summer, and winter.
  const slack = (c) => (c.season === 1 && c.sday < SEASON_DAYS / 2) || c.season === 3;
  // The household's building step: loads to its heap, two trips at a time, while it lacks the foundation's stone; then, in the slack, the
  // raising itself. Read from its plan; nothing is searched here.
  function stoneWork(st, hh, f, c, post) {
    const plan = st.plans.households.get(hh.id),
      step = plan && plan.build;
    if (!step || f.household !== hh.id) return;
    if (f.grade !== 'ground') {
      // a house on stone: the step is open for a quern's load (VB-009), one trip
      if (step.tile >= 0 && hh.stone < 1) post(`${step.kind}:h${hh.id}`, step.tile, { farm: f }, step.kind);
      return;
    }
    if (hh.stone >= BUILD.foundationStone) {
      if (slack(c)) post(`raise:f${f.id}`, f.house, { farm: f }, 'raise');
      return;
    }
    if (step.tile < 0) return;
    post(`${step.kind}:h${hh.id}`, step.tile, { farm: f }, step.kind);
    if (hh.stone + 1 < BUILD.foundationStone) post(`${step.kind}:h${hh.id}b`, step.tile, { farm: f }, step.kind);
  }
  // A load carried home onto the heap; a picked load off its tile, as clearing takes them.
  function stoneHome(st, j, hh) {
    if (j.kind === 'pick') {
      st.w.stones[j.site] = Math.max(0, st.w.stones[j.site] - STONES_PER_LOAD);
      st.biomeDirty.add(j.site);
    }
    Stores.put(st, hh, 'stone', 1, j.kind);
  }
  // The house raised: the foundation's stone off the heap, and the house on stone from now (its condition carried over at this hour, so the
  // closed form wears it at the stone's rate from here).
  function raised(st, j, hh) {
    const f = j.farm;
    if (f.grade !== 'ground' || hh.stone < BUILD.foundationStone) return;
    Stores.take(st, hh, 'stone', BUILD.foundationStone, 'foundation');
    f.condition = houseCondition(st, f);
    f.condAt = st.t;
    f.grade = 'stone';
    st.biomeDirty.add(f.house);
    st.farmDirty.add(f.id);
    log(st, `The house at ${f.name} is raised onto a stone foundation.`, { kind: 'cottage', ...atFarm(f) });
  }
  // ---- a barn (VB-255; BUILD.barn): a project of its household at the house, by the cottage's stages, its walls waiting for their timber ----
  // @state farmstead.barn (VB-255): {built (game hours)} once the farm has a barn, a second store building on its block, drawn beside the
  //   house; absent or null before. One a farm; it goes with the farm, not the household. Written only here, when its roof is on.
  const BARN_STAGES = ['barnbase', 'barnwalls', 'barnroof'];
  // The steps of a barn's project plan at house tile `house`: the three stages, the walls with the timber they wait for.
  const barnSteps = (house) =>
    BARN_STAGES.map((kind, i) => ({
      kind,
      place: house,
      hours: BUILD.barn.hours[i],
      ...(kind === 'barnwalls' ? { wood: 0, timber: BUILD.barn.timber } : {}),
    }));
  // A stage of the barn done: the next opens (sim/plans); with the roof on, the farm has its barn.
  // The holder is the farm's household (j.owner), not the hand's who ends it.
  const barnStage = (st, j) =>
    Projects.stepEnds(st, j, j.owner && j.owner.type === 'household' ? st.households[j.owner.id] : null, barnBuilt);
  function barnBuilt(st, j) {
    if (j.kind !== 'barnroof') return;
    const f = j.farm;
    f.barn = { built: st.t };
    st.biomeDirty.add(f.house);
    st.farmDirty.add(f.id);
  }
  const barnStage_ = (verb, go, name, label, anim, i) => ({
    verb,
    go,
    name,
    label,
    anim,
    hours: BUILD.barn.hours[i],
    hands: Infinity,
    type: 'wood',
    project: true,
    spot: (st, a, j) => [st.w.hx[j.site] + 16 + a.ox * 0.4, st.w.hy[j.site] + 2 + a.oy * 0.3],
    done: barnStage,
  });
  // The job kinds of building (sim/kinds takes them in). The cottage's stages, all finished by sim/expansion: a plot's (j.plot) by the
  // hand's finish, a booth household's (j.booth, settlers) here; a plot's are posted by sim/kinds' plotWork, a booth household's by boothWork.
  const stage = (verb, go, name, label, anim, hours) => ({
    verb,
    go,
    name,
    label,
    anim,
    hours,
    hands: Infinity,
    type: 'wood',
    done: (st, j) => {
      if (j.booth) finishStep(st, j);
    },
    available: boothWork,
  });
  const KINDS = {
    foundation: stage(
      'Laying the foundation',
      'Going to lay a foundation',
      'Lay the foundation',
      'Foundation',
      'mallet',
      30,
    ),
    walls: stage('Raising the log walls', 'Going to raise the walls', 'Raise the walls', 'Walls', 'chop', 60),
    roof: stage('Laying the turf roof', 'Going to lay the roof', 'Lay the roof', 'Roof', 'mallet', 30),
    barnbase: barnStage_(
      "Laying the barn's sill stones",
      'Going to build the barn',
      "Lay the barn's sills",
      'Barn',
      'mallet',
      0,
    ),
    barnwalls: barnStage_("Raising the barn's walls", 'Going to build the barn', 'Raise the barn', 'Barn', 'chop', 1),
    barnroof: barnStage_('Roofing the barn', 'Going to build the barn', 'Roof the barn', 'Barn', 'mallet', 2),
    timber: {
      verb: 'Felling timber',
      go: 'Heading to the woods for timber',
      back: 'Carrying timber to the building site',
      name: 'Fell timber',
      label: 'Timber',
      anim: 'chop',
      hours: 3,
      hands: 1,
      type: 'wood',
      carry: 'logs',
      to: 'site',
      spot: (st, a, j) => [st.w.hx[j.site] - 8 + a.ox * 0.4, st.w.hy[j.site] + 6],
      draw: (st, j) => (j.onSite ? j.site : drawWood(st, st.villages[j.village])),
      // a tree felled on the drawn tile; its load lies at the site, and the ledger of the village or household building says so
      deliver: (st, j) => {
        const v = st.villages[j.village];
        fellTree(st, st.w.trees[j.site] > 0 ? j.site : drawWood(st, v));
        j.timberFor.wood = (j.timberFor.wood || 0) + ECON.woodPerTrip;
        Stores.record(
          st,
          j.owner.type === 'village' ? v : st.households[j.owner.id],
          'timber',
          ECON.woodPerTrip,
          'timber',
        );
      },
      available: timberWork,
    },
    // A booth's raising (VB-784): BOOTH.hours at its tile once its wood lies there
    booth: {
      verb: 'Raising a booth',
      go: 'Going to raise a booth',
      name: 'Raise a booth',
      label: 'Booth',
      anim: 'mallet',
      hours: BOOTH.hours,
      hands: Infinity,
      type: 'wood',
      craft: 'building', // VB-360
      done: finishBooth,
      available: stakedWork,
    },
    // Timber left lying at a boat's shore when its plan was given up (sim/plans' leftWood, VB-645): never posted, only fetched (sim/lying's
    // fetch kind), home to the woodpile as firewood.
    leftTimber: {
      verb: 'Taking up timber',
      go: 'Going for timber left lying',
      name: 'Fetch timber left lying',
      hours: 0.5,
      label: 'Timber',
      back: 'Carrying timber home from where it was left',
      type: 'wood',
      carry: 'logs',
      to: 'woodpile',
      load: () => 0,
      deliver: (st, j, hh, f, a) =>
        Stores.put(st, hh, 'wood', ECON.woodPerTrip * Math.max(1, Math.round(a.load / TRAVEL.load)), 'timber'),
    },
    // The grain of a gift whose bearer died on the road (sim/away's dropStay, VB-850): lying where he fell, fetched home to the store of
    // the household it was set aside for (its village's, if that is gone), by crop as it was.
    leftGrain: {
      verb: 'Taking up grain',
      go: 'Going for grain left lying',
      name: 'Fetch grain left lying',
      hours: 0.5,
      label: 'Grain',
      back: 'Carrying grain home from where it was left',
      type: 'tilling',
      carry: 'sack',
      to: 'barn',
      load: () => 0,
      deliver: (st, j, hh, f, a) => {
        const sum = Object.values(j.parts).reduce((x, y) => x + y, 0),
          parts = {};
        for (const c in j.parts) parts[c] = (j.parts[c] * a.load) / sum;
        const at = j.owner.type === 'village' ? st.villages[j.owner.id] : hh;
        Stores.put(st, at, 'grain', a.load, { kind: 'gift', from: 'where it lay' }, parts);
      },
    },
    pick: {
      verb: 'Picking stones',
      go: 'Going to pick stones',
      back: 'Carrying stones home',
      name: 'Pick stones',
      label: 'Stones',
      anim: 'hoe',
      hours: BUILD.pickHours,
      hands: 1,
      type: 'tilling',
      carry: 'basket',
      to: 'barn',
      urgency: (st, j, c, U) => U.repair,
      deliver: stoneHome,
      available: stoneWork,
    },
    quarry: {
      verb: 'Breaking stone',
      go: 'Going to the quarry',
      back: 'Carrying stone home',
      name: 'Quarry stone',
      label: 'Quarry',
      anim: 'mallet',
      hours: BUILD.quarryHours,
      hands: 1,
      type: 'tilling',
      carry: 'basket',
      to: 'barn',
      urgency: (st, j, c, U) => U.repair,
      deliver: stoneHome,
      available: stoneWork,
    },
    raise: {
      verb: 'Laying a stone foundation',
      go: 'Going to raise the house',
      name: 'Raise the house onto stone',
      label: 'Foundation',
      anim: 'mallet',
      hours: BUILD.foundationHours,
      hands: 2,
      type: 'upkeep',
      craft: 'building', // VB-360
      urgency: (st, j, c, U) => U.repair,
      spot: (st, a, j) => [st.w.hx[j.site] - 4 + a.ox * 0.4, st.w.hy[j.site] + 14],
      done: (st, j) => raised(st, j, st.households[j.farm.household]),
      available: stoneWork,
    },
  };
  // The wood a given plot leaves once its new household has had its share (`left` loads): to the woodpiles of the households that worked
  // the plot, most hours first, each up to its winter goal (ECON.woodWinter); the rest is burnt where it lies. Returns the loads burnt.
  function shareWood(st, plot, left) {
    const by = new Map();
    for (const [id, h] of Object.entries(plot.hours)) {
      const p = st.pawns[id],
        hh = p && p.alive && p.household !== null ? st.households[p.household] : null;
      if (hh && !hh.dissolved) by.set(hh, (by.get(hh) || 0) + h);
    }
    for (const [hh] of [...by].sort((a, b) => b[1] - a[1] || a[0].id - b[0].id)) {
      if (left <= 0) break;
      const n = Math.min(left, Math.max(0, ECON.woodWinter - hh.wood));
      if (n > 0) {
        Stores.put(st, hh, 'wood', n, 'plot');
        left -= n;
      }
    }
    const walls = Projects.stepOf(plot, 'walls');
    walls.wood = 0;
    return left;
  }
  // The upkeep of built things, the fence and the house: job kinds too, joined by sim/kinds after the green's and the work day's, where
  // they stood (the order of the kinds is part of saved state: sim/plans' due-queue holds an index into the windowed ones).
  const UPKEEP = {
    mend: {
      verb: 'Mending the fence',
      go: 'Going to mend the fence',
      name: 'Mend the fence',
      label: 'Mending',
      anim: 'mallet',
      hours: 2.5,
      hands: 1,
      type: 'upkeep',
      spot: (st, a, j) => {
        const w = st.w,
          s = j.stretch;
        return [s.mx + (w.hx[j.site] - s.mx) * 0.25, s.my + (w.hy[j.site] - s.my) * 0.25 + 3];
      },
      urgency: (st, j, c, U) => (1 - j.stretch.cond) * U.mendPerCond,
      done: (st, j) => {
        j.stretch.cond = 1;
        j.stretch.dirty = true;
      },
      // a stretch worn below fenceMendBelow: of the farm's fence, the household's; asked at a village (no farm), of the village's own
      available: (st, holder, at, c, post, f) => {
        const E = st.ECON;
        if (f) {
          if (f.fence)
            for (const s of f.fence)
              if (s.cond < E.fenceMendBelow) post(`mend:f${f.id}.${s.id}`, s.tile, { stretch: s, farm: f });
          return;
        }
        for (const s of at.fence)
          if (s.cond < E.fenceMendBelow)
            post(`mend:v${at.id}.${s.id}`, s.tile, { stretch: s }, 'mend', { type: 'village', id: at.id });
      },
    },
    repair: {
      // the house's upkeep (VB-306): 4 work hours raise its condition 0.1, offered once it is under 0.8
      verb: 'Mending the house',
      go: 'Going to mend the house',
      name: 'Mend the house',
      label: 'House',
      anim: 'mallet',
      hours: HOUSE.hours,
      hands: 1,
      type: 'upkeep',
      urgency: (st, j, c, U) => U.repair,
      done: (st, j) => {
        const f = j.farm;
        f.condition = Math.min(1, houseCondition(st, f) + HOUSE.raise);
        f.condAt = st.t;
      },
      available: (st, hh, f, c, post) => {
        if (f.household === hh.id && !f.booth && houseCondition(st, f) < HOUSE.mendBelow)
          post(`repair:f${f.id}`, f.house, { farm: f });
      },
    },
  };
  return {
    UPKEEP,
    KINDS,
    boothAt,
    stakedAt,
    stakedEach,
    stakedWork,
    boothCondition,
    boothOpenTo,
    burnBooth,
    raiseBoothWhy,
    raiseBooth,
    rotBooths,
    boothWork,
    timberWork,
    shareWood,
    stoneWork,
    buildStep,
    stoneSource,
    barnSteps,
  };
})();
