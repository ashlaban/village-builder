# Incremental repair of village shortest-path trees

VB-445, 14 November 2026. Extends the [village-tree prototype](village-tree-study.md) on commit `917eb88`, including current
bridge construction and field/meadow development notifications. No production routing, gameplay parameters or saved state change.

## Result

Incremental repair works: it keeps unaffected distances, repairs changed branches, and eliminates full-tree resets in all
recorded live runs. Default demand-growth trials process **60–79% fewer tree nodes** than rebuilding. Total query-plus-tree
work falls **18–27% against rebuilding**, and **16–23% against the common plain-A* control**.

Observed routing time improves against rebuilding, but **the shared-tree prototype is still slower than plain A***. Keep it
outside the production manifest. Repair removes a major maintenance cost; it does not establish a production speed win.

## How changes propagate

[`tools/lib/village-trees.js`](../tools/lib/village-trees.js) adds `RepairTree`, a sparse version of Lifelong Planning A* with
zero heuristic. Its ordered distance is `(preference cost, physical time)`, matching the two route objectives. Each node stores
its current distance `g`, one-edge lookahead `rhs`, and current/lookahead parent pointers. A node is inconsistent when its
distance and lookahead disagree.

A changed tile affects its incident edges. The tree recomputes that tile's best incoming edge and offers the changed edge to
each known neighbour. A cheaper edge can improve a node even when that edge was not its parent. A worsening edge requires
checking all six incoming alternatives only when it supplied that node's chosen lookahead. The hex neighbour array already
indexes incoming and outgoing dependencies; no full-tree scan or separate child-set allocation is needed.

Inconsistencies propagate in distance order. A decrease installs the better distance and offers it to neighbours. An increase
withdraws the obsolete distance, re-evaluates alternatives and propagates the loss through the affected branch. An equal-cost,
equal-time alternative must still replace its parent pointer when the old doorway closes. Dedicated tests cover this case and
changes to the physical tie-break that leave preference costs entirely unchanged.

Each village has one indexed heap containing **at most one entry per discovered node**. Repeated changes replace queue entries
instead of accumulating stale records. Normal growth and repair share the existing per-request budget: at most 64 queue
entries by default, or 8 in the smaller trial. There is no eager whole-tree repair in a cost-change notification.

The record cap remains 2,048 plus at most six adjacency records per village. An expansion that cannot relax all outgoing edges
within that cap pauses before changing its label. If a new opening cannot be represented at a completely full cap, the tree
is discarded safely; closing the root is the other explicit reset exception. Tests force these cases. Neither occurred in the
live runs, including the 256-record trials. Their cap stops are reported rather than hidden.

## Exact queries during incomplete repair

Old labels are not automatically safe just because their node is locally consistent. Let `r` be the smallest preference key
remaining in the inconsistency queue. Distances strictly below `r` are certified. All other vertices use the clipped potential
`min(g(v), r)`, with unknown vertices also taking `r`. Once the queue is empty, the explored component is complete; the existing
finite clipping rule handles disconnected components.

This is the true root-distance field clipped at the boundary of certified knowledge. Its difference between two vertices is
an admissible, consistent landmark bound. Thus a query can use the valid inner portion while outer branches are still being
repaired. Direct tree-path certificates require certified endpoints; closed houses additionally require every legal entrance
to be certified. Other queries use exact A* with all off-road edges, retaining the existing physical-budget fallback.

This avoids both stale guidance and a repair spike before every query. A capped or heavily damaged tree can supply a weak or
zero bound, in which case the query approaches the control search while repair stays bounded.

## Live comparison

[`tools/village-tree-probe.js`](../tools/village-tree-probe.js) runs five models on the same native journey-cache misses and
cost notifications: control A*, rebuilt demand/exit trees, and incrementally repaired demand/exit trees. Exit growth still
comes from actual pawn treads at developed-land boundaries. The native router drives the simulation, so all models see the
same traffic. Model order rotates between queries.

Each duration includes query dispatch/search, tree construction/growth/repair, cost notifications, and (for exit policies)
boundary checks and growth hooks. Common boundary-detection time is charged to each exit model; growth is not counted twice.
Zero-work visits no longer scan the village pool just to collect telemetry, for either repair policy. Control cost-memo
invalidation is timed too. `treeSettled` includes every repair queue pop, including withdrawals and reinstallation; the
`repairProcessed` field is the subset below a previously certified frontier, not an additional quantity to add to it.

All runs cover 48 days of Populous. The mature save starts after five Small seed-7 years. Small, Large, mature, repeated Small,
and smaller-cap trials ran sequentially without concurrent test suites. These remain instrumented single-run prototype times;
they are useful comparisons within this engine, not measurements of production frame rate.

| World, seed | Misses | Rebuilt tree work | Repaired tree work | Rebuilt total work | Repaired total work | Control work |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Tiny, 7 | 7,443 | 32,479 | 6,947 | 177,168 | 145,324 | 184,831 |
| Tiny, 42 | 5,667 | 32,257 | 7,449 | 123,785 | 95,192 | 123,864 |
| Small, 7 | 14,884 | 91,274 | 36,978 | 338,072 | 265,022 | 316,191 |
| Small, 42 | 18,036 | 104,451 | 34,272 | 503,623 | 401,662 | 519,259 |
| Large, 7 | 40,759 | 303,347 | 82,000 | 1,010,271 | 739,347 | 877,476 |
| Small after 5 years, 7 | 10,798 | 77,674 | 24,981 | 314,018 | 246,542 | 309,045 |

Work is expanded query nodes plus processed tree nodes. Edge offers, incoming-edge scans and queue updates are separately
recorded because their costs differ. All numbers in this table are for demand growth.

| World, seed | Rebuilt demand ms | Repaired demand ms | Rebuilt exit ms | Repaired exit ms | Control ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| Tiny, 7 | 368 | 337 | 409 | 361 | 252 |
| Tiny, 42 | 239 | 236 | 273 | 246 | 159 |
| Small, 7 | 760 | 712 | 740 | 636 | 417 |
| Small, 42 | 921 | 802 | 947 | 889 | 612 |
| Large, 7 | 2,489 | 2,139 | 2,367 | 1,972 | 1,433 |
| Small after 5 years, 7 | 613 | 534 | 596 | 534 | 368 |

Large demand trees previously reset 1,264 times; repaired trees reset zero times. Query work also falls (706,924 → 657,347)
because the useful explored region survives changes. Exit tree work falls from 171,423 to 25,308, with zero resets instead
of 1,161. In this run, measured time improves 14% for demand growth and 17% for exit growth against rebuilding.

Demand repair still takes 1.31–1.71 times control time across the default runs. Fewer expanded nodes alone therefore remains
insufficient grounds for deployment. The extra landmark lookups, indexed-queue and metadata work are included in these times.
The 1% Tiny seed-42 timing difference is too small to interpret strongly. Repeating Small seed 42 produced identical work and
objectives; demand times were 973 → 860 ms (12% improvement), compared with 921 → 802 ms (13%) in the first run.

Retaining exploration also costs memory. On Large, observed demand records rose from 8,122 with rebuilding to 17,414 with
repair across the village pool. Per-node lookahead fields and the heap-position map are additional overhead. These are counts,
not heap-byte estimates; each village and its queue remain capped. In the 8-step/256-record Tiny trials, demand repair work
totals were 156,649 / 96,598 at seeds 7 / 42 versus 175,995 / 123,070 for rebuilding. Cap stops weakened the heuristic but
introduced no incorrect route or unbounded queue.

Including the repeated and smaller-cap trials, **128,733 live misses** matched native reachability, preference cost and walking
time (128,724 found routes and nine no-route cases). No route geometry changed in these samples; equal-cost geometry is not
guaranteed by tree certificates in general. No household outcome can differ between these shadow models because only native
routes enter the simulation.

## Validation and reproduction

`tests/village-tree-repair.js` compares 453 intermediate/changed states with an independent scan-based Dijkstra solver:
every open tile's clipped potential, every certified distance/time and parent, and heuristic consistency over every open edge.
It checks 2,718 route queries plus physical tie-break and equal-parent replacement regressions. Cases include decreases on
non-parent edges, closures and openings, disconnected land, an isolated leaf requiring at most three updates, 300 changes while
paused, exhausted record caps, explicit safe resets and physical-budget fallback before/after repair. Existing house tests also
continue to pass.

```sh
node tests/village-tree-repair.js
node tools/village-tree-probe.js --map tiny --seeds 7,42 --days 48
node tools/village-tree-probe.js --map small --seeds 7,42 --days 48
node tools/village-tree-probe.js --map large --seeds 7 --days 48
node tools/village-tree-probe.js --map tiny --seeds 7,42 --days 48 --grow 8 --cap 256
node tools/village-tree-probe.js --load /tmp/village-tree-small-y5.gz --days 48
```

The mature save is generated by the command in the preceding study. `--repair incremental` or `--repair rebuild` selects
only those variants beside the control; the default `both` compares all four. Full raw results, counters and phase timings:
[`docs/bench/village-tree-repair.json`](bench/village-tree-repair.json).

Algorithm reference: Koenig, Likhachev and Furcy, *Lifelong Planning A\** (2004),
[doi:10.1016/j.artint.2003.12.001](https://doi.org/10.1016/j.artint.2003.12.001). The clipped partial-tree use, lexicographic
physical-time objective, closed endpoint handling and capacity fallback are specific to this prototype.

Final repository validation: **109/109** fast/integration checks passed; 17 existing advisory targets remain out.
Source formatting and rebuild completed. Production src/ and index.html are unchanged from this task's starting commit.
