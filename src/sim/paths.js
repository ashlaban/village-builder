// @sys sim/paths: worn paths: each crossing of a tile counts, the count halves each game year, and its stage (trodden, path, lane) shows
VB['sim/paths'] = (() => {
  const { PATHS, SEASON_DAYS } = VB['sim/rules'];
  const { findRoute } = VB['sim/routes'];
  // The stage of a count n on a tile now at stage s: up to stage k once n reaches PATHS.at[k], down only below PATHS.keep of it,
  // so a count that hovers about a threshold does not flicker between stages.
  function stageOf(n, s) {
    let k = s;
    while (k < 3 && n >= PATHS.at[k + 1]) k++;
    while (k > 0 && n < PATHS.at[k] * PATHS.keep) k--;
    return k;
  }
  // Fresh wear for a world; the settlement generator calls it.
  function initWear(w) {
    // @state w.wear: Float32Array per tile; crossings by walking pawns, fading by half each game year (sim/paths)
    // @state w.worn: Uint8Array per tile; stage of the wear: 0 none, 1 trodden ground, 2 path, 3 lane; set once a game day
    w.wear = new Float32Array(w.N); w.worn = new Uint8Array(w.N);
  }
  // A walking pawn enters tile i. Houses, fields and the green wear no path; water is not walked.
  function tread(w, i) { if (i >= 0 && !w.dev[i] && !w.water[i]) w.wear[i] += 1; }
  // Once a game day: every count fades; a count under half a crossing is gone, and so is the wear of a tile built on since (a field
  // broken on a path). A tile that changes stage joins st.pathDirty; onStage(tile), if given, hears of each change.
  function fadeWear(st, onStage) {
    const w = st.w, { wear, worn } = w, f = 0.5 ** (1 / PATHS.halfLifeDays);
    for (let i = 0; i < w.N; i++) {
      if (wear[i] === 0) continue;
      const n = w.dev[i] ? 0 : wear[i] * f;
      wear[i] = n < 0.5 ? 0 : n;
      const s = stageOf(wear[i], worn[i]);
      if (s === worn[i]) continue;
      worn[i] = s; st.pathDirty.add(i);
      if (onStage) onStage(i);
    }
  }
  // Wears in the paths of newly generated villages (VB-114): season by season for `years`, each farm's daily trips (PATHS.trips) go by
  // the cheapest route over the wear so far, there and back, adding their crossings; between seasons the wear fades as in play and the
  // stages are set again, so routes merge onto the paths as they form.
  function wearIn(w, villages, farmsteads, years) {
    const T = PATHS.trips, f = 0.5 ** (1 / PATHS.halfLifeDays), fD = f ** SEASON_DAYS, gain = (f * (1 - fD)) / (1 - f), touched = new Set();
    for (let season = 0; season < years * 4; season++) {
      const per = new Map(), add = (t, n) => { if (!w.dev[t] && !w.water[t]) per.set(t, (per.get(t) || 0) + n); };
      for (const fm of farmsteads) {
        const v = villages[fm.village], trips = fm.fields.map((fd) => [fd.tile, T.field]);
        if (v.well) trips.push([v.center, T.water + T.stroll]);
        if (fm.woodlot >= 0) trips.push([fm.woodlot, T.wood]);
        for (const [to, n] of trips) {
          const p = to >= 0 && to !== fm.house ? findRoute(w, fm.house, to) : null;
          if (!p) continue;
          for (let k = 1; k < p.length - 1; k++) add(p[k], 2 * n);
          add(to, n);
        }
      }
      for (const t of per.keys()) touched.add(t);
      for (const t of touched) {
        w.wear[t] = w.wear[t] * fD + (per.get(t) || 0) * gain;
        w.worn[t] = stageOf(w.wear[t], w.worn[t]);
      }
    }
  }
  // Tiles per stage, [none worn, trodden, path, lane], over land that can wear.
  function stageCounts(w) {
    const n = [0, 0, 0, 0];
    for (let i = 0; i < w.N; i++) if (!w.water[i] && !w.dev[i]) n[w.worn[i]]++;
    return n;
  }
  return { stageOf, initWear, tread, fadeWear, wearIn, stageCounts };
})();
