# Village builder: guide for agents

A village builder proof of concept on a generated hex archipelago: one `index.html` (PixiJS 8), built from `src/`; self-contained but for PixiJS (jsDelivr) and the fonts (Google Fonts), so it needs a network connection.
Design reference: `design.md`, "Village builder: game design snapshot v0.4" (a skeleton since 3 November: each slice's plan fills in its sections;
v0.3 is kept in `docs/design-v0.3.md`); read-only for implementing tasks (only design and review tasks change it). A point marked "Under revision"
stands as written until its slice's plan rewrites it.
Work is planned in `BACKLOG.md` (overview table of open tasks; done ones move to `BACKLOG_ARCHIVE.md`; one file per task in `backlog/`); read its header for the task rules (status values, archs and their phases,
the refactor and golden-file rules) and its pick order, which follows the vertical slices (the feature freeze of 2 November was lifted on 3 November). Open design questions for Kim are gathered in `QUESTIONS.md`; answered ones move to `QUESTION_ARCHIVE.md`. The latest review of design against code is `REVIEW.md`.
Architecture reference: `docs/architecture/target-v2.md` (3 November): where the code is going (five layers, 21 modules, its principles in section 2,
Kim's decisions in section 8). It is a target, not design: where it changes a Decided point of `design.md`, a design pass comes first (its section 11).
The order of work is `docs/roadmap.md`: vertical slices (each an arch of `BACKLOG.md`, in the order Kim chose on 3 November), the late-game
budget and cheap measurement.
`docs/architecture/ownership.md` (VB-172) maps who writes each piece of state today. The external proposal target-v2 grew from (ChatGPT) is kept in
`docs/architecture/target-architecture.md`; the first response to it, with Kim's adoption of a player who inhabits a pawn, is `docs/review-architecture.md`.

## Commands
- Build: `python3 build.py` (inlines `src/` into `index.html`); `python3 build.py --check` fails if `index.html` is stale.
- Test: `npm install && npm test` runs the cheap headless checks in parallel (including build, lint, ownership, backlog and regressions).
- Verify: `npm run verify` adds the long simulations, golden states, saved fixtures, and page checks in jsdom and real Chromium.
  `node tests/run.js verify --verbose` also prints the reported numbers.
  Presentation timing budgets are deferred by Kim (4 November 2026, VB-166); browser checks cover functionality, not rendering speed.
  Real Chromium checks run individually before the parallel headless checks to avoid software-GPU contention.
- Fixtures: `node tools/fixtures.js status|fetch|publish`; `make [small-y5 small-y40 medium-y5 medium-y60]` makes all by default.
  Saves and stamps live in gitignored `tests/fixtures/`, distributed on the orphan `fixtures` branch. A check or task needing a late
  state uses `require('./lib/fixtures.js').loadFixture(name)` from tests (or `../tests/lib/fixtures.js` from tools): `{st, stamp, stale}`
  or `null` with a missing/offline notice. A stale golden hash is usable; incompatible save formats require a remake.
  `npm run nightly` fetches, remakes stale/missing fixtures in worker processes, and publishes a single replacement orphan commit.
- Golden file: `node tests/golden.js --update` re-records `tests/golden.json`; do it only for an intended behaviour change.
- Work counters: `node tests/counters.js` checks tiny-scale work; `--update` records an intentional change.
  `node tools/sim.js --years 1 --report counts [--json]` reports work per game day and living pawn-day.
  `node tests/perf.js --counter-cost` reports deterministic tally work and a conditional cost estimate at an assumed 5 ns per addition.
- Cost growth: `node tests/scaling.js` checks two/four repeated tiny villages in `npm test`;
  `node tests/history.js` checks 30 days and one moving round from `small-y5` and `small-y40` in verify.
  Both print all work counters; history also reports six-minute step timings, never asserting wall-clock time.
  `--update` only lowers existing excesses in `tests/cost-baseline.json` and removes fixed ones; it refuses new regressions.
- Lint: `node tests/lint.js`; `node tests/lint.js --update` lowers `tests/lint-baseline.json`, never raises it.
- Ownership: `node tests/ownership.js`; fixed sites must be removed with `--update`, which refuses any new write past an owner.
- Rules: `node tools/rules.js` lists owners and contributions; `--explain ID [--load FILE]` explains a pawn's death hazard.
- Calibrate customs: `npm run calibrate`, or `node tests/calibrate.js natural 2 50` for a quick run.
- Inspect a run: `node tools/sim.js --scenario founders --seed 7 --map small --years 10` prints one line per year;
  `node tools/sim.js --years 5 --report households --json | jq .` or `--household 3` / `--pawn 12` show the state (`--report households|pawns|jobs|customs|events|farms|idle|paths|relations|herds|hunger|perf|counts`; `perf` times each system per game day; `hunger` lists households hungry over 30 days in the last year, with a summary);
  `--save FILE` saves the run at the end and `--load FILE` goes on from a save (`.gz` files are gzipped), so a bug report can carry the run.
- Food balance: `node tools/balance.js --scenario populous --seeds 3,7,11,42 --map small --years 15` prints rations made by source (grain net of seed,
  milk, butter, meat) against need, by household size, cattle and weather (VB-048; `--json` adds every household-year).
- Wrap long lines: `node tools/wrap.js FILE...` breaks lines over 160 characters at safe token boundaries (`--dry` reports only; long template text is
  left for wrapping by hand); `node tools/wrap.js --compare OLD.html NEW.html` checks that two builds differ only in whitespace outside literals.
- Writes map (VB-172): `node tools/writes.js` prints every field of the state with the modules that write it (file and line) and read it, the
  modules' dependencies and their cycles; `--field household.grain` lists one field's write sites, `--json` gives it all.
- Play locally: open `index.html` in a browser (PixiJS loads from a CDN).

## Finding things
- Module map: `grep -rn "^// @sys" src`. State schema: `grep -rn "@state" src` (VB-015).
- A module and its users: grep `VB['<key>']`, e.g. `VB['sim']`. Modules are listed in `src/manifest.json` in load order.
- The page script (VB-053): `src/page/*.js`, in the order of `src/page.json`; `build.py` splices them, without their `@sys` line, into the one
  closure in `src/body.html` (which keeps the markup, styles and the closure's first and last lines). They are not `VB` modules: they share the
  closure's variables, so a name defined in one is used in the others (grep `src/page` for it). Keep their order: `const` and `let` run in order.
- Definitions are `function name(` or `const name = (`; sections are `// ----` headers.

## Architecture
- `VB['sim/registry']` combines load-time rule declarations and ordered contributions; `value` creates no per-call containers or closures.
  `explain` checks finite outputs and contribution ranges and reports each factor, the combination, the raw result and clamp bounds.
  The million-read heap test checks retained memory after GC; it does not prove zero temporary allocations in provider callbacks.
  Modules declare an owned rule or contribute a factor/term before the first seed/load, which seals the registry; rules never enter saved state.
- `ArchGen.generate(seed)` (`src/gen.js`) makes the world `w`: per-tile typed arrays, regions, and the painterly chunk bake.
  Rivers (`w.river`, `w.riverTo`) and their fords (`w.crossing`) are traced and drawn by `src/gen/rivers.js`, listed before `gen.js`, which calls it.
- Walking: `src/sim/routes.js` holds the cost of each tile (terrain, fords, worn paths; rivers are closed but at a ford or bridge), the A* route
  search, the route cache and `walkable(w)`, the rule every reach search (`bfs`) uses. `src/sim/paths.js` counts and fades worn paths
  (`w.wear`, `w.worn`) and wears in generated villages; `src/gen/paths.js` draws them into the map chunks.
- `Sim.seed(w, seed, scenario)` (`src/sim/scenarios.js`) makes the state `st`; `Sim.advance(st, hours)` (`src/sim/clock.js`) runs it.
  Scenarios: `founders`, `heirs`, `populous`. All build villages through `settlementGenerator` in `src/sim/layout.js`: cluster villages,
  houses round the green, each farm's fields one block beyond the yards. `src/sim.js` only assembles the `Sim` object from the `src/sim/*` modules.
- Food quantities and paid stakes (VB-174): `src/sim/stores.js` owns grain, rations, sheaves and food ledgers.
  Call operations with a good and a reason; signed ledger entries distinguish goods and pawn stakes. Owed shares stay in heirs/cottage.
- Animals (VB-131 to VB-138): `src/sim/herds.js` (herds of named cattle and counted sheep, spring breeding, each scenario's herds, cows in milk, the team of oxen), `src/sim/meadows.js` (hay meadows and haymaking, only while hay is wanted), `src/sim/byre.js` (the stall period, the autumn count, slaughter, salting, milking, the dung heap); the larder of stored food and grain spoiling in store are in `src/sim/hunger.js`; soil, manure and how many fields a household wants in `src/sim/fields.js`. Design and plan: `docs/review-animals.md`; balance and history: `docs/review-balance.md`.
- Claims (VB-042, VB-155 to VB-158, VB-033): `src/sim/claims.js` (claims on tiles: strength, lapse, disputes by custom), `src/sim/territory.js` (the
  village's outland, borders and cairns), `src/sim/stakes.js` (a field or meadow project stakes its tile; contests) and `src/sim/farmclaims.js`
  (empty farms: the birthright, claimants by custom, restoration and moving in). Design and plan: `docs/review-claims.md`.
- Names (VB-026): `src/sim/names.js` holds the generators (farms by compass, landmark, owner; villages by syllables or founder) and each culture's
  order of preference (`c.namePrefs`); a lone farm's village bears its farm's name, and the page labels a village of two or more farms once.
- Households short of people (stability review, `docs/review-stability.md`): `src/sim/service.js` brings a guardian to an orphaned minor heir and a
  servant to a holder who lives alone; marriage of two holders, handing a farm on (`handOn`) and the means to marry are in `src/sim/lifecycle.js`
  and `src/sim/heirs.js`.
- Saves (VB-074): `Sim.save(st)` and `Sim.load(w, data)` in `src/sim/saves.js`; a generic codec keeps shared objects, Maps, Sets and typed
  arrays, and the tiles the simulation changes are saved with the state (its `WORLD` list: a new world field the simulation writes goes there).
  `st` is plain data (VB-073, `tests/plaindata.js`): no functions, and no state kept aside in module closures, or a loaded run drifts
  (`tests/saves.js` catches it). A loaded run matches the unbroken one given the same `Sim.advance` calls.
- The record of events (VB-075): `st.record`, typed events written by `log(st, text, event)` and `personEvent(...)` in `src/sim/records.js`
  (`false` when another call records the same happening); `Sim.recordOf(st, {pawn, household, farm, village, kinds, from, to})` queries it.
  A new log line names its event's kind, pawn and place (`atHousehold`, `atFarm`); `tests/record.js` checks every call.
- Commands (VB-167 to VB-171): `src/sim/commands.js` holds the verbs (`work`, `walkTo`, `goHome`, `idle`; `decide`; `marry`, `handOn`, `serve`,
  `claim`, `leave`; debug `kill`, `retire`, `argue`, `rally`, `skip`). The planner, the meeting, the moving round and the debug drawer act by
  `issue(st, {actor, verb, target, args, source})` (`Sim.command` for the page); a verb checks that the act is possible and returns why not.
  A new act a pawn or the round chooses gets a verb; `tests/commands.js` checks statically that only the verbs call the acts they wrap.
- Membership (VB-175): `sim/records` alone writes household members, a pawn's household and service (`joinHousehold`,
  `leaveHousehold`, `clearMembers`, `setServant`). Death retains the last household on the historical record.
  `sim/membership.foundHousehold` creates, supplies, owns and populates a farm's household; restoration reaches it by the
  `foundHousehold` command, and a completed plot reaches `sim/cottage` by `finishCottage`.
- `Culture` (`src/culture.js`) holds customs: culture-wide customs, per-settlement practice, per-person attitudes.
- The page script (`src/page/*.js`) draws and only reads `st`. It writes to `st` through the `Sim` API and three flags:
  `visualDirty`, `naturalDeaths`, `driftMul` (and it clears `rigDirty`, `treeDirty`, `biomeDirty`, `pathDirty` and `landDirty` after redrawing); the lint enforces this.
- `src/vb.js` creates the `VB` namespace; `src/load.js` loads the modules in Node for the tests.

## Conventions
- Read owned fields freely; write through the module in `src/owners.json` (caches follow the same rule; page flags are signals).
  `tests/ownership.js` checks this in `npm test`; `// lint-allow: owner <reason>` exempts one line. The table lists creators and the save codec exemption.
  Its schema validates owners against the manifest and explicit `plannedOwners`; remove a planned name when its module lands.
- A new loop over a growing collection, or over pairs, adds a declared work counter in `VB.COUNTERS`.
- Determinism: all randomness comes from seeded streams (VB-072, `src/sim/rng.js`): in play each system draws from its own, `rnd(st.rng.<system>)`,
  and a new system adds its name to `SYSTEMS` there; tests force chances with `fix` on a stream; no `Math.random`, `Date` or `performance.now` in the modules (the page script may use them); the lint enforces it, and `// lint-allow: clock <reason>` exempts a line.
- Time is in game hours: `DAY`, `SEASON_DAYS`, `YEAR_DAYS` and `YEAR` are defined once, in `src/sim/rules.js`.
- Ids are array indexes (`pawns`, `households`, `farmsteads`, fences) and are never reused.
- Tunables: `ECON`, `FIELDS`, `ROLES`, `MARRIAGE`, `SOCIAL`, `SHARES`, `MATCH`, `HERD`, `SOIL`, `RIVER`, `TERRAIN`, `ROUTE`, `PATHS`, `SETTLE` and `SERVICE` in `src/sim/rules.js`; `KINDS` (job kinds) in `src/sim/kinds.js`;
  `RIVERS` and `FORDS` in `src/gen/rivers.js`; `LOOK` (worn paths) in `src/gen/paths.js`; `DIMS` and `ARCHETYPES` in `src/culture.js`.
- A new job kind is one record in `KINDS` (`src/sim/kinds.js`): numbers, type of work, labels, where to stand, urgency, and what finishing and delivering do.
  It is posted from `refreshJobs` (`src/sim/jobs.js`); roles rank types of work (`work` in `ROLES`, with `except` for single kinds), so a kind of an existing
  type needs no role numbers. Its `anim` names an animation in the page script.
- A new custom adds a `DIMS` entry (its `key` and `opts`) and a value in each `ARCHETYPES` entry; offsets are computed from `DIMS`.

## Architecture work
- Read target-v2's principles (section 2) before adding a module, an owner or a call between modules. Before giving new state an owner, find
  its current owner in target-v2 section 4: both of its reflections found tensions where one thing had been given two owners.
- Words: `own` is land ownership, `rank` legal standing, `estate` the body that holds a ranked person's lands. "Claims" already means land
  claims, so debts and dues are "obligations".
- Interface sketches in design documents are TypeScript-style types: shape and ownership, not code to build.
- Hot paths to watch: the household's membership caches, the per-tile travel cost (compile it), the death roll; the rules registry's `value()`
  must not allocate. A categorical derived view (class, tier) feeds a rule only through hysteresis.
- Late-game cost: cost grows with history and with pairs before it grows with people (Rules for cost, below). Measure a change that adds a
  loop on a late save (`node tools/sim.js --load FILE --years 1 --report perf`), not only on populous at year 2.

## Working rules
- Behaviour-preserving work leaves `tests/golden.json` unchanged (see the golden rule in `BACKLOG.md`).
- Use `npm test` while working, after each change. Use `npm run verify` sparingly: once at the end of a task, before its last commit,
  and always for a refactor (the golden file is only checked there). A task is not done until verify passes.
- Rebuild `index.html` before committing; both suites check it.
- Keep the `@sys` and `@state` lines current when a module changes purpose or state fields.
- A new state field or record gets its invariants in `tests/lib/invariants.js` (`checkState`, run daily by `tests/invariants.js` in verify).
- Every PR of size M, or that adds a module or a state field, starts with a short impact note: the modules and state it reads and writes,
  any new coupling between systems, and, where it adds an abstraction or a special case, why the existing ones do not fit
  (external review, `docs/review-external.md`).
- A change to behaviour reports numbers before and after (`tools/sim.js`, `tools/balance.js`, `node tests/run.js verify --verbose`)
  at the seeds and maps it names, in the PR and in the task file, and says whether households, not only averages, are better off.
- When a change would add the third special case of one pattern, propose the general rule instead (or a task for it, in the PR).
- A refactor makes the code simpler, not only spread over more files: its PR says what fell (lines, couplings, duplicated rules).

## Rules for cost (Kim, 3 November; step gate revised 6 November; `docs/roadmap.md`, section 5)
Budget at the late reference (populous medium at year 60, about 1,000 living): 160 ms of simulation a game day, no 6-minute step over 60 ms (medium-y60 temporarily 400 ms until VB-201),
cost per living pawn at year 60 at most 1.25 times year 5, save and load under 0.5 s each. Every plan and PR is checked against these rules:
1. Cost follows activity, not history: no loop in a step walks every record ever made (the dead, dissolved households, ended edges, met
   obligations, the record); the owner keeps an index of the live ones, as a cache with one writer.
2. No pass over pairs: pairs meet only among the present (cells, a venue, a household); every per-pawn collection has a declared cap.
3. Decay lazily: store a value and when it was set and read it in closed form, or store against a shared scale; no daily pass to decay.
4. Schedule, don't poll: what falls due at a known time goes into a due-queue in `st`, as plain data; a step touches only what is due.
5. Stagger and spread: per-holder work on its planning day; yearly work spread over steps, a village or a few households at a time.
6. Compile what is hot: a rule read in an inner loop becomes an array refreshed at its cadence; `value()` allocates nothing.
7. Detail by state, never by camera: what the camera shows never changes what the simulation does; only the page interpolates.
8. Bound every cache (routes, reach maps), and bound history (routine events fold into yearly counts; a pawn's events index the record).
9. Name the cost before building: entities, times cadence, times work per call, in the plan; measure it in the wrap-up, early and on a
   late save.
10. Work counters (slice 0) live in `VB.count`, outside `st`: never saved, never read by the simulation, read only by tools and tests.
