// @sys sim/pastimes: own time (VB-1552; design.md, Work, Own time; target-v2, section 4.5): the table of pastimes (who may choose each,
//   where it is spent, with whom, what weighs for it, its words for the card), the choice of a pawn the planner found no task (ownTime),
//   the verb `pastime`, which the played pawn has too, and the pawn's pastime (agent.pastime). A pastime is a walk and a wait: it reads
//   no plan, no store and no mood, makes and uses no good, and has only the effects of the encounter it puts the pawn in (sim/encounters)
VB['sim/pastimes'] = (() => {
  const { unbound } = VB['sim/pose'];
  const { next: rnd } = VB['sim/rng'];
  const { DAY, AGES, cal } = VB['sim/rules'],
    { CHILD } = VB['sim/roles'];
  const { act } = VB['sim/traits'],
    { tieOf } = VB['sim/ties'];
  const { living, age, settlementIdOf, siblingsOf, childrenOf, fullName } = VB['sim/records'];
  const { tileAt, placeOf, travelling } = VB['sim/pose'];
  const { atHome, callerRule } = VB['sim/encounters'];
  const { companyFor, opinionOf } = VB['sim/relations'];
  const { issue, register } = VB['sim/commands'];
  // @tunable IDLE: how long an idle pawn waits before it looks for work again
  // An idle pawn the planner found no work looks again after wait[0] to wait[1] hours (VB-245; Kim, 10 Nov: 2 to 4, from 0.75 to 2). It hears of new
  // work meanwhile through the hourly refresh, looks again when its wait ends (a leg in sim/agents' queue, VB-473), and of an occasion by the asking.
  // The wait is its pastime's length (VB-1552).
  const IDLE = { wait: [4, 8] };
  // @tunable PASTIME: what weighs for each pastime in a pawn's own time
  // weights: of the pastimes the draw is among (a visit, the green, the fire, play); a visit's times the pawn's sociability (0.5 to 1.5,
  // the trait's `seek`) and, as the green's, 1 / (1 + the walk / `walk` map units); the fire's times `winter` in winter, `old` from
  // `oldFrom` years and `weak` under `weakUnder` health. play: the ages that play. visit: from this age. yard: one out of doors within this
  // many map units of its house is at home for a caller. callers: at most this many are weighed for a visit, and listed for the played pawn.
  const PASTIME = {
    weights: { visit: 2, green: 1, fire: 1, play: 2 },
    winter: 3,
    old: 2,
    oldFrom: AGES.hands[1],
    weak: 2,
    weakUnder: 50,
    play: [CHILD.from, AGES.hands[0]],
    visit: AGES.hands[0],
    walk: 400,
    yard: 60,
    callers: 6,
  };
  const WINTER = 3; // cal(t).season

  const farmOf = (st, p) => (p.household === null ? null : st.farmsteads[st.households[p.household].farmstead]);
  const villageOf = (st, p) => {
    const f = farmOf(st, p);
    return f && f.village !== null && f.village !== undefined ? st.villages[f.village] : null;
  };
  const given = (st, id) => st.pawns[id].given;
  // Free out of doors, as sim/relations' company reads it: whom a pawn may join.
  const idles = (st, b) => !b.inside && !b.job && unbound(b) && st.pawns[b.id].alive;
  // At home for a caller: in its own house, or standing out of doors within PASTIME.yard of it; not one away or on the road.
  function atFarm(st, id) {
    const b = st.agents[id],
      f = farmOf(st, st.pawns[id]);
    if (!f || travelling(b) || b.away !== undefined) return false;
    if (b.inside) return atHome(st, b);
    return !b.path && Math.hypot(b.x - st.w.hx[f.house], b.y - st.w.hy[f.house]) <= PASTIME.yard;
  }
  const walkOf = (st, a, tile) => 1 / (1 + Math.hypot(a.x - st.w.hx[tile], a.y - st.w.hy[tile]) / PASTIME.walk);
  // Whether q is one p might call on: a parent, a child, a sibling, or a close friend (pawn.bands, sim/relations: the friends a pawn
  // keeps a list of; a friend below that line would be found only by a pass over all it knows).
  const near = (st, p, q) =>
    p.father === q.id ||
    p.mother === q.id ||
    q.father === p.id ||
    q.mother === p.id ||
    (p.father !== null && p.father === q.father) ||
    (p.mother !== null && p.mother === q.mother) ||
    (!!p.bands && p.bands.get(q.id) === 1);
  // Why pawn p may not call on pawn id now, or null: near kin or a close friend, at home on another farm of p's village.
  function callWhy(st, p, id) {
    const q = st.pawns[id];
    if (!q || !q.alive || id === p.id) return `there is no one ${id} to visit`;
    const f = farmOf(st, p),
      g = farmOf(st, q);
    if (!near(st, p, q)) return `${fullName(q)} is neither near kin nor a close friend`;
    if (!f || !g || g === f) return `${fullName(q)} lives on the same farm`;
    if (g.village !== f.village || villageOf(st, p) === null) return `${fullName(q)} lives in another village`;
    return atFarm(st, id) ? null : `${fullName(q)} is not at home`;
  }
  // Those pawn p might call on now, into `out` (at most PASTIME.callers): its parents, children and siblings, then its close friends.
  function callers(st, p, out) {
    out.length = 0;
    const add = (id) => {
      if (id === null || out.length >= PASTIME.callers || out.includes(id)) return;
      VB.count.visitWeighed++;
      if (callWhy(st, p, id) === null) out.push(id);
    };
    add(p.father);
    add(p.mother);
    for (const id of childrenOf(st, p.id)) add(id);
    for (const id of siblingsOf(st, p.id)) add(id);
    if (p.bands) for (const [id, band] of p.bands) if (band === 1) add(id);
    return out;
  }
  // Whether pawn p has anyone it might call on in its village, at home or not (sim/voice: a reason to ask leave for a visit): its parents,
  // children and siblings, then its close friends, living on another farm of its village; the first such, or null.
  function someoneToVisit(st, p) {
    const f = farmOf(st, p);
    if (!f || villageOf(st, p) === null) return null;
    const there = (id) => {
      if (id === null || id === undefined) return false;
      const q = st.pawns[id],
        g = q && q.alive ? farmOf(st, q) : null;
      return !!g && g !== f && g.village === f.village;
    };
    if (there(p.father)) return p.father;
    if (there(p.mother)) return p.mother;
    for (const id of childrenOf(st, p.id)) if (there(id)) return id;
    for (const id of siblingsOf(st, p.id)) if (there(id)) return id;
    if (p.bands) for (const [id, band] of p.bands) if (band === 1 && there(id)) return id;
    return null;
  }
  // How much p would be with q: liking (never one it dislikes) and familiarity, as company weighs it.
  const liking = (st, p, id) => Math.max(0, 0.05 + opinionOf(st, p.id, id)) * (1 + Math.min(tieOf(st, p.id, id), 1));

  // ---- the table (design.md, Own time). Each pastime: name, the played pawn's word for it; who(st, a, p), why this pawn may not choose
  // it, or null; weight(st, a, p, c), what weighs for it in the draw (absent: it is not drawn, see ownTime); partner, when it is spent with
  // one pawn named: withWhy(st, a, p, id), why not with that one, or null; at(st, a, p, id), where it is spent: {home: true} (indoors at
  // home) or {tile, x, y, spread: [x, y] (the pawn stands within it), farm (the farm called at), errand (a walk no talk breaks off)}, or
  // why there is no such place; words(st, a, r), what the card says of pawn a at pastime r (null: the card says what it said). ----
  const spot = (st, tile, spread, dy = 6) => ({ tile, x: st.w.hx[tile], y: st.w.hy[tile] + dy, spread });
  const PASTIMES = {
    // by the herd, for one who holds it at the side (VB-136): it waits within reach of the pasture; always, where it is open
    herd: {
      name: 'Stay by the herd',
      who: (st, a) => (a.mind && a.mind.some((c) => c.kind === 'herd') ? null : 'it minds no herd'),
      at: (st, a) => spot(st, a.mind.find((c) => c.kind === 'herd').site, [16, 8], 0),
      words: () => null,
    },
    // company: join one it likes who is also free out of doors in its village (sim/relations companyFor, as built: at SOCIAL.seek by
    // its sociability, tried before the draw)
    company: {
      name: 'Keep company',
      who: (st, a, p) => (age(st, p) >= PASTIME.play[1] ? null : 'children play'),
      partner: true,
      withWhy(st, a, p, id) {
        const b = st.agents[id];
        if (!b || id === a.id || !idles(st, b)) return `pawn ${id} is not free out of doors`;
        const v = settlementIdOf(st, p);
        return v !== null && settlementIdOf(st, st.pawns[id]) === v ? null : `pawn ${id} is not of its village`;
      },
      at(st, a, p, id) {
        const [x, y] = placeOf(st, st.agents[id]); // where it is now, a walker along its leg (VB-473)
        return { tile: tileAt(st, x, y), x, y, spread: [16, 8] };
      },
      words: (st, a, r) => (a.path ? `Walking over to ${given(st, r.with)}` : `Keeping ${given(st, r.with)} company`),
    },
    // a visit: walk to the farm of near kin or a close friend in its village and sit with those at home there
    visit: {
      name: 'Visit',
      who: (st, a, p) =>
        age(st, p) < PASTIME.visit
          ? 'it is too young to go visiting'
          : villageOf(st, p) === null
            ? 'it has no village'
            : null,
      partner: true,
      withWhy: (st, a, p, id) => callWhy(st, p, id),
      weight: (st, a, p, c, list) =>
        list.length
          ? PASTIME.weights.visit *
            act(st, a.id, 'sociability', 'seek') *
            walkOf(st, a, farmOf(st, st.pawns[list[0]]).house)
          : 0,
      at(st, a, p, id) {
        const g = farmOf(st, st.pawns[id]);
        return { ...spot(st, g.house, [12, 6]), farm: g.id, errand: true };
      },
      words: (st, a, r) =>
        `${a.path ? 'Walking to visit' : 'Visiting'} ${given(st, r.with)} at ${st.farmsteads[r.farm].name}`,
    },
    // the green, where the village has one
    green: {
      name: 'Go to the green',
      who: (st, a, p) =>
        age(st, p) < PASTIME.play[1]
          ? 'children play'
          : (villageOf(st, p) || {}).green
            ? null
            : 'its village has no green',
      weight: (st, a, p) => PASTIME.weights.green * walkOf(st, a, villageOf(st, p).center),
      at: (st, a, p) => spot(st, villageOf(st, p).center, [26, 12]),
      words: (st, a) => (a.path ? 'Strolling to the green' : 'On the green'),
    },
    // the fire: at home with its housemates; more in winter, and for the old and the weak. In winter, and for the old and the weak in
    // any season, it is indoors by the fire; else it is the bench by the door, out in the yard, where the yard's stroll was: a village
    // keeps its life out of doors in the light seasons
    fire: {
      name: 'Sit at home',
      who: (st, a, p) => (farmOf(st, p) && a.away === undefined ? null : 'it is not at home here'),
      weight: (st, a, p, c) =>
        PASTIME.weights.fire *
        (c.season === WINTER ? PASTIME.winter : 1) *
        (age(st, p) >= PASTIME.oldFrom ? PASTIME.old : 1) *
        (p.health < PASTIME.weakUnder ? PASTIME.weak : 1),
      at: (st, a, p) =>
        cal(st.t).season === WINTER || age(st, p) >= PASTIME.oldFrom || p.health < PASTIME.weakUnder
          ? { home: true }
          : { ...spot(st, farmOf(st, p).house, [26, 12]), farm: farmOf(st, p).id },
      words: (st, a, r) =>
        r.farm === null
          ? a.inside && !a.path
            ? 'By the fire'
            : 'Going home to the fire'
          : a.path
            ? 'Strolling home'
            : 'Sitting in the yard',
    },
    // play: children of 7 to 13 with the village's other children, on the green or, where there is none, in their yard
    play: {
      name: 'Go and play',
      who: (st, a, p) => {
        const y = age(st, p);
        return y >= PASTIME.play[0] && y < PASTIME.play[1] && farmOf(st, p) ? null : 'it is not of an age to play';
      },
      weight: () => PASTIME.weights.play,
      at(st, a, p) {
        const v = villageOf(st, p);
        return v && v.green
          ? spot(st, v.center, [26, 12])
          : { ...spot(st, farmOf(st, p).house, [26, 12]), farm: farmOf(st, p).id };
      },
      words: (st, a, r) =>
        a.path ? 'Running off to play' : r.farm === null ? 'Playing on the green' : 'Playing in the yard',
    },
  };
  const DRAWN = Object.keys(PASTIMES).filter((k) => PASTIMES[k].weight);

  // ---- the pawn's pastime ----
  // @state agent.pastime: {kind (a key of PASTIMES), with (the pawn it is spent with, or null), farm (the farm it is spent at, or null),
  //   at, until (game hours)} or absent: the latest pastime it chose. It is the pawn's pastime only while `of` says so: nothing clears
  //   it, as nothing clears the latest talk. Written only by the verb `pastime`; plain data, saved.
  // @state pawn.sat: absent, or the game day the pawn last went visiting or was visited (the pastime `visit`; VB-1555). Written only
  //   by the verb `pastime`.
  // The pastime pawn id is at now, or null: its wait still runs (the head's call and a talk's end move agent.idleUntil), it has no task
  // in hand, it is at no occasion and on no road, and the day is the one it was chosen on (the night ends it).
  function of(st, id) {
    const a = st.agents[id],
      r = a && a.pastime;
    if (!r || a.job || a.occasion !== null || travelling(a)) return null;
    if (!(a.idleUntil > st.t && st.t < r.until) || Math.floor(st.t / DAY) !== Math.floor(r.at / DAY)) return null;
    if (!unbound(a) && !(!!a.homeward && r.kind === 'fire')) return null;
    return st.pawns[id].alive ? r : null;
  }
  // A caller sits with those indoors (VB-1559): one at the pastime `visit`, arrived (its walk over, within PASTIME.yard of the house it
  // calls at), is present at the house encounter of the household it called on (sim/encounters). The cheap tests first: the talk hour's
  // pass asks it of each pawn out of doors.
  callerRule((st, a) => {
    const r = a.pastime;
    if (!r || r.kind !== 'visit' || a.path || r.with === null || of(st, a.id) !== r) return null;
    const q = st.pawns[r.with],
      hh = q.household === null ? null : st.households[q.household];
    if (!hh || hh.farmstead !== r.farm) return null;
    const h = st.farmsteads[r.farm].house;
    return Math.hypot(a.x - st.w.hx[h], a.y - st.w.hy[h]) <= PASTIME.yard ? hh.id : null;
  });
  // What the card says of a pawn at a pastime, and with whom ("Visiting Karin at Norrgård"), or null.
  function line(st, id) {
    const r = of(st, id);
    return r ? PASTIMES[r.kind].words(st, st.agents[id], r) : null;
  }
  // Why pawn id may not spend its time at pastime `kind` now (args {with, until}), or null: what holds for any pawn, the planner's
  // choice and the played pawn's alike. Free: living, on no road, away at no bed and at no occasion.
  function why(st, id, kind, args) {
    const no = living(st, id);
    if (no) return no;
    const a = st.agents[id],
      p = st.pawns[id],
      P = Object.hasOwn(PASTIMES, kind) ? PASTIMES[kind] : null;
    if (!P) return `there is no pastime ${kind}`;
    if (travelling(a)) return `pawn ${id} is on the road`;
    if (a.occasion !== null) return `pawn ${id} is at an occasion`;
    if (args && args.until !== undefined && !(args.until >= st.t))
      return `a pastime until ${args.until}, which is past`;
    const w = args && args.with !== undefined ? args.with : null;
    return (
      P.who(st, a, p) ||
      (P.partner ? (w === null ? `${kind} is spent with someone` : P.withWhy(st, a, p, w)) : null) ||
      (typeof P.at(st, a, p, w) === 'string' ? P.at(st, a, p, w) : null)
    );
  }
  // The wait, drawn on the stream `work` as the idle wait was (the choice, the one called on and the spot are drawn on `talk`):
  // IDLE.wait times 4/3 to 2/3 by diligence (the design's 4 to 2 hours about its 3; TRAITS.acts.diligence.idleWait, VB-520)
  const waitOf = (st, id) =>
    (IDLE.wait[0] + rnd(st.rng.work) * (IDLE.wait[1] - IDLE.wait[0])) * act(st, id, 'diligence', 'idleWait');
  // The pastime begins: the walk there (none for one at home already, who sits by its fire), and the wait.
  function begin(st, c) {
    const a = st.agents[c.actor],
      p = st.pawns[c.actor],
      P = PASTIMES[c.target],
      w = c.args && c.args.with !== undefined ? c.args.with : null,
      to = P.at(st, a, p, w),
      until = c.args && c.args.until !== undefined ? c.args.until : st.t + waitOf(st, a.id);
    if (to.home) {
      if (!atHome(st, a)) issue(st, { actor: a.id, verb: 'goHome', source: c.source });
    } else
      issue(st, {
        actor: a.id,
        verb: 'walkTo',
        target: to.tile,
        args: {
          x: to.x + (rnd(st.rng.talk) - 0.5) * to.spread[0],
          y: to.y + (rnd(st.rng.talk) - 0.5) * to.spread[1],
          near: !to.errand,
        },
        source: c.source,
      });
    issue(st, { actor: a.id, verb: 'idle', args: { until }, source: c.source });
    // a visit made or received (VB-1555: a member asks leave when it has not visited near kin or a close friend for VOICE.days)
    if (c.target === 'visit') p.sat = st.pawns[w].sat = Math.floor(st.t / DAY);
    a.pastime = {
      kind: c.target,
      with: P.partner ? w : null,
      farm: to.farm === undefined ? null : to.farm,
      at: st.t,
      until,
    };
    return { pastime: c.target, at: st.t };
  }
  // pastime(kind, {with, until}): spend the wait at the pastime; pending while it is the pawn's pastime
  register('pastime', {
    check: (st, c) => why(st, c.actor, c.target, c.args),
    run: begin,
    active: (st, c, ref) => {
      const r = of(st, c.actor);
      return !!r && r.kind === c.target && (!ref || r.at === ref.at);
    },
    frees: true,
  });

  // ---- the choice (it was sim/jobs' idleAbout): a pawn the planner found no task has the wait to itself. One who holds a herd at the
  // side stays by it; else it may join one it likes who is free (company, at its chance); else it draws among the pastimes open to it
  // by their weights, and whom it calls on by its liking, on the stream `talk`. One with nothing open waits where it is. ----
  const list = [],
    wts = [];
  function ownTime(st, a) {
    VB.count.idleStroll++;
    const p = st.pawns[a.id];
    let kind = null,
      w = null;
    if (PASTIMES.herd.who(st, a, p) === null) kind = 'herd';
    else {
      const mate = st.cenv && PASTIMES.company.who(st, a, p) === null ? companyFor(st, a) : null;
      if (mate) [kind, w] = ['company', mate.id];
    }
    if (!kind) {
      const c = cal(st.t);
      let tot = 0;
      for (let k = 0; k < DRAWN.length; k++) {
        const P = PASTIMES[DRAWN[k]];
        if (P.who(st, a, p) !== null) wts[k] = 0;
        else if (!P.partner) wts[k] = P.weight(st, a, p, c);
        else wts[k] = st.cenv ? P.weight(st, a, p, c, callers(st, p, list)) : 0;
        tot += wts[k];
      }
      if (tot > 0) {
        let x = rnd(st.rng.talk) * tot,
          k = 0;
        while (k < DRAWN.length - 1 && (x -= wts[k]) > 0) k++;
        kind = DRAWN[k];
      }
      if (kind === 'visit') {
        let sum = 0;
        for (let i = 0; i < list.length; i++) sum += wts[i] = 0.01 + liking(st, p, list[i]);
        let x = rnd(st.rng.talk) * sum,
          i = 0;
        while (i < list.length - 1 && (x -= wts[i]) > 0) i++;
        w = list[i];
      }
    }
    const args = w === null ? null : { with: w };
    if (kind && issue(st, { actor: a.id, verb: 'pastime', target: kind, args, source: 'planner' }) === true) return;
    issue(st, { actor: a.id, verb: 'idle', args: { until: st.t + waitOf(st, a.id) }, source: 'planner' });
  }
  // The pastimes open to pawn id now, for the played pawn's Actions: [{kind, args ({with}, or null), name, note, why (null: it may)}],
  // a visit for each it might call on and company for those free out of doors it likes best. Reads only, and draws nothing.
  function options(st, id) {
    const a = st.agents[id],
      p = st.pawns[id],
      out = [];
    if (!a || !p.alive) return out;
    const v = settlementIdOf(st, p);
    for (const kind of Object.keys(PASTIMES)) {
      const P = PASTIMES[kind];
      if (P.who(st, a, p) !== null) continue;
      if (kind === 'visit')
        for (const q of callers(st, p, []))
          out.push({
            kind,
            args: { with: q },
            name: `Visit ${given(st, q)} at ${farmOf(st, st.pawns[q]).name}`,
            note: 'You walk there and sit a while with those at home',
            why: why(st, id, kind, { with: q }),
          });
      else if (kind === 'company') {
        const free = [];
        if (v !== null && st.cenv)
          for (const q of st.living)
            if (q !== id && idles(st, st.agents[q]) && settlementIdOf(st, st.pawns[q]) === v && liking(st, p, q) > 0)
              free.push(q);
        free.sort((x, y) => liking(st, p, y) - liking(st, p, x) || x - y);
        for (const q of free.slice(0, 3))
          out.push({
            kind,
            args: { with: q },
            name: `Join ${fullName(st.pawns[q])}`,
            note: 'Free out of doors, as you are',
            why: why(st, id, kind, { with: q }),
          });
      } else
        out.push({
          kind,
          args: null,
          name: P.name,
          note:
            kind === 'fire'
              ? 'With your housemates: by the fire in winter, else in the yard'
              : kind === 'herd'
                ? 'Within call of it'
                : 'And see who is there',
          why: why(st, id, kind, null),
        });
    }
    return out;
  }
  return { IDLE, PASTIME, PASTIMES, ownTime, of, line, why, options, someoneToVisit };
})();
