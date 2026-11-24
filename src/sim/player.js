// @sys sim/player: the player (VB-169), a source of commands with one pawn at a time: its queue, which goes before the pawn's own logic, its
// wish, its answer and its choices as head, its pawn's death and whom it goes on as
VB['sim/player'] = (() => {
  const { release, free, goHome, idle } = VB['sim/agents'];
  const { here, bed } = VB['sim/pose'];
  const { SLEEP, AWAKE } = VB['sim/sleep'];
  const { holdingOf, spouseOf, personEvent, living, villageOf, fullName } = VB['sim/records'];
  const { cal, WORK, HEALTH, DAY, TICKS } = VB['sim/rules'],
    { SOCIAL } = VB['sim/ties'];
  const { relationsOf, opinionWord } = VB['sim/relations'];
  const { setWish, resetWish, endPartner } = VB['sim/wishes'];
  const { issue, perform, active, VERBS, register } = VB['sim/commands'];
  const { on } = VB['sim/events'];
  const { daysOfFood } = VB['sim/foodneed'];
  const { KINDS } = VB['sim/kinds'];
  const { planDay, planBegun } = VB['sim/playerplan'];
  const { nextOf } = VB['sim/plannext'];
  const { MOVE_KINDS } = VB['sim/planchains'];
  // ---- the player (VB-169): one source, `player`, with one pawn at a time, whose queued commands go before the pawn's own logic ----
  // @state st.player: null, or {pawn (the inhabited pawn's id), auto (boolean: left to itself, the pawn does what its role's automatic
  //   behaviour chooses), queue[] (at most QUEUE_MAX commands {actor: pawn, verb, target, args, source: 'player', begun, ref}, in turn;
  //   `begun` is null until the command is issued, then the game time: only the head is ever begun, and it stays the head while its act
  //   lasts; `ref` is null, or once begun the reference its verb gave to the act it began (sim/commands perform, VB-1405), plain data;
  //   absent in a command begun in a save made before VB-1405; `plan` {from, kind, key} in a command the plan fed, sim/playerplan),
  //   refused (null, or {verb, why, t}: the last command refused when its turn came), since (game hours), left (null while the pawn
  //   lives; from its death {t, held (the household it held, or null), spouse (pawn id or null), ties[] (at most TIES_MAX {id, why}: those
  //   it thought friends, best first), village (the settlement whose customs name its successor, VB-1121)}: what a death erases and the
  //   player's succession needs, VB-213), ended (null, or when the line ended: its pawn died with no successor, VB-1121), last (null, or {kind, farm, good,
  //   n, t}: the pawn's last task done or load brought home, VB-1118), days[] (at most DAYS_KEPT {t, health, before, hunger, food, why}:
  //   the pawn's health after each of its last meals, its hunger level, its household's food in days of need, and what moved its health,
  //   why {hunger, cold, damp, ill, tired, rest}, VB-1118; tired absent in a day kept before VB-1615), sleep ({owed, asleep}, below;
  //   absent in a save made before VB-1615)}; plain data, saved with the run
  // @state st.player.sleep: {owed (hours of sleep the pawn owes, 0 to SLEEP.cap), asleep (boolean: it slept in the last step), at (the
  //   step, st.tick, last reckoned: once a step, however often the queue is stepped)}, kept by sleepStep (VB-1615); read by sim/sleep for
  //   mood and health
  const QUEUE_MAX = 8,
    TIES_MAX = 12,
    DAYS_KEPT = 5;
  function inhabit(st, id) {
    const dead = living(st, id);
    if (dead) return dead;
    if (st.player) uninhabit(st);
    st.player = {
      pawn: id,
      auto: true,
      queue: [],
      refused: null,
      since: st.t,
      left: null,
      ended: null,
      last: null,
      days: [],
      sleep: { owed: 0, asleep: false, at: st.tick },
    };
    resetWish(st, id); // the player starts from the default wish (VB-680): its wishes are the pawn's (pawn.wish, sim/wishes)
    personEvent(st, id, 'player', 'Played by the player');
    return true;
  }
  function uninhabit(st) {
    if (!st.player) return 'no pawn is played';
    personEvent(st, st.player.pawn, 'player', 'No longer played by the player');
    st.player = null;
    return true;
  }
  // The played pawn dies (sim/lifecycle, before the death ends its marriage and drops its ties): the player keeps it, with an empty queue,
  // until it goes on as another (VB-213), and what the death erases is noted: the farm it held, its spouse, those it thought friends.
  // `next(st, id, village)` names its successor (successorOf, sim/heirranking, which loads later): with none, the line ends at once.
  function playerDied(st, id, next) {
    const pl = st.player;
    if (!pl || pl.pawn !== id) return;
    const held = holdingOf(st, id),
      friends = relationsOf(st, id).filter((r) => r.opinion >= SOCIAL.friend);
    friends.sort((x, y) => y.opinion - x.opinion || x.id - y.id);
    pl.queue = [];
    pl.left = {
      t: st.t,
      held: held ? held.id : null,
      spouse: spouseOf(st, id),
      ties: friends.slice(0, TIES_MAX).map((r) => ({ id: r.id, why: opinionWord(r.opinion) })),
      village: st.pawns[id].household !== null ? villageOf(st, st.pawns[id]) : null,
    };
    if (next(st, id, pl.left.village) === null)
      goOnAs(st, null, `The line ended with ${fullName(st.pawns[id])}: no one of it was left`);
  }
  // The player goes on as pawn id after its pawn's death: `text` is written to the dead pawn's events, and id is played from now, with
  // nothing queued and no wishes. sim/opportunities' succeed checks who may be chosen; true, or why not.
  // With id null no one of the line lives (VB-1121): the game ends, the break is written, and the player keeps the dead pawn, so a save of
  // an ended game loads as ended.
  function goOnAs(st, id, text) {
    const pl = st.player;
    if (!pl || !pl.left) return 'the played pawn has not died';
    if (pl.ended !== null) return 'the line has ended';
    if (id === null) {
      pl.ended = st.t;
      personEvent(st, pl.pawn, 'player', text);
      return 'the line has ended';
    }
    const dead = living(st, id);
    if (dead) return dead;
    personEvent(st, pl.pawn, 'player', text);
    st.player = null;
    return inhabit(st, id);
  }
  // Needs go on: with nothing left to do after the end of work, the player's pawn goes home, as everyone did at dark.
  function homeAtDark(st, pl) {
    const a = st.agents[pl.pawn],
      h = cal(st.t).hour;
    if ((h >= WORK[1] || h < WORK[0]) && !a.inside && a.phase === null)
      issue(st, { actor: pl.pawn, verb: 'goHome', source: 'planner' });
  }
  // The command joins the queue, to be checked when its turn comes; true, or why it does not: the queue is full, there is no such verb,
  // or it is not the player's to do (a verb that names its sources and not 'player': `skip`, `kill`, `retire`, the world's and not a
  // pawn's, VB-681; `skip` would advance time from within a step), or its actor is not the player's pawn.
  function queue(st, cmd) {
    const pl = st.player;
    if (!pl) return 'no pawn is played';
    const V = cmd && VERBS[cmd.verb];
    if (!V || (V.sources && !V.sources.includes('player'))) return `there is no verb ${cmd && cmd.verb} to queue`;
    if (cmd.actor !== pl.pawn) return `pawn ${cmd.actor} is not the player's pawn`;
    if (pl.queue.length >= QUEUE_MAX) return `the queue is full (${QUEUE_MAX} commands)`;
    const copy = (v) => (v === undefined ? null : JSON.parse(JSON.stringify(v))); // the queue keeps its own plain data
    pl.queue.push({
      actor: pl.pawn,
      verb: cmd.verb,
      target: copy(cmd.target),
      args: copy(cmd.args),
      source: 'player',
      begun: null,
      ref: null,
    });
    return true;
  }
  // Takes command i off the queue. The head, once begun, only stops being the player's: the pawn goes on with the act as its own.
  function unqueue(st, i) {
    const pl = st.player;
    if (!pl) return 'no pawn is played';
    if (!(Number.isInteger(i) && i >= 0 && i < pl.queue.length)) return `the queue has no command ${i}`;
    pl.queue.splice(i, 1);
    if (!pl.queue.length && !living(st, pl.pawn)) homeAtDark(st, pl);
    return true;
  }
  function setAuto(st, on) {
    if (!st.player) return 'no pawn is played';
    st.player.auto = !!on;
    return true;
  }
  // The wish verb (VB-212, VB-680): the played pawn's wish at the moving round, written on the pawn as every pawn's is (pawn.wish,
  // sim/wishes); the round reads it as anyone's and decides by its rules, so a wish is not checked against them here; it stays until
  // changed. True, or why it is not a wish.
  function wish(st, kind, value) {
    const pl = st.player;
    if (!pl) return 'no pawn is played';
    if (!['out', 'claim', 'serve', 'match', 'settle', 'rank'].includes(kind)) return `there is no wish ${kind}`;
    // claim takes a farm id and match a pawn id (of the other sex, living and single), else null or false; out, serve and settle null,
    // true or false; rank a whole ranking (sim/wishes)
    const id = (kind === 'claim' || kind === 'match') && Number.isInteger(value);
    const target = kind === 'claim' ? st.farmsteads[value] : st.pawns[value];
    if (
      kind !== 'rank' &&
      (id ? !target : !(value === null || value === false || (value === true && kind !== 'claim' && kind !== 'match')))
    ) {
      return id
        ? `there is no ${kind === 'claim' ? 'farm' : 'pawn'} ${value}`
        : `${kind} cannot be wished ${JSON.stringify(value)}`;
    }
    if (kind === 'match' && id && (target.sex === st.pawns[pl.pawn].sex || !target.alive))
      return `${value} is not one the pawn may marry`;
    return setWish(st, pl.pawn, kind, value);
  }
  // A wish for a match ends when the one who wished or the wished partner marries (a and b have married) or dies (a is b).
  const clearMatchWish = (st, a, b) => endPartner(st, a, b);
  // Each six-minute step (sim/clock), before the agents move: a begun head whose act has ended leaves the queue, and the next command is
  // issued; one refused then is dropped, its reason kept in `refused`. A load being carried home is delivered first, as at the end of work.
  // Whether a begun act lasts is its verb's to say, from the reference it gave (sim/commands active); an act done at once lasts no longer
  // than the step it was issued in. A command is begun once, and never issued again: a loaded save resumes it from its reference.
  function playerStep(st) {
    const pl = st.player;
    if (pl) sleepStep(st);
    if (pl && pl.plan && !pl.auto && !living(st, pl.pawn)) feed(st, pl);
    if (!pl || !pl.queue.length) return;
    const a = st.agents[pl.pawn],
      q = pl.queue;
    if (q[0].begun !== null) {
      const ref = q[0].ref === undefined ? null : q[0].ref; // a command begun before VB-1405 kept none
      if ((ref !== null || q[0].ref === undefined) && !living(st, pl.pawn) && active(st, q[0], ref)) return;
      q.shift();
    }
    while (q.length) {
      if (a.phase === 'back') return;
      // told to walk, go home or idle, the pawn leaves the job in hand, which keeps its progress (work leaves it itself): only if it may
      const cmd = q[0],
        V = VERBS[cmd.verb],
        leaves = !!a.job && !!V && !!V.frees,
        barred = leaves ? V.check(st, cmd) : null;
      if (leaves && !barred) release(st, a);
      const out = barred ? { status: 'refused', why: barred } : perform(st, cmd);
      if (out.status !== 'refused') {
        cmd.begun = st.t;
        cmd.ref = out.status === 'pending' ? out.ref : null;
        if (cmd.plan) planBegun(st, cmd.plan);
        return;
      }
      q.shift();
      pl.refused = { verb: cmd.verb, why: out.why, t: st.t };
    }
    if (!living(st, pl.pawn)) homeAtDark(st, pl);
  }
  // ---- the plan's feeder (VB-1618; sim/playerplan): with automatic behaviour off, the plan feeds the queue when nothing queued by hand
  // waits. A command queued by hand goes first, as an order for now: the plan's commands give way to it (a task left keeps its progress
  // and stays planned). In the sleeping hours the plan's work in hand is left for its sleep; else the plan's command runs to its end.
  // A trip of the move under way (the farmstead chain's droving and fetching from the landing, sim/planchains MOVE_KINDS) is not left
  // for the sleeping hours: it goes on to its end, and the pawn sleeps after (VB-1642: on a way of 7 hours each way, the walk out left at
  // bedtime every evening had the move undone for 50 days, and the frost took the loads).
  const onTrip = (st, pl, c) =>
    c.begun !== null && c.plan.from === 'task' && MOVE_KINDS.includes(c.plan.kind) && !!st.agents[pl.pawn].job;
  function feed(st, pl) {
    const q = pl.queue;
    if (q.some((c) => !c.plan)) {
      for (let i = q.length - 1; i >= 0; i--) if (q[i].plan) q.splice(i, 1);
      return;
    }
    if (q.length && q[0].begun !== null && !active(st, q[0], q[0].ref)) q.length = 0; // its act ended: the next is fed at once
    planDay(st);
    const next = nextOf(st);
    if (q.length) {
      if (!(next && next.plan.from === 'sleep' && q[0].plan.from !== 'sleep') || onTrip(st, pl, q[0])) return;
      q.length = 0;
    }
    if (next) q.push({ ...next, begun: null, ref: null });
  }
  // ---- sleep (VB-1615; sim/sleep): the hours the played pawn owes, and the verb `sleep` ----
  // Asleep: under the verb `sleep`, once it stands where it sleeps; or indoors where it sleeps (its house, its booth, or its bed under the
  // open sky before the booth stands, VB-1544; away, its stay's bed) with no act in hand.
  function sleeping(st, pl, a) {
    const c = pl.queue[0];
    if (c && c.verb === 'sleep' && c.begun !== null && c.ref && st.t < c.ref.until) return !a.path;
    if (!a.inside || a.job || a.path || a.phase !== null || a.occasion !== null) return false;
    if (st.pawns[pl.pawn].household === null && a.away === undefined) return false;
    return here(st, a) === bed(st, a);
  }
  // Each step, for the step gone by: an hour awake owes AWAKE, an hour asleep pays one, within 0 and SLEEP.cap. Not for a dead pawn.
  function sleepStep(st) {
    const pl = st.player;
    if (living(st, pl.pawn)) return;
    if (!pl.sleep) pl.sleep = { owed: 0, asleep: false, at: st.tick - 1 }; // a save made before VB-1615
    if (pl.sleep.at === st.tick) return;
    pl.sleep.at = st.tick;
    pl.sleep.asleep = sleeping(st, pl, st.agents[pl.pawn]);
    pl.sleep.owed = Math.min(SLEEP.cap, Math.max(0, pl.sleep.owed + (pl.sleep.asleep ? -1 : AWAKE) / TICKS));
  }
  // The game time a sleep begun now ends: args.hours from now, or the next args.until o'clock (by default the start of work).
  function sleepUntil(st, args) {
    if (args && args.hours !== undefined) return st.t + args.hours;
    const h = args && args.until !== undefined ? args.until : WORK[0];
    let u = Math.floor(st.t / DAY) * DAY + h;
    if (u <= st.t) u += DAY;
    return u;
  }
  // sleep({until | hours}): the pawn leaves the job in hand (which keeps its progress), goes to where it sleeps and sleeps until the hour
  // args.until of the day (by default the start of work), or for args.hours; the act lasts until then. The player's only: no pawn's own
  // logic sleeps by it yet. Refused for the dead, the travelling, one with no place to sleep, or an hour that is none.
  register('sleep', {
    sources: ['player'],
    check: (st, c) => {
      const why = free(st, c.actor);
      if (why) return why;
      if (st.pawns[c.actor].household === null && st.agents[c.actor].away === undefined)
        return `pawn ${c.actor} has no place to sleep`;
      const g = c.args || {};
      if (g.hours !== undefined && !(g.hours > 0 && g.hours <= SLEEP.cap)) return `cannot sleep ${g.hours} hours`;
      if (g.hours === undefined && g.until !== undefined && !(g.until >= 0 && g.until < 24))
        return `there is no hour ${g.until} to sleep until`;
      return null;
    },
    run: (st, c) => {
      const a = st.agents[c.actor],
        until = sleepUntil(st, c.args);
      if (a.job) release(st, a);
      if (!(a.inside && !a.path && here(st, a) === bed(st, a))) goHome(st, a);
      idle(st, a, until);
      return { until };
    },
    active: (st, c, ref) => st.t < ref.until,
    frees: true,
  });
  // ---- what the played pawn's acts brought, and what moved its levels (VB-1118) ----
  // A task finished or a load brought home by the played pawn (sim/agents): the last one is kept for its sheet.
  on('yielded', (st, d) => {
    const pl = st.player;
    if (!pl || pl.pawn !== d.pawn) return;
    pl.last = { kind: d.kind, farm: d.farm, good: d.good, n: d.n, t: st.t };
  });
  // The played pawn's meal (sim/hunger): its health and what moved it, its hunger and its household's food, for its last DAYS_KEPT days.
  on('health', (st, d) => {
    const pl = st.player;
    if (!pl || pl.pawn !== d.pawn) return;
    const household = st.pawns[d.pawn].household;
    const food = household === null ? null : daysOfFood(st, st.households[household]);
    if (!pl.days) pl.days = []; // a save made before VB-1118
    pl.days.push({
      t: st.t,
      health: d.after,
      before: d.before,
      hunger: d.hungerLevel,
      food: Number.isFinite(food) ? food : null,
      why: { hunger: d.hunger, cold: d.cold, damp: d.damp, ill: d.ill, tired: d.tired, rest: d.rest },
    });
    if (pl.days.length > DAYS_KEPT) pl.days.shift();
  });
  const round1 = (x) => Math.round(x * 10) / 10;
  // What the played pawn's last act yielded, in words for its sheet (null with none): "Fishing: 6.2 rations of fish brought home", or the
  // task's name done, with the farm where it was done.
  function yieldWords(st) {
    const pl = st.player,
      L = pl && pl.last;
    if (!L) return null;
    const K = KINDS[L.kind] || {},
      what = K.label || K.name || L.kind,
      at = L.farm !== null && st.farmsteads[L.farm] ? ` at ${st.farmsteads[L.farm].name}` : '';
    if (L.good && L.n > 0) return `${what}: brought home ${round1(L.n)} of ${L.good}${at}.`;
    return `${what}: done${at}.`;
  }
  // What moved the played pawn's levels over its last days, in words for its sheet: health, hunger and the household's food, each with
  // its change and, for health, the causes that moved it most (hunger, cold, damp, illness; a full meal on a warm day restores). [] with
  // fewer than two days kept, or nothing moved.
  const CAUSE_WORDS = {
    hunger: 'hunger',
    cold: 'a cold house',
    damp: 'a damp house',
    ill: 'illness',
    tired: 'lack of sleep',
    rest: 'rest and full meals',
  };
  function movedWords(st) {
    const pl = st.player,
      D = (pl && pl.days) || [];
    if (!D.length) return [];
    const first = D[0],
      last = D[D.length - 1],
      out = [],
      n = D.length,
      days = n === 1 ? 'today' : `over ${n} days`;
    const dh = last.health - first.before;
    if (Math.abs(dh) >= 0.5) {
      const sum = { hunger: 0, cold: 0, damp: 0, ill: 0, tired: 0, rest: 0 };
      for (const d of D) for (const k in sum) sum[k] += d.why[k] || 0; // tired absent in a day kept before VB-1615
      const causes = Object.keys(sum)
        .filter((k) => sum[k] >= 0.5 && (dh < 0 ? k !== 'rest' : k === 'rest'))
        .sort((x, y) => sum[y] - sum[x])
        .map((k) => `${CAUSE_WORDS[k]} (${dh < 0 ? '-' : '+'}${Math.round(sum[k])})`);
      out.push(
        `Health ${dh < 0 ? 'fell' : 'rose'} ${Math.round(Math.abs(dh))} ${days}${causes.length ? `: ${causes.join(', ')}` : ''}.`,
      );
    }
    if (n > 1 && Math.abs(last.hunger - first.hunger) >= 0.05)
      out.push(
        `Hunger ${last.hunger > first.hunger ? 'rose' : 'eased'} ${days}: the meals ${last.hunger > first.hunger ? 'fell short' : 'were full'}.`,
      );
    if (n > 1 && first.food !== null && last.food !== null && Math.abs(last.food - first.food) >= 1) {
      const up = last.food > first.food,
        brought = pl.last && pl.last.t >= first.t && pl.last.good && pl.last.n > 0;
      out.push(
        `The household's food ${up ? 'rose' : 'fell'} from ${Math.round(first.food)} to ${Math.round(last.food)} days ${days}` +
          `${up ? (brought ? ': what was brought in' : ': food brought in') : ': eaten faster than brought in'}.`,
      );
    }
    return out;
  }
  // Who of the played pawn's household ails, as its kin see it (principle 14: what they see, not what will come): "Gunnar is ailing", and
  // "is gravely ill" once health has fallen under HEALTH's risk line. The played pawn itself is "You are ailing".
  function ailingWords(st) {
    const pl = st.player;
    if (!pl) return [];
    const p = st.pawns[pl.pawn],
      hh = p.household !== null ? st.households[p.household] : null,
      ids = hh ? hh.members : [pl.pawn],
      out = [];
    for (const id of ids) {
      const q = st.pawns[id];
      if (!q.alive || q.ill === undefined) continue;
      const grave = q.health < HEALTH.riskBelow;
      out.push(
        id === pl.pawn
          ? `You are ${grave ? 'gravely ill' : 'ailing'}.`
          : `${q.given} is ${grave ? 'gravely ill' : 'ailing'}.`,
      );
    }
    return out;
  }
  // The notes of the played pawn's sheet (VB-1118), made when asked: what its last act yielded, what moved its levels, who ails.
  const sheetNotes = (st) => ({ yielded: yieldWords(st), moved: movedWords(st), ailing: ailingWords(st) });
  // The played pawn answers the open marriage offer offerId (VB-293; the first question asked through Decisions.answer, which slice 5's
  // Decisions module takes over): true, or why not.
  function answer(st, offerId, yes) {
    if (!st.player) return 'no pawn is played';
    return issue(st, { actor: st.player.pawn, verb: 'answer', target: offerId, args: { yes }, source: 'player' });
  }
  // The played pawn chooses as head of its household (VB-253, for the page's plan panel, VB-256): verb one of HEAD_VERBS, at once, not
  // queued (a choice of the plan takes no time); its target the household it holds, else the one it lives in, so a pawn that is not the
  // head is refused with the reason. True, or why not.
  const HEAD_VERBS = ['target', 'tile', 'order', 'project', 'dropProject', 'rotation', 'sowOutOfTurn'];
  function head(st, verb, args) {
    const pl = st.player;
    if (!pl) return 'no pawn is played';
    if (!HEAD_VERBS.includes(verb)) return `${verb} is not a choice of the plan`;
    const held = holdingOf(st, pl.pawn),
      target = held && !held.dissolved ? held.id : st.pawns[pl.pawn].household;
    return issue(st, { actor: pl.pawn, verb, target, args: args || {}, source: 'player' });
  }
  return {
    head,
    QUEUE_MAX,
    inhabit,
    uninhabit,
    queue,
    unqueue,
    setAuto,
    wish,
    clearMatchWish,
    answer,
    playerStep,
    playerDied,
    goOnAs,
    TIES_MAX,
    sheetNotes,
    DAYS_KEPT,
  };
})();
