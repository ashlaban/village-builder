// @sys sim/notable: which events of the record are notable and why, and an event told in one sentence, histories and the village log; read-only views, no state
VB['sim/notable'] = (() => {
  const { index, ancestorsOf, fullName, age } = VB['sim/records'];
  const { CAUSES } = VB['sim/deaths'];
  const { YEAR } = VB['sim/rules'];
  // Why an event is notable (Kim, 9 Nov: QUESTION_ARCHIVE.md, "VB-098"), in the order the page lists them; the page turns each on or off.
  const NOTABLE = {
    family: "Births, marriages and deaths in the selected person's household or line",
    holder: 'Deaths of landholders',
    hunger: 'Deaths from hunger',
    farm: 'Farms left empty, claimed or newly built',
    custom: 'Changes of custom',
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
    const k = ev.kind;
    if (FARM.has(k)) return ['farm'];
    if (CUSTOM.has(k)) return ['custom'];
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
    life: { label: 'Births and deaths', kinds: ['born', 'died'] },
    marriage: { label: 'Marriages', kinds: ['married', 'putOff'] },
    land: { label: 'Land and farms', kinds: ['holds', 'inherited', 'empty', 'claim', 'moved', 'joined', 'cottage', 'left', 'stayed', 'settled', 'plot',
      'plotStarted', 'field', 'meadow', 'stake', 'border', 'service', 'guardian'] },
    custom: { label: 'Customs', kinds: ['custom', 'split', 'cause'] },
  };
  // Events a pawn's own history tells in its own voice ("Became friends with ..."): no line of the village log, nor of a farm's history.
  const PERSONAL = new Set(['friend', 'fellOut', 'cause', 'player', 'share', 'gift', 'joined']);
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
    const base = st.record.filter((e) => (mine ? e.pawn === q.pawn || (e.other === q.pawn && !PERSONAL.has(e.kind)) : !PERSONAL.has(e.kind))
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
      if (PERSONAL.has(e.kind) || e.text === undefined || e.text === 'before the record') continue;
      out.push({ t: e.t, text: eventLine(st, e), ev: e });
    }
    return out;
  }
  return { NOTABLE, notable, eventLine, CHRONICLE, chronicle, villageLog };
})();
