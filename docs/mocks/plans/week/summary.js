// Study B: the headline numbers of the four runs side by side (reads data/<run>.json, which planner.js --json wrote).
// node docs/mocks/plans/week/summary.js
const path = require('path'), RUNS = ['populous-7', 'populous-11', 'populous-42', 'founders-7'];
const R = Object.fromEntries(RUNS.map((r) => [r, require(path.join(__dirname, 'data', r + '.json'))]));
const row = (name, f) => console.log(name.padEnd(44), RUNS.map((r) => { try { const v = f(R[r]); return String(v ?? '-').padStart(13); } catch (e) { return '-'.padStart(13); } }).join(''));
console.log(''.padEnd(44), RUNS.map((r) => r.padStart(13)).join(''));
row('record: allotments / hh-day', (o) => o.record.allotsPerHHDay);
row('record: plan reviews / hh-day (today)', (o) => o.record.reviewsPerHHDay);
row('record: dayPair / hh-day', (o) => o.record.dayPairPerHHDay);
row('record: same type as yesterday %', (o) => o.record.sameTypeAsYesterday);
row('baseline: daily mock misplaced %', (o) => o.baseline.daily.misplacedPct);
row('P5 foreseen % (kind ±1 day, hours ±25%)', (o) => o.P5.foreseen);
row('P5 hours ±50%', (o) => o.P5.within50);
row('P5 kind only (±1 day)', (o) => o.P5.kindOnly);
for (const s of ['spring', 'summer', 'autumn', 'winter']) row(`P5 ${s} foreseen / kind only`, (o) => `${o.P5.bySeason[s].foreseen}/${o.P5.bySeason[s].kindOnly}`);
row('P5 top surprises (unforeseen h)', (o) => o.P5.surprises.slice(0, 3).map((x) => x.kind).join(','));
for (const p of ['daily', 'w3', 'w4', 'w6', 'w12', 'w6pool']) {
  row(`${p}: reviews/hh-day (in+out)`, (o) => p === 'daily' ? o.policies[p].allotsPerHHDay + ' allots' : `${o.policies[p].inTurn}+${o.policies[p].outTurn}`);
  row(`${p}: pairs/hh-day`, (o) => o.policies[p].pairsPerHHDay);
  row(`${p}: vital unmet % / windows missed %`, (o) => `${o.policies[p].vitalUnmetPct}/${o.policies[p].windowsMissedPct}`);
  if (p !== 'daily') row(`${p}: stale steps, hours /hh-day`, (o) => `${o.policies[p].staleStepsPerHHDay}/${o.policies[p].staleHoursPerHHDay}`);
}
row('w6: out of turn: unforeseen / range', (o) => `${o.policies.w6.outTurnUnforeseen}/${o.policies.w6.outTurnRange}`);
row('w6: moved between reviews %', (o) => o.policies.w6.moved);
row('same type: daily / w6 %', (o) => `${o.policies.daily.sameType}/${o.policies.w6.sameType}`);
row('w6 windowed begun no later / within 6h %', (o) => `${o.P7windowed.noLater}/${o.P7windowed.within6h}`);
row('cook unmet h: daily / w6', (o) => `${o.policies.daily.unmetKind.cook}/${o.policies.w6.unmetKind.cook}`);
for (const s of o0().P10.bySeason.map((x) => x.season)) row(`P10 ${s}: hh/village/owed/neither %`, (o) => { const x = o.P10.bySeason.find((y) => y.season === s); return `${Math.round(x.hh)}/${x.village}/${x.owed}/${Math.round(x.neither)}`; });
row('P10 year: village / owed %', (o) => `${o.P10.year.village}/${o.P10.year.owed}`);
row('P10 ceiling 0.85 binds, member-weeks %', (o) => o.P10.ceilingAll);
for (const sz of ['1', '2', '3+']) row(`P10 ceiling binds, size ${sz}, spring/summer/aut/win`, (o) => [0, 1, 2, 3].map((s) => { const c = o.P10.ceiling[`${s}|${sz}`]; return c ? Math.round(c.over85) : '-'; }).join('/'));
function o0() { return R['populous-7']; }
// P9: pooled over the three populous seeds and founders, by disruption, season group and size
const P9 = {};
for (const r of RUNS) for (const [k, v] of Object.entries(R[r].P9)) {
  const [kind, season, size] = k.split('|'), sz = size === '3+' ? '3+' : '1-2', key = `${kind}|${season}|${sz}`, e = (P9[key] ||= { n: 0, dV: 0, wV: 0, dW: 0, wW: 0, extra: 0, drop: 0, low: 0, latest: [0, 0], yesD: 0, yesW: 0 });
  e.n += v.n; e.dV += v.dailyVitalUnmetPerCase * v.n; e.wV += v.weeklyVitalUnmetPerCase * v.n; e.dW += v.dailyWindowsMissedPerCase * v.n; e.wW += v.weeklyWindowsMissedPerCase * v.n;
  e.extra += v.weeklyExtraOutOfTurn * v.n; e.drop += v.weeklyDroppedPerCase * v.n; e.low += (v.loweredOrAsked || 0) * v.n / 100; e.yesD += (v.askYesDaily || 0) * v.n / 100; e.yesW += (v.askYesWeekly || 0) * v.n / 100;
  if (v.droppedLatestFirst !== null) { e.latest[0] += v.droppedLatestFirst; e.latest[1]++; }
}
console.log('\nP9 (all runs pooled): disruption|season|adults  n  Δvital h daily/weekly  Δwindows daily/weekly  extra out-of-turn  dropped  lowered-or-asked %  ask yes daily/weekly %');
for (const [k, e] of Object.entries(P9).sort()) console.log(k.padEnd(22), String(e.n).padStart(4), `${(e.dV / e.n).toFixed(2)}/${(e.wV / e.n).toFixed(2)}`.padStart(14), `${(e.dW / e.n).toFixed(2)}/${(e.wW / e.n).toFixed(2)}`.padStart(14),
  (e.extra / e.n).toFixed(2).padStart(8), (e.drop / e.n).toFixed(2).padStart(8), (100 * e.low / e.n).toFixed(0).padStart(6), k.startsWith('ask') ? `${(100 * e.yesD / e.n).toFixed(0)}/${(100 * e.yesW / e.n).toFixed(0)}`.padStart(9) : '');
