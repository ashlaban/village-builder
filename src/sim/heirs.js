// @sys sim/heirs: succession: heir ranking, handovers, moving between households, roles
VB['sim/heirs'] = (() => {
  const {
    personEvent, log, age, fullName, spouseOf, childrenOf, siblingsOf, kinNear, isHolder, holdingOf, practice, farmPractice,
  } = VB['sim/records'];
  const { placeAtHome, release } = VB['sim/agents'];
  // Who would inherit this farm now, in order, under the practice of its village.
  function heirRanking(st, hh, cust = null, nested = false) {
    const f = st.farmsteads[hh.farmstead], cu = cust || practice(st, f.village !== null ? f.village : 0);
    const line = f.line !== undefined && f.line !== null ? f.line : hh.holder;
    const sexRank = (p) => cu.heirSex === 'sonsFirst' ? (p.sex === 'm' ? 0 : 1) : cu.heirSex === 'daughtersFirst' ? (p.sex === 'f' ? 0 : 1) : 0;
    const order = (ids) => [...ids].sort((a, b) => {
      const pa = st.pawns[a], pb = st.pawns[b], s = sexRank(pa) - sexRank(pb);
      if (s) return s;
      if (cu.birthOrder === 'youngest') return pb.born - pa.born;
      if (cu.birthOrder === 'chosen') { const ha = pa.household === hh.id ? 0 : 1, hb = pb.household === hh.id ? 0 : 1; if (ha !== hb) return ha - hb; }
      return pa.born - pb.born;
    });
    const out = [], seen = new Set();
    const lineOf = (id, depth) => {
      if (depth > 3) return;
      for (const c of order(childrenOf(st, id))) {
        if (seen.has(c)) continue; seen.add(c);
        if (st.pawns[c].died === null) out.push(c);
        lineOf(c, depth + 1); // a dead child's children stand in their place; a living child's line follows them
      }
    };
    lineOf(line, 0);
    const direct = new Set(out);
    // then the wider family: siblings and their lines, then the parents' siblings (cousins) and theirs
    seen.add(line);
    let anc = line;
    for (let up = 0; up < 2; up++) {
      const lp = st.pawns[anc];
      if (lp.father === null && lp.mother === null) break;
      const parent = lp.father !== null ? lp.father : lp.mother;
      for (const s of order(childrenOf(st, parent).filter((q) => q !== anc))) {
        if (seen.has(s)) continue; seen.add(s); if (st.pawns[s].died === null) out.push(s); lineOf(s, 1);
      }
      anc = parent; seen.add(parent);
    }
    const ok = out.filter((id) => {
      const p = st.pawns[id];
      if (cu.heirSex === 'sons' && p.sex === 'f') return false;
      const own = holdingOf(st, id); if (own && own !== hh) return false; // already holds a farm
      const sp = spouseOf(st, id); if (sp !== null) { const so = holdingOf(st, sp); if (so && so !== hh) return false; } // lives on a spouse's farm
      return id !== hh.holder;
    });
    if (nested) return ok.filter((id) => direct.has(id));
    // a relative who is first in line for their own parents' farm steps behind the others here: farms are not
    // combined while someone else in the family can take this one. Direct heirs of this farm keep their place.
    const ownFirst = new Set();
    for (const o of st.households) if (!o.dissolved && o !== hh) { const r = heirRanking(st, o, null, true); if (r.length) ownFirst.add(r[0]); }
    const back = (id) => !direct.has(id) && ownFirst.has(id);
    return [...ok.filter((id) => !back(id)), ...ok.filter(back)];
  }
  function moveTo(st, id, hhId) {
    const p = st.pawns[id], old = p.household !== null ? st.households[p.household] : null;
    if (old) old.members = old.members.filter((m) => m !== id);
    const hh = st.households[hhId]; if (!hh.members.includes(id)) hh.members.push(id);
    p.household = hhId; p.servant = false;
    const a = st.agents[id]; release(st, a); placeAtHome(st, a);
    if (old && old.farmstead !== hh.farmstead) personEvent(st, id, 'moved', `Moved to ${st.farmsteads[hh.farmstead].name}`);
  }
  function transfer(st, hh, heir, reason) {
    const f = st.farmsteads[hh.farmstead], cu = farmPractice(st, f), old = hh.holder, op = st.pawns[old];
    const hp = st.pawns[heir];
    if (hp.household !== hh.id) {
      const from = hp.household !== null ? st.households[hp.household] : null, sp = spouseOf(st, heir);
      const kids = childrenOf(st, heir).filter((c) => st.pawns[c].alive && st.pawns[c].age < 18 && st.pawns[c].household === hp.household);
      moveTo(st, heir, hh.id);
      if (sp !== null && st.pawns[sp].alive && from && st.pawns[sp].household === from.id) moveTo(st, sp, hh.id);
      for (const c of kids) moveTo(st, c, hh.id);
    }
    hh.holder = heir; f.line = heir;
    if (op && op.alive && op.household === hh.id) {
      op.retired = true; const s = spouseOf(st, old); if (s !== null && st.pawns[s].alive) st.pawns[s].retired = true;
    }
    // shares for the siblings who do not inherit
    if (cu.heirCount !== 'one') {
      const sibs = siblingsOf(st, heir).filter((q) => st.pawns[q].alive);
      const wt = (q) => (cu.daughterShare === 'half' && st.pawns[q].sex === 'f' ? 1 : 2);
      const value = f.fields.length * 120 + hh.grain * 0.5, total = [...sibs, heir].reduce((s, q) => s + wt(q), 0);
      for (const q of sibs) {
        const reserve = 60 + hh.members.length * 30; // shares never eat the seed corn or the winter's food
        const due = Math.round((value * wt(q)) / total), paid = Math.min(due, Math.max(0, Math.floor(hh.grain - reserve)));
        hh.grain -= paid; st.pawns[q].stake = (st.pawns[q].stake || 0) + paid; st.pawns[q].owed = (st.pawns[q].owed || 0) + (due - paid);
        if (due) {
          personEvent(st, q, 'share',
            `Received ${paid} rations as a share of ${f.name}${due > paid ? `, ${due - paid} still owed` : ''}` +
            `${cu.heirCount === 'split' ? ' (splitting land comes in a later batch)' : ''}`);
        }
      }
    }
    personEvent(st, heir, 'inherited', `Took over ${f.name} (${reason})`);
    log(st,
      `${fullName(hp)} takes over ${f.name}` +
      `${reason === 'death' ? ` after ${fullName(op)}` : reason === 'marriage' ? ' on marrying' : ' as the old holder retires'}.`);
    st.visualDirty = true;
  }
  function extinct(st, hh) {
    const f = st.farmsteads[hh.farmstead];
    f.household = null; f.state = 'derelict'; f.emptySince = st.t; f.condition = 1;
    for (const fd of f.fields) { if (fd.stage !== 'stubble') fd.held = 0; fd.stage = 'stubble'; fd.sown = null; }
    hh.dissolved = true;
    for (const j of [...st.jobs.values()]) if (j.farm === f) st.jobs.delete(j.key);
    // anyone left moves in with their nearest kin, or into service elsewhere in the village
    for (const id of [...hh.members]) {
      const p = st.pawns[id]; if (!p.alive) continue;
      const kinHome = kinNear(st, id).map((q) => st.pawns[q])
        .find((q) => q.alive && q.household !== null && !st.households[q.household].dissolved && q.household !== hh.id);
      const target = kinHome ? kinHome.household
        : st.households.filter((h) => !h.dissolved && h.id !== hh.id).sort((x, y) => x.members.length - y.members.length)[0];
      if (target !== undefined) { moveTo(st, id, typeof target === 'number' ? target : target.id); if (!kinHome) st.pawns[id].servant = true; }
    }
    hh.members = [];
    log(st, `${f.name} stands empty: no heir would take it.`);
    st.visualDirty = true;
  }
  function succession(st, hh, reason) {
    const f = st.farmsteads[hh.farmstead], cu = farmPractice(st, f), dead = st.pawns[hh.holder];
    const sp = spouseOf(st, dead.id, dead.died - 0.01);
    const spouse = sp !== null && st.pawns[sp].alive && st.pawns[sp].household === hh.id ? sp : null;
    const ranking = heirRanking(st, hh, cu), heir = ranking.length ? ranking[0] : null;
    if (spouse !== null && (cu.widow === 'life' || cu.widow === 'outright' || heir === null || st.pawns[heir].age < 18)) {
      hh.holder = spouse; if (cu.widow === 'outright') f.line = spouse;
      personEvent(st, spouse, 'inherited',
        `Holds ${f.name} ${cu.widow === 'outright' ? 'outright' : cu.widow === 'life' ? 'for life' : `as guardian for ${fullName(st.pawns[heir])}`}`);
      log(st,
        `${fullName(st.pawns[spouse])} keeps ${f.name}` +
        `${cu.widow === 'life' ? ' for life' : cu.widow === 'outright' ? ' as her own' : ' until the heir comes of age'}.`);
      st.visualDirty = true;
      return;
    }
    if (heir === null) { extinct(st, hh); return; }
    if (st.pawns[heir].age < 18) {
      // a minor heir holds in name; the nearest adult kin in the house acts as guardian
      const g = hh.members.map((q) => st.pawns[q]).filter((q) => q.alive && q.age >= 18).sort((x, y) => x.born - y.born)[0];
      hh.guardian = g ? g.id : null;
    }
    transfer(st, hh, heir, 'death');
  }
  function refreshRoles(st) {
    for (const p of st.pawns) {
      if (p.died !== null) continue;
      const hh = p.household !== null ? st.households[p.household] : null, a = age(st, p);
      if (!hh) { p.role = a < 14 ? 'child' : 'farmhand'; continue; }
      const sp = spouseOf(st, p.id);
      if (hh.holder === p.id) p.role = 'farmer';
      else if (sp !== null && sp === hh.holder) p.role = p.sex === 'f' ? 'wife' : 'farmer';
      else if (p.retired) p.role = 'retired';
      else if (a < 14) p.role = 'child';
      else if (p.servant) p.role = p.sex === 'm' ? 'farmhand' : 'maid';
      else p.role = p.sex === 'm' ? 'son' : 'daughter';
    }
  }
  function placeIfMarried(st, id) {
    const p = st.pawns[id], hh = p.household !== null ? st.households[p.household] : null;
    if (!hh || hh.dissolved) return null;
    if (hh.holder === id) return hh.id;
    return heirRanking(st, hh)[0] === id ? hh.id : null;
  }
  // The first heir of each farm; wantsOut takes it so that counting all pawns ranks each household once, not once per pawn.
  function firstHeirs(st) {
    const out = new Set();
    for (const hh of st.households) if (!hh.dissolved) { const first = heirRanking(st, hh)[0]; if (first !== undefined) out.add(first); }
    return out;
  }
  function wantsOut(st, p, heirs = null) {
    if (!p.alive || p.age < 18 || p.retired) return false;
    if (isHolder(st, p.id)) return false;
    const sp = spouseOf(st, p.id); if (sp !== null && isHolder(st, sp)) return false;
    if (placeIfMarried(st, p.id) !== null) return false;
    if (heirs) { if (heirs.has(p.id)) return false; } // heir somewhere else
    else for (const hh of st.households) if (!hh.dissolved && heirRanking(st, hh)[0] === p.id) return false;
    return true;
  }
  return { heirRanking, moveTo, transfer, extinct, succession, refreshRoles, placeIfMarried, wantsOut, firstHeirs };
})();
