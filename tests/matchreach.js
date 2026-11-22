// VB-288: distance governs the round's matching. A village's pool is the living of the villages within walking reach (hoursBetween
// finite), built from those villages' households; the score's villages' term is MARRIAGE.sameVillage x exp(-hours / nearHours); a
// wished partner beyond reach is refused with that reason (matchBar); and kin pressure counts only partners within reach.
const assert = require('assert'), VB = require('../src/load.js'), Sim = VB.sim, C = VB.culture;
const { tinyWorld, tinyState } = require('./lib/tiny.js'), { checkState } = require('./lib/invariants.js');
const { MARRIAGE } = VB['sim/rules'], { poolFor, matchScore, matchBar } = VB['sim/matching'], R = VB['sim/records'];
const out = [];
// A, B and C on one meadow, each of two farms; the walking hours between them are set by hand per case
const rows = Array.from({ length: 12 }, () => '.'.repeat(60));
const fresh = () => {
  const st = tinyState(tinyWorld(rows), [{ at: [5, 5], farms: 2 }, { at: [25, 5], farms: 2 }, { at: [45, 5], farms: 2 }], { seed: 5 });
  st.naturalDeaths = false;
  return st;
};
const set = (st, a, b, h) => { st.villageHours[a][b] = h; st.villageHours[b][a] = h; };
const vOf = (st, id) => R.settlementIdOf(st, st.pawns[id]);

// ---- the pool: the living of A and of B (in reach), none of C (beyond it) ----
{
  const st = fresh();
  set(st, 0, 1, 6); set(st, 0, 2, null); set(st, 1, 2, 9);
  const pool = poolFor(st, 0), want = st.living.filter((id) => vOf(st, id) === 0 || vOf(st, id) === 1);
  assert.deepStrictEqual([...pool].sort((a, b) => a - b), [...want].sort((a, b) => a - b), 'the pool is the living of A and B');
  assert(pool.some((id) => vOf(st, id) === 1) && !pool.some((id) => vOf(st, id) === 2), 'B in the pool, C not');
  assert.strictEqual(new Set(poolFor(st, 1)).size, st.living.length, "B's pool reaches A and C");
  out.push(`pool of A: ${pool.length} of ${st.living.length} living`);
}

// ---- the villages' term: 2 x exp(-h / 8), 0 beyond reach ----
{
  const st = fresh(), m = st.pawns[st.living.find((id) => vOf(st, id) === 0 && st.pawns[id].sex === 'm')];
  const f = st.pawns[st.living.find((id) => vOf(st, id) === 1 && st.pawns[id].sex === 'f')];
  const score = (h) => { set(st, 0, 1, h); return matchScore(st, { ...m, age: 23 }, { ...f, age: 20 }, 0, false); };
  const none = score(null);
  for (const [h, want] of [[0, 2], [4, 1.21], [6, 0.94], [12, 0.45], [24, 0.1], [41, 0.01]])
    assert(Math.abs(score(h) - none - want) < 0.006, `the term at ${h} h is ${want} (${(score(h) - none).toFixed(3)})`);
  assert.strictEqual(MARRIAGE.nearHours, 8);
  out.push('term 2, 1.21, 0.94, 0.45, 0.10, 0.01 at 0, 4, 6, 12, 24, 41 h');
}

// ---- the wish's bar: a partner beyond reach is refused with that reason ----
{
  const st = fresh(), single = (v, sex) => st.pawns[st.living.find((id) => vOf(st, id) === v && st.pawns[id].sex === sex && R.spouseOf(st, id) === null)];
  const m = single(0, 'm'), f = single(2, 'f');
  for (const p of [m, f]) { p.born = st.t - 25 * Sim.YEAR; p.hunger = 0; } // of age, and fed
  set(st, 0, 2, null);
  const far = matchBar(st, m.id, f.id);
  assert(far.why && /beyond walking reach/.test(far.why), `beyond reach: refused (${far.why})`);
  set(st, 0, 2, 10);
  assert(!/beyond walking reach/.test(matchBar(st, m.id, f.id).why || ''), 'within reach: not refused for the distance');
  out.push(`wish beyond reach: "${far.why}"`);
}

// ---- the round marries only within reach; kin pressure counts partners within reach ----
// Every single man of A a son of X, every single woman of A a daughter of X too (his sisters, who never marry), every single woman of B
// a daughter of Y, X and Y brother and sister: under "first" each of A's men has only first cousins in B. With B in reach he is pulled
// towards "close"; with B beyond reach he has nobody even under "close", and is not pulled.
const kin = C.IDX.kinLimit, opts = C.DIMS[kin].opts.map((o) => o[0]);
const round = (hoursAB) => {
  const st = fresh();
  set(st, 0, 1, hoursAB); set(st, 0, 2, null); set(st, 1, 2, null);
  for (const s of st.cenv.settlements) s.practice[kin] = opts.indexOf('first');
  for (const h of st.households) h.grain.barley += 5000; // the means to marry (VB-153)
  // the unmarried of A and B (the tiny state's children) made of an age to marry
  const single = st.pawns.filter((p) => p.alive && R.spouseOf(st, p.id) === null && vOf(st, p.id) !== 2);
  for (const p of single) p.born = st.t - (p.sex === 'm' ? 22 : 20) * Sim.YEAR;
  const rest = st.pawns.filter((p) => !single.includes(p)), [G, X, Y] = rest;
  G.father = G.mother = null; X.father = Y.father = G.id; X.mother = Y.mother = null;
  for (const p of single) { p.father = vOf(st, p.id) === 0 ? X.id : Y.id; p.mother = null; }
  const villageOf = new Map(st.living.map((id) => [id, vOf(st, id)])), u0 = st.unions.length;
  Sim.movingRound(st);
  const wed = st.unions.slice(u0).map((u) => [villageOf.get(u.a), villageOf.get(u.b)]);
  const menA = single.filter((p) => p.sex === 'm' && vOf(st, p.id) === 0 && R.spouseOf(st, p.id) === null);
  // the parents were set by hand after the records' index was built, and the round read the index as it stood: built again for the
  // invariants, which compare it with one built afresh (VB-239)
  st.idx = null;
  assert.deepStrictEqual(checkState(st), [], 'invariants after the round');
  return { wed, menA, pulled: menA.filter((p) => p.kinPush && p.kinPush.to === 'close') };
};
{
  const near = round(6), far = round(null);
  assert(near.menA.length > 0, 'setup: single men of A');
  assert(far.wed.every(([a, b]) => a === b), `beyond reach, every marriage is within one village (${JSON.stringify(far.wed)})`);
  assert(near.pulled.length > 0, `B in reach: A's men are pulled towards "close" (${near.pulled.length} of ${near.menA.length})`);
  assert.strictEqual(far.pulled.length, 0, 'B beyond reach: none of them is pulled');
  out.push(`kin pressure: ${near.pulled.length} of A's men pulled with B in reach, 0 beyond`);
}
console.log('match reach (VB-288): ' + out.join('; '));
