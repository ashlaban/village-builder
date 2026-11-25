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
  pile: (st, at, good, owner) => pileN(st, at, good, owner),
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
      else lay(st, p.at, p.hands.good, p.hands.n, o);
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
function fall(st, p) {
  if (p.hands) lay(st, p.at, p.hands.good, p.hands.n, p.hands.owner);
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
  `methods: the firewood table's five rows; ${RUNS} fuzzed runs, ${tally.asks} asks, ${tally.blocked} rightly blocked, no violation`,
);
