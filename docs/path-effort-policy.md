# Active path effort policy (VB-441, 14 November 2026)

This PR preserves main's newer physical terrain costs, `PATHS.clear`, stage speeds [1, 1.03, 1.1, 1.15], and slope grade 2 (VB-439). The route chooser now trades walking time against effort. VB-440 only separated the quantities; it deliberately kept them equal.
This policy activates the requested behaviour. No screenshots were used to validate it.

## Evidence and limits

At a fixed speed, uneven footing can cost more energy: Voloshina et al. measured a 28% increase in net metabolic expenditure on a
controlled surface with up to 2.5 cm height variation, at 1 m/s. That supports a preference beyond elapsed time, not a universal
28% penalty for all medieval land. [Original experiment](https://pubmed.ncbi.nlm.nih.gov/23913951/).

De Gruchy, Caswell and Edwards distinguish energy coefficients from travel-time coefficients. Their paper reports the older energy
values for dirt/grass 1.1, light brush 1.2, heavy brush 1.5, swampy bog 1.8 and loose sand 2.1 relative to hard pavement, then measures
different velocity-based coefficients. The game uses the energy values to inform preference while preserving existing physical speeds;
it does not multiply elapsed time by those energy coefficients. [Original research and table 1](https://intarch.ac.uk/journal/issue45/4/1.html).

Forest-trail research with Tsimane walkers documents different gait adaptations between a dirt field, trail and unbroken forest.
This supports distinguishing an established corridor from its surrounding vegetation, not transplanting a tropical forest's exact
costs into Sweden. [Holowka et al.](https://www.cambridge.org/core/journals/evolutionary-human-sciences/article/forest-terrains-influence-walking-kinematics-among-indigenous-tsimane-of-the-bolivian-amazon/5D24CA0C2EC4019414CABF32D5BCA010).

Medieval archaeological evidence includes parallel earth tracks around unusable ground, timber wetland crossings, stone/gravel surfacing,
and deliberate drainage. Thus traffic and engineering are different improvements: repeated use can establish footing but does not
create a drained causeway. [Viabundus archaeological overview](https://www.landesgeschichte.uni-goettingen.de/roads/viabundus/what-did-medieval-roads-look-like/).

## Implemented policy

For each tile, `PATHS.effort` defines a relative surface factor. The default mappings are:

| Game cover | Unworn dry factor | Interpretation |
|---|---:|---|
| Meadow, cultivated sites and village green | 1.1 | Firm dirt/grass reference |
| Heath | 1.2 | Light-brush proxy |
| Broadleaf and pine forest | 1.5 | Heavy-brush proxy, not every real forest |
| Hills and mountains | 1.28 | Rough-footing proxy; climbing is already in the slope/time calculation |
| Beach | 2.1 | Loose-sand proxy; firm wet sand is not a separate biome |
| Marsh | 1.8 | Persistent soft-ground proxy |

The biome assignments are approximations. A meadow is not necessarily long grass, a forest need not have dense undergrowth, and
the heightmap does not resolve individual rocks. These are named starting parameters, not measured medieval Swedish coefficients.

Use 1.1 as the firm natural-ground reference. On vegetation/rough ground, wear retains respectively 100%, 65%, 35% and 15% of the
excess above 1.1 at stages none, trodden, path and lane. For example, dry forest effort factors become 1.50, 1.36, 1.24 and 1.16.
Short grass receives no extra effort benefit from wear; its existing stage-speed benefit remains. Sand and marsh retain their soft
substrate penalty regardless of traffic. An actual river bridge has firm footing and no extra surface allowance.

Generated moisture above 0.65 adds a linear allowance, reaching 0.4 at moisture 1. It persists on worn ground. For sand/marsh it is
combined with substrate softness by taking the larger allowance, avoiding adding the same soft-ground mechanism twice. On other
land it adds to residual obstruction. The moisture threshold and 0.4 maximum are explicit game approximations.

The chooser minimises the sum of:

`walking cost × (1 + weight × surface effort allowance)`

`weight = 1` gives the initial willingness to exchange time for effort. This is a generalised preference cost, not watts, calories or
extra food consumption. There is no claim that a 20% energetic increase universally justifies a 20% time detour. Changing this weight
belongs in a later tuning run; this implementation does not tune the existing speed, yields or social reaches.

Endpoint tile costs are averaged and multiplied by the existing slope factor, as physical movement is. Physical movement still uses
`stepCost(w, a, b)`; `stepCost(..., true)` and `routeCost(..., true)` expose choice cost for diagnostics. The compiler stores both.

## Weather and drainage

There is no daily rain or soil-saturation model. `st.weather` is an annual harvest multiplier, not rainfall. It is deliberately excluded.
The generator's `w.hm` moisture ranking reflects regional rainfall, valley wetness and some noise; it is only a proxy for persistently
soft ground. The generated rainfall field is not multiplied in again because it already contributes to this moisture ranking.

The policy does not invent weather events or a drainage stat. Existing bridges supply firm crossing surfaces. Editor roads remain worn
lanes and gain no drainage. Constructed drains, gravel foundations, causeways, winter freezing and rain-dependent rutting need their own
state and rules before they can alter this policy honestly.

## Correctness, reach and caches

A* and Dijkstra order by choice cost, breaking equal costs by physical time. Straightness only breaks remaining A* ties; it is no longer
added to the admissible heuristic. Reach outputs actual walking time, never choice points.

The existing maximum cost arguments remain physical budgets. Search uses a conservative upper bound in choice points. If the least-choice
route would exceed the walking budget, a physical-time search supplies the fastest feasible route. This preserves reachable destinations
without unbounded Pareto labels. It is an explicit approximation: it does not find the best effort route among every possible route inside
a binding time budget. `routeBudgetFallback` counts destinations requiring this extra search.

Cache refresh now bounds both objectives, including better off-route alternatives. Stage updates retain their existing daily cadence;
raw crossings do not trigger searches. Current saves carry `routePolicy: 1` in save metadata. Old saves have time-only route/hour caches
cleared/rebuilt on load; ongoing physical movement remains valid because speeds did not change.

## Validation and measured behaviour

`tests/routes-effort.js` equalises all stage speeds and disables physical clearing to isolate effort. With main's broadleaf cost 2, the chooser takes a 22-unit physical-time forest route instead of
the 20-unit direct route: choice cost falls from 29.32 to 25.52. It rejects a distant detour, reports actual travel time, respects a tight
physical budget, avoids saturated ground, and leaves sand/marsh softness intact after trampling. At `SPEED = 12`, the example's 20 and
22 meadow-step costs correspond to 100 and 110 game minutes. Tests also cover off-route cache improvements and old-save migration.
`tests/routes-compiled.js` uses an independent effort/time Dijkstra oracle through terrain, wear, heightmap, bridge/ford and rule edits.

The initial measurements below compare real generated runs with the batch-one snapshot at `8bc997b`; the current-main integration measurements follow afterwards. `tools/path-effort-probe.js` makes the comparison numerically. Founders and populous, tiny map, seeds
7 and 42, two years each:

| Scenario/seed | Same-world sampled trips changed | Trips with lower choice cost | Total walking-time change in sample | End population before → after | Hungry pawn-days before → after | Trodden/path/lane tiles before → after |
|---|---:|---:|---:|---:|---:|---|
| founders 7 | 2/8 | 2/8 | +3.46% | 12 → 12 | 41 → 42 | 21/10/0 → 24/10/0 |
| founders 42 | 1/8 | 1/8 | +0.32% | 11 → 11 | 0 → 12 | 27/8/0 → 30/7/0 |
| populous 7 | 5/112 | 5/112 | +0.41% | 139 → 138 | 52 → 60 | 139/94/36 → 136/94/36 |
| populous 42 | 6/118 | 6/118 | +0.24% | 146 → 146 | 23 → 0 | 214/106/18 → 193/110/20 |

All four final per-tile wear hashes differ. These are numerical changes to travel and the resulting network, not just different rendering.
The samples compare preferred and fastest routes on the same initial world. The two-year runs compare baseline and active policy over their
own evolving worlds. Household outcomes change in 5, 5, 26 and 28 compared households respectively; the result is not uniformly better food
security. Short runs establish changed behaviour, not long-term demographic balance or a historically optimal network.

Cost also changes: heap removals rise 17,293 → 22,752; 20,570 → 22,576; 307,151 → 377,800; and 302,973 → 340,722 in table order.
Cache entries checked fall 5,304 → 4,555; 5,503 → 5,240; 134,941 → 117,329; and 120,714 → 107,971. These do not establish an overall
speedup; the active preference is extra work. Existing straight-route fallbacks (VB-329) remain 0/0, 0/0, 0/0 and 2/3 before/after; the
last case remains an existing routing defect to repair, not evidence of a valid land route. No counter baseline was raised to conceal it.
Full check results and remaining target residuals are recorded in `backlog/VB-441.md`.

## Integration with current main (PR baseline `ce6b2d1`)

Main changed physical terrain/path-clearing costs while this work was in progress. Those decisions are retained. The effort allowance
still treats soft substrate and moisture as persistent; the physical `PATHS.clear` benefits supplied by main also stand. No daily rain
or drainage facility is invented. Local task IDs were renumbered: compiler VB-440, active policy VB-441; main owns VB-439.

Fresh two-year comparisons use main's routes as baseline and the same founders/populous tiny seeds 7/42:

| Scenario/seed | Sample trips choosing a longer, lower-choice-cost route | Population before → after | Hungry pawn-days before → after | Trodden/path/lane before → after |
|---|---:|---:|---:|---|
| founders 7 | 0/8 | 12 → 12 | 46 → 43 | 20/11/0 → 22/11/0 |
| founders 42 | 1/8 | 11 → 11 | 0 → 0 | 28/8/0 → 28/9/0 |
| populous 7 | 2/112 | 139 → 138 | 69 → 59 | 130/85/42 → 132/90/38 |
| populous 42 | 3/118 | 146 → 146 | 0 → 12 | 199/105/18 → 183/108/25 |

Six of 246 sampled trips change for strictly lower choice cost; all four final wear hashes differ. Household outcomes change in 6,
5, 26 and 28 compared households. Heap removals: 17,604 → 21,657; 21,089 → 25,743; 319,425 → 410,371; 226,030 → 290,100
(about 22–28% higher). Cache-refresh checks: 5,245 → 4,475; 5,257 → 5,609; 128,727 → 116,619; 115,563 → 100,688. Existing
unreachable-route fallbacks remain 0/0, 0/0, 0/0, 2/1. There is no claim of faster overall routing or uniformly improved food security.
