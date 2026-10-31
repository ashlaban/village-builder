// @sys sim/society: Culture wiring: settlements, ties, prestige and interests of pawns
VB['sim/society'] = (() => {
  const Culture = VB['culture'];
  const { YEAR } = VB['sim/rules'];
  const { bfs, hexSteps } = VB['sim/hex'];
  const { walkable } = VB['sim/routes'];
  const { log, age, spouseOf, childrenOf, siblingsOf, kinNear, settlementIdOf, isHolder } = VB['sim/records'];
  const { heirRanking, ownFirstOf } = VB['sim/heirs'];
  function initCulture(st, leanBySettlement, overrides = {}) {
    const env = st.cenv = { t: st.t / YEAR, cultures: [], settlements: [], people: st.pawns, driftMul: 1 };
    env.byId = (id) => st.pawns[id];
    env.settlementOf = (p) => { const s = settlementIdOf(st, p); return s === null ? null : env.settlements[s]; };
    env.voiceOf = (p, s) => {
      if (!p.alive || p.age < 18) return 0;
      const v = Culture.DIMS[Culture.IDX.voice].opts[s.practice[Culture.IDX.voice]][0];
      if (v === 'adults') return 1;
      const holder = isHolder(st, p.id);
      if (holder) return 1;
      if (v === 'heads') { const sp = spouseOf(st, p.id); return sp !== null && isHolder(st, sp) ? 1 : 0; }
      return 0;
    };
    env.nameCulture = (s) => `${s.name.replace(/(by|sta|vik|nes|inge|berga|tuna|säter)$/, '') || s.name}folk`;
    env.onSplit = (nc, from, cause) => log(st,
      `${nc.name}: the people of ${env.settlements[nc.centres[0]].name} now keep their own customs, apart from ${from.name}.`);
    const customs = Culture.fromArchetype('oldNordic');
    for (const [key, opt] of Object.entries(overrides)) customs[Culture.IDX[key]] = Culture.optIndex(key, opt);
    const c = Culture.makeCulture(env, 'Nordic', customs, 0);
    for (const v of st.villages) {
      const s = {
        id: v.id, name: v.name, culture: c.id, kind: 'village', tie: v.id === 0 ? 1 : 0.5, practice: Int8Array.from(customs), fissionYears: 0, divergence: 0,
      };
      s.members = () => {
        const out = [];
        for (const hh of st.households) if (st.farmsteads[hh.farmstead].village === s.id) for (const m of hh.members) {
          const p = st.pawns[m]; if (p.alive && p.household === hh.id) out.push(p);
        }
        return out.sort((a, b) => a.id - b.id);
      };
      env.settlements.push(s);
    }
    for (const p of st.pawns) {
      p.alive = p.died === null; p.age = age(st, p);
      const s = settlementIdOf(st, p), lean = leanBySettlement && s !== null ? leanBySettlement[s] : null;
      p.att = Culture.seedAttitude(customs, st.rand, 0.6, lean); p.anc = Float32Array.from(p.att);
      p.ties = new Map(); p.prestige = 1; p.interest = null; p.advocate = null;
    }
    // starting ties: household, kin, and a few neighbours
    for (const hh of st.households) for (const i of hh.members) for (const j of hh.members) if (i !== j) st.pawns[i].ties.set(j, 1);
    for (const p of st.pawns) if (p.alive) for (const q of kinNear(st, p.id)) if (st.pawns[q].alive) {
      p.ties.set(q, Math.max(p.ties.get(q) || 0, 0.5)); st.pawns[q].ties.set(p.id, Math.max(st.pawns[q].ties.get(p.id) || 0, 0.5));
    }
    updateTies(st); refreshPrestige(st); refreshInterests(st);
  }
  // tie of each settlement to its culture's centre: travel distance plus living kin across the gap
  function updateTies(st) {
    const env = st.cenv;
    for (const s of env.settlements) {
      const c = env.cultures[s.culture], centre = c.centres[0];
      if (s.id === centre) { s.tie = 1; continue; }
      const va = st.villages[s.id], vb = st.villages[centre];
      const { dist } = bfs(st.w, va.center, 160, walkable(st.w));
      const d = dist.has(vb.center) ? dist.get(vb.center) : hexSteps(st.w, va.center, vb.center) * 1.6; // a sea crossing costs more
      let kin = 0;
      for (const p of st.pawns) if (p.alive && settlementIdOf(st, p) === s.id) for (const q of kinNear(st, p.id)) {
        const o = st.pawns[q]; if (o.alive && settlementIdOf(st, o) === centre) kin++;
      }
      s.tie = Math.min(1, Math.exp(-d / 25) + Math.min(0.3, kin * 0.04));
      s.distance = d; s.kinLinks = kin;
    }
  }
  function refreshPrestige(st) {
    for (const p of st.pawns) {
      if (!p.alive) continue;
      const sp = spouseOf(st, p.id);
      p.prestige = isHolder(st, p.id) ? 1.6 : sp !== null && isHolder(st, sp) ? 1.3 : 1;
      if (p.age >= 55) p.prestige += 0.2;
    }
  }
  // Self-interest follows position: what would this option do for me, or for my children?
  function refreshInterests(st) {
    const D = Culture.DIMS, I = Culture.IDX, O = Culture.OFF, own = ownFirstOf(st);
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
      p.interest = it;
    }
  }
  // A pair of pawns as one number, the smaller id first, and back.
  const PAIR = 2 ** 21;
  const pairKey = (i, j) => (i < j ? i * PAIR + j : j * PAIR + i);
  const pairOf = (k) => { const i = Math.floor(k / PAIR); return [i, k - i * PAIR]; };
  // An hour together: housemates inside their house, and pawns outdoors within NEAR map units in x and y.
  const NEAR = 30;
  function noteContacts(st) {
    const add = (i, j) => { const k = pairKey(i, j); st.contacts.set(k, (st.contacts.get(k) || 0) + 1); };
    for (const hh of st.households) {
      if (hh.dissolved) continue; const ins = hh.members.filter((m) => st.agents[m].inside);
      for (let x = 0; x < ins.length; x++) for (let y = x + 1; y < ins.length; y++) add(ins[x], ins[y]);
    }
    // Outdoors, from cells of NEAR units: each pawn meets the later pawns of its own and the 8 cells around, in agent order,
    // so pairs are counted in the same order as by comparing every pair.
    const out = []; for (const a of st.agents) if (!a.inside && st.pawns[a.id].alive) out.push(a);
    const cells = new Map(), cellOf = (cx, cy) => cx * 65536 + cy, cand = [];
    out.forEach((a, n) => {
      const k = cellOf(Math.floor(a.x / NEAR), Math.floor(a.y / NEAR)), l = cells.get(k);
      if (l) l.push(n); else cells.set(k, [n]);
    });
    for (let x = 0; x < out.length; x++) {
      const a = out[x], cx = Math.floor(a.x / NEAR), cy = Math.floor(a.y / NEAR); cand.length = 0;
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        const l = cells.get(cellOf(cx + dx, cy + dy)); if (l) for (const y of l) if (y > x) cand.push(y);
      }
      if (cand.length > 1) cand.sort((p, q) => p - q);
      for (const y of cand) { const b = out[y]; if (Math.abs(a.x - b.x) < NEAR && Math.abs(a.y - b.y) < NEAR) add(a.id, b.id); }
    }
  }
  return { initCulture, updateTies, refreshPrestige, refreshInterests, pairKey, pairOf, noteContacts };
})();
