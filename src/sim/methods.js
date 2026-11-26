// @sys sim/methods: the task as a plan (design.md section 7, Plans at four scales; VB-1747): a goal's next leg read from the world. A kind
// declares its methods (KINDS[kind].methods), rows of steps of nine primitives, each step with the facts it needs and the facts it makes,
// read from the world and never kept on the task; `next` takes the rule for a load in hand, then the stray method, then the first method
// that applies, read from its last step to its first. The world is read through a view, the readers its caller gives, so the engine
// holds no domain and no state. Loaded before the kinds' modules, which declare their methods with its rows (`trip`, VB-1749).
VB['sim/methods'] = (() => {
  // ---- the vocabulary (docs/plans/four-scales/README.md, 3.2) ----
  // The primitives: what a step does; carrying it out is the caller's (sim/agents, from VB-1775).
  const PRIMS = ['go', 'fetch', 'work', 'load', 'haul', 'unload', 'return', 'wait', 'mind'];
  // At most three methods a kind, of at most seven steps, and a good's piles read at no more than two places (Nothing searches).
  const MAX = { methods: 3, steps: 7, wants: 2 };
  // A fact, declared as data (one key of these):
  //   {at: PLACE}: the pawn stands at the place;
  //   {carries: GOOD}: it holds a load of the good, the goal's owner's; {carries: null}: its hands are empty;
  //   {has: THING}: it holds the thing (the cart, a tool); {free: THING}: one of the goal's owner's is free to fetch;
  //   {pile: GOOD, at: PLACE, min}: a pile of the goal's owner's good lies at the place, at least min (1; 'load': a load of the pawn's);
  //   {store: GOOD, min}: the goal's owner's store holds at least min of the good (1; 'goal': the goal's amount);
  //   {stage: NAME}: the goal's stage is done (its hours lie on the stage, sim/progress);
  //   {can: NAME}: the kind's own reading of the world, kind.can[NAME](st, goal, pawn, view) (trees standing);
  //   {met: true}: the goal is met, kind.met(st, goal, view);
  //   {not: FACT}, {any: [FACT, ...]}; a step's list of facts holds when each holds.
  // Any fact may carry `why`, the reason told when it is the one that blocks.
  // A PLACE is 'site' (the goal's `at`), 'store' (the goal's owner's store), 'stray' (the stray pile's place), 'home' (the store of the
  // load's owner), 'here' (where the pawn stands), or a name the view reads (view.place: 'cart', where the cart stands).
  const AT = 1,
    CARRIES = 2,
    HAS = 3,
    FREE = 4,
    PILE = 5,
    STORE = 6,
    STAGE = 7,
    CAN = 8,
    MET = 9,
    NOT = 10,
    ANY = 11;
  const CODE = {
    at: AT,
    carries: CARRIES,
    has: HAS,
    free: FREE,
    pile: PILE,
    store: STORE,
    stage: STAGE,
    can: CAN,
    met: MET,
    not: NOT,
    any: ANY,
  };
  // What `next` returns besides a step: the goal met, and the steps of the rules before any method.
  const DONE = 'done';
  const RULE = {
    haul: { prim: 'haul', at: 'home', rule: true }, // a load off its goal, carried to its owner's store
    unload: { prim: 'unload', at: 'home', rule: true }, // and set down in it
    drop: { prim: 'unload', at: 'here', rule: true }, // its owner's store gone: set down where the pawn stands, a pile with title
    return: { prim: 'return', at: 'kept', rule: true }, // a thing held (the cart) taken back to where it is kept, the task over
  };

  // ---- compiling a kind's methods (at load; a kind with none is not compiled) ----
  function describe(f) {
    switch (f.code) {
      case AT:
        return `not at the ${f.place}`;
      case CARRIES:
        return f.good === null ? 'hands full' : `no ${f.good} in hand`;
      case HAS:
        return `no ${f.thing} in hand`;
      case FREE:
        return `no ${f.thing} free`;
      case PILE:
        return `no ${f.good} at the ${f.place}`;
      case STORE:
        return `no ${f.good} in the store`;
      case STAGE:
        return `${f.name} not done`;
      case CAN:
        return `cannot ${f.name}`;
      case MET:
        return 'not met';
      case NOT:
        return `not: ${describe(f.sub)}`;
      default:
        return f.sub.map(describe).join(' and ');
    }
  }
  function fact(d, where) {
    const keys = Object.keys(d).filter((k) => CODE[k] && !(k === 'at' && 'pile' in d)); // a pile's `at` is its place
    if (keys.length !== 1)
      throw new Error(`sim/methods: ${where}: a fact has one of ${Object.keys(CODE).join(', ')}: ${JSON.stringify(d)}`);
    const code = CODE[keys[0]],
      f = { code, place: null, good: null, thing: null, min: 1, name: null, sub: null, why: '' };
    if (code === AT) f.place = d.at;
    else if (code === CARRIES) f.good = d.carries;
    else if (code === HAS) f.thing = d.has;
    else if (code === FREE) f.thing = d.free;
    else if (code === PILE) [f.good, f.place, f.min] = [d.pile, d.at || 'site', d.min ?? 1];
    else if (code === STORE) [f.good, f.min] = [d.store, d.min ?? 1];
    else if (code === STAGE) f.name = d.stage;
    else if (code === CAN) f.name = d.can;
    else if (code === NOT) f.sub = fact(d.not, where);
    else if (code === ANY) f.sub = d.any.map((x) => fact(x, where));
    f.why = d.why || describe(f);
    return f;
  }
  // Each pile a fact reads, [good, place]: the places where the kind makes or wants a good (a pile elsewhere is a stray).
  const piles = (f) =>
    f.code === PILE ? [[f.good, f.place]] : f.code === NOT ? piles(f.sub) : f.code === ANY ? f.sub.flatMap(piles) : [];
  function step(d, where) {
    if (!PRIMS.includes(d.prim)) throw new Error(`sim/methods: ${where}: no primitive ${d.prim}`);
    const s = {
      ...d,
      at: d.at || null,
      pre: (d.pre || []).map((x) => fact(x, where)),
      eff: (d.eff || []).map((x) => fact(x, where)),
    };
    // what `next` returns when this step is the first not done and its precondition j does not hold, made once
    s.stops = s.pre.map((f) => ({ blocked: f.why, step: s, fact: f }));
    return s;
  }
  // Any of a pile, however little: what the stray pile's finding (view.stray) finds is taken up (VB-1749: a pile under 1 was found and
  // never taken, and its goal walked between it and its site)
  const ANY_N = 1e-9;
  // The stray method (A stray pile): a pile of a good the goal uses, its owner's, lying where its kind neither makes nor wants it, is
  // fetched to the owner's store, or to the place the kind's own rows set the good down (`to`: the building site of timber, VB-1812).
  // Tried before a kind's own; one row a good.
  const strayRow = (good, to = 'store') => [
    { prim: 'go', at: 'stray', good, pre: [], eff: [{ at: 'stray' }] },
    {
      prim: 'load',
      at: 'stray',
      good,
      pre: [{ at: 'stray' }, { carries: null }, { pile: good, at: 'stray', min: ANY_N }],
      eff: [{ carries: good }],
    },
    { prim: 'haul', at: to, good, pre: [{ carries: good }], eff: [{ at: to }] },
    { prim: 'unload', at: to, good, pre: [{ carries: good }, { at: to }], eff: [{ not: { carries: good } }] },
  ];
  // A kind's plan: its methods compiled, the goods it uses (what its loads take up), where it makes or wants them, its stray rows.
  function plan(key, K) {
    const M = K.methods;
    if (!Array.isArray(M) || !M.length || M.length > MAX.methods)
      throw new Error(`sim/methods: ${key}: one to ${MAX.methods} methods`);
    const methods = M.map((m, i) => {
      const where = `${key}, method ${m.name || i}`;
      if (!m.steps || !m.steps.length || m.steps.length > MAX.steps)
        throw new Error(`sim/methods: ${where}: one to ${MAX.steps} steps`);
      // `when`: facts (data), or the kind's own reading, (st, goal, pawn, view) => boolean; none: it always applies
      const facts = Array.isArray(m.when) ? m.when.map((x) => fact(x, where)) : null;
      return {
        name: m.name || String(i),
        when: facts ? null : m.when || null,
        whenFacts: facts,
        steps: m.steps.map((s) => step(s, where)),
      };
    });
    const steps = methods.flatMap((m) => m.steps),
      read = steps.flatMap((s) => [...s.pre, ...s.eff]).flatMap(piles);
    const uses = [...new Set(steps.filter((s) => s.prim === 'load' && s.good).map((s) => s.good))];
    const wants = uses.map((g) => [...new Set(read.filter((x) => x[0] === g).map((x) => x[1]))]);
    for (let i = 0; i < uses.length; i++)
      if (wants[i].length > MAX.wants)
        throw new Error(`sim/methods: ${key}: ${uses[i]} read at more than ${MAX.wants} places`);
    const to = (g) => (steps.find((s) => s.prim === 'unload' && s.good === g) || { at: 'store' }).at;
    const stray = uses.map((g) => strayRow(g, to(g)).map((s) => step(s, `${key}, stray ${g}`)));
    const none = { blocked: 'no method applies', step: null, fact: null };
    return { key, kind: K, methods, uses, wants, stray, none };
  }
  // The plans of a table of kinds (sim/kinds' KINDS, or a test's), by key: only the kinds that declare methods.
  function compile(kinds) {
    const out = {};
    for (const key in kinds) if (kinds[key] && kinds[key].methods) out[key] = plan(key, kinds[key]);
    return out;
  }

  // ---- reading the world ----
  // The view: the readers the caller gives (the test's world, and from VB-1775 the game's), every one plain reads:
  //   plans (compile's), at(st, p) the pawn's place, hands(st, p) its load {good, n, owner} or null, held(st, p) the thing it holds or
  //   null, has(st, p, thing), free(st, goal, p, thing), place(st, goal, p, name), pile(st, place, good, goal), store(st, owner, good),
  //   storeOf(st, owner) the owner's store's place (null once it is gone), cap(st, p, good) a load of the pawn's, stage(st, goal, name),
  //   stray(st, goal, good, a, b) the place of a pile of the goal's owner's good lying at neither place a nor b (indexed by owner, never a
  //   scan of all piles), or null.
  // Places are compared with ===; a place of the view's (a tile) is a number or a name, never a fresh object.
  function where(st, name, g, p, v, stray) {
    switch (name) {
      case 'site':
        return g.at;
      case 'store':
        return v.storeOf(st, g.owner);
      case 'stray':
        return stray;
      case 'here':
        return v.at(st, p);
      case 'home': {
        const h = v.hands(st, p);
        return h ? v.storeOf(st, h.owner) : null;
      }
      default:
        return v.place(st, g, p, name);
    }
  }
  const least = (st, min, g, p, v, good) => (min === 'load' ? v.cap(st, p, good) : min === 'goal' ? g.amount : min);
  function holds(st, f, g, p, v, K, stray) {
    switch (f.code) {
      case AT:
        return v.at(st, p) === where(st, f.place, g, p, v, stray);
      case CARRIES: {
        const h = v.hands(st, p);
        return f.good === null ? !h : !!h && h.n > 0 && h.good === f.good && h.owner === g.owner;
      }
      case HAS:
        return v.has(st, p, f.thing);
      case FREE:
        return v.free(st, g, p, f.thing);
      case PILE:
        return v.pile(st, where(st, f.place, g, p, v, stray), f.good, g) >= least(st, f.min, g, p, v, f.good);
      case STORE:
        return v.store(st, g.owner, f.good) >= least(st, f.min, g, p, v, f.good);
      case STAGE:
        return !!v.stage(st, g, f.name);
      case CAN:
        return !!K.can[f.name](st, g, p, v);
      case MET:
        return !!K.met(st, g, v);
      case NOT:
        return !holds(st, f.sub, g, p, v, K, stray);
      default:
        for (let i = 0; i < f.sub.length; i++) if (holds(st, f.sub[i], g, p, v, K, stray)) return true;
        return false;
    }
  }
  function all(st, fs, g, p, v, K, stray) {
    for (let i = 0; i < fs.length; i++) if (!holds(st, fs[i], g, p, v, K, stray)) return false;
    return true;
  }
  // A row read backwards (a triangle table): the step nearest the goal whose precondition holds and whose effect does not; every
  // effect holding, DONE; else the first step not done, blocked by its first precondition that does not hold.
  function scan(st, steps, g, p, v, K, stray) {
    for (let i = steps.length - 1; i >= 0; i--) {
      const s = steps[i];
      if (!all(st, s.eff, g, p, v, K, stray) && all(st, s.pre, g, p, v, K, stray)) return s;
    }
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      if (all(st, s.eff, g, p, v, K, stray)) continue;
      for (let j = 0; j < s.pre.length; j++) if (!holds(st, s.pre[j], g, p, v, K, stray)) return s.stops[j];
    }
    return DONE;
  }
  // The rule for a load in hand (A load in hand): carried to its owner's store and set down there; set down where the pawn stands only
  // when that store is gone. A pawn that cannot walk on (death, illness) sets its load down by its caller's act, never asked here.
  function carryHome(st, p, v, h) {
    const to = v.storeOf(st, h.owner);
    if (to === null || to === undefined) return RULE.drop;
    return v.at(st, p) === to ? RULE.unload : RULE.haul;
  }
  const uses = (P, good) => P.uses.indexOf(good) >= 0;
  // The pawn's next leg toward goal g (null: no goal, the pawn free): a step of a method or of a rule, DONE, or {blocked, step, fact}.
  // Reads only; allocates nothing (the steps and their reasons are made at compile).
  function next(st, g, p, v) {
    const P = g ? v.plans[g.kind] : null,
      h = v.hands(st, p),
      K = P ? P.kind : null;
    const met = !!P && !!K.met(st, g, v);
    // 1. a load off its goal, or the goal met or gone: carried home
    if (h && h.n > 0 && (!P || met || h.owner !== g.owner || !uses(P, h.good))) return carryHome(st, p, v, h);
    if (!P || met) return v.held(st, p) ? RULE.return : DONE;
    // 2. the stray method, with empty hands
    if (!h || !(h.n > 0))
      for (let i = 0; i < P.uses.length; i++) {
        const w = P.wants[i];
        const at = v.stray(
          st,
          g,
          P.uses[i],
          w.length ? where(st, w[0], g, p, v, null) : null,
          w.length > 1 ? where(st, w[1], g, p, v, null) : null,
        );
        if (at === null || at === undefined) continue;
        const s = scan(st, P.stray[i], g, p, v, K, at);
        if (s !== DONE && !s.blocked) return s;
      }
    // 3. the first method that applies
    for (let i = 0; i < P.methods.length; i++) {
      const m = P.methods[i];
      if (m.when ? !m.when(st, g, p, v) : m.whenFacts && !all(st, m.whenFacts, g, p, v, K, null)) continue;
      const s = scan(st, m.steps, g, p, v, K, null);
      // nothing this method can do with the load it holds: the rule takes it home
      if (s.blocked && h && h.n > 0) return carryHome(st, p, v, h);
      if (s === DONE) return v.held(st, p) ? RULE.return : DONE;
      return s;
    }
    return P.none;
  }
  // Where a step returned by `next` goes or is done, for its caller to walk to (the stray pile's place found again).
  function placeOf(st, s, g, p, v) {
    if (!s.at || s.at === 'kept') return null;
    if (s.at !== 'stray') return where(st, s.at, g, p, v, null);
    const P = v.plans[g.kind],
      i = P.uses.indexOf(s.good),
      w = P.wants[i];
    return v.stray(
      st,
      g,
      s.good,
      w.length ? where(st, w[0], g, p, v, null) : null,
      w.length > 1 ? where(st, w[1], g, p, v, null) : null,
    );
  }

  // ---- a trip whose good is made at the work (VB-1749; design.md section 7, The good is made where the work is done) ----
  // The kinds that make their good as the work ends (`make`, sim/agents): fishing, hunting, gathering, digging, boiling salt, a basket of
  // stone. One row: go to the site, work (the good made into the hand), or take up the owner's pile lying there (a trip cut there before),
  // haul it home and set it down in the store. The good is named for the kind (a pile of it lies as the kind, sim/lying), so the stray
  // method of the same kind's goal fetches a pile cut elsewhere. The goal is the trip: met once its work is done (`job.made`, counted by
  // the work leg and by a trip cut by the day's end that carries its yield home, sim/agents tripHome); the load in hand then goes home by
  // the rule for a load in hand. The kind record K is given its methods, `met` and its work's op.
  // @state job.made: absent until a trip's work is done (VB-1749), then the trips worked for the task (a kind of `trip`'s goal is met at one)
  const tripRow = (good) => [
    { prim: 'go', at: 'site', pre: [], eff: [{ at: 'site' }] },
    { prim: 'work', op: 'make', at: 'site', pre: [{ at: 'site' }, { carries: null }], eff: [{ carries: good }] },
    {
      prim: 'load',
      good,
      at: 'site',
      pre: [{ at: 'site' }, { carries: null }, { pile: good, at: 'site', min: ANY_N }],
      eff: [{ carries: good }],
    },
    { prim: 'haul', good, at: 'store', pre: [{ carries: good }], eff: [{ at: 'store' }] },
    { prim: 'unload', good, at: 'store', pre: [{ carries: good }, { at: 'store' }], eff: [{ not: { carries: good } }] },
  ];
  function trip(K, good) {
    // a kind's record, given its methods at load (no state)
    Object.assign(K, { methods: [{ name: 'a trip', steps: tripRow(good) }], met: (st, g) => (g.job.made || 0) > 0 });
    K.ops = {
      make: {
        run: (st, j, g, at, a) => {
          a.loadOf = null; // made in the hand: its delivery reads the task
          K.make(st, a, j, 1, st.households[g.owner]);
          j.made = (j.made || 0) + 1;
        },
      },
    };
    return K;
  }

  // ---- a load taken up or made at the work and carried to a place (VB-1812; design.md section 7, The task as a plan) ----
  // The sheaves and the hay from the stooks and cocks of their field and meadow, timber felled for a building site, water drawn, stone
  // for the well. One row: a cart fetched first where the kind says it pays (`cart`), go to the site, work (the load into the hand: the
  // stooks pitched, the tree felled, the water drawn), or take up the owner's pile lying there, haul it to the place the kind carries to
  // (`to`: the owner's store, or a place of the kind's, K.places, as the building site `j.dest`), and set it down there (the kind's
  // delivery). The goal is the kind's own end (o.met: the stooks all in, a trip's work done) and no hand of it holding a load: so a
  // load in hand goes on by this row to the kind's place, not by the rule for a load in hand to the store. The good is named for the
  // kind unless o.good says (the building's timber, which the wood's `timber` is not). o: {op, run(st, j, g, at, a, cap): the load made
  // in the hand (cap: the loads its cart or its back holds), met(st, g), source (true: K.can.source reads what the site holds; why),
  // to, cart (true: K.can.cartPays), hours, reload (the hours of the work once a load was made: the task's from then on)}.
  const cartOrNone = { any: [{ has: 'cart' }, { not: { free: 'cart' } }, { not: { can: 'cartPays' } }] };
  const cartStep = {
    prim: 'fetch',
    thing: 'cart',
    at: 'cart',
    pre: [{ not: { has: 'cart' } }, { free: 'cart' }, { can: 'cartPays' }],
    eff: [cartOrNone],
  };
  function carry(K, key, o) {
    const good = o.good || key,
      to = o.to || 'store',
      src = o.source ? [{ can: 'source', why: o.why || 'nothing to take up' }] : [];
    const steps = [
      ...(o.cart ? [cartStep] : []),
      { prim: 'go', at: 'site', pre: o.cart ? [cartOrNone] : [], eff: [{ at: 'site' }] },
      {
        prim: 'work',
        op: o.op,
        at: 'site',
        pre: [{ at: 'site' }, { carries: null }, ...src],
        eff: [{ carries: good }],
      },
      {
        prim: 'load',
        good,
        at: 'site',
        pre: [{ at: 'site' }, { carries: null }, { pile: good, at: 'site', min: ANY_N }],
        eff: [{ carries: good }],
      },
      { prim: 'haul', good, at: to, pre: [{ carries: good }], eff: [{ at: to }] },
      { prim: 'unload', good, at: to, pre: [{ carries: good }, { at: to }], eff: [{ not: { carries: good } }] },
    ];
    Object.assign(K, {
      methods: [{ name: o.name || 'carried', steps }],
      met: (st, g, v) => !!o.met(st, g) && !v.carrying(st, g),
    });
    K.ops = {
      [o.op]: {
        hours: o.hours,
        run: (st, j, g, at, a, cap) => {
          a.loadOf = null; // made in the hand: its delivery reads the task
          o.run(st, j, g, at, a, cap);
          if (a.load > 0) {
            a.carry = K.carry;
            j.made = (j.made || 0) + 1;
            if (o.reload) j.hours = o.reload;
          }
        },
      },
    };
    return K;
  }
  // Work at the site with no load in hand (VB-1812: the manure carted): a cart fetched where one is free and the kind says it pays, go,
  // work; met once the work is done (`job.made`), and the cart then taken back by the rule for a thing held.
  function tend(K, o) {
    const steps = [
      ...(o.cart ? [cartStep] : []),
      { prim: 'go', at: 'site', pre: o.cart ? [cartOrNone] : [], eff: [{ at: 'site' }] },
      { prim: 'work', op: o.op, at: 'site', pre: [{ at: 'site' }], eff: [{ met: true }] },
    ];
    Object.assign(K, { methods: [{ name: o.name || 'tended', steps }], met: (st, g) => (g.job.made || 0) > 0 });
    K.ops = {
      [o.op]: {
        hours: o.hours,
        run: (st, j, g, at, a) => {
          o.run(st, j, g, at, a);
          j.made = (j.made || 0) + 1;
        },
      },
    };
    return K;
  }

  return { PRIMS, MAX, DONE, RULE, compile, next, placeOf, trip, carry, tend };
})();
