# Backlog

Tasks for the village builder proof of concept. The nightly run takes only `Status: ready` tasks, in priority order (1 first), then file order. Design refs point to the Claude doc "Village builder: game design snapshot v0.3".

A task is `ready` only when it needs no design decision: the goal, numbers and acceptance criteria are all stated. `needs-review` tasks list the questions Kim must answer first.

Refactor rules (every task titled "Refactor:"):
- Behaviour is unchanged: `npm test` passes and `tests/golden.json` (VB-011) is unchanged. Rebuild `index.html` before committing.
- Code moves verbatim apart from the module wrapper, the dependency lines at its top and its return list. Lines over 160 characters in moved code are wrapped at statement or argument boundaries; nothing else is reformatted.
- No renames: functions, state fields and the `Sim`, `ArchGen` and `Culture` APIs keep their names, so backlog references and greps stay valid.
- A new module follows the VB-012 convention, starts with an `@sys` header (VB-013), is listed in `src/manifest.json` after every module it reads, and stays under 400 lines.
- Depends on VB-011 to VB-015; if any is not done, mark the task blocked.

Once VB-011 is done, a non-refactor task that changes behaviour on purpose re-records the golden file with `node tests/golden.js --update` and lists the changed entries in its PR.

## VB-001: Make the test suite fail on regressions
Status: done (2026-10-29, ed5c5ed)
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

## VB-011: Golden-state test for world, simulation and calibration
Status: ready
Priority: 1
Size: S
Design ref: none (test infrastructure for refactoring)
Goal: The refactor tasks (VB-016 onwards) must leave behaviour exactly as it is. World generation and the simulation are deterministic, so record a fingerprint of their output that `npm test` checks.
Acceptance criteria:
- [ ] `tests/golden.js` hashes, for seeds 7 and 42: the generated world (every typed array and number on `w`); and for each scenario (`founders`, `heirs`, default settings) the state after `Sim.seed` and after each of three calls to `Sim.advance(st, Sim.YEAR)`.
- [ ] State hashing is canonical: object keys sorted; `Map` and `Set` as entries in insertion order; typed arrays as plain arrays; numbers as `toPrecision(12)`; functions skipped; `st.w` skipped (the world is hashed on its own); a shared or cyclic reference written as a back-reference to the path where the object was first seen.
- [ ] Each top-level key of `st` gets its own hash, so a failure names what changed (e.g. `founders/42/year2: households, events`).
- [ ] It also hashes the stdout of `node tests/calibrate.js natural 2 50`, and the sorted key lists of `Sim`, `ArchGen` and `Culture` (to catch renames).
- [ ] Expected hashes are kept in `tests/golden.json`; `node tests/golden.js --update` rewrites the file. Only Node built-ins (`crypto`). Runs in under 15 s. Added to `npm test`.
- [ ] Changing one `ECON` value locally (not committed) makes it fail and names the changed keys; the committed suite passes.
Notes / questions:

## VB-012: One module list, a module namespace and a Node loader
Status: ready
Priority: 1
Size: M
Design ref: none (code structure)
Goal: Adding or splitting a source file today means editing `build.py`, the markers in `src/body.html`, `tests/smoke.js` (it evals the page's scripts by index and renames `const ArchGen`, `const Culture`, `const Sim`) and the `require`/global set-up at the top of every test. Put the module list in one place and give modules one way to register and find each other.
Acceptance criteria:
- [ ] `src/manifest.json` lists the JS modules in load order: `vb.js`, `gen.js`, `culture.js`, `sim.js`.
- [ ] `src/vb.js` creates the namespace (`var VB = globalThis.VB = globalThis.VB || {};`) and documents the convention in at most 6 comment lines: `src/<path>.js` registers as `VB['<path>']` (e.g. `src/sim/hex.js` is `VB['sim/hex']`) with `VB['sim/hex'] = (() => { ...; return { ... }; })();`, and reads what it needs at the top of its IIFE, e.g. `const { bfs } = VB['sim/hex'];`. A module reads only modules listed before it. Grepping a key finds the module and every user.
- [ ] `gen.js`, `culture.js` and `sim.js` also register as `VB['gen']`, `VB['culture']` and `VB['sim']` (the same objects; the `ArchGen`, `Culture` and `Sim` globals stay). `sim.js` reads `gen` and `culture` from `VB` instead of its `typeof`/`require` fallbacks.
- [ ] `build.py` inlines each manifest file as its own `<script>`, in order, at one `<!--__MODULES__-->` marker in `src/body.html`, which replaces the three marker scripts. The page script stays last.
- [ ] `python3 build.py --check` exits non-zero with a one-line message if `index.html` differs from a fresh build, without writing it; `npm test` runs it first.
- [ ] `src/load.js` (Node only) creates `VB`, requires every manifest file in order and returns `VB`. `tests/regress.js`, `tests/heirs.js`, `tests/calibrate.js` and `tests/golden.js` load through it, with no direct `require('../src/…')` and no hand-set globals.
- [ ] `tests/smoke.js` evals every inline `<script>` of `index.html` in document order, rewriting any top-level `const Name =` to `var Name =` generically; it names no modules and assumes no script count.
- [ ] `npm test` passes; `tests/golden.json` unchanged.
Notes / questions:

## VB-013: Structure lint: module headers, file and line length
Status: ready
Priority: 1
Size: S
Design ref: none (code structure)
Goal: Keep files small and lines short as nightly work adds code, so an agent can grep for a line and read it without pulling in a whole file.
Acceptance criteria:
- [ ] `tests/lint.js` (Node built-ins only), run by `npm test`, checks every file in `src/manifest.json` and `src/load.js`: line 1 is `// @sys <key>: <purpose in one line>`, where `<key>` is the file's `VB` key (`sim/hex`, `gen`, …; `load` for `src/load.js`); at most 400 lines; no line over 160 characters.
- [ ] Today's violations are recorded per file in `tests/lint-baseline.json` (line count, number of long lines). Lint fails if a file's count goes up or a file not in the baseline breaks a rule; for each failure it prints `file:line` and the rule.
- [ ] When a count goes down, lint says so; `node tests/lint.js --update` lowers the baseline and never raises it.
- [ ] `@sys` headers are added to all current modules; `src/body.html` is out of scope for this task.
- [ ] `npm test` passes; `tests/golden.json` unchanged.
Notes / questions:
- `grep -rn "^// @sys" src` then prints the module map.

## VB-014: CLAUDE.md, a short guide for agents
Status: ready
Priority: 1
Size: S
Design ref: none (documentation)
Goal: A file every agent reads first, so it can find the right code in a few greps instead of reading whole files. Short, each fact once, nothing grep can tell.
Acceptance criteria:
- [ ] `CLAUDE.md` at the root, at most 100 lines, with these parts:
- [ ] What it is, in 2 lines, with the design doc ("Village builder: game design snapshot v0.3", https://claude.ai/artifact/H76cgchMVnZ56sdGA215es) and a pointer to `BACKLOG.md` and its rules.
- [ ] Commands: build, `build.py --check`, test, `golden.js --update`, lint and `--update`, calibrate, play locally.
- [ ] Finding things: `grep -rn "^// @sys" src` (module map), `grep -rn "@state" src` (state schema, VB-015), definitions are `function name(` or `const name = (`, `VB['<path>']` for a module and its users, and `// ----` section headers.
- [ ] Architecture in at most 10 lines: `ArchGen.generate` makes the world `w`; `Sim.seed` makes the state `st`; `Sim.advance` runs it; `Culture` holds customs; the page script in `src/body.html` draws and only reads `st`, writing to it only through the `Sim` API and the flags it sets today (list them: `visualDirty`, `naturalDeaths`, `driftMul`).
- [ ] Conventions: determinism (all randomness from a seeded `mulberry32`; no `Math.random` or `Date` in `src/` outside the page script); time in game hours, calendar constants in one place; ids are array indexes and never reused; where the tunables live (`ECON`, `ROLES`, `KINDS`, the culture's `DIMS` and `ARCHETYPES`), and which tables a new job kind or custom touches (check each claim against the code).
- [ ] Working rules: the golden rule from BACKLOG.md, rebuild `index.html` before committing, keep `@sys` and `@state` lines current.
- [ ] It copies nothing from the design doc and lists no individual functions.
- [ ] No code changes; `npm test` passes.
Notes / questions:
- Later tasks keep it current: VB-020 updates the file locations.

## VB-015: State schema as greppable tags
Status: ready
Priority: 1
Size: M
Design ref: none (documentation)
Goal: Document every field of the world `w` and the state `st` once, next to the code that creates it, so `grep -rn "@state" src` gives the whole schema.
Acceptance criteria:
- [ ] Each top-level key of `st` has one `// @state st.<key>: <type>; <meaning, units>` line where it is created; arrays of records list their fields, e.g. `// @state st.households[]: {id, farmstead, holder, members[], grain (rations), wood (loads), hungryDays, dissolved}`.
- [ ] The same for `w` in `gen.js`: each per-tile array with its type, range and meaning (e.g. `w.biome: Uint8Array per tile; B.* code`), and the scalar sizes in one line.
- [ ] Units are stated (game hours, rations, loads, 0–1); lines are at most 160 characters.
- [ ] `tests/lint.js` fails if a top-level key of `st` (founders and heirs, seed 7) or of `w` has no `@state` tag in `src/`.
- [ ] Comments only; `tests/golden.json` unchanged.
Notes / questions:

## VB-016: Refactor: sim rules, hex helpers and village layout into modules
Status: ready
Priority: 1
Size: S
Design ref: none (code structure)
Goal: First step in splitting `src/sim.js` (1,033 lines) along its systems. Move the data tables and the pure world helpers, which nothing else they call depends on.
Acceptance criteria:
- [ ] `src/sim/rules.js` (`VB['sim/rules']`): `DAY`, `SEASON_DAYS`, `YEAR_DAYS`, `YEAR`, `SEASONS`, `cal`, `WORK`, `ECON`, `FERTILITY`, `farmable`, `ROLES`, `KINDS`, `MALE`, `FEMALE`, `patronym`, `DIRNAME`, `hazard`, `SPEED`.
- [ ] `src/sim/hex.js` (`VB['sim/hex']`): `bfs`, `pathTo`, `land`, `hexSteps`, `landComponents`.
- [ ] `src/sim/layout.js` (`VB['sim/layout']`): `placeFields`, `siteScore`, `villageName`, `makeFence`, `makeFarmstead`, `findSite`, `buildVillage`, `nameFarms`, `finishLand`.
- [ ] `src/sim.js` reads them back with one destructuring line per module and keeps everything else; its exports are unchanged.
- [ ] A helper used only by moved code moves with it. If a function would need a module later in the manifest, it stays in `src/sim.js` and the PR says so.
- [ ] Refactor rules hold.
Notes / questions:

## VB-017: Refactor: family records and agents into modules
Status: ready
Priority: 1
Size: S
Design ref: none (code structure)
Goal: Move the person/household record helpers and pawn movement and work out of `src/sim.js`. Depends on VB-016.
Acceptance criteria:
- [ ] `src/sim/records.js` (`VB['sim/records']`): `person`, `marry`, `nameKit`, `makeHousehold`, `joinHousehold`, `personEvent`, `log`, `age`, `birthYear`, `fullName`, `spouseOf`, `childrenOf`, `siblingsOf`, `kinship`, `kinNear`, `villageOf`, `settlementIdOf`, `isHolder`, `holdingOf`, `practice`, `farmPractice`.
- [ ] `src/sim/agents.js` (`VB['sim/agents']`): `homeSpot`, `placeAtHome`, `tileAt`, `route`, `walkTo`, `workSpot`, `start`, `release`, `complete`, `deposit`, `wantsWork`, `idleAbout`, `arrived`, `goHome`, `stepWork`, `moveAgent`, `describe`.
- [ ] Same rules for helpers and late dependencies as VB-016.
- [ ] Refactor rules hold.
Notes / questions:

## VB-018: Refactor: job board and inheritance into modules
Status: ready
Priority: 1
Size: S
Design ref: none (code structure)
Goal: Move the job board and succession out of `src/sim.js`; most feature tasks (VB-003, VB-007 to VB-010) then edit these small files instead. Depends on VB-017.
Acceptance criteria:
- [ ] `src/sim/jobs.js` (`VB['sim/jobs']`): `post`, `refreshJobs`, `mayTake`, `urgency`, `bid`, `planRound`.
- [ ] `src/sim/heirs.js` (`VB['sim/heirs']`): `heirRanking`, `moveTo`, `transfer`, `extinct`, `succession`, `refreshRoles`, `placeIfMarried`, `wantsOut`.
- [ ] Same rules for helpers and late dependencies as VB-016.
- [ ] Refactor rules hold.
Notes / questions:

## VB-019: Refactor: culture wiring and the yearly round into modules
Status: ready
Priority: 1
Size: S
Design ref: none (code structure)
Goal: Move the code linking pawns to `Culture`, and deaths, retirement, meetings and the moving round, out of `src/sim.js`. Depends on VB-018.
Acceptance criteria:
- [ ] `src/sim/society.js` (`VB['sim/society']`): `initCulture`, `updateTies`, `refreshPrestige`, `refreshInterests`, `noteContacts`.
- [ ] `src/sim/lifecycle.js` (`VB['sim/lifecycle']`): `killPawn`, `retireHolder`, `holdMeetings`, `kinOk`, `movingRound`, `dailyLife`.
- [ ] Same rules for helpers and late dependencies as VB-016.
- [ ] Refactor rules hold.
Notes / questions:

## VB-020: Refactor: scenarios and the clock into modules; `Sim` as a facade
Status: ready
Priority: 1
Size: S
Design ref: none (code structure)
Goal: Finish the split: `src/sim.js` keeps only the public `Sim` object, built from the modules. Depends on VB-019.
Acceptance criteria:
- [ ] `src/sim/scenarios.js` (`VB['sim/scenarios']`): `seedFounders`, `seedHeirs`, `makeState`, `seed`.
- [ ] `src/sim/clock.js` (`VB['sim/clock']`): `onHour`, `endOfDay`, `newYear`, `advance`.
- [ ] `src/sim.js` only builds `Sim` (and `VB['sim']`) from the modules, with the same keys in the same order; at most 60 lines, no logic.
- [ ] Every `src/sim/*.js` and `src/sim.js` has no lines over 160 characters; their lint baseline entries are removed.
- [ ] `CLAUDE.md`: the tunables and "new job kind or custom" notes point to the new files.
- [ ] Refactor rules hold.
Notes / questions:
- Next batch, not yet written: split the page script in `src/body.html` (rendering, art, panels, family tree, debug) and `gen.js` (generation apart from painting).

## VB-021: Map generation screen with size, seed and starting scenario
Status: ready
Priority: 3
Size: L
Design ref: Starting scenarios. Kim, 2026-10-29: a landing screen to set the map before generating it: map size (tiny/small/medium/large), seed, and starting scenario (Founders, Heirs and empty farms, and a new Populous Villages scenario: high population, only villages, of different sizes). Sizes as below. Founders scales its required land mass to the map. Populous Villages on medium and large maps holds 800–950 people in a few large, more medium and many small villages. Villages are made by shared generators, not hard-coded per scenario. Depends on VB-016 and VB-020 (village layout and scenarios in their own modules); if either is not done, mark this blocked. The "(debug)" label goes. Kim, 2026-10-29: village size bands and household sizes below agreed; at most two generations pre-generated; smaller population targets on Tiny and Small maps.
Goal: Open the game on a map generation screen where the player sets map size, seed and starting scenario, then generates the map. Add a Populous Villages scenario, and make all scenarios build their villages through the same generators.
Acceptance criteria:
- [ ] The page opens on the generation screen (no map is generated until the player presses Generate). It has: map size (Tiny / Small / Medium / Large), a seed field, a starting scenario choice (Founders, Heirs and empty farms, Populous Villages) and a Generate button. "New archipelago" returns to the screen with the last choices filled in. The toolbar `scenarioSel` dropdown is removed, and no scenario carries a "(debug)" label anywhere in the UI.
- [ ] Map size sets `cols` × `rows` passed to `G.generate(seed, opt)`: Tiny 120 × 85, Small 180 × 130, Medium 280 × 200 (today), Large 380 × 270.
- [ ] The seed field is pre-filled with a random seed; the player may type their own (integer, up to 9 digits). The same seed, size and scenario always give the same map and settlement.
- [ ] Founders' minimum land mass scales with the map: `round(1500 × tiles / (280 × 200))`, so 1500 on Medium as today. On Medium, Founders output for seeds 7 and 42 is unchanged (its `tests/golden.json` entries, VB-011, stay the same).
- [ ] Shared generators: villages are made by one village generator (site, farm placement, fields, fence, commons wood, names) and households by one household generator, called with a spec (e.g. number of farms, household makeup). Founders, Heirs and Populous Villages all build through them; scenario code only chooses specs and sites and sets nothing on a village or farm directly. A test checks that a field added to the village generator's output appears in all three scenarios.
- [ ] Populous Villages (`Sim.seed(wd, seed, 'populous')`): only villages (no lone farms). Population target by map size: Tiny 130–170, Small 320–380, Medium and Large 800–950. The generator keeps placing villages until the population is in range, or reports why it could not.
- [ ] Village sizes are drawn from three bands: small 2–5 farms (about 60% of villages), medium 6–10 (about 30%), large 12–16 (about 10%).
- [ ] Households in Populous Villages hold 4–9 people, about 6 on average: a couple, their children, and sometimes a servant. At most two generations are pre-generated: no grandparents, living or on record.
- [ ] Populous Villages holds meetings and appears in the customs panel like the other scenarios.
- [ ] If a scenario finds no settlement site on the chosen map, the screen says so and lets the player pick another seed or size, instead of only a console warning.
- [ ] The URL hash skips the screen and opens a map directly: today's `#s123` and `#h123` keep working (Medium), extended to carry size and the new scenario.
- [ ] If moving Heirs onto the shared generators changes its output, re-record the golden file (`node tests/golden.js --update`) and list the changed entries in the PR.
- [ ] `tests/smoke.js` starts on the screen, generates a Tiny Populous Villages map and checks the settlers list is non-empty, with no console errors. A test checks that Populous Villages maps of each size for seeds 7 and 42 land in their population range, use all three village size bands on Medium and Large, and have no household with more than two generations.
Notes / questions:
- With households of about 6, 800–950 people is about 140–160 farms, e.g. 3 large, 8 medium and 20 small villages.
- Spacing between villages and starting customs for Populous Villages are left to the generators' defaults.
- VB-003 (every farm in a village) changes how lone farms are made; if it is done first, the shared village generator also makes one-farm villages.
