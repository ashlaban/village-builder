# Commands: the full reference

Moved here from `AGENTS.md` on 15 November 2026, unchanged, so that a task loads only the commands it needs; `AGENTS.md`, Commands, keeps
the short list. Read one entry with `node tools/doc.js docs/commands.md QUERY`, or a tool's own `--help`.

Every tool run from `tools/` answers `--help` with its options, without running: read that, not its source (a new tool starts with `tools/help.js`).
- Backlog: `node tools/backlog.js next|list|show ID [--brief]` to read; `done ID...`, `set ID key=value...`, `new key=value...`,
  `close-arch KEY`, and `sync` after a task file's header is edited by hand, to change it. Each rewrites the tables and runs `tests/backlog.js`.
- A task's brief: `node tools/brief.js VB-NNN [--refs N]` prints, in one call, the task up to its criteria (its notes by size only, a
  `Flag:` line kept), its open questions, each section of `design.md` its Design ref names (whole up to N KB, default 4; a longer one
  by its subsections), the tasks that wait for it, and the rules for its kind (a change of behaviour, a refactor, the page, a plan, a wrap-up).
- Inbox, in an orchestrated run (`docs/agents/worker.md`): `node tools/inbox.js start|claim|note|result` for a sub-agent, `init|status|
  apply|report|results` for the orchestrator. A local SQLite file shared by the checkout's worktrees, never committed: reserved task
  IDs, who edits which file, and the notes (new tasks, questions, tuning rows, principle candidates, teleports, close calls) that
  `apply` writes into the backlog, `QUESTIONS.md` and `docs/tuning.md`, once.
- Questions: `node tools/questions.js list|show VB-NNN|answer QUERY N TEXT|archive QUERY`. Documents: `node tools/doc.js [FILE] [--toc] [QUERY]`.
- Format: `src/` is formatted by Prettier (`.prettierrc.json`: width 120, single quotes; VB-380): `npm run format` after editing a
  source, before the build; `tests/format.js` (fast) fails an unformatted file. `git config blame.ignoreRevsFile .git-blame-ignore-revs`
  keeps the sweep out of `git blame`. `tests/` and `tools/` are not formatted yet.
- Build: `node build.js` inlines `src/` into `index.html`, a derived file that is not kept in the repository (VB-450); `--check` fails if it is stale, `--stdout` prints the
  page and writes nothing (`tests/lib/page.js`). `tests/build.js` (fast) checks that the page builds.
- Tests, three tiers listed in `tests/suites.js` (`docs/testing.md` has what each covers, the timeouts and the measured times):
  - Fast: `npm install && npm test`, about 10 seconds (budget 30): the build, lint, ownership, dependencies, backlog and rule checks on
    deliberate small states. A passing run prints its slowest five and its summary (`node tests/run.js test --list` prints each script's line).
  - Verify: `npm run verify` runs fast and then the integration tier, rule checks on small constructed states and the small tools,
    about 35 seconds in all (budget a minute); `node tests/run.js integration` runs that tier alone, and `--verbose` also prints the
    reported numbers. A script of either tier takes under 5 seconds; the runner names one over (`over 5 s: ...`), without failing.
  - Extended, at night and never part of a task: `node tests/run.js extended` makes the small fixtures and runs everything long:
    generated islands and runs of years, the page in jsdom and real Chromium, demography, daily invariants, fixtures, history,
    bands, the player's line. `npm run nightly` makes all four fixtures, runs extended, then the bench and the bands, whether or not
    extended passed; a failed check fails it at the end (the Extended checks workflow). A task that changes `src/page/` also runs `node tests/smoke.js` and the `tests/browser*.js` it touches, by
    name, until verify has a page check of its own (VB-409).
  - One script alone: `node tests/NAME.js`. A new check is built on a small constructed state (`tests/tiny.js`, `tests/lib/probe.js`)
    and goes into fast or integration, with a line in `tests/suites.js`; only what needs a whole island or years goes to extended.
- Fixtures, late saves (`small-y5`, `small-y40`, `medium-y5`, `medium-ref`): a local cache, never published or fetched (VB-272). They
  lie in the gitignored `tests/fixtures/<key>/`, the key a hash of the modules of `src/manifest.json`, so a fixture is made for the
  sources as they are and is never stale: `node tools/fixtures.js status|make|clean`. One run a map saves both of its fixtures (small
  about 2 minutes, medium 1.5, side by side); `medium-ref` is saved at the first year's end with 1,000 living (by year 60), and its
  stamp names the year. `npm test` and `npm run verify` load none (they run at night); the extended tier makes the small pair first when the sources
  lack it; in a test or a tool, `require('./lib/fixtures.js').loadFixture(name)` gives `{st, stamp}`, making a missing one first;
  `npm run nightly` makes what is missing and runs the bench (minutes).
- Bands (`tests/lib/bands.js`, one table; Kim's decision 9): `node tests/bands.js` (extended) checks each band's reduced run, populous on
  the tiny map at four seeds for 8 years; `node tools/bands.js` makes the full runs (populous small at four seeds, founders small at
  sixteen, heirs at two), prints each band and appends to `docs/bench/bands.jsonl`, never failing (`npm run nightly` runs it for a new
  commit). Growth is a target over a scenario's seeds; a household's hunger is described, with no target (Deciding without Kim, 1 and 2).
  The marriage valve and the pace of growth (VB-633) are described bands of every full run: growth by 20 years and before and after land
  grows scarce, the year 1,000 is reached (or worked out, marked "arithmetic"), the swing between decades, the age at first marriage, the
  never married at 45 and who waits by cause. Its two runs on the medium map are weekly, not nightly (a populous medium run is 13 minutes
  of CPU): `node tools/bands.js --runs populous-medium,founders-medium`, which `npm run nightly` adds on Sundays.
- No golden file (retired by VB-408, Kim, 12 November): where an older task or document asks for `tests/golden.js` or a re-recorded
  `tests/golden.json`, `docs/testing.md` stands instead. A refactor shows its behaviour unchanged with `node tools/same.js --base REF`, REF the commit it started
  from: the same runs from both trees, the world and the state compared leaf by leaf, nothing recorded. Its line goes into the PR.
- Targets: `node tools/targets.js [--name PATTERN] [--since DATE]` prints each target's latest value, residual and last five
  (`docs/bench/targets.jsonl`, written by `--record` on the checks that are targets, the bench, the bands and the nightly; `docs/bench/targets.md`).
- Roadmap: `node tools/roadmap.js [--out FILE] [--today DATE] [--json]` writes `docs/roadmap.html` (derived, never committed; the Pages
  workflow makes it): tasks created and done by day from the backlog and its git history, each arch day by day in the order of work, and
  the estimate of when the rest is done (the tool's, from the backlog's pace and growth). Kim's decisions on its axis are a list in the tool.
  Needs the full history (`git fetch --unshallow`). Its model is checked on a constructed backlog by `tests/roadmap-tool.js`.
- Work counters: `node tests/counters.js` (`--update` records an intended change; list the changed counters in the PR);
  `node tools/sim.js --years 1 --report counts [--json]` reports work per game day and living pawn-day; `node tests/perf.js --counter-cost`; `node tests/perf.js --engine` times two engine workarounds against their plain forms (VB-246; extended tier).
- Cost growth: `node tests/scaling.js` (verify; population exponent at most 1.15) and `node tests/history.js` (extended, from `small-y5` and
  `small-y40`; work per living pawn-day at year 40 over year 5, target 1.25). Both report each counter's ratio, target and residual
  as targets and never fail.
- Baselines that only fall: `node tests/lint.js --update` (`tests/lint-baseline.json`) and `node tests/ownership.js --update` (fixed sites).
- Inspect a run: `node tools/sim.js --scenario founders --seed 7 --map small --years 10` prints a line a year; `--report NAME [--json]`
  adds a report (households, pawns, jobs, events, hunger, perf, counts and more), `--household N`, `--pawn N`; `--save FILE` and
  `--load FILE`, so a bug report can carry the run.
- Review tools (VB-337): `node tools/sim.js --report hours [--from Y] [--fields N] [--team] [--household N] [--json]` (pawn-hours a
  household-year by job kind, work and walking, against its hands' and workers' working hours, and the farming year's days, and by season the
  fields' work, all jobs and idle (VB-356); `tools/hours.js`);
  `node tools/stocks.js [--json]` (each stored quantity's adders, takers and readers, and what happens at none; marks those read by nothing).
  `node tools/contact.js [--seed 7,11,13] [--years 40] [--json]` (VB-834): by village and year, distinct people its adults met at venues against the drift of its attitudes; read-only.
  `node tools/sim.js --report waiting [--json]` (VB-633, `tools/waiting.js`): who waits to marry and why, at the moving round's day, by 20
  years (too hungry, nobody free, kin, no home, the score, the means, free), with the age at first marriage by sex, the share never married
  at 45, marriages a year per 1,000, those put off for the means and the share of adults waiting for land. VB-660 adds the fate of those free: at the round's end, of those still unmarried, put off, refused, lapsed, taken, open or unmatched.
  `node tools/sim.js --report soil [--period year|decade] [--json]` (VB-720, `tools/soil.js`): by period and farm class (no cattle, 1-2 head, 3 or
  more): fields, mean soil and tilth, loads of dung spread to the cap and beyond it a field-year, loads rotted on the heap, grain a field reaped;
  by village: meadow tiles to field tiles, cattle a field, mean tilth, and the correlation of the two. Read from the fields a day at a time, kept
  outside `st`; a description, no target. Its band is `tilth-gain` (`tests/lib/bands.js`).
  `node tools/sim.js --report outlook [--village N] [--json]` (VB-666, `tools/outlook.js`): each household of a village, its supply outlook
  (food, fuel, hay: the season it expects to go short in, or safe) beside the season it did first go short in over the frame, which runs
  on past `--years`; a description with no target.
  `node tools/sim.js --report gathering [--json]` (VB-294, `tools/gathering.js`): by year, the gatherings settled at the autumn meetings
  (host, its villages, how many villages named each host in their choice) and the villages with none; then gatherings a year, how often a
  village's host changed from the year before, and the share of village-years with no gathering.
  `node tools/sim.js --report ground [--reach 12,30] [--seeds 3,7,11] [--json]` (VB-735, `tools/ground.js`): by village, each rock (any tile, and a quarry tile) and deposit within the reach of its green, hidden ores found or not, the rock under the green, and a summary by kind (villages, and maps with several seeds), with the pairs copper and tin and any iron; at any year (`--years`, `--at`, `--load`).
- Food balance: `node tools/balance.js --scenario populous --seeds 3,7,11,42 --map small --years 15`: rations by source against need.
  `node tools/crops.js [--runs populous,founders,heirs] [--years N] [--seeds LIST] [--out FILE|--load FILE] [--json]` (VB-356, the crops'
  wrap-up): the bands' full runs, one per core (about 20 minutes on 4 cores): rations by crop and source against need, fields, fallow and soil
  by rotation, the share of farms by rotation over time, the crops each village holds and when one crosses, crops lost, the correlation of the
  crops' yields and the hunger of one-crop against two-crop farms. Its bands are `crops-lost` and `mixed-farms` (`tests/lib/bands.js`).
  `node tools/sim.js --report accounts [--json]` (VB-403, `tools/accounts.js`; or `--load FILE`): a game year's accounts, village by village
  and in all: food produced by source, received, its outlets and the change in stores, closed to an `unexplained` line; people (births,
  deaths by cause, marriages and who waits, moves, households; growth, births a woman, deaths before 1 and 15, age at first marriage,
  never married at 45); the spread between households; goodwill; labour by season; the balance properties of `docs/balance/cards.md`.
  `node tools/store-flows.js --scenario populous --seeds 7 --years 15 [--rule NAME]`: the village stores' yearly flows (VB-406).
- Also: `node tools/gossip.js` (VB-187's experiment: stories against opinion averaging in a reduced scenario; `docs/gossip-experiment.md`), `node
  tools/rules.js` (rule owners; a pawn's death hazard), `node tools/writes.js` (each field's writers and readers; dependencies and cycles), `node
  tests/dependencies.js` (no lookups into later modules but command dispatch), `npm run calibrate` (customs; `node tests/calibrate.js natural 2 50` is
  quick), `node tools/wrap.js FILE...` (breaks lines over 160 characters; for `tests/` and `tools/`, `src/` has Prettier), `node tools/shot.js` (screenshots of the page), `node
  tools/village-shot.js` (one generated village on a really tiny island, to judge villages and roads), `node tools/bench.js` (the budget's lines at
  `medium-y5` and `medium-ref`).
- Land cover: `node tools/cover.js [--map M] [--seeds 7,11,42]` prints each biome's share of a generated island's land; the thresholds are `COVER` in `src/gen.js`.
- Agent usage: `node tools/agent-usage.js [--results FILE]` (this session's calls, tokens and tool results, and each sub-agent's, from
  their transcripts: weighted cost a done task by size, the orchestrator's share, the median boot, the share done; `--history docs/agents/usage`).
- Play locally: `node build.js`, then open `index.html` in a browser.
