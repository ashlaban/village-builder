// Study A, parts 2, 3 and 5 (P1, P4): a standalone micro-world, no game code. A farm, a forest, a well, a field with stooks, a meadow, a
// shore, a building site and a creditor's farm; stores, piles at tiles, pawns that carry, one cart. Two engines run the same eight kinds:
//   D, the derived engine of design 2.2: no phase; `next(w, goal, pawn)` asks the kind's methods each time a leg ends. Two readings of
//      "the first step of the first method whose `when` holds and whose effects are not yet true": `fwd` (the text as written: scan the
//      steps from the first) and `bwd` (a triangle table: scan from the last step and take the last whose precondition holds and whose
//      effect is not yet true). One rule comes before any method: a load in hand off its goal is hauled to its owner's store if the walk
//      fits the hours left, else set down as a pile where the pawn stands; a cart in hand off its goal is set down (it is a thing at a tile).
//   P, a phase machine (go, work, back, home) written as src/sim/agents.js does it (start, arrived, ended, deposit, complete, release),
//      without its special cases: a job on a board, a load made at the door for the kinds whose `deliver` makes it there (wood, water,
//      fish), a load taken from the pile for the others (haul, hay), `again` reopening, `release` laying a fetchable load as a pile and
//      spilling the rest, a call deferred while a load is on the road (VB-581), and an owed day's end that sends the pawn home with job and
//      load held, its claim cut at 18:00 (sim/days, the VB-1548 trace).
// Fuzz: N runs an engine; each a kind and a cut drawn from its own seeded stream (mulberry32, seed = run index + 1), the cut at a random
// leg of the first pawn; then any eligible pawn continues for three days. Invariants checked at the end, counted by cut and kind.
// node docs/mocks/plans/task/micro.js [--runs 10000] [--time 1000000] [--json FILE]
const fs = require('fs');
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i >= 0 ? process.argv[i + 1] : d; };
const RUNS = Number(arg('runs', 10000)), TIMES = Number(arg('time', 1000000)), out = arg('json', null);
function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ---- the world ----
const PL = { home: [0, 0], forest: [5, 1], well: [1, 1], field: [3, -3], meadow: [-4, 3], creditor: [7, -5], shore: [-2, -5], site: [2, 4] };
const HOME = { h: 'home', c: 'creditor' }, H_STEP = 0.3, CART = 4, BACK = 1, WORK0 = 6, WORK1 = 18;
const hex = (a, b) => { const [q1, r1] = PL[a], [q2, r2] = PL[b], dq = q1 - q2, dr = r1 - r2; return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2; };
const walkH = (a, b, cart) => hex(a, b) * H_STEP * (cart ? 1.2 : 1);
const GOODS = ['timber', 'firewood', 'water', 'sheaves', 'hay', 'seed', 'fish', 'milk'];
function world(rng) {
  const st = () => Object.fromEntries(GOODS.map((g) => [g, 0]));
  const w = { t: WORK0, stores: { h: st(), c: st() }, piles: {}, trees: 100, prog: {}, grass: 1, cart: { at: 'home', by: null, lockedUntil: -1 },
    pawns: [], made: st(), used: st(), spilt: 0, rng, sets: 0 };
  w.stores.h.seed = 4; w.stores.h.timber = 0; w.made.seed = 4;
  w.piles.field = { sheaves: 12 }; w.made.sheaves = 12;
  return w;
}
const pile = (w, at, g) => (w.piles[at] && w.piles[at][g]) || 0;
const addPile = (w, at, g, n) => { (w.piles[at] ||= {})[g] = pile(w, at, g) + n; };
const make = (w, g, n) => { w.made[g] += n; };
const use = (w, g, n) => { w.used[g] += n; };
function massOK(w) {
  for (const g of GOODS) {
    let s = w.stores.h[g] + w.stores.c[g];
    for (const at in w.piles) s += w.piles[at][g] || 0;
    for (const p of w.pawns) if (p.hands && p.hands.good === g) s += p.hands.n;
    if (Math.abs(s - (w.made[g] - w.used[g])) > 1e-9) return false;
  }
  return true;
}
const cartFree = (w) => w.cart.by === null && w.cart.lockedUntil < w.t;
const capOf = (w, p) => (p.cart ? CART : BACK);
const hoursLeft = (w) => (w.table ? 12 : Math.max(0, WORK1 - (w.t % 24)));

// ---- the goals and kinds (the same for both engines) ----
// A goal: {kind, owner, amount}; met(w, g) reads the world only.
const KIND = {
  firewood: { met: (w, g) => w.stores[g.owner].firewood >= g.amount },
  water: { met: (w, g) => w.stores[g.owner].water >= g.amount },
  sheaves: { met: (w, g) => w.stores[g.owner].sheaves >= g.amount },
  hay: { met: (w, g) => w.stores[g.owner].hay >= g.amount },
  sow: { met: (w) => (w.prog.sow || 0) >= 2 },
  build: { met: (w) => (w.prog.build || 0) >= 6 },
  fish: { met: (w, g) => w.stores[g.owner].fish >= g.amount },
  milk: { met: (w, g) => w.stores[g.owner].milk >= g.amount },
};
const AMOUNT = { firewood: 4, water: 4, sheaves: 12, hay: 6, sow: 1, build: 1, fish: 2, milk: 1 };

// ---- engine D: steps as data, each with a precondition and an effect read from the world ----
const dest = (g) => HOME[g.owner];
const S = {
  fetchCart: () => ({ prim: 'fetch', pre: (w, g, p) => !p.cart && cartFree(w), eff: (w, g, p) => p.cart || !cartFree(w) }),
  go: (at, pre) => ({ prim: 'go', at, pre: (w, g, p) => (pre ? pre(w, g, p) : true), eff: (w, g, p) => p.at === (typeof at === 'function' ? at(g) : at) }),
  goCart: (at) => ({ prim: 'go', at, pre: (w, g, p) => p.cart || !cartFree(w), eff: (w, g, p) => p.at === at }),
  work: (at, op) => ({ prim: 'work', at, op, pre: (w, g, p) => p.at === (typeof at === 'function' ? at(g) : at) && op.can(w, g, p), eff: (w, g, p) => op.done(w, g, p) }),
  load: (at, good, src, full) => ({ prim: 'load', at, good, src,
    // `full`: a pile still being made (the felling) is loaded once it fills the load, or once nothing more can be made (the stack branch of ended)
    pre: (w, g, p) => p.at === (typeof at === 'function' ? at(g) : at) && !p.hands && (src === 'source' || (src === 'store' ? w.stores[g.owner][good] : pile(w, at, good)) > 0) &&
      (!full || pile(w, at, good) >= capOf(w, p) || !full(w)),
    eff: (w, g, p) => !!p.hands && p.hands.good === good }),
  haul: (to, good) => ({ prim: 'haul', to, pre: (w, g, p) => !!p.hands && p.hands.good === good, eff: (w, g, p) => p.at === (typeof to === 'function' ? to(g) : to) }),
  unload: (to, good) => ({ prim: 'unload', to, good, pre: (w, g, p) => !!p.hands && p.hands.good === good && p.at === (typeof to === 'function' ? to(g) : to), eff: (w, g, p) => !p.hands }),
};
// The work ops: hours, a progress record in the world (prog), what may begin, what counts as done, what the hours make.
const OP = {
  fell: { key: () => 'fell', hours: 2, can: (w) => w.trees > 0, done: (w, g, p) => pile(w, 'forest', 'timber') >= capOf(w, p) || (p.hands && p.hands.good === 'timber'),
    apply: (w) => { w.trees--; make(w, 'timber', 2); addPile(w, 'forest', 'timber', 2); } },
  cut: { key: (g) => 'cut:' + g.owner, hours: 1, can: (w, g) => w.stores[g.owner].timber > 0, done: (w, g) => KIND.firewood.met(w, g),
    apply: (w, g) => { const s = w.stores[g.owner], n = Math.min(2, s.timber); s.timber -= n; use(w, 'timber', n); s.firewood += n; make(w, 'firewood', n); } },
  mow: { key: () => 'mow', hours: 4, can: (w) => w.grass > 0, done: (w) => w.grass === 0, apply: (w) => { w.grass = 0; make(w, 'hay', 6); addPile(w, 'meadow', 'hay', 6); } },
  sow: { key: () => 'sow', hours: 2, can: (w, g, p) => !!p.hands && p.hands.good === 'seed' && p.hands.n >= 2, done: (w) => KIND.sow.met(w),
    apply: (w, g, p) => { p.hands.n -= 2; use(w, 'seed', 2); if (!p.hands.n) p.hands = null; }, record: true },
  build: { key: () => 'build', hours: 6, can: (w) => pile(w, 'site', 'timber') >= 2, done: (w) => KIND.build.met(w),
    apply: (w) => { w.piles.site.timber -= 2; use(w, 'timber', 2); }, record: true },
  fish: { key: (g) => 'fish:' + g.owner, hours: 3, can: () => true, done: (w, g, p) => !!p.hands && p.hands.good === 'fish',
    apply: (w, g, p) => { make(w, 'fish', 2); p.hands = { good: 'fish', n: 2, owner: g.owner }; } },
  milk: { key: () => 'milk', hours: 0.5, can: () => true, done: (w, g) => KIND.milk.met(w, g), apply: (w, g) => { w.stores[g.owner].milk++; make(w, 'milk', 1); } },
};
const METHODS = {
  firewood: [{ when: () => true, steps: [S.fetchCart(), S.goCart('forest'), S.work('forest', OP.fell), S.load('forest', 'timber', 'pile', (w) => w.trees > 0), S.haul(dest, 'timber'), S.unload(dest, 'timber'), S.work(dest, OP.cut)] }],
  water: [{ when: () => true, steps: [S.fetchCart(), S.goCart('well'), S.load('well', 'water', 'source'), S.haul(dest, 'water'), S.unload(dest, 'water')] }],
  sheaves: [{ when: () => true, steps: [S.fetchCart(), S.goCart('field'), S.load('field', 'sheaves', 'pile'), S.haul(dest, 'sheaves'), S.unload(dest, 'sheaves')] }],
  hay: [{ when: () => true, steps: [S.fetchCart(), S.goCart('meadow'), S.work('meadow', OP.mow), S.load('meadow', 'hay', 'pile'), S.haul(dest, 'hay'), S.unload(dest, 'hay')] }],
  sow: [{ when: () => true, steps: [S.go(dest), S.load(dest, 'seed', 'store'), S.haul('field', 'seed'), S.work('field', OP.sow)] }],
  build: [{ when: () => true, steps: [S.go(dest, (w) => pile(w, 'site', 'timber') < 2), S.load(dest, 'timber', 'store'), S.haul('site', 'timber'), S.unload('site', 'timber'), S.go('site', (w) => pile(w, 'site', 'timber') >= 2), S.work('site', OP.build)] }],
  fish: [{ when: () => true, steps: [S.go('shore'), S.work('shore', OP.fish), S.haul(dest, 'fish'), S.unload(dest, 'fish')] }],
  milk: [{ when: () => true, steps: [S.go(dest), S.work(dest, OP.milk)] }],
};
// A load set down off its way (the night, an illness, a death) lies as a pile where no method of its kind looks: a stray. The methods of 2.2
// name their sources (the forest, the field, the store), so a stray is found only by a further method, `run.strays` on: the fetch kinds
// of sim/kinds made one generic method, "the nearest pile of a good the goal uses, not where the kind makes or wants it, brought home".
const USES = { firewood: ['timber'], water: ['water'], sheaves: ['sheaves'], hay: ['hay'], sow: ['seed'], build: ['timber'], fish: ['fish'], milk: [] };
const INTENDED = { firewood: { timber: ['forest'] }, sheaves: { sheaves: ['field'] }, hay: { hay: ['meadow'] }, build: { timber: ['site'] } };
function stray(w, g) {
  for (const good of USES[g.kind]) for (const at in w.piles) if (pile(w, at, good) > 0 && !((INTENDED[g.kind] || {})[good] || []).includes(at)) return { at, good };
  return null;
}
const strayMethod = (sv) => [S.go(sv.at), S.load(sv.at, sv.good, 'pile'), S.haul(dest, sv.good), S.unload(dest, sv.good)];
let NEXT_CALLS = 0;
const placeOf = (x, g) => (typeof x === 'function' ? x(g) : x);
// The rule before any method, then the methods. Returns a step, 'done', or {blocked}.
function next(w, g, p, reading) {
  NEXT_CALLS++;
  if (!g || !p.on) {
    if (p.hands) { const to = HOME[p.hands.owner]; if (p.at === to) return { prim: 'unload', to, rule: true }; return walkH(p.at, to, p.cart) <= hoursLeft(w) ? { prim: 'haul', to, rule: true } : { prim: 'setDown', rule: true }; }
    if (p.cart) return { prim: 'leaveCart', rule: true };
    return 'done';
  }
  if (KIND[g.kind].met(w, g)) { if (p.hands || p.cart) return next(w, null, p, reading); return 'done'; }
  const sv = run.strays && !p.hands && stray(w, g);
  for (const m of sv ? [{ when: () => true, steps: strayMethod(sv) }, ...METHODS[g.kind]] : METHODS[g.kind]) {
    if (!m.when(w, g, p)) continue;
    const s = m.steps;
    if (reading === 'bwd') { for (let i = s.length - 1; i >= 0; i--) if (!s[i].eff(w, g, p) && s[i].pre(w, g, p)) return s[i]; }
    else for (let i = 0; i < s.length; i++) if (!s[i].eff(w, g, p)) { if (s[i].pre(w, g, p)) return s[i]; break; }
  }
  if (p.hands) return next(w, null, p, reading); // nothing to do with what it holds here: the rule takes it home
  const why = g.kind === 'sow' && !w.stores[g.owner].seed ? 'no seed' : g.kind === 'build' && w.stores[g.owner].timber + pile(w, 'site', 'timber') < 2 ? 'no timber' : g.kind === 'hay' && !w.grass && !pile(w, 'meadow', 'hay') ? 'no hay' : g.kind === 'sheaves' && !pile(w, 'field', 'sheaves') ? 'no sheaves' : g.kind === 'firewood' && !w.trees ? 'no trees' : null;
  return { blocked: why };
}
// Carry out step s for pawn p from time w.t: returns the leg's hours (its effects applied at its end by `endD`).
function legD(w, g, p, s) {
  if (s.prim === 'go' || s.prim === 'haul') return walkH(p.at, placeOf(s.prim === 'go' ? s.at : s.to, g), p.cart);
  if (s.prim === 'fetch') return walkH(p.at, w.cart.at, false) + 0.1;
  if (s.prim === 'work') { const k = s.op.key(g); return Math.min(s.op.hours - (w.prog[k] || 0), Math.max(0.1, hoursLeft(w))); }
  return 0.1; // load, unload, set down, leave the cart
}
function endD(w, g, p, s, h) {
  switch (s.prim) {
    case 'go': p.at = placeOf(s.at, g); break;
    case 'haul': p.at = placeOf(s.to, g); break;
    case 'fetch': p.at = w.cart.at; if (cartFree(w)) { w.cart.by = p.id; p.cart = true; } break;
    case 'leaveCart': p.cart = false; w.cart.by = null; w.cart.at = p.at; break;
    case 'setDown': if (p.hands) { addPile(w, p.at, p.hands.good, p.hands.n); p.hands = null; w.sets++; } break;
    case 'load': {
      const at = placeOf(s.at, g), cap = s.good === 'seed' ? 4 : capOf(w, p), src = s.src;
      const have = src === 'source' ? cap : src === 'store' ? w.stores[g.owner][s.good] : pile(w, at, s.good), n = Math.min(cap, have);
      if (n <= 0) break;
      if (src === 'source') make(w, s.good, n); else if (src === 'store') w.stores[g.owner][s.good] -= n; else w.piles[at][s.good] -= n;
      p.hands = { good: s.good, n, owner: g ? g.owner : p.owner }; break;
    }
    case 'unload': {
      if (!p.hands) break;
      const to = placeOf(s.to, g);
      if (to === HOME.h || to === HOME.c) w.stores[to === HOME.h ? 'h' : 'c'][p.hands.good] += p.hands.n; else addPile(w, to, p.hands.good, p.hands.n);
      p.hands = null; break;
    }
    case 'work': {
      const k = s.op.key(g); w.prog[k] = (w.prog[k] || 0) + h;
      if (w.prog[k] >= s.op.hours - 1e-9 && s.op.can(w, g, p)) { s.op.apply(w, g, p); if (!s.op.record) delete w.prog[k]; else w.prog[k] = s.op.hours; }
      break;
    }
  }
}

// ---- engine P: the phase machine ----
// A job: {kind, site, hours, done, claims[], again?, owner}. Kinds of job: wood (cut at the forest, load made at the door), firewood (cut at
// the house), water (barrel set out, made at the door), haul and hay (taken from the pile, `again`), mow, sow (seed taken at done), timber
// (logs from the store to the site), build, fish (made at the door), milk, and fetch (a laid load).
const JK = {
  wood: { site: 'forest', hours: 2, carry: 'timber', atDoor: true, fetchable: true, can: (w) => w.trees > 0 },
  firewood: { site: 'home', hours: 1, can: (w, o) => w.stores[o].timber > 0, done: (w, o) => OP.cut.apply(w, { owner: o }) },
  water: { site: 'well', hours: 0.1, carry: 'water', atDoor: true, setOut: true, can: () => true },
  haul: { site: 'field', hours: 0.7, carry: 'sheaves', fromPile: true, fetchable: true, again: (w) => pile(w, 'field', 'sheaves') > 0, can: (w) => pile(w, 'field', 'sheaves') > 0 },
  hay: { site: 'meadow', hours: 1.5, carry: 'hay', fromPile: true, fetchable: true, again: (w) => pile(w, 'meadow', 'hay') > 0, can: (w) => pile(w, 'meadow', 'hay') > 0 },
  mow: { site: 'meadow', hours: 4, can: (w) => w.grass > 0, done: (w) => OP.mow.apply(w) },
  sow: { site: 'field', hours: 2, can: (w, o) => w.stores[o].seed >= 2, done: (w, o) => { w.stores[o].seed -= 2; use(w, 'seed', 2); w.prog.sow = 2; } },
  timber: { site: 'home', hours: 0.2, carry: 'timber', fromStore: true, to: 'site', fetchable: true, can: (w, o) => w.stores[o].timber > 0 },
  build: { site: 'site', hours: 6, can: (w) => pile(w, 'site', 'timber') >= 2, done: (w) => { OP.build.apply(w); w.prog.build = 6; } },
  fish: { site: 'shore', hours: 3, carry: 'fish', atDoor: true, can: () => true },
  milk: { site: 'home', hours: 0.5, can: () => true, done: (w, o) => OP.milk.apply(w, { owner: o }) },
  fetch: { hours: 0.3, fetchable: true },
};
const NEEDS = { // what the household's planner posts for a goal (the chores' and the projects' posting, once a day and after a completion)
  firewood: (w, o) => [w.stores[o].timber > 0 && 'firewood', w.stores[o].timber < 2 && 'wood'],
  water: () => ['water'], sheaves: () => ['haul'], hay: (w) => [w.grass > 0 && 'mow', pile(w, 'meadow', 'hay') > 0 && 'hay'],
  sow: () => ['sow'], build: (w, o) => [pile(w, 'site', 'timber') >= 2 ? 'build' : 'timber'], fish: () => ['fish'], milk: () => ['milk'],
};
const siteOf = (j, o) => (j.site === 'home' ? HOME[o] : j.site);
function post(w, g) {
  if (KIND[g.kind].met(w, g)) return;
  for (const k of NEEDS[g.kind](w, g.owner)) if (k && !w.jobs.some((j) => j.kind === k) && JK[k].can(w, g.owner)) w.jobs.push({ kind: k, site: JK[k].site, done: 0, claims: [], owner: g.owner });
}
const isOpen = (j) => j.claims.length < 1 && j.done < (j.hours ?? JK[j.kind].hours) - 1e-9; // kinds.js isOpen: hands and hours left
function startP(w, p, j) { j.claims.push(p.id); p.job = j; p.phase = 'go'; if (JK[j.kind].setOut && cartFree(w)) { w.cart.by = p.id; p.cart = true; } return walkH(p.at, siteOf(j, j.owner), p.cart); }
function releaseP(w, p) { // agents.release: a fetchable load on the road is laid where it stands (setDown at the job's own site), the rest is spilt
  const j = p.job, wasBack = p.load > 0 && p.phase === 'back' && !!j;
  if (wasBack) {
    const K = JK[j.kind];
    if (K.atDoor && !K.fetchable) { /* nothing was made yet (made at the door): spilt, the hours lost, no good */ }
    else if (K.fetchable) { if (K.atDoor) { make(w, p.carry, p.load); if (j.kind === 'wood') w.trees -= p.load / 2; } addPile(w, p.at, p.carry, p.load); if (p.at !== siteOf(j, j.owner)) w.jobs.push({ kind: 'fetch', site: p.at, good: p.carry, done: 0, claims: [], owner: j.owner, hours: 0.3 }); }
    else { w.spilt += p.load; use(w, p.carry, p.load); }
    p.load = 0; p.carry = null;
  }
  if (p.cart) { p.cart = false; w.cart.by = null; w.cart.at = p.at; }
  // a job whose load was on the road is taken down unless it has more loads to give (release's dropJob); any other keeps its progress
  if (j) { j.claims = j.claims.filter((x) => x !== p.id); if (wasBack && !(JK[j.kind].again && JK[j.kind].again(w))) w.jobs = w.jobs.filter((x) => x !== j); }
  p.job = null; p.phase = null;
}
function depositP(w, p) {
  const j = p.job, K = JK[j.kind], to = p.at;
  if (K.atDoor) { if (j.kind === 'wood') { w.trees -= p.load / 2; } make(w, p.carry, p.load); w.stores[j.owner][p.carry] += p.load; }
  else if (to === HOME.h || to === HOME.c) w.stores[j.owner][p.carry] += p.load; else addPile(w, to, p.carry, p.load);
  if (p.cart) { p.cart = false; w.cart.by = null; w.cart.at = p.at; }
  if (!K.again || !K.again(w)) w.jobs = w.jobs.filter((x) => x !== j); else { j.claims = j.claims.filter((x) => x !== p.id); }
  p.load = 0; p.carry = null; p.job = null; p.phase = null;
}
// The leg that ends: returns the next leg's hours, or null when the pawn is free.
function endP(w, p, h) {
  const j = p.job;
  if (p.phase === 'go') { p.at = siteOf(j, j.owner); p.phase = 'work'; return Math.min((j.hours ?? JK[j.kind].hours) - j.done, Math.max(0.1, hoursLeft(w))); }
  if (p.phase === 'work') {
    j.done += h;
    if (j.done < (j.hours ?? JK[j.kind].hours) - 1e-9) return Math.min((j.hours ?? JK[j.kind].hours) - j.done, Math.max(0.1, hoursLeft(w)));
    const K = JK[j.kind];
    if (K.carry) { // ended: the load (made at the door, from the pile, from the store, or the laid load)
      const cap = p.cart ? CART : BACK;
      let n = cap;
      if (j.kind === 'fetch') { n = Math.min(cap, pile(w, p.at, j.good)); w.piles[p.at][j.good] -= n; p.carry = j.good; }
      else if (K.fromPile) { n = Math.min(cap, pile(w, j.site, K.carry)); w.piles[j.site][K.carry] -= n; }
      else if (K.fromStore) { n = Math.min(cap, w.stores[j.owner].timber); w.stores[j.owner].timber -= n; }
      if (j.kind !== 'fetch') p.carry = K.carry;
      p.load = n;
      if (K.again && K.again(w)) j.done = 0; // the others go on loading
      p.phase = 'back';
      return walkH(p.at, K.to === 'site' ? 'site' : HOME[j.owner], p.cart);
    }
    if (K.done) K.done(w, j.owner);
    w.jobs = w.jobs.filter((x) => x !== j); p.job = null; p.phase = null; return null;
  }
  if (p.phase === 'back') { p.at = JK[j.kind].to === 'site' ? 'site' : HOME[j.owner]; depositP(w, p); return null; }
  if (p.phase === 'home') { p.at = HOME[p.owner]; p.phase = null; return null; } // home, its job and load still held (sim/days goHome)
  return null;
}

// ---- one run ----
const CUTS = ['night', 'call', 'death', 'helper', 'cartTaken', 'owedEnd', 'illness'];
const KINDS8 = Object.keys(KIND);
function run(engine, seed, forced) {
  const rng = mulberry32(seed), w = world(rng);
  const kind = forced?.kind ?? KINDS8[Math.floor(rng() * KINDS8.length)], cut = forced?.cut ?? CUTS[Math.floor(rng() * CUTS.length)];
  const cutLeg = 1 + Math.floor(rng() * 8), owner = cut === 'owedEnd' ? 'c' : 'h';
  if (kind === 'sow' || kind === 'build') { w.stores[owner].seed += owner === 'c' ? 4 : 0; if (owner === 'c') make(w, 'seed', 4); w.stores[owner].timber += 4; make(w, 'timber', 4); }
  const g = { kind, owner, amount: AMOUNT[kind] };
  // A works the goal (on an owed day for the creditor when the cut is owedEnd); B and C are the goal owner's own people, free from day 1
  // (on day 0 only A works: the cut is A's). The helper joins A's work leg for an hour.
  w.pawns = ['A', 'B', 'C'].map((id, i) => ({ id, i, at: i === 0 ? 'home' : HOME[owner], owner: i === 0 ? 'h' : owner, alive: true, abed: -1, gone: -1,
    on: true, hands: null, cart: false, job: null, phase: null, load: 0, until: WORK0, step: null, h: 0, legs: 0 }));
  const A = w.pawns[0];
  if (engine === 'P') { w.jobs = []; post(w, g); }
  let cutDone = false, owedOver = false, legsA = 0;
  const eligible = (p, day) => p.alive && p.abed < w.t && p.gone < w.t && (p.i === 0 ? !owedOver && !(cut === 'call' && cutDone) : day >= 1);
  const stats = { nextCalls: 0, legs: 0 };
  for (let day = 0; day < 4; day++) {
    w.t = day * 24 + WORK0;
    for (const p of w.pawns) { p.until = w.t; if (engine === 'D') p.step = null; }
    if (engine === 'P') post(w, g);
    for (let guard = 0; guard < 400; guard++) {
      // the pawn whose leg ends first
      let p = null;
      for (const q of w.pawns) if (q.alive && q.until < day * 24 + WORK1 + 3 && (!p || q.until < p.until)) p = q;
      if (!p) break;
      w.t = Math.max(w.t, p.until);
      if (w.t >= day * 24 + WORK1) { // the day ends for this pawn
        if (engine === 'D') { p.on = false; let s; while (p.hands || p.cart) { s = next(w, null, p); if (s === 'done') break; endD(w, g, p, s, 0); if (s.prim === 'haul' || s.prim === 'unload') { if (s.prim === 'haul') p.at = s.to; } } p.on = true; }
        else if (p.phase === 'go' || p.phase === 'work') releaseP(w, p);
        else if (p.phase === 'back') { const h = walkH(p.at, JK[p.job.kind].to === 'site' ? 'site' : HOME[p.job.owner], p.cart); p.until += h; endP(w, p, h); }
        if (engine === 'P' && p.owedCut) { const j = p.job; if (j) j.claims = j.claims.filter((x) => x !== p.id); p.job = null; p.load = 0; p.carry = null; p.phase = null; p.owedCut = false; if (p.cart) { p.cart = false; w.cart.by = null; w.cart.at = p.at; } }
        p.until = Infinity; continue;
      }
      // the leg that ended
      if (engine === 'D' && p.step) { endD(w, g, p, p.step, p.h); p.step = null; }
      if (engine === 'P' && p.leg) { const nh = endP(w, p, p.h); p.leg = false; if (nh !== null) { p.h = nh; p.leg = true; p.until = w.t + nh; stats.legs++; } }
      if (p === A && (engine === 'D' || !p.leg || true)) legsA++;
      // the cut, at A's cutLeg-th leg end
      if (!cutDone && p === A && legsA >= cutLeg) {
        cutDone = true;
        if (cut === 'night') { for (const q of w.pawns) if (q.alive) q.until = Math.max(q.until, day * 24 + WORK1); if (engine === 'D') A.step = null; continue; }
        if (cut === 'call') { if (engine === 'D') { A.step = null; } else if (A.phase !== 'back') { releaseP(w, A); A.leg = false; } else A.callAfter = true; }
        if (cut === 'death') { A.alive = false; if (engine === 'D') { if (A.hands) { addPile(w, A.at, A.hands.good, A.hands.n); A.hands = null; } if (A.cart) { A.cart = false; w.cart.by = null; w.cart.at = A.at; } } else releaseP(w, A); continue; }
        if (cut === 'illness') { A.abed = w.t + 48; if (engine === 'D') { A.on = false; A.step = null; if (A.hands) { addPile(w, A.at, A.hands.good, A.hands.n); A.hands = null; w.sets++; } if (A.cart) { A.cart = false; w.cart.by = null; w.cart.at = A.at; } } else { releaseP(w, A); A.leg = false; } }
        if (cut === 'helper') { const B = w.pawns[1]; if (engine === 'P' && A.job && A.phase === 'work' && JK[A.job.kind].hours > 1) { A.job.done += 1; } else if (engine === 'D') { const s = METHODS[kind][0].steps.find((x) => x.prim === 'work'); if (s && s.pre(w, g, A)) { const k = s.op.key(g); w.prog[k] = Math.min((w.prog[k] || 0) + 0.5, s.op.hours - 0.01); } } B.until = Math.max(B.until, w.t + 1); }
        if (cut === 'cartTaken') { w.cart.lockedUntil = w.t + 30; if (A.cart && !A.hands && !(A.load > 0)) { A.cart = false; w.cart.by = null; w.cart.at = HOME.h; } else if (!A.cart && w.cart.by === null) w.cart.at = HOME.h; if (!A.cart) w.cart.by = null; }
        if (cut === 'owedEnd') { owedOver = true; if (engine === 'D') { A.on = false; A.step = null; } else { A.owedCut = true; if (A.phase) { A.phase = 'home'; A.leg = true; A.h = walkH(A.at, HOME.h); A.until = w.t + A.h; continue; } } }
      }
      if (engine === 'P' && A.callAfter && p === A && !A.job) A.callAfter = false;
      // the next leg
      if (engine === 'D') {
        if (!eligible(p, day) && !(p.hands || p.cart)) { p.until = Infinity; continue; }
        const s = next(w, eligible(p, day) && p.on ? g : null, p, run.reading); stats.nextCalls++;
        if (s === 'done' || s.blocked !== undefined) { p.until = Infinity; continue; }
        p.step = s; p.h = legD(w, g, p, s); p.until = w.t + p.h; stats.legs++;
        if (s.prim === 'haul' && s.rule) p.step = { prim: 'haul', to: s.to };
      } else {
        if (p.leg) continue;
        if (p.owedCut || !eligible(p, day) || p.callAfter) { p.until = p.owedCut ? day * 24 + WORK1 : Infinity; continue; } // the claim is cut at 18:00
        post(w, g);
        const j = w.jobs.find(isOpen);
        if (!j) { p.until = Infinity; continue; }
        p.h = startP(w, p, j); p.leg = true; p.until = w.t + p.h; stats.legs++;
      }
    }
    // night: every pawn home; a D pawn with a load or a cart set them down where it stood (the rule, hours 0); a P pawn's held job stays
    for (const p of w.pawns) { if (engine === 'D') { p.on = false; while (p.hands || p.cart) { const s = next(w, null, p); if (s === 'done') break; endD(w, g, p, s.prim === 'haul' ? { prim: 'setDown' } : s, 0); } p.on = true; p.step = null; } if (p.alive) p.at = HOME[p.owner]; }
  }
  // ---- the invariants ----
  w.t = 4 * 24 + WORK0;
  const met = KIND[kind].met(w, g), v = [];
  if (!massOK(w) || w.spilt > 0) v.push('mass');
  if (w.pawns.some((p) => p.alive && ((p.hands && !p.step) || (p.load > 0 && !p.job)))) v.push('orphanLoad');
  if (!met && engine === 'D' && stray(w, g)) v.push('stranded');
  if (!met) {
    if (engine === 'D') { const B = w.pawns[1]; B.on = true; const s = next(w, g, B, run.reading); if (s === 'done' || (s.blocked !== undefined && !s.blocked)) v.push('stuck'); }
    else { post(w, g); const open = w.jobs.some(isOpen), dead = w.jobs.some((j) => !isOpen(j) && j.claims.length === 0); if (!open) v.push(dead ? 'stuck:doneNoCarrier' : 'stuck'); }
  }
  if (v.length && run.debug && run.debug.n-- > 0) console.error(engine, kind, cut, cutLeg, v.join(','), JSON.stringify({ jobs: w.jobs, piles: w.piles, stores: w.stores, made: w.made, used: w.used, pawns: w.pawns.map((p) => [p.id, p.alive, p.at, p.phase, p.load, p.job && p.job.kind]) }));
  return { kind, cut, cutLeg, met, v, stats, sets: w.sets, spilt: w.spilt };
}

// ---- the fuzz ----
function fuzz(engine, reading, strays) {
  run.reading = reading; run.strays = !!strays; run.debug = engine === 'P' && process.argv.includes('--debug') ? { n: 6 } : null; const res = { runs: RUNS, violations: 0, byCut: {}, byKind: {}, byType: {}, met: 0, nextCalls: 0, legs: 0, setDowns: 0, stuckOwed: 0, owedRuns: 0 };
  for (let i = 0; i < RUNS; i++) {
    const r = run(engine, i + 1);
    res.met += r.met; res.spilt = (res.spilt || 0) + (r.spilt > 0); if (!r.met && !r.v.length) (res.unmetResumable ||= {})[r.kind] = (res.unmetResumable[r.kind] || 0) + 1; res.nextCalls += r.stats.nextCalls; res.legs += r.stats.legs; res.setDowns += r.sets;
    if (r.cut === 'owedEnd') { res.owedRuns++; if (r.v.some((x) => x.startsWith('stuck'))) res.stuckOwed++; }
    if (r.v.length) { res.violations++; (res.byCut[r.cut] ||= 0); res.byCut[r.cut]++; res.byKind[r.kind] = (res.byKind[r.kind] || 0) + 1; for (const x of r.v) res.byType[x] = (res.byType[x] || 0) + 1; }
  }
  return res;
}
// The design's table for the firewood task, all five rows, asked of `next` (the bwd reading, and the fwd one beside it).
function table(reading) {
  const rows = [], g = { kind: 'firewood', owner: 'h', amount: 4 };
  const mk = (f) => { const w = world(mulberry32(1)); w.table = true; const p = { id: 'A', at: 'home', owner: 'h', on: true, hands: null, cart: false }; w.pawns = [p]; f(w, p); return [w, p]; };
  const play = (w, p, max = 30) => { const seq = []; for (let i = 0; i < max; i++) { const s = next(w, g, p, reading); if (s === 'done' || s.blocked !== undefined) { seq.push(s === 'done' ? 'done' : 'blocked'); break; } const h = legD(w, g, p, s); w.t += h; seq.push(s.prim + (s.op ? '(' + Object.keys(OP).find((k) => OP[k] === s.op) + ')' : '')); endD(w, g, p, s, h); } return seq; };
  rows.push(['at home, cart at home, no timber', play(...mk(() => {}))]);
  rows.push(['on the forest tile, no cart', play(...mk((w, p) => { p.at = 'forest'; w.cart.lockedUntil = 1e9; }))]);
  rows.push(['timber lies at the tile (night cut)', play(...mk((w) => { addPile(w, 'forest', 'timber', 4); make(w, 'timber', 4); }))]);
  rows.push(['called off on the road with a load', play(...mk((w, p) => { p.at = 'well'; p.hands = { good: 'timber', n: 4, owner: 'h' }; make(w, 'timber', 4); }))]);
  rows.push(['timber already at the farm', play(...mk((w) => { w.stores.h.timber = 4; make(w, 'timber', 4); }))]);
  return rows.map(([state, seq]) => ({ state, steps: seq.slice(0, 14).join(', ') + (seq.length > 14 ? ', ...(' + seq.length + ')' : '') }));
}
// The owed day's end at the road home, forced, for each engine (the VB-1548 trace): the wood job on an owed day, cut at A's third leg end.
function owedCase(engine) {
  run.reading = 'bwd'; run.strays = true; let stuck = 0, n = 0, lost = 0;
  for (let i = 0; i < 1000; i++) { const r = run(engine, 50000 + i, { kind: 'firewood', cut: 'owedEnd' }); n++; if (r.v.some((x) => x.startsWith('stuck'))) stuck++; if (r.v.includes('mass')) lost++; }
  return { runs: n, stuck, mass: lost };
}
// The cost of `next`: a million calls on states taken from runs.
function timing() {
  run.reading = 'bwd'; run.strays = true; const states = [];
  for (let i = 0; i < 200; i++) { const rng = mulberry32(900 + i), w = world(rng), kind = KINDS8[i % KINDS8.length], g = { kind, owner: 'h', amount: AMOUNT[kind] };
    const p = { id: 'A', at: Object.keys(PL)[Math.floor(rng() * 8)], owner: 'h', on: true, hands: rng() < 0.3 ? { good: 'timber', n: 1, owner: 'h' } : null, cart: rng() < 0.3 }; w.pawns = [p];
    if (rng() < 0.5) { addPile(w, 'forest', 'timber', 2); w.stores.h.timber = 2; } states.push([w, g, p]); }
  const t0 = process.hrtime.bigint(); let x = 0;
  for (let i = 0; i < TIMES; i++) { const [w, g, p] = states[i % states.length]; const s = next(w, g, p, 'bwd'); if (s !== 'done') x++; }
  const ns = Number(process.hrtime.bigint() - t0) / TIMES;
  return { calls: TIMES, usPerCall: +(ns / 1000).toFixed(3), x };
}
const t0 = Date.now();
const res = { seeds: `run i uses mulberry32(i + 1), i < ${RUNS}; the owed case 50001..51000; timing 900..1099`,
  tableBwd: table('bwd'), tableFwd: table('fwd'),
  D_bwd: fuzz('D', 'bwd'), D_bwdStrays: fuzz('D', 'bwd', true), D_fwd: fuzz('D', 'fwd'), P: fuzz('P'), owedP: owedCase('P'), owedD: owedCase('D'), timing: timing() };
res.secs = (Date.now() - t0) / 1000;
console.log(JSON.stringify(res, null, 1));
if (out) fs.writeFileSync(out, JSON.stringify(res, null, 1));
