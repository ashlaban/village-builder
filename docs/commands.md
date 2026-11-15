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
    bands, the player's line. `npm run nightly` makes all four fixtures, runs extended, then the bench and the bands (the Extended
    checks workflow). A task that changes `src/page/` also runs `node tests/smoke.js` and the `tests/browser*.js` it touches, by
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
- No golden file (retired by VB-408, Kim, 12 November): where an older task or document asks for `tests/golden.js` or a re-recorded
  `tests/golden.json`, `docs/testing.md` stands instead. A refactor shows its behaviour unchanged with `node tools/same.js --base REF`, REF the commit it started
  from: the same runs from both trees, the world and the state compared leaf by leaf, nothing recorded. Its line goes into the PR.
- Targets: `node tools/targets.js [--name PATTERN] [--since DATE]` prints each target's latest value, residual and last five
  (`docs/bench/targets.jsonl`, written by `--record` on the checks that are targets, the bench, the bands and the nightly; `docs/bench/targets.md`).
- Work counters: `node tests/counters.js` (`--update` records an intended change; list the changed counters in the PR);
  `node tools/sim.js --years 1 --report counts [--json]` reports work per game day and living pawn-day; `node tests/perf.js --counter-cost`.
- Cost growth: `node tests/scaling.js` (verify; population exponent at most 1.15) and `node tests/history.js` (extended, from `small-y5` and
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
