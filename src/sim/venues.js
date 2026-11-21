// @sys sim/venues: the village's gatherings by custom (VB-522; split from sim/occasions, VB-1270): the ale evening a holder opens its house
//   for (its check, its asking, the holder's choice at its planning day, what its end pours and books) and the season's rite on the green
//   (its day, its asking, its leader and the ties to it); sim/occasions calls, sends and ends them
// @state village.riteDays: [spring, summer, winter] days (0-based) of a village's own rites, each within RITE.spread days after the season's day;
//   drawn when first asked, absent before (VB-775)
VB['sim/venues'] = (() => {
  const { next: rnd } = VB['sim/rng'];
  const { DAY, SOCIAL, BREW, ALE_EVENING, RITE, cal } = VB['sim/rules'];
  const { fullName, log, atFarm, age, unplanned } = VB['sim/records'];
  const { issue, register } = VB['sim/commands'];
  const { free } = VB['sim/agents'];
  const { hoursBetween } = VB['sim/villagehours'],
    { opinionOf } = VB['sim/relations'],
    { addTie } = VB['sim/ties'],
    { on } = VB['sim/events'],
    Encounters = VB['sim/encounters'],
    Stores = VB['sim/stores'],
    Traits = VB['sim/traits'],
    Culture = VB['culture'];
  const { pourAle, owing, bookAll } = VB['sim/feast'];
  const { OCCASIONS, call, yard, dayOf, onEnd } = VB['sim/occasions'];
  const MIN_AGE = SOCIAL.talk.minAge; // younger children stay at home
  // ---- the ale evening (VB-522; design.md, Where pawns meet: The ale evening) ----
  const ADULT = 16; // who is asked to an ale evening or comes to the rite: the adults
  // The barrels household hh holds that no occasion called at its farm needs: those called keep a barrel for each BREW.guests asked or
  // come (at least one). The occasions called are few (live only), so the walk is short.
  function spareAle(st, hh) {
    let kept = 0;
    for (const o of st.occasions)
      if (o.farm === hh.farmstead) kept += Math.max(1, Math.ceil((o.asked.length + o.come.length) / BREW.guests));
    return Stores.aleOf(st, hh) - kept;
  }
  // The ale evening called today in village v, or null.
  function aleToday(st, v) {
    const day = dayOf(st.t);
    for (const o of st.occasions) if (o.kind === 'ale' && o.village === v && dayOf(o.start) === day) return o;
    return null;
  }
  // Why pawn id may not open its house for an ale evening now (the verb callAle), or null: it holds its household's farm, its
  // household holds a barrel no occasion at its farm needs, the working day is not over, and no other farm of its village has one tonight.
  function cannotCallAle(st, id) {
    const p = st.pawns[id],
      hh = p.household === null ? null : st.households[p.household];
    if (!hh || hh.dissolved || hh.holder !== id) return "only a household's holder opens its house";
    const f = hh.farmstead === null ? null : st.farmsteads[hh.farmstead];
    if (!f || f.household !== hh.id) return 'its household holds no farm of its own';
    if (cal(st.t).hour >= OCCASIONS.ale.from)
      return 'too late in the day: an ale evening is called before the end of work';
    if (Stores.aleOf(st, hh) < 1) return 'its household holds no barrel of ale';
    if (spareAle(st, hh) < 1) return 'its ale is kept for an occasion at its farm';
    const o = aleToday(st, f.village);
    if (o) return `${st.farmsteads[o.farm].name} holds the village's ale evening tonight`;
    return null;
  }
  // The holder id opens its house tonight (the verb callAle, its check passed): the adults of its village and of the villages within
  // ALE_EVENING.reach walking hours of it (the table of walking hours) are asked, the near villages first, and each comes by its own wish
  // until ALE_EVENING.guests have said yes; the household's own come. One pass over the live households, and a draw for each adult asked.
  // A pawn on a journey or hungry at 0.5 or more stays at home; one at work when it should set out stays too (canGo). Called only when
  // someone said yes; returns the occasion or null.
  function callAle(st, id) {
    const E = ALE_EVENING,
      host = st.households[st.pawns[id].household],
      f = st.farmsteads[host.farmstead],
      v = f.village,
      walk = new Map([[v, 0]]);
    if (st.villageHours)
      for (const u of st.villages) {
        const h = u.id === v ? 0 : hoursBetween(st, v, u.id);
        if (h < E.reach) walk.set(u.id, h);
      }
    const by = new Map(); // village id to its households, in id order
    for (const k of st.liveHouseholds) {
      const hh = st.households[k],
        u = hh.farmstead === null ? null : st.farmsteads[hh.farmstead].village;
      if (u === null || !walk.has(u) || hh === host) continue;
      if (!by.has(u)) by.set(u, []);
      by.get(u).push(hh);
    }
    const ids = [],
      hours = [];
    for (const m of host.members)
      if (st.pawns[m].alive && age(st, st.pawns[m]) >= MIN_AGE) {
        ids.push(m);
        hours.push(0);
      }
    let yes = 0;
    const order = [...by.keys()].sort((a, b) => walk.get(a) - walk.get(b) || a - b);
    for (const u of order) {
      const h = walk.get(u);
      for (const hh of by.get(u))
        for (const m of hh.members) {
          if (yes >= E.guests) break;
          const p = st.pawns[m];
          if (!p.alive || age(st, p) < ADULT) continue;
          VB.count.occasionAsked++;
          if (p.hunger >= 0.5 || st.agents[m].away !== undefined) continue;
          const chance =
            E.come * (0.5 + Traits.of(st, m, 'sociability')) * (1 + opinionOf(st, m, id)) * (1 - h / E.reach);
          if (!(rnd(st.rng.occasions) < chance)) continue;
          yes++;
          ids.push(m);
          hours.push(h);
        }
    }
    if (!yes) return null;
    VB.count.aleCalled++;
    return call(st, 'ale', dayOf(st.t), yard(st, f), ids, hours, [id]);
  }
  // A holder decides at its planning day's review (sim/plans' planReviewed, why 'day'; no pass of its own) whether to open its house: while
  // its household holds a barrel, at ALE_EVENING.call × (0.5 + sociability) × (0.5 + ambition) a day, for the days its reviews are apart.
  // The played pawn decides for itself (the verb, from the action bar).
  on('planReviewed', (st, d) => {
    if (d.why !== 'day' || d.plan.holder.type !== 'household') return;
    const hh = st.households[d.plan.holder.id],
      id = hh.holder;
    if (id === null || id === undefined || !st.pawns[id].alive || unplanned(st, id)) return;
    if (Stores.aleOf(st, hh) < 1) return;
    const days = Math.max(1, Math.round((d.plan.nextReview - st.t) / DAY)),
      day = Math.min(
        1,
        ALE_EVENING.call * (0.5 + Traits.of(st, id, 'sociability')) * (0.5 + Traits.of(st, id, 'ambition')),
      );
    if (rnd(st.rng.occasions) >= 1 - (1 - day) ** days) return;
    if (cannotCallAle(st, id) === null) issue(st, { actor: id, verb: 'callAle', source: 'occasion' });
  });
  // An ale evening ends: if a guest of another household came, the host pours its one barrel for those present (pourAle: the guests'
  // memory, the host's standing), and each guest household owes the host's holder what its members drank, at its grain, as a feast books
  // it (owing, bookAll). Told in the log.
  function aleEnds(st, o, present, far) {
    const f = st.farmsteads[o.farm],
      host = f.household === null ? null : st.households[f.household];
    if (!host) return;
    const guests = present.filter((id) => st.pawns[id].household !== host.id);
    if (!guests.length) return;
    const barrels = pourAle(st, f, present, 1);
    if (!barrels) return;
    const owed = new Map(),
      each = (barrels * BREW.grain) / present.length;
    for (const id of present) {
      const g = owing(st, host, st.pawns[id]);
      if (g) owed.set(g, (owed.get(g) || 0) + each);
    }
    bookAll(st, host, owed);
    const by = st.pawns[host.holder],
      from = far ? `, ${far} of them from other villages` : '';
    log(st, `${fullName(by)} opened ${f.name} for an ale evening: ${guests.length} came${from}.`, {
      kind: 'aleEvening',
      pawn: by.id,
      n: guests.length,
      ...atFarm(f),
    });
  }
  // ---- the season's rite (VB-522; design.md, Where pawns meet: The season's rite) ----
  // The days a rite may fall on: a season's day of RITE.days, and RITE.spread days after it (VB-775).
  const riteDay = (c) => RITE.days.some((d) => c.season === d[0] && c.sday >= d[1] && c.sday <= d[1] + RITE.spread);
  // A village's own three rite days (VB-775; design.md, The season's rite: On a village's own days), drawn once, the first time it is
  // asked about, from the occasions stream: one within RITE.spread days after each of RITE.days. Plain data on the village.
  function riteDaysOf(st, v) {
    // lint-allow: owner sim/venues draws its villages' rite days
    if (!v.riteDays) v.riteDays = RITE.days.map((d) => d[1] + Math.floor(rnd(st.rng.occasions) * (RITE.spread + 1)));
    return v.riteDays;
  }
  // Does the culture of village v keep its own rite days (PRACTICES.riteDays), or the same days everywhere (VB-522 as built)?
  function keepsOwnDays(st, v) {
    const s = st.cenv && st.cenv.settlements && st.cenv.settlements[v.id];
    return Culture.practiceOf(s && st.cenv.cultures[s.culture], 'riteDays') === 'own';
  }
  // Does village v hold its rite today (c = the calendar day)?
  function heldToday(st, v, c) {
    const i = RITE.days.findIndex((d) => d[0] === c.season);
    return i >= 0 && c.sday === (keepsOwnDays(st, v) ? riteDaysOf(st, v)[i] : RITE.days[i][1]);
  }
  // On a rite's day, at midnight (sim/clock): each village with a green whose day it is calls a rite there; its adults come, each at
  // RITE.come + RITE.piety × its piety. Under 'common' days, those of a village with no green (a lone farm) within RITE.reach walking
  // hours of one go to the nearest. Under 'own' days, the adults of any other village within RITE.reach come too, at that chance times
  // (1 - walk / RITE.reach), to one rite a day (their own village's first). One pass over the live households.
  function callRites(st) {
    const c = cal(st.t),
      held = st.villages.filter((v) => v.green && heldToday(st, v, c));
    if (!held.length) return;
    const asked = new Map(), // a green's village to {ids, hours}
      going = new Set();
    const ask = (g, m, h, scale) => {
      const p = st.pawns[m];
      if (!p.alive || age(st, p) < ADULT || going.has(m)) return;
      VB.count.occasionAsked++;
      if (!(rnd(st.rng.occasions) < (RITE.come + RITE.piety * Traits.of(st, m, 'piety')) * scale)) return;
      going.add(m);
      if (!asked.has(g)) asked.set(g, { ids: [], hours: [] });
      asked.get(g).ids.push(m);
      asked.get(g).hours.push(h);
    };
    const to = new Map(); // a village id to the held greens its adults may go to: [green id, walking hours], nearest first
    for (const v of st.villages) {
      const own = keepsOwnDays(st, v),
        list = [];
      for (const g of held) {
        if (g.id === v.id) list.push([g.id, 0]);
        else if (own || !v.green) {
          const h = st.villageHours ? hoursBetween(st, v.id, g.id) : Infinity;
          if (h <= RITE.reach) list.push([g.id, h]);
        }
      }
      list.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
      if (list.length) to.set(v.id, own ? list : list.slice(0, 1));
    }
    for (const k of st.liveHouseholds) {
      const hh = st.households[k],
        vid = hh.farmstead === null ? null : st.farmsteads[hh.farmstead].village,
        list = vid === null ? null : to.get(vid);
      if (!list) continue;
      const scale = keepsOwnDays(st, st.villages[vid]) ? 1 : 0;
      for (const m of hh.members)
        for (const [g, h] of list) {
          ask(g, m, h, scale ? 1 - h / RITE.reach : 1);
          if (going.has(m)) break;
        }
    }
    const day = dayOf(st.t);
    for (const v of held) {
      const a = asked.get(v.id);
      if (!a) continue;
      VB.count.riteCalled++;
      const c = v.center,
        place = { village: v.id, farm: null, tile: c, x: st.w.hx[c], y: st.w.hy[c] + 6 };
      call(st, 'rite', day, place, a.ids, a.hours, []);
    }
  }
  // The rite's leader: of those standing at it, the holder highest in piety × standing (read now, stored nowhere but in its event); with
  // no holder there, whoever stands highest. Null when nobody stands there; else {id, heard (Encounters.said: all present but it)}.
  function lead(st, o) {
    let best = null,
      bv = -Infinity;
    for (const id of Encounters.present(st, o.id)) {
      const p = st.pawns[id],
        holder = p.household !== null && st.households[p.household].holder === id,
        v = (holder ? 1e6 : 0) + Traits.of(st, id, 'piety') * (p.standing ?? 1);
      if (v > bv) {
        bv = v;
        best = id;
      }
    }
    return best === null ? null : { id: best, heard: Encounters.said(st, o.id, best) };
  }
  // The rite ends: those who heard the leader each gain SOCIAL.ties.rite to it, one way and to it only; told in the log.
  function riteEnds(st, o, led, present, far) {
    if (!led) return;
    for (const id of led.heard) if (st.pawns[id].alive) addTie(st, id, led.id, SOCIAL.ties.rite);
    const v = st.villages[o.village],
      by = st.pawns[led.id],
      from = far ? `, ${far} of them from other villages` : '';
    log(st, `The rite on the green of ${v.name}, led by ${fullName(by)}: ${present.length} came${from}.`, {
      kind: 'rite',
      pawn: by.id,
      n: present.length,
      village: v.id,
    });
  }
  onEnd('ale', { end: (st, o, pre, present, far) => aleEnds(st, o, present, far) });
  onEnd('rite', { before: lead, end: riteEnds });
  // callAle: the actor, its household's holder, opens its house tonight for an ale evening on a barrel no occasion at its farm needs
  // (sim/occasions, VB-522); its village and the villages within reach are asked
  register('callAle', {
    check: (st, c) => free(st, c.actor) || cannotCallAle(st, c.actor),
    run: (st, c) => callAle(st, c.actor),
  });
  return { spareAle, cannotCallAle, callAle, riteDay, callRites };
})();
