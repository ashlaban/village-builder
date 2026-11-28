// @sys sim/notable: which events of the record are notable and why, and an event told in one sentence, histories and the village log;
// queries of the record and a pawn's life (VB-199); read-only views, no state
VB['sim/notable'] = (() => {
  const { index, ancestorsOf, fullName, age } = VB['sim/records'];
  const { CAUSES, COLD } = VB['sim/deaths'];
  const { YEAR } = VB['sim/rules'];
  const { EVENTS, eventOf } = VB['sim/eventkinds'];
  const personal = (kind) => !!eventOf(kind, 'personal');
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
  const HUNGER = new Set(['hunger', 'starvation', 'thirst', 'cold']);
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
    const k = ev.kind,
      n = eventOf(k, 'notice'); // its kind's reason, from its record (sim/eventkinds)
    if (n === 'farm' || n === 'custom' || n === 'meeting') return [n];
    if (n === 'cause') return ev.reason === 'natural' ? ['cause'] : null; // taken up on its own (VB-082), not laid down or ended
    if (n === 'heard') return ev.pawn === about ? ['heard'] : null; // only the played pawn's hearing is written (sim/stories)
    if (n !== 'family') return null;
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
  // The groups a history is filtered by, in the order the page offers them; a kind's record names its group (sim/eventkinds), and one
  // whose record is `personal` is told by a pawn's own history in its own voice ("Became close friends with ..."): no line of the village
  // log, nor of a farm's history.
  const CHRONICLE = {
    life: { label: 'Births and deaths' },
    marriage: { label: 'Marriages' },
    land: { label: 'Land and farms' },
    custom: { label: 'Customs and meetings' },
  };

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
  // The history of q = {pawn}, {farm} or {village}, of the kinds whose record names `group` (all kinds without one), newest first: rows
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
    const kinds = group ? new Set(Object.keys(EVENTS).filter((k) => EVENTS[k].group === group)) : null,
      rows = [],
      mine = q.pawn !== undefined;
    const base = st.record.filter(
      (e) =>
        told(e) &&
        (mine
          ? e.pawn === q.pawn || (e.other === q.pawn && !personal(e.kind)) || childOf(st, e, q.pawn)
          : !personal(e.kind) || (q.farm !== undefined && movedAt(e, q.farm))) &&
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
      if (!told(e) || personal(e.kind) || e.text === undefined || e.text === 'before the record') continue;
      out.push({ t: e.t, text: eventLine(st, e), ev: e });
    }
    return out;
  }
  return {
    // what it gives the page through the Sim facade (src/sim.js joins the lists, VB-1944)
    PAGE: ['recordOf', 'NOTABLE', 'notable', 'eventLine', 'CHRONICLE', 'chronicle', 'villageLog'],
    recordOf,
    lifeOf,
    NOTABLE,
    notable,
    eventLine,
    CHRONICLE,
    chronicle,
    villageLog,
    helpIn,
    told,
    concerns,
    inLine,
  };
})();
