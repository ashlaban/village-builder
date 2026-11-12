// @sys sim/grazing: herding and grazing pressure (VB-136): the day's pasture, the herder who takes the herds there and home, the pressure
VB['sim/grazing'] = (() => {
  const { DAY, YEAR, HERD, stalled, cal } = VB['sim/rules'];
  const { bfs } = VB['sim/hex'];
  const { walkable } = VB['sim/routes'];
  // docs/review-animals.md, G6: a herd adds pressure only on the tile it grazes with its herder, and the pressure halves each year, as worn
  // paths do; forest spread reads it (VB-091; GRAZE in sim/rules). A herd's herder and the day it was last taken out are the herd's
  // (st.herds[], sim/herds), written here.
  // ---- the pressure ----
  // @state w.graze: Float32Array per tile; grazing pressure (1 a cow-hour on the pasture, HERD.herding) against the year's scale: the
  //   pressure now is w.graze[i] / 2 ** ((t - y) / YEAR), y the start of the game year, so it halves each game year in closed form with no
  //   pass over the tiles (Rules for cost, 3); written against the scale, and put back on the new year's scale (halved) once a year, at the
  //   year's first step (grazingDay). Written here only.
  const yearScale = (st) => 2 ** ((st.t - YEAR * Math.floor(st.t / YEAR)) / YEAR);
  const grazeOf = (st, i) => st.w.graze[i] / yearScale(st);
  // n units of pressure on the tile, and HERD.herding.nb of them on each neighbour.
  function graze(st, tile, n) {
    const w = st.w, g = w.graze, k = n * yearScale(st), side = k * HERD.herding.nb;
    g[tile] += k;
    for (let d = 0; d < 6; d++) { const j = w.nb[tile * 6 + d]; if (j >= 0) g[j] += side; }
  }
  // Once a game day, at its start (sim/herds herdsDay): every herd is back by its farm for the night (one whose herder went elsewhere than
  // home), and at the year's first step the pressure is put on the new year's scale.
  function grazingDay(st, c) {
    for (const id of st.liveHouseholds) for (const hid of st.households[id].herds) st.herds[hid].herder = null;
    if (c.doy !== 0) return;
    const g = st.w.graze;
    for (let i = 0; i < g.length; i++) if (g[i] !== 0) g[i] *= 0.5;
  }
  // ---- the herds and their pasture ----
  // The household's grazing animals: [head of cattle, sheep].
  function heads(st, hh) {
    let cattle = 0, sheep = 0;
    for (const id of hh.herds) { const hd = st.herds[id]; if (hd.head) cattle += hd.head.length; else sheep += hd.ewes + hd.rams + hd.lambs; }
    return [cattle, sheep];
  }
  // The pressure an hour of the household's herds on a pasture: 1 a head of cattle, HERD.herding.sheep a sheep.
  const herdLoad = (st, hh) => { const [cattle, sheep] = heads(st, hh); return cattle + sheep * HERD.herding.sheep; };
  // Where the household's herds graze today: a tile within HERD.herding.steps steps of the house, open land or wood (by its grass), not a
  // field, a house, a green or a meadow but the farm's own mown and carried (its aftermath), not another household's; best grass, least
  // grazed, nearest. -1 when there is none.
  function pasture(st, hh) {
    const w = st.w, H = HERD.herding, f = st.farmsteads[hh.farmstead], mine = hh.id + 1, greens = new Set(st.villages.map((v) => v.center));
    const after = new Set(f.meadows.filter((m) => m.stage === 'aftermath').map((m) => m.tile));
    let best = -1, bs = -Infinity;
    for (const [t, d] of bfs(w, f.house, H.steps, walkable(w)).dist) {
      VB.count.pastureTiles++;
      const grass = H.grass[w.biome[t]];
      if (d < 1 || !grass || w.water[t] || w.river[t] || greens.has(t) || (st.used.has(t) && !after.has(t))) continue;
      if (st.owner[t] > 0 && st.owner[t] !== mine) continue;
      const s = grass - grazeOf(st, t) / H.full - H.perStep * d;
      if (s > bs) { bs = s; best = t; }
    }
    return best;
  }
  // The herds are out with the herder: taken to pasture by pawn `id` today.
  function driveOut(st, hh, id, c) { for (const hid of hh.herds) { const hd = st.herds[hid]; hd.herder = id; hd.herded = c.day; } }
  // The herder is home: its household's herds with it are back by the farm.
  function driveHome(st, hh, id) { for (const hid of hh.herds) if (st.herds[hid].herder === id) st.herds[hid].herder = null; }
  // Head the pawn drives (its household's herds out with it), 0 for none: on the move they wear the tiles it crosses (sim/agents).
  function driven(st, id) {
    const p = st.pawns[id], hh = p.household === null ? null : st.households[p.household];
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
  const unherded = (st, herd, c) => !stalled(cal((c.day - 1) * DAY)) && herd.herded !== c.day && herd.herded !== c.day - 1;
  // ---- the job kind (sim/kinds), the game's first background kind (VB-251): a herder takes the household's herds to the day's pasture
  // (drawn when the job is first posted) and minds them HERD.herding.hours at the side, within reach of it, adding their pressure each
  // step, then brings them home (sim/agents) ----
  const KIND = {
    verb: 'Herding the animals', go: 'Taking the animals to pasture', name: 'Herd the animals', label: 'Herding', anim: null,
    hours: HERD.herding.hours, hands: 1, type: 'herding', minAge: HERD.herding.minAge, attention: 'background', reach: HERD.herding.reach,
    rate: HERD.herding.rate, window: { from: HERD.herding.from },
    spot: (st, a, j) => [st.w.hx[j.site] + a.ox * 0.5, st.w.hy[j.site] + a.oy * 0.4], urgency: (st, j, c, U) => U.herd,
    draw: (st, j) => pasture(st, st.households[j.owner.id]),
    held: (st, j, a, c) => driveOut(st, st.households[j.owner.id], a.id, c),
    worked: (st, j, dt) => graze(st, j.site, dt * herdLoad(st, st.households[j.owner.id])),
    // each grazing day, from HERD.herding.from until HERD.herding.by, for a household with animals whose herds are not out today already
    available: (st, hh, f, c, post) => {
      if (stalled(c) || c.hour < HERD.herding.from || c.hour >= HERD.herding.by || !hh.herds.length || !(herdLoad(st, hh) > 0)) return;
      const key = `herd:h${hh.id}:${c.day}`;
      if (!st.jobs.has(key) && hh.herds.some((id) => st.herds[id].herded === c.day)) return;
      post(key, f.house, { farm: f });
    },
  };
  return { yearScale, grazeOf, graze, grazingDay, heads, herdLoad, pasture, driveOut, driveHome, driven, unherded, KIND };
})();
