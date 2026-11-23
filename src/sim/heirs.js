// @sys sim/heirs: succession: heir ranking, handovers, moving between households, roles
VB['sim/heirs'] = (() => {
  const { home } = VB['sim/records'];
  const { setServant, living } = VB['sim/records'];
  const { moveWhy } = VB['sim/wishes'];
  const {
    joinHousehold,
    leaveHousehold,
    clearMembers,
    noteDissolved,
    personEvent,
    log,
    age,
    fullName,
    spouseOf,
    childrenOf,
    siblingsOf,
    kinNear,
    isHolder,
    farmPractice,
    noteHolder,
    kinship,
    atHousehold,
    noteLine,
  } = VB['sim/records'];
  const { wishOf } = VB['sim/wishes'];
  const { stopWorkFor } = VB['sim/agents'],
    { stayOf } = VB['sim/pose'];
  const { farmToVillage, heldFarms, trustOf } = VB['sim/ownership'];
  const { issue, register } = VB['sim/commands'];
  const Stores = VB['sim/stores'];
  const { oweShare } = VB['sim/obligations'];
  const { dropStakes } = VB['sim/stakes'];
  const { birthright, claimOf } = VB['sim/farmclaims'];
  const { landed } = VB['sim/holding'];
  const { hoursBetween, byLand } = VB['sim/villagehours'];
  const { SHARES, GOODWILL } = VB['sim/rules'],
    { houseCondition } = VB['sim/house'];
  const { passGoodwill } = VB['sim/relations'];
  const { passHerds, payInAnimals } = VB['sim/droving'];
  const Lying = VB['sim/lying'],
    { ECON, TRAVEL } = VB['sim/rules'];
  const { abandoned } = VB['sim/fields'],
    { dropPlan } = VB['sim/plans'],
    { emit } = VB['sim/events'];
  const { heirsPlace, heirRanking, ownFirstOf } = VB['sim/heirranking'];
  // The act of moving (the move command, VB-822, its only caller): pawn id changes to household hhId, for `reason`; text: the 'moved' life
  // event, when the caller says more than the farm's name (sim/settle). The pawn walks to its new home, on a journey when it lies in another
  // village (sim/journeys' moved, VB-287, by sim/events); carry false: its provisions come from the new household (settlers).
  function moveTo(st, id, hhId, text = null, carry = true, reason = null) {
    const p = st.pawns[id],
      old = p.household !== null ? st.households[p.household] : null;
    leaveHousehold(st, id);
    const hh = st.households[hhId];
    joinHousehold(st, hh, id, false);
    emit(st, 'rehoused', { a: st.agents[id], old, hh, carry }); // it walks to its new home (sim/journeys' moved)
    if (old && old.farmstead !== hh.farmstead) {
      // on the record as `joined`, beside the event that tells the move itself
      personEvent(st, id, 'moved', text || `Moved to ${st.farmsteads[hh.farmstead].name}`, {
        ...atHousehold(st, hh),
        kind: 'joined',
        reason, // why it moved (the move command's reason, VB-822)
        fromFarm: old.farmstead, // the farm it left, whose history tells the leaving from this one event (sim/notable; VB-1027)
      });
    }
  }
  // reason: 'death', 'marriage', 'retirement', 'married away' (the holder married onto a spouse's farm), 'inherited away' (the holder, or
  // the holder's spouse, takes a larger farm as its heir: handOn's 'heir') or 'claim' (a landless adult takes a farm left with no heir;
  // nobody is owed shares of it). An heir who holds a place, or lives on a spouse's, hands that place on first (heirsPlace; VB-1141).
  // Pawn id moves to household target (the move command), for this module's acts.
  const move = (st, id, target, args) => issue(st, { actor: id, verb: 'move', target, args, source: 'succession' });
  function transfer(st, hh, heir, reason, from = null) {
    const f = st.farmsteads[hh.farmstead],
      cu = farmPractice(st, f),
      old = hh.holder,
      op = st.pawns[from !== null ? from : old]; // `from`: the dead holder of an inheritance taken up late (VB-1142)
    const hp = st.pawns[heir];
    const own = heirsPlace(st, heir);
    if (own && own !== hh) {
      emit(st, 'heirLeaves', { household: own.id }); // sim/trust ends a trust that holds it
      handOn(st, own, own.holder, hh.id, 'heir');
    }
    if (hp.household !== hh.id) {
      const from = hp.household !== null ? st.households[hp.household] : null,
        sp = spouseOf(st, heir);
      const kids = childrenOf(st, heir).filter(
        (c) => st.pawns[c].alive && st.pawns[c].age < 18 && st.pawns[c].household === hp.household && !isHolder(st, c),
      ); // a child who holds a farm of their own stays on it
      // the spouse who lives with the heir comes, and their minor children after them
      if (sp !== null && st.pawns[sp].alive && from && st.pawns[sp].household === from.id) {
        move(st, heir, hh.id, { reason: 'heir' });
        move(st, sp, hh.id, { reason: 'heir', with: kids });
      } else move(st, heir, hh.id, { reason: 'heir', with: kids });
    }
    hh.holder = heir;
    f.line = heir;
    noteHolder(st, hh);
    if (old !== heir) emit(st, 'newHead', { household: hh.id }); // the head's bias, drawn once (sim/plans, VB-254)
    noteLine(st, f);
    // at a retirement or a holder's death, a share of the old holder's goodwill passes to the new holder (design.md, The gift: Who books)
    if (old !== null && old !== heir && (reason === 'retirement' || reason === 'death'))
      passGoodwill(st, old, heir, GOODWILL.share);
    if (op && op.alive && op.household === hh.id && op.id !== heir) {
      op.retired = true;
      const s = spouseOf(st, old);
      if (s !== null && st.pawns[s].alive) st.pawns[s].retired = true;
    }
    // shares for the siblings who do not inherit
    if (cu.heirCount !== 'one' && reason !== 'claim') {
      const sibs = siblingsOf(st, heir).filter((q) => st.pawns[q].alive);
      const wt = (q) => (cu.daughterShare === 'half' && st.pawns[q].sex === 'f' ? 1 : 2);
      const value = f.fields.length * SHARES.perField + Stores.grainOf(hh) * SHARES.perGrain,
        total = [...sibs, heir].reduce((s, q) => s + wt(q), 0);
      for (const q of sibs) {
        const reserve = SHARES.reserveBase + hh.members.length * SHARES.reservePerMember; // shares never eat the seed corn or the winter's food
        const due = Math.round((value * wt(q)) / total),
          paid = Math.min(due, Math.max(0, Math.floor(Stores.grainOf(hh) - reserve)));
        Stores.move(st, hh, st.pawns[q], 'grain', paid, { kind: 'share', pawn: q });
        const qh = st.pawns[q].household; // grain short: animals (at their customary worth) go to a sibling's household of their own (VB-140)
        const animals = due > paid && qh !== null ? payInAnimals(st, hh, st.households[qh], due - paid) : 0,
          owed = due - paid - animals;
        if (owed) oweShare(st, hh, q, owed); // the farm that pays, at each moving round (sim/obligations; sim/cottage payOwed)
        if (due)
          personEvent(
            st,
            q,
            'share',
            `Received ${paid} rations${animals ? ` and animals worth ${animals}` : ''} as a share of ${f.name}` +
              `${owed ? `, ${owed} still owed` : ''}${cu.heirCount === 'split' ? ' (splitting land comes in a later batch)' : ''}`,
            { n: paid + animals, ...atHousehold(st, hh) },
          );
      }
    }
    personEvent(st, heir, 'inherited', `Took over ${f.name} (${reason})`, false); // recorded below
    log(
      st,
      `${fullName(hp)} takes over ${f.name}` +
        `${
          reason === 'death'
            ? ` after ${fullName(op)}`
            : reason === 'marriage'
              ? ' on marrying'
              : reason === 'married away'
                ? ` as ${fullName(op)} marries away`
                : reason === 'inherited away'
                  ? ` as ${fullName(op)} moves away` // the heir to another farm, or its spouse: op holds this one either way
                  : reason === 'claim'
                    ? `, left with no heir when ${fullName(op)} moved away`
                    : ' as the old holder retires'
        }.`,
      { kind: 'inherited', pawn: heir, other: op ? op.id : null, ...atHousehold(st, hh) },
    );
    st.visualDirty = true;
  }
  // Whether households a's and b's villages lie within walking reach of each other (VB-290).
  const reachable = (st, a, b) => byLand(st, st.farmsteads[a.farmstead].village, st.farmsteads[b.farmstead].village);
  // The smallest undissolved household of the village, or of the nearest village by walking hours when it has none (VB-290); with none
  // within walking reach, null: nobody is sent over the sea (VB-436), until slice 10's boats.
  function serviceHome(st, hh) {
    const village = st.farmsteads[hh.farmstead].village,
      vOf = (h) => st.farmsteads[h.farmstead].village;
    const open = st.liveHouseholds
      .map((id) => st.households[id])
      .filter((h) => !h.dissolved && h.id !== hh.id && h.members.length); // not a farm held in trust (VB-309)
    const smallest = (list) => list.sort((x, y) => x.members.length - y.members.length || x.id - y.id)[0];
    const here = smallest(open.filter((h) => vOf(h) === village));
    if (here) return here.id;
    let best = null,
      bh = Infinity;
    for (const h of open) {
      const u = vOf(h),
        t = hoursBetween(st, village, u);
      if (t < bh) {
        bh = t;
        best = u;
      }
    }
    const near = smallest(open.filter((h) => vOf(h) === best));
    return near ? near.id : null;
  }
  // A child's nearest grown kin with a household other than hh, by kinship (the oldest on a tie), or null (stability review: an orphan goes to
  // an aunt or a grandparent before going into service). Among the kin within walking reach of hh's village only (VB-290, VB-436).
  function kinHomeFor(st, id, hh) {
    const memo = new Map();
    let best = null,
      bk = 0;
    for (const liveId of st.living) {
      const q = st.pawns[liveId];
      if (
        !q.alive ||
        q.age < 18 ||
        q.household === null ||
        q.household === hh.id ||
        st.households[q.household].dissolved
      )
        continue;
      if (!reachable(st, hh, st.households[q.household])) continue;
      const k = kinship(st, id, q.id, memo);
      if (k > bk || (k === bk && k > 0 && q.born < best.born)) {
        best = q;
        bk = k;
      }
    }
    return best ? best.household : null;
  }
  // ---- the estate's barn and woodpile (VB-1175, from VB-650; AGENTS.md, the hard rule): what a household that dies out holds stays where it
  // lies, at its farm, and changes owner there. Its grain and its woodpile in whole trips (ECON.woodPerTrip) are taken out of its store
  // while it stands (a dissolved holder is refused), as handed on; once its people are placed they lie at the house (sim/lying, leftGrain
  // and leftTimber) for the household its herds go to (sim/droving passHerds: the first of its people to find a new home), put in at once
  // when that household lives on the same farm. With none, the grain is the village's, as the farm is (sim/ownership farmToVillage), and
  // the wood lies the dead household's for the autumn frost, which names it (sim/lying frost). What is left in its record (wood under a
  // trip, and the goods no fetch kind carries yet: stone, flour, peat, tar, hides, salt, iron, clay, ore, the rack) is noted in VB-1175.
  function takeEstate(st, hh) {
    const parts = {},
      grain = Stores.grainOf(hh) > 1e-9 ? Stores.take(st, hh, 'grain', Stores.grainOf(hh), ESTATE, parts) : 0,
      trips = Math.floor((hh.wood || 0) / ECON.woodPerTrip);
    if (trips > 0) Stores.take(st, hh, 'wood', trips * ECON.woodPerTrip, ESTATE);
    return { grain, parts, trips };
  }
  const ESTATE = { kind: 'handingOn', estate: true };
  function layEstate(st, hh, f, { grain, parts, trips }, to) {
    const heir = to === null ? null : st.households[to],
      here = heir && heir.farmstead === hh.farmstead;
    if (grain > 0) {
      if (here) Stores.put(st, heir, 'grain', grain, ESTATE, parts);
      else
        Lying.leave(
          st,
          'leftGrain',
          grain,
          f.house,
          heir ? { type: 'household', id: heir.id } : { type: 'village', id: f.village },
          {
            of: { parts: { ...parts } },
          },
        );
    }
    if (trips > 0) {
      if (here) Stores.put(st, heir, 'wood', trips * ECON.woodPerTrip, ESTATE);
      else
        Lying.leave(st, 'leftTimber', trips * TRAVEL.load, f.house, { type: 'household', id: heir ? heir.id : hh.id });
    }
  }
  // why: the end of the log line ("no heir would take it").
  function extinct(st, hh, why = 'no heir would take it') {
    const f = st.farmsteads[hh.farmstead];
    // nobody is sent over the sea (VB-436): with no household by land to take its people in (serviceHome finds one wherever kin by land
    // live), it does not empty. They stay where they are and the eldest holds the farm (QUESTION_ARCHIVE.md, VB-329, question 2), until
    // slice 10's boats.
    const left = hh.members
      .filter((id) => st.pawns[id].alive)
      .sort((a, b) => st.pawns[a].born - st.pawns[b].born || a - b);
    if (left.length && serviceHome(st, hh) === null) {
      const eldest = left[0];
      if (hh.holder !== eldest) {
        if (st.pawns[eldest].age < 18) setGuardian(st, hh, eldest);
        transfer(st, hh, eldest, 'claim');
      }
      log(
        st,
        `${fullName(st.pawns[eldest])} stays on at ${f.name}: ${why}, and no household by land could take its people in.`,
        {
          kind: 'stayed',
          pawn: eldest,
          ...atHousehold(st, hh),
        },
      );
      return;
    }
    // its work stops first, while it stands: a load on its way home is put down where it is (sim/agents, VB-611)
    stopWorkFor(st, hh, f);
    // a farm it held in trust goes back to its holder first (VB-309, sim/trust)
    for (const g of heldFarms(st, hh.id))
      issue(st, {
        actor: st.households[g.household].holder,
        verb: 'goBack',
        target: g.household,
        args: { why: 'trustee gone' },
        source: 'trust',
      });
    f.condition = houseCondition(st, f);
    f.household = null;
    f.state = 'derelict';
    f.emptySince = st.t; // the house as it was kept (VB-306)
    abandoned(f);
    // its plans go while it still stands: timber at a building step is put on its woodpile (sim/plans' leftWood), which a dissolved
    // holder refuses (VB-779); Stores.close leaves the wood, so it stays with the derelict farm
    dropPlan(st, 'household', hh.id);
    const estate = takeEstate(st, hh);
    hh.dissolved = true;
    noteDissolved(st, hh);
    Stores.close(st, hh);
    dropStakes(st, hh);
    farmToVillage(st, f);
    birthright(st, f, hh.holder); // the old family's claim on the farm for a generation (sim/farmclaims)
    // anyone left moves in with their nearest kin, or into service elsewhere in the village
    const people = [...hh.members];
    for (const id of people) {
      const p = st.pawns[id];
      if (!p.alive) continue;
      const kin = kinNear(st, id)
        .map((q) => st.pawns[q])
        .filter(
          (q) => q.alive && q.household !== null && !st.households[q.household].dissolved && q.household !== hh.id,
        );
      const near = kin.find((q) => reachable(st, hh, st.households[q.household])); // within walking reach only (VB-290, VB-436)
      const kinHome = near ? near.household : p.age < 18 ? kinHomeFor(st, id, hh) : null;
      const target = kinHome !== null ? kinHome : serviceHome(st, hh);
      if (target !== null) move(st, id, target, { reason: kinHome !== null ? 'care' : 'service' });
    }
    // the animals go with the first of its people to find a new home
    // (read from those it had: a move takes them off its members; VB-1175 found the herds had gone to no one)
    const first = people
      .map((id) => st.pawns[id])
      .find((p) => p.alive && p.household !== null && p.household !== hh.id);
    passHerds(st, hh, first ? first.household : null);
    layEstate(st, hh, f, estate, first ? first.household : null);
    clearMembers(st, hh);
    log(st, `${f.name} stands empty: ${why}.`, { kind: 'empty', ...atHousehold(st, hh) });
    st.visualDirty = true;
  }
  // The guardian of a minor: the surviving parent in the house, else the nearest adult relative there (the oldest on a tie), else the oldest adult.
  function guardianOf(st, hh, ward) {
    const w = st.pawns[ward],
      adults = hh.members.map((q) => st.pawns[q]).filter((q) => q.alive && q.age >= 18 && q.id !== ward);
    const parent = adults.filter((q) => q.id === w.father || q.id === w.mother).sort((x, y) => x.born - y.born)[0];
    if (parent) return parent.id;
    const memo = new Map(),
      kin = (q) => kinship(st, ward, q.id, memo);
    const best =
      adults.filter((q) => kin(q) > 0).sort((x, y) => kin(y) - kin(x) || x.born - y.born)[0] ||
      adults.sort((x, y) => x.born - y.born)[0];
    return best ? best.id : null;
  }
  function setGuardian(st, hh, ward) {
    hh.guardian = guardianOf(st, hh, ward);
    hh.ward = ward;
  }
  // Daily: a ward who has turned 18 needs no guardian; a ward who holds the farm takes charge of it.
  function comeOfAge(st) {
    for (const liveId of st.liveHouseholds) {
      const hh = st.households[liveId];
      if (hh.dissolved || hh.guardian === undefined || hh.guardian === null) continue;
      const ward = st.pawns[hh.ward];
      if (ward.alive && ward.age < 18) continue;
      hh.guardian = null;
      if (ward.alive && hh.holder === ward.id)
        personEvent(
          st,
          ward.id,
          'inherited',
          `Came of age and took charge of ${st.farmsteads[hh.farmstead].name}`,
          atHousehold(st, hh),
        );
    }
  }
  // The heir who takes the farm: the first in line, but when no adult is left in the house to be a minor's guardian (other than `leaving`),
  // the first adult in line, if there is one (stability review): a child does not keep a farm alone.
  function heirFor(st, hh, ranking, leaving = null, companion = null) {
    if (!ranking.length) return null;
    const grown = hh.members.some(
      (id) => id !== leaving && id !== companion && id !== hh.holder && st.pawns[id].alive && st.pawns[id].age >= 18,
    );
    if (grown || st.pawns[ranking[0]].age >= 18) return ranking[0];
    const adultHeir = ranking.find((id) => st.pawns[id].age >= 18);
    return adultHeir !== undefined ? adultHeir : ranking[0];
  }
  function succession(st, hh, reason) {
    const f = st.farmsteads[hh.farmstead],
      cu = farmPractice(st, f),
      dead = st.pawns[hh.holder];
    const sp = spouseOf(st, dead.id, dead.died - 0.01);
    const spouse = sp !== null && st.pawns[sp].alive && st.pawns[sp].household === hh.id ? sp : null;
    const asked = [],
      ranking = heirRanking(st, hh, cu, false, null, null, asked),
      heir = heirFor(st, hh, ranking, dead.id);
    if (
      spouse !== null &&
      (cu.widow === 'life' || cu.widow === 'outright' || heir === null || st.pawns[heir].age < 18)
    ) {
      hh.holder = spouse;
      noteHolder(st, hh);
      emit(st, 'newHead', { household: hh.id });
      if (cu.widow === 'outright') {
        f.line = spouse;
        noteLine(st, f);
      }
      passGoodwill(st, dead.id, spouse, GOODWILL.share); // the widow takes over as at any holder's death
      if (heir !== null && st.pawns[heir].age < 18) setGuardian(st, hh, heir);
      // under "a right to her keep" the spouse holds only for a minor heir, or, with no heir at all, as the one left on the farm
      const how =
        cu.widow === 'outright'
          ? 'outright'
          : cu.widow === 'life'
            ? 'for life'
            : heir !== null
              ? `as guardian for ${fullName(st.pawns[heir])}`
              : 'with no heir';
      const until =
        cu.widow === 'life'
          ? ' for life'
          : cu.widow === 'outright'
            ? ' as her own'
            : heir !== null
              ? ' until the heir comes of age'
              : ', having no heir';
      personEvent(st, spouse, 'inherited', `Holds ${f.name} ${how}`, false); // recorded below
      log(st, `${fullName(st.pawns[spouse])} keeps ${f.name}${until}.`, {
        kind: 'inherited',
        pawn: spouse,
        ...atHousehold(st, hh),
      });
      st.visualDirty = true;
      return;
    }
    // The inheritance falls to the first in line, as a right; one who holds a place renounces it, and it falls to the next (VB-824). A
    // minor is not asked.
    for (const e of asked) {
      if (e.id === heir) break;
      if (e.no === null || st.pawns[e.id].age < 18) continue;
      log(st, `${fullName(st.pawns[e.id])} renounces ${f.name}: ${e.no}.`, {
        kind: 'renounced',
        pawn: e.id,
        other: dead.id,
        ...atHousehold(st, hh),
      });
    }
    if (heir === null) {
      extinct(st, hh);
      return;
    }
    if (st.pawns[heir].age < 18) {
      // a minor heir holds in name, with a guardian until 18
      setGuardian(st, hh, heir);
    }
    const hp = st.pawns[heir];
    const none = st.offers.length;
    if (st.player && st.player.pawn === heir && hp.alive && hp.age >= 18 && hp.household !== hh.id) {
      // The played heir is asked (VB-1142): the farm is its own at once, a right (its holder, its goodwill), and it takes it up by walking
      // there, or renounces it (sim/marriage, the basis `inheritance`). The line stays the dead holder's, so that a renounced farm falls
      // to the next. Meanwhile the household's other members work its fields, as for any farm whose heir is on the way.
      const r = issue(st, {
        actor: heir,
        verb: 'offer',
        target: heir,
        args: { basis: 'inheritance', gives: { household: hh.id, from: dead.id } },
        source: 'death',
      });
      if (r === true && st.offers.length > none) {
        hh.holder = heir;
        noteHolder(st, hh);
        emit(st, 'newHead', { household: hh.id });
        passGoodwill(st, dead.id, heir, GOODWILL.share);
        st.visualDirty = true;
        return;
      }
    }
    transfer(st, hh, heir, 'death');
  }
  // A holder who leaves its farm, hh, for another, `home`, hands it on: at a marriage onto the spouse's farm (reason 'marriage'; stability
  // review, VB-153), when the holder of a farm held in trust inherits the trustee's (sim/trust, inheritedHeld), or when the holder, or the
  // spouse it lives with there, inherits a larger farm (reason 'heir', from transfer; VB-1141: the spouse goes too, and is no heir here). It
  // goes to its next heir who can keep it (an adult, or a minor with a grown housemate as guardian; heirFor), else to the landless adult of
  // its village who has waited longest for land (then the oldest), else to a minor heir (sim/service then brings a guardian or empties it),
  // else it stands empty and its grain and animals go with the holder. The holder's minor children go with them, unless one of them keeps
  // the farm; a minor holder's guardianship of it ends.
  function handOn(st, hh, giver, home, reason = 'marriage') {
    const spouse = spouseOf(st, giver);
    const follows = reason === 'heir' && spouse !== null && st.pawns[spouse].household === hh.id;
    const ranking = heirRanking(st, hh).filter((id) => !follows || id !== spouse),
      heir = heirFor(st, hh, ranking, giver, follows ? spouse : null);
    const keeps =
      heir !== null &&
      (st.pawns[heir].age >= 18 ||
        hh.members.some(
          (id) => id !== giver && (!follows || id !== spouse) && st.pawns[id].alive && st.pawns[id].age >= 18,
        ));
    const v = st.farmsteads[hh.farmstead].village,
      at = (id) => st.pawns[id];
    const claim = keeps
      ? undefined
      : st.demand
          .filter((id) => {
            const q = at(id),
              sp = spouseOf(st, id);
            return (
              q.alive &&
              q.age >= 18 &&
              q.household !== null &&
              q.household !== hh.id &&
              st.farmsteads[st.households[q.household].farmstead].village === v &&
              !isHolder(st, id) &&
              (sp === null || !isHolder(st, sp)) &&
              !st.liveHouseholds.some((hid) => st.households[hid].guardian === id) &&
              (wishOf(st, id, 'claim') ?? hh.farmstead) === hh.farmstead
            ); // its wish: no farm, or only the one it names (VB-212, VB-680)
          })
          .sort((a, b) => (at(b).landWait || 0) - (at(a).landWait || 0) || at(a).born - at(b).born || a - b)[0];
    const stays = keeps || (claim === undefined && heir !== null) ? heir : null;
    const kids = [...new Set([...childrenOf(st, giver), ...(follows ? childrenOf(st, spouse) : [])])].filter((c) => {
      const k = st.pawns[c];
      return c !== stays && k.alive && k.age < 18 && k.household === hh.id && !isHolder(st, c);
    });
    // the giver goes with its minor children
    if (st.pawns[giver].household === hh.id) move(st, giver, home, { reason, with: kids });
    else for (const c of kids) move(st, c, home, { reason });
    if (follows) move(st, spouse, home, { reason });
    if (hh.ward === giver) hh.guardian = hh.ward = null; // a minor holder's guardian here guards it no longer
    if (stays !== null) {
      if (st.pawns[stays].age < 18) setGuardian(st, hh, stays);
      transfer(st, hh, stays, reason === 'heir' ? 'inherited away' : 'married away');
      return;
    }
    if (claim !== undefined) {
      transfer(st, hh, claim, 'claim');
      const sp = spouseOf(st, claim);
      st.demand = st.demand.filter((id) => id !== claim && id !== sp);
      return;
    }
    const to = st.households[home];
    Stores.move(st, hh, to, 'grain', Stores.grainOf(hh), 'handingOn');
    passHerds(st, hh, home);
    extinct(st, hh, `${fullName(st.pawns[giver])} moved away, and nobody would take it`);
  }
  // ids: the pawns to refresh (a handover's households), else every living pawn.
  function refreshRoles(st, ids = st.living) {
    for (const liveId of ids) {
      const p = st.pawns[liveId];
      if (p.died !== null) continue;
      const hh = p.household !== null ? st.households[p.household] : null,
        a = age(st, p);
      if (!hh) {
        p.role = a < 14 ? 'child' : 'farmhand';
        continue;
      }
      const sp = spouseOf(st, p.id);
      if (hh.holder === p.id) p.role = 'farmer';
      else if (sp !== null && sp === hh.holder) p.role = p.sex === 'f' ? 'wife' : 'farmer';
      else if (p.retired) p.role = 'retired';
      else if (a < 14) p.role = 'child';
      else if (p.servant) p.role = p.sex === 'm' ? 'farmhand' : 'maid';
      else p.role = p.sex === 'm' ? 'son' : 'daughter';
    }
  }
  // The members of households hs now (a handover's: the giver's, the heir's old and new), for refreshRoles.
  function membersOf(st, hs) {
    const out = new Set();
    for (const h of hs) if (h !== null && h !== undefined) for (const id of st.households[h].members) out.add(id);
    return out;
  }
  function placeIfMarried(st, id, own = null) {
    const p = st.pawns[id],
      hh = p.household !== null ? st.households[p.household] : null;
    if (!hh || hh.dissolved) return null;
    if (hh.holder === id) return hh.id;
    return heirRanking(st, hh, null, false, own)[0] === id ? hh.id : null;
  }
  // The first heir of each farm; wantsOut takes it so that counting all pawns ranks each household once, not once per pawn.
  function firstHeirs(st, own = ownFirstOf(st)) {
    const out = new Set();
    for (const id of st.liveHouseholds) {
      const first = heirRanking(st, st.households[id], null, false, own)[0];
      if (first !== undefined) out.add(first);
    }
    return out;
  }
  // Why p does not want to move out, or null when it does. own: ownFirstOf(st), when the caller asks for many pawns while nothing changes.
  function staysWhy(st, p, heirs = null, own = null, wish = wishOf(st, p.id, 'out')) {
    if (!p.alive || p.age < 18 || p.retired) return p.retired ? 'retired' : 'under 18';
    if (landed(st, p.id)) return 'holds a farm, or is married to its holder'; // a bar of sim/holding's table
    if (wish !== true && placeIfMarried(st, p.id, own) !== null) return 'heir to the farm at home';
    if (claimOf(st, p.id)) return 'restoring a farm it claimed'; // (sim/farmclaims)
    if (wish !== null) return wish ? null : 'it wishes to stay'; // an heir's wait is the pawn's wish (sim/wishes, VB-680)
    if (heirs) {
      if (heirs.has(p.id)) return 'heir to a farm';
    } // heir somewhere else
    else
      for (const id of st.liveHouseholds) if (heirRanking(st, st.households[id])[0] === p.id) return 'heir to a farm';
    return null;
  }
  const wantsOut = (st, p, heirs = null, own = null) => staysWhy(st, p, heirs, own) === null;
  // st.demand: the living pawns who want to move out (landless adults with no prospect of a farm), in id order
  function countDemand(st) {
    const own = ownFirstOf(st);
    const heirs = firstHeirs(st, own);
    st.demand = st.living.filter((id) => wantsOut(st, st.pawns[id], heirs, own));
  }
  // Why a pawn changes household (VB-822; docs/plans/VB-682.md, section 5); whether pawn id keeps the minor m: its child, its spouse's
  // child or its ward, under 18.
  const MOVE_REASONS = ['marriage', 'heir', 'service', 'guardian', 'care', 'home', 'settle', 'found'];
  const keeps = (st, id, m) => {
    if (m === id || !(st.pawns[m].age < 18)) return false;
    const sp = spouseOf(st, id);
    return (
      childrenOf(st, id).includes(m) ||
      (sp !== null && childrenOf(st, sp).includes(m)) ||
      st.liveHouseholds.some((h) => st.households[h].guardian === id && st.households[h].ward === m)
    );
  };
  // handOn(target, {household, reason}): the actor, holding household args.household, hands it to the heir `target`
  register('handOn', {
    check: (st, c) =>
      !home(st, c.args && c.args.household)
        ? `there is no household ${c.args && c.args.household}`
        : st.households[c.args.household].holder !== c.actor
          ? `pawn ${c.actor} does not hold household ${c.args.household}`
          : living(st, c.target),
    run: (st, c) => transfer(st, st.households[c.args.household], c.target, c.args.reason),
  });
  // move(target, {reason, with, text}): the actor changes to household `target` (VB-822), the one act for every change of household; the
  // acts that change a right as well (marry, handOn, goToKin, goBack, the foundings) issue it for their people. `with`: the minors who
  // follow, after it, each its child, its spouse's child or its ward; `text`: the 'moved' life event, when the issuer says more than the
  // farm's name. Settlers (reason 'settle') walk on their stakes; reason 'service' makes the actor a servant, with the service event and
  // log line (args.event, args.line, args.other: the issuer's words, else the plain ones). Whose yes it needs is moveWhy's (VB-692).
  register('move', {
    check: (st, c) => {
      const a = c.args || {},
        dead = living(st, c.actor);
      if (dead) return dead;
      if (!home(st, c.target)) return `there is no household ${c.target}`;
      if (st.pawns[c.actor].household === c.target) return `pawn ${c.actor} lives there already`;
      // a farm held in trust has its people with kin (VB-309): its holder goes back first (goBack), which ends the trust (VB-1224)
      if (trustOf(st, c.target)) return `household ${c.target} is held in trust by kin`;
      if (!MOVE_REASONS.includes(a.reason)) return `there is no reason ${a.reason} to move`;
      // nobody is sent to a home over the sea (VB-436; design.md, Between villages, Over the sea): the two villages have a way by land.
      // Settlers are not asked: their site was found by walking from their village (sim/settle), whose row of hours it has not yet.
      const from = st.pawns[c.actor].household;
      if (a.reason !== 'settle' && from !== null && !reachable(st, st.households[from], st.households[c.target])) {
        VB.count.moveNoRoute++;
        return `there is no way by land from household ${from} to household ${c.target}`;
      }
      if (a.with !== undefined && !Array.isArray(a.with)) return 'those who follow must be a list';
      const whose = moveWhy(st, c.actor, c.target, a.reason);
      if (typeof whose === 'string') return whose;
      for (const m of a.with || []) {
        const why = living(st, m) || (keeps(st, c.actor, m) ? null : `pawn ${m} is not a minor whom ${c.actor} keeps`);
        if (why) return why;
      }
      return null;
    },
    run: (st, c) => {
      const a = c.args,
        hh = st.households[c.target];
      for (const id of [c.actor, ...(a.with || [])])
        moveTo(st, id, c.target, a.text ?? null, a.reason !== 'settle', a.reason);
      if (a.reason !== 'service') return;
      const at = st.farmsteads[hh.farmstead].name;
      setServant(st, c.actor, true);
      personEvent(st, c.actor, 'service', a.event || `Went into service at ${at}`, false); // recorded below
      const out = stayOf(st, c.actor) ? ', and sets out for it' : ''; // its new home lies in another village (VB-287)
      log(st, `${a.line || `${fullName(st.pawns[c.actor])} goes into service at ${at}`}${out}.`, {
        kind: 'service',
        pawn: c.actor,
        ...(a.other !== undefined ? { other: a.other } : {}),
        ...atHousehold(st, hh),
      });
    },
  });
  return {
    moveTo,
    transfer,
    extinct,
    succession,
    comeOfAge,
    refreshRoles,
    membersOf,
    placeIfMarried,
    wantsOut,
    staysWhy,
    countDemand,
    firstHeirs,
    setGuardian,
    handOn,
    heirFor,
  };
})();
