// The reach report (VB-286), for `node tools/sim.js --report reach [--json]`: the table of walking hours between villages' greens (st.villageHours).
// Prints the villages, the pairs, the pairs by land and within reach (ROUTE.reach, 67 hours), the hours' spread (least, quartiles, most), each
// village's nearest neighbour (its median and greatest) and the pairs within 12 hours. The pairs by land are found by a search without a
// bound, from each green (the table holds only those within reach). It reads the table as it stands and writes nothing.
// Used by tools/sim.js: `require('./reach.js')(st)` gives the report as an object.
require('./help.js')(__filename);
module.exports = (st) => {
  const { reachCosts } = require('../src/load.js')['sim/routes'];
  const T = st.villageHours, n = st.villages.length, all = [], near = [];
  const q = (a, p) => {
    const i = (a.length - 1) * p, lo = Math.floor(i); return a.length ? +(a[lo] + (a[Math.ceil(i)] - a[lo]) * (i - lo)).toFixed(2) : null; };
  for (let v = 0; v < n; v++) {
    let least = Infinity;
    for (let u = 0; u < n; u++) if (u !== v && T[v][u] !== null) { least = Math.min(least, T[v][u]); if (u > v) all.push(T[v][u]); }
    if (least < Infinity) near.push(least);
  }
  let byLand = 0;
  const centres = st.villages.map((v) => v.center);
  for (let v = 0; v < n; v++) byLand += reachCosts(st.w, centres[v], Infinity, centres).filter((c, u) => u > v && c !== null).length;
  all.sort((a, b) => a - b); near.sort((a, b) => a - b);
  return {
    villages: n, pairs: n * (n - 1) / 2, byLand, byLandWithinReach: all.length,
    hours: { least: q(all, 0), q1: q(all, 0.25), median: q(all, 0.5), q3: q(all, 0.75), most: q(all, 1) },
    nearestNeighbour: { median: q(near, 0.5), most: q(near, 1), villagesWithOne: near.length },
    within12: all.filter((h) => h <= 12).length,
  };
};
