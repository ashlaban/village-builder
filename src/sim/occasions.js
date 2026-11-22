// @sys sim/occasions: occasions (VB-126): a gathering at a place from a start to an end in game hours, of those asked: the village meeting
//   on the green (at its village's turn), the wedding feast and the funeral ale at a farm, a call at a farm (VB-1119: the verb `call`, a
//   pawn's evening at another household's), and the kinds sim/venues calls (the ale evening, the season's rite); who is asked, who sets
//   out, and the due-queue that sends and ends them; the villages' turns of the meetings and the moving round. What the host lays out is
//   sim/feast's.
// @state st.occasions[]: the occasions called and not yet over, sorted by `due` (after those due at the same time), each {id, kind
//   ('meeting' | 'wedding' | 'funeral' | 'ale' | 'rite' | 'call' | 'gathering': a day of it, VB-295), for[] (pawn ids it is held for: the couple, the
//   dead, an ale evening's host;
//   empty for a meeting and a rite), village, farm (farmstead id, or null on a green), tile, x, y (the spot, map units), start, end
//   (game hours), overrides (work stops for it), asked[] ({id, leave (the game hour it sets out), hours (its walk there)}, in order of
//   leave, each taken off once it sets out or cannot come), come[] (the ids that set out), due (game hours: the next time the step
//   looks at it)}. Plain data, saved; ended ones are dropped.
// @state st.occasionSeq: number; the next occasion's id; ids are never reused
// @state agent.occasion: the id of the occasion the pawn set out for and stands at until its end, or null
VB['sim/occasions'] = (() => {
  const Due = VB['sim/due'],
    dueKey = (e) => e.due; // its order (sim/due): by due, after those due at the same time
  const { release, walkTo, idle, free } = VB['sim/agents'],
    { stayOf, travelling } = VB['sim/pose'];
  const { next: rnd } = VB['sim/rng'];
  const { DAY, SPEED, WORK, TICKS, MARRIAGE, cal } = VB['sim/rules'],
    { SOCIAL } = VB['sim/ties'];
  const { findRoute, routeCost } = VB['sim/routes'];
  const { kinNear, membersOf, voiceOf, fullName, log, atFarm, age, spouseOf } = VB['sim/records'];
  const { issue, register } = VB['sim/commands'];
  const { unplanned } = VB['sim/records'];
  const { ALE_EVENING, RITE, GATHERING, WORK: WORK_HOURS } = VB['sim/rules'];
  const { pourAle, feast } = VB['sim/feast'];
  // @tunable CALL: a call at a farm: how long it lasts, how often, and the strangers met
  // A call at a farm (VB-1119; design.md, Where pawns meet): a pawn walks to another household's farm within a day's walk and stays from the
  // end of work to `until`; those at home meet it there as at an occasion, with `mix` the floor for strangers among the partners drawn
  // (sim/encounters). `every`: a pawn calls at most once in so many game hours (a week), the cost's bound; `rung`: an unplayed pawn whose
  // asking found nobody calls at a farm of another village (sim/asking, calls).
  const CALL = { until: 22, mix: 0.5, every: 7 * DAY };
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
    // a call at a farm (VB-1119): from the end of work to CALL.until, at another household's farm within a day's walk
    call: {
      from: WORK_HOURS[1],
      to: CALL.until,
      overrides: false,
      at: 'On a call at a farm',
      go: 'Walking to call at a farm',
    },
    rite: {
      from: RITE.hour,
      to: RITE.hour + RITE.hours,
      overrides: false,
      at: 'At the rite',
      go: 'Walking to the rite',
    },
    // a day of the gathering on its host's green (VB-295; sim/gathering calls its days): from GATHERING.from to the end of work
    gathering: {
      from: GATHERING.from,
      to: WORK_HOURS[1],
      overrides: true,
      at: 'At the gathering',
      go: 'Walking to the gathering',
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
    Due.append(st.occasions, o, o.due, dueKey);
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
  // Whether pawn a can go now: not on the player's hands, not held at another occasion, at home or lodging for it (a gathering's goer at
  // its bed in the host village, VB-295); for an occasion that stops work, anyone not carrying a load home; else only those with no work in hand.
  const canGo = (st, a, o) =>
    !unplanned(st, a.id) &&
    !held(a, o) &&
    a.phase !== 'back' &&
    (a.away === undefined || lodgedFor(st, a, o)) && // on the road (VB-287), or lodging away (VB-783)
    (o.overrides || (!a.job && (a.phase === null || a.phase === 'home')));
  // Pawn a lodges in the host village for the gathering whose day o is (sim/gathering's stays: why 'gathering', until its end).
  function lodgedFor(st, a, o) {
    if (o.kind !== 'gathering' || travelling(a)) return false;
    const s = stayOf(st, a.id);
    return !!s && s.why === 'gathering' && s.bed !== null && !s.back;
  }
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
  // What each kind's end does (VB-1006), one row a kind: {before(st, o) (read before those present are freed; its value is passed on),
  // end(st, o, pre, present, far)}. The meeting's, the call's and the farm's occasions are declared here, the ale evening's and the rite's
  // by sim/venues at load; a new kind adds a row, not a branch. Not state.
  const ENDS = {};
  const onEnd = (kind, h) => {
    if (!OCCASIONS[kind]) throw new Error(`sim/occasions: no occasion kind ${kind}`);
    ENDS[kind] = h;
  };
  // the meeting and a call: those present are free, nothing more
  const freed = { end: () => {} };
  onEnd('meeting', freed);
  onEnd('call', freed);
  // a farm's occasion (the wedding, the funeral ale): the host household pours its ale for those present and may lay out a feast, and
  // `tell` writes the log's line of who came
  const farmEnd = (tell) => ({
    end: (st, o, pre, present, far) => {
      const f = st.farmsteads[o.farm],
        n = o.come.length,
        barrels = pourAle(st, f, present);
      feast(st, f, present, barrels);
      const ale = barrels ? `; ${barrels === 1 ? 'a barrel' : barrels + ' barrels'} of ale poured` : '';
      tell(st, o, f, n, `${n} came${far ? `, ${far} of them from other villages` : ''}${ale}`, atFarm(f));
    },
  });
  onEnd(
    'wedding',
    farmEnd((st, o, f, n, came, at) =>
      log(
        st,
        `The wedding of ${fullName(st.pawns[o.for[0]])} and ${fullName(st.pawns[o.for[1]])} at ${f.name}: ${came}.`,
        { kind: 'wedding', pawn: o.for[0], other: o.for[1], n, ...at },
      ),
    ),
  );
  onEnd(
    'funeral',
    farmEnd((st, o, f, n, came, at) => {
      const names = o.for.map((id) => fullName(st.pawns[id])).join(' and ');
      log(st, `The funeral ale for ${names} at ${f.name}: ${came}.`, { kind: 'funeralAle', pawn: o.for[0], n, ...at });
    }),
  );
  // The occasion ends: those who came are free; outside working hours those outdoors go home; then its kind's end (ENDS).
  function finish(st, o) {
    const end = ENDS[o.kind],
      pre = end.before ? end.before(st, o) : null; // read while those present still stand there (the rite's leader)
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
    end.end(st, o, pre, present, far);
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
  // Why pawn id may not call at farm fid now (the verb `call`, which holds for any pawn), or null: it is unmarried, of age to marry, not
  // retired, in no service, of a household; the farm is another household's, within a day's walk, and holds one of the other sex it
  // might marry; and it called no more than CALL.every ago.
  function cannotCall(st, id, fid) {
    const p = st.pawns[id],
      f = st.farmsteads[fid],
      hh = p.household === null ? null : st.households[p.household];
    if (spouseOf(st, id) !== null) return `${fullName(p)} is married`;
    if (age(st, p) < (p.sex === 'm' ? MARRIAGE.menFrom : MARRIAGE.womenFrom))
      return `${fullName(p)} is too young to marry`;
    if (p.retired || p.servant) return `${fullName(p)} is retired or in service`;
    if (!hh || hh.dissolved || hh.farmstead === null) return `${fullName(p)} has no home to go out from`;
    if (!f || f.household === null || f.household === hh.id) return `there is no other household's farm ${fid}`;
    if (p.called !== undefined && st.t - p.called < CALL.every) return `${fullName(p)} called on someone this week`;
    const host = st.households[f.household],
      one = host.members.some((m) => {
        const q = st.pawns[m];
        return (
          q.alive &&
          q.sex !== p.sex &&
          spouseOf(st, m) === null &&
          !q.retired &&
          age(st, q) >= (q.sex === 'm' ? MARRIAGE.menFrom : MARRIAGE.womenFrom)
        );
      });
    if (!one) return `${f.name} holds nobody ${fullName(p)} might marry`;
    return hoursFrom(st, hh, f.house, new Map()) <= REACH ? null : `${f.name} lies beyond a day's walk`;
  }
  // The call by pawn id at farm fid (the verb, its check passed): tomorrow evening, the caller and the farm's household are asked to its
  // yard, the caller from as far as it walks.
  function callAt(st, id, fid) {
    const f = st.farmsteads[fid],
      hh = st.households[st.pawns[id].household],
      host = st.households[f.household],
      g = guests(st, f, [id, ...host.members]);
    st.pawns[id].called = st.t;
    call(st, 'call', dayOf(st.t) + DAY, yard(st, f), g.ids, g.hours, [id]);
  }
  // call(farmstead): walk to another household's farm within a day's walk and stay the evening (VB-1119)
  register('call', {
    check: (st, c) => free(st, c.actor) || cannotCall(st, c.actor, c.target),
    run: (st, c) => callAt(st, c.actor, c.target),
  });
  // attend(occasion): set out for the occasion with id `target` (sim/occasions; source 'occasion'), leaving the work in hand, walk to a spot
  // about it and stand there until its end
  register('attend', {
    check: (st, c) => free(st, c.actor) || cannotAttend(st, c.actor, c.target),
    run: (st, c) => {
      const a = st.agents[c.actor];
      release(st, a);
      const [tile, x, y, until] = join(st, a, c.target);
      walkTo(st, a, tile, x, y);
      idle(st, a, until);
    },
  });
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
    call,
    yard,
    dayOf,
    onEnd,
  };
})();
