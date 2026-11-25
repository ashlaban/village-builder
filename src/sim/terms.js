// @sys sim/terms: a marriage's terms (VB-276; design.md, Marriage as a negotiation: Terms): the dowry (hemföljd) the bride's house gives
//   the couple's home, an advance on her share of its estate, and the morning gift (morgongåva) the groom's side books to her, hers if she
//   is widowed; both in customary worth (sim/norms), valued once when a match is offered, the dowry led and laid at the close
// @state pawn.advance: absent, or {household, n}: the dowry a woman was given by household `household`, in rations of customary worth;
//   subtracted from her share when that household's estate is next divided (sim/heirs transfer: advanceOf, settleAdvance), then gone
// @state pawn.morningGift: absent, or the rations of customary worth booked to a wife at her marriage (from the groom's side)
// @state pawn.dower: absent, or {household, n}: a widow's morning gift, hers, owed by the household `household` she was widowed in:
//   counted out of the division at her husband's death (sim/heirs transfer, dowerOf), paid to the household she moves to from that one
//   (what it cannot pay above its reserve lapses), paid to her in grain if it dissolves first (dissolving), and ended by her death
VB['sim/terms'] = (() => {
  const Norms = VB['sim/norms'];
  const Stores = VB['sim/stores'];
  const { herdsOf } = VB['sim/herds'];
  const { payInAnimals } = VB['sim/droving'];
  const { SHARES } = VB['sim/rules'];
  const { fieldsOwned } = VB['sim/ownership'];
  const { emit, on } = VB['sim/events'];
  const { spouseOf, childrenOf, farmPractice, personEvent, fullName, holdingOf, atHousehold } = VB['sim/records'];
  // @tunable TERMS: a marriage's terms (VB-276; VB-233's proposals, inside Kim's answer of 9 November): the dowry is dowryShare of the
  // bride's share of her house's movable worth; the morning gift the lesser of giftCap (a cow's customary worth) and giftShare of the
  // groom's house's movable worth; an unplayed spokesman says yes to terms within `within` times the defaults, give or take `slack` rations
  const TERMS = Object.freeze({
    dowryShare: 0.5,
    giftCap: Norms.norm('worth', 'cattle/cow'),
    giftShare: 0.1,
    within: Object.freeze([0.5, 2]),
    slack: 1,
  });
  const KEYS = ['dowry', 'gift'];
  const live = (st, id) => Number.isInteger(id) && !!st.households[id] && !st.households[id].dissolved;
  // ---- the valuation: one a household (VB.count.termsValued) ----
  // Household hh's estate as its inheritance divides it (sim/heirs transfer; one reckoning, VB-276): the fields it owns (sim/ownership,
  // VB-311) and its grain at SHARES' rates, less `less` (a widow's dower), never below nothing
  function estateWorth(st, hh, less = 0) {
    VB.count.termsValued++;
    return Math.max(0, fieldsOwned(st, hh.id) * SHARES.perField + Stores.grainOf(hh) * SHARES.perGrain - less);
  }
  // An heir's weight in a division under custom cu: a daughter's half where the custom halves it
  const shareWeight = (st, cu, q) => (cu.daughterShare === 'half' && st.pawns[q].sex === 'f' ? 1 : 2);
  // Household hh's movable worth in rations of customary worth: its grain (rations are the unit of account) and its livestock by kind
  // (a calf, with no worth in the table, counts nothing), the two a dowry is paid in. Reads only.
  function movableWorth(st, hh) {
    VB.count.termsValued++;
    if (!hh || hh.dissolved) return 0;
    let n = Stores.grainOf(hh);
    for (const hd of herdsOf(st, hh))
      if (hd.species === 'cattle') for (const h of hd.head) n += Norms.norm('worth', 'cattle/' + h.kind) || 0;
      else if (hd.species === 'sheep') n += (hd.ewes + hd.rams + hd.lambs) * Norms.norm('worth', 'sheep');
    return n;
  }
  // The household pawn id lives in as a son or daughter of the house (a child of its holder, the holder's spouse or the holder's parent;
  // not in service, not its holder), or null: the house that gives her dowry (sim/records spokesmanOf's rule, whoever makes the match)
  function houseOf(st, id) {
    const p = st.pawns[id];
    if (p.household === null || p.servant || !live(st, p.household)) return null;
    const hh = st.households[p.household],
      h = hh.holder;
    if (h === null || h === id) return null;
    const hp = st.pawns[h],
      sp = spouseOf(st, h),
      of = (q) => q !== null && q !== undefined && (q === h || q === sp || q === hp.father || q === hp.mother);
    return of(p.father) || of(p.mother) ? hh : null;
  }
  // Pawn id's share of household hh's estate as its inheritance custom would divide it today (sim/heirs transfer: estateWorth, shareWeight)
  // among the holder's living children (and id), nothing where one heir takes all
  function shareOf(st, hh, id) {
    const cu = farmPractice(st, st.farmsteads[hh.farmstead]);
    if (cu.heirCount === 'one') return 0;
    const kids = new Set(childrenOf(st, hh.holder).filter((q) => st.pawns[q].alive));
    kids.add(id);
    let total = 0;
    for (const q of kids) total += shareWeight(st, cu, q);
    return Math.round(
      (estateWorth(st, hh, dowerOf(st, spouseOf(st, hh.holder), hh)) * shareWeight(st, cu, id)) / total,
    );
  }
  // The default terms of a match of man and woman to live in household `home`: {dowry, gift}, whole rations of customary worth. The
  // dowry is given by her house, none where she has none or it is the home itself; the gift is booked by his (his house, the household he
  // holds, else the home).
  function defaults(st, man, woman, home) {
    const from = houseOf(st, woman),
      dowry = from && from.id !== home ? shareOf(st, from, woman) * TERMS.dowryShare : 0,
      his = houseOf(st, man) || holdingOf(st, man) || (live(st, home) ? st.households[home] : null),
      gift = his ? Math.min(TERMS.giftCap, movableWorth(st, his) * TERMS.giftShare) : 0;
    return { dowry: Math.round(dowry), gift: Math.round(gift) };
  }
  // The terms of match offer o (its man, woman, home and asker read), `set` the asking side's own terms ({dowry} where the woman's side asks,
  // {gift} where the man's does; the played spokesman's): {terms, norms (the defaults, only where the terms differ from them)}, or why not
  function termsFor(st, o, set) {
    const why = setWhy(o, set);
    if (why) return why;
    const d = defaults(st, o.gives.man, o.wants.woman, o.gives.home);
    const k = o.asker === 'woman' ? 'dowry' : 'gift',
      v = set === undefined || set === null ? undefined : set[k];
    if (v === undefined) return { terms: d };
    const t = { ...d, [k]: Math.round(v) };
    return t[k] === d[k] ? { terms: d } : { terms: t, norms: d };
  }
  // Why `set` is not terms the asking side of offer o may set, or null; values nothing (the offer's check: sim/marriage matchWhy)
  function setWhy(o, set) {
    if (set === undefined || set === null) return null;
    const k = o.asker === 'woman' ? 'dowry' : 'gift';
    if (typeof set !== 'object' || Object.keys(set).some((x) => x !== k))
      return `the side that asks sets only the ${k === 'dowry' ? 'dowry' : 'morning gift'}`;
    const v = set[k];
    if (v !== undefined && !(Number.isFinite(v) && v >= 0))
      return `a ${k === 'dowry' ? 'dowry' : 'morning gift'} cannot be ${v}`;
    return null;
  }
  // Whether offer o's terms are within what an unplayed spokesman accepts: each within TERMS.within times its default
  function fair(o) {
    const t = o.terms,
      n = o.norms || t;
    if (!t) return true;
    return KEYS.every(
      (k) => t[k] >= n[k] * TERMS.within[0] - TERMS.slack && t[k] <= n[k] * TERMS.within[1] + TERMS.slack,
    );
  }
  // ---- what moves, and only by a journey (Kim, 16 November: nothing teleports) ----
  // Household `from` gives household `to` up to n rations of customary worth, from the cells of most worth first (Kim, 16 November,
  // 13.5): an ox, a cow, a heifer, a steer, each left at `from`'s farm until one of `to` leads it home (sim/droving, VB-674: it keeps a
  // cow and its winter's hay); then grain above its reserve (SHARES: the seed corn and the winter's food), laid at `from`'s house and
  // borne or fetched (sim/gifts layStart, VB-675) unless the two share a farmstead; then ewes. Returns the rations given. id: the woman
  // it is hers by (the stores' reason, a share)
  function pay(st, from, to, n, id) {
    let paid = 0;
    for (const kind of ['ox', 'cow', 'heifer', 'steer']) paid += payInAnimals(st, from, to, n - paid, [kind]);
    const reserve = SHARES.reserveBase + from.members.length * SHARES.reservePerMember,
      g = Math.min(Math.floor(n - paid), Math.max(0, Math.floor(Stores.grainOf(from) - reserve)));
    if (g > 0) {
      Stores.move(st, from, to, 'grain', g, { kind: 'share', pawn: id }); // an advance on a share, or a widow's own
      if (from.farmstead !== to.farmstead) emit(st, 'startLaid', { hh: to, piles: [[from.id, g]] });
      paid += g;
    }
    return paid + payInAnimals(st, from, to, n - paid, ['ewe']);
  }
  // ---- the close of a match (sim/marriage settleMatch): the terms `t` of the married match of man and woman, her house before the
  // marriage `fromId` ----
  function settle(st, man, woman, t, fromId) {
    const w = st.pawns[woman],
      to = live(st, w.household) ? st.households[w.household] : null;
    if (t.gift > 0) {
      w.morningGift = (w.morningGift || 0) + t.gift;
      personEvent(st, woman, 'share', `Was given a morning gift worth ${t.gift} by ${fullName(st.pawns[man])}`, {
        n: t.gift,
        other: man,
        ...(to ? atHousehold(st, to) : {}),
      });
    }
    if (!(t.dowry > 0) || !to || !live(st, fromId) || fromId === to.id) return;
    const from = st.households[fromId],
      paid = pay(st, from, to, t.dowry, woman);
    if (!(paid > 0)) return;
    const a = w.advance && w.advance.household === fromId ? w.advance.n : 0;
    w.advance = { household: fromId, n: a + paid };
    const name = st.farmsteads[from.farmstead].name;
    personEvent(
      st,
      woman,
      'share',
      `Was given a dowry worth ${paid} from ${name}${paid < t.dowry ? ` (of ${t.dowry} agreed)` : ''}, an advance on her share`,
      { n: paid, other: from.holder, ...atHousehold(st, to) },
    );
  }
  // ---- the inheritance's reads (sim/heirs transfer) ----
  const advanceOf = (st, id, hh) => {
    const a = st.pawns[id].advance;
    return a && a.household === hh.id ? a.n : 0;
  };
  // The advance of pawn id on household hh is spent: its estate has been divided
  function settleAdvance(st, id, hh) {
    if (advanceOf(st, id, hh) > 0) delete st.pawns[id].advance;
  }
  // The dower widow id is owed by household hh, or 0
  const dowerOf = (st, id, hh) => {
    const d = id === null || id === undefined ? null : st.pawns[id].dower;
    return d && hh && d.household === hh.id ? d.n : 0;
  };
  // A husband's death: his widow's morning gift is hers, owed by the household she is widowed in (before the union ends and the farm is
  // divided). A widow's death ends her dower and a wife's her gift: what was hers lies in her household, which is her estate.
  on('died', (st, e) => {
    const p = st.pawns[e.pawn];
    delete p.dower;
    delete p.morningGift;
    const sp = spouseOf(st, e.pawn),
      w = sp === null ? null : st.pawns[sp];
    if (!w || !w.alive || !(w.morningGift > 0) || !live(st, w.household)) return;
    const hh = st.households[w.household];
    w.dower = { household: hh.id, n: dowerOf(st, sp, hh) + w.morningGift };
    delete w.morningGift;
  });
  // Household hh dissolves (sim/heirs, before its estate is taken): a widow of it holding her dower is paid it in its grain, into her
  // own hands as a share is (what it lacks lapses), before she is placed elsewhere; so no later household owes it
  function dissolving(st, hh) {
    for (const id of hh.members) {
      const p = st.pawns[id],
        n = dowerOf(st, id, hh);
      if (!p.dower) continue;
      delete p.dower;
      const g = Math.min(n, Math.floor(Stores.grainOf(hh)));
      if (!(g > 0)) continue;
      Stores.move(st, hh, p, 'grain', g, { kind: 'share', pawn: id });
      personEvent(
        st,
        id,
        'share',
        `Took her morning gift, ${g} rations${g < n ? ` of ${n}` : ''}, as ${st.farmsteads[hh.farmstead].name} broke up`,
        {
          n: g,
          ...atHousehold(st, hh),
        },
      );
    }
  }
  // A widow who moves to another household takes her dower with her, paid by the one she leaves (after its journey is set out, so that
  // she bears what is laid: sim/journeys subscribes first)
  on('rehoused', (st, e) => {
    const p = st.pawns[e.a.id],
      n = e.old ? dowerOf(st, p.id, e.old) : 0;
    if (!(n > 0) || e.old.dissolved || e.old === e.hh || e.hh.dissolved) return;
    delete p.dower;
    const paid = pay(st, e.old, e.hh, n, p.id);
    if (paid > 0)
      personEvent(
        st,
        p.id,
        'share',
        `Took her morning gift, worth ${paid}${paid < n ? ` of ${n}` : ''}, from ${st.farmsteads[e.old.farmstead].name}`,
        { n: paid, ...atHousehold(st, e.hh) },
      );
  });
  return {
    TERMS,
    movableWorth,
    estateWorth,
    shareWeight,
    dissolving,
    defaults,
    termsFor,
    setWhy,
    fair,
    settle,
    advanceOf,
    settleAdvance,
    dowerOf,
  };
})();
