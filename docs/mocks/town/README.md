# Mock: a town on the map (27 November 2026)

A throwaway mock, not game code: a town placed by hand on a real generated island (seed 11, 48 by 34 tiles), at the mouth of the
river on the north shore, drawn in the farm art's manner (`src/page/farmart.js`) with its own brushes. Asked for by Kim
("mock a town in the game by mocking graphics and hand placing buildings, farms, etc.").

    node docs/mocks/town/town.js            # the shots in img/, desk and phone (about a minute)
    node docs/mocks/town/town.js --labels   # the island with each land tile's col,row, to place things by hand

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
| `img/phone-*.jpg` | the same on a phone |
