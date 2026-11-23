// @sys sim/fair: the fair (VB-302; design.md, The fair: barter between villages): a dealer of each household at a gathering carries its
//   household's margin as a load, swaps it in whole quanta with the dealers it meets there (need accepts, customary worth books the
//   residual as goodwill), and carries what it holds home; the swap (an offer on the basis `swap` of sim/offers, settled by the verb
//   `swap`), the fair's counts and its log line
// @state pawn.load: absent or null, else {household (the household whose goods it carries), until (the game hour the gathering ends:
//   from then the load goes into that household's store once its dealer is home), lots[] ({good, n (units: rations, barrels, hides), parts
//   (grain: rations by crop), until (a larder good's: when it spoils), got (true: taken in a swap, to be passed on)})}: what the pawn
//   carries to exchange. Written only here; plain data, saved with the pawn.
// @state st.fair: absent until the first load, else {loads[] (ids of the pawns with a load, in the order they were loaded), fairs[] (the
//   fairs held this year: {host (village), year, dealers, proposals, deals, worth ({good: rations of customary worth that changed hands}),
//   noChange (refused deals both sides would have taken at a ratio whole quanta cannot make), hard (hard bargains), told (its log line is
//   written)}), goods ({good: {packed, home, laid, lost}}: units packed from the stores, put back, laid where a dealer fell on the road (sim/lying),
//   and lost with it)}.
//   Written only here; plain data, saved.
VB['sim/fair'] = (() => {
  const Goods = VB['sim/goods'],
    Stores = VB['sim/stores'],
    Rules = VB['sim/registry'],
    Norms = VB['sim/norms'];
  const Offers = VB['sim/offers'];
  const { issue, register } = VB['sim/commands'];
  const { needValue, propriety, KEEPING } = VB['sim/exchange'];
  const { book, remember } = VB['sim/relations'];
  const { takeFood, addFood, larderOf } = VB['sim/larder'];
  const { floorOf } = VB['sim/hunger'];
  const { next: rnd } = VB['sim/rng'];
  const { DAY, TRAVEL, GATHERING, cal } = VB['sim/rules'];
  const { log, personEvent, fullName, living, age } = VB['sim/records'];
  const { on } = VB['sim/events'];
  const { bed, travelling, placeOf, tileAt } = VB['sim/pose'];
  const Lying = VB['sim/lying'];
  // The tunables (the agent's starting values; design.md, The fair): the goods a load may hold (animals walk and are not loaded yet);
  // the weight of a lump in rations of a back load (3 sacks or lots, or 2 barrels, a back; a hide is light); the hours of a fair's day in
  // which dealers propose, a slice of them each hour, [from, to); the others it proposes to after its partners; a quantum is packed while
  // giving it up costs its household at most `bring` times its customary worth (its margin), and `room` of the back load is left for
  // what it takes (a sack, or a lot); the played pawn's hours to answer.
  const FAIR = {
    goods: ['grain', 'butter', 'salt meat', 'dried fish', 'tar', 'hide', 'salt'],
    weight: { sack: 10, lot: 10, barrel: 15, hide: 5 },
    hours: [10, 16],
    others: 4,
    bring: 1,
    room: 10,
    answerHours: 1,
  };
  const TOLERANCE = 1e-9;
  const worth = (good) => Norms.norm('worth', good);
  const quantum = (good) => Goods.goodOf(good).quantum;
  const weightOf = (good) => FAIR.weight[Goods.goodOf(good).lump];
  const inLarder = (good) => good !== 'grain' && Goods.goodOf(good).class === 'food';
  const fairOf = (st) => st.fair || (st.fair = { loads: [], fairs: [], goods: {} });
  const tally = (st, good) => {
    const g = fairOf(st).goods;
    return g[good] || (g[good] = { packed: 0, home: 0, laid: 0, lost: 0 });
  };
  // ---- a load: lots of goods in a pawn's custody ----
  // Units of `good` in load l; its weight in rations of a back load; the customary worth of the keeping goods it took to pass on.
  function held(l, good) {
    let n = 0;
    for (const x of l.lots) if (x.good === good) n += x.n;
    return n;
  }
  function weight(l) {
    let w = 0;
    for (const x of l.lots) w += (x.n / quantum(x.good)) * weightOf(x.good);
    return w;
  }
  function kept(l) {
    let v = 0;
    for (const x of l.lots) if (x.got && Goods.goodOf(x.good).keeping) v += (x.n / quantum(x.good)) * worth(x.good);
    return v;
  }
  // The goods load l holds, each once, in FAIR.goods' order
  const goodsIn = (l) => FAIR.goods.filter((g) => held(l, g) >= quantum(g) - TOLERANCE);
  // n units of `good` taken out of load l, the lots that spoil first first (grain's crops in proportion): the lots taken
  function takeOut(l, good, n) {
    const out = [];
    const lots = l.lots.filter((x) => x.good === good).sort((a, b) => (a.until ?? Infinity) - (b.until ?? Infinity));
    for (const x of lots) {
      if (n <= TOLERANCE) break;
      const k = Math.min(x.n, n),
        part = { good, n: k };
      if (x.parts) {
        part.parts = {};
        for (const c in x.parts) {
          part.parts[c] = (x.parts[c] * k) / x.n;
          x.parts[c] -= part.parts[c];
        }
      }
      if (x.until !== undefined) part.until = x.until;
      x.n -= k;
      n -= k;
      out.push(part);
    }
    l.lots = l.lots.filter((x) => x.n > TOLERANCE);
    return out;
  }
  // What household hh can spare of a good for the load: grain above its floor, the rest what it holds
  function spare(st, hh, good) {
    if (good === 'grain') return Stores.grainOf(hh) - floorOf(st, hh);
    if (good === 'tar') return hh.tar || 0;
    if (good === 'hide') return hh.hides || 0;
    if (good === 'salt') return hh.salt || 0; // boiled at a spring (VB-700)
    return larderOf(hh, good);
  }
  // What giving up a quantum of `good` costs household hh by need, against its customary worth; null when it has none to spare
  function cost(st, hh, good) {
    VB.count.fairPack++;
    return spare(st, hh, good) + TOLERANCE < quantum(good) ? null : -needValue(st, hh, good, -1) / worth(good);
  }
  // A quantum of `good` taken from household hh's store into a lot, through sim/stores with the reason 'fair'
  function packLot(st, hh, good) {
    const n = quantum(good),
      why = { kind: 'fair', to: 'the fair' };
    if (good === 'grain') {
      const parts = {};
      return { good, n: Stores.takeSpare(st, hh, n, why, parts), parts };
    }
    if (!inLarder(good)) return { good, n: Stores.take(st, hh, good, n, why) };
    let until = Infinity;
    for (const x of hh.larder) if (x.kind === good && x.n > TOLERANCE) until = Math.min(until, x.until);
    const got = takeFood(st, hh, n, Infinity, good);
    Stores.record(st, hh, good, -got, why);
    return { good, n: got, until };
  }
  // Lot x goes into household hh's store (a larder good spoils by its own date)
  function unpackLot(st, hh, x) {
    const why = { kind: 'fair', from: 'the fair' };
    if (x.good === 'grain') Stores.put(st, hh, 'grain', x.n, why, x.parts);
    else if (!inLarder(x.good)) Stores.put(st, hh, x.good, x.n, why);
    else {
      addFood(st, hh, x.good, x.n, Math.max(0, (x.until - st.t) / DAY));
      Stores.record(st, hh, x.good, x.n, why);
    }
    tally(st, x.good).home += x.n;
  }
  // The dealer of household hh sets out for the gathering (sim/gathering's 'gatheringSetOut', as it takes its pack): the household's first
  // goer of GATHERING.adult or more loads its margin, the goods that cost it least by need against their worth first, a quantum while
  // giving it up costs no more than FAIR.bring times its worth, up to a back load (TRAVEL.load) less FAIR.room for what it takes. One with
  // nothing to spare carries none.
  function loadUp(st, d) {
    const p = st.pawns[d.pawn],
      hh = st.households[d.household];
    if (!p.alive || p.load || age(st, p) < GATHERING.adult || hh.dissolved) return;
    const f = fairOf(st);
    if (f.loads.some((id) => st.pawns[id].load.household === hh.id)) return;
    const order = [];
    for (const g of FAIR.goods) {
      const c = cost(st, hh, g);
      if (c !== null && c <= FAIR.bring) order.push([c, g]);
    }
    order.sort((a, b) => a[0] - b[0] || FAIR.goods.indexOf(a[1]) - FAIR.goods.indexOf(b[1]));
    const lots = [];
    let w = 0;
    for (const [, g] of order)
      while (w + weightOf(g) <= TRAVEL.load - FAIR.room + TOLERANCE) {
        const c = cost(st, hh, g);
        if (c === null || c > FAIR.bring) break;
        const x = packLot(st, hh, g);
        tally(st, g).packed += x.n;
        lots.push(x);
        w += weightOf(g);
      }
    if (!lots.length) return;
    p.load = { household: hh.id, until: d.until, lots };
    f.loads.push(p.id);
  }
  on('gatheringSetOut', loadUp);
  // The load goes home: its lots into the household's store (the one it was packed for, else the dealer's own), or lost with nobody to
  // take them; the dealer carries none.
  function unload(st, p, lost = false) {
    const l = p.load,
      f = fairOf(st);
    let hh = st.households[l.household];
    if (hh.dissolved)
      hh = p.household === null || st.households[p.household].dissolved ? null : st.households[p.household];
    for (const x of l.lots)
      if (hh && !lost) unpackLot(st, hh, x);
      else tally(st, x.good).lost += x.n;
    p.load = null;
    f.loads.splice(f.loads.indexOf(p.id), 1);
  }
  // A dealer is home: in its house for the night, not away, at no occasion
  function atHome(st, p) {
    const a = st.agents[p.id];
    if (!a || a.away !== undefined || a.occasion != null || !a.inside || p.household === null) return false;
    const hh = st.households[p.household];
    return !hh.dissolved && hh.farmstead !== null && bed(st, a) === st.farmsteads[hh.farmstead].house;
  }
  // A dealer who dies: at home its load goes into the store; on the road its grain lies where it fell, for its household to fetch
  // (sim/lying), and the rest is lost (counted)
  on('died', (st, d) => {
    const p = st.pawns[d.pawn];
    if (!p.load) return;
    if (atHome(st, p)) return unload(st, p);
    const a = st.agents[p.id],
      hh = st.households[p.load.household];
    if (a && !hh.dissolved)
      for (const x of takeOut(p.load, 'grain', held(p.load, 'grain'))) {
        const [px, py] = travelling(a) ? placeOf(st, a) : [a.x, a.y];
        Lying.leave(
          st,
          'leftGrain',
          x.n,
          tileAt(st, px, py),
          { type: 'household', id: hh.id },
          { x: px, y: py, of: { parts: x.parts } },
        );
        tally(st, 'grain').laid += x.n;
      }
    unload(st, p, true);
  });
  // ---- the swap ----
  // Whether pawns a and b are in one place: at one occasion, or on one tile and neither on the road (Kim, 16 Nov: a swap is never agreed
  // at a distance)
  function together(st, a, b) {
    const x = st.agents[a],
      y = st.agents[b];
    if (!x || !y) return false;
    if (x.occasion != null) return x.occasion === y.occasion;
    return !travelling(x) && !travelling(y) && tileAt(st, ...placeOf(st, x)) === tileAt(st, ...placeOf(st, y));
  }
  const termsOk = (t) => t && FAIR.goods.includes(t.good) && Number.isInteger(t.n) && t.n > 0;
  // Why pawn `from` may not swap `gives` (quanta of a good from its load) for `wants` (quanta from pawn to's), or null: both living with a
  // load, in one place, the goods held, custom allows them (land is never offered), and both loads still within a back load after.
  function swapWhy(st, from, to, gives, wants) {
    const p = st.pawns[from],
      q = Number.isInteger(to) ? st.pawns[to] : null;
    if (!q || !q.alive || from === to) return `there is no other pawn ${to} to deal with`;
    if (!p.load || !q.load) return 'each deals from a load it carries';
    if (p.load.household === q.load.household) return 'one does not deal with its own household';
    if (st.households[p.load.household].dissolved || st.households[q.load.household].dissolved)
      return 'one deals for a household that is gone';
    if (!termsOk(gives) || !termsOk(wants) || gives.good === wants.good)
      return `cannot swap ${JSON.stringify(gives)} for ${JSON.stringify(wants)}`;
    if (!together(st, from, to)) return `${fullName(p)} and ${fullName(q)} are not in one place`;
    const g = gives.n * quantum(gives.good),
      t = wants.n * quantum(wants.good);
    if (held(p.load, gives.good) + TOLERANCE < g) return `${fullName(p)} carries no ${g} ${gives.good}`;
    if (held(q.load, wants.good) + TOLERANCE < t) return `${fullName(q)} carries no ${t} ${wants.good}`;
    const wg = gives.n * weightOf(gives.good),
      wt = wants.n * weightOf(wants.good);
    if (weight(p.load) - wg + wt > TRAVEL.load + TOLERANCE || weight(q.load) - wt + wg > TRAVEL.load + TOLERANCE)
      return 'it would load one of them beyond a back load';
    const hp = st.households[p.load.household],
      hq = st.households[q.load.household];
    if (propriety(st, hp, gives.good, wants.good) === 'none' || propriety(st, hq, wants.good, gives.good) === 'none')
      return 'custom does not allow it';
    return null;
  }
  const ctx = { giver: null, receiver: null, from: null, to: null }; // reused, so the allowance allocates nothing
  // How pawn `me` (dealing for its load's household) weighs giving `gives` for `wants` from pawn `other`: {gain (by need), allowance (toward
  // the other: goodwill and opinion, near zero between strangers), floorOk, accept}. The quanta may be fractional, to ask what a deal at
  // an exact ratio would do (the count of deals that failed for want of change).
  function weigh(st, me, other, gives, wants) {
    VB.count.fairWeigh++;
    const p = st.pawns[me],
      hh = st.households[p.load.household],
      oh = st.households[st.pawns[other].load.household];
    // a keeping good is given up at its worth at least, as anyone takes it at its worth (design.md, Keeping goods): it passes for need,
    // not round the green
    const give = needValue(st, hh, gives.good, -gives.n),
      cost = Math.max(-give, Goods.goodOf(gives.good).keeping ? gives.n * worth(gives.good) : 0);
    const gain = needValue(st, hh, wants.good, wants.n, kept(p.load)) - cost;
    ctx.giver = me;
    ctx.receiver = other;
    ctx.from = hh;
    ctx.to = oh;
    const allowance = Rules.value(st, 'dealAllowance', ctx);
    ctx.from = ctx.to = null;
    // food given from the load leaves the household its floor, counting what it carries (the store itself is not touched by a deal)
    const floorOk =
      gives.good !== 'grain' ||
      Stores.grainOf(hh) + held(p.load, 'grain') - gives.n * quantum('grain') >= floorOf(st, hh) - TOLERANCE;
    return { gain, allowance, floorOk, accept: floorOk && gain + allowance >= -TOLERANCE };
  }
  const played = (st, id) => !!st.player && st.player.pawn === id;
  const words = (t) => {
    const g = Goods.goodOf(t.good);
    return `${t.n} ${g.lump}${t.n === 1 ? '' : 's'}${g.lump === t.good ? '' : ` of ${t.good}`}`;
  };
  // The fair at the occasion pawn id stands at (a day of a gathering), or null
  function fairAt(st, id) {
    const a = st.agents[id],
      o = a && a.occasion != null ? st.occasions.find((x) => x.id === a.occasion) : null;
    if (!o || o.kind !== 'gathering') return null;
    const year = cal(st.t).year,
      f = fairOf(st);
    let r = f.fairs.find((x) => x.host === o.village && x.year === year);
    if (!r) {
      r = { host: o.village, year, dealers: 0, proposals: 0, deals: 0, worth: {}, noChange: 0, hard: 0, told: false };
      f.fairs.push(r);
    }
    return r;
  }
  // The verb's act (only the verb `swap` calls it): the goods change loads, custody to custody, and the residual in customary worth is
  // booked between the two who dealt; a hard bargain is remembered against the side that drove it.
  function swapLoads(st, c) {
    const from = c.actor,
      to = c.target,
      { gives, wants } = c.args,
      p = st.pawns[from],
      q = st.pawns[to];
    const a = takeOut(p.load, gives.good, gives.n * quantum(gives.good)),
      b = takeOut(q.load, wants.good, wants.n * quantum(wants.good));
    for (const x of a) q.load.lots.push({ ...x, got: true });
    for (const x of b) p.load.lots.push({ ...x, got: true });
    const wg = gives.n * worth(gives.good),
      wt = wants.n * worth(wants.good);
    if (wg > wt) book(st, from, to, wg - wt);
    else if (wt > wg) book(st, to, from, wt - wg);
    const hp = st.households[p.load.household],
      hq = st.households[q.load.household],
      fair = fairAt(st, from);
    let hard = false;
    if (propriety(st, hp, gives.good, wants.good) === 'hard') {
      remember(st, from, to, 'hardBargain'); // the side that gave its animal for food in want remembers the one who drove it
      hard = true;
    }
    if (propriety(st, hq, wants.good, gives.good) === 'hard') {
      remember(st, to, from, 'hardBargain');
      hard = true;
    }
    if (fair) {
      fair.deals++;
      if (hard) fair.hard++;
      fair.worth[gives.good] = (fair.worth[gives.good] || 0) + wg;
      fair.worth[wants.good] = (fair.worth[wants.good] || 0) + wt;
    }
    const text = (x, y, other) => `Swapped ${words(x)} for ${words(y)} with ${fullName(st.pawns[other])}`;
    personEvent(st, from, 'swap', text(gives, wants, to), { other: to, n: Math.round(wg) });
    personEvent(st, to, 'swap', text(wants, gives, from), false);
  }
  // swap(target, {gives, wants}): the actor gives `gives` ({good, n quanta}) from its load for `wants` from the target's, settling an offer
  // on the basis `swap` both said yes to: everything changes or nothing (target-v2, 4.1)
  register('swap', {
    check: (st, c) =>
      living(st, c.actor) ||
      (c.source !== 'offer' ? 'a swap is settled from an offer both said yes to' : null) ||
      swapWhy(st, c.actor, c.target, c.args && c.args.gives, c.args && c.args.wants),
    run: (st, c) => swapLoads(st, c),
  });
  // The basis `swap` (VB-690): the maker offers goods from its load for goods from the other's, and weighs it first (the played pawn is not
  // bound by its allowance: The gift, The player's gift); the other answers by its need and allowance. A no is no slight: nobody
  // remembers it, and the fair counts it.
  Offers.basis('swap', {
    books: 'goodwill',
    wait: () => FAIR.answerHours / DAY,
    memory: false,
    what: (st, o) => `a swap of ${words(o.gives)} for ${words(o.wants)}`,
    check: (st, o, c) => {
      const why = swapWhy(st, o.from, o.to, o.gives, o.wants);
      if (why) return why;
      if (c.source !== 'player' && !weigh(st, o.from, o.to, o.gives, o.wants).accept)
        return `${fullName(st.pawns[o.from])} would not gain by it`;
      return {};
    },
    answers: (st, o) => [{ key: 'to', by: o.to, yes: null }],
    weigh: (st, o) => weigh(st, o.to, o.from, o.wants, o.gives).accept,
    refused: () => {},
    settle: (st, o) =>
      issue(st, {
        actor: o.from,
        verb: 'swap',
        target: o.to,
        args: { gives: o.gives, wants: o.wants },
        source: 'offer',
      }),
  });
  // What the played pawn is told before it gives grain below its household's floor in a swap (The gift, The player's gift): null, or the
  // rations under the floor after it. Reads only.
  function swapWarning(st, id, gives) {
    const p = st.pawns[id];
    if (!p.load || !gives || gives.good !== 'grain') return null;
    const hh = st.households[p.load.household],
      below = floorOf(st, hh) - (Stores.grainOf(hh) + held(p.load, 'grain') - gives.n * quantum('grain'));
    return below > TOLERANCE ? { below } : null;
  }
  // ---- finding deals (design.md, The fair: Trade partners; Cost) ----
  // Whether a deal would only pass one keeping good for another: dealer `me` needs what it would take (its need alone, with no room left
  // for goods to pass on) no more than what it would give. Such a deal moves no need, only lumps between friends; nobody proposes it.
  function passesOnly(st, me, gives, wants) {
    if (!Goods.goodOf(gives.good).keeping || !Goods.goodOf(wants.good).keeping) return false;
    const hh = st.households[st.pawns[me].load.household];
    return needValue(st, hh, wants.good, wants.n, KEEPING.cap) <= -needValue(st, hh, gives.good, -gives.n) + TOLERANCE;
  }
  // Dealer `me` proposes to `other` the deal best for itself that it would take, among one quantum of each of the other's goods for the
  // whole quanta of each of its own nearest its worth, and one of its own for the other's nearest; it makes the offer, and the other
  // answers. A refused deal that both would have taken at the exact ratio of worth failed for want of change.
  function propose(st, fair, me, other) {
    const p = st.pawns[me],
      q = st.pawns[other];
    if (!p.load || !q.load || p.load.household === q.load.household) return;
    let best = null;
    for (const g of goodsIn(p.load))
      for (const t of goodsIn(q.load)) {
        if (g === t) continue;
        const k = worth(t) / worth(g);
        for (const [gn, tn] of [
          [Math.max(1, Math.round(k)), 1],
          [1, Math.max(1, Math.round(1 / k))],
        ]) {
          const gives = { good: g, n: gn },
            wants = { good: t, n: tn };
          if (swapWhy(st, me, other, gives, wants) || passesOnly(st, me, gives, wants)) continue;
          const w = weigh(st, me, other, gives, wants);
          if (w.accept && (!best || w.gain + w.allowance > best.score))
            best = { gives, wants, score: w.gain + w.allowance };
        }
      }
    if (!best) return;
    fair.proposals++;
    const before = fair.deals;
    issue(st, {
      actor: me,
      verb: 'offer',
      target: other,
      args: { basis: 'swap', gives: best.gives, wants: best.wants },
      source: 'pawn',
    });
    if (fair.deals > before || played(st, other)) return;
    // at the ratio of worth, with no lump left over: what the other would give for what it is offered
    const exact = { good: best.wants.good, n: (best.gives.n * worth(best.gives.good)) / worth(best.wants.good) };
    if (weigh(st, me, other, best.gives, exact).accept && weigh(st, other, me, exact, best.gives).accept)
      fair.noChange++;
  }
  // Each hour of a fair's day (FAIR.hours): at each gathering, the dealers present with a load, in seeded order, each in one hour of the
  // day (its place among them by id), propose to every dealer present it holds a goodwill balance with, then to FAIR.others others drawn
  // at random (sim/rng's stream `fair`). The work grows with the dealers present, not with their pairs (rule 2): VB.count.fairWeigh.
  function dealHour(st, slot, slots) {
    const by = new Map();
    for (const id of st.fair.loads) {
      const a = st.agents[id];
      if (!st.pawns[id].alive || !a || a.occasion == null) continue;
      if (!by.has(a.occasion)) by.set(a.occasion, []);
      by.get(a.occasion).push(id);
    }
    for (const ids of by.values()) {
      const fair = fairAt(st, ids[0]);
      if (!fair) continue;
      if (slot === 0) fair.dealers = Math.max(fair.dealers, ids.length);
      ids.sort((x, y) => x - y);
      const mine = ids.filter((id, i) => i % slots === slot && !played(st, id));
      for (let i = mine.length - 1; i > 0; i--) {
        const j = Math.floor(rnd(st.rng.fair) * (i + 1));
        [mine[i], mine[j]] = [mine[j], mine[i]];
      }
      const here = new Set(ids);
      for (const me of mine) {
        const m = st.pawns[me].goodwill,
          asked = new Set([me]);
        if (m) for (const b of m.keys()) if (here.has(b) && !asked.has(b)) asked.add(b) && propose(st, fair, me, b);
        for (let k = 0; k < FAIR.others && asked.size < ids.length; k++) {
          const b = ids[Math.floor(rnd(st.rng.fair) * ids.length)];
          if (!asked.has(b)) asked.add(b) && propose(st, fair, me, b);
        }
      }
    }
  }
  // The fair's log line, at the last hour of a gathering's last day: who dealt, the deals and what changed hands by good, the deals that
  // failed for want of change, the hard bargains
  function tell(st) {
    for (const r of fairOf(st).fairs) {
      if (r.told || st.occasions.some((o) => o.kind === 'gathering' && o.village === r.host && o.start > st.t))
        continue;
      r.told = true;
      const moved = Object.keys(r.worth)
        .map((g) => `${g} ${Math.round(r.worth[g])}`)
        .join(', ');
      log(
        st,
        `The fair at ${st.villages[r.host].name}: ${r.dealers} came to deal, ${r.deals} ${r.deals === 1 ? 'deal' : 'deals'} made` +
          `${moved ? ` (rations' worth: ${moved})` : ''}, ${r.noChange} failed for want of change, ${r.hard} hard ${r.hard === 1 ? 'bargain' : 'bargains'}.`,
        { kind: 'fair', village: r.host, n: r.deals },
      );
    }
  }
  // Each hour while loads are out (sim/clock): at a fair's hours its dealers deal, at its last its line is told; at any hour a dealer
  // home again once its gathering is over puts its load into its household's store.
  function fairHour(st, c) {
    const [h0, h1] = FAIR.hours;
    if (c.hour >= h0 && c.hour < h1) dealHour(st, c.hour - h0, h1 - h0);
    if (c.hour === h1) tell(st);
    for (const id of [...st.fair.loads]) {
      const p = st.pawns[id];
      if (p.alive && st.t >= p.load.until && atHome(st, p)) unload(st, p);
    }
    const year = cal(st.t).year;
    st.fair.fairs = st.fair.fairs.filter((r) => r.year === year || !r.told);
  }
  return { FAIR, fairHour, swapWhy, swapWarning, held, weight };
})();
