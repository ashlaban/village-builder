// @sys sim/workdays: village work days (VB-120; Kim, 10 Nov): a routine the meeting may choose for a village with a fence (VB-257), called
// by its alderman (callWorkday, VB-673) at least OUTER.notice days ahead, its levy's lots laid for that one date (VB-1768); on spring's
// first day the village closes its fence together and on summer's second clears scrub at its wood's edge, every adult at one priority;
// at the day's end those who turned out gain standing for the year, a household levied that stayed away breaches (goodwill its head owes
// the alderman), and the other holders tied to that holder remember it
VB['sim/workdays'] = (() => {
  const { WORK, DAY, SEASON_DAYS, YEAR_DAYS, cal } = VB['sim/rules'];
  const { hexSteps } = VB['sim/hex'];
  const { log, age, fullName, unplanned } = VB['sim/records'],
    { tieOf } = VB['sim/ties'];
  const { remember } = VB['sim/relations'];
  const { emit } = VB['sim/events'];
  const { issue } = VB['sim/commands'],
    { agentOf } = VB['sim/decisions'];
  const Ob = VB['sim/obligations'];
  // @tunable WORKDAY: the village work days, their days, hours and standing
  // Village work days (VB-120; Kim, 10 Nov; design, Jobs, owners and roles: Village work days): a routine the meeting may choose for a village
  // with a fence; chosen, the village works together on `days` ([season, day of the season, what]): spring's first day the fence, its stretches
  // below `fenceBelow` (each `fenceHours`, as a mend), summer's second the commons, scrub cleared at the wood's edge (`clearHours` an adult of
  // the village). Every adult (from `minAge`) takes the work at role priority `prio`, whatever the role; it takes unlimited hands, all
  // together. An adult who works `hours` gains `came` standing for the year; a household levied none of whose adults worked their share
  // (`hours`, or the day's work over its adults when that is less) is away: it breaches its lot (VB-1768: in place of a standing lost).
  const WORKDAY = {
    days: [
      [0, 0, 'fence'],
      [1, 1, 'commons'],
    ],
    fenceBelow: 0.9,
    fenceHours: 2.5,
    clearHours: 3,
    prio: 8,
    minAge: 14,
    hours: 2,
    came: 0.05,
  };
  // @state village.workday: the village's last work day called, or absent before its first: {day (game day), what ('fence' | 'commons'),
  //   of (the custom's day it stands for, a game day), hoursOf ({pawn id: hours worked at the day's jobs}), cleared (the commons' work
  //   done), judged (its end told)}. Written only here: begun when the alderman calls the day (the verb callWorkday, VB-673; at least
  //   OUTER.notice days ahead, VB-1768), judged at the end of work (sim/clock).
  // @state pawn.workdays: {year (of cal), came (work days the pawn turned out to), missed (work days its household stayed away from, as its
  //   holder)}, absent before its first; read by sim/society's standing while year is this year.
  const VILLAGE = (v) => ({ type: 'village', id: v.id });
  // The work day of calendar date c: 'fence', 'commons', or null.
  function dayOf(c) {
    for (const [season, sday, what] of WORKDAY.days) if (c.season === season && c.sday === sday) return what;
    return null;
  }
  // The households of the occupied farms of village v, and their adults (living members from WORKDAY.minAge).
  function households(st, v) {
    const out = [];
    for (const id of v.farmsteads) {
      const f = st.farmsteads[id],
        hh = f.household === null ? null : st.households[f.household];
      if (!hh || hh.dissolved) continue;
      const adults = hh.members.filter((m) => st.pawns[m].alive && age(st, st.pawns[m]) >= WORKDAY.minAge);
      out.push({ hh, adults });
    }
    return out;
  }
  // The commons' tile: of the village's wood, a tile on its edge (beside open land), nearest the village's centre, the lowest id between
  // equals; -1 for none.
  function edgeOf(st, v) {
    const w = st.w,
      wood = new Set(v.wood);
    let best = -1,
      bd = Infinity;
    for (const t of v.wood) {
      let edge = false;
      for (let d = 0; d < 6 && !edge; d++) {
        const n = w.nb[t * 6 + d];
        edge = n >= 0 && !wood.has(n) && !w.water[n];
      }
      if (!edge) continue;
      const dist = hexSteps(w, v.center, t);
      if (dist < bd || (dist === bd && t < best)) {
        best = t;
        bd = dist;
      }
    }
    return best;
  }
  // The fence's stretches the day mends.
  const worn = (v) => v.fence.filter((s) => s.cond < WORKDAY.fenceBelow);
  // Whether the work day of date c was called (callWorkday).
  const called = (v, c) => !!v.workday && v.workday.day === c.day;
  // The work day of village v called (sim/routines callWorkday): game day `day`, standing for the custom's day `of`.
  function begin(v, day, what, of) {
    v.workday = { day, what, of, hoursOf: {}, cleared: false, judged: false };
  }
  // Whether some village holds its work day called for date c (sim/clock judges it at the end of work).
  const isDay = (st, c) => st.villages.some((v) => called(v, c));
  // The work of a work day of `what` in village v, in hours: the fence's worn stretches (WORKDAY.fenceHours each), or the commons'
  // clearing (WORKDAY.clearHours an adult of the village; none with no wood's edge).
  function workOf(st, v, what) {
    if (what === 'fence') return worn(v).length * WORKDAY.fenceHours;
    if (edgeOf(st, v) < 0) return 0;
    let n = 0;
    for (const x of households(st, v)) n += x.adults.length;
    return n * WORKDAY.clearHours;
  }
  const TASK = { fence: 'to close the village fence', commons: 'to clear the commons at the edge of the wood' };
  // The routine's rule, asked at the village's reviews while its meeting chose work days (sim/jobs): on a called work day, until the end of work,
  // the fence's worn stretches (WORKDAY.fenceHours each), or the commons' clearing at the wood's edge (WORKDAY.clearHours an adult of the
  // village), as village jobs. A village with a whole fence, or no wood, has no work day. Reads only.
  function workdayWork(st, v, at, c, post) {
    if (c.hour >= WORK[1] || !called(v, c)) return;
    const what = v.workday.what;
    const own = VILLAGE(v);
    if (what === 'fence') {
      for (const s of worn(v))
        post(`workfence:v${v.id}.${s.id}`, s.tile, { stretch: s, village: v.id }, 'workfence', own);
      return;
    }
    if (v.workday && v.workday.day === c.day && v.workday.cleared) return;
    const site = edgeOf(st, v);
    let hours = 0;
    for (const x of households(st, v)) hours += x.adults.length * WORKDAY.clearHours;
    if (site >= 0 && hours > 0) post(`workclear:v${v.id}`, site, { village: v.id, hours }, 'workclear', own);
  }
  // Each step an adult works at the day's jobs, its hours are counted towards its turning out.
  function worked(st, j, dt, a) {
    if (!a) return;
    const v = st.villages[j.village],
      rec = called(v, cal(st.t)) ? v.workday : null;
    if (rec && !rec.judged) rec.hoursOf[a.id] = (rec.hoursOf[a.id] || 0) + dt;
  }
  // The pawn's year of work days, begun afresh in a new year.
  function mark(st, id, c, key) {
    const p = st.pawns[id];
    if (!p.workdays || p.workdays.year !== c.year) p.workdays = { year: c.year, came: 0, missed: 0 };
    p.workdays[key]++;
  }
  VB.counter(
    'workdayHolders',
    'Holders of a village weighed by a household that stayed away from its work day, twice a year (sim/workdays; VB-120)',
  );
  // The end of a work day (sim/clock, at the end of work; VB-1768): each adult who worked WORKDAY.hours turned out. Each household levied
  // for the day (its lot, terms `together`) none of whose adults worked their share (WORKDAY.hours, or the hours the village worked over
  // its adults when that is less) stayed away: it breaches its lot (sim/levies missedDay: the day's worth
  // as goodwill its head owes the alderman, opinion following; pawn.workdays.missed its record), and each other holder of the village
  // with a tie to it remembers. What is left of the lots of those who came, or of all once the work is done, the alderman releases. The
  // village's log tells the day. A day is judged where it was called. Returns the pawns whose standing changed.
  function judge(st, v, c) {
    if (!called(v, c) || v.workday.judged) return [];
    const rec = v.workday,
      agent = agentOf(st, v.id);
    rec.judged = true;
    const hs = households(st, v);
    let adults = 0;
    for (const x of hs) adults += x.adults.length;
    let total = 0;
    for (const id in rec.hoursOf) total += rec.hoursOf[id];
    const share = Math.min(WORKDAY.hours, total / Math.max(1, adults)),
      done = rec.what === 'fence' ? worn(v).length === 0 : rec.cleared,
      lots = new Map();
    for (const o of Ob.due(st, { kind: 'village', id: v.id }, 'creditor', 'days'))
      if (o.source === 'routine' && o.terms.names === 'together' && o.window && o.window[0] === c.day)
        lots.set(o.debtor.id, o);
    const came = [],
      away = [];
    for (const x of hs) {
      let any = false;
      for (const id of x.adults) {
        const h = rec.hoursOf[id] || 0;
        if (h >= WORKDAY.hours) came.push(id);
        if (h > 0 && h >= share) any = true;
      }
      const o = lots.get(x.hh.id);
      if (!o) continue;
      const left = Ob.left(o);
      if (!any && x.hh.holder !== null && st.pawns[x.hh.holder].alive) {
        if (Ob.isLive(o)) {
          // its breach, booked by sim/levies (missedDay)
          emit(st, 'workdayMissed', {
            o,
            day: c.day,
            why: `the household stayed away from the work day ${TASK[rec.what]}`,
            n: Math.ceil(left - 1e-9),
          });
          away.push(x.hh);
        }
      } else if (left > 1e-9 && agent !== null && !unplanned(st, agent))
        issue(st, { actor: agent, verb: 'release', target: o.id, args: { days: left }, source: 'planner' });
    }
    for (const id of came) mark(st, id, c, 'came');
    const holders = hs.map((x) => x.hh.holder).filter((h) => h !== null && st.pawns[h].alive);
    for (const hh of away) {
      mark(st, hh.holder, c, 'missed');
      for (const b of holders) {
        VB.count.workdayHolders++;
        if (b !== hh.holder && tieOf(st, b, hh.holder) > 0) remember(st, b, hh.holder, 'stayedAway');
      }
      emit(st, 'stayedAway', { holder: hh.holder, came }); // a story, known to those who came (sim/stories, VB-523)
    }
    const turned = Object.keys(rec.hoursOf).filter((id) => rec.hoursOf[id] > 0).length,
      names = away.map((hh) => fullName(st.pawns[hh.holder])).join(', ');
    log(
      st,
      `${v.name} held its work day ${TASK[rec.what]}: ${turned} of ${adults} adults turned out` +
        (away.length ? `; the households of ${names} stayed away.` : '.'),
      { kind: 'workday', village: v.id, n: turned },
    );
    const changed = [...came, ...away.map((hh) => hh.holder)];
    emit(st, 'workDay', { pawns: changed });
    return changed;
  }
  // The day's jobs left standing at its end: the village's, of the work day's kinds.
  const isWorkdayJob = (j) => j.kind === 'workfence' || j.kind === 'workclear';
  // Where the pawn stands: round the stretch, as at mending; on the commons' tile, spread over it.
  const fenceSpot = (st, a, j) => {
    const w = st.w,
      s = j.stretch;
    return [s.mx + (w.hx[j.site] - s.mx) * 0.25 + a.ox * 0.4, s.my + (w.hy[j.site] - s.my) * 0.25 + 3 + a.oy * 0.2];
  };
  const clearSpot = (st, a, j) => [st.w.hx[j.site] + a.ox * 0.8, st.w.hy[j.site] + a.oy * 0.6];
  // The job kinds (sim/kinds takes them in): the work day's own type of work, `workday` (ROLES: 8 for every adult), unlimited hands, all
  // together (no hand's bid falls for those already at it, sim/fit).
  const KINDS = {
    workfence: {
      verb: 'Closing the village fence on the work day',
      go: 'Going to the work day at the fence',
      name: 'Close the village fence (work day)',
      at: ['fence'],
      needs: [],
      gives: ['fence'],
      label: 'Work day',
      anim: 'mallet',
      hours: WORKDAY.fenceHours,
      hands: Infinity,
      together: true,
      type: 'workday',
      minAge: WORKDAY.minAge,
      spot: fenceSpot,
      worked,
      done: (st, j) => {
        j.stretch.cond = 1;
        j.stretch.dirty = true;
      },
      available: workdayWork,
    },
    workclear: {
      verb: 'Clearing the commons on the work day',
      go: 'Going to the work day on the commons',
      name: 'Clear the commons (work day)',
      at: ['commons'],
      needs: [],
      gives: [],
      label: 'Work day',
      anim: 'hoe',
      hours: WORKDAY.clearHours,
      hands: Infinity,
      together: true,
      type: 'workday',
      minAge: WORKDAY.minAge,
      spot: clearSpot,
      worked,
      done: (st, j) => {
        const v = st.villages[j.village];
        if (called(v, cal(st.t))) v.workday.cleared = true;
      },
      available: workdayWork,
    },
  };
  // Whether the routine is open to a village (VILLAGE_ROUTINES, sim/routines): it has a fence to close.
  const wanted = (st, v) => v.fence.length > 0;
  return {
    WORKDAY,
    KINDS,
    dayOf,
    wanted,
    judge,
    isWorkdayJob,
    households,
    edgeOf,
    isDay,
    begin,
    workOf,
    TASK,
  };
})();
