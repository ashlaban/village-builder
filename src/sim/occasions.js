// @sys sim/occasions: occasions (VB-126): a gathering at a place from a start to an end in game hours, of those asked: the village meeting
//   on the green (at its village's turn), the wedding feast and the funeral ale at a farm, the ale evening at a holder's farm and the
//   season's rite on the green (VB-522); who is asked, who sets out, and the due-queue that sends and ends them; the villages' turns of the
//   meetings and the moving round
// @state st.occasions[]: the occasions called and not yet over, sorted by `due` (after those due at the same time), each {id, kind
//   ('meeting' | 'wedding' | 'funeral' | 'ale' | 'rite'), for[] (pawn ids it is held for: the couple, the dead, an ale evening's host;
//   empty for a meeting and a rite), village, farm (farmstead id, or null on a green), tile, x, y (the spot, map units), start, end
//   (game hours), overrides (work stops for it), asked[] ({id, leave (the game hour it sets out), hours (its walk there)}, in order of
//   leave, each taken off once it sets out or cannot come), come[] (the ids that set out), due (game hours: the next time the step
//   looks at it)}. Plain data, saved; ended ones are dropped.
// @state st.occasionSeq: number; the next occasion's id; ids are never reused
// @state agent.occasion: the id of the occasion the pawn set out for and stands at until its end, or null
VB['sim/occasions'] = (() => {
  const { next: rnd } = VB['sim/rng'];
  const { DAY, SPEED, WORK, SOCIAL, TICKS, cal } = VB['sim/rules'];
  const { findRoute, routeCost } = VB['sim/routes'];
  const { kinNear, membersOf, voiceOf, fullName, log, atFarm, age } = VB['sim/records'];
  const { issue, unplanned } = VB['sim/commands'];
  const { emit } = VB['sim/events'],
    { remember } = VB['sim/relations'],
    Stores = VB['sim/stores'];
  const { BREW, FEAST, YEAR_DAYS, ALE_EVENING, RITE, WORK: WORK_HOURS } = VB['sim/rules'];
  const { hoursBetween } = VB['sim/routes'],
    { opinionOf, addTie } = VB['sim/relations'],
    { on } = VB['sim/events'],
    Encounters = VB['sim/encounters'];
  const Rules = VB['sim/registry'],
    Traits = VB['sim/traits'],
    { book } = VB['sim/relations'],
    { dailyNeed } = VB['sim/hunger'];
  // The occasions (Kim, 10 Nov; QUESTION_ARCHIVE.md, "VB-126"): their hours in the day, and whether work stops for them. A village's
  // meeting is held on its own 6-minute step from noon (sim/lifecycle, VB-278): its people stand about the green from two hours before it
  // until the step after it, so `from` and `to` are the hours of the first village's, and a later village's are its turn later.
  const OCCASIONS = {
    meeting: {
      from: 10,
      to: 12 + 1 / TICKS,
      overrides: true,
      at: 'At the village meeting',
      go: 'Walking to the village meeting',
    },
    wedding: { from: 16, to: 21, overrides: false, at: 'At a wedding', go: 'Walking to a wedding' },
    funeral: { from: 16, to: 21, overrides: true, at: 'At a funeral ale', go: 'Walking to a funeral ale' },
    // the ale evening (VB-522): from the end of work to ALE_EVENING.until; the season's rite: at RITE.hour for RITE.hours. Neither stops work.
    ale: {
      from: WORK_HOURS[1],
      to: ALE_EVENING.until,
      overrides: false,
      at: 'At an ale evening',
      go: 'Walking to an ale evening',
    },
    rite: {
      from: RITE.hour,
      to: RITE.hour + RITE.hours,
      overrides: false,
      at: 'At the rite',
      go: 'Walking to the rite',
    },
  };
  // The villages' turns (VB-277, VB-278): the moving round and the meetings hold a village a 6-minute step from noon, in the order of
  // village id, in a window of VILLAGE_STEPS steps. The first turns by the year (VB-280): the window starts at village `year mod n` and goes
  // on in id order, wrapping, so village k holds slot j = (k - year) mod n, on step j while n is at most VILLAGE_STEPS, else floor(j * steps / n).
  const VILLAGE_STEPS = 60;
  const villageSlot = (k, n, year) => (((k - year) % n) + n) % n;
  const villageTurn = (k, n, year) => {
    const j = villageSlot(k, n, year);
    return n <= VILLAGE_STEPS ? j : Math.floor((j * VILLAGE_STEPS) / n);
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
  function call(st, kind, day, place, ids, hours, forIds, later = 0) {
    const K = OCCASIONS[kind],
      start = day + K.from + later,
      asked = [];
    ids.forEach((id, n) =>
      asked.push({ id, leave: Math.max(day + WORK[0], start - Math.floor(hours[n])), hours: hours[n] }),
    );
    asked.sort((a, b) => a.leave - b.leave || a.id - b.id);
    const o = {
      id: st.occasionSeq++,
      kind,
      for: forIds,
      village: place.village,
      farm: place.farm,
      tile: place.tile,
      x: place.x,
      y: place.y,
      start,
      end: day + K.to + later,
      overrides: K.overrides,
      asked,
      come: [],
      due: asked.length ? asked[0].leave : day + K.to,
    };
    enqueue(st, o);
    return o;
  }
  // The walking hours from household hh's house to tile `to`, or Infinity beyond a day's walk; one bounded search (ROUTE's costs are in
  // meadow steps, walked at SPEED an hour), kept in `memo` for the household's other members.
  function hoursFrom(st, hh, to, memo) {
    if (memo.has(hh.id)) return memo.get(hh.id);
    const from = st.farmsteads[hh.farmstead].house,
      p = findRoute(st.w, from, to, REACH * SPEED);
    const h = p ? routeCost(st.w, p) / SPEED : Infinity;
    memo.set(hh.id, h);
    return h;
  }
  // The guests of a farm's occasion: the living of `ids` (in order, each once), old enough, with a home within a day's walk of the farm.
  function guests(st, f, ids, skip = null) {
    const out = [],
      hours = [],
      seen = new Set(),
      memo = new Map();
    VB.count.occasionAsked += ids.length;
    for (const id of ids) {
      if (seen.has(id) || id === skip) continue;
      seen.add(id);
      const p = st.pawns[id];
      if (!p.alive || p.age < MIN_AGE || p.household === null) continue;
      const hh = st.households[p.household],
        h = hh.farmstead === f.id ? 0 : hoursFrom(st, hh, f.house, memo);
      if (h <= REACH) {
        out.push(id);
        hours.push(h);
      }
    }
    return { ids: out, hours };
  }
  // A farm's occasion is held in its yard, before the house.
  const yard = (st, f) => ({
    village: f.village,
    farm: f.id,
    tile: f.house,
    x: st.w.hx[f.house] + 2,
    y: st.w.hy[f.house] + 20,
  });
  // A wedding (sim/lifecycle, wed): the day after, at the couple's farm, the couple, their household and the near kin of both.
  function wedding(st, m, f, home) {
    const hh = st.households[home],
      farm = st.farmsteads[hh.farmstead];
    const g = guests(st, farm, [m, f, ...hh.members, ...kinNear(st, m), ...kinNear(st, f)]);
    if (g.ids.length) call(st, 'wedding', dayOf(st.t) + DAY, yard(st, farm), g.ids, g.hours, [m, f]);
  }
  // A funeral ale (sim/lifecycle, killPawn, before the dead leaves its household): the day after, at the farm of the dead, its household
  // and its near kin. Two deaths of one farm on one day have one ale.
  function funeral(st, id) {
    const p = st.pawns[id];
    if (p.household === null) return;
    const hh = st.households[p.household],
      farm = st.farmsteads[hh.farmstead],
      day = dayOf(st.t) + DAY;
    const same = st.occasions.find(
      (o) => o.kind === 'funeral' && o.farm === farm.id && o.start === day + OCCASIONS.funeral.from,
    );
    if (same) {
      same.for.push(id);
      return;
    }
    const g = guests(st, farm, [...hh.members, ...kinNear(st, id)], id);
    if (g.ids.length) call(st, 'funeral', day, yard(st, farm), g.ids, g.hours, [id]);
  }
  // The day of the meetings (autumn day 10, at midnight; sim/clock): each village calls the people with a voice to its green, for its turn.
  function callMeetings(st) {
    const day = dayOf(st.t),
      n = st.villages.length;
    for (const v of st.villages) {
      const s = st.cenv.settlements[v.id];
      if (!s) continue;
      const people = membersOf(st, v.id),
        ids = [];
      VB.count.occasionAsked += people.length;
      for (const p of people) if (voiceOf(st, p, s) > 0) ids.push(p.id);
      if (!ids.length) continue;
      const c = v.center;
      call(
        st,
        'meeting',
        day,
        { village: v.id, farm: null, tile: c, x: st.w.hx[c], y: st.w.hy[c] + 6 },
        ids,
        ids.map(() => 0),
        [],
        villageTurn(v.id, n, cal(st.t).year) / TICKS,
      );
    }
  }
  // Pawn a is held at another occasion than o, or is at o already. The one an occasion is held for (a spouse, at its wedding) leaves
  // another for it: two siblings may marry on one round.
  const held = (a, o) => a.occasion === o.id || (a.occasion !== null && !o.for.includes(a.id));
  // Why pawn id may not set out for occasion oid, or null.
  function cannotAttend(st, id, oid) {
    const o = st.occasions.find((x) => x.id === oid),
      a = st.agents[id];
    if (!o) return `there is no occasion ${oid}`;
    if (st.t >= o.end) return `occasion ${oid} is over`;
    if (held(a, o)) return `pawn ${id} is at occasion ${a.occasion}`;
    if (a.phase === 'back') return `pawn ${id} is carrying a load home`;
    return null;
  }
  // Pawn a sets out for occasion oid (the attend verb, which then walks it there and has it stand about until the end): where it stands,
  // somewhere in a ring about the spot, close enough for talk (sim/relations), and until when. [tile, x, y, until]
  function join(st, a, oid) {
    const o = st.occasions.find((x) => x.id === oid),
      th = rnd(st.rng.occasions) * 2 * Math.PI,
      r = 5 + rnd(st.rng.occasions) * 9;
    a.occasion = o.id;
    o.come.push(a.id);
    return [o.tile, o.x + Math.cos(th) * r, o.y + Math.sin(th) * r * 0.6, o.end];
  }
  // Whether pawn a can go now: not on the player's hands, not held at another occasion; for an occasion that stops work, anyone not carrying a
  // load home; else only those with no work in hand.
  const canGo = (st, a, o) =>
    !unplanned(st, a.id) &&
    !held(a, o) &&
    a.phase !== 'back' &&
    a.away === undefined && // on the road (VB-287), or lodging away (VB-783)
    (o.overrides || (!a.job && (a.phase === null || a.phase === 'home')));
  // The occasion o's turn: those whose time to set out has come go if they can; one who cannot yet is looked at again in an hour (at the
  // next step if it is carrying a load home), while it
  // could still arrive an hour before the end. At the end, o is over.
  function visit(st) {
    const o = st.occasions[0];
    if (st.t >= o.end) {
      finish(st, o);
      return;
    }
    let again = Infinity;
    for (let i = 0; i < o.asked.length && o.asked[i].leave <= st.t;) {
      const g = o.asked[i],
        a = st.agents[g.id];
      if (!st.pawns[g.id].alive || st.t + g.hours > o.end - 1) {
        o.asked.splice(i, 1);
        continue;
      }
      if (canGo(st, a, o) && issue(st, { actor: g.id, verb: 'attend', target: o.id, source: 'occasion' }) === true) {
        o.asked.splice(i, 1);
        continue;
      }
      // one carrying a load home is looked at again at the next step, when the load may be down (VB-466: looked at each hour, a hauler
      // whose trips took the hour was on the road with a load every time, and a village of one voice had no quorum)
      again = Math.min(again, st.t + (a.phase === 'back' ? 1 / TICKS : 1));
      i++;
    }
    const nextLeave = o.asked.find((g) => g.leave > st.t);
    o.due = Math.min(again, nextLeave ? nextLeave.leave : Infinity, o.end);
    st.occasions.splice(st.occasions.indexOf(o), 1);
    enqueue(st, o);
  }
  // The host household pours its ale for those who came (VB-305; a barrel serves BREW.guests): as many barrels as it has for them, used up through
  // sim/stores with the reason 'pour', at most `most` (an ale evening's one). Each guest of another household remembers the host's holder
  // for it (SOCIAL.memories.ale), and the host's standing is told to sim/society ('alePoured'). Returns the barrels poured.
  function pourAle(st, f, present, most = Infinity) {
    if (f.household === null) return 0;
    const hh = st.households[f.household];
    if (hh.dissolved || hh.holder === null || !st.pawns[hh.holder].alive) return 0;
    const barrels = Stores.pour(st, hh, Math.min(Stores.aleOf(st, hh), Math.ceil(present.length / BREW.guests), most));
    if (!barrels) return 0;
    for (const id of present)
      if (st.pawns[id].alive && st.pawns[id].household !== hh.id) remember(st, id, hh.holder, 'ale');
    emit(st, 'alePoured', { host: hh.holder, household: hh.id, barrels });
    return barrels;
  }
  // ---- the feast (VB-458; design.md, The gift: The feast, What a feast books) ----
  // The rule 'feast', with the context {hh}: the grain the household holds beyond its seed and FEAST.above years of its need, which it
  // feasts from when above 0; the household's panel explains it (Sim.explainFeast). Allocates nothing.
  Rules.declare({ id: 'feast', owner: 'sim/occasions', combine: 'sum', base: (st, c) => Stores.grainOf(c.hh) });
  Rules.contribute({
    rule: 'feast',
    source: 'sim/occasions',
    key: 'seed',
    label: 'Seed for its fields',
    tunables: [],
    value: (st, c) => -Stores.reserved(st, c.hh, 'grain'),
  });
  Rules.contribute({
    rule: 'feast',
    source: 'sim/occasions',
    key: 'keep',
    label: 'Years of food kept',
    tunables: ['FEAST.above'],
    value: (st, c) => -FEAST.above * YEAR_DAYS * dailyNeed(st, c.hh),
  });
  const fctx = { hh: null }; // reused, so the rule's value allocates nothing
  function surplus(st, hh) {
    fctx.hh = hh;
    const v = Rules.value(st, 'feast', fctx);
    fctx.hh = null;
    return v;
  }
  const explainFeast = (st, hh) => Rules.explain(st, 'feast', { hh });
  // What a feast books (design.md, The gift): what pawn p ate and drank at household hh's is owed to the host's holder by p's household,
  // when it has a living holder not the host's (that household, else null). bookAll books each sum of `owed` (household to worth) by the
  // gift's booking between the two holders (relations' book) and returns the whole.
  function owing(st, hh, p) {
    const g = p.household === null ? null : st.households[p.household];
    return !g || g === hh || g.holder === null || g.holder === hh.holder || !st.pawns[g.holder].alive ? null : g;
  }
  function bookAll(st, hh, owed) {
    let booked = 0;
    for (const [g, worth] of owed) {
      book(st, hh.holder, g.holder, worth); // the host's holder is owed the worth (What a feast books: the two holders)
      booked += worth;
    }
    return booked;
  }
  const ration = (st, p) => (age(st, p) >= 14 ? st.ECON.ration.adult : st.ECON.ration.child); // as sim/hunger's day's need
  // The host household of farm f lays out food for those `present` (its own members too) after `barrels` of ale were poured, if its holder
  // lives and its grain stands above the rule 'feast': its share of the surplus (FEAST.share, times the holder's generosity), at most
  // FEAST.perGuest a ration of need of those who eat, less the ale's grain. A feast too small to make each a day's meal is not laid out.
  // Each eats its part by its ration, and has eaten the day's meal (pawn.feast; sim/hunger feeds it no more that day); each guest
  // household with a living holder owes the host's holder the worth of what its members ate and drank, ale at its grain (relations'
  // book, the gift's rule). Returns {eaten, rations} or null.
  // @state pawn.feast: absent, or {t (game hour), n (rations it ate), host (the household that laid it out)}: the last feast the pawn ate
  //   at; written only here, read by sim/hunger (the day's meal) and the invariants.
  function feast(st, f, present, barrels) {
    if (f.household === null) return null;
    const hh = st.households[f.household];
    if (hh.dissolved || hh.holder === null || !st.pawns[hh.holder].alive) return null;
    const excess = surplus(st, hh);
    if (!(excess > 0)) return null;
    const eaters = present.filter((id) => {
      const p = st.pawns[id];
      return p.alive && (p.feast === undefined || st.t - p.feast.t >= DAY); // one feast a day
    });
    let need = 0;
    for (const id of eaters) need += ration(st, st.pawns[id]);
    const ale = barrels * BREW.grain,
      offered = FEAST.share * Traits.act(st, hh.holder, 'generosity', 'feast') * excess,
      served = Math.min(offered, FEAST.perGuest * need - ale);
    if (!(need > 0) || served < need) return null;
    const keep = Stores.grainOf(hh) - excess,
      owed = new Map(),
      aleEach = ale / present.length;
    for (const id of eaters) {
      const p = st.pawns[id],
        n = (served * ration(st, p)) / need;
      VB.count.feastServed++;
      p.feast = { t: st.t, n, host: hh.id };
      const g = owing(st, hh, p);
      if (g) owed.set(g, (owed.get(g) || 0) + n + aleEach);
    }
    const booked = bookAll(st, hh, owed);
    const left = Stores.grainOf(hh) - served; // above keep, as served is a share of the excess (tests/lib/invariants.js)
    Stores.takeSpare(st, hh, served, { kind: 'feast', guests: eaters.length, booked, keep, left });
    const host = st.pawns[hh.holder];
    log(
      st,
      `${fullName(host)} laid out a feast at ${f.name}: ${eaters.length} ate, ${Math.round(served)} rations of food.`,
      { kind: 'feast', pawn: host.id, n: Math.round(served), ...atFarm(f) },
    );
    return { eaten: eaters.length, rations: served };
  }
  // The occasion ends: those who came are free; outside working hours those outdoors go home. A wedding or a funeral ale is told in the log.
  function finish(st, o) {
    const led = o.kind === 'rite' ? lead(st, o) : null; // read while those present still stand there
    st.occasions.splice(st.occasions.indexOf(o), 1);
    const h = cal(st.t).hour,
      late = h >= WORK[1] || h < WORK[0];
    let far = 0;
    const present = [];
    for (const id of o.come) {
      const a = st.agents[id];
      if (a.occasion !== o.id) continue;
      a.occasion = null;
      present.push(id);
      if (
        o.village !== null &&
        st.pawns[id].household !== null &&
        st.farmsteads[st.households[st.pawns[id].household].farmstead].village !== o.village
      )
        far++;
      if (late && !a.inside && st.pawns[id].alive && !unplanned(st, id))
        issue(st, { actor: id, verb: 'goHome', source: 'occasion' });
    }
    if (o.kind === 'meeting') return;
    if (o.kind === 'rite') {
      riteEnds(st, o, led, present, far);
      return;
    }
    if (o.kind === 'ale') {
      aleEnds(st, o, present, far);
      return;
    }
    const f = st.farmsteads[o.farm],
      n = o.come.length,
      barrels = pourAle(st, f, present);
    feast(st, f, present, barrels);
    const ale = barrels ? `; ${barrels === 1 ? 'a barrel' : barrels + ' barrels'} of ale poured` : '';
    const came = `${n} came${far ? `, ${far} of them from other villages` : ''}${ale}`;
    const at = atFarm(f);
    if (o.kind === 'wedding') {
      log(
        st,
        `The wedding of ${fullName(st.pawns[o.for[0]])} and ${fullName(st.pawns[o.for[1]])} at ${f.name}: ${came}.`,
        { kind: 'wedding', pawn: o.for[0], other: o.for[1], n, ...at },
      );
    } else {
      const names = o.for.map((id) => fullName(st.pawns[id])).join(' and ');
      log(st, `The funeral ale for ${names} at ${f.name}: ${came}.`, { kind: 'funeralAle', pawn: o.for[0], n, ...at });
    }
  }
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
    const booked = bookAll(st, host, owed);
    const by = st.pawns[host.holder],
      from = far ? `, ${far} of them from other villages` : '';
    log(st, `${fullName(by)} opened ${f.name} for an ale evening: ${guests.length} came${from}.`, {
      kind: 'aleEvening',
      pawn: by.id,
      n: guests.length,
      far,
      booked: Math.round(booked),
      ...atFarm(f),
    });
  }
  // ---- the season's rite (VB-522; design.md, Where pawns meet: The season's rite) ----
  const riteDay = (c) => RITE.days.some((d) => c.season === d[0] && c.sday === d[1]);
  // On a rite's day, at midnight (sim/clock): each village with a green calls a rite there; its adults come, and those of a village with
  // no green (a lone farm) within RITE.reach walking hours of one go to the nearest, each at RITE.come + RITE.piety × its piety. One pass
  // over the live households, a draw for each adult.
  function callRites(st) {
    const greens = st.villages.filter((v) => v.green);
    if (!greens.length) return;
    const goes = new Map(); // village id to [the green's village, the walk]
    for (const v of st.villages) {
      if (v.green) {
        goes.set(v.id, [v.id, 0]);
        continue;
      }
      if (!st.villageHours) continue;
      let best = null;
      for (const g of greens) {
        const h = hoursBetween(st, v.id, g.id);
        if (h <= RITE.reach && (!best || h < best[1])) best = [g.id, h];
      }
      if (best) goes.set(v.id, best);
    }
    const asked = new Map(); // a green's village to {ids, hours}
    for (const k of st.liveHouseholds) {
      const hh = st.households[k],
        g = hh.farmstead === null ? null : goes.get(st.farmsteads[hh.farmstead].village);
      if (!g) continue;
      for (const m of hh.members) {
        const p = st.pawns[m];
        if (!p.alive || age(st, p) < ADULT) continue;
        VB.count.occasionAsked++;
        if (!(rnd(st.rng.occasions) < RITE.come + RITE.piety * Traits.of(st, m, 'piety'))) continue;
        if (!asked.has(g[0])) asked.set(g[0], { ids: [], hours: [] });
        asked.get(g[0]).ids.push(m);
        asked.get(g[0]).hours.push(g[1]);
      }
    }
    const day = dayOf(st.t);
    for (const v of greens) {
      const a = asked.get(v.id);
      if (!a) continue;
      VB.count.riteCalled++;
      const c = v.center,
        place = { village: v.id, farm: null, tile: c, x: st.w.hx[c], y: st.w.hy[c] + 6 };
      call(st, 'rite', day, place, a.ids, a.hours, []);
    }
  }
  // The rite's leader: of those standing at it, the holder highest in piety × prestige (read now, stored nowhere but in its event); with
  // no holder there, whoever stands highest. Null when nobody stands there; else {id, heard (Encounters.said: all present but it)}.
  function lead(st, o) {
    let best = null,
      bv = -Infinity;
    for (const id of Encounters.present(st, o.id)) {
      const p = st.pawns[id],
        holder = p.household !== null && st.households[p.household].holder === id,
        v = (holder ? 1e6 : 0) + Traits.of(st, id, 'piety') * (p.prestige ?? 1);
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
      far,
      village: v.id,
    });
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
  return {
    OCCASIONS,
    REACH,
    VILLAGE_STEPS,
    villageTurn,
    wedding,
    funeral,
    callMeetings,
    cannotAttend,
    join,
    occasionsDue,
    occasionLabel,
    explainFeast,
    cannotCallAle,
    callAle,
    spareAle,
    riteDay,
    callRites,
  };
})();
