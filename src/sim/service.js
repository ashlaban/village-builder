// @sys sim/service: households short of people: a guardian for orphaned minor heirs, a servant for a holder who lives alone, kin or a
// servant for a household of at most one grown member whose ask for food fell short (VB-308), and with nobody to come, kin who hold its farm
// in trust (VB-309); service where labour is short (VB-090)
VB['sim/service'] = (() => {
  const { takePeopleCheck } = VB['sim/records'];
  const { personEvent, log, fullName, spouseOf, childrenOf, isHolder, kinship, atHousehold } = VB['sim/records'];
  const { wishOf, moveWhy } = VB['sim/wishes'];
  const { refreshRoles, setGuardian, extinct } = VB['sim/heirs'];
  const { issue } = VB['sim/commands'];
  const { hoursBetween } = VB['sim/routes'];
  const { SERVICE, MARRIAGE } = VB['sim/rules'];
  const Offers = VB['sim/offers'];
  const { hasPlot } = VB['sim/expansion'];
  const { trustOf } = VB['sim/ownership'];
  const adult = (p) => p.alive && p.age >= 18;
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
      return p.alive && p.age >= 14 && p.age < 60 && !p.retired;
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
      // the first by kinship, then the oldest, among those within walking reach of the farm's village (VB-290), else among all
      const best = [null, null],
        bk = [0, 0];
      for (const id of st.demand) {
        const q = st.pawns[id];
        if (!free(st, q) || q.household === hh.id) continue;
        const k = kinship(st, ward.id, id, memo);
        if (k <= 0) continue;
        const near = hoursBetween(st, farmOf(st, st.households[q.household]).village, f.village) < Infinity;
        for (const i of near ? [0, 1] : [1])
          if (!best[i] || k > bk[i] || (k === bk[i] && q.born < best[i].born)) {
            best[i] = q;
            bk[i] = k;
          }
      }
      const guardian = best[0] || best[1];
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
    if (o.from !== hh.holder) return `pawn ${o.from} is not the head of household ${hh.id}`;
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
    settle: (st, o) => (placeHome(st, o) ? serve(st, o.to, o.gives.household, 'round') : 'the household is gone'),
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
    return from.dissolved || from.members.length < 2 ? -1 : hands(st, from) - (q.age >= 14 && q.age < 60 ? 1 : 0);
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
    const h = hoursBetween(st, farmOf(st, a).village, farmOf(st, b).village);
    return h > SERVICE.hours ? null : h;
  };
  // The servant for household hh among `available`, or null: one whose household keeps SERVICE.keepHands working hands without it, from
  // hh's village first, then the nearest village within SERVICE.hours walking hours; then the household that keeps the most hands, then the oldest.
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
      const s = [d, -left, q.born];
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
      .filter((h) => !h.dissolved && (h.members.length === 1 || trustOf(st, h.id)) && adult(st.pawns[h.holder]));
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
  // command) to the short household with fields of their own village with the fewest hands per field, else to the shortest of the nearest
  // village within reach that has one (reachHours); never to a household where a parent lives (nobody goes back home by this rule). Each
  // household takes at most one new servant a round, and nobody moves twice in one. A servant whose household is no longer short may go
  // on at a later round by the same rule. Board and lodging only: the servant is a member and works its jobs on the `servant` basis.
  const fieldsOf = (st, hh) => Math.max(1, farmOf(st, hh).fields.length);
  const handsPerField = (st, hh) => hands(st, hh) / fieldsOf(st, hh);
  const parentIn = (st, q, hh) =>
    [q.father, q.mother].some((id) => id !== null && st.pawns[id].alive && st.pawns[id].household === hh.id);
  function serveWhereShort(st, { taken = new Set(), moved = new Set() } = {}) {
    const short = st.liveHouseholds
      .map((id) => st.households[id])
      .filter(
        (h) =>
          !h.dissolved &&
          h.holder !== null &&
          !taken.has(h.id) &&
          !trustOf(st, h.id) &&
          farmOf(st, h).fields.length > 0 &&
          handsPerField(st, h) < SERVICE.short,
      );
    if (!short.length) return;
    const going = willServe(st)
      .map((id) => st.pawns[id])
      .filter((q) => !moved.has(q.id))
      .sort((a, b) => a.born - b.born || a.id - b.id);
    for (const q of going) {
      if (!short.length) break;
      const from = st.households[q.household];
      if (
        from.dissolved ||
        handsPerField(st, from) <= SERVICE.spare ||
        (hands(st, from) - 1) / fieldsOf(st, from) < SERVICE.short
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
        const s = [d, handsPerField(st, h), h.id];
        if (!bs || before(s, bs)) {
          best = i;
          bs = s;
        }
      }
      if (best < 0) continue;
      if (!offerPlace(st, short[best].holder, q.id, short[best].id)) continue;
      short.splice(best, 1);
      moved.add(q.id);
    }
    refreshRoles(st);
    st.visualDirty = true;
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
      if (hh.dissolved || hh.holder === null || !farmOf(st, hh).fields.length || grown(st, hh) > 1) continue;
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
    careForOrphans,
    takeServants,
    serveWhereShort,
    takeIn,
    hands,
    handsPerField,
    unfit,
    handsLeft,
  };
})();
