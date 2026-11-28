// @sys sim/grazing [material]: herding and grazing pressure (VB-136): the pasture, the herder, the way out to the outland (VB-446), the pressure and the milk
//   (VB-709)
VB['sim/grazing'] = (() => {
  const { DAY, YEAR, SEASON_DAYS, HERD, CLAIMS, stalled, cal } = VB['sim/rules'];
  const { bfs, hexSteps } = VB['sim/hex'];
  const { walkable } = VB['sim/walking'];
  const { route } = VB['sim/routes'];
  const { claimsOn } = VB['sim/claims'];
  // docs/review-animals.md, G6: a herd adds pressure only on the tile it grazes with its herder, and the pressure halves each year, as worn
  // paths do; forest spread reads it (VB-091; GRAZE in sim/spread). A herd's herder and the day it was last taken out are the herd's
  // (st.herds[], sim/herds), written here.
  // ---- the pressure ----
  // @state w.graze: Float32Array per tile; grazing pressure (1 a cow-hour on the pasture, HERD.herding) against the year's scale: the
  //   pressure now is w.graze[i] / 2 ** ((t - y) / YEAR), y the start of the game year, so it halves each game year in closed form with no
  //   pass over the tiles (Rules for cost, 3); written against the scale, and put back on the new year's scale (halved) once a year, at the
  //   year's first step (halveGraze). Written here only.
  const yearScale = (st) => 2 ** ((st.t - YEAR * Math.floor(st.t / YEAR)) / YEAR);
  const grazeOf = (st, i) => st.w.graze[i] / yearScale(st);
  // n units of pressure on the tile, and HERD.herding.nb of them on each neighbour.
  function graze(st, tile, n) {
    const w = st.w,
      g = w.graze,
      k = n * yearScale(st),
      side = k * HERD.herding.nb;
    g[tile] += k;
    for (let d = 0; d < 6; d++) {
      const j = w.nb[tile * 6 + d];
      if (j >= 0) g[j] += side;
    }
  }
  // At midnight (sim/clock, CALENDAR): every herd is back by its farm for the night (one whose herder went elsewhere than home).
  function herdsBack(st) {
    for (const id of st.liveHouseholds) for (const hid of st.households[id].herds) st.herds[hid].herder = null;
  }
  // At the year's first step (sim/clock, CALENDAR): the pressure is put on the new year's scale.
  function halveGraze(st) {
    const g = st.w.graze;
    for (let i = 0; i < g.length; i++) if (g[i] !== 0) g[i] *= 0.5;
  }
  // ---- the herds and their pasture ----
  // The household's grazing animals: [head of cattle, sheep].
  function heads(st, hh) {
    let cattle = 0,
      sheep = 0;
    for (const id of hh.herds) {
      const hd = st.herds[id];
      if (hd.head) cattle += hd.head.length;
      else sheep += hd.ewes + hd.rams + hd.lambs;
    }
    return [cattle, sheep];
  }
  // The pressure an hour of the household's herds on a pasture: 1 a head of cattle, HERD.herding.sheep a sheep.
  const herdLoad = (st, hh) => {
    const [cattle, sheep] = heads(st, hh);
    return cattle + sheep * HERD.herding.sheep;
  };
  // A tile the household's herds may graze: open land or wood (by its grass), not a field, a house, a green or a meadow but the farm's own
  // mown and carried (its aftermath), not another household's. `greens`: the villages' centres, when the caller has them.
  function grazable(st, hh, t, greens = null) {
    const w = st.w,
      f = st.farmsteads[hh.farmstead];
    if (!HERD.herding.grass[w.biome[t]] || w.water[t] || w.river[t] || (st.owner[t] > 0 && st.owner[t] !== hh.id + 1))
      return false;
    if (greens ? greens.has(t) : st.villages.some((v) => v.center === t)) return false;
    return !st.used.has(t) || f.meadows.some((m) => m.tile === t && m.stage === 'aftermath');
  }
  // ---- the herds' way to the outland (VB-446; design.md, Worn paths, last paragraph: the cattle lanes, fägator, that led the herds through
  // the infield to the outland pastures; Infield, outland and wilderness: the outland is the village's common pasture) ----
  // A tile of village v's outland: its own land (its green, farms and plots are turned away by `open`, none grazable), or free land it
  // claims as outland.
  function ofOutland(st, v, t) {
    const n = st.owner[t];
    if (n === -v.id - 1) return true;
    return n === 0 && claimsOn(st, t).some((c) => c.by.type === 'village' && c.by.id === v.id && c.why === 'outland');
  }
  // Open pasture for any herd: grass, no water, not in use, not a green.
  const open = (st, t, greens) =>
    !!HERD.herding.grass[st.w.biome[t]] && !st.w.water[t] && !st.w.river[t] && !st.used.has(t) && !greens.has(t);
  VB.counter(
    'pastureTiles',
    "Tiles within reach of a house searched for its herds' pasture, once a grazing day a household (sim/herds; VB-136), and of a " +
      "green for its herds' way out, once a season a village (sim/grazing wayOf; VB-446)",
  );
  VB.counter(
    'droveWays',
    'Ways out to the outland chosen, a route search each, once a season a village with herds (sim/grazing wayOf; VB-446)',
  );
  // @state village.droveway: absent until its herds first go out, then {season (the game season it was chosen in, day / SEASON_DAYS), to
  //   (the tile of its outland pasture the way leads to, -1 for none), tiles (the route from the green to `to`, the green first; [] for
  //   none)}: the one way all its herds are driven out by that season, so that their crossings fall on the same tiles and wear a cattle lane
  //   (VB-446). Chosen at the first herding of a season, by one search over the outland and one route search, and kept for the season
  //   (Rules for cost: one search a village a season). Plain data; written here only.
  // @notstock village.droveway: land, buildings and their records (fields, meadows, a site's timber)
  function wayOf(st, v, c) {
    const season = Math.floor(c.day / SEASON_DAYS);
    if (v.droveway && v.droveway.season === season) return v.droveway;
    const w = st.w,
      H = HERD.herding,
      greens = new Set(st.villages.map((u) => u.center));
    let to = -1,
      bs = -Infinity;
    // the outland pasture's tile of the best grass, least grazed and nearest the green, as a household's pasture is chosen, out of the
    // village: farther from the green than its farthest house
    const dist = bfs(w, v.center, CLAIMS.outReach, walkable(w)).dist;
    let yards = 0;
    for (const fid of v.farmsteads) yards = Math.max(yards, dist.get(st.farmsteads[fid].house) ?? CLAIMS.outReach);
    for (const [t, d] of dist) {
      VB.count.pastureTiles++;
      if (d <= yards || !open(st, t, greens) || !ofOutland(st, v, t)) continue;
      const s = H.grass[w.biome[t]] - grazeOf(st, t) / H.full - H.perStep * d;
      if (s > bs) {
        bs = s;
        to = t;
      }
    }
    let tiles = [];
    if (to >= 0) {
      VB.count.droveWays++;
      const p = route(st, v.center, to);
      if (p[0] === v.center && p.length > 1) tiles = p.slice();
      else to = -1; // no way by land: a fallback's straight line is never walked
    }
    v.droveway = { season, to, tiles };
    return v.droveway;
  }
  // The household's way out this season, or null: its village's, while it leads anywhere.
  function wayFor(st, hh, c) {
    const v = st.villages[st.farmsteads[hh.farmstead].village];
    if (!v || !(v.center >= 0)) return null;
    const way = wayOf(st, v, c);
    return way.to >= 0 ? way : null;
  }
  // The few steps from the way's end to a pasture by it, each to the walkable neighbour nearest the pasture, with no search; null where
  // that is blocked (water between), for the cheapest route instead.
  function straight(w, from, to) {
    const p = [from],
      pass = walkable(w);
    for (let i = from, n = 0; i !== to; n++) {
      if (n > HERD.herding.around) return null;
      let next = -1,
        nd = hexSteps(w, i, to);
      for (let k = 0; k < 6; k++) {
        const j = w.nb[i * 6 + k];
        if (j < 0 || !pass(j)) continue;
        const d = hexSteps(w, j, to);
        if (d < nd) {
          nd = d;
          next = j;
        }
      }
      if (next < 0) return null;
      p.push((i = next));
    }
    return p;
  }
  // The route a herder walks with its herds between its household's pasture at the end of the way out and anywhere farther (sim/legs
  // setOut), or null for the cheapest route: from `from` to the way's tile nearest it, along the way, and from the way's end to the
  // pasture; the reverse coming home. Two routes from the cache and the way's tiles: no search of its own (VB-446).
  function droveRoute(st, a, from, to, cls) {
    const pw = st.pawns[a.id],
      hh = pw && pw.household !== null ? st.households[pw.household] : null,
      pa = hh && hh.pasture;
    if (!pa || pa.to === undefined || from < 0 || to < 0) return null;
    const herding = !!a.mind && a.mind.some((c) => c.kind === 'herd');
    if (!herding && !driven(st, a.id)) return null;
    const v = st.villages[st.farmsteads[hh.farmstead].village],
      way = v && v.droveway,
      w = st.w;
    if (!way || way.to !== pa.to || way.tiles.length < 2) return null;
    const near = (t) => hexSteps(w, way.to, t) <= HERD.herding.around,
      out = near(to) && !near(from);
    if (!out && !(near(from) && !near(to))) return null;
    const far = out ? from : to,
      end = out ? to : from,
      T = way.tiles;
    let k = 0;
    for (let i = 1, kd = hexSteps(w, far, T[0]); i < T.length; i++) {
      const d = hexSteps(w, far, T[i]);
      if (d < kd) {
        kd = d;
        k = i;
      }
    }
    const a1 = far === T[k] ? [far] : route(st, far, T[k], cls),
      a2 = straight(w, way.to, end) || route(st, way.to, end, cls);
    if (a1[0] !== far || a2[0] !== way.to) return null;
    const whole = a1.concat(T.slice(k + 1), a2.slice(1));
    return out ? whole : whole.reverse();
  }
  // A new pasture: a grazable tile within HERD.herding.steps steps of the house, or, given the village's way out this season, within
  // HERD.herding.around steps of the way's end; best grass, least grazed, nearest. -1 when there is none.
  function pasture(st, hh, way = null) {
    const w = st.w,
      H = HERD.herding,
      f = st.farmsteads[hh.farmstead],
      greens = new Set(st.villages.map((v) => v.center));
    let best = -1,
      bs = -Infinity;
    for (const [t, d] of bfs(w, way ? way.to : f.house, way ? H.around : H.steps, walkable(w)).dist) {
      VB.count.pastureTiles++;
      if ((!way && d < 1) || !grazable(st, hh, t, greens)) continue;
      const s = H.grass[w.biome[t]] - grazeOf(st, t) / H.full - H.perStep * d;
      if (s > bs) {
        bs = s;
        best = t;
      }
    }
    return best;
  }
  // @state household.pasture: absent until the household's herds first go out, then {tile, since (the game day it was chosen)}, and `to`
  //   (VB-446) when it was chosen at the end of its village's way out (village.droveway.to): the pasture its herder takes them to each
  //   grazing day (sim/grazing; VB-136). A herd keeps its pasture, as herds were kept on one ground for days or weeks and moved on when it
  //   was eaten down: a new one is chosen only when it may no longer be grazed (a field, a meadow to be mown, another's, out of reach of the
  //   house, or not at the end of this season's way), or when it is grazed down (HERD.herding.downAt) and HERD.herding.keepDays have passed
  //   since it was chosen. So its routes are walked again and stay in the cache, and the search runs once in days (Rules for cost).
  //   A village with a way out sends its herds by it, its outland being its common pasture (design.md, Infield, outland and wilderness);
  //   one with none, or a herd with no grazable tile at its end, grazes by the house as before.
  // @notstock household.pasture: land, buildings and their records (fields, meadows, a site's timber)
  function todaysPasture(st, hh, c) {
    const p = hh.pasture,
      H = HERD.herding,
      f = st.farmsteads[hh.farmstead],
      way = wayFor(st, hh, c);
    if (
      p &&
      (way && p.to === way.to ? true : p.to === undefined && hexSteps(st.w, f.house, p.tile) <= H.steps) &&
      grazable(st, hh, p.tile) &&
      (c.day - p.since < H.keepDays || grazeOf(st, p.tile) < H.downAt)
    )
      return p.tile;
    let t = way ? pasture(st, hh, way) : -1;
    if (t >= 0) hh.pasture = { tile: t, since: c.day, to: way.to };
    else if ((t = pasture(st, hh)) >= 0) hh.pasture = { tile: t, since: c.day };
    return t;
  }
  // The fleeces herd hd has still to give at the fold on day c (VB-679): those grown by the shearing day and not yet shorn, until the end of
  // summer, when an unshorn fleece is shed on the pasture (0 after it, though the field stays until the next shearing day). Allocates nothing.
  const unshorn = (hd, c) => (hd.fleece > 0 && c.doy >= HERD.shear && c.doy < HERD.eweEnd ? hd.fleece : 0);
  // The herds are out with the herder: taken to pasture by pawn `id` today; a flock waiting at the fold to be shorn stays in (VB-679).
  function driveOut(st, hh, id, c) {
    for (const hid of hh.herds) {
      const hd = st.herds[hid];
      if (unshorn(hd, c) > 0) continue;
      hd.herder = id;
      hd.herded = c.day;
    }
  }
  // The herder is home: its household's herds with it are back by the farm.
  function driveHome(st, hh, id) {
    for (const hid of hh.herds) if (st.herds[hid].herder === id) st.herds[hid].herder = null;
  }
  // Head the pawn drives (its household's herds out with it), 0 for none: on the move they wear the tiles it crosses (sim/agents).
  function driven(st, id) {
    const p = st.pawns[id],
      hh = p.household === null ? null : st.households[p.household];
    if (!hh || !hh.herds.length) return 0;
    let n = 0;
    for (const hid of hh.herds) {
      const hd = st.herds[hid];
      if (hd.herder === id) n += hd.head ? hd.head.length : hd.ewes + hd.rams + hd.lambs;
    }
    return n;
  }
  // The day before c's was a grazing day on which the herd stayed by the farm (no herder took it out by HERD.herding.by): its cows give
  // half their milk, and its cattle may stray into a crop (sim/byre).
  const unherded = (st, herd, c) =>
    !stalled(cal((c.day - 1) * DAY)) && herd.herded !== c.day && herd.herded !== c.day - 1;
  // A crowded pasture lowers the milk (VB-709): the factor on a household's herds' milk of the day, 1 - bite * (pressure - downAt) / downAt
  // of the pressure of the tile they grazed lately (hh.pasture), between `floor` and 1; derived each day, no state. 1 with no pasture.
  const milkFactor = (st, hh) => {
    const H = HERD.herding;
    if (!hh.pasture) return 1;
    return Math.max(H.floor, Math.min(1, 1 - (H.bite * (grazeOf(st, hh.pasture.tile) - H.downAt)) / H.downAt));
  };
  // ---- the job kind (sim/kinds), the game's first background kind (VB-251): a herder takes the household's herds to the day's pasture
  // (drawn when the job is first posted) and minds them HERD.herding.hours at the side, within reach of it, adding their pressure each
  // step, then brings them home (sim/agents) ----
  const KIND = {
    verb: 'Herding the animals',
    go: 'Taking the animals to pasture',
    name: 'Herd the animals',
    at: ['pasture'],
    needs: ['cattle', 'sheep'],
    gives: [],
    label: 'Herding',
    anim: null,
    hours: HERD.herding.hours,
    hands: 1,
    type: 'herding',
    minAge: HERD.herding.minAge,
    reach: HERD.herding.reach,
    rate: HERD.herding.rate,
    window: { from: HERD.herding.from },
    spot: (st, a, j) => [st.w.hx[j.site] + a.ox * 0.5, st.w.hy[j.site] + a.oy * 0.4],
    urgency: (st, j, c, U) => U.herd,
    draw: (st, j) => todaysPasture(st, st.households[j.owner.id], cal(st.t)),
    held: (st, j, a, c) => driveOut(st, st.households[j.owner.id], a.id, c),
    // the pressure is added by whole hours on the pasture, as each is completed (a part hour left when the herder leaves is not counted);
    // reckoned with the hours since (sim/agents, VB-472), from the hours done before
    worked: (st, j, dt, a, from) => {
      for (let n = Math.floor(j.done + 1e-9) - Math.floor(from + 1e-9); n > 0; n--)
        graze(st, j.site, herdLoad(st, st.households[j.owner.id]));
    },
    // each grazing day, from HERD.herding.from until HERD.herding.by, for a household with animals whose herds are not out today already
    available: (st, hh, f, c, post) => {
      if (
        stalled(c) ||
        c.hour < HERD.herding.from ||
        c.hour >= HERD.herding.by ||
        !hh.herds.length ||
        !(herdLoad(st, hh) > 0)
      )
        return;
      const key = `herd:h${hh.id}:${c.day}`;
      if (!st.jobs.has(key) && hh.herds.some((id) => st.herds[id].herded === c.day)) return;
      post(key, f.house, { farm: f });
    },
  };
  VB['sim/methods'].mind(KIND); // the herd minded at the side, a charge held across other legs (VB-1750)
  return {
    yearScale,
    grazeOf,
    milkFactor,
    graze,
    herdsBack,
    halveGraze,
    heads,
    herdLoad,
    grazable,
    pasture,
    todaysPasture,
    droveRoute,
    driveOut,
    unshorn,
    driveHome,
    driven,
    unherded,
    KIND,
  };
})();
