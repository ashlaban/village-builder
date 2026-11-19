// @sys sim/preview: what a yes to an open offer would bring (VB-1100; design.md, Marriage as a negotiation, The player's doors): the
//   offer is settled on a copy of the state by its basis's own rules (sim/offers' answer, the match's marry and handOn, sim/heirs, the
//   next day's care for a farm left with no grown member, sim/service and sim/trust), and the copy is read against the state: who moves,
//   each farm's holder after, the first heir of the home and its food. Read when the page shows an offer, never in a step; writes
//   nothing to st. The estimate is the viewer's (principle 14); its actor view filters nothing yet, so it equals the outcome.
VB['sim/preview'] = (() => {
  const { ECON } = VB['sim/rules'];
  const { holdingOf, childrenOf } = VB['sim/records'];
  const { issue } = VB['sim/commands'];
  const { heirRanking, ownFirstOf, refreshRoles } = VB['sim/heirs'];
  const { trustOf } = VB['sim/ownership'];
  const { careForOrphans } = VB['sim/service'];
  const { seedReserve, larderOf } = VB['sim/hunger'];
  const { grainOf } = VB['sim/stores'];
  // Household hh's food in days of need: grain above the seed set aside, meals and the larder, over a day's rations of its living
  // members; null with nobody to feed. (The page's farm and the offer read this one measure.)
  function foodDays(st, hh) {
    let need = 0;
    for (const m of hh.members) {
      const q = st.pawns[m];
      if (q.died === null) need += q.age >= 14 ? ECON.ration.adult : ECON.ration.child;
    }
    const food = Math.max(0, grainOf(hh) - seedReserve(st, hh)) + hh.meals + larderOf(hh);
    return need > 0 ? Math.floor(food / need) : null;
  }
  // The pawns whose future offer o settles (a match's two; else the one who offers and the one asked), and the household it settles
  // at (a match's home, a handover's holding, else the one asked's household)
  const peopleOf = (o) =>
    o.basis === 'match' ? [o.gives.man, o.wants.woman] : [o.from, o.to].filter((id) => Number.isInteger(id));
  function homeOf(st, o) {
    if (o.gives && Number.isInteger(o.gives.home)) return o.gives.home;
    if (o.gives && Number.isInteger(o.gives.household)) return o.gives.household;
    const to = Number.isInteger(o.to) ? st.pawns[o.to] : null;
    return to ? to.household : null;
  }
  // A copy of st to settle on: the world is shared (play does not change it, and the route caches key on it), all else copied.
  function copyOf(st) {
    const { w, ...rest } = st;
    return { ...structuredClone(rest), w };
  }
  // A farm as the copy leaves it: {household, holder (null when none), trustee (the household that holds it in trust, else null),
  // guardian (of a ward holder, else null), empty (nobody keeps it: the household is dissolved)}
  function farmAfter(c, id) {
    const hh = c.households[id];
    if (hh.dissolved) return { household: id, holder: null, trustee: null, guardian: null, empty: true };
    const t = trustOf(c, id);
    return {
      household: id,
      holder: hh.holder,
      trustee: t ? t.trustee : null,
      guardian: hh.ward === hh.holder && hh.holder !== null ? (hh.guardian ?? null) : null,
      empty: false,
    };
  }
  // What a yes to the open offer `offerId` would bring, as `viewer` estimates it (principle 14), or null when there is no such offer:
  // {offer, by (the viewer), home (the household it settles at), lapses (why the settling would fail, else null), moves [{pawn, from, to
  // (household ids, null for none), as ('spouse', 'child', 'ward' or 'kin')}], farms [{household, before (its holder now), holder,
  // trustee, guardian, empty}] (each farm the people hold or are first heir to, and the home), heir {before, after} (the home's first
  // heir, or null), food {before, after} (the home's food in days of need; foodDays)}. One copy of the state; reads st only.
  function offerPreview(st, offerId, viewer = null) {
    const o = st.offers.find((x) => x.id === offerId);
    if (!o) return null;
    const people = peopleOf(o),
      homeId = homeOf(st, o),
      own = ownFirstOf(st);
    // the farms: those the people hold, the home, and those they are first heir to (one ranking a live household)
    const farms = new Set();
    for (const id of people) {
      const h = holdingOf(st, id);
      if (h && !h.dissolved) farms.add(h.id);
    }
    if (homeId !== null && !st.households[homeId].dissolved && st.households[homeId].holder !== null) farms.add(homeId);
    VB.count.previewWalk += st.liveHouseholds.length;
    for (const hid of st.liveHouseholds) {
      const first = heirRanking(st, st.households[hid], null, false, own)[0];
      if (first !== undefined && people.includes(first)) farms.add(hid);
    }
    // those who might move: the people and the members of the households they live in, hold or settle at
    const homes = new Set([...farms]);
    for (const id of people) if (st.pawns[id].household !== null) homes.add(st.pawns[id].household);
    if (homeId !== null) homes.add(homeId);
    const watch = new Set(people);
    for (const h of homes) for (const m of st.households[h].members) watch.add(m);
    // the yes, on the copy: every answer still owed given as yes by its pawn, then the next day's care for a farm left with no grown
    // member (sim/service: a guardian, or kin who hold it in trust), and the roles
    const c = copyOf(st),
      co = c.offers.find((x) => x.id === offerId);
    let lapses = null;
    const mark = c.record.length;
    for (const a of co.answers.slice())
      if (a.yes === null && c.offers.includes(co))
        issue(c, { actor: a.by, verb: 'answer', target: co.id, args: { yes: true }, source: 'preview' });
    const ev = c.record.slice(mark).find((e) => e && e.kind === 'offerLapsed');
    if (ev) lapses = ev.text;
    careForOrphans(c);
    refreshRoles(c);
    const kids = new Set(people.flatMap((id) => childrenOf(st, id))),
      wards = new Set([...homes].map((h) => st.households[h].ward));
    const as = (id) => (people.includes(id) ? 'spouse' : kids.has(id) ? 'child' : wards.has(id) ? 'ward' : 'kin');
    const moves = [];
    for (const id of watch) {
      const a = st.pawns[id],
        b = c.pawns[id];
      if (a.died !== null || b.died !== null || a.household === b.household) continue;
      moves.push({ pawn: id, from: a.household, to: b.household, as: as(id) });
    }
    const heirOf = (s, hid) =>
      hid === null || s.households[hid].dissolved ? null : (heirRanking(s, s.households[hid])[0] ?? null);
    const fed = (s, hid) => (hid === null || s.households[hid].dissolved ? null : foodDays(s, s.households[hid]));
    return {
      offer: o.id,
      by: viewer,
      home: homeId,
      lapses,
      moves,
      farms: [...farms].map((hid) => ({ ...farmAfter(c, hid), before: st.households[hid].holder })),
      heir: { before: heirOf(st, homeId), after: heirOf(c, homeId) },
      food: { before: fed(st, homeId), after: fed(c, homeId) },
    };
  }
  return { offerPreview, foodDays };
})();
