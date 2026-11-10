// Taking events out of a state's record, for tests that compare a run with one that differs only by those events (the player's marks).
// A pawn's events are positions in the record (VB-199): they are moved down past the events taken out, and those taken out are dropped.
function dropKind(st, kind) {
  const at = new Map(), kept = [];
  st.record.forEach((e, i) => { if (typeof e === 'object' && e.kind === kind) return; at.set(i, kept.length); kept.push(e); });
  st.record = kept;
  for (const p of st.pawns) p.events = p.events.filter((i) => at.has(i)).map((i) => at.get(i));
  const F = st.recordFold, down = (i) => { let n = i; while (n > 0 && !at.has(n - 1)) n--; return n ? at.get(n - 1) + 1 : 0; };
  if (!F) return;
  F.shortAt = down(F.shortAt); F.longAt = down(F.longAt);
  if (F.pass) { F.pass.shortEnd = down(F.pass.shortEnd); F.pass.longEnd = down(F.pass.longEnd); }
}
module.exports = { dropKind };
