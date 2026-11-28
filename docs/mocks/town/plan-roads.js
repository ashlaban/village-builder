// The town for the road mock (thread "Redesign road layout for hex maps", 27 November 2026): v4's quarters (plan-straight.js) with
// the streets laid as the game's lanes (w.worn 3), so that one road system draws the town and the countryside alike, through quarters
// with houses. The layout is the Nordic one of the period (Sigtuna, Stockholm's old town): a main street along the shore (row 12),
// a back street behind it (row 14), two cross streets between them, short lanes from the main street down to the shore, and the roads
// out to the two villages, the fields and the bridge. No spur per quarter: its houses stand along the road that passes it.
//   node docs/mocks/town/town.js --plan docs/mocks/town/plan-roads.js              # drawn as the game draws lanes today
//   node docs/mocks/town/town.js --plan docs/mocks/town/plan-roads.js --roads A    # A: a derived network
//   node docs/mocks/town/town.js --plan docs/mocks/town/plan-roads.js --roads B    # B: hex pieces, at most three ways a hex
const v4 = require('./plan-straight.js');
const run = (wear, tiles) => tiles.map(([c, r]) => [c, r, wear]);
const roads = [
  run(4000, [[21, 12], [22, 12], [23, 12], [24, 12], [25, 12], [26, 12]]), // the main street, along the shore, through the market
  run(3000, [[22, 14], [23, 14], [24, 14], [25, 14], [26, 14], [27, 14], [28, 14]]), // the back street
  run(2000, [[22, 12], [22, 13], [22, 14]]), // the cross street from the market
  run(2000, [[26, 12], [26, 13], [26, 14]]), // the east cross street
  run(1200, [[22, 12], [22, 11]]), // to the quay
  run(1000, [[23, 12], [23, 11]]), // lanes down to the shore
  run(1000, [[25, 12], [25, 11]]),
  run(2500, [[22, 14], [21, 14], [20, 14], [19, 14], [18, 14], [17, 15]]), // west over the bridge to the village
  run(2000, [[24, 14], [24, 15], [24, 16]]), // south to the fields and the toll bar
  run(2500, [[28, 14], [28, 15]]), // east to the village
];
const quarters = v4.straight.quarters;
module.exports = {
  ...v4,
  tiles: { town: v4.tiles.town, outside: [...v4.tiles.outside, [21, 14], [19, 14], [18, 14], [17, 15], [24, 15]] },
  roads,
  straight: { fromRoads: true, quarters },
  bridges: [{ a: [21, 14, -22, 0], b: [21, 14, 22, 0], w: 9 }],
  shots: [
    { name: 'roads-town', at: [24, 13], dx: -10, dy: -6, zoom: 2.6, zoomPhone: 1.3 },
    { name: 'roads-surroundings', at: [23, 13], dx: 0, dy: 20, zoom: 1.2, zoomPhone: 0.9 },
  ],
};
