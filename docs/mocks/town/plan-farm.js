// The town a third time (Kim, 27 November: "make the town a bit larger and use the same building planning and road connection logic for
// the quarters as for the farms"). Each quarter is planned as a farmstead is: its hex is a house tile (w.dev 3), its buildings stand in
// the farm's yard slots (YARD of page/settlement: byre, barn, second barn, storehouse, cottage, woodpile, well, stack) on the farm's
// trodden yard, and its way is the farm's: draw/paths runs one way from the most worn lane beside it to its door, never through it. The
// lanes run on the hexes between quarters, centre to centre, as in the countryside; the market is an open place the lanes cross, as a
// village green. 16 quarters, the church's two hexes and the market: about 64 dwellings, some 350 to 400 people.
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
// The farm's yard slots, world units from the middle of the house tile (page/settlement YARD).
const YARD = { byre: [-10, -3], lada: [6, -1], barn: [19, -6], harbre: [14, 7], stuga: [-4, 14], wood: [10, 15], stack: [-14.5, 10.5], curb: [1, 19] };
const at = (c, r, slot, d = [0, 0]) => [c, r, YARD[slot][0] + d[0], YARD[slot][1] + d[1]];
const house = (c, r, slot, k, extra = {}, sc = 1.05) => ({ k: 'house', at: at(c, r, slot), v: k % 3, o: { ...HS[k % HS.length], ...extra }, sc });
// The quarters' kinds, each the farm's plan with town buildings in its slots.
const KIND = {
  // five households: the cottage's slot and the four outbuildings' slots hold a town house each; the stack's slot a kitchen garden
  plots: (c, r, s) => [
    house(c, r, 'barn', s + 2),
    house(c, r, 'byre', s, s % 4 === 0 ? rich(s) : {}),
    house(c, r, 'lada', s + 1),
    house(c, r, 'harbre', s + 3, {}, 1),
    house(c, r, 'stuga', s + 4, s % 4 === 2 ? rich(s + 1) : {}),
    { k: 'art', name: 'curb', at: at(c, r, 'curb', [6, 0]), sc: 0.8 },
  ],
  merchants: (c, r, s) => [
    { k: 'merchant', at: at(c, r, 'byre'), v: s, sc: 1 },
    { k: 'merchant', at: at(c, r, 'lada', [2, 0]), v: s + 1, sc: 1 },
    house(c, r, 'stuga', s + 2, rich(s + 1)),
    { k: 'barrels', at: at(c, r, 'harbre', [2, 2]), v: 5 },
    { k: 'sacks', at: at(c, r, 'wood', [4, 2]) },
  ],
  fishers: (c, r, s) => [
    { k: 'sjobod', at: at(c, r, 'byre', [-2, -2]), v: s, sc: 1 },
    { k: 'sjobod', at: at(c, r, 'lada', [4, -2]), v: s + 1, sc: 1 },
    { k: 'rack', at: at(c, r, 'harbre') },
    house(c, r, 'stuga', s),
    { k: 'boat', at: at(c, r, 'stack', [-2, 0]), v: 0, sc: 0.9 },
  ],
  crafts: (c, r) => [
    { k: 'smithy', at: at(c, r, 'byre', [2, 0]), sc: 1 },
    { k: 'kiln', at: at(c, r, 'harbre'), v: 0 },
    { k: 'kiln', at: at(c, r, 'barn', [-2, 2]), v: 1 },
    house(c, r, 'stuga', 0),
    { k: 'barrels', at: at(c, r, 'wood'), v: 3 },
  ],
  tanner: (c, r) => [
    house(c, r, 'stuga', 0),
    { k: 'art', name: 'lada', at: at(c, r, 'lada'), sc: 0.9 },
    { k: 'vats', at: at(c, r, 'harbre', [-2, 2]) },
    { k: 'art', name: 'harbre', at: at(c, r, 'byre'), sc: 1, ay: 0.95 },
  ],
};
const QUARTERS = [
  [20, 11, 'fishers'],
  [21, 11, 'merchants'],
  [23, 11, 'merchants'],
  [24, 11, 'plots'],
  [25, 11, 'fishers'],
  [26, 12, 'crafts'],
  [21, 13, 'plots'],
  [23, 13, 'plots'],
  [22, 14, 'plots'],
  [24, 14, 'plots'],
  [25, 14, 'plots'],
  [26, 14, 'plots'],
  [27, 14, 'plots'],
  [28, 14, 'plots'],
  [23, 15, 'plots'],
  [20, 14, 'tanner'],
];
const CHURCH = [
  [24, 13],
  [25, 13],
];
const things = [];
QUARTERS.forEach(([c, r, kind], k) => things.push(...KIND[kind](c, r, (k * 5) % 6)));
// the stack's slot of each plots quarter: its kitchen gardens
const gardens = QUARTERS.filter((q) => q[2] === 'plots').map(([c, r], k) => ({ at: at(c, r, 'stack', [-6, -4]), w: 11, h: 7, seed: k + 1 }));
things.push(
  // the market: booths round the cross, the town hall (rådstuga) of brick at its back, the well sweep
  ...[
    [-14, -2],
    [12, -4],
    [-12, 14],
    [14, 12],
  ].map(([x, y], k) => ({ k: 'booth', at: [22, 12, x, y], v: k })),
  { k: 'merchant', at: [22, 12, 0, -10], v: 1, sc: 1 },
  { k: 'art', name: 'sweep', at: [22, 12, 4, 22], sc: 0.7, ay: 0.95 },
  // the church across its two hexes, the priest's house and the tithe barn
  { k: 'church', at: [24, 13, 24, 8], sc: 1.15 },
  house(25, 13, 'harbre', 2, { loft: true, roof: 'shingle' }),
  { k: 'art', name: 'lada', at: [25, 13, 4, 22], sc: 0.85 },
  // the point and its sea mark; the harbour
  { k: 'bak', at: [22, 10, -4, 6] },
  { k: 'cog', at: [22, 11, 30, -46], ay: 0.86, sc: 1.1 },
  { k: 'boat', at: [23, 11, 26, -44], v: 1 },
  { k: 'boat', at: [21, 11, -14, -40], v: 3, flip: true },
  { k: 'boat', at: [21, 12, -42, -4], v: 1, flip: true },
  { k: 'boat', at: [25, 11, 20, -24], v: 0 },
  { k: 'boat', at: [26, 13, 4, 0], v: 2 },
  { k: 'boat', at: [26, 13, 14, 12], v: 0 },
  { k: 'rack', at: [26, 13, -8, 14] },
  // the mills and the toll bar on the road out
  { k: 'watermill', at: [22, 15, -4, 4] },
  { k: 'postmill', at: [20, 15, 0, 6], sc: 1.1 },
  { k: 'toll', at: [24, 15, 6, 2] },
);
const people = [
  [22, 12, -4, 4], [22, 12, 6, 8], [22, 12, -2, 16], [22, 12, 14, 2], [22, 12, -18, 6], [22, 12, 2, -2], [22, 12, 18, 18], [22, 12, -6, 22],
  [22, 11, 16, -30], [22, 11, 28, -31], [23, 11, 0, -30], [21, 11, 10, -32], [23, 12, 0, 4], [24, 12, -6, -2], [21, 12, 4, 2],
  [22, 13, 0, 0], [25, 12, 2, 6], [23, 14, 0, 4], [24, 15, 0, 0],
].map((a, k) => ({ at: a, seed: k + 1 }));
const STREETS = [
  [21, 12],
  [23, 12],
  [24, 12],
  [25, 12],
  [22, 11],
  [22, 13],
  [23, 14],
  [19, 14],
];

module.exports = {
  ...base,
  tiles: {
    town: [...QUARTERS.map((q) => [q[0], q[1]]), ...CHURCH, ...STREETS, [22, 12], [22, 10], [26, 13]],
    outside: [[24, 16], [25, 16], [26, 16], [20, 15], [22, 16], [21, 16], [24, 15]],
  },
  houses: [...QUARTERS.map((q) => [q[0], q[1]]), ...CHURCH],
  greens: [[22, 12]],
  // the lanes, with a count of crossings that ranks them (draw/paths keeps each tile to its two most worn neighbours)
  roads: [
    [[22, 11, 50], [23, 12, 60], [24, 12, 60], [25, 12, 50], [21, 12, 50], [22, 13, 60], [23, 14, 60]],
    [[24, 15, 50], [25, 15, 40], [26, 15, 40], [27, 15, 40]],
    [[19, 14, 30], [18, 14], [17, 15]],
  ],
  quarters: { hexes: [...QUARTERS.map((q) => ({ at: [q[0], q[1]] })), ...CHURCH.map((at) => ({ at, group: 'church' }))], edges: false },
  fields: [
    { at: [24, 16], look: 'ripe', rot: -0.2 },
    { at: [25, 16], look: 'stubble', rot: 0.5 },
    { at: [26, 16], look: 'ripe', rot: 0.1 },
  ],
  fences: [
    [[24, 16, -24, -14], [24, 16, -24, 14], [24, 16, 0, 28], [25, 16, 0, 28], [26, 16, 0, 28], [26, 16, 24, 14], [26, 16, 24, -14], [26, 16, 0, -28], [25, 16, 0, -28], [24, 16, 0, -28], [24, 16, -24, -14]],
  ],
  meadows: base.meadows,
  ground: [],
  cobbles: [{ at: [22, 12, 0, 4], rx: 16, ry: 11 }],
  streets: [],
  gardens,
  bridges: [{ a: [21, 13, -20, 10], b: [20, 14, 16, -10], w: 7 }],
  stoneWalls: [[[24, 13, -16, -16], [25, 13, 20, -16], [25, 13, 20, 24], [24, 13, -16, 24]]],
  quays: [
    { a: [22, 11, -6, -36], b: [23, 11, 10, -31] },
    { a: [22, 11, 22, -31], b: [22, 11, 27, -56] },
    { a: [21, 12, -36, -12], b: [21, 12, -31, 14] },
  ],
  palisade: [],
  things,
  crosses: [[22, 12, 2, 6]],
  people,
  cows: base.cows,
  smoke: [[26, 12, -6, -20], [26, 12, 14, 0], [26, 12, 18, -10]],
  label: { at: [22, 10, 0, -30], text: 'Strömsund' },
  shots: [
    { name: 'farm-town', at: [24, 12], dx: -10, dy: 10, zoom: 2.6, zoomPhone: 1.3 },
    { name: 'farm-surroundings', at: [23, 13], dx: 0, dy: 20, zoom: 1.2, zoomPhone: 0.9 },
  ],
};
