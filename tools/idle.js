// Idle report for tools/sim.js: steps the run one hour at a time and samples every adult during work hours.
require('./help.js')(__filename);
module.exports = (Sim, st) => {
  const [W0, W1] = Sim.WORK, SEASONS = ['spring', 'summer', 'autumn', 'winter'];
  const share = {}, reasons = {}, waits = {}, seen = new Map(), unclaimed = {}, last = new Map(), switches = { other: 0, cook: 0 }; let days = 0, years = 0, first = true, pawnsSeen = 0;
  const bump = (o, k, n = 1) => { o[k] = (o[k] || 0) + n; };
  function sample() {
    const c = Sim.cal(st.t);
    for (const a of st.agents) {
      const p = st.pawns[a.id];
      if (!p.alive || Sim.age(st, p) < 7 || p.role === 'child') continue;
      const row = (share[p.role] ||= {}), s = (row[SEASONS[c.season]] ||= { working: 0, walking: 0, carrying: 0, idle: 0 });
      if (a.job && a.phase === 'work') s.working++;
      else if (a.job && a.phase === 'go') s.walking++;
      else if (a.job && a.phase === 'back') s.carrying++;
      else {
        s.idle++;
        const rows = Sim.explainIdle(st, a.id).filter((r) => r.reason !== 'taken' && r.reason !== 'not their work');
        bump(reasons, rows.length ? (rows.find((r) => r.reason) || { reason: 'has a bid, waits for the next round' }).reason.replace(/ until \d\d:\d\d/, '') : 'no job they may take');
      }
    }
    // VB-122: a job's wait is the work hours in which it was free (nobody on it) before a pawn took it; one taken within the hour of
    // its posting counts from the posting, and a night is not a wait (a spell starts again at the morning)
    const dayStart = Math.floor(st.t / Sim.DAY) * Sim.DAY + W0;
    for (const j of st.jobs.values()) {
      if (!j.claims.length) {
        const rec = seen.get(j.id);
        if (rec) rec.hours += 1; else seen.set(j.id, { job: j, hours: Math.max(0, st.t - Math.max(j.posted, dayStart)) });
      } else if (seen.has(j.id)) { (waits[j.kind] ||= []).push(seen.get(j.id).hours); seen.delete(j.id); }
      else if (st.t - j.posted < 1) (waits[j.kind] ||= []).push(Math.max(0, st.t - Math.max(j.posted, dayStart)));
    }
    for (const [id, rec] of seen) if (st.jobs.get(rec.job.key) !== rec.job) seen.delete(id); // done or dropped without being taken
    // switches: a pawn at work on a job that still has work left, now on another; the cook's call after 14:00 apart
    for (const a of st.agents) {
      const p = st.pawns[a.id], was = last.get(a.id);
      if (p.alive && was && a.job && a.job !== was && st.jobs.get(was.key) === was) {
        if (a.job.kind === 'cook' && Sim.cal(st.t).hour >= 14) switches.cook++; else switches.other++;
      }
      if (a.job && a.phase === 'work') last.set(a.id, a.job); else if (!a.job) last.delete(a.id);
    }
    if (first) { first = false; pawnsSeen = st.agents.filter((a) => st.pawns[a.id].alive && Sim.age(st, st.pawns[a.id]) >= 7 && st.pawns[a.id].role !== 'child').length; }
  }
  function endOfDay() {
    days++;
    for (const j of st.jobs.values()) if (!j.claims.length) bump(unclaimed, j.kind);
  }
  function advanceYear() {
    years++;
    for (let h = 0; h < Sim.YEAR; h++) {
      Sim.advance(st, 1);
      const c = Sim.cal(st.t);
      if (c.hour >= W0 && c.hour < W1) sample();
      if (Math.abs(c.hour - W1) < 1e-6) endOfDay();
    }
  }
  const pct = (n, tot) => +(100 * n / tot).toFixed(1);
  const quant = (xs, q) => { const s = [...xs].sort((x, y) => x - y); return s.length ? +s[Math.min(s.length - 1, Math.floor(q * s.length))].toFixed(2) : null; };
  function result() {
    const shares = {};
    for (const [role, bySeason] of Object.entries(share)) for (const [season, s] of Object.entries(bySeason)) {
      const tot = s.working + s.walking + s.carrying + s.idle;
      (shares[role] ||= {})[season] = { working: pct(s.working, tot), walking: pct(s.walking, tot), carrying: pct(s.carrying, tot), idle: pct(s.idle, tot) };
    }
    const idleTot = Object.values(reasons).reduce((x, y) => x + y, 0);
    const waitRows = Object.fromEntries(Object.entries(waits).map(([k, xs]) => [k, { n: xs.length, median: quant(xs, 0.5), p90: quant(xs, 0.9) }]));
    return { hoursShare: shares, idleReasons: Object.fromEntries(Object.entries(reasons).map(([k, n]) => [k, pct(n, idleTot)])), waitHours: waitRows,
      switchesPerPawnYear: { other: +(switches.other / Math.max(1, pawnsSeen) / Math.max(1, years)).toFixed(2), cookCall: +(switches.cook / Math.max(1, pawnsSeen) / Math.max(1, years)).toFixed(2) },
      unclaimedAtEndOfDay: Object.fromEntries(Object.entries(unclaimed).map(([k, n]) => [k, +(n / Math.max(days, 1)).toFixed(2)])) };
  }
  return { advanceYear, result };
};
