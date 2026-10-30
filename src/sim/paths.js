// @sys sim/paths: worn paths: each crossing of a tile counts, the count halves each game year, and its stage (trodden, path, lane) shows
VB['sim/paths'] = (() => {
  const { PATHS } = VB['sim/rules'];
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
  // Tiles per stage, [none worn, trodden, path, lane], over land that can wear.
  function stageCounts(w) {
    const n = [0, 0, 0, 0];
    for (let i = 0; i < w.N; i++) if (!w.water[i] && !w.dev[i]) n[w.worn[i]]++;
    return n;
  }
  return { stageOf, initWear, tread, fadeWear, stageCounts };
})();
