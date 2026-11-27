// The town, placed by hand on one generated island (see town.js): seed 11, 48 by 34 tiles, at the mouth of the river on the north
// shore of the largest island. Points are [col, row, dx, dy]: dx, dy world units from that tile's middle (a hex is 48.5 wide, rows 42
// apart). Z(dx, dy) measures from the middle of tile 22,12, the market.
//
// After the research docs ("Medieval towns and crafts, 900-1500" and "Medieval buildings in Sweden and Europe, 900-1500"), the Nordic
// pattern: one long street along the shore (Strandgatan) with narrow plots, houses gable to the street and alleys down to the water; a
// second street behind it (Köpmangatan); a market square with booths and a cross; a stone parish church; a quay of timber cribs with a
// cog at it; a stone tower on the point watching the harbour; fishermen's sheds and racks on the beach at the east end; the fire crafts
// (smith, kilns) at the edge; the tanner across the river below the town; gardens (no palisade: Kim, 27 Nov); the
// town's fields and its common grazing outside; a water mill on the river and a post mill on the rise; lanes to two villages.
const Z = (dx, dy) => [22, 12, dx, dy];
const row = (x0, x1, y, step, f) => {
  const out = [];
  for (let x = x0, k = 0; x <= x1; x += step, k++) out.push(f(x, k));
  return out;
};
// Town houses along a street: their kinds cycle (log under turf or shingles, a shop, a loft house; half-timber and brick for the richer).
const HOUSES = [
  { roof: 'turf' },
  { roof: 'shingle', shop: true },
  { roof: 'turf', loft: true },
  { roof: 'turf', shop: true },
  { roof: 'shingle' },
  { roof: 'turf', loft: true, shop: true },
];
const houseRow = (x0, x1, y, seed, skip = [], rich = []) =>
  row(x0, x1, y, 16, (x, k) => ({ k: 'house', at: Z(x, y), v: (k + seed) % 3, o: HOUSES[(k + seed) % HOUSES.length], sc: 1.2 })).filter(
    (_, k) => !skip.includes(k),
  ).map((t, k) => (rich.includes(k) ? { ...t, o: { ...t.o, wall: k % 2 ? 'daub' : 'brick', roof: 'tile', loft: true } } : t));

module.exports = {
  seed: 11,
  cols: 48,
  rows: 34,
  villages: [
    { at: [28, 15], farms: 5 },
    { at: [16, 15], farms: 4 },
  ],
  // the ground the town stands on: no trees or stones are painted there
  tiles: {
    town: [[21, 11], [22, 11], [23, 11], [24, 11], [25, 11], [22, 10], [21, 12], [22, 12], [23, 12], [24, 12], [25, 12], [26, 12],
      [21, 13], [22, 13], [23, 13], [24, 13], [25, 13], [26, 13], [20, 14], [19, 14]],
    outside: [[22, 14], [23, 14], [24, 14], [25, 14], [20, 15], [22, 16], [21, 16]],
  },
  // lanes (w.worn 3, drawn by draw/paths) from the gates to the villages
  roads: [
    [[23, 14], [24, 15], [25, 15], [26, 15], [27, 15]],
    [[20, 14], [19, 14], [18, 14], [17, 15]],
  ],
  fields: [
    { at: [22, 14], look: 'ripe', rot: 0.3 },
    { at: [24, 14], look: 'ripe', rot: -0.2 },
    { at: [25, 14], look: 'stubble', rot: 0.5 },
  ],
  meadows: [{ at: [22, 16] }, { at: [21, 16], look: 'mown' }],
  ground: [
    // the town's trodden ground, and the market square
    { pts: [Z(-70, -30), Z(-30, -50), Z(60, -58), Z(160, -46), Z(206, -6), Z(196, 46), Z(170, 64), Z(-50, 64), Z(-70, 30)], a: 0.3 },
    [Z(-26, -20), Z(28, -24), Z(34, 22), Z(-22, 24)],
  ],
  cobbles: [{ at: Z(3, 0), rx: 24, ry: 18 }],
  streets: [
    { pts: [Z(-70, -18), Z(-40, -26), Z(0, -28), Z(50, -32), Z(100, -32), Z(140, -26)], w: 9 }, // Strandgatan
    { pts: [Z(-62, 36), Z(-20, 34), Z(40, 36), Z(100, 36), Z(170, 32), Z(196, 16)], w: 8 }, // Köpmangatan
    { pts: [Z(-24, 24), Z(-24, 36)], w: 7 },
    { pts: [Z(36, 22), Z(40, 36)], w: 7 },
    { pts: [Z(44, 36), Z(48, 72), Z(48, 90)], w: 8 }, // to the south gate
    { pts: [Z(-62, 36), Z(-90, 50), Z(-118, 78)], w: 7 }, // over the bridge to the west
    // alleys (gränder) down to the water
    { pts: [Z(-16, -28), Z(-12, -56)], w: 5 },
    { pts: [Z(66, -32), Z(66, -58)], w: 5 },
    { pts: [Z(128, -28), Z(140, -12), Z(150, 32)], w: 5 },
    { pts: [Z(-62, 36), Z(-66, -20)], w: 6 },
  ],
  gardens: [
    ...row(-52, 120, 50, 18, (x, k) => ({ at: Z(x, 52), w: 13, h: 9, seed: k + 1 })),
    { at: Z(140, 0), w: 12, h: 10, seed: 30 },
    { at: Z(-50, 4), w: 12, h: 8, seed: 31 },
  ],
  bridges: [{ a: Z(-66, 40), b: Z(-92, 52), w: 7 }],
  stoneWalls: [[Z(64, -14), Z(132, -16), Z(136, 24), Z(62, 26)]],
  quays: [
    { a: Z(18, -78), b: Z(112, -72) },
    { a: Z(-82, -14), b: Z(-77, 22) },
    { a: Z(84, -72), b: Z(90, -100) },
    { a: Z(30, -72), b: Z(36, -94) },
  ],
  fences: [
    [Z(-28, 66), Z(-20, 108), Z(28, 108), Z(30, 70)],
    [Z(70, 70), Z(72, 108), Z(170, 108), Z(176, 66)],
  ],
  palisade: [], // none: there is no violence in the game (Kim, 27 November)
  things: [
    // the stone tower on the point
    { k: 'kastal', at: Z(0, -72), sc: 1.1 },
    // the church in its yard
    { k: 'church', at: Z(98, 18), sc: 1.2 },
    // the town hall and weigh house on the market's east side, brick, as the richer towns built them
    { k: 'merchant', at: Z(36, -8), v: 1, sc: 1.15 },
    // the market
    ...[
      [-14, -6],
      [0, -10],
      [14, -8],
      [-10, 12],
      [18, 10],
    ].map(([x, y], k) => ({ k: 'booth', at: Z(x, y), v: k })),
    { k: 'barrels', at: Z(28, 18), v: 4 },
    { k: 'sacks', at: Z(-20, 18) },
    // Strandgatan's north side, backs to the water
    ...houseRow(-58, -26, -38, 0),
    ...houseRow(-4, 48, -42, 2, [], []),
    { k: 'merchant', at: Z(76, -40), v: 0, sc: 1.1 },
    { k: 'merchant', at: Z(92, -40), v: 1, sc: 1.1 },
    ...houseRow(108, 108, -38, 4),
    // Strandgatan's south side
    ...houseRow(-56, -40, -12, 3),
    { k: 'house', at: Z(-30, -12), v: 1, o: { wall: 'daub', roof: 'tile', loft: true, shop: true }, sc: 1.2 },
    { k: 'house', at: Z(54, -10), v: 2, o: { wall: 'brick', roof: 'tile', loft: true }, sc: 1.2 },
    ...houseRow(130, 162, -12, 1),
    // Köpmangatan's south side
    ...houseRow(-52, 120, 46, 1, [], [2, 5]),
    // its north side, east of the church
    ...houseRow(148, 164, 26, 5),
    // the crafts: the smith and the kilns at the east edge, the cooper by the quay, the tanner across the river
    { k: 'smithy', at: Z(186, 6), sc: 1.1 },
    { k: 'kiln', at: Z(194, 40), v: 0 },
    { k: 'kiln', at: Z(176, 50), v: 1 },
    { k: 'barrels', at: Z(58, -50), v: 5 },
    { k: 'barrels', at: Z(44, -74), v: 3 },
    { k: 'sacks', at: Z(76, -74) },
    { k: 'vats', at: Z(-104, 50) },
    { k: 'house', at: Z(-124, 46), v: 0, o: { roof: 'turf' }, sc: 1.2 },
    // fishermen's sheds, racks and boats on the beach
    { k: 'sjobod', at: Z(128, -56), v: 0, sc: 1.1 },
    { k: 'sjobod', at: Z(148, -54), v: 1, sc: 1.1 },
    { k: 'sjobod', at: Z(172, -52), v: 2, sc: 1.1 },
    { k: 'rack', at: Z(160, -30) },
    { k: 'rack', at: Z(186, -22) },
    { k: 'boat', at: Z(194, -46), v: 0 },
    { k: 'boat', at: Z(210, -34), v: 2 },
    // the harbour
    { k: 'cog', at: Z(60, -84), ay: 0.86, sc: 1.1 },
    { k: 'boat', at: Z(100, -86), v: 1 },
    { k: 'boat', at: Z(20, -90), v: 3, flip: true },
    { k: 'boat', at: Z(-90, -6), v: 1, flip: true },
    { k: 'boat', at: Z(-92, 14), v: 0 },
    // the gate, the mills
    { k: 'watermill', at: [22, 15, -4, 4] },
    { k: 'postmill', at: [20, 15, 0, 6], sc: 1.1 },
  ],
  crosses: [Z(4, 4)],
  people: [
    ...[
      [-6, -2], [8, 2], [-2, 8], [12, -2], [20, 4], [-16, 4], [6, 14], [-4, -14], [22, -12], [26, 6], [0, 20], [-22, -6], [16, 18],
    ].map(([x, y], k) => ({ at: Z(x, y), seed: k + 1 })),
    ...[
      [30, -74], [54, -74], [70, -75], [100, -74], [88, -84], [34, -86], [-80, 0], [-79, 12],
    ].map(([x, y], k) => ({ at: Z(x, y), seed: k + 40 })),
    ...[
      [-40, -26], [24, -30], [110, -30], [60, 36], [-10, 34], [48, 60], [150, -34], [176, -40],
    ].map(([x, y], k) => ({ at: Z(x, y), seed: k + 60 })),
  ],
  cows: [{ at: [21, 16, 0, 0], n: 5, seed: 3 }, { at: [22, 16, 0, 0], n: 3, seed: 5 }],
  smoke: [Z(193, -12), Z(194, 30), Z(176, 40)],
  label: { at: Z(-20, -128), text: 'Strömsund' },
  shots: [
    { name: 'island', whole: true },
    { name: 'town', at: [22, 12], dx: 50, dy: 0, zoom: 2.6, zoomPhone: 1.4 },
    { name: 'market', at: [22, 12], dx: 10, dy: 0, zoom: 2.6, zoomPhone: 2.6 },
    { name: 'surroundings', at: [22, 13], dx: 0, dy: 20, zoom: 1.2, zoomPhone: 0.9 },
  ],
};
