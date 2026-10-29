# Village builder: guide for agents

A village builder proof of concept on a generated hex archipelago: one self-contained `index.html` (PixiJS 8), built from `src/`.
Design reference (read-only): "Village builder: game design snapshot v0.3", https://claude.ai/artifact/H76cgchMVnZ56sdGA215es.
Work is planned in `BACKLOG.md`; read its header for the task rules (status values, the refactor and golden-file rules).

## Commands
- Build: `python3 build.py` (inlines `src/` into `index.html`); `python3 build.py --check` fails if `index.html` is stale.
- Test: `npm install && npm test` (build check, regress, lint, golden, heirs, page smoke test in jsdom).
- Golden file: `node tests/golden.js --update` re-records `tests/golden.json`; do it only for an intended behaviour change.
- Lint: `node tests/lint.js`; `node tests/lint.js --update` lowers `tests/lint-baseline.json`, never raises it.
- Calibrate customs: `npm run calibrate`, or `node tests/calibrate.js natural 2 50` for a quick run.
- Play locally: open `index.html` in a browser (PixiJS loads from a CDN).

## Finding things
- Module map: `grep -rn "^// @sys" src`. State schema: `grep -rn "@state" src` (VB-015).
- A module and its users: grep `VB['<key>']`, e.g. `VB['sim']`. Modules are listed in `src/manifest.json` in load order.
- Definitions are `function name(` or `const name = (`; sections are `// ----` headers.

## Architecture
- `ArchGen.generate(seed)` (`src/gen.js`) makes the world `w`: per-tile typed arrays, regions, and the painterly chunk bake.
- `Sim.seed(w, seed, scenario)` (`src/sim/scenarios.js`) makes the state `st`; `Sim.advance(st, hours)` (`src/sim/clock.js`) runs it.
  Scenarios: `founders`, `heirs`, `populous`. All build villages through `settlementGenerator` in `src/sim/layout.js`. `src/sim.js` only assembles the `Sim` object from the `src/sim/*` modules.
- `Culture` (`src/culture.js`) holds customs: culture-wide customs, per-settlement practice, per-person attitudes.
- The page script in `src/body.html` draws and only reads `st`. It writes to `st` through the `Sim` API and three flags:
  `visualDirty`, `naturalDeaths`, `driftMul` (and it clears `visualDirty` and `rigDirty` after redrawing).
- `src/vb.js` creates the `VB` namespace; `src/load.js` loads the modules in Node for the tests.

## Conventions
- Determinism: all randomness comes from a seeded `mulberry32`; no `Math.random` or `Date` in the modules (the page script may use them).
- Time is in game hours: `DAY`, `SEASON_DAYS`, `YEAR_DAYS` and `YEAR` are defined once, in `src/sim/rules.js`.
- Ids are array indexes (`pawns`, `households`, `farmsteads`, fences) and are never reused.
- Tunables: `ECON`, `ROLES` and `KINDS` in `src/sim/rules.js`; `DIMS` and `ARCHETYPES` in `src/culture.js`.
- A new job kind touches `KINDS`, the `prio` of each role in `ROLES`, and the animation named by its `anim` in the page script.
- A new custom adds a `DIMS` entry (its `key` and `opts`) and a value in each `ARCHETYPES` entry; offsets are computed from `DIMS`.

## Working rules
- Behaviour-preserving work leaves `tests/golden.json` unchanged (see the golden rule in `BACKLOG.md`).
- Rebuild `index.html` before committing; `npm test` checks it.
- Keep the `@sys` and `@state` lines current when a module changes purpose or state fields.
