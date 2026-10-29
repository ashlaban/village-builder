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

## VB-003: Record an owner for every tile
Status: needs-review
Priority: 2
Size: M
Design ref: Claims, ownership and territory (Ownership: Decided); Inheritance and expansion, Succession (no heir: the village holds the farm, Agreed)
Goal: Give the world a per-tile owner, set at seeding and kept up to date, as the base for claims, the ownership overlay and making fields and meadows.
Proposed acceptance criteria:
- [ ] `st.owner` is a typed array with one entry per tile, encoding none, a household id or a village id; helpers `ownerOf(st, tile)` and `setOwner(st, tile, owner)` are exported.
- [ ] At seeding, in both scenarios: each farmstead's house and field tiles belong to its household; each village's green (`center`) and commons wood (`commonsWood`) belong to the village; all other tiles have no owner.
- [ ] When a farm stands empty (`extinct`), its house and field tiles pass to its village.
- [ ] Succession within the household leaves ownership unchanged.
- [ ] The tile info panel shows the owner ("Norrgården household", "Ulsäter village", or nothing for unowned tiles).
- [ ] A test checks the seeding rules and the hand-over to the village on extinction.
Notes / questions:
- A lone farm (no village) that stands empty: does it become unowned, or stay with the dead household until claimed?
- A lone farm's woodlot is today just the nearest forest tile. Should it be owned by the household, or stay unowned?

## VB-004: Ownership map overlay
Status: needs-review
Priority: 3
Size: M
Design ref: Claims, ownership and territory (Overlay: Decided; filters: Decided, modular and fast: Open challenge)
Goal: A toggle button, next to Grid and Regions, that tints each owned tile by its owner. Depends on VB-003.
Proposed acceptance criteria:
- [ ] A toolbar button turns the overlay on and off; off by default.
- [ ] Household tiles take one tint per household and village tiles one per village; unowned tiles stay untinted.
- [ ] The overlay is drawn per map chunk and redrawn only for the chunks whose ownership changed (Proposed scope model); a test counts the redraws.
- [ ] Smoke test toggles it with no console errors.
Notes / questions:
- First version without filters (pawn, family, village…) and without claims; is that acceptable?
- Is chunk-level caching wanted now, or is a simple full redraw acceptable for the proof of concept?

## VB-005: Trees per wooded tile
Status: needs-review
Priority: 2
Size: M
Design ref: Land and ecology (Trees per tile, Showing trees, Cleared woodland: Decided)
Goal: Each broadleaf and pine forest tile holds a tree count. Firewood jobs fell trees from the woodlot one at a time, the tile shows stages at 100/75/50/25% remaining, and at 0 it becomes meadow.
Proposed acceptance criteria:
- [ ] `w.trees` (one count per tile) is seeded for forest and pine tiles.
- [ ] Each completed firewood trip removes trees from its woodlot tile.
- [ ] Tile drawing picks one of four density stages from the share remaining.
- [ ] At 0 trees the tile's biome becomes meadow and the farm or village picks the next nearest wooded tile as its woodlot.
- [ ] Tile info shows the tree count.
Notes / questions:
- Trees per tile: a proposal is 60 for broadleaf and 80 for pine, with ±20% noise. Acceptable?
- Trees per firewood trip (3 loads today): a proposal is 1 tree per trip. With 5 households this clears a commons wood tile in about two years; is that the pace wanted?
- Does a felled tile regrow (the forest-spread rule), or is that a later task?

## VB-006: Stones on meadow tiles
Status: needs-review
Priority: 2
Size: S
Design ref: Land and ecology (Stones: Decided)
Goal: Meadow tiles track a stone content that later slows breaking ground and yields building stone.
Proposed acceptance criteria:
- [ ] `w.stones` (0–255 per tile) is seeded for meadow tiles, deterministically from the seed.
- [ ] Tile info shows "few", "some" or "many" stones.
- [ ] The existing stone decorations on meadow tiles scale with the value.
Notes / questions:
- Distribution: uniform noise, or more stones near hills and mountains? Proposal: base noise plus a bonus within 2 tiles of hills.
- Do abandoned fields become stone-free meadow (Decided) by setting the value to 0? Yes per the doc; confirm that cleared stones are not tracked as a store yet.

## VB-007: Tilling and threshing as multi-day work
Status: needs-review
Priority: 2
Size: M
Design ref: Economy and jobs, Long work and processing (Tilling, Harvest, Multi-day jobs: Decided); Field cycle stages (Agreed)
Goal: Tilling takes several working days per field, and the harvest gains a threshing step after hauling sheaves to the barn. Progress already persists across days, so the change is mostly in hours and stages.
Proposed acceptance criteria:
- [ ] Tilling a field takes N work hours, so one person needs several working days; the sowing window is widened if needed so that four farms still get sown.
- [ ] Hauled sheaves go to an "unthreshed" store; a household threshing job turns them into grain at M work hours per field's crop.
- [ ] A founders run over 3 years still harvests and never starves when the weather factor is 1.
Notes / questions:
- Hours: a proposal is 20 h of hoeing per field (2 working days for one person) and 6 h of threshing per field. Acceptable?
- The sowing window is spring days 1–10; with 3 fields per farm and 20 h each, one farmer cannot till alone in time. Should the window widen, or should more hands be expected to help?
- Which roles thresh (proposal: farmer, farmhand, son at high priority)?

## VB-008: Summer upkeep of growing fields
Status: needs-review
Priority: 3
Size: S
Design ref: Economy and jobs, Long work and processing (Summer upkeep: Decided)
Goal: Growing fields post a little work, such as weeding, and neglect lowers the yield.
Proposed acceptance criteria:
- [ ] Each growing field posts an upkeep job every K days.
- [ ] Each missed upkeep cuts the field's yield by P%, capped.
- [ ] A test shows a tended field yields more than an untended one.
Notes / questions:
- K, the job length, P and the cap? Proposal: every 6 days, 2 hours, −8% per miss, at most −40%.

## VB-009: Hand-quern milling
Status: needs-review
Priority: 3
Size: M
Design ref: Economy and jobs, Long work and processing (Milling at home: Decided)
Goal: Grain is ground to flour at home with a hand quern, slowly.
Notes / questions:
- Do people eat flour rather than grain, so that a household without milling goes hungry, or is milling only flavour for now?
- Rate (proposal: 1 hour of grinding per 4 rations) and which roles grind (proposal: mistress of the house and maids)?

## VB-010: Founders start on unmade land and make their fields
Status: needs-review
Priority: 3
Size: L
Design ref: Starting scenarios (founders with next to no fields made: Decided; first year: Proposed); Goods and the farming year (Making a field: Decided). Depends on VB-003 and VB-006.
Goal: The founders scenario starts with no fields made; households claim tiles, clear scrub and stones, and break ground before they can sow.
Notes / questions:
- Do founders arrive to standing houses, or build them in year 1 (Open in the doc)?
- Stores brought along: a year's food plus seed (Proposed); exact amounts?
- Hours to clear and break a tile, and how stones scale them.
- Is the first-year sketch (Proposed) accepted as the target?
