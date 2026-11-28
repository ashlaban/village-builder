# Mock: two ways to draw roads (27 November 2026)

A throwaway mock, not game code, for the thread "Redesign road layout for hex maps". The simulation is untouched: roads are still the
lanes it wears (`w.worn` 3). Only the drawing changes: `roads.js` takes the place of `draw/paths`' own trail curves (`hook.js` swaps
`segments` and `thin` in the built page).

- **A, a derived network**: lane tiles traced into strokes that run on through a junction by their straightest pair; each stroke
  straightened (Douglas-Peucker on the tile centres, 0.42 R) and rounded (Chaikin); a stroke ending at a junction meets the through
  stroke as a T, anywhere in the hex; a house gets a short gate lane.
- **B, hex pieces**: each road hex drawn from a fixed set of pieces by the sides its road leaves through, at most three per hex (Kim);
  a third way meets the through piece as a T.

Both draw from one graph: the strongest links first (a maximum spanning tree), loops of fewer than 12 tiles left out.

    node docs/mocks/roads/village.js                                              # the countryside: img/village-{now,A,B}-village.jpg
    node docs/mocks/town/town.js --plan docs/mocks/town/plan-roads.js --out docs/mocks/roads/img [--roads A|B]   # the town

The town (`plan-roads.js`) is v4's quarters with its streets laid as lanes in the period's pattern: a main street along the shore, a
back street, two cross streets, lanes to the shore, roads out. The countryside is seed 3, ten farms on 60 by 42 tiles, after 3 years.
