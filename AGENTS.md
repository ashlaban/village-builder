# Village builder: guide for agents

A village builder proof of concept on a generated hex archipelago: one `index.html` (PixiJS 8), built from `src/`; it loads PixiJS
(jsDelivr) and the fonts (Google Fonts), so it needs a network connection.

Documents. Read the section you need, not the whole file: `node tools/doc.js FILE "Heading"`, or `--toc` for the contents with sizes.
- `design.md`: the design, snapshot v0.4, a skeleton each slice's plan fills in (v0.3 is `docs/design-v0.3.md`; refs written before
  3 November point there). Read-only but for design and review tasks; a point marked "Under revision" stands until its slice's plan rewrites it.
- `BACKLOG.md`: open tasks, one file each in `backlog/`, done ones in `BACKLOG_ARCHIVE.md`; its last section, "How this backlog works",
  holds the task rules (statuses, archs and phases, the refactor rules). Read and change it with `tools/backlog.js`, not through its tables.
- `QUESTIONS.md`: open design questions for Kim, answered ones in `QUESTION_ARCHIVE.md`; read, answer and move them with `tools/questions.js`.
- `docs/roadmap.md`: the order of work (vertical slices, each an arch of the backlog), the late-game budget and cheap measurement.
- `docs/architecture/target-v2.md`: where the code is going (five layers; principles in section 2; Kim's decisions in section 8). A target,
  not design: where it changes a Decided point of `design.md`, a design pass comes first (its section 11).
- `docs/architecture/modules.md`: where each system lives; `docs/architecture/ownership.md`: who writes each piece of state.
- `REVIEW.md`: the latest review of design against code; earlier reviews are `docs/review-*.md`.
- `docs/balance/`: the balance map (what holds the game in balance at the macro scale): `README.md` for where it stands, `cards.md` for the
  mechanisms, `findings.md` for the experiments of 12 November; its `mocks/` are throwaway research scripts, not game code.

## Taking a task
1. `node tools/backlog.js next`, then `show ID`: the first ready task is the one to take.
2. Read only what its Design ref and notes name (`tools/doc.js`), and its questions (`node tools/questions.js show ID`).
3. If it turns out to need a design decision, stop: `set ID status=needs-review`, and add the questions, with proposed answers, to `QUESTIONS.md`.
4. Work in small commits, with `npm test` after each change.
5. Before the last commit: `npm test` and `node tests/golden.js`; for a task of size M or L, or one that touches `src/page/`, `npm run verify`
   instead, once. Rebuild `index.html` before committing. Only the hard checks stop a merge (Working rules); a target that is out is not a failure:
   report it in the task file and the PR's Targets section (before, after, residual, cause).
6. Tick its criteria and add implementation and validation notes to the task file, then `node tools/backlog.js done ID`.
7. Open the PR, with the impact note and numbers that Working rules ask for.

## Commands
Every tool run from `tools/` answers `--help` with its options, without running: read that, not its source (a new tool starts with `tools/help.js`).
- Backlog: `node tools/backlog.js next|list|show ID [--brief]` to read; `done ID...`, `set ID key=value...`, `new key=value...`,
  `close-arch KEY`, and `sync` after a task file's header is edited by hand, to change it. Each rewrites the tables and runs `tests/backlog.js`.
- Questions: `node tools/questions.js list|show VB-NNN|answer QUERY N TEXT|archive QUERY`. Documents: `node tools/doc.js [FILE] [--toc] [QUERY]`.
- Build: `python3 build.py` inlines `src/` into `index.html`; `python3 build.py --check` fails if it is stale.
- Test: `npm install && npm test` runs the cheap headless checks in parallel (build, lint, ownership, backlog, regressions); a passing run
  prints its summary only (`node tests/run.js test --list` prints each script's line).
- Verify: `npm run verify` adds the long simulations, golden states, saved fixtures, and the page in jsdom and real Chromium (functionality,
  not rendering speed); `node tests/run.js verify --verbose` also prints the reported numbers.
- Fixtures, late saves (`small-y5`, `small-y40`, `medium-y5`, `medium-ref`): a local cache, never published or fetched (VB-272). They
  lie in the gitignored `tests/fixtures/<key>/`, the key a hash of the modules of `src/manifest.json`, so a fixture is made for the
  sources as they are and is never stale: `node tools/fixtures.js status|make|clean`. One run a map saves both of its fixtures (small
  about 2 minutes, medium 1.5, side by side); `medium-ref` is saved at the first year's end with 1,000 living (by year 60), and its
  stamp names the year. `npm run verify` makes the small pair first when the sources lack it, beside its other scripts; in a test or a
  tool, `require('./lib/fixtures.js').loadFixture(name)` gives `{st, stamp}`, making a missing one first; `npm run nightly` makes what
  is missing and runs the bench (minutes).
- Bands (`tests/lib/bands.js`, one table; Kim's decision 9): `node tests/bands.js` (verify) asserts each band's reduced run, populous on
  the tiny map at four seeds for 8 years; `node tools/bands.js` makes the full runs (populous and founders small, heirs), prints each band
  as in or out and appends to `docs/bench/bands.jsonl`, never failing (about 15 to 20 minutes; `npm run nightly` runs it for a new commit).
- Golden file: `node tests/golden.js --update` re-records `tests/golden.json`, only for an intended behaviour change; list the changed entries in the PR.
- Targets: `node tools/targets.js [--name PATTERN] [--since DATE]` prints each target's latest value, residual and last five
  (`docs/bench/targets.jsonl`, written by `--record` on the checks that are targets, the bench, the bands and the nightly; `docs/bench/targets.md`).
- Work counters: `node tests/counters.js` (`--update` records an intended change; list the changed counters in the PR);
  `node tools/sim.js --years 1 --report counts [--json]` reports work per game day and living pawn-day; `node tests/perf.js --counter-cost`.
- Cost growth: `node tests/scaling.js` (npm test; population exponent at most 1.15) and `node tests/history.js` (verify, from `small-y5` and
  `small-y40`; work per living pawn-day at year 40 over year 5, target 1.25). Both report each counter's ratio, target and residual
  as targets and never fail.
- Baselines that only fall: `node tests/lint.js --update` (`tests/lint-baseline.json`) and `node tests/ownership.js --update` (fixed sites).
- Inspect a run: `node tools/sim.js --scenario founders --seed 7 --map small --years 10` prints a line a year; `--report NAME [--json]`
  adds a report (households, pawns, jobs, events, hunger, perf, counts and more), `--household N`, `--pawn N`; `--save FILE` and
  `--load FILE`, so a bug report can carry the run.
- Review tools (VB-337): `node tools/sim.js --report hours [--from Y] [--fields N] [--team] [--household N] [--json]` (pawn-hours a
  household-year by job kind, work and walking, against its hands' and workers' working hours, and the farming year's days; `tools/hours.js`);
  `node tools/stocks.js [--json]` (each stored quantity's adders, takers and readers, and what happens at none; marks those read by nothing).
- Food balance: `node tools/balance.js --scenario populous --seeds 3,7,11,42 --map small --years 15`: rations by source against need.
- Also: `node tools/gossip.js` (VB-187's experiment: stories against opinion averaging in a reduced scenario; `docs/gossip-experiment.md`), `node
  tools/rules.js` (rule owners; a pawn's death hazard), `node tools/writes.js` (each field's writers and readers; dependencies and cycles), `node
  tests/dependencies.js` (no lookups into later modules but command dispatch), `npm run calibrate` (customs; `node tests/calibrate.js natural 2 50` is
  quick), `node tools/wrap.js FILE...` (breaks lines over 160 characters), `node tools/shot.js` (screenshots of the page), `node
  tools/village-shot.js` (one generated village on a really tiny island, to judge villages and roads), `node tools/bench.js` (the budget's lines at
  `medium-y5` and `medium-ref`).
- Agent usage: `node tools/agent-usage.js` (this session's calls, tokens and tool results, from its transcript; `--history docs/agents/usage`).
- Play locally: open `index.html` in a browser.

## Finding things
- Module map: `grep -rn "^// @sys" src`; state schema: `grep -rn "@state" src`; modules in load order: `src/manifest.json`.
- A module and its users: grep `VB['<key>']`, e.g. `VB['sim']`. Definitions are `function name(` or `const name = (`; sections are `// ----` headers.
- The page script is `src/page/*.js`, in the order of `src/page.json`; `build.py` splices them, without their `@sys` line, into the one closure
  in `src/body.html`. They are not `VB` modules: they share the closure's variables (grep `src/page` for a name), and run in order.

## Conventions
- Read owned fields freely; write through the module in `src/owners.json` (caches follow the same rule; page flags are signals).
  `tests/ownership.js` checks this; `// lint-allow: owner <reason>` exempts one line. Its schema validates owners against the manifest and
  `plannedOwners`; remove a planned name when its module lands.
- `st` is plain data: no functions, and no state kept aside in module closures, or a loaded run drifts (`tests/plaindata.js`, `tests/saves.js`).
  A world field the simulation writes goes into the `WORLD` list of `src/sim/saves.js`.
- A new act a pawn or the moving round chooses gets a verb in `src/sim/commands.js`, reached by `issue(st, {actor, verb, target, args, source})`;
  a verb checks the act is possible and returns why not; `tests/commands.js` checks that only the verbs call the acts they wrap.
- Events are written by `log(st, text, event)` and `personEvent(...)` (`src/sim/records.js`); a log line names its event's kind, pawn and
  place (`atHousehold`, `atFarm`); `tests/record.js` checks every call. The village log and the History tabs are views of the record
  (`Sim.villageLog`, `Sim.chronicle`, `src/sim/notable.js`): there is no `st.events`.
- Food moves through `src/sim/stores.js` operations, each with a good and a reason.
- A rule of `VB['sim/registry']` is declared or contributed to before the first seed or load, which seals the registry; rules never enter saved state.
- The page script draws and only reads `st`. It writes to `st` through the `Sim` API and three flags, `visualDirty`, `naturalDeaths`, `driftMul`,
  and clears `rigDirty`, `treeDirty`, `biomeDirty`, `pathDirty` and `landDirty` after redrawing; the lint enforces this.
- A new loop over a growing collection, or over pairs, adds a declared work counter in `VB.COUNTERS`.
- Determinism: all randomness comes from seeded streams (`src/sim/rng.js`): each system draws from its own, `rnd(st.rng.<system>)`, and a
  new system adds its name to `SYSTEMS` there; tests force chances with `fix` on a stream. No `Math.random`, `Date` or `performance.now` in
  the modules (the page script may use them); the lint enforces it, and `// lint-allow: clock <reason>` exempts a line.
- Time is in game hours: `DAY`, `SEASON_DAYS`, `YEAR_DAYS` and `YEAR` are defined once, in `src/sim/rules.js`.
- Ids are array indexes (`pawns`, `households`, `farmsteads`, fences) and are never reused.
- Tunables, a new job kind and a new custom: `docs/architecture/modules.md`, Adding things.

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
- Behaviour-preserving work leaves `tests/golden.json` unchanged (the refactor rules are in `BACKLOG.md`, "How this backlog works").
- Use `npm test` while working, after each change. At the end of a task, before its last commit: `node tests/golden.js` (the golden file
  is not in `npm test`), or `npm run verify` once for size M or L and for a change under `src/page/`. The Checks workflow
  (`.github/workflows/checks.yml`) runs verify, which makes the small fixtures it loads, only when started by hand.
- Hard and soft checks (Kim, 10 November, VB-261; `docs/gates.md`). Hard, and stopping a merge: a red `npm test`, or a hard script of
  verify (the build, lint rules and size baselines, ownership, dependencies, backlog, determinism and plain data, rule tests, golden
  file (an unlisted change fails), saves, invariants, fixtures loading, the page's functional tests, the counters' structure). Cost,
  balance, demography and timing are targets: they print their measure, target and residual, and never set the exit code. A PR has a
  "Targets" section, one line for each target the change moves or was meant to move (before, after, residual, whether the change is
  its cause) and one line summing the targets out and not moved ("8 targets out, as on `main`"). A change never raises a target,
  re-records a ceiling or writes an allowance to make a residual vanish; only Kim changes a target. The lint and ownership baselines
  stay ratchets.
- Rebuild `index.html` before committing; both suites check it.
- A slice's wrap-up adds its loops' bands to `tests/lib/bands.js`: a `report` for the full runs and, where a reduced run can show the
  loop, an `assert`.
- Keep the `@sys` and `@state` lines current when a module changes purpose or state fields.
- A new state field or record gets its invariants in `tests/lib/invariants.js` (`checkState`, run daily by `tests/invariants.js` in verify)
  and, if it is a stored quantity, its line in `tools/stocks.js` (what happens at none; `tests/review-tools.js` checks it).
- Every PR of size M, or that adds a module or a state field, starts with a short impact note: the modules and state it reads and writes,
  any new coupling between systems, and, where it adds an abstraction or a special case, why the existing ones do not fit.
- A change to behaviour reports numbers before and after (`tools/sim.js`, `tools/balance.js`, `node tests/run.js verify --verbose`)
  at the seeds and maps it names, in the PR and in the task file, and says whether households, not only averages, are better off.
- When a change would add the third special case of one pattern, propose the general rule instead (or a task for it, in the PR).
- A refactor makes the code simpler, not only spread over more files: its PR says what fell (lines, couplings, duplicated rules).

## Rules for cost (Kim's; `docs/roadmap.md`, section 5)
Budget at the late reference, the first year populous medium reaches 1,000 living (`medium-ref`, made by VB-202): 200 ms of simulation a game day,
a whole year's mean, for the systems built so far (half of the finished game's 400 ms, a quarter of the main thread at 30×; each slice's plan
claims its line from the rest; each system's share is in `tools/bench.js`, VB-203), no 6-minute step over 60 ms on `medium-ref` and
`small-y40`, cost per living pawn-day at `small-y40` at most 1.25 times `small-y5`, save and load under 0.5 s each of main thread at `medium-ref`.
There is no `medium-y60` (Kim, 8 November): the bench reports `medium-y5` and `medium-ref`.
Every plan and PR is checked against these rules:
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
10. Work counters live in `VB.count`, outside `st`: never saved, never read by the simulation, read only by tools and tests.
