// @sys sim/notable: which events of the record are notable and why, and an event told in one sentence, histories and the village log; what stops a
// skip to the next event that concerns the played pawn (VB-234); queries of the record and a pawn's life (VB-199); read-only views, no state
VB['sim/notable'] = (() => {
  const { index, ancestorsOf, fullName, age, settlementIdOf } = VB['sim/records'];
  const { CAUSES, COLD } = VB['sim/deaths'];
  const { YEAR, DAY, SEASON_DAYS, WORK } = VB['sim/rules'];
  const { what: offerText } = VB['sim/offers'];
  // An event of the record in full that every view reads: not a folded slot (a number, sim/records), nor a pawn's own telling of an event
  // recorded beside it (`self`), which only its life reads.
  const told = (e) => typeof e === 'object' && !e.self;
  // The events about a pawn (as pawn or other), household, farm or village, of the given kinds, with from <= t < to, in time order.
  // With {pawn, life: true}: the pawn's own events, read through its positions on the record (lifeOf).
  function recordOf(st, q = {}) {
    if (q.life) return lifeOf(st, q.pawn);
    const kinds = q.kinds ? new Set(q.kinds) : null;
    const out = st.record.filter(
      (e) =>
        told(e) &&
        (q.pawn === undefined || e.pawn === q.pawn || e.other === q.pawn) &&
        (q.household === undefined || e.household === q.household) &&
        (q.farm === undefined || e.farm === q.farm) &&
        (q.village === undefined || e.village === q.village) &&
        (!kinds || kinds.has(e.kind)) &&
        (q.from === undefined || e.t >= q.from) &&
        (q.to === undefined || e.t < q.to),
    );
    return out
      .map((e, i) => [e, i])
      .sort((a, b) => a[0].t - b[0].t || a[1] - b[1])
      .map(([e]) => e);
  }
  // A pawn's life in its own words, in the order it was written: {t, kind, text, at (the position on the record)}, a death with its
  // `cause` and told as "Died of ...", a birth with no text; an event since folded is {t (its year's start), kind, at, folded (the count
  // of its kind, village and year)}, with no text.
  function lifeOf(st, id) {
    return st.pawns[id].events.map((at) => {
      const e = st.record[at];
      if (typeof e !== 'object') {
        const y = st.recordYears[e];
        return { t: y.year * YEAR, kind: y.kind, at, folded: y.tally };
      }
      if (e.kind === 'born') return { t: e.t, kind: 'born', at }; // the village's line is the mother's telling
      if (e.kind !== 'died') return { t: e.t, kind: e.kind, text: e.text, at };
      const told = CAUSES[e.text] ? CAUSES[e.text].event + (e.cold ? COLD : '') : undefined;
      return { t: e.t, kind: 'died', text: told, cause: e.text, at };
    });
  }
  // Why an event is notable (Kim, 9 Nov: QUESTION_ARCHIVE.md, "VB-098"), in the order the page lists them; the page turns each on or off.
  const NOTABLE = {
    family: "Births, marriages and deaths in the selected person's household or line",
    holder: 'Deaths of landholders',
    hunger: 'Deaths from hunger',
    farm: 'Farms left empty, claimed or newly built',
    custom: 'Changes of custom',
    meeting: 'Village meetings that did not decide',
    gathering: 'Gatherings that concern the played person, as they begin',
  };
  // A pawn's line: itself, its forebears and its descendants, this many generations up and down.
  const GENERATIONS = 4;
  const HUNGER = new Set(['hunger', 'starvation']);
  const FARM = new Set(['empty', 'claim', 'cottage', 'left']);
  const CUSTOM = new Set(['custom', 'split']);
  const inLine = (st, a, b) =>
    a === b || ancestorsOf(st, [a], GENERATIONS).has(b) || ancestorsOf(st, [b], GENERATIONS).has(a);
  // Does a birth, marriage or death concern pawn `about`: it happened in its household, or to someone of its line.
  function concerns(st, ev, about) {
    if (about === null || about === undefined || about < 0) return false;
    if (ev.household !== undefined && ev.household === st.pawns[about].household) return true;
    return (
      (ev.pawn !== undefined && inLine(st, about, ev.pawn)) || (ev.other !== undefined && inLine(st, about, ev.other))
    );
  }
  // Did the dead pawn of a `died` event hold the household it died in. Read from the kin index, which keeps a household under every holder
  // it has had since the run was seeded or loaded: right for a death of this session, false for one a loaded save had already passed on.
  function heldAtDeath(st, ev) {
    if (ev.household === undefined || st.pawns[ev.pawn].retired) return false;
    return (index(st).holds.get(ev.pawn) || []).includes(ev.household);
  }
  // The reasons a record event is notable, as keys of NOTABLE, or null when it is routine. `about` is the pawn the player follows (the
  // selected pawn; the played one once the player plays a pawn, VB-210), or null. Most events are routine: they cost one switch.
  function notable(st, ev, about = null) {
    if (!told(ev)) return null;
    const k = ev.kind;
    if (FARM.has(k)) return ['farm'];
    if (CUSTOM.has(k)) return ['custom'];
    if (k === 'meetingFailed') return ['meeting'];
    if (k !== 'died' && k !== 'born' && k !== 'married') return null;
    const why = [];
    if (concerns(st, ev, about)) why.push('family');
    if (k === 'died') {
      if (heldAtDeath(st, ev)) why.push('holder');
      if (HUNGER.has(ev.text)) why.push('hunger');
    }
    return why.length ? why : null;
  }
  // An event in one sentence. Most kinds carry their sentence; a death carries its cause and is told as the village log told it, and the
  // births, marriages and deaths from before the start, seeded as history, carry none.
  function eventLine(st, ev) {
    if (ev.kind !== 'died') {
      if (ev.text) return ev.text;
      if (ev.kind === 'born') return `${fullName(st.pawns[ev.pawn])} was born.`;
      if (ev.kind === 'holds') return `${fullName(st.pawns[ev.pawn])} holds ${st.farmsteads[ev.farm].name}.`;
      return ev.kind === 'married' ? `${fullName(st.pawns[ev.pawn])} and ${fullName(st.pawns[ev.other])} married.` : '';
    }
    const p = st.pawns[ev.pawn],
      cause = CAUSES[ev.text];
    if (!cause) return `${fullName(p)} died ${ev.text || ''}`.trim() + '.';
    const where = ev.farm !== undefined ? st.farmsteads[ev.farm].name : 'the island';
    return `${fullName(p)} of ${where} ${cause.log}${ev.cold ? COLD : ''}, aged ${age(st, p, ev.t)}.`;
  }
  // ---- the chronicle (VB-099): the record as the history of a pawn, a farm or a village, and as the village log ----
  // The kinds a history is filtered by, in the order the page offers them.
  const CHRONICLE = {
    life: { label: 'Births and deaths', kinds: ['born', 'died', 'funeralAle'] },
    marriage: { label: 'Marriages', kinds: ['married', 'putOff', 'offered', 'matchRefused', 'offerLapsed', 'wedding'] },
    land: {
      label: 'Land and farms',
      kinds: [
        'holds',
        'inherited',
        'renounced',
        'empty',
        'claim',
        'moved',
        'joined',
        'cottage',
        'left',
        'stayed',
        'settled',
        'plot',
        'plotStarted',
        'green',
        'field',
        'meadow',
        'stake',
        'border',
        'oreFound',
        'projectTaken',
        'projectDone',
        'service',
        'guardian',
      ],
    },
    custom: {
      label: 'Customs and meetings',
      kinds: ['custom', 'split', 'cause', 'meetingFailed', 'gathering', 'rite', 'aleEvening'],
    },
  };
  // Events a pawn's own history tells in its own voice ("Became close friends with ..."; friend and fellOut, before VB-240): no line of
  // the village log, nor of a farm's history.
  const PERSONAL = new Set([
    'closeFriend',
    'enemy',
    'friend',
    'fellOut',
    'quarrel',
    'cause',
    'player',
    'share',
    'gift',
    'joined',
    'helped',
  ]);
  // A member's move between farms (a `joined` event that names the farm left, `fromFarm`: sim/heirs' moveTo), as farm `farm` tells it
  // (VB-1027): the farm left tells the leaving, the farm come to the coming; a servant's and a settler's in their own words. One event of
  // the record, read from either end: no second record is made for the farm left.
  const movedAt = (e, farm) =>
    e.kind === 'joined' && e.fromFarm !== undefined && (e.farm === farm || e.fromFarm === farm);
  function moveLine(st, e, farm) {
    const who = fullName(st.pawns[e.pawn]),
      to = st.farmsteads[e.farm].name,
      from = st.farmsteads[e.fromFarm].name,
      fresh = e.reason === 'settle' || e.reason === 'found';
    if (farm === e.fromFarm)
      return e.reason === 'service'
        ? `${who} left ${from} to serve at ${to}.`
        : `${who} left ${from} for ${fresh ? 'the new farmstead ' : ''}${to}.`;
    return `${who} came to ${to} from ${from}${e.reason === 'service' ? ', to serve' : ''}.`;
  }
  // The events that tell a farm is lived in again, which end a spell of standing empty.
  const SETTLES = new Set(['holds', 'inherited', 'moved', 'cottage', 'left']);
  const whole = (n) => `${n} ${n === 1 ? 'year' : 'years'}`;
  // The history of q = {pawn}, {farm} or {village}, of the kinds of CHRONICLE[group] (all kinds without one), newest first: rows
  // {ev, text, note}. A farm's history follows the farm across households: the record names the farm in every event that happened there.
  // A pawn's has what it did and what befell it, in its own words where it has them, and what it took part in as `other` (a child born
  // to it, a farm taken over from it). A farm's or village's leaves out the personal events, but a farm's tells who left it and who
  // came to it (moveLine); an `empty` event's note says how long the
  // farm stood empty. One pass over the record, on demand (the page keeps the result until the record grows): no step calls this.
  function chronicle(st, q, group = null) {
    const kinds = group ? new Set(CHRONICLE[group].kinds) : null,
      rows = [],
      mine = q.pawn !== undefined;
    const base = st.record.filter(
      (e) =>
        told(e) &&
        (mine
          ? e.pawn === q.pawn || (e.other === q.pawn && !PERSONAL.has(e.kind))
          : !PERSONAL.has(e.kind) || (q.farm !== undefined && movedAt(e, q.farm))) &&
        (q.farm === undefined || e.farm === q.farm || movedAt(e, q.farm)) &&
        (q.village === undefined || e.village === q.village),
    );
    const list = base
      .map((e, i) => [e, i])
      .sort((a, b) => a[0].t - b[0].t || a[1] - b[1])
      .map(([e]) => e);
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      // its coming to a household is told once: not as `joined` when another event of the same hour tells it (a wedding, a new farm)
      if (e.kind === 'joined' && list.some((o) => o !== e && o.t === e.t && o.farm === e.farm && o.kind !== 'joined'))
        continue;
      if (kinds && !kinds.has(e.kind)) continue;
      let note = null;
      if (e.kind === 'empty' && q.farm !== undefined) {
        let next = null;
        for (let k = i + 1; k < list.length && !next; k++) if (SETTLES.has(list[k].kind)) next = list[k];
        const years = Math.floor(((next ? next.t : st.t) - e.t) / YEAR);
        note = next ? `Empty for ${whole(years)}` : `Empty since, ${whole(years)}`;
      }
      rows.push({ ev: e, text: !mine && e.kind === 'joined' ? moveLine(st, e, q.farm) : eventLine(st, e), note });
    }
    return rows.reverse();
  }
  // The village log: the last n events of the record that were lines of the log, newest first, as {t, text, ev}. Not the personal events,
  // nor the history seeded from before the start, which was never told. It walks back from the record's end only as far as it needs.
  function villageLog(st, n = 40) {
    const out = [];
    for (let i = st.record.length - 1; i >= 0 && out.length < n; i--) {
      const e = st.record[i];
      if (!told(e) || PERSONAL.has(e.kind) || e.text === undefined || e.text === 'before the record') continue;
      out.push({ t: e.t, text: eventLine(st, e), ev: e });
    }
    return out;
  }
  // ---- skip to the next event (VB-234): what stops a run ahead, for the played pawn ----
  // Why a skip stops, in the order they are looked for; the page says the reason's sentence and moves the camera to what happened.
  const SKIP = {
    family: 'A birth, marriage or death in its household or line',
    farm: 'A farm inherited in its household or line, or left empty, claimed or built in its village',
    custom: 'A change of custom in its village',
    hunger: 'Hunger in its household',
    occasion: 'A wedding or a funeral ale that concerns it begins',
    offer: 'An offer that waits for its answer',
    refused: 'A command refused',
    idle: 'Nothing queued, with its automatic behaviour off',
    round: 'The eve of the moving round',
    none: 'No pawn is played',
  };
  // The eve of the next moving round after game hour t: the start of work on the day before it (the round is at noon on day 11 of autumn).
  function roundEve(t) {
    const eve = Math.floor(t / YEAR) * YEAR + (2 * SEASON_DAYS + 9) * DAY + WORK[0];
    return eve > t ? eve : eve + YEAR;
  }
  // Where a skip begins, for skipStop: plain data the page keeps, {t, n (the record's length: events before it are passed), eve (the game
  // hour of the latest stop), homeId, short, hungry (the played pawn's household, its short meals so far, and whether it hungers
  // already), offer (the id the next offer will have, VB-293: the offers open when it began, and any older, do not stop it, and each
  // that does stops it once), occ (the ids of the occasions already judged, VB-1031: those on when it began, and each since)}; null when no
  // pawn is played.
  function skipFrom(st) {
    const pl = st.player;
    if (!pl) return null;
    const hid = st.pawns[pl.pawn].household,
      hh = hid !== null ? st.households[hid] : null;
    return {
      t: st.t,
      n: st.record.length,
      eve: roundEve(st.t),
      homeId: hid,
      short: hh ? hh.hungryDays : 0,
      hungry: !!hh && hh.hunger > 0,
      offer: st.offerSeq,
      occ: st.occasions.filter((o) => st.t >= o.start).map((o) => o.id), // the gatherings on when it began do not stop it
    };
  }
  // ---- gatherings as they begin (VB-1031): the record tells an occasion when it is over (how many came, what was poured), which is
  // too late to see it. These read st.occasions (sim/occasions) and write nothing to st. ----
  // An occasion in words, as it begins.
  function gatheringLine(st, o) {
    const at =
        o.farm !== null && o.farm !== undefined
          ? st.farmsteads[o.farm].name
          : `the green of ${st.villages[o.village].name}`,
      who = o.for.map((q) => fullName(st.pawns[q]));
    return o.kind === 'meeting'
      ? `The village meeting gathers on ${at}.`
      : o.kind === 'rite'
        ? `The rite begins on ${at}.`
        : o.kind === 'wedding'
          ? `The wedding of ${who.join(' and ')} begins at ${at}.`
          : o.kind === 'funeral'
            ? `The funeral ale for ${who.join(' and ')} begins at ${at}.`
            : `An ale evening begins at ${at}${who.length ? `, opened by ${who[0]}` : ''}.`;
  }
  // Does occasion o concern pawn id: it is asked to it or has set out for it; it is held for one of its household or line (a wedding,
  // a funeral ale, its own house's ale evening); or it is the meeting or the rite of its village.
  function gatheringConcerns(st, o, id) {
    const p = st.pawns[id];
    if (st.agents[id].occasion === o.id || o.come.includes(id) || o.asked.some((a) => a.id === id)) return true;
    if (
      o.for.some(
        (q) => q === id || (p.household !== null && st.pawns[q].household === p.household) || inLine(st, id, q),
      )
    )
      return true;
    return (o.kind === 'meeting' || o.kind === 'rite') && o.village === settlementIdOf(st, p);
  }
  // The occasions that have begun, are not over and concern living pawn id, each once: `seen` is the caller's own list of occasion ids
  // already judged (plain data, never st's), which this adds to and trims to the occasions that still stand, so an occasion costs one
  // judgement however often it is asked. [{id, kind, rare (a wedding or a funeral ale), text, x, y, farm (or null), village, end}]
  function gatherings(st, id, seen) {
    const out = [];
    if (id === null || id === undefined || id < 0 || st.pawns[id].died !== null) return out;
    for (const o of st.occasions) {
      if (st.t < o.start || st.t >= o.end || seen.includes(o.id)) continue;
      seen.push(o.id);
      if (gatheringConcerns(st, o, id))
        out.push({
          id: o.id,
          kind: o.kind,
          rare: o.kind === 'wedding' || o.kind === 'funeral',
          text: gatheringLine(st, o),
          x: o.x,
          y: o.y,
          farm: o.farm === undefined ? null : o.farm,
          village: o.village,
          end: o.end,
        });
    }
    if (seen.length > 64) seen.splice(0, seen.length, ...seen.filter((k) => st.occasions.some((o) => o.id === k)));
    return out;
  }
  // Does the open offer o wait for pawn id's answer.
  const waitsFor = (o, id) => o.answers.some((a) => a.by === id && a.yes === null);
  // Which reason of SKIP a record event is for the played pawn `about`, of household hid and village vid, or null.
  function stopsFor(st, ev, about, hid, vid) {
    if (!told(ev)) return null;
    const k = ev.kind;
    if (k === 'born' || k === 'married' || k === 'died') return concerns(st, ev, about) ? 'family' : null;
    if (k === 'inherited') return concerns(st, ev, about) ? 'farm' : null;
    if (FARM.has(k))
      return (vid !== null && ev.village === vid) || (hid !== null && ev.household === hid) || concerns(st, ev, about)
        ? 'farm'
        : null;
    return CUSTOM.has(k) && vid !== null && ev.village === vid ? 'custom' : null;
  }
  // Has a skip begun at `from` (skipFrom) reached a stop: null, or {why (a key of SKIP), text (a sentence), ev (the record event, if one)}.
  // Asked after each step; it reads the events the record has gained since the last ask (from.n moves on), st.player and the clock, and
  // writes nothing to st, so a skipped run is the run played (rule 7). The eve of the moving round always stops it, within a year.
  function skipStop(st, from) {
    const pl = st.player;
    if (!pl) return { why: 'none', text: 'No pawn is played.' };
    const p = st.pawns[pl.pawn],
      hid = p.household,
      vid = settlementIdOf(st, p),
      hh = hid !== null ? st.households[hid] : null;
    while (from.n < st.record.length) {
      const ev = st.record[from.n++],
        why = stopsFor(st, ev, pl.pawn, hid, vid);
      if (why) return { why, text: eventLine(st, ev), ev };
    }
    if (hid !== from.homeId) {
      from.homeId = hid;
      from.short = hh ? hh.hungryDays : 0;
      from.hungry = !!hh && hh.hunger > 0;
    }
    if (hh && hh.hungryDays > from.short) {
      from.short = hh.hungryDays;
      if (!from.hungry) {
        from.hungry = true;
        return { why: 'hunger', text: `${st.farmsteads[hh.farmstead].name} had too little to eat today.` };
      }
    }
    if (!from.occ) from.occ = []; // a cursor of before VB-1031
    // a wedding or a funeral ale stops it; the rite, the meeting and an ale evening come round too often to (measured, VB-1031: 176 of
    // them in a founder's 24 years beside 45 other stops), and are told by the page's notice alone
    const g = gatherings(st, pl.pawn, from.occ).find((x) => x.rare);
    if (g) return { why: 'occasion', text: g.text, spot: { x: g.x, y: g.y } };
    for (const o of st.offers) {
      if (!(o.id >= from.offer) || !waitsFor(o, pl.pawn)) continue;
      from.offer = o.id + 1;
      return {
        why: 'offer',
        text:
          o.basis === 'match'
            ? `A match waits for an answer: ${fullName(st.pawns[o.gives.man])} and ${fullName(st.pawns[o.wants.woman])}.`
            : `An offer waits for an answer: ${offerText(st, o)}.`,
      };
    }
    if (pl.refused && pl.refused.t > from.t)
      return { why: 'refused', text: `A command was refused: ${pl.refused.verb}, ${pl.refused.why}.` };
    if (!pl.auto && !pl.queue.length)
      return { why: 'idle', text: `${fullName(p)} has nothing queued, and its automatic behaviour is off.` };
    return st.t >= from.eve ? { why: 'round', text: 'The moving round is tomorrow at noon.' } : null;
  }
  return {
    recordOf,
    lifeOf,
    NOTABLE,
    notable,
    eventLine,
    CHRONICLE,
    chronicle,
    villageLog,
    SKIP,
    skipFrom,
    skipStop,
    roundEve,
    gatherings,
  };
})();
