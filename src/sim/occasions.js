// @sys sim/occasions: occasions (VB-126): a gathering at a place from a start to an end in game hours, of those asked: the village meeting
//   on the green, the wedding feast and the funeral ale at a farm; who is asked, who sets out, and the due-queue that sends and ends them
// @state st.occasions[]: the occasions called and not yet over, sorted by `due` (after those due at the same time), each {id, kind
//   ('meeting' | 'wedding' | 'funeral'), for[] (pawn ids it is held for: the couple, the dead; empty for a meeting), village, farm
//   (farmstead id, or null for a meeting), tile, x, y (the spot, map units), start, end (game hours), overrides (work stops for it),
//   asked[] ({id, leave (the game hour it sets out), hours (its walk there)}, in order of leave, each taken off once it sets out or cannot
//   come), come[] (the ids that set out), due (game hours: the next time the step looks at it)}. Plain data, saved; ended ones are dropped.
// @state st.occasionSeq: number; the next occasion's id; ids are never reused
// @state agent.occasion: the id of the occasion the pawn set out for and stands at until its end, or null
VB['sim/occasions'] = (() => {
  const { next: rnd } = VB['sim/rng'];
  const { DAY, SPEED, WORK, SOCIAL, cal } = VB['sim/rules'];
  const { findRoute, routeCost } = VB['sim/routes'];
  const { kinNear, membersOf, voiceOf, fullName, log, atFarm } = VB['sim/records'];
  const { issue, unplanned } = VB['sim/commands'];
  const { emit } = VB['sim/events'], { remember } = VB['sim/relations'], Stores = VB['sim/stores'];
  const { BREW } = VB['sim/rules'];
  // The occasions (Kim, 10 Nov; QUESTION_ARCHIVE.md, "VB-126"): their hours in the day, and whether work stops for them. The meeting is
  // held at noon (sim/lifecycle's stages, from 12:00): its people stand about the green from 10:00 until its four steps are done.
  const OCCASIONS = {
    meeting: { from: 10, to: 12.5, overrides: true, at: 'At the village meeting', go: 'Walking to the village meeting' },
    wedding: { from: 16, to: 21, overrides: false, at: 'At a wedding', go: 'Walking to a wedding' },
    funeral: { from: 16, to: 21, overrides: true, at: 'At a funeral ale', go: 'Walking to a funeral ale' },
  };
  const REACH = 12; // a day's walk, in hours (design.md, Between villages: Near and far): kin further away are not asked
  const MIN_AGE = SOCIAL.talk.minAge; // younger children stay at home
  const dayOf = (t) => Math.floor(t / DAY) * DAY;
  // The occasion o goes into the queue at its due time, after those due at the same time.
  function enqueue(st, o) {
    let i = st.occasions.length;
    while (i > 0 && st.occasions[i - 1].due > o.due) i--;
    st.occasions.splice(i, 0, o);
  }
  // Calls an occasion of `kind` at a tile and spot, on the day that begins at `day`, for the pawns `ids` with their walking hours; the
  // asked set out, each, `hours` before the start (not before the day's work begins), so that the far arrive in time.
  function call(st, kind, day, place, ids, hours, forIds) {
    const K = OCCASIONS[kind], start = day + K.from, asked = [];
    ids.forEach((id, n) => asked.push({ id, leave: Math.max(day + WORK[0], start - Math.floor(hours[n])), hours: hours[n] }));
    asked.sort((a, b) => a.leave - b.leave || a.id - b.id);
    const o = { id: st.occasionSeq++, kind, for: forIds, village: place.village, farm: place.farm, tile: place.tile, x: place.x, y: place.y,
      start, end: day + K.to, overrides: K.overrides, asked, come: [], due: asked.length ? asked[0].leave : day + K.to };
    enqueue(st, o);
    return o;
  }
  // The walking hours from household hh's house to tile `to`, or Infinity beyond a day's walk; one bounded search (ROUTE's costs are in
  // meadow steps, walked at SPEED an hour), kept in `memo` for the household's other members.
  function hoursFrom(st, hh, to, memo) {
    if (memo.has(hh.id)) return memo.get(hh.id);
    const from = st.farmsteads[hh.farmstead].house, p = findRoute(st.w, from, to, REACH * SPEED);
    const h = p ? routeCost(st.w, p) / SPEED : Infinity; memo.set(hh.id, h);
    return h;
  }
  // The guests of a farm's occasion: the living of `ids` (in order, each once), old enough, with a home within a day's walk of the farm.
  function guests(st, f, ids, skip = null) {
    const out = [], hours = [], seen = new Set(), memo = new Map();
    VB.count.occasionAsked += ids.length;
    for (const id of ids) {
      if (seen.has(id) || id === skip) continue;
      seen.add(id);
      const p = st.pawns[id];
      if (!p.alive || p.age < MIN_AGE || p.household === null) continue;
      const hh = st.households[p.household], h = hh.farmstead === f.id ? 0 : hoursFrom(st, hh, f.house, memo);
      if (h <= REACH) { out.push(id); hours.push(h); }
    }
    return { ids: out, hours };
  }
  // A farm's occasion is held in its yard, before the house.
  const yard = (st, f) => ({ village: f.village, farm: f.id, tile: f.house, x: st.w.hx[f.house] + 2, y: st.w.hy[f.house] + 20 });
  // A wedding (sim/lifecycle, wed): the day after, at the couple's farm, the couple, their household and the near kin of both.
  function wedding(st, m, f, home) {
    const hh = st.households[home], farm = st.farmsteads[hh.farmstead];
    const g = guests(st, farm, [m, f, ...hh.members, ...kinNear(st, m), ...kinNear(st, f)]);
    if (g.ids.length) call(st, 'wedding', dayOf(st.t) + DAY, yard(st, farm), g.ids, g.hours, [m, f]);
  }
  // A funeral ale (sim/lifecycle, killPawn, before the dead leaves its household): the day after, at the farm of the dead, its household
  // and its near kin. Two deaths of one farm on one day have one ale.
  function funeral(st, id) {
    const p = st.pawns[id]; if (p.household === null) return;
    const hh = st.households[p.household], farm = st.farmsteads[hh.farmstead], day = dayOf(st.t) + DAY;
    const same = st.occasions.find((o) => o.kind === 'funeral' && o.farm === farm.id && o.start === day + OCCASIONS.funeral.from);
    if (same) { same.for.push(id); return; }
    const g = guests(st, farm, [...hh.members, ...kinNear(st, id)], id);
    if (g.ids.length) call(st, 'funeral', day, yard(st, farm), g.ids, g.hours, [id]);
  }
  // The day of the meetings (autumn day 10, at midnight; sim/clock): each village calls the people with a voice to its green.
  function callMeetings(st) {
    const day = dayOf(st.t);
    for (const v of st.villages) {
      const s = st.cenv.settlements[v.id]; if (!s) continue;
      const people = membersOf(st, v.id), ids = [];
      VB.count.occasionAsked += people.length;
      for (const p of people) if (voiceOf(st, p, s) > 0) ids.push(p.id);
      if (!ids.length) continue;
      const c = v.center;
      call(st, 'meeting', day, { village: v.id, farm: null, tile: c, x: st.w.hx[c], y: st.w.hy[c] + 6 }, ids, ids.map(() => 0), []);
    }
  }
  // Pawn a is held at another occasion than o, or is at o already. The one an occasion is held for (a spouse, at its wedding) leaves
  // another for it: two siblings may marry on one round.
  const held = (a, o) => a.occasion === o.id || (a.occasion !== null && !o.for.includes(a.id));
  // Why pawn id may not set out for occasion oid, or null.
  function cannotAttend(st, id, oid) {
    const o = st.occasions.find((x) => x.id === oid), a = st.agents[id];
    if (!o) return `there is no occasion ${oid}`;
    if (st.t >= o.end) return `occasion ${oid} is over`;
    if (held(a, o)) return `pawn ${id} is at occasion ${a.occasion}`;
    if (a.phase === 'back') return `pawn ${id} is carrying a load home`;
    return null;
  }
  // Pawn a sets out for occasion oid (the attend verb, which then walks it there and has it stand about until the end): where it stands,
  // somewhere in a ring about the spot, close enough for talk (sim/relations), and until when. [tile, x, y, until]
  function join(st, a, oid) {
    const o = st.occasions.find((x) => x.id === oid), th = rnd(st.rng.occasions) * 2 * Math.PI, r = 5 + rnd(st.rng.occasions) * 9;
    a.occasion = o.id; o.come.push(a.id);
    return [o.tile, o.x + Math.cos(th) * r, o.y + Math.sin(th) * r * 0.6, o.end];
  }
  // Whether pawn a can go now: not on the player's hands, not held at another occasion; for an occasion that stops work, anyone not carrying a
  // load home; else only those with no work in hand.
  const canGo = (st, a, o) => !unplanned(st, a.id) && !held(a, o) && a.phase !== 'back'
    && (o.overrides || (!a.job && (a.phase === null || a.phase === 'home')));
  // The occasion o's turn: those whose time to set out has come go if they can; one who cannot yet is looked at again in an hour, while it
  // could still arrive an hour before the end. At the end, o is over.
  function visit(st) {
    const o = st.occasions[0];
    if (st.t >= o.end) { finish(st, o); return; }
    let again = Infinity;
    for (let i = 0; i < o.asked.length && o.asked[i].leave <= st.t;) {
      const g = o.asked[i], a = st.agents[g.id];
      if (!st.pawns[g.id].alive || st.t + g.hours > o.end - 1) { o.asked.splice(i, 1); continue; }
      if (canGo(st, a, o) && issue(st, { actor: g.id, verb: 'attend', target: o.id, source: 'occasion' }) === true) { o.asked.splice(i, 1); continue; }
      again = st.t + 1; i++;
    }
    const nextLeave = o.asked.find((g) => g.leave > st.t);
    o.due = Math.min(again, nextLeave ? nextLeave.leave : Infinity, o.end);
    st.occasions.splice(st.occasions.indexOf(o), 1); enqueue(st, o);
  }
  // The host household pours its ale for those who came (VB-305; a barrel serves BREW.guests): as many barrels as it has for them, used up through
  // sim/stores with the reason 'pour'. Each guest of another household remembers the host's holder for it (SOCIAL.memories.ale), and the host's
  // standing is told to sim/society ('alePoured'). Returns the barrels poured.
  function pourAle(st, f, present) {
    if (f.household === null) return 0;
    const hh = st.households[f.household];
    if (hh.dissolved || hh.holder === null || !st.pawns[hh.holder].alive) return 0;
    const barrels = Stores.pour(st, hh, Math.min(Stores.aleOf(st, hh), Math.ceil(present.length / BREW.guests)));
    if (!barrels) return 0;
    for (const id of present) if (st.pawns[id].alive && st.pawns[id].household !== hh.id) remember(st, id, hh.holder, 'ale');
    emit(st, 'alePoured', { host: hh.holder, household: hh.id, barrels });
    return barrels;
  }
  // The occasion ends: those who came are free; outside working hours those outdoors go home. A wedding or a funeral ale is told in the log.
  function finish(st, o) {
    st.occasions.splice(st.occasions.indexOf(o), 1);
    const h = cal(st.t).hour, late = h >= WORK[1] || h < WORK[0];
    let far = 0;
    const present = [];
    for (const id of o.come) {
      const a = st.agents[id];
      if (a.occasion !== o.id) continue;
      a.occasion = null; present.push(id);
      if (o.village !== null && st.pawns[id].household !== null && st.farmsteads[st.households[st.pawns[id].household].farmstead].village !== o.village) far++;
      if (late && !a.inside && st.pawns[id].alive && !unplanned(st, id)) issue(st, { actor: id, verb: 'goHome', source: 'occasion' });
    }
    if (o.kind === 'meeting') return;
    const f = st.farmsteads[o.farm], n = o.come.length, barrels = pourAle(st, f, present);
    const ale = barrels ? `; ${barrels === 1 ? 'a barrel' : barrels + ' barrels'} of ale poured` : '';
    const came = `${n} came${far ? `, ${far} of them from other villages` : ''}${ale}`;
    const at = atFarm(f);
    if (o.kind === 'wedding') {
      log(st, `The wedding of ${fullName(st.pawns[o.for[0]])} and ${fullName(st.pawns[o.for[1]])} at ${f.name}: ${came}.`,
        { kind: 'wedding', pawn: o.for[0], other: o.for[1], n, ...at });
    } else {
      const names = o.for.map((id) => fullName(st.pawns[id])).join(' and ');
      log(st, `The funeral ale for ${names} at ${f.name}: ${came}.`, { kind: 'funeralAle', pawn: o.for[0], n, ...at });
    }
  }
  // Each six-minute step (sim/clock): the occasions due, each staying in the queue while its turn is taken (the attend verb finds it
  // there). Only the first one's due time is read, so nothing is polled (Rules for cost, 4).
  function occasionsDue(st) {
    while (st.occasions.length && st.occasions[0].due <= st.t) visit(st);
  }
  // What the pawn is doing there, for its card (sim/agents describe), or null.
  function occasionLabel(st, a) {
    if (a.occasion === null) return null;
    const o = st.occasions.find((x) => x.id === a.occasion);
    return o ? OCCASIONS[o.kind][a.path ? 'go' : 'at'] : null;
  }
  return { OCCASIONS, REACH, wedding, funeral, callMeetings, cannotAttend, join, occasionsDue, occasionLabel };
})();
