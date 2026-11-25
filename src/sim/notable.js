// @sys sim/notable: which events of the record are notable and why, and an event told in one sentence, histories and the village log; what stops a
// skip to the next event that concerns the played pawn (VB-234); queries of the record and a pawn's life (VB-199); read-only views, no state
VB['sim/notable'] = (() => {
  const { index, ancestorsOf, fullName, age, settlementIdOf } = VB['sim/records'];
  const { CAUSES, COLD } = VB['sim/deaths'];
  const { YEAR, DAY, SEASON_DAYS, WORK, cal } = VB['sim/rules'];
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
    cause: 'Causes taken up',
    meeting: 'Village meetings that did not decide',
    gathering: 'Gatherings that concern the played person, as they begin',
    heard: 'What the played person hears said of its household (VB-554)',
  };
  // A pawn's line: itself, its forebears and its descendants, this many generations up and down.
  const GENERATIONS = 4;
  const HUNGER = new Set(['hunger', 'starvation']);
  const FARM = new Set(['empty', 'claim', 'cottage', 'left', 'frost', 'misjudged']);
  const CUSTOM = new Set(['custom', 'split']);
  // What moves a pawn between homes or brings one in, for the played household (VB-1109); each stops a skip, since the household's hands, mouths
  // or farm change: 'moved' (a child or holder goes to kin who hold its farm in trust, a ward comes back of age and the trust ends, a pawn comes
  // to help a short household, a farm is taken up again), 'service' (a servant joins), 'joined' (a pawn rehoused: a child taken in).
  const MOVE = new Set(['moved', 'service', 'joined']);
  // A 'joined' whose reason has its own event (the trust's 'moved', the 'service', an inheritance or a marriage) is not a second stop.
  const JOINED_TOLD = new Set([
    'care',
    'home',
    'service',
    'heir',
    'death',
    'marriage',
    'retirement',
    'married away',
    'claim',
  ]);
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
    if (k === 'cause') return ev.reason === 'natural' ? ['cause'] : null; // taken up on its own (VB-082), not laid down or ended
    if (k === 'meetingFailed') return ['meeting'];
    if (k === 'heardOfUs') return ev.pawn === about ? ['heard'] : null; // only the played pawn's hearing is written (sim/stories)
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
      // a cause taken up is told with its pawn's name, as the notice tells it (VB-082): "Took up the cause: ..." in its own history
      if (ev.kind === 'cause' && ev.reason === 'natural' && /^Took up/.test(ev.text))
        return `${fullName(st.pawns[ev.pawn])} took up${ev.text.slice(7)}.`;
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
    marriage: {
      label: 'Marriages',
      kinds: [
        'married',
        'putOff',
        'offered',
        'visited',
        'visitOff',
        'matchRefused',
        'marriedAgainst',
        'offerLapsed',
        'wedding',
        'courting',
        'courtingEnded',
        'leftRefused',
      ],
    },
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
      kinds: ['custom', 'split', 'cause', 'meetingFailed', 'gathering', 'gatheringHeld', 'fair', 'rite', 'aleEvening'],
    },
  };
  // Events a pawn's own history tells in its own voice ("Became close friends with ..."; friend and fellOut, before VB-240): no line of
  // the village log, nor of a farm's history.
  const PERSONAL = new Set([
    'courting',
    'courtingEnded',
    'leftRefused',
    'closeFriend',
    'enemy',
    'friend',
    'fellOut',
    'quarrel',
    'cause',
    'wishLapsed',
    'player',
    'share',
    'gift',
    'joined',
    'helped',
    'heardOfUs',
    'lieExposed',
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
  // The routine kinds a history folds, one line a kind and year (VB-1102), with the line's words from the events it holds (n: their count,
  // `sum`: the total of their `n`, places: the farms, oldest first). Each is routine because it repeats through the year without one
  // of them deciding anything: help is a day's work among neighbours, frost and a hard winter take a crop or a beast a time, the spring's
  // births and the harvest come once a farm. Births, deaths, marriages, land and customs are never folded.
  const ROUTINE = {
    helped: ({ n, places }) => `Helped at ${places}: ${n} days`,
    frost: ({ n, places }) => `Frost took ${n} crops${places ? ' at ' + places : ''}`,
    herdBirths: ({ sum, places }) => `${sum} calves and lambs born${places ? ' at ' + places : ''}`,
    herdDeath: ({ sum, places }) => `${sum} animals lost over the winter${places ? ' at ' + places : ''}`,
    harvest: ({ places }) => `Harvest brought in at ${places}`,
    // help received (VB-1114): the year's grain, by giver; `givers` is [[name, rations]], the most first
    received: ({ sum, givers }) =>
      givers.length === 1
        ? `Received ${sum} grain from ${givers[0][0]} this year`
        : `Received ${sum} grain this year: ${andList(givers.map(([g, n]) => `${n} from ${g}`))}`,
  };
  // Grain received as a gift (sim/exchange's booked): {n, from (the giver's name)}, else null. The record tells it as text.
  const GIFT_IN = /^Received (\d+) grain from (.+)$/;
  function helpIn(ev) {
    const m = ev.kind === 'gift' && typeof ev.text === 'string' ? GIFT_IN.exec(ev.text) : null;
    return m ? { n: +m[1], from: m[2] } : null;
  }
  const foldKind = (ev) => (helpIn(ev) ? 'received' : ev.kind);
  const andList = (a) => (a.length > 1 ? `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}` : a[0] || '');
  // Fold the rows of a chronicle (newest first), from the newest, until `limit` lines are made: a row {ev (the newest it holds), text, note,
  // fold (the rows it holds, newest first, when it folds two or more)}. Rows left over are counted in `rest`. The view's: the record is as it was.
  function foldRows(st, rows, limit) {
    const out = [];
    let i = 0;
    for (; i < rows.length && out.length < limit; i++) {
      const r = rows[i];
      if (!r) continue;
      const k = foldKind(r.ev);
      if (!ROUTINE[k]) {
        out.push(r);
        continue;
      }
      const year = Math.floor(r.ev.t / YEAR),
        held = [r];
      for (let j = i + 1; j < rows.length && (!rows[j] || Math.floor(rows[j].ev.t / YEAR) >= year); j++)
        if (rows[j] && foldKind(rows[j].ev) === k) held.push(rows[j]);
      if (held.length < 2) {
        out.push(r);
        continue;
      }
      const places = [],
        by = new Map();
      let sum = 0;
      for (let m = held.length - 1; m >= 0; m--) {
        const e = held[m].ev;
        sum += e.n || 1;
        if (k === 'received') by.set(helpIn(e).from, (by.get(helpIn(e).from) || 0) + helpIn(e).n);
        const name = e.farm !== undefined ? st.farmsteads[e.farm].name : null;
        if (name && !places.includes(name)) places.push(name);
      }
      out.push({
        ev: r.ev,
        text:
          ROUTINE[k]({ n: held.length, sum, places: andList(places), givers: [...by].sort((a, b) => b[1] - a[1]) }) +
          '.',
        note: null,
        fold: held,
      });
      const set = new Set(held);
      for (let j = i + 1; j < rows.length && (!rows[j] || Math.floor(rows[j].ev.t / YEAR) >= year); j++)
        if (set.has(rows[j])) rows[j] = null;
    }
    const rest = rows.slice(i).filter(Boolean);
    out.rest = rest.length;
    return out;
  }
  // A birth or a death of a child of pawn `id`, read from the child's father: the birth names the mother (`other`), not the father.
  const childOf = (st, e, id) =>
    (e.kind === 'born' || e.kind === 'died') && e.pawn !== id && st.pawns[e.pawn].father === id;
  function chronicle(st, q, group = null, limit = 0) {
    const kinds = group ? new Set(CHRONICLE[group].kinds) : null,
      rows = [],
      mine = q.pawn !== undefined;
    const base = st.record.filter(
      (e) =>
        told(e) &&
        (mine
          ? e.pawn === q.pawn || (e.other === q.pawn && !PERSONAL.has(e.kind)) || childOf(st, e, q.pawn)
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
    rows.reverse();
    return limit ? foldRows(st, rows, limit) : rows;
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
    cause: 'It takes up a cause on its own',
    hunger: 'Hunger in its household',
    help: 'Its household first receives help in a year',
    occasion: 'A wedding or a funeral ale that concerns it begins',
    wish: 'Its wish for a match lapsed, or was passed by the round',
    heard: 'It hears a story told of its household or itself',
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
  // Where a skip begins, for skipStop: plain data the page keeps, {t, pawn (the pawn played), n (the record's length: events before it
  // are passed), at and end (the game hour and the record's length when it was last asked), pass (a stretch of the record to pass, or
  // null: skipFrom, below), eve (the game
  // hour of the latest stop), homeId, short, hungry (the played pawn's household, its short meals so far, and whether it hungers
  // already), offer (the id the next offer will have, VB-293: the offers open when it began, and any older, do not stop it, and each
  // that does stops it once), occ (the ids of the occasions already judged, VB-1031: those on when it began, and each since)}; null when no
  // pawn is played; ref (the played pawn's refusal last judged: told, or passed as older than the skip) and seen (its refusal at the last
  // ask), VB-1135.
  // A skip begun where the last one stopped (VB-1108): `last` is the last skip's cursor, and when the same pawn is played and no step
  // has run since it was last asked (last.at), the new skip goes on with it: the events of the stopping step it had not reached are read
  // first, and its hunger, offers and occasions stand as judged. What the record gained while the game stood (pass: the player's own
  // acts, which it saw) is passed. Once a step has run between the two (the game ran at a speed), the new skip begins at the record's
  // end, as with no `last`.
  function skipFrom(st, last) {
    const pl = st.player;
    if (!pl) return null;
    if (last && last.pawn === pl.pawn && last.at === st.t && last.end <= st.record.length)
      return {
        ...last,
        t: st.t,
        eve: roundEve(st.t),
        pass: [last.end, st.record.length],
        occ: last.occ.slice(),
        // a refusal of the stopping step not yet told is told by this skip; one made while the game stood the page has shown
        ref: sameRefusal(pl.refused, last.seen) ? last.ref : refusalOf(pl),
      };
    const hid = st.pawns[pl.pawn].household,
      hh = hid !== null ? st.households[hid] : null;
    return {
      t: st.t,
      pawn: pl.pawn,
      n: st.record.length,
      at: st.t,
      end: st.record.length,
      pass: null,
      eve: roundEve(st.t),
      homeId: hid,
      short: hh ? hh.hungryDays : 0,
      hungry: !!hh && hh.hunger > 0,
      offer: st.offerSeq,
      occ: st.occasions.filter((o) => st.t >= o.start).map((o) => o.id), // the gatherings on when it began do not stop it
      ref: refusalOf(pl), // a refusal made before it began does not stop it
      seen: refusalOf(pl),
    };
  }
  // The played pawn's last refused command, as plain data for a cursor; two are the same refusal when all three agree.
  const refusalOf = (pl) => (pl.refused ? { verb: pl.refused.verb, why: pl.refused.why, t: pl.refused.t } : null);
  const sameRefusal = (a, b) => (!a && !b) || (!!a && !!b && a.t === b.t && a.verb === b.verb && a.why === b.why);
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
            : o.kind === 'call'
              ? `${who[0]} calls at ${at}.`
              : o.kind === 'gathering'
                ? `The gathering meets on ${at}.`
                : `An ale evening begins at ${at}${who.length ? `, opened by ${who[0]}` : ''}.`;
  }
  // Does occasion o concern pawn id: it is asked to it or has set out for it; it is held for one of its household or line (a wedding,
  // a funeral ale, its own house's ale evening); or it is the meeting or the rite of its village, or a day of its village's gathering.
  function gatheringConcerns(st, o, id) {
    const p = st.pawns[id];
    if (st.agents[id].occasion === o.id || o.come.includes(id) || o.asked.some((a) => a.id === id)) return true;
    if (
      o.for.some(
        (q) => q === id || (p.household !== null && st.pawns[q].household === p.household) || inLine(st, id, q),
      )
    )
      return true;
    if (o.kind === 'gathering') {
      // VB-295: its village goes to this host's gathering this winter (village.gathering, sim/gathering's)
      const v = st.villages[settlementIdOf(st, p)],
        g = v && v.gathering;
      return !!g && g.host === o.village && g.year === cal(o.start).year;
    }
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
  // Is gift event ev the household's first help received in its year (VB-1114): no earlier one of that year is on the record.
  function firstHelp(st, ev, hid) {
    const from = Math.floor(ev.t / YEAR) * YEAR;
    for (let i = st.record.lastIndexOf(ev) - 1; i >= 0; i--) {
      const e = st.record[i];
      if (typeof e !== 'object') break; // folded: older than the year
      if (e.t < from) break;
      if (helpIn(e) && (e.pawn === ev.pawn || (hid !== null && e.household === hid))) return false;
    }
    return true;
  }
  // Which reason of SKIP a record event is for the played pawn `about`, of household hid and village vid, or null.
  function stopsFor(st, ev, about, hid, vid) {
    if (!told(ev)) return null;
    const k = ev.kind;
    if (k === 'born' || k === 'married' || k === 'died') return concerns(st, ev, about) ? 'family' : null;
    if (k === 'inherited') return concerns(st, ev, about) ? 'farm' : null;
    if (k === 'gift')
      return helpIn(ev) && (ev.pawn === about || (hid !== null && ev.household === hid)) && firstHelp(st, ev, hid)
        ? 'help'
        : null;
    if (k === 'wishLapsed') return ev.pawn === about ? 'wish' : null;
    if (k === 'heardOfUs') return ev.pawn === about ? 'heard' : null;
    if (k === 'cause')
      return ev.pawn === about && (ev.reason === 'natural' || ev.reason === 'lapsed' || ev.reason === 'won')
        ? 'cause'
        : null;
    if (k === 'cottage' && !ev.pawn && ev.pawn !== 0) return null; // a house raised onto stone asks nothing (VB-1101); a settling names its pawn
    if (MOVE.has(k) && !(k === 'joined' && JOINED_TOLD.has(ev.reason))) {
      const hh = hid !== null ? st.households[hid] : null;
      const mine = (id) => id !== undefined && (id === about || (hh !== null && hh.members.includes(id)));
      return ev.household === hid || mine(ev.pawn) || mine(ev.other) ? 'farm' : null;
    }
    if (FARM.has(k))
      return (vid !== null && ev.village === vid) || (hid !== null && ev.household === hid) || concerns(st, ev, about)
        ? 'farm'
        : null;
    return CUSTOM.has(k) && vid !== null && ev.village === vid ? 'custom' : null;
  }
  // Has a skip begun at `from` (skipFrom) reached a stop: null, or {why (a key of SKIP), text (a sentence), ev (the record event, if one)}.
  // Asked after each step; it reads the events the record has gained since the last ask (from.n moves on; a stop leaves the rest of its
  // step's events for the next ask, or the next skip: skipFrom), st.player and the clock, and
  // writes nothing to st, so a skipped run is the run played (rule 7). The eve of the moving round always stops it, within a year.
  function skipStop(st, from, aids = {}) {
    const pl = st.player;
    if (!pl) return { why: 'none', text: 'No pawn is played.' };
    const p = st.pawns[pl.pawn],
      hid = p.household,
      vid = settlementIdOf(st, p),
      hh = hid !== null ? st.households[hid] : null;
    from.at = st.t;
    from.end = st.record.length;
    if (!from.occ) from.occ = []; // a cursor of before VB-1031
    if (from.ref === undefined) from.ref = pl.refused && pl.refused.t <= from.t ? refusalOf(pl) : null; // a cursor of before VB-1135
    from.seen = refusalOf(pl);
    while (from.n < st.record.length) {
      if (from.pass && from.n >= from.pass[0]) {
        from.n = Math.max(from.n, from.pass[1]); // what was written while the game stood, between two skips
        from.pass = null;
        continue;
      }
      const ev = st.record[from.n++],
        why = stopsFor(st, ev, pl.pawn, hid, vid);
      if (why === 'cause' && ev.reason !== 'natural') return { why, text: ev.text, ev, agenda: true };
      if (why === 'cause') {
        // the event's text is "Took up the cause: <custom>, <option>"; the player is told the option
        const what = ev.text.replace(/^Took up the cause: [^,]*, /, '');
        return { why, text: `${fullName(p)} has taken up a cause: ${what}`, ev, agenda: true };
      }
      if (why === 'help') return { why, text: `Help received: ${helpIn(ev).n} grain from ${helpIn(ev).from}.`, ev };
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
    // a wedding or a funeral ale stops it; the rite, the meeting and an ale evening come round too often to (measured, VB-1031: 176 of
    // them in a founder's 24 years beside 45 other stops), and are told by the page's notice alone
    const g = gatherings(st, pl.pawn, from.occ).find((x) => x.rare);
    if (g) return { why: 'occasion', text: g.text, spot: { x: g.x, y: g.y } };
    for (const o of st.offers) {
      if (!(o.id >= from.offer) || !waitsFor(o, pl.pawn)) continue;
      from.offer = o.id + 1;
      return {
        why: 'offer',
        offer: o.id, // the page opens it where it is answered (VB-1100)
        text:
          o.basis === 'match'
            ? `A match waits for an answer: ${fullName(st.pawns[o.gives.man])} and ${fullName(st.pawns[o.wants.woman])}.`
            : `An offer waits for an answer: ${offerText(st, o)}.`,
      };
    }
    if (pl.refused && !sameRefusal(pl.refused, from.ref)) {
      from.ref = refusalOf(pl);
      return { why: 'refused', text: `A command was refused: ${pl.refused.verb}, ${pl.refused.why}.` };
    }
    if (!pl.auto && !pl.queue.length)
      return { why: 'idle', text: `${fullName(p)} has nothing queued, and its automatic behaviour is off.` };
    if (st.t < from.eve) return null;
    // the eve (VB-1101): it stops the skip for a choice the round will read, else once SKIP_QUIET hours of a skip have gone (never longer than one
    // and three quarters of a year) with the year in brief; with neither, the skip runs on, and the cursor looks for the next eve
    const choice = aids.choice ? aids.choice(st, pl.pawn) : null;
    if (choice) return { why: 'round', text: choice.text, farm: choice.farm };
    if (st.t - from.t >= SKIP_QUIET) return { why: 'round', text: yearInBrief(st, from, vid, aids) };
    from.eve = roundEve(st.t);
    return null;
  }
  // How long a skip may pass eves with no choice before the next eve stops it with the year in brief: three quarters of a year.
  const SKIP_QUIET = (YEAR * 3) / 4;
  // The year in brief for the village vid, since game hour from.t: births, deaths (its own village's), and, from `aids.brief`, the harvest
  // and the food. Reads the record from its end back to from.t, and writes nothing.
  function yearInBrief(st, from, vid, aids) {
    let born = 0,
      died = 0;
    for (let i = st.record.length - 1; i >= 0 && st.record[i].t >= from.t; i--) {
      const e = st.record[i];
      if (vid === null || e.village !== vid) continue;
      if (e.kind === 'born') born++;
      else if (e.kind === 'died') died++;
    }
    const more = aids.brief ? aids.brief(st, vid) : '';
    return `The moving round is tomorrow. Since the skip began: ${born} born, ${died} dead${more ? `; ${more}` : ''}.`;
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
    helpIn,
  };
})();
