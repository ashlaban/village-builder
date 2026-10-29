# Backlog

Tasks for the village builder proof of concept. The nightly run takes only `Status: ready` tasks, in priority order (1 first), then file order. Design refs point to the Claude doc "Village builder: game design snapshot v0.3".

A task is `ready` only when it needs no design decision: the goal, numbers and acceptance criteria are all stated. `needs-review` tasks list the questions Kim must answer first.

## VB-001: Make the test suite fail on regressions
Status: ready
Priority: 1
Size: S
Design ref: none (test infrastructure)
Goal: `npm test` today only prints output and passes unless a script crashes. Add assertions so that later nightly work cannot silently break the simulation or the page.
Acceptance criteria:
- [ ] `tests/regress.js` exits non-zero if, for seeds 7 and 42 over 3 years of the founders scenario: any household's grain or wood is `NaN` or negative, or no household brought in a harvest in year 1.
- [ ] `tests/heirs.js` exits non-zero if the heir rankings it prints at the start differ from today's output (record today's three ranking lines as expected values in the file).
- [ ] `tests/smoke.js` exits non-zero on a frame error, on any `console.error` from the page, on a loader timeout, or if the settlers list, customs table (11 rows), family tree or "Skip a year" are missing or empty.
- [ ] Before checking the settlers list after regenerating, `tests/smoke.js` ticks at least 0.25 s of frames (the panel refreshes every 0.25 s; today it ticks 10 × 16 ms and reads a stale list).
- [ ] Deliberately breaking each check once, locally and not committed, makes `npm test` fail; the committed suite passes.
- [ ] No behaviour change in `src/`; no new dependencies.
Notes / questions:

## VB-002: Simulation steps of at most 5 game minutes
Status: ready
Priority: 1
Size: S
Design ref: Commands, time steps and views (Simulation step: Decided)
Goal: `Sim.advance` in `src/sim.js` steps 0.1 game hours (6 minutes); the design says at most 5 minutes.
Acceptance criteria:
- [ ] The largest step `advance` takes is 5/60 of a game hour, set by one named constant (e.g. `MAX_STEP`) exported from `Sim`.
- [ ] Hourly events still fire exactly once per game hour: a test advances 2 game days in uneven chunks (e.g. 0.37 h at a time) and counts `onHour` calls, or an equivalent observable such as cooking done once a day per household.
- [ ] The clock keeps showing 10-minute steps (unchanged).
- [ ] `npm test` passes; 3 founder years in `tests/regress.js` take no more than 1.3× today's time on the same machine (report both numbers in the PR).
Notes / questions:

## VB-003: Every farm in a village, and an owner for every tile
Status: ready
Priority: 2
Size: M
Design ref: Claims, ownership and territory (Ownership: Decided); Inheritance and expansion, Succession (no heir: the village holds the farm, Agreed). Kim, 2026-10-29: every farm belongs to a village; a village can be degenerate (one farm, one household); an empty farm is owned by its village.
Goal: Lone farms become one-farm ("degenerate") villages, so every farm has a village. Then give the world a per-tile owner, set at seeding and kept up to date, as the base for claims, the ownership overlay and making fields and meadows.
Acceptance criteria:
- [ ] Every farmstead has a non-null `village`. A lone farm gets its own village with `degenerate: true`, its one farm, its own fence (owned by that village) and its woodlot as `commonsWood`.
- [ ] Customs behave exactly as today: a degenerate village is not a culture settlement; its people still take part in the nearest non-degenerate village's meeting (today's `settlementIdOf` rule). The customs panel lists the same settlements as before.
- [ ] The map, settlers list, family tree and labels look as before: code that checked `f.village === null` now checks the degenerate flag (no green or well drawn; farm label as today).
- [ ] `st.owner` is a typed array with one entry per tile, encoding none, a household id or a village id; helpers `ownerOf(st, tile)` and `setOwner(st, tile, owner)` are exported.
- [ ] At seeding, in both scenarios: each farmstead's house and field tiles belong to its household; each village's green (`center`, non-degenerate only) and commons wood belong to the village; all other tiles have no owner.
- [ ] When a farm stands empty (`extinct`), its house and field tiles pass to its village (degenerate or not). Succession within the household leaves ownership unchanged.
- [ ] The tile info panel shows the owner ("Norrgården household", "Ulsäter village"), or nothing for unowned tiles.
- [ ] A test checks the seeding rules, that every farm has a village, and the hand-over to the village on extinction. The heirs test output (`tests/heirs.js`) is unchanged apart from added lines.
Notes / questions:

## VB-004: Ownership map overlay
Status: ready
Priority: 3
Size: S
Design ref: Claims, ownership and territory (Overlay: Decided). Kim, 2026-10-29: a simple first version is acceptable.
Goal: A toggle button, next to Grid and Regions, that tints each owned tile by its owner. Depends on VB-003; if VB-003 is not done, mark this blocked.
Acceptance criteria:
- [ ] A toolbar button turns the overlay on and off; off by default.
- [ ] Household tiles take one tint per household and village tiles one per village; unowned tiles stay untinted. Tints stay readable over the terrain at play zoom.
- [ ] The overlay reflects ownership changes (e.g. a farm standing empty) on its next redraw; a full redraw on change is fine.
- [ ] Smoke test toggles it on and off with no console errors.
Notes / questions:
- Out of scope: filters by entity level, claims, chunk caching.

## VB-005: Trees per wooded tile
Status: ready
Priority: 2
Size: M
Design ref: Land and ecology (Trees per tile, Showing trees, Cleared woodland: Decided). Kim, 2026-10-29: numbers below; one growth model for all trees; regrowth applies only to tiles that still have trees.
Goal: Each broadleaf and pine forest tile holds a tree count. Firewood trips fell trees from the woodlot, partly felled tiles grow back slowly, the tile shows density stages, and at 0 it becomes meadow.
Acceptance criteria:
- [ ] `w.trees` and `w.treesMax` (per tile) are seeded deterministically: broadleaf 60 and pine 80 at full cover, each ±20% per tile; other tiles 0.
- [ ] Each completed firewood trip fells 1 tree from its woodlot tile.
- [ ] Regrowth: a tile with 0 < trees < max regains trees linearly, from 0 to full in 30 game years (same rate as a share of max for both kinds), applied once a game day.
- [ ] At 0 trees the tile's biome becomes meadow and never regrows by this rule; the farm or village then picks the nearest wooded tile (same search as `finishLand`) as its woodlot, and ownership of the commons wood (VB-003, if done) moves with it.
- [ ] Tile drawing picks one of four density stages (about 100%, 75%, 50%, 25% of max remaining); a cleared tile is drawn as meadow.
- [ ] Tile info shows "N of M trees".
- [ ] A test checks felling, regrowth over 30 years from a partly felled tile, and the switch to meadow at 0.
Notes / questions:

## VB-006: Stones on meadow tiles
Status: ready
Priority: 2
Size: S
Design ref: Land and ecology (Stones, Abandoned fields: Decided). Kim, 2026-10-29: more stones near hills.
Goal: Meadow tiles track a stone content that later slows breaking ground and yields building stone.
Acceptance criteria:
- [ ] `w.stones` (0–255 per tile) is seeded deterministically for meadow tiles: base noise plus a bonus that falls off with distance to the nearest hills tile, reaching zero beyond 2 tiles. Other biomes 0.
- [ ] Field tiles hold 0 stones at seeding (fields are already made).
- [ ] Tile info shows "few", "some" or "many" stones (thirds of the range).
- [ ] The existing stone decorations on meadow tiles scale with the value.
- [ ] A test checks determinism and that tiles next to hills average more stones than tiles far from them.
Notes / questions:
- Cleared stones are not tracked as a store yet (comes with VB-010).

## VB-007: Tilling and threshing as multi-day work
Status: ready
Priority: 2
Size: M
Design ref: Economy and jobs, Long work and processing (Tilling, Harvest, Multi-day jobs: Decided); Field cycle stages (Agreed). Kim, 2026-10-29: hours and roles below agreed.
Goal: Tilling takes several working days per field, and the harvest gains a threshing step after hauling sheaves to the barn.
Acceptance criteria:
- [ ] Tilling a field (`plow`) takes 20 work hours; progress persists across days and between pawns, as today.
- [ ] Hauled sheaves go to a household "unthreshed" store instead of straight to grain.
- [ ] A household `thresh` job turns unthreshed sheaves into grain at 6 work hours per field's crop; farmer, farmhand and son rank it high (priority 8), others low. The household panel shows the unthreshed store.
- [ ] A founders run over 3 years at seeds 7 and 42 (`tests/regress.js`) still harvests every year.
Notes / questions:
- The sowing window (spring days 1–10) is not to be changed by this task. If the 3-year runs leave fields unsown or households hungry because of the longer tilling, mark the task blocked and report how many fields went unsown per year; Kim decides whether to widen the window.

## VB-008: Summer upkeep of growing fields
Status: ready
Priority: 3
Size: S
Design ref: Economy and jobs, Long work and processing (Summer upkeep: Decided). Kim, 2026-10-29: numbers below agreed.
Goal: Growing fields post a little work (weeding), and neglect lowers the yield.
Acceptance criteria:
- [ ] Each growing field posts a 2-hour `weed` job every 6 game days, owned by its household.
- [ ] Role priorities for `weed` equal each role's priority for `sow`.
- [ ] Each upkeep job not done before the next one is due cuts that field's yield by 8%, at most 40% in total; the cut resets when the field is reaped.
- [ ] A test shows a tended field yields more than an untended one.
Notes / questions:

## VB-009: Hand-quern milling and making rations
Status: ready
Priority: 3
Size: M
Design ref: Economy and jobs, Long work and processing (Milling at home: Decided). Kim, 2026-10-29: milling makes more food from grain; a household job turns grain or flour into rations; flour needs less input than grain.
Goal: Food stops being eaten straight from grain. Households grind grain to flour on a hand quern, and a household job turns flour or grain into rations; flour goes further.
Acceptance criteria:
- [ ] Households hold `grain`, `flour` and `rations`. Harvests, seed, starting stores and inheritance shares stay in grain.
- [ ] A `grind` job (hand quern, at home) turns grain into flour at 1 work hour per 4 units of grain, 1 grain to 1 flour; it is posted while grain exceeds the seed reserve (seed for all fields) and flour is below 10 days of the household's needs.
- [ ] Making rations (the existing daily `cook` job) turns flour into rations at 1:1, or, when flour runs short, grain at 1.25 grain per ration, making enough for the next day's need.
- [ ] Daily food is eaten from rations; hunger counts as today when rations run out.
- [ ] `grind` priorities: mistress of the house and maid 7, daughter 6, retired 3, others 1.
- [ ] The household panel shows grain, flour and rations.
- [ ] A test shows the same grain feeds a household longer with milling than without (about 25% longer).
- [ ] A founders run over 3 years at seeds 7 and 42 has no more hungry days than before this task; if it has more, mark blocked and report the numbers.
Notes / questions:

## VB-010: Founders start on unmade land and make their fields
Status: needs-review
Priority: 3
Size: L
Design ref: Starting scenarios (founders with next to no fields made: Decided; first year: Proposed); Goods and the farming year (Making a field: Decided). Kim, 2026-10-29: founders arrive at standing houses, with stores to last them through the first winter. Depends on VB-003 and VB-006.
Goal: The founders scenario starts with houses standing but no fields made; households claim tiles, clear scrub and stones, and break ground before they can sow.
Proposed acceptance criteria:
- [ ] Founders start with houses, no fields, and grain for a full year's food plus seed for their planned fields.
- [ ] A household claims its planned field tiles (owner = household), clears each one (`clear` job) and breaks the ground (`break` job); only then does the tile become a field in stubble.
- [ ] Stones from clearing are kept as a household or village store of building stone.
- [ ] A founders run reaches its first harvest by autumn of year 1 or year 2 without starving.
Notes / questions:
- Hours: a proposal is 8 h to clear scrub and 12 h to break ground, both scaled by up to ×2 on stony tiles (`w.stones`). Acceptable?
- Who works on clearing and breaking (proposal: same priorities as `plow`)?
- Are the planned field tiles chosen by the seeding code (as today), or by the households during play?
