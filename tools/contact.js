// Contact and drift (VB-834): does a busy place drift faster, with no rate of its own? Read-only; a description, no target.
// node tools/contact.js [--scenario populous] [--seed 7] [--map small] [--years 40] [--json]
// For each village and year: `met`, the mean number of distinct people its adults (16 or over, living at the year's end) talked with at a
// venue (an occasion: the ale evening, the rite, a wedding, a funeral) that year, a talk seen each game hour from the state; `drift`, the mean
// absolute move per key of the village's mean attitude over its adults, from the year's start to its end (a key is one value of a
// pawn's attitude: Culture.OFF + option). Then the summary: the villages' years in the top fifth by `met` against the rest (mean drift of each),
// and the hosts of gatherings (sim/gathering) against the others. Steps the clock by the hour, so a run differs in detail from a plain one.
require('./help.js')(__filename);
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
const SIZES = { small: [180, 130], medium: [280, 200], tiny: [120, 85], probe: [36, 26] };
function run(VB, seed, scenario, map, years) {
  const Sim = VB.sim, G = VB.gen, it = G.generate(seed, { cols: SIZES[map][0], rows: SIZES[map][1] });
  let r; while (!(r = it.next()).done);
  const st = Sim.seed(r.value, seed, scenario, null, {}), rows = [];
  const meanAtt = () => { // by village: mean attitude of the adults, and how many
    const m = new Map();
    for (const id of st.living) {
      const p = st.pawns[id]; if (p.age < 16 || !p.att) continue;
      const v = Sim.settlementIdOf(st, p); let e = m.get(v);
      if (!e) m.set(v, e = { n: 0, sum: new Float64Array(p.att.length) });
      e.n++; for (let k = 0; k < p.att.length; k++) e.sum[k] += p.att[k];
    }
    for (const e of m.values()) for (let k = 0; k < e.sum.length; k++) e.sum[k] /= e.n;
    return m;
  };
  for (let y = 0; y < years; y++) {
    const met = new Map(), lastAt = new Map(), a0 = meanAtt();
    const note = (a, b) => { let s = met.get(a); if (!s) met.set(a, s = new Set()); s.add(b); };
    for (let h = 0; h < Sim.YEAR; h++) {
      Sim.advance(st, 1);
      for (const id of st.living) {
        const g = st.agents[id], tk = g.talk;
        if (!tk || lastAt.get(id) === tk.at) continue;
        lastAt.set(id, tk.at);
        if (g.occasion !== null && g.path === null) { note(id, tk.with); note(tk.with, id); }
      }
    }
    const a1 = meanAtt(), hosts = new Set(VB['sim/gathering'].gatherings(st).map((x) => x.host)), adults = new Map();
    for (const id of st.living) { const p = st.pawns[id]; if (p.age >= 16) { const v = Sim.settlementIdOf(st, p); (adults.get(v) || adults.set(v, []).get(v)).push(id); } }
    for (const [v, e1] of a1) {
      const e0 = a0.get(v); if (!e0) continue;
      let d = 0; for (let k = 0; k < e1.sum.length; k++) d += Math.abs(e1.sum[k] - e0.sum[k]);
      const ids = adults.get(v);
      rows.push({ seed, year: y + 1, village: v, adults: ids.length, host: hosts.has(v),
        met: +(ids.reduce((s, id) => s + (met.has(id) ? met.get(id).size : 0), 0) / ids.length).toFixed(2), drift: +(d / e1.sum.length).toFixed(5) });
    }
  }
  return rows;
}
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
function summary(rows) {
  const ok = rows.filter((r) => r.adults >= 5), sorted = [...ok].sort((a, b) => b.met - a.met), top = sorted.slice(0, Math.ceil(ok.length / 5)), rest = sorted.slice(top.length);
  const cut = top.length ? top[top.length - 1].met : 0, hosts = ok.filter((r) => r.host), others = ok.filter((r) => !r.host);
  const corr = (() => { const mx = mean(ok.map((r) => r.met)), my = mean(ok.map((r) => r.drift)); let sxy = 0, sxx = 0, syy = 0;
    for (const r of ok) { sxy += (r.met - mx) * (r.drift - my); sxx += (r.met - mx) ** 2; syy += (r.drift - my) ** 2; } return sxy / Math.sqrt(sxx * syy || 1); })();
  return { villageYears: ok.length, topFifthFromMet: cut, topDrift: +mean(top.map((r) => r.drift)).toFixed(5), restDrift: +mean(rest.map((r) => r.drift)).toFixed(5),
    topMet: +mean(top.map((r) => r.met)).toFixed(2), restMet: +mean(rest.map((r) => r.met)).toFixed(2),
    hostYears: hosts.length, hostDrift: +mean(hosts.map((r) => r.drift)).toFixed(5), hostMet: +mean(hosts.map((r) => r.met)).toFixed(2),
    otherDrift: +mean(others.map((r) => r.drift)).toFixed(5), otherMet: +mean(others.map((r) => r.met)).toFixed(2), correlationMetDrift: +corr.toFixed(3) };
}
if (require.main === module) {
  const VB = require('../src/load.js'), scenario = opt('scenario', 'populous'), map = opt('map', 'small'), years = +opt('years', 40);
  const seeds = opt('seed', '7').split(',').map(Number), all = [];
  for (const s of seeds) { const rows = run(VB, s, scenario, map, years); all.push(...rows);
    if (!args.includes('--json')) { console.log(`seed ${s}`); console.log(JSON.stringify(summary(rows))); } }
  if (args.includes('--json')) console.log(JSON.stringify({ rows: all, summary: summary(all) }));
  else { console.log('all seeds'); console.log(JSON.stringify(summary(all))); }
}
module.exports = { run, summary };
