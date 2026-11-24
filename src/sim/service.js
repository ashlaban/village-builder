// @sys sim/service: households short of people: a guardian for orphaned minor heirs, a servant for a holder who lives alone, kin or a
// servant for a household of at most one grown member whose ask for food fell short (VB-308), and with nobody to come, kin who hold its farm
// in trust (VB-309); service where labour is short (VB-090)
VB['sim/service'] = (() => {
  const { takePeopleCheck } = VB['sim/records'];
  const { personEvent, log, fullName, spouseOf, childrenOf, isHolder, kinship, atHousehold } = VB['sim/records'];
  const { wishOf, moveWhy } = VB['sim/wishes'];
  const { refreshRoles, setGuardian, extinct } = VB['sim/heirs'];
  const { issue } = VB['sim/commands'];
  const { hoursBetween, withinDay, byLand } = VB['sim/villagehours'];
  const { MARRIAGE, AGES, SHARES, YEAR, DAY } = VB['sim/rules'];
  const Stores = VB['sim/stores'];
  const Obligations = VB['sim/obligations'];
  const { floorOf } = VB['sim/hunger'];
  const Offers = VB['sim/offers'];
  const { balance } = VB['sim/relations'];
  const { hasPlot } = VB['sim/allotment'];
  const { trustOf } = VB['sim/ownership'];
  const adult = (p) => p.alive && p.age >= 18;
  // @tunable SERVICE: service: who takes in a servant, and where labour is short
  // Service (sim/service; stability review, a slice of VB-090): a holder who lives alone takes in an unmarried adult of ages[0]..ages[1] who
  // wants land, if that adult's household keeps keepHands working hands (14 to 59) without them; from the holder's village, or one within
  // `hours` walking hours of it, a day's walk, since the servant moves (VB-290; design.md, The round's other acts; it was 15 hex steps).
  // Where labour is short (VB-090; Agreed, Kim, 30 Oct): hands per field below `short`, to spare above `spare`.
  // The wage (VB-637; design.md, Marriage, nursing and growth: The portion): `wage` rations of grain for a year served, what a year's work
  // earns above board (12: a quarter of a year's food); a servant owed more than `unpaid` years' wages by its master leaves at the round.
  const SERVICE = { ages: [18, 50], keepHands: 2, hours: 12, short: 1, spare: 1.5, wage: 12, unpaid: 2 };
  // a before b, comparing arrays of numbers element by element
  const before = (a, b) => {
    for (let k = 0; k < a.length; k++) if (a[k] !== b[k]) return a[k] < b[k];
    return false;
  };
  const farmOf = (st, hh) => st.farmsteads[hh.farmstead];
  // a farm by name, with its village's name when it lies in another village than `here` (farm names repeat between villages)
  const farmIn = (st, hh, here = null) => {
    const f = farmOf(st, hh);
    return f.village === here ? f.name : `${f.name} in ${st.villages[f.village].name}`;
  };
  const isGuardian = (st, id) => st.liveHouseholds.some((hid) => st.households[hid].guardian === id);
  // Working hands of a household: members of 14 to 59 who have not retired (as VB-090 counts them).
  const hands = (st, hh) =>
    hh.members.filter((id) => {
      const p = st.pawns[id];
      return p.alive && p.age >= AGES.hands[0] && p.age < AGES.hands[1] && !p.retired;
    }).length;
  // An adult who wants land (st.demand, refreshed at each moving round) and can move: alive, landless still, with no plot coming, not a guardian.
  const free = (st, p) =>
    adult(p) &&
    !p.retired &&
    p.household !== null &&
    !isHolder(st, p.id) &&
    !hasPlot(st, p.id) &&
    !isGuardian(st, p.id) &&
    (spouseOf(st, p.id) === null || !isHolder(st, spouseOf(st, p.id)));

  // ---- guardians (stability review) ----
  // A minor heir holds in name with a guardian until 18 (sim/heirs), but when no adult is left in the house, a child kept the farm alone and
  // mostly starved. Daily, a household with no adult takes in the ward's nearest landless adult relative (by kinship, then the oldest; among those
  // within walking reach of the farm's village first, VB-290), with
  // their spouse and the minor children who live with them, and that relative becomes the guardian. With no such relative, the children go to
  // their nearest kin (or into service in the village) and the farm stands empty, as one that dies out.
  function familyOf(st, id) {
    const p = st.pawns[id],
      out = [id],
      sp = spouseOf(st, id);
    if (sp !== null && st.pawns[sp].alive && st.pawns[sp].household === p.household) out.push(sp);
    for (const q of out.slice())
      for (const c of childrenOf(st, q)) {
        const k = st.pawns[c];
        if (k.alive && k.age < 18 && k.household === p.household && !out.includes(c) && !isHolder(st, c)) out.push(c);
      }
    return out;
  }
  // The family of id moves to household target (the move command, VB-822): id first, then the spouse with the minor children who follow.
  function moveFamily(st, id, target, reason) {
    const fam = familyOf(st, id),
      sp = fam.length > 1 && fam[1] === spouseOf(st, id) ? fam[1] : null,
      kids = fam.slice(sp === null ? 1 : 2),
      go = (actor, args) => issue(st, { actor, verb: 'move', target, args, source: 'help' });
    if (sp === null) return go(id, { reason, with: kids });
    go(id, { reason });
    go(sp, { reason, with: kids });
  }
  function careForOrphans(st) {
    // The households whose membership changed since the last round (VB-323); extinction may dissolve one while this round is in progress.
    for (const liveId of takePeopleCheck(st)) {
      const hh = st.households[liveId];
      if (hh.dissolved || !hh.members.length || hh.members.some((id) => adult(st.pawns[id]))) continue;
      const ward = st.pawns[hh.holder],
        f = farmOf(st, hh),
        memo = new Map();
      // the first by kinship, then the oldest, among those within walking reach of the farm's village only (VB-290; VB-436: nobody is
      // sent over the sea)
      let guardian = null,
        bk = 0;
      for (const id of st.demand) {
        const q = st.pawns[id];
        if (!free(st, q) || q.household === hh.id) continue;
        if (!byLand(st, farmOf(st, st.households[q.household]).village, f.village)) continue;
        const k = kinship(st, ward.id, id, memo);
        if (k <= 0) continue;
        if (!guardian || k > bk || (k === bk && q.born < guardian.born)) {
          guardian = q;
          bk = k;
        }
      }
      if (guardian) {
        moveFamily(st, guardian.id, hh.id, 'guardian');
        setGuardian(st, hh, ward.id);
        personEvent(st, guardian.id, 'guardian', `Became guardian of ${fullName(ward)} at ${f.name}`, false); // recorded below
        log(
          st,
          `${fullName(guardian)} moves to ${f.name} as guardian of ${fullName(ward)}, who was left there with no grown kin.`,
          {
            kind: 'guardian',
            pawn: guardian.id,
            other: ward.id,
            ...atHousehold(st, hh),
          },
        );
      } else {
        // the kin who would take the children hold the farm in trust until the heir is 18 (Kim, 13 Nov; VB-309), else it stands empty
        const args = { why: 'is a child with no grown kin to come', ward: ward.id };
        if (issue(st, { actor: ward.id, verb: 'goToKin', target: hh.id, args, source: 'help' }) !== true)
          extinct(st, hh, `its heir ${fullName(ward)} is a child, with no grown kin to keep it`);
      }
      refreshRoles(st);
      st.visualDirty = true;
    }
  }

  // ---- a servant for the lone (stability review; a slice of VB-090) ----
  // At the moving round, after marriages and moves to new land: a holder of 18 or more who lives alone takes in an unmarried adult who wants
  // land (st.demand) as farmhand or maid, if that adult's household keeps at least SERVICE.keepHands working hands without them: from the
  // holder's village first, then from the nearest village within SERVICE.hours walking hours; among them, the one whose household
  // keeps the most hands, then the oldest. The servant still wants land, as VB-090 has it, and may marry the holder.
  // A landless adult goes into service with the holder of household hh (VB-171): the move command's terms, its reason and its words.
  function serving(st, id, hhId) {
    const p = st.pawns[id],
      hh = st.households[hhId];
    if (!p || !hh || p.household === null || hh.holder === null) return { reason: 'service' };
    const holder = st.pawns[hh.holder],
      from = farmIn(st, st.households[p.household], farmOf(st, hh).village),
      alone = hh.members.length === 1;
    return {
      reason: 'service',
      other: holder.id,
      event: `Went into service with ${fullName(holder)} at ${farmIn(st, hh)}`,
      line: `${fullName(p)} of ${from} goes into service with ${fullName(holder)} at ${farmIn(st, hh)}, ${
        alone ? 'who lived alone' : 'which was short of hands'
      }`,
    };
  }
  const serve = (st, id, hhId, source) =>
    issue(st, { actor: id, verb: 'move', target: hhId, args: serving(st, id, hhId), source });
  // ---- the basis `place` of sim/offers (VB-692; plan VB-682, sections 2 and 4.2): {from (the head of household gives.household), to (the
  // adult it would take), gives {household}}. Those whose yes the move needs answer (moveWhy: the adult and the head, who answers what the
  // round offers in his name, the played head as he likes); the adult says
  // yes by today's rule, as the round chose it (willServe: fit, and not declining service by its wish). A yes is the move, reason service.
  // Made by the round's choosers (takeServants, serveWhereShort) due at once; a no is told, and nobody remembers it. ----
  const placeHome = (st, o) => {
    const h = o.gives && st.households[o.gives.household];
    return h && !h.dissolved ? h : null;
  };
  function placeWhy(st, o) {
    const hh = placeHome(st, o),
      q = Number.isInteger(o.to) ? st.pawns[o.to] : null;
    if (!hh || hh.holder === null) return `there is no household ${o.gives && o.gives.household} with a head`;
    if (o.from !== hh.holder) return `pawn ${o.from} is not the head of the household`;
    if (!q || !q.alive || q.household === null) return `pawn ${o.to} is not a living pawn with a home`;
    if (q.household === hh.id) return `pawn ${o.to} lives there already`;
    const whose = moveWhy(st, q.id, hh.id, 'service');
    return typeof whose === 'string' ? whose : {};
  }
  Offers.basis('place', {
    books: 'nothing',
    memory: false,
    wait: () => MARRIAGE.offerDays,
    check: placeWhy,
    answers: (st, o) =>
      moveWhy(st, o.to, o.gives.household, 'service').map((a) => ({ key: a.key, by: a.by, yes: null })),
    weigh: (st, o, a) =>
      a.key !== 'self' || (unfit(st, st.pawns[o.to]) === null && wishOf(st, o.to, 'serve') !== false),
    settle: (st, o) => {
      if (!placeHome(st, o)) return 'the household is gone';
      const r = serve(st, o.to, o.gives.household, 'round');
      if (r === true && o.id !== undefined) refreshRoles(st); // answered after the round's step, which refreshes its own
      return r;
    },
    subject: (st, o) => o.to,
    where: (st, o) => farmOf(st, st.households[o.gives.household]).village,
    what: (st, o) =>
      `a place in service at ${farmOf(st, st.households[o.gives.household]).name} for ${fullName(st.pawns[o.to])}`,
  });
  // Head `from` offers pawn id a place in household hhId at the moving round, due at once (the round's choosers): true when it moved in.
  function offerPlace(st, from, id, hhId) {
    issue(st, {
      actor: from,
      verb: 'offer',
      target: id,
      args: { basis: 'place', gives: { household: hhId } },
      source: 'round',
    });
    return st.pawns[id].household === hhId;
  }
  // Why q may not go into service at all, or null: it must be free to move, unmarried and of serving age.
  function unfit(st, q) {
    if (!free(st, q))
      return !adult(q)
        ? 'under 18'
        : q.retired
          ? 'retired'
          : q.household === null
            ? 'has no home'
            : hasPlot(st, q.id)
              ? 'has a plot coming'
              : isGuardian(st, q.id)
                ? 'keeps a ward'
                : 'holds a farm, or is married to its holder';
    if (spouseOf(st, q.id) !== null) return 'married';
    return q.age > SERVICE.ages[1] || q.age < SERVICE.ages[0]
      ? `service is for those of ${SERVICE.ages[0]} to ${SERVICE.ages[1]}`
      : null;
  }
  // The working hands q's household keeps without it; -1 when it has no household to leave (dissolved, or q alone in it).
  function handsLeft(st, q) {
    const from = st.households[q.household];
    return from.dissolved || from.members.length < 2
      ? -1
      : hands(st, from) - (q.age >= AGES.hands[0] && q.age < AGES.hands[1] ? 1 : 0);
  }
  // Those who would serve now, in demand order: fit (unfit null), and not declining by the player's wish (VB-212).
  // One who holds an open offer about its future takes part only in that offer's step (VB-692).
  const willServe = (st) =>
    st.demand.filter(
      (id) =>
        unfit(st, st.pawns[id]) === null &&
        wishOf(st, id, 'serve') !== false &&
        (st.pawns[id].ask === undefined || st.pawns[id].ask === null),
    );
  // The placement every service rule shares (village first, then the nearest village within a day's walk; VB-090, VB-308, VB-290): the
  // walking hours between the greens of households a's and b's villages (sim/routes), 0 in one village, or null beyond SERVICE.hours or
  // by no route by land. Ranking by it puts the own village first. One table entry.
  const reachHours = (st, a, b) => {
    const u = farmOf(st, a).village,
      v = farmOf(st, b).village;
    return withinDay(st, u, v, SERVICE.hours) ? hoursBetween(st, u, v) : null;
  };
  // The whole rations head owes pawn id in goodwill (sim/relations balance), 0 if none: a worker's credit for hours it gave (VB-704)
  const owedTo = (st, head, id) => Math.max(0, Math.floor(-balance(st, head, id)));
  // The servant for household hh among `available`, or null: one whose household keeps SERVICE.keepHands working hands without it, from
  // hh's village first, then the nearest village within SERVICE.hours walking hours; then the one its head owes most in goodwill, whose
  // asking for a place is answered by its credit (VB-704); then the household that keeps the most hands, then the oldest.
  function servantFor(st, hh, available) {
    let best = null,
      bs = null;
    for (const id of available) {
      const q = st.pawns[id];
      if (q.household === hh.id) continue;
      const left = handsLeft(st, q);
      if (left < SERVICE.keepHands) continue;
      const d = reachHours(st, st.households[q.household], hh);
      if (d === null) continue;
      const s = [d, -owedTo(st, hh.holder, id), -left, q.born];
      if (!bs || before(s, bs)) {
        best = q;
        bs = s;
      }
    }
    return best;
  }
  function takeServants(st) {
    // a grown holder whose farm is held in trust by kin counts as one who lives alone: with a servant, it goes back (VB-309)
    const lone = st.liveHouseholds
      .map((id) => st.households[id])
      .filter(
        (h) =>
          !h.dissolved &&
          (h.members.length === 1 || trustOf(st, h.id)) &&
          adult(st.pawns[h.holder]) &&
          (!belowFloor(st, h) || trustOf(st, h.id)), // a farm in trust goes back to its heir with a servant whatever its store
      );
    const taken = new Set(),
      moved = new Set(); // the households that took a servant this round, and the servants (for serveWhereShort)
    if (!lone.length) return { taken, moved };
    // Service changes residence only: marriage, holdings, guardians and plots stay fixed during this pass.
    // Keep demand order for ties, but evaluate those eligibility rules once rather than for every lone holder.
    // Whether it would serve is the pawn's own wish (anyone who wants out would), its wish (sim/wishes) may decline it (VB-212, VB-680).
    const available = willServe(st);
    for (const hh of lone) {
      const t = trustOf(st, hh.id);
      if (!t && hh.members.length !== 1) continue;
      const best = servantFor(st, hh, available);
      if (!best) continue;
      const back = { actor: hh.holder, verb: 'goBack', target: hh.id, args: { why: 'servant' }, source: 'round' };
      if (t && issue(st, back) !== true) continue;
      if (offerPlace(st, hh.holder, best.id, hh.id)) {
        taken.add(hh.id);
        moved.add(best.id);
      }
    }
    refreshRoles(st);
    st.visualDirty = true;
    return { taken, moved };
  }

  // ---- service where labour is short (VB-090; design.md, Leaving home: Service) ----
  // Hands per field: working hands (members of 14 to 59, not retired) over the farm's fields, at least 1. Short below SERVICE.short, hands
  // to spare above SERVICE.spare. At the moving round, after the servants for the lone (takeServants, whose households and servants count as
  // this round's): those who would serve (willServe: in st.demand, fit, unmarried, 18 to 50, not declining by the player's wish), oldest
  // first, whose household has hands to spare and keeps at least SERVICE.short hands per field without them, go as servants (the serve
  // command) to the short household with fields of their own village whose head owes them most in goodwill (VB-704), then with the fewest
  // hands per field, else to the shortest of the nearest village within reach that has one (reachHours); never to a household where a
  // parent lives (nobody goes back home by this rule). Each household takes at most one new servant a round, and nobody moves twice in one.
  // A servant whose household is no longer short may go on at a later round by the same rule. The servant is a member, works its jobs on
  // the `servant` basis and is owed a wage a year (oweWages); a household below its floor (sim/hunger floorOf) takes no new servant, since
  // it could not pay one (VB-637), nor does a lone holder's (takeServants) but where its farm is held in trust (VB-309: a rescue, as
  // takeIn is). One its master owes more than SERVICE.unpaid years' wages goes home (unpaidLeave), else asks for a place as one a head
  // refused does (`leavers`), whatever the hands at home.
  const fieldsOf = (st, hh) => Math.max(1, farmOf(st, hh).fields.length);
  const handsPerField = (st, hh) => hands(st, hh) / fieldsOf(st, hh);
  const parentIn = (st, q, hh) =>
    [q.father, q.mother].some((id) => id !== null && st.pawns[id].alive && st.pawns[id].household === hh.id);
  function serveWhereShort(st, { taken = new Set(), moved = new Set(), leavers = [] } = {}) {
    const short = st.liveHouseholds
      .map((id) => st.households[id])
      .filter(
        (h) =>
          !h.dissolved &&
          h.holder !== null &&
          !taken.has(h.id) &&
          !trustOf(st, h.id) &&
          farmOf(st, h).fields.length > 0 &&
          handsPerField(st, h) < SERVICE.short &&
          !belowFloor(st, h),
      );
    if (!short.length) return;
    // One of a courting couple a head refused (`leavers`: sim/courting, VB-036) asks for a place whatever the hands at home, and
    // whether or not it waits for land: fit to serve, and holding no open offer about its future.
    const leaving = new Set(
      leavers.filter((id) => {
        const q = st.pawns[id];
        return unfit(st, q) === null && wishOf(st, id, 'serve') !== false && (q.ask === undefined || q.ask === null);
      }),
    );
    const going = [...new Set([...willServe(st), ...leaving])]
      .map((id) => st.pawns[id])
      .filter((q) => !moved.has(q.id))
      .sort((a, b) => a.born - b.born || a.id - b.id);
    for (const q of going) {
      if (!short.length) break;
      const from = st.households[q.household];
      if (
        from.dissolved ||
        (!leaving.has(q.id) &&
          (handsPerField(st, from) <= SERVICE.spare || (hands(st, from) - 1) / fieldsOf(st, from) < SERVICE.short))
      )
        continue;
      let best = -1,
        bs = null;
      VB.count.labourWeighed += short.length;
      for (let i = 0; i < short.length; i++) {
        const h = short[i];
        if (h.id === from.id || parentIn(st, q, h)) continue;
        const d = reachHours(st, from, h);
        if (d === null) continue;
        const s = [d, -owedTo(st, h.holder, q.id), handsPerField(st, h), h.id]; // its credit answers its ask (VB-704)
        if (!bs || before(s, bs)) {
          best = i;
          bs = s;
        }
      }
      if (best < 0) continue;
      if (!offerPlace(st, short[best].holder, q.id, short[best].id)) continue;
      if (leaving.has(q.id) && Number.isInteger(q.courting))
        personEvent(
          st,
          q.id,
          'leftRefused',
          `Left home: the match with ${fullName(st.pawns[q.courting])} was refused`,
          {
            other: q.courting,
            village: farmOf(st, short[best]).village,
          },
        );
      short.splice(best, 1);
      moved.add(q.id);
    }
    refreshRoles(st);
    st.visualDirty = true;
  }

  // ---- the servant's wage (VB-637; design.md, Marriage, nursing and growth: The portion; Exchange, Obligations) ----
  // A household below its floor (its seed and HELP.floorDays of food: what it keeps back from any gift) could not pay a wage.
  const belowFloor = (st, hh) => Stores.grainOf(hh) < floorOf(st, hh);
  const party = (kind, id) => ({ kind, id });
  // At the moving round's first step, before its offers are answered: each servant who has served a year (in service with its master
  // since the round a year back, pawn.servedSince) is owed SERVICE.wage rations by the household it serves, as an obligation of the kind
  // `wage`: the creditor the servant, as a sibling's share names a person, the enforcer the master's village. One obligation a servant a
  // year. Then the wages owed are paid (payWages), so that a servant who marries at this round brings its year's wage to the home.
  function oweWages(st) {
    for (const hid of st.liveHouseholds) {
      const hh = st.households[hid];
      if (hh.dissolved || hh.farmstead === null) continue;
      VB.count.wagesWeighed += hh.members.length;
      for (const id of hh.members) {
        const p = st.pawns[id];
        if (!p.alive || !p.servant || p.servedSince === null || st.t - p.servedSince < YEAR - DAY) continue;
        Obligations.create(st, {
          kind: 'wage',
          debtor: party('household', hh.id),
          creditor: party('pawn', id),
          owes: { rations: SERVICE.wage },
          enforcer: party('village', farmOf(st, hh).village),
        });
      }
    }
    payWages(st);
  }
  // Wages owed are paid from the master's grain above its reserve (the seed and the winter's food, as shares are paid: SHARES), into the
  // servant's stake. Paid where it lies: the grain changes owner in the master's store, where the servant lives, so only to one who lives
  // there still; what one who has left is owed stays owed. What a dead servant was owed, or a master's household gone, lapses.
  function payWages(st) {
    for (const [id, list] of Obligations.openShares(st, 'wage')) {
      const p = st.pawns[id];
      if (!p.alive) {
        for (const o of list) Obligations.lapse(st, o.id, 'the one owed has died');
        continue;
      }
      const byHousehold = new Map();
      for (const o of list) {
        if (!byHousehold.has(o.debtor.id)) byHousehold.set(o.debtor.id, []);
        byHousehold.get(o.debtor.id).push(o);
      }
      for (const [debtor, os] of byHousehold) {
        const hh = st.households[debtor];
        if (hh.dissolved) {
          for (const o of os) Obligations.lapse(st, o.id, 'the household that owed it is gone');
          continue;
        }
        if (p.household !== hh.id) continue;
        const owed = os.reduce((n, o) => n + Obligations.left(o), 0),
          reserve = SHARES.reserveBase + hh.members.length * SHARES.reservePerMember,
          pay = Math.min(owed, Math.max(0, Math.floor(Stores.grainOf(hh) - reserve)));
        if (pay <= 0) continue;
        Obligations.fulfil(
          st,
          os.map((o) => o.id),
          pay,
          { kind: 'wage', pawn: id },
          { from: hh, to: p, good: 'grain' },
        );
        const rest = owed - pay;
        personEvent(st, id, 'wage', `Was paid ${pay} rations of wages${rest ? `, ${rest} still owed` : ''}`, {
          n: pay,
          ...atHousehold(st, hh),
        });
      }
    }
  }
  // The rations of wages pawn id is owed by household hh (or by any household), still to deliver.
  const wagesOwed = (st, id, hh = null) =>
    Obligations.due(st, party('pawn', id), 'creditor', 'wage')
      .filter((o) => hh === null || o.debtor.id === hh)
      .reduce((n, o) => n + Obligations.left(o), 0);
  // The servants whose master owes them more than SERVICE.unpaid years' wages, by id: they leave at the round (serveWhereShort's
  // leavers; with no place found, unpaidLeave).
  function unpaid(st) {
    const out = [];
    for (const [id] of Obligations.openShares(st, 'wage')) {
      const p = st.pawns[id];
      if (
        p.alive &&
        p.servant &&
        p.household !== null &&
        wagesOwed(st, id, p.household) > SERVICE.unpaid * SERVICE.wage
      )
        out.push(id);
    }
    return out;
  }
  // The servants of `ids` (unpaid) go home: to the household of a living parent, if it will have them (the move's yes), the reason
  // 'home'. Returns those with no home to go to, who ask for a place with another master (serveWhereShort's leavers).
  function unpaidLeave(st, ids) {
    const left = [];
    for (const id of ids) {
      const p = st.pawns[id],
        master = st.households[p.household],
        owed = wagesOwed(st, id, master.id);
      const homes = [p.father, p.mother]
        .filter((q) => q !== null && st.pawns[q].alive && st.pawns[q].household !== null)
        .map((q) => st.pawns[q].household)
        .filter((h, k, all) => h !== master.id && !st.households[h].dissolved && all.indexOf(h) === k);
      const text = (h) =>
        `Went home to ${farmIn(st, st.households[h])}: ${farmIn(st, master)} owed ${owed} rations of wages`;
      const went = homes.some(
        (h) =>
          issue(st, {
            actor: id,
            verb: 'move',
            target: h,
            args: { reason: 'home', text: text(h) },
            source: 'round',
          }) === true,
      );
      if (!went) left.push(id);
    }
    return left;
  }

  // ---- taken in before it starves (VB-308; design.md, Households short of people) ----
  // A household of at most one grown member, with fields, whose seasonal ask for food fell short (sim/help's shareFood names it, the same
  // day) is taken in at once. Kin first: the holder's nearest relative in st.demand (kinship over 0, then the oldest, as a guardian is chosen),
  // fit to serve (unfit null: free, unmarried, 18 to 50), whose household is not left short of people without them (it keeps two grown
  // members, or holds no fields), from the village or within SERVICE.hours walking hours, moves in as a member with the minor children who live
  // with them. Else a servant, as takeServants chooses for this
  // household, through the `serve` command. People come to the farm: its owner, holder and fields are unchanged. With nobody to come, its
  // people go to kin who hold the farm in trust (trusteeFor, sim/trust; VB-309), else nothing happens. Only a household named searches:
  // st.demand once with a kinship memo, then the servants' list, then its kin households.
  const grown = (st, hh) => hh.members.filter((id) => adult(st.pawns[id])).length;
  function takeIn(st, ids) {
    let available = null;
    for (const id of ids) {
      const hh = st.households[id];
      // a farm held in trust since it was named (careForOrphans the same day: VB-1224) has its people with kin, who work it
      if (
        hh.dissolved ||
        hh.holder === null ||
        !farmOf(st, hh).fields.length ||
        grown(st, hh) > 1 ||
        trustOf(st, hh.id)
      )
        continue;
      const holder = st.pawns[hh.holder],
        memo = new Map();
      let best = null,
        bk = 0;
      VB.count.takeInWeighed += st.demand.length;
      for (const qid of st.demand) {
        const q = st.pawns[qid];
        if (q.household === null || q.household === hh.id || unfit(st, q) !== null) continue;
        const k = kinship(st, holder.id, qid, memo);
        if (k <= 0 || (best && (k < bk || (k === bk && q.born >= best.born)))) continue;
        const from = st.households[q.household];
        if (from.dissolved || (grown(st, from) - 1 < 2 && farmOf(st, from).fields.length)) continue;
        if (reachHours(st, from, hh) === null) continue;
        best = q;
        bk = k;
      }
      if (best) {
        const from = farmIn(st, st.households[best.household], farmOf(st, hh).village);
        moveFamily(st, best.id, hh.id, 'care');
        personEvent(
          st,
          best.id,
          'moved',
          `Moved to ${farmIn(st, hh)} to help ${fullName(holder)}, who was short of food and hands`,
          false,
        ); // below
        log(
          st,
          `${fullName(best)} of ${from} moves to ${farmIn(st, hh)} to help ${fullName(holder)}, who was short of food and hands.`,
          {
            kind: 'moved',
            pawn: best.id,
            other: holder.id,
            ...atHousehold(st, hh),
          },
        );
      } else {
        if (!available) available = willServe(st);
        VB.count.takeInWeighed += available.length;
        const s = servantFor(st, hh, available);
        if (s && serve(st, s.id, hh.id, 'help') === true) available = available.filter((x) => x !== s.id);
        else {
          const args = { why: 'was short of food and hands, with nobody to come' };
          if (issue(st, { actor: hh.holder, verb: 'goToKin', target: hh.id, args, source: 'help' }) !== true) continue;
        }
      }
      refreshRoles(st);
      st.visualDirty = true;
    }
  }
  return {
    SERVICE,
    careForOrphans,
    takeServants,
    serveWhereShort,
    takeIn,
    hands,
    handsPerField,
    unfit,
    handsLeft,
    oweWages,
    payWages,
    wagesOwed,
    unpaid,
    unpaidLeave,
  };
})();
