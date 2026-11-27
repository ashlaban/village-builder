// The town a fourth time (Kim, 27 November: "adapt the first idea to the last idea and make sure that the town's straight line roads
// coincide with the straight lines of hexes and allow roads to pass through hexes with town houses"). The first mock's streets lined
// with houses, on the last mock's quarters: each street is a straight run of hexes along a row or a diagonal, drawn straight through
// their middles; every hex it crosses is a quarter whose houses line it on both sides; a quarter off the streets gets one straight way
// to its neighbour, as a farm's door. The houses are placed by a rule (art.js tmStraight), not by hand: on a grid of feet in the hex,
// clear of the ways, nearest a way first. Points are [col, row, dx, dy] as in plan.js.
const base = require('./plan.js');
const HS = [
  { roof: 'turf' },
  { roof: 'shingle', shop: true },
  { roof: 'turf', loft: true },
  { roof: 'turf', shop: true },
  { roof: 'shingle' },
  { roof: 'turf', loft: true, shop: true },
];
const rich = (k) => ({ wall: k % 2 ? 'daub' : 'brick', roof: 'tile', loft: true });
const house = (k, extra = {}) => ({ k: 'house', v: k % 3, o: { ...HS[k % HS.length], ...extra }, sc: 1.05 });
// What a quarter of each kind holds, in the order its places are filled (nearest the street first).
const ITEMS = {
  plots: (s, n) => Array.from({ length: n }, (_, k) => house(s + k, (s + k) % 7 === 3 ? rich(s + k) : {})),
  merchants: (s, n) => [{ k: 'merchant', v: s, sc: 1 }, { k: 'merchant', v: s + 1, sc: 1 }, house(s, rich(s)), { k: 'barrels', v: 5 }].slice(0, n),
  fishers: (s, n) => [{ k: 'sjobod', v: s, sc: 1 }, house(s), { k: 'sjobod', v: s + 1, sc: 1 }, { k: 'rack' }].slice(0, n),
  crafts: (s, n) => [{ k: 'smithy', sc: 1 }, { k: 'kiln', v: 0 }, house(s), { k: 'kiln', v: 1 }].slice(0, n),
  tanner: (s, n) => [house(s), { k: 'vats' }, { k: 'art', name: 'lada', sc: 0.85 }].slice(0, n),
};
// The streets, straight runs of hexes: the main street along row 12 through the market; the back street along row 14; the diagonal
// from the market south-east to the fields; the diagonal south-west over the river by the bridge; the short way north to the quay.
const streets = [
  { tiles: [[21, 12], [22, 12], [23, 12], [24, 12], [25, 12], [26, 12]], open0: true, w: 9 },
  { tiles: [[22, 14], [23, 14], [24, 14], [25, 14], [26, 14], [27, 14], [28, 14]], open0: true, w: 8 },
  { tiles: [[22, 12], [22, 13], [23, 14], [23, 15], [24, 16]], w: 8 },
  { tiles: [[22, 12], [21, 13], [21, 14], [20, 15], [20, 16]], w: 8 },
  { tiles: [[22, 12], [22, 11]], open1: true, w: 8 },
  { tiles: [[20, 15], [19, 15], [18, 15], [17, 15]], w: 7 },
];
// The quarters: [col, row, kind, count]. Off-street quarters name the neighbour their way runs to.
const Q = [
  [20, 11, 'fishers', 3, [21, 12]],
  [21, 11, 'merchants', 4, [22, 12]],
  [22, 11, 'merchants', 4],
  [23, 11, 'plots', 4, [23, 12]],
  [24, 11, 'plots', 4, [24, 12]],
  [25, 11, 'fishers', 4, [25, 12]],
  [21, 12, 'plots', 5],
  [23, 12, 'plots', 4],
  [24, 12, 'plots', 4],
  [25, 12, 'plots', 4],
  [26, 12, 'crafts', 4],
  [21, 13, 'plots', 4],
  [22, 13, 'plots', 4],
  [23, 13, 'plots', 4, [22, 13]],
  [22, 14, 'plots', 4],
  [23, 14, 'plots', 4],
  [24, 14, 'plots', 4],
  [25, 14, 'plots', 4],
  [26, 14, 'plots', 4],
  [27, 14, 'plots', 4],
  [23, 15, 'plots', 4],
  [20, 14, 'tanner', 3, [20, 15]],
  [26, 13, 'fishers', 2, [26, 14]],
];
const quarters = Q.map(([c, r, kind, n], k) => ({ at: [c, r], n, items: ITEMS[kind]((k * 5) % 6, n) }));
const spurs = Q.filter((q) => q[4]).map((q) => ({ from: [q[0], q[1]], to: q[4] }));
const CHURCH = [
  [24, 13],
  [25, 13],
];
const things = [
  // the market: booths round the cross, the town hall (rådstuga) at its back, the well sweep
  ...[
    [-15, -8],
    [14, -8],
    [-13, 22],
    [14, 22],
  ].map(([x, y], k) => ({ k: 'booth', at: [22, 12, x, y], v: k })),
  { k: 'art', name: 'sweep', at: [22, 12, -2, 26], sc: 0.6, ay: 0.95 },
  // the church across its two hexes, between the two streets, and the tithe barn
  { k: 'church', at: [24, 13, 24, 8], sc: 1.15 },
  { k: 'art', name: 'lada', at: [25, 13, 8, 12], sc: 0.75 },
  // the point and its sea mark; the harbour
  { k: 'bak', at: [22, 10, -4, 6] },
  { k: 'cog', at: [23, 10, -10, 4], ay: 0.86, sc: 1.1 },
  { k: 'boat', at: [23, 11, 26, -44], v: 1 },
  { k: 'boat', at: [21, 11, -14, -40], v: 3, flip: true },
  { k: 'boat', at: [21, 12, -42, -4], v: 1, flip: true },
  { k: 'boat', at: [25, 11, 20, -24], v: 0 },
  // the mills, the toll bar on the road in from the south-east
  { k: 'watermill', at: [22, 15, -4, 4] },
  { k: 'postmill', at: [20, 16, 14, 8], sc: 1.1 },
  { k: 'toll', at: [24, 16, 12, -2] },
];
const people = [
  [22, 12, -4, 4], [22, 12, 6, 10], [22, 12, -2, 16], [22, 12, 12, 2], [22, 12, -16, 8], [22, 12, 4, -4], [22, 12, 16, 16],
  [22, 11, 4, -30], [22, 11, 14, -32], [23, 12, 0, 1], [25, 12, -6, 0], [21, 12, 4, 1], [22, 13, 2, 0], [24, 14, 0, 1], [23, 15, 0, 0],
].map((a, k) => ({ at: a, seed: k + 1 }));

module.exports = {
  ...base,
  tiles: {
    town: [...Q.map((q) => [q[0], q[1]]), ...CHURCH, [22, 12], [22, 10], [28, 14]],
    outside: [[24, 16], [20, 15], [20, 16], [19, 15], [18, 15], [25, 16], [26, 16], [22, 16], [21, 16]],
  },
  houses: [...CHURCH],
  greens: [],
  roads: [],
  quarters: { hexes: [...Q.map((q) => ({ at: [q[0], q[1]] })), ...CHURCH.map((at) => ({ at, group: 'church' })), { at: [22, 12] }], edges: false },
  straight: { streets, spurs, quarters },
  fields: [
    { at: [25, 16], look: 'ripe', rot: -0.2 },
    { at: [26, 16], look: 'stubble', rot: 0.5 },
  ],
  fences: [[[25, 16, -24, -14], [25, 16, -24, 14], [25, 16, 0, 28], [26, 16, 0, 28], [26, 16, 24, 14], [26, 16, 24, -14], [26, 16, 0, -28], [25, 16, 0, -28], [25, 16, -24, -14]]],
  meadows: base.meadows,
  ground: [],
  cobbles: [{ at: [22, 12, 0, 6], rx: 17, ry: 12 }],
  streets: [],
  gardens: [],
  bridges: [{ a: [21, 14, 14, -14], b: [21, 14, -14, 14], w: 9 }],
  stoneWalls: [[[24, 13, -16, -12], [25, 13, 20, -12], [25, 13, 20, 16], [24, 13, -16, 16]]],
  quays: [
    { a: [22, 11, -14, -34], b: [23, 11, 6, -29] },
    { a: [21, 12, -36, -12], b: [21, 12, -31, 14] },
  ],
  palisade: [],
  things,
  crosses: [[22, 12, 0, 8]],
  people,
  cows: base.cows,
  smoke: [],
  label: { at: [22, 10, 0, -30], text: 'Strömsund' },
  shots: [
    { name: 'straight-town', at: [24, 13], dx: -10, dy: -6, zoom: 2.6, zoomPhone: 1.3 },
    { name: 'straight-surroundings', at: [23, 13], dx: 0, dy: 20, zoom: 1.2, zoomPhone: 0.9 },
  ],
};
