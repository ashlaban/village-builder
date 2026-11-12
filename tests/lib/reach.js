// VB-286: the walking hours between villages' greens agree with the route search. For every pair of greens: reachCosts (one search from
// each green) gives what findRoute + routeCost give, to 1e-9, null where findRoute finds none within ROUTE.reach; and a table built now
// holds those costs over SPEED. Returns the number of pairs compared and those with a route.
const assert = require('assert');
module.exports = (VB, st, label = '') => {
  const { findRoute, routeCost, reachCosts, buildHours } = VB['sim/routes'], { ROUTE, SPEED } = VB['sim/rules'], w = st.w;
  const centres = st.villages.map((v) => v.center), n = centres.length;
  let pairs = 0, routed = 0;
  for (let a = 0; a < n; a++) {
    const costs = reachCosts(w, centres[a], ROUTE.reach, centres);
    for (let b = 0; b < n; b++) {
      if (b === a) { assert.strictEqual(costs[b], 0, `${label}: village ${a} to itself`); continue; }
      if (b < a) continue;
      pairs++;
      const p = findRoute(w, centres[a], centres[b]);
      if (p === null) assert.strictEqual(costs[b], null, `${label}: villages ${a} and ${b}: no route, but a cost ${costs[b]}`);
      else {
        routed++;
        assert(costs[b] !== null && Math.abs(costs[b] - routeCost(w, p)) < 1e-9, `${label}: villages ${a} and ${b}: ${costs[b]} against ${routeCost(w, p)}`);
      }
    }
  }
  const was = st.villageHours;
  buildHours(st);
  for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
    if (a === b) continue;
    const p = a < b ? findRoute(w, centres[a], centres[b]) : null, h = st.villageHours[a][b];
    if (a < b) assert(p === null ? h === null : Math.abs(h - routeCost(w, p) / SPEED) < 1e-9, `${label}: table entry ${a}, ${b}`);
    else assert.strictEqual(h, st.villageHours[b][a], `${label}: table entry ${a}, ${b} not symmetric`);
  }
  st.villageHours = was; // the table as it was: the test does not change the state it was given
  return { pairs, routed };
};
