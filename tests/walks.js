// @suite fast
// VB-2042: the Walks map mode's listener slot in sim/legs. The page sets it while the mode is on; the sim never reads the page, so the run
// of a seed is the same with the listener set or not (the state's hash), and the listener is given each walk's points as setOut lays them.
const assert = require('assert');
const VB = require('../src/load.js'),
  Sim = VB.sim;
const { sha, canon } = require('./lib/canon.js');
const { listenWalks } = VB['sim/legs'];
const { DAY } = VB['sim/rules'];
const { state: make } = require('./lib/probe.js');

const hashOf = (st) =>
  sha(
    Object.keys(st)
      .filter((k) => k !== 'w')
      .sort()
      .map((k) => `${k}:${canon(st[k])}`)
      .join('\n'),
  );
const run = (listener) => {
  const st = make();
  listenWalks(listener);
  try {
    Sim.advance(st, 2 * DAY);
  } finally {
    listenWalks(null);
  }
  return st;
};
let walks = 0,
  points = 0,
  bad = 0;
const off = run(null),
  on = run((pts) => {
    walks++;
    points += pts.length;
    for (const p of pts) if (!(Number.isFinite(p[0]) && Number.isFinite(p[1]))) bad++;
  });
assert(walks > 0, 'the listener is given the walks set out on');
assert.strictEqual(bad, 0, 'each point is a place (x, y) on the map');
assert(points >= 2 * walks, 'a walk has a start and an end at the least');
assert.strictEqual(hashOf(on), hashOf(off), 'the run is the same with the listener set or not');
// the slot is cleared: a run after it gives the listener nothing
let late = 0;
const fn = () => late++;
listenWalks(fn);
listenWalks(null);
Sim.advance(make(), DAY);
assert.strictEqual(late, 0, 'a cleared listener is not called');
console.log(`walks ok: ${walks} walks of ${points} points over 2 days, the same state with the listener set or not`);
