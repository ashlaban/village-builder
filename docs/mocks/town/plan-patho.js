// Hard cases for the road mock (thread "Redesign road layout for hex maps", Kim 27 Nov: "compare pathological cases"): lanes laid by
// hand (w.worn 3) on the town mock's island, no town. Each case is one shot; render it as the game draws today and as A and B:
//   node docs/mocks/town/town.js --plan docs/mocks/town/plan-patho.js --out docs/mocks/roads/img/patho [--roads A|B]
// Tiles are [col, row] in the page's offset layout (odd rows shifted right); line(a, b) is the hex line between two tiles.
const base = require('./plan.js');
const toCube = ([c, r]) => { const q = c - (r - (r & 1)) / 2; return [q, r, -q - r]; };
const toOff = ([q, r]) => [q + (r - (r & 1)) / 2, r];
const roundCube = ([x, y, z]) => {
  let rx = Math.round(x), ry = Math.round(y), rz = Math.round(z);
  const dx = Math.abs(rx - x), dy = Math.abs(ry - y), dz = Math.abs(rz - z);
  if (dx > dy && dx > dz) rx = -ry - rz; else if (dy > dz) ry = -rx - rz; else rz = -rx - ry;
  return [rx, ry, rz];
};
function line(a, b) {
  const A = toCube(a), B = toCube(b), n = Math.max(...A.map((v, k) => Math.abs(v - B[k])));
  const out = [];
  for (let k = 0; k <= n; k++) {
    const t = n ? k / n : 0;
    out.push(toOff(roundCube(A.map((v, j) => v + (B[j] - v) * t + 1e-6 * (j + 1)))));
  }
  return out;
}
const path = (...pts) => pts.slice(1).flatMap((p, k) => line(pts[k], p).slice(k ? 1 : 0));
const wear = (n, tiles) => tiles.map(([c, r]) => [c, r, n]);
const ring = ([c, r]) => { // the six neighbours of a tile, in order round it
  const d = r & 1 ? [[1, 0], [1, -1], [0, -1], [-1, 0], [0, 1], [1, 1]] : [[1, 0], [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1]];
  const ns = d.map(([dc, dr]) => [c + dc, r + dr]);
  return [ns[0], ns[1], ns[2], ns[3], ns[4], ns[5], ns[0]];
};
// 1. two long roads at awkward angles to the hex lines, crossing (the north-west island)
const cross = [wear(3000, line([2, 5], [12, 7])), wear(2000, line([4, 9], [10, 4]))];
// 2. a hub: five roads into one hex (the main island)
const hubC = [27, 19];
const hub = [[27, 15], [31, 18], [30, 23], [24, 22], [23, 18]].map((p, k) => wear(4000 - k * 400, line(hubC, p)));
// 3. a worn blob: a patch of lane tiles three wide, roads leaving it (the east island)
const blob = [wear(2500, [[38, 18], [39, 18], [40, 18], [38, 19], [39, 19], [40, 19], [38, 20], [39, 20], [40, 20]]),
  wear(2500, line([40, 19], [43, 18])), wear(2000, line([38, 20], [36, 22])), wear(2000, line([39, 18], [38, 14]))];
// 4. a ladder: two roads side by side on neighbouring rows (the south of the main island)
const ladder = [wear(3000, line([22, 25], [31, 25])), wear(2500, line([23, 26], [30, 26]))];
// 5. a ring round one hex, a road in and out (the south-west island)
const ringC = [7, 26];
const rings = [wear(2000, ring(ringC)), wear(2500, line([8, 26], [10, 25])), wear(2500, line([6, 26], [5, 29]))];
// 6. a village lane with houses on both sides (the east island, north)
const villageLane = [wear(3000, line([35, 12], [39, 12])), wear(2000, line([39, 12], [40, 15]))];
const villageHouses = [[36, 11], [38, 11], [36, 13], [38, 13]];
// 7. a switchback: a road that turns back on itself twice (the north-east island)
const switchback = [wear(2500, path([30, 3], [34, 3], [34, 5], [30, 5], [30, 7], [36, 7]))];
const roads = [...cross, ...hub, ...blob, ...ladder, ...rings, ...villageLane, ...switchback];
module.exports = {
  ...base,
  villages: [{ at: [18, 21], farms: 1 }], // one small village far from the cases, so the page has a state
  tiles: {}, roads, houses: villageHouses, greens: [], fields: [], meadows: [], ground: [], cobbles: [], streets: [], gardens: [],
  quays: [], bridges: [], stoneWalls: [], fences: [], palisade: [], things: [], crosses: [], people: [], cows: [], smoke: [],
  quarters: null, straight: null, label: null,
  shots: [
    { name: '1-crossing', at: [7, 6], zoom: 1.8, zoomPhone: 1.1 },
    { name: '2-hub', at: [27, 19], zoom: 1.8, zoomPhone: 1.1 },
    { name: '3-blob', at: [39, 18], zoom: 1.8, zoomPhone: 1.1 },
    { name: '4-ladder', at: [26, 25], dx: 20, zoom: 1.8, zoomPhone: 1.0 },
    { name: '5-ring', at: [7, 26], zoom: 2.2, zoomPhone: 1.4 },
    { name: '6-village', at: [37, 12], zoom: 2.2, zoomPhone: 1.4 },
    { name: '7-switchback', at: [33, 5], zoom: 1.8, zoomPhone: 1.1 },
  ],

};
