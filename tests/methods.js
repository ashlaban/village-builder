// VB-1747: the task as a plan (sim/methods), wired to nothing yet, on a constructed micro-world: two farms, a forest, a road; stores,
// piles at places with an owner, pawns that carry, one cart the two farms share. The firewood goal of docs/plans/four-scales/README.md
// 3.2 is declared here; the engine is the game's. Rebuilt from Study A's mock (git show 4651420:docs/mocks/plans/task/micro.js), parts
// 2, 3 and 5: the firewood table's five rows, each a check; then a fuzz of seeded runs under random cuts (the night, a call, a death, an
// illness, the cart taken), two goals for one cart, two owners and piles that rot: no stuck task, no false `blocked`, no good outside a
// store, a pile or a hand, and no load left in a free pawn's hands at the day's end.
// node tests/methods.js [--runs N] (default 1000; the 10,000 of Q1 at night) [--time N] (microseconds an ask, N asks; told, not asserted)
const assert = require('assert');
const VB = require('../src/load.js');
const M = VB['sim/methods'],
  { next: rnd, makeStream } = VB['sim/rng'];
const arg = (n, d) => {
  const i = process.argv.indexOf('--' + n);
  return i >= 0 ? Number(process.argv[i + 1]) : d;
};
const RUNS = arg('runs', 1000),
  TIMES = arg('time', 0);

// ---- the micro-world (all of it in plain data: st) ----
const PL = { h: [0, 0], c: [2, -3], forest: [5, 1], road: [3, 0], field: [-2, 3] };
const PLACES = Object.keys(PL);
const dist = (a, b) => {
  const [q1, r1] = PL[a],
    [q2, r2] = PL[b],
    dq = q1 - q2,
    dr = r1 - r2;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
};
const walkH = (a, b, cart) => dist(a, b) * 0.3 * (cart ? 1.2 : 1);
const WORK0 = 6,
  WORK1 = 18,
  CART = 4,
  BACK = 1,
  ROT = 24; // a pile lying a day may rot at the night (as stooks and lying loads do at the frost)
const GOODS = ['timber', 'firewood'],
  OWNERS = ['h', 'c'];
const zero = () => Object.fromEntries(OWNERS.map((o) => [o, Object.fromEntries(GOODS.map((g) => [g, 0]))]));
function world(seed, trees = 100) {
  return {
    t: WORK0,
    end: WORK1,
    rng: makeStream(seed, 'methods'),
    stores: zero(),
    piles: [],
    trees,
    prog: {},
    gone: {},
    cart: { at: 'h', by: null, until: -1, kept: 'h' },
    pawns: [],
    made: zero(),
    used: zero(),
    rotted: zero(),
    table: false,
  };
}
const pileOf = (st, at, good, owner) => st.piles.find((x) => x.at === at && x.good === good && x.owner === owner);
const pileN = (st, at, good, owner) => {
  const x = pileOf(st, at, good, owner);
  return x ? x.n : 0;
};
function lay(st, at, good, n, owner) {
  const x = pileOf(st, at, good, owner);
  if (x) x.n += n;
  else st.piles.push({ at, good, n, owner, t: st.t });
}
function takePile(st, at, good, owner, n) {
  const x = pileOf(st, at, good, owner);
  x.n -= n;
  if (x.n <= 0) st.piles.splice(st.piles.indexOf(x), 1);
}
const make = (st, o, g, n) => (st.made[o][g] += n);
const holdsCart = (st, p) => st.cart.by === p.id;

// ---- the view: the readers sim/methods asks ----
// The firewood goal of 3.2, as its domain would declare it: fell at the forest, load (the cart or the back), haul, unload, cut at the
// house. One method plays all five rows; a cart is fetched when one is free and walked without when none is.
const cartOrNone = { any: [{ has: 'cart' }, { not: { free: 'cart' } }] };
// a walk to the forest, or for the cart, only for wood to be had there (else the pawn walks out to learn there is none)
const wood = { any: [{ can: 'trees' }, { pile: 'timber', at: 'site' }], why: 'no trees standing' };
const FIREWOOD = {
  met: (st, g) => st.stores[g.owner].firewood >= g.amount,
  can: { trees: (st) => st.trees > 0 },
  methods: [
    {
      name: 'the timber at home', // cut what lies at home first, from wherever the pawn stands with empty hands
      when: [{ store: 'timber' }, { carries: null }],
      steps: [
        { prim: 'go', at: 'store', pre: [], eff: [{ at: 'store' }] },
        {
          prim: 'work',
          op: 'cut',
          at: 'store',
          pre: [{ at: 'store' }, { store: 'timber', why: 'no timber at home' }],
          eff: [{ met: true }],
        },
      ],
    },
    {
      name: 'from the forest',
      steps: [
        {
          prim: 'fetch',
          thing: 'cart',
          at: 'cart',
          pre: [{ not: { has: 'cart' } }, { free: 'cart' }, wood],
          eff: [cartOrNone],
        },
        { prim: 'go', at: 'site', pre: [cartOrNone, wood], eff: [{ at: 'site' }] },
        {
          prim: 'work',
          op: 'fell',
          at: 'site',
          pre: [{ at: 'site' }, { can: 'trees', why: 'no trees standing' }],
          eff: [{ any: [{ pile: 'timber', at: 'site', min: 'load' }, { carries: 'timber' }] }],
        },
        {
          prim: 'load',
          good: 'timber',
          at: 'site',
          pre: [
            { at: 'site' },
            { carries: null },
            { pile: 'timber', at: 'site' },
            { any: [{ pile: 'timber', at: 'site', min: 'load' }, { not: { can: 'trees' } }] },
          ],
          eff: [{ carries: 'timber' }],
        },
        { prim: 'haul', good: 'timber', at: 'store', pre: [{ carries: 'timber' }], eff: [{ at: 'store' }] },
        {
          prim: 'unload',
          good: 'timber',
          at: 'store',
          pre: [{ carries: 'timber' }, { at: 'store' }],
          eff: [{ not: { carries: 'timber' } }],
        },
        {
          prim: 'work',
          op: 'cut',
          at: 'store',
          pre: [{ at: 'store' }, { carries: null }, { store: 'timber', why: 'no timber at home' }],
          eff: [{ met: true }],
        },
      ],
    },
  ],
};
const OPS = {
  fell: {
    hours: 2,
    can: (st) => st.trees > 0,
    apply: (st, g) => {
      st.trees--;
      make(st, g.owner, 'timber', 2);
      lay(st, g.at, 'timber', 2, g.owner);
    },
  },
  cut: {
    hours: 1,
    can: (st, g) => st.stores[g.owner].timber > 0,
    apply: (st, g) => {
      const s = st.stores[g.owner],
        n = Math.min(2, s.timber);
      s.timber -= n;
      st.used[g.owner].timber += n;
      s.firewood += n;
      make(st, g.owner, 'firewood', n);
    },
  },
};
const V = {
  plans: M.compile({ firewood: FIREWOOD }),
  at: (st, p) => p.at,
  hands: (st, p) => p.hands,
  held: (st, p) => (holdsCart(st, p) ? 'cart' : null),
  has: (st, p, thing) => thing === 'cart' && holdsCart(st, p),
  free: (st, g, p, thing) => thing === 'cart' && st.cart.by === null && st.cart.until <= st.t,
  place: (st, g, p, name) => (name === 'cart' ? st.cart.at : null),
  pile: (st, at, good, g) => pileN(st, at, good, g.owner),
  store: (st, owner, good) => st.stores[owner][good],
  storeOf: (st, owner) => (st.gone[owner] ? null : owner), // a farm's store stands at its house
  cap: (st, p) => (holdsCart(st, p) ? CART : BACK),
  stage: () => false,
  stray: (st, g, good, a, b) => {
    for (const x of st.piles)
      if (x.owner === g.owner && x.good === good && x.n > 0 && x.at !== a && x.at !== b) return x.at;
    return null;
  },
};

// ---- carrying out a step (the caller's part: sim/agents, from VB-1775) ----
const hoursLeft = (st) => (st.table ? 12 : Math.max(0.1, st.end - st.t));
function legHours(st, g, p, s) {
  const to = M.placeOf(st, s, g, p, V);
  if (s.prim === 'go' || s.prim === 'haul') return walkH(p.at, to, holdsCart(st, p));
  if (s.prim === 'fetch') return walkH(p.at, st.cart.at, false) + 0.1;
  if (s.prim === 'return') return walkH(p.at, st.cart.kept, true) + 0.1;
  if (s.prim === 'work') return Math.min(OPS[s.op].hours - (st.prog[s.op + ':' + g.owner] || 0), hoursLeft(st));
  if (s.prim === 'wait') return 1;
  return 0.1; // load, unload
}
function endLeg(st, g, p, s, h) {
  const to = M.placeOf(st, s, g, p, V);
  switch (s.prim) {
    case 'go':
    case 'haul':
      p.at = to;
      if (holdsCart(st, p)) st.cart.at = to;
      break;
    case 'fetch':
      p.at = st.cart.at;
      if (st.cart.by === null && st.cart.until <= st.t) st.cart.by = p.id;
      break;
    case 'return':
      p.at = st.cart.kept;
      Object.assign(st.cart, { at: st.cart.kept, by: null });
      break;
    case 'load': {
      const have = pileN(st, to, s.good, g.owner),
        n = Math.min(have, V.cap(st, p));
      if (n > 0 && !p.hands) {
        takePile(st, to, s.good, g.owner, n);
        p.hands = { good: s.good, n, owner: g.owner };
      }
      break;
    }
    case 'unload': {
      if (!p.hands) break;
      const o = p.hands.owner;
      if (s.at !== 'here' && to === V.storeOf(st, o)) st.stores[o][p.hands.good] += p.hands.n;
      else {
        lay(st, p.at, p.hands.good, p.hands.n, o);
        Q2.down.other = (Q2.down.other || 0) + 1; // only a store gone sets a load down here, and the fuzz takes none away
      }
      p.hands = null;
      break;
    }
    case 'work': {
      const k = s.op + ':' + g.owner,
        op = OPS[s.op];
      st.prog[k] = (st.prog[k] || 0) + h; // the work's hours lie on the work, not on the task
      if (st.prog[k] >= op.hours - 1e-9 && op.can(st, g)) {
        op.apply(st, g);
        delete st.prog[k];
      }
      break;
    }
  }
}
// A pawn that cannot walk on (death, illness) sets its load down where it stands, and the cart stands there.
// Q2 (docs/plans/four-scales/README.md, section 4): the loads set down, by their cause, and the hours walked past the day's end with a
// load brought home (a set-down avoided); told, and a set-down with its carrier able to walk on is a violation.
const Q2 = { cause: null, down: {}, home: 0, overtime: 0 };
function fall(st, p) {
  if (p.hands) {
    lay(st, p.at, p.hands.good, p.hands.n, p.hands.owner);
    Q2.down[Q2.cause] = (Q2.down[Q2.cause] || 0) + 1;
  }
  p.hands = null;
  if (holdsCart(st, p)) Object.assign(st.cart, { by: null, at: p.at });
  p.step = null;
}
// The rule for a load in hand, played out (past the end of the working day if need be), with no goal: the pawn free.
function free(st, p) {
  for (let i = 0; i < 6; i++) {
    const s = M.next(st, null, p, V);
    if (s === M.DONE) return;
    assert(s.rule, `a free pawn is given only the rules: ${s.prim}`);
    if (s.prim === 'haul') {
      Q2.overtime += legHours(st, null, p, s);
      Q2.home++;
    }
    endLeg(st, null, p, s, 0);
  }
  assert.fail('the rule for a load in hand did not end');
}

// ---- the firewood table (3.2): each row a check ----
function table(setup, goal = { kind: 'firewood', at: 'forest', owner: 'h', amount: 4 }, max = 40) {
  const st = world(1);
  st.table = true;
  const p = { id: 'A', at: 'h', owner: 'h', hands: null };
  st.pawns.push(p);
  setup(st, p);
  const seq = [];
  for (let i = 0; i < max; i++) {
    const s = M.next(st, goal, p, V);
    if (s === M.DONE || s.blocked) {
      seq.push(s === M.DONE ? 'done' : 'blocked: ' + s.blocked);
      break;
    }
    const h = legHours(st, goal, p, s);
    st.t += h;
    endLeg(st, goal, p, s, h);
    const name = s.prim + (s.op ? ':' + s.op : '');
    if (seq[seq.length - 1] !== name) seq.push(name); // a step taken twice running (two fellings for a cart's load) told once
  }
  return { st, p, seq: seq.join(', ') };
}
const ROW1 = table(() => {});
assert.strictEqual(
  ROW1.seq,
  'fetch, go, work:fell, load, haul, unload, work:cut, return, done',
  'at home, the cart at home, no timber',
);
const ROW2 = table((st, p) => {
  p.at = 'forest';
  st.cart.until = 1e9; // no cart to be had
});
assert(
  ROW2.seq.startsWith('work:fell, load, haul, unload, work:cut, go, '),
  `on the forest tile, no cart: ${ROW2.seq}`,
);
assert(
  ROW2.seq.endsWith('work:cut, done') && !ROW2.seq.includes('fetch'),
  `and back for more on foot until the amount is met: ${ROW2.seq}`,
);
const ROW3 = table((st) => {
  lay(st, 'forest', 'timber', 4, 'h');
  make(st, 'h', 'timber', 4);
});
assert.strictEqual(
  ROW3.seq,
  'fetch, go, load, haul, unload, work:cut, return, done',
  'timber lies at the tile (the night cut the task)',
);
const ROW4 = table((st, p) => {
  p.at = 'road';
  p.hands = { good: 'timber', n: 4, owner: 'h' };
  make(st, 'h', 'timber', 4);
}, null);
assert.strictEqual(ROW4.seq, 'haul, unload, done', 'called off on the road with a load: carried home');
{
  const B = { id: 'B', at: 'h', owner: 'h', hands: null };
  const s = M.next(ROW4.st, { kind: 'firewood', at: 'forest', owner: 'h', amount: 4 }, B, V);
  assert(s.prim === 'work' && s.op === 'cut', 'and the cutting is then open to anyone');
}
const ROW5 = table((st) => {
  st.stores.h.timber = 4;
  make(st, 'h', 'timber', 4);
});
assert.strictEqual(ROW5.seq, 'work:cut, done', 'timber at the farm: cut, no cart fetched');

// The stray method: the owner's timber lying where the wood neither makes nor wants it is fetched first; another owner's is not.
{
  const r = table((st) => {
    lay(st, 'road', 'timber', 2, 'h');
    make(st, 'h', 'timber', 2);
    st.cart.until = 1e9;
  });
  assert(
    r.seq.startsWith('go, load, haul, unload, go, load, haul, unload, work:cut, go'),
    `a stray pile fetched home: ${r.seq}`,
  );
  const c = table((st) => {
    st.trees = 0;
    lay(st, 'road', 'timber', 2, 'c');
    make(st, 'c', 'timber', 2);
  });
  assert.strictEqual(c.seq, 'blocked: no trees standing', `a pile of another owner's is not taken: ${c.seq}`);
  assert(c.st.piles.length === 1 && c.st.piles[0].owner === 'c', 'its title kept');
}
// The rule for a load in hand: another body's load is carried to that body's store, before the goal; its store gone, set down here.
{
  const st = world(2),
    g = { kind: 'firewood', at: 'forest', owner: 'h', amount: 4 };
  const p = { id: 'A', at: 'road', owner: 'h', hands: { good: 'timber', n: 1, owner: 'c' } };
  assert.strictEqual(M.next(st, g, p, V), M.RULE.haul, "a load of c's goes to c's store first");
  assert.strictEqual(M.placeOf(st, M.RULE.haul, g, p, V), 'c');
  st.gone.c = true;
  assert.strictEqual(M.next(st, g, p, V), M.RULE.drop, 'its household gone: set down where it stands');
  p.hands = null;
  const B = { id: 'B', at: 'h', owner: 'h', hands: null };
  st.cart.by = 'B';
  st.stores.h.firewood = 4;
  assert.strictEqual(M.next(st, g, B, V), M.RULE.return, 'the goal met with the cart in hand: the cart taken back');
}
// Blocked with its reason, and the first method whose `when` holds is the one read.
{
  const st = world(3, 0),
    g = { kind: 'firewood', at: 'forest', owner: 'h', amount: 4 },
    p = { id: 'A', at: 'forest', owner: 'h', hands: null };
  st.cart.until = 1e9;
  const s = M.next(st, g, p, V);
  assert(s.blocked === 'no trees standing' && s.step.op === 'fell', `no trees: blocked, with why: ${s.blocked}`);
  const two = M.compile({
    k: {
      met: () => false,
      can: {},
      methods: [
        { name: 'a', when: () => false, steps: [{ prim: 'wait', eff: [{ met: true }] }] },
        { name: 'b', steps: [{ prim: 'mind', eff: [{ met: true }] }] },
      ],
    },
  });
  assert.strictEqual(
    M.next(st, { kind: 'k', owner: 'h' }, p, { ...V, plans: two }).prim,
    'mind',
    'the first method whose when holds',
  );
  for (const bad of [
    { methods: [{ steps: [{ prim: 'fly' }] }] },
    { methods: [{ steps: [{ prim: 'go', pre: [{ near: 'site' }] }] }] },
    { methods: [1, 2, 3, 4].map(() => ({ steps: [{ prim: 'go' }] })) },
    { methods: [{ steps: Array.from({ length: 8 }, () => ({ prim: 'go' })) }] },
  ])
    assert.throws(
      () => M.compile({ bad }),
      /sim\/methods/,
      'a method out of the vocabulary or the bounds is refused at load',
    );
  assert.deepStrictEqual(M.compile({ plain: { hours: 1 } }), {}, 'a kind with no methods is not compiled');
}

// ---- the fuzz ----
const CUTS = ['night', 'call', 'death', 'illness', 'cartTaken', 'none'];
const GOAL = (o) => ({ kind: 'firewood', at: 'forest', owner: o, amount: 4 });
const timberOf = (st, o) =>
  st.stores[o].timber + st.piles.reduce((n, x) => n + (x.owner === o && x.good === 'timber' ? x.n : 0), 0);
// The means of the goal in the world: trees standing, or the owner's timber in its store or lying anywhere (a load in another's hands is
// not this pawn's means now).
const means = (st, o) => st.trees > 0 || timberOf(st, o) > 0;
function massOK(st) {
  for (const o of OWNERS)
    for (const g of GOODS) {
      let n = st.stores[o][g];
      for (const x of st.piles) if (x.owner === o && x.good === g) n += x.n;
      for (const p of st.pawns) if (p.hands && p.hands.owner === o && p.hands.good === g) n += p.hands.n;
      if (Math.abs(n - (st.made[o][g] - st.used[o][g] - st.rotted[o][g])) > 1e-9)
        return `${o} ${g}: ${n} held against ${st.made[o][g] - st.used[o][g] - st.rotted[o][g]}`;
    }
  for (const x of st.piles)
    if (!OWNERS.includes(x.owner) || !(x.n > 0)) return `a pile with no title or nothing in it: ${JSON.stringify(x)}`;
  return null;
}
function run(seed) {
  const st = world(seed),
    r = () => rnd(st.rng);
  const cut = CUTS[Math.floor(r() * CUTS.length)],
    cutLeg = 1 + Math.floor(r() * 8),
    two = r() < 0.5; // a second owner's goal, the one cart between them
  st.trees = r() < 0.2 ? Math.floor(r() * 3) : 100; // sometimes too few trees: the goal may be blocked, rightly
  if (r() < 0.3) {
    const at = PLACES[Math.floor(r() * PLACES.length)],
      o = r() < 0.5 ? 'h' : 'c';
    if (at !== o) {
      lay(st, at, 'timber', 1 + Math.floor(r() * 3), o); // a pile left lying from before: a stray, or the forest's own
      make(st, o, 'timber', pileN(st, at, 'timber', o));
    }
  }
  const goals = { h: GOAL('h'), c: two ? GOAL('c') : null };
  // A works h's goal from day 0, D c's; B and C, h's own, from day 1 (so that A's cut is A's alone on the first day).
  for (const [id, o, from] of [
    ['A', 'h', 0],
    ['B', 'h', 1],
    ['C', 'h', 1],
    ['D', 'c', 0],
  ])
    st.pawns.push({
      id,
      at: o,
      owner: o,
      hands: null,
      alive: true,
      abed: -1,
      from,
      called: -1,
      step: null,
      h: 0,
      until: 0,
      start: 0,
    });
  const A = st.pawns[0];
  let legsA = 0,
    cutDone = false;
  const out = { cut, v: [], blocked: 0, falseBlocked: 0, asks: 0 };
  const able = (p, day) => p.alive && p.abed < st.t && day >= p.from && p.called < day && !!goals[p.owner];
  for (let day = 0; day < 4; day++) {
    st.end = day * 24 + WORK1;
    for (const p of st.pawns) Object.assign(p, { until: day * 24 + WORK0, step: null });
    for (let guard = 0; guard < 600; guard++) {
      let p = null;
      for (const q of st.pawns) if (q.alive && q.until < Infinity && (!p || q.until < p.until)) p = q;
      if (!p) break;
      st.t = Math.max(st.t, Math.min(p.until, st.end));
      if (p.step) {
        // a work leg the night cut short is credited its hours to the night; a walk arrives
        const h = p.step.prim === 'work' ? Math.max(0, Math.min(p.until, st.end) - p.start) : p.h;
        endLeg(st, goals[p.owner], p, p.step, h);
        p.step = null;
        if (p === A) legsA++;
      }
      if (!cutDone && p === A && legsA >= cutLeg) {
        cutDone = true;
        if (cut === 'night') st.end = st.t; // the day ends here for all
        if (cut === 'call') A.called = day; // called away for the day: it carries what it holds home, and goes
        Q2.cause = cut;
        if (cut === 'death') {
          fall(st, A);
          A.alive = false;
          continue;
        }
        if (cut === 'illness') {
          fall(st, A);
          A.abed = st.t + 48;
          A.until = Infinity;
          continue;
        }
        if (cut === 'cartTaken' && st.cart.by !== A.id) st.cart.until = st.t + 30; // taken for other work, wherever it stands
        if (cut === 'cartTaken' && st.cart.by === A.id && !A.hands)
          Object.assign(st.cart, { by: null, at: A.at, until: st.t + 30 });
      }
      if (st.t >= st.end) {
        free(st, p); // the day's end: a load in hand goes home past it, the cart is taken back
        p.until = Infinity;
        continue;
      }
      const g = able(p, day) ? goals[p.owner] : null;
      let s = M.next(st, g, p, V);
      out.asks++;
      if (s.blocked) {
        out.blocked++;
        if (means(st, g.owner)) {
          out.falseBlocked++;
          out.v.push(`false blocked (${s.blocked}) with the means at hand`);
          if (process.env.DEBUG)
            console.error(
              p.id,
              p.at,
              JSON.stringify(p.hands),
              st.trees,
              JSON.stringify(st.piles),
              JSON.stringify(st.stores),
              JSON.stringify(st.cart),
              st.t,
            );
        }
        s = M.next(st, null, p, V); // blocked: what it holds goes home, then it waits an hour and asks again
        if (s === M.DONE) s = { prim: 'wait' };
      }
      if (s === M.DONE) {
        p.until = Infinity;
        continue;
      }
      p.step = s;
      p.start = st.t;
      p.h = legHours(st, g, p, s);
      p.until = st.t + p.h;
    }
    // the night: every pawn home with nothing in hand; a pile lying a day may rot
    for (const p of st.pawns) {
      if (p.alive && p.abed < st.t) {
        if (p.hands || holdsCart(st, p))
          out.v.push(`${p.id} ends the day holding ${p.hands ? p.hands.good : 'the cart'}`);
        p.at = p.owner;
      }
    }
    for (const x of st.piles.slice())
      if (st.t - x.t >= ROT && r() < 0.3) {
        st.rotted[x.owner][x.good] += x.n;
        st.piles.splice(st.piles.indexOf(x), 1);
      }
  }
  const mass = massOK(st);
  if (mass) out.v.push('mass: ' + mass);
  // no stuck task: a goal not met is met by the next fresh pawn's ask (a step), or is blocked for want of means, rightly, with why
  st.t = 4 * 24 + WORK0;
  for (const o of OWNERS) {
    const g = goals[o];
    if (!g || FIREWOOD.met(st, g)) continue;
    const s = M.next(st, g, { id: 'X', at: o, owner: o, hands: null }, V);
    if (s === M.DONE) out.v.push(`${o}: done, not met`);
    else if (s.blocked && means(st, o)) out.v.push(`${o}: stuck, blocked (${s.blocked}) with the means at hand`);
    else if (!s.blocked && !means(st, o)) out.v.push(`${o}: a step with no means`);
    else if (s.blocked && !s.blocked.length) out.v.push(`${o}: blocked with no reason`);
    else if (!s.blocked) out.v.push(`${o}: unmet after four days with the means at hand`); // liveness: three pawns, four days
  }
  return out;
}
Object.assign(Q2, { cause: null, down: {}, home: 0, overtime: 0 }); // the fuzz's alone, not the table's
const tally = { runs: RUNS, violations: 0, byCut: {}, asks: 0, blocked: 0 };
for (let i = 0; i < RUNS; i++) {
  const o = run(i + 1);
  tally.asks += o.asks;
  tally.blocked += o.blocked;
  if (o.v.length) {
    tally.violations++;
    tally.byCut[o.cut] = (tally.byCut[o.cut] || 0) + 1;
    if (tally.violations <= 3) console.error(`run ${i + 1} (${o.cut}): ${o.v.join('; ')}`);
  }
}
assert.strictEqual(tally.violations, 0, `the fuzz: ${JSON.stringify(tally)}`);
assert(!Q2.down.other, `a load set down with its carrier able to walk on: ${JSON.stringify(Q2.down)}`);
const downs = Object.values(Q2.down).reduce((x, y) => x + y, 0),
  downBy =
    Object.entries(Q2.down)
      .map(([k, n]) => `${k} ${n}`)
      .join(', ') || 'none';

// ---- the cost of an ask (told, not asserted: others share the machine; the measured Q4 is VB-1750's) ----
if (TIMES) {
  const states = [];
  for (let i = 0; i < 200; i++) {
    const st = world(900 + i),
      r = () => rnd(st.rng),
      o = r() < 0.5 ? 'h' : 'c';
    const p = {
      id: 'A',
      at: PLACES[Math.floor(r() * PLACES.length)],
      owner: o,
      hands: r() < 0.3 ? { good: 'timber', n: 1, owner: o } : null,
    };
    if (r() < 0.3) st.cart.by = 'A';
    if (r() < 0.5) {
      lay(st, 'forest', 'timber', 2, o);
      st.stores[o].timber = 2;
    }
    if (r() < 0.3) lay(st, 'road', 'timber', 1, o);
    states.push([st, GOAL(o), p]);
  }
  let x = 0;
  const t0 = process.hrtime.bigint(); // lint-allow: clock a test's timing, told
  for (let i = 0; i < TIMES; i++) {
    const [st, g, p] = states[i % states.length];
    if (M.next(st, g, p, V) !== M.DONE) x++;
  }
  const us = Number(process.hrtime.bigint() - t0) / TIMES / 1000; // lint-allow: clock a test's timing, told
  console.log(
    `methods: ${TIMES} asks, ${us.toFixed(3)} µs an ask; at the late reference (1,000 pawns × 9 leg ends × 1.6 asks) ${((us * 1000 * 9 * 1.6) / 1000).toFixed(2)} ms a game day, against 5 ms (${x})`,
  );
}
console.log(
  `methods: the firewood table's five rows; ${RUNS} fuzzed runs, ${tally.asks} asks, ${tally.blocked} rightly blocked, no violation; Q2: ${downs} loads set down (${downBy}), ${Q2.home} brought home past the day's end, ${(Q2.overtime / Math.max(1, Q2.home)).toFixed(2)} h walked over time each`,
);

// ---- VB-1775: the wood in a real state (a tiny village, tests/firewood.js's): sim/doing's view asked of the game's state ----
// The firewood table's five rows, the work leg's tree, a pile with title taken up by another hand, a load in hand carried home past the
// working day, set down where its carrier dies, a stray pile fetched, and no fetch kind for the wood. A row's walks are made at once (the
// pawn set at the place its step names): the legs are the view's and the effects the game's (sim/doing load, unload, work; sim/carts).
{
  const Sim = VB.sim,
    Doing = VB['sim/doing'],
    Lying = VB['sim/lying'],
    Carts = VB['sim/carts'],
    Agents = VB['sim/agents'],
    Jobs = VB['sim/jobs'],
    { KINDS } = VB['sim/kinds'],
    { TRAVEL, WORK, DAY, cal } = VB['sim/rules'],
    { here } = VB['sim/pose'];
  const { tinyWorld, tinyState } = require('./lib/tiny.js'),
    { checkState } = require('./lib/invariants.js');
  const rows = Array.from({ length: 12 }, (_, i) => (i < 2 ? 'FFFFFFFFFFFFFFFF' : '................'));
  const make = () => {
    const st = tinyState(tinyWorld(rows), [{ at: [8, 7], farms: 3 }], { seed: 4 });
    st.naturalDeaths = false;
    Sim.advance(st, 3);
    return st;
  };
  const P = (st) => st.ECON.woodPerTrip;
  const title = (hh) => ({ type: 'household', id: hh.id });
  const setAt = (st, a, t) => Object.assign(a, { x: st.w.hx[t], y: st.w.hy[t], path: null, inside: false });
  const members = (st, hh) => st.pawns.filter((p) => p.alive && p.household === hh.id).map((p) => st.agents[p.id]);
  // a world for one row: household 0 with its house, forest and a hand cart or none; its pawn idle at `from`, empty-handed, on goal `kind`
  function row(kind, { cart = true, from = 'house', timber = 0, amount = 1 } = {}) {
    const st = make(),
      hh = st.households[0],
      f = st.farmsteads[hh.farmstead],
      forest = st.villages[f.village].wood[0];
    hh.carts = cart ? [{ kind: 'hand', cond: 1, built: st.t, by: null }] : [];
    hh.timber = timber;
    hh.wood = 0;
    const a = members(st, hh)[0];
    Object.assign(a, { load: 0, carry: null });
    setAt(st, a, from === 'house' ? f.house : from === 'forest' ? forest : from);
    a.job = {
      key: `test:${kind}`,
      kind,
      owner: title(hh),
      site: kind === 'wood' ? forest : f.house,
      farm: f,
      claims: [a.id],
      amount: amount * P(st),
    };
    return { st, hh, f, forest, a };
  }
  // the legs asked and carried out until the goal is met (consecutive repeats of one leg as one), with what each work leg did
  function play(st, a, max = 60) {
    const legs = [],
      seen = [];
    for (let i = 0; i < max; i++) {
      const s = Doing.ask(st, a);
      if (s === M.DONE) return { legs, seen, done: true };
      if (s.blocked) return { legs: legs.concat('blocked'), seen, done: false };
      const name = s.prim === 'work' ? s.op : s.prim;
      if (legs[legs.length - 1] !== name) legs.push(name);
      const at = here(st, a),
        to = Doing.placeOf(st, a, s);
      if (s.prim === 'load') Doing.load(st, a, s);
      else if (s.prim === 'unload') Doing.unload(st, a, s, a.x, a.y);
      else if (s.prim === 'work') {
        const trees = st.w.trees[at];
        Doing.work(st, a, s);
        seen.push({ op: s.op, at, felled: trees - st.w.trees[at] });
      } else if (s.prim === 'return') Carts.home(st, st.households[st.pawns[a.id].household], a.id);
      else if (s.prim === 'fetch' && to === at) {
        Doing.takeCart(st, a);
      } else {
        setAt(st, a, to);
      }
    }
    return { legs, seen, done: false };
  }
  const same = (got, want, what) => assert.deepStrictEqual(got, want, `${what}: ${got.join(', ')}`);

  // row 1: at home, the cart at home, no timber: fetch the cart, go, fell, load, haul, unload, cut, leave the cart
  {
    const { st, hh, forest, a } = row('firewood', { amount: 2 });
    const t0 = st.w.trees[forest];
    const r = play(st, a);
    assert(r.done, `row 1 met: ${r.legs.join(', ')}`);
    same(r.legs, ['fetch', 'go', 'fell', 'load', 'haul', 'unload', 'cut', 'return'], 'row 1');
    // the tree falls at the work leg, the felling's: two felled, a load each, at the forest
    const fells = r.seen.filter((x) => x.op === 'fell');
    assert(
      fells.length === 2 && fells.every((x) => x.at === forest && Math.abs(x.felled - 1) < 1e-9),
      'a tree a fell leg',
    );
    assert(Math.abs(t0 - st.w.trees[forest] - 2) < 1e-9, 'two trees fewer');
    assert(Math.abs(hh.wood - 2 * P(st)) < 1e-9 && !(hh.timber > 1e-9), `two loads cut: ${hh.wood}, ${hh.timber}`);
    assert(
      hh.carts[0].by === null && !Lying.amountAt(st, forest, 'wood', title(hh)),
      'the cart left at home, nothing lying',
    );
  }
  // row 2: on the forest tile for another reason, no cart: fell, load on the back, haul, unload, cut, and back for more until met
  {
    const { st, hh, a } = row('firewood', { cart: false, from: 'forest', amount: 2 });
    const r = play(st, a);
    assert(r.done, `row 2 met: ${r.legs.join(', ')}`);
    same(r.legs, ['fell', 'load', 'haul', 'unload', 'cut', 'go', 'fell', 'load', 'haul', 'unload', 'cut'], 'row 2');
    assert(Math.abs(hh.wood - 2 * P(st)) < 1e-9, 'two loads cut');
  }
  // row 3: timber lies at the tile (the night cut the task): fetch the cart, go, load, haul, unload, cut; no tree felled
  {
    const { st, hh, forest, a } = row('firewood', { amount: 2 });
    Lying.put(st, 'wood', 2 * TRAVEL.load, forest, title(hh));
    const t0 = st.w.trees[forest];
    const r = play(st, a);
    assert(r.done, `row 3 met: ${r.legs.join(', ')}`);
    same(r.legs, ['fetch', 'go', 'load', 'haul', 'unload', 'cut', 'return'], 'row 3');
    assert(
      st.w.trees[forest] === t0 && !Lying.amountAt(st, forest, 'wood', title(hh)),
      'the pile taken up, no tree felled',
    );
  }
  // row 4: called off on the road with a load: haul, unload (the rule for a load in hand, the goal gone); the cutting is then open to anyone
  {
    const { st, hh, f, forest, a } = row('wood', { cart: false });
    const road = st.w.nb[f.house * 6] >= 0 ? st.w.nb[f.house * 6] : forest;
    setAt(st, a, road);
    Object.assign(a, { load: TRAVEL.load, carry: 'logs' });
    const s1 = M.next(st, null, a, Doing.VIEW);
    assert(s1 === M.RULE.haul, `called off with a load: haul (${JSON.stringify(s1)})`);
    setAt(st, a, f.house);
    const s2 = M.next(st, null, a, Doing.VIEW);
    assert(s2 === M.RULE.unload, 'at home: unload');
    Doing.unload(st, a, s2, a.x, a.y);
    assert(Math.abs(hh.timber - P(st)) < 1e-9 && a.load === 0, 'the load in the store');
    const b = members(st, hh)[1];
    Object.assign(b, { load: 0, carry: null });
    setAt(st, b, forest);
    b.job = {
      key: 'test:fw',
      kind: 'firewood',
      owner: title(hh),
      site: f.house,
      farm: f,
      claims: [b.id],
      amount: P(st),
    };
    same(play(st, b).legs, ['go', 'cut'], 'row 4, the cutting by another hand');
  }
  // row 5: timber at the farm: cut
  {
    const { st, hh, a } = row('firewood', { timber: 3 });
    same(play(st, a).legs, ['cut'], 'row 5');
    assert(Math.abs(hh.wood - P(st)) < 1e-9, 'a load cut');
  }
  // timber felled lies at the tile as a pile with title, the household's, and is taken up by any of its hands
  {
    const { st, hh, forest, a } = row('wood', { cart: false, from: 'forest' });
    const s = Doing.ask(st, a);
    assert(s.prim === 'work' && s.op === 'fell', 'the first leg at the forest: fell');
    Doing.work(st, a, s);
    assert(
      Lying.amountAt(st, forest, 'wood', title(hh)) === TRAVEL.load,
      'the felled load lies, its title the household',
    );
    const b = members(st, hh)[2];
    Object.assign(b, { load: 0, carry: null });
    setAt(st, b, forest);
    b.job = { ...a.job, claims: [b.id] };
    a.job = null;
    const s2 = Doing.ask(st, b);
    assert(s2.prim === 'load', `another hand at the tile loads it (${s2.prim})`);
    Doing.load(st, b, s2);
    assert(b.load === TRAVEL.load && !Lying.amountAt(st, forest, 'wood', title(hh)), 'taken up by another hand');
  }
  // the stray method: the household's timber lying where the wood neither makes nor wants it is fetched home; another's is not looked at
  {
    const { st, hh, f, forest, a } = row('wood', { cart: false });
    const away = st.villages[f.village].wood[2],
      other = st.households[1];
    Lying.put(st, 'wood', TRAVEL.load, away, title(other));
    assert(
      Lying.strayOf(st, title(hh), 'wood', forest, f.house) === null,
      "another household's pile is not this one's stray",
    );
    Lying.put(st, 'wood', TRAVEL.load, away, title(hh));
    assert(st.lyingBy instanceof Map && st.lyingBy.get(`household:${hh.id}`).length === 1, 'piles indexed by owner');
    assert(Lying.strayOf(st, title(hh), 'wood', forest, f.house) === away, "the household's stray pile found");
    const s = Doing.ask(st, a);
    assert(s.prim === 'go' && s.at === 'stray' && Doing.placeOf(st, a, s) === away, 'the stray pile first');
    const r = play(st, a);
    assert(r.legs.slice(0, 4).join() === 'go,load,haul,unload', `fetched home: ${r.legs.join(', ')}`);
    assert(
      !Lying.amountAt(st, away, 'wood', title(hh)) && Lying.amountAt(st, away, 'wood', title(other)) === TRAVEL.load,
      'its own only',
    );
  }
  // VB-1813: a trip's good is named by what it is: the stone a pick trip set down is the stray of a quarry goal of its owner, and the fish
  // of a fishing trip the stray of a rackfish goal (the pile lies as `stone`, `fish`, not as the kind that made it)
  for (const [made, wants, good] of [
    ['pick', 'quarry', 'stone'],
    ['fish', 'rackfish', 'fish'],
  ]) {
    const { st, hh, f, a } = row(wants, { cart: false }),
      away = st.villages[f.village].wood[2];
    assert(
      Doing.planOf(made).uses[0] === good && Doing.planOf(wants).uses[0] === good,
      `${made} and ${wants} use ${good}`,
    );
    Object.assign(a, { load: TRAVEL.load, carry: null });
    a.job = { ...a.job, kind: made, key: `test:${made}`, site: away };
    setAt(st, a, away);
    Doing.unload(st, a, M.RULE.drop, a.x, a.y);
    assert(
      Lying.amountAt(st, away, good, title(hh)) > 0 && (made === good || !Lying.amountAt(st, away, made, title(hh))),
      `${made}'s load lies as ${good}`,
    );
    a.job = { ...a.job, kind: wants, key: `test:${wants}`, site: f.house };
    setAt(st, a, f.house);
    assert(Lying.strayOf(st, title(hh), good, f.house, f.house) === away, `the pile is found by a ${wants} goal`);
    const s = Doing.ask(st, a);
    assert(
      s.prim === 'go' && s.at === 'stray' && Doing.placeOf(st, a, s) === away,
      `${wants} goes to the stray ${good} first`,
    );
  }
  // the fetch kinds: none (the wood's piles are the stray method's; VB-1821: the name of one gone, sim/lying fetchKey); and no fetch task posted
  {
    assert(KINDS.wood.methods && KINDS.firewood.methods, 'the wood has methods');
    // VB-1814: no fetch kind at all; the goods left lying with no goal of their own are each a goal's with the stray method alone
    assert(!Object.keys(KINDS).some((k) => /^fetch[A-Z]/.test(k)), 'no fetch kind');
    for (const k of Object.values(Lying.BRING)) assert(KINDS[k].methods && KINDS[k].strays, `${k}: a goal of strays`);
    const { st, hh } = row('wood');
    const l = Lying.put(st, 'wood', TRAVEL.load, st.villages[0].wood[1], title(hh));
    Sim.advance(st, 2);
    assert(!st.jobs.has(`fetch:L${l.id}`), 'no fetch task posted for a pile of timber');
  }
  // a load in hand goes home past the end of the working day; set down as a pile with title only when its carrier cannot walk on (death)
  for (const dies of [false, true]) {
    const st = make(),
      hh = st.households[0],
      f = st.farmsteads[hh.farmstead],
      forest = st.villages[f.village].wood[0];
    while (cal(st.t).hour < WORK[1] + 0.5 || cal(st.t).hour > WORK[1] + 1) Sim.advance(st, 0.2);
    const a = members(st, hh).find((b) => !b.job && !b.path);
    assert(a, 'an idle hand after the working day');
    setAt(st, a, forest);
    Object.assign(a, { load: TRAVEL.load, carry: 'logs' });
    const j = Jobs.post(st, `test:wood:h${hh.id}`, 'wood', title(hh), forest, {
      farm: f,
      chosen: false,
      amount: 9 * P(st),
    });
    const t0 = hh.timber || 0;
    Agents.start(st, a, j);
    assert(a.load > 0 && a.path && a.job === j, `past the working day, it hauls home (${a.leg && a.leg.kind})`);
    if (dies) {
      Sim.advance(st, 0.2);
      const at = here(st, a);
      VB['sim/lifecycle'].killPawn(st, a.id);
      assert(
        Lying.amountAt(st, at, 'wood', title(hh)) === TRAVEL.load,
        "its load set down where it died, the household's",
      );
      assert((hh.timber || 0) === t0, 'none of it home');
    } else {
      for (let i = 0; i < 40 && a.load > 0; i++) Sim.advance(st, 0.1);
      assert(a.load === 0 && Math.abs((hh.timber || 0) - t0 - P(st)) < 1e-9, `the load home: ${hh.timber}`);
      const h = cal(st.t).hour;
      assert(h >= WORK[1] || h < WORK[0], 'after the working day');
      assert(!(st.lying || []).some((l) => l.owner.id === hh.id && l.kind === 'wood'), 'nothing set down on the way');
    }
    Sim.advance(st, DAY);
    assert.deepStrictEqual(checkState(st), [], 'invariants');
  }
  // VB-1893: called home with a load in hand (the verb goHome, as the head's call and a controller's queued one issue it): not urgent, the
  // load reaches the store and the hand is then off; urgent, it lies as a titled pile where it stood and the hand comes at once
  for (const urgent of [false, true]) {
    const st = make(),
      hh = st.households[0],
      f = st.farmsteads[hh.farmstead],
      forest = st.villages[f.village].wood[0];
    while (cal(st.t).hour < WORK[0] + 1 || cal(st.t).hour > WORK[0] + 3) Sim.advance(st, 0.2);
    const a = members(st, hh).find((b) => !b.job && !b.path);
    setAt(st, a, forest);
    Object.assign(a, { load: TRAVEL.load, carry: 'logs' });
    const j = Jobs.post(st, `test:wood:h${hh.id}`, 'wood', title(hh), forest, {
      farm: f,
      chosen: false,
      amount: 9 * P(st),
    });
    const t0 = hh.timber || 0;
    Agents.start(st, a, j);
    assert(a.load > 0 && a.path && a.job === j, 'hauls home');
    Sim.advance(st, 0.1);
    const at = here(st, a);
    VB['sim/commands'].issue(st, {
      actor: a.id,
      verb: 'goHome',
      args: urgent ? { urgent: true } : undefined,
      source: 'planner',
    });
    if (urgent) {
      assert(a.load === 0 && a.homeward, 'urgent: it comes at once');
      assert(
        Lying.amountAt(st, at, 'wood', title(hh)) === TRAVEL.load,
        'the load lies as a pile with title where it stood',
      );
    } else {
      assert(a.load > 0 && a.sentHome && !a.homeward, 'not urgent: the load first');
      for (let i = 0; i < 60 && !(a.inside && a.load === 0); i++) Sim.advance(st, 0.1);
      assert(a.load === 0 && Math.abs((hh.timber || 0) - t0 - P(st)) < 1e-9, `the load home: ${hh.timber}`);
      assert(a.inside && !a.job && !a.sentHome, 'and the hand is then off, at home');
      assert(!(st.lying || []).some((l) => l.owner.id === hh.id && l.kind === 'wood'), 'nothing set down on the way');
    }
    assert.deepStrictEqual(checkState(st), [], 'invariants');
  }
  // VB-1926: the head calls a member with a load in hand to another task (the verb call, {member, key}): not urgent, the load reaches the
  // store before the member is at the task called, which it aims to reach within MATCH.day.within; urgent, the load lies as a titled pile
  // where it stood and the member is there sooner
  const came = {};
  for (const urgent of [false, true]) {
    const st = make(),
      hh = st.households[0],
      f = st.farmsteads[hh.farmstead],
      forest = st.villages[f.village].wood[0];
    while (cal(st.t).hour < WORK[0] + 1 || cal(st.t).hour > WORK[0] + 3) Sim.advance(st, 0.2);
    const day = st.plans.households.get(hh.id).day,
      a = members(st, hh).find((b) => !b.job && !b.path && b.id !== hh.holder && day.lists[b.id]);
    assert(a, 'a member with a list in the day');
    setAt(st, a, forest);
    Object.assign(a, { load: TRAVEL.load, carry: 'logs' });
    const j = Jobs.post(st, `test:wood:h${hh.id}`, 'wood', title(hh), forest, {
        farm: f,
        chosen: false,
        amount: 9 * P(st),
      }),
      fd = f.fields[0];
    fd.stage = 'stubble';
    const to = Jobs.post(st, `test:plow:h${hh.id}`, 'plow', title(hh), fd.tile, { field: fd, farm: f });
    const t0 = hh.timber || 0;
    Agents.start(st, a, j);
    Sim.advance(st, 0.1);
    const at = here(st, a),
      t1 = st.t;
    const r = Sim.head(st, hh.holder, 'call', {
      member: a.id,
      key: to.key,
      ...(urgent ? { urgent: true } : {}),
      demand: true,
    });
    assert.strictEqual(r, true, `the call is made: ${r}`);
    if (urgent) {
      assert(
        a.load === 0 && a.job === to && !a.calledTo,
        `urgent: it comes now: ${a.load} ${a.job && a.job.key} ${JSON.stringify(a.calledTo)}`,
      );
      assert(
        Lying.amountAt(st, at, 'wood', title(hh)) === TRAVEL.load,
        'the load lies as a pile with title where it stood',
      );
    } else {
      assert(a.load > 0 && a.job === j && a.calledTo && a.calledTo.key === to.key, 'not urgent: the load first');
      assert(
        Math.abs(a.calledTo.by - t1 - VB['sim/roles'].MATCH.day.within) < 1e-9,
        'aiming to be there within the hour',
      );
      assert(
        /brings its load in first/.test(Sim.reasonLine(st, a.id)),
        `its card says so: ${Sim.reasonLine(st, a.id)}`,
      );
    }
    let home = null;
    for (let i = 0; i < 80 && !(a.job === to && VB['sim/pose'].atWork(a)); i++) {
      Sim.advance(st, 0.1);
      if (home === null && (hh.timber || 0) > t0) home = st.t;
    }
    assert(a.job === to && VB['sim/pose'].atWork(a), `at the task called (urgent ${urgent})`);
    came[urgent] = st.t - t1;
    if (!urgent)
      assert(came[urgent] <= VB['sim/roles'].MATCH.day.within + 0.25, `there within about the hour: ${came[urgent]} h`);
    if (!urgent) {
      assert(home !== null && home <= t1 + came[urgent], 'the load reached the store before the member came');
      assert(!(st.lying || []).some((l) => l.owner.id === hh.id && l.kind === 'wood'), 'nothing set down on the way');
    }
    assert.deepStrictEqual(checkState(st), [], 'invariants');
  }
  assert(came[true] < came[false], `urgent, it is there sooner (${came[true]} h, against ${came[false]} h)`);
  // VB-1926 review, F1: a call home after a call to a task that waits for the load stands in its place: once the load is in the member
  // goes in, and does not set out for the task called
  {
    const st = make(),
      hh = st.households[0],
      f = st.farmsteads[hh.farmstead],
      forest = st.villages[f.village].wood[0];
    while (cal(st.t).hour < WORK[0] + 1 || cal(st.t).hour > WORK[0] + 3) Sim.advance(st, 0.2);
    const day = st.plans.households.get(hh.id).day,
      a = members(st, hh).find((b) => !b.job && !b.path && b.id !== hh.holder && day.lists[b.id]);
    setAt(st, a, forest);
    Object.assign(a, { load: TRAVEL.load, carry: 'logs' });
    const j = Jobs.post(st, `test:wood:h${hh.id}`, 'wood', title(hh), forest, {
        farm: f,
        chosen: false,
        amount: 9 * P(st),
      }),
      fd = f.fields[0];
    fd.stage = 'stubble';
    const to = Jobs.post(st, `test:plow:h${hh.id}`, 'plow', title(hh), fd.tile, { field: fd, farm: f });
    Agents.start(st, a, j);
    Sim.advance(st, 0.1);
    assert.strictEqual(
      Sim.head(st, hh.holder, 'call', { member: a.id, key: to.key, demand: true }),
      true,
      'called to the task',
    );
    assert(a.calledTo, 'the load first');
    assert.strictEqual(Sim.head(st, hh.holder, 'call', { member: a.id }), true, 'then called home');
    for (let i = 0; i < 60 && !(a.inside && a.load === 0); i++) Sim.advance(st, 0.1);
    assert(
      a.inside && a.job !== to && !a.calledTo,
      `called home, it goes in: job ${a.job && a.job.key}, inside ${a.inside}`,
    );
    assert.deepStrictEqual(checkState(st), [], 'invariants');
  }
  console.log(
    'methods: the wood in a real state: the five rows, the felled pile, a load in hand, the stray pile, no fetch kind',
  );
}

// VB-1775, review F1: a save from before the wood had methods may hold a fetch task of timber (fetchWood), a kind this build has no
// more: loaded, the task is taken down, its hands are freed where they stand (a load in hand set down there as the household's pile),
// and the run goes on two days with its invariants
{
  const Sim = VB.sim,
    Lying = VB['sim/lying'],
    Agents = VB['sim/agents'],
    { KINDS } = VB['sim/kinds'],
    { TRAVEL, DAY } = VB['sim/rules'];
  const { tinyWorld, tinyState } = require('./lib/tiny.js'),
    { checkState } = require('./lib/invariants.js');
  const rows = Array.from({ length: 12 }, (_, i) => (i < 2 ? 'FFFFFFFFFFFFFFFF' : '................'));
  const st = tinyState(tinyWorld(rows), [{ at: [8, 7], farms: 3 }], { seed: 4 });
  st.naturalDeaths = false;
  Sim.advance(st, 3);
  const hh = st.households[0],
    f = st.farmsteads[hh.farmstead],
    forest = st.villages[f.village].wood[0],
    owner = { type: 'household', id: hh.id };
  assert(!KINDS.fetchWood, 'no fetch kind for the wood');
  const l = Lying.put(st, 'wood', TRAVEL.load, forest, owner);
  const [a, b] = st.pawns.filter((p) => p.alive && p.household === hh.id).map((p) => st.agents[p.id]);
  for (const [p, key, back] of [
    [a, `fetch:L${l.id}`, false],
    [b, 'fetch:L999', true],
  ]) {
    if (p.job) Agents.release(st, p);
    const j = {
      id: ++st.jobSeq,
      key,
      kind: 'fetchWood',
      owner,
      site: forest,
      done: 0,
      claims: [p.id],
      posted: st.t,
      live: true,
    };
    st.jobs.set(key, j);
    Object.assign(p, { job: j, load: back ? TRAVEL.load : 0, carry: back ? 'logs' : null });
    const to = back ? f.house : forest;
    Agents.walkTo(st, p, to, st.w.hx[to], st.w.hy[to]);
  }
  const data = JSON.parse(JSON.stringify(Sim.save(st)));
  const back = Sim.load(tinyWorld(rows), data);
  assert(![...back.jobs.values()].some((j) => !KINDS[j.kind]), 'no task of an unknown kind loaded');
  assert(back.agents[a.id].job === null && back.agents[b.id].job === null, 'its hands freed');
  assert(Lying.amountAt(back, forest, 'wood', owner) === TRAVEL.load, 'the pile it was to fetch still lies');
  const laid = (back.lying || []).filter((x) => x.kind === 'wood' && x.owner.id === hh.id && x.tile !== forest);
  assert(laid.length === 1 && laid[0].n === TRAVEL.load, 'the load in hand set down where its carrier stood');
  Sim.advance(back, 2 * DAY);
  assert.deepStrictEqual(checkState(back), [], 'invariants, two days on');
  console.log('methods: an older save with a fetch task of timber loads and runs on');
}

// VB-1814: a save from before the goods left lying were goals' strays may hold a fetch task of grain left lying (fetchLeftGrain): loaded,
// the task is taken down, a load in hand set down where its carrier stood with its crops, and the household's goal for the grain left
// lying (sim/lying BRING) brings both piles home, each by its crops
{
  const Sim = VB.sim,
    Lying = VB['sim/lying'],
    Agents = VB['sim/agents'],
    Stores = VB['sim/stores'],
    { KINDS } = VB['sim/kinds'],
    { DAY } = VB['sim/rules'];
  const { tinyWorld, tinyState } = require('./lib/tiny.js'),
    { checkState } = require('./lib/invariants.js');
  const rows = Array.from({ length: 12 }, () => '................');
  const st = tinyState(tinyWorld(rows), [{ at: [4, 6], farms: 3 }], { seed: 5 });
  st.naturalDeaths = false;
  Sim.advance(st, 3);
  const hh = st.households[0],
    f = st.farmsteads[hh.farmstead],
    owner = { type: 'household', id: hh.id },
    C = st.w.COLS,
    away = 6 * C + 13;
  assert(!KINDS.fetchLeftGrain && KINDS.leftGrain, 'no fetch kind for the grain left lying, a goal of its own');
  const l = Lying.leave(st, 'leftGrain', 20, away, owner, { of: { parts: { barley: 20 } } });
  const [a, b] = st.pawns.filter((p) => p.alive && p.household === hh.id && p.age >= 14).map((p) => st.agents[p.id]);
  for (const [p, key, back] of [
    [a, `fetch:L${l.id}`, false],
    [b, 'fetch:L999', true],
  ]) {
    if (p.job) Agents.release(st, p);
    const j = {
      id: ++st.jobSeq,
      key,
      kind: 'fetchLeftGrain',
      owner,
      site: away,
      done: 0,
      claims: [p.id],
      posted: st.t,
      live: true,
      lying: back ? 999 : l.id,
      parts: back ? { rye: 10 } : { barley: 20 },
      left: back ? 0 : 20,
    };
    st.jobs.set(key, j);
    Object.assign(p, { job: j, load: back ? 10 : 0, carry: back ? 'sack' : null });
    const to = back ? f.house : away;
    Agents.walkTo(st, p, to, st.w.hx[to], st.w.hy[to]);
  }
  const data = JSON.parse(JSON.stringify(Sim.save(st)));
  const back = Sim.load(tinyWorld(rows), data);
  assert(![...back.jobs.values()].some((j) => !KINDS[j.kind]), 'no task of an unknown kind loaded');
  assert(back.agents[a.id].job === null && back.agents[b.id].job === null, 'its hands freed');
  const laid = (back.lying || []).filter((x) => x.kind === 'leftGrain' && x.owner.id === hh.id && x.tile !== away);
  assert(
    laid.length === 1 && laid[0].n === 10 && laid[0].of.parts.rye === 10,
    'the load in hand set down where its carrier stood, with its crops',
  );
  // home by its crops: every grain put by a leftGrain delivery, by crop
  const home = {},
    put = Stores.put;
  Stores.put = function (st_, holder, good, n, why, parts) {
    if (
      holder === back.households[hh.id] &&
      good === 'grain' &&
      why &&
      why.kind === 'gift' &&
      why.from === 'where it lay'
    )
      for (const c in parts) home[c] = (home[c] || 0) + parts[c];
    return put.apply(this, arguments);
  };
  try {
    for (let d = 0; d < 6 * 24 && (back.lying || []).some((x) => x.kind === 'leftGrain'); d++) Sim.advance(back, 1);
  } finally {
    Stores.put = put;
  }
  assert(!(back.lying || []).some((x) => x.kind === 'leftGrain'), 'the grain left lying is brought home');
  assert(
    Math.abs((home.barley || 0) - 20) < 1e-6 && Math.abs((home.rye || 0) - 10) < 1e-6,
    `home by its crops: ${JSON.stringify(home)}`,
  );
  Sim.advance(back, DAY);
  assert.deepStrictEqual(checkState(back), [], 'invariants, run on');
  console.log(
    'methods: an older save with a fetch task of grain left lying loads, runs on, and its grain comes home by its crops',
  );
}

// VB-1750: every kind carries methods (no kind runs on the phases); the work done at a site is `labour`'s row, its end the kind's own; the
// charges held at the side (the herd, the spinning) are minded (`mind`); the animals led home are a load in hand, set down at the door.
{
  const { KINDS } = VB['sim/kinds'];
  assert.deepStrictEqual(
    Object.keys(KINDS).filter((k) => !KINDS[k].methods),
    [],
    'every kind carries methods',
  );
  const plans = M.compile(KINDS);
  for (const k of ['herd', 'spin']) {
    assert(KINDS[k].mind && plans[k].methods[0].steps.some((s) => s.prim === 'mind'), `${k} is minded`);
  }
  for (const k of ['plow', 'cook', 'foundation', 'restore']) {
    const s = plans[k].methods[0].steps;
    assert(
      s.length === 2 && s[0].prim === 'go' && s[1].prim === 'work' && KINDS[k].ops[s[1].op].ends,
      `${k} is work at its site`,
    );
  }
  for (const k of ['lead', 'drove'])
    assert.deepStrictEqual(plans[k].uses, [k], `${k}: the animals led are a load in hand`);
  console.log(
    'methods: every kind carries methods; the herd and the spinning are minded; the animals led are a load in hand',
  );
}

// VB-1750 review, F1: a leader let go on the road home (its death) lays nothing: the cow it led was never taken from the giver's herd (it is
// moved at the door), so no pile of kind lead lies, the herds keep their animals, and the task, still posted, is unmet for its next hand.
{
  const Sim = VB.sim,
    Agents = VB['sim/agents'],
    { KINDS } = VB['sim/kinds'],
    { post } = VB['sim/jobs'],
    { state } = require('./lib/probe.js');
  for (const k of ['lead', 'drove']) assert(KINDS[k].led, `${k}: its load is animals led`);
  const st = state();
  st.naturalDeaths = false;
  Sim.advance(st, 2 * Sim.DAY + 9);
  const [b, s] = [st.households[0], st.households[1]],
    giver = st.farmsteads[s.farmstead];
  const j = post(st, `lead:h${b.id}:${s.id}`, 'lead', { type: 'household', id: b.id }, giver.house, {
    farm: st.farmsteads[b.farmstead],
    from: s.id,
  });
  const a = st.agents[b.members.find((m) => VB['sim/records'].age(st, st.pawns[m]) >= 16)];
  const cattle = () => st.herds.reduce((n, h) => n + (h && h.species === 'cattle' ? h.head.length : 0), 0),
    had = cattle();
  assert(had > 0, 'the village has cattle');
  Agents.release(st, a);
  Agents.start(st, a, j);
  for (let n = 0; !(a.load > 0) && n < 400; n++) Sim.advance(st, 0.1);
  assert(a.load > 0 && a.load === 1 && j.made === 1, 'the cow haltered and led home');
  Sim.advance(st, 0.1);
  Sim.killPawn(st, a.id, 'illness');
  assert.deepStrictEqual(
    (st.lying || []).filter((l) => l.kind === 'lead' || l.kind === 'drove'),
    [],
    'nothing lies where the leader fell',
  );
  assert(
    st.jobs.get(j.key) === j && !KINDS.lead.met(st, { job: j }, VB['sim/doing'].VIEW),
    'the task is posted and unmet',
  );
  assert.strictEqual(cattle(), had, 'the herds keep their animals');
  console.log('methods: a leader dead on the road home lays nothing; the cow stays in the herd and the task is unmet');
}

// VB-1750: the field's and the building's stages cut at random on a real state (a tiny village of three farms, its first sixty days): a hand
// at a stage's work leg is let go at the day's end (the night), let go (a call) or dies. The stage keeps its hours (sim/progress): its
// task, still posted, is never worked from fewer than it had, and an eligible pawn goes on from them; no pawn holds a task without
// progress or a walk for a day (no stuck task), and the invariants hold each day. node tests/methods.js [--stages N] (seeds, default 4).
{
  const Sim = VB.sim,
    Agents = VB['sim/agents'],
    { KINDS } = VB['sim/kinds'],
    { doneOf } = VB['sim/work'],
    { tinyWorld, tinyState } = require('./lib/tiny.js'),
    { checkState } = require('./lib/invariants.js');
  const FIELD = new Set(Object.keys(VB['sim/fieldwork'].KINDS)),
    BUILD = new Set(Object.keys(VB['sim/building'].KINDS));
  const staged = (k) => (FIELD.has(k) || BUILD.has(k)) && !!KINDS[k].ops && !!KINDS[k].ops.labour; // a stage worked at its site
  const rows = Array.from({ length: 12 }, (_, i) => (i < 2 ? 'FFFFFFFFFFFFFFFF' : '................'));
  const SEEDS = arg('stages', 4), // four: with three the building's stages were cut but twice in 158 (VB-1810)
    t = { field: 0, building: 0, night: 0, call: 0, death: 0, resumed: 0, finished: 0, fewer: [], stuck: [] };
  for (let seed = 1; seed <= SEEDS; seed++) {
    const st = tinyState(tinyWorld(rows), [{ at: [8, 7], farms: 3 }], { seed });
    st.naturalDeaths = false;
    const rng = makeStream(seed, 'stages'),
      cut = new Map(), // a stage's task cut: [the hours it had, the task]
      since = new Map(); // a pawn's task in hand: {job, done, t} since it last went on
    for (let h = 0; h < 60 * 24; h++) {
      Sim.advance(st, 1);
      // a stage followed by its key: taken down and posted again, it is the same stage, and keeps its hours (review, F6)
      for (const [key, [had, was]] of cut) {
        const j = st.jobs.get(key);
        // finished, or finished and the next stage of its key posted within the hour (VB-1758: the day slotted in place, the hands
        // finish it sooner than the old allotment's timing let this probe see)
        if (!j || (j !== was && was.done >= (was.hours ?? KINDS[was.kind].hours) - 1e-9)) {
          cut.delete(key);
          t.finished++;
          continue;
        }
        const d = doneOf(st, j);
        if (d < had - 1e-9)
          t.fewer.push(`${key}: ${d.toFixed(2)} of the ${had.toFixed(2)} hours it had (seed ${seed}, hour ${h})`);
        if (d > had + 1e-9) {
          t.resumed++;
          cut.delete(key);
        }
      }
      for (const id of st.living) {
        const a = st.agents[id],
          j = a.job,
          s = since.get(id),
          d = j ? doneOf(st, j) : 0;
        if (!j || a.path) since.delete(id);
        else if (!s || s.job !== j || d > s.done + 1e-9) since.set(id, { job: j, done: d, t: st.t });
        else if (st.t - s.t > 24) {
          t.stuck.push(`pawn ${id} on ${j.key}, phase ${a.leg && a.leg.kind} (seed ${seed}, hour ${h})`);
          since.delete(id);
        }
      }
      if (rnd(rng) < 0.15) {
        const all = st.living
            .map((id) => st.agents[id])
            .filter((a) => a.job && a.leg && a.leg.kind === 'work' && staged(a.job.kind)),
          built = all.filter((a) => BUILD.has(a.job.kind)),
          at = built.length && rnd(rng) < 0.5 ? built : all; // a building's stage as often as a field's, when there is one
        if (at.length) {
          const a = at[Math.floor(rnd(rng) * at.length)],
            j = a.job,
            r = rnd(rng),
            hh = st.households[st.pawns[a.id].household],
            how = r < 0.4 ? 'night' : r < 0.8 || hh.members.length < 3 ? 'call' : 'death';
          t[FIELD.has(j.kind) ? 'field' : 'building']++;
          t[how]++;
          if (how === 'night') Agents.release(st, a, true);
          else if (how === 'call') Agents.release(st, a);
          else Sim.killPawn(st, a.id, 'illness');
          if (st.jobs.get(j.key) === j) cut.set(j.key, [Math.max((cut.get(j.key) || [0])[0], doneOf(st, j)), j]);
        }
      }
      if (h % 24 === 23)
        assert.deepStrictEqual(checkState(st), [], `the stages cut, seed ${seed}, day ${(h + 1) / 24}`);
    }
  }
  assert.deepStrictEqual(t.fewer, [], 'a stage cut keeps its hours');
  assert.deepStrictEqual(t.stuck, [], 'no stuck task');
  assert(t.field > 0 && t.building > 0 && t.resumed > 0, `the stages cut and taken up again: ${JSON.stringify(t)}`);
  console.log(
    `methods: the field's and the building's stages cut at random (${t.field} field, ${t.building} building; ${t.night} at night, ${t.call} by a call, ${t.death} by a death): ${t.resumed} gone on from their hours, ${t.finished} finished, none stuck`,
  );
}
