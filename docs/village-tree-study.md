# Demand-grown village shortest-path trees

14 November 2026. VB-443, following the [segment-sharing experiment](path-segment-sharing-study.md).

## Result

The prototype shares real search work, but should **stay out of production** in this form. One shortest-path tree per village
reduces the work of individual A* queries; nearby cost changes discard enough trees that building them consumes most or all of
the savings. The Map-based implementation and additional heuristic lookups also cost more time than the work they avoid.
No game parameter, speed, traffic preference or production route representation was changed by the experiment.

A separate prerequisite fix, VB-444, adds missing cost-change notifications when land becomes a field or meadow. That fix
does affect the production route cache: journeys can discover the newly cheaper ground at the next daily refresh.

## Implementation

[`tools/village-tree-probe.js`](../tools/village-tree-probe.js) instruments live native `route` misses and pawn `tread` events.
[`tools/lib/village-trees.js`](../tools/lib/village-trees.js) implements the alternative searches. Neither is in the game manifest
or saved state. Each experiment returns the native route to the simulation, so every alternative sees the same activity and
terrain changes. This is an active shadow comparison: alternative searches actually run and their work is counted.

Each village has at most one tree, rooted at its green/centre. A resumable Dijkstra search stores settled preference distances,
physical times and parent pointers, plus its unexpanded frontier. Houses cannot be transit vertices. Equal preference distances
prefer shorter physical walking time, as the native router does.

Two growth policies run beside a common geometric-heuristic A* control:

- **Demand:** grow toward both journey endpoints, or the open neighbours of a closed house endpoint, before an uncached query.
- **Exit:** grow only when a pawn actually enters an undeveloped tile next to developed land. These observed boundary tiles are
  the exit nodes; they include all used openings, without imposing a road graph or selecting chokepoints by hand. A query cannot
  train this tree from its own answer. An exit may resume growth over several visits.

Default limits are 64 newly settled vertices per growth request and 2,048 discovered records per village. A vertex always finishes
all six relaxations before pausing; this can exceed the record limit by at most six. A second trial uses 8/256. Metadata includes
the frontier and a bounded set of settled vertices and their neighbours. The research cost memo is shared by a model's tree and
query solver; the control has the same memoization. It is bounded by the world's tiles and edges, and is not proposed as a new
production cache.

One root tree does **not** give shortest paths between arbitrary branches. The prototype therefore uses it in two exact ways:

1. A root journey, or an ancestor-to-descendant journey within the settled tree, can take a certified tree subpath without A*.
   Closed endpoints check every legal neighbouring entrance. A path over the physical budget cannot use this shortcut.
2. Other journeys use the tree as a landmark to strengthen A*'s lower bound. They retain every legal off-road edge and can cross
   between branches directly. They are never forced through the village centre.

For a partially grown tree, let `r` be the lowest remaining frontier distance. Its potential is
`p(v) = min(distance(root,v), r)`: settled vertices have known distances, and every other vertex gets `r`. This clipped distance
is 1-Lipschitz on the traversable graph. Thus `abs(p(v) - p(goal))` is a valid lower bound even outside the explored area. We take
the maximum of this and the existing geometric bound. The physical-time tie-break retains its own geometric lower bound.

A closed house cannot serve as a transit landmark: different journeys may use different doors. Its heuristic takes the minimum
over all open neighbours of `last edge cost + landmark bound to that neighbour`. This avoids an overestimate from assigning the
house one root distance. Tiny tests also check partial-potential consistency over every open edge.

Cost changes invalidate incident memoized edges. A tree is discarded only if the changed tile is settled or neighbours a settled
tile, including previously blocked neighbours. Changes beyond that boundary cannot change a settled root distance: reaching
them first requires crossing the remaining frontier. Future expansions read fresh costs. Opening a blocked tile, closing a
doorway, and both cost increases and decreases are tested. The prototype scans the small village-tree pool on notification;
a production version would need to measure a tile-to-tree reverse index as well as its maintenance cost.

## Measurements

Populous, 48 game days per run, including cold tree construction and live notifications. The older save starts after five full
years on Small seed 7, and finishes with 389 people. Large seed 7 finishes with 809 people in 24 villages. Simulation base:
merged PR #132 (`0423f61`) plus VB-444's development notifications. A later bridge-construction change on main is outside these
recorded runs; its existing `costChanged` notifications use the same invalidation interface.

All runs compare **every actual journey-cache miss**, including subsequent repeat misses after invalidation. They do not include
the separate village-hours/reach searches, nor generation's path wear-in. Existing journey-cache hits still skip these searches.

| World, seed | Misses checked | Control settled | Demand A* | Demand tree build | Demand total | Exit total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Tiny, 7 | 7,435 | 183,751 | 143,655 | 31,936 | 175,591 | 180,589 |
| Tiny, 42 | 5,667 | 123,864 | 91,528 | 32,257 | 123,785 | 127,248 |
| Small, 7 | 14,889 | 315,059 | 245,703 | 91,732 | 337,435 | 326,619 |
| Small, 42 | 18,036 | 519,259 | 399,172 | 104,451 | 503,623 | 503,908 |
| Small after 5 years, 7 | 10,798 | 309,045 | 236,344 | 77,674 | 314,018 | 307,226 |
| Large, 7 | 40,639 | 882,147 | 712,710 | 305,559 | 1,018,269 | 948,228 |

The demand model settles 19–26% fewer query vertices. Including construction, the result ranges from 4.4% fewer vertices to
15.4% more. Its tree certificates skip A* on 11.8–14.7% of misses. These are genuine search savings, unlike the earlier redundant
segment edges, but they do not pay for themselves reliably.

Large demand trees were invalidated 1,272 times in 48 days across the pool. Pool high-water marks were 8,122 records, 1,656
frontier entries and 8,951 touched-tile memberships; these are separate maxima, not a byte estimate or a per-village count.
Map entries, objects and heap capacity add real overhead. The exit model peaked at 4,966 records. See raw data for all counts,
edge relaxations and per-model cost-memo sizes.

Single-run instrumented routing time, including model dispatch, growth and invalidation, was about 1.4–2.0 times the control
for these default trials. Exit timing also includes every tread-hook check, even those that find no exit. These are diagnostic
ratios between implementations with the same query engine and cost memo; they are **not** production speedup/slowdown estimates.
Runs were concurrent, GC/JIT varied, and the native router uses different allocation patterns. No absolute timing win is claimed.

The 8-expansion/256-record trial on Tiny reduced total settled vertices by 5.1% / 0.6% (seeds 7 / 42) with demand growth, but
still took longer than the control. Exit growth saved 3.1% on seed 7 and added 2.1% on seed 42. Simply lowering the limits did
not solve the reuse problem.

No checked trial changed optimal preference cost, physical time, reachability, or even route geometry. Equal-cost geometry is
not guaranteed in general when tree parents replace the native straightness tie-break. This is an exact objective accelerator,
not permission to change that visual convention in production without validation.

Reproduce:

```sh
node tests/village-trees.js
node tools/village-tree-probe.js --map tiny --seeds 7,42 --days 48
node tools/village-tree-probe.js --map small --seeds 7,42 --days 48
node tools/village-tree-probe.js --map large --seeds 7 --days 48
node tools/village-tree-probe.js --map tiny --seeds 7,42 --days 48 --grow 8 --cap 256
node tools/sim.js --scenario populous --map small --seed 7 --years 5 --save /tmp/village-tree-small-y5.gz
node tools/village-tree-probe.js --load /tmp/village-tree-small-y5.gz --days 48
```

Raw results: [`docs/bench/village-trees.json`](bench/village-trees.json). The late save itself remains a local artifact.

## Next implementation candidate

Measure **incremental repair**, rather than rebuilding a whole village tree whenever one of its used paths changes stage.
Decreases must propagate into nodes whose parent edge did not change; increases may detach a branch and require finding an
alternative from the frontier. A reverse edge/child index and a bounded inconsistency queue are necessary parts of that cost.
The partial-tree potential must stay valid during repair; dirty labels cannot simply continue to guide exact A*.

The next trial should compare repair work plus query work with these recorded controls, cap per-step repair latency, and retain
native routing while a tree is uncertified. Only after an elapsed-time win should it replace the production cache-miss search.
One centre-rooted tree still supplies a weak bound across neighbouring branches; additional exit landmarks would need a
separate bounded-memory trial. More trees alone are not an established improvement.

Algorithmic background: Dijkstra (1959) for the resumable tree; Goldberg and Harrelson, *Computing the Shortest Path: A* Search
Meets Graph Theory* (2005) for landmark lower bounds; Koenig, Likhachev and Furcy, *Lifelong Planning A** (2004) for incremental
repair. The clipped partial-tree potential and closed-endpoint handling above are specific to this prototype.
