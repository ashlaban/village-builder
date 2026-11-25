// Study B of the plans mocks: the analysis and the standalone planner, over a file record.js wrote. It reads no game state.
//   1. the record's own numbers: today's allotments, reviews and pairs a household-day (P6's baseline), the shares of adult working
//      hours by claimant and how often a 0.85 ceiling would bind (P10), member-days that begin with yesterday's type of work (P7's 72%);
//   2. the forecaster (P5): at the start of each six-day window, the household's task-hours by kind and day from its seasonal plan's
//      steps, its due kinds and its work at its recent rate, scored against what it worked;
//   3. two policies over the same recorded demand (the household's jobs, with the pawn-hours its members spent on each): `daily`
//      (today's allotment in small) and `weekly` (the design's default author, 5.4, with W days), with and without disruptions (P6 to P9,
//      P11).
// node docs/mocks/plans/week/planner.js FILE [--json OUT] [--rngSeed 1]
// Every random draw comes from mulberry32(--rngSeed). No game code.
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '../../../..');
const file = process.argv[2], arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i >= 0 ? process.argv[i + 1] : d; };
const jsonOut = arg('json', null), RNG_SEED = Number(arg('rngSeed', 1));
function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const rnd = mulberry32(RNG_SEED);
const VB = require(path.join(root, 'src/load.js')), { ROLES } = VB['sim/roles'];
const lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const head = lines[0], KIND = head.kinds;
const DAYH = 24, W0 = 6, W1 = 18, EVENING = 20, SEASON_DAYS = 12; // MATCH.day.evening: a vital kind may be begun until 20:00
const sum = (xs) => xs.reduce((a, b) => a + b, 0), pct = (a, b) => (b > 0 ? +(100 * a / b).toFixed(1) : null), r1 = (x) => +x.toFixed(2);
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };
const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
const DUE = new Set(['water', 'cook', 'milk', 'fodder', 'herd', 'drink', 'boothwater']);
const VITAL = new Set(['water', 'cook', 'wood', 'firewood', 'boothwater', 'drink']);
const WINDOWED = new Set(['plow', 'sow', 'weed', 'reap', 'haul', 'rake', 'mow', 'hay', 'fetchHaul', 'fetchHay']);
const FIELD = WINDOWED; // what a wet day stops
const rank = (role, kind) => { const R = ROLES[role]; if (!R) return 1; const e = R.except && R.except[kind]; return Math.max(0.5, e ?? (R.work && R.work[KIND[kind].type]) ?? 0); };

// ---- the record, by household ----
const days = new Map(), hours = new Map(), jobs = new Map(), counts = [];
const at = (m, k, mk) => { let v = m.get(k); if (!v) m.set(k, v = mk()); return v; };
for (const o of lines) {
  if (o.type === 'day') at(days, o.hh, () => new Map()).set(o.d, o);
  else if (o.type === 'hours') at(hours, o.hh, () => new Map()).set(o.d, o);
  else if (o.type === 'job') at(jobs, o.hh, () => []).push(o);
  else if (o.type === 'count') counts.push(o);
}
const lastDay = Math.max(...counts.map((c) => c.d));
const seasonOf = (d) => Math.floor(d / SEASON_DAYS) % 4;
const sizeOf = (dr) => { const n = dr.members.filter((m) => m.adult).length; return n <= 1 ? '1' : n === 2 ? '2' : '3+'; };
// the kinds' hours a household worked a day, by its members, in and out of the working hours (walking included)
const kindHours = new Map(); // hh -> d -> {kind: h}
for (const [hh, byD] of hours) for (const [d, o] of byD) {
  const k = {};
  for (const part of [o.m, o.off]) for (const m of Object.values(part)) for (const [c, h] of Object.entries(m))
    if (c.startsWith('h:')) { const kind = c.slice(2).replace('~', ''); k[kind] = (k[kind] || 0) + h; }
  at(kindHours, hh, () => new Map()).set(d, k);
}
const out = { file: path.basename(file), scenario: head.scenario, seed: head.seed, rngSeed: RNG_SEED };

// ---- 1. the record's own numbers ----
{
  let hhDays = 0, allots = 0, reviews = 0, same = 0, sameN = 0;
  for (const [hh, byD] of hours) for (const [d, o] of byD) {
    if (!days.get(hh) || !days.get(hh).get(d)) continue;
    hhDays++; allots += o.allots; reviews += o.reviews;
    const y = byD.get(d - 1);
    if (y) for (const [id, t] of Object.entries(o.first)) if (y.first[id] !== undefined) { sameN++; if (y.first[id] === t) same++; }
  }
  const pairs = sum(counts.map((c) => c.dayPair)), hhd = sum(counts.map((c) => c.households));
  out.record = { householdDays: hhDays, allotsPerHHDay: r1(allots / hhDays), reviewsPerHHDay: r1(reviews / hhDays),
    dayPairPerHHDay: r1(pairs / hhd), oppAskPerHHDay: r1(sum(counts.map((c) => c.oppAsk)) / hhd), sameTypeAsYesterday: pct(same, sameN) };
}
// P10: shares of adult working hours (12 a day times adults present), by season and household size; the ceiling over 6-day windows
{
  const acc = {}; // `${season}|${size}` -> {hands, hh, village, owed, neither}
  const mw = {}; // ceiling: member-weeks over 0.85, by `${season}|${size}`
  for (const [hh, byD] of hours) {
    const dmap = days.get(hh); if (!dmap) continue;
    const week = new Map(); // `${id}|${w}` -> [hours on hh, available]
    for (const [d, o] of byD) {
      const dr = dmap.get(d); if (!dr) continue;
      const key = `${seasonOf(d)}|${sizeOf(dr)}`, a = (acc[key] ||= { hands: 0, hh: 0, village: 0, owed: 0, neither: 0 });
      for (const m of dr.members) {
        if (!m.adult) continue;
        a.hands += 12;
        const h = o.m[m.id] || {};
        let mine = 0;
        for (const [c, x] of Object.entries(h)) {
          if (c.startsWith('h:')) { a.hh += x; mine += x; } else if (c.startsWith('v:')) a.village += x;
          else if (c === 'owed' || c === 'lent' || c === 'other') a.owed += x; else a.neither += x;
        }
        const wk = `${m.id}|${Math.floor(d / 6)}`, e = week.get(wk) || [0, 0, key];
        e[0] += mine; e[1] += m.ill ? 0 : 12; week.set(wk, e);
      }
    }
    for (const [, [mine, avail, key]] of week) { const e = (mw[key] ||= [0, 0, 0]); e[1]++; if (avail > 0 && mine > 0.85 * avail) e[0]++; if (avail > 0 && mine > 0.7 * avail) e[2]++; }
  }
  out.P10 = { shares: Object.fromEntries(Object.entries(acc).sort().map(([k, a]) => [k, { hh: pct(a.hh, a.hands), village: pct(a.village, a.hands),
    owed: pct(a.owed, a.hands), neither: pct(a.neither, a.hands), adultDays: a.hands / 12 }])),
  ceiling: Object.fromEntries(Object.entries(mw).sort().map(([k, [o, n, o7]]) => [k, { over85: pct(o, n), over70: pct(o7, n), memberWeeks: n }])) };
  const all = Object.values(acc), bySeason = SEASONS.map((s, i) => { const xs = Object.entries(acc).filter(([k]) => k.startsWith(i + '|')).map(([, a]) => a);
    const H = sum(xs.map((a) => a.hands)); return { season: s, hh: pct(sum(xs.map((a) => a.hh)), H), village: pct(sum(xs.map((a) => a.village)), H),
      owed: pct(sum(xs.map((a) => a.owed)), H), neither: pct(sum(xs.map((a) => a.neither)), H) }; });
  const H = sum(all.map((a) => a.hands));
  out.P10.bySeason = bySeason;
  out.P10.year = { village: pct(sum(all.map((a) => a.village)), H), owed: pct(sum(all.map((a) => a.owed)), H) };
  const ov = Object.values(mw); out.P10.ceilingAll = pct(sum(ov.map((e) => e[0])), sum(ov.map((e) => e[1])));
}

// ---- 2. the forecaster (P5) ----
// walking and other hours on a job against its kind's estimate: the head's ratio, by kind, from the jobs done (the whole record: a
// slight foresight the real head would gather over time)
const ratio = {};
{
  const xs = {};
  for (const js of jobs.values()) for (const j of js) { const w = sum(Object.values(j.by)) + sum(Object.values(j.walk)); if (j.est > 0 && w > 0) (xs[j.kind] ||= []).push(w / j.est); }
  for (const [k, v] of Object.entries(xs)) ratio[k] = median(v);
}
function forecast(hh, D, W) {
  const kh = kindHours.get(hh), dr = days.get(hh) && days.get(hh).get(D), P = new Map();
  if (!kh || !dr) return P;
  const put = (k, hours, dayset) => { const e = P.get(k); if (e) { e.hours = Math.max(e.hours, hours); for (const x of dayset) e.days.add(x); } else P.set(k, { hours, days: new Set(dayset) }); };
  const all = Array.from({ length: W }, (_, i) => D + i);
  // recent rate: the six days before
  const rec = {};
  for (let d = D - 6; d < D; d++) { const k = kh.get(d); if (!k) continue; for (const [kind, h] of Object.entries(k)) { const e = (rec[kind] ||= [0, 0]); e[0] += h; e[1]++; } }
  for (const [kind, [h, n]] of Object.entries(rec)) if (DUE.has(kind) || n >= 3) put(kind, h / 6 * W, all);
  // open jobs at the window's start: their hours left, by the head's ratio
  const open = {};
  for (const [, kind, left] of dr.open) if (left > 0) open[kind] = (open[kind] || 0) + left * (ratio[kind] || 1);
  for (const [kind, h] of Object.entries(open)) put(kind, h, all);
  // the seasonal plan's steps: last year's same days where there was a last year, else the twelve days before at their rate
  const tpl = (days.get(hh).get(D + 1) || dr).steps; // the season's template: on the window's first day the head has made it
  for (const kind of tpl) {
    if (P.has(kind)) continue;
    let h = 0, have = false;
    if (D - 48 >= 0) { have = true; for (let d = D - 48; d < D - 48 + W; d++) h += ((kh.get(d) || {})[kind] || 0); }
    if (!have) for (let d = D - 12; d < D; d++) h += ((kh.get(d) || {})[kind] || 0) * W / 12;
    put(kind, h, all);
  }
  return P;
}
{
  const by = {}, byKind = {}; // season -> [foreseen, kindOnly, total]; kind -> [foreseen, total]
  for (const [hh, kh] of kindHours) {
    const dmap = days.get(hh); if (!dmap) continue;
    for (let D = 6; D + 6 <= lastDay; D += 6) {
      if (!dmap.has(D)) continue;
      const P = forecast(hh, D, 6), A = {};
      for (let d = D; d < D + 6; d++) for (const [k, h] of Object.entries(kh.get(d) || {})) (A[k] ||= {})[d] = h;
      const s = (by[SEASONS[seasonOf(D)]] ||= [0, 0, 0]);
      for (const [k, perDay] of Object.entries(A)) {
        const tot = sum(Object.values(perDay)), p = P.get(k), hoursOK = p && Math.abs(p.hours - tot) <= 0.25 * tot, loose = p && Math.abs(p.hours - tot) <= 0.5 * tot;
        for (const [d, h] of Object.entries(perDay)) {
          const kindOK = p && [+d - 1, +d, +d + 1].some((x) => p.days.has(x));
          s[2] += h; (byKind[k] ||= [0, 0, 0])[1] += h;
          if (kindOK) { s[1] += h; byKind[k][2] += h; }
          if (kindOK && hoursOK) { s[0] += h; byKind[k][0] += h; }
          if (kindOK && loose) s[3] = (s[3] || 0) + h;
        }
      }
    }
  }
  const T = Object.values(by);
  out.P5 = { foreseen: pct(sum(T.map((x) => x[0])), sum(T.map((x) => x[2]))), within50: pct(sum(T.map((x) => x[3] || 0)), sum(T.map((x) => x[2]))), kindOnly: pct(sum(T.map((x) => x[1])), sum(T.map((x) => x[2]))),
    bySeason: Object.fromEntries(Object.entries(by).map(([s, [f, k, t]]) => [s, { foreseen: pct(f, t), kindOnly: pct(k, t) }])),
    surprises: Object.entries(byKind).map(([k, [f, t, ko]]) => ({ kind: k, hours: Math.round(t), unforeseenHours: Math.round(t - f), foreseen: pct(f, t), kindOnly: pct(ko, t) }))
      .sort((a, b) => b.unforeseenHours - a.unforeseenHours).slice(0, 12) };
}

// ---- 3. the standalone planner ----
// A household's demand: each job its members spent pawn-hours on (work and walk), opened at its posting, with a deadline: a due or vital
// kind by the end of its day's work (wood two days), a windowed kind by the end of its season (at least three days), others none.
function demandOf(hh) {
  const out = [];
  for (const j of jobs.get(hh) || []) {
    const W = sum(Object.values(j.by)) + sum(Object.values(j.walk));
    if (W < 0.05) continue;
    const open = j.posted, d = Math.floor(open / DAYH), endOfDay = (open % DAYH) >= EVENING ? (d + 1) * DAYH + EVENING : d * DAYH + EVENING;
    let deadline = Infinity;
    if (j.kind === 'wood' || j.kind === 'firewood') deadline = open + 48;
    else if (DUE.has(j.kind) || VITAL.has(j.kind)) deadline = endOfDay;
    else if (WINDOWED.has(j.kind)) deadline = Math.max((Math.floor(d / SEASON_DAYS) + 1) * SEASON_DAYS * DAYH, open + 72);
    out.push({ id: j.id, kind: j.kind, type: KIND[j.kind].type, open, W, est: j.est * (ratio[j.kind] || 1), dist: j.dist || 0,
      hands: KIND[j.kind].hands ?? 1, deadline, vital: VITAL.has(j.kind), windowed: WINDOWED.has(j.kind), due: DUE.has(j.kind),
      realFirst: j.first, realBy: j.by });
  }
  return out.sort((a, b) => a.open - b.open || a.id - b.id);
}
// members' hours a day for the household's own work: their rate times 12, less what the record shows went to others' claims or away
function capacityOf(hh, d, dis) {
  const dr = days.get(hh).get(d), o = (hours.get(hh) || new Map()).get(d), cap = {};
  for (const m of dr.members) {
    if (m.rate <= 0) continue;
    const h = (o && o.m[m.id]) || {};
    let gone = 0;
    for (const [c, x] of Object.entries(h)) if (c.startsWith('v:') || c === 'owed' || c === 'lent' || c === 'other' || c === 'away' || c === 'abed') gone += x;
    cap[m.id] = Math.max(0, (m.ill ? 0 : 12 * m.rate) - gone);
    if (dis && dis.who === m.id && d >= dis.from && d < dis.until) cap[m.id] = 0;
  }
  return cap;
}
const urgency = (t, x) => (x.vital ? 3 : x.windowed ? (x.deadline - t < 48 ? 2.5 : 1.5) : x.due ? 2 : 1);

// One household over days [from, to) under a policy. opts: {policy: 'daily'|'weekly', W, dis: {kind, who, from, until, day}}
function run(hh, demand, from, to, opts) {
  const tasks = demand.filter((x) => x.open < to * DAYH && x.open >= from * DAYH - 3 * DAYH).map((x) => ({ ...x, left: x.W, doneOK: 0, first: null, lastBy: null, who: null, fixedWho: null, moved: 0, flagged: false }));
  const S = { pairs: 0, allots: 0, inTurn: 0, outTurn: 0, outDay: -1, moved: 0, kept: 0, stale: 0, staleHours: 0, firstType: new Map(), sameType: 0, sameN: 0,
    switches: 0, absorbed: 0, pooled: 0, slotted: 0, dropped: [], lowered: 0, disReview: 0, afterOut: 0, worked: {}, cause: { unforeseen: 0, range: 0 }, unforeseenKinds: {} };
  const dmap = days.get(hh), cad = (dmap.get(from) && dmap.get(from).cad) || 1, offset = hh % cad;
  let lists = {}, holder = {}, ph = []; // daily: lists of task refs; weekly: kind->member of last review, placeholders
  const membersOf = (d) => dmap.get(d).members.filter((m) => m.rate > 0);
  let active = [];
  const openAt = (t) => active.filter((x) => x.open <= t && x.left > 1e-9);
  // daily: today's allotment in small (best fit first, a further hand at 0.8, a 6-hour horizon, then the rest by fit)
  function allot(t, ms, cap) {
    S.allots++;
    const ts = openAt(t), pairs = [];
    S.pairs += ts.length * ms.length;
    // a vital task due today goes before all others whatever its fit (sim/day: the fetch first, the task with a deadline today calls)
    for (const x of ts) for (const m of ms) pairs.push([rank(m.role, x.kind) * urgency(t, x) + (x.vital && x.deadline - t <= 12 ? 100 : 0), m.id, x, 0]);
    pairs.sort((a, b) => b[0] - a[0] || a[1] - b[1] || a[2].id - b[2].id);
    const hcap = Object.fromEntries(ms.map((m) => [m.id, Math.min(6, cap[m.id] || 0)])), manned = new Map(), L = Object.fromEntries(ms.map((m) => [m.id, []])), rest = [];
    for (let i = 0; i < pairs.length; i++) {
      const [s, id, x, k] = pairs[i], m = manned.get(x) || [0, 0];
      if (m[1] >= x.hands || hcap[id] <= 0 || m[0] >= x.left) { rest.push(pairs[i]); continue; }
      if (m[1] > k) { const again = [s * 0.8, id, x, m[1]]; let j = i + 1; while (j < pairs.length && pairs[j][0] >= again[0]) j++; pairs.splice(j, 0, again); continue; }
      const h = Math.min(hcap[id], x.left - m[0]); hcap[id] -= h; manned.set(x, [m[0] + h, m[1] + 1]);
      if (x.vital && x.deadline - t <= 12) L[id].unshift(x); else L[id].push(x);
    }
    // the heads of the lists (sim/day man: a fetch first, then the task with a deadline today), of the tasks given in the first pass:
    // due today, by deadline; then the rest, by fit
    const today = (x) => x.vital && x.deadline - t <= 12;
    for (const id of Object.keys(L)) { const hd = L[id].filter(today).sort((a, b) => a.deadline - b.deadline); L[id] = hd.concat(L[id].filter((x) => !today(x))); }
    for (const [, id, x] of rest) if (!L[id].includes(x)) L[id].push(x);
    lists = L;
  }
  // weekly: the design's default author over W days
  function review(t, ms, inTurn, W) {
    const d = Math.floor(t / DAYH);
    if (inTurn) S.inTurn++; else { S.outTurn++; S.outDay = d; }
    const capW = {}; for (const m of ms) capW[m.id] = 0;
    for (let k = 0; k < W && d + k < to; k++) { const c = capacityOf(hh, d + k, opts.dis); for (const m of ms) capW[m.id] += 0.85 * (c[m.id] || 0); }
    const open = openAt(t);
    // placeholders: the forecast's kinds less what is open of them
    const P = forecast(hh, d, W), openK = {};
    for (const x of open) openK[x.kind] = (openK[x.kind] || 0) + x.left;
    for (const p of ph) if (p.left > 1e-9 && p.day + 1 < d) { S.stale++; S.staleHours += p.left; }
    const oldPh = ph; ph = [];
    for (const [kind, p] of P) { const h = p.hours - (openK[kind] || 0); if (h > 0.5 && !DUE.has(kind)) ph.push({ kind, day: d + Math.floor(W / 2), days: p.days, hours: h, left: h, who: null, ph: true, deadline: (d + W) * DAYH, vital: VITAL.has(kind), windowed: WINDOWED.has(kind) }); }
    for (const p of oldPh) if (p.left > 1e-9 && p.day + 1 >= d && !ph.some((q) => q.kind === p.kind)) { S.stale++; S.staleHours += p.left; }
    const steps = open.concat(ph).sort((a, b) => a.deadline - b.deadline || urgency(t, b) - urgency(t, a) || (a.id || 0) - (b.id || 0));
    const fresh = inTurn ? steps.filter((x) => x.ph || x.who === null).length : steps.length;
    S.pairs += fresh * ms.length;
    const dropped = [];
    for (const x of steps) {
      const need = x.ph ? x.left : x.left;
      let best = null, bs = -1;
      for (const m of ms) { if (capW[m.id] <= 0) continue; const s = rank(m.role, x.kind); if (s > bs) { bs = s; best = m; } }
      if (!best) { if (!x.ph) { dropped.push(x); if (x.who !== null && !x.fixedWho) { x.who = null; } } continue; }
      // the holder of the step, or of its kind at the last review, keeps it unless the gain exceeds the handover (the walk to the site)
      const prev = x.who ?? holder[x.kind];
      const pm = prev !== undefined && prev !== null ? ms.find((m) => m.id === prev && capW[m.id] > 0) : null;
      let who = best;
      if (pm && pm !== best) { const gain = (bs - rank(pm.role, x.kind)) / 10 * Math.min(need, 12), cost = 2 * (x.dist || 0) * STEP_H + 0.5; if (gain <= cost) who = pm; }
      if (!x.ph && x.who !== null && x.who !== who.id) { S.moved++; } else if (!x.ph && x.who !== null) S.kept++;
      x.who = who.id; let rest = need - Math.max(0, capW[who.id]); capW[who.id] -= need; if (!x.ph) holder[x.kind] = who.id;
      // a further hand where one member's claimed hours of the window do not cover the step (5.4: "a further hand counts 0.8 as today")
      x.helpers = [];
      while (!x.ph && rest > 0.5 && 1 + x.helpers.length < x.hands) {
        let h = null, hs = -1;
        for (const m of ms) if (m !== who && !x.helpers.includes(m.id) && capW[m.id] > 0 && rank(m.role, x.kind) * 0.8 > hs) { hs = rank(m.role, x.kind) * 0.8; h = m; }
        if (!h) break;
        const take = Math.min(capW[h.id], rest); capW[h.id] -= take; rest -= take; x.helpers.push(h.id);
      }
    }
    return dropped;
  }
  // a task opened between reviews (weekly): a due kind slotted to its holder; a foreseen one to its placeholder's member; else a
  // review out of turn (one a day), else the pool, which members take in their own hours
  function arrive(x, t, ms) {
    const d = Math.floor(t / DAYH);
    if (x.due) { S.slotted++; S.pairs += ms.length; x.who = holder[x.kind] ?? null; if (x.who === null) { let b = null, bs = -1; for (const m of ms) { const s = rank(m.role, x.kind); if (s > bs) { bs = s; b = m; } } x.who = b && b.id; holder[x.kind] = x.who; } return; }
    const p = ph.find((q) => q.kind === x.kind && q.left > 1e-9 && [...q.days].some((dd) => Math.abs(dd - d) <= 1));
    if (p) { S.absorbed++; S.pairs += 1; x.who = p.who; p.left = Math.max(0, p.left - x.W); return; }
    if (S.outDay !== d && !opts.pool) { S.cause.unforeseen++; S.unforeseenKinds[x.kind] = (S.unforeseenKinds[x.kind] || 0) + 1; review(t, ms, false, opts.W); return; }
    S.pooled++;
  }
  let next = 0;
  const res = { vitalUnmet: 0, vitalHours: 0, windowsMissed: 0, windowed: 0, idle: 0 };
  for (let d = from; d < to; d++) {
    if (!dmap.has(d)) continue;
    const ms = membersOf(d), capDay = capacityOf(hh, d, opts.dis), cap = capDay, wet = opts.dis && opts.dis.kind === 'wet' && opts.dis.day === d;
    const isPeak = (x) => (x.vital && x.deadline - d * DAYH <= 36) || (x.windowed && x.deadline - d * DAYH <= 48);
    // the neighbour's ask: one adult for the day, yes when none of its work today is vital or closing
    if (opts.dis && opts.dis.kind === 'ask' && opts.dis.day === d) {
      const a = ms.find((m) => m.id === opts.dis.who);
      if (a) {
        const mine = opts.policy === 'weekly' ? openAt(d * DAYH + W0).filter((x) => x.who === a.id) : (lists[a.id] || []).filter((x) => x.left > 1e-9);
        const yes = !mine.some(isPeak); S.askYes = yes; if (yes) cap[a.id] = 0;
      }
    }
    const disToday = opts.dis && opts.dis.kind !== 'wet' && opts.dis.kind !== 'ask' && d === opts.dis.from;
    if (opts.policy === 'weekly') {
      if (disToday) { S.disReview = 1; const dr = review(d * DAYH + W0, ms, false, opts.W); S.dropped.push(...dr.map((x) => x.deadline)); if (dr.some((x) => x.windowed)) S.lowered = 1;
        // the shortfall: windowed hours left against the members' hours until the season ends, less the due work's
        const end = (Math.floor(d / SEASON_DAYS) + 1) * SEASON_DAYS; let capH = 0; for (let k = d; k < end; k++) capH += sum(Object.values(capacityOf(hh, k, opts.dis))) * 0.85;
        const need = sum(openAt(d * DAYH + W0).filter((x) => x.windowed || x.due || x.vital).map((x) => x.left)) + sum(ph.filter((p) => p.windowed).map((p) => p.left)) + 2 * ms.length * (end - d);
        if (need > capH) S.lowered = 1; }
      else if ((d - offset) % cad === 0 || d === from) review(d * DAYH + W0, ms, true, opts.W);
    }
    const eve = Object.fromEntries(ms.map((m) => [m.id, 2 * m.rate])); // the evening's hours, for vital kinds only
    for (let h = W0; h < EVENING; h++) {
      const t = d * DAYH + h, evening = h >= W1;
      const cap = evening ? eve : capDay;
      // the tasks that opened in the hour
      const opened = [];
      while (next < tasks.length && tasks[next].open <= t) { const x = tasks[next++]; opened.push(x); active.push(x); }
      active = active.filter((x) => x.left > 1e-9);
      if (opts.policy === 'daily') {
        if (h === W0 || h === 14) allot(t, ms, cap);
        else if (opened.length) {
          // the slot (sim/day slotIn): a due task weighed alone, to the best fit with hours left, on the others' lists after; no hand
          // with hours left, or a task of another kind: the day allotted anew
          let anew = !opened.every((x) => x.due);
          if (!anew) for (const x of opened) {
            S.pairs += ms.length; let b = null, bs = -1;
            for (const m of ms) { const s = rank(m.role, x.kind); if ((cap[m.id] || 0) >= 0.5 && s > bs) { bs = s; b = m; } }
            if (!b) { anew = true; break; }
            for (const m of ms) if (m === b) (lists[m.id] ||= []).unshift(x); else (lists[m.id] ||= []).push(x);
          }
          if (anew) allot(t, ms, cap);
        }
      } else for (const x of opened) arrive(x, t, ms);
      // each member works an hour
      const busy = new Map();
      for (const m of ms) {
        if ((cap[m.id] || 0) < 0.05) continue;
        const can = (x) => x.left > 1e-9 && x.open <= t && (busy.get(x) || 0) < x.hands && !(wet && FIELD.has(x.kind)) && (!evening || x.vital);
        let x = null;
        if (opts.policy === 'daily') x = (lists[m.id] || []).find(can) || null;
        else {
          const mine = active.filter((y) => (y.who === m.id || (y.helpers && y.helpers.includes(m.id))) && can(y)).sort((a, b) => (b.vital && b.deadline - t <= 12) - (a.vital && a.deadline - t <= 12) || a.deadline - b.deadline || a.open - b.open);
          x = mine[0] || null;
          if (!x) { // own hours given: the open steps no one holds, then a hand on another's
            const pool = active.filter((y) => can(y) && (y.who === null || !ms.some((q) => q.id === y.who && (cap[q.id] || 0) >= 0.05)));
            pool.sort((a, b) => rank(m.role, b.kind) * urgency(t, b) - rank(m.role, a.kind) * urgency(t, a) || a.id - b.id);
            x = pool[0] || active.filter(can).sort((a, b) => a.deadline - b.deadline || a.id - b.id)[0] || null;
          }
        }
        if (!x) { if (!evening) res.idle += Math.min(1, cap[m.id]); continue; }
        const w = Math.min(1, cap[m.id], x.left); cap[m.id] -= w; x.left -= w; if (t + 1 <= x.deadline) x.doneOK += w; busy.set(x, (busy.get(x) || 0) + 1);
        if (x.first === null) x.first = t;
        if (x.lastBy !== null && x.lastBy !== m.id) S.switches++;
        x.lastBy = m.id; S.worked[m.id + '|' + x.kind] = (S.worked[m.id + '|' + x.kind] || 0) + w;
        const fk = m.id + '|' + d; if (!S.firstType.has(fk)) S.firstType.set(fk, x.type);
      }
      // the estimate's range: a step past 1.25 of its estimate, or done under 0.75 of it, asks a review out of turn (one a day)
      if (opts.policy === 'weekly') for (const x of active) {
        if (x.flagged || x.est <= 0 || x.due) continue;
        const spent = x.W - x.left;
        if (spent > 1.25 * x.est || (x.left <= 1e-9 && spent < 0.75 * x.est)) { x.flagged = true; if (S.outDay !== d) { S.cause.range++; review(t, ms, false, opts.W); } }
      }
    }
    for (const m of ms) { const y = S.firstType.get(m.id + '|' + (d - 1)), td = S.firstType.get(m.id + '|' + d); if (y !== undefined && td !== undefined) { S.sameN++; if (y === td) S.sameType++; } }
  }
  for (const x of tasks) {
    if (x.open < from * DAYH || x.open >= to * DAYH) continue;
    // unmet: the hours not done by the deadline (work after it does not count)
    if (x.vital && x.deadline <= to * DAYH) { res.vitalHours += x.W; res.vitalUnmet += Math.max(0, x.W - x.doneOK); }
    if (x.windowed && x.deadline <= to * DAYH) { res.windowed++; if (x.doneOK < x.W - 0.05) res.windowsMissed++; }
  }
  return { S, res, tasks };
}
// the walking hours a step of distance: the run's own, from the jobs worked by one member with a distance (walk / 2 / distance)
const STEP_H = (() => { const xs = []; for (const js of jobs.values()) for (const j of js) { const ids = Object.keys(j.walk); if (ids.length === 1 && j.dist >= 3 && Object.keys(j.by).length === 1) xs.push(j.walk[ids[0]] / 2 / j.dist); } return median(xs) || 0.1; })();
out.stepHours = r1(STEP_H);

module.exports = { run, demandOf, days, HHS: null };
// ---- the driver ----
const HHS = [...days.keys()].filter((hh) => days.get(hh).size >= 24 && (jobs.get(hh) || []).length);
const FROM = 6, TO = lastDay + 1;
function whole(policy, W, pool = false) {
  const agg = { days: 0, pairs: 0, allots: 0, inTurn: 0, outTurn: 0, moved: 0, kept: 0, stale: 0, staleHours: 0, sameType: 0, sameN: 0, switches: 0,
    absorbed: 0, pooled: 0, slotted: 0, cause: { unforeseen: 0, range: 0 }, unforeseenKinds: {}, unmetKind: {}, vitalUnmet: 0, vitalHours: 0, windowsMissed: 0, windowed: 0, idle: 0, worked: new Map(), first: new Map() };
  for (const hh of HHS) {
    const dem = demandOf(hh), dmap = days.get(hh), from = Math.max(FROM, Math.min(...dmap.keys())), to = Math.min(TO, Math.max(...dmap.keys()) + 1);
    const { S, res, tasks } = run(hh, dem, from, to, { policy, W, pool });
    let n = 0; for (let d = from; d < to; d++) if (dmap.has(d)) n++;
    agg.days += n;
    for (const k of ['pairs', 'allots', 'inTurn', 'outTurn', 'moved', 'kept', 'stale', 'staleHours', 'sameType', 'sameN', 'switches', 'absorbed', 'pooled', 'slotted']) agg[k] += S[k];
    for (const k of ['vitalUnmet', 'vitalHours', 'windowsMissed', 'windowed', 'idle']) agg[k] += res[k];
    for (const [k, h] of Object.entries(S.worked)) agg.worked.set(hh + '|' + k, h);
    for (const x of tasks) { agg.first.set(x.id, x.first); if (x.vital && x.deadline <= to * DAYH && x.open >= from * DAYH) agg.unmetKind[x.kind] = r1((agg.unmetKind[x.kind] || 0) + x.W - x.doneOK); }
    agg.cause.unforeseen += S.cause.unforeseen; agg.cause.range += S.cause.range;
    for (const [k, v] of Object.entries(S.unforeseenKinds)) agg.unforeseenKinds[k] = (agg.unforeseenKinds[k] || 0) + v;
  }
  return agg;
}
const runs = { daily: whole('daily', 1) };
for (const W of [3, 4, 6, 12]) runs['w' + W] = whole('weekly', W);
runs.w6pool = whole('weekly', 6, true); // a variant, not the design: unforeseen arrivals are pooled to own hours, never reviewed out of turn
const summ = (a) => ({ reviewsPerHHDay: r1((a.inTurn + a.outTurn) / a.days), inTurn: r1(a.inTurn / a.days), outTurn: r1(a.outTurn / a.days),
  allotsPerHHDay: r1(a.allots / a.days), pairsPerHHDay: Math.round(a.pairs / a.days), moved: pct(a.moved, a.moved + a.kept), sameType: pct(a.sameType, a.sameN),
  vitalUnmetPct: pct(a.vitalUnmet, a.vitalHours), windowsMissedPct: pct(a.windowsMissed, a.windowed), windowed: a.windowed, staleStepsPerHHDay: r1(a.stale / a.days),
  staleHoursPerHHDay: r1(a.staleHours / a.days), switchesPerHHDay: r1(a.switches / a.days), absorbed: a.absorbed, pooled: a.pooled, slotted: a.slotted, idlePerHHDay: r1(a.idle / a.days), outTurnUnforeseen: r1(a.cause.unforeseen / a.days), outTurnRange: r1(a.cause.range / a.days),
  unforeseenKinds: Object.entries(a.unforeseenKinds).sort((x, y) => y[1] - x[1]).slice(0, 6).map(([k, v]) => `${k} ${v}`).join(', '), unmetKind: a.unmetKind });
out.policies = Object.fromEntries(Object.entries(runs).map(([k, a]) => [k, summ(a)]));
// the baseline's fairness: the mock daily's member-kind hours against the record's (working hours, own household's tasks)
{
  const real = new Map();
  for (const hh of HHS) for (const [d, o] of hours.get(hh) || []) { if (d < FROM) continue; for (const [id, m] of Object.entries(o.m)) for (const [c, h] of Object.entries(m)) if (c.startsWith('h:')) { const k = `${hh}|${id}|${c.slice(2).replace('~', '')}`; real.set(k, (real.get(k) || 0) + h); } }
  const cmp = (mock) => { let diff = 0, tot = 0, mt = 0; const keys = new Set([...real.keys(), ...mock.keys()]); for (const k of keys) { const a = real.get(k) || 0, b = mock.get(k) || 0; diff += Math.abs(a - b); tot += a; mt += b; } return { misplacedPct: pct(diff / 2, tot), realHours: Math.round(tot), mockHours: Math.round(mt) }; };
  out.baseline = { daily: cmp(runs.daily.worked), weekly6: cmp(runs.w6.worked) };
}
// P7: windowed work begun no later under the week than under the day
{
  let n = 0, noLater = 0, within6 = 0;
  for (const hh of HHS) for (const x of demandOf(hh)) {
    if (!x.windowed) continue;
    const a = runs.daily.first.get(x.id), b = runs.w6.first.get(x.id);
    if (a === undefined || (a === null && b === null)) continue;
    n++; if (b !== null && (a === null || b <= a)) noLater++; if (b !== null && (a === null || b <= a + 6)) within6++;
  }
  out.P7windowed = { tasks: n, noLater: pct(noLater, n), within6h: pct(within6, n) };
}
// ---- disruptions (P9): 200 household-times a season each, on season slices, both policies, against the undisturbed slice ----
{
  const N = Number(arg('n', 200)), cache = new Map(), R = {};
  const base = (hh, from, to, policy) => { const k = `${hh}|${from}|${policy}`; if (!cache.has(k)) cache.set(k, run(hh, demandOf(hh), from, to, { policy, W: 6 })); return cache.get(k); };
  const seasonsAvail = [...new Set(HHS.flatMap((hh) => [...days.get(hh).keys()].map((d) => Math.floor(d / SEASON_DAYS))))].filter((s) => s * SEASON_DAYS >= FROM && (s + 1) * SEASON_DAYS <= TO);
  for (const kind of ['ill', 'dead', 'wet', 'ask']) for (let season = 0; season < 4; season++) {
    const ss = seasonsAvail.filter((s) => s % 4 === season); if (!ss.length) continue;
    for (let i = 0; i < N; i++) {
      const s = ss[Math.floor(rnd() * ss.length)], from = s * SEASON_DAYS, to = from + SEASON_DAYS;
      const cand = HHS.filter((hh) => days.get(hh).has(from) && days.get(hh).has(to - 1)); if (!cand.length) continue;
      const hh = cand[Math.floor(rnd() * cand.length)], dd = from + 1 + Math.floor(rnd() * 8), dr = days.get(hh).get(dd);
      if (!dr) continue;
      const adults = dr.members.filter((m) => m.adult && !m.ill); if (!adults.length) continue;
      const who = adults[Math.floor(rnd() * adults.length)].id, size = sizeOf(dr);
      const dis = kind === 'ill' ? { kind, who, from: dd, until: dd + 3 } : kind === 'dead' ? { kind, who, from: dd, until: Infinity } : { kind, who, day: dd, from: dd };
      const row = (R[`${kind}|${SEASONS[season]}|${size}`] ||= { n: 0, daily: { dVital: 0, dWin: 0, yes: 0 }, weekly: { dVital: 0, dWin: 0, yes: 0, outTurnExtra: 0, dropped: 0, lowered: 0, latestDropped: 0, droppedCases: 0 }, vitalHours: 0, windowed: 0 });
      row.n++;
      for (const policy of ['daily', 'weekly']) {
        const b = base(hh, from, to, policy), r = run(hh, demandOf(hh), from, to, { policy, W: 6, dis }), o = row[policy];
        o.dVital += r.res.vitalUnmet - b.res.vitalUnmet; o.dWin += r.res.windowsMissed - b.res.windowsMissed; if (r.S.askYes) o.yes++;
        if (policy === 'weekly') {
          row.vitalHours += b.res.vitalHours; row.windowed += b.res.windowed;
          o.outTurnExtra += r.S.outTurn - b.S.outTurn - (kind === 'ill' || kind === 'dead' ? 1 : 0); o.dropped += r.S.dropped.length; o.lowered += r.S.lowered;
          if (r.S.dropped.length) { o.droppedCases++; const kept = r.tasks.filter((x) => x.who !== null && x.open <= dd * DAYH + W0 && !r.S.dropped.includes(x.deadline)); const maxKept = Math.max(-Infinity, ...kept.map((x) => x.deadline)); if (Math.min(...r.S.dropped) >= maxKept) o.latestDropped++; }
        }
      }
    }
  }
  out.P9 = Object.fromEntries(Object.entries(R).sort().map(([k, r]) => [k, { n: r.n,
    dailyVitalUnmetPerCase: r1(r.daily.dVital / r.n), weeklyVitalUnmetPerCase: r1(r.weekly.dVital / r.n),
    dailyWindowsMissedPerCase: r1(r.daily.dWin / r.n), weeklyWindowsMissedPerCase: r1(r.weekly.dWin / r.n),
    weeklyExtraOutOfTurn: r1(r.weekly.outTurnExtra / r.n), weeklyDroppedPerCase: r1(r.weekly.dropped / r.n), loweredOrAsked: pct(r.weekly.lowered, r.n),
    droppedLatestFirst: pct(r.weekly.latestDropped, r.weekly.droppedCases), askYesDaily: pct(r.daily.yes, r.n), askYesWeekly: pct(r.weekly.yes, r.n) }]));
}
if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(out, null, 1));
console.log(JSON.stringify({ ...out, P9: undefined }, null, 1));
