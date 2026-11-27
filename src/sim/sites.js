// @sys sim/sites: a party's site of a new farm (VB-787; design.md, Moving to new land, Settling in steps): staked at the moving round, its
// house tile and first field cleared and its cottage built by the party's members from their old households, until the move founds the
// household (sim/settle's verb leave); the site's jobs, their ends, the leader's stake on its tiles, and the leader who follows a dead one
VB['sim/sites'] = (() => {
  const { emit, on } = VB['sim/events'];
  const { issue } = VB['sim/commands'];
  const { log, fullName } = VB['sim/records'];
  const { ECON, BUILD } = VB['sim/rules'];
  const CL = VB['sim/claims'];
  const { keptDone } = VB['sim/progress'];
  const { costChanged } = VB['sim/routes'];
  const { clearTile, fellAll } = VB['sim/forest'];
  const { clearScrub, tended } = VB['sim/spread'];
  const { woodTaken } = VB['sim/territory'];
  const { stepsFor, stepHours } = VB['sim/expansion'];
  const { COTTAGE, cottageSteps, waitsForTimber } = VB['sim/cottageplan'];
  const { fetchTimber } = VB['sim/building'];
  const { trailOf } = VB['sim/trails'];
  const { bfs } = VB['sim/hex'];
  const { walkable } = VB['sim/walking'];
  // @state st.sites[]: the sites under way, one a party, in the order staked (by id), each {id, leader (the pawn whose stake it is), party
  //   {all (the leader first), followers}, from (the village it was staked from), village (the small village it joins, or null: a new one),
  //   house, field (tiles), plot {places: [{tile, kind 'house' | 'field', steps (fell, grub, clear, break), i, fresh}], steps (the
  //   cottage's stages at the house, as a plot's: {kind, place, hours, done}, the walls also `wood`), open (the stage under way, 3 once the
  //   roof is on)}, booth (the tile beside the house where its workers lodge and raise their booth, or null), stage ('trail' while the
  //   leader's trail to it is blazed, 'building', 'roofed'), since (game hours), hours ({pawn: hours worked at it}), told (the season the
  //   log last said why the move waits, or absent), tried ({pawn: day it last set out to lodge there, or found it could not})};
  //   st.siteSeq, the next id. Written here (staked, worked, its leader followed, given up) and by sim/settle (staked by the verb
  //   stakeSite, ended by the move). The stake on its tiles is the leader's claim (sim/claims, holder {type: 'pawn'}), renewed by each step.
  // The live index, pawn id -> its site, of the parties' members: kept beside st.sites and made again when st.sites is another array (a
  // load, a new state). Not saved.
  const IX = new WeakMap();
  function index(st) {
    let x = IX.get(st);
    if (!x || x.of !== st.sites) {
      x = { of: st.sites, by: new Map() };
      for (const s of st.sites || []) for (const id of s.party.all) x.by.set(id, s);
      IX.set(st, x);
    }
    return x.by;
  }
  const siteOf = (st, id) => (st.sites && st.sites.length ? index(st).get(id) || null : null);
  const byId = (st, id) => (st.sites || []).find((s) => s.id === id) || null;
  const leaderClaim = (s) => ({ type: 'pawn', id: s.leader });
  const ownerOf = (st, s) => {
    const p = st.pawns[s.leader];
    return p.household === null ? null : { type: 'household', id: p.household };
  };
  // ---- staking ----
  // A site staked by the party's leader (sim/settle's verb stakeSite): its tiles marked used and staked by the leader, the house's ground
  // developed (routes go round it), its booth's tile beside the house, and the leader's trail from the home green (VB-447's verb blaze;
  // none where no wood lies between). The site.
  function stakeSite(st, a) {
    const w = st.w,
      leader = a.party.all[0],
      s = {
        id: st.siteSeq++,
        leader,
        party: { all: [...a.party.all], followers: [...(a.party.followers || [])] },
        from: a.from,
        village: a.village === undefined ? null : a.village,
        house: a.house,
        field: a.field,
        plot: {
          places: [
            { tile: a.house, kind: 'house' },
            { tile: a.field, kind: 'field' },
          ].map((tr) => ({ ...tr, steps: stepsFor(w, tr.tile, tr.kind), i: 0 })),
          steps: cottageSteps(a.house),
          open: 0,
        },
        booth: boothTile(st, a.house, a.field),
        stage: 'building',
        since: st.t,
        hours: {},
        tried: {},
      };
    for (const t of [s.house, s.field]) {
      st.used.add(t);
      woodTaken(st, t);
      CL.addClaim(st, t, leaderClaim(s), 'site');
    }
    w.dev[s.house] = 3;
    costChanged(st, s.house);
    st.sites.push(s);
    index(st).set(leader, s);
    for (const id of s.party.all) index(st).set(id, s);
    const home = st.villages[s.from].center;
    if (issue(st, { actor: leader, verb: 'blaze', args: { from: home, to: s.house }, source: 'pawn' }) === true)
      s.stage = 'trail';
    st.villageDirty.add(s.from);
    emit(st, 'siteStaked', s);
    return s;
  }
  // The booth's tile: the nearest open tile beside the house that is not the field, nobody's, unused. Null where there is none.
  function boothTile(st, house, field) {
    const w = st.w;
    for (let k = 0; k < 6; k++) {
      const t = w.nb[house * 6 + k];
      if (t < 0 || t === field || w.water[t] || st.used.has(t) || st.owner[t] !== 0 || st.claims.has(t)) continue;
      if (walkable(w)(t)) return t;
    }
    return null;
  }
  // ---- the work ----
  // The hours still to work at site s: its tiles' open steps and the cottage's stages.
  function hoursLeft(st, s) {
    let h = 0;
    for (const tr of s.plot.places) for (let i = tr.i; i < tr.steps.length; i++) h += stepHours(st, { ...tr, i });
    for (let i = s.plot.open; i < s.plot.steps.length; i++) h += s.plot.steps[i].hours - (s.plot.steps[i].done || 0);
    return h;
  }
  const houseCleared = (s) => s.plot.places[0].i >= s.plot.places[0].steps.length;
  const roofed = (s) => s.plot.open >= COTTAGE.length;
  const wallsOf = (s) => s.plot.steps[COTTAGE.indexOf('walls')];
  // The keys of site s's jobs, the ones a lodger there is away for (sim/away): its tiles' steps, the cottage's stage, the timber trips.
  const jobKeys = (s) => [
    `site:s${s.id}.${s.house}`,
    `site:s${s.id}.${s.field}`,
    `site:s${s.id}.cottage`,
    `timber:s${s.id}`,
    `timber:s${s.id}b`,
  ];
  // Whether member id of site s works there: of 14 and over, and not a mother who nurses (design.md, Settling in steps, 3).
  const worksAt = (st, s, id) => {
    const p = st.pawns[id];
    return p.alive && p.age >= 14 && !(p.nursingUntil > st.t);
  };
  // The nearest tile with trees within 4 steps of the house, for the walls' timber where the site's own felling gave too little.
  function woodFor(st, s) {
    for (const [t] of bfs(st.w, s.house, 4, walkable(st.w)).dist) if (st.w.trees[t] > 0 && !st.used.has(t)) return t;
    return null;
  }
  // The sites' work, asked once for the island (Rules for cost, 1: the live sites only, at most six jobs each): for each site past its
  // trail, the open step of each of its tiles (side by side), then, once the house tile is cleared, the cottage's open stage, its walls
  // waiting for their timber (felled on the site, else fetched from the nearest wood). Owned by the leader's household, whose members of the
  // party take them (j.party, sim/fit). A site whose leader is dead passes to the party's next adult, or is given up.
  function siteWork(st, holder, at, c, post) {
    if (!st.sites || !st.sites.length) return;
    for (const s of [...st.sites]) {
      if (!st.pawns[s.leader].alive && !follow(st, s)) continue;
      const owner = ownerOf(st, s);
      if (!owner || s.stage === 'roofed') continue;
      if (s.stage === 'trail') {
        if (trailOf(st, s.leader)) continue;
        s.stage = 'building';
        log(st, `${fullName(st.pawns[s.leader])}'s trail to the site of a new farm is blazed.`, {
          kind: 'siteTrail',
          pawn: s.leader,
          village: s.from,
        });
        emit(st, 'siteTrail', s);
      }
      const base = { siteId: s.id, party: s.party.all };
      for (const tr of s.plot.places)
        if (tr.i < tr.steps.length)
          post(`site:s${s.id}.${tr.tile}`, tr.tile, { ...base, tr, hours: stepHours(st, tr) }, tr.steps[tr.i], owner);
      if (!houseCleared(s)) continue;
      const k = s.plot.steps[s.plot.open],
        key = `site:s${s.id}.cottage`;
      if (waitsForTimber(wallsOf(s), s.plot.open)) {
        const fell = st.w.trees[s.house] > 0 ? s.house : woodFor(st, s);
        const n = { key: `timber:s${s.id}`, site: wallsOf(s), need: BUILD.timber, dest: s.house, owner };
        if (fell !== null) n.fell = fell;
        fetchTimber(st.villages[s.from], n, post);
        continue;
      }
      k.done = keptDone(st, key, k.hours, k.done);
      post(key, s.house, { ...base, cottage: true, done: k.done, hours: k.hours }, k.kind, owner);
    }
  }
  // A step of site j.siteId is done: a tile's (stumps after felling, the trees the walls' wood; grubbing turns the wood to meadow;
  // clearing takes the stones; breaking turns the soil), or the cottage's stage (the walls take their timber; after the roof the move is
  // tried, the leader's verb leave). Each renews the leader's stake.
  function finish(st, j) {
    const s = byId(st, j.siteId);
    if (!s) return;
    const w = st.w;
    if (j.cottage) {
      const k = s.plot.steps[s.plot.open];
      if (!k || k.kind !== j.kind) return;
      if (k.kind === 'walls') k.wood -= BUILD.timber;
      k.done = k.hours;
      s.plot.open++;
      CL.renewClaim(st, s.house, leaderClaim(s));
      st.biomeDirty.add(s.house);
      st.villageDirty.add(s.from);
      if (!roofed(s)) return;
      s.stage = 'roofed';
      log(st, `The cottage at the site of ${fullName(st.pawns[s.leader])}'s new farm has its roof.`, {
        kind: 'siteRoofed',
        pawn: s.leader,
        village: s.from,
      });
      emit(st, 'siteRoofed', s);
      tryMove(st, s);
      return;
    }
    const tr = j.tr;
    if (!tr || tr.i >= tr.steps.length || s.plot.places.indexOf(tr) < 0) return;
    const step = tr.steps[tr.i];
    const walls = wallsOf(s);
    if (step === 'fell')
      walls.wood += fellAll(st, tr.tile) * ECON.woodPerTrip; // the trees felled are the walls' (VB-328)
    else if (step === 'grub') clearTile(st, tr.tile);
    else if (step === 'clear') {
      w.stones[tr.tile] = 0;
      clearScrub(st, tr.tile);
    } else {
      tr.fresh = !w.dev[tr.tile];
      w.dev[tr.tile] = 1;
      if (tr.fresh) costChanged(st, tr.tile);
    }
    tended(st, tr.tile);
    tr.i++;
    CL.renewClaim(st, tr.tile, leaderClaim(s));
    st.biomeDirty.add(tr.tile);
    st.villageDirty.add(s.from);
  }
  // The move is tried (the verb leave, its check the provisions): when the roof's job ends, and on the leader's household's planning day.
  // Short of it, the log says why once a season.
  function tryMove(st, s) {
    if (!roofed(s) || !st.pawns[s.leader].alive) return;
    const r = issue(st, { actor: s.leader, verb: 'leave', target: s.id, source: 'pawn' });
    if (r === true || typeof r !== 'string') return;
    const season = Math.floor(st.t / (VB['sim/rules'].DAY * VB['sim/rules'].SEASON_DAYS));
    if (s.told === season) return;
    s.told = season;
    log(st, `${fullName(st.pawns[s.leader])}'s new cottage stands, but the move waits: ${r}.`, {
      kind: 'siteWaits',
      pawn: s.leader,
      village: s.from,
    });
  }
  on('planReviewed', (st, d) => {
    if (d.why !== 'day' || d.plan.holder.type !== 'household' || !st.sites || !st.sites.length) return;
    for (const s of st.sites)
      if (s.stage === 'roofed' && st.pawns[s.leader].household === d.plan.holder.id) {
        tryMove(st, s);
        return;
      }
  });
  // The leader of site s has died: the party's next adult living leads, the stake passing to it; with none, the site is given up.
  function follow(st, s) {
    s.party.all = s.party.all.filter((id) => st.pawns[id].alive);
    s.party.followers = s.party.followers.filter((id) => st.pawns[id].alive);
    const next = s.party.all.find((id) => st.pawns[id].age >= 18 && st.pawns[id].household !== null);
    const old = leaderClaim(s);
    if (next === undefined) {
      end(st, s, 'nobody of the party is left to lead it');
      return false;
    }
    s.leader = next;
    s.party.all = [next, ...s.party.all.filter((id) => id !== next)];
    s.party.followers = s.party.followers.filter((id) => id !== next);
    for (const t of [s.house, s.field]) {
      CL.dropClaim(st, t, old);
      CL.addClaim(st, t, leaderClaim(s), 'site');
    }
    IX.delete(st);
    log(st, `${fullName(st.pawns[next])} now leads the party building a new farm.`, {
      kind: 'siteLeader',
      pawn: next,
      village: s.from,
    });
    return true;
  }
  // Site s ends (moved into, or given up): out of st.sites and the index, the leader's stake dropped; given up (`why`), its tiles are left
  // as they stand, unused, for the next party that searches (the endings are VB-789's).
  function end(st, s, why = null) {
    for (const t of [s.house, s.field]) CL.dropClaim(st, t, leaderClaim(s));
    st.sites.splice(st.sites.indexOf(s), 1);
    IX.delete(st);
    if (why === null) return;
    for (const t of [s.house, s.field]) st.used.delete(t);
    log(st, `The site of a new farm from ${st.villages[s.from].name} is given up: ${why}.`, {
      kind: 'siteGivenUp',
      village: s.from,
    });
  }
  // A site's steps are kinds of their own (sim/expansion's fell, grub, clear and break, sim/building's cottage stages): a job of a site
  // (`j.siteId`) ends in finish, any other as its kind says. sim/kinds joins these, after sim/expansion's plotted.
  const SITE_KINDS = ['fell', 'grub', 'clear', 'break', ...COTTAGE];
  const sited = (KINDS) =>
    Object.fromEntries(
      SITE_KINDS.map((k) => {
        const own = KINDS[k].done;
        return [
          k,
          {
            ...KINDS[k],
            done: (st, j, hh, c, by) => (j.siteId !== undefined ? finish(st, j) : own && own(st, j, hh, c, by)),
          },
        ];
      }),
    );
  // Hours worked at site j.siteId by pawn id (sim/work), its record's.
  function worked(st, j, id, dt) {
    const s = byId(st, j.siteId);
    if (s) s.hours[id] = (s.hours[id] || 0) + dt;
  }
  // A save from before the sites (VB-787): none under way.
  function sitesLoaded(st) {
    st.sites ??= [];
    st.siteSeq ??= 0;
  }
  return {
    worked,
    sitesLoaded,
    siteOf,
    byId,
    stakeSite,
    siteWork,
    sited,
    hoursLeft,
    jobKeys,
    worksAt,
    roofed,
    end,
    tryMove,
    wallsOf,
  };
})();
