// @sys sim/stakes: a household's stake on the tile of its new field or meadow (VB-158): staked when the project starts, renewed by its work,
// the household's own once made; it lapses unworked, goes with a household that dissolves, and a weakened stake may be contested by custom;
// a stake lost is told to the project plans (sim/projects) by the event rightLost
VB['sim/stakes'] = (() => {
  const { CLAIMS } = VB['sim/rules'];
  const CL = VB['sim/claims'];
  const { isOutland } = VB['sim/territory'];
  const { log, practice, atFarm } = VB['sim/records'];
  const { emit } = VB['sim/events'];
  // Claims review, Decided 1 Nov: a project stakes an unrealised claim on its tile instead of owning it; breaking the ground (or finishing the
  // meadow) makes it the household's. Other households take in no staked tile (sim/territory, freeFor). The work renews the claim (the job
  // kinds' `worked`, sim/kinds), so a stake weakens only while its project stands still.
  const HH = (id) => ({ type: 'household', id });
  const STAKE = new Set(['field', 'meadow']);
  const stake = (st, hh, tile, why) => CL.addClaim(st, tile, HH(hh.id), why);
  const realiseStake = (st, hh, tile) => CL.realise(st, tile, HH(hh.id));
  // The stake on tile t that a household hid of village vid could contest, or null: t is wilderness or vid's outland, staked for a field or
  // meadow by one other household of vid, whose claim has fallen below CLAIMS.contestBelow (about 18 months unworked); no claim but vid's own
  // besides.
  function contestable(st, t, vid, hid) {
    if (st.owner[t] !== 0 && !isOutland(st, t, vid)) return null;
    let found = null;
    for (const c of CL.claimsOn(st, t)) {
      if (c.by.type === 'village' && c.by.id === vid) continue;
      if (found || c.by.type !== 'household' || c.by.id === hid || !STAKE.has(c.why)) return null;
      const h = st.households[c.by.id];
      if (h.dissolved || st.farmsteads[h.farmstead].village !== vid || CL.strength(st, c) >= CLAIMS.contestBelow) return null;
      found = c;
    }
    return found;
  }
  const RULE_WORD = { first: 'by the first claim', strongest: 'by the strongest claim', kin: 'as kin of the last holder',
    meeting: 'by the voices at the meeting' };
  // Household hh of farm f, with no free tile within reach, contests the weakened stake on `tile`: the village's Disputed claims practice
  // settles it at once, the stake's older claim against hh's fresh one. Under `first` the stake stands; under `kin` too, as nobody held the
  // tile before; under `strongest` hh's fresh claim wins; under `meeting` the better supported. If hh wins, the stake is dropped and its
  // project ends; its holder remembers hh's ("Took our claim"), its household leans to the rules that would have let it keep the tile, and
  // the log tells it. True when hh may stake the tile.
  function contest(st, f, hh, tile, why) {
    const old = contestable(st, tile, f.village, hh.id);
    if (!old) return false;
    const mine = { by: HH(hh.id), state: 'unrealised', why, since: st.t, renewed: st.t, seq: st.claimSeq + 1, until: null };
    const rule = practice(st, f.village).dispute, ctx = { village: f.village }, claims = [old, mine];
    if (CL.settle(st, claims, rule, ctx) !== mine) return false;
    const loser = st.households[old.by.id], lf = st.farmsteads[loser.farmstead];
    CL.aggrieve(st, claims, mine, ctx);
    CL.dropClaim(st, tile, old.by);
    // the loser's project on the tile is reviewed at once and dropped (sim/projects; told below); its job goes at the next posting (sim/jobs)
    emit(st, 'rightLost', { type: 'household', id: loser.id, tile, told: true });
    if (st.pawns[loser.holder].alive && st.pawns[hh.holder].alive) emit(st, 'claimTaken', { loser: loser.holder, taker: hh.holder });
    log(st, `${f.name} takes the ${old.why === 'meadow' ? 'meadow' : 'field'} ${lf.name} staked and left unworked, ${RULE_WORD[rule]}.`, {
      kind: 'stake', pawn: hh.holder, other: loser.holder, ...atFarm(f) });
    return true;
  }
  // Once a day, after sim/claims' lapseClaims: a stake that lapsed (CLAIMS.years unworked) ends its household's project on the tile (sim/projects
  // reviews it at once), and the log tells it.
  function lapsedStakes(st, dropped) {
    for (const [tile, c] of dropped) {
      if (c.by.type !== 'household' || !STAKE.has(c.why)) continue;
      const f = st.farmsteads[st.households[c.by.id].farmstead];
      emit(st, 'rightLost', { type: 'household', id: c.by.id, tile, text: `${f.name} gives up its stake: the new `
        + `${c.why === 'meadow' ? 'hay meadow' : 'field'} lay unworked for ${CLAIMS.years} years.`, at: { kind: 'stakeLapsed', ...atFarm(f) } });
    }
  }
  // A household that dissolves drops its stakes, and every other claim it holds; its projects end with it (sim/plans drops them first).
  function dropStakes(st, hh) {
    CL.dropAllOf(st, HH(hh.id));
    emit(st, 'rightLost', { type: 'household', id: hh.id, tile: -1, told: true });
  }
  return { STAKE, stake, realiseStake, contestable, contest, lapsedStakes, dropStakes };
})();
