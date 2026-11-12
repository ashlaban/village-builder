// The hours report (VB-337), for `node tools/sim.js --report hours [--json]`: a household's pawn-hours by job kind, and the farming year's days.
// node tools/sim.js --scenario populous --seed 7 --map small --years 3 --report hours [--from Y] [--every step|hour] [--fields N] [--team]
//   [--household N] [--json]
//   --from Y          sample from year Y to the last year run (default 1); the years before it are run without sampling
//   --every step|hour a sample at every 6-minute step, each counting 0.1 hour (the default), or one at each hour's first step
//   --fields N        keep the households with N fields; --team splits each group into those with an ox team and those without
//   --household N     that household's table: its hours by kind and season, a year at a time
// Over the years sampled, each living pawn's hour is counted for its household (pawn.household) and the season: on a job, by the job's kind,
// as work (phase `work`) or as walking and carrying (any other phase); in the working hours (Sim.WORK) and without a job, as idle (members
// of 7 and over, not retired). Beside them: the working hours of the household's hands (members of 14 to 59, not retired) and of all its
// workers (members of 7 and over, not retired, a child at its rate, sim/rules workRate). A household-year counts when the household lived
// through the whole year sampled; its fields and its ox team are as they were at the end of the spring (the fields it tilled that year).
// Printed, by group of households (by number of fields, or as --fields and --team keep and split them): for each kind the mean hours of
// work and of walking and carrying a household-year, the spread of the two together by household (10th, 50th, 90th percentile) and the
// share of the group's hands' and workers' working hours; then the farming year: for each field, the days it is hoed, sown, ripe, reaped,
// in the barn and threshed, read from its stage changes at every step (and the barn's sheaves for the threshing), as the median and the
// latest day of the group's fields, with the fields never sown and the crops lost to frost (a sown crop gone to stubble without reaping).
// It samples outside the simulation, as tools/idle.js does: it steps the run (Sim.advance, a step at a time, the same run as by any chunks:
// sim/clock) and reads st.agents, st.pawns, st.households and st.farmsteads; it writes nothing to st and adds no counter to the modules,
// so a seed is the same run with or without it (tests/review-tools.js asserts the state's hash). Its cost is the tool's own and small:
// populous small runs 3 years in about 14 s with it and 13 s without. A sample every step is the default, since a sample an hour does
// not agree within 2%: on populous small, seeds 7 and 42, year 3, it reads water 12 to 15% and cooking 10% high, as short jobs begin on the
// hour (backlog/VB-337.md has the comparison).
// Used by tools/sim.js: `const h = require('./hours.js')(VB, st, opts)`; `h.advanceYear()` in place of `Sim.advance(st, Sim.YEAR)`; `h.result()`.
require('./help.js')(__filename);
module.exports = (VB, st, { from = 1, every = 'step', fields = null, team = false, household = null } = {}) => {
  const Sim = VB.sim, { TICKS, workRate } = VB['sim/rules'], [W0, W1] = Sim.WORK, SEASONS = Sim.SEASONS;
  if (!['hour', 'step'].includes(every)) throw new Error('hours: --every is hour or step');
  const STEP = 1 / TICKS, STAGE = { plowed: 'hoed', sown: 'sown', ripe: 'ripe', stooks: 'reaped' },
    DAYS = ['hoed', 'sown', 'ripe', 'reaped', 'barn', 'threshed'];
  const recs = new Map(); // `${year}:${household}` -> household-year
  const fieldYears = new Map(); // `${year}:${farm}:${field}` -> {household, year, days {...}, frost}
  const lastStage = new Map(), barn = new Map(); // field key -> stage; household id -> field keys in the barn, oldest first (null: from before)
  let year = 0, starting = false; // starting: in the year's first step, when the households that live through it are met
  const recOf = (hh, y) => {
    const k = `${y}:${hh.id}`;
    let r = recs.get(k);
    if (!r) recs.set(k, r = { household: hh.id, year: y, whole: starting, fields: 0, team: false, sown: new Set(),
      work: SEASONS.map(() => ({})), move: SEASONS.map(() => ({})), idle: [0, 0, 0, 0], hands: [0, 0, 0, 0], workers: [0, 0, 0, 0] });
    return r;
  };
  const bump = (o, k, n) => { o[k] = (o[k] || 0) + n; };
  function sample(dt, c) {
    const inWork = c.hour >= W0 && c.hour < W1;
    for (const a of st.agents) {
      const p = st.pawns[a.id];
      if (!p.alive || p.household === null) continue;
      const hh = st.households[p.household];
      if (hh.dissolved) continue;
      const r = recOf(hh, year), s = c.season;
      if (a.job) bump(a.phase === 'work' ? r.work[s] : r.move[s], a.job.kind, dt);
      if (!inWork) continue;
      const age = Sim.age(st, p), rate = age >= 7 && !p.retired ? workRate(p.role, age) : 0;
      if (age >= 14 && age < 60 && !p.retired) r.hands[s] += dt;
      r.workers[s] += dt * rate;
      if (!a.job && rate > 0) r.idle[s] += dt;
    }
    if (c.season === 0) for (const id of st.liveHouseholds) { // the fields and the team at the end of the spring: the last spring sample's
      const hh = st.households[id], r = recOf(hh, year);
      r.fields = st.farmsteads[hh.farmstead].fields.length; r.team = !!Sim.team(st, hh);
    }
  }
  // the farming year: every field's stage changes, at every step
  function stages(c) {
    const day = c.doy + (c.year - year) * Sim.YEAR_DAYS, at = (fy, what) => { if (fy.days[what] === null) fy.days[what] = day; };
    const fyOf = (f, fd) => {
      const k = `${year}:${f.id}:${fd.id}`;
      let fy = fieldYears.get(k);
      if (!fy) fieldYears.set(k, fy = {
        year, household: f.household, farm: f.id, field: fd.id, days: Object.fromEntries(DAYS.map((d) => [d, null])), frost: false });
      return fy;
    };
    for (const id of st.liveHouseholds) if (!barn.has(id)) barn.set(id, st.households[id].unthreshed.map(() => null)); // lots from before
    for (const f of st.farmsteads) {
      if (f.household === null) continue;
      for (const fd of f.fields) {
        const key = `${f.id}:${fd.id}`, was = lastStage.get(key);
        if (was === fd.stage) continue;
        lastStage.set(key, fd.stage);
        if (was === undefined) continue;
        const fy = fyOf(f, fd);
        if (STAGE[fd.stage]) at(fy, STAGE[fd.stage]);
        if (fd.stage === 'sown') recOf(st.households[f.household], year).sown.add(fd.id);
        if (fd.stage === 'stubble' && was === 'stooks') { at(fy, 'barn'); (barn.get(f.household) || barn.set(f.household, []).get(f.household)).push(fy); }
        else if (fd.stage === 'stubble' && ['sown', 'growing', 'ripe'].includes(was)) fy.frost = true;
      }
    }
    for (const id of st.liveHouseholds) {
      const hh = st.households[id], q = barn.get(id);
      while (q.length > hh.unthreshed.length) { const fy = q.shift(); if (fy && fy.days.threshed === null) fy.days.threshed = day; }
    }
  }
  function advanceYear() {
    year = Math.floor(st.t / Sim.YEAR) + 1;
    if (year < from) { Sim.advance(st, Sim.YEAR); return; }
    for (let k = 0; k < Sim.YEAR * TICKS; k++) {
      Sim.advance(st, STEP);
      starting = k === 0;
      if (starting) for (const id of st.liveHouseholds) recOf(st.households[id], year);
      const c = Sim.cal(st.t - STEP); // the step just done belongs to the hour it began in
      if (every === 'step') sample(STEP, c); else if (st.tick % TICKS === 1) sample(1, c);
      stages(c);
    }
    for (const r of recs.values()) if (r.year === year && st.households[r.household].dissolved) r.whole = false;
  }
  // ---- the result ----
  const quant = (xs, q) => { const s = [...xs].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : null; };
  const sum = (xs) => xs.reduce((a, b) => a + b, 0), r1 = (x) => (x === null ? null : +x.toFixed(1));
  const dayName = (d) =>
    (d === null ? '-' : `${d >= Sim.YEAR_DAYS ? 'next ' : ''}${SEASONS[Math.floor(d / Sim.SEASON_DAYS) % 4]} ${(d % Sim.SEASON_DAYS) + 1}`);
  const total = (r, part, kind) => sum(r[part].map((s) => s[kind] || 0));
  function groupRows(rows) {
    const kinds = [...new Set(rows.flatMap((r) => r.work.concat(r.move).flatMap(Object.keys)))];
    const hands = sum(rows.map((r) => sum(r.hands))), workers = sum(rows.map((r) => sum(r.workers))), n = rows.length;
    const byKind = kinds.map((kind) => {
      const work = rows.map((r) => total(r, 'work', kind)), move = rows.map((r) => total(r, 'move', kind)), both = work.map((x, i) => x + move[i]);
      return { kind, work: r1(sum(work) / n), move: r1(sum(move) / n), total: r1(sum(both) / n), p10: r1(quant(both, 0.1)), median: r1(quant(both, 0.5)),
        p90: r1(quant(both, 0.9)), ofHands: +(100 * sum(both) / Math.max(hands, 1e-9)).toFixed(1),
          ofWorkers: +(100 * sum(both) / Math.max(workers, 1e-9)).toFixed(1) };
    }).sort((a, b) => b.total - a.total);
    const idle = rows.map((r) => sum(r.idle));
    byKind.push({ kind: '(idle)', work: null, move: null, total: r1(sum(idle) / n), p10: r1(quant(idle, 0.1)), median: r1(quant(idle, 0.5)),
      p90: r1(quant(idle, 0.9)),
      ofHands: +(100 * sum(idle) / Math.max(hands, 1e-9)).toFixed(1), ofWorkers: +(100 * sum(idle) / Math.max(workers, 1e-9)).toFixed(1) });
    const keys = new Set(rows.map((r) => `${r.year}:${r.household}`)), fys = [...fieldYears.values()].filter((fy) => keys.has(`${fy.year}:${fy.household}`));
    const farming = Object.fromEntries(DAYS.map((d) => {
      const xs = fys.map((fy) => fy.days[d]).filter((x) => x !== null);
      return [d, { fields: xs.length, median: dayName(quant(xs, 0.5)), latest: dayName(xs.length ? Math.max(...xs) : null) }];
    }));
    return { households: n, members: r1(sum(rows.map((r) => st.households[r.household].members.length)) / n), handsHours: r1(hands / n),
      workersHours: r1(workers / n),
      hours: byKind, farming, fields: sum(rows.map((r) => r.fields)), neverSown: sum(rows.map((r) => Math.max(0, r.fields - r.sown.size))),
      frost: fys.filter((fy) => fy.frost).length };
  }
  function result() {
    const rows = [...recs.values()].filter((r) => r.whole);
    if (household !== null) {
      const mine = rows.filter((r) => r.household === +household);
      return { household: +household, years: mine.map((r) => ({ year: r.year, fields: r.fields, team: r.team,
        seasons: SEASONS.map((name, s) => ({ season: name, handsHours: r1(r.hands[s]), workersHours: r1(r.workers[s]), idle: r1(r.idle[s]),
          work: Object.fromEntries(Object.entries(r.work[s]).map(([k, v]) => [k, r1(v)])),
            move: Object.fromEntries(Object.entries(r.move[s]).map(([k, v]) => [k, r1(v)])) })),
        farming: [...fieldYears.values()].filter((fy) => fy.year === r.year && fy.household === r.household)
          .map((fy) => ({ field: fy.field, ...Object.fromEntries(DAYS.map((d) => [d, dayName(fy.days[d])])), frost: fy.frost })) })) };
    }
    const kept = fields === null ? rows : rows.filter((r) => r.fields === +fields);
    const groups = new Map();
    for (const r of kept) {
      const name = `${r.fields} field${r.fields === 1 ? '' : 's'}${team ? (r.team ? ', ox team' : ', no team') : ''}`;
      (groups.get(name) || groups.set(name, []).get(name)).push(r);
    }
    const names = [...groups.keys()].sort((a, b) => parseInt(a) - parseInt(b) || a.localeCompare(b));
    return { years: [...new Set(rows.map((r) => r.year))].sort((a, b) => a - b), every, groups: names.map((g) => ({ group: g, ...groupRows(groups.get(g)) })) };
  }
  // printed: a table of hours by kind and the farming year, per group; --household: a table per year, kinds by season
  function print(out) {
    if (out.household !== undefined) {
      for (const y of out.years) {
        console.log(`household ${out.household}, year ${y.year}: ${y.fields} fields${y.team ? ', an ox team' :
          ''}; hours (work + walking and carrying) by season`);
        const kinds = [...new Set(y.seasons.flatMap((s) => [...Object.keys(s.work), ...Object.keys(s.move)]))].sort();
        console.table(Object.fromEntries([...kinds.map((k) =>
          [k, Object.fromEntries(y.seasons.map((s) => [s.season, `${s.work[k] || 0} + ${s.move[k] || 0}`]))]),
          ['(idle)', Object.fromEntries(y.seasons.map((s) => [s.season, s.idle]))],
            ['(hands)', Object.fromEntries(y.seasons.map((s) => [s.season, s.handsHours]))],
          ['(workers)', Object.fromEntries(y.seasons.map((s) => [s.season, s.workersHours]))]]));
        console.table(y.farming);
      }
      return;
    }
    console.log(`pawn-hours a household-year, years ${out.years.join(', ')}, a sample ${out.every === 'step' ? 'every step' : 'an hour'}`);
    for (const g of out.groups) {
      console.log(`\n${g.group}: ${g.households} household-years, ${g.members} members (at the end), hands ${g.handsHours} h, workers ${g.workersHours} h`);
      console.table(Object.fromEntries(g.hours.map(({ kind, ...x }) => [kind, x])));
      console.log(`  the farming year (${g.fields} fields, ${g.neverSown} never sown, ${g.frost} lost to frost):`);
      console.table(g.farming);
    }
  }
  return { advanceYear, result, print };
};
