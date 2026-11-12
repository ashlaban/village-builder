// @sys sim/notable: which events of the record are notable and why, and an event told in one sentence, histories and the village log; what stops a
// skip to the next event that concerns the played pawn (VB-234); queries of the record and a pawn's life (VB-199); read-only views, no state
VB['sim/notable'] = (() => {
  const { index, ancestorsOf, fullName, age, settlementIdOf } = VB['sim/records'];
  const { CAUSES } = VB['sim/deaths'];
  const { YEAR, DAY, SEASON_DAYS, WORK } = VB['sim/rules'];
  // An event of the record in full that every view reads: not a folded slot (a number, sim/records), nor a pawn's own telling of an event
  // recorded beside it (`self`), which only its life reads.
  const told = (e) => typeof e === 'object' && !e.self;
  // The events about a pawn (as pawn or other), household, farm or village, of the given kinds, with from <= t < to, in time order.
  // With {pawn, life: true}: the pawn's own events, read through its positions on the record (lifeOf).
  function recordOf(st, q = {}) {
    if (q.life) return lifeOf(st, q.pawn);
    const kinds = q.kinds ? new Set(q.kinds) : null;
    const out = st.record.filter((e) => told(e) && (q.pawn === undefined || e.pawn === q.pawn || e.other === q.pawn)
      && (q.household === undefined || e.household === q.household) && (q.farm === undefined || e.farm === q.farm)
      && (q.village === undefined || e.village === q.village) && (!kinds || kinds.has(e.kind))
      && (q.from === undefined || e.t >= q.from) && (q.to === undefined || e.t < q.to));
    return out.map((e, i) => [e, i]).sort((a, b) => a[0].t - b[0].t || a[1] - b[1]).map(([e]) => e);
  }
  // A pawn's life in its own words, in the order it was written: {t, kind, text, at (the position on the record)}, a death with its
  // `cause` and told as "Died of ...", a birth with no text; an event since folded is {t (its year's start), kind, at, folded (the count
  // of its kind, village and year)}, with no text.
  function lifeOf(st, id) {
    return st.pawns[id].events.map((at) => {
      const e = st.record[at];
      if (typeof e !== 'object') { const y = st.recordYears[e]; return { t: y.year * YEAR, kind: y.kind, at, folded: y.tally }; }
      if (e.kind === 'born') return { t: e.t, kind: 'born', at }; // the village's line is the mother's telling
      if (e.kind !== 'died') return { t: e.t, kind: e.kind, text: e.text, at };
      return { t: e.t, kind: 'died', text: CAUSES[e.text] ? CAUSES[e.text].event : undefined, cause: e.text, at };
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
  };
  // A pawn's line: itself, its forebears and its descendants, this many generations up and down.
  const GENERATIONS = 4;
  const HUNGER = new Set(['hunger', 'starvation']);
  const FARM = new Set(['empty', 'claim', 'cottage', 'left']);
  const CUSTOM = new Set(['custom', 'split']);
  const inLine = (st, a, b) => a === b || ancestorsOf(st, [a], GENERATIONS).has(b) || ancestorsOf(st, [b], GENERATIONS).has(a);
  // Does a birth, marriage or death concern pawn `about`: it happened in its household, or to someone of its line.
  function concerns(st, ev, about) {
    if (about === null || about === undefined || about < 0) return false;
    if (ev.household !== undefined && ev.household === st.pawns[about].household) return true;
    return (ev.pawn !== undefined && inLine(st, about, ev.pawn)) || (ev.other !== undefined && inLine(st, about, ev.other));
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
    const p = st.pawns[ev.pawn], cause = CAUSES[ev.text];
    if (!cause) return `${fullName(p)} died ${ev.text || ''}`.trim() + '.';
    return `${fullName(p)} of ${ev.farm !== undefined ? st.farmsteads[ev.farm].name : 'the island'} ${cause.log}, aged ${age(st, p, ev.t)}.`;
  }
  // ---- the chronicle (VB-099): the record as the history of a pawn, a farm or a village, and as the village log ----
  // The kinds a history is filtered by, in the order the page offers them.
  const CHRONICLE = {
    life: { label: 'Births and deaths', kinds: ['born', 'died', 'funeralAle'] },
    marriage: { label: 'Marriages', kinds: ['married', 'putOff', 'offered', 'matchRefused', 'offerLapsed', 'wedding'] },
    land: { label: 'Land and farms', kinds: ['holds', 'inherited', 'empty', 'claim', 'moved', 'joined', 'cottage', 'left', 'stayed', 'settled', 'plot',
      'plotStarted', 'field', 'meadow', 'stake', 'border', 'oreFound', 'service', 'guardian'] },
    custom: { label: 'Customs and meetings', kinds: ['custom', 'split', 'cause', 'meetingFailed'] },
  };
  // Events a pawn's own history tells in its own voice ("Became close friends with ..."; friend and fellOut, before VB-240): no line of
  // the village log, nor of a farm's history.
  const PERSONAL = new Set(['closeFriend', 'enemy', 'friend', 'fellOut', 'cause', 'player', 'share', 'gift', 'joined']);
  // The events that tell a farm is lived in again, which end a spell of standing empty.
  const SETTLES = new Set(['holds', 'inherited', 'moved', 'cottage', 'left']);
  const whole = (n) => `${n} ${n === 1 ? 'year' : 'years'}`;
  // The history of q = {pawn}, {farm} or {village}, of the kinds of CHRONICLE[group] (all kinds without one), newest first: rows
  // {ev, text, note}. A farm's history follows the farm across households: the record names the farm in every event that happened there.
  // A pawn's has what it did and what befell it, in its own words where it has them, and what it took part in as `other` (a child born
  // to it, a farm taken over from it). A farm's or village's leaves out the personal events; an `empty` event's note says how long the
  // farm stood empty. One pass over the record, on demand (the page keeps the result until the record grows): no step calls this.
  function chronicle(st, q, group = null) {
    const kinds = group ? new Set(CHRONICLE[group].kinds) : null, rows = [], mine = q.pawn !== undefined;
    const base = st.record.filter((e) => told(e) && (mine ? e.pawn === q.pawn || (e.other === q.pawn && !PERSONAL.has(e.kind)) : !PERSONAL.has(e.kind))
      && (q.farm === undefined || e.farm === q.farm) && (q.village === undefined || e.village === q.village));
    const list = base.map((e, i) => [e, i]).sort((a, b) => a[0].t - b[0].t || a[1] - b[1]).map(([e]) => e);
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      // its coming to a household is told once: not as `joined` when another event of the same hour tells it (a wedding, a new farm)
      if (e.kind === 'joined' && list.some((o) => o !== e && o.t === e.t && o.farm === e.farm && o.kind !== 'joined')) continue;
      if (kinds && !kinds.has(e.kind)) continue;
      let note = null;
      if (e.kind === 'empty' && q.farm !== undefined) {
        let next = null;
        for (let k = i + 1; k < list.length && !next; k++) if (SETTLES.has(list[k].kind)) next = list[k];
        const years = Math.floor(((next ? next.t : st.t) - e.t) / YEAR);
        note = next ? `Empty for ${whole(years)}` : `Empty since, ${whole(years)}`;
      }
      rows.push({ ev: e, text: eventLine(st, e), note });
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
    offer: 'A marriage offer that waits for its answer',
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
  // that does stops it once)}; null when no pawn is played.
  function skipFrom(st) {
    const pl = st.player; if (!pl) return null;
    const hid = st.pawns[pl.pawn].household, hh = hid !== null ? st.households[hid] : null;
    return { t: st.t, n: st.record.length, eve: roundEve(st.t), homeId: hid, short: hh ? hh.hungryDays : 0, hungry: !!hh && hh.hunger > 0,
      offer: st.offerSeq };
  }
  // Does the open offer o wait for pawn id's answer.
  const waitsFor = (o, id) => o.answers.some((a) => a.by === id && a.yes === null);
  // Which reason of SKIP a record event is for the played pawn `about`, of household hid and village vid, or null.
  function stopsFor(st, ev, about, hid, vid) {
    if (!told(ev)) return null;
    const k = ev.kind;
    if (k === 'born' || k === 'married' || k === 'died') return concerns(st, ev, about) ? 'family' : null;
    if (k === 'inherited') return concerns(st, ev, about) ? 'farm' : null;
    if (FARM.has(k)) return (vid !== null && ev.village === vid) || (hid !== null && ev.household === hid) || concerns(st, ev, about) ? 'farm' : null;
    return CUSTOM.has(k) && vid !== null && ev.village === vid ? 'custom' : null;
  }
  // Has a skip begun at `from` (skipFrom) reached a stop: null, or {why (a key of SKIP), text (a sentence), ev (the record event, if one)}.
  // Asked after each step; it reads the events the record has gained since the last ask (from.n moves on), st.player and the clock, and
  // writes nothing to st, so a skipped run is the run played (rule 7). The eve of the moving round always stops it, within a year.
  function skipStop(st, from) {
    const pl = st.player;
    if (!pl) return { why: 'none', text: 'No pawn is played.' };
    const p = st.pawns[pl.pawn], hid = p.household, vid = settlementIdOf(st, p), hh = hid !== null ? st.households[hid] : null;
    while (from.n < st.record.length) {
      const ev = st.record[from.n++], why = stopsFor(st, ev, pl.pawn, hid, vid);
      if (why) return { why, text: eventLine(st, ev), ev };
    }
    if (hid !== from.homeId) { from.homeId = hid; from.short = hh ? hh.hungryDays : 0; from.hungry = !!hh && hh.hunger > 0; }
    if (hh && hh.hungryDays > from.short) {
      from.short = hh.hungryDays;
      if (!from.hungry) { from.hungry = true; return { why: 'hunger', text: `${st.farmsteads[hh.farmstead].name} had too little to eat today.` }; }
    }
    for (const o of st.offers) {
      if (!(o.id >= from.offer) || !waitsFor(o, pl.pawn)) continue;
      from.offer = o.id + 1;
      return { why: 'offer', text: `A match waits for an answer: ${fullName(st.pawns[o.man])} and ${fullName(st.pawns[o.woman])}.` };
    }
    if (pl.refused && pl.refused.t > from.t) return { why: 'refused', text: `A command was refused: ${pl.refused.verb}, ${pl.refused.why}.` };
    if (!pl.auto && !pl.queue.length) return { why: 'idle', text: `${fullName(p)} has nothing queued, and its automatic behaviour is off.` };
    return st.t >= from.eve ? { why: 'round', text: 'The moving round is tomorrow at noon.' } : null;
  }
  return { recordOf, lifeOf, NOTABLE, notable, eventLine, CHRONICLE, chronicle, villageLog, SKIP, skipFrom, skipStop, roundEve };
})();
