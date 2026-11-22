// Attention (VB-251): a pawn holds one task and, besides it, one partial and one background task; a background task is held within its
// reach, and dropped, reopened for others, when the pawn leaves reach or takes a full task out of it. Test-only kinds, one of each attention.
const assert = require('assert');
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim, { issue } = VB['sim/commands'], { KINDS, isOpen } = VB['sim/kinds'];
const { post, bid } = VB['sim/jobs'], { hexSteps } = VB['sim/hex'], A = VB['sim/agents'], { TICKS } = VB['sim/rules'];
const it = G.generate(7); let r; while (!(r = it.next()).done);
const st = Sim.seed(r.value, 7, 'founders');
Sim.advance(st, 3 * Sim.DAY + 4);
const base = { ...KINDS.plow, done: undefined, available: undefined, stages: undefined, urgency: undefined };
const T = {
  tFull: { ...base }, tPart: { ...base, attention: 'partial' },
  tBack: { ...base, attention: 'background', reach: 2, rate: 0.5 }, tBack2: { ...base, attention: 'background', reach: 2, rate: 0.5 },
};
Object.assign(KINDS, T);
try {
  const a = st.agents.find((x) => st.pawns[x.id].died === null && st.pawns[x.id].household !== null), p = st.pawns[a.id];
  A.release(st, a);
  const owner = { type: 'household', id: p.household }, here = A.tileAt(st, ...A.placeOf(st, a));
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
  assert.strictEqual(a.side, undefined);
  // the pair is held, one of each, beside the task in hand
  assert.strictEqual(go(full), true); assert.strictEqual(a.job, full);
  assert.strictEqual(go(bg), true); assert.strictEqual(go(pt), true);
  assert.strictEqual(a.side.background, bg); assert.strictEqual(a.side.partial, pt); assert.strictEqual(a.job, full, 'the task in hand stays');
  assert.ok(bg.claims.includes(a.id) && pt.claims.includes(a.id));
  // never two of one attention
  assert.match(go(bg2), /already holds a background/); assert.match(go(pt2), /already holds a partial/);
  // out of reach: refused
  A.unhold(st, a, bg); assert.strictEqual(a.side.background, null);
  assert.match(go(farBg), /out of its reach/);
  assert.strictEqual(go(bg), true);
  // the matcher offers a pawn with a background task only tasks within reach (VB-136: a full one too, so the herder works by the pasture)
  const c = Sim.cal(st.t);
  A.unhold(st, a, pt); A.release(st, a);
  assert.strictEqual(A.offerWhy(st, a, pt2), null, 'a partial task in reach is offered');
  assert.strictEqual(A.offerWhy(st, a, full), null, 'a full task in reach is offered');
  assert.ok(A.offerWhy(st, a, farFull), 'a full task out of reach is not');
  assert.ok(A.offerWhy(st, a, bg2), 'a second background task is not');
  assert.strictEqual(bid(st, a, farFull, c), -1);
  // taking full work out of reach (the urgency switch) drops the background task, and reopens it
  assert.strictEqual(go(farFull), true);
  assert.strictEqual(a.side, undefined, 'the background task is dropped');
  assert.ok(!bg.claims.includes(a.id) && isOpen(st, bg), 'and reopened for others');
  // within reach a background task is minded at its rate, in closed form, its end queued (VB-472, VB-473); a walk out of reach drops it
  A.release(st, a); walk(near); assert.strictEqual(go(bg), true);
  assert.ok(bg.rate === KINDS[bg.kind].rate && bg.due > st.tick && st.workDue.includes(bg), 'minded at the side, its end queued');
  const was = A.doneOf(st, bg);
  st.tick++; st.t = st.tick / TICKS; A.stepAgents(st, Sim.cal(st.t));
  assert.ok(Math.abs(A.doneOf(st, bg) - was - KINDS[bg.kind].rate / TICKS) < 1e-9, 'a step of minding, worked out with no stepping');
  A.walkTo(st, a, far, st.w.hx[far], st.w.hy[far]); // looked at as its leg begins: it ends out of reach
  assert.strictEqual(a.side, undefined, 'out of reach, dropped'); assert.ok(isOpen(st, bg) && !st.workDue.includes(bg));
  // with no task in hand, a background task out of reach is taken up and set out for; walking into reach it is kept, unworked
  arrive(); A.release(st, a); walk(here);
  assert.strictEqual(go(farBg), true); assert.strictEqual(a.side.background, farBg); assert.ok(a.path, 'it sets out');
  const before = farBg.done;
  st.tick++; st.t = st.tick / TICKS; A.stepAgents(st, Sim.cal(st.t));
  assert.strictEqual(a.side && a.side.background, farBg, 'kept on the way'); assert.strictEqual(A.doneOf(st, farBg), before, 'not worked on the way');
  assert.ok(!(farBg.rate > 0), 'no rate on the way');
  arrive();
  assert.ok(a.side && a.side.background === farBg && farBg.rate > 0, 'minded once there: looked at as its leg ends');
  A.unhold(st, a, farBg);
  // a death lets go all
  walk(near);
  assert.strictEqual(go(bg), true); assert.strictEqual(go(pt), true);
  Sim.killPawn(st, a.id, 'illness');
  assert.strictEqual(a.side, undefined); assert.ok(!bg.claims.includes(a.id) && !pt.claims.includes(a.id));
  console.log('attention ok');
} finally { for (const k of Object.keys(T)) delete KINDS[k]; }
