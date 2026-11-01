// Probe for the stability review (docs/review-stability.md). Not part of the game and not under test: one long run, one line per decade
// (--every): people, births, deaths and deaths from hunger per 1,000, hungry days per household, households by size (share, hungry share,
// hungry days), marriages, women's mean age at first marriage, lone holders of 20 to 49, never-married women of 45 to 54, the landless,
// the map's labels and how many repeat (by the page's rule), villages, mean hex steps to the nearest village, farmable land in use, ms a day.
//   node docs/stability/probe.js --scenario populous --seed 7 --map small --years 60 > small-7.txt      [--repo DIR: another checkout's src]
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const repo = opt('repo', require('path').join(__dirname, '../..'));
const VB = require(repo + '/src/load.js'), G = VB.gen, Sim = VB.sim, R = VB['sim/records'], F = VB['sim/hunger'], HX = VB['sim/hex'];
const RULES = VB['sim/rules'];
const SIZES = { tiny: [120, 85], small: [180, 130], medium: [280, 200], large: [380, 270] };
const scenario = opt('scenario', 'populous'), seed = +opt('seed', 7), map = opt('map', 'small'), years = +opt('years', 60), every = +opt('every', 10);
const json = args.includes('--json'), NEWLABELS = !!VB['sim/names']; // the page's label rule of the code under test (VB-026)
const it = G.generate(seed, { cols: SIZES[map][0], rows: SIZES[map][1] }); let r; while (!(r = it.next()).done);
const st = Sim.seed(r.value, seed, scenario), w = st.w, YEAR = Sim.YEAR;
const causeOf = (p) => { const e = p.events.find((x) => x.kind === 'died'); return e ? e.cause : null; };
const ageAt = (p, t) => (t - p.born) / YEAR;
const sizeClass = (n) => (n === 1 ? '1' : n === 2 ? '2' : n <= 5 ? '3-5' : '6+');
const dec = { hh: {}, hungryDays: {}, hungryYears: {}, birth: 0, death: 0, starve: 0, py: 0, marriages: 0, firstAgeF: [], ms: 0, days: 0 };
const out = [];
const reset = () => { for (const k of ['hh', 'hungryDays', 'hungryYears']) dec[k] = {}; Object.assign(dec, { birth: 0, death: 0, starve: 0, py: 0, marriages: 0, firstAgeF: [], ms: 0, days: 0 }); };
const married = new Set();
function labels() { // as src/body.html: a village with a green by its name, the farms of any other village by theirs
  const l = [];
  const byName = (v) => v.green || (NEWLABELS && v.farmsteads.length >= 2);
  for (const v of st.villages) { if (!v.farmsteads.length) continue; if (byName(v)) l.push(v.name); else for (const id of v.farmsteads) l.push(st.farmsteads[id].name); }
  const n = new Map(); for (const x of l) n.set(x, (n.get(x) || 0) + 1);
  const top = [...n].filter(([, c]) => c > 1).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, c]) => `${k}×${c}`).join(' ');
  return { labels: l.length, distinct: n.size, repeats: l.length - n.size, top };
}
function spacing() {
  const live = st.villages.filter((v) => v.farmsteads.some((id) => st.farmsteads[id].household !== null));
  let sum = 0, n = 0;
  for (const v of live) {
    let best = Infinity;
    for (const u of live) if (u !== v) best = Math.min(best, HX.hexSteps(w, v.center, u.center));
    if (best < Infinity) { sum += best; n++; }
  }
  // land use: farmable tiles that are a house, field or meadow, of all farmable tiles
  let farmable = 0, used = 0;
  const built = new Set(st.used); for (const f of st.farmsteads) for (const m of f.meadows || []) built.add(m.tile !== undefined ? m.tile : m);
  for (let t = 0; t < w.N; t++) if (RULES.farmable(w, t)) { farmable++; if (built.has(t)) used++; }
  return { villages: live.length, nnSteps: n ? +(sum / n).toFixed(1) : null, landUsed: +(100 * used / farmable).toFixed(1) };
}
for (let y = 1; y <= years; y++) {
  const t0 = st.t, hung = new Map(st.households.map((h) => [h.id, h.hungryDays])), c0 = Date.now();
  Sim.advance(st, YEAR);
  dec.ms += Date.now() - c0; dec.days += Sim.YEAR_DAYS;
  for (const h of st.households) {
    if (h.dissolved || !h.members.length) continue;
    const k = sizeClass(h.members.length), d = h.hungryDays - (hung.get(h.id) || 0);
    dec.hh[k] = (dec.hh[k] || 0) + 1; dec.hungryDays[k] = (dec.hungryDays[k] || 0) + d; if (d > 0) dec.hungryYears[k] = (dec.hungryYears[k] || 0) + 1;
  }
  for (const p of st.pawns) {
    if (!p.founder && p.born >= t0 && p.born < st.t) dec.birth++;
    if (p.died !== null && p.died >= t0 && p.died < st.t) { dec.death++; if (causeOf(p) === 'hunger') dec.starve++; }
  }
  dec.py += st.pawns.filter((p) => p.alive).length;
  for (const u of st.unions) if (u.start >= t0 && u.start < st.t) {
    dec.marriages++;
    const f = st.pawns[st.pawns[u.a].sex === 'f' ? u.a : u.b];
    if (!married.has(f.id)) dec.firstAgeF.push(ageAt(f, u.start));
  }
  for (const u of st.unions) { married.add(u.a); married.add(u.b); }
  if (y % every === 0 || y === years) {
    const alive = st.pawns.filter((p) => p.alive), hhs = st.households.filter((h) => !h.dissolved && h.members.length);
    const holder = new Set(hhs.map((h) => h.holder));
    const loneHolders = hhs.filter((h) => { const p = st.pawns[h.holder]; return p && R.spouseOf(st, p.id) === null && p.age >= 20 && p.age < 50; });
    const w4554 = alive.filter((p) => p.sex === 'f' && p.age >= 45 && p.age < 55), nm = w4554.filter((p) => !married.has(p.id)).length;
    const adults = alive.filter((p) => p.age >= 18), single2545 = alive.filter((p) => p.age >= 25 && p.age < 45 && R.spouseOf(st, p.id) === null);
    const sz = {}; for (const k of ['1', '2', '3-5', '6+']) {
      const n = dec.hh[k] || 0; sz[k] = { share: +(100 * n / Object.values(dec.hh).reduce((a, b) => a + b, 0)).toFixed(0),
        hungry: n ? +(100 * (dec.hungryYears[k] || 0) / n).toFixed(0) : 0, days: n ? +((dec.hungryDays[k] || 0) / n).toFixed(1) : 0 };
    }
    const allHh = Object.values(dec.hh).reduce((a, b) => a + b, 0), allDays = Object.values(dec.hungryDays).reduce((a, b) => a + b, 0);
    const row = { year: y, pop: alive.length, households: hhs.length, ones: hhs.filter((h) => h.members.length === 1).length,
      birthsK: +(1000 * dec.birth / dec.py).toFixed(1), deathsK: +(1000 * dec.death / dec.py).toFixed(1), starveK: +(1000 * dec.starve / dec.py).toFixed(1),
      starved: dec.starve, hungryDaysPerHh: +(allDays / allHh).toFixed(2), bySize: sz,
      marriages: dec.marriages, womenFirstAge: dec.firstAgeF.length ? +(dec.firstAgeF.reduce((a, b) => a + b, 0) / dec.firstAgeF.length).toFixed(1) : null,
      loneHolders2050: loneHolders.length, loneHoldersM: loneHolders.filter((h) => st.pawns[h.holder].sex === 'm').length,
      women4554NeverMarried: `${nm}/${w4554.length}`, single2545: single2545.length, landless: adults.filter((p) => !holder.has(p.id) && !(R.spouseOf(st, p.id) !== null && holder.has(R.spouseOf(st, p.id)))).length,
      adults: adults.length, ...labels(), ...spacing(), msPerDay: +(dec.ms / dec.days).toFixed(1) };
    out.push(row);
    if (!json) {
      const s = row.bySize;
      console.log(`y${String(y).padStart(3)} pop ${String(row.pop).padStart(4)} hh ${String(row.households).padStart(3)} ones ${String(row.ones).padStart(3)} `
        + `b/d/starve per1000 ${row.birthsK}/${row.deathsK}/${row.starveK} (${row.starved}) hungryDays/hh ${row.hungryDaysPerHh} `
        + `| size%/hungry%/days 1:${s['1'].share}/${s['1'].hungry}/${s['1'].days} 2:${s['2'].share}/${s['2'].hungry}/${s['2'].days} 3-5:${s['3-5'].share}/${s['3-5'].hungry}/${s['3-5'].days} 6+:${s['6+'].share}/${s['6+'].hungry}/${s['6+'].days} `
        + `| marr ${row.marriages} fAge ${row.womenFirstAge} loneHold ${row.loneHolders2050}(m${row.loneHoldersM}) nevMarr ${row.women4554NeverMarried} single25-45 ${row.single2545} landless ${row.landless}/${row.adults} `
        + `| labels ${row.labels} distinct ${row.distinct} rep ${row.repeats} [${row.top}] | vill ${row.villages} nn ${row.nnSteps} land% ${row.landUsed} | ${row.msPerDay} ms/day`);
    }
    reset();
  }
}
if (json) console.log(JSON.stringify({ scenario, seed, map, years, rows: out }));
