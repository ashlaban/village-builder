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
    holdingOf,
    practice,
    farmPractice,
    noteHolder,
    kinship,
    atHousehold,
    noteLine,
    householdsOfLine,
    ancestorsOf,
  } = VB['sim/records'];
  const { wishOf } = VB['sim/wishes'];
  const { stopWorkFor, stayOf } = VB['sim/agents'];
  const { farmToVillage, heldFarms } = VB['sim/ownership'];
  const { issue, register } = VB['sim/commands'];
  const Stores = VB['sim/stores'];
  const { oweShare } = VB['sim/obligations'];
  const { dropStakes } = VB['sim/stakes'];
  const { birthright, claimOf } = VB['sim/farmclaims'];
  const { hexSteps } = VB['sim/hex'];
  const { hoursBetween, byLand } = VB['sim/routes'];
  const { SHARES, GOODWILL, houseCondition } = VB['sim/rules'];
  const { passGoodwill } = VB['sim/relations'];
  const { passHerds, payInAnimals } = VB['sim/herds'];
  const { abandoned } = VB['sim/fields'],
    { dropPlan } = VB['sim/plans'],
    { emit } = VB['sim/events'];
  // Who would inherit this farm now, in order, under the practice of its village. The order is whom the holding is offered to, and the
  // passing over is what each would answer (VB-824; design.md, Succession: Handed on, and taken up): `asked`, an array, gets the whole
  // line in the order asked, {id, no (why this one would not take it, or null)}; those with no null, in that order, are the ranking.
  function heirRanking(st, hh, cust = null, nested = false, ownFirstSet = null, deps = null, asked = null) {
    VB.count.heirRank++;
    const f = st.farmsteads[hh.farmstead],
      cu = cust || practice(st, f.village);
    const line = f.line !== undefined && f.line !== null ? f.line : hh.holder;
    const sexRank = (p) =>
      cu.heirSex === 'sonsFirst'
        ? p.sex === 'm'
          ? 0
          : 1
        : cu.heirSex === 'daughtersFirst'
          ? p.sex === 'f'
            ? 0
            : 1
          : 0;
    const order = (ids) =>
      [...ids].sort((a, b) => {
        const pa = st.pawns[a],
          pb = st.pawns[b],
          s = sexRank(pa) - sexRank(pb);
        if (s) return s;
        if (cu.birthOrder === 'youngest') return pb.born - pa.born;
        if (cu.birthOrder === 'chosen') {
          const ha = pa.household === hh.id ? 0 : 1,
            hb = pb.household === hh.id ? 0 : 1;
          if (ha !== hb) return ha - hb;
        }
        return pa.born - pb.born;
      });
    const out = [],
      seen = new Set();
    const lineOf = (id, depth) => {
      if (depth > 3) return;
      for (const c of order(childrenOf(st, id))) {
        if (seen.has(c)) continue;
        seen.add(c);
        if (st.pawns[c].died === null) out.push(c);
        lineOf(c, depth + 1); // a dead child's children stand in their place; a living child's line follows them
      }
    };
    lineOf(line, 0);
    const direct = new Set(out);
    if (deps) {
      deps.add(line);
      deps.add(hh.holder);
    }
    // Only full rankings need the wider family; ownFirstOf asks just for direct heirs.
    // Then siblings and their lines, then the parents' siblings (cousins) and theirs.
    seen.add(line);
    let anc = line;
    for (let up = 0; !nested && up < 2; up++) {
      const lp = st.pawns[anc];
      if (lp.father === null && lp.mother === null) break;
      const parent = lp.father !== null ? lp.father : lp.mother;
      for (const s of order(childrenOf(st, parent).filter((q) => q !== anc))) {
        if (seen.has(s)) continue;
        seen.add(s);
        if (st.pawns[s].died === null) out.push(s);
        lineOf(s, 1);
      }
      anc = parent;
      seen.add(parent);
    }
    // Each one's answer: no, with why, when it holds a farm already or lives on a spouse's (farms are not combined)
    const no = asked ? new Map() : null,
      nameOf = (o) => st.farmsteads[o.farmstead].name,
      says = (id, why) => (no ? !no.set(id, why(id)) : false);
    const inLine = out.filter((id) => {
      if (deps) deps.add(id);
      return !(cu.heirSex === 'sons' && st.pawns[id].sex === 'f') && id !== hh.holder;
    });
    const ok = inLine.filter((id) => {
      const own = holdingOf(st, id);
      if (own && own !== hh) return says(id, () => `holds ${nameOf(own)}`); // already holds a farm
      const sp = spouseOf(st, id);
      if (deps && sp !== null) deps.add(sp);
      if (sp !== null) {
        const so = holdingOf(st, sp);
        if (so && so !== hh) return says(id, () => `lives at ${nameOf(so)}`);
      } // lives on a spouse's farm
      return true;
    });
    const ask = (ids) => {
      if (asked) for (const id of ids) asked.push({ id, no: no.get(id) || null });
    };
    if (nested) return ok.filter((id) => direct.has(id));
    if (!ok.length) {
      ask(inLine);
      return ok; // No competing direct claim can change an empty ranking.
    }
    // a relative who is first in line for their own parents' farm steps behind the others here: farms are not
    // combined while someone else in the family can take this one. Direct heirs of this farm keep their place.
    // Only a farm whose line is a candidate's ancestor, at most four generations up (lineOf), can have the candidate first (VB-224).
    const claims = ownFirstSet
      ? ownFirstSet.filter((e) => e[1] !== hh.id)
      : ownFirstOf(
          st,
          hh,
          [...ancestorsOf(st, ok, 4)].flatMap((id) => {
            if (deps) deps.add(id);
            return householdsOfLine(st, id);
          }),
          deps,
        );
    if (cu.ownHeir === 'keeps') {
      // nobody steps behind; an heir first in another farm's line too takes the farm with more fields (on a tie, their own
      // parents') and drops the other claim, which passes to the next in that line
      const wins = (id, o) => {
        const n = st.farmsteads[st.households[o].farmstead].fields.length,
          p = st.pawns[id];
        return (
          n > f.fields.length ||
          (n === f.fields.length && (p.household === o || [p.father, p.mother].includes(st.households[o].holder)))
        );
      };
      const kept = ok.filter((id) => {
        const won = claims.find((e) => e[0] === id && wins(id, e[1]));
        return won ? says(id, () => `is heir to ${nameOf(st.households[won[1]])}`) : true;
      });
      ask(inLine);
      return kept;
    }
    const ownFirst = new Set(claims.map((e) => e[0]));
    const back = (id) => !direct.has(id) && ownFirst.has(id);
    ask([...inLine.filter((id) => !back(id)), ...inLine.filter(back)]);
    return [...ok.filter((id) => !back(id)), ...ok.filter(back)];
  }
  // [heir, household id] for the first direct heir of each household other than hh (all households when hh is null). Callers that rank many
  // households while nothing changes compute this once and pass it to heirRanking as ownFirstSet. `among`: only these household ids;
  // `deps`: a Set that gets the pawns the rankings read.
  function ownFirstOf(st, hh = null, among = null, deps = null) {
    const out = [];
    for (const id of among || st.liveHouseholds) {
      const o = st.households[id];
      if (o !== hh) {
        const r = heirRanking(st, o, null, true, null, deps);
        if (r.length) out.push([r[0], o.id]);
      }
    }
    return out;
  }
  // The act of moving (the move command, VB-822, its only caller): pawn id changes to household hhId, for `reason`; text: the 'moved' life
  // event, when the caller says more than the farm's name (sim/settle). The pawn walks to its new home, on a journey when it lies in another
  // village (sim/away's moved, VB-287, by sim/events); carry false: its provisions come from the new household (settlers).
  function moveTo(st, id, hhId, text = null, carry = true, reason = null) {
    const p = st.pawns[id],
      old = p.household !== null ? st.households[p.household] : null;
    leaveHousehold(st, id);
    const hh = st.households[hhId];
    joinHousehold(st, hh, id, false);
    emit(st, 'rehoused', { a: st.agents[id], old, hh, carry }); // it walks to its new home (sim/away's moved)
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
  // reason: 'death', 'marriage', 'retirement', 'married away' (the holder married onto a spouse's farm) or 'claim' (a landless adult takes a
  // farm left with no heir; nobody is owed shares of it).
  // Pawn id moves to household target (the move command), for this module's acts.
  const move = (st, id, target, args) => issue(st, { actor: id, verb: 'move', target, args, source: 'succession' });
  function transfer(st, hh, heir, reason) {
    const f = st.farmsteads[hh.farmstead],
      cu = farmPractice(st, f),
      old = hh.holder,
      op = st.pawns[old];
    const hp = st.pawns[heir];
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
    if (op && op.alive && op.household === hh.id) {
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
                : reason === 'claim'
                  ? `, left with no heir when ${fullName(op)} married away`
                  : ' as the old holder retires'
        }.`,
      { kind: 'inherited', pawn: heir, other: op ? op.id : null, ...atHousehold(st, hh) },
    );
    st.visualDirty = true;
  }
  // Whether households a's and b's villages lie within walking reach of each other (VB-290).
  const reachable = (st, a, b) => byLand(st, st.farmsteads[a.farmstead].village, st.farmsteads[b.farmstead].village);
  // The smallest undissolved household of the village, or of the nearest village by walking hours when it has none (VB-290); with none
  // within walking reach, of the nearest by hexSteps between centres (until slice 10's boats).
  function serviceHome(st, hh) {
    const village = st.farmsteads[hh.farmstead].village,
      vOf = (h) => st.farmsteads[h.farmstead].village;
    const open = st.liveHouseholds
      .map((id) => st.households[id])
      .filter((h) => !h.dissolved && h.id !== hh.id && h.members.length); // not a farm held in trust (VB-309)
    const smallest = (list) => list.sort((x, y) => x.members.length - y.members.length || x.id - y.id)[0];
    const here = smallest(open.filter((h) => vOf(h) === village));
    if (here) return here.id;
    const c = st.villages[village].center;
    let best = null,
      bh = Infinity,
      bd = Infinity;
    for (const h of open) {
      const u = vOf(h),
        t = hoursBetween(st, village, u);
      if (t < bh) {
        bh = t;
        best = u;
      }
      if (bh === Infinity) {
        const d = hexSteps(st.w, c, st.villages[u].center);
        if (d < bd) {
          bd = d;
          best = u;
        }
      }
    }
    const near = smallest(open.filter((h) => vOf(h) === best));
    return near ? near.id : null;
  }
  // A child's nearest grown kin with a household other than hh, by kinship (the oldest on a tie), or null (stability review: an orphan goes to
  // an aunt or a grandparent before going into service). Among the kin within walking reach of hh's village first (VB-290), else among all.
  function kinHomeFor(st, id, hh) {
    const memo = new Map(),
      best = [null, null],
      bk = [0, 0];
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
      const k = kinship(st, id, q.id, memo),
        near = reachable(st, hh, st.households[q.household]);
      for (const i of near ? [0, 1] : [1])
        if (k > bk[i] || (k === bk[i] && k > 0 && q.born < best[i].born)) {
          best[i] = q;
          bk[i] = k;
        }
    }
    const b = best[0] || best[1];
    return b ? b.household : null;
  }
  // why: the end of the log line ("no heir would take it").
  function extinct(st, hh, why = 'no heir would take it') {
    const f = st.farmsteads[hh.farmstead];
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
    hh.dissolved = true;
    noteDissolved(st, hh);
    Stores.close(st, hh);
    dropStakes(st, hh);
    farmToVillage(st, f);
    birthright(st, f, hh.holder); // the old family's claim on the farm for a generation (sim/farmclaims)
    // anyone left moves in with their nearest kin, or into service elsewhere in the village
    for (const id of [...hh.members]) {
      const p = st.pawns[id];
      if (!p.alive) continue;
      const kin = kinNear(st, id)
        .map((q) => st.pawns[q])
        .filter(
          (q) => q.alive && q.household !== null && !st.households[q.household].dissolved && q.household !== hh.id,
        );
      const near = kin.find((q) => reachable(st, hh, st.households[q.household])) || kin[0]; // within walking reach first (VB-290)
      const kinHome = near ? near.household : p.age < 18 ? kinHomeFor(st, id, hh) : null;
      const target = kinHome !== null ? kinHome : serviceHome(st, hh);
      if (target !== null) move(st, id, target, { reason: kinHome !== null ? 'care' : 'service' });
    }
    // the animals go with the first of its people to find a new home
    const first = hh.members.map((id) => st.pawns[id]).find((p) => p.alive && p.household !== hh.id);
    passHerds(st, hh, first ? first.household : null);
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
  function heirFor(st, hh, ranking, leaving = null) {
    if (!ranking.length) return null;
    const grown = hh.members.some(
      (id) => id !== leaving && id !== hh.holder && st.pawns[id].alive && st.pawns[id].age >= 18,
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
    transfer(st, hh, heir, 'death');
  }
  // A holder who marries onto the spouse's farm, `home` (stability review, VB-153), hands their own farm on: to its next heir who can keep it
  // (an adult, or a minor with a grown housemate as guardian; heirFor), else to the landless adult of its village who has waited longest
  // for land (then the oldest), else to a minor heir (sim/service then brings a guardian or empties it), else it stands empty and its grain
  // and animals go with the holder. The holder's minor children go with them, unless one of them keeps the farm.
  function handOn(st, hh, giver, home) {
    const ranking = heirRanking(st, hh),
      heir = heirFor(st, hh, ranking, giver);
    const keeps =
      heir !== null &&
      (st.pawns[heir].age >= 18 ||
        hh.members.some((id) => id !== giver && st.pawns[id].alive && st.pawns[id].age >= 18));
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
    const kids = childrenOf(st, giver).filter((c) => {
      const k = st.pawns[c];
      return c !== stays && k.alive && k.age < 18 && k.household === hh.id && !isHolder(st, c);
    });
    // the giver goes with its minor children
    if (st.pawns[giver].household === hh.id) move(st, giver, home, { reason: 'marriage', with: kids });
    else for (const c of kids) move(st, c, home, { reason: 'marriage' });
    if (stays !== null) {
      if (st.pawns[stays].age < 18) setGuardian(st, hh, stays);
      transfer(st, hh, stays, 'married away');
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
    extinct(st, hh, `${fullName(st.pawns[giver])} married away, and nobody would take it`);
  }
  function refreshRoles(st) {
    for (const liveId of st.living) {
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
    const sp = spouseOf(st, p.id);
    if (isHolder(st, p.id) || (sp !== null && isHolder(st, sp))) return 'holds a farm, or is married to its holder';
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
      if (!MOVE_REASONS.includes(a.reason)) return `there is no reason ${a.reason} to move`;
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
    heirRanking,
    moveTo,
    transfer,
    extinct,
    succession,
    comeOfAge,
    refreshRoles,
    placeIfMarried,
    wantsOut,
    staysWhy,
    countDemand,
    firstHeirs,
    ownFirstOf,
    setGuardian,
    handOn,
    heirFor,
  };
})();
