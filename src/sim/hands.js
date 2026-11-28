// @sys sim/hands: help asked for (VB-470; design.md section 7, Help between households): a head whose estimate says its field work will
//   not be done in its window with its own hands asks the heads of its village, nearest kin and best friends first, for hands and hours
//   today: an offer on the basis `help` (VB-690), "two hands for six hours". The head asked answers by kinship, its opinion of the asker
//   and its own day (the hours its allotment gave its members no task; sim/day plan.day.free), and may give fewer hours than asked. A
//   hand lent works the asker's field work on the basis `helper` (sim/eligibility) for its hours, walking there and home, and its tie with
//   each adult helped grows by the hours it gave (VB-106: a gift, nothing owed), and the hours' worth is booked as goodwill to its own
//   credit (sim/relations helped, VB-704).
// @state st.handsToday: absent until the first hand is lent or asked, then {day (game day), asked: [household ids whose head asked
//   today], by: {pawn id: [household helped, hours given, hours worked, 1 once its hours are given or it is sent home, 1 if hired (VB-319)]}}: today's lent
//   hands; a new day's first step closes yesterday's. Written only here.
VB['sim/hands'] = (() => {
  const { DAY, WORK, SEASON_DAYS, TICKS } = VB['sim/rules'],
    { MATCH, ROLES } = VB['sim/roles'];
  const HELP = MATCH.help;
  const { CROPS } = VB['sim/crops'];
  const { frostExpected } = VB['sim/weather'];
  const Offers = VB['sim/offers'];
  const { issue } = VB['sim/commands'];
  const { opinionOf, remember } = VB['sim/relations'];
  const { kinNear, villageOf, age, fullName, unplanned, log, atHousehold } = VB['sim/records'];
  const { emit } = VB['sim/events'];
  const { isOpen } = VB['sim/kinds'];
  const Days = VB['sim/days'];
  const Obligations = VB['sim/obligations'];
  const Stores = VB['sim/stores'];
  const { floorOf } = VB['sim/hunger'];
  // @tunable HANDS: help asked for (VB-470)
  // A head short of hands asks at most `asks` households a morning, for at most `most` hands, each for at least `least` hours of the
  // working day left; the played head asked answers within `wait` days (else its pawn's judgement answers for it).
  // Hired hands (VB-319): a head still short after its asks hires landless adults of its village at most `hires` a morning, for a wage of
  // `wage` rations for a day of `day` work hours (less for part of a day, in whole rations, rounded up), paid at the day's end.
  const HANDS = { asks: 3, most: 3, least: 2, wait: 0.125, hires: 2, wage: 3, day: 8 };
  const today = (st) => Math.floor(st.t / DAY);
  // The working hours left today, by the clock
  const hoursLeft = (st) => Math.max(0, WORK[1] - Math.max(WORK[0], st.t - today(st) * DAY));
  // A member's working hours of the head's horizon (sim/day dayHours)
  const horizon = () => MATCH.day.horizon * (WORK[1] - WORK[0]);
  const loans = (st) => {
    const d = st.handsToday;
    return d && d.day === today(st) ? d : null;
  };
  function todays(st) {
    let d = loans(st);
    if (!d) {
      if (st.handsToday) close(st);
      d = st.handsToday = { day: today(st), asked: [], by: {} };
    }
    return d;
  }
  // The household pawn id is lent to now, or null: one lookup, for the check of every task.
  function on(st, id) {
    const d = loans(st),
      e = d && d.by[id];
    return e && !e[3] ? e[0] : null;
  }
  // Whether the pawn id lent today is a hired hand (its entry's fifth place), not a gift
  function hired(st, id) {
    const d = loans(st),
      e = d && d.by[id];
    return !!(e && !e[3] && e[4]);
  }
  const holderOf = (st, id) => {
    const p = Number.isInteger(id) ? st.pawns[id] : null,
      hh = p && p.alive && p.household !== null ? st.households[p.household] : null;
    return hh && !hh.dissolved && hh.holder === id && hh.farmstead !== null ? hh : null;
  };
  // ---- the asker's window ----
  // The last day of the year (season * SEASON_DAYS + day) on which task j can be done, or null when it has none or it is past: the
  // sowing window of its field's crop for hoeing and sowing, the frost the head expects for reaping and carrying the sheaves
  // (sim/weather frostExpected: not this year's drawn day, which nobody knows ahead; VB-1175).
  function windowEnd(st, j, c) {
    const now = c.season * SEASON_DAYS + c.sday;
    let end = null;
    if ((j.kind === 'plow' || j.kind === 'sow') && j.field && CROPS[j.field.crop] && CROPS[j.field.crop].sow) {
      const W = CROPS[j.field.crop].sow;
      end = W[0] * SEASON_DAYS + W[2];
    } else if (j.kind === 'reap' || j.kind === 'haul') end = 2 * SEASON_DAYS + frostExpected(st);
    return end === null || end < now ? null : end;
  }
  // The working hours from now to the end of day `end` of the year
  const hoursTo = (st, c, end) => (end - (c.season * SEASON_DAYS + c.sday)) * (WORK[1] - WORK[0]) + hoursLeft(st);
  // The hours of help household hh lacks, as its head estimates (VB-476): its windowed tasks, in the order their windows close, against
  // the work the hands it has given them in this allotment do in a horizon, kept up to each window's end; the most it falls short by.
  // `tasks` is [[job, work left as the head sees it, work given in the horizon]], from the allotment (sim/day allot).
  function shortOf(st, tasks, c) {
    const rows = [];
    let supply = 0;
    for (const [j, left, given] of tasks) {
      if (!HELP.kinds.includes(j.kind)) continue;
      const end = windowEnd(st, j, c);
      if (end === null) continue;
      rows.push([end, left]);
      supply += given;
    }
    rows.sort((x, y) => x[0] - y[0]);
    let need = 0,
      short = 0;
    for (const [end, left] of rows) {
      need += left;
      short = Math.max(short, need - (supply * hoursTo(st, c, end)) / horizon());
    }
    return short;
  }
  // ---- the asked head's day ----
  // The members of household hh its head could lend now, with the hours each could give, most first: an adult not retired, at home,
  // not played, not on duty or lent today, of a role that does field work; its share of the allotted day given no task (plan.day.free,
  // of the horizon) of the working hours left today, in whole hours, at least HANDS.least.
  function spareOf(st, hh) {
    const plan = st.plans && st.plans.households.get(hh.id), // read as sim/plans planOf, which loads later
      day = plan && plan.day,
      d = loans(st),
      out = [];
    if (!day || !day.free || Math.floor(day.made / DAY) !== today(st)) return out;
    const left = hoursLeft(st);
    for (const id of hh.members) {
      const f = day.free[id],
        p = st.pawns[id];
      if (!(f > 0) || !p.alive || p.retired || age(st, p) < HELP.minAge || unplanned(st, id)) continue;
      if (!HELP.kinds.some((k) => (ROLES[p.role].prio[k] || 0) > 0)) continue; // not one for field work
      if (Days.on(st, id) !== null || (d && d.by[id]) || st.agents[id].away !== undefined) continue;
      const h = Math.floor((Math.min(f, horizon()) / horizon()) * left);
      if (h >= HANDS.least) out.push([id, h]);
    }
    return out.sort((x, y) => y[1] - x[1] || x[0] - y[0]);
  }
  // Is the head `by` willing to help pawn `asker`: as the round of help weighed it (VB-106), HELP.factor, + HELP.kin for near kin, + its
  // opinion of the asker, above nothing
  const willing = (st, by, asker) =>
    HELP.factor + (kinNear(st, by).includes(asker) ? HELP.kin : 0) + opinionOf(st, by, asker) > 0;
  // ---- the basis `help` ----
  const askWords = (st, o) => {
    const w = o.wants,
      n = w.hands === 1 ? 'a hand' : `${w.hands} hands`;
    return `an ask of ${n} for ${w.hours} hours by ${fullName(st.pawns[o.from])}`;
  };
  // Why the ask o may not be made, or its own fields: the asker and the asked are heads of two households of one village; the ask
  // wants 1 to HANDS.most hands for HANDS.least hours or more, today, within the working day; the asker's household has field work
  // open that help takes (MATCH.help.kinds).
  function check(st, o) {
    const A = holderOf(st, o.from),
      B = holderOf(st, o.to);
    if (!A) return 'only the head of a household with a farm asks for hands';
    if (!B || B === A) return 'hands are asked of the head of another household';
    if (villageOf(st, st.pawns[o.from]) !== villageOf(st, st.pawns[o.to])) return 'hands are asked within the village';
    const w = o.wants;
    if (!w || !Number.isInteger(w.hands) || w.hands < 1 || w.hands > HANDS.most)
      return `one asks for 1 to ${HANDS.most} hands`;
    if (!(Number.isFinite(w.hours) && w.hours >= HANDS.least)) return `one asks for ${HANDS.least} hours or more`;
    if (hoursLeft(st) < HANDS.least) return "the day's work is nearly over";
    if (o.due > st.t) return 'hands are asked for today';
    let open = false;
    for (const j of st.jobsBy.get(`household:${A.id}`) || [])
      if (HELP.kinds.includes(j.kind) && isOpen(st, j)) {
        open = true;
        break;
      }
    return open ? { day: today(st), household: A.id } : 'there is no field work to help with';
  }
  // A yes: the asked head lends the members it can spare, the most free first, each for the hours asked or what it can give
  function settle(st, o) {
    if (o.day !== today(st) || hoursLeft(st) < HANDS.least) return 'the day is over';
    const A = st.households[o.household],
      B = holderOf(st, o.to);
    if (A.dissolved || A.holder !== o.from || !B) return 'a head has changed';
    const spare = spareOf(st, B).slice(0, o.wants.hands);
    if (!spare.length) return `no one at ${st.farmsteads[B.farmstead].name} is free`;
    const d = todays(st);
    for (const [id, h] of spare) {
      d.by[id] = [A.id, Math.min(o.wants.hours, h, hoursLeft(st)), 0, 0];
      VB.count.handsLent++;
      emit(st, 'leftDay', { pawn: id }); // its tasks at home to the others (sim/day; VB-1758)
      // told at once (the ask's news, the hard rule's exemption): one idling stops, and looks for the work at the next step
      const g = st.agents[id];
      if (!g.job && !g.homeward && !g.journey && g.idleUntil > st.t)
        issue(st, { actor: id, verb: 'idle', args: { until: st.t }, source: 'planner' });
    }
    return true;
  }
  // A no: one asked who would not is remembered by both (VB-690); one who had no one to spare is not; told only where the player is one
  // of the two (an ask refused is everyday work, and the record is history's cost: docs/cost.md)
  function refused(st, o, no) {
    if (spareOf(st, st.households[st.pawns[no.by].household]).length) {
      remember(st, o.from, no.by, 'refusedUs');
      remember(st, no.by, o.from, 'refusedThem');
    }
    const me = st.player ? st.player.pawn : null;
    if (me !== null && (me === o.from || me === no.by))
      log(st, `${fullName(st.pawns[no.by])} refused ${askWords(st, o)}.`, {
        kind: 'offerRefused',
        pawn: no.by,
        other: o.from,
        ...atHousehold(st, st.households[o.household]),
      });
  }
  Offers.basis('help', {
    asked: 'hands', // by the verb ask (sim/offers): ask {basis: 'hands', wants: {hands, hours}}
    books: 'nothing',
    wait: () => HANDS.wait,
    check,
    answers: (st, o) => [{ key: 'head', by: o.to, yes: null }],
    weigh: (st, o) => willing(st, o.to, o.from) && spareOf(st, st.households[st.pawns[o.to].household]).length > 0,
    settle,
    refused,
    what: askWords,
  });
  // The hours lent to household id today
  const lentTo = (d, id) => Object.values(d.by).reduce((s, e) => s + (e[0] === id ? e[1] : 0), 0);
  // The head of household hh, short of `short` hours of help today (sim/day, at the morning's allotment), asks its village's heads,
  // its near kin first, then by its opinion of them, at most HANDS.asks of them, until the hours lent cover it; once a day. The played
  // head asks for itself, by the same verb, ask with the basis `hands` (VB-1756). A played head on automatic with nothing queued is
  // passed over no more than an unplayed one (VB-1743); with its automatic behaviour off (or a command queued) it asks only by the
  // `ask` its controller gives it, never here.
  function askFor(st, hh, short, c) {
    const h = hh.holder;
    if (h === null || unplanned(st, h) || hoursLeft(st) < HANDS.least) return;
    const d = todays(st);
    if (d.asked.includes(hh.id)) return;
    d.asked.push(hh.id);
    const v = st.villages[st.farmsteads[hh.farmstead].village],
      kin = kinNear(st, h),
      heads = [];
    for (const fid of v.farmsteads) {
      VB.count.handsWeighed++;
      const hid = st.farmsteads[fid].household,
        o = hid === null ? null : st.households[hid];
      if (!o || o === hh || o.dissolved || o.holder === null || !st.pawns[o.holder].alive) continue;
      heads.push([kin.includes(o.holder) ? 1 : 0, opinionOf(st, h, o.holder), o.holder]);
    }
    heads.sort((x, y) => y[0] - x[0] || y[1] - x[1] || x[2] - y[2]);
    const left = hoursLeft(st);
    let rest = short;
    for (let i = 0; i < heads.length && i < HANDS.asks && rest >= HANDS.least; i++) {
      const hands = Math.min(HANDS.most, Math.ceil(rest / left)),
        hours = Math.max(HANDS.least, Math.min(Math.floor(left), Math.ceil(rest / hands))),
        was = lentTo(d, hh.id);
      VB.count.handsAsked++;
      issue(st, {
        actor: h,
        verb: 'ask',
        target: heads[i][2],
        args: { basis: 'hands', wants: { hands, hours } },
        source: 'pawn',
      });
      rest -= lentTo(d, hh.id) - was;
    }
    if (rest >= HANDS.least) hire(st, hh, rest, d);
  }
  // The wage for h hours worked: HANDS.wage rations a day of HANDS.day hours, whole rations rounded up
  const wageFor = (h) => (h > 1e-9 ? Math.ceil((h * HANDS.wage) / HANDS.day - 1e-9) : 0);
  // The landless adults (st.demand: grown, with no farm in prospect) of household o's village that its head could hire now, with the
  // hours each can give (spareOf: its own day's free hours), most first.
  function hire(st, hh, rest, d) {
    // a household below its floor does not hire; nor one that could not pay the wages it asks
    if (Stores.grainOf(hh) < floorOf(st, hh) + wageFor(rest)) return;
    const demand = new Set(st.demand || []),
      v = st.farmsteads[hh.farmstead].village,
      left = hoursLeft(st),
      pool = [];
    for (const fid of st.villages[v].farmsteads) {
      const hid = st.farmsteads[fid].household,
        o = hid === null ? null : st.households[hid];
      if (!o || o === hh || o.dissolved) continue;
      VB.count.handsWeighed++;
      for (const [id, h] of spareOf(st, o)) if (demand.has(id) && o.holder !== id) pool.push([id, h]);
    }
    pool.sort((x, y) => y[1] - x[1] || x[0] - y[0]);
    for (let i = 0; i < pool.length && i < HANDS.hires && rest >= HANDS.least; i++) {
      const [id, h] = pool[i],
        hours = Math.min(h, Math.ceil(rest), Math.floor(left));
      if (hours < HANDS.least) continue;
      d.by[id] = [hh.id, hours, 0, 0, 1];
      VB.count.handsHired++;
      rest -= hours;
      emit(st, 'leftDay', { pawn: id });
      const g = st.agents[id];
      if (!g.job && !g.homeward && !g.journey && g.idleUntil > st.t)
        issue(st, { actor: id, verb: 'idle', args: { until: st.t }, source: 'planner' });
    }
  }
  // The wage of hired pawn id for the h hours it worked for household hh, an obligation of the kind `wage` due at the day's end, paid from
  // the household's grain above nothing it cannot spare (what is short stays owed, overdue like a loan), to the pawn's household if it has
  // a farm, else to the pawn
  function pay(st, id, hh, h) {
    const n = wageFor(h);
    if (!n) return;
    const p = st.pawns[id],
      oid = Obligations.create(st, {
        kind: 'wage',
        debtor: { kind: 'household', id: hh.id },
        creditor: { kind: 'pawn', id },
        owes: { rations: n },
        due: st.t,
        every: null,
        enforcer: { kind: 'village', id: st.farmsteads[hh.farmstead].village },
      });
    VB.count.wagesHired += n;
    const home = p.household !== null && !st.households[p.household].dissolved ? st.households[p.household] : null,
      give = Math.min(n, Math.max(0, Math.floor(Stores.grainOf(hh))));
    if (give > 0)
      Obligations.fulfil(
        st,
        oid,
        give,
        { kind: 'wage', pawn: id },
        { from: hh, to: home && home.farmstead !== null ? home : p, good: 'grain' },
      );
    VB.count.wagesPaidHired += give;
  }
  // The hours of help household hh plans to ask today, its season not fitting its labour budget (sim/levies fit, VB-1778: plan.fit's
  // help): of each short step whose window is open today, its hours spread over the window's days, but never more a day than the
  // step's hours left (its `left`, by the head's estimate at the latest review) spread over the window's days left: a step done asks no
  // more help. 0 where its season fits. Read by the morning's ask (sim/day allot) beside what the day's estimate finds short (shortOf).
  function plannedHelp(st, hh, c) {
    const plan = st.plans && st.plans.households.get(hh.id),
      F = plan && plan.fit;
    if (!F || F.at !== c.year * 4 + c.season || !F.help || !F.help.length || !plan.season) return 0;
    let h = 0;
    for (const [id, , from, until, hours] of F.help) {
      if (c.day < from || c.day > until) continue;
      const s = plan.season.find((x) => x.id === id),
        left = s && s.left ? s.left.mid : 0;
      if (left > 0) h += Math.min(hours / (until - from + 1), left / (until - c.day + 1));
    }
    return h;
  }
  // ---- the hands' day ----
  // Lent pawn id worked dt hours on a task of the household it helps (sim/work)
  function worked(st, id, dt) {
    const d = loans(st),
      e = d && d.by[id];
    if (e && !e[3]) e[2] += dt;
  }
  // The help of pawn id, entry e, ends: its tie with the adults helped grows by the hours it worked (sim/relations, VB-106)
  function ended(st, id, e) {
    e[3] = 1;
    if (e[4] && e[2] > 0 && st.pawns[id].alive && !st.households[e[0]].dissolved)
      pay(st, id, st.households[e[0]], e[2]);
    if (e[2] > 0 && st.pawns[id].alive && !st.households[e[0]].dissolved)
      emit(st, 'helped', { helpers: [id], household: e[0], farm: null, hours: e[2] });
  }
  // Lent pawn id has nothing of the household's it can take (sim/day dutyRound): it goes back to its own day
  function release(st, id) {
    const d = loans(st),
      e = d && d.by[id];
    if (e && !e[3]) ended(st, id, e);
  }
  // Yesterday's help closes
  function close(st) {
    const d = st.handsToday;
    for (const [id, e] of Object.entries(d.by)) if (!e[3]) ended(st, +id, e);
    delete st.handsToday;
  }
  // Each step: a day's help closes with the day; one who has given its hours, or whose working day is over, goes home.
  function step(st) {
    if (!loans(st)) {
      close(st);
      return;
    }
    const over = hoursLeft(st) <= 0;
    for (const [id, e] of Object.entries(st.handsToday.by)) {
      if (e[3]) continue;
      // the hours worked so far: those booked, and those of the block under way not yet reckoned (sim/work settles a block lazily)
      const a = st.agents[id],
        j = a.job,
        now = j && a.leg && a.leg.kind === 'work' && j.owner.id === e[0] && j.rate > 0 ? (st.tick - j.at) / TICKS : 0;
      if (!over && e[2] + now < e[1] - 1e-9) continue;
      if (a.load > 0) continue; // a load on the road is brought in first, as at the day's end (sim/clock)
      e[2] += now; // booked here: the reckoning its going home makes is not booked again (worked: once ended, no more)
      ended(st, +id, e);
      if (st.pawns[id].alive) issue(st, { actor: +id, verb: 'goHome', source: 'planner' });
    }
  }
  return { HANDS, on, hired, worked, release, step, askFor, shortOf, spareOf, windowEnd, plannedHelp };
})();
