// Dung, tilth and the meadow ratio (VB-720; design.md, Goods and the farming year, Soil and Yield over time; docs/review-yields.md, 4).
// node tools/sim.js --scenario populous --seed 7 --map small --years 30 --report soil [--period year|decade] [--json]
// Runs a day at a time (as tools/hours.js does) and reads the fields; it changes nothing. By period (decade: years 1-10, 11-20 ...; or each
// year; --period, default decade), for each farm class by the cattle it kept that day (none, 1-2 head, 3+):
//   farms, fields, cattle a field, mean soil and mean tilth at the period's end (the farms present then);
//   loads a field-year spread to the soil's cap, and beyond it (spread for tilth alone, field.surplus), read from each spreading (a
//   field's tilth moving: the loads are what moved it, TILTH.perLoad each); loads a farm-year rotted on the heap (SOIL.rot, a day's share
//   of the heap); grain reaped a field (its `held` at the reaping).
// And by village at the period's end: meadow tiles to field tiles, cattle a field, mean tilth; then, a row each period, the correlation
// of the meadow ratio with mean tilth over the villages, and the mean tilth of those whose fields outran their meadows (under 0.5 meadow
// tiles a field) beside the rest. A description: no target. The counts are kept in the tool, outside the state (Rules for cost 8 and
// 10), derived from the fields once a day; the simulation's step and counters are unchanged (no increment added where a load is spread:
// the tilth it moved says it, and a count there would be one number for the island, not a class's).
// Used by tools/sim.js (`const s = require('./soil.js')(VB, st, opts)`, `s.advanceYear()`, `s.result()`, `s.print(out)`) and
// tests/lib/bands.js (tilthByHerd).
require('./help.js')(__filename);
const CLASSES = ['none', '1-2', '3+'];
const classOf = (n) => (n === 0 ? 'none' : n <= 2 ? '1-2' : '3+');
const cattleOf = (st, hh) => {
  let n = 0;
  for (const id of hh.herds) {
    const hd = st.herds[id];
    if (hd.species === 'cattle') n += hd.head.length;
  }
  return n;
};
// The fields of farms with cattle and of farms without, now: {cattle: {n, sum}, none: {n, sum}}, the sum of their tilth.
function tilthByHerd(VB, st) {
  const out = { cattle: { n: 0, sum: 0 }, none: { n: 0, sum: 0 } },
    { tilthOf } = VB['sim/fields'];
  for (const id of st.liveHouseholds) {
    const hh = st.households[id],
      f = st.farmsteads[hh.farmstead];
    if (!f) continue;
    const o = cattleOf(st, hh) > 0 ? out.cattle : out.none;
    for (const fd of f.fields) {
      o.n++;
      o.sum += tilthOf(st, fd);
    }
  }
  return out;
}
const r2 = (x, n = 2) => (x === null || !Number.isFinite(x) ? null : +x.toFixed(n));
function corr(xs, ys) {
  const n = xs.length;
  if (n < 3) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n,
    my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0,
    sxx = 0,
    syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : null;
}
module.exports = (VB, st, { period = 'decade' } = {}) => {
  if (!['year', 'decade'].includes(period)) throw new Error('soil: --period is year or decade');
  const Sim = VB.sim,
    { SOIL, YEAR_DAYS, YEAR } = VB['sim/rules'], { TILTH } = VB['sim/fields'],
    { tilthOf } = VB['sim/fields'];
  const span = period === 'year' ? 1 : 10,
    perDay = 1 - Math.pow(1 - SOIL.rot, 1 / YEAR_DAYS);
  const acc = new Map(); // period -> class -> tallies
  const last = new Map(); // `${farm}:${field}` -> what the field read the day before
  const snaps = new Map(); // period -> {classes, villages}
  let lastYear = 0;
  const tally = (p, k) => {
    if (!acc.has(p))
      acc.set(p, Object.fromEntries(CLASSES.map((c) => [c, { farmDays: 0, fieldDays: 0, cap: 0, beyond: 0, rot: 0, grain: 0, reaped: 0 }])));
    return acc.get(p)[k];
  };
  function day(p) {
    const year = Math.floor(st.t / YEAR);
    for (const id of st.liveHouseholds) {
      const hh = st.households[id],
        f = st.farmsteads[hh.farmstead];
      if (!f) continue;
      const a = tally(p, classOf(cattleOf(st, hh)));
      a.farmDays++;
      a.fieldDays += f.fields.length;
      a.rot += (hh.manure || 0) * perDay;
      for (const fd of f.fields) {
        const key = f.id + ':' + fd.id,
          l = last.get(key),
          sur = fd.surplusYear === year ? fd.surplus : 0;
        if (l && fd.tilthAt !== l.at) {
          const loads = Math.max(0, (fd.tilth - l.tilth * Math.exp(-(fd.tilthAt - l.at) / (TILTH.years * YEAR))) / TILTH.perLoad),
            beyond = Math.min(loads, Math.max(0, sur - (l.sy === year ? l.surplus : 0)));
          a.beyond += beyond;
          a.cap += loads - beyond;
        }
        if (fd.stage === 'stooks' && (!l || l.stage !== 'stooks' || l.reaped !== fd.reaped)) {
          a.grain += fd.held;
          a.reaped++;
        }
        last.set(key, { tilth: fd.tilth, at: fd.tilthAt, surplus: sur, sy: year, reaped: fd.reaped, stage: fd.stage });
      }
    }
  }
  function snapshot(p) {
    const classes = Object.fromEntries(CLASSES.map((c) => [c, { farms: 0, fields: 0, soil: 0, tilth: 0, cattle: 0 }])),
      vs = new Map();
    for (const id of st.liveHouseholds) {
      const hh = st.households[id],
        f = st.farmsteads[hh.farmstead];
      if (!f) continue;
      const n = cattleOf(st, hh),
        s = classes[classOf(n)];
      s.farms++;
      s.fields += f.fields.length;
      s.cattle += n;
      let t = 0;
      for (const fd of f.fields) {
        const x = tilthOf(st, fd);
        s.soil += fd.soil;
        s.tilth += x;
        t += x;
      }
      if (f.village !== null && f.village !== undefined) {
        const v = vs.get(f.village) || { village: f.village, farms: 0, fields: 0, meadows: 0, cattle: 0, tilth: 0 };
        v.farms++;
        v.fields += f.fields.length;
        v.meadows += f.meadows.length;
        v.cattle += n;
        v.tilth += t;
        vs.set(f.village, v);
      }
    }
    snaps.set(p, { classes, villages: [...vs.values()].filter((v) => v.fields) });
  }
  function advanceYear() {
    const y = Math.floor(st.t / YEAR) + 1,
      p = Math.ceil(y / span);
    for (let d = 0; d < YEAR_DAYS; d++) {
      Sim.advance(st, Sim.DAY);
      day(p);
    }
    lastYear = y;
    snapshot(p); // the last year of a period leaves the period's snapshot
  }
  function result() {
    const rows = [],
      vrows = [],
      meadows = [];
    for (const p of [...acc.keys()].sort((a, b) => a - b)) {
      const sn = snaps.get(p),
        label = `${(p - 1) * span + 1}-${Math.min(p * span, lastYear)}`;
      for (const c of CLASSES) {
        const a = acc.get(p)[c],
          s = sn.classes[c],
          fy = a.fieldDays / YEAR_DAYS,
          farmY = a.farmDays / YEAR_DAYS;
        rows.push({
          years: label,
          class: c,
          farms: s.farms,
          fields: s.fields,
          cattleAField: r2(s.fields ? s.cattle / s.fields : null),
          soil: r2(s.fields ? s.soil / s.fields : null, 3),
          tilth: r2(s.fields ? s.tilth / s.fields : null, 4),
          loadsToCap: r2(fy ? a.cap / fy : null),
          loadsBeyond: r2(fy ? a.beyond / fy : null),
          rotted: r2(farmY ? a.rot / farmY : null),
          grain: r2(a.reaped ? a.grain / a.reaped : null, 1),
        });
      }
      const vs = sn.villages.map((v) => ({
        years: label,
        village: v.village,
        farms: v.farms,
        fields: v.fields,
        meadows: v.meadows,
        meadowRatio: r2(v.meadows / v.fields),
        cattleAField: r2(v.cattle / v.fields),
        tilth: r2(v.tilth / v.fields, 4),
      }));
      vrows.push(...vs);
      const out = vs.filter((v) => v.meadowRatio < 0.5),
        rest = vs.filter((v) => v.meadowRatio >= 0.5),
        mean = (l) => (l.length ? r2(l.reduce((a, v) => a + v.tilth, 0) / l.length, 4) : null);
      meadows.push({
        years: label,
        villages: vs.length,
        corr: r2(corr(vs.map((v) => v.meadowRatio), vs.map((v) => v.tilth)), 3),
        outran: out.length,
        outranTilth: mean(out),
        other: rest.length,
        otherTilth: mean(rest),
      });
    }
    return { period, classes: rows, villages: vrows, meadows };
  }
  function print(out) {
    console.log('by farm class (cattle kept); loads a field-year, rot a farm-year, grain a field reaped:');
    console.table(out.classes);
    console.log("by village at the period's end:");
    console.table(out.villages);
    console.log('meadow tiles to field tiles against mean tilth (outran: under 0.5 meadow tiles a field):');
    console.table(out.meadows);
  }
  return { advanceYear, result, print };
};
module.exports.tilthByHerd = tilthByHerd;
