// @sys sim/meetings: the year's meetings (a village a step, then the cultures and the land meeting), the village's routines and its choice
//   of gathering (sim/gathering) made at its meeting, and the night's drift of attitudes, a settlement a step (split from sim/lifecycle, VB-876)
VB['sim/meetings'] = (() => {
  const { drawer } = VB['sim/rng'];
  const Culture = VB['culture'];
  const { landMeeting } = VB['sim/territory'];
  const { YEAR_DAYS, YEAR, OFFICE, cal } = VB['sim/rules'];
  const { personEvent, log, membersOf, voiceOf, settlementIdOf, fullName, isHolder } = VB['sim/records'];
  const { opinionOf } = VB['sim/relations'];
  const { setAlderman } = VB['sim/membership'];
  const { chooseRoutines, VILLAGE_ROUTINES } = VB['sim/routines'];
  const { refreshRoles } = VB['sim/heirs'];
  const { updateTie, refreshStanding, refreshInterests, hooks } = VB['sim/society'];
  const { issue } = VB['sim/commands'];
  const { defineKind, setPresider, ask } = VB['sim/decisions'];
  const { VILLAGE_STEPS } = VB['sim/occasions'];
  const { chooseGathering, settleGatherings } = VB['sim/gathering'];
  const { usualRotation } = VB['sim/rotations'];
  // The year's meetings (VB-278; design.md, A village's meeting): on autumn day 10, each village's meeting on its own 6-minute step from noon,
  // in the order of village id from `year mod villages` (villageTurn, as the moving round's villages), then from 18:00 each culture's year,
  // and on the next step the
  // land meeting, which settles outland between villages. `meetingStage(st, n)`, n the step from noon, is each step's entry point; nothing
  // is kept from one step for the next, so nothing is saved: the step of the day says what is due. `holdMeetings` is every village's and the
  // cultures' at once, not the land meeting (the drawer's button, the tests).
  // A custom's change at a village's meeting (VB-313): a vote, its voices weighed and the margins set by Culture.meeting, which poses it;
  // with nothing decided, the practice stands.
  defineKind('custom', {
    procedure: 'vote',
    evaluate: (st, q) => ({ support: q.support, need: q.need }),
    // a tie with nothing in force goes to the alderman, who takes of the tied options the one his own attitude holds highest (VB-314)
    choose: (st, q, p) => {
      const top = Math.max(...q.support),
        k = Culture.IDX[q.dim];
      let best = -1;
      for (let j = 0; j < q.support.length; j++)
        if (
          q.support[j] === top &&
          (best < 0 || st.pawns[p].att[Culture.OFF[k] + j] > st.pawns[p].att[Culture.OFF[k] + best])
        )
          best = j;
      return best;
    },
    fallback: (st, q) => q.current,
  });
  // The alderman (VB-314; design.md, The alderman): the village's presiding pawn, so that a tie goes to him; none while the office is vacant.
  setPresider((st, body) => {
    const a = st.villages && st.villages[body] ? st.villages[body].alderman : null;
    return a !== undefined && a !== null && st.pawns[a].alive ? a : null;
  });
  // The office is filled by a question of its own: each voice for the holder it thinks most of, by its opinion of him and his standing
  // (elected), or the farm next in the order of founding (by turns, each farm a year in its turn). A tie at the top, with no alderman to
  // decide it, goes to the holder of most standing.
  defineKind('alderman', {
    procedure: 'vote',
    evaluate: (st, q) => {
      const S = q.cands.map(() => 0);
      if (q.by === 'byTurns') {
        const next = q.last === null ? -1 : q.farms.findIndex((f) => f > q.last); // the next farm founded after the last turn's
        S[next < 0 ? 0 : next] = 1;
      } else
        for (const voice of q.voices) {
          let best = 0,
            top = -Infinity;
          for (let j = 0; j < q.cands.length; j++) {
            const x = opinionOf(st, voice, q.cands[j]) + OFFICE.weighStanding * st.pawns[q.cands[j]].standing;
            VB.count.aldermanBallots++;
            if (x > top) {
              top = x;
              best = j;
            }
          }
          S[best]++;
        }
      return { support: S, need: S.map(() => 0) };
    },
    fallback: (st, q) => {
      let best = 0;
      for (let j = 1; j < q.cands.length; j++)
        if (st.pawns[q.cands[j]].standing > st.pawns[q.cands[best]].standing) best = j;
      return best;
    },
  });
  // Village s's office at its autumn meeting: vacated when its holder has died, retired, left the village or, by turns, served his year;
  // when vacant, filled from the village's holders, in the order of their farms' founding (village.farmsteads). One question, a vacancy.
  function aldermanMeeting(st, s, people) {
    const v = st.villages[s.id],
      by = Culture.practiceOf(st.cenv.cultures[s.culture], 'alderman'),
      a = v.alderman === undefined ? null : v.alderman;
    if (a !== null) {
      const p = st.pawns[a],
        why = !p.alive
          ? 'died'
          : !isHolder(st, a)
            ? 'retired as a holder'
            : settlementIdOf(st, p) !== s.id
              ? 'left the village'
              : by === 'byTurns' && v.aldermanYear !== cal(st.t).year
                ? 'served his year'
                : null;
      if (why === null) return;
      const since = Math.round((st.t - v.aldermanSince) / YEAR),
        txt = `${fullName(p)} is alderman of ${s.name} no longer: he ${why} after ${since} ${since === 1 ? 'year' : 'years'}.`;
      setAlderman(st, v, null);
      log(st, txt, { kind: 'alderman', pawn: a, village: s.id, n: since });
    }
    const cands = [],
      farms = [];
    for (const fid of v.farmsteads) {
      const hh = st.farmsteads[fid].household === null ? null : st.households[st.farmsteads[fid].household];
      if (hh && !hh.dissolved && hh.holder !== null && st.pawns[hh.holder].alive) {
        cands.push(hh.holder);
        farms.push(fid);
      }
    }
    if (!cands.length) return;
    const voices = people.filter((p) => voiceOf(st, p, s) > 0).map((p) => p.id),
      last = v.aldermanFarm === undefined ? null : v.aldermanFarm;
    const k = ask(st, {
      kind: 'alderman',
      body: s.id,
      current: null,
      options: cands.length,
      cands,
      farms,
      by,
      voices,
      last,
    });
    setAlderman(st, v, cands[k], farms[k]);
    const how = by === 'byTurns' ? 'in his turn' : 'by the meeting';
    log(st, `${fullName(st.pawns[cands[k]])} is chosen alderman of ${s.name}, ${how}.`, {
      kind: 'alderman',
      pawn: cands[k],
      village: s.id,
    });
  }
  const CULTURE_STEP = VILLAGE_STEPS,
    MEETING_STAGES = VILLAGE_STEPS + 2;
  // The villages whose turn is step n of the window (sim/occasions, villageTurn): f(k) for each, in order.
  function villagesOfStep(st, n, f) {
    const villages = st.villages.length,
      year = cal(st.t).year,
      at = (j) => (((j + year) % villages) + villages) % villages; // the village on slot j (villageSlot's inverse)
    if (villages <= VILLAGE_STEPS) {
      if (n < villages) f(at(n));
      return;
    }
    for (
      let j = Math.ceil((n * villages) / VILLAGE_STEPS);
      j < villages && Math.floor((j * VILLAGE_STEPS) / villages) === n;
      j++
    )
      f(at(j));
  }
  function meetingStage(st, n) {
    st.cenv.t = st.t / YEAR;
    if (n < VILLAGE_STEPS) villagesOfStep(st, n, (v) => villageMeeting(st, v));
    else if (n === CULTURE_STEP) {
      settleGatherings(st); // VB-294: once every village has chosen, who goes to which gathering this winter
      culturesYear(st);
    } else if (n === CULTURE_STEP + 1) landMeeting(st);
  }
  // Village v's meeting: its living's interests, its tie to its culture's centre, the causes its adults take up, and its meeting, whose lines
  // go to the head of st.meetingLog. At the first village's step, the island's roles and standing (every meeting reads them), and the living
  // of no settlement have their interests and causes with that village's.
  function villageMeeting(st, v) {
    const env = st.cenv,
      s = env.settlements[v],
      c = cal(st.t);
    const people = membersOf(st, v); // its living, in id order (the order of st.living)
    usualRotation(st, st.villages[v]); // its usual rotation, the one most of its farms hold (sim/fields, VB-350)
    VB.count.meetingWalk += people.length;
    const all = people.slice();
    if (v === 0) {
      refreshRoles(st);
      refreshStanding(st);
      VB.count.meetingWalk += st.living.length;
      for (const id of st.living) if (st.pawns[id].household === null) all.push(st.pawns[id]);
    }
    refreshInterests(st, all);
    if (s) updateTie(st, v, people);
    const hk = hooks(st);
    const starters = Culture.entrepreneurs(env, { ...hk, living: all.map((p) => p.id) }, drawer(st.rng.culture));
    for (const p of starters) {
      personEvent(
        st,
        p.id,
        'cause',
        `Took up the cause: ${Culture.DIMS[p.advocate.dim].label.toLowerCase()}, ${Culture.DIMS[p.advocate.dim].opts[p.advocate.opt][1].toLowerCase()}`,
        { reason: 'natural', village: settlementIdOf(st, p) },
      );
    }
    for (const p of starters.lapsed) causeEnded(st, p);
    if (!s) return;
    const out = [];
    const ch = Culture.meeting(env, { ...hk, membersOf: (x) => (x === s ? people : membersOf(st, x.id)) }, s);
    for (const x of ch) {
      const d = Culture.DIMS[x.dim],
        txt = `At the ${s.name} meeting: ${d.label.toLowerCase()} is now “${d.opts[x.to][1]}” (was “${d.opts[x.from][1]}”).`;
      log(st, txt, { kind: 'custom', village: s.id });
      out.push({ year: c.year, text: txt });
      // the causes of its people whose option has become the practice
      for (const p of people) {
        const a = p.advocate;
        if (!a || a.won || a.dim !== x.dim || a.opt !== x.to) continue;
        a.won = true;
        Culture.endCause(env, hk, p, a, 'won');
        causeEnded(st, p);
      }
    }
    // its meeting on its green today (sim/occasions)
    const held = st.occasions.find(
      (o) => o.kind === 'meeting' && o.village === s.id && o.start <= st.t && st.t < o.end,
    );
    const txt = routinesMeeting(st, s, held, people);
    if (txt) out.push({ year: c.year, text: txt });
    if (people.length) chooseGathering(st, s, quorumAt(st, s, held, people), people); // VB-294: its choice of gathering

    aldermanMeeting(st, s, people);
    VB['sim/keep'].meeting(st, s); // the keep's days owed to the alderman now in office (VB-463)
    toMeetingLog(st, out);
  }
  // A cause's end (VB-1112), told in the pawn's record with the last vote its village's meeting gave it (p.lastCause, Culture.endCause).
  const pct = (x) => `${Math.round(x * 100)}%`;
  function causeEnded(st, p) {
    const lc = p.lastCause,
      d = Culture.DIMS[lc.dim],
      years = Math.max(0, Math.round(lc.end - lc.since)),
      name = `${fullName(p)}'s cause, ${d.label.toLowerCase()}: ${d.opts[lc.opt][1].toLowerCase()}`,
      head =
        lc.how === 'won'
          ? `${name}, has won: it is now the practice, after ${years} ${years === 1 ? 'year' : 'years'}`
          : `${name}, has lapsed after ${years} ${years === 1 ? 'year' : 'years'}`;
    const tail =
      lc.sup === null
        ? ''
        : lc.how === 'won'
          ? `; at the last meeting it had ${pct(lc.sup)} against ${pct(lc.vs)} for ${d.opts[lc.vsOpt][1].toLowerCase()}`
          : `; at the last meeting it had ${pct(lc.sup)} against ${pct(lc.vs)} for ${d.opts[lc.vsOpt][1].toLowerCase()}, and needed ${pct(lc.need)}`;
    personEvent(st, p.id, 'cause', `${head}${tail}.`, { reason: lc.how, village: settlementIdOf(st, p) });
  }
  function toMeetingLog(st, lines) {
    st.meetingLog.unshift(...lines);
    st.meetingLog.length = Math.min(st.meetingLog.length, 30);
  }
  // At 18:00, once all the villages have met: each culture's year, and a line when no meeting of this year changed anything.
  function culturesYear(st) {
    const env = st.cenv,
      hk = hooks(st),
      c = cal(st.t),
      out = [];
    for (const cu of env.cultures) {
      const r = Culture.cultureYear(env, hk, cu);
      for (const x of r.changes) {
        // VB-1104: the line says which villages took the new custom up and which kept the old, not that it holds across the culture
        const d = Culture.DIMS[x.dim],
          names = (ids) => ids.map((id) => env.settlements[id].name).join(', '),
          took = x.took.length ? `taken up in ${names(x.took)}` : 'taken up in no village yet',
          kept = x.kept.length ? `; ${names(x.kept)} keeps “${d.opts[x.from][1]}”` : '',
          txt = `The ${cu.name} custom: ${d.label.toLowerCase()} is now “${d.opts[x.to][1]}” (was “${d.opts[x.from][1]}”), ${took}${kept}.`;
        log(st, txt, { kind: 'custom', village: cu.centres[0] });
        out.push({ year: c.year, text: txt });
      }
    }
    if (!out.length && !(st.meetingLog.length && st.meetingLog[0].year === c.year))
      out.push({ year: c.year, text: 'The meetings changed nothing this year.' });
    toMeetingLog(st, out);
    st.lastMeeting = st.t;
  }
  // The village's routines for the year (VB-257; design.md section 7, Village routines), at its meeting: with a quorum, at least half of
  // those with a voice come to the green (the meeting's occasion, sim/occasions), the meeting chooses from the village work available
  // (sim/plans) and sets them by its verb; without one, or when the choice is tied, it does not decide, and its culture's practice says
  // what follows: no village work this year ('nothing') or last year's again ('asLastYear'), told in the log as a notable event of the
  // village. A village with no one living holds no meeting, and its routines stand. Returns the log's line of a failure, or null.
  const QUORUM = 0.5;
  // Who of those with a voice came to the meeting o, and whether they make a quorum.
  function attendance(st, s, o, people) {
    let voices = 0,
      came = 0;
    for (const p of people) if (voiceOf(st, p, s) > 0) voices++;
    if (o) for (const id of o.come) if (st.pawns[id].alive && st.agents[id].occasion === o.id) came++;
    return { voices, came, quorum: voices > 0 && came >= voices * QUORUM };
  }
  const quorumAt = (st, s, o, people) => attendance(st, s, o, people).quorum;
  function routinesMeeting(st, s, o, people = membersOf(st, s.id)) {
    const v = st.villages[s.id];
    if (!v || !people.length) return null;
    const { voices, came, quorum } = attendance(st, s, o, people),
      list = quorum ? chooseRoutines(st, v) : null;
    if (list) {
      issue(st, {
        actor: { settlement: s.id },
        verb: 'routines',
        args: { routines: list, by: 'meeting' },
        source: 'meeting',
      });
      return null;
    }
    const by = Culture.practiceOf(st.cenv.cultures[s.culture], 'noDecision'),
      plan = st.plans.villages.get(s.id);
    const kept = by === 'asLastYear' ? plan.routines : [];
    issue(st, { actor: { settlement: s.id }, verb: 'routines', args: { routines: kept, by }, source: 'meeting' });
    const why = quorum
      ? "was split evenly over the village's work"
      : `had no quorum (${came} of ${voices} ${voices === 1 ? 'voice' : 'voices'} there)`;
    const work = kept.map((k) => VILLAGE_ROUTINES[k].label.toLowerCase()).join(', ');
    const then =
      by === 'asLastYear'
        ? kept.length
          ? `the village keeps last year's work: ${work}`
          : "the village keeps last year's work, which was none"
        : v.fence.length
          ? 'no village work this year, and the village fence goes unmended'
          : 'no village work this year';
    const txt = `The ${s.name} meeting ${why} and did not decide: ${then}.`;
    log(st, txt, { kind: 'meetingFailed', village: s.id, n: came, of: voices });
    return txt;
  }
  function holdMeetings(st) {
    for (let n = 0; n <= CULTURE_STEP; n++) meetingStage(st, n);
  } // not the land meeting
  // The day's drift of attitudes (VB-201) runs over the night's 6-minute steps after midnight, a settlement a step (Rules for cost, 5):
  // settlement k of the culture on step 1 + k % NIGHT_STEPS of the day, the living of no settlement on step 1. Nothing is saved: the step of
  // the day says what is due, so a run loaded between two steps does the rest.
  const NIGHT_STEPS = 40;
  // Called on steps 1 to NIGHT_STEPS of the day only (sim/clock, CALENDAR: nightCulture).
  function nightCulture(st, step) {
    const env = st.cenv,
      hk = hooks(st),
      rand = drawer(st.rng.culture);
    env.t = st.t / YEAR;
    env.driftMul = st.driftMul;
    if (step === 1) Culture.settlementStep(env, hk, 1 / YEAR_DAYS, rand, null);
    for (let k = step - 1; k < env.settlements.length; k += NIGHT_STEPS)
      Culture.settlementStep(env, hk, 1 / YEAR_DAYS, rand, env.settlements[k]);
  }
  return {
    villagesOfStep,
    holdMeetings,
    meetingStage,
    routinesMeeting,
    MEETING_STAGES,
    nightCulture,
    NIGHT_STEPS,
  };
})();
