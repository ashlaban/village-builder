// The seasons' weather (VB-354; design.md, Crops and the weather), on drawn years and a small constructed state: barley's factor over
// 1,000 drawn years has the mean and spread of the yearly factor it replaced (0.75 to 1.2 evenly: mean 0.975, deviation 0.13), both
// printed; each crop reads its own seasons (a dry summer leaves rye whole, a hard snowless winter touches only rye); the thaw falls on
// spring days 1 to 4 and nothing is sown before it; the frost on autumn days 8 to 12, most often the last; a cold summer ripens barley
// up to 2 days later and a warm one a day earlier; two years are kept, plain data, and a season's line is told once as it begins.
const assert = require('assert');
const VB = require('../src/load.js'), Sim = VB.sim;
const W = VB['sim/weather'], { SEASON_DAYS, DAY, cal } = VB['sim/rules'], { CROPS } = VB['sim/crops'];
const { makeStream } = VB['sim/rng'];
const { tinyWorld, tinyState } = require('./lib/tiny.js');
const { checkState } = require('./lib/invariants.js');

// ---- 1,000 drawn years, on a bare state holding only the stream and the seasons ----
const bare = { rng: { weather: makeStream(7, 'weather') }, weather: [], record: [], t: 0 };
const stats = (a) => {
  const m = a.reduce((s, x) => s + x, 0) / a.length;
  const sd = Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / a.length);
  const q = [...a].sort((x, y) => x - y);
  return { mean: m, sd, p5: q[Math.floor(a.length * 0.05)], p95: q[Math.floor(a.length * 0.95)], min: q[0], max: q[q.length - 1] };
};
const years = [];
for (let y = 1; y <= 1000; y++) {
  bare.weather.push({ year: y, seasons: [], thaw: 0, frost: 0 });
  while (bare.weather.length > 2) bare.weather.shift();
  const r = bare.rng.weather, tri = () => Math.round((VB['sim/rng'].next(r) + VB['sim/rng'].next(r) - 1) * 100) / 100;
  for (let s = 0; s < 4; s++) bare.weather[bare.weather.length - 1].seasons.push([tri(), tri()]);
  years.push(Object.fromEntries(['barley', 'rye', 'peas'].map((k) => [k, W.cropFactor(bare, k)])));
}
const b = stats(years.map((x) => x.barley)),
  uniform = { mean: 0.975, sd: 0.45 / Math.sqrt(12) };
const fmt = (s) => `mean ${s.mean.toFixed(3)}, deviation ${s.sd.toFixed(3)}, 5% ${s.p5.toFixed(2)}, 95% ${s.p95.toFixed(2)}, range ${s.min.toFixed(2)} to ${s.max.toFixed(2)}`;
console.log(`barley over 1,000 drawn years: ${fmt(b)}`);
console.log(`the yearly factor it replaced: mean ${uniform.mean}, deviation ${uniform.sd.toFixed(3)}, range 0.75 to 1.2`);
for (const k of ['rye', 'peas']) console.log(`${k}: ${fmt(stats(years.map((x) => x[k])))}`);
assert.ok(Math.abs(b.mean - uniform.mean) < 0.01, `barley's mean ${b.mean} is the old factor's`);
assert.ok(Math.abs(b.sd - uniform.sd) < 0.015, `barley's spread ${b.sd} is the old factor's`);
const corr = (k) => {
  const xs = years.map((x) => x.barley), ys = years.map((x) => x[k]), mx = stats(xs).mean, my = stats(ys).mean;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < xs.length; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2; }
  return sxy / Math.sqrt(sxx * syy);
};
console.log(`correlation with barley over the years: rye ${corr('rye').toFixed(2)}, peas ${corr('peas').toFixed(2)}`);
assert.ok(corr('rye') < 0.5, 'barley and rye fail in different years');

// ---- each crop's own seasons, on chosen weather ----
const set = (seasons, last = [[0, 0], [0, 0], [0, 0], [0, 0]]) => {
  bare.weather = [{ year: 0, seasons: last, thaw: 0, frost: 11 }, { year: 1, seasons, thaw: 0, frost: 11 }];
};
set([[0, 0], [0, -1], [0, 0], [0, 0]]); // a drought summer
assert.ok(W.cropFactor(bare, 'barley') < W.factorOf(0) && W.cropFactor(bare, 'peas') < W.cropFactor(bare, 'barley'), 'a drought: barley poor, peas poorer');
assert.strictEqual(W.cropFactor(bare, 'rye'), W.factorOf(0), 'and the rye whole');
set([[0, 0], [0, 0], [0, 0], [0, 0]], [[0, 0], [0, 0], [0, 0], [-1, -1]]); // last winter hard and snowless
assert.ok(W.cropFactor(bare, 'rye') < 0.6 && W.cropFactor(bare, 'barley') === W.factorOf(0), 'a bare frost touches only the rye');
set([[0, 0], [-1, 0], [0, 0], [0, 0]]);
assert.strictEqual(W.ripeShift(bare, 'barley'), 2, 'a cold summer: barley ripe 2 days later');
assert.strictEqual(W.ripeShift(bare, 'rye'), 0, 'rye does not read it');
set([[0, 0], [1, 0], [0, 0], [0, 0]]);
assert.strictEqual(W.ripeShift(bare, 'peas'), -1, 'a warm summer: peas a day earlier');

// ---- the days, over the 1,000 years' draws ----
const days = { thaw: {}, frost: {} };
const st0 = { rng: { weather: makeStream(11, 'weather') }, weather: [], record: [], t: 0 };
for (let y = 1; y <= 1000; y++) {
  W.seasonBegins(st0, { year: y, season: 0 }, true);
  const now = st0.weather[st0.weather.length - 1];
  days.thaw[now.thaw] = (days.thaw[now.thaw] || 0) + 1;
  days.frost[now.frost] = (days.frost[now.frost] || 0) + 1;
}
console.log(`thaw (spring sday): ${JSON.stringify(days.thaw)}; frost (autumn sday): ${JSON.stringify(days.frost)}`);
assert.deepStrictEqual(Object.keys(days.thaw).map(Number).sort((x, y) => x - y), [0, 1, 2, 3], 'the thaw on spring days 1 to 4');
assert.deepStrictEqual(Object.keys(days.frost).map(Number).sort((x, y) => x - y), [7, 8, 9, 10, 11], 'the frost on autumn days 8 to 12');
assert.strictEqual(+Object.entries(days.frost).sort((x, y) => y[1] - x[1])[0][0], SEASON_DAYS - 1, 'most often on the last');
assert.ok(st0.weather.length === 2, 'two years kept, nothing older');

// ---- in a run: nothing sown before the thaw, the line a season, plain data, the invariants ----
const st = tinyState(tinyWorld(Array.from({ length: 14 }, () => '.'.repeat(20))), [{ at: [8, 7], farms: 2 }], { seed: 3 });
const y1 = st.weather[st.weather.length - 1];
y1.thaw = 3;
let sownEarly = 0;
while (cal(st.t).doy < SEASON_DAYS) {
  Sim.advance(st, DAY / 4);
  const c = cal(st.t);
  if (c.season === 0 && c.sday < 3) for (const f of st.farmsteads) for (const fd of f.fields) if (fd.stage === 'plowed' || fd.sown !== null) sownEarly++;
}
assert.strictEqual(sownEarly, 0, 'no field hoed or sown before the thaw');
const lines = st.record.filter((e) => e && e.kind === 'weather');
assert.ok(lines.length === 1 && /^Summer comes in/.test(lines[0].text), `the summer named as it begins: ${JSON.stringify(lines)}`);
assert.strictEqual(st.weather[st.weather.length - 1].seasons.length, 2, "spring's and summer's weather, drawn once each");
assert.deepStrictEqual(JSON.parse(JSON.stringify(st.weather)), st.weather, 'plain data');
assert.deepStrictEqual(checkState(st), [], 'invariants');
console.log('weather ok');
