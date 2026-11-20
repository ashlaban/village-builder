// @sys sim/villagehours: the symmetric table of walking hours between village greens and its distance queries
VB['sim/villagehours'] = (() => {
  const { ROUTE, SPEED, TRAVEL } = VB['sim/rules'];
  const { reachCosts } = VB['sim/routes'];

  // ---- walking hours between villages (VB-286) ----
  // @state st.villageHours: array, a row for each village id, each of length the number of villages; row[u] the walking hours from village v's
  //   green (its centre) to u's, by the route search's costs over SPEED, or null beyond ROUTE.reach or with no route by land; the diagonal 0.
  //   Symmetric, as the costs are. Compiled a village a step by the calendar (autumn day 9), and at once for a village founded
  //   (villageAdded). Read by hoursBetween (sim/gathering, sim/society).
  // Village k's row, and column k of every other row, from one search of the villages' centres.
  function refreshHoursRow(st, k) {
    const T = st.villageHours,
      vs = st.villages;
    if (!T || T.length !== vs.length || k >= vs.length) return;
    const targets = vs.map((v) => v.center),
      costs = reachCosts(st.w, vs[k].center, ROUTE.reach, targets),
      row = T[k];
    for (let u = 0; u < costs.length; u++) {
      const h = u === k ? 0 : costs[u] === null ? null : costs[u] / SPEED;
      row[u] = h;
      T[u][k] = h;
    }
  }
  // The whole table: at the seed, and at a load of a save made before it.
  function buildHours(st) {
    const n = st.villages.length;
    st.villageHours = Array.from({ length: n }, () => new Array(n).fill(null));
    for (let k = 0; k < n; k++) refreshHoursRow(st, k);
  }
  // A village was added to st.villages: the table grows by a row and a column, and the new row is found at once.
  function villageAdded(st) {
    if (!st.villageHours) return;
    for (const row of st.villageHours) row.push(null);
    st.villageHours.push(new Array(st.villages.length).fill(null));
    refreshHoursRow(st, st.villages.length - 1);
  }
  // The calendar's entry, autumn day 9 from noon (sim/clock): on step j of the 60 from noon, the rows of the villages k with
  // floor(k * 60 / villages) = j (village j itself while there are 60 or fewer).
  const ROW_STEPS = 60;
  function refreshHoursStep(st, j) {
    const n = st.villages.length;
    if (n <= ROW_STEPS) {
      if (j < n) refreshHoursRow(st, j);
      return;
    }
    for (
      let k = Math.floor((j * n + ROW_STEPS - 1) / ROW_STEPS),
        end = Math.floor(((j + 1) * n + ROW_STEPS - 1) / ROW_STEPS);
      k < end;
      k++
    )
      refreshHoursRow(st, k);
  }
  // Walking hours between two villages' greens: 0 for the same village, Infinity beyond reach or by no land route. Allocates nothing.
  function hoursBetween(st, a, b) {
    if (a === b) return 0;
    const h = st.villageHours[a][b];
    return h === null ? Infinity : h;
  }
  // The three reaches between two villages (ids), the only ones a rule may ask (VB-685): the same village; within a day's walk (at most
  // `hours` walking hours, TRAVEL.dayWalk unless a rule's own tunable is given: a farm's claim, CLAIMS.farmHours); any way by land.
  const sameVillage = (st, a, b) => a === b;
  const withinDay = (st, a, b, hours = TRAVEL.dayWalk) => hoursBetween(st, a, b) <= hours;
  const byLand = (st, a, b) => hoursBetween(st, a, b) < Infinity;
  return { sameVillage, withinDay, byLand, buildHours, villageAdded, refreshHoursStep, hoursBetween, ROW_STEPS };
})();
