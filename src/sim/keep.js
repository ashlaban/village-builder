// @sys sim/keep [agency]: what the alderman is kept with (VB-463; design.md, Households and other bodies: The alderman's keep): under the village's
// practice `keep`, at each autumn meeting every other farm's household owes the alderman's days of work to the next meeting (sim/levies,
// source 'keep'), or at the moving round sets aside a share of its surplus for him, fetched by a member of his household (the gift's way,
// sim/gifts: nothing is carried but by a pawn). A vacancy, or a new alderman, ends the days owed the one before.
VB['sim/keep'] = (() => {
  const { OFFICE, YEAR, DAY, cal } = VB['sim/rules'];
  const { inForce } = VB['sim/customs'];
  const Obligations = VB['sim/obligations'];
  const { log } = VB['sim/records'];
  const { emit } = VB['sim/events'];
  // @state village.keep: {year, days (owed), grain (set aside), payers (households that owed or gave)}: the keep of the year of `year`, folded
  //   into one yearly line at the next autumn meeting (Rules for cost, 8); absent until the first. Written only here.
  // @notstock village.keep: ledgers and statistics of what moved (sim/stores, sim/hunger)
  // @state village.keepBy: the household id the keep's days are owed to, or null: whom a new alderman or a vacancy ends them for. Written only here.
  // @notstock village.keepBy: ledgers and statistics of what moved (sim/stores, sim/hunger)
  const optOf = (st, vid) => inForce(st, 'keep', vid);
  const bookOf = (st, v) => {
    const y = cal(st.t).year;
    if (!v.keep || v.keep.year !== y) v.keep = { year: y, days: 0, grain: 0, payers: 0 };
    return v.keep;
  };
  // The live households of the village's farms other than the alderman's own.
  function payers(st, v, hhA) {
    const out = [];
    for (const fid of v.farmsteads) {
      const id = st.farmsteads[fid].household;
      if (id === null || id === hhA) continue;
      const hh = st.households[id];
      if (!hh.dissolved) out.push(hh);
    }
    return out;
  }
  const aldermanHousehold = (st, v) =>
    v.alderman === undefined || v.alderman === null ? null : st.pawns[v.alderman].household;
  VB.counter(
    'keepGiven',
    "The alderman's keep: households' shares set aside at a moving round, and days owed at an autumn meeting (sim/keep, VB-463)",
  );
  // At village s's autumn meeting, after its office is filled: the days owed the household before end, and the new ones are owed.
  function meeting(st, s) {
    const v = st.villages[s.id],
      hhA = aldermanHousehold(st, v),
      by = optOf(st, s.id);
    const last = v.keep && v.keep.year < cal(st.t).year ? v.keep : null;
    if (v.keepBy !== undefined && v.keepBy !== null && (v.keepBy !== hhA || by !== 'days'))
      for (const o of Obligations.due(st, { kind: 'household', id: v.keepBy }, 'creditor', 'days'))
        if (o.source === 'keep') Obligations.lapse(st, o.id, 'the alderman is not kept with days any more');
    v.keepBy = by === 'days' ? hhA : null;
    if (last) {
      const given = `${Math.round(last.days)} days of work owed and ${Math.round(last.grain)} rations given`;
      const txt = `The keep of ${s.name}'s alderman last year: ${given}, by ${last.payers} households.`;
      log(st, txt, { kind: 'alderman', village: s.id, pawn: null });
    }
    if (hhA === null || by !== 'days') return;
    const b = bookOf(st, v);
    for (const hh of payers(st, v, hhA)) {
      const live = Obligations.due(st, { kind: 'household', id: hhA }, 'creditor', 'days').some(
        (o) => o.source === 'keep' && o.debtor.id === hh.id,
      );
      if (live) continue;
      // laid by the alderman's household's holder through the verb levy, its days asked season by season (sim/levies, VB-1767)
      const holder = st.households[hhA].holder;
      if (holder === null) continue;
      const done = VB['sim/commands'].issue(st, {
        actor: holder,
        verb: 'levy',
        args: {
          debtor: { kind: 'household', id: hh.id },
          source: 'keep',
          days: OFFICE.keepDays,
          due: st.t + YEAR - DAY,
        }, // to the next autumn's meeting
        source: 'planner',
      });
      if (done !== true) continue;
      b.days += OFFICE.keepDays;
      b.payers++;
      VB.count.keepGiven++;
    }
  }
  // At village v's moving round, under the share: each other household sets aside its share of its surplus for the alderman's household,
  // who fetch it (the verb `give` with the keep's flag: refused where no one of his can fetch it, or it would take the giver below its floor).
  function round(st, v) {
    const vil = st.villages[v];
    if (optOf(st, v) !== 'share') return;
    const hhA = aldermanHousehold(st, vil);
    if (hhA === null) return;
    const { surplus } = VB['sim/help'],
      b = bookOf(st, vil);
    for (const hh of payers(st, vil, hhA)) {
      const n = surplus(st, hh) * OFFICE.keepShare;
      if (n <= 1e-9) continue;
      const done = VB['sim/commands'].issue(st, {
        actor: hh.holder !== null ? hh.holder : { household: hh.id },
        verb: 'give',
        target: hhA,
        args: { good: 'grain', n, keep: true },
        source: 'help',
      });
      if (done !== true) continue;
      b.grain += n;
      emit(st, 'keepGrain', { hh: st.households[hhA], n }); // sim/class: income from others (VB-318)
      b.payers++;
      VB.count.keepGiven++;
    }
  }
  return { meeting, round };
})();
