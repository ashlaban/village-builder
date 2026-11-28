// A party settled at once (VB-787): the verb stakeSite, the site's work done as if worked (its tiles cleared and broken, its cottage
// roofed), then the verb leave. The leave's answer (true, or why not), or the stake's refusal.
module.exports = function settleNow(VB, st, actor, args) {
  const { issue } = VB['sim/commands'], Sites = VB['sim/sites'];
  const n = st.siteSeq,
    r = issue(st, { actor, verb: 'stakeSite', args, source: 'round' });
  if (r !== true) return r;
  const s = Sites.byId(st, n);
  for (const tr of s.plot.places) {
    tr.i = tr.steps.length;
    if (tr.kind === 'field') st.w.dev[tr.tile] = 1; // broken, as the site's last step leaves it
  }
  for (const k of s.plot.steps) k.done = k.hours;
  s.plot.open = s.plot.steps.length;
  s.stage = 'roofed';
  return issue(st, { actor, verb: 'leave', target: s.id, source: 'pawn' });
};
