// Hunger: each rule on constructed households, then a report of hungry days, deaths by cause and marriages (reported, not asserted).
const assert = require('assert');
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim, Culture = VB.culture;
const { feedHousehold } = VB['sim/hunger'], { deathRoll } = VB['sim/deaths'], { HUNGER, YEAR, YEAR_DAYS } = VB['sim/rules'], { stepWork } = VB['sim/agents'];
const world = (seed) => { const it = G.generate(seed); let r; while (!(r = it.next()).done); return r.value; };
const w7 = world(7), fresh = (scenario = 'founders') => {
  const st = Sim.seed(w7, 7, scenario);
  for (const hh of st.households) hh.rations = 0; // these checks run on grain alone (tests/meals.js covers rations)
  return st;
};

// each feedOrder shares out a short supply as described
for (const [order, check] of [
  ['equal', (e) => assert(Math.abs(e.kid - e.man) < 1e-9, 'equal shares: the same shortfall for all')],
  ['children', (e) => { assert.strictEqual(e.kid, 0, 'children first: the child is fed'); assert(e.man > 0); }],
  ['workers', (e) => { assert.strictEqual(e.man, 0, 'workers first: the worker is fed'); assert(e.kid > 0); }],
]) {
  const st = fresh(), hh = st.households[0], p = hh.members.map((id) => st.pawns[id]), man = p.find((q) => q.age >= 20 && !q.retired);
  const child = p.find((q) => q !== man);
  child.born = st.t - 5 * YEAR; // a five-year-old joins the household
  hh.members = [man.id, child.id]; for (const q of [man, child]) q.hunger = 0, q.hungerLog = [];
  const s = st.cenv.settlements[Sim.settlementIdOf(st, man)]; s.practice[Culture.IDX.feedOrder] = Culture.optIndex('feedOrder', order);
  for (const fd of st.farmsteads[hh.farmstead].fields) fd.stage = 'growing'; // no seed to keep back
  hh.grain = 1.2; // a man needs 1 and a child 0.5
  feedHousehold(st, hh);
  check({ man: man.hungerLog[0], kid: child.hungerLog[0] });
  assert.strictEqual(hh.grain, 0); assert.strictEqual(hh.hungryDays, 1);
}

// seed corn is never eaten: 3 unsown fields keep 60 back
{
  const st = fresh('heirs'), hh = st.households[0], f = st.farmsteads[hh.farmstead], man = st.pawns[hh.members[0]];
  while (f.fields.length < 4) f.fields.push({ ...f.fields[0], id: f.fields.length });
  hh.members = [man.id]; man.hunger = 0; man.hungerLog = [];
  f.fields.forEach((fd, k) => { fd.stage = k < 3 ? 'plowed' : 'growing'; });
  assert.strictEqual(f.fields.filter((fd) => fd.stage === 'plowed').length, 3);
  hh.grain = 50; feedHousehold(st, hh);
  assert.strictEqual(hh.grain, 50, 'grain below the seed reserve is not eaten'); assert(man.hungerLog[0] > 0 && hh.hungryDays === 1);
  hh.grain = 100; feedHousehold(st, hh);
  assert(Math.abs(hh.grain - 99) < 1e-9, 'grain above the reserve is eaten (one ration)');
  hh.grain = 61; hh.members = [man.id]; feedHousehold(st, hh);
  assert(Math.abs(hh.grain - 60) < 1e-9);
}

// hunger level: mean shortfall over 12 days, and back to 0 after 12 fed days
{
  const st = fresh(), hh = st.households[0], p = st.pawns[hh.members[0]];
  hh.grain = 0; for (let d = 0; d < 12; d++) feedHousehold(st, hh);
  assert(Math.abs(p.hunger - 1) < 1e-9 && Math.abs(hh.hunger - 1) < 1e-9, 'starved for 12 days: h = 1');
  hh.grain = 1e6; for (let d = 0; d < 12; d++) feedHousehold(st, hh);
  assert.strictEqual(p.hunger, 0); assert.strictEqual(hh.hunger, 0);
}

// deaths: more at h = 1, by age group, and the added deaths are logged as hunger
{
  const trials = (a, h) => {
    const st = { t: 0, rand: (() => { let s = 12345; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); })() };
    let n = 0, hung = 0;
    for (let i = 0; i < 1500; i++) for (let d = 0; d < YEAR_DAYS * 40; d++) {
      const c = deathRoll(st, { born: -a * YEAR, hunger: h }); if (c) { n++; if (c === 'hunger') hung++; }
    }
    return { n, hung };
  };
  for (const [a, lo, hi] of [[2, 2, 3.2], [30, 1.15, 1.45], [70, 2, 3.2]]) {
    const fed = trials(a, 0), hungry = trials(a, 1), ratio = hungry.n / fed.n;
    assert(ratio > lo && ratio < hi, `age ${a}: deaths at h = 1 are ${ratio.toFixed(2)} times those when fed`);
    assert.strictEqual(fed.hung, 0); assert(hungry.hung > 0);
  }
}

// work: progress per hour is (1 - 0.4 h)
for (const h of [0, 1]) {
  const st = fresh(), a = st.agents[0]; st.pawns[0].hunger = h;
  a.job = { kind: 'sow', done: 0 }; a.work = null; stepWork(st, a, 1);
  assert(Math.abs(a.job.done - (1 - HUNGER.slow * h)) < 1e-9, `work at h = ${h}`);
}

// marriage: nobody with h >= 0.5 marries at the moving round
{
  const count = (h) => {
    const st = fresh('heirs'); for (const p of st.pawns) p.hunger = h;
    const before = st.unions.length; Sim.movingRound(st); return st.unions.length - before;
  };
  assert.strictEqual(count(0.5), 0, 'no marriage at h >= 0.5'); assert(count(0) > 0, 'the control marries');
}

// births: no conception at h = 1
{
  const { dailyBirths } = VB['sim/births'], st = fresh();
  for (const p of st.pawns) p.hunger = 1;
  for (let d = 0; d < 400; d++) { st.t += 24; dailyBirths(st); }
  assert(!st.pawns.some((p) => p.pregnantUntil !== null), 'no conception when starving');
}

// feedOrder: parents of young children lean towards children first
{
  const st = fresh('populous'); Sim.refreshInterests(st);
  const k = Culture.IDX.feedOrder, o = Culture.OFF[k], j = Culture.optIndex('feedOrder', 'children');
  const parent = st.pawns.find((p) => p.alive && p.interest && Sim.childrenOf(st, p.id).some((c) => st.pawns[c].age < 14));
  assert(parent && parent.interest[o + j] === 1, 'a parent of a young child wants children first');
}

for (const seed of [7, 42]) {
  const st = Sim.seed(world(seed), seed, 'founders'), rows = [];
  for (let y = 1; y <= 3; y++) {
    const d0 = st.pawns.filter((p) => p.died !== null).length, h0 = st.households.reduce((s, h) => s + h.hungryDays, 0), u0 = st.unions.length;
    Sim.advance(st, YEAR);
    const dead = st.pawns.filter((p) => p.died !== null && p.died > st.t - YEAR), hunger = dead.filter((p) => p.events.some((e) => /hunger/.test(e.text || '')));
    rows.push(`year ${y}: ${st.households.reduce((s, h) => s + h.hungryDays, 0) - h0} hungry days, ${st.pawns.filter((p) => p.died !== null).length - d0} deaths (${hunger.length} of hunger), ${st.unions.length - u0} marriages`);
  }
  console.log(`founders, seed ${seed}:\n  ${rows.join('\n  ')}`);
}
console.log('hunger ok');
