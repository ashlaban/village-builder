# Village builder: guide for agents

A village builder proof of concept on a generated hex archipelago: one self-contained `index.html` (PixiJS 8), built from `src/`.
Design reference: `design.md`, "Village builder: game design snapshot v0.3"; read-only for implementing tasks (only design and review tasks change it).
Work is planned in `BACKLOG.md` (overview table of open tasks; done ones move to `BACKLOG_ARCHIVE.md`; one file per task in `backlog/`); read its header for the task rules (status values, archs and their phases,
the refactor and golden-file rules). Open design questions for Kim are gathered in `QUESTIONS.md`; answered ones move to `QUESTION_ARCHIVE.md`. The latest review of design against code is `REVIEW.md`.

## Commands
- Build: `python3 build.py` (inlines `src/` into `index.html`); `python3 build.py --check` fails if `index.html` is stale.
- Test: `npm install && npm test` runs the cheap checks in parallel, about 10 s (build check, lint, backlog, regress, trees, stones, weeding, heirs, owners, kinlimit).
- Verify: `npm run verify` runs those and the long runs, about 40 s (golden, populous, births, hunger, page smoke test in jsdom).
  `node tests/run.js verify --verbose` also prints the reported numbers.
- Golden file: `node tests/golden.js --update` re-records `tests/golden.json`; do it only for an intended behaviour change.
- Lint: `node tests/lint.js`; `node tests/lint.js --update` lowers `tests/lint-baseline.json`, never raises it.
- Calibrate customs: `npm run calibrate`, or `node tests/calibrate.js natural 2 50` for a quick run.
- Inspect a run: `node tools/sim.js --scenario founders --seed 7 --map small --years 10` prints one line per year;
  `node tools/sim.js --years 5 --report households --json | jq .` or `--household 3` / `--pawn 12` show the state (`--report households|pawns|jobs|customs|events|farms|idle|paths|relations|herds`).
- Play locally: open `index.html` in a browser (PixiJS loads from a CDN).

## Finding things
- Module map: `grep -rn "^// @sys" src`. State schema: `grep -rn "@state" src` (VB-015).
- A module and its users: grep `VB['<key>']`, e.g. `VB['sim']`. Modules are listed in `src/manifest.json` in load order.
- Definitions are `function name(` or `const name = (`; sections are `// ----` headers.

## Architecture
- `ArchGen.generate(seed)` (`src/gen.js`) makes the world `w`: per-tile typed arrays, regions, and the painterly chunk bake.
  Rivers (`w.river`, `w.riverTo`) and their fords (`w.crossing`) are traced and drawn by `src/gen/rivers.js`, listed before `gen.js`, which calls it.
- Walking: `src/sim/routes.js` holds the cost of each tile (terrain, fords, worn paths; rivers are closed but at a ford or bridge), the A* route
  search, the route cache and `walkable(w)`, the rule every reach search (`bfs`) uses. `src/sim/paths.js` counts and fades worn paths
  (`w.wear`, `w.worn`) and wears in generated villages; `src/gen/paths.js` draws them into the map chunks.
- `Sim.seed(w, seed, scenario)` (`src/sim/scenarios.js`) makes the state `st`; `Sim.advance(st, hours)` (`src/sim/clock.js`) runs it.
  Scenarios: `founders`, `heirs`, `populous`. All build villages through `settlementGenerator` in `src/sim/layout.js`: cluster villages,
  houses round the green, each farm's fields one block beyond the yards. `src/sim.js` only assembles the `Sim` object from the `src/sim/*` modules.
- Animals (VB-131 to VB-134): `src/sim/herds.js` (herds of named cattle and counted sheep, spring breeding, each scenario's herds), `src/sim/meadows.js` (hay meadows and haymaking), `src/sim/byre.js` (the stall period, the autumn count, slaughter, salting); the larder of stored food is in `src/sim/hunger.js`. Design and plan: `docs/review-animals.md`.
- `Culture` (`src/culture.js`) holds customs: culture-wide customs, per-settlement practice, per-person attitudes.
- The page script in `src/body.html` draws and only reads `st`. It writes to `st` through the `Sim` API and three flags:
  `visualDirty`, `naturalDeaths`, `driftMul` (and it clears `rigDirty`, `treeDirty`, `biomeDirty` and `pathDirty` after redrawing); the lint enforces this.
- `src/vb.js` creates the `VB` namespace; `src/load.js` loads the modules in Node for the tests.

## Conventions
- Determinism: all randomness comes from a seeded `mulberry32`; no `Math.random`, `Date` or `performance.now` in the modules (the page script may use them); the lint enforces it, and `// lint-allow: clock <reason>` exempts a line.
- Time is in game hours: `DAY`, `SEASON_DAYS`, `YEAR_DAYS` and `YEAR` are defined once, in `src/sim/rules.js`.
- Ids are array indexes (`pawns`, `households`, `farmsteads`, fences) and are never reused.
- Tunables: `ECON`, `ROLES`, `MARRIAGE`, `SOCIAL`, `SHARES`, `MATCH`, `HERD`, `RIVER`, `TERRAIN`, `ROUTE` and `PATHS` in `src/sim/rules.js`; `KINDS` (job kinds) in `src/sim/kinds.js`;
  `RIVERS` and `FORDS` in `src/gen/rivers.js`; `LOOK` (worn paths) in `src/gen/paths.js`; `DIMS` and `ARCHETYPES` in `src/culture.js`.
- A new job kind is one record in `KINDS` (`src/sim/kinds.js`): numbers, type of work, labels, where to stand, urgency, and what finishing and delivering do.
  It is posted from `refreshJobs` (`src/sim/jobs.js`); roles rank types of work (`work` in `ROLES`, with `except` for single kinds), so a kind of an existing
  type needs no role numbers. Its `anim` names an animation in the page script.
- A new custom adds a `DIMS` entry (its `key` and `opts`) and a value in each `ARCHETYPES` entry; offsets are computed from `DIMS`.

## Working rules
- Behaviour-preserving work leaves `tests/golden.json` unchanged (see the golden rule in `BACKLOG.md`).
- Use `npm test` while working, after each change. Use `npm run verify` sparingly: once at the end of a task, before its last commit,
  and always for a refactor (the golden file is only checked there). A task is not done until verify passes.
- Rebuild `index.html` before committing; both suites check it.
- Keep the `@sys` and `@state` lines current when a module changes purpose or state fields.
- A new state field or record gets its invariants in `tests/lib/invariants.js` (`checkState`, run daily by `tests/invariants.js` in verify).
