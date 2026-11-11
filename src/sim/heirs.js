// @sys sim/heirs: succession: heir ranking, handovers, moving between households, roles
VB['sim/heirs'] = (() => {
  const {
    joinHousehold, leaveHousehold, clearMembers, setServant, noteDissolved, personEvent, log, age, fullName, spouseOf, childrenOf, siblingsOf,
      kinNear,
      isHolder, holdingOf, practice, farmPractice, noteHolder, kinship,
      atHousehold, noteLine, householdsOfLine, ancestorsOf, wishOf,
  } = VB['sim/records'];
  const { placeAtHome, release, dropJob } = VB['sim/agents'];
  const { farmToVillage } = VB['sim/ownership'];
  const Stores = VB['sim/stores'];
  const { dropStakes } = VB['sim/stakes'];
  const { birthright, claimOf } = VB['sim/farmclaims'];
  const { hexSteps } = VB['sim/hex'];
  const { SHARES, GOODWILL, houseCondition } = VB['sim/rules'];
  const { passGoodwill } = VB['sim/relations'];
  const { passHerds, payInAnimals } = VB['sim/herds'];
  const { abandoned } = VB['sim/fields'], { dropPlan } = VB['sim/plans'];
  // Who would inherit this farm now, in order, under the practice of its village.
  function heirRanking(st, hh, cust = null, nested = false, ownFirstSet = null, watch = null, family = null) {
    VB.count.heirRank++;
    const f = st.farmsteads[hh.farmstead], cu = cust || practice(st, f.village);
    const line = f.line !== undefined && f.line !== null ? f.line : hh.holder;
    const sexRank = (p) => cu.heirSex === 'sonsFirst' ? (p.sex === 'm' ? 0 : 1) : cu.heirSex === 'daughtersFirst' ? (p.sex === 'f' ? 0 : 1) : 0;
    const order = (ids) => [...ids].sort((a, b) => {
      const pa = st.pawns[a], pb = st.pawns[b], s = sexRank(pa) - sexRank(pb);
      if (s) return s;
      if (cu.birthOrder === 'youngest') return pb.born - pa.born;
      if (cu.birthOrder === 'chosen') { const ha = pa.household === hh.id ? 0 : 1, hb = pb.household === hh.id ? 0 : 1; if (ha !== hb) return ha - hb; }
      return pa.born - pb.born;
    });
    // Kinship is fixed during a synchronous round. Chosen order additionally depends on membership:
    // moveTo replaces the source member array and appends at the destination, so check both identity and size.
    const cached = family && family.line === line && (cu.birthOrder !== 'chosen'
      || (family.members === hh.members && family.size === hh.members.length)) ? family : null;
    const out = cached ? cached.out : [], seen = new Set();
    const lineOf = (id, depth) => {
      if (depth > 3) return;
      for (const c of order(childrenOf(st, id))) {
        if (seen.has(c)) continue; seen.add(c);
        if (st.pawns[c].died === null) out.push(c);
        lineOf(c, depth + 1); // a dead child's children stand in their place; a living child's line follows them
      }
    };
    if (!cached) lineOf(line, 0);
    const direct = cached ? cached.direct : new Set(out);
    // Only full rankings need the wider family; ownFirstOf asks just for direct heirs.
    // Then siblings and their lines, then the parents' siblings (cousins) and theirs.
    seen.add(line);
    let anc = line;
    for (let up = 0; !cached && !nested && up < 2; up++) {
      const lp = st.pawns[anc];
      if (lp.father === null && lp.mother === null) break;
      const parent = lp.father !== null ? lp.father : lp.mother;
      for (const s of order(childrenOf(st, parent).filter((q) => q !== anc))) {
        if (seen.has(s)) continue; seen.add(s); if (st.pawns[s].died === null) out.push(s); lineOf(s, 1);
      }
      anc = parent; seen.add(parent);
    }
    if (family && !cached) {
      family.line = line; family.out = out; family.direct = direct; family.members = hh.members; family.size = hh.members.length;
    }
    const ok = out.filter((id) => {
      const p = st.pawns[id];
      if (cu.heirSex === 'sons' && p.sex === 'f') return false;
      if (watch) watch(id);
      const own = holdingOf(st, id); if (own && own !== hh) return false; // already holds a farm
      const sp = spouseOf(st, id); if (sp !== null) { const so = holdingOf(st, sp); if (so && so !== hh) return false; } // lives on a spouse's farm
      return id !== hh.holder;
    });
    if (nested) return ok.filter((id) => direct.has(id));
    if (!ok.length) return ok; // No competing direct claim can change an empty ranking.
    // a relative who is first in line for their own parents' farm steps behind the others here: farms are not
    // combined while someone else in the family can take this one. Direct heirs of this farm keep their place.
    // Only a farm whose line is a candidate's ancestor, at most four generations up (lineOf), can have the candidate first (VB-224).
    const claims = ownFirstSet ? ownFirstSet.filter((e) => e[1] !== hh.id)
      : ownFirstOf(st, hh, [...ancestorsOf(st, ok, 4)].flatMap((id) => householdsOfLine(st, id)));
    if (cu.ownHeir === 'keeps') {
      // nobody steps behind; an heir first in another farm's line too takes the farm with more fields (on a tie, their own
      // parents') and drops the other claim, which passes to the next in that line
      const wins = (id, o) => {
        const n = st.farmsteads[st.households[o].farmstead].fields.length, p = st.pawns[id];
        return n > f.fields.length || (n === f.fields.length && (p.household === o || [p.father, p.mother].includes(st.households[o].holder)));
      };
      return ok.filter((id) => !claims.some((e) => e[0] === id && wins(id, e[1])));
    }
    const ownFirst = new Set(claims.map((e) => e[0]));
    const back = (id) => !direct.has(id) && ownFirst.has(id);
    return [...ok.filter((id) => !back(id)), ...ok.filter(back)];
  }
  // [heir, household id] for the first direct heir of each household other than hh (all households when hh is null). Callers that rank many
  // households while nothing changes compute this once and pass it to heirRanking as ownFirstSet. `among`: only these household ids.
  function ownFirstOf(st, hh = null, among = null) {
    const out = [];
    for (const id of among || st.liveHouseholds) {
      const o = st.households[id];
      if (o !== hh) { const r = heirRanking(st, o, null, true); if (r.length) out.push([r[0], o.id]); }
    }
    return out;
  }
  // A moving-round view, never saved. Watch even rejected candidates: a marriage can change their eligibility.
  // Reverse dependencies include spouses, whose holding can exclude an otherwise eligible heir.
  function roundHeirs(st) {
    const own = new Map(), ranked = new Map(), dependents = new Map(), customs = new Map(), families = new Map();
    const holders = new Map(st.liveHouseholds.map((h) => [h, st.households[h].holder]));
    const custom = (h) => {
      const v = st.farmsteads[st.households[h].farmstead].village;
      if (!customs.has(v)) customs.set(v, practice(st, v));
      return customs.get(v);
    };
    const watch = (h) => (id) => {
      for (const p of [id, spouseOf(st, id)]) {
        if (p === null) continue;
        if (!dependents.has(p)) dependents.set(p, new Set());
        dependents.get(p).add(h);
      }
    };
    const direct = (h) => heirRanking(st, st.households[h], custom(h), true, null, watch(h))[0];
    for (const h of st.liveHouseholds) own.set(h, direct(h));
    let claims = [...own].filter((e) => e[1] !== undefined).map(([h, p]) => [p, h]);
    const rank = (h) => {
      if (!ranked.has(h)) {
        if (!families.has(h)) families.set(h, {});
        ranked.set(h, heirRanking(st, st.households[h], custom(h), false, claims, watch(h), families.get(h)));
      }
      return ranked.get(h);
    };
    const invalidate = (people, households) => {
      const dirty = new Set(households);
      for (const p of people) for (const h of dependents.get(p) || []) dirty.add(h);
      const changed = new Set();
      for (const h of dirty) {
        const before = own.get(h), hh = st.households[h], after = hh.dissolved ? undefined : direct(h);
        own.set(h, after); ranked.delete(h);
        // Propagate only a changed direct claim or holder: a membership change with the same first heir
        // cannot change other farms' competing claims. The 'keeps' tie also reads the competing holder.
        if (before !== after || holders.get(h) !== hh.holder) {
          if (before !== undefined) changed.add(before);
          if (after !== undefined) changed.add(after);
        }
        holders.set(h, hh.holder);
      }
      for (const p of changed) for (const h of dependents.get(p) || []) { ranked.delete(h); dirty.add(h); }
      claims = [...own].filter((e) => e[1] !== undefined).map(([h, p]) => [p, h]);
      return dirty;
    };
    return { rank, invalidate };
  }
  // text: the 'moved' life event, when the caller says more than the farm's name (sim/settle).
  function moveTo(st, id, hhId, text = null) {
    const p = st.pawns[id], old = p.household !== null ? st.households[p.household] : null;
    leaveHousehold(st, id);
    const hh = st.households[hhId]; joinHousehold(st, hh, id, false);
    const a = st.agents[id]; release(st, a); placeAtHome(st, a);
    if (old && old.farmstead !== hh.farmstead) { // on the record as `joined`, beside the event that tells the move itself
      personEvent(st, id, 'moved', text || `Moved to ${st.farmsteads[hh.farmstead].name}`, { ...atHousehold(st, hh), kind: 'joined' }); }
  }
  // reason: 'death', 'marriage', 'retirement', 'married away' (the holder married onto a spouse's farm) or 'claim' (a landless adult takes a
  // farm left with no heir; nobody is owed shares of it).
  function transfer(st, hh, heir, reason) {
    const f = st.farmsteads[hh.farmstead], cu = farmPractice(st, f), old = hh.holder, op = st.pawns[old];
    const hp = st.pawns[heir];
    if (hp.household !== hh.id) {
      const from = hp.household !== null ? st.households[hp.household] : null, sp = spouseOf(st, heir);
      const kids = childrenOf(st, heir).filter((c) => st.pawns[c].alive && st.pawns[c].age < 18 && st.pawns[c].household === hp.household
        && !isHolder(st, c)); // a child who holds a farm of their own stays on it
      moveTo(st, heir, hh.id);
      if (sp !== null && st.pawns[sp].alive && from && st.pawns[sp].household === from.id) moveTo(st, sp, hh.id);
      for (const c of kids) moveTo(st, c, hh.id);
    }
    hh.holder = heir; f.line = heir; noteHolder(st, hh); noteLine(st, f);
    // at a retirement or a holder's death, a share of the old holder's goodwill passes to the new holder (design.md, The gift: Who books)
    if (old !== null && old !== heir && (reason === 'retirement' || reason === 'death')) passGoodwill(st, old, heir, GOODWILL.share);
    if (op && op.alive && op.household === hh.id) {
      op.retired = true; const s = spouseOf(st, old); if (s !== null && st.pawns[s].alive) st.pawns[s].retired = true;
    }
    // shares for the siblings who do not inherit
    if (cu.heirCount !== 'one' && reason !== 'claim') {
      const sibs = siblingsOf(st, heir).filter((q) => st.pawns[q].alive);
      const wt = (q) => (cu.daughterShare === 'half' && st.pawns[q].sex === 'f' ? 1 : 2);
      const value = f.fields.length * SHARES.perField + hh.grain * SHARES.perGrain, total = [...sibs, heir].reduce((s, q) => s + wt(q), 0);
      for (const q of sibs) {
        const reserve = SHARES.reserveBase + hh.members.length * SHARES.reservePerMember; // shares never eat the seed corn or the winter's food
        const due = Math.round((value * wt(q)) / total), paid = Math.min(due, Math.max(0, Math.floor(hh.grain - reserve)));
        Stores.move(st, hh, st.pawns[q], 'grain', paid, { kind: 'share', pawn: q });
        const qh = st.pawns[q].household; // grain short: animals (at their customary worth) go to a sibling's household of their own (VB-140)
        const animals = due > paid && qh !== null ? payInAnimals(st, hh, st.households[qh], due - paid) : 0, owed = due - paid - animals;
        st.pawns[q].owed = (st.pawns[q].owed || 0) + owed; if (owed) st.pawns[q].owedFrom = hh.id; // owedFrom: the farm that pays (sim/cottage)
        if (due) personEvent(st, q, 'share', `Received ${paid} rations${animals ? ` and animals worth ${animals}` : ''} as a share of ${f.name}` +
          `${owed ? `, ${owed} still owed` : ''}${cu.heirCount === 'split' ? ' (splitting land comes in a later batch)' : ''}`,
        { n: paid + animals, ...atHousehold(st, hh) });
      }
    }
    personEvent(st, heir, 'inherited', `Took over ${f.name} (${reason})`, false); // recorded below
    log(st,
      `${fullName(hp)} takes over ${f.name}` +
      `${reason === 'death' ? ` after ${fullName(op)}` : reason === 'marriage' ? ' on marrying' : reason === 'married away' ? ` as ${fullName(op)} marries away`
        : reason === 'claim' ? `, left with no heir when ${fullName(op)} married away` : ' as the old holder retires'}.`,
      { kind: 'inherited', pawn: heir, other: op ? op.id : null, ...atHousehold(st, hh) });
    st.visualDirty = true;
  }
  // The smallest undissolved household of the village, or of the nearest village (by hexSteps between centres) when it has none.
  function serviceHome(st, hh) {
    const village = st.farmsteads[hh.farmstead].village, vOf = (h) => st.farmsteads[h.farmstead].village;
    const open = st.liveHouseholds.map((id) => st.households[id]).filter((h) => !h.dissolved && h.id !== hh.id);
    const smallest = (list) => list.sort((x, y) => x.members.length - y.members.length || x.id - y.id)[0];
    const here = smallest(open.filter((h) => vOf(h) === village));
    if (here) return here.id;
    const c = st.villages[village].center;
    let best = null, bd = Infinity;
    for (const h of open) {
      const d = hexSteps(st.w, c, st.villages[vOf(h)].center);
      if (d < bd) { bd = d; best = vOf(h); }
    }
    const near = smallest(open.filter((h) => vOf(h) === best));
    return near ? near.id : null;
  }
  // A child's nearest grown kin with a household other than hh, by kinship (the oldest on a tie), or null (stability review: an orphan goes to
  // an aunt or a grandparent before going into service).
  function kinHomeFor(st, id, hh) {
    const memo = new Map(); let best = null, bk = 0;
    for (const liveId of st.living) {
      const q = st.pawns[liveId];
      if (!q.alive || q.age < 18 || q.household === null || q.household === hh.id || st.households[q.household].dissolved) continue;
      const k = kinship(st, id, q.id, memo);
      if (k > bk || (k === bk && k > 0 && q.born < best.born)) { best = q; bk = k; }
    }
    return best ? best.household : null;
  }
  // why: the end of the log line ("no heir would take it").
  function extinct(st, hh, why = 'no heir would take it') {
    const f = st.farmsteads[hh.farmstead];
    f.condition = houseCondition(st, f); // the house as it was kept (VB-306)
    f.household = null; f.state = 'derelict'; f.emptySince = st.t;
    abandoned(f);
    hh.dissolved = true; noteDissolved(st, hh); dropPlan(st, 'household', hh.id); Stores.close(st, hh); dropStakes(st, hh); farmToVillage(st, f);
    birthright(st, f, hh.holder); // the old family's claim on the farm for a generation (sim/farmclaims)
    for (const j of [...st.jobs.values()]) if (j.farm === f) dropJob(st, j);
    // anyone left moves in with their nearest kin, or into service elsewhere in the village
    for (const id of [...hh.members]) {
      const p = st.pawns[id]; if (!p.alive) continue;
      const near = kinNear(st, id).map((q) => st.pawns[q])
        .find((q) => q.alive && q.household !== null && !st.households[q.household].dissolved && q.household !== hh.id);
      const kinHome = near ? near.household : p.age < 18 ? kinHomeFor(st, id, hh) : null;
      const target = kinHome !== null ? kinHome : serviceHome(st, hh);
      if (target !== null) {
        moveTo(st, id, target);
        if (kinHome === null) {
          setServant(st, id, true);
          personEvent(st, id, 'service', `Went into service at ${st.farmsteads[st.households[target].farmstead].name}`, false); // recorded below
          log(st, `${fullName(p)} goes into service at ${st.farmsteads[st.households[target].farmstead].name}.`, {
            kind: 'service', pawn: id, ...atHousehold(st, st.households[target]) });
        }
      }
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
    const w = st.pawns[ward], adults = hh.members.map((q) => st.pawns[q]).filter((q) => q.alive && q.age >= 18 && q.id !== ward);
    const parent = adults.filter((q) => q.id === w.father || q.id === w.mother).sort((x, y) => x.born - y.born)[0];
    if (parent) return parent.id;
    const memo = new Map(), kin = (q) => kinship(st, ward, q.id, memo);
    const best = adults.filter((q) => kin(q) > 0).sort((x, y) => kin(y) - kin(x) || x.born - y.born)[0] || adults.sort((x, y) => x.born - y.born)[0];
    return best ? best.id : null;
  }
  function setGuardian(st, hh, ward) { hh.guardian = guardianOf(st, hh, ward); hh.ward = ward; }
  // Daily: a ward who has turned 18 needs no guardian; a ward who holds the farm takes charge of it.
  function comeOfAge(st) {
    for (const liveId of st.liveHouseholds) {
      const hh = st.households[liveId];
      if (hh.dissolved || hh.guardian === undefined || hh.guardian === null) continue;
      const ward = st.pawns[hh.ward];
      if (ward.alive && ward.age < 18) continue;
      hh.guardian = null;
      if (ward.alive && hh.holder === ward.id) personEvent(st, ward.id, 'inherited', `Came of age and took charge of ${st.farmsteads[hh.farmstead].name}`,
        atHousehold(st, hh));
    }
  }
  // The heir who takes the farm: the first in line, but when no adult is left in the house to be a minor's guardian (other than `leaving`),
  // the first adult in line, if there is one (stability review): a child does not keep a farm alone.
  function heirFor(st, hh, ranking, leaving = null) {
    if (!ranking.length) return null;
    const grown = hh.members.some((id) => id !== leaving && id !== hh.holder && st.pawns[id].alive && st.pawns[id].age >= 18);
    if (grown || st.pawns[ranking[0]].age >= 18) return ranking[0];
    const adultHeir = ranking.find((id) => st.pawns[id].age >= 18);
    return adultHeir !== undefined ? adultHeir : ranking[0];
  }
  function succession(st, hh, reason) {
    const f = st.farmsteads[hh.farmstead], cu = farmPractice(st, f), dead = st.pawns[hh.holder];
    const sp = spouseOf(st, dead.id, dead.died - 0.01);
    const spouse = sp !== null && st.pawns[sp].alive && st.pawns[sp].household === hh.id ? sp : null;
    const ranking = heirRanking(st, hh, cu), heir = heirFor(st, hh, ranking, dead.id);
    if (spouse !== null && (cu.widow === 'life' || cu.widow === 'outright' || heir === null || st.pawns[heir].age < 18)) {
      hh.holder = spouse; noteHolder(st, hh); if (cu.widow === 'outright') { f.line = spouse; noteLine(st, f); }
      passGoodwill(st, dead.id, spouse, GOODWILL.share); // the widow takes over as at any holder's death
      if (heir !== null && st.pawns[heir].age < 18) setGuardian(st, hh, heir);
      // under "a right to her keep" the spouse holds only for a minor heir, or, with no heir at all, as the one left on the farm
      const how = cu.widow === 'outright' ? 'outright' : cu.widow === 'life' ? 'for life'
        : heir !== null ? `as guardian for ${fullName(st.pawns[heir])}` : 'with no heir';
      const until = cu.widow === 'life' ? ' for life' : cu.widow === 'outright' ? ' as her own'
        : heir !== null ? ' until the heir comes of age' : ', having no heir';
      personEvent(st, spouse, 'inherited', `Holds ${f.name} ${how}`, false); // recorded below
      log(st, `${fullName(st.pawns[spouse])} keeps ${f.name}${until}.`, { kind: 'inherited', pawn: spouse, ...atHousehold(st, hh) });
      st.visualDirty = true;
      return;
    }
    if (heir === null) { extinct(st, hh); return; }
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
    const ranking = heirRanking(st, hh), heir = heirFor(st, hh, ranking, giver);
    const keeps = heir !== null && (st.pawns[heir].age >= 18 || hh.members.some((id) => id !== giver && st.pawns[id].alive && st.pawns[id].age >= 18));
    const v = st.farmsteads[hh.farmstead].village, at = (id) => st.pawns[id];
    const claim = keeps ? undefined : st.demand.filter((id) => {
      const q = at(id), sp = spouseOf(st, id);
      return q.alive && q.age >= 18 && q.household !== null && q.household !== hh.id && st.farmsteads[st.households[q.household].farmstead].village === v
        && !isHolder(st, id) && (sp === null || !isHolder(st, sp)) && !st.liveHouseholds.some((hid) => st.households[hid].guardian === id)
        && (wishOf(st, id, 'claim') ?? hh.farmstead) === hh.farmstead; // the player's wish: no farm, or only the one it names (VB-212)
    }).sort((a, b) => (at(b).landWait || 0) - (at(a).landWait || 0) || at(a).born - at(b).born || a - b)[0];
    const stays = keeps || (claim === undefined && heir !== null) ? heir : null;
    for (const c of childrenOf(st, giver)) {
      const k = st.pawns[c];
      if (c !== stays && k.alive && k.age < 18 && k.household === hh.id && !isHolder(st, c)) moveTo(st, c, home);
    }
    if (st.pawns[giver].household === hh.id) moveTo(st, giver, home);
    if (stays !== null) { if (st.pawns[stays].age < 18) setGuardian(st, hh, stays); transfer(st, hh, stays, 'married away'); return; }
    if (claim !== undefined) {
      transfer(st, hh, claim, 'claim');
      const sp = spouseOf(st, claim); st.demand = st.demand.filter((id) => id !== claim && id !== sp);
      return;
    }
    const to = st.households[home];
    Stores.move(st, hh, to, 'grain', hh.grain, 'handingOn'); passHerds(st, hh, home);
    extinct(st, hh, `${fullName(st.pawns[giver])} married away, and nobody would take it`);
  }
  function refreshRoles(st) {
    for (const liveId of st.living) {
      const p = st.pawns[liveId];
      if (p.died !== null) continue;
      const hh = p.household !== null ? st.households[p.household] : null, a = age(st, p);
      if (!hh) { p.role = a < 14 ? 'child' : 'farmhand'; continue; }
      const sp = spouseOf(st, p.id);
      if (hh.holder === p.id) p.role = 'farmer';
      else if (sp !== null && sp === hh.holder) p.role = p.sex === 'f' ? 'wife' : 'farmer';
      else if (p.retired) p.role = 'retired';
      else if (a < 14) p.role = 'child';
      else if (p.servant) p.role = p.sex === 'm' ? 'farmhand' : 'maid';
      else p.role = p.sex === 'm' ? 'son' : 'daughter';
    }
  }
  function placeIfMarried(st, id, own = null, rank = null) {
    const p = st.pawns[id], hh = p.household !== null ? st.households[p.household] : null;
    if (!hh || hh.dissolved) return null;
    if (hh.holder === id) return hh.id;
    return (rank ? rank(hh.id) : heirRanking(st, hh, null, false, own))[0] === id ? hh.id : null;
  }
  // The first heir of each farm; wantsOut takes it so that counting all pawns ranks each household once, not once per pawn.
  function firstHeirs(st, own = ownFirstOf(st)) {
    const out = new Set();
    for (const id of st.liveHouseholds) {
      const first = heirRanking(st, st.households[id], null, false, own)[0]; if (first !== undefined) out.add(first);
    }
    return out;
  }
  // Why p does not want to move out, or null when it does. own: ownFirstOf(st), when the caller asks for many pawns while nothing changes.
  function staysWhy(st, p, heirs = null, own = null, rank = null, wish = wishOf(st, p.id, 'out')) {
    if (!p.alive || p.age < 18 || p.retired) return p.retired ? 'retired' : 'under 18';
    const sp = spouseOf(st, p.id); if (isHolder(st, p.id) || (sp !== null && isHolder(st, sp))) return 'holds a farm, or is married to its holder';
    if (wish !== true && placeIfMarried(st, p.id, own, rank) !== null) return 'heir to the farm at home';
    if (claimOf(st, p.id)) return 'restoring a farm it claimed'; // (sim/farmclaims)
    if (wish !== null) return wish ? null : 'its player wishes it to stay'; // an heir's wait is the pawn's wish: the player's stands in (VB-212)
    if (heirs) { if (heirs.has(p.id)) return 'heir to a farm'; } // heir somewhere else
    else for (const id of st.liveHouseholds) if (heirRanking(st, st.households[id])[0] === p.id) return 'heir to a farm';
    return null;
  }
  const wantsOut = (st, p, heirs = null, own = null, rank = null) => staysWhy(st, p, heirs, own, rank) === null;
  // st.demand: the living pawns who want to move out (landless adults with no prospect of a farm), in id order
  function countDemand(st, rank = null) {
    const own = rank ? null : ownFirstOf(st);
    const heirs = rank ? new Set(st.liveHouseholds.map((id) => rank(id)[0])) : firstHeirs(st, own);
    st.demand = st.living.filter((id) => wantsOut(st, st.pawns[id], heirs, own, rank));
  }
  return {
    heirRanking, moveTo, transfer, extinct, succession, comeOfAge, refreshRoles, placeIfMarried, wantsOut, staysWhy, countDemand, firstHeirs, ownFirstOf,
    setGuardian, handOn, heirFor, roundHeirs,
  };
})();
