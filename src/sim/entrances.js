// @sys sim/entrances: a building's entrance (VB-1951; Kim, 27 Nov 2026): w.gate, the side of a house's hex that walks enter and leave it
// by, set when the house is placed, facing the nearest worn way or else its village's centre; and the gate's point, where walks pass it
VB['sim/entrances'] = (() => {
  const { through, walkable } = VB['sim/walking'];
  const { bfs } = VB['sim/hex'];
  const { findRoute } = VB['sim/routes'];
  // @tunable GATE: `way`, how far a new house looks for a worn way (a path or a lane) to face, in walking steps (with none in reach it
  // faces its village's centre); `stage`, the wear that counts as a way; `turnHours`, the work of moving a farmstead's gate (its posts
  // and the fence piece that closes the old side, sim/gateturn): half a day's work.
  const GATE = { way: 6, stage: 2, turnHours: 4 };
  // Fresh gates for a world: none set (every side open); the settlement generator calls it.
  function initGates(w) {
    // @state w.gate: Int8Array per tile; the side of a house (0 to 5, its index in w.nb) that walks enter and leave it by, -1 any side
    w.gate = new Int8Array(w.N).fill(-1);
  }
  // The nearest tile within GATE.way steps of `from` worn to a path or more, by a breadth-first search over land a route may cross; -1.
  function nearestWay(w, from) {
    if (!w.worn) return -1;
    const seen = new Set([from]);
    let ring = [from];
    for (let s = 0; s < GATE.way && ring.length; s++) {
      const next = [];
      for (const i of ring)
        for (let d = 0; d < 6; d++) {
          const j = w.nb[i * 6 + d];
          if (j < 0 || seen.has(j) || !through(w, j)) continue;
          if (w.worn[j] >= GATE.stage) return j;
          seen.add(j);
          next.push(j);
        }
      ring = next;
    }
    return -1;
  }
  // The side a house on tile `house` would have its gate on (Kim, 27 Nov: a new house faces the nearest worn way, else its village's
  // centre `center`): the side its route to that place leaves by; with no route, the first side open to cross; -1 with none open. A
  // house that has a gate keeps it. Writes nothing: the generator and a new plot ask it of a site before they choose (VB-1951).
  function gateSide(w, house, center = -1) {
    if (w.gate && w.gate[house] >= 0) return w.gate[house];
    let to = nearestWay(w, house);
    if (to < 0) to = center;
    let side = -1;
    if (to >= 0 && to !== house) {
      const p = findRoute(w, house, to, Infinity);
      if (p && p.length > 1) for (let d = 0; d < 6; d++) if (w.nb[house * 6 + d] === p[1]) side = d;
    }
    for (let d = 0; side < 0 && d < 6; d++) if (through(w, w.nb[house * 6 + d])) side = d;
    return side;
  }
  // The gate of the house on tile `house` is set, to gateSide's side. The side, or -1.
  function faceGate(w, house, center = -1) {
    if (!w.gate) initGates(w);
    w.gate[house] = -1;
    w.gate[house] = gateSide(w, house, center);
    return w.gate[house];
  }
  // Walking steps from a house (or a site for one) out by its gate on `side` (-1: any side), up to maxSteps: a Map of tile to steps, the
  // house at 0, the gate's tile at 1 and the rest one more than from there, never back through the house. The one measure of a walk from
  // a house that the field placers read, the generator's and a head's alike (Kim, 27 Nov: no difference between them).
  function gateSteps(w, house, maxSteps, side = w.gate ? w.gate[house] : -1) {
    const walk = walkable(w);
    if (side < 0) return bfs(w, house, maxSteps, walk).dist;
    const n = w.nb[house * 6 + side],
      out = new Map([[house, 0]]);
    if (n < 0 || !walk(n) || maxSteps < 1) return out;
    for (const [t, d] of bfs(w, n, maxSteps - 1, (j) => j !== house && walk(j)).dist) out.set(t, d + 1);
    return out;
  }
  // The gate of the house on `house` is moved to side `side` (sim/gateturn, when the work is done).
  function turnGate(w, house, side) {
    if (!w.gate) initGates(w);
    w.gate[house] = side;
  }
  // A house moved or gone: its old tile has no gate.
  function clearGate(w, tile) {
    if (w.gate) w.gate[tile] = -1;
  }
  // fn() read as if the house on `tile` had no gate (its farm moving off it: the way from the landing once the house is gone).
  function sansGate(w, tile, fn) {
    const s = w.gate ? w.gate[tile] : -1;
    if (s >= 0) w.gate[tile] = -1;
    try {
      return fn();
    } finally {
      if (s >= 0) w.gate[tile] = s;
    }
  }
  // The point of tile i's gate, where its hex meets the neighbour the gate opens on, or null when it has none.
  function gatePoint(w, i) {
    const s = w.gate ? w.gate[i] : -1;
    if (s < 0) return null;
    const n = w.nb[i * 6 + s];
    return [(w.hx[i] + w.hx[n]) / 2, (w.hy[i] + w.hy[n]) / 2];
  }
  return { GATE, initGates, gateSide, faceGate, turnGate, gateSteps, clearGate, sansGate, gatePoint, nearestWay };
})();
