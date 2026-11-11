// @sys sim/territory: the village's outland (utmark), claimed by need at the meetings and its own a year and a day later; borders settled by
// custom and marked with cairns; land a household or village may take in; the village's wood, the area it cuts its firewood in (VB-326)
VB['sim/territory'] = (() => {
  const { B } = VB['gen'];
  const { CLAIMS, YEAR, WOOD } = VB['sim/rules'];
  const { bfs } = VB['sim/hex'];
  const { walkable } = VB['sim/routes'];
  const Culture = VB['culture'];
  const CL = VB['sim/claims'];
  const { log, practice } = VB['sim/records'];
  const { emit } = VB['sim/events'];
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
  // Each village with an occupied farm claims free tiles within CLAIMS.outReach walking steps of its green, nearest first (first the tiles of
  // its wood that lie outside its land, which count as need though its outland be enough), until its outland and pending claims reach
  // CLAIMS.outPerFarm a farm. Villages take turns, one tile each, so none takes a contested strip first. A tile another village claims is
  // claimed too only when it lies nearer this village's green.
  // Border pressure (Kim, 2 Nov): a village still short once no free tile is left in reach may claim the outland of a neighbour that holds
  // more outland a farm than it does (a village whose farms all stand empty, any), nearest first, at most CLAIMS.pressPerMeeting tiles a
  // meeting, and not a tile a cairn gave the neighbour against it within CLAIMS.cairnYears. Disputes are settled at the next meeting
  // (settleOutland, border). Returns the number of new claims.
  function claimOutland(st) {
    const w = st.w, live = st.villages.filter((v) => occupied(st, v) > 0), { held, pending } = tally(st);
    const reach = new Map(live.map((v) => [v.id, bfs(w, v.center, CLAIMS.outReach, walkable(w)).dist]));
    const stepsFrom = (vid, t) => (reach.has(vid) ? reach.get(vid).get(t) ?? Infinity : Infinity);
    const holderOf = (t) => { const n = st.owner[t]; return n < 0 && isOutland(st, t, -n - 1) ? -n - 1 : -1; };
    const perFarm = (vid) => { const n = occupied(st, st.villages[vid]); return n ? held[vid] / n : Infinity; };
    const queues = [];
    for (const v of live) {
      const need = CLAIMS.outPerFarm * occupied(st, v) - held[v.id] - pending[v.id];
      if (need <= 0 && !v.wood.some((t) => st.owner[t] === 0)) continue;
      const near = [...reach.get(v.id)].filter(([t, d]) => d >= 1 && holdable(w, t)).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
      const list = near.filter(([t]) => st.owner[t] === 0), press = near.filter(([t]) => { const u = holderOf(t); return u >= 0 && u !== v.id; });
      // the tiles of its wood outside its land come first, nearest first, and count as need (VB-326)
      const allot = new Set(v.wood), first = list.filter(([t]) => allot.has(t)), rest = list.filter(([t]) => !allot.has(t));
      const wanted = Math.max(need, first.length), order = first.concat(rest);
      queues.push({ v, list: order.concat(press), i: 0, need: wanted, free: order.length, pressed: 0 });
    }
    let made = 0, more = true;
    const mine = (t, vid) => CL.claimsOn(st, t).some((c) => c.by.type === 'village' && c.by.id === vid);
    while (more) {
      more = false;
      for (const q of queues) {
        if (q.need <= 0) continue;
        while (q.i < q.list.length) {
          const k = q.i++, [t, d] = q.list[k], others = CL.claimsOn(st, t);
          if (mine(t, q.v.id) || others.some((c) => c.by.type !== 'village')) continue;
          if (k < q.free) { // free land
            if (st.owner[t] !== 0 || others.some((c) => stepsFrom(c.by.id, t) <= d)) continue;
          } else { // a neighbour's outland, once no free tile is left
            const u = holderOf(t), cairn = st.cairns.get(t);
            if (q.pressed >= CLAIMS.pressPerMeeting) { q.i = q.list.length; break; }
            if (u < 0 || u === q.v.id || !(perFarm(u) > perFarm(q.v.id))) continue;
            if (cairn && cairn.b === q.v.id && st.t - cairn.t < CLAIMS.cairnYears * YEAR) continue;
            q.pressed++;
          }
          CL.addClaim(st, t, VILLAGE(q.v.id), 'outland'); q.need--; made++; more = true;
          break;
        }
      }
    }
    return made;
  }
  // ---- borders (VB-157): a tile two or more villages claim ----
  // The rule that settles a dispute between villages: the Disputed claims practice they share; if they differ, their culture's custom; across
  // cultures, the first claim.
  function borderRule(st, vids) {
    const rules = new Set(vids.map((v) => practice(st, v).dispute));
    if (rules.size === 1) return [...rules][0];
    const env = st.cenv, cults = new Set(vids.map((v) => env.settlements[v].culture));
    if (cults.size > 1) return 'first';
    const k = Culture.IDX.dispute;
    return Culture.DIMS[k].opts[env.cultures[[...cults][0]].customs[k]][0];
  }
  // The winning claim of a disputed tile; the tile gets a cairn. `claims` may start with the holder's right to its outland (a realised claim
  // older than any other). Unless `quiet` (a scenario's old borders), the result is noted in `out` (a Map of 'winner,loser' to {n tiles, took
  // (tiles the winner took from the loser's land), rule, rules (that would have let the loser win)}) for the log, the grudges and grievances.
  function border(st, t, claims, quiet, out, holder = null) {
    const rule = borderRule(st, claims.map((c) => c.by.id)), win = CL.settle(st, claims, rule, {});
    for (const c of claims) {
      if (c === win) continue;
      st.cairns.set(t, { a: win.by.id, b: c.by.id, t: st.t });
      if (quiet) continue;
      const k = `${win.by.id},${c.by.id}`, o = out.get(k) || { n: 0, took: 0, rule, rules: CL.rulesFor(st, claims, c, {}) };
      o.n++; if (holder === c.by.id) o.took++; out.set(k, o);
    }
    return win;
  }
  // After a meeting's disputes: one log line for each pair of villages; each holder of the losing village remembers each holder of the winning
  // one ("Took our land"); the losing village's households lean towards the rules that would have let it win (sim/claims, sim/society).
  const RULE_WORD = { first: 'by the first claim', strongest: 'by the strongest claim', kin: 'by the first claim, none being kin',
    meeting: 'by the voices at the meeting' };
  function afterBorders(st, out) {
    const homes = (vid) => st.villages[vid].farmsteads.map((id) => st.farmsteads[id].household).filter((h) => h !== null).map((h) => st.households[h]);
    for (const [k, o] of out) {
      const [a, b] = k.split(',').map(Number), A = st.villages[a].name, Bn = st.villages[b].name, tiles = (n) => `${n} tile${n > 1 ? 's' : ''}`;
      const what = o.took ? `${A} takes ${tiles(o.took)} of ${Bn}'s outland${o.n > o.took ? ` and keeps ${o.n - o.took} more` : ''}`
        : `${A} keeps ${tiles(o.n)}`;
      log(st, `${A} and ${Bn} meet over their border, and set cairns: ${what}, ${RULE_WORD[o.rule]}.`, { kind: 'border', village: a, n: o.took });
      for (const hb of homes(b)) {
        if (o.rules.length) hb.grievance = { rules: o.rules, until: st.t + CLAIMS.grievanceYears * YEAR };
        for (const ha of homes(a)) {
          if (st.pawns[hb.holder].alive && st.pawns[ha.holder].alive) emit(st, 'borderLost', { loser: hb.holder, winner: ha.holder });
        }
      }
    }
  }
  // Outland claims made at an earlier meeting (or all of them, `now`, when a scenario seeds the land of villages that have stood a while): a
  // tile still free becomes its claimant's, or the winner's when villages dispute it (border; quietly at the start). A claim on a neighbour's
  // outland is a dispute with the holder, whose right is the oldest claim (a village with no occupied farm has nobody to defend it). A tile
  // taken into use meanwhile, or staked by a household, drops the claims.
  function settleOutland(st, now = false) {
    const due = [], out = new Map();
    for (const [t, list] of st.claims) {
      const vs = list.filter((c) => c.by.type === 'village' && c.why === 'outland' && (now || st.t - c.since >= YEAR / 2));
      if (vs.length) due.push([t, vs, list.length > vs.length]);
    }
    for (const [t, vs, staked] of due) {
      const n = st.owner[t], u = n < 0 && isOutland(st, t, -n - 1) ? -n - 1 : -1;
      if ((n !== 0 && u < 0) || staked) { for (const c of vs) CL.dropClaim(st, t, c.by); continue; }
      let win;
      if (u >= 0) { // border pressure: the holder's right against the claims
        const right = { by: VILLAGE(u), state: 'realised', why: 'outland', since: -Infinity, renewed: st.t, seq: 0, until: null };
        const all = occupied(st, st.villages[u]) ? [right, ...vs] : vs;
        win = all.length === 1 ? all[0] : border(st, t, all, now, out, u);
      } else win = vs.length === 1 ? vs[0] : border(st, t, vs, now, out);
      for (const c of vs) CL.dropClaim(st, t, c.by);
      if (win.by.id !== u) CL.realise(st, t, win.by);
    }
    afterBorders(st, out);
  }
  // ---- the village's wood (VB-326) ----
  // A village cuts its firewood in an allotted area, v.wood: WOOD.perHousehold wooded tiles for each live household, at least WOOD.least and
  // at most WOOD.cap; the nearest within WOOD.reach walking steps of its centre, first those of its own land, then forest no other village
  // holds or claims (freeFor), never a tile in use (house, field, meadow, plot), a green, or another village's wood. Reckoned at the autumn
  // meeting (landMeeting), when a farm is founded in the village, and when a tile of it is cut bare or built on (woodTaken); never daily. One
  // bounded search (the tiles within WOOD.reach) a call. Empty when no forest lies in reach.
  const woodSize = (st, v) => Math.min(WOOD.cap, Math.max(WOOD.least, WOOD.perHousehold * occupied(st, v)));
  function reckonWood(st, v) {
    const w = st.w, others = new Set(), own = [], free = [];
    for (const u of st.villages) if (u !== v && u.wood) for (const t of u.wood) others.add(t);
    for (const [t, d] of bfs(w, v.center, WOOD.reach, walkable(w)).dist) {
      if (!wooded(w, t) || w.trees[t] <= 0 || st.used.has(t) || others.has(t) || !freeFor(st, t, v.id)) continue;
      (st.owner[t] === -v.id - 1 ? own : free).push([t, d]);
    }
    const near = (a, b) => a[1] - b[1] || a[0] - b[0];
    const wood = own.sort(near).concat(free.sort(near)).slice(0, woodSize(st, v)).map(([t]) => t);
    if (st.landDirty) for (const t of new Set([...(v.wood || []), ...wood])) st.landDirty.add(t);
    v.wood = wood;
    return wood;
  }
  // Tile t was cut bare, or built on: each village whose wood held it reckons its wood again.
  function woodTaken(st, t) {
    for (const v of st.villages) if (v.wood && v.wood.includes(t)) reckonWood(st, v);
  }
  // The village whose wood holds tile t, or null (for the tile panel).
  const woodOf = (st, t) => st.villages.find((v) => v.wood && v.wood.includes(t)) || null;
  // ---- the meeting, and the start ----
  // At each autumn meeting, after the customs: last year's claims are settled, then new ones made, and each village reckons its wood; one
  // with households and no forest in reach has none, and the log says so.
  function landMeeting(st) {
    settleOutland(st);
    claimOutland(st);
    for (const v of st.villages) {
      if (!reckonWood(st, v).length && occupied(st, v)) {
        log(st, `${v.name} has no wood within reach to cut.`, { kind: 'noWood', village: v.id });
      }
    }
  }
  // A scenario's villages: those that have stood a while (populous, heirs) hold their outland already; newcomers (the founders) claim theirs
  // on arrival, and it is theirs at the first meeting.
  function seedOutland(st, settled) {
    claimOutland(st);
    if (settled) settleOutland(st, true);
    for (const v of st.villages) reckonWood(st, v);
  }
  return { isOutland, freeFor, outlandOf, tally, claimOutland, settleOutland, borderRule, reckonWood, woodTaken, woodOf, landMeeting, seedOutland,
    occupied };
})();
