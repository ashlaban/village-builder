// @sys sim/opportunities: what a pawn may do here, for whom and on what basis, computed when asked and never stored; the actor view (VB-209)
VB['sim/opportunities'] = (() => {
  const Culture = VB['culture'];
  const { cal, SERVICE } = VB['sim/rules'];
  const { walkable } = VB['sim/routes'];
  const { villageOf, settlementIdOf, fullName } = VB['sim/records'];
  const { ASK } = VB['sim/kinds'];
  const { claimable, barred: claimBar } = VB['sim/farmclaims'];
  const { VERBS } = VB['sim/commands'];
  const { mayTake, fit, jobsFor } = VB['sim/jobs'];
  const { staysWhy, heirRanking } = VB['sim/heirs'];
  const { unfit, handsLeft } = VB['sim/service'];
  // What pawn `id` may read of the state. It filters nothing for now: every pawn knows everything (design.md, What a pawn knows). It is
  // the seam: forPawn reads the world only through its view, so what a pawn has not heard can later be left out here.
  const actorView = (st) => st;
  // An opportunity is a command the pawn could be given, with who it would be for and why it may not be taken now:
  //   {verb, target, args, holder ({type: 'household' | 'village', id}, or null for its own acts), basis ('member', 'servant', 'villager'
  //   or 'self'), fit (the planner's noise-free bid for work, else null), why (null when the command would be accepted now), kind (a job's
  //   kind, for work), when ('now', or 'round': an act the moving round carries out, by its rules, for a pawn that wishes it)}.
  const item = (verb, target, args, why, more = {}) => ({ verb, target, args, holder: null, basis: 'self', fit: null, why, kind: null, when: 'now', ...more });
  // What the verb's own check says of the command, for pawn id.
  const check = (view, id, verb, target, args) => VERBS[verb].check(view, { actor: id, verb, target, args, source: 'player' });

  // ---- work: where each kind is available for its household and its village, matched to the posted job, with the planner's fit ----
  function work(view, p, c, out) {
    const hh = view.households[p.household], f = view.farmsteads[hh.farmstead], vid = villageOf(view, p), a = view.agents[p.id];
    const owners = [{ type: 'household', id: hh.id }, { type: 'village', id: vid }], seen = new Set(), list = [];
    const add = (key, kind, owner, j) => {
      if (seen.has(key) || !mayTake(view, p, { owner })) return;
      seen.add(key);
      const basis = owner.type === 'village' ? 'villager' : p.servant ? 'servant' : 'member';
      const row = j ? fit(view, p, j, c) : { bid: null, reason: 'not given out yet: work is given out in working hours' };
      const why = j && a.job === j ? 'doing it now' : row.reason || check(view, p.id, 'work', key, null);
      list.push(item('work', key, null, why, { holder: owner, basis, fit: row.bid, kind }));
    };
    // as refreshJobs asks the kinds (sim/jobs), for this farm and this village only; `put` posts nothing
    let kind = null, own = owners[0];
    const put = (key, site, extra, k = kind, owner = own) => add(key, k, owner, view.jobs.get(key) || null);
    const ask = (rules, holder, at, farm) => { for (let i = 0; i < rules.length; i++) { kind = rules[i][0]; rules[i][1](view, holder, at, c, put, farm); } };
    for (const fd of f.fields) { const rules = ASK.fieldAt[fd.stage]; if (rules) ask(rules, hh, fd, f); }
    ask(ASK.farm, hh, f, f); ask(ASK.farmAfterPlans, hh, f, f);
    own = owners[1]; ask(ASK.village, view.villages[vid], view.villages[vid]);
    // and the posted jobs of the two that are asked island-wide (a plot's steps, a claimed farm's restoration) or are still being worked
    for (const j of jobsFor(view, p)) add(j.key, j.kind, j.owner, j);
    // those it may take first, best fit first; then the rest, in the order asked
    list.sort((x, y) => (x.why === null ? 0 : 1) - (y.why === null ? 0 : 1) || (y.fit ?? -Infinity) - (x.fit ?? -Infinity));
    for (const o of list) out.push(o);
  }

  // ---- its own acts: go home, idle, and walk to the tile asked about, if the walking rule opens it ----
  function own(view, p, near, out) {
    out.push(item('goHome', null, null, view.agents[p.id].inside ? 'at home already' : check(view, p.id, 'goHome', null, null)));
    const until = view.t + 1;
    out.push(item('idle', null, { until }, check(view, p.id, 'idle', null, { until })));
    if (near === null || near === undefined) return;
    const open = Number.isInteger(near) && near >= 0 && near < view.w.N && walkable(view.w)(near);
    out.push(item('walkTo', near, null, open ? check(view, p.id, 'walkTo', near, null) : 'no one can walk there'));
  }

  // ---- a cause: each custom's options other than its village's practice, and dropping the cause it has ----
  function causes(view, p, out) {
    if (!view.cenv) return;
    const s = view.cenv.settlements[settlementIdOf(view, p)], adv = p.advocate || null;
    if (!s) return;
    for (let dim = 0; dim < Culture.DIMS.length; dim++) for (let option = 0; option < Culture.NOPT[dim]; option++) {
      if (s.practice[dim] === option) continue;
      const args = { dim, option }, mine = adv && adv.dim === dim && adv.opt === option;
      out.push(item('argue', null, args, mine ? 'argues for it already' : check(view, p.id, 'argue', null, args)));
    }
    if (adv) out.push(item('dropCause', null, { dim: adv.dim }, null));
  }

  // ---- the moving round's acts: the pawn's wish stands in at the round, which decides by its rules (VB-212) ----
  function round(view, p, out) {
    const vid = villageOf(view, p), v = view.villages[vid], atRound = { when: 'round' };
    // Heir to a farm? One the round last counted as wanting out (st.demand) was not, and is not asked again: ranking a village's heirs is
    // the costly part (0.6 ms at small-y40). Else the first heirs of its own village's farms are ranked, once, and only if the cheaper
    // bars all pass; an heir to a farm elsewhere is found at the round, which ranks every household.
    let ranked = null;
    const firsts = () => {
      ranked = new Set();
      for (const k of v.farmsteads) {
        const f = view.farmsteads[k], hh = f.household === null ? null : view.households[f.household];
        if (hh && !hh.dissolved) { const first = heirRanking(view, hh)[0]; if (first !== undefined) ranked.add(first); }
      }
      return ranked;
    };
    const heirs = { has: (id) => !view.demand.includes(id) && (ranked || firsts()).has(id) };
    const stays = staysWhy(view, p, heirs);
    out.push(item('leave', null, null, stays, atRound));
    // an empty farm of its village: the round gives it to the first claimant among those who want out
    const bar = stays || claimBar(view, p.id);
    for (const k of v.farmsteads) {
      const f = view.farmsteads[k];
      if (f.household !== null) continue;
      const why = f.claim ? `${fullName(view.pawns[f.claim.by])} is restoring it` : !claimable(f) ? 'a ruin, past mending' : bar;
      out.push(item('claim', f.id, null, why || check(view, p.id, 'claim', f.id, null), atRound));
    }
    // service with a holder of its village who lives alone
    const spare = stays || unfit(view, p) || (handsLeft(view, p) < SERVICE.keepHands ? 'its household cannot spare its hands' : null);
    let lone = 0;
    for (const k of v.farmsteads) {
      const f = view.farmsteads[k], hh = f.household === null ? null : view.households[f.household];
      if (!hh || hh.dissolved || hh.members.length !== 1 || hh.id === p.household || view.pawns[hh.holder].age < 18) continue;
      lone++;
      out.push(item('serve', hh.id, null, spare || check(view, p.id, 'serve', hh.id, null), { ...atRound, holder: { type: 'household', id: hh.id } }));
    }
    if (!lone) out.push(item('serve', null, null, spare || 'no holder of the village lives alone', atRound));
  }

  // What pawn `id` may do here (and at tile `near`, if given): its work, its own acts, a cause, and the round's acts; nothing for marriage
  // (Decided, 8 Nov). Read-only: it writes nothing and draws no random number. `view` is actorView's; every read of the world goes through it.
  function forPawn(st, view, id, near = null) {
    const p = view.pawns[id], out = [];
    if (!p || p.died !== null || !view.agents[id]) return out;
    const housed = p.household !== null && view.households[p.household] && !view.households[p.household].dissolved;
    if (housed) work(view, p, cal(view.t), out);
    own(view, p, near, out);
    causes(view, p, out);
    if (housed) round(view, p, out);
    return out;
  }
  return { actorView, forPawn };
})();
