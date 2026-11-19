// VB-1104: a change passed holds. At a village's meeting that changes a practice, and in each village that takes up a change of its
// culture's custom, the voices that favour the new way move their anchors P.hold of the way to their attitudes; the others keep theirs.
// The culture's change names the villages that took it up and those that kept the old. A constructed environment, no simulation.
const assert = require('assert');
const C = require('../src/load.js').culture;

const d = C.IDX.heirCount,
  o = C.OFF[d],
  n = C.NOPT[d],
  custom = C.fromArchetype('oldNordic'),
  x = custom[d],
  y = (x + 1) % n;
// an attitude on heirCount giving share a to y and the rest to x, the other customs as the archetype's
const att = (a) => {
  const v = C.seedAttitude(custom, () => 0.5);
  for (let j = 0; j < n; j++) v[o + j] = j === y ? a : j === x ? 1 - a : 0;
  return v;
};
function world(shares) {
  const env = { t: 0, cultures: [], settlements: [], people: [], driftMul: 1 };
  const c = C.makeCulture(env, 'Test', custom, 0);
  shares.forEach((list, k) => {
    const s = { id: k, name: 'V' + k, culture: c.id, kind: 'village', tie: k === 0 ? 1 : 0.5, practice: Int8Array.from(custom), list: [] };
    env.settlements.push(s);
    for (const [a, voice] of list) {
      const p = { id: env.people.length, alive: true, age: 40, att: att(a), anc: att(0), ties: new Map(), standing: 1, voice };
      env.people.push(p);
      s.list.push(p);
    }
  });
  const hooks = {
    membersOf: (s) => s.list,
    voiceOf: (p) => p.voice,
    byId: (id) => env.people[id],
    settlementOf: (p) => env.settlements.find((s) => s.list.includes(p)),
    nameCulture: () => 'New',
  };
  return { env, c, hooks };
}

// a village meeting: three voices for y carry it over one for x; a pawn with no voice holds no anchor
{
  const { env, hooks } = world([[[0.9, 1], [0.9, 1], [0.8, 1], [0.1, 1], [0.9, 0]]]);
  const s = env.settlements[0];
  s.tie = 0; // a village with no tie to a centre: the margin to leave the custom is P.margin, times fewVoices for its four voices
  const ch = C.meeting(env, hooks, s);
  assert.deepStrictEqual(ch.map((c) => [c.dim, c.to]), [[d, y]], 'the meeting changes heirCount alone');
  assert.strictEqual(s.practice[d], y);
  const [a, , , against, mute] = s.list;
  assert(Math.abs(a.anc[o + y] - 0.9 * C.P.hold) < 1e-6, `a voice that carried it holds to it (${a.anc[o + y]})`);
  assert.strictEqual(against.anc[o + y], 0, 'a voice against it keeps its anchor');
  assert.strictEqual(mute.anc[o + y], 0, 'a pawn with no voice keeps its anchor');
}

// the culture's reckoning: the centre village carries the custom; a village that clearly prefers the old keeps it, and is named
{
  const { env, c, hooks } = world([
    Array.from({ length: 12 }, () => [0.9, 1]),
    Array.from({ length: 12 }, () => [0.1, 1]),
  ]);
  for (const s of env.settlements) {
    const { S, W } = C.support(env, s.list, (p) => p.voice);
    s.lastSupport = S;
    s.lastVoices = W;
  }
  const r = C.cultureYear(env, hooks, c);
  const x1 = r.changes.find((q) => q.dim === d);
  assert(x1, 'the custom changes');
  assert.deepStrictEqual([x1.took, x1.kept], [[0], [1]], 'taken up by the centre, kept old by the other');
  assert.strictEqual(env.settlements[1].practice[d], x, 'the village that kept the old keeps its practice');
  assert(env.settlements[0].list[0].anc[o + y] > 0, 'the voices of the village that took it up hold to it');
  assert.strictEqual(env.settlements[1].list[0].anc[o + y], 0, 'those of the village that kept the old do not');
}
console.log('customhold: ok');
