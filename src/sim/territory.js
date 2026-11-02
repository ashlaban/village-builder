// @sys sim/territory: the village's outland (utmark), claimed by need at the meetings and its own a year and a day later; land a household or
// village may take in; the village's commons wood
VB['sim/territory'] = (() => {
  const { B } = VB['gen'];
  const { CLAIMS, YEAR } = VB['sim/rules'];
  const { bfs } = VB['sim/hex'];
  const { walkable } = VB['sim/routes'];
  const CL = VB['sim/claims'];
  // Land lies in three rings (claims review, docs/review-claims.md): the infield of houses, fields, meadows, greens and plots (owned and in use,
  // st.used, or a green); the outland, village land not in use, held in common (its pasture, wood and land to take in); and wilderness, held by
  // nobody. A village claims outland by need at its autumn meeting (landMeeting); a claim unopposed until the next meeting becomes its own.
  const wooded = (w, t) => w.biome[t] === B.FOREST || w.biome[t] === B.PINE;
  // Land a village may hold as outland: not water, snow or a river's course.
  const holdable = (w, t) => !w.water[t] && !w.river[t] && w.biome[t] !== B.SNOW;
  const occupied = (st, v) => v.farmsteads.reduce((n, id) => n + (st.farmsteads[id].household !== null ? 1 : 0), 0);
  const VILLAGE = (id) => ({ type: 'village', id });
  // Tile t is outland of village vid: its land, not in use and not its green.
  const isOutland = (st, t, vid) => st.owner[t] === -vid - 1 && !st.used.has(t) && st.villages[vid].center !== t;
  // Whether a household or plot of village vid may take tile t in: wilderness that nobody else claims, or vid's own outland that no household
  // has staked; never another village's land or claims (Decided, 1 Nov). vid null: a new village's site, wilderness only.
  function freeFor(st, t, vid) {
    const n = st.owner[t];
    if (n !== 0 && (vid === null || !isOutland(st, t, vid))) return false;
    const list = st.claims.get(t);
    if (list) for (const c of list) if (c.by.type !== 'village' || c.by.id !== vid) return false;
    return true;
  }
  // Per village: tiles of outland held, of them wooded, and outland claims pending. One pass over the map.
  function tally(st) {
    const V = st.villages.length, held = new Int32Array(V), wood = new Int32Array(V), pending = new Int32Array(V), w = st.w;
    const greens = new Set(st.villages.map((v) => v.center));
    for (let t = 0; t < w.N; t++) {
      const n = st.owner[t];
      if (n >= 0 || st.used.has(t) || greens.has(t)) continue;
      held[-n - 1]++; if (wooded(w, t)) wood[-n - 1]++;
    }
    for (const list of st.claims.values()) for (const c of list) if (c.by.type === 'village' && c.why === 'outland') pending[c.by.id]++;
    return { held, wood, pending };
  }
  const outlandOf = (st, v) => { const out = []; for (let t = 0; t < st.w.N; t++) if (isOutland(st, t, v.id)) out.push(t); return out; };
  // ---- the meeting's claims ----
  // Each village with an occupied farm claims free tiles within CLAIMS.outReach walking steps of its green, nearest first (the nearest forest
  // first when it holds none), until its outland and pending claims reach CLAIMS.outPerFarm a farm. Villages take turns, one tile each, so
  // none takes a contested strip first. A tile another village claims is claimed too only when it lies nearer this village's green: the
  // dispute is then settled at the next meeting (settleOutland). Returns the number of new claims.
  function claimOutland(st) {
    const w = st.w, live = st.villages.filter((v) => occupied(st, v) > 0), { held, wood, pending } = tally(st);
    const reach = new Map(live.map((v) => [v.id, bfs(w, v.center, CLAIMS.outReach, walkable(w)).dist]));
    const queues = [];
    for (const v of live) {
      let need = CLAIMS.outPerFarm * occupied(st, v) - held[v.id] - pending[v.id];
      if (need <= 0) continue;
      const list = [...reach.get(v.id)].filter(([t, d]) => d >= 1 && holdable(w, t) && st.owner[t] === 0)
        .sort((a, b) => a[1] - b[1] || a[0] - b[0]);
      const ownWood = wood[v.id] > 0 || (v.commonsWood >= 0 && st.owner[v.commonsWood] === -v.id - 1);
      if (!ownWood) { const k = list.findIndex(([t]) => wooded(w, t)); if (k > 0) list.unshift(...list.splice(k, 1)); }
      queues.push({ v, list, i: 0, need });
    }
    let made = 0, more = true;
    while (more) {
      more = false;
      for (const q of queues) {
        if (q.need <= 0) continue;
        while (q.i < q.list.length) {
          const [t, d] = q.list[q.i++], others = CL.claimsOn(st, t);
          if (st.owner[t] !== 0 || others.some((c) => c.by.type === 'village' && c.by.id === q.v.id)) continue;
          if (others.some((c) => c.by.type !== 'village' || (reach.has(c.by.id) ? reach.get(c.by.id).get(t) ?? Infinity : Infinity) <= d)) continue;
          CL.addClaim(st, t, VILLAGE(q.v.id), 'outland'); q.need--; made++; more = true;
          break;
        }
      }
    }
    return made;
  }
  // A tile two or more villages claim: the winning claim (sim/claims settle; VB-157 settles it by custom and marks the border).
  let disputeHook = (st, t, claims) => CL.settle(st, claims, 'first');
  const onDispute = (fn) => { disputeHook = fn; };
  // Outland claims made at an earlier meeting (or all of them, `now`, when a scenario seeds the land of villages that have stood a while): a
  // tile still free becomes its claimant's; a tile taken in meanwhile, or staked by a household, drops them; a disputed tile goes to the winner.
  function settleOutland(st, now = false) {
    const due = [];
    for (const [t, list] of st.claims) {
      const vs = list.filter((c) => c.by.type === 'village' && c.why === 'outland' && (now || st.t - c.since >= YEAR / 2));
      if (vs.length) due.push([t, vs, list.length > vs.length]);
    }
    for (const [t, vs, staked] of due) {
      if (st.owner[t] !== 0 || staked) { for (const c of vs) CL.dropClaim(st, t, c.by); continue; }
      const win = vs.length === 1 ? vs[0] : disputeHook(st, t, vs, now);
      for (const c of vs) if (c !== win) CL.dropClaim(st, t, c.by);
      CL.realise(st, t, win.by);
    }
  }
  // ---- the commons wood ----
  // Village v's wood: the nearest forest in its own land; else the nearest forest within 24 walking steps that no other village holds or
  // claims, and no house or field stands on. -1 when there is none.
  function villageWood(st, v) {
    const w = st.w; let own = -1, od = Infinity, free = -1, fd = Infinity;
    for (const [t, d] of bfs(w, v.center, 24, walkable(w)).dist) {
      if (!wooded(w, t) || st.used.has(t)) continue;
      if (st.owner[t] === -v.id - 1) { if (d < od) { od = d; own = t; } } else if (d < fd && freeFor(st, t, v.id)) { fd = d; free = t; }
    }
    return own >= 0 ? own : free;
  }
  // The village takes its wood from its own land once it holds forest there: its farms' woodlots move with it.
  function moveWood(st, v, to) {
    if (to < 0 || to === v.commonsWood) return;
    for (const f of st.farmsteads) if (f.village === v.id && f.woodlot === v.commonsWood) f.woodlot = to;
    v.commonsWood = to;
  }
  // ---- the meeting, and the start ----
  // At each autumn meeting, after the customs: last year's claims are settled, then new ones made; a village whose commons wood lies outside
  // its land takes the nearest forest in it, if it holds any.
  function landMeeting(st) {
    settleOutland(st);
    claimOutland(st);
    for (const v of st.villages) {
      if (occupied(st, v) && !(v.commonsWood >= 0 && st.owner[v.commonsWood] === -v.id - 1)) {
        const wd = villageWood(st, v); if (wd >= 0 && st.owner[wd] === -v.id - 1) moveWood(st, v, wd);
      }
    }
  }
  // A scenario's villages: those that have stood a while (populous, heirs) hold their outland already; newcomers (the founders) claim theirs
  // on arrival, and it is theirs at the first meeting.
  function seedOutland(st, settled) {
    claimOutland(st);
    if (settled) settleOutland(st, true);
  }
  return { isOutland, freeFor, outlandOf, tally, claimOutland, settleOutland, onDispute, villageWood, moveWood, landMeeting, seedOutland, occupied };
})();
