// VB-1951: a house's gate (sim/entrances; Kim, 27 Nov 2026). On a drawn map (tests/lib/tiny.js): every generated house has a gate on a
// side a route may cross, facing its village's green when no way is worn near; a route leaves and enters a house by its gate alone,
// however far round (Kim, 27 Nov: a hard rule); a walk passes the gate's point; a gate opening on land no route crosses is missed by
// nobody; a loaded run keeps its gates.
const VB = require('../src/load.js'),
  Sim = VB.sim;
const { tinyWorld, tinyState } = require('./lib/tiny.js');
const { faceGate, gatePoint } = VB['sim/entrances'];
const { gateMiss, through } = VB['sim/walking'];
const { findRoute } = VB['sim/routes'];
const { hexSteps } = VB['sim/hex'];
let failed = 0;
const check = (ok, m) => {
  if (!ok) {
    failed++;
    console.error('ENTRANCES FAIL:', m);
  }
};
const meadow = (cols, rows) => Array.from({ length: rows }, () => '.'.repeat(cols));
const w = tinyWorld(meadow(24, 13)),
  st = tinyState(w, [{ at: [8, 6], farms: 3, sizes: [3, 3, 3] }], { seed: 7 }),
  v = st.villages[0];
for (const f of st.farmsteads) {
  const s = w.gate[f.house],
    n = s >= 0 ? w.nb[f.house * 6 + s] : -1;
  check(s >= 0 && through(w, n), `farm ${f.id} has a gate on a side a route crosses (${s})`);
  if (f.house !== v.center && hexSteps(w, f.house, v.center) > 1)
    check(hexSteps(w, n, v.center) < hexSteps(w, f.house, v.center), `farm ${f.id}'s gate faces the green`);
}
// A house alone on open meadow, its gate set by hand: west (the side toward a tile two columns west).
const h = st.farmsteads[0].house,
  side = (to) => [0, 1, 2, 3, 4, 5].find((d) => w.nb[h * 6 + d] === to);
const ring = [0, 1, 2, 3, 4, 5].map((d) => w.nb[h * 6 + d]).filter((j) => j >= 0 && through(w, j));
check(ring.length === 6, 'the test house stands on open ground on every side');
w.gate[h] = 0;
const gateN = w.nb[h * 6 + 0];
// to a neighbour of the gate's neighbour, one step round: by the gate
const byGate = ring.find((j) => j !== gateN && hexSteps(w, j, gateN) === 1);
const p1 = findRoute(w, h, byGate);
check(p1 && p1[1] === gateN, `a route one step round leaves by the gate (${p1 && p1.join(' ')})`);
// to the tile behind the house: by the gate all the same, out and back (Kim, 27 Nov: a hard rule)
const opposite = w.nb[h * 6 + 3],
  behind = [0, 1, 2, 3, 4, 5]
    .map((d) => w.nb[opposite * 6 + d])
    .find((j) => j >= 0 && j !== h && hexSteps(w, j, h) === 2 && hexSteps(w, j, gateN) === 3);
const p2 = behind !== undefined && findRoute(w, h, behind),
  back = behind !== undefined && findRoute(w, behind, h);
check(p2 && p2[1] === gateN, `a route to the tile behind the house leaves by the gate (${p2 && p2.join(' ')})`);
check(back && back[back.length - 2] === gateN, `and the way back enters by it (${back && back.join(' ')})`);
check(gateMiss(w, h, opposite) === 1, 'a step out by the back misses the gate');
// a walk by the gate passes its point
const g = gatePoint(w, h);
check(
  g && Math.abs(g[0] - (w.hx[h] + w.hx[gateN]) / 2) < 1e-9,
  'the gate point is on the side between the house and the gate tile',
);
// a gate onto water is missed by nobody
const wasWater = w.water[gateN];
w.water[gateN] = 1;
VB['sim/walking'].recost(w, gateN);
check(gateMiss(w, h, w.nb[h * 6 + 3]) === 0, 'a gate onto water is missed by nobody');
w.water[gateN] = wasWater;
VB['sim/walking'].recost(w, gateN);
// faceGate again toward the green: a side, and a loaded run keeps the gates
faceGate(w, h, v.center);
const again = Sim.load(tinyWorld(meadow(24, 13)), JSON.parse(JSON.stringify(Sim.save(st))));
check(
  st.farmsteads.every((f) => again.w.gate[f.house] === w.gate[f.house]),
  'a loaded run keeps its gates',
);
// the run walks: a game day passes with no error
Sim.advance(st, VB['sim/rules'].DAY);
// turning a farmstead's gate (the small making `gate`, sim/gateturn): refused onto its own side or onto water; begun, the household's
// hands move it, and walks then leave by the new side
{
  const { issue } = VB['sim/commands'];
  const f = st.farmsteads[1],
    hh = st.households[f.household],
    old = w.gate[f.house],
    to = [0, 1, 2, 3, 4, 5].find((d) => d !== old && through(w, w.nb[f.house * 6 + d]));
  const turn = (side) => issue(st, { actor: hh.holder, verb: 'project', target: hh.id, args: { what: 'gate', side }, source: 'pawn' });
  check(/on that side/.test(turn(old)), `not onto its own side (${turn(old)})`);
  check(typeof turn(9) === 'string', 'not onto a side a house has not');
  check(turn(to) === true, `the gate's turning begun (${to})`);
  check(/being turned/.test(turn([0, 1, 2, 3, 4, 5].find((d) => d !== old && d !== to))), 'one turning at a time');
  for (let d = 0; d < 6 && w.gate[f.house] !== to; d++) Sim.advance(st, VB['sim/rules'].DAY);
  check(w.gate[f.house] === to, `moved by the household's hands (${w.gate[f.house]}, wanted ${to})`);
  check(st.record.some((e) => typeof e === 'object' && e.kind === 'gateTurned'), 'and told');
  const n = w.nb[f.house * 6 + to],
    far = [0, 1, 2, 3, 4, 5].map((d) => w.nb[n * 6 + d]).find((j) => j >= 0 && j !== f.house && through(w, j) && hexSteps(w, j, f.house) === 2);
  const p = far !== undefined && findRoute(w, f.house, far);
  check(p && p[1] === n, `a walk leaves by the new side (${p && p.join(' ')})`);
}
if (failed) process.exit(1);
console.log(
  'entrances ok: gates set toward the green, kept on a load; a route leaves and enters a house by its gate alone; a gate turned by the household',
);
