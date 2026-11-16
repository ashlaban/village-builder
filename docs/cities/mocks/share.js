// Mock D for the town's plan (VB-776): does a facility that is costly to build and worth sharing gather makers, where free movement
// and dealing at gatherings alone did not (move.js, mock C); and, in the same toy, an elite household as buyer and a ship's buyer.
// Throwaway research code, not game code; no test or tool reads it.
//   node docs/cities/mocks/share.js               every table of docs/cities/mock-town-emergence.md, part three (under a minute)
//   node docs/cities/mocks/share.js --only size|held|lock|sweep|stops|three|label   (tables D1 to D7, in that order; D6 and D7 share their runs)
// The toy is move.js's `run`, with three things switched on by option (move.js, "the third mock"; with none on, C1 to C9 read as before):
//   fac: a maker makes only at a facility of its craft in its village. It costs `cost` years of a household's spare hours (959: the
//     hours a farm's three adults stand idle a year) and takes `cap` makers. Who may use it: 'own', its builder's household (one newcomer
//     may take up one left standing); 'due', any maker of the craft living there, who leaves a fifth of its make at the facility for its
//     owner; 'village', raised in common by the village's farms as a mill is, if it is within a tenth of their spare hours for two years,
//     and free to its makers. A builder's spare hours go to the facility first and it sells nothing until it stands; a build longer than
//     a year must be lived through on fields, garden and cows. A facility nobody uses for 10 years falls in. The first makers have theirs.
//   elite: one household at a village that wants `mult` farms' worth of the makers' goods, always has the grain to pay (rent, slice 5),
//     and feeds the makers of its village in a lean year. `home`: it deals only with makers who live at its village.
//   ship: a buyer on one harbour's green three days of summer, taking `worth` rations' worth a year, a third of each craft, of the makers
//     who live within `reach` hours (half a day: its days are known; 0.2: only of those who live there).
// The measure is the task's: the fullest village's share of the island's maker households, the mean of years 26 to 30 and 56 to 60.
// Numbers: numbers.js, and the defaults above (all invented; listed in the document).
const { GAME: G, INVENTED: I, table, mean, opt } = require('./numbers.js');
const { run, top, sum, f1, pc, central, workShare, REACH, SPARE, CRAFTS, BASE, MED, pieceHours } = require('./move.js');
const only = opt('only', ''), on = (k) => !only || only === k;
const show = (title, rows) => { console.log('\n' + title); table(rows, Object.keys(rows[0])); };
const cache = new Map();
const R = (key, seed, o) => { const id = key + '|' + seed + '|' + JSON.stringify(o); if (!cache.has(id)) cache.set(id, run(key, seed, o)); return cache.get(id); };
const seedsOf = (n, step = 13) => Array.from({ length: n }, (_, i) => (i + 1) * step);
const at = (x, y0, a) => mean(x.stats.slice(y0 - 5, y0).map((S) => S.makers[a]));
const lead = (x, y0, a) => { const mk = x.size.map((_, b) => at(x, y0, b)), t = a ?? top(mk), all = sum(mk); return { t, n: mk[t], all, share: all ? mk[t] / all : 0 }; };
// a third or more of the island's maker households, at a place of three or more (one maker of three on an island is not a town)
const third = (l) => l.share >= 1 / 3 && l.n >= 3;
function reading(X) {
  const a = X.map((x) => lead(x, 30)), b = X.map((x) => lead(x, 60)), last = X.map((x) => x.stats[59]), mn = (f) => mean(X.map(f));
  const out = { 'maker households, year 60': f1(mean(b.map((l) => l.all))), 'at the fullest place, year 30': f1(mean(a.map((l) => l.n))), 'year 60': f1(mean(b.map((l) => l.n))),
    'its share, year 30': pc(mean(a.map((l) => l.share))), 'its share, year 60': pc(mean(b.map((l) => l.share))),
    'seeds with a third or more at year 60': `${b.filter(third).length} of ${X.length}`, 'and a third at year 30 too, at the same place': X.filter((_, i) => third(b[i]) && third(a[i]) && a[i].t === b[i].t).length };
  if (last[0].facs) Object.assign(out, { 'facilities standing': f1(mean(last.map((S) => sum(S.facs)))), 'makers at one in use': f1(mean(last.map((S) => mean(S.facUsers.filter((n) => n > 0))))), 'the most at one': Math.max(...last.map((S) => Math.max(0, ...S.facUsers))),
    'built by a maker': f1(mn((x) => x.events.built)), 'by a village': f1(mn((x) => x.events.villageBuilt)), 'took a place at one standing': f1(mn((x) => x.events.joined)) });
  Object.assign(out, { 'would-be makers who found no place': f1(mn((x) => x.events.noPlace)), 'gave up': f1(mn((x) => x.events.quit)) });
  return out;
}
const many = (key, o, n) => reading(seedsOf(n).map((s) => R(key, s, o)));
const C0 = central(BASE, 1), R0 = run(BASE, 1, { years: 1 }), HB = top(R0.m.villages.map((v, a) => (v.sea ? R0.potential[a] : -1))); // the most central village (a host) and the best-placed harbour of the real map
const PLAN = { access: 'due', cost: 0.03, cap: 4 }, DEAR = { access: 'due', cost: 2, cap: 4 };
const facName = (f) => `${f.access === 'own' ? "its builder's only" : f.access === 'due' ? 'any maker for a due' : "the village's"}, ${f.cost} years, ${f.cap} makers`;

console.log(`A household's year of spare hours: ${Math.round(SPARE)} (three adults at ${G.adultHours} hours, idle ${pc(mean(G.idle))} of them). The game's planned facilities: a bloomery 20 hours and 6 loads (about ${(29 / SPARE).toFixed(2)} of such a year), ` +
  `a brick or lime kiln 30 hours and 6 loads (${(39 / SPARE).toFixed(2)}), a loom 12 hours (${(12 / SPARE).toFixed(2)}), a mill 100 to 140 hours (${(100 / SPARE).toFixed(2)} to ${(140 / SPARE).toFixed(2)}); pots are fired in a pit. ` +
  `So "within a factor of two of the planned costs" is up to ${(280 / SPARE).toFixed(1)} of a year; the task's sweep (0.5 to 4 years) is ${Math.round((0.5 * SPARE) / 29)} to ${Math.round((4 * SPARE) / 29)} times a bloomery.`);
console.log(`The real map is ${BASE} (${sum(R0.size)} households, ${R0.V} villages; the most central village is ${C0}, a gathering's host; the best-placed harbour is ${HB}). Its farms give the makers about ${Math.round(sum(R0.size) * CRAFTS.reduce((s, g) => s + g.rate * g.worth, 0))} rations a year in all.`);

if (on('size')) {
  const rows = [];
  for (const [key, d, n] of [[BASE, 1, 10], [MED, 1, 3], [BASE, 4, 1]])
    for (const [name, fac] of [['no facility (mock C)', null], [`a facility at the planned cost (${facName(PLAN)})`, PLAN], [`a costly one (${facName(DEAR)})`, DEAR]])
      rows.push({ map: `${key} x ${d}`, variant: name, seeds: n, ...many(key, fac ? { density: d, fac } : { density: d }, n) });
  show('D1. The fullest village\'s share of the island\'s maker households, with and without a facility, at the real maps\' sizes and at four times (60 years; years 26 to 30 and 56 to 60)', rows);
}
if (on('held') || on('lock')) {
  const r0 = run(BASE, 1, { years: 1 }), sorted = r0.potential.map((p, a) => [p, a]).sort((a, b) => b[0] - a[0]), poor = sorted[Math.floor(sorted.length / 2)][1], N = 10;
  const VAR = [['no facility (mock C)', null], [facName(PLAN), PLAN], [facName({ access: 'own', cost: 2, cap: 4 }), { access: 'own', cost: 2, cap: 4 }], [facName(DEAR), DEAR]];
  if (on('held')) {
    const rows = [];
    for (const [name, fac] of VAR) { const X = seedsOf(4, 19).map((s) => R(BASE, s, { placeSeed: 5, cluster: poor, ...(fac ? { fac } : {}) }));
      rows.push({ variant: name, 'maker households there at year 10': f1(mean(X.map((x) => at(x, 10, poor)))), 'year 20': f1(mean(X.map((x) => at(x, 20, poor)))), 'year 30': f1(mean(X.map((x) => at(x, 30, poor)))), 'year 40': f1(mean(X.map((x) => at(x, 40, poor)))), 'year 60': f1(mean(X.map((x) => at(x, 60, poor)))),
        'of all makers at year 30': pc(mean(X.map((x) => lead(x, 30, poor).share))), 'at year 60': pc(mean(X.map((x) => lead(x, 60, poor).share))), 'it leads at year 60, of 4 runs': X.filter((x) => lead(x, 60).t === poor).length,
        'facilities there at year 60': fac ? f1(mean(X.map((x) => x.stats[59].facs[poor]))) : '-' }); }
    show(`D2. Does a place begun gathered now hold: all six first makers begun at village ${poor}, a middling one, each craft's facility standing there (${BASE}, 4 runs that differ by chance)`, rows);
  }
  if (on('lock')) {
    const rows = [];
    for (const [name, fac] of [VAR[0], VAR[3]]) { const X = seedsOf(N, 19).map((s) => R(BASE, s, { placeSeed: 5, ...(fac ? { fac } : {}) }));
      const ld = (x, y0) => { const l = lead(x, y0); return l.n >= 2 ? l.t : -1; }, wins = {}; for (const x of X) { const a = ld(x, 60); if (a >= 0) wins[a] = (wins[a] || 0) + 1; }
      // do the places stay: of the villages with a maker at year 20, those with one at year 60; and the same for a facility
      const stay = (f) => mean(X.map((x) => { const a = x.size.map((_, v) => f(x.stats[19], v) > 0), n = a.filter(Boolean).length; return n ? a.filter((y, v) => y && f(x.stats[59], v) > 0).length / n : NaN; }).filter(Number.isFinite));
      rows.push({ variant: name, [`villages that led at year 60, of ${N} runs`]: Object.entries(wins).sort((a, b) => b[1] - a[1]).map(([a, n]) => `${a}${X[0].hosts.includes(+a) ? ' (host)' : ''} ${n}`).join('; ') || 'none', 'different villages': Object.keys(wins).length,
        'same village leads at years 20 and 60': X.filter((x) => ld(x, 20) >= 0 && ld(x, 20) === ld(x, 60)).length, 'at years 40 and 60': X.filter((x) => ld(x, 40) >= 0 && ld(x, 40) === ld(x, 60)).length, 'makers at the leader, year 60': f1(mean(X.map((x) => lead(x, 60).n))),
        'villages with a maker at year 20 that have one at 60': pc(stay((S, v) => S.makers[v])), 'with a facility at year 20 that have one at 60': fac ? pc(stay((S, v) => S.facs[v])) : '-' }); }
    show(`D3. Does the leading place lock in or wander: the same map, deposits and first makers, ${N} runs that differ only by chance (${BASE})`, rows);
  }
}
if (on('sweep')) {
  const rows = [], n = 2, row = (fac) => { const X = seedsOf(n).map((s) => R(BASE, s, { density: 1, fac }));
    const due = fac.access === 'due' ? mean(X.map((x) => mean(x.stats.slice(-10).map((S) => (S.payers > 0 ? S.due / S.payers : NaN)).filter(Number.isFinite)))) : NaN;
    const heir = fac.access === 'due' ? mean(X.map((x) => sum(x.stats.slice(-10).map((S) => S.dueHeir)) / (sum(x.stats.slice(-10).map((S) => S.due)) || 1))) : NaN, payers = mean(X.map((x) => mean(x.stats.slice(-10).map((S) => S.payers || 0))));
    rows.push({ 'who may use it': fac.access === 'own' ? "its builder's household" : fac.access === 'due' ? 'any maker, for a due' : "the village's", 'cost, years of spare hours': fac.cost, 'makers it takes': fac.access === 'own' ? 1 : fac.cap, ...many(BASE, { density: 1, fac }, n),
      'makers who pay a due': fac.access === 'due' ? f1(payers) : '-', 'a due a year, each (rations\' worth)': Number.isFinite(due) ? Math.round(due) : '-', 'of the dues, to a builder\'s heir who is no maker': Number.isFinite(heir) ? pc(heir) : '-' }); };
  for (const access of ['own', 'due', 'village']) for (const cost of access === 'due' ? [0.03, 0.5, 1, 2, 4] : [0.5, 1, 2, 4]) row({ access, cost, cap: 4 });
  for (const cap of [2, 8]) row({ access: 'due', cost: 2, cap });
  show(`D4. How the answer moves with the facility's cost, its capacity and who may use it (${BASE}, ${n} seeds; 0.03 is the planned bloomery)`, rows);
}
if (on('stops')) {
  const rows = [], n = 2;
  for (const [name, o] of [['a costly facility (2 years, a due, 4 makers)', {}], ['its material carried at no cost', { matCost: 0, loadsPerTrip: 1e9 }], ['wants come twice as often', { often: 2 }], ['a full island: farms make 1.0 to 1.25 of need', { ratio: [1.0, 1.25] }],
    ['fields free at 30% of those held', { landSlack: 0.3 }], ['three times the would-be makers', { entry: 0.03 }], ['a facility of any craft serves all three', { fac: { ...DEAR, anyCraft: true } }]]) {
    const oo = { density: 1, fac: DEAR, ...o }, X = seedsOf(n).map((s) => R(BASE, s, oo)), L = (x) => x.stats.slice(-10), t = (x) => lead(x, 60).t;
    const full = mean(X.map((x) => { const u = x.stats[59].facUsers.filter((k) => k > 0); return u.length ? u.filter((k) => k >= oo.fac.cap).length / u.length : NaN; }).filter(Number.isFinite));
    rows.push({ 'one thing changed': name, ...(({ 'maker households, year 60': a, 'year 60': b, 'its share, year 60': c, 'would-be makers who found no place': d, 'gave up': e }) => ({ 'maker households, year 60': a, 'at the fullest place': b, 'its share': c, 'would-be makers who found no place': d, 'gave up': e }))(many(BASE, oo, n)),
      'farms within a day there and back of it': Math.round(mean(X.map((x) => mean(L(x).map((S) => x.size.reduce((s, _, b) => s + (x.H[t(x)][b] <= REACH ? S.farms[b] : 0), 0)))))),
      'wants unmet': pc(1 - mean(X.map((x) => mean(L(x).map((S) => S.filled / (S.born || 1)))))), 'makers under 0.85 of need': pc(mean(X.map((x) => mean(L(x).map((S) => sum(S.hungry) / (sum(S.makers) || 1)))))), 'facilities in use that are full': pc(full) });
  }
  show(`D5. What stops the place: one thing changed at a time on the costly facility (${BASE}, ${n} seeds, years 51 to 60)`, rows);
  const smith = pieceHours.smith(0.5), blooms = Math.floor((3 * G.adultHours - G.chores) / smith);
  console.log(`Fuel, as arithmetic (nothing here burns): a bloom takes ${G.bloom.wood} loads of wood and a household about 35 a year for its hearth (ECON.woodUse), so a smith's household at half skill that did nothing else (${blooms} blooms) would burn ${blooms * G.bloom.wood} loads, ` +
    `as ${Math.round((blooms * G.bloom.wood) / 35)} hearths; the smiths of the mock sell 4 to 8 blooms a year (24 to 48 loads, one hearth more). Ore: ${G.bloom.ore} loads a bloom, ${I.oreHoursPerLoad} hours a load at the bog.`);
}
if (on('three') || on('label')) {
  const EL = (mult, o) => ({ v: C0, mult, ...o }), SHIP = (worth, o) => ({ v: HB, worth, ...o });
  const CASES = [['none (mock C)', {}, 10], ['a facility at the planned cost', { fac: PLAN }, 10], ['a costly facility (2 years, a due)', { fac: DEAR }, 10],
    ['an elite household wanting 5 farms\' goods, at the central village', { elite: EL(5) }, 3], ['wanting 20 farms\' goods', { elite: EL(20) }, 3],
    ['a ship\'s buyer taking 500 rations\' worth a year at the harbour', { ship: SHIP(500) }, 3], ['taking 1,000', { ship: SHIP(1000) }, 3], ['taking 2,000', { ship: SHIP(2000) }, 3],
    ['all together, the elite (20) and the ship (1,000) at the harbour, the facility at the planned cost', { fac: PLAN, elite: { v: HB, mult: 20 }, ship: SHIP(1000) }, 6],
    ['all together, the facility costly', { fac: DEAR, elite: { v: HB, mult: 20 }, ship: SHIP(1000) }, 10]];
  const FAR = [['an elite household wanting 80 farms\' goods, dealing only with makers of its village', { elite: EL(80, { home: true }) }, 3],
    ['a ship taking 2,000 only of makers who live at the harbour', { ship: SHIP(2000, { reach: 0.2 }) }, 3], ['taking 4,000 (more than all the island\'s farms give its makers)', { ship: SHIP(4000, { reach: 0.2 }) }, 3],
    ['all together and all at the harbour: a costly facility, an elite (20) that deals at home, a ship (2,000) that takes only of those who live there', { fac: DEAR, elite: { v: HB, mult: 20, home: true }, ship: SHIP(2000, { reach: 0.2 }) }, 5],
    ['the same, the facility at the planned cost', { fac: PLAN, elite: { v: HB, mult: 20, home: true }, ship: SHIP(2000, { reach: 0.2 }) }, 3]];
  const extra = (o, n) => { const X = seedsOf(n).map((s) => R(BASE, s, { density: 1, ...o })), sp = o.ship ? o.ship.v : o.elite ? o.elite.v : -1;
    return { 'the ship took, rations\' worth a year': o.ship ? Math.round(mean(X.map((x) => mean(x.stats.slice(-10).map((S) => S.ship))))) : '-', 'makers at the elite\'s or the ship\'s village, year 60': sp >= 0 ? f1(mean(X.map((x) => at(x, 60, sp)))) : '-',
      'within half a day of it': sp >= 0 ? f1(mean(X.map((x) => sum(x.size.map((_, a) => (x.H[sp][a] <= REACH ? at(x, 60, a) : 0)))))) : '-' }; };
  if (on('three')) {
    const strip = (r) => { const { 'facilities standing': a, 'makers at one in use': b, 'the most at one': c, 'built by a maker': d, 'by a village': e, 'took a place at one standing': f, ...rest } = r; return rest; };
    show(`D6. The three candidates in one toy (${BASE}; the elite at village ${C0}, the ship at harbour ${HB})`, CASES.map(([name, o, n]) => ({ variant: name, seeds: n, ...strip(many(BASE, { density: 1, ...o }, n)), ...extra(o, n) })));
    show('D6b. Beyond what is planned: what it takes for a place to hold a third', FAR.map(([name, o, n]) => ({ variant: name, seeds: n, ...strip(many(BASE, { density: 1, ...o }, n)), ...extra(o, n) })));
  }
  if (on('label')) {
    // every village-year of the last 30 years: what the label would read, by variant
    const rows = [], cuts = [0, 1, 3, 12, 24], dcuts = [0, 1, 3, 5, 8];
    const hist = (arr, c) => c.map((lo, i) => pc(arr.filter((x) => x >= lo && (i + 1 >= c.length || x < c[i + 1])).length / arr.length)).join(', ');
    for (const [name, o, n] of [CASES[0], CASES[2], CASES[9], FAR[3]]) { const out = [], dg = [], ws = [], topW = [], topOut = [], sp = o.ship ? o.ship.v : -1, atShip = [];
      for (const s of seedsOf(Math.min(n, 4))) { const x = R(BASE, s, { density: 1, ...o }), t = lead(x, 60).t;
        for (const S of x.stats.slice(-30)) x.size.forEach((_, a) => { if (S.farms[a] + S.makers[a] < 3) return; out.push(S.outGreen[a]); dg.push(S.dGreen[a]); const w = workShare(S, a); if (Number.isFinite(w)) ws.push(w); if (a === t) { topW.push(w); topOut.push(S.outGreen[a]); } if (a === sp) atShip.push(S.outGreen[a]); }); }
      ws.sort((a, b) => a - b);
      rows.push({ variant: name, 'village-years': out.length, 'outsiders on the green a year: 0, 1 to 2, 3 to 11, 12 to 23, 24 and more': hist(out, cuts), 'dealing days: 0, 1 to 2, 3 to 4, 5 to 7, 8 and more': hist(dg, dcuts),
        'work not farming per 1,000: median, nine in ten under, the most': `${Math.round(1000 * ws[Math.floor(ws.length / 2)])}, ${Math.round(1000 * ws[Math.floor(ws.length * 0.9)])}, ${Math.round(1000 * ws[ws.length - 1])}`,
        'at the fullest place: work not farming': Math.round(1000 * mean(topW)), 'outsiders a year': f1(mean(topOut)), 'outsiders at the ship\'s green': atShip.length ? f1(mean(atShip)) : '-' }); }
    show(`D7. What the place's measures read (villages of 3 households or more, years 31 to 60, up to 4 seeds, ${BASE})`, rows);
  }
}
