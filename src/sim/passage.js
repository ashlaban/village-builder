// @sys sim/passage: passage on foot (VB-816): a field in crop, and a meadow in grass where the custom says so, closed to routes through it
// ===== Passage on foot (design.md, Built ways, passage and upkeep: Passage on foot, Decided 3 Nov; target-v2 4.2) =====
// Read where a tile lies, not by who walks, so that one ground serves every walker (sim/walking tileCost): a field from its sowing to its
// reaping is crossed by nobody, its holder included, but along a path or a lane worn over it; a route may start or end on it, as at a house.
// The farm's yard is its house tile, closed already (a farmstead is one place). The custom `passage` of the village whose land it is says
// whether a meadow in grass (from spring's first day to its mowing) may be crossed: `free`, the start of every culture, or only along its
// ways (`ways`). A field or meadow whose closing would leave a house, a field or the green with no way to the others stays open (the test
// VB-402 uses for a house that would close a way, sim/hex cutsOff), and is marked so.
VB['sim/passage'] = (() => {
  const { cutsOff } = VB['sim/hex'];
  const { cutTests } = VB['sim/walking'];
  const { costChanged } = VB['sim/routes'];
  const { inForce } = VB['sim/customs'];
  // @tunable PASSAGE: hayLost, the hay a crossing of a meadow in grass tramples (in units of hay): 0 until measured, so no household loses
  // hay to walkers yet and nothing leans a village to `ways` but the customs' drift and the meeting (VB-816's notes say what would)
  const PASSAGE = { hayLost: 0 };
  // The stages of a field in crop: from its sowing to its reaping (in stooks it is reaped, and open).
  const STANDING = new Set(['sown', 'growing', 'ripe']);
  // @state w.shut: Uint8Array per tile, made at the first day's sweep: 0 open; 1 a field in crop or a meadow in grass under `ways`, closed
  //   to routes through it (sim/walking tileCost), but along a path or a lane; 2 standing, but kept open, since closing it would cut a
  //   house, a field or the green off. Written only here, once a day (passageDay), and saved with the world.
  const shutOf = (st) => st.w.shut || (st.w.shut = new Uint8Array(st.w.N));
  // Whether a meadow of village v is closed in its grass today: the custom is `ways`, and it is not winter (a meadow never mown opens
  // with the snow).
  const meadowsShut = (st, v, c) => c.season !== 3 && inForce(st, 'passage', v) === 'ways';
  // Tile t should stand closed (want) or open: a change of state is a change of cost (sim/routes costChanged). A tile that comes to stand
  // is closed unless its closing cuts something off (then 2, open, until it no longer stands).
  function mark(st, s, t, want, tests) {
    const cur = s[t];
    if (!want) {
      if (!cur) return;
      st.w.shut[t] = 0;
      if (cur === 1) costChanged(st, t);
      return;
    }
    if (cur) return;
    if (cutsOff(st.w, t, tests.shut, tests.end)) st.w.shut[t] = 2;
    else {
      st.w.shut[t] = 1;
      costChanged(st, t);
    }
  }
  // Once a day, before the route cache is refreshed (sim/clock): each field and meadow of a farm, and each common field of a village,
  // marked by how it stands. On the year's first day, any tile still marked that no field or meadow holds now (a field given up, a farm's
  // land gone back) is opened.
  function passageDay(st, c) {
    const s = shutOf(st),
      tests = cutTests(st.w);
    let n = 0;
    for (const f of st.farmsteads) {
      for (const fd of f.fields) mark(st, s, fd.tile, STANDING.has(fd.stage), tests);
      const ways = f.household !== null && f.meadows.length && meadowsShut(st, f.village, c);
      for (const m of f.meadows) mark(st, s, m.tile, !!ways && m.stage === 'grass', tests);
      n += f.fields.length + f.meadows.length;
    }
    for (const v of st.villages)
      if (v.commonFields) {
        for (const fd of v.commonFields) mark(st, s, fd.tile, STANDING.has(fd.stage), tests);
        n += v.commonFields.length;
      }
    VB.count.passageRead += n;
    if (c.season === 0 && c.sday === 0) orphans(st, s);
  }
  function orphans(st, s) {
    const held = new Set();
    for (const f of st.farmsteads) {
      for (const fd of f.fields) held.add(fd.tile);
      for (const m of f.meadows) held.add(m.tile);
    }
    for (const v of st.villages) if (v.commonFields) for (const fd of v.commonFields) held.add(fd.tile);
    for (let t = 0; t < s.length; t++)
      if (s[t] && !held.has(t)) {
        if (s[t] === 1) costChanged(st, t);
        st.w.shut[t] = 0;
      }
  }
  // The count of tiles standing but kept open by the cut-off test, and of those closed (for the reports).
  function counts(w) {
    let closed = 0,
      kept = 0;
    if (w.shut)
      for (let t = 0; t < w.N; t++) {
        if (w.shut[t] === 1) closed++;
        else if (w.shut[t] === 2) kept++;
      }
    return { closed, kept };
  }
  return { PASSAGE, STANDING, passageDay, counts };
})();
