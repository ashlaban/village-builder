// The gatherings of a run (VB-294), for tools/sim.js --report gathering: after each year, the gatherings settled at that autumn's meetings,
// their hosts and villages, how many villages named each host in their choice, and the villages with none; then the summary over the run:
// gatherings standing a year, how often a village's host changed from the year before, and the share of villages with no gathering.
// Reads the choice (village.gathering) only.
module.exports = (VB, st) => {
  const Gt = VB['sim/gathering'], rows = [];
  let changed = 0, kept = 0;
  const last = new Map();
  return {
    // after the year y has run
    year(y) {
      const named = new Map();
      for (const v of st.villages) for (const h of (v.gathering && v.gathering.prefs) || []) named.set(h, (named.get(h) || 0) + 1);
      const gs = Gt.gatherings(st), none = st.villages.filter((v) => !v.gathering || v.gathering.host === null).map((v) => v.id);
      for (const v of st.villages) {
        const g = v.gathering, h = g ? g.host : null;
        if (last.has(v.id) && h !== null && last.get(v.id) !== null) { if (last.get(v.id) === h) kept++; else changed++; }
        last.set(v.id, h);
      }
      rows.push({ year: y, villages: st.villages.length, offered: st.villages.filter((v) => v.gathering && v.gathering.hosting).length,
        gatherings: gs.map((g) => ({ host: g.host, name: st.villages[g.host].name, villages: g.villages, named: named.get(g.host) || 0 })),
        none, named: Object.fromEntries([...named].sort((a, b) => a[0] - b[0])) });
    },
    result() {
      const n = rows.length, villageYears = rows.reduce((s, r) => s + r.villages, 0), noneYears = rows.reduce((s, r) => s + r.none.length, 0);
      return {
        years: rows.map((r) => ({ year: r.year, villages: r.villages, offered: r.offered,
          gatherings: r.gatherings.map((g) => `${g.host} ${g.name} [${g.villages.join(',')}] named by ${g.named}`).join('; ') || '-',
          none: r.none.join(',') || '-', namedEachGreen: Object.entries(r.named).map(([h, k]) => `${h}:${k}`).join(' ') })),
        summary: { years: n, gatheringsAYear: n ? +(rows.reduce((s, r) => s + r.gatherings.length, 0) / n).toFixed(2) : 0,
          hostChanges: changed, hostKept: kept, hostChangeShare: changed + kept ? +(changed / (changed + kept)).toFixed(3) : 0,
          noneShare: villageYears ? +(noneYears / villageYears).toFixed(3) : 0 },
      };
    },
  };
};
