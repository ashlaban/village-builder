# Roads, terrain and travel: review, 13 November 2026

Reviewed at `8bc997b`. This is research and a code audit, not a tuning run. No simulation parameters or design decisions were changed by this review. The later [active effort policy](path-effort-policy.md) (VB-441, 14 November) supersedes the time-only route-choice description below; base `SPEED` remains as reviewed, while main's later VB-439 changes the terrain/path-clearing costs and slope grade.

## Findings

The existing system is a good foundation for desire paths: traffic makes paths, paths attract traffic, and disused paths fade. It does not yet represent constructed roads. Its physical walking pace is low, its slope model is deliberately compressed and symmetric, and route failure can bypass the obstacles that the normal route search respects. More elaborate road speed bonuses should follow resolution of these issues.

## What actually exists

`src/sim/rules.js`, `routes.js`, `paths.js` and `agents.js` implement:

- A* routes over hex neighbours, with costs averaged across the two endpoint tiles, multiplied by a slope penalty. The movement code uses the same step costs, although actual distances include offsets within sites.
- Meadow, heath, beach and cultivated land cost 1; forest and pine 1.5; hills and marsh 2; mountains 3. Water, uncrossed rivers and snowfield biomes are closed. Fords cost 2 and bridges 1. These are travel rules, not merely drawing effects.
- Four wear stages: none, trodden, path, lane. Their speed factors are 1, 1.05, 1.15 and 1.30, at accumulated crossing thresholds 0, 50, 200 and 800. Wear has a half-life of one 48-day game year; stages fall below 85% of their threshold. A lane is not a paved road.
- Editor roads call `layWay` to create wear. They do not create gravel, cobbles, foundations, drainage or engineered grades. Existing fords and bridges provide crossing costs separately.
- Loaded movement factors of 0.9 on the back, 0.8 with a handcart and 0.6 with an ox cart, when the carrying code selects those modes. Surface- and grade-specific wheel suitability is absent from the shared route cost.

The effective homogeneous-ground formula is:

`speed = 12 tiles/hour × path factor × load factor / (terrain cost × slope factor)`

At the agreed landscape scale, one step is approximately 150 m. The base is therefore **1.8 km/h**. This uses the landscape reading of the grid, not its approximately 10 m building-site reading. The model cannot satisfy literal speeds at both scales simultaneously.

| Level ground | No path, km/h | Path, km/h | Lane, km/h | Minutes/km, no path |
|---|---:|---:|---:|---:|
| Meadow, heath, beach, field | 1.80 | 2.07 | 2.34 | 33.3 |
| Broadleaf or pine forest | 1.20 | 1.38 | 1.56 | 50.0 |
| Hills or marsh | 0.90 | 1.035 | 1.17 | 66.7 |
| Mountain | 0.60 | 0.69 | 0.78 | 100.0 |

These are evaluated using the real `stepCost` function with equal endpoint elevations and matching endpoint wear, not inferred from screenshots. A mixed step uses the mean tile cost. Hills and mountains receive these penalties even on a locally level step, before slope is applied.

A 30% speed improvement is a **23.1% time saving**, not 30%. Trodden ground saves 4.8%; a path saves 13.0%. A forest lane retains the forest penalty: clearing an obstructed corridor is not represented by the lane alone.

## Evidence and practical travel estimates

There is no reliable universal historical table saying a medieval walker was a fixed percentage faster on cobbles than on gravel. Road condition, moisture, slope, loads and the traveller matter. The following ranges are **engineering estimates for choosing game parameters**, not measurements from medieval diaries. They describe an able adult moving steadily, without a heavy load, excluding stops. They should not be assigned to every child, elder or sick pawn.

| Ground or route, roughly level | Suggested moving pace | Time for 1 km | Interpretation |
|---|---:|---:|---|
| Firm, short grass/open ground | 3.5–5 km/h | 12–17 min | Easy off-road movement |
| Maintained footpath | 4–5 km/h | 12–15 min | Clear footing and navigation |
| Firm, dry dirt lane | 4–5 km/h | 12–15 min | Can equal a surfaced road in good conditions |
| Loose sand, rough heath, obstructed woodland | 2–3.5 km/h | 17–30 min | Strongly dependent on substrate/vegetation |
| Very rough ground, soft bog or deep mud | 0.5–2 km/h, or closed | 30–120 min, or detour | Avoid making all wetlands safely traversable |

The numerical anchor is Tobler's hiking function, `v = 6 exp(-3.5 abs(s + 0.05))` km/h, where `s` is signed rise/run. It gives about 5.04 km/h on level paths; its conventional off-path factor of 0.6 gives about 3.02 km/h. This is a general hiking model, not a medieval population estimate. See the [University of Tübingen's archaeological least-cost modelling note](https://uni-tuebingen.de/forschung/forschungsschwerpunkte/sonderforschungsbereiche/sfb-1070/archiv/zweite-foerderphase/organisation/serviceprojekt-s/technical-notes/technical-note-3/) and [Tobler's 1993 report record](https://escholarship.org/uc/item/05r820mz).

Direct field research also supports distinguishing cleared trails from vegetation and uneven footing: the [Tsimane walking study](https://www.cambridge.org/core/journals/evolutionary-human-sciences/article/forest-terrains-influence-walking-kinematics-among-indigenous-tsimane-of-the-bolivian-amazon/5D24CA0C2EC4019414CABF32D5BCA010) compares a dirt field, forest trail and unbroken forest. It supports the mechanism, not a universal European forest multiplier. Energy expenditure and preferred speed are related but should not be treated as interchangeable measurements.

Daily progress is a different quantity. The [ORBIS authors' report, section “Road transport”](https://www.academia.edu/79177238/Orbis_The_Stanford_Geospatial_Network_Model_of_the_Roman_World) adopts 30 km/day for ordinary foot travel, 20 for porters/heavily loaded mules, 12 for ox carts, 30 for mule carts and 56 for routine horseback travel. These are historical modelling assumptions for sustained journeys, not fixed moving speeds or specifically medieval observations. Thirty kilometres at 4–5 km/h requires 6–7.5 moving hours, leaving time for meals, rests and preparations.

## Relevant road types

The useful medieval additions are **maintained dirt lanes, gravel/stone-metalled ways, paved streets, and wet-ground reinforcement**, rather than a simple technological ladder in which every material increases walking speed.

| Type | Plausible dry, level walking pace (proposed) | Principal benefit and limitation |
|---|---:|---|
| Worn footpath | 4–5 km/h | Removes obstacles; narrow paths need not permit carts |
| Maintained dirt cart lane | 4–5 km/h | Width and cleared route; vulnerable to rutting and wet soil |
| Gravel or broken-stone metalling | 4–5 km/h | Firmer footing, drainage and more dependable wheeled access |
| Roman-style engineered road | 4–5 km/h | Foundation, camber, drains and reliable crossings; surface may itself be gravel or stone |
| Cobbled street | 3.5–5 km/h | Durable under traffic; uneven or wet stones need not be faster than dry dirt |
| Flatter stone paving/setts | 4–5 km/h | Durable surface; condition and grip still matter |
| Raised causeway, timber/plank or log reinforcement | 2–4 km/h across difficult ground | Makes a wet crossing feasible; width, slipperiness, decay and load capacity matter |

These ranges intentionally overlap. For equal distance, 4 versus 5 km/h means 15 versus 12 minutes/km. Avoid claiming an evidence-based ranking where none was established. For a sensitivity example only, changing a muddy route from 1.5 km/h to a drained road at 4 km/h cuts time from 40 to 15 minutes/km (62.5%); that is a condition improvement, not a universal gravel bonus.

The county archaeological record describes Roman aggers and surfaces including gravel, chalk and slag: “Roman” is not a single pavement material. See [Buckinghamshire's Historic Environment Record](https://heritageportal.buckinghamshire.gov.uk/theme/tbc371). Reused Roman alignments are plausible where the setting has that history; a northern fictional archipelago need not possess a Roman inheritance.

Medieval evidence includes earth lanes and holloways, gravel, stone and timber surfacing, with repairs and regional variation. Boardwalks belong especially in wet-ground crossings. Holloways are an outcome of traffic and erosion, not an upgrade tier. See [Viabundus's archaeological overview](https://www.landesgeschichte.uni-goettingen.de/roads/viabundus/what-did-medieval-roads-look-like/). Bridges, fords and ferry landings should remain distinct crossing facilities. Macadam and tarmac would be inappropriate medieval defaults.

## Slopes: physical model versus current game

Current code calculates:

`s_effective = 1.5 × abs(height[b] - height[a])`

`slope factor = min(6, exp(3.5 × s_effective))`

This is a symmetric Tobler-inspired approximation, not Tobler's signed function. Its level-normalised uphill penalty matches Tobler for positive slopes; downhill loses the gentle-descent advantage. On real routes, moderate descent can accelerate walking, while steep descent slows it again. A 10% grade means 10 m up per 100 m horizontally (about 5.7 degrees), not 10 degrees.

| Signed grade | Tobler on-path, km/h | Current game meadow pace using that effective grade, km/h |
|---|---:|---:|
| -30% | 2.50 | 0.63 |
| -20% | 3.55 | 0.89 |
| -10% | 5.04 | 1.27 |
| -5% | 6.00 | 1.51 |
| 0% | 5.04 | 1.80 |
| +5% | 4.23 | 1.51 |
| +10% | 3.55 | 1.27 |
| +20% | 2.50 | 0.89 |
| +30% | 1.76 | 0.63 |

The absolute speeds differ because the game's base is lower; the *uphill relative penalties* match before the cap. The symmetric penalty can be defended as a cheap round-trip approximation, but not as a faithful directional model. A signed model requires directional routing, cache keys, reach tables and journey calculations: reversing a cached route would no longer guarantee the fastest return, and the current village-hours table explicitly mirrors costs.

There is a second, separate discrepancy. `src/page/tileinfo.js` displays `height × 1400` metres. At 150 m per step, physical grade would be approximately `9.33 × height difference`, versus the simulation's `1.5 × difference`: a factor of **6.22**. For a height difference of 0.1, the UI implies a 140 m climb over 150 m (93% grade), but movement treats it as 15%. The effective full-height relief is 225 m at this horizontal scale. The compression is documented and intentional; changing to literal UI elevations without changing the heightmap would produce an extremely steep world.

Terrain penalties can also double-count climbing if “hills” and “mountains” primarily mean elevation. Retain extra costs for scree, vegetation and footing, but use grade for ascent/descent. At the cap a mountain step costs 18 meadow steps: only 0.1 km/h without wear, while even steeper steps never become impassable. The cap bounds computation; it is not a physical cliff rule.

Paving alone does not remove a climb. A graded road can reduce longitudinal slope through switchbacks/cuttings, at the expense of length and construction. Loaded carts need their own traction, braking and feasibility rules; the pedestrian hiking equation is not a cart model.

## How realistic are the present speeds?

- **Short walks:** 2 km takes 66.7 minutes on flat meadow, or 51.3 on a lane, before loads and slopes. At 4–5 km/h it takes 24–30 minutes. The current flat base is 2.2–2.8 times slower than that ordinary moving benchmark.
- **Daily journeys:** 12 uninterrupted hours permit 21.6 km on meadow or 28.08 on a lane. Thus lane travel approaches ORBIS's 30 km/day while doing so through a low moving speed and a long moving day. Daily plausibility does not establish realistic hourly pace.
- **Carrying:** the flat meadow paces implied by the factors are 1.62 km/h on the back, 1.44 with a handcart and 1.08 beside an ox cart; on a lane 2.106, 1.872 and 1.404. The ox-cart daily equivalent is 12.96 km in 12 moving hours on meadow, broadly similar numerically to ORBIS's 12 km/day, but obtained without a validated terrain/load model.
- **Time compression:** one game day represents about a week in the annual calendar, but work and walking use game hours. Multiplying a walk's duration by seven would mix scales. Likewise the 48-second day at 1× is display acceleration, not evidence that a person's physical pace is fast. At 1×, 12 tiles/hour is approximately 6 tiles per real second, not the 3 stated in the design's day-length explanation (`12 × 24 / 48 = 6`); per-frame interpolation and work pauses affect what is seen.
- **Generated route sample:** populous, small, seed 7, at initial seeding: 9 villages, 36 pairs, 28 within land-route reach; median reachable pair 7.53 hours, median nearest reachable neighbour 1.51 hours. The most isolated village with a reachable neighbour has a nearest-neighbour time of 6.15 hours. This is one geography sample, not a balance or historical validation run. The reach ceiling of 200 weighted steps is currently 16.67 hours, not the old 67-hour figure still present in parts of the design.

## Reliability issues and recommendations

1. **Resolve route failure before calibrating roads.** `routes.route()` returns `[destination]` after a failed bounded search. `agents.walkTo()` then makes a straight movement segment using the destination tile cost, without the intervening terrain, water or slopes. `agents.hoursTo()` also falls back to unweighted hex distance when no finite village-hours entry exists. These are separate visible-movement and journey-time bypasses. A counted fallback is not proof of a safe land route. Distinguish no route from beyond the search budget and from a journey needing another transport mode.
2. **Choose and document the spatial contract.** Either provide movement elevations consistent with displayed metres, smooth/regenerate relief to fit, or label the current elevation as compressed. Keep a symmetric slope approximation only as an explicit design compromise.
3. **Treat roads as infrastructure over terrain.** Separate underlying land, cleared route surface, condition/drainage, access mode, and engineered grade/crossings. Traffic wear should not spontaneously create cobbles or a raised causeway. Roads should have construction and maintenance requirements distinct from fading foot traffic.
4. **Use ordinary walking as the physical anchor.** A candidate reference is 4–5 km/h for a maintained level path, about 27–33 tiles/game hour at 150 m per step. This is a research range, not a recommended isolated parameter edit: changing `SPEED` also changes agricultural hours, carrying, social reach, journeys, claims and service.
5. **Evaluate terrain relief and road benefits together.** Prioritise a dirt lane, drained gravel way, paved street and wet-ground causeway/boardwalk. Give them overlapping good-condition pedestrian speeds but different weather resilience, upkeep, cart suitability and carrying effectiveness. Then measure round trips, household walking shares and village connectivity over multiple seeds, including wet conditions and loaded travel.

## Work performed and reproduction

Read the current design's world scale, worn-path and calendar rules, the runtime rules and route/path/movement/cart code, editor placement and elevation display. Researched hiking models, experimental forest walking, archaeological road construction and sustained historical transport estimates. Evaluated homogeneous endpoint costs directly through `VB['sim/routes'].stepCost`; converted with `0.15 × SPEED / cost`. Calculated slope comparisons from the two formulas above.

Commands run:

```sh
node tests/routes.js
node tests/paths.js
node tools/sim.js --scenario populous --seed 7 --map small --years 0 --report reach --json
```

Both focused checks and `git diff --check` passed. The reach command seeds the current generated world without advancing years. `npm test` reported 40/51 passing, with failures including missing `prettier`/`acorn` dependencies and child-process `EPERM` errors. `npm run verify` reproduced these environment failures and was stopped after it ceased producing progress; full verification remains incomplete. No long-term balance claim follows from these checks. Road-material speeds and wet-weather examples above are explicitly proposals for future validation; this review did not find a source that validates exact medieval surface multipliers.
