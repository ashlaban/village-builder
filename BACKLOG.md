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

## VB-002: Clock shows game time in 5-minute steps, apart from the simulation step
Status: ready
Priority: 1
Size: S
Design ref: Commands, time steps and views (Clock and picture: Decided). Kim, 2026-10-29: the simulation may keep steps of up to 6 game minutes; the UI clock is its own state and must show time in steps of at most 5 game minutes. UI state and simulation state are not automatically the same.
Goal: Today the clock shows 10-minute steps and is redrawn only in the 0.25 s panel refresh, so at 10× it jumps by over an hour. Give the UI its own clock state that follows simulation time in 5-minute steps and is redrawn every frame it changes.
Acceptance criteria:
- [ ] `Sim.advance` and its step size are unchanged (up to 0.1 game hours); `npm test` output for the simulation scripts is unchanged.
- [ ] The UI keeps its own clock value (e.g. `uiClock`), derived each frame from simulation time and floored to 5 game minutes; minutes shown are always a multiple of 5.
- [ ] The clock's DOM text is written in the frame loop whenever the 5-minute value changes, not in the 0.25 s refresh of the settlers and pawn panels; it is not rewritten when unchanged.
- [ ] After any frame, the shown time is at most 5 game minutes behind simulation time, at 1×, 3× and 10× with 16 ms frames (a smoke test checks this at 10×).
- [ ] Pause, speed buttons, "Skip a year" and regenerating still leave the clock correct.
Notes / questions:

## VB-003: Every farm in a village, and an owner for every tile
Status: ready
Priority: 2
Size: M
Design ref: Claims, ownership and territory (Ownership: Decided); Inheritance and expansion, Succession (no heir: the village holds the farm, Agreed). Kim, 2026-10-29: every farm belongs to a village; a lone farm is a normal village with one farm (no special flag), with its own meeting; an empty farm is owned by its village.
Goal: Lone farms become ordinary one-farm villages, so every farm has a village. Then give the world a per-tile owner, set at seeding and kept up to date, as the base for claims, the ownership overlay and making fields.
Acceptance criteria:
- [ ] Every farmstead has a non-null `village`; no village carries a lone/degenerate flag. A lone farm's village has the farm's house tile as its `center`, its woodlot as `commonsWood`, and its fence owned by the village.
- [ ] Code that checked `f.village === null` is rewritten; where drawing differed (no green or well, the farm's own label), it now depends on the village having one farm.
- [ ] A one-farm village is a culture settlement like any other: it holds its own meeting and appears in the customs panel. The heirs scenario (no lone farms) gives the same `tests/heirs.js` output as before, apart from added lines.
- [ ] `st.owner` is a typed array with one entry per tile, encoding none, a household id or a village id; helpers `ownerOf(st, tile)` and `setOwner(st, tile, owner)` are exported.
- [ ] At seeding, in both scenarios: each farmstead's house and field tiles belong to its household; each village's commons wood, and its `center` unless that is a house, belong to the village; all other tiles have no owner.
- [ ] When a farm stands empty (`extinct`), its house and field tiles pass to its village. Succession within the household leaves ownership unchanged.
- [ ] The tile info panel shows the owner ("Norrgården household", "Ulsäter village"), or nothing for unowned tiles.
- [ ] A test checks the seeding rules, that every farm has a village, and the hand-over to the village on extinction.
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
Design ref: Land and ecology (Stones, Abandoned fields: Decided). Kim, 2026-10-29: every untouched meadow tile has some stones; extra stones near hills fade to nothing with distance.
Goal: Meadow tiles track a stone content that later slows making a field (VB-010) and yields building stone.
Acceptance criteria:
- [ ] `w.stones` (0–255 per tile) is seeded deterministically for meadow tiles: a base value from noise, never below 30, plus an extra up to +100 that falls off with distance to the nearest hills tile and is zero beyond 2 tiles; clamped to 255. Other biomes 0.
- [ ] Field tiles hold 0 stones at seeding (fields are already made).
- [ ] Tile info shows "few", "some" or "many" stones (thirds of the range).
- [ ] The existing stone decorations on meadow tiles scale with the value.
- [ ] A test checks determinism, that every meadow tile has at least 30, and that tiles next to hills average more stones than tiles more than 2 tiles away.
Notes / questions:
- Cleared stones become a store in VB-010.

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
Status: ready
Priority: 3
Size: L
Design ref: Starting scenarios (founders with next to no fields made: Decided); Goods and the farming year (Making a field: Decided); Land and ecology (Meadow to field: Decided). Kim, 2026-10-29: founders arrive at standing houses with stores to last through the first winter; farmers claim a meadow tile and turn it into a field when the household needs one; the same people as tilling do the work; job lengths from history, scaled to the game. Depends on VB-003, VB-006 and VB-007; if any is not done, mark this blocked.
Goal: The founders scenario starts with houses but no fields. A household that needs more fields claims a meadow tile, clears it of scrub and stones, and breaks the ground; then it is a field in stubble, sown in the next sowing window.
Acceptance criteria:
- [ ] Founders scenario: houses as today, no fields; each household starts with grain for its rations for one full year (48 days, through the first winter) plus seed for the fields it wants (below). The heirs scenario is unchanged.
- [ ] Demand: a household wants `ceil(1.1 × yearly rations / (0.75 × fieldYield))` fields, at most 4 (2–4 fields per farm). While it has fewer fields, counting the one in progress, it starts one new-field project at a time.
- [ ] Choosing the tile: the farmer picks an unowned, unclaimed meadow tile within 4 tiles of the house, not a village centre, scoring fertility − 0.5 × stones/255 − 0.15 × distance; then the tile is owned by the household (`setOwner`).
- [ ] `clear` job: 10 h for scrub plus 20 h × stones/255; it sets the tile's stones to 0 and adds `round(stones / 25)` loads to the household's stone store.
- [ ] `break` job: 30 h; then the tile becomes a field in `stubble`, with fertility from its biome, and is drawn as a field.
- [ ] `clear` and `break` use each role's `plow` priority; progress persists across days, as for other long jobs.
- [ ] The household panel shows the stone store and any field in progress.
- [ ] A founders run over 3 years at seeds 7 and 42 reports, per year: fields made per farm, fields sown, hungry days. Every farm has at least one field sown by year 2. Report the numbers in the PR; do not tune values to change them. If any farm has none sown by year 2, mark blocked with the numbers.
Notes / questions:
- Job lengths: the game's 20 h of hoeing per field (VB-007) is the yardstick. History suggests breaking virgin grassland takes about 1.5–2× ordinary tillage, and stony ground halves the ploughing rate, so: break 30 h (1.5 × tilling); scrub 10 h; stones up to 20 h. A typical meadow tile then takes about 50 h, five working days for one person.
- Extending the infield fence round new fields is out of scope.
- Watch: one field made before spring day 10 yields about 80 grain in the first autumn, much less than a household eats in a year. Hunger in year 2 is possible with these stores; the run reports it rather than changing stores.
