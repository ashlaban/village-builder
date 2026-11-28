// @suite fast
// VB-314: the alderman. At a village's meeting, when the office is vacant, its holders choose one (elected, or by turns a farm a year);
// a village of one farm has its holder; the office is vacated on his death or when his year ends; he presides over a tie, gains
// standing, and the village store's gift is booked as goodwill between him and the receiving holder. A constructed state.
const assert = require('assert');
const VB = require('../src/load.js'),
  Sim = VB.sim;
const { tinyWorld, tinyState } = require('./lib/tiny.js');
const { holdMeetings } = VB['sim/meetings'],
  { setPresider } = VB['sim/decisions'];
const map = Array.from({ length: 10 }, (_, i) => (i === 4 ? '...FF.........' : '..............'));
const st = tinyState(
  tinyWorld(map),
  [
    { at: [3, 5], farms: 3 },
    { at: [11, 2], farms: 1 },
  ],
  { seed: 7 },
);
const [a, b] = st.villages;
assert.ok(a.alderman === undefined || a.alderman === null, 'no alderman before a meeting');
holdMeetings(st);
const holderOf = (v, i) => st.households[st.farmsteads[v.farmsteads[i]].household].holder;
assert.ok(a.farmsteads.map((_, i) => holderOf(a, i)).includes(a.alderman), 'the village elects one of its holders');
assert.strictEqual(b.alderman, holderOf(b, 0), 'a village of one farm has its holder');
assert.strictEqual(st.record.filter((e) => e && e.kind === 'alderman').length, 2, 'each choice is an event');
const was = a.alderman;
holdMeetings(st);
assert.strictEqual(a.alderman, was, 'the office is held until it falls vacant');
// he dies: the next meeting vacates the office and chooses again
Sim.kill ? Sim.kill(st, was) : ((st.pawns[was].alive = false), (st.pawns[was].died = st.t));
holdMeetings(st);
assert.notStrictEqual(a.alderman, was, 'after a death the meeting chooses another');
assert.ok(
  st.record.some((e) => e && e.kind === 'alderman' && e.pawn === was && e.n !== undefined),
  'the vacated office is an event',
);
// by turns, a farm a year in the order of founding
for (const c of st.cenv.cultures) c.practices.alderman = 'byTurns';
const seen = [];
for (let y = 0; y < 4; y++) {
  st.t += Sim.YEAR;
  holdMeetings(st);
  seen.push(a.aldermanFarm);
}
assert.ok(!seen.includes(a.farmsteads[0]), 'the farm whose holder is dead has no turn');
assert.ok(
  seen.every((f, i) => i === 0 || f !== seen[i - 1]) && seen[2] === seen[0],
  'the others take turns, a farm a year, and round again',
);
console.log('alderman: ok');
