// Mock B for the town's plan (VB-189): how often a market meets, and where. Throwaway research code, not game code; no test reads it.
//   node docs/cities/mocks/market.js             every table of docs/cities/mock-town-emergence.md, part B (about 20 seconds)
//   node docs/cities/mocks/market.js --only freq|sellers|perish|host|place|lock
// Households stand at the villages of a real generated map (hours.json: the game's table of walking hours). Over a year each comes to want
// things: goods a maker makes (iron, pots, cloth, dried fish, tar), and something of another farm's (an animal, seed, a hand), which any
// household may have, one in twenty. A want loses worth each day it waits. A household can walk to a maker's village any day, or to a
// date some village's host has called, and goes where its own estimate of what it will deal there, less the walk and the hours lost at
// that season's worth of an hour, is best and above nothing; its estimate of a place's dates is what its village found there before
// (principle 14). A host calls a date as a venture, one a year at most, and calls it again only if enough households of other villages
// came (principle 16: the host calls, others answer by coming or not). No rule sets a frequency, a site or a tier.
const { GAME: G, INVENTED: I, rng, table, median, mean, opt } = require('./numbers.js');
const MAPS = require('./hours.json');
const hourValue = G.idle.map((idle) => I.peakHourValue[1] * (1 - idle)); // an hour's worth by season: a field hour's return x the busy share
const REACH = G.travel.dayWalk / 2, ANY = 0.05; // there and back in a day; the chance that one other household has what a farm wants of a farm
const GOODS = [...I.wants, { key: 'farm', rate: 0.5, gain: 8, wait: 1 / 96, any: true }];

function run(mapKey, seed, o = {}) {
  const m = MAPS.find((x) => x.key === mapKey), r = rng(seed), V = m.villages.length, years = o.years || 40;
  const H = m.hours.map((row, a) => row.map((h, b) => (a === b ? 0.1 : h === null ? Infinity : h)));
  const dens = o.density || 1, hh = [];
  m.villages.forEach((v, a) => { for (let k = 0; k < Math.round(v.households * dens); k++) hh.push({ v: a, wants: [], id: hh.length }); });
  const size = m.villages.map((v) => Math.round(v.households * dens));
  const potential = m.villages.map((_, a) => m.villages.reduce((s, u, b) => s + size[b] * Math.exp(-H[a][b] / 3), 0));
  const central = potential.indexOf(Math.max(...potential));
  // makers: K a good, each in a village drawn by its households (fish by the sea), or all in one village (`cluster`: a village index)
  const sr = rng(o.sellerSeed ?? seed), K = o.sellers ?? 2, resident = m.villages.map(() => GOODS.map(() => 0));
  const pick = (ok) => { const w = size.map((n, a) => (ok(a) ? n : 0)), tot = w.reduce((s, x) => s + x, 0); let u = sr() * tot; for (let a = 0; a < V; a++) { u -= w[a]; if (u < 0) return a; } return 0; };
  GOODS.forEach((g, gi) => { if (g.any) return; for (let k = 0; k < K; k++) resident[o.cluster ?? pick((a) => !g.sea || m.villages[a].sea || !m.villages.some((v) => v.sea))][gi]++; });
  const sellerVillages = GOODS.map((_, gi) => m.villages.map((_, a) => a).filter((a) => resident[a][gi]));
  const inReach = m.villages.map((_, a) => GOODS.map((g, gi) => g.any || sellerVillages[gi].some((b) => H[a][b] <= REACH))); // is there a maker within a day there and back
  const rho = m.villages.map(() => m.villages.map(() => GOODS.map(() => I.prior))); // a village's estimate of finding a good at a place's dates
  const expSales = m.villages.map(() => GOODS.map(() => 1)); // a maker's estimate of its sales at a place's date
  const dates = m.villages.map(() => new Set());
  if (o.headStart) for (const d of [3, 15, 27, 39]) dates[o.headStart.village].add(d);
  const perish = o.perishShare || 0, shelf = o.shelf || 3, breakEven = o.breakEven ?? I.hostBreakEven;
  const stats = [];
  for (let y = 0; y < years; y++) {
    const S = { deals: m.villages.map(() => 0), dateDeals: m.villages.map(() => 0), busy: m.villages.map(() => 0), born: 0, filled: 0, home: 0, lapsed: 0, trips: 0, dateTrips: 0, attend: m.villages.map(() => []) };
    const outside = m.villages.map(() => new Map());
    for (let d = 0; d < G.yearDays; d++) {
      const now = y * G.yearDays + d, season = Math.floor(d / G.seasonDays), hv = hourValue[season];
      const today = []; for (let a = 0; a < V; a++) if (dates[a].has(d)) today.push(a);
      // makers who walk to today's dates: those who expect their sales to pay the walk and the morning
      const present = today.map((mk) => GOODS.map((g, gi) => { if (g.any) return 0; let n = resident[mk][gi];
        for (const a of sellerVillages[gi]) if (a !== mk && H[a][mk] <= REACH && expSales[mk][gi] * g.gain >= (2 * H[a][mk] + I.marketHours) * hv) n += resident[a][gi]; return n; }));
      const goers = today.map(() => []), dayDeals = m.villages.map(() => 0);
      const soon = []; // the dates of the next 12 days
      for (let a = 0; a < V; a++) for (const d2 of dates[a]) { const ahead = (d2 - d + G.yearDays) % G.yearDays; if (ahead > 0 && ahead <= 12) soon.push([a, ahead, hourValue[Math.floor(d2 / G.seasonDays)]]); }
      for (const h of hh) {
        for (const [gi, g] of GOODS.entries()) if (r() < g.rate / G.yearDays) {
          S.born++;
          // something of another farm's is first asked for at home, where asking costs no walk
          if (g.any && r() < 1 - Math.pow(1 - ANY, size[h.v] - 1)) { S.filled++; S.home++; continue; } // met among neighbours: not counted as dealing at a place
          if (!inReach[h.v][gi]) { S.lapsed++; continue; } // no maker within a day's walk there and back: the want is not met on foot
          h.wants.push({ gi, born: now, fresh: !g.any && r() < perish });
        }
        if (!h.wants.length) continue;
        // a head looks at what to do every third day (the game's planning day), and on a day a date is held
        if (!today.length && (d + h.id) % 3) continue;
        h.wants = h.wants.filter((w) => { const old = now - w.born >= (w.fresh ? shelf : G.yearDays); if (old) S.lapsed++; return !old; });
        if (!h.wants.length) continue;
        const worth = (w, at) => GOODS[w.gi].gain * Math.max(0, 1 - GOODS[w.gi].wait * (at - w.born)) * (w.fresh && at - w.born >= shelf ? 0 : 1);
        // a walk to a village where makers live, today
        let best = 0, how = null;
        const seen = new Set(); for (const w of h.wants) for (const a of sellerVillages[w.gi]) seen.add(a);
        for (const a of seen) { if (H[h.v][a] > REACH) continue; let val = -2 * H[h.v][a] * hv; for (const w of h.wants) if (resident[a][w.gi]) val += worth(w, now); if (val > best) { best = val; how = { visit: a }; } }
        // a date today
        today.forEach((mk, k) => { if (H[h.v][mk] > REACH) return; let val = -(2 * H[h.v][mk] + I.marketHours) * hv;
          for (const w of h.wants) val += worth(w, now) * (resident[mk][w.gi] ? 1 : rho[h.v][mk][w.gi]); if (val > best) { best = val; how = { date: k }; } });
        // or wait for a date within the next 12 days, if the household expects more of it
        let later = 0;
        for (const [a, ahead, hv2] of soon) { if (H[h.v][a] > REACH) continue;
          let val = -(2 * H[h.v][a] + I.marketHours) * hv2; for (const w of h.wants) val += worth(w, now + ahead) * (resident[a][w.gi] ? 1 : rho[h.v][a][w.gi]); if (val > later) later = val; }
        if (!how || best < later) continue;
        S.trips++;
        if (how.visit !== undefined) { const a = how.visit; let n = 0; h.wants = h.wants.filter((w) => { if (resident[a][w.gi]) { n++; return false; } return true; }); S.filled += n; S.deals[a] += n; dayDeals[a] += n; }
        else { goers[how.date].push(h); S.dateTrips++; }
      }
      // the dates: who came, and what each found
      today.forEach((mk, k) => {
        const A = goers[k].length, sold = GOODS.map(() => 0), from = goers[k].filter((h) => h.v !== mk).length; let n = 0;
        for (const h of goers[k]) h.wants = h.wants.filter((w) => { const g = GOODS[w.gi];
          const found = g.any ? r() < 1 - Math.pow(1 - ANY, A - 1 + size[mk] * (h.v === mk ? 0 : 1)) : present[k][w.gi] > 0;
          rho[h.v][mk][w.gi] = 0.7 * rho[h.v][mk][w.gi] + 0.3 * (found ? 1 : 0); if (found) { n++; sold[w.gi]++; } return !found; });
        GOODS.forEach((g, gi) => { if (!g.any) expSales[mk][gi] = 0.7 * expSales[mk][gi] + 0.3 * (sold[gi] / Math.max(1, present[k][gi] || sellerVillages[gi].length)); });
        S.filled += n; S.deals[mk] += n; S.dateDeals[mk] += n; dayDeals[mk] += n; outside[mk].set(d, from); S.attend[mk].push(A);
      });
      for (let a = 0; a < V; a++) if (dayDeals[a] >= 3) S.busy[a]++;
    }
    // autumn: each host looks at who came. A date that drew too few is not called again; a host may try one new date
    for (let a = 0; a < V; a++) {
      if (!(o.headStart && o.headStart.village === a && y < o.headStart.years)) for (const d of [...dates[a]]) if ((outside[a].get(d) || 0) < breakEven) dates[a].delete(d);
      if (!o.noTry && r() < I.tryChance && dates[a].size < G.yearDays) { let d; do d = Math.floor(r() * G.yearDays); while (dates[a].has(d)); dates[a].add(d); }
    }
    S.kept = dates.map((s, a) => [...s].filter((d) => (outside[a].get(d) || 0) >= breakEven).length);
    stats.push(S);
  }
  const last = stats.slice(-10), avg = (f) => m.villages.map((_, a) => mean(last.map((S) => f(S, a))));
  const kept = avg((S, a) => S.kept[a]), deals = avg((S, a) => S.deals[a]), dateDeals = avg((S, a) => S.dateDeals[a]), busy = avg((S, a) => S.busy[a]);
  const top = (arr) => arr.indexOf(Math.max(...arr)), all = (arr) => arr.reduce((s, x) => s + x, 0);
  const tDate = top(dateDeals), tDeal = top(deals), mid = stats[Math.min(14, stats.length - 1)];
  return { m, kept, deals, dateDeals, busy, tDate, tDeal, central, potential, resident, size,
    islandDates: all(kept), topDates: kept[top(kept)], attendance: mean(last.flatMap((S) => S.attend.flat())) || 0,
    topBusy: Math.max(...busy), topShare: deals[tDeal] / (all(deals) || 1), dateShare: all(dateDeals) / (all(deals) || 1),
    filled: mean(last.map((S) => S.filled / (S.born || 1))), trips: mean(last.map((S) => S.trips)) / hh.length, households: hh.length,
    early: top(mid.dateDeals), anyDates: all(dateDeals) > 0 };
}
const cls = (n) => (n >= 36 ? 'weekly' : n >= 9 ? 'monthly' : n >= 3 ? 'seasonal' : n >= 0.5 ? 'yearly' : 'none');
const f1 = (x) => (Math.round(x * 10) / 10).toFixed(1), pc = (x) => Math.round(x * 100) + '%';
function many(mapKey, o = {}, seeds = 6) {
  const R = []; for (let s = 1; s <= seeds; s++) R.push(run(mapKey, s * 13, o));
  const md = (f) => median(R.map(f)), mn = (f) => mean(R.map(f));
  return { households: R[0].households, 'dates a year, island': f1(mn((x) => x.islandDates)), 'at the fullest place': f1(mn((x) => x.topDates)), 'reads as': cls(md((x) => x.topDates)),
    'households a date': f1(mn((x) => x.attendance)), 'deals at dates': pc(mn((x) => x.dateShare)), 'busy days at the busiest place': f1(mn((x) => x.topBusy)), 'reads as ': cls(md((x) => x.topBusy)),
    'its share of all deals': pc(mn((x) => x.topShare)), 'wants filled': pc(mn((x) => x.filled)), 'walks a household a year': f1(mn((x) => x.trips)) };
}
const only = opt('only', ''), BASE = 'populous-small-7-y30';
const show = (title, rows, first) => { console.log('\n' + title); table(rows, [first, ...Object.keys(rows[0]).filter((k) => k !== first)]); };

if (!only || only === 'freq') {
  console.log(`An hour's worth by season (rations): ${hourValue.map(f1).join(', ')}; a walk of 3 hours each way and a morning's dealing costs ${hourValue.map((h) => f1(10 * h)).join(', ')}.`);
  show('B1. Dates that hold, by the people within reach (2 makers a good, scattered; a date holds at 6 households from other villages; 6 seeds, years 31 to 40)',
    [...MAPS.map((m) => ({ case: m.key, ...many(m.key) })), ...[2, 4].map((d) => ({ case: `${BASE} x ${d} households`, ...many(BASE, { density: d }) }))], 'case');
}
if (!only || only === 'sellers') {
  show('B2. Part-craft households: makers a good, scattered over the villages or all in the most central one (the same map, 6 seeds)',
    [0, 1, 2, 4, 8].flatMap((k) => [{ makers: `${k} a good, scattered`, ...many(BASE, { sellers: k }) }, ...(k ? [{ makers: `${k} a good, in one village`, ...many(BASE, { sellers: k, cluster: run(BASE, 1).central }) }] : [])]), 'makers');
}
if (!only || only === 'perish') {
  show('B3. Perishable goods: the share of wants for a maker\'s good that must be filled within 3 days (the game\'s goods nearly all keep a year: 0%)',
    [0, 0.3, 0.6, 1].flatMap((p) => [{ perishable: pc(p), ...many(BASE, { perishShare: p }) }, { perishable: pc(p) + ', 4 x households', ...many(BASE, { perishShare: p, density: 4 }) }]), 'perishable');
}
if (!only || only === 'host') {
  show('B4. What a host needs: households from other villages for a date to be called again',
    [2, 3, 6, 12, 24].flatMap((b) => [{ 'a date holds at': b, ...many(BASE, { breakEven: b }) }, { 'a date holds at': b + ', 4 x households', ...many(BASE, { breakEven: b, density: 4 }) }]), 'a date holds at');
  show('B4b. What an hour is worth: the walk\'s cost scaled (1 = the field hour\'s return x the busy share)',
    [0.5, 1, 2, 4].map((k) => { const keep = [...hourValue]; hourValue.forEach((h, i) => (hourValue[i] = h * k)); const row = { 'hour worth x': k, ...many(BASE) }; keep.forEach((h, i) => (hourValue[i] = h)); return row; }), 'hour worth x');
}
if (!only || only === 'place' || only === 'lock') {
  // which place: over maps and seeds, the makers drawn anew each seed
  const rows = [];
  for (const m of MAPS) {
    const R = []; for (let s = 1; s <= 12; s++) R.push(run(m.key, s * 17));
    const withDates = R.filter((x) => x.anyDates), rank = (x, a) => x.potential.filter((p) => p > x.potential[a]).length;
    rows.push({ map: m.key, 'runs with dates': withDates.length, 'fullest dates at the most central village': withDates.filter((x) => x.tDate === x.central).length,
      'among the 3 most central': withDates.filter((x) => rank(x, x.tDate) < 3).length, 'by the sea (villages by the sea)': `${withDates.filter((x) => m.villages[x.tDate].sea).length} (${pc(m.villages.filter((v) => v.sea).length / m.villages.length)})`,
      'a maker lives there (villages with a maker)': `${withDates.filter((x) => x.resident[x.tDate].some((n) => n)).length} (${pc(mean(R.map((x) => x.resident.filter((g) => g.some((n) => n)).length / m.villages.length)))})`,
      'most deals of all at a village with a maker': R.filter((x) => x.resident[x.tDeal].some((n) => n)).length, 'the same place leads at year 15 and 40': withDates.filter((x) => x.early === x.tDate).length });
  }
  show('B5. Which place: the village whose dates deal most, 12 seeds a map (makers drawn anew each seed)', rows, 'map');
  // lock-in: the same map and makers, only chance differing; then a head start for a poor site
  const lock = [];
  for (const key of [BASE, 'populous-medium-7-y0', 'populous-small-42-y30']) {
    const R = []; for (let s = 1; s <= 16; s++) R.push(run(key, s * 19, { sellerSeed: 5 }));
    const wins = {}; for (const x of R) if (x.anyDates) wins[x.tDate] = (wins[x.tDate] || 0) + 1;
    const order = Object.entries(wins).sort((a, b) => b[1] - a[1]), x0 = R[0];
    const rank = (a) => x0.potential.filter((p) => p > x0.potential[a]).length + 1;
    // a village of middling potential, within reach of the usual winner, is given four dates that hold whatever comes for 10 years
    const usual = order.length ? +order[0][0] : x0.central, sorted = x0.potential.map((p, a) => [p, a]).sort((a, b) => b[0] - a[0]);
    const poor = sorted[Math.floor(sorted.length / 2)][1];
    const HS = []; for (let s = 1; s <= 16; s++) HS.push(run(key, s * 19, { sellerSeed: 5, headStart: { village: poor, years: 10 } }));
    lock.push({ map: key, 'places that led, of 16 runs': order.map(([a, n]) => `village ${a} (rank ${rank(+a)} of ${x0.potential.length} by potential) ${n}`).join('; ') || 'none',
      'head start: a middling village': `rank ${rank(poor)}`, 'still leads at year 40': HS.filter((x) => x.anyDates && x.tDate === poor).length, 'the usual place leads': HS.filter((x) => x.anyDates && x.tDate === usual).length });
  }
  show('B6. Does it lock in: the same map and the same makers, 16 runs that differ only by chance; then a middling village given four protected dates for its first 10 years', lock, 'map');
}
