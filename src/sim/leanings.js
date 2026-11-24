// @sys sim/leanings: read-only views of a person's leanings on the customs: what draws them towards a way (VB-398), and where they
//   differ from the practice in force (VB-082); no state
VB['sim/leanings'] = (() => {
  const { OFF, NOPT, DIMS } = VB['sim/customs'],
    { P, WEIGH } = VB['sim/attitudes'];
  // What draws a person towards option j of custom d, each pull as the daily drift weighs it (sim/attitudes' WEIGH, which driftPerson reads too):
  // company (those they deal with, mixed with the settlement's mean share for it, or null; friend is the tie that weighs most among those
  // who favour j above the custom's other ways), upbringing (what they learned young), cause (a cause argued near them; arguer is who argues
  // it with most weight), interest (their own) and own (they argue it themselves). A view for the page (page/customs, VB-398): it writes
  // nothing and draws no randomness. open and pious: what the person's openness and piety do to its malleability and to the pull of what
  // it learned young (Traits.act; VB-520), as the drift reads them through its hooks.
  function pulls(p, d, j, byId, mean = null, kind = 'village', open = 1, pious = 1) {
    const o = OFF[d],
      n = NOPT[d],
      k = o + j,
      m = DIMS[d].m * open,
      a = p.att[k],
      rate = P.kind[kind],
      ageF = WEIGH.age(p.age);
    let wsum = 0,
      t = 0,
      press = 0,
      pr = 0,
      friend = null,
      fw = 0,
      arguer = null,
      aw = 0;
    for (const [id, w0] of p.ties) {
      const q = byId(id);
      if (!q || !q.alive || q.age < 12) continue;
      const wq = WEIGH.tie(w0, q);
      t += wq * q.att[k];
      wsum += wq;
      let top = 0;
      for (let i = 1; i < n; i++) if (q.att[o + i] > q.att[o + top]) top = i;
      if (top === j && wq > fw) {
        fw = wq;
        friend = q.id;
      }
      if (!q.advocate || q.advocate.dim !== d) continue;
      pr += wq;
      if (q.advocate.opt === j) {
        press += wq;
        if (wq > aw) {
          aw = wq;
          arguer = q.id;
        }
      }
    }
    if (wsum > 0) {
      t /= wsum;
      press /= wsum;
      pr /= wsum;
    }
    const tgt = mean !== null ? (wsum > 0 ? WEIGH.mixed(t, mean) : mean) : wsum > 0 ? t : a;
    return {
      company: WEIGH.social(m, rate, ageF) * (tgt - a),
      friend,
      upbringing: WEIGH.anchor(kind) * pious * (p.anc[k] - a),
      cause: WEIGH.cause(m, rate, ageF) * (press - pr * a),
      arguer,
      interest: p.interest ? WEIGH.interest(m) * (p.interest[k] - a) : 0,
      own: !!p.advocate && p.advocate.dim === d && p.advocate.opt === j,
    };
  }
  // The customs where a person's own mind differs most from the practice in force (VB-082, the pawn card's "Leans" line): each custom d
  // whose way the person favours most is not practice[d], as {dim, opt (the way it favours), practice, by (by how much of its share it
  // favours opt over the practice)}, the widest first, at most n. A lead under LEAN_MIN is no leaning.
  const LEAN_MIN = 0.05;
  function leansOf(p, practice, n = 2) {
    const out = [];
    for (let d = 0; d < DIMS.length; d++) {
      const o = OFF[d],
        x = practice[d];
      let y = 0;
      for (let j = 1; j < NOPT[d]; j++) if (p.att[o + j] > p.att[o + y]) y = j;
      const by = p.att[o + y] - p.att[o + x];
      if (y !== x && by >= LEAN_MIN) out.push({ dim: d, opt: y, practice: x, by });
    }
    return out.sort((a, b) => b.by - a.by || a.dim - b.dim).slice(0, n);
  }
  return { pulls, leansOf, LEAN_MIN };
})();
