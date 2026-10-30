// Idle report for tools/sim.js: steps the run one hour at a time and samples every adult during work hours.
module.exports = (Sim, st) => {
  const [W0, W1] = Sim.WORK, SEASONS = ['spring', 'summer', 'autumn', 'winter'];
  const share = {}, reasons = {}, waits = {}, seen = new Map(), unclaimed = {}; let days = 0;
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
    for (const j of st.jobs.values()) if (!j.claims.length) { if (!seen.has(j.id)) seen.set(j.id, j); } else if (seen.has(j.id)) {
      (waits[j.kind] ||= []).push(st.t - j.posted); seen.delete(j.id);
    }
  }
  function endOfDay() {
    days++;
    for (const j of st.jobs.values()) if (!j.claims.length) bump(unclaimed, j.kind);
  }
  function advanceYear() {
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
      unclaimedAtEndOfDay: Object.fromEntries(Object.entries(unclaimed).map(([k, n]) => [k, +(n / Math.max(days, 1)).toFixed(2)])) };
  }
  return { advanceYear, result };
};
