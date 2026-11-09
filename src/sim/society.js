// @sys sim/society: Culture wiring: settlements, ties, prestige and interests of pawns
VB['sim/society'] = (() => {
  const { next: rnd, drawer } = VB['sim/rng'];
  const { issue } = VB['sim/commands'];
  const Culture = VB['culture'];
  const { initRelations, raiseTie } = VB['sim/relations'];
  const { YEAR } = VB['sim/rules'];
  const { stepsTo, hexSteps } = VB['sim/hex'];
  const { walkable } = VB['sim/routes'];
  const { log, age, spouseOf, childrenOf, siblingsOf, kinNear, settlementIdOf, isHolder, membersOf, voiceOf } = VB['sim/records'];
  const { heirRanking, ownFirstOf } = VB['sim/heirs'];
  // The lookups Culture's functions take (VB-073): built from st on each call, so nothing in st.cenv is a function.
  function hooks(st) {
    const env = st.cenv;
    return {
      living: st.living,
      byId: (id) => st.pawns[id],
      settlementOf: (p) => { const s = settlementIdOf(st, p); return s === null ? null : env.settlements[s]; },
      voiceOf: (p, s) => voiceOf(st, p, s),
      decide: (s, dim, option) => issue(st, { actor: { settlement: s.id }, verb: 'decide', args: { dim, option }, source: 'meeting' }) === true,
      membersOf: (s) => membersOf(st, s.id),
      nameCulture: (s) => `${s.name.replace(/(by|sta|vik|nes|inge|berga|tuna|säter)$/, '') || s.name}folk`,
      onSplit: (nc, from) => log(st, `${nc.name}: the people of ${env.settlements[nc.centres[0]].name} now keep their own customs, apart from ${from.name}.`,
        { kind: 'split', village: nc.centres[0] }),
    };
  }
  function initCulture(st, leanBySettlement, overrides = {}) {
    const env = st.cenv = { t: st.t / YEAR, cultures: [], settlements: [], people: st.pawns, driftMul: 1 };
    const customs = Culture.fromArchetype('oldNordic');
    for (const [key, opt] of Object.entries(overrides)) customs[Culture.IDX[key]] = Culture.optIndex(key, opt);
    const c = Culture.makeCulture(env, 'Nordic', customs, 0);
    for (const v of st.villages) addSettlement(st, v, c.id, customs, v.id === 0 ? 1 : 0.5);
    for (const p of st.pawns) {
      p.alive = p.died === null; p.age = age(st, p);
      const s = settlementIdOf(st, p), lean = leanBySettlement && s !== null ? leanBySettlement[s] : null;
      Culture.initPerson(p, Culture.seedAttitude(customs, drawer(st.rng.culture), 0.6, lean));
      initRelations(st, p);
    }
    // starting ties, on the pawns' tie scale (sim/relations): household members 1, near kin at least 0.5
    for (const hh of st.households) for (const i of hh.members) for (const j of hh.members) if (i !== j) raiseTie(st, i, j, 1);
    for (const p of st.pawns) if (p.alive) for (const q of kinNear(st, p.id)) if (st.pawns[q].alive) { raiseTie(st, p.id, q, 0.5); raiseTie(st, q, p.id, 0.5); }
    updateTies(st); refreshPrestige(st); refreshInterests(st);
  }
  // The Culture settlement of village v, with the same id: its culture, a copy of the practice it keeps and its tie to the centre.
  // Seeding makes one per village; a village founded in play (sim/settle) gets one too, so the two lists keep the same ids.
  function addSettlement(st, v, culture, practice, tie) {
    const s = { id: v.id, name: v.name, culture, kind: 'village', tie, practice: Int8Array.from(practice), fissionYears: 0, divergence: 0 };
    st.cenv.settlements.push(s);
    return s;
  }
  // tie of each settlement to its culture's centre: travel distance plus living kin across the gap
  function updateTies(st) {
    const env = st.cenv, sid = new Map(), by = new Map(); // each living pawn's settlement, and the pawns of each, in id order
    for (const id of st.living) {
      const p = st.pawns[id];
      const v = settlementIdOf(st, p); sid.set(p.id, v);
      const l = by.get(v); if (l) l.push(p); else by.set(v, [p]);
    }
    for (const s of env.settlements) {
      const c = env.cultures[s.culture], centre = c.centres[0];
      if (s.id === centre) { s.tie = 1; continue; }
      const va = st.villages[s.id], vb = st.villages[centre];
      const steps = stepsTo(st.w, va.center, vb.center, 160, walkable(st.w));
      const d = steps >= 0 ? steps : hexSteps(st.w, va.center, vb.center) * 1.6; // a sea crossing costs more
      let kin = 0;
      for (const p of by.get(s.id) || []) for (const q of kinNear(st, p.id)) {
        const o = st.pawns[q]; if (o.alive && sid.get(q) === centre) kin++;
      }
      s.tie = Math.min(1, Math.exp(-d / 25) + Math.min(0.3, kin * 0.04));
      s.distance = d; s.kinLinks = kin;
    }
  }
  function refreshPrestige(st) {
    for (const id of st.living) {
      const p = st.pawns[id];
      const sp = spouseOf(st, p.id);
      p.prestige = isHolder(st, p.id) ? 1.6 : sp !== null && isHolder(st, sp) ? 1.3 : 1;
      if (p.age >= 55) p.prestige += 0.2;
    }
  }
  // Self-interest follows position: what would this option do for me, or for my children?
  function refreshInterests(st) {
    const D = Culture.DIMS, I = Culture.IDX, O = Culture.OFF, own = ownFirstOf(st);
    // Annual historical cleanup clears dead people's saved interests too; live-only work uses the indexes.
    for (const p of st.pawns) {
      if (!p.alive || p.age < 12) { p.interest = null; continue; }
      const it = Float32Array.from(p.att);
      const set = (dim, prefs) => {
        const k = I[dim], o = O[k]; for (let j = 0; j < Culture.NOPT[k]; j++) it[o + j] = 0;
        for (const [opt, v] of Object.entries(prefs)) it[o + Culture.optIndex(dim, opt)] = v;
      };
      const holder = isHolder(st, p.id), sp = spouseOf(st, p.id), spHolder = sp !== null && isHolder(st, sp);
      const heirOfHome = p.household !== null && !st.households[p.household].dissolved
        && heirRanking(st, st.households[p.household], null, false, own)[0] === p.id;
      const landless = !holder && !spHolder && !heirOfHome && p.age >= 16;
      const sibs = siblingsOf(st, p.id).filter((q) => st.pawns[q].alive),
        sisters = sibs.filter((q) => st.pawns[q].sex === 'f').length, brothers = sibs.length - sisters;
      if (landless) {
        set('claims', { anyone: 0.6, villagers: 0.4 }); set('newLand', { intended: 0.5, labour: 0.5 });
        set('heirCount', { buyout: 0.6, split: 0.4 }); set('voice', { adults: 1 });
      }
      if (landless) set('ownHeir', { behind: 1 });
      if (heirOfHome) set('ownHeir', { keeps: 1 });
      if (holder) { set('claims', { kin: 0.5, assembly: 0.5 }); set('newLand', { village: 1 }); set('voice', { landholders: 1 }); }
      if (holder || heirOfHome) set('heirCount', { one: 1 });
      if (heirOfHome && p.age >= 18) set('handover', { marriage: 1 });
      if (holder && p.age >= 50) set('handover', { death: 1 });
      if (p.sex === 'f') set('daughterShare', { equal: 1 }); else if (sisters) set('daughterShare', { half: 1 });
      if (p.sex === 'f' && sp !== null) set('widow', { life: 0.5, outright: 0.5 });
      if (p.sex === 'm' && heirOfHome) set('widow', { keep: 1 });
      if (p.sex === 'f' && brothers && !heirOfHome) set('heirSex', { any: 1 });
      if (p.sex === 'm' && sisters && heirOfHome) set('heirSex', { sonsFirst: 0.6, sons: 0.4 });
      if (spHolder && !holder) set('voice', { heads: 1 });
      if (sibs.length) {
        const older = sibs.filter((q) => st.pawns[q].born < p.born).length;
        if (older === 0) set('birthOrder', { eldest: 1 }); else if (older === sibs.length) set('birthOrder', { youngest: 1 });
      }
      if (holder && childrenOf(st, p.id).length >= 2) set('birthOrder', { chosen: 1 });
      const young = childrenOf(st, p.id).filter((c) => st.pawns[c].alive && st.pawns[c].age < 14 && st.pawns[c].household === p.household);
      if (young.length) set('feedOrder', { children: 1 });
      if (p.kinPush) set('kinLimit', { [p.kinPush.to]: p.kinPush.w });
      // disputed claims (sim/claims): holders favour the claim already made, the landless the claim that is worked or has friends; a household
      // that lost a dispute leans for a while towards the rules that would have let it win
      if (landless) set('dispute', { strongest: 0.5, meeting: 0.5 });
      if (holder) set('dispute', { first: 0.6, kin: 0.4 });
      const gr = p.household !== null ? st.households[p.household].grievance : null;
      if (gr && st.t < gr.until && p.age >= 16) set('dispute', Object.fromEntries(gr.rules.map((r) => [r, 1 / gr.rules.length])));
      p.interest = it;
    }
  }
  // The pawns outdoors in a talk hour, in cells of NEAR map units, for talk (sim/relations): {out (agents), cells (cell key to indexes into
  // out), cellOf (cell x, y to key), size}; derived, not state. (Until VB-127 it also counted every pair near each other.)
  const NEAR = 30, cellOf = (cx, cy) => cx * 65536 + cy;
  function outdoors(st) {
    const out = []; for (const id of st.living) { const a = st.agents[id]; if (!a.inside) out.push(a); }
    const cells = new Map();
    out.forEach((a, n) => {
      const k = cellOf(Math.floor(a.x / NEAR), Math.floor(a.y / NEAR)), l = cells.get(k);
      if (l) l.push(n); else cells.set(k, [n]);
    });
    return { out, cells, cellOf, size: NEAR };
  }
  return { hooks, initCulture, addSettlement, updateTies, refreshPrestige, refreshInterests, outdoors };
})();
