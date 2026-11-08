// VB-224: a full heirRanking asks only the farms of its candidates' lines; it must rank exactly as it would given every live household's
// first direct heir (ownFirstOf(st)), under both answers to "an heir to their own parents' farm".
function compareRankings(VB, st) {
  const H = VB['sim/heirs'], { practice } = VB['sim/records'], all = H.ownFirstOf(st), bad = [];
  let checked = 0, claimed = 0;
  for (const id of st.liveHouseholds) {
    const hh = st.households[id], village = st.farmsteads[hh.farmstead].village;
    for (const ownHeir of ['behind', 'keeps']) {
      const cu = { ...practice(st, village), ownHeir }, now = H.heirRanking(st, hh, cu), full = H.heirRanking(st, hh, cu, false, all);
      checked++;
      if (JSON.stringify(now) !== JSON.stringify(full)) bad.push(`households[${id}] (${ownHeir}): ${now.join(',')} against ${full.join(',')}`);
      // A claim mattered when ignoring every other farm would have ranked differently.
      if (JSON.stringify(full) !== JSON.stringify(H.heirRanking(st, hh, cu, false, []))) claimed++;
    }
  }
  return { bad, checked, claimed };
}
module.exports = { compareRankings };
