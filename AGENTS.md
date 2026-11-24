# Village builder: guide for agents

A village builder proof of concept on a generated hex archipelago: one `index.html` (PixiJS 8), built from `src/`; it loads PixiJS
(jsDelivr) and the fonts (Google Fonts), so it needs a network connection.

Documents. Read the section you need, not the whole file: `node tools/doc.js FILE "Heading"`, or `--toc` for the contents with sizes.
- `design.md`: the design, snapshot v0.4, a skeleton each slice's plan fills in (v0.3 is `docs/design-v0.3.md`; refs written before
  3 November point there; its change log is `docs/design-changelog.md`). Read-only but for design and review tasks; a point marked "Under revision" stands until its slice's plan rewrites it.
- `BACKLOG.md`: open tasks, one file each in `backlog/`, done ones in `BACKLOG_ARCHIVE.md`; its last section, "How this backlog works",
  holds the task rules (statuses, archs and phases, the refactor rules). Read and change it with `tools/backlog.js`, not through its tables.
- `QUESTIONS.md`: the questions only Kim can answer (Deciding without Kim), answered ones in `QUESTION_ARCHIVE.md`; read, answer and move
  them with `tools/questions.js`. `docs/tuning.md`: the parameters and measured shortfalls that wait for a tuning run Kim starts.
- `docs/slices.md`: the slices (vertical slices, each an arch of the backlog), what each brings, and their order; `docs/cost.md`: the
  late-game budget, the ten rules for cost and cheap measurement; `docs/roadmap.html` (made by `tools/roadmap.js`, not committed): the
  timeline of what was built when, and the estimate of when the rest is done.
- `docs/architecture/target-v2.md`: where the code is going (five layers and presentation; principles in section 2; Kim's decisions in section 8). A target,
  not design: where it changes a Decided point of `design.md`, a design pass comes first (its section 11).
- `docs/architecture/modules.md`: where each system lives; `docs/architecture/ownership.md`: who writes each piece of state.
- `REVIEW.md`: the latest review of design against code; earlier reviews are `docs/review-*.md`.
- `docs/balance/`: the balance map (what holds the game in balance at the macro scale): `README.md` for where it stands, `cards.md` for the
  mechanisms, `findings.md` for the experiments of 12 November; its `mocks/` are throwaway research scripts, not game code.

## Taking a task

1. Take the first ready task from `node tools/backlog.js next`. Run `node tools/brief.js ID` for its criteria, design sections and task-specific rules.
2. Resolve open decisions using **Deciding without Kim** below. Record each decision and reason.
3. Work in small commits and run `npm test` after each change. For a refactor, run focused checks and, where needed, compare against the starting commit with `node tools/same.js`.
4. Before the last commit run `npm run format` and `npm run verify`. For page changes also run `node tests/smoke.js` and the affected browser tests. Hard failures block merging. See `docs/testing.md` for coverage. A nightly failure gets its own repair task.
5. Review, with no orchestrator (VB-1619): commit; `node tools/review.js eligible ID`. For `review`, start a fresh `vb-review` sub-agent
   (Sonnet for S, Opus for M and L, the strongest for a plan) with only `Review ID; base <merge-base>; head <sha>`. On `revise`, revise once,
   in at most 30 calls: each blocking finding mended with a test that fails at the reviewed commit, or rebutted in the findings file; each
   advisory mended or declined; then `review.js confirm ID --reviewed SHA`. No second review. The PR's Review section: arm, verdict, outcomes.
6. Tick the criteria met. For an outstanding measurement or missed target, leave its criterion unticked, give the reason and report the available evidence at PR closeout. Mark complete work with `node tools/backlog.js done ID`. Set incomplete work or a question requiring Kim to `needs-review`. Limit task notes to ten lines of decisions, reasons and outstanding work. A session that worked on one task alone measures itself last, `node tools/agent-usage.js --label worker --task ID --review work/review/ID.json --out docs/agents/usage` (not reviewed: `--arm control` or `ineligible`), and commits the file (the token use page, `tools/usage-page.js`, reads it); in an orchestrated run the orchestrator measures.
7. Open the PR. For size M or a new module or state field, lead with its reads, writes, new coupling and the reason for any new abstraction or special case. For behaviour changes, report whether households were better off. Under **Targets**, give before, after, residual and cause for each target moved or intended to move, then count the other outstanding targets. Only Kim changes targets or starts a tuning run. Keep lint and ownership baselines as ratchets.

Measure behaviour before and after once on the final PR result, or at nightly wrap-up on the merged branch. Measure within a task when its criterion names a number to move or when tuning. A refactor reports what became simpler and lists each intentional behaviour change.

A chain of one-task sessions (`/task`) run one after another by a coordinator is `/chain SIZE [N]`; a night of sub-agents side by side, a PR a task, is `/night [N]` (`.claude/skills/`). In an orchestrated run, follow `.claude/agents/vb-task.md`. Send closeout details through the inbox. The orchestrator updates shared records and opens the PR. Hand over at 120 model calls, or past the context threshold at a boundary (`vb-task.md`, step 8).

### Spending turns
Every model call re-reads the whole context, so a task's cost grows faster than its calls (the token use page, `docs/usage.html`).
- Send independent reads and searches together, in one message: several greps, file sections or `doc.js` headings at once, not one a call.
- Read a function or a section whole, once, not in windows of a few lines.
- Make a file's edits in one call, and check the result in the same call (the diff, or the focused test), not in a call of its own.
- Run `node tools/inbox.js calls` with each `npm test`. Past its context threshold, a session hands the rest of its task to a fresh `vb-task` sub-agent at the next boundary (`docs/agents/handover.md`).

## Deciding without Kim

Ask Kim when a change revises a Decided design mechanism or gives the player a capability outside existing systems. Set the task to `needs-review` and record the question with a proposed answer. Extending an existing crop system to another crop is an ordinary implementation decision. For other choices, apply the design principles in `design.md`, record your reason and continue. Surface close calls below. Enforcing a Decided rule needs no approval. A measured defect may justify adjusting a named bound while preserving its mechanism. Record the bound in the design and report its before-and-after effect. Agents decide tooling under target-v2. Kim decides when changes that hold up other tasks go ahead.

For local parameter experiments, try at most five short runs. Record seeds, map, values and results. Report a formula fix before and after, and record out-of-scope balance shortfalls in `docs/tuning.md`.

### Surfacing
What Kim should see is surfaced, never waited for. A task notes, in its task file and in the inbox (`node tools/inbox.js note`; with
no orchestrator, in its PR):
- **A principle candidate**, when a decision had no principle to rest on, when two principles pulled apart, or when it is the third
  decision of one kind: one line of the rule proposed, and the decisions behind it (`candidate`).
- **A teleport found**, or an act with no pawn: one line, where and what (`teleport`, `act`). It gets no task of its own:
  `inbox.js apply` adds it to its kind's open collecting task ("Teleports found, collected", "Acts with no pawn, collected"; with no
  orchestrator, add the line there yourself), which a slice's wrap-up sweeps.
- **A close call**: a decision another agent could as well have made the other way (`decision`).

The orchestrator gathers these at the head of the night's PR, under "For Kim" (`node tools/inbox.js report`): the candidates first,
then the teleports and the close calls, one line each. Kim accepts a candidate into the design principles or strikes it; until then the decision made stands.

## Commands
Every tool under `tools/` answers `--help` with its options, without running: read that, not its source (a new tool starts with
`tools/help.js`). The full reference, with each tool's cadence, fixtures and measures, is `docs/commands.md`: grep it for a name.
- Writing a task, wherever it is written, its `Touches:` line included: `docs/agents/tasks.md`.
- A task's brief: `node tools/brief.js ID`. Backlog: `node tools/backlog.js next|list|show ID [--brief]`; `done`, `set`, `new`,
  `close-arch`, `sync` change it.
- Before merging main into a branch: `git fetch origin main && node tools/renumber.js --onto origin/main`, which moves the branch's new task
  IDs that main took meanwhile (VB-1680); the merge drivers (`tools/merge.js`, set by `npm install`) then merge the backlog and lists.
- Inbox, in an orchestrated run: `node tools/inbox.js start|claim|note|calls|result` (a sub-agent), `init|status|apply|report|results`.
- Questions: `node tools/questions.js list|show VB-NNN|answer|archive`. Documents: `node tools/doc.js [FILE] [--toc] [QUERY]`.
- Format: `npm run format` after editing `src/` (Prettier). `index.html` is derived and not in the repository (VB-450): never commit it. The
  page's tests and tools build their own copy, and the Pages workflow builds the site's; `node build.js` writes one to open by hand.
- Tests (`tests/suites.js`, `docs/testing.md`): `npm test`, fast, 10 seconds; `npm run verify`, fast and integration, 40 seconds; one
  script, `node tests/NAME.js`. The extended tier, the fixtures, the bench and the bands run at night, never in a task. A new check is
  built on a small constructed state (`tests/tiny.js`, `tests/lib/probe.js`) and gets a line in `tests/suites.js`.
- No golden file: a refactor that claims its behaviour unchanged shows it with `node tools/same.js --base REF`, REF the commit it started from.
- Inspect a run: `node tools/sim.js --scenario founders --seed 7 --map small --years 10 [--report NAME] [--save FILE|--load FILE]`.
- Numbers before and after: `node tools/balance.js` (food by source against need), `node tests/counters.js` (work counters; `--update`
  records an intended change), `node tools/targets.js` (each target's latest value and residual), `node tools/sim.js --report accounts
  [--json]` (VB-403: the year's food account closed to `unexplained`, people, spread, goodwill, labour and the balance properties).
- Baselines that only fall: `node tests/lint.js --update`, `node tests/ownership.js --update`.
- In `docs/commands.md` only: fixtures, bands, cost growth, the review tools (`hours`, `stocks`, `store-flows`), `gossip`, `rules`,
  `writes`, `calibrate`, `wrap`, `shot`, `village-shot`, `cover`, `bench`, `agent-usage`.

## Finding things
- Module map: `grep -rn "^// @sys" src`; state schema: `grep -rn "@state" src`; modules in load order: `src/manifest.json`; tunables:
  `grep -rn "@tunable" src`, beside the tables of `src/sim/rules.js` that several domains read (VB-419).
- Source is read through `readSource(file)` (`tools/lib/source.js`), never `readFileSync`, so that `.ts` is read as JavaScript.
- The terrain's codes, names and grid (`B`, the biomes' names, `treeStage`, `ROCK`, `DEPOSIT`, `hexLocator`, `csample`, a river's kind)
  are `src/world/*` (VB-1501): read them there, not through the `gen` facade, which is the generator and the bake.
- A module and its users: grep `VB['<key>']`, e.g. `VB['sim']`. Definitions are `function name(` or `const name = (`; sections are `// ----` headers.
- The page script is `src/page/*.js`, in the order of `src/page.json`; `build.js` splices them, without their `@sys` line, into the one closure
  in `src/body.html`. They are not `VB` modules: they share the closure's variables (grep `src/page` for a name), and run in order.
- The map's drawing is `src/draw/*` (`draw/bake`, `draw/marks`, `draw/paths`, `draw/rivers`), the presentation layer, listed after `sim.js`:
  the page reads it by key; no generator or simulation module may name it (`tests/dependencies.js`). `ArchGen` is the generator only.

## Conventions
- Read owned fields freely; write through the module in `src/owners.json` (caches follow the same rule; page flags are signals).
  `tests/ownership.js` checks this; `// lint-allow: owner <reason>` exempts one line. Its schema validates owners against the manifest and
  `plannedOwners`; remove a planned name when its module lands.
- `st` is plain data: no functions, and no state kept aside in module closures, or a loaded run drifts (`tests/plaindata.js`, `tests/saves.js`).
  A world field the simulation writes goes into the `WORLD` list of `src/sim/saves.js`.
- A new act a pawn or the moving round chooses gets a verb, registered at load by the module that carries the act out
  (`register(verb, {check, run})` of `sim/commands`, VB-228) and reached by `issue(st, {actor, verb, target, args, source})`; a verb checks
  the act is possible and returns why not; `tests/commands.js` checks that only the verbs call the acts they wrap. `sim/commands` imports no domain.
- A job kind's record is declared as `KINDS` by the module whose state its work changes, beside the rules it calls; `sim/kinds` is the
  registry (the join in a fixed order, the fetch kinds, the roles' ranks, the asking order `ASK`) and holds no domain's rule (VB-418; how
  to add one: `docs/architecture/modules.md`, Adding things).
- Events are written by `log(st, text, event)` and `personEvent(...)` (`src/sim/records.js`); a log line names its event's kind, pawn and
  place (`atHousehold`, `atFarm`); `tests/record.js` checks every call. The village log and the History tabs are views of the record
  (`Sim.villageLog`, `Sim.chronicle`, `src/sim/notable.js`): there is no `st.events`.
- Food moves through `src/sim/stores.js` operations, each with a good and a reason.
- A rule of `VB['sim/registry']` is declared or contributed to before the first seed or load, which seals the registry; rules never enter saved state.
- The page script draws and only reads `st`. It writes to `st` through the `Sim` API and three flags, `visualDirty`, `naturalDeaths`, `driftMul`,
  and clears `rigDirty`, `farmDirty`, `villageDirty`, `treeDirty`, `biomeDirty`, `pathDirty` and `landDirty` after redrawing; the lint enforces this.
- A new loop over a growing collection, or over pairs, adds a declared work counter in `VB.COUNTERS`.
- A table whose entries may come in any order (icons, a tool's reports, the test lists) is marked `// @merge union` on the line before it,
  an entry on lines of its own: entries added on two branches then merge by name (`tools/merge.js`, VB-1679). Not a table whose order is
  saved state or determinism (`KINDS`, rule contributions, event subscribers).
- Determinism: all randomness comes from seeded streams (`src/sim/rng.js`): each system draws from its own, `rnd(st.rng.<system>)`, and a
  new system adds its name to `SYSTEMS` there; tests force chances with `fix` on a stream. No `Math.random`, `Date` or `performance.now` in
  the modules (the page script may use them); the lint enforces it, and `// lint-allow: clock <reason>` exempts a line.
- Time is in game hours: `DAY`, `SEASON_DAYS`, `YEAR_DAYS` and `YEAR` are defined once, in `src/sim/rules.js`.
- Ids are array indexes (`pawns`, `households`, `farmsteads`, fences) and are never reused.
- Tunables, a new job kind and a new custom: `docs/architecture/modules.md`, Adding things.
- A module's length is not capped (VB-413). Code goes where its concern lives, formatted by Prettier. Over 700 formatted lines (the
  400 of the packed sources, rescaled by the sweep of 13 November) the lint asks
  for an open task that splits the module (VB-414): the task that takes it over the line opens one, titled "Refactor: split <key> ..."
  (`sim/heirs`), names it in its PR and goes on. Never place code elsewhere to make room.
  A split is not collected with the findings, and is where to think hardest (Kim, 18 November): its task says which responsibilities
  the module holds and where each belongs, and the split follows those, not the line count. The seven modules the sweep left over the
  line are in `tests/lint-baseline.json` at their lengths, which only fall.
  Width the same way (VB-415): a module over 15 exports (`tests/width-baseline.json` holds today's 21 at their counts) may add one only
  with such a task open; the `sim` facade is not counted, nor an export read only by registries (`REGISTRIES` in `tests/lint.js`: `sim/kinds`, `sim/clock`; VB-454).

## Architecture work
- Read target-v2's principles (section 2) before adding a module, an owner or a call between modules. Before giving new state an owner, find
  its current owner in target-v2 section 4: both of its reflections found tensions where one thing had been given two owners.
- Words: `own` is land ownership, `rank` legal standing, `estate` the body that holds a ranked person's lands. "Claims" already means land
  claims, so debts and dues are "obligations".
- Interface sketches in design documents are TypeScript-style types: shape and ownership, not code to build.
- Hot paths to watch: the household's membership caches, the per-tile travel cost (compile it), the death roll; the rules registry's `value()`
  must not allocate. A categorical derived view (class, tier) feeds a rule only through hysteresis.
- Late-game cost: cost grows with history and with pairs before it grows with people (docs/cost.md, section 1). Measure a change that adds a
  loop on a late save (`node tools/sim.js --load FILE --years 1 --report perf`), not only on populous at year 2.

For a slice wrap-up, add its loop bands to `tests/lib/bands.js` and assert those demonstrable in a reduced run. Update `@sys` and `@state` when responsibilities change. Add invariants for new state and a `tools/stocks.js` entry for a stored quantity. At the third special case, propose a general rule.

Before adding recurring work, estimate entities × cadence × work per call. Measure early and on a late save. See `docs/cost.md` for budgets and system rules.
