// Study C, steps 1 to 3 (docs/mocks/plans/village/README.md): a standalone model seeded with the load curves observe.js recorded.
//   P10: the shares of adult working hours by claimant; P12: village days placed by the calendar, the alderman, the household;
//   P13: an estate's spring due of N adult-days, the default rule of design 5.2, substitution and commutation, a lean year.
// node docs/mocks/plans/village/model.js [--curves out/curves-populous-7.json] [--seed 1] [--json]
// It reads the curves and nothing of the simulation; every draw is from mulberry32 seeded by --seed. No game code.
const fs = require('fs'), path = require('path');
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i >= 0 ? process.argv[i + 1] : d; };
const file = arg('curves', path.join(__dirname, 'out/curves-populous-7.json')), rngSeed = Number(arg('seed', 1));
const C = JSON.parse(fs.readFileSync(file, 'utf8'));
function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const YD = 48, SD = 12, DAYH = 8; // a year of 48 days, seasons of 12; an adult-day claimed is 8 hours of work (sim/days DAYS.hours)
const [iH, iField, iSow, iVital, iVillage, iOwed, iOther, iIdle] = [0, 1, 2, 3, 4, 5, 6, 7];
const HH = Object.entries(C.households).map(([id, h]) => ({ id: +id, ...h }));
const row = (h, d) => h.rows[d] || null;
const sizeOf = (a) => (a <= 1 ? '1' : a === 2 ? '2' : '3+');
const pct = (x) => (Number.isFinite(x) ? +(100 * x).toFixed(1) : null);
const sum = (xs) => xs.reduce((s, x) => s + x, 0);
const out = { file: path.basename(file), rngSeed };

// ---- P10: shares of adult working hours by claimant ----
{
  const S = [0, 1, 2, 3].map(() => ({ H: 0, hh: 0, village: 0, owed: 0, own: 0 }));
  const weeks = { n: 0, bind: 0, bindSmall: 0, bySeason: [0, 0, 0, 0] }, debtor = [];
  for (const h of HH) {
    for (let d = 0; d < h.rows.length; d++) {
      const r = row(h, d); if (!r || r[iH] <= 0) continue;
      const s = Math.floor((d % YD) / SD);
      S[s].H += r[iH]; S[s].hh += r[iField] + r[iVital] + r[iOther]; S[s].village += r[iVillage]; S[s].owed += r[iOwed]; S[s].own += r[iIdle];
    }
    for (let w = 0; w * 6 < h.rows.length; w++) { // household-weeks (6 days): the household's work over its adults' hours, against 0.85
      let H = 0, W = 0; for (let d = w * 6; d < w * 6 + 6 && d < h.rows.length; d++) { const r = row(h, d); if (r) { H += r[iH]; W += r[iField] + r[iVital] + r[iOther]; } }
      if (H <= 0) continue; weeks.n++;
      if (W / H > 0.85) { weeks.bind++; const a = h.adults[w * 6] || 1; if (a <= 2) weeks.bindSmall++; weeks.bySeason[Math.floor(((w * 6) % YD) / SD)]++; }
    }
    for (let q = 0; q * SD < h.rows.length; q++) { // a debtor household in its called season
      let H = 0, O = 0; for (let d = q * SD; d < q * SD + SD; d++) { const r = row(h, d); if (r) { H += r[iH]; O += r[iOwed]; } }
      if (O > 0 && H > 0) debtor.push(O / H);
    }
  }
  const tot = S.reduce((a, s) => ({ H: a.H + s.H, village: a.village + s.village, owed: a.owed + s.owed }), { H: 0, village: 0, owed: 0 });
  debtor.sort((a, b) => a - b);
  out.P10 = {
    household: S.map((s) => pct(s.hh / s.H)), village: S.map((s) => pct(s.village / s.H)), owed: S.map((s) => pct(s.owed / s.H)),
    own: S.map((s) => pct(s.own / s.H)), villageYear: pct(tot.village / tot.H), owedYear: pct(tot.owed / tot.H),
    debtorSeasonP90: pct(debtor[Math.floor(0.9 * debtor.length)]), debtorSeasonMax: pct(debtor[debtor.length - 1]), debtorSeasons: debtor.length,
    ceilingBindsWeeks: pct(weeks.bind / weeks.n), bindersSmallShare: pct(weeks.bindSmall / Math.max(1, weeks.bind)), bindersBySeason: weeks.bySeason,
  };
}

// ---- the day's effect of a claim of c hours on household h: delivered hours and displaced field (windowed) hours ----
// Order of design 5.2: vital work and days owed first (fixed), then the claim (it has an enforcer), then the windowed work; idle and other
// (movable) work absorb before the windowed work is displaced. The recorded village hours are taken out: they are what is being placed.
function effect(h, d, c) {
  const r = row(h, d);
  if (!r || r[iH] <= 0) return { del: 0, disp: 0, sow: 0, A: 0 };
  const A = r[iH], fixed = r[iVital] + r[iOwed], W = r[iField];
  const del = Math.min(c, Math.max(0, A - fixed));
  const disp = Math.min(W, Math.max(0, W + fixed + del - A));
  return { del, disp, sow: W > 0 ? (disp * r[iSow]) / W : 0, A };
}
const days = (y, s) => Array.from({ length: SD }, (_, k) => y * YD + s * SD + k);
function lots(total, hs, by, rnd) { // integer adult-days over households, equal or by fields, largest remainder, ties by a seeded order
  const w = hs.map((x) => (by === 'fields' ? Math.max(1, x.f) : 1)), W = sum(w);
  const raw = w.map((x) => (total * x) / W), n = raw.map(Math.floor);
  let left = total - sum(n); const order = raw.map((x, i) => [x - n[i], rnd(), i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (let k = 0; left > 0; k++, left--) n[order[k % order.length][2]]++;
  return n;
}
// The n lightest days by an estimate est(d); the dates at least 3 days ahead: placed before the season begins, every day is.
const lightest = (ds, est, n) => ds.map((d) => [est(d), d]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).slice(0, Math.min(n, ds.length)).map((x) => x[1]);
const demand = (h, d) => { const r = row(h, d); return r ? r[iField] + r[iVital] + r[iOwed] - r[iH] : 1e9; }; // load less hours: high is heavy

// ---- P12: the alderman's year ----
function p12({ noise = 0.2, by = 'equal', grain = 'days', hhNoise = 0.2 } = {}) {
  const rnd = mulberry32(rngSeed * 7919 + Math.round(noise * 1000) + (by === 'fields' ? 17 : 0));
  const R = {}, mk = () => ({ claimed: 0, del: 0, disp: 0, bySize: { 1: [0, 0], 2: [0, 0], '3+': [0, 0] } }); // bySize: [displaced, household-seasons]
  for (const p of ['calendar', 'alderman', 'aldermanCommon', 'household', 'random']) R[p] = mk();
  for (const [vid, V] of Object.entries(C.villages)) {
    const members = HH.filter((h) => h.village === +vid);
    for (let y = 1; y < C.years; y++) for (let s = 0; s < 4; s++) {
      const ds = days(y, s), Hv = sum(ds.map((d) => V.hours[d] || 0)), total = Math.round(Hv / DAYH);
      const hs = members.filter((h) => (h.adults[ds[0]] || 0) > 0).map((h) => ({ h, f: h.fields[ds[0]] || 0, a: h.adults[ds[0]] }));
      if (!total || !hs.length) continue;
      const n = lots(total, hs, by, rnd);
      const cal = lightest(ds, (d) => -(V.hours[d] || 0), SD); // today's calendar: the days the village works now, most hours first
      const noisy = (h, d, base, k) => demand(h, base) * (1 + k * (2 * rnd() - 1)); // an estimate of a day's load, ± k
      const common = lightest(ds, (d) => sum(hs.map((x) => noisy(x.h, d, d - YD, noise))), SD); // one date for all, by last year's curves
      hs.forEach((x, i) => {
        const k = n[i]; if (!k) return;
        const place = {
          calendar: cal.slice(0, k),
          alderman: lightest(ds, (d) => noisy(x.h, d, d - YD, noise), k), // last year's same day, ± noise
          aldermanCommon: common.slice(0, k),
          household: lightest(ds, (d) => noisy(x.h, d, d, hhNoise), k), // the household at its own review sees this year's load, ± noise
          random: lightest(ds, () => rnd(), k),
        };
        for (const [p, dates] of Object.entries(place)) {
          const T = R[p]; let disp = 0;
          if (grain === 'hours') { // the same hours as 2-hour lots on the lightest days by the same estimate, several on one day if needed
            const lot = 2, hrs = k * DAYH, perDay = {};
            for (let left = hrs; left > 0; left -= lot) {
              const base = (dd) => (p === 'household' ? dd : dd - YD); // the calendar's and the random's hours are placed as the alderman's
              const d = lightest(ds, (dd) => demand(x.h, base(dd)) + (perDay[dd] || 0), 1)[0];
              perDay[d] = (perDay[d] || 0) + lot;
            }
            for (const [d, c] of Object.entries(perDay)) { const e = effect(x.h, +d, c); T.del += e.del; disp += e.disp; }
          } else for (const d of dates) { const e = effect(x.h, d, DAYH); T.del += e.del; disp += e.disp; }
          T.claimed += k * DAYH; T.disp += disp; T.bySize[sizeOf(x.a)][0] += disp; T.bySize[sizeOf(x.a)][1]++;
        }
      });
    }
  }
  const res = {};
  for (const [p, T] of Object.entries(R)) res[p] = { claimed: Math.round(T.claimed), displaced: Math.round(T.disp), delivered: pct(T.del / T.claimed),
    dispPerHhSeason: Object.fromEntries(Object.entries(T.bySize).map(([k, [a, b]]) => [k, b ? +(a / b).toFixed(2) : null])) };
  res.alderman.cutVsCalendar = pct(1 - R.alderman.disp / R.calendar.disp);
  res.aldermanCommon.cutVsCalendar = pct(1 - R.aldermanCommon.disp / R.calendar.disp);
  res.household.cutVsCalendar = pct(1 - R.household.disp / R.calendar.disp);
  res.random.cutVsCalendar = pct(1 - R.random.disp / R.calendar.disp);
  return res;
}
out.P12 = { equal: p12({ by: 'equal' }), fields: p12({ by: 'fields' }), hoursGrain: p12({ grain: 'hours' }) };
out.P12noise = {};
for (const k of [0, 0.2, 0.5, 1, 2, 5]) { const r = p12({ noise: k }); out.P12noise[k] = { alderman: r.alderman.cutVsCalendar, common: r.aldermanCommon.cutVsCalendar }; }

// ---- P13: an estate's spring due ----
// The food outlook (design 5.2's "bad"), modelled from the household's outlook on spring's first day: what it holds and expects
// (store + intakes, spoilage off), the expected intakes cut by the crop factor and in proportion to its spring sowing hours lost, walked
// against the need of four seasons; 'bad' when the first short season is met below half (sim/outlook OUTLOOK.little).
function outlook(F, crop, lost) {
  const need = F[3]; let R = F[2] + F[4] * crop * (1 - lost) - F[5];
  for (let k = 0; k < 4; k++) { if (R >= need[k]) { R -= need[k]; continue; } return need[k] > 0 && R / need[k] < 0.5 ? 'bad' : 'short'; }
  return 'safe';
}
// A monotone variant of the trigger (A label is read, never a switch): default while the reckoning covers under 3.5 seasons of need.
function cover(F, crop, lost) { const need = F[3]; let R = F[2] + F[4] * crop * (1 - lost) - F[5], c = 0; for (let k = 0; k < 4; k++) { if (R >= need[k]) { R -= need[k]; c++; } else { c += need[k] > 0 ? R / need[k] : 1; break; } } return c; }
function p13({ N, dates, option, crop, trigger = 'label', villages = 2 }) {
  const isBad = (F, c, l) => (trigger === 'label' ? outlook(F, c, l) === 'bad' : cover(F, c, l) < 3.5);
  const vids = Object.keys(C.villages).map(Number).sort((a, b) => HH.filter((h) => h.village === b).length - HH.filter((h) => h.village === a).length || a - b).slice(0, villages);
  const T = { called: 0, defaulted: 0, commuted: 0, hh: 0, badBefore: 0, bySize: {} };
  const bs = (k) => (T.bySize[k] ||= { sow: 0, disp: 0, called: 0, def: 0, com: 0, hh: 0, surplusHh: 0, surplusDef: 0, poorHh: 0, poorDef: 0 });
  for (let y = 0; y < C.years; y++) for (const h of HH.filter((x) => vids.includes(x.village))) {
    const ds = days(y, 0), a = h.adults[ds[0]] || 0, F = h.food[ds[0]];
    if (!a || !F || !Array.isArray(F) || !row(h, ds[0])) continue;
    const B = bs(sizeOf(a)), sow = sum(ds.map((d) => (row(h, d) ? row(h, d)[iSow] : 0)));
    B.hh++; T.hh++; B.sow += sow;
    const called = dates === 'worst' ? lightest(ds, (d) => -(row(h, d) ? row(h, d)[iSow] : 0), N) : Array.from({ length: N }, (_, k) => ds[Math.floor(((k + 0.5) * SD) / N)]);
    // a day's displaced sowing hours if kept: pooled (substitution: any adult goes) or rigid (the named adult goes, its share is its own)
    const lossOf = (d) => {
      const r = row(h, d); if (!r) return 0;
      if (option === 'none') { // the head is named: its share of the day's work stays its own; the others' slack cannot take it
        const W = r[iField] / a, S = r[iSow] / a, fixed = (r[iVital] + r[iOwed]) / a, A = r[iH] / a;
        const disp = Math.min(W, Math.max(0, W + fixed + Math.min(DAYH, Math.max(0, A - fixed)) - A));
        return W > 0 ? (disp * S) / W : 0;
      }
      return effect(h, d, DAYH).sow;
    };
    const surplus = F[2] + F[4] * crop - F[5] - sum(F[3]) >= 3 * N; // rations to spare after a year's need, at the crop of the year
    if (surplus) B.surplusHh++; else B.poorHh++;
    const loss = called.map(lossOf);
    if (isBad(F, crop, 0)) T.badBefore++;
    let kept = called.map(() => true);
    if (option === 'commute' && surplus && sum(loss) > 0) { T.commuted += N; B.com += N; T.called += N; B.called += N; continue; }
    const lostFrac = () => (sow > 0 ? Math.min(1, sum(loss.filter((_, i) => kept[i])) / sow) : 0);
    // the default rule: while keeping the due puts the outlook in 'bad', short the day that costs most sowing (a judgement, not a die)
    const order = loss.map((x, i) => [x, i]).filter((x) => x[0] > 0).sort((p, q) => q[0] - p[0] || p[1] - q[1]);
    for (const [, i] of order) { if (!isBad(F, crop, lostFrac())) break; kept[i] = false; }
    const def = kept.filter((k) => !k).length;
    T.called += N; T.defaulted += def; B.called += N; B.def += def; B.disp += sum(loss.filter((_, i) => kept[i]));
    if (surplus) B.surplusDef += def; else B.poorDef += def;
  }
  const small = ['1', '2'].reduce((s, k) => s + (T.bySize[k] ? T.bySize[k].def : 0), 0);
  return {
    households: T.hh, badBeforeShare: pct(T.badBefore / T.hh), defaults: pct(T.defaulted / T.called), commuted: pct(T.commuted / T.called),
    defaultsSmallShare: T.defaulted ? pct(small / T.defaulted) : null,
    bySize: Object.fromEntries(Object.entries(T.bySize).map(([k, B]) => [k, { hh: B.hh, sowDisplaced: pct(B.disp / Math.max(1e-9, B.sow)), defaults: pct(B.def / Math.max(1, B.called)),
      commuted: pct(B.com / Math.max(1, B.called)), surplusHh: B.surplusHh, defPoor: pct(B.poorDef / Math.max(1, B.poorHh * N)) }])),
  };
}
out.P13 = {};
for (const dates of ['worst', 'spread']) for (const option of ['none', 'substitute', 'commute']) for (const N of [1, 3, 6]) for (const [yr, crop] of [['normal', 1], ['lean', 0.6]])
  out.P13[`${dates}/${option}/N${N}/${yr}`] = p13({ N, dates, option, crop });
for (const trigger of ['label', 'cover']) for (const option of ['substitute', 'commute']) for (const N of [1, 3, 6]) for (const [yr, crop] of [['normal', 1], ['lean', 0.6]])
  out.P13[`all/${trigger}/worst/${option}/N${N}/${yr}`] = p13({ N, dates: 'worst', option, crop, trigger, villages: 99 });
// the counters a day (P15's baseline)
const cs = C.counters.slice(1);
out.counters = { dayPair: Math.round(sum(cs.map((c) => c.dayPair)) / cs.length), oppAsk: Math.round(sum(cs.map((c) => c.oppAsk)) / cs.length), dayTake: Math.round(sum(cs.map((c) => c.dayTake)) / cs.length) };

if (process.argv.includes('--json')) console.log(JSON.stringify(out, null, 1));
else {
  console.log(`== ${out.file} (model seed ${rngSeed})`);
  console.log('P10', JSON.stringify(out.P10));
  for (const [k, v] of Object.entries(out.P12)) console.log('P12', k, JSON.stringify(v));
  console.log('P12 noise -> cut vs calendar (each, common):', JSON.stringify(out.P12noise));
  for (const [k, v] of Object.entries(out.P13)) console.log('P13', k, JSON.stringify(v));
  console.log('counters a day', JSON.stringify(out.counters));
}
