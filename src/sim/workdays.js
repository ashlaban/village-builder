// @sys sim/workdays: village work days (VB-120; Kim, 10 Nov): a routine the meeting may choose for a village with a fence (VB-257); on
// spring's first day the village closes its fence together and on summer's second clears scrub at its wood's edge, every adult at one
// priority; at the day's end those who turned out gain standing for the year, a household that stayed away loses its holder's, and the
// other holders tied to that holder remember it
VB['sim/workdays'] = (() => {
  const { WORKDAY, WORK, cal } = VB['sim/rules'];
  const { hexSteps } = VB['sim/hex'];
  const { log, age, tieOf, fullName } = VB['sim/records'];
  const { remember } = VB['sim/relations'];
  const { emit } = VB['sim/events'];
  // @state village.workday: the village's last work day, or absent before its first: {day (game day), what ('fence' | 'commons'),
  //   hoursOf ({pawn id: hours worked at the day's jobs}), cleared (the commons' work done), judged (its end told)}. Written only here:
  //   begun by the first hour worked at the day's jobs (or, when nobody came, at its end), judged at the end of work (sim/clock).
  // @state pawn.workdays: {year (of cal), came (work days the pawn turned out to), missed (work days its household stayed away from, as its
  //   holder)}, absent before its first; read by sim/society's prestige while year is this year.
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
  // The village's record of the work day of date c, begun now when it has none.
  function recordOf(st, v, c) {
    if (!v.workday || v.workday.day !== c.day)
      v.workday = { day: c.day, what: dayOf(c), hoursOf: {}, cleared: false, judged: false };
    return v.workday;
  }
  // The routine's rule, asked at the village's reviews while its meeting chose work days (sim/jobs): on a work day, until the end of work,
  // the fence's worn stretches (WORKDAY.fenceHours each), or the commons' clearing at the wood's edge (WORKDAY.clearHours an adult of the
  // village), as village jobs. A village with a whole fence, or no wood, has no work day. Reads only.
  function workdayWork(st, v, at, c, post) {
    const what = dayOf(c);
    if (!what || c.hour >= WORK[1]) return;
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
    const rec = recordOf(st, st.villages[j.village], cal(st.t));
    if (!rec.judged) rec.hoursOf[a.id] = (rec.hoursOf[a.id] || 0) + dt;
  }
  // The pawn's year of work days, begun afresh in a new year.
  function mark(st, id, c, key) {
    const p = st.pawns[id];
    if (!p.workdays || p.workdays.year !== c.year) p.workdays = { year: c.year, came: 0, missed: 0 };
    p.workdays[key]++;
  }
  // The end of a work day (sim/clock, at the end of work): each adult who worked WORKDAY.hours turned out; a household none of whose
  // adults worked their share (WORKDAY.hours, or the hours the village worked over its adults when that is less) stayed away: its holder
  // loses standing for the year, and each other holder of the village with a tie to it remembers. The village's log tells the day. A day
  // is judged where its work was posted (`called`: jobs of it still stand) or worked. Returns the pawns whose standing changed.
  function judge(st, v, c, called) {
    if (!(v.workday && v.workday.day === c.day) && !called) return [];
    const rec = recordOf(st, v, c);
    if (rec.judged) return [];
    rec.judged = true;
    const hs = households(st, v);
    let adults = 0;
    for (const x of hs) adults += x.adults.length;
    let total = 0;
    for (const id in rec.hoursOf) total += rec.hoursOf[id];
    const share = Math.min(WORKDAY.hours, total / Math.max(1, adults)),
      came = [],
      away = [];
    for (const x of hs) {
      let any = false;
      for (const id of x.adults) {
        const h = rec.hoursOf[id] || 0;
        if (h >= WORKDAY.hours) came.push(id);
        if (h > 0 && h >= share) any = true;
      }
      if (!any && x.adults.length && x.hh.holder !== null && st.pawns[x.hh.holder].alive) away.push(x.hh);
    }
    for (const id of came) mark(st, id, c, 'came');
    const holders = hs.map((x) => x.hh.holder).filter((h) => h !== null && st.pawns[h].alive);
    for (const hh of away) {
      mark(st, hh.holder, c, 'missed');
      for (const b of holders) {
        VB.count.workdayHolders++;
        if (b !== hh.holder && tieOf(st, b, hh.holder) > 0) remember(st, b, hh.holder, 'stayedAway');
      }
    }
    const turned = Object.keys(rec.hoursOf).filter((id) => rec.hoursOf[id] > 0).length,
      task = rec.what === 'fence' ? 'to close the village fence' : 'to clear the commons at the edge of the wood',
      names = away.map((hh) => fullName(st.pawns[hh.holder])).join(', ');
    log(
      st,
      `${v.name} held its work day ${task}: ${turned} of ${adults} adults turned out` +
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
  // together (no hand's bid falls for those already at it, sim/jobs).
  const KINDS = {
    workfence: {
      verb: 'Closing the village fence on the work day',
      go: 'Going to the work day at the fence',
      name: 'Close the village fence (work day)',
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
        recordOf(st, st.villages[j.village], cal(st.t)).cleared = true;
      },
      available: workdayWork,
    },
  };
  // Whether the routine is open to a village (VILLAGE_ROUTINES, sim/plans): it has a fence to close.
  const wanted = (st, v) => v.fence.length > 0;
  return { KINDS, dayOf, wanted, judge, isWorkdayJob, households, edgeOf };
})();
