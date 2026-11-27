// @sys sim/estimate: the head's estimate of a task (VB-476; design.md section 7, The estimate; docs/review-blocks.md, section 2): its hours by
//   the causes the estimating pawn's judgement reckons with, the others at their norm, leaned by the head's lean, with an honest range; read
//   by the head's day (sim/day allot) and told on the record when a window is missed and the truth lay outside the range
// Principle (principle "The future is someone's estimate"): what is shown of the future is some pawn's estimate. Nothing is stored here: the estimate is
// worked out when read, from the task, its hands and the head; the one thing drawn is the lean, plan.head.bias.hours (sim/seasonal).
VB['sim/estimate'] = (() => {
  const { atWork } = VB['sim/pose'];
  const { CROPS } = VB['sim/crops'],
    Targets = VB['sim/targets'];
  const { HUNGER, HEALTH, HERD, FIELDS, DAY, cal } = VB['sim/rules'],
    { workRate } = VB['sim/roles'];
  const { age, fullName, log, atFarm } = VB['sim/records'];
  const Skills = VB['sim/skills'],
    Traits = VB['sim/traits'];
  const { KINDS, goalSteps } = VB['sim/kinds'];
  const { says } = VB['sim/methods'];
  const Iron = VB['sim/ironwork'];
  const { doneOf, attentionOf, teamKind } = VB['sim/work'];
  const { hasTeam, winterNeed } = VB['sim/herds'];
  const { headSkill } = VB['sim/seasonal'];
  const { fieldKey } = VB['sim/fieldwork'];
  const { on } = VB['sim/events'];
  const Water = VB['sim/water'],
    { dayHours } = VB['sim/byre'];
  // @tunable ESTIMATE (VB-476; design.md section 7, The estimate; Kim, 15 Nov: the worker's skill moves the time taken, the head's the
  //   estimate; a poor head's range is honest and wide):
  //   reckons: the causes a judgement reckons with, in the order skill as head brings them in, each from the skill named: hunger and health
  //   (a hand's rate), then the crop's size (a reaping's or a threshing's hours), then each hand's skill at the type of work. Every judgement
  //   reckons with the walk, the hands' role and age, their crafts, the ox team and the norm.
  //   unseen: what a cause not reckoned with may make of the task's hours, [the share less, the share more]: a crop between a half and one and
  //   a half of a normal one (sim/fieldwork SIZE), a hand slowed by hunger and poor health (HUNGER.slow, HEALTH.slow; only slower), and skill's
  //   reach on the rate (sim/skills SKILL.rate).
  //   claims: the share of tasks the range claims to hold, for a poor head as for a good one; z, the half-width of that share in spreads.
  //   The range's spread either way is the root of the sum of each part's square over 3 (each part read as uniform within its reach): the
  //   mishaps no judgement foresees, the lean's reach (Traits.HEAD.bias × (1 - skill): the head does not know its own lean), and the
  //   parts of the causes not reckoned with.
  const ESTIMATE = Object.freeze({
    reckons: Object.freeze([
      Object.freeze(['health', 0.25]),
      Object.freeze(['size', 0.5]),
      Object.freeze(['skill', 0.75]),
    ]),
    unseen: Object.freeze({
      health: Object.freeze([0, 0.15]),
      size: Object.freeze([0.3, 0.3]),
      skill: Object.freeze([0.1, 0.1]),
    }),
    claims: 0.8,
    z: 1.28,
  });
  // The words a cause is told by, when it was not reckoned with (the record's line).
  const WORDS = Object.freeze({
    health: 'the hands’ hunger and health',
    size: 'the crop’s size',
    skill: 'the hands’ skill',
    lean: 'its own leaning',
    mishap: 'mishaps',
  });
  // What the mishaps no judgement foresees make of a task's hours, at a hand of middling skill: [less, more] (sim/skills).
  const MISHAP = (() => {
    const most = Skills.SKILL.mishap[0] + (Skills.SKILL.mishap[1] - Skills.SKILL.mishap[0]) * 0.5;
    return Object.freeze([1 - Skills.NORM, Skills.NORM / (1 - most) - 1]);
  })();
  // ---- whose judgement ----
  // The judgement of pawn id: its skill as head of the household it heads (sim/seasonal's headSkill, with its years as head), else its own
  // skill as it stands (Traits.skill, no years); the middle for no pawn (a household with no head). Its lean: the head's drawn bias on hours,
  // 1 for one that is not head.
  function judgement(st, id) {
    if (id === null || id === undefined) return { skill: 0.5, lean: 1 };
    const p = st.pawns[id],
      plan = p.household === null ? null : st.plans.households.get(p.household);
    if (plan && plan.head && plan.head.pawn === id)
      return { skill: headSkill(st, p.household), lean: plan.head.bias.hours ?? 1 };
    return { skill: Traits.skill(st, id, st.t), lean: 1 };
  }
  // The causes a judgement of skill s reckons with: {health, size, skill}, each true or false.
  function reckoned(s) {
    const out = {};
    for (const [k, from] of ESTIMATE.reckons) out[k] = s >= from;
    return out;
  }
  // ---- the parts ----
  const hoursOf = (j) => j.hours ?? KINDS[j.kind].hours ?? 0;
  // A task's hours for a normal crop: its kind's `norm` (sim/fieldwork: a reaping and a threshing go by the crop's size), else its hours.
  const normOf = (st, j) => (KINDS[j.kind].norm ? KINDS[j.kind].norm(st, j) : hoursOf(j));
  // The task's work left as the judgement r of lean l sees it, in hours of a hand at the norm, and the share of it seen done: its hours as
  // reckoned (the crop's size, or a normal crop's), times the lean, the centre moving to the truth as the work goes on in proportion to
  // the share done (progress so far is seen, and exact).
  function workLeft(st, j, r, l) {
    const done = doneOf(st, j),
      believed = (r.size ? hoursOf(j) : normOf(st, j)) * l,
      f = believed > 0 ? Math.min(1, done / believed) : 1,
      total = believed * (1 - f) + hoursOf(j) * f;
    return { work: Math.max(0, total - done), f };
  }
  // The rate a judgement r believes hand id works task j at, an hour: its role and age; its hunger and health, if reckoned; its skill at
  // the kind's type, if reckoned; and what every judgement knows (known).
  function rateBelieved(st, r, id, j, first) {
    const p = st.pawns[id];
    let rate = workRate(p.role, age(st, p));
    if (r.health) rate *= (1 - HUNGER.slow * p.hunger) * (1 - (HEALTH.slow * (100 - p.health)) / 100);
    if (r.skill) {
      const R = Skills.SKILL.rate;
      rate *= R[0] + (R[1] - R[0]) * Skills.skillOf(st, id, KINDS[j.kind].type);
    }
    return rate * known(st, id, j, first);
  }
  // What every judgement reckons with besides role and age: the hand's level at the kind's craft (its word is on an absolute scale, seen by
  // all; VB-360) and the ox team for the task's first hand at a team's work in a household with a team.
  function known(st, id, j, first) {
    const craft = KINDS[j.kind].craft;
    let k = craft ? Skills.craftRate(Skills.level(st, id, craft)) : 1;
    if (first && teamKind(j) && hasTeam(st, st.households[j.owner.id])) k *= HERD.team.rate;
    return k * Iron.rate(st, j); // the household knows its tools (VB-701)
  }
  // The truth the same way, at the mean mishap: the hand's rate (sim/work rateOf), its skill's mean pace, what is known.
  function rateTrue(st, id, j, first) {
    const p = st.pawns[id];
    let rate =
      workRate(p.role, age(st, p)) *
      (1 - HUNGER.slow * p.hunger) *
      (1 - (HEALTH.slow * (100 - p.health)) / 100) *
      Skills.paceOf(Skills.skillOf(st, id, KINDS[j.kind].type), 0.5); // the mean draw is the middle of the uniform one
    return rate * known(st, id, j, first);
  }
  // The range's reach either way, as shares of the centre, for judgement skill s and the causes r it reckons with, shrunk by the share seen f.
  function reach(s, r, f) {
    const lean = Traits.HEAD.bias * (1 - s);
    let dn = MISHAP[0] ** 2 + lean ** 2,
      up = MISHAP[1] ** 2 + lean ** 2;
    for (const k of Object.keys(ESTIMATE.unseen))
      if (!r[k]) {
        dn += ESTIMATE.unseen[k][0] ** 2;
        up += ESTIMATE.unseen[k][1] ** 2;
      }
    return [Math.min(0.95, ESTIMATE.z * Math.sqrt(dn / 3) * (1 - f)), ESTIMATE.z * Math.sqrt(up / 3) * (1 - f)];
  }
  const unseenOf = (r) => ESTIMATE.reckons.filter(([k]) => !r[k]).map(([k]) => k);
  // ---- read ----
  // Pawn id's estimate of task j (principle "The future is someone's estimate": whose estimate it is): the hours its work left takes with `hands`
  // (pawn ids; by default its hands at work, else id alone), {lo, mid, hi, unseen (the causes not reckoned with, in the order of
  // ESTIMATE.reckons), work (the work left, in hours of a hand at the norm)}. Nothing written.
  function estimate(st, id, j, hands) {
    const J = judgement(st, id),
      r = reckoned(J.skill),
      { work, f } = workLeft(st, j, r, J.lean);
    if (!hands) {
      hands = (j.claims || []).filter((h) => st.agents[h].job === j && atWork(st.agents[h]));
      if (!hands.length && id !== null && id !== undefined) hands = [id];
    }
    let rate = 0;
    hands.forEach((h, i) => (rate += rateBelieved(st, r, h, j, i === 0)));
    const mid = rate > 0 ? work / rate : Infinity,
      [dn, up] = reach(J.skill, r, f);
    return { lo: mid * (1 - dn), mid, hi: mid * (1 + up), unseen: unseenOf(r), work };
  }
  // Pawn id's estimate of a task at a tile tk ({kind, site, ...}, a goal's: sim/kinds GOALS) of household hid: the sum of its steps left
  // (goalSteps), each by the job posted or else a step of the kind's hours, a carrying by its loads; {lo, mid, hi}, or null where nothing of
  // the household's stands there; `from`, the hour the last of its steps not posted may begin (-Infinity: none). Nothing written.
  function goalEstimate(st, id, hid, tk, hands) {
    const s = goalSteps(st, hid, tk.kind, tk.site, tk);
    if (!s) return null;
    const on = s.where.fd ? { field: s.where.fd, farm: s.where.f } : null,
      out = { lo: 0, mid: 0, hi: 0, from: -Infinity };
    for (const x of s.steps) {
      if (!x.job && Number.isFinite(x.from)) out.from = Math.max(out.from, x.from);
      let e;
      if (x.trip) {
        const one = (x.trip.go + x.trip.lift + x.trip.back) * x.n;
        e = { lo: one, mid: one, hi: one };
      } else {
        const j = x.job || {
          key: `${x.kind}:goal`,
          kind: x.kind,
          hours: x.hours,
          done: 0,
          claims: [],
          owner: { type: 'household', id: hid },
          ...on,
        };
        e = estimate(st, id, j, hands || [id]);
        if (x.n !== 1) e = { lo: e.lo * x.n, mid: e.mid * x.n, hi: e.hi * x.n };
      }
      out.lo += e.lo;
      out.mid += e.mid;
      out.hi += e.hi;
    }
    return out;
  }
  // For the head's day (sim/day allot): the head's judgement of its household, once an allotment; the work it sees left of task j; the
  // hours of work it believes member id does in an hour at j (first: its first hand).
  const headOf = (st, hh) => {
    const plan = st.plans.households.get(hh.id),
      id = plan && plan.head ? plan.head.pawn : null,
      J = judgement(st, id);
    return { id, lean: J.lean, r: reckoned(J.skill) };
  };
  const workFor = (st, H, j) => workLeft(st, j, H.r, H.lean).work;
  const rateFor = (st, H, id, j, first) => rateBelieved(st, H.r, id, j, first);
  // For the honesty measure (tools/estimates.js): whether a task is one the measure reads (full attention, not carted), pawn id's work
  // left of it now, and the range it gives on the person-hours the hands of `hours` (a Map of pawn id to hours worked) take for that work.
  const attended = (j) => attentionOf(j) === 'full' && !says(KINDS[j.kind], 'carted');
  const workOf = (st, id, j) => {
    const J = judgement(st, id);
    return workLeft(st, j, reckoned(J.skill), J.lean).work;
  };
  function span(st, id, j, work, hours) {
    const J = judgement(st, id),
      r = reckoned(J.skill);
    let h = 0,
      hr = 0,
      i = 0;
    for (const [p, n] of hours) {
      h += n;
      hr += n * rateBelieved(st, r, p, j, i++ === 0);
    }
    const mid = hr > 0 ? (work * h) / hr : Infinity,
      [dn, up] = reach(J.skill, r, 0);
    return { lo: mid * (1 - dn), mid, hi: mid * (1 + up) };
  }
  // ---- afterwards: a window missed (sim/fields emits windowMissed: a ripe crop lost, a field left unsown at its window's close) ----
  // When the head's estimate of the task with the hands its day gave it lay outside its range of the truth, the record says which cause it
  // did not reckon with: of those, the one that moved the truth most; a head that reckoned with all of them, its lean or the mishaps.
  function missed(st, d) {
    const j = st.jobs.get(`${d.kind}:${fieldKey(d.farm, d.field)}`);
    if (!j || !j.owner || j.owner.type !== 'household') return;
    const hh = st.households[j.owner.id],
      plan = st.plans.households.get(hh.id);
    if (!plan || !plan.head || hh.dissolved) return;
    const id = plan.head.pawn,
      lists = plan.day ? plan.day.lists : {};
    let hands = hh.members.filter((m) => st.pawns[m].alive && (lists[m] || []).includes(j.key));
    if (!hands.length) hands = hh.members.filter((m) => st.pawns[m].alive && age(st, st.pawns[m]) >= 16);
    if (!hands.length) return;
    const e = estimate(st, id, j, hands);
    let rate = 0;
    hands.forEach((h, i) => (rate += rateTrue(st, h, j, i === 0)));
    const truth = rate > 0 ? Math.max(0, hoursOf(j) - doneOf(st, j)) / rate : Infinity;
    if (truth >= e.lo && truth <= e.hi) return;
    // what each cause not reckoned with made of the truth, as a factor on the hours: the crop's size, the hands' health, their skill
    const J = judgement(st, id),
      r = reckoned(J.skill),
      by = { size: hoursOf(j) / Math.max(1e-9, normOf(st, j)) };
    let hp = 0,
      sk = 0;
    for (const h of hands) {
      const p = st.pawns[h],
        R = Skills.SKILL.rate;
      hp += (1 - HUNGER.slow * p.hunger) * (1 - (HEALTH.slow * (100 - p.health)) / 100);
      sk += R[0] + (R[1] - R[0]) * Skills.skillOf(st, h, KINDS[j.kind].type);
    }
    by.health = hands.length / hp;
    by.skill = hands.length / sk;
    let cause = Math.abs(Math.log(J.lean)) > 0.05 ? 'lean' : 'mishap',
      most = 0;
    for (const k of unseenOf(r)) {
      const m = Math.abs(Math.log(by[k]));
      if (m > most + 1e-9) {
        most = m;
        cause = k;
      }
    }
    const f = st.farmsteads[hh.farmstead],
      task = KINDS[j.kind].label.toLowerCase(),
      long = truth > e.hi ? 'longer' : 'shorter',
      handWords = hands.length === 1 ? 'one hand' : `${hands.length} hands`;
    log(
      st,
      `${fullName(st.pawns[id])} of ${f.name} reckoned the ${task} at ${Math.round(e.mid)} hours for ${handWords}, ` +
        `and it would have taken ${long}: ` +
        `${d.why}; the head had not reckoned with ${WORDS[cause]}.`,
      { kind: 'misjudged', pawn: id, reason: cause, ...atFarm(f) },
    );
  }
  // The hours each season step still wants by the head's estimate (VB-1826: its rates and its lean), `left` {lo, mid, hi}: a
  // target's from its store's shortfall against its level (wood: the loads it lacks, fell and cut; hay: the mowing and carrying its
  // shortfall wants; fields: a clearing and a breaking each field it lacks;
  // seed: a sowing a field's seed it lacks; a made good: its maker's hours a unit it lacks), a routine's:
  // the head's estimate of the open tasks it opened (VB-1868), and a daily routine's its work on the days left (VB-1906). One estimate a target step with work
  // left; it feeds no rule yet (VB-1778 sets it against the labour budget).
  // The hours a unit of each made good takes, by its maker's kind (VB-1867).
  const PER = {
    ale: () => ({ kind: 'brew', hours: KINDS.brew.hours }),
    clay: () => ({ kind: 'dig', hours: KINDS.dig.hours }),
    bogOre: () => ({ kind: 'dig', hours: KINDS.dig.hours }),
    peat: (st) => ({ kind: 'dig', hours: KINDS.dig.hours / st.ECON.woodPerTrip }),
    salt: () => ({ kind: 'boilsalt', hours: KINDS.boilsalt.hours / 10 }),
    iron: () => ({ kind: 'smelt', hours: KINDS.smelt.hours }),
    quern: () => ({ kind: 'hewQuern', hours: KINDS.hewQuern.hours }),
    butter: () => ({ kind: 'milk', hours: KINDS.milk.hours }),
    'salt meat': () => ({ kind: 'slaughter', hours: KINDS.slaughter.hours }),
    'dried fish': () => ({ kind: 'rackfish', hours: KINDS.rackfish.hours / 4 + KINDS.dry.hours / 10 }),
    tar: () => ({ kind: 'burntar', hours: KINDS.burntar.hours }),
  };
  // The rations a field of crop yields in a year by a head's reckoning: FIELDS.expect of the crop's yield. The one reckoning of a field's
  // worth (VB-1778, review F1): read by the head's demand (sim/day atRisk, a field step's yield at risk) and by the labour budget's fit
  // (sim/levies, a field target's yield an hour), so that the bar for lowering a field and the weighing of a demand for it agree.
  const fieldYield = (crop) => FIELDS.expect * CROPS[crop].yield;
  // The work target step T still wants: {kind, lack (what its store lacks of its level, in the store's units), hours}, or null; read by
  // setLeft and by the labour budget's fit (sim/levies, VB-1778: a target lowered by the lack its hours buy).
  function workOfTarget(st, hh, c, T) {
    const k = T.what.target;
    if (k.store === 'wood') {
      const lack = k.seasons[c.season] - (hh.wood || 0);
      if (!(lack > 0)) return null;
      return { kind: 'wood', lack, hours: Math.ceil(lack / st.ECON.woodPerTrip) * (KINDS.wood.hours || 3) };
    }
    if (k.store === 'hay' && hh.farmstead !== null) {
      const need = Math.max(0, winterNeed(st, hh));
      let held = hh.hay || 0;
      for (const m of st.farmsteads[hh.farmstead].meadows) if (m.stage === 'mown') held += m.held;
      const lack = k.level * need - held;
      if (!(lack > 0)) return null;
      return { kind: 'mow', lack, hours: (lack / 30) * (KINDS.mow.hours + KINDS.hay.hours) };
    }
    if (k.store === 'fields' && hh.farmstead !== null) {
      const lack = k.level - st.farmsteads[hh.farmstead].fields.length;
      if (!(lack > 0)) return null;
      return { kind: 'clear', lack, hours: lack * (KINDS.clear.hours + KINDS.break.hours) };
    }
    if (k.store === 'seed') {
      const lack = k.level - (hh.grain ? hh.grain.barley || 0 : 0);
      if (!(lack > 0)) return null;
      return { kind: 'sow', lack, hours: (lack / CROPS.barley.seed) * KINDS.sow.hours };
    }
    if (k.good && PER[k.good]) {
      const M = Targets.MADE.get(k.good),
        lack = k.level - (M ? M.held(st, hh) : 0);
      if (!(lack > 0) || !Number.isFinite(lack)) return null;
      const P = PER[k.good](st);
      return { kind: P.kind, lack, hours: lack * P.hours };
    }
    return null;
  }
  // The hours a daily routine step s (sim/kinds `daily`: the meal, the water, the milking, the fodder) still wants on the days of the
  // season after today, by head id's estimate (VB-1906), {lo, mid, hi}, or null for none: the water, the day's fetch the head weighs
  // (sim/water waterOf, its walks known) each day; the byre's, each day's job as it would be posted then (sim/byre dayHours: the fodder
  // while the herds are stalled, the milking while animals are in milk); another lived by every day (`vital` true), its hours a day.
  function dailyLeft(st, hh, c, s, id) {
    const k = s.what.routine,
      K = KINDS[k],
      days = s.by - c.day;
    if (!K || !K.daily || !(days > 0)) return null;
    if (k === 'water') {
      const f = hh.farmstead === null ? null : st.farmsteads[hh.farmstead],
        W = f && f.water ? Water.waterOf(st, f) : null,
        h = W && !W.none ? W.hours * days : 0;
      return h > 0 ? { lo: h, mid: h, hi: h } : null;
    }
    let H = 0;
    if (k === 'fodder' || k === 'milk') for (let d = 1; d <= days; d++) H += dayHours(st, hh, k, cal(st.t + d * DAY));
    else if (K.vital === true) H = (K.hours || 0) * days;
    if (!(H > 0)) return null;
    const e =
      id === null
        ? null
        : estimate(st, id, {
            kind: k,
            hours: H,
            done: 0,
            rate: 0,
            owner: { type: 'household', id: hh.id },
            claims: [],
          });
    return e && Number.isFinite(e.mid) ? { lo: e.lo, mid: e.mid, hi: e.hi } : { lo: H, mid: H, hi: H };
  }
  function setLeft(st, plan, hh, c) {
    const id = plan.head ? plan.head.pawn : null,
      mine = st.jobsBy.get(`household:${hh.id}`);
    for (const s of plan.season) {
      if (!s.what.target) {
        // a routine: the head's estimate of the open tasks it opened (j.step), among the household's own (VB-1868)
        const sum = { lo: 0, mid: 0, hi: 0 };
        if (mine && id !== null)
          for (const j of mine) {
            if (j.step !== s.id) continue;
            const e = estimate(st, id, j);
            const f = Number.isFinite(e.mid);
            sum.lo += f ? e.lo : e.work;
            sum.mid += f ? e.mid : e.work;
            sum.hi += f ? e.hi : e.work;
          }
        // a daily routine: and its work on each day of the season left (VB-1906), so the budget is set against all the season's work
        const D = dailyLeft(st, hh, c, s, id);
        if (D) {
          sum.lo += D.lo;
          sum.mid += D.mid;
          sum.hi += D.hi;
        }
        s.left = sum; // lint-allow: owner as below
        continue;
      }
      const w = s.what.target ? workOfTarget(st, hh, c, s) : null;
      if (!w) {
        s.left = { lo: 0, mid: 0, hi: 0 }; // lint-allow: owner the estimate is the head's, sim/estimate (sim/seasonal sits before it)
        continue;
      }
      const e =
        id === null
          ? null
          : estimate(st, id, {
              kind: w.kind,
              hours: w.hours,
              done: 0,
              rate: 0,
              owner: { type: 'household', id: hh.id },
              claims: [],
            });
      s.left = // lint-allow: owner as above
        e && Number.isFinite(e.mid) ? { lo: e.lo, mid: e.mid, hi: e.hi } : { lo: w.hours, mid: w.hours, hi: w.hours };
    }
  }
  on('planReviewed', (st, d) => {
    if (d.plan.holder.type === 'household') setLeft(st, d.plan, st.households[d.plan.holder.id], d.c);
  });
  on('windowMissed', missed);
  return {
    ESTIMATE,
    judgement,
    reckoned,
    estimate,
    goalEstimate,
    headOf,
    workFor,
    rateFor,
    attended,
    workOf,
    span,
    workOfTarget,
    fieldYield,
  };
})();
