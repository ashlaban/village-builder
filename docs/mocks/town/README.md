# Mock: a town on the map (27 November 2026)

A throwaway mock, not game code: a town placed by hand on a real generated island (seed 11, 48 by 34 tiles), at the mouth of the
river on the north shore, drawn in the farm art's manner (`src/page/farmart.js`) with its own brushes. Asked for by Kim
("mock a town in the game by mocking graphics and hand placing buildings, farms, etc.").

    node docs/mocks/town/town.js            # the shots in img/, desk and phone (about a minute)
    node docs/mocks/town/town.js --labels   # the island with each land tile's col,row, to place things by hand
    node docs/mocks/town/town.js --plan docs/mocks/town/plan-farm.js  # v3: quarters planned and connected as farms
    node docs/mocks/town/town.js --plan docs/mocks/town/plan-hex.js   # v2: each hex a quarter, streets on hex edges, no palisade

- `town.js` builds the page, seeds two villages, marks the town's tiles as built on (no trees) and its roads as lanes, and splices
  `art.js` into the page's closure.
- `art.js`: the new art (town houses gable to the street in log, half-timber and brick; brick merchant houses with stepped gables;
  the stone church; booths; a cog and boats; net sheds; smithy, kilns, barrels, sacks, tan vats, fish racks; the stone tower; post
  mill and water mill; gate) and the drawing of streets, the square, quays, bridge, palisade, gardens, churchyard wall and people.
- `plan.js`: where everything stands, with the reasons from the two research docs ("Medieval towns and crafts, 900-1500",
  "Medieval buildings in Sweden and Europe, 900-1500").

| Shot | |
| --- | --- |
| `img/desk-town.jpg` | the whole town at the closest zoom |
| `img/desk-surroundings.jpg` | the town with its fields, mills, commons and the two villages it serves |
| `img/island.jpg` | the island |
| `img/desk-hex-town.jpg`, `img/desk-hex-surroundings.jpg` | v2 (`plan-hex.js`, Kim 27 Nov): a quarter of houses per hex like a farm, roads through the hexes as the game's lanes run (Kim 27 Nov), no palisade; garden hex, fields and a toll bar mark the edge |
| `img/phone-*.jpg` | the same on a phone |
| `img/desk-farm-town.jpg`, `img/desk-farm-surroundings.jpg` | v3 (`plan-farm.js`, Kim 27 Nov): larger (16 quarters, ~64 dwellings); each quarter a house tile planned in the farm's yard slots, its way run to its door by draw/paths, lanes on the hexes between |
