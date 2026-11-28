// @sys sim/meetings [agency]: the year's meetings (a village a step, then the cultures and the land meeting), the village's routines and its choice
//   of gathering (sim/gathering) made at its meeting, and the night's drift of attitudes, a settlement a step (split from sim/lifecycle, VB-876)
VB['sim/meetings'] = (() => {
  // The kinds of event it writes on the record (sim/eventkinds, VB-1946).
  VB['sim/eventkinds'].eventKinds('sim/meetings', {
    custom: { group: 'custom', notice: 'custom', skip: 'custom', word: 'changes of custom' },
    meetingFailed: { group: 'custom', notice: 'meeting' },
    alderman: {}, // the village's alderman chosen, and the office vacated (VB-314)
    workLeft: { keep: 'short' }, // a village's routine work left undone at its seasons' ends, heard at its meeting (VB-1768)
    proposal: { keep: 'short' }, // a holder's proposal to its village's meeting and its fate (VB-1770)
  });
  const { drawer } = VB['sim/rng'];
  const Culture = VB['culture'],
    Attitudes = VB['sim/attitudes'],
    Customs = VB['sim/customs'];
  const { landMeeting } = VB['sim/territory'];
  const { YEAR_DAYS, YEAR, OFFICE, cal } = VB['sim/rules'];
  const { personEvent, log, membersOf, voiceOf, settlementIdOf, fullName, isHolder } = VB['sim/records'];
  const { opinionOf } = VB['sim/relations'];
  const { setAlderman } = VB['sim/membership'];
  const { chooseRoutines, VILLAGE_ROUTINES } = VB['sim/routines'];
  const { living, villageOf } = VB['sim/records'];
  const { refreshRoles } = VB['sim/heirs'];
  const { updateTie, refreshStanding, refreshInterests, hooks } = VB['sim/society'];
  const { issue, register } = VB['sim/commands'];
  const { defineKind, setPresider, ask } = VB['sim/decisions'];
  const { VILLAGE_STEPS } = VB['sim/occasions'];
  const { chooseGathering, settleGatherings } = VB['sim/gathering'];
  const { usualRotation } = VB['sim/rotations'];
  const { PATRON } = VB['sim/followers'];
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
        k = Customs.IDX[q.dim];
      let best = -1;
      for (let j = 0; j < q.support.length; j++)
        if (
          q.support[j] === top &&
          (best < 0 || st.pawns[p].att[Customs.OFF[k] + j] > st.pawns[p].att[Customs.OFF[k] + best])
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
  VB.counter(
    'aldermanBallots',
    "Voices times candidates weighed when a village's meeting elects its alderman: once a vacancy, never daily (sim/meetings, VB-314)",
  );
  // The office is filled by a question of its own: each voice for the holder it thinks most of, by its opinion of him and his standing, and
  // a follower's term for its lord (PATRON.ballot, VB-708)
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
            const x =
              opinionOf(st, voice, q.cands[j]) +
              OFFICE.weighStanding * st.pawns[q.cands[j]].standing +
              (st.pawns[voice].looksTo === q.cands[j] ? PATRON.ballot : 0); // a follower leans to its lord (VB-708)
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
      by = Customs.practiceOf(st.cenv.cultures[s.culture], 'alderman'),
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
  VB.counter(
    'meetingWalk',
    "Pawn records walked by a village's meeting: its living, and at the first village's the island's (sim/lifecycle, VB-278)",
  );
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
        `Took up the cause: ${Customs.DIMS[p.advocate.dim].label.toLowerCase()}, ${Customs.DIMS[p.advocate.dim].opts[p.advocate.opt][1].toLowerCase()}`,
        { reason: 'natural', village: settlementIdOf(st, p) },
      );
    }
    for (const p of starters.lapsed) causeEnded(st, p);
    if (!s) return;
    const out = [];
    const ch = Culture.meeting(env, { ...hk, membersOf: (x) => (x === s ? people : membersOf(st, x.id)) }, s);
    const ballots = ballotsOf(st, s.id);
    for (const x of ch) {
      const d = Customs.DIMS[x.dim],
        b = ballots.find((e) => e.dim === x.dim),
        votes = b ? `, by ${tally(d, b, x.to, false)}` : '',
        txt = `At the ${s.name} meeting: ${d.label.toLowerCase()} is now “${d.opts[x.to][1]}” (was “${d.opts[x.from][1]}”)${votes}.`;
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
    // the customs that came close to changing (VB-082): the meeting log only, not the record, since nothing changed
    for (const b of ballots) {
      const y = leader(b.support),
        x = b.current;
      if (b.chosen !== x || y === x || ch.some((c) => c.dim === b.dim)) continue;
      const need = b.support[x] * (1 + b.need);
      if (need <= 0 || b.support[y] < NEAR * need) continue;
      const d = Customs.DIMS[b.dim];
      out.push({
        year: c.year,
        text: `At the ${s.name} meeting: ${d.label.toLowerCase()} stays “${d.opts[x][1]}”, narrowly: ${tally(d, b, y)}.`,
        close: true,
      });
    }
    // its meeting on its green today (sim/occasions)
    const held = st.occasions.find(
      (o) => o.kind === 'meeting' && o.village === s.id && o.start <= st.t && st.t < o.end,
    );
    holdersPropose(st, s); // the year's review, at the agenda's closing (VB-1770)
    const txt = routinesMeeting(st, s, held, people);
    if (txt) out.push({ year: c.year, text: txt });
    if (people.length) chooseGathering(st, s, quorumAt(st, s, held, people), people); // VB-294: its choice of gathering

    aldermanMeeting(st, s, people);
    VB['sim/keep'].meeting(st, s); // the keep's days owed to the alderman now in office (VB-463)
    VB['sim/class'].meeting(st, s); // the year's livelihoods reckoned, a village a step (VB-318)
    toMeetingLog(st, out);
  }
  // A cause's end (VB-1112), told in the pawn's record with the last vote its village's meeting gave it (p.lastCause, Culture.endCause).
  const pct = (x) => `${Math.round(x * 100)}%`;
  // The votes on a custom at a meeting, as the log tells them (VB-082): read from the ballots sim/decisions keeps (st.decisionLog), those of
  // village v's meeting now (asked on this step, so at st.t), each {dim, current, chosen, support[], need: the share by which the leading
  // way had to pass the practice}. A custom whose leading way came within NEAR of the support it needed (95% of it) came close.
  const NEAR = 0.95;
  const ballotsOf = (st, v) =>
    (st.decisionLog || []).filter((b) => b.t === st.t && b.kind === 'custom' && b.body === v && b.dim !== null);
  const leader = (S) => S.reduce((y, v, j) => (v > S[y] ? j : y), 0);
  // "“Any child” 46% against “Sons first” 31%; needed 25% more": way y against the practice the ballot was put to; without the ways'
  // names where the line has named them
  function tally(d, b, y, named = true) {
    const x = b.current,
      way = (j) => (named ? `“${d.opts[j][1]}” ` : '');
    return `${way(y)}${pct(b.support[y])} against ${way(x)}${pct(b.support[x])}; it needed ${pct(b.need)} more`;
  }
  function causeEnded(st, p) {
    const lc = p.lastCause,
      d = Customs.DIMS[lc.dim],
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
  // The cultures that fill more than one gathering (VB-296; design.md, Customs drawn together): [{culture, hosts (ids, ascending)}] of the
  // cultures whose villages go to two gatherings or more this winter, read from the villages' choices: candidates to split along them.
  // Reads only; the split itself is the fission's.
  function splitCandidates(st) {
    const out = [];
    st.cenv.cultures.forEach((cu, ci) => {
      const hosts = new Set();
      for (const s of st.cenv.settlements) {
        const g = s.culture === ci ? st.villages[s.id].gathering : null;
        if (g && g.host !== null && g.host !== undefined) hosts.add(g.host);
      }
      if (hosts.size > 1) out.push({ culture: ci, hosts: [...hosts].sort((a, b) => a - b) });
    });
    return out;
  }
  VB.counter(
    'splitCandidate',
    'Cultures reported at the year as filling more than one gathering (sim/meetings, VB-296)',
  );
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
        const d = Customs.DIMS[x.dim],
          names = (ids) => ids.map((id) => env.settlements[id].name).join(', '),
          took = x.took.length ? `taken up in ${names(x.took)}` : 'taken up in no village yet',
          kept = x.kept.length ? `; ${names(x.kept)} keeps “${d.opts[x.from][1]}”` : '',
          txt = `The ${cu.name} custom: ${d.label.toLowerCase()} is now “${d.opts[x.to][1]}” (was “${d.opts[x.from][1]}”), ${took}${kept}.`;
        log(st, txt, { kind: 'custom', village: cu.centres[0] });
        out.push({ year: c.year, text: txt });
      }
    }
    for (const x of splitCandidates(st)) {
      const cu = env.cultures[x.culture],
        names = x.hosts.map((h) => st.villages[h].name).join(' and ');
      VB.count.splitCandidate++;
      log(st, `The ${cu.name} culture fills the gatherings of ${names}: a candidate to split.`, {
        kind: 'custom',
        village: cu.centres[0],
      });
    }
    if (!out.length && !st.meetingLog.some((e) => e.year === c.year && !e.close))
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
  // The meeting hears the work its routines left undone at their seasons' ends since the last (sim/routines plan.routineLeft), as a
  // neglected stretch is named: a line in the village's record; the choice weighs it (chooseRoutines).
  function neglected(st, v) {
    const plan = st.plans.villages.get(v.id),
      R = plan.routineLeft,
      left = R && R.by === plan.routinesBy + plan.routinesYear ? R.days : {},
      parts = Object.keys(left)
        .filter((k) => left[k] > 0)
        .map((k) => `${left[k]} ${left[k] === 1 ? 'day' : 'days'} of ${VILLAGE_ROUTINES[k].label.toLowerCase()}`);
    if (parts.length)
      log(st, `The meeting of ${v.name} heard of the village's work left undone: ${parts.join('; ')}.`, {
        kind: 'workLeft',
        village: v.id,
      });
  }
  // ---- a holder proposes (VB-1770; design.md section 15, The meeting decides, a holder proposes) ----
  // @state plan.proposed (a village's): [{by (a holder's pawn), year, what: 'routine' | 'lots', value (a routine's key, or a custom of lots's
  //   option)}], the agenda of the next meeting, one a holder a year; written by the verb `propose` and cleared by the meeting, which tells
  //   each and its fate in the record. plan.lotsRule: the village's custom of lots once its meeting has changed it (sim/customs lotsRule).
  // The meeting weighs a proposal by its procedure (sim/decisions): a routine is taken up where the village has the work (the need and
  // the work left over, and the holders' words), refused where it has none; the custom of lots by a vote of the households, each for the
  // rule under which its own lot of a reference levy is least (the one in force on a tie). The proposal puts the question; no pawn has a ballot.
  defineKind('routine', {
    procedure: 'vote',
    evaluate: (st, q) => ({ support: q.support, need: [0, 0] }),
    fallback: (st, q) => q.current,
  });
  defineKind('lots', {
    procedure: 'vote',
    evaluate: (st, q) => ({ support: q.support, need: q.support.map(() => Customs.PRACTICES.lots.malleability) }),
    fallback: (st, q) => q.current,
  });
  const LOTS = Customs.PRACTICES.lots.opts.map((o) => o[0]);
  const holdersOf = (st, vid) => {
    const out = [];
    for (const fid of st.villages[vid].farmsteads) {
      const hh = st.farmsteads[fid].household === null ? null : st.households[st.farmsteads[fid].household];
      if (hh && !hh.dissolved && hh.holder !== null && st.pawns[hh.holder].died === null) out.push(hh);
    }
    return out;
  };
  // Has village v's meeting of this year been held: its routines set since the founders'.
  const heldThisYear = (st, plan) => plan.routinesBy !== 'founded' && plan.routinesYear === cal(st.t).year;
  // propose(village, {what: 'routine', routine} | {what: 'lots', rule}): a holder of the village puts it on the next meeting's agenda.
  register('propose', {
    check: (st, c) => {
      const vid = c.target,
        plan = Number.isInteger(vid) ? st.plans.villages.get(vid) : undefined,
        a = c.args || {};
      if (!plan) return `village ${vid} has no plan`;
      if (living(st, c.actor)) return living(st, c.actor);
      const p = st.pawns[c.actor];
      if (!isHolder(st, c.actor) || p.household === null || villageOf(st, p) !== vid)
        return `pawn ${c.actor} is not a holder of village ${vid}`;
      if (heldThisYear(st, plan)) return `the meeting of ${st.villages[vid].name} has been held this year`;
      const y = cal(st.t).year;
      if ((plan.proposed || []).some((x) => x.by === c.actor && x.year === y)) return 'a holder proposes once a year';
      if (a.what === 'routine')
        return Object.hasOwn(VILLAGE_ROUTINES, a.routine) ? null : `there is no routine ${a.routine}`;
      if (a.what === 'lots') return LOTS.includes(a.rule) ? null : `there is no custom of lots ${a.rule}`;
      return 'a holder proposes a routine or the lots';
    },
    run: (st, c) => {
      const plan = st.plans.villages.get(c.target),
        a = c.args;
      (plan.proposed = plan.proposed || []).push({
        by: c.actor,
        year: cal(st.t).year,
        what: a.what,
        value: a.what === 'routine' ? a.routine : a.rule,
      });
    },
  });
  // The lots each household of village vid would bear of a reference levy under each custom, [Map household id -> lot] by option.
  function lotsUnder(st, vid) {
    const D = Math.max(1, holdersOf(st, vid).length * 2),
      split = VB['sim/levies'].split;
    return LOTS.map((rule) => new Map(split(st, vid, D, rule)[0]));
  }
  // The default author of each holder's year's review (a decision point, sim/points; its deadline the agenda's closing, as the meeting
  // begins): one proposal a holder who has made none, by its own judgement: a routine it needs and lacks hands for (the village's work not
  // yet its routine, a farm with more than two fields to each adult), else the custom of lots under which its lot is lighter by a day.
  function holdersPropose(st, s) {
    const v = st.villages[s.id],
      plan = st.plans.villages.get(s.id),
      y = cal(st.t).year;
    if (!plan || heldThisYear(st, plan)) return;
    let lots = null;
    for (const hh of holdersOf(st, s.id)) {
      if ((plan.proposed || []).some((x) => x.by === hh.holder && x.year === y)) continue;
      const adults = hh.members.filter((id) => st.pawns[id].died === null && st.pawns[id].age >= 18).length,
        fields = hh.farmstead === null ? 0 : st.farmsteads[hh.farmstead].fields.length;
      let best = null;
      if (fields > 2 * adults)
        for (const k of Object.keys(VILLAGE_ROUTINES)) {
          const R = VILLAGE_ROUTINES[k];
          if (plan.routines.includes(k) || !R.available(st, v)) continue;
          const n = R.need(st, v);
          if (n > 0 && (best === null || n > best[0])) best = [n, k];
        }
      const cmd = { actor: hh.holder, verb: 'propose', target: s.id, source: 'pawn' };
      if (best) {
        issue(st, { ...cmd, args: { what: 'routine', routine: best[1] } });
        continue;
      }
      lots = lots || lotsUnder(st, s.id);
      const now = LOTS.indexOf(Customs.lotsRule(st, s.id)),
        own = (j) => lots[j].get(hh.id) || 0;
      let j = now;
      for (let i = 0; i < LOTS.length; i++) if (own(i) < own(j)) j = i;
      if (j !== now && own(now) - own(j) >= 1) issue(st, { ...cmd, args: { what: 'lots', rule: LOTS[j] } });
    }
  }
  // The agenda's proposals of this year weighed at the meeting of village s (`decides`: it has a quorum), each told in the record with its
  // fate; returns {routine: holders who proposed it} of those taken up, for the choice's weighing. The agenda is cleared.
  function weighProposals(st, s, decides) {
    const v = st.villages[s.id],
      plan = st.plans.villages.get(s.id),
      y = cal(st.t).year,
      list = (plan.proposed || []).filter((x) => x.year === y),
      taken = {},
      said = (x, fate) =>
        log(
          st,
          `${fullName(st.pawns[x.by])} proposed to the ${s.name} meeting ${
            x.what === 'routine'
              ? VILLAGE_ROUTINES[x.value].label.toLowerCase()
              : `that levy lots be split: ${Customs.PRACTICES.lots.opts[LOTS.indexOf(x.value)][1].toLowerCase()}`
          }; ${fate}.`,
          { kind: 'proposal', village: s.id, pawn: x.by, what: x.what, value: x.value },
        );
    plan.proposed = [];
    for (const x of list) {
      if (!decides) {
        said(x, 'the meeting did not decide');
        continue;
      }
      if (x.what !== 'routine') continue;
      const R = VILLAGE_ROUTINES[x.value],
        n = list.filter((z) => z.what === 'routine' && z.value === x.value).length,
        avail = R.available(st, v),
        left =
          plan.routineLeft && plan.routineLeft.by === plan.routinesBy + plan.routinesYear ? plan.routineLeft.days : {},
        w = avail ? R.need(st, v) + (left[x.value] || 0) + n : 0,
        take = ask(st, { kind: 'routine', body: s.id, current: 0, options: 2, support: [avail ? 0 : n, w] });
      if (take === 1) taken[x.value] = n;
      said(x, take === 1 ? 'the meeting took it up' : 'the meeting refused it: the village has no such work');
    }
    const lotsList = list.filter((x) => x.what === 'lots');
    if (decides && lotsList.length) {
      const lots = lotsUnder(st, s.id),
        now = LOTS.indexOf(Customs.lotsRule(st, s.id)),
        support = LOTS.map(() => 0);
      for (const hh of holdersOf(st, s.id)) {
        let j = now;
        for (let i = 0; i < LOTS.length; i++) if ((lots[i].get(hh.id) || 0) < (lots[j].get(hh.id) || 0)) j = i;
        support[j]++;
      }
      // the question is put once for each rule proposed, the best supported first
      const rules = [...new Set(lotsList.map((x) => LOTS.indexOf(x.value)))].sort(
        (a, b) => support[b] - support[a] || a - b,
      );
      let chosen = now;
      for (const j of rules) {
        const sup = support.map((n, i) => (i === now || i === j ? n : 0));
        if (ask(st, { kind: 'lots', body: s.id, current: now, options: LOTS.length, support: sup }) === j) {
          chosen = j;
          break;
        }
      }
      for (const x of lotsList)
        said(x, LOTS.indexOf(x.value) === chosen ? 'the meeting adopted it' : 'the meeting kept the custom of lots');
      if (chosen !== now) {
        plan.lotsRule = LOTS[chosen];
        log(
          st,
          `At the ${s.name} meeting: levy lots are now split “${Customs.PRACTICES.lots.opts[chosen][1].toLowerCase()}”.`,
          { kind: 'custom', village: s.id },
        );
      }
    }
    return taken;
  }
  function routinesMeeting(st, s, o, people = membersOf(st, s.id)) {
    const v = st.villages[s.id];
    if (!v || !people.length) return null;
    const { voices, came, quorum } = attendance(st, s, o, people),
      taken = weighProposals(st, s, quorum),
      list = quorum ? chooseRoutines(st, v, false, taken) : null;
    neglected(st, v); // the work the routines left undone, heard before the choice (VB-1768)
    if (list) {
      issue(st, {
        actor: { settlement: s.id },
        verb: 'routines',
        args: { routines: list, by: 'meeting' },
        source: 'meeting',
      });
      return null;
    }
    const by = Customs.practiceOf(st.cenv.cultures[s.culture], 'noDecision'),
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
    if (step === 1) Attitudes.settlementStep(env, hk, 1 / YEAR_DAYS, rand, null);
    for (let k = step - 1; k < env.settlements.length; k += NIGHT_STEPS)
      Attitudes.settlementStep(env, hk, 1 / YEAR_DAYS, rand, env.settlements[k]);
  }
  // When the year's meetings begin (the calendar's, sim/clock): autumn's tenth day at noon, the agenda closing then (VB-1757: the year's
  // review, a decision point, sim/points)
  const MEETING = Object.freeze({ season: 2, sday: 9, hour: 12 });
  return {
    // what it gives the page through the Sim facade (src/sim.js joins the lists, VB-1944)
    PAGE: ['holdMeetings'],
    MEETING,
    villagesOfStep,
    holdMeetings,
    meetingStage,
    routinesMeeting,
    MEETING_STAGES,
    nightCulture,
    NIGHT_STEPS,
  };
})();
