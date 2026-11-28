// VB-1965 (docs/plans/VB-1965-hunger.md), on the files of VB-1965-probe.js
// node sum.js FILE...: a line a run: hungry household-days, deaths by hunger, households hungry, by year; grain produced by year;
// the villages whose grain fell most in years 6-7 against years 4-5, with their rye and the hungry days in them
const fs = require('fs');
for (const f of process.argv.slice(2)) {
  let d;
  try {
    d = JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch (e) {
    console.log(f, 'missing');
    continue;
  }
  const by = {},
    hh = new Set(),
    vh = {};
  for (const r of d.recs)
    if (r.hungry) {
      by[r.year] = (by[r.year] || 0) + r.hungry;
      hh.add(r.hh);
      vh[r.village] = (vh[r.village] || 0) + r.hungry;
    }
  const g = (y) => Object.values(y.food.all.lines.produced.grain || {}).reduce((a, b) => a + b, 0);
  const vg = (y, v) => {
    const x = y.food.villages[v];
    return x && x.lines.produced && x.lines.produced.grain ? x.lines.produced.grain : {};
  };
  const rye = (y, v) => Math.round(vg(y, v).rye || 0);
  const vs = Object.entries(vh)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(
      ([v, n]) =>
        `v${v} ${n} (rye y4-7 ${[3, 4, 5, 6].map((i) => (d.years[i] ? rye(d.years[i], +v) : '-')).join('/')})`,
    );
  console.log(
    f.split('/').pop().replace('.json', '').padEnd(22),
    'hungry',
    String(d.hungryDays).padStart(4),
    'deaths',
    d.deaths.length,
    'hh',
    String(hh.size).padStart(2),
    'years',
    Object.entries(by)
      .map(([y, n]) => `${y}:${n}`)
      .join(' '),
    '| grain',
    d.years.map((y) => Math.round(g(y) / 100)).join(' '),
    '| worst',
    vs.join(', '),
  );
}
