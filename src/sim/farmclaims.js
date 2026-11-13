// @sys sim/farmclaims: claims on empty farms (VB-033): the old family's birthright, who may claim a farm in the order of the village's
// "Claims on empty farms" custom, the claim at the moving round, the restoration, and the claimants moving in
VB['sim/farmclaims'] = (() => {
  const issue = (st, cmd) => VB['sim/commands'].issue(st, cmd); // sim/commands loads after this module
  const { YEAR, CLAIMS, CROPS } = VB['sim/rules'];
  const { hexSteps } = VB['sim/hex'];
  const {
    spouseOf,
    childrenOf,
    isHolder,
    kinDegree,
    practice,
    settlementIdOf,
    log,
    fullName,
    personEvent,
    atFarm,
    atHousehold,
    wishOf,
  } = VB['sim/records'];
  const CL = VB['sim/claims'];
  const { dailyNeed } = VB['sim/hunger'],
    { reserved } = VB['sim/stores'];
  const { hasPlot, awaitsCottage } = VB['sim/expansion'];
  const { emit } = VB['sim/events'],
    { onFarm, projectOf } = VB['sim/projects'];
  // A claim on an empty farm being restored is its claimant's project plan (VB-123; sim/plans makes it on the event projectBegun): {...,
  //   holder: {type: 'pawn', id: the claimant}, what: 'restore', farm (its id), since (game hours), steps: [{kind: 'restore', place (the
  //   house), hours (to restore, by the condition when claimed), done (hours worked), stake: 'farm'}]}; the claimant's unrealised claim
  //   (`why` 'farm') stands on the house. `claimOn` reads it as farmstead.claim was read: {by, since, hours, done}, or null.
  const claimOn = (st, f) => {
    const p = onFarm(st, f.id);
    return p && { by: p.holder.id, since: p.since, hours: p.steps[0].hours, done: p.steps[0].done, plan: p };
  };
  // ---- the birthright (bördsrätt; Kim, 1 Nov): when a farm empties, its last holder's family keeps a realised claim on its house ----
  const PAWN = (id) => ({ type: 'pawn', id });
  // Farm f has emptied (at `since`, game hours) after `holder` held it: a realised birthright claim by that pawn on its house, until
  // CLAIMS.birthrightYears after; none once that has passed (a scenario's farm empty longer).
  function birthright(st, f, holder, since = st.t) {
    const until = since + CLAIMS.birthrightYears * YEAR;
    if (holder === null || holder === undefined || until <= st.t) return null;
    return CL.addClaim(st, f.house, PAWN(holder), 'birthright', { state: 'realised', until });
  }
  // The birthright standing on farm f, or null.
  const birthrightOn = (st, f) => CL.claimsOn(st, f.house).find((c) => c.why === 'birthright') || null;
  // ---- restoration (Kim, 30 Oct): hours along straight lines through 0 h at condition 1, 20 h at 0.4, 60 h at 0.15 and 120 h at 0 ----
  const CURVE = [
    [1, 0],
    [0.4, 20],
    [0.15, 60],
    [0, 120],
  ];
  function restoreHours(c) {
    c = Math.max(0, Math.min(1, c));
    for (let k = 1; k < CURVE.length; k++) {
      const [c0, h0] = CURVE[k - 1],
        [c1, h1] = CURVE[k];
      if (c >= c1) return h0 + ((h1 - h0) * (c0 - c)) / (c0 - c1);
    }
    return CURVE[CURVE.length - 1][1];
  }
  // A farm that may be claimed: empty, and derelict rather than a ruin (below 15%; left out until the full rebuild, Kim 1 Nov), with no claim
  // under way.
  const claimable = (st, f) => f.household === null && f.state === 'derelict' && !onFarm(st, f.id);
  // ---- who may claim, and in what order ----
  const landed = (st, id) => {
    const sp = spouseOf(st, id);
    return isHolder(st, id) || (sp !== null && isHolder(st, sp));
  };
  const guardian = (st, id) => st.liveHouseholds.some((hid) => st.households[hid].guardian === id);
  // A pawn of `ids` (st.demand: landless adults who want out) who may claim a farm at all: alive and grown, with no farm, no claim under way,
  // no plot coming (sim/expansion) and no ward to keep.
  // barred says which of these stands in the way, or null.
  const barred = (st, id) => {
    const p = st.pawns[id];
    return !p.alive || p.age < 18
      ? 'under 18'
      : p.household === null
        ? 'has no home'
        : landed(st, id)
          ? 'holds a farm, or is married to its holder'
          : claimOf(st, id)
            ? 'restoring a farm it claimed'
            : hasPlot(st, id) || awaitsCottage(st, id)
              ? 'has a plot coming'
              : guardian(st, id)
                ? 'keeps a ward'
                : null;
  };
  const free = (st, id) => barred(st, id) === null;
  // The farm whose claim pawn id, or their spouse, has under way, or null.
  function claimOf(st, id) {
    const sp = spouseOf(st, id);
    const p = projectOf(st, 'pawn', id) || (sp !== null ? projectOf(st, 'pawn', sp) : null);
    return p ? st.farmsteads[p.farm] : null;
  }
  // The claimants of farm f among `ids`, best first, under its village's `claims` practice (a key of the custom):
  //   kin       while the old family's birthright stands, its kin first (any village within CLAIMS.farmReach), closest degree first; then the
  //             farm's own villagers; once it lapses, the villagers only
  //   villagers the farm's villagers, then those of villages within reach
  //   anyone    any landless adult of a village within reach
  //   assembly  the meeting assigns it to one of its own: most voice-weighted support through ties first (sim/claims, support)
  // Then married couples before singles, then the oldest. One of a married couple stands for both (the first of them).
  // Which farm a pawn would take is its own wish, any it may, and the player's stands in (st.player.wishes.claim, VB-212); the order is a rule.
  function claimants(st, f, ids = st.demand, rule = practice(st, f.village).claims) {
    const vid = f.village,
      centre = st.villages[vid].center,
      right = rule === 'kin' ? birthrightOn(st, f) : null;
    const home = (id) => settlementIdOf(st, st.pawns[id]);
    const near = (id) => home(id) === vid || hexSteps(st.w, st.villages[home(id)].center, centre) <= CLAIMS.farmReach;
    const degree = new Map();
    if (right)
      for (const id of ids) {
        const d = kinDegree(st, id, right.by.id);
        if (Number.isFinite(d)) degree.set(id, d);
      }
    const keep = (id) => {
      if (!free(st, id)) return false;
      const wish = wishOf(st, id, 'claim');
      if (wish !== null && wish !== f.id) return false; // the player's: no farm, or only the one it names
      if (rule === 'kin') return home(id) === vid || (degree.has(id) && near(id));
      if (rule === 'assembly') return home(id) === vid;
      return near(id);
    };
    let list = ids.filter(keep);
    const cls = (id) =>
      rule === 'kin' ? (degree.has(id) ? 0 : 1) : rule === 'villagers' ? (home(id) === vid ? 0 : 1) : 0;
    const key = new Map();
    if (rule === 'kin') for (const id of list) key.set(id, degree.has(id) ? degree.get(id) : 0);
    if (rule === 'assembly') {
      const sup = CL.support(
        st,
        list.map((id) => ({ by: PAWN(id) })),
        vid,
      );
      list.forEach((id, k) => key.set(id, -sup[k]));
    }
    const couple = (id) => {
      const sp = spouseOf(st, id);
      return sp !== null && st.pawns[sp].alive ? 0 : 1;
    };
    list.sort(
      (a, b) =>
        cls(a) - cls(b) ||
        (key.get(a) || 0) - (key.get(b) || 0) ||
        couple(a) - couple(b) ||
        st.pawns[a].born - st.pawns[b].born ||
        a - b,
    );
    const seen = new Set();
    list = list.filter((id) => {
      const sp = spouseOf(st, id);
      if (seen.has(id)) return false;
      seen.add(id);
      if (sp !== null) seen.add(sp);
      return true;
    });
    return list;
  }
  // ---- the claim, at the moving round ----
  const HH = (id) => ({ type: 'household', id });
  // The claimant of farm f may still take it: alive, in a household, with no farm of their own meanwhile.
  const valid = (st, f) => {
    const p = st.pawns[claimOn(st, f).by];
    return p.alive && p.household !== null && !landed(st, p.id) && f.household === null;
  };
  // Pawn id claims farm f: the claim, the claimant's unrealised claim on the house, renewed by the restoration (`worked`); no longer waiting
  // for land (st.demand; sim/heirs' wantsOut leaves claimants out).
  function startClaim(st, f, id) {
    const p = st.pawns[id],
      sp = spouseOf(st, id),
      right = birthrightOn(st, f),
      v = st.villages[f.village];
    const hours = restoreHours(f.condition);
    emit(st, 'projectBegun', {
      type: 'pawn',
      id,
      project: {
        what: 'restore',
        farm: f.id,
        since: st.t,
        steps: [{ kind: 'restore', place: f.house, hours, done: 0, stake: 'farm' }],
      },
    });
    CL.addClaim(st, f.house, PAWN(id), 'farm', { state: 'unrealised', until: null }); // the last holder's own birthright is taken up by it
    st.demand = st.demand.filter((q) => q !== id && q !== sp);
    const kin = right && Number.isFinite(kinDegree(st, id, right.by.id)) && practice(st, f.village).claims === 'kin';
    personEvent(st, id, 'claim', `Claimed the empty farm ${f.name} in ${v.name}${kin ? ' by birthright' : ''}`, false); // recorded below
    log(
      st,
      `${fullName(p)} claims the empty farm ${f.name} in ${v.name}${kin ? ", by the old family's birthright," : ''} and sets about ` +
        `mending it (${Math.round(hours)} hours).`,
      { kind: 'claim', pawn: id, ...atFarm(f) },
    );
  }
  // The claim ends unfulfilled (the claimant died or took land, or the claim lapsed): the farm stands empty, claimable again.
  function endClaim(st, f, text) {
    const by = claimOn(st, f).by;
    CL.dropClaim(st, f.house, PAWN(by));
    emit(st, 'rightLost', { type: 'pawn', id: by, tile: f.house, told: true }); // its plan is dropped (sim/plans); told below
    if (text) log(st, text, { kind: 'claimEnded', ...atFarm(f) });
  }
  const ended = (st, f) => {
    const p = st.pawns[claimOn(st, f).by];
    endClaim(
      st,
      f,
      p.alive
        ? `${fullName(p)} gives up the claim on ${f.name}, having land now.`
        : `The claim on ${f.name} died with ${fullName(p)}.`,
    );
  };
  // At the moving round, after st.demand is counted and before plots are started (sim/expansion): each farm that may be claimed, in id order,
  // goes to its first claimant (claimants) who has not claimed another this round. Claims whose claimant died or took land end first.
  function claimFarms(st) {
    for (const f of st.farmsteads) if (onFarm(st, f.id) && !valid(st, f)) ended(st, f);
    for (const f of st.farmsteads) {
      if (!claimable(st, f)) continue;
      const pick = claimants(st, f)[0];
      if (pick !== undefined) issue(st, { actor: pick, verb: 'claim', target: f.id, source: 'round' });
    }
  }
  // The farm pawn id may claim now, or null (sim/expansion clears a plot only for those with none).
  const claimableFarm = (st, id) =>
    st.farmsteads.find((f) => claimable(st, f) && claimants(st, f, [id]).length > 0) || null;
  // ---- the restoration: one job, owned by the claimant's household; progress kept on the claim ----
  // The restoration jobs to post: [key, kind, owner, site, extra]. A claim no longer valid ends here. The key names the household, so a
  // claimant who moves house goes on with the hours done (kept on the plan's step at each posting).
  function claimJobs(st) {
    const out = [];
    for (const f of st.farmsteads) {
      const c = claimOn(st, f);
      if (!c) continue;
      if (!valid(st, f)) {
        ended(st, f);
        continue;
      }
      const hid = st.pawns[c.by].household,
        key = `restore:f${f.id}.h${hid}`,
        live = st.jobs.get(key);
      if (live) c.done = c.plan.steps[0].done = live.done;
      out.push([
        key,
        'restore',
        HH(hid),
        f.house,
        { farm: f, claim: { by: c.by, since: c.since }, done: c.done, hours: c.hours },
      ]);
    }
    return out;
  }
  // Role priority (0..10) for a restoration job: the claimant and spouse CLAIMS.claimantPrio, the other grown members of the household
  // CLAIMS.helperPrio (Kim, 1 Nov; as for a plot).
  function claimPrio(st, p, j) {
    const by = j.claim.by;
    return p.id === by || p.id === spouseOf(st, by) ? CLAIMS.claimantPrio : p.role === 'child' ? 0 : CLAIMS.helperPrio;
  }
  // The job is still that claim's (it did not end meanwhile).
  const ofClaim = (st, j) => {
    const c = claimOn(st, j.farm);
    return !!c && c.by === j.claim.by && c.since === j.claim.since;
  };
  const workClaim = (st, j) => {
    if (ofClaim(st, j)) CL.renewClaim(st, j.farm.house, PAWN(j.claim.by));
  };
  const restored = (st, j) => {
    if (ofClaim(st, j)) moveIn(st, j.farm);
  };
  // Once a day, after sim/claims' lapseClaims: a claim on a farm unworked for CLAIMS.years has lapsed; the farm is claimable again.
  function lapsedFarmClaims(st, dropped) {
    for (const [tile, c] of dropped) {
      if (c.why !== 'farm') continue;
      const f = st.farmsteads.find((x) => x.house === tile && claimOn(st, x)?.by === c.by.id);
      if (f)
        emit(st, 'rightLost', {
          type: 'pawn',
          id: c.by.id,
          tile,
          text: `The claim on ${f.name} has lapsed: nobody mended it for ${CLAIMS.years} years.`,
          at: { kind: 'claimEnded', ...atFarm(f) },
        }); // its plan is dropped and the lapse told (sim/plans)
    }
  }
  // ---- moving in (the roof mended): a new household, as a new plot's (Kim, 1 Nov) ----
  const Stores = VB['sim/stores'];
  const rationsOf = (st, ids) =>
    ids.reduce((s, id) => s + (st.pawns[id].age >= 14 ? st.ECON.ration.adult : st.ECON.ration.child), 0);
  // The claimants' grain: their stakes, made up to seed for the farm's fields and CLAIMS.farmFood days of their food from their old households'
  // grain above the seed and food (the holder's buffer) of those who stay, as far as it goes. {n, grain (by crop, VB-347)}.
  function provisions(st, f, members) {
    const grain = {};
    const need = Math.ceil(CLAIMS.farmFood * rationsOf(st, members)) + f.fields.length * CROPS.barley.seed;
    let have = members.reduce((s, id) => s + (st.pawns[id].stake || 0), 0);
    for (const h of new Set(members.map((id) => st.pawns[id].household))) {
      if (have >= need) break;
      const hh = st.households[h],
        stay = hh.members.filter((m) => !members.includes(m));
      const keep = reserved(st, hh, 'grain') + st.pawns[hh.holder].buffer * rationsOf(st, stay);
      const give = Math.min(need - have, Math.max(0, Math.floor(Stores.grainOf(hh) - keep)));
      if (give > 0) {
        Stores.take(st, hh, 'grain', give, 'provisions', grain);
        have += give;
      }
    }
    for (const id of members) Stores.take(st, st.pawns[id], 'grain', st.pawns[id].stake || 0, 'provisions', grain);
    return { n: have, grain };
  }
  // The claimant, their spouse and their minor children living with either move in: a new household holds the farm, its house, fields and
  // meadows, with the grain of `provisions`, the firewood and two days of cooked food of a founders household. The claim on the house and the
  // old family's birthright are spent.
  function moveIn(st, f) {
    if (!valid(st, f)) {
      ended(st, f);
      return;
    }
    const c = claimOn(st, f),
      holder = st.pawns[c.by],
      sp = spouseOf(st, holder.id),
      v = st.villages[f.village];
    const members = [holder.id];
    if (sp !== null && st.pawns[sp].alive) members.push(sp);
    const from = new Set(members.map((id) => st.pawns[id].household));
    for (const id of [...members])
      for (const c of childrenOf(st, id)) {
        const q = st.pawns[c];
        if (q.alive && q.age < 18 && from.has(q.household) && !members.includes(c) && !isHolder(st, c)) members.push(c);
      }
    const years = Math.round((st.t - f.emptySince) / YEAR),
      { n, grain } = provisions(st, f, members);
    issue(st, {
      actor: holder.id,
      verb: 'foundHousehold',
      target: f.id,
      args: { members, grain },
      source: 'restoration',
    });
    const hh = st.households[f.household];
    Stores.put(st, hh, 'meals', 2 * dailyNeed(st, hh), 'provisions');
    emit(st, 'stepDone', { type: 'pawn', id: holder.id, plan: c.plan }); // mended: the plan is finished (sim/plans)
    f.condition = 1;
    f.condAt = st.t;
    f.emptySince = null;
    CL.clearClaims(st, f.house);
    st.demand = st.demand.filter((id) => !members.includes(id));
    personEvent(st, holder.id, 'moved', `Moved into ${f.name}, mended after ${years} years empty`, false); // recorded below
    log(
      st,
      `${fullName(holder)} moves into ${f.name} in ${v.name}, empty for ${years} years, with ${Math.round(n)} rations of grain.`,
      {
        kind: 'moved',
        pawn: holder.id,
        ...atHousehold(st, hh),
      },
    );
  }
  return {
    claimOn,
    birthright,
    birthrightOn,
    restoreHours,
    claimable,
    startClaim,
    claimOf,
    claimants,
    claimFarms,
    claimableFarm,
    claimJobs,
    claimPrio,
    workClaim,
    restored,
    lapsedFarmClaims,
    moveIn,
    barred,
  };
})();
