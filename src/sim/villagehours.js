// @sys sim/villagehours: the symmetric tables of walking hours between village greens, by land and over a normal winter's ice (VB-808),
// and its distance queries
VB['sim/villagehours'] = (() => {
  const { SPEED, TRAVEL, DAY } = VB['sim/rules'],
    { ROUTE } = VB['sim/routes'];
  const { reachCosts } = VB['sim/routes'];
  const { withGround } = VB['sim/walking'],
    { normalGround, bandOfRow } = VB['sim/climate'];

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
  // A village was added to st.villages: the table grows by a row and a column, and the new row is found at once. The winter table grows
  // by an empty row and column, found at the next winter's building: until then the land table answers for it.
  function villageAdded(st) {
    if (st.winterHours) {
      const n = st.villages.length;
      for (const row of st.winterHours) row.push(null);
      st.winterHours.push(new Array(n).fill(null).fill(0, n - 1));
    }
    if (!st.villageHours) return;
    for (const row of st.villageHours) row.push(null);
    st.villageHours.push(new Array(st.villages.length).fill(null));
    refreshHoursRow(st, st.villages.length - 1);
  }

  // ---- the winter table (VB-808; design.md, The ground by season: what people know of the winter ways) ----
  // @state st.winterHours: null, or an array as st.villageHours: row[u] the walking hours from village v's green to u's over the ground of a
  //   normal winter of the world's climate (sim/climate normalGround), bounded at WINTER_HOURS, null beyond it, before its row is found or
  //   for a village added since; the diagonal 0, symmetric. Built a row a step from 5:00 on the day lake ice first bears in the middle band
  //   (WINTER_STEPS steps, as the land table's), each winter; none where no band has lake ice in a normal winter. Read by hoursBetween while
  //   ice bears in the asking village's band. Plain data, saved.
  const WINTER_HOURS = 24,
    WINTER_AT = 5;
  // Village k's row of the winter table (and column k of every other row), from one search over the normal winter's ground.
  function winterRow(st, k, rows) {
    const T = st.winterHours,
      vs = st.villages;
    if (!T || T.length !== vs.length || k >= vs.length) return;
    const targets = vs.map((v) => v.center),
      costs = withGround(st.w, rows, () => reachCosts(st.w, vs[k].center, WINTER_HOURS * SPEED, targets)),
      row = T[k];
    for (let u = 0; u < costs.length; u++) {
      const h = u === k ? 0 : costs[u] === null ? null : costs[u] / SPEED;
      row[u] = h;
      T[u][k] = h;
    }
  }
  // The band whose lake ice starts the table: the middle one, or, in a winter where it has none, the first that has.
  function iceDate(st) {
    const cl = st.climate; // drawn-allow: the ice's date, compared with today only (winterDay): the table is built as the ice comes
    if (!cl) return null;
    const mid = cl.bands[Math.floor(cl.bands.length / 2)].dates.lakeBears;
    if (mid !== null) return mid;
    let first = null;
    for (const b of cl.bands)
      if (b.dates.lakeBears !== null && (first === null || b.dates.lakeBears < first)) first = b.dates.lakeBears;
    return first;
  }
  // Whether today is the day the winter table is built (sim/clock: from WINTER_AT, a step a row).
  const winterDay = (st) => {
    const at = iceDate(st);
    return at !== null && Math.floor(at / DAY) === Math.floor(st.t / DAY);
  };
  // The calendar's entry: step j of the WINTER_STEPS from WINTER_AT on the winter's day; at step 0 the table starts afresh, empty (the land
  // table answers until a row is found). The rows as the land table's are spread (refreshHoursStep).
  function winterStep(st, j) {
    const rows = normalGround(st.w);
    if (!rows) {
      st.winterHours = null;
      return;
    }
    const n = st.villages.length;
    if (j === 0) st.winterHours = Array.from({ length: n }, (_, k) => new Array(n).fill(null).fill(0, k, k + 1));
    for (const k of rowsAt(n, j)) winterRow(st, k, rows);
  }
  // Whether ice bears in the band of village v's green now (sim/climate's states lakeBears, soundShut, soundBears).
  function iceBears(st, v) {
    const cl = st.climate; // drawn-allow: the band's state now, not its dates
    if (!cl) return false;
    const c = st.villages[v].center,
      s = cl.bands[bandOfRow(st.w, (c / st.w.COLS) | 0)].state;
    return s === 'lakeBears' || s === 'soundShut' || s === 'soundBears';
  }
  // The calendar's entry, autumn day 9 from noon (sim/clock): on step j of the 60 from noon, the rows of the villages k with
  // floor(k * 60 / villages) = j (village j itself while there are 60 or fewer).
  const ROW_STEPS = 60;
  function refreshHoursStep(st, j) {
    for (const k of rowsAt(st.villages.length, j)) refreshHoursRow(st, k);
  }
  // The villages whose rows step j of ROW_STEPS finds: k with floor(k * ROW_STEPS / n) = j (village j itself while there are ROW_STEPS
  // or fewer).
  function rowsAt(n, j) {
    if (n <= ROW_STEPS) return j < n ? [j] : [];
    const out = [];
    for (
      let k = Math.floor((j * n + ROW_STEPS - 1) / ROW_STEPS),
        end = Math.floor(((j + 1) * n + ROW_STEPS - 1) / ROW_STEPS);
      k < end;
      k++
    )
      out.push(k);
    return out;
  }
  // Walking hours between two villages' greens: 0 for the same village, Infinity beyond reach or by no land route. Allocates nothing.
  // season: 'land' the land table; 'winter' the winter table where it has the pair; else now: the winter table while ice bears in a's
  // band (VB-808), the land table otherwise and for a pair the winter table does not hold (beyond WINTER_HOURS, or not found yet).
  function hoursBetween(st, a, b, season) {
    if (a === b) return 0;
    const W = st.winterHours;
    if (W && season !== 'land' && (season === 'winter' || iceBears(st, a))) {
      const h = W[a] ? W[a][b] : null;
      if (h !== null && h !== undefined) return h;
    }
    const h = st.villageHours[a][b];
    return h === null ? Infinity : h;
  }
  // The three reaches between two villages (ids), the only ones a rule may ask (VB-685): the same village; within a day's walk (at most
  // `hours` walking hours, TRAVEL.dayWalk unless a rule's own tunable is given: a farm's claim, CLAIMS.farmHours); any way by land.
  const sameVillage = (st, a, b) => a === b;
  const withinDay = (st, a, b, hours = TRAVEL.dayWalk) => hoursBetween(st, a, b) <= hours;
  const byLand = (st, a, b) => hoursBetween(st, a, b) < Infinity;
  return {
    sameVillage,
    withinDay,
    byLand,
    buildHours,
    villageAdded,
    refreshHoursStep,
    hoursBetween,
    ROW_STEPS,
    WINTER_HOURS,
    WINTER_AT,
    winterDay,
    winterStep,
  };
})();
