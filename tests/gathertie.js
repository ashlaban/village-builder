// VB-296: customs drawn together. A village that goes to its culture's centre's gathering is tied the closer to it; those at a gathering meet
// as strangers at most GATHERING.contacts a pawn a day; a culture whose villages fill two gatherings is told as a candidate to split.
const assert = require('assert');
const VB = require('../src/load.js');
const { tinyWorld, tinyState } = require('./lib/tiny.js');
const Gt = VB['sim/gathering'], { GATHERING } = VB['sim/rules'], { membersOf } = VB['sim/records'];
const { updateTie } = VB['sim/society'], { ENCOUNTERS } = VB['sim/encounters'], { emit } = VB['sim/events'];
const { meetingStage } = VB['sim/meetings'];
const XS = [4, 30, 56, 200, 226, 252];
const make = () => tinyState(tinyWorld(Array(12).fill('.'.repeat(296)), { seed: 7 }), XS.map((x) => ({ at: [x, 5], farms: 2, sizes: [5, 4] })), { seed: 7 });
const meet = (st) => { for (const v of st.villages) Gt.chooseGathering(st, st.cenv.settlements[v.id], true, membersOf(st, v.id)); };
const tieOf = (st, v) => { updateTie(st, v, membersOf(st, v)); return st.cenv.settlements[v].tie; };
{ // the tie term and the candidate to split
  const st = make();
  assert.strictEqual(new Set(st.cenv.settlements.map((s) => s.culture)).size, 1, 'one culture');
  const centre = st.cenv.cultures[0].centres[0], other = centre === 1 ? 2 : 1;
  const was = tieOf(st, other), y = 1;
  st.villages[centre].gathering = { host: centre, year: y };
  st.villages[other].gathering = { host: centre, year: y };
  const now = tieOf(st, other);
  assert.ok(Math.abs(Math.min(1, was + GATHERING.tie) - now) < 1e-9, `tie ${was} to ${now}`);
  st.villages[other].gathering = { host: other, year: y };
  assert.strictEqual(tieOf(st, other), was, 'another gathering adds nothing');
  meet(st);
  VB.resetCounts();
  meetingStage(st, 60);
  const hosts = new Set(st.villages.map((v) => v.gathering && v.gathering.host).filter((h) => h !== null && h !== undefined));
  assert.ok(hosts.size > 1, `two clusters, two gatherings: ${hosts.size}`);
  assert.strictEqual(VB.count.splitCandidate, 1, 'the culture is told as a candidate to split');
}
{ // the cap: a stranger is out of the draw once a pawn has met GATHERING.contacts today; a known pawn stays
  const st = make(), ids = st.living.slice(0, 12), o = { id: 77, kind: 'gathering', come: ids, fresh: {} };
  st.occasions.push(o);
  for (const id of ids) { const a = st.agents[id]; a.occasion = 77; a.path = null; st.pawns[id].ties.clear(); }
  const near = {}, busy = new Int32Array(st.agents.length + 1), found = [], a = st.agents[ids[0]];
  const draw = () => { found.length = 0; ENCOUNTERS.occasion.sample(st, a, near, busy, 1, found); return found.length; };
  assert.ok(draw() > 0, 'strangers are drawn');
  o.fresh[a.id] = GATHERING.contacts;
  assert.strictEqual(draw(), 0, 'none at the cap');
  st.pawns[a.id].ties.set(ids[1], 1);
  draw();
  assert.ok(found.every((b) => b.id === ids[1]), 'only the known');
  o.fresh = {}; // a talk of strangers counts for both
  emit(st, 'talked', { a: ids[2], b: ids[3], fresh: true });
  assert.deepStrictEqual(o.fresh, { [ids[2]]: 1, [ids[3]]: 1 });
  emit(st, 'talked', { a: ids[2], b: ids[3], fresh: false });
  assert.strictEqual(o.fresh[ids[2]], 1, 'an old contact is not counted');
}
console.log('gathertie ok');
