// @sys sim/bridges: bounded local crossing survey and village bridge construction (VB-115).
VB['sim/bridges'] = (() => {
  const Projects = VB['sim/projects'],
    Stores = VB['sim/stores'];
  const { BUILD } = VB['sim/rules'];
  const { bfs } = VB['sim/hex'];
  const { passable, costChanged } = VB['sim/routes'];
  const underWay = (st, v) => Projects.projectsOf(st, 'village', v.id).find((p) => p.what === 'bridge');
  const homes = (st, v) => v.farmsteads.map((id) => st.farmsteads[id]).filter((f) => f.household !== null);
  function funded(st, v) {
    const total = { wood: 0, stone: 0 };
    for (const f of homes(st, v)) {
      const h = st.households[f.household];
      for (const g of ['wood', 'stone']) total[g] += Math.max(0, (h[g] || 0) - Stores.reserved(st, h, g));
    }
    return total.wood >= BUILD.bridgeWood && total.stone >= BUILD.bridgeStone;
  }
  // At most eight farms, two destinations each, 64 nearby river tiles and radius 10 searches.
  // One map per endpoint, never one route search per candidate. Scores are saved walking
  // steps, with a small convenience benefit for a ford already used by these journeys.
  function adjacent(w, a, b) {
    for (let d = 0; d < 6; d++) if (w.nb[a * 6 + d] === b) return true;
    return false;
  }
  function site(st, v) {
    const w = st.w,
      farms = homes(st, v),
      trips = [],
      candidates = new Set();
    for (let k = 0; k < Math.min(8, farms.length); k++) {
      const f = farms[Math.floor((k * farms.length) / Math.min(8, farms.length))];
      const a = bfs(w, f.house, BUILD.bridgeReach, (t) => passable(w, t)).dist;
      for (const t of a.keys())
        for (let d = 0; d < 6 && candidates.size < 64; d++) {
          const r = w.nb[t * 6 + d];
          if (r >= 0 && w.river[r] && !w.water[r] && w.crossing[r] !== 2) candidates.add(r);
        }
      for (const field of [f.fields[0], f.meadows[0]])
        if (field) {
          trips.push({
            a,
            b: bfs(w, field.tile, BUILD.bridgeReach, (t) => passable(w, t)).dist,
            old: a.get(field.tile) ?? BUILD.bridgeReach * 2,
          });
        }
    }
    let best = null;
    for (const tile of candidates) {
      if (st.used.has(tile)) continue;
      let occupied = false;
      Projects.forEach(st, (p) => {
        if (p.what === 'bridge' && p.steps[0].river === tile) occupied = true;
      });
      if (occupied) continue;
      const banks = [];
      for (let d = 0; d < 6; d++) {
        const t = w.nb[tile * 6 + d];
        if (t >= 0 && !w.river[t] && passable(w, t) && w.dev[t] !== 3) banks.push(t);
      }
      let score = 0,
        users = 0;
      for (const trip of trips) {
        let saved = 0;
        for (const a of banks)
          for (const b of banks) {
            if (a === b || adjacent(w, a, b)) continue;
            const da = trip.a.get(a),
              db = trip.b.get(b);
            if (da === undefined || db === undefined) continue;
            const gain = trip.old - da - db - 2 + (w.crossing[tile] === 1 ? 1 : 0);
            saved = Math.max(saved, gain);
          }
        if (saved > 0) {
          score += saved;
          users++;
        }
      }
      if (users >= 2 && (!best || score > best.score || (score === best.score && tile < best.tile)))
        best = { tile, bank: banks.find((b) => trips.some((trip) => trip.a.has(b))), score };
    }
    return best;
  }
  function project(st, v) {
    if (underWay(st, v) || !funded(st, v)) return null;
    const s = site(st, v);
    return s
      ? {
          what: 'bridge',
          started: st.t,
          steps: [{ kind: 'bridge', place: s.bank, river: s.tile, hours: BUILD.bridgeHours }],
        }
      : null;
  }
  function begun(st, v) {
    for (const g of ['wood', 'stone']) {
      let left = g === 'wood' ? BUILD.bridgeWood : BUILD.bridgeStone;
      for (const f of homes(st, v)) {
        const h = st.households[f.household],
          n = Math.min(left, Math.max(0, (h[g] || 0) - Stores.reserved(st, h, g)));
        if (n) Stores.take(st, h, g, n, 'build');
        left -= n;
      }
    }
  }
  function work(st, v, at, c, post) {
    const p = underWay(st, v);
    if (p)
      post(`bridge:v${v.id}`, p.steps[0].place, { village: v.id, step: p.steps[0] }, 'bridge', {
        type: 'village',
        id: v.id,
      });
  }
  const KINDS = {
    bridge: {
      verb: 'Building a bridge',
      go: 'Going to build the bridge',
      name: 'Build a bridge',
      label: 'Bridge',
      anim: 'mallet',
      hours: BUILD.bridgeHours,
      hands: 3,
      type: 'duty',
      available: work,
      done: (st, j) => {
        const p = underWay(st, st.villages[j.village]);
        if (!p || p.steps[0] !== j.step) return;
        st.w.crossing[j.step.river] = 2;
        costChanged(st, j.step.river);
        st.visualDirty = true;
        VB['sim/events'].emit(st, 'stepDone', { type: 'village', id: j.village, plan: p });
      },
    },
  };
  return { KINDS, underWay, funded, site, project, begun };
})();
