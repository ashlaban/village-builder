// The followers of a run (VB-708), for tools/sim.js --report followers [--json]: at each decade's end (and the last year), each village's
// first, second and third pawn by followers (all who look to it, its household's members following their head among them), with the
// share of the village's live households those followers belong to and whether the first is the alderman; then over the run: ties begun,
// ties ended by why (failed: a lord refused his follower in need; faded: goodwill's half-life; met: the debt paid; serviceEnded, moved,
// died), their mean length in years, the lords who failed a follower, the deepest chain of lords and the ties across villages, the
// hungry household-days of follower households (a holder who looks to a lord) against the others, and which brakes acted.
require('./help.js')(__filename);
module.exports = (VB, st) => {
  const F = VB['sim/followers'], Customs = VB['sim/customs'], YEAR = VB['sim/rules'].YEAR;
  const decades = [], hungry = { followers: 0, others: 0, followerYears: 0, otherYears: 0 };
  let last = st.households.map((h) => h.hungryDays);
  const villageOf = (p) => (p.household === null ? null : st.farmsteads[st.households[p.household].farmstead].village);
  function snapshot(y) {
    const idx = F.index(st), rows = [];
    for (const v of st.villages) {
      const live = st.liveHouseholds.filter((h) => st.farmsteads[st.households[h].farmstead].village === v.id);
      if (!live.length) continue;
      const lords = [];
      for (const [lord, set] of idx) if (villageOf(st.pawns[lord]) === v.id) lords.push([lord, set]);
      lords.sort((a, b) => b[1].size - a[1].size || a[0] - b[0]);
      const top = lords.slice(0, 3).map(([lord, set]) => {
        const hh = new Set([...set].map((f) => st.pawns[f].household).filter((h) => h !== null));
        return `${lord}:${set.size}p/${hh.size}hh(${Math.round((100 * hh.size) / live.length)}%)`;
      });
      rows.push({ year: y, village: v.id, households: live.length, top: top.join(' ') || '-',
        firstIsAlderman: lords.length ? v.alderman === lords[0][0] : null });
    }
    return rows;
  }
  return {
    year(y) {
      for (const h of st.households) {
        if (h.dissolved) continue;
        const d = h.hungryDays - (last[h.id] || 0), f = h.holder !== null && st.pawns[h.holder].looksTo != null;
        if (f) { hungry.followers += d; hungry.followerYears++; } else { hungry.others += d; hungry.otherYears++; }
      }
      last = st.households.map((h) => h.hungryDays);
      if (y % 10 === 0) decades.push(...snapshot(y));
    },
    result(y) {
      if (!decades.length || decades[decades.length - 1].year !== y) decades.push(...snapshot(y));
      const ev = st.record.filter((e) => e.kind === 'follower'), open = new Map(), lengths = [], ended = {}, failers = new Set();
      let begun = 0;
      for (const e of ev) {
        if (e.reason === 'patron' || e.reason === 'service') { begun++; open.set(e.pawn, e.t); continue; }
        ended[e.reason] = (ended[e.reason] || 0) + 1;
        if (e.reason === 'failed') failers.add(e.other);
        if (open.has(e.pawn)) { lengths.push((e.t - open.get(e.pawn)) / YEAR); open.delete(e.pawn); }
      }
      let depth = 0, across = 0, ties = 0;
      for (const id of st.living) {
        const p = st.pawns[id];
        if (p.looksTo == null) continue;
        ties++;
        depth = Math.max(depth, F.depthOf(st, id));
        if (villageOf(p) !== villageOf(st.pawns[p.looksTo])) across++;
      }
      const byTurns = st.villages.filter((v) => { const s = st.cenv.settlements[v.id]; return s && Customs.practiceOf(st.cenv.cultures[s.culture], 'alderman') === 'byTurns'; }).length;
      return {
        decades,
        summary: { begun, ended, meanYears: lengths.length ? +(lengths.reduce((s, x) => s + x, 0) / lengths.length).toFixed(1) : null,
          stillOpen: open.size, lordsWhoFailed: failers.size, ties, deepest: depth, acrossVillages: across,
          hungryPerHouseholdYear: { followers: hungry.followerYears ? +(hungry.followers / hungry.followerYears).toFixed(2) : null,
            others: hungry.otherYears ? +(hungry.others / hungry.otherYears).toFixed(2) : null },
          brakes: { halfLife: ended.faded || 0, metOrRepaid: ended.met || 0, failed: ended.failed || 0, aldermanByTurnsVillages: byTurns,
            debtorsPolitics: 'not built (VB-320)', heirShare: 'acts through halfLife: a holder\'s balances halve at a handover' } },
      };
    },
  };
};
