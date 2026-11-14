# Sharing path segments: measured exploration

14 November 2026. Production baseline: merged PR #132, commit `0423f61c038f9549bee26df27821a2ad4e840e38`.

## Recommendation

Keep the current short routes as flat arrays. Do not replace the route cache with junction-to-junction segment handles: the measured routes are too short, and that representation increases storage. Adding exact segment shortcut edges while retaining every grid edge also does not materially reduce the nodes an exact A* must settle with its existing heuristic.

For a genuine reduction in pathfinding work, the next candidate is a small, demand-driven cache of resumable shortest-path trees rooted at busy destinations or household origins. These share search results and path suffixes, rather than only sharing geometry. Benchmark their construction, eviction and invalidation before production use. A regional hierarchy remains a later alternative, subject to VB-097's profiling trigger.

## What was measured

The local research prototype observed production route calls during two years of the populous scenario, Tiny and Small maps, seeds 7 and 42. It wrapped calls for observation without replacing the simulation's route selection. It recorded actual cache-miss OD pairs and cost-change tiles.

On the final frozen world it:

1. Extracted traversable cached paths and counted shared undirected edges.
2. Compressed their union into maximal degree-two chains. Junctions and closed tiles such as houses remain endpoints, so a segment cannot pass through a building.
3. Compared numeric payload estimates for flat routes, segment handles, prefix/suffix tries, and selectively interned eight-tile subpaths.
4. Replayed 100 historical cache-miss OD pairs absent from the final cache, per world. Both search variants retained every legal off-road grid edge. One added valid cached-segment shortcut edges with their actual summed time and preference costs.
5. Checked both variants against the native route chooser's minimum preference cost.

These are frozen-world experiments, not a deployed routing optimization. Historical miss pairs replayed later are not a prediction of future live requests.

## Completed results

| World | Population | Route calls / misses | Cached routes | Median route tiles | Stored edge traversals per distinct edge | Median segment steps |
|---|---:|---:|---:|---:|---:|---:|
| Tiny, seed 7 | 138 | 56,971 / 12,701 | 1,744 | 4 | 9.86 | 1 |
| Tiny, seed 42 | 146 | 57,925 / 9,743 | 1,453 | 3 | 5.82 | 1 |
| Small, seed 7 | 365 | 147,963 / 25,854 | 4,176 | 3 | 8.06 | 1 |
| Small, seed 42 | 358 | 152,083 / 31,845 | 4,920 | 4 | 8.75 | 1 |

The existing complete-route cache already avoids a new search on roughly 78–83% of route calls. Edge overlap is real, but most local route fragments are very short. On Tiny, 97–98% of stored edge traversals use an edge appearing in more than one cached path.

### Geometry-sharing storage

Payload estimates below count compact numeric arrays, not actual JavaScript heap usage. Flat routes use one Uint32 tile ID each. Junction segments include their tile pool, three-word span handles and a 32-byte segment header holding endpoints, range and two aggregate costs. Trie estimates include tile/parent nodes and one route-leaf reference. Shared maps and reverse indexes would add further overhead.

| World | Flat tile IDs, bytes | Junction segments + spans, bytes | Prefix trie, bytes | Suffix trie, bytes | Selective eight-tile chunks, bytes |
|---|---:|---:|---:|---:|---:|
| Tiny 7 | 28,704 | 84,668 | 33,368 | 31,648 | 28,300 |
| Tiny 42 | 19,572 | 61,032 | 26,628 | 25,876 | 19,552 |
| Small 7 | 63,476 | 190,072 | 78,312 | 75,520 | 63,128 |
| Small 42 | 83,052 | 242,920 | 104,080 | 99,496 | 80,640 |

Junction segments increase this payload about threefold. Selective repeated eight-tile chunks save only about 0.1–2.9%, before lookup/index overhead. That is insufficient evidence to justify their complexity here.

The chunk experiment considers a whole eight-tile sequence and its reverse the same chunk. Short paths remain literal tile IDs. A one-word tagged reference replaces each selected occurrence; a chunk must retain at least three non-overlapping uses to amortize its tile pool and header. This is more economical than giving every tiny route fragment a three-word span handle.

Reverse-direction duplicates are also common: 566, 540, 1,378 and 1,636 cached reverse pairs respectively. Canonical whole-route storage is worth a separate memory benchmark, but it does not save new searches: reverse lookup already reuses routes. Returning array views or changing movement iteration would need explicit API and save-format work; JavaScript proxies are not recommended.

### Exact shortcut search

| World | Queries checked | Settled grid nodes, control | Settled nodes with shortcuts | Edge relaxations, control / shortcuts | Physical-time tie differences |
|---|---:|---:|---:|---:|---:|
| Tiny 7 | 100 | 2,040 | 2,040 | 6,150 / 6,184 | 0 |
| Tiny 42 | 100 | 1,509 | 1,509 | 4,709 / 4,740 | 0 |
| Small 7 | 100 | 1,558 | 1,558 | 4,703 / 4,748 | 0 |
| Small 42 | 100 | 1,934 | 1,934 | 5,969 / 6,033 | 0 |

All 400 queries retained the native minimum preference cost. Shortcuts removed no settled nodes and added edge checks. These settled-node counts exclude stale heap entries, whereas the production `routeExpand` counter includes heap removals with duplicates.

Timing repetitions alternated control and experimental order after an initial warmup. Results varied substantially with allocation, JIT and GC; no timing improvement is claimed. Cost compilation and analysis were measured separately and excluded from query timing. Precompiling the whole grid is a research convenience, not a proposal for a daily world-wide pass.

This result has an algorithmic explanation. An exact shortcut equal to an existing grid path does not change the shortest distance from the source to any grid vertex. With the same consistent lower-bound heuristic and all grid vertices retained, A* must still settle vertices whose optimal `g + h` is strictly below the goal cost. Shortcuts can affect ties, queue operations and arithmetic, but do not automatically eliminate that search region.

Skipping those vertices requires additional information: an already valid optimal search tree, a stronger admissible heuristic, or an abstraction/contraction that removes interior states while representing their possible exits. Restricting travel to the road graph alone would change the answer and suppress valid off-road shortcuts.

### Update costs and demand concentration

Projecting each day's changed tiles onto the final segment graph touches a median 6, 6, 16 and 24 segments per day, with maxima 41, 52, 93 and 115. This is a projection onto a frozen final graph, not a measurement of an implemented incremental updater.

The four most frequent destination tiles account for 11.3%, 6.4%, 3.7% and 5.7% of valid recorded cache misses. That cautions against eagerly building full-world trees for a handful of goals. It does not measure the coverage obtainable by choosing either endpoint as the root, or by selecting household roots; those need their own trace experiment.

## An implementable sequence

### 1. Measure live misses before adding another cache

Continue recording misses separately from complete-route cache hits. Measure request length, destination/origin reuse within the same cost epoch, cache-refresh time and recurrence after invalidation. The relevant opportunity is the remaining 17–22% of route calls, not every pawn movement.

VB-236 already tracks cache-refresh and LRU costs. Segment sharing should be compared with simplifying those operations; historical measurements in that task are not a current benchmark.

### 2. Prototype bounded resumable goal trees

Use a key such as:

```ts
{ rootTile, direction, movementMode, objective, policyRevision, costEpoch }
```

A reverse Dijkstra tree grows from a busy destination only when requested. It stores best preference cost, actual walking cost, and a next-tile pointer. A later source already settled in that tree can follow the shared suffix immediately; otherwise resume the frontier until that source settles. Every branch then shares its downstream path and completed search work.

Root selection should use repeated cache misses within an unchanged-cost window. Start with a very small measured cap, such as four or eight roots, a global node/frontier memory budget, and ordinary A* fallback when a query would exceed it. Those are cache engineering parameters, not gameplay preferences.

The current physical-budget rule remains: compute the preferred path; if it exceeds the walking budget, use the fastest feasible path. Preference and fastest-time trees therefore need distinct objective keys. Store both cost figures. If slopes or modes become directional, forward and reverse trees are separate contexts.

Initially reset trees on a cost epoch change, at the existing stage-update cadence. A cost decrease on an unused edge may make an entirely different route preferable: invalidating only the previously followed suffix is insufficient. Regional dependency tracking should follow only if full resets prove too expensive.

This cache's return path must preserve deterministic preference/time tie rules. It must never infer connectivity from the renderer's thinned path drawing. Actual traversability, crossings and eventual rights remain movement rules.

### 3. Share long geometry only when it pays

If later traffic creates long repeated corridors, intern immutable, frequently reused subpaths through junctions. Do not split every route at every adjacent worn tile. Keep short paths flat and require an estimated positive byte saving before admitting a shared chunk.

A compact full-chunk reference can encode segment ID and direction in one word. Keep partial prefixes/suffixes literal until spans are sufficiently long to repay their metadata. Segment records hold the actual tile sequence, preference and walking totals, validity context and geometry/cost versions.

An increase or closure requires affected segment recosting/removal. A decrease can create a better unused alternative; dependent-route invalidation alone is not an optimality proof. A traversable but suboptimal cached path can supply an upper bound, never an admissible lower-bound heuristic.

Movement must still visit the underlying tiles to count wear and place pawns. Sharing a route does not remove its physical travel or its wear events.

### 4. Keep derived IDs out of saved authoritative state

A transient segment pool can rebuild deterministically from saved flat paths. Do not save route/agent references to ephemeral segment IDs unless the pool and its schema are saved too. A first implementation can flatten route views at the save boundary and leave existing in-progress agent paths unchanged, with a route-policy migration if the cache representation changes.

### 5. Consider a regional hierarchy only when measured

VB-097 calls for profiling populous Large seed 7 over two years and stopping if route search is below 5% of simulation time. That trigger has not been established by this study.

An exact region graph must retain every relevant border exit, including off-road ones, and store preference-optimal paths with physical times as well as fastest-time fallback paths. Grouping exits can be cheaper but introduces approximation; validate both preference stretch and physical duration, missed reachability, build/update work, memory, and household outcomes.

## Experiment status and limitations

The workspace recovered, including the finished Large seed-7 two-year result. The maintained prototype is now
[`tools/segment-sharing-probe.js`](../tools/segment-sharing-probe.js), with all five runs in
[`docs/bench/path-segment-sharing.json`](bench/path-segment-sharing.json).

Large finished with 850 people and 13,168 cached routes. Of 361,578 calls, 69,837 required searches. Median route length was
four tiles; median segment length was one step. Numeric payloads were 215,288 bytes for flat paths, 631,628 for junction
segments, and 212,644 for selective eight-tile chunks. All 100 replay queries again had identical settled-node counts:
1,216 before and after shortcuts. Relaxations rose from 3,745 to 3,776. No physical-time tie changed.

The instrumented native journey API took 3,213 ms of a 31,293 ms simulation (10.3%); this includes cache-hit work, so it does not
establish the uncached-search-only share required by VB-097. Including refresh and village-hours APIs gave 18.1%. Single-run
times remain diagnostic, with allocation, instrumentation and JIT effects. No speed improvement is claimed.

The next requested experiment, [demand-grown village trees](village-tree-study.md), shares search work rather than geometry.
Its live comparison includes invalidation and rebuilding, unlike this study's frozen replay. The segment experiment itself
changes no production routing.

PR #132 was merged before the outage, after both GitHub required checks and all 106 local verification checks passed. No further production merge is part of this exploration.
