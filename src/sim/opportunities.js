// @sys sim/opportunities: what a pawn may do here, for whom and on what basis, computed when asked and never stored; the actor view (VB-209);
// whom the player may go on as after its pawn's death (VB-213)
VB['sim/opportunities'] = (() => {
  const Culture = VB['culture'];
  const { cal, SERVICE, DAY, YEAR } = VB['sim/rules'];
  const { walkable } = VB['sim/routes'];
  const { villageOf, settlementIdOf, practice, fullName, spouseOf, childrenOf, holdingOf, spokesmanOf } =
    VB['sim/records'];
  const { ASK } = VB['sim/kinds'];
  const { claimable, barred: claimBar } = VB['sim/farmclaims'],
    { onFarm } = VB['sim/projects'];
  const { VERBS } = VB['sim/commands'];
  const { goOnAs } = VB['sim/player'];
  const { advice, what: offerText } = VB['sim/offers'];
  const { relationsOf, opinionWord } = VB['sim/relations'];
  const { SOCIAL } = VB['sim/rules'];
  const { fit, jobsFor } = VB['sim/jobs'];
  const { eligible } = VB['sim/eligibility'];
  const { staysWhy, heirRanking } = VB['sim/heirs'];
  const { matchBar, matchRules, kinOk } = VB['sim/matching'];
  const { visitChoices, visitWhy, sendWhy } = VB['sim/visits'];
  const { wishesOf } = VB['sim/wishes'];
  const { MARRIAGE, MATCH } = VB['sim/rules'],
    HELP_KINDS = MATCH.help.kinds;
  const { unfit, handsLeft } = VB['sim/service'];
  const { ALE_EVENING, RITE } = VB['sim/rules'],
    { hoursBetween } = VB['sim/routes'];
  // What pawn `id` may read of the state. It filters nothing for now: every pawn knows everything (design.md, What a pawn knows). It is
  // the seam: forPawn reads the world only through its view, so what a pawn has not heard can later be left out here.
  const actorView = (st) => st;
  // An opportunity is a command the pawn could be given, with who it would be for and why it may not be taken now:
  //   {verb, target, args, holder ({type: 'household' | 'village', id}, or null for its own acts), basis ('member', 'servant', 'villager',
  //   'helper' or 'self'), fit (the planner's noise-free bid for work, else null), why (null when the command would be accepted now), kind (a job's
  //   kind, for work), site (the tile its work is done on, for work, else absent), when ('now', or 'round': an act the moving round carries
  //   out, by its rules, for a pawn that wishes it; 'winter': a visit, planned now and set out on its winter morning)}.
  const item = (verb, target, args, why, more = {}) => ({
    verb,
    target,
    args,
    holder: null,
    basis: 'self',
    fit: null,
    why,
    kind: null,
    when: 'now',
    ...more,
  });
  // What the verb's own check says of the command, for pawn id.
  const check = (view, id, verb, target, args) =>
    VERBS[verb].check(view, { actor: id, verb, target, args, source: 'player' });

  // ---- work: where each kind is available for its household and its village, matched to the posted job, with the planner's fit ----
  function work(view, p, c, out) {
    const hh = view.households[p.household],
      f = view.farmsteads[hh.farmstead],
      vid = villageOf(view, p),
      a = view.agents[p.id];
    const owners = [
        { type: 'household', id: hh.id },
        { type: 'village', id: vid },
      ],
      seen = new Set(),
      list = [];
    const add = (key, kind, owner, j, site) => {
      const basis = seen.has(key) ? null : eligible(view, j || { owner }, p);
      if (!basis) return;
      seen.add(key);
      const row = j
        ? fit(view, p, j, c)
        : { bid: null, reason: 'not given out yet: work is given out in working hours' };
      const why = j && a.job === j ? 'doing it now' : row.reason || check(view, p.id, 'work', key, null);
      list.push(item('work', key, null, why, { holder: owner, basis, fit: row.bid, kind, site: j ? j.site : site }));
    };
    // as refreshJobs asks the kinds (sim/jobs), for this farm and this village only; `put` posts nothing
    let kind = null,
      own = owners[0];
    const put = (key, site, extra, k = kind, owner = own) => add(key, k, owner, view.jobs.get(key) || null, site);
    const ask = (rules, holder, at, farm) => {
      for (let i = 0; i < rules.length; i++) {
        kind = rules[i][0];
        rules[i][1](view, holder, at, c, put, farm);
      }
    };
    for (const fd of f.fields) {
      const rules = ASK.fieldAt[fd.stage];
      if (rules) ask(rules, hh, fd, f);
    }
    ask(ASK.farm, hh, f, f);
    ask(ASK.farmAfterPlans, hh, f, f);
    own = owners[1];
    ask(ASK.village, view.villages[vid], view.villages[vid]);
    // and the posted jobs of the two that are asked island-wide (a plot's steps, a claimed farm's restoration) or are still being worked
    for (const j of jobsFor(view, p)) add(j.key, j.kind, j.owner, j, j.site);
    // and what the other households of its village offer helpers (VB-106; the planner's helpRound takes it): the jobs of the kinds help takes
    for (const fid of view.villages[vid].farmsteads) {
      const hid = view.farmsteads[fid].household,
        js = hid === null || hid === hh.id ? null : view.jobsBy.get(`household:${hid}`);
      if (js) for (const j of js) if (HELP_KINDS.includes(j.kind)) add(j.key, j.kind, j.owner, j, j.site);
    }
    // those it may take first, best fit first; then the rest, in the order asked
    list.sort(
      (x, y) => (x.why === null ? 0 : 1) - (y.why === null ? 0 : 1) || (y.fit ?? -Infinity) - (x.fit ?? -Infinity),
    );
    for (const o of list) out.push(o);
  }

  // ---- its own acts: go home, idle, and walk to the tile asked about, if the walking rule opens it ----
  function own(view, p, near, out) {
    out.push(
      item(
        'goHome',
        null,
        null,
        view.agents[p.id].inside ? 'at home already' : check(view, p.id, 'goHome', null, null),
      ),
    );
    const until = view.t + 1;
    out.push(item('idle', null, { until }, check(view, p.id, 'idle', null, { until })));
    occasions(view, p, out);
    if (near === null || near === undefined) return;
    const open = Number.isInteger(near) && near >= 0 && near < view.w.N && walkable(view.w)(near);
    out.push(item('walkTo', near, null, open ? check(view, p.id, 'walkTo', near, null) : 'no one can walk there'));
  }

  // ---- handing the farm on (VB-1140): a holder's offer of its holding to the first in its line, for its retirement (the basis `handover`).
  // An item {verb: 'offer', target: the first in line (null if none), args, why (the verb's check, or why not), handover: {first, next}}, each
  // of first and next {id, name, no}: the grown in the line asked, `no` why that pawn would not take it (its own estimate, principle 14). ----
  function handOn(view, p, hh, out) {
    const asked = [];
    heirRanking(view, hh, null, false, null, null, asked);
    const line = asked
        .filter((e) => view.pawns[e.id].age >= 18)
        .map((e) => ({ id: e.id, name: fullName(view.pawns[e.id]), no: e.no })),
      first = line[0] || null,
      next = first && first.no ? line.find((e) => !e.no) || null : null,
      args = { basis: 'handover', gives: { household: hh.id, reason: 'retirement' } };
    out.push(
      item(
        'offer',
        first ? first.id : null,
        args,
        first ? check(view, p.id, 'offer', first.id, args) : 'no heir of age',
        {
          holder: { type: 'household', id: hh.id },
          basis: 'member',
          handover: { first, next },
        },
      ),
    );
  }

  // ---- an ale evening (VB-522): a holder may open its house, for its household; and the ale evenings and rites called within their reach
  // of its village, each an item {verb: 'attend', target: the occasion's id, occasion: {kind, place (the farm's or the village's name)}} ----
  function occasions(view, p, out) {
    if (p.household === null) return;
    const hh = view.households[p.household],
      v = villageOf(view, p);
    if (hh.holder === p.id)
      out.push(
        item('callAle', null, null, check(view, p.id, 'callAle', null, null), {
          holder: { type: 'household', id: hh.id },
          basis: 'member',
        }),
      );
    if (hh.holder === p.id) handOn(view, p, hh, out);
    for (const o of view.occasions) {
      if (o.kind !== 'ale' && o.kind !== 'rite') continue;
      const reach = o.kind === 'ale' ? ALE_EVENING.reach : RITE.reach;
      if (o.village !== v && !(view.villageHours && hoursBetween(view, v, o.village) <= reach)) continue;
      const place = o.farm === null ? view.villages[o.village].name : view.farmsteads[o.farm].name;
      out.push(
        item('attend', o.id, null, check(view, p.id, 'attend', o.id, null), { occasion: { kind: o.kind, place } }),
      );
    }
  }

  // ---- a cause: each custom's options other than its village's practice, and dropping the cause it has ----
  function causes(view, p, out) {
    if (!view.cenv) return;
    const s = view.cenv.settlements[settlementIdOf(view, p)],
      adv = p.advocate || null;
    if (!s) return;
    for (let dim = 0; dim < Culture.DIMS.length; dim++)
      for (let option = 0; option < Culture.NOPT[dim]; option++) {
        if (s.practice[dim] === option) continue;
        const args = { dim, option },
          mine = adv && adv.dim === dim && adv.opt === option;
        out.push(item('argue', null, args, mine ? 'argues for it already' : check(view, p.id, 'argue', null, args)));
      }
    if (adv) out.push(item('dropCause', null, { dim: adv.dim }, null));
  }

  // ---- the moving round's acts: the pawn's wish stands in at the round, which decides by its rules (VB-212) ----
  function round(view, p, out) {
    const vid = villageOf(view, p),
      v = view.villages[vid],
      atRound = { when: 'round' };
    // Heir to a farm? One the round last counted as wanting out (st.demand) was not, and is not asked again: ranking a village's heirs is
    // the costly part (0.6 ms at small-y40). Else the first heirs of its own village's farms are ranked, once, and only if the cheaper
    // bars all pass; an heir to a farm elsewhere is found at the round, which ranks every household.
    let ranked = null;
    const firsts = () => {
      ranked = new Set();
      for (const k of v.farmsteads) {
        const f = view.farmsteads[k],
          hh = f.household === null ? null : view.households[f.household];
        if (hh && !hh.dissolved) {
          const first = heirRanking(view, hh)[0];
          if (first !== undefined) ranked.add(first);
        }
      }
      return ranked;
    };
    const heirs = { has: (id) => !view.demand.includes(id) && (ranked || firsts()).has(id) };
    // The pawn's wish (pawn.wish, sim/wishes; the player's for the played pawn, VB-680): each act's `why` is as the round would decide with
    // it, and for the played pawn `own` says what the pawn would do about moving out with no wish about it.
    const pl = view.player,
      played = !!pl && pl.pawn === p.id,
      wishes = wishesOf(view, p.id);
    const stays = staysWhy(view, p, heirs);
    out.push(
      item('leave', null, null, stays, played ? { ...atRound, own: staysWhy(view, p, heirs, null, null) } : atRound),
    );
    // an empty farm of its village: the round gives it to the first claimant among those who want out
    const bar = stays || claimBar(view, p.id) || (wishes.claim === false ? 'it wishes to claim no farm' : null);
    const other = (f) => (wishes.claim !== null && wishes.claim !== f.id ? 'it wishes for another farm' : null);
    for (const k of v.farmsteads) {
      const f = view.farmsteads[k];
      if (f.household !== null) continue;
      const pj = onFarm(view, f.id),
        why = pj
          ? `${fullName(view.pawns[pj.holder.id])} is restoring it`
          : !claimable(view, f)
            ? 'a ruin, past mending'
            : bar || other(f);
      out.push(item('claim', f.id, null, why || check(view, p.id, 'claim', f.id, null), atRound));
    }
    // service with a holder of its village who lives alone
    const spare =
      stays ||
      unfit(view, p) ||
      (handsLeft(view, p) < SERVICE.keepHands ? 'its household cannot spare its hands' : null) ||
      (wishes.serve === false ? 'it wishes to take no service' : null);
    let lone = 0;
    for (const k of v.farmsteads) {
      const f = view.farmsteads[k],
        hh = f.household === null ? null : view.households[f.household];
      if (!hh || hh.dissolved || hh.members.length !== 1 || hh.id === p.household || view.pawns[hh.holder].age < 18)
        continue;
      lone++;
      out.push(
        item('serve', hh.id, null, spare || check(view, p.id, 'move', hh.id, { reason: 'service' }), {
          ...atRound,
          holder: { type: 'household', id: hh.id },
        }),
      );
    }
    match(view, p, played ? wishes : null, out);
    if (!lone) out.push(item('serve', null, null, spare || 'no holder of the village lives alone', atRound));
  }

  // The wish for a match (VB-274), for the played pawn only, one single enough to marry: an item for each partner it might wish for, {verb:
  // 'match', target: the partner's id (null for the first item, which says the pawn may wish), when: 'round', why: the round's rule that
  // bars the match now or null, partner: {name, age}}: the unmarried of
  // the other sex, of age, whom it knows best by tie, at most MATCH_PARTNERS, and the wished partner whoever it is.
  const MATCH_PARTNERS = 8,
    yearsOld = (view, q) => Math.floor((view.t - q.born) / YEAR);
  function match(view, p, wishes, out) {
    if (
      !wishes ||
      spouseOf(view, p.id) !== null ||
      yearsOld(view, p) < (p.sex === 'm' ? MARRIAGE.menFrom : MARRIAGE.womenFrom)
    )
      return;
    const of = (q) =>
      q.alive &&
      q.sex !== p.sex &&
      spouseOf(view, q.id) === null &&
      yearsOld(view, q) >= (q.sex === 'm' ? MARRIAGE.menFrom : MARRIAGE.womenFrom);
    // Those barred for good by who they are (the retired, kin within the custom's limit) are left out before the best are taken, so the
    // list fills to MATCH_PARTNERS from the next by tie (VB-1110); the custom is the man's village's, as in matchBar.
    const ids = [];
    for (const r of relationsOf(view, p.id)) {
      if (ids.length >= MATCH_PARTNERS) break;
      const q = view.pawns[r.id];
      if (!of(q) || q.retired || p.retired) continue;
      const m = p.sex === 'm' ? p : q;
      if (!kinOk(view, p.id, q.id, practice(view, settlementIdOf(view, m)))) continue;
      ids.push(q.id);
    }
    if (typeof wishes.match === 'number' && !ids.includes(wishes.match)) ids.unshift(wishes.match);
    let rules = null;
    out.push(item('match', null, null, null, { when: 'round' })); // the pawn may wish for a match at all: "not this year", "as it would"
    for (const q of ids) {
      const bar = matchBar(view, p.id, q, rules || (rules = matchRules(view)));
      out.push(
        item('match', q, null, bar.why || null, {
          when: 'round',
          partner: { name: fullName(view.pawns[q]), age: yearsOld(view, view.pawns[q]) },
        }),
      );
    }
  }

  // ---- a winter's visit (VB-292; design.md, Between villages: The player's journey): for the pawn and for each unmarried son or daughter
  // of the house it speaks for, the villages that one might visit (sim/visits visitChoices), nearest first, each an item {verb: 'visit',
  // target: the village, when: 'winter', why: the verb's own check, visit: {who (the pawn who would go), name (null for the pawn itself),
  // place (the village's name), days, rations}}: the days and the pack are the visitor's reckoning (principle 14) ----
  function visits(view, p, out) {
    const hh = view.households[p.household],
      who = [p.id];
    if (hh.holder === p.id) for (const m of hh.members) if (m !== p.id && spokesmanOf(view, m) === p.id) who.push(m);
    for (const id of who)
      for (const c of visitChoices(view, id))
        out.push(
          item(
            'visit',
            c.village,
            null,
            id === p.id ? visitWhy(view, id, c.village) : sendWhy(view, p.id, id, c.village),
            {
              when: 'winter',
              visit: {
                who: id,
                name: id === p.id ? null : fullName(view.pawns[id]),
                place: view.villages[c.village].name,
                days: c.days,
                rations: c.rations,
              },
            },
          ),
        );
  }

  // ---- a call at a farm (VB-1271; the verb `call`, sim/occasions): for an unmarried pawn of age, the farms of other households in the
  // villages within a day's walk, nearest village first, at most CALL_FARMS, each an item {verb: 'call', target: the farm, call: {place
  // (the farm's name), village}}, why the verb's own check ----
  const CALL_FARMS = 8;
  function calls(view, p, out) {
    if (spouseOf(view, p.id) !== null || p.retired || p.servant || !view.villageHours) return;
    const { REACH } = VB['sim/occasions'],
      v = villageOf(view, p),
      near = view.villages
        .map((u) => [u.id, u.id === v ? 0 : hoursBetween(view, v, u.id)])
        .filter((x) => x[1] <= REACH)
        .sort((a, b) => a[1] - b[1] || a[0] - b[0]);
    let n = 0;
    for (const [u] of near)
      for (const k of view.liveHouseholds) {
        const hh = view.households[k];
        if (n >= CALL_FARMS) return;
        if (hh.id === p.household || hh.farmstead === null || view.farmsteads[hh.farmstead].village !== u) continue;
        const why = check(view, p.id, 'call', hh.farmstead, null);
        n++;
        out.push(
          item('call', hh.farmstead, null, why, {
            call: { place: view.farmsteads[hh.farmstead].name, village: view.villages[u].name },
          }),
        );
      }
  }

  // ---- offers that wait for pawn id (VB-273, VB-690): one item for each, {verb: 'answer', target: the offer's id, when: 'offer', offer} ----
  // offer: {id, basis, text (what is offered, a sentence's object), part ('the one to marry', 'head of the household' for `for`, the pawn it
  // speaks for, or 'the one asked'), answers (who has said what so far: [{name, key, yes}]), daysLeft, advice (what the pawn would answer
  // by its own judgement: true, false; principle 14, that pawn's estimate)}, and for a match man, woman ({id, name, age, farm}), home (a
  // household id), farm (its farm's name). The player answers with Sim.answer.
  function offers(st, view, id, out) {
    const who = (i) => ({
      id: i,
      name: fullName(view.pawns[i]),
      age: Math.floor((view.t - view.pawns[i].born) / YEAR),
      farm:
        view.pawns[i].household !== null
          ? view.farmsteads[view.households[view.pawns[i].household].farmstead].name
          : null,
    });
    for (const o of view.offers) {
      const mine = o.answers.find((a) => a.by === id && a.yes === null);
      if (!mine) continue;
      // a spokesman answers for the one its key names; the head of the home a match moves one into (VB-692) is asked, as for any basis
      const match = o.basis === 'match',
        side = match && mine.key.endsWith('Side') ? o.answers.find((a) => a.key === mine.key.slice(0, -4)).by : null,
        offer = {
          id: o.id,
          basis: o.basis,
          text: offerText(st, o),
          part:
            !match || mine.key === 'head'
              ? 'the one asked'
              : side === null
                ? 'the one to marry'
                : 'head of the household',
          for: side,
          answers: o.answers
            .filter((a) => a.yes !== null)
            .map((a) => ({ name: fullName(view.pawns[a.by]), key: a.key, yes: a.yes })),
          daysLeft: Math.max(0, Math.ceil((o.due - view.t) / DAY)),
          advice: advice(st, o, id),
        };
      if (match)
        Object.assign(offer, {
          man: who(o.gives.man),
          woman: who(o.wants.woman),
          home: o.gives.home,
          farm: view.farmsteads[view.households[o.gives.home].farmstead].name,
        });
      out.push(item('answer', o.id, null, null, { when: 'offer', offer }));
    }
  }

  // What pawn `id` may do here (and at tile `near`, if given): its work, its own acts, a cause, and the round's acts; nothing for marriage
  // (Decided, 8 Nov). Read-only: it writes nothing and draws no random number. `view` is actorView's; every read of the world goes through it.
  function forPawn(st, view, id, near = null) {
    const p = view.pawns[id],
      out = [];
    if (!p || p.died !== null || !view.agents[id]) return out;
    const housed = p.household !== null && view.households[p.household] && !view.households[p.household].dissolved;
    if (housed) work(view, p, cal(view.t), out);
    own(view, p, near, out);
    causes(view, p, out);
    offers(st, view, id, out);
    if (housed) round(view, p, out);
    if (housed) visits(view, p, out);
    if (housed) calls(view, p, out);
    return out;
  }

  // ---- a choice the moving round will read (VB-1101), for the skip's stop at the round's eve ----
  // The first thing the played pawn, or a member of its household it answers for as head, may do at the round with its wish or custom
  // letting it: {text, spot (a farm's house tile)} or null. Offers it holds are the skip's own stop. Reads only; writes nothing.
  function roundChoice(st, id) {
    const view = actorView(st),
      p = view.pawns[id],
      hh = p && p.household !== null ? view.households[p.household] : null;
    if (!hh || hh.dissolved) return null;
    const who = hh.holder === id ? hh.members.filter((m) => view.pawns[m].died === null) : [id];
    for (const m of who.slice(0, 8)) {
      const mine = m === id ? 'you' : fullName(view.pawns[m]),
        out = [];
      round(view, view.pawns[m], out);
      for (const o of out) {
        if (o.when !== 'round' || o.why !== null) continue;
        const f = o.verb === 'claim' ? view.farmsteads[o.target] : null;
        if (f) return { text: `${f.name} stands empty: ${mine} may claim it`, spot: null, farm: f.id };
        if (o.verb === 'serve' && o.target !== null)
          return { text: `${mine} may take service in a lone holder's house`, spot: null };
        if (o.verb === 'match' && o.target !== null)
          return { text: `${mine} may wish for a match with ${o.partner.name}`, spot: null };
        if (o.verb === 'leave') return { text: `${mine} may move out, as the custom allows`, spot: null };
      }
    }
    return null;
  }

  // ---- the player's succession (VB-213): whom it may go on as after its pawn's death ----
  const KIN = { reach: 4, bySpouse: 2, spouses: 2 },
    SUCCESSORS_MAX = 40;
  const KIN_WORDS = {
    '0:1': ['son', 'daughter'],
    '0:2': ['grandson', 'granddaughter'],
    '1:0': ['father', 'mother'],
    '2:0': ['grandfather', 'grandmother'],
    '1:1': ['brother', 'sister'],
    '1:2': ['nephew', 'niece'],
    '2:1': ['uncle', 'aunt'],
    '2:2': ['cousin', 'cousin'],
  };
  const sexed = (st, id, pair) => pair[st.pawns[id].sex === 'f' ? 1 : 0];
  // The blood kin of pawn id within civil degree `reach`, living or dead: Map of pawn id -> {deg, word}. Up to its ancestors and down from
  // each of them, so the walk is bounded by the family, not by the island.
  function bloodKin(st, id, reach) {
    const out = new Map(),
      ups = new Map([[id, 0]]);
    for (let g = 1, gen = [id]; g <= reach && gen.length; g++) {
      const next = [];
      for (const x of gen)
        for (const q of [st.pawns[x].father, st.pawns[x].mother])
          if (q !== null && !ups.has(q)) {
            ups.set(q, g);
            next.push(q);
          }
      gen = next;
    }
    const note = (q, up, down) => {
      if (q === id) return false;
      const was = out.get(q);
      if (was && was.deg <= up + down) return false;
      out.set(q, { deg: up + down, word: sexed(st, q, KIN_WORDS[`${up}:${down}`] || ['kin', 'kin']) });
      return true;
    };
    for (const [a, up] of ups) {
      if (up) note(a, up, 0);
      for (let down = 1, gen = [a]; up + down <= reach && gen.length; down++) {
        const next = [];
        for (const x of gen) for (const c of childrenOf(st, x)) if (!ups.has(c) && note(c, up, down)) next.push(c);
        gen = next;
      }
    }
    return out;
  }
  // The living the player may go on as after pawn id, in order and without repeats, each {id, why}: the heirs of the farm it held (who
  // holds it now, then heirRanking); its kin by blood (to first cousins) or marriage (its spouse, the spouse's kin to degree KIN.bySpouse,
  // the spouses of its own kin to degree KIN.spouses), nearest first, of any age; its household; those it thought friends. At most
  // SUCCESSORS_MAX. For the player's dead pawn the farm, the spouse and the friends are those noted at its death (st.player.left); for
  // any other pawn they are read now. Read-only; it walks the pawn's family and household, never the island's pawns or records.
  function successors(st, id) {
    const p = st.pawns[id],
      out = [],
      seen = new Set([id]);
    if (!p) return out;
    const left = st.player && st.player.pawn === id ? st.player.left : null;
    const add = (q, why) => {
      if (!seen.has(q) && st.pawns[q].alive) {
        seen.add(q);
        out.push({ id: q, why });
      }
    };
    const holding = left ? null : holdingOf(st, id),
      held = left ? left.held : holding ? holding.id : null;
    if (held !== null && !st.households[held].dissolved) {
      const hh = st.households[held];
      if (hh.holder !== null) add(hh.holder, 'heir');
      for (const q of heirRanking(st, hh)) add(q, 'heir');
    }
    const sp = left ? left.spouse : spouseOf(st, id),
      kin = [],
      mine = bloodKin(st, id, KIN.reach);
    for (const [q, k] of mine) {
      kin.push({ id: q, deg: k.deg, blood: 0, why: k.word });
      const qs = k.deg <= KIN.spouses ? spouseOf(st, q) : null;
      if (qs !== null && qs !== id && !mine.has(qs))
        kin.push({ id: qs, deg: k.deg, blood: 1, why: `${k.word}'s ${sexed(st, qs, ['husband', 'wife'])}` });
    }
    if (sp !== null) {
      const spouse = sexed(st, sp, ['husband', 'wife']);
      kin.push({ id: sp, deg: 0, blood: 1, why: spouse });
      for (const [q, k] of bloodKin(st, sp, KIN.bySpouse))
        if (!mine.has(q)) kin.push({ id: q, deg: k.deg, blood: 1, why: `${spouse}'s ${k.word}` });
    }
    kin.sort((x, y) => x.deg - y.deg || x.blood - y.blood || st.pawns[x.id].born - st.pawns[y.id].born || x.id - y.id);
    for (const k of kin) add(k.id, k.why);
    const home = p.household !== null ? st.households[p.household] : null;
    if (home && !home.dissolved) for (const q of home.members) add(q, 'household');
    const ties = left
      ? left.ties
      : relationsOf(st, id)
          .filter((r) => r.opinion >= SOCIAL.friend)
          .sort((x, y) => y.opinion - x.opinion || x.id - y.id)
          .map((r) => ({ id: r.id, why: opinionWord(r.opinion) }));
    for (const t of ties) add(t.id, t.why);
    return out.slice(0, SUCCESSORS_MAX);
  }
  // The player goes on as pawn id, after its pawn's death: one of the successors, or, when none of them is alive, any living adult, which
  // is a break in the line. Either is written to the dead pawn's events. True, or why not.
  function succeed(st, id) {
    const pl = st.player;
    if (!pl || !pl.left) return 'the played pawn has not died';
    const q = st.pawns[id],
      list = successors(st, pl.pawn),
      pick = list.find((s) => s.id === id);
    if (!q || !q.alive) return `pawn ${id} is not a living pawn`;
    if (list.length && !pick) return `${fullName(q)} is not among those ${fullName(st.pawns[pl.pawn])} leaves`;
    if (!list.length && q.age < 18) return 'only an adult begins a new line';
    const link = !pick
      ? null
      : pick.why === 'heir'
        ? 'the heir'
        : pick.why === 'household'
          ? 'one of its household'
          : `its ${pick.why}`;
    return goOnAs(
      st,
      id,
      pick
        ? `The player went on as ${link}, ${fullName(q)}`
        : `A break in the line: the player went on as ${fullName(q)}`,
    );
  }
  return { actorView, forPawn, successors, succeed, roundChoice };
})();
