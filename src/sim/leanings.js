// @sys sim/leanings: read-only views of a person's leanings on the customs: what draws them towards a way (VB-398); no state
VB['sim/leanings'] = (() => {
  const { OFF, NOPT, DIMS, P } = VB['culture'];
  // What draws a person towards option j of custom d, each pull as the daily drift weighs it (culture, driftPerson): company (those they deal with,
  // mixed with the settlement's mean share for it, or null; friend is the tie that weighs most among those who favour j above the custom's other ways),
  // upbringing (what they learned young), cause (a cause argued near them; arguer is who argues it with most weight), interest (their own)
  // and own (they argue it themselves). A view for the page (page/customs, VB-398): it writes nothing and draws no randomness.
  function pulls(p, d, j, byId, mean = null, kind = 'village') {
    const o = OFF[d],
      n = NOPT[d],
      k = o + j,
      m = DIMS[d].m,
      a = p.att[k],
      rate = P.kind[kind],
      ageF = p.age < 25 ? 1.5 : p.age < 50 ? 1 : 0.6;
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
      const wq = w0 * q.prestige * (q.advocate ? P.advocacyWeight : 1);
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
    const tgt = mean !== null ? (wsum > 0 ? (1 - P.oblique) * t + P.oblique * mean : mean) : wsum > 0 ? t : a;
    return {
      company: m * P.social * rate * ageF * (tgt - a),
      friend,
      upbringing: (P.anchor[kind] || P.anchor.village) * (p.anc[k] - a),
      cause: P.persuasion * Math.pow(m, 0.75) * rate * ageF * (press - pr * a),
      arguer,
      interest: p.interest ? m * P.selfInterest * (p.interest[k] - a) : 0,
      own: !!p.advocate && p.advocate.dim === d && p.advocate.opt === j,
    };
  }
  return { pulls };
})();
