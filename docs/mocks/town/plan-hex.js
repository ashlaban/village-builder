// The town again, each hex a quarter (Kim, 27 November: "houses belong to a hex, similar to a farm but maybe a quarter"): a hex holds
// a group of buildings round its own trodden yard, as a farm's hex holds its cottage, barn and storehouse; streets run along the edges
// between quarters; the market is one hex, the church and its yard two. No palisade (there is no violence in the game): the town ends
// where its yard hexes end, with a ring of kitchen-garden hexes on the landward side, the town's fenced fields beyond, and a toll bar
// where the road comes in. About 60 dwellings, some 350 people. Points are [col, row, dx, dy] as in plan.js.
const base = require('./plan.js');
const H = [
  { roof: 'turf' },
  { roof: 'shingle', shop: true },
  { roof: 'turf', loft: true },
  { roof: 'turf', shop: true },
  { roof: 'shingle' },
  { roof: 'turf', loft: true, shop: true },
];
const house = (c, r, dx, dy, k, extra = {}) => ({ k: 'house', at: [c, r, dx, dy], v: k % 3, o: { ...H[k % H.length], ...extra }, sc: 1.2 });
const rich = (k) => ({ wall: k % 2 ? 'daub' : 'brick', roof: 'tile', loft: true });
// A quarter of plots: five town houses round a yard, three behind and two before, a well curb and a woodpile, as a farm's hex holds
// its buildings; `r1` makes one of them half-timber or brick.
const plots = (c, r, s, r1 = -1) => [
  house(c, r, -15, -3, s, s === r1 ? rich(s) : {}),
  house(c, r, 0, -5, s + 1),
  house(c, r, 15, -3, s + 2, s + 2 === r1 ? rich(s + 2) : {}),
  house(c, r, -8, 18, s + 3, s + 3 === r1 ? rich(s + 3) : {}),
  house(c, r, 9, 18, s + 4),
  { k: 'art', name: 'curb', at: [c, r, 1, 6], sc: 0.8 },
  { k: 'art', name: 'wood', v: 2, at: [c, r, 20, 10], sc: 0.8 },
];
const merchants = (c, r, s) => [
  { k: 'merchant', at: [c, r, -9, 2], v: s, sc: 1.1 },
  { k: 'merchant', at: [c, r, 9, 2], v: s + 1, sc: 1.1 },
  house(c, r, -9, 20, s + 2, rich(s + 1)),
  { k: 'barrels', at: [c, r, 9, 16], v: 5 },
  { k: 'sacks', at: [c, r, 17, 22] },
];
const fishers = (c, r, s) => [
  { k: 'sjobod', at: [c, r, -12, -10], v: s, sc: 1.1 },
  { k: 'sjobod', at: [c, r, 10, -12], v: s + 1, sc: 1.1 },
  { k: 'rack', at: [c, r, -2, 6] },
  house(c, r, -10, 20, s),
  house(c, r, 10, 20, s + 4),
];
const crafts = (c, r) => [
  { k: 'smithy', at: [c, r, -4, 0], sc: 1.1 },
  { k: 'kiln', at: [c, r, 15, 12], v: 0 },
  { k: 'kiln', at: [c, r, -16, 14], v: 1 },
  house(c, r, 2, 20, 0),
];

const QUARTERS = [
  { at: [22, 12], kind: 'market' },
  { at: [23, 12], kind: 'church', group: 'church' },
  { at: [24, 12], kind: 'church', group: 'church' },
  { at: [21, 11], kind: 'merchants' },
  { at: [22, 11], kind: 'merchants' },
  { at: [23, 11], kind: 'plots' },
  { at: [24, 11], kind: 'fishers' },
  { at: [25, 11], kind: 'fishers' },
  { at: [21, 12], kind: 'plots' },
  { at: [25, 12], kind: 'plots' },
  { at: [26, 12], kind: 'crafts' },
  { at: [21, 13], kind: 'plots' },
  { at: [22, 13], kind: 'plots' },
  { at: [23, 13], kind: 'plots' },
  { at: [24, 13], kind: 'plots' },
  { at: [25, 13], kind: 'plots' },
  { at: [22, 10], kind: 'point' },
];
let seed = 0;
const things = [];
for (const q of QUARTERS) {
  const [c, r] = q.at;
  seed += 2;
  if (q.kind === 'plots') things.push(...plots(c, r, seed % 6, seed % 3 === 0 ? (seed % 6) + 2 : -1));
  if (q.kind === 'merchants') things.push(...merchants(c, r, seed % 2));
  if (q.kind === 'fishers') things.push(...fishers(c, r, seed % 3));
  if (q.kind === 'crafts') things.push(...crafts(c, r));
}
things.push(
  // the market: booths round the cross, the town hall (rådstuga) of brick at its back, the well sweep
  ...[
    [-12, 2],
    [12, 2],
    [-8, 18],
    [10, 18],
  ].map(([x, y], k) => ({ k: 'booth', at: [22, 12, x, y], v: k })),
  { k: 'merchant', at: [22, 12, 0, -6], v: 1, sc: 1.05 },
  { k: 'art', name: 'sweep', at: [22, 12, 18, -6], sc: 0.75, ay: 0.95 },
  // the church across its two hexes, the priest's house and the tithe barn
  { k: 'church', at: [23, 12, 22, 12], sc: 1.15 },
  house(24, 12, 16, -4, 2, { loft: true, roof: 'shingle' }),
  { k: 'art', name: 'lada', at: [24, 12, 12, 22], sc: 0.9 },
  // the point: the sea mark, and a quay below it
  { k: 'bak', at: [22, 10, -4, 6] },
  // the harbour
  { k: 'cog', at: [22, 11, 30, -46], ay: 0.86, sc: 1.1 },
  { k: 'boat', at: [23, 11, 26, -44], v: 1 },
  { k: 'boat', at: [21, 11, -14, -40], v: 3, flip: true },
  { k: 'boat', at: [21, 12, -42, -4], v: 1, flip: true },
  { k: 'boat', at: [25, 11, 20, -24], v: 0 },
  { k: 'boat', at: [25, 11, 30, -10], v: 2 },
  // across the river, the tanner and his vats; outside, the mills
  { k: 'vats', at: [20, 14, -4, 6] },
  house(20, 14, -10, -6, 0),
  { k: 'art', name: 'lada', at: [20, 14, 12, -4], sc: 0.8 },
  { k: 'watermill', at: [22, 15, -4, 4] },
  { k: 'postmill', at: [20, 15, 0, 6], sc: 1.1 },
  // the toll bar where the road from the south comes in
  { k: 'toll', at: [23, 14, -4, -14] },
);
const people = [
  [22, 12, -4, 8], [6, 10], [-2, 24], [14, 10], [-18, 12], [2, 26], [20, 14], [-14, 22],
].map((p, k) => (p.length === 4 ? p : [22, 12, ...p])).map((at, k) => ({ at, seed: k + 1 }));
people.push(
  ...[
    [22, 11, 16, -30], [22, 11, 28, -31], [23, 11, 0, -30], [21, 11, 10, -32], [23, 12, -24, -14], [21, 12, -24, 2],
    [24, 11, 0, 12], [25, 12, -24, -4], [22, 13, -24, 0], [23, 14, -4, -8],
  ].map((at, k) => ({ at, seed: k + 40 })),
);

module.exports = {
  ...base,
  tiles: {
    town: [...QUARTERS.map((q) => q.at), [20, 14], [26, 13]],
    outside: [[22, 14], [23, 14], [24, 14], [25, 14], [20, 15], [22, 16], [21, 16]],
  },
  roads: [
    [[23, 14], [24, 15], [25, 15], [26, 15], [27, 15]],
    [[20, 14], [19, 14], [18, 14], [17, 15]],
  ],
  quarters: { hexes: [...QUARTERS, { at: [20, 14], yard: 0.6 }].map((q) => ({ at: q.at, group: q.group })), street: 7 },
  fields: [
    { at: [24, 14], look: 'ripe', rot: -0.2 },
    { at: [25, 14], look: 'stubble', rot: 0.5 },
  ],
  meadows: base.meadows,
  ground: [],
  cobbles: [{ at: [22, 12, 0, 10], rx: 18, ry: 12 }],
  streets: [
    { pts: [[23, 13, 0, 28], [23, 14, -4, -6], [23, 14, 0, 0]], w: 7 }, // the road in from the south, past the toll
    { pts: [[21, 13, -24, 14], [21, 13, -30, 18]], w: 6 }, // to the bridge
    { pts: [[20, 14, 14, -16], [20, 14, 0, 0]], w: 6 },
  ],
  // the kitchen-garden hexes on the landward side (kålgårdar): the town's soft edge
  gardens: [
    ...[[22, 14]].flatMap(([c, r], j) =>
      [
        [-20, -14], [-6, -14], [8, -14], [-20, -3], [-6, -3], [8, -3], [-14, 8], [0, 8],
      ].map(([x, y], k) => ({ at: [c, r, x, y], w: 12, h: 8, seed: 10 * j + k + 1 })),
    ),
  ],
  bridges: [{ a: [21, 13, -30, 18], b: [20, 14, 14, -16], w: 7 }],
  stoneWalls: [[[23, 12, -8, -14], [24, 12, 26, -14], [24, 12, 26, 26], [23, 12, -8, 26]]],
  quays: [
    { a: [22, 11, -6, -36], b: [23, 11, 10, -31] },
    { a: [22, 11, 22, -31], b: [22, 11, 27, -56] },
    { a: [21, 12, -36, -12], b: [21, 12, -31, 14] },
  ],
  fences: [
    [[23, 14, 24, -14], [24, 14, 0, 28], [25, 14, 24, 14], [25, 14, 24, -14], [25, 14, 0, -28], [24, 14, -24, -14], [23, 14, 24, -14]],
  ],
  palisade: [],
  things,
  crosses: [[22, 12, 0, 12]],
  people,
  cows: base.cows,
  smoke: [[26, 12, 6, -18], [26, 12, 16, 2], [26, 12, -16, 4]],
  label: { at: [22, 10, 0, -30], text: 'Strömsund' },
  shots: [
    { name: 'hex-town', at: [23, 12], dx: 0, dy: -4, zoom: 2.6, zoomPhone: 1.4 },
    { name: 'hex-surroundings', at: [22, 13], dx: 0, dy: 20, zoom: 1.2, zoomPhone: 0.9 },
  ],
};
