// @suite integration
// Attention (VB-251; one name, `mind`, VB-1750): a pawn holds one task and, besides it, its charges: one that bars its other work (the
// herd at the side) and one that yields (spinning beside it); a charge is held within its reach, and dropped, reopened for others, when
// the pawn leaves reach or takes a full task out of it. Test-only kinds: a full one, a charge that yields (tPart) and two that bar.
const assert = require('assert');
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim, { issue } = VB['sim/commands'], { KINDS, isOpen } = VB['sim/kinds'];
const { post } = VB['sim/jobs'], { bid } = VB['sim/fit'], { hexSteps } = VB['sim/hex'], A = VB['sim/agents'], { TICKS } = VB['sim/rules'];
const it = G.generate(7); let r; while (!(r = it.next()).done);
const st = Sim.seed(r.value, 7, 'founders');
Sim.advance(st, 3 * Sim.DAY + 4);
const base = { ...KINDS.plow, done: undefined, available: undefined, stages: undefined, urgency: undefined };
const T = {
  tFull: { ...base }, tPart: { ...base, mind: true, yields: true, reach: 2, rate: 0.5 },
  tBack: { ...base, mind: true, reach: 2, rate: 0.5 }, tBack2: { ...base, mind: true, reach: 2, rate: 0.5 },
};
Object.assign(KINDS, T);
try {
  const a = st.agents.find((x) => st.pawns[x.id].died === null && st.pawns[x.id].household !== null), p = st.pawns[a.id];
  A.release(st, a);
  const owner = { type: 'household', id: p.household }, here = VB['sim/pose'].tileAt(st, ...VB['sim/pose'].placeOf(st, a));
  // its legs taken step by step until its walk ends (VB-473: the legs due, and nothing else)
  const arrive = () => { while (a.path) { st.tick++; st.t = st.tick / TICKS; A.stepAgents(st, Sim.cal(st.t)); } };
  const walk = (tile) => { A.walkTo(st, a, tile, st.w.hx[tile], st.w.hy[tile]); arrive(); };
  assert.ok(here >= 0);
  // a tile within reach, and one beyond it
  let near = -1, far = -1;
  for (let i = 0; i < st.w.N; i++) {
    if (st.w.water[i]) continue;
    const d = hexSteps(st.w, here, i);
    if (near < 0 && d <= 2) near = i;
    if (far < 0 && d >= 5) far = i;
  }
  assert.ok(near >= 0 && far >= 0);
  const mk = (key, kind, site) => post(st, key, kind, owner, site, { hours: 10 });
  const bg = mk('t:bg', 'tBack', near), bg2 = mk('t:bg2', 'tBack2', near), pt = mk('t:pt', 'tPart', near), pt2 = mk('t:pt2', 'tPart', near);
  const full = mk('t:full', 'tFull', near), farFull = mk('t:farFull', 'tFull', far), farBg = mk('t:farBg', 'tBack', far);
  const go = (j) => issue(st, { actor: a.id, verb: 'work', target: j.key, source: 'debug' });
  assert.strictEqual(a.mind, undefined);
  // the pair is held, one of each, beside the task in hand
  assert.strictEqual(go(full), true); assert.strictEqual(a.job, full);
  assert.strictEqual(go(bg), true); assert.strictEqual(go(pt), true);
  assert.deepStrictEqual(a.mind, [bg, pt]); assert.strictEqual(a.job, full, 'the task in hand stays');
  assert.ok(bg.claims.includes(a.id) && pt.claims.includes(a.id));
  // never two that bar, nor two that yield
  assert.match(go(bg2), /already minds t:bg/); assert.match(go(pt2), /already minds t:pt/);
  // out of reach: refused
  VB['sim/attention'].unhold(st, a, bg); assert.deepStrictEqual(a.mind, [pt]);
  assert.match(go(farBg), /out of its reach/);
  assert.strictEqual(go(bg), true);
  // the matcher offers a pawn with a background task only tasks within reach (VB-136: a full one too, so the herder works by the pasture)
  const c = Sim.cal(st.t);
  VB['sim/attention'].unhold(st, a, pt); A.release(st, a);
  assert.strictEqual(VB['sim/attention'].offerWhy(st, a, pt2), null, 'a charge that yields, in reach, is offered');
  assert.strictEqual(VB['sim/attention'].offerWhy(st, a, full), null, 'a full task in reach is offered');
  assert.ok(VB['sim/attention'].offerWhy(st, a, farFull), 'a full task out of reach is not');
  assert.ok(VB['sim/attention'].offerWhy(st, a, bg2), 'a second charge that bars is not');
  assert.strictEqual(bid(st, a, farFull, c), -1);
  // taking full work out of reach (the urgency switch) drops the background task, and reopens it
  assert.strictEqual(go(farFull), true);
  assert.strictEqual(a.mind, undefined, 'the background task is dropped');
  assert.ok(!bg.claims.includes(a.id) && isOpen(st, bg), 'and reopened for others');
  // within reach a background task is minded at its rate, in closed form, its end queued (VB-472, VB-473); a walk out of reach drops it
  A.release(st, a); walk(near); assert.strictEqual(go(bg), true);
  assert.ok(bg.rate === KINDS[bg.kind].rate && bg.due > st.tick && st.workDue.includes(bg), 'minded at the side, its end queued');
  const was = VB['sim/work'].doneOf(st, bg);
  st.tick++; st.t = st.tick / TICKS; A.stepAgents(st, Sim.cal(st.t));
  assert.ok(Math.abs(VB['sim/work'].doneOf(st, bg) - was - KINDS[bg.kind].rate / TICKS) < 1e-9, 'a step of minding, worked out with no stepping');
  A.walkTo(st, a, far, st.w.hx[far], st.w.hy[far]); // looked at as its leg begins: it ends out of reach
  assert.strictEqual(a.mind, undefined, 'out of reach, dropped'); assert.ok(isOpen(st, bg) && !st.workDue.includes(bg));
  // with no task in hand, a background task out of reach is taken up and set out for; walking into reach it is kept, unworked
  arrive(); A.release(st, a); walk(here);
  assert.strictEqual(go(farBg), true); assert.deepStrictEqual(a.mind, [farBg]); assert.ok(a.path, 'it sets out');
  const before = farBg.done;
  st.tick++; st.t = st.tick / TICKS; A.stepAgents(st, Sim.cal(st.t));
  assert.ok(a.mind && a.mind[0] === farBg, 'kept on the way'); assert.strictEqual(VB['sim/work'].doneOf(st, farBg), before, 'not worked on the way');
  assert.ok(!(farBg.rate > 0), 'no rate on the way');
  arrive();
  assert.ok(a.mind && a.mind[0] === farBg && farBg.rate > 0, 'minded once there: looked at as its leg ends');
  VB['sim/attention'].unhold(st, a, farBg);
  // a death lets go all
  walk(near);
  assert.strictEqual(go(bg), true); assert.strictEqual(go(pt), true);
  Sim.killPawn(st, a.id, 'illness');
  assert.strictEqual(a.mind, undefined); assert.ok(!bg.claims.includes(a.id) && !pt.claims.includes(a.id));
  // a herd minded while its herder spins (VB-1750; design.md section 7, A held charge): a herder with no task in hand stands where the
  // spinning is (its reach 0, at the house) within reach of the herd's pasture; both are minded at once, each at its rate, and a full
  // task out of the herd's reach is not offered, while the spinning bars nothing
  const b = st.agents.find((x) => x !== a && st.pawns[x.id].died === null && st.pawns[x.id].household !== null);
  A.release(st, b);
  const bHere = VB['sim/pose'].tileAt(st, ...VB['sim/pose'].placeOf(st, b));
  let pasture = -1, away = -1;
  for (let i = 0; i < st.w.N; i++) {
    if (st.w.water[i]) continue;
    const d = hexSteps(st.w, bHere, i);
    if (pasture < 0 && d === 2) pasture = i;
    if (away < 0 && d >= 6) away = i;
  }
  Object.assign(KINDS, { tHerd: { ...base, mind: true, reach: 3, rate: 1 }, tSpin: { ...base, mind: true, yields: true, reach: 0, rate: 1 } });
  T.tHerd = KINDS.tHerd; T.tSpin = KINDS.tSpin;
  const herd = post(st, 't:herd', 'tHerd', owner, pasture, { hours: 9 }), spin = post(st, 't:spin', 'tSpin', owner, bHere, { hours: 40 });
  const farWork = post(st, 't:farWork', 'tFull', owner, away, { hours: 10 });
  const goB = (j) => issue(st, { actor: b.id, verb: 'work', target: j.key, source: 'debug' });
  assert.strictEqual(goB(herd), true); assert.ok(!b.path, 'the pasture is in reach: it stays');
  assert.strictEqual(goB(spin), true, 'it spins beside the herd');
  assert.deepStrictEqual(b.mind, [herd, spin]);
  assert.ok(herd.rate === 1 && spin.rate === 1 && st.workDue.includes(herd) && st.workDue.includes(spin), 'both minded, both ends queued');
  const h0 = VB['sim/work'].doneOf(st, herd), s0 = VB['sim/work'].doneOf(st, spin);
  for (let i = 0; i < TICKS; i++) { st.tick++; st.t = st.tick / TICKS; A.stepAgents(st, Sim.cal(st.t)); }
  assert.ok(Math.abs(VB['sim/work'].doneOf(st, herd) - h0 - 1) < 1e-9 && Math.abs(VB['sim/work'].doneOf(st, spin) - s0 - 1) < 1e-9, 'an hour of each');
  assert.ok(VB['sim/attention'].offerWhy(st, b, farWork), 'a full task out of the herd\'s reach is not offered');
  VB['sim/attention'].unhold(st, b, herd);
  assert.strictEqual(VB['sim/attention'].offerWhy(st, b, farWork), null, 'the spinning alone bars nothing');
  VB['sim/attention'].dropMind(st, b);
  assert.strictEqual(b.mind, undefined); assert.ok(!spin.claims.includes(b.id) && !(spin.rate > 0));
  console.log('attention ok');
} finally { for (const k of Object.keys(T)) delete KINDS[k]; }
