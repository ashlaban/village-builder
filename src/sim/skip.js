// @sys sim/skip: what stops a skip to the next event that concerns the played pawn (VB-234), and the gatherings that concern a pawn as
// they begin (VB-1031); a read-only view, no state
VB['sim/skip'] = (() => {
  const { fullName, settlementIdOf } = VB['sim/records'];
  const { YEAR, DAY, SEASON_DAYS, WORK, cal } = VB['sim/rules'];
  const { what: offerText } = VB['sim/offers'];
  const { told, concerns, inLine, eventLine, helpIn } = VB['sim/notable'];
  const { eventOf } = VB['sim/eventkinds'];
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
        ref: sameRefusal(refusedOf(st, pl), last.seen) ? last.ref : refusalOf(st, pl),
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
      ref: refusalOf(st, pl), // a refusal made before it began does not stop it
      seen: refusalOf(st, pl),
    };
  }
  // The played pawn's last refused command, as plain data for a cursor; two are the same refusal when all three agree.
  // Its controller's (pawn.control, sim/controller, VB-1745), read where it stands: sim/controller loads later.
  const controlled = (st, pl) => st.pawns[pl.pawn].control || null;
  const refusedOf = (st, pl) => (controlled(st, pl) ? controlled(st, pl).refused : null);
  const refusalOf = (st, pl) => {
    const r = refusedOf(st, pl);
    return r ? { verb: r.verb, why: r.why, t: r.t } : null;
  };
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
            : o.kind === 'harvest'
              ? `The harvest home of ${who[0]} begins at ${at}.`
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
  // The rules by which an event stops a skip, as a kind's record names them (`skip`, sim/eventkinds): each gives the reason of SKIP that
  // the event `ev` is for the played pawn `about`, of household hid and village vid, or null.
  const STOPS = {
    family: (st, ev, about) => (concerns(st, ev, about) ? 'family' : null),
    inherited: (st, ev, about) => (concerns(st, ev, about) ? 'farm' : null),
    help: (st, ev, about, hid) =>
      helpIn(ev) && (ev.pawn === about || (hid !== null && ev.household === hid)) && firstHelp(st, ev, hid)
        ? 'help'
        : null,
    wish: (st, ev, about) => (ev.pawn === about ? 'wish' : null),
    heard: (st, ev, about) => (ev.pawn === about ? 'heard' : null),
    cause: (st, ev, about) =>
      ev.pawn === about && (ev.reason === 'natural' || ev.reason === 'lapsed' || ev.reason === 'won') ? 'cause' : null,
    // What moves a pawn between homes or brings one in, for the played household (VB-1109); each stops a skip, since the household's hands,
    // mouths or farm change: 'moved' (a child or holder goes to kin who hold its farm in trust, a ward comes back of age and the trust ends, a
    // pawn comes to help a short household, a farm is taken up again), 'service' (a servant joins), 'joined' (a pawn rehoused: a child taken in).
    move(st, ev, about, hid) {
      if (ev.kind === 'joined' && JOINED_TOLD.has(ev.reason)) return null;
      const hh = hid !== null ? st.households[hid] : null;
      const mine = (id) => id !== undefined && (id === about || (hh !== null && hh.members.includes(id)));
      return ev.household === hid || mine(ev.pawn) || mine(ev.other) ? 'farm' : null;
    },
    farm(st, ev, about, hid, vid) {
      if (ev.kind === 'cottage' && !ev.pawn && ev.pawn !== 0) return null; // a house raised onto stone asks nothing (VB-1101); a settling names its pawn
      return (vid !== null && ev.village === vid) || (hid !== null && ev.household === hid) || concerns(st, ev, about)
        ? 'farm'
        : null;
    },
    custom: (st, ev, about, hid, vid) => (vid !== null && ev.village === vid ? 'custom' : null),
  };
  // Which reason of SKIP a record event is for the played pawn `about`, of household hid and village vid, or null.
  function stopsFor(st, ev, about, hid, vid) {
    if (!told(ev)) return null;
    const rule = eventOf(ev.kind, 'skip');
    return rule ? STOPS[rule](st, ev, about, hid, vid) : null;
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
    const refused = refusedOf(st, pl),
      ctl = controlled(st, pl);
    if (from.ref === undefined) from.ref = refused && refused.t <= from.t ? refusalOf(st, pl) : null; // a cursor of before VB-1135
    from.seen = refusalOf(st, pl);
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
    if (refused && !sameRefusal(refused, from.ref)) {
      from.ref = refusalOf(st, pl);
      return { why: 'refused', text: `A command was refused: ${refused.verb}, ${refused.why}.` };
    }
    if (ctl && !ctl.auto && !ctl.queue.length)
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
    // what it gives the page through the Sim facade (src/sim.js joins the lists, VB-1944)
    PAGE: ['SKIP', 'skipFrom', 'gatherings'],
    SKIP,
    skipFrom,
    skipStop,
    roundEve,
    gatherings,
    STOPS,
  };
})();
