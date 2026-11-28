// @sys sim/heirland: land split between heirs (VB-034; design.md, Handover and shares: Splitting land; Land and rights: Splitting between
// heirs): at a handover under "land split between heirs" the farm's fields are divided between the heir and the siblings who want land;
// a sibling's fields are split off and owned by it (sim/ownership's titles, basis `inherited`), worked by the old household for half their
// harvest (the obligation `rent`) until the house the village builds by them stands, when its household takes them as its farm's
VB['sim/heirland'] = (() => {
  // The kinds of event it writes on the record (sim/eventkinds, VB-1946).
  VB['sim/eventkinds'].eventKinds('sim/heirland', {
    rent: {}, // half the harvest of an heir's split fields paid to it (VB-034)
  });
  const Own = VB['sim/ownership'];
  const Obligations = VB['sim/obligations'],
    Stores = VB['sim/stores'];
  const { on, emit } = VB['sim/events'];
  const { hexSteps } = VB['sim/hex'];
  const { SHARES, cal } = VB['sim/rules'];
  const { landed } = VB['sim/holding'],
    { passField } = VB['sim/fields'];
  const { hasPlot } = VB['sim/allotment'];
  const { splitSite, startPlot } = VB['sim/expansion'];
  const { personEvent, settlementIdOf, atHousehold } = VB['sim/records'];
  // the share of each harvest of an heir's fields owed it while the old household works them (design.md: half the harvest, Agreed 30 Oct;
  // a tenancy's quarter, VB-316, is the same relation with another share)
  const RENT = 0.5;
  const BASIS = 'inherited';
  // A sibling of the heir wants land of farm f: alive, grown (a child founds no household), without a farm or a plot of its own or its
  // spouse's, and living in the farm's village.
  function wantsLand(st, q, f) {
    const p = st.pawns[q];
    return p.alive && p.age >= 18 && !landed(st, q) && !hasPlot(st, q) && settlementIdOf(st, p) === f.village;
  }
  // The fields each of `parts` ([[pawn id, weight]], the heir first) gets of n, in proportion to the weights by the largest remainders
  // (ties to the earlier); the heir keeps at least 1. A part of 0 gets no land.
  function apportion(n, parts) {
    const W = parts.reduce((s, [, w]) => s + w, 0),
      raw = parts.map(([, w]) => (n * w) / W),
      got = raw.map(Math.floor);
    let left = n - got.reduce((s, k) => s + k, 0);
    const order = raw.map((r, i) => i).sort((a, b) => raw[b] - got[b] - (raw[a] - got[a]) || a - b);
    for (const i of order) if (left-- > 0) got[i]++;
    if (got[0] < 1) {
      let most = 1;
      for (let i = 2; i < got.length; i++) if (got[i] >= got[most]) most = i;
      got[most]--;
      got[0]++;
    }
    return got;
  }
  // At a handover of household hh's farm to `heir` under "split" (sim/heirs transfer): the siblings `sibs` who want land get their parts
  // of the farm's fields not already split off, weighted by wt (daughterShare, sim/terms shareWeight), each part kept together (the field
  // furthest from the house, then those nearest it) and given a house site by them (sim/expansion splitSite); one for whom there is no
  // site, or whose part is no field, takes its share in goods. Returns a Map of sibling to the fields it was given.
  function divide(st, hh, heir, sibs, wt) {
    const f = st.farmsteads[hh.farmstead],
      v = st.villages[f.village],
      given = new Map(),
      want = sibs.filter((q) => wantsLand(st, q, f));
    let pool = f.fields.filter((fd) => !(st.titles && st.titles.has(fd.tile)));
    if (!want.length || pool.length < 2 || !v) return given;
    const parts = [[heir, wt(heir)], ...want.map((q) => [q, wt(q)])],
      got = apportion(pool.length, parts);
    for (let i = 1; i < parts.length; i++) {
      const q = parts[i][0],
        k = got[i];
      if (k < 1) continue;
      const far = [...pool].sort(
        (a, b) => hexSteps(st.w, f.house, b.tile) - hexSteps(st.w, f.house, a.tile) || a.id - b.id,
      )[0];
      const near = pool
        .filter((fd) => fd !== far)
        .sort((a, b) => hexSteps(st.w, far.tile, a.tile) - hexSteps(st.w, far.tile, b.tile) || a.id - b.id);
      const mine = [far, ...near.slice(0, k - 1)];
      const site = splitSite(
        st,
        v,
        mine.map((fd) => fd.tile),
      );
      if (!site) continue;
      pool = pool.filter((fd) => !mine.includes(fd));
      const why = `inherited of ${f.name}`;
      for (const fd of mine) {
        Own.split(st, f, fd, why);
        Own.transfer(st, fd.tile, 'own', { type: 'pawn', id: q }, BASIS, why);
        Own.grant(st, fd.tile, 'use', { type: 'household', id: hh.id }, RENT, why);
      }
      startPlot(st, v, q, null, site);
      given.set(q, mine.length);
      st.farmDirty.add(f.id);
    }
    return given;
  }
  // The rent: a load of sheaves of field fd brought into household hh's barn, on land another owns under a title with a rent, owes that
  // owner its share, an obligation a load (a few a field and year).
  on('sheavesIn', (st, { hh, field, n }) => {
    const t = st.titles && st.titles.size ? st.titles.get(field.tile) : null;
    if (!t || !(t.rent > 0) || (t.owner.type === 'household' && t.owner.id === hh.id)) return;
    Obligations.create(st, {
      kind: 'rent',
      debtor: { kind: 'household', id: hh.id },
      creditor: { kind: t.owner.type, id: t.owner.id },
      owes: { rations: n * t.rent },
    });
  });
  // An heir who dies before its house stands: its fields go back to the farm they were split from (the title ends), and the rent still
  // owed it lapses. (Who inherits an heir's land in turn is not said by design.md: noted, VB-034.)
  on('died', (st, { pawn }) => {
    if (st.titles && st.titles.size)
      for (const [key, t] of [...st.titles])
        if (t.owner.type === 'pawn' && t.owner.id === pawn) {
          Own.end(st, key, 'its owner died');
          st.farmDirty.add(t.farm);
        }
    for (const o of [...Obligations.due(st, { kind: 'pawn', id: pawn }, 'creditor', 'rent')])
      Obligations.lapse(st, o.id, 'the one owed has died');
  });
  // At the moving round: each rent is paid from its debtor's grain above its reserve (the seed and the winter's food), as a share is
  // (sim/cottage payOwed), to the stake of an owner who lives in that household: the grain stays in the barn it lies in (design.md,
  // Nothing teleports). An owner who lives elsewhere (its own house built, or another household) is not paid until a carry brings
  // it: the rest stays owed. A walk over the owners of live rents, by key.
  function payRent(st) {
    if (!st.obligationsBy) return;
    for (const k of Object.keys(st.obligationsBy.creditor)) {
      const [kind, id] = k.split(':');
      for (const o of [...Obligations.due(st, { kind, id: +id }, 'creditor', 'rent')]) {
        const hh = st.households[o.debtor.id];
        if (!hh || hh.dissolved) {
          Obligations.lapse(st, o.id, 'the household that owed it is gone');
          continue;
        }
        const reserve = SHARES.reserveBase + hh.members.length * SHARES.reservePerMember,
          pay = Math.floor(Math.min(Obligations.left(o), Math.max(0, Stores.grainOf(hh) - reserve)));
        if (pay <= 0) continue;
        const p = kind === 'pawn' ? st.pawns[+id] : null;
        if (!p || p.household !== hh.id) continue; // lives elsewhere: its grain is not carried yet
        Obligations.fulfil(st, o.id, pay, { kind: 'rent', pawn: p.id }, { from: hh, to: p, good: 'grain' });
        personEvent(st, p.id, 'rent', `Was paid ${pay} rations, half the harvest of its fields`, {
          n: pay,
          ...atHousehold(st, hh),
        });
      }
    }
  }
  // The fields of split plot `plot` that its holder (plot.to) still owns, as [farm, field] pairs (VB-034).
  function heldOf(st, plot) {
    const out = [];
    for (const tile of plot.split || []) {
      const t = st.titles && st.titles.get(tile);
      if (!t || t.owner.type !== 'pawn' || t.owner.id !== plot.to) continue;
      const from = st.farmsteads[t.farm],
        fd = from.fields.find((x) => x.tile === tile);
      if (fd) out.push([from, fd]);
    }
    return out;
  }
  // The house by an heir's fields stands (sim/cottage finishCottage): the fields its holder owns leave the farm they were split from for
  // farm f, before its household is founded (which then takes their use, sim/membership): their titles end, the old household's work on
  // them stops (a load in hand put down, as at a household's end), and they are f's fields, numbered from 0. Returns how many.
  function settle(st, plot, f) {
    const moved = heldOf(st, plot);
    for (const [from, fd] of moved) {
      emit(st, 'fieldPassing', { field: fd }); // its work stops (sim/agents)
      Own.end(st, fd.tile, 'its owner moved in');
      passField(st, from.id, fd, f.id, cal(st.t));
    }
    return moved.length;
  }
  return { RENT, BASIS, wantsLand, apportion, divide, payRent, heldOf, settle };
})();
