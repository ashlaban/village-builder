// @sys sim/relations: relationships between pawns: compatibility, opinion from kin and timed memories, and the people a pawn knows
VB['sim/relations'] = (() => {
  const { DAY, YEAR, SOCIAL } = VB['sim/rules'];
  const { personEvent, fullName, spouseOf } = VB['sim/records'];
  const M = SOCIAL.memories;

  // ---- compatibility: fixed for a pair, from the world seed and the two ids, so it needs no memory; a large age gap lowers it ----
  const mix = (h) => {
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b); h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
    return (h ^ (h >>> 16)) >>> 0;
  };
  const unit = (s, i, j) => mix(Math.imul(s, 0x9e3779b1) ^ Math.imul(i + 1, 73856093) ^ Math.imul(j + 1, 19349663)) / 4294967296;
  // -1..1, shaped like a triangle around 0; less by 0.02 a year of age gap beyond 5 years, at most 0.4
  function compat(st, a, b) {
    const i = Math.min(a, b), j = Math.max(a, b), s = st.w.seed >>> 0;
    const gap = Math.abs(st.pawns[i].born - st.pawns[j].born) / YEAR;
    return Math.max(-1, unit(s, i, j) + unit(s ^ 0x5bd1e995, j, i) - 1 - Math.min(0.4, Math.max(0, gap - 5) * 0.02));
  }

  // ---- standing: what b is to a by the family records and the household: spouse, parent, child, sibling, housemate or null ----
  function standing(st, a, b) {
    const pa = st.pawns[a], pb = st.pawns[b];
    if (spouseOf(st, a) === b) return 'spouse';
    if (pa.father === b || pa.mother === b) return 'parent';
    if (pb.father === a || pb.mother === a) return 'child';
    if ((pa.father !== null && pa.father === pb.father) || (pa.mother !== null && pa.mother === pb.mother)) return 'sibling';
    if (pa.household !== null && pa.household === pb.household) return 'housemate';
    return null;
  }
  const WORDS = { spouse: ['husband', 'wife'], parent: ['father', 'mother'], child: ['son', 'daughter'], sibling: ['brother', 'sister'],
    housemate: ['housemate', 'housemate'] };
  // b as a's husband, mother, brother..., or null
  const standingWord = (st, a, b) => { const k = standing(st, a, b); return k ? WORDS[k][st.pawns[b].sex === 'f' ? 1 : 0] : null; };

  // ---- memories and opinion ----
  // @state pawn.rel: Map of other pawn id to a's relationship record {mem: {kind: {v, t}}, band}; a record exists while it holds a memory.
  //   kind is a key of SOCIAL.memories; v the memory's value at its last event, at game hour t; band 1 (friend), 0 or -1 (dislike), as last
  //   seen, so entering a band is told once (sim/relations). Empty for the dead.
  const memNow = (st, kind, m) => m.v * Math.max(0, 1 - (st.t - m.t) / (M[kind].days * DAY));
  // a's opinion of b, -1..1: the standing's value plus the memories, as they are now
  function opinionOf(st, a, b) {
    const k = standing(st, a, b), r = st.pawns[a].rel.get(b);
    let o = k ? SOCIAL.situational[k] : 0;
    if (r) for (const kind in r.mem) o += memNow(st, kind, r.mem[kind]);
    return Math.max(-1, Math.min(1, o));
  }
  // friend (1), dislike (-1) or neither (0): entered at SOCIAL.friend and SOCIAL.dislike, left only SOCIAL.back past them
  function bandOf(was, o) {
    if (o >= SOCIAL.friend) return 1;
    if (o <= SOCIAL.dislike) return -1;
    if (was === 1 && o >= SOCIAL.friend - SOCIAL.back) return 1;
    if (was === -1 && o <= SOCIAL.dislike + SOCIAL.back) return -1;
    return 0;
  }
  // a remembers an event with b: the memory of its kind gains v, up to its cap, and fades from now; becoming friends or falling out
  // is a life event of a.
  function remember(st, a, b, kind) {
    const rel = st.pawns[a].rel;
    let r = rel.get(b);
    if (!r) { r = { mem: {}, band: 0 }; r.band = bandOf(0, opinionOf(st, a, b)); rel.set(b, r); } // a band of standing alone is no news
    const K = M[kind], m = r.mem[kind], v = (m ? memNow(st, kind, m) : 0) + K.v;
    r.mem[kind] = { v: K.cap > 0 ? Math.min(K.cap, v) : Math.max(K.cap, v), t: st.t };
    const was = r.band;
    r.band = bandOf(was, opinionOf(st, a, b));
    if (r.band !== was && r.band !== 0) {
      personEvent(st, a, r.band > 0 ? 'friend' : 'fellOut', `${r.band > 0 ? 'Became friends with' : 'Fell out with'} ${fullName(st.pawns[b])}`);
    }
  }
  // Daily: memories that have faded away are forgotten, and records with none left, or about the dead, are dropped.
  function fadeRelations(st) {
    for (const p of st.pawns) {
      if (!p.alive) continue;
      for (const [j, r] of p.rel) {
        if (!st.pawns[j].alive) { p.rel.delete(j); continue; }
        let left = false;
        for (const kind in r.mem) { if (memNow(st, kind, r.mem[kind]) === 0) delete r.mem[kind]; else left = true; }
        if (!left) p.rel.delete(j);
      }
    }
  }
  // A pawn's death ends the relationships of others with it.
  function forget(st, id) {
    const p = st.pawns[id];
    for (const j of p.rel.keys()) { const q = st.pawns[j]; if (q.rel) q.rel.delete(id); }
    p.rel.clear();
  }

  // ---- for the page and the tools ----
  const opinionWord = (o) => (o >= SOCIAL.closeFriend ? 'close friend' : o >= SOCIAL.friend ? 'friend' : o <= SOCIAL.enemy ? 'enemy'
    : o <= SOCIAL.dislike ? 'dislikes' : 'neutral');
  // The living people a pawn knows, by tie (most familiar first): {id, tie, opinion, standing}
  function relationsOf(st, id) {
    const p = st.pawns[id], ids = new Set([...p.ties.keys(), ...p.rel.keys()]), out = [];
    for (const j of ids) {
      if (!st.pawns[j].alive) continue;
      out.push({ id: j, tie: p.ties.get(j) || 0, opinion: opinionOf(st, id, j), standing: standing(st, id, j) });
    }
    return out.sort((x, y) => y.tie - x.tie || x.id - y.id);
  }
  // What a's opinion of b is made of now, largest first: [{label, value}], the standing first if there is one
  function reasonsOf(st, a, b) {
    const out = [], k = standing(st, a, b), r = st.pawns[a].rel.get(b);
    if (r) for (const kind in r.mem) out.push({ label: M[kind].label, value: memNow(st, kind, r.mem[kind]) });
    out.sort((x, y) => Math.abs(y.value) - Math.abs(x.value));
    if (k) out.unshift({ label: WORDS[k][st.pawns[b].sex === 'f' ? 1 : 0], value: SOCIAL.situational[k] });
    return out;
  }
  return { compat, standing, standingWord, memNow, opinionOf, bandOf, remember, fadeRelations, forget, opinionWord, relationsOf, reasonsOf };
})();
