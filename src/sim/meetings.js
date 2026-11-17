// @sys sim/meetings: the year's meetings (a village a step, then the cultures and the land meeting), the village's routines chosen at its
//   meeting, and the night's drift of attitudes, a settlement a step (split from sim/lifecycle, VB-876)
VB['sim/meetings'] = (() => {
  const { drawer } = VB['sim/rng'];
  const Culture = VB['culture'];
  const { landMeeting } = VB['sim/territory'];
  const { YEAR_DAYS, YEAR, cal } = VB['sim/rules'];
  const { personEvent, log, membersOf, voiceOf } = VB['sim/records'];
  const { chooseRoutines, VILLAGE_ROUTINES } = VB['sim/plans'];
  const { refreshRoles } = VB['sim/heirs'];
  const { updateTie, refreshPrestige, refreshInterests, hooks } = VB['sim/society'];
  const { issue } = VB['sim/commands'];
  const { VILLAGE_STEPS } = VB['sim/occasions'];
  // The year's meetings (VB-278; design.md, A village's meeting): on autumn day 10, each village's meeting on its own 6-minute step from noon,
  // in the order of village id from `year mod villages` (villageTurn, as the moving round's villages), then from 18:00 each culture's year,
  // and on the next step the
  // land meeting, which settles outland between villages. `meetingStage(st, n)`, n the step from noon, is each step's entry point; nothing
  // is kept from one step for the next, so nothing is saved: the step of the day says what is due. `holdMeetings` is every village's and the
  // cultures' at once, not the land meeting (the drawer's button, the tests).
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
    else if (n === CULTURE_STEP) culturesYear(st);
    else if (n === CULTURE_STEP + 1) landMeeting(st);
  }
  // Village v's meeting: its living's interests, its tie to its culture's centre, the causes its adults take up, and its meeting, whose lines
  // go to the head of st.meetingLog. At the first village's step, the island's roles and prestige (every meeting reads them), and the living
  // of no settlement have their interests and causes with that village's.
  function villageMeeting(st, v) {
    const env = st.cenv,
      s = env.settlements[v],
      c = cal(st.t);
    const people = membersOf(st, v); // its living, in id order (the order of st.living)
    VB.count.meetingWalk += people.length;
    const all = people.slice();
    if (v === 0) {
      refreshRoles(st);
      refreshPrestige(st);
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
      );
    }
    if (!s) return;
    const out = [];
    const ch = Culture.meeting(env, { ...hk, membersOf: (x) => (x === s ? people : membersOf(st, x.id)) }, s);
    for (const x of ch) {
      const d = Culture.DIMS[x.dim],
        txt = `At the ${s.name} meeting: ${d.label.toLowerCase()} is now “${d.opts[x.to][1]}” (was “${d.opts[x.from][1]}”).`;
      log(st, txt, { kind: 'custom', village: s.id });
      out.push({ year: c.year, text: txt });
    }
    // its meeting on its green today (sim/occasions)
    const held = st.occasions.find(
      (o) => o.kind === 'meeting' && o.village === s.id && o.start <= st.t && st.t < o.end,
    );
    const txt = routinesMeeting(st, s, held, people);
    if (txt) out.push({ year: c.year, text: txt });
    toMeetingLog(st, out);
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
        const d = Culture.DIMS[x.dim],
          txt = `Across the ${cu.name} culture: ${d.label.toLowerCase()} is now “${d.opts[x.to][1]}”.`;
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
  function routinesMeeting(st, s, o, people = membersOf(st, s.id)) {
    const v = st.villages[s.id];
    if (!v || !people.length) return null;
    let voices = 0,
      came = 0;
    for (const p of people) if (voiceOf(st, p, s) > 0) voices++;
    if (o) for (const id of o.come) if (st.pawns[id].alive && st.agents[id].occasion === o.id) came++;
    const quorum = voices > 0 && came >= voices * QUORUM,
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
